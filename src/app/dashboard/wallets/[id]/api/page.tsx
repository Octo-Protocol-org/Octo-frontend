"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@/lib/useWallet";
import {
  getApiKey,
  generateApiKey,
  type ApiKeyInfo,
} from "@/lib/wallets";
import { PageSpinner } from "@/components/OctoSpinner";
import { CopyButton } from "@/components/CopyButton";
import { Modal } from "@/components/dashboard/Modal";
import { ApiError, API_URL } from "@/lib/api";
import { Code } from "@/components/docs/DocsUI";
import { toast } from "sonner";

import { WalletPageShell } from "@/components/dashboard/WalletPageShell";
export const dynamic = "force-dynamic";

export default function DevelopersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, token, loading } = useAuth();

  const { wallet } = useWallet(id);
  const [keyInfo, setKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [fullKey, setFullKey] = useState<string | null>(null); // shown once after generate
  const [revealed, setRevealed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [keyLoadFailed, setKeyLoadFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getApiKey(token, id, { signal: controller.signal })
      .then(setKeyInfo)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setKeyLoadFailed(true);
      });
    return () => controller.abort();
  }, [token, id]);

  // Until key status is known we can't tell "generate" from "regenerate", so block the action.
  function onGenerateClick() {
    if (!keyInfo || generating) return;
    if (keyInfo.configured) setConfirmingRegen(true);
    else void generate();
  }

  async function generate() {
    if (!token) return;
    setConfirmingRegen(false);
    setGenerating(true);
    try {
      const res = await generateApiKey(token, id);
      setFullKey(res.api_key);
      setRevealed(false);
      setKeyInfo({ wallet_id: id, configured: true, prefix: res.prefix });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to generate API key.",
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  // What to display in the API key row.
  const keyDisplay = fullKey
    ? revealed
      ? fullKey
      : maskFrom(fullKey)
    : keyInfo?.configured
      ? `${keyInfo.prefix}${"•".repeat(28)}`
      : "Not generated";

  return (
    <>
    <WalletPageShell
      walletId={id}
      walletName={wallet?.label ?? "Master wallet"}
      section="Developers"
    >

            <div className="mx-auto max-w-4xl">
              {/* title + actions */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-xl font-semibold text-foreground">
                  API Configurations
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBtn
                    label={generating ? "Generating…" : keyInfo?.configured ? "Regenerate API Key" : "Generate API Key"}
                    onClick={onGenerateClick}
                    disabled={!keyInfo || generating}
                    primary
                  />
                  <span className="flex items-center gap-2 text-sm text-muted">
                    Status{" "}
                    <span className="text-burgundy-bright">
                      {keyInfo?.configured ? "● Active" : "● Inactive"}
                    </span>
                  </span>
                </div>
              </div>

              {keyLoadFailed && (
                <div role="alert" className="mt-6 rounded-xl border border-burgundy/40 bg-burgundy/10 p-4 text-sm text-burgundy-bright">
                  Couldn&apos;t load this wallet&apos;s API key status. Refresh the page to
                  try again.
                </div>
              )}

              {/* one-time key banner */}
              {fullKey && (
                <div className="mt-6 rounded-xl border border-burgundy/40 bg-burgundy/10 p-4 text-sm text-burgundy-bright">
                  <p>
                    This is your API key — copy it now. It won&apos;t be shown
                    again. Store it securely and never commit it to source
                    control.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFullKey(null);
                      setRevealed(false);
                    }}
                    className="mt-3 rounded-lg border border-burgundy/40 px-3 py-1.5 text-xs font-medium hover:bg-burgundy/10"
                  >
                    I&apos;ve saved the key
                  </button>
                </div>
              )}

              {/* info note */}
              <div className="mt-6 rounded-xl border border-border bg-surface-raised p-4 text-sm text-muted">
                Use the <strong className="text-foreground">Wallet ID</strong>{" "}
                and{" "}
                <strong className="text-foreground">API Key</strong> below to
                authenticate requests to the Octo API for this wallet.
              </div>

              {/* rows */}
              <div className="mt-6 space-y-3">
                <Row label="Wallet ID">
                  <CopyValue value={id} mono />
                </Row>

                <Row label="API Key">
                  <div className="flex items-center gap-3">
                    <span className="max-w-md truncate font-mono text-sm text-foreground">
                      {keyDisplay}
                    </span>
                    {fullKey && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRevealed((v) => !v)}
                          className="text-muted hover:text-foreground"
                          title={revealed ? "Hide" : "Reveal"}
                          aria-label={revealed ? "Hide API key" : "Reveal API key"}
                        >
                          {revealed ? "🙈" : "👁"}
                        </button>
                        <CopyButton value={fullKey} />
                      </>
                    )}
                  </div>
                </Row>

              </div>

              {/* quickstart */}
              {keyInfo?.configured && (
                <div className="mt-3">
                  <Code label="Quickstart — generate a deposit address">{`curl -X POST \\
  ${API_URL}/v1/wallets/${id}/addresses \\
  -H "authorization: Bearer <YOUR_API_KEY>" \\
  -H "content-type: application/json" \\
  -d '{"customer_ref":"user_123"}'`}</Code>
                </div>
              )}
            </div>

    </WalletPageShell>

      {confirmingRegen && (
        <RegenerateKeyModal
          walletName={wallet?.label?.trim() || "regenerate"}
          onConfirm={generate}
          onClose={() => setConfirmingRegen(false)}
        />
      )}
  </>
  );
}

/** Regenerating kills the live key instantly, so the user must type the wallet name to proceed. */
function RegenerateKeyModal({
  walletName,
  onConfirm,
  onClose,
}: {
  walletName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === walletName;

  return (
    <Modal title="Regenerate API key?" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (matches) onConfirm();
        }}
      >
        <div className="space-y-2 text-sm text-muted">
          <p>
            The current key for <strong className="text-foreground">{walletName}</strong>{" "}
            stops working <strong className="text-foreground">immediately</strong>. Every
            integration using it will fail until you deploy the new key.
          </p>
          <p>This can&apos;t be undone, and the new key is shown only once.</p>
        </div>
        <label
          htmlFor="regen-confirm"
          className="mt-5 block text-sm font-medium text-foreground"
        >
          Type <span className="font-mono text-burgundy-bright">{walletName}</span> to
          confirm
        </label>
        <input
          id="regen-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground focus:border-burgundy-bright focus:outline-none"
        />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-sunken"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!matches}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Regenerate key
          </button>
        </div>
      </form>
    </Modal>
  );
}

function maskFrom(key: string) {
  const prefix = key.split("_").slice(0, 3).join("_") + "_";
  return prefix + "•".repeat(Math.max(0, key.length - prefix.length));
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

function CopyValue({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
      <CopyButton value={value} />
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`disabled:cursor-not-allowed disabled:opacity-60 ${
        primary
          ? "rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-foreground hover:bg-burgundy-bright"
          : "rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
