// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { isAuthenticationFailure } from "./useAuth";

// Stable router mock — must be declared before vi.mock hoisting captures the reference.
// Using a module-scoped object so useEffect([router]) sees the same reference every render.
const _router = {
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => _router,
  usePathname: () => "/dashboard",
}));

const getTokenMock = vi.fn();
const logoutCurrentSessionMock = vi.fn();
const signOutMock = vi.fn();
const broadcastLogoutMock = vi.fn();
const subscribeToLogoutMock = vi.fn();
const meMock = vi.fn();

vi.mock("./auth", () => ({
  TOKEN_KEY: "octo_token",
  getToken: (...args: unknown[]) => getTokenMock(...args),
  me: (...args: unknown[]) => meMock(...args),
  logoutCurrentSession: (...args: unknown[]) => logoutCurrentSessionMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
  broadcastLogout: (...args: unknown[]) => broadcastLogoutMock(...args),
  subscribeToLogout: (...args: unknown[]) => subscribeToLogoutMock(...args),
}));

const { AuthProvider, useAuth, isAuthenticationFailure: isAuthFailureFromModule } =
  await import("./useAuth");

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

/** Shorthand for the router.replace mock. */
function replaceMock() { return _router.replace; }

describe("isAuthenticationFailure", () => {
  it("classifies unauthorized and forbidden responses as destructive auth failures", () => {
    expect(isAuthenticationFailure(new ApiError("expired", 401))).toBe(true);
    expect(isAuthenticationFailure(new ApiError("forbidden", 403))).toBe(true);
  });

  it("keeps timeout, server, and network errors retryable", () => {
    expect(isAuthenticationFailure(new ApiError("timed out", 0))).toBe(false);
    expect(isAuthenticationFailure(new ApiError("server error", 500))).toBe(false);
    expect(isAuthenticationFailure(new TypeError("offline"))).toBe(false);
  });

  it("is exported consistently from the module", () => {
    expect(isAuthFailureFromModule).toBe(isAuthenticationFailure);
  });
});

describe("useAuth session handling", () => {
  beforeEach(() => {
    _router.replace.mockReset();
    _router.refresh.mockReset();
    meMock.mockReset();
    getTokenMock.mockReset();
    logoutCurrentSessionMock.mockReset();
    signOutMock.mockReset();
    broadcastLogoutMock.mockReset();
    subscribeToLogoutMock.mockReset();
    getTokenMock.mockReturnValue("token");
    meMock.mockResolvedValue({ id: "1", email: "user@example.com" });
    logoutCurrentSessionMock.mockResolvedValue(undefined);
    // subscribeToLogout must return an unsubscribe function.
    subscribeToLogoutMock.mockReturnValue(() => {});
  });

  afterEach(async () => {
    // Ensure effects (including event-listener teardowns) are flushed before the next test.
    await act(async () => {
      cleanup();
    });
    vi.restoreAllMocks();
  });

  it("redirects to /login exactly once when several 401s arrive together", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    _router.replace.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
    });

    await waitFor(() => {
      expect(_router.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    });

    expect(_router.replace).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(logoutCurrentSessionMock).not.toHaveBeenCalled();
    // Expired sessions include reason=expired in the redirect URL.
    expect(_router.replace.mock.calls[0][0]).toContain("reason=expired");
  });

  it("revokes the current session on the server when logout() is called", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    _router.replace.mockClear();
    logoutCurrentSessionMock.mockClear();

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(logoutCurrentSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(logoutCurrentSessionMock).toHaveBeenCalledWith("token");
    expect(signOutMock).toHaveBeenCalled();
    expect(_router.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    // Explicit logout should not include reason=expired.
    expect(_router.replace.mock.calls[0][0]).not.toContain("reason=expired");
  });

  it("still signs out locally when the server revoke request fails", async () => {
    logoutCurrentSessionMock.mockRejectedValue(new TypeError("offline"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    _router.replace.mockClear();

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(_router.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    });

    expect(signOutMock).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("includes the query string and hash in the encoded next param", async () => {
    // The code reads pathname from usePathname() ("/dashboard") and appends
    // window.location.search + window.location.hash. We mock window.location's
    // search and hash fields to exercise that path.
    const originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        search: "?before=xyz",
        hash: "#top",
      },
    });

    try {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      _router.replace.mockClear();

      act(() => {
        result.current.logout();
      });

      // pathname = "/dashboard" (from usePathname mock), search and hash from window.location
      const expectedNext = encodeURIComponent("/dashboard?before=xyz#top");

      await waitFor(() => {
        expect(_router.replace).toHaveBeenCalledWith(expect.stringContaining(expectedNext));
      });
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });

  it("signs the user out when a storage event removes the token key", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    _router.replace.mockClear();

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "octo_token",
          newValue: null,
          oldValue: "token",
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    expect(signOutMock).toHaveBeenCalled();
    expect(_router.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    expect(_router.replace).toHaveBeenCalledTimes(1);
    expect(logoutCurrentSessionMock).not.toHaveBeenCalled();
  });

  it("re-calls me() when retrySessionCheck is invoked", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    const callCount = meMock.mock.calls.length;

    act(() => {
      result.current.retrySessionCheck();
    });

    await waitFor(() => {
      expect(meMock.mock.calls.length).toBeGreaterThan(callCount);
    });

    expect(result.current.user).not.toBeNull();
  });

  it("signs out via TOKEN_KEY and ignores unrelated storage events (#698)", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    _router.replace.mockClear();
    signOutMock.mockClear();

    // An unrelated storage key must not trigger sign-out.
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "some_other_key", newValue: null }),
      );
    });

    expect(_router.replace).not.toHaveBeenCalled();

    // Removing TOKEN_KEY must trigger cross-tab sign-out.
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "octo_token", newValue: null, oldValue: "token" }),
      );
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    // signOut is called exactly once (the signingOut guard prevents duplicates).
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(_router.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
  });

  it("does not set loading=false after a retry cancels the first attempt's timer (#697)", async () => {
    vi.useFakeTimers();

    // First and second attempts both succeed.
    meMock
      .mockResolvedValueOnce({ id: "1", email: "user@example.com" })
      .mockResolvedValueOnce({ id: "1", email: "user@example.com" });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Flush the first me() call but don't advance the 700ms timer yet.
    await act(async () => {
      await Promise.resolve();
    });

    // loading is still true: the minimum-spinner timer hasn't elapsed.
    expect(result.current.loading).toBe(true);

    // Trigger retry — the first effect cleans up (cancelling its pending timer).
    act(() => {
      result.current.retrySessionCheck();
    });

    // Advance past 700ms. The first effect's timer (if not cancelled) would flip loading=false.
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });

    // loading must eventually settle to false when the second attempt completes.
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);

    vi.useRealTimers();
  });
});
