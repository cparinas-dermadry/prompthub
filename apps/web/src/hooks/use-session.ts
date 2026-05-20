'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getSession, getProviders, createThread } from '@/lib/api';
import { useSessionStore } from '@/store/session.store';
import { useUIStore } from '@/store/ui.store';
import type { Thread, Message } from '@prompthub/types';

/**
 * Loads a session and its threads/messages into the global store.
 * Follows SRP: only responsible for session hydration.
 */
export function useSession(sessionId: string) {
  const { getToken } = useAuth();
  const { setSession, setThreads, setMessages, reset } = useSessionStore();
  const { setProviders } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reset();
    setLoading(true);
    setError(null);

    Promise.all([getSession(getToken, sessionId), getProviders(getToken)])
      .then(([sess, providers]) => {
        setSession(sess);
        setProviders(providers);

        const threads: Thread[] = ((sess as unknown) as { threads?: Thread[] }).threads ?? [];
        setThreads(threads);

        for (const thread of threads) {
          const msgs = ((thread as unknown) as { messages?: Message[] }).messages;
          if (Array.isArray(msgs) && msgs.length > 0) {
            setMessages(thread.id, msgs);
          }
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        setError('Failed to load session.');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { loading, error };
}
