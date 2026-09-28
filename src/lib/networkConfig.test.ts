import { describe, it, expect } from "vitest";
import {
  usdcForNetwork,
  NETWORK_PASSPHRASE_MAINNET,
  NETWORK_PASSPHRASE_TESTNET,
} from "./networkConfig";

const USDC_ISSUER_MAINNET =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

describe("usdcForNetwork", () => {
  it("returns Circle mainnet issuer for the mainnet passphrase", () => {
    const usdc = usdcForNetwork(NETWORK_PASSPHRASE_MAINNET);
    expect(usdc.issuer).toBe(USDC_ISSUER_MAINNET);
    expect(usdc.code).toBe("USDC");
  });

  it("returns testnet issuer for the testnet passphrase", () => {
    const usdc = usdcForNetwork(NETWORK_PASSPHRASE_TESTNET);
    expect(usdc.issuer).toBe(USDC_ISSUER_TESTNET);
  });

  it("never returns the testnet issuer for mainnet", () => {
    expect(usdcForNetwork(NETWORK_PASSPHRASE_MAINNET).issuer).not.toBe(
      USDC_ISSUER_TESTNET,
    );
  });

  it("falls back to testnet for unknown passphrases", () => {
    expect(usdcForNetwork("").issuer).toBe(USDC_ISSUER_TESTNET);
    expect(usdcForNetwork("Some Other Network").issuer).toBe(USDC_ISSUER_TESTNET);
  });
});
