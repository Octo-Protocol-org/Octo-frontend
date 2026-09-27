"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep diagnostics in the client logs without exposing error details in the UI.
    console.error("Dashboard render error", { digest: "redacted" });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface-raised p-8 shadow-xl">
        <p className="font-display text-5xl text-burgundy-bright">Octo</p>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Your dashboard needs a refresh</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          We could not load this wallet view. No wallet keys or sensitive details are shown here.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="rounded-full glass-btn-primary px-5 py-2.5 text-sm font-semibold"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:border-border-strong"
          >
            Back to My Wallets
          </Link>
        </div>
      </div>
    </main>
  );
}
