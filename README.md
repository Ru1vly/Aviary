# Aviary

Open-source SEO and AI crawler audits for your development workflow. Inspect rendered pages, review actionable findings, and catch issues before deployment.

[![npm](https://img.shields.io/npm/v/@ru1vly/aviary.svg)](https://www.npmjs.com/package/@ru1vly/aviary)
[![CI](https://github.com/Ru1vly/Aviary/actions/workflows/ci.yml/badge.svg)](https://github.com/Ru1vly/Aviary/actions/workflows/ci.yml)

Aviary helps developers and web agencies review metadata, crawler access, content structure, accessibility markers, and lab performance. Run it locally, save an HTML report, or add checks to CI. It uses TypeScript and Playwright Chromium, with optional native Rust tools.

- **Review what browsers see:** audit rendered pages, including sites that use JavaScript.
- **Check AI crawler controls:** inspect crawler policies and GEO page signals; analyze supplied AI-answer citations, crawler logs, and Google/Bing exports.
- **Keep checks in your workflow:** use the CLI, Node.js SDK, REST API, or MCP server.
- **Inspect and adapt the checks:** Aviary is MIT licensed. Default local audits have no built-in telemetry and do not upload reports. See [data handling](docs/PRIVACY.md) for network requests and optional services.

Scores summarize the included checks. They do not verify factual accuracy or predict rankings and AI citations.

## Run your first audit

With Node.js 20 or newer, replace the example URL with your website:

```sh
npx @ru1vly/aviary -u https://example.com/ --output report.json --html report.html
```

Open `report.html` in your browser. Review a failed check, inspect the affected page, make a fix, and run the command again. Keep `report.json` if you want to compare later runs or render another report without auditing again.

Chromium is downloaded on the first browser audit when missing, with a system Chrome fallback. Some Linux systems need additional browser libraries; see [troubleshooting](docs/TROUBLESHOOTING.md).

Follow the [first-audit guide](docs/GETTING_STARTED.md) for a fix-and-review workflow, or [add a scheduled audit to GitHub Actions](docs/GETTING_STARTED.md#run-in-github-actions).

## Install

Node.js 20 or newer is required. Chromium is downloaded on first browser audit when missing, with a system Chrome fallback. Some Linux systems need additional browser libraries; see [troubleshooting](docs/TROUBLESHOOTING.md).

```sh
npm install -g @ru1vly/aviary
aviary --version
```

For a Node.js project, use `npm install @ru1vly/aviary`. To run without a global installation:

```sh
npx @ru1vly/aviary -u https://example.com/
```

## Audit a page or site

```sh
# Browser audit with JSON and an offline HTML dashboard
aviary -u https://example.com/ --json --output report.json --html report.html

# GEO controls and observed page signals
aviary -u https://example.com/ --preset geo --json --output geo.json

# Discover pages through a sitemap
aviary --sitemap https://example.com/sitemap.xml --max-urls 100 --json --output site.json

# Fail CI on check findings
aviary -u https://example.com/ --fail-on-findings

# Render a saved report without another browser audit
aviary --render report.json --html report.html
```

Reports can also be exported as Markdown, CSV, PDF, JUnit and SARIF. Run `aviary --help` for options or use the [CLI reference](docs/CLI.md). Running `aviary` without arguments opens the interactive terminal UI when its native package is available.

## Use from Node.js

```ts
import { SEOChecker } from '@ru1vly/aviary';

const report = await new SEOChecker({
  url: 'https://example.com/',
  headless: true,
}).check();

console.log(report.score, report.summary);
```

The [SDK and MCP guide](docs/SDK.md) covers bounded batches, discovery, cancellation and agent tools. `aviary-api` starts the loopback REST server; see [API](docs/API.md) for authentication, limits, jobs and the typed HTTP client.

## Documentation

| Need | Guide |
| --- | --- |
| First audit, reviewing a fix and GitHub Actions setup | [Getting started](docs/GETTING_STARTED.md) |
| Options, environment variables and shell completion | [CLI](docs/CLI.md) |
| GEO auditing, supplied observations and comparison gates | [GEO](docs/GEO.md) |
| What the output verifies, external comparisons and reproduction | [GEO validation](docs/GEO_OUTPUT_VALIDATION.md) |
| Measurement limitations and manual review | [Accuracy](docs/ACCURACY_LIMITATIONS.md) |
| Node.js API and MCP setup | [SDK and MCP](docs/SDK.md) |
| REST API, jobs and HTTP client | [API](docs/API.md) |
| JSON/YAML settings and presets | [Configuration](examples/CONFIG.md) |
| Sitemap/link discovery and sitewide scope | [Crawling](docs/CRAWLING.md) |
| Practical audit workflows | [Examples](examples/USE_CASES.md), [best practices](docs/BEST_PRACTICES.md) |
| Data handling and outbound requests | [Privacy](docs/PRIVACY.md) |
| Setup and runtime errors | [Troubleshooting](docs/TROUBLESHOOTING.md) |
| Development, checks and releases | [Contributing](docs/CONTRIBUTING.md), [releasing](docs/RELEASING.md) |

Report JSON Schemas and [OpenAPI](docs/openapi.yaml) remain under `docs/`. Runnable fixtures remain under `examples/`; synthetic examples demonstrate report behavior and do not prove real-world GEO effectiveness.

## Help improve Aviary

Try Aviary on a real project and tell us which findings helped or where setup was confusing. [Report a bug](https://github.com/Ru1vly/Aviary/issues/new?template=bug_report.md) or [share workflow feedback](https://github.com/Ru1vly/Aviary/issues/new?template=workflow_feedback.md). Include sanitized examples so others can reproduce the problem.

Documentation fixes, reproducible bug reports, and improvements to check explanations are useful first contributions. Read [Contributing](docs/CONTRIBUTING.md) for setup and review guidance.

## Native tools

The terminal UI and static engine ship as optional packages for Linux x64/ARM64, macOS x64/ARM64 and Windows x64. The static engine inspects HTTP/HTML without executing page JavaScript; browser-dependent checks use Playwright. GitHub release assets include `SHA256SUMS` for binary verification.

## Develop

Use Node.js 22, the pinned pnpm version and Playwright Chromium:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --with-deps
pnpm run build:ts
pnpm run check:cli-docs
pnpm run test:coverage --maxWorkers=2
```

See [contributing](docs/CONTRIBUTING.md) for the complete checks and repository layout. Changes are listed in [CHANGELOG](CHANGELOG.md). Licensed under MIT; see [LICENSE](https://github.com/Ru1vly/Aviary/blob/main/LICENSE).
