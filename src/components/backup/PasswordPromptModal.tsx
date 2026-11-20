"use client";

import { useState } from "react";
import { Modal } from "@/components/dashboard/Modal";

/** Masked wallet-password prompt (replaces window.prompt). The password is cleared from state
 * as soon as the submit handler settles. */
export function PasswordPromptModal({
  title,
  description,
  submitLabel = "Confirm",
  onSubmit,
  onClose,
}: {
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Enter your wallet password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the password.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {description && <p className="text-sm text-muted">{description}</p>}
        <input
          type="password"
          autoComplete="off"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Wallet password"
          className="mt-4 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground"
        />
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-500">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg glass-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Checking…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
