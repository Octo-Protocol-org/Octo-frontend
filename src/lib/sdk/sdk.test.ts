import { describe, it, expect } from "vitest";
import { fromMnemonic, generateWallet, keypairFromRawSeed } from "./keys";
import { encryptSeed, decryptSeed, serializeBackup, parseBackup } from "./crypto";
import { assertNetworkConsistency } from "./network";
import { network } from "@/lib/network";

const NETWORK_PASSPHRASE = network.passphrase;
import {
  buildSignedPayment,
  buildSignedChangeTrust,
  buildSignedCreateAccount,
  buildUnsignedPayment,
  txExpiresAt,
  getFeeStroops,
  MIN_FEE_STROOPS,
  MAX_FEE_STROOPS,
  TX_TIMEOUT_SECONDS,
  type SigningInfo,
} from "./tx";
import { submitSigned } from "./client";
import {
  Account,
  Asset,
  MuxedAccount,
  Operation,
  Networks,
  Transaction,
  TransactionBuilder,
  Keypair,
} from "@stellar/stellar-base";

// Decode a plain (non-fee-bump) envelope built by the SDK.
function decodeTx(xdr: string, passphrase: string): Transaction {
  const tx = TransactionBuilder.fromXDR(xdr, passphrase);
  if (!(tx instanceof Transaction)) throw new Error("expected a plain transaction");
  return tx;
}

// The exact SEP-0005 vector asserted by the Rust `octo-wallet-core` provision tests. If the JS
// derivation ever diverges from Rust, a wallet made in the browser could not be recovered on the
// server (or vice-versa) — this test is the cross-implementation contract.
const VECTOR_MNEMONIC =
  "illness spike retreat truth genius clock brain pass fit cave bargain toe";
const VECTOR_ACCOUNT = "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6";

describe("SEP-0005 derivation (matches Rust wallet-core)", () => {
  it("derives the canonical account from the vector mnemonic", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(w.publicKey).toBe(VECTOR_ACCOUNT);
  });

  it("normalizes whitespace/case before deriving", () => {
    const w = fromMnemonic(`  ILLNESS  spike retreat truth genius clock
       brain pass fit cave bargain TOE `);
    expect(w.publicKey).toBe(VECTOR_ACCOUNT);
  });

  it("rejects an invalid mnemonic", () => {
    expect(() => fromMnemonic("not a real mnemonic phrase at all here")).toThrow();
  });

  it("generates unique 12-word wallets", () => {
    const a = generateWallet();
    const b = generateWallet();
    expect(a.mnemonic.split(" ")).toHaveLength(12);
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.publicKey).toMatch(/^G/);
  });
});

describe("password backup encryption", () => {
  it("round-trips the mnemonic through encrypt/decrypt", async () => {
    const secret = VECTOR_MNEMONIC;
    const blob = await encryptSeed(secret, "correct horse battery staple");
    const wire = serializeBackup(blob);
    const back = await decryptSeed(parseBackup(wire), "correct horse battery staple");
    expect(back).toBe(secret);
  });

  it("fails to decrypt with the wrong password", async () => {
    const blob = await encryptSeed(VECTOR_MNEMONIC, "right-password");
    await expect(decryptSeed(blob, "wrong-password")).rejects.toThrow();
  });

  it("produces an opaque blob that does not contain the plaintext", async () => {
    const blob = await encryptSeed(VECTOR_MNEMONIC, "pw");
    expect(JSON.stringify(blob)).not.toContain("illness");
    expect(JSON.stringify(blob)).not.toContain("spike");
  });
});

