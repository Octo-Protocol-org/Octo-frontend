/**
 * Unlock a wallet for signing: derive the keypair from the user's password + the cached backup,
 * keeping the local cache consistent with the authoritative server copy.
 *
 * The local cache is preferred (no network) when it decrypts. If decryption fails — either a
 * wrong password or a stale cache left behind by a credential change on another device — the
 * server copy is fetched and used to refresh the local cache so the user's current password
 * keeps working across devices.
 */
import { Keypair } from "@stellar/stellar-base";
import { decryptSeed, WrongPasswordError } from "./crypto";
import { fromMnemonic } from "./keys";
import { getBackup } from "./client";
import { loadLocalBackup, saveLocalBackup, versionOf } from "./store";
import { parseBackup } from "./crypto";

export const MISSING_BACKUP_ERROR =
  'No key backup found for this wallet. Use "Recover wallet" on the wallet overview page.';

/** Decrypt a specific backup blob; throws on wrong password or key mismatch. */
async function unlockFromBackup(
  backup: ReturnType<typeof parseBackup>,
  password: string,
  expectedPublicKey?: string,
): Promise<string> {
  const mnemonic = await decryptSeed(backup, password);
  if (expectedPublicKey !== undefined && fromMnemonic(mnemonic).publicKey !== expectedPublicKey) {
    throw new Error("Unlocked key does not match this wallet. Aborting unlock.");
  }
  return mnemonic;
}

/**
 * Reconcile the local cache with the server copy and decrypt. The address check runs on every
 * path (local cache and server), so callers never receive another wallet's mnemonic.
 */
export async function unlockBackup(
  token: string,
  walletId: string,
  password: string,
  expectedPublicKey?: string,
): Promise<{ mnemonic: string; backup: ReturnType<typeof parseBackup>; version: string }> {
  const local = loadLocalBackup(walletId);

  // Fast path: the cached copy decrypts — no network round-trip.
  if (local) {
    try {
      const mnemonic = await unlockFromBackup(local.backup, password, expectedPublicKey);
      return { mnemonic, backup: local.backup, version: local.version };
    } catch (err) {
      // Decryption failed: either a wrong password, or the cache is stale (e.g. the password was
      // changed on another device). Only wrong-password errors fall through to the server check;
      // anything else (malformed blob, key mismatch) is rethrown.
      if (!(err instanceof WrongPasswordError)) throw err;
    }
  }

  // Fetch the authoritative server copy and refresh a stale cache before decrypting.
  const remote = await getBackup(token, walletId);
  if (!remote || !remote.encrypted_backup) {
    throw new Error(MISSING_BACKUP_ERROR);
  }

  const serverVersion = versionOf(remote);
  const localVersion = local?.version ?? "";

  if (!local || serverVersion !== localVersion) {
    // Stale or missing cache — replace it with the server-authoritative copy.
    const parsed = parseBackup(remote.encrypted_backup);
    saveLocalBackup(walletId, parsed, serverVersion);
    const mnemonic = await unlockFromBackup(parsed, password, expectedPublicKey);
    return { mnemonic, backup: parsed, version: serverVersion };
  }

  // Cache version matches the server: the password is simply wrong.
  throw new WrongPasswordError();
}

export async function unlockWallet(
  token: string,
  walletId: string,
  password: string,
  expectedPublicKey?: string,
): Promise<Keypair> {
  const { mnemonic } = await unlockBackup(token, walletId, password, expectedPublicKey);
  return fromMnemonic(mnemonic).keypair;
}
