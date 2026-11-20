/**
 * Single source of truth for Stellar network-specific values.
 * Driven by NEXT_PUBLIC_STELLAR_NETWORK ("testnet" | "mainnet").
 * An unknown value throws at module-load time so the build fails fast.
 */

const raw = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";

type NetworkConfig = {
  /** Human-readable name shown in UI labels and banners. */
  displayName: string;
  /** Stellar network passphrase used to sign and verify transactions. */
  passphrase: string;
  /** USDC asset code and issuer for this network. */
  usdc: { code: string; issuer: string };
  /** Base URL for stellar.expert explorer links (no trailing slash). */
  explorerBase: string;
  /** True only on testnet — gates the "test mode" banner and network badges. */
  isTestnet: boolean;
};

const CONFIGS: Record<string, NetworkConfig> = {
  testnet: {
    displayName: "Testnet",
    passphrase: "Test SDF Network ; September 2015",
    usdc: {
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
    explorerBase: "https://stellar.expert/explorer/testnet",
    isTestnet: true,
  },
  mainnet: {
    displayName: "Mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    usdc: {
      code: "USDC",
      // Canonical Circle USDC issuer on Stellar mainnet.
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
    explorerBase: "https://stellar.expert/explorer/public",
    isTestnet: false,
  },
};

const config = CONFIGS[raw];
if (!config) {
  throw new Error(
    `Unknown NEXT_PUBLIC_STELLAR_NETWORK value "${raw}". Must be "testnet" or "mainnet".`,
  );
}

export const network: NetworkConfig = config;

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = CONFIGS;

/** Returns the per-network config for a Stellar network passphrase; throws on unknown input. */
export function configForPassphrase(passphrase: string): NetworkConfig {
  const found = Object.values(CONFIGS).find((c) => c.passphrase === passphrase);
  if (!found) throw new Error(`Unknown network passphrase "${passphrase}".`);
  return found;
}

/** Returns the USDC asset for a Stellar network passphrase; throws on unknown input. */
export function usdcForNetwork(passphrase: string): { code: string; issuer: string } {
  return configForPassphrase(passphrase).usdc;
}

/** Returns the stellar.expert URL for a transaction hash. */
export function explorerTxUrl(hash: string): string {
  return `${network.explorerBase}/tx/${hash}`;
}

/** Returns the stellar.expert URL for an account address. */
export function explorerAccountUrl(address: string): string {
  return `${network.explorerBase}/account/${address}`;
}
