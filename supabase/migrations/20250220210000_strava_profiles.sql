-- Strava OAuth Tokens und Status in profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
  ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS strava_token_expiry BIGINT,
  ADD COLUMN IF NOT EXISTS strava_connected BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.strava_access_token IS 'Strava OAuth access token';
COMMENT ON COLUMN profiles.strava_refresh_token IS 'Strava OAuth refresh token';
COMMENT ON COLUMN profiles.strava_token_expiry IS 'Unix timestamp when access token expires';
COMMENT ON COLUMN profiles.strava_connected IS 'True if user has connected Strava';
