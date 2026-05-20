# PromptHub — Development Checklist

_Multi-AI Workspace for SEO Specialists_
_Last updated: May 18, 2026 — v1_

> **How to use this file:** Work top-to-bottom. Check off items as you complete them. Each section maps to a phase in the feasibility plan. Items marked 🔑 are critical-path blockers — nothing downstream works until they are done.

---

## Legend

- `[ ]` Not started
- `[x]` Complete
- `[~]` In progress
- `[-]` Skipped / deferred
- 🔑 Critical path / blocker
- 💰 Has cost implication
- ⚠️ Complexity warning
- 🧪 Needs manual testing

---

## Phase 0 — Monorepo Baseline _(already started)_

### Repository & Tooling

- [x] pnpm workspace initialized (`pnpm-workspace.yaml`)
- [x] Turborepo configured (`turbo.json`)
- [x] `apps/api` — NestJS scaffolded (bare AppModule)
- [x] `apps/web` — Next.js scaffolded (bare layout + page)
- [x] Tailwind CSS installed in `apps/web`
- [x] Confirm `turbo dev` starts both apps simultaneously without errors
- [x] Add a `packages/` directory for shared types/config (create `packages/types/` as a stub)
- [x] Add `packages/tsconfig/` with a shared base `tsconfig.json` that both apps extend
- [x] Set `"strict": true` in all `tsconfig.json` files
- [x] Add `.env.example` to both `apps/api` and `apps/web` documenting every variable that will be needed
- [x] Add `.gitignore` entries for `.env`, `.env.local`, `dist/`, `.next/`, `node_modules/`
- [x] Verify hot reload works in both apps (`turbo dev` → edit a file → see change without restart)

### Code Quality Baseline

- [x] Confirm ESLint runs cleanly on both apps (`pnpm lint`)
- [x] Add Prettier config to root (`prettier.config.js` or `.prettierrc`)
- [x] Add `format` script to root `package.json` that runs Prettier across both apps
- [x] Confirm `pnpm format` runs without errors

---

## Phase 1 — External Services Setup

### 1A. Clerk (Authentication) 🔑

- [x] 💰 Create a Clerk account at clerk.com (free tier)
- [x] Create a new Clerk application — name it "PromptHub"
- [x] Set allowed sign-in methods (email/password minimum; add Google if desired)
- [x] Note down: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- [-] Note down: `CLERK_ISSUER_URL` — not needed; `@clerk/backend` verifies tokens using only `CLERK_SECRET_KEY`
- [-] Configure allowed redirect URLs in Clerk dashboard — works without this in dev; add Vercel URL here before deploying
- [x] Install Clerk SDK in `apps/web`: `@clerk/nextjs@7.3.4` (pinned — v7.3.5+ has broken dep on unpublished `@clerk/shared@4.12.1`)
- [x] Install Clerk SDK in `apps/api`: `@clerk/backend@3.4.8`
- [x] Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `apps/web/.env.local`
- [x] Add `CLERK_SECRET_KEY` to `apps/api/.env`
- [x] 🧪 Test: Visit `http://localhost:3000` — redirects to Clerk sign-in. Sign up works. ✅

### 1B. Supabase (Database) 🔑

- [x] 💰 Create a Supabase account at supabase.com (free tier)
- [x] Create a new Supabase project — name it "prompthub"
- [x] Wait for project provisioning (takes ~2 min)
- [x] Note down: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (new-style `sb_publishable_...` / `sb_secret_...` keys)
- [-] Note down: direct PostgreSQL connection string — not needed; using Supabase JS client
- [x] Add Supabase credentials to `apps/api/.env`
- [x] Install Supabase client in `apps/api`: `@supabase/supabase-js`
- [x] Install Supabase client in `apps/web`: `@supabase/supabase-js` (for future direct client reads if needed)
- [x] Enable Row Level Security (RLS) on all tables after creating them (see schema section below)

### 1C. OpenRouter (AI Gateway) 🔑

- [x] 💰 Create an OpenRouter account at openrouter.ai
- [-] Add a payment method — skipped for now; using free models for dev testing
- [x] Create an API key — name it "prompthub-dev"
- [x] Note down: `OPENROUTER_API_KEY`
- [x] Add `OPENROUTER_API_KEY` to `apps/api/.env`
- [-] Verify with curl — will test via actual streaming endpoint instead
- [x] Model IDs documented in `provider-config.ts` registry

