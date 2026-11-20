import { describe, expect, it } from "vitest";
import { friendlyResultMessage } from "./resultCodes";

describe("friendlyResultMessage", () => {
  it("maps common Stellar operation codes to plain language", () => {
    expect(friendlyResultMessage("tx_bad_seq", "fallback")).toContain("sign again");
    expect(friendlyResultMessage("op_underfunded", "fallback")).toContain("enough");
    expect(friendlyResultMessage("op_no_trust", "fallback")).toContain("trustline");
    expect(friendlyResultMessage("op_low_reserve", "fallback")).toContain("minimum XLM reserve");
  });

  it("does not expose unknown raw Stellar codes", () => {
    expect(friendlyResultMessage("transaction failed: op_future_code", "Try again later")).toBe(
      "Try again later",
    );
  });

  it("preserves useful non-code server messages", () => {
    expect(friendlyResultMessage("The destination is not eligible", "fallback")).toBe(
      "The destination is not eligible",
    );
  });
});
