# PromptHub — Deployment Guide (Free Tier Path)

**Date:** May 23, 2026
**Target profile:** 1-3 users, personal / internal use
**Budget:** $0/month if you stay within free quotas

---

## The recommended stack

| Layer | Host | Why | Free quota |
|---|---|---|---|
| Frontend (`apps/web`) | **Vercel Hobby** | First-party Next.js host. Next.js 16 features just work. Zero-config deploys from GitHub. | 100 GB bandwidth/mo, 1M function invocations/mo, 4 hr Active CPU/mo |
| Backend (`apps/api`) | **Koyeb Free Service** | Only major host left with a real-free, no-credit-card, no-forced-sleep tier that supports long-running SSE. | 1 web service, 0.1 vCPU, 512 MB RAM, scale-to-zero when idle |
| Database | **Supabase Free** (already set up) | You're using it. | 500 MB DB, 5 GB egress, 50k MAUs |
| Auth | **Clerk Free** (already set up) | You're using it. | 10k MAUs |
| AI gateway | **OpenRouter** (already set up) | You're using it. | Pay-as-you-go, free models work without a card |

Total cost for 1-3 users: **$0/month**, as long as you don't make the app public.

### Why this stack and not Railway?

Railway dropped its free tier — it's now a $5/mo trial credit then paid. Render's free web service spins down after 15 minutes of inactivity, which interrupts SSE streams ungracefully and adds a 30-60s cold start. Fly.io also removed its free allowance for new accounts. Koyeb's free tier is the last one standing that gives you a Node-friendly always-on-ish container with no credit card required.

### One important Vercel caveat

Vercel's Hobby plan is **"non-commercial, personal use only"** per their TOS. If PromptHub becomes something you sell or run for paying customers, you'll need to upgrade to Pro ($20/mo) or migrate the frontend elsewhere (Cloudflare Pages and Netlify both have commercial-friendly free tiers).

---

## Pre-deploy checklist

Assuming you've already worked through the technical audit fixes, the remaining setup work is:

**Audit items that block deploy** (re-confirm done):

- Stray `claude-api-key` rotated and removed from `apps/api/.env` (C-1)
- `CLERK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` stripped from `apps/web/.env.local` (C-2)
- `apps/web/package-lock.json` deleted; only `pnpm-lock.yaml` tracked (M-6)
- `reselect` added to `apps/web/package.json` (H-5)
- Model IDs in `MODEL_MIGRATIONS` / `PROVIDER_REGISTRY` reconciled against OpenRouter's live list (H-1)
- `packages/types` reconciled with API contract; `pnpm -r build` succeeds (H-2)

**Deploy-specific items:**

- `apps/api/src/app.controller.ts` is currently auth-gated by the global Clerk guard. Either add a `/health` endpoint exempted via a `@Public()` decorator pattern, or accept that Koyeb's health checks will see 401s (which Koyeb treats as "alive" anyway, so this is cosmetic).
- Pick a production-friendly value for `THROTTLE_STREAMING_LIMIT` — 20/min on a single dyno is fine for 3 users.
- Decide on your production CORS allowlist. For a Vercel deploy that will be `https://your-app.vercel.app` (plus any preview URLs you want to allow — see notes below).

---

## Step-by-step deployment

### Part 1 — Push to GitHub

If your repo isn't on GitHub yet:

```bash
gh repo create prompthub --private --source=. --remote=origin --push
```

Or via the GitHub UI: create an empty repo, then `git remote add origin <url> && git push -u origin main`.

Keep the repo **private**. Even with secrets gitignored, you don't want curious eyeballs on your provider config and CSP gaps.

### Part 2 — Deploy the backend on Koyeb

The backend goes first because the frontend needs to know the backend's URL.

**1. Create a Koyeb account** at koyeb.com. They no longer require a credit card for the free service tier.

**2. Connect GitHub.** Settings → Git providers → install the Koyeb GitHub app and grant it access to your `prompthub` repo.

**3. Create a new service** — pick "Web service" → "GitHub" as source.

- Repository: your `prompthub` repo
- Branch: `main`
- Run command: `node apps/api/dist/main.js`
- Build command: `pnpm install --frozen-lockfile && pnpm --filter api build && pnpm --filter @prompthub/types build`
- Builder: Buildpacks (auto-detects Node) — or pick "Dockerfile" if you'd rather write one
- Instance type: **Free** (this is the only free option you get; 0.1 vCPU / 512 MB)
- Region: Frankfurt or Washington DC (Frankfurt is closer to most users; Washington has lower latency to OpenRouter)
- Port: `3001` (matches the default in `apps/api/main.ts:25`)

**4. Set environment variables** in the Koyeb service config:

