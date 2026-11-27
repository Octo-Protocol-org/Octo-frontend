// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, ApiError } from "./api";

const BASE = process.env.NEXT_PUBLIC_OCTO_API_URL ?? "http://localhost:8080";

function makeResponse(status: number, body: unknown, contentType = "application/json"): Response {
  const init: ResponseInit = {
    status,
    headers: { "content-type": contentType },
  };
  const bodyText = contentType === "application/json" ? JSON.stringify(body) : (body as string);
  return new Response(bodyText, init);
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("works when AbortSignal.any and AbortSignal.timeout are unavailable", async () => {
    const anyFn = AbortSignal.any;
    const timeoutFn = AbortSignal.timeout;
    // Older browsers (Safari 16, Chrome 110) lack both static helpers.
    Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true });
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true });
    try {
      vi.mocked(fetch).mockResolvedValue(
        makeResponse(200, { statusCode: 200, message: "ok", data: { id: "abc" } }),
      );
      const caller = new AbortController();
      const result = await apiFetch<{ id: string }>("/test", { signal: caller.signal });
      expect(result).toEqual({ id: "abc" });
      const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeDefined();
      expect(init.signal).not.toBe(caller.signal);

      // A caller abort still propagates through the fallback combined signal.
      vi.mocked(fetch).mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal;
            signal.addEventListener("abort", () => reject(signal.reason));
          }),
      );
      const pending = apiFetch("/test", { signal: caller.signal }).catch((e) => e);
      caller.abort();
      const err = await pending;
      expect(err).toBeInstanceOf(DOMException);
      expect((err as DOMException).name).toBe("AbortError");
    } finally {
      Object.defineProperty(AbortSignal, "any", { value: anyFn, configurable: true });
      Object.defineProperty(AbortSignal, "timeout", { value: timeoutFn, configurable: true });
    }
  });

  it("resolves with data on a standard 200 envelope", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse(200, { statusCode: 200, message: "ok", data: { id: "abc" } }),
    );
    const result = await apiFetch<{ id: string }>("/test");
    expect(result).toEqual({ id: "abc" });
  });

  it("resolves with undefined on a 204 No Content response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const result = await apiFetch<undefined>("/test");
    expect(result).toBeUndefined();
  });

  it("throws ApiError with a descriptive message for non-JSON 2xx", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, "plain text", "text/plain"));
    await expect(apiFetch("/test")).rejects.toThrow(
      /Unexpected response from server/,
    );
  });

  it("throws ApiError with the server message on a 4xx error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse(404, { statusCode: 404, message: "wallet not found", data: null }),
    );
    const err = await apiFetch("/test").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toBe("wallet not found");
  });

  it("throws ApiError with a generic message on 5xx errors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse(500, { statusCode: 500, message: "internal server error", data: null }),
    );
    const err = await apiFetch("/test").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/something went wrong/i);
  });

  it("throws ApiError with timeout message when AbortSignal.timeout fires", async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new DOMException("signal timed out", "TimeoutError")),
    );
    const err = await apiFetch("/test").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/timed out/i);
  });

  it("re-throws AbortError unchanged for intentional cancellation", async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException("aborted", "AbortError"));
    const err = await apiFetch("/test").catch((e) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("AbortError");
  });

  it("forwards the Authorization header when token is provided", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse(200, { statusCode: 200, message: "ok", data: {} }),
    );
    await apiFetch("/test", { token: "tok_123" });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/test`);
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer tok_123");
  });

  it("does not dispatch session-expired on 401 when authFailureSignsOut is false", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    vi.mocked(fetch).mockResolvedValue(
      makeResponse(401, { statusCode: 401, message: "wrong current password", data: null }),
    );
    const err = await apiFetch("/test", {
      token: "tok_123",
      authFailureSignsOut: false,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).message).toBe("wrong current password");
    const expiredEvents = dispatchSpy.mock.calls.filter(
      ([event]) => (event as Event).type === "session-expired",
    );
    expect(expiredEvents).toHaveLength(0);
    dispatchSpy.mockRestore();
  });

  it("dispatches session-expired exactly once on 401 with the default option", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    vi.mocked(fetch).mockResolvedValue(
      makeResponse(401, { statusCode: 401, message: "token expired", data: null }),
    );
    const err = await apiFetch("/test", { token: "tok_123" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    const expiredEvents = dispatchSpy.mock.calls.filter(
      ([event]) => (event as Event).type === "session-expired",
    );
    expect(expiredEvents).toHaveLength(1);
    dispatchSpy.mockRestore();
  });
});
