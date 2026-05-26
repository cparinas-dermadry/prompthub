# PromptHub — Technical Audit

**Date:** May 23, 2026
**Scope:** Full deep audit of the monorepo (`apps/api`, `apps/web`, `packages/types`, `supabase/migrations`, root tooling)
**Auditor:** Claude
**Branch state:** post-merge of `fix/Clerk-JWT-RLS` (commit `a8e2c58`)

---

## Executive summary

PromptHub is in a healthy mid-MVP state. The recent RLS rollout (migration `003` + `UserSupabaseService`) closed the single biggest historical risk — cross-tenant data exposure — and the defense-in-depth pattern (RLS plus explicit `user_id` filters) is well executed. The Nest API has sensible validation, rate limiting on the cost-sensitive streaming endpoint, and a thoughtful abort path for SSE.

That said, there are real issues that should not ship to production as-is. The most pressing are: (1) a stale, unused Anthropic API key sitting in `apps/api/.env`, (2) the web app's `.env.local` carrying server-only Supabase and Clerk secrets it never uses, (3) the shared `@prompthub/types` package being meaningfully out of sync with the API contract, (4) fabricated/non-existent model IDs in the streaming migration table that will fail at runtime, (5) no automated tests beyond a single scaffolded spec, and (6) no production hardening on the Next.js side (no security headers, no CSP).

None of these are showstoppers, but several would cause incidents in production within days of launch.

---

## Findings by severity

Each finding is tagged with severity, file/line, and a recommended fix. Severities: **Critical**, **High**, **Medium**, **Low**, **Info**.

### Critical

**C-1. Unused Anthropic API key sitting in `apps/api/.env`**
`apps/api/.env:13` contains `claude-api-key=sk-ant-api03-...` (real-looking secret). It is not read by any code in the repo (grep confirms zero references). Even though `.env` is properly gitignored, this key is on disk in plaintext, will be in any backup of the dev environment, and represents a credential the team has no audit trail for. *Fix:* Rotate the key in the Anthropic console, then remove the line from `.env`. If it was intended for a future direct-API integration (`use_direct_api` flag in `ModelConfigDto`), document it in `.env.example` and gate its usage behind code.

**C-2. Server-only secrets loaded into the Next.js process env**
`apps/web/.env.local` contains `CLERK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` — none of which are read by the web app (it talks to the Nest API, never to Supabase or Clerk directly from the server). Next.js will not ship non-`NEXT_PUBLIC_` vars to the browser by default, but loading them into the server-side process means any future server action, RSC, or route handler that accidentally references `process.env.SUPABASE_SERVICE_ROLE_KEY` and surfaces it in an error response or log will leak it. *Fix:* Strip `CLERK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from `apps/web/.env.local`. The web app only needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, the Clerk URL vars, and `NEXT_PUBLIC_API_URL`.

### High

**H-1. Fabricated model IDs in `MODEL_MIGRATIONS` table**
`apps/api/src/streaming/streaming.service.ts:10-31` remaps retired model IDs to replacements that don't appear to exist on OpenRouter as of this audit: `google/gemini-3.5-flash`, `deepseek/deepseek-v4-flash:free`, `google/gemma-4-31b-it:free`, `anthropic/claude-opus-4.7-fast`, `nvidia/nemotron-3-super-120b-a12b:free`, `poolside/laguna-m.1:free`. Any user with a thread on a legacy ID will get migrated to a non-existent ID, then hit the `status === 400` branch with `"Invalid model ID or request"`. The migration also writes the bad ID back to the DB (`update({ model_id: resolvedModelId })`), poisoning the row permanently. *Fix:* Cross-check every entry in `MODEL_MIGRATIONS` and `PROVIDER_REGISTRY` against `https://openrouter.ai/models` before launch, and add a startup sanity check that pings OpenRouter's model list and warns on any registry ID that's not present.

**H-2. Shared `@prompthub/types` contract has drifted from the API**
`packages/types/src/index.ts` no longer matches what the API actually emits or expects:

  - `ProviderConfig.costPer1kTokens` is `{ input: number; output: number }` in shared types, but `apps/api/src/providers/provider-config.ts:14` declares it as `number`. The API serves the scalar shape.
  - `ProviderConfig.via` allows `'openrouter' | 'direct'` in shared types, but the API only ever emits `'openrouter'`.
  - `SendPromptRequest.modelIds` (shared types) is named `threadIds` in the actual API DTO (`apps/api/src/streaming/dto/send-prompt.dto.ts:29`).
  - `ModelConfig` in shared types lacks `logoColor`, which `ModelConfigDto` in the API does accept (`apps/api/src/threads/dto/thread.dto.ts:48-50`).

