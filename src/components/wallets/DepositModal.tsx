"use client";

import { Modal, CopyField } from "@/components/dashboard/Modal";
import { DepositQrCodes } from "@/components/qr/DepositQrCodes";
import type { Address } from "@/lib/wallets";

export function DepositModal({
  addresses,
  baseAddress,
  onClose,
  onNewAddress,
  creating,
}: {
  addresses: Address[];
  baseAddress: string;
  onClose: () => void;
  onNewAddress: () => void;
  creating: boolean;
}) {
  const latest = addresses[0];
  return (
    <Modal title="Deposit" onClose={onClose}>
      <p className="text-sm text-muted">
        Share a deposit address with the sender. Funds sent to it land directly in this master
        wallet and are attributed to the customer.
      </p>

      {latest ? (
        <div className="mt-5 space-y-4">
          <CopyField label="Muxed address (recommended)" value={latest.muxed_address} />
          <CopyField label="Base address (G…+memo fallback)" value={baseAddress} />
          <div className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-muted">
            If the sender can&apos;t use the{" "}
            <code className="text-foreground">M…</code> address, send to the base address with
            memo (id) <span className="text-foreground">{latest.memo_id}</span>.
          </div>
          <DepositQrCodes
            muxedAddress={latest.muxed_address}
            baseAddress={baseAddress}
            memoId={latest.memo_id}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted">
          No addresses yet. Generate one to receive a deposit.
          <button
            onClick={onNewAddress}
            disabled={creating}
            className="mt-3 block w-full rounded-lg glass-btn-primary py-2 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Generating…" : "Generate address"}
          </button>
        </div>
      )}
    </Modal>
  );
}
