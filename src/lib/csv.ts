/** CSV building + download helpers with spreadsheet-formula (CSV injection) neutralisation. */

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

/** Quote a cell for CSV; formula-leading characters are neutralised with a leading apostrophe. */
export function escapeCsvCell(input: string | number | null | undefined): string {
  let s = input === null || input === undefined ? "" : String(input);
  // Plain numbers (incl. negatives) are safe and must stay numeric.
  const isPlainNumber = typeof input === "number" || typeof input === "bigint" || /^-?\d+(\.\d+)?$/.test(s);
  // Leading = + - @ | tab or CR (or fullwidth variants) after optional whitespace would be evaluated as a formula.
  if (!isPlainNumber && /^[=+\-@|\t\r＝＋－＠]/.test(s.trimStart())) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Header + one string per row, so a huge export never holds both the objects and one giant string. */
export function buildCsvParts<T>(rows: T[], columns: CsvColumn<T>[]): string[] {
  return [
    columns.map((c) => escapeCsvCell(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => escapeCsvCell(c.value(r))).join(",")),
  ];
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  return buildCsvParts(rows, columns).join("\r\n") + "\r\n";
}

/** Trigger a browser download. The URL is revoked later, since Safari can cancel a download whose URL is gone. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger a browser download of the CSV (with a BOM so Excel reads UTF-8). */
export function downloadCsv(filename: string, csv: string): void {
  downloadBlob(filename, new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
}

/** Same as `downloadCsv`, but takes pre-built parts so the full string is never materialised. */
export function downloadCsvParts(filename: string, parts: string[]): void {
  downloadBlob(filename, new Blob(["", ...parts], { type: "text/csv;charset=utf-8" }));
}

/** Options for `fetchAllPages`. */
export type FetchAllPagesOptions = {
  /** Hard cap so a misbehaving cursor cannot loop forever. */
  maxPages?: number;
  /** Aborts the walk; the in-flight `fetchPage` should receive it and reject with `AbortError`. */
  signal?: AbortSignal;
  /** Reports the row count accumulated so far, once per page. */
  onProgress?: (rowsSoFar: number) => void;
};

/** Walk every cursor page, capped, cancellable and observable. */
export async function fetchAllPages<T>(
  fetchPage: (
    before: string | null,
    signal?: AbortSignal,
  ) => Promise<{ data: T[]; next_cursor: string | null }>,
  { maxPages = 1000, signal, onProgress }: FetchAllPagesOptions = {},
): Promise<T[]> {
  const all: T[] = [];
  let before: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    signal?.throwIfAborted();
    const page = await fetchPage(before, signal);
    all.push(...page.data);
    onProgress?.(all.length);
    // The page resolved, but the user may have cancelled while it was in flight.
    signal?.throwIfAborted();
    if (!page.next_cursor || page.next_cursor === before) break;
    before = page.next_cursor;
  }
  return all;
}
