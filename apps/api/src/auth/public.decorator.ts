import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by ClerkGuard to detect routes that should bypass
 * authentication entirely. Keep in sync with the lookup in clerk.guard.ts.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a controller or route handler as publicly accessible — no Clerk JWT
 * required. Use sparingly: today this is only for the `/health` endpoint
 * consumed by Render's health checks and the UptimeRobot keep-alive pinger.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
