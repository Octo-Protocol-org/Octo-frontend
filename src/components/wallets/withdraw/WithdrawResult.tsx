"use client";

import { explorerTxUrl } from "@/lib/network";
import { friendlyResultMessage } from "@/lib/stellar/resultCodes";
import type { SubmitResult } from "@/lib/sdk";

interface WithdrawResultProps {
  result: SubmitResult;
  onDone: () => void;
}

/** Final step: success or failure screen after the withdrawal has been submitted. */
export function WithdrawResult({ result, onDone }: WithdrawResultProps) {
  const ok = result.status === "confirmed";

  return (
    <div className="text-center" role="status">
      <p className={`text-3xl ${ok ? "text-burgundy-bright" : "text-warning"}`}>
        <span aria-hidden="true">{ok ? "✓" : "!"}</span>
        <span className="sr-only">{ok ? "Success" : "Failed"}</span>
      </p>
      <p className="mt-2 font-medium capitalize text-foreground">{result.status}</p>
      {!ok && (
        <p className="mt-1 text-sm text-muted">
          {friendlyResultMessage(
            result.detail,
            "The withdrawal could not be completed.",
          )}
        </p>
      )}
      {result.stellar_tx_hash && (
        <a
          href={explorerTxUrl(result.stellar_tx_hash) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          title="View transaction on Stellar Explorer"
          className="mt-2 block break-all font-mono text-xs text-burgundy-bright underline decoration-burgundy-bright/40 underline-offset-2 transition-colors hover:decoration-burgundy-bright"
        >
          {result.stellar_tx_hash}
        </a>
      )}
      <button
        onClick={onDone}
        className="mt-6 w-full rounded-lg glass-btn-primary py-2.5 text-sm font-semibold"
      >
        Done
      </button>
    </div>
  );
}
