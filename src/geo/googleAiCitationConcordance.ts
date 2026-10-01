import type { AiAnswerCitationObservationReport } from './answerCitationObservations';
import type { GoogleAiPerformanceExport } from './googleAiPerformance';
import type { SiteWideGeoAnalysis } from '../sitewide';

export interface GoogleAiCitationConcordanceRow {
  url: string;
  joinState: 'matched' | 'google-ai-only' | 'observed-answer-only';
  joinMethod?: 'exact-normalized-url' | 'audit-canonical';
  ambiguousAuditCanonical: boolean;
  googleAiImpressions?: number;
  shareOfGoogleAiPageImpressionsPercent?: number | null;
  citationEvents?: number;
  pageAnswerPairs?: number;
  pagePromptPairs?: number;
  citationEventSharePercent?: number | null;
  owned?: boolean;
  providers?: string[];
  providerMetrics?: GoogleAiCitationConcordanceProviderMetric[];
}

export interface GoogleAiCitationConcordanceProviderMetric {
  provider: string;
  citationEvents: number;
  pageAnswerPairs: number;
  pagePromptPairs: number;
}

export interface GoogleAiCitationConcordanceProviderSample {
  provider: string;
  observations: number;
  uniquePrompts: number;
  citationEvents: number;
  incompleteCitationListObservations: number | null;
}

export interface GoogleAiCitationConcordanceReport {
  source: 'Google AI impressions and observed answer citation URL concordance';
  schemaVersion: 1;
  googleAiSurface: 'search' | 'discover';
  googleAiDatasetKind: 'page';
  pathDepth: number;
  auditCanonicalBridgeAvailable: boolean;
  auditPagesAvailable: number;
  auditPagesSkipped: number;
  exactUrlMatchedPages: number;
  auditCanonicalMatchedPages: number;
  googleAiUrlsWithAmbiguousCanonical: number;
  answerCitationUrlsWithAmbiguousCanonical: number;
  googleAiSourceFile?: string;
  answerObservations: number;
  answerIncompleteCitationListObservations: number | null;
  ownedDomainAssessmentEnabled: boolean;
  answerCitationSourcePages: number;
  answerCitationPagesTruncated: boolean;
  providerMetricCountsAvailable?: boolean;
  answerProviderSamplesAvailable?: boolean;
  answerProviderSamples?: GoogleAiCitationConcordanceProviderSample[];
  answerCitationEvents?: number;
  answerCitationEventsInRetainedPages?: number;
  answerCitationEventDetailCoveragePercent?: number | null;
  matchedCitationEventShareOfAllAnswerEventsPercent?: number | null;
  googleAiPageRows: number;
  googleAiUniquePages: number;
  googleAiPageImpressions: number;
  matchedPages: number;
  matchedGoogleAiImpressions: number;
  matchedImpressionSharePercent: number | null;
  matchedCitationEvents: number;
  matchedPageAnswerPairs: number;
  matchedPagePromptPairs: number;
  googleAiOnlyPages: number;
  observedAnswerOnlyPages: number;
  rows: GoogleAiCitationConcordanceRow[];
  pathFamilies: GoogleAiCitationConcordancePathFamily[];
  note: string;
}

export interface GoogleAiCitationConcordancePathFamily {
  pathFamily: string;
  pages: number;
  googleAiPages: number;
  citedPages: number;
  matchedPages: number;
  exactUrlMatchedPages: number;
  auditCanonicalMatchedPages: number;
  googleAiOnlyPages: number;
  observedAnswerOnlyPages: number;
  googleAiImpressions: number;
  matchedGoogleAiImpressions: number;
  citationEvents: number;
  matchedCitationEvents: number;
  matchedPageAnswerPairs: number;
  matchedPagePromptPairs: number;
  ownedCitedPages?: number;
}

function normalizedPageUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    url.hash = '';
    url.search = '';
    return url.href;
  } catch {
    return undefined;
  }
}

