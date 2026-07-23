/**
 * Local (browser) persistence of the encrypted seed backup, keyed by wallet id.
 *
 * The blob is the SAME opaque ciphertext the server stores — it is useless without the user's
 * password. Keeping a copy locally lets the dashboard unlock a wallet for signing without a
 * server round-trip, and survives if the server copy is ever unavailable. Cleared on logout.
 */
import { parseBackup, type EncryptedBackup } from "./crypto";

const PREFIX = "octo_wallet_backup_";

export function saveLocalBackup(walletId: string, backup: EncryptedBackup) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + walletId, JSON.stringify(backup));
}

export function loadLocalBackup(walletId: string): EncryptedBackup | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PREFIX + walletId);
  if (!raw) return null;
  try {
    return parseBackup(raw);
  } catch {
    return null;
  }
}

export function clearLocalBackups() {
  if (typeof window === "undefined") return;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  }
}
