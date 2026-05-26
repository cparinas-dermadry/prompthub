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
    // Fast-path: if the store already has THIS session (e.g. the Sidebar just
    // seeded it from its POST /sessions response) and providers are already
    // loaded, skip the fetch entirely. This eliminates a ~100-300ms round-trip
    // on freshly-created sessions and lets the auto-add effect fire on the
    // first render after navigation.
    const haveSession =
      useSessionStore.getState().currentSession?.id === sessionId;
    const haveProviders = useUIStore.getState().providers.length > 0;
    if (haveSession && haveProviders) {
      setLoading(false);
      setError(null);
      return;
    }

    // Stale-fetch guard: if the user navigates A → B → A quickly, the older
    // resolutions must not write into the store. We can't pass an
    // AbortSignal through the API client without a wider refactor, so we
    // use a per-effect `cancelled` flag and short-circuit the .then handler.
    let cancelled = false;

    // Only reset when we don't already have the right session — otherwise we'd
    // wipe the seeded state we just received from the Sidebar.
    if (!haveSession) reset();
    setLoading(true);
    setError(null);

    Promise.all([
      haveSession
        ? Promise.resolve(useSessionStore.getState().currentSession)
        : getSession(getToken, sessionId),
      haveProviders ? Promise.resolve(null) : getProviders(getToken),
    ])
      .then(([sess, providers]) => {
        if (cancelled) return;
        if (!haveSession && sess) {
          setSession(sess);
          const threads: Thread[] = ((sess as unknown) as { threads?: Thread[] }).threads ?? [];
          setThreads(threads);
          for (const thread of threads) {
            const msgs = ((thread as unknown) as { messages?: Message[] }).messages;
            if (Array.isArray(msgs) && msgs.length > 0) {
              const sorted = [...msgs].sort(
                (a, b) =>
                  new Date((a as unknown as { timestamp: string }).timestamp).getTime() -
                  new Date((b as unknown as { timestamp: string }).timestamp).getTime(),
              );
              setMessages(thread.id, sorted);
            }
          }
        }
        if (!haveProviders && providers) setProviders(providers);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError('Failed to load session.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { loading, error };
}
