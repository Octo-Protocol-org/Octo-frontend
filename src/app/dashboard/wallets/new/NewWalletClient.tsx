"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import {
  createWallet,
  getWalletChallenge,
  type CreateWalletResponse,
} from "@/lib/wallets";
import { errorMessage } from "@/lib/api";
import { network } from "@/lib/network";
import {
  generateWallet,
  encryptSeed,
  serializeBackup,
  saveLocalBackup,
  type EncryptedBackup,
  type WalletKeys,
} from "@/lib/sdk";
import {
  assessPassword,
  preloadPasswordEstimator,
  PasswordStrengthMeter,
  MIN_PASSWORD_LENGTH,
  type PasswordAssessment,
} from "@/lib/passwordStrength";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MAX_WALLET_DESCRIPTION, MAX_WALLET_LABEL } from "@/lib/walletDetailsApi";
import { ConfirmModal } from "@/components/dashboard/Modal";
import { PageSpinner } from "@/components/OctoSpinner";

/** How many phrase words the user must re-enter to prove they saved it. */
const VERIFY_WORD_COUNT = 3;

type PendingCreation = {
  keys: WalletKeys;
  backup: EncryptedBackup;
  challenge: string | null;
  signature: string | null;
  idempotencyKey: string;
  label: string;
  description: string;
};

