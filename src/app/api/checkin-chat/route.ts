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
import {
  getTodayBoundsUTC,
  getTodayCheckin,
  isCheckinComplete,
  getMissingFields,
  saveCheckinPartial,
  type CheckinRow,
} from "@/lib/checkin-partial";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase-Umgebungsvariablen fehlen");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** GET: State für Chat-Start – Strava heute, Check-in heute, vorgeschlagene erste Nachricht */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { dateStr: todayStr } = getTodayBoundsUTC();

    const [stravaActivities, todayCheckin] = await Promise.all([
      getStravaActivities(supabaseAdmin, userId),
      getTodayCheckin(supabaseAdmin, userId),
    ]);

    const todayStravaActivities = stravaActivities.filter((a) =>
      a.start_date.startsWith(todayStr)
    );
    const todayHasStravaActivity = todayStravaActivities.length > 0;
    const firstStrava = todayStravaActivities[0];
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
    await saveCheckinPartial(supabaseAdmin, userId, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[checkin-chat] POST:", err);
    return NextResponse.json(
      { error: "Interner Fehler" },
      { status: 500 }
    );
  }
}
