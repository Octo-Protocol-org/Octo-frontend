"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import {
  getWallet,
  getWhitelistConfig,
  setWhitelistEnabled,
  listWhitelistedAddresses,
  addWhitelistedAddress,
  removeWhitelistedAddress,
  type WalletView,
  type WhitelistedAddress,
} from "@/lib/wallets";
import { WalletSidebar } from "@/components/dashboard/WalletSidebar";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { PageSpinner } from "@/components/OctoSpinner";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — matches the other
// /dashboard/wallets/:id/* pages, which all read wallet-scoped data.
export const dynamic = "force-dynamic";

export default function WhitelistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading, logout } = useAuth();

  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<WhitelistedAddress[]>([]);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getWallet(token, id).then(setWallet).catch(() => setWallet(null));
    getWhitelistConfig(token, id)
      .then((c) => setEnabled(c.enabled))
      .catch(() => {});
    listWhitelistedAddresses(token, id)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [token, id]);

  async function handleToggle() {
    if (!token) return;
    setError(null);
    setToggling(true);
    try {
      const next = !enabled;
      const res = await setWhitelistEnabled(token, id, next);
      setEnabled(res.enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the allowlist.");
    } finally {
      setToggling(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!token || !addr.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const entry = await addWhitelistedAddress(token, id, addr.trim(), label.trim());
      setEntries((prev) => [entry, ...prev]);
      setAddr("");
      setLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that address.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(entryId: string) {
    if (!token) return;
    setRemovingId(entryId);
    setError(null);
    try {
      await removeWhitelistedAddress(token, id, entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that address.");
    } finally {
      setRemovingId(null);
    }
  }

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
              <Link href={`/dashboard/wallets/${id}/addresses`} className="hover:text-foreground">
                Addresses
              </Link>
              <span>›</span>
              <span className="text-foreground">Withdrawal allowlist</span>
            </div>
            <button onClick={logout} className="text-sm text-muted hover:text-foreground">
              ⏻
            </button>
          </header>

          <main className="flex-1 px-8 py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Withdrawal allowlist</h1>
              <p className="mt-1 text-sm text-muted">
                When enabled, outbound payments from this wallet are rejected unless the
                destination is on this list. Checked before anything reaches the network.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Status" value={enabled ? "Enabled" : "Disabled"} />
              <Stat label="Whitelisted addresses" value={String(entries.length)} />
              <Stat label="Enforcement point" value="submit-signed" sub="Before Horizon" />
              <Stat label="Management auth" value="Dashboard login only" sub="Not API keys" />
            </div>

            <Panel
              title="Enforcement"
              action={
                <ActionButton
                  label={
                    toggling
                      ? "Updating…"
                      : enabled
                        ? "Disable allowlist"
                        : "Enable allowlist"
                  }
                  onClick={handleToggle}
                  loading={toggling}
                  disabled={!enabled && entries.length === 0}
                />
              }
            >
              <p className="text-sm text-muted">
                {enabled
                  ? "Enabled — payments to destinations not listed below will be rejected with a 403."
                  : entries.length === 0
                    ? "Disabled. Add at least one address below before you can enable enforcement."
                    : "Disabled — all destinations are currently allowed. Enable once your list is ready."}
              </p>
            </Panel>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <Panel title="Add an address">
              <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[280px] flex-1">
                  <label className="text-xs text-muted">Address (G… or M…)</label>
                  <input
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    placeholder="GABC... or MABC..."
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-burgundy/50"
                  />
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs text-muted">Label (optional)</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Treasury"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50"
                  />
                </div>
                <ActionButton
                  label={adding ? "Adding…" : "+ Add"}
                  disabled={!addr.trim() || adding}
                  loading={adding}
                />
              </form>
            </Panel>

            <Panel title={`${entries.length} whitelisted address${entries.length === 1 ? "" : "es"}`}>
              {entries.length === 0 ? (
                <Empty>No addresses whitelisted yet.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="pb-3 pr-4 font-medium">Address</th>
                        <th className="pb-3 pr-4 font-medium">Label</th>
                        <th className="pb-3 pr-4 font-medium">Added</th>
                        <th className="pb-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {entries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-3 pr-4 font-mono text-xs text-burgundy-bright">
                            {entry.address.slice(0, 10)}…{entry.address.slice(-8)}
                          </td>
                          <td className="py-3 pr-4 text-foreground">
                            {entry.label ?? <span className="text-muted">—</span>}
                          </td>
                          <td className="py-3 pr-4 text-muted">
                            {new Date(entry.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleRemove(entry.id)}
                              disabled={removingId === entry.id}
                              className="text-xs text-muted hover:text-red-400 disabled:opacity-40"
                            >
                              {removingId === entry.id ? "Removing…" : "Remove"}
                            </button>
                          </td>
                        </tr>
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
    </div>
  );
}
