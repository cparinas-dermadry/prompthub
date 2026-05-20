'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ThreadHeader } from '@/components/molecules/ThreadHeader';
import { MessageBubble } from '@/components/molecules/MessageBubble';
import { StreamingCursor } from '@/components/atoms/StreamingCursor';
import { useSessionStore } from '@/store/session.store';
import { useUIStore } from '@/store/ui.store';
import { useBookmark } from '@/hooks/use-bookmark';
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
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, liveToken]);

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content).catch(console.error);
  }

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
      <div ref={scrollRef} className={isCompact ? 'flex-1 min-h-0 overflow-y-auto px-3 py-2' : 'flex-1 min-h-0 overflow-y-auto px-4 py-3'}>
        <div className={isCompact ? 'flex flex-col gap-1.5 text-[11px] leading-snug' : 'flex flex-col gap-3 text-sm'}>
          {isEmpty && status !== 'streaming' && (
            <p className="text-muted-fg text-xs text-center pt-6">Ask something to get started…</p>
          )}

          {messages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div
                  className={isCompact
                    ? 'max-w-[92%] whitespace-pre-wrap rounded-xl rounded-tr-sm bg-slate-100 px-2 py-1 text-[11px] leading-snug text-body'
                    : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-slate-100 px-3.5 py-2 text-sm text-body'}
                >
                  {msg.content}
                </div>
              </div>
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

          {status === 'error' && (
            <p className="text-xs text-danger">Error receiving response.</p>
          )}

        </div>
      </div>
    </div>
  );
}