describe("transaction building + signing", () => {
  const info: SigningInfo = {
    account: VECTOR_ACCOUNT,
    sequence: "42",
    network_passphrase: Networks.TESTNET,
    base_fee_stroops: 100,
  };

  it("builds a signed native payment that round-trips through XDR with the right source + signature", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const xdr = buildSignedPayment(w.keypair, info, {
      destination: "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX",
      amount: "1.5",
    });
    const tx = decodeTx(xdr, Networks.TESTNET);
    expect(tx.source).toBe(VECTOR_ACCOUNT);
    expect(tx.networkPassphrase).toBe(info.network_passphrase);
    expect(tx.signatures.length).toBe(1);
    // The signature must verify against the wallet's public key.
    const kp = Keypair.fromPublicKey(VECTOR_ACCOUNT);
    expect(kp.verify(tx.hash(), tx.signatures[0]!.signature())).toBe(true);
  });

  it("builds a signed payment to a muxed destination", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const destination = new MuxedAccount(
      new Account("GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "0"),
      "42",
    ).accountId();
    const xdr = buildSignedPayment(w.keypair, info, { destination, amount: "1" });
    const tx = decodeTx(xdr, info.network_passphrase);
    const operation = tx.operations[0]!;

    expect(tx.signatures).toHaveLength(1);
    expect(tx.networkPassphrase).toBe(info.network_passphrase);
    expect(operation.type).toBe("payment");
    if (operation.type !== "payment") return;
    expect(operation.destination).toBe(destination);
  });

  it.each([
    ["invalid destination", "not-a-stellar-address", "1"],
    ["amount with more than seven decimals", "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "1.00000001"],
    ["zero amount", "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "0"],
    ["negative amount", "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "-1"],
  ])("buildSignedPayment rejects %s", (_reason, destination, amount) => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(() => buildSignedPayment(w.keypair, info, { destination, amount })).toThrow();
  });

  it("buildSignedPayment rejects an invalid asset issuer", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(() =>
      buildSignedPayment(w.keypair, info, {
        destination: "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX",
        amount: "1",
        asset: { code: "USDC", issuer: "not-a-stellar-address" },
      }),
    ).toThrow();
  });

  it.each([
    ["invalid destination", "not-a-stellar-address", "1"],
    ["amount with more than seven decimals", "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "1.00000001"],
    ["zero amount", "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "0"],
    ["negative amount", "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "-1"],
  ])("buildUnsignedPayment rejects %s", (_reason, destination, amount) => {
    expect(() => buildUnsignedPayment(VECTOR_ACCOUNT, info, { destination, amount })).toThrow();
  });

  it("buildUnsignedPayment rejects an invalid asset issuer", () => {
    expect(() =>
      buildUnsignedPayment(VECTOR_ACCOUNT, info, {
        destination: "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX",
        amount: "1",
        asset: { code: "USDC", issuer: "not-a-stellar-address" },
      }),
    ).toThrow();
  });

  it("builds a signed change-trust (USDC) envelope", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const xdr = buildSignedChangeTrust(w.keypair, info, {
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
    });
    const tx = decodeTx(xdr, Networks.TESTNET);
    expect(tx.source).toBe(VECTOR_ACCOUNT);
    expect(tx.networkPassphrase).toBe(info.network_passphrase);
    expect(tx.signatures.length).toBe(1);
  });

  it("buildSignedChangeTrust rejects an invalid asset issuer", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(() =>
      buildSignedChangeTrust(w.keypair, info, {
        asset: { code: "USDC", issuer: "not-a-stellar-address" },
      }),
    ).toThrow();
  });

  it("builds a signed create-account for an unfunded XLM destination", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const destination = "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX";
    const xdr = buildSignedCreateAccount(w.keypair, info, {
      destination,
      startingBalance: "2.5",
    });
    const tx = decodeTx(xdr, Networks.TESTNET);
    expect(tx.source).toBe(VECTOR_ACCOUNT);
    expect(tx.signatures.length).toBe(1);
    const op = tx.operations[0]!;
    expect(op.type).toBe("createAccount");
    if (op.type !== "createAccount") return;
    expect(op.destination).toBe(destination);
    expect(op.startingBalance).toBe("2.5000000");
  });

  it("rejects a muxed destination for create-account", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(() =>
      buildSignedCreateAccount(w.keypair, info, {
        destination: new MuxedAccount(
          new Account("GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX", "0"),
          "42",
        ).accountId(),
        startingBalance: "2",
      }),
    ).toThrow();
  });

  it("txExpiresAt reads the envelope's own timebounds", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const before = Date.now();
    const xdr = buildSignedPayment(w.keypair, info, {
      destination: "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX",
      amount: "1",
    });
    const expires = txExpiresAt(xdr, Networks.TESTNET);
    expect(expires).not.toBeNull();
    // maxTime is whole seconds, so allow one second of truncation either side.
    expect(expires!).toBeGreaterThanOrEqual(before + (TX_TIMEOUT_SECONDS - 1) * 1000);
    expect(expires!).toBeLessThanOrEqual(Date.now() + TX_TIMEOUT_SECONDS * 1000 + 1000);
  });

  it("keypairFromRawSeed reproduces the same account", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const kp = keypairFromRawSeed(w.keypair.rawSecretKey());
    expect(kp.publicKey()).toBe(VECTOR_ACCOUNT);
  });
});

