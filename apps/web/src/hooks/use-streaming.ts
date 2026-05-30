'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { streamPrompt, retryPrompt, type RetryOverride } from '@/lib/streaming';
import { useSessionStore } from '@/store/session.store';
import type { Message, Citation } from '@prompthub/types';

const FLUSH_INTERVAL_MS = 30;

/** Per-thread retry override exposed to UI components. Re-export of the lib type for ergonomics. */
export type RetryEdit = RetryOverride;

/**
 * Manages the fan-out streaming lifecycle for a session.
 * Follows SRP: only responsible for streaming state and side-effects.
 *
 * Exposes both `send` (initial prompt, fans out to all threads) and
 * `retry` (re-stream a subset of threads, optionally with edited prompts).
 */
export function useStreaming(sessionId: string) {
  const { getToken } = useAuth();
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const tokenBufferRef = useRef<Record<string, string>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const threads = useSessionStore((s) => s.threads);
  // Use individual selectors for action references; reading messages via
  // getState() inside retry() avoids subscribing this hook to every message
  // update (which would invalidate the memoized callbacks on every token).
  const setAllStreaming = useSessionStore((s) => s.setAllStreaming);
  const addMessage = useSessionStore((s) => s.addMessage);
  const appendToken = useSessionStore((s) => s.appendToken);
  const finishStream = useSessionStore((s) => s.finishStream);
  const setStreamError = useSessionStore((s) => s.setStreamError);
  const setMessages = useSessionStore((s) => s.setMessages);
  const setStreamingCitations = useSessionStore((s) => s.setStreamingCitations);

  const flushTokenBuffer = useCallback(() => {
    flushTimerRef.current = null;
    const entries = Object.entries(tokenBufferRef.current);
    if (entries.length === 0) return;
    tokenBufferRef.current = {};
    for (const [threadId, text] of entries) {
      appendToken(threadId, text);
    }
  }, [appendToken]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(flushTokenBuffer, FLUSH_INTERVAL_MS);
  }, [flushTokenBuffer]);

  /**
   * Build the callback object shared by send/retry. Captures the threadIds
   * being streamed so:
   *
   *  - Fatal-error fallback can mark just those tiles as errored (not every
   *    thread in the session).
   *  - Per-thread completion tracking can flip isStreaming back to false as
   *    soon as every thread has emitted end OR error — without waiting for
   *    the server's terminal 'done' event. That event is unreliable: if any
   *    one stream hangs (OpenRouter drops mid-flight, model stalls, abort
   *    path returns silently), Promise.allSettled never resolves on the
   *    server and 'done' never fires, leaving the input box stuck disabled
   *    even though the visible response is complete. The pending Set fixes
   *    that by being the source of truth client-side.
   */
  const buildCallbacks = useCallback(
    (activeThreadIds: string[]) => {
      const pending = new Set(activeThreadIds);
      const markComplete = (threadId: string): void => {
        pending.delete(threadId);
        if (pending.size === 0) {
          setIsStreaming(false);
        }
      };

      return {
        onToken: (threadId: string, token: string) => {
          tokenBufferRef.current[threadId] = (tokenBufferRef.current[threadId] ?? '') + token;
          scheduleFlush();
        },
        onCitations: (threadId: string, citations: Citation[]) => {
          // Server emits the cumulative deduped list on each `citations`
          // event — replace, don't append. Stash on the store so the live
          // tile can render sources while the answer is still streaming.
          setStreamingCitations(threadId, citations);
        },
        onEnd: (threadId: string, messageId?: string) => {
          if (flushTimerRef.current !== null) {
            clearTimeout(flushTimerRef.current);
            flushTokenBuffer();
          }
          finishStream(threadId, messageId);
          markComplete(threadId);
        },
        onError: (threadId: string, _message: string) => {
          setStreamError(threadId);
          markComplete(threadId);
        },
        // Keep the server's terminal 'done' event as a backup. If a thread
        // somehow gets dropped from `pending` tracking (e.g. server emits
        // 'done' before all per-thread events arrive), this still clears
        // the streaming flag.
        onDone: () => setIsStreaming(false),
        onFatalError: (err: Error) => {
          console.error('Fatal stream error:', err);
          activeThreadIds.forEach((id) => setStreamError(id));
          setIsStreaming(false);
        },
      };
    },
    [
      scheduleFlush,
      flushTokenBuffer,
      finishStream,
      setStreamError,
      setStreamingCitations,
    ],
  );

  const send = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || threads.length === 0 || isStreaming) return;

      // Filter out optimistic temp threads (not yet persisted to DB, not valid UUIDs)
      const threadIds = threads.map((t) => t.id).filter((id) => !id.startsWith('temp-'));

      // Snapshot the active session location so the optimistic user-message
      // stamp matches what the server is about to persist. Read once, before
      // streaming, so a mid-stream location change doesn't mis-stamp.
      const stampLocation =
        useSessionStore.getState().currentSession?.location ?? null;
      // Add user message to store immediately (backend persists the same content per thread)
      threadIds.forEach((id) => {
        const userMessage: Message = {
          id: `user-msg-${id}-${Date.now()}`,
          thread_id: id,
          role: 'user',
          content: prompt.trim(),
          is_bookmarked: false,
          location: stampLocation,
          citations: null,
          timestamp: new Date().toISOString(),
        };
        addMessage(id, userMessage);
      });

      setIsStreaming(true);
      setAllStreaming(threadIds);

      abortRef.current = new AbortController();

      // Reuse the snapshot we took above for stamping the user message —
      // request location is the same one we just stamped, so client-side
      // history and server-side framing stay aligned.
      const requestLocation = stampLocation ?? undefined;

      try {
        await streamPrompt(
          getToken,
          {
            sessionId,
            prompt: prompt.trim(),
            threadIds,
            ...(requestLocation ? { location: requestLocation } : {}),
          },
          buildCallbacks(threadIds),
          abortRef.current.signal,
        );
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err);
          threadIds.forEach((id) => setStreamError(id));
        }
        setIsStreaming(false);
      } finally {
        if (flushTimerRef.current !== null) {
          clearTimeout(flushTimerRef.current);
          flushTokenBuffer();
        }
      }
    },
    [
      sessionId,
      threads,
      isStreaming,
      getToken,
      setAllStreaming,
      addMessage,
      setStreamError,
      flushTokenBuffer,
      buildCallbacks,
    ],
  );

  /**
   * Re-stream a subset of threads. Each thread can specify a rewind point
   * (`fromMessageId`) and/or an edited prompt via `edits`.
   *
   * Local optimistic effects per thread:
   *  - If `fromMessageId` is set, every local message timestamped AFTER it
   *    is dropped from the store (mirrors the server-side delete cascade).
   *  - If `fromMessageId` is NOT set, every message after the latest user
   *    message is dropped (covers the "retry the latest turn" case).
   *  - If `prompt` is set, the displayed content of the rewind-point user
   *    message is updated immediately.
   *  - Streaming status is reset to 'streaming' for the affected threads.
   */
  const retry = useCallback(
    async (threadIdsToRetry: string[], edits: RetryEdit[] = []) => {
      const cleanIds = threadIdsToRetry.filter((id) => !id.startsWith('temp-'));
      if (cleanIds.length === 0 || isStreaming) return;

      const overrideByThread = new Map(edits.map((e) => [e.threadId, e]));
      const storeState = useSessionStore.getState();

      // Optimistically truncate local state per thread to mirror the server
      // delete behavior. Doing this in one setMessages call per thread
      // keeps the React tree stable.
      for (const threadId of cleanIds) {
        const existing = storeState.messages[threadId] ?? [];
        if (existing.length === 0) continue;

        const override = overrideByThread.get(threadId);

        // Find the rewind-point index. With an explicit fromMessageId we
        // look that message up by ID; without one, we fall back to the
        // latest user message in the thread.
        let rewindIdx = -1;
        if (override?.fromMessageId) {
          rewindIdx = existing.findIndex((m) => m.id === override.fromMessageId);
        }
        if (rewindIdx === -1) {
          for (let i = existing.length - 1; i >= 0; i--) {
            if (existing[i].role === 'user') {
              rewindIdx = i;
              break;
            }
          }
        }
        if (rewindIdx === -1) continue;

        // Keep everything up to AND including the rewind-point message.
        // Everything after is dropped (matches server-side gt() delete).
        const next = existing.slice(0, rewindIdx + 1);
        if (override?.prompt !== undefined) {
          next[rewindIdx] = { ...next[rewindIdx], content: override.prompt };
        }
        setMessages(threadId, next);
      }

      setIsStreaming(true);
      setAllStreaming(cleanIds);

      abortRef.current = new AbortController();

      const sessionLocation =
        useSessionStore.getState().currentSession?.location ?? undefined;

      try {
        await retryPrompt(
          getToken,
          {
            sessionId,
            threadIds: cleanIds,
            edits: edits.length > 0 ? edits : undefined,
            ...(sessionLocation ? { location: sessionLocation } : {}),
          },
          buildCallbacks(cleanIds),
          abortRef.current.signal,
        );
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err);
          cleanIds.forEach((id) => setStreamError(id));
        }
        setIsStreaming(false);
      } finally {
        if (flushTimerRef.current !== null) {
          clearTimeout(flushTimerRef.current);
          flushTokenBuffer();
        }
      }
    },
    [
      sessionId,
      isStreaming,
      getToken,
      setAllStreaming,
      setMessages,
      setStreamError,
      buildCallbacks,
      flushTokenBuffer,
    ],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, send, retry, stop };
}
