"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { displayName, type User } from "@/lib/auth";
import { GasPumpIcon } from "./icons";

const NAV: {
  label: string;
  href: string;
  icon: React.ReactNode;
  soon?: boolean;
}[] = [
  { label: "Home", href: "/dashboard", icon: "⌂" },
  {
    label: "Gas Sponsorship",
    href: "/dashboard/sponsorship",
    icon: <GasPumpIcon />,
  },
  { label: "Asset Recovery", href: "/dashboard/recovery", icon: "↺" },
  { label: "Developers", href: "/dashboard/developers", icon: "›_" },
  { label: "Audit Logs", href: "/dashboard/audit", icon: "▤" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙" },
];

export function Sidebar({
  user,
  blockNavigation,
}: {
  user?: User | null;
  /** Returns true to cancel a nav click (e.g. while unsaved one-time secrets are shown). */
  blockNavigation?: (href: string) => boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-sunken px-3 py-5">
      <div className="px-3">
        <Logo />
        <p className="mt-5 text-sm font-medium text-foreground">
          {user ? displayName(user) : "Account"}
        </p>
        <p className="text-xs text-muted">
          {new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <nav className="mt-6 flex-1 space-y-1">
        {NAV.map((item) => {
          // Coming-soon items are shown disabled (not navigable).
          if (item.soon) {
            return (
              <div
                key={item.label}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted/60"
                title="Coming soon"
              >
                <span className="w-4 text-center opacity-80">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full border border-burgundy/40 px-1.5 py-0.5 text-[9px] uppercase text-burgundy-bright">
                  Soon
                </span>
              </div>
            );
          }
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onNavigate={(e) => {
                if (blockNavigation?.(item.href)) e.preventDefault();
              }}
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

      <div className="rounded-xl border border-border bg-burgundy-soft/30 p-4">
        <p className="text-sm font-semibold text-foreground">Free Plan</p>
        <p className="mt-1 text-[11px] text-muted">0 of 100 Addresses</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hover">
          <div className="h-full w-[2%] rounded-full bg-burgundy-bright" />
        </div>
        <button className="mt-4 w-full rounded-lg bg-foreground py-2 text-xs font-semibold text-background">
          Upgrade
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted">Appearance</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
