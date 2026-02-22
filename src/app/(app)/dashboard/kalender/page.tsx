"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

type CalendarEvent = { date: string; type: "training" | "ruhetag" };

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function KalenderPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [recurringWeekday, setRecurringWeekday] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { year: y, month: m } = currentMonth;

  const loadEvents = () => {
    setLoading(true);
    fetch(`/api/calendar?year=${y}&month=${m + 1}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setEvents(d?.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, [y, m]);

  const eventByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    events.forEach((e) => map.set(e.date, e));
    return map;
  }, [events]);

  const monthName = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(y, m, 1));
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const firstOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const days = useMemo(() => {
    const out: { day: number; key: string; isToday: boolean; weekday: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const date = new Date(y, m, d);
      const weekday = (date.getDay() + 6) % 7;
      out.push({
        day: d,
        key,
        isToday: today.getFullYear() === y && today.getMonth() === m && d === today.getDate(),
        weekday,
      });
    }
    return out;
  }, [y, m, daysInMonth, today]);

  const goPrev = () => {
    setCurrentMonth((prev) => (prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }));
  };
  const goNext = () => {
    setCurrentMonth((prev) => (prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }));
  };

  const openDialog = (dateKey: string, _weekday: number) => {
    setSelectedDate(dateKey);
    setRecurringWeekday(null);
    setDialogOpen(true);
  };

  const selectedEntry = selectedDate ? eventByDate.get(selectedDate) : null;

  const handleSave = async (trained: boolean) => {
    if (!selectedDate || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          type: trained ? "training" : "ruhetag",
          ...(recurringWeekday !== null && { recurringWeekday }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setDialogOpen(false);
      setSelectedDate(null);
      loadEvents();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDate || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar?date=${selectedDate}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setDialogOpen(false);
      setSelectedDate(null);
      loadEvents();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
        <div className="mt-6 h-80 animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-white">Kalender</h1>
      <p className="mt-1 text-sm text-white/60">Tage als Training oder Ruhetag markieren (unabhängig von Check-ins)</p>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Vorheriger Monat"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-lg font-medium text-white">{monthName}</p>
        <button
          type="button"
          onClick={goNext}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Nächster Monat"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-7 gap-2 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-xs font-medium text-white/50">
              {d}
            </div>
          ))}
          {Array.from({ length: firstOffset }, (_, i) => (
            <div key={`e-${i}`} className="aspect-square rounded-lg" />
          ))}
          {days.map(({ day, key, isToday }) => {
            const e = eventByDate.get(key);
            let bg = "bg-white/10 text-white/50";
            if (e) {
              bg = e.type === "training" ? "bg-emerald-500/40 text-emerald-100" : "bg-blue-500/40 text-blue-100";
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => openDialog(key, 0)}
                className={`relative flex aspect-square items-center justify-center rounded-lg text-sm font-medium ${bg} ${
                  isToday ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : ""
                } hover:ring-2 hover:ring-white/50`}
              >
                {day}
                {!e && <span className="absolute right-1 top-1 text-white/40">+</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-xs text-white/50">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-emerald-500/50" /> Grün = Training
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-blue-500/50" /> Blau = Ruhetag
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-white/20" /> Grau = nicht markiert
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm text-white/60">
        Klicke auf einen Tag (oder +), um Training oder Ruhetag zu setzen. Diese Einträge sind nur für die Planung und
        haben keinen Einfluss auf Check-ins.{" "}
        <Link href="/checkin" className="text-white/80 underline hover:text-white">
          Vollständigen Check-in erfassen
        </Link>
      </p>

      {dialogOpen && selectedDate && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={() => setDialogOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Tag markieren</h3>
            <p className="mt-1 text-sm text-white/60">{selectedDate}</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="flex-1 rounded-xl bg-emerald-500/80 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Training
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="flex-1 rounded-xl bg-blue-500/80 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Ruhetag
              </button>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-xs font-medium text-white/60">Wiederkehrend (z. B. jeden Wochentag)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRecurringWeekday(recurringWeekday === i ? null : i)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      recurringWeekday === i ? "bg-white text-zinc-900" : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-white/45">
                Wenn gewählt: Eintrag für die nächsten 4 {recurringWeekday != null ? WEEKDAYS[recurringWeekday] + "e" : "Wochen"}.
              </p>
            </div>
            {selectedEntry && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs text-white/50">
                  Eintrag für diesen Tag: {selectedEntry.type === "training" ? "Training" : "Ruhetag"}
                </p>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="mt-2 w-full rounded-lg border border-red-400/40 bg-red-400/10 py-2 text-sm text-red-200 hover:bg-red-400/20 disabled:opacity-50"
                >
                  {deleting ? "Löschen …" : "Eintrag löschen"}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="mt-4 w-full rounded-lg border border-white/20 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Schließen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
