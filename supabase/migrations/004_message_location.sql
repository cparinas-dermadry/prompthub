-- ============================================================================
--  004_message_location.sql
--  Geolocation for AI Visibility Testing (GEO/SEO).
--
--  Adds:
--    - sessions.location  JSONB  — the session's default PromptLocation
--    - messages.location  JSONB  — per-turn stamp of the location each
--                                  message was generated under (kept on both
--                                  user and assistant rows so history stays
--                                  accurate even if the session's default
--                                  later changes)
--    - messages.citations JSONB  — url_citation results from
--                                  openrouter:web_search, persisted on the
--                                  assistant row that the model produced
--
--  RLS:
--    No new policies needed. The columns inherit the existing per-row
--    sessions / messages policies from 003_real_rls_policies.sql, which gate
--    every row by the Clerk JWT `sub` claim.
--
--  Schema notes:
--    All three columns are NULLABLE — pre-existing rows continue to load
--    cleanly with no location stamp. Going forward the API writes the active
--    location alongside every new insert.
--
--    JSONB (not JSON) so we can index later if a brand-mention query
--    grows expensive. No indexes are added now — read patterns are
--    "fetch the messages for this thread" which already uses
--    messages_thread_id_idx; the JSON columns ride along.
--
--  PromptLocation shape (informational — enforced at the API DTO layer):
--    {
--      "country":  "SG",                 -- ISO-3166 alpha-2 (required when set)
--      "region":   "Central",            -- optional
--      "city":     "Singapore",          -- optional
--      "timezone": "Asia/Singapore",     -- optional, IANA
--      "label":    "Singapore"           -- optional, display string
--    }
--
--  Citations shape (informational — produced by the streaming service):
--    [
--      { "url": "...", "title": "...", "snippet": "...", "domain": "..." },
--      ...
--    ]
--
--  Run this in: Supabase Dashboard → SQL Editor → New query.
-- ============================================================================

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS location JSONB;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS location  JSONB,
  ADD COLUMN IF NOT EXISTS citations JSONB;

-- Sanity check after running:
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'messages'
--     AND column_name IN ('location', 'citations');
--   -- should return both rows, data_type = jsonb
--
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'sessions'
--     AND column_name = 'location';
--   -- should return one row, data_type = jsonb
