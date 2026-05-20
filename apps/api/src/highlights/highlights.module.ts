import { Module } from '@nestjs/common';
import { HighlightsController } from './highlights.controller.js';
import { HighlightsService } from './highlights.service.js';

@Module({
  controllers: [HighlightsController],
  providers: [HighlightsService],
})
export class HighlightsModule {}