```
CLERK_SECRET_KEY=sk_live_...           ← rotate to live key for prod (see Clerk section below)
CLERK_ISSUER_URL=https://<your>.clerk.accounts.dev
CLERK_AUTHORIZED_PARTIES=https://<your-frontend>.vercel.app
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
OPENROUTER_API_KEY=sk-or-v1-...
ALLOWED_ORIGINS=https://<your-frontend>.vercel.app
NODE_ENV=production
PORT=3001
THROTTLE_STREAMING_LIMIT=20
THROTTLE_DEFAULT_LIMIT=60
```

You won't know your Vercel URL yet — that's fine, deploy without it first, get a placeholder, then come back and update `CLERK_AUTHORIZED_PARTIES` and `ALLOWED_ORIGINS` once Vercel's done.

**5. Deploy.** First build takes 3-5 minutes. Once it's green, Koyeb gives you a public URL like `https://prompthub-yourorg.koyeb.app`. Save this — Vercel needs it.

**6. Smoke-test the API** from your laptop:

```bash
curl https://prompthub-yourorg.koyeb.app/
# expect: 401 Unauthorized (good — global Clerk guard is working)
```

If you see `Cannot find module '...'` or similar build errors, the most likely cause is the monorepo build dependency order — the `@prompthub/types` package has to build before `api`. The build command above handles this; if you're using a Dockerfile, make sure it does too.

### Part 3 — Configure Supabase for production

Supabase doesn't have a separate "prod" environment on the free tier — you have one project. That's fine for 1-3 users, but it means dev and prod will share a database. To keep them safe:

**1. Verify RLS policies are applied** in production by running this in the Supabase SQL editor:

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('sessions','threads','messages')
ORDER BY tablename, cmd;
```

You should see 4 policies per table (select/insert/update/delete) — no `deny_all_*` rows. If you see deny-all, migration `003` didn't run; apply it now.

**2. Enable Third-Party Auth with Clerk** (Supabase Dashboard → Authentication → Third-Party Auth → Clerk). The Frontend API URL must exactly match `CLERK_ISSUER_URL` in your Koyeb env. Migration `003` depends on this being live — without it, `auth.jwt()->>'sub'` returns null and RLS will lock everyone out.

**3. Set up a daily backup.** Supabase free tier doesn't auto-backup, but you can manually dump:

```bash
pg_dump "postgresql://postgres.<project>:[password]@aws-0-<region>.pooler.supabase.com:6543/postgres" \
  --no-owner --no-acl --data-only > backup-$(date +%F).sql
```

Run this as a weekly cron on your laptop until you outgrow the free tier.

### Part 4 — Configure Clerk for production

Clerk's free tier lets you have one application with both dev and prod instances, OR a separate prod application. Easiest path: stay on the same Clerk app but switch to **production keys**.

**1. In Clerk Dashboard → API Keys, switch the instance toggle to "Production"** and grab the `sk_live_...` and `pk_live_...` keys.

**2. Update your environment vars** with the live keys (Koyeb gets `sk_live_...`, Vercel gets `pk_live_...`).

**3. Add allowed origins** in Clerk → Domains → add `https://<your-frontend>.vercel.app`.

**4. JWT template** — verify the JWT template you're using is enabled in production mode too. If you didn't set up a custom template and are using Clerk's default session token, no action needed.

### Part 5 — Deploy the frontend on Vercel

**1. Create a Vercel account** at vercel.com, sign in with GitHub.

**2. Import the project** — New Project → pick `prompthub` repo.

**3. Configure the build:**

- Framework Preset: Next.js (auto-detected)
- Root Directory: `apps/web`
- Build Command: `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @prompthub/types build && pnpm --filter web build`
- Output Directory: `.next` (default)
- Install Command: leave default (`pnpm install`)

The build command climbs back to the monorepo root because Vercel by default only sees `apps/web` when you set the root directory there. Climbing back lets it resolve workspace dependencies.

**4. Environment variables** in Vercel project settings → Environment Variables:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
NEXT_PUBLIC_API_URL=https://prompthub-yourorg.koyeb.app
```

Set all of these for **Production**, **Preview**, and **Development** environments. The Koyeb URL is the one you grabbed in Part 2.

**5. Deploy.** First build is ~2 minutes. Vercel gives you `https://prompthub.vercel.app` (or with a hash if the name's taken).

### Part 6 — Wire everything together

Now that both sides have URLs, fix the cross-references:

**1. In Koyeb**, update:

```
ALLOWED_ORIGINS=https://prompthub.vercel.app
CLERK_AUTHORIZED_PARTIES=https://prompthub.vercel.app
```

Then redeploy the Koyeb service so the new env vars take effect.

**2. In Clerk**, add `https://prompthub.vercel.app` to allowed origins.

**3. (Optional but recommended) Custom domain.** Both Vercel and Koyeb support custom domains on free tiers. Buying `prompthub.yourname.com` on Namecheap costs ~$10/year and gets you off the `*.vercel.app` / `*.koyeb.app` subdomains, which is nice for sharing.

---

