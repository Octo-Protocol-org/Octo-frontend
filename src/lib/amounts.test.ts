import { describe, it, expect } from "vitest";
import { amountToStroops } from "./wallets";
import { usdAmountToStroops, isValidEmail } from "./payment-links";
import { stroopsToXlm } from "./sponsorship";

describe("amountToStroops", () => {
  it("parses whole and fractional XLM into exact stroops", () => {
    expect(amountToStroops("1")).toBe(10_000_000);
    expect(amountToStroops("1.5")).toBe(15_000_000);
    expect(amountToStroops(".5")).toBe(5_000_000);
    expect(amountToStroops("10.")).toBe(100_000_000);
    expect(amountToStroops("0.0000001")).toBe(1);
  });

  it("trims surrounding whitespace", () => {
    expect(amountToStroops("  1.5  ")).toBe(15_000_000);
  });

  it("rejects zero, signed, exponent, empty and non-numeric input", () => {
    const bad = ["0", "0.0", "-1", "+1", "1e3", "1E3", "abc", "1.2.3", "0x10", "", " ", "."];
    for (const value of bad) {
      expect(amountToStroops(value)).toBeNull();
    }
  });

  it("rejects more than 7 decimal places", () => {
    expect(amountToStroops("1.00000001")).toBeNull();
    expect(amountToStroops("0.00000001")).toBeNull();
  });

  it("rejects values that overflow a JSON-safe integer", () => {
    expect(amountToStroops("900719925.4740991")).toBe(9_007_199_254_740_991);
    expect(amountToStroops("900719925.4740992")).toBeNull();
  });
});

describe("usdAmountToStroops", () => {
  it("parses a decimal USD string into USDC stroops", () => {
    expect(usdAmountToStroops("1")).toBe(10_000_000);
    expect(usdAmountToStroops("1.25")).toBe(12_500_000);
    expect(usdAmountToStroops("0.0000001")).toBe(1);
    expect(usdAmountToStroops(" 2.5 ")).toBe(25_000_000);
  });

  it("returns null for invalid or non-positive input", () => {
    const bad = ["0", "-1", "1e3", "1.00000001", "abc", ""];
    for (const value of bad) {
      expect(usdAmountToStroops(value)).toBeNull();
    }
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed addresses", () => {
    const good = ["a@b.co", "user.name+tag@example.com", "first_last@sub.domain.org", "A@B.IO"];
    for (const value of good) {
      expect(isValidEmail(value)).toBe(true);
    }
  });

  it("rejects malformed addresses", () => {
    const bad = [
      "",
      "plainaddress",
      "a@b",
      "a@.com",
      "a@b.",
      "a b@c.com",
      "@b.com",
      "a@@b.com",
      "a@b@c.com",
      "a@b.c d",
    ];
    for (const value of bad) {
      expect(isValidEmail(value)).toBe(false);
    }
  });
});

describe("stroopsToXlm", () => {
  it("formats a base fee without rounding the tiny amount away", () => {
    expect(stroopsToXlm(100)).toBe("0.00001 XLM");
  });

  it("formats zero, whole, fractional and negative stroops", () => {
    expect(stroopsToXlm(0)).toBe("0 XLM");
    expect(stroopsToXlm(1)).toBe("0.0000001 XLM");
    expect(stroopsToXlm(10_000_000)).toBe("1 XLM");
    expect(stroopsToXlm(15_000_000)).toBe("1.5 XLM");
    expect(stroopsToXlm(-100)).toBe("-0.00001 XLM");
  });
});
