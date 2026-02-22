"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function toDateKey(s: string) {
  return s.slice(0, 10);
}

type Row = {
  created_at: string;
  weight_kg: number;
  hunger_level?: number;
  energy_level?: number;
  trained: boolean;
  calories_intake?: number | null;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

export default function WochenberichtPage() {
  const [checkins, setCheckins] = useState<Row[]>([]);
  const [briefing, setBriefing] = useState<{
    macros?: { calories: number; protein: number; carbs: number; fat: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/briefing").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/checkin?limit=31").then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([b, c]) => {
        setBriefing(b ?? null);
        setCheckins((c?.data ?? []).slice().reverse());
      })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const weekStart = useMemo(() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);
  const weekKeyStart = toDateKey(weekStart.toISOString());
  const weekKeyEnd = (() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return toDateKey(end.toISOString());
  })();

  const weekCheckins = useMemo(
    () =>
      checkins.filter((c) => {
        const k = toDateKey(c.created_at);
        return k >= weekKeyStart && k <= weekKeyEnd;
      }),
    [checkins, weekKeyStart, weekKeyEnd]
  );
  const trainingsDone = weekCheckins.filter((c) => c.trained).length;
  const trainingsPlanned = 5;
  const avgEnergy =
    weekCheckins.length > 0
      ? weekCheckins.reduce((a, c) => a + (c.energy_level ?? 0), 0) / weekCheckins.length
      : 0;
  const avgHunger =
    weekCheckins.length > 0
      ? weekCheckins.reduce((a, c) => a + (c.hunger_level ?? 0), 0) / weekCheckins.length
      : 0;
  const weights = weekCheckins.map((c) => c.weight_kg).filter((w) => w > 0);
  const weightDelta = weights.length >= 2 ? weights[weights.length - 1] - weights[0] : null;

  const withNutrition = weekCheckins.filter(
    (c) =>
      (c.calories_intake ?? 0) > 0 ||
      (c.protein_intake ?? 0) > 0 ||
      (c.carbs_intake ?? 0) > 0 ||
      (c.fat_intake ?? 0) > 0
  );
  const avgCalories =
    withNutrition.length > 0
      ? withNutrition.reduce((a, c) => a + (c.calories_intake ?? 0), 0) / withNutrition.length
      : 0;
  const avgProtein =
    withNutrition.length > 0
      ? withNutrition.reduce((a, c) => a + (c.protein_intake ?? 0), 0) / withNutrition.length
      : 0;
  const avgCarbs =
    withNutrition.length > 0
      ? withNutrition.reduce((a, c) => a + (c.carbs_intake ?? 0), 0) / withNutrition.length
      : 0;
  const avgFat =
    withNutrition.length > 0
      ? withNutrition.reduce((a, c) => a + (c.fat_intake ?? 0), 0) / withNutrition.length
      : 0;

  const weightChartData = useMemo(
    () =>
      weekCheckins.map((c) => ({
        date: toDateKey(c.created_at).slice(5),
        Gewicht: c.weight_kg,
      })),
    [weekCheckins]
  );
  const energyHungerData = useMemo(
    () =>
      weekCheckins.map((c) => ({
        date: toDateKey(c.created_at).slice(5),
        Energie: c.energy_level ?? 0,
        Hunger: c.hunger_level ?? 0,
      })),
    [weekCheckins]
  );

  const kw = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 3);
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((d.getTime() - start.getTime()) / 604800000);
  }, [weekStart]);
  const macros = briefing?.macros ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/10" />
          ))}
        </div>
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-white">Wochenbericht</h1>
      <p className="mt-1 text-sm text-white/60">
        KW {kw} · {weekKeyStart} – {weekKeyEnd}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Trainings diese Woche</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {trainingsDone} <span className="text-sm font-normal text-white/60">von {trainingsPlanned}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${Math.min(100, (trainingsDone / trainingsPlanned) * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Gewichtstrend</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {weightDelta != null
              ? (weightDelta >= 0 ? `+${weightDelta.toFixed(1)}` : weightDelta.toFixed(1))
              : "—"}{" "}
            kg
          </p>
          <p className="mt-1 text-xs text-white/60">über die Woche</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Nährwerte Tagesdurchschnitt</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[10px] text-white/50">Kalorien</p>
            <p className="text-xl font-semibold text-white">{Math.round(avgCalories)} kcal</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50">Protein</p>
            <p className="text-xl font-semibold text-white">{Math.round(avgProtein)} g</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50">Carbs</p>
            <p className="text-xl font-semibold text-white">{Math.round(avgCarbs)} g</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50">Fett</p>
            <p className="text-xl font-semibold text-white">{Math.round(avgFat)} g</p>
          </div>
        </div>
        {withNutrition.length === 0 && (
          <p className="mt-2 text-xs text-white/45">Erfasse in Check-ins Ernährung für den Durchschnitt.</p>
        )}
      </div>

      {weightChartData.length >= 2 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Gewichtsverlauf</p>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" unit=" kg" />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Line type="monotone" dataKey="Gewicht" stroke="#a78bfa" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {energyHungerData.length >= 1 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Energie & Hunger (Verlauf)</p>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={energyHungerData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" domain={[0, 5]} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Legend />
                <Line type="monotone" dataKey="Energie" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Hunger" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <section className="mt-6 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Zusammenfassung</p>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          {weekCheckins.length === 0
            ? "Noch keine Check-ins diese Woche. Erfasse täglich deinen Status für eine bessere Auswertung."
            : `${trainingsDone} Trainingseinheiten, Ø Energie ${avgEnergy.toFixed(1)}/5, Ø Hunger ${avgHunger.toFixed(1)}/5. ${
                weightDelta != null ? `Gewicht ${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} kg zur Vorwoche.` : ""
              }`}
        </p>
      </section>

      <div className="mt-6 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">Aktuelle Makro-Ziele</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-300/5 p-3">
            <p className="text-[10px] uppercase text-emerald-100/80">Kalorien</p>
            <p className="text-lg font-semibold text-emerald-50">{macros.calories} kcal</p>
          </div>
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-300/5 p-3">
            <p className="text-[10px] uppercase text-emerald-100/80">Protein</p>
            <p className="text-lg font-semibold text-emerald-50">{macros.protein} g</p>
          </div>
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-300/5 p-3">
            <p className="text-[10px] uppercase text-emerald-100/80">Carbs</p>
            <p className="text-lg font-semibold text-emerald-50">{macros.carbs} g</p>
          </div>
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-300/5 p-3">
            <p className="text-[10px] uppercase text-emerald-100/80">Fett</p>
            <p className="text-lg font-semibold text-emerald-50">{macros.fat} g</p>
          </div>
        </div>
      </div>
    </div>
  );
}