The frontend currently survives this by casting and reshaping in ad-hoc spots (`use-add-threads.ts`, `session.store.ts`), but the whole point of the shared package is to catch this at compile time. *Fix:* Pick the API as the source of truth, rewrite `packages/types/src/index.ts` to match, rebuild `dist/`, and run `tsc --noEmit` across both apps until everything compiles.

**H-3. Unbounded `GET /sessions/:id` payload**
`apps/api/src/sessions/sessions.service.ts:48` runs `select('*, threads(*, messages(*))')`. For a session with, say, 20 threads and 500 messages each (10k rows), this returns a single ~MB+ JSON blob in one query. No pagination, no limit on the nested `messages` array. *Fix:* Either (a) cap the nested messages selection to the most recent N per thread (`messages(*, limit(50))` Postgres-side), or (b) return only thread shells from this endpoint and have the client lazy-load messages per thread when expanded.

**H-4. No security headers or CSP on the Next.js app**
`apps/web/next.config.ts` is the default scaffold — no `headers()` export, no Content-Security-Policy, no HSTS, no `X-Frame-Options`, no `Referrer-Policy`. The app renders untrusted AI-generated markdown via `react-markdown`. `react-markdown` is safe by default (it doesn't process raw HTML since v8), but the lack of defense-in-depth is a soft target: a future contributor adding `rehypeRaw` or `dangerouslySetInnerHTML` opens stored-XSS via a crafted prompt response. *Fix:* Add a `headers()` block to `next.config.ts` with at minimum: `Strict-Transport-Security: max-age=63072000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP that disallows inline scripts and frames. Clerk publishes the exact CSP directives its widgets need.

**H-5. Phantom dependency — `reselect` is used but not declared**
`apps/web/src/store/session.store.ts:3` imports `reselect`, but it is not in `apps/web/package.json`'s dependency list. It only resolves today because pnpm has hoisted it as a transitive dep (the lockfile shows `reselect@5.1.1` and `reselect@5.2.0` from other packages' graphs). On a stricter install profile, or after a future Clerk/Zustand minor bump that drops the transitive path, this import will throw `Cannot find module 'reselect'` at build time. *Fix:* `pnpm add reselect --filter web`.

### Medium

**M-1. Single live test in the entire codebase**
The only meaningful test is `apps/api/src/app.controller.spec.ts`, which asserts `"Hello World!"`. Nothing covers `SessionsService`, `ThreadsService`, `StreamingService`, `HighlightsService`, `ClerkGuard`, or any web-side hook. The RLS rollout in particular — which redefines the entire tenancy model — has zero automated verification beyond manual smoke testing. The dev checklist agrees: every `🧪 Test:` line in Phase 3 is unchecked. *Fix:* Before Phase 5 of the checklist, write integration tests against a local Supabase: at minimum, "user A cannot read user B's session", "user A cannot insert a thread into user B's session", and a streaming happy-path test that fakes OpenRouter.

**M-2. SSE streams have no idle-keepalive ping**
`apps/api/src/streaming/streaming.service.ts:114-119` sets `Connection: keep-alive` and `X-Accel-Buffering: no` but emits no periodic heartbeat. Many production proxies — Cloudflare, Nginx, Vercel Edge, AWS ALB — close idle connections after 60-100s. If a model takes >60s to first-token (Opus on a long prompt regularly does), the proxy will hang up before the client sees anything, and the abort handler will fire as if the user closed the tab. *Fix:* Emit `: ping\n\n` (a comment frame, ignored by browsers) every 15s while `res.writable` is true.

**M-3. Streaming endpoint has no per-stream size budget**
A malicious or runaway model output could stream gigabytes of tokens. The current code accumulates `fullContent` in memory and forwards every token. Combined with `Promise.allSettled` of up to 10 parallel streams, a single user could pin substantial server memory. *Fix:* Cap `fullContent` (e.g. 1MB per stream) and call `reader.cancel()` once the cap is hit, writing an `{ type: 'error', message: 'response truncated' }` event to the client.

**M-4. BYOK naming is misleading — there is no per-user BYOK**
`provider-config.ts` and `streaming.service.ts` call themselves "BYOK," but every model call uses the server's single `OPENROUTER_API_KEY` (`streaming.service.ts:218`). `byokOnly` only constrains OpenRouter's `provider.only` routing to a specific upstream — the team's account still pays for the call. This means every customer's usage hits the same OpenRouter bill and rate-limit pool, which is a real cost-concentration and noisy-neighbor risk at scale. *Fix:* Either (a) rename the flag to something honest like `pinUpstreamProvider`, or (b) actually implement per-user BYOK by storing user-specific OpenRouter keys (encrypted) and selecting them in `streamThread`.

