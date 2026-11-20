"use client";

import { useEffect, useState } from "react";
import { getSigningInfo, type SigningInfo } from "@/lib/sdk";
import { formatStroops, parseAmount } from "@/lib/amount";
import {
  minimumBalanceStroops,
  spendableNativeStroops,
  reserveIsExact,
} from "@/lib/stellar/reserve";
import type { Balance } from "@/lib/wallets";

/** Total, reserved and spendable XLM, with the reserve inputs read from the API when available. */
export function SpendableReservedBreakdown({
  token,
  walletId,
  balances,
}: {
  token: string | null;
  walletId: string;
  balances: Balance[];
}) {
  const [info, setInfo] = useState<SigningInfo | null>(null);

  useEffect(() => {
    if (!token) return;
    getSigningInfo(token, walletId).then(setInfo).catch(() => setInfo(null));
  }, [token, walletId]);

  const xlm = balances.find((b) => b.asset_type === "native");
  const parsed = parseAmount(xlm?.balance ?? "0");
  const total = parsed.ok ? parsed.stroops : BigInt(0);
  // Fall back to counting non-native trustlines when the API omits the subentry count.
  const trustlines = balances.filter((b) => b.asset_type !== "native").length;
  const reserved = minimumBalanceStroops(info, trustlines);
  const spendable = spendableNativeStroops(total, info, trustlines);
  const tip =
    "Stellar locks a minimum balance of (2 + subentries) x base reserve (each trustline is a subentry), plus one transaction fee. Only the remainder can be withdrawn.";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" title={tip}>
      <Cell label="Total XLM" value={formatStroops(total)} />
      <Cell label="Reserved XLM" value={formatStroops(reserved)} sub="Minimum balance, locked" />
      <Cell
        label="Spendable XLM"
        value={formatStroops(spendable)}
        sub={reserveIsExact(info) ? "Available to withdraw" : "Estimate (reserve data unavailable)"}
      />
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-burgundy-soft/30 p-4">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value} XLM</p>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
