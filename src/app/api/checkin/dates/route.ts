import { NextRequest, NextResponse } from "next/server";
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

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("daily_checkins")
      .select("date, created_at")
      .eq("user_id", userId);

    if (error) throw error;

    const dates = new Set<string>();
    for (const row of data ?? []) {
      const dateVal = row.date ?? null;
      const createdAtVal = row.created_at ?? null;

      if (typeof dateVal === "string" && dateVal.trim().length >= 10) {
        dates.add(dateVal.slice(0, 10));
      } else if (typeof createdAtVal === "string" && createdAtVal.trim().length >= 10) {
        dates.add(createdAtVal.slice(0, 10));
      }
    }

    return NextResponse.json({ dates: Array.from(dates) }, { status: 200 });
  } catch (err) {
    console.error("[checkin/dates] GET:", err);
    return NextResponse.json(
      { error: "Fehler beim Laden der Check-in-Daten" },
      { status: 500 }
    );
  }
}

