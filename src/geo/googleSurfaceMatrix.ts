import type { SEOAuditBatchReport, SEOReport } from '../types';
import type { SiteWideGeoAnalysis } from '../sitewide';
import {
  correlateGoogleAiPerformanceWithAudit,
  type GoogleAiCitedPageAuditRow,
  type GoogleAiPerformanceExport,
} from './googleAiPerformance';

export type GoogleSurfacePageCoverage = 'search-and-discover' | 'search-only' | 'discover-only';

export interface GoogleSurfacePageAuditSignals {
  matchType: 'exact-url' | 'canonical-url' | 'ambiguous-canonical' | 'unmatched';
  auditUrl?: string;
  googlebotAccess: 'allowed' | 'blocked' | 'not-assessed';
  noindex?: boolean;
  noSnippet?: boolean;
  maxSnippetZero?: boolean;
  dataNoSnippetElements?: number;
  documentLanguage?: string;
  documentLanguageValid?: boolean;
}

export interface GoogleSurfacePageObservation {
  url: string;
  pathFamily?: string;
  coverage: GoogleSurfacePageCoverage;
  searchSourceUrls: string[];
  discoverSourceUrls: string[];
  searchSourceUrlsTruncated: boolean;
  discoverSourceUrlsTruncated: boolean;
  searchImpressions?: number;
  searchImpressionSharePercent?: number;
  discoverImpressions?: number;
  discoverImpressionSharePercent?: number;
  searchMinusDiscoverSharePercentagePoints?: number;
  currentAudit?: GoogleSurfacePageAuditSignals;
}

export interface GoogleSurfacePathFamily {
  family: string;
  pageGroups: number;
  searchPages: number;
  discoverPages: number;
  pagesObservedByBoth: number;
  pagesWithCurrentAudit: number;
  pagesWithAmbiguousCanonical: number;
  googlebotBlockedPages: number;
  pagesWithIndexingRestrictions: number;
  pagesWithSnippetRestrictions: number;
  searchImpressions?: number;
  searchImpressionSharePercent?: number;
  discoverImpressions?: number;
  discoverImpressionSharePercent?: number;
  searchMinusDiscoverSharePercentagePoints?: number;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
}

export interface GoogleSurfacePathFamilyPeriodChange {
  family: string;
  state: 'current-only' | 'baseline-only' | 'present-both';
  baselinePageGroups?: number;
  currentPageGroups?: number;
  baselineSearchImpressions?: number;
  currentSearchImpressions?: number;
  baselineSearchImpressionSharePercent?: number;
  currentSearchImpressionSharePercent?: number;
  searchImpressionChange?: number;
  searchImpressionShareChangePercentagePoints?: number;
  baselineDiscoverImpressions?: number;
  currentDiscoverImpressions?: number;
  baselineDiscoverImpressionSharePercent?: number;
  currentDiscoverImpressionSharePercent?: number;
  discoverImpressionChange?: number;
  discoverImpressionShareChangePercentagePoints?: number;
}

export interface GoogleSurfacePathFamilyComparison {
  pathFamilyDepth: number;
  baselineFamilyCount: number;
  currentFamilyCount: number;
  familiesPresentInBothReturnedLists: number;
  familiesOnlyInCurrentReturnedList: number;
  familiesOnlyInBaselineReturnedList: number;
  baselineFamiliesTruncated: boolean;
  currentFamiliesTruncated: boolean;
  families: GoogleSurfacePathFamilyPeriodChange[];
  familiesTruncated: boolean;
  note: string;
}

export interface GoogleSurfacePageMatrix {
  source: 'Aviary Google AI surface page matrix';
  schemaVersion: 1;
  searchSourceFile?: string;
  discoverSourceFile?: string;
  searchPages: number;
  discoverPages: number;
  pagesObservedByBoth: number;
  pagesOnlyInSearchExport: number;
  pagesOnlyInDiscoverExport: number;
  searchExportRowSummedImpressions: number;
  discoverExportRowSummedImpressions: number;
  searchUsableUrlImpressions?: number;
  discoverUsableUrlImpressions?: number;
  pagesWithComparableShares: number;
  searchImpressionShareOnBothPagesPercent?: number;
  discoverImpressionShareOnBothPagesPercent?: number;
  rowsWithoutUsableUrl: { searchRows: number; discoverRows: number };
  pages: GoogleSurfacePageObservation[];
  pagesTruncated: boolean;
  pathFamilyDepth?: number;
  pathFamilyCount?: number;
  pathFamilies?: GoogleSurfacePathFamily[];
  pathFamiliesTruncated?: boolean;
  periodComparison?: GoogleSurfacePeriodComparison;
  note: string;
}

export interface GoogleSurfacePagePeriodChange {
  url: string;
  state: 'current-only' | 'baseline-only' | 'present-both';
  baselineSearchImpressions?: number;
  currentSearchImpressions?: number;
  searchImpressionChange?: number;
  searchShareChangePercentagePoints?: number;
  baselineDiscoverImpressions?: number;
  currentDiscoverImpressions?: number;
  discoverImpressionChange?: number;
  discoverShareChangePercentagePoints?: number;
}

