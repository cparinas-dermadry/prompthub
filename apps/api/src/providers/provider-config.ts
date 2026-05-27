/**
 * Provider type definitions for the API.
 *
 * The static `PROVIDER_REGISTRY` array that used to live here was retired on
 * 2026-05-27. The provider/model catalog is now dynamic — see:
 *   - openrouter-catalog.service.ts  (fetches live /api/v1/models)
 *   - provider-registry.service.ts   (merges catalog + overlay)
 *   - provider-overlay.ts            (brand metadata, allowlist, fallback)
 *
 * If you need the runtime list, inject `ProviderRegistryService` and call
 * `getAll()` / `findById(id)`.
 *
 * NOTE: this type intentionally mirrors `ProviderConfig` in
 * `packages/types/src/index.ts` (consumed by the web app). If you change
 * either, mirror the change in the other so the wire format stays in sync.
 */
export interface ProviderConfig {
  id: string;
  displayName: string;
  /** UI grouping label — also stored as thread.provider in the DB */
  provider: string;
  /** OpenRouter provider slug for provider.only BYOK routing */
  openRouterProvider: string;
  /** When true, route exclusively through provider.only to use BYOK keys. False = use OpenRouter credits. */
  byokOnly: boolean;
  logoColor: string;
  defaultTemperature: number;
  contextWindow: number;
  /** Per-1k-token pricing in USD. Free models use { input: 0, output: 0 }. */
  costPer1kTokens: {
    input: number;
    output: number;
  };
  via: 'openrouter' | 'direct';
  free?: boolean;
  /** Marks the recommended/default model for its provider group */
  isDefault?: boolean;
}
