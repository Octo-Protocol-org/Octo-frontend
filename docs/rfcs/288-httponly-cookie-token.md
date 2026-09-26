# RFC 288 — Move the session token from `localStorage` to an `httpOnly` cookie

**Status:** Draft  
**Issue:** [#288](https://github.com/Octo-Protocol-org/Octo-frontend/issues/288)  
**Author:** Octo Engineering  
**Date:** 2026-09-26

---

## Problem

The bearer token is currently stored in `localStorage` (`octo_token`). Any script executing on
the origin — including injected third-party scripts and XSS payloads — can read it with
`localStorage.getItem("octo_token")`. For a wallet app that moves real funds, XSS is equivalent
to full account takeover.

An `httpOnly` cookie cannot be read by JavaScript at all. The browser attaches it automatically
to same-origin requests, so the attack surface shrinks to CSRF (cross-site request forgery),
which is straightforward to mitigate.

---

## Proposed solution

### 1. Cookie attributes

| Attribute | Value | Rationale |
|---|---|---|
| `HttpOnly` | set | Prevents script access. |
| `Secure` | set | Transmit over TLS only; required in production. |
| `SameSite` | `Strict` | Blocks the cookie on cross-site navigations, eliminating classic CSRF. |
| `Path` | `/` | Cookie is scoped to the whole app. |
| `Max-Age` | Match JWT expiry (e.g. 7 days) | Automatic expiry without explicit logout needed. |
| `Domain` | Not set (host-only) | Restrict to the exact origin; do not share with subdomains. |

### 2. CSRF strategy

`SameSite=Strict` eliminates the main CSRF vector for state-mutating requests initiated by
cross-site navigation. The remaining risk (subdomain takeover, mix of Lax/Strict origins) is
mitigated with a **double-submit cookie** or a **custom `X-Requested-With: XMLHttpRequest`
header check**:

- All `apiFetch` requests already send `Content-Type: application/json`. The backend can reject
  any `POST`/`PATCH`/`DELETE` that lacks this header (or an `X-Octo-Request: 1` header).
- For higher assurance, issue a separate `csrf_token` cookie (not `httpOnly`, readable by JS)
  and require it as a request header. The backend validates that the header value matches the
  cookie value (synchronised-token pattern).

**Recommendation:** start with the `X-Octo-Request` header check (zero UI change, backend-only)
and add the synchronised-token pattern in a follow-up if the threat model demands it.

### 3. CORS / `credentials` changes

| Layer | Current | Required |
|---|---|---|
| `fetch` calls | No `credentials` option | `credentials: "include"` on all `apiFetch` calls |
| Backend `CORS_ALLOWED_ORIGINS` | Allows origins | Must remain an explicit allowlist — `*` is forbidden with `credentials: "include"` |
| Backend `Access-Control-Allow-Credentials` | Not set | Must be `true` |

The backend must set:

```
Access-Control-Allow-Origin: https://app.octo.xyz   # exact origin, not *
Access-Control-Allow-Credentials: true
```

### 4. Backend changes required (octo-server)

1. **`POST /v1/auth/login`** and **`POST /v1/auth/verify-email`**: after issuing the JWT, set it
   as an `httpOnly; Secure; SameSite=Strict` cookie instead of (or in addition to) returning it
   in the JSON body.
2. **`POST /v1/auth/logout`** (new endpoint): clears the cookie by sending a `Set-Cookie` with
   `Max-Age=0`.
3. **CSRF middleware**: validate `X-Octo-Request: 1` header (or synchronised token) on all
   state-mutating routes.
4. **CORS**: set `Access-Control-Allow-Credentials: true` and restrict `Allow-Origin` to the
   explicit frontend origin.
5. **Token extraction**: read the token from the cookie instead of (or as a fallback to) the
   `Authorization: Bearer` header.

### 5. Frontend changes required (this repo)

1. Remove `saveToken`, `getToken`, `clearToken` from `auth.ts` (or gate them behind a feature
   flag during migration).
2. Update `apiFetch` to pass `credentials: "include"` on all requests (token is in the cookie).
3. Remove the `token` prop threading through `useAuth` → `apiFetch` (the cookie is implicit).
4. Replace explicit `Bearer` header construction with the cookie-based flow.
5. Logout: call `POST /v1/auth/logout` to let the server clear the cookie, then clear
   `octo_wallet_backup_*` from localStorage locally (the backups do not move to cookies).

### 6. Migration / feature flag

To avoid a big-bang cutover:

1. Land backend changes behind a feature flag; the server accepts both cookie and `Authorization`
   header (cookie wins if both are present).
2. Land frontend changes behind the same flag.
3. Flip the flag in staging, run QA, then flip in production.
4. After one release cycle, remove the `Authorization: Bearer` fallback from the backend.

---

## Security considerations

- **XSS residual risk**: `httpOnly` removes credential theft via `localStorage`, but XSS can
  still forge authenticated requests from within the page. Defence-in-depth (CSP, subresource
  integrity, dependency auditing) remains essential.
- **Subdomain isolation**: if any subdomain is untrusted (e.g. user-controlled content), do NOT
  set `Domain` to the registrable domain — keep it host-only.
- **Logout across tabs**: the `storage` event approach in #285 cannot signal other tabs when the
  token is in a cookie. Replace it with a `BroadcastChannel` message on logout, or a short-
  polling `/v1/auth/me` ping to detect server-side session revocation.
- **Local backups**: `octo_wallet_backup_*` keys in `localStorage` are encrypted ciphertexts.
  They are not session tokens and do not need to move to cookies. Continue clearing them on
  every sign-out path as implemented in #285.

---

## Follow-up issues to file

| # | Title | Depends on |
|---|---|---|
| TBD | Backend: httpOnly cookie issuance + CSRF header validation | — |
| TBD | Backend: `POST /v1/auth/logout` endpoint | — |
| TBD | Backend: CORS credentials configuration | — |
| TBD | Frontend: remove `localStorage` token helpers behind flag | Backend cookie issuance |
| TBD | Frontend: `credentials: "include"` on `apiFetch` | Backend CORS |
| TBD | Frontend: replace `storage` cross-tab logout with `BroadcastChannel` | — |

---

## Acceptance criteria

- [x] This design doc is merged and linked from issue #288.
- [ ] Follow-up implementation issues are filed (listed above).
