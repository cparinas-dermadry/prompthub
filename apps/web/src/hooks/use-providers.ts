'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getProviders } from '@/lib/api';
import { useUIStore } from '@/store/ui.store';
import type { ProviderConfig } from '@prompthub/types';

/**
 * Ensures providers are loaded into UIStore.
 * Safe to call on any page — fetches from API only when UIStore is empty.
 *
 * Gated on Clerk's `isLoaded` so we don't fire the request before the auth
 * token is ready. Previously, calling getToken() during Clerk init returned
 * null → backend 401 → caught and swallowed → providers stayed empty
 * forever, wedging `loading: true`.
 */
export function useProviders(): { providers: ProviderConfig[]; loading: boolean } {
  const { getToken, isLoaded } = useAuth();
  const providers = useUIStore((s) => s.providers);
  const setProviders = useUIStore((s) => s.setProviders);

  useEffect(() => {
    if (!isLoaded) return; // wait for Clerk
    if (providers.length > 0) return; // already loaded
    let cancelled = false;
    getProviders(getToken)
      .then((p) => {
        if (!cancelled) setProviders(p);
      })
      .catch((err: unknown) => console.error('Failed to load providers:', err));
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Still "loading" if Clerk hasn't initialized yet OR providers haven't arrived.
  return { providers, loading: !isLoaded || providers.length === 0 };
}
