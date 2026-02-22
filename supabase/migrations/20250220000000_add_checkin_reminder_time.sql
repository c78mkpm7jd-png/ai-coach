-- Check-in Reminder: Uhrzeit für tägliche Erinnerungs-Email
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS checkin_reminder_time TIME;

COMMENT ON COLUMN profiles.checkin_reminder_time IS 'Tägliche Uhrzeit (UTC) für Check-in Erinnerungs-Email; NULL = kein Reminder';
