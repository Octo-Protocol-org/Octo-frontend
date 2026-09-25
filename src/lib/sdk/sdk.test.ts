import { describe, it, expect } from "vitest";
import { fromMnemonic, generateWallet, keypairFromRawSeed } from "./keys";
import { encryptSeed, decryptSeed, serializeBackup, parseBackup } from "./crypto";
import {
  buildSignedPayment,
  buildSignedChangeTrust,
  buildSignedCreateAccount,
  txExpiresAt,
  TX_TIMEOUT_SECONDS,
  type SigningInfo,
} from "./tx";
import {
  Account,
  MuxedAccount,
  Networks,
  TransactionBuilder,
  Keypair,
} from "@stellar/stellar-base";

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
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    expect(tx.source).toBe(VECTOR_ACCOUNT);
    expect(tx.signatures.length).toBe(1);
    // The signature must verify against the wallet's public key.
    const kp = Keypair.fromPublicKey(VECTOR_ACCOUNT);
    expect(kp.verify(tx.hash(), tx.signatures[0].signature())).toBe(true);
  });

  it("builds a signed change-trust (USDC) envelope", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const xdr = buildSignedChangeTrust(w.keypair, info, {
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
    });
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    expect(tx.source).toBe(VECTOR_ACCOUNT);
    expect(tx.signatures.length).toBe(1);
  });

  it("builds a signed create-account for an unfunded XLM destination", () => {
    const w = fromMnemonic(VECTOR_MNEMONIC);
    const destination = "GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX";
    const xdr = buildSignedCreateAccount(w.keypair, info, {
      destination,
      startingBalance: "2.5",
    });
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    expect(tx.source).toBe(VECTOR_ACCOUNT);
    expect(tx.signatures.length).toBe(1);
    if (!("operations" in tx)) throw new Error("expected a plain transaction");
    const op = tx.operations[0];
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
