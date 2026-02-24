"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useSidebar } from "@/components/layout/SidebarContext";
import { isCheckinComplete } from "@/lib/checkin-partial";

function toDateKey(createdAt: string) {
  return createdAt.slice(0, 10);
}

/** Nur vollständige Check-ins für Kalorien/Makros (calories_intake > 0). Null/0 als "–" darstellen. */
function chartValue(v: number | null | undefined): number | null {
  if (v == null || v <= 0) return null;
  return v;
}

function formatDayShort(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00");
  return new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(d);
}

type BriefingData = {
  macros: { calories: number; protein: number; carbs: number; fat: number };
  tipOfDay?: { preview: string; full: string };
  analysis?: { preview: string; full: string } | null;
  hasCheckins?: boolean;
};

type CheckinRow = {
  created_at: string;
  weight_kg?: number | null;
  hunger_level?: number | null;
  energy_level?: number | null;
  trained?: boolean;
  activity_calories_burned?: number | null;
  calories_intake?: number | null;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

const COLORS = { intake: "#a78bfa", burned: "#34d399", protein: "#f472b6", carbs: "#fbbf24", fat: "#60a5fa" };

function Card({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10 ${className}`}
    >
      {children}
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="h-3 w-20 rounded bg-white/10" />
      <div className="mt-3 h-14 w-full rounded bg-white/10" />
      <div className="mt-2 h-3 w-24 rounded bg-white/10" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const today = new Date();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<{ date: string; type: "training" | "ruhetag" }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderTime, setReminderTime] = useState("");
  const [reminderSaving, setReminderSaving] = useState(false);
  const { setMobileOpen } = useSidebar();

  useEffect(() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    Promise.all([
      fetch("/api/briefing").then((res) => {
        if (res.status === 404) {
          router.replace("/onboarding");
          return null;
        }
        return res.ok ? res.json() : null;
      }),
      fetch("/api/checkin?limit=31").then((res) => (res.ok ? res.json() : { data: [] })),
      fetch(`/api/calendar?year=${y}&month=${m}`).then((res) => (res.ok ? res.json() : { data: [] })),
    ])
      .then(([b, c, cal]) => {
        if (b) setBriefing(b);
        setCheckins((c?.data ?? []).slice().reverse());
        setCalendarEvents(cal?.data ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const todayKey = toDateKey(today.toISOString());
  const last7 = useMemo(() => checkins.slice(-7), [checkins]);
  const todayCheckin = checkins.find((c) => toDateKey(c.created_at) === todayKey);
  const todayCheckinComplete = todayCheckin != null && isCheckinComplete(todayCheckin);
  const macrosGoal = briefing?.macros ?? { protein: 0, carbs: 0, fat: 0 };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h <= 11) return "Guten Morgen";
    if (h >= 12 && h <= 17) return "Guten Mittag";
    if (h >= 18 && h <= 22) return "Guten Abend";
    return "Gute Nacht";
  }, []);

  const caloriesLineData = useMemo(
    () =>
      last7.map((c) => {
        const key = toDateKey(c.created_at);
        return {
          day: formatDayShort(key),
          Verbrauch: chartValue(c.activity_calories_burned),
          Aufnahme: chartValue(c.calories_intake),
        };
      }),
    [last7]
  );

  const macrosLineData = useMemo(
    () =>
      last7.map((c) => {
        const key = toDateKey(c.created_at);
        return {
          day: formatDayShort(key),
          Protein: chartValue(c.protein_intake),
          Carbs: chartValue(c.carbs_intake),
          Fett: chartValue(c.fat_intake),
        };
      }),
    [last7]
  );

  const weightData = useMemo(
    () =>
      last7.map((c) => {
        const key = toDateKey(c.created_at);
        return { day: formatDayShort(key), kg: chartValue(c.weight_kg) };
      }),
    [last7]
  );
  const lastWithWeight = last7.filter((c) => c.weight_kg != null && c.weight_kg > 0);
  const currentWeight = lastWithWeight.length ? lastWithWeight[lastWithWeight.length - 1].weight_kg : null;
  const weightTrend =
    lastWithWeight.length >= 2
      ? (lastWithWeight[lastWithWeight.length - 1].weight_kg ?? 0) - (lastWithWeight[lastWithWeight.length - 2].weight_kg ?? 0)
      : null;

  const calendarDays = useMemo(() => {
    const y = today.getFullYear();
    const m = today.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => ({
      day: i + 1,
      key: `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
      isToday: i + 1 === today.getDate(),
    }));
  }, [today]);
  const firstDayOffset = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7;
  const checkinByDate = useMemo(() => {
    const m = new Map<string, CheckinRow>();
    checkins.forEach((c) => m.set(toDateKey(c.created_at), c));
    return m;
  }, [checkins]);
  const calendarEventByDate = useMemo(() => {
    const m = new Map<string, { date: string; type: "training" | "ruhetag" }>();
    calendarEvents.forEach((e) => m.set(e.date, e));
    return m;
  }, [calendarEvents]);

  const hasCaloriesData = caloriesLineData.length > 0 && caloriesLineData.some((d) => (d.Aufnahme != null && d.Aufnahme > 0) || (d.Verbrauch != null && d.Verbrauch > 0));
  const hasMacrosData = caloriesLineData.length > 0 && caloriesLineData.some((d) => d.Aufnahme != null && d.Aufnahme > 0);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 py-6 sm:py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        </header>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const firstName = (user?.firstName as string | undefined) ?? "";

  const openReminderModal = () => {
    setReminderModalOpen(true);
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = d?.data?.checkin_reminder_time;
        setReminderTime(t ? String(t).slice(0, 5) : "09:00");
      })
      .catch(() => setReminderTime("09:00"));
  };

  const buttonBase = "rounded-lg px-3 py-2 text-xs font-medium shrink-0";
  const btnPlanen = "border border-white/30 bg-white text-zinc-900 hover:bg-white/90";
  const btnCheckinDone = "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30";
  const btnCheckinPending = "animate-pulse border border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30";
  const btnWochen = "border border-white/20 bg-white/5 text-white/80 hover:bg-white/10";

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 py-6 sm:py-8">
      {/* Mobile: Hamburger + Greeting | Desktop: wie bisher */}
      <header className="mb-4 flex items-center justify-between md:mb-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Menü öffnen"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-white">
              {greeting}{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-0.5 text-sm text-white/50">Dashboard</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={openReminderModal}
            className={`${buttonBase} ${btnPlanen}`}
          >
            Check-in planen
          </button>
          <Link
            href="/checkin"
            className={`${buttonBase} ${todayCheckinComplete ? btnCheckinDone : btnCheckinPending}`}
          >
            {todayCheckinComplete ? "Check-in ✓" : "Check-in ausstehend"}
          </Link>
          <Link href="/dashboard/wochenbericht" className={`${buttonBase} ${btnWochen}`}>
            Wochenbericht →
          </Link>
        </div>
      </header>

      {/* Mobile only: drei Buttons unter dem Header */}
      <div className="mb-4 flex gap-2 md:hidden">
        <button
          type="button"
          onClick={openReminderModal}
          className={`flex-1 ${buttonBase} ${btnPlanen}`}
        >
          Check-in planen
        </button>
        <Link
          href="/checkin"
          className={`flex-1 text-center ${buttonBase} ${todayCheckinComplete ? btnCheckinDone : btnCheckinPending}`}
        >
          {todayCheckinComplete ? "Check-in ✓" : "Check-in"}
        </Link>
        <Link href="/dashboard/wochenbericht" className={`flex-1 text-center ${buttonBase} ${btnWochen}`}>
          Wochenübersicht
        </Link>
      </div>

      {reminderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !reminderSaving && setReminderModalOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white">Check-in planen</h3>
            <p className="mt-1 text-xs text-white/50">Tägliche Erinnerung per E-Mail (Uhrzeit in UTC)</p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-white/70">Uhrzeit</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !reminderSaving && setReminderModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={reminderSaving}
                onClick={() => {
                  setReminderSaving(true);
                  fetch("/api/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ checkin_reminder_time: reminderTime || null }),
                  })
                    .then((r) => (r.ok ? Promise.resolve() : Promise.reject(new Error("Speichern fehlgeschlagen"))))
                    .then(() => setReminderModalOpen(false))
                    .catch((e) => setError(e.message))
                    .finally(() => setReminderSaving(false));
                }}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white/90 disabled:opacity-50"
              >
                {reminderSaving ? "Speichern …" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {/* Kalorien Card – Linienchart mit Achsen (kcal, Tage) */}
        <Card href="/dashboard/kalorien">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Kalorien</p>
          <div className="mt-2 h-20">
            {hasCaloriesData && caloriesLineData.length >= 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={caloriesLineData} margin={{ top: 2, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" tickFormatter={(v: number | undefined) => (v != null && v > 0 ? `${v}` : "–")} width={28} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} formatter={(v: number | null | undefined, n: string | undefined) => [v != null && v > 0 ? `${v} kcal` : "–", n ?? ""]} />
                  <Line type="monotone" dataKey="Verbrauch" stroke={COLORS.burned} strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Aufnahme" stroke={COLORS.intake} strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-white/40">Noch keine Daten</p>
            )}
          </div>
          <p className="mt-1 text-[10px] text-white/45">Verbrauch vs. Aufnahme (7 Tage)</p>
        </Card>

        {/* Makros Card – Linienchart mit Achsen (g, Tage) */}
        <Card href="/dashboard/makros">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Makros</p>
          <div className="mt-2 h-20">
            {hasMacrosData && macrosLineData.length >= 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={macrosLineData} margin={{ top: 2, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" width={28} tickFormatter={(v: number | undefined) => (v != null && v > 0 ? `${v}` : "–")} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} formatter={(v: number | null | undefined, n: string | undefined) => [v != null && v > 0 ? `${v} g` : "–", n ?? ""]} />
                  <Line type="monotone" dataKey="Protein" stroke={COLORS.protein} strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Carbs" stroke={COLORS.carbs} strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Fett" stroke={COLORS.fat} strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-white/40">Noch keine Daten</p>
            )}
          </div>
          <p className="mt-1 text-[10px] text-white/45">Protein, Carbs, Fett (7 Tage)</p>
        </Card>

        {/* Gewicht Card – Linienchart mit Achsen (kg, Tage) */}
        <Card href="/dashboard/gewicht">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Gewicht</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-white">
              {currentWeight != null ? `${currentWeight} kg` : "—"}
            </span>
            {weightTrend != null && weightTrend !== 0 && (
              <span className={weightTrend > 0 ? "text-amber-400" : "text-emerald-400"}>
                {weightTrend > 0 ? "↑" : "↓"}
              </span>
            )}
          </div>
          <div className="mt-1 h-14">
            {weightData.length >= 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData} margin={{ top: 2, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)" }} stroke="rgba(255,255,255,0.15)" width={28} tickFormatter={(v: number | undefined) => (v != null && v > 0 ? `${v}` : "–")} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} formatter={(v: number | null | undefined, n: string | undefined) => [v != null && v > 0 ? `${v} kg` : "–", n ?? ""]} />
                  <Line type="monotone" dataKey="kg" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        {/* Kalender Card – mit Legende */}
        <Card href="/dashboard/kalender">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Kalender</p>
          <p className="mt-1 text-xs font-medium text-white/80">
            {new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" }).format(today)}
          </p>
          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDayOffset }, (_, i) => (
              <div key={`e-${i}`} className="aspect-square" />
            ))}
            {calendarDays.map(({ day, key, isToday }) => {
              const e = calendarEventByDate.get(key);
              let bg = "bg-white/10";
              if (e) bg = e.type === "training" ? "bg-emerald-500/40" : "bg-blue-500/40";
              return (
                <div
                  key={key}
                  className={`aspect-square rounded-sm text-[9px] font-medium ${bg} flex items-center justify-center text-white/90 ${isToday ? "ring-1 ring-white ring-offset-0" : ""}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-white/50">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded bg-emerald-500/60" /> Grün = Training</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded bg-blue-500/60" /> Blau = Ruhetag</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded bg-white/30" /> Grau = nicht markiert</span>
          </div>
        </Card>

        {/* Tipp des Tages – preview + full per URL an Detailseite */}
        <Card
          href={
            briefing?.tipOfDay
              ? `/dashboard/tipp-des-tages?preview=${encodeURIComponent(briefing.tipOfDay.preview)}&full=${encodeURIComponent(briefing.tipOfDay.full)}`
              : "/dashboard/tipp-des-tages"
          }
          className="hover:border-white/30 hover:shadow-lg hover:shadow-white/5 transition-shadow"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Tipp des Tages</p>
          <p className="mt-2 text-xs leading-snug text-white/90">
            {briefing?.tipOfDay?.preview || "Kein Tipp geladen."}
          </p>
          <span className="mt-1 inline-block text-[10px] text-white/45">→ Mehr erfahren</span>
        </Card>

        {/* Deine Analyse – preview + full per URL an Detailseite */}
        <Card
          href={
            briefing?.hasCheckins && briefing?.analysis
              ? `/dashboard/analyse?preview=${encodeURIComponent(briefing.analysis.preview)}&full=${encodeURIComponent(briefing.analysis.full)}`
              : "/dashboard/analyse"
          }
          className="hover:border-white/30 hover:shadow-lg hover:shadow-white/5 transition-shadow"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Deine Analyse</p>
          <p className="mt-2 text-xs leading-snug text-white/90">
            {briefing?.hasCheckins
              ? (briefing?.analysis?.preview || "Keine Analyse.")
              : "Erfasse Check-ins für eine Analyse."}
          </p>
          <span className="mt-1 inline-block text-[10px] text-white/45">→ Mehr erfahren</span>
        </Card>
      </div>
    </div>
  );
}
