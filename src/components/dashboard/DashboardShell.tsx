"use client";

import { Sidebar } from "./Sidebar";
import { Parallax } from "@/components/Parallax";
import { DashboardBackground } from "./DashboardBackground";
import { IdleLock } from "./IdleLock";
import { network } from "@/lib/network";
import type { User } from "@/lib/auth";

/** Dashboard chrome: network banner, idle-warning banner, sidebar, topbar, content. */
export function DashboardShell({
  user,
  title,
  onLogout,
  blockNavigation,
  children,
}: {
  user?: User | null;
  title: string;
  onLogout: () => void;
  blockNavigation?: (href: string) => boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <DashboardBackground />

      {/* idle auto-lock warning banner */}
      <IdleLock onLogout={onLogout} />

      {/* network banner */}
      {network.isTestnet && (
        <div className="test-mode-banner relative z-10 bg-burgundy/20 py-2 text-center text-xs text-burgundy-bright">
          You are currently on <strong>{network.displayName}</strong>.
          Mainnet support is coming soon.
        </div>
      )}

      <div className="relative z-10 flex flex-1">
        <Sidebar user={user} blockNavigation={blockNavigation} />

        <div className="flex flex-1 flex-col">
          {/* topbar */}
          <header className="flex items-center justify-between border-b border-border px-8 py-4">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={onLogout}
                className="text-sm text-muted transition-colors hover:text-foreground"
                title="Log out"
              >
                ⏻
              </button>
            </div>
          </header>

          <main className="flex-1 px-8 py-8">
            <div className="mx-auto w-full max-w-6xl">
              <Parallax speed={28}>{children}</Parallax>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
