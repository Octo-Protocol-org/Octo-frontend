"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { signup, login, verifyEmail, resendOtp, needsVerification, saveToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { OtpInput } from "./OtpInput";

type Mode = "signup" | "login";
type Step = "credentials" | "verify";

const RESEND_COOLDOWN_SECS = 30;

export function AuthForm({ mode }: { mode: Mode }) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const isSignup = mode === "signup";

  function finish(token: string) {
    saveToken(token);
    // Hard navigation so the dashboard mounts fresh with the token already in
    // localStorage (avoids a client-router race that can bounce back to /login).
    window.location.assign("/dashboard");
  }

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECS);
    const id = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) clearInterval(id);
        return s - 1;
      });
    }, 1000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const result = isSignup ? await signup(email, password) : await login(email, password);
      if (needsVerification(result)) {
        setUserId(result.user_id);
        setStep("verify");
        startCooldown();
      } else {
        finish(result.token);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyEmail(userId, code);
      finish(result.token);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Invalid or expired code.";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  }

  async function onResend() {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await resendOtp(userId);
      startCooldown();
      toast.success("A new code is on its way.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not resend the code.";
      setError(message);
      toast.error(message);
    }
  }

  if (step === "verify") {
    return (
      <div>
        <h1 className="text-center text-3xl font-semibold text-foreground">Check your email</h1>
        <p className="mt-3 text-center text-sm text-muted">
          Enter the 6-digit code we sent to <span className="text-foreground">{email}</span>
        </p>

        <div className="my-7 h-px bg-white/10" />

        <form onSubmit={onVerify} className="space-y-5">
          <OtpInput value={code} onChange={setCode} disabled={loading} />

          {error && (
            <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glass-btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Didn&apos;t get a code?{" "}
          <button
            type="button"
            onClick={onResend}
            disabled={resendCooldown > 0}
            className="font-semibold text-foreground hover:text-burgundy-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-center text-3xl font-semibold text-foreground">
        {isSignup ? "Create a new account" : "Welcome back"}
      </h1>
      <p className="mt-3 text-center text-sm text-muted">
        {isSignup
          ? "Set up your account to start processing stablecoin deposits and payments"
          : "Sign in to your Octo dashboard"}
      </p>

      <div className="my-7 h-px bg-white/10" />

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground">
            Email Address
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 focus-within:border-burgundy-bright">
            <span className="text-muted">✉</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter personal email here"
              autoComplete="email"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Password</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 focus-within:border-burgundy-bright">
            <span className="text-muted"></span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "Create a password (8+ chars)" : "Enter your password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="glass-btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Please wait…" : isSignup ? "Continue" : "Sign in"}
        </button>
      </form>

      <div className="my-7 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-muted">OR</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <p className="text-center text-sm text-muted">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-foreground hover:text-burgundy-bright">
              Login here
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-foreground hover:text-burgundy-bright">
              Sign up here
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
