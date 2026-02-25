"use client";

export type VoiceCoachButtonProps = {
  disabled?: boolean;
  /** Öffnet das Voice-Coach-Modal (Konversation ohne Chat-Persistenz, mit TTS + Memories beim Beenden). */
  onOpenModal: () => void;
};

export function VoiceCoachButton({ disabled, onOpenModal }: VoiceCoachButtonProps) {
  return (
    <button
      type="button"
      onClick={onOpenModal}
      disabled={disabled}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-zinc-900 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
      aria-label="Voice Coach starten (Coach hört zu, antwortet per Sprache)"
    >
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    </button>
  );
}
