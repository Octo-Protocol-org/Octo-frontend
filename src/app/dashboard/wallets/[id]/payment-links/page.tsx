"use client";

import { use, useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getWallet, type WalletView } from "@/lib/wallets";
import {
  listPaymentLinksPage,
  listPaymentLinkPayments,
  createPaymentLink,
  setPaymentLinkActive,
  usdcStroopsToAmount,
  usdAmountToStroops,
  type PaymentLink,
  type PaymentLinkPayment,
} from "@/lib/payment-links";
import { uploadImage, validateImage, isTrustedImageUrl } from "@/lib/uploads";
import { WalletSidebar } from "@/components/dashboard/WalletSidebar";
import { DashboardBackground } from "@/components/dashboard/DashboardBackground";
import { Modal, CopyField } from "@/components/dashboard/Modal";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
import { Pagination } from "@/components/dashboard/Pagination";
import { PageSpinner } from "@/components/OctoSpinner";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies — matches the other
// /dashboard/wallets/:id/* pages, which all read wallet-scoped data.
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
  const { user, token, loading, logout } = useAuth();

  const [wallet, setWallet] = useState<WalletView | null>(null);
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
      listPaymentLinksPage(token, id, { before })
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
    getWallet(token, id)
      .then(setWallet)
      .catch(() => setWallet(null));
    load(null);
  }, [token, id, load]);

  // Silently re-fetch so a just-received payment (collected total) shows up without a manual
  // refresh. Page 1 only — refreshing a deeper page would shift rows under the user.
  useEffect(() => {
    if (!token || pageIndex !== 0) return;
    const interval = setInterval(() => load(null, { silent: true }), 5000);
    return () => clearInterval(interval);
  }, [token, pageIndex, load]);

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
      const updated = await setPaymentLinkActive(token, id, link.id, !link.active);
      setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the link.");
    }
  }

  const totalCollected = links.reduce((sum, l) => sum + l.collected_usdc_stroops, 0);
  const activeCount = links.filter((l) => l.active).length;
  const paidLinks = links.filter((l) => l.collected_usdc_stroops > 0);
  const avgPayment = paidLinks.length > 0 ? totalCollected / paidLinks.length : 0;

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <DashboardBackground />

      <div className="relative z-10 bg-burgundy/20 py-2 text-center text-xs text-burgundy-bright">
        You are currently on <strong>test mode</strong> (Stellar testnet).
      </div>
      <div className="relative z-10 flex flex-1">
        <WalletSidebar
          walletId={id}
          walletName={wallet?.label ?? "Master wallet"}
        />

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-8 py-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Link href="/dashboard" className="hover:text-foreground">
                My Wallets
              </Link>
              <span>›</span>
              <Link href={`/dashboard/wallets/${id}`} className="hover:text-foreground">
                {wallet?.label ?? "Master wallet"}
              </Link>
              <span>›</span>
              <span className="text-foreground">Payment Links</span>
            </div>
            <button onClick={logout} className="text-sm text-muted hover:text-foreground">
              ⏻
            </button>
          </header>

          <main className="flex-1 px-8 py-8">
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
                  value={`$${usdcStroopsToAmount(totalCollected)}`}
                />
                <Stat
                  label="Avg. payment"
                  value={`$${usdcStroopsToAmount(Math.round(avgPayment))}`}
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
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                          <th className="pb-3 pr-4 font-medium">Name</th>
                          <th className="pb-3 pr-4 font-medium">Image</th>
                          <th className="pb-3 pr-4 font-medium">Amount</th>
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 pr-4 font-medium">Collected</th>
                          <th className="pb-3 pr-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {links.map((link) => (
                          <tr key={link.id} className="border-b border-border/60">
                            <td className="py-3 pr-4 text-foreground">{link.name}</td>
                            <td className="py-3 pr-4">
                              {isTrustedImageUrl(link.image_url) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={link.image_url}
                                  alt={link.name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-surface text-muted">
                                  🖼
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-foreground">
                              ${usdcStroopsToAmount(link.amount_usdc_stroops)}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={
                                  link.active
                                    ? "rounded-full bg-success-bg px-2 py-0.5 text-xs text-success"
                                    : "rounded-full bg-surface px-2 py-0.5 text-xs text-muted"
                                }
                              >
                                {link.active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-foreground">
                              ${usdcStroopsToAmount(link.collected_usdc_stroops)}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setSelected(link)}
                                  className="text-xs text-muted hover:text-foreground"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleToggleActive(link)}
                                  className="text-xs text-muted hover:text-foreground"
                                >
                                  {link.active ? "Disable" : "Enable"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Pagination
                pageIndex={pageIndex}
                hasNext={Boolean(nextCursor)}
                onPrev={goPrev}
                onNext={goNext}
              />
            </div>
          </main>
        </div>
      </div>

      {showCreate && (
        <CreateLinkModal
          walletId={id}
          token={token!}
          onClose={() => setShowCreate(false)}
          onCreated={(link) => {
            setShowCreate(false);
            setCreated(link);
            load(null);
          }}
        />
      )}

      {created && (
        <Modal title="Payment link created" onClose={() => setCreated(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Share this URL to start accepting USDC payments.
            </p>
            <CopyField value={payUrl(created.slug)} />
          </div>
        </Modal>
      )}

      {selected && (
        <LinkDetailModal
          link={selected}
          token={token!}
          walletId={id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CreateLinkModal({
  walletId,
  token,
  onClose,
  onCreated,
}: {
  walletId: string;
  token: string;
  onClose: () => void;
  onCreated: (link: PaymentLink) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(token, file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const link = await createPaymentLink(token, walletId, {
        name,
        amount_usdc_stroops: usdAmountToStroops(amount),
        description: description || undefined,
        image_url: imageUrl || undefined,
      });
      onCreated(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the link.");
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Create payment link" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Amount (USD)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            inputMode="decimal"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Image</label>
          <input type="file" accept="image/*" onChange={handleFile} className="text-sm text-muted" />
          {uploading && <p className="mt-1 text-xs text-muted">Uploading…</p>}
          {imageUrl && isTrustedImageUrl(imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Preview" className="mt-2 h-16 w-16 rounded object-cover" />
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || uploading}
            className="rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create link"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LinkDetailModal({
  link,
  token,
  walletId,
  onClose,
}: {
  link: PaymentLink;
  token: string;
  walletId: string;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<PaymentLinkPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPaymentLinkPayments(token, walletId, link.id)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [token, walletId, link.id]);

  return (
    <Modal title={link.name} onClose={onClose}>
      <div className="space-y-4">
        {isTrustedImageUrl(link.image_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.image_url}
            alt={link.name}
            className="h-24 w-24 rounded object-cover"
          />
        )}
        {link.description && <p className="text-sm text-muted">{link.description}</p>}
        <CopyField value={payUrl(link.slug)} />
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">Payments</h3>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted">No payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="text-foreground">
                    ${usdcStroopsToAmount(p.amount_usdc_stroops)}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(p.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
