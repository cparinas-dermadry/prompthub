import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ClerkGuard } from './auth/clerk.guard.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { ThreadsModule } from './threads/threads.module.js';
import { StreamingModule } from './streaming/streaming.module.js';
import { HighlightsModule } from './highlights/highlights.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    SupabaseModule,
    ProvidersModule,
    SessionsModule,
    ThreadsModule,
    StreamingModule,
    HighlightsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ClerkGuard,
    },
  ],
})
export class AppModule {}
