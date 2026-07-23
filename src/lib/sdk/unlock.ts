/**
 * Unlock a wallet for signing: obtain the decrypted Keypair from the user's password.
 *
 * Prefers the local encrypted backup (no network); falls back to the server-stored blob for
 * new-device recovery. The decrypted key exists only for the duration of the caller's signing
 * and is never persisted in plaintext.
 */
import { Keypair } from "@stellar/stellar-base";
import { decryptSeed } from "./crypto";
import { fromMnemonic } from "./keys";
import { getBackup } from "./client";
import { loadLocalBackup, saveLocalBackup } from "./store";
import { parseBackup } from "./crypto";

/**
 * Decrypt the wallet's key with `password` and return a signing Keypair.
 * Throws with a user-facing message if there is no backup or the password is wrong.
 */
export async function unlockWallet(
  token: string,
  walletId: string,
  password: string,
): Promise<Keypair> {
  let backup = loadLocalBackup(walletId);

  // New device / cleared storage: pull the opaque blob the server holds and cache it locally.
  if (!backup) {
    const remote = await getBackup(token, walletId);
    if (!remote.encrypted_backup) {
      throw new Error(
        "No key backup found for this wallet. Recover it with your recovery phrase.",
      );
    }
    backup = parseBackup(remote.encrypted_backup);
    saveLocalBackup(walletId, backup);
  }

  const mnemonic = await decryptSeed(backup, password); // throws on wrong password
  return fromMnemonic(mnemonic).keypair;
}
