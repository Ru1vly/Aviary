import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import * as families from '../../src/geo/aiCrawlerPathFamilies';
import type { SiteWideGeoAnalysis, SiteWideGeoPageSummary } from '../../src/sitewide';
import {
  analyzeAiCrawlerAccessLog,
  correlateAiCrawlerAccessLogWithGeoAudit,
  analyzeAiCrawlerSitemapRecrawlCoverage,
  analyzeAiCrawlerRobotsAuditReplay,
  compareAiCrawlerRobotsAuditReplays,
} from '../../src/geo/aiCrawlerLogs';
import {
  renderAiCrawlerAccessLogHtml,
  renderAiCrawlerRobotsAuditReplayHtml,
} from '../../src/geo/aiCrawlerLogsReporter';

const tokens = [
  'OAI-SearchBot',
  'GPTBot',
  'Applebot',
  'Amazonbot',
  'Claude-SearchBot',
  'Claude-User',
  'ChatGPT-User',
  'PerplexityBot',
  'CustomIndexer',
];
const source = tokens
  .flatMap((user_agent) =>
    ['/guide', '/ambiguous', '/missing'].map((path, index) =>
      JSON.stringify({
        timestamp: `2026-10-01T0${index}:00:00Z`,
        path: `${path}?utm_source=chatgpt.com&secret=PRIVATE_QUERY`,
        status: [200, 302, 503][index],
        user_agent: `${user_agent} PRIVATE_AGENT`,
        client_ip: '203.0.113.17',
        content_type: 'text/html',
      })
    )
  )
  .join('\n');
