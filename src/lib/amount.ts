/**
 * Exact money helpers. Stellar amounts are int64 stroops (1 unit = 10^7 stroops), so all maths
 * here is string/BigInt — never floating point, which silently loses precision past 2^53.
 */

const STROOP_DECIMALS = 7;
const STROOPS_PER_UNIT = BigInt(10) ** BigInt(STROOP_DECIMALS);
// Stellar's int64 ceiling (922337203685.4775807 units) — nothing larger can exist on-ledger.
const MAX_STROOPS = BigInt("9223372036854775807");
// Strict decimal: digits, optionally a dot and 1–7 digits. No sign, exponent, hex or bare ".5".
const AMOUNT_PATTERN = /^\d+(\.\d{1,7})?$/;

/** Coerce an integer stroop value to BigInt, throwing on anything that is not an exact integer. */
function toStroopBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new RangeError(`Invalid stroop value: ${value}`);
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new RangeError(`Invalid stroop value: ${value}`);
  return BigInt(value);
}

/** Format integer stroops as a decimal string with `dp` places (0–7), rounding half up. */
export function formatStroops(value: bigint | number | string, dp = STROOP_DECIMALS): string {
  if (!Number.isInteger(dp) || dp < 0 || dp > STROOP_DECIMALS) {
    throw new RangeError(`Invalid decimal places: ${dp}`);
  }
  const raw = toStroopBigInt(value);
  const negative = raw < BigInt(0);
  const step = BigInt(10) ** BigInt(STROOP_DECIMALS - dp);
  const scaled = ((negative ? -raw : raw) + step / BigInt(2)) / step;
  const unit = BigInt(10) ** BigInt(dp);
  const whole = (scaled / unit).toString();
  const frac = dp > 0 ? `.${(scaled % unit).toString().padStart(dp, "0")}` : "";
  return `${negative && scaled > BigInt(0) ? "-" : ""}${whole}${frac}`;
}

/** Parse a user-typed decimal amount into exact stroops; null if malformed, >7 dp or > int64. */
export function parseAmount(input: string): bigint | null {
  const s = input.trim();
  if (!AMOUNT_PATTERN.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const stroops =
    BigInt(whole) * STROOPS_PER_UNIT + BigInt(frac.padEnd(STROOP_DECIMALS, "0"));
  return stroops > MAX_STROOPS ? null : stroops;
}

/** Narrow parsed stroops to a positive JSON-safe number for the API, or null if out of range. */
export function toApiStroops(stroops: bigint | null): number | null {
  if (stroops === null || stroops <= BigInt(0)) return null;
  if (stroops > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(stroops);
}

/** Sum integer stroop values exactly; float addition drifts once a total passes 2^53. */
export function sumStroops(values: Iterable<bigint | number | string>): bigint {
  let total = BigInt(0);
  for (const v of values) total += toStroopBigInt(v);
  return total;
}
