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

/** Name of the cross-tab channel used to share activity timestamps. */
const CHANNEL_NAME = "octo_activity";
/** localStorage fallback key for the last shared activity timestamp. */
const STORAGE_KEY = "octo_last_activity";
/** Minimum interval between shared activity writes, in milliseconds. */
const THROTTLE_MS = 5000;

/** Message shape broadcast between tabs. */
interface ActivityMessage {
  type: "activity";
  at: number;
}

/**
 * Reads the last shared activity timestamp from localStorage.
 * Returns 0 when unavailable (SSR, private mode, or no value stored).
 */
function readSharedActivity(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

/** Writes the shared activity timestamp to localStorage, ignoring failures. */
function writeSharedActivity(at: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export type IdleState = "active" | "warning" | "idle";

export interface IdleTimerResult {
  /** Current idle state. */
  state: IdleState;
  /** Milliseconds remaining until the idle callback fires. */
  remainingMs: number;
  /** Restart the warn/idle timers and return to the "active" state. */
  reset: () => void;
}

/**
 * Tracks user inactivity and calls onIdle after `timeoutMs`.
 * Fires onWarn `warnBeforeMs` before the timeout so a warning banner can be shown.
 * Returns the current idle state, the remaining time, and a `reset` function so
 * callers can render a live countdown and let the user extend the session.
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
}): IdleTimerResult {
  const [state, setState] = useState<IdleState>("active");
  const [remainingMs, setRemainingMs] = useState(timeoutMs);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number>(0);
  const lastActivityAtRef = useRef<number>(Date.now());
  // Keep latest callbacks in refs — updated inside effects to avoid stale closures in timers.
  const onWarnRef = useRef(onWarn);
  const onIdleRef = useRef(onIdle);
  // Exposed reset function, kept in a ref so the effect can install it.
  const resetRef = useRef<() => void>(() => {});
  // Timestamp of the most recent local activity, and the last time we wrote to the shared store.
  const localActivityRef = useRef<number>(0);
  const lastBroadcastRef = useRef<number>(0);
  // The shared channel instance, kept so reset() can broadcast from outside the effect.
  const channelRef = useRef<BroadcastChannel | null>(null);
  // The latest scheduling function, so shared activity can reschedule timers.
  const scheduleRef = useRef<() => void>(() => {});

  useEffect(() => {
    onWarnRef.current = onWarn;
  }, [onWarn]);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    // Seed local activity from the shared store so a fresh tab doesn't
    // immediately consider itself idle while another tab is active.
    const now = Date.now();
    localActivityRef.current = Math.max(now, readSharedActivity());
    lastBroadcastRef.current = 0;

    function clearTimers() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      idleTimer.current = null;
      warnTimer.current = null;
      countdownTimer.current = null;
    }

    /** Broadcast (throttled) and persist the latest activity timestamp. */
    function broadcastActivity(at: number) {
      if (at - lastBroadcastRef.current < THROTTLE_MS) return;
      lastBroadcastRef.current = at;
      writeSharedActivity(at);
      const channel = channelRef.current;
      if (channel) {
        try {
          const message: ActivityMessage = { type: "activity", at };
          channel.postMessage(message);
        } catch {
          // Ignore post failures (channel closed, etc.).
        }
      }
    }

    /**
     * Schedule warn/idle timers based on the most recent activity across all
     * tabs: max(local activity, shared activity).
     */
    function schedule() {
      clearTimers();
      const lastActivity = Math.max(localActivityRef.current, readSharedActivity());
      const elapsed = Math.max(0, Date.now() - lastActivity);
      const remaining = Math.max(0, timeoutMs - elapsed);
      const warnIn = Math.max(0, remaining - warnBeforeMs);

      lastActivityAtRef.current = lastActivity;
      deadlineRef.current = lastActivity + timeoutMs;
      setRemainingMs(remaining);

      if (remaining <= 0) {
        setState("idle");
        setRemainingMs(0);
        onIdleRef.current();
        return;
      }

      if (elapsed >= timeoutMs - warnBeforeMs) {
        setState("warning");
        onWarnRef.current();
        countdownTimer.current = setInterval(() => {
          setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
        }, 1000);
      } else {
        setState("active");
        warnTimer.current = setTimeout(() => {
          setState("warning");
          onWarnRef.current();
          // Tick roughly once per second while warning is visible.
          countdownTimer.current = setInterval(() => {
            setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
          }, 1000);
        }, warnIn);
      }

      idleTimer.current = setTimeout(() => {
        clearTimers();
        setState("idle");
        setRemainingMs(0);
        onIdleRef.current();
      }, remaining);
    }

    // Timers are throttled/suspended in background tabs and while the machine
    // sleeps, so on resume we reconcile against wall-clock time.
    function checkElapsed() {
      const lastActivity = Math.max(localActivityRef.current, readSharedActivity());
      const elapsed = Math.max(0, Date.now() - lastActivity);
      if (elapsed >= timeoutMs) {
        clearTimers();
        setState("idle");
        setRemainingMs(0);
        onIdleRef.current();
      } else if (elapsed >= timeoutMs - warnBeforeMs) {
        clearTimers();
        setState("warning");
        onWarnRef.current();
        countdownTimer.current = setInterval(() => {
          setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
        }, 1000);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkElapsed();
    }

    /** Record local activity and reschedule from the shared maximum. */
    function handleLocalActivity() {
      const at = Date.now();
      localActivityRef.current = at;
      broadcastActivity(at);
      schedule();
    }

    /** Reset from an explicit user action (e.g. "Stay signed in"). */
    function resetTimers() {
      const at = Date.now();
      localActivityRef.current = at;
      // Force a broadcast so every tab resets, regardless of throttle.
      lastBroadcastRef.current = 0;
      broadcastActivity(at);
      schedule();
    }

    // Set up the cross-tab channel (with localStorage fallback).
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = channel;
        channel.onmessage = (event: MessageEvent<ActivityMessage>) => {
          const data = event.data;
          if (!data || data.type !== "activity" || typeof data.at !== "number") return;
          if (data.at > localActivityRef.current) {
            localActivityRef.current = data.at;
          }
          schedule();
        };
      } catch {
        channel = null;
        channelRef.current = null;
      }
    }

    // Fallback: react to localStorage writes from other tabs.
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const at = Number(event.newValue);
      if (!Number.isFinite(at)) return;
      if (at > localActivityRef.current) {
        localActivityRef.current = at;
      }
      schedule();
    }
    window.addEventListener("storage", handleStorage);

    resetRef.current = resetTimers;
    scheduleRef.current = schedule;
    schedule();
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleLocalActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkElapsed);
    window.addEventListener("pageshow", checkElapsed);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleLocalActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkElapsed);
      window.removeEventListener("pageshow", checkElapsed);
      window.removeEventListener("storage", handleStorage);
      if (channel) {
        channel.onmessage = null;
        try {
          channel.close();
        } catch {
          // Ignore close failures.
        }
      }
      channelRef.current = null;
      scheduleRef.current = () => {};
    };
  }, [enabled, timeoutMs, warnBeforeMs]);

  return {
    state,
    remainingMs,
    reset: () => resetRef.current(),
  };
}
