# e2e-seo

An end-to-end SEO testing toolkit for websites using browser automation. Built with TypeScript and Playwright for comprehensive SEO analysis.

> [!IMPORTANT]
> This toolkit performs static and dynamic audits on fully rendered web pages. Because it executes checks within a real browser instance, it accurately evaluates JavaScript-rendered metadata, dynamic layouts, and web performance metrics.

---

## Features

The library executes 260+ individual checks across 28 categories. Below is an overview of the core checker modules:

| Category | Description | Key Checks |
|---|---|---|
| Meta Tags | Validates standard page descriptors | Title presence/length, description presence/length, Open Graph tags configuration, canonical link validation |
| Headings | Audits heading structure and semantics | H1 presence and uniqueness, heading hierarchy levels, heading length optimization |
| Images | Evaluates image attributes and layouts | Alt text presence, source validity, count, dimension optimization |
| Performance | Measures basic site load times | Page load duration, DOM Content Loaded event timing, First Contentful Paint |
| Technical SEO | Verifies server configuration and response status | Response status codes, page sizes, compression headers, duplicate content detection |
| Heatmap & UX | Models visual hierarchy and attention zones | Predictive click maps, scroll depth levels, above-the-fold content scoring, CTA visibility |
| Accessibility | Inspects basic accessibility markers | ARIA landmarks, form input labeling, keyboard navigation order, skip links |
| Core Web Vitals | Inspects real browser navigation metrics | DOM load time, HTTP request counts, resource weights, performance timing API |
| URL Factors | Audits the page address format | URL length, character validity, directory depth, readability rules |
| Spam Detection | Guards against search engine red flags | Hidden text, excessive keyword repetitions, link densities, iframe abuses |

---

## Installation

Install the package via npm:

```bash
npm install e2e-seo
```

To install globally as a command-line tool:

```bash
npm install -g .
```

---

## Quick Start

Analyze any URL directly from your shell.

Running the command with no arguments launches the full-screen interactive Terminal User Interface (TUI) Dashboard:

```bash
# Launch interactive TUI Dashboard
e2e-seo
```

To run checks directly in stdout mode (e.g. for scripts, CI pipelines, or AI agents), you must pass the target URL using the `-u` or `--url` flag:

```bash
# Run direct audit
e2e-seo -u https://example.com

# Save detailed JSON report to a file
e2e-seo -u https://example.com --output report.json

# Save a visual HTML report to a file
e2e-seo -u https://example.com --html report.html

# Run checks with verbose outputs (lists failure details)
e2e-seo -u https://example.com --verbose

# Run with a mobile viewport simulation
e2e-seo -u https://example.com --viewport 375x667
```

### Programmatic API

Import the SEOChecker class to run checks programmatically within your Node.js application:

```typescript
import { SEOChecker } from 'e2e-seo';

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

## Command Line Options

The command-line interface supports the following parameters:

| Option | Shortcut | Type | Description |
|---|---|---|---|
| `--url` | `-u` | string | Target website URL to analyze (required) |
| `--output` | `-o` | string | File path to write the JSON results payload |
| `--html` | | string | File path to write the visual HTML report page |
| `--json` | | boolean | Output raw JSON string directly to standard output |
| `--config` | `-c` | string | Path to a custom JSON or YAML configuration file |
| `--preset` | `-p` | string | Configuration preset name (basic, advanced, strict) |
| `--verbose` | `-v` | boolean | Output check details object for failed entries |
| `--headed` | | boolean | Run the browser simulator in headed mode (visible) |
| `--viewport` | | string | Set simulator window size (e.g. 1920x1080) |
| `--init-config`| | boolean | Create a default configuration template file in the CWD |

---

## Configuration

You can customize which audits to run and modify their rules via custom config files or presets.

> [!NOTE]
> Presets restrict or expand the check list:
> - **basic**: Fast, essential checks (ideal for rapid CI checks)
> - **advanced**: Comprehensive analysis covering heatmap simulations (default)
> - **strict**: Full checks with stricter scoring rules

To write an HTML report programmatically:

```typescript
import { SEOChecker, generateHtmlReport } from 'e2e-seo';

async function exportReport() {
  const checker = new SEOChecker({ url: 'https://example.com' });
  const report = await checker.check();
  
  // Write the report to disk
  generateHtmlReport(report, './reports/seo-analysis.html');
}
```

---

## Project Structure

```
e2e-seo/
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
git clone https://github.com/yourusername/e2e-seo.git
cd e2e-seo

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
