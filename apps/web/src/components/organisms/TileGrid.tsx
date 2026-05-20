'use client';

import { AITile } from '@/components/organisms/AITile';
import { useSessionStore } from '@/store/session.store';
import { useUIStore } from '@/store/ui.store';
import { cn } from '@/lib/utils';

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
};

function gridCols(count: number): string {
  return GRID_COLS[count] ?? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
}

/**
 * Organism: responsive grid of AI tiles + expanded overlay.
 * Delegates rendering to AITile (OCP — open to new tile types without changing TileGrid).
 */
export function TileGrid() {
  const threads = useSessionStore((s) => s.threads);
  const { expandedThreadId } = useUIStore();

  const expandedThread = threads.find((t) => t.id === expandedThreadId) ?? null;
  const minimizedThreads = expandedThread
    ? threads.filter((t) => t.id !== expandedThread.id)
    : [];

  if (threads.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm text-center px-4">
          No AI models added yet. Click <strong className="text-body">Add Models</strong> to
          start comparing responses.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('relative flex-1', threads.length > 8 ? 'overflow-y-auto' : 'overflow-hidden')}>
      {/* Expanded split layout: main chat left, minimized previews right */}
      {expandedThread && (
        <div className="h-full overflow-hidden p-4">
          <div className="flex h-full min-h-0 gap-4">
            <div className="min-w-0 flex-1">
              <AITile thread={expandedThread} mode="expanded" />
            </div>

            {minimizedThreads.length > 0 && (
              <aside className="w-[320px] max-w-[38%] min-w-60 shrink-0">
                <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
                  {minimizedThreads.map((thread) => (
                    <div key={thread.id} className="h-44 min-h-44 shrink-0">
                      <AITile thread={thread} mode="minimized" />
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* Normal grid */}
      {!expandedThread && (
        <div
          className={cn(
            'grid gap-4 p-4',
            threads.length > 8 ? 'min-h-full' : 'h-full',
            gridCols(threads.length),
          )}
          style={{ gridAutoRows: threads.length > 8 ? 'minmax(320px, 1fr)' : '1fr' }}
        >
          {threads.map((thread) => (
            <AITile key={thread.id} thread={thread} mode="normal" />
          ))}
        </div>
      )}
    </div>
  );
}
