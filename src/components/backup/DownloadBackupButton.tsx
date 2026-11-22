"use client";

import { errorMessage } from "@/lib/api";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getBackup, loadLocalBackup, parseBackup, serializeBackup, saveLocalBackup, decryptSeed, fromMnemonic } from "@/lib/sdk";
import { downloadBlob } from "@/lib/csv";
import { PasswordPromptModal } from "@/components/backup/PasswordPromptModal";

/** Export the encrypted backup as a .json file, or re-import one into this browser. */
export function DownloadBackupButton({
  token,
  walletId,
  address,
}: {
  token: string;
  walletId: string;
  address: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null);

  // Validate the backup is usable and bound to this wallet: decrypt with the user's password
  // and confirm the derived key matches the wallet address.
  async function confirmImport(password: string) {
    if (!pending) return;
    const mnemonic = await decryptSeed(pending, password);
    const keypair = fromMnemonic(mnemonic).keypair;
    if (address && keypair.publicKey() !== address) {
      throw new Error("This backup does not belong to this wallet.");
    }
    saveLocalBackup(walletId, pending, serializeBackup(pending));
    setPending(null);
    toast.success("Backup imported. Unlock with your wallet password to use it.");
  }

  async function download() {
    setBusy(true);
    try {
      // Always fetch the authoritative server copy; fall back to the local cache only if the
      // request fails, and warn the user that the offline copy may be stale.
      let backup = null;
      let offlineFallback = false;
      try {
        const remote = await getBackup(token, walletId);
        if (!remote.encrypted_backup) throw new Error("No encrypted backup found for this wallet.");
        backup = parseBackup(remote.encrypted_backup);
        // Refresh the local cache with the server-authoritative copy.
        saveLocalBackup(walletId, backup, remote.backup_version ?? remote.encrypted_backup);
      } catch {
        const cached = loadLocalBackup(walletId);
        if (!cached?.backup) throw new Error("Could not reach the server and no local backup is cached.");
        backup = cached.backup;
        offlineFallback = true;
      }
      const exportedAt = new Date().toISOString();
      const file = { wallet_id: walletId, address, exported_at: exportedAt, backup };
      const filename = `octo-backup-${(address ?? walletId).slice(0, 8)}.json`;
      downloadBlob(
        filename,
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
      );
      if (offlineFallback) {
        toast.warning("Offline copy downloaded — may not reflect a recent password change.");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not download the backup."));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      if (parsed?.wallet_id && parsed.wallet_id !== walletId) {
        throw new Error("This backup file belongs to a different wallet.");
      }
      if (parsed?.address && address && parsed.address !== address) {
        throw new Error("This backup file belongs to a different wallet.");
      }
      const blob = parsed?.backup ?? parsed;
      const backup = parseBackup(JSON.stringify(blob));

      // Ask for the password (masked) in a modal; the overwrite question is shown there too.
      setPending(backup);
    } catch (err) {
      toast.error(errorMessage(err, "Could not import the backup file."));
    }
  }

  const btn =
    "rounded-lg border border-border bg-surface-sunken px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-60";
  return (
    <div className="rounded-lg border border-border bg-surface-sunken/50 px-3 py-2 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={download} disabled={busy} className={btn}>
          {busy ? "Preparing…" : "Download encrypted backup"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
          Import backup file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="hidden"
        />
      </div>
      <p className="mt-2">
        The file is encrypted and useless without your wallet password. Keep both safe; we cannot
        recover them for you.
      </p>
      {pending && (
        <PasswordPromptModal
          title="Import backup"
          description={
            (loadLocalBackup(walletId) ? "A local backup already exists for this wallet and will be replaced. " : "") +
            "Enter your wallet password to confirm this backup is yours."
          }
          submitLabel="Import"
          onSubmit={confirmImport}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
