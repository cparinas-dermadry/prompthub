/**
 * SSE streaming client.
 * Uses fetch + ReadableStream (not EventSource) so we can POST with auth headers.
 *
 * Server event format:
 *   event: {threadId}\ndata: {"type":"token","token":"..."}\n\n
 *   event: {threadId}\ndata: {"type":"citations","citations":[...]}\n\n
 *   event: {threadId}\ndata: {"type":"end","messageId":"..."}\n\n
 *   event: done\ndata: {}\n\n
 *   event: {threadId}\ndata: {"type":"error","message":"..."}\n\n
 */

import type { PromptLocation, Citation } from '@prompthub/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type StreamTokenEvent = { type: 'token'; token: string };
export type StreamEndEvent = { type: 'end'; messageId?: string };
export type StreamErrorEvent = { type: 'error'; message: string };
/**
 * Cumulative citations from the openrouter:web_search server tool. The server
 * may emit this event multiple times during the stream — each emit is the
 * full deduped list so far, so clients should REPLACE their local copy on
 * receipt, not append.
 */
export type StreamCitationsEvent = { type: 'citations'; citations: Citation[] };
export type StreamData =
  | StreamTokenEvent
  | StreamEndEvent
  | StreamErrorEvent
  | StreamCitationsEvent;

export interface StreamCallbacks {
  onToken: (threadId: string, token: string) => void;
  onEnd: (threadId: string, messageId?: string) => void;
  onError: (threadId: string, message: string) => void;
  onDone: () => void;
  /** Optional — fires when the model used web search and returned citations. */
  onCitations?: (threadId: string, citations: Citation[]) => void;
  onFatalError?: (err: Error) => void;
}

export async function streamPrompt(
  getToken: () => Promise<string | null>,
  payload: {
    sessionId: string;
    prompt: string;
    threadIds: string[];
    /** Optional GEO/SEO location — server applies framing + native web search. */
    location?: PromptLocation;
  },
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return postAndParseSSE(getToken, '/streaming/prompt', payload, callbacks, signal);
}

/**
 * Re-stream one or more threads using their existing last user message
 * (optionally rewritten via `edits`). The server-side endpoint cleans up any
 * trailing assistant message before re-streaming, so callers should clear
 * their local partial/errored assistant state for the affected threads
 * before invoking this.
 */
export interface RetryOverride {
  threadId: string;
  /**
   * Message ID of the user message to retry FROM. If omitted, the latest
   * user message in the thread is used. When provided, the server deletes
   * every message timestamped after this one (both user and assistant)
   * before re-streaming — the "rewind to turn N" case.
   */
  fromMessageId?: string;
  /**
   * New content for the user message at `fromMessageId` (or the latest user
   * message). If omitted, the existing content is reused verbatim — the
   * "pure retry, no edit" case.
   */
  prompt?: string;
}

export async function retryPrompt(
  getToken: () => Promise<string | null>,
  payload: {
    sessionId: string;
    threadIds: string[];
    /** Per-thread overrides — threads not listed retry verbatim from their latest user message. */
    edits?: RetryOverride[];
    /** Optional location to apply to the retried turn (overrides the original turn's stamp). */
    location?: PromptLocation;
  },
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return postAndParseSSE(getToken, '/streaming/retry', payload, callbacks, signal);
}

async function postAndParseSSE(
  getToken: () => Promise<string | null>,
  path: string,
  body: object,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => 'Unknown error');
    callbacks.onFatalError?.(new Error(`Streaming failed ${res.status}: ${msg}`));
    return;
  }

  const reader = res.body.getReader();
  // Cancel the reader as soon as the caller aborts so we don't sit blocked
  // in reader.read() waiting for the next chunk that will never arrive.
  const onAbort = (): void => {
    reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', onAbort);

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double-newline (SSE event boundary)
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.split('\n');
        let eventName = '';
        let dataLine = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) eventName = line.slice(7).trim();
          if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
        }

        if (!eventName || !dataLine) continue;

        if (eventName === 'done') {
          callbacks.onDone();
          continue;
        }

        let data: StreamData;
        try {
          data = JSON.parse(dataLine) as StreamData;
        } catch {
          continue;
        }

        const threadId = eventName;

        if (data.type === 'token') {
          callbacks.onToken(threadId, data.token);
        } else if (data.type === 'citations') {
          callbacks.onCitations?.(threadId, data.citations);
        } else if (data.type === 'end') {
          callbacks.onEnd(threadId, data.messageId);
        } else if (data.type === 'error') {
          callbacks.onError(threadId, data.message);
        }
      }
    }
  } finally {
    // Always release the lock so the stream is reclaimable by GC, and
    // detach the abort listener regardless of how we exited the loop.
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
