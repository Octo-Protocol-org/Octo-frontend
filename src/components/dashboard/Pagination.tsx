"use client";

/**
 * Prev/next page controls for the dashboard's cursor-paginated lists.
 *
 * The API uses opaque cursors, not offsets, so there is no way to jump to an arbitrary page N —
 * the caller keeps a stack of the cursors it has visited and walks it one step at a time. The
 * page number is shown for orientation only.
 */
export function Pagination({
  page,
  hasPrev,
  hasNext,
  loading,
  onPrev,
  onNext,
}: {
  /** 1-based page number, for display. */
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Nothing to navigate: a single page of results.
  if (!hasPrev && !hasNext) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
      <span className="text-xs text-muted">Page {page}</span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev || loading}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-foreground transition-colors hover:border-burgundy/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext || loading}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-foreground transition-colors hover:border-burgundy/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
