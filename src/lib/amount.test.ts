import { describe, it, expect } from "vitest";
import { parseAmount, formatStroops } from "./amount";
import { stroopsToXlm } from "./sponsorship";

describe("parseAmount", () => {
  it("parses decimals into exact stroops", () => {
    expect(parseAmount("1.5")).toEqual({ ok: true, stroops: BigInt(15_000_000) });
    expect(parseAmount(".0000001")).toEqual({ ok: true, stroops: BigInt(1) });
    expect(parseAmount("10.")).toEqual({ ok: true, stroops: BigInt(100_000_000) });
    expect(parseAmount("0")).toEqual({ ok: true, stroops: BigInt(0) });
  });

  it("rejects more than 7 decimals", () => {
    const r = parseAmount("1.00000001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/7 decimal/);
  });

  it("rejects non-numeric, signed, exponent and empty input", () => {
    for (const bad of ["", " ", ".", "-1", "1e3", "abc", "1.2.3", "0x10"]) {
      expect(parseAmount(bad).ok).toBe(false);
    }
  });

  it("rejects values above int64", () => {
    expect(parseAmount("922337203685.4775808").ok).toBe(false);
    expect(parseAmount("922337203685.4775807").ok).toBe(true);
  });
});

describe("formatStroops", () => {
  it("trims trailing zeros and keeps up to 7 decimals", () => {
    expect(formatStroops(100)).toBe("0.00001");
    expect(formatStroops(BigInt(15_000_000))).toBe("1.5");
    expect(formatStroops(10_000_000)).toBe("1");
    expect(formatStroops(1)).toBe("0.0000001");
    expect(formatStroops(0)).toBe("0");
    expect(formatStroops(-100)).toBe("-0.00001");
  });
});

describe("stroopsToXlm", () => {
  it("renders a 100-stroop fee as 0.00001 XLM", () => {
    expect(stroopsToXlm(100)).toBe("0.00001 XLM");
  });
});
