import { Module } from '@nestjs/common';
import { ClerkGuard } from './clerk.guard.js';

@Module({
  providers: [ClerkGuard],
  exports: [ClerkGuard],
})
export class AuthModule {}
