/**
 * Coach-Entscheidungs- und Prioritätssystem.
 * Kontext, Signalerkennung, Scoring, Prioritäten – keine reaktive Antwort, sondern internes Modell.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStravaActivities, type StravaActivity } from "@/lib/strava";

export type Goal = "cut" | "lean-bulk" | "recomp" | "maintain";

const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sitzend: 1.2,
  "leicht-aktiv": 1.375,
  aktiv: 1.55,
};

export function bmr(weightKg: number, heightCm: number, age: number, isFemale: boolean): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (isFemale ? -161 : 5);
}

export function getTargetCaloriesFromTdee(tdee: number, goal: string): number {
  switch (goal) {
    case "lean-bulk":
      return Math.round(tdee + 300);
    case "cut":
      return Math.round(tdee - 400);
    case "recomp":
    case "maintain":
    default:
      return Math.round(tdee);
  }
}

/** Berechnet Kalorien- und Protein-Zielbereich aus Profildaten (für Onboarding & bestehende Nutzer). */
export function getTargetRangeFromProfile(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  isFemale: boolean;
  activityLevel: string;
  goal: string;
}): {
  calorie_target_min: number;
  calorie_target_max: number;
  protein_target_min: number;
  protein_target_max: number;
  explanation: string;
} {
  const tdee = estimateTdee(
    params.weightKg,
    params.heightCm,
    params.age,
    params.isFemale,
    params.activityLevel
  );
  let calMin: number;
  let calMax: number;
  switch (params.goal) {
    case "cut":
      calMin = Math.round(tdee - 400);
      calMax = Math.round(tdee - 200);
      break;
    case "lean-bulk":
      calMin = Math.round(tdee + 200);
      calMax = Math.round(tdee + 400);
      break;
    case "recomp":
    case "maintain":
    default:
      calMin = Math.round(tdee - 100);
      calMax = Math.round(tdee + 100);
  }
  const proteinMin = Math.round(params.weightKg * 1.8);
  const proteinMax = Math.round(params.weightKg * 2.2);
  const goalLabels: Record<string, string> = {
    cut: "Cut (Fett reduzieren)",
    "lean-bulk": "Lean Bulk (Masse aufbauen)",
    recomp: "Recomp",
    maintain: "Maintain",
  };
  const goalLabel = goalLabels[params.goal] ?? params.goal;
  const explanation = `Basierend auf deinem Grundumsatz (BMR), Aktivitätslevel und Ziel „${goalLabel}“: TDEE ca. ${tdee} kcal. Kalorienziel ${calMin}–${calMax} kcal, Protein ${proteinMin}–${proteinMax} g (1,8–2,2 g/kg).`;
  return {
    calorie_target_min: calMin,
    calorie_target_max: calMax,
    protein_target_min: proteinMin,
    protein_target_max: proteinMax,
    explanation,
  };
}

export function getMacrosSimple(
  targetCalories: number,
  weightKg: number,
  goal: string
): { calories: number; protein: number; carbs: number; fat: number } {
  const protein = Math.round(weightKg * 2);
  const fatG = Math.round(weightKg * 0.9);
  const fatCal = fatG * 9;
  const proteinCal = protein * 4;
  const carbCal = Math.max(0, targetCalories - proteinCal - fatCal);
  const carbs = Math.round(carbCal / 4);
  return {
    calories: targetCalories,
    protein,
    carbs,
    fat: fatG,
  };
}

export function estimateTdee(
  weightKg: number,
  heightCm: number,
  age: number,
  isFemale: boolean,
  activityLevel: string
): number {
  const bmrVal = bmr(weightKg, heightCm, age, isFemale);
  const mult = ACTIVITY_MULTIPLIER[activityLevel] ?? 1.2;
  return Math.round(bmrVal * mult);
}

