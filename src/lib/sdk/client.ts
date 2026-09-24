// Branded string types so token/walletId swaps fail at compile time.
export type AuthToken = string & { __brand: 'AuthToken' };
export type WalletId = string & { __brand: 'WalletId' };

export function asAuthToken(value: string): AuthToken {
  return value as AuthToken;
}

export function asWalletId(value: string): WalletId {
  return value as WalletId;
}

export interface SdkClientOptions {
  baseUrl: string;
  token: AuthToken;
}

// Encode a dynamic path segment so crafted values can't alter the request path.
function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export class SdkClient {
  private readonly baseUrl: string;
  private readonly token: AuthToken;

  constructor(options: SdkClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  async getWallet(token: AuthToken, walletId: WalletId): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/wallets/${encodeSegment(walletId)}`, {
      method: 'GET',
      headers: { ...this.headers(), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch wallet: ${res.status}`);
    return res.json();
  }

  async getSponsorship(token: AuthToken, walletId: WalletId): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/wallets/${encodeSegment(walletId)}/sponsorship`, {
      method: 'GET',
      headers: { ...this.headers(), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch sponsorship: ${res.status}`);
    return res.json();
  }

  async updateSponsorship(
    token: AuthToken,
    walletId: WalletId,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/wallets/${encodeSegment(walletId)}/sponsorship`, {
      method: 'PUT',
      headers: { ...this.headers(), Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to update sponsorship: ${res.status}`);
    return res.json();
  }
}
