"use client";

import Link from "next/link";

export default function WeeklyReportPage() {
  const currentWeekLabel = "KW 12 · Beispielwoche";

  // Beispielwerte – später dynamisch aus echten Daten
  const weightDelta = "+0,3 kg";
  const weightNote = "im Schnitt gegenüber letzter Woche";
  const trainingsDone = 4;
  const trainingsPlanned = 5;
  const avgEnergy = 3.8;
  const avgHunger = 2.4;

  const nextWeekMacros = {
    calories: 2850,
    protein: 185,
    carbs: 305,
    fat: 72,
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Wöchentlicher Report
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Deine Woche im Überblick
            </h1>
            <p className="text-sm text-white/60">{currentWeekLabel}</p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            Zurück zum Dashboard
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.7fr,1.3fr]">
          {/* Linke Spalte: Kennzahlen */}
          <section className="space-y-6">
            {/* Gewichtstrend und Training */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Gewichtstrend
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {weightDelta}
                </p>
                <p className="mt-1 text-xs text-white/65">{weightNote}</p>
                <p className="mt-3 text-[11px] text-white/40">
                  Später siehst du hier eine kleine Grafik mit deinem Wochenverlauf.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Trainings absolviert
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {trainingsDone}
                  <span className="ml-1 text-sm font-normal text-white/65">
                    von {trainingsPlanned}
                  </span>
                </p>
                <p className="mt-1 text-xs text-white/65">
                  Solide Woche – 80 % Zielerreichung.
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${(trainingsDone / trainingsPlanned) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Durchschnittswerte Energie & Hunger */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-white/45">
                    Durchschnitt Energie &amp; Hunger
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    Werte basieren auf deinen täglichen Check-ins.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-white/80">
                    Energie
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {avgEnergy.toFixed(1)}
                    <span className="ml-1 text-xs font-normal text-white/60">
                      / 5
                    </span>
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-sky-400"
                      style={{ width: `${(avgEnergy / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-white/80">
                    Hunger
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {avgHunger.toFixed(1)}
                    <span className="ml-1 text-xs font-normal text-white/60">
                      / 5
                    </span>
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${(avgHunger / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Rechte Spalte: Coach-Analyse + neue Makros */}
          <section className="space-y-5">
            {/* Coach-Analyse */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/50">
                Coach-Analyse
              </p>
              <h2 className="mt-2 text-sm font-semibold text-white">
                „Du baust kontrolliert auf – genau so soll es aussehen.“
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                Dein Gewicht steigt langsam, aber stetig – das ist ideal für
                einen Lean Bulk. Deine Energie liegt im oberen Mittelfeld und
                der Hunger ist moderat, was zeigt, dass die aktuelle
                Kalorienmenge gut zu dir passt. Die 4 von 5 absolvierten
                Trainings sind solide – nächste Woche peilen wir an, möglichst
                alle geplanten Sessions mitzunehmen.
              </p>
              <p className="mt-3 text-xs text-white/45">
                In der echten Version würde diese Analyse dynamisch aus deinen
                Check-ins, Workouts und Trends generiert werden.
              </p>
            </div>

            {/* Neue Makros */}
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-100">
                Neue Makros für nächste Woche
              </p>
              <p className="mt-2 text-sm text-emerald-50">
                Leichte Anpassung nach oben, um den Progress beizubehalten.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-300/40 bg-emerald-300/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/80">
                    Kalorien
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-50">
                    {nextWeekMacros.calories}
                    <span className="ml-1 text-xs font-normal text-emerald-100/80">
                      kcal
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-300/40 bg-emerald-300/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/80">
                    Protein
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-50">
                    {nextWeekMacros.protein}
                    <span className="ml-1 text-xs font-normal text-emerald-100/80">
                      g
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-300/40 bg-emerald-300/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/80">
                    Carbs
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-50">
                    {nextWeekMacros.carbs}
                    <span className="ml-1 text-xs font-normal text-emerald-100/80">
                      g
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-300/40 bg-emerald-300/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/80">
                    Fett
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-50">
                    {nextWeekMacros.fat}
                    <span className="ml-1 text-xs font-normal text-emerald-100/80">
                      g
                    </span>
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-emerald-100/80">
                Später kannst du hier bestätigen, ob du diese Makros übernehmen
                möchtest oder lieber konservativ bleibst.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

