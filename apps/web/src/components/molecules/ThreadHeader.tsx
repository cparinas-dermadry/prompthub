'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Maximize2Icon, XIcon, ChevronDownIcon, Minimize2Icon } from 'lucide-react';
import { StatusDot } from '@/components/atoms/StatusDot';
import type { StreamingStatus } from '@/store/session.store';

interface ModelOption {
  id: string;
  displayName: string;
}

interface ThreadHeaderProps {
  displayName: string;
  accentColor: string;
  status: StreamingStatus;
  availableModels: ModelOption[];
  currentModelId: string;
  isExpanded: boolean;
  onExpandToggle: () => void;
  onRemove: () => void;
  onModelChange: (modelId: string, displayName: string) => void;
}

/**
 * Molecule: tile header — status dot, model name (switchable), expand, remove.
 */
export function ThreadHeader({
  displayName,
  accentColor,
  status,
  availableModels,
  currentModelId,
  isExpanded,
  onExpandToggle,
  onRemove,
  onModelChange,
}: ThreadHeaderProps) {
  const hasAlternatives = availableModels.length > 1;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100/70 shrink-0 bg-slate-50/60">
      {/* Small brand colour dot instead of coloured top border */}
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
      <StatusDot status={status} />

      {/* Model name / switcher */}
      {hasAlternatives ? (
        <div className="relative flex-1 min-w-0">
          <select
            value={currentModelId}
            onChange={(e) => {
              const chosen = availableModels.find((m) => m.id === e.target.value);
              if (chosen) onModelChange(chosen.id, chosen.displayName);
            }}
            className="w-full appearance-none bg-transparent pr-5 text-sm font-medium text-body cursor-pointer focus:outline-none truncate"
            title="Switch model"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-fg" />
        </div>
      ) : (
        <span className="flex-1 text-sm font-medium text-body truncate">{displayName}</span>
      )}

      {/* Remove tile */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-fg hover:text-danger"
              onClick={onRemove}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <TooltipContent side="top">Remove</TooltipContent>
      </Tooltip>

      {/* Expand/Contract Button */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpandToggle}
              title={isExpanded ? 'Contract' : 'Expand'}
            >
              {isExpanded ? <Minimize2Icon className="h-4 w-4" /> : <Maximize2Icon className="h-4 w-4" />}
            </Button>
          }
        />
        <TooltipContent side="top">{isExpanded ? 'Contract' : 'Expand'}</TooltipContent>
      </Tooltip>
    </div>
  );
}
