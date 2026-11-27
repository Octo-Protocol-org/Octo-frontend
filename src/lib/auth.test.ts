// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { safeNextPath } from "./safeNext";

// ---------- #285 — signOut helper ----------

describe("#285 signOut()", () => {
  afterEach(() => {
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

// ---------- #643 — logoutCurrentSession() ----------

describe("#643 logoutCurrentSession()", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("sends the bearer token with keepalive to the current-session revoke endpoint", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ statusCode: 200, message: "ok", data: null }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { logoutCurrentSession } = await import("./auth");
    await logoutCurrentSession("tok-abc");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/sessions\/current$/);
    expect(init.method).toBe("DELETE");
    expect(init.keepalive).toBe(true);
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer tok-abc");
  });

  it("resolves (does not reject) when the request fails at the network level", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    const { logoutCurrentSession } = await import("./auth");
    await expect(logoutCurrentSession("tok-abc")).resolves.toBeUndefined();
  });

  it("resolves (does not reject) when the server returns an error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ statusCode: 500, message: "boom", data: null }),
    })));

    const { logoutCurrentSession } = await import("./auth");
    await expect(logoutCurrentSession("tok-abc")).resolves.toBeUndefined();
  });
});

// ---------- #286 — same-origin guard for ?next= ----------

describe("#286 same-origin guard", () => {
  const isSafeNext = (v: unknown) => safeNextPath(v) !== undefined;

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

  it("rejects backslash and control-character tricks", () => {
    expect(isSafeNext("/\\evil.com")).toBe(false);
    expect(isSafeNext("/\t/evil.com")).toBe(false);
    expect(isSafeNext("/\n/evil.com")).toBe(false);
  });

  it("rejects a repeated ?next= array", () => {
    expect(isSafeNext(["/a", "/b"])).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeNext("")).toBe(false);
  });
});

// ---------- #611 — verify2fa request contract ----------

describe("#611 verify2fa()", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("POSTs the code to /auth/2fa/challenge with the challenge token as bearer", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ statusCode: 200, message: "ok", data: { token: "session-tok" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { verify2fa } = await import("./auth");
    const result = await verify2fa("challenge-abc", "123456");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/auth\/2fa\/challenge$/);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer challenge-abc");
    expect(headers["content-type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ code: "123456" }));
    expect(result).toBe("session-tok");
  });
});

// ---------- #286 — session-expired event emission on 401 ----------

describe("#286 apiFetch emits session-expired on 401", () => {
  it("dispatches the event when a token request returns 401", async () => {
    const events: string[] = [];
    vi.spyOn(window, "dispatchEvent").mockImplementation((e: Event) => { events.push(e.type); return true; });

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
    vi.spyOn(window, "dispatchEvent").mockImplementation((e: Event) => { events.push(e.type); return true; });

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
