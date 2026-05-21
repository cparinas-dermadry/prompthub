import {
  Inject,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';

/**
 * Per-request Supabase client authenticated as the calling user via their
 * Clerk JWT.
 *
 * Why this exists:
 *   The existing `SupabaseService` uses the SERVICE-ROLE key, which bypasses
 *   Row-Level Security entirely. Cross-tenant isolation is therefore enforced
 *   only by `.eq('user_id', userId)` filters scattered across services — one
 *   forgotten filter is an IDOR. After migration 003, real RLS policies are
 *   live on `sessions`, `threads`, `messages` keyed to `auth.jwt()->>'sub'`.
 *   This service builds a Supabase client using the ANON key with the
 *   request's Clerk JWT in the Authorization header, so every query runs
 *   under those RLS policies.
 *
 * Phase 1 (current): defined and wired into SupabaseModule, but NOT yet
 *   consumed by any service. Code path is unchanged from before. Smoke-test
 *   by injecting this somewhere harmless and watching for boot errors.
 *
 * Phase 2 (next PR): existing services switch from `SupabaseService` to
 *   `UserSupabaseService` for all user-owned queries. RLS becomes the real
 *   gate. The `.eq('user_id', userId)` filters are kept as defense in depth.
 *
 * Scope:
 *   REQUEST-scoped because the client embeds the caller's JWT and a singleton
 *   would leak credentials across requests. NestJS handles the lifecycle for
 *   us — a fresh instance per HTTP request, garbage-collected when the
 *   response is sent.
 *
 *   Cascading scope: any service that injects this becomes request-scoped
 *   too. That's a small per-request allocation cost we're accepting in
 *   exchange for the tenancy guarantee.
 */
@Injectable({ scope: Scope.REQUEST })
export class UserSupabaseService {
  private readonly logger = new Logger(UserSupabaseService.name);
  private _client: SupabaseClient | null = null;

  constructor(@Inject(REQUEST) private readonly request: Request) {}

  /**
   * Returns the per-request Supabase client. Lazy-built on first access so
   * requests that never touch the DB don't pay the construction cost.
   *
   * Throws UnauthorizedException if the request doesn't carry a Bearer
   * token. In practice ClerkGuard runs first and rejects unauthenticated
   * requests, so this is a defense-in-depth check rather than an expected
   * code path.
   */
  get db(): SupabaseClient {
    if (this._client) return this._client;

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    // Env validation at boot guarantees these are set, but check anyway so
    // a future env-loading regression fails loudly with a clear message
    // instead of silently producing an unauth'd client.
    if (!url || !anonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }

    const authHeader = this.request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing JWT for user-scoped DB access');
    }
    const jwt = authHeader.slice(7);

    this._client = createClient(url, anonKey, {
      // The Authorization header is what Supabase reads to identify the
      // caller for RLS. Setting it via `global.headers` applies it to every
      // request this client makes.
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: {
        // We're not using Supabase's own auth flow — Clerk is the IdP, and
        // we want the client to do absolutely nothing on its own with
        // tokens/sessions.
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return this._client;
  }
}
