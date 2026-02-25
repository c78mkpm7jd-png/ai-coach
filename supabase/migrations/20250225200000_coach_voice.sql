-- Coach-Stimme für TTS (Voice Coach): onyx (männlich), nova (weiblich)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS coach_voice TEXT DEFAULT 'onyx';

COMMENT ON COLUMN profiles.coach_voice IS 'OpenAI TTS Stimme: onyx (männlich), nova (weiblich)';