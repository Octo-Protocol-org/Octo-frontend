/**
 * Thin client for the octo REST API.
 *
 * All responses use the envelope `{ statusCode, message, data }`. `apiFetch` unwraps `data` on
 * success and throws an `ApiError` carrying the server message on failure.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_OCTO_API_URL ?? "http://localhost:8080";

/** Default request timeout; long-running callers may override it explicitly. */
const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Convert an unknown thrown value into a user-facing message.
 *
 * Prefers the `ApiError` message (already saned by `apiFetch`), falls back to any
 * `Error.message`, and lastly to the caller's `fallback` for non-Error throws.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

type Envelope<T> = {
  statusCode: number;
  message: string;
  data: T;
};

/**
 * Tagged template that URL-encodes every interpolated value, so dynamic path segments can't
 * inject `/`, `..`, `?` or `#` and change the request path.
 */
export function path(
  strings: TemplateStringsArray,
  ...values: Array<string | number>
): string {
  return strings.reduce(
    (acc, str, i) =>
      i === 0 ? str : `${acc}${encodeURIComponent(String(values[i - 1]))}${str}`,
    "",
  );
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const { token, signal: callerSignal, headers, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;

  // Combine caller signal with a hard timeout so hung connections don't spin forever.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal,
      headers: {
        ...(rest.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    // Map timeout/abort to a clear user-facing message.
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError("Request timed out. Check your connection and try again.", 0);
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err; // Let callers handle intentional cancellations.
    }
    throw err;
  }

  // 204 No Content — no body to parse; resolve with undefined.
  if (res.status === 204) {
    return undefined as T;
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // Non-JSON response body.
  }

  if (!res.ok) {
    // On 401 for authenticated requests, broadcast a session-expired event so useAuth can
    // redirect once regardless of how many concurrent requests are in-flight.
    if (res.status === 401 && token) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("session-expired"));
      }
    }

    // The backend's 500 message is a generic "internal server error" with no actionable detail —
    // swap in something a user can actually act on rather than surfacing that verbatim.
    const message =
      res.status >= 500
        ? "Something went wrong on our end. Please try again in a moment."
        : body?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  // Unexpected non-JSON body on a successful response.
  if (body === null) {
    throw new ApiError(
      `Unexpected response from server (status ${res.status}, no JSON body).`,
      res.status,
    );
  }

  return body.data;
}

/** TOTP enrolment payload: the shared secret and an `otpauth://` URL for QR rendering. */
export type TotpSetup = {
  secret: string;
  otpauthUrl: string;
};

/** Begin TOTP enrolment for the authenticated user. */
export function setupTotp(token: string): Promise<TotpSetup> {
  return apiFetch<TotpSetup>("/auth/2fa/setup", { method: "POST", token });
}

/** Confirm enrolment with a code from the authenticator app; returns one-time recovery codes. */
export function verifyTotpEnrolment(
  token: string,
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  return apiFetch<{ recoveryCodes: string[] }>("/auth/2fa/verify", {
    method: "POST",
    token,
    body: JSON.stringify({ code }),
  });
}

/** Fetch the current recovery codes (regenerating them invalidates the previous set). */
export function getRecoveryCodes(token: string): Promise<{ recoveryCodes: string[] }> {
  return apiFetch<{ recoveryCodes: string[] }>("/auth/2fa/recovery-codes", { token });
}

/** Disable TOTP; requires the account password as confirmation. */
export function disableTotp(token: string, password: string): Promise<void> {
  return apiFetch<void>("/auth/2fa/disable", {
    method: "POST",
    token,
    body: JSON.stringify({ password }),
  });
}

/**
 * Complete a login challenge with a TOTP or recovery code.
 *
 * Unauthenticated: the challenge token from the login response stands in for a session token.
 */
export function verifyTotpChallenge(
  challengeToken: string,
  code: string,
): Promise<{ token: string }> {
  return apiFetch<{ token: string }>("/auth/2fa/challenge", {
    method: "POST",
    token: challengeToken,
    body: JSON.stringify({ code }),
  });
}

/** A single active session as returned by the backend. */
export type Session = {
  id: string;
  createdAt: string;
  lastUsedAt?: string;
  userAgent?: string;
  ip?: string;
  current?: boolean;
};

/** List the caller's active sessions. */
export async function listSessions(token: string): Promise<Session[]> {
  const data = await apiFetch<Session[] | { sessions: Session[] }>(path`/sessions`, { token });
  return Array.isArray(data) ? data : data.sessions;
}

/** Revoke a single session by id, signing that device out. */
export async function revokeSession(token: string, id: string): Promise<void> {
  await apiFetch<unknown>(path`/sessions/${id}`, { method: "DELETE", token });
}

/** Revoke every session except the caller's current one. */
export async function revokeOtherSessions(token: string): Promise<void> {
  await apiFetch<unknown>(path`/sessions`, { method: "DELETE", token });
}
