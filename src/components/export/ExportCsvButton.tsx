"use client";

import { errorMessage } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/dashboard/WalletUI";
import { buildCsvParts, downloadCsvParts, type CsvColumn } from "@/lib/csv";

/** What the row loader gets: an abort signal and a progress sink tied to the button. */
export type CsvExportContext = {
  signal: AbortSignal;
  onProgress: (rowsSoFar: number) => void;
};

/** Builds a CSV from `loadRows` (fetches every row) and downloads it, cancellably. */
export function ExportCsvButton<T>({
  loadRows,
  columns,
  filename,
  label = "Export CSV",
}: {
  loadRows: (ctx: CsvExportContext) => Promise<T[]>;
  columns: CsvColumn<T>[];
  filename: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowsSoFar, setRowsSoFar] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Navigating away (unmount) must stop the export loop, not just reset the UI.
  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  async function run() {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setRowsSoFar(null);
    try {
      const rows = await loadRows({ signal: ctrl.signal, onProgress: setRowsSoFar });
      // A cancellation that raced the last page should not trigger a download.
      ctrl.signal.throwIfAborted();
      downloadCsvParts(filename, buildCsvParts(rows, columns));
    } catch (e) {
      // Cancellation is expected, not an error.
      if (!ctrl.signal.aborted) setError(errorMessage(e, "Export failed."));
    } finally {
      setBusy(false);
      setRowsSoFar(null);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <ActionButton
          label={busy ? (rowsSoFar !== null ? `Exported ${rowsSoFar} rows…` : "Exporting…") : label}
          onClick={run}
          loading={busy}
        />
        {busy && (
          <button type="button" onClick={cancel} className="text-xs text-muted underline underline-offset-2">
            Cancel
          </button>
        )}
      </span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
