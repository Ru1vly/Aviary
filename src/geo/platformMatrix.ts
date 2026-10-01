import type { SEOAuditBatchReport, SEOReport } from '../types';
import type { SiteWideGeoAnalysis } from '../sitewide';
import {
  correlateBingAiCitationsWithAudit,
  type BingAiCitedPageAuditRow,
  type BingAiPerformanceExport,
} from './bingAiPerformance';
import {
  correlateGoogleAiPerformanceWithAudit,
  type GoogleAiCitedPageAuditRow,
  type GoogleAiPerformanceExport,
} from './googleAiPerformance';

export type AiPlatformPageCoverage = 'both-observed' | 'google-export-only' | 'bing-export-only';
export type CurrentGEOCrawlerAccess = 'allowed' | 'blocked' | 'not-assessed';

export interface CurrentGEOPageAuditSignals {
  auditUrl: string;
  googlebot: {
    access: CurrentGEOCrawlerAccess;
    noindex?: boolean;
    noSnippet?: boolean;
    maxSnippetZero?: boolean;
  };
  bingbot: {
    access: CurrentGEOCrawlerAccess;
    noindex?: boolean;
    noSnippet?: boolean;
    maxSnippetZero?: boolean;
  };
  dataNoSnippetElements?: number;
  dataNoSnippetWords?: number;
  pageContent?: {
    questionHeadings?: number;
    conciseAnswerBlocks?: number;
    externalContentLinks?: number;
    externalSourceLinks?: number;
    referenceSectionLinks?: number;
    visibleAuthor?: boolean;
    visibleDate?: boolean;
    documentLanguage?: string;
    documentLanguageValid?: boolean;
    documentLanguageAssessed?: boolean;
  };
}

export interface AiPlatformDocumentLanguageGroup {
  language: string;
  pages: number;
  pagesObservedByBoth: number;
  googleExportOnlyPages: number;
  bingExportOnlyPages: number;
  googleObservedPagePercent: number;
  bingObservedPagePercent: number;
  googlePagesWithImpressions: number;
  googleRowSummedImpressions: number;
  bingPagesWithCitations: number;
  bingRowSummedCitations?: number;
  validLanguageTagPages: number;
  invalidLanguageTagPages: number;
  languageTagValidationUnavailablePages: number;
}

export interface AiPlatformDocumentLanguageCoverage {
  joinedPagesAnalyzed: number;
  pagesWithCurrentAudit: number;
  languageProfilesAssessed: number;
  pagesWithDeclaredLanguage: number;
  assessedPagesWithoutDeclaredLanguage: number;
  pagesWithValidDeclaredLanguageTag: number;
  pagesWithInvalidDeclaredLanguageTag: number;
  pagesWithDeclaredLanguageTagNotValidated: number;
  pagesWithAuditButLanguageNotAssessed: number;
  pagesWithoutCurrentAudit: number;
  languages: AiPlatformDocumentLanguageGroup[];
  languagesTruncated: boolean;
  note: string;
}

export interface AiPlatformShareOverlap {
  pagesWithBothShareMetrics: number;
  googleMetricShareOnBothExportUrlsPercent?: number;
  bingMetricShareOnBothExportUrlsPercent?: number;
  medianAbsoluteShareGapPercentagePoints?: number;
  note: string;
}

export interface AiPlatformSitemapCoverage {
  sitemapUrl: string;
  sitemapUrlsDiscovered: number;
  pagesFoundInSuppliedSitemapList: number;
  pagesNotFoundInSuppliedSitemapList: number;
  pagesWithPossibleAliasMatchFromTruncatedSourceLists: number;
  sitemapResultMayBeTruncated: boolean;
  googleMetricShareOnListedPagesPercent?: number;
  bingMetricShareOnListedPagesPercent?: number;
  note: string;
}

export interface AiPlatformSitemapInput {
  url: string;
  pageUrls: string[];
  resultMayBeTruncated: boolean;
}

export interface AiPlatformPathFamily {
  family: string;
  joinedPageGroups: number;
  googlePageGroups: number;
  bingPageGroups: number;
  pagesObservedByBoth: number;
  googleImpressions?: number;
  googleImpressionSharePercent?: number;
  bingCitations?: number;
  bingCitationSharePercent?: number;
  pagesWithCurrentAudit: number;
  googlebotBlockedPages: number;
  bingbotBlockedPages: number;
  pagesWithIndexingRestrictions: number;
  pagesWithSnippetRestrictions: number;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
}

export interface AiPlatformAuditExposureControl {
  control:
    | 'googlebot-currently-blocked'
    | 'bingbot-currently-blocked'
    | 'indexing-restricted'
    | 'snippet-restricted'
    | 'data-nosnippet-present';
  pages: number;
  pagesAssessed: number;
  googleImpressionSharePercent?: number;
  bingCitationSharePercent?: number;
}

export interface AiPlatformCurrentAuditExposure {
  joinedPageGroups: number;
  pagesWithCurrentAudit: number;
  googlebotAccessAssessedPages: number;
  bingbotAccessAssessedPages: number;
  controls: AiPlatformAuditExposureControl[];
  note: string;
}

export interface AiPlatformPageObservation {
  url: string;
  pathFamily?: string;
  coverage: AiPlatformPageCoverage;
  googleSourceUrls: string[];
  bingSourceUrls: string[];
  googleSourceUrlsTruncated: boolean;
  bingSourceUrlsTruncated: boolean;
  sitemapMembership?: {
    state:
      | 'found-in-supplied-sitemap-list'
      | 'not-found-in-supplied-sitemap-list'
      | 'possible-match-source-list-truncated';
    matchedVia?: 'matrix-url' | 'export-url-alias' | 'matched-audit-url';
  };
  currentAuditSignals?: CurrentGEOPageAuditSignals;
  googleSearchAiImpressions?: number;
  googleImpressionSharePercent?: number;
  bingAiCitations?: number;
  bingCitationSharePercent?: number;
  platformShareGapPercentagePoints?: number;
  bingCitedPages?: number;
  bingAverageCitationShare?: number;
}

export interface AiPlatformPageMatrix {
  source: 'Aviary cross-platform GEO page matrix';
  schemaVersion: 1;
  googleSourceFile?: string;
  bingSourceFile?: string;
  googleSearchAiPages: number;
  bingAiPages: number;
  pagesObservedByBoth: number;
  pagesOnlyInGoogleExport: number;
  pagesOnlyInBingExport: number;
  googleExportRowSummedImpressions: number;
  googleUsableUrlRowSummedImpressions?: number;
  bingExportRowSummedCitations?: number;
  bingUsableUrlRowSummedCitations?: number;
  bingExportRowSummedCitedPages?: number;
  auditBridge?: {
    googlePagesMatchedByCanonical: number;
    googlePagesWithAmbiguousAuditUrl: number;
    googlePagesWithAmbiguousCanonical: number;
    bingPagesMatchedByCanonical: number;
    bingPagesWithAmbiguousAuditUrl: number;
    bingPagesWithAmbiguousCanonical: number;
  };
  platformShareOverlap?: AiPlatformShareOverlap;
  sitemapCoverage?: AiPlatformSitemapCoverage;
  pathFamilyDepth?: number;
  pathFamilyCount?: number;
  pathFamilies?: AiPlatformPathFamily[];
  pathFamiliesTruncated?: boolean;
  currentAuditExposure?: AiPlatformCurrentAuditExposure;
  documentLanguageCoverage?: AiPlatformDocumentLanguageCoverage;
  rowsWithoutUsableUrl: { googleRows: number; bingRows: number };
  pages: AiPlatformPageObservation[];
  pagesTruncated: boolean;
  note: string;
}

export interface AiPlatformPagePeriodChange {
  url: string;
  state: 'current-only' | 'baseline-only' | 'present-both';
  baselineGoogleImpressions?: number;
  currentGoogleImpressions?: number;
  googleImpressionChange?: number;
  googleImpressionShareChangePercentagePoints?: number;
  baselineBingCitations?: number;
  currentBingCitations?: number;
  bingCitationChange?: number;
  bingCitationShareChangePercentagePoints?: number;
}

