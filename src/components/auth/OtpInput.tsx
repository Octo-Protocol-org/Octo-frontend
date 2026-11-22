"use client";

import { useRef } from "react";

const CODE_LENGTH = 6;

/**
 * Six single-digit boxes acting as one 6-digit code.
 *
 * Invariants:
 * - A digit is always placed in the box that was focused at the moment of typing; it never
 *   jumps to an earlier empty box.
 * - Focusing a box past the first empty one redirects focus to that empty box so the user
 *   can't accidentally skip over gaps.
 * - Arrow keys and Home/End move focus between boxes without changing the value.
 * - Delete clears the focused box and keeps focus there; Backspace clears it and moves left.
 */
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

  // The value is always a string of up to CODE_LENGTH digits; pad to a fixed-length array.
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  function focusAt(i: number) {
    inputs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();
  }

  function handleFocus(i: number) {
    // Redirect focus to the first empty box so users can't skip gaps.
    const firstEmpty = digits.findIndex((d) => d === "");
    if (firstEmpty !== -1 && i > firstEmpty) {
      focusAt(firstEmpty);
    }
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    const next = digits.slice();
    next[i] = digit;
    onChange(next.join(""));
    if (i < CODE_LENGTH - 1) focusAt(i + 1);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowLeft" || e.key === "Backspace") {
      if (e.key === "Backspace") {
        // Clear this box; if already empty, move left and clear that one.
        if (digits[i]) {
          e.preventDefault();
          const next = digits.slice();
          next[i] = "";
          onChange(next.join(""));
        } else if (i > 0) {
          e.preventDefault();
          const next = digits.slice();
          next[i - 1] = "";
          onChange(next.join(""));
          focusAt(i - 1);
        }
      } else {
        e.preventDefault();
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAt(CODE_LENGTH - 1);
    } else if (e.key === "Delete") {
      e.preventDefault();
      if (digits[i]) {
        const next = digits.slice();
        next[i] = "";
        onChange(next.join(""));
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focusAt(Math.min(pasted.length, CODE_LENGTH - 1));
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
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => handleFocus(i)}
          onPaste={handlePaste}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          maxLength={1}
          className="h-12 w-10 rounded-lg border border-border bg-surface-sunken text-center text-lg font-semibold text-foreground focus:border-burgundy-bright focus:outline-none disabled:opacity-60"
        />
      ))}
    </div>
  );
}
