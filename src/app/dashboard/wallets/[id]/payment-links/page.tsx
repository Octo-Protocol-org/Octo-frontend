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
import { uploadImage, validateImage } from "@/lib/uploads";
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
          <header className="flex items-center justify-between border-b border-white/10 px-8 py-4">
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
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
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
                        <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-muted">
                          <th className="pb-3 pr-4 font-medium">Name</th>
                          <th className="pb-3 pr-4 font-medium">Amount</th>
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 pr-4 font-medium">Collected</th>
                          <th className="pb-3 pr-4 font-medium">Created</th>
                          <th className="pb-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {links.map((link) => (
                          <LinkRow
                            key={link.id}
                            link={link}
                            onSelect={() => setSelected(link)}
                            onToggleActive={() => handleToggleActive(link)}
                          />
                        ))}
                      </tbody>
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
          </main>
        </div>
      </div>

      {showCreate && (
        <CreateLinkModal
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
        <LinkDetail
          link={selected}
          walletId={id}
          token={token}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function LinkRow({
  link,
  onSelect,
  onToggleActive,
}: {
  link: PaymentLink;
  onSelect: () => void;
  onToggleActive: () => void;
}) {
  return (
    <tr onClick={onSelect} className="cursor-pointer transition-colors hover:bg-white/[0.02]">
      <td className="py-3 pr-4 text-foreground">{link.name}</td>
      <td className="py-3 pr-4 text-foreground">
        {link.amount_usdc_stroops !== null
          ? `$${usdcStroopsToAmount(link.amount_usdc_stroops)}`
          : "Flexible"}
      </td>
      <td className="py-3 pr-4">
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            link.active ? "text-emerald-400" : "text-muted"
          }`}
        >
          {link.active ? "●" : "○"} {link.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="py-3 pr-4 font-medium text-foreground">
        ${usdcStroopsToAmount(link.collected_usdc_stroops)}
      </td>
      <td className="py-3 pr-4 text-muted">
        {new Date(link.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </td>
      <td className="py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive();
          }}
          className="text-xs text-muted hover:text-foreground"
        >
          {link.active ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

function LinkDetail({
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

  useEffect(() => {
    if (!token) return;
    listPaymentLinkPayments(token, walletId, link.id, { limit: 20 })
      .then((page) => {
        setPayments(page.data);
        setPaymentsError(null);
      })
      .catch((e) =>
        setPaymentsError(
          e instanceof Error ? e.message : "Could not load payments.",
        ),
      );
  }, [token, walletId, link.id]);

  return (
    <Modal title="Payment link details" onClose={onClose}>
      <div className="space-y-4">
        {link.image_url && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={link.image_url}
              alt=""
              className="h-20 w-20 rounded-lg border border-white/10 object-cover"
            />
          </div>
        )}
        <div className="rounded-lg bg-black/30 p-3 text-center">
          <p className="text-xs text-muted">Collected</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            ${usdcStroopsToAmount(link.collected_usdc_stroops)}
          </p>
        </div>
        <CopyField label="Public link" value={link.url ?? payUrl(link.slug)} qr />
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-muted">Amount</p>
            <p className="mt-1 font-mono text-foreground">
              {link.amount_usdc_stroops !== null
                ? `$${usdcStroopsToAmount(link.amount_usdc_stroops)}`
                : "Flexible"}
            </p>
          </div>
          <div className="rounded-lg bg-black/30 p-3">
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
          <p className="text-xs font-medium text-foreground">Payments</p>
          {paymentsError ? (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {paymentsError}
            </p>
          ) : payments === null ? (
            <p className="mt-2 text-xs text-muted">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              No payments yet. Payers appear here as soon as they start a payment.
            </p>
          ) : (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-burgundy-soft/60">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Payer</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2">
                        <p className="text-foreground">{p.payer_name ?? "—"}</p>
                        {p.payer_email && (
                          <p className="text-[10px] text-muted">{p.payer_email}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        ${usdcStroopsToAmount(p.amount_usdc_stroops)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            p.status === "confirmed"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }
                        >
                          {p.status === "confirmed" ? "✓ Confirmed" : "• Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CreateLinkModal({
  walletId,
  token,
  creating,
  setCreating,
  onClose,
  onCreated,
}: {
  walletId: string;
  token: string | null;
  creating: boolean;
  setCreating: (v: boolean) => void;
  onClose: () => void;
  onCreated: (link: PaymentLink) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      setImageUrl(await uploadImage(token, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const amountUsdcStroops = amount.trim() ? usdAmountToStroops(amount.trim()) : undefined;
      if (amount.trim() && amountUsdcStroops === null) {
        setError("Enter a valid positive amount, or leave it blank for a flexible amount.");
        setCreating(false);
        return;
      }
      const link = await createPaymentLink(token, walletId, {
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl ?? undefined,
        redirectUrl: redirectUrl.trim() || undefined,
        amountUsdcStroops: amountUsdcStroops ?? undefined,
      });
      onCreated(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the link.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="Create payment link" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">
            Image (optional)
          </label>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg text-muted">🖼</span>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploading}
                className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/[0.03] file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:border-burgundy/50"
              />
              <p className="mt-1 text-[11px] text-muted">
                {uploading
                  ? "Uploading…"
                  : imageUrl
                    ? "Uploaded. Choose another file to replace it."
                    : "PNG or JPG, up to 2MB."}
              </p>
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product payment"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this payment link"
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Amount (USD)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Leave empty for flexible amount"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50"
          />
          <p className="mt-1 text-[11px] text-muted">
            Settled 1:1 in USDC. Leave empty to let the payer choose their own amount.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">
            Redirect URL (optional)
          </label>
          <input
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
            placeholder="https://your-site.com/thank-you"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50"
          />
          <p className="mt-1 text-[11px] text-muted">
            Where to send customers after a successful payment.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-foreground transition-colors hover:border-burgundy/50"
          >
            Cancel
          </button>
          <ActionButton
            label={creating ? "Creating…" : "Create Link"}
            disabled={!name.trim() || creating || uploading}
            loading={creating}
          />
        </div>
      </form>
    </Modal>
  );
}
