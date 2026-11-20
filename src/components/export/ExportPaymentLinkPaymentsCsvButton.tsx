"use client";

import { ExportCsvButton } from "./ExportCsvButton";
import { fetchAllPages, type CsvColumn } from "@/lib/csv";
import { formatStroops } from "@/lib/amount";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { listPaymentLinkPayments, type PaymentLinkPayment } from "@/lib/payment-links";

const columns: CsvColumn<PaymentLinkPayment>[] = [
  { header: "Payer name", value: (p) => p.payer_name },
  { header: "Payer email", value: (p) => p.payer_email },
  { header: "Amount (USDC)", value: (p) => formatStroops(p.amount_usdc_stroops) },
  { header: "Status", value: (p) => p.status },
  { header: "Transaction ID", value: (p) => p.transaction_id },
  { header: "Date", value: (p) => p.created_at },
];

/** Exports every payment recorded against one payment link (all pages) to CSV. */
export function ExportPaymentLinkPaymentsCsvButton({
  token,
  walletId,
  linkId,
}: {
  token: string | null;
  walletId: string;
  linkId: string;
}) {
  async function load() {
    if (!token) throw new Error("Not signed in.");
    return fetchAllPages((before) =>
      listPaymentLinkPayments(asAuthToken(token), asWalletId(walletId), linkId, { before, limit: 200 }),
    );
  }

  return (
    <ExportCsvButton loadRows={load} columns={columns} filename={`payment-link-${linkId}-payments.csv`} />
  );
}