export interface GoogleSurfacePeriodComparison {
  baselineSearchSourceFile?: string;
  baselineDiscoverSourceFile?: string;
  currentSearchSourceFile?: string;
  currentDiscoverSourceFile?: string;
  baselinePagesTruncated: boolean;
  currentPagesTruncated: boolean;
  pagesPresentInBothReturnedLists: number;
  pagesOnlyInCurrentReturnedList: number;
  pagesOnlyInBaselineReturnedList: number;
  searchPagesWithComparableImpressions: number;
  discoverPagesWithComparableImpressions: number;
  searchPagesWithComparableShare: number;
  discoverPagesWithComparableShare: number;
  searchPagesWithIncreasingShare: number;
  searchPagesWithDecreasingShare: number;
  discoverPagesWithIncreasingShare: number;
  discoverPagesWithDecreasingShare: number;
  matchedSearchImpressionChange?: number;
  matchedDiscoverImpressionChange?: number;
  pages: GoogleSurfacePagePeriodChange[];
  pagesTruncated: boolean;
  pathFamilyComparison?: GoogleSurfacePathFamilyComparison;
  note: string;
}

const MAX_MATRIX_PAGES = 1_000;
const MAX_PERIOD_COMPARISON_PAGES = MAX_MATRIX_PAGES * 2;
const MAX_PATH_FAMILIES = 250;
const MAX_PATH_FAMILY_SAMPLE_URLS = 5;
const MAX_PATH_FAMILY_COMPARISON = MAX_PATH_FAMILIES * 2;
const MAX_SOURCE_URLS = 10;

function normalizeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

function pathFamilyForUrl(value: string, depth: number): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    const segments = url.pathname.split('/').filter(Boolean).slice(0, depth);
    return `${url.origin}${segments.length > 0 ? `/${segments.join('/')}` : '/'}`;
  } catch {
    return undefined;
  }
}

function summarizePathFamilies(
  pages: GoogleSurfacePageObservation[],
  depth: number,
  searchTotal: number,
  discoverTotal: number
): GoogleSurfacePathFamily[] {
  type Bucket = {
    pages: number;
    searchPages: number;
    discoverPages: number;
    pagesObservedByBoth: number;
    pagesWithCurrentAudit: number;
    pagesWithAmbiguousCanonical: number;
    googlebotBlockedPages: number;
    pagesWithIndexingRestrictions: number;
    pagesWithSnippetRestrictions: number;
    searchImpressions: number;
    discoverImpressions: number;
    sampleUrls: string[];
  };
  const groups = new Map<string, Bucket>();
  for (const page of pages) {
    const family = pathFamilyForUrl(page.url, depth);
    if (!family) continue;
    page.pathFamily = family;
    const group = groups.get(family) ?? {
      pages: 0,
      searchPages: 0,
      discoverPages: 0,
      pagesObservedByBoth: 0,
      pagesWithCurrentAudit: 0,
      pagesWithAmbiguousCanonical: 0,
      googlebotBlockedPages: 0,
      pagesWithIndexingRestrictions: 0,
      pagesWithSnippetRestrictions: 0,
      searchImpressions: 0,
      discoverImpressions: 0,
      sampleUrls: [],
    };
    group.pages += 1;
    if (page.searchImpressions !== undefined) {
      group.searchPages += 1;
      group.searchImpressions += page.searchImpressions;
    }
    if (page.discoverImpressions !== undefined) {
      group.discoverPages += 1;
      group.discoverImpressions += page.discoverImpressions;
    }
    if (page.coverage === 'search-and-discover') group.pagesObservedByBoth += 1;
    if (
      page.currentAudit?.matchType === 'exact-url' ||
      page.currentAudit?.matchType === 'canonical-url'
    )
      group.pagesWithCurrentAudit += 1;
    if (page.currentAudit?.matchType === 'ambiguous-canonical')
      group.pagesWithAmbiguousCanonical += 1;
    if (page.currentAudit?.googlebotAccess === 'blocked') group.googlebotBlockedPages += 1;
    if (page.currentAudit?.noindex === true) group.pagesWithIndexingRestrictions += 1;
    if (
      page.currentAudit?.noSnippet === true ||
      page.currentAudit?.maxSnippetZero === true ||
      (page.currentAudit?.dataNoSnippetElements ?? 0) > 0
    )
      group.pagesWithSnippetRestrictions += 1;
    if (group.sampleUrls.length < MAX_PATH_FAMILY_SAMPLE_URLS) group.sampleUrls.push(page.url);
    groups.set(family, group);
  }
  return [...groups.entries()]
    .sort(
      ([leftFamily, left], [rightFamily, right]) =>
        right.pages - left.pages || leftFamily.localeCompare(rightFamily)
    )
    .slice(0, MAX_PATH_FAMILIES)
    .map(([family, group]) => ({
      family,
      pageGroups: group.pages,
      searchPages: group.searchPages,
      discoverPages: group.discoverPages,
      pagesObservedByBoth: group.pagesObservedByBoth,
      pagesWithCurrentAudit: group.pagesWithCurrentAudit,
      pagesWithAmbiguousCanonical: group.pagesWithAmbiguousCanonical,
      googlebotBlockedPages: group.googlebotBlockedPages,
      pagesWithIndexingRestrictions: group.pagesWithIndexingRestrictions,
      pagesWithSnippetRestrictions: group.pagesWithSnippetRestrictions,
      ...(searchTotal > 0
        ? {
            searchImpressions: group.searchImpressions,
            searchImpressionSharePercent: Number(
              ((group.searchImpressions / searchTotal) * 100).toFixed(2)
            ),
          }
        : {}),
      ...(discoverTotal > 0
        ? {
            discoverImpressions: group.discoverImpressions,
            discoverImpressionSharePercent: Number(
              ((group.discoverImpressions / discoverTotal) * 100).toFixed(2)
            ),
          }
        : {}),
      ...(searchTotal > 0 && discoverTotal > 0
        ? {
            searchMinusDiscoverSharePercentagePoints: Number(
              (
                (group.searchImpressions / searchTotal -
                  group.discoverImpressions / discoverTotal) *
                100
              ).toFixed(2)
            ),
          }
        : {}),
      sampleUrls: group.sampleUrls,
      sampleUrlsTruncated: group.pages > group.sampleUrls.length,
    }));
}

