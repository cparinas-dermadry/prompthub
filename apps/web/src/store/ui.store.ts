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
   * Model IDs queued for auto-add when the next session workspace mounts.
   * Set by Sidebar before navigating to a new session; cleared by SessionWorkspace after firing.
   */
  pendingAutoAdd: string[];

  // Actions
  expandThread: (id: string) => void;
  collapseThread: () => void;
  setProviders: (providers: ProviderConfig[]) => void;
  toggleProvider: (id: string) => void;
  setSelectedProviders: (ids: string[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleHighlightsPanel: () => void;
  setPendingAutoAdd: (ids: string[]) => void;
  clearPendingAutoAdd: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  expandedThreadId: null,
  providers: [],
  selectedProviderIds: [],
  sidebarOpen: false,
  highlightsPanelOpen: false,
  pendingAutoAdd: [],

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

  setPendingAutoAdd: (ids) => set({ pendingAutoAdd: ids }),
  clearPendingAutoAdd: () => set({ pendingAutoAdd: [] }),
}));
