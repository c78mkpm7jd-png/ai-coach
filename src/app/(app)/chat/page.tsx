"use client";

import { useState, useEffect, useRef, FormEvent, useCallback } from "react";
import MessageChart, { type ChartPayload } from "@/components/chat/MessageChart";
import { useSidebar } from "@/components/layout/SidebarContext";

function isImage(file: File) {
  return file.type.startsWith("image/");
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  chart?: ChartPayload;
  /** Blob-URLs für gesendete Bilder (nur aktuelle Session) */
  attachedImageUrls?: string[];
};

type AttachedItem = { file: File; previewUrl: string | null };

export default function ChatPage() {
  const { setMobileOpen } = useSidebar();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [attachedList, setAttachedList] = useState<AttachedItem[]>([]);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxTouchStart = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allowedTypes = "image/*,application/pdf";
  const isLightboxOpen = lightboxImages.length > 0;
  const lightboxCurrent = lightboxImages[lightboxIndex] ?? null;

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImages([]);
      if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex((i) => i - 1);
      if (e.key === "ArrowRight" && lightboxIndex < lightboxImages.length - 1) setLightboxIndex((i) => i + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLightboxOpen, lightboxIndex, lightboxImages.length]);
  const maxFileSizeMb = 10;
  const maxFileSize = maxFileSizeMb * 1024 * 1024;

  useEffect(() => {
    const loadChatAndCheckin = async () => {
      try {
        const [chatRes, checkinRes] = await Promise.all([
          fetch("/api/chat"),
          fetch("/api/checkin-chat"),
        ]);
        const chatData = chatRes.ok ? await chatRes.json() : {};
        const checkinData = checkinRes.ok ? await checkinRes.json() : {};
        const history: ChatMessage[] = chatData.messages ?? [];
        const suggestedMessage: string | null = checkinData.suggestedMessage ?? null;

        if (suggestedMessage?.trim()) {
          const checkinPrompt: ChatMessage = {
            id: "checkin-prompt",
            role: "assistant",
            content: suggestedMessage.trim(),
            created_at: new Date().toISOString(),
          };
          setMessages([checkinPrompt, ...history]);
        } else {
          setMessages(history);
        }
      } catch {
        // Fallback: nur Chat-Historie versuchen
        try {
          const res = await fetch("/api/chat");
          const data = await res.json();
          if (data.messages) setMessages(data.messages);
        } catch {
          // leer lassen
        }
      } finally {
        setLoadingHistory(false);
      }
    };
    loadChatAndCheckin();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const removeAttached = useCallback((index: number) => {
    setAttachedList((prev) => {
      const next = [...prev];
      const item = next.splice(index, 1)[0];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return next;
    });
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const newItems: AttachedItem[] = files
      .filter((file) => {
        if (file.size > maxFileSize) {
          alert(`"${file.name}" ist zu groß. Max. ${maxFileSizeMb} MB.`);
          return false;
        }
        return true;
      })
      .map((file) => ({
        file,
        previewUrl: isImage(file) ? URL.createObjectURL(file) : null,
      }));
    setAttachedList((prev) => [...prev, ...newItems]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    const hasFiles = attachedList.length > 0;
    if ((!text && !hasFiles) || loading) return;

    const filesToSend = [...attachedList];
    const imageUrls = filesToSend.filter((i) => i.previewUrl).map((i) => i.previewUrl!);
    const displayContent = text || (hasFiles ? `[${filesToSend.length} Datei${filesToSend.length > 1 ? "en" : ""}]` : "");
    setInput("");
    setAttachedList([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: displayContent,
      created_at: new Date().toISOString(),
      attachedImageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      let res: Response;
      if (hasFiles) {
        const formData = new FormData();
        formData.set("content", text);
        filesToSend.forEach(({ file }) => formData.append("file", file));
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
                    {isUser && m.attachedImageUrls && m.attachedImageUrls.length > 0 && (
                      <div className="mb-2 grid max-w-[208px] grid-cols-2 gap-1 sm:max-w-[408px]">
                        {m.attachedImageUrls.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setLightboxImages(m.attachedImageUrls!);
                              setLightboxIndex(i);
                            }}
                            className="aspect-square max-h-[200px] max-w-[200px] overflow-hidden rounded-[12px] border border-zinc-200 object-cover focus:outline-none focus:ring-2 focus:ring-zinc-400"
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    {m.content ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : null}
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
        {attachedList.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedList.map((item, index) => (
              <div key={index} className="relative">
                {item.previewUrl ? (
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-[12px] border border-white/20 bg-zinc-900">
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[12px] border border-white/20 bg-zinc-900 px-1.5 text-center text-[10px] text-white/70">
                    PDF
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttached(index)}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-white shadow hover:bg-red-500"
                  aria-label="Entfernen"
                >
                  <span className="sr-only">Entfernen</span>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedTypes}
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="shrink-0 rounded-xl border border-white/15 bg-zinc-900 p-2.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Bilder oder PDF anhängen (JPG, PNG, PDF)"
            title="Bilder oder PDF anhängen"
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
            disabled={(!input.trim() && attachedList.length === 0) || loading}
            className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Senden
          </button>
        </div>
        <p className="mt-1.5 text-xs text-white/40">Mehrere JPG/PNG oder PDF (max. {maxFileSizeMb} MB)</p>
      </form>

      {/* Lightbox: dunkler Hintergrund, X schließen, Swipe zwischen Bildern */}
      {isLightboxOpen && lightboxCurrent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={() => setLightboxImages([])}
          role="dialog"
          aria-modal="true"
          aria-label="Bild vergrößert"
        >
          <button
            type="button"
            onClick={() => setLightboxImages([])}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Schließen"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="relative flex max-h-[90vh] max-w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              lightboxTouchStart.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const start = lightboxTouchStart.current;
              if (start == null) return;
              const end = e.changedTouches[0].clientX;
              const delta = start - end;
              const threshold = 50;
              if (delta > threshold && lightboxIndex < lightboxImages.length - 1) {
                setLightboxIndex((i) => i + 1);
              } else if (delta < -threshold && lightboxIndex > 0) {
                setLightboxIndex((i) => i - 1);
              }
              lightboxTouchStart.current = null;
            }}
          >
            <img
              key={lightboxIndex}
              src={lightboxCurrent}
              alt=""
              className="max-h-[90vh] max-w-full rounded-[12px] object-contain"
            />
            {lightboxImages.length > 1 && (
              <>
                {lightboxIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((i) => i - 1)}
                    className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 md:left-4"
                    aria-label="Vorheriges Bild"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {lightboxIndex < lightboxImages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((i) => i + 1)}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 md:right-4"
                    aria-label="Nächstes Bild"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white/90">
                  {lightboxIndex + 1} / {lightboxImages.length}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
