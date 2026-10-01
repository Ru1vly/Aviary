import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  analyzeGoogleAiCitationConcordance,
  renderGoogleAiCitationConcordanceCsv,
  renderGoogleAiCitationConcordanceHtml,
} from '../../src/geo/googleAiCitationConcordance';
import {
  compareGoogleAiCitationConcordanceReports,
  isGoogleAiCitationConcordanceReport,
  renderGoogleAiCitationConcordanceComparisonCsv,
  renderGoogleAiCitationConcordanceComparisonHtml,
  renderGoogleAiCitationConcordanceProviderComparisonCsv,
} from '../../src/geo/googleAiCitationConcordanceComparison';
import type { GoogleAiCitationConcordanceReport } from '../../src/geo/googleAiCitationConcordance';
import type { GoogleAiPerformanceExport } from '../../src/geo/googleAiPerformance';

describe('Google AI impression and observed-citation concordance', () => {
  it('joins normalized page URLs and keeps independent sample denominators explicit', () => {
    const googleAi: GoogleAiPerformanceExport = {
      sourceFile: 'search-ai.csv',
      surface: 'search',
      datasetKind: 'page',
      dimensions: ['url'],
      headerRow: 1,
      rowCount: 3,
      skippedRows: 0,
      uniquePageCount: 3,
      columns: { url: 'Page', impressions: 'Impressions' },
      rows: [
        { url: 'https://example.com/guides/cats/article?utm_source=first', impressions: 12 },
        { url: 'https://example.com/guides/cats/article?utm_source=second', impressions: 8 },
        { url: 'https://example.com/products/cat-food', impressions: 5 },
      ],
    };
    const answers = analyzeAiAnswerCitationObservations(
      {
        schemaVersion: 1,
        observations: [
          {
            observedAt: '2026-09-30T10:00:00Z',
            provider: 'Answer engine',
            prompt: 'best indoor cat food',
            citedUrls: [
              'https://example.com/guides/cats/article#results',
              'https://independent.example/cat-food',
            ],
            citationListComplete: true,
          },
        ],
      },
      ['example.com'],
      '2026-10-01T00:00:00Z'
    );

    const report = analyzeGoogleAiCitationConcordance(googleAi, answers);
    expect(report).toMatchObject({
      googleAiSurface: 'search',
      googleAiDatasetKind: 'page',
      googleAiPageRows: 3,
      googleAiUniquePages: 2,
      googleAiPageImpressions: 25,
      matchedPages: 1,
      matchedGoogleAiImpressions: 20,
      matchedImpressionSharePercent: 80,
      matchedCitationEvents: 1,
      matchedCitationEventShareOfAllAnswerEventsPercent: 50,
      googleAiOnlyPages: 1,
      observedAnswerOnlyPages: 1,
      auditCanonicalBridgeAvailable: false,
    });
    expect(report.rows.find(({ joinState }) => joinState === 'matched')).toMatchObject({
      url: 'https://example.com/guides/cats/article',
      joinMethod: 'exact-normalized-url',
      googleAiImpressions: 20,
      citationEvents: 1,
      owned: true,
      providerMetrics: [
        { provider: 'Answer engine', citationEvents: 1, pageAnswerPairs: 1, pagePromptPairs: 1 },
      ],
    });
    expect(report.pathFamilies).toHaveLength(3);
    expect(
      report.pathFamilies.find(
        ({ pathFamily }) => pathFamily === 'https://example.com/guides/cats/'
      )
    ).toMatchObject({
      pages: 1,
      matchedPages: 1,
      googleAiImpressions: 20,
      citationEvents: 1,
      ownedCitedPages: 1,
    });

    const csv = renderGoogleAiCitationConcordanceCsv(report);
    expect(csv.split('\n')[0]).toContain('join_state');
    expect(csv).toContain('https://example.com/guides/cats/article');
    const html = renderGoogleAiCitationConcordanceHtml(report);
    expect(html).toContain('Google AI citation concordance');
    expect(html).toContain('independent measurement sources');
    expect(html).not.toContain('<script src=');
  });

  it('rejects non-page exports and unsupported path-family depths', () => {
    const answers = analyzeAiAnswerCitationObservations(
      {
        schemaVersion: 1,
        observations: [
          {
            observedAt: '2026-09-30T10:00:00Z',
            provider: 'Answer engine',
            prompt: 'best indoor cat food',
            citedUrls: ['https://example.com/cats'],
          },
        ],
      },
      [],
      '2026-10-01T00:00:00Z'
    );
    const invalidDataset = {
      surface: 'search',
      datasetKind: 'query',
      dimensions: ['url'],
      rows: [],
    } as unknown as GoogleAiPerformanceExport;
    const pageDataset = {
      surface: 'search',
      datasetKind: 'page',
      dimensions: ['url'],
      rows: [],
    } as unknown as GoogleAiPerformanceExport;

    expect(() => analyzeGoogleAiCitationConcordance(invalidDataset, answers)).toThrow(
      'Google AI citation concordance requires a page-dimension export with page URLs.'
    );
    expect(() => analyzeGoogleAiCitationConcordance(pageDataset, answers, 0)).toThrow(
      'Citation concordance path depth must be an integer from 1 to 5.'
    );
  });

  it('validates saved reports and compares page, provider, and sample changes safely', () => {
    const googleAi: GoogleAiPerformanceExport = {
      sourceFile: 'period.csv',
      surface: 'search',
      datasetKind: 'page',
      dimensions: ['url'],
      headerRow: 1,
      rowCount: 2,
      skippedRows: 0,
      uniquePageCount: 2,
      columns: { url: 'Page', impressions: 'Impressions' },
      rows: [
        { url: 'https://example.com/guides/cats/article', impressions: 20 },
        { url: 'https://example.com/products/cat-food', impressions: 5 },
      ],
    };
    const answers = analyzeAiAnswerCitationObservations(
      {
        schemaVersion: 1,
        observations: [
          {
            observedAt: '2026-09-30T10:00:00Z',
            provider: 'Answer engine',
            prompt: 'best indoor cat food',
            citedUrls: ['https://example.com/guides/cats/article'],
            citationListComplete: true,
          },
        ],
      },
      ['example.com'],
      '2026-10-01T00:00:00Z'
    );
    const baseline = analyzeGoogleAiCitationConcordance(googleAi, answers);
    expect(isGoogleAiCitationConcordanceReport(baseline)).toBe(true);
    expect(
      isGoogleAiCitationConcordanceReport({ ...baseline, rows: [{ url: 'javascript:alert(1)' }] })
    ).toBe(false);
    expect(isGoogleAiCitationConcordanceReport({ ...baseline, answerObservations: -1 })).toBe(
      false
    );

    const current = structuredClone(baseline);
    current.googleAiSourceFile = 'current.csv';
    const matched = current.rows.find((row) => row.joinState === 'matched')!;
    matched.googleAiImpressions = (matched.googleAiImpressions ?? 0) + 3;
    matched.citationEvents = (matched.citationEvents ?? 0) + 1;
    matched.providerMetrics = [
      { provider: 'Answer engine', citationEvents: 2, pageAnswerPairs: 1, pagePromptPairs: 1 },
      { provider: 'Current-only', citationEvents: 1, pageAnswerPairs: 1, pagePromptPairs: 1 },
    ];
    const newlyMatched = current.rows.find((row) => row.joinState === 'google-ai-only')!;
    newlyMatched.joinState = 'matched';
    newlyMatched.citationEvents = 1;
    newlyMatched.pageAnswerPairs = 1;
    newlyMatched.pagePromptPairs = 1;

    const baselineMatched = structuredClone(matched);
    baselineMatched.url = 'https://example.com/lost-match';
    baseline.rows.push(baselineMatched);
    const currentLost = structuredClone(baselineMatched);
    currentLost.joinState = 'google-ai-only';
    currentLost.citationEvents = 0;
    current.rows.push(currentLost);

    const baselineGoogleOnly = structuredClone(
      baseline.rows.find((row) => row.joinState === 'google-ai-only')!
    );
    baselineGoogleOnly.url = 'https://example.com/changed-unmatched';
    baseline.rows.push(baselineGoogleOnly);
    const currentAnswerOnly = structuredClone(baselineGoogleOnly);
    currentAnswerOnly.joinState = 'observed-answer-only';
    currentAnswerOnly.googleAiImpressions = 0;
    current.rows.push(currentAnswerOnly);

    const answerOnly = structuredClone(baselineMatched);
    answerOnly.url = 'https://independent.example/unmatched';
    answerOnly.joinState = 'observed-answer-only';
    answerOnly.googleAiImpressions = 0;
    baseline.rows.push(answerOnly);

    const baselineUnmatched = structuredClone(
      baseline.rows.find((row) => row.joinState === 'observed-answer-only')!
    );
    baselineUnmatched.url = 'https://example.com/unchanged-unmatched';
    baseline.rows.push(baselineUnmatched);
    current.rows.push(structuredClone(baselineUnmatched));

    current.rows = current.rows.filter((row) => row.url !== 'https://independent.example/cat-food');
    const appeared = structuredClone(baselineGoogleOnly);
    appeared.url = 'https://example.com/appeared';
    current.rows.push(appeared);

    baseline.answerProviderSamples = [
      {
        provider: 'Answer engine',
        observations: 2,
        uniquePrompts: 2,
        citationEvents: 3,
        incompleteCitationListObservations: 0,
      },
      {
        provider: 'Baseline-only',
        observations: 1,
        uniquePrompts: 1,
        citationEvents: 1,
        incompleteCitationListObservations: null,
      },
    ];
    current.answerProviderSamples = [
      {
        provider: 'Answer engine',
        observations: 3,
        uniquePrompts: 2,
        citationEvents: 4,
        incompleteCitationListObservations: 0,
      },
      {
        provider: 'Current-only',
        observations: 1,
        uniquePrompts: 1,
        citationEvents: 1,
        incompleteCitationListObservations: 1,
      },
    ];

    const comparison = compareGoogleAiCitationConcordanceReports(baseline, current);
    expect(comparison.rows.map(({ transition }) => transition)).toEqual(
      expect.arrayContaining([
        'matched-both',
        'newly-matched',
        'lost-match',
        'appeared',
        'disappeared',
        'changed-unmatched',
        'unchanged-unmatched',
      ])
    );
    expect(comparison.rows.find(({ url }) => url.endsWith('/article'))).toMatchObject({
      transition: 'matched-both',
      googleAiImpressionsChange: 3,
      citationEventsChange: 1,
    });
    expect(comparison.providerChanges.map(({ detailState }) => detailState)).toEqual(
      expect.arrayContaining(['present-both', 'current-detail-only', 'baseline-detail-only'])
    );
    expect(comparison.providerSampleChanges.map(({ detailState }) => detailState)).toEqual(
      expect.arrayContaining(['present-both', 'current-detail-only', 'baseline-detail-only'])
    );

    const csv = renderGoogleAiCitationConcordanceComparisonCsv(comparison);
    const providerCsv = renderGoogleAiCitationConcordanceProviderComparisonCsv(comparison);
    expect(csv.split('\n')[0]).toContain('google_ai_impressions_change');
    expect(providerCsv.split('\n')[0]).toContain('provider_sample_detail_state');
    expect(renderGoogleAiCitationConcordanceComparisonHtml(comparison)).toContain(
      'Page transitions'
    );

    expect(() =>
      compareGoogleAiCitationConcordanceReports(baseline, {
        ...current,
        googleAiSurface: 'discover',
      } as GoogleAiCitationConcordanceReport)
    ).toThrow('same Search or Discover surface');
    expect(() =>
      compareGoogleAiCitationConcordanceReports(baseline, {
        ...current,
        auditCanonicalBridgeAvailable: true,
      } as GoogleAiCitationConcordanceReport)
    ).toThrow('same canonical-bridge availability');
    expect(() =>
      compareGoogleAiCitationConcordanceReports(baseline, {
        ...current,
        ownedDomainAssessmentEnabled: false,
      } as GoogleAiCitationConcordanceReport)
    ).toThrow('same owned-domain assessment setting');
  });
});
