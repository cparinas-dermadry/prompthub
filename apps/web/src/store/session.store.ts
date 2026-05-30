import { create } from 'zustand';
import type { Session, Thread, Message, Citation } from '@prompthub/types';
import { createSelector } from 'reselect';

export type StreamingStatus = 'idle' | 'streaming' | 'done' | 'error';

interface SessionState {
  // Current session
  currentSession: Session | null;
  threads: Thread[];

  // Messages keyed by threadId
  messages: Record<string, Message[]>;

  // Live streaming text (pre-save), keyed by threadId
  streamingTokens: Record<string, string>;

  // Per-thread streaming status
  streamingStatus: Record<string, StreamingStatus>;

  // Live streaming citations (pre-commit), keyed by threadId. Replaced
  // wholesale on each `citations` SSE event (server sends cumulative).
  // Flushed onto the committed message in finishStream().
  streamingCitations: Record<string, Citation[]>;

  // Actions
  setSession: (session: Session) => void;
  setThreads: (threads: Thread[]) => void;
  setMessages: (threadId: string, messages: Message[]) => void;
  addMessage: (threadId: string, message: Message) => void;
  appendToken: (threadId: string, token: string) => void;
  setStreamingCitations: (threadId: string, citations: Citation[]) => void;
  finishStream: (threadId: string, persistedMessageId?: string) => void;
  setStreamError: (threadId: string) => void;
  commitStreamedMessage: (threadId: string, message: Message) => void;
  setAllStreaming: (threadIds: string[]) => void;
  /** Patch the current session in place (e.g. after a location PATCH). */
  patchSession: (patch: Partial<Session>) => void;
  bookmarkMessage: (messageId: string, value: boolean) => void;
  removeThread: (threadId: string) => void;
  replaceThread: (threadId: string, updated: Thread) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  threads: [],
  messages: {},
  streamingTokens: {},
  streamingStatus: {},
  streamingCitations: {},

  setSession: (session) => set({ currentSession: session }),

  patchSession: (patch) =>
    set((s) =>
      s.currentSession
        ? { currentSession: { ...s.currentSession, ...patch } }
        : s,
    ),

  setThreads: (threads) => set({ threads }),

  setMessages: (threadId, messages) =>
    set((s) => ({ messages: { ...s.messages, [threadId]: messages } })),

  addMessage: (threadId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: [...(s.messages[threadId] ?? []), message],
      },
    })),

  appendToken: (threadId, token) =>
    set((s) => ({
      streamingTokens: {
        ...s.streamingTokens,
        [threadId]: (s.streamingTokens[threadId] ?? '') + token,
      },
    })),

  setStreamingCitations: (threadId, citations) =>
    set((s) => ({
      streamingCitations: { ...s.streamingCitations, [threadId]: citations },
    })),

  finishStream: (threadId, persistedMessageId) =>
    set((s) => {
      const content = s.streamingTokens[threadId] ?? '';
      const liveCitations = s.streamingCitations[threadId];
      const existing = s.messages[threadId] ?? [];
      // Commit buffered tokens (and any accumulated citations) as a local
      // message so content persists and the streaming cursor disappears.
      // The backend also saves to DB; on next session load Supabase
      // messages will replace this entry — including the authoritative
      // citations array on that row.
      const committed = content
        ? [
            ...existing,
            {
              id: persistedMessageId ?? `local-${threadId}-${Date.now()}`,
              thread_id: threadId,
              role: 'assistant' as const,
              content,
              is_bookmarked: false,
              location: s.currentSession?.location ?? null,
              citations:
                liveCitations && liveCitations.length > 0 ? liveCitations : null,
              timestamp: new Date().toISOString(),
            },
          ]
        : existing;
      return {
        streamingStatus: { ...s.streamingStatus, [threadId]: 'done' },
        streamingTokens: { ...s.streamingTokens, [threadId]: '' },
        streamingCitations: { ...s.streamingCitations, [threadId]: [] },
        messages: { ...s.messages, [threadId]: committed },
      };
    }),

  setStreamError: (threadId) =>
    set((s) => ({
      streamingStatus: { ...s.streamingStatus, [threadId]: 'error' },
    })),

  // Called after backend saves the assistant message — replaces live token buffer
  commitStreamedMessage: (threadId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: [...(s.messages[threadId] ?? []), message],
      },
      streamingTokens: { ...s.streamingTokens, [threadId]: '' },
      streamingStatus: { ...s.streamingStatus, [threadId]: 'done' },
    })),

  setAllStreaming: (threadIds) =>
    set((s) => ({
      streamingStatus: {
        ...s.streamingStatus,
        ...Object.fromEntries(threadIds.map((id) => [id, 'streaming' as StreamingStatus])),
      },
      streamingTokens: {
        ...s.streamingTokens,
        ...Object.fromEntries(threadIds.map((id) => [id, ''])),
      },
    })),

  bookmarkMessage: (messageId, value) =>
    set((s) => {
      const updated = { ...s.messages };
      for (const threadId in updated) {
        updated[threadId] = updated[threadId].map((m) =>
          m.id === messageId ? { ...m, is_bookmarked: value } : m,
        );
      }
      return { messages: updated };
    }),

  removeThread: (threadId) =>
    set((s) => {
      const { [threadId]: _msgs, ...messages } = s.messages;
      const { [threadId]: _tok, ...streamingTokens } = s.streamingTokens;
      const { [threadId]: _st, ...streamingStatus } = s.streamingStatus;
      const { [threadId]: _cit, ...streamingCitations } = s.streamingCitations;
      return {
        threads: s.threads.filter((t) => t.id !== threadId),
        messages,
        streamingTokens,
        streamingStatus,
        streamingCitations,
      };
    }),

  replaceThread: (threadId, updated) =>
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? updated : t)),
    })),

  reset: () =>
    set({
      currentSession: null,
      threads: [],
      messages: {},
      streamingTokens: {},
      streamingStatus: {},
      streamingCitations: {},
    }),
}));

// Memoized selector for disabled providers
export const selectDisabledProviders = createSelector(
  (state: SessionState) => state.threads,
  (threads) => threads.map((t) => t.provider),
);
