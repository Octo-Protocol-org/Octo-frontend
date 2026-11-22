import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPhraseConfirmed, markPhraseConfirmed } from "./phraseConfirmation";

// Mirror the localStorage stub pattern used in sdk/store.test.ts.
const storage = new Map<string, string>();
let _throwOnAccess = false;

const mockLocalStorage = {
  getItem: (key: string) => {
    if (_throwOnAccess) throw new DOMException("blocked", "SecurityError");
    return storage.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (_throwOnAccess) throw new DOMException("blocked", "SecurityError");
    storage.set(key, value);
  },
  removeItem: (key: string) => storage.delete(key),
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
  get length() { return storage.size; },
  clear: () => storage.clear(),
};

if (typeof window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = globalThis;
}
Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true });

describe("phraseConfirmation", () => {
  beforeEach(() => { storage.clear(); _throwOnAccess = false; });
  afterEach(() => { storage.clear(); _throwOnAccess = false; });

  it("returns false for a wallet that has never been confirmed", () => {
    expect(isPhraseConfirmed("wallet-new")).toBe(false);
  });

  it("returns true after markPhraseConfirmed is called", () => {
    markPhraseConfirmed("wallet-abc");
    expect(isPhraseConfirmed("wallet-abc")).toBe(true);
  });

  it("wallets are independent — confirming one does not affect another", () => {
    markPhraseConfirmed("wallet-1");
    expect(isPhraseConfirmed("wallet-1")).toBe(true);
    expect(isPhraseConfirmed("wallet-2")).toBe(false);
  });

  it("falls back to true (no spurious warning) when localStorage throws on access", () => {
    _throwOnAccess = true;
    expect(() => markPhraseConfirmed("wallet-x")).not.toThrow();
    expect(isPhraseConfirmed("wallet-x")).toBe(true);
  });
});
