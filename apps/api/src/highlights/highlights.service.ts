import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class HighlightsService {
  constructor(private readonly supabase: SupabaseService) {}

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

    if (error) throw new Error(error.message);
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

    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