#### BYOK (Bring Your Own Key) — optional, do later
- [ ] In OpenRouter → **BYOK** → select **Anthropic** → paste your `sk-ant-...` Claude key → Save
- [-] This routes all Claude requests through your own Anthropic account (no OpenRouter markup for Claude)
- [ ] Repeat for any other providers you have direct keys for (OpenAI, Google, etc.)
- [ ] No code changes needed — OpenRouter handles BYOK routing transparently

### 1D. Services Summary Checkpoint

- [x] All three external services are live and configured
- [x] All environment variables are documented in `.env.example` files
- [x] No secrets are committed to git — verified; `.env` is gitignored

---

## Phase 2 — Database Schema (Supabase)

### 2A. Define & Apply Schema

- [x] Create `supabase/` directory at repo root for migration files
- [x] Write `supabase/migrations/001_initial_schema.sql` with the following tables:

**`sessions` table**

- [x] `id` UUID primary key (default `gen_random_uuid()`)
- [x] `user_id` TEXT NOT NULL (Clerk user ID)
- [x] `name` TEXT NOT NULL
- [x] `tags` TEXT[] (array)
- [x] `active_providers` JSONB (array of provider/model config objects)
- [x] `created_at` TIMESTAMPTZ default `now()`
- [x] `updated_at` TIMESTAMPTZ default `now()`
- [x] Index on `user_id`
- [x] Index on `name` (full-text search via `tsvector` column or `pg_trgm`)

**`threads` table**

- [x] `id` UUID primary key
- [x] `session_id` UUID references `sessions(id)` ON DELETE CASCADE
- [x] `model_id` TEXT NOT NULL (e.g. `"anthropic/claude-sonnet-4-5"`)
- [x] `display_name` TEXT NOT NULL
- [x] `provider` TEXT NOT NULL
- [x] `model_config` JSONB (system_prompt, temperature, use_direct_api)
- [x] `created_at` TIMESTAMPTZ default `now()`
- [x] Index on `session_id`

**`messages` table**

- [x] `id` UUID primary key
- [x] `thread_id` UUID references `threads(id)` ON DELETE CASCADE
- [x] `role` TEXT NOT NULL CHECK (role IN ('user', 'assistant'))
- [x] `content` TEXT NOT NULL
- [x] `is_bookmarked` BOOLEAN default false
- [x] `timestamp` TIMESTAMPTZ default `now()`
- [x] Index on `thread_id`
- [x] Index on `is_bookmarked` (partial: WHERE is_bookmarked = true)

### 2B. Row Level Security

- [x] Enable RLS on `sessions`, `threads`, `messages` — deny-all policies (NestJS secret key bypasses RLS via BYPASSRLS)
- [-] Configure per-user Clerk JWT RLS policies — not needed; NestJS secret key handles auth at the API layer
- [x] 🧪 Test: RLS enabled with deny-all fallback policies in migration SQL

### 2C. Shared Types Package

- [x] Create `packages/types/src/index.ts`
- [ ] Define TypeScript interfaces matching the Supabase schema:
  - [x] `Session`
  - [x] `Thread`
  - [x] `Message`
  - [x] `ModelConfig`
  - [x] `ProviderConfig`
- [x] Export all types from the package
- [x] Reference `packages/types` in both `apps/api` and `apps/web` via pnpm workspace protocol

---

## Phase 3 — NestJS Backend Modules

### 3A. App Structure

- [-] Rename app.controller/service — kept as-is; not worth disrupting working baseline
- [x] Create the following NestJS module directories under `apps/api/src/`:
  - [x] `auth/`
  - [x] `sessions/`
  - [x] `threads/`
  - [x] `providers/`
  - [x] `streaming/`
  - [x] `highlights/`
- [x] Install `@nestjs/config` and add `ConfigModule.forRoot({ isGlobal: true })` to `AppModule` — env vars now load correctly
- [-] Install `@nestjs/mapped-types` — DTOs written manually; not needed

### 3B. Auth Module 🔑

- [x] Create `auth/auth.module.ts`
- [x] Create `auth/clerk.guard.ts` — a NestJS guard that:
  - [x] Extracts the `Authorization: Bearer <token>` header
  - [x] Verifies the JWT using Clerk's `verifyToken()` from `@clerk/backend`
  - [x] Attaches the decoded user payload to `request.user`
  - [x] Returns HTTP 401 if token is missing or invalid
