import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Paginated } from "./pagination";
import { useCursorPagination } from "./useCursorPagination";

type Row = { id: string };

const page = (ids: string[], next: string | null = null): Paginated<Row> => ({
  data: ids.map((id) => ({ id })),
  next_cursor: next,
});

// A promise whose resolution the test controls, to reorder responses.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Three pages linked by cursors c1 -> c2.
const PAGES: Record<string, Paginated<Row>> = {
  first: page(["a"], "c1"),
  c1: page(["b"], "c2"),
  c2: page(["c"], null),
};
const linkedFetch = () => vi.fn(async (before: string | null): Promise<Paginated<Row>> => PAGES[before ?? "first"]!);

describe("useCursorPagination", () => {
  it("loads page 1 with fetchPage(null) and sets rows, hasNext and loaded", async () => {
    const fetchPage = linkedFetch();
    const { result } = renderHook(() => useCursorPagination(fetchPage, [], "failed"));

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(fetchPage).toHaveBeenCalledExactlyOnceWith(null);
    expect(result.current.rows).toEqual([{ id: "a" }]);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.page).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it("next() pushes the cursor and prev() re-requests the previous cursor", async () => {
    const fetchPage = linkedFetch();
    const { result } = renderHook(() => useCursorPagination(fetchPage, [], "failed"));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "a" }]));

    act(() => result.current.next());
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "b" }]));
    expect(fetchPage).toHaveBeenLastCalledWith("c1");
    expect(result.current.page).toBe(2);

    act(() => result.current.next());
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "c" }]));
    expect(fetchPage).toHaveBeenLastCalledWith("c2");
    expect(result.current.hasNext).toBe(false);

    act(() => result.current.prev());
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "b" }]));
    expect(fetchPage).toHaveBeenLastCalledWith("c1");
    expect(result.current.page).toBe(2);

    act(() => result.current.prev());
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "a" }]));
    expect(fetchPage).toHaveBeenLastCalledWith(null);
    expect(result.current.hasPrev).toBe(false);
  });

  it("ignores a slow page-1 response that arrives after page 2", async () => {
    const first = deferred<Paginated<Row>>();
    const second = deferred<Paginated<Row>>();
    const fetchPage = vi
      .fn<(before: string | null) => Promise<Paginated<Row>>>()
      .mockResolvedValueOnce(page(["a"], "c1"))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useCursorPagination(fetchPage, [], "failed"));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "a" }]));

    // A refresh of page 1 is in flight when the user moves to page 2.
    act(() => void result.current.refresh());
    act(() => result.current.next());
    expect(fetchPage).toHaveBeenCalledTimes(3);

    await act(async () => second.resolve(page(["b"])));
    await act(async () => first.resolve(page(["stale"], "c1")));

    expect(result.current.rows).toEqual([{ id: "b" }]);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("refreshSilently() neither toggles loading nor overwrites error", async () => {
    const silent = deferred<Paginated<Row>>();
    const fetchPage = vi
      .fn<(before: string | null) => Promise<Paginated<Row>>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockReturnValueOnce(silent.promise)
      .mockRejectedValueOnce(new Error("silent failure"));
    const { result } = renderHook(() => useCursorPagination(fetchPage, [], "failed"));
    await waitFor(() => expect(result.current.error).toBe("boom"));

    act(() => void result.current.refreshSilently());
    expect(result.current.loading).toBe(false);
    await act(async () => silent.resolve(page(["a"])));
    expect(result.current.rows).toEqual([{ id: "a" }]);
    expect(result.current.loading).toBe(false);

    // A failed silent refresh keeps the current rows and does not surface an error.
    await act(async () => result.current.refreshSilently());
    expect(result.current.rows).toEqual([{ id: "a" }]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("resets to page 1 when deps change", async () => {
    const fetchPage = linkedFetch();
    const { result, rerender } = renderHook(
      ({ walletId }) => useCursorPagination(fetchPage, [walletId], "failed"),
      { initialProps: { walletId: "w1" } },
    );
    await waitFor(() => expect(result.current.rows).toEqual([{ id: "a" }]));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.page).toBe(2));

    rerender({ walletId: "w2" });

    await waitFor(() => expect(result.current.rows).toEqual([{ id: "a" }]));
    expect(result.current.page).toBe(1);
    expect(result.current.hasPrev).toBe(false);
    expect(fetchPage).toHaveBeenLastCalledWith(null);
  });

  it("makes no request while enabled is false", async () => {
    const fetchPage = linkedFetch();
    const { result, rerender } = renderHook(
      ({ enabled }) => useCursorPagination(fetchPage, [], "failed", enabled),
      { initialProps: { enabled: false } },
    );

    await act(async () => {});
    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current.loaded).toBe(false);

    rerender({ enabled: true });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledExactlyOnceWith(null));
  });
});
