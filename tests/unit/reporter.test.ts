import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generateBatchCsvReport,
  generateBatchHtmlReport,
  generateBatchJunitReport,
  generateBatchMarkdownReport,
  generateBatchSarifReport,
  generateCsvReport,
  generateJunitReport,
  generateMarkdownReport,
  generateSarifReport,
  generateHtmlReport,
  renderBatchCsvReport,
  renderBatchHtmlReport,
  renderBatchJunitReport,
  renderBatchMarkdownReport,
  renderBatchSarifReport,
  renderCsvReport,
  renderHtmlReport,
  renderJunitReport,
  renderMarkdownReport,
  renderSarifReport,
  renderSEOCompetitorMarkdownReport,
} from '../../src/reporter';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';
import type { SEOAuditBatchReport, SEOReport, SEOCheckResult } from '../../src/types';

/** A full SEOReport.checks object with every registry key present as []. */
function emptyChecks(): SEOReport['checks'] {
  return Object.fromEntries(CHECKER_REGISTRY.map((c) => [c.key, []])) as SEOReport['checks'];
}

function baseReport(overrides: Partial<SEOReport> = {}): SEOReport {
  return {
    url: 'https://example.com',
    timestamp: '2026-01-01T00:00:00.000Z',
    score: 82,
    summary: { total: 0, passed: 0, failed: 0 },
    checks: emptyChecks(),
    ...overrides,
  };
}

function check(overrides: Partial<SEOCheckResult> = {}): SEOCheckResult {
  return { passed: true, message: 'A check message', ...overrides };
}

