'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import WalletPageShell from '@/components/dashboard/WalletPageShell';
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  rotateWebhookSecret,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  type WebhookEndpoint,
  type WebhookDelivery,
} from '@/lib/api';

type LoadState = 'idle' | 'loading' | 'error' | 'ready';

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 4)}${'•'.repeat(Math.max(8, secret.length - 8))}${secret.slice(-4)}`;
}

function formatDate(value: string | number | undefined): string {
  if (value === undefined || value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SecretReveal({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">
        Save this signing secret now. It will not be shown again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs text-gray-900">
          {revealed ? secret : maskSecret(secret)}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((prev) => !prev)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <CopyButton value={secret} />
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 text-xs font-medium text-amber-900 underline"
      >
        I have saved it
      </button>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WalletWebhooksPage() {
  const params = useParams<{ id: string }>();
  const walletId = params?.id;

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newUrl, setNewUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<WebhookEndpoint | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);

  const loadEndpoints = useCallback(async () => {
    if (!walletId) return;
    setLoadState('loading');
    setLoadError(null);
    try {
      const result = await listWebhookEndpoints(walletId);
      setEndpoints(result);
      setLoadState('ready');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load webhook endpoints');
      setLoadState('error');
    }
  }, [walletId]);

  useEffect(() => {
    void loadEndpoints();
  }, [loadEndpoints]);

  const loadDeliveries = useCallback(
    async (endpointId: string) => {
      if (!walletId) return;
      setDeliveriesError(null);
      try {
        const result = await listWebhookDeliveries(walletId, endpointId);
        setDeliveries((prev) => ({ ...prev, [endpointId]: result }));
      } catch {
        setDeliveriesError('Recent deliveries are not available for this endpoint.');
      }
    },
    [walletId],
  );

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!walletId) return;
      const trimmed = newUrl.trim();
      if (!isValidHttpsUrl(trimmed)) {
        setCreateError('Enter a valid https:// URL.');
        return;
      }
      setCreating(true);
      setCreateError(null);
      setNewSecret(null);
      try {
        const created = await createWebhookEndpoint(walletId, trimmed);
        setEndpoints((prev) => [...prev, created.endpoint]);
        setNewSecret(created.secret);
        setNewUrl('');
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create endpoint');
      } finally {
        setCreating(false);
      }
    },
    [walletId, newUrl],
  );

  const handleRotate = useCallback(
    async (endpoint: WebhookEndpoint) => {
      if (!walletId) return;
      setRotatingId(endpoint.id);
      setRotateError(null);
      setNewSecret(null);
      try {
        const rotated = await rotateWebhookSecret(walletId, endpoint.id);
        setNewSecret(rotated.secret);
      } catch (err) {
        setRotateError(err instanceof Error ? err.message : 'Failed to rotate secret');
      } finally {
        setRotatingId(null);
      }
    },
    [walletId],
  );

  const handleDelete = useCallback(async () => {
    if (!walletId || !pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteWebhookEndpoint(walletId, pendingDelete.id);
      setEndpoints((prev) => prev.filter((e) => e.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete endpoint');
    } finally {
      setDeleting(false);
    }
  }, [walletId, pendingDelete]);

  const sortedEndpoints = useMemo(
    () => [...endpoints].sort((a, b) => a.url.localeCompare(b.url)),
    [endpoints],
  );

  return (
    <WalletPageShell walletId={walletId} title="Webhooks">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Webhook endpoints</h2>
            <p className="mt-1 text-sm text-gray-600">
              Receive signed event notifications. Only https:// URLs are accepted.
            </p>
          </div>
          <Link
            href={`/dashboard/wallets/${walletId}/api`}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            API settings
          </Link>
        </div>

        {newSecret && (
          <SecretReveal secret={newSecret} onDismiss={() => setNewSecret(null)} />
        )}

        <form onSubmit={handleCreate} className="rounded-lg border border-gray-200 bg-white p-4">
          <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-900">
            Add endpoint
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="webhook-url"
              type="url"
              inputMode="url"
              placeholder="https://example.com/webhooks/octo"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={creating || !newUrl.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add endpoint'}
            </button>
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
        </form>

        {rotateError && <p className="text-sm text-red-600">{rotateError}</p>}
        {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

        {loadState === 'loading' && <p className="text-sm text-gray-600">Loading endpoints…</p>}
        {loadState === 'error' && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadEndpoints()}
              className="mt-2 text-sm font-medium text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {loadState === 'ready' && sortedEndpoints.length === 0 && (
          <p className="text-sm text-gray-600">No webhook endpoints yet.</p>
        )}

        {sortedEndpoints.length > 0 && (
          <ul className="space-y-3">
            {sortedEndpoints.map((endpoint) => {
              const endpointDeliveries = deliveries[endpoint.id];
              return (
                <li
                  key={endpoint.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <code className="break-all font-mono text-sm text-gray-900">
                        {endpoint.url}
                      </code>
                      <p className="mt-1 text-xs text-gray-500">
                        Created {formatDate(endpoint.createdAt)}
                        {endpoint.status ? ` · ${endpoint.status}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRotate(endpoint)}
                        disabled={rotatingId === endpoint.id}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {rotatingId === endpoint.id ? 'Rotating…' : 'Rotate secret'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(endpoint)}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Recent deliveries</span>
                      <button
                        type="button"
                        onClick={() => void loadDeliveries(endpoint.id)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Load
                      </button>
                    </div>
                    {deliveriesError && (
                      <p className="mt-1 text-xs text-gray-500">{deliveriesError}</p>
                    )}
                    {endpointDeliveries && endpointDeliveries.length === 0 && (
                      <p className="mt-1 text-xs text-gray-500">No recent deliveries.</p>
                    )}
                    {endpointDeliveries && endpointDeliveries.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {endpointDeliveries.slice(0, 5).map((delivery) => (
                          <li
                            key={delivery.id}
                            className="flex items-center justify-between text-xs text-gray-600"
                          >
                            <span>
                              {delivery.event ?? 'event'} · {formatDate(delivery.createdAt)}
                            </span>
                            <span
                              className={
                                delivery.status && /fail|error/i.test(delivery.status)
                                  ? 'font-medium text-red-600'
                                  : 'font-medium text-green-600'
                              }
                            >
                              {delivery.status ?? 'unknown'}
                              {typeof delivery.statusCode === 'number'
                                ? ` (${delivery.statusCode})`
                                : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete webhook endpoint"
          description={`Stop sending events to ${pendingDelete.url}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void handleDelete()}
          onCancel={() => setPendingDelete(null)}
          busy={deleting}
        />
      )}
    </WalletPageShell>
  );
}
</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>