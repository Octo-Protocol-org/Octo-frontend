"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { StrKey } from "@stellar/stellar-base";
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
import { DashboardBackground } from "@/components/dashboard/DashboardBackground";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { Modal } from "@/components/dashboard/Modal";
import { PageSpinner } from "@/components/OctoSpinner";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — matches the other
// /dashboard/wallets/:id/* pages, which all read wallet-scoped data.
export const dynamic = "force-dynamic";

// Accepts only well-formed Stellar account (G…) or muxed account (M…) addresses.
function isValidStellarAddress(value: string): boolean {
  return (
    StrKey.isValidEd25519PublicKey(value) ||
    StrKey.isValidMed25519PublicKey(value)
  );
}

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
  const [confirmDisable, setConfirmDisable] = useState(false);

  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [addrError, setAddrError] = useState<string | null>(null);
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

  async function applyToggle(next: boolean) {
    if (!token) return;
    setError(null);
    setToggling(true);
    try {
      const res = await setWhitelistEnabled(token, id, next);
      setEnabled(res.enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the allowlist.");
    } finally {
      setToggling(false);
    }
  }

  function validateAddr(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return "Enter a Stellar address.";
    if (!isValidStellarAddress(trimmed)) {
      return "That is not a valid Stellar address (expected a G… or M… account).";
    }
    if (wallet && trimmed === wallet.address) {
      return "This is the wallet's own address — sending to yourself is not allowed.";
    }
    return null;
  function handleToggle() {
    if (!token) return;
    // Disabling is an anti-fraud control change — require a deliberate second step.
    if (enabled) {
      setConfirmDisable(true);
      return;
    }
    // Enabling with no entries would block every withdrawal — warn instead of silently arming it.
    if (entries.length === 0) {
      setError(
        "Add at least one address before enabling the allowlist — enabling it empty blocks every withdrawal."
      );
      return;
    }
    void applyToggle(true);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const trimmed = addr.trim();
    const validationError = validateAddr(trimmed);
    if (validationError) {
      setAddrError(validationError);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const entry = await addWhitelistedAddress(token, id, trimmed, label.trim());
      setEntries((prev) => [entry, ...prev]);
      setAddr("");
      setLabel("");
      setAddrError(null);
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
          <header className="flex items-center justify-between border-b border-border px-8 py-4">
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
              <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <Panel title="Add an address">
              <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[280px] flex-1">
                  <label className="text-xs text-muted">Address (G… or M…)</label>
                  <input
                    value={addr}
                    onChange={(e) => {
                      setAddr(e.target.value);
                      if (addrError) setAddrError(null);
                    }}
                    onBlur={() => setAddrError(validateAddr(addr))}
                    placeholder="GABC... or MABC..."
                    className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-burgundy/50"
                  />
                  {addrError && (
                    <p className="mt-1 text-xs text-danger">{addrError}</p>
                  )}
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs text-muted">Label (optional)</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Treasury"
                    className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50"
                  />
                </div>
                <ActionButton
                  label={adding ? "Adding…" : "Add address"}
                  type="submit"
                  loading={adding}
                  disabled={!addr.trim()}
                />
              </form>
            </Panel>

            <Panel title="Whitelisted addresses">
              {entries.length === 0 ? (
                <Empty
                  title="No addresses yet"
                  body="Add at least one destination before enabling the allowlist."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-foreground">
                          {entry.address}
                        </p>
                        {entry.label && (
                          <p className="text-xs text-muted">{entry.label}</p>
                        )}
                      </div>
                      <ActionButton
                        label={removingId === entry.id ? "Removing…" : "Remove"}
                        onClick={() => handleRemove(entry.id)}
                        loading={removingId === entry.id}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          </main>
        </div>
      </div>

      <Modal
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        title="Disable the withdrawal allowlist?"
      >
        <p className="text-sm text-muted">
          The allowlist is an anti-fraud control. Disabling it lets outbound payments
          reach <strong className="text-foreground">any</strong> destination, including
          ones you have not reviewed. Only continue if you intend to allow all
          withdrawals from this wallet.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <ActionButton
            label="Keep it enabled"
            onClick={() => setConfirmDisable(false)}
          />
          <ActionButton
            label={toggling ? "Disabling…" : "Disable allowlist"}
            loading={toggling}
            onClick={() => {
              setConfirmDisable(false);
              void applyToggle(false);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
