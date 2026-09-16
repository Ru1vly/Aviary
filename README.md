# aviary

An end-to-end SEO testing toolkit for websites using browser automation. Built with TypeScript and Playwright for comprehensive SEO analysis.

<p align="left">
  <a href="https://www.npmjs.com/package/@ru1vly/aviary"><img src="https://img.shields.io/npm/v/@ru1vly/aviary.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/Ru1vly/Aviary/releases/latest"><img src="https://img.shields.io/github/v/release/Ru1vly/Aviary?style=flat-square" alt="GitHub release" /></a>
  <a href="https://ru1vly.github.io/Aviary-Docs/"><img src="https://img.shields.io/badge/docs-live-blue.svg?style=flat-square" alt="Documentation" /></a>
  <a href="https://github.com/Ru1vly/Aviary/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg?style=flat-square" alt="License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg?style=flat-square" alt="Node" /></a>
</p>

<table>
  <tr>
    <td width="50%" valign="top">
      <h4>🌐 <a href="https://ru1vly.github.io/Aviary-Docs/">Documentation Portal</a></h4>
      <p>Full guides, CLI reference, 12-factor configuration, and accuracy disclosures.</p>
    </td>
    <td width="50%" valign="top">
      <h4>🤖 <a href="#model-context-protocol-mcp-server">Model Context Protocol (MCP)</a></h4>
      <p>Stdio MCP server (<code>aviary-mcp</code>) allowing AI coding agents (Claude, Cursor, Codex) to audit sites.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4>🖥️ <a href="#quick-start">Terminal UI (TUI) Dashboard</a></h4>
      <p>Full-screen interactive Ratatui console dashboard with score meters and issue inspector.</p>
    </td>
    <td width="50%" valign="top">
      <h4>⚡ <a href="#native-architecture--terminal-ui">Fast Rust Static Engine</a></h4>
      <p>Microsecond raw HTTP static parser (<code>aviary-fast</code>) for high-throughput evaluations.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4>📦 <a href="https://www.npmjs.com/package/@ru1vly/aviary">npm Distribution</a></h4>
      <p>Zero-config installation with automatic Playwright Chromium provisioning and Chrome fallback.</p>
    </td>
    <td width="50%" valign="top">
      <h4>📊 <a href="#features">28 Categories · 235 Checks</a></h4>
      <p>Real Core Web Vitals, predictive heatmaps, JSON-LD schema, security headers, and UX.</p>
    </td>
  </tr>
</table>

> [!IMPORTANT]
> This toolkit performs static and dynamic audits on fully rendered web pages. Because it executes checks within a real browser instance, it accurately evaluates JavaScript-rendered metadata, dynamic layouts, and web performance metrics.

---

## Features

