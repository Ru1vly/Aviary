import type { SEOAuditBatchReport, SEOReport } from './types';
import { escapeSpreadsheetCsvCell } from './utils/csv';

export interface DuplicateMetadataGroup {
  value: string;
  urls: string[];
}

export interface SiteWideMetadataAnalysis {
  pagesAnalyzed: number;
  titlesAnalyzed: number;
  descriptionsAnalyzed: number;
  duplicateTitles: DuplicateMetadataGroup[];
  duplicateDescriptions: DuplicateMetadataGroup[];
}

export interface DuplicateContentGroup {
  wordCount: number;
  normalizedCharacters: number;
  urls: string[];
}

export interface SiteWideContentAnalysis {
  pagesAnalyzed: number;
  pagesWithFingerprint: number;
  pagesSkipped: number;
  duplicateContent: DuplicateContentGroup[];
}

export interface SiteWideLinkGraphPage {
  url: string;
  inboundLinks: number;
  outboundLinks: number;
}

export interface SiteWideLinkGraphAnalysis {
  pagesAnalyzed: number;
  pagesWithGraphData: number;
  pagesSkipped: number;
  linksAnalyzed: number;
  pagesWithNoInboundLinks: string[];
  pagesWithNoOutboundLinks: string[];
  truncatedPages: string[];
  mostLinkedPages: SiteWideLinkGraphPage[];
}

export interface SiteWideHreflangFinding {
  sourceUrl: string;
  targetUrl: string;
  language: string;
}

export interface SiteWideHreflangAnalysis {
  pagesAnalyzed: number;
  pagesWithData: number;
  pagesWithAlternates: number;
  pagesSkipped: number;
  alternateLinksAnalyzed: number;
  unscannedTargetUrls: string[];
  unavailableTargetUrls: string[];
  missingReciprocals: SiteWideHreflangFinding[];
}

export interface SiteWideCanonicalChain {
  sourceUrl: string;
  canonicalTargetUrl: string;
  finalCanonicalUrl: string;
}

export interface SiteWideCanonicalAnalysis {
  pagesAnalyzed: number;
  pagesWithData: number;
  pagesWithCanonical: number;
  pagesMissingCanonical: number;
  pagesWithMultipleCanonicals: number;
  pagesWithInvalidCanonical: number;
  multipleCanonicalUrls: string[];
  invalidCanonicalUrls: string[];
  pagesSkipped: number;
  duplicateCanonicalTargets: DuplicateMetadataGroup[];
  canonicalTargetsOutsideBatch: string[];
  canonicalTargetsUnavailable: string[];
  canonicalChains: SiteWideCanonicalChain[];
  canonicalLoops: string[][];
}

export interface SiteWideGeoCrawlerCoverage {
  token: string;
  assessedPages: number;
  unassessedPages: number;
  allowedPages: number;
  blockedPages: number;
  blockedUrls: string[];
}

export interface SiteWideGeoNoArchiveCoverage {
  token: string;
  pagesAssessed: number;
  pagesWithNoArchive: number;
  pagesUnassessed: number;
}

export interface SiteWideGeoFileCoverage {
  path: string;
  pagesFound: number;
  pagesAbsent: number;
  pagesUnconfirmed: number;
  pagesUnassessed: number;
  linkTargetTotals?: SiteWideGeoLlmsLinkTargetTotals;
}

export interface SiteWideGeoLlmsLinkTargetProfile {
  markdownLinks: number;
  uniqueWebTargets: number;
  duplicateWebTargets: number;
  sameOriginWebLinks: number;
  externalHttpsLinks: number;
  externalHttpLinks: number;
  relativeLinks: number;
  unsupportedSchemeLinks: number;
  invalidTargets: number;
  emptyLabels: number;
  malformedLinkCandidates: number;
}

export interface SiteWideGeoLlmsLinkTargetTotals extends SiteWideGeoLlmsLinkTargetProfile {
  profilesMeasured: number;
  truncatedProfiles: number;
  pagesWithDuplicateWebTargets: number;
  pagesWithUnsupportedSchemeLinks: number;
  pagesWithMalformedLinkCandidates: number;
}

export interface SiteWideGeoSourceHostCoverage {
  host: string;
  pagesLinked: number;
  /** Sum of per-page host counts that were retained by the bounded citation profile. */
  observedLinks?: number;
}

export interface SiteWideGeoPageCrawlerAccess {
  token: string;
  allowed: boolean;
  matchedAgents?: string[];
  matchedRule?: { directive: 'allow' | 'disallow'; pattern: string; line: number };
}

export type SiteWideGeoSignalStatus = 'measured' | 'not-assessed' | 'not-run';

export interface SiteWideGeoPageSignalCoverage {
  searchCrawlerAccess: SiteWideGeoSignalStatus;
  dataUseCrawlerPolicy: SiteWideGeoSignalStatus;
  userInitiatedFetchAccess?: SiteWideGeoSignalStatus;
  previewControls: SiteWideGeoSignalStatus;
  answerContent: SiteWideGeoSignalStatus;
  sourceRenderedContent: SiteWideGeoSignalStatus;
  citationEvidence: SiteWideGeoSignalStatus;
  optionalLlmsFiles: SiteWideGeoSignalStatus;
}

export interface SiteWideGeoPageSummary {
  url: string;
  canonicalUrl?: string;
  geoAssessed: boolean;
  signalCoverage: SiteWideGeoPageSignalCoverage;
  signalNotes?: Partial<Record<keyof SiteWideGeoPageSignalCoverage, string>>;
  searchCrawlerAccess?: SiteWideGeoPageCrawlerAccess[];
  dataUseCrawlerPolicy?: SiteWideGeoPageCrawlerAccess[];
  userInitiatedFetchAccess?: SiteWideGeoPageCrawlerAccess[];
  previewControls?: {
    responseStatus?: number;
    noindex?: boolean;
    noSnippet?: boolean;
    maxSnippetZero?: boolean;
    dataNoSnippetElements?: number;
    dataNoSnippetWords?: number;
    dataNoSnippetWordSharePercent?: number | null;
    visibleTextWords?: number;
    crawlerControls?: Array<{
      token: string;
      noindex: boolean;
      noSnippet: boolean;
      maxSnippetZero: boolean;
    }>;
    dataUseCrawlerControls?: Array<{ token: string; noArchive: boolean; noindex?: boolean }>;
  };
  answerContent?: {
    contentWords?: number;
    mainOrArticleRegion?: boolean;
    headingCount?: number;
    questionHeadings?: number;
    conciseAnswerBlocks?: number;
    listCount?: number;
    tableCount?: number;
    externalContentLinks?: number;
    visibleAuthor?: boolean;
    visibleDate?: boolean;
    schemaAuthor?: boolean;
    schemaDate?: boolean;
    schemaDateModifiedDays?: string[];
    schemaDateModifiedDaysTruncated?: boolean;
    schemaDateModifiedHasNonDateValue?: boolean;
    schemaIsAccessibleForFree?: boolean | 'mixed' | 'not-declared';
    schemaHasNonBooleanAccessibleForFreeValue?: boolean;
    jsonLdTypes?: string[];
    jsonLdTypeListTruncated?: boolean;
    identityEntities?: Array<{
      types: string[];
      id?: string;
      name?: string;
      sameAs: string[];
      sameAsTruncated: boolean;
    }>;
    identityEntityListTruncated?: boolean;
    documentLanguage?: string;
    documentLanguageValid?: boolean;
  };
  sourceRenderedContent?: {
    assessed: boolean;
    textExtraction?: string;
    reason?: string;
    renderedPhraseCoveragePercent?: number | null;
    sourceWordCount?: number;
    renderedWordCount?: number;
    sourcePhraseCount?: number;
    renderedPhraseCount?: number;
    sharedRenderedPhraseCount?: number;
    renderedOnlyPhraseCount?: number;
    sampleTruncated?: boolean;
  };
  citationEvidence?: {
    externalSourceLinkCount?: number;
    uniqueSourceHosts?: number;
    descriptiveSourceLinkCount?: number;
    sourceHosts?: string[];
    sourceHostListTruncated?: boolean;
    sourceHostLinkCounts?: Array<{ host: string; links: number }>;
    sourceHostLinkCountsTruncated?: boolean;
    topSourceHostLinkSharePercent?: number | null;
    referenceSectionCount?: number;
    referenceSectionLinkCount?: number;
    inlineCitationMarkerCount?: number;
    resolvedInlineCitationTargetsWithExternalLinks?: number;
    resolvedInlineCitationTargetsWithoutExternalLinks?: number;
    unresolvedInlineCitationTargetCount?: number;
    unresolvedInlineCitationTargets?: string[];
    unresolvedInlineCitationTargetsTruncated?: boolean;
    jsonLdBlocksWithCitationField?: number;
  };
  optionalLlmsFiles?: Array<{
    path: string;
    state: 'found' | 'absent' | 'unconfirmed' | 'unassessed';
    status?: number;
    contentTruncated?: boolean;
    linkTargetProfile?: SiteWideGeoLlmsLinkTargetProfile;
  }>;
}

export interface SiteWideGeoContentProfile {
  pagesAssessed: number;
  pagesWithMainOrArticleRegion: number;
  sourceRenderedProfilesAssessed: number;
  sourceRenderedPhraseCoverageSamples: number;
  sourceRenderedPhraseCoverageMeanPercent: number | null;
  sourceRenderedPhraseCoverageWithoutUsableSample: number;
  sourceRenderedPhraseCoverageBands: Array<{
    band: '0-19.9%' | '20-39.9%' | '40-59.9%' | '60-79.9%' | '80-100%';
    pages: number;
  }>;
  authorSignalCrossTab: SiteWideGeoSignalCrossTab;
  dateSignalCrossTab: SiteWideGeoSignalCrossTab;
  pagesWithQuestionHeadings: number;
  totalQuestionHeadings: number;
  totalConciseAnswerBlocks: number;
  pagesWithVisibleAuthor: number;
  pagesWithVisibleDate: number;
  pagesWithSchemaAuthor: number;
  pagesWithSchemaDate: number;
  pagesWithFreeAccessSchemaDeclaration: number;
  pagesWithPaywalledSchemaDeclaration: number;
  pagesWithConflictingFreeAccessSchemaDeclarations: number;
  pagesWithoutFreeAccessSchemaDeclaration: number;
  pagesWithNonBooleanFreeAccessSchemaValue: number;
  pagesWithTruncatedJsonLdTypeLists: number;
  schemaTypeCoverage: Array<{ type: string; pages: number }>;
}

export interface SiteWideGeoSignalCrossTab {
  sampledPages: number;
  visibleAndSchema: number;
  visibleOnly: number;
  schemaOnly: number;
  neither: number;
  incompleteProfiles: number;
}

function addSiteWideGeoSignalCrossTab(
  crossTab: SiteWideGeoSignalCrossTab,
  visible: unknown,
  structured: unknown
): void {
  if (typeof visible !== 'boolean' || typeof structured !== 'boolean') {
    crossTab.incompleteProfiles += 1;
    return;
  }
  crossTab.sampledPages += 1;
  if (visible && structured) crossTab.visibleAndSchema += 1;
  else if (visible) crossTab.visibleOnly += 1;
  else if (structured) crossTab.schemaOnly += 1;
  else crossTab.neither += 1;
}

export interface SiteWideGeoEntityNameVariant {
  id: string;
  types: string[];
  names: string[];
  pages: string[];
}

export interface SiteWideGeoEntityTypeVariant {
  id: string;
  pages: Array<{ url: string; types: string[] }>;
  pagesTruncated: boolean;
}

export interface SiteWideGeoEntitySameAsVariant {
  id: string;
  pages: Array<{ url: string; sameAs: string[] }>;
  pagesTruncated: boolean;
  excludedIncompletePages: number;
}

export interface SiteWideGeoEntityAnalysis {
  pagesWithIdentityEntities: number;
  pagesWithTruncatedEntityLists: number;
  pagesWithTruncatedSameAsLists: number;
  pagesWithSameAsReferences: number;
  totalSameAsReferences: number;
  sameAsHostCoverage: Array<{ host: string; pages: number }>;
  uniqueIdentityIds: number;
  identityIdsSharedAcrossPages: number;
  entitiesWithNameVariants: number;
  nameVariants: SiteWideGeoEntityNameVariant[];
  entitiesWithTypeVariants: number;
  typeVariants: SiteWideGeoEntityTypeVariant[];
  entitiesWithSameAsVariants: number;
  sameAsVariants: SiteWideGeoEntitySameAsVariant[];
}

