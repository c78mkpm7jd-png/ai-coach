-- Add activity fields to daily_checkins for Garmin/watch data and activity type
ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS activity_type TEXT,
  ADD COLUMN IF NOT EXISTS activity_duration_min INT,
  ADD COLUMN IF NOT EXISTS activity_calories_burned INT;
