import { describe, it, expect } from "vitest";
import { explorerAccountUrl, explorerTxUrl, network, usdcForNetwork } from "./network";

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
describe("explorer URL helpers", () => {
  const base = network.explorerBase;
  const hash = "a".repeat(64);

  it("builds tx and account URLs for well-formed input", () => {
    expect(explorerTxUrl(hash)).toBe(`${base}/tx/${hash}`);
    expect(explorerTxUrl(` ${hash.toUpperCase()} `)).toBe(`${base}/tx/${hash.toUpperCase()}`);
    expect(explorerAccountUrl(USDC_ISSUER_TESTNET)).toBe(`${base}/account/${USDC_ISSUER_TESTNET}`);
  });

  it.each(["../../evil", "..", `${hash}?x=1`, `${hash}#frag`, `${hash.slice(1)}/`, "", hash.slice(1)])(
    "returns null instead of a URL for %j",
    (value) => {
      expect(explorerTxUrl(value)).toBeNull();
      expect(explorerAccountUrl(value)).toBeNull();
    },
  );

  it("returns null for an address with a bad checksum", () => {
    expect(explorerAccountUrl(`${USDC_ISSUER_TESTNET.slice(0, -1)}B`)).toBeNull();
  });
});