function auditSignals(
  rows: GoogleAiCitedPageAuditRow[]
): GoogleSurfacePageAuditSignals | undefined {
  if (!rows.length) return undefined;
  const matches = rows.filter((row) => row.auditMatched && row.matchedAuditUrl);
  const auditUrls = [
    ...new Set(matches.map((row) => normalizeUrl(row.matchedAuditUrl!) ?? row.matchedAuditUrl!)),
  ];
  const matchType: GoogleSurfacePageAuditSignals['matchType'] =
    auditUrls.length > 1
      ? 'ambiguous-canonical'
      : matches.length > 0
        ? matches.some(({ auditMatchType }) => auditMatchType === 'exact-url')
          ? 'exact-url'
          : 'canonical-url'
        : rows.some(({ auditMatchType }) => auditMatchType === 'ambiguous-canonical')
          ? 'ambiguous-canonical'
          : 'unmatched';
  const values = <T extends string | number | boolean>(
    key: keyof GoogleAiCitedPageAuditRow
  ): T | undefined => {
    const present = matches
      .map((row) => row[key])
      .filter(
        (value): value is T =>
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      );
    return present.length > 0 && present.every((value) => value === present[0])
      ? present[0]
      : undefined;
  };
  const googlebotBlocked = values<boolean>('currentGooglebotBlocked');
  const auditUrl = auditUrls.length === 1 ? auditUrls[0] : undefined;
  return {
    matchType,
    ...(auditUrl ? { auditUrl } : {}),
    googlebotAccess:
      googlebotBlocked === undefined ? 'not-assessed' : googlebotBlocked ? 'blocked' : 'allowed',
    ...(values<boolean>('currentGooglebotNoindex') !== undefined
      ? { noindex: values<boolean>('currentGooglebotNoindex') }
      : {}),
    ...(values<boolean>('currentGooglebotNoSnippet') !== undefined
      ? { noSnippet: values<boolean>('currentGooglebotNoSnippet') }
      : {}),
    ...(values<boolean>('currentGooglebotMaxSnippetZero') !== undefined
      ? { maxSnippetZero: values<boolean>('currentGooglebotMaxSnippetZero') }
      : {}),
    ...(values<number>('currentDataNoSnippetElements') !== undefined
      ? { dataNoSnippetElements: values<number>('currentDataNoSnippetElements') }
      : {}),
    ...(values<string>('currentDocumentLanguage') !== undefined
      ? { documentLanguage: values<string>('currentDocumentLanguage') }
      : {}),
    ...(values<boolean>('currentDocumentLanguageValid') !== undefined
      ? { documentLanguageValid: values<boolean>('currentDocumentLanguageValid') }
      : {}),
  };
}

