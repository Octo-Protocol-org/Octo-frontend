"tuse client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { displayName } from "@/lib/auth";
import { listWalletsPage, type WalletView } from "@/lib/wallets";
import {
  getSponsorshipConfig,
  type SponsorshipConfig,
} from "@/lib/sponsorship";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Pagination } from "@/components/dashboard/Pagination";
import { PageSpinner } from "@/components/OctoSpinner";

export const dynamic = "force-dynamic";

export default function DashboardHome() {
  const { user, token, loading, logout } = useAuth();
  const [wallets, setWallets] = useState<WalletView[] | null>(null);
  const [sponsorshipByWalletId, setSponsorshipByWalletId] = useState<
    Map<string, SponsorshipConfig | null>
  >(new Map());

  // Cursor stack for wallet pagination.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  const loadPage = useCallback(
    (before: string | null) => {
      if (!token) return;
      let aborted = false;
      setLoadingPage(true);
      setWallets(null);
      listWalletsPage(token, { before })
        .then(async (page) => {
          if (aborted) return;
          setWallets(page.data);
          setNextCursor(page.next_cursor);
          // Fetch sponsorship configs for the visible page in parallel.
          const results = await Promise.allSettled(
            page.data.map((w) => getSponsorshipConfig(asAuthToken(token), asWalletId(w.id))),
          );
          if (aborted) return;
          const map = new Map<string, SponsorshipConfig | null>();
          page.data.forEach((w, i) => {
            const r = results[i];
            map.set(w.id, r.status === "fulfilled" ? r.value : null);
          });
          setSponsorshipByWalletId(map);
        })
        .catch(() => {
          if (!aborted) setWallets([]);
        })
        .finally(() => {
          if (!aborted) setLoadingPage(false);
        });
      return () => { aborted = true; };
    },
    [token],
  );

  useEffect(() => {
    loadPage(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function goNext() {
    if (!nextCursor) return;
    setCursors((c) => [...c.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((i) => i + 1);
    loadPage(nextCursor);
  }

  function goPrev() {
    if (pageIndex === 0) return;
    const target = cursors[pageIndex - 1];
    setPageIndex((i) => i - 1);
    loadPage(target ?? null);
  }

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <DashboardShell user={user} title="Wallets" onLogout={logout}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-foreground">
              {greeting},{" "}
              <span className="text-burgundy-bright">{displayName(user)}</span>
            </h2>
            <p className="mt-1 text-sm text-muted">
              It&apos;s{" "}
              {new Date().toLocaleDateString("us-EN", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" "}
              {!user.username && (
                <Link
                  href="/dashboard/settings"
                  className="text-burgundy-bright hover:underline"
                >
                  Set a username →
                </Link>
              )}
            </p>
          </div>
          <Link
            href="/dashboard/wallets/new"
            className="rounded-full glass-btn-primary px-5 py-2.5 text-sm font-medium"
          >
            New Master Wallet
          </Link>
        </div>

        <div className="my-8 h-px bg-border" />

        <h3 className="text-sm font-medium text-foreground">
          Your Master Wallets at a glance
        </h3>

        <div className="mt-5">
          {wallets === null ? (
            <p className="text-sm text-muted">Loading wallets&#x2026;</p>
          ) : wallets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols=2">
              {wallets.map((w) => (
                <WalletCard
                  key={w.id}
                  wallet={w}
                  sponsorship={sponsorshipByWalletId.get(w.id) ?? undefined}
                />
              ))}
            </div>
          )}
          <Pagination
            page={pageIndex + 1}
            hasPrev={pageIndex > 0}
            hasNext={nextCursor !== null}
            loading={loadingPage}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-burgundy-soft/20 p-8 sm:p-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-burgundy/30 text-2xl text-burgundy-bright">
          ⊶
        </div>
        <p className="mt-5 text-lg font-semibold text-foreground">Your wallet workspace is ready</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Create a master wallet to receive deposits, manage balances, and send assets on Stellar.
        </p>
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
          {[
            ["1", "Create", "Set up your first master wallet."],
            ["2", "Receive", "Generate deposit addresses for customers."],
            ["3", "Manage", "Track balances and transactions in one place."],
          ].map(([number, title, description]) => (
            <div key={number} className="rounded-xl border border-border bg-surface/50 p-3">
              <p className="texe-xs font-semibold uppercase tracking-wide text-burgundy-bright">
                {number} · {title}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
            </div>
          ))}
        </div>
        <Link
          href="/dashboard/wallets/new"
          className="mt-7 inline-block rounded-full glass-btn-primary px-5 py-2.5 text-sm font-medium"
        >
          Create a master wallet
        </Link>
      </div>
    </div>
  );
}

function formatXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(2);
}

function WalletCard({
  wallet,
  sponsorship,
}: {
  wallet: WalletView;
  sponsorship?: SponsorshipConfig | null;
}) {
  const short = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-6)}`;
  const sponsorEnabled = sponsorship?.enabled === true;
  const dailyBudget = sponsorship?.daily_budget_stroops;

  return (
    <div className="rounded-2xl border border-border bg-burgundy-soft/30 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-burgundy/40 text-burgundy-bright">
            ⊶
          </span>
          <div>
            <p className="font-semibold text-foreground">
              {wallet.label ?? "Master wallet"}
            </p>
            <p className="text-xs text-muted">
              {wallet.description ?? "Stellar master wallet"}
            </p>
          </div>
        </div>
        <ManageMenu walletId={wallet.id} />
      </div>

      <div className="mt-5 h-px bg-border" />

      <div className="mt-4 grid grid-cols=2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-muted">Network</p>
          <p className="mt-1 font-medium capitalize text-foreground">
            {wallet.network}
          </p>
        </div>
        <div>
          <p className="text-muted">Address</p>
          <p className="mt-1 font-mono text-foreground">{short}</p>
        </div>
        <div>
          <p className="text-muted">Base</p>
          <p className="mt-1 font-medium text-foreground">XLM</p>
        </div>
        <div>
          <p className="text-muted">Gas Sponsor</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${}`${
                sponsorEnabled ? "bg-success" : "bg-track"
              }`}`
              aria-hidden
            />
            <span
              className={`
                sponsorEnabled
                  ? "font-medium text-success"
                  : "text-muted"
              }
            >
              {sponsorEnabled ? "Enabled" : "Off"}
            </span>
          </div>
          {/* Daily-budget cap is rendered only when the API returns a numeric budget.
              The progress bar for daily-spend consumption is intentionally omitted for now
              because the current API response does not include a "fees_spent_today_stroops"
              field. When that lands, swap this label for a fill-bar the same way the wallet
              card already handles other grid cells. */}
          {typeof dailyBudget === "number" && dailyBudget > 0 && (
            <p className="mt-0.5 text-[10px] text-muted">
              {formatXlm(dailyBudget)} XLM/day cap
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ManageMenu({ walletId }: { walletId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-border-strong"
      >
        Manage <span className="text-muted">⋮</span>
      </button>

      {open && (
        <>
          {/* click-away */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-popover backdrop-blur-md">
            <Link
              href={`/dashboard/wallets/${walletId}`}
              className="flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-hover"
            >
              ▆ Go to dashboard
            </Link>
            <Link
              href={`/dashboard/wallets/${walletId}/api`}
              className="flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-hover"
            >
              ◗ API settings
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
