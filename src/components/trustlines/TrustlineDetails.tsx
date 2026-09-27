"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import type { Balance } from "@/lib/wallets";
import { DEFAULT_BASE_RESERVE_STROOPS } from "@/lib/stellar/reserve";
import { buildSignedChangeTrust, getSigningInfo, submitSigned, unlockWallet } from "@/lib/sdk";
import { friendlyResultMessage } from "@/lib/stellar/resultCodes";

const RESERVE_XLM = DEFAULT_BASE_RESERVE_STROOPS / 10_000_000;

const isZero = (b: string) => /^0*\.?0*$/.test(b.trim());

/** Lists trustlines with limit and locked reserve; removes an empty one (ChangeTrust limit 0). */
export function TrustlineDetails({
  token,
  walletId,
  balances,
  onChanged,
}: {
  token: string;
  walletId: string;
  balances: Balance[];
  onChanged: () => void;
}) {
  const [removing, setRemoving] = useState<Balance | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const lines = balances.filter(
    (b) => b.asset_type !== "native" && b.asset_code && b.asset_issuer,
  );
  if (lines.length === 0) return null;

  async function remove(b: Balance) {
    if (!password) {
      toast.error("Enter your wallet password to sign.");
      return;
    }
    setBusy(true);
    try {
      const keypair = await unlockWallet(token, walletId, password);
      const info = await getSigningInfo(token, walletId);
      const xdr = buildSignedChangeTrust(keypair, info, {
        asset: { code: b.asset_code as string, issuer: b.asset_issuer as string },
        limit: "0",
      });
      const res = await submitSigned(token, walletId, xdr);
      if (res.status === "confirmed") {
        toast.success(`${b.asset_code} trustline removed.`);
        setRemoving(null);
        onChanged();
      } else {
        toast.error(friendlyResultMessage(res.detail, `Removal ${res.status}.`));
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? friendlyResultMessage(err.message, "Could not remove the trustline.")
          : "Could not remove the trustline.",
      );
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-sunken/50 px-4 py-3 text-xs">
      <p className="text-sm font-medium text-foreground">Trustlines</p>
      <ul className="mt-2 divide-y divide-divider">
        {lines.map((b) => {
          const empty = isZero(b.balance);
          const limit = (b as Balance & { limit?: string }).limit;
          const open = removing?.asset_code === b.asset_code && removing?.asset_issuer === b.asset_issuer;
          return (
            <li key={`${b.asset_code}:${b.asset_issuer}`} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">
                  <span className="text-foreground">{b.asset_code}</span> · Balance {b.balance} ·
                  Limit {limit ?? "max"} · Reserve locked {RESERVE_XLM} XLM
                </span>
                <button
                  type="button"
                  disabled={!empty || busy}
                  onClick={() => setRemoving(open ? null : b)}
                  className="rounded-lg border border-border px-3 py-1 font-medium text-foreground disabled:opacity-50"
                >
                  Remove trustline
                </button>
              </div>
              {!empty && (
                <p className="mt-1 text-muted">
                  Removal is blocked while the balance is not zero. Send or withdraw all {b.asset_code}{" "}
                  first, then remove the trustline to free the {RESERVE_XLM} XLM reserve.
                </p>
              )}
              {open && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Wallet password (to sign)"
                    autoComplete="current-password"
                    className="rounded-lg border border-border bg-surface-sunken px-3 py-1.5 text-foreground focus:border-burgundy-bright focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => remove(b)}
                    disabled={busy}
                    className="rounded-lg glass-btn-primary px-3 py-1.5 font-semibold disabled:opacity-60"
                  >
                    {busy ? "Signing…" : "Confirm removal"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
