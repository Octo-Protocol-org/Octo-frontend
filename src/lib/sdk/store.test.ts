import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLocalBackups, loadLocalBackup, saveLocalBackup, versionOf } from "./store";

const backup = {
  v: 1 as const,
  kdf: "PBKDF2-SHA256" as const,
  iter: 600_000,
  salt: "salt",
  nonce: "nonce",
  ciphertext: "ciphertext",
};

describe("wallet backup storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back cleanly when storage reads and writes throw", () => {
    const warning = vi.fn();
    const throwingStorage = {
      getItem: () => { throw new DOMException("blocked", "SecurityError"); },
      setItem: () => { throw new DOMException("blocked", "SecurityError"); },
      removeItem: () => { throw new DOMException("blocked", "SecurityError"); },
    };
    vi.stubGlobal("localStorage", throwingStorage);
    vi.stubGlobal("window", {
      dispatchEvent: warning,
    });

    expect(() => saveLocalBackup("wallet-1", backup)).not.toThrow();
    expect(saveLocalBackup("wallet-1", backup)).toBe(false);
    expect(loadLocalBackup("wallet-1")).toBeNull();
    expect(() => clearLocalBackups()).not.toThrow();
    expect(warning).toHaveBeenCalled();
  });
});

describe("versionOf", () => {
  it("prefers backup_version, falls back to the blob string", () => {
    expect(versionOf({ backup_version: "v2", encrypted_backup: "blob" })).toBe("v2");
    expect(versionOf({ backup_version: null, encrypted_backup: "blob" })).toBe("blob");
    expect(versionOf({})).toBe("");
  });
});
