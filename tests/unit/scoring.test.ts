import { describe, it, expect } from 'vitest';
import {
  calculateWeightedScore,
  compareSEOAuditBatches,
  compareSEOReports,
  evaluateSEOAuditGeoChangeGate,
  filterSEOAuditGeoSignalChanges,
  renderGeoSignalChangesCsv,
  type SEOAuditBatchReport,
  type SEOAuditBatchComparison,
  type SEOReportComparison,
} from '../../src/scoring';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';
import type { SEOCheckResult, SEOReport } from '../../src/types';
import scoringParityFixture from '../fixtures/scoring-parity.json';

function check(passed: boolean, severity?: SEOCheckResult['severity']): SEOCheckResult {
  return { passed, message: 'x', severity };
}

function report(
  url: string,
  checks: Partial<SEOReport['checks']> = {},
  score: number | null = 80
): SEOReport {
  const emptyChecks = Object.fromEntries(CHECKER_REGISTRY.map(({ key }) => [key, []])) as Record<
    string,
    SEOCheckResult[]
  >;
  return {
    url,
    timestamp: '2026-10-01T00:00:00.000Z',
    checks: { ...emptyChecks, ...checks },
    score,
    summary: { total: 0, passed: 0, failed: 0 },
  } as SEOReport;
}

describe('calculateWeightedScore', () => {
  it('returns null, not a magic 0 or 100, when there is nothing to weigh', () => {
    expect(calculateWeightedScore([])).toBeNull();
  });

  it('returns 100 when every check passed', () => {
    expect(
      calculateWeightedScore([check(true, 'error'), check(true, 'warning'), check(true, 'info')])
    ).toBe(100);
  });

  it('returns 0 when every check failed', () => {
    expect(
      calculateWeightedScore([check(false, 'error'), check(false, 'warning'), check(false, 'info')])
    ).toBe(0);
  });

  it('weights error/warning/info at 3/1/0.5', () => {
    // One passed error (weight 3) out of error+warning+info (3+1+0.5=4.5) → 3/4.5 = 66.67% → 67
    const score = calculateWeightedScore([
      check(true, 'error'),
      check(false, 'warning'),
      check(false, 'info'),
    ]);
    expect(score).toBe(67);
  });

  it('treats an unset severity as warning weight (1)', () => {
    expect(calculateWeightedScore([check(true), check(false, 'warning')])).toBe(50);
  });

  // Shared with engine/src/lib.rs's own parity test (`cargo test scoring_parity`),
  // which loads this exact file — a change to either engine's weights that isn't
  // mirrored in the other fails whichever test runs against the stale value.
  describe('parity fixture (tests/fixtures/scoring-parity.json, shared with the Rust engine)', () => {
    for (const testCase of scoringParityFixture.cases) {
      it(testCase.name, () => {
        const checks = testCase.checks.map((c) =>
          check(c.passed, c.severity as SEOCheckResult['severity'])
        );
        expect(calculateWeightedScore(checks)).toBe(testCase.expectedScore);
      });
    }
  });
});

describe('GEO baseline change gates', () => {
  const changes = [
    {
      url: 'https://example.com/page',
      signal: 'Googlebot allowed',
      before: 'allowed',
      after: 'blocked',
    },
    {
      url: 'https://example.com/other',
      signal: 'noindex',
      before: 'false',
      after: 'true',
    },
  ];

  it('filters changes by exact signal, URL, and before/after transition', () => {
    expect(filterSEOAuditGeoSignalChanges(changes)).toEqual(changes);
    expect(
      filterSEOAuditGeoSignalChanges(changes, {
        signals: [' Googlebot allowed '],
        urls: ['https://example.com/page'],
        transitions: [{ before: ' allowed ', after: ' blocked ' }],
      })
    ).toEqual([changes[0]]);
    expect(filterSEOAuditGeoSignalChanges(changes, { signals: ['googlebot allowed'] })).toEqual([]);

    for (const filters of [
      { signals: [] },
      { signals: [' '] },
      { urls: [] },
      { urls: [''] },
      { transitions: [] },
      { transitions: [{ before: 'allowed', after: ' ' }] },
    ]) {
      expect(() => filterSEOAuditGeoSignalChanges(changes, filters)).toThrow();
    }
  });

  it('fails closed for missing comparable data, selected changes, and failed audit URLs', () => {
    const single = {
      geoCompared: false,
      geoChanges: changes,
    } as SEOReportComparison;
    const result = evaluateSEOAuditGeoChangeGate(single, {
      filters: { signals: ['noindex'] },
      currentFailedUrls: 2,
      baselineFailedUrls: 1,
    });
    expect(result).toMatchObject({
      passed: false,
      matchedPages: 1,
      comparablePages: 0,
      unassessedPages: 1,
      totalChanges: 2,
      matchingChanges: [changes[1]],
      currentFailedUrls: 2,
      baselineFailedUrls: 1,
    });
    expect(result.failureReasons.map(({ code }) => code)).toEqual([
      'no-comparable-data',
      'selected-changes',
      'current-audit-errors',
      'baseline-audit-errors',
    ]);
    expect(
      evaluateSEOAuditGeoChangeGate({ ...single, geoCompared: true, geoChanges: [] }).passed
    ).toBe(true);
    expect(() => evaluateSEOAuditGeoChangeGate(single, { currentFailedUrls: -1 })).toThrow(
      /non-negative integer/
    );
  });

  it('counts batch comparable and unassessed pages and exports formula-safe CSV', () => {
    const comparison = {
      schemaVersion: 1,
      baselineTimestamp: '2026-09-01T00:00:00.000Z',
      currentTimestamp: '2026-10-01T00:00:00.000Z',
      geoChanges: [{ ...changes[0], url: '=HYPERLINK("https://bad.example")' }],
      geoComparedPages: 2,
      geoUnassessedPages: 1,
      geoComparedBasis: 'search-crawler-access-and-preview-controls',
    } as SEOAuditBatchComparison;
    const result = evaluateSEOAuditGeoChangeGate(comparison);
    expect(result).toMatchObject({
      passed: false,
      matchedPages: 3,
      comparablePages: 2,
      unassessedPages: 1,
      totalChanges: 1,
    });
    expect(result.failureReasons.map(({ code }) => code)).toEqual([
      'unassessed-pages',
      'selected-changes',
    ]);

    const csv = renderGeoSignalChangesCsv(comparison);
    expect(csv.split('\n')).toHaveLength(4);
    expect(csv).toContain("'=HYPERLINK(");
    expect(csv.startsWith('"row_type","schema_version","baseline_timestamp"')).toBe(true);
  });
});

