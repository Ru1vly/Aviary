import { describe, expect, it } from 'vitest';
import {
  compareGoogleAiSurfaceMatrices,
  compareGoogleAiSurfacePageObservations,
  isGoogleSurfacePageMatrix,
} from '../../src/geo/googleSurfaceMatrix';
import type {
  GoogleAiPerformanceExport,
  GoogleAiPerformanceRow,
} from '../../src/geo/googleAiPerformance';

function exportFor(
  surface: 'search' | 'discover',
  rows: GoogleAiPerformanceRow[],
  sourceFile = `${surface}.csv`
): GoogleAiPerformanceExport {
  return {
    sourceFile,
    surface,
    datasetKind: 'page',
    dimensions: ['url'],
    headerRow: 1,
    rowCount: rows.length,
    skippedRows: 0,
    uniquePageCount: new Set(rows.flatMap(({ url }) => (url ? [url] : []))).size,
    columns: { url: 'Page', impressions: 'Impressions' },
    rows,
  };
}

describe('Google AI Search and Discover surface matrix', () => {
  it('joins normalized pages without combining surface counts or treating unusable URLs as pages', () => {
    const matrix = compareGoogleAiSurfacePageObservations(
      exportFor('search', [
        { url: 'https://example.com/a#first', impressions: 30 },
        { url: 'https://example.com/a', impressions: 10 },
        { url: 'https://example.com/b', impressions: 60 },
        { url: 'javascript:alert(1)', impressions: 7 },
      ]),
      exportFor('discover', [
        { url: 'https://example.com/a', impressions: 20 },
        { url: 'https://example.com/c', impressions: 80 },
        { impressions: 9 },
      ]),
      undefined,
      { pathFamilyDepth: 1 }
    );

    expect(matrix).toMatchObject({
      searchPages: 2,
      discoverPages: 2,
      pagesObservedByBoth: 1,
      pagesOnlyInSearchExport: 1,
      pagesOnlyInDiscoverExport: 1,
      searchExportRowSummedImpressions: 107,
      discoverExportRowSummedImpressions: 109,
      searchUsableUrlImpressions: 100,
      discoverUsableUrlImpressions: 100,
      searchImpressionShareOnBothPagesPercent: 40,
      discoverImpressionShareOnBothPagesPercent: 20,
      rowsWithoutUsableUrl: { searchRows: 1, discoverRows: 1 },
      pathFamilyDepth: 1,
      pathFamilyCount: 3,
      pagesTruncated: false,
    });
    expect(matrix.pages.find(({ url }) => url === 'https://example.com/a')).toMatchObject({
      coverage: 'search-and-discover',
      searchImpressions: 40,
      searchImpressionSharePercent: 40,
      discoverImpressions: 20,
      discoverImpressionSharePercent: 20,
      searchMinusDiscoverSharePercentagePoints: 20,
      searchSourceUrls: ['https://example.com/a', 'https://example.com/a#first'],
    });
    expect(isGoogleSurfacePageMatrix(matrix)).toBe(true);
    expect(isGoogleSurfacePageMatrix({ ...matrix, pathFamilyDepth: 6 })).toBe(false);
  });

  it('compares matched, appearing, and disappearing pages with independent share movement', () => {
    const baseline = compareGoogleAiSurfacePageObservations(
      exportFor(
        'search',
        [
          { url: 'https://example.com/a', impressions: 30 },
          { url: 'https://example.com/b', impressions: 70 },
          { url: 'https://example.com/old', impressions: 5 },
        ],
        'search-old.csv'
      ),
      exportFor(
        'discover',
        [
          { url: 'https://example.com/a', impressions: 10 },
          { url: 'https://example.com/c', impressions: 90 },
        ],
        'discover-old.csv'
      ),
      undefined,
      { pathFamilyDepth: 1 }
    );
    const current = compareGoogleAiSurfacePageObservations(
      exportFor(
        'search',
        [
          { url: 'https://example.com/a', impressions: 40 },
          { url: 'https://example.com/b', impressions: 60 },
          { url: 'https://example.com/new', impressions: 5 },
        ],
        'search-new.csv'
      ),
      exportFor(
        'discover',
        [
          { url: 'https://example.com/a', impressions: 20 },
          { url: 'https://example.com/c', impressions: 80 },
        ],
        'discover-new.csv'
      ),
      undefined,
      { pathFamilyDepth: 1 }
    );

    const comparison = compareGoogleAiSurfaceMatrices(current, baseline);
    expect(comparison).toMatchObject({
      baselineSearchSourceFile: 'search-old.csv',
      currentDiscoverSourceFile: 'discover-new.csv',
      pagesPresentInBothReturnedLists: 3,
      pagesOnlyInCurrentReturnedList: 1,
      pagesOnlyInBaselineReturnedList: 1,
      searchPagesWithComparableImpressions: 2,
      discoverPagesWithComparableImpressions: 2,
      searchPagesWithIncreasingShare: 1,
      searchPagesWithDecreasingShare: 1,
      discoverPagesWithIncreasingShare: 1,
      discoverPagesWithDecreasingShare: 1,
      matchedSearchImpressionChange: 0,
      matchedDiscoverImpressionChange: 0,
    });
    expect(comparison.pages.find(({ url }) => url.endsWith('/a'))).toMatchObject({
      state: 'present-both',
      searchImpressionChange: 10,
      searchShareChangePercentagePoints: 9.52,
      discoverImpressionChange: 10,
      discoverShareChangePercentagePoints: 10,
    });
    expect(comparison.pages.map(({ state }) => state)).toEqual(
      expect.arrayContaining(['current-only', 'baseline-only'])
    );
    expect(comparison.pathFamilyComparison?.families).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'https://example.com/old', state: 'baseline-only' }),
        expect.objectContaining({ family: 'https://example.com/new', state: 'current-only' }),
      ])
    );
    expect(comparison.note).not.toContain('different or absent path depths');

    const differentDepth = compareGoogleAiSurfaceMatrices(
      { ...current, pathFamilyDepth: 2 },
      baseline
    );
    expect(differentDepth.pathFamilyComparison).toBeUndefined();
    expect(differentDepth.note).toContain('different or absent path depths');
  });

  it('rejects incompatible source surfaces, dimensions, and family-depth settings', () => {
    const search = exportFor('search', []);
    const discover = exportFor('discover', []);
    expect(() => compareGoogleAiSurfacePageObservations(discover, search)).toThrow(
      'one Search export and one Discover export'
    );
    expect(() =>
      compareGoogleAiSurfacePageObservations({ ...search, dimensions: ['url', 'device'] }, discover)
    ).toThrow('page-dimension exports');
    expect(() =>
      compareGoogleAiSurfacePageObservations(search, discover, undefined, { pathFamilyDepth: 0 })
    ).toThrow('path-family depth must be an integer from 1 to 5');
  });
});
