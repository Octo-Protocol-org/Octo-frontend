/** Gas tank status API. Provisioning reuses `createGasTank` from ./wallets. */

import { apiFetch, path } from "./api";

export type GasTankStatus = {
  gas_tank_address: string | null;
  funded: boolean;
  /** XLM balance as a decimal string, when the backend reports it. */
  balance_xlm?: string | null;
};

/** Assumed endpoint: GET /v1/wallets/:id/gas-tank (404 when no tank exists yet). */
export function getGasTank(token: string, id: string) {
  return apiFetch<GasTankStatus>(path`/v1/wallets/${id}/gas-tank`, { token });
}
