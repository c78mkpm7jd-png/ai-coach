-- Sprachnachricht: Dauer in Sekunden (Anzeige als Audio-Bubble, Transkript nur für Coach-Kontext)
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS voice_duration_sec INT;

COMMENT ON COLUMN chat_messages.voice_duration_sec IS 'Bei Nutzer-Sprachnachricht: Dauer in Sekunden für Audio-Bubble-Anzeige';