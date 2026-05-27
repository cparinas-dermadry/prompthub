import { Module } from '@nestjs/common';
import { StreamingController } from './streaming.controller.js';
import { StreamingService } from './streaming.service.js';
import { ProvidersModule } from '../providers/providers.module.js';

@Module({
  imports: [ProvidersModule],
  controllers: [StreamingController],
  providers: [StreamingService],
})
export class StreamingModule {}