function addSafeCount(left: number, right: number, label: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} exceeds the safe integer range.`);
  return value;
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === undefined || value === null) return '';
  const rawText = String(value);
  const text =
    typeof value === 'number' ? rawText : /^[\s]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function htmlEscape(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character
  );
}

interface ResolvedAuditUrl {
  key: string;
  viaCanonical: boolean;
  ambiguous: boolean;
}

function auditCanonicalResolver(
  audit: SiteWideGeoAnalysis | undefined
): (value: string) => ResolvedAuditUrl | undefined {
  const candidatesByUrl = new Map<string, Set<string>>();
  for (const page of audit?.pageSummaries ?? []) {
    const pageUrl = normalizedPageUrl(page.url);
    const canonicalUrl = normalizedPageUrl(page.canonicalUrl ?? page.url);
    if (!pageUrl || !canonicalUrl) continue;
    const candidates = candidatesByUrl.get(pageUrl) ?? new Set<string>();
    candidates.add(canonicalUrl);
    candidatesByUrl.set(pageUrl, candidates);
  }
  return (value) => {
    const key = normalizedPageUrl(value);
    if (!key) return undefined;
    const candidates = candidatesByUrl.get(key);
    if (!candidates || candidates.size === 0) return { key, viaCanonical: false, ambiguous: false };
    if (candidates.size > 1) return { key, viaCanonical: false, ambiguous: true };
    const canonical = [...candidates][0]!;
    return { key: canonical, viaCanonical: canonical !== key, ambiguous: false };
  };
}

function aggregatePages<T extends { url: string }>(
  rows: T[],
  combine: (existing: T, next: T) => T,
  resolve: (value: string) => ResolvedAuditUrl | undefined = (value) => {
    const key = normalizedPageUrl(value);
    return key ? { key, viaCanonical: false, ambiguous: false } : undefined;
  }
): Map<string, T> {
  const pages = new Map<string, T>();
  for (const row of rows) {
    const key = resolve(row.url)?.key;
    if (!key) continue;
    const existing = pages.get(key);
    pages.set(key, existing ? combine(existing, row) : row);
  }
  return pages;
}

function aggregateConcordancePathFamilies(
  rows: GoogleAiCitationConcordanceRow[],
  pathDepth: number,
  ownedDomainAssessmentEnabled: boolean
): GoogleAiCitationConcordancePathFamily[] {
  const pathFamilies = new Map<string, GoogleAiCitationConcordancePathFamily>();
  for (const row of rows) {
    const parsedUrl = new URL(row.url);
    const segments = parsedUrl.pathname.split('/').filter(Boolean).slice(0, pathDepth);
    const family = `${parsedUrl.origin}/${segments.length ? `${segments.join('/')}/` : ''}`;
    const bucket = pathFamilies.get(family) ?? {
      pathFamily: family,
      pages: 0,
      googleAiPages: 0,
      citedPages: 0,
      matchedPages: 0,
      exactUrlMatchedPages: 0,
      auditCanonicalMatchedPages: 0,
      googleAiOnlyPages: 0,
      observedAnswerOnlyPages: 0,
      googleAiImpressions: 0,
      matchedGoogleAiImpressions: 0,
      citationEvents: 0,
      matchedCitationEvents: 0,
      matchedPageAnswerPairs: 0,
      matchedPagePromptPairs: 0,
      ...(ownedDomainAssessmentEnabled ? { ownedCitedPages: 0 } : {}),
    };
    bucket.pages += 1;
    if (row.googleAiImpressions !== undefined) {
      bucket.googleAiPages += 1;
      bucket.googleAiImpressions = addSafeCount(
        bucket.googleAiImpressions,
        row.googleAiImpressions,
        'Path-family Google AI impressions'
      );
    }
    if (row.citationEvents !== undefined) {
      bucket.citedPages += 1;
      bucket.citationEvents = addSafeCount(
        bucket.citationEvents,
        row.citationEvents,
        'Path-family citation events'
      );
    }
    if (row.joinState === 'matched') {
      bucket.matchedPages += 1;
      if (row.joinMethod === 'audit-canonical') bucket.auditCanonicalMatchedPages += 1;
      else bucket.exactUrlMatchedPages += 1;
      bucket.matchedGoogleAiImpressions = addSafeCount(
        bucket.matchedGoogleAiImpressions,
        row.googleAiImpressions ?? 0,
        'Path-family matched Google AI impressions'
      );
      bucket.matchedCitationEvents = addSafeCount(
        bucket.matchedCitationEvents,
        row.citationEvents ?? 0,
        'Path-family matched citation events'
      );
      bucket.matchedPageAnswerPairs = addSafeCount(
        bucket.matchedPageAnswerPairs,
        row.pageAnswerPairs ?? 0,
        'Path-family page-answer pairs'
      );
      bucket.matchedPagePromptPairs = addSafeCount(
        bucket.matchedPagePromptPairs,
        row.pagePromptPairs ?? 0,
        'Path-family page-prompt pairs'
      );
    } else if (row.joinState === 'google-ai-only') {
      bucket.googleAiOnlyPages += 1;
    } else {
      bucket.observedAnswerOnlyPages += 1;
    }
    if (bucket.ownedCitedPages !== undefined && row.owned === true) bucket.ownedCitedPages += 1;
    pathFamilies.set(family, bucket);
  }
  return [...pathFamilies.values()].sort(
    (left, right) =>
      right.matchedGoogleAiImpressions - left.matchedGoogleAiImpressions ||
      right.matchedCitationEvents - left.matchedCitationEvents ||
      left.pathFamily.localeCompare(right.pathFamily)
  );
}

/**
 * Join one Google AI page-dimension export with locally observed answer citations.
 * Query strings and fragments are removed to match the answer citation analyzer's
 * URL normalization. An optional sitewide audit can bridge unique canonical aliases.
 */
export function analyzeGoogleAiCitationConcordance(
  googleAi: GoogleAiPerformanceExport,
  answers: AiAnswerCitationObservationReport,
  pathDepth = 2,
  audit?: SiteWideGeoAnalysis
): GoogleAiCitationConcordanceReport {
  if (googleAi.datasetKind !== 'page' || !googleAi.dimensions.includes('url')) {
    throw new Error(
      'Google AI citation concordance requires a page-dimension export with page URLs.'
    );
  }
  if (googleAi.rows.length > 100_000)
    throw new Error('Google AI citation concordance is limited to 100,000 page rows.');
  if (!Number.isInteger(pathDepth) || pathDepth < 1 || pathDepth > 5)
    throw new Error('Citation concordance path depth must be an integer from 1 to 5.');

  const resolveUrl = auditCanonicalResolver(audit);
  const googleInputs = googleAi.rows.filter(
    (row): row is typeof row & { url: string } => typeof row.url === 'string'
  );
  const googleResolutionByKey = new Map<string, { viaCanonical: boolean; ambiguous: boolean }>();
  const answerResolutionByKey = new Map<string, { viaCanonical: boolean; ambiguous: boolean }>();
  const googleOriginalUrlsByKey = new Map<string, Set<string>>();
  const answerOriginalUrlsByKey = new Map<string, Set<string>>();
  const recordResolution = (
    map: Map<string, { viaCanonical: boolean; ambiguous: boolean }>,
    originalUrlsByKey: Map<string, Set<string>>,
    url: string
  ): ResolvedAuditUrl | undefined => {
    const resolution = resolveUrl(url);
    if (!resolution) return undefined;
    const originalUrl = normalizedPageUrl(url);
    if (originalUrl) {
      const originals = originalUrlsByKey.get(resolution.key) ?? new Set<string>();
      originals.add(originalUrl);
      originalUrlsByKey.set(resolution.key, originals);
    }
    const existing = map.get(resolution.key);
    map.set(resolution.key, {
      viaCanonical: (existing?.viaCanonical ?? false) || resolution.viaCanonical,
      ambiguous: (existing?.ambiguous ?? false) || resolution.ambiguous,
    });
    return resolution;
  };
  const googlePages = aggregatePages(
    googleInputs
      .map((row) => {
        const resolution = recordResolution(
          googleResolutionByKey,
          googleOriginalUrlsByKey,
          row.url
        );
        return { ...row, url: resolution?.key ?? row.url };
      })
      .filter((row) => normalizedPageUrl(row.url) !== undefined),
    (existing, next) => ({
      ...existing,
      impressions: addSafeCount(
        existing.impressions,
        next.impressions,
        'Aggregated Google AI page impressions'
      ),
    })
  );
  const citationPages = aggregatePages(
    answers.citedPages
      .map((row) => {
        const resolution = recordResolution(
          answerResolutionByKey,
          answerOriginalUrlsByKey,
          row.url
        );
        return { ...row, url: resolution?.key ?? row.url };
      })
      .filter((row) => normalizedPageUrl(row.url) !== undefined),
    (existing, next) => ({
      ...existing,
      citationEvents: addSafeCount(
        existing.citationEvents,
        next.citationEvents,
        'Aggregated citation events'
      ),
      observedAnswers: addSafeCount(
        existing.observedAnswers,
        next.observedAnswers,
        'Aggregated page-answer pairs'
      ),
      uniquePrompts: addSafeCount(
        existing.uniquePrompts,
        next.uniquePrompts,
        'Aggregated page-prompt pairs'
      ),
      providers: [...new Set([...existing.providers, ...next.providers])].sort((left, right) =>
        left.localeCompare(right)
      ),
      owned: existing.owned || next.owned,
    })
  );

  const pageImpressions = [...googlePages.values()].reduce(
    (sum, row) => addSafeCount(sum, row.impressions, 'Google AI page impressions'),
    0
  );
  const urls = [...new Set([...googlePages.keys(), ...citationPages.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );
  const providerMetricsByUrl = new Map<
    string,
    Map<string, GoogleAiCitationConcordanceProviderMetric>
  >();
  for (const page of answers.citedPages) {
    const key = resolveUrl(page.url)?.key;
    if (!key || !page.providerCitationListPositions) continue;
    const providers =
      providerMetricsByUrl.get(key) ?? new Map<string, GoogleAiCitationConcordanceProviderMetric>();
    for (const metric of page.providerCitationListPositions) {
      const existing = providers.get(metric.provider);
      providers.set(metric.provider, {
        provider: metric.provider,
        citationEvents: addSafeCount(
          existing?.citationEvents ?? 0,
          metric.citationEvents,
          'Provider citation events for a URL'
        ),
        pageAnswerPairs: addSafeCount(
          existing?.pageAnswerPairs ?? 0,
          metric.observedAnswers,
          'Provider page-answer pairs'
        ),
        pagePromptPairs: addSafeCount(
          existing?.pagePromptPairs ?? 0,
          metric.uniquePrompts,
          'Provider page-prompt pairs'
        ),
      });
    }
    providerMetricsByUrl.set(key, providers);
  }
  const rows: GoogleAiCitationConcordanceRow[] = urls.map((url) => {
    const googlePage = googlePages.get(url);
    const citationPage = citationPages.get(url);
    const googleResolution = googleResolutionByKey.get(url);
    const answerResolution = answerResolutionByKey.get(url);
    const googleOriginals = googleOriginalUrlsByKey.get(url) ?? new Set<string>();
    const answerOriginals = answerOriginalUrlsByKey.get(url) ?? new Set<string>();
    const exactUrlOverlap = [...googleOriginals].some((originalUrl) =>
      answerOriginals.has(originalUrl)
    );
    const joinState =
      googlePage && citationPage
        ? 'matched'
        : googlePage
          ? 'google-ai-only'
          : 'observed-answer-only';
    return {
      url,
      joinState,
      ...(joinState === 'matched'
        ? {
            joinMethod: exactUrlOverlap
              ? ('exact-normalized-url' as const)
              : googleResolution?.viaCanonical || answerResolution?.viaCanonical
                ? ('audit-canonical' as const)
                : ('exact-normalized-url' as const),
          }
        : {}),
      ambiguousAuditCanonical: Boolean(googleResolution?.ambiguous || answerResolution?.ambiguous),
      ...(googlePage
        ? {
            googleAiImpressions: googlePage.impressions,
            shareOfGoogleAiPageImpressionsPercent:
              pageImpressions > 0
                ? Number(((googlePage.impressions / pageImpressions) * 100).toFixed(4))
                : null,
          }
        : {}),
      ...(citationPage
        ? {
            citationEvents: citationPage.citationEvents,
            pageAnswerPairs: citationPage.observedAnswers,
            pagePromptPairs: citationPage.uniquePrompts,
            citationEventSharePercent:
              answers.summary.citationEvents > 0
                ? Number(
                    ((citationPage.citationEvents / answers.summary.citationEvents) * 100).toFixed(
                      4
                    )
                  )
                : null,
            ...(answers.ownedDomains.length > 0 ? { owned: citationPage.owned } : {}),
            providers: citationPage.providers,
            ...(providerMetricsByUrl.has(url)
              ? {
                  providerMetrics: [...providerMetricsByUrl.get(url)!.values()].sort(
                    (left, right) => left.provider.localeCompare(right.provider)
                  ),
                }
              : {}),
          }
        : {}),
    };
  });
  const matched = rows.filter((row) => row.joinState === 'matched');
  const matchedGoogleAiImpressions = matched.reduce(
    (sum, row) =>
      addSafeCount(sum, row.googleAiImpressions ?? 0, 'Matched Google AI page impressions'),
    0
  );
  const matchedCitationEvents = matched.reduce(
    (sum, row) => addSafeCount(sum, row.citationEvents ?? 0, 'Matched citation events'),
    0
  );
  const matchedPageAnswerPairs = matched.reduce(
    (sum, row) => addSafeCount(sum, row.pageAnswerPairs ?? 0, 'Matched page-answer pairs'),
    0
  );
  const matchedPagePromptPairs = matched.reduce(
    (sum, row) => addSafeCount(sum, row.pagePromptPairs ?? 0, 'Matched page-prompt pairs'),
    0
  );
  const exactUrlMatchedPages = matched.filter(
    (row) => row.joinMethod === 'exact-normalized-url'
  ).length;
  const auditCanonicalMatchedPages = matched.filter(
    (row) => row.joinMethod === 'audit-canonical'
  ).length;
  const googleAiUrlsWithAmbiguousCanonical = [...googleResolutionByKey.values()].filter(
    ({ ambiguous }) => ambiguous
  ).length;
  const answerCitationUrlsWithAmbiguousCanonical = [...answerResolutionByKey.values()].filter(
    ({ ambiguous }) => ambiguous
  ).length;
  const answerCitationEventsInRetainedPages = answers.citedPages.reduce(
    (sum, page) => addSafeCount(sum, page.citationEvents, 'Retained answer citation events'),
    0
  );
  if (answerCitationEventsInRetainedPages > answers.summary.citationEvents) {
    throw new Error(
      'Retained cited-page event counts exceed the answer report total; the citation report is inconsistent.'
    );
  }

  const pathFamilyRows = aggregateConcordancePathFamilies(
    rows,
    pathDepth,
    answers.ownedDomains.length > 0
  );

  return {
    source: 'Google AI impressions and observed answer citation URL concordance',
    schemaVersion: 1,
    googleAiSurface: googleAi.surface,
    googleAiDatasetKind: 'page',
    pathDepth,
    auditCanonicalBridgeAvailable: Boolean(audit && audit.pageSummaries.length > 0),
    auditPagesAvailable: audit?.pageSummaries.length ?? 0,
    auditPagesSkipped: audit?.pagesSkipped ?? 0,
    exactUrlMatchedPages,
    auditCanonicalMatchedPages,
    googleAiUrlsWithAmbiguousCanonical,
    answerCitationUrlsWithAmbiguousCanonical,
    ...(googleAi.sourceFile ? { googleAiSourceFile: googleAi.sourceFile } : {}),
    answerObservations: answers.summary.observations,
    answerIncompleteCitationListObservations:
      answers.summary.incompleteCitationListObservations ?? null,
    ownedDomainAssessmentEnabled: answers.ownedDomains.length > 0,
    answerCitationSourcePages: answers.citedPages.length,
    answerCitationPagesTruncated: answers.citedPagesTruncated,
    providerMetricCountsAvailable: answers.citedPages.every((page) =>
      Array.isArray(page.providerCitationListPositions)
    ),
    answerProviderSamplesAvailable: true,
    answerProviderSamples: answers.providers
      .map((provider) => ({
        provider: provider.provider,
        observations: provider.observations,
        uniquePrompts: provider.uniquePrompts,
        citationEvents: provider.citationEvents,
        incompleteCitationListObservations: provider.incompleteCitationListObservations ?? null,
      }))
      .sort((left, right) => left.provider.localeCompare(right.provider)),
    answerCitationEvents: answers.summary.citationEvents,
    answerCitationEventsInRetainedPages,
    answerCitationEventDetailCoveragePercent:
      answers.summary.citationEvents > 0
        ? Number(
            ((answerCitationEventsInRetainedPages / answers.summary.citationEvents) * 100).toFixed(
              4
            )
          )
        : null,
    matchedCitationEventShareOfAllAnswerEventsPercent:
      answers.summary.citationEvents > 0
        ? Number(((matchedCitationEvents / answers.summary.citationEvents) * 100).toFixed(4))
        : null,
    googleAiPageRows: googleAi.rowCount,
    googleAiUniquePages: googlePages.size,
    googleAiPageImpressions: pageImpressions,
    matchedPages: matched.length,
    matchedGoogleAiImpressions,
    matchedImpressionSharePercent:
      pageImpressions > 0
        ? Number(((matchedGoogleAiImpressions / pageImpressions) * 100).toFixed(2))
        : null,
    matchedCitationEvents,
    matchedPageAnswerPairs,
    matchedPagePromptPairs,
    googleAiOnlyPages: rows.filter((row) => row.joinState === 'google-ai-only').length,
    observedAnswerOnlyPages: rows.filter((row) => row.joinState === 'observed-answer-only').length,
    rows,
    pathFamilies: pathFamilyRows,
    note: `Normalized URL overlap is descriptive across two independent measurement sources. Google AI impressions are not clicks, citations, or grounding-query counts. Answer citation events and unique prompts come from the supplied local sample and do not share the Google export denominator. The matched page-answer and page-prompt totals count page pairs, not distinct answers or prompts. Query strings and fragments are removed to align with answer citation page normalization; ${audit && audit.pageSummaries.length > 0 ? 'a unique canonical declaration in the supplied sitewide audit may bridge two distinct URLs, while conflicting declarations remain exact-only' : 'redirects and declared canonical aliases are not inferred'}. A truncated answer citation page list makes citation-only coverage incomplete.`,
  };
}

export function renderGoogleAiCitationConcordanceCsv(
  report: GoogleAiCitationConcordanceReport
): string {
  const headers = [
    'url',
    'join_state',
    'join_method',
    'ambiguous_audit_canonical',
    'google_ai_surface',
    'google_ai_impressions',
    'share_of_google_ai_page_impressions_percent',
    'citation_events',
    'page_answer_pairs',
    'page_prompt_pairs',
    'citation_event_share_percent',
    'owned',
    'providers',
    'provider_metrics_json',
    'answer_citation_pages_truncated',
    'answer_incomplete_citation_list_observations',
    'answer_citation_events_total',
    'answer_citation_events_in_retained_pages',
    'answer_citation_event_detail_coverage_percent',
    'matched_citation_event_share_of_all_answer_events_percent',
  ];
  const rows = report.rows.map((row) =>
    [
      row.url,
      row.joinState,
      row.joinMethod,
      row.ambiguousAuditCanonical,
      report.googleAiSurface,
      row.googleAiImpressions,
      row.shareOfGoogleAiPageImpressionsPercent,
      row.citationEvents,
      row.pageAnswerPairs,
      row.pagePromptPairs,
      row.citationEventSharePercent,
      row.owned,
      row.providers ? JSON.stringify(row.providers) : undefined,
      row.providerMetrics ? JSON.stringify(row.providerMetrics) : undefined,
      report.answerCitationPagesTruncated,
      report.answerIncompleteCitationListObservations,
      report.answerCitationEvents,
      report.answerCitationEventsInRetainedPages,
      report.answerCitationEventDetailCoveragePercent,
      report.matchedCitationEventShareOfAllAnswerEventsPercent,
    ]
      .map(csvCell)
      .join(',')
  );
  return `${headers.join(',')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

/** Export one row per cited URL and provider, with metrics omitted when only provider labels were retained. */
export function renderGoogleAiCitationConcordanceProviderCsv(
  report: GoogleAiCitationConcordanceReport
): string {
  const headers = [
    'url',
    'provider',
    'provider_metric_counts_available',
    'join_state',
    'join_method',
    'ambiguous_audit_canonical',
    'citation_events',
    'page_answer_pairs',
    'page_prompt_pairs',
    'owned',
  ];
  const rows = report.rows.flatMap((row) => {
    const metricsByProvider = new Map(
      (row.providerMetrics ?? []).map((metric) => [metric.provider, metric])
    );
    const providers = [
      ...new Set([
        ...(row.providers ?? []),
        ...(row.providerMetrics ?? []).map((metric) => metric.provider),
      ]),
    ].sort((left, right) => left.localeCompare(right));
    return providers.map((provider) => {
      const metric = metricsByProvider.get(provider);
      return [
        row.url,
        provider,
        metric !== undefined,
        row.joinState,
        row.joinMethod,
        row.ambiguousAuditCanonical,
        metric?.citationEvents,
        metric?.pageAnswerPairs,
        metric?.pagePromptPairs,
        row.owned,
      ]
        .map(csvCell)
        .join(',');
    });
  });
  return `${headers.join(',')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

export function renderGoogleAiCitationConcordancePathFamilyCsv(
  report: GoogleAiCitationConcordanceReport
): string {
  const headers = [
    'path_family',
    'path_depth',
    'pages',
    'google_ai_pages',
    'cited_pages',
    'matched_pages',
    'exact_url_matched_pages',
    'audit_canonical_matched_pages',
    'google_ai_only_pages',
    'observed_answer_only_pages',
    'google_ai_impressions',
    'matched_google_ai_impressions',
    'citation_events',
    'matched_citation_events',
    'matched_page_answer_pairs',
    'matched_page_prompt_pairs',
    'owned_cited_pages',
  ];
  const rows = report.pathFamilies.map((row) =>
    [
      row.pathFamily,
      report.pathDepth,
      row.pages,
      row.googleAiPages,
      row.citedPages,
      row.matchedPages,
      row.exactUrlMatchedPages,
      row.auditCanonicalMatchedPages,
      row.googleAiOnlyPages,
      row.observedAnswerOnlyPages,
      row.googleAiImpressions,
      row.matchedGoogleAiImpressions,
      row.citationEvents,
      row.matchedCitationEvents,
      row.matchedPageAnswerPairs,
      row.matchedPagePromptPairs,
      row.ownedCitedPages,
    ]
      .map(csvCell)
      .join(',')
  );
  return `${headers.join(',')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

export function renderGoogleAiCitationConcordancePathDepthSweepCsv(
  report: GoogleAiCitationConcordanceReport
): string {
  const headers = [
    'path_depth',
    'path_family',
    'pages',
    'google_ai_pages',
    'cited_pages',
    'matched_pages',
    'exact_url_matched_pages',
    'audit_canonical_matched_pages',
    'google_ai_only_pages',
    'observed_answer_only_pages',
    'google_ai_impressions',
    'matched_google_ai_impressions',
    'citation_events',
    'matched_citation_events',
    'matched_page_answer_pairs',
    'matched_page_prompt_pairs',
    'owned_cited_pages',
  ];
  const rows: string[] = [];
  for (let depth = 1; depth <= 5; depth += 1) {
    const families = aggregateConcordancePathFamilies(
      report.rows,
      depth,
      report.ownedDomainAssessmentEnabled
    );
    for (const family of families) {
      rows.push(
        [
          depth,
          family.pathFamily,
          family.pages,
          family.googleAiPages,
          family.citedPages,
          family.matchedPages,
          family.exactUrlMatchedPages,
          family.auditCanonicalMatchedPages,
          family.googleAiOnlyPages,
          family.observedAnswerOnlyPages,
          family.googleAiImpressions,
          family.matchedGoogleAiImpressions,
          family.citationEvents,
          family.matchedCitationEvents,
          family.matchedPageAnswerPairs,
          family.matchedPagePromptPairs,
          family.ownedCitedPages,
        ]
          .map(csvCell)
          .join(',')
      );
      if (rows.length > 500_000)
        throw new Error(
          'Path-depth sensitivity output exceeds the 500,000-row cap; narrow the source exports.'
        );
    }
  }
  return `${headers.join(',')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

export function renderGoogleAiCitationConcordanceHtml(
  report: GoogleAiCitationConcordanceReport
): string {
  const rows = report.rows
    .slice(0, 2_000)
    .map((row) => {
      const providerMetrics = row.providerMetrics ?? [];
      const providerDetails = providerMetrics
        .slice(0, 25)
        .map(
          (metric) =>
            `${metric.provider}: ${metric.citationEvents} citations / ${metric.pageAnswerPairs} answers / ${metric.pagePromptPairs} prompts`
        );
      if (providerMetrics.length > 25)
        providerDetails.push(
          `+${providerMetrics.length - 25} more; use provider CSV for full detail`
        );
      return `<tr data-state="${htmlEscape(row.joinState)}"><td>${htmlEscape(row.joinState)}</td><td>${htmlEscape(row.joinMethod ?? '—')}</td><td>${htmlEscape(row.ambiguousAuditCanonical ? 'yes' : 'no')}</td><td><a href="${htmlEscape(row.url)}">${htmlEscape(row.url)}</a></td><td>${htmlEscape(row.googleAiImpressions ?? '—')}</td><td>${htmlEscape(row.citationEvents ?? '—')}</td><td>${htmlEscape(row.pageAnswerPairs ?? '—')}</td><td>${htmlEscape(row.pagePromptPairs ?? '—')}</td><td>${htmlEscape(row.owned === undefined ? '—' : row.owned ? 'yes' : 'no')}</td><td>${htmlEscape(providerDetails.length ? providerDetails.join('; ') : (row.providers ?? []).join(', ') || '—')}</td></tr>`;
    })
    .join('');
  const familyRows = report.pathFamilies
    .slice(0, 2_000)
    .map(
      (row) =>
        `<tr><td>${htmlEscape(row.pathFamily)}</td><td>${row.pages.toLocaleString()}</td><td>${row.matchedPages.toLocaleString()}</td><td>${row.exactUrlMatchedPages.toLocaleString()}</td><td>${row.auditCanonicalMatchedPages.toLocaleString()}</td><td>${row.googleAiImpressions.toLocaleString()}</td><td>${row.matchedGoogleAiImpressions.toLocaleString()}</td><td>${row.citationEvents.toLocaleString()}</td><td>${row.matchedCitationEvents.toLocaleString()}</td></tr>`
    )
    .join('');
  const warnings = [
    'Google AI impressions are not clicks, citations, or grounding-query counts; answer observations use a separate sample and denominator.',
    'Join removes query strings and fragments to match answer citation URL normalization. Redirects are not inferred.',
    ...(report.auditCanonicalBridgeAvailable
      ? [
          `Supplied unique URL/canonical declarations from ${report.auditPagesAvailable.toLocaleString()} sitewide audit pages; ${report.auditCanonicalMatchedPages.toLocaleString()} page matches used the bridge.`,
        ]
      : ['No sitewide canonical audit bridge was supplied.']),
    ...(report.googleAiUrlsWithAmbiguousCanonical +
      report.answerCitationUrlsWithAmbiguousCanonical >
    0
      ? [
          `Conflicting canonical declarations were found for ${report.googleAiUrlsWithAmbiguousCanonical} Google export URLs and ${report.answerCitationUrlsWithAmbiguousCanonical} answer-citation URLs; those URLs were kept exact-only.`,
        ]
      : []),
    ...(report.auditPagesSkipped > 0
      ? [
          `The supplied sitewide audit reports ${report.auditPagesSkipped} skipped pages; canonical matches can only use retained audit page summaries.`,
        ]
      : []),
    ...(!report.ownedDomainAssessmentEnabled
      ? [
          'Owned-domain status is not assessed. Supply --geo-answer-owned-domain to classify owned cited pages.',
        ]
      : []),
    ...(report.answerCitationPagesTruncated
      ? [
          'The answer report truncated its cited-page list, so citation-only and overlap coverage are incomplete.',
        ]
      : []),
    ...(report.answerCitationEventDetailCoveragePercent !== undefined &&
    report.answerCitationEventDetailCoveragePercent !== null &&
    report.answerCitationEventDetailCoveragePercent < 100
      ? [
          `Retained cited-page rows represent ${report.answerCitationEventDetailCoveragePercent}% of all answer citation events.`,
        ]
      : []),
    ...(report.answerIncompleteCitationListObservations === null
      ? ['The answer report did not provide citation-list completeness counts.']
      : report.answerIncompleteCitationListObservations > 0
        ? [
            `${report.answerIncompleteCitationListObservations.toLocaleString()} answer observations had incomplete citation lists; unlisted source coverage is unknown.`,
          ]
        : []),
    ...(report.rows.length > 2_000
      ? [
          `Showing the first 2,000 of ${report.rows.length.toLocaleString()} pages. Request CSV output for the full page table.`,
        ]
      : []),
    ...(report.pathFamilies.length > 2_000
      ? [
          `Showing the first 2,000 of ${report.pathFamilies.length.toLocaleString()} URL families. Request path-family CSV output for the full family table.`,
        ]
      : []),
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google AI citation concordance</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f3f6fa;color:#132238}.wrap{max-width:1250px;margin:auto;padding:32px 20px}h1{margin:0 0 8px}.muted{color:#53657a}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:24px 0}.card,section{background:#fff;border:1px solid #dce4ec;border-radius:12px;padding:16px}.card strong{display:block;font-size:25px}.warnings{background:#fff8e8;border-color:#f1d28a;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;border-bottom:1px solid #e7edf3;padding:10px 8px;vertical-align:top}th{position:sticky;top:0;background:#f7f9fc}td a{overflow-wrap:anywhere;color:#2256a1}.table{overflow:auto;max-height:70vh}code{font-size:12px}</style></head>
<body><main class="wrap"><h1>Google AI citation concordance</h1><p class="muted">${htmlEscape(report.googleAiSurface)} page impressions joined to locally observed answer citations. ${htmlEscape(report.googleAiSourceFile ?? '')}</p>
<section class="warnings"><strong>Interpretation</strong><ul>${warnings.map((warning) => `<li>${htmlEscape(warning)}</li>`).join('')}</ul><p>${htmlEscape(report.note)}</p></section>
<div class="cards"><div class="card"><span class="muted">Google AI page impressions</span><strong>${report.googleAiPageImpressions.toLocaleString()}</strong></div><div class="card"><span class="muted">Matched URLs</span><strong>${report.matchedPages.toLocaleString()}</strong></div><div class="card"><span class="muted">Matched impression share</span><strong>${report.matchedImpressionSharePercent === null ? '—' : `${report.matchedImpressionSharePercent}%`}</strong></div><div class="card"><span class="muted">Matched citation events</span><strong>${report.matchedCitationEvents.toLocaleString()}</strong></div><div class="card"><span class="muted">Retained citation-event detail</span><strong>${report.answerCitationEventDetailCoveragePercent === undefined || report.answerCitationEventDetailCoveragePercent === null ? '—' : `${report.answerCitationEventDetailCoveragePercent}%`}</strong></div><div class="card"><span class="muted">Google-only URLs</span><strong>${report.googleAiOnlyPages.toLocaleString()}</strong></div><div class="card"><span class="muted">Citation-only URLs</span><strong>${report.observedAnswerOnlyPages.toLocaleString()}</strong></div></div>
<section><h2>Path-family rollup</h2><p class="muted">Origin plus the first ${report.pathDepth} path segments. Families overlap only when analyzed at another depth; this report uses one depth.</p><div class="table"><table><thead><tr><th>Path family</th><th>Pages</th><th>Matched</th><th>Exact matches</th><th>Canonical matches</th><th>AI impressions</th><th>Matched AI impressions</th><th>Citation events</th><th>Matched citation events</th></tr></thead><tbody>${familyRows || '<tr><td colspan="9">No URL families were available.</td></tr>'}</tbody></table></div></section>
<section><h2>URL-level detail</h2><p><label for="query">Filter URLs/providers </label><input id="query" type="search" autocomplete="off"><label for="join-state"> Join state </label><select id="join-state"><option value="">All</option><option value="matched">Matched</option><option value="google-ai-only">Google AI only</option><option value="observed-answer-only">Observed answer only</option></select></p><div class="table"><table><thead><tr><th>Join state</th><th>Join method</th><th>Canonical ambiguity</th><th>URL</th><th>AI impressions</th><th>Citation events</th><th>Page-answer pairs</th><th>Page-prompt pairs</th><th>Owned</th><th>Providers</th></tr></thead><tbody id="pages">${rows || '<tr><td colspan="10">No valid page URLs were available.</td></tr>'}</tbody></table></div><p id="visible-count" class="muted" aria-live="polite"></p></section>
<script>(()=>{const q=document.getElementById('query'),s=document.getElementById('join-state'),body=document.getElementById('pages'),count=document.getElementById('visible-count');const apply=()=>{let n=0;for(const row of body.querySelectorAll('tr[data-state]')){const visible=(!s.value||row.dataset.state===s.value)&&row.textContent.toLowerCase().includes(q.value.trim().toLowerCase());row.hidden=!visible;if(visible)n+=1}count.textContent=n+' page rows shown'};q.addEventListener('input',apply);s.addEventListener('change',apply);apply()})();</script>
</main></body></html>`;
}
