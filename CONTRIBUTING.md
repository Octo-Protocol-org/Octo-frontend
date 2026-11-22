# Contributing

Thanks for your interest in contributing. This document describes the workflow,
conventions, and expectations for changes to this repository.

## Development branch workflow

- All work happens on feature branches created off `dev`.
- `dev` is the integration branch. `main` is reserved for releases.
- Open pull requests against `dev`, not `main`.
- Keep branches short-lived and rebase on `dev` before requesting review.

## Branch naming

Use a short, descriptive prefix followed by a kebab-case summary:

- `feat/<summary>` — new functionality
- `fix/<summary>` — bug fixes
- `chore/<summary>` — tooling, dependencies, housekeeping
- `docs/<summary>` — documentation only
- `refactor/<summary>` — behavior-preserving restructuring

Examples: `feat/retry-backoff`, `fix/null-token-refresh`, `docs/contributing-guide`.

## CI commands

Run these locally before pushing. CI runs the same set:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

- `pnpm install --frozen-lockfile` — install exactly the locked dependency set.
  Do not commit changes to `pnpm-lock.yaml` unless you intentionally changed
  dependencies.
- `pnpm typecheck` — type-check without emitting output.
- `pnpm lint` — run the linter; fix all reported issues.
- `pnpm test` — run the test suite.
- `pnpm build` — verify the project builds.

All five must pass before a pull request is merged.

## Security expectations

These expectations come from `AGENTS.md` and apply to every contribution:

- Never commit secrets, tokens, credentials, or private keys. Use environment
  variables or a secrets manager instead.
- Do not log sensitive values (tokens, passwords, personal data) at any level.
- Validate and sanitize all external input at the boundary.
- Keep dependencies up to date and avoid introducing packages with known
  vulnerabilities.
- Report suspected vulnerabilities privately rather than opening a public issue.

## Comment style

Use one-line comments. Keep them short and explain *why*, not *what*:

```ts
// Retry once because the upstream occasionally returns a transient 503.
```

Avoid multi-line comment blocks and commented-out code. If code is no longer
needed, delete it — version control remembers it.

## Amount precision

Stellar amounts are int64 stroops. The int64 max (9,223,372,036,854,775,807) is
larger than `Number.MAX_SAFE_INTEGER` (2^53 − 1), so amounts **must never travel
through a JS `number`** when they could be that large.

Rules:
- API types use `Stroops` (a branded `string`) from `src/lib/brands.ts`, not `number`.
- Use `formatStroops` and `sumStroops` from `src/lib/amount.ts` for display and arithmetic.
- The same rule applies to memo IDs (uint64) — use the `MemoId` branded type.
- When adding a new API field that is a stroop amount or a memo ID, coordinate with the
  backend to send it as a decimal string and use the branded types on the frontend.

## Pull requests

- Keep changes focused; one logical change per pull request.
- Describe the motivation and the approach in the description.
- Link related issues.
- Ensure the CI commands above pass locally.
- Respond to review feedback promptly.
## Dependencies

CI runs `pnpm audit --prod --audit-level=high` and fails on high or critical
advisories in production dependencies. If it fails, upgrade the affected
package or add a pnpm override. If neither is possible, record a documented
ignore (advisory link plus an expiry date) in `pnpm-workspace.yaml` and remove
it once the fix lands.

## Coverage thresholds

Coverage covers all non-UI `src/lib` modules and `src/proxy.ts` (baseline 50%
for branches, functions, lines and statements). `src/lib/sdk/**` keeps stricter
thresholds (85% branches, 90% functions, lines and statements). CI fails if
either is breached.
