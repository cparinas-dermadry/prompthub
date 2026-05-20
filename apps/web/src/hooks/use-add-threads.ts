'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createThread } from '@/lib/api';
import { useSessionStore } from '@/store/session.store';
import { useUIStore } from '@/store/ui.store';
import type { Thread } from '@prompthub/types';

/**
 * Handles adding new AI model threads to the current session.
 * Uses optimistic UI: tiles appear immediately; API calls resolve in the background.
 */
export function useAddThreads(sessionId: string) {
  const { getToken } = useAuth();
  const { setThreads } = useSessionStore();
  const { setSelectedProviders } = useUIStore();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addThreads = useCallback(
    async (selectedModelIds: string[]) => {
      if (selectedModelIds.length === 0) return;
      setAdding(true);
      setError(null);

      // Read providers at call-time from the store to avoid stale closures.
      // This is the standard Zustand pattern for callbacks.
      const providers = useUIStore.getState().providers;
      const tempThreads: Thread[] = selectedModelIds.flatMap((modelId) => {
        const p = providers.find((prov) => prov.id === modelId);
        if (!p) return [];
        return [
          {
            id: `temp-${modelId}-${Date.now()}`,
            session_id: sessionId,
            model_id: p.id,
            display_name: p.displayName,
            provider: p.provider,
            // Store logoColor in model_config so AITile can read it
            model_config: { logoColor: p.logoColor } as Thread['model_config'],
            created_at: new Date().toISOString(),
          },
        ];
      });

      // Optimistic: add tiles immediately and close the selector
      const current = useSessionStore.getState().threads;
      setThreads([...current, ...tempThreads]);
      setSelectedProviders([]);
      setAdding(false);

      const results = await Promise.allSettled(
        selectedModelIds.map((modelId) => {
          const p = providers.find((prov) => prov.id === modelId);
          if (!p) return Promise.reject(new Error(`Unknown model: ${modelId}`));
          return createThread(getToken, {
            sessionId,
            modelId: p.id,
            displayName: p.displayName,
            provider: p.provider,
            modelConfig: { logoColor: p.logoColor },
          });
        }),
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;

      // Replace temp entries with real ones.
      // Skip any whose temp tile was removed by the user before the API resolved.
      // We iterate results by original index so that realThread[i] always maps
      // to tempThreads[i] — filtering fulfilled results first would misalign
      // indices when some calls fail.
      const currentThreadIds = new Set(useSessionStore.getState().threads.map((t) => t.id));
      const tempIds = new Set(tempThreads.map((t) => t.id));
      const withoutTemps = useSessionStore.getState().threads.filter((t) => !tempIds.has(t.id));

      const threadsToAdd: Thread[] = [];
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return;
        const tempId = tempThreads[i]?.id;
        if (tempId != null && currentThreadIds.has(tempId)) {
          threadsToAdd.push(result.value);
        }
      });
      setThreads([...withoutTemps, ...threadsToAdd]);

      if (failedCount > 0) {
        setError(`${failedCount} model(s) failed to add. Check console for details.`);
      }
    },
    [sessionId, getToken, setThreads, setSelectedProviders],
  );

  return { adding, error, addThreads };
}
