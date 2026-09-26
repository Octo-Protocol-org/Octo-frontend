import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Build a localStorage-compatible stub where stored keys are enumerable own properties,
 * matching how Object.keys(localStorage) behaves in a real browser.
 */
function makeLocalStorage(): Storage {
  // Keep items in a map; expose them as enumerable properties via a Proxy.
  const items = new Map<string, string>();

  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === "getItem") return (k: string) => items.get(k) ?? null;
      if (prop === "setItem") return (k: string, v: string) => { items.set(k, v); };
      if (prop === "removeItem") return (k: string) => { items.delete(k); };
      if (prop === "clear") return () => items.clear();
      if (prop === "length") return items.size;
      if (prop === "key") return (i: number) => [...items.keys()][i] ?? null;
      // Enumerate stored keys as direct property access too.
      return items.get(prop) ?? undefined;
    },
    set(_t, prop: string, value: string) {
      items.set(prop, value);
      return true;
    },
    has(_t, prop: string) {
      return items.has(prop);
    },
    ownKeys() {
      return [...items.keys()];
    },
    getOwnPropertyDescriptor(_t, prop: string) {
      if (!items.has(prop)) return undefined;
      return { configurable: true, enumerable: true, value: items.get(prop) };
    },
  };

  return new Proxy({}, handler) as unknown as Storage;
}

// ---------- #285 — signOut helper ----------

describe("#285 signOut()", () => {
  beforeEach(() => {
    const storage = makeLocalStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("clears the session token", async () => {
    const { saveToken, getToken, signOut } = await import("./auth");
    saveToken("tok-123");
    expect(getToken()).toBe("tok-123");
    signOut();
    expect(getToken()).toBeNull();
  });

  it("clears all octo_wallet_backup_* keys", async () => {
    const { signOut } = await import("./auth");
    // Seed backup keys directly into the stub.
    localStorage.setItem("octo_wallet_backup_wallet-1", '{"v":1}');
    localStorage.setItem("octo_wallet_backup_wallet-2", '{"v":1}');
    expect(localStorage.getItem("octo_wallet_backup_wallet-1")).not.toBeNull();
    signOut();
    expect(localStorage.getItem("octo_wallet_backup_wallet-1")).toBeNull();
    expect(localStorage.getItem("octo_wallet_backup_wallet-2")).toBeNull();
  });

  it("leaves unrelated localStorage keys intact", async () => {
    const { signOut } = await import("./auth");
    localStorage.setItem("other-key", "keep-me");
    signOut();
    expect(localStorage.getItem("other-key")).toBe("keep-me");
  });
});

// ---------- #286 — same-origin guard for ?next= ----------

describe("#286 same-origin guard", () => {
  // The validation lives in src/app/login/page.tsx (server component).
  // We replicate the regex here to test it in isolation.
  const isSafeNext = (v: string) => /^\/(?!\/)/.test(v);

  it("accepts a plain relative path", () => {
    expect(isSafeNext("/dashboard")).toBe(true);
  });

  it("accepts a deep relative path", () => {
    expect(isSafeNext("/dashboard/wallets/abc")).toBe(true);
  });

  it("rejects a protocol-relative URL", () => {
    expect(isSafeNext("//evil.com")).toBe(false);
  });

  it("rejects an absolute https URL", () => {
    expect(isSafeNext("https://evil.com/steal")).toBe(false);
  });

  it("rejects a javascript: URL", () => {
    expect(isSafeNext("javascript:alert(1)")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeNext("")).toBe(false);
  });
});

// ---------- #286 — session-expired event emission on 401 ----------

describe("#286 apiFetch emits session-expired on 401", () => {
  it("dispatches the event when a token request returns 401", async () => {
    const events: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (e: Event) => { events.push(e.type); },
    });

    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, message: "Unauthorized", data: null }),
    }));

    const { apiFetch } = await import("./api");
    await expect(apiFetch("/v1/auth/me", { token: "expired-tok" })).rejects.toThrow();
    expect(events).toContain("session-expired");
  });

  it("does NOT emit session-expired for unauthenticated 401 (no token)", async () => {
    const events: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (e: Event) => { events.push(e.type); },
    });

    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, message: "Unauthorized", data: null }),
    }));

    const { apiFetch } = await import("./api");
    await expect(apiFetch("/v1/auth/login", {})).rejects.toThrow();
    expect(events).not.toContain("session-expired");
  });
});
