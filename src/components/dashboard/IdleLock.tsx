"use client";

import { useState } from "react";
import { useIdleTimer } from "@/lib/useIdleTimer";

/** 15 minutes of inactivity locks the session; warn 1 minute before. */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARN_BEFORE_MS = 60 * 1000;

/** Shared idle auto-lock: tracks inactivity, shows a warning banner, then logs out.
 *  The banner is announced to assistive technology via aria-live. */
export function IdleLock({ onLogout }: { onLogout: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  const idleState = useIdleTimer({
    timeoutMs: IDLE_TIMEOUT_MS,
    warnBeforeMs: WARN_BEFORE_MS,
    // Reset the dismissed flag whenever the user becomes active again.
    onWarn: () => setDismissed(false),
    onIdle: onLogout,
  });

  return (
    <>
      {/* idle-warning banner: shown for 1 minute before auto-lock, announced to AT */}
      {idleState === "warning" && !dismissed && (
        <div
          className="relative z-10 flex items-center justify-center gap-4 bg-amber-500/20 py-2 text-center text-xs text-amber-300"
          role="alert"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>Your session will lock in 1 minute due to inactivity.</span>
          <button
            onClick={() => setDismissed(true)}
            className="font-semibold underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
