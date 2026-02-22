-- Tipp des Tages: ein Mal pro User/Tag generieren, preview + full zusammen speichern
-- Dashboard zeigt preview, Detailseite zeigt full – immer derselbe Tipp

CREATE TABLE IF NOT EXISTS daily_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  date date NOT NULL,
  coach_tip_title text NOT NULL,
  coach_tip_preview text NOT NULL,
  coach_tip_body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_tips_user_date ON daily_tips (user_id, date);

COMMENT ON TABLE daily_tips IS 'Täglicher Coach-Tipp pro User; preview und full in einem Eintrag.';
