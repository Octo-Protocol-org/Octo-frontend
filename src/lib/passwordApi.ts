/** Account-password API calls (reset + change). Endpoints are assumed; see the PR description. */

import { apiFetch } from "./api";

/** Same rule as signup. */
export const MIN_ACCOUNT_PASSWORD_LENGTH = 8;

/** Emails a reset code. The backend should answer generically whether or not the email exists. */
export function requestPasswordReset(email: string) {
  return apiFetch<{ sent: boolean }>("/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, code: string, newPassword: string) {
  return apiFetch<{ reset: boolean }>("/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
}

export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return apiFetch<{ changed: boolean }>("/v1/auth/change-password", {
    method: "POST",
    token,
    // A wrong current password commonly answers 401; that must not sign the user out.
    authFailureSignsOut: false,
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}