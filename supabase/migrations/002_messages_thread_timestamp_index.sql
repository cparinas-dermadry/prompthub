-- Composite index on (thread_id, timestamp) so the streaming history query
-- can use index-order traversal instead of sorting messages by timestamp
-- inside Postgres after the thread_id filter.
--
-- Hot query (apps/api/src/streaming/streaming.service.ts, fires on every
-- /streaming/prompt → for every thread in the fan-out):
--
--   SELECT role, content
--   FROM messages
--   WHERE thread_id = $1
--   ORDER BY timestamp DESC
--   LIMIT 40;
--
-- The original migration created `messages (thread_id)` alone, which
-- requires a Sort node on top of the index scan. The composite index gets
-- the planner a sortless Index Scan Backwards + LIMIT.
--
-- IF NOT EXISTS so re-running on an already-migrated DB is a no-op.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query

CREATE INDEX IF NOT EXISTS messages_thread_id_timestamp_idx
  ON messages (thread_id, timestamp DESC);
