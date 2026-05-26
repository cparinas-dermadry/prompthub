'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCwIcon, PencilIcon, CheckIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserBubbleProps {
  /** The message ID of this user message — used as the rewind point for retry. */
  messageId: string;
  content: string;
  /**
   * When true, hover icons appear for Retry and Edit. Setting this on
   * non-latest messages enables "rewind to turn N" — invokes the retry
   * with this bubble as the rewind point, silently deleting any messages
   * timestamped after it.
   */
  showActions: boolean;
  /** When true, this is NOT the latest user message — retry will rewind/discard subsequent turns. */
  isHistorical?: boolean;
  /** Disable actions while a stream is in flight for this tile. */
  disabled?: boolean;
  /** Called when the user clicks Retry. Receives this bubble's messageId. */
  onRetry: (messageId: string) => void;
  /** Called when the user saves an inline edit. Receives the messageId and new content. */
  onEditSave: (messageId: string, newContent: string) => void;
  /** Tighter spacing for compact (minimized) tiles. */
  compact?: boolean;
}

/**
 * Molecule: a single user message bubble (right-aligned, neutral gray)
 * with a hover-reveal action toolbar containing Retry and Edit, and an
 * inline edit mode triggered from the pencil icon.
 *
 * No side-effects inside this component — callbacks bubble up to AITile,
 * which owns the streaming hook.
 */
export const UserBubble = memo(function UserBubble({
  messageId,
  content,
  showActions,
  isHistorical = false,
  disabled = false,
  onRetry,
  onEditSave,
  compact = false,
}: UserBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus + select the textarea when entering edit mode so the user can
  // immediately overwrite or refine the existing content.
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Sync draft when content changes externally (e.g. server-side persistence
  // returns the canonical content after a retry-with-edit completes).
  useEffect(() => {
    if (!isEditing) setDraft(content);
  }, [content, isEditing]);

  function handleEditStart() {
    setDraft(content);
    setIsEditing(true);
  }

  function handleEditCancel() {
    setDraft(content);
    setIsEditing(false);
  }

  function handleEditSave() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === content) {
      // No change — exit cleanly without firing the retry
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    onEditSave(messageId, trimmed);
  }

  function handleRetryClick() {
    onRetry(messageId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // ⌘/Ctrl+Enter saves; Escape cancels — same conventions as PromptInput
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    }
  }

  if (isEditing) {
    return (
      <div className="flex w-full justify-end">
        <div className="w-full max-w-[92%] space-y-1.5">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.min(8, Math.max(2, draft.split('\n').length))}
            className={cn(
              'resize-none bg-white border-slate-300 text-body focus-visible:ring-teal focus-visible:border-teal',
              compact && 'text-[11px] leading-snug',
            )}
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={handleEditCancel}
            >
              <XIcon className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs bg-navy hover:bg-navy-dark"
              onClick={handleEditSave}
              disabled={draft.trim().length === 0}
            >
              <CheckIcon className="h-3.5 w-3.5 mr-1" />
              Save & retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-end">
      <div className="relative max-w-[92%]">
        <div
          className={cn(
            'whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-slate-100 text-body',
            compact ? 'rounded-xl px-2 py-1 text-[11px] leading-snug' : 'px-3.5 py-2 text-sm',
          )}
        >
          {content}
        </div>

        {showActions && (
          // Positioned to the LEFT of the right-aligned user bubble, vertically centered.
          // `right-full mr-1.5` puts the toolbar's right edge at the bubble's left edge
          // with a small gap so it doesn't crowd the bubble. Tooltips drop BELOW each
          // icon so they don't fly off the tile edge on narrow columns.
          <div className="absolute top-1/2 right-full -translate-y-1/2 mr-1.5 hidden group-hover:flex items-center gap-0.5 bg-white rounded-md p-0.5 border border-divider shadow-sm">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-body"
                    disabled={disabled}
                    onClick={handleEditStart}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {isHistorical ? 'Edit & rewind from here' : 'Edit & retry'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-body"
                    disabled={disabled}
                    onClick={handleRetryClick}
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {isHistorical ? 'Rewind & retry from here' : 'Retry this model'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
});
