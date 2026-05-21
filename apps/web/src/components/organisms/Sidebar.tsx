'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlusIcon, SearchIcon, SettingsIcon } from 'lucide-react';
import { SessionNavItem } from '@/components/molecules/SessionNavItem';
import { LoadingSpinner } from '@/components/atoms/LoadingSpinner';
import { useUIStore } from '@/store/ui.store';
import { useSessionStore } from '@/store/session.store';
import { useSessionList } from '@/hooks/use-session-list';
import { useSettingsStore } from '@/store/settings.store';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';

/**
 * Organism: fixed left sidebar — brand, session list, user account.
 * Uses useSessionList hook for data (DIP); UIStore for open state.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen, setPendingAutoAdd } = useUIStore();
  const setSession = useSessionStore((s) => s.setSession);
  const setThreads = useSessionStore((s) => s.setThreads);
  const { sessions, loading, search, setSearch, createSession, deleteSession, renameSession } = useSessionList();
  const autoAddProviders = useSettingsStore((s) => s.autoAddProviders);
  const defaultModelIds = Object.values(autoAddProviders);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteSession(id);
      if (pathname === `/sessions/${id}`) router.push('/');
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  }

  function openNewDialog() {
    setSessionName('');
    setDialogOpen(true);
    // Focus the input after dialog opens
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleCreate() {
    const name = sessionName.trim();
    if (!name) return;
    setCreating(true);
    setDialogOpen(false);
    try {
      const session = await createSession(name);
      // Seed the session store directly from the POST response so the new
      // session workspace renders instantly — no second GET round-trip
      // required. A freshly-created session has no threads, so we seed an
      // empty thread list as well. useSession sees the store is already
      // populated and skips its initial fetch.
      setSession(session);
      setThreads([]);
      // Queue the auto-add for THIS specific session id. SessionWorkspace will
      // only consume the queue when its mounted sessionId matches `session.id`,
      // so the previously-open session can't accidentally pick it up between
      // the Zustand state change and Next.js finishing navigation.
      if (defaultModelIds.length > 0) {
        setPendingAutoAdd({ sessionId: session.id, modelIds: defaultModelIds });
      }
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="max-lg:fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={[
          'flex w-60 shrink-0 flex-col bg-white border-r border-divider',
          'transition-transform duration-200 ease-in-out',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-30',
          sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="flex h-16 items-center px-5 shrink-0 border-b border-divider">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-navy">Prompt</span><span className="text-teal">Hub</span>
          </Link>
        </div>

        {/* New session */}
        <div className="px-3 pt-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-navy font-semibold hover:bg-surface hover:text-navy"
            disabled={creating}
            onClick={openNewDialog}
          >
            <PlusIcon className="h-4 w-4" />
            {creating ? 'Creating…' : 'New Session'}
          </Button>
        </div>

        {/* New session name dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent showCloseButton={false} className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Name your session</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-1">
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g. Blog post research"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setDialogOpen(false);
                }}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none ring-ring focus:ring-2 placeholder:text-muted-foreground"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  className="bg-navy text-white hover:bg-navy-dark"
                  disabled={!sessionName.trim()}
                  onClick={handleCreate}
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search */}
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2 rounded-md border border-input bg-white px-2.5 py-1.5 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
            <SearchIcon className="h-3.5 w-3.5 shrink-0" />
            <input
              type="text"
              placeholder="Search sessions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-body placeholder:text-muted-foreground text-sm"
            />
          </div>
        </div>

        {/* Session list */}
        <ScrollArea className="flex-1 px-3 py-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : sessions.length === 0 && !search ? (
            <p className="px-3 py-2 text-xs text-muted-fg">No sessions yet</p>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-fg">No results for "{search}"</p>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((s) => (
                <SessionNavItem
                  key={s.id}
                  session={s}
                  isActive={pathname === `/sessions/${s.id}`}
                  onDelete={handleDelete}
                  onRename={renameSession}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-divider" />

        {/* Settings link */}
        <div className="px-3 py-1.5">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === '/settings'
                ? 'bg-[rgba(39,93,137,0.08)] text-navy font-semibold'
                : 'text-muted-foreground hover:bg-surface hover:text-body',
            )}
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
            Settings
          </Link>
        </div>

        <div className="border-t border-divider" />

        {/* User */}
        <div className="flex items-center gap-3 px-5 py-3">
          <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8' } }} />
          <span className="text-sm text-muted-foreground truncate">Account</span>
        </div>
      </aside>
    </>
  );
}
