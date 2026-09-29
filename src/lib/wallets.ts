/** Wallet API calls + types, mirroring the octo backend. */

"use client";

import { apiFetch, path } from "./api";
import { parseAmount, toApiStroops } from "./amount";
import { pageQuery, type Paginated, type PageOpts } from "./pagination";
import { network } from "./network";

export type { Paginated, PageOpts } from "./pagination";

export type CreateWalletResponse = {
  id: string;
  network: string;
  address: string;
  custody: string;
  funded: boolean;
};

export type WalletView = {
  id: string;
  network: string;
  address: string;
  custody: string;
  label: string | null;
  description: string | null;
};

export type Balance = {
  balance: string;
  asset_type: string;
  asset_code?: string | null;
  asset_issuer?: string | null;
};

export type Address = {
  id: string;
  customer_ref: string | null;
  muxed_address: string;
  base_address: string;
  memo_id: number;
  metadata: unknown;
  /**
   * Lifetime total (stroops) of confirmed deposits credited to this address. Historical
   * bookkeeping, not a live balance — deposits always land in the wallet's single master
   * account (that's the point of muxed addresses; there is nothing to sweep per-address).
   */
  received_stroops: number;
};

export type Transaction = {
  id: string;
  /** "deposit" | "withdrawal". */
  direction: string;
  /**
   * The generated address this deposit was attributed to. `null` means the sender used the bare
   * G... account with no muxed id or memo, so it could not be tied to a customer.
   */
  address_id: string | null;
  asset_code: string;
  /** Present for credit assets (e.g. USDC); null for native XLM. */
  asset_issuer: string | null;
  amount_stroops: number;
  source_account: string | null;
  destination_account: string | null;
  stellar_tx_hash: string | null;
  /** "confirmed" | "failed". Deposits are always "confirmed" (only successful ops are recorded). */
  status: string;
  /** Stellar ledger sequence the transaction was included in, if known. */
  ledger: number | null;
  /** Numeric memo id, for the G...+memo deposit-attribution fallback. */
  memo_id: number | null;
  created_at: string;
};

/** Fetch a short-lived ownership challenge; sign it with the new keypair before createWallet. */
export function getWalletChallenge(token: string) {
  return apiFetch<{ challenge: string }>("/v1/wallets/challenge", { token });
}

/**
 * Create a non-custodial master wallet. The keypair is generated CLIENT-SIDE (see
 * `@/lib/sdk`); this call registers only the public key and an opaque encrypted backup the
 * server cannot decrypt. `challenge`/`signature` prove the caller controls the private key
 * for `publicKey` — without this anyone could register a stranger's account.
 */
export function createWallet(
  token: string,
  params: {
    publicKey: string;
    challenge: string;
    signature: string;
    encryptedBackup?: string;
    label?: string;
    description?: string;
  },
) {
  return apiFetch<CreateWalletResponse>("/v1/wallets", {
    method: "POST",
    token,
    body: JSON.stringify({
      public_key: params.publicKey,
      challenge: params.challenge,
      signature: params.signature,
      encrypted_backup: params.encryptedBackup ?? null,
      label: params.label || null,
      description: params.description || null,
    }),
  });
}

export type GasTankResult = {
  wallet_id: string;
  gas_tank_address: string;
  funded: boolean;
};

/** Provision the server-held gas tank that pays sponsored fees (fee float only, never funds). */
export function createGasTank(token: string, id: string) {
  return apiFetch<GasTankResult>(path`/v1/wallets/${id}/gas-tank`, {
    method: "POST",
    token,
  });
}

/**
 * Cursor-paginated list payload.
 *
 * `apiFetch` already unwraps the outer `{statusCode, message, data}` envelope, so what these
 * endpoints hand back is *this* object — NOT a bare array. Reading it as an array yields
 * `undefined` and renders an empty list, which is exactly how a freshly created wallet went
 * missing from the dashboard.
 */
/** List the authenticated user's wallets (newest first). */
export async function listWallets(token: string): Promise<WalletView[]> {
  const page = await apiFetch<Paginated<WalletView>>("/v1/wallets", { token });
  return page.data;
}

export function getWallet(token: string, id: string) {
  return apiFetch<WalletView>(path`/v1/wallets/${id}`, { token });
}

// Balances come straight from Horizon and are not paginated — a flat array here is correct.
export function getBalances(token: string, id: string) {
  return apiFetch<Balance[]>(path`/v1/wallets/${id}/balances`, { token });
}

/** First page of addresses up to `limit` rows — name reflects the partial view returned. */
export async function listRecentAddresses(
  token: string,
  id: string,
  limit = 20,
): Promise<Address[]> {
  const page = await apiFetch<Paginated<Address>>(
    path`/v1/wallets/${id}/addresses` + pageQuery({ limit }),
    { token },
  );
  return page.data;
}

