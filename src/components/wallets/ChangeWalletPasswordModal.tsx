"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/dashboard/Modal";
import {
  encryptSeed,
  decryptSeed,
  serializeBackup,
  uploadBackup,
  saveLocalBackup,
  loadLocalBackup,
  getBackup,
  parseBackup,
} from "@/lib/sdk";
import { assessPassword, MIN_PASSWORD_LENGTH } from "@/lib/passwordStrength";

/**
 * Change the wallet's encryption password:
 *  1. Decrypt the backup with the current password (proves ownership).
 *  2. Re-encrypt the mnemonic under the new password.
 *  3. Upload the new backup; only on success update localStorage.
 * The mnemonic lives in memory only for the duration of step 2 and is cleared immediately.
 */
export function ChangeWalletPasswordModal({
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwFeedback, setPwFeedback] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  async function handlePasswordChange(value: string) {
    setNewPassword(value);
    if (!value) { setPwFeedback([]); return; }
    try {
      const result = await assessPassword(value);
      setPwFeedback(result.feedback);
    } catch { setPwFeedback([]); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentPassword) {
      setError("Enter your current wallet password.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must differ from the current one.");
      return;
    }
    const assessment = await assessPassword(newPassword).catch(() => null);
    if (assessment && !assessment.acceptable) {
      setError("Choose a stronger password. " + (assessment.feedback[0] ?? ""));
      return;
    }
    setBusy(true);
    let mnemonic = "";
    try {
      // Load backup (local preferred, then server).
      let backup = loadLocalBackup(walletId);
      if (!backup) {
        const remote = await getBackup(token, walletId);
        if (!remote.encrypted_backup) {
          throw new Error("No backup found for this wallet. Recover it with your recovery phrase first.");
        }
        backup = parseBackup(remote.encrypted_backup);
      }
      // Decrypt with current password — throws on wrong password.
      mnemonic = await decryptSeed(backup, currentPassword);
      // Re-encrypt under new password.
      const newBackup = await encryptSeed(mnemonic, newPassword);
      const serialized = serializeBackup(newBackup);
      // Server first — only update locally after confirmed.
      await uploadBackup(token, walletId, serialized);
      saveLocalBackup(walletId, newBackup);
      setDone(true);
      toast.success("Wallet password changed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
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
            Only the new password unlocks this wallet on every device.
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
        works.
      </p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="text-xs text-muted">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current wallet password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
          {pwFeedback.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {pwFeedback.map((f, i) => <li key={i}>· {f}</li>)}
            </ul>
          )}
        </div>
        <div>
          <label className="text-xs text-muted">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat the new password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-burgundy-bright focus:outline-none"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
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
