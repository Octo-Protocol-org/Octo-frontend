"use client";

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { ApiError, errorMessage } from "./api";
import {
  getToken,
  signOut,
  me,
  broadcastLogout,
  subscribeToLogout,
  type User,
} from "./auth";

/** The page loading spinner shows for at least this long, even if auth resolves faster —
 * otherwise on a fast connection it flashes for a frame and the animation never registers. */
const MIN_LOADING_MS = 700;

/**
 * Guard a page: ensures a valid token, returns the user (or null while loading).
 *
 * Handles three sign-out triggers in one place:
 *  1. Explicit logout() call (e.g. sidebar button).
 *  2. 401 from any apiFetch → "session-expired" CustomEvent.
 *  3. Another tab removing octo_token → storage event.
 */
function useAuthSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  // Prevent multiple concurrent redirects racing each other.
  const signingOut = useRef(false);

  /** Redirect to /login?next=<current path> and wipe local state. */
  function doSignOut(reason?: "expired") {
    if (signingOut.current) return;
    signingOut.current = true;
    signOut();
    // Notify other tabs so they sign out too (storage event is a fallback).
    broadcastLogout();
    setUser(null);
    setToken(null);
    // Encode the current path so the user lands back here after re-login.
    const next = encodeURIComponent(pathname ?? "/dashboard");
    const query = reason === "expired" ? `?next=${next}&reason=expired` : `?next=${next}`;
    router.replace(`/login${query}`);
  }

  function retrySessionCheck() {
    setAuthError(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  }

  // The effects below read the latest sign-out and retry functions through refs, so each
  // effect only re-runs when its own inputs change.
  const signOutRef = useRef(doSignOut);
  signOutRef.current = doSignOut;
  const retryRef = useRef(retrySessionCheck);
  retryRef.current = retrySessionCheck;

  useEffect(() => {
    const startedAt = Date.now();
    let active = true;
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setAuthError(null);
    me(t)
      .then((u) => {
        if (!active) return;
        setUser(u);
        setToken(t);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isAuthenticationFailure(err)) {
          signOutRef.current("expired");
          return;
        }
        const message =
          errorMessage(err, "We could not verify your session. Check your connection and try again.");
        setAuthError(message);
        toast.error(message, {
          action: { label: "Retry", onClick: () => retryRef.current() },
        });
      })
      .finally(() => {
        if (!active) return;
        const elapsed = Date.now() - startedAt;
        const remaining = MIN_LOADING_MS - elapsed;
        if (remaining > 0) {
          setTimeout(() => setLoading(false), remaining);
        } else {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router, retryNonce]);

  useEffect(() => {
    // Handle 401 from any apiFetch anywhere on the page — apiFetch dispatches this event.
    function onSessionExpired() {
      signOutRef.current("expired");
    }

    // Sign out when another tab removes the token from storage.
    function onStorage(e: StorageEvent) {
      if (e.key === "octo_token" && e.newValue === null) {
        signOutRef.current();
      }
    }

    // Sign out when another tab broadcasts a logout over BroadcastChannel.
    const unsubscribeLogout = subscribeToLogout(() => {
      signOutRef.current();
    });

    window.addEventListener("session-expired", onSessionExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribeLogout();
      window.removeEventListener("session-expired", onSessionExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  /** Explicit logout (e.g. sidebar button). */
  function logout() {
    doSignOut();
  }

  return { user, token, loading, authError, retrySessionCheck, logout };
}

type AuthSession = ReturnType<typeof useAuthSession>;

const AuthContext = createContext<AuthSession | null>(null);

/**
 * Runs the session check once for the dashboard. Mounted in the dashboard layout, so
 * navigating between pages reuses the result instead of calling `me()` again.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  return createElement(AuthContext.Provider, { value: session }, children);
}

/** The shared session from AuthProvider. Dashboard pages always render inside it. */
export function useAuth(): AuthSession {
  const session = useContext(AuthContext);
  if (!session) throw new Error("useAuth must be used inside AuthProvider");
  return session;
}

export function isAuthenticationFailure(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}
