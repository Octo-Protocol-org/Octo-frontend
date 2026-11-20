/** Theme tokens shared by the pre-paint script, the provider, and the toggle. */

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "octo_theme";

/** Dark is Octo's default, so an unreadable or absent preference falls back to it. */
export const DEFAULT_THEME: Theme = "dark";

/**
 * Stamps `data-theme` on <html> before first paint so no page ever flashes the wrong theme.
 *
 * This must run as a blocking inline script in <head>, which the strict CSP on
 * /dashboard/wallets/* would otherwise block. It is allowlisted by its SHA-256 hash in
 * `src/proxy.ts`; the root layout never reads a nonce, so every route stays statically
 * prerendered.
 *
 * Any edit here changes that hash. `theme.test.ts` recomputes it and fails if the two drift.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}")}})();`;

/** Reads the stored override, or null when the user has never chosen and should follow the OS. */
export function storedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const t = window.localStorage.getItem(THEME_STORAGE_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** The OS preference, used until the user picks a theme explicitly. */
export function systemTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
