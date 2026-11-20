"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Copy-to-clipboard button; swaps to a checkmark for a moment after a successful copy.
export function CopyButton({
  value,
  label = "Copy",
  className = "text-muted hover:text-foreground",
  sensitive = false,
}: {
  value: string;
  label?: string;
  className?: string;
  /** Best-effort: clear the clipboard 60s after copying (cannot remove OS clipboard-history entries). */
  sensitive?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<string | null>(null);

  async function clearClipboard(v: string) {
    try {
      let matches = true;
      try {
        matches = (await navigator.clipboard.readText()) === v;
      } catch {
        // Reading not permitted: overwrite anyway.
      }
      if (matches) await navigator.clipboard.writeText("");
    } catch {
      // Best effort only.
    }
  }

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (pendingValue.current !== null) void clearClipboard(pendingValue.current);
    },
    [],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      if (sensitive) {
        if (clearTimer.current) clearTimeout(clearTimer.current);
        pendingValue.current = value;
        clearTimer.current = setTimeout(() => {
          const v = pendingValue.current;
          pendingValue.current = null;
          clearTimer.current = null;
          if (v !== null) void clearClipboard(v);
        }, 60_000);
        toast.success("Copied. The clipboard will be cleared in 60s.");
      }
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
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
        <span className="inline-flex items-center gap-1 text-success">
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
