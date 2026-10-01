# Octo — Frontend

The Next.js dashboard for **Octo**, a Stellar-native Wallet-as-a-Service. It is a pure client of
the Octo backend API (the Rust `octo-server`), which lives in a separate repo:
**[Octo-Protocol](https://github.com/Octo-Protocol-org/Octo-Protocol)**.

## Architecture

- **Non-custodial:** keys are derived and used in the browser (BIP-39 seed, Stellar SDK); the backend only ever sees signed transactions, never secrets.
- **Pure API client:** every request goes through `src/lib/api.ts` to the Octo REST API.
- **CSP split:** `src/proxy.ts` gives `/dashboard/*` a strict nonce-based CSP (dynamic rendering); public and docs routes stay static with a lighter CSP.

## Directory map

| Path | Contents |
| --- | --- |
| `src/app` | Next.js routes: landing, `dashboard/*`, `docs/*`, checkout |
| `src/components` | UI components, grouped by feature |
| `src/lib` | API client, auth, key handling, helpers and their `*.test.ts` |
| `src/emails` | Email templates |
| `src/proxy.ts` | Security headers and CSP |

## Getting started

[pnpm](https://pnpm.io) is required (npm and yarn are not supported).

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev   # http://localhost:3000
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (`vitest run`) |
| `pnpm exec tsc --noEmit` | Typecheck |

## Testing

Tests live next to the code as `*.test.ts` and run with `pnpm test`.

## Security model

Never log, persist or transmit seeds, private keys or passphrases. Keep third-party scripts out (the CSP blocks them). Report vulnerabilities per [SECURITY.md](SECURITY.md). Read [AGENTS.md](AGENTS.md) before contributing.

## Contributing

1. Branch from `dev` (never `main`): `git checkout -b <type>/<issue>-<short-description>`.
2. Run the CI checks: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`.
3. Open a PR with base `dev` and `Closes #<issue>` in the description.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Configuration

Copy `.env.example` to `.env.local` and point it at your backend:

```bash
cp .env.example .env.local
# NEXT_PUBLIC_OCTO_API_URL=http://localhost:8080   (local) or your deployed API origin
```

> **Note:** `NEXT_PUBLIC_OCTO_API_URL` is **inlined at build time** by Next.js, not read at
> runtime. Changing it requires a rebuild/redeploy. On Vercel, set it in the project's
> Environment Variables and redeploy — editing it without a new build has no effect.

## Deploy

Deploys to **Vercel** (zero-config Next.js). Set `NEXT_PUBLIC_OCTO_API_URL` to the deployed API
origin in the Vercel project settings. Make sure that origin is included in the backend's
`CORS_ALLOWED_ORIGINS` allowlist.
