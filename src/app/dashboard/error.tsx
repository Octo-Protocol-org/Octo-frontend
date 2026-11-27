"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CopyButton } from "@/components/CopyButton";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const digest = error.digest;
  useEffect(() => {
    // The digest is an opaque hash for correlating with server logs; it holds no message or stack.
    console.error("Dashboard render error", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface-raised p-8 shadow-xl">
        <p className="font-display text-5xl text-burgundy-bright">Octo</p>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Your dashboard needs a refresh</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          We could not load this wallet view. No wallet keys or sensitive details are shown here.
        </p>
        {digest && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
            <span>Reference:</span>
            <code className="break-all font-mono text-foreground">{digest}</code>
            <CopyButton value={digest} label="Copy reference" />
          </div>
        )}
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
