"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OnboardingBodyPage() {
  const router = useRouter();
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"m" | "w" | "divers" | "">("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const isValid =
    !!age && !!gender && !!height && !!weight;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    // Speichere Körperdaten in localStorage
    localStorage.setItem("onboarding_age", age);
    localStorage.setItem("onboarding_gender", gender);
    localStorage.setItem("onboarding_height", height);
    localStorage.setItem("onboarding_weight", weight);
    router.push("/onboarding/training");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8 sm:justify-center sm:py-16">
        <div className="mb-6 text-sm text-white/50 flex items-center gap-2 sm:mb-8">
          <Link href="/onboarding" className="hover:text-white/80">
            ← Zurück zu Schritt 1
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-8 pb-32 sm:pb-8">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Schritt 2 von 3
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Basisdaten zu deinem Körper
            </h1>
            <p className="text-sm leading-relaxed text-white/70 sm:text-base">
              Mit Alter, Geschlecht, Größe und Gewicht kann der Coach dein
              Kalorien- und Trainingssetup besser auf dich abstimmen.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Alter
              </label>
              <input
                type="number"
                min={10}
                max={90}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="z. B. 29"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Geschlecht
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "m", label: "Männlich" },
                  { id: "w", label: "Weiblich" },
                  { id: "divers", label: "Divers" },
                ].map((option) => {
                  const active = gender === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setGender(option.id as "m" | "w" | "divers")
                      }
                      className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                        active
                          ? "border-white bg-white text-zinc-950 shadow-lg shadow-white/10"
                          : "border-white/15 bg-zinc-900 text-white/80 hover:border-white/40 hover:bg-zinc-800"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Größe (cm)
              </label>
              <input
                type="number"
                min={120}
                max={230}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="z. B. 178"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Gewicht (kg)
              </label>
              <input
                type="number"
                min={40}
                max={200}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="z. B. 75"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-white/10 bg-zinc-950 pt-4 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:pt-0">
            <p className="hidden text-xs text-white/50 sm:block">
              Die Angaben helfen bei der Abschätzung deines Energiebedarfs und
              der Belastung im Training.
            </p>
            <button
              type="submit"
              disabled={!isValid}
              className={`w-full inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/30 sm:w-auto sm:py-2 ${
                isValid
                  ? "bg-white text-zinc-950 hover:bg-white/90"
                  : "cursor-not-allowed border border-white/15 bg-transparent text-white/40"
              }`}
            >
              Weiter
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

