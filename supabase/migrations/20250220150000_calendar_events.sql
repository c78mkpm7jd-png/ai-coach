-- Kalender-Einträge (Training/Ruhetag) – getrennt von daily_checkins
-- Beeinflussen KEINE Check-ins; nur über Kalender-UI verwaltet

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('training', 'ruhetag')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events (user_id, date);

COMMENT ON TABLE calendar_events IS 'Kalender-Markierungen (Training/Ruhetag) pro Tag; unabhängig von daily_checkins.';
