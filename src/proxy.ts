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

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const connect = `connect-src 'self' ${apiOrigin()} ${CLOUDINARY_UPLOAD}${isDev ? " ws: http://localhost:*" : ""}`;
  const img = `img-src 'self' blob: data: ${CLOUDINARY_CDN}`;

  // The signing surface (dashboard) handles decrypted keys, so it gets a strict, nonce-based CSP
  // with no `unsafe-inline` on scripts. These pages are forced to dynamic rendering (see each
  // page's `export const dynamic = "force-dynamic"`) so Next can stamp the nonce onto its
  // scripts. Marketing/login/docs pages handle no keys and stay static, so they get a lighter CSP
  // that does not require a nonce (a nonce would block their prerendered scripts).
  const pathname = request.nextUrl.pathname;
  // The strict CSP applies to routes that actually decrypt/handle a private key in the browser:
  // wallet creation (keygen) and the per-wallet page (withdraw/trustline signing). Other
  // dashboard pages (overview, audit, sponsorship) only read data and use the lighter CSP.
  // Matches /dashboard/wallets/new (keygen) and /dashboard/wallets/<id>/* (signing).
  const isSigningSurface = /^\/dashboard\/wallets\/[^/]+/.test(pathname);

  const requestHeaders = new Headers(request.headers);
  let csp: string;

  if (isSigningSurface) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    csp = [
      `default-src 'self'`,
      // nonce + 'strict-dynamic': only scripts we emit (carrying this nonce) run; they may load
      // their own chunks. 'unsafe-eval' is dev-only (React uses eval for dev error stacks).
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
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
    ].join("; ");
  }

  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  // Defense-in-depth headers.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
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
