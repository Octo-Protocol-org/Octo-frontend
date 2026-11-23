import { NETWORK_CONFIGS } from "./network";

/** Build a SEP-7 `web+stellar:pay` URI. */
export function sep7PayUri(p: {
  destination: string;
  amount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memoId?: number | string;
  memoType?: "MEMO_ID" | "MEMO_TEXT";
  memo?: string;
  networkPassphrase?: string;
}): string {
  const q = new URLSearchParams({ destination: p.destination });
  if (p.amount) q.set("amount", p.amount);
  if (p.assetCode && p.assetIssuer) {
    q.set("asset_code", p.assetCode);
    q.set("asset_issuer", p.assetIssuer);
  }

  const memoType = p.memoType ?? (p.memoId !== undefined && p.memoId !== null && p.memoId !== "" ? "MEMO_ID" : undefined);
  if (memoType === "MEMO_ID") {
    const raw = p.memoId !== undefined && p.memoId !== null && p.memoId !== "" ? p.memoId : p.memo;
    if (raw !== undefined && raw !== null && raw !== "") {
      const memoStr = String(raw);
      if (!/^\d+$/.test(memoStr)) {
        throw new Error(`SEP-7 MEMO_ID must be a decimal string (uint64), got: ${memoStr}`);
      }
      q.set("memo", memoStr);
      q.set("memo_type", "MEMO_ID");
    }
  } else if (memoType === "MEMO_TEXT") {
    if (p.memo !== undefined && p.memo !== null && p.memo !== "") {
      q.set("memo", p.memo);
      q.set("memo_type", "MEMO_TEXT");
    }
  }

  // The public network is the SEP-7 default, so only a non-default passphrase needs stating.
  const mainnetPassphrase = NETWORK_CONFIGS.mainnet?.passphrase;
  if (p.networkPassphrase && p.networkPassphrase !== mainnetPassphrase) {
    q.set("network_passphrase", p.networkPassphrase);
  }

  return `web+stellar:pay?${q.toString()}`;
}