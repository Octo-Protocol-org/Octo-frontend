"use client";

import { formatCountdownSeconds } from "@/lib/format";
import { OtpInput } from "@/components/auth/OtpInput";
import { HighlightedAddress } from "@/components/dashboard/Modal";
import type { SignedWithdrawalDetails } from "@/lib/sdk";

interface WithdrawOtpStepProps {
  signedTxDetails: SignedWithdrawalDetails | null;
  amount: string;
  assetCode: string;
  memo: string;
  memoType: "text" | "id";
  createsAccount: boolean;
  code: string;
  onCode: (v: string) => void;
  secondsLeft: number;
  expired: boolean;
  submitting: boolean;
  resending: boolean;
  resendCooldown: number;
  error: string | null;
  onConfirm: () => void;
  onResend: () => void;
  onBack: () => void;
  onSignAgain: () => void;
}

/** The OTP confirmation step: enter the 6-digit email code to authorise the withdrawal. */
export function WithdrawOtpStep({
  signedTxDetails,
  amount,
  assetCode,
  memo,
  memoType,
  createsAccount,
  code,
  onCode,
  secondsLeft,
  expired,
  submitting,
  resending,
  resendCooldown,
  error,
  onConfirm,
  onResend,
  onBack,
  onSignAgain,
}: WithdrawOtpStepProps) {
  const displayAmount = signedTxDetails ? signedTxDetails.amount : amount;
  const displayCode = signedTxDetails ? signedTxDetails.assetCode : assetCode;

  return (
    <>
      <p className="text-center text-sm text-muted">
        Enter the 6-digit code we emailed you to confirm this withdrawal of{" "}
        <span className="text-foreground">
          {displayAmount} {displayCode}
        </span>
        .
      </p>

      {memo.trim() && (
        <p className="mt-1 text-center text-xs text-muted">
          Memo: {memoType === "id" ? "ID " : "Text "}
          {memo.trim()}
        </p>
      )}

      {signedTxDetails && (
        <div className="mt-3 space-y-1 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-muted">Destination:</span>
            <HighlightedAddress address={signedTxDetails.destination} />
          </div>
          <p className="text-muted">
            Amount:{" "}
            <span className="text-foreground">
              {signedTxDetails.amount} {signedTxDetails.assetCode}
            </span>
          </p>
          {signedTxDetails.assetIssuer && (
            <p className="text-muted break-all">
              Issuer:{" "}
              <span className="font-mono text-foreground">{signedTxDetails.assetIssuer}</span>
            </p>
          )}
        </div>
      )}

      {createsAccount && (
        <p className="mt-2 text-center text-xs text-muted">
          This address isn&apos;t activated yet — this withdrawal will create it.
        </p>
      )}

      <p
        className={`mt-3 text-center text-xs ${secondsLeft <= 30 ? "text-warning" : "text-muted"}`}
        aria-live="polite"
      >
        Expires in{" "}
        <span className="font-mono text-foreground">{formatCountdownSeconds(secondsLeft)}</span>
      </p>

      <div className="mt-4">
        <OtpInput value={code} onChange={onCode} disabled={submitting} label="Withdrawal confirmation code" />
      </div>

      {expired && (
        <div className="mt-4">
          <p
            role="alert"
            className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
          >
            This signed withdrawal expired. Nothing was sent.
          </p>
          <button
            type="button"
            onClick={onSignAgain}
            className="mt-3 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold"
          >
            Sign again
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
          {error}
        </p>
      )}

      <button
        onClick={onConfirm}
        disabled={submitting || expired}
        className="mt-5 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? "Confirming…" : "Verify & withdraw"}
      </button>

      <p className="mt-4 text-center text-xs text-muted">
        Didn&apos;t get a code?{" "}
        <button
          type="button"
          onClick={onResend}
          disabled={expired || resending || resendCooldown > 0}
          className="font-semibold text-foreground hover:text-burgundy-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resending
            ? "Sending…"
            : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend code"}
        </button>
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full text-center text-xs text-muted hover:text-foreground"
      >
        Back
      </button>
    </>
  );
}
