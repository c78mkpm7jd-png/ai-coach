"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import MessageChart, { type ChartPayload } from "@/components/chat/MessageChart";
import { useSidebar } from "@/components/layout/SidebarContext";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  chart?: ChartPayload;
};

export default function ChatPage() {
  const { setMobileOpen } = useSidebar();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allowedTypes = "image/jpeg,image/png,image/jpg,application/pdf";
  const maxFileSizeMb = 10;
  const maxFileSize = maxFileSizeMb * 1024 * 1024;

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
  }, [messages]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxFileSize) {
      alert(`Datei maximal ${maxFileSizeMb} MB`);
      e.target.value = "";
      return;
    }
    setAttachedFile(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !attachedFile) || loading) return;

    const displayContent = text || (attachedFile ? `[Datei: ${attachedFile.name}]` : "");
    setInput("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      let res: Response;
      if (attachedFile) {
        const formData = new FormData();
        formData.set("content", text);
        formData.set("file", attachedFile);
        res = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
      }
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fehler beim Senden");
      }

      if (data.message) {
        console.log("[Chat] API Response:", { fullResponse: data, message: data.message, hasChart: !!data.message.chart, chartData: data.message.chart });
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
          console.log("[Chat] Chart attached:", msg.chart.type, "data points:", msg.chart.data.length);
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

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 md:h-screen">
      {/* Header wie andere Seiten: Hamburger (Mobile) + Titel, immer sichtbar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Menü öffnen"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">Coach</p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-white">Dein AI Fitness Coach</h1>
        </div>
      </header>

      {/* Chatverlauf: verkleinert sich bei Tastatur (100dvh), nicht verschieben */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4"
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
            <p className="mt-1 text-xs text-white/40">
              Er kennt dein Profil, Makros und die letzten Check-ins.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm min-w-[200px] ${
                      isUser
                        ? "bg-white text-zinc-950 rounded-br-md"
                        : "bg-white/10 text-white border border-white/10 rounded-bl-md"
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
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white/70">
                  …
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Eingabefeld unten fixiert: position fixed, safe-area, 16px Schrift (iOS kein Auto-Zoom) */}
      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-zinc-950 p-3 md:static md:z-auto md:shrink-0"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white/80">
            <span className="truncate flex-1">{attachedFile.name}</span>
            <button
              type="button"
              onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="shrink-0 rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Datei entfernen"
            >
              Entfernen
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedTypes}
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="shrink-0 rounded-xl border border-white/15 bg-zinc-900 p-2.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Bild oder PDF anhängen (JPG, PNG, PDF)"
            title="Bild oder PDF anhängen"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nachricht oder Trainingsplan …"
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-zinc-900 px-4 py-2.5 text-base text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60 md:text-sm"
            style={{ fontSize: "16px" }}
          />
          <button
            type="submit"
            disabled={(!input.trim() && !attachedFile) || loading}
            className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Senden
          </button>
        </div>
        <p className="mt-1.5 text-xs text-white/40">JPG, PNG oder PDF (max. {maxFileSizeMb} MB) für Trainingsplan-Analyse</p>
      </form>
    </div>
  );
}
