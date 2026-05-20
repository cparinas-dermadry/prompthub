'use client';

import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SendHorizonalIcon, SquareIcon } from 'lucide-react';
import { useStreaming } from '@/hooks/use-streaming';
import { useSessionStore } from '@/store/session.store';

interface PromptInputProps {
  sessionId: string;
}

/**
 * Organism: prompt entry bar with send/stop controls.
 * Delegates streaming logic to useStreaming hook (SRP + DIP).
 */
export function PromptInput({ sessionId }: PromptInputProps) {
  const [value, setValue] = useState('');
  const { isStreaming, send, stop } = useStreaming(sessionId);
  const threadCount = useSessionStore((s) => s.threads.length);
  const hasTempThreads = useSessionStore((s) => s.threads.some((t) => t.id.startsWith('temp-')));

  const canSend = value.trim().length > 0 && threadCount > 0 && !isStreaming && !hasTempThreads;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const text = value;
    setValue('');
    await send(text);
  }, [canSend, value, send]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="border-t border-divider bg-surface px-6 py-4 shrink-0">
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || hasTempThreads}
          rows={3}
          placeholder={
            threadCount === 0
              ? 'Add AI models first…'
              : hasTempThreads
                ? 'Setting up models…'
                : 'Enter your prompt… (⌘ Enter to send)'
          }
          className="flex-1 resize-none bg-white border-divider text-body placeholder:text-muted-fg focus-visible:ring-teal focus-visible:border-teal disabled:opacity-50"
        />

        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={stop}
            title="Stop"
          >
            <SquareIcon className="h-4 w-4" fill="currentColor" />
          </Button>
        ) : (
          <Button
            disabled={!canSend}
            className="h-10 w-10 shrink-0 bg-navy hover:bg-navy-dark disabled:opacity-40"
            size="icon"
            onClick={() => void handleSend()}
            title="Send (⌘ Enter)"
          >
            <SendHorizonalIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="mt-1.5 text-center text-xs text-muted-fg">
        {threadCount} model{threadCount !== 1 ? 's' : ''} · ⌘ Enter to send
      </p>
    </div>
  );
}
