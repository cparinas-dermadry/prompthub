import { cn } from '@/lib/utils';
import type { StreamingStatus } from '@/store/session.store';

const COLOR_MAP: Record<StreamingStatus, string> = {
  idle: 'bg-zinc-600',
  streaming: 'bg-teal animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500',
};

interface StatusDotProps {
  status: StreamingStatus;
  className?: string;
}

/** Atom: small coloured dot reflecting a thread's streaming status. */
export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      aria-label={status}
      className={cn('inline-block h-2 w-2 rounded-full shrink-0', COLOR_MAP[status], className)}
    />
  );
}
