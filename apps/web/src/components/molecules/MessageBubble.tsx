'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BookmarkIcon, CopyIcon } from 'lucide-react';
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
export function MessageBubble({ message, onBookmark, onCopy, isPending, compact = false }: MessageBubbleProps) {
  return (
    <div className="group relative">
      <div
        className={cn(
          'max-w-none text-body',
          compact
            ? 'prose prose-xs text-[11px] leading-snug [&_p]:my-1 [&_li]:my-0.5 [&_pre]:text-[11px]'
            : 'prose prose-sm',
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>

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
}
