import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { validateEnv } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Single per-IP throttle bucket applied to every route. The
    // /streaming/prompt endpoint overrides this with a tighter limit
    // (see StreamingController) because each call fans out to N paid
    // OpenRouter requests, so it's the cost-exfiltration ceiling.
    // Both default and streaming limits are env-configurable.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_DEFAULT_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_DEFAULT_LIMIT ?? 60),
      },
    ]),
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
    // ThrottlerGuard MUST come before ClerkGuard in the APP_GUARD list so
    // we reject hot-spamming clients before doing the (more expensive) JWT
    // verification.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ClerkGuard,
    },
  ],
})
export class AppModule {}
