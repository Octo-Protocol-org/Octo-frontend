/** Payment link API calls + types, mirroring the octo backend. */

"use client";

import { apiFetch } from "./api";
import { parseAmount, toApiStroops } from "./amount";
import type { AuthToken, WalletId } from "./brands";
import { pageQuery, type Paginated, type PageOpts } from "./pagination";

export type PaymentLink = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  redirect_url: string | null;
  /** null means flexible: the payer chooses the amount. */
  amount_usdc_stroops: number | null;
  active: boolean;
  collected_usdc_stroops: number;
  created_at: string;
  /** Full hosted checkout URL, e.g. `https://app.octo.dev/pay/ab12cd34ef`. */
  url: string;
};

/** First page of payment links up to `limit` rows — name reflects the partial view returned. */
export async function listRecentPaymentLinks(
  token: AuthToken,
  walletId: WalletId,
  limit = 20,
): Promise<PaymentLink[]> {
  const page = await apiFetch<Paginated<PaymentLink>>(
    `/v1/wallets/${walletId}/payment-links${pageQuery({ limit })}`,
    { token },
  );
  return page.data;
}

/** Paginated payment links, preserving `next_cursor` for page controls. */
export function listPaymentLinksPage(
  token: AuthToken,
  walletId: WalletId,
  opts?: PageOpts,
): Promise<Paginated<PaymentLink>> {
  return apiFetch<Paginated<PaymentLink>>(
    `/v1/wallets/${walletId}/payment-links${pageQuery(opts)}`,
    { token },
  );
}

/** One payment recorded against a link. Owner-only: carries payer name/email. */
export type PaymentLinkPayment = {
  id: string;
  payer_name: string | null;
  payer_email: string | null;
  amount_usdc_stroops: number;
  /** "pending" | "confirmed". */
  status: string;
  transaction_id: string | null;
  created_at: string;
};

export function listPaymentLinkPayments(
  token: AuthToken,
  walletId: WalletId,
  linkId: string,
  opts?: PageOpts,
): Promise<Paginated<PaymentLinkPayment>> {
  return apiFetch<Paginated<PaymentLinkPayment>>(
    `/v1/wallets/${walletId}/payment-links/${linkId}/payments${pageQuery(opts)}`,
    { token },
  );
}

export function createPaymentLink(
  token: AuthToken,
  walletId: WalletId,
  params: {
    name: string;
    description?: string;
    imageUrl?: string;
    redirectUrl?: string;
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
      redirect_url: params.redirectUrl || null,
      amount_usdc_stroops: params.amountUsdcStroops ?? null,
    }),
  });
}

export function getPaymentLink(
  token: AuthToken,
  walletId: WalletId,
  linkId: string,
) {
  return apiFetch<PaymentLink>(
    `/v1/wallets/${walletId}/payment-links/${linkId}`,
    { token },
  );
}

export function setPaymentLinkActive(
  token: AuthToken,
  walletId: WalletId,
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
  redirect_url: string | null;
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
  /** ISO timestamp after which the intent can no longer be paid, when the API provides it. */
  expires_at?: string | null;
  /** ISO timestamp after which the intent can no longer be paid, when the API provides it. */
  expires_at?: string | null;
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
  /** "pending" | "confirmed" | "expired" | "underpaid" | "overpaid". */
  status: string;
  transaction_id: string | null;
  expected_usdc_stroops: number;
  /** What actually landed on-chain, once a deposit has been matched. */
  received_usdc_stroops: number | null;
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

/**
 * Relay a payer-signed (e.g. Freighter) payment to this payment's deposit address.
 *
 * `paymentId` identifies the intent being paid: each intent has its own muxed address, and the
 * server validates the transaction's destination against that address.
 */
export function submitPublicPayment(
  slug: string,
  transactionXdr: string,
  paymentId: string,
) {
  return apiFetch<SubmitPaymentResult>(`/v1/pay/${slug}/submit-signed`, {
    method: "POST",
    body: JSON.stringify({
      transaction_xdr: transactionXdr,
      payment_id: paymentId,
    }),
  });
}

/** Parse a decimal USD amount string into integer USDC stroops, or null if invalid. */
export function usdAmountToStroops(usd: string): number | null {
  return toApiStroops(parseAmount(usd));
}

/** Basic shape check (not full RFC 5322) — enough to catch typos before submitting. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
