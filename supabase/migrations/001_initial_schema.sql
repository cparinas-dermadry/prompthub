-- PromptHub Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ─────────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────────
CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  name             TEXT NOT NULL,
  tags             TEXT[] DEFAULT '{}',
  active_providers JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_name_search_idx ON sessions USING gin (to_tsvector('english', name));

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- THREADS
-- ─────────────────────────────────────────────
CREATE TABLE threads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  model_id     TEXT NOT NULL,
  display_name TEXT NOT NULL,
  provider     TEXT NOT NULL,
  model_config JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX threads_session_id_idx ON threads (session_id);

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────
CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  is_bookmarked BOOLEAN DEFAULT false,
  timestamp     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX messages_thread_id_idx ON messages (thread_id);
CREATE INDEX messages_bookmarked_idx ON messages (thread_id) WHERE is_bookmarked = true;

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- RLS is enabled but our NestJS backend uses the secret key
-- which bypasses RLS entirely (BYPASSRLS). These policies
-- are here as a safety net for any future direct client access.
-- ─────────────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Block all anonymous/public access (NestJS secret key bypasses this)
CREATE POLICY "deny_all_sessions" ON sessions FOR ALL USING (false);
CREATE POLICY "deny_all_threads"  ON threads  FOR ALL USING (false);
CREATE POLICY "deny_all_messages" ON messages FOR ALL USING (false);