- [x] Create `auth/current-user.decorator.ts` — a `@CurrentUser()` param decorator
- [x] Apply `ClerkGuard` globally in `AppModule` via `APP_GUARD`
- [ ] 🧪 Test: Call any API endpoint without a token — expect 401. Call with a valid Clerk token from the frontend — expect 200.

### 3C. Providers Module

- [x] Create `providers/provider-config.ts` — static registry of all supported models
- [x] Each entry includes: `id`, `displayName`, `provider`, `logoColor`, `defaultTemperature`, `contextWindow`, `costPer1kTokens`, `via`, `free`
- [x] Create `providers/providers.controller.ts` — `GET /providers`
- [ ] 🧪 Test: `GET /providers` returns the full list with correct fields

### 3D. Sessions Module

- [x] Install Supabase client in `apps/api` and create a `SupabaseService` singleton
- [x] Create `sessions/sessions.controller.ts` with routes:
  - [x] `GET /sessions` — list all sessions for current user (with search query param)
  - [x] `POST /sessions` — create a new session
  - [x] `GET /sessions/:id` — fetch a single session with its threads and messages
  - [x] `PATCH /sessions/:id` — update name/tags
  - [x] `DELETE /sessions/:id` — delete session and all nested data (cascade)
- [x] Create `sessions/sessions.service.ts` with Supabase query logic
- [x] Create `sessions/dto/session.dto.ts` — CreateSessionDto, UpdateSessionDto, SessionQueryDto
- [x] Install `class-validator` and `class-transformer` and enable `ValidationPipe` globally
- [ ] 🧪 Test: Create a session via `POST /sessions`, retrieve it via `GET /sessions/:id`, delete it

### 3E. Threads Module

- [x] Create `threads/threads.controller.ts` with routes:
  - [x] `POST /threads` — create a thread (body includes sessionId)
  - [x] `DELETE /threads/:id` — remove a thread
- [x] Create `threads/threads.service.ts`
- [x] Create `threads/dto/thread.dto.ts`
- [ ] 🧪 Test: Create a session, then create two threads for different model IDs. Verify they persist.

### 3F. Streaming Module 🔑 ⚠️

- [ ] Install `axios` or use Node.js native `fetch` for OpenRouter SSE requests
- [ ] Create `streaming/streaming.controller.ts` with route:
  - [ ] `POST /streaming/prompt` — accepts `{ sessionId, prompt, modelIds[] }`
- [ ] Create `streaming/streaming.service.ts` with:
  - [ ] `fanOut(prompt, threads)` — fires concurrent OpenRouter requests via `Promise.all`
  - [ ] Each request sent to `https://openrouter.ai/api/v1/chat/completions` with `stream: true`
  - [ ] Set `HTTP-Referer` and `X-Title` headers (required by OpenRouter for identification)
  - [ ] Handle SSE response: parse `data: {...}` lines, forward tokens to the client
- [ ] Create `streaming/sse.helper.ts` — utility to write `data: ...\n\n` formatted SSE to the response
- [ ] Use NestJS `@Sse()` decorator or raw `res.write()` on a streaming endpoint
- [ ] ⚠️ Each model gets its own SSE stream identified by `threadId` in the event type
- [ ] Save the completed assistant message to Supabase after stream finishes
- [ ] Handle stream errors per-model — do not let one failure kill the whole fan-out
- [ ] Include conversation history in each request (load prior messages from Supabase before sending)
- [ ] 🧪 Test: Send a prompt to two models simultaneously. Verify both stream back tokens and both messages persist in Supabase.

### 3G. Highlights Module

- [x] Create `highlights/highlights.controller.ts` with routes:
  - [x] `PATCH /messages/:id/bookmark` — toggle `is_bookmarked` on a message
  - [x] `GET /sessions/:sessionId/highlights` — return all bookmarked messages in a session
- [x] Create `highlights/highlights.service.ts`
- [ ] 🧪 Test: Bookmark a message, retrieve highlights for the session, verify message appears

### 3H. Backend Integration Test

- [ ] 🧪 Full flow test: authenticate → create session → send prompt to 3 models → receive streams → check messages in Supabase → bookmark one message → retrieve highlights
- [ ] All endpoints return correct HTTP status codes (200, 201, 400, 401, 404)
- [ ] 404 is returned when a session/thread that does not belong to the current user is requested

