'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { RefreshCwIcon } from 'lucide-react';
import { ThreadHeader } from '@/components/molecules/ThreadHeader';
import { MessageBubble } from '@/components/molecules/MessageBubble';
import { UserBubble } from '@/components/molecules/UserBubble';
import { StreamingCursor } from '@/components/atoms/StreamingCursor';
import { useSessionStore } from '@/store/session.store';
import { useUIStore } from '@/store/ui.store';
import { useBookmark } from '@/hooks/use-bookmark';
import { useStreaming } from '@/hooks/use-streaming';
import { deleteThread, updateThread } from '@/lib/api';
import type { Thread } from '@prompthub/types';

interface AITileProps {
  thread: Thread;
  mode?: 'normal' | 'expanded' | 'minimized';
}

/**
 * Organism: a single AI model tile — header, scrollable messages, live streaming buffer.
 * Reads from stores directly; delegates bookmark I/O to useBookmark hook (DIP).
 */
export function AITile({ thread, mode = 'normal' }: AITileProps) {
  const { getToken } = useAuth();
  // NOTE: `?? []` must be OUTSIDE the selector — returning a new [] reference
  // inside the selector on every call causes a Zustand v5 infinite loop.
  const messages = useSessionStore((s) => s.messages[thread.id]) ?? [];
  const liveToken = useSessionStore((s) => s.streamingTokens[thread.id] ?? '');
  const status = useSessionStore((s) => s.streamingStatus[thread.id] ?? 'idle');
  const { removeThread, replaceThread } = useSessionStore();
  const { expandedThreadId, expandThread, collapseThread, providers } = useUIStore();
  const { toggle: toggleBookmark, pending } = useBookmark();
  // Per-tile retry — each AITile owns its own streaming hook instance so
  // retries on different tiles don't share an abort controller. The
  // tradeoff is that PromptInput's hook can't observe this stream, but
  // that's fine: the global send-button is disabled while any tile is
  // streaming via the per-thread `status` already tracked in the store.
  const { isStreaming: isRetrying, retry } = useStreaming(thread.session_id);

  const accentColor =
    (thread.model_config as Record<string, string> | null)?.logoColor ?? '#7c3aed';

  // Models available for the same provider (for the in-tile model switcher)
  const availableModels = providers
    .filter((p) => p.provider === thread.provider)
    .map((p) => ({ id: p.id, displayName: p.displayName }));

  const isEmpty = messages.length === 0 && !liveToken;
  const isExpanded = expandedThreadId === thread.id;
  const isCompact = mode === 'minimized';

  const scrollRef = useRef<HTMLDivElement>(null);
  // Auto-scroll only when the user is already pinned to the bottom. If they
  // scrolled up to read older content, don't yank them back. We sample
  // wasAtBottom BEFORE the DOM updates so growing content doesn't lie about
  // its previous position.
  const wasAtBottomRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!wasAtBottomRef.current) return;
    // Deduplicate multiple state updates within the same animation frame
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (scrollRef.current && wasAtBottomRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages.length, liveToken]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>): void {
    const el = e.currentTarget;
    // 32px slop so users don't have to land pixel-perfect to re-enable
    // auto-scroll. Anything closer than that counts as "at the bottom".
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
  }

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content).catch(console.error);
  }

  // Retry handlers — each accepts the messageId of the user bubble being
  // retried. If it's the latest user message, behavior matches the original
  // "retry the last turn" case. If it's an older message, the server (and
  // local optimistic update) silently delete every message timestamped
  // after it before re-streaming.
  function handleRetry(messageId: string) {
    if (thread.id.startsWith('temp-')) return;
    void retry([thread.id], [{ threadId: thread.id, fromMessageId: messageId }]);
  }

  function handleEditAndRetry(messageId: string, newPrompt: string) {
    if (thread.id.startsWith('temp-')) return;
    void retry([thread.id], [
      { threadId: thread.id, fromMessageId: messageId, prompt: newPrompt },
    ]);
  }

  // The empty/error-state CTA always retries from the latest user message,
  // so we precompute its index here. The per-bubble hover icons each retry
  // from their own bubble (any turn), so they don't need this.
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  const latestUserMessageId = lastUserIdx >= 0 ? messages[lastUserIdx].id : null;
  // Show the prominent error-state retry CTA when the stream failed OR
  // when the last message is a user message with no assistant follow-up
  // (which usually means an error happened before any tokens streamed).
  const lastMessage = messages[messages.length - 1];
  const needsRetryCta =
    !thread.id.startsWith('temp-') &&
    status !== 'streaming' &&
    !isRetrying &&
    (status === 'error' || (lastMessage?.role === 'user' && !liveToken));

  async function handleRemove() {
    // Optimistic: remove from store immediately
    removeThread(thread.id);
    // Temp threads haven't been persisted yet — no API call needed
    if (thread.id.startsWith('temp-')) return;
    try {
      await deleteThread(getToken, thread.id);
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  }

  async function handleModelChange(modelId: string, displayName: string) {
    const provider = providers.find((p) => p.id === modelId);
    const modelConfig = (provider ? { logoColor: provider.logoColor } : {}) as Thread['model_config'];
    // Optimistic: update display name immediately
    replaceThread(thread.id, { ...thread, model_id: modelId, display_name: displayName, model_config: modelConfig });
    // Temp threads are client-only until createThread resolves.
    if (thread.id.startsWith('temp-')) return;
    try {
      const updated = await updateThread(getToken, thread.id, {
        modelId,
        displayName,
        modelConfig: modelConfig as Record<string, unknown>,
      });
      replaceThread(thread.id, updated);
    } catch (err) {
      console.error('Failed to update thread model:', err);
      // Rollback to original
      replaceThread(thread.id, thread);
    }
  }

  function toggleExpand() {
    if (isExpanded) {
      collapseThread();
      return;
    }
    expandThread(thread.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)] transition-all duration-300">
      <ThreadHeader
        displayName={thread.display_name}
        accentColor={accentColor}
        status={status}
        availableModels={availableModels}
        currentModelId={thread.model_id}
        isExpanded={isExpanded}
        onExpandToggle={toggleExpand}
        onRemove={handleRemove}
        onModelChange={handleModelChange}
      />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={isCompact ? 'flex-1 min-h-0 overflow-y-auto px-3 py-2' : 'flex-1 min-h-0 overflow-y-auto px-4 py-3'}
      >
        <div className={isCompact ? 'flex flex-col gap-1.5 text-[11px] leading-snug' : 'flex flex-col gap-3 text-sm'}>
          {isEmpty && status !== 'streaming' && (
            <p className="text-muted-fg text-xs text-center pt-6">Ask something to get started…</p>
          )}

          {messages.map((msg, idx) =>
            msg.role === 'user' ? (
              <UserBubble
                key={msg.id}
                messageId={msg.id}
                content={msg.content}
                // Every user bubble is retryable. Retrying an older turn
                // silently invalidates subsequent turns — UserBubble
                // surfaces "Rewind & retry from here" labeling for those.
                showActions
                isHistorical={idx !== lastUserIdx}
                disabled={isRetrying || status === 'streaming'}
                onRetry={handleRetry}
                onEditSave={handleEditAndRetry}
                compact={isCompact}
              />
            ) : (
              <MessageBubble
                key={msg.id}
                message={msg}
                onBookmark={(m) => toggleBookmark(m.id, m.is_bookmarked)}
                onCopy={handleCopy}
                isPending={pending === msg.id}
                compact={isCompact}
              />
            )
          )}

          {liveToken && (
            <div
              className={isCompact
                ? 'prose prose-xs max-w-none text-[11px] leading-snug text-body'
                : 'prose prose-sm max-w-none text-body'}
            >
              {liveToken}
              <StreamingCursor />
            </div>
          )}

          {status === 'streaming' && !liveToken && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="h-2 w-2 rounded-full bg-teal animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 rounded-full bg-teal animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-teal animate-bounce [animation-delay:300ms]" />
            </div>
          )}

          {needsRetryCta && latestUserMessageId && (
            <div className="flex flex-col items-center gap-2 py-3">
              {status === 'error' && (
                <p className="text-xs text-danger text-center">
                  Error receiving response.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs border-divider"
                onClick={() => handleRetry(latestUserMessageId)}
              >
                <RefreshCwIcon className="h-3.5 w-3.5" />
                Retry this model
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
