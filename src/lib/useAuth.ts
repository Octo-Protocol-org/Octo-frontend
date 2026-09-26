"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken, signOut, me, type User } from "./auth";

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
export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevent multiple concurrent redirects racing each other.
  const signingOut = useRef(false);

  /** Redirect to /login?next=<current path> and wipe local state. */
  function doSignOut(reason?: "expired") {
    if (signingOut.current) return;
    signingOut.current = true;
    signOut();
    setUser(null);
    setToken(null);
    // Encode the current path so the user lands back here after re-login.
    const next = encodeURIComponent(pathname ?? "/dashboard");
    const query = reason === "expired" ? `?next=${next}&reason=expired` : `?next=${next}`;
    router.replace(`/login${query}`);
  }

  useEffect(() => {
    const startedAt = Date.now();
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    me(t)
      .then((u) => {
        setUser(u);
        setToken(t);
      })
      .catch(() => {
        // me() failed — could be a 401 (expired) or network error. Either way, sign out fully.
        doSignOut("expired");
      })
      .finally(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = MIN_LOADING_MS - elapsed;
        if (remaining > 0) {
          setTimeout(() => setLoading(false), remaining);
        } else {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    // Handle 401 from any apiFetch anywhere on the page — apiFetch dispatches this event.
    function onSessionExpired() {
      doSignOut("expired");
    }

    // Sign out when another tab removes the token from storage.
    function onStorage(e: StorageEvent) {
      if (e.key === "octo_token" && e.newValue === null) {
        doSignOut();
      }
    }

    window.addEventListener("session-expired", onSessionExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("session-expired", onSessionExpired);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /** Explicit logout (e.g. sidebar button). */
  function logout() {
    doSignOut();
  }

  return { user, token, loading, logout };
}
