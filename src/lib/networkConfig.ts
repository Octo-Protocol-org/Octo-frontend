/**
 * Per-network constants for Stellar assets.
 *
 * The USDC issuer is network-specific: using the testnet issuer on mainnet creates trustlines
 * and payments to the wrong asset. Always derive the issuer from the network passphrase.
 */

export const NETWORK_PASSPHRASE_MAINNET =
  "Public Global Stellar Network ; September 2015";
export const NETWORK_PASSPHRASE_TESTNET =
  "Test SDF Network ; September 2015";

/** Circle's official USDC issuer on Stellar mainnet. */
const USDC_ISSUER_MAINNET =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

/** The most-widely-used USDC issuer on the Stellar testnet (~45k trustlines). */
const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export type NetworkAsset = { readonly code: string; readonly issuer: string };

/** Return the correct USDC issuer for the given network passphrase. */
export function usdcForNetwork(networkPassphrase: string): NetworkAsset {
  if (networkPassphrase === NETWORK_PASSPHRASE_MAINNET) {
    return { code: "USDC", issuer: USDC_ISSUER_MAINNET };
  }
  // Default to testnet for any non-mainnet passphrase (including empty / unknown).
  return { code: "USDC", issuer: USDC_ISSUER_TESTNET };
}
