"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function OnboardingKalorienzielPage() {
  const router = useRouter();
  const { user } = useUser();
  const [calMin, setCalMin] = useState("");
  const [calMax, setCalMax] = useState("");
  const [proteinMin, setProteinMin] = useState("");
  const [proteinMax, setProteinMax] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    calMin !== "" &&
    calMax !== "" &&
    Number(calMin) <= Number(calMax) &&
    (proteinMin === "" || proteinMax === "" || Number(proteinMin) <= Number(proteinMax));

  async function handleCalculate() {
    const goal = localStorage.getItem("onboarding_goal");
    const age = localStorage.getItem("onboarding_age");
    const gender = localStorage.getItem("onboarding_gender");
    const height = localStorage.getItem("onboarding_height");
    const weight = localStorage.getItem("onboarding_weight");
    const activity = localStorage.getItem("onboarding_activity");

    if (!goal || !age || !height || !weight) {
      setError("Bitte zuerst die vorherigen Schritte ausfüllen.");
      return;
    }

    setCalculating(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        goal,
        weight,
        height,
        age,
        gender: gender ?? "m",
        activity_level: activity ?? "sitzend",
      });
      const res = await fetch(`/api/onboarding/calorie-target?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Berechnung fehlgeschlagen");
      setCalMin(String(data.calorie_target_min));
      setCalMax(String(data.calorie_target_max));
      setProteinMin(String(data.protein_target_min));
      setProteinMax(String(data.protein_target_max));
      setExplanation(data.explanation ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Berechnung fehlgeschlagen");
    } finally {
      setCalculating(false);
    }
  }

  useEffect(() => {
    const goal = localStorage.getItem("onboarding_goal");
    const age = localStorage.getItem("onboarding_age");
    const height = localStorage.getItem("onboarding_height");
    const weight = localStorage.getItem("onboarding_weight");
    if (!goal || !age || !height || !weight) {
      router.replace("/onboarding");
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user) return;

    const goal = localStorage.getItem("onboarding_goal");
    const age = localStorage.getItem("onboarding_age");
    const gender = localStorage.getItem("onboarding_gender");
    const height = localStorage.getItem("onboarding_height");
    const weight = localStorage.getItem("onboarding_weight");
    const activity = localStorage.getItem("onboarding_activity");
    const trainingDays = localStorage.getItem("onboarding_training_days");

    if (!goal || !age || !gender || !height || !weight || !activity || !trainingDays) {
      setError("Fehlende Onboarding-Daten. Bitte starte von vorne.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const profileData = {
        id: user.id,
        goal,
        age: parseInt(age, 10),
        gender,
        height: parseInt(height, 10),
        weight: parseFloat(weight),
        activity_level: activity,
        training_days_per_week: parseInt(trainingDays, 10),
        calorie_target_min: parseInt(calMin, 10),
        calorie_target_max: parseInt(calMax, 10),
        protein_target_min: proteinMin ? parseInt(proteinMin, 10) : null,
        protein_target_max: proteinMax ? parseInt(proteinMax, 10) : null,
        updated_at: new Date().toISOString(),
      };

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Speichern fehlgeschlagen");

      localStorage.removeItem("onboarding_goal");
      localStorage.removeItem("onboarding_age");
      localStorage.removeItem("onboarding_gender");
      localStorage.removeItem("onboarding_height");
      localStorage.removeItem("onboarding_weight");
      localStorage.removeItem("onboarding_activity");
      localStorage.removeItem("onboarding_training_days");

      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8 sm:justify-center sm:py-16">
        <div className="mb-6 flex items-center gap-2 text-sm text-white/50 sm:mb-8">
          <Link href="/onboarding/training" className="hover:text-white/80">
            ← Zurück zu Schritt 3
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-8 pb-32 sm:pb-8">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Schritt 4 von 4
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Dein Kalorienziel
            </h1>
            <p className="text-sm leading-relaxed text-white/70 sm:text-base">
              Du kannst den Coach einen Bereich berechnen lassen oder deinen eigenen Bereich eintragen.
            </p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={calculating}
              className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-50"
            >
              {calculating ? "Wird berechnet …" : "Kalorienziel berechnen lassen"}
            </button>

            {explanation && (
              <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/70">
                {explanation}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/85">Kalorien Min (kcal)</label>
                <input
                  type="number"
                  min={800}
                  max={6000}
                  value={calMin}
                  onChange={(e) => setCalMin(e.target.value)}
                  placeholder="z. B. 2200"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/85">Kalorien Max (kcal)</label>
                <input
                  type="number"
                  min={800}
                  max={6000}
                  value={calMax}
                  onChange={(e) => setCalMax(e.target.value)}
                  placeholder="z. B. 2400"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/85">Protein Min (g, optional)</label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={proteinMin}
                  onChange={(e) => setProteinMin(e.target.value)}
                  placeholder="z. B. 135"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/85">Protein Max (g, optional)</label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={proteinMax}
                  onChange={(e) => setProteinMax(e.target.value)}
                  placeholder="z. B. 165"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-white/10 bg-zinc-950 pt-4 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:pt-0">
            <p className="hidden text-xs text-white/50 sm:block">
              Du kannst dein Kalorienziel später in den Einstellungen anpassen.
            </p>
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className={`w-full inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/30 sm:w-auto sm:py-2 ${
                canSubmit && !saving
                  ? "bg-white text-zinc-950 hover:bg-white/90"
                  : "cursor-not-allowed border border-white/15 bg-transparent text-white/40"
              }`}
            >
              {saving ? "Wird gespeichert …" : "Weiter zum Dashboard"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
