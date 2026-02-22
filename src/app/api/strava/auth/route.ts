import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const SCOPE = "activity:read_all";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Strava ist nicht konfiguriert (STRAVA_CLIENT_ID fehlt)" },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL?.startsWith("http")
        ? process.env.VERCEL_URL
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/strava/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPE,
      approval_prompt: "force",
      state: userId,
    });

    const url = `${STRAVA_AUTH_URL}?${params.toString()}`;
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("Strava auth:", err);
    return NextResponse.json(
      { error: "Fehler beim Weiterleiten zu Strava" },
      { status: 500 }
    );
  }
}