export function NewWalletClient() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [strength, setStrength] = useState<PasswordAssessment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupWarning, setBackupWarning] = useState<string | null>(null);
  const pendingCreation = useRef<PendingCreation | null>(null);
  // Editing the form after a failed attempt discards the prepared keys so a retry never encrypts under a stale password.
  function editField(set: (value: string) => void) {
    return (e: { target: { value: string } }) => {
      pendingCreation.current = null;
      set(e.target.value);
    };
  }
  // Both the server record and the client-held mnemonic are needed for the reveal step.
  const [created, setCreated] = useState<{
    wallet: CreateWalletResponse;
    mnemonic: string;
  } | null>(null);
  const [verified, setVerified] = useState(false);

  // The wallet already exists server-side, so leaving before the phrase is verified loses it.
  const leave = useLeaveGuard(created !== null && !verified);

  const userInputs = [name, description, user?.email ?? "", user?.username ?? ""];
  const userInputsKey = userInputs.join("\u0000");

  // Live strength estimate; stale results from earlier keystrokes are discarded.
  useEffect(() => {
    if (!password) return;
    let current = true;
    assessPassword(password, userInputsKey.split("\u0000"))
      .then((r) => current && setStrength(r))
      .catch(() => current && setStrength(null));
    return () => {
      current = false;
    };
  }, [password, userInputsKey]);

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);

    if (name.trim().length > MAX_WALLET_LABEL) {
      setError(`Wallet name must be ${MAX_WALLET_LABEL} characters or fewer.`);
      return;
    }
    if (description.trim().length > MAX_WALLET_DESCRIPTION) {
      setError(`Wallet description must be ${MAX_WALLET_DESCRIPTION} characters or fewer.`);
      return;
    }

    if (!pendingCreation.current) {
      // Re-assess on submit so the decision never depends on a stale live estimate.
      let assessment: PasswordAssessment;
      try {
        assessment = await assessPassword(password, userInputs);
      } catch {
        setError("Couldn't check password strength. Check your connection and try again.");
        return;
      }
      if (!assessment.acceptable) {
        setStrength(assessment);
        setError(
          `This password is too easy to guess (${assessment.label.toLowerCase()}). ${
            assessment.feedback[0] ?? "Try a longer passphrase of several unrelated words."
          }`,
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Keep all generated material in memory until the server confirms creation.
      let pending = pendingCreation.current;
      if (!pending) {
        const keys = generateWallet();
        const backup = await encryptSeed(keys.mnemonic, password);
        pending = {
          keys,
          backup,
          challenge: null,
          signature: null,
          idempotencyKey: crypto.randomUUID(),
          label: name,
          description,
        };
        pendingCreation.current = pending;
      }
      if (!pending.challenge || !pending.signature) {
        const { challenge } = await getWalletChallenge(token);
        pending.challenge = challenge;
        pending.signature = pending.keys.keypair
          .sign(Buffer.from(challenge, "utf8"))
          .toString("base64");
      }
      if (!pending.challenge || !pending.signature) {
        throw new Error("Could not prepare wallet ownership proof. Please try again.");
      }
      const encryptedBackup = serializeBackup(pending.backup);
      const wallet = await createWallet(token, {
        publicKey: pending.keys.publicKey,
        challenge: pending.challenge,
        signature: pending.signature,
        encryptedBackup,
        label: pending.label,
        description: pending.description,
        idempotencyKey: pending.idempotencyKey,
      });
      const cached = saveLocalBackup(wallet.id, pending.backup);
      if (!cached) {
        setBackupWarning(
          "Your wallet was created, but this browser could not cache its encrypted backup. Keep your password and recovery phrase safe; Octo will provide the backup when you unlock this wallet.",
        );
      }
      pendingCreation.current = null;
      // The password is no longer needed; don't keep it in memory while the phrase is shown.
      setPassword("");
      setConfirmPassword("");
      setStrength(null);
      setCreated({ wallet, mnemonic: pending.keys.mnemonic });
    } catch (err) {
      setError(errorMessage(err, "Failed to create wallet."));
    } finally {
      setSubmitting(false);
    }
  }

  function onVerified() {
    setVerified(true);
    router.push("/dashboard");
  }

  return (
    <>
      <DashboardShell
        user={user}
        title="New master wallet"
        onLogout={() => leave.guard(logout)}
        blockNavigation={leave.blockNavigation}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center gap-2 text-sm text-muted">
            <Link
              href="/dashboard"
              onNavigate={(e) => {
                if (leave.blockNavigation("/dashboard")) e.preventDefault();
              }}
              className="hover:text-foreground"
            >
              My Wallets
            </Link>
            <span>›</span>
            <span className="text-foreground">New master wallet</span>
          </div>

          {created ? (
            <>
              <RecoveryReveal
                wallet={created.wallet}
                mnemonic={created.mnemonic}
                onVerified={onVerified}
              />
              {backupWarning && (
                <p role="status" className="mx-auto mt-4 max-w-xl rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                  {backupWarning}
                </p>
              )}
            </>
          ) : (
            <div className="grid gap-12 lg:grid-cols-2">
              {/* left: explainer */}
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Create a new master wallet
                </h2>
                <p className="mt-3 max-w-sm text-sm text-muted">
                  Your wallet&apos;s key is generated <strong>on this device</strong> and
                  never sent to Octo. You&apos;ll get a recovery phrase, and your key is
                  backed up encrypted with a password only you know.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Keys stay on your device (non-custodial)",
                    "Receive deposits & generate addresses",
                    "Sign withdrawals locally",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-foreground">
                      <span className="text-burgundy-bright">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* right: form */}
              <form onSubmit={onSubmit} className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Blockchain network
                  </label>
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-burgundy-bright" />
                      Stellar — {network.displayName}
                    </span>
                    <span className="text-xs text-muted">fixed</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="wallet-name"
                    className="text-sm font-medium text-foreground"
                  >
                    Wallet name
                  </label>
                  <input
                    id="wallet-name"
                    value={name}
                    maxLength={MAX_WALLET_LABEL}
                    onChange={editField(setName)}
                    placeholder="e.g. Acme master wallet"
                    className="mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wallet-description"
                    className="text-sm font-medium text-foreground"
                  >
                    Wallet description
                  </label>
                  <textarea
                    id="wallet-description"
                    value={description}
                    maxLength={MAX_WALLET_DESCRIPTION}
                    onChange={editField(setDescription)}
                    placeholder="What is this wallet for?"
                    rows={2}
                    className="mt-2 w-full resize-none rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wallet-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Encryption password
                  </label>
                  <p id="wallet-password-help" className="mt-1 text-xs text-muted">
                    Your encrypted key backup is stored on Octo&apos;s servers, and this
                    password is the only thing protecting it if that data ever leaks.
                    Octo never sees it and <strong>can&apos;t reset it</strong> — if you
                    lose both this password and your recovery phrase, your funds are
                    unrecoverable. A passphrase of several unrelated words works well.
                  </p>
                  <input
                    id="wallet-password"
                    type="password"
                    value={password}
                    onChange={editField(setPassword)}
                    onFocus={preloadPasswordEstimator}
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    autoComplete="new-password"
                    aria-describedby="wallet-password-help wallet-password-strength"
                    className="mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                  />
                  <PasswordStrengthMeter
                    id="wallet-password-strength"
                    assessment={password ? strength : null}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={editField(setConfirmPassword)}
                    placeholder="Confirm password"
                    aria-label="Confirm encryption password"
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl glass-btn-primary py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {submitting ? "Generating key…" : "Continue"}
                </button>
              </form>
            </div>
          )}
        </div>
      </DashboardShell>

      {/* Outside the shell so the parallax transform can't break fixed positioning. */}
      {leave.pending && (
        <ConfirmModal
          title="Leave without saving your recovery phrase?"
          message={
            <>
              Your wallet has already been created, but its recovery phrase is shown{" "}
              <strong>only once</strong>. If you leave now you won&apos;t be able to see it
              again, and forgetting your encryption password would mean losing the funds
              in this wallet permanently.
            </>
          }
          confirmLabel="Leave anyway"
          cancelLabel="Stay and save it"
          destructive
          onConfirm={leave.confirmLeave}
          onClose={leave.cancelLeave}
        />
      )}
    </>
  );
}

