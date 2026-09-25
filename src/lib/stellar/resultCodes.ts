/**
 * Plain-language explanations for Horizon result codes, so users never see `tx_too_late` and
 * friends. Checked in order; the first code found in the server's message wins.
 */
const MESSAGES: Array<[code: string, message: string]> = [
  [
    "tx_too_late",
    "This signed withdrawal expired before it was confirmed. Nothing was sent — sign again to get a new code.",
  ],
  ["tx_bad_seq", "Another transaction was sent from this wallet in the meantime. Nothing was sent — please sign again."],
  ["op_no_destination", "The destination account doesn't exist on Stellar yet."],
  ["op_already_exists", "The destination account already exists."],
  ["op_no_trust", "The destination hasn't added a trustline for this asset, so it can't receive it."],
  ["op_not_authorized", "The asset issuer hasn't authorized the destination to hold this asset."],
  ["op_line_full", "The destination's trustline limit for this asset is full."],
  ["op_low_reserve", "The amount would leave an account below Stellar's minimum XLM reserve."],
  ["op_underfunded", "The wallet doesn't hold enough of this asset to cover the amount."],
  ["tx_insufficient_balance", "The wallet doesn't hold enough XLM to cover the amount, fee and minimum reserve."],
  ["tx_insufficient_fee", "Network fees spiked while this was pending. Please try again."],
];

const RAW_CODE = /\b(tx|op)_[a-z_]+\b/;

/** True when the network rejected the transaction because its time window had passed. */
export function isExpiredResult(text: string | null | undefined): boolean {
  return !!text && text.includes("tx_too_late");
}

/** Map a server/Horizon message to plain language; unknown raw codes collapse to `fallback`. */
export function friendlyResultMessage(
  text: string | null | undefined,
  fallback: string,
): string {
  if (!text) return fallback;
  for (const [code, message] of MESSAGES) {
    if (text.includes(code)) return message;
  }
  return RAW_CODE.test(text) ? fallback : text;
}
