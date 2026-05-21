'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';
import { HighlightCard } from '@/components/molecules/HighlightCard';
import { useUIStore } from '@/store/ui.store';
import { useSessionStore } from '@/store/session.store';
import { useBookmark } from '@/hooks/use-bookmark';

/**
 * Organism: slide-in panel displaying all bookmarked messages.
 * Reads bookmarks from store; delegates un-bookmark to useBookmark hook (DIP + SRP).
 */
export function HighlightsPanel() {
  const { highlightsPanelOpen, toggleHighlightsPanel } = useUIStore();
  const threads = useSessionStore((s) => s.threads);
  const messages = useSessionStore((s) => s.messages);
  const { toggle: toggleBookmark } = useBookmark();

  // Cheap to subscribe and bail early — skip the flatMap/sort entirely when
  // the panel is closed. Previously the sort ran on every parent render even
  // when the panel was hidden, including during streaming.
  if (!highlightsPanelOpen) return null;

  const bookmarked = Object.entries(messages)
    .flatMap(([threadId, msgs]) =>
      msgs
        .filter((m) => m.is_bookmarked)
        .map((m) => ({
          ...m,
          threadName: threads.find((t) => t.id === threadId)?.display_name ?? threadId,
        })),
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-divider bg-white shadow-xl">
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-5 shrink-0 border-b border-divider">
        <h2 className="text-sm font-semibold text-body">Highlights</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-body"
          onClick={toggleHighlightsPanel}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {bookmarked.length === 0 ? (
          <p className="text-xs text-muted-fg">
            Bookmark any AI response to save it here.
          </p>
        ) : (
          <div className="space-y-3">
            {bookmarked.map((msg) => (
              <HighlightCard
                key={msg.id}
                message={msg}
                onRemove={(id) => toggleBookmark(id, true)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
