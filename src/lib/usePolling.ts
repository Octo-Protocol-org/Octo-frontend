"use client";

import { useEffect, useRef } from "react";

/**
 * Polls `fn` every `ms` milliseconds.
 * - Pauses while the tab is hidden (document.visibilityState !== "visible").
 * - Skips a tick when the previous call is still in flight, preventing overlapping requests.
 * - Ignores stale responses: if the effect re-runs (deps changed) any in-flight call's result
 *   is silently discarded via an AbortController signal passed to `fn`.
 */
export function usePolling(
  fn: (signal: AbortSignal) => Promise<void>,
  ms: number,
): void {
  // Keep a stable ref so the interval callback always sees the latest `fn` without re-starting.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;

    async function tick() {
      // Pause on hidden tabs to avoid wasting API capacity.
      if (document.visibilityState !== "visible") return;
      // Skip if the previous call hasn't finished yet.
      if (inFlight) return;
      inFlight = true;
      try {
        await fnRef.current(controller.signal);
      } finally {
        inFlight = false;
      }
    }

    const id = setInterval(tick, ms);
    return () => {
      clearInterval(id);
      // Cancel any in-flight request so its response is never applied after unmount/re-run.
      controller.abort();
    };
  }, [ms]);
}
