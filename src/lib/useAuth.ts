"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken, me, type User } from "./auth";
import { clearLocalBackups } from "./sdk";

/** The page loading spinner shows for at least this long, even if auth resolves faster —
 * otherwise on a fast connection it flashes for a frame and the animation never registers. */
const MIN_LOADING_MS = 700;

/** Guard a page: ensures a valid token, returns the user (or null while loading). */
export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startedAt = useRef(Date.now());

  useEffect(() => {
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
        clearToken();
        router.replace("/login");
      })
      .finally(() => {
        const elapsed = Date.now() - startedAt.current;
        const remaining = MIN_LOADING_MS - elapsed;
        if (remaining > 0) {
          setTimeout(() => setLoading(false), remaining);
        } else {
          setLoading(false);
        }
      });
  }, [router]);

  function logout() {
    clearToken();
    // Remove the locally-cached encrypted key backups; a new login re-fetches from the server.
    clearLocalBackups();
    router.replace("/login");
  }

  return { user, token, loading, logout };
}