function RecoveryReveal({
  wallet,
  mnemonic,
  onVerified,
}: {
  wallet: CreateWalletResponse;
  mnemonic: string;
  onVerified: () => void;
}) {
  const words = mnemonic.split(" ");
  const [step, setStep] = useState<"reveal" | "verify">("reveal");
  const [acked, setAcked] = useState(false);
  // Chosen once, so going back to re-read the phrase doesn't change which words are asked.
  const [indices] = useState(() => pickWordIndices(words.length, VERIFY_WORD_COUNT));

  if (step === "verify") {
    return (
      <PhraseCheck
        words={words}
        indices={indices}
        onBack={() => setStep("reveal")}
        onVerified={onVerified}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-burgundy/40 bg-burgundy-soft/30 p-8">
      <h2 className="text-xl font-semibold text-foreground">
        Wallet created — save your recovery phrase
      </h2>
      <p className="mt-2 text-sm text-muted">
        This {words.length}-word phrase is shown <strong>once</strong>. It is the only
        way to recover your key if you forget your password. Write it down, store it
        somewhere safe and never share it. You&apos;ll be asked to confirm a few words
        next.
      </p>

      <ol className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-sunken p-4">
        {words.map((word, i) => (
          <li
            key={i}
            className="rounded-md bg-hover px-2 py-1.5 text-center text-sm text-foreground"
          >
            <span className="mr-1 text-muted">{i + 1}.</span>
            {word}
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-lg bg-surface-sunken p-3 text-xs">
        <p className="text-muted">Address</p>
        <p className="mt-1 break-all font-mono text-foreground">
          {wallet.address}
        </p>
        <p className="mt-2 text-burgundy-bright">
          {wallet.funded
            ? network.isTestnet
              ? "✓ Funded on testnet"
              : "✓ Funded"
            : "Not yet funded"}
        </p>
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={acked}
          onChange={(e) => setAcked(e.target.checked)}
          className="accent-[var(--burgundy-bright)]"
        />
        I have securely saved my recovery phrase
      </label>

      <button
        onClick={() => setStep("verify")}
        disabled={!acked}
        className="mt-5 w-full rounded-xl glass-btn-primary py-3 text-sm font-semibold disabled:opacity-50"
      >
        Continue to verification
      </button>
    </div>
  );
}

/** Picks `count` distinct word positions with a CSPRNG, returned in ascending order. */
function pickWordIndices(total: number, count: number): number[] {
  const picked = new Set<number>();
  const buf = new Uint32Array(1);
  while (picked.size < Math.min(count, total)) {
    crypto.getRandomValues(buf);
    const random = buf[0];
    if (random !== undefined) picked.add(random % total);
  }
  return [...picked].sort((a, b) => a - b);
}

function PhraseCheck({
  words,
  indices,
  onBack,
  onVerified,
}: {
  words: string[];
  indices: number[];
  onBack: () => void;
  onVerified: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [wrong, setWrong] = useState<number[]>([]);
  const errorId = useId();

  const complete = indices.every((i) => (answers[i] ?? "").trim() !== "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mismatched = indices.filter(
      (i) => (answers[i] ?? "").trim().toLowerCase() !== (words[i] ?? "").toLowerCase(),
    );
    setWrong(mismatched);
    if (mismatched.length === 0) {
      onVerified();
    } else {
      const firstMismatch = mismatched[0];
      if (firstMismatch !== undefined) document.getElementById(`phrase-word-${firstMismatch}`)?.focus();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-xl rounded-2xl border border-burgundy/40 bg-burgundy-soft/30 p-8"
    >
      <h2 className="text-xl font-semibold text-foreground">
        Confirm your recovery phrase
      </h2>
      <p className="mt-2 text-sm text-muted">
        To make sure you saved it correctly, enter the words at the positions below
        from the phrase you wrote down.
      </p>

      <fieldset className="mt-5 space-y-3">
        <legend className="sr-only">Requested recovery phrase words</legend>
        {indices.map((i) => {
          const invalid = wrong.includes(i);
          return (
            <div key={i}>
              <label
                htmlFor={`phrase-word-${i}`}
                className="text-sm font-medium text-foreground"
              >
                Word #{i + 1}
              </label>
              <input
                id={`phrase-word-${i}`}
                value={answers[i] ?? ""}
                onChange={(e) => {
                  setAnswers((a) => ({ ...a, [i]: e.target.value }));
                  setWrong((w) => w.filter((x) => x !== i));
                }}
                // Keep the phrase out of autofill history and cloud spell-checkers.
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
                className={`mt-1.5 w-full rounded-xl border bg-surface-raised px-4 py-3 text-sm text-foreground focus:outline-none ${
                  invalid
                    ? "border-danger focus:border-danger"
                    : "border-border focus:border-burgundy-bright"
                }`}
              />
            </div>
          );
        })}
      </fieldset>

      {wrong.length > 0 && (
        <p
          id={errorId}
          role="alert"
          className="mt-4 rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright"
        >
          {wrong.length === 1
            ? `Word #${(wrong[0] ?? 0) + 1} doesn't match.`
            : `Words ${wrong.map((i) => `#${i + 1}`).join(", ")} don't match.`}{" "}
          Check what you wrote down, or view the phrase again.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-hover sm:w-1/3"
        >
          View phrase again
        </button>
        <button
          type="submit"
          disabled={!complete}
          className="flex-1 rounded-xl glass-btn-primary py-3 text-sm font-semibold disabled:opacity-50"
        >
          Go to dashboard
        </button>
      </div>
    </form>
  );
}
