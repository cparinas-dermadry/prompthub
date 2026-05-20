import { cn } from '@/lib/utils';

interface ProviderBadgeProps {
  name: string;
  color: string;
  free?: boolean;
  className?: string;
}

/** Atom: coloured pill showing a provider name with optional FREE label. */
export function ProviderBadge({ name, color, free, className }: ProviderBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}>
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {name}
      {free && (
        <span className="rounded border border-success/40 px-1 text-[10px] text-success">
          FREE
        </span>
      )}
    </span>
  );
}
