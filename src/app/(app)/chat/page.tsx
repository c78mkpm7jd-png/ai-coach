"use client";

import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from "react";
import MessageChart, { type ChartPayload } from "@/components/chat/MessageChart";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  chart?: ChartPayload;
};

const INPUT_PLACEHOLDER = "Nachricht an deinen Coach …";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fehler beim Senden");
      }

      if (data.message) {
        const msg: ChatMessage = {
          id: data.message.id ?? `msg-${Date.now()}`,
          role: "assistant",
          content: typeof data.message.content === "string" ? data.message.content : "",
          created_at: data.message.created_at ?? new Date().toISOString(),
        };
        const chartObj = data.message.chart;
        if (chartObj && typeof chartObj === "object" && Array.isArray(chartObj.data) && chartObj.data.length > 0) {
          const allowed: Array<ChartPayload["type"]> = ["weight", "calories", "activity", "energy_hunger", "pie"];
          const type = allowed.includes(chartObj.type) ? chartObj.type : "calories";
          msg.chart = {
            type,
            title: chartObj.title ?? null,
            data: chartObj.data,
          } as ChartPayload;
        }
        setMessages((prev) => [...prev, msg]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error ? err.message : "Der Coach konnte nicht antworten. Bitte später erneut versuchen.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function onTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-zinc-950 md:h-[100dvh]">
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">Coach</p>
        <h1 className="text-lg font-semibold tracking-tight text-white">Dein AI Fitness Coach</h1>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-4"
      >
        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <p className="text-sm text-white/50">Lade Chat-Verlauf …</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-white/60">
              Stell deinem Coach Fragen zu Training, Ernährung und Fortschritt.
            </p>
            <p className="mt-1 text-xs text-white/40">Er kennt dein Profil, Makros und die letzten Check-ins.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-2.5 text-sm ${
                      isUser
                        ? "rounded-br-md bg-white text-zinc-950"
                        : "rounded-bl-md border border-white/10 bg-white/10 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    {!isUser && m.chart && <MessageChart chart={m.chart} />}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/10 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-white/10 bg-zinc-950 p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-white/15 bg-zinc-900 pl-3 pr-1 py-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={onTextareaInput}
            onKeyDown={onKeyDown}
            placeholder={INPUT_PLACEHOLDER}
            disabled={loading}
            rows={1}
            className="min-h-[44px] max-h-[120px] w-0 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base text-white placeholder:text-white/40 focus:outline-none disabled:opacity-60"
            style={{ fontSize: "16px" }}
            aria-label={INPUT_PLACEHOLDER}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            aria-label="Senden"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