> **⬅️ NEXT STEP: Phase 3H — run the manual backend integration test, then move to Phase 5 E2E.**

---

## Phase 4 — Next.js Frontend

### 4A. Clerk Integration

- [x] Wrap `apps/web/src/app/layout.tsx` in `<ClerkProvider>`
- [x] Create `proxy.ts` at `apps/web/src/` using `clerkMiddleware` (Next.js 16 uses `proxy.ts`, not `middleware.ts`)
- [x] Add Clerk sign-in and sign-up pages:
  - [x] `app/sign-in/[[...sign-in]]/page.tsx`
  - [x] `app/sign-up/[[...sign-up]]/page.tsx`
- [x] Add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` to `.env.local`
- [x] Add a user button (avatar dropdown) to the sidebar using `<UserButton />` (Clerk)
- [x] 🧪 Test: Open the app unauthenticated — redirects to sign-in. Sign up works. ✅

### 4B. API Client Layer

- [x] Create `apps/web/src/lib/api.ts` — a fetch wrapper that:
  - [x] Reads the base URL from `NEXT_PUBLIC_API_URL` env variable
  - [x] Automatically attaches the Clerk session token to every request using `useAuth().getToken()`
  - [x] Exports typed functions: `getSessions()`, `createSession()`, `getSession()`, `updateSession()`, `deleteSession()`, `getProviders()`, `getHighlights()`
- [x] Create `apps/web/src/lib/streaming.ts` — SSE client helper that:
  - [x] Opens a `fetch` stream to `POST /streaming/prompt` with `AbortController` support
  - [x] Parses `event: <threadId>` lines and calls `onToken` callback per token
  - [x] Calls `onEnd` / `onError` per thread; `onDone` / `onFatalError` for the whole session

### 4C. State Management

- [x] Chosen: Zustand v5
- [x] Install Zustand: `zustand`
- [x] Create `apps/web/src/store/session.store.ts`:
  - [x] State: `activeSessions`, `currentSession`, `threads`, `messages` (keyed by threadId), `streamingState` per thread
  - [x] Actions: `loadSession`, `sendPrompt`, `bookmarkMessage`, `appendToken`
- [x] Create `apps/web/src/store/ui.store.ts`:
  - [x] State: `expandedThreadId` (null = grid view, threadId = expanded), `selectedProviders`, `sidebarOpen`, `highlightsPanelOpen`
  - [x] Actions: `expandThread`, `collapseThread`, `toggleSidebar`, `toggleHighlightsPanel`

### 4D. Main Dashboard Layout

- [x] Create `app/(dashboard)/layout.tsx` — the shell with sidebar + main area
- [x] Create a sidebar component (`Sidebar.tsx`) showing:
  - [x] New Session button
  - [x] List of sessions (clickable, with name)
  - [x] Delete session — hover-reveal trash icon per session item
  - [x] User account area with `<UserButton />`
  - [ ] Search input for filtering sessions _(deferred to Phase 4I)_
- [x] Create a top bar component (`TopBar.tsx`) with:
  - [x] Current session name
  - [x] Highlights toggle button
  - [x] Mobile hamburger menu
- [x] Create `app/(dashboard)/page.tsx` — welcome landing when no session is open
- [x] 🧪 Test: Dashboard renders with sidebar. Sessions list populates from the API. ✅

### 4E. Provider / Model Selector

- [x] Create `components/organisms/ProviderSelector.tsx`:
  - [x] Fetches the provider list from `GET /providers`
  - [x] Renders each provider as a toggleable card (`ProviderCard.tsx`) with logo color + name
  - [x] Selected providers stored in Zustand UI store
- [x] The selector opens as a modal when clicking "Add Models" in the session toolbar
- [x] Selected providers create threads via `POST /threads` on confirm
- [ ] 🧪 Test: Toggle 3 providers. Create session. Verify session has correct threads.

### 4F. AI Response Tiles (Core UI) 🔑 ⚠️

- [x] Create `components/organisms/TileGrid.tsx` — CSS Grid layout:
  - [x] Renders one `<AITile>` per active thread
  - [x] Grid is responsive: 1 col on mobile, 2 on tablet, 3+ on desktop
  - [x] When `expandedThreadId` is set: expanded tile takes full area via overlay
- [x] Create `components/organisms/AITile.tsx`:
  - [x] Shows model name + provider color accent border in header (`ThreadHeader.tsx`)
  - [x] Shows streaming state via `StatusDot` atom (idle / streaming / done / error)
  - [x] Renders message content using `react-markdown` + `remark-gfm`
  - [x] Hover state reveals toolbar: Bookmark icon, Copy icon (via `MessageBubble.tsx`)
  - [x] Expand icon triggers `expandThread(threadId)` in Zustand
- [x] Install `react-markdown`, `remark-gfm`
- [x] All 56 shadcn/base-nova UI components installed in `src/components/ui/`
- [x] ⚠️ Fixed Zustand v5 infinite loop: `?? []` moved outside selector (new array ref per call triggered loop)
- [x] ⚠️ Fixed nested `<button>` hydration error: `TooltipTrigger render={<Button>}` prop pattern
- [ ] 🧪 Test: Send a prompt to 3 models. All three tiles stream simultaneously. Expand one — others still update.

### 4G. Prompt Input

- [x] Create `components/organisms/PromptInput.tsx`:
  - [x] Textarea (fixed rows, no auto-resize)
  - [x] Send button (disabled while any stream is active)
  - [x] Keyboard shortcut: Cmd/Ctrl+Enter to send
  - [x] Stop button (AbortController) cancels all active streams
- [x] On send:
  1. [x] All active threads' streaming status set to `streaming` in Zustand
  2. [x] `streamPrompt()` called — SSE fan-out begins
  3. [x] Tokens appended per tile as events arrive via `appendToken()`
  4. [x] `finishStream()` called per thread when stream ends; message persisted in Supabase by the backend
- [ ] 🧪 Test: Type a prompt, press Cmd+Enter — all active tiles begin streaming.

### 4H. Expanded Thread / Conversation View

- [x] When a tile is expanded, show the full conversation history (all prior messages in the thread)
- [x] Collapse button returns to grid view
- [ ] Secondary prompt input within the expanded view for continuing that specific thread
- [ ] Continued conversation sends only to that single model (not fan-out)
- [ ] 🧪 Test: Send a prompt, expand Claude's tile, send a follow-up — only Claude gets the follow-up.

### 4I. Session Management UI

- [x] Session list in sidebar — sorted by `updated_at`, click navigates to `/sessions/[id]`
- [x] Delete session — hover-reveal trash icon → calls `DELETE /sessions/:id` → navigates home
- [ ] Create `components/session/NewSessionModal.tsx` — name input + provider selector on session create _(currently provider is added after session is created)_
- [ ] Search bar in sidebar — debounced, calls `GET /sessions?search=`
- [ ] Inline rename — click session name → text input → blur saves via `PATCH /sessions/:id`
- [ ] Delete confirmation dialog
- [ ] 🧪 Test: Create 3 sessions. Search filters correctly. Delete one. Rename another.

### 4J. Highlights Tab

- [x] `HighlightsPanel.tsx` — slide-in panel, toggled from TopBar
- [x] Calls `GET /sessions/:sessionId/highlights`
- [x] Renders bookmarked messages via `HighlightCard.tsx`
- [x] Bookmark toggle in `AITile` → `MessageBubble` hover toolbar calls `PATCH /messages/:id/bookmark` and updates local state
- [ ] 🧪 Test: Bookmark 2 messages from different models. Open Highlights panel — both appear.

### 4K. Design System _(completed in this session)_

- [x] Install all 56 shadcn/base-nova components via `pnpm dlx shadcn@latest add --all`
- [x] `globals.css` — full light-theme CSS custom property system:
  - [x] Shadcn/base-ui vars (`--background`, `--foreground`, `--primary`, `--muted`, etc.)
  - [x] Tailwind v4 `@theme inline` — maps all vars to `--color-*` utilities (`bg-foreground`, `text-background`, `bg-primary`, etc.)
  - [x] Brand utilities: `bg-navy`, `text-teal`, `bg-surface`, `border-divider`, `text-danger`, `bg-success`, etc.
  - [x] `--radius-sm/md/lg/xl` variants
- [x] `layout.tsx` — Montserrat font (weights 300–800) replaces Geist
- [x] Full light theme applied to all components (replaced dark zinc/violet palette)
  - [x] Navy `#275D89` primary, Teal `#50C4CF` accent, White cards, `#F7F9FC` app shell
