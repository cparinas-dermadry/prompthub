import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator.js';

@Controller()
export class AppController {
  /**
   * Unauthenticated health endpoint used by:
   *   - Render's built-in health check on the web service
   *   - UptimeRobot's 5-minute keep-alive pinger (prevents Render Free's
   *     15-minute idle spin-down so we don't cold-start mid-SSE-stream)
   *
   * Marked @Public() so the global ClerkGuard skips JWT verification here.
   * Returns a tiny payload — no DB or downstream provider calls, so a
   * 200 here means "Node is up", not "the whole system is healthy". That's
   * intentional: a deeper check would defeat the purpose of a cheap ping.
   */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
