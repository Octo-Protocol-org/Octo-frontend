"use client";

import { formatStroops } from "@/lib/amount";
import { explorerTxUrl } from "@/lib/network";
import { RelativeTime } from "@/components/RelativeTime";
import type { PaymentLinkPayment } from "@/lib/payment-links";

export function PaymentsTable({ payments, error }: { payments: PaymentLinkPayment[] | null; error: string | null }) {
  if (error) return <p className="mt-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger">{error}</p>;
  if (payments === null) return <p className="mt-2 text-xs text-muted">Loading…</p>;
  if (payments.length === 0) return <p className="mt-2 text-xs text-muted">No payments yet. Payers appear here as soon as they start a payment.</p>;
  return <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border"><table className="w-full text-xs"><thead className="sticky top-0 bg-burgundy-soft/60"><tr className="text-left text-[10px] uppercase tracking-wide text-muted"><th className="px-3 py-2 font-medium">Payer</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Transaction</th></tr></thead><tbody className="divide-y divide-divider">{payments.map((p) => <tr key={p.id}><td className="px-3 py-2"><p className="text-foreground">{p.payer_name ?? "—"}</p>{p.payer_email && <p className="text-[10px] text-muted">{p.payer_email}</p>}</td><td className="px-3 py-2 font-medium text-foreground">${formatStroops(p.amount_usdc_stroops)}</td><td className="px-3 py-2"><span className={p.status === "confirmed" ? "text-success" : "text-warning"}>{p.status === "confirmed" ? "✓ Confirmed" : "• Pending"}</span></td><td className="px-3 py-2 text-muted"><RelativeTime date={p.created_at} /></td><td className="px-3 py-2">{p.transaction_id && <a href={explorerTxUrl(p.transaction_id)} target="_blank" rel="noopener noreferrer" className="text-burgundy-bright hover:underline">View</a>}</td></tr>)}</tbody></table></div>;
}
