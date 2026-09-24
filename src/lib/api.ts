/**
 * Thin client for the octo REST API.
 *
 * All responses use the envelope `{ statusCode, message, data }`. `apiFetch` unwraps `data` on
 * success and throws an `ApiError` carrying the server message on failure.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_OCTO_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = res.status;
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
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    // The backend's 500 message is a generic "internal server error" with no actionable detail —
    // swap in something a user can actually act on rather than surfacing that verbatim.
    const message =
      res.status >= 500
        ? "Something went wrong on our end. Please try again in a moment."
        : body?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body!.data;
}
