import { describe, it, expect } from "vitest";
import {
  minimumBalanceStroops,
  spendableNativeStroops,
  minCreateAccountStroops,
  reserveIsExact,
} from "./reserve";
import { friendlyResultMessage, isExpiredResult } from "./resultCodes";

const XLM = BigInt(10_000_000);

describe("reserve", () => {
  const info = {
    base_fee_stroops: 100,
    base_reserve_stroops: 5_000_000,
    subentry_count: 1,
    num_sponsoring: 0,
    num_sponsored: 0,
  };

  it("computes (2 + subentries) × base reserve", () => {
    expect(minimumBalanceStroops(info, 0)).toBe(BigInt(15_000_000));
    expect(reserveIsExact(info)).toBe(true);
  });

  it("spendable subtracts the minimum balance and the fee", () => {
    // 10 XLM − 1.5 XLM reserve − 100 stroops fee.
    expect(spendableNativeStroops(BigInt(10) * XLM, info, 0)).toBe(BigInt(84_999_900));
  });

  it("never goes negative", () => {
    expect(spendableNativeStroops(XLM, info, 0)).toBe(BigInt(0));
  });

  it("falls back to trustline count and protocol defaults when the backend omits them", () => {
    expect(reserveIsExact(null)).toBe(false);
    expect(minimumBalanceStroops(null, 2)).toBe(BigInt(20_000_000));
  });

  it("requires 2 base reserves to create an account", () => {
    expect(minCreateAccountStroops(info)).toBe(XLM);
  });
});

describe("result codes", () => {
  it("never surfaces a raw tx_too_late", () => {
    const msg = friendlyResultMessage("transaction failed: tx_too_late", "failed");
    expect(msg).not.toMatch(/tx_too_late/);
    expect(isExpiredResult("tx_too_late")).toBe(true);
  });

  it("collapses unknown raw codes to the fallback and keeps plain messages", () => {
    expect(friendlyResultMessage("op_weird_thing", "Withdrawal failed.")).toBe("Withdrawal failed.");
    expect(friendlyResultMessage("Invalid code", "x")).toBe("Invalid code");
  });
});
