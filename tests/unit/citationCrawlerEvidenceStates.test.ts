import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { analyzeAiCrawlerAccessLog } from '../../src/geo/aiCrawlerLogs';
import {
  analyzeAiAnswerCitationObservations,
  correlateAiAnswerCitationObservationsWithAudit,
  correlateAiAnswerCitationObservationsWithCrawlerLogs,
} from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationObservationsReporter';
import type { SiteWideGeoAnalysis } from '../../src/sitewide';

const paths = ['/guide', '/canonical', '/duplicate', '/ambiguous', '/unseen'];
function report() {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: paths.map((path) => ({
        provider: 'Search',
        prompt: `Explain ${path}`,
        observedAt: '2026-10-02T00:00:00Z',
        citedUrls: [`https://example.com${path}`],
        citationListComplete: true,
      })),
    },
    ['example.com'],
    '2026-10-05T00:00:00Z'
  );
}
function log(date: string | undefined, token = 'GPTBot') {
  return analyzeAiCrawlerAccessLog(
    JSON.stringify({
      ...(date ? { timestamp: date } : {}),
      path: '/guide?secret=PRIVATE_QUERY',
      status: 200,
      user_agent: `${token} PRIVATE_AGENT`,
      client_ip: '203.0.113.17',
    })
  );
}
function audited() {
  const site = JSON.parse(
    readFileSync(
      new URL(
        '../../examples/geo-audited-page-provider-inventory.sitewide.synthetic.example.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as SiteWideGeoAnalysis;
  const page = site.pageSummaries[0];
  site.pageSummaries = [
    { ...page, url: 'https://example.com/guide' },
    { ...page, url: 'https://example.com/alias', canonicalUrl: 'https://example.com/canonical' },
    { ...page, url: 'https://example.com/duplicate' },
    { ...page, url: 'https://example.com/duplicate' },
    { ...page, url: 'https://example.com/alias-a', canonicalUrl: 'https://example.com/ambiguous' },
    { ...page, url: 'https://example.com/alias-b', canonicalUrl: 'https://example.com/ambiguous' },
  ];
  return correlateAiAnswerCitationObservationsWithAudit(report(), site);
}
function csvRecords(csv: string) {
  const rows = csv
    .trimEnd()
    .split('\r\n')
    .map((line) =>
      [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
    );
  for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
  return rows.slice(1).map((row) => Object.fromEntries(rows[0].map((key, i) => [key, row[i]])));
}
function dashboard(html: string) {
  const win = new Window();
  win.document.write(html);
  for (const table of win.document.querySelectorAll('table')) {
    const count = table.querySelectorAll(':scope > thead > tr:last-child > th').length;
    for (const row of table.querySelectorAll(':scope > tbody > tr'))
      expect(
        [...row.children].reduce((n, cell) => n + (Number(cell.getAttribute('colspan')) || 1), 0)
      ).toBe(count);
  }
  expect(html).not.toMatch(/PRIVATE_QUERY|PRIVATE_AGENT|203\.0\.113\.17|NaN%|Infinity%/);
}

describe('citation, audit and crawler evidence joins', () => {
  it.each([
    ['2026-10-01T00:00:00Z', 'crawler-before-citation-sample', '-1'],
    ['2026-10-02T00:00:00Z', 'observed-ranges-overlap', '0'],
    ['2026-10-03T00:00:00Z', 'crawler-after-citation-sample', '1'],
    [undefined, 'unknown', ''],
  ])('keeps %s timing descriptive and exact paths separate', (date, relation, days) => {
    const joined = correlateAiAnswerCitationObservationsWithCrawlerLogs(
      audited(),
      [log(date)],
      'https://example.com'
    );
    expect(joined.crawlerLogCorrelation).toMatchObject({
      citedPagesReviewed: 5,
      citedPagesWithCrawlerRequests: 1,
      citationEventsOnObservedPaths: 1,
      citedPagePathCoveragePercent: 20,
    });
    expect(joined.citedPages.map((p) => p.auditMatch?.state).sort()).toEqual(
      [
        'ambiguous-audit-url',
        'ambiguous-canonical',
        'exact-url',
        'not-found',
        'unique-canonical',
      ].sort()
    );
    const rows = csvRecords(renderer.renderAiAnswerCitationCrawlerLogMatchesCsv(joined));
    expect(rows.find((r) => r.page_url.endsWith('/guide'))).toMatchObject({
      temporal_relation_to_citation_sample: relation,
      days_from_latest_citation_to_last_request: days,
    });
    expect(rows.filter((r) => r.log_state === 'path-not-observed')).toHaveLength(4);
    dashboard(renderer.renderAiAnswerCitationObservationHtml(joined));
    expect(
      csvRecords(renderer.renderAiAnswerCitationAuditSignalsCsv(joined)).length
    ).toBeGreaterThan(0);
  });
  it('retains bounded matches and exposes caps without calling unseen paths blocked', () => {
    const analysis = log('2026-10-01T00:00:00Z');
    analysis.crawlers[0].pathsTruncated = true;
    const joined = correlateAiAnswerCitationObservationsWithCrawlerLogs(
      report(),
      Array.from({ length: 51 }, () => analysis),
      'https://example.com'
    );
    const page = joined.citedPages.find((p) => p.url.endsWith('/guide'))!;
    expect(page.crawlerLogMatches).toHaveLength(50);
    expect(page.crawlerLogMatchesTruncated).toBe(true);
    expect(joined.crawlerLogCorrelation?.crawlerPathsTruncated).toBe(true);
    expect(joined.citedPages.find((p) => p.url.endsWith('/unseen'))?.crawlerLogState).toBe(
      'path-not-observed'
    );
    dashboard(renderer.renderAiAnswerCitationObservationHtml(joined));
    expect(csvRecords(renderer.renderAiAnswerCitationCrawlerLogMatchesCsv(joined))).toHaveLength(
      54
    );
  });
  it('ignores off-origin paths and preserves null denominators for no cited pages', () => {
    const analysis = log(undefined);
    analysis.crawlers[0].paths[0].path = 'https://elsewhere.example/guide';
    const joined = correlateAiAnswerCitationObservationsWithCrawlerLogs(
      report(),
      [analysis],
      'https://example.com'
    );
    expect(joined.crawlerLogCorrelation?.citedPagesWithCrawlerRequests).toBe(0);
    const empty = report();
    empty.citedPages = [];
    expect(
      correlateAiAnswerCitationObservationsWithCrawlerLogs(empty, [analysis], 'https://example.com')
        .crawlerLogCorrelation
    ).toMatchObject({
      citedPagePathCoveragePercent: null,
      retainedCitationEventCoveragePercent: null,
    });
  });
  it.each([
    'invalid',
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com?q=1',
    'https://example.com#fragment',
  ])('rejects invalid origin %s', (origin) =>
    expect(() =>
      correlateAiAnswerCitationObservationsWithCrawlerLogs(report(), [log(undefined)], origin)
    ).toThrow(/origin/)
  );
  it('requires bounded versioned reports and explicit correlation before export', () => {
    expect(() =>
      correlateAiAnswerCitationObservationsWithCrawlerLogs(report(), [], 'https://example.com')
    ).toThrow(/1 to 100/);
    expect(() =>
      correlateAiAnswerCitationObservationsWithCrawlerLogs(
        report(),
        Array.from({ length: 101 }, () => log(undefined)),
        'https://example.com'
      )
    ).toThrow(/1 to 100/);
    const wrong = report();
    wrong.schemaVersion = 2 as never;
    expect(() =>
      correlateAiAnswerCitationObservationsWithCrawlerLogs(
        wrong,
        [log(undefined)],
        'https://example.com'
      )
    ).toThrow(/version 1/);
    const bad = log(undefined);
    bad.schemaVersion = 2 as never;
    expect(() =>
      correlateAiAnswerCitationObservationsWithCrawlerLogs(report(), [bad], 'https://example.com')
    ).toThrow(/version 1/);
    expect(() => renderer.renderAiAnswerCitationCrawlerLogMatchesCsv(report())).toThrow(
      /crawler-report/
    );
  });
});
