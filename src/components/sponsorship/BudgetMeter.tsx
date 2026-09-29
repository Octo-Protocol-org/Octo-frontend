"use client";

import { stroopsToXlm } from "@/lib/sponsorship";

export type BudgetMeterProps = {
  /** Fees already reserved/spent today, in stroops. */
  spentTodayStroops: number;
  /** Daily budget in stroops, or null when unset. */
  dailyBudgetStroops: number | null;
  /** Optional extra classes for the wrapper. */
  className?: string;
};

/** Renders the daily budget progress bar shared by both sponsorship pages. */
export function BudgetMeter({ spentTodayStroops, dailyBudgetStroops, className }: BudgetMeterProps) {
  const hasBudget = dailyBudgetStroops != null && dailyBudgetStroops > 0;
  const ratio = hasBudget
    ? Math.min(1, Math.max(0, spentTodayStroops / dailyBudgetStroops))
    : 0;
  const remainingStroops = hasBudget
    ? Math.max(0, dailyBudgetStroops - spentTodayStroops)
    : 0;
  const exhausted = hasBudget && remainingStroops === 0;

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-[11px] text-muted">Daily budget</span>
        <span className="text-foreground">
          {hasBudget ? stroopsToXlm(dailyBudgetStroops) : "—"}
        </span>
      </div>
      {hasBudget && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
            <div
              className={`w-full rounded-full ${exhausted ? "bg-danger" : "bg-burgundy"}`}
              style={{ width: `${ratio * 100}%`}}
            />
          </div>
          <div className="flex items-baseline justify-between gap-3 text-[11px] text-muted">
            <span>{stroopsToXlm(spentTodayStroops)} spent</span>
            <span>{stroopsToXlm(remainingStroops)} remaining</span>
          </div>
        </>
      )
    </div>
  );
}
