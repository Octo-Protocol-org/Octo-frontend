"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@/lib/useWallet";
import {
  getBalances,
  USDC_TESTNET,
  type Balance,
} from "@/lib/wallets";
import { AssetIcon } from "@/components/dashboard/AssetIcon";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { PageSpinner } from "@/components/OctoSpinner";
import { SpendableReservedBreakdown } from "@/components/assets/SpendableReservedBreakdown";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — this page reads wallet
// balances, matching the other /dashboard/wallets/:id/* pages.
import { WalletPageShell } from "@/components/dashboard/WalletPageShell";
export const dynamic = "force-dynamic";

export default function AssetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading } = useAuth();

  const { wallet } = useWallet(id);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showUsd, setShowUsd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    if (!token) return;
    setRefreshing(true);
    getBalances(token, id)
      .then((b) => {
        setBalances(b);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load balances."),
      )
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getBalances(token, id, { signal: controller.signal })
      .then((b) => {
        setBalances(b);
        setError(null);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setBalances([]);
        // Without this the page shows "no assets", which looks like an empty wallet rather
        // than a failed request.
        setError(e instanceof Error ? e.message : "Could not load balances.");
      });
    return () => controller.abort();
  }, [token, id]);

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  const xlm = balances.find((b) => b.asset_type === "native");
  const credits = balances.filter((b) => b.asset_type !== "native");

  return (
    <>
    <WalletPageShell
      walletId={id}
      walletName={wallet?.label ?? "Master wallet"}
      section="Assets"
    >

          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
                <p className="mt-1 text-sm text-muted">
                  All assets held by this wallet, live from Stellar.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={showUsd}
                  onChange={(e) => setShowUsd(e.target.checked)}
                  className="accent-[var(--burgundy-bright)]"
                />
                Show USD equivalent
                <span className="text-[10px] text-muted/60">(unavailable on testnet)</span>
              </label>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Total XLM" value={xlm ? `${xlm.balance} XLM` : "0 XLM"} />
              <Stat label="No. of assets" value={String(balances.length || (xlm ? 1 : 0))} />
              <Stat
                label="Trustlines held"
                value={String(credits.length)}
                sub="Non-native assets"
              />
              <Stat label="Reserve" value="1.0 XLM" sub="Base account reserve" />
            </div>

            <SpendableReservedBreakdown token={token} walletId={id} balances={balances} />

            {error && (
              <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <ActionButton
                label={refreshing ? "Refreshing…" : "Refresh"}
                onClick={refresh}
                loading={refreshing}
              />
              {/* Adding a credit asset on Stellar is an on-chain, client-signed ChangeTrust
                  transaction (see the Overview page's trustline flow) — not a display toggle
                  like on an EVM chain, so it is deliberately not wired up here yet. */}
              <ActionButton label="+ Add asset (coming soon)" disabled />
            </div>

            <Panel title="All assets">
              {balances.length === 0 ? (
                <Empty>
                  No assets yet. XLM appears automatically once this wallet is funded.
                </Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="pb-3 pr-4 font-medium">Asset</th>
                        <th className="pb-3 pr-4 font-medium">Balance</th>
                        <th className="pb-3 pr-4 font-medium">Type</th>
                        <th className="pb-3 font-medium">Issuer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {balances.map((b, i) => (
                        <AssetRow key={i} balance={b} showUsd={showUsd} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {credits.length === 0 && (
              <p className="text-xs text-muted">
                Only XLM is held right now. This wallet can also hold credit assets like{" "}
                <span className="font-mono text-foreground">
                  {USDC_TESTNET.code}
                </span>{" "}
                once a trustline is added from the wallet Overview page.
              </p>
            )}
          </div>

    </WalletPageShell>
  </>
  );
}

function AssetRow({
  balance,
  showUsd,
}: {
  balance: Balance;
  showUsd: boolean;
}) {
  const isNative = balance.asset_type === "native";
  const code = isNative ? "XLM" : balance.asset_code ?? "?";
  const name = isNative ? "Stellar Lumens" : balance.asset_code ?? "Unknown asset";

  return (
    <tr>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <AssetIcon
            isNative={isNative}
            code={balance.asset_code}
            issuer={balance.asset_issuer}
          />
          <div>
            <p className="text-sm text-foreground">{name}</p>
            <p className="text-[11px] text-muted">{code}</p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4 font-medium text-foreground">
        {balance.balance} {code}
        {showUsd && (
          <span className="ml-2 text-[11px] text-muted">(USD n/a on testnet)</span>
        )}
      </td>
      <td className="py-3 pr-4 text-muted">
        {isNative ? "Native" : balance.asset_type.replace("credit_alphanum", "Alphanum")}
      </td>
      <td className="py-3 font-mono text-[11px] text-muted">
        {balance.asset_issuer
          ? `${balance.asset_issuer.slice(0, 6)}…${balance.asset_issuer.slice(-6)}`
          : "—"}
      </td>
    </tr>
  );
}
