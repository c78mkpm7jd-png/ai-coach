"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export type VoiceMemoButtonProps = {
  disabled?: boolean;
  /** Container-Ref für das Vorschau-Panel (wird über dem Eingabefeld gerendert) */
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Sendet Audio an Chat; Coach antwortet als Text. Nachricht erscheint als Audio-Bubble + Assistant. */
  onSendVoice: (blob: Blob, durationSec: number) => Promise<void>;
};

export function VoiceMemoButton({
  disabled,
  previewContainerRef,
  onSendVoice,
}: VoiceMemoButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    stopTracks();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }
    chunksRef.current = [];
    setBlob(null);
    setDurationSec(0);
    setIsPreview(false);
    setIsRecording(false);
    setError(null);
  }, [stopTimer, stopTracks]);

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  const startRecording = useCallback(async () => {
    if (disabled || isRecording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTimer();
        stopTracks();
        if (chunksRef.current.length > 0) {
          setBlob(new Blob(chunksRef.current, { type: mime }));
          setIsPreview(true);
        }
        recorderRef.current = null;
      };

      recorder.start(200);
      setIsRecording(true);
      setDurationSec(0);
      timerRef.current = setInterval(() => {
        setDurationSec((s) => s + 1);
      }, 1000);
    } catch (e) {
      setError("Mikrofon nicht verfügbar");
      reset();
    }
  }, [disabled, isRecording, stopTimer, stopTracks, reset]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !recorderRef.current) return;
    if (recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }, [isRecording]);

  const handleSend = useCallback(async () => {
    if (!blob || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendVoice(blob, durationSec);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Senden");
    } finally {
      setSending(false);
    }
  }, [blob, sending, durationSec, onSendVoice, reset]);

  const handleDelete = useCallback(() => {
    setBlob(null);
    setDurationSec(0);
    setIsPreview(false);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      stopTracks();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {}
      }
    };
  }, [stopTimer, stopTracks]);

  const showRecording = isRecording;
  const showPreview = isPreview && blob && previewContainerRef.current;

  const previewPanel = showPreview && (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-zinc-900 px-3 py-2">
      <span className="text-sm font-medium tabular-nums text-white/80">{formatDuration(durationSec)}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          aria-label="Senden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
          aria-label="Löschen"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {previewContainerRef.current && previewPanel
        ? createPortal(previewPanel, previewContainerRef.current)
        : null}
      <div className="relative flex items-center gap-1">
        {showPreview ? (
          <>
            <button
              type="button"
              disabled={disabled}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900 text-white/70"
              aria-label="Vorschau aktiv"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={showRecording ? stopRecording : startRecording}
              disabled={disabled}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
                showRecording
                  ? "border-red-400/50 bg-red-500/20 text-red-400 animate-pulse"
                  : "border-white/15 bg-zinc-900 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
              }`}
              aria-label={showRecording ? "Aufnahme stoppen" : "Voice Memo aufnehmen"}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            {showRecording && (
              <>
                <span className="text-xs font-medium tabular-nums text-red-400">{formatDuration(durationSec)}</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-zinc-800 text-white/80 hover:bg-red-500/20 hover:text-red-400"
                  aria-label="Abbrechen"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </>
        )}
        {error && (
          <p className="absolute left-0 top-full mt-1 text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
