'use client';

import { useProviders } from '@/hooks/use-providers';
import { useSettingsStore } from '@/store/settings.store';
import { cn } from '@/lib/utils';
import { CheckIcon, PlusCircleIcon, MinusCircleIcon } from 'lucide-react';
import type { ProviderConfig } from '@prompthub/types';

/** Radio-style row for picking a model variant within an enabled provider */
function ModelOption({
  model,
  selected,
  onClick,
}: {
  model: ProviderConfig;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-all w-full',
        selected
          ? 'border-navy bg-[rgba(39,93,137,0.06)] font-medium text-navy'
          : 'border-divider bg-white hover:border-slate-300 hover:bg-surface text-body',
      )}
    >
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: model.logoColor }} />
      <span className="flex-1 truncate">{model.displayName}</span>
      {model.free ? (
        <span className="text-xs text-teal font-medium">Free</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          ${((model.costPer1kTokens as number) * 1000).toFixed(2)}/M
        </span>
      )}
      {/* Radio indicator */}
      <div
        className={cn(
          'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
          selected ? 'bg-navy border-navy' : 'border-slate-300',
        )}
      >
        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const { providers, loading } = useProviders();
  const { autoAddProviders, toggleProvider, setProviderModel } = useSettingsStore();

  // Group models by provider label (e.g. 'Anthropic', 'OpenAI', …)
  const groups = providers.reduce<Record<string, ProviderConfig[]>>((acc, p) => {
    (acc[p.provider] ??= []).push(p);
    return acc;
  }, {});

  const activeCount = Object.keys(autoAddProviders).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-xl w-full mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-bold text-navy">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your workspace preferences.</p>
        </div>

        {/* Auto-Add AIs */}
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-body">Auto-Add AIs</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Toggle which AIs are automatically added to every new session.
                For each enabled AI, choose which model variant to use.
              </p>
            </div>
            {activeCount > 0 && (
              <span className="shrink-0 rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">
                {activeCount} AI{activeCount !== 1 ? 's' : ''} enabled
              </span>
            )}
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading AI models…</p>}

          {!loading &&
            Object.entries(groups).map(([providerLabel, models]) => {
              const isEnabled = autoAddProviders[providerLabel] !== undefined;
              const selectedModelId = autoAddProviders[providerLabel];
              // Default to the model flagged isDefault, or the first in the list
              const fallback = models.find((m) => m.isDefault)?.id ?? models[0]?.id ?? '';

              return (
                <div
                  key={providerLabel}
                  className={cn(
                    'rounded-xl border transition-all',
                    isEnabled ? 'border-navy bg-white shadow-sm' : 'border-divider bg-surface',
                  )}
                >
                  {/* Provider toggle row */}
                  <button
                    onClick={() => toggleProvider(providerLabel, fallback)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div
                      className={cn(
                        'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                        isEnabled ? 'bg-navy border-navy' : 'border-slate-300 bg-white',
                      )}
                    >
                      {isEnabled && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                    <span
                      className={cn(
                        'flex-1 text-sm font-semibold',
                        isEnabled ? 'text-navy' : 'text-body',
                      )}
                    >
                      {providerLabel}
                    </span>
                    {isEnabled ? (
                      <MinusCircleIcon className="h-4 w-4 text-slate-400" />
                    ) : (
                      <PlusCircleIcon className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {/* Model picker — visible only when provider is enabled */}
                  {isEnabled && (
                    <div className="border-t border-divider px-4 pb-4 pt-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Default model (required)
                      </p>
                      {models.map((model) => (
                        <ModelOption
                          key={model.id}
                          model={model}
                          selected={selectedModelId === model.id}
                          onClick={() => setProviderModel(providerLabel, model.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {!loading && activeCount === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No AIs enabled — new sessions will start empty.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

