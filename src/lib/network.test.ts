import { describe, it, expect } from "vitest";
import { usdcForNetwork } from "./network";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const USDC_ISSUER_MAINNET =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

describe("usdcForNetwork", () => {
  it("returns Circle mainnet issuer for the mainnet passphrase", () => {
    const usdc = usdcForNetwork(MAINNET_PASSPHRASE);
    expect(usdc.issuer).toBe(USDC_ISSUER_MAINNET);
    expect(usdc.code).toBe("USDC");
  });

  it("returns testnet issuer for the testnet passphrase", () => {
    const usdc = usdcForNetwork(TESTNET_PASSPHRASE);
    expect(usdc.issuer).toBe(USDC_ISSUER_TESTNET);
  });

  it("throws on invalid input", () => {
    expect(() => usdcForNetwork("")).toThrow();
    expect(() => usdcForNetwork("Some Other Network")).toThrow();
  });
});