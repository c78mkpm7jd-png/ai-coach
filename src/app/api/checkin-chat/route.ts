/**
 * Check-in-Chat: State beim Öffnen des Chats + optional Partial Save.
 * Eigenständige Route, keine Logik in chat/route.ts.
 *
 * GET: Heute Strava-Aktivität? Heute Check-in? → suggestedMessage (oder null)
 * POST: Partial Save – einzelne Felder für heute in daily_checkins speichern.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getStravaActivities } from "@/lib/strava";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase-Umgebungsvariablen fehlen");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type CheckinRow = {
  id?: string;
  created_at: string;
  weight_kg?: number | null;
  hunger_level?: number | null;
  energy_level?: number | null;
  trained?: boolean | null;
  activity_type?: string | null;
  activity_duration_min?: number | null;
  activity_calories_burned?: number | null;
  calories_intake?: number | null;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

function getTodayBoundsUTC(): { start: string; end: string; dateStr: string } {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const start = `${dateStr}T00:00:00.000Z`;
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);
  const endStr = end.toISOString().slice(0, 10) + "T00:00:00.000Z";
  return { start, end: endStr, dateStr };
}

function isCheckinComplete(c: CheckinRow | null): boolean {
  if (!c) return false;
  return (
    c.weight_kg != null &&
    c.hunger_level != null &&
    c.energy_level != null &&
    c.trained != null
  );
}

function getMissingFields(c: CheckinRow): string[] {
  const missing: string[] = [];
  if (c.weight_kg == null) missing.push("weight_kg");
  if (c.hunger_level == null) missing.push("hunger_level");
  if (c.energy_level == null) missing.push("energy_level");
  if (c.trained == null) missing.push("trained");
  if (c.calories_intake == null && c.protein_intake == null) missing.push("nutrition");
  return missing;
}

/** GET: State für Chat-Start – Strava heute, Check-in heute, vorgeschlagene erste Nachricht */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { start: todayStart, end: todayEnd, dateStr: todayStr } = getTodayBoundsUTC();

    const [stravaActivities, checkinRes] = await Promise.all([
      getStravaActivities(supabaseAdmin, userId),
      supabaseAdmin
        .from("daily_checkins")
        .select("id, created_at, weight_kg, hunger_level, energy_level, trained, activity_type, activity_duration_min, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake")
        .eq("user_id", userId)
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const todayStravaActivities = stravaActivities.filter((a) =>
      a.start_date.startsWith(todayStr)
    );
    const todayHasStravaActivity = todayStravaActivities.length > 0;
    const firstStrava = todayStravaActivities[0];
    const todayCheckin = (checkinRes.data ?? null) as CheckinRow | null;
    const complete = isCheckinComplete(todayCheckin);
    const missing = todayCheckin ? getMissingFields(todayCheckin) : ["weight_kg", "hunger_level", "energy_level", "trained", "nutrition"];

    let suggestedMessage: string | null = null;

    if (complete) {
      suggestedMessage = null;
    } else if (todayHasStravaActivity && !todayCheckin) {
      const act = firstStrava!;
      const type = act.type || "Aktivität";
      const min = Math.round((act.moving_time || act.elapsed_time || 0) / 60);
      suggestedMessage = `Hey, stark – du warst heute ${type} (${min} Min). Magst du mir kurz sagen: Wie ist dein Gewicht heute, und wie fühlst du dich (Energie & Hunger je 1–5)? Kein Stress, falls du was nicht weißt.`;
    } else if (todayHasStravaActivity && todayCheckin) {
      const act = firstStrava!;
      const type = act.type || "Aktivität";
      const parts: string[] = [];
      if (missing.includes("weight_kg")) parts.push("dein Gewicht");
      if (missing.includes("hunger_level") || missing.includes("energy_level")) parts.push("Energie & Hunger (1–5)");
      if (missing.includes("nutrition")) parts.push("Kalorien/Makros, falls du sie hast");
      const ask = parts.length ? parts.join(", ") : null;
      suggestedMessage = ask
        ? `Super, dein ${type} ist schon drin. Fehlt nur noch: ${ask}. Kurz reinschreiben reicht.`
        : null;
    } else if (!todayCheckin) {
      suggestedMessage = "Hey, hast du kurz Lust auf einen schnellen Check-in? Gewicht, wie du dich fühlst (Energie & Hunger 1–5) und ob du trainiert hast – dann bin ich up to date.";
    } else {
      const parts: string[] = [];
      if (missing.includes("weight_kg")) parts.push("Gewicht");
      if (missing.includes("hunger_level") || missing.includes("energy_level")) parts.push("Energie & Hunger (1–5)");
      if (missing.includes("nutrition")) parts.push("Kalorien/Makros");
      const ask = parts.join(", ");
      suggestedMessage = ask ? `Fehlt nur noch: ${ask}. Einfach kurz antworten, kein Stress.` : null;
    }

    return NextResponse.json({
      todayHasStravaActivity,
      todayStravaSummary: firstStrava
        ? {
            type: firstStrava.type,
            name: firstStrava.name,
            duration_min: Math.round((firstStrava.moving_time || firstStrava.elapsed_time || 0) / 60),
            average_heartrate: firstStrava.average_heartrate ?? null,
          }
        : null,
      todayCheckin: todayCheckin
        ? {
          id: todayCheckin.id,
          created_at: todayCheckin.created_at,
          weight_kg: todayCheckin.weight_kg,
          hunger_level: todayCheckin.hunger_level,
          energy_level: todayCheckin.energy_level,
          trained: todayCheckin.trained,
          activity_type: todayCheckin.activity_type,
          activity_duration_min: todayCheckin.activity_duration_min,
          activity_calories_burned: todayCheckin.activity_calories_burned,
          calories_intake: todayCheckin.calories_intake,
          protein_intake: todayCheckin.protein_intake,
          carbs_intake: todayCheckin.carbs_intake,
          fat_intake: todayCheckin.fat_intake,
        }
        : null,
      suggestedMessage,
      missingFields: missing,
    });
  } catch (err) {
    console.error("[checkin-chat] GET:", err);
    return NextResponse.json(
      { error: "Fehler beim Laden des Check-in-Status" },
      { status: 500 }
    );
  }
}

