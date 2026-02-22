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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await request.json();
    const { date, trained, recurringWeekday } = body as {
      date: string;
      trained: boolean;
      recurringWeekday?: number;
    };

    if (!date || typeof trained !== "boolean") {
      return NextResponse.json(
        { error: "date (YYYY-MM-DD) und trained (boolean) erforderlich" },
        { status: 400 }
      );
    }

    const [profileRes, lastCheckinRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("weight").eq("id", userId).single(),
      supabaseAdmin
        .from("daily_checkins")
        .select("weight_kg")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    const weight =
      Number((lastCheckinRes.data as { weight_kg?: number } | null)?.weight_kg) ||
      Number((profileRes.data as { weight?: number } | null)?.weight) ||
      70;

    const toInsert: { date: string; trained: boolean }[] = [];
    if (recurringWeekday != null && recurringWeekday >= 0 && recurringWeekday <= 6) {
      const [y, m, d] = date.split("-").map(Number);
      let current = new Date(Date.UTC(y, m - 1, d));
      const currentWeekday = (current.getUTCDay() + 6) % 7;
      let daysToAdd = (recurringWeekday - currentWeekday + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7;
      current.setUTCDate(current.getUTCDate() + daysToAdd);
      for (let i = 0; i < 4; i++) {
        toInsert.push({
          date: current.toISOString().slice(0, 10),
          trained,
        });
        current.setUTCDate(current.getUTCDate() + 7);
      }
    } else {
      toInsert.push({ date: date.slice(0, 10), trained });
    }

    const results: unknown[] = [];
    for (const { date: d } of toInsert) {
      const created_at = `${d}T12:00:00.000Z`;
      const { data, error } = await supabaseAdmin
        .from("daily_checkins")
        .insert({
          user_id: userId,
          weight_kg: weight,
          hunger_level: 3,
          energy_level: 3,
          trained,
          activity_type: trained ? "krafttraining" : "ruhetag",
          activity_duration_min: null,
          activity_calories_burned: null,
          calories_intake: null,
          protein_intake: null,
          carbs_intake: null,
          fat_intake: null,
          created_at,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") continue;
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      results.push(data);
    }

    return NextResponse.json({ success: true, created: results.length }, { status: 200 });
  } catch (err) {
    console.error("checkin/quick:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
