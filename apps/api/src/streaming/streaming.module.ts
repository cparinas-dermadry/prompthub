import { Module } from '@nestjs/common';
import { StreamingController } from './streaming.controller.js';
import { StreamingService } from './streaming.service.js';

@Module({
  controllers: [StreamingController],
  providers: [StreamingService],
})
export class StreamingModule {}
