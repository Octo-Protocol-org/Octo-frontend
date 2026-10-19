"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, errorMessage } from "@/lib/api";
import { requestPasswordReset, resetPassword, MIN_ACCOUNT_PASSWORD_LENGTH } from "@/lib/passwordApi";
import { assessPassword, MIN_PASSWORD_SCORE } from "@/lib/passwordStrength";
import { PasswordStrengthMeter } from "@/lib/passwordStrength";
import { OtpInput } from "./OtpInput";

type Step = "email" | "code" | "password" | "done";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none";
const buttonClass =
  "glass-btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
    } catch (err) {
      // Only surface non-client errors so the flow never reveals whether the email is registered.
      if (!(err instanceof ApiError) || err.status >= 500) {
        setError(errorMessage(err, "Something went wrong."));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setStep("code");
  }

  function onCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(null);
    setStep("password");
  }

  // Sends a fresh code. The 30 s cooldown matches the signup resend button.
  async function onResend() {
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setCooldown(30);
    } catch (err) {
      setError(errorMessage(err, "Could not resend the code."));
    }
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_ACCOUNT_PASSWORD_LENGTH} characters.`);
      return;
    }
    if ((await assessPassword(password, [email])).score < MIN_PASSWORD_SCORE) {
      setError("Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(email.trim(), code, password);
      setStep("done");
    } catch (err) {
      setError(errorMessage(err, "Could not reset password."));
      // An invalid or expired code is fixed on the code step.
      if (err instanceof ApiError && err.status < 500) setStep("code");
    } finally {
      setBusy(false);
    }
  }

  const errorBox = error && (
    <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
      {error}
    </p>
  );

  if (step === "done") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Password updated</h1>
        <p className="text-sm text-muted">You can now sign in with your new password.</p>
        <Link href="/login" className={`${buttonClass} block`}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">
          This resets your account password only. Your wallet encryption password is unaffected and
          cannot be reset.
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={onEmail} className="space-y-4">
          <label className="text-sm font-medium text-foreground">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>
          {errorBox}
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Please wait…" : "Send reset code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={onCode} className="space-y-4">
          <p className="text-sm text-muted">
            If an account exists for that email, we sent a 6-digit code to it.
          </p>
          <OtpInput value={code} onChange={setCode} />
          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0}
            className="text-sm font-medium text-burgundy-bright hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          {errorBox}
          <button type="submit" className={buttonClass}>
            Continue
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={onPassword} className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          {errorBox}
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Please wait…" : "Reset password"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-foreground hover:text-burgundy-bright">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
