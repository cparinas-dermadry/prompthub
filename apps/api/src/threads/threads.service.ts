import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateThreadDto, UpdateThreadDto } from './dto/thread.dto.js';

@Injectable()
export class ThreadsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(userId: string, dto: CreateThreadDto) {
    // Run the ownership check and the INSERT in parallel to halve latency.
    // If the session check fails we cancel / ignore the insert result.
    const [sessionResult, insertResult] = await Promise.all([
      this.supabase.db
        .from('sessions')
        .select('id')
        .eq('id', dto.sessionId)
        .eq('user_id', userId)
        .maybeSingle(),
      this.supabase.db
        .from('threads')
        .insert({
          session_id: dto.sessionId,
          model_id: dto.modelId,
          display_name: dto.displayName,
          provider: dto.provider,
          model_config: dto.modelConfig ?? {},
        })
        .select()
        .single(),
    ]);

    if (!sessionResult.data) {
      // Clean up the orphaned thread if insert succeeded
      if (insertResult.data?.id) {
        await this.supabase.db.from('threads').delete().eq('id', insertResult.data.id);
      }
      throw new NotFoundException('Session not found');
    }

    if (insertResult.error) {
      throw new InternalServerErrorException(`Failed to create thread: ${insertResult.error.message}`);
    }

    return insertResult.data;
  }

  async update(id: string, userId: string, dto: UpdateThreadDto) {
    // Verify ownership, then update in one round-trip via a conditional update
    const { data: thread } = await this.supabase.db
      .from('threads')
      .select('id, sessions!inner(user_id)')
      .eq('id', id)
      .single();

    if (!thread) throw new NotFoundException('Thread not found');
    const sessions = thread.sessions as unknown as { user_id: string } | { user_id: string }[];
    const sessionUserId = Array.isArray(sessions) ? sessions[0]?.user_id : sessions?.user_id;
    if (sessionUserId !== userId) throw new NotFoundException('Thread not found');

    const { data, error } = await this.supabase.db
      .from('threads')
      .update({
        model_id: dto.modelId,
        display_name: dto.displayName,
        ...(dto.modelConfig ? { model_config: dto.modelConfig } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async remove(id: string, userId: string) {
    // Verify ownership via session join
    const { data: thread } = await this.supabase.db
      .from('threads')
      .select('id, sessions!inner(user_id)')
      .eq('id', id)
      .single();

    if (!thread) throw new NotFoundException('Thread not found');

    const sessions = thread.sessions as unknown as { user_id: string } | { user_id: string }[];
    const sessionUserId = Array.isArray(sessions) ? sessions[0]?.user_id : sessions?.user_id;
    if (sessionUserId !== userId) throw new NotFoundException('Thread not found');

    const { error } = await this.supabase.db.from('threads').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
