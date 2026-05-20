'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MenuIcon, BookmarkIcon } from 'lucide-react';
import { useUIStore } from '@/store/ui.store';

interface TopBarProps {
  title?: string;
}

/**
 * Organism: top application bar — hamburger, title, highlights toggle.
 */
export function TopBar({ title }: TopBarProps) {
  const { toggleSidebar, toggleHighlightsPanel } = useUIStore();

  return (
    <header className="flex h-16 items-center gap-3 bg-navy px-6 shrink-0 border-b border-navy-dark">
      {/* Mobile hamburger */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 text-white/75 hover:text-white hover:bg-white/10"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
          }
        />
        <TooltipContent>Menu</TooltipContent>
      </Tooltip>

      <h1 className="flex-1 text-sm font-semibold text-white truncate">
        {title ?? 'PromptHub'}
      </h1>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-white/75 hover:text-white hover:bg-white/10"
              onClick={toggleHighlightsPanel}
            >
              <BookmarkIcon className="h-4 w-4" />
              Highlights
            </Button>
          }
        />
        <TooltipContent>View bookmarked responses</TooltipContent>
      </Tooltip>
    </header>
  );
}
