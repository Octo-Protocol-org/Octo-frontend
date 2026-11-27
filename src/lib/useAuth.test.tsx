import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { isAuthenticationFailure } from "./useAuth";

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const meMock = vi.fn();
const loginMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    me: (...args: unknown[]) => meMock(...args),
    login: (...args: unknown[]) => loginMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
  };
});

const clearTokenMock = vi.fn();
const getTokenMock = vi.fn();
const logoutCurrentSessionMock = vi.fn();
const signOutMock = vi.fn();
const broadcastLogoutMock = vi.fn();
const subscribeToLogoutMock = vi.fn();

vi.mock("./auth", () => ({
  clearToken: (...args: unknown[]) => clearTokenMock(...args),
  getToken: (...args: unknown[]) => getTokenMock(...args),
  setToken: vi.fn(),
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
    loginMock.mockReset();
    logoutMock.mockReset();
    clearTokenMock.mockReset();
    getTokenMock.mockReset();
    logoutCurrentSessionMock.mockReset();
    signOutMock.mockReset();
    broadcastLogoutMock.mockReset();
    subscribeToLogoutMock.mockReset();
    getTokenMock.mockReturnValue("token");
    meMock.mockResolvedValue({ id: "1", email: "user@example.com" });
    logoutMock.mockResolvedValue(undefined);
    logoutCurrentSessionMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(clearTokenMock).toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledTimes(1);
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
    expect(clearTokenMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/login");
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
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });

    expect(clearTokenMock).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("includes the query string and hash in the encoded next param", async () => {
    const originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        pathname: "/dashboard/wallets/abc/transactions",
        search: "?before=xyz",
        hash: "#top",
        href: "http://localhost/dashboard/wallets/abc/transactions?before=xyz#top",
        origin: "http://localhost",
      },
    });

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
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
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

    expect(clearTokenMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/login");
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