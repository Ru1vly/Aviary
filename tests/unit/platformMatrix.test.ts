import { describe, expect, it } from 'vitest';
import type { BingAiPerformanceExport } from '../../src/geo/bingAiPerformance';
import type { GoogleAiPerformanceExport } from '../../src/geo/googleAiPerformance';
import {
  compareAiPlatformPageMatrices,
  compareAiPlatformPageObservations,
  isAiPlatformPageMatrix,
} from '../../src/geo/platformMatrix';

function googleExport(): GoogleAiPerformanceExport {
  return {
    surface: 'search',
    datasetKind: 'page',
    dimensions: ['url'],
    headerRow: 1,
    rowCount: 3,
    skippedRows: 0,
    uniquePageCount: 3,
    columns: {},
    rows: [
      { url: 'https://example.com/guides/cat-food#google', impressions: 60 },
      { url: 'https://example.com/guides/senior-cats', impressions: 30 },
      { url: 'not a url', impressions: 10 },
    ],
  };
}

function bingExport(): BingAiPerformanceExport {
  return {
    datasetKind: 'page-citations',
    headerRow: 1,
    rowCount: 3,
    skippedRows: 0,
    uniquePageCount: 3,
    uniqueQueryCount: 0,
    columns: {},
    rows: [
      {
        url: 'https://example.com/guides/cat-food#bing',
        citations: 8,
        citedPages: 2,
        citationShare: 0.25,
      },
      {
        url: 'https://example.com/reviews/cat-food',
        citations: 2,
        citedPages: 1,
        citationShare: 0.1,
      },
      { citations: 4, citedPages: 1 },
    ],
  };
}

describe('cross-platform GEO page matrix', () => {
  it('joins normalized platform pages and reports share gaps, sitemap membership, and path families', () => {
    const matrix = compareAiPlatformPageObservations(
      googleExport(),
      bingExport(),
      undefined,
      {
        url: 'https://example.com/sitemap.xml',
        pageUrls: ['https://example.com/guides/cat-food', 'https://example.com/reviews/cat-food'],
        resultMayBeTruncated: false,
      },
      { pathFamilyDepth: 2 }
    );

    expect(isAiPlatformPageMatrix(matrix)).toBe(true);
    expect(matrix.pagesObservedByBoth).toBe(1);
    expect(matrix.pagesOnlyInGoogleExport).toBe(1);
    expect(matrix.pagesOnlyInBingExport).toBe(1);
    expect(matrix.rowsWithoutUsableUrl).toEqual({ googleRows: 1, bingRows: 1 });
    expect(matrix.sitemapCoverage?.pagesFoundInSuppliedSitemapList).toBe(2);
    expect(matrix.pathFamilyDepth).toBe(2);
    expect(matrix.pathFamilies?.length).toBeGreaterThan(0);
    const shared = matrix.pages.find((page) => page.coverage === 'both-observed');
    expect(shared).toMatchObject({
      url: 'https://example.com/guides/cat-food',
      googleSearchAiImpressions: 60,
      bingAiCitations: 8,
      bingCitedPages: 2,
    });
  });

  it('compares snapshots by canonical URL and rejects malformed matrix inputs', () => {
    const current = compareAiPlatformPageObservations(googleExport(), bingExport());
    const baseline = {
      ...current,
      pages: current.pages.map((page) => ({ ...page })),
    };
    baseline.pages[0] = {
      ...baseline.pages[0]!,
      url: `${baseline.pages[0]!.url}#baseline`,
      googleSearchAiImpressions: 12,
      bingAiCitations: 1,
    };

    const comparison = compareAiPlatformPageMatrices(current, baseline);

    expect(comparison.pages.some((row) => row.state === 'present-both')).toBe(true);
    expect(comparison.googlePagesWithComparableImpressions).toBeGreaterThan(0);
    expect(isAiPlatformPageMatrix({ ...current, pages: [{ ...current.pages[0], url: '' }] })).toBe(
      false
    );
    expect(() =>
      compareAiPlatformPageObservations(googleExport(), bingExport(), undefined, undefined, {
        pathFamilyDepth: 6,
      })
    ).toThrow('GEO path-family depth must be an integer from 1 to 5.');
  });
});
