/** Auth helpers: signup/login API calls + client-side token storage. */

"use client";

import { apiFetch } from "./api";
import { clearLocalBackups } from "./sdk/store";

const TOKEN_KEY = "octo_token";

export type User = { id: string; email: string; username: string | null };
export type AuthResult = { token: string; user: User };
/** Returned by signup/login when the account still needs OTP verification. */
export type VerificationRequired = { user_id: string; email_verification_required: true };
/** Returned by login when the account has 2FA enabled; complete it via verify2fa(). */
export type TwoFactorRequired = { two_factor_required: true; challenge_id: string };

function needsVerification(x: AuthResult | VerificationRequired): x is VerificationRequired {
  return "email_verification_required" in x;
}
export { needsVerification };

function needsTwoFactor(x: AuthResult | TwoFactorRequired): x is TwoFactorRequired {
  return "two_factor_required" in x;
}
export { needsTwoFactor };

export async function signup(
  email: string,
  password: string,
): Promise<VerificationRequired> {
  return apiFetch<VerificationRequired>("/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** Login now returns a token only once the account is email-verified; otherwise an OTP is sent.
 * If 2FA is enabled, returns a challenge id to complete via verify2fa(). */
export async function login(
  email: string,
  password: string,
): Promise<AuthResult | VerificationRequired | TwoFactorRequired> {
  return apiFetch<AuthResult | VerificationRequired | TwoFactorRequired>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** Complete a 2FA login challenge: the challenge id is sent as the bearer token. */
export async function verify2fa(challengeId: string, code: string): Promise<AuthResult> {
  return apiFetch<AuthResult>("/auth/2fa/challenge", {
    method: "POST",
    token: challengeId,
    body: JSON.stringify({ code }),
  });
}

export async function verifyEmail(userId: string, code: string): Promise<AuthResult> {
  return apiFetch<AuthResult>("/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, code }),
  });
}

export async function resendOtp(userId: string): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>("/v1/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function me(token: string): Promise<User> {
  return apiFetch<User>("/v1/auth/me", { token });
}

/**
 * Revoke the current session on the server so the bearer token stops working immediately.
 * Fire-and-forget friendly: never throws, and accepts `keepalive` so the request can outlive
 * a page unload/redirect. Callers should not await this before clearing local state.
 */
export async function logoutCurrentSession(
  token: string,
  opts: { keepalive?: boolean } = {},
): Promise<void> {
  try {
    await apiFetch<void>("/v1/sessions/current", {
      method: "DELETE",
      token,
      keepalive: opts.keepalive,
    });
  } catch {
    // Best-effort: sign-out must still complete locally if the server call fails.
  }
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Set the signed-in user's display username (3–20 chars, letters/digits/underscore/hyphen). */
export async function updateUsername(token: string, username: string): Promise<User> {
  return apiFetch<User>("/v1/auth/me", {
    method: "PATCH",
    token,
    body: JSON.stringify({ username }),
  });
}

/** What to show for a user when no full profile page makes sense — falls back to the email
 * handle until they set a username. */
export function displayName(user: Pick<User, "email" | "username">): string {
  return user.username ?? user.email.split("@")[0] ?? user.email;
}

// --- token storage (localStorage; bearer-token auth, not cookies) ---

export function saveToken(token: string) {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage is optional; in-memory auth state is still cleared by the caller.
  }
}

/**
 * Single sign-out helper: clears all local key backups then removes the session token.
 * Removing TOKEN_KEY fires a storage event that other tabs use to sign out in lock-step.
 * Always call this instead of clearToken() directly.
 *
 * This only clears local state; callers that want the server-side session revoked should
 * fire logoutCurrentSession(token, { keepalive: true }) before calling this.
 */
export function signOut() {
  if (typeof window === "undefined") return;
  try {
    clearLocalBackups();
  } finally {
    clearToken();
  }
}

/** The localStorage key watched by the cross-tab storage listener in useAuth. */
export { TOKEN_KEY };

// --- cross-tab logout (BroadcastChannel; storage event stays as fallback) ---

/** Channel used to broadcast logout to other tabs. */
export const LOGOUT_CHANNEL = "octo_logout";

type LogoutMessage = { type: "logout" };

function getLogoutChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(LOGOUT_CHANNEL);
  } catch {
    return null;
  }
}

/** Notify other tabs that this tab signed out. No-op where BroadcastChannel is unavailable. */
export function broadcastLogout() {
  const channel = getLogoutChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: "logout" } satisfies LogoutMessage);
  } catch {
    // Best-effort; the storage event fallback still covers other tabs.
  } finally {
    channel.close();
  }
}

/** Run `cb` when another tab broadcasts a logout. Returns an unsubscribe function. */
export function subscribeToLogout(cb: () => void): () => void {
  const channel = getLogoutChannel();
  if (!channel) return () => {};
  const handler = (event: MessageEvent) => {
    const data = event.data as LogoutMessage | null;
    if (data && data.type === "logout") cb();
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };
}
