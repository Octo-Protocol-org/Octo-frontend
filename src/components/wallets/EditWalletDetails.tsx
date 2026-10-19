"use client";

import { errorMessage } from "@/lib/api";
import { useState } from "react";
import { Modal } from "@/components/dashboard/Modal";
import type { WalletView } from "@/lib/wallets";
import {
  updateWalletDetails,
  MAX_WALLET_LABEL,
  MAX_WALLET_DESCRIPTION,
} from "@/lib/walletDetailsApi";

const INPUT =
  "mt-1 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none";

/** "Edit details" link plus modal to rename a wallet and change its description. */
export function EditWalletDetails({
  token,
  walletId,
  wallet,
  onSaved,
}: {
  token: string | null;
  walletId: string;
  wallet: WalletView | null;
  onSaved: (wallet: WalletView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function show() {
    setLabel(wallet?.label ?? "");
    setDescription(wallet?.description ?? "");
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWalletDetails(token, walletId, { label, description });
      onSaved({ ...(wallet as WalletView), ...updated });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Could not update the wallet."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        disabled={!wallet}
        className="mt-1 text-xs text-burgundy-bright hover:underline disabled:opacity-50"
      >
        Edit name and description
      </button>
      {open && (
        <Modal title="Edit wallet details" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="text-xs text-muted">Wallet name</label>
              <input
                value={label}
                maxLength={MAX_WALLET_LABEL}
                onChange={(e) => setLabel(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Wallet description</label>
              <textarea
                value={description}
                maxLength={MAX_WALLET_DESCRIPTION}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
                className={`${INPUT} resize-none`}
              />
            </div>
            {error && (
              <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-bright disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
