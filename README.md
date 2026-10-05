# Aviary

SEO and GEO audits for websites, using TypeScript and Playwright Chromium, with optional native Rust tools.

[![npm](https://img.shields.io/npm/v/@ru1vly/aviary.svg)](https://www.npmjs.com/package/@ru1vly/aviary)
[![CI](https://github.com/Ru1vly/Aviary/actions/workflows/ci.yml/badge.svg)](https://github.com/Ru1vly/Aviary/actions/workflows/ci.yml)

Aviary inspects rendered pages, crawler policies, metadata, content structure, accessibility markers and lab performance. It also analyzes supplied AI-answer citations, crawler logs and Google/Bing exports. Scores describe the included checks; they do not verify factual accuracy or predict rankings and AI citations.

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
