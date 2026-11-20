# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for security reports.** Octo is non-custodial and moves real money — responsible disclosure protects users.

Use GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/Octo-Protocol-org/Octo-frontend/security/advisories/new)**

Or email: **security@octoprotocol.org**

Include as much detail as possible: steps to reproduce, impact assessment, and any proof-of-concept. We will acknowledge receipt within **2 business days** and aim to ship a fix within **14 days** for critical issues.

## Scope

| In scope | Out of scope |
|---|---|
| Authentication & session handling | Third-party dependencies (report upstream) |
| Key management and encryption | Social engineering attacks |
| API key security | Issues in non-production branches with no user impact |
| Transaction signing and relay | Theoretical issues without demonstrated impact |
| Gas sponsorship logic | |
| Payment link flows | |

## Supported Versions

We only address security issues against the latest release on `main`.

## Disclosure Policy

We follow coordinated disclosure. Please allow us reasonable time to patch before publishing details publicly. We will credit reporters in release notes unless you prefer to remain anonymous.

## Security Headers

### HSTS Policy per Environment

The `Strict-Transport-Security` (HSTS) header is tuned per deployment environment in `src/proxy.ts`. The environment is selected by the `OCTO_DEPLOY_ENV` variable (project-specific override), falling back to `VERCEL_ENV`, and is mapped to `production | preview | staging | development`:

| Environment | HSTS policy |
|---|---|
| Production | `max-age=63072000; includeSubDomains; preload` |
| Preview / staging | `max-age=300` (short, no `includeSubDomains`, no `preload`) |
| Development | No HSTS header |

If the environment is unknown in a production build, the header fails safe to the short `max-age=300` policy rather than the `preload` policy.

**Rationale.** Production hosts are stable and long-lived, so a two-year `max-age` with `includeSubDomains` and `preload` gives the strongest protection against protocol-downgrade and cookie-hijacking attacks. Preview and staging hosts are ephemeral and may be served over plain HTTP during local development or behind internal tooling; applying the production policy there would pin those hosts (and their subdomains) to HTTPS in visitors' browsers, breaking local/dev access and locking users out of preview deployments that are not yet TLS-ready. A short `max-age` on non-production keeps the header present for testing without the irreversible commitment of `preload` or `includeSubDomains`.