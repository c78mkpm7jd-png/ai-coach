/**
 * Strava API: Token-Refresh und Aktivitäten laden.
 * Nutzt Umgebungsvariablen: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  kilojoules?: number | null;
  calories?: number | null;
};

type ProfileStrava = {
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  strava_token_expiry: number | null;
  strava_connected: boolean | null;
};

/** Holt aktuelles Profil inkl. Strava-Felder und erneuert Access Token falls abgelaufen. */
export async function getValidStravaAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("strava_access_token, strava_refresh_token, strava_token_expiry, strava_connected")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[Strava] Profile load error:", error.message);
    return null;
  }
  if (!profile) {
    console.log("[Strava] No profile row for user");
    return null;
  }
  const p = profile as ProfileStrava;
  if (!p.strava_connected || !p.strava_refresh_token) {
    console.log("[Strava] Not connected or missing refresh_token");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = p.strava_token_expiry ?? 0;
  const buffer = 300; // 5 Min vor Ablauf erneuern
  const expiresIn = expiry - now;
  const isExpiredOrExpiring = !p.strava_access_token || expiry <= now + buffer;

  if (p.strava_access_token && expiry > now + buffer) {
    console.log("[Strava] Using existing access token (expires in", expiresIn, "s)");
    return p.strava_access_token;
  }

  console.log("[Strava] Token refresh nötig: strava_token_expiry < jetzt + 5min?", isExpiredOrExpiring, "| expiry:", expiry, "| now:", now, "| expiresIn:", expiresIn, "s");
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: p.strava_refresh_token,
    }),
  });

  const refreshBody = await res.text();
  if (!res.ok) {
    console.warn("[Strava] Token refresh failed:", res.status, refreshBody.slice(0, 200));
    return null;
  }

  let data: { access_token: string; refresh_token?: string; expires_at: number };
  try {
    data = JSON.parse(refreshBody) as typeof data;
  } catch {
    console.warn("[Strava] Token refresh response not JSON");
    return null;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      strava_access_token: data.access_token,
      strava_refresh_token: data.refresh_token ?? p.strava_refresh_token,
      strava_token_expiry: data.expires_at,
    })
    .eq("id", userId);

  if (updateError) {
    console.warn("[Strava] Token refreshed but Supabase update failed:", updateError.message, "| Neuer Token wird trotzdem genutzt.");
    return data.access_token;
  }
  console.log("[Strava] Token refreshed and saved to Supabase, new strava_token_expiry:", data.expires_at);
  return data.access_token;
}

/** Lädt Aktivitäten (ohne Zeitfilter für Test, per_page=10). Token wird bei Bedarf erneuert. */
export async function getStravaActivities(
  supabase: SupabaseClient,
  userId: string
): Promise<StravaActivity[]> {
  const accessToken = await getValidStravaAccessToken(supabase, userId);
  console.log("[Strava] Strava token loaded:", accessToken ? "ja" : "nein");
  if (!accessToken) return [];

  const url = `${STRAVA_ACTIVITIES_URL}?per_page=10`;
  console.log("[Strava] Strava API URL:", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const bodyText = await res.text();
  console.log("[Strava] Strava API response status:", res.status);
  console.log("[Strava] Strava API response body (full):", bodyText);

  if (!res.ok) {
    console.warn("[Strava] Activities fetch failed:", res.status, res.status === 401 ? "(401 = Token abgelaufen oder ungültig)" : "");
    return [];
  }

  let raw: StravaActivity[];
  try {
    raw = JSON.parse(bodyText) as StravaActivity[];
  } catch {
    console.warn("[Strava] Activities response not JSON");
    return [];
  }
  const list = Array.isArray(raw) ? raw : [];
  console.log("[Strava] Strava activities count:", list.length);
  if (list.length === 0) {
    console.log("[Strava] Activities array is empty");
  }
  return list;
}
