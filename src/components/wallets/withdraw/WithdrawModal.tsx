"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/dashboard/Modal";
import {
  unlockWallet, getSigningInfo, requestWithdrawOtp, confirmWithdraw,
  getAccountExists, buildSignedPayment,
  buildSignedCreateAccount, txExpiresAt, assertNetworkConsistency, validateMemo,
  describeSignedWithdrawal, getFeeStroops, type SigningInfo, type SubmitResult, type Memo,
} from "@/lib/sdk";
import { parseAmount, formatStroops } from "@/lib/amount";
import { validateStellarAddress, getStellarAddressKind, baseAccountOf } from "@/lib/stellar/address";
import {
  DEFAULT_BASE_FEE_STROOPS,
  minimumBalanceStroops,
  spendableNativeStroops,
  minCreateAccountStroops,
  reserveIsExact,
} from "@/lib/stellar/reserve";
import { friendlyResultMessage, isExpiredResult } from "@/lib/stellar/resultCodes";
import { errorMessage, errorText } from "@/lib/api";
import type { Balance } from "@/lib/wallets";
import { WithdrawForm } from "./WithdrawForm";
import { WithdrawReview } from "./WithdrawReview";
import { WithdrawOtpStep } from "./WithdrawOtpStep";
import { WithdrawResult } from "./WithdrawResult";
import { useWithdrawFlow, EXPIRY_MARGIN_MS, RESEND_COOLDOWN_SECS } from "./useWithdrawFlow";

export type WithdrawAsset = {
  key: string;
  code: string;
  issuer?: string;
  available: string;
  asset?: { code: string; issuer: string };
};

const clockMs = () => Date.now();