describe('saved report comparisons', () => {
  it('compares repeated findings as a multiset and detects crawler/preview control changes', () => {
    const baseline = report(
      'https://example.com/page',
      {
        metaTags: [
          { passed: false, name: 'title', message: 'Old title', severity: 'error' },
          { passed: false, name: 'description', message: 'Missing description' },
        ],
        geo: [
          {
            passed: true,
            name: 'ai-search-crawler-access',
            message: 'Crawler access measured',
            details: {
              crawlers: [
                {
                  token: 'GPTBot',
                  allowed: true,
                  matchedAgents: ['*'],
                  matchedRule: { directive: 'allow', pattern: '/' },
                },
              ],
            },
          },
          {
            passed: true,
            name: 'ai-search-preview-controls',
            message: 'Preview controls measured',
            details: { noindex: false, noSnippet: false, dataNoSnippetWords: 0 },
          },
        ],
      },
      65
    );
    const current = report(
      'https://example.com/page',
      {
        metaTags: [
          { passed: false, name: 'title', message: 'New title', severity: 'error' },
          { passed: false, name: 'title', message: 'Second title finding', severity: 'warning' },
        ],
        geo: [
          {
            passed: true,
            name: 'ai-search-crawler-access',
            message: 'Crawler access measured',
            details: {
              crawlers: [
                {
                  token: 'GPTBot',
                  allowed: false,
                  matchedAgents: ['GPTBot'],
                  matchedRule: { directive: 'disallow', pattern: '/' },
                },
              ],
            },
          },
          {
            passed: true,
            name: 'ai-search-preview-controls',
            message: 'Preview controls measured',
            details: { noindex: true, noSnippet: true, dataNoSnippetWords: 12 },
          },
        ],
      },
      75
    );

    const comparison = compareSEOReports(current, baseline);
    expect(comparison.scoreDelta).toBe(10);
    expect(comparison.newFailures).toEqual([
      {
        category: 'metaTags',
        name: 'title',
        message: 'Second title finding',
        severity: 'warning',
      },
    ]);
    expect(comparison.resolvedFailures).toEqual([
      {
        category: 'metaTags',
        name: 'description',
        message: 'Missing description',
        severity: undefined,
      },
    ]);
    expect(comparison.geoCompared).toBe(true);
    expect(comparison.geoChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signal: 'GPTBot search access',
          before: 'allowed',
          after: 'blocked',
        }),
        expect.objectContaining({
          signal: 'Page indexing',
          before: 'not restricted',
          after: 'restricted',
        }),
        expect.objectContaining({
          signal: 'Visible words in data-nosnippet regions',
          before: '0 word(s)',
          after: '12 word(s)',
        }),
      ])
    );

    const scoped = report('https://example.com/page', {}, 75);
    scoped.categories = ['metaTags'];
    expect(() => compareSEOReports(scoped, baseline)).toThrow(/different category selections/);
  });

  it('preserves duplicate page audits when comparing batch baselines', () => {
    const url = 'https://example.com/page';
    const currentPage = report(url, {}, 90);
    const priorPage = report(url, {}, 70);
    const batch = (results: SEOAuditBatchReport['results'], averageScore: number) =>
      ({
        timestamp: '2026-10-01T00:00:00.000Z',
        summary: {
          requestedUrls: results.length,
          completedUrls: results.filter((item) => item.status === 'complete').length,
          failedUrls: results.filter((item) => item.status === 'error').length,
          passedChecks: 0,
          failedChecks: 0,
          averageScore,
        },
        results,
      }) as SEOAuditBatchReport;

    const comparison = compareSEOAuditBatches(
      batch([{ status: 'complete', url, report: currentPage }], 90),
      batch(
        [
          { status: 'complete', url, report: priorPage },
          { status: 'complete', url, report: priorPage },
        ],
        70
      )
    );
    expect(comparison.geoComparedPages).toBe(0);
    expect(comparison.geoUnassessedPages).toBe(1);
    expect(comparison.removedUrls).toEqual([url]);
    expect(comparison.scoreDelta).toBeNull();
  });
});
