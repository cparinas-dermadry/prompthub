import { create } from 'zustand';
import type { ProviderConfig } from '@prompthub/types';

interface UIState {
  // Which thread tile is expanded (full-screen overlay)
  expandedThreadId: string | null;

  // Available providers (fetched once on mount)
  providers: ProviderConfig[];

  // Selected provider IDs for a new session / thread creation
  selectedProviderIds: string[];

  // Sidebar open state (mobile)
  sidebarOpen: boolean;

  // Highlights panel open state
  highlightsPanelOpen: boolean;

  /**
   * Auto-add queue for a specific session. Set by Sidebar BEFORE navigating to a
   * newly-created session; consumed by SessionWorkspace ONLY when its mounted
   * sessionId matches `sessionId` here.
   *
   * Binding the payload to a target sessionId is intentional: without it, the
   * effect inside the currently-mounted (previous-session) SessionWorkspace
   * fires on the next render — before Next.js navigation finishes — and the
   * auto-add ends up applied to the wrong session.
   */
  pendingAutoAdd: { sessionId: string; modelIds: string[] } | null;

  // Actions
  expandThread: (id: string) => void;
  collapseThread: () => void;
  setProviders: (providers: ProviderConfig[]) => void;
  toggleProvider: (id: string) => void;
  setSelectedProviders: (ids: string[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleHighlightsPanel: () => void;
  setPendingAutoAdd: (payload: { sessionId: string; modelIds: string[] }) => void;
  clearPendingAutoAdd: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  expandedThreadId: null,
  providers: [],
  selectedProviderIds: [],
  sidebarOpen: false,
  highlightsPanelOpen: false,
  pendingAutoAdd: null,

  expandThread: (id) => set({ expandedThreadId: id }),
  collapseThread: () => set({ expandedThreadId: null }),

  setProviders: (providers) => set({ providers }),

  toggleProvider: (id) =>
    set((s) => ({
      selectedProviderIds: s.selectedProviderIds.includes(id)
        ? s.selectedProviderIds.filter((p) => p !== id)
        : [...s.selectedProviderIds, id],
    })),

  setSelectedProviders: (ids) => set({ selectedProviderIds: ids }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleHighlightsPanel: () => set((s) => ({ highlightsPanelOpen: !s.highlightsPanelOpen })),

  setPendingAutoAdd: (payload) => set({ pendingAutoAdd: payload }),
  clearPendingAutoAdd: () => set({ pendingAutoAdd: null }),
}));
