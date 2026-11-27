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
/** The message of an error, or null when the value is not an Error. For callers that choose their own fallback. */
export function errorText(err: unknown): string | null {
  return err instanceof Error ? err.message : null;
}

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

/** True when a path has a `.`/`..` segment (raw or %2E-encoded), which URL parsing would resolve away. */
export function hasDotSegment(requestPath: string): boolean {
  const pathname = requestPath.split(/[?#]/, 1)[0] ?? "";
  return pathname.split("/").some((seg) => /^(\.|%2e){1,2}$/i.test(seg));
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & {
    token?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    /**
     * Whether a 401 on this authenticated request means the session has expired.
     *
     * Defaults to `true`. Pass `false` for endpoints that verify a secret as part of the
     * request (e.g. `changePassword`, `disableTotp`): a wrong secret commonly answers 401,
     * and treating that as expiry would sign the user out and wipe local backups.
     */
    authFailureSignsOut?: boolean;
  } = {},
): Promise<T> {
  // An id like `..` would otherwise re-target the request at a different endpoint.
  if (hasDotSegment(path)) throw new ApiError("Invalid request path.", 400);
  const {
    token,
    signal: callerSignal,
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    authFailureSignsOut = true,
    ...rest
  } = options;

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
    // redirect once regardless of how many concurrent requests are in-flight. Callers that
    // verify a secret opt out, since a wrong secret also answers 401.
    if (res.status === 401 && token && authFailureSignsOut) {
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
    authFailureSignsOut: false,
    body: JSON.stringify({ password }),
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

/** A registered webhook endpoint. The signing secret is never included here. */
export type WebhookEndpoint = {
  id: string;
  url: string;
  createdAt: string;
  updatedAt?: string;
  active?: boolean;
  description?: string;
};

/** A single webhook delivery attempt, as returned by the backend when available. */
export type WebhookDelivery = {
  id: string;
  endpointId?: string;
  event?: string;
  status?: string;
  statusCode?: number;
  attempts?: number;
  error?: string;
  createdAt: string;
  deliveredAt?: string;
};

/** Normalise list responses that may be a bare array or wrapped in an object. */
function asList<T>(data: T[] | Record<string, T[]>, key: string): T[] {
  if (Array.isArray(data)) return data;
  const value = (data as Record<string, T[]>)[key];
  return Array.isArray(value) ? value : [];
}

/** List the webhook endpoints registered for a wallet. */
export async function listWebhooks(
  token: string,
  walletId: string,
): Promise<WebhookEndpoint[]> {
  const data = await apiFetch<WebhookEndpoint[] | { webhooks: WebhookEndpoint[] }>(
    path`/v1/wallets/${walletId}/webhooks`,
    { token },
  );
  return asList(data, "webhooks");
}

/**
 * Register a new webhook endpoint.
 *
 * The response carries the signing secret, which the backend only ever returns once.
 */
export async function createWebhook(
  token: string,
  walletId: string,
  url: string,
): Promise<{ webhook: WebhookEndpoint; secret: string }> {
  const data = await apiFetch<{
    webhook?: WebhookEndpoint;
    endpoint?: WebhookEndpoint;
    secret: string;
  }>(path`/v1/wallets/${walletId}/webhooks`, {
    method: "POST",
    token,
    body: JSON.stringify({ url }),
  });
  const webhook = data.webhook ?? data.endpoint;
  if (!webhook) {
    throw new ApiError("Unexpected response from server (missing webhook).", 0);
  }
  return { webhook, secret: data.secret };
}

/** Rotate an endpoint's signing secret; the previous secret stops working immediately. */
export async function rotateWebhookSecret(
  token: string,
  walletId: string,
  webhookId: string,
): Promise<{ secret: string }> {
  const data = await apiFetch<{ secret: string }>(
    path`/v1/wallets/${walletId}/webhooks/${webhookId}/rotate`,
    { method: "POST", token },
  );
  return { secret: data.secret };
}

/** Delete a webhook endpoint; the backend stops delivering to it. */
export async function deleteWebhook(
  token: string,
  walletId: string,
  webhookId: string,
): Promise<void> {
  await apiFetch<unknown>(path`/v1/wallets/${walletId}/webhooks/${webhookId}`, {
    method: "DELETE",
    token,
  });
}

/**
 * Fetch recent delivery attempts for a wallet's webhooks.
 *
 * Returns an empty list when the backend does not expose deliveries (404/501) so the
 * dashboard can degrade gracefully instead of showing an error.
 */
export async function listWebhookDeliveries(
  token: string,
  walletId: string,
): Promise<WebhookDelivery[]> {
  try {
    const data = await apiFetch<
      WebhookDelivery[] | { deliveries: WebhookDelivery[] }
    >(path`/v1/wallets/${walletId}/webhooks/deliveries`, { token });
    return asList(data, "deliveries");
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
      return [];
    }
    throw err;
  }
}