export type CheckinRow = {
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

export type CoachContext = {
  weekday: string;
  weekdayFocus: "training_vorher" | "regeneration" | "planung" | "neutral";
  goal: Goal;
  goalLabel: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  /** Optional: Bereich für Analyse "unter/im/über Ziel" */
  targetCaloriesMin?: number;
  targetCaloriesMax?: number;
  targetProteinMin?: number;
  targetProteinMax?: number;
  trainingDaysPerWeek: number;
  healthOverrideRegeneration: boolean;
  healthOverrideTrainingVolume: boolean;
  userName?: string;
};

export type Signal = {
  type: "weight_trend" | "weight_plateau" | "calories" | "overtraining" | "protein" | "carbs" | "fat" | "energy" | "regeneration";
  label: string;
  intensity: number; // 1-5
  observation: string;
  goalWeight: number; // Multiplikator je nach Ziel
  healthBonus: number; // 0 oder 1
  score: number;
};

export type CoachSignals = {
  checkinCount: number;
  confidence: "low" | "medium" | "high";
  weightTrend: "down" | "up" | "stable" | "plateau" | "unknown";
  weightTrendDays: number;
  signals: Signal[];
  topPriorities: Signal[]; // max 2
  shouldStaySilent: boolean;
  positiveFeedbackOnly: boolean;
};

const WEEKDAY_FOCUS: Record<number, CoachContext["weekdayFocus"]> = {
  1: "planung", // Montag
  2: "training_vorher",
  3: "training_vorher",
  4: "training_vorher",
  5: "training_vorher",
  6: "regeneration",
  0: "planung", // Sonntag
};

export function getCoachContext(
  profile: {
    goal?: string;
    weight?: number;
    training_days_per_week?: number;
    first_name?: string | null;
    calorie_target_min?: number | null;
    calorie_target_max?: number | null;
    protein_target_min?: number | null;
    protein_target_max?: number | null;
  },
  targetCalories: number,
  targets: { protein: number; carbs: number; fat: number; calories?: number }
): CoachContext {
  const goal = (profile.goal === "cut" || profile.goal === "lean-bulk" || profile.goal === "recomp" || profile.goal === "maintain"
    ? profile.goal
    : "maintain") as Goal;
  const goalLabels: Record<Goal, string> = {
    cut: "Cut (Fett reduzieren)",
    "lean-bulk": "Lean Bulk (sauber Masse aufbauen)",
    recomp: "Recomp (Fett verlieren, Muskeln halten/aufbauen)",
    maintain: "Maintain",
  };
  const now = new Date();
  const weekdayNum = now.getDay();
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(now);
  const weekdayFocus = WEEKDAY_FOCUS[weekdayNum] ?? "neutral";

  const calMin = profile.calorie_target_min != null ? profile.calorie_target_min : undefined;
  const calMax = profile.calorie_target_max != null ? profile.calorie_target_max : undefined;
  const proteinMin = profile.protein_target_min != null ? profile.protein_target_min : undefined;
  const proteinMax = profile.protein_target_max != null ? profile.protein_target_max : undefined;
  const effectiveCal = calMin != null && calMax != null ? Math.round((calMin + calMax) / 2) : (targets?.calories ?? targetCalories);
  const effectiveProtein = targets.protein;

  return {
    weekday,
    weekdayFocus,
    goal,
    goalLabel: goalLabels[goal],
    targetCalories: effectiveCal,
    targetProtein: effectiveProtein,
    targetCarbs: targets.carbs,
    targetFat: targets.fat,
    targetCaloriesMin: calMin,
    targetCaloriesMax: calMax,
    targetProteinMin: proteinMin,
    targetProteinMax: proteinMax,
    trainingDaysPerWeek: Number(profile.training_days_per_week) || 4,
    healthOverrideRegeneration: false,
    healthOverrideTrainingVolume: false,
    userName: profile.first_name ?? undefined,
  };
}

export function analyzeSignals(
  checkins: CheckinRow[],
  ctx: CoachContext,
  tdee: number
): CoachSignals {
  const sorted = [...checkins].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const n = sorted.length;

  const confidence: CoachSignals["confidence"] =
    n < 3 ? "low" : n <= 6 ? "medium" : "high";
  const shouldStaySilent = n < 3;
  let positiveFeedbackOnly = n >= 3 && n < 5;

  // Gesundheits-Overrides aus letzten Tagen
  const lowEnergyDays = sorted.filter((c) => c.energy_level <= 2).length;
  const veryLowEnergyLast = sorted.length > 0 && (sorted[sorted.length - 1].energy_level ?? 5) <= 2;
  if (lowEnergyDays >= 2 || veryLowEnergyLast) {
    (ctx as { healthOverrideRegeneration: boolean }).healthOverrideRegeneration = true;
    (ctx as { healthOverrideTrainingVolume: boolean }).healthOverrideTrainingVolume = true;
  }

  const signals: Signal[] = [];
  let weightTrendResult: CoachSignals["weightTrend"] = "unknown";
  let weightTrendDaysResult = 0;

  // Gewichtstrend: ≥3 Tage gleiche Richtung
  if (n >= 3) {
    const weights = sorted.map((c) => c.weight_kg);
    const first3 = weights.slice(0, 3);
    const last3 = weights.slice(-3);
    const trendFirst = first3[2] - first3[0];
    const trendLast = last3[2] - last3[0];
    if (Math.abs(trendLast) >= 0.2) {
      weightTrendResult = trendLast > 0 ? "up" : "down";
      weightTrendDaysResult = 3;
    }
    const plateau =
      n >= 5 &&
      Math.max(...weights) - Math.min(...weights) <= 0.2;
    if (plateau) {
      weightTrendResult = "plateau";
      weightTrendDaysResult = n;
    }

    const goalWeight =
      ctx.goal === "cut" ? (weightTrendResult === "down" ? 0.3 : weightTrendResult === "up" ? 1.5 : 1) :
      ctx.goal === "lean-bulk" ? (weightTrendResult === "up" ? 0.3 : weightTrendResult === "down" ? 1.5 : 1) :
      1;
    if (weightTrendResult !== "unknown" && !plateau) {
      const intensity =
        ctx.goal === "cut" && weightTrendResult === "up" ? 4 :
        ctx.goal === "cut" && weightTrendResult === "down" ? 1 :
        ctx.goal === "lean-bulk" && weightTrendResult === "down" ? 4 :
        ctx.goal === "lean-bulk" && weightTrendResult === "up" ? 1 :
        2;
      signals.push({
        type: "weight_trend",
        label: "Gewichtstrend",
        intensity,
        observation: `Gewicht über ${weightTrendDaysResult} Tage ${weightTrendResult === "up" ? "steigend" : "fallend"} (${last3[0].toFixed(1)} → ${last3[2].toFixed(1)} kg).`,
        goalWeight,
        healthBonus: 0,
        score: Math.round(intensity * goalWeight * 10) / 10,
      });
    }
    if (plateau && ctx.goal !== "maintain") {
      signals.push({
        type: "weight_plateau",
        label: "Gewichts-Plateau",
        intensity: 2,
        observation: `Gewicht stabil über ${n} Tage (±0,2 kg).`,
        goalWeight: 1,
        healthBonus: 0,
        score: 2,
      });
    }
  }

  // Kalorientrend relativ zum Ziel (Bereich oder Einzelwert)
  if (n >= 3) {
    const withCal = sorted.filter((c) => typeof c.calories_intake === "number" && c.calories_intake > 0);
    if (withCal.length >= 3) {
      const avgCal =
        withCal.reduce((a, c) => a + (c.calories_intake ?? 0), 0) / withCal.length;
      const calMin = ctx.targetCaloriesMin;
      const calMax = ctx.targetCaloriesMax;
      const hasRange = calMin != null && calMax != null;
      let observation: string;
      let diff: number;
      if (hasRange) {
        if (avgCal < calMin) {
          observation = `Durchschnitt ${Math.round(avgCal)} kcal. Du bist unter deinem Zielbereich (${calMin}–${calMax} kcal).`;
          diff = avgCal - calMin;
        } else if (avgCal > calMax) {
          observation = `Durchschnitt ${Math.round(avgCal)} kcal. Du bist über deinem Zielbereich (${calMin}–${calMax} kcal).`;
          diff = avgCal - calMax;
        } else {
          observation = `Durchschnitt ${Math.round(avgCal)} kcal. Du bist im Zielbereich (${calMin}–${calMax} kcal).`;
          diff = 0;
        }
      } else {
        diff = avgCal - ctx.targetCalories;
        observation = `Durchschnitt ${Math.round(avgCal)} kcal (Ziel ${ctx.targetCalories}). ${diff > 0 ? "+" : ""}${Math.round(diff)} kcal.`;
      }
      const intensity =
        ctx.goal === "cut" && diff > 200 ? 4 :
        ctx.goal === "cut" && diff > 0 ? 2 :
        ctx.goal === "lean-bulk" && diff < -200 ? 4 :
        ctx.goal === "lean-bulk" && diff < 0 ? 2 :
        Math.abs(diff) > 300 ? 3 : diff === 0 && hasRange ? 0 : 1;
      const goalWeight = ctx.goal === "cut" || ctx.goal === "lean-bulk" ? 1.2 : 1;
      if (intensity > 0 || !hasRange) {
        signals.push({
          type: "calories",
          label: "Kalorien",
          intensity: intensity || 1,
          observation,
          goalWeight,
          healthBonus: 0,
          score: Math.round((intensity || 1) * goalWeight * 10) / 10,
        });
      }
    }
  }

  // Übertraining: 5+ intensive Tage ohne Ruhetag
  if (n >= 5) {
    let consecutiveActive = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const c = sorted[i];
      const isActive = c.trained && c.activity_type && c.activity_type !== "ruhetag";
      if (isActive) consecutiveActive++;
      else break;
    }
    if (consecutiveActive >= 5) {
      const healthBonus = ctx.healthOverrideRegeneration ? 1 : 0;
      signals.push({
        type: "overtraining",
        label: "Aktivität/Regeneration",
        intensity: 4,
        observation: `${consecutiveActive} Tage intensive Aktivität ohne Ruhetag.`,
        goalWeight: 1.2,
        healthBonus,
        score: 4 * 1.2 + healthBonus,
      });
    }
  }

  // Protein: Bereich oder Einzelziel
  if (n >= 3) {
    const withProtein = sorted.filter((c) => typeof c.protein_intake === "number");
    if (withProtein.length >= 3) {
      const pMin = ctx.targetProteinMin ?? ctx.targetProtein - 15;
      const pMax = ctx.targetProteinMax ?? ctx.targetProtein + 15;
      const hasRange = ctx.targetProteinMin != null && ctx.targetProteinMax != null;
      const underTarget = withProtein.filter((c) => (c.protein_intake ?? 0) < pMin);
      const overTarget = hasRange ? withProtein.filter((c) => (c.protein_intake ?? 0) > pMax) : [];
      const avgP = withProtein.reduce((a, c) => a + (c.protein_intake ?? 0), 0) / withProtein.length;
      let observation: string;
      let intensity: number;
      if (underTarget.length >= 3) {
        const deficit = pMin - avgP;
        intensity = deficit > 40 ? 4 : deficit > 25 ? 3 : 2;
        observation = hasRange
          ? `An ${underTarget.length} von ${withProtein.length} Tagen unter Protein-Zielbereich (Ø ${Math.round(avgP)} g, Ziel ${pMin}–${pMax} g).`
          : `An ${underTarget.length} von ${withProtein.length} Tagen unter Protein-Ziel (Ø ${Math.round(avgP)} g, Ziel ${ctx.targetProtein} g).`;
      } else if (hasRange && overTarget.length >= 3) {
        observation = `An ${overTarget.length} von ${withProtein.length} Tagen über Protein-Zielbereich (Ø ${Math.round(avgP)} g, Ziel ${pMin}–${pMax} g).`;
        intensity = 2;
      } else if (underTarget.length > 0 && (hasRange ? avgP < pMin : avgP < ctx.targetProtein - 15)) {
        const deficit = (hasRange ? pMin : ctx.targetProtein) - avgP;
        intensity = deficit > 40 ? 4 : deficit > 25 ? 3 : 2;
        observation = hasRange
          ? `Ø ${Math.round(avgP)} g Protein. Du bist unter deinem Zielbereich (${pMin}–${pMax} g).`
          : `An ${underTarget.length} von ${withProtein.length} Tagen unter Protein-Ziel (Ø ${Math.round(avgP)} g, Ziel ${ctx.targetProtein} g).`;
      } else {
        observation = hasRange
          ? `Ø ${Math.round(avgP)} g Protein. Du bist im Zielbereich (${pMin}–${pMax} g).`
          : `An ${underTarget.length} von ${withProtein.length} Tagen unter Protein-Ziel (Ø ${Math.round(avgP)} g, Ziel ${ctx.targetProtein} g).`;
        intensity = 0;
      }
      if (intensity > 0) {
        const goalWeight = ctx.goal === "cut" || ctx.goal === "recomp" ? 1.3 : 1.1;
        signals.push({
          type: "protein",
          label: "Protein",
          intensity,
          observation,
          goalWeight,
          healthBonus: 0,
          score: Math.round(intensity * goalWeight * 10) / 10,
        });
      }
    }
  }

  // Niedrige Energie über mehrere Tage
  if (n >= 3 && ctx.healthOverrideTrainingVolume) {
    const lowEnergy = sorted.filter((c) => c.energy_level <= 2).length;
    if (lowEnergy >= 2) {
      signals.push({
        type: "energy",
        label: "Energie",
        intensity: 3,
        observation: `An ${lowEnergy} Tagen Energie ≤2/5.`,
        goalWeight: 1,
        healthBonus: 1,
        score: 4,
      });
    }
  }

  // Scores sortieren, nur Top 2
  signals.forEach((s) => {
    s.score = Math.round((s.intensity * s.goalWeight + s.healthBonus) * 10) / 10;
  });
  const byScore = [...signals].sort((a, b) => b.score - a.score);
  const topPriorities = byScore.slice(0, 2);

  if (topPriorities.length === 0 || topPriorities.every((p) => p.score < 1.5)) {
    positiveFeedbackOnly = true;
  }

  return {
    checkinCount: n,
    confidence,
    weightTrend: weightTrendResult,
    weightTrendDays: weightTrendDaysResult,
    signals,
    topPriorities,
    shouldStaySilent,
    positiveFeedbackOnly,
  };
}

