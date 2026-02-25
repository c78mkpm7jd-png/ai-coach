"use client";

import { useState, useRef, useEffect, useCallback } from "react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type AudioBubbleProps = {
  /** Blob-URL zum Abspielen (nur aktuelle Session); fehlt bei geladener Historie */
  src?: string | null;
  durationSec: number;
  className?: string;
};

export function AudioBubble({ src, durationSec, className = "" }: AudioBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canPlay = !!src;
  const progress = durationSec > 0 ? Math.min(100, (currentTime / durationSec) * 100) : 0;

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
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
    if (!src) return;
    stopAudio();
  }, [src, stopAudio]);

  const togglePlay = useCallback(() => {
    if (!src) return;

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(src);
      audioRef.current = audio;

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio!.currentTime);
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
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [src, isPlaying]);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl rounded-br-md bg-zinc-800/90 px-3 py-2.5 ${className}`}
      style={{ minWidth: "140px" }}
    >
      {canPlay ? (
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label={isPlaying ? "Pause" : "Abspielen"}
        >
          {isPlaying ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
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
      <div className="min-w-0 flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white/70 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-xs font-medium tabular-nums text-white/80">
          {canPlay && isPlaying
            ? `${formatDuration(currentTime)} / ${formatDuration(durationSec)}`
            : formatDuration(durationSec)}
        </p>
      </div>
    </div>
  );
}
