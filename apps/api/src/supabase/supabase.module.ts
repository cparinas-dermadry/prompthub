import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service.js';
import { UserSupabaseService } from './user-supabase.service.js';

@Global()
@Module({
  // SupabaseService — service-role, singleton, bypasses RLS. Use for
  // system/admin operations or for tables that don't have user-owned rows.
  //
  // UserSupabaseService — request-scoped, anon key + caller's Clerk JWT,
  // runs UNDER RLS. Use for any query that should be tenant-isolated.
  // (Not consumed by any service yet — wired in Phase 2.)
  providers: [SupabaseService, UserSupabaseService],
  exports: [SupabaseService, UserSupabaseService],
})
export class SupabaseModule {}
