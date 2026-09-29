/** Gas sponsorship config API calls + types, mirroring the octo backend. */

"use client";

import { apiFetch, path } from "./api";
import { formatStroops } from "./amount";
import { pageQuery, type PageOpts, type Paginated } from "./pagination";

/** Shared formatter for stroop values, used by both sponsorship pages. */
export function formatStroopsValue(stroops: number): string {
  return formatStroops(stroops);
}

import type { AuthToken, WalletId } from "./brands";

export type { AuthToken, WalletId };

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
  return apiFetch<SponsorshipConfig>(path`/v1/wallets/${walletId}/sponsorship`, {
    token,
  });
}

/** Update (upsert) the gas sponsorship config for a wallet. */
export function updateSponsorshipConfig(
  token: AuthToken,
  walletId: WalletId,
  payload: SponsorshipConfigPayload,
) {
  return apiFetch<SponsorshipConfig>(path`/v1/wallets/${walletId}/sponsorship`, {
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

export type SponsoredTxnPage = Paginated<SponsoredTransaction>;

/**
 * List a wallet's sponsored transactions, newest first (50 per page).
 * Pass the previous page's `next_cursor` to fetch the following page.
 */
export function listSponsoredTransactions(
  token: AuthToken,
  walletId: WalletId,
  opts?: PageOpts,
) {
  return apiFetch<SponsoredTxnPage>(
    path`/v1/wallets/${walletId}/sponsored-transactions` + pageQuery({ limit: opts?.limit ?? 50, before: opts?.before }),
    { token },
  );
}

/**
 * Format integer stroops as a human-readable XLM string (up to 7 dp, trailing zeros trimmed).
 * Stellar fees are tiny (base fee 100 stroops = 0.00001 XLM), so rounding to 2 dp hid them.
 */
export function stroopsToXlm(stroops: number): string {
  return `${formatStroopsValue(stroops)} XLM`;
}
