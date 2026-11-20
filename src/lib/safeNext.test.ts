import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safeNext";

describe("safeNextPath", () => {
  it.each(["//evil.com", "/\\evil.com", "\t//evil.com", "https://evil.com", "", undefined, 5])(
    "rejects %s",
    (v) => expect(safeNextPath(v)).toBeUndefined(),
  );
  it("rejects encoded double slash only if it decodes into a protocol-relative path", () => {
    // `/%2F%2Fevil.com` stays a same-origin path (the browser does not decode it).
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
  });
  it.each(["/dashboard", "/dashboard?x=1", "/dashboard#frag"])("allows %s", (v) =>
    expect(safeNextPath(v)).toBe(v),
  );
  it("allows a path with both a query string and a hash", () => {
    const next = "/dashboard/wallets/abc/transactions?before=xyz#top";
    expect(safeNextPath(next)).toBe(next);
  });
});