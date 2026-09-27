"use client";

import { useEffect } from "react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep global diagnostics out of the rendered error page.
    console.error("Global application error", { digest: "redacted" });
  }, []);

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
