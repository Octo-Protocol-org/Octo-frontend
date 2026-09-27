"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { WalletSidebar } from "@/components/dashboard/WalletSidebar";
import { DashboardBackground } from "@/components/dashboard/DashboardBackground";

type WalletPageShellProps = {
  walletId: string;
  walletName: string;
  section: string;
  children: React.ReactNode;
};

/** Shared chrome for every wallet page: test banner, navigation, breadcrumbs, and logout. */
export function WalletPageShell({
  walletId,
  walletName,
  section,
  children,
}: WalletPageShellProps) {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <DashboardBackground />
      <div className="relative z-10 bg-burgundy/20 py-2 text-center text-xs text-burgundy-bright">
        You are currently on <strong>test mode</strong> (Stellar testnet).
      </div>
      <div className="relative z-10 flex flex-1">
        <WalletSidebar
          walletId={walletId}
          walletName={walletName}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              {/* Hamburger menu button for mobile */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-1 text-muted hover:bg-hover hover:text-foreground lg:hidden"
                aria-label="Open menu"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm text-muted">
                <Link href="/dashboard" className="shrink-0 hover:text-foreground">
                  My Wallets
                </Link>
                <span aria-hidden="true">›</span>
                <Link
                  href={`/dashboard/wallets/${walletId}`}
                  className="max-w-[10rem] truncate hover:text-foreground sm:max-w-xs"
                >
                  {walletName}
                </Link>
                {section !== "Overview" && (
                  <>
                    <span aria-hidden="true">›</span>
                    <span className="truncate text-foreground">{section}</span>
                  </>
                )}
              </nav>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="ml-4 shrink-0 rounded-md px-2 py-1 text-lg leading-none text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy-bright"
            >
              <span aria-hidden="true">⏻</span>
            </button>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
