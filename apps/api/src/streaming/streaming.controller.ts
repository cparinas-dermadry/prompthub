import { Controller, Post, Body, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { StreamingService } from './streaming.service.js';
import { SendPromptDto } from './dto/send-prompt.dto.js';
import { RetryPromptDto } from './dto/retry-prompt.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('streaming')
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  // Override the global default throttle (60 req/min) with a tighter limit
  // for the fan-out endpoint. Each call can fire up to N paid OpenRouter
  // requests (N capped by ArrayMaxSize(10) on threadIds), so this is the
  // cost-exfiltration ceiling. Defaults: 20 req/min/IP — override via
  // THROTTLE_STREAMING_LIMIT / THROTTLE_STREAMING_TTL_MS.
  @Throttle({
    default: {
      limit: Number(process.env.THROTTLE_STREAMING_LIMIT ?? 20),
      ttl: Number(process.env.THROTTLE_STREAMING_TTL_MS ?? 60_000),
    },
  })
  @Post('prompt')
  async sendPrompt(
    @Body() dto: SendPromptDto,
    @CurrentUser() user: { sub: string },
    @Res() res: Response,
  ): Promise<void> {
    await this.streamingService.fanOut(
      dto.sessionId,
      dto.prompt,
      dto.threadIds,
      user.sub,
      res,
      dto.location,
    );
  }

  // Retry is rate-limited slightly more generously than fan-out — retries are
  // expected to be more frequent (one failed model at a time) but the worst
  // case is still N parallel OpenRouter calls capped at 10 per request.
  // Defaults: 30 req/min/IP — override via THROTTLE_RETRY_LIMIT / THROTTLE_RETRY_TTL_MS.
  @Throttle({
    default: {
      limit: Number(process.env.THROTTLE_RETRY_LIMIT ?? 30),
      ttl: Number(process.env.THROTTLE_RETRY_TTL_MS ?? 60_000),
    },
  })
  @Post('retry')
  async retryPrompt(
    @Body() dto: RetryPromptDto,
    @CurrentUser() user: { sub: string },
    @Res() res: Response,
  ): Promise<void> {
    // Build a single map of per-thread overrides. Each value can carry an
    // optional prompt edit AND/OR a fromMessageId rewind point.
    const overrides = new Map<string, { prompt?: string; fromMessageId?: string }>(
      (dto.edits ?? []).map((e) => [
        e.threadId,
        { prompt: e.prompt, fromMessageId: e.fromMessageId },
      ]),
    );
    await this.streamingService.retryThreads(
      dto.sessionId,
      dto.threadIds,
      overrides,
      user.sub,
      res,
      dto.location,
    );
  }
}
