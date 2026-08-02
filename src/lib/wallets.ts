/** Wallet API calls + types, mirroring the octo backend. */

"use client";

import { apiFetch } from "./api";

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
  return apiFetch<GasTankResult>(`/v1/wallets/${id}/gas-tank`, {
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
export type Paginated<T> = {
  data: T[];
  /** Pass as `?before=` to fetch the next page; null when there are no more rows. */
  next_cursor: string | null;
};

/** List the authenticated user's wallets (newest first). */
export async function listWallets(token: string): Promise<WalletView[]> {
  const page = await apiFetch<Paginated<WalletView>>("/v1/wallets", { token });
  return page.data;
}

export function getWallet(token: string, id: string) {
  return apiFetch<WalletView>(`/v1/wallets/${id}`, { token });
}

// Balances come straight from Horizon and are not paginated — a flat array here is correct.
export function getBalances(token: string, id: string) {
  return apiFetch<Balance[]>(`/v1/wallets/${id}/balances`, { token });
}

export async function listAddresses(
  token: string,
  id: string,
): Promise<Address[]> {
  const page = await apiFetch<Paginated<Address>>(
    `/v1/wallets/${id}/addresses`,
    { token },
  );
  return page.data;
}

export function createAddress(
  token: string,
  id: string,
  customerRef?: string,
) {
  return apiFetch<Address>(`/v1/wallets/${id}/addresses`, {
    method: "POST",
    token,
    body: JSON.stringify({ customer_ref: customerRef || null }),
  });
}

export async function listTransactions(
  token: string,
  id: string,
): Promise<Transaction[]> {
  const page = await apiFetch<Paginated<Transaction>>(
    `/v1/wallets/${id}/transactions`,
    { token },
  );
  return page.data;
}

/** Options shared by the paginated list helpers. */
export type PageOpts = {
  /** Rows per page (backend default 50, max 200). */
  limit?: number;
  /** Cursor from the previous page's `next_cursor`; omit for the first page. */
  before?: string | null;
};

function pageQuery(opts?: PageOpts): string {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.before) params.set("before", opts.before);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Paginated transactions. Unlike `listTransactions`, this keeps `next_cursor` so the caller can
 * page forward — the backend has always supported cursors, the UI just discarded them and
 * silently showed only the first page.
 */
export function listTransactionsPage(
  token: string,
  id: string,
  opts?: PageOpts,
): Promise<Paginated<Transaction>> {
  return apiFetch<Paginated<Transaction>>(
    `/v1/wallets/${id}/transactions${pageQuery(opts)}`,
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
    `/v1/wallets/${id}/addresses${pageQuery(opts)}`,
    { token },
  );
}

/** Format integer stroops as a decimal XLM-style string (7 dp). */
export function stroopsToAmount(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
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
  const n = Number(xlm);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10_000_000);
}

/**
 * The most widely-used USDC issuer on the Stellar **testnet** (~45k trustlines) —
 * the one testnet faucets/tutorials mint against. auth_required=false, so a
 * trustline just works (it is auth_revocable, which is harmless on testnet).
 * Testnet has no single "canonical" Circle USDC the way mainnet does.
 * (Mainnet USDC is GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN —
 * wire this up per-network when mainnet lands.)
 */
export const USDC_TESTNET = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
} as const;

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
  return apiFetch<ApiKeyInfo>(`/v1/wallets/${id}/api-key`, { token });
}

/** Generate (or regenerate) the wallet's API key. Returns the full key once. */
export function generateApiKey(token: string, id: string) {
  return apiFetch<GeneratedKey>(`/v1/wallets/${id}/api-key`, {
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
  return apiFetch<WhitelistConfig>(`/v1/wallets/${id}/whitelist/config`, { token });
}

export function setWhitelistEnabled(token: string, id: string, enabled: boolean) {
  return apiFetch<WhitelistConfig>(`/v1/wallets/${id}/whitelist/config`, {
    method: "PUT",
    token,
    body: JSON.stringify({ enabled }),
  });
}

export function listWhitelistedAddresses(token: string, id: string) {
  return apiFetch<WhitelistedAddress[]>(`/v1/wallets/${id}/whitelist`, { token });
}

export function addWhitelistedAddress(
  token: string,
  id: string,
  address: string,
  label?: string,
) {
  return apiFetch<WhitelistedAddress>(`/v1/wallets/${id}/whitelist`, {
    method: "POST",
    token,
    body: JSON.stringify({ address, label: label || null }),
  });
}

export function removeWhitelistedAddress(token: string, id: string, entryId: string) {
  return apiFetch<{ removed: boolean }>(`/v1/wallets/${id}/whitelist/${entryId}`, {
    method: "DELETE",
    token,
  });
}