export interface SiteWideGeoAnalysis {
  schemaVersion: 1;
  auditTimestamp: string;
  pagesAnalyzed: number;
  pagesWithGeoData: number;
  pagesSkipped: number;
  pageSummaries: SiteWideGeoPageSummary[];
  searchCrawlerCoverage: SiteWideGeoCrawlerCoverage[];
  dataUseCrawlerPolicy: SiteWideGeoCrawlerCoverage[];
  userInitiatedFetchPolicy?: SiteWideGeoCrawlerCoverage[];
  dataUseNoArchiveCoverage: SiteWideGeoNoArchiveCoverage[];
  pagesWithNoindex: number;
  pagesWithNoindexUrls: string[];
  pagesWithNoSnippet: number;
  pagesWithNoSnippetUrls: string[];
  pagesWithDataNoSnippetRegions: number;
  pagesWithDataNoSnippetRegionUrls: string[];
  totalDataNoSnippetElements: number;
  totalDataNoSnippetWords: number;
  dataNoSnippetWordShareSamples: number;
  dataNoSnippetWordShareMeanPercent: number | null;
  pagesWithExternalSources: number;
  totalExternalSourceLinks: number;
  sourceHostCoverage: SiteWideGeoSourceHostCoverage[];
  pagesWithTruncatedSourceHostLists: number;
  pagesWithTruncatedSourceHostLinkCounts: number;
  pagesWithCitationMarkersOrReferences: number;
  totalResolvedInlineCitationTargetsWithExternalLinks: number;
  totalResolvedInlineCitationTargetsWithoutExternalLinks: number;
  pagesWithUnresolvedInlineCitationTargets: number;
  totalUnresolvedInlineCitationTargets: number;
  unresolvedInlineCitationTargetUrls: string[];
  optionalLlmsFiles: SiteWideGeoFileCoverage[];
  contentProfile: SiteWideGeoContentProfile;
  entityAnalysis: SiteWideGeoEntityAnalysis;
}

const OPTIONAL_GEO_FILE_PATHS = ['/llms.txt', '/llms-full.txt'] as const;

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return value.trim();
  }
}

function normalizeWebUrl(value: string, baseUrl?: string): string | undefined {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password)
      return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

function normalizeMetadata(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeSchemaEntityId(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value.trim();
  }
}

