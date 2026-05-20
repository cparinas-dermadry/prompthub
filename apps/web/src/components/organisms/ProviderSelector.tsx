'use client';

import { useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckIcon } from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import type { ProviderConfig } from '@prompthub/types';

interface ProviderSelectorProps {
  open: boolean;
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
  disabledProviders?: string[];
}

const PROVIDER_META: Record<string, { color: string; brand: string }> = {
  Anthropic:  { color: '#D97757', brand: 'Claude' },
  OpenAI:     { color: '#10A37F', brand: 'ChatGPT' },
  Google:     { color: '#4285F4', brand: 'Gemini' },
  xAI:        { color: '#1DA1F2', brand: 'Grok' },
  Perplexity: { color: '#20808D', brand: 'Perplexity' },
  DeepSeek:   { color: '#4D6BFE', brand: 'DeepSeek' },
  Meta:       { color: '#0064E0', brand: 'Llama' },
  Mistral:    { color: '#FF7000', brand: 'Mistral' },
};

/**
 * Organism: single-step provider picker.
 * Clicking a provider card selects its default model automatically.
 * The model can be swapped inside the AITile after adding.
 */
export function ProviderSelector({ open, onConfirm, onClose, disabledProviders = [] }: ProviderSelectorProps) {
  const { providers, selectedProviderIds, setSelectedProviders } = useUIStore();

  // Reset selection each time the dialog opens
  useEffect(() => {
    if (open) setSelectedProviders([]);
  }, [open, setSelectedProviders]);

  /** One entry per provider, using its isDefault model (fallback to first) */
  const providerDefaults = useMemo(() => {
    const map = new Map<string, ProviderConfig>();
    for (const p of providers) {
      if (!map.has(p.provider) || p.isDefault) {
        map.set(p.provider, p);
      }
    }
    return Array.from(map.values());
  }, [providers]);

  function toggleProvider(defaultModelId: string) {
    setSelectedProviders(
      selectedProviderIds.includes(defaultModelId)
        ? selectedProviderIds.filter((id) => id !== defaultModelId)
        : [...selectedProviderIds, defaultModelId],
    );
  }

  function handleClose() {
    setSelectedProviders([]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-white border-divider text-body max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-body">Add AI models</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            The best model for each is added automatically. You can swap it in the tile later.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-80">
          <div className="grid grid-cols-2 gap-2 p-1">
            {providerDefaults.map((p) => {
              const meta = PROVIDER_META[p.provider] ?? { color: '#7c3aed', brand: p.provider };
              const selected = selectedProviderIds.includes(p.id);
              const isDisabled = disabledProviders.includes(p.provider);
              return (
                <button
                  key={p.provider}
                  onClick={() => !isDisabled && toggleProvider(p.id)}
                  disabled={isDisabled}
                  className={[
                    'relative flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors',
                    isDisabled
                      ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-navy bg-navy/5'
                        : 'border-divider bg-white hover:border-navy hover:bg-navy/5',
                  ].join(' ')}
                  title={isDisabled ? 'Already added' : ''}
                >
                  {selected && (
                    <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-teal">
                      <CheckIcon className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                  <span className="text-sm font-semibold" style={{ color: meta.color }}>
                    {meta.brand}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.provider}</span>
                  {p.free && (
                    <span className="mt-1 text-[10px] font-medium text-success">Free</span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <span className="text-xs text-muted-foreground self-center mr-auto">
            {selectedProviderIds.length} selected
          </span>
          <Button variant="outline" className="border-divider text-muted-foreground" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            disabled={selectedProviderIds.length === 0}
            className="bg-navy hover:bg-navy-dark text-white disabled:opacity-40"
            onClick={() => onConfirm(selectedProviderIds)}
          >
            Add Models
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
