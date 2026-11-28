"use client";

import { useEffect, useId, useState } from "react";
import { Modal } from "@/components/dashboard/Modal";
import { unlockBackup, markPhraseConfirmed } from "@/lib/sdk";

/** How many phrase words the user must re-enter to prove they saved the phrase. */
const VERIFY_WORD_COUNT = 3;

type Step = "password" | "reveal" | "verify" | "done";

/**
 * Allows a user to view and confirm their recovery phrase for an existing wallet.
 * Unlocks the backup with their wallet password, shows the phrase with blur protection,
 * then runs a spot-check verification before marking the phrase confirmed.
 */
export function ConfirmPhraseModal({
  token,
  walletId,
  walletAddress,
  onClose,
  onConfirmed,
}: {
  token: string;
  walletId: string;
  walletAddress?: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [step, setStep] = useState<Step>("password");
  const [mnemonic, setMnemonic] = useState("");

  function handleUnlocked(phrase: string) {
    setMnemonic(phrase);
    setStep("reveal");
  }

  function handleVerified() {
    markPhraseConfirmed(walletId);
    setStep("done");
  }

  if (step === "done") {
    return (
      <Modal title="Recovery phrase confirmed" onClose={onConfirmed}>
        <div className="text-center">
          <p className="text-3xl text-burgundy-bright">✓</p>
          <p className="mt-2 font-medium text-foreground">Phrase confirmed</p>
          <p className="mt-1 text-sm text-muted">
            Your recovery phrase is saved. The warning on your wallet has been cleared.
          </p>
          <button
            onClick={onConfirmed}
            className="mt-6 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  if (step === "verify" && mnemonic) {
    return (
      <PhraseCheckModal
        mnemonic={mnemonic}
        onBack={() => setStep("reveal")}
        onVerified={handleVerified}
        onClose={onClose}
      />
    );
  }

  if (step === "reveal" && mnemonic) {
    return (
      <PhraseRevealModal
        mnemonic={mnemonic}
        onContinue={() => setStep("verify")}
        onClose={onClose}
      />
    );
  }

  return (
    <PasswordUnlockModal
      token={token}
      walletId={walletId}
      walletAddress={walletAddress}
      onUnlocked={handleUnlocked}
      onClose={onClose}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1: unlock with wallet password
// ---------------------------------------------------------------------------

function PasswordUnlockModal({
  token,
  walletId,
  walletAddress,
  onUnlocked,
  onClose,
}: {
  token: string;
  walletId: string;
  walletAddress?: string;
  onUnlocked: (mnemonic: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setError("Enter your wallet password."); return; }
    setBusy(true);
    setError(null);
    try {
      const { mnemonic } = await unlockBackup(token, walletId, password, walletAddress);
      setPassword("");
      onUnlocked(mnemonic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock the wallet.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <Modal title="View recovery phrase" onClose={onClose}>
      <p className="text-sm text-muted">
        Enter your wallet password to decrypt and reveal the recovery phrase.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <input
          type="password"
          autoComplete="off"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Wallet password"
          aria-label="Wallet password"
          className="w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
        />
        {error && (
          <p role="alert" className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg glass-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Step 2: show the phrase with blur/reveal protection
// ---------------------------------------------------------------------------

function PhraseRevealModal({
  mnemonic,
  onContinue,
  onClose,
}: {
  mnemonic: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  const words = mnemonic.split(" ");
  const [visible, setVisible] = useState(false);
  const [acked, setAcked] = useState(false);

  // Re-blur when the tab loses focus (screen-share / idle protection).
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") setVisible(false);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <Modal title="Your recovery phrase" onClose={onClose}>
      <p className="text-sm text-muted">
        Write down these {words.length} words in order and store them somewhere safe. You&apos;ll
        be asked to verify a few of them next.
      </p>

      <div className="relative mt-4">
        <ol
          aria-hidden={!visible}
          className={`grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-sunken p-4 transition-[filter] duration-200 ${visible ? "" : "select-none blur-md"}`}
        >
          {words.map((word, i) => (
            <li key={i} className="rounded-md bg-hover px-2 py-1.5 text-center text-sm text-foreground">
              <span className="mr-1 text-muted">{i + 1}.</span>
              {word}
            </li>
          ))}
        </ol>
        {!visible && (
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-sunken/60 text-sm font-medium text-foreground backdrop-blur-sm"
          >
            <span aria-hidden="true" className="text-2xl">🔒</span>
            <span>Click to reveal</span>
            <span className="text-xs font-normal text-muted">Make sure no one can see your screen</span>
          </button>
        )}
      </div>

      {visible && (
        <button type="button" onClick={() => setVisible(false)} className="mt-2 text-xs text-muted hover:text-foreground">
          Hide again
        </button>
      )}

      <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={acked}
          onChange={(e) => setAcked(e.target.checked)}
          className="accent-[var(--burgundy-bright)]"
        />
        I have securely saved my recovery phrase
      </label>

      <button
        type="button"
        onClick={onContinue}
        disabled={!acked}
        className="mt-4 w-full rounded-xl glass-btn-primary py-3 text-sm font-semibold disabled:opacity-50"
      >
        Continue to verification
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Step 3: spot-check verification
// ---------------------------------------------------------------------------

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

function PhraseCheckModal({
  mnemonic,
  onBack,
  onVerified,
  onClose,
}: {
  mnemonic: string;
  onBack: () => void;
  onVerified: () => void;
  onClose: () => void;
}) {
  const words = mnemonic.split(" ");
  const [indices] = useState(() => pickWordIndices(words.length, VERIFY_WORD_COUNT));
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
    if (mismatched.length === 0) onVerified();
    else {
      const first = mismatched[0];
      if (first !== undefined) document.getElementById(`cpw-${first}`)?.focus();
    }
  }

  return (
    <Modal title="Confirm your recovery phrase" onClose={onClose}>
      <p className="text-sm text-muted">
        Enter the words at the positions below from the phrase you wrote down.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <fieldset>
          <legend className="sr-only">Requested recovery phrase words</legend>
          {indices.map((i) => {
            const invalid = wrong.includes(i);
            return (
              <div key={i} className="mb-3">
                <label htmlFor={`cpw-${i}`} className="text-sm font-medium text-foreground">
                  Word #{i + 1}
                </label>
                <input
                  id={`cpw-${i}`}
                  value={answers[i] ?? ""}
                  onChange={(e) => {
                    setAnswers((a) => ({ ...a, [i]: e.target.value }));
                    setWrong((w) => w.filter((x) => x !== i));
                  }}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? errorId : undefined}
                  className={`mt-1.5 w-full rounded-xl border bg-surface-raised px-4 py-3 text-sm text-foreground focus:outline-none ${
                    invalid ? "border-danger focus:border-danger" : "border-border focus:border-burgundy-bright"
                  }`}
                />
              </div>
            );
          })}
        </fieldset>

        {wrong.length > 0 && (
          <p id={errorId} role="alert" className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
            {wrong.length === 1
              ? `Word #${(wrong[0] ?? 0) + 1} doesn't match.`
              : `Words ${wrong.map((i) => `#${i + 1}`).join(", ")} don't match.`}{" "}
            Check what you wrote down, or go back to view the phrase again.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
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
            Confirm phrase
          </button>
        </div>
      </form>
    </Modal>
  );
}
