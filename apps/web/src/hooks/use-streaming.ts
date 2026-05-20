'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { streamPrompt } from '@/lib/streaming';
import { useSessionStore } from '@/store/session.store';
import type { Message } from '@prompthub/types';

/**
 * Manages the fan-out streaming lifecycle for a session.
 * Follows SRP: only responsible for streaming state and side-effects.
 */
export function useStreaming(sessionId: string) {
  const { getToken } = useAuth();
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const threads = useSessionStore((s) => s.threads);
  const { setAllStreaming, addMessage, appendToken, finishStream, setStreamError } = useSessionStore();

  const send = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || threads.length === 0 || isStreaming) return;

      // Filter out optimistic temp threads (not yet persisted to DB, not valid UUIDs)
      const threadIds = threads.map((t) => t.id).filter((id) => !id.startsWith('temp-'));
      
      // Add user message to store immediately (backend persists the same content per thread)
      threadIds.forEach((id) => {
        const userMessage: Message = {
          id: `user-msg-${id}-${Date.now()}`,
          thread_id: id,
          role: 'user',
          content: prompt.trim(),
          is_bookmarked: false,
          timestamp: new Date().toISOString(),
        };
        addMessage(id, userMessage);
      });

      setIsStreaming(true);
      setAllStreaming(threadIds);

      abortRef.current = new AbortController();

      try {
        await streamPrompt(
          getToken,
          { sessionId, prompt: prompt.trim(), threadIds },
          {
            onToken: (threadId, token) => appendToken(threadId, token),
            onEnd: (threadId, messageId) => finishStream(threadId, messageId),
            onError: (threadId) => setStreamError(threadId),
            onDone: () => setIsStreaming(false),
            onFatalError: (err) => {
              console.error('Fatal stream error:', err);
              threadIds.forEach((id) => setStreamError(id));
              setIsStreaming(false);
            },
          },
          abortRef.current.signal,
        );
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err);
          threadIds.forEach((id) => setStreamError(id));
        }
        setIsStreaming(false);
      }
    },
    [sessionId, threads, isStreaming, getToken, setAllStreaming, addMessage, appendToken, finishStream, setStreamError],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, send, stop };
}