- [x] Fixed: `@tailwindcss/typography` plugin — must use `@plugin` syntax not `@import` in Tailwind v4

---

## Phase 5 — End-to-End Validation

### 5A. Full User Journey Tests

- [ ] 🧪 **Journey 1 — New Session:** Sign in → Create session → Select 5 providers → Send first prompt → All 5 tiles stream → All messages saved → Close browser → Reopen → Session still there with all messages
- [ ] 🧪 **Journey 2 — Conversation Continuation:** Open session → Expand GPT-4o tile → Send follow-up → Only GPT-4o responds → Messages append correctly
- [ ] 🧪 **Journey 3 — Bookmarking:** Send prompt → Bookmark Claude's response → Open Highlights tab → See bookmarked message → Copy it
- [ ] 🧪 **Journey 4 — Session Search:** Create 5 sessions with different names → Search for one by name → Correct result appears
- [ ] 🧪 **Journey 5 — Error Handling:** Disconnect network mid-stream → Tile shows error state with retry button → Click retry → Stream resumes

### 5B. Edge Cases

- [ ] What happens if OpenRouter is down? — Expected: error state per tile, rest of app still works
- [ ] What happens if a session has 0 active providers? — Expected: prompt input is disabled or shows a warning
- [ ] What happens with a very long response (10,000 tokens)? — Expected: tile scrolls, no performance degradation
- [ ] What happens if two browser tabs have the same session open? — Expected: define and document the behavior (last-write-wins is acceptable for MVP)
- [ ] What happens if the user navigates away mid-stream? — Expected: streams are aborted (implement AbortController)

