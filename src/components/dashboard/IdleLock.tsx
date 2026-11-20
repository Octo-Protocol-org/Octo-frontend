"use client";

import { useEffect, useRef } from "react";
import { useIdleTimer } from "@/lib/useIdleTimer";
import { formatCountdownSeconds } from "@/lib/format";

/** 15 minutes of inactivity signs the user out; warn 1 minute before. */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARN_BEFORE_MS = 60 * 1000;

/** Shared idle auto-logout: tracks inactivity, shows a warning banner with a
 *  live countdown, then signs the user out. The banner is announced to
 *  assistive technology via aria-live, but only at the 60s and 10s thresholds
 *  so it is not re-announced every second. */
export function IdleLock({ onLogout }: { onLogout: () => void }) {
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  // The hook coordinates activity across tabs (shared last-activity record),
  // so every tab enters the warning state together and `reset` broadcasts a
  // "stay signed in" to all of them.
  const { state: idleState, remainingSeconds, reset } = useIdleTimer({
    timeoutMs: IDLE_TIMEOUT_MS,
    warnBeforeMs: WARN_BEFORE_MS,
    onIdle: onLogout,
  });

  const isWarning = idleState === "warning";

  // Move focus to the "Stay signed in" button when the warning appears so
  // keyboard and screen-reader users can reach it.
  useEffect(() => {
    if (isWarning) {
      stayButtonRef.current?.focus();
    }
  }, [isWarning]);

  // Announce only at the 60s and 10s thresholds; the per-second counter is
  // rendered aria-hidden so it is not re-announced every second.
  const announce =
    isWarning && (remainingSeconds === 60 || remainingSeconds === 10)
      ? `You'll be signed out in ${formatCountdownSeconds(remainingSeconds)} due to inactivity.`
      : "";

  return (
    <>
      {/* idle-warning banner: shown for 1 minute before auto-logout, announced to AT */}
      {isWarning && (
        <div
          className="relative z-10 flex items-center justify-center gap-4 bg-amber-500/20 py-2 text-center text-xs text-amber-300"
          role="alertdialog"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Inactivity warning"
        >
          <span>
            You&apos;ll be signed out in{" "}
            <span aria-hidden="true">{formatCountdownSeconds(remainingSeconds)}</span> due to
            inactivity.
          </span>
          <span className="sr-only">{announce}</span>
          <button
            ref={stayButtonRef}
            onClick={reset}
            className="font-semibold underline hover:no-underline"
          >
            Stay signed in
          </button>
        </div>
      )}
    </>
  );
}