-- Kalorien- und Proteinziel-Bereich für Coach und Dashboard
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS calorie_target_min INT,
ADD COLUMN IF NOT EXISTS calorie_target_max INT,
ADD COLUMN IF NOT EXISTS protein_target_min INT,
ADD COLUMN IF NOT EXISTS protein_target_max INT;

COMMENT ON COLUMN profiles.calorie_target_min IS 'Untergrenze Kalorienziel (kcal/Tag); NULL = aus Profil berechnen';
COMMENT ON COLUMN profiles.calorie_target_max IS 'Obergrenze Kalorienziel (kcal/Tag)';
COMMENT ON COLUMN profiles.protein_target_min IS 'Untergrenze Proteinziel (g/Tag)';
COMMENT ON COLUMN profiles.protein_target_max IS 'Obergrenze Proteinziel (g/Tag)';
