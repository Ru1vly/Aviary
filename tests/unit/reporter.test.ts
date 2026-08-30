import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateHtmlReport, renderHtmlReport } from '../../src/reporter';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';
import type { SEOReport, SEOCheckResult } from '../../src/types';

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
