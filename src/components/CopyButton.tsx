"use client";

import { useState } from "react";

// Copy-to-clipboard button; swaps to a checkmark for a moment after a successful copy.
export function CopyButton({
  value,
  label = "Copy",
  className = "text-muted hover:text-foreground",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 transition-colors ${className}`}
      title={copied ? "Copied!" : label}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckIcon /> Copied
        </span>
      ) : (
        <CopyIcon />
      )}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12.5 9 17.5 20 6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
