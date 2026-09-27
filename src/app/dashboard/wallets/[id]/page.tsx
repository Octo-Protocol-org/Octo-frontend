"use client";

import { use, useCallback, useEffect, useState } from "react";
import { TrustlineModal, DepositModal, WithdrawModal } from "@/components/wallets/WalletModals";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@/lib/useWallet";
import {
  getBalances,
  listAddresses,
  listTransactions,
  createAddress,
  USDC_TESTNET,
  type Balance,
  type Address,
  type Transaction,
} from "@/lib/wallets";
import { parseAmount, formatStroops } from "@/lib/amount";
import {
  spendableNativeStroops,
} from "@/lib/stellar/reserve";
import { usePolling } from "@/lib/usePolling";
import { WalletPageShell } from "@/components/dashboard/WalletPageShell";
import { AssetIcon } from "@/components/dashboard/AssetIcon";
import { TrustlineDetails } from "@/components/trustlines/TrustlineDetails";
import { DownloadBackupButton } from "@/components/backup/DownloadBackupButton";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { PageSpinner } from "@/components/OctoSpinner";
import { EditWalletDetails } from "@/components/wallets/EditWalletDetails";
import { NewAddressModal } from "@/components/addresses/CustomerReferenceField";
import { RelativeTime } from "@/components/RelativeTime";
import { Skeleton, TableRowSkeleton } from "@/components/Skeleton";

