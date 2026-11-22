import { describe, it, expect } from "vitest";
import { toStroops, toMemoId } from "./brands";

describe("toStroops", () => {
  it("accepts a decimal string", () => {
    expect(toStroops("12345")).toBe("12345");
  });

  it("accepts a safe number and converts to string", () => {
    expect(toStroops(10_000_000)).toBe("10000000");
    expect(toStroops(0)).toBe("0");
  });

  it("rejects a non-integer number", () => {
    expect(() => toStroops(1.5)).toThrow(RangeError);
  });

  it("rejects a negative number", () => {
    expect(() => toStroops(-1)).toThrow(RangeError);
  });

  it("rejects a non-numeric string", () => {
    expect(() => toStroops("12.5")).toThrow(RangeError);
    expect(() => toStroops("abc")).toThrow(RangeError);
  });

  it("rejects a number above Number.MAX_SAFE_INTEGER", () => {
    expect(() => toStroops(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("accepts the max safe integer itself", () => {
    expect(toStroops(Number.MAX_SAFE_INTEGER)).toBe(String(Number.MAX_SAFE_INTEGER));
  });

  it("accepts large stroop values as strings without precision loss", () => {
    // 2^53 as a string (exceeds MAX_SAFE_INTEGER — only valid when already a string)
    expect(toStroops("9007199254740992")).toBe("9007199254740992");
    // Stellar int64 max
    expect(toStroops("9223372036854775807")).toBe("9223372036854775807");
  });
});

describe("toMemoId", () => {
  it("accepts a decimal string memo ID", () => {
    expect(toMemoId("123456")).toBe("123456");
  });

  it("accepts a safe number memo ID and converts to string", () => {
    expect(toMemoId(7)).toBe("7");
    expect(toMemoId(0)).toBe("0");
  });

  it("rejects a non-integer number", () => {
    expect(() => toMemoId(1.5)).toThrow(RangeError);
  });

  it("rejects a negative number", () => {
    expect(() => toMemoId(-1)).toThrow(RangeError);
  });

  it("rejects a non-numeric string", () => {
    expect(() => toMemoId("7abc")).toThrow(RangeError);
  });

  it("rejects a number above Number.MAX_SAFE_INTEGER", () => {
    expect(() => toMemoId(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("round-trips a uint64 memo ID string without precision loss", () => {
    // uint64 max — would be rounded to wrong value as a JS number
    const uint64Max = "18446744073709551615";
    expect(toMemoId(uint64Max)).toBe(uint64Max);
  });
});
