/**
 * Boot-time environment validation.
 *
 * Wired into ConfigModule.forRoot({ validate: validateEnv }) — Nest calls
 * this once on app start. Throwing here makes the server refuse to come up
 * with a half-configured environment, which is much safer than discovering
 * a missing env var at the first request (or worse, at first paid
 * OpenRouter call returning `Bearer undefined`).
 *
 * Only flags REQUIRED vars; everything optional is documented in
 * .env.example but doesn't gate boot.
 */

const REQUIRED_ENV_VARS = [
  'CLERK_SECRET_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Required even in Phase 1 of the RLS rollout: the new UserSupabaseService
  // needs the anon key to build per-request user-scoped clients. Service-role
  // is still used for current routes, but the plumbing wants this on hand.
  'SUPABASE_ANON_KEY',
  'OPENROUTER_API_KEY',
] as const;

const RECOMMENDED_ENV_VARS = [
  'ALLOWED_ORIGINS',
  'CLERK_AUTHORIZED_PARTIES',
  'CLERK_ISSUER_URL',
] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = config[key];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `See apps/api/.env.example for the full list.`,
    );
  }

  // Soft warnings — log but don't refuse to boot. These all have safe
  // fallbacks (CORS default of localhost, no authorizedParties check, etc.)
  // but the fallbacks open up small risks in production.
  const missingRecommended = RECOMMENDED_ENV_VARS.filter((key) => !config[key]);
  if (missingRecommended.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Recommended env vars not set (defaults will apply): ${missingRecommended.join(', ')}`,
    );
  }

  return config;
}
