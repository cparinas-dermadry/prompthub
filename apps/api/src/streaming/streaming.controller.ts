import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StreamingService } from './streaming.service.js';
import { SendPromptDto } from './dto/send-prompt.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('streaming')
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  @Post('prompt')
  async sendPrompt(
    @Body() dto: SendPromptDto,
    @CurrentUser() user: { sub: string },
    @Res() res: Response,
  ): Promise<void> {
    await this.streamingService.fanOut(dto.sessionId, dto.prompt, dto.threadIds, user.sub, res);
  }
}