/** Erzeugt die strukturierte Analyse-Anweisung für die LLM (Briefing). */
export function buildAnalysisInstructions(
  ctx: CoachContext,
  signals: CoachSignals,
  checkinsSummary: string
): string {
  const { topPriorities, shouldStaySilent, positiveFeedbackOnly, confidence } = signals;
  const name = ctx.userName ? ` ${ctx.userName}` : "";

  if (shouldStaySilent) {
    return `Weniger als 3 Check-in-Tage. Gib nur eine sehr kurze, ehrliche Beobachtung ohne Empfehlungen. Maximal 1-2 Sätze. Keine Hypothesen.`;
  }

  if (positiveFeedbackOnly && topPriorities.length === 0) {
    return `Alle Daten innerhalb normaler Schwankungen. Gib ein kurzes, ehrliches Lob (1-2 Sätze). Kein generischer Text. Keine unnötige Analyse.`;
  }

  const priorityText =
    topPriorities.length === 0
      ? ""
      : topPriorities
          .map(
            (p, i) =>
              `${i + 1}. ${p.label} (Score ${p.score}): ${p.observation} → Kontext: ${ctx.goalLabel}. Struktur: Beobachtung → Interpretation (Zielbezug) → Eine klare Handlungsempfehlung (messbar, z.B. "+30g Protein heute").`
          )
          .join("\n");

  const calTarget =
    ctx.targetCaloriesMin != null && ctx.targetCaloriesMax != null
      ? `${ctx.targetCaloriesMin}–${ctx.targetCaloriesMax} kcal`
      : `${ctx.targetCalories} kcal`;
  const proteinTarget =
    ctx.targetProteinMin != null && ctx.targetProteinMax != null
      ? `${ctx.targetProteinMin}–${ctx.targetProteinMax} g`
      : `${ctx.targetProtein} g`;
  return `Kontext: Heute ist ${ctx.weekday} (Fokus: ${ctx.weekdayFocus}). Ziel: ${ctx.goalLabel}.
Zielwerte: ${calTarget} Kalorien, ${proteinTarget} Protein, ${ctx.targetCarbs} g Carbs, ${ctx.targetFat} g Fett.
Konfidenz: ${confidence} (${signals.checkinCount} Check-ins).

Prioritäten (nur diese kommentieren, max. 2 Themen):
${priorityText || "Keine hohen Scores – kurzes positives Feedback, keine generische Analyse."}

Regeln:
- Jeder Punkt: 1. Beobachtung (konkrete Daten), 2. Interpretation (Zielbezug), 3. Eine Handlungsempfehlung (messbar, umsetzbar heute).
- Sprich${name} mit Namen an.
- Maximal 3-4 Sätze pro Punkt. Präzise, kein Fülltext.
- Auf Deutsch.
- Keine generischen Ratschläge ohne Datenbasis.`;
}