export function createAddress(
  token: string,
  id: string,
  customerRef?: string,
) {
  return apiFetch<Address>(path`/v1/wallets/${id}/addresses`, {
    method: "POST",
    token,
    body: JSON.stringify({ customer_ref: customerRef || null }),
  });
}

/** First page of transactions up to `limit` rows — name reflects the partial view returned. */
export async function listRecentTransactions(
  token: string,
  id: string,
  limit = 20,
): Promise<Transaction[]> {
  const page = await apiFetch<Paginated<Transaction>>(
    path`/v1/wallets/${id}/transactions` + pageQuery({ limit }),
    { token },
  );
  return page.data;
}

/**
 * Cursor-paginated transactions. Unlike `listRecentTransactions`, this keeps `next_cursor`
 * so the caller can page forward.
 */
export function listTransactionsPage(
  token: string,
  id: string,
  opts?: PageOpts,
): Promise<Paginated<Transaction>> {
  return apiFetch<Paginated<Transaction>>(
    path`/v1/wallets/${id}/transactions` + pageQuery(opts),
    { token },
  );
}

/** Paginated addresses (see `listTransactionsPage`). */
export function listAddressesPage(
  token: string,
  id: string,
  opts?: PageOpts,
): Promise<Paginated<Address>> {
  return apiFetch<Paginated<Address>>(
    path`/v1/wallets/${id}/addresses` + pageQuery(opts),
    { token },
  );
}

/**
 * The transactions table stores the literal string "native" as `asset_code` for XLM (mirroring
 * Horizon's own `asset_type` convention) — display it as "XLM" everywhere a user sees it.
 */
export function displayAssetCode(assetCode: string): string {
  return assetCode === "native" ? "XLM" : assetCode;
}

/** Parse a decimal XLM amount string into integer stroops, or null if invalid. */
export function amountToStroops(xlm: string): number | null {
  return toApiStroops(parseAmount(xlm));
}

/**
 * Active network's USDC asset (code + issuer), sourced from the network config module.
 * @deprecated Import `network.usdc` from `@/lib/network` directly in new code.
 */
export const USDC_TESTNET = network.usdc as { code: string; issuer: string };

// Withdrawals and trustlines are now built + signed CLIENT-SIDE via `@/lib/sdk` and relayed
// through `submitSigned` — the server holds no key to sign them. The old custodial
// `withdraw()` / `addTrustline()` helpers were removed with the non-custodial cutover.

export type ApiKeyInfo = {
  wallet_id: string;
  configured: boolean;
  prefix: string | null;
};

export type GeneratedKey = {
  wallet_id: string;
  api_key: string;
  prefix: string;
};

/** Metadata about the wallet's API key (prefix + whether configured) — never the secret. */
export function getApiKey(token: string, id: string) {
  return apiFetch<ApiKeyInfo>(path`/v1/wallets/${id}/api-key`, { token });
}

/** Generate (or regenerate) the wallet's API key. Returns the full key once. */
export function generateApiKey(token: string, id: string) {
  return apiFetch<GeneratedKey>(path`/v1/wallets/${id}/api-key`, {
    method: "POST",
    token,
  });
}

// --- Withdrawal allowlist ("Whitelist") ------------------------------------
//
// An anti-fraud control: when enabled, submit-signed rejects payments to any destination not on
// this list. Management requires the dashboard login JWT (not an API key) on the backend, which
// `token` here always is.

export type WhitelistConfig = { enabled: boolean };

export type WhitelistedAddress = {
  id: string;
  address: string;
  label: string | null;
  created_at: string;
};

export function getWhitelistConfig(token: string, id: string) {
  return apiFetch<WhitelistConfig>(path`/v1/wallets/${id}/whitelist/config`, { token });
}

export function setWhitelistEnabled(token: string, id: string, enabled: boolean) {
  return apiFetch<WhitelistConfig>(path`/v1/wallets/${id}/whitelist/config`, {
    method: "PUT",
    token,
    body: JSON.stringify({ enabled }),
  });
}

export function listWhitelistedAddresses(token: string, id: string) {
  return apiFetch<WhitelistedAddress[]>(path`/v1/wallets/${id}/whitelist`, { token });
}

export function addWhitelistedAddress(
  token: string,
  id: string,
  address: string,
  label?: string,
) {
  return apiFetch<WhitelistedAddress>(path`/v1/wallets/${id}/whitelist`, {
    method: "POST",
    token,
    body: JSON.stringify({ address, label: label || null }),
  });
}

export function removeWhitelistedAddress(token: string, id: string, entryId: string) {
  return apiFetch<{ removed: boolean }>(path`/v1/wallets/${id}/whitelist/${entryId}`, {
    method: "DELETE",
    token,
  });
}
