'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getProviders } from '@/lib/api';
import { useUIStore } from '@/store/ui.store';
import type { ProviderConfig } from '@prompthub/types';

/**
 * Ensures providers are loaded into UIStore.
 * Safe to call on any page — fetches from API only when UIStore is empty.
 */
export function useProviders(): { providers: ProviderConfig[]; loading: boolean } {
  const { getToken } = useAuth();
  const providers = useUIStore((s) => s.providers);
  const setProviders = useUIStore((s) => s.setProviders);

  useEffect(() => {
    if (providers.length > 0) return; // already loaded
    getProviders(getToken)
      .then(setProviders)
      .catch((err: unknown) => console.error('Failed to load providers:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { providers, loading: providers.length === 0 };
}