export interface AiPlatformPageMatrixComparison {
  baselineGoogleSourceFile?: string;
  baselineBingSourceFile?: string;
  currentGoogleSourceFile?: string;
  currentBingSourceFile?: string;
  baselineReturnedPageGroups: number;
  currentReturnedPageGroups: number;
  baselinePagesTruncated: boolean;
  currentPagesTruncated: boolean;
  pagesPresentInBothReturnedLists: number;
  pagesOnlyInCurrentReturnedList: number;
  pagesOnlyInBaselineReturnedList: number;
  googlePagesWithComparableImpressions: number;
  bingPagesWithComparableCitations: number;
  googlePagesWithComparableShare: number;
  bingPagesWithComparableShare: number;
  googlePagesWithIncreasingShare: number;
  googlePagesWithDecreasingShare: number;
  bingPagesWithIncreasingShare: number;
  bingPagesWithDecreasingShare: number;
  matchedGoogleImpressionChange?: number;
  matchedBingCitationChange?: number;
  pages: AiPlatformPagePeriodChange[];
  pagesTruncated: boolean;
  pathFamilyComparison?: AiPlatformPathFamilyComparison;
  note: string;
}

export interface AiPlatformPathFamilyPeriodChange {
  family: string;
  state: 'current-only' | 'baseline-only' | 'present-both';
  baselinePageGroups: number;
  currentPageGroups: number;
  baselineGoogleImpressions?: number;
  currentGoogleImpressions?: number;
  googleImpressionChange?: number;
  googleImpressionShareChangePercentagePoints?: number;
  baselineBingCitations?: number;
  currentBingCitations?: number;
  bingCitationChange?: number;
  bingCitationShareChangePercentagePoints?: number;
}

export interface AiPlatformPathFamilyComparison {
  pathFamilyDepth: number;
  baselineFamilyCount: number;
  currentFamilyCount: number;
  familiesPresentInBothReturnedLists: number;
  familiesOnlyInCurrentReturnedList: number;
  familiesOnlyInBaselineReturnedList: number;
  baselineFamiliesTruncated: boolean;
  currentFamiliesTruncated: boolean;
  families: AiPlatformPathFamilyPeriodChange[];
  familiesTruncated: boolean;
  note: string;
}

const MAX_RETURNED_PAGES = 1_000;
const MAX_PATH_FAMILIES = 250;
const MAX_PATH_FAMILY_SAMPLE_URLS = 5;
const MAX_DOCUMENT_LANGUAGES = 50;
const MAX_SOURCE_URLS_PER_PAGE = 10;

interface GooglePageRows {
  impressions: number;
  sourceUrls: Set<string>;
  auditRow?: GoogleAiCitedPageAuditRow;
}

interface BingPageRows {
  citations: number;
  citationRows: number;
  citedPages: number;
  citedPageRows: number;
  citationShares: number[];
  sourceUrls: Set<string>;
  auditRow?: BingAiCitedPageAuditRow;
}

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

function auditSignalsFromRows(
  googleRow: GoogleAiCitedPageAuditRow | undefined,
  bingRow: BingAiCitedPageAuditRow | undefined
): CurrentGEOPageAuditSignals | undefined {
  const auditUrl = googleRow?.matchedAuditUrl ?? bingRow?.matchedAuditUrl;
  if (!auditUrl) return undefined;
  const googlebotAccess: CurrentGEOCrawlerAccess =
    !googleRow?.googlebotAccessAssessed || googleRow.currentGooglebotBlocked === undefined
      ? 'not-assessed'
      : googleRow.currentGooglebotBlocked
        ? 'blocked'
        : 'allowed';
  const bingbotBlockedByRobots =
    bingRow?.currentBingbotBlocked === true ||
    bingRow?.blockedSearchCrawlers.some((token) => token.toLowerCase() === 'bingbot') === true;
  const bingbotAccessAssessed =
    bingRow?.currentBingbotAccessAssessed === true || bingbotBlockedByRobots;
  const bingbotAccess: CurrentGEOCrawlerAccess = !bingbotAccessAssessed
    ? 'not-assessed'
    : bingbotBlockedByRobots
      ? 'blocked'
      : 'allowed';
  return {
    auditUrl,
    googlebot: {
      access: googlebotAccess,
      ...(googleRow?.currentGooglebotNoindex !== undefined
        ? { noindex: googleRow.currentGooglebotNoindex }
        : {}),
      ...(googleRow?.currentGooglebotNoSnippet !== undefined
        ? { noSnippet: googleRow.currentGooglebotNoSnippet }
        : {}),
      ...(googleRow?.currentGooglebotMaxSnippetZero !== undefined
        ? { maxSnippetZero: googleRow.currentGooglebotMaxSnippetZero }
        : {}),
    },
    bingbot: {
      access: bingbotAccess,
      ...(bingRow?.currentBingbotNoindex !== undefined
        ? { noindex: bingRow.currentBingbotNoindex }
        : {}),
      ...(bingRow?.currentBingbotNoSnippet !== undefined
        ? { noSnippet: bingRow.currentBingbotNoSnippet }
        : {}),
      ...(bingRow?.currentBingbotMaxSnippetZero !== undefined
        ? { maxSnippetZero: bingRow.currentBingbotMaxSnippetZero }
        : {}),
    },
    ...(googleRow?.currentDataNoSnippetElements !== undefined ||
    bingRow?.currentDataNoSnippetElements !== undefined
      ? {
          dataNoSnippetElements:
            googleRow?.currentDataNoSnippetElements ?? bingRow?.currentDataNoSnippetElements,
        }
      : {}),
    ...(googleRow?.currentDataNoSnippetWords !== undefined ||
    bingRow?.currentDataNoSnippetWords !== undefined
      ? {
          dataNoSnippetWords:
            googleRow?.currentDataNoSnippetWords ?? bingRow?.currentDataNoSnippetWords,
        }
      : {}),
    ...(googleRow?.currentQuestionHeadings !== undefined ||
    bingRow?.currentQuestionHeadings !== undefined ||
    googleRow?.currentConciseAnswerBlocks !== undefined ||
    bingRow?.currentConciseAnswerBlocks !== undefined ||
    googleRow?.currentExternalContentLinks !== undefined ||
    bingRow?.currentExternalContentLinks !== undefined ||
    googleRow?.currentExternalSourceLinks !== undefined ||
    bingRow?.currentExternalSourceLinks !== undefined ||
    googleRow?.currentReferenceSectionLinks !== undefined ||
    bingRow?.currentReferenceSectionLinks !== undefined ||
    googleRow?.currentVisibleAuthor !== undefined ||
    bingRow?.currentVisibleAuthor !== undefined ||
    googleRow?.currentVisibleDate !== undefined ||
    bingRow?.currentVisibleDate !== undefined ||
    googleRow?.currentDocumentLanguage !== undefined ||
    bingRow?.currentDocumentLanguage !== undefined ||
    googleRow?.currentDocumentLanguageValid !== undefined ||
    bingRow?.currentDocumentLanguageValid !== undefined ||
    googleRow?.currentDocumentLanguageAssessed !== undefined ||
    bingRow?.currentDocumentLanguageAssessed !== undefined
      ? {
          pageContent: {
            ...(googleRow?.currentQuestionHeadings !== undefined ||
            bingRow?.currentQuestionHeadings !== undefined
              ? {
                  questionHeadings:
                    googleRow?.currentQuestionHeadings ?? bingRow?.currentQuestionHeadings,
                }
              : {}),
            ...(googleRow?.currentConciseAnswerBlocks !== undefined ||
            bingRow?.currentConciseAnswerBlocks !== undefined
              ? {
                  conciseAnswerBlocks:
                    googleRow?.currentConciseAnswerBlocks ?? bingRow?.currentConciseAnswerBlocks,
                }
              : {}),
            ...(googleRow?.currentExternalContentLinks !== undefined ||
            bingRow?.currentExternalContentLinks !== undefined
              ? {
                  externalContentLinks:
                    googleRow?.currentExternalContentLinks ?? bingRow?.currentExternalContentLinks,
                }
              : {}),
            ...(googleRow?.currentExternalSourceLinks !== undefined ||
            bingRow?.currentExternalSourceLinks !== undefined
              ? {
                  externalSourceLinks:
                    googleRow?.currentExternalSourceLinks ?? bingRow?.currentExternalSourceLinks,
                }
              : {}),
            ...(googleRow?.currentReferenceSectionLinks !== undefined ||
            bingRow?.currentReferenceSectionLinks !== undefined
              ? {
                  referenceSectionLinks:
                    googleRow?.currentReferenceSectionLinks ??
                    bingRow?.currentReferenceSectionLinks,
                }
              : {}),
            ...(googleRow?.currentVisibleAuthor !== undefined ||
            bingRow?.currentVisibleAuthor !== undefined
              ? { visibleAuthor: googleRow?.currentVisibleAuthor ?? bingRow?.currentVisibleAuthor }
              : {}),
            ...(googleRow?.currentVisibleDate !== undefined ||
            bingRow?.currentVisibleDate !== undefined
              ? { visibleDate: googleRow?.currentVisibleDate ?? bingRow?.currentVisibleDate }
              : {}),
            ...(googleRow?.currentDocumentLanguage !== undefined ||
            bingRow?.currentDocumentLanguage !== undefined
              ? {
                  documentLanguage:
                    googleRow?.currentDocumentLanguage ?? bingRow?.currentDocumentLanguage,
                }
              : {}),
            ...(googleRow?.currentDocumentLanguageValid !== undefined ||
            bingRow?.currentDocumentLanguageValid !== undefined
              ? {
                  documentLanguageValid:
                    googleRow?.currentDocumentLanguageValid ??
                    bingRow?.currentDocumentLanguageValid,
                }
              : {}),
            ...(googleRow?.currentDocumentLanguageAssessed !== undefined ||
            bingRow?.currentDocumentLanguageAssessed !== undefined
              ? {
                  documentLanguageAssessed:
                    googleRow?.currentDocumentLanguageAssessed ??
                    bingRow?.currentDocumentLanguageAssessed,
                }
              : {}),
          },
        }
      : {}),
  };
}

