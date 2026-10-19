# Branded token and wallet IDs: plan

Tracks issue #553. The branded types exist in `src/lib/brands.ts`. This plan lists the
helpers that still take plain strings, and the order to change them. It is a scaffold: no
signatures have changed yet, so the build is unaffected.

## Boundaries that brand a value once

- `useAuth`: returns the session token as `AuthToken` (`asAuthToken` at the point it is stored).
- Route params: pages that call `use(params)` brand `id` as `WalletId` in one line
  (12 pages at the time of writing).
- Lists: `w.id` from a `WalletView` is branded where it is passed to a helper.

## Helpers to change, in order

1. `src/lib/wallets.ts`: 24 exported functions. Start with the ones called from the most pages
   (`getWallet`, `listAddressesPage`, `listTransactionsPage`).
2. `src/lib/gasTankApi.ts`, `src/lib/walletDetailsApi.ts`, `src/lib/uploads.ts`.
3. `src/lib/audit.ts` and `src/lib/auth.ts`.
4. `src/lib/sdk/client.ts`.

Each helper changes its `token` parameter to `AuthToken` and its wallet ID parameter to
`WalletId`. Because branded types are still strings, callers that already pass a branded value
keep compiling. The remaining call sites are fixed as each helper changes.

## Done when

Swapping the token and wallet ID arguments of any helper is a type error.
