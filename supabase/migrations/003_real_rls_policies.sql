-- ============================================================================
--  003_real_rls_policies.sql
--  Replace the placeholder deny-all RLS policies with real ones that gate
--  each row by the Clerk user id carried in the request JWT.
-- ============================================================================
--
--  PREREQUISITE (manual, must be done BEFORE running this migration):
--    Supabase Dashboard → Authentication → Third-Party Auth → Clerk → Enabled.
--    The Clerk Frontend API URL must match CLERK_ISSUER_URL in apps/api/.env.
--    Verified live: third-party auth shows "Enabled" with the Clerk domain.
--
--  HOW THIS WORKS:
--    With third-party auth enabled, Supabase verifies incoming JWTs against
--    Clerk's JWKS endpoint and exposes the claims via `auth.jwt()`.
--    `auth.jwt()->>'sub'` returns the Clerk user id (e.g. 'user_2abc…').
--    Our `sessions.user_id` column stores exactly that format already, so
--    the policies just compare the column to the JWT's `sub` claim.
--
--  PHASE 1 (this migration):
--    These policies are added but the NestJS backend still uses the
--    SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely (BYPASSRLS). So
--    runtime behavior is UNCHANGED. This migration is safe to apply on its
--    own — the policies sit dormant until Phase 2 flips services over to
--    the user-scoped anon-key client.
--
--  PHASE 2 (a future migration / code PR):
--    Backend services switch from `SupabaseService.db` (service-role) to
--    `UserSupabaseService.db` (anon key + per-request Clerk JWT). Only then
--    do these policies actually gate live traffic.
--
--  ROLLBACK PLAN:
--    To revert these policies and restore the deny-all placeholders, run
--    002_real_rls_policies_rollback.sql (kept as a separate file if needed)
--    or manually:
--      DROP POLICY ... ; CREATE POLICY ... USING (false);
--    Service-role keeps working regardless.
--
--  Run this in: Supabase Dashboard → SQL Editor → New query.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1 — drop the existing deny-all placeholder policies.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "deny_all_sessions" ON sessions;
DROP POLICY IF EXISTS "deny_all_threads"  ON threads;
DROP POLICY IF EXISTS "deny_all_messages" ON messages;


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 — sessions: row is visible / writable iff its user_id matches the
-- Clerk `sub` claim from the verified JWT.
--
-- We split SELECT / INSERT / UPDATE / DELETE rather than `FOR ALL` so the
-- intent of each operation is explicit and so we can adjust them
-- independently later (e.g. a future "shared sessions" feature would relax
-- SELECT without touching writes).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "sessions_select_own"
  ON sessions FOR SELECT
  USING (user_id = (auth.jwt()->>'sub'));

CREATE POLICY "sessions_insert_own"
  ON sessions FOR INSERT
  WITH CHECK (user_id = (auth.jwt()->>'sub'));

CREATE POLICY "sessions_update_own"
  ON sessions FOR UPDATE
  USING (user_id = (auth.jwt()->>'sub'))
  WITH CHECK (user_id = (auth.jwt()->>'sub'));

CREATE POLICY "sessions_delete_own"
  ON sessions FOR DELETE
  USING (user_id = (auth.jwt()->>'sub'));


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3 — threads: ownership flows through the parent session.
-- A thread row is visible / writable iff its session belongs to the caller.
--
-- The EXISTS subquery hits `sessions` by PK (threads.session_id → sessions.id),
-- which is fast — Postgres uses the PK index. `threads_session_id_idx`
-- (from migration 001) already exists for the reverse direction.
--
-- WITH CHECK on INSERT/UPDATE makes it impossible to attach a thread to
-- someone else's session even if the request body crafts a session_id
-- belonging to another user.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "threads_select_own"
  ON threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = threads.session_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );

CREATE POLICY "threads_insert_own"
  ON threads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = threads.session_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );

CREATE POLICY "threads_update_own"
  ON threads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = threads.session_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = threads.session_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );

CREATE POLICY "threads_delete_own"
  ON threads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = threads.session_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4 — messages: ownership is two levels deep (message → thread → session).
--
-- The join hits two PK lookups (thread_id → threads PK, session_id → sessions
-- PK) plus the user_id filter on sessions. All indexed; no full scans.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "messages_select_own"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM threads
      JOIN sessions ON sessions.id = threads.session_id
      WHERE threads.id = messages.thread_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );

CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM threads
      JOIN sessions ON sessions.id = threads.session_id
      WHERE threads.id = messages.thread_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );

CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM threads
      JOIN sessions ON sessions.id = threads.session_id
      WHERE threads.id = messages.thread_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM threads
      JOIN sessions ON sessions.id = threads.session_id
      WHERE threads.id = messages.thread_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );

CREATE POLICY "messages_delete_own"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM threads
      JOIN sessions ON sessions.id = threads.session_id
      WHERE threads.id = messages.thread_id
        AND sessions.user_id = (auth.jwt()->>'sub')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Verification — quick sanity checks to confirm the policies are in place.
-- Run these in the SQL editor after the migration to confirm:
--
--   -- Should list 4 policies per table (select / insert / update / delete)
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('sessions','threads','messages')
--   ORDER BY tablename, cmd;
--
--   -- Should NOT list any deny_all_* policies anymore.
-- ─────────────────────────────────────────────────────────────────────────────
