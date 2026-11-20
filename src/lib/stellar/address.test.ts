import { describe, it, expect } from "vitest";
import { Account, Keypair, MuxedAccount } from "@stellar/stellar-base";
import { validateStellarAddress } from "./address";

describe("validateStellarAddress", () => {
  const own = Keypair.random().publicKey();

  it("rejects the wallet's own G... address and any muxed M... alias of it", () => {
    const muxed = new MuxedAccount(new Account(own, "0"), "7").accountId();
    expect(validateStellarAddress(own, { ownAddress: own })).toMatch(/own wallet/);
    expect(validateStellarAddress(muxed, { ownAddress: own })).toMatch(/own wallet/);
  });

  it("accepts another account and rejects malformed input", () => {
    expect(validateStellarAddress(Keypair.random().publicKey(), { ownAddress: own })).toBeNull();
    expect(validateStellarAddress("not-an-address")).toMatch(/valid Stellar address/);
    expect(validateStellarAddress("  ")).toMatch(/Enter a Stellar address/);
  });
});
