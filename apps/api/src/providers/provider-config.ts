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
  /**
   * Per-model parameter capability list, taken verbatim from OpenRouter's
   * /api/v1/models `supported_parameters` field. StreamingService consults
   * this before adding optional fields like `temperature` to the request
   * body — newer reasoning models (e.g. GPT-5.x, Claude Opus 4.7) omit
   * `temperature` from this list and will 400 if it's sent.
   *
   * Empty array (vs undefined) means "model exists but advertises no
   * tunable parameters" — undefined means "we didn't fetch from the live
   * catalog" (baseline fallback path). Treat both conservatively: only
   * send a parameter if we can prove the model accepts it.
   */
  supportedParameters?: readonly string[];
  /**
   * True when the model has a usable NATIVE web-search path through
   * OpenRouter — i.e. the `openrouter:web_search` server tool with
   * `engine: "native"` will actually honor `user_location` instead of
   * silently falling back to Exa (which ignores location, per the
   * OpenRouter docs).
   *
   * Populated from a hand-curated allowlist in provider-overlay.ts
   * (WEB_SEARCH_CAPABLE). OpenRouter's `supported_parameters` does NOT
   * advertise web-search capability, so this can't be derived from the
   * live catalog — keep the list small and current.
   *
   * StreamingService uses this to decide whether to attach the
   * `openrouter:web_search` tool with `user_location` when the user
   * sets a session location.
   */
  supportsWebSearch?: boolean;
}
