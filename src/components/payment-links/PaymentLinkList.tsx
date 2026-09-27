"use client";

import Link from "next/link";
import { formatStroops } from "@/lib/amount";
import type { PaymentLink } from "@/lib/payment-links";
import { RelativeTime } from "@/components/RelativeTime";

function PaymentLinkRow({
  link,
  onSelect,
  onToggleActive,
}: {
  link: PaymentLink;
  onSelect: (link: PaymentLink) => void;
  onToggleActive: (link: PaymentLink) => void;
}) {
  return (
    <tr onClick={() => onSelect(link)} className="cursor-pointer transition-colors hover:bg-surface-raised">
      <td className="py-3 pr-4 text-foreground">{link.name}</td>
      <td className="py-3 pr-4 text-foreground">{link.amount_usdc_stroops !== null ? `$${formatStroops(link.amount_usdc_stroops)}` : "Flexible"}</td>
      <td className="py-3 pr-4"><span className={`inline-flex items-center gap-1 text-xs ${link.active ? "text-success" : "text-muted"}`}>{link.active ? "●" : "○"} {link.active ? "Active" : "Inactive"}</span></td>
      <td className="py-3 pr-4 font-medium text-foreground">${formatStroops(link.collected_usdc_stroops)}</td>
      <td className="py-3 pr-4 text-muted"><RelativeTime date={link.created_at} /></td>
      <td className="py-3 text-right">
        <Link href={`payment-links/${link.id}/edit`} onClick={(e) => e.stopPropagation()} className="mr-3 text-xs text-muted hover:text-foreground">Edit</Link>
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleActive(link); }} className="text-xs text-muted hover:text-foreground">{link.active ? "Deactivate" : "Activate"}</button>
      </td>
    </tr>
  );
}

export function PaymentLinkList({ links, onSelect, onToggleActive }: { links: PaymentLink[]; onSelect: (link: PaymentLink) => void; onToggleActive: (link: PaymentLink) => void }) {
  return <tbody className="divide-y divide-divider">{links.map((link) => <PaymentLinkRow key={link.id} link={link} onSelect={onSelect} onToggleActive={onToggleActive} />)}</tbody>;
}