## Post-deploy smoke test

Run through these in order. Each one assumes the previous passed.

**1.** Open `https://prompthub.vercel.app` in an incognito window. You should be redirected to Clerk's sign-in page.

**2.** Sign up with a real email. After verification you should land on the dashboard.

**3.** Click "New Session," pick a free model (e.g. DeepSeek V4 Flash), and send a one-word prompt. You should see tokens stream in within ~3 seconds.

**4.** Open the browser dev tools → Network tab → filter on "streaming/prompt." Confirm it's a `POST` with an `Authorization: Bearer` header and that the response is `text/event-stream` with no CORS errors.

**5.** Refresh the page. The session should reappear in the sidebar with all messages intact (this verifies Supabase persistence is working through the live RLS policies).

**6.** Bookmark a message, open the highlights panel, confirm it appears.

**7.** Open a second browser (or a friend's machine), sign up with a different email, create a session. Then in the Supabase SQL editor run:

```sql
SELECT user_id, count(*) FROM sessions GROUP BY user_id;
```

You should see two distinct `user_id` rows. This is your tenancy isolation working — neither user should be able to see the other's sessions in the UI.

If all 7 pass, you're live.

---

## Common gotchas

**Koyeb service goes to sleep after extended idle.** "Scale to zero" means after no traffic for a while, your instance shuts down. The first request after that takes 5-15s to warm up — not great UX but tolerable for personal use. If it's bothering you, set up a free uptime monitor (UptimeRobot, Better Stack) to ping your API every 5 minutes. The Clerk-guarded `/` endpoint returning 401 still counts as a successful ping.

**Vercel build fails with "Cannot find module '@prompthub/types'".** The build needs to compile `packages/types` before `apps/web`. The build command in Part 5 handles this with `pnpm --filter @prompthub/types build` before `pnpm --filter web build`. If it still fails, check that `packages/types/package.json` has the build script and that `packages/types/dist/` is gitignored (not committed).

**SSE streams cut off after 30-60s.** Almost certainly a proxy idle timeout. The audit flagged this as M-2 — implement the keepalive ping (`: ping\n\n` every 15s in `streaming.service.ts`) before launch.

**"Invalid or expired token" in the API logs but the user just signed in.** Clerk's clock-skew tolerance is tight. Check your Koyeb instance's clock with `date` (Buildpacks usually keep this synced via NTP, but if it drifts more than 5 seconds, JWT verification fails).

**Supabase free tier pauses the project after 7 days of no activity.** If you stop using the app for a week, the Supabase project goes into a paused state. Restore it from the Supabase dashboard with one click. Data is not lost.

**Vercel preview deployments break Clerk auth.** Every Vercel preview gets a unique URL like `prompthub-abc123.vercel.app`. Clerk's `authorizedParties` check will reject tokens minted on these URLs unless you add them. Easiest fix: use Vercel's wildcard domain pattern in Clerk → Domains, or just don't worry about preview environments for personal use.

---

## Cost watch — when to upgrade

You'll know it's time to leave the free tier when:

- **Koyeb**: Your instance is hitting 0.1 vCPU constantly (visible in the Koyeb dashboard). Their next tier is ~$5/mo for 0.5 vCPU / 1 GB RAM.
- **Vercel**: You're approaching the 100 GB bandwidth cap, or you're using the app commercially. Pro is $20/mo/seat.
- **Supabase**: You're approaching 500 MB database size or 5 GB egress. The Pro tier is $25/mo.
- **Clerk**: You cross 10k MAUs. Pro is $25/mo + $0.02 per MAU above 10k.
- **OpenRouter**: Pay-as-you-go from the start — no free quota to leave. Watch the dashboard; set a billing alert.

For a 1-3 user personal deployment, you'll comfortably stay in free tiers for as long as you'd care to.

---

## What I'd skip for personal use

- **CI/CD via GitHub Actions** — nice to have, but for 1-3 users where you're the only committer, Vercel and Koyeb both auto-deploy on `git push` to `main`. Add Actions when you have collaborators.
- **Custom domain** — only if you care about the URL. The default `*.vercel.app` works fine.
- **Per-environment Clerk apps** — one production Clerk app is fine. Make a separate dev app if you ever want to test breaking changes without nuking your real user data.
- **Monitoring/observability beyond Koyeb + Vercel built-in dashboards** — both surface basic metrics. Don't pay for Datadog or Sentry until something actually goes wrong that you couldn't debug.

---

## Reference

- [Koyeb free tier docs](https://www.koyeb.com/docs/faqs/pricing) — current as of audit date
- [Vercel Hobby limits](https://vercel.com/docs/plans/hobby) — note the non-commercial-use clause
- [Supabase pricing](https://supabase.com/pricing)
- [Clerk pricing](https://clerk.com/pricing)
- [OpenRouter docs](https://openrouter.ai/docs)

_End of guide._
