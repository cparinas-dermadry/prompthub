'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BookmarkIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@prompthub/types';

interface MessageBubbleProps {
  message: Message;
  onBookmark: (msg: Message) => void;
  onCopy: (content: string) => void;
  isPending?: boolean;
  compact?: boolean;
}

/**
 * Molecule: a single assistant message with hover-reveal action toolbar.
 * Receives callbacks — no side-effects inside this component (ISP + DIP).
 */
export const MessageBubble = memo(function MessageBubble({ message, onBookmark, onCopy, isPending, compact = false }: MessageBubbleProps) {
  return (
    <div className="group relative">
      <div
        className={cn(
          'max-w-none text-body',
          compact
            ? 'prose prose-xs text-[11px] leading-snug [&_p]:my-1 [&_li]:my-0.5 [&_pre]:text-[11px]'
            : 'prose prose-sm',
          // Cap heading sizes inside tiles. By default prose styles H1/H2/H3
          // at 1.5×–2× body, which makes a model that replies with headings
          // (e.g. Claude often emits a real ## title) visually dwarf its
          // neighbors. Force everything to body-comparable sizes so the
          // side-by-side comparison stays readable.
          '[&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1',
          '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1',
          '[&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
          '[&_h4]:text-[13px] [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1',
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>

      {/* Citations — only rendered for assistant rows produced by web-search-
          capable models with a session location set. The server already
          dedupes by URL; we just lay them out with the domain as the visible
          label so the visibility-testing user can scan sources at a glance. */}
      {message.role === 'assistant' &&
        message.citations &&
        message.citations.length > 0 && (
          <div
            className={cn(
              'mt-2 flex flex-wrap gap-1 border-t border-divider pt-2',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            <span className="text-muted-foreground">Sources:</span>
            {message.citations.map((c, i) => (
              <a
                key={`${c.url}-${i}`}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                title={c.title ?? c.url}
                className="inline-flex items-center gap-0.5 text-teal hover:underline"
              >
                {c.domain ?? c.url}
                <ExternalLinkIcon className="h-3 w-3 opacity-60" />
              </a>
            ))}
          </div>
        )}

      {/* Hover toolbar */}
      <div className="absolute -top-1 right-0 hidden group-hover:flex items-center gap-1 bg-white rounded-md p-0.5 border border-divider shadow-sm">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-body"
                onClick={() => onCopy(message.content)}
              >
                <CopyIcon className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent side="top">Copy</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 transition-colors',
                  message.is_bookmarked
                    ? 'text-teal hover:text-teal'
                    : 'text-muted-foreground hover:text-body',
                )}
                disabled={isPending}
                onClick={() => onBookmark(message)}
              >
                <BookmarkIcon
                  className="h-3.5 w-3.5"
                  fill={message.is_bookmarked ? 'currentColor' : 'none'}
                />
              </Button>
            }
          />
          <TooltipContent side="top">
            {message.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});
