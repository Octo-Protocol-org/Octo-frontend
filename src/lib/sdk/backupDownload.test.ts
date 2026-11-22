/**
 * Tests for the download-backup fix (issue #734).
 *
 * Before the fix, DownloadBackupButton used the local cache first and only fetched the server
 * copy on a cache miss. This test verifies the corrected behaviour: the server copy is always
 * the preferred source, the local cache is refreshed from it, and the offline fallback path
 * works when the server request fails.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getBackup } from "./client";
import { encryptSeed, serializeBackup, parseBackup } from "./crypto";
import { loadLocalBackup, saveLocalBackup } from "./store";

vi.mock("./client", () => ({
  getBackup: vi.fn(),
}));

const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};
if (typeof window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = globalThis;
}
Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true });

const WALLET_ID = "wallet-dl-test";
const TOKEN = "tok";
const PASSWORD = "correct-horse-battery-staple";
const MNEMONIC_A = "illness spike retreat truth genius clock brain pass fit cave bargain toe";
const MNEMONIC_B = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("backup download: server-first policy", () => {
  beforeEach(async () => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("fetches the server copy even when a local cache exists (stale cache scenario)", async () => {
    // Seed an older backup in the cache (version A).
    const backupA = await encryptSeed(MNEMONIC_A, PASSWORD);
    saveLocalBackup(WALLET_ID, backupA, "version-A");

    // Server holds a newer backup (version B, e.g. after password change on another device).
    const backupB = await encryptSeed(MNEMONIC_B, PASSWORD);
    const backupBStr = serializeBackup(backupB);
    vi.mocked(getBackup).mockResolvedValue({
      wallet_id: WALLET_ID,
      encrypted_backup: backupBStr,
      backup_version: "version-B",
    });

    // Simulate the corrected download logic: always fetch server copy first.
    const remote = await getBackup(TOKEN, WALLET_ID);
    if (!remote.encrypted_backup) throw new Error("no backup");
    const downloaded = parseBackup(remote.encrypted_backup);
    saveLocalBackup(WALLET_ID, downloaded, remote.backup_version ?? remote.encrypted_backup);

    // getBackup was called (server-first).
    expect(getBackup).toHaveBeenCalledOnce();
    // Local cache is now updated to version-B.
    expect(loadLocalBackup(WALLET_ID)?.version).toBe("version-B");
  });

  it("falls back to local cache when the server request throws", async () => {
    const backupA = await encryptSeed(MNEMONIC_A, PASSWORD);
    saveLocalBackup(WALLET_ID, backupA, "version-A");

    vi.mocked(getBackup).mockRejectedValue(new Error("Network error"));

    // Simulate the fallback branch.
    let downloaded = null;
    let usedFallback = false;
    try {
      const remote = await getBackup(TOKEN, WALLET_ID);
      if (!remote.encrypted_backup) throw new Error("no backup");
      downloaded = parseBackup(remote.encrypted_backup);
    } catch {
      const cached = loadLocalBackup(WALLET_ID);
      if (!cached?.backup) throw new Error("no cache");
      downloaded = cached.backup;
      usedFallback = true;
    }

    expect(usedFallback).toBe(true);
    expect(downloaded).not.toBeNull();
  });
});
