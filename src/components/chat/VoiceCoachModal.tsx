"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type Turn = { role: "user" | "assistant"; content: string };

export type VoiceCoachModalProps = {
  open: boolean;
  onClose: () => void;
  coachVoice?: string;
};

export function VoiceCoachModal({ open, onClose, coachVoice = "onyx" }: VoiceCoachModalProps) {
  const [phase, setPhase] = useState<"listening" | "sending" | "coach_speaking">("listening");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    stopTracks();
  }, [stopTracks]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(200);
      setPhase("listening");
    } catch (e) {
      setError("Mikrofon nicht verfügbar");
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (phase !== "listening") return;
    stopRecording();
    if (chunksRef.current.length === 0) {
      setError("Keine Aufnahme. Sprich etwas und klicke dann Senden.");
      startRecording();
      return;
    }
    setPhase("sending");
    setError(null);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      const transcribeRes = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error || "Transkription fehlgeschlagen");
      const text = (transcribeData.text ?? "").trim();
      if (!text) throw new Error("Keine Sprache erkannt.");

      setTurns((prev) => [...prev, { role: "user", content: text }]);

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, noPersist: true }),
      });
      const chatData = await chatRes.json();
      if (!chatRes.ok) throw new Error(chatData.error || "Coach antwortet nicht.");
      const reply = (chatData.message?.content ?? "").trim();
      setTurns((prev) => [...prev, { role: "assistant", content: reply }]);

      setPhase("coach_speaking");
      if (reply) {
        const speakRes = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: reply, voice: coachVoice }),
        });
        if (!speakRes.ok) throw new Error("Sprachausgabe fehlgeschlagen");
        const audioBlob = await speakRes.blob();
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          startRecording();
        };
        await audio.play().catch(() => startRecording());
      } else {
        startRecording();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      startRecording();
    }
  }, [phase, coachVoice, stopRecording, startRecording]);

  const handleClose = useCallback(async () => {
    stopRecording();
    if (turns.length > 0) {
      setExtracting(true);
      try {
        await fetch("/api/voice/extract-memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turns }),
        });
      } catch {
        // non-blocking
      } finally {
        setExtracting(false);
      }
    }
    setTurns([]);
    setError(null);
    setPhase("listening");
    onClose();
  }, [turns, stopRecording, onClose]);

  useEffect(() => {
    if (!open) return;
    startRecording();
    return () => {
      stopRecording();
    };
  }, [open, startRecording, stopRecording]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 pb-[env(safe-area-inset-bottom)] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Voice Coach"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">Voice Coach</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={extracting}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
            aria-label="Schließen und Memories speichern"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {phase === "listening" && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-sm text-white/80">Coach hört zu...</p>
            <span className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-6 w-1 origin-bottom rounded-full bg-blue-400 animate-voice-wave"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </span>
            <button
              type="button"
              onClick={handleSend}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Senden
            </button>
          </div>
        )}

        {phase === "sending" && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-sm text-white/70">Coach denkt nach...</p>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}

        {phase === "coach_speaking" && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-sm text-white/80">Coach spricht...</p>
            <span className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-6 w-1 origin-bottom rounded-full bg-blue-400 animate-voice-wave"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </span>
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {extracting && (
          <p className="mt-4 text-center text-xs text-white/50">Speichere wichtige Infos...</p>
        )}
      </div>
    </div>
  );
}