describe('renderHtmlReport', () => {
  it('renders a valid HTML document with the report URL and score', () => {
    const html = renderHtmlReport(baseReport());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('https://example.com');
    expect(html).toContain('82');
  });

  it('escapes HTML special characters in the URL and check messages', () => {
    const report = baseReport({
      url: 'https://example.com/<script>alert(1)</script>',
      checks: {
        ...emptyChecks(),
        metaTags: [check({ passed: false, message: '<b>bold</b> & "quoted"' })],
      },
      summary: { total: 1, passed: 0, failed: 1 },
    });
    const html = renderHtmlReport(report);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;');
  });

  it('renders "N/A" instead of a score when report.score is null', () => {
    const html = renderHtmlReport(baseReport({ score: null }));
    expect(html).toContain('N/A');
    // Must not render the literal string "null" as if it were a score.
    expect(html).not.toMatch(/score-number">null</);
  });

  it('shows the celebratory message when nothing failed', () => {
    const report = baseReport({
      checks: { ...emptyChecks(), metaTags: [check({ passed: true })] },
      summary: { total: 1, passed: 1, failed: 0 },
    });
    const html = renderHtmlReport(report);
    expect(html).toContain('All checks passed!');
  });

  it('lists failed checks with a severity badge and truncates past 20 with a "more" note', () => {
    const failedChecks = Array.from({ length: 25 }, (_, i) =>
      check({ passed: false, message: `Issue number ${i}`, severity: 'error' })
    );
    const report = baseReport({
      checks: { ...emptyChecks(), metaTags: failedChecks },
      summary: { total: 25, passed: 0, failed: 25 },
    });
    const html = renderHtmlReport(report);
    expect(html).toContain('top 20 of 25');
    expect(html).toContain('and 5 more issues');
    expect(html).toContain('badge-error');
  });

  it('renders a rule name badge and JSON details for a failed check that has them', () => {
    const report = baseReport({
      checks: {
        ...emptyChecks(),
        security: [
          check({
            passed: false,
            name: 'https-enabled',
            severity: 'warning',
            details: { protocol: 'http' },
          }),
        ],
      },
      summary: { total: 1, passed: 0, failed: 1 },
    });
    const html = renderHtmlReport(report);
    expect(html).toContain('https-enabled');
    expect(html).toContain('badge-warning');
    expect(html).toContain('&quot;protocol&quot;');
  });

  it('does not render details for a passing check even if details are present', () => {
    const report = baseReport({
      checks: {
        ...emptyChecks(),
        security: [check({ passed: true, details: { protocol: 'https' } })],
      },
      summary: { total: 1, passed: 1, failed: 0 },
    });
    const html = renderHtmlReport(report);
    // "check-details" itself also appears in the static <style> block's CSS
    // selector regardless of content, so assert against the rendered tag.
    expect(html).not.toContain('<pre class="check-details">');
  });

  it('renders "No checks ran" for an empty category', () => {
    const html = renderHtmlReport(baseReport());
    expect(html).toContain('No checks ran for this category.');
  });

  it('treats a category with zero checks as 100% in the overview grid, not 0%', () => {
    // Every category starts empty in baseReport(); the overview tile for
    // an empty category should read 100%, matching the `t > 0 ? ... : 100`
    // fallback — an empty category isn't a failing one.
    const html = renderHtmlReport(baseReport());
    expect(html).toContain('100%');
  });
});

describe('generateHtmlReport', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aviary-reporter-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the same HTML that renderHtmlReport returns', () => {
    const report = baseReport();
    const outputPath = path.join(tmpDir, 'report.html');
    generateHtmlReport(report, outputPath);
    const written = fs.readFileSync(outputPath, 'utf8');
    expect(written).toBe(renderHtmlReport(report));
  });

  it('creates the output directory if it does not exist yet', () => {
    const outputPath = path.join(tmpDir, 'nested', 'dir', 'report.html');
    generateHtmlReport(baseReport(), outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});

describe('offline report formats', () => {
  it('renders single-page and batch reports as Markdown, CSV, JUnit, SARIF, and HTML', () => {
    const report = baseReport({
      checks: {
        ...emptyChecks(),
        metaTags: [check({ passed: false, name: 'title-present', severity: 'warning' })],
      },
      summary: { total: 1, passed: 0, failed: 1 },
    });
    const batch: SEOAuditBatchReport = {
      timestamp: '2026-01-02T00:00:00.000Z',
      summary: {
        requestedUrls: 2,
        completedUrls: 1,
        failedUrls: 1,
        passedChecks: 0,
        failedChecks: 1,
        averageScore: 82,
      },
      results: [
        { status: 'complete', url: report.url, report },
        { status: 'error', url: 'https://example.com/unavailable', error: 'Timeout < 1s' },
      ],
    };

    expect(renderMarkdownReport(report)).toContain('# Aviary SEO report');
    expect(renderCsvReport(report)).toContain('title-present');
    expect(renderJunitReport(report)).toContain('<testsuite');
    expect(JSON.parse(renderSarifReport(report))).toMatchObject({ version: '2.1.0' });
    expect(
      renderSEOCompetitorMarkdownReport(report, [baseReport({ url: 'https://other.test' })])
    ).toContain('Aviary competitor audit comparison');

    expect(renderBatchHtmlReport(batch)).toContain('https://example.com/unavailable');
    expect(renderBatchMarkdownReport(batch)).toContain('Aviary multi-page SEO report');
    expect(renderBatchJunitReport(batch)).toContain('Aviary multi-page audit');
    expect(renderBatchCsvReport(batch)).toContain('https://example.com/unavailable');
    expect(JSON.parse(renderBatchSarifReport(batch))).toMatchObject({ version: '2.1.0' });
  });

  it('writes single-page and batch artifacts into nested output paths', () => {
    const report = baseReport();
    const batch: SEOAuditBatchReport = {
      timestamp: report.timestamp,
      summary: {
        requestedUrls: 1,
        completedUrls: 1,
        failedUrls: 0,
        passedChecks: 0,
        failedChecks: 0,
        averageScore: report.score,
      },
      results: [{ status: 'complete', url: report.url, report }],
    };
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aviary-report-formats-'));
    const targets = {
      csv: path.join(outputDir, 'single', 'report.csv'),
      junit: path.join(outputDir, 'single', 'report.xml'),
      markdown: path.join(outputDir, 'single', 'report.md'),
      sarif: path.join(outputDir, 'single', 'report.sarif'),
      batchHtml: path.join(outputDir, 'batch', 'report.html'),
      batchCsv: path.join(outputDir, 'batch', 'report.csv'),
      batchJunit: path.join(outputDir, 'batch', 'report.xml'),
      batchMarkdown: path.join(outputDir, 'batch', 'report.md'),
      batchSarif: path.join(outputDir, 'batch', 'report.sarif'),
    };
    try {
      generateCsvReport(report, targets.csv);
      generateJunitReport(report, targets.junit);
      generateMarkdownReport(report, targets.markdown);
      generateSarifReport(report, targets.sarif);
      generateBatchHtmlReport(batch, targets.batchHtml);
      generateBatchCsvReport(batch, targets.batchCsv);
      generateBatchJunitReport(batch, targets.batchJunit);
      generateBatchMarkdownReport(batch, targets.batchMarkdown);
      generateBatchSarifReport(batch, targets.batchSarif);

      for (const target of Object.values(targets)) expect(fs.existsSync(target)).toBe(true);
      expect(JSON.parse(fs.readFileSync(targets.sarif, 'utf8'))).toMatchObject({
        version: '2.1.0',
      });
      expect(JSON.parse(fs.readFileSync(targets.batchSarif, 'utf8'))).toMatchObject({
        version: '2.1.0',
      });
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
