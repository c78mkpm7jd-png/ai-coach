/**
 * Check-in-Chat: State beim Öffnen des Chats + optional Partial Save.
 * Eigenständige Route, keine Logik in chat/route.ts.
 *
 * GET: Optionales Datum (YYYY-MM-DD) für Strava-Filter + Check-in.
 * POST: Optionales Datum für Partial Save in daily_checkins.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getStravaActivities } from "@/lib/strava";
import {
  getTodayBoundsUTC,
  getTodayCheckin,
  getCheckinByDate,
  isCheckinComplete,
  getMissingFields,
  saveCheckinPartial,
  saveCheckinPartialForDate,
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

const DATE_STR_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateStr = (v: unknown): v is string => {
  if (typeof v !== "string" || !DATE_STR_RE.test(v)) return false;
  const [yearStr, monthStr, dayStr] = v.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-11
  const day = Number(dayStr);
  const dt = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === monthIndex && dt.getUTCDate() === day;
};

/** GET: State für Chat-Start – optionaler Strava-/Check-in-Tag */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { dateStr: todayStr } = getTodayBoundsUTC();
    const dateParam = request.nextUrl.searchParams.get("date");
    const useDateParam = isValidDateStr(dateParam);
    const activeDateStr = useDateParam ? dateParam : todayStr;

    const [stravaActivities, todayCheckin] = await Promise.all([
      getStravaActivities(supabaseAdmin, userId),
      useDateParam ? getCheckinByDate(supabaseAdmin, userId, activeDateStr) : getTodayCheckin(supabaseAdmin, userId),
    ]);

    const todayStravaActivities = stravaActivities.filter((a) =>
      a.start_date.startsWith(activeDateStr)
    );
    const todayHasStravaActivity = todayStravaActivities.length > 0;
    const firstStrava = todayStravaActivities[0];
    const complete = isCheckinComplete(todayCheckin);
    const missing = todayCheckin
      ? getMissingFields(todayCheckin)
      : ["weight_kg", "hunger_level", "energy_level", "trained", "calories_intake", "protein_intake", "carbs_intake", "fat_intake"];

    let suggestedMessage: string | null = null;

    if (complete) {
      suggestedMessage = null;
    } else if (todayHasStravaActivity && !todayCheckin) {
      const act = firstStrava!;
      const type = act.type || "Aktivität";
      const min = Math.round((act.moving_time || act.elapsed_time || 0) / 60);
      suggestedMessage = `Hey, stark – du warst an diesem Tag ${type} (${min} Min). Magst du mir kurz sagen: Wie ist dein Gewicht an diesem Tag, und wie fühlst du dich (Energie & Hunger je 1–5)? Kein Stress, falls du was nicht weißt.`;
    } else if (todayHasStravaActivity && todayCheckin) {
      const act = firstStrava!;
      const type = act.type || "Aktivität";
      const parts: string[] = [];
      if (missing.includes("weight_kg")) parts.push("dein Gewicht");
      if (missing.includes("hunger_level") || missing.includes("energy_level")) parts.push("Energie & Hunger (1–5)");
      if (missing.some((f) => ["calories_intake", "protein_intake", "carbs_intake", "fat_intake"].includes(f))) parts.push("Kalorien/Makros, falls du sie hast");
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
      if (missing.some((f) => ["calories_intake", "protein_intake", "carbs_intake", "fat_intake"].includes(f))) parts.push("Kalorien/Makros");
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

/** POST: Optional date für Partial Save (Update oder Insert für diesen Tag). */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await request.json();
    const dateFromBody = body?.date;

    if (isValidDateStr(dateFromBody)) {
      const { date: _date, ...checkinBody } = body ?? {};
      await saveCheckinPartialForDate(supabaseAdmin, userId, dateFromBody, checkinBody);
    } else {
      await saveCheckinPartial(supabaseAdmin, userId, body);
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
