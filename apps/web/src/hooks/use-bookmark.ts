'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toggleBookmark as toggleBookmarkApi } from '@/lib/api';
import { useSessionStore } from '@/store/session.store';

/**
 * Handles bookmarking messages and syncing state with the server.
 * Follows SRP: only responsible for bookmark interaction.
 */
export function useBookmark() {
  const { getToken } = useAuth();
  const { bookmarkMessage } = useSessionStore();
  const [pending, setPending] = useState<string | null>(null);

  const toggle = useCallback(
    async (messageId: string, currentValue: boolean) => {
      if (pending) return;

      // Local optimistic messages are not persisted in DB yet; avoid 404 PATCH calls.
      if (messageId.startsWith('local-') || messageId.startsWith('user-msg-')) {
        bookmarkMessage(messageId, !currentValue);
        return;
      }

      // Optimistic update
      bookmarkMessage(messageId, !currentValue);
      setPending(messageId);

      try {
        const updated = await toggleBookmarkApi(getToken, messageId);
        bookmarkMessage(messageId, updated.is_bookmarked);
      } catch (err) {
        console.error(err);
        // Revert on failure
        bookmarkMessage(messageId, currentValue);
      } finally {
        setPending(null);
      }
    },
    [getToken, bookmarkMessage, pending],
  );

  return { toggle, pending };
}
