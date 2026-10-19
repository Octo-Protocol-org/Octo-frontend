"use client";

import { useState } from "react";
import { Modal } from "@/components/dashboard/Modal";

/** Max customer reference length (assumed to match the backend limit). */
export const MAX_CUSTOMER_REF_LENGTH = 64;

/** Asks for an optional customer reference before an address is generated. */
/** Asks for an optional customer reference before an address is generated. */
export function NewAddressModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (customerRef?: string) => void;
  onClose: () => void;
}) {
  const [ref, setRef] = useState("");

  return (
    <Modal title="New address" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(ref.trim() || undefined);
          onClose();
        }}
      >
        <div>
          <label className="text-xs text-muted">Customer reference (optional)</label>
          <input
            autoFocus
            value={ref}
            maxLength={MAX_CUSTOMER_REF_LENGTH}
            onChange={(e) => setRef(e.target.value)}
            placeholder="e.g. customer-1042"
            className="mt-1 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-muted">
            Deposits to this address are attributed to this reference.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-bright"
        >
          Generate address
        </button>
      </form>
    </Modal>
  );
}
