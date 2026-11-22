"use client";

import { useId } from "react";
import { formatStroops, parseAmount } from "@/lib/amount";
import { reserveIsExact } from "@/lib/stellar/reserve";
import { HighlightedAddress } from "@/components/dashboard/Modal";
import type { SigningInfo } from "@/lib/sdk";
import type { WithdrawAsset } from "./WithdrawModal";

interface WithdrawReviewProps {
  destination: string;
  selected: WithdrawAsset;
  reviewedAmount: string;
  spendableStroops: bigint;
  reserveStroops: bigint | null;
  reserveInfo: SigningInfo | null;
  createsAccount: boolean;
  memo: string;
  memoType: "text" | "id";
  feeDisplay: string;
  password: string;
  onPassword: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

/** The review step: show exact withdrawal details before the user enters their password. */
export function WithdrawReview({
  destination,
  selected,
  reviewedAmount,
  spendableStroops,
  reserveStroops,
  reserveInfo,
  createsAccount,
  memo,
  memoType,
  feeDisplay,
  password,
  onPassword,
  submitting,
  error,
  onSubmit,
  onBack,
}: WithdrawReviewProps) {
  const passwordId = useId();
  const errorId = useId();

  const reviewedStroops = (() => {
    const p = parseAmount(reviewedAmount);
    return p.ok ? p.stroops : BigInt(0);
  })();

  return (
    <>
      <p className="text-sm text-muted">
        Review exactly what you are about to sign before entering your wallet password.
      </p>
      <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-sunken px-3 py-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="text-muted">Destination:</span>
          <HighlightedAddress address={destination} />
        </div>
        <p className="text-muted">
          Asset: <span className="text-foreground">{selected.code}</span>
          {selected.asset && (
            <span className="ml-1 break-all font-mono text-foreground">
              ({selected.asset.issuer})
            </span>
          )}
        </p>
        <p className="text-muted">
          Amount:{" "}
          <span className="text-foreground">
            {reviewedAmount} {selected.code}
          </span>
        </p>
        {!selected.asset && (
          <p className="text-muted">
            Remaining after withdrawal:{" "}
            <span className="text-foreground">
              {formatStroops(spendableStroops - reviewedStroops)} XLM
            </span>
            <span className="ml-1">
              ({reserveIsExact(reserveInfo) ? "" : "about "}
              {formatStroops(reserveStroops ?? BigInt(0))} XLM minimum reserve, plus network fee)
            </span>
          </p>
        )}
        {createsAccount && (
          <p className="text-warning">This will create the account.</p>
        )}
        <p className="text-muted">
          Fee:{" "}
          <span className="text-foreground">
            {feeDisplay}
            {feeDisplay.startsWith("Unavailable") ? "" : " XLM"}
          </span>
        </p>
        {memo.trim() && (
          <p className="text-muted">
            Memo: {memoType === "id" ? "ID " : "Text "}
            {memo.trim()}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="mt-4">
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
        </div>
        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-3 rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {submitting ? "Signing..." : "Sign & continue"}
        </button>
      </form>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full text-center text-xs text-muted hover:text-foreground"
      >
        Back to form
      </button>
    </>
  );
}
