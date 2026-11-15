# Security Policy

Aviary is an offline-first SEO/GEO audit tool: default local audits send requests to the target site, execute their page in Chromium, and write results to operator-selected paths. It has no built-in usage analytics or crash reporting (see [data handling](docs/PRIVACY.md)). Security issues in Aviary itself should be reported using the private channel below rather than a public issue.

## Supported Versions

Security fixes are applied to the latest published minor release. Older minors are not supported.

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | ✔️                 |
| < 0.2   | ❌                 |

## Reporting a Vulnerability

Please use GitHub's [private vulnerability reporting](https://github.com/Ru1vly/Aviary/security/advisories/new) for the repository. Do not open a public issue or pull request with vulnerability details.

Include in your report:

- the Aviary version (`aviary --version`) and the installation method (npm, npx, or source checkout);
- Node.js and operating system versions;
- the smallest command or API request that reproduces the issue;
- a sanitized impact description (e.g., what data, process, or host is affected);
- any relevant crash or log output, with credentials and personal data removed.

## What to Expect

- You should receive an acknowledgement within 7 days.
- Accepted reports are fixed in a patch or minor release; the advisory is published once a fix is available. Declined reports are explained with the reason.
- Please give us a reasonable window to release a fix before disclosing publicly.

## Scope

In scope: the published `@ru1vly/aviary` package, the `aviary-mcp`/`aviary-api` servers, and the optional native Rust engine/TUI. Out of scope: vulnerabilities in third-party pages audited by Aviary, or issues in dependencies that are already tracked by a separate advisory.

Aviary runs dependency audits (pnpm audit, cargo-audit), CodeQL, and SBOM generation in CI — see [`.github/workflows/security.yml`](.github/workflows/security.yml).
