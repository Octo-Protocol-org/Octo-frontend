"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getWallet, type WalletView } from "@/lib/wallets";
import {
  listPaymentLinks,
  createPaymentLink,
  setPaymentLinkActive,
  usdcStroopsToAmount,
  usdAmountToStroops,
  type PaymentLink,
} from "@/lib/payment-links";
import { WalletSidebar } from "@/components/dashboard/WalletSidebar";
import { Modal, CopyField } from "@/components/dashboard/Modal";
import { Stat, ActionButton, Panel, Empty } from "@/components/dashboard/WalletUI";
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

  function refresh() {
    if (!token) return;
    setRefreshing(true);
    listPaymentLinks(token, id)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    if (!token) return;
    getWallet(token, id).then(setWallet).catch(() => setWallet(null));
    listPaymentLinks(token, id).then(setLinks).catch(() => setLinks([]));
  }, [token, id]);

  // Silently re-fetch in the background so a just-received payment (collected total, status)
  // shows up without needing a manual refresh — no loading indicator, only Refresh shows one.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      listPaymentLinks(token, id)
        .then(setLinks)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [token, id]);

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
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-burgundy/20 py-2 text-center text-xs text-burgundy-bright">
        You are currently on <strong>test mode</strong> (Stellar testnet).
      </div>
      <div className="flex flex-1">
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
            <CopyField label="Payment link" value={payUrl(created.slug)} />
          </div>
        </Modal>
      )}

      {selected && (
        <LinkDetail link={selected} onClose={() => setSelected(null)} />
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

function LinkDetail({ link, onClose }: { link: PaymentLink; onClose: () => void }) {
  return (
    <Modal title="Payment link details" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-black/30 p-3 text-center">
          <p className="text-xs text-muted">Collected</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            ${usdcStroopsToAmount(link.collected_usdc_stroops)}
          </p>
        </div>
        <CopyField label="Public link" value={payUrl(link.slug)} />
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
  const [error, setError] = useState<string | null>(null);

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
            disabled={!name.trim() || creating}
            loading={creating}
          />
        </div>
      </form>
    </Modal>
  );
}
