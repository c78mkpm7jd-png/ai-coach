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
  activity_calories_burned?: number | null;
  calories_intake?: number | null;
};

const COLORS = { Verbrauch: "#34d399", Aufnahme: "#a78bfa" };

export default function KalorienPage() {
  const [checkins, setCheckins] = useState<Row[]>([]);
  const [calorieTip, setCalorieTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipLoading, setTipLoading] = useState(false);

  useEffect(() => {
    fetch("/api/checkin?limit=31")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setCheckins((d?.data ?? []).slice().reverse()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadTip = () => {
    setTipLoading(true);
    fetch("/api/tips?type=calories")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCalorieTip(d.tip))
      .catch(() => {})
      .finally(() => setTipLoading(false));
  };

  const last7 = useMemo(() => checkins.slice(-7), [checkins]);
  const data = useMemo(
    () =>
      last7.map((c) => ({
        date: toDateKey(c.created_at),
        Verbrauch: c.activity_calories_burned ?? 0,
        Aufnahme: c.calories_intake ?? 0,
      })),
    [last7]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-white/10" />
        <div className="mt-6 h-24 animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-white">Kalorien</h1>
      <p className="mt-1 text-sm text-white/60">Verbrauch vs. Aufnahme (letzte 7 Tage)</p>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Verlauf</p>
        <div className="mt-4 h-56">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Legend />
                <Line type="monotone" dataKey="Verbrauch" stroke={COLORS.Verbrauch} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Aufnahme" stroke={COLORS.Aufnahme} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-white/40">Noch keine Daten</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Coach-Tipp zu deinen Kaloriendaten</p>
        {calorieTip ? (
          <p className="mt-2 text-sm leading-relaxed text-white/80">{calorieTip}</p>
        ) : (
          <button
            type="button"
            onClick={loadTip}
            disabled={tipLoading}
            className="mt-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            {tipLoading ? "Lade …" : "Tipp generieren"}
          </button>
        )}
      </div>
    </div>
  );
}
