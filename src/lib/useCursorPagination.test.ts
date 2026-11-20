import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCursorPagination } from './useCursorPagination';

type Row = { id: string };

type Page = {
  rows: Row[];
  nextCursor: string | null;
  prevCursor: string | null;
};

function makePage(ids: string[], nextCursor: string | null = null, prevCursor: string | null = null): Page {
  return {
    rows: ids.map((id) => ({ id })),
    nextCursor,
    prevCursor,
  };
}

describe('useCursorPagination', () => {
  it('drops a stale response when a newer request has started', async () => {
    const resolvers: Array<(page: Page) => void> = [];

    const fetchPage = vi.fn(
      (_cursor: string | null, _direction: 'next' | 'prev' | 'refresh') =>
        new Promise<Page>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const { result } = renderHook(() =>
      useCursorPagination<Row, Page>({
        fetchPage,
        getRows: (page) => page.rows,
        getNextCursor: (page) => page.nextCursor,
        getPrevCursor: (page) => page.prevCursor,
      }),
    );

    // Initial request.
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));

    // Start a second request via next().
    act(() => {
      void result.current.next();
    });

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    // Resolve the newer request first, then the stale one.
    await act(async () => {
      resolvers[1](makePage(['new'], 'cursor-new'));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'new' }]));

    await act(async () => {
      resolvers[0](makePage(['stale'], 'cursor-stale'));
      await Promise.resolve();
    });

    // Stale response must not overwrite the newer rows.
    expect(result.current.rows).toEqual([{ id: 'new' }]);
  });

  it('tracks next/prev cursor bookkeeping', async () => {
    const fetchPage = vi.fn(
      async (cursor: string | null, _direction: 'next' | 'prev' | 'refresh'): Promise<Page> => {
        if (cursor === null) {
          return makePage(['a'], 'cursor-1', null);
        }
        if (cursor === 'cursor-1') {
          return makePage(['b'], 'cursor-2', null);
        }
        if (cursor === 'cursor-2') {
          return makePage(['c'], null, 'cursor-1');
        }
        return makePage(['a'], 'cursor-1', null);
      },
    );

    const { result } = renderHook(() =>
      useCursorPagination<Row, Page>({
        fetchPage,
        getRows: (page) => page.rows,
        getNextCursor: (page) => page.nextCursor,
        getPrevCursor: (page) => page.prevCursor,
      }),
    );

    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'a' }]));
    expect(fetchPage).toHaveBeenLastCalledWith(null, 'next');
    expect(result.current.pageIndex).toBe(0);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(true);

    await act(async () => {
      await result.current.next();
    });

    expect(fetchPage).toHaveBeenLastCalledWith('cursor-1', 'next');
    expect(result.current.rows).toEqual([{ id: 'b' }]);
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.hasPrev).toBe(true);
    expect(result.current.hasNext).toBe(true);

    await act(async () => {
      await result.current.next();
    });

    expect(fetchPage).toHaveBeenLastCalledWith('cursor-2', 'next');
    expect(result.current.rows).toEqual([{ id: 'c' }]);
    expect(result.current.pageIndex).toBe(2);
    expect(result.current.hasPrev).toBe(true);
    expect(result.current.hasNext).toBe(false);

    await act(async () => {
      await result.current.prev();
    });

    expect(fetchPage).toHaveBeenLastCalledWith('cursor-1', 'prev');
    expect(result.current.rows).toEqual([{ id: 'b' }]);
    expect(result.current.pageIndex).toBe(1);
    expect(result.current.hasPrev).toBe(true);
    expect(result.current.hasNext).toBe(true);
  });

  it('performs a silent refresh without toggling loading', async () => {
    let callCount = 0;
    const fetchPage = vi.fn(
      async (_cursor: string | null, _direction: 'next' | 'prev' | 'refresh'): Promise<Page> => {
        callCount += 1;
        if (callCount === 1) {
          return makePage(['a'], 'cursor-1', null);
        }
        return makePage(['a-updated'], 'cursor-1', null);
      },
    );

    const { result } = renderHook(() =>
      useCursorPagination<Row, Page>({
        fetchPage,
        getRows: (page) => page.rows,
        getNextCursor: (page) => page.nextCursor,
        getPrevCursor: (page) => page.prevCursor,
      }),
    );

    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'a' }]));
    expect(result.current.loading).toBe(false);

    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    // Loading must remain false during a silent refresh.
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await refreshPromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.rows).toEqual([{ id: 'a-updated' }]);
    expect(fetchPage).toHaveBeenLastCalledWith(null, 'refresh');
  });
});