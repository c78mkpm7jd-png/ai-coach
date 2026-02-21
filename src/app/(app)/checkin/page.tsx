"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CheckinPage() {
  const router = useRouter();
  const [weight, setWeight] = useState("");
  const [hunger, setHunger] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [training, setTraining] = useState<"ja" | "nein" | "halb" | null>(null);
  const [activityType, setActivityType] = useState<string>("ruhetag");
  const [durationMin, setDurationMin] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [caloriesIntake, setCaloriesIntake] = useState("");
  const [proteinIntake, setProteinIntake] = useState("");
  const [carbsIntake, setCarbsIntake] = useState("");
  const [fatIntake, setFatIntake] = useState("");
  const [saving, setSaving] = useState(false);

  const ACTIVITY_OPTIONS = [
    { id: "ruhetag", label: "Ruhetag" },
    { id: "krafttraining", label: "Krafttraining" },
    { id: "laufen", label: "Laufen" },
    { id: "radfahren", label: "Radfahren" },
    { id: "schwimmen", label: "Schwimmen" },
    { id: "hiit", label: "HIIT" },
    { id: "yoga", label: "Yoga" },
  ];

  const canSubmit = !!weight && training !== null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight_kg: parseFloat(weight),
          hunger_level: hunger,
          energy_level: energy,
          trained: training,
          activity_type: activityType,
          activity_duration_min: durationMin ? parseInt(durationMin, 10) : null,
          activity_calories_burned: caloriesBurned ? parseInt(caloriesBurned, 10) : null,
          calories_intake: caloriesIntake ? parseInt(caloriesIntake, 10) : null,
          protein_intake: proteinIntake ? parseInt(proteinIntake, 10) : null,
          carbs_intake: carbsIntake ? parseInt(carbsIntake, 10) : null,
          fat_intake: fatIntake ? parseInt(fatIntake, 10) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler beim Speichern");
      router.push("/dashboard");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Speichern.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center justify-between gap-4 text-sm text-white/60">
        <Link href="/dashboard" className="hover:text-white/80">
          ← Zurück zum Dashboard
        </Link>
        <span className="text-xs text-white/40">Check-in</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-2xl border border-white/10 bg-zinc-950/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
      >
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Täglicher Abschluss
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Dein Check-in
          </h1>
          <p className="text-sm leading-relaxed text-white/70 sm:text-base">
            Kurzer Status zu Gewicht, Hunger, Energie und Training – damit
            dein Coach Trends und Anpassungen erkennen kann.
          </p>
        </div>

        {/* Gewicht */}
        <div className="grid gap-4 sm:grid-cols-[1.3fr,1.7fr] sm:items-center">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/85">
              Gewicht heute (kg)
            </label>
            <input
              type="number"
              min={40}
              max={200}
              step={0.1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="z. B. 75,3"
              className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
            />
          </div>
          <p className="text-xs text-white/55">
            Ideal: immer zur gleichen Tageszeit, möglichst nach dem Aufstehen
            und vor der ersten Mahlzeit.
          </p>
        </div>

        {/* Hunger Level */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-white/85">
              Hunger Level
            </label>
            <span className="text-xs text-white/55">
              1 = Satt · 5 = Hungrig
            </span>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min={1}
              max={5}
              value={hunger}
              onChange={(e) => setHunger(Number(e.target.value))}
              className="w-full accent-white"
            />
            <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-white/40">
              <span>Satt</span>
              <span>Mittel</span>
              <span>Hungrig</span>
            </div>
          </div>
        </div>

        {/* Energie & Mood */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-white/85">
              Energie &amp; Stimmung
            </label>
            <span className="text-xs text-white/55">
              1 = Erschöpft · 5 = Top
            </span>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min={1}
              max={5}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full accent-white"
            />
            <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-white/40">
              <span>Erschöpft</span>
              <span>Okay</span>
              <span>Top</span>
            </div>
          </div>
        </div>

        {/* Training heute */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white/85">
            Training heute
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "ja", label: "Ja" },
              { id: "halb", label: "Halb" },
              { id: "nein", label: "Nein" },
            ].map((option) => {
              const active = training === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setTraining(option.id as "ja" | "nein" | "halb")
                  }
                  className={`rounded-full px-4 py-2 text-sm font-medium transition border ${
                    active
                      ? "border-white bg-white text-zinc-950 shadow-lg shadow-white/10"
                      : "border-white/15 bg-zinc-900 text-white/85 hover:border-white/40 hover:bg-zinc-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Aktivitätsart */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/85">
            Aktivitätsart
          </label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/20"
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-zinc-900 text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dauer (nur bei Aktivität) */}
        {activityType !== "ruhetag" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/85">
              Dauer (Minuten)
            </label>
            <input
              type="number"
              min={0}
              max={300}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="z. B. 45"
              className="w-full max-w-xs rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
            />
          </div>
        )}

        {/* Gesamtverbrauch heute (Garmin) – immer sichtbar */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/85">
            Gesamtverbrauch heute (kcal, laut Garmin)
          </label>
          <input
            type="number"
            min={0}
            max={6000}
            value={caloriesBurned}
            onChange={(e) => setCaloriesBurned(e.target.value)}
            placeholder="z. B. 2400"
            className="w-full max-w-xs rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
          />
          <p className="text-xs text-white/55">
            Trage den gesamten Tagesverbrauch ein (Grundumsatz + aktiver Verbrauch),
            nicht nur den Sport-Verbrauch.
          </p>
        </div>

        {/* Ernährungsdaten heute */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white/85">
            Ernährungsdaten heute (optional)
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs text-white/60">Kcal Aufnahme (kcal)</label>
              <input
                type="number"
                min={0}
                max={5000}
                value={caloriesIntake}
                onChange={(e) => setCaloriesIntake(e.target.value)}
                placeholder="z. B. 2400"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/60">Eiweiß (g)</label>
              <input
                type="number"
                min={0}
                max={500}
                value={proteinIntake}
                onChange={(e) => setProteinIntake(e.target.value)}
                placeholder="z. B. 150"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/60">Carbs (g)</label>
              <input
                type="number"
                min={0}
                max={600}
                value={carbsIntake}
                onChange={(e) => setCarbsIntake(e.target.value)}
                placeholder="z. B. 250"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/60">Fett (g)</label>
              <input
                type="number"
                min={0}
                max={200}
                value={fatIntake}
                onChange={(e) => setFatIntake(e.target.value)}
                placeholder="z. B. 70"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/55">
            Der Check-in dauert weniger als eine Minute und hilft deinem
            Coach, deinen Plan Woche für Woche zu schärfen.
          </p>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
              canSubmit && !saving
                ? "bg-white text-zinc-950 hover:bg-white/90"
                : "cursor-not-allowed border border-white/15 bg-transparent text-white/40"
            }`}
          >
            {saving ? "Wird gespeichert …" : "Check-in abschließen"}
          </button>
        </div>
      </form>
    </div>
  );
}
