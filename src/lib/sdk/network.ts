import { network } from '@/lib/network';

/**
 * Thrown when a caller supplies a network passphrase that does not match the
 * network this application is configured to talk to.
 */
export class NetworkConsistencyError extends Error {
  constructor(expected: string, received: string) {
    super(
      `Network mismatch: this application is configured for network "${expected}" ` +
        `but received network "${received}". ` +
        `Please switch your wallet/client to the "${expected}" network and try again.`,
    );
    this.name = 'NetworkConsistencyError';
  }
}

/**
 * Returns true when the supplied passphrase matches the configured network
 * passphrase, false otherwise.
 */
export function isConfiguredNetwork(networkPassphrase: string): boolean {
  return networkPassphrase === network.passphrase;
}

/**
 * Asserts that the supplied passphrase matches the configured network
 * passphrase. Throws a {@link NetworkConsistencyError} with a descriptive
 * message naming both the expected and received networks when it does not.
 */
export function assertNetworkConsistency(networkPassphrase: string): void {
  if (!isConfiguredNetwork(networkPassphrase)) {
    throw new NetworkConsistencyError(network.passphrase, networkPassphrase);
  }
}