export type CoachMemory = {
  memory: string;
  category: string | null;
  created_at?: string;
};

/** Lädt die letzten Memories für einen Nutzer aus Supabase (chronologisch für den Prompt). */
export async function getCoachMemories(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<CoachMemory[]> {
  const { data } = await supabase
    .from("coach_memories")
    .select("memory, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as { memory: string; category: string | null; created_at: string }[];
  return [...rows].reverse().map((m) => ({
    memory: m.memory,
    category: m.category,
    created_at: m.created_at,
  }));
}

/** Formatiert Memories für den System-Prompt. Coach soll sich aktiv darauf beziehen (z. B. "Du hast mal gesagt, …", bei Trainingsplan "Laut deinem Plan …"). */
export function formatMemoriesForPrompt(memories: CoachMemory[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- [${m.category || "Sonstiges"}] ${m.memory}`).join("\n");
  return `\n## Gedächtnis (bereits gespeichert – beziehe dich aktiv darauf; frage nicht erneut danach. z. B. "Du hast mal gesagt, …" / "Laut deinem Plan …")\n${lines}\n`;
}

/** Formatiert Strava-Aktivitäten der letzten 30 Tage für den Coach-Kontext (Trainingsmuster, Belastung, Fortschritt). */
export function formatStravaActivitiesForPrompt(activities: StravaActivity[]): string {
  if (activities.length === 0) return "";
  const lines = activities.slice(0, 50).map((a) => {
    const date = a.start_date.slice(0, 10);
    const min = Math.round((a.moving_time || a.elapsed_time || 0) / 60);
    const km = a.distance ? (a.distance / 1000).toFixed(1) : "–";
    const hr = a.average_heartrate != null ? `${a.average_heartrate} Ø HF` : "";
    const kcal = a.kilojoules != null ? `${Math.round(a.kilojoules / 4.184)} kcal` : a.calories != null ? `${a.calories} kcal` : "";
    const parts = [date, a.type, a.name, `${min} min`, `${km} km`, a.total_elevation_gain ? `${Math.round(a.total_elevation_gain)} m ↑` : "", hr, kcal].filter(Boolean);
    return `- ${parts.join(" · ")}`;
  });
  return `\n## Strava Aktivitäten des Nutzers (letzte 30 Tage – Workouts, Belastung, Fortschritt)\n${lines.join("\n")}\n`;
}

/** Lädt Strava-Aktivitäten (Token aus Supabase, ggf. erneuert) und gibt formatierten Block + Anzahl für den Coach-Kontext zurück. */
export async function getStravaSummaryForCoach(
  supabase: SupabaseClient,
  userId: string
): Promise<{ summary: string; count: number }> {
  const activities = await getStravaActivities(supabase, userId);
  return {
    summary: formatStravaActivitiesForPrompt(activities),
    count: activities.length,
  };
}

/** Erzeugt die System-Prompt-Bausteine für den Chat (Dual-Mode + Analyse). */
export function buildChatCoachContextBlock(
  ctx: CoachContext,
  signals: CoachSignals,
  checkinsSummary: string,
  memories: CoachMemory[] = [],
  stravaSummary = ""
): string {
  const { topPriorities, shouldStaySilent } = signals;

  const calTarget =
    ctx.targetCaloriesMin != null && ctx.targetCaloriesMax != null
      ? `${ctx.targetCaloriesMin}–${ctx.targetCaloriesMax} kcal`
      : `${ctx.targetCalories} kcal`;
  const proteinTarget =
    ctx.targetProteinMin != null && ctx.targetProteinMax != null
      ? `${ctx.targetProteinMin}–${ctx.targetProteinMax} g`
      : `${ctx.targetProtein} g`;
  let block = `## Kontext
- Wochentag: ${ctx.weekday} (Fokus: ${ctx.weekdayFocus})
- Ziel: ${ctx.goalLabel}
- Zielwerte: ${calTarget} Kalorien, ${proteinTarget} Protein
- Check-ins (letzte 7): ${signals.checkinCount} vorhanden. Konfidenz: ${signals.confidence}
${checkinsSummary ? `\nCheck-in-Daten:\n${checkinsSummary}` : ""}
`;

  if (stravaSummary) {
    block += stravaSummary;
  }

  if (memories.length > 0) {
    block += formatMemoriesForPrompt(memories);
  }

  if (!shouldStaySilent && topPriorities.length > 0) {
    block += `\n## Prioritäten (nur im Analyse-Modus nutzen, max. 2 Themen)\n`;
    topPriorities.forEach((p, i) => {
      block += `${i + 1}. ${p.label}: ${p.observation} (Score ${p.score})\n`;
    });
  }

  return block;
}
