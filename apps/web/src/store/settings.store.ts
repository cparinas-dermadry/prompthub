import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Maps a provider label (e.g. 'Anthropic') to the specific model ID the user
 * wants auto-added when creating a new session (e.g. 'anthropic/claude-sonnet-4').
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
    { name: 'prompthub-settings' },
  ),
);
