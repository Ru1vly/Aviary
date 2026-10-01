import {
  analyzeBingAiQueryPageMapping,
  compareBingAiQueryPageMappings,
  parseBingAiPerformanceCsvExport,
  summarizeBingAiPerformanceExport,
} from '../../src/geo/bingAiPerformance';

describe('Bing AI performance exports', () => {
  it('detects localized CSV columns and parses citation metrics and shares', () => {
    const parsed = parseBingAiPerformanceCsvExport(
      '\uFEFFBing AI Performance export\r\nSayfa;Sorgu;Tarih;Atıf sayısı;Atıf payı\r\nhttps://example.com/a#one;"how to compare; sources";2026-03-01;"1.234";"12,5%"\r\nhttps://example.com/b;weather;2026-03-02;—;not available',
      { sourceFile: 'bing-export.csv' }
    );

    expect(parsed).toMatchObject({
      sourceFile: 'bing-export.csv',
      datasetKind: 'query-page-mapping',
      headerRow: 2,
      rowCount: 1,
      skippedRows: 1,
      uniquePageCount: 1,
      uniqueQueryCount: 1,
      rows: [
        {
          url: 'https://example.com/a#one',
          query: 'how to compare; sources',
          date: '2026-03-01',
          citations: 1234,
          citationShare: 12.5,
        },
      ],
    });
  });

  it('validates bounded CSV inputs and requires both a dimension and a citation metric', () => {
    expect(() => parseBingAiPerformanceCsvExport('Page,Citations\na,1', { maxBytes: 1 })).toThrow(
      /byte limit/
    );
    expect(() => parseBingAiPerformanceCsvExport('Page,Citations\na,1', { maxRows: 0 })).toThrow(
      /maxRows/
    );
    expect(() =>
      parseBingAiPerformanceCsvExport('Page,Citations\na,1\nb,2', { maxRows: 1 })
    ).toThrow(/more than 1 valid data rows/);
    expect(() => parseBingAiPerformanceCsvExport('Page,Citations\n"unfinished,3')).toThrow(
      /unterminated quoted field/
    );
    expect(() => parseBingAiPerformanceCsvExport('Page,Citations')).toThrow(
      /header row and at least one data row/
    );
    expect(() => parseBingAiPerformanceCsvExport('Title\nno columns')).toThrow(
      /Could not identify a Bing AI Performance CSV header/
    );
    expect(() => parseBingAiPerformanceCsvExport('Page,Citations\na,invalid')).toThrow(
      /no rows contained a page, query, or date/
    );
  });

  it('summarizes time series and groups normalized pages, queries, topics and intents', () => {
    const parsed = parseBingAiPerformanceCsvExport(
      'Page,Grounding Query,Date,Citations,Cited Pages,Citation Share,Topic,Intent\nhttps://example.com/a#one,How   to cite,2026-02-01,10,2,50%,AI Search,Informational\nhttps://example.com/a#two,how to cite,2026-01-01,20,3,10%,ai search,informational\nhttps://example.com/b,weather,2026-03-01,5,1,20%,Weather,Transactional'
    );
    const summary = summarizeBingAiPerformanceExport(parsed);

    expect(summary).toMatchObject({
      totalCitations: 35,
      totalCitedPages: 6,
      averageCitationShare: (50 + 10 + 20) / 3,
      firstToLastCitationChange: {
        firstPeriod: '2026-01-01',
        lastPeriod: '2026-03-01',
        absoluteChange: -15,
        percentChange: -75,
      },
    });
    expect(summary.topPages[0]).toMatchObject({
      value: 'https://example.com/a',
      rows: 2,
      citations: 30,
      citedPages: 5,
    });
    expect(summary.topQueries[0]).toMatchObject({ value: 'How to cite', rows: 2, citations: 30 });
    expect(summary.topTopics[0]).toMatchObject({ value: 'AI Search', rows: 2, citations: 30 });
    expect(summary.topIntents[0]).toMatchObject({ value: 'Informational', rows: 2, citations: 30 });
    expect(summary.timeSeries.map(({ period, citations }) => [period, citations])).toEqual([
      ['2026-01-01', 20],
      ['2026-02-01', 10],
      ['2026-03-01', 5],
    ]);
    expect(summary.note).toContain('may overlap');
  });

  it('classifies query-only, topic-only and overview dataset shapes', () => {
    expect(parseBingAiPerformanceCsvExport('Query,Citations\n"  how   to  ",2').datasetKind).toBe(
      'grounding-queries'
    );
    expect(parseBingAiPerformanceCsvExport('Topic,Citations\nTravel,2').datasetKind).toBe(
      'topic-summary'
    );
    expect(parseBingAiPerformanceCsvExport('Intent,Citations\nTransactional,2').datasetKind).toBe(
      'intent-summary'
    );
    expect(
      parseBingAiPerformanceCsvExport('Topic,Intent,Citations\nTravel,Explore,2').datasetKind
    ).toBe('topic-intent-summary');
    expect(parseBingAiPerformanceCsvExport('Date,Citations\n2026-03-01,2').datasetKind).toBe(
      'time-series'
    );
  });

  it('analyzes exact query-page mappings and reports concentration over measured pages only', () => {
    const parsed = parseBingAiPerformanceCsvExport(
      'Page,Grounding Query,Citations,Cited Pages,Topic,Intent\nhttps://example.com/a#one,What   is SEO,8,2,Web,Informational\nhttps://example.com/a#two,what is seo,2,1,AI,Informational\nhttps://example.com/b,what is seo,10,3,AI,Commercial\n,orphan query,4,1,,'
    );
    const analysis = analyzeBingAiQueryPageMapping(parsed);
    const mainQuery = analysis.queryGroups.find(
      ({ query }) => query.toLowerCase() === 'what is seo'
    );

    expect(analysis).toMatchObject({
      mappingRows: 3,
      queryCount: 2,
      pageCount: 2,
      queriesMappedToMultiplePages: 1,
      queriesWithoutMappedPages: 1,
      queryRowsWithoutUsableUrl: 1,
    });
    expect(mainQuery).toMatchObject({
      rows: 3,
      pageCount: 2,
      citations: 20,
      citedPages: 6,
      topics: ['AI', 'Web'],
      intents: ['Commercial', 'Informational'],
      citationDistribution: {
        pagesWithCitationMetric: 2,
        pagesWithoutCitationMetric: 0,
        citationsAcrossMeasuredPages: 20,
        largestPageCitationSharePercent: 50,
        herfindahlIndex: 0.5,
        effectiveCitationPages: 2,
      },
    });
    expect(mainQuery?.pages[0]).toMatchObject({
      url: 'https://example.com/a',
      rows: 2,
      citations: 10,
      citedPages: 3,
    });
    expect(analysis.queryGroups.find(({ query }) => query === 'orphan query')).toMatchObject({
      pageCount: 0,
      topics: [],
      intents: [],
    });
    expect(analysis.citationDistributionSummary).toMatchObject({
      queriesWithMeasuredDistribution: 1,
      queriesWithPartialPageMetricCoverage: 0,
      medianLargestPageCitationSharePercent: 50,
      medianEffectiveCitationPages: 2,
    });
  });

  it('compares query-page mappings only where exact URL pairs and citation metrics overlap', () => {
    const baseline = parseBingAiPerformanceCsvExport(
      'Page,Grounding Query,Citations,Cited Pages\nhttps://example.com/a,How to cite,5,1\nhttps://example.com/b,How to cite,2,1\nhttps://example.com/old,Old query,1,1',
      { sourceFile: 'baseline.csv' }
    );
    const current = parseBingAiPerformanceCsvExport(
      'Page,Grounding Query,Citations,Cited Pages\nhttps://example.com/a#current,how   to cite,8,2\nhttps://example.com/b,How to cite,,2\nhttps://example.com/c,How to cite,4,1\nhttps://example.com/new,New query,3,1',
      { sourceFile: 'current.csv' }
    );
    const comparison = compareBingAiQueryPageMappings(current, baseline);

    expect(comparison).toMatchObject({
      baselineSourceFile: 'baseline.csv',
      currentSourceFile: 'current.csv',
      baselineQueryCount: 2,
      currentQueryCount: 2,
      queriesPresentInBoth: 1,
      queriesOnlyInCurrentExport: 1,
      queriesOnlyInBaselineExport: 1,
      pageMappingsCompared: 2,
      pageMappingsOnlyInCurrentExport: 2,
      pageMappingsOnlyInBaselineExport: 1,
      pageMappingsWithUnavailableCitationMetric: 1,
      matchedBaselineCitations: 5,
      matchedCurrentCitations: 8,
      matchedCitationChange: 3,
    });
    expect(
      comparison.queryGroups.find(({ query }) => query.toLowerCase() === 'how to cite')
    ).toMatchObject({
      state: 'present-both',
      mappedPagePairCount: 3,
      pagesCompared: 2,
      pagesWithUnavailableCitationMetric: 1,
      matchedCitationChange: 3,
      pages: [
        {
          url: 'https://example.com/a',
          state: 'present-both',
          baselineCitations: 5,
          currentCitations: 8,
          citationChange: 3,
        },
        { url: 'https://example.com/b', state: 'metric-unavailable' },
        { url: 'https://example.com/c', state: 'current-only' },
      ],
    });
    expect(() =>
      compareBingAiQueryPageMappings(current, { ...baseline, datasetKind: 'page-citations' })
    ).toThrow(/require two query-page-mapping exports/);
  });
});
