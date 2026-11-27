import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, hasDotSegment, path } from "./api";

describe("path", () => {
  it("encodes `/`, `?` and `#` in interpolated segments", () => {
    expect(path`/v1/wallets/${"a/b?c#d"}/links`).toBe("/v1/wallets/a%2Fb%3Fc%23d/links");
  });
});

describe("hasDotSegment", () => {
  it.each(["/v1/wallets/../x", "/v1/./x", "/v1/x/..", "/v1/%2E%2E/x", "/v1/.%2e/x", "/v1/%2e?q=1"])(
    "flags %s",
    (p) => expect(hasDotSegment(p)).toBe(true),
  );

  it.each(["/v1/wallets/a.b", "/v1/wallets/..%2Fw", "/v1/x?next=/../", "/v1/...", "/v1/x#.."])(
    "allows %s",
    (p) => expect(hasDotSegment(p)).toBe(false),
  );
});

describe("apiFetch dot-segment guard", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  // URL parsers treat `..` and `%2E%2E` alike, so encoding cannot make a dot-segment id safe.
  it("rejects a request whose id is `..` without calling fetch", async () => {
    await expect(apiFetch(path`/v1/wallets/${".."}/payment-links`)).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
