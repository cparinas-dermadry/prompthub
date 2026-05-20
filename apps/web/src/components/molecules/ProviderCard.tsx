'use client';

import { cn } from '@/lib/utils';
import { ProviderBadge } from '@/components/atoms/ProviderBadge';
import { CheckIcon } from 'lucide-react';
import type { ProviderConfig } from '@prompthub/types';

interface ProviderCardProps {
  provider: ProviderConfig;
  selected: boolean;
  onToggle: (id: string) => void;
}

/**
 * Molecule: selectable provider card used inside the provider-selector modal.
 * Pure presentational — selection state and callbacks come from outside (DIP).
 */
export function ProviderCard({ provider, selected, onToggle }: ProviderCardProps) {
  return (
    <button
      onClick={() => onToggle(provider.id)}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left w-full transition-colors',
        selected
          ? 'border-navy bg-navy/5 text-body'
          : 'border-divider bg-white text-body hover:border-teal hover:bg-surface',
      )}
    >
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: provider.logoColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{provider.displayName}</p>
        <p className="text-xs text-muted-foreground truncate capitalize">{provider.provider}</p>
      </div>
      <ProviderBadge
        name=""
        color=""
        free={provider.free}
        className={provider.free ? '' : 'hidden'}
      />
      {selected && <CheckIcon className="h-4 w-4 text-navy shrink-0" />}
    </button>
  );
}
