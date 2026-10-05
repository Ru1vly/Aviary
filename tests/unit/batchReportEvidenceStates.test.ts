import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import type { SEOReport, SEOAuditBatchReport, SEOCheckResult } from '../../src/types';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';
import { compareSEOAuditBatches } from '../../src/scoring';
import * as sitewide from '../../src/sitewide';
import * as renderer from '../../src/reporter';

function check(name: string, details: Record<string, unknown>, passed = true): SEOCheckResult {
  return {
    name,
    details,
    passed,
    severity: passed ? 'info' : 'warning',
    message: `${name} <unsafe & text>`,
    value: passed ? 1 : 0,
    threshold: 1,
  };
}
function page(index: number, positive: boolean, sparse = false): SEOReport {
  const url = `https://example.com/page-${index}`;
  const checks = Object.fromEntries(
    CHECKER_REGISTRY.map((c) => [c.key, []])
  ) as SEOReport['checks'];
  checks.metaTags = [
    check('title-exists', { title: 'Repeated title' }),
    check('description-exists', { description: 'Repeated description' }),
    check('canonical-url-exists', {
      canonicalUrl: `https://example.com/page-${index % 2 ? index - 1 : index + 1}`,
    }),
  ];
  checks.content = [
    check('word-count-adequate', {
      wordCount: 150,
      normalizedCharacters: 900,
      contentFingerprint: 'a'.repeat(64),
    }),
  ];
  checks.links = [
    check('link-structure-valid', {
      sitewideLinkTargets: [index, (index + 1) % 3, (index + 1) % 3, 9999],
      sitewideLinkTargetsTruncated: !positive,
    }),
  ];
  checks.internationalization = [
    check('hreflang-tags-valid', {
      alternates: [
        { hreflang: 'en', href: 'https://example.com/page-0' },
        { hreflang: 'fr', href: 'https://example.com/page-1' },
        { hreflang: 'de', href: 'https://example.com/not-audited' },
      ],
    }),
  ];
  checks.technical = [check('response-code-valid', { status: 200, url })];
  const crawlers = ['OAI-SearchBot', 'GPTBot', 'Claude-User', 'Applebot'].map((token) => ({
    token,
    allowed: positive,
    matchedAgents: ['*'],
    matchedRule: { directive: positive ? 'allow' : 'disallow', pattern: '/', line: 2 },
  }));
  const payloads: Array<[string, Record<string, unknown>]> = [
    ['ai-search-crawler-access', { crawlers }],
    ['ai-data-use-crawler-policy', { crawlers }],
    ['ai-user-initiated-fetch-access', { crawlers }],
    [
      'ai-search-preview-controls',
      {
        responseStatus: 200,
        noindex: !positive,
        noSnippet: !positive,
        maxSnippetZero: !positive,
        dataNoSnippetElements: 2,
        dataNoSnippetWords: 20,
        dataNoSnippetWordSharePercent: 20,
        visibleTextWords: 100,
        crawlerControls: crawlers.map(({ token }) => ({
          token,
          noindex: !positive,
          noSnippet: !positive,
          maxSnippetZero: !positive,
        })),
        dataUseCrawlerControls: [{ token: 'GPTBot', noArchive: !positive }],
      },
    ],
    [
      'answer-content-profile',
      {
        contentWords: 150,
        mainOrArticleRegion: true,
        headingCount: 4,
        questionHeadings: positive ? 2 : 0,
        conciseAnswerBlocks: positive ? 2 : 0,
        listCount: 2,
        tableCount: 1,
        externalContentLinks: 2,
        visibleAuthor: positive,
        visibleDate: positive,
        schemaAuthor: !positive,
        schemaDate: !positive,
        schemaDateModifiedDays: ['2026-10-01'],
        schemaDateModifiedDaysTruncated: !positive,
        schemaIsAccessibleForFree: index % 2 ? 'mixed' : false,
        schemaHasNonBooleanAccessibleForFreeValue: !positive,
        jsonLdTypes: ['Article', 'Organization'],
        jsonLdTypeListTruncated: !positive,
        identityEntities: [
          {
            id: 'https://example.com/#publisher',
            name: index % 2 ? 'Publisher alternate' : 'Publisher',
            types: index % 2 ? ['Person'] : ['Organization'],
            sameAs:
              index % 2 ? ['https://news.example/about'] : ['https://reference.example/about'],
            sameAsTruncated: false,
          },
        ],
        identityEntityListTruncated: !positive,
        documentLanguage: index % 2 ? 'fr' : 'en',
        documentLanguageValid: true,
      },
    ],
    [
      'source-rendered-content-profile',
      {
        assessed: true,
        renderedPhraseCoveragePercent: positive ? 98 : 15,
        sourceWordCount: 100,
        renderedWordCount: 150,
        sourcePhraseCount: 96,
        renderedPhraseCount: 146,
        sharedRenderedPhraseCount: positive ? 143 : 22,
        renderedOnlyPhraseCount: positive ? 3 : 124,
      },
    ],
    [
      'citation-evidence-profile',
      {
        externalSourceLinkCount: positive ? 3 : 0,
        sourceHosts: ['reference.example', 'news.example'],
        sourceHostsTruncated: !positive,
        sourceHostLinkCounts: [
          { host: 'reference.example', links: 2 },
          { host: 'news.example', links: 1 },
        ],
        sourceHostLinkCountsTruncated: !positive,
        inlineCitationMarkerCount: positive ? 2 : 0,
        referenceSectionCount: 1,
        resolvedInlineCitationTargetsWithExternalLinks: 1,
        resolvedInlineCitationTargetsWithoutExternalLinks: 1,
        unresolvedInlineCitationTargetCount: positive ? 0 : 2,
      },
    ],
    [
      'llms-txt-convention-inventory',
      {
        resources: [
          {
            path: '/llms.txt',
            found: positive,
            status: positive ? 200 : 404,
            linkTargetProfile: {
              markdownLinks: 3,
              uniqueWebTargets: 2,
              duplicateWebTargets: 1,
              sameOriginWebLinks: 1,
              externalHttpsLinks: 1,
              externalHttpLinks: 0,
              relativeLinks: 1,
              unsupportedSchemeLinks: 0,
              invalidTargets: 0,
              emptyLabels: 0,
              malformedLinkCandidates: 0,
            },
            contentTruncated: !positive,
          },
          { path: '/llms-full.txt', status: 503 },
        ],
      },
    ],
  ];
  checks.geo = payloads.map(([name, details]) =>
    check(name, sparse ? { reason: 'Unavailable capture' } : details, positive)
  );
  const all = Object.values(checks).flat();
  return {
    url,
    timestamp: '2026-10-05T00:00:00Z',
    score: positive ? 95 : 45,
    checks,
    summary: {
      total: all.length,
      passed: all.filter((c) => c.passed).length,
      failed: all.filter((c) => !c.passed).length,
    },
  };
}
function batch(positive: boolean, count = 3, sparse = false): SEOAuditBatchReport {
  const reports = Array.from({ length: count }, (_, i) => page(i, positive, sparse));
  return {
    timestamp: '2026-10-05T00:00:00Z',
    summary: {
      requestedUrls: count + 1,
      completedUrls: count,
      failedUrls: 1,
      passedChecks: reports.reduce((n, r) => n + r.summary.passed, 0),
      failedChecks: reports.reduce((n, r) => n + r.summary.failed, 0),
      averageScore: positive ? 95 : 45,
      concurrency: 2,
    },
    results: [
      ...reports.map((report) => ({ status: 'complete' as const, url: report.url, report })),
      { status: 'error', url: 'https://example.com/error', error: 'Failure <unsafe & text>' },
    ],
  };
}
const baseline = batch(true);
const cases = [
  { name: 'measured controls and failures', report: batch(false) },
  { name: 'measured passing checks', report: baseline },
  { name: 'unassessed saved signals', report: batch(false, 3, true) },
  { name: 'capped URL examples', report: batch(false, 105) },
];
describe('complete batch-report evidence contracts', () => {
  it.each(cases)('$name has consistent GEO summaries and renders every format', ({ report }) => {
    const comparison = compareSEOAuditBatches(report, baseline);
    const html = renderer.renderBatchHtmlReport(report, comparison);
    const window = new Window();
    window.document.write(html);
    expect(window.document.querySelectorAll('.page-row').length).toBe(report.results.length);
    expect(html).not.toContain('<unsafe & text>');
    expect(html).not.toMatch(/NaN%|Infinity%/);
    for (const table of window.document.querySelectorAll('table')) {
      const columns = [...table.querySelectorAll(':scope > thead > tr:last-child > th')].reduce(
        (n, c) => n + c.colSpan,
        0
      );
      if (!columns) continue;
      for (const row of table.querySelectorAll(':scope > tbody > tr'))
        expect(
          [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)
        ).toBe(columns);
    }
    const markdown = renderer.renderBatchMarkdownReport(report, comparison);
    expect(markdown).toContain('not a search-ranking or GEO-readiness prediction');
    expect(markdown).toContain(`${report.summary.completedUrls} completed`);
    const csv = renderer.renderBatchCsvReport(report);
    expect(csv).toContain('https://example.com/error');
    expect(renderer.renderBatchJunitReport(report)).toContain('<error');
    expect(JSON.parse(renderer.renderBatchSarifReport(report)).version).toBe('2.1.0');
    const geo = sitewide.analyzeSiteWideGeo(report);
    expect(geo.pagesAnalyzed).toBe(report.summary.completedUrls);
    expect(geo.pagesSkipped).toBe(0);
    for (const render of [
      sitewide.renderSiteWideGeoCsv,
      sitewide.renderSiteWideGeoEntityVariantsCsv,
      sitewide.renderSiteWideGeoCrawlerAccessCsv,
    ])
      expect(render(geo)).not.toMatch(/NaN|Infinity/);
  });
  it('detects independently constructed duplicate content and cyclic canonicals', () => {
    const report = batch(false);
    expect(sitewide.analyzeSiteWideMetadata(report).duplicateTitles.length).toBe(1);
    expect(sitewide.analyzeSiteWideContent(report).duplicateContent.length).toBe(1);
    expect(sitewide.analyzeSiteWideCanonicals(report).canonicalLoops.length).toBeGreaterThan(0);
    expect(sitewide.analyzeSiteWideLinkGraph(report).pagesWithGraphData).toBe(3);
  });
});
