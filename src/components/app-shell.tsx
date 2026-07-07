"use client";

import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppShellProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="flex h-screen">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center justify-end px-6">
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="container p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
