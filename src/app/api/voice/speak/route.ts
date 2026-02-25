import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const openaiKey = process.env.OPENAI_API_KEY;

if (!openaiKey) {
  throw new Error("OPENAI_API_KEY ist nicht gesetzt");
}

const openai = new OpenAI({ apiKey: openaiKey });

const VOICES = ["onyx", "nova", "alloy", "echo", "fable", "shimmer"] as const;
type Voice = (typeof VOICES)[number];

function normalizeVoice(v: unknown): Voice {
  if (typeof v === "string" && VOICES.includes(v as Voice)) return v as Voice;
  return "onyx";
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "text ist erforderlich" },
        { status: 400 }
      );
    }

    const voice = normalizeVoice(body.voice ?? body.coach_voice ?? "onyx");

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("❌ Voice speak:", err);
    return NextResponse.json(
      {
        error: "Sprachausgabe fehlgeschlagen",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