/** Join Search and Discover page exports while keeping their impressions and shares separate. */
export function compareGoogleAiSurfacePageObservations(
  search: GoogleAiPerformanceExport,
  discover: GoogleAiPerformanceExport,
  audit?: SEOReport | SEOAuditBatchReport | SiteWideGeoAnalysis,
  options?: { pathFamilyDepth?: number }
): GoogleSurfacePageMatrix {
  const pathFamilyDepth = options?.pathFamilyDepth;
  if (
    pathFamilyDepth !== undefined &&
    (!Number.isInteger(pathFamilyDepth) || pathFamilyDepth < 1 || pathFamilyDepth > 5)
  ) {
    throw new Error('Google surface path-family depth must be an integer from 1 to 5.');
  }
  if (search.surface !== 'search' || discover.surface !== 'discover') {
    throw new Error('Google surface matrices require one Search export and one Discover export.');
  }
  if (
    search.dimensions.length !== 1 ||
    search.dimensions[0] !== 'url' ||
    discover.dimensions.length !== 1 ||
    discover.dimensions[0] !== 'url'
  ) {
    throw new Error(
      'Google surface matrices require page-dimension exports without country, device, or date dimensions.'
    );
  }
  const searchAudit = audit ? correlateGoogleAiPerformanceWithAudit(search, audit) : undefined;
  const discoverAudit = audit ? correlateGoogleAiPerformanceWithAudit(discover, audit) : undefined;
  type Bucket = {
    impressions: number;
    sourceUrls: Set<string>;
    auditRows: GoogleAiCitedPageAuditRow[];
  };
  const buildSurface = (
    data: GoogleAiPerformanceExport,
    correlated?: ReturnType<typeof correlateGoogleAiPerformanceWithAudit>
  ) => {
    const pages = new Map<string, Bucket>();
    let rowsWithoutUsableUrl = 0;
    for (const [index, row] of data.rows.entries()) {
      const sourceUrl = row.url;
      const normalizedUrl = sourceUrl ? normalizeUrl(sourceUrl) : undefined;
      if (!normalizedUrl) {
        rowsWithoutUsableUrl += 1;
        continue;
      }
      const auditRow = correlated?.rows[index];
      const auditedUrl =
        auditRow?.auditMatched && auditRow.matchedAuditUrl
          ? normalizeUrl(auditRow.matchedAuditUrl)
          : undefined;
      const key = auditedUrl ?? normalizedUrl;
      const bucket = pages.get(key) ?? {
        impressions: 0,
        sourceUrls: new Set<string>(),
        auditRows: [],
      };
      bucket.impressions += row.impressions;
      bucket.sourceUrls.add(sourceUrl ?? normalizedUrl);
      if (auditRow) bucket.auditRows.push(auditRow);
      pages.set(key, bucket);
    }
    return { pages, rowsWithoutUsableUrl };
  };
  const searchData = buildSurface(search, searchAudit);
  const discoverData = buildSurface(discover, discoverAudit);
  const searchUsableUrlImpressions = [...searchData.pages.values()].reduce(
    (sum, page) => sum + page.impressions,
    0
  );
  const discoverUsableUrlImpressions = [...discoverData.pages.values()].reduce(
    (sum, page) => sum + page.impressions,
    0
  );
  const urls = [...new Set([...searchData.pages.keys(), ...discoverData.pages.keys()])].sort(
    (left, right) => left.localeCompare(right)
  );
  const pages = urls.map((url): GoogleSurfacePageObservation => {
    const searchPage = searchData.pages.get(url);
    const discoverPage = discoverData.pages.get(url);
    const searchImpressionSharePercent =
      searchPage && searchUsableUrlImpressions > 0
        ? Number(((searchPage.impressions / searchUsableUrlImpressions) * 100).toFixed(2))
        : undefined;
    const discoverImpressionSharePercent =
      discoverPage && discoverUsableUrlImpressions > 0
        ? Number(((discoverPage.impressions / discoverUsableUrlImpressions) * 100).toFixed(2))
        : undefined;
    const auditRows = [...(searchPage?.auditRows ?? []), ...(discoverPage?.auditRows ?? [])];
    return {
      url,
      coverage:
        searchPage && discoverPage
          ? 'search-and-discover'
          : searchPage
            ? 'search-only'
            : 'discover-only',
      searchSourceUrls: searchPage
        ? [...searchPage.sourceUrls].sort().slice(0, MAX_SOURCE_URLS)
        : [],
      discoverSourceUrls: discoverPage
        ? [...discoverPage.sourceUrls].sort().slice(0, MAX_SOURCE_URLS)
        : [],
      searchSourceUrlsTruncated: (searchPage?.sourceUrls.size ?? 0) > MAX_SOURCE_URLS,
      discoverSourceUrlsTruncated: (discoverPage?.sourceUrls.size ?? 0) > MAX_SOURCE_URLS,
      ...(searchPage ? { searchImpressions: searchPage.impressions } : {}),
      ...(searchImpressionSharePercent !== undefined ? { searchImpressionSharePercent } : {}),
      ...(discoverPage ? { discoverImpressions: discoverPage.impressions } : {}),
      ...(discoverImpressionSharePercent !== undefined ? { discoverImpressionSharePercent } : {}),
      ...(searchImpressionSharePercent !== undefined && discoverImpressionSharePercent !== undefined
        ? {
            searchMinusDiscoverSharePercentagePoints: Number(
              (searchImpressionSharePercent - discoverImpressionSharePercent).toFixed(2)
            ),
          }
        : {}),
      ...(audit
        ? {
            currentAudit: auditSignals(auditRows) ?? {
              matchType: 'unmatched',
              googlebotAccess: 'not-assessed',
            },
          }
        : {}),
    };
  });
  const pagesObservedByBoth = pages.filter(
    ({ coverage }) => coverage === 'search-and-discover'
  ).length;
  const pagesWithComparableShares = pages.filter(
    ({ searchImpressionSharePercent, discoverImpressionSharePercent }) =>
      searchImpressionSharePercent !== undefined && discoverImpressionSharePercent !== undefined
  ).length;
  const pathFamilies =
    pathFamilyDepth === undefined
      ? undefined
      : summarizePathFamilies(
          pages,
          pathFamilyDepth,
          searchUsableUrlImpressions,
          discoverUsableUrlImpressions
        );
  const pathFamilyCount =
    pathFamilyDepth === undefined
      ? undefined
      : new Set(pages.flatMap((page) => (page.pathFamily ? [page.pathFamily] : []))).size;
  return {
    source: 'Aviary Google AI surface page matrix',
    schemaVersion: 1,
    ...(search.sourceFile ? { searchSourceFile: search.sourceFile } : {}),
    ...(discover.sourceFile ? { discoverSourceFile: discover.sourceFile } : {}),
    searchPages: searchData.pages.size,
    discoverPages: discoverData.pages.size,
    pagesObservedByBoth,
    pagesOnlyInSearchExport: searchData.pages.size - pagesObservedByBoth,
    pagesOnlyInDiscoverExport: discoverData.pages.size - pagesObservedByBoth,
    searchExportRowSummedImpressions: search.rows.reduce((sum, row) => sum + row.impressions, 0),
    discoverExportRowSummedImpressions: discover.rows.reduce(
      (sum, row) => sum + row.impressions,
      0
    ),
    ...(searchUsableUrlImpressions > 0 ? { searchUsableUrlImpressions } : {}),
    ...(discoverUsableUrlImpressions > 0 ? { discoverUsableUrlImpressions } : {}),
    pagesWithComparableShares,
    ...(searchUsableUrlImpressions > 0
      ? {
          searchImpressionShareOnBothPagesPercent: Number(
            (
              (pages
                .filter(({ coverage }) => coverage === 'search-and-discover')
                .reduce((sum, page) => sum + (page.searchImpressions ?? 0), 0) /
                searchUsableUrlImpressions) *
              100
            ).toFixed(2)
          ),
        }
      : {}),
    ...(discoverUsableUrlImpressions > 0
      ? {
          discoverImpressionShareOnBothPagesPercent: Number(
            (
              (pages
                .filter(({ coverage }) => coverage === 'search-and-discover')
                .reduce((sum, page) => sum + (page.discoverImpressions ?? 0), 0) /
                discoverUsableUrlImpressions) *
              100
            ).toFixed(2)
          ),
        }
      : {}),
    rowsWithoutUsableUrl: {
      searchRows: searchData.rowsWithoutUsableUrl,
      discoverRows: discoverData.rowsWithoutUsableUrl,
    },
    pages: pages.slice(0, MAX_MATRIX_PAGES),
    pagesTruncated: pages.length > MAX_MATRIX_PAGES,
    ...(pathFamilyDepth !== undefined
      ? {
          pathFamilyDepth,
          pathFamilyCount,
          pathFamilies,
          pathFamiliesTruncated: (pathFamilyCount ?? 0) > MAX_PATH_FAMILIES,
        }
      : {}),
    note: `This matrix joins page-dimension Search and Discover impression rows by normalized HTTP(S) URL, removing fragments. When a saved audit is supplied, a uniquely matched audited canonical URL can bridge aliases; ambiguous canonical targets stay separate. Search and Discover are distinct Search Console surfaces with different reporting contexts; impression sums stay separate, and per-surface shares describe each URL's portion of that surface's usable-URL rows. The signed share gap is a distribution cue, not a blended performance score. Rows without usable URLs are excluded from page groups but remain part of export-row sums. Missing URLs are export-only observations, not zero impressions or proof of ineligibility. The returned page list is capped at 1,000 and source URL aliases at 10 per surface.${pathFamilyDepth === undefined ? '' : ` Path families group all joined URLs by origin and their first ${pathFamilyDepth} path segment${pathFamilyDepth === 1 ? '' : 's'}; up to ${MAX_PATH_FAMILIES} families and ${MAX_PATH_FAMILY_SAMPLE_URLS} sample URLs per family are retained.`} Current audit controls and language are time-misaligned snapshots, not explanations for historical surface observations.`,
  };
}

