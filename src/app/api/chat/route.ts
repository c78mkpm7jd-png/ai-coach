import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase-Umgebungsvariablen fehlen");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACTIVITY_LABELS: Record<string, string> = {
  ruhetag: "Ruhetag",
  krafttraining: "Krafttraining",
  laufen: "Laufen",
  radfahren: "Radfahren",
  schwimmen: "Schwimmen",
  hiit: "HIIT",
  yoga: "Yoga",
};

type ProfileRow = {
  goal?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  activity_level?: string;
  training_days_per_week?: number;
};

type CheckinRow = {
  created_at: string;
  weight_kg: number;
  hunger_level: number;
  energy_level: number;
  trained: boolean;
  activity_type?: string | null;
  activity_duration_min?: number | null;
  activity_calories_burned?: number | null;
  calories_intake?: number | null;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

/** GET: Chat-Verlauf laden */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ API chat GET:", error);
      return NextResponse.json(
        { error: "Fehler beim Laden des Chat-Verlaufs", details: error.message },
        { status: 500 }
      );
    }

    const messages = (data ?? []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      created_at: m.created_at,
    }));

    return NextResponse.json({ messages }, { status: 200 });
  } catch (err) {
    console.error("❌ API chat GET:", err);
    return NextResponse.json(
      {
        error: "Interner Serverfehler",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}

/** POST: Neue Nutzer-Nachricht senden, Coach-Antwort generieren und speichern */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    if (!openaiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY nicht konfiguriert" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json(
        { error: "Nachricht darf nicht leer sein" },
        { status: 400 }
      );
    }

    const [profileRes, checkinsRes, messagesRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).single(),
      supabaseAdmin
        .from("daily_checkins")
        .select(
          "created_at, weight_kg, hunger_level, energy_level, trained, activity_type, activity_duration_min, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(7),
      supabaseAdmin
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    const profile = profileRes.data as ProfileRow | null;
    const checkins = (checkinsRes.data ?? []) as CheckinRow[];
    const existingMessages = (messagesRes.data ?? []) as { role: string; content: string }[];

    const goal = String(profile?.goal ?? "maintain");
    const goalLabel =
      goal === "lean-bulk"
        ? "Lean Bulk (sauber Masse aufbauen)"
        : goal === "cut"
          ? "Cut (Fett reduzieren)"
          : goal === "recomp"
            ? "Recomp"
            : "Maintain";
    const age = Number(profile?.age) ?? 0;
    const gender = String(profile?.gender ?? "m");
    const height = Number(profile?.height) ?? 0;
    const weight = Number(profile?.weight) ?? 0;
    const activityLevel = String(profile?.activity_level ?? "sitzend");
    const trainingDays = Number(profile?.training_days_per_week) ?? 4;

    const checkinsSummary = checkins
      .map((c) => {
        const act =
          c.activity_type && c.activity_type !== "ruhetag"
            ? `, ${ACTIVITY_LABELS[c.activity_type] ?? c.activity_type}${c.activity_duration_min != null ? ` ${c.activity_duration_min} min` : ""}${c.activity_calories_burned != null ? `, ${c.activity_calories_burned} kcal verbr.` : ""}`
            : "";
        const nutrition =
          c.calories_intake != null || c.protein_intake != null
            ? ` | Ernährung: ${c.calories_intake ?? "–"} kcal, P ${c.protein_intake ?? "–"} g, C ${c.carbs_intake ?? "–"} g, F ${c.fat_intake ?? "–"} g`
            : "";
        return `- ${c.created_at.slice(0, 10)}: ${c.weight_kg} kg, Hunger ${c.hunger_level}/5, Energie ${c.energy_level}/5, Training ${c.trained ? "Ja" : "Nein"}${act}${nutrition}`;
      })
      .join("\n");

    const systemPrompt = `Du bist ein Elite-Sportexperte und persönlicher Coach dieses Nutzers. Dein Fachwissen umfasst:
- Sporternährung und Makroberechnung (Kalorien, Protein, Carbs, Fett, Timing)
- Krafttraining und Hypertrophie (Volumen, Frequenz, Progression)
- Ausdauersport und Regeneration (Belastung, Pacing, Erholung)
- Schlaf und Stressmanagement (Erholung, Cortisol, Performance)
- Supplementierung (evidenzbasierte Empfehlungen)

Du kennst die Daten dieses Nutzers und nutzt sie aktiv: jede Antwort bezieht sich auf sein Profil und seine Check-ins. Kein generisches Coaching – immer personalisiert und datenbasiert. Antworte ausschließlich auf Deutsch, präzise und konkret (ca. 2–5 Sätze, bei Bedarf länger).

Wenn es inhaltlich passt oder der Nutzer es wünscht, stelle Daten grafisch dar. Wähle automatisch den passenden Chart-Typ (siehe chartType unten).

Kontext zum Nutzer:
- Ziel: ${goalLabel}
- Alter: ${age}, Geschlecht: ${gender === "m" ? "männlich" : "weiblich"}
- Körper: ${height} cm, ${weight} kg
- Aktivitätslevel: ${activityLevel}, ${trainingDays}x Training pro Woche

Letzte 7 Check-ins (neueste zuerst):
${checkinsSummary || "Noch keine Check-ins."}

Antwortformat: Antworte ausschließlich mit einem JSON-Objekt mit exakt diesen Feldern (kein anderer Text):
- "text": string – deine personalisierte Antwort auf Deutsch
- "chartType": string | null – setze eine Grafik, wenn sinnvoll oder gewünscht; leite den Typ aus der Anfrage ab:
  * "Kreisdiagramm", "Kreis", Pie → "pie" (Makro-Verteilung)
  * "Verlauf", "Entwicklung", "Trend" (Gewicht, Energie/Hunger) → "weight" oder "energy_hunger" (Linie)
  * "Vergleich", "Makros", "Kalorien vergleichen", Balken → "calories" (Balken)
  * Aktivitäten → "activity"
  * Keine Grafik nötig → null
- "chartTitle": string | null – optionaler Titel für die Grafik`;

    const openai = new OpenAI({ apiKey: openaiKey });
    const messagesForApi: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...existingMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user", content },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messagesForApi,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content?.trim();
    if (!rawContent) {
      return NextResponse.json(
        { error: "Keine Antwort vom Coach" },
        { status: 500 }
      );
    }

    let text: string;
    let chartType: string | null = null;
    let chartTitle: string | null = null;
    const allowedChartTypes = ["weight", "calories", "activity", "energy_hunger", "pie"];
    try {
      const parsed = JSON.parse(rawContent) as { text?: string; chartType?: string | null; chartTitle?: string | null };
      text = typeof parsed.text === "string" ? parsed.text : rawContent;
      const rawChartType = parsed.chartType ? String(parsed.chartType).toLowerCase() : null;
      if (rawChartType) {
        if (allowedChartTypes.includes(rawChartType)) {
          chartType = rawChartType;
        } else if (rawChartType === "kreisdiagramm" || rawChartType.includes("pie") || rawChartType === "kreis") {
          chartType = "pie";
        }
        chartTitle = typeof parsed.chartTitle === "string" ? parsed.chartTitle : null;
      }
    } catch {
      text = rawContent;
    }

    type ChartDataWeight = { date: string; weight: number };
    type ChartDataCalories = { date: string; calories: number; protein: number; carbs: number; fat: number };
    type ChartDataActivity = { date: string; label: string; duration: number; calories: number };
    type ChartDataEnergyHunger = { date: string; energy: number; hunger: number };
    type ChartDataPie = { name: string; value: number }[];

    const sortedCheckins = [...checkins].reverse();
    let chartData: ChartDataWeight[] | ChartDataCalories[] | ChartDataActivity[] | ChartDataEnergyHunger[] | ChartDataPie | null = null;
    if (chartType && sortedCheckins.length > 0) {
      if (chartType === "weight") {
        chartData = sortedCheckins.map((c) => ({
          date: c.created_at.slice(0, 10),
          weight: c.weight_kg,
        })) as ChartDataWeight[];
      } else if (chartType === "calories") {
        chartData = sortedCheckins.map((c) => ({
          date: c.created_at.slice(0, 10),
          calories: c.calories_intake ?? 0,
          protein: c.protein_intake ?? 0,
          carbs: c.carbs_intake ?? 0,
          fat: c.fat_intake ?? 0,
        })) as ChartDataCalories[];
      } else if (chartType === "activity") {
        chartData = sortedCheckins.map((c) => ({
          date: c.created_at.slice(0, 10),
          label: c.activity_type && c.activity_type !== "ruhetag" ? (ACTIVITY_LABELS[c.activity_type] ?? c.activity_type) : "Ruhetag",
          duration: c.activity_duration_min ?? 0,
          calories: c.activity_calories_burned ?? 0,
        })) as ChartDataActivity[];
      } else if (chartType === "energy_hunger") {
        chartData = sortedCheckins.map((c) => ({
          date: c.created_at.slice(0, 10),
          energy: c.energy_level,
          hunger: c.hunger_level,
        })) as ChartDataEnergyHunger[];
      } else if (chartType === "pie") {
        const withMacros = sortedCheckins.filter(
          (c) => (c.protein_intake ?? 0) > 0 || (c.carbs_intake ?? 0) > 0 || (c.fat_intake ?? 0) > 0
        );
        if (withMacros.length > 0) {
          const latest = withMacros[0];
          const p = latest.protein_intake ?? 0;
          const c = latest.carbs_intake ?? 0;
          const f = latest.fat_intake ?? 0;
          if (p + c + f > 0) {
            chartData = [
              { name: "Protein", value: p },
              { name: "Carbs", value: c },
              { name: "Fett", value: f },
            ];
          }
        }
        if (!chartData && sortedCheckins.length > 0) {
          const avgP = sortedCheckins.reduce((a, c) => a + (c.protein_intake ?? 0), 0) / sortedCheckins.length;
          const avgC = sortedCheckins.reduce((a, c) => a + (c.carbs_intake ?? 0), 0) / sortedCheckins.length;
          const avgF = sortedCheckins.reduce((a, c) => a + (c.fat_intake ?? 0), 0) / sortedCheckins.length;
          if (avgP + avgC + avgF > 0) {
            chartData = [
              { name: "Protein", value: Math.round(avgP) },
              { name: "Carbs", value: Math.round(avgC) },
              { name: "Fett", value: Math.round(avgF) },
            ];
          }
        }
      }
    }

    const [insertUser, insertAssistant] = await Promise.all([
      supabaseAdmin.from("chat_messages").insert({
        user_id: userId,
        role: "user",
        content,
      }).select("id, created_at").single(),
      supabaseAdmin.from("chat_messages").insert({
        user_id: userId,
        role: "assistant",
        content: text,
      }).select("id, created_at").single(),
    ]);

    if (insertUser.error || insertAssistant.error) {
      console.error("❌ chat_messages insert:", insertUser.error || insertAssistant.error);
    }

    const responseMessage: {
      id: string | undefined;
      role: "assistant";
      content: string;
      created_at: string;
      chart?: { type: string; title: string | null; data: unknown };
    } = {
      id: insertAssistant.data?.id,
      role: "assistant",
      content: text,
      created_at: insertAssistant.data?.created_at ?? new Date().toISOString(),
    };
    if (chartType && chartData && chartData.length > 0) {
      responseMessage.chart = { type: chartType, title: chartTitle, data: chartData };
    }

    return NextResponse.json(
      { message: responseMessage },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ API chat POST:", err);
    return NextResponse.json(
      {
        error: "Coach antwortet gerade nicht",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
