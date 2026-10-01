import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  analyzeGoogleAiCitationConcordance,
  renderGoogleAiCitationConcordanceCsv,
  renderGoogleAiCitationConcordanceHtml,
} from '../../src/geo/googleAiCitationConcordance';
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
});
