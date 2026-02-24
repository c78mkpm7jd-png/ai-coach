-- Carbs- und Fett-Zielbereich für Profil
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS carbs_target_min INT,
ADD COLUMN IF NOT EXISTS carbs_target_max INT,
ADD COLUMN IF NOT EXISTS fat_target_min INT,
ADD COLUMN IF NOT EXISTS fat_target_max INT;

COMMENT ON COLUMN profiles.carbs_target_min IS 'Untergrenze Kohlenhydrat-Ziel (g/Tag)';
COMMENT ON COLUMN profiles.carbs_target_max IS 'Obergrenze Kohlenhydrat-Ziel (g/Tag)';
COMMENT ON COLUMN profiles.fat_target_min IS 'Untergrenze Fett-Ziel (g/Tag)';
COMMENT ON COLUMN profiles.fat_target_max IS 'Obergrenze Fett-Ziel (g/Tag)';
