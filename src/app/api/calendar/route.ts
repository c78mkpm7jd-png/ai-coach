import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase Umgebungsvariablen fehlen");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** GET: Liste der Kalender-Einträge (z. B. für einen Monat) */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    let query = supabaseAdmin
      .from("calendar_events")
      .select("date, type")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (year != null && month != null) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
        const start = `${y}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        query = query.gte("date", start).lte("date", end);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("API calendar GET:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("API calendar GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

/** POST: Eintrag setzen (ein Tag oder wiederkehrend) – schreibt nur in calendar_events */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await request.json();
    const { date, type, recurringWeekday } = body as {
      date: string;
      type: "training" | "ruhetag";
      recurringWeekday?: number;
    };

    if (!date || (type !== "training" && type !== "ruhetag")) {
      return NextResponse.json(
        { error: "date (YYYY-MM-DD) und type (training|ruhetag) erforderlich" },
        { status: 400 }
      );
    }

    const toUpsert: { date: string; type: "training" | "ruhetag" }[] = [];

    if (recurringWeekday != null && recurringWeekday >= 0 && recurringWeekday <= 6) {
      const [y, m, d] = date.split("-").map(Number);
      let current = new Date(Date.UTC(y, m - 1, d));
      const currentWeekday = (current.getUTCDay() + 6) % 7;
      let daysToAdd = (recurringWeekday - currentWeekday + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7;
      current.setUTCDate(current.getUTCDate() + daysToAdd);
      for (let i = 0; i < 4; i++) {
        toUpsert.push({
          date: current.toISOString().slice(0, 10),
          type,
        });
        current.setUTCDate(current.getUTCDate() + 7);
      }
    } else {
      toUpsert.push({ date: date.slice(0, 10), type });
    }

    for (const { date: d } of toUpsert) {
      const { error: upsertError } = await supabaseAdmin
        .from("calendar_events")
        .upsert(
          { user_id: userId, date: d, type },
          { onConflict: "user_id,date" }
        );

      if (upsertError) {
        console.error("API calendar POST:", upsertError);
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, count: toUpsert.length }, { status: 200 });
  } catch (err) {
    console.error("API calendar POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

/** DELETE: Eintrag für ein Datum löschen */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    if (!dateStr) {
      return NextResponse.json(
        { error: "Query-Parameter date (YYYY-MM-DD) erforderlich" },
        { status: 400 }
      );
    }

    const dateOnly = dateStr.slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("date", dateOnly)
      .select("id");

    if (error) {
      console.error("API calendar DELETE:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 }, { status: 200 });
  } catch (err) {
    console.error("API calendar DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
