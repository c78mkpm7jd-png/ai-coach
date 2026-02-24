"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const GOALS = [
  { id: "lean-bulk", label: "Lean Bulk", description: "Sauber Muskelmasse aufbauen mit minimalem Fettzuwachs." },
  { id: "cut", label: "Cut", description: "Körperfett reduzieren bei maximalem Muskelerhalt." },
  { id: "recomp", label: "Recomp", description: "Gleichzeitig etwas Fett verlieren und Muskulatur aufbauen." },
  { id: "maintain", label: "Maintain", description: "Form halten, Performance steigern und Struktur behalten." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <div className="mb-8 text-sm text-white/50">
          <Link href="/" className="hover:text-white/80">
            ← Zurück zur Startseite
          </Link>
        </div>

        <div className="flex flex-col gap-8">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Schritt 1 von 4
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Was ist dein aktuelles Ziel?
            </h1>
            <p className="text-sm leading-relaxed text-white/70 sm:text-base">
              Wähle das Ziel, das am besten zu den nächsten 8–12 Wochen passt. Dein Plan,
              Kalorien- und Trainingsstruktur richten sich danach.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {GOALS.map((goal) => {
              const isActive = selectedGoal === goal.id;
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`flex h-full flex-col items-start rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? "border-white bg-white text-zinc-950 shadow-lg shadow-white/10"
                      : "border-white/10 bg-white/5 text-white/90 hover:border-white/30 hover:bg-white/10"
                  }`}
                >
                  <span className="text-sm font-semibold">{goal.label}</span>
                  <span
                    className={`mt-2 text-xs leading-relaxed ${
                      isActive ? "text-zinc-800" : "text-white/70"
                    }`}
                  >
                    {goal.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-white/50">
              Du kannst dein Ziel später jederzeit anpassen.
            </p>
            <button
              type="button"
              disabled={!selectedGoal}
              onClick={() => {
                if (!selectedGoal) return;
                // Speichere Ziel in localStorage
                localStorage.setItem("onboarding_goal", selectedGoal);
                router.push("/onboarding/koerper");
              }}
              className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
                selectedGoal
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

