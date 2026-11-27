import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { isAuthenticationFailure } from "./useAuth";

const replaceMock = vi.fn();
const refreshMock = vi.fn();
const pathnameMock = vi.fn(() => "/dashboard");

// A stable router object, as Next provides, so effects keyed on it don't re-run every render.
const router = { replace: replaceMock, refresh: refreshMock, push: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => router,
}));

const meMock = vi.fn();
const getTokenMock = vi.fn();
const logoutCurrentSessionMock = vi.fn();
const signOutMock = vi.fn();
const broadcastLogoutMock = vi.fn();
const subscribeToLogoutMock = vi.fn();

vi.mock("./auth", () => ({
  TOKEN_KEY: "octo_token",
  me: (...args: unknown[]) => meMock(...args),
  getToken: (...args: unknown[]) => getTokenMock(...args),
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
    replaceMock.mockReset();
    refreshMock.mockReset();
    meMock.mockReset();
    getTokenMock.mockReset();
    logoutCurrentSessionMock.mockReset();
    signOutMock.mockReset();
    broadcastLogoutMock.mockReset();
    subscribeToLogoutMock.mockReset();
    getTokenMock.mockReturnValue("token");
    subscribeToLogoutMock.mockReturnValue(() => {});
    meMock.mockResolvedValue({ id: "1", email: "user@example.com" });
    logoutCurrentSessionMock.mockResolvedValue(undefined);
  });

  it("redirects to /login exactly once when several 401s arrive together", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    replaceMock.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fdashboard&reason=expired");
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(logoutCurrentSessionMock).not.toHaveBeenCalled();
  });

  it("revokes the current session on the server when logout() is called", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    replaceMock.mockClear();
    logoutCurrentSessionMock.mockClear();

    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => {
      expect(logoutCurrentSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(logoutCurrentSessionMock).toHaveBeenCalledWith("token");
    expect(signOutMock).toHaveBeenCalled();
    expect(broadcastLogoutMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fdashboard");
  });

  it("still signs out locally when the server revoke request fails", async () => {
    logoutCurrentSessionMock.mockRejectedValue(new TypeError("offline"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    replaceMock.mockClear();

    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fdashboard");
    });

    expect(signOutMock).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("includes the query string and hash in the encoded next param", async () => {
    // happy-dom provides a real location, so set the URL instead of redefining window.location.
    window.history.replaceState(null, "", "/dashboard/wallets/abc/transactions?before=xyz#top");
    pathnameMock.mockReturnValue("/dashboard/wallets/abc/transactions");

    try {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      replaceMock.mockClear();

      await act(async () => {
        await result.current.logout();
      });

      const expectedNext = encodeURIComponent(
        "/dashboard/wallets/abc/transactions?before=xyz#top",
      );

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith(`/login?next=${expectedNext}`);
      });
    } finally {
      window.history.replaceState(null, "", "/");
      pathnameMock.mockReturnValue("/dashboard");
    }
  });

  it("signs the user out when a storage event removes octo_token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    replaceMock.mockClear();

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
    expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fdashboard");
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(logoutCurrentSessionMock).not.toHaveBeenCalled();
  });

  it("re-calls me() when retrySessionCheck is invoked", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(meMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retrySessionCheck();
    });

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(2);
    });

    expect(result.current.user).not.toBeNull();
  });
});