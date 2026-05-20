'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { BookmarkIcon } from 'lucide-react';
import type { Message } from '@prompthub/types';

interface HighlightCardProps {
  message: Message & { threadName: string };
  onRemove: (messageId: string) => void;
}

/**
 * Molecule: a bookmarked message card shown in the highlights panel.
 */
export function HighlightCard({ message, onRemove }: HighlightCardProps) {
  return (
    <div className="rounded-lg border border-divider bg-white p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-navy">{message.threadName}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-danger"
          onClick={() => onRemove(message.id)}
          title="Remove bookmark"
        >
          <BookmarkIcon className="h-3.5 w-3.5" fill="currentColor" />
        </Button>
      </div>

      <div className="prose prose-sm max-w-none text-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>

      <p className="text-[10px] text-muted-fg">
        {new Date(message.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