/** POST: Partial Save – übergebene Felder für heute speichern (Upsert heute). */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await request.json();
    const {
      weight_kg,
      hunger_level,
      energy_level,
      trained,
      activity_type,
      activity_duration_min,
      activity_calories_burned,
      calories_intake,
      protein_intake,
      carbs_intake,
      fat_intake,
    } = body;

    const { start: todayStart, end: todayEnd } = getTodayBoundsUTC();

    const existing = await supabaseAdmin
      .from("daily_checkins")
      .select("id, weight_kg, hunger_level, energy_level, trained, activity_type, activity_duration_min, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake")
      .eq("user_id", userId)
      .gte("created_at", todayStart)
      .lt("created_at", todayEnd)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const toNum = (v: unknown): number | null =>
      v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;
    const toBool = (v: unknown): boolean =>
      v === true || v === "true" || String(v).toLowerCase() === "ja" || v === 1;

    const payload: Record<string, unknown> = { user_id: userId };

    if (existing.data) {
      const row = existing.data as Record<string, unknown>;
      const updatePayload = {
        weight_kg: weight_kg != null ? toNum(weight_kg) : row.weight_kg,
        hunger_level: hunger_level != null ? toNum(hunger_level) : row.hunger_level,
        energy_level: energy_level != null ? toNum(energy_level) : row.energy_level,
        trained: trained != null ? toBool(trained) : row.trained,
        activity_type: activity_type != null ? String(activity_type) : row.activity_type,
        activity_duration_min: activity_duration_min != null ? toNum(activity_duration_min) : row.activity_duration_min,
        activity_calories_burned: activity_calories_burned != null ? toNum(activity_calories_burned) : row.activity_calories_burned,
        calories_intake: calories_intake != null ? toNum(calories_intake) : row.calories_intake,
        protein_intake: protein_intake != null ? toNum(protein_intake) : row.protein_intake,
        carbs_intake: carbs_intake != null ? toNum(carbs_intake) : row.carbs_intake,
        fat_intake: fat_intake != null ? toNum(fat_intake) : row.fat_intake,
      };

      const { error } = await supabaseAdmin
        .from("daily_checkins")
        .update(updatePayload)
        .eq("id", existing.data.id);

      if (error) {
        console.error("[checkin-chat] POST update:", error);
        return NextResponse.json({ error: "Update fehlgeschlagen" }, { status: 500 });
      }
    } else {
      payload.weight_kg = toNum(weight_kg);
      payload.hunger_level = toNum(hunger_level);
      payload.energy_level = toNum(energy_level);
      payload.trained = trained != null ? toBool(trained) : false;
      payload.activity_type = activity_type != null ? String(activity_type) : "ruhetag";
      payload.activity_duration_min = toNum(activity_duration_min);
      payload.activity_calories_burned = toNum(activity_calories_burned);
      payload.calories_intake = toNum(calories_intake);
      payload.protein_intake = toNum(protein_intake);
      payload.carbs_intake = toNum(carbs_intake);
      payload.fat_intake = toNum(fat_intake);

      const { error } = await supabaseAdmin.from("daily_checkins").insert(payload);

      if (error) {
        console.error("[checkin-chat] POST insert:", error);
        return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[checkin-chat] POST:", err);
    return NextResponse.json(
      { error: "Interner Fehler" },
      { status: 500 }
    );
  }
}