/** Validate the bounded matrix fields needed for a later-period join. */
export function isGoogleSurfacePageMatrix(value: unknown): value is GoogleSurfacePageMatrix {
  if (!value || typeof value !== 'object') return false;
  const matrix = value as Partial<GoogleSurfacePageMatrix>;
  const validMetric = (metric: unknown): boolean =>
    metric === undefined || (typeof metric === 'number' && Number.isFinite(metric) && metric >= 0);
  const validShare = (share: unknown): boolean =>
    share === undefined ||
    (typeof share === 'number' && Number.isFinite(share) && share >= 0 && share <= 100);
  const validPathFamily = (family: unknown): boolean =>
    Boolean(family) &&
    typeof family === 'object' &&
    typeof (family as GoogleSurfacePathFamily).family === 'string' &&
    Number.isInteger((family as GoogleSurfacePathFamily).pageGroups) &&
    (family as GoogleSurfacePathFamily).pageGroups >= 1 &&
    [
      'searchPages',
      'discoverPages',
      'pagesObservedByBoth',
      'pagesWithCurrentAudit',
      'pagesWithAmbiguousCanonical',
      'googlebotBlockedPages',
      'pagesWithIndexingRestrictions',
      'pagesWithSnippetRestrictions',
    ].every((key) => {
      const count = (family as unknown as Record<string, unknown>)[key];
      return Number.isInteger(count) && (count as number) >= 0;
    }) &&
    validMetric((family as GoogleSurfacePathFamily).searchImpressions) &&
    validMetric((family as GoogleSurfacePathFamily).discoverImpressions) &&
    validShare((family as GoogleSurfacePathFamily).searchImpressionSharePercent) &&
    validShare((family as GoogleSurfacePathFamily).discoverImpressionSharePercent) &&
    ((family as GoogleSurfacePathFamily).searchMinusDiscoverSharePercentagePoints === undefined ||
      (Number.isFinite(
        (family as GoogleSurfacePathFamily).searchMinusDiscoverSharePercentagePoints
      ) &&
        Math.abs((family as GoogleSurfacePathFamily).searchMinusDiscoverSharePercentagePoints!) <=
          100)) &&
    Array.isArray((family as GoogleSurfacePathFamily).sampleUrls) &&
    (family as GoogleSurfacePathFamily).sampleUrls.length <= MAX_PATH_FAMILY_SAMPLE_URLS &&
    (family as GoogleSurfacePathFamily).sampleUrls.every((url) => typeof url === 'string');
  return (
    matrix.source === 'Aviary Google AI surface page matrix' &&
    matrix.schemaVersion === 1 &&
    Array.isArray(matrix.pages) &&
    matrix.pages.length <= MAX_MATRIX_PAGES &&
    typeof matrix.pagesTruncated === 'boolean' &&
    matrix.pages.every(
      (page) =>
        Boolean(page) &&
        typeof page.url === 'string' &&
        page.url.length > 0 &&
        ['search-and-discover', 'search-only', 'discover-only'].includes(page.coverage) &&
        validMetric(page.searchImpressions) &&
        validMetric(page.discoverImpressions) &&
        validMetric(page.searchImpressionSharePercent) &&
        validMetric(page.discoverImpressionSharePercent) &&
        (page.pathFamily === undefined || typeof page.pathFamily === 'string')
    ) &&
    (matrix.pathFamilyDepth === undefined
      ? matrix.pathFamilyCount === undefined &&
        matrix.pathFamilies === undefined &&
        matrix.pathFamiliesTruncated === undefined
      : Number.isInteger(matrix.pathFamilyDepth) &&
        matrix.pathFamilyDepth >= 1 &&
        matrix.pathFamilyDepth <= 5 &&
        Number.isInteger(matrix.pathFamilyCount) &&
        (matrix.pathFamilyCount ?? -1) >= 0 &&
        Array.isArray(matrix.pathFamilies) &&
        matrix.pathFamilies.length <= MAX_PATH_FAMILIES &&
        matrix.pathFamilies.every(validPathFamily) &&
        typeof matrix.pathFamiliesTruncated === 'boolean') &&
    validMetric(matrix.searchUsableUrlImpressions) &&
    validMetric(matrix.discoverUsableUrlImpressions)
  );
}

