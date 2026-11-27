"use client";

import { useId } from "react";
import Link from "next/link";
import { formatStroops } from "@/lib/amount";
import { TX_TIMEOUT_SECONDS, getFeeStroops } from "@/lib/sdk";
import { DEFAULT_BASE_FEE_STROOPS, reserveIsExact } from "@/lib/stellar/reserve";
import type { SigningInfo } from "@/lib/sdk";
import type { Balance } from "@/lib/wallets";
import type { WithdrawAsset } from "./WithdrawModal";

interface WithdrawFormProps {
  assets: WithdrawAsset[];
  selectedKey: string;
  onSelectKey: (key: string) => void;
  destination: string;
  onDestination: (v: string) => void;
  amount: string;
  onAmount: (v: string) => void;
  memo: string;
  onMemo: (v: string) => void;
  memoType: "text" | "id";
  onMemoType: (v: "text" | "id") => void;
  password: string;
  onPassword: (v: string) => void;
  spendableStroops: bigint;
  reserveInfo: SigningInfo | null;
  reserveInfoLoading: boolean;
  reserveStroops: bigint | null;
  walletId: string;
  walletAddress?: string;
  allowlistBlocked: boolean;
  trustlines: Balance[];
  resigning: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

/** The initial form step: asset, destination, amount, memo and password. */
export function WithdrawForm({
  assets,
  selectedKey,
  onSelectKey,
  destination,
  onDestination,
  amount,
  onAmount,
  memo,
  onMemo,
  memoType,
  onMemoType,
  password,
  onPassword,
  spendableStroops,
  reserveInfo,
  reserveInfoLoading,
  reserveStroops,
  walletId,
  walletAddress,
  allowlistBlocked,
  trustlines,
  resigning,
  submitting,
  error,
  onSubmit,
}: WithdrawFormProps) {
  const destinationId = useId();
  const amountId = useId();
  const memoId = useId();
  const passwordId = useId();
  const errorId = useId();

  const selected = assets.find((a) => a.key === selectedKey) ?? assets[0];

  const getFeeDisplay = () => {
    try {
      return formatStroops(reserveInfo ? getFeeStroops(reserveInfo) : DEFAULT_BASE_FEE_STROOPS);
    } catch {
      return formatStroops(DEFAULT_BASE_FEE_STROOPS);
    }
  };

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <label className="text-xs text-muted">Asset</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => onSelectKey(a.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                a.key === selectedKey
                  ? "border-burgundy-bright bg-burgundy/20 text-foreground"
                  : "border-border bg-surface-sunken text-muted hover:border-border-strong"
              }`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-medium text-foreground">{a.code}</span>
                {a.issuer && (
                  <span className="text-[10px] text-muted truncate max-w-[14rem]" title={a.issuer}>
                    {a.issuer}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        {assets.length === 1 && (
          <p className="mt-1.5 text-[11px] text-muted">
            Add a USDC trustline to withdraw USDC.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={destinationId} className="text-xs text-muted">
          Destination address
        </label>
        <input
          id={destinationId}
          value={destination}
          onChange={(e) => onDestination(e.target.value.trim())}
          placeholder="G… or M…"
          className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={amountId} className="text-xs text-muted">
            Amount ({selected?.code ?? "XLM"})
          </label>
          <button
            type="button"
            onClick={() => onAmount(formatStroops(spendableStroops))}
            disabled={reserveInfoLoading || spendableStroops <= BigInt(0)}
            className="text-xs text-burgundy-bright hover:underline disabled:opacity-50"
          >
            {reserveInfoLoading ? "Loading…" : "Max"}
          </button>
        </div>
        <input
          id={amountId}
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.0000000"
          className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
        />
        {/* Show spendable vs reserved breakdown for XLM so the user can verify Max is correct. */}
        {!selected?.asset && !reserveInfoLoading && reserveStroops !== null && (
          <p className="mt-1 text-[11px] text-muted">
            Available:{" "}
            <span className="text-foreground">{formatStroops(spendableStroops)} XLM</span>
            {" · "}
            {reserveIsExact(reserveInfo) ? "" : "~"}
            <span className="text-foreground">{formatStroops(reserveStroops)} XLM</span> reserved
            {!reserveIsExact(reserveInfo) && (
              <span> (estimated — exact value depends on network state)</span>
            )}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={memoId} className="text-xs text-muted">
            Memo (optional)
          </label>
          <div className="flex gap-1">
            {(["text", "id"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onMemoType(t)}
                className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                  memoType === t
                    ? "border-burgundy-bright bg-burgundy/20 text-foreground"
                    : "border-border bg-surface-sunken text-muted hover:border-border-strong"
                }`}
              >
                {t === "text" ? "Text" : "ID"}
              </button>
            ))}
          </div>
        </div>
        <input
          id={memoId}
          value={memo}
          onChange={(e) => onMemo(e.target.value.trim())}
          placeholder={memoType === "text" ? "e.g. Invoice 123" : "e.g. 12345"}
          className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-muted">
          {memoType === "text"
            ? `${new TextEncoder().encode(memo).length}/28 bytes used. Text memos are limited to 28 UTF-8 bytes.`
            : "Numeric memo ID (up to 64 bits). Exchanges/custodians may require this to credit deposits."}
        </p>
      </div>

      <div>
        {/* Hidden username scoped to this wallet so password managers keep wallet passwords apart from the login (#683). */}
        {walletAddress && (
          <input
            type="text"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            autoComplete="username"
            value={`wallet:${walletAddress}`}
            className="sr-only"
          />
        )}
        <label htmlFor={passwordId} className="text-xs text-muted">
          Wallet password (to sign)
        </label>
        <input
          id={passwordId}
          type="password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          placeholder="Your encryption password"
          autoComplete="current-password"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-muted">
          Signs locally on this device — your key never leaves the browser. After signing you have{" "}
          {Math.round(TX_TIMEOUT_SECONDS / 60)} minutes to enter the emailed code.
        </p>
      </div>

      {allowlistBlocked && (
        <div role="alert" className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
          <p>This address isn&apos;t on your withdrawal allowlist.</p>
          <Link href={`/dashboard/wallets/${walletId}/whitelist`} className="mt-1 inline-block font-semibold underline">
            Manage your allowlist
          </Link>
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? "Checking…" : resigning ? "Review & sign again" : "Review & withdraw"}
      </button>
    </form>
  );
}
