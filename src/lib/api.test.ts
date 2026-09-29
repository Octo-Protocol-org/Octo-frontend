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
});
