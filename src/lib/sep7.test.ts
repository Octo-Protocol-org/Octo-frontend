import { describe, it, expect } from "vitest";
import { sep7PayUri } from "./sep7";

const PUBLIC_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

const DESTINATION = "GDESTINATIONADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const ISSUER = "GISSUERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

describe("sep7PayUri", () => {
  it("includes the testnet passphrase when networkPassphrase is testnet", () => {
    const uri = sep7PayUri({
      destination: DESTINATION,
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.get("network_passphrase")).toBe(TESTNET_PASSPHRASE);
  });

  it("omits the passphrase for the public network", () => {
    const uri = sep7PayUri({
      destination: DESTINATION,
      networkPassphrase: PUBLIC_PASSPHRASE,
    });
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.has("network_passphrase")).toBe(false);
  });

  it("omits the passphrase when networkPassphrase is not provided", () => {
    const uri = sep7PayUri({ destination: DESTINATION });
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.has("network_passphrase")).toBe(false);
  });

  it("builds a web+stellar:pay URI with the destination", () => {
    const uri = sep7PayUri({ destination: DESTINATION });
    expect(uri.startsWith("web+stellar:pay?")).toBe(true);
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.get("destination")).toBe(DESTINATION);
  });

  it("includes asset_code and asset_issuer", () => {
    const uri = sep7PayUri({
      destination: DESTINATION,
      assetCode: "USDC",
      assetIssuer: ISSUER,
    });
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.get("asset_code")).toBe("USDC");
    expect(params.get("asset_issuer")).toBe(ISSUER);
  });

  it("includes the amount", () => {
    const uri = sep7PayUri({
      destination: DESTINATION,
      amount: "12.5",
    });
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.get("amount")).toBe("12.5");
  });

  it("encodes a MEMO_ID as a decimal string", () => {
    const uri = sep7PayUri({
      destination: DESTINATION,
      memo: "123456789",
      memoType: "MEMO_ID",
    });
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.get("memo")).toBe("123456789");
    expect(params.get("memo_type")).toBe("MEMO_ID");
  });

  it("rejects a non-decimal MEMO_ID", () => {
    expect(() =>
      sep7PayUri({
        destination: DESTINATION,
        memo: "12a45",
        memoType: "MEMO_ID",
      }),
    ).toThrow();
  });

  it("rejects a non-integer MEMO_ID", () => {
    expect(() =>
      sep7PayUri({
        destination: DESTINATION,
        memo: "12.5",
        memoType: "MEMO_ID",
      }),
    ).toThrow();
  });

  it("encodes a MEMO_TEXT", () => {
    const uri = sep7PayUri({
      destination: DESTINATION,
      memo: "hello world",
      memoType: "MEMO_TEXT",
    });
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.get("memo")).toBe("hello world");
    expect(params.get("memo_type")).toBe("MEMO_TEXT");
  });
});