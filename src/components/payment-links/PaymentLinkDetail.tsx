"use client";

import { useEffect, useState } from "react";
import { Modal, CopyField } from "@/components/dashboard/Modal";
import { formatStroops } from "@/lib/amount";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { listPaymentLinkPayments, type PaymentLink, type PaymentLinkPayment } from "@/lib/payment-links";
import { isTrustedImageUrl } from "@/lib/isTrustedImageUrl";
import { PayWithOctoSnippet } from "@/components/payment-links/PayWithOctoSnippet";
import { ExportPaymentLinkPaymentsCsvButton } from "@/components/export/ExportPaymentLinkPaymentsCsvButton";
import { PaymentsTable } from "./PaymentsTable";

function payUrl(slug: string): string {
  if (typeof window === "undefined") return `/pay/${slug}`;
  return `${window.location.origin}/pay/${slug}`;
}

export function PaymentLinkDetail({
  link,
  walletId,
  token,
  onClose,
}: {
  link: PaymentLink;
  walletId: string;
  token: string | null;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<PaymentLinkPayment[] | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!token) return;
    listPaymentLinkPayments(asAuthToken(token), asWalletId(walletId), link.id, { limit: 20 })
      .then((page) => {
        setPayments(page.data);
        setNextCursor(page.next_cursor);
        setPaymentsError(null);
      })
      .catch((e) =>
        setPaymentsError(
          e instanceof Error ? e.message : "Could not load payments.",
        ),
      );
  }, [token, walletId, link.id]);

  async function loadMore() {
    if (!token || !nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listPaymentLinkPayments(asAuthToken(token), asWalletId(walletId), link.id, {
        limit: 20,
        before: nextCursor,
      });
      setPayments((prev) => [...(prev ?? []), ...page.data]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setPaymentsError(e instanceof Error ? e.message : "Could not load payments.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Modal title="Payment link details" onClose={onClose}>
      <div className="space-y-4">
        {isTrustedImageUrl(link.image_url) && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={link.image_url!}
              alt=""
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          </div>
        )}
        <div className="rounded-lg bg-surface-sunken p-3 text-center">
          <p className="text-xs text-muted">Collected</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            ${formatStroops(link.collected_usdc_stroops)}
          </p>
        </div>
        <CopyField label="Public link" value={link.url ?? payUrl(link.slug)} qr />
        <PayWithOctoSnippet url={link.url ?? payUrl(link.slug)} />
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-surface-sunken p-3">
            <p className="text-muted">Amount</p>
            <p className="mt-1 font-mono text-foreground">
              {link.amount_usdc_stroops !== null
                ? `$${formatStroops(link.amount_usdc_stroops)}`
                : "Flexible"}
            </p>
          </div>
          <div className="rounded-lg bg-surface-sunken p-3">
            <p className="text-muted">Status</p>
            <p className="mt-1 font-mono text-foreground">
              {link.active ? "Active" : "Inactive"}
            </p>
          </div>
        </div>
        {link.description && (
          <p className="text-center text-sm text-muted">{link.description}</p>
        )}

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Payments</p>
            <ExportPaymentLinkPaymentsCsvButton token={token} walletId={walletId} linkId={link.id} />
          </div>
          <PaymentsTable payments={payments} error={paymentsError} />
          {nextCursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 w-full rounded-lg border border-border py-2 text-xs font-medium text-foreground hover:bg-surface-sunken disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
