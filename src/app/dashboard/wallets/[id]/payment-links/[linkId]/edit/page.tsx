"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@/lib/useWallet";
import { getPaymentLink, type PaymentLink } from "@/lib/payment-links";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { Panel } from "@/components/dashboard/WalletUI";
import { PageSpinner } from "@/components/OctoSpinner";
import { EditPaymentLinkForm } from "@/components/payment-links/EditPaymentLinkForm";

// Dynamic render so the strict nonce CSP (src/proxy.ts) applies, like the other wallet pages.
import { WalletPageShell } from "@/components/dashboard/WalletPageShell";
export const dynamic = "force-dynamic";

export default function EditPaymentLinkPage({
  params,
}: {
  params: Promise<{ id: string; linkId: string }>;
}) {
  const { id, linkId } = use(params);
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const { wallet } = useWallet(id);
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listHref = `/dashboard/wallets/${id}/payment-links`;

  useEffect(() => {
    if (!token) return;
    getPaymentLink(asAuthToken(token), asWalletId(id), linkId)
      .then(setLink)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the link."));
  }, [token, id, linkId]);

  if (loading || !user) return <PageSpinner />;

  return (
    <>
    <WalletPageShell
      walletId={id}
      walletName={wallet?.label ?? "Master wallet"}
      section="Edit payment link"
    >

            <div className="mx-auto w-full max-w-xl space-y-6">
              <h1 className="text-2xl font-semibold text-foreground">Edit payment link</h1>
              {error && (
                <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              {link && token && (
                <Panel title={link.name}>
                  <EditPaymentLinkForm
                    link={link}
                    token={token}
                    walletId={id}
                    onSaved={() => router.push(listHref)}
                    onCancel={() => router.push(listHref)}
                  />
                </Panel>
              )}
            </div>

    </WalletPageShell>
  </>
  );
}
