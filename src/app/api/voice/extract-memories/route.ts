import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openaiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!openaiKey || !supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("OPENAI_API_KEY oder Supabase fehlt");
}

const openai = new OpenAI({ apiKey: openaiKey });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const turns = Array.isArray(body.turns) ? body.turns : [];
    if (turns.length === 0) {
      return NextResponse.json({ success: true, count: 0 }, { status: 200 });
    }

    const conversation = turns
      .map((t: { role?: string; content?: string }) => {
        const role = t.role === "user" ? "Nutzer" : "Coach";
        return `${role}: ${typeof t.content === "string" ? t.content.trim() : ""}`;
      })
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du extrahierst aus einer Voice-Coach-Konversation wichtige Infos für das Coach-Gedächtnis.
Antworte NUR mit JSON: { "items": [ { "memory": string, "category": string } ] }
Kategorien: "gesundheit", "training", "ernaehrung", "stimmung", "ziel", "sonstiges"
Pro Item: ein kurzer, prägnanter Satz auf Deutsch (max. 200 Zeichen). Maximal 10 Items. Nur Fakten/Aussagen, keine Ratschläge.`,
        },
        {
          role: "user",
          content: `Konversation:\n\n${conversation}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ success: true, count: 0 }, { status: 200 });
    }

    const parsed = JSON.parse(raw) as { items?: { memory?: string; category?: string }[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    let count = 0;
    for (const item of items) {
      const memory = typeof item.memory === "string" ? item.memory.trim() : "";
      const category = typeof item.category === "string" ? item.category.trim() : "sonstiges";
      if (memory.length > 0 && memory.length <= 500) {
        await supabaseAdmin.from("coach_memories").insert({
          user_id: userId,
          memory,
          category,
        });
        count++;
      }
    }

    return NextResponse.json({ success: true, count }, { status: 200 });
  } catch (err) {
    console.error("❌ Voice extract-memories:", err);
    return NextResponse.json(
      {
        error: "Memories konnten nicht extrahiert werden",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
