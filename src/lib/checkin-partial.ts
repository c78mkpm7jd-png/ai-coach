/**
 * Gemeinsame Logik für Check-in Partial Save und heutigen Status.
 * Wird von api/checkin-chat und api/chat genutzt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CheckinRow = {
  id?: string;
  created_at: string;
  weight_kg?: number | null;
  hunger_level?: number | null;
  energy_level?: number | null;
  trained?: boolean | null;
  activity_type?: string | null;
  activity_duration_min?: number | null;
  activity_calories_burned?: number | null;
  calories_intake?: number | null;
  protein_intake?: number | null;
  carbs_intake?: number | null;
  fat_intake?: number | null;
};

export type CheckinPartialBody = {
  weight_kg?: unknown;
  hunger_level?: unknown;
  energy_level?: unknown;
  trained?: unknown;
  activity_type?: unknown;
  activity_duration_min?: unknown;
  activity_calories_burned?: unknown;
  calories_intake?: unknown;
  protein_intake?: unknown;
  carbs_intake?: unknown;
  fat_intake?: unknown;
};

export function getTodayBoundsUTC(): { start: string; end: string; dateStr: string } {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const start = `${dateStr}T00:00:00.000Z`;
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);
  const endStr = end.toISOString().slice(0, 10) + "T00:00:00.000Z";
  return { start, end: endStr, dateStr };
}

/** Vollständig = alle Pflichtfelder gesetzt: Gewicht, Kalorien, Makros, Energie, Hunger */
export function isCheckinComplete(c: CheckinRow | null): boolean {
  if (!c) return false;
  return (
    c.weight_kg != null &&
    c.calories_intake != null &&
    c.protein_intake != null &&
    c.carbs_intake != null &&
    c.fat_intake != null &&
    c.energy_level != null &&
    c.hunger_level != null
  );
}

export function getMissingFields(c: CheckinRow): string[] {
  const missing: string[] = [];
  if (c.weight_kg == null) missing.push("weight_kg");
  if (c.hunger_level == null) missing.push("hunger_level");
  if (c.energy_level == null) missing.push("energy_level");
  if (c.trained == null) missing.push("trained");
  if (c.calories_intake == null) missing.push("calories_intake");
  if (c.protein_intake == null) missing.push("protein_intake");
  if (c.carbs_intake == null) missing.push("carbs_intake");
  if (c.fat_intake == null) missing.push("fat_intake");
  return missing;
}

/** Heutigen Check-in laden (UTC-Tag). */
export async function getTodayCheckin(
  supabase: SupabaseClient,
  userId: string
): Promise<CheckinRow | null> {
  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC();
  const { data } = await supabase
    .from("daily_checkins")
    .select("id, created_at, weight_kg, hunger_level, energy_level, trained, activity_type, activity_duration_min, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake")
    .eq("user_id", userId)
    .gte("created_at", todayStart)
    .lt("created_at", todayEnd)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as CheckinRow | null;
}

const toNum = (v: unknown): number | null =>
  v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;
const toBool = (v: unknown): boolean =>
  v === true || v === "true" || String(v).toLowerCase() === "ja" || v === 1;

/**
 * Partial Save: übergebene Felder für heute speichern (Update oder Insert).
 * Wirft bei DB-Fehler.
 */
export async function saveCheckinPartial(
  supabase: SupabaseClient,
  userId: string,
  body: CheckinPartialBody
): Promise<void> {
  const {
    weight_kg,
    hunger_level,
    energy_level,
    trained,
    activity_type,
    activity_duration_min,
    activity_calories_burned,
    calories_intake,
    protein_intake,
    carbs_intake,
    fat_intake,
  } = body;

  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC();

  const existing = await supabase
    .from("daily_checkins")
    .select("id, weight_kg, hunger_level, energy_level, trained, activity_type, activity_duration_min, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake")
    .eq("user_id", userId)
    .gte("created_at", todayStart)
    .lt("created_at", todayEnd)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data) {
    const row = existing.data as Record<string, unknown>;
    const updatePayload = {
      weight_kg: weight_kg != null ? toNum(weight_kg) : row.weight_kg,
      hunger_level: hunger_level != null ? toNum(hunger_level) : row.hunger_level,
      energy_level: energy_level != null ? toNum(energy_level) : row.energy_level,
      trained: trained != null ? toBool(trained) : row.trained,
      activity_type: activity_type != null ? String(activity_type) : row.activity_type,
      activity_duration_min: activity_duration_min != null ? toNum(activity_duration_min) : row.activity_duration_min,
      activity_calories_burned: activity_calories_burned != null ? toNum(activity_calories_burned) : row.activity_calories_burned,
      calories_intake: calories_intake != null ? toNum(calories_intake) : row.calories_intake,
      protein_intake: protein_intake != null ? toNum(protein_intake) : row.protein_intake,
      carbs_intake: carbs_intake != null ? toNum(carbs_intake) : row.carbs_intake,
      fat_intake: fat_intake != null ? toNum(fat_intake) : row.fat_intake,
    };
    const { error } = await supabase
      .from("daily_checkins")
      .update(updatePayload)
      .eq("id", existing.data.id);
    if (error) throw new Error(error.message);
  } else {
    const payload: Record<string, unknown> = {
      user_id: userId,
      weight_kg: toNum(weight_kg),
      hunger_level: toNum(hunger_level),
      energy_level: toNum(energy_level),
      trained: trained != null ? toBool(trained) : false,
      activity_type: activity_type != null ? String(activity_type) : "ruhetag",
      activity_duration_min: toNum(activity_duration_min),
      activity_calories_burned: toNum(activity_calories_burned),
      calories_intake: toNum(calories_intake),
      protein_intake: toNum(protein_intake),
      carbs_intake: toNum(carbs_intake),
      fat_intake: toNum(fat_intake),
    };
    const { error } = await supabase.from("daily_checkins").insert(payload);
    if (error) throw new Error(error.message);
  }
}
