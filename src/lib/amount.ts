/**
 * Shared Stellar amount parsing + formatting.
 *
 * On-chain amounts are int64 stroops with 7 implied decimals. Everything here works in `bigint`
 * so no amount ever passes through a float (0.1 + 0.2 style drift moves real money).
 */

export const STELLAR_DECIMALS = 7;
export const STROOPS_PER_UNIT = BigInt(10_000_000);
const INT64_MAX = BigInt("9223372036854775807");
const ZERO = BigInt(0);

/**
 * Default minimum for flexible-amount payment links, in whole USDC.
 *
 * Dust intents (down to 1 stroop) clutter the merchant's payment list, cost the payer a network
 * fee worth more than the payment, and can be used to spam a link. The backend must enforce the
 * same limit; this constant is only the client-side UX default and is used when a link does not
 * provide its own `min_amount_usdc_stroops`.
 */
export const MIN_FLEXIBLE_USD = 0.01;

/** Default minimum for flexible-amount links, in stroops (derived from `MIN_FLEXIBLE_USD`). */
export const MIN_FLEXIBLE_STROOPS = BigInt(Math.round(MIN_FLEXIBLE_USD * 10 ** STELLAR_DECIMALS));

export type ParsedAmount =
  | { ok: true; stroops: bigint }
  | { ok: false; error: string };

// Parse a decimal string ("1.5", ".5", "10.") into exact stroops; zero is allowed, callers decide.
export function parseAmount(input: string): ParsedAmount {
  const s = input.trim();
  if (!s) return { ok: false, error: "Enter an amount." };
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[1] === "" && !m[2])) {
    return { ok: false, error: "Enter a valid number, e.g. 1.5." };
  }
  const frac = m[2] ?? "";
  if (frac.length > STELLAR_DECIMALS) {
    return {
      ok: false,
      error: `Stellar amounts support at most ${STELLAR_DECIMALS} decimal places.`,
    };
  }
  const stroops =
    BigInt(m[1] || "0") * STROOPS_PER_UNIT +
    BigInt(frac.padEnd(STELLAR_DECIMALS, "0"));
  if (stroops > INT64_MAX) return { ok: false, error: "Amount is too large." };
  return { ok: true, stroops };
}

// Coerce an integer stroop value to BigInt, throwing on anything that is not an exact integer.
function toStroopBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new RangeError(`Invalid stroop value: ${value}`);
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new RangeError(`Invalid stroop value: ${value}`);
  return BigInt(value);
}

// Format stroops exactly with trailing zeros trimmed (100 -> "0.00001"), or to fixed `dp` places rounding half up.
export function formatStroops(value: bigint | number | string, dp?: number): string {
  const v = toStroopBigInt(value);
  const neg = v < ZERO;
  const abs = neg ? -v : v;
  if (dp === undefined) {
    const frac = (abs % STROOPS_PER_UNIT)
      .toString()
      .padStart(STELLAR_DECIMALS, "0")
      .replace(/0+$/, "");
    return `${neg ? "-" : ""}${(abs / STROOPS_PER_UNIT).toString()}${frac ? `.${frac}` : ""}`;
  }
  if (!Number.isInteger(dp) || dp < 0 || dp > STELLAR_DECIMALS) {
    throw new RangeError(`Invalid decimal places: ${dp}`);
  }
  const step = BigInt(10) ** BigInt(STELLAR_DECIMALS - dp);
  const scaled = (abs + step / BigInt(2)) / step;
  const unit = BigInt(10) ** BigInt(dp);
  const frac = dp > 0 ? `.${(scaled % unit).toString().padStart(dp, "0")}` : "";
  return `${neg && scaled > ZERO ? "-" : ""}${(scaled / unit).toString()}${frac}`;
}

// Narrow a parsed amount to a positive JSON-safe number for the API, or null if invalid/out of range.
export function toApiStroops(parsed: ParsedAmount): number | null {
  if (!parsed.ok || parsed.stroops <= ZERO) return null;
  if (parsed.stroops > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(parsed.stroops);
}

// Sum integer stroop values exactly; float addition drifts once a total passes 2^53.
export function sumStroops(values: Iterable<bigint | number | string>): bigint {
  let total = ZERO;
  for (const v of values) total += toStroopBigInt(v);
  return total;
}

/**
 * Validate a flexible-amount payment against the link's min/max bounds (in stroops).
 *
 * Returns a user-facing error message when the amount is below `minStroops` or above
 * `maxStroops` (when a maximum is set), or `null` when the amount is acceptable. The client
 * check is UX only; the backend must enforce the same limits.
 */
export function validateFlexibleAmount(
  stroops: number,
  minStroops: number,
  maxStroops: number | null,
): string | null {
  if (!Number.isFinite(stroops) || !Number.isInteger(stroops)) {
    return "Enter a valid amount.";
  }
  if (!Number.isFinite(minStroops) || !Number.isInteger(minStroops)) {
    throw new RangeError(`Invalid minimum stroop value: ${minStroops}`);
  }
  if (maxStroops !== null && (!Number.isFinite(maxStroops) || !Number.isInteger(maxStroops))) {
    throw new RangeError(`Invalid maximum stroop value: ${maxStroops}`);
  }
  if (stroops < minStroops) {
    return `Enter at least $${formatStroops(minStroops, 2)}.`;
  }
  if (maxStroops !== null && stroops > maxStroops) {
    return `Enter at most $${formatStroops(maxStroops, 2)}.`;
  }
  return null;
}