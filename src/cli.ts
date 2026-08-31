#!/usr/bin/env node

import { SEOChecker } from './index';
import { generateHtmlReport } from './reporter';
import { CHECKER_REGISTRY } from './checkers/registry';
import * as fs from 'fs';
import { loadEnvConfig } from './config/env';
import { categorizeError, ErrorCategory } from './errors/types';
import { createLogger } from './config/logger';
import * as http from 'http';
import * as client from 'prom-client';

client.collectDefaultMetrics();

export const llmInferenceTimeMs = new client.Histogram({
  name: 'llm_inference_time_ms',
  help: 'LLM inference time in milliseconds',
  buckets: [100, 500, 1000, 5000, 10000]
});

const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});
metricsServer.on('error', () => {});
const metricsPort = process.env.AVIARY_METRICS_PORT ? parseInt(process.env.AVIARY_METRICS_PORT, 10) : 9090;
metricsServer.listen(metricsPort);
metricsServer.unref();

interface CliArgs {
  url?: string;
  output?: string;
  html?: string;
  headless?: boolean;
  viewport?: string;
  config?: string;
  preset?: string;
  help?: boolean;
  initConfig?: boolean;
  json?: boolean;
  verbose?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-u':
      case '--url':
        args.url = argv[++i];
        break;
      case '-o':
      case '--output':
        args.output = argv[++i];
        break;
      case '--html':
        args.html = argv[++i];
        break;
      case '--headed':
        args.headless = false;
        break;
      case '--viewport':
        args.viewport = argv[++i];
        break;
      case '-c':
      case '--config':
        args.config = argv[++i];
        break;
      case '-p':
      case '--preset':
        args.preset = argv[++i];
        break;
      case '--init-config':
        args.initConfig = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '-v':
      case '--verbose':
        args.verbose = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          process.stderr.write(`❌ Error: Positional URL arguments are no longer supported.\n`);
          process.stderr.write(`   Please use the -u or --url flag to specify the URL, e.g.:\n`);
          process.stderr.write(`     aviary -u ${arg}\n`);
          process.stderr.write(`\n   Or run "aviary" with no arguments to launch the interactive Terminal User Interface (TUI).\n`);
          process.exit(1);
        }
    }
  }

  return args;
}

function printHelp() {
  process.stderr.write(`
aviary - End-to-end SEO checker tool

Usage: aviary -u <url> [options]

Options:
  -u, --url <url>        URL to check (required)
  -o, --output <file>    Save JSON report to file
  --html <file>          Save HTML report to file (beautiful visual report)
  --json                 Output raw JSON to stdout (no formatted text)
  -c, --config <file>    Configuration file (JSON or YAML)
  -p, --preset <name>    Use preset configuration (basic, advanced, strict)
  --init-config          Create a default configuration file
  --headed               Run browser in headed mode (default: headless)
  --viewport <WxH>       Set viewport size (e.g., 1920x1080 or 375x667)
  -v, --verbose          Show details for failed checks
  -h, --help             Show this help message

Environment Variables (12-Factor config):
  AVIARY_URL            Target URL (overridden by --url)
  AVIARY_HEADLESS       "true"/"false" (overridden by --headed)
  AVIARY_TIMEOUT        Timeout in milliseconds (default: 30000)
  AVIARY_VIEWPORT       Viewport "WxH" format (overridden by --viewport)
  AVIARY_PRESET         Preset name: basic/advanced/strict (overridden by --preset)
  AVIARY_OUTPUT         JSON output file path (overridden by --output)
  AVIARY_HTML_OUTPUT    HTML report path (overridden by --html)
  AVIARY_LOG_LEVEL      Log level: debug/info/warn/error (default: info)
  AVIARY_LLM_PROVIDER   LLM provider (default: stub)
  AVIARY_LLM_ENDPOINT   LLM endpoint URL (default: http://localhost:11434)
  AVIARY_LLM_MODEL      LLM model name (default: llama3.2)
  AVIARY_LLM_API_KEY    LLM API key (never logged)
  AVIARY_METRICS_PORT   Prometheus /metrics port (default: 9090)

Examples:
  aviary -u https://example.com
  aviary -u https://example.com -o report.json
  aviary -u https://example.com --viewport 375x667
  aviary -u https://example.com --headed
  aviary -u https://example.com --preset basic
  aviary -u https://example.com --config .aviary.json
  AVIARY_URL=https://example.com aviary --json
  aviary --init-config

Checks performed (235 checks across ${CHECKER_REGISTRY.length} categories):
  • Meta tags (title, description, Open Graph, canonical, viewport)
  • Heading structure (H1-H6 hierarchy)
  • Image optimization (alt text)
  • Performance metrics (load time, DOM content loaded)
  • Robots.txt validation
  • XML sitemap detection
  • Security (HTTPS, mixed content, security headers)
  • Structured data (JSON-LD, Microdata)
  • Social media tags (Twitter Cards, Facebook Open Graph)
  • Content analysis (word count, readability)
  • Links analysis (internal/external links)
  • UI elements (favicon, breadcrumbs, language tags)
  • Technical SEO (redirects, response codes, compression, duplicates)
  • Accessibility (ARIA labels, form labels, tab order)
  • URL factors (length, readability, keywords, structure)
  • Spam detection (hidden text, keyword stuffing, cloaking)
  • Page quality (duplicates, freshness, E-A-T signals)
  • Advanced images (responsive, lazy loading, WebP, dimensions)
  • Multimedia (videos, audio, accessibility, schema)
  • Core Web Vitals (LCP, CLS, FCP, TTFB, Total Blocking Time, page load, resource sizes, caching)
  • Analytics (Google Analytics, GTM, pixels, tracking, verification)
  • Mobile UX (tap targets, viewport, responsive, PWA, AMP)
  • Schema Validation (Product, Article, Organization, Event, etc.)
  • Resource Optimization (minification, CDN, fonts, HTTP/2)
  • Legal Compliance (privacy, GDPR, CCPA, cookies, copyright)
  • E-commerce (products, pricing, reviews, checkout, security)
  • Internationalization (hreflang, languages, localization, Unicode)
  • Heatmap & UX (predictive click maps, scroll depth, above-the-fold scoring)

For more information, visit: https://github.com/Ru1vly/e2e-seo
  `);
}

