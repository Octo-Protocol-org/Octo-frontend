'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'expired'
  | 'failed'
  | 'mismatch'
  | string;

export interface PaymentStatusResult {
  status: PaymentStatus;
  [key: string]: unknown;
}

export interface UsePaymentStatusPollingOptions {
  /** When true, polling is paused (e.g. tab hidden or intent not yet created). */
  paused?: boolean;
  /** Base delay in ms for the first retry. Defaults to 2000. */
  baseDelayMs?: number;
  /** Maximum delay in ms between polls. Defaults to 30000. */
  maxDelayMs?: number;
  /** Called exactly once when the status first becomes "confirmed". */
  onConfirmed?: (result: PaymentStatusResult) => void;
  /** Called on every successful poll with the latest result. */
  onStatus?: (result: PaymentStatusResult) => void;
  /** Called when a poll request fails. */
  onError?: (error: unknown) => void;
}

export interface UsePaymentStatusPollingResult {
  status: PaymentStatus | null;
  result: PaymentStatusResult | null;
  error: unknown;
  /** True while a request is in flight. */
  isPolling: boolean;
  /** True once the status has been confirmed (fires exactly once). */
  confirmed: boolean;
  /** Manually trigger a poll immediately. */
  refresh: () => void;
}

const TERMINAL_STATUSES = new Set<PaymentStatus>([
  'confirmed',
  'expired',
  'failed',
  'mismatch',
]);

function isTerminal(status: PaymentStatus | null): boolean {
  return status !== null && TERMINAL_STATUSES.has(status);
}

/**
 * Polls the payment status endpoint for a given slug/intent with exponential
 * backoff and visibility handling.
 *
 * - Backs off exponentially from `baseDelayMs` up to `maxDelayMs` on errors.
 * - Resets backoff on a successful poll.
 * - Pauses while the document is hidden and resumes (with an immediate poll)
 *   when it becomes visible again.
 * - Stops polling once a terminal status is reached.
 * - Guarantees `onConfirmed` fires exactly once via a ref guard.
 */
export function usePaymentStatusPolling(
  slug: string | null | undefined,
  intentId: string | null | undefined,
  options: UsePaymentStatusPollingOptions = {},
): UsePaymentStatusPollingResult {
  const {
    paused = false,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    onConfirmed,
    onStatus,
    onError,
  } = options;

  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [result, setResult] = useState<PaymentStatusResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Confirmation must fire exactly once, regardless of re-renders or
  // duplicate responses. This ref is the single source of truth for that.
  const confirmedRef = useRef(false);

  // Keep latest callbacks in refs so the polling effect does not need to
  // restart when the caller passes new inline functions.
  const onConfirmedRef = useRef(onConfirmed);
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
  }, [onConfirmed]);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Reset confirmation guard when the intent identity changes.
  useEffect(() => {
    confirmedRef.current = false;
    setConfirmed(false);
    setStatus(null);
    setResult(null);
    setError(null);
  }, [slug, intentId]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(baseDelayMs);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!slug || !intentId) return;
    if (inFlightRef.current) return;
    if (cancelledRef.current) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    inFlightRef.current = true;
    setIsPolling(true);

    try {
      const params = new URLSearchParams({ intent: intentId });
      const res = await fetch(
        `/api/pay/${encodeURIComponent(slug)}/status?${params.toString()}`,
        { method: 'GET', headers: { Accept: 'application/json' } },
      );

      if (cancelledRef.current) return;

      if (!res.ok) {
        throw new Error(`Status request failed with ${res.status}`);
      }

      const data = (await res.json()) as PaymentStatusResult;
      if (cancelledRef.current) return;

      const nextStatus = data.status;
      setResult(data);
      setStatus(nextStatus);
      setError(null);
      delayRef.current = baseDelayMs;

      onStatusRef.current?.(data);

      if (nextStatus === 'confirmed' && !confirmedRef.current) {
        confirmedRef.current = true;
        setConfirmed(true);
        onConfirmedRef.current?.(data);
      }

      if (isTerminal(nextStatus)) {
        clearTimer();
        return;
      }

      // Schedule the next poll.
      clearTimer();
      timerRef.current = setTimeout(() => {
        void poll();
      }, delayRef.current);
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err);
      onErrorRef.current?.(err);

      // Exponential backoff on error.
      delayRef.current = Math.min(delayRef.current * 2, maxDelayMs);
      clearTimer();
      timerRef.current = setTimeout(() => {
        void poll();
      }, delayRef.current);
    } finally {
      inFlightRef.current = false;
      if (!cancelledRef.current) {
        setIsPolling(false);
      }
    }
  }, [slug, intentId, baseDelayMs, maxDelayMs, clearTimer]);

  refreshRef.current = () => {
    clearTimer();
    delayRef.current = baseDelayMs;
    void poll();
  };

  const refresh = useCallback(() => {
    refreshRef.current();
  }, []);

  // Main polling lifecycle.
  useEffect(() => {
    cancelledRef.current = false;

    if (paused || !slug || !intentId) {
      clearTimer();
      return () => {
        clearTimer();
      };
    }

    // Don't poll if already terminal.
    if (isTerminal(status)) {
      return () => {
        clearTimer();
      };
    }

    delayRef.current = baseDelayMs;
    void poll();

    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
    // Intentionally exclude `status` so reaching a terminal status does not
    // tear down and restart the effect; the poll loop handles termination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, intentId, paused, poll, clearTimer, baseDelayMs]);

  // Visibility handling: pause when hidden, resume immediately when visible.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimer();
      } else if (!paused && slug && intentId && !isTerminal(status)) {
        clearTimer();
        delayRef.current = baseDelayMs;
        void poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [paused, slug, intentId, status, poll, clearTimer, baseDelayMs]);

  return { status, result, error, isPolling, confirmed, refresh };
}

export default usePaymentStatusPolling;