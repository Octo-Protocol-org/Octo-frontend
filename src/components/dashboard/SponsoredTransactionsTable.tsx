"use client";

import { errorMessage } from "@/lib/api";
import { useEffect, useState } from "react";
import {
  listSponsoredTransactions,
  type SponsoredTransaction,
} from "@/lib/sponsorship";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { formatStroops, sumStroops } from "@/lib/amount";
import { explorerTxUrl } from "@/lib/network";
import { CopyButton } from "@/components/CopyButton";
import { RelativeTime } from "@/components/RelativeTime";

const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-success-bg text-success",
  failed: "bg-danger-bg text-danger",
  pending: "bg-warning-bg text-warning",
};

export function SponsoredTransactionsTable({
  walletId,
  token,
}: {
  walletId: string;
  token: string;
}) {
  const [rows, setRows] = useState<SponsoredTransaction[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    listSponsoredTransactions(asAuthToken(token), asWalletId(walletId))
      .then((page) => {
        if (!active) return;
        setRows(page.data);
        setCursor(page.next_cursor);
      })
      .catch((e) => {
        if (!active) return;
        setRows([]);
        setLoadError(errorMessage(e, "Could not load sponsored transactions."));
      });
    return () => {
      active = false;
    };
  }, [walletId, token, attempt]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listSponsoredTransactions(asAuthToken(token), asWalletId(walletId), { before: cursor });
      // Append — never replace the existing rows.
      setRows((prev) => [...(prev ?? []), ...page.data]);
      setCursor(page.next_cursor);
    } catch (e) {
      // Keep the existing rows and surface the failure so the user can retry.
      setMoreError(errorMessage(e, "Could not load more transactions."));
    } finally {
      setLoadingMore(false);
    }
  }

  // Summary: count + total fees for the current calendar month (from loaded rows only).
  const now = new Date();
  const monthRows = (rows ?? []).filter((r) => {
    const d = new Date(r.created_at);
    return (
      d.getUTCFullYear() === now.getUTCFullYear() &&
      d.getUTCMonth() === now.getUTCMonth()
    );
  });
  const monthFeeStroops = sumStroops(monthRows.map((r) => r.fee_stroops));

  return (
    <section className="rounded-2xl border border-border bg-burgundy-soft/30 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Sponsored transactions
        </h2>
        <p className="text-xs text-muted">
          {monthRows.length}{" "}
          {monthRows.length === 1 ? "transaction" : "transactions"} sponsored ·{" "}
          {formatStroops(monthFeeStroops)} XLM total fees this month in loaded rows
          {cursor ? " (more available)" : ""}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Sponsored transactions for this wallet
          </caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="py-2 pr-4">Date</th>
              <th scope="col" className="py-2 pr-4">Inner Tx Hash</th>
              <th scope="col" className="py-2 pr-4">Fee Bump Tx Hash</th>
              <th scope="col" className="py-2 pr-4">Fee</th>
              <th scope="col" className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {rows === null ? (
              <EmptyRow>Loading…</EmptyRow>
            ) : loadError ? (
              <EmptyRow>
                <span role="alert" className="text-danger">{loadError}</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRows(null);
                    setAttempt((n) => n + 1);
                  }}
                  className="ml-2 rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:border-burgundy/50"
                >
                  Retry
                </button>
              </EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow>
                No sponsored transactions yet. Use the{" "}
                <code className="text-foreground">/sponsor</code> endpoint in
                your integration to get started.
              </EmptyRow>
            ) : (
              rows.map((tx) => (
                <tr key={tx.id} className="text-foreground/90">
                  <td className="py-3 pr-4 text-xs text-muted whitespace-nowrap">
                    <RelativeTime date={tx.created_at} />
                  </td>
                  <td className="py-3 pr-4">
                    <HashCell hash={tx.inner_tx_hash} />
                  </td>
                  <td className="py-3 pr-4">
                    <HashCell hash={tx.fee_bump_tx_hash} />
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatStroops(tx.fee_stroops)} XLM
                  </td>
                  <td className="py-3">
                    <StatusBadge status={tx.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <div className="mt-4 text-center">
          {moreError && (
            <p role="alert" className="mb-2 text-xs text-danger">{moreError}</p>
          )}
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-foreground transition-colors hover:border-burgundy/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : moreError ? "Retry" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}

function HashCell({ hash }: { hash: string | null }) {
  if (!hash) return <span className="text-muted">—</span>;

  return (
    <span className="flex items-center gap-2">
      <a
        href={explorerTxUrl(hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-foreground hover:underline"
      >
        {`${hash.slice(0, 6)}…${hash.slice(-6)}`}
      </a>
      {/* Always copies the full hash, not the truncated display value. */}
      <CopyButton value={hash} label="Copy full hash" />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-hover text-muted";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {status}
    </span>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={5} className="py-10 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}
