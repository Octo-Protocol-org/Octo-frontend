"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import {
  getWallet,
  listTransactions,
  stroopsToAmount,
  displayAssetCode,
  type WalletView,
  type Transaction,
} from "@/lib/wallets";
import { WalletSidebar } from "@/components/dashboard/WalletSidebar";
import { Modal, CopyField } from "@/components/dashboard/Modal";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { PageSpinner } from "@/components/OctoSpinner";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — matches the other
// /dashboard/wallets/:id/* pages, which all read wallet-scoped data.
export const dynamic = "force-dynamic";

export default function TransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading, logout } = useAuth();

  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Transaction | null>(null);

  function refresh() {
    if (!token) return;
    setRefreshing(true);
    listTransactions(token, id)
      .then(setTxns)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!token) return;
    getWallet(token, id).then(setWallet).catch(() => setWallet(null));
    listTransactions(token, id).then(setTxns).catch(() => setTxns([]));
  }, [token, id]);

  // Silently re-fetch in the background so a deposit (e.g. from a payment link) shows up without
  // needing a manual refresh — no loading indicator here, only the explicit Refresh button shows one.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      listTransactions(token, id)
        .then(setTxns)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [token, id]);

  // Tabs are per-asset (not per-status or per-op-type, which don't exist on Stellar the way
  // they do on an EVM chain): "All" plus one tab per distinct asset code this wallet has ever
  // moved, so a wallet holding several trustlined assets can isolate one asset's history.
  const assetTabs = useMemo(() => {
    const codes = new Set(txns.map((t) => t.asset_code));
    return ["all", ...Array.from(codes).sort()];
  }, [txns]);

  const filtered =
    assetFilter === "all" ? txns : txns.filter((t) => t.asset_code === assetFilter);

  const totalDeposits = txns.filter((t) => t.direction === "deposit").length;
  const totalWithdrawals = txns.filter((t) => t.direction === "withdrawal").length;
  const failedCount = txns.filter((t) => t.status === "failed").length;

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-burgundy/20 py-2 text-center text-xs text-burgundy-bright">
        You are currently on <strong>test mode</strong> (Stellar testnet).
      </div>
      <div className="flex flex-1">
        <WalletSidebar
          walletId={id}
          walletName={wallet?.label ?? "Master wallet"}
        />

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-8 py-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Link href="/dashboard" className="hover:text-foreground">
                My Wallets
              </Link>
              <span>›</span>
              <Link href={`/dashboard/wallets/${id}`} className="hover:text-foreground">
                {wallet?.label ?? "Master wallet"}
              </Link>
              <span>›</span>
              <span className="text-foreground">Transactions</span>
            </div>
            <button onClick={logout} className="text-sm text-muted hover:text-foreground">
              ⏻
            </button>
          </header>

          <main className="flex-1 px-8 py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
              <p className="mt-1 text-sm text-muted">
                Deposits and outbound transfers recorded for this wallet.
              </p>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Total transactions" value={String(txns.length)} />
              <Stat label="Deposits" value={String(totalDeposits)} />
              <Stat label="Withdrawals" value={String(totalWithdrawals)} />
              <Stat
                label="Failed"
                value={String(failedCount)}
                sub={failedCount > 0 ? "Rejected on-chain" : undefined}
              />
            </div>

            <div className="flex items-center justify-between">
              {/* asset filter tabs */}
              <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                {assetTabs.map((code) => (
                  <button
                    key={code}
                    onClick={() => setAssetFilter(code)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      assetFilter === code
                        ? "bg-burgundy/30 text-burgundy-bright"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {code === "all" ? "All assets" : displayAssetCode(code)}
                  </button>
                ))}
              </div>
              <ActionButton
                label={refreshing ? "Refreshing…" : "Refresh"}
                onClick={refresh}
                loading={refreshing}
              />
            </div>

            <Panel title={`${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`}>
              {filtered.length === 0 ? (
                <Empty>
                  {txns.length === 0
                    ? "No transactions yet. Deposits appear automatically once funds arrive."
                    : "No transactions match this filter."}
                </Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="pb-3 pr-4 font-medium">Type</th>
                        <th className="pb-3 pr-4 font-medium">Amount</th>
                        <th className="pb-3 pr-4 font-medium">Counterparty</th>
                        <th className="pb-3 pr-4 font-medium">Status</th>
                        <th className="pb-3 pr-4 font-medium">Tx hash</th>
                        <th className="pb-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filtered.map((t) => (
                        <TxRow key={t.id} tx={t} onSelect={() => setSelected(t)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
          </main>
        </div>
      </div>

      {selected && (
        <TransactionDetail tx={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TxRow({
  tx,
  onSelect,
}: {
  tx: Transaction;
  onSelect: () => void;
}) {
  const isDeposit = tx.direction === "deposit";
  const counterparty = isDeposit ? tx.source_account : tx.destination_account;

  return (
    <tr
      onClick={onSelect}
      className="cursor-pointer transition-colors hover:bg-white/[0.02]"
    >
      <td className="py-3 pr-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
            isDeposit
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-burgundy/20 text-burgundy-bright"
          }`}
        >
          {isDeposit ? "↓ Deposit" : "↑ Withdrawal"}
        </span>
      </td>
      <td className="py-3 pr-4 font-medium text-foreground">
        {isDeposit ? "+" : "-"}
        {stroopsToAmount(tx.amount_stroops)} {displayAssetCode(tx.asset_code)}
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-muted">
        {counterparty ? `${counterparty.slice(0, 6)}…${counterparty.slice(-6)}` : "—"}
      </td>
      <td className="py-3 pr-4">
        <StatusBadge status={tx.status} />
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-burgundy-bright">
        {tx.stellar_tx_hash
          ? `${tx.stellar_tx_hash.slice(0, 8)}…${tx.stellar_tx_hash.slice(-6)}`
          : "—"}
      </td>
      <td className="py-3 text-muted">
        {new Date(tx.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "confirmed";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        ok ? "text-emerald-400" : "text-amber-400"
      }`}
    >
      {ok ? "✓" : "!"} <span className="capitalize">{status}</span>
    </span>
  );
}

function TransactionDetail({
  tx,
  onClose,
}: {
  tx: Transaction;
  onClose: () => void;
}) {
  const isDeposit = tx.direction === "deposit";
  return (
    <Modal title="Transaction details" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
              isDeposit
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-burgundy/20 text-burgundy-bright"
            }`}
          >
            {isDeposit ? "↓ Deposit" : "↑ Withdrawal"}
          </span>
          <StatusBadge status={tx.status} />
        </div>

        <div className="rounded-lg bg-black/30 p-3 text-center">
          <p className="text-xs text-muted">Amount</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {isDeposit ? "+" : "-"}
            {stroopsToAmount(tx.amount_stroops)} {displayAssetCode(tx.asset_code)}
          </p>
        </div>

        {tx.asset_issuer && <CopyField label="Asset issuer" value={tx.asset_issuer} />}
        {tx.source_account && <CopyField label="Source account" value={tx.source_account} />}
        {tx.destination_account && (
          <CopyField label="Destination account" value={tx.destination_account} />
        )}
        {tx.stellar_tx_hash && (
          <CopyField label="Stellar transaction hash" value={tx.stellar_tx_hash} />
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-muted">Ledger</p>
            <p className="mt-1 font-mono text-foreground">{tx.ledger ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-muted">Memo ID</p>
            <p className="mt-1 font-mono text-foreground">{tx.memo_id ?? "—"}</p>
          </div>
        </div>

        {tx.stellar_tx_hash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${tx.stellar_tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-burgundy-bright underline decoration-burgundy-bright/40 underline-offset-2 transition-colors hover:decoration-burgundy-bright"
          >
            View on Stellar Explorer ↗
          </a>
        )}

        <p className="text-center text-[11px] text-muted">
          {new Date(tx.created_at).toLocaleString()}
        </p>
      </div>
    </Modal>
  );
}