const log = analyzeAiCrawlerAccessLog(source, { customTokens: ['CustomIndexer'] });
function site(measured: boolean, positive: boolean): SiteWideGeoAnalysis {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        '../../examples/geo-audited-page-provider-inventory.sitewide.synthetic.example.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as SiteWideGeoAnalysis;
  const access = tokens.map((token) => ({
    token,
    allowed: positive,
    matchedRule: {
      directive: positive ? ('allow' as const) : ('disallow' as const),
      pattern: '/guide',
      line: 2,
    },
  }));
  const page: SiteWideGeoPageSummary = {
    url: 'https://example.com/guide',
    geoAssessed: measured,
    signalCoverage: {
      searchCrawlerAccess: measured ? 'measured' : 'not-run',
      dataUseCrawlerPolicy: measured ? 'measured' : 'not-assessed',
      userInitiatedFetchAccess: measured ? 'measured' : 'not-run',
      previewControls: measured ? 'measured' : 'not-run',
      answerContent: measured ? 'measured' : 'not-assessed',
      sourceRenderedContent: measured ? 'measured' : 'not-run',
      citationEvidence: measured ? 'measured' : 'not-run',
      optionalLlmsFiles: 'not-run',
    },
    ...(measured
      ? {
          searchCrawlerAccess: access,
          dataUseCrawlerPolicy: access,
          userInitiatedFetchAccess: access,
          previewControls: {
            noindex: !positive,
            noSnippet: !positive,
            maxSnippetZero: !positive,
            crawlerControls: tokens.map((token) => ({
              token,
              noindex: !positive,
              noSnippet: !positive,
              maxSnippetZero: !positive,
            })),
            dataUseCrawlerControls: tokens.map((token) => ({
              token,
              noindex: !positive,
              noArchive: !positive,
            })),
          },
          answerContent: {
            questionHeadings: positive ? 2 : 0,
            conciseAnswerBlocks: positive ? 3 : 0,
            visibleAuthor: positive,
            visibleDate: positive,
            schemaIsAccessibleForFree: positive,
            schemaHasNonBooleanAccessibleForFreeValue: !positive,
            schemaDateModifiedDays: ['2026-10-03'],
            schemaDateModifiedDaysTruncated: false,
          },
          citationEvidence: {
            externalSourceLinkCount: positive ? 3 : 0,
            inlineCitationMarkerCount: positive ? 2 : 0,
            unresolvedCitationTargetCount: positive ? 0 : 2,
          },
        }
      : {}),
  };
  fixture.pageSummaries = [
    page,
    { ...page, url: 'https://example.com/unseen' },
    { ...page, url: 'https://example.com/ambiguous?variant=a' },
    { ...page, url: 'https://example.com/ambiguous?variant=b' },
    { ...page, url: 'https://offsite.example/guide' },
    { ...page, url: 'not a URL' },
  ];
  return fixture;
}
function check(html: string) {
  const window = new Window();
  window.document.write(html);
  expect(window.document.title).toBeTruthy();
  expect(html).not.toMatch(/PRIVATE_QUERY|PRIVATE_AGENT|203\.0\.113\.17|NaN|Infinity/);
  for (const table of window.document.querySelectorAll('table')) {
    const columns = [...table.querySelectorAll(':scope > thead > tr:last-child > th')].reduce(
      (n, c) => n + c.colSpan,
      0
    );
    for (const row of table.querySelectorAll(':scope > tbody > tr'))
      expect(
        [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)
      ).toBe(columns);
  }
}
describe('crawler/audit evidence contracts', () => {
  it.each([
    { measured: true, positive: true },
    { measured: true, positive: false },
    { measured: false, positive: false },
  ])('joins exact paths with measured=$measured positive=$positive', ({ measured, positive }) => {
    const audit = site(measured, positive);
    const correlation = correlateAiCrawlerAccessLogWithGeoAudit(log, audit, 'https://example.com');
    expect(correlation.logPathsMatchedToAudit).toBe(tokens.length);
    expect(correlation.logPathsAmbiguousInAudit).toBe(tokens.length);
    expect(correlation.logPathsNotInAudit).toBe(tokens.length);
    expect(correlation.requestsMatchedToAuditedPaths).toBe(tokens.length);
    expect(
      correlation.pathObservations
        .filter((p) => p.auditMatchType === 'ambiguous')
        .every((p) => p.currentRobotsAccess !== 'allowed')
    ).toBe(true);
    if (measured && !positive) {
      expect(correlation.requestsOnApplebotPagesMarkedPaywalled).toBe(1);
      expect(correlation.requestsOnApplebotPagesWithNoSnippet).toBe(1);
    }
    if (!measured) expect(correlation.requestsOnCurrentlyRobotsBlockedPaths).toBe(0);
    check(renderAiCrawlerAccessLogHtml([log], [correlation]));
    const familyCsv = families.renderAiCrawlerPathFamilyAuditCorrelationCsv([correlation]);
    expect(
      JSON.parse(
        families.renderAiCrawlerPathFamilyAuditCorrelationJsonFromCsv(familyCsv, [correlation])
      ).rows.length
    ).toBeGreaterThan(0);
    check(families.renderAiCrawlerPathFamilyAuditCorrelationHtml([correlation]));
    const before = correlateAiCrawlerAccessLogWithGeoAudit(
      log,
      site(true, !positive),
      'https://example.com'
    );
    const comparisonCsv = families.renderAiCrawlerPathFamilyAuditComparisonCsv(
      [before],
      [correlation]
    );
    const comparisonJson = JSON.parse(
      families.renderAiCrawlerPathFamilyAuditComparisonJsonFromCsv(
        comparisonCsv,
        [before],
        [correlation]
      )
    );
    expect(comparisonJson.rows.length).toBeGreaterThan(0);
    check(families.renderAiCrawlerPathFamilyAuditComparisonHtml([before], [correlation]));
    const freshness = analyzeAiCrawlerSitemapRecrawlCoverage(
      log,
      [
        { url: 'https://example.com/guide', lastModified: '2026-10-03' },
        { url: 'https://example.com/unseen', lastModified: '2026-10-03' },
        { url: 'https://example.com/ambiguous', lastModified: 'invalid' },
      ],
      'https://example.com',
      'https://example.com/sitemap.xml',
      { audit }
    );
    check(renderAiCrawlerAccessLogHtml([log], [correlation], [], [], [], [freshness]));
  });
  it('withholds absence when the retained crawler paths are capped', () => {
    const capped = structuredClone(log);
    for (const crawler of capped.crawlers) crawler.pathsTruncated = true;
    const correlation = correlateAiCrawlerAccessLogWithGeoAudit(
      capped,
      site(true, true),
      'https://example.com'
    );
    expect(correlation.inputPathsTruncated).toBe(true);
    expect(
      correlation.auditPathCoverage.crawlers.some((c) => c.pathsUnassessableBecauseTruncated > 0)
    ).toBe(true);
    check(renderAiCrawlerAccessLogHtml([capped], [correlation]));
  });
  it.each([
    'not-a-url',
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com/?query',
    'https://example.com/#fragment',
  ])('rejects an invalid correlation origin %s', (origin) => {
    expect(() => correlateAiCrawlerAccessLogWithGeoAudit(log, site(true, true), origin)).toThrow(
      /origin/
    );
    expect(() => analyzeAiCrawlerRobotsAuditReplay([], '', origin)).toThrow(/origin/);
  });
});

