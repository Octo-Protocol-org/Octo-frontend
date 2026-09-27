"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GasPumpIcon } from "./icons";

export function WalletSidebar({
  walletId,
  walletName,
  isOpen,
  onClose,
}: {
  walletId: string;
  walletName: string;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const base = `/dashboard/wallets/${walletId}`;

  const NAV = [
    { label: "Overview", href: base, icon: "▦" },
    { label: "Assets", href: `${base}/assets`, icon: "$" },
    { label: "Transactions", href: `${base}/transactions`, icon: "◷" },
    { label: "Addresses", href: `${base}/addresses`, icon: "▢" },
    { label: "Payment Links", href: `${base}/payment-links`, icon: "⎘" },
    { label: "Beneficiaries", href: `${base}/beneficiaries`, icon: "⚇" },
    {
      label: "Sponsorship",
      href: `${base}/sponsorship`,
      icon: <GasPumpIcon />,
    },
    { label: "Gas tank", href: `${base}/gas-tank`, icon: "⛽" },
    { label: "Developers", href: `${base}/api`, icon: "›_" },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface-sunken px-3 py-5 transition-transform duration-300 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button for mobile */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-5 rounded-md p-1 text-muted hover:bg-hover hover:text-foreground lg:hidden"
          aria-label="Close menu"
        >
          ✕
        </button>

        <div className="px-2">
          <Logo />
        </div>

        {/* wallet selector chip */}
        <div className="mt-5 rounded-xl border border-border bg-surface-raised px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {walletName}
          </p>
          <div className="mt-1 flex gap-1.5">
            <span className="rounded-md bg-burgundy/30 px-2 py-0.5 text-[10px] text-burgundy-bright">
              Stellar
            </span>
            <span className="rounded-md bg-hover px-2 py-0.5 text-[10px] text-muted">
              Testnet
            </span>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground"
            onClick={onClose}
          >
            <span className="w-4 text-center opacity-80">⌂</span> My Wallets
          </Link>
          {NAV.map((item) => {
            const active =
              item.href === base ? pathname === base : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-burgundy/25 text-foreground"
                    : "text-muted hover:bg-hover hover:text-foreground"
                }`}
              >
                <span className="w-4 text-center opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Lives in the shared sidebar so all eight wallet pages get it from one place. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-[11px] text-muted">Appearance</span>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
