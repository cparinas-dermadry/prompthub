'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircleIcon } from 'lucide-react';
import { TopBar } from '@/components/organisms/TopBar';
import { TileGrid } from '@/components/organisms/TileGrid';
import { PromptInput } from '@/components/organisms/PromptInput';
import { HighlightsPanel } from '@/components/organisms/HighlightsPanel';
import { ProviderSelector } from '@/components/organisms/ProviderSelector';
import { useSession } from '@/hooks/use-session';
import { useAddThreads } from '@/hooks/use-add-threads';
import { useSessionStore } from '@/store/session.store';
import { useUIStore } from '@/store/ui.store';
import { useSettingsStore } from '@/store/settings.store';
import { LoadingSpinner } from '@/components/atoms/LoadingSpinner';
import { selectDisabledProviders } from '@/store/session.store';

interface SessionWorkspaceProps {
  sessionId: string;
}

/**
 * Template: the session workspace layout — toolbar, tile grid, prompt input, panels.
 * Composes organisms; connects them via hooks. No inline API calls.
 */
export function SessionWorkspace({ sessionId }: SessionWorkspaceProps) {
  const { loading, error } = useSession(sessionId);
  const { adding, addThreads } = useAddThreads(sessionId);
  const sessionName = useSessionStore((s) => s.currentSession?.name);
  // Subscribe to the loaded session id directly. We can't rely on `loading`
  // alone for the auto-add guard: when sessionId changes, the closure-captured
  // `loading` is still the previous (false) value on the first render, so the
  // auto-add effect fires before useSession resets the store. The store's
  // currentSession.id is updated synchronously (reset → null; setSession(B) →
  // 'B' after hydration), so it's a reliable "this session is fully loaded"
  // signal.
  const loadedSessionId = useSessionStore((s) => s.currentSession?.id);
  const disabledProviders = useSessionStore(selectDisabledProviders);
  const { setSelectedProviders, pendingAutoAdd, clearPendingAutoAdd } = useUIStore();
  const providersLoaded = useUIStore((s) => s.providers.length > 0);
  // Derive the list of model IDs to auto-add from the two-level settings:
  // autoAddProviders maps providerLabel → modelId; we just need the model IDs.
  const autoAddProviders = useSettingsStore((s) => s.autoAddProviders);
  const defaultModelIds = Object.values(autoAddProviders);

  const [selectorOpen, setSelectorOpen] = useState(false);
  // Track which sessionId the auto-add has already fired for.
  // Using the sessionId (instead of a plain boolean) means the guard resets
  // automatically whenever the user navigates to a different session — even
  // though Next.js App Router reuses the same SessionWorkspace component
  // instance across navigations rather than unmounting/remounting it.
  const autoAddFired = useRef<string | null>(null);
  const addThreadsRef = useRef(addThreads);
  addThreadsRef.current = addThreads; // always up-to-date without being a dep

  // Auto-add models queued by Sidebar before navigation.
  //
  // Two guards matter here:
  //   1. `pendingAutoAdd.sessionId === sessionId` — only consume the queue
  //      when it's intended for THIS session (prevents leaking onto the
  //      previously-open session during navigation).
  //   2. `loadedSessionId === sessionId` — wait until useSession's server
  //      load has populated the store with THIS session. Without this, the
  //      auto-add fires before hydration completes; useSession's subsequent
  //      setThreads(serverThreads) then clobbers the optimistic temp tiles,
  //      and use-add-threads' post-write staleness check drops the real
  //      threads it just created, so nothing appears until a refresh.
  useEffect(() => {
    if (
      !pendingAutoAdd ||
      pendingAutoAdd.sessionId !== sessionId ||
      loading ||
      loadedSessionId !== sessionId ||
      !providersLoaded ||
      autoAddFired.current === sessionId
    ) {
      return;
    }
    autoAddFired.current = sessionId;
    const modelIds = pendingAutoAdd.modelIds;
    clearPendingAutoAdd();
    void addThreadsRef.current(modelIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoAdd, loading, loadedSessionId, providersLoaded, sessionId]);

  function openSelector() {
    // Pre-select auto-add models (user can still change before confirming)
    if (defaultModelIds.length > 0) setSelectedProviders(defaultModelIds);
    setSelectorOpen(true);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-danger text-sm">{error}</p>
      </div>
    );
  }

  return (
    <>
      <TopBar title={sessionName} />

      {/* Model toolbar */}
      <div className="flex items-center gap-2 px-5 py-2 shrink-0 border-b border-divider bg-white">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-navy font-semibold hover:text-navy hover:bg-surface"
          disabled={adding}
          onClick={openSelector}
        >
          <PlusCircleIcon className="h-4 w-4" />
          {adding ? 'Adding…' : 'Add Models'}
        </Button>
      </div>

      {/* Tile area + prompt input */}
      <TileGrid />
      <PromptInput sessionId={sessionId} />

      {/* Highlights slide-in */}
      <HighlightsPanel />

      {/* Provider selector modal */}
      <ProviderSelector
        open={selectorOpen}
        onConfirm={async (ids) => {
          setSelectorOpen(false);
          await addThreads(ids);
        }}
        onClose={() => setSelectorOpen(false)}
        disabledProviders={disabledProviders}
      />
    </>
  );
}
