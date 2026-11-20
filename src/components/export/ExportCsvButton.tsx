"use client";

import { errorMessage } from "@/lib/api";
import { useState } from "react";
import { ActionButton } from "@/components/dashboard/WalletUI";
import { buildCsv, downloadCsv, type CsvColumn } from "@/lib/csv";

/** Builds a CSV from `loadRows` (fetches every row) and downloads it. */
export function ExportCsvButton<T>({
  loadRows,
  columns,
  filename,
  label = "Export CSV",
}: {
  loadRows: () => Promise<T[]>;
  columns: CsvColumn<T>[];
  filename: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      downloadCsv(filename, buildCsv(await loadRows(), columns));
    } catch (e) {
      setError(errorMessage(e, "Export failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <ActionButton label={busy ? "Exporting…" : label} onClick={run} loading={busy} />
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
