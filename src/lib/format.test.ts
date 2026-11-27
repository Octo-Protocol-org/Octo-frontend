// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { formatCountdownMs, formatCountdownSeconds, paymentLinkUrl, payUrl, shortenTxHash } from "./format";

describe("formatCountdownMs", () => {
  it.each([
    [0, "0:00"],
    [1, "0:00"],
    [999, "0:00"],
    [59_999, "0:59"],
    [60_000, "1:00"],
    [3_600_000, "1:00:00"],
    [3_661_500, "1:01:01"],
    [-5_000, "0:00"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatCountdownMs(ms)).toBe(expected);
  });
});

describe("formatCountdownSeconds", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [65, "1:05"],
    [600, "10:00"],
  ])("formats %d s as %s", (s, expected) => {
    expect(formatCountdownSeconds(s)).toBe(expected);
  });
});

describe("shortenTxHash", () => {
  it("returns short hashes untouched", () => {
    expect(shortenTxHash("abcdef123456")).toBe("abcdef123456");
  });

  it("trims whitespace before shortening", () => {
    expect(shortenTxHash("  abcdef123456  ")).toBe("abcdef123456");
  });

  it("shortens to first-4 + last-4", () => {
    const hash = "abcdefghijklmnop";
    expect(shortenTxHash(hash)).toBe("abcd…mnop");
  });
});

const origin = () => window.location.origin;

describe("payUrl", () => {
  it("builds an absolute checkout URL for a normal slug", () => {
    expect(payUrl("abc123")).toBe(`${origin()}/pay/abc123`);
  });

  it.each([
    ["a/../../dashboard", "/pay/a%2F..%2F..%2Fdashboard"],
    ["x?next=evil", "/pay/x%3Fnext%3Devil"],
    ["x#frag", "/pay/x%23frag"],
  ])("encodes %s so it stays one path segment", (slug, expected) => {
    const url = new URL(payUrl(slug)!);
    expect(url.origin).toBe(origin());
    expect(url.pathname).toBe(expected);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
  });

  it.each(["", ".", ".."])("returns null for the unusable slug %j", (slug) => {
    expect(payUrl(slug)).toBeNull();
  });
});

describe("paymentLinkUrl", () => {
  it("prefers the server URL when it is http(s)", () => {
    expect(paymentLinkUrl({ url: "https://octo.example/pay/abc", slug: "abc" })).toBe("https://octo.example/pay/abc");
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "not a url"])(
    "falls back to the slug URL when the server URL is %j",
    (url) => {
      expect(paymentLinkUrl({ url, slug: "abc" })).toBe(`${origin()}/pay/abc`);
    },
  );

  it("encodes the slug when there is no server URL", () => {
    expect(paymentLinkUrl({ url: null, slug: "a/b" })).toBe(`${origin()}/pay/a%2Fb`);
  });
});
