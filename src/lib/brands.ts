// Branded ID types so a token and a wallet ID can never be swapped at a call site.
export type AuthToken = string & { __brand: "AuthToken" };
export type WalletId = string & { __brand: "WalletId" };

export function asAuthToken(value: string): AuthToken {
  return value as AuthToken;
}

export function asWalletId(value: string): WalletId {
  return value as WalletId;
}
