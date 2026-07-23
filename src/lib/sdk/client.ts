/**
 * API calls for the non-custodial flow: fetch signing info, submit a signed tx, fetch/store the
 * encrypted backup. Thin wrappers over `apiFetch`, kept in the SDK so an external customer could
 * use the same module.
 */
import { apiFetch } from "@/lib/api";
import type { SigningInfo } from "./tx";

export type SubmitResult = {
  status: string;
  stellar_tx_hash: string | null;
  detail?: string | null;
};

/** Fetch what the client needs to build a transaction (sequence + network params). */
export function getSigningInfo(token: string, walletId: string) {
  return apiFetch<SigningInfo>(`/v1/wallets/${walletId}/signing-info`, { token });
}

/** Relay a client-signed transaction. The server validates + submits; it never signs. */
export function submitSigned(token: string, walletId: string, signedXdr: string) {
  return apiFetch<SubmitResult>(`/v1/wallets/${walletId}/submit-signed`, {
    method: "POST",
    token,
    body: JSON.stringify({ transaction_xdr: signedXdr }),
  });
}

/** Fetch the opaque encrypted backup blob for new-device recovery (may be null). */
export function getBackup(token: string, walletId: string) {
  return apiFetch<{ wallet_id: string; encrypted_backup: string | null }>(
    `/v1/wallets/${walletId}/backup`,
    { token },
  );
}
