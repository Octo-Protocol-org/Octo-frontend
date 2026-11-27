import { afterEach, describe, expect, it, vi } from "vitest";
import {
  explorerTxUrl,
  formatCountdownMs,
  formatCountdownSeconds,
  payUrl,
  shortenTxHash,
} from "./format";

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

describe("payUrl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to a relative path during SSR (no window)", () => {
    expect(payUrl("my-shop-42")).toBe("/pay/my-shop-42");
  });

  it("uses the browser origin in the client", () => {
    vi.stubGlobal("window", { location: { origin: "https://checkout.example" } });
    expect(payUrl("my-shop-42")).toBe("https://checkout.example/pay/my-shop-42");
  });

  it("does not double-encode a plain slug", () => {
    vi.stubGlobal("window", { location: { origin: "https://checkout.example" } });
    expect(payUrl("a-b_c")).toBe("https://checkout.example/pay/a-b_c");
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

describe("explorerTxUrl", () => {
  it("links to the testnet explorer and encodes the hash", () => {
    // The suite runs with the default NEXT_PUBLIC_STELLAR_NETWORK (testnet).
    const url = explorerTxUrl("abc def/ghi");
    expect(url).toBe("https://stellar.expert/explorer/testnet/tx/abc%20def%2Fghi");
  });
});
