import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-base";
import { describe, expect, it } from "vitest";

import { assertSignedMatchesBuilt, SIGNED_TX_MISMATCH_MESSAGE } from "./signedTxCheck";

const kp = Keypair.random();
const dest = Keypair.random().publicKey();

function build(amount: string) {
  return new TransactionBuilder(new Account(kp.publicKey(), "1"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({ destination: dest, asset: Asset.native(), amount }))
    .setTimeout(300)
    .build();
}

describe("assertSignedMatchesBuilt", () => {
  it("accepts the same transaction once signed", () => {
    const tx = build("10");
    const unsigned = tx.toXDR();
    tx.sign(kp);
    expect(() => assertSignedMatchesBuilt(unsigned, tx.toXDR(), Networks.TESTNET)).not.toThrow();
  });

  it("rejects a tampered envelope", () => {
    const unsigned = build("10").toXDR();
    const other = build("9999");
    other.sign(kp);
    expect(() => assertSignedMatchesBuilt(unsigned, other.toXDR(), Networks.TESTNET)).toThrow(
      SIGNED_TX_MISMATCH_MESSAGE,
    );
  });

  it("rejects an unsigned or wrongly signed envelope", () => {
    const tx = build("10");
    const unsigned = tx.toXDR();
    expect(() => assertSignedMatchesBuilt(unsigned, unsigned, Networks.TESTNET)).toThrow();
    tx.sign(Keypair.random());
    expect(() => assertSignedMatchesBuilt(unsigned, tx.toXDR(), Networks.TESTNET)).toThrow();
  });
});
