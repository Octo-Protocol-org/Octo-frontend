"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./api";
import type { Paginated } from "./pagination";

type LoadOptions = { silent?: boolean };

/**
 * Cursor pagination for a list page.
 *
 * `cursors[i]` is the `before` cursor for page i + 1 (page 1 has none), so going back
 * re-requests the cursor that produced the earlier page. Every request carries an id, and
 * a response that is no longer the latest is dropped, so a slow page cannot overwrite a
 * newer one. A silent load refreshes the rows without touching the loading or error state.
 *
 * `fetchPage` is re-created when `deps` change, which resets to page 1. Nothing loads
 * while `enabled` is false, for example before the session token is available.
 */
export function useCursorPagination<T>(
  fetchPage: (before: string | null) => Promise<Paginated<T>>,
  deps: readonly unknown[],
  errorFallback: string,
  enabled = true,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // False until the first request has settled, so a page can show a skeleton before that.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);

  const latestRequest = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(
    (before: string | null, opts?: LoadOptions) => {
      const requestId = opts?.silent ? latestRequest.current : ++latestRequest.current;
      if (!opts?.silent) setLoading(true);
      return fetchRef
        .current(before)
        .then((page) => {
          if (requestId !== latestRequest.current) return;
          setRows(page.data);
          setNextCursor(page.next_cursor);
          setError(null);
        })
        .catch((e: unknown) => {
          if (requestId !== latestRequest.current || opts?.silent) return;
          setError(errorMessage(e, errorFallback));
        })
        .finally(() => {
          if (!opts?.silent && requestId === latestRequest.current) setLoading(false);
          if (requestId === latestRequest.current) setLoaded(true);
        });
    },
    [errorFallback],
  );

  // Reset to page 1 whenever the caller's inputs change (for example the wallet id).
  useEffect(() => {
    if (!enabled) return;
    setCursors([null]);
    setPageIndex(0);
    load(null);
    // The caller decides what counts as a new list through `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, enabled, ...deps]);

  const refresh = useCallback(() => load(cursors[pageIndex] ?? null), [load, cursors, pageIndex]);

  const next = useCallback(() => {
    if (!nextCursor) return;
    setCursors((c) => [...c.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((i) => i + 1);
    load(nextCursor);
  }, [load, nextCursor, pageIndex]);

  const prev = useCallback(() => {
    if (pageIndex === 0) return;
    const target = cursors[pageIndex - 1] ?? null;
    setPageIndex((i) => i - 1);
    load(target);
  }, [load, cursors, pageIndex]);

  /** Re-fetch the current page without the loading indicator. */
  const refreshSilently = useCallback(() => load(cursors[pageIndex] ?? null, { silent: true }), [load, cursors, pageIndex]);

  return {
    rows,
    setRows,
    page: pageIndex + 1,
    hasPrev: pageIndex > 0,
    hasNext: nextCursor !== null,
    loading,
    loaded,
    error,
    refresh,
    refreshSilently,
    next,
    prev,
  };
}
