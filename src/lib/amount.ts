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
