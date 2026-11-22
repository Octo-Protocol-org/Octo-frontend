"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/dashboard/Modal";
import { explorerAccountUrl, explorerTxUrl, network } from "@/lib/network";
import {
  unlockWallet,
  getSigningInfo,
  submitSigned,
  buildSignedChangeTrust,
  getFeeStroops,
  type SigningInfo,
  type SubmitResult,
} from "@/lib/sdk";
import { parseAmount, formatStroops } from "@/lib/amount";
import { minimumBalanceStroops } from "@/lib/stellar/reserve";
import { friendlyResultMessage } from "@/lib/stellar/resultCodes";
import { errorMessage } from "@/lib/api";
import { usdcForNetwork, type Balance } from "@/lib/wallets";
import { DEFAULT_BASE_FEE_STROOPS } from "@/lib/stellar/reserve";

export function TrustlineModal({
  token,
  walletId,
  walletAddress,
  balances,
  onClose,
  onDone,
}: {
  token: string;
  walletId: string;
  walletAddress: string;
  balances: Balance[];
  onClose: () => void;
  onDone: () => void;
}) {
  const passwordId = useId();
  const errorId = useId();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingInfo, setSigningInfo] = useState<SigningInfo | null>(null);
  const [result, setResult] = useState<{
    status: string;
    hash: string | null;
    detail: string | null;
  } | null>(null);

  useEffect(() => {
    getSigningInfo(token, walletId).then(setSigningInfo).catch(() => setSigningInfo(null));
  }, [token, walletId]);

  const passphrase = signingInfo?.network_passphrase ?? network.passphrase;
  const usdc = usdcForNetwork(passphrase);
  const hasTrustline = balances.some(
    (balance) => balance.asset_code === usdc.code && balance.asset_issuer === usdc.issuer,
  );
  const trustlineCount = balances.filter((balance) => balance.asset_type !== "native").length;
  const nativeBalance = balances.find((balance) => balance.asset_type === "native")?.balance ?? "0";
  const parsedNativeBalance = parseAmount(nativeBalance);
  const nativeBalanceStroops = parsedNativeBalance.ok ? parsedNativeBalance.stroops : BigInt(0);
  const feeBig = BigInt(signingInfo ? getFeeStroops(signingInfo) : DEFAULT_BASE_FEE_STROOPS);
  const requiredStroops = minimumBalanceStroops(signingInfo, trustlineCount + 1) + feeBig;
  const shortfallStroops = requiredStroops > nativeBalanceStroops
    ? requiredStroops - nativeBalanceStroops
    : BigInt(0);
  const insufficientReserve = shortfallStroops > BigInt(0);

  async function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    if (hasTrustline) return;
    if (insufficientReserve) {
      setError(`Add at least ${formatStroops(shortfallStroops)} XLM to cover the new trustline reserve and transaction fee.`);
      return;
    }
    if (!password) {
      setError("Enter your wallet password to sign.");
      return;
    }
    setSubmitting(true);
    try {
      // Unlock the key locally (decrypt with password), build + sign the ChangeTrust in the
      // browser, then relay the signed XDR. The private key never leaves this device.
      const keypair = await unlockWallet(token, walletId, password, walletAddress);
      const info = signingInfo ?? await getSigningInfo(token, walletId);
      const signedXdr = buildSignedChangeTrust(keypair, info, {
        asset: { code: usdc.code, issuer: usdc.issuer },
      });
      const res: SubmitResult = await submitSigned(token, walletId, signedXdr);
      setResult({
        status: res.status,
        hash: res.stellar_tx_hash,
        detail: res.detail ?? null,
      });
    } catch (err) {
      const message = errorMessage(err, "Could not add the trustline.");
      setError(message);
      toast.error(message);
    } finally {
      // The password is only needed for the instant of signing; never keep it around.
      setPassword("");
      setSubmitting(false);
    }
  }

  if (result) {
    const ok = result.status === "confirmed";
    return (
      <Modal title="USDC trustline" onClose={onDone}>
        <div className="text-center" role="status">
          <p className={`text-3xl ${ok ? "text-burgundy-bright" : "text-warning"}`}>
            <span aria-hidden="true">{ok ? "✓" : "!"}</span>
            <span className="sr-only">{ok ? "Success" : "Failed"}</span>
          </p>
          <p className="mt-2 font-medium capitalize text-foreground">
            {ok ? "Trustline established" : result.status}
          </p>
          <p className="mt-1 text-sm text-muted">
            {ok
              ? "This wallet can now receive USDC."
              : friendlyResultMessage(
                  result.detail,
                  "The trustline could not be established. Ensure the wallet holds enough XLM for the reserve.",
                )}
          </p>
          {result.hash && (
            <a
              href={explorerTxUrl(result.hash)}
              target="_blank"
              rel="noopener noreferrer"
              title="View transaction on Stellar Explorer"
              className="mt-2 block break-all font-mono text-xs text-burgundy-bright underline decoration-burgundy-bright/40 underline-offset-2 transition-colors hover:decoration-burgundy-bright"
            >
              {result.hash}
            </a>
          )}
          <button
            onClick={onDone}
            className="mt-6 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add USDC trustline" onClose={onClose}>
      <p className="text-sm text-muted">
        Establishing a trustline lets this master wallet hold and receive{" "}
        <span className="text-foreground">USDC</span> on Stellar. It costs a small XLM base
        reserve and requires signing from your master wallet.
      </p>

      <div className="mt-5 space-y-1 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs">
        <p className="text-muted">
          Asset: <span className="text-foreground">USDC</span>
        </p>
        <p className="text-muted">
          Issuer:{" "}
          <span className="break-all font-mono text-foreground">{usdc.issuer}</span>
        </p>
        <a
          href={explorerAccountUrl(usdc.issuer)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-burgundy-bright underline"
        >
          View issuer on Stellar Expert
        </a>
      </div>

      {hasTrustline ? (
        <p
          className="mt-4 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground"
          role="status"
        >
          This wallet already holds a USDC trustline.
        </p>
      ) : insufficientReserve ? (
        <p
          className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
          role="status"
        >
          Add at least {formatStroops(shortfallStroops)} XLM to cover the new trustline reserve
          and transaction fee before signing.
        </p>
      ) : (
        <form onSubmit={submit}>
          <div className="mt-4">
            <label htmlFor={passwordId} className="text-xs text-muted">
              Wallet password (to sign)
            </label>
            <input
              id={passwordId}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              className="mt-4 rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Signing…" : "Add trustline"}
          </button>
        </form>
      )}
    </Modal>
  );
}
