/** Display helpers that more than one page or component needs. */

/** Public checkout URL for a payment link slug. Falls back to a path during SSR. */
export function payUrl(slug: string): string {
  if (typeof window === "undefined") return `/pay/${slug}`;
  return `${window.location.origin}/pay/${slug}`;
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
