import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SiteWideGeoAnalysis } from '../../src/sitewide';
import type { GoogleAiPerformanceExport } from '../../src/geo/googleAiPerformance';
import type { BingAiPerformanceExport } from '../../src/geo/bingAiPerformance';
import {
  compareAiPlatformPageObservations,
  compareAiPlatformPageMatrices,
  isAiPlatformPageMatrix,
} from '../../src/geo/platformMatrix';
import {
  renderAiPlatformPageMatrixCsv,
  renderAiPlatformPageMatrixHtml,
} from '../../src/geo/platformMatrixReporter';
import { correlateBingAiCitationsWithAudit } from '../../src/geo/bingAiPerformance';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import * as concordance from '../../src/geo/googleAiCitationConcordance';

const audit = JSON.parse(
  readFileSync(
    new URL(
      '../../examples/geo-audited-page-provider-inventory.sitewide.synthetic.example.json',
      import.meta.url
    ),
    'utf8'
  )
) as SiteWideGeoAnalysis;
const google: GoogleAiPerformanceExport = {
  surface: 'search',
  datasetKind: 'page',
  dimensions: ['url'],
  headerRow: 1,
  rowCount: 3,
  skippedRows: 0,
  uniquePageCount: 3,
  columns: {},
  rows: [
    { url: 'https://example.com/guides/geo-observability', impressions: 60 },
    { url: 'https://example.com/uncited', impressions: 20 },
    { url: 'not-a-url', impressions: 5 },
  ],
};
const bing: BingAiPerformanceExport = {
  datasetKind: 'page-citations',
  headerRow: 1,
  rowCount: 3,
  skippedRows: 0,
  uniquePageCount: 3,
  uniqueQueryCount: 0,
  columns: {},
  rows: [
    {
      url: 'https://www.example.com/guides/geo-observability',
      citations: 8,
      citedPages: 2,
      citationShare: 80,
    },
    { url: 'https://example.com/bing-only', citations: 2, citedPages: 1, citationShare: 20 },
    { url: 'not-a-url', citations: 1 },
  ],
};
const answers = analyzeAiAnswerCitationObservations(
  {
    schemaVersion: 1,
    observations: [
      {
        provider: 'Search',
        prompt: 'Guide',
        observedAt: '2026-10-01T00:00:00Z',
        citedUrls: ['https://example.com/guides/geo-observability'],
        citationListComplete: true,
      },
    ],
  },
  ['example.com'],
  '2026-10-05T00:00:00Z'
);
const sparse = structuredClone(audit);
for (const page of sparse.pageSummaries) {
  delete page.answerContent;
  delete page.previewControls;
  delete page.searchCrawlerAccess;
  page.signalCoverage.searchCrawlerAccess = 'not-assessed';
  page.signalCoverage.previewControls = 'not-run';
  page.signalCoverage.answerContent = 'not-assessed';
}
const ambiguous = structuredClone(audit);
ambiguous.pageSummaries.push({
  ...ambiguous.pageSummaries[0],
  url: 'https://example.com/alias',
  canonicalUrl: 'https://example.com/guides/geo-observability',
});
const cases = [
  { name: 'measured audit', audit },
  { name: 'legacy unassessed profiles', audit: sparse },
  { name: 'ambiguous canonical aliases', audit: ambiguous },
  { name: 'no audit bridge', audit: undefined },
];
describe('platform/audit bridge evidence contracts', () => {
  it.each(cases)('$name preserves separate metric totals and unknown signals', ({ audit }) => {
    const matrix = compareAiPlatformPageObservations(
      google,
      bing,
      audit,
      {
        url: 'https://example.com/sitemap.xml',
        pageUrls: ['https://example.com/guides/geo-observability'],
        resultMayBeTruncated: true,
      },
      { pathFamilyDepth: 2 }
    );
    expect(isAiPlatformPageMatrix(matrix)).toBe(true);
    expect(matrix).toMatchObject({
      googleExportRowSummedImpressions: 85,
      googleUsableUrlRowSummedImpressions: 80,
      bingExportRowSummedCitations: 11,
      bingUsableUrlRowSummedCitations: 10,
      rowsWithoutUsableUrl: { googleRows: 1, bingRows: 1 },
    });
    const baseline = compareAiPlatformPageObservations(
      { ...google, rows: [{ url: google.rows[0].url, impressions: 10 }] },
      { ...bing, rows: [{ url: bing.rows[0].url, citations: 1, citedPages: 1 }] },
      audit,
      undefined,
      { pathFamilyDepth: 2 }
    );
    const comparison = compareAiPlatformPageMatrices(matrix, baseline);
    expect(comparison.pagesOnlyInCurrentReturnedList).toBeGreaterThan(0);
    expect(renderAiPlatformPageMatrixCsv(matrix, comparison)).not.toMatch(/NaN|Infinity/);
    expect(renderAiPlatformPageMatrixHtml(matrix, comparison)).not.toMatch(/NaN%|Infinity%/);
    if (audit)
      expect(correlateBingAiCitationsWithAudit(bing, audit).rows.length).toBeGreaterThan(0);
    const report = concordance.analyzeGoogleAiCitationConcordance(google, answers, 2, audit);
    for (const render of [
      concordance.renderGoogleAiCitationConcordanceCsv,
      concordance.renderGoogleAiCitationConcordanceProviderCsv,
      concordance.renderGoogleAiCitationConcordancePathFamilyCsv,
      concordance.renderGoogleAiCitationConcordancePathDepthSweepCsv,
    ])
      expect(render(report)).not.toMatch(/NaN|Infinity/);
    expect(concordance.renderGoogleAiCitationConcordanceHtml(report)).not.toMatch(/NaN%|Infinity%/);
  });
  it('keeps zero-valued metrics measured while absent metrics remain unknown', () => {
    const matrix = compareAiPlatformPageObservations(
      { ...google, rows: [{ url: 'https://example.com/zero', impressions: 0 }] },
      { ...bing, rows: [{ url: 'https://example.com/unknown' }] },
      audit,
      undefined,
      { pathFamilyDepth: 1 }
    );
    expect(matrix.pages.find((p) => p.url.endsWith('/zero'))?.googleSearchAiImpressions).toBe(0);
    expect(matrix.pages.find((p) => p.url.endsWith('/unknown'))?.bingAiCitations).toBeUndefined();
    expect(renderAiPlatformPageMatrixHtml(matrix)).not.toMatch(/NaN%|Infinity%/);
    expect(isAiPlatformPageMatrix(matrix)).toBe(true);
  });
  const valid = compareAiPlatformPageObservations(google, bing, undefined, undefined, {
    pathFamilyDepth: 2,
  });
  it.each([
    null,
    undefined,
    false,
    [],
    {},
    ...['source', 'schemaVersion', 'pages', 'pagesTruncated'].map((key) => ({
      ...valid,
      [key]: null,
    })),
    ...['googleUsableUrlRowSummedImpressions', 'bingUsableUrlRowSummedCitations'].flatMap((key) =>
      [-1, '1', Number.NaN].map((value) => ({ ...valid, [key]: value }))
    ),
    ...[0, 1.5, 6].map((pathFamilyDepth) => ({ ...valid, pathFamilyDepth })),
    ...[
      'url',
      'coverage',
      'googleSearchAiImpressions',
      'bingAiCitations',
      'googleImpressionSharePercent',
      'bingCitationSharePercent',
    ].map((key) => ({
      ...valid,
      pages: [
        { ...valid.pages[0], [key]: key === 'url' ? '' : key === 'coverage' ? 'invalid' : -1 },
      ],
    })),
    { ...valid, pages: [null] },
    { ...valid, pathFamilies: [null] },
    { ...valid, pathFamilies: [{ family: '/guide', joinedPageGroups: 0 }] },
    { ...valid, pathFamiliesTruncated: 'yes' },
  ])('rejects malformed saved matrix case %#', (value) =>
    expect(isAiPlatformPageMatrix(value)).toBe(false)
  );
});
