"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/** Anzeige im Format "0:23" */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type AudioBubbleProps = {
  /** Audio als Base64 (persistent), für data-URL beim Abspielen */
  audioBase64?: string | null;
  /** Legacy: Blob-URL falls keine Base64 */
  src?: string | null;
  /** Dauer in Sekunden (während Aufnahme gemessen) */
  durationSec: number;
  className?: string;
};

const AUDIO_MIME = "audio/webm";

export function AudioBubble({ audioBase64, src, durationSec, className = "" }: AudioBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const playUrl = audioBase64
    ? `data:${AUDIO_MIME};base64,${audioBase64}`
    : src || null;
  const canPlay = !!playUrl;
  const totalSec = Number.isFinite(duration) && duration > 0 ? duration : durationSec;
  const progress = totalSec > 0 ? Math.min(100, (currentTime / totalSec) * 100) : 0;

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!playUrl) return;
    stopAudio();
  }, [playUrl, stopAudio]);

  const togglePlay = useCallback(() => {
    if (!playUrl) return;

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(playUrl);
      audioRef.current = audio;

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio!.currentTime);
      });
      audio.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(audio!.duration)) setDuration(audio!.duration);
      });
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
      audio.addEventListener("play", () => setIsPlaying(true));
      audio.addEventListener("pause", () => setIsPlaying(false));
      audio.addEventListener("error", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [playUrl, isPlaying]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canPlay || !progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const seekTime = pct * totalSec;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = seekTime;
        setCurrentTime(seekTime);
      }
    },
    [canPlay, totalSec]
  );

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl rounded-br-md bg-zinc-800/90 px-3 py-2.5 ${className}`}
      style={{ minWidth: "160px" }}
    >
      {/* Links: Play/Pause */}
      {canPlay ? (
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label={isPlaying ? "Pause" : "Abspielen"}
        >
          {isPlaying ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60"
          aria-hidden
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </div>
      )}

      {/* Mitte: Fortschrittsbalken (klickbar) */}
      <div className="min-w-0 flex-1">
        <div
          ref={progressBarRef}
          role="slider"
          tabIndex={canPlay ? 0 : undefined}
          aria-label="Position"
          aria-valuemin={0}
          aria-valuemax={totalSec}
          aria-valuenow={currentTime}
          onClick={canPlay ? handleProgressClick : undefined}
          className={`h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/20 transition-colors ${canPlay ? "hover:bg-white/25" : ""}`}
        >
          <div
            className="h-full rounded-full bg-white/70 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Rechts: Dauer (aktuell / gesamt) */}
      <p className="shrink-0 text-xs font-medium tabular-nums text-white/80" style={{ minWidth: "3.5rem" }}>
        {formatDuration(canPlay && isPlaying ? currentTime : 0)}
        {totalSec > 0 ? ` / ${formatDuration(totalSec)}` : ""}
      </p>
    </div>
  );
}
