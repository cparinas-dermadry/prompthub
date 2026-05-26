import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserSupabaseService } from '../supabase/user-supabase.service.js';

/**
 * Phase 2: uses UserSupabaseService — the two-level-deep RLS policy on
 * `messages` (message → thread → session → user) does the heavy lifting.
 * The explicit ownership checks below remain so an RLS policy bug can't
 * silently expose other users' bookmarks.
 */
@Injectable()
export class HighlightsService {
  private readonly logger = new Logger(HighlightsService.name);

  constructor(private readonly supabase: UserSupabaseService) {}

  async toggleBookmark(messageId: string, userId: string) {
    // Verify ownership: message → thread → session → user
    const { data: message } = await this.supabase.db
      .from('messages')
      .select('id, is_bookmarked, threads!inner(session_id, sessions!inner(user_id))')
      .eq('id', messageId)
      .single();

    if (!message) throw new NotFoundException('Message not found');

    const thread = message.threads as unknown as {
      session_id: string;
      sessions: { user_id: string };
    };
    if (thread.sessions.user_id !== userId) throw new NotFoundException('Message not found');

    const { data, error } = await this.supabase.db
      .from('messages')
      .update({ is_bookmarked: !message.is_bookmarked })
      .eq('id', messageId)
      .select('id, is_bookmarked')
      .single();

    if (error) {
      this.logger.error(`toggleBookmark failed: ${error.message}`);
      throw new InternalServerErrorException('Database error');
    }
    return data;
  }

  async getHighlights(sessionId: string, userId: string) {
    // Verify session ownership
    const { data: session } = await this.supabase.db
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) throw new NotFoundException('Session not found');

    const { data, error } = await this.supabase.db
      .from('messages')
      .select('id, content, timestamp, is_bookmarked, threads!inner(id, model_id, display_name, provider, session_id)')
      .eq('threads.session_id', sessionId)
      .eq('is_bookmarked', true)
      .order('timestamp', { ascending: true });

    if (error) {
      this.logger.error(`getHighlights failed: ${error.message}`);
      throw new InternalServerErrorException('Database error');
    }
    return data ?? [];
  }
}
