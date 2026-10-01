import {
  compareGoogleAiDimensionExports,
  compareGoogleAiPerformanceExports,
  correlateGoogleAiPerformanceWithAudit,
  parseGoogleAiPerformanceCsvExport,
  summarizeGoogleAiPerformanceExport,
} from '../../src/geo/googleAiPerformance';
import type { SEOAuditBatchReport, SEOReport } from '../../src/types';
import type { SiteWideGeoAnalysis } from '../../src/sitewide';

describe('Google AI performance exports', () => {
  it('parses Search Console headers after a preamble and normalizes localized values', () => {
    const parsed = parseGoogleAiPerformanceCsvExport(
      '\uFEFFSearch Console export\r\nPage;Impressions\r\nhttps://example.com/a#top;"1.200"\r\nhttps://example.com/b;—\r\nhttps://example.com/c;unknown',
      { sourceFile: 'search.csv' }
    );

    expect(parsed).toMatchObject({
      sourceFile: 'search.csv',
      surface: 'search',
      datasetKind: 'page',
      dimensions: ['url'],
      headerRow: 2,
      rowCount: 2,
      skippedRows: 1,
      uniquePageCount: 2,
      rows: [
        { url: 'https://example.com/a#top', impressions: 1200 },
        { url: 'https://example.com/b', impressions: 0 },
      ],
    });
  });

  it('uses explicit column names for localized exports and rejects invalid limits and shapes', () => {
    expect(
      parseGoogleAiPerformanceCsvExport('Página;Visibilidad\nhttps://example.com;1.500', {
        columns: { url: 'Página', impressions: 'Visibilidad' },
      }).rows
    ).toEqual([{ url: 'https://example.com', impressions: 1500 }]);

    expect(() =>
      parseGoogleAiPerformanceCsvExport('Page,Impressions\na,1', { maxBytes: 1 })
    ).toThrow(/byte limit/);
    expect(() =>
      parseGoogleAiPerformanceCsvExport('Page,Impressions\na,1', { maxRows: 0 })
    ).toThrow(/maxRows/);
    expect(() =>
      parseGoogleAiPerformanceCsvExport('Date,Device,Impressions\n2026-01-01,Mobile,2', {
        surface: 'discover',
      })
    ).toThrow(/does not provide a device dimension/);
    expect(() => parseGoogleAiPerformanceCsvExport('Title\nno report')).toThrow(
      /Could not identify/
    );
    expect(() => parseGoogleAiPerformanceCsvExport('Page,Impressions\na,invalid')).toThrow(
      /no rows contained a valid impression/
    );
    expect(() => parseGoogleAiPerformanceCsvExport('Page,Impressions\n"unterminated,1')).toThrow(
      /unterminated quoted field/
    );
    expect(() =>
      parseGoogleAiPerformanceCsvExport('Page,Impressions\na,1\nb,2', { maxRows: 1 })
    ).toThrow(/more than 1 valid data rows/);
    expect(() =>
      parseGoogleAiPerformanceCsvExport('Page,Impressions\na,1', { surface: 'video' as never })
    ).toThrow(/surface must be search or discover/);
    expect(() =>
      parseGoogleAiPerformanceCsvExport('Page,Impressions\na,1', { maxBytes: 0 })
    ).toThrow(/maxBytes must be a positive safe integer/);
    expect(() =>
      parseGoogleAiPerformanceCsvExport('Page,Impressions\na,1', { maxRows: 1_000_001 })
    ).toThrow(/maxRows must be an integer/);
    expect(() => parseGoogleAiPerformanceCsvExport('Page,Impressions')).toThrow(
      /header row and at least one data row/
    );
  });

  it('accepts overview exports and preserves valid zero impressions without inventing dimensions', () => {
    const parsed = parseGoogleAiPerformanceCsvExport('Impressions\n~\n-\n12');

    expect(parsed).toMatchObject({
      datasetKind: 'overview',
      dimensions: [],
      uniquePageCount: 0,
      rows: [{ impressions: 0 }, { impressions: 0 }, { impressions: 12 }],
    });
  });

  it('parses quoted delimiters, escaped quotes, and both grouped-number conventions', () => {
    const parsed = parseGoogleAiPerformanceCsvExport(
      'Page,Country,Impressions\nhttps://example.com/a,"A, \"\"quoted\"\" label","1,234"\nhttps://example.com/b,US,"1.234,000"\nhttps://example.com/c,US,"1,234.000"'
    );

    expect(parsed.rows.map(({ impressions }) => impressions)).toEqual([1234, 1234, 1234]);
  });

  it('summarizes dimensions independently and normalizes equivalent page URLs', () => {
    const parsed = parseGoogleAiPerformanceCsvExport(
      'Page,Country,Device,Date,Impressions\nhttps://example.com/a#one,US,Mobile,2026-02-02,3\nhttps://example.com/a#two,us,Mobile,2026-02-01,4\nhttps://example.com/b,CA,Desktop,2026-02-01,5'
    );
    const summary = summarizeGoogleAiPerformanceExport(parsed);

    expect(summary.rowSummedImpressions).toBe(12);
    expect(summary.uniquePageCount).toBe(2);
    expect(summary.topPages).toEqual([
      { value: 'https://example.com/a', rows: 2, impressions: 7 },
      { value: 'https://example.com/b', rows: 1, impressions: 5 },
    ]);
    expect(summary.topCountries).toEqual([
      { value: 'US', rows: 2, impressions: 7 },
      { value: 'CA', rows: 1, impressions: 5 },
    ]);
    expect(summary.timeSeries.map(({ value }) => value)).toEqual(['2026-02-01', '2026-02-02']);
    expect(summary.note).toContain('must not be added together');
  });

  it('compares page exports without treating missing capped rows as zero', () => {
    const baseline = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/a#old,100\nhttps://example.com/b,50',
      { sourceFile: 'baseline.csv' }
    );
    const current = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/a#new,120\nhttps://example.com/c,25',
      { sourceFile: 'current.csv' }
    );
    const comparison = compareGoogleAiPerformanceExports(current, baseline);

    expect(comparison).toMatchObject({
      baselineSourceFile: 'baseline.csv',
      currentSourceFile: 'current.csv',
      pagesCompared: 1,
      pagesOnlyInCurrentExport: 1,
      pagesOnlyInBaselineExport: 1,
      matchedBaselinePageImpressions: 100,
      matchedCurrentPageImpressions: 120,
      matchedPageImpressionChange: 20,
      matchedPagePercentChange: 20,
      pagesWithIncreasedImpressions: 1,
      changesTruncated: false,
    });
    expect(comparison.changes).toContainEqual(
      expect.objectContaining({ url: 'https://example.com/b', state: 'baseline-only' })
    );
    expect(comparison.note).toContain('missing-period impressions are unknown');
    expect(() =>
      compareGoogleAiPerformanceExports(current, { ...baseline, dimensions: ['country'] })
    ).toThrow(/page-dimension exports/);
  });

  it('handles unchanged and zero-baseline page cohorts while rejecting mixed-surface comparisons', () => {
    const baseline = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/a,0\nhttps://example.com/b,10'
    );
    const current = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/a,0\nhttps://example.com/b,5',
      { surface: 'search' }
    );
    const comparison = compareGoogleAiPerformanceExports(current, baseline);

    expect(comparison.unchangedPages).toBe(1);
    expect(comparison.pagesWithDecreasedImpressions).toBe(1);
    expect(comparison.changes.find(({ url }) => url.endsWith('/a'))).toMatchObject({
      state: 'unchanged',
      impressionsChange: 0,
    });
    expect(comparison.changes.find(({ url }) => url.endsWith('/a'))).not.toHaveProperty(
      'percentChange'
    );
    expect(() =>
      compareGoogleAiPerformanceExports(current, { ...baseline, surface: 'discover' })
    ).toThrow(/cannot mix Search and Discover/);
  });

  it('compares exact multi-dimension cohorts and rejects different surfaces or dimensions', () => {
    const baseline = parseGoogleAiPerformanceCsvExport(
      'Country,Device,Impressions\nUS,Mobile,70\nCA,Desktop,30'
    );
    const current = parseGoogleAiPerformanceCsvExport(
      'Country,Device,Impressions\n us , mobile ,80\nCA,Desktop,20\nGB,Mobile,5'
    );
    const comparison = compareGoogleAiDimensionExports(current, baseline);

    expect(comparison).toMatchObject({
      dimensions: ['country', 'device'],
      cohortsCompared: 2,
      cohortsOnlyInCurrentExport: 1,
      matchedBaselineImpressions: 100,
      matchedCurrentImpressions: 100,
      matchedImpressionChange: 0,
      cohortsWithIncreasingShare: 1,
      cohortsWithDecreasingShare: 1,
    });
    expect(() =>
      compareGoogleAiDimensionExports(current, { ...baseline, dimensions: ['country'] })
    ).toThrow(/same dimensions/);
    expect(() =>
      compareGoogleAiDimensionExports(current, { ...baseline, surface: 'discover' })
    ).toThrow(/cannot mix Search and Discover/);
  });

  it('correlates normalized page rows with crawler, preview, content and canonical audit signals', () => {
    const exportData = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/canonical,10\nhttps://example.com/missing,4\n,2'
    );
    const audit = {
      url: 'https://example.com/alias',
      checks: {
        geo: [
          {
            name: 'ai-search-crawler-access',
            details: {
              crawlers: [
                {
                  token: 'Googlebot',
                  allowed: false,
                  matchedRule: { directive: 'disallow', pattern: '/private', line: 3 },
                },
              ],
            },
          },
          {
            name: 'ai-search-preview-controls',
            details: {
              crawlerControls: [
                { token: 'Googlebot', noindex: true, noSnippet: false, maxSnippetZero: false },
              ],
              dataNoSnippetElements: 1,
              dataNoSnippetWords: 12,
            },
          },
          {
            name: 'answer-content-profile',
            details: {
              questionHeadings: 2,
              conciseAnswerBlocks: 1,
              externalContentLinks: 3,
              visibleAuthor: true,
              visibleDate: false,
              documentLanguage: 'en',
              documentLanguageValid: true,
            },
          },
          {
            name: 'citation-evidence-profile',
            details: { externalSourceLinkCount: 4, referenceSectionLinkCount: 2 },
          },
        ],
        metaTags: [
          {
            name: 'canonical-url-exists',
            details: { canonicalUrl: 'https://example.com/canonical' },
          },
        ],
      },
    } as unknown as SEOReport;
    const result = correlateGoogleAiPerformanceWithAudit(exportData, audit);

    expect(result).toMatchObject({
      auditPagesCompared: 1,
      uniqueReportPages: 2,
      pagesMatchedToAudit: 1,
      pagesMatchedByCanonical: 1,
      pagesNotInAudit: 1,
      matchedPagesWithCurrentGooglebotBlocks: 1,
      matchedPagesWithCurrentGooglebotNoindex: 1,
      matchedPagesWithCurrentGooglebotSnippetRestrictions: 0,
      matchedPagesWithCurrentDataNoSnippet: 1,
    });
    expect(result.rows.map(({ auditMatchType }) => auditMatchType)).toEqual([
      'canonical-url',
      'unmatched',
      'not-applicable',
    ]);
    expect(result.rows[0]).toMatchObject({
      currentGooglebotRule: { directive: 'disallow', pattern: '/private', line: 3 },
      currentQuestionHeadings: 2,
      currentExternalSourceLinks: 4,
      currentDocumentLanguage: 'en',
    });
    expect(result.currentControlObservations).toContainEqual({
      control: 'googlebot-robots-access',
      state: 'present',
      matchedPages: 1,
      exportRows: 1,
      rowSummedImpressions: 10,
    });
    expect(result.currentContentObservations).toContainEqual({
      signal: 'visible-author',
      state: 'present',
      matchedPages: 1,
      exportRows: 1,
      rowSummedImpressions: 10,
    });
  });

  it('uses sitewide signal-coverage metadata and refuses ambiguous canonical matches', () => {
    const exportData = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/canonical,10\nhttps://example.com/unknown,4'
    );
    const audit = {
      schemaVersion: 1,
      pageSummaries: [
        {
          url: 'https://example.com/one',
          canonicalUrl: 'https://example.com/canonical',
          geoAssessed: true,
          signalCoverage: {
            searchCrawlerAccess: 'measured',
            dataUseCrawlerPolicy: 'not-assessed',
            previewControls: 'measured',
            answerContent: 'not-assessed',
            sourceRenderedContent: 'not-run',
            citationEvidence: 'not-assessed',
            optionalLlmsFiles: 'not-run',
          },
          searchCrawlerAccess: [
            {
              token: 'Googlebot',
              allowed: true,
              matchedRule: { directive: 'allow', pattern: '/', line: 1 },
            },
          ],
          previewControls: {
            crawlerControls: [
              { token: 'Googlebot', noindex: false, noSnippet: false, maxSnippetZero: false },
            ],
            dataNoSnippetElements: 0,
          },
        },
        {
          url: 'https://example.com/two',
          canonicalUrl: 'https://example.com/canonical',
          geoAssessed: true,
          signalCoverage: {
            searchCrawlerAccess: 'measured',
            dataUseCrawlerPolicy: 'not-assessed',
            previewControls: 'not-assessed',
            answerContent: 'not-assessed',
            sourceRenderedContent: 'not-run',
            citationEvidence: 'not-assessed',
            optionalLlmsFiles: 'not-run',
          },
          searchCrawlerAccess: [{ token: 'Googlebot', allowed: false }],
        },
      ],
    } as unknown as SiteWideGeoAnalysis;
    const result = correlateGoogleAiPerformanceWithAudit(exportData, audit);

    expect(result.pagesMatchedByCanonical).toBe(0);
    expect(result.pagesWithAmbiguousCanonicalMatch).toBe(1);
    expect(result.pagesNotInAudit).toBe(1);
    expect(result.rows[0]).toMatchObject({
      auditMatchType: 'ambiguous-canonical',
      auditMatched: false,
      geoAssessed: false,
      googlebotAccessAssessed: false,
    });
    expect(result.currentControlObservations).toContainEqual({
      control: 'googlebot-robots-access',
      state: 'not-assessed',
      matchedPages: 0,
      exportRows: 0,
      rowSummedImpressions: 0,
    });
  });

  it('keeps duplicate normalized batch audit URLs ambiguous and skips incomplete results', () => {
    const exportData = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/page#report,8'
    );
    const report = {
      checks: {
        geo: [
          {
            name: 'ai-search-crawler-access',
            details: { crawlers: [{ token: 'googlebot', allowed: false }] },
          },
        ],
      },
    } as unknown as SEOReport;
    const audit = {
      results: [
        { status: 'complete', url: 'https://example.com/page', report },
        { status: 'complete', url: 'https://example.com/page#duplicate', report },
        { status: 'error', url: 'https://example.com/failed', error: 'timeout' },
      ],
    } as unknown as SEOAuditBatchReport;
    const result = correlateGoogleAiPerformanceWithAudit(exportData, audit);

    expect(result).toMatchObject({
      auditPagesCompared: 1,
      pagesMatchedToAudit: 0,
      pagesWithAmbiguousAuditUrlMatch: 1,
      pagesNotInAudit: 0,
      matchedPagesWithCurrentGooglebotBlocks: 0,
    });
    expect(result.rows[0]).toMatchObject({
      auditMatchType: 'ambiguous-audit-url',
      auditMatched: false,
      googlebotAccessAssessed: false,
    });
  });
});
