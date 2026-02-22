"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function formatDateGerman(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function toDateKey(createdAt: string) {
  return createdAt.slice(0, 10);
}

type BriefingData = {
  macros: { calories: number; protein: number; carbs: number; fat: number };
  greeting: string;
  trainingDay: string;
  trainingSubtext: string;
  coachTipTitle: string;
  coachTipBody: string;
  hasCheckins?: boolean;
  analysisTitle: string | null;
  analysisBody: string | null;
};

type CheckinRow = {
  created_at: string;
  weight_kg: number;
  trained: boolean;
  activity_type?: string;
  activity_calories_burned?: number | null;
  calories_intake?: number | null;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

const CHART_COLORS = {
  intake: "#a78bfa",
  burned: "#34d399",
  protein: "#f472b6",
  carbs: "#fbbf24",
  fat: "#60a5fa",
  gray: "#71717a",
  green: "#22c55e",
  blue: "#3b82f6",
};

export default function DashboardPage() {
  const router = useRouter();
  const today = new Date();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingTip, setRefreshingTip] = useState(false);
  const [refreshingAnalysis, setRefreshingAnalysis] = useState(false);

  useEffect(() => {
    const todayKey = toDateKey(today.toISOString());
    Promise.all([
      fetch("/api/briefing").then((res) => {
        if (res.status === 404) {
          router.replace("/onboarding");
          return null;
        }
        if (!res.ok) throw new Error("Fehler beim Laden");
        return res.json();
      }),
      fetch("/api/checkin?limit=31").then((res) => {
        if (!res.ok) return { data: [] };
        return res.json();
      }),
    ])
      .then(([briefingData, checkinData]) => {
        if (briefingData) setBriefing(briefingData);
        setCheckins((checkinData?.data ?? []).slice().reverse());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const refreshTipOfDay = () => {
    if (refreshingTip || !briefing) return;
    setRefreshingTip(true);
    fetch("/api/briefing?only=tip")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data)
          setBriefing((prev) =>
            prev ? { ...prev, coachTipTitle: data.coachTipTitle, coachTipBody: data.coachTipBody } : data
          );
      })
      .finally(() => setRefreshingTip(false));
  };

  const refreshAnalysis = () => {
    if (refreshingAnalysis || !briefing) return;
    setRefreshingAnalysis(true);
    fetch("/api/briefing?only=analysis")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data)
          setBriefing((prev) =>
            prev
              ? { ...prev, analysisTitle: data.analysisTitle ?? null, analysisBody: data.analysisBody ?? null }
              : data
          );
      })
      .finally(() => setRefreshingAnalysis(false));
  };

  const last7 = useMemo(() => checkins.slice(-7), [checkins]);
  const chartDataCalories = useMemo(
    () =>
      last7.map((c) => ({
        date: toDateKey(c.created_at).slice(5),
        Verbrauch: c.activity_calories_burned ?? 0,
        Aufnahme: c.calories_intake ?? 0,
      })),
    [last7]
  );
  const chartDataMacros = useMemo(
    () =>
      last7.map((c) => ({
        date: toDateKey(c.created_at).slice(5),
        Protein: c.protein_intake ?? 0,
        Carbs: c.carbs_intake ?? 0,
        Fett: c.fat_intake ?? 0,
      })),
    [last7]
  );
  const chartDataWeight = useMemo(
    () => last7.map((c) => ({ date: toDateKey(c.created_at).slice(5), kg: c.weight_kg })),
    [last7]
  );

  const todayKey = toDateKey(today.toISOString());
  const todayCheckin = checkins.find((c) => toDateKey(c.created_at) === todayKey);
  const macrosGoal = briefing?.macros ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const pieData = useMemo(() => {
    if (!todayCheckin) return [];
    const p = Math.min(100, Math.round(((todayCheckin.protein_intake ?? 0) / (macrosGoal.protein || 1)) * 100));
    const c = Math.min(100, Math.round(((todayCheckin.carbs_intake ?? 0) / (macrosGoal.carbs || 1)) * 100));
    const f = Math.min(100, Math.round(((todayCheckin.fat_intake ?? 0) / (macrosGoal.fat || 1)) * 100));
    return [
      { name: "Protein", value: p, color: CHART_COLORS.protein },
      { name: "Carbs", value: c, color: CHART_COLORS.carbs },
      { name: "Fett", value: f, color: CHART_COLORS.fat },
    ].filter((d) => d.value > 0);
  }, [todayCheckin, macrosGoal]);

  const calendarDays = useMemo(() => {
    const y = today.getFullYear();
    const m = today.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const days: { day: number; key: string; isToday: boolean }[] = [];
    for (let d = 1; d <= last.getDate(); d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ day: d, key, isToday: d === today.getDate() });
    }
    return days;
  }, [today]);

  const checkinByDate = useMemo(() => {
    const map = new Map<string | undefined, CheckinRow>();
    checkins.forEach((c) => map.set(toDateKey(c.created_at), c));
    return map;
  }, [checkins]);

  const firstDayOffset = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7;

  const todayTrainingLabel = briefing?.trainingDay ?? "—";
  const trainingSubtext = briefing?.trainingSubtext ?? "Fokus auf saubere Ausführung.";
  const greeting = briefing?.greeting ?? "Willkommen zurück.";
  const macros = briefing?.macros ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8 h-24 w-64 animate-pulse rounded bg-white/10" />
        <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
          <div className="space-y-6">
            <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
          </div>
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">Daily Briefing</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}</h1>
          <p className="text-sm text-white/60">{formatDateGerman(today)}</p>
          <Link href="/report" className="inline-flex text-sm font-medium text-white/70 hover:text-white">
            Wochenbericht ansehen →
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {error}. <Link href="/profil" className="underline">Profil prüfen</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Heutiger Trainingstag</p>
                <p className="mt-1 text-xl font-semibold text-white">{todayTrainingLabel}</p>
                <p className="mt-1 text-xs text-white/65">{trainingSubtext}</p>
              </div>
              <span className="hidden rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 sm:inline-flex">
                Heute geplant
              </span>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white/90">Makros für heute</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Kalorien", value: macros.calories, unit: "kcal" },
                { label: "Protein", value: macros.protein, unit: "g" },
                { label: "Carbs", value: macros.carbs, unit: "g" },
                { label: "Fett", value: macros.fat, unit: "g" },
              ].map(({ label, value, unit }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/45">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {value}
                    <span className="ml-1 text-xs font-normal text-white/60">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Grafiken */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-white/90">Grafiken</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">
                  Kalorien Verbrauch vs. Aufnahme
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataCalories} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Bar dataKey="Verbrauch" fill={CHART_COLORS.burned} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Aufnahme" fill={CHART_COLORS.intake} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">
                  Makros Verlauf (7 Tage)
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDataMacros} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="Protein" stroke={CHART_COLORS.protein} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Carbs" stroke={CHART_COLORS.carbs} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Fett" stroke={CHART_COLORS.fat} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">
                  Zielerreichung heute (%)
                </p>
                <div className="h-48 flex items-center justify-center">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={64}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => `${v}%`}
                          contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <span className="text-sm text-white/50">Kein Check-in heute</span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">Gewichtsverlauf</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDataWeight} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" unit=" kg" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <Line type="monotone" dataKey="kg" stroke="#a78bfa" strokeWidth={2} dot={{ r: 4 }} name="Gewicht" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* Kalender */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">Kalender</p>
            <p className="mb-3 text-sm font-medium text-white/80">
              {new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(today)}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                <div key={d} className="text-[10px] font-medium text-white/50">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOffset }, (_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {calendarDays.map(({ day, key, isToday }) => {
                const c = checkinByDate.get(key);
                let bg = "bg-white/5 text-white/40";
                if (c) {
                  bg = c.trained ? "bg-emerald-500/30 text-emerald-200" : "bg-blue-500/30 text-blue-200";
                }
                return (
                  <div
                    key={key}
                    className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium ${bg} ${
                      isToday ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : ""
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-white/50">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-emerald-500/50" /> Training
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-blue-500/50" /> Ruhetag
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-white/20" /> Kein Check-in
              </span>
            </div>
          </section>
        </div>

        {/* Tipps nebeneinander, kompakt */}
        <aside className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">TIPP DES TAGES</p>
                <button
                  type="button"
                  onClick={refreshTipOfDay}
                  disabled={refreshingTip}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  aria-label="Neuen Tipp laden"
                >
                  <svg
                    className={`h-4 w-4 ${refreshingTip ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                {briefing?.coachTipTitle ? `„${briefing.coachTipTitle}"` : "—"}
              </h3>
              <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-white/75">
                {briefing?.coachTipBody || "Kein Tipp verfügbar."}
              </p>
            </section>

            {briefing?.hasCheckins ? (
              <section className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">DEINE ANALYSE</p>
                  <button
                    type="button"
                    onClick={refreshAnalysis}
                    disabled={refreshingAnalysis}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-50"
                    aria-label="Analyse neu laden"
                  >
                    <svg
                      className={`h-4 w-4 ${refreshingAnalysis ? "animate-spin" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                  {briefing.analysisTitle ? `„${briefing.analysisTitle}"` : "—"}
                </h3>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-white/75">
                  {briefing.analysisBody || "Keine Analyse verfügbar."}
                </p>
              </section>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