function detailText(report: SEOReport, ruleName: string, property: string): string | undefined {
  const checks = report.checks.metaTags ?? [];
  const namedCheck = checks.find((check) => check.name === ruleName);
  const namedValue = namedCheck?.details?.[property];
  if (typeof namedValue === 'string' && namedValue.trim()) return namedValue.trim();

  for (const check of checks) {
    const value = check.details?.[property];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function findDuplicates(
  values: Map<string, { value: string; urls: string[] }>
): DuplicateMetadataGroup[] {
  return [...values.values()]
    .filter(({ urls }) => urls.length > 1)
    .map(({ value, urls }) => ({ value, urls: [...urls] }))
    .sort(
      (left, right) =>
        right.urls.length - left.urls.length ||
        (left.value < right.value ? -1 : left.value > right.value ? 1 : 0)
    );
}

/** Find repeated page titles and meta descriptions among unique completed pages in a batch. */
export function analyzeSiteWideMetadata(batch: SEOAuditBatchReport): SiteWideMetadataAnalysis {
  const seenUrls = new Set<string>();
  const titles = new Map<string, { value: string; urls: string[] }>();
  const descriptions = new Map<string, { value: string; urls: string[] }>();

  for (const result of batch.results) {
    if (result.status !== 'complete') continue;
    const url = normalizeUrl(result.url);
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const title = detailText(result.report, 'title-length-valid', 'title');
    if (title) {
      const key = normalizeMetadata(title);
      const group = titles.get(key) ?? { value: title, urls: [] };
      group.urls.push(result.url);
      titles.set(key, group);
    }

    const description = detailText(result.report, 'meta-description-length-valid', 'description');
    if (description) {
      const key = normalizeMetadata(description);
      const group = descriptions.get(key) ?? { value: description, urls: [] };
      group.urls.push(result.url);
      descriptions.set(key, group);
    }
  }

  return {
    pagesAnalyzed: seenUrls.size,
    titlesAnalyzed: [...titles.values()].reduce((total, group) => total + group.urls.length, 0),
    descriptionsAnalyzed: [...descriptions.values()].reduce(
      (total, group) => total + group.urls.length,
      0
    ),
    duplicateTitles: findDuplicates(titles),
    duplicateDescriptions: findDuplicates(descriptions),
  };
}

/** Find exact normalized page-text matches among completed pages with at least 50 words. */
export function analyzeSiteWideContent(batch: SEOAuditBatchReport): SiteWideContentAnalysis {
  const seenUrls = new Set<string>();
  const fingerprints = new Map<string, DuplicateContentGroup>();
  let pagesWithFingerprint = 0;
  let pagesSkipped = 0;

  for (const result of batch.results) {
    if (result.status !== 'complete') continue;
    const url = normalizeUrl(result.url);
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const check = (result.report.checks.content ?? []).find(
      (item) => item.name === 'word-count-adequate'
    );
    const digest = check?.details?.contentFingerprint;
    const wordCount = check?.details?.wordCount;
    const normalizedCharacters = check?.details?.normalizedCharacters;
    if (!check || typeof wordCount !== 'number' || !Number.isInteger(wordCount) || wordCount < 0) {
      pagesSkipped += 1;
      continue;
    }
    if (wordCount < 50) continue;
    if (
      typeof digest !== 'string' ||
      !/^[\da-f]{64}$/i.test(digest) ||
      typeof normalizedCharacters !== 'number' ||
      !Number.isInteger(normalizedCharacters) ||
      normalizedCharacters < 1
    ) {
      pagesSkipped += 1;
      continue;
    }

    pagesWithFingerprint += 1;
    const normalizedDigest = digest.toLowerCase();
    const group = fingerprints.get(normalizedDigest) ?? {
      wordCount,
      normalizedCharacters,
      urls: [],
    };
    group.urls.push(result.url);
    fingerprints.set(normalizedDigest, group);
  }

  return {
    pagesAnalyzed: seenUrls.size,
    pagesWithFingerprint,
    pagesSkipped,
    duplicateContent: [...fingerprints.values()]
      .filter(({ urls }) => urls.length > 1)
      .map((group) => ({ ...group, urls: [...group.urls] }))
      .sort(
        (left, right) => right.urls.length - left.urls.length || right.wordCount - left.wordCount
      ),
  };
}

/** Summarize directed links whose source and destination are both in a batch. */
export function analyzeSiteWideLinkGraph(batch: SEOAuditBatchReport): SiteWideLinkGraphAnalysis {
  interface GraphNode extends SiteWideLinkGraphPage {
    truncated: boolean;
  }
  interface PageGraphData {
    sourceUrl: string;
    targets: number[];
    truncated: boolean;
  }

  const nodes = new Map<string, GraphNode>();
  const resultIndexToUrl = new Map<number, string>();
  const graphData: PageGraphData[] = [];
  const seenUrls = new Set<string>();
  let pagesWithGraphData = 0;
  let pagesSkipped = 0;

  batch.results.forEach((result, resultIndex) => {
    if (result.status !== 'complete') return;
    const url = normalizeUrl(result.url);
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    nodes.set(url, { url: result.url, inboundLinks: 0, outboundLinks: 0, truncated: false });
    resultIndexToUrl.set(resultIndex, url);

    const check = (result.report.checks.links ?? []).find(
      (item) => item.name === 'link-structure-valid'
    );
    const rawTargets = check?.details?.sitewideLinkTargets;
    if (
      !Array.isArray(rawTargets) ||
      rawTargets.some((target) => !Number.isInteger(target) || (target as number) < 0)
    ) {
      pagesSkipped += 1;
      return;
    }
    const targets = rawTargets as number[];
    const truncated = check?.details?.sitewideLinkTargetsTruncated === true;
    pagesWithGraphData += 1;
    const node = nodes.get(url);
    if (node) node.truncated = truncated;
    graphData.push({ sourceUrl: url, targets, truncated });
  });

  const edges = new Set<string>();
  for (const page of graphData) {
    for (const targetIndex of page.targets) {
      const targetUrl = resultIndexToUrl.get(targetIndex);
      if (!targetUrl || targetUrl === page.sourceUrl) continue;
      const edge = `${page.sourceUrl}\u0000${targetUrl}`;
      if (edges.has(edge)) continue;
      edges.add(edge);
      const source = nodes.get(page.sourceUrl);
      const target = nodes.get(targetUrl);
      if (source) source.outboundLinks += 1;
      if (target) target.inboundLinks += 1;
    }
  }

  const pages = [...nodes.values()];
  return {
    pagesAnalyzed: pages.length,
    pagesWithGraphData,
    pagesSkipped,
    linksAnalyzed: edges.size,
    pagesWithNoInboundLinks: pages.filter((page) => page.inboundLinks === 0).map(({ url }) => url),
    pagesWithNoOutboundLinks: pages
      .filter((page) => page.outboundLinks === 0)
      .map(({ url }) => url),
    truncatedPages: pages.filter(({ truncated }) => truncated).map(({ url }) => url),
    mostLinkedPages: pages
      .filter((page) => page.inboundLinks > 0)
      .sort(
        (left, right) => right.inboundLinks - left.inboundLinks || left.url.localeCompare(right.url)
      )
      .slice(0, 20)
      .map(({ url, inboundLinks, outboundLinks }) => ({ url, inboundLinks, outboundLinks })),
  };
}

/** Find hreflang alternates that do not link back when both pages are in the completed batch. */
export function analyzeSiteWideHreflang(batch: SEOAuditBatchReport): SiteWideHreflangAnalysis {
  interface PageAlternates {
    url: string;
    alternates: Array<{ language: string; url: string }>;
  }

  const seenUrls = new Set<string>();
  const aliasToPage = new Map<string, string>();
  const pages = new Map<string, PageAlternates>();
  let pagesWithAlternates = 0;
  let alternateLinksAnalyzed = 0;

  for (const result of batch.results) {
    if (result.status !== 'complete') continue;
    const requestedUrl = normalizeWebUrl(result.url);
    if (!requestedUrl || aliasToPage.has(requestedUrl)) continue;
    const responseCheck = result.report.checks.technical?.find(
      (item) => item.name === 'response-code-valid'
    );
    const observedUrl = responseCheck?.details?.url;
    const pageUrl =
      typeof observedUrl === 'string'
        ? (normalizeWebUrl(observedUrl, requestedUrl) ?? requestedUrl)
        : requestedUrl;
    if (seenUrls.has(pageUrl)) {
      aliasToPage.set(requestedUrl, pageUrl);
      continue;
    }
    seenUrls.add(pageUrl);
    aliasToPage.set(requestedUrl, pageUrl);
    aliasToPage.set(pageUrl, pageUrl);

    const check = result.report.checks.internationalization?.find(
      (item) => item.name === 'alternate-languages-declared'
    );
    const rawAlternates = check?.details?.alternates;
    if (!Array.isArray(rawAlternates)) continue;

    const alternates: PageAlternates['alternates'] = [];
    for (const value of rawAlternates) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
      const alternate = value as Record<string, unknown>;
      if (typeof alternate.hreflang !== 'string' || typeof alternate.href !== 'string') continue;
      const language = alternate.hreflang.trim().toLowerCase();
      const targetUrl = normalizeWebUrl(alternate.href, pageUrl);
      if (!language || !targetUrl) continue;
      alternates.push({ language, url: targetUrl });
    }

    pages.set(pageUrl, { url: result.url, alternates });
    alternateLinksAnalyzed += alternates.length;
    if (alternates.length > 0) pagesWithAlternates += 1;
  }

  const unscannedTargetUrls = new Set<string>();
  const unavailableTargetUrls = new Set<string>();
  const missingReciprocals = new Map<string, SiteWideHreflangFinding>();
  const returnTargets = new Map<string, Set<string>>();
  for (const [pageUrl, page] of pages) {
    returnTargets.set(
      pageUrl,
      new Set(page.alternates.map((alternate) => aliasToPage.get(alternate.url) ?? alternate.url))
    );
  }
  for (const [sourceKey, source] of pages) {
    for (const alternate of source.alternates) {
      if (alternate.url === sourceKey) continue;
      const targetKey = aliasToPage.get(alternate.url);
      if (!targetKey) {
        unscannedTargetUrls.add(alternate.url);
        continue;
      }
      const target = pages.get(targetKey);
      if (!target) {
        unavailableTargetUrls.add(alternate.url);
        continue;
      }
      if (returnTargets.get(targetKey)?.has(sourceKey)) continue;
      const key = `${sourceKey}\0${targetKey}\0${alternate.language}`;
      missingReciprocals.set(key, {
        sourceUrl: source.url,
        targetUrl: target.url,
        language: alternate.language,
      });
    }
  }

  return {
    pagesAnalyzed: seenUrls.size,
    pagesWithData: pages.size,
    pagesWithAlternates,
    pagesSkipped: seenUrls.size - pages.size,
    alternateLinksAnalyzed,
    unscannedTargetUrls: [...unscannedTargetUrls].sort(),
    unavailableTargetUrls: [...unavailableTargetUrls].sort(),
    missingReciprocals: [...missingReciprocals.values()].sort(
      (left, right) =>
        left.sourceUrl.localeCompare(right.sourceUrl) ||
        left.targetUrl.localeCompare(right.targetUrl) ||
        left.language.localeCompare(right.language)
    ),
  };
}

/** Analyze canonical targets, chains, and loops among completed pages in a batch. */
export function analyzeSiteWideCanonicals(batch: SEOAuditBatchReport): SiteWideCanonicalAnalysis {
  interface CanonicalPage {
    url: string;
    targetUrl: string;
  }

  const seenRequestedUrls = new Set<string>();
  const seenPageUrls = new Set<string>();
  const aliasToPage = new Map<string, string>();
  const pages = new Map<string, CanonicalPage>();
  const canonicalTargets = new Map<string, { targetUrl: string; urls: string[] }>();
  const canonicalTargetByPage = new Map<string, string>();
  let pagesWithData = 0;
  let pagesMissingCanonical = 0;
  let pagesWithMultipleCanonicals = 0;
  let pagesWithInvalidCanonical = 0;
  const multipleCanonicalUrls: string[] = [];
  const invalidCanonicalUrls: string[] = [];

  for (const result of batch.results) {
    if (result.status !== 'complete') continue;
    const requestedUrl = normalizeWebUrl(result.url);
    if (!requestedUrl || seenRequestedUrls.has(requestedUrl)) continue;
    seenRequestedUrls.add(requestedUrl);

    const responseCheck = result.report.checks.technical?.find(
      (item) => item.name === 'response-code-valid'
    );
    const observedUrl = responseCheck?.details?.url;
    const pageUrl =
      typeof observedUrl === 'string'
        ? (normalizeWebUrl(observedUrl, requestedUrl) ?? requestedUrl)
        : requestedUrl;
    aliasToPage.set(requestedUrl, pageUrl);
    aliasToPage.set(pageUrl, pageUrl);
    if (seenPageUrls.has(pageUrl)) continue;
    seenPageUrls.add(pageUrl);

    const check = result.report.checks.metaTags?.find(
      (item) => item.name === 'canonical-url-exists'
    );
    if (!check) continue;
    pagesWithData += 1;

    if (typeof check.details?.canonicalCount === 'number' && check.details.canonicalCount > 1) {
      pagesWithMultipleCanonicals += 1;
      multipleCanonicalUrls.push(result.url);
      continue;
    }
    if (check.details?.canonicalInvalid === true) {
      pagesWithInvalidCanonical += 1;
      invalidCanonicalUrls.push(result.url);
      continue;
    }

    const rawTarget =
      typeof check.details?.canonicalUrl === 'string'
        ? check.details.canonicalUrl
        : typeof check.details?.canonical === 'string'
          ? check.details.canonical
          : undefined;
    if (!rawTarget) {
      pagesMissingCanonical += 1;
      continue;
    }
    const targetUrl = normalizeWebUrl(rawTarget, pageUrl);
    if (!targetUrl) {
      pagesWithInvalidCanonical += 1;
      invalidCanonicalUrls.push(result.url);
      continue;
    }

    pages.set(pageUrl, { url: result.url, targetUrl });
    canonicalTargetByPage.set(pageUrl, targetUrl);
    const group = canonicalTargets.get(targetUrl) ?? { targetUrl, urls: [] };
    group.urls.push(result.url);
    canonicalTargets.set(targetUrl, group);
  }

  const canonicalTargetsOutsideBatch = new Set<string>();
  const canonicalTargetsUnavailable = new Set<string>();
  const edgeByPage = new Map<string, string>();
  for (const [pageUrl, page] of pages) {
    const targetPageUrl = aliasToPage.get(page.targetUrl);
    if (!targetPageUrl) {
      canonicalTargetsOutsideBatch.add(page.targetUrl);
      continue;
    }
    if (!pages.has(targetPageUrl)) {
      canonicalTargetsUnavailable.add(page.targetUrl);
      continue;
    }
    if (targetPageUrl !== pageUrl) edgeByPage.set(pageUrl, targetPageUrl);
  }

  const loopsByKey = new Map<string, string[]>();
  const fullyVisited = new Set<string>();
  for (const startUrl of edgeByPage.keys()) {
    if (fullyVisited.has(startUrl)) continue;
    const path: string[] = [];
    const pathIndexes = new Map<string, number>();
    let currentUrl: string | undefined = startUrl;
    while (currentUrl && edgeByPage.has(currentUrl) && !fullyVisited.has(currentUrl)) {
      const repeatedIndex = pathIndexes.get(currentUrl);
      if (repeatedIndex !== undefined) {
        const loop = path.slice(repeatedIndex);
        const key = [...loop].sort().join('\0');
        loopsByKey.set(
          key,
          loop.map((url) => pages.get(url)?.url ?? url)
        );
        break;
      }
      pathIndexes.set(currentUrl, path.length);
      path.push(currentUrl);
      currentUrl = edgeByPage.get(currentUrl);
    }
    for (const url of path) fullyVisited.add(url);
  }

  const loopPages = new Set([...loopsByKey.keys()].flatMap((key) => key.split('\0')));
  const canonicalChains: SiteWideCanonicalChain[] = [];
  for (const [sourceUrl, firstTargetUrl] of edgeByPage) {
    if (loopPages.has(sourceUrl) || loopPages.has(firstTargetUrl)) continue;
    const visitedChainPages = new Set([sourceUrl]);
    let currentUrl = firstTargetUrl;
    let hasChain = false;
    let entersLoop = false;
    let finalCanonicalUrl = pages.get(firstTargetUrl)?.url ?? firstTargetUrl;
    while (true) {
      if (visitedChainPages.has(currentUrl)) {
        entersLoop = true;
        break;
      }
      visitedChainPages.add(currentUrl);
      const declaredTarget = canonicalTargetByPage.get(currentUrl);
      if (!declaredTarget) break;
      const nextPageUrl = aliasToPage.get(declaredTarget);
      if (nextPageUrl === currentUrl) {
        finalCanonicalUrl = declaredTarget;
        break;
      }
      hasChain = true;
      finalCanonicalUrl = declaredTarget;
      if (!nextPageUrl || !pages.has(nextPageUrl)) break;
      if (loopPages.has(nextPageUrl) || visitedChainPages.has(nextPageUrl)) {
        entersLoop = true;
        break;
      }
      currentUrl = nextPageUrl;
    }
    if (!hasChain || entersLoop) continue;
    const source = pages.get(sourceUrl);
    const target = pages.get(firstTargetUrl);
    if (source && target) {
      canonicalChains.push({
        sourceUrl: source.url,
        canonicalTargetUrl: target.url,
        finalCanonicalUrl,
      });
    }
  }

  return {
    pagesAnalyzed: seenPageUrls.size,
    pagesWithData,
    pagesWithCanonical: pages.size,
    pagesMissingCanonical,
    pagesWithMultipleCanonicals,
    pagesWithInvalidCanonical,
    multipleCanonicalUrls,
    invalidCanonicalUrls,
    pagesSkipped: seenPageUrls.size - pagesWithData,
    duplicateCanonicalTargets: [...canonicalTargets.values()]
      .filter(({ urls }) => urls.length > 1)
      .map(({ targetUrl, urls }) => ({ value: targetUrl, urls: [...urls] }))
      .sort(
        (left, right) =>
          right.urls.length - left.urls.length || left.value.localeCompare(right.value)
      ),
    canonicalTargetsOutsideBatch: [...canonicalTargetsOutsideBatch].sort(),
    canonicalTargetsUnavailable: [...canonicalTargetsUnavailable].sort(),
    canonicalChains: canonicalChains.sort((left, right) =>
      left.sourceUrl.localeCompare(right.sourceUrl)
    ),
    canonicalLoops: [...loopsByKey.values()].sort((left, right) =>
      left.join('\0').localeCompare(right.join('\0'))
    ),
  };
}

/** Summarize observable GEO controls and content signals across completed batch pages. */
export function analyzeSiteWideGeo(batch: SEOAuditBatchReport): SiteWideGeoAnalysis {
  type PageData = { url: string; canonicalUrl?: string; checks: SEOReport['checks']['geo'] };
  const seenUrls = new Set<string>();
  const pages: PageData[] = [];
  for (const result of batch.results) {
    if (result.status !== 'complete') continue;
    const normalized = normalizeUrl(result.url);
    if (seenUrls.has(normalized)) continue;
    seenUrls.add(normalized);
    const canonicalValue = result.report.checks.metaTags?.find(
      ({ name }) => name === 'canonical-url-exists'
    )?.details?.canonicalUrl;
    let canonicalUrl: string | undefined;
    if (typeof canonicalValue === 'string') {
      try {
        const target = new URL(canonicalValue);
        if (['http:', 'https:'].includes(target.protocol) && !target.username && !target.password) {
          target.hash = '';
          canonicalUrl = target.href;
        }
      } catch {
        // Invalid canonical declarations stay out of the summary correlation keys.
      }
    }
    pages.push({
      url: result.url,
      ...(canonicalUrl ? { canonicalUrl } : {}),
      checks: result.report.checks.geo ?? [],
    });
  }

  const getDetails = (page: PageData, rule: string): Record<string, unknown> | undefined => {
    const details = page.checks.find(({ name }) => name === rule)?.details;
    return details && typeof details === 'object' ? details : undefined;
  };
  const asRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const numberField = (
    source: Record<string, unknown> | undefined,
    key: string
  ): number | undefined =>
    typeof source?.[key] === 'number' && Number.isFinite(source[key])
      ? (source[key] as number)
      : undefined;
  const booleanField = (
    source: Record<string, unknown> | undefined,
    key: string
  ): boolean | undefined =>
    typeof source?.[key] === 'boolean' ? (source[key] as boolean) : undefined;
  const stringArrayField = (
    source: Record<string, unknown> | undefined,
    key: string
  ): string[] | undefined =>
    Array.isArray(source?.[key])
      ? (source[key] as unknown[]).filter((value): value is string => typeof value === 'string')
      : undefined;
  const identityEntitiesField = (
    source: Record<string, unknown> | undefined
  ): NonNullable<SiteWideGeoPageSummary['answerContent']>['identityEntities'] => {
    if (!Array.isArray(source?.identityEntities)) return undefined;
    return source.identityEntities.slice(0, 20).flatMap((value) => {
      const entity = asRecord(value);
      if (!entity) return [];
      const types = stringArrayField(entity, 'types') ?? [];
      const allSameAs = stringArrayField(entity, 'sameAs') ?? [];
      const sameAs = allSameAs.slice(0, 10);
      const id = typeof entity.id === 'string' && entity.id.trim() ? entity.id.trim() : undefined;
      const name =
        typeof entity.name === 'string' && entity.name.trim() ? entity.name.trim() : undefined;
      if (types.length === 0 && !id && !name && sameAs.length === 0) return [];
      return [
        {
          types,
          ...(id ? { id } : {}),
          ...(name ? { name } : {}),
          sameAs,
          sameAsTruncated: entity.sameAsTruncated === true || allSameAs.length > 10,
        },
      ];
    });
  };
  const crawlerRows = (
    details: Record<string, unknown> | undefined
  ): SiteWideGeoPageCrawlerAccess[] | undefined => {
    if (!Array.isArray(details?.crawlers)) return undefined;
    return details.crawlers.flatMap((value) => {
      const crawler = asRecord(value);
      if (typeof crawler?.token !== 'string' || typeof crawler.allowed !== 'boolean') return [];
      const rule = asRecord(crawler.matchedRule);
      const directive = rule?.directive;
      const matchedRule: SiteWideGeoPageCrawlerAccess['matchedRule'] =
        rule &&
        (directive === 'allow' || directive === 'disallow') &&
        typeof rule.pattern === 'string' &&
        Number.isInteger(rule.line)
          ? { directive, pattern: rule.pattern, line: rule.line as number }
          : undefined;
      return [
        {
          token: crawler.token,
          allowed: crawler.allowed,
          ...(stringArrayField(crawler, 'matchedAgents')
            ? { matchedAgents: stringArrayField(crawler, 'matchedAgents') }
            : {}),
          ...(matchedRule ? { matchedRule } : {}),
        },
      ];
    });
  };
  const pageSummaries: SiteWideGeoPageSummary[] = pages.map((page) => {
    const search = getDetails(page, 'ai-search-crawler-access');
    const dataUse = getDetails(page, 'ai-data-use-crawler-policy');
    const userFetch = getDetails(page, 'ai-user-initiated-fetch-access');
    const preview = getDetails(page, 'ai-search-preview-controls');
    const answer = getDetails(page, 'answer-content-profile');
    const sourceRendered = getDetails(page, 'source-rendered-content-profile');
    const evidence = getDetails(page, 'citation-evidence-profile');
    const llms = getDetails(page, 'llms-txt-convention-inventory');
    const hasResult = (rule: string): boolean => page.checks.some(({ name }) => name === rule);
    const crawlerControls = Array.isArray(preview?.crawlerControls)
      ? preview.crawlerControls.flatMap((value) => {
          const control = asRecord(value);
          if (
            typeof control?.token !== 'string' ||
            typeof control.noindex !== 'boolean' ||
            typeof control.noSnippet !== 'boolean' ||
            typeof control.maxSnippetZero !== 'boolean'
          )
            return [];
          return [
            {
              token: control.token,
              noindex: control.noindex,
              noSnippet: control.noSnippet,
              maxSnippetZero: control.maxSnippetZero,
            },
          ];
        })
      : undefined;
    const dataUseCrawlerControls = Array.isArray(preview?.dataUseCrawlerControls)
      ? preview.dataUseCrawlerControls.flatMap((value) => {
          const control = asRecord(value);
          if (
            typeof control?.token !== 'string' ||
            typeof control.noArchive !== 'boolean' ||
            (control.noindex !== undefined && typeof control.noindex !== 'boolean')
          )
            return [];
          return [
            {
              token: control.token,
              noArchive: control.noArchive,
              ...(typeof control.noindex === 'boolean' ? { noindex: control.noindex } : {}),
            },
          ];
        })
      : undefined;
    const resources = Array.isArray(llms?.resources)
      ? llms.resources.flatMap((value) => {
          const resource = asRecord(value);
          if (typeof resource?.path !== 'string') return [];
          const state =
            resource.found === true
              ? ('found' as const)
              : resource.status === 404 || resource.status === 410
                ? ('absent' as const)
                : resource.robotsAllowed === false
                  ? ('unassessed' as const)
                  : ('unconfirmed' as const);
          const rawLinkProfile = asRecord(resource.linkTargetProfile);
          const profileKeys: (keyof SiteWideGeoLlmsLinkTargetProfile)[] = [
            'markdownLinks',
            'uniqueWebTargets',
            'duplicateWebTargets',
            'sameOriginWebLinks',
            'externalHttpsLinks',
            'externalHttpLinks',
            'relativeLinks',
            'unsupportedSchemeLinks',
            'invalidTargets',
            'emptyLabels',
            'malformedLinkCandidates',
          ];
          const linkTargetProfile =
            rawLinkProfile &&
            profileKeys.every(
              (key) =>
                typeof rawLinkProfile[key] === 'number' &&
                Number.isSafeInteger(rawLinkProfile[key]) &&
                (rawLinkProfile[key] as number) >= 0
            )
              ? (Object.fromEntries(
                  profileKeys.map((key) => [key, rawLinkProfile[key]])
                ) as unknown as SiteWideGeoLlmsLinkTargetProfile)
              : undefined;
          return [
            {
              path: resource.path,
              state,
              ...(numberField(resource, 'status') !== undefined
                ? { status: numberField(resource, 'status') }
                : {}),
              ...(typeof resource.truncated === 'boolean'
                ? { contentTruncated: resource.truncated }
                : {}),
              ...(linkTargetProfile ? { linkTargetProfile } : {}),
            },
          ];
        })
      : Array.isArray(llms?.paths)
        ? llms.paths
            .filter((value): value is string => typeof value === 'string')
            .map((filePath) => ({ path: filePath, state: 'unassessed' as const }))
        : undefined;
    const searchCrawlerAccess = crawlerRows(search);
    const dataUseCrawlerPolicy = crawlerRows(dataUse);
    const userInitiatedFetchAccess = crawlerRows(userFetch);
    const sourceRenderedAssessed = booleanField(sourceRendered, 'assessed') === true;
    const signalCoverage: SiteWideGeoPageSignalCoverage = {
      searchCrawlerAccess: !hasResult('ai-search-crawler-access')
        ? 'not-run'
        : crawlerRows(search)
          ? 'measured'
          : 'not-assessed',
      dataUseCrawlerPolicy: !hasResult('ai-data-use-crawler-policy')
        ? 'not-run'
        : crawlerRows(dataUse)
          ? 'measured'
          : 'not-assessed',
      ...(hasResult('ai-user-initiated-fetch-access')
        ? { userInitiatedFetchAccess: userInitiatedFetchAccess ? 'measured' : 'not-assessed' }
        : {}),
      previewControls: !hasResult('ai-search-preview-controls')
        ? 'not-run'
        : typeof preview?.noindex === 'boolean'
          ? 'measured'
          : 'not-assessed',
      answerContent: !hasResult('answer-content-profile')
        ? 'not-run'
        : numberField(answer, 'contentWords') !== undefined
          ? 'measured'
          : 'not-assessed',
      sourceRenderedContent: !hasResult('source-rendered-content-profile')
        ? 'not-run'
        : sourceRenderedAssessed
          ? 'measured'
          : 'not-assessed',
      citationEvidence: !hasResult('citation-evidence-profile')
        ? 'not-run'
        : numberField(evidence, 'externalSourceLinkCount') !== undefined
          ? 'measured'
          : 'not-assessed',
      optionalLlmsFiles: !hasResult('llms-txt-convention-inventory')
        ? 'not-run'
        : Array.isArray(llms?.resources)
          ? 'measured'
          : 'not-assessed',
    };
    const signalNotes: Partial<Record<keyof SiteWideGeoPageSignalCoverage, string>> = {};
    for (const [signal, details] of [
      ['searchCrawlerAccess', search],
      ['dataUseCrawlerPolicy', dataUse],
      ['userInitiatedFetchAccess', userFetch],
      ['previewControls', preview],
      ['answerContent', answer],
      ['sourceRenderedContent', sourceRendered],
      ['citationEvidence', evidence],
      ['optionalLlmsFiles', llms],
    ] as const) {
      if (signalCoverage[signal] === 'not-assessed' && typeof details?.reason === 'string') {
        signalNotes[signal] = details.reason;
      }
    }
    const sourcePhraseTruncated =
      booleanField(sourceRendered, 'sourcePhraseSampleTruncated') === true ||
      booleanField(sourceRendered, 'sourceTextSampleTruncated') === true;
    const renderedPhraseTruncated =
      booleanField(sourceRendered, 'renderedPhraseSampleTruncated') === true ||
      booleanField(sourceRendered, 'renderedTextSampleTruncated') === true;
    return {
      url: page.url,
      ...(page.canonicalUrl ? { canonicalUrl: page.canonicalUrl } : {}),
      geoAssessed: page.checks.length > 0,
      signalCoverage,
      ...(Object.keys(signalNotes).length > 0 ? { signalNotes } : {}),
      ...(searchCrawlerAccess ? { searchCrawlerAccess } : {}),
      ...(dataUseCrawlerPolicy ? { dataUseCrawlerPolicy } : {}),
      ...(userInitiatedFetchAccess ? { userInitiatedFetchAccess } : {}),
      ...(preview
        ? {
            previewControls: {
              responseStatus: numberField(preview, 'responseStatus'),
              noindex: booleanField(preview, 'noindex'),
              noSnippet: booleanField(preview, 'noSnippet'),
              maxSnippetZero: booleanField(preview, 'maxSnippetZero'),
              dataNoSnippetElements: numberField(preview, 'dataNoSnippetElements'),
              dataNoSnippetWords: numberField(preview, 'dataNoSnippetWords'),
              dataNoSnippetWordSharePercent:
                typeof preview.dataNoSnippetWordSharePercent === 'number' ||
                preview.dataNoSnippetWordSharePercent === null
                  ? (preview.dataNoSnippetWordSharePercent as number | null)
                  : undefined,
              visibleTextWords: numberField(preview, 'visibleTextWords'),
              ...(crawlerControls ? { crawlerControls } : {}),
              ...(dataUseCrawlerControls ? { dataUseCrawlerControls } : {}),
            },
          }
        : {}),
      ...(answer
        ? {
            answerContent: {
              contentWords: numberField(answer, 'contentWords'),
              mainOrArticleRegion: booleanField(answer, 'mainOrArticleRegion'),
              headingCount: numberField(answer, 'headingCount'),
              questionHeadings: numberField(answer, 'questionHeadings'),
              conciseAnswerBlocks: numberField(answer, 'conciseAnswerBlocks'),
              listCount: numberField(answer, 'listCount'),
              tableCount: numberField(answer, 'tableCount'),
              externalContentLinks: numberField(answer, 'externalContentLinks'),
              visibleAuthor: booleanField(answer, 'visibleAuthor'),
              visibleDate: booleanField(answer, 'visibleDate'),
              schemaAuthor: booleanField(answer, 'schemaAuthor'),
              schemaDate: booleanField(answer, 'schemaDate'),
              schemaDateModifiedDays: stringArrayField(answer, 'schemaDateModifiedDays')?.slice(
                0,
                10
              ),
              schemaDateModifiedDaysTruncated:
                booleanField(answer, 'schemaDateModifiedDaysTruncated') === true ||
                (Array.isArray(answer?.schemaDateModifiedDays) &&
                  answer.schemaDateModifiedDays.length > 10),
              schemaDateModifiedHasNonDateValue: booleanField(
                answer,
                'schemaDateModifiedHasNonDateValue'
              ),
              schemaIsAccessibleForFree:
                answer?.schemaIsAccessibleForFree === true ||
                answer?.schemaIsAccessibleForFree === false ||
                answer?.schemaIsAccessibleForFree === 'mixed' ||
                answer?.schemaIsAccessibleForFree === 'not-declared'
                  ? answer.schemaIsAccessibleForFree
                  : undefined,
              schemaHasNonBooleanAccessibleForFreeValue: booleanField(
                answer,
                'schemaHasNonBooleanAccessibleForFreeValue'
              ),
              jsonLdTypes: stringArrayField(answer, 'jsonLdTypes'),
              jsonLdTypeListTruncated: booleanField(answer, 'jsonLdTypeListTruncated'),
              identityEntities: identityEntitiesField(answer),
              identityEntityListTruncated:
                booleanField(answer, 'identityEntityListTruncated') === true ||
                (Array.isArray(answer?.identityEntities) && answer.identityEntities.length > 20),
              documentLanguage:
                typeof answer.documentLanguage === 'string'
                  ? answer.documentLanguage.trim().slice(0, 80) || undefined
                  : undefined,
              documentLanguageValid:
                typeof answer.documentLanguageValid === 'boolean'
                  ? answer.documentLanguageValid
                  : undefined,
            },
          }
        : {}),
      ...(sourceRendered
        ? {
            sourceRenderedContent: {
              assessed: sourceRenderedAssessed,
              ...(typeof sourceRendered.textExtraction === 'string'
                ? { textExtraction: sourceRendered.textExtraction }
                : {}),
              ...(typeof sourceRendered.reason === 'string'
                ? { reason: sourceRendered.reason }
                : {}),
              ...(typeof sourceRendered.renderedPhraseCoveragePercent === 'number' ||
              sourceRendered.renderedPhraseCoveragePercent === null
                ? {
                    renderedPhraseCoveragePercent: sourceRendered.renderedPhraseCoveragePercent as
                      number | null,
                  }
                : {}),
              sourceWordCount: numberField(sourceRendered, 'sourceWordCount'),
              renderedWordCount: numberField(sourceRendered, 'renderedWordCount'),
              sourcePhraseCount: numberField(sourceRendered, 'sourcePhraseCount'),
              renderedPhraseCount: numberField(sourceRendered, 'renderedPhraseCount'),
              sharedRenderedPhraseCount: numberField(sourceRendered, 'sharedRenderedPhraseCount'),
              renderedOnlyPhraseCount: numberField(sourceRendered, 'renderedOnlyPhraseCount'),
              sampleTruncated: sourcePhraseTruncated || renderedPhraseTruncated,
            },
          }
        : {}),
      ...(evidence
        ? {
            citationEvidence: {
              externalSourceLinkCount: numberField(evidence, 'externalSourceLinkCount'),
              uniqueSourceHosts: numberField(evidence, 'uniqueSourceHosts'),
              descriptiveSourceLinkCount: numberField(evidence, 'descriptiveSourceLinkCount'),
              sourceHosts: stringArrayField(evidence, 'sourceHosts'),
              sourceHostListTruncated: booleanField(evidence, 'sourceHostListTruncated'),
              sourceHostLinkCounts: Array.isArray(evidence.sourceHostLinkCounts)
                ? evidence.sourceHostLinkCounts.slice(0, 12).flatMap((value) => {
                    const row = asRecord(value);
                    if (
                      typeof row?.host !== 'string' ||
                      typeof row.links !== 'number' ||
                      !Number.isSafeInteger(row.links) ||
                      row.links < 0
                    )
                      return [];
                    return [{ host: row.host, links: row.links }];
                  })
                : undefined,
              sourceHostLinkCountsTruncated: booleanField(
                evidence,
                'sourceHostLinkCountsTruncated'
              ),
              topSourceHostLinkSharePercent:
                typeof evidence.topSourceHostLinkSharePercent === 'number' &&
                Number.isFinite(evidence.topSourceHostLinkSharePercent)
                  ? evidence.topSourceHostLinkSharePercent
                  : evidence.topSourceHostLinkSharePercent === null
                    ? null
                    : undefined,
              referenceSectionCount: numberField(evidence, 'referenceSectionCount'),
              referenceSectionLinkCount: numberField(evidence, 'referenceSectionLinkCount'),
              inlineCitationMarkerCount: numberField(evidence, 'inlineCitationMarkerCount'),
              resolvedInlineCitationTargetsWithExternalLinks: numberField(
                evidence,
                'resolvedInlineCitationTargetsWithExternalLinks'
              ),
              resolvedInlineCitationTargetsWithoutExternalLinks: numberField(
                evidence,
                'resolvedInlineCitationTargetsWithoutExternalLinks'
              ),
              unresolvedInlineCitationTargetCount: numberField(
                evidence,
                'unresolvedInlineCitationTargetCount'
              ),
              unresolvedInlineCitationTargets: stringArrayField(
                evidence,
                'unresolvedInlineCitationTargets'
              ),
              unresolvedInlineCitationTargetsTruncated: booleanField(
                evidence,
                'unresolvedInlineCitationTargetsTruncated'
              ),
              jsonLdBlocksWithCitationField: numberField(evidence, 'jsonLdBlocksWithCitationField'),
            },
          }
        : {}),
      ...(resources ? { optionalLlmsFiles: resources } : {}),
    };
  });
  const crawlerCoverage = (rule: string): SiteWideGeoCrawlerCoverage[] => {
    const bots = new Map<
      string,
      { assessedPages: number; allowedPages: number; blockedPages: number; blockedUrls: string[] }
    >();
    for (const page of pages) {
      const rawBots = getDetails(page, rule)?.crawlers;
      if (!Array.isArray(rawBots)) continue;
      for (const rawBot of rawBots) {
        if (!rawBot || typeof rawBot !== 'object') continue;
        const bot = rawBot as Record<string, unknown>;
        if (typeof bot.token !== 'string' || typeof bot.allowed !== 'boolean') continue;
        const totals = bots.get(bot.token) ?? {
          assessedPages: 0,
          allowedPages: 0,
          blockedPages: 0,
          blockedUrls: [],
        };
        totals.assessedPages += 1;
        if (bot.allowed) totals.allowedPages += 1;
        else {
          totals.blockedPages += 1;
          totals.blockedUrls.push(page.url);
        }
        bots.set(bot.token, totals);
      }
    }
    return [...bots.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([token, totals]) => ({
        token,
        ...totals,
        unassessedPages: Math.max(0, pages.length - totals.assessedPages),
      }));
  };
  const dataUseNoArchiveCoverage = (() => {
    const tokens = new Map<string, { pagesAssessed: number; pagesWithNoArchive: number }>();
    for (const page of pageSummaries) {
      for (const control of page.previewControls?.dataUseCrawlerControls ?? []) {
        const totals = tokens.get(control.token) ?? { pagesAssessed: 0, pagesWithNoArchive: 0 };
        totals.pagesAssessed += 1;
        if (control.noArchive) totals.pagesWithNoArchive += 1;
        tokens.set(control.token, totals);
      }
    }
    return [...tokens.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([token, totals]) => ({
        token,
        ...totals,
        pagesUnassessed: Math.max(0, pageSummaries.length - totals.pagesAssessed),
      }));
  })();

  let pagesWithGeoData = 0;
  let pagesWithNoindex = 0;
  let pagesWithNoSnippet = 0;
  let pagesWithDataNoSnippetRegions = 0;
  let totalDataNoSnippetElements = 0;
  let totalDataNoSnippetWords = 0;
  let dataNoSnippetWordShareSum = 0;
  let dataNoSnippetWordShareSamples = 0;
  const pagesWithNoindexUrls: string[] = [];
  const pagesWithNoSnippetUrls: string[] = [];
  const pagesWithDataNoSnippetRegionUrls: string[] = [];
  let pagesWithExternalSources = 0;
  let totalExternalSourceLinks = 0;
  let pagesWithTruncatedSourceHostLists = 0;
  let pagesWithTruncatedSourceHostLinkCounts = 0;
  let pagesWithCitationMarkersOrReferences = 0;
  let totalResolvedInlineCitationTargetsWithExternalLinks = 0;
  let totalResolvedInlineCitationTargetsWithoutExternalLinks = 0;
  let pagesWithUnresolvedInlineCitationTargets = 0;
  let totalUnresolvedInlineCitationTargets = 0;
  const unresolvedInlineCitationTargetUrls: string[] = [];
  const contentProfile: SiteWideGeoContentProfile = {
    pagesAssessed: 0,
    pagesWithMainOrArticleRegion: 0,
    sourceRenderedProfilesAssessed: 0,
    sourceRenderedPhraseCoverageSamples: 0,
    sourceRenderedPhraseCoverageMeanPercent: null,
    sourceRenderedPhraseCoverageWithoutUsableSample: 0,
    sourceRenderedPhraseCoverageBands: [
      { band: '0-19.9%', pages: 0 },
      { band: '20-39.9%', pages: 0 },
      { band: '40-59.9%', pages: 0 },
      { band: '60-79.9%', pages: 0 },
      { band: '80-100%', pages: 0 },
    ],
    authorSignalCrossTab: {
      sampledPages: 0,
      visibleAndSchema: 0,
      visibleOnly: 0,
      schemaOnly: 0,
      neither: 0,
      incompleteProfiles: 0,
    },
    dateSignalCrossTab: {
      sampledPages: 0,
      visibleAndSchema: 0,
      visibleOnly: 0,
      schemaOnly: 0,
      neither: 0,
      incompleteProfiles: 0,
    },
    pagesWithQuestionHeadings: 0,
    totalQuestionHeadings: 0,
    totalConciseAnswerBlocks: 0,
    pagesWithVisibleAuthor: 0,
    pagesWithVisibleDate: 0,
    pagesWithSchemaAuthor: 0,
    pagesWithSchemaDate: 0,
    pagesWithFreeAccessSchemaDeclaration: 0,
    pagesWithPaywalledSchemaDeclaration: 0,
    pagesWithConflictingFreeAccessSchemaDeclarations: 0,
    pagesWithoutFreeAccessSchemaDeclaration: 0,
    pagesWithNonBooleanFreeAccessSchemaValue: 0,
    pagesWithTruncatedJsonLdTypeLists: 0,
    schemaTypeCoverage: [],
  };
  let sourceRenderedPhraseCoverageSum = 0;
  const schemaTypePages = new Map<string, Set<string>>();
  const entitiesById = new Map<
    string,
    {
      types: Set<string>;
      names: Map<string, string>;
      pages: Set<string>;
      pageTypes: Map<string, Set<string>>;
      pageSameAs: Map<string, { urls: Set<string>; incomplete: boolean }>;
    }
  >();
  const pagesWithIdentityEntities = new Set<string>();
  const pagesWithTruncatedEntityLists = new Set<string>();
  const pagesWithTruncatedSameAsLists = new Set<string>();
  const pagesWithSameAsReferences = new Set<string>();
  const sameAsHostPages = new Map<string, Set<string>>();
  let totalSameAsReferences = 0;
  const llmsFiles = new Map<string, SiteWideGeoFileCoverage>(
    OPTIONAL_GEO_FILE_PATHS.map((path) => [
      path,
      {
        path,
        pagesFound: 0,
        pagesAbsent: 0,
        pagesUnconfirmed: 0,
        pagesUnassessed: 0,
        linkTargetTotals: {
          profilesMeasured: 0,
          truncatedProfiles: 0,
          markdownLinks: 0,
          uniqueWebTargets: 0,
          duplicateWebTargets: 0,
          sameOriginWebLinks: 0,
          externalHttpsLinks: 0,
          externalHttpLinks: 0,
          relativeLinks: 0,
          unsupportedSchemeLinks: 0,
          invalidTargets: 0,
          emptyLabels: 0,
          malformedLinkCandidates: 0,
          pagesWithDuplicateWebTargets: 0,
          pagesWithUnsupportedSchemeLinks: 0,
          pagesWithMalformedLinkCandidates: 0,
        },
      },
    ])
  );
  const sourceHostPages = new Map<string, Set<string>>();
  const sourceHostObservedLinks = new Map<string, number>();

  for (const page of pages) {
    if (page.checks.length > 0) pagesWithGeoData += 1;
    const preview = getDetails(page, 'ai-search-preview-controls');
    if (preview?.noindex === true) {
      pagesWithNoindex += 1;
      pagesWithNoindexUrls.push(page.url);
    }
    if (preview?.noSnippet === true) {
      pagesWithNoSnippet += 1;
      pagesWithNoSnippetUrls.push(page.url);
    }
    if (typeof preview?.dataNoSnippetElements === 'number' && preview.dataNoSnippetElements > 0) {
      pagesWithDataNoSnippetRegions += 1;
      pagesWithDataNoSnippetRegionUrls.push(page.url);
      totalDataNoSnippetElements += preview.dataNoSnippetElements;
    }
    if (
      typeof preview?.dataNoSnippetWords === 'number' &&
      Number.isFinite(preview.dataNoSnippetWords)
    ) {
      totalDataNoSnippetWords += preview.dataNoSnippetWords;
    }
    if (
      typeof preview?.dataNoSnippetWordSharePercent === 'number' &&
      Number.isFinite(preview.dataNoSnippetWordSharePercent)
    ) {
      dataNoSnippetWordShareSum += preview.dataNoSnippetWordSharePercent;
      dataNoSnippetWordShareSamples += 1;
    }

    const answerProfile = getDetails(page, 'answer-content-profile');
    if (answerProfile) {
      contentProfile.pagesAssessed += 1;
      if (answerProfile.mainOrArticleRegion === true)
        contentProfile.pagesWithMainOrArticleRegion += 1;
      if (
        typeof answerProfile.questionHeadings === 'number' &&
        Number.isFinite(answerProfile.questionHeadings)
      ) {
        contentProfile.totalQuestionHeadings += answerProfile.questionHeadings;
        if (answerProfile.questionHeadings > 0) contentProfile.pagesWithQuestionHeadings += 1;
      }
      if (
        typeof answerProfile.conciseAnswerBlocks === 'number' &&
        Number.isFinite(answerProfile.conciseAnswerBlocks)
      ) {
        contentProfile.totalConciseAnswerBlocks += answerProfile.conciseAnswerBlocks;
      }
      if (answerProfile.visibleAuthor === true) contentProfile.pagesWithVisibleAuthor += 1;
      if (answerProfile.visibleDate === true) contentProfile.pagesWithVisibleDate += 1;
      if (answerProfile.schemaAuthor === true) contentProfile.pagesWithSchemaAuthor += 1;
      if (answerProfile.schemaDate === true) contentProfile.pagesWithSchemaDate += 1;
      if (answerProfile.schemaIsAccessibleForFree === true)
        contentProfile.pagesWithFreeAccessSchemaDeclaration += 1;
      if (answerProfile.schemaIsAccessibleForFree === false)
        contentProfile.pagesWithPaywalledSchemaDeclaration += 1;
      if (answerProfile.schemaIsAccessibleForFree === 'mixed')
        contentProfile.pagesWithConflictingFreeAccessSchemaDeclarations += 1;
      if (answerProfile.schemaIsAccessibleForFree === 'not-declared')
        contentProfile.pagesWithoutFreeAccessSchemaDeclaration += 1;
      if (answerProfile.schemaHasNonBooleanAccessibleForFreeValue === true)
        contentProfile.pagesWithNonBooleanFreeAccessSchemaValue += 1;
      addSiteWideGeoSignalCrossTab(
        contentProfile.authorSignalCrossTab,
        answerProfile.visibleAuthor,
        answerProfile.schemaAuthor
      );
      addSiteWideGeoSignalCrossTab(
        contentProfile.dateSignalCrossTab,
        answerProfile.visibleDate,
        answerProfile.schemaDate
      );
      if (answerProfile.jsonLdTypeListTruncated === true)
        contentProfile.pagesWithTruncatedJsonLdTypeLists += 1;
      if (answerProfile.identityEntityListTruncated === true)
        pagesWithTruncatedEntityLists.add(normalizeUrl(page.url));
      if (Array.isArray(answerProfile.identityEntities)) {
        const pageUrl = normalizeUrl(page.url);
        const identityInventoryUncertain =
          answerProfile.identityEntityListTruncated === true ||
          (typeof answerProfile.identityEntityListTruncated !== 'boolean' &&
            answerProfile.identityEntities.length >= 20);
        if (answerProfile.identityEntities.length > 0) pagesWithIdentityEntities.add(pageUrl);
        for (const rawEntity of answerProfile.identityEntities) {
          if (!rawEntity || typeof rawEntity !== 'object') continue;
          const entity = rawEntity as Record<string, unknown>;
          if (entity.sameAsTruncated === true) pagesWithTruncatedSameAsLists.add(pageUrl);
          if (Array.isArray(entity.sameAs)) {
            const sameAs = entity.sameAs.filter((url): url is string => typeof url === 'string');
            if (sameAs.length > 0) pagesWithSameAsReferences.add(pageUrl);
            totalSameAsReferences += sameAs.length;
            for (const value of sameAs) {
              let host: string;
              try {
                const url = new URL(value);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
                host = url.hostname.toLowerCase();
              } catch {
                continue;
              }
              const pageSet = sameAsHostPages.get(host) ?? new Set<string>();
              pageSet.add(pageUrl);
              sameAsHostPages.set(host, pageSet);
            }
          }
          if (typeof entity.id !== 'string' || !entity.id.trim()) continue;
          const id = normalizeSchemaEntityId(entity.id, page.url);
          const record = entitiesById.get(id) ?? {
            types: new Set<string>(),
            names: new Map<string, string>(),
            pages: new Set<string>(),
            pageTypes: new Map<string, Set<string>>(),
            pageSameAs: new Map<string, { urls: Set<string>; incomplete: boolean }>(),
          };
          record.pages.add(pageUrl);
          const pageTypes = record.pageTypes.get(pageUrl) ?? new Set<string>();
          if (Array.isArray(entity.types)) {
            for (const type of entity.types) {
              if (typeof type !== 'string' || !type.trim()) continue;
              record.types.add(type);
              const normalizedType = type
                .split(/[\/#:]/)
                .pop()
                ?.trim()
                .toLowerCase();
              if (normalizedType) pageTypes.add(normalizedType);
            }
          }
          record.pageTypes.set(pageUrl, pageTypes);
          const pageSameAs = record.pageSameAs.get(pageUrl) ?? {
            urls: new Set<string>(),
            incomplete: false,
          };
          if (Array.isArray(entity.sameAs)) {
            for (const value of entity.sameAs) {
              if (typeof value === 'string' && value.trim()) pageSameAs.urls.add(value.trim());
            }
          }
          const sameAsInventoryUncertain =
            entity.sameAsTruncated === true ||
            (typeof entity.sameAsTruncated !== 'boolean' &&
              Array.isArray(entity.sameAs) &&
              entity.sameAs.length >= 10);
          pageSameAs.incomplete ||= sameAsInventoryUncertain || identityInventoryUncertain;
          record.pageSameAs.set(pageUrl, pageSameAs);
          if (typeof entity.name === 'string' && entity.name.trim())
            record.names.set(normalizeMetadata(entity.name), entity.name.trim());
          entitiesById.set(id, record);
        }
      }
      if (Array.isArray(answerProfile.jsonLdTypes)) {
        for (const type of answerProfile.jsonLdTypes) {
          if (typeof type !== 'string' || !type.trim()) continue;
          const pageSet = schemaTypePages.get(type) ?? new Set<string>();
          pageSet.add(normalizeUrl(page.url));
          schemaTypePages.set(type, pageSet);
        }
      }
    }

    const sourceRenderedProfile = getDetails(page, 'source-rendered-content-profile');
    if (sourceRenderedProfile?.assessed === true) {
      contentProfile.sourceRenderedProfilesAssessed += 1;
      const coverage = sourceRenderedProfile.renderedPhraseCoveragePercent;
      if (
        typeof coverage === 'number' &&
        Number.isFinite(coverage) &&
        coverage >= 0 &&
        coverage <= 100
      ) {
        contentProfile.sourceRenderedPhraseCoverageSamples += 1;
        sourceRenderedPhraseCoverageSum += coverage;
        const bandIndex =
          coverage < 20 ? 0 : coverage < 40 ? 1 : coverage < 60 ? 2 : coverage < 80 ? 3 : 4;
        const band = contentProfile.sourceRenderedPhraseCoverageBands[bandIndex];
        if (band) band.pages += 1;
      } else {
        contentProfile.sourceRenderedPhraseCoverageWithoutUsableSample += 1;
      }
    }

    const evidence = getDetails(page, 'citation-evidence-profile');
    const externalLinks = evidence?.externalSourceLinkCount;
    if (typeof externalLinks === 'number' && Number.isFinite(externalLinks) && externalLinks > 0) {
      pagesWithExternalSources += 1;
      totalExternalSourceLinks += externalLinks;
    }
    if (evidence?.sourceHostListTruncated === true) pagesWithTruncatedSourceHostLists += 1;
    if (evidence?.sourceHostLinkCountsTruncated === true)
      pagesWithTruncatedSourceHostLinkCounts += 1;
    if (
      typeof evidence?.unresolvedInlineCitationTargetCount === 'number' &&
      Number.isFinite(evidence.unresolvedInlineCitationTargetCount) &&
      evidence.unresolvedInlineCitationTargetCount > 0
    ) {
      pagesWithUnresolvedInlineCitationTargets += 1;
      totalUnresolvedInlineCitationTargets += evidence.unresolvedInlineCitationTargetCount;
      unresolvedInlineCitationTargetUrls.push(page.url);
    }
    const hosts = evidence?.sourceHosts;
    if (Array.isArray(hosts)) {
      for (const host of hosts) {
        if (typeof host !== 'string' || !host) continue;
        const pageSet = sourceHostPages.get(host) ?? new Set<string>();
        pageSet.add(normalizeUrl(page.url));
        sourceHostPages.set(host, pageSet);
      }
    }
    if (Array.isArray(evidence?.sourceHostLinkCounts)) {
      for (const value of evidence.sourceHostLinkCounts) {
        const row = asRecord(value);
        if (
          typeof row?.host !== 'string' ||
          typeof row.links !== 'number' ||
          !Number.isSafeInteger(row.links) ||
          row.links < 0
        )
          continue;
        sourceHostObservedLinks.set(
          row.host,
          (sourceHostObservedLinks.get(row.host) ?? 0) + row.links
        );
      }
    }
    if (
      (typeof evidence?.inlineCitationMarkerCount === 'number' &&
        evidence.inlineCitationMarkerCount > 0) ||
      (typeof evidence?.referenceSectionLinkCount === 'number' &&
        evidence.referenceSectionLinkCount > 0) ||
      (typeof evidence?.jsonLdBlocksWithCitationField === 'number' &&
        evidence.jsonLdBlocksWithCitationField > 0)
    ) {
      pagesWithCitationMarkersOrReferences += 1;
    }
    if (
      typeof evidence?.resolvedInlineCitationTargetsWithExternalLinks === 'number' &&
      Number.isFinite(evidence.resolvedInlineCitationTargetsWithExternalLinks)
    ) {
      totalResolvedInlineCitationTargetsWithExternalLinks +=
        evidence.resolvedInlineCitationTargetsWithExternalLinks;
    }
    if (
      typeof evidence?.resolvedInlineCitationTargetsWithoutExternalLinks === 'number' &&
      Number.isFinite(evidence.resolvedInlineCitationTargetsWithoutExternalLinks)
    ) {
      totalResolvedInlineCitationTargetsWithoutExternalLinks +=
        evidence.resolvedInlineCitationTargetsWithoutExternalLinks;
    }

    const llmsCheck = page.checks.find(({ name }) => name === 'llms-txt-convention-inventory');
    const resources = llmsCheck?.details?.resources;
    for (const [path, totals] of llmsFiles) {
      if (!llmsCheck) {
        totals.pagesUnassessed += 1;
        continue;
      }
      if (!Array.isArray(resources)) {
        totals.pagesUnassessed += 1;
        continue;
      }
      const resource = resources.find(
        (item) =>
          item && typeof item === 'object' && (item as Record<string, unknown>).path === path
      );
      if (!resource || typeof resource !== 'object') {
        totals.pagesUnconfirmed += 1;
        continue;
      }
      const file = resource as Record<string, unknown>;
      if (file.found === true) totals.pagesFound += 1;
      else if (file.status === 404 || file.status === 410) totals.pagesAbsent += 1;
      else if (file.robotsAllowed === false) totals.pagesUnassessed += 1;
      else totals.pagesUnconfirmed += 1;
      const rawProfile = asRecord(file.linkTargetProfile);
      const profile =
        rawProfile &&
        [
          'markdownLinks',
          'uniqueWebTargets',
          'duplicateWebTargets',
          'sameOriginWebLinks',
          'externalHttpsLinks',
          'externalHttpLinks',
          'relativeLinks',
          'unsupportedSchemeLinks',
          'invalidTargets',
          'emptyLabels',
          'malformedLinkCandidates',
        ].every(
          (key) =>
            typeof rawProfile[key] === 'number' &&
            Number.isSafeInteger(rawProfile[key]) &&
            (rawProfile[key] as number) >= 0
        )
          ? (rawProfile as unknown as SiteWideGeoLlmsLinkTargetProfile)
          : undefined;
      if (profile && totals.linkTargetTotals) {
        const aggregate = totals.linkTargetTotals;
        aggregate.profilesMeasured += 1;
        if (file.truncated === true) aggregate.truncatedProfiles += 1;
        aggregate.markdownLinks += profile.markdownLinks;
        aggregate.uniqueWebTargets += profile.uniqueWebTargets;
        aggregate.duplicateWebTargets += profile.duplicateWebTargets;
        aggregate.sameOriginWebLinks += profile.sameOriginWebLinks;
        aggregate.externalHttpsLinks += profile.externalHttpsLinks;
        aggregate.externalHttpLinks += profile.externalHttpLinks;
        aggregate.relativeLinks += profile.relativeLinks;
        aggregate.unsupportedSchemeLinks += profile.unsupportedSchemeLinks;
        aggregate.invalidTargets += profile.invalidTargets;
        aggregate.emptyLabels += profile.emptyLabels;
        aggregate.malformedLinkCandidates += profile.malformedLinkCandidates;
        if (profile.duplicateWebTargets > 0) aggregate.pagesWithDuplicateWebTargets += 1;
        if (profile.unsupportedSchemeLinks > 0) aggregate.pagesWithUnsupportedSchemeLinks += 1;
        if (profile.malformedLinkCandidates > 0) aggregate.pagesWithMalformedLinkCandidates += 1;
      }
    }
  }

  const nameVariants = [...entitiesById.entries()]
    .flatMap(([id, entity]) =>
      entity.pages.size > 1 && entity.names.size > 1
        ? [
            {
              id,
              types: [...entity.types].sort(),
              names: [...entity.names.values()].sort(),
              pages: [...entity.pages].sort(),
            },
          ]
        : []
    )
    .sort(
      (left, right) => right.pages.length - left.pages.length || left.id.localeCompare(right.id)
    );
  const typeVariants = [...entitiesById.entries()]
    .flatMap(([id, entity]) => {
      if (entity.pageTypes.size < 2) return [];
      const pageTypes = [...entity.pageTypes.entries()]
        .map(([url, types]) => ({ url, types: [...types].sort() }))
        .sort((left, right) => left.url.localeCompare(right.url));
      if (new Set(pageTypes.map(({ types }) => types.join('\0'))).size < 2) return [];
      return [{ id, pages: pageTypes.slice(0, 50), pagesTruncated: pageTypes.length > 50 }];
    })
    .sort(
      (left, right) => right.pages.length - left.pages.length || left.id.localeCompare(right.id)
    );
  const sameAsVariants = [...entitiesById.entries()]
    .flatMap(([id, entity]) => {
      const completeProfiles = [...entity.pageSameAs.entries()]
        .filter(([, profile]) => !profile.incomplete)
        .map(([url, profile]) => ({ url, sameAs: [...profile.urls].sort() }))
        .sort((left, right) => left.url.localeCompare(right.url));
      if (
        completeProfiles.length < 2 ||
        new Set(completeProfiles.map(({ sameAs }) => sameAs.join('\0'))).size < 2
      )
        return [];
      const excludedIncompletePages = [...entity.pageSameAs.values()].filter(
        ({ incomplete }) => incomplete
      ).length;
      return [
        {
          id,
          pages: completeProfiles.slice(0, 50),
          pagesTruncated: completeProfiles.length > 50,
          excludedIncompletePages,
        },
      ];
    })
    .sort(
      (left, right) => right.pages.length - left.pages.length || left.id.localeCompare(right.id)
    );
  contentProfile.sourceRenderedPhraseCoverageMeanPercent =
    contentProfile.sourceRenderedPhraseCoverageSamples > 0
      ? Number(
          (
            sourceRenderedPhraseCoverageSum / contentProfile.sourceRenderedPhraseCoverageSamples
          ).toFixed(1)
        )
      : null;

  return {
    schemaVersion: 1,
    auditTimestamp: batch.timestamp,
    pagesAnalyzed: pages.length,
    pagesWithGeoData,
    pagesSkipped: pages.length - pagesWithGeoData,
    pageSummaries,
    searchCrawlerCoverage: crawlerCoverage('ai-search-crawler-access'),
    dataUseCrawlerPolicy: crawlerCoverage('ai-data-use-crawler-policy'),
    userInitiatedFetchPolicy: crawlerCoverage('ai-user-initiated-fetch-access'),
    dataUseNoArchiveCoverage,
    pagesWithNoindex,
    pagesWithNoindexUrls,
    pagesWithNoSnippet,
    pagesWithNoSnippetUrls,
    pagesWithDataNoSnippetRegions,
    pagesWithDataNoSnippetRegionUrls,
    totalDataNoSnippetElements,
    totalDataNoSnippetWords,
    dataNoSnippetWordShareSamples,
    dataNoSnippetWordShareMeanPercent:
      dataNoSnippetWordShareSamples > 0
        ? Number((dataNoSnippetWordShareSum / dataNoSnippetWordShareSamples).toFixed(1))
        : null,
    pagesWithExternalSources,
    totalExternalSourceLinks,
    sourceHostCoverage: [...sourceHostPages.entries()]
      .map(([host, pageSet]) => ({
        host,
        pagesLinked: pageSet.size,
        ...(sourceHostObservedLinks.has(host)
          ? { observedLinks: sourceHostObservedLinks.get(host) }
          : {}),
      }))
      .sort(
        (left, right) =>
          (right.observedLinks ?? -1) - (left.observedLinks ?? -1) ||
          right.pagesLinked - left.pagesLinked ||
          left.host.localeCompare(right.host)
      ),
    pagesWithTruncatedSourceHostLists,
    pagesWithTruncatedSourceHostLinkCounts,
    pagesWithCitationMarkersOrReferences,
    totalResolvedInlineCitationTargetsWithExternalLinks,
    totalResolvedInlineCitationTargetsWithoutExternalLinks,
    pagesWithUnresolvedInlineCitationTargets,
    totalUnresolvedInlineCitationTargets,
    unresolvedInlineCitationTargetUrls,
    optionalLlmsFiles: [...llmsFiles.values()].sort((left, right) =>
      left.path.localeCompare(right.path)
    ),
    contentProfile: {
      ...contentProfile,
      schemaTypeCoverage: [...schemaTypePages.entries()]
        .map(([type, pageSet]) => ({ type, pages: pageSet.size }))
        .sort((left, right) => right.pages - left.pages || left.type.localeCompare(right.type)),
    },
    entityAnalysis: {
      pagesWithIdentityEntities: pagesWithIdentityEntities.size,
      pagesWithTruncatedEntityLists: pagesWithTruncatedEntityLists.size,
      pagesWithTruncatedSameAsLists: pagesWithTruncatedSameAsLists.size,
      pagesWithSameAsReferences: pagesWithSameAsReferences.size,
      totalSameAsReferences,
      sameAsHostCoverage: [...sameAsHostPages.entries()]
        .map(([host, pageSet]) => ({ host, pages: pageSet.size }))
        .sort((left, right) => right.pages - left.pages || left.host.localeCompare(right.host)),
      uniqueIdentityIds: entitiesById.size,
      identityIdsSharedAcrossPages: [...entitiesById.values()].filter(
        ({ pages: pageSet }) => pageSet.size > 1
      ).length,
      entitiesWithNameVariants: nameVariants.length,
      nameVariants: nameVariants.slice(0, 50),
      entitiesWithTypeVariants: typeVariants.length,
      typeVariants: typeVariants.slice(0, 50),
      entitiesWithSameAsVariants: sameAsVariants.length,
      sameAsVariants: sameAsVariants.slice(0, 50),
    },
  };
}

/** Render the per-page GEO profile as spreadsheet-safe, filterable CSV. */
export function renderSiteWideGeoCsv(analysis: SiteWideGeoAnalysis): string {
  const headers = [
    'audit_timestamp',
    'url',
    'canonical_url',
    'geo_assessed',
    'search_crawler_access_status',
    'search_crawlers_allowed',
    'search_crawlers_blocked',
    'search_crawler_access_note',
    'search_crawler_rule_matches_json',
    'data_use_policy_status',
    'data_use_crawlers_allowed',
    'data_use_crawlers_blocked',
    'data_use_policy_note',
    'data_use_crawler_directives_json',
    'user_fetch_access_status',
    'user_fetch_crawlers_allowed',
    'user_fetch_crawlers_blocked',
    'user_fetch_access_note',
    'user_fetch_crawler_rule_matches_json',
    'preview_controls_status',
    'preview_controls_note',
    'http_status',
    'noindex',
    'no_snippet',
    'max_snippet_zero',
    'preview_crawler_controls_json',
    'data_use_crawler_controls_json',
    'data_nosnippet_elements',
    'data_nosnippet_words',
    'visible_text_words',
    'data_nosnippet_word_share_percent',
    'answer_content_status',
    'answer_content_note',
    'answer_content_words',
    'heading_count',
    'question_headings',
    'main_or_article_region',
    'concise_answer_blocks',
    'list_count',
    'table_count',
    'external_content_links',
    'schema_types',
    'schema_type_list_truncated',
    'date_modified_days',
    'date_modified_days_truncated',
    'date_modified_has_non_date_value',
    'identity_entity_count',
    'identity_entity_list_truncated',
    'visible_author',
    'visible_date',
    'schema_author',
    'schema_date',
    'schema_accessible_for_free',
    'schema_accessible_for_free_has_non_boolean_value',
    'document_language',
    'document_language_valid',
    'source_rendered_status',
    'source_rendered_note',
    'rendered_phrase_coverage_percent',
    'rendered_phrase_counts',
    'rendered_only_phrase_count',
    'rendered_phrase_sample_truncated',
    'citation_evidence_status',
    'citation_evidence_note',
    'external_source_links',
    'unique_source_hosts',
    'descriptive_source_links',
    'citation_source_hosts',
    'citation_source_host_links_json',
    'citation_source_hosts_truncated',
    'citation_source_host_links_truncated',
    'top_citation_source_host_share_percent',
    'reference_section_count',
    'reference_section_links',
    'inline_citation_markers',
    'resolved_inline_targets_with_external_links',
    'resolved_inline_targets_without_external_links',
    'unresolved_citation_targets',
    'unresolved_citation_target_samples',
    'unresolved_citation_targets_truncated',
    'jsonld_blocks_with_citation_field',
    'optional_llms_files_status',
    'optional_llms_files_note',
    'llms_txt_state',
    'llms_txt_http_status',
    'llms_full_txt_state',
    'llms_full_txt_http_status',
  ];
  const cell = escapeSpreadsheetCsvCell;
  const rows = analysis.pageSummaries.map((page) => {
    const search = page.searchCrawlerAccess ?? [];
    const dataUse = page.dataUseCrawlerPolicy ?? [];
    const fetch = page.userInitiatedFetchAccess ?? [];
    const files = new Map((page.optionalLlmsFiles ?? []).map((file) => [file.path, file]));
    const values: unknown[] = [
      analysis.auditTimestamp,
      page.url,
      page.canonicalUrl,
      page.geoAssessed,
      page.signalCoverage.searchCrawlerAccess,
      search
        .filter(({ allowed }) => allowed)
        .map(({ token }) => token)
        .join('|'),
      search
        .filter(({ allowed }) => !allowed)
        .map(({ token }) => token)
        .join('|'),
      page.signalNotes?.searchCrawlerAccess,
      JSON.stringify(
        search
          .filter(({ matchedRule }) => matchedRule)
          .map(({ token, matchedRule }) => ({ token, ...matchedRule }))
      ),
      page.signalCoverage.dataUseCrawlerPolicy,
      dataUse
        .filter(({ allowed }) => allowed)
        .map(({ token }) => token)
        .join('|'),
      dataUse
        .filter(({ allowed }) => !allowed)
        .map(({ token }) => token)
        .join('|'),
      page.signalNotes?.dataUseCrawlerPolicy,
      JSON.stringify(
        dataUse.map(({ token, allowed, matchedRule }) => ({
          token,
          allowed,
          ...(matchedRule ? { matchedRule } : {}),
        }))
      ),
      page.signalCoverage.userInitiatedFetchAccess,
      fetch
        .filter(({ allowed }) => allowed)
        .map(({ token }) => token)
        .join('|'),
      fetch
        .filter(({ allowed }) => !allowed)
        .map(({ token }) => token)
        .join('|'),
      page.signalNotes?.userInitiatedFetchAccess,
      JSON.stringify(
        fetch
          .filter(({ matchedRule }) => matchedRule)
          .map(({ token, ...entry }) => ({ token, ...entry }))
      ),
      page.signalCoverage.previewControls,
      page.signalNotes?.previewControls,
      page.previewControls?.responseStatus,
      page.previewControls?.noindex,
      page.previewControls?.noSnippet,
      page.previewControls?.maxSnippetZero,
      JSON.stringify(page.previewControls?.crawlerControls ?? []),
      JSON.stringify(page.previewControls?.dataUseCrawlerControls ?? []),
      page.previewControls?.dataNoSnippetElements,
      page.previewControls?.dataNoSnippetWords,
      page.previewControls?.visibleTextWords,
      page.previewControls?.dataNoSnippetWordSharePercent,
      page.signalCoverage.answerContent,
      page.signalNotes?.answerContent,
      page.answerContent?.contentWords,
      page.answerContent?.headingCount,
      page.answerContent?.questionHeadings,
      page.answerContent?.mainOrArticleRegion,
      page.answerContent?.conciseAnswerBlocks,
      page.answerContent?.listCount,
      page.answerContent?.tableCount,
      page.answerContent?.externalContentLinks,
      page.answerContent?.jsonLdTypes,
      page.answerContent?.jsonLdTypeListTruncated,
      page.answerContent?.schemaDateModifiedDays,
      page.answerContent?.schemaDateModifiedDaysTruncated,
      page.answerContent?.schemaDateModifiedHasNonDateValue,
      page.answerContent?.identityEntities?.length,
      page.answerContent?.identityEntityListTruncated,
      page.answerContent?.visibleAuthor,
      page.answerContent?.visibleDate,
      page.answerContent?.schemaAuthor,
      page.answerContent?.schemaDate,
      page.answerContent?.schemaIsAccessibleForFree,
      page.answerContent?.schemaHasNonBooleanAccessibleForFreeValue,
      page.answerContent?.documentLanguage,
      page.answerContent?.documentLanguageValid,
      page.signalCoverage.sourceRenderedContent,
      page.signalNotes?.sourceRenderedContent,
      page.sourceRenderedContent?.renderedPhraseCoveragePercent,
      JSON.stringify({
        sourceWords: page.sourceRenderedContent?.sourceWordCount,
        renderedWords: page.sourceRenderedContent?.renderedWordCount,
        sourcePhrases: page.sourceRenderedContent?.sourcePhraseCount,
        renderedPhrases: page.sourceRenderedContent?.renderedPhraseCount,
        sharedPhrases: page.sourceRenderedContent?.sharedRenderedPhraseCount,
      }),
      page.sourceRenderedContent?.renderedOnlyPhraseCount,
      page.sourceRenderedContent?.sampleTruncated,
      page.signalCoverage.citationEvidence,
      page.signalNotes?.citationEvidence,
      page.citationEvidence?.externalSourceLinkCount,
      page.citationEvidence?.uniqueSourceHosts,
      page.citationEvidence?.descriptiveSourceLinkCount,
      page.citationEvidence?.sourceHosts,
      JSON.stringify(page.citationEvidence?.sourceHostLinkCounts ?? []),
      page.citationEvidence?.sourceHostListTruncated,
      page.citationEvidence?.sourceHostLinkCountsTruncated,
      page.citationEvidence?.topSourceHostLinkSharePercent,
      page.citationEvidence?.referenceSectionCount,
      page.citationEvidence?.referenceSectionLinkCount,
      page.citationEvidence?.inlineCitationMarkerCount,
      page.citationEvidence?.resolvedInlineCitationTargetsWithExternalLinks,
      page.citationEvidence?.resolvedInlineCitationTargetsWithoutExternalLinks,
      page.citationEvidence?.unresolvedInlineCitationTargetCount,
      page.citationEvidence?.unresolvedInlineCitationTargets,
      page.citationEvidence?.unresolvedInlineCitationTargetsTruncated,
      page.citationEvidence?.jsonLdBlocksWithCitationField,
      page.signalCoverage.optionalLlmsFiles,
      page.signalNotes?.optionalLlmsFiles,
      files.get('/llms.txt')?.state,
      files.get('/llms.txt')?.status,
      files.get('/llms-full.txt')?.state,
      files.get('/llms-full.txt')?.status,
    ];
    return values.map(cell).join(',');
  });
  return [headers.join(','), ...rows].join('\n') + '\n';
}

/** Render cross-page structured-identity differences without dropping page-level context. */
export function renderSiteWideGeoEntityVariantsCsv(analysis: SiteWideGeoAnalysis): string {
  const headers = [
    'row_type',
    'audit_timestamp',
    'entity_id',
    'url',
    'pages_json',
    'types_json',
    'names_json',
    'same_as_json',
    'pages_truncated',
    'excluded_incomplete_pages',
    'finding_count',
    'finding_rows_exported',
    'name_variant_findings_exported',
    'type_variant_page_rows_exported',
    'same_as_variant_page_rows_exported',
    'name_variant_findings_truncated',
    'type_variant_findings_truncated',
    'same_as_variant_findings_truncated',
    'pages_analyzed',
    'pages_with_identity_entities',
    'pages_with_truncated_entity_lists',
    'pages_with_truncated_same_as_lists',
    'entities_with_name_variants',
    'entities_with_type_variants',
    'entities_with_same_as_variants',
  ];
  const cell = escapeSpreadsheetCsvCell;
  const entities = analysis.entityAnalysis;
  const rows: unknown[][] = [
    [
      'summary',
      analysis.auditTimestamp,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      entities.entitiesWithNameVariants +
        entities.entitiesWithTypeVariants +
        entities.entitiesWithSameAsVariants,
      entities.nameVariants.length +
        entities.typeVariants.reduce((sum, variant) => sum + variant.pages.length, 0) +
        entities.sameAsVariants.reduce((sum, variant) => sum + variant.pages.length, 0),
      entities.nameVariants.length,
      entities.typeVariants.reduce((sum, variant) => sum + variant.pages.length, 0),
      entities.sameAsVariants.reduce((sum, variant) => sum + variant.pages.length, 0),
      entities.entitiesWithNameVariants > entities.nameVariants.length,
      entities.entitiesWithTypeVariants > entities.typeVariants.length,
      entities.entitiesWithSameAsVariants > entities.sameAsVariants.length,
      analysis.pagesAnalyzed,
      entities.pagesWithIdentityEntities,
      entities.pagesWithTruncatedEntityLists,
      entities.pagesWithTruncatedSameAsLists,
      entities.entitiesWithNameVariants,
      entities.entitiesWithTypeVariants,
      entities.entitiesWithSameAsVariants,
    ],
  ];
  for (const variant of entities.nameVariants) {
    rows.push([
      'name-variant',
      analysis.auditTimestamp,
      variant.id,
      undefined,
      JSON.stringify(variant.pages),
      JSON.stringify(variant.types),
      JSON.stringify(variant.names),
    ]);
  }
  for (const variant of entities.typeVariants) {
    for (const page of variant.pages)
      rows.push([
        'type-variant',
        analysis.auditTimestamp,
        variant.id,
        page.url,
        undefined,
        JSON.stringify(page.types),
        undefined,
        undefined,
        variant.pagesTruncated,
      ]);
  }
  for (const variant of entities.sameAsVariants) {
    for (const page of variant.pages)
      rows.push([
        'sameAs-variant',
        analysis.auditTimestamp,
        variant.id,
        page.url,
        undefined,
        undefined,
        undefined,
        JSON.stringify(page.sameAs),
        variant.pagesTruncated,
        variant.excludedIncompletePages,
      ]);
  }
  return (
    [
      headers.map(cell).join(','),
      ...rows.map((row) => headers.map((_, index) => cell(row[index])).join(',')),
    ].join('\n') + '\n'
  );
}

/** Render crawler policy and matching preview directives as one row per page, policy, and crawler. */
export function renderSiteWideGeoCrawlerAccessCsv(analysis: SiteWideGeoAnalysis): string {
  const headers = [
    'audit_timestamp',
    'page_url',
    'canonical_url',
    'row_type',
    'policy',
    'access_signal_status',
    'access_signal_note',
    'preview_signal_status',
    'preview_signal_note',
    'crawler_token',
    'access_observed',
    'access_allowed',
    'matched_agents_json',
    'matched_rule_json',
    'preview_control_observed',
    'noindex',
    'no_snippet',
    'max_snippet_zero',
    'noarchive',
  ];
  const rows: unknown[][] = [];
  const policies = [
    {
      key: 'searchCrawlerAccess' as const,
      label: 'search',
      previewKind: 'search' as const,
      crawlers: (page: SiteWideGeoPageSummary) => page.searchCrawlerAccess ?? [],
      previewTokens: (page: SiteWideGeoPageSummary) =>
        (page.previewControls?.crawlerControls ?? []).map(({ token }) => token),
    },
    {
      key: 'dataUseCrawlerPolicy' as const,
      label: 'data-use',
      previewKind: 'data-use' as const,
      crawlers: (page: SiteWideGeoPageSummary) => page.dataUseCrawlerPolicy ?? [],
      previewTokens: (page: SiteWideGeoPageSummary) =>
        (page.previewControls?.dataUseCrawlerControls ?? []).map(({ token }) => token),
    },
    {
      key: 'userInitiatedFetchAccess' as const,
      label: 'user-fetch',
      previewKind: undefined,
      crawlers: (page: SiteWideGeoPageSummary) => page.userInitiatedFetchAccess ?? [],
      previewTokens: (_page: SiteWideGeoPageSummary) => [],
    },
  ];
  for (const page of analysis.pageSummaries) {
    for (const policy of policies) {
      const status = page.signalCoverage[policy.key];
      const crawlers = policy.crawlers(page);
      const tokensByKey = new Map<string, string>();
      for (const token of [...crawlers.map(({ token }) => token), ...policy.previewTokens(page)]) {
        if (!tokensByKey.has(token.toLowerCase())) tokensByKey.set(token.toLowerCase(), token);
      }
      const tokens = [...tokensByKey.values()];
      const entries = tokens.length > 0 ? tokens : [undefined];
      for (const token of entries) {
        const tokenKey = token?.toLowerCase();
        const crawler =
          tokenKey === undefined
            ? undefined
            : crawlers.find(({ token: candidate }) => candidate.toLowerCase() === tokenKey);
        const searchPreview =
          tokenKey === undefined || policy.previewKind !== 'search'
            ? undefined
            : page.previewControls?.crawlerControls?.find(
                ({ token: candidate }) => candidate.toLowerCase() === tokenKey
              );
        const dataUsePreview =
          tokenKey === undefined || policy.previewKind !== 'data-use'
            ? undefined
            : page.previewControls?.dataUseCrawlerControls?.find(
                ({ token: candidate }) => candidate.toLowerCase() === tokenKey
              );
        rows.push([
          analysis.auditTimestamp,
          page.url,
          page.canonicalUrl,
          token ? 'crawler' : 'coverage',
          policy.label,
          status,
          page.signalNotes?.[policy.key],
          policy.previewKind ? page.signalCoverage.previewControls : 'not-applicable',
          policy.previewKind ? page.signalNotes?.previewControls : undefined,
          crawler?.token ?? token,
          Boolean(crawler),
          crawler?.allowed,
          JSON.stringify(crawler?.matchedAgents ?? []),
          crawler?.matchedRule ? JSON.stringify(crawler.matchedRule) : undefined,
          policy.previewKind ? Boolean(dataUsePreview || searchPreview) : undefined,
          policy.previewKind === 'data-use' ? dataUsePreview?.noindex : searchPreview?.noindex,
          policy.previewKind === 'search' ? searchPreview?.noSnippet : undefined,
          policy.previewKind === 'search' ? searchPreview?.maxSnippetZero : undefined,
          policy.previewKind === 'data-use' ? dataUsePreview?.noArchive : undefined,
        ]);
      }
    }
  }
  return (
    [
      headers.map(escapeSpreadsheetCsvCell).join(','),
      ...rows.map((row) => row.map(escapeSpreadsheetCsvCell).join(',')),
    ].join('\n') + '\n'
  );
}
