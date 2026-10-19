"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, errorMessage } from "@/lib/api";
import { createGasTank } from "@/lib/wallets";
import { getGasTank, type GasTankStatus } from "@/lib/gasTankApi";

const LOW_BALANCE_XLM = 5;

export function GasTankProvision({ token, walletId }: { token: string; walletId: string }) {
  const [status, setStatus] = useState<GasTankStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    getGasTank(token, walletId)
      .then((s) => active && setStatus(s))
      .catch((err) => {
        if (!active) return;
        // Only a 404 means no tank; any other failure must not offer to create one.
        if (err instanceof ApiError && err.status === 404) setStatus(null);
        else setLoadError(errorMessage(err, "Could not load gas tank."));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token, walletId, attempt]);

  async function onCreate() {
    setCreating(true);
    try {
      const res = await createGasTank(token, walletId);
      setStatus({ gas_tank_address: res.gas_tank_address, funded: res.funded });
      toast.success("Gas tank created.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create gas tank."));
    } finally {
      setCreating(false);
    }
  }

  const address = status?.gas_tank_address ?? null;
  const balance = status?.balance_xlm != null ? Number(status.balance_xlm) : NaN;
  const lowBalance = Number.isFinite(balance) && balance < LOW_BALANCE_XLM;

  return (
    <section className="rounded-2xl border border-border bg-burgundy-soft/30 p-5">
      <h2 className="text-sm font-semibold text-foreground">Gas tank</h2>
      <p className="mt-1 text-xs text-muted">
        The gas tank is a server-held account that only holds a float of XLM to pay network fees for
        sponsored transactions. It never holds user funds.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : loadError ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="shrink-0 rounded-lg border border-danger-border px-3 py-1 text-xs font-medium hover:bg-danger-border/20"
          >
            Retry
          </button>
        </div>
      ) : address ? (
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted">Address</p>
            <p className="mt-1 break-all rounded-xl border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-foreground">
              {address}
            </p>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Status</span>
            <span className="text-foreground">{status?.funded ? "Funded" : "Not funded yet"}</span>
          </div>
          {status?.balance_xlm != null && (
            <div className="flex justify-between">
              <span className="text-muted">Balance</span>
              <span className="text-foreground">{status.balance_xlm} XLM</span>
            </div>
          )}
          {lowBalance && (
            <p role="alert" className="rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-xs text-warning">
              Balance is low. Top up soon or sponsorship will stop.
            </p>
          )}
          <p className="text-xs text-muted">
            To top up, send XLM to the address above from any Stellar wallet. Sponsorship stops
            when the tank runs out of XLM.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-muted">No gas tank yet. Create one to enable sponsorship.</p>
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="mt-3 rounded-xl glass-btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create gas tank"}
          </button>
        </div>
      )}
    </section>
  );
}
