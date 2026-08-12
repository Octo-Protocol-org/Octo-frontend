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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-burgundy-soft/40 p-6 shadow-2xl">
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
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
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
