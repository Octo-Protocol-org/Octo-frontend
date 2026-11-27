// Branded ID types so a token and a wallet ID can never be swapped at a call site.
export type AuthToken = string & { __brand: "AuthToken" };
export type WalletId = string & { __brand: "WalletId" };

export function asAuthToken(value: string): AuthToken {
  return value as AuthToken;
}

export function asWalletId(value: string): WalletId {
  return value as WalletId;
}

/**
 * Wire representation of a stroop amount. The API serialises these as decimal strings so they
 * survive JSON.parse without silent rounding (Stellar int64 max > Number.MAX_SAFE_INTEGER).
 *
 * Use `toStroopBigInt` from `amount.ts` to convert to bigint for arithmetic.
 */
export type Stroops = string & { __brand: "Stroops" };

/**
 * Convert a raw stroop value from the API (string or number) to the branded Stroops type.
 *
 * During migration the backend may still send numbers for amounts that fit safely in a JS
 * number. Values above Number.MAX_SAFE_INTEGER are unsafe and trigger an error so they are
 * never silently rounded.
 */
export function toStroops(raw: string | number): Stroops {
  if (typeof raw === "string") {
    if (!/^\d+$/.test(raw)) throw new RangeError(`Invalid stroop value: ${raw}`);
    return raw as Stroops;
  }
  if (!Number.isInteger(raw) || raw < 0) {
    throw new RangeError(`Invalid stroop value: ${raw}`);
  }
  if (raw > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(
      `Stroop value ${raw} exceeds Number.MAX_SAFE_INTEGER — the backend must send it as a string.`,
    );
  }
  return String(raw) as Stroops;
}

/**
 * Wire representation of a Stellar memo ID. Memo IDs are uint64, which exceeds
 * Number.MAX_SAFE_INTEGER, so the API must serialise them as decimal strings.
 *
 * During migration `toMemoId` accepts numbers that are still within safe range.
 */
export type MemoId = string & { __brand: "MemoId" };

/**
 * Convert a raw memo ID from the API (string or number) to the branded MemoId type.
 *
 * Values above Number.MAX_SAFE_INTEGER are rejected when arriving as numbers because they
 * have already been silently rounded by JSON.parse.
 */
export function toMemoId(raw: string | number): MemoId {
  if (typeof raw === "string") {
    if (!/^\d+$/.test(raw)) throw new RangeError(`Invalid memo ID: ${raw}`);
    return raw as MemoId;
  }
  if (!Number.isInteger(raw) || raw < 0) {
    throw new RangeError(`Invalid memo ID: ${raw}`);
  }
  if (raw > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(
      `Memo ID ${raw} exceeds Number.MAX_SAFE_INTEGER — the backend must send it as a string.`,
    );
  }
  return String(raw) as MemoId;
}
