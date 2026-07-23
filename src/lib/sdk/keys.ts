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
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@stellar/stellar-base";

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
  // BIP-39 seed (no passphrase), then SEP-0005 ed25519 derivation.
  const seed = mnemonicToSeedSync(normalized);
  const { key } = derivePath(STELLAR_ACCOUNT_0, Buffer.from(seed).toString("hex"));
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
