import { BudgetMeter } from "@/components/sponsorship/BudgetMeter";
import { stroopsToXlm } from "@/lib/sponsorship";
import type { SponsorshipConfig } from "@/lib/sponsorship";

interface SponsorshipSummaryProps {
  config: SponsorshipConfig | null;
  className?: string;
}

export function SponsorshipSummary({
  config,
  className,
}: SponsorshipSummaryProps) {
  const perTransactionFeeCapStroops = config?.per_tx_fee_cap_stroops ?? null;
  const spentTodayStroops = config?.spent_today_stroops ?? 0;
  const dailyBudgetStroops = config?.daily_budget_stroops ?? null;

  const isDisabled = !config || config.enabled === false;

  return (
    <div className={className}>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-muted">
          Per-transaction fee cap
        </span>
        <span className="text-sm text-foreground">
          {perTransactionFeeCapStroops === null
            ? "—"
            : stroopsToXlm(perTransactionFeeCapStroops)}
        </span>
      </div>

      <div className="mt-4">
        <BudgetMeter
          spentTodayStroops={spentTodayStroops}
          dailyBudgetStroops={dailyBudgetStroops}
        />
      </div>

      {isDisabled && (
        <p className="mt-4 text-xs text-muted">
          Sponsorship is currently disabled.
        </p>
      )}
    </div>
  );
}

export default SponsorshipSummary;
