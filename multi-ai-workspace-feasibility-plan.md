# Multi-AI Workspace — Feasibility Plan

### For an SEO Specialist Power Tool

_Updated May 2026 — v3_

---

## Executive Summary

**Verdict: Highly viable.** All five target AI providers (Claude, ChatGPT, Gemini, Grok, Perplexity) are accessible via OpenRouter — a unified AI routing layer — through a single OpenAI-compatible API. Combined with Next.js, NestJS, Supabase, and Clerk, this stack is modern, scalable, and well-supported. A solo JS/TS developer can build a functional MVP in 6–8 weeks.

The tool is built for one user (you), accessible from any device, protected by Clerk authentication, and backed by Supabase (PostgreSQL) so sessions persist and sync seamlessly across devices.

---

## 1. Project Definition

A browser-based workspace where a single prompt is dispatched simultaneously to multiple AI models. Responses stream live in a tiled dashboard. Any conversation thread can be expanded and continued independently. All threads are bound to a named, searchable session stored in Supabase — accessible and continuable from any device.

**Primary user:** SEO specialist (single user, MVP)
**Platform:** Web app (browser, any device)
**MVP scope:** One prompt → multiple AIs → live streaming → cloud session persistence → expandable chat view → response bookmarking

---

## 2. API Feasibility by Provider

### 2.1 Via OpenRouter (Recommended)

OpenRouter is a unified API gateway that proxies requests to hundreds of AI models through a single OpenAI-compatible endpoint. Instead of managing five separate API keys and provider integrations, you manage one OpenRouter API key and one integration layer.

| Provider           | Available on OpenRouter | Streaming | Notes                          |
| ------------------ | ----------------------- | --------- | ------------------------------ |
| Claude (Anthropic) | ✅ Yes                  | ✅ SSE    | All Sonnet, Opus, Haiku models |
| ChatGPT (OpenAI)   | ✅ Yes                  | ✅ SSE    | GPT-4o, GPT-4o mini, o1, o3    |
| Gemini (Google)    | ✅ Yes                  | ✅ SSE    | 1.5 Pro, 2.0 Flash, etc.       |
| Grok (xAI)         | ✅ Yes                  | ✅ SSE    | Grok-2, Grok-2 mini            |
| Perplexity         | ✅ Yes                  | ✅ SSE    | Sonar Pro, Sonar               |
| + 300 others       | ✅ Yes                  | ✅ SSE    | DeepSeek, Mistral, LLaMA, etc. |

**The key advantage:** Every model speaks the same OpenAI-compatible format through OpenRouter. No custom adapters, no per-provider streaming quirks to handle. Adding any new model is a single config entry.

**OpenRouter cost:** Adds approximately 5–10% markup on top of underlying model costs. Negligible for personal use. Direct API connections can be used alongside OpenRouter for any provider where you want zero markup.

### 2.2 Direct API Connections (Optional Fallback)

You can connect directly to any provider's API in parallel with OpenRouter. Useful when:

- You need provider-specific features OpenRouter doesn't expose (e.g. Perplexity's web search parameters)
- You have an enterprise contract with a provider and want to use those credentials directly
- You want to bypass OpenRouter's markup for high-volume models

### 2.3 Estimated Monthly API Cost (Moderate SEO Usage)

- Claude Sonnet (via OpenRouter): ~$3–9/mo
- GPT-4o (via OpenRouter): ~$6–13/mo
- Gemini 1.5 Pro (via OpenRouter): ~$2–7/mo
- Grok (via OpenRouter): ~$3–9/mo
- Perplexity Sonar Pro (via OpenRouter): ~$5–11/mo
- **Total estimate: $19–49/month** (includes OpenRouter markup)

---

## 3. Technical Architecture

### 3.1 Final Stack

| Layer              | Choice                | Why                                                                          |
| ------------------ | --------------------- | ---------------------------------------------------------------------------- |
| Frontend           | Next.js + TypeScript  | React + built-in API routes, perfect for streaming, SSR where needed         |
| Styling            | Tailwind CSS          | Rapid UI iteration, works seamlessly with Next.js                            |
| Backend            | NestJS                | Structured, modular, scales cleanly as the project grows                     |
| AI Routing         | OpenRouter            | Single API key, 300+ models, OpenAI-compatible, no custom adapters           |
| Database           | Supabase (PostgreSQL) | Hosted Postgres, dashboard, generous free tier, official Next.js integration |
| Auth               | Clerk                 | Drop-in login, ~30 min to integrate, scales to team later                    |
| Hosting (frontend) | Vercel                | Made for Next.js, zero-config deploy, excellent free tier                    |
| Hosting (backend)  | Railway               | Clean Node.js/NestJS hosting, environment variable management                |

