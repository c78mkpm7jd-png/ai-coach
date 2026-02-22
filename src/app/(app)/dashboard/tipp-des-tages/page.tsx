"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type TipData = {
  coachTipTitle: string;
  coachTipBody: string;
};

export default function TippDesTagesPage() {
  const [data, setData] = useState<TipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    fetch("/api/briefing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData({ coachTipTitle: d.coachTipTitle, coachTipBody: d.coachTipBody }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const refresh = () => {
    setRefreshing(true);
    fetch("/api/briefing?only=tip")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData({ coachTipTitle: d.coachTipTitle, coachTipBody: d.coachTipBody }))
      .finally(() => setRefreshing(false));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-6 h-48 animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-white">Tipp des Tages</h1>
      <p className="mt-1 text-sm text-white/60">Dein täglicher Coach-Tipp</p>

      <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-white/50">Tipp des Tages</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Neuen Tipp laden"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        {data?.coachTipTitle && (
          <p className="mt-3 text-base font-semibold text-white">„{data.coachTipTitle}"</p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          {data?.coachTipBody || "Kein Tipp geladen."}
        </p>
      </section>
    </div>
  );
}