const urls = ['https://example.com/guide', 'https://example.com/private?secret=PRIVATE_QUERY'];
const allow = analyzeAiCrawlerRobotsAuditReplay(
  urls,
  'User-agent: *\nAllow: /',
  'https://example.com',
  { customTokens: ['CustomIndexer'] }
);
const deny = analyzeAiCrawlerRobotsAuditReplay(
  urls,
  'User-agent: *\nDisallow: /private',
  'https://example.com',
  { customTokens: ['CustomIndexer'] }
);
describe('robots replay period evidence', () => {
  it('separates newly blocked, newly allowed, changed-rule and unchanged pairs', () => {
    const blocked = compareAiCrawlerRobotsAuditReplays(allow, deny);
    expect(blocked.urlTokenPairsNewlyBlocked).toBeGreaterThan(0);
    expect(blocked.urlTokenPairsWithRuleChanges).toBeGreaterThan(0);
    expect(compareAiCrawlerRobotsAuditReplays(deny, allow).urlTokenPairsNewlyAllowed).toBe(
      blocked.urlTokenPairsNewlyBlocked
    );
    expect(compareAiCrawlerRobotsAuditReplays(allow, allow).urlTokenPairsUnchanged).toBe(
      allow.rows.length
    );
    check(renderAiCrawlerRobotsAuditReplayHtml(deny, blocked));
    check(
      renderAiCrawlerRobotsAuditReplayHtml(allow, compareAiCrawlerRobotsAuditReplays(deny, allow))
    );
  });
  it('counts missing URL/token pairs without treating them as policy transitions', () => {
    const partial = analyzeAiCrawlerRobotsAuditReplay([urls[0]], '', 'https://example.com');
    const before = compareAiCrawlerRobotsAuditReplays(partial, deny);
    expect(before.urlTokenPairsNotComparable).toBeGreaterThan(0);
    expect(before.urlTokenPairsMissingFromBaseline).toBeGreaterThan(0);
    expect(
      compareAiCrawlerRobotsAuditReplays(deny, partial).urlTokenPairsMissingFromCurrent
    ).toBeGreaterThan(0);
    check(renderAiCrawlerRobotsAuditReplayHtml(deny, before));
  });
  it('rejects incomparable origins, target sources, and sitemap identities', () => {
    const foreign = analyzeAiCrawlerRobotsAuditReplay([], '', 'https://other.example');
    expect(() => compareAiCrawlerRobotsAuditReplays(foreign, allow)).toThrow(/same origin/);
    const sitemap = analyzeAiCrawlerRobotsAuditReplay(urls, '', 'https://example.com', {
      targetSource: 'sitemap',
      sitemapUrl: 'https://example.com/sitemap.xml',
      targetsMayBeTruncated: true,
    });
    expect(() => compareAiCrawlerRobotsAuditReplays(sitemap, allow)).toThrow(/same source/);
    expect(() =>
      compareAiCrawlerRobotsAuditReplays(
        { ...sitemap, sitemapUrl: 'https://example.com/other.xml' },
        sitemap
      )
    ).toThrow(/same sitemap/);
    check(
      renderAiCrawlerRobotsAuditReplayHtml(
        sitemap,
        compareAiCrawlerRobotsAuditReplays(sitemap, sitemap)
      )
    );
  });
  it.each([
    { targetSource: 'sitemap' as const },
    { sitemapUrl: 'https://example.com/sitemap.xml' },
    { targetSource: 'sitemap' as const, sitemapUrl: 'not-a-url' },
    { targetSource: 'sitemap' as const, sitemapUrl: 'https://foreign.example/sitemap.xml' },
    { customTokens: ['GPTBot'] },
    { customTokens: ['bad token'] },
  ])('rejects invalid replay configuration %j', (options) => {
    expect(() =>
      analyzeAiCrawlerRobotsAuditReplay(urls, '', 'https://example.com', options)
    ).toThrow();
  });
});
