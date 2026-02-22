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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // userId von auth
    const error = searchParams.get("error");

    if (error) {
      console.warn("Strava OAuth error:", error);
      return NextResponse.redirect(new URL("/einstellungen?strava=denied", request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/einstellungen?strava=error", request.url));
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/einstellungen?strava=config", request.url));
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL?.startsWith("http")
        ? process.env.VERCEL_URL
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : request.nextUrl.origin);
    const redirectUri = `${baseUrl}/api/strava/callback`;

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

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.warn("Strava token exchange failed:", tokenRes.status, text);
      return NextResponse.redirect(new URL("/einstellungen?strava=error", request.url));
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };

    const userId = state;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          strava_access_token: data.access_token,
          strava_refresh_token: data.refresh_token,
          strava_token_expiry: data.expires_at,
          strava_connected: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (updateError) {
      console.error("Strava profile update:", updateError);
      return NextResponse.redirect(new URL("/einstellungen?strava=error", request.url));
    }

    return NextResponse.redirect(new URL("/einstellungen?strava=connected", request.url));
  } catch (err) {
    console.error("Strava callback:", err);
    return NextResponse.redirect(new URL("/einstellungen?strava=error", request.url));
  }
}
