import { apiFetch, path } from "./api";
import type { WalletView } from "./wallets";

/** Length limits for label and description (assumed to match the backend). */
export const MAX_WALLET_LABEL = 60;
export const MAX_WALLET_DESCRIPTION = 280;

/** Assumed endpoint: PATCH /v1/wallets/:id { label, description } -> WalletView. */
export function updateWalletDetails(
  token: string,
  id: string,
  details: { label: string; description: string },
) {
  return apiFetch<WalletView>(path`/v1/wallets/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      label: details.label.trim() || null,
      description: details.description.trim() || null,
    }),
  });
}
