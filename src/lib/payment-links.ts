/** Payment link API calls + types, mirroring the octo backend. */

"use client";

import { apiFetch } from "./api";

export type PaymentLink = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  /** null means flexible: the payer chooses the amount. */
  amount_usdc_stroops: number | null;
  active: boolean;
  collected_usdc_stroops: number;
  created_at: string;
};

type Paginated<T> = {
  data: T[];
  next_cursor: string | null;
};

export async function listPaymentLinks(
  token: string,
  walletId: string,
): Promise<PaymentLink[]> {
  const page = await apiFetch<Paginated<PaymentLink>>(
    `/v1/wallets/${walletId}/payment-links`,
    { token },
  );
  return page.data;
}

export function createPaymentLink(
  token: string,
  walletId: string,
  params: {
    name: string;
    description?: string;
    imageUrl?: string;
    amountUsdcStroops?: number;
  },
) {
  return apiFetch<PaymentLink>(`/v1/wallets/${walletId}/payment-links`, {
    method: "POST",
    token,
    body: JSON.stringify({
      name: params.name,
      description: params.description || null,
      image_url: params.imageUrl || null,
      amount_usdc_stroops: params.amountUsdcStroops ?? null,
    }),
  });
}

export function getPaymentLink(token: string, walletId: string, linkId: string) {
  return apiFetch<PaymentLink>(
    `/v1/wallets/${walletId}/payment-links/${linkId}`,
    { token },
  );
}

export function setPaymentLinkActive(
  token: string,
  walletId: string,
  linkId: string,
  active: boolean,
) {
  return apiFetch<PaymentLink>(
    `/v1/wallets/${walletId}/payment-links/${linkId}`,
    {
      method: "PUT",
      token,
      body: JSON.stringify({ active }),
    },
  );
}

// --- Public pay page (no token — anyone with the link) --------------------

export type PublicPaymentLink = {
  name: string;
  description: string | null;
  image_url: string | null;
  amount_usdc_stroops: number | null;
  deposit_address: string;
  asset_code: string;
};

export function getPublicPaymentLink(slug: string) {
  return apiFetch<PublicPaymentLink>(`/v1/pay/${slug}`);
}

export type PaymentIntent = {
  payment_id: string;
  deposit_address: string;
  amount_usdc_stroops: number;
};

export function createPaymentIntent(
  slug: string,
  params: { payerName?: string; payerEmail?: string; amountUsdcStroops?: number },
) {
  return apiFetch<PaymentIntent>(`/v1/pay/${slug}/intent`, {
    method: "POST",
    body: JSON.stringify({
      payer_name: params.payerName || null,
      payer_email: params.payerEmail || null,
      amount_usdc_stroops: params.amountUsdcStroops ?? null,
    }),
  });
}

export type PaymentStatus = {
  /** "pending" | "confirmed". */
  status: string;
  transaction_id: string | null;
};

export function getPaymentStatus(slug: string, paymentId: string) {
  return apiFetch<PaymentStatus>(`/v1/pay/${slug}/payments/${paymentId}`);
}

export type PublicSigningInfo = {
  account: string;
  sequence: string;
  network_passphrase: string;
  base_fee_stroops: number;
};

/** `account` should be the PAYER's own address (e.g. from Freighter) — its sequence is what the
 * built transaction must use, since that account is the transaction's source. */
export function getPublicSigningInfo(slug: string, account?: string) {
  const qs = account ? `?account=${encodeURIComponent(account)}` : "";
  return apiFetch<PublicSigningInfo>(`/v1/pay/${slug}/signing-info${qs}`);
}

export type SubmitPaymentResult = {
  /** "confirmed" | "failed". */
  status: string;
  stellar_tx_hash: string | null;
  detail: string | null;
};

/** Relay a payer-signed (e.g. Freighter) payment transaction to this link's deposit address. */
export function submitPublicPayment(slug: string, transactionXdr: string) {
  return apiFetch<SubmitPaymentResult>(`/v1/pay/${slug}/submit-signed`, {
    method: "POST",
    body: JSON.stringify({ transaction_xdr: transactionXdr }),
  });
}

/** Format integer USDC stroops (7 dp) as a decimal string. */
export function usdcStroopsToAmount(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
}

/** Parse a decimal USD amount string into integer USDC stroops, or null if invalid. */
export function usdAmountToStroops(usd: string): number | null {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10_000_000);
}
