"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import {
  getWallet,
  listAddresses,
  createAddress,
  stroopsToAmount,
  type WalletView,
  type Address,
} from "@/lib/wallets";
import { WalletSidebar } from "@/components/dashboard/WalletSidebar";
import { DashboardBackground } from "@/components/dashboard/DashboardBackground";
import { Modal, CopyField } from "@/components/dashboard/Modal";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { PageSpinner } from "@/components/OctoSpinner";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — matches the other
// /dashboard/wallets/:id/* pages, which all read wallet-scoped data.
export const dynamic = "force-dynamic";

export default function AddressesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading, logout } = useAuth();

  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    if (!token) return;
    setRefreshing(true);
    listAddresses(token, id)
      .then((a) => {
        setAddresses(a);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load addresses."),
      )
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!token) return;
    getWallet(token, id).then(setWallet).catch(() => setWallet(null));
    listAddresses(token, id)
      .then((a) => {
        setAddresses(a);
        setError(null);
      })
      .catch((e) => {
        setAddresses([]);
        setError(e instanceof Error ? e.message : "Could not load addresses.");
      });
  }, [token, id]);

  async function handleNewAddress() {
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const addr = await createAddress(token, id);
      setAddresses((prev) => [addr, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a new address.");
    } finally {
      setCreating(false);
    }
  }

  const totalReceived = addresses.reduce((sum, a) => sum + a.received_stroops, 0);

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <DashboardBackground />

      <div className="relative z-10 bg-burgundy/20 py-2 text-center text-xs text-burgundy-bright">
        You are currently on <strong>test mode</strong> (Stellar testnet).
      </div>
      <div className="relative z-10 flex flex-1">
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
              <span className="text-foreground">Addresses</span>
            </div>
            <button onClick={logout} className="text-sm text-muted hover:text-foreground">
              ⏻
            </button>
          </header>

          <main className="flex-1 px-8 py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Addresses</h1>
              <p className="mt-1 text-sm text-muted">
                Deposit addresses for attributing incoming payments to your customers. Every
                address funnels into this wallet&apos;s single master account — there is nothing
                to sweep.
              </p>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Total addresses" value={String(addresses.length)} />
              <Stat
                label="Total received"
                value={`${stroopsToAmount(totalReceived)} XLM`}
                sub="Across all addresses"
              />
              <Stat
                label="Address type"
                value="Muxed (M…)"
                sub="G… + memo fallback included"
              />
              <Stat label="Sweeping required" value="No" sub="Funds land in one account" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <ActionButton
                  label={creating ? "Generating…" : "+ New address"}
                  onClick={handleNewAddress}
                  loading={creating}
                />
                <ActionButton
                  label={refreshing ? "Refreshing…" : "Refresh"}
                  onClick={refresh}
                  loading={refreshing}
                />
              </div>
              <Link
                href={`/dashboard/wallets/${id}/whitelist`}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-foreground transition-colors hover:border-burgundy/50"
              >
                🛡 Withdrawal allowlist
              </Link>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <Panel title={`${addresses.length} address${addresses.length === 1 ? "" : "es"}`}>
              {addresses.length === 0 ? (
                <Empty>
                  No addresses yet. Generate one to start attributing deposits to a customer.
                </Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="pb-3 pr-4 font-medium">Customer ref</th>
                        <th className="pb-3 pr-4 font-medium">Muxed address</th>
                        <th className="pb-3 pr-4 font-medium">Memo ID</th>
                        <th className="pb-3 font-medium">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {addresses.map((a) => (
                        <AddressRow key={a.id} address={a} onSelect={() => setSelected(a)} />
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
        <AddressDetail address={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function AddressRow({
  address,
  onSelect,
}: {
  address: Address;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className="cursor-pointer transition-colors hover:bg-white/[0.02]"
    >
      <td className="py-3 pr-4 text-foreground">
        {address.customer_ref ?? <span className="text-muted">—</span>}
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-burgundy-bright">
        {address.muxed_address.slice(0, 10)}…{address.muxed_address.slice(-8)}
      </td>
      <td className="py-3 pr-4 font-mono text-muted">{address.memo_id}</td>
      <td className="py-3 font-medium text-foreground">
        {address.received_stroops > 0
          ? `${stroopsToAmount(address.received_stroops)} XLM`
          : "$0"}
      </td>
    </tr>
  );
}

function AddressDetail({
  address,
  onClose,
}: {
  address: Address;
  onClose: () => void;
}) {
  return (
    <Modal title="Address details" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-black/30 p-3 text-center">
          <p className="text-xs text-muted">Total received</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {stroopsToAmount(address.received_stroops)} XLM
          </p>
        </div>

        <CopyField label="Muxed address (M…) — default" value={address.muxed_address} />
        <CopyField label="Base address (G…) — fallback" value={address.base_address} />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-muted">Memo ID (fallback)</p>
            <p className="mt-1 font-mono text-foreground">{address.memo_id}</p>
          </div>
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-muted">Customer ref</p>
            <p className="mt-1 font-mono text-foreground">
              {address.customer_ref ?? "—"}
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted">
          Senders who can&apos;t attach a muxed address should send to the base address with
          memo ID <span className="font-mono text-foreground">{address.memo_id}</span> instead.
        </p>
      </div>
    </Modal>
  );
}
