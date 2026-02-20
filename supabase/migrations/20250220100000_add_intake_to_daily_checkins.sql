-- Ernährungsdaten im Check-in (Kcal, Protein, Carbs, Fett)
ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS calories_intake INT,
  ADD COLUMN IF NOT EXISTS protein_intake INT,
  ADD COLUMN IF NOT EXISTS carbs_intake INT,
  ADD COLUMN IF NOT EXISTS fat_intake INT;
