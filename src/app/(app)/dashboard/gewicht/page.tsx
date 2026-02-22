"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function toDateKey(s: string) {
  return s.slice(0, 10);
}

type Row = { created_at: string; weight_kg: number };

export default function GewichtPage() {
  const [checkins, setCheckins] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/checkin?limit=31")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setCheckins((d?.data ?? []).slice().reverse()))
      .finally(() => setLoading(false));
  }, []);

  const last7 = useMemo(() => checkins.slice(-7), [checkins]);
  const data = useMemo(
    () => last7.map((c) => ({ date: toDateKey(c.created_at), kg: c.weight_kg })),
    [last7]
  );
  const current = last7.length ? last7[last7.length - 1].weight_kg : null;
  const trend = last7.length >= 2 ? last7[last7.length - 1].weight_kg - last7[last7.length - 2].weight_kg : null;

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-white">Gewicht</h1>
      <p className="mt-1 text-sm text-white/60">Verlauf & Trend</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Aktuell</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {current != null ? `${current} kg` : "—"}
          </p>
          {trend != null && trend !== 0 && (
            <p className={`mt-1 text-sm ${trend > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)} kg zur Vorwoche
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Verlauf (letzte Einträge)</p>
        <div className="mt-4 h-56">
          {data.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" unit=" kg" />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Line type="monotone" dataKey="kg" stroke="#a78bfa" strokeWidth={2} dot={{ r: 4 }} name="Gewicht" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-white/40">Mind. 2 Einträge für Verlauf nötig.</p>
          )}
        </div>
      </div>
    </div>
  );
}
