"use client";

import { errorMessage } from "@/lib/api";
import { use, useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@/lib/useWallet";
import { validateStellarAddress } from "@/lib/stellar/address";
import {
  getWhitelistConfig,
  setWhitelistEnabled,
  listWhitelistedAddresses,
  addWhitelistedAddress,
  removeWhitelistedAddress,
  type WhitelistedAddress,
} from "@/lib/wallets";
import {
  Stat,
  ActionButton,
  Panel,
  Empty,
  ErrorState,
} from "@/components/dashboard/WalletUI";
import { Modal } from "@/components/dashboard/Modal";
import { PageSpinner } from "@/components/OctoSpinner";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — matches the other
// /dashboard/wallets/:id/* pages, which all read wallet-scoped data.
import { WalletPageShell } from "@/components/dashboard/WalletPageShell";
export const dynamic = "force-dynamic";

type AllowlistLoadState = "loading" | "loaded" | "error";

export default function WhitelistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading } = useAuth();

  const { wallet } = useWallet(id);
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<WhitelistedAddress[]>([]);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<WhitelistedAddress | null>(null);
  const [allowlistLoadState, setAllowlistLoadState] =
    useState<AllowlistLoadState>("loading");
  const [allowlistLoadError, setAllowlistLoadError] = useState<string | null>(null);

  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [addrError, setAddrError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadAllowlist = useCallback(async () => {
    if (!token) return;
    setAllowlistLoadState("loading");
    setAllowlistLoadError(null);
    setEnabled(false);
    setEntries([]);
    try {
      const [config, addresses] = await Promise.all([
        getWhitelistConfig(token, id),
        listWhitelistedAddresses(token, id),
      ]);
      setEnabled(config.enabled);
      setEntries(addresses);
      setAllowlistLoadState("loaded");
    } catch (e) {
      setAllowlistLoadState("error");
      setAllowlistLoadError(
        errorMessage(e, "Could not load the withdrawal allowlist."),
      );
    }
  }, [token, id]);

  useEffect(() => {
    void loadAllowlist();
  }, [loadAllowlist]);

  const allowlistLoaded = allowlistLoadState === "loaded";
  // Controls stay disabled until the real allowlist state has loaded, so a default never gets saved.
  const controlsDisabled = !allowlistLoaded;

  async function applyToggle(next: boolean) {
    if (!token || controlsDisabled) return;
    setError(null);
    setToggling(true);
    try {
      const res = await setWhitelistEnabled(token, id, next);
      setEnabled(res.enabled);
      toast.success(
        next ? "Withdrawal allowlist enabled." : "Withdrawal allowlist disabled.",
      );
    } catch (e) {
      setError(errorMessage(e, "Could not update the allowlist."));
    } finally {
      setToggling(false);
    }
  }

  function validateAddr(value: string): string | null {
    return validateStellarAddress(value, { ownAddress: wallet?.address });
  }

  function handleToggle() {
    if (!token || controlsDisabled) return;
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
    if (!token || controlsDisabled) return;
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
      toast.success("Address added to the withdrawal allowlist.");
    } catch (e) {
      setError(errorMessage(e, "Could not add that address."));
    } finally {
      setAdding(false);
    }
  }

  function requestRemove(entry: WhitelistedAddress) {
    if (!token || controlsDisabled) return;
    setPendingRemoval(entry);
  }

  async function handleRemove(entryId: string) {
    if (!token || controlsDisabled) return;
    setRemovingId(entryId);
    setError(null);
    try {
      await removeWhitelistedAddress(token, id, entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      setPendingRemoval(null);
      toast.success("Address removed from the withdrawal allowlist.");
    } catch (e) {
      setError(errorMessage(e, "Could not remove that address."));
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
    <>
    <WalletPageShell
      walletId={id}
      walletName={wallet?.label ?? "Master wallet"}
      section="Withdrawal allowlist"
    >

          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Withdrawal allowlist</h1>
              <p className="mt-1 text-sm text-muted">
                When enabled, outbound payments from this wallet are rejected unless the
                destination is on this list. Checked before anything reaches the network.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat
                label="Status"
                value={allowlistLoaded ? (enabled ? "Enabled" : "Disabled") : "Unavailable"}
              />
              <Stat
                label="Whitelisted addresses"
                value={allowlistLoaded ? String(entries.length) : "Unavailable"}
              />
              <Stat
                label="Enforcement point"
                value={allowlistLoaded ? "submit-signed" : "Unavailable"}
                sub={allowlistLoaded ? "Before Horizon" : undefined}
              />
              <Stat
                label="Management auth"
                value={allowlistLoaded ? "Dashboard login only" : "Unavailable"}
                sub={allowlistLoaded ? "Not API keys" : undefined}
              />
            </div>

            {allowlistLoadState === "error" && (
              <ErrorState
                message={allowlistLoadError ?? "Could not load the withdrawal allowlist."}
                onRetry={() => void loadAllowlist()}
              />
            )}

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
                  disabled={controlsDisabled || (!enabled && entries.length === 0)}
                />
              }
            >
              <p className="text-sm text-muted">
                {!allowlistLoaded
                  ? "Allowlist status is unavailable until it loads successfully."
                  : enabled
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
                    disabled={controlsDisabled || adding}
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
                    disabled={controlsDisabled || adding}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Treasury"
                    className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50"
                  />
                </div>
                <ActionButton
                  label={adding ? "Adding…" : "Add address"}
                  type="submit"
                  loading={adding}
                  disabled={controlsDisabled || adding || !addr.trim()}
                />
              </form>
            </Panel>

            <Panel title="Whitelisted addresses">
              {!allowlistLoaded ? (
                <Empty>Allowlist entries are unavailable until loading succeeds.</Empty>
              ) : entries.length === 0 ? (
                <Empty>Add at least one destination before enabling the allowlist.</Empty>
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
                        onClick={() => requestRemove(entry)}
                        loading={removingId === entry.id}
                        disabled={controlsDisabled}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

    </WalletPageShell>

      {confirmDisable && (
        <Modal
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
              disabled={controlsDisabled}
              onClick={() => {
                setConfirmDisable(false);
                void applyToggle(false);
              }}
            />
          </div>
        </Modal>
      )}

      {pendingRemoval && (
        <Modal
          onClose={() => setPendingRemoval(null)}
          title="Remove this allowlist address?"
        >
          <p className="text-sm text-muted">
            Removing <span className="font-mono text-foreground">{pendingRemoval.address}</span>{" "}
            means future withdrawals to this destination will no longer be approved by the
            allowlist.
          </p>
          {enabled && (
            <p className="mt-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
              Enforcement is enabled: removing this address will immediately block withdrawals
              to it until it is added again.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <ActionButton
              label="Keep address"
              onClick={() => setPendingRemoval(null)}
            />
            <ActionButton
              label={removingId === pendingRemoval.id ? "Removing…" : "Remove address"}
              loading={removingId === pendingRemoval.id}
              disabled={controlsDisabled}
              onClick={() => void handleRemove(pendingRemoval.id)}
            />
          </div>
        </Modal>
      )}
  </>
  );
}
