"use client";

import { QRCodeSVG } from "qrcode.react";

/** Scannable QR for an address or SEP-7 URI; stays white in both themes so it scans reliably. */
export function AddressQrCode({
  value,
  label,
  size = 176,
}: {
  value: string;
  label?: string;
  size?: number;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="rounded-xl bg-white p-3">
        <QRCodeSVG value={value} size={size} bgColor="#ffffff" fgColor="#000000" />
      </div>
      {label && <figcaption className="text-center text-xs text-muted">{label}</figcaption>}
    </figure>
  );
}
