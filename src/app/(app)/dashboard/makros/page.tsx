"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function toDateKey(s: string) {
  return s.slice(0, 10);
}

type Row = {
  created_at: string;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

const COLORS = { Protein: "#f472b6", Carbs: "#fbbf24", Fett: "#60a5fa" };

export default function MakrosPage() {
  const [checkins, setCheckins] = useState<Row[]>([]);
  const [macroTip, setMacroTip] = useState<string | null>(null);
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
    fetch("/api/tips?type=makros")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMacroTip(d.tip))
      .catch(() => {})
      .finally(() => setTipLoading(false));
  };

  const last7 = useMemo(() => checkins.slice(-7), [checkins]);
  const lineData = useMemo(
    () =>
      last7.map((c) => ({
        date: toDateKey(c.created_at).slice(5),
        Protein: c.protein_intake ?? 0,
        Carbs: c.carbs_intake ?? 0,
        Fett: c.fat_intake ?? 0,
      })),
    [last7]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
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
      <h1 className="mt-6 text-2xl font-semibold text-white">Makros</h1>
      <p className="mt-1 text-sm text-white/60">Verlauf der letzten 7 Tage</p>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Protein, Carbs, Fett (g)</p>
        <div className="mt-4 h-56">
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Legend />
                <Line type="monotone" dataKey="Protein" stroke={COLORS.Protein} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Carbs" stroke={COLORS.Carbs} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Fett" stroke={COLORS.Fett} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-white/40">Noch keine Daten</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">Coach-Tipp zu deinen Makros</p>
        {macroTip ? (
          <p className="mt-2 text-sm leading-relaxed text-white/80">{macroTip}</p>
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
