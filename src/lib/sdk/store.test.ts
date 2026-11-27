import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLocalBackups, loadLocalBackup, saveLocalBackup, versionOf, markPhraseUnconfirmed, markPhraseConfirmed, isPhraseUnconfirmed, listUnconfirmedPhraseWalletIds } from "./store";

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

describe("phrase confirmation tracking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks, confirms, and lists unconfirmed wallets", () => {
    const storage = (() => {
      const items = new Map<string, string>();
      return {
        getItem: (k: string) => items.get(k) ?? null,
        setItem: (k: string, v: string) => { items.set(k, v); },
        removeItem: (k: string) => { items.delete(k); },
        get length() { return items.size; },
        key: (i: number) => [...items.keys()][i] ?? null,
      };
    })();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });

    expect(isPhraseUnconfirmed("wallet-a")).toBe(false);

    markPhraseUnconfirmed("wallet-a");
    markPhraseUnconfirmed("wallet-b");
    expect(isPhraseUnconfirmed("wallet-a")).toBe(true);
    expect(listUnconfirmedPhraseWalletIds()).toContain("wallet-a");
    expect(listUnconfirmedPhraseWalletIds()).toContain("wallet-b");

    markPhraseConfirmed("wallet-a");
    expect(isPhraseUnconfirmed("wallet-a")).toBe(false);
    expect(listUnconfirmedPhraseWalletIds()).not.toContain("wallet-a");
    expect(listUnconfirmedPhraseWalletIds()).toContain("wallet-b");
  });
});