/** Compare page impression counts and each Google surface's own share over time. */
export function compareGoogleAiSurfaceMatrices(
  current: GoogleSurfacePageMatrix,
  baseline: GoogleSurfacePageMatrix
): GoogleSurfacePeriodComparison {
  const currentPages = new Map(
    current.pages.flatMap((page) => {
      const url = normalizeUrl(page.url);
      return url ? [[url, page] as const] : [];
    })
  );
  const baselinePages = new Map(
    baseline.pages.flatMap((page) => {
      const url = normalizeUrl(page.url);
      return url ? [[url, page] as const] : [];
    })
  );
  const urls = [...new Set([...currentPages.keys(), ...baselinePages.keys()])];
  let searchPagesWithComparableImpressions = 0;
  let discoverPagesWithComparableImpressions = 0;
  let searchPagesWithComparableShare = 0;
  let discoverPagesWithComparableShare = 0;
  let searchPagesWithIncreasingShare = 0;
  let searchPagesWithDecreasingShare = 0;
  let discoverPagesWithIncreasingShare = 0;
  let discoverPagesWithDecreasingShare = 0;
  let matchedSearchImpressionChange = 0;
  let matchedDiscoverImpressionChange = 0;
  const pages = urls
    .map((url): GoogleSurfacePagePeriodChange => {
      const currentPage = currentPages.get(url);
      const baselinePage = baselinePages.get(url);
      if (!currentPage) return { url, state: 'baseline-only' };
      if (!baselinePage) return { url, state: 'current-only' };
      const change: GoogleSurfacePagePeriodChange = { url, state: 'present-both' };
      if (
        currentPage.searchImpressions !== undefined &&
        baselinePage.searchImpressions !== undefined
      ) {
        const delta = currentPage.searchImpressions - baselinePage.searchImpressions;
        searchPagesWithComparableImpressions += 1;
        matchedSearchImpressionChange += delta;
        change.baselineSearchImpressions = baselinePage.searchImpressions;
        change.currentSearchImpressions = currentPage.searchImpressions;
        change.searchImpressionChange = delta;
        const baselineTotal = baseline.searchUsableUrlImpressions;
        const currentTotal = current.searchUsableUrlImpressions;
        if (baselineTotal && baselineTotal > 0 && currentTotal && currentTotal > 0) {
          const shareDelta =
            (currentPage.searchImpressions / currentTotal) * 100 -
            (baselinePage.searchImpressions / baselineTotal) * 100;
          searchPagesWithComparableShare += 1;
          if (shareDelta > 0) searchPagesWithIncreasingShare += 1;
          if (shareDelta < 0) searchPagesWithDecreasingShare += 1;
          change.searchShareChangePercentagePoints = Number(shareDelta.toFixed(2));
        }
      }
      if (
        currentPage.discoverImpressions !== undefined &&
        baselinePage.discoverImpressions !== undefined
      ) {
        const delta = currentPage.discoverImpressions - baselinePage.discoverImpressions;
        discoverPagesWithComparableImpressions += 1;
        matchedDiscoverImpressionChange += delta;
        change.baselineDiscoverImpressions = baselinePage.discoverImpressions;
        change.currentDiscoverImpressions = currentPage.discoverImpressions;
        change.discoverImpressionChange = delta;
        const baselineTotal = baseline.discoverUsableUrlImpressions;
        const currentTotal = current.discoverUsableUrlImpressions;
        if (baselineTotal && baselineTotal > 0 && currentTotal && currentTotal > 0) {
          const shareDelta =
            (currentPage.discoverImpressions / currentTotal) * 100 -
            (baselinePage.discoverImpressions / baselineTotal) * 100;
          discoverPagesWithComparableShare += 1;
          if (shareDelta > 0) discoverPagesWithIncreasingShare += 1;
          if (shareDelta < 0) discoverPagesWithDecreasingShare += 1;
          change.discoverShareChangePercentagePoints = Number(shareDelta.toFixed(2));
        }
      }
      return change;
    })
    .sort((left, right) => {
      const maxShareShift = (page: GoogleSurfacePagePeriodChange) =>
        Math.max(
          Math.abs(page.searchShareChangePercentagePoints ?? 0),
          Math.abs(page.discoverShareChangePercentagePoints ?? 0)
        );
      const stateOrder = (state: GoogleSurfacePagePeriodChange['state']) =>
        state === 'present-both' ? 0 : state === 'current-only' ? 1 : 2;
      return (
        stateOrder(left.state) - stateOrder(right.state) ||
        maxShareShift(right) - maxShareShift(left) ||
        left.url.localeCompare(right.url)
      );
    });
  const pagesPresentInBothReturnedLists = urls.filter(
    (url) => currentPages.has(url) && baselinePages.has(url)
  ).length;
  let pathFamilyComparison: GoogleSurfacePathFamilyComparison | undefined;
  if (
    current.pathFamilyDepth !== undefined &&
    current.pathFamilyDepth === baseline.pathFamilyDepth &&
    current.pathFamilies &&
    baseline.pathFamilies
  ) {
    const currentFamilies = new Map(current.pathFamilies.map((family) => [family.family, family]));
    const baselineFamilies = new Map(
      baseline.pathFamilies.map((family) => [family.family, family])
    );
    const familyNames = [...new Set([...currentFamilies.keys(), ...baselineFamilies.keys()])].sort(
      (left, right) => left.localeCompare(right)
    );
    const families = familyNames
      .map((family): GoogleSurfacePathFamilyPeriodChange => {
        const currentFamily = currentFamilies.get(family);
        const baselineFamily = baselineFamilies.get(family);
        if (!currentFamily && baselineFamily)
          return {
            family,
            state: 'baseline-only',
            baselinePageGroups: baselineFamily.pageGroups,
            ...(baselineFamily.searchImpressions !== undefined
              ? { baselineSearchImpressions: baselineFamily.searchImpressions }
              : {}),
            ...(baselineFamily.searchImpressionSharePercent !== undefined
              ? {
                  baselineSearchImpressionSharePercent: baselineFamily.searchImpressionSharePercent,
                }
              : {}),
            ...(baselineFamily.discoverImpressions !== undefined
              ? { baselineDiscoverImpressions: baselineFamily.discoverImpressions }
              : {}),
            ...(baselineFamily.discoverImpressionSharePercent !== undefined
              ? {
                  baselineDiscoverImpressionSharePercent:
                    baselineFamily.discoverImpressionSharePercent,
                }
              : {}),
          };
        if (!baselineFamily && currentFamily)
          return {
            family,
            state: 'current-only',
            currentPageGroups: currentFamily.pageGroups,
            ...(currentFamily.searchImpressions !== undefined
              ? { currentSearchImpressions: currentFamily.searchImpressions }
              : {}),
            ...(currentFamily.searchImpressionSharePercent !== undefined
              ? { currentSearchImpressionSharePercent: currentFamily.searchImpressionSharePercent }
              : {}),
            ...(currentFamily.discoverImpressions !== undefined
              ? { currentDiscoverImpressions: currentFamily.discoverImpressions }
              : {}),
            ...(currentFamily.discoverImpressionSharePercent !== undefined
              ? {
                  currentDiscoverImpressionSharePercent:
                    currentFamily.discoverImpressionSharePercent,
                }
              : {}),
          };
        if (!currentFamily || !baselineFamily) return { family, state: 'current-only' };
        return {
          family,
          state: 'present-both',
          baselinePageGroups: baselineFamily.pageGroups,
          currentPageGroups: currentFamily.pageGroups,
          ...(baselineFamily.searchImpressions !== undefined
            ? { baselineSearchImpressions: baselineFamily.searchImpressions }
            : {}),
          ...(currentFamily.searchImpressions !== undefined
            ? { currentSearchImpressions: currentFamily.searchImpressions }
            : {}),
          ...(baselineFamily.searchImpressionSharePercent !== undefined
            ? { baselineSearchImpressionSharePercent: baselineFamily.searchImpressionSharePercent }
            : {}),
          ...(currentFamily.searchImpressionSharePercent !== undefined
            ? { currentSearchImpressionSharePercent: currentFamily.searchImpressionSharePercent }
            : {}),
          ...(baselineFamily.searchImpressions !== undefined &&
          currentFamily.searchImpressions !== undefined
            ? {
                searchImpressionChange:
                  currentFamily.searchImpressions - baselineFamily.searchImpressions,
              }
            : {}),
          ...(baselineFamily.searchImpressionSharePercent !== undefined &&
          currentFamily.searchImpressionSharePercent !== undefined
            ? {
                searchImpressionShareChangePercentagePoints: Number(
                  (
                    currentFamily.searchImpressionSharePercent -
                    baselineFamily.searchImpressionSharePercent
                  ).toFixed(2)
                ),
              }
            : {}),
          ...(baselineFamily.discoverImpressions !== undefined
            ? { baselineDiscoverImpressions: baselineFamily.discoverImpressions }
            : {}),
          ...(currentFamily.discoverImpressions !== undefined
            ? { currentDiscoverImpressions: currentFamily.discoverImpressions }
            : {}),
          ...(baselineFamily.discoverImpressionSharePercent !== undefined
            ? {
                baselineDiscoverImpressionSharePercent:
                  baselineFamily.discoverImpressionSharePercent,
              }
            : {}),
          ...(currentFamily.discoverImpressionSharePercent !== undefined
            ? {
                currentDiscoverImpressionSharePercent: currentFamily.discoverImpressionSharePercent,
              }
            : {}),
          ...(baselineFamily.discoverImpressions !== undefined &&
          currentFamily.discoverImpressions !== undefined
            ? {
                discoverImpressionChange:
                  currentFamily.discoverImpressions - baselineFamily.discoverImpressions,
              }
            : {}),
          ...(baselineFamily.discoverImpressionSharePercent !== undefined &&
          currentFamily.discoverImpressionSharePercent !== undefined
            ? {
                discoverImpressionShareChangePercentagePoints: Number(
                  (
                    currentFamily.discoverImpressionSharePercent -
                    baselineFamily.discoverImpressionSharePercent
                  ).toFixed(2)
                ),
              }
            : {}),
        };
      })
      .sort(
        (left, right) =>
          Math.max(
            Math.abs(right.searchImpressionShareChangePercentagePoints ?? 0),
            Math.abs(right.discoverImpressionShareChangePercentagePoints ?? 0)
          ) -
            Math.max(
              Math.abs(left.searchImpressionShareChangePercentagePoints ?? 0),
              Math.abs(left.discoverImpressionShareChangePercentagePoints ?? 0)
            ) || left.family.localeCompare(right.family)
      );
    pathFamilyComparison = {
      pathFamilyDepth: current.pathFamilyDepth,
      baselineFamilyCount: baseline.pathFamilyCount ?? baselineFamilies.size,
      currentFamilyCount: current.pathFamilyCount ?? currentFamilies.size,
      familiesPresentInBothReturnedLists: familyNames.filter(
        (family) => currentFamilies.has(family) && baselineFamilies.has(family)
      ).length,
      familiesOnlyInCurrentReturnedList: familyNames.filter(
        (family) => currentFamilies.has(family) && !baselineFamilies.has(family)
      ).length,
      familiesOnlyInBaselineReturnedList: familyNames.filter(
        (family) => baselineFamilies.has(family) && !currentFamilies.has(family)
      ).length,
      baselineFamiliesTruncated: baseline.pathFamiliesTruncated === true,
      currentFamiliesTruncated: current.pathFamiliesTruncated === true,
      families: families.slice(0, MAX_PATH_FAMILY_COMPARISON),
      familiesTruncated: families.length > MAX_PATH_FAMILY_COMPARISON,
      note: 'Families compare exact origin and selected leading-path keys from each retained matrix. Search and Discover counts and within-surface shares remain separate. If either family list was capped at 250, one-sided families are retained-list observations only; they do not establish zero activity or new/lost visibility. A different configured path depth disables this comparison.',
    };
  }
  return {
    ...(baseline.searchSourceFile ? { baselineSearchSourceFile: baseline.searchSourceFile } : {}),
    ...(baseline.discoverSourceFile
      ? { baselineDiscoverSourceFile: baseline.discoverSourceFile }
      : {}),
    ...(current.searchSourceFile ? { currentSearchSourceFile: current.searchSourceFile } : {}),
    ...(current.discoverSourceFile
      ? { currentDiscoverSourceFile: current.discoverSourceFile }
      : {}),
    baselinePagesTruncated: baseline.pagesTruncated,
    currentPagesTruncated: current.pagesTruncated,
    pagesPresentInBothReturnedLists,
    pagesOnlyInCurrentReturnedList: urls.filter(
      (url) => currentPages.has(url) && !baselinePages.has(url)
    ).length,
    pagesOnlyInBaselineReturnedList: urls.filter(
      (url) => baselinePages.has(url) && !currentPages.has(url)
    ).length,
    searchPagesWithComparableImpressions,
    discoverPagesWithComparableImpressions,
    searchPagesWithComparableShare,
    discoverPagesWithComparableShare,
    searchPagesWithIncreasingShare,
    searchPagesWithDecreasingShare,
    discoverPagesWithIncreasingShare,
    discoverPagesWithDecreasingShare,
    ...(searchPagesWithComparableImpressions > 0 ? { matchedSearchImpressionChange } : {}),
    ...(discoverPagesWithComparableImpressions > 0 ? { matchedDiscoverImpressionChange } : {}),
    pages: pages.slice(0, MAX_PERIOD_COMPARISON_PAGES),
    pagesTruncated: pages.length > MAX_PERIOD_COMPARISON_PAGES,
    ...(pathFamilyComparison ? { pathFamilyComparison } : {}),
    note: `The comparison joins normalized URL groups retained in the two matrices. Search and Discover impression counts and within-surface shares are compared separately; no cross-surface aggregate is calculated. Matched-page deltas sum comparable retained URLs and are not whole-export changes. Shares use each period matrix’s usable-URL impression total. If either matrix capped its page list at 1,000, export-only states cover retained rows only and do not imply zero impressions. Use the same Search Console property, surface definitions, filters, and date ranges except for the intended period change. Different canonical audit bridges can change URL group keys; current controls are snapshots and do not explain historical movement.${current.pathFamilyDepth !== baseline.pathFamilyDepth && (current.pathFamilyDepth !== undefined || baseline.pathFamilyDepth !== undefined) ? ' Path-family movement is omitted because the two matrices use different or absent path depths.' : ''}`,
  };
}
