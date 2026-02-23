/**
 * GET /api/strava/activities
 * - Lädt Strava Access Token aus Supabase (profiles.strava_access_token)
 * - Erneuert Token automatisch wenn abgelaufen (über getStravaActivities → getValidStravaAccessToken)
 * - Holt Aktivitäten der letzten 30 Tage: GET https://www.strava.com/api/v3/athlete/activities
 * - Rückgabe: Datum, Typ, Dauer, Distanz, Herzfrequenz, Kalorien
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getStravaActivities, type StravaActivity } from "@/lib/strava";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase-Umgebungsvariablen fehlen");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type StravaActivityResponse = {
  date: string;
  type: string;
  name: string;
  duration_min: number;
  distance_km: number;
  elevation_m: number;
  heartrate_avg: number | null;
  heartrate_max: number | null;
  calories: number | null;
};

function toResponse(a: StravaActivity): StravaActivityResponse {
  const calories = a.calories ?? (a.kilojoules != null ? Math.round(a.kilojoules / 4.184) : null);
  return {
    date: a.start_date,
    type: a.type,
    name: a.name,
    duration_min: Math.round((a.moving_time || a.elapsed_time || 0) / 60),
    distance_km: Math.round((a.distance || 0) / 1000 * 10) / 10,
    elevation_m: Math.round(a.total_elevation_gain || 0),
    heartrate_avg: a.average_heartrate ?? null,
    heartrate_max: a.max_heartrate ?? null,
    calories,
  };
}

/** GET: Aktivitäten der letzten 30 Tage. Token aus Supabase, bei Ablauf automatisch erneuert. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const activities = await getStravaActivities(supabaseAdmin, userId);
    const data = activities.map(toResponse);

    if (data.length === 0) {
      console.log("[Strava activities] 0 activities for user (nicht verbunden oder keine Aktivitäten)");
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error("[Strava activities] Error:", err);
    return NextResponse.json(
      { error: "Aktivitäten konnten nicht geladen werden" },
      { status: 500 }
    );
  }
}
