/** Display helpers that more than one page or component needs. */

/** Public checkout URL for a payment link slug, or null for an empty or dot-segment slug. Falls back to a path during SSR. */
export function payUrl(slug: string): string | null {
  if (!slug || slug === "." || slug === "..") return null;
  // Encode the slug so `/`, `?` or `#` can't point the link (or its QR code) at another page.
  const pathname = `/pay/${encodeURIComponent(slug)}`;
  if (typeof window === "undefined") return pathname;
  return `${window.location.origin}${pathname}`;
}

/** Shareable URL for a payment link: the server's URL if it is http(s), else the checkout URL built from the slug. */
export function paymentLinkUrl(link: { url?: string | null; slug: string }): string {
  if (link.url) {
    try {
      const parsed = new URL(link.url);
      // Never hand a `javascript:` or other scheme to a QR code or a merchant's embed snippet.
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
    } catch {
      // Not a URL at all; fall back to the slug.
    }
  }
  return payUrl(link.slug) ?? "";
}

/** Countdown from milliseconds. Shows hours only when there are any. */
export function formatCountdownMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Countdown from seconds as minutes and seconds. */
export function formatCountdownSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Shorten a transaction hash to `ABCD…WXYZ` for display. */
export function shortenTxHash(hash: string): string {
  const trimmed = hash.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}