export default function WalletOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading } = useAuth();

  const { wallet, update: updateWallet } = useWallet(id);
  const [balances, setBalances] = useState<Balance[]>([]);
  // True until the first successful balances + addresses fetch completes.
  const [statsLoading, setStatsLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [creating, setCreating] = useState(false);
  const [askingRef, setAskingRef] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTrustline, setShowTrustline] = useState(false);

  function refresh() {
    if (!token) return;
    getBalances(token, id).then(setBalances).catch(() => {});
    // The submit-signed endpoint records the outbound transfer server-side before responding,
    // so a plain re-fetch reflects it (no optimistic insert needed).
    listTransactions(token, id).then(setTxns).catch(() => {});
  }

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getBalances(token, id).then(setBalances).catch(() => setBalances([])),
      listAddresses(token, id).then(setAddresses).catch(() => setAddresses([])),
      listTransactions(token, id).then(setTxns).catch(() => setTxns([])),
    ]).finally(() => setStatsLoading(false));
  }, [token, id]);

  // Silently re-fetch balances + recent transactions in the background so a new deposit shows up
  // without a manual refresh — no loading indicator here, that's only for explicit refresh actions.
  const pollFn = useCallback(
    async () => {
      if (!token) return;
      await Promise.all([
        getBalances(token, id).then(setBalances).catch(() => {}),
        listTransactions(token, id).then(setTxns).catch(() => {}),
      ]);
    },
    [token, id],
  );
  usePolling(pollFn, 5000);

  function onNewAddress() {
    setAskingRef(true);
  }

  async function createWithRef(customerRef?: string) {
    if (!token) return;
    setCreating(true);
    try {
      const addr = await createAddress(token, id, customerRef);
      setAddresses((a) => [addr, ...a]);
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  const xlm = balances.find((b) => b.asset_type === "native");
  const xlmAmount = xlm ? xlm.balance : "0";
  const usdcBalance = balances.find(
    (b) => b.asset_code === USDC_TESTNET.code && b.asset_issuer === USDC_TESTNET.issuer,
  );
  const hasUsdc = usdcBalance !== undefined;
  // Spendable XLM is derived client-side; show "—" until balances load to avoid fake zeros.
  const spendableDisplay = statsLoading
    ? "—"
    : `${formatStroops(spendableNativeStroops(
        (() => { const p = parseAmount(xlmAmount); return p.ok ? p.stroops : BigInt(0); })(),
        null,
        balances.filter((b) => b.asset_type !== "native").length,
      ))} XLM`;

  return (
    <>
    {askingRef && <NewAddressModal onSubmit={createWithRef} onClose={() => setAskingRef(false)} />}
    <WalletPageShell
      walletId={id}
      walletName={wallet?.label ?? "Master wallet"}
      section="Overview"
    >
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {/* header */}
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {wallet?.label ?? "Master wallet"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {wallet?.description ?? "Stellar master wallet"}
              </p>
              <EditWalletDetails token={token} walletId={id} wallet={wallet} onSaved={updateWallet} />
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span className="text-muted">
                  Address:{" "}
                  <span className="font-mono text-foreground">
                    {wallet
                      ? `${wallet.address.slice(0, 10)}…${wallet.address.slice(-8)}`
                      : "—"}
                  </span>
                </span>
                <span className="text-muted">
                  ID: <span className="font-mono text-foreground">{id.slice(0, 8)}…</span>
                </span>
              </div>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat
                label="XLM Balance"
                value={statsLoading ? "—" : `${xlmAmount} XLM`}
              />
              <Stat
                label="USDC Balance"
                value={statsLoading ? "—" : usdcBalance ? `${usdcBalance.balance} USDC` : "No trustline"}
              />
              <Stat
                label="Spendable XLM"
                value={spendableDisplay}
                sub="After Stellar minimum reserve"
              />
              <Stat
                label="Generated Addresses"
                value={statsLoading ? "—" : String(addresses.length)}
              />
            </div>

            {/* action row */}
            <div className="flex flex-wrap gap-3">
              <ActionButton label="New address" onClick={onNewAddress} loading={creating} />
              <ActionButton label="Deposit" onClick={() => setShowDeposit(true)} />
              <ActionButton label="Withdraw" onClick={() => setShowWithdraw(true)} />
              <ActionButton
                label={hasUsdc ? "USDC trusted ✓" : "Add USDC trustline"}
                onClick={() => setShowTrustline(true)}
                disabled={hasUsdc}
              />
              <ActionButton
                label="Refresh balances"
                onClick={() => token && getBalances(token, id).then(setBalances)}
              />
            </div>

            {token && <TrustlineDetails token={token} walletId={id} balances={balances} onChanged={refresh} />}
            {token && <DownloadBackupButton token={token} walletId={id} address={wallet?.address ?? null} />}

            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              {/* assets */}
              <Panel title="Assets">
                {statsLoading ? (
                  <ul className="divide-y divide-divider">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <li key={i} className="flex items-center justify-between py-3">
                        <span className="flex items-center gap-3">
                          <Skeleton width="2rem" height="2rem" className="rounded-full" />
                          <Skeleton width="8rem" height="1rem" />
                        </span>
                        <Skeleton width="6rem" height="1rem" />
                      </li>
                    ))}
                  </ul>
                ) : balances.length === 0 ? (
                  <Empty>No assets yet.</Empty>
                ) : (
                  <ul className="divide-y divide-divider">
                    {balances.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between py-3"
                      >
                        <span className="flex items-center gap-3">
                          <AssetIcon
                            isNative={b.asset_type === "native"}
                            code={b.asset_code}
                            issuer={b.asset_issuer}
                          />
                          <span className="text-sm text-foreground">
                            {b.asset_type === "native" ? "Stellar Lumens" : b.asset_code}
                          </span>
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {b.balance}{" "}
                          {b.asset_type === "native" ? "XLM" : b.asset_code}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {/* addresses */}
              <Panel title="Addresses">
                {statsLoading ? (
                  <ul className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <li key={i}>
                        <Skeleton width="80%" height="0.875rem" className="mb-1" />
                        <Skeleton width="60%" height="0.75rem" />
                      </li>
                    ))}
                  </ul>
                ) : addresses.length === 0 ? (
                  <Empty>No addresses generated yet.</Empty>
                ) : (
                  <ul className="space-y-3">
                    {addresses.slice(0, 5).map((a) => (
                      <li key={a.id}>
                        <p className="font-mono text-xs text-burgundy-bright">
                          {a.muxed_address.slice(0, 8)}…{a.muxed_address.slice(-6)}
                        </p>
                        <p className="text-[11px] text-muted">
                          memo id {a.memo_id}
                          {a.customer_ref ? ` · ${a.customer_ref}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-right text-xs text-muted">
                  Showing last {Math.min(addresses.length, 5)} generated
                </p>
              </Panel>
            </div>

            {/* recent transactions */}
            <Panel title="Most recent transactions">
              {statsLoading ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Recent transactions for this wallet</caption>
                    <thead className="text-xs text-muted">
                      <tr>
                        <th scope="col" className="py-2">ID</th>
                        <th scope="col" className="py-2">Amount</th>
                        <th scope="col" className="py-2">Hash</th>
                        <th scope="col" className="py-2">Type</th>
                        <th scope="col" className="py-2">Status</th>
                        <th scope="col" className="py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <TableRowSkeleton key={i} cols={6} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : txns.length === 0 ? (
                <Empty>No transactions yet.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Recent transactions for this wallet</caption>
                    <thead className="text-xs text-muted">
                      <tr>
                        <th scope="col" className="py-2">ID</th>
                        <th scope="col" className="py-2">Amount</th>
                        <th scope="col" className="py-2">Hash</th>
                        <th scope="col" className="py-2">Type</th>
                        <th scope="col" className="py-2">Status</th>
                        <th scope="col" className="py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {txns.map((t) => (
                        <tr key={t.id} className="text-foreground/90">
                          <td className="py-3 font-mono text-xs">
                            {t.id.slice(0, 8)}…
                          </td>
                          <td className="py-3">
                            {formatStroops(t.amount_stroops)}{" "}
                            {t.asset_code === "native" ? "XLM" : t.asset_code}
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {t.stellar_tx_hash ? (
                              <a
                                href={`https://stellar.expert/explorer/testnet/tx/${t.stellar_tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View transaction on Stellar Explorer"
                                className="text-burgundy-bright underline decoration-burgundy-bright/40 underline-offset-2 transition-colors hover:decoration-burgundy-bright"
                              >
                                {`${t.stellar_tx_hash.slice(0, 8)}…`}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3">
                            <span className="rounded-md bg-hover px-2 py-0.5 text-xs capitalize">
                              {t.direction}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-xs text-burgundy-bright capitalize">
                              ● {t.status}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-muted">
                            <RelativeTime date={t.created_at} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

    </WalletPageShell>

      {showDeposit && (
        <DepositModal
          addresses={addresses}
          baseAddress={wallet?.address ?? ""}
          onClose={() => setShowDeposit(false)}
          onNewAddress={onNewAddress}
          creating={creating}
        />
      )}
      {showWithdraw && token && (
        <WithdrawModal
          token={token}
          walletId={id}
          walletAddress={wallet?.address}
          balances={balances}
          onClose={() => setShowWithdraw(false)}
          onDone={() => {
            setShowWithdraw(false);
            refresh();
          }}
        />
      )}
      {showTrustline && token && (
        <TrustlineModal
          token={token}
          walletId={id}
          onClose={() => setShowTrustline(false)}
          onDone={() => {
            setShowTrustline(false);
            refresh();
          }}
        />
      )}
  </>
  );
}
