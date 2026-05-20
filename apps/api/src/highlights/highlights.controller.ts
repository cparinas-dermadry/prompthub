import { Controller, Patch, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { HighlightsService } from './highlights.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller()
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Patch('messages/:id/bookmark')
  @HttpCode(HttpStatus.OK)
  toggleBookmark(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.highlightsService.toggleBookmark(id, user.sub);
  }

  @Get('sessions/:sessionId/highlights')
  getHighlights(@Param('sessionId') sessionId: string, @CurrentUser() user: { sub: string }) {
    return this.highlightsService.getHighlights(sessionId, user.sub);
  }
}