### 3.2 Architecture Overview

```
Browser (Next.js on Vercel)
    │
    ├── UI (React components, Tailwind)
    └── API calls → NestJS Backend (on Railway)
                        │
                        ├── Auth verification (Clerk)
                        ├── Session management (Supabase)
                        │
                        └── AI Fan-out via OpenRouter
                                ├── claude-sonnet-4-5
                                ├── gpt-4o
                                ├── gemini-1.5-pro
                                ├── grok-2
                                └── perplexity/sonar-pro
                                    (all same endpoint, diff model IDs)
```

The NestJS backend is the mandatory proxy layer — API keys never touch the browser. It handles fan-out, SSE streaming, Clerk token verification, and Supabase persistence.

### 3.3 Why NestJS for the Backend

NestJS enforces a clean modular architecture — each concern lives in its own module. For this project that means:

```
src/
  ├── auth/          (Clerk token verification)
  ├── sessions/      (session CRUD, search)
  ├── threads/       (per-AI conversation management)
  ├── providers/     (OpenRouter + direct API integrations)
  ├── streaming/     (SSE fan-out logic)
  └── highlights/    (bookmark management)
```

This structure makes the codebase easy to extend — adding a new feature means adding a new module, not touching existing logic.

**Honest tradeoff:** NestJS adds more boilerplate upfront than a plain Fastify server. If you want the fastest possible path to a working prototype, start with Next.js API routes and migrate to NestJS once the backend logic grows. Both are valid.

### 3.4 The Fan-Out Mechanism

When you send a prompt, the NestJS backend:

1. Verifies your Clerk session token
2. Loads the session + active model list from Supabase
3. Fires async requests to OpenRouter simultaneously (`Promise.all`), one per selected model
4. Opens a separate SSE stream back to the browser per model
5. Saves each completed response to Supabase

OpenRouter request structure (same for every model, only `model` field changes):

```js
POST https://openrouter.ai/api/v1/chat/completions
{
  model: "anthropic/claude-sonnet-4-5",  // or "openai/gpt-4o", "google/gemini-1.5-pro", etc.
  messages: [...conversationHistory],
  stream: true
}
```

### 3.5 Session Data Model

```
Session
  ├── id (uuid)
  ├── user_id (clerk user id)
  ├── name (string)
  ├── created_at
  ├── updated_at
  ├── tags (array)
  ├── active_providers (array of model ids)
  └── threads[]
        ├── model_id (e.g. "anthropic/claude-sonnet-4-5")
        ├── display_name (e.g. "Claude Sonnet")
        ├── provider (e.g. "anthropic")
        ├── model_config
        │     ├── system_prompt (optional override)
        │     ├── temperature
        │     └── use_direct_api (bool, bypass OpenRouter)
        ├── highlights[] (bookmarked responses)
        └── messages[]
              ├── role (user | assistant)
              ├── content (string)
              ├── timestamp
              └── is_bookmarked (boolean)
```

### 3.6 The Expand/Focus Interaction

- **Main view:** CSS Grid, all active AI tiles equal size, all streaming live
- **Expanded view:** Selected tile fills ~70% of screen, others shrink to a sidebar column — all continue streaming
- **Back:** Reverse animation, equal grid layout restored
- **Rule:** Expanding a tile never pauses or unmounts others — they keep running in the background

### 3.7 Uneven Response Speed Handling

Each tile has a clear visual state regardless of how fast or slow the model responds:

- **Streaming:** Animated cursor, live tokens appearing
- **Done:** Subtle completed indicator (checkmark or softened border)
- **Error:** Clear error state with a per-tile retry button

---

## 4. OpenRouter Integration — Adding a New AI Model

Because OpenRouter handles all translation, adding any new model is trivial.

### Provider config structure

```ts
{
  id: "anthropic/claude-sonnet-4-5",
  displayName: "Claude Sonnet",
  provider: "anthropic",
  logoColor: "#teal",
  defaultTemperature: 0.7,
  contextWindow: 200000,
  costPer1kTokens: { input: 0.003, output: 0.015 },
  via: "openrouter"   // or "direct" for bypass
}
```

### Process for adding a new model

1. Check that the model is listed on openrouter.ai/models
2. Add a config entry with the OpenRouter model ID (~5 lines)
3. Done — it appears as a new tile automatically

**Estimated time:** 5 minutes for any OpenRouter-supported model. No adapters. No new API keys. No new streaming logic.

For a model not on OpenRouter (rare), add a direct API config with a small adapter — same process as described in v2, roughly 1–2 hours the first time.

---

## 5. Model Selection Per Provider

Each provider offers multiple models at different price and capability tiers. Model selection is per-session and configurable globally in settings.