export function WithdrawModal({
  token,
  walletId,
  walletAddress,
  balances,
  onClose,
  onDone,
}: {
  token: string;
  walletId: string;
  walletAddress?: string;
  balances: Balance[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, dispatch] = useWithdrawFlow();
  const [submitting, setSubmitting] = useState(false);
  const [reserveInfo, setReserveInfo] = useState<SigningInfo | null>(null);
  const [now, setNow] = useState(0);

  const trustlines = balances.filter(
    (b) => b.asset_type !== "native" && b.asset_code && b.asset_issuer,
  );
  const assets: WithdrawAsset[] = [
    {
      key: "XLM",
      code: "XLM",
      available: balances.find((b) => b.asset_type === "native")?.balance ?? "0",
    },
    ...trustlines.map((b) => {
      const code = b.asset_code as string;
      const issuer = b.asset_issuer as string;
      return { key: `${code}:${issuer}`, code, issuer, available: b.balance, asset: { code, issuer } };
    }),
  ];
  const defaultKey = assets[0]?.key ?? "XLM";
  const selectedKey = state.selectedKey || defaultKey;
  const selected = assets.find((a) => a.key === selectedKey) ?? assets[0] ?? { key: "XLM", code: "XLM", available: "0" };

  useEffect(() => {
    getSigningInfo(token, walletId).then(setReserveInfo).catch(() => {});
  }, [token, walletId]);

  // Tick while OTP is pending.
  useEffect(() => {
    if (state.step !== "otp") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state.step]);

  const availableStroops = (() => {
    const p = parseAmount(selected.available);
    return p.ok ? p.stroops : BigInt(0);
  })();
  const spendableStroops = selected.asset
    ? availableStroops
    : spendableNativeStroops(availableStroops, reserveInfo, trustlines.length);
  const reserveStroops = selected.asset
    ? null
    : minimumBalanceStroops(reserveInfo, trustlines.length);

  const feeDisplay = (() => {
    try {
      return formatStroops(reserveInfo ? getFeeStroops(reserveInfo) : DEFAULT_BASE_FEE_STROOPS);
    } catch {
      return "Unavailable (network fee data is invalid)";
    }
  })();

  const secondsLeft = state.expiresAt === null
    ? 0
    : Math.max(0, Math.floor((state.expiresAt - EXPIRY_MARGIN_MS - now) / 1000));
  const expired = state.networkExpired || (state.expiresAt !== null && secondsLeft <= 0);
  const resendCooldown = Math.max(0, Math.ceil((state.resendAvailableAt - now) / 1000));

  function validate(): { error: string } | { stroops: bigint } {
    const addrError = validateStellarAddress(state.destination, { ownAddress: walletAddress });
    if (addrError) return { error: addrError };
    const parsed = parseAmount(state.amount);
    if (!parsed.ok) return { error: parsed.error };
    if (parsed.stroops <= BigInt(0)) return { error: "Enter an amount greater than 0." };
    if (parsed.stroops > spendableStroops) {
      return {
        error: selected.asset
          ? `You can send at most ${formatStroops(spendableStroops)} ${selected.code}.`
          : `You can send at most ${formatStroops(spendableStroops)} XLM — the rest covers Stellar's minimum reserve and the network fee.`,
      };
    }
    const memoValue = state.memo.trim();
    if (memoValue) {
      const memoError = validateMemo(
        state.memoType === "id"
          ? { type: "id", id: memoValue }
          : { type: "text", text: memoValue },
      );
      if (memoError) return { error: memoError };
    }
    return { stroops: parsed.stroops };
  }

  async function proceedToReview() {
    dispatch({ type: "SET_ERROR", value: null });
    const checked = validate();
    if ("error" in checked) {
      dispatch({ type: "SET_ERROR", value: checked.error });
      return;
    }
    setSubmitting(true);
    try {
      const exists = (await getAccountExists(token, walletId, baseAccountOf(state.destination))).exists;
      const needsCreate = exists === false;
      if (needsCreate && selected.asset) {
        dispatch({
          type: "SET_ERROR",
          value: `This address isn't activated on Stellar yet, so it can't hold ${selected.code}. Ask the recipient to fund it with XLM and add a ${selected.code} trustline first.`,
        });
        return;
      }
      if (needsCreate && getStellarAddressKind(state.destination) === "med25519") {
        dispatch({
          type: "SET_ERROR",
          value: "This muxed (M…) address belongs to an account that isn't activated yet. Send at least 1 XLM to its base G… address first.",
        });
        return;
      }
      if (needsCreate && checked.stroops < minCreateAccountStroops(reserveInfo)) {
        dispatch({
          type: "SET_ERROR",
          value: `This address isn't activated on Stellar yet. Send at least ${formatStroops(minCreateAccountStroops(reserveInfo))} XLM to create it.`,
        });
        return;
      }
      dispatch({
        type: "GO_TO_REVIEW",
        createsAccount: needsCreate,
        reviewedAmount: formatStroops(checked.stroops),
      });
    } catch (err) {
      dispatch({ type: "SET_ERROR", value: errorMessage(err, "Failed to validate destination") });
    } finally {
      setSubmitting(false);
    }
  }

  async function signAndRequestOtp() {
    dispatch({ type: "SET_ERROR", value: null });
    const checked = validate();
    if ("error" in checked) {
      dispatch({ type: "SET_ERROR", value: checked.error });
      return;
    }
    if (!state.password) {
      dispatch({ type: "SET_ERROR", value: "Enter your wallet password to sign." });
      return;
    }
    setSubmitting(true);
    try {
      const keypair = await unlockWallet(token, walletId, state.password, walletAddress);
      const info = await getSigningInfo(token, walletId);
      assertNetworkConsistency(info.network_passphrase);
      const memoValue = state.memo.trim();
      const memoPayload: Memo | undefined = memoValue
        ? state.memoType === "id"
          ? { type: "id", id: memoValue }
          : { type: "text", text: memoValue }
        : undefined;
      const normalized = formatStroops(checked.stroops);
      const signedXdr = state.createsAccount
        ? buildSignedCreateAccount(keypair, info, {
            destination: state.destination,
            startingBalance: normalized,
            memo: memoPayload,
          })
        : buildSignedPayment(keypair, info, {
            destination: state.destination,
            amount: normalized,
            asset: selected.asset,
            memo: memoPayload,
          });
      const decoded = describeSignedWithdrawal(signedXdr, info.network_passphrase);
      const expectedMemo = memoPayload;
      const memoMatches =
        decoded.memo?.type === expectedMemo?.type &&
        (decoded.memo?.type === "text"
          ? decoded.memo.text === expectedMemo?.text
          : decoded.memo?.type === "id"
            ? decoded.memo.id === expectedMemo?.id
            : !expectedMemo);
      if (
        decoded.needsCreate !== state.createsAccount ||
        decoded.destination !== state.destination.trim() ||
        decoded.amount !== normalized ||
        decoded.assetCode !== selected.code ||
        decoded.assetIssuer !== selected.asset?.issuer ||
        !memoMatches
      ) {
        throw new Error(
          "The signed withdrawal does not match the reviewed details. Go back and review it again.",
        );
      }
      await requestWithdrawOtp(token, walletId, signedXdr);
      setReserveInfo(info);
      const signedAt = clockMs();
      setNow(signedAt);
      dispatch({
        type: "OTP_REQUESTED",
        pendingXdr: signedXdr,
        expiresAt: txExpiresAt(signedXdr, info.network_passphrase),
        resendAvailableAt: signedAt + RESEND_COOLDOWN_SECS * 1000,
        createsAccount: state.createsAccount,
        signedTxDetails: decoded,
      });
    } catch (err) {
      const message = friendlyResultMessage(errorText(err), "Withdrawal failed.");
      dispatch({ type: "SET_ERROR", value: message });
      toast.error(message);
    } finally {
      dispatch({ type: "SET_PASSWORD", value: "" });
      setSubmitting(false);
    }
  }

  async function resendOtp() {
    if (!state.pendingXdr || submitting || resendCooldown > 0 || expired) return;
    dispatch({ type: "SET_ERROR", value: null });
    setSubmitting(true);
    try {
      await requestWithdrawOtp(token, walletId, state.pendingXdr);
      const resendAt = Date.now() + RESEND_COOLDOWN_SECS * 1000;
      dispatch({ type: "RESEND_AVAILABLE_AT", value: resendAt });
      setNow(Date.now());
      toast.success("A new code is on its way.");
    } catch (err) {
      const message = errorMessage(err, "Could not resend the code.");
      dispatch({ type: "SET_ERROR", value: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm() {
    if (!state.pendingXdr) return;
    dispatch({ type: "SET_ERROR", value: null });
    if (expired) return;
    if (state.code.length !== 6) {
      dispatch({ type: "SET_ERROR", value: "Enter the 6-digit code from your email." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await confirmWithdraw(token, walletId, state.pendingXdr, state.code);
      if (res.status !== "confirmed" && isExpiredResult(res.detail)) {
        dispatch({ type: "NETWORK_EXPIRED" });
        return;
      }
      dispatch({ type: "RESULT", result: res });
      if (res.status !== "confirmed") {
        toast.error(friendlyResultMessage(res.detail, "The withdrawal was not confirmed."));
      }
    } catch (err) {
      const raw = errorText(err);
      if (isExpiredResult(raw)) {
        dispatch({ type: "NETWORK_EXPIRED" });
        return;
      }
      const message = friendlyResultMessage(raw, "Invalid or expired code.");
      dispatch({ type: "SET_ERROR", value: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Result
  if (state.step === "result" && state.result) {
    return (
      <Modal title="Withdrawal" onClose={onDone}>
        <WithdrawResult result={state.result} onDone={onDone} />
      </Modal>
    );
  }

  // OTP
  if (state.step === "otp") {
    return (
      <Modal title="Verify withdrawal" onClose={onClose}>
        <WithdrawOtpStep
          signedTxDetails={state.signedTxDetails}
          amount={state.amount}
          assetCode={selected.code}
          memo={state.memo}
          memoType={state.memoType}
          createsAccount={state.createsAccount}
          code={state.code}
          onCode={(v) => dispatch({ type: "SET_CODE", value: v })}
          secondsLeft={secondsLeft}
          expired={expired}
          submitting={submitting}
          resending={false}
          resendCooldown={resendCooldown}
          error={state.error}
          onConfirm={confirm}
          onResend={resendOtp}
          onBack={() => dispatch({ type: "DISCARD_SIGNED", resign: false })}
          onSignAgain={() => dispatch({ type: "DISCARD_SIGNED", resign: true })}
        />
      </Modal>
    );
  }

  // Review
  if (state.step === "review") {
    return (
      <Modal title="Review withdrawal" onClose={onClose}>
        <WithdrawReview
          destination={state.destination}
          selected={selected}
          reviewedAmount={state.reviewedAmount ?? state.amount}
          spendableStroops={spendableStroops}
          reserveStroops={reserveStroops}
          reserveInfo={reserveInfo}
          createsAccount={state.createsAccount}
          memo={state.memo}
          memoType={state.memoType}
          feeDisplay={feeDisplay}
          password={state.password}
          onPassword={(v) => dispatch({ type: "SET_PASSWORD", value: v })}
          submitting={submitting}
          error={state.error}
          onSubmit={signAndRequestOtp}
          onBack={() => dispatch({ type: "BACK_TO_FORM" })}
        />
      </Modal>
    );
  }

  // Form (default)
  const nativeBalance = balances.find((b) => b.asset_type === "native")?.balance ?? "0";
  const parsedNativeBalance = parseAmount(nativeBalance);
  const nativeBalanceStroops = parsedNativeBalance.ok ? parsedNativeBalance.stroops : BigInt(0);
  void nativeBalanceStroops; // kept for future "insufficient balance" warning

  return (
    <Modal title="Withdraw" onClose={onClose}>
      <p className="text-sm text-muted">
        Send {selected.code} from this master wallet. Available:{" "}
        <span className="text-foreground">
          {selected.available} {selected.code}
        </span>
        .
      </p>
      {reserveStroops !== null && (
        <p className="mt-1 text-xs text-muted">
          Spendable:{" "}
          <span className="text-foreground">{formatStroops(spendableStroops)} XLM</span>{" "}
          ({reserveIsExact(reserveInfo) ? "" : "about "}
          {formatStroops(reserveStroops)} XLM stays as Stellar&apos;s minimum reserve, plus the
          network fee).
        </p>
      )}
      {state.resigning && (
        <p className="mt-4 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-muted">
          Your previous signature expired. Re-enter your password to sign a fresh withdrawal —
          we&apos;ll email a new code.
        </p>
      )}
      <WithdrawForm
        assets={assets}
        selectedKey={selectedKey}
        onSelectKey={(v) => dispatch({ type: "SET_SELECTED_KEY", value: v })}
        destination={state.destination}
        onDestination={(v) => dispatch({ type: "SET_DESTINATION", value: v })}
        amount={state.amount}
        onAmount={(v) => dispatch({ type: "SET_AMOUNT", value: v })}
        memo={state.memo}
        onMemo={(v) => dispatch({ type: "SET_MEMO", value: v })}
        memoType={state.memoType}
        onMemoType={(v) => dispatch({ type: "SET_MEMO_TYPE", value: v })}
        password={state.password}
        onPassword={(v) => dispatch({ type: "SET_PASSWORD", value: v })}
        spendableStroops={spendableStroops}
        reserveInfo={reserveInfo}
        trustlines={trustlines}
        resigning={state.resigning}
        submitting={submitting}
        error={state.error}
        onSubmit={proceedToReview}
      />
    </Modal>
  );
}
