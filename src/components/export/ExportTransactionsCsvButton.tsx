"use client";

import { ExportCsvButton } from "./ExportCsvButton";
import { fetchAllPages, type CsvColumn } from "@/lib/csv";
import { formatStroops } from "@/lib/amount";
import { listRecentAddresses, listTransactionsPage, type Transaction } from "@/lib/wallets";

type Row = Transaction & { customerRef: string | null };

const columns: CsvColumn<Row>[] = [
  { header: "Date", value: (t) => t.created_at },
  { header: "Direction", value: (t) => t.direction },
  { header: "Asset", value: (t) => t.asset_code },
  { header: "Amount", value: (t) => formatStroops(t.amount_stroops) },
  { header: "Status", value: (t) => t.status },
  { header: "Hash", value: (t) => t.stellar_tx_hash },
  { header: "Source", value: (t) => t.source_account },
  { header: "Destination", value: (t) => t.destination_account },
  { header: "Memo ID", value: (t) => t.memo_id },
  { header: "Customer ref", value: (t) => t.customerRef },
];

/** Exports every transaction of a wallet (all pages) to CSV. */
export function ExportTransactionsCsvButton({
  token,
  walletId,
}: {
  token: string | null;
  walletId: string;
}) {
  // Customer refs live on addresses; a failed lookup only blanks that column.
  async function load(): Promise<Row[]> {
    if (!token) throw new Error("Not signed in.");
    const [rows, addrs] = await Promise.all([
      fetchAllPages((before) => listTransactionsPage(token, walletId, { before, limit: 200 })),
      // Fetch up to 200 addresses for customer-ref enrichment; a failed lookup only blanks that column.
      listRecentAddresses(token, walletId, 200).catch(() => []),
    ]);
    const refs = new Map<string, string>();
    for (const a of addrs) if (a.customer_ref) refs.set(a.id, a.customer_ref);
    return rows.map((t) => ({ ...t, customerRef: t.address_id ? (refs.get(t.address_id) ?? null) : null }));
  }

  return (
    <ExportCsvButton loadRows={load} columns={columns} filename={`transactions-${walletId}.csv`} />
  );
}