**How it works:**

- Each provider config lists its available models sourced from OpenRouter's model list
- Settings page has a default model per provider
- When creating a new session, you can override the model per provider
- The selected model ID is stored in the thread config in Supabase

**Example use cases for an SEO specialist:**

- GPT-4o for deep content briefs, GPT-4o mini for quick keyword checks (cost saving)
- Claude Opus for complex reasoning tasks, Claude Sonnet for fast research
- Run the same prompt on two tiers of the same provider to compare quality vs cost

---

## 6. Authentication

**Choice: Clerk (free tier)**

**Why Clerk:**

- Free tier covers single-user comfortably
- ~30 minutes to integrate with Next.js + NestJS
- Official Next.js SDK — drops in cleanly
- Handles session cookies, token refresh, and device persistence automatically
- If you ever add colleagues, invite them in the Clerk dashboard — zero code changes
- Significantly more secure than a hardcoded password on a public URL

**How it works:**

- App shows Clerk login on first visit
- You log in once — Clerk persists your session across all devices
- Every request to NestJS includes a Clerk session token in the header
- NestJS verifies the token via Clerk's SDK before any data access or API call

**Alternative:** NextAuth.js with GitHub login. Equally secure, slightly more DIY. Good if you prefer not to use a third-party service.

---

## 7. Supabase as the Database

Supabase is PostgreSQL with a hosted dashboard, auto-generated REST APIs, and an official Next.js + NestJS integration. It replaces the self-managed PostgreSQL + Drizzle setup from v2.

**What you get:**

- Hosted PostgreSQL — no database server to manage
- Dashboard to browse sessions, threads, and messages directly
- Supabase client SDK for clean queries in NestJS
- Generous free tier (500MB database, unlimited API requests)
- Row-level security for when/if you add more users

**Supabase free tier is sufficient for personal use.** The pro plan ($25/mo) is only needed if you exceed storage limits or want daily backups — not a concern at MVP.

---

## 8. Response Bookmarking (Highlights)

**How it works:**

- Each AI tile has a hover toolbar: bookmark icon + copy icon
- Bookmarking flags the message as `is_bookmarked: true` in Supabase
- Each session has a **Highlights tab** showing all bookmarked responses side by side
- Highlights persist with the session — accessible when you return days later

**Why this matters for SEO work:** When running the same prompt across 5 models (e.g. "write a meta description for this page"), Highlights becomes your shortlist inside the session without copy-pasting to a separate doc.

---

## 9. Feature Breakdown

### MVP (Phase 1)

| Feature                                | Complexity | Notes                              |
| -------------------------------------- | ---------- | ---------------------------------- |
| Single prompt → all AIs via OpenRouter | Low        | One endpoint, model ID per request |
| Live streaming per tile                | Medium     | SSE per model stream               |
| Tile expand/focus                      | Low        | CSS grid + transitions             |
| Streaming state indicators             | Low        | Done / streaming / error per tile  |
| Session creation & naming              | Low        | Supabase CRUD                      |
| Session history (searchable)           | Low        | Supabase full-text search          |
| AI + model selection per session       | Low        | Dropdown from provider config      |
| Conversation continuation per AI       | Medium     | Thread-aware message history       |
| Clerk authentication                   | Low        | ~30 min with Next.js SDK           |
| Supabase integration                   | Low        | Official Next.js + NestJS support  |
| Response bookmarking + highlights      | Low        | Flag + highlights tab per session  |

### Phase 2

| Feature                       | Complexity | Notes                                        |
| ----------------------------- | ---------- | -------------------------------------------- |
| Per-AI prompt tweaking panel  | Low        | Optional pre-send override per model         |
| Session tags/categories       | Low        | Good for SEO workflows                       |
| Default AI/model settings     | Low        | User preferences in Supabase                 |
| Provider management UI        | Medium     | Add/remove/reorder models in settings        |
| Export session (markdown/PDF) | Low        | Export full session or highlights only       |
| Token usage + cost counter    | Low        | OpenRouter returns token counts per response |

### Phase 3 (Scale)

| Feature                        | Complexity | Notes                                     |
| ------------------------------ | ---------- | ----------------------------------------- |
| Geolocation context injection  | Low        | Inject location into system prompt        |
| Multi-user team access         | Medium     | Already supported by Clerk + Supabase RLS |
| Team sessions / shared threads | High       | Real-time sync complexity                 |
| Response diff/comparison view  | Medium     | Structured side-by-side diff              |
| Direct API bypass per provider | Low        | Already designed into provider config     |

---

## 10. Technical Risks & Mitigations

