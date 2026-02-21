"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

const GOALS = [
  { id: "lean-bulk", label: "Lean Bulk", description: "Sauber Muskelmasse aufbauen mit minimalem Fettzuwachs." },
  { id: "cut", label: "Cut", description: "Körperfett reduzieren bei maximalem Muskelerhalt." },
  { id: "recomp", label: "Recomp", description: "Gleichzeitig etwas Fett verlieren und Muskulatur aufbauen." },
  { id: "maintain", label: "Maintain", description: "Form halten, Performance steigern und Struktur behalten." },
];

const TRAINING_DAYS = [3, 4, 5, 6];

const ACTIVITY_LEVELS = [
  { id: "sitzend", label: "Sitzend", description: "Bürojob, kaum Bewegung im Alltag." },
  { id: "leicht-aktiv", label: "Leicht aktiv", description: "Viel stehen/gehen, kurze Wege zu Fuß." },
  { id: "aktiv", label: "Aktiv", description: "Körperliche Arbeit oder viele aktive Hobbys." },
];

type Profile = {
  id?: string;
  goal: string;
  age: number;
  gender: string;
  height: number;
  weight: number;
  activity_level: string;
  training_days_per_week: number;
};

type Checkin = {
  id: string;
  created_at: string;
  weight_kg: number;
  hunger_level: number;
  energy_level: number;
  trained: boolean;
  activity_type?: string | null;
  activity_duration_min?: number | null;
  activity_calories_burned?: number | null;
  calories_intake?: number | null;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

const ACTIVITY_LABELS: Record<string, string> = {
  ruhetag: "Ruhetag",
  krafttraining: "Krafttraining",
  laufen: "Laufen",
  radfahren: "Radfahren",
  schwimmen: "Schwimmen",
  hiit: "HIIT",
  yoga: "Yoga",
};

export default function ProfilPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"m" | "w" | "divers" | "">("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  function loadCheckins() {
    if (!user) return;
    setCheckinsLoading(true);
    fetch("/api/checkin")
      .then((res) => res.json())
      .then((json) => setCheckins(json.data ?? []))
      .catch(() => setCheckins([]))
      .finally(() => setCheckinsLoading(false));
  }

  useEffect(() => {
    if (!user) return;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          const p = json.data as Profile;
          setGoal(p.goal || "");
          setAge(String(p.age ?? ""));
          setGender((p.gender as "m" | "w" | "divers") || "");
          setHeight(String(p.height ?? ""));
          setWeight(String(p.weight ?? ""));
          setActivity(p.activity_level || "");
          setDaysPerWeek(p.training_days_per_week ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadCheckins();
  }, [user]);

  const isValid =
    !!goal && !!age && !!gender && !!height && !!weight && !!activity && daysPerWeek != null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid || !user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          age: parseInt(age, 10),
          gender,
          height: parseInt(height, 10),
          weight: parseFloat(weight),
          activity_level: activity,
          training_days_per_week: daysPerWeek,
          updated_at: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler beim Speichern");
      alert("Profil gespeichert.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCheckin(createdAt: string) {
    const dateStr = createdAt.slice(0, 10);
    setDeletingDate(dateStr);
    try {
      const res = await fetch(`/api/checkin?date=${encodeURIComponent(dateStr)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler beim Löschen");
      setCheckins((prev) => prev.filter((c) => c.created_at.slice(0, 10) !== dateStr));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Löschen.");
    } finally {
      setDeletingDate(null);
    }
  }

  function formatCheckinDate(iso: string) {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-white/60">Lade Profil …</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-white/50 hover:text-white/80">
          ← Zurück zum Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dein Profil</h1>
      <p className="mt-2 text-sm text-white/70">
        Passe deine Ziele und Körperdaten an.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Ziel */}
        <section>
          <h2 className="text-sm font-semibold text-white/90 mb-3">Ziel</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoal(g.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  goal === g.id
                    ? "border-white bg-white text-zinc-950"
                    : "border-white/10 bg-white/5 text-white/90 hover:border-white/30"
                }`}
              >
                <span className="font-medium">{g.label}</span>
                <p className={`mt-1 text-xs ${goal === g.id ? "text-zinc-700" : "text-white/70"}`}>
                  {g.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Körper */}
        <section>
          <h2 className="text-sm font-semibold text-white/90 mb-3">Körperdaten</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-white/70">Alter</label>
              <input
                type="number"
                min={10}
                max={90}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-white/70">Geschlecht</label>
              <div className="mt-2 flex gap-2">
                {[
                  { id: "m", label: "Männlich" },
                  { id: "w", label: "Weiblich" },
                  { id: "divers", label: "Divers" },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setGender(o.id as "m" | "w" | "divers")}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                      gender === o.id
                        ? "border-white bg-white text-zinc-950"
                        : "border-white/15 bg-zinc-900 text-white/80 hover:border-white/40"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/70">Größe (cm)</label>
              <input
                type="number"
                min={120}
                max={230}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-white/70">Gewicht (kg)</label>
              <input
                type="number"
                min={40}
                max={200}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>
        </section>

        {/* Training & Aktivität */}
        <section>
          <h2 className="text-sm font-semibold text-white/90 mb-3">Training & Alltag</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="text-xs text-white/70">Trainingstage pro Woche</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TRAINING_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysPerWeek(d)}
                    className={`rounded-full px-4 py-2 text-sm font-medium border ${
                      daysPerWeek === d
                        ? "border-white bg-white text-zinc-950"
                        : "border-white/15 bg-zinc-900 text-white/85 hover:border-white/40"
                    }`}
                  >
                    {d}x / Woche
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/70">Aktivitätslevel</label>
              <div className="mt-2 space-y-2">
                {ACTIVITY_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setActivity(l.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                      activity === l.id
                        ? "border-white bg-white text-zinc-950"
                        : "border-white/15 bg-zinc-900 text-white/90 hover:border-white/40"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4">
          <p className="text-xs text-white/50">
            Änderungen werden in deinem Profil gespeichert.
          </p>
          <button
            type="submit"
            disabled={!isValid || saving}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-zinc-950 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Wird gespeichert …" : "Speichern"}
          </button>
        </div>
      </form>

      {/* Meine Check-ins */}
      <section className="mt-12 border-t border-white/10 pt-10">
        <h2 className="text-lg font-semibold text-white/90 mb-4">Meine Check-ins</h2>
        {checkinsLoading ? (
          <p className="text-sm text-white/50">Lade Check-ins …</p>
        ) : checkins.length === 0 ? (
          <p className="text-sm text-white/50">Noch keine Check-ins.</p>
        ) : (
          <ul className="space-y-3">
            {checkins.map((c) => {
              const dateStr = c.created_at.slice(0, 10);
              const isDeleting = deletingDate === dateStr;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-white/90 font-medium">{formatCheckinDate(c.created_at)}</span>
                    <span className="text-white/70">{c.weight_kg} kg</span>
                    <span className="text-white/70">Hunger: {c.hunger_level}/5</span>
                    <span className="text-white/70">Energie: {c.energy_level}/5</span>
                    <span className="text-white/70">Training: {c.trained ? "Ja" : "Nein"}</span>
                    {c.activity_type && c.activity_type !== "ruhetag" && (
                      <>
                        <span className="text-white/70">{ACTIVITY_LABELS[c.activity_type] ?? c.activity_type}</span>
                        {c.activity_duration_min != null && <span className="text-white/70">{c.activity_duration_min} min</span>}
                        {c.activity_calories_burned != null && <span className="text-white/70">{c.activity_calories_burned} kcal</span>}
                      </>
                    )}
                    {(c.calories_intake != null || c.protein_intake != null) && (
                      <span className="text-white/60">
                        {c.calories_intake != null && `${c.calories_intake} kcal`}
                        {c.protein_intake != null && ` · ${c.protein_intake}g P`}
                        {c.carbs_intake != null && ` · ${c.carbs_intake}g C`}
                        {c.fat_intake != null && ` · ${c.fat_intake}g F`}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCheckin(c.created_at)}
                    disabled={isDeleting}
                    className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-400/20 disabled:opacity-50"
                  >
                    {isDeleting ? "Wird gelöscht …" : "Löschen"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