**M-5. Health/ping endpoint protected by global Clerk guard**
`apps/api/src/app.controller.ts:8-11` exposes `GET /` returning `"Hello World!"` but `ClerkGuard` is registered as a global `APP_GUARD` in `app.module.ts:50-52`. Any future Railway/Vercel health-check or uptime-monitor hitting `/` will get a 401. This is the kind of thing nobody notices until the platform's auto-scaler marks the service unhealthy at 3am. *Fix:* Add a `@Public()` decorator pattern (key reflection in `ClerkGuard.canActivate`) and apply it to a real `/health` endpoint that returns `{ status: 'ok' }` with no DB calls.

**M-6. Stale `apps/web/package-lock.json` committed alongside `pnpm-lock.yaml`**
Root `.gitignore:1-2` correctly ignores `package-lock.json`, but `apps/web/package-lock.json` (346KB) is currently tracked. The two lockfiles can drift, and a contributor running `npm install` instead of `pnpm install` will silently install different versions than CI. *Fix:* `git rm apps/web/package-lock.json` and confirm it's covered by the root `.gitignore` rule.

**M-7. `console.error` left in production path**
`apps/api/src/sessions/sessions.service.ts:71` has `console.error('Full error cause:', (error as any)?.cause);` next to a proper `this.logger.error(...)`. Debug residue. Will dump unstructured output that bypasses log aggregation in production. *Fix:* Remove or replace with `this.logger.error('cause:', err.cause)`.

**M-8. CORS configuration silently accepts no origins on misconfiguration**
`apps/api/src/main.ts:11-13` falls back to `['http://localhost:3000']` if `ALLOWED_ORIGINS` is unset, but the fallback fires when `ALLOWED_ORIGINS=""` is set to an empty string after the `.filter(Boolean)`. In production with an empty/typo'd env, CORS will silently allow only localhost — which means production traffic from the deployed frontend gets blocked. That's better than the alternative (allowing `*`), but the failure mode is opaque. *Fix:* Treat an empty `ALLOWED_ORIGINS` in `NODE_ENV=production` as a fatal startup error in `env.validation.ts`.

### Low

**L-1. `API_URL` fallback to localhost ships into production builds**
`apps/web/src/lib/api.ts:8` and `apps/web/src/lib/streaming.ts:12` both default to `http://localhost:3001` if `NEXT_PUBLIC_API_URL` is unset. In a production build where the env var is missing, the app will silently try to call localhost from the user's browser. *Fix:* Throw at build time (a small top-of-file `if (!process.env.NEXT_PUBLIC_API_URL) throw new Error(...)`) so Vercel's build fails loud.

**L-2. `streamPrompt` has no overall timeout**
`apps/web/src/lib/streaming.ts:27-114` has no top-level deadline. Combined with the server-side issue M-2, a stuck connection on the client can sit indefinitely waiting on `reader.read()`. *Fix:* Wrap the call with `AbortSignal.timeout(120_000)` (or whatever the product SLA is) and surface a clear error.

**L-3. No retry/backoff on 401 token refresh**
`apps/web/src/lib/api.ts:42-43` retries exactly once on 401 with `skipCache: true`. That's fine for the cold-cache case, but if Clerk's JWKS endpoint is having a brief outage, every active tab will refetch tokens in lockstep. *Fix:* Add 50-200ms jitter before the retry.

**L-4. `messages.role` enforcement is a CHECK only**
`supabase/migrations/001_initial_schema.sql:54` constrains `role IN ('user', 'assistant')` — fine for now, but as soon as you add tool calls or system messages, you'll need a migration. Worth documenting as a known future change.

