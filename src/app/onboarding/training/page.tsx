"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TRAINING_DAYS = [3, 4, 5, 6];

const ACTIVITY_LEVELS = [
  { id: "sitzend", label: "Sitzend", description: "Bürojob, kaum Bewegung im Alltag." },
  { id: "leicht-aktiv", label: "Leicht aktiv", description: "Viel stehen/gehen, kurze Wege zu Fuß." },
  { id: "aktiv", label: "Aktiv", description: "Körperliche Arbeit oder viele aktive Hobbys." },
];

export default function OnboardingTrainingPage() {
  const router = useRouter();
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [activity, setActivity] = useState<string | null>(null);

  const isValid = !!daysPerWeek && !!activity;

  function handleContinue() {
    if (!isValid) return;
    localStorage.setItem("onboarding_activity", activity ?? "");
    localStorage.setItem("onboarding_training_days", String(daysPerWeek ?? ""));
    router.push("/onboarding/kalorienziel");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <div className="mb-8 text-sm text-white/50 flex items-center gap-2">
          <Link href="/onboarding/koerper" className="hover:text-white/80">
            ← Zurück zu Schritt 2
          </Link>
        </div>

        <div className="flex flex-col gap-8">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Schritt 3 von 4
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Training & Alltag
            </h1>
            <p className="text-sm leading-relaxed text-white/70 sm:text-base">
              Wie oft möchtest du trainieren und wie aktiv bist du im Alltag?
              Damit kann dein Plan realistisch und alltagstauglich aufgebaut werden.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white/85">
                Trainingstage pro Woche
              </h2>
              <p className="text-xs text-white/60">
                Wähle, wie viele Tage du realistisch pro Woche für Training einplanen kannst.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TRAINING_DAYS.map((d) => {
                  const active = daysPerWeek === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysPerWeek(d)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition border ${
                        active
                          ? "border-white bg-white text-zinc-950 shadow-lg shadow-white/10"
                          : "border-white/15 bg-zinc-900 text-white/85 hover:border-white/40 hover:bg-zinc-800"
                      }`}
                    >
                      {d}x / Woche
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white/85">
                Aktivitätslevel im Alltag
              </h2>
              <p className="text-xs text-white/60">
                Wie viel Bewegung hast du ungefähr außerhalb des Trainings?
              </p>
              <div className="mt-2 space-y-2">
                {ACTIVITY_LEVELS.map((level) => {
                  const active = activity === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setActivity(level.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        active
                          ? "border-white bg-white text-zinc-950 shadow-lg shadow-white/10"
                          : "border-white/15 bg-zinc-900 text-white/90 hover:border-white/40 hover:bg-zinc-800"
                      }`}
                    >
                      <div className="font-medium">{level.label}</div>
                      <div
                        className={`mt-1 text-xs ${
                          active ? "text-zinc-800" : "text-white/65"
                        }`}
                      >
                        {level.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-white/50">
              Du kannst deine Einstellungen später im Dashboard anpassen.
            </p>
            <button
              type="button"
              disabled={!isValid}
              onClick={handleContinue}
              className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
                isValid
                  ? "bg-white text-zinc-950 hover:bg-white/90"
                  : "cursor-not-allowed border border-white/15 bg-transparent text-white/40"
              }`}
            >
              Weiter
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

