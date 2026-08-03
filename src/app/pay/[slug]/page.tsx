"use client";

import { use, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { CopyButton } from "@/components/CopyButton";
import {
  getPublicPaymentLink,
  createPaymentIntent,
  getPaymentStatus,
  getPublicSigningInfo,
  submitPublicPayment,
  usdcStroopsToAmount,
  usdAmountToStroops,
  isValidEmail,
  type PublicPaymentLink,
  type PaymentIntent,
  type PaymentStatus,
} from "@/lib/payment-links";
import { USDC_TESTNET } from "@/lib/wallets";
import { buildUnsignedPayment } from "@/lib/sdk";
import { OctoSpinner } from "@/components/OctoSpinner";
import confetti from "canvas-confetti";

type Step = "loading" | "not-found" | "form" | "pay" | "confirmed";

/** Keep the loading spinner up for at least this long so it doesn't just flash on fast loads. */
const MIN_LOADING_MS = 700;

function celebrate() {
  confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
}

// Sends the payer back to the merchant's site after a short delay; fails open on a bad URL.
function redirectAfterConfirm(redirectUrl: string, paymentId: string, slugValue: string) {
  try {
    const url = new URL(redirectUrl);
    url.searchParams.set("status", "success");
    url.searchParams.set("payment_id", paymentId);
    url.searchParams.set("slug", slugValue);
    setTimeout(() => {
      window.location.href = url.toString();
    }, 2000);
  } catch {
    // malformed redirect_url — stay on the confirmed page
  }
}

export default function PayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [step, setStep] = useState<Step>("loading");
  const [link, setLink] = useState<PublicPaymentLink | null>(null);
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [freighterBusy, setFreighterBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  // Set only for a resolved-but-not-successful status (expired/underpaid/overpaid).
  const [resolvedStatus, setResolvedStatus] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    const startedAt = Date.now();
    const finish = (next: Step) => {
      const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        setTimeout(() => setStep(next), remaining);
      } else {
        setStep(next);
      }
    };
    getPublicPaymentLink(slug)
      .then((l) => {
        setLink(l);
        if (l.amount_usdc_stroops !== null) {
          setAmount(usdcStroopsToAmount(l.amount_usdc_stroops));
        }
        finish("form");
      })
      .catch(() => finish("not-found"));
  }, [slug]);

  // Handles any status response; returns true once resolved (confirmed or otherwise final).
  function applyStatus(status: PaymentStatus): boolean {
    if (status.status === "confirmed") {
      setStep("confirmed");
      celebrate();
      if (link?.redirect_url && intent) {
        redirectAfterConfirm(link.redirect_url, intent.payment_id, slug);
      }
      return true;
    }
    if (status.status === "expired" || status.status === "underpaid" || status.status === "overpaid") {
      setResolvedStatus(status);
      return true;
    }
    return false;
  }

  // Polls for confirmation once an intent has a deposit address to watch.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!intent || step !== "pay") return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await getPaymentStatus(slug, intent.payment_id);
        if (applyStatus(status) && pollRef.current) {
          clearInterval(pollRef.current);
        }
      } catch {
        // transient — keep polling
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, step, slug, link]);

  async function handleCheckPayment() {
    if (!intent) return;
    setChecking(true);
    setCheckMessage(null);
    try {
      const status = await getPaymentStatus(slug, intent.payment_id);
      if (!applyStatus(status)) {
        setCheckMessage(
          "Not received yet — deposits can take a little while to be detected. This page will update automatically once it lands.",
        );
      }
    } catch {
      setCheckMessage("Could not check payment status. Try again in a moment.");
    } finally {
      setChecking(false);
    }
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!link) return;
    // Reuse the existing intent if the payer went Back and forward again.
    if (intent) {
      setStep("pay");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Name and email are required — a payer's identity must be collectible before they pay.
      if (!payerName.trim() || !payerEmail.trim()) {
        setError("Enter your name and email address.");
        setSubmitting(false);
        return;
      }
      if (!isValidEmail(payerEmail.trim())) {
        setError("Enter a valid email address.");
        setSubmitting(false);
        return;
      }
      const amountUsdcStroops =
        link.amount_usdc_stroops ?? usdAmountToStroops(amount);
      if (amountUsdcStroops === null) {
        setError("Enter a valid amount.");
        setSubmitting(false);
        return;
      }
      const created = await createPaymentIntent(slug, {
        payerName: payerName.trim() || undefined,
        payerEmail: payerEmail.trim() || undefined,
        amountUsdcStroops,
      });
      setIntent(created);
      setStep("pay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start this payment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFreighterPay() {
    if (!intent) return;
    setFreighterBusy(true);
    setError(null);
    try {
      const freighter = await import("@stellar/freighter-api");
      const access = await freighter.requestAccess();
      if (access.error || !access.address) {
        throw new Error("Could not connect to Freighter. Is it installed and unlocked?");
      }

      // Sequence must be the PAYER's own (it's the tx source), not the merchant's.
      const info = await getPublicSigningInfo(slug, access.address);
      const unsignedXdr = buildUnsignedPayment(access.address, info, {
        destination: intent.deposit_address,
        amount: usdcStroopsToAmount(intent.amount_usdc_stroops),
        asset: USDC_TESTNET,
      });

      const signed = await freighter.signTransaction(unsignedXdr, {
        networkPassphrase: info.network_passphrase,
        address: access.address,
      });
      if (signed.error || !signed.signedTxXdr) {
        throw new Error("Freighter did not return a signed transaction.");
      }

      const result = await submitPublicPayment(slug, signed.signedTxXdr, intent.payment_id);
      if (result.status !== "confirmed") {
        throw new Error(
          result.detail?.includes("no_trust")
            ? "Your wallet needs a USDC trustline before it can send USDC. Add one in Freighter, or use the deposit address instead."
            : result.detail || "The payment could not be confirmed on-chain.",
        );
      }
      setStep("confirmed");
      celebrate();
      if (link?.redirect_url) {
        redirectAfterConfirm(link.redirect_url, intent.payment_id, slug);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freighter payment failed.");
    } finally {
      setFreighterBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 md:grid-cols-2">
        <div className="flex flex-col justify-between bg-black p-8">
          <div className="flex items-center justify-between">
            <Logo />
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
              Testnet
            </span>
          </div>

          {link && (
            <div className="mt-10">
              <p className="text-sm text-muted">Pay {link.name}</p>
              <p className="mt-2 text-4xl font-semibold text-foreground">
                {link.amount_usdc_stroops !== null
                  ? `$${usdcStroopsToAmount(link.amount_usdc_stroops)}`
                  : amount
                    ? `$${amount}`
                    : "$—"}
              </p>
              {link.description && (
                <p className="mt-3 text-sm text-muted">{link.description}</p>
              )}
            </div>
          )}

          {link?.image_url ? (
            <img
              src={link.image_url}
              alt=""
              className="mt-8 aspect-square w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="mt-8 flex aspect-square w-full items-center justify-center rounded-2xl bg-burgundy/10">
              <Logo className="scale-150 opacity-40" />
            </div>
          )}
        </div>

        <div className="bg-white p-8">
          {step === "loading" && (
            <div className="flex h-full items-center justify-center py-12">
              <OctoSpinner size={40} />
            </div>
          )}

          {step === "not-found" && (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <p className="text-lg font-semibold text-gray-900">Link not found</p>
                <p className="mt-2 text-sm text-gray-500">
                  This payment link doesn&apos;t exist or is no longer active.
                </p>
              </div>
            </div>
          )}

          {step === "form" && link && (
            <form onSubmit={handleContinue} className="space-y-5">
              <StepHeader current="Personal Information" />

              {link.amount_usdc_stroops === null && (
                <Field label="Enter Amount">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-black"
                  />
                </Field>
              )}

              <Field label="Enter Personal Information">
                <div className="space-y-2">
                  <input
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-black"
                  />
                  <input
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    placeholder="Email address"
                    type="email"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-black"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  We use this to send you a confirmation of your payment.
                </p>
              </Field>

              {error && <ErrorBanner message={error} />}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <OctoSpinner size={16} className="text-white" />}
                {submitting ? "Please wait…" : "Continue"}
              </button>
              <p className="text-center text-[11px] text-gray-400">
                🔒 Secure and encrypted payment.
              </p>
            </form>
          )}

          {step === "pay" && intent && resolvedStatus && (
            <MismatchBanner
              status={resolvedStatus}
              onBack={() => {
                // The old intent is permanently resolved — starting over needs a fresh one.
                setResolvedStatus(null);
                setIntent(null);
                setStep("form");
              }}
            />
          )}

          {step === "pay" && intent && !resolvedStatus && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <StepHeader current="Payment Method" />
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900"
                >
                  ‹ Back
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Amount</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  ${usdcStroopsToAmount(intent.amount_usdc_stroops)}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">Wallet Transfer</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  Send USDC from any Stellar wallet to the address below.
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs text-gray-900">
                    {intent.deposit_address}
                  </span>
                  <CopyButton
                    value={intent.deposit_address}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCheckPayment}
                  disabled={checking}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 text-xs font-medium text-gray-900 transition-colors hover:border-black disabled:opacity-50"
                >
                  {checking && <OctoSpinner size={14} />}
                  {checking ? "Checking…" : "I've sent the payment — check now"}
                </button>
                {checkMessage && (
                  <p className="mt-2 text-[11px] text-gray-500">{checkMessage}</p>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <div className="h-px flex-1 bg-gray-200" />
                OR
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">Connect Wallet</p>
                <button
                  type="button"
                  onClick={handleFreighterPay}
                  disabled={freighterBusy}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:border-black disabled:opacity-50"
                >
                  {freighterBusy && <OctoSpinner size={16} />}
                  {freighterBusy ? "Connecting…" : "🦄 Connect Freighter"}
                </button>
              </div>

              {error && <ErrorBanner message={error} />}

              <p className="text-center text-[11px] text-gray-400">
                Waiting for payment — this page updates automatically once it&apos;s received.
              </p>
            </div>
          )}

          {step === "confirmed" && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-3 text-lg font-semibold text-gray-900">Payment received</p>
              <p className="mt-2 text-sm text-gray-500">
                Thank you{payerName ? `, ${payerName}` : ""} — your payment has been
                confirmed on-chain.
              </p>
              {link?.redirect_url && (
                <p className="mt-4 text-[11px] text-gray-400">Redirecting you back…</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ current }: { current: "Personal Information" | "Payment Method" }) {
  const steps = ["Personal Information", "Payment Method"] as const;
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
              s === current
                ? "bg-black text-white"
                : steps.indexOf(current) > i
                  ? "bg-gray-900 text-white"
                  : "bg-gray-200 text-gray-500"
            }`}
          >
            {i + 1}
          </span>
          <span className={s === current ? "font-medium text-gray-900" : "text-gray-400"}>
            {s}
          </span>
          {i === 0 && <span className="mx-1 h-px w-8 bg-gray-200" />}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-900">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function MismatchBanner({
  status,
  onBack,
}: {
  status: PaymentStatus;
  onBack: () => void;
}) {
  const copy = {
    expired: {
      title: "Payment window expired",
      body: "This payment wasn't completed in time. Go back and start again.",
    },
    underpaid: {
      title: "Amount too low",
      body: `You sent $${usdcStroopsToAmount(status.received_usdc_stroops ?? 0)}, but $${usdcStroopsToAmount(status.expected_usdc_stroops)} was expected. Contact the merchant to resolve this.`,
    },
    overpaid: {
      title: "Amount too high",
      body: `You sent $${usdcStroopsToAmount(status.received_usdc_stroops ?? 0)}, but only $${usdcStroopsToAmount(status.expected_usdc_stroops)} was expected. Contact the merchant to resolve this.`,
    },
  }[status.status as "expired" | "underpaid" | "overpaid"];

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-3xl">⚠️</p>
      <p className="mt-3 text-lg font-semibold text-gray-900">{copy.title}</p>
      <p className="mt-2 max-w-xs text-sm text-gray-500">{copy.body}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:border-black"
      >
        ‹ Back
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
      {message}
    </p>
  );
}
