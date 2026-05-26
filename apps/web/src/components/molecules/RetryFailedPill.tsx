'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCwIcon } from 'lucide-react';
import { useSessionStore } from '@/store/session.store';
import { useStreaming } from '@/hooks/use-streaming';

interface RetryFailedPillProps {
  sessionId: string;
}

/**
 * Molecule: a pill button that appears when 2+ threads in the session are
 * in 'error' status (e.g. a whole provider went down). Clicking it issues
 * a single retry call covering all failed threads — cheaper and easier
 * than clicking each tile's retry icon one by one.
 *
 * Hidden when 0 or 1 threads have failed: a single failure is better
 * served by the per-tile retry CTA, which is already visible inside the
 * failing tile.
 */
export function RetryFailedPill({ sessionId }: RetryFailedPillProps) {
  const streamingStatus = useSessionStore((s) => s.streamingStatus);
  const threads = useSessionStore((s) => s.threads);
  const { isStreaming, retry } = useStreaming(sessionId);

  // Threads currently in error state, filtered to ones that have been
  // persisted (temp- IDs aren't valid UUIDs and would 400 the API).
  const failedThreadIds = useMemo(
    () =>
      threads
        .filter((t) => !t.id.startsWith('temp-') && streamingStatus[t.id] === 'error')
        .map((t) => t.id),
    [threads, streamingStatus],
  );

  if (failedThreadIds.length < 2) return null;

  function handleClick() {
    void retry(failedThreadIds);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-danger/30 text-danger hover:bg-danger/5 hover:text-danger"
      disabled={isStreaming}
      onClick={handleClick}
    >
      <RefreshCwIcon className="h-3.5 w-3.5" />
      Retry {failedThreadIds.length} failed model{failedThreadIds.length === 1 ? '' : 's'}
    </Button>
  );
}
