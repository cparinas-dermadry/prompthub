/**
 * SSE streaming client.
 * Uses fetch + ReadableStream (not EventSource) so we can POST with auth headers.
 *
 * Server event format:
 *   event: {threadId}\ndata: {"type":"token","token":"..."}\n\n
 *   event: {threadId}\ndata: {"type":"end","messageId":"..."}\n\n
 *   event: done\ndata: {}\n\n
 *   event: {threadId}\ndata: {"type":"error","message":"..."}\n\n
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type StreamTokenEvent = { type: 'token'; token: string };
export type StreamEndEvent = { type: 'end'; messageId?: string };
export type StreamErrorEvent = { type: 'error'; message: string };
export type StreamData = StreamTokenEvent | StreamEndEvent | StreamErrorEvent;

export interface StreamCallbacks {
  onToken: (threadId: string, token: string) => void;
  onEnd: (threadId: string, messageId?: string) => void;
  onError: (threadId: string, message: string) => void;
  onDone: () => void;
  onFatalError?: (err: Error) => void;
}

export async function streamPrompt(
  getToken: () => Promise<string | null>,
  payload: { sessionId: string; prompt: string; threadIds: string[] },
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getToken();

  const res = await fetch(`${API_URL}/streaming/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => 'Unknown error');
    callbacks.onFatalError?.(new Error(`Streaming failed ${res.status}: ${msg}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
      } else if (data.type === 'end') {
        callbacks.onEnd(threadId, data.messageId);
      } else if (data.type === 'error') {
        callbacks.onError(threadId, data.message);
      }
    }
  }
}
