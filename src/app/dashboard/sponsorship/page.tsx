"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { listAllWallets, type WalletView } from "@/lib/wallets";
import {
  getSponsorshipConfig,
  type SponsorshipConfig,
} from "@/lib/sponsorship";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageSpinner } from "@/components/OctoSpinner";
import { SponsorshipSummary } from "@/components/sponsorship/SponsorshipSummary";

type WalletSponsorship = {
  wallet: WalletView;
  config: SponsorshipConfig | null;
};

export default function SponsorshipPage() {
  const { user, token, loading, logout } = useAuth();
  const [rows, setRows] = useState<WalletSponsorship[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadData(signal?: AbortSignal) {
    if (!token) return;
    setLoadError(null);
    listAllWallets(token)
      .then(async (wallets) => {
        // Only the sponsorship config is fetched per wallet — not full wallet details.
        const configs = await Promise.all(
          wallets.map((w) =>
            getSponsorshipConfig(asAuthToken(token), asWalletId(w.id)).catch(() => null),
          ),
        );
        return wallets.map((wallet, i) => ({ wallet, config: configs[i] ?? null }));
      })
      .then(setRows)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRows([]);
        setLoadError(e instanceof Error ? e.message : "Could not load sponsorship data.");
      });
  }

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  return (
    <DashboardShell user={user} title="Gas Sponsorship" onLogout={logout}>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* How it works */}
        <section className="rounded-2xl border border-border bg-burgundy-soft/30 p-6">
          <h2 className="text-base font-semibold text-foreground">How it works</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Gas sponsorship lets your wallet pay the Stellar network fees on
            behalf of your users, so they can transact without holding XLM for
            fees. Octo fee-bumps each eligible transaction up to the per-transaction
            cap and daily budget you configure per wallet. Enable it on a wallet
            and set spend controls to keep costs predictable.
          </p>
          <Link
            href="/docs/gas-sponsorship"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-burgundy-bright hover:underline"
          >
            Read the gas sponsorship docs →
          </Link>
        </section>

        {/* Per-wallet cards */}
        {loadError && (
          <div role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => loadData()}
              className="shrink-0 rounded-lg border border-danger-border px-3 py-1 text-xs font-medium hover:bg-danger-border/20"
            >
              Retry
            </button>
          </div>
        )}
        {rows === null ? (
          <p className="py-10 text-center text-sm text-muted">Loading wallets…</p>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map(({ wallet, config }) => (
              <WalletCard key={wallet.id} wallet={wallet} config={config} />
            ))
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function WalletCard({
  wallet,
  config,
}: {
  wallet: WalletView;
  config: SponsorshipConfig | null;
}) {
  const enabled = config?.enabled ?? false;

  return (
    <div className="rounded-2xl border border-border bg-burgundy-soft/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {wallet.label ?? "Master wallet"}
          </p>
          <p className="mt-0.5 text-xs capitalize text-muted">{wallet.network}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            enabled
              ? "bg-burgundy/30 text-burgundy-bright"
              : "bg-hover text-muted"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <SponsorshipSummary config={config} className="mt-4" />

      <Link
        href={`/dashboard/wallets/${wallet.id}/sponsorship`}
        className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-burgundy-bright hover:underline"
      >
        Sponsorship settings →
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-burgundy-soft/30 p-10 text-center">
      <p className="text-sm font-medium text-foreground">No wallets yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Create a master wallet first, then enable gas sponsorship on it to
        start covering network fees for your users.
      </p>
      <Link
        href="/dashboard/wallets/new"
        className="mt-5 inline-block rounded-lg glass-btn-primary px-4 py-2 text-sm font-semibold"
      >
        Create master wallet
      </Link>
    </div>
  );
}
