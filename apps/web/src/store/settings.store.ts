import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Maps a provider label (e.g. 'Anthropic') to the specific model ID the user
 * wants auto-added when creating a new session (e.g. 'anthropic/claude-sonnet-4.6').
 * A provider is considered "enabled for auto-add" if it has an entry here.
 */
export type AutoAddProviders = Record<string, string>;

interface SettingsState {
  /**
   * Auto-add config: provider label → model ID.
   * Only providers with an entry are added on new session creation.
   */
  autoAddProviders: AutoAddProviders;

  /** Toggle a provider on/off. When turning on, sets its model to fallbackModelId. */
  toggleProvider: (providerLabel: string, fallbackModelId: string) => void;

  /** Update which model is used for a provider that is already enabled. */
  setProviderModel: (providerLabel: string, modelId: string) => void;
}

/**
 * Remap retired model IDs to their current replacements.
 * Mirrors the server-side MODEL_MIGRATIONS in apps/api/src/streaming/streaming.service.ts —
 * keep these two lists in sync when removing models from the registry.
 */
const CLIENT_MODEL_MIGRATIONS: Record<string, string> = {
  // Anthropic — registry refresh 2026-05-26
  'anthropic/claude-sonnet-4': 'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4': 'anthropic/claude-opus-4.6',
  'anthropic/claude-opus-4.7-fast': 'anthropic/claude-opus-4.6',
  // OpenAI — gpt-4o family retired
  'openai/gpt-4o': 'openai/gpt-5.1',
  'openai/gpt-4o-mini': 'openai/gpt-5-mini',
  // Google — 2.5-pro retired
  'google/gemini-2.5-pro': 'google/gemini-3.1-pro-preview',
  // xAI — grok-2/3 retired; grok-4 deprecated by xAI 2026-05-26
  'x-ai/grok-2': 'x-ai/grok-4.3',
  'x-ai/grok-3': 'x-ai/grok-4.3',
  'x-ai/grok-4': 'x-ai/grok-4.3',
};

function migrateAutoAddProviders(input: AutoAddProviders): AutoAddProviders {
  const out: AutoAddProviders = {};
  for (const [providerLabel, modelId] of Object.entries(input)) {
    out[providerLabel] = CLIENT_MODEL_MIGRATIONS[modelId] ?? modelId;
  }
  return out;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoAddProviders: {},

      toggleProvider: (providerLabel, fallbackModelId) =>
        set((s) => {
          const next = { ...s.autoAddProviders };
          if (next[providerLabel] !== undefined) {
            delete next[providerLabel];
          } else {
            next[providerLabel] = fallbackModelId;
          }
          return { autoAddProviders: next };
        }),

      setProviderModel: (providerLabel, modelId) =>
        set((s) => ({
          autoAddProviders: { ...s.autoAddProviders, [providerLabel]: modelId },
        })),
    }),
    {
      name: 'prompthub-settings',
      // Bump the version when adding entries to CLIENT_MODEL_MIGRATIONS so that
      // already-loaded clients re-run the migration on next page load.
      version: 3,
      migrate: (persistedState, _version) => {
        const state = (persistedState ?? {}) as Partial<SettingsState>;
        return {
          ...state,
          autoAddProviders: migrateAutoAddProviders(state.autoAddProviders ?? {}),
        } as SettingsState;
      },
    },
  ),
);