describe("fee validation", () => {
  const DESTINATION = "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX";
  const baseInfo: SigningInfo = {
    account: VECTOR_ACCOUNT,
    sequence: "42",
    network_passphrase: NETWORK_PASSPHRASE,
    base_fee_stroops: 100,
  };

  it("accepts the inclusive bounds", () => {
    expect(getFeeStroops({ ...baseInfo, base_fee_stroops: MIN_FEE_STROOPS })).toBe(MIN_FEE_STROOPS);
    expect(getFeeStroops({ ...baseInfo, base_fee_stroops: MAX_FEE_STROOPS })).toBe(MAX_FEE_STROOPS);
  });

  it("rejects values just outside the bounds", () => {
    expect(() => getFeeStroops({ ...baseInfo, base_fee_stroops: MIN_FEE_STROOPS - 1 })).toThrow();
    expect(() => getFeeStroops({ ...baseInfo, base_fee_stroops: MAX_FEE_STROOPS + 1 })).toThrow();
  });

  it("rejects zero, negative, NaN, Infinity and non-integer fees", () => {
    for (const bad of [0, -1, NaN, Infinity, -Infinity, 1.5, 100.0001]) {
      expect(() => getFeeStroops({ ...baseInfo, base_fee_stroops: bad })).toThrow();
    }
  });

  it("returns the validated fee for an in-range value", () => {
    expect(getFeeStroops({ ...baseInfo, base_fee_stroops: 1234 })).toBe(1234);
  });

  it("throws on an out-of-bounds fee in every builder", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const badInfo: SigningInfo = { ...baseInfo, base_fee_stroops: MAX_FEE_STROOPS + 1 };
    const feeError = /outside the allowed range/;
    expect(() =>
      buildSignedPayment(w.keypair, badInfo, { destination: DESTINATION, amount: "1" }),
    ).toThrow(feeError);
    expect(() =>
      buildSignedCreateAccount(w.keypair, badInfo, { destination: DESTINATION, startingBalance: "2" }),
    ).toThrow(feeError);
    expect(() =>
      buildSignedChangeTrust(w.keypair, badInfo, {
        asset: {
          code: "USDC",
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        },
      }),
    ).toThrow(feeError);
    expect(() =>
      buildUnsignedPayment(VECTOR_ACCOUNT, badInfo, { destination: DESTINATION, amount: "1" }),
    ).toThrow(feeError);
  });
});

describe("network consistency", () => {
  it("passes for the configured network passphrase", () => {
    expect(() => assertNetworkConsistency(NETWORK_PASSPHRASE)).not.toThrow();
  });

  it("throws for a mismatched passphrase", () => {
    const other =
      NETWORK_PASSPHRASE === Networks.TESTNET ? Networks.PUBLIC : Networks.TESTNET;
    expect(() => assertNetworkConsistency(other)).toThrow();
  });
});

describe("signing builders reject a mismatched network", () => {
  const otherPassphrase =
    NETWORK_PASSPHRASE === Networks.TESTNET ? Networks.PUBLIC : Networks.TESTNET;
  const badInfo: SigningInfo = {
    account: VECTOR_ACCOUNT,
    sequence: "42",
    network_passphrase: otherPassphrase,
    base_fee_stroops: 100,
  };

  it("buildSignedPayment rejects a mismatched network_passphrase", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(() =>
      buildSignedPayment(w.keypair, badInfo, {
        destination: "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX",
        amount: "1.5",
      }),
    ).toThrow();
  });

  it("buildSignedChangeTrust rejects a mismatched network_passphrase", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(() =>
      buildSignedChangeTrust(w.keypair, badInfo, {
        asset: {
          code: "USDC",
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        },
      }),
    ).toThrow();
  });

  it("buildSignedCreateAccount rejects a mismatched network_passphrase", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    expect(() =>
      buildSignedCreateAccount(w.keypair, badInfo, {
        destination: "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX",
        startingBalance: "2.5",
      }),
    ).toThrow();
  });
});

describe("relay network guard", () => {
  const DESTINATION = "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX";
  const otherPassphrase =
    NETWORK_PASSPHRASE === Networks.TESTNET ? Networks.PUBLIC : Networks.TESTNET;

  it("refuses to relay an envelope signed for a different network", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const foreign = new TransactionBuilder(new Account(VECTOR_ACCOUNT, "42"), {
      fee: "100",
      networkPassphrase: otherPassphrase,
    })
      .addOperation(Operation.payment({ destination: DESTINATION, asset: Asset.native(), amount: "1" }))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();
    foreign.sign(w.keypair);
    expect(() => submitSigned("token", "wallet", foreign.toXDR())).toThrow(/Refusing to relay/);
  });
});
