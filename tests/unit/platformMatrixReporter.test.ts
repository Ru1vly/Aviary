import { describe, expect, it } from 'vitest';
import type { BingAiPerformanceExport } from '../../src/geo/bingAiPerformance';
import type { GoogleAiPerformanceExport } from '../../src/geo/googleAiPerformance';
import {
  compareAiPlatformPageMatrices,
  compareAiPlatformPageObservations,
  type AiPlatformPageMatrix,
} from '../../src/geo/platformMatrix';
import {
  renderAiPlatformPageMatrixCsv,
  renderAiPlatformPageMatrixHtml,
} from '../../src/geo/platformMatrixReporter';

function googleExport(): GoogleAiPerformanceExport {
  return {
    surface: 'search',
    datasetKind: 'page',
    dimensions: ['url'],
    headerRow: 1,
    rowCount: 2,
    skippedRows: 0,
    uniquePageCount: 2,
    columns: {},
    rows: [
      { url: 'https://example.com/guides/cat-food', impressions: 60 },
      { url: 'https://example.com/guides/senior-cats', impressions: 40 },
    ],
  };
}

function bingExport(): BingAiPerformanceExport {
  return {
    datasetKind: 'page-citations',
    headerRow: 1,
    rowCount: 2,
    skippedRows: 0,
    uniquePageCount: 2,
    uniqueQueryCount: 0,
    columns: {},
    rows: [
      {
        url: 'https://example.com/guides/cat-food',
        citations: 8,
        citedPages: 2,
        citationShare: 0.25,
      },
      {
        url: 'https://example.com/guides/senior-cats',
        citations: 2,
        citedPages: 1,
        citationShare: 0.1,
      },
    ],
  };
}

function matrix(): AiPlatformPageMatrix {
  return compareAiPlatformPageObservations(googleExport(), bingExport(), undefined, undefined, {
    pathFamilyDepth: 2,
  });
}

