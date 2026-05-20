'use client';

import Link from 'next/link';
import { Trash2Icon, CheckIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import type { Session } from '@prompthub/types';

interface SessionNavItemProps {
  session: Session;
  isActive: boolean;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function SessionNavItem({ session, isActive, onDelete, onRename }: SessionNavItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename() {
    setDraft(session.name);
    setRenaming(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
  }

  function commitRename() {
    const name = draft.trim();
    if (name && name !== session.name) onRename(session.id, name);
    setRenaming(false);
  }

  if (renaming) {
    return (
      <div className="flex items-center gap-1 px-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenaming(false);
          }}
          onBlur={commitRename}
          className="flex-1 min-w-0 rounded-md border border-input bg-white px-2 py-1 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-red-50 border border-red-100">
        <span className="flex-1 text-xs text-danger truncate">Delete "{session.name}"?</span>
        <button
          onClick={() => onDelete(session.id)}
          className="h-6 w-6 flex items-center justify-center rounded text-danger hover:bg-red-100 transition-colors shrink-0"
          title="Confirm delete"
        >
          <CheckIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-fg hover:bg-surface transition-colors shrink-0"
          title="Cancel"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <Link
        href={`/sessions/${session.id}`}
        onDoubleClick={(e) => { e.preventDefault(); startRename(); }}
        className={cn(
          'flex-1 rounded-md px-3 py-2 text-sm truncate transition-colors',
          isActive
            ? 'bg-[rgba(39,93,137,0.08)] text-navy font-semibold'
            : 'text-muted-foreground hover:bg-surface hover:text-body',
        )}
        title={`${session.name} (double-click to rename)`}
      >
        {session.name}
      </Link>
      <button
        onClick={() => setConfirmDelete(true)}
        className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-md text-muted-fg hover:text-danger hover:bg-surface transition-colors shrink-0"
        title="Delete session"
      >
        <Trash2Icon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
