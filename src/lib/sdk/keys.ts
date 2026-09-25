/**
 * Non-custodial key handling for Octo wallets.
 *
 * A wallet's key is derived from a BIP-39 mnemonic via SEP-0005 (SLIP-0010 ed25519 on the
 * Stellar derivation path `m/44'/148'/0'`). This mirrors the Rust `octo-wallet-core` exactly, so
 * a wallet created here can be recovered there and vice-versa. The private key is generated and
 * used **only** in the browser/SDK — the server never sees it.
 */
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha512";
import { Keypair } from "@stellar/stellar-base";

// SLIP-0010 ed25519 master-key salt (fixed by the spec).
const SLIP10_ED25519_CURVE = new TextEncoder().encode("ed25519 seed");

/** Derive a SLIP-0010 ed25519 master node from a BIP-39 seed. */
function slip10Master(seed: Uint8Array): { key: Uint8Array; chainCode: Uint8Array } {
  const I = hmac(sha512, SLIP10_ED25519_CURVE, seed);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

/** Derive one hardened SLIP-0010 child (index already has the hardened bit set). */
function slip10HardenedChild(
  parent: { key: Uint8Array; chainCode: Uint8Array },
  index: number,
): { key: Uint8Array; chainCode: Uint8Array } {
  // Data = 0x00 || parent_key || ser32(index)
  const data = new Uint8Array(37);
  data[0] = 0x00;
  data.set(parent.key, 1);
  new DataView(data.buffer).setUint32(33, index >>> 0, false); // big-endian
  const I = hmac(sha512, parent.chainCode, data);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

/**
 * Derive a key from a BIP-39 seed using SLIP-0010 ed25519.
 * Path segments must be hardened (e.g. "m/44'/148'/0'").
 */
function deriveSlip10(seed: Uint8Array, path: string): Uint8Array {
  const segments = path
    .replace(/^m\/?/, "")
    .split("/")
    .filter(Boolean);
  let node = slip10Master(seed);
  for (const seg of segments) {
    if (!seg.endsWith("'")) throw new Error(`SLIP-0010 ed25519 requires hardened path: ${seg}`);
    const index = (parseInt(seg, 10) | 0x80000000) >>> 0;
    node = slip10HardenedChild(node, index);
  }
  return node.key;
}

/** Stellar's SEP-0005 path for the primary account (index 0). */
const STELLAR_ACCOUNT_0 = "m/44'/148'/0'";

export type WalletKeys = {
  /** The 12-word BIP-39 recovery phrase. Show once; the user must store it. */
  mnemonic: string;
  /** The `G...` public account id. */
  publicKey: string;
  /** A stellar-base Keypair that can sign. Keep in memory only; never persist. */
  keypair: Keypair;
};

/** Generate a brand-new wallet with a fresh 12-word mnemonic. */
export function generateWallet(): WalletKeys {
  const mnemonic = generateMnemonic(wordlist, 128); // 128 bits => 12 words
  return fromMnemonic(mnemonic);
}

/** Re-derive a wallet from an existing mnemonic (recovery / import). Throws if invalid. */
export function fromMnemonic(mnemonic: string): WalletKeys {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error("Invalid recovery phrase.");
  }
  // BIP-39 seed (no passphrase), then SEP-0005 / SLIP-0010 ed25519 derivation.
  const seed = mnemonicToSeedSync(normalized);
  const key = deriveSlip10(seed, STELLAR_ACCOUNT_0);
  const keypair = Keypair.fromRawEd25519Seed(Buffer.from(key));
  return {
    mnemonic: normalized,
    publicKey: keypair.publicKey(),
    keypair,
  };
}

/** Derive a Keypair from the raw 32-byte ed25519 seed (used after decrypting a backup). */
export function keypairFromRawSeed(rawSeed: Uint8Array): Keypair {
  return Keypair.fromRawEd25519Seed(Buffer.from(rawSeed));
}
