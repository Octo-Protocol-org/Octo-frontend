"use client";

import { errorMessage } from "@/lib/api";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/dashboard/Modal";
import {
  encryptSeed,
  serializeBackup,
  uploadBackup,
  saveLocalBackup,
  unlockBackup,
} from "@/lib/sdk";
import { assessPassword, PasswordStrengthMeter, MIN_PASSWORD_LENGTH, type PasswordAssessment } from "@/lib/passwordStrength";
import { useAuth } from "@/lib/useAuth";

/**
 * Change the wallet's encryption password:
 *  1. Decrypt the backup with the current password (proves ownership).
 *  2. Re-encrypt the mnemonic under the new password.
 *  3. Upload the new backup; only on success update localStorage.
 *
 * The local backup cache is refreshed from the authoritative server copy if it is stale (e.g. the
 * password was changed on another device), so the user's current password keeps working across
 * devices. The mnemonic lives in memory only for the duration of re-encryption and is cleared
 * immediately.
 */
export function ChangeWalletPasswordModal({
  token,
  walletId,
  walletAddress,
  walletLabel,
  onClose,
  onDone,
}: {
  token: string;
  walletId: string;
  walletAddress?: string;
  /** Used as a personal-info penalty when scoring the new password (issue #682). */
  walletLabel?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const errorId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwAssessment, setPwAssessment] = useState<PasswordAssessment | null>(null);
  const [done, setDone] = useState(false);

  // Personal-info inputs fed to the estimator so e.g. the wallet name lowers the score.
  const userInputs = [walletLabel ?? "", user?.email ?? "", user?.username ?? ""];

  // Stale-result guard: discard results from earlier keystrokes (issue #682).
  const assessGenRef = useRef(0);
  useEffect(() => {
    if (!newPassword) { setPwAssessment(null); return; }
    const gen = ++assessGenRef.current;
    assessPassword(newPassword, userInputs)
      .then((r) => { if (assessGenRef.current === gen) setPwAssessment(r); })
      .catch(() => { if (assessGenRef.current === gen) setPwAssessment(null); });
  // userInputs is derived from stable values; include the string join for the dep array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPassword, userInputs.join("\u0000")]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentPassword) {
      setError("Enter your current wallet password.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must differ from the current one.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    // Assess with the shared policy. If the estimator can't load, fail closed: never accept a
    // password we couldn't vet.
    let assessment: PasswordAssessment;
    try {
      assessment = await assessPassword(newPassword, userInputs);
    } catch {
      setError("Couldn't check password strength. Check your connection and try again.");
      return;
    }
    if (!assessment.acceptable) {
      setError("Choose a stronger password. " + (assessment.feedback[0] ?? ""));
      return;
    }
    setBusy(true);
    let mnemonic = "";
    try {
      // Decrypt the current backup via the SDK (local first, refreshed from the server if
      // stale). Throws on wrong password, address mismatch, or if no backup exists anywhere.
      const unlocked = await unlockBackup(token, walletId, currentPassword, walletAddress || undefined);
      mnemonic = unlocked.mnemonic;
      // Re-encrypt under new password.
      const newBackup = await encryptSeed(mnemonic, newPassword);
      const serialized = serializeBackup(newBackup);
      // Server first — only update locally after confirmed.
      const uploaded = await uploadBackup(token, walletId, serialized);
      // Refresh the local cache with the authoritative new copy + its server version.
      saveLocalBackup(walletId, newBackup, uploaded.backup_version ?? serialized);
      setDone(true);
      toast.success("Wallet password changed successfully.");
    } catch (err) {
      setError(errorMessage(err, "Could not change the password."));
    } finally {
      // Wipe the mnemonic and passwords from memory.
      mnemonic = "";
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Modal title="Password changed" onClose={onDone}>
        <div className="text-center">
          <p className="text-3xl text-burgundy-bright">✓</p>
          <p className="mt-2 font-medium text-foreground">Password updated</p>
          <p className="mt-1 text-sm text-muted">
            The new backup is stored on Octo and cached here. Other devices pick it up
            automatically the next time they unlock, so the new password works everywhere.
          </p>
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
    <Modal title="Change wallet password" onClose={onClose}>
      <p className="text-sm text-muted">
        Decrypt your wallet with the current password, then choose a new one. The new backup is
        uploaded before your local copy is updated — if the upload fails, the old password still
        works. On other devices, the cached backup refreshes automatically on the next unlock.
      </p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/*
          Hidden username scoped to this wallet so password managers store wallet passwords
          separately from the account login credential (issue #683).
        */}
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
        <div>
          <label htmlFor={currentPasswordId} className="text-xs text-muted">Current password</label>
          <input
            id={currentPasswordId}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current wallet password"
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={newPasswordId} className="text-xs text-muted">New password</label>
          <input
            id={newPasswordId}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
          <PasswordStrengthMeter id="change-wallet-pw-strength" assessment={newPassword ? pwAssessment : null} />
        </div>
        <div>
          <label htmlFor={confirmPasswordId} className="text-xs text-muted">Confirm new password</label>
          <input
            id={confirmPasswordId}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat the new password"
            autoComplete="new-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Updating…" : "Change password"}
        </button>
      </form>
    </Modal>
  );
}
