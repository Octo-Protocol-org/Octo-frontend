"use client";

import { Sidebar } from "./Sidebar";
import { Parallax } from "@/components/Parallax";
import { DashboardBackground } from "./DashboardBackground";
import { IdleLock } from "./IdleLock";
import { network } from "@/lib/network";
import type { User } from "@/lib/auth";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
        <Sidebar user={user} blockNavigation={blockNavigation} className="hidden lg:flex" />
        {menuOpen && (
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-20 bg-black/40 lg:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-30 lg:hidden">
              <Sidebar user={user} blockNavigation={blockNavigation} className="h-full" />
            </div>
          </>
        )}

        <div className="flex flex-1 flex-col">
          {/* topbar */}
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="rounded-md p-2 text-muted hover:bg-hover hover:text-foreground lg:hidden"
              >
                <span aria-hidden="true">☰</span>
              </button>
              <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={onLogout}
                className="text-sm text-muted transition-colors hover:text-foreground"
                title="Log out"
                aria-label="Log out"
              >
                <span aria-hidden="true">⏻</span>
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <Parallax speed={28}>{children}</Parallax>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
