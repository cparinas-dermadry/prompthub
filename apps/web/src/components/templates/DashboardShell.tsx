import type { ReactNode } from 'react';
import { Sidebar } from '@/components/organisms/Sidebar';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">{children}</main>
    </div>
  );
}
