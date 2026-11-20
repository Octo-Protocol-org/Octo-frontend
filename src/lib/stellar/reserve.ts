import type { SigningInfo } from "@/lib/sdk/tx";

/** Protocol base reserve (0.5 XLM); only a fallback when the backend doesn't report the live value. */
export const DEFAULT_BASE_RESERVE_STROOPS = 5_000_000;
/** Protocol minimum per-operation fee; fallback for the same reason. */
export const DEFAULT_BASE_FEE_STROOPS = 100;

export type ReserveInfo = Partial<
  Pick<
    SigningInfo,
    | "base_fee_stroops"
    | "base_reserve_stroops"
    | "subentry_count"
    | "num_sponsoring"
    | "num_sponsored"
  >
>;

const ZERO = BigInt(0);

// Backend numbers are integers in practice; truncate so a stray float can never throw in BigInt().
function big(n: number): bigint {
  return BigInt(Math.trunc(n));
}

function baseReserve(info: ReserveInfo | null): bigint {
  return big(info?.base_reserve_stroops ?? DEFAULT_BASE_RESERVE_STROOPS);
}

/** True when the backend reported everything needed for an exact minimum balance. */
export function reserveIsExact(info: ReserveInfo | null): boolean {
  return info?.base_reserve_stroops != null && info?.subentry_count != null;
}

/** Minimum balance = (2 + subentries + sponsoring − sponsored) × base reserve. */
export function minimumBalanceStroops(
  info: ReserveInfo | null,
  fallbackSubentries: number,
): bigint {
  const entries =
    2 +
    (info?.subentry_count ?? fallbackSubentries) +
    (info?.num_sponsoring ?? 0) -
    (info?.num_sponsored ?? 0);
  return big(Math.max(0, entries)) * baseReserve(info);
}

/** XLM that can leave the account while still covering the minimum balance and one op's fee. */
export function spendableNativeStroops(
  balance: bigint,
  info: ReserveInfo | null,
  fallbackSubentries: number,
): bigint {
  const fee = big(info?.base_fee_stroops ?? DEFAULT_BASE_FEE_STROOPS);
  const spendable = balance - minimumBalanceStroops(info, fallbackSubentries) - fee;
  return spendable > ZERO ? spendable : ZERO;
}

/** A new account's starting balance must cover its own 2-entry minimum (1 XLM today). */
export function minCreateAccountStroops(info: ReserveInfo | null): bigint {
  return BigInt(2) * baseReserve(info);
}
