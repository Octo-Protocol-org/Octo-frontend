"use client";

import { useRef, useState } from "react";
import { AuthUnderwater } from "@/components/auth/AuthUnderwater";

/**
 * The auth page's "live wallet" scene: a small wallet dashboard card the
 * octopuses drop coins into, backed by the full-screen underwater animation.
 */

const STARTING_BALANCE = 521_346.93;

function formatUSD(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AuthWalletScene() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [deposits, setDeposits] = useState(0);
  const [flash, setFlash] = useState(false);

  function handleDeposit() {
    // Each octopus banks a randomised deposit; balance climbs live.
    const amount = 50 + Math.random() * 950;
    setBalance((b) => b + amount);
    setDeposits((d) => d + 1);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 600);
  }

  return (
    <>
      {/* Full-screen underwater animation (fixed → covers the viewport). */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <AuthUnderwater targetRef={cardRef} onDeposit={handleDeposit} />
      </div>

      {/* The live wallet dashboard card. */}
      <div
        ref={cardRef}
        className="glass-strong relative mx-auto w-full max-w-sm rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted">
              octo ▾
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-burgundy-bright" />
              Stellar · Testnet
            </span>
          </div>
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
              flash
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/5 text-muted"
            }`}
          >
            {flash ? "+ secured" : "live"}
          </span>
        </div>

        <div className="mt-4">
          <p className="text-[11px] text-muted">Cumulative Balance</p>
          <p
            className={`mt-1 font-mono text-3xl font-semibold tabular-nums transition-colors duration-300 ${
              flash ? "text-emerald-300" : "text-foreground"
            }`}
          >
            {formatUSD(balance)}
          </p>
          <p className="mt-1 text-[11px] text-burgundy-bright">
            {deposits} deposit{deposits === 1 ? "" : "s"} secured this session
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] text-muted">Unswept</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {formatUSD(2208.78)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] text-muted">Master Wallets</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">6</p>
          </div>
        </div>
      </div>
    </>
  );
}
