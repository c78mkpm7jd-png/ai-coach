import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <div className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
              AI Fitness Coach
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Trainiere smarter. Konsequent. Ohne Raten.
            </h1>

            <p className="max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
              Dein minimalistischer AI Fitness Coach: maßgeschneiderte Workouts,
              klare Progression und Fokus auf das, was zählt — Woche für Woche.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Jetzt starten
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-transparent px-6 py-3 text-sm font-medium text-white/90 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                Mehr erfahren
              </a>
            </div>
          </div>

          <section id="features" className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-medium">Plan in 60 Sekunden</div>
              <div className="mt-2 text-sm leading-relaxed text-white/70">
                Ziel, Equipment und Zeitfenster wählen — fertig.
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-medium">Progression, die passt</div>
              <div className="mt-2 text-sm leading-relaxed text-white/70">
                Steigere dich sinnvoll statt zufällig — mit klaren Next Steps.
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-medium">Minimaler Overhead</div>
              <div className="mt-2 text-sm leading-relaxed text-white/70">
                Weniger Menü-Klicks, mehr Training. Alles auf einen Blick.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}