describe('cross-platform GEO page matrix reports', () => {
  it('exports page and period values as headered, spreadsheet-safe CSV', () => {
    const baseline = matrix();
    const current = {
      ...baseline,
      pages: baseline.pages.map((page, index) =>
        index === 0 ? { ...page, url: '=https://example.com/guides/cat-food' } : page
      ),
    } as AiPlatformPageMatrix;
    const comparison = compareAiPlatformPageMatrices(current, baseline);

    const csv = renderAiPlatformPageMatrixCsv(current, comparison);

    expect(csv.startsWith('"url","path_family","coverage",')).toBe(true);
    expect(csv).toContain('"period_state"');
    expect(csv).toContain("'=https://example.com/guides/cat-food");
    expect(csv).toContain('"present-both"');
  });

  it('renders audit, sitemap, family, language, period, and share panels safely', () => {
    const base = matrix();
    const first = base.pages[0]!;
    const enriched = {
      ...base,
      googleSourceFile: '<google export>.csv',
      bingSourceFile: 'bing.csv',
      pages: [
        {
          ...first,
          googleSourceUrls: [
            'https://sources.example/article?a=1&b=2',
            'javascript:alert(1)',
            'https://user:secret@sources.example/private',
          ],
          googleSourceUrlsTruncated: true,
          sitemapMembership: {
            state: 'possible-match-source-list-truncated' as const,
            matchedVia: 'export-url-alias' as const,
          },
          currentAuditSignals: {
            auditUrl: 'javascript:alert(2)',
            googlebot: {
              access: 'blocked' as const,
              noindex: true,
              noSnippet: true,
              maxSnippetZero: true,
            },
            bingbot: { access: 'allowed' as const },
            dataNoSnippetElements: 1,
            dataNoSnippetWords: 20,
            pageContent: {
              questionHeadings: 2,
              conciseAnswerBlocks: 1,
              externalContentLinks: 3,
              externalSourceLinks: 2,
              referenceSectionLinks: 1,
              visibleAuthor: true,
              visibleDate: false,
              documentLanguage: '<en-US>',
              documentLanguageValid: false,
            },
          },
        },
        ...base.pages.slice(1),
      ],
      sitemapCoverage: {
        sitemapUrl: 'https://example.com/sitemap.xml',
        sitemapUrlsDiscovered: 10,
        pagesFoundInSuppliedSitemapList: 1,
        pagesNotFoundInSuppliedSitemapList: 1,
        pagesWithPossibleAliasMatchFromTruncatedSourceLists: 1,
        sitemapResultMayBeTruncated: true,
        googleMetricShareOnListedPagesPercent: 60,
        note: '<sitemap note>',
      },
      currentAuditExposure: {
        joinedPageGroups: 2,
        pagesWithCurrentAudit: 1,
        googlebotAccessAssessedPages: 1,
        bingbotAccessAssessedPages: 1,
        controls: [
          {
            control: 'googlebot-currently-blocked' as const,
            pages: 1,
            pagesAssessed: 1,
            googleImpressionSharePercent: 60,
          },
          {
            control: 'snippet-restricted' as const,
            pages: 1,
            pagesAssessed: 1,
            bingCitationSharePercent: 80,
          },
        ],
        note: '<audit note>',
      },
      documentLanguageCoverage: {
        joinedPagesAnalyzed: 2,
        pagesWithCurrentAudit: 1,
        languageProfilesAssessed: 1,
        pagesWithDeclaredLanguage: 1,
        assessedPagesWithoutDeclaredLanguage: 0,
        pagesWithValidDeclaredLanguageTag: 0,
        pagesWithInvalidDeclaredLanguageTag: 1,
        pagesWithDeclaredLanguageTagNotValidated: 0,
        pagesWithAuditButLanguageNotAssessed: 0,
        pagesWithoutCurrentAudit: 1,
        languages: [
          {
            language: '<en-US>',
            pages: 1,
            pagesObservedByBoth: 1,
            googleExportOnlyPages: 0,
            bingExportOnlyPages: 0,
            googleObservedPagePercent: 100,
            bingObservedPagePercent: 100,
            googlePagesWithImpressions: 1,
            googleRowSummedImpressions: 60,
            bingPagesWithCitations: 1,
            bingRowSummedCitations: 8,
            validLanguageTagPages: 0,
            invalidLanguageTagPages: 1,
            languageTagValidationUnavailablePages: 0,
          },
        ],
        languagesTruncated: true,
        note: '<language note>',
      },
    } as AiPlatformPageMatrix;
    const comparison = compareAiPlatformPageMatrices(enriched, base);

    const html = renderAiPlatformPageMatrixHtml(enriched, comparison);
    const csv = renderAiPlatformPageMatrixCsv(enriched);

    expect(html).toContain('Observed URL path families');
    expect(html).toContain('Current controls on observed URL groups');
    expect(html).toContain('Current declared document language');
    expect(html).toContain('Platform-specific movement across saved periods');
    expect(html).toContain('Within-export page share map');
    expect(html).toContain('source-details');
    expect(html).toContain('possible alias');
    expect(html).toContain('data-nosnippet');
    expect(html).toContain('&lt;sitemap note&gt;');
    expect(html).toContain('&lt;audit note&gt;');
    expect(html).not.toContain('<sitemap note>');
    expect(html).not.toContain('<audit note>');
    expect(html).not.toContain('<en-US>');
    expect(html).not.toContain('<a href="javascript:');
    expect(html).not.toContain('secret@sources.example');
    expect(html).not.toContain('<script src=');
    expect(html).toContain('https://sources.example/private');
    expect(csv).not.toContain('secret@sources.example');
    expect(csv).toContain('https://sources.example/private');
    expect(html).toContain('no remote scripts, styles, or data requests');
  });

  it('renders an empty-state report when no pages have both platform share metrics', () => {
    const input = {
      ...matrix(),
      pages: matrix().pages.map((page) => ({
        ...page,
        googleImpressionSharePercent: undefined,
        bingCitationSharePercent: undefined,
      })),
      pathFamilies: [],
      pathFamilyCount: 0,
    } as AiPlatformPageMatrix;

    const html = renderAiPlatformPageMatrixHtml(input);

    expect(html).toContain('No URLs have both platform shares measured.');
    expect(html).toContain('No URL families were available.');
  });
});
