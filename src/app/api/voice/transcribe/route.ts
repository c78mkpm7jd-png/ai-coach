import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const openaiKey = process.env.OPENAI_API_KEY;

if (!openaiKey) {
  throw new Error("OPENAI_API_KEY ist nicht gesetzt");
}

const openai = new OpenAI({ apiKey: openaiKey });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("audio");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Keine Audio-Datei (file oder audio)" },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "de",
    });

    const text = typeof transcription.text === "string" ? transcription.text.trim() : "";
    return NextResponse.json({ text }, { status: 200 });
  } catch (err) {
    console.error("❌ Voice transcribe:", err);
    return NextResponse.json(
      {
        error: "Transkription fehlgeschlagen",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
