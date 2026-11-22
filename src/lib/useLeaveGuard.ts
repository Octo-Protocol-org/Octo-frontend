"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SENTINEL = "__octoLeaveGuard";

/**
 * Warns before the user leaves a page holding unrecoverable, unsaved state (e.g. a one-time
 * recovery phrase). Covers reload/close (native prompt), the browser Back button and in-app
 * navigation (styled confirmation via `pending` / `confirmLeave` / `cancelLeave`).
 */
export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<(() => void) | null>(null);
  // Set once the user confirms, so the leave action itself isn't intercepted again.
  const bypass = useRef(false);
  // True while we're programmatically popping the sentinel so the popstate handler ignores it.
  const removingSentinel = useRef(false);

  useEffect(() => {
    if (!active) {
      // Guard released without leaving: strip the sentinel entry so Back works in one press.
      if (window.history.state?.[SENTINEL]) {
        removingSentinel.current = true;
        window.history.back();
      }
      return;
    }
    bypass.current = false;

    // Reload / tab close / external navigation: browsers only allow their own generic prompt.
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    // Back button: a marked duplicate of this entry absorbs the first Back so we can ask first.
    function pushSentinel() {
      if (window.history.state?.[SENTINEL]) return;
      window.history.pushState(
        { ...window.history.state, [SENTINEL]: true },
        "",
        window.location.href,
      );
    }
    pushSentinel();
    function onPopState(e: PopStateEvent) {
      // Ignore the programmatic pop triggered by sentinel removal.
      if (removingSentinel.current) {
        removingSentinel.current = false;
        return;
      }
      if (bypass.current) return;
      // Capture phase runs before Next's router listener, so it never sees this pop.
      e.stopImmediatePropagation();
      pushSentinel();
      // If the sentinel is now the current entry the user backed into the guard entry itself,
      // so we need go(-2) to actually leave; otherwise go(-1) is correct.
      const needsExtraStep = Boolean(window.history.state?.[SENTINEL]);
      setPending(() => () => window.history.go(needsExtraStep ? -2 : -1));
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState, true);
    };
  }, [active]);

  /** Runs `leave` now, or defers it behind the confirmation while the guard is active. */
  const guard = useCallback(
    (leave: () => void) => {
      if (!active || bypass.current) leave();
      else setPending(() => leave);
    },
    [active],
  );

  /** For `<Link onNavigate>`: returns true (caller should `preventDefault`) when blocked. */
  const blockNavigation = useCallback(
    (href: string) => {
      if (!active || bypass.current) return false;
      setPending(() => () => router.push(href));
      return true;
    },
    [active, router],
  );

  const confirmLeave = useCallback(() => {
    bypass.current = true;
    setPending(null);
    pending?.();
  }, [pending]);

  const cancelLeave = useCallback(() => setPending(null), []);

  return {
    guard,
    blockNavigation,
    pending: pending !== null,
    confirmLeave,
    cancelLeave,
  };
}
