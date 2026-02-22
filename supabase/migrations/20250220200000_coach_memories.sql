-- Chat-Gedächtnis: vom Coach extrahierte Infos aus Nutzer-Nachrichten
CREATE TABLE IF NOT EXISTS coach_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  memory text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_memories_user_created ON coach_memories (user_id, created_at DESC);

COMMENT ON TABLE coach_memories IS 'Vom Coach aus dem Chat extrahierte Infos: Aussagen, Gewohnheiten, Vorlieben, Ziele.';
