'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getSessions, createSession as createSessionApi, deleteSession as deleteSessionApi, updateSession as updateSessionApi } from '@/lib/api';
import type { Session } from '@prompthub/types';

/**
 * Manages the session list shown in the sidebar nav.
 * Follows SRP: only responsible for the user's session list.
 */
export function useSessionList() {
  const { getToken } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getSessions(getToken)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [getToken]);

  const filtered = search.trim()
    ? sessions.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  async function createSession(name = 'New Session'): Promise<Session> {
    const session = await createSessionApi(getToken, { name });
    setSessions((prev) => [session, ...prev]);
    return session;
  }

  async function deleteSession(id: string): Promise<void> {
    const snapshot = sessions;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteSessionApi(getToken, id);
    } catch (err) {
      setSessions(snapshot);
      throw err;
    }
  }

  async function renameSession(id: string, name: string): Promise<void> {
    const snapshot = sessions;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    try {
      await updateSessionApi(getToken, id, { name });
    } catch (err) {
      setSessions(snapshot);
      throw err;
    }
  }

  return { sessions: filtered, loading, search, setSearch, createSession, deleteSession, renameSession };
}
