// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MISSING_BACKUP_ERROR, unlockBackup, unlockWallet } from "./unlock";
import { getBackup } from "./client";
import { encryptSeed, serializeBackup, type EncryptedBackup } from "./crypto";
import { loadLocalBackup, saveLocalBackup } from "./store";
import { fromMnemonic } from "./keys";

// Mock client module to spy on getBackup calls.
vi.mock("./client", () => ({
  getBackup: vi.fn(),
}));

const TEST_MNEMONIC = "illness spike retreat truth genius clock brain pass fit cave bargain toe";
const TEST_PASSWORD = "correct-horse-battery-staple";
const WALLET_ID = "wallet-xyz-123";
const TOKEN = "test-auth-token";

describe("unlockWallet", () => {
  let validBackupObj: EncryptedBackup;
  let validBackupString: string;
  let expectedPublicKey: string;

  beforeEach(async () => {
    validBackupObj = await encryptSeed(TEST_MNEMONIC, TEST_PASSWORD);
    validBackupString = serializeBackup(validBackupObj);
    expectedPublicKey = fromMnemonic(TEST_MNEMONIC).publicKey;
  });

  // Prefer local backup without making a network request to the server.
  it("uses local backup when available and does not call server", async () => {
    saveLocalBackup(WALLET_ID, validBackupObj, "1");
    const keypair = await unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD);
    expect(keypair.publicKey()).toBe(expectedPublicKey);
    expect(getBackup).not.toHaveBeenCalled();
    expect(loadLocalBackup(WALLET_ID)?.backup).toEqual(validBackupObj);
    expect(loadLocalBackup(WALLET_ID)?.version).toBe("1");
  });

  // Fall back to server backup when local cache is empty, then cache it locally.
  it("fetches server backup on cache miss and stores it locally", async () => {
    vi.mocked(getBackup).mockResolvedValueOnce({
      wallet_id: WALLET_ID,
      encrypted_backup: validBackupString,
      backup_version: "3",
    });
    const keypair = await unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD);
    expect(keypair.publicKey()).toBe(expectedPublicKey);
    expect(getBackup).toHaveBeenCalledWith(TOKEN, WALLET_ID);
    expect(loadLocalBackup(WALLET_ID)?.backup).toEqual(validBackupObj);
    expect(loadLocalBackup(WALLET_ID)?.version).toBe("3");
  });

  // Throw clear recovery error if neither local nor server backup exists.
  it("throws clear error when backup is missing from both local and server", async () => {
    vi.mocked(getBackup).mockResolvedValueOnce({
      wallet_id: WALLET_ID,
      encrypted_backup: null,
      backup_version: "1",
    });
    await expect(unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD)).rejects.toThrow(
      MISSING_BACKUP_ERROR,
    );
  });

  // Throw MISSING_BACKUP_ERROR when the server returns no backup at all.
  it("throws MISSING_BACKUP_ERROR when server returns no backup", async () => {
    // Simulate a server that answers with no backup body at all.
    vi.mocked(getBackup).mockResolvedValueOnce(undefined as unknown as Awaited<ReturnType<typeof getBackup>>);
    await expect(unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD)).rejects.toThrow(
      MISSING_BACKUP_ERROR,
    );
    expect(loadLocalBackup(WALLET_ID)).toBeNull();
  });

  // Refresh a stale local cache from the server and persist the new version.
  it("refreshes a stale local backup from the server", async () => {
    const staleBackupObj = await encryptSeed(TEST_MNEMONIC, "old-password");
    saveLocalBackup(WALLET_ID, staleBackupObj, "1");
    vi.mocked(getBackup).mockResolvedValueOnce({
      wallet_id: WALLET_ID,
      encrypted_backup: validBackupString,
      backup_version: "2",
    });
    const keypair = await unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD);
    expect(keypair.publicKey()).toBe(expectedPublicKey);
    expect(getBackup).toHaveBeenCalledWith(TOKEN, WALLET_ID);
    expect(loadLocalBackup(WALLET_ID)?.backup).toEqual(validBackupObj);
    expect(loadLocalBackup(WALLET_ID)?.version).toBe("2");
  });

  // Reject unlock attempt when password provided is incorrect.
  it("rejects when password is wrong", async () => {
    saveLocalBackup(WALLET_ID, validBackupObj, "1");
    await expect(unlockWallet(TOKEN, WALLET_ID, "wrong-password")).rejects.toThrow();
  });

  // A matching local version with a wrong password throws without re-saving.
  it("does not re-save when local version matches and password is wrong", async () => {
    saveLocalBackup(WALLET_ID, validBackupObj, "5");
    vi.mocked(getBackup).mockResolvedValueOnce({
      wallet_id: WALLET_ID,
      encrypted_backup: validBackupString,
      backup_version: "5",
    });
    await expect(unlockWallet(TOKEN, WALLET_ID, "wrong-password")).rejects.toThrow();
    expect(loadLocalBackup(WALLET_ID)?.backup).toEqual(validBackupObj);
    expect(loadLocalBackup(WALLET_ID)?.version).toBe("5");
  });

  // Reject unlock when the derived key does not match the expected wallet public key.
  it("rejects when the unlocked key does not match the expected wallet", async () => {
    saveLocalBackup(WALLET_ID, validBackupObj, "1");
    const wrongKey = fromMnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about").publicKey;
    await expect(unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD, wrongKey)).rejects.toThrow(
      "Unlocked key does not match this wallet. Aborting unlock.",
    );
  });

  // Accept unlock when the derived key matches the expected wallet public key.
  it("accepts when the unlocked key matches the expected wallet", async () => {
    saveLocalBackup(WALLET_ID, validBackupObj, "1");
    const keypair = await unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD, expectedPublicKey);
    expect(keypair.publicKey()).toBe(expectedPublicKey);
  });

  // Reject unlock attempt and do not cache if server blob is malformed.
  it("rejects when server blob is malformed and does not cache invalid blob", async () => {
    vi.mocked(getBackup).mockResolvedValueOnce({
      wallet_id: WALLET_ID,
      encrypted_backup: "invalid-backup-json",
      backup_version: "1",
    });
    await expect(unlockWallet(TOKEN, WALLET_ID, TEST_PASSWORD)).rejects.toThrow();
    expect(loadLocalBackup(WALLET_ID)).toBeNull();
  });

  it("unlockBackup rejects a cached backup that belongs to another wallet", async () => {
    saveLocalBackup(WALLET_ID, validBackupObj, "v1");
    const other = fromMnemonic(
      "legal winner thank year wave sausage worth useful legal winner thank yellow",
    ).publicKey;
    await expect(unlockBackup(TOKEN, WALLET_ID, TEST_PASSWORD, other)).rejects.toThrow(
      /does not match this wallet/,
    );
    expect(getBackup).not.toHaveBeenCalled();
  });
});
