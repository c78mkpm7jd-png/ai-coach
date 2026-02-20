"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

function formatDateGerman(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

type BriefingData = {
  macros: { calories: number; protein: number; carbs: number; fat: number };
  greeting: string;
  trainingDay: string;
  trainingSubtext: string;
  coachTipTitle: string;
  coachTipBody: string;
};

export default function DashboardPage() {
  const today = new Date();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/briefing")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Profil fehlt" : "Fehler beim Laden");
        return res.json();
      })
      .then((data) => setBriefing(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const todayTrainingLabel = briefing?.trainingDay ?? "—";
  const trainingSubtext = briefing?.trainingSubtext ?? "Fokus auf saubere Ausführung.";
  const greeting = briefing?.greeting ?? "Willkommen zurück.";
  const macros = briefing?.macros ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Daily Briefing
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {loading ? "…" : greeting}
            </h1>
            <p className="text-sm text-white/60">{formatDateGerman(today)}</p>

            {/* Mobile: Wochenbericht & Profil unter der Begrüßung */}
            <div className="flex gap-3 sm:hidden">
              <Link
                href="/report"
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/25 bg-transparent px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Wochenbericht
              </Link>
              <Link
                href="/profil"
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/25 bg-transparent px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Profil
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop: Wochenbericht & Profil oben rechts */}
            <Link
              href="/report"
              className="hidden rounded-full border border-white/25 bg-transparent px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30 sm:inline-flex"
            >
              Wochenbericht
            </Link>
            <Link
              href="/profil"
              className="hidden rounded-full border border-white/25 bg-transparent px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30 sm:inline-flex"
            >
              Profil
            </Link>
            <Link
              href="/checkin"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              Check-in
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9",
                  userButtonPopoverCard: "bg-zinc-900 border border-white/10",
                  userButtonPopoverActionButton: "text-white hover:bg-zinc-800",
                  userButtonPopoverActionButtonText: "text-white",
                  userButtonPopoverFooter: "hidden",
                },
              }}
            />
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {error}. <Link href="/profil" className="underline">Profil prüfen</Link>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
                <div className="h-5 w-32 rounded bg-white/10" />
                <div className="mt-3 h-7 w-40 rounded bg-white/10" />
                <div className="mt-2 h-4 w-full max-w-xs rounded bg-white/5" />
              </section>
              <section className="space-y-3">
                <div className="h-4 w-36 rounded bg-white/10 animate-pulse" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 animate-pulse">
                      <div className="h-3 w-16 rounded bg-white/10" />
                      <div className="mt-2 h-8 w-14 rounded bg-white/10" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <aside>
              <section className="h-48 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
            </aside>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
            {/* Linke Spalte */}
            <div className="space-y-6">
              {/* Heutiger Trainingstag */}
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
                      Heutiger Trainingstag
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {todayTrainingLabel}
                    </p>
                    <p className="mt-1 text-xs text-white/65">
                      {trainingSubtext}
                    </p>
                  </div>
                  <span className="hidden rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 sm:inline-flex">
                    Heute geplant
                  </span>
                </div>
              </section>

              {/* Makro-Cards */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-white/90">
                  Makros für heute
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/45">Kalorien</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {macros.calories}
                      <span className="ml-1 text-xs font-normal text-white/60">kcal</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/45">Protein</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {macros.protein}
                      <span className="ml-1 text-xs font-normal text-white/60">g</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/45">Carbs</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {macros.carbs}
                      <span className="ml-1 text-xs font-normal text-white/60">g</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/45">Fett</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {macros.fat}
                      <span className="ml-1 text-xs font-normal text-white/60">g</span>
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Rechte Spalte: Coach-Tipp */}
            <aside className="space-y-4">
              <section className="h-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/50">
                  Coach-Tipp für heute
                </p>
                <h2 className="mt-2 text-sm font-semibold text-white">
                  {briefing?.coachTipTitle ? `„${briefing.coachTipTitle}"` : "—"}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/75">
                  {briefing?.coachTipBody || "Kein Tipp verfügbar."}
                </p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

