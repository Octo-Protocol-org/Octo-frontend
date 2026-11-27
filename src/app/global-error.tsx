"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const digest = error.digest;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    // The digest is an opaque hash for correlating with server logs; it holds no message or stack.
    console.error("Global application error", { digest: error.digest });
  }, [error.digest]);

  // global-error replaces the root layout, so it can't rely on Tailwind or the app toaster;
  // copy is a best-effort inline action instead of the shared CopyButton.
  async function copyRef() {
    if (!digest) return;
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Best effort; the reference stays selectable so the user can copy it manually.
    }
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#100c0e", color: "#fff", fontFamily: "Arial, sans-serif" }}>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "24px", textAlign: "center" }}>
          <section style={{ maxWidth: "480px" }}>
            <p style={{ color: "#e89aaf", fontSize: "48px", fontWeight: 700, margin: 0 }}>Octo</p>
            <h1 style={{ fontSize: "28px", margin: "24px 0 12px" }}>Something went wrong</h1>
            <p style={{ color: "#c7bfc2", lineHeight: 1.6, margin: 0 }}>
              Octo could not load this page. Please try again.
            </p>
            {digest && (
              <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px", color: "#c7bfc2" }}>
                <span>Reference:</span>
                <code style={{ fontFamily: "monospace", color: "#fff", wordBreak: "break-all" }}>{digest}</code>
                <button
                  type="button"
                  onClick={copyRef}
                  style={{ background: "transparent", border: "1px solid #6b5b60", borderRadius: "999px", color: "#fff", cursor: "pointer", padding: "4px 12px", fontSize: "12px" }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={reset}
              style={{ background: "#9f2448", border: 0, borderRadius: "999px", color: "#fff", cursor: "pointer", fontWeight: 700, marginTop: "28px", padding: "12px 20px" }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
