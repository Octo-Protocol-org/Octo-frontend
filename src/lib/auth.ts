/** Auth helpers: signup/login API calls + client-side token storage. */

"use client";

import { apiFetch } from "./api";

const TOKEN_KEY = "octo_token";

export type User = { id: string; email: string; username: string | null };
export type AuthResult = { token: string; user: User };
/** Returned by signup/login when the account still needs OTP verification. */
export type VerificationRequired = { user_id: string; email_verification_required: true };

function needsVerification(x: AuthResult | VerificationRequired): x is VerificationRequired {
  return "email_verification_required" in x;
}
export { needsVerification };

export async function signup(
  email: string,
  password: string,
): Promise<VerificationRequired> {
  return apiFetch<VerificationRequired>("/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** Login now returns a token only once the account is email-verified; otherwise an OTP is sent. */
export async function login(
  email: string,
  password: string,
): Promise<AuthResult | VerificationRequired> {
  return apiFetch<AuthResult | VerificationRequired>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
  return user.username ?? user.email.split("@")[0];
}

// --- token storage (localStorage; bearer-token auth, not cookies) ---

export function saveToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}