---

## Phase 6 — Deployment

### 6A. Environment Preparation

- [ ] Create `.env.production` files documenting all required production variables (no actual secrets)
- [ ] Ensure no hardcoded `localhost` URLs exist in production code paths
- [ ] Ensure all API URLs are environment-variable-driven

### 6B. Vercel (Frontend)

- [ ] 💰 Create a Vercel account (free tier)
- [ ] Connect the GitHub repo to Vercel
- [ ] Set the root directory to `apps/web`
- [ ] Set build command: `pnpm build` (or `turbo build --filter=web`)
- [ ] Set output directory: `.next`
- [ ] Add all `NEXT_PUBLIC_*` environment variables in Vercel dashboard:
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
  - [ ] `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
  - [ ] `NEXT_PUBLIC_API_URL` (points to Railway backend URL)
- [ ] Trigger a deploy and verify the app loads
- [ ] Update Clerk dashboard with production Vercel URL in allowed redirect URLs
- [ ] 🧪 Test: Visit production URL, sign in, create a session

### 6C. Railway (Backend)

- [ ] 💰 Create a Railway account (~$5–10/mo)
- [ ] Connect the GitHub repo to Railway
- [ ] Set the root directory to `apps/api`
- [ ] Set build command: `pnpm build` (or `nest build`)
- [ ] Set start command: `node dist/main`
- [ ] Add all environment variables in Railway dashboard:
  - [ ] `OPENROUTER_API_KEY`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `CLERK_ISSUER_URL`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `PORT` (Railway sets this automatically)
  - [ ] `NODE_ENV=production`
  - [ ] `ALLOWED_ORIGINS` (your Vercel frontend URL, for CORS)
- [ ] Configure CORS in NestJS `main.ts` to only allow the Vercel origin in production
- [ ] Trigger a deploy and verify `/health` endpoint returns 200
- [ ] 🧪 Test: Call the NestJS API directly from Postman with a production Clerk token

### 6D. Post-Deployment Smoke Test

- [ ] Sign in via production URL
- [ ] Create a session
- [ ] Send a prompt to 3 models
- [ ] Verify all 3 streams complete
- [ ] Bookmark a response
- [ ] Check Highlights tab
- [ ] Reload page — session and messages persist
- [ ] Sign out and sign back in — session still there

---

## Phase 7 — Phase 2 Features _(post-MVP)_

### Settings & Configuration

- [ ] Create a Settings page at `/settings`
- [ ] Default model per provider (stored in Supabase as a user preferences row)
- [ ] Provider management UI — reorder providers, disable/enable, change default model
- [ ] Global default temperature setting

### Per-Session Enhancements

- [ ] Per-AI prompt tweaking panel (optional pre-send override per tile before sending)
- [ ] Session tags CRUD UI (create, filter by, remove tags)
- [ ] Session export — download full session as Markdown or plain text
- [ ] Export highlights only (for sharing or pasting into a doc)

### Cost Visibility

- [ ] Display token usage per response (OpenRouter returns this in the response body)
- [ ] Running cost counter per session (calculate from token counts × model pricing)
- [ ] Total monthly cost estimate on the Settings page

### Direct API Bypass

- [ ] Add `use_direct_api: true` flag to thread model config
- [ ] Implement per-provider direct API adapters (start with Anthropic, since it's most used)
- [ ] UI toggle in the per-tile settings to switch between OpenRouter and direct

---

## Phase 8 — Phase 3 Features _(future)_

- [ ] Geolocation context injection into system prompt (useful for local SEO queries)
- [ ] Response diff / comparison view (structured side-by-side when content is similar)
- [ ] Multi-user team access (enable Supabase RLS multi-user policies + Clerk org features)
- [ ] Shared team sessions with real-time sync (Supabase Realtime)
- [ ] Mobile-responsive polish pass
- [ ] AI-generated cross-model summary response (optional synthesis tile)

---

## Ongoing / Maintenance

- [ ] Monitor OpenRouter dashboard for unusual usage spikes
- [ ] Monitor Supabase free tier storage usage (alert at 400MB)
- [ ] Keep model IDs in `provider-config.ts` up to date as OpenRouter adds/deprecates models
- [ ] Rotate API keys every 90 days
- [ ] Review Clerk audit logs monthly

---

## Quick Reference — Key Environment Variables

| Variable                            | Used In    | Where to Get                      |
| ----------------------------------- | ---------- | --------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/web` | Clerk dashboard → API Keys        |
| `CLERK_SECRET_KEY`                  | `apps/api` | Clerk dashboard → API Keys        |
| `CLERK_ISSUER_URL`                  | `apps/api` | Clerk dashboard → JWT Templates   |
| `NEXT_PUBLIC_API_URL`               | `apps/web` | Your Railway backend URL          |
| `SUPABASE_URL`                      | `apps/api` | Supabase project → Settings → API |
| `SUPABASE_ANON_KEY`                 | `apps/api` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY`         | `apps/api` | Supabase project → Settings → API |
| `OPENROUTER_API_KEY`                | `apps/api` | openrouter.ai → Keys              |

---

## Quick Reference — Key OpenRouter Model IDs

| Display Name         | OpenRouter ID                 |
| -------------------- | ----------------------------- |
| Claude Sonnet        | `anthropic/claude-sonnet-4-5` |
| Claude Opus          | `anthropic/claude-opus-4`     |
| GPT-4o               | `openai/gpt-4o`               |
| GPT-4o Mini          | `openai/gpt-4o-mini`          |
| Gemini 1.5 Pro       | `google/gemini-1.5-pro`       |
| Gemini 2.0 Flash     | `google/gemini-2.0-flash-001` |
| Grok-2               | `x-ai/grok-2`                 |
| Perplexity Sonar Pro | `perplexity/sonar-pro`        |

> Verify all IDs at openrouter.ai/models before use — model IDs can change.

---

## Progress Tracker

| Phase                       | Status         | Notes                          |
| --------------------------- | -------------- | ------------------------------ |
| Phase 0 — Monorepo Baseline | 🟢 Done        | Complete                       |
| Phase 1 — External Services | 🟢 Done        | All three services configured  |
| Phase 2 — Database Schema   | 🟢 Done        | Schema applied in Supabase     |
| Phase 3 — NestJS Backend    | 🟢 Done        | All modules built incl. streaming; manual test pending |
| Phase 4 — Next.js Frontend  | 🟡 In Progress | Core UI + design system done; session search/rename + expanded single-thread prompt pending |
| Phase 5 — E2E Validation    | ⬅️ **NEXT**    | Run journeys 1–3 first         |
| Phase 6 — Deployment        | ⬜ Not Started |                                |
| Phase 7 — Phase 2 Features  | ⬜ Not Started | Post-MVP                       |
| Phase 8 — Phase 3 Features  | ⬜ Not Started | Future                         |

---

_End of checklist — v1 | Generated May 18, 2026_
