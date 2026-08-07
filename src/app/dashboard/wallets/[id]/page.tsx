"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import {
  getWallet,
  getBalances,
  listAddresses,
  listTransactions,
  createAddress,
  USDC_TESTNET,
  stroopsToAmount,
  type WalletView,
  type Balance,
  type Address,
  type Transaction,
} from "@/lib/wallets";
import {
  unlockWallet,
  getSigningInfo,
  submitSigned,
  requestWithdrawOtp,
  confirmWithdraw,
  buildSignedPayment,
  buildSignedChangeTrust,
  type SubmitResult,
} from "@/lib/sdk";
import { OtpInput } from "@/components/auth/OtpInput";
import { WalletSidebar } from "@/components/dashboard/WalletSidebar";
import { DashboardBackground } from "@/components/dashboard/DashboardBackground";
import { Modal, CopyField } from "@/components/dashboard/Modal";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { ApiError } from "@/lib/api";
import { PageSpinner } from "@/components/OctoSpinner";

export default function WalletOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading, logout } = useAuth();

  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [creating, setCreating] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTrustline, setShowTrustline] = useState(false);

  function refresh() {
    if (!token) return;
    getBalances(token, id).then(setBalances).catch(() => {});
    // The submit-signed endpoint records the outbound transfer server-side before responding,
    // so a plain re-fetch reflects it (no optimistic insert needed).
    listTransactions(token, id).then(setTxns).catch(() => {});
  }

  useEffect(() => {
    if (!token) return;
    getWallet(token, id).then(setWallet).catch(() => setWallet(null));
    getBalances(token, id).then(setBalances).catch(() => setBalances([]));
    listAddresses(token, id).then(setAddresses).catch(() => setAddresses([]));
    listTransactions(token, id).then(setTxns).catch(() => setTxns([]));
  }, [token, id]);

  // Silently re-fetch balances + recent transactions in the background so a new deposit shows up
  // without a manual refresh — no loading indicator here, that's only for explicit refresh actions.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      getBalances(token, id).then(setBalances).catch(() => {});
      listTransactions(token, id).then(setTxns).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [token, id]);

  async function onNewAddress() {
    if (!token) return;
    setCreating(true);
    try {
      const addr = await createAddress(token, id);
      setAddresses((a) => [addr, ...a]);
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  const xlm = balances.find((b) => b.asset_type === "native");
  const xlmAmount = xlm ? xlm.balance : "0";
  const hasUsdc = balances.some(
    (b) => b.asset_code === USDC_TESTNET.code && b.asset_issuer === USDC_TESTNET.issuer,
  );

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
          {/* topbar */}
          <header className="flex items-center justify-between border-b border-white/10 px-8 py-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Link href="/dashboard" className="hover:text-foreground">
                My Wallets
              </Link>
              <span>›</span>
              <span className="text-foreground">Overview</span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-muted hover:text-foreground"
            >
              ⏻
            </button>
          </header>

          <main className="flex-1 px-8 py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {/* header */}
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {wallet?.label ?? "Master wallet"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {wallet?.description ?? "Stellar master wallet"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span className="text-muted">
                  Address:{" "}
                  <span className="font-mono text-foreground">
                    {wallet
                      ? `${wallet.address.slice(0, 10)}…${wallet.address.slice(-8)}`
                      : "—"}
                  </span>
                </span>
                <span className="text-muted">
                  ID: <span className="font-mono text-foreground">{id.slice(0, 8)}…</span>
                </span>
              </div>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Total Balance" value={`${xlmAmount} XLM`} />
              <Stat label="Current Balance" value={`${xlmAmount} XLM`} />
              <Stat label="Unswept Balance" value="0 XLM" sub="No sweep needed (muxed)" />
              <Stat label="No. of Assets" value={String(balances.length || 1)} />
            </div>

            {/* action row */}
            <div className="flex flex-wrap gap-3">
              <ActionButton label="New address" onClick={onNewAddress} loading={creating} />
              <ActionButton label="Deposit" onClick={() => setShowDeposit(true)} />
              <ActionButton label="Withdraw" onClick={() => setShowWithdraw(true)} />
              <ActionButton
                label={hasUsdc ? "USDC trusted ✓" : "Add USDC trustline"}
                onClick={() => setShowTrustline(true)}
                disabled={hasUsdc}
              />
              <ActionButton
                label="Refresh balances"
                onClick={() => token && getBalances(token, id).then(setBalances)}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              {/* assets */}
              <Panel title="Assets">
                {balances.length === 0 ? (
                  <Empty>No assets yet.</Empty>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {balances.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between py-3"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-burgundy/30 text-xs text-burgundy-bright">
                            {b.asset_type === "native" ? "XLM" : b.asset_code ?? "?"}
                          </span>
                          <span className="text-sm text-foreground">
                            {b.asset_type === "native" ? "Stellar Lumens" : b.asset_code}
                          </span>
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {b.balance}{" "}
                          {b.asset_type === "native" ? "XLM" : b.asset_code}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {/* addresses */}
              <Panel title="Addresses">
                {addresses.length === 0 ? (
                  <Empty>No addresses generated yet.</Empty>
                ) : (
                  <ul className="space-y-3">
                    {addresses.slice(0, 5).map((a) => (
                      <li key={a.id}>
                        <p className="font-mono text-xs text-burgundy-bright">
                          {a.muxed_address.slice(0, 8)}…{a.muxed_address.slice(-6)}
                        </p>
                        <p className="text-[11px] text-muted">
                          memo id {a.memo_id}
                          {a.customer_ref ? ` · ${a.customer_ref}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-right text-xs text-muted">
                  Showing last {Math.min(addresses.length, 5)} generated
                </p>
              </Panel>
            </div>

            {/* recent transactions */}
            <Panel title="Most recent transactions">
              {txns.length === 0 ? (
                <Empty>No transactions yet.</Empty>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-2">ID</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Hash</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {txns.map((t) => (
                      <tr key={t.id} className="text-foreground/90">
                        <td className="py-3 font-mono text-xs">
                          {t.id.slice(0, 8)}…
                        </td>
                        <td className="py-3">
                          {stroopsToAmount(t.amount_stroops)}{" "}
                          {t.asset_code === "native" ? "XLM" : t.asset_code}
                        </td>
                        <td className="py-3 font-mono text-xs">
                          {t.stellar_tx_hash ? (
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${t.stellar_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View transaction on Stellar Explorer"
                              className="text-burgundy-bright underline decoration-burgundy-bright/40 underline-offset-2 transition-colors hover:decoration-burgundy-bright"
                            >
                              {`${t.stellar_tx_hash.slice(0, 8)}…`}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3">
                          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs capitalize">
                            {t.direction}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-xs text-burgundy-bright capitalize">
                            ● {t.status}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
          </main>
        </div>
      </div>

      {showDeposit && (
        <DepositModal
          addresses={addresses}
          baseAddress={wallet?.address ?? ""}
          onClose={() => setShowDeposit(false)}
          onNewAddress={onNewAddress}
          creating={creating}
        />
      )}
      {showWithdraw && token && (
        <WithdrawModal
          token={token}
          walletId={id}
          balances={balances}
          onClose={() => setShowWithdraw(false)}
          onDone={() => {
            setShowWithdraw(false);
            refresh();
          }}
        />
      )}
      {showTrustline && token && (
        <TrustlineModal
          token={token}
          walletId={id}
          onClose={() => setShowTrustline(false)}
          onDone={() => {
            setShowTrustline(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function TrustlineModal({
  token,
  walletId,
  onClose,
  onDone,
}: {
  token: string;
  walletId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: string;
    hash: string | null;
    detail: string | null;
  } | null>(null);

  async function submit() {
    setError(null);
    if (!password) {
      setError("Enter your wallet password to sign.");
      return;
    }
    setSubmitting(true);
    try {
      // Unlock the key locally (decrypt with password), build + sign the ChangeTrust in the
      // browser, then relay the signed XDR. The private key never leaves this device.
      const keypair = await unlockWallet(token, walletId, password);
      const info = await getSigningInfo(token, walletId);
      const signedXdr = buildSignedChangeTrust(keypair, info, {
        asset: { code: USDC_TESTNET.code, issuer: USDC_TESTNET.issuer },
      });
      const res: SubmitResult = await submitSigned(token, walletId, signedXdr);
      setResult({
        status: res.status,
        hash: res.stellar_tx_hash,
        detail: res.detail ?? null,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not add the trustline.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const ok = result.status === "confirmed";
    return (
      <Modal title="USDC trustline" onClose={onDone}>
        <div className="text-center">
          <p className={`text-3xl ${ok ? "text-burgundy-bright" : "text-amber-400"}`}>
            {ok ? "✓" : "!"}
          </p>
          <p className="mt-2 font-medium capitalize text-foreground">
            {ok ? "Trustline established" : result.status}
          </p>
          <p className="mt-1 text-sm text-muted">
            {ok
              ? "This wallet can now receive USDC."
              : result.detail ??
                "The trustline could not be established. Ensure the wallet holds enough XLM for the reserve."}
          </p>
          {result.hash && (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${result.hash}`}
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
        <span className="text-foreground">USDC</span> on Stellar. It costs a
        small XLM base reserve and requires signing from your master wallet.
      </p>

      <div className="mt-5 space-y-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
        <p className="text-muted">
          Asset: <span className="text-foreground">USDC</span>
        </p>
        <p className="break-all text-muted">
          Issuer:{" "}
          <span className="font-mono text-foreground">{USDC_TESTNET.issuer}</span>
        </p>
        <p className="text-muted">Network: Stellar Testnet</p>
      </div>

      <div className="mt-4">
        <label className="text-xs text-muted">Wallet password (to sign)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your encryption password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="mt-5 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? "Signing…" : "Add trustline"}
      </button>
    </Modal>
  );
}

function DepositModal({
  addresses,
  baseAddress,
  onClose,
  onNewAddress,
  creating,
}: {
  addresses: Address[];
  baseAddress: string;
  onClose: () => void;
  onNewAddress: () => void;
  creating: boolean;
}) {
  const latest = addresses[0];
  return (
    <Modal title="Deposit" onClose={onClose}>
      <p className="text-sm text-muted">
        Share a deposit address with the sender. Funds sent to it land directly
        in this master wallet and are attributed to the customer.
      </p>

      {latest ? (
        <div className="mt-5 space-y-4">
          <CopyField label="Muxed address (recommended)" value={latest.muxed_address} />
          <CopyField label="Base address (G…+memo fallback)" value={baseAddress} />
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-muted">
            If the sender can&apos;t use the <code className="text-foreground">M…</code>{" "}
            address, send to the base address with memo (id){" "}
            <span className="text-foreground">{latest.memo_id}</span>.
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-muted">
          No addresses yet. Generate one to receive a deposit.
          <button
            onClick={onNewAddress}
            disabled={creating}
            className="mt-3 block w-full rounded-lg glass-btn-primary py-2 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Generating…" : "Generate address"}
          </button>
        </div>
      )}
    </Modal>
  );
}

/** A withdrawable asset derived from the wallet's balances. */
type WithdrawAsset = {
  code: string; // display code, e.g. "XLM" or "USDC"
  available: string;
  /** undefined => native XLM; otherwise the credit asset to send. */
  asset?: { code: string; issuer: string };
};

function WithdrawModal({
  token,
  walletId,
  balances,
  onClose,
  onDone,
}: {
  token: string;
  walletId: string;
  balances: Balance[];
  onClose: () => void;
  onDone: () => void;
}) {
  // Build the selectable asset list: XLM first, then any credit asset the
  // wallet holds a trustline for (USDC, etc.).
  const assets: WithdrawAsset[] = [
    {
      code: "XLM",
      available: balances.find((b) => b.asset_type === "native")?.balance ?? "0",
    },
    ...balances
      .filter((b) => b.asset_type !== "native" && b.asset_code && b.asset_issuer)
      .map((b) => ({
        code: b.asset_code as string,
        available: b.balance,
        asset: { code: b.asset_code as string, issuer: b.asset_issuer as string },
      })),
  ];

  const [selectedCode, setSelectedCode] = useState(assets[0].code);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  // Once the transaction is signed, it's held here awaiting OTP confirmation before it ever relays.
  const [pendingXdr, setPendingXdr] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const selected =
    assets.find((a) => a.code === selectedCode) ?? assets[0];

  async function requestOtp() {
    setError(null);
    if (!destination.startsWith("G") && !destination.startsWith("M")) {
      setError("Destination must be a Stellar address (G… or M…).");
      return;
    }
    if (!(Number(amount) > 0)) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!password) {
      setError("Enter your wallet password to sign.");
      return;
    }
    setSubmitting(true);
    try {
      // Unlock and sign locally — the private key never leaves this device. Only after signing
      // do we ask the server to email an OTP bound to this exact transaction.
      const keypair = await unlockWallet(token, walletId, password);
      const info = await getSigningInfo(token, walletId);
      const signedXdr = buildSignedPayment(keypair, info, {
        destination,
        amount, // decimal string, e.g. "1.5"
        asset: selected.asset, // undefined => XLM
      });
      await requestWithdrawOtp(token, walletId, signedXdr);
      setPendingXdr(signedXdr);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Withdrawal failed.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm() {
    if (!pendingXdr) return;
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await confirmWithdraw(token, walletId, pendingXdr, code);
      setResult(res);
      if (res.status !== "confirmed") {
        toast.error(res.detail ?? "The withdrawal was not confirmed.");
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Invalid or expired code.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const ok = result.status === "confirmed";
    const finish = () => onDone();
    return (
      <Modal title="Withdrawal" onClose={finish}>
        <div className="text-center">
          <p className={`text-3xl ${ok ? "text-burgundy-bright" : "text-amber-400"}`}>
            {ok ? "✓" : "!"}
          </p>
          <p className="mt-2 font-medium capitalize text-foreground">
            {result.status}
          </p>
          {!ok && result.detail && (
            <p className="mt-1 text-sm text-muted">{result.detail}</p>
          )}
          {result.stellar_tx_hash && (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${result.stellar_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View transaction on Stellar Explorer"
              className="mt-2 block break-all font-mono text-xs text-burgundy-bright underline decoration-burgundy-bright/40 underline-offset-2 transition-colors hover:decoration-burgundy-bright"
            >
              {result.stellar_tx_hash}
            </a>
          )}
          <button
            onClick={finish}
            className="mt-6 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  if (pendingXdr) {
    return (
      <Modal title="Verify withdrawal" onClose={onClose}>
        <p className="text-center text-sm text-muted">
          Enter the 6-digit code we emailed you to confirm this withdrawal of{" "}
          <span className="text-foreground">
            {amount} {selected.code}
          </span>
          .
        </p>

        <div className="mt-5">
          <OtpInput value={code} onChange={setCode} disabled={submitting} />
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
            {error}
          </p>
        )}

        <button
          onClick={confirm}
          disabled={submitting}
          className="mt-5 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {submitting ? "Confirming…" : "Verify & withdraw"}
        </button>
        <button
          onClick={() => {
            setPendingXdr(null);
            setCode("");
            setError(null);
          }}
          className="mt-3 w-full text-center text-xs text-muted hover:text-foreground"
        >
          Back
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Withdraw" onClose={onClose}>
      <p className="text-sm text-muted">
        Send {selected.code} from this master wallet. Available:{" "}
        <span className="text-foreground">
          {selected.available} {selected.code}
        </span>
        .
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs text-muted">Asset</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {assets.map((a) => (
              <button
                key={a.code}
                type="button"
                onClick={() => setSelectedCode(a.code)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  a.code === selectedCode
                    ? "border-burgundy-bright bg-burgundy/20 text-foreground"
                    : "border-white/10 bg-black/40 text-muted hover:border-white/25"
                }`}
              >
                {a.code}
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
          <label className="text-xs text-muted">Destination address</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value.trim())}
            placeholder="G… or M…"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted">Amount ({selected.code})</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.0000000"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted">Wallet password (to sign)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your encryption password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-muted">
            Signs locally on this device — your key never leaves the browser.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
            {error}
          </p>
        )}

        <button
          onClick={requestOtp}
          disabled={submitting}
          className="w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {submitting ? "Signing…" : "Withdraw"}
        </button>
      </div>
    </Modal>
  );
}

// Stat / ActionButton / Panel / Empty moved to @/components/dashboard/WalletUI so every wallet
// sub-page (Overview, Assets, ...) shares the same building blocks.
