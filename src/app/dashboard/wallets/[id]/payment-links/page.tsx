"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@/lib/useWallet";
import { PaymentLinkList } from "@/components/payment-links/PaymentLinkList";
import { PaymentLinkDetail } from "@/components/payment-links/PaymentLinkDetail";
import { CreatePaymentLinkForm } from "@/components/payment-links/CreatePaymentLinkForm";
import {
  listPaymentLinksPage,
  setPaymentLinkActive,
  type PaymentLink,
} from "@/lib/payment-links";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { formatStroops, sumStroops } from "@/lib/amount";
import { Modal, CopyField } from "@/components/dashboard/Modal";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { Pagination } from "@/components/dashboard/Pagination";
import { PageSpinner } from "@/components/OctoSpinner";
import { usePolling } from "@/lib/usePolling";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — matches the other
// /dashboard/wallets/:id/* pages, which all read wallet-scoped data.
import { WalletPageShell } from "@/components/dashboard/WalletPageShell";
export const dynamic = "force-dynamic";

function payUrl(slug: string): string {
  if (typeof window === "undefined") return `/pay/${slug}`;
  return `${window.location.origin}/pay/${slug}`;
}

export default function PaymentLinksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading } = useAuth();

  const { wallet } = useWallet(id);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<PaymentLink | null>(null);
  const [selected, setSelected] = useState<PaymentLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cursor pagination: `cursors[i]` is the `before` cursor for page i+1 (page 1 has none).
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = useCallback(
    (before: string | null, opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setRefreshing(true);
      listPaymentLinksPage(asAuthToken(token), asWalletId(id), { before })
        .then((page) => {
          setLinks(page.data);
          setNextCursor(page.next_cursor);
          setError(null);
        })
        .catch((e) => {
          if (!opts?.silent) {
            setError(
              e instanceof Error ? e.message : "Could not load payment links.",
            );
          }
        })
        .finally(() => {
          if (!opts?.silent) setRefreshing(false);
        });
    },
    [token, id],
  );

  function refresh() {
    load(cursors[pageIndex]);
  }

  useEffect(() => {
    if (!token) return;
    load(null);
  }, [token, id, load]);

  // Silently re-fetch so a just-received payment (collected total) shows up without a manual
  // refresh. Page 1 only — refreshing a deeper page would shift rows under the user.
  const pollFn = useCallback(
    async () => {
      if (!token || pageIndex !== 0) return;
      await load(null, { silent: true });
    },
    [token, pageIndex, load],
  );
  usePolling(pollFn, 5000);

  function goNext() {
    if (!nextCursor) return;
    setCursors((c) => [...c.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((i) => i + 1);
    load(nextCursor);
  }

  function goPrev() {
    if (pageIndex === 0) return;
    const target = cursors[pageIndex - 1];
    setPageIndex((i) => i - 1);
    load(target);
  }

  async function handleToggleActive(link: PaymentLink) {
    if (!token) return;
    try {
      const updated = await setPaymentLinkActive(asAuthToken(token), asWalletId(id), link.id, !link.active);
      setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the link.");
    }
  }

  const totalCollected = sumStroops(links.map((l) => l.collected_usdc_stroops));
  const activeCount = links.filter((l) => l.active).length;
  const paidLinks = links.filter((l) => l.collected_usdc_stroops > 0);
  const avgPayment = paidLinks.length > 0 ? totalCollected / BigInt(paidLinks.length) : BigInt(0);

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  return (
    <>
    <WalletPageShell
      walletId={id}
      walletName={wallet?.label ?? "Master wallet"}
      section="Payment Links"
    >

            <div className="mx-auto w-full max-w-6xl space-y-6">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Payment Links</h1>
                <p className="mt-1 text-sm text-muted">
                  Shareable public URLs to accept USDC payments. Share via email, social
                  media, or embed on your website.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Total links" value={String(links.length)} />
                <Stat label="Active links" value={String(activeCount)} />
                <Stat
                  label="Total collected"
                  value={`$${formatStroops(totalCollected)}`}
                />
                <Stat
                  label="Avg. payment"
                  value={`$${formatStroops(avgPayment)}`}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton label="+ Create link" onClick={() => setShowCreate(true)} />
                <ActionButton
                  label={refreshing ? "Refreshing…" : "Refresh"}
                  onClick={refresh}
                  loading={refreshing}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <Panel title={`${links.length} payment link${links.length === 1 ? "" : "s"}`}>
                {links.length === 0 ? (
                  <Empty>No payment links yet. Create one to start accepting USDC.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        {links.length} payment link{links.length === 1 ? "" : "s"} for this wallet
                      </caption>
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                          <th scope="col" className="pb-3 pr-4 font-medium">Name</th>
                          <th scope="col" className="pb-3 pr-4 font-medium">Amount</th>
                          <th scope="col" className="pb-3 pr-4 font-medium">Status</th>
                          <th scope="col" className="pb-3 pr-4 font-medium">Collected</th>
                          <th scope="col" className="pb-3 pr-4 font-medium">Created</th>
                          <th scope="col" className="pb-3 font-medium"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <PaymentLinkList
                        links={links}
                        onSelect={setSelected}
                        onToggleActive={handleToggleActive}
                      />
                    </table>
                  </div>
                )}
                <Pagination
                  page={pageIndex + 1}
                  hasPrev={pageIndex > 0}
                  hasNext={nextCursor !== null}
                  loading={refreshing}
                  onPrev={goPrev}
                  onNext={goNext}
                />
              </Panel>
            </div>

    </WalletPageShell>

      {showCreate && (
        <CreatePaymentLinkForm
          walletId={id}
          token={token}
          creating={creating}
          setCreating={setCreating}
          onClose={() => setShowCreate(false)}
          onCreated={(link) => {
            setLinks((prev) => [link, ...prev]);
            setShowCreate(false);
            setCreated(link);
          }}
        />
      )}

      {created && (
        <Modal title="Payment link created" onClose={() => setCreated(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Share this link with your customers — anyone with it can pay, no Octo
              account required.
            </p>
            <CopyField
              label="Payment link"
              value={created.url ?? payUrl(created.slug)}
              qr
            />
          </div>
        </Modal>
      )}

      {selected && (
        <PaymentLinkDetail
          link={selected}
          walletId={id}
          token={token}
          onClose={() => setSelected(null)}
        />
      )}
  </>
  );
}
