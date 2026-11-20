"use client";

import { useState } from "react";
import { sep7PayUri } from "@/lib/sep7";
import { useNetwork } from "@/lib/network";
import { AddressQrCode } from "./AddressQrCode";

/** Toggle between a QR for the muxed address and one for the base address + memo. */
export function DepositQrCodes({
  muxedAddress,
  baseAddress,
  memoId,
}: {
  muxedAddress: string;
  baseAddress: string;
  memoId: number | string;
}) {
  const network = useNetwork();
  const [mode, setMode] = useState<"muxed" | "base">("muxed");
  const tab = (m: "muxed" | "base", text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`rounded-md px-3 py-1 text-xs font-medium ${
        mode === m ? "bg-burgundy-bright/20 text-burgundy-bright" : "text-muted"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2">
        {tab("muxed", "Muxed QR")}
        {tab("base", "Base + memo QR")}
      </div>
      {mode === "muxed" ? (
        <AddressQrCode
          value={sep7PayUri({
            destination: muxedAddress,
            networkPassphrase: network.passphrase,
          })}
          label="Scan to send to the muxed address"
        />
      ) : (
        <AddressQrCode
          value={sep7PayUri({
            destination: baseAddress,
            memoId,
            networkPassphrase: network.passphrase,
          })}
          label={`Scan to send to the base address with memo ${memoId}`}
        />
      )}
    </div>
  );
}