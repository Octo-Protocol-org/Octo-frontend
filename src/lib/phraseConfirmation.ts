/**
 * Local tracking of whether the user has confirmed their recovery phrase for each wallet.
 *
 * The wallet is created server-side before phrase confirmation, so a tab-close, crash, or
 * "Leave anyway" leaves a live wallet whose owner may never have seen the phrase. This module
 * tracks per-wallet confirmation in localStorage so the UI can warn about unconfirmed wallets.
 *
 * This is a client-side interim signal — a backend `phrase_confirmed_at` flag is preferred for
 * multi-device consistency, but this covers the most common single-device case immediately.
 */

const PREFIX = "octo_phrase_confirmed_";

/** Mark the wallet's recovery phrase as confirmed by the user. */
export function markPhraseConfirmed(walletId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + walletId, "1");
  } catch {
    // localStorage unavailable — silently skip; the warning will show until confirmed.
  }
}

/** Returns true if the user has confirmed the phrase for this wallet in this browser. */
export function isPhraseConfirmed(walletId: string): boolean {
  if (typeof window === "undefined") return true; // SSR: don't warn server-side
  try {
    return localStorage.getItem(PREFIX + walletId) === "1";
  } catch {
    return true; // If storage is unavailable, don't show spurious warnings.
  }
}