| Risk                              | Severity | Mitigation                                                                        |
| --------------------------------- | -------- | --------------------------------------------------------------------------------- |
| OpenRouter downtime               | Low      | OpenRouter has strong uptime SLA. Add direct API fallback for critical providers. |
| Streaming reliability (SSE drops) | Medium   | Auto-reconnect per stream, buffer partial responses in state                      |
| Uneven response speeds            | Low      | Per-tile streaming state indicators                                               |
| OpenRouter cost markup            | Low      | ~5–10% markup negligible at personal scale. Bypass with direct API if needed.     |
| Long conversation context         | Medium   | Truncate or summarize old messages at a configurable limit                        |
| Supabase free tier limits         | Low      | 500MB is ample for personal use. Upgrade is $25/mo if needed.                     |
| NestJS boilerplate overhead       | Low      | Start with Next.js API routes if you want faster MVP, migrate to NestJS after     |

---

## 11. Development Roadmap

### Week 1–2: Foundation

- Initialize Next.js + NestJS monorepo
- Clerk authentication integrated (Next.js SDK + NestJS guard)
- Supabase project created, schema defined, client connected
- OpenRouter connected — single model streaming working end-to-end
- Basic tile layout with live streaming text

### Week 3–4: Core Experience

- Fan-out to all selected models via OpenRouter
- Provider config registry implemented
- Tile expand/focus interaction
- Streaming state indicators (done / streaming / error)
- Session creation and persistence in Supabase

### Week 5–6: Conversation Layer

- Per-thread conversation continuation
- Session history with search
- AI + model selection on new session
- Response bookmarking + highlights tab

### Week 7–8: Polish + Settings

- Per-AI prompt tweaking panel
- Session naming and tags
- Settings page (default model per provider, provider management)
- Token usage + cost counter per session

---

## 12. Scalability Design Principles

1. **OpenRouter as the abstraction layer.** Every AI provider speaks the same language through OpenRouter. Adding a new model = adding a config entry. No new adapters, no new API keys for most providers.

2. **NestJS modules as feature boundaries.** Each feature (sessions, threads, providers, streaming) lives in its own NestJS module. Adding a feature means adding a module, not touching existing code.

3. **Sessions as first-class Supabase objects.** Everything belongs to a session. Multi-device sync, export, and team sharing are all straightforward to add later.

4. **Backend as single source of truth.** All OpenRouter calls go through NestJS. Logging, cost tracking, rate limiting, and auth are all backend concerns — the browser never touches API keys.

5. **Auth-first from day one.** Clerk is integrated at MVP. Adding a team member is a Clerk dashboard action, not a code change.

6. **Direct API as an escape hatch.** The `via: "direct"` flag in provider config lets you bypass OpenRouter for any model without changing the rest of the architecture.

---

## 13. Total Cost of Ownership

| Item                             | Cost               |
| -------------------------------- | ------------------ |
| Vercel hosting (frontend)        | Free tier          |
| Railway hosting (NestJS backend) | ~$5–10/mo          |
| Supabase (database)              | Free tier          |
| OpenRouter API usage             | ~$19–49/mo         |
| Clerk auth                       | Free (single user) |
| Domain (optional)                | ~$12/yr            |
| **Total monthly**                | **~$24–59/mo**     |

A fully cloud-hosted, always-accessible, production-grade personal SEO tool.

---

## 14. Honest Assessment

**What makes this stack strong:**

- OpenRouter eliminates the biggest complexity from v2 — managing five separate API integrations. One key, one format, hundreds of models.
- Next.js + Vercel is the lowest-friction frontend deployment stack available today.
- Supabase gives you a real database with a UI to inspect your data — invaluable during development.
- NestJS keeps the backend organized as the feature set grows.

**What will take the most effort:**

- Getting SSE streaming to feel smooth and reliable across all models simultaneously
- Session and conversation state management in the UI
- The tile expand/focus animation feeling genuinely polished

**The honest NestJS caveat:**
NestJS has a steeper initial learning curve than plain Express or Fastify. If you've never used it, budget an extra 3–5 days in Week 1 just getting comfortable with its module system. Alternatively, start with Next.js API routes for MVP speed and introduce NestJS in a v2 refactor.

**What you should NOT build at MVP:**

- Team collaboration or shared sessions
- A mobile-native version
- AI-generated cross-model summaries or comparison views
- Direct API connections (OpenRouter handles everything at MVP)

**Verdict:** A solo TypeScript developer can have a working MVP in 6–8 focused weeks. The stack is modern, well-documented, and widely used. OpenRouter dramatically simplifies the AI integration layer compared to v2. This is a tool that genuinely does not exist in this form — and for an SEO specialist who lives across multiple AI tools daily, it would be a significant and lasting productivity upgrade.

---

_End of Feasibility Plan — v3_
