/**
 * Thin client for the octo REST API.
 *
 * All responses use the envelope `{ statusCode, message, data }`. `apiFetch` unwraps `data` on
 * success and throws an `ApiError` carrying the server message on failure.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_OCTO_API_URL ?? "http://localhost:8080";

/** Default request timeout; callers may override via AbortSignal. */
const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
  options: RequestInit & { token?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const { token, signal: callerSignal, headers, ...rest } = options;

  // Combine caller signal with a hard timeout so hung connections don't spin forever.
  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal,
      headers: {
        "content-type": "application/json",
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
