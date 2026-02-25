import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import pdfParse from "pdf-parse-fork";
import {
  getCoachContext,
  analyzeSignals,
  buildChatCoachContextBlock,
  getCoachMemories,
  getStravaSummaryForCoach,
  estimateTdee,
  getMacrosSimple,
  getTargetRangeFromProfile,
  type CheckinRow as CoachCheckinRow,
} from "@/lib/coach";
import {
  saveCheckinPartial,
  getTodayCheckin,
  isCheckinComplete,
  getMissingFields,
  type CheckinRow as PartialCheckinRow,
} from "@/lib/checkin-partial";

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
  first_name?: string | null;
  strava_connected?: boolean | null;
  calorie_target_min?: number | null;
  calorie_target_max?: number | null;
  protein_target_min?: number | null;
  protein_target_max?: number | null;
  carbs_target_min?: number | null;
  carbs_target_max?: number | null;
  fat_target_min?: number | null;
  fat_target_max?: number | null;
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
      .select("id, role, content, created_at, voice_duration_sec")
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
      ...(m.voice_duration_sec != null && { voiceDurationSec: m.voice_duration_sec }),
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

    const contentType = request.headers.get("content-type") ?? "";
    let content = "";
    let attachedPdfText: string | null = null;
    const attachedImages: { base64: string; mime: string }[] = [];
    let contentForDb = "";
    let voiceDurationSec: number | null = null;
    let noPersist = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const textPart = formData.get("content");
      content = typeof textPart === "string" ? textPart.trim() : "";

      // Sprachnachricht: nur für Coach-Kontext transkribieren, im Chat als Audio-Bubble anzeigen
      const voiceFile = formData.get("voice");
      if (voiceFile instanceof File && voiceFile.size > 0 && voiceFile.type.startsWith("audio/")) {
        const openai = new OpenAI({ apiKey: openaiKey });
        const transcription = await openai.audio.transcriptions.create({
          file: voiceFile,
          model: "whisper-1",
          language: "de",
        });
        content = typeof transcription.text === "string" ? transcription.text.trim() : "";
        contentForDb = content || " [Sprachnachricht]";
        const d = formData.get("voiceDurationSec");
        voiceDurationSec = d != null && d !== "" ? parseInt(String(d), 10) : null;
        if (!content) {
          return NextResponse.json(
            { error: "Keine Sprache in der Sprachnachricht erkannt" },
            { status: 400 }
          );
        }
      }

      const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
      const imageNames: string[] = [];
      const pdfNames: string[] = [];
      for (const file of files) {
        const type = file.type.toLowerCase();
        if (type === "application/pdf") {
          if (!attachedPdfText) {
            const buffer = Buffer.from(await file.arrayBuffer());
            try {
              const pdf = await pdfParse(buffer);
              attachedPdfText = typeof pdf.text === "string" ? pdf.text.trim() : "";
            } catch (e) {
              console.warn("PDF parse failed:", e);
            }
          }
          pdfNames.push(file.name);
        } else if (type.startsWith("image/")) {
          const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
          attachedImages.push({ base64, mime: type });
          imageNames.push(file.name);
        }
      }
      if (content) contentForDb = content;
      if (imageNames.length > 0) contentForDb += (contentForDb ? " " : "") + `[${imageNames.length} Bild${imageNames.length > 1 ? "er" : ""}]`;
      if (pdfNames.length > 0) contentForDb += (contentForDb ? " " : "") + `[PDF: ${pdfNames.join(", ")}]`;
      if (!content && !attachedPdfText && attachedImages.length === 0) {
        return NextResponse.json(
          { error: "Nachricht oder Datei (JPG/PNG/PDF) erforderlich" },
          { status: 400 }
        );
      }
      if (!contentForDb) contentForDb = " [Datei angehängt]";
    } else {
      const body = await request.json();
      content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) {
        return NextResponse.json(
          { error: "Nachricht darf nicht leer sein" },
          { status: 400 }
        );
      }
      contentForDb = content;
      noPersist = body.noPersist === true;
    }

    const contentForExtraction = attachedPdfText
      ? (content ? `${content}\n\n` : "") + `[Trainingsplan]\n${attachedPdfText}`
      : content;
    const contentForCompletionText = attachedPdfText
      ? (content ? `${content}\n\n` : "") + `[Angehängter Trainingsplan]\n${attachedPdfText}`
      : content;

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

    let profile = profileRes.data as ProfileRow | null;
    const checkins = (checkinsRes.data ?? []) as CheckinRow[];
    const existingMessages = (messagesRes.data ?? []) as { role: string; content: string }[];

    // Bestehende Nutzer: Kalorien-/Protein-/Carbs-/Fett-Ziel still setzen, wenn noch nicht vorhanden
    if (
      profile &&
      (profile.calorie_target_min == null || profile.calorie_target_max == null) &&
      profile.weight != null &&
      profile.height != null &&
      profile.age != null &&
      profile.goal != null
    ) {
      const range = getTargetRangeFromProfile({
        weightKg: Number(profile.weight),
        heightCm: Number(profile.height),
        age: Number(profile.age),
        isFemale: String(profile.gender) === "w",
        activityLevel: String(profile.activity_level ?? "sitzend"),
        goal: String(profile.goal),
      });
      await supabaseAdmin
        .from("profiles")
        .update({
          calorie_target_min: range.calorie_target_min,
          calorie_target_max: range.calorie_target_max,
          protein_target_min: range.protein_target_min,
          protein_target_max: range.protein_target_max,
          carbs_target_min: range.carbs_target_min,
          carbs_target_max: range.carbs_target_max,
          fat_target_min: range.fat_target_min,
          fat_target_max: range.fat_target_max,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      profile = { ...profile, ...range };
    }

    const stravaConnected = !!profile?.strava_connected;
    console.log("[Chat] Strava connected:", stravaConnected);

    const openai = new OpenAI({ apiKey: openaiKey });

    // Zuerst Extraktion und Speichern, damit der Coach in derselben Antwort darauf zugreifen kann
    // Bilder: Vision-Extraktion (alle Bilder in einem Aufruf) → coach_memories mit category "trainingsplan"
    if (attachedImages.length > 0) {
      try {
        const visionContent: OpenAI.Chat.ChatCompletionContentPart[] = [
          { type: "text", text: "Extrahiere aus allen Bildern den kompletten Trainingsplan für das Gedächtnis (Übungen, Struktur, Split)." },
          ...attachedImages.map((img) => ({
            type: "image_url" as const,
            image_url: { url: `data:${img.mime};base64,${img.base64}` },
          })),
        ];
        const visionExtract = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Du analysierst Bilder (Trainingspläne, Screenshots, Tabellen). Extrahiere ALLE relevanten Infos für das Coach-Gedächtnis.
Speichere als category "trainingsplan": Übungen, Struktur/Split (z. B. Push/Pull/Legs), trainierte Muskeln, Tage, Wiederholungen/Sätze – alles aus den Plänen.
Nur wenn explizit Geräte/Ausstattung erwähnt sind: category "gym_ausstattung".
Antworte NUR mit JSON: { "items": [ { "memory": string, "category": string } ] }. Kategorien: "trainingsplan", "gym_ausstattung". Deutsch, knapp. Maximal 25 Einträge.`,
            },
            { role: "user", content: visionContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });
        const raw = visionExtract.choices[0]?.message?.content?.trim();
        if (raw) {
          const parsed = JSON.parse(raw) as { items?: { memory?: string; category?: string }[] };
          const items = Array.isArray(parsed.items) ? parsed.items : [];
          for (const item of items) {
            const memory = typeof item.memory === "string" ? item.memory.trim() : "";
            const category = (typeof item.category === "string" ? item.category.trim() : null) || "trainingsplan";
            if (memory.length > 0 && memory.length <= 500) {
              await supabaseAdmin.from("coach_memories").insert({
                user_id: userId,
                memory,
                category,
              });
            }
          }
        }
      } catch (e) {
        console.warn("Vision memory extraction failed:", e);
      }
    }

    // Text/PDF: Extraktion inkl. Trainingsplan-Infos → coach_memories (sofort speichern)
    if (contentForExtraction) {
      try {
        const maxItems = attachedPdfText ? 20 : 8;
        const extractRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Du extrahierst aus der Nutzer-Nachricht (und ggf. angehängtem Trainingsplan) wichtige Infos für das Coach-Gedächtnis. Antworte NUR mit JSON: { "items": [ { "memory": string, "category": string } ] }.
Kategorien: "persönlich", "gewohnheit", "vorliebe", "ziel", "gym_ausstattung", "trainingsplan" (alles was der Nutzer über seinen Plan sagt: Übungen, Split, Tage, Struktur – sofort speichern, nicht nachfragen).
Jede Erwähnung von Plan/Übungen/Split als "trainingsplan" speichern. Maximal ${maxItems} Items. Deutsch, knapp.`,
            },
            { role: "user", content: contentForExtraction },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });
        const rawExtract = extractRes.choices[0]?.message?.content?.trim();
        if (rawExtract) {
          const parsed = JSON.parse(rawExtract) as { items?: { memory?: string; category?: string }[] };
          const items = Array.isArray(parsed.items) ? parsed.items : [];
          for (const item of items) {
            const memory = typeof item.memory === "string" ? item.memory.trim() : "";
            const category = typeof item.category === "string" ? item.category.trim() || null : null;
            if (memory.length > 0 && memory.length <= 500) {
              await supabaseAdmin.from("coach_memories").insert({
                user_id: userId,
                memory,
                category: category || null,
              });
            }
          }
        }
      } catch (e) {
        console.warn("Coach memory extraction failed:", e);
      }
    }

    // Check-in-Extraktion: aus Nutzer-Nachricht Gewicht, Makros, Energie/Hunger (1–5) erkennen und speichern
    let checkinConfirmationBlock = "";
    if (content && typeof content === "string" && content.trim().length > 0) {
      try {
        const extractCheckin = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Extrahiere aus der Nutzer-Nachricht nur explizit genannte Check-in-Daten. Antworte NUR mit JSON.
Felder (nur setzen wenn klar erkennbar): weight_kg (Zahl, kg), calories_intake (Zahl, kcal), protein_intake (Zahl, g), carbs_intake (Zahl, g), fat_intake (Zahl, g), energy_level (1–5, Integer), hunger_level (1–5, Integer).
Beispiele: "83,2 kg" → weight_kg: 83.2. "Energie 4" / "4 von 5 Energie" → energy_level: 4. "2800 kcal" → calories_intake: 2800. "150g Protein" → protein_intake: 150.
Nur Werte die der Nutzer wirklich nennt. Fehlende Felder weglassen.`,
            },
            { role: "user", content: content.trim() },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        });
        const rawCheckin = extractCheckin.choices[0]?.message?.content?.trim();
        if (rawCheckin) {
          const parsed = JSON.parse(rawCheckin) as Record<string, unknown>;
          const hasAny =
            (parsed.weight_kg != null && parsed.weight_kg !== "") ||
            (parsed.calories_intake != null && parsed.calories_intake !== "") ||
            (parsed.protein_intake != null && parsed.protein_intake !== "") ||
            (parsed.carbs_intake != null && parsed.carbs_intake !== "") ||
            (parsed.fat_intake != null && parsed.fat_intake !== "") ||
            (parsed.energy_level != null && parsed.energy_level !== "") ||
            (parsed.hunger_level != null && parsed.hunger_level !== "");
          if (hasAny) {
            await saveCheckinPartial(supabaseAdmin, userId, parsed);
            const todayCheckin = await getTodayCheckin(supabaseAdmin, userId) as PartialCheckinRow | null;
            const complete = isCheckinComplete(todayCheckin);
            const missing = todayCheckin ? getMissingFields(todayCheckin) : ["weight_kg", "hunger_level", "energy_level", "trained", "nutrition"];
            const savedParts: string[] = [];
            if (parsed.weight_kg != null && parsed.weight_kg !== "") savedParts.push(`${parsed.weight_kg} kg`);
            if (parsed.calories_intake != null && parsed.calories_intake !== "") savedParts.push(`${parsed.calories_intake} kcal`);
            if (parsed.protein_intake != null && parsed.protein_intake !== "") savedParts.push(`P ${parsed.protein_intake} g`);
            if (parsed.carbs_intake != null && parsed.carbs_intake !== "") savedParts.push(`C ${parsed.carbs_intake} g`);
            if (parsed.fat_intake != null && parsed.fat_intake !== "") savedParts.push(`F ${parsed.fat_intake} g`);
            if (parsed.energy_level != null && parsed.energy_level !== "") savedParts.push(`Energie ${parsed.energy_level}/5`);
            if (parsed.hunger_level != null && parsed.hunger_level !== "") savedParts.push(`Hunger ${parsed.hunger_level}/5`);
            const savedStr = savedParts.length ? savedParts.join(", ") : "–";
            const missingLabels: string[] = [];
            if (missing.includes("weight_kg")) missingLabels.push("Gewicht");
            if (missing.includes("hunger_level") || missing.includes("energy_level")) missingLabels.push("Energie & Hunger (1–5)");
            if (missing.includes("trained")) missingLabels.push("Training heute (Ja/Nein)");
            if (missing.some((f) => ["calories_intake", "protein_intake", "carbs_intake", "fat_intake"].includes(f))) missingLabels.push("Kalorien/Makros (falls bekannt)");
            const missingStr = missingLabels.length ? missingLabels.join(", ") : "–";
            checkinConfirmationBlock = `

## Check-in-Bestätigung (wichtig)
Der Nutzer hat gerade Check-in-Daten geschickt. Du hast sie bereits gespeichert.
- **Notiert:** ${savedStr}
- **Noch offen:** ${missingStr}

Antworte zuerst freundlich mit einer kurzen Bestätigung (z. B. "Super, ich hab notiert: ${savedStr}."). Ton: WhatsApp, kein Verhör, Lob wenn möglich.
${complete
  ? `Der Check-in ist jetzt vollständig. Sage: "Perfekt – dein Check-in ist vollständig! Hier deine Zusammenfassung: [kurz die Daten]. Falls du was anpassen möchtest, kannst du den Check-in jederzeit öffnen 👉"`
  : `Falls noch Felder offen sind, frage nur kurz danach (${missingStr}). Ein Satz reicht. "Kein Stress, falls du was nicht weißt."`}`;
          }
        }
      } catch (e) {
        console.warn("Check-in extraction/save failed:", e);
      }
    }

    // Memories neu laden (inkl. gerade gespeicherte), damit Coach in derselben Antwort darauf eingehen kann
    const coachMemories = await getCoachMemories(supabaseAdmin, userId, 20);

    const weight = Number(profile?.weight) ?? 70;
    const height = Number(profile?.height) ?? 175;
    const age = Number(profile?.age) ?? 30;
    const gender = String(profile?.gender ?? "m");
    const activityLevel = String(profile?.activity_level ?? "sitzend");
    const checkinsWithBurn = checkins as { activity_calories_burned?: number | null }[];
    const latestBurn = checkinsWithBurn.find(
      (c) => typeof c.activity_calories_burned === "number" && c.activity_calories_burned > 0
    );
    const caloriesBurned =
      latestBurn != null
        ? Math.round(Number(latestBurn.activity_calories_burned))
        : estimateTdee(weight, height, age, gender === "w", activityLevel);

    // Kalorien-ZIEL aus Profil (Ess-Ziel), nicht aus Verbrauch (TDEE)
    const rangeForFallback =
      profile?.calorie_target_min != null && profile?.calorie_target_max != null
        ? null
        : profile?.weight != null &&
            profile?.height != null &&
            profile?.age != null &&
            profile?.goal != null
          ? getTargetRangeFromProfile({
              weightKg: Number(profile.weight),
              heightCm: Number(profile.height),
              age: Number(profile.age),
              isFemale: String(profile.gender) === "w",
              activityLevel: String(profile.activity_level ?? "sitzend"),
              goal: String(profile.goal),
            })
          : null;
    const targetCaloriesFromProfile =
      profile?.calorie_target_min != null && profile?.calorie_target_max != null
        ? Math.round((profile.calorie_target_min + profile.calorie_target_max) / 2)
        : rangeForFallback
          ? Math.round((rangeForFallback.calorie_target_min + rangeForFallback.calorie_target_max) / 2)
          : 2000;
    const macros = getMacrosSimple(targetCaloriesFromProfile, weight, String(profile?.goal ?? "maintain"));

    const profileForCoach = {
      goal: profile?.goal,
      weight,
      training_days_per_week: profile?.training_days_per_week,
      first_name: profile?.first_name ?? null,
      calorie_target_min: profile?.calorie_target_min ?? null,
      calorie_target_max: profile?.calorie_target_max ?? null,
      protein_target_min: profile?.protein_target_min ?? null,
      protein_target_max: profile?.protein_target_max ?? null,
      carbs_target_min: profile?.carbs_target_min ?? null,
      carbs_target_max: profile?.carbs_target_max ?? null,
      fat_target_min: profile?.fat_target_min ?? null,
      fat_target_max: profile?.fat_target_max ?? null,
    };
    const coachCtx = getCoachContext(profileForCoach, targetCaloriesFromProfile, macros);
    const coachCheckins = checkins.map((c) => ({ ...c })) as CoachCheckinRow[];
    const coachSignals = analyzeSignals(coachCheckins, coachCtx, { caloriesBurned });

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

    let stravaSummary = "";
    if (stravaConnected) {
      try {
        const stravaResult = await getStravaSummaryForCoach(supabaseAdmin, userId);
        stravaSummary = stravaResult.summary;
        console.log("[Chat] Strava activities loaded:", stravaResult.count, "Aktivitäten");
      } catch (e) {
        console.warn("[Chat] Strava summary for coach failed:", e);
      }
    }

    const coachContextBlock = buildChatCoachContextBlock(
      coachCtx,
      coachSignals,
      checkinsSummary,
      coachMemories,
      stravaSummary
    );

    if (stravaSummary) {
      console.log("[Chat] Strava data inserted into system prompt, length:", stravaSummary.length, "chars");
    }

    const systemPrompt = `Du bist der persönliche AI Fitness Coach. Du arbeitest mit einem klaren Entscheidungs- und Prioritätssystem.

## DUAL-MODE – Intent erkennen

MODE 1 – ANALYSE-MODUS (nutze wenn):
- Nutzer nach Analyse, Auswertung, Check-in, Daten fragt
- Frage bezieht sich auf Gewicht, Kalorien, Makros, Training, Regeneration
- Konkrete Datenfrage erkennbar
→ Volles Prioritätssystem anwenden. Antworte strukturiert: Beobachtung → Interpretation (Zielbezug) → Eine Handlungsempfehlung (messbar). Maximal 2 Prioritäten. Nutze die vorgegebenen Prioritäten aus dem Kontext.

MODE 2 – GESPRÄCHS-MODUS (nutze wenn):
- Smalltalk, emotionale Aussagen, Motivationsfragen
- "Heute bin ich unmotiviert", "Was hältst du von X?", "Kein Bock zu trainieren"
- Offene Fragen ohne Datenbezug
→ Natürlich und menschlich antworten. Empathisch, kurz, respektvoll. Keine erzwungene Analyse. Du darfst Rückfragen stellen, sparsam Humor, klare Meinung. Nie predigend, nie generisch, nie übermotiviert.

Wenn die Nachricht emotional beginnt aber Daten enthält: Zuerst Emotion validieren, dann optional datenbasiert einordnen.

## Regeln
- Sprich den Nutzer mit Namen an, wenn im Kontext angegeben.
- Immer auf Deutsch. Maximal 3–4 Sätze pro Punkt, präzise, kein Fülltext.
- Direkt, respektvoll, konstruktiv. Kein künstliches Lob. Unsicherheit offen kommunizieren wenn Datenlage schwach.
- Beziehe dich auf konkrete Daten: "Letzte Woche hattest du …", "Im Vergleich zu Montag …"
- Ernährung: messbar ("+30g Protein"), konkret ("2 Eier + 250g Skyr"), umsetzbar heute. Keine Floskeln wie "achte auf Ernährung".
- **Gym-Ausstattung:** Wenn im Gedächtnis Ausstattung/Geräte stehen (z. B. "Hat keinen Kabelzug", "Gym hat X"): Empfehle nur Übungen, die mit dieser Ausstattung machbar sind. Erwähne keine Geräte, die der Nutzer nicht hat.
- **Trainingsplan (Bild/PDF/Text):** Bei angehängtem oder beschriebenem Plan: Analysiere Übungen, Muskeln, Struktur (z. B. Push/Pull/Legs) und gib kurze Verbesserungsvorschläge. Wenn du gerade einen Plan verarbeitet hast: Bestätige zuerst "Ich habe deinen Plan gespeichert" und beziehe dich aktiv darauf (z. B. "Laut deinem Plan trainierst du Montag Pull …").
- **Gedächtnis:** Alle Infos im Abschnitt "Gedächtnis" sind bereits gespeichert. Beziehe dich darauf; frage NIEMALS erneut nach Dingen, die dort stehen (z. B. nicht "Welchen Split machst du?" wenn der Split im Gedächtnis steht).
- **Strava Aktivitäten des Nutzers:** Wenn im Kontext-Block unten ein Abschnitt "Strava Aktivitäten des Nutzers" steht: Beziehe dich darauf (Trainingsmuster, Belastung, Fortschritt). z. B. "Laut Strava hast du diese Woche …", "Dein Laufpensum …".
${checkinConfirmationBlock}

${coachContextBlock}

## Antwortformat
Antworte ausschließlich mit einem JSON-Objekt (kein anderer Text):
- "text": string – deine Antwort auf Deutsch (je nach Modus analysierend oder gesprächig)
- "chartType": string | null – Grafik nur wenn sinnvoll oder explizit gewünscht: "weight" | "calories" | "activity" | "energy_hunger" | "pie" | null
- "chartTitle": string | null – optionaler Grafik-Titel`;

    const userMessageContent: OpenAI.Chat.ChatCompletionMessageParam["content"] =
      attachedImages.length > 0
        ? [
            { type: "text", text: contentForCompletionText || "Analysiere bitte den angehängten Trainingsplan: Welche Übungen, welche Muskeln, Struktur (z. B. Push/Pull/Legs), Verbesserungsvorschläge." },
            ...attachedImages.map((img) => ({
              type: "image_url" as const,
              image_url: { url: `data:${img.mime};base64,${img.base64}` },
            })),
          ]
        : contentForCompletionText;

    const messagesForApi: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...existingMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user", content: userMessageContent },
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

    const [insertUser, insertAssistant] = noPersist
      ? [{ data: { id: undefined, created_at: new Date().toISOString() }, error: null }, { data: { id: undefined, created_at: new Date().toISOString() }, error: null }]
      : await Promise.all([
          supabaseAdmin.from("chat_messages").insert({
            user_id: userId,
            role: "user",
            content: contentForDb,
            ...(voiceDurationSec != null && { voice_duration_sec: voiceDurationSec }),
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
