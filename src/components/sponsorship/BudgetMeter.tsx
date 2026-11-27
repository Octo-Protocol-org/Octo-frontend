"use client";

import { sumStroops } from "@/lib/amount";
import { stroopsToXlm } from "@/lib/sponsorship";
import type { Stroops } from "@/lib/brands";

export type BudgetMeterProps = {
  /** Fees already reserved/spent today, in stroops (string or number). */
  spentTodayStroops: Stroops | number;
  /** Daily budget in stroops (string or number), or null when unset. */
  dailyBudgetStroops: Stroops | number | null;
  /** Optional extra classes for the wrapper. */
  className?: string;
};

/** Renders the daily budget progress bar shared by both sponsorship pages. */
export function BudgetMeter({ spentTodayStroops, dailyBudgetStroops, className }: BudgetMeterProps) {
  const spentBig = sumStroops([spentTodayStroops]);
  const budgetBig = dailyBudgetStroops != null ? sumStroops([dailyBudgetStroops]) : null;

  const hasBudget = budgetBig != null && budgetBig > BigInt(0);
  const ratio = hasBudget
    ? Math.min(1, Math.max(0, Number(spentBig) / Number(budgetBig)))
    : 0;
  const remainingBig = hasBudget
    ? (budgetBig! > spentBig ? budgetBig! - spentBig : BigInt(0))
    : BigInt(0);
  const exhausted = hasBudget && remainingBig === BigInt(0);

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-[11px] text-muted">Daily budget</span>
        <span className="text-foreground">
          {hasBudget ? stroopsToXlm(dailyBudgetStroops!) : "—"}
        </span>
      </div>
      {hasBudget && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
            <div
              className={`h-full rounded-full ${exhausted ? "bg-danger" : "bg-burgundy"}`}
              style={{ width: `${ratio * 100}%`}}
            />
          </div>
          <div className="flex items-baseline justify-between gap-3 text-[11px] text-muted">
            <span>{stroopsToXlm(spentTodayStroops)} spent</span>
            <span>{stroopsToXlm(remainingBig)} remaining</span>
          </div>
        </>
      )}
    </div>
  );
}
