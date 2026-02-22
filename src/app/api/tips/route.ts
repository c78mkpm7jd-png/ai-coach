import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!openaiKey) return NextResponse.json({ error: "OPENAI nicht konfiguriert" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "calories" | "makros" | null;
    if (!type || (type !== "calories" && type !== "makros")) {
      return NextResponse.json({ error: "type=calories oder type=makros erforderlich" }, { status: 400 });
    }

    const { data: checkins } = await supabaseAdmin
      .from("daily_checkins")
      .select("created_at, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(7);

    const rows = (checkins ?? []).slice().reverse();
    const summary = rows
      .map(
        (c: { created_at: string; activity_calories_burned?: number | null; calories_intake?: number | null; protein_intake?: number | null; carbs_intake?: number | null; fat_intake?: number | null }) =>
          `${c.created_at.slice(0, 10)}: Verbrauch ${c.activity_calories_burned ?? "–"} kcal, Aufnahme ${c.calories_intake ?? "–"} kcal, P ${c.protein_intake ?? "–"} g, C ${c.carbs_intake ?? "–"} g, F ${c.fat_intake ?? "–"} g`
      )
      .join("\n");

    const openai = new OpenAI({ apiKey: openaiKey });
    const prompt =
      type === "calories"
        ? `Basierend auf diesen Kaloriendaten (Verbrauch vs. Aufnahme) gib einen kurzen, konkreten Tipp in 1 Satz auf Deutsch. Nur der Satz, keine Anführungszeichen.\n\n${summary}`
        : `Basierend auf diesen Makrodaten (Protein, Carbs, Fett in g) gib einen kurzen, konkreten Tipp in 1 Satz auf Deutsch. Nur der Satz, keine Anführungszeichen.\n\n${summary}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
      temperature: 0.5,
    });
    const tip = completion.choices[0]?.message?.content?.trim() ?? "Kein Tipp verfügbar.";

    return NextResponse.json({ tip }, { status: 200 });
  } catch (err) {
    console.error("tips API:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
