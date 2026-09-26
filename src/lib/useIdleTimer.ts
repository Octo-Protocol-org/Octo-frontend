"use client";

import { useEffect, useRef, useState } from "react";

/** User-input events that reset the idle timer. */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

export type IdleState = "active" | "warning" | "idle";

/**
 * Tracks user inactivity and calls onIdle after `timeoutMs`.
 * Fires onWarn `warnBeforeMs` before the timeout so a lock-screen warning can be shown.
 * Returns the current idle state so callers can render a countdown banner.
 */
export function useIdleTimer({
  timeoutMs,
  warnBeforeMs,
  onWarn,
  onIdle,
  enabled = true,
}: {
  timeoutMs: number;
  warnBeforeMs: number;
  onWarn: () => void;
  onIdle: () => void;
  enabled?: boolean;
}): IdleState {
  const [state, setState] = useState<IdleState>("active");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep latest callbacks in refs — updated inside effects to avoid stale closures in timers.
  const onWarnRef = useRef(onWarn);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onWarnRef.current = onWarn;
  }, [onWarn]);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    function clearTimers() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    }

    function resetTimers() {
      clearTimers();
      setState("active");
      warnTimer.current = setTimeout(() => {
        setState("warning");
        onWarnRef.current();
      }, timeoutMs - warnBeforeMs);
      idleTimer.current = setTimeout(() => {
        setState("idle");
        onIdleRef.current();
      }, timeoutMs);
    }

    resetTimers();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, resetTimers, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetTimers));
    };
  }, [enabled, timeoutMs, warnBeforeMs]);

  return state;
}