async function main() {
  // ── 12-Factor: Load config from environment first ──────────────────────────
  const envConfig = loadEnvConfig();
  const logger = createLogger((envConfig.logLevel as 'debug' | 'info' | 'warn' | 'error') || 'info');

  // If run with no arguments and no AVIARY_URL, launch the interactive TUI
  const hasNoArgs = process.argv.slice(2).length === 0;
  if (hasNoArgs && !envConfig.url) {
    const path = await import('path');
    const { spawn } = await import('child_process');
    const tuiPath = path.join(__dirname, 'tui');

    if (!fs.existsSync(tuiPath)) {
      process.stderr.write('❌ Error: TUI binary not found.\n');
      process.stderr.write('   Please run "npm run build" to compile the TUI dashboard.\n');
      process.exit(1);
    }

    // Spawn TUI inheriting standard streams
    const tuiProcess = spawn(tuiPath, ['--cli-path', path.join(__dirname, 'cli.js')], {
      stdio: 'inherit',
    });

    tuiProcess.on('exit', (code) => {
      process.exit(code || 0);
    });
    return;
  }

  const args = parseArgs();

  // Handle --init-config flag
  if (args.initConfig) {
    const { ConfigLoader } = await import('./config');
    const configPath = '.aviary.json';
    // CLI --preset > ENV AVIARY_PRESET > default
    const preset = (args.preset as 'basic' | 'advanced' | 'strict') || envConfig.preset || 'advanced';
    ConfigLoader.createDefaultConfig(configPath, preset);
    process.stderr.write(`✓ Created configuration file: ${configPath}\n`);
    process.stderr.write(`  Using preset: ${preset}\n`);
    process.stderr.write(`\nEdit the file to customize your SEO rules and settings.\n`);
    process.exit(0);
  }

  // Resolve effective URL: CLI --url > ENV AVIARY_URL
  const effectiveUrl = args.url || envConfig.url;

  if (args.help || !effectiveUrl) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  // Validate URL before launching browser
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(effectiveUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('URL must use http:// or https:// protocol');
    }
  } catch {
    const suggestion = effectiveUrl.startsWith('http') ? '' : ` Did you mean https://${effectiveUrl}?`;
    process.stderr.write(`❌ Invalid URL: "${effectiveUrl}".${suggestion}\n`);
    process.exit(1);
  }

  if (!args.json) {
    logger.info('Running SEO check', { url: effectiveUrl });
  }

  // Resolve viewport: CLI --viewport > ENV AVIARY_VIEWPORT > default
  const effectiveViewportStr = args.viewport || envConfig.viewport;
  let viewport = { width: 1920, height: 1080 };
  if (effectiveViewportStr) {
    const [width, height] = effectiveViewportStr.split('x').map(Number);
    if (width && height) {
      viewport = { width, height };
    }
  }

  // Resolve preset: CLI --preset > ENV AVIARY_PRESET > undefined
  const effectivePreset = args.preset || envConfig.preset;

  // Resolve timeout: ENV AVIARY_TIMEOUT > default (no CLI flag for this yet, per --help)
  const effectiveTimeout = envConfig.timeout;

  // Resolve headless: CLI --headed (args.headless=false) > ENV AVIARY_HEADLESS > default (true)
  let effectiveHeadless = true;
  if (args.headless === false) {
    effectiveHeadless = false;
  } else if (envConfig.headless !== undefined) {
    effectiveHeadless = envConfig.headless;
  }

  // Build configuration
  let config;
  if (effectivePreset) {
    config = { preset: effectivePreset as 'basic' | 'advanced' | 'strict' };
  }

  logger.debug('SEOChecker configuration', {
    url: effectiveUrl,
    headless: effectiveHeadless,
    viewport,
    preset: effectivePreset,
    configFile: args.config,
  });

  const checker = new SEOChecker({
    url: effectiveUrl,
    headless: effectiveHeadless,
    viewport,
    timeout: effectiveTimeout,
    configFile: args.config,
    config,
  });

  try {
    const report = await checker.check();

    // If JSON output is requested, ONLY print JSON to stdout (12-Factor: clean stdout)
    if (args.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      return;
    }

    // All diagnostic output goes to stderr
    process.stderr.write(`📊 SEO Report for ${report.url}\n\n`);
    process.stderr.write(`Score: ${report.score !== null ? `${report.score}/100` : 'N/A (no checks ran)'}\n`);
    process.stderr.write(`Timestamp: ${report.timestamp}\n\n`);

    process.stderr.write('Summary:\n');
    process.stderr.write(`  Total checks: ${report.summary.total}\n`);
    process.stderr.write(`  ✓ Passed: ${report.summary.passed}\n`);
    process.stderr.write(`  ✗ Failed: ${report.summary.failed}\n\n`);

    const sections = CHECKER_REGISTRY.map(({ key, label }) => ({
      name: label,
      checks: report.checks[key],
    }));

    sections.forEach((section) => {
      process.stderr.write(`${section.name}:\n`);
      section.checks.forEach((check) => {
        const icon = check.passed ? '✓' : '✗';
        const color = check.passed ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';

        // Display severity if present
        let severityBadge = '';
        if (check.severity && !check.passed) {
          const severityColors = {
            error: '\x1b[41m\x1b[37m', // Red background, white text
            warning: '\x1b[43m\x1b[30m', // Yellow background, black text
            info: '\x1b[44m\x1b[37m', // Blue background, white text
          };
          const severityColor = severityColors[check.severity as keyof typeof severityColors];
          severityBadge = ` ${severityColor} ${check.severity.toUpperCase()} ${reset}`;
        }

        process.stderr.write(`  ${color}${icon}${reset} ${check.message}${severityBadge}\n`);

        // --verbose: print details for failed checks
        if (args.verbose && !check.passed && check.details) {
          const detailLines = JSON.stringify(check.details, null, 2)
            .split('\n')
            .map((l) => `      ${l}`);
          process.stderr.write(detailLines.join('\n') + '\n');
        }
      });
      process.stderr.write('\n');
    });

    // Resolve output paths: CLI > ENV
    const effectiveOutput = args.output || envConfig.output;
    const effectiveHtmlOutput = args.html || envConfig.htmlOutput;

    if (effectiveOutput) {
      fs.writeFileSync(effectiveOutput, JSON.stringify(report, null, 2));
      logger.info('JSON report saved', { path: effectiveOutput });
    }

    if (effectiveHtmlOutput) {
      generateHtmlReport(report, effectiveHtmlOutput);
      logger.info('HTML report saved', { path: effectiveHtmlOutput });
    }

    // Exit with success code - tool ran successfully regardless of SEO score
    return;
  } catch (error) {
    const categorized = categorizeError(error);
    logger.debug('Audit failed (raw)', {
      message: categorized.message,
      category: categorized.context.category,
    });
    const friendly: Partial<Record<ErrorCategory, string>> = {
      [ErrorCategory.NETWORK]: `❌ Could not reach ${effectiveUrl}. Check the domain and your network connection.`,
      [ErrorCategory.TIMEOUT]: `❌ Timed out waiting for ${effectiveUrl} to load.`,
    };
    process.stderr.write(
      (friendly[categorized.context.category] ?? `❌ Audit failed: ${categorized.message}`) + '\n'
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
