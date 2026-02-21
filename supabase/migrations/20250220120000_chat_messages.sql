-- Chat-Verlauf für den AI Coach Assistenten
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages (user_id, created_at);
