"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Profile = {
  strava_connected?: boolean | null;
};

export default function EinstellungenPage() {
  const [loading, setLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json) => {
        const p = (json.data ?? {}) as Profile;
        setStravaConnected(!!p.strava_connected);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const status = searchParams.get("strava");
    if (status === "connected") setStravaConnected(true);
    if (status === "denied" || status === "error") setStravaConnected(false);
  }, [searchParams]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/strava/disconnect", { method: "POST" });
      if (res.ok) setStravaConnected(false);
      else alert("Verbindung konnte nicht getrennt werden.");
    } catch {
      alert("Fehler beim Trennen.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-white/60">Lade Einstellungen …</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-white/50 hover:text-white/80">
          ← Zurück zum Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Einstellungen</h1>
      <p className="mt-2 text-sm text-white/70">
        Verbindungen und App-Einstellungen.
      </p>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white/90">Strava</h2>
        <p className="mt-1 text-sm text-white/60">
          Verbinde dein Strava-Konto, damit der Coach deine Aktivitäten (Laufen, Radfahren, etc.) kennt und in Analysen einbeziehen kann.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {stravaConnected ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1.5 text-sm text-green-300">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                Verbunden
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-400/20 disabled:opacity-50"
              >
                {disconnecting ? "Wird getrennt …" : "Verbindung trennen"}
              </button>
            </>
          ) : (
            <a
              href="/api/strava/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L8.318 0H0l5.379 10.345z" />
              </svg>
              Strava verbinden
            </a>
          )}
        </div>
      </section>

      <p className="mt-8 text-xs text-white/40">
        <Link href="/profil" className="underline hover:text-white/60">Profil & Ziele</Link> anpassen.
      </p>
    </div>
  );
}
