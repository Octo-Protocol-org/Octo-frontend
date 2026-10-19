"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { changePassword, MIN_ACCOUNT_PASSWORD_LENGTH } from "@/lib/passwordApi";
import { assessPassword, MIN_PASSWORD_SCORE } from "@/lib/passwordStrength";
import { PasswordStrengthMeter } from "@/lib/passwordStrength";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none";

export function ChangePasswordForm({ token }: { token: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_ACCOUNT_PASSWORD_LENGTH} characters.`);
      return;
    }
    if ((await assessPassword(next)).score < MIN_PASSWORD_SCORE) {
      setError("New password is too weak. Choose a stronger password.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await changePassword(token, current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed.");
    } catch (err) {
      setError(errorMessage(err, "Failed to change password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-2xl">
      <h2 className="text-2xl font-semibold text-foreground">Password</h2>
      <p className="mt-1 text-sm text-muted">
        Change your account password. This does not affect your wallet encryption password. Other
        signed-in sessions may be signed out if the server supports it.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-5 rounded-2xl border border-border bg-burgundy-soft/30 p-6"
      >
        <label className="block text-sm font-medium text-foreground">
          Current password
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          New password
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
          
        </label>
        <label className="block text-sm font-medium text-foreground">
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        {error && (
          <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !current || !next || !confirm}
          className="rounded-xl glass-btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
