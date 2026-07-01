#!/usr/bin/env node

import { SEOChecker } from './index';
import { generateHtmlReport } from './reporter';
import * as fs from 'fs';

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
        if (!arg.startsWith('-') && !args.url) {
          args.url = arg;
        }
    }
  }

  return args;
}

function printHelp() {
  console.log(`
e2e-seo - End-to-end SEO checker tool

Usage: e2e-seo [options] <url>

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

Examples:
  e2e-seo https://example.com
  e2e-seo -u https://example.com -o report.json
  e2e-seo https://example.com --viewport 375x667
  e2e-seo https://example.com --headed
  e2e-seo https://example.com --preset basic
  e2e-seo https://example.com --config .e2e-seo.json
  e2e-seo --init-config

Checks performed (260+ checks across 27 categories):
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
  • Core Web Vitals (page load, resources, optimization, caching)
  • Analytics (Google Analytics, GTM, pixels, tracking, verification)
  • Mobile UX (tap targets, viewport, responsive, PWA, AMP)
  • Schema Validation (Product, Article, Organization, Event, etc.)
  • Resource Optimization (minification, CDN, fonts, HTTP/2)
  • Legal Compliance (privacy, GDPR, CCPA, cookies, copyright)
  • E-commerce (products, pricing, reviews, checkout, security)
  • Internationalization (hreflang, languages, localization, Unicode)

For more information, visit: https://github.com/yourusername/e2e-seo
  `);
}

async function main() {
  const args = parseArgs();

  // Handle --init-config flag
  if (args.initConfig) {
    const { ConfigLoader } = await import('./config');
    const configPath = '.e2e-seo.json';
    const preset = (args.preset as 'basic' | 'advanced' | 'strict') || 'advanced';
    ConfigLoader.createDefaultConfig(configPath, preset);
    console.log(`✓ Created configuration file: ${configPath}`);
    console.log(`  Using preset: ${preset}`);
    console.log(`\nEdit the file to customize your SEO rules and settings.`);
    process.exit(0);
  }

  if (args.help || !args.url) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  // Validate URL before launching browser
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(args.url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('URL must use http:// or https:// protocol');
    }
  } catch {
    const suggestion = args.url.startsWith('http') ? '' : ` Did you mean https://${args.url}?`;
    console.error(`❌ Invalid URL: "${args.url}".${suggestion}`);
    process.exit(1);
  }

  if (!args.json) {
    console.log('🔍 Running SEO check...\n');
  }

  let viewport = { width: 1920, height: 1080 };
  if (args.viewport) {
    const [width, height] = args.viewport.split('x').map(Number);
    if (width && height) {
      viewport = { width, height };
    }
  }

  // Build configuration
  let config;
  if (args.preset) {
    config = { preset: args.preset as 'basic' | 'advanced' | 'strict' };
  }

  const checker = new SEOChecker({
    url: args.url!,
    headless: args.headless !== false,
    viewport,
    configFile: args.config,
    config,
  });

  try {
    const report = await checker.check();

    // If JSON output is requested, just print JSON and exit
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    }

    console.log(`📊 SEO Report for ${report.url}\n`);
    console.log(`Score: ${report.score}/100`);
    console.log(`Timestamp: ${report.timestamp}\n`);

    console.log('Summary:');
    console.log(`  Total checks: ${report.summary.total}`);
    console.log(`  ✓ Passed: ${report.summary.passed}`);
    console.log(`  ✗ Failed: ${report.summary.failed}\n`);

    const sections = [
      { name: 'Meta Tags', checks: report.checks.metaTags },
      { name: 'Headings', checks: report.checks.headings },
      { name: 'Images', checks: report.checks.images },
      { name: 'Performance', checks: report.checks.performance },
      { name: 'Robots.txt', checks: report.checks.robotsTxt },
      { name: 'Sitemap', checks: report.checks.sitemap },
      { name: 'Security', checks: report.checks.security },
      { name: 'Structured Data', checks: report.checks.structuredData },
      { name: 'Social Media', checks: report.checks.socialMedia },
      { name: 'Content', checks: report.checks.content },
      { name: 'Links', checks: report.checks.links },
      { name: 'UI Elements', checks: report.checks.uiElements },
      { name: 'Technical SEO', checks: report.checks.technical },
      { name: 'Accessibility', checks: report.checks.accessibility },
      { name: 'URL Factors', checks: report.checks.urlFactors },
      { name: 'Spam Detection', checks: report.checks.spamDetection },
      { name: 'Page Quality', checks: report.checks.pageQuality },
      { name: 'Advanced Images', checks: report.checks.advancedImages },
      { name: 'Multimedia', checks: report.checks.multimedia },
      { name: 'Core Web Vitals', checks: report.checks.coreWebVitals },
      { name: 'Analytics & Tracking', checks: report.checks.analytics },
      { name: 'Mobile UX', checks: report.checks.mobileUX },
      { name: 'Schema Validation', checks: report.checks.schemaValidation },
      { name: 'Resource Optimization', checks: report.checks.resourceOptimization },
      { name: 'Legal & Compliance', checks: report.checks.legalCompliance },
      { name: 'E-commerce', checks: report.checks.ecommerce },
      { name: 'Internationalization', checks: report.checks.internationalization },
      { name: 'Heatmap & UX', checks: report.checks.heatmap },
    ];

    sections.forEach((section) => {
      console.log(`${section.name}:`);
      section.checks.forEach((check) => {
        const icon = check.passed ? '✓' : '✗';
        const color = check.passed ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';

        // Display severity if present
        let severityBadge = '';
        if (check.severity && !check.passed) {
          const severityColors = {
            error: '\x1b[41m\x1b[37m',   // Red background, white text
            warning: '\x1b[43m\x1b[30m', // Yellow background, black text
            info: '\x1b[44m\x1b[37m',    // Blue background, white text
          };
          const severityColor = severityColors[check.severity];
          severityBadge = ` ${severityColor} ${check.severity.toUpperCase()} ${reset}`;
        }

        console.log(`  ${color}${icon}${reset} ${check.message}${severityBadge}`);

        // --verbose: print details for failed checks
        if (args.verbose && !check.passed && check.details) {
          const detailLines = JSON.stringify(check.details, null, 2)
            .split('\n')
            .map((l) => `      ${l}`);
          console.log(detailLines.join('\n'));
        }
      });
      console.log('');
    });

    if (args.output) {
      fs.writeFileSync(args.output, JSON.stringify(report, null, 2));
      console.log(`\n💾 JSON report saved to ${args.output}`);
    }

    if (args.html) {
      generateHtmlReport(report, args.html);
      console.log(`\n🌐 HTML report saved to ${args.html}`);
    }

    // Exit with success code - tool ran successfully regardless of SEO score
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
