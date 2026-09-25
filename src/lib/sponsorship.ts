/** Gas sponsorship config API calls + types, mirroring the octo backend. */

"use client";

import { apiFetch } from "./api";

/** Branded string so a token can never be passed where a wallet ID is expected. */
export type AuthToken = string & { __brand: "AuthToken" };

/** Branded string so a wallet ID can never be passed where a token is expected. */
export type WalletId = string & { __brand: "WalletId" };

export type SponsorshipConfig = {
  enabled: boolean;
  per_tx_fee_cap_stroops: number | null;
  daily_budget_stroops: number | null;
  /** Fees already reserved/spent today, used to show remaining budget. */
  spent_today_stroops: number;
};

export type SponsorshipConfigPayload = {
  enabled: boolean;
  per_tx_fee_cap_stroops: number | null;
  daily_budget_stroops: number | null;
};

/** Fetch the gas sponsorship config for a single wallet. */
export function getSponsorshipConfig(token: AuthToken, walletId: WalletId) {
  return apiFetch<SponsorshipConfig>(`/v1/wallets/${walletId}/sponsorship`, {
    token,
  });
}

/** Update (upsert) the gas sponsorship config for a wallet. */
export function updateSponsorshipConfig(
  token: AuthToken,
  walletId: WalletId,
  payload: SponsorshipConfigPayload,
) {
  return apiFetch<SponsorshipConfig>(`/v1/wallets/${walletId}/sponsorship`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export type SponsoredTransaction = {
  id: string;
  wallet_id: string;
  inner_tx_hash: string;
  fee_bump_tx_hash: string | null;
  fee_stroops: number;
  status: string;
  error: string | null;
  created_at: string;
};

export type SponsoredTxnPage = {
  data: SponsoredTransaction[];
  /** Pass back as `cursor` to fetch the next page; null when there are no more. */
  next_cursor: string | null;
};

/**
 * List a wallet's sponsored transactions, newest first (50 per page).
 * Pass the previous page's `next_cursor` to fetch the following page.
 */
export function listSponsoredTransactions(
  token: AuthToken,
  walletId: WalletId,
  cursor?: string,
) {
  const params = new URLSearchParams({ limit: "50" });
  if (cursor) params.set("before", cursor);
  return apiFetch<SponsoredTxnPage>(
    `/v1/wallets/${walletId}/sponsored-transactions?${params.toString()}`,
    { token },
  );
}
