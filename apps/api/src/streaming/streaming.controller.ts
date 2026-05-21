import { Controller, Post, Body, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { StreamingService } from './streaming.service.js';
import { SendPromptDto } from './dto/send-prompt.dto.js';
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
    await this.streamingService.fanOut(dto.sessionId, dto.prompt, dto.threadIds, user.sub, res);
  }
}
