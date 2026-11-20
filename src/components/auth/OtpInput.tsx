"use client";

import { useRef } from "react";

/** Six single-digit boxes acting as one 6-digit code; auto-advances on entry. */
export function OtpInput({
  value,
  onChange,
  disabled,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: "true" | "false";
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function setDigit(i: number, digit: string) {
    const next = digits.slice();
    next[i] = digit;
    onChange(next.join(""));
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of 6`}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          maxLength={1}
          className="h-12 w-10 rounded-lg border border-border bg-surface-sunken text-center text-lg font-semibold text-foreground focus:border-burgundy-bright focus:outline-none disabled:opacity-60"
        />
      ))}
    </div>
  );
}