function summarizeDocumentLanguageCoverage(
  pages: AiPlatformPageObservation[]
): AiPlatformDocumentLanguageCoverage {
  const groups = new Map<string, AiPlatformDocumentLanguageGroup>();
  let pagesWithCurrentAudit = 0;
  let languageProfilesAssessed = 0;
  let pagesWithDeclaredLanguage = 0;
  let assessedPagesWithoutDeclaredLanguage = 0;
  let pagesWithValidDeclaredLanguageTag = 0;
  let pagesWithInvalidDeclaredLanguageTag = 0;
  let pagesWithDeclaredLanguageTagNotValidated = 0;
  let pagesWithAuditButLanguageNotAssessed = 0;
  let pagesWithoutCurrentAudit = 0;

  for (const page of pages) {
    const audit = page.currentAuditSignals;
    const content = audit?.pageContent;
    if (!audit) pagesWithoutCurrentAudit += 1;
    else pagesWithCurrentAudit += 1;

    const language = content?.documentLanguage?.trim().slice(0, 80);
    const assessed =
      content?.documentLanguageAssessed === true ||
      content?.documentLanguageValid !== undefined ||
      Boolean(language);
    if (assessed) languageProfilesAssessed += 1;
    else if (audit) pagesWithAuditButLanguageNotAssessed += 1;
    if (assessed && !language) assessedPagesWithoutDeclaredLanguage += 1;
    if (!language) continue;

    pagesWithDeclaredLanguage += 1;
    const key = language.toLowerCase();
    const group = groups.get(key) ?? {
      language,
      pages: 0,
      pagesObservedByBoth: 0,
      googleExportOnlyPages: 0,
      bingExportOnlyPages: 0,
      googleObservedPagePercent: 0,
      bingObservedPagePercent: 0,
      googlePagesWithImpressions: 0,
      googleRowSummedImpressions: 0,
      bingPagesWithCitations: 0,
      bingRowSummedCitations: 0,
      validLanguageTagPages: 0,
      invalidLanguageTagPages: 0,
      languageTagValidationUnavailablePages: 0,
    };
    group.pages += 1;
    if (page.coverage === 'both-observed') group.pagesObservedByBoth += 1;
    else if (page.coverage === 'google-export-only') group.googleExportOnlyPages += 1;
    else group.bingExportOnlyPages += 1;
    if (page.googleSearchAiImpressions !== undefined) {
      group.googlePagesWithImpressions += 1;
      group.googleRowSummedImpressions += page.googleSearchAiImpressions;
    }
    if (page.bingAiCitations !== undefined) {
      group.bingPagesWithCitations += 1;
      group.bingRowSummedCitations = (group.bingRowSummedCitations ?? 0) + page.bingAiCitations;
    }
    if (content?.documentLanguageValid === true) {
      group.validLanguageTagPages += 1;
      pagesWithValidDeclaredLanguageTag += 1;
    } else if (content?.documentLanguageValid === false) {
      group.invalidLanguageTagPages += 1;
      pagesWithInvalidDeclaredLanguageTag += 1;
    } else {
      group.languageTagValidationUnavailablePages += 1;
      pagesWithDeclaredLanguageTagNotValidated += 1;
    }
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.googleObservedPagePercent = Number(
      (((group.pagesObservedByBoth + group.googleExportOnlyPages) / group.pages) * 100).toFixed(1)
    );
    group.bingObservedPagePercent = Number(
      (((group.pagesObservedByBoth + group.bingExportOnlyPages) / group.pages) * 100).toFixed(1)
    );
  }
  const languages = [...groups.values()].sort(
    (left, right) => right.pages - left.pages || left.language.localeCompare(right.language)
  );
  return {
    joinedPagesAnalyzed: pages.length,
    pagesWithCurrentAudit,
    languageProfilesAssessed,
    pagesWithDeclaredLanguage,
    assessedPagesWithoutDeclaredLanguage,
    pagesWithValidDeclaredLanguageTag,
    pagesWithInvalidDeclaredLanguageTag,
    pagesWithDeclaredLanguageTagNotValidated,
    pagesWithAuditButLanguageNotAssessed,
    pagesWithoutCurrentAudit,
    languages: languages.slice(0, MAX_DOCUMENT_LANGUAGES),
    languagesTruncated: languages.length > MAX_DOCUMENT_LANGUAGES,
    note: 'Language groups use the current audit’s declared document-language value, trimmed and compared case-insensitively. Google and Bing page-coverage percentages use only the joined page-URL union within each declared-language group; they are not whole-site coverage. When available, tag validity comes from the browser runtime BCP 47 canonicalizer; older audit summaries can have unavailable validation. Google impressions and Bing citation sums remain separate row-level observations. Current audit metadata may postdate either reporting period; these groupings show coverage and association only, not causation or language targeting quality.',
  };
}

