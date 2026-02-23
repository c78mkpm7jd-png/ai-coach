import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase-Umgebungsvariablen fehlen");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function redirectToEinstellungen(origin: string, params: string) {
  const url = `${origin}/einstellungen${params ? `?${params}` : ""}`;
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // userId von auth
    const error = searchParams.get("error");

    console.log("[Strava callback] URL params:", {
      hasCode: !!code,
      codeLength: code?.length ?? 0,
      hasState: !!state,
      state: state ? `${state.slice(0, 8)}...` : null,
      error: error ?? null,
    });

    if (error) {
      console.warn("[Strava callback] OAuth error:", error);
      return redirectToEinstellungen(origin, "strava=denied");
    }

    if (!code || !state) {
      console.warn("[Strava callback] Missing code or state:", { code: !!code, state: !!state });
      return redirectToEinstellungen(origin, "strava=error");
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.warn("[Strava callback] Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
      return redirectToEinstellungen(origin, "strava=config");
    }

    const redirectUri = "https://ai-coach-three-rust.vercel.app/api/strava/callback";

    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenBody = await tokenRes.text();
    if (!tokenRes.ok) {
      console.warn("[Strava callback] Token exchange failed:", {
        status: tokenRes.status,
        body: tokenBody,
      });
      return redirectToEinstellungen(origin, "strava=error");
    }

    let data: { access_token: string; refresh_token: string; expires_at: number };
    try {
      data = JSON.parse(tokenBody) as typeof data;
    } catch (e) {
      console.error("[Strava callback] Token response not JSON:", tokenBody.slice(0, 200));
      return redirectToEinstellungen(origin, "strava=error");
    }

    const userId = state;

    const { data: existingProfile, error: selectError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      console.error("[Strava callback] Profile select failed:", selectError);
      return redirectToEinstellungen(origin, "strava=error");
    }

    if (!existingProfile) {
      console.warn("[Strava callback] No profile found for user:", userId.slice(0, 8) + "...");
      return redirectToEinstellungen(origin, "strava=no_profile");
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        strava_access_token: data.access_token,
        strava_refresh_token: data.refresh_token,
        strava_token_expiry: data.expires_at,
        strava_connected: true,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[Strava callback] Supabase update failed:", {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
      });
      return redirectToEinstellungen(origin, "strava=error");
    }

    console.log("[Strava callback] Success:", { userId: userId.slice(0, 8) + "..." });

    return redirectToEinstellungen(origin, "strava=connected");
  } catch (err) {
    console.error("[Strava callback] Exception:", err);
    return redirectToEinstellungen(origin, "strava=error");
  }
}
