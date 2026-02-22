import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase-Umgebungsvariablen fehlen");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** POST: Strava-Verbindung trennen (Tokens löschen). */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        strava_access_token: null,
        strava_refresh_token: null,
        strava_token_expiry: null,
        strava_connected: false,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json(
        { error: "Verbindung konnte nicht getrennt werden" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Strava disconnect:", err);
    return NextResponse.json(
      { error: "Interner Fehler" },
      { status: 500 }
    );
  }
}
