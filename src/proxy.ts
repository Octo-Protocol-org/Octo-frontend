import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers, primarily a strict Content-Security-Policy.
 *
 * Why this matters here specifically: Octo is non-custodial, so users' private keys are decrypted
 * and used to sign transactions *in the browser*. That makes cross-site scripting (XSS) the top
 * threat — an injected script could read the encrypted backup and capture the password/key at
 * unlock time. A strict, nonce-based CSP is the single most effective defense: it blocks inline
 * and third-party scripts, so only our own bundles (carrying the per-request nonce) can run.
 *
 * We use a per-request nonce with `strict-dynamic` (the Next.js-recommended strict approach).
 * Production needs no `'unsafe-eval'`/`'wasm-unsafe-eval'` because our crypto stack
 * (@noble, @scure, @stellar/stellar-base) is pure JS and uses WebCrypto — no WASM, no eval.
 *
 * COOP `same-origin` severs `window.opener` links to cross-origin windows (tab-nabbing, XS-Leaks
 * via window references). Freighter is unaffected: it talks to the page through its extension
 * content script via postMessage and opens its own extension popup, not a cross-origin
 * `window.open`. CORP `same-origin` stops other sites embedding our responses (Spectre-style
 * leaks); it only governs responses we serve, so uploads to and images from Cloudinary still work.
 */
function apiOrigin(): string {
  // The browser talks to the Octo API (which in turn reaches Horizon server-side), so only the
  // API origin needs to be allowed in connect-src.
  const url = process.env.NEXT_PUBLIC_OCTO_API_URL ?? "http://localhost:8080";
  try {
    return new URL(url).origin;
  } catch {
    return "http://localhost:8080";
  }
}

// Payment-link images are uploaded straight from the browser to Cloudinary (the API only signs
// the request) and then served from Cloudinary's CDN, so both origins must be allowed. These are
// two specific hosts rather than a wildcard — no other third-party origin is permitted.
const CLOUDINARY_UPLOAD = "https://api.cloudinary.com";
const CLOUDINARY_CDN = "https://res.cloudinary.com";

// SHA-256 of THEME_INIT_SCRIPT in src/lib/theme.ts — the blocking inline script that sets
// data-theme before first paint. It can't use the nonce: reading the nonce in the root layout
// would force every route dynamic and defeat the static prerendering below. Only the strict
// branch needs this; the static branch's 'unsafe-inline' already covers it, and adding a hash
// there would make CSP ignore 'unsafe-inline' and block Next's own inline hydration scripts.
// src/lib/theme.test.ts recomputes this and fails if the script and hash drift apart.
const THEME_SCRIPT_HASH = "'sha256-b0IjdpRDazTe7ymepRk7Xjq0NgKhw2H6Gs56SknLntg='";

// CSP violation reporting endpoint, read from the documented CSP_REPORT_ENDPOINT variable. When
// set to a valid absolute http(s) URL, both CSP branches report violations here so an injection
// attempt (or a regression we shipped) is visible instead of silently blocked. Empty or malformed
// values are ignored, leaving reporting disabled.
function cspReportEndpoint(): string | undefined {
  const raw = process.env.CSP_REPORT_ENDPOINT?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const CSP_REPORT_GROUP = "csp-endpoint";

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const connect = `connect-src 'self' ${apiOrigin()} ${CLOUDINARY_UPLOAD}${isDev ? " ws: http://localhost:*" : ""}`;
  const img = `img-src 'self' blob: data: ${CLOUDINARY_CDN}`;

  // Routes that handle credentials or session state (password at login/signup/reset, decrypted
  // keys in localStorage across the dashboard, and the payer's transaction details at checkout)
  // get a strict, nonce-based CSP with no `unsafe-inline` on scripts — an XSS there could capture
  // a password or tamper with a transaction before signing. They are forced to dynamic rendering
  // (each page sets `export const dynamic = "force-dynamic"`) so Next can stamp the nonce onto
  // its scripts. Purely static marketing/docs pages handle no credentials and stay on the lighter
  // CSP that does not require a nonce (a nonce would block their prerendered scripts).
  const pathname = request.nextUrl.pathname;
  // Credential/session-handling routes: login/signup/reset, the whole authenticated dashboard,
  // and the public checkout.
  const isStrictRoute =
    /^\/login(\/|$)/.test(pathname) ||
    /^\/signup(\/|$)/.test(pathname) ||
    /^\/forgot-password(\/|$)/.test(pathname) ||
    /^\/dashboard(\/|$)/.test(pathname) ||
    /^\/pay(\/|$)/.test(pathname);

  // Only add reporting directives when a valid endpoint is configured, so an unset or malformed
  // variable leaves the CSP and headers exactly as before.
  const reportEndpoint = cspReportEndpoint();
  const reportDirectives = reportEndpoint
    ? [`report-uri ${reportEndpoint}`, `report-to ${CSP_REPORT_GROUP}`]
    : [];

  const requestHeaders = new Headers(request.headers);
  let csp: string;

  if (isStrictRoute) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    csp = [
      `default-src 'self'`,
      // nonce + 'strict-dynamic': only scripts we emit (carrying this nonce) run; they may load
      // their own chunks. 'unsafe-eval' is dev-only (React uses eval for dev error stacks).
      `script-src 'self' 'nonce-${nonce}' ${THEME_SCRIPT_HASH} 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
      // Inline styles can't exfiltrate secrets the way scripts can — a limited, deliberate relax.
      `style-src 'self' 'unsafe-inline'`,
      img,
      `font-src 'self'`,
      connect,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
      `upgrade-insecure-requests`,
      ...reportDirectives,
    ].join("; ");
    // Pass the nonce down so Next.js attaches it to its framework/page scripts.
    requestHeaders.set("x-nonce", nonce);
  } else {
    // Static-friendly CSP: no nonce (so prerendered scripts still run), but still no third-party
    // script origins. These routes never touch a private key.
    csp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      `style-src 'self' 'unsafe-inline'`,
      img,
      `font-src 'self'`,
      connect,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
      `upgrade-insecure-requests`,
      ...reportDirectives,
    ].join("; ");
  }

  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  // Reporting-Endpoints pairs with the CSP `report-to` directive so browsers can POST violations.
  if (reportEndpoint) {
    response.headers.set(
      "Reporting-Endpoints",
      `${CSP_REPORT_GROUP}="${reportEndpoint}"`,
    );
  }
  // Defense-in-depth headers.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  // Only send HSTS in production over HTTPS.
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  // Run on pages, but skip Next internals, the favicon, and static assets (they don't need CSP
  // and skipping prefetches avoids nonce churn).
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
