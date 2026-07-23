"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { createWallet, type CreateWalletResponse } from "@/lib/wallets";
import { ApiError } from "@/lib/api";
import {
  generateWallet,
  encryptSeed,
  serializeBackup,
  saveLocalBackup,
  type WalletKeys,
} from "@/lib/sdk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageSpinner } from "@/components/OctoSpinner";

export function NewWalletClient() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Both the server record and the client-held mnemonic are needed for the reveal step.
  const [created, setCreated] = useState<{
    wallet: CreateWalletResponse;
    mnemonic: string;
  } | null>(null);

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);

    if (password.length < 8) {
      setError("Choose a password of at least 8 characters to encrypt your key.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Generate the keypair + mnemonic entirely in the browser.
      const keys: WalletKeys = generateWallet();
      // 2. Encrypt the mnemonic under the user's password (server can never decrypt it).
      const backup = await encryptSeed(keys.mnemonic, password);
      const encryptedBackup = serializeBackup(backup);
      // 3. Register only the public key + opaque backup blob.
      const wallet = await createWallet(token, {
        publicKey: keys.publicKey,
        encryptedBackup,
        label: name,
        description,
      });
      // 4. Keep a local copy of the backup so this device can sign without a round-trip.
      saveLocalBackup(wallet.id, backup);
      setCreated({ wallet, mnemonic: keys.mnemonic });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to create wallet.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell email={user.email} title="New master wallet" onLogout={logout}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-foreground">
            My Wallets
          </Link>
          <span>›</span>
          <span className="text-foreground">New master wallet</span>
        </div>

        {created ? (
          <RecoveryReveal
            wallet={created.wallet}
            mnemonic={created.mnemonic}
            onDone={() => router.push("/dashboard")}
          />
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
                <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-burgundy-bright" />
                    Stellar — Testnet
                  </span>
                  <span className="text-xs text-muted">fixed</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  Wallet name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme master wallet"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  Wallet description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this wallet for?"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  Encryption password
                </label>
                <p className="mt-1 text-xs text-muted">
                  Encrypts your key backup. Octo never sees it — if you lose both this
                  password and your recovery phrase, your funds are unrecoverable.
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
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
  );
}

function RecoveryReveal({
  wallet,
  mnemonic,
  onDone,
}: {
  wallet: CreateWalletResponse;
  mnemonic: string;
  onDone: () => void;
}) {
  const [acked, setAcked] = useState(false);
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-burgundy/40 bg-burgundy-soft/30 p-8">
      <h2 className="text-xl font-semibold text-foreground">
        Wallet created — save your recovery phrase
      </h2>
      <p className="mt-2 text-sm text-muted">
        This 12-word phrase is shown <strong>once</strong>. It is the only way to
        recover your key if you forget your password. Store it somewhere safe and
        never share it.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-black/40 p-4">
        {mnemonic.split(" ").map((word, i) => (
          <span
            key={i}
            className="rounded-md bg-white/5 px-2 py-1.5 text-center text-sm text-foreground"
          >
            <span className="mr-1 text-muted">{i + 1}.</span>
            {word}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-lg bg-black/30 p-3 text-xs">
        <p className="text-muted">Address</p>
        <p className="mt-1 break-all font-mono text-foreground">
          {wallet.address}
        </p>
        <p className="mt-2 text-burgundy-bright">
          {wallet.funded ? "✓ Funded on testnet" : "Not yet funded"}
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
        onClick={onDone}
        disabled={!acked}
        className="mt-5 w-full rounded-xl glass-btn-primary py-3 text-sm font-semibold disabled:opacity-50"
      >
        Go to dashboard
      </button>
    </div>
  );
}