The library executes 235 individual checks across 28 categories (heatmap's click/scroll/attention checks are opt-in and included in that default count). Below is an overview of the core checker modules:

| Category | Description | Key Checks |
|---|---|---|
| Meta Tags | Validates standard page descriptors | Title presence/length, description presence/length, Open Graph tags configuration, canonical link validation |
| Headings | Audits heading structure and semantics | H1 presence and uniqueness, heading hierarchy levels, heading length optimization |
| Images | Evaluates image attributes and layouts | Alt text presence, source validity, count, dimension optimization |
| Performance | Measures basic site load times | Page load duration, DOM Content Loaded event timing, First Contentful Paint |
| Technical SEO | Verifies server configuration and response status | Response status codes, page sizes, compression headers, duplicate content detection |
| Heatmap & UX | Models visual hierarchy and attention zones | Predictive click maps, scroll depth levels, above-the-fold content scoring, CTA visibility |
| Accessibility | Inspects basic accessibility markers | ARIA landmarks, form input labeling, keyboard navigation order, skip links |
| Core Web Vitals | Measures real LCP/CLS/FCP/TTFB via `web-vitals`, plus navigation/resource heuristics | Largest Contentful Paint, Cumulative Layout Shift, First Contentful Paint, Time to First Byte, Total Blocking Time, DOM load time, HTTP request counts, resource weights |
| URL Factors | Audits the page address format | URL length, character validity, directory depth, readability rules |
| Spam Detection | Guards against search engine red flags | Hidden text, excessive keyword repetitions, link densities, iframe abuses |

---

## Prerequisites

- **Node.js**: `>= 20.0.0` (required by MCP server and modern runtime libraries)
- **Browsers**: Chromium (automatically downloaded on first run if missing, with fallback to system Google Chrome)

---

## Installation

Install the package into your project:

```bash
# Using npm
npm install @ru1vly/aviary

# Using pnpm
pnpm add @ru1vly/aviary
```

To install globally as a command-line tool:

```bash
npm install -g @ru1vly/aviary
# or with pnpm
pnpm add -g @ru1vly/aviary
```

Or run directly without installing:

```bash
npx @ru1vly/aviary -u https://example.com
```

---

## Quick Start

Analyze any URL directly from your shell.

Running the command with no arguments launches the full-screen interactive Terminal User Interface (TUI) Dashboard:

```bash
# Launch interactive TUI Dashboard
aviary
```

To run checks directly in stdout mode (e.g. for scripts, CI pipelines, or AI agents), you must pass the target URL using the `-u` or `--url` flag:

```bash
# Run direct audit
aviary -u https://example.com

# Save detailed JSON report to a file
aviary -u https://example.com --output report.json

# Save a visual HTML report to a file
aviary -u https://example.com --html report.html

# Run checks with verbose outputs (lists failure details)
aviary -u https://example.com --verbose

# Run with a mobile viewport simulation
aviary -u https://example.com --viewport 375x667
```

### Programmatic API

Import the `SEOChecker` class to run checks programmatically within your Node.js application:

```typescript
import { SEOChecker } from '@ru1vly/aviary';

async function runAudit() {
  const checker = new SEOChecker({
    url: 'https://example.com',
    headless: true,
  });

  const report = await checker.check();
  console.log(`Overall SEO Score: ${report.score}/100`);
  console.log(`Passed: ${report.summary.passed}/${report.summary.total} checks`);
}

runAudit();
```

---

## Model Context Protocol (MCP) Server

Aviary includes a built-in Model Context Protocol (MCP) server that exposes real-browser SEO auditing tools directly to AI coding agents (Claude Desktop, Cursor, Windsurf, Antigravity, etc.).

The server communicates via standard I/O (`stdio`) and provides three registered tools:

| Tool | Parameters | Description |
|---|---|---|
| `seo_audit` | `url`, `preset?` (`basic`\|`advanced`\|`strict`), `categories?` | Full SEO audit returning structured results across all 28 categories. |
| `seo_score` | `url` | Quick audit returning overall score (0-100), letter grade (`A`-`F`), and pass/fail counts. |
| `seo_check_category` | `url`, `category` | Targeted audit executing checks for a single specified category. |

### Running the MCP Server

```bash
# Via binary entry point
aviary-mcp

# Or via npx
npx @ru1vly/aviary aviary-mcp

# Or directly from source/monorepo
pnpm run mcp-server
```

### Agent Configuration (`claude_desktop_config.json` / MCP Settings)

```json
{
  "mcpServers": {
    "aviary": {
      "command": "npx",
      "args": ["-y", "@ru1vly/aviary", "aviary-mcp"]
    }
  }
}
```

---

## Command Line Options

The command-line interface supports the following parameters:

| Option | Shortcut | Type | Description |
|---|---|---|---|
| `--url` | `-u` | string | Target website URL to analyze (required for CLI audit mode) |
| `--output` | `-o` | string | File path to write the JSON results payload |
| `--html` | | string | File path to write the visual HTML report page |
| `--json` | | boolean | Output raw JSON string directly to standard output |
| `--config` | `-c` | string | Path to a custom JSON or YAML configuration file |
| `--preset` | `-p` | string | Configuration preset name (`basic`, `advanced`, `strict`) |
| `--verbose` | `-v` | boolean | Output check details object for failed entries |
| `--headed` | | boolean | Run the browser simulator in headed mode (visible) |
| `--viewport` | | string | Set simulator window size (e.g. `1920x1080` or `375x667`) |
| `--init-config`| | boolean | Create a default configuration template file in the CWD |

---

## Environment Variables (12-Factor Config)

All CLI options can be configured via environment variables for 12-factor deployment and container environments:

| Variable | Type / Values | Description |
|---|---|---|
| `AVIARY_URL` | string | Target URL (overridden by `-u` / `--url`) |
| `AVIARY_HEADLESS` | `"true"` \| `"false"` | Run browser headless (overridden by `--headed`) |
| `AVIARY_TIMEOUT` | number (ms) | Page load timeout in milliseconds (default: `30000`) |
| `AVIARY_VIEWPORT` | `"WxH"` | Simulator viewport size (overridden by `--viewport`) |
| `AVIARY_PRESET` | `"basic"` \| `"advanced"` \| `"strict"` | Active rule preset (overridden by `--preset`) |
| `AVIARY_OUTPUT` | string (path) | Destination path for JSON report (overridden by `--output`) |
| `AVIARY_HTML_OUTPUT` | string (path) | Destination path for HTML report (overridden by `--html`) |
| `AVIARY_LOG_LEVEL` | `"debug"` \| `"info"` \| `"warn"` \| `"error"` | Log verbosity (default: `info`) |
| `AVIARY_LLM_PROVIDER`| `"ollama"` \| `"stub"` | LLM provider for semantic checks (default: `stub`) |
| `AVIARY_LLM_ENDPOINT`| string | LLM endpoint URL (default: `http://localhost:11434`) |
| `AVIARY_LLM_MODEL` | string | LLM model identifier (default: `llama3.2`) |
| `AVIARY_LLM_API_KEY` | string | LLM API key when required (never logged) |
| `AVIARY_METRICS_PORT`| number | Prometheus `/metrics` HTTP server port (default: `9090`) |

### Prometheus Metrics

Aviary automatically starts a lightweight background Prometheus metrics server on port `9090` (or `AVIARY_METRICS_PORT`). Scrape `http://localhost:9090/metrics` to monitor execution histograms (`llm_inference_time_ms`) and default Node.js runtime metrics.

---

## Configuration

You can customize which audits to run and modify their rules via custom config files or presets.

> [!NOTE]
> Presets restrict or expand the check list:
> - **basic**: Fast, essential checks (ideal for rapid CI checks)
> - **advanced**: Comprehensive analysis covering heatmap simulations (default)
> - **strict**: Full checks with stricter scoring rules

Beyond enabling/disabling rules and setting severity, individual checks' numeric thresholds (minimum word count, title length bounds, image count ceilings, and so on) can be overridden per rule via an `options` object in the config file — see [`examples/CONFIG.md`](examples/CONFIG.md) for the full schema and available checkers.

To write an HTML report programmatically:

```typescript
import { SEOChecker, generateHtmlReport } from '@ru1vly/aviary';

async function exportReport() {
  const checker = new SEOChecker({ url: 'https://example.com' });
  const report = await checker.check();
  
  // Write the report to disk
  generateHtmlReport(report, './reports/seo-analysis.html');
}
```

---

## Native Architecture & Terminal UI

Aviary combines a high-fidelity TypeScript + Playwright browser crawler with high-performance Rust components:

1. **Interactive TUI Dashboard**: Built with [Ratatui](https://crates.io/crates/ratatui) and Crossterm in `tui/`. Running `aviary` with no arguments boots into a responsive terminal dashboard with real-time audit navigation, score meters, and issue inspectors.
2. **Fast Static Engine (`aviary-fast`)**: Native Rust parser built with `reqwest`, `scraper`, and `tokio` for microsecond-level raw HTTP checks.
3. **Platform Prebuilt Binaries**: Shipped via optional dependencies for zero-compilation startup:
   - `@ru1vly/aviary-linux-x64`
   - `@ru1vly/aviary-linux-arm64`
   - `@ru1vly/aviary-darwin-x64`
   - `@ru1vly/aviary-darwin-arm64`
   - `@ru1vly/aviary-win32-x64`

---

## Project Structure

```
aviary/
├── src/                   # Source code
│   ├── checkers/          # 28 SEO checker modules
│   ├── config/            # Loader, presets, and configuration types
│   ├── errors/            # Logger, error handlers, and retry mechanism
│   ├── types/             # Common TypeScript interfaces
│   ├── index.ts           # Core library entry point
│   ├── cli.ts             # CLI command runner
│   └── reporter.ts        # HTML report template compiler
├── examples/              # Code samples and config file templates
├── tests/                 # Unit, integration, and E2E tests
└── dist/                  # Compiled JavaScript distribution
```

---

## Development Setup

To build and test the tool locally:

```bash
# Clone the repository
git clone https://github.com/Ru1vly/Aviary.git
cd Aviary

# Install project dependencies
pnpm install

# Download required browser binaries
pnpm exec playwright install chromium

# Compile TypeScript code to distribution folder
pnpm run build

# Run unit and integration tests
pnpm run test
```

---

## License

This project is licensed under the MIT License.
