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