function summarizePathFamilies(
  pages: AiPlatformPageObservation[],
  depth: number,
  googleMetricTotal: number,
  bingMetricTotal: number
): AiPlatformPathFamily[] {
  type PathFamilyBucket = {
    joinedPageGroups: number;
    googlePageGroups: number;
    bingPageGroups: number;
    pagesObservedByBoth: number;
    googleImpressions: number;
    googleMetricPages: number;
    bingCitations: number;
    bingMetricPages: number;
    pagesWithCurrentAudit: number;
    googlebotBlockedPages: number;
    bingbotBlockedPages: number;
    pagesWithIndexingRestrictions: number;
    pagesWithSnippetRestrictions: number;
    sampleUrls: Set<string>;
  };
  const groups = new Map<string, PathFamilyBucket>();
  for (const page of pages) {
    const url = new URL(page.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const prefix = segments.slice(0, depth);
    const family = `${url.origin}${prefix.length ? `/${prefix.join('/')}` : '/'}`;
    page.pathFamily = family;
    const group = groups.get(family) ?? {
      joinedPageGroups: 0,
      googlePageGroups: 0,
      bingPageGroups: 0,
      pagesObservedByBoth: 0,
      googleImpressions: 0,
      googleMetricPages: 0,
      bingCitations: 0,
      bingMetricPages: 0,
      pagesWithCurrentAudit: 0,
      googlebotBlockedPages: 0,
      bingbotBlockedPages: 0,
      pagesWithIndexingRestrictions: 0,
      pagesWithSnippetRestrictions: 0,
      sampleUrls: new Set<string>(),
    };
    group.joinedPageGroups += 1;
    if (page.coverage !== 'bing-export-only') group.googlePageGroups += 1;
    if (page.coverage !== 'google-export-only') group.bingPageGroups += 1;
    if (page.coverage === 'both-observed') group.pagesObservedByBoth += 1;
    if (page.googleSearchAiImpressions !== undefined) {
      group.googleMetricPages += 1;
      group.googleImpressions += page.googleSearchAiImpressions;
    }
    if (page.bingAiCitations !== undefined) {
      group.bingMetricPages += 1;
      group.bingCitations += page.bingAiCitations;
    }
    const audit = page.currentAuditSignals;
    if (audit) {
      group.pagesWithCurrentAudit += 1;
      if (audit.googlebot.access === 'blocked') group.googlebotBlockedPages += 1;
      if (audit.bingbot.access === 'blocked') group.bingbotBlockedPages += 1;
      if (audit.googlebot.noindex === true || audit.bingbot.noindex === true)
        group.pagesWithIndexingRestrictions += 1;
      if (
        audit.googlebot.noSnippet === true ||
        audit.googlebot.maxSnippetZero === true ||
        audit.bingbot.noSnippet === true ||
        audit.bingbot.maxSnippetZero === true ||
        (audit.dataNoSnippetElements ?? 0) > 0
      )
        group.pagesWithSnippetRestrictions += 1;
    }
    group.sampleUrls.add(page.url);
    groups.set(family, group);
  }

  return [...groups.entries()]
    .map(([family, group]): AiPlatformPathFamily => ({
      family,
      joinedPageGroups: group.joinedPageGroups,
      googlePageGroups: group.googlePageGroups,
      bingPageGroups: group.bingPageGroups,
      pagesObservedByBoth: group.pagesObservedByBoth,
      ...(group.googleMetricPages > 0 ? { googleImpressions: group.googleImpressions } : {}),
      ...(googleMetricTotal > 0 && group.googleMetricPages > 0
        ? {
            googleImpressionSharePercent: Number(
              ((group.googleImpressions / googleMetricTotal) * 100).toFixed(2)
            ),
          }
        : {}),
      ...(group.bingMetricPages > 0 ? { bingCitations: group.bingCitations } : {}),
      ...(bingMetricTotal > 0 && group.bingMetricPages > 0
        ? {
            bingCitationSharePercent: Number(
              ((group.bingCitations / bingMetricTotal) * 100).toFixed(2)
            ),
          }
        : {}),
      pagesWithCurrentAudit: group.pagesWithCurrentAudit,
      googlebotBlockedPages: group.googlebotBlockedPages,
      bingbotBlockedPages: group.bingbotBlockedPages,
      pagesWithIndexingRestrictions: group.pagesWithIndexingRestrictions,
      pagesWithSnippetRestrictions: group.pagesWithSnippetRestrictions,
      sampleUrls: [...group.sampleUrls].sort().slice(0, MAX_PATH_FAMILY_SAMPLE_URLS),
      sampleUrlsTruncated: group.sampleUrls.size > MAX_PATH_FAMILY_SAMPLE_URLS,
    }))
    .sort(
      (left, right) =>
        right.joinedPageGroups - left.joinedPageGroups || left.family.localeCompare(right.family)
    );
}

function summarizeCurrentAuditExposure(
  pages: AiPlatformPageObservation[],
  googleMetricTotal: number,
  bingMetricTotal: number
): AiPlatformCurrentAuditExposure {
  const controlDefinitions = [
    {
      control: 'googlebot-currently-blocked',
      matches: (audit: CurrentGEOPageAuditSignals) => audit.googlebot.access === 'blocked',
      assessed: (audit: CurrentGEOPageAuditSignals) => audit.googlebot.access !== 'not-assessed',
    },
    {
      control: 'bingbot-currently-blocked',
      matches: (audit: CurrentGEOPageAuditSignals) => audit.bingbot.access === 'blocked',
      assessed: (audit: CurrentGEOPageAuditSignals) => audit.bingbot.access !== 'not-assessed',
    },
    {
      control: 'indexing-restricted',
      matches: (audit: CurrentGEOPageAuditSignals) =>
        audit.googlebot.noindex === true || audit.bingbot.noindex === true,
      assessed: (audit: CurrentGEOPageAuditSignals) =>
        audit.googlebot.noindex !== undefined || audit.bingbot.noindex !== undefined,
    },
    {
      control: 'snippet-restricted',
      matches: (audit: CurrentGEOPageAuditSignals) =>
        audit.googlebot.noSnippet === true ||
        audit.googlebot.maxSnippetZero === true ||
        audit.bingbot.noSnippet === true ||
        audit.bingbot.maxSnippetZero === true,
      assessed: (audit: CurrentGEOPageAuditSignals) =>
        audit.googlebot.noSnippet !== undefined ||
        audit.googlebot.maxSnippetZero !== undefined ||
        audit.bingbot.noSnippet !== undefined ||
        audit.bingbot.maxSnippetZero !== undefined,
    },
    {
      control: 'data-nosnippet-present',
      matches: (audit: CurrentGEOPageAuditSignals) => (audit.dataNoSnippetElements ?? 0) > 0,
      assessed: (audit: CurrentGEOPageAuditSignals) => audit.dataNoSnippetElements !== undefined,
    },
  ] satisfies Array<{
    control: AiPlatformAuditExposureControl['control'];
    matches: (audit: CurrentGEOPageAuditSignals) => boolean;
    assessed: (audit: CurrentGEOPageAuditSignals) => boolean;
  }>;
  const auditedPages = pages.filter(
    (
      page
    ): page is AiPlatformPageObservation & { currentAuditSignals: CurrentGEOPageAuditSignals } =>
      page.currentAuditSignals !== undefined
  );
  const controls = controlDefinitions.map(
    ({ control, matches, assessed }): AiPlatformAuditExposureControl => {
      const observed = auditedPages.filter((page) => matches(page.currentAuditSignals));
      const googleImpressions = observed.reduce(
        (sum, page) => sum + (page.googleSearchAiImpressions ?? 0),
        0
      );
      const bingCitations = observed.reduce((sum, page) => sum + (page.bingAiCitations ?? 0), 0);
      return {
        control,
        pages: observed.length,
        pagesAssessed: auditedPages.filter((page) => assessed(page.currentAuditSignals)).length,
        ...(googleMetricTotal > 0
          ? {
              googleImpressionSharePercent: Number(
                ((googleImpressions / googleMetricTotal) * 100).toFixed(2)
              ),
            }
          : {}),
        ...(bingMetricTotal > 0
          ? {
              bingCitationSharePercent: Number(
                ((bingCitations / bingMetricTotal) * 100).toFixed(2)
              ),
            }
          : {}),
      };
    }
  );
  return {
    joinedPageGroups: pages.length,
    pagesWithCurrentAudit: auditedPages.length,
    googlebotAccessAssessedPages: auditedPages.filter(
      ({ currentAuditSignals }) =>
        currentAuditSignals?.googlebot.access === 'allowed' ||
        currentAuditSignals?.googlebot.access === 'blocked'
    ).length,
    bingbotAccessAssessedPages: auditedPages.filter(
      ({ currentAuditSignals }) =>
        currentAuditSignals?.bingbot.access === 'allowed' ||
        currentAuditSignals?.bingbot.access === 'blocked'
    ).length,
    controls,
    note: 'Control states are current saved-audit observations and may postdate either export. Each platform share is the portion of that platform’s own usable-URL metric sum carried by joined URL groups with the listed current signal; Google impressions and Bing citation observations remain different measures. These overlaps describe association only and do not show what policy existed during the export or why a page appeared.',
  };
}

/** Join page-only Search Console and Bing AI Performance exports by normalized URL. */
export function compareAiPlatformPageObservations(
  google: GoogleAiPerformanceExport,
  bing: BingAiPerformanceExport,
  audit?: SEOReport | SEOAuditBatchReport | SiteWideGeoAnalysis,
  sitemap?: AiPlatformSitemapInput,
  options?: { pathFamilyDepth?: number }
): AiPlatformPageMatrix {
  const pathFamilyDepth = options?.pathFamilyDepth;
  if (
    pathFamilyDepth !== undefined &&
    (!Number.isInteger(pathFamilyDepth) || pathFamilyDepth < 1 || pathFamilyDepth > 5)
  ) {
    throw new Error('GEO path-family depth must be an integer from 1 to 5.');
  }
  if (google.surface !== 'search') {
    throw new Error(
      'Cross-platform GEO matrices require a Google Search generative AI export; Discover is a separate surface.'
    );
  }
  if (google.dimensions.length !== 1 || google.dimensions[0] !== 'url') {
    throw new Error('Cross-platform GEO matrices require a Google page-dimension export.');
  }
  if (bing.datasetKind !== 'page-citations' || bing.rows.some(({ query, date }) => query || date)) {
    throw new Error(
      'Cross-platform GEO matrices require a Bing page-citations export without query or date dimensions.'
    );
  }

  const googleAuditCorrelation = audit
    ? correlateGoogleAiPerformanceWithAudit(google, audit)
    : undefined;
  const bingAuditCorrelation = audit ? correlateBingAiCitationsWithAudit(bing, audit) : undefined;
  const bingAuditRowByUrl = new Map(
    (bingAuditCorrelation?.rows ?? []).flatMap((row) => {
      const url = normalizeUrl(row.url);
      return url ? [[url, row] as const] : [];
    })
  );

  const googlePages = new Map<string, GooglePageRows>();
  let googleRowsWithoutUsableUrl = 0;
  for (const [index, row] of google.rows.entries()) {
    const sourceUrl = row.url;
    const normalizedUrl = sourceUrl ? normalizeUrl(sourceUrl) : undefined;
    if (!normalizedUrl) {
      googleRowsWithoutUsableUrl += 1;
      continue;
    }
    const auditRow = googleAuditCorrelation?.rows[index];
    const auditedUrl =
      auditRow?.auditMatched && auditRow.matchedAuditUrl
        ? normalizeUrl(auditRow.matchedAuditUrl)
        : undefined;
    const key = auditedUrl ?? normalizedUrl;
    const page = googlePages.get(key) ?? {
      impressions: 0,
      sourceUrls: new Set<string>(),
      ...(auditRow?.auditMatched ? { auditRow } : {}),
    };
    page.impressions += row.impressions;
    page.sourceUrls.add(sourceUrl ?? normalizedUrl);
    googlePages.set(key, page);
  }

  const bingPages = new Map<string, BingPageRows>();
  let bingRowsWithoutUsableUrl = 0;
  for (const row of bing.rows) {
    const sourceUrl = row.url;
    const normalizedUrl = sourceUrl ? normalizeUrl(sourceUrl) : undefined;
    if (!normalizedUrl) {
      bingRowsWithoutUsableUrl += 1;
      continue;
    }
    const auditRow = bingAuditRowByUrl.get(normalizedUrl);
    const auditedUrl =
      auditRow?.auditMatched && auditRow.matchedAuditUrl
        ? normalizeUrl(auditRow.matchedAuditUrl)
        : undefined;
    const key = auditedUrl ?? normalizedUrl;
    const page = bingPages.get(key) ?? {
      citations: 0,
      citationRows: 0,
      citedPages: 0,
      citedPageRows: 0,
      citationShares: [],
      sourceUrls: new Set<string>(),
      ...(auditRow?.auditMatched ? { auditRow } : {}),
    };
    page.sourceUrls.add(sourceUrl ?? normalizedUrl);
    if (row.citations !== undefined) {
      page.citations += row.citations;
      page.citationRows += 1;
    }
    if (row.citedPages !== undefined) {
      page.citedPages += row.citedPages;
      page.citedPageRows += 1;
    }
    if (row.citationShare !== undefined) page.citationShares.push(row.citationShare);
    bingPages.set(key, page);
  }

  const urls = [...new Set([...googlePages.keys(), ...bingPages.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );
  const googleUsableUrlRowSummedImpressions = [...googlePages.values()].reduce(
    (sum, page) => sum + page.impressions,
    0
  );
  const bingUsableUrlRowSummedCitations = [...bingPages.values()].reduce(
    (sum, page) => sum + page.citations,
    0
  );
  const pages = urls.map((url): AiPlatformPageObservation => {
    const googleImpressions = googlePages.get(url);
    const bingPage = bingPages.get(url);
    const googleImpressionSharePercent =
      googleImpressions && googleUsableUrlRowSummedImpressions > 0
        ? Number(
            ((googleImpressions.impressions / googleUsableUrlRowSummedImpressions) * 100).toFixed(2)
          )
        : undefined;
    const bingCitationSharePercent =
      bingPage?.citationRows && bingUsableUrlRowSummedCitations > 0
        ? Number(((bingPage.citations / bingUsableUrlRowSummedCitations) * 100).toFixed(2))
        : undefined;
    const currentAuditSignals = auditSignalsFromRows(
      googleImpressions?.auditRow,
      bingPage?.auditRow
    );
    return {
      url,
      coverage:
        googleImpressions !== undefined && bingPage
          ? 'both-observed'
          : googleImpressions !== undefined
            ? 'google-export-only'
            : 'bing-export-only',
      googleSourceUrls: googleImpressions
        ? [...googleImpressions.sourceUrls].sort().slice(0, MAX_SOURCE_URLS_PER_PAGE)
        : [],
      bingSourceUrls: bingPage
        ? [...bingPage.sourceUrls].sort().slice(0, MAX_SOURCE_URLS_PER_PAGE)
        : [],
      googleSourceUrlsTruncated:
        (googleImpressions?.sourceUrls.size ?? 0) > MAX_SOURCE_URLS_PER_PAGE,
      bingSourceUrlsTruncated: (bingPage?.sourceUrls.size ?? 0) > MAX_SOURCE_URLS_PER_PAGE,
      ...(currentAuditSignals ? { currentAuditSignals } : {}),
      ...(googleImpressions ? { googleSearchAiImpressions: googleImpressions.impressions } : {}),
      ...(googleImpressionSharePercent !== undefined ? { googleImpressionSharePercent } : {}),
      ...(bingPage?.citationRows ? { bingAiCitations: bingPage.citations } : {}),
      ...(bingCitationSharePercent !== undefined ? { bingCitationSharePercent } : {}),
      ...(googleImpressionSharePercent !== undefined && bingCitationSharePercent !== undefined
        ? {
            platformShareGapPercentagePoints: Number(
              (googleImpressionSharePercent - bingCitationSharePercent).toFixed(2)
            ),
          }
        : {}),
      ...(bingPage?.citedPageRows ? { bingCitedPages: bingPage.citedPages } : {}),
      ...(bingPage && bingPage.citationShares.length > 0
        ? {
            bingAverageCitationShare:
              bingPage.citationShares.reduce((sum, value) => sum + value, 0) /
              bingPage.citationShares.length,
          }
        : {}),
    };
  });
  let sitemapCoverage: AiPlatformSitemapCoverage | undefined;
  if (sitemap) {
    const normalizedSitemapUrl = normalizeUrl(sitemap.url);
    if (!normalizedSitemapUrl)
      throw new Error('GEO sitemap URL must be an HTTP(S) URL without credentials.');
    const sitemapOrigin = new URL(normalizedSitemapUrl).origin;
    const sitemapPageUrls = new Set(
      sitemap.pageUrls.flatMap((value) => {
        const normalized = normalizeUrl(value);
        return normalized && new URL(normalized).origin === sitemapOrigin ? [normalized] : [];
      })
    );
    for (const page of pages) {
      const exactUrl = normalizeUrl(page.url);
      const exportAliases = [...page.googleSourceUrls, ...page.bingSourceUrls].flatMap((value) => {
        const normalized = normalizeUrl(value);
        return normalized ? [normalized] : [];
      });
      const auditUrl = page.currentAuditSignals
        ? normalizeUrl(page.currentAuditSignals.auditUrl)
        : undefined;
      const matchedVia =
        exactUrl && sitemapPageUrls.has(exactUrl)
          ? 'matrix-url'
          : exportAliases.some((value) => sitemapPageUrls.has(value))
            ? 'export-url-alias'
            : auditUrl && sitemapPageUrls.has(auditUrl)
              ? 'matched-audit-url'
              : undefined;
      page.sitemapMembership = {
        state: matchedVia
          ? 'found-in-supplied-sitemap-list'
          : page.googleSourceUrlsTruncated || page.bingSourceUrlsTruncated
            ? 'possible-match-source-list-truncated'
            : 'not-found-in-supplied-sitemap-list',
        ...(matchedVia ? { matchedVia } : {}),
      };
    }
    const pagesFoundInSuppliedSitemapList = pages.filter(
      ({ sitemapMembership }) => sitemapMembership?.state === 'found-in-supplied-sitemap-list'
    ).length;
    const pagesWithPossibleAliasMatchFromTruncatedSourceLists = pages.filter(
      ({ sitemapMembership }) => sitemapMembership?.state === 'possible-match-source-list-truncated'
    ).length;
    const googleMetricShareOnListedPagesPercent =
      googleUsableUrlRowSummedImpressions > 0
        ? Number(
            (
              (pages
                .filter(
                  ({ sitemapMembership }) =>
                    sitemapMembership?.state === 'found-in-supplied-sitemap-list'
                )
                .reduce((sum, page) => sum + (page.googleSearchAiImpressions ?? 0), 0) /
                googleUsableUrlRowSummedImpressions) *
              100
            ).toFixed(2)
          )
        : undefined;
    const bingMetricShareOnListedPagesPercent =
      bingUsableUrlRowSummedCitations > 0
        ? Number(
            (
              (pages
                .filter(
                  ({ sitemapMembership }) =>
                    sitemapMembership?.state === 'found-in-supplied-sitemap-list'
                )
                .reduce((sum, page) => sum + (page.bingAiCitations ?? 0), 0) /
                bingUsableUrlRowSummedCitations) *
              100
            ).toFixed(2)
          )
        : undefined;
    sitemapCoverage = {
      sitemapUrl: normalizedSitemapUrl,
      sitemapUrlsDiscovered: sitemapPageUrls.size,
      pagesFoundInSuppliedSitemapList,
      pagesNotFoundInSuppliedSitemapList:
        pages.length -
        pagesFoundInSuppliedSitemapList -
        pagesWithPossibleAliasMatchFromTruncatedSourceLists,
      pagesWithPossibleAliasMatchFromTruncatedSourceLists,
      sitemapResultMayBeTruncated: sitemap.resultMayBeTruncated,
      ...(googleMetricShareOnListedPagesPercent !== undefined
        ? { googleMetricShareOnListedPagesPercent }
        : {}),
      ...(bingMetricShareOnListedPagesPercent !== undefined
        ? { bingMetricShareOnListedPagesPercent }
        : {}),
      note: 'Membership uses exact normalized HTTP(S) URLs from the supplied same-origin sitemap result, plus the matrix URL, retained source-export aliases, and a uniquely matched audit URL when available. Rows with no match and a capped source-alias list are kept as possible matches. Not found means absent from this supplied sitemap result, not absent from every site sitemap or blocked from indexing. A result at the configured URL cap may be incomplete. Listed-page metric shares use each platform’s own usable-URL row sum and do not establish indexing, crawling, or citation eligibility.',
    };
  }
  const bingCitationValues = bing.rows.flatMap(({ citations }) =>
    citations === undefined ? [] : [citations]
  );
  const bingCitedPageValues = bing.rows.flatMap(({ citedPages }) =>
    citedPages === undefined ? [] : [citedPages]
  );
  const pagesObservedByBoth = pages.filter(({ coverage }) => coverage === 'both-observed').length;
  const pagesWithBothShareMetrics = pages.filter(
    (page) =>
      page.googleImpressionSharePercent !== undefined && page.bingCitationSharePercent !== undefined
  ).length;
  const absoluteShareGaps = pages
    .flatMap((page) =>
      page.platformShareGapPercentagePoints === undefined
        ? []
        : [Math.abs(page.platformShareGapPercentagePoints)]
    )
    .sort((left, right) => left - right);
  const middleShareGapIndex = Math.floor(absoluteShareGaps.length / 2);
  const medianAbsoluteShareGapPercentagePoints =
    absoluteShareGaps.length === 0
      ? undefined
      : Number(
          (absoluteShareGaps.length % 2 === 1
            ? absoluteShareGaps[middleShareGapIndex]!
            : (absoluteShareGaps[middleShareGapIndex - 1]! +
                absoluteShareGaps[middleShareGapIndex]!) /
              2
          ).toFixed(2)
        );
  const googleMetricShareOnBothExportUrlsPercent =
    googleUsableUrlRowSummedImpressions > 0
      ? Number(
          (
            (pages
              .filter((page) => page.coverage === 'both-observed')
              .reduce((sum, page) => sum + (page.googleSearchAiImpressions ?? 0), 0) /
              googleUsableUrlRowSummedImpressions) *
            100
          ).toFixed(2)
        )
      : undefined;
  const bingMetricShareOnBothExportUrlsPercent =
    bingUsableUrlRowSummedCitations > 0
      ? Number(
          (
            (pages
              .filter((page) => page.coverage === 'both-observed')
              .reduce((sum, page) => sum + (page.bingAiCitations ?? 0), 0) /
              bingUsableUrlRowSummedCitations) *
            100
          ).toFixed(2)
        )
      : undefined;
  const documentLanguageCoverage = audit ? summarizeDocumentLanguageCoverage(pages) : undefined;
  const currentAuditExposure = audit
    ? summarizeCurrentAuditExposure(
        pages,
        googleUsableUrlRowSummedImpressions,
        bingUsableUrlRowSummedCitations
      )
    : undefined;
  const allPathFamilies =
    pathFamilyDepth === undefined
      ? undefined
      : summarizePathFamilies(
          pages,
          pathFamilyDepth,
          googleUsableUrlRowSummedImpressions,
          bingUsableUrlRowSummedCitations
        );

  return {
    source: 'Aviary cross-platform GEO page matrix',
    schemaVersion: 1,
    ...(google.sourceFile ? { googleSourceFile: google.sourceFile } : {}),
    ...(bing.sourceFile ? { bingSourceFile: bing.sourceFile } : {}),
    googleSearchAiPages: googlePages.size,
    bingAiPages: bingPages.size,
    pagesObservedByBoth,
    pagesOnlyInGoogleExport: googlePages.size - pagesObservedByBoth,
    pagesOnlyInBingExport: bingPages.size - pagesObservedByBoth,
    googleExportRowSummedImpressions: google.rows.reduce((sum, row) => sum + row.impressions, 0),
    ...(googleUsableUrlRowSummedImpressions > 0 ? { googleUsableUrlRowSummedImpressions } : {}),
    ...(bingCitationValues.length > 0
      ? { bingExportRowSummedCitations: bingCitationValues.reduce((sum, value) => sum + value, 0) }
      : {}),
    ...(bingUsableUrlRowSummedCitations > 0 ? { bingUsableUrlRowSummedCitations } : {}),
    ...(bingCitedPageValues.length > 0
      ? {
          bingExportRowSummedCitedPages: bingCitedPageValues.reduce((sum, value) => sum + value, 0),
        }
      : {}),
    ...(googleAuditCorrelation && bingAuditCorrelation
      ? {
          auditBridge: {
            googlePagesMatchedByCanonical: googleAuditCorrelation.pagesMatchedByCanonical,
            googlePagesWithAmbiguousAuditUrl:
              googleAuditCorrelation.pagesWithAmbiguousAuditUrlMatch,
            googlePagesWithAmbiguousCanonical:
              googleAuditCorrelation.pagesWithAmbiguousCanonicalMatch,
            bingPagesMatchedByCanonical: bingAuditCorrelation.citedPagesMatchedByCanonical,
            bingPagesWithAmbiguousAuditUrl:
              bingAuditCorrelation.citedPagesWithAmbiguousAuditUrlMatch,
            bingPagesWithAmbiguousCanonical:
              bingAuditCorrelation.citedPagesWithAmbiguousCanonicalMatch,
          },
        }
      : {}),
    ...(sitemapCoverage ? { sitemapCoverage } : {}),
    ...(pathFamilyDepth !== undefined && allPathFamilies
      ? {
          pathFamilyDepth,
          pathFamilyCount: allPathFamilies.length,
          pathFamilies: allPathFamilies.slice(0, MAX_PATH_FAMILIES),
          pathFamiliesTruncated: allPathFamilies.length > MAX_PATH_FAMILIES,
        }
      : {}),
    ...(currentAuditExposure ? { currentAuditExposure } : {}),
    platformShareOverlap: {
      pagesWithBothShareMetrics,
      ...(googleMetricShareOnBothExportUrlsPercent !== undefined
        ? { googleMetricShareOnBothExportUrlsPercent }
        : {}),
      ...(bingMetricShareOnBothExportUrlsPercent !== undefined
        ? { bingMetricShareOnBothExportUrlsPercent }
        : {}),
      ...(medianAbsoluteShareGapPercentagePoints !== undefined
        ? { medianAbsoluteShareGapPercentagePoints }
        : {}),
      note: 'Each percentage is the portion of that platform’s usable-URL row-summed metric attributed to URLs present in both input exports. The median absolute share gap uses only URL groups with both metrics. These describe coverage and distribution across distinct export measures, not comparable performance or whole-site coverage; sampling and periods may differ, and missing rows are unknown rather than zero activity.',
    },
    ...(documentLanguageCoverage ? { documentLanguageCoverage } : {}),
    rowsWithoutUsableUrl: {
      googleRows: googleRowsWithoutUsableUrl,
      bingRows: bingRowsWithoutUsableUrl,
    },
    pages: pages.slice(0, MAX_RETURNED_PAGES),
    pagesTruncated: pages.length > MAX_RETURNED_PAGES,
    note:
      (audit
        ? 'This matrix joins page-dimension Google Search and Bing page-citations exports by normalized exact URL, using a saved Aviary audit to bridge a uniquely declared canonical URL when available. Ambiguous canonical matches stay on their exact normalized export URL; source URL lists expose joined aliases. Rows without usable HTTP(S) URLs are excluded from page groups and counted separately. The metrics remain separate: Google impressions and Bing citation observations have different sampling, time ranges, and export limits. Per-page platform shares divide by that platform’s usable-URL grouped row sum; the Google-minus-Bing share gap compares proportions of distinct measures and is a distribution review cue, not a cross-platform performance score. A one-platform row means only that the URL was absent from that input file, not that the platform recorded zero activity. Current page-content structures and language metadata are audit-time snapshots, not evidence of causation or ranking factors. Row sums use the source export rows and are not property totals or complete answer/citation counts.'
        : 'This matrix joins only page-dimension Google Search and Bing page-citations exports by normalized exact URL (fragment removed); it does not merge metrics or infer canonical equivalence. Rows without usable HTTP(S) URLs are excluded from page groups and counted separately. Google impressions and Bing citation observations are different measures with different sampling, time ranges, and export limits. Per-page platform shares divide by that platform’s usable-URL grouped row sum; the Google-minus-Bing share gap compares proportions of distinct measures and is a distribution review cue, not a cross-platform performance score. A one-platform row means only that the URL was absent from that input file, not that the platform recorded zero activity. Row sums are not property totals or complete answer/citation counts.') +
      (pathFamilyDepth === undefined
        ? ''
        : ` Optional path-family summaries group normalized URLs by origin and their first ${pathFamilyDepth} path segment${pathFamilyDepth === 1 ? '' : 's'}; the report retains at most ${MAX_PATH_FAMILIES} groups. Google and Bing metric sums remain separate, and current audit restrictions are observations rather than explanations for the export data.`),
  };
}

/** Return whether a parsed value has the matrix fields needed for a period comparison. */
export function isAiPlatformPageMatrix(value: unknown): value is AiPlatformPageMatrix {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AiPlatformPageMatrix>;
  const validMetric = (metric: unknown): boolean =>
    metric === undefined || (typeof metric === 'number' && Number.isFinite(metric) && metric >= 0);
  const validPathFamily = (family: unknown): boolean =>
    Boolean(family) &&
    typeof family === 'object' &&
    typeof (family as AiPlatformPathFamily).family === 'string' &&
    Number.isInteger((family as AiPlatformPathFamily).joinedPageGroups) &&
    (family as AiPlatformPathFamily).joinedPageGroups >= 1 &&
    validMetric((family as AiPlatformPathFamily).googleImpressions) &&
    validMetric((family as AiPlatformPathFamily).bingCitations);
  return (
    candidate.source === 'Aviary cross-platform GEO page matrix' &&
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.pages) &&
    typeof candidate.pagesTruncated === 'boolean' &&
    candidate.pages.every(
      (page) =>
        Boolean(page) &&
        typeof page.url === 'string' &&
        page.url.length > 0 &&
        ['both-observed', 'google-export-only', 'bing-export-only'].includes(page.coverage) &&
        validMetric(page.googleSearchAiImpressions) &&
        validMetric(page.bingAiCitations) &&
        validMetric(page.googleImpressionSharePercent) &&
        validMetric(page.bingCitationSharePercent)
    ) &&
    validMetric(candidate.googleUsableUrlRowSummedImpressions) &&
    validMetric(candidate.bingUsableUrlRowSummedCitations) &&
    (candidate.pathFamilyDepth === undefined ||
      (Number.isInteger(candidate.pathFamilyDepth) &&
        candidate.pathFamilyDepth >= 1 &&
        candidate.pathFamilyDepth <= 5)) &&
    (candidate.pathFamilies === undefined ||
      (Array.isArray(candidate.pathFamilies) && candidate.pathFamilies.every(validPathFamily))) &&
    (candidate.pathFamiliesTruncated === undefined ||
      typeof candidate.pathFamiliesTruncated === 'boolean')
  );
}

/** Compare page observations and within-platform shares from two saved cross-platform matrices. */
export function compareAiPlatformPageMatrices(
  current: AiPlatformPageMatrix,
  baseline: AiPlatformPageMatrix
): AiPlatformPageMatrixComparison {
  const normalizeMatrixUrl = (value: string): string | undefined => normalizeUrl(value);
  const currentPages = new Map(
    current.pages.flatMap((page) => {
      const url = normalizeMatrixUrl(page.url);
      return url ? [[url, page] as const] : [];
    })
  );
  const baselinePages = new Map(
    baseline.pages.flatMap((page) => {
      const url = normalizeMatrixUrl(page.url);
      return url ? [[url, page] as const] : [];
    })
  );
  const keys = [...new Set([...currentPages.keys(), ...baselinePages.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );
  let googlePagesWithComparableImpressions = 0;
  let bingPagesWithComparableCitations = 0;
  let googlePagesWithComparableShare = 0;
  let bingPagesWithComparableShare = 0;
  let googlePagesWithIncreasingShare = 0;
  let googlePagesWithDecreasingShare = 0;
  let bingPagesWithIncreasingShare = 0;
  let bingPagesWithDecreasingShare = 0;
  let matchedGoogleImpressionChange = 0;
  let matchedBingCitationChange = 0;
  const changes = keys.map((url): AiPlatformPagePeriodChange => {
    const currentPage = currentPages.get(url);
    const baselinePage = baselinePages.get(url);
    if (!currentPage) return { url, state: 'baseline-only' };
    if (!baselinePage) return { url, state: 'current-only' };
    const change: AiPlatformPagePeriodChange = { url, state: 'present-both' };
    if (
      currentPage.googleSearchAiImpressions !== undefined &&
      baselinePage.googleSearchAiImpressions !== undefined
    ) {
      const delta = currentPage.googleSearchAiImpressions - baselinePage.googleSearchAiImpressions;
      googlePagesWithComparableImpressions += 1;
      matchedGoogleImpressionChange += delta;
      change.baselineGoogleImpressions = baselinePage.googleSearchAiImpressions;
      change.currentGoogleImpressions = currentPage.googleSearchAiImpressions;
      change.googleImpressionChange = delta;
      const baselineTotal = baseline.googleUsableUrlRowSummedImpressions;
      const currentTotal = current.googleUsableUrlRowSummedImpressions;
      if (baselineTotal && baselineTotal > 0 && currentTotal && currentTotal > 0) {
        const shareDelta =
          (currentPage.googleSearchAiImpressions / currentTotal) * 100 -
          (baselinePage.googleSearchAiImpressions / baselineTotal) * 100;
        googlePagesWithComparableShare += 1;
        if (shareDelta > 0) googlePagesWithIncreasingShare += 1;
        if (shareDelta < 0) googlePagesWithDecreasingShare += 1;
        change.googleImpressionShareChangePercentagePoints = Number(shareDelta.toFixed(2));
      }
    }
    if (currentPage.bingAiCitations !== undefined && baselinePage.bingAiCitations !== undefined) {
      const delta = currentPage.bingAiCitations - baselinePage.bingAiCitations;
      bingPagesWithComparableCitations += 1;
      matchedBingCitationChange += delta;
      change.baselineBingCitations = baselinePage.bingAiCitations;
      change.currentBingCitations = currentPage.bingAiCitations;
      change.bingCitationChange = delta;
      const baselineTotal = baseline.bingUsableUrlRowSummedCitations;
      const currentTotal = current.bingUsableUrlRowSummedCitations;
      if (baselineTotal && baselineTotal > 0 && currentTotal && currentTotal > 0) {
        const shareDelta =
          (currentPage.bingAiCitations / currentTotal) * 100 -
          (baselinePage.bingAiCitations / baselineTotal) * 100;
        bingPagesWithComparableShare += 1;
        if (shareDelta > 0) bingPagesWithIncreasingShare += 1;
        if (shareDelta < 0) bingPagesWithDecreasingShare += 1;
        change.bingCitationShareChangePercentagePoints = Number(shareDelta.toFixed(2));
      }
    }
    return change;
  });
  changes.sort((left, right) => {
    const maxShareShift = (page: AiPlatformPagePeriodChange): number =>
      Math.max(
        Math.abs(page.googleImpressionShareChangePercentagePoints ?? 0),
        Math.abs(page.bingCitationShareChangePercentagePoints ?? 0)
      );
    const stateOrder = (state: AiPlatformPagePeriodChange['state']): number =>
      state === 'present-both' ? 0 : state === 'current-only' ? 1 : 2;
    return (
      stateOrder(left.state) - stateOrder(right.state) ||
      maxShareShift(right) - maxShareShift(left) ||
      left.url.localeCompare(right.url)
    );
  });
  const pagesPresentInBothReturnedLists = keys.filter(
    (url) => currentPages.has(url) && baselinePages.has(url)
  ).length;
  let pathFamilyComparison: AiPlatformPathFamilyComparison | undefined;
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
    const familyKeys = [...new Set([...currentFamilies.keys(), ...baselineFamilies.keys()])];
    const families = familyKeys
      .map((family): AiPlatformPathFamilyPeriodChange => {
        const currentFamily = currentFamilies.get(family);
        const baselineFamily = baselineFamilies.get(family);
        const state =
          currentFamily && baselineFamily
            ? 'present-both'
            : currentFamily
              ? 'current-only'
              : 'baseline-only';
        const change: AiPlatformPathFamilyPeriodChange = {
          family,
          state,
          baselinePageGroups: baselineFamily?.joinedPageGroups ?? 0,
          currentPageGroups: currentFamily?.joinedPageGroups ?? 0,
        };
        if (currentFamily && baselineFamily) {
          if (
            currentFamily.googleImpressions !== undefined &&
            baselineFamily.googleImpressions !== undefined
          ) {
            change.baselineGoogleImpressions = baselineFamily.googleImpressions;
            change.currentGoogleImpressions = currentFamily.googleImpressions;
            change.googleImpressionChange =
              currentFamily.googleImpressions - baselineFamily.googleImpressions;
            const baselineTotal = baseline.googleUsableUrlRowSummedImpressions;
            const currentTotal = current.googleUsableUrlRowSummedImpressions;
            if (baselineTotal && baselineTotal > 0 && currentTotal && currentTotal > 0) {
              change.googleImpressionShareChangePercentagePoints = Number(
                (
                  (currentFamily.googleImpressions / currentTotal) * 100 -
                  (baselineFamily.googleImpressions / baselineTotal) * 100
                ).toFixed(2)
              );
            }
          }
          if (
            currentFamily.bingCitations !== undefined &&
            baselineFamily.bingCitations !== undefined
          ) {
            change.baselineBingCitations = baselineFamily.bingCitations;
            change.currentBingCitations = currentFamily.bingCitations;
            change.bingCitationChange = currentFamily.bingCitations - baselineFamily.bingCitations;
            const baselineTotal = baseline.bingUsableUrlRowSummedCitations;
            const currentTotal = current.bingUsableUrlRowSummedCitations;
            if (baselineTotal && baselineTotal > 0 && currentTotal && currentTotal > 0) {
              change.bingCitationShareChangePercentagePoints = Number(
                (
                  (currentFamily.bingCitations / currentTotal) * 100 -
                  (baselineFamily.bingCitations / baselineTotal) * 100
                ).toFixed(2)
              );
            }
          }
        }
        return change;
      })
      .sort((left, right) => {
        const maxShift = (family: AiPlatformPathFamilyPeriodChange) =>
          Math.max(
            Math.abs(family.googleImpressionShareChangePercentagePoints ?? 0),
            Math.abs(family.bingCitationShareChangePercentagePoints ?? 0)
          );
        return (
          maxShift(right) - maxShift(left) ||
          right.currentPageGroups +
            right.baselinePageGroups -
            (left.currentPageGroups + left.baselinePageGroups) ||
          left.family.localeCompare(right.family)
        );
      });
    const familiesPresentInBothReturnedLists = familyKeys.filter(
      (family) => currentFamilies.has(family) && baselineFamilies.has(family)
    ).length;
    pathFamilyComparison = {
      pathFamilyDepth: current.pathFamilyDepth,
      baselineFamilyCount: baseline.pathFamilyCount ?? baselineFamilies.size,
      currentFamilyCount: current.pathFamilyCount ?? currentFamilies.size,
      familiesPresentInBothReturnedLists,
      familiesOnlyInCurrentReturnedList: familyKeys.filter(
        (family) => currentFamilies.has(family) && !baselineFamilies.has(family)
      ).length,
      familiesOnlyInBaselineReturnedList: familyKeys.filter(
        (family) => baselineFamilies.has(family) && !currentFamilies.has(family)
      ).length,
      baselineFamiliesTruncated: baseline.pathFamiliesTruncated ?? false,
      currentFamiliesTruncated: current.pathFamiliesTruncated ?? false,
      families: families.slice(0, MAX_PATH_FAMILIES),
      familiesTruncated: families.length > MAX_PATH_FAMILIES,
      note: 'Path families are compared only when both matrices use the same configured leading-segment depth. Membership covers returned family groups only; either source can be capped at 250. Family metric changes and shares remain separate by platform, and row sums are not property totals. A family absent from a retained list is an export-list difference, not evidence of zero activity or a cause.',
    };
  }
  return {
    ...(baseline.googleSourceFile ? { baselineGoogleSourceFile: baseline.googleSourceFile } : {}),
    ...(baseline.bingSourceFile ? { baselineBingSourceFile: baseline.bingSourceFile } : {}),
    ...(current.googleSourceFile ? { currentGoogleSourceFile: current.googleSourceFile } : {}),
    ...(current.bingSourceFile ? { currentBingSourceFile: current.bingSourceFile } : {}),
    baselineReturnedPageGroups: baseline.pages.length,
    currentReturnedPageGroups: current.pages.length,
    baselinePagesTruncated: baseline.pagesTruncated,
    currentPagesTruncated: current.pagesTruncated,
    pagesPresentInBothReturnedLists,
    pagesOnlyInCurrentReturnedList: keys.filter(
      (url) => currentPages.has(url) && !baselinePages.has(url)
    ).length,
    pagesOnlyInBaselineReturnedList: keys.filter(
      (url) => baselinePages.has(url) && !currentPages.has(url)
    ).length,
    googlePagesWithComparableImpressions,
    bingPagesWithComparableCitations,
    googlePagesWithComparableShare,
    bingPagesWithComparableShare,
    googlePagesWithIncreasingShare,
    googlePagesWithDecreasingShare,
    bingPagesWithIncreasingShare,
    bingPagesWithDecreasingShare,
    ...(googlePagesWithComparableImpressions > 0 ? { matchedGoogleImpressionChange } : {}),
    ...(bingPagesWithComparableCitations > 0 ? { matchedBingCitationChange } : {}),
    pages: changes.slice(0, MAX_RETURNED_PAGES),
    pagesTruncated: changes.length > MAX_RETURNED_PAGES,
    ...(pathFamilyComparison ? { pathFamilyComparison } : {}),
    note: `The comparison joins normalized page URLs retained in the two saved matrices. Each metric is compared only within its own platform: Google impression counts/shares and Bing citation counts/shares remain separate. Matched-page raw deltas sum only comparable returned URL groups and are not whole-export changes. Shares are recalculated from each matrix's usable-URL metric total and show each matched page's change in that platform's within-export share (percentage points). If either source matrix truncated its 1,000-row page list, the comparison covers only those retained rows; export-only means absent from a retained list, not zero activity. Matrices should use equivalent properties, surfaces, filters, and date windows except for the intended period change. Different canonical-audit bridges can change joined URL keys; no causal or cross-platform performance score is inferred. Path-family changes appear only when both matrices were built with the same path-family depth.`,
  };
}