**L-5. `sessions.findOne` returns a 404 even on DB errors**
`apps/api/src/sessions/sessions.service.ts:53` collapses both "row not found" and "Postgres exploded" into the same `NotFoundException`. Operationally this hides real DB issues from users (and from logs, since you don't `logger.error` first). *Fix:* Inspect `error.code` — `PGRST116` means no rows, anything else is a real failure.

**L-6. The Nest `Module` declaration for streaming and highlights doesn't import `SupabaseModule`**
It works today because `SupabaseModule` is `@Global()` — `apps/api/src/supabase/supabase.module.ts:5`. If anyone removes `@Global()` later as part of a refactor, every consuming module will fail to resolve `UserSupabaseService` with a confusing "can't resolve dependency" error. *Fix:* Either explicitly import `SupabaseModule` in each consumer, or add a code comment to `SupabaseModule` noting the `@Global()` invariant is load-bearing.

**L-7. `apps/web/src/proxy.ts` uses default export rather than named `proxy`**
Next.js 16's [migration guide](https://nextjs.org/docs/messages/middleware-to-proxy) recommends renaming the exported function to `proxy`. The current `export default clerkMiddleware(...)` works today but isn't future-proof. *Fix:* `export const proxy = clerkMiddleware(...)`. Confirm Clerk's docs for Next 16 align.

**L-8. `apps/web/src/components/ui/chart.tsx:95` uses `dangerouslySetInnerHTML`**
This is shadcn's standard `<ChartStyle>` pattern that injects scoped CSS variables — the content is built from a typed `config` object the developer controls, not from user input. It's safe today, but if anyone ever passes a user-derived value through to the `config` prop it becomes a stored-XSS vector. *Fix:* Add a comment to that file noting `config` must never carry user-controlled strings.

### Info / observations

**I-1. Sound RLS rollout.** Migration `003_real_rls_policies.sql` is one of the cleanest pieces of work in the repo — split `SELECT/INSERT/UPDATE/DELETE`, two-level deep policies on `messages`, comments explaining the phase plan, and a verification SQL snippet. Defense-in-depth `.eq('user_id', userId)` filters left in services. This is the right pattern.

**I-2. Sensible cost ceilings.** Cap of 10 thread fan-out (`ArrayMaxSize(10)`), 32k char prompt cap (`MaxLength(32_000)`), per-IP throttle of 20/min on `/streaming/prompt` — all reasonable. The comment block in `app.module.ts:23-29` explaining *why* these ceilings exist is exactly what audit trails want.

**I-3. Good abort plumbing.** The dual-signal pattern in `streaming.service.ts:213` (`AbortSignal.any([clientAbort, AbortSignal.timeout(90_000)])`) combined with persisting partial content on abort means tab-closes don't lose data and don't keep burning OpenRouter credits. Well-thought-out.

**I-4. Bleeding-edge framework versions.** `next: 16.2.6`, `react: 19.2.4`, `@clerk/nextjs: 7.3.4` (pinned because 7.3.5 had a broken dep). React 19 + Next 16 are very new; expect a few patch-level surprises in the next 3-6 months. The pnpm `overrides` for `@clerk/shared: 4.12.0` in the root `package.json` is exactly the kind of override that quietly rots — schedule a quarterly check whether it's still needed.

**I-5. Phase 5 (E2E validation) is the next checklist phase and is entirely unchecked.** Every journey 1-5 in `DEVELOPMENT_CHECKLIST.md` is a `[ ]`. The audit findings above strongly suggest doing these before deployment, not after.

**I-6. No CI/CD configured.** No `.github/workflows/`, no Vercel/Railway preview hooks visible in the repo. Manual deploys with no automated lint/test/typecheck gate. Add a basic GitHub Actions workflow: `pnpm install --frozen-lockfile && pnpm lint && pnpm build`, run on every PR.

**I-7. No archival or soft-delete strategy.** `ON DELETE CASCADE` from sessions wipes threads and messages immediately. Fine for MVP, but the moment a user reports "I deleted the wrong session, can you recover it?", you'll wish you had `deleted_at` columns. Worth deciding now, not after a support ticket.

---

## Scalability assessment

The architecture scales reasonably well to mid-thousands of users without major changes, but three pinch points will bite first:

The unbounded `GET /sessions/:id` payload (H-3) is the most acute. Once any user accumulates 5-10k messages across a busy session, that endpoint will start returning multi-megabyte JSON in a single request, blocking the Node event loop on JSON serialization and inflating Supabase egress. Fix this before launch.

The per-request scope cascade from `UserSupabaseService` (`apps/api/src/supabase/user-supabase.service.ts:44`) makes every service in the request chain request-scoped. The team has acknowledged this trade-off and the per-request allocation is small, but it does prevent NestJS's per-request DI cache from amortizing — at very high RPS this becomes measurable. Not a near-term problem.

The single-tenant OpenRouter key (M-4) is the cost-concentration risk. Once you have, say, 200 paid users each running 5 fan-outs/day, you're putting ~10k OpenRouter requests/day through one account, hitting one rate limit, with one bill. Per-user BYOK is the long-term fix; in the short term, you'll want billing alerts on the OpenRouter account.

---

## Recommended remediation order

1. **Today** — Rotate the stray `claude-api-key` in `apps/api/.env`, strip the unused secrets from `apps/web/.env.local`, delete `apps/web/package-lock.json` (C-1, C-2, M-6).
2. **This week** — Reconcile `packages/types` with the API contract (H-2). Add `reselect` to web's `package.json` (H-5). Verify every model ID in `MODEL_MIGRATIONS` and `PROVIDER_REGISTRY` against OpenRouter's live list (H-1). Add basic security headers and CSP to `next.config.ts` (H-4). Cap `GET /sessions/:id` payload (H-3).
3. **Before launch** — Write the integration tests called out in M-1, fix CORS misconfiguration handling (M-8), add SSE keepalive (M-2), add per-stream size cap (M-3), surface a real `/health` endpoint (M-5), set up a CI workflow (I-6).
4. **Post-launch backlog** — Per-user BYOK (M-4), soft-delete strategy (I-7), schedule the framework version-bump review (I-4).

---

_End of audit — no further action required from the auditor; ball is in the team's court._
