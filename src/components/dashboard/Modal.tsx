"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/components/CopyButton";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-burgundy-soft/40 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/** Confirmation dialog for destructive or risky actions — a deliberate second step
 * instead of window.confirm, so the risk can be explained in-context. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm text-muted">{message}</div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={
            destructive
              ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              : "rounded-lg bg-burgundy-bright px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** `qr` shows a "Scan QR" trigger that pops up a scannable code for `value` — opt in per
 * field, since most CopyField uses (tx hashes, issuers) aren't meant to be scanned. */
export function CopyField({
  label,
  value,
  qr = false,
}: {
  label: string;
  value: string;
  qr?: boolean;
}) {
  const [showQr, setShowQr] = useState(false);

  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2">
        {qr && (
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="shrink-0 text-xs font-medium text-burgundy-bright hover:underline"
          >
            Scan QR
          </button>
        )}
        <span className="flex-1 truncate font-mono text-xs text-foreground">
          {value}
        </span>
        <CopyButton value={value} />
      </div>

      {showQr && (
        <Modal title="Scan to pay" onClose={() => setShowQr(false)}>
          <div className="flex flex-col items-center gap-4">
            {/* Stays white in both themes — QR codes need a light quiet zone to scan reliably. */}
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={value} size={220} />
            </div>
            <p className="max-w-xs text-center text-xs text-muted">
              Scan with a phone camera to open this payment link.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Renders a full, untruncated address with its first and last characters highlighted so a
 * user can eyeball the ends against clipboard-hijacking malware before signing. */
export function HighlightedAddress({ address }: { address: string }) {
  if (address.length <= 2) {
    return <span className="font-mono text-xs text-foreground">{address}</span>;
  }

  return (
    <span className="break-all font-mono text-xs text-foreground">
      <span className="rounded bg-burgundy-bright/20 px-0.5 font-semibold text-burgundy-bright">
        {address.slice(0, 1)}
      </span>
      {address.slice(1, -1)}
      <span className="rounded bg-burgundy-bright/20 px-0.5 font-semibold text-burgundy-bright">
        {address.slice(-1)}
      </span>
    </span>
  );
}
