/** CSV building + download helpers with spreadsheet-formula (CSV injection) neutralisation. */

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

/** Quote a cell for CSV; formula-leading characters are neutralised with a leading apostrophe. */
export function escapeCsvCell(input: string | number | null | undefined): string {
  let s = input === null || input === undefined ? "" : String(input);
  // Leading = + - @ tab or CR would be evaluated as a formula by Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCsvCell(c.value(r))).join(","));
  return [head, ...body].join("\r\n") + "\r\n";
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

/** Walk every cursor page, capped so a misbehaving cursor cannot loop forever. */
export async function fetchAllPages<T>(
  fetchPage: (before: string | null) => Promise<{ data: T[]; next_cursor: string | null }>,
  maxPages = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let before: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(before);
    all.push(...page.data);
    if (!page.next_cursor || page.next_cursor === before) break;
    before = page.next_cursor;
  }
  return all;
}
