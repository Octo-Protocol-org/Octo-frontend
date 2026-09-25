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

// Format stroops as a decimal with up to 7 places and trailing zeros trimmed (100 -> "0.00001").
export function formatStroops(stroops: bigint | number): string {
  const v = typeof stroops === "bigint" ? stroops : BigInt(Math.trunc(stroops));
  const neg = v < ZERO;
  const abs = neg ? -v : v;
  const whole = abs / STROOPS_PER_UNIT;
  const frac = (abs % STROOPS_PER_UNIT)
    .toString()
    .padStart(STELLAR_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}
