// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { paymentLinkUrl, payUrl } from "./format";

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
