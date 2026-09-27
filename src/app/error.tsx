"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep diagnostics in the server/client logs without exposing them to users.
    console.error("Unhandled application error", { digest: "redacted" });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface-raised p-8 shadow-xl">
        <p className="font-display text-5xl text-burgundy-bright">Octo</p>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Octo could not finish loading this page. Your wallet and keys are safe. Try again or return home.
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
            href="/"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:border-border-strong"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
