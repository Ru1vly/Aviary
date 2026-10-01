import type {
  GoogleAiCitationConcordanceReport,
  GoogleAiCitationConcordanceRow,
} from './googleAiCitationConcordance';

export type GoogleAiCitationConcordanceTransition =
  | 'matched-both'
  | 'newly-matched'
  | 'lost-match'
  | 'appeared'
  | 'disappeared'
  | 'unchanged-unmatched'
  | 'changed-unmatched';

export interface GoogleAiCitationConcordanceComparisonRow {
  url: string;
  transition: GoogleAiCitationConcordanceTransition;
  baselineJoinState?: GoogleAiCitationConcordanceRow['joinState'];
  currentJoinState?: GoogleAiCitationConcordanceRow['joinState'];
  baselineJoinMethod?: GoogleAiCitationConcordanceRow['joinMethod'];
  currentJoinMethod?: GoogleAiCitationConcordanceRow['joinMethod'];
  baselineAmbiguousAuditCanonical?: boolean;
  currentAmbiguousAuditCanonical?: boolean;
  baselineGoogleAiImpressions?: number;
  currentGoogleAiImpressions?: number;
  googleAiImpressionsChange?: number;
  baselineCitationEvents?: number;
  currentCitationEvents?: number;
  citationEventsChange?: number;
  baselinePageAnswerPairs?: number;
  currentPageAnswerPairs?: number;
  pageAnswerPairsChange?: number;
  baselinePagePromptPairs?: number;
  currentPagePromptPairs?: number;
  pagePromptPairsChange?: number;
  baselineOwned?: boolean;
  currentOwned?: boolean;
}

export interface GoogleAiCitationConcordanceProviderComparisonRow {
  url: string;
  provider: string;
  detailState: 'present-both' | 'baseline-detail-only' | 'current-detail-only';
  baselineJoinState?: GoogleAiCitationConcordanceRow['joinState'];
  currentJoinState?: GoogleAiCitationConcordanceRow['joinState'];
  baselineJoinMethod?: GoogleAiCitationConcordanceRow['joinMethod'];
  currentJoinMethod?: GoogleAiCitationConcordanceRow['joinMethod'];
  baselineAmbiguousAuditCanonical?: boolean;
  currentAmbiguousAuditCanonical?: boolean;
  baselineCitationEvents?: number;
  currentCitationEvents?: number;
  citationEventsChange?: number;
  baselinePageAnswerPairs?: number;
  currentPageAnswerPairs?: number;
  pageAnswerPairsChange?: number;
  baselinePagePromptPairs?: number;
  currentPagePromptPairs?: number;
  pagePromptPairsChange?: number;
}

export interface GoogleAiCitationConcordanceProviderSampleComparisonRow {
  provider: string;
  detailState: 'present-both' | 'baseline-detail-only' | 'current-detail-only';
  baselineObservations?: number;
  currentObservations?: number;
  observationsChange?: number;
  baselineUniquePrompts?: number;
  currentUniquePrompts?: number;
  uniquePromptsChange?: number;
  baselineCitationEvents?: number;
  currentCitationEvents?: number;
  citationEventsChange?: number;
  baselineIncompleteCitationListObservations?: number | null;
  currentIncompleteCitationListObservations?: number | null;
}

export interface GoogleAiCitationConcordanceComparisonReport {
  source: 'Google AI citation concordance period comparison';
  schemaVersion: 1;
  googleAiSurface: 'search' | 'discover';
  baselineGoogleAiSourceFile?: string;
  currentGoogleAiSourceFile?: string;
  baselineAuditCanonicalBridgeAvailable: boolean;
  currentAuditCanonicalBridgeAvailable: boolean;
  ownedDomainAssessmentEnabled: boolean;
  baselineProviderMetricCountsAvailable: boolean;
  currentProviderMetricCountsAvailable: boolean;
  baselineAnswerProviderSamplesAvailable: boolean;
  currentAnswerProviderSamplesAvailable: boolean;
  baselineAnswerObservations: number;
  currentAnswerObservations: number;
  baselineIncompleteCitationListObservations: number | null;
  currentIncompleteCitationListObservations: number | null;
  baselineAnswerCitationSourcePages: number;
  currentAnswerCitationSourcePages: number;
  baselineAnswerCitationPagesTruncated: boolean;
  currentAnswerCitationPagesTruncated: boolean;
  baselineAnswerCitationEvents: number | null;
  currentAnswerCitationEvents: number | null;
  baselineAnswerCitationEventsInRetainedPages: number | null;
  currentAnswerCitationEventsInRetainedPages: number | null;
  baselineAnswerCitationEventDetailCoveragePercent: number | null;
  currentAnswerCitationEventDetailCoveragePercent: number | null;
  baselineMatchedCitationEventShareOfAllAnswerEventsPercent: number | null;
  currentMatchedCitationEventShareOfAllAnswerEventsPercent: number | null;
  baselineGoogleAiUniquePages: number;
  currentGoogleAiUniquePages: number;
  baselineGoogleAiPageImpressions: number;
  currentGoogleAiPageImpressions: number;
  googleAiPageImpressionsChange: number;
  baselineMatchedPages: number;
  currentMatchedPages: number;
  matchedPagesChange: number;
  baselineMatchedImpressionSharePercent: number | null;
  currentMatchedImpressionSharePercent: number | null;
  matchedImpressionShareChangePercentagePoints: number | null;
  baselineMatchedCitationEvents: number;
  currentMatchedCitationEvents: number;
  matchedCitationEventsChange: number;
  baselineMatchedPageAnswerPairs: number;
  currentMatchedPageAnswerPairs: number;
  matchedPageAnswerPairsChange: number;
  baselineMatchedPagePromptPairs: number;
  currentMatchedPagePromptPairs: number;
  matchedPagePromptPairsChange: number;
  disappearedPages: number;
  appearedPages: number;
  newlyMatchedPages: number;
  lostMatchPages: number;
  rows: GoogleAiCitationConcordanceComparisonRow[];
  providerChanges: GoogleAiCitationConcordanceProviderComparisonRow[];
  providerSampleChanges: GoogleAiCitationConcordanceProviderSampleComparisonRow[];
  note: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function normalizeUrl(value: string): string | undefined {
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

/** Validate a serialized report before it is used as a historical baseline. */
export function isGoogleAiCitationConcordanceReport(
  value: unknown
): value is GoogleAiCitationConcordanceReport {
  if (
    !isRecord(value) ||
    value.source !== 'Google AI impressions and observed answer citation URL concordance' ||
    value.schemaVersion !== 1 ||
    !['search', 'discover'].includes(String(value.googleAiSurface)) ||
    value.googleAiDatasetKind !== 'page' ||
    typeof value.auditCanonicalBridgeAvailable !== 'boolean' ||
    typeof value.ownedDomainAssessmentEnabled !== 'boolean' ||
    typeof value.answerCitationPagesTruncated !== 'boolean' ||
    (value.providerMetricCountsAvailable !== undefined &&
      typeof value.providerMetricCountsAvailable !== 'boolean') ||
    (value.answerProviderSamplesAvailable !== undefined &&
      typeof value.answerProviderSamplesAvailable !== 'boolean') ||
    !isSafeCount(value.answerObservations) ||
    !(
      value.answerIncompleteCitationListObservations === null ||
      isSafeCount(value.answerIncompleteCitationListObservations)
    ) ||
    !isSafeCount(value.answerCitationSourcePages) ||
    (value.answerCitationEvents !== undefined && !isSafeCount(value.answerCitationEvents)) ||
    (value.answerCitationEventsInRetainedPages !== undefined &&
      !isSafeCount(value.answerCitationEventsInRetainedPages)) ||
    !isSafeCount(value.googleAiUniquePages) ||
    !isSafeCount(value.googleAiPageImpressions) ||
    !isSafeCount(value.matchedPages) ||
    !isSafeCount(value.matchedCitationEvents) ||
    !isSafeCount(value.matchedPageAnswerPairs) ||
    !isSafeCount(value.matchedPagePromptPairs) ||
    !(
      value.matchedImpressionSharePercent === null ||
      (typeof value.matchedImpressionSharePercent === 'number' &&
        Number.isFinite(value.matchedImpressionSharePercent) &&
        value.matchedImpressionSharePercent >= 0 &&
        value.matchedImpressionSharePercent <= 100)
    ) ||
    !(
      value.answerCitationEventDetailCoveragePercent === undefined ||
      value.answerCitationEventDetailCoveragePercent === null ||
      (typeof value.answerCitationEventDetailCoveragePercent === 'number' &&
        Number.isFinite(value.answerCitationEventDetailCoveragePercent) &&
        value.answerCitationEventDetailCoveragePercent >= 0 &&
        value.answerCitationEventDetailCoveragePercent <= 100)
    ) ||
    !(
      value.matchedCitationEventShareOfAllAnswerEventsPercent === undefined ||
      value.matchedCitationEventShareOfAllAnswerEventsPercent === null ||
      (typeof value.matchedCitationEventShareOfAllAnswerEventsPercent === 'number' &&
        Number.isFinite(value.matchedCitationEventShareOfAllAnswerEventsPercent) &&
        value.matchedCitationEventShareOfAllAnswerEventsPercent >= 0 &&
        value.matchedCitationEventShareOfAllAnswerEventsPercent <= 100)
    ) ||
    !Array.isArray(value.rows)
  )
    return false;

  if (value.answerProviderSamples !== undefined) {
    if (!Array.isArray(value.answerProviderSamples)) return false;
    const seenProviders = new Set<string>();
    for (const providerSample of value.answerProviderSamples) {
      if (
        !isRecord(providerSample) ||
        typeof providerSample.provider !== 'string' ||
        !isSafeCount(providerSample.observations) ||
        !isSafeCount(providerSample.uniquePrompts) ||
        !isSafeCount(providerSample.citationEvents) ||
        !(
          providerSample.incompleteCitationListObservations === null ||
          isSafeCount(providerSample.incompleteCitationListObservations)
        ) ||
        seenProviders.has(providerSample.provider)
      )
        return false;
      seenProviders.add(providerSample.provider);
    }
  }

  const seenUrls = new Set<string>();
  for (const row of value.rows) {
    if (
      !isRecord(row) ||
      typeof row.url !== 'string' ||
      !normalizeUrl(row.url) ||
      !['matched', 'google-ai-only', 'observed-answer-only'].includes(String(row.joinState))
    )
      return false;
    const url = normalizeUrl(row.url)!;
    if (seenUrls.has(url)) return false;
    seenUrls.add(url);
    if (
      row.joinMethod !== undefined &&
      !['exact-normalized-url', 'audit-canonical'].includes(String(row.joinMethod))
    )
      return false;
    if (typeof row.ambiguousAuditCanonical !== 'boolean') return false;
    for (const metric of [
      'googleAiImpressions',
      'citationEvents',
      'pageAnswerPairs',
      'pagePromptPairs',
    ] as const) {
      if (row[metric] !== undefined && !isSafeCount(row[metric])) return false;
    }
    if (row.owned !== undefined && typeof row.owned !== 'boolean') return false;
    if (row.providerMetrics !== undefined) {
      if (!Array.isArray(row.providerMetrics)) return false;
      const seenProviders = new Set<string>();
      for (const providerMetric of row.providerMetrics) {
        if (
          !isRecord(providerMetric) ||
          typeof providerMetric.provider !== 'string' ||
          !isSafeCount(providerMetric.citationEvents) ||
          !isSafeCount(providerMetric.pageAnswerPairs) ||
          !isSafeCount(providerMetric.pagePromptPairs) ||
          seenProviders.has(providerMetric.provider)
        )
          return false;
        seenProviders.add(providerMetric.provider);
      }
    }
  }
  return true;
}

function transitionFor(
  baseline: GoogleAiCitationConcordanceRow | undefined,
  current: GoogleAiCitationConcordanceRow | undefined
): GoogleAiCitationConcordanceTransition {
  if (!baseline && !current) throw new Error('A comparison URL must exist in at least one report.');
  if (!baseline) return current?.joinState === 'matched' ? 'newly-matched' : 'appeared';
  if (!current) return baseline.joinState === 'matched' ? 'lost-match' : 'disappeared';
  if (baseline.joinState === 'matched' && current.joinState === 'matched') return 'matched-both';
  if (baseline.joinState === 'matched') return 'lost-match';
  if (current.joinState === 'matched') return 'newly-matched';
  return baseline.joinState === current.joinState ? 'unchanged-unmatched' : 'changed-unmatched';
}

function difference(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined || right === undefined) return undefined;
  const value = right - left;
  if (!Number.isSafeInteger(value))
    throw new Error(
      'Google AI citation concordance comparison delta exceeds the safe integer range.'
    );
  return value;
}

/** Compare two saved concordance reports, preserving source measures and sample sizes separately. */
export function compareGoogleAiCitationConcordanceReports(
  baseline: GoogleAiCitationConcordanceReport,
  current: GoogleAiCitationConcordanceReport
): GoogleAiCitationConcordanceComparisonReport {
  if (baseline.googleAiSurface !== current.googleAiSurface) {
    throw new Error(
      'Google AI citation concordance comparisons require the same Search or Discover surface.'
    );
  }
  if (baseline.auditCanonicalBridgeAvailable !== current.auditCanonicalBridgeAvailable) {
    throw new Error(
      'Google AI citation concordance comparisons require the same canonical-bridge availability.'
    );
  }
  if (baseline.ownedDomainAssessmentEnabled !== current.ownedDomainAssessmentEnabled) {
    throw new Error(
      'Google AI citation concordance comparisons require the same owned-domain assessment setting.'
    );
  }

  const baselineByUrl = new Map(baseline.rows.map((row) => [normalizeUrl(row.url)!, row]));
  const currentByUrl = new Map(current.rows.map((row) => [normalizeUrl(row.url)!, row]));
  const urls = [...new Set([...baselineByUrl.keys(), ...currentByUrl.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );
  const rows: GoogleAiCitationConcordanceComparisonRow[] = urls.map((url) => {
    const before = baselineByUrl.get(url);
    const after = currentByUrl.get(url);
    const row: GoogleAiCitationConcordanceComparisonRow = {
      url,
      transition: transitionFor(before, after),
      ...(before ? { baselineJoinState: before.joinState } : {}),
      ...(after ? { currentJoinState: after.joinState } : {}),
      ...(before?.joinMethod ? { baselineJoinMethod: before.joinMethod } : {}),
      ...(after?.joinMethod ? { currentJoinMethod: after.joinMethod } : {}),
      ...(before ? { baselineAmbiguousAuditCanonical: before.ambiguousAuditCanonical } : {}),
      ...(after ? { currentAmbiguousAuditCanonical: after.ambiguousAuditCanonical } : {}),
      ...(before?.googleAiImpressions !== undefined
        ? { baselineGoogleAiImpressions: before.googleAiImpressions }
        : {}),
      ...(after?.googleAiImpressions !== undefined
        ? { currentGoogleAiImpressions: after.googleAiImpressions }
        : {}),
      ...(before?.citationEvents !== undefined
        ? { baselineCitationEvents: before.citationEvents }
        : {}),
      ...(after?.citationEvents !== undefined
        ? { currentCitationEvents: after.citationEvents }
        : {}),
      ...(before?.pageAnswerPairs !== undefined
        ? { baselinePageAnswerPairs: before.pageAnswerPairs }
        : {}),
      ...(after?.pageAnswerPairs !== undefined
        ? { currentPageAnswerPairs: after.pageAnswerPairs }
        : {}),
      ...(before?.pagePromptPairs !== undefined
        ? { baselinePagePromptPairs: before.pagePromptPairs }
        : {}),
      ...(after?.pagePromptPairs !== undefined
        ? { currentPagePromptPairs: after.pagePromptPairs }
        : {}),
      ...(before?.owned !== undefined ? { baselineOwned: before.owned } : {}),
      ...(after?.owned !== undefined ? { currentOwned: after.owned } : {}),
    };
    const metricDeltas = [
      [
        'googleAiImpressionsChange',
        difference(before?.googleAiImpressions, after?.googleAiImpressions),
      ],
      ['citationEventsChange', difference(before?.citationEvents, after?.citationEvents)],
      ['pageAnswerPairsChange', difference(before?.pageAnswerPairs, after?.pageAnswerPairs)],
      ['pagePromptPairsChange', difference(before?.pagePromptPairs, after?.pagePromptPairs)],
    ] as const;
    for (const [key, delta] of metricDeltas) {
      if (delta !== undefined) row[key] = delta;
    }
    return row;
  });
  const shareChange =
    baseline.matchedImpressionSharePercent === null ||
    current.matchedImpressionSharePercent === null
      ? null
      : Number(
          (current.matchedImpressionSharePercent - baseline.matchedImpressionSharePercent).toFixed(
            4
          )
        );
  const providerChanges: GoogleAiCitationConcordanceProviderComparisonRow[] = [];
  for (const url of urls) {
    const before = baselineByUrl.get(url);
    const after = currentByUrl.get(url);
    const baselineProviders = new Map(
      (before?.providerMetrics ?? []).map((metric) => [metric.provider, metric])
    );
    const currentProviders = new Map(
      (after?.providerMetrics ?? []).map((metric) => [metric.provider, metric])
    );
    const providers = [...new Set([...baselineProviders.keys(), ...currentProviders.keys()])].sort(
      (left, right) => left.localeCompare(right)
    );
    for (const provider of providers) {
      const oldMetric = baselineProviders.get(provider);
      const newMetric = currentProviders.get(provider);
      const detailState =
        oldMetric && newMetric
          ? 'present-both'
          : oldMetric
            ? 'baseline-detail-only'
            : 'current-detail-only';
      const providerRow: GoogleAiCitationConcordanceProviderComparisonRow = {
        url,
        provider,
        detailState,
        ...(before ? { baselineJoinState: before.joinState } : {}),
        ...(after ? { currentJoinState: after.joinState } : {}),
        ...(before?.joinMethod ? { baselineJoinMethod: before.joinMethod } : {}),
        ...(after?.joinMethod ? { currentJoinMethod: after.joinMethod } : {}),
        ...(before ? { baselineAmbiguousAuditCanonical: before.ambiguousAuditCanonical } : {}),
        ...(after ? { currentAmbiguousAuditCanonical: after.ambiguousAuditCanonical } : {}),
        ...(oldMetric ? { baselineCitationEvents: oldMetric.citationEvents } : {}),
        ...(newMetric ? { currentCitationEvents: newMetric.citationEvents } : {}),
        ...(oldMetric && newMetric
          ? { citationEventsChange: newMetric.citationEvents - oldMetric.citationEvents }
          : {}),
        ...(oldMetric ? { baselinePageAnswerPairs: oldMetric.pageAnswerPairs } : {}),
        ...(newMetric ? { currentPageAnswerPairs: newMetric.pageAnswerPairs } : {}),
        ...(oldMetric && newMetric
          ? { pageAnswerPairsChange: newMetric.pageAnswerPairs - oldMetric.pageAnswerPairs }
          : {}),
        ...(oldMetric ? { baselinePagePromptPairs: oldMetric.pagePromptPairs } : {}),
        ...(newMetric ? { currentPagePromptPairs: newMetric.pagePromptPairs } : {}),
        ...(oldMetric && newMetric
          ? { pagePromptPairsChange: newMetric.pagePromptPairs - oldMetric.pagePromptPairs }
          : {}),
      };
      providerChanges.push(providerRow);
    }
  }
  const baselineSamples = new Map(
    (baseline.answerProviderSamples ?? []).map((sample) => [sample.provider, sample])
  );
  const currentSamples = new Map(
    (current.answerProviderSamples ?? []).map((sample) => [sample.provider, sample])
  );
  const providerSampleChanges: GoogleAiCitationConcordanceProviderSampleComparisonRow[] = [];
  for (const provider of [...new Set([...baselineSamples.keys(), ...currentSamples.keys()])].sort(
    (left, right) => left.localeCompare(right)
  )) {
    const before = baselineSamples.get(provider);
    const after = currentSamples.get(provider);
    const detailState =
      before && after ? 'present-both' : before ? 'baseline-detail-only' : 'current-detail-only';
    providerSampleChanges.push({
      provider,
      detailState,
      ...(before ? { baselineObservations: before.observations } : {}),
      ...(after ? { currentObservations: after.observations } : {}),
      ...(before && after ? { observationsChange: after.observations - before.observations } : {}),
      ...(before ? { baselineUniquePrompts: before.uniquePrompts } : {}),
      ...(after ? { currentUniquePrompts: after.uniquePrompts } : {}),
      ...(before && after
        ? { uniquePromptsChange: after.uniquePrompts - before.uniquePrompts }
        : {}),
      ...(before ? { baselineCitationEvents: before.citationEvents } : {}),
      ...(after ? { currentCitationEvents: after.citationEvents } : {}),
      ...(before && after
        ? { citationEventsChange: after.citationEvents - before.citationEvents }
        : {}),
      ...(before
        ? { baselineIncompleteCitationListObservations: before.incompleteCitationListObservations }
        : {}),
      ...(after
        ? { currentIncompleteCitationListObservations: after.incompleteCitationListObservations }
        : {}),
    });
  }

  return {
    source: 'Google AI citation concordance period comparison',
    schemaVersion: 1,
    googleAiSurface: current.googleAiSurface,
    ...(baseline.googleAiSourceFile
      ? { baselineGoogleAiSourceFile: baseline.googleAiSourceFile }
      : {}),
    ...(current.googleAiSourceFile
      ? { currentGoogleAiSourceFile: current.googleAiSourceFile }
      : {}),
    baselineAuditCanonicalBridgeAvailable: baseline.auditCanonicalBridgeAvailable,
    currentAuditCanonicalBridgeAvailable: current.auditCanonicalBridgeAvailable,
    ownedDomainAssessmentEnabled: current.ownedDomainAssessmentEnabled,
    baselineProviderMetricCountsAvailable:
      baseline.providerMetricCountsAvailable ?? baseline.answerCitationSourcePages === 0,
    currentProviderMetricCountsAvailable:
      current.providerMetricCountsAvailable ?? current.answerCitationSourcePages === 0,
    baselineAnswerProviderSamplesAvailable:
      baseline.answerProviderSamplesAvailable ?? baseline.answerObservations === 0,
    currentAnswerProviderSamplesAvailable:
      current.answerProviderSamplesAvailable ?? current.answerObservations === 0,
    baselineAnswerObservations: baseline.answerObservations,
    currentAnswerObservations: current.answerObservations,
    baselineIncompleteCitationListObservations: baseline.answerIncompleteCitationListObservations,
    currentIncompleteCitationListObservations: current.answerIncompleteCitationListObservations,
    baselineAnswerCitationSourcePages: baseline.answerCitationSourcePages,
    currentAnswerCitationSourcePages: current.answerCitationSourcePages,
    baselineAnswerCitationPagesTruncated: baseline.answerCitationPagesTruncated,
    currentAnswerCitationPagesTruncated: current.answerCitationPagesTruncated,
    baselineAnswerCitationEvents: baseline.answerCitationEvents ?? null,
    currentAnswerCitationEvents: current.answerCitationEvents ?? null,
    baselineAnswerCitationEventsInRetainedPages:
      baseline.answerCitationEventsInRetainedPages ?? null,
    currentAnswerCitationEventsInRetainedPages: current.answerCitationEventsInRetainedPages ?? null,
    baselineAnswerCitationEventDetailCoveragePercent:
      baseline.answerCitationEventDetailCoveragePercent ?? null,
    currentAnswerCitationEventDetailCoveragePercent:
      current.answerCitationEventDetailCoveragePercent ?? null,
    baselineMatchedCitationEventShareOfAllAnswerEventsPercent:
      baseline.matchedCitationEventShareOfAllAnswerEventsPercent ?? null,
    currentMatchedCitationEventShareOfAllAnswerEventsPercent:
      current.matchedCitationEventShareOfAllAnswerEventsPercent ?? null,
    baselineGoogleAiUniquePages: baseline.googleAiUniquePages,
    currentGoogleAiUniquePages: current.googleAiUniquePages,
    baselineGoogleAiPageImpressions: baseline.googleAiPageImpressions,
    currentGoogleAiPageImpressions: current.googleAiPageImpressions,
    googleAiPageImpressionsChange:
      current.googleAiPageImpressions - baseline.googleAiPageImpressions,
    baselineMatchedPages: baseline.matchedPages,
    currentMatchedPages: current.matchedPages,
    matchedPagesChange: current.matchedPages - baseline.matchedPages,
    baselineMatchedImpressionSharePercent: baseline.matchedImpressionSharePercent,
    currentMatchedImpressionSharePercent: current.matchedImpressionSharePercent,
    matchedImpressionShareChangePercentagePoints: shareChange,
    baselineMatchedCitationEvents: baseline.matchedCitationEvents,
    currentMatchedCitationEvents: current.matchedCitationEvents,
    matchedCitationEventsChange: current.matchedCitationEvents - baseline.matchedCitationEvents,
    baselineMatchedPageAnswerPairs: baseline.matchedPageAnswerPairs,
    currentMatchedPageAnswerPairs: current.matchedPageAnswerPairs,
    matchedPageAnswerPairsChange: current.matchedPageAnswerPairs - baseline.matchedPageAnswerPairs,
    baselineMatchedPagePromptPairs: baseline.matchedPagePromptPairs,
    currentMatchedPagePromptPairs: current.matchedPagePromptPairs,
    matchedPagePromptPairsChange: current.matchedPagePromptPairs - baseline.matchedPagePromptPairs,
    disappearedPages: rows.filter((row) => row.transition === 'disappeared').length,
    appearedPages: rows.filter((row) => row.transition === 'appeared').length,
    newlyMatchedPages: rows.filter((row) => row.transition === 'newly-matched').length,
    lostMatchPages: rows.filter((row) => row.transition === 'lost-match').length,
    rows,
    providerChanges,
    providerSampleChanges,
    note: 'Page-level changes compare two independent Google AI exports and answer-observation samples. Impression changes, citation events, page-answer pairs, and page-prompt pairs are separate measures. Provider rows reflect retained per-provider page detail; a missing side is not a measured zero, especially when provider counts are unavailable or cited-page detail was truncated. Provider sample changes show observation and prompt support without adjusting for changing prompt mix. Different sample sizes or prompt mixes can change answer citation totals; this descriptive comparison does not establish shared queries, clicks, ranking, or causality.',
  };
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === undefined || value === null) return '';
  const raw = String(value);
  const safe = typeof value === 'number' ? raw : /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
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

/** Render row-level transitions and separate baseline/current measures as CSV. */
export function renderGoogleAiCitationConcordanceComparisonCsv(
  report: GoogleAiCitationConcordanceComparisonReport
): string {
  const headers = [
    'url',
    'transition',
    'baseline_join_state',
    'current_join_state',
    'baseline_join_method',
    'current_join_method',
    'baseline_ambiguous_audit_canonical',
    'current_ambiguous_audit_canonical',
    'baseline_google_ai_impressions',
    'current_google_ai_impressions',
    'google_ai_impressions_change',
    'baseline_citation_events',
    'current_citation_events',
    'citation_events_change',
    'baseline_page_answer_pairs',
    'current_page_answer_pairs',
    'page_answer_pairs_change',
    'baseline_page_prompt_pairs',
    'current_page_prompt_pairs',
    'page_prompt_pairs_change',
    'baseline_owned',
    'current_owned',
  ];
  const rows = report.rows.map((row) =>
    [
      row.url,
      row.transition,
      row.baselineJoinState,
      row.currentJoinState,
      row.baselineJoinMethod,
      row.currentJoinMethod,
      row.baselineAmbiguousAuditCanonical,
      row.currentAmbiguousAuditCanonical,
      row.baselineGoogleAiImpressions,
      row.currentGoogleAiImpressions,
      row.googleAiImpressionsChange,
      row.baselineCitationEvents,
      row.currentCitationEvents,
      row.citationEventsChange,
      row.baselinePageAnswerPairs,
      row.currentPageAnswerPairs,
      row.pageAnswerPairsChange,
      row.baselinePagePromptPairs,
      row.currentPagePromptPairs,
      row.pagePromptPairsChange,
      row.baselineOwned,
      row.currentOwned,
    ]
      .map(csvCell)
      .join(',')
  );
  return `${headers.join(',')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

/** Export per-page/provider transitions while keeping unavailable measures blank. */
export function renderGoogleAiCitationConcordanceProviderComparisonCsv(
  report: GoogleAiCitationConcordanceComparisonReport
): string {
  const samplesByProvider = new Map(
    report.providerSampleChanges.map((sample) => [sample.provider, sample])
  );
  const headers = [
    'url',
    'provider',
    'detail_state',
    'baseline_provider_metric_counts_available',
    'current_provider_metric_counts_available',
    'baseline_answer_provider_samples_available',
    'current_answer_provider_samples_available',
    'baseline_answer_observations',
    'current_answer_observations',
    'provider_sample_detail_state',
    'baseline_provider_observations',
    'current_provider_observations',
    'provider_observations_change',
    'baseline_provider_unique_prompts',
    'current_provider_unique_prompts',
    'provider_unique_prompts_change',
    'baseline_provider_incomplete_citation_list_observations',
    'current_provider_incomplete_citation_list_observations',
    'baseline_incomplete_citation_list_observations',
    'current_incomplete_citation_list_observations',
    'baseline_cited_pages',
    'current_cited_pages',
    'baseline_answer_citation_events',
    'current_answer_citation_events',
    'baseline_answer_citation_events_in_retained_pages',
    'current_answer_citation_events_in_retained_pages',
    'baseline_citation_event_detail_coverage_percent',
    'current_citation_event_detail_coverage_percent',
    'baseline_citation_events',
    'current_citation_events',
    'citation_events_change',
    'baseline_page_answer_pairs',
    'current_page_answer_pairs',
    'page_answer_pairs_change',
    'baseline_page_prompt_pairs',
    'current_page_prompt_pairs',
    'page_prompt_pairs_change',
    'baseline_join_state',
    'current_join_state',
    'baseline_join_method',
    'current_join_method',
    'baseline_ambiguous_audit_canonical',
    'current_ambiguous_audit_canonical',
    'baseline_answer_citation_pages_truncated',
    'current_answer_citation_pages_truncated',
  ];
  const rows = report.providerChanges.map((row) => {
    const sample = samplesByProvider.get(row.provider);
    return [
      row.url,
      row.provider,
      row.detailState,
      report.baselineProviderMetricCountsAvailable,
      report.currentProviderMetricCountsAvailable,
      report.baselineAnswerProviderSamplesAvailable,
      report.currentAnswerProviderSamplesAvailable,
      report.baselineAnswerObservations,
      report.currentAnswerObservations,
      sample?.detailState,
      sample?.baselineObservations,
      sample?.currentObservations,
      sample?.observationsChange,
      sample?.baselineUniquePrompts,
      sample?.currentUniquePrompts,
      sample?.uniquePromptsChange,
      sample?.baselineIncompleteCitationListObservations,
      sample?.currentIncompleteCitationListObservations,
      report.baselineIncompleteCitationListObservations,
      report.currentIncompleteCitationListObservations,
      report.baselineAnswerCitationSourcePages,
      report.currentAnswerCitationSourcePages,
      report.baselineAnswerCitationEvents,
      report.currentAnswerCitationEvents,
      report.baselineAnswerCitationEventsInRetainedPages,
      report.currentAnswerCitationEventsInRetainedPages,
      report.baselineAnswerCitationEventDetailCoveragePercent,
      report.currentAnswerCitationEventDetailCoveragePercent,
      row.baselineCitationEvents,
      row.currentCitationEvents,
      row.citationEventsChange,
      row.baselinePageAnswerPairs,
      row.currentPageAnswerPairs,
      row.pageAnswerPairsChange,
      row.baselinePagePromptPairs,
      row.currentPagePromptPairs,
      row.pagePromptPairsChange,
      row.baselineJoinState,
      row.currentJoinState,
      row.baselineJoinMethod,
      row.currentJoinMethod,
      row.baselineAmbiguousAuditCanonical,
      row.currentAmbiguousAuditCanonical,
      report.baselineAnswerCitationPagesTruncated,
      report.currentAnswerCitationPagesTruncated,
    ]
      .map(csvCell)
      .join(',');
  });
  return `${headers.join(',')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

/** Render a bounded, filterable offline view of period changes and sample coverage. */
export function renderGoogleAiCitationConcordanceComparisonHtml(
  report: GoogleAiCitationConcordanceComparisonReport
): string {
  const visibleRows = report.rows
    .slice(0, 2_000)
    .map(
      (row) =>
        `<tr data-transition="${htmlEscape(row.transition)}"><td>${htmlEscape(row.transition)}</td><td>${htmlEscape(row.baselineJoinMethod ?? '—')}</td><td>${htmlEscape(row.currentJoinMethod ?? '—')}</td><td><a href="${htmlEscape(row.url)}">${htmlEscape(row.url)}</a></td><td>${htmlEscape(row.baselineGoogleAiImpressions ?? '—')}</td><td>${htmlEscape(row.currentGoogleAiImpressions ?? '—')}</td><td>${htmlEscape(row.googleAiImpressionsChange ?? '—')}</td><td>${htmlEscape(row.baselineCitationEvents ?? '—')}</td><td>${htmlEscape(row.currentCitationEvents ?? '—')}</td><td>${htmlEscape(row.citationEventsChange ?? '—')}</td><td>${htmlEscape(row.baselineAmbiguousAuditCanonical === undefined ? '—' : row.baselineAmbiguousAuditCanonical ? 'yes' : 'no')}</td><td>${htmlEscape(row.currentAmbiguousAuditCanonical === undefined ? '—' : row.currentAmbiguousAuditCanonical ? 'yes' : 'no')}</td></tr>`
    )
    .join('');
  const visibleProviderRows = report.providerChanges
    .slice(0, 2_000)
    .map(
      (row) =>
        `<tr data-provider-row><td>${htmlEscape(row.detailState)}</td><td>${htmlEscape(row.provider)}</td><td><a href="${htmlEscape(row.url)}">${htmlEscape(row.url)}</a></td><td>${htmlEscape(row.baselineCitationEvents ?? '—')}</td><td>${htmlEscape(row.currentCitationEvents ?? '—')}</td><td>${htmlEscape(row.citationEventsChange ?? '—')}</td><td>${htmlEscape(row.baselinePageAnswerPairs ?? '—')}</td><td>${htmlEscape(row.currentPageAnswerPairs ?? '—')}</td><td>${htmlEscape(row.pageAnswerPairsChange ?? '—')}</td><td>${htmlEscape(row.baselinePagePromptPairs ?? '—')}</td><td>${htmlEscape(row.currentPagePromptPairs ?? '—')}</td><td>${htmlEscape(row.pagePromptPairsChange ?? '—')}</td></tr>`
    )
    .join('');
  const visibleProviderSampleRows = report.providerSampleChanges
    .slice(0, 2_000)
    .map(
      (row) =>
        `<tr data-provider-sample-row><td>${htmlEscape(row.detailState)}</td><td>${htmlEscape(row.provider)}</td><td>${htmlEscape(row.baselineObservations ?? '—')}</td><td>${htmlEscape(row.currentObservations ?? '—')}</td><td>${htmlEscape(row.observationsChange ?? '—')}</td><td>${htmlEscape(row.baselineUniquePrompts ?? '—')}</td><td>${htmlEscape(row.currentUniquePrompts ?? '—')}</td><td>${htmlEscape(row.uniquePromptsChange ?? '—')}</td><td>${htmlEscape(row.baselineCitationEvents ?? '—')}</td><td>${htmlEscape(row.currentCitationEvents ?? '—')}</td><td>${htmlEscape(row.citationEventsChange ?? '—')}</td><td>${htmlEscape(row.baselineIncompleteCitationListObservations ?? '—')}</td><td>${htmlEscape(row.currentIncompleteCitationListObservations ?? '—')}</td></tr>`
    )
    .join('');
  const warnings = [
    'Google AI impressions and answer citation observations have different sources and denominators; their changes are not a shared visibility score.',
    'Citation-event changes depend on the observed answer sample. Compare equivalent prompts, providers, sample sizes, and collection procedures where possible.',
    ...(!report.baselineProviderMetricCountsAvailable ||
    !report.currentProviderMetricCountsAvailable
      ? [
          'Per-provider citation counts were unavailable in at least one snapshot; one-sided provider detail is not a zero citation count.',
        ]
      : []),
    ...(report.baselineAnswerCitationPagesTruncated || report.currentAnswerCitationPagesTruncated
      ? [
          'At least one period truncated cited-page detail, so its page-level citation coverage is incomplete.',
        ]
      : []),
    ...((report.baselineIncompleteCitationListObservations ?? 0) > 0 ||
    (report.currentIncompleteCitationListObservations ?? 0) > 0
      ? ['At least one period contains answer observations with incomplete citation lists.']
      : []),
    ...(report.baselineAnswerObservations !== report.currentAnswerObservations
      ? ['The number of observed answers differs between periods.']
      : []),
    ...(report.rows.length > 2_000
      ? [
          `Showing the first 2,000 of ${report.rows.length.toLocaleString()} URLs; the JSON and CSV outputs retain all rows.`,
        ]
      : []),
    ...(report.providerChanges.length > 2_000
      ? [
          `Showing the first 2,000 of ${report.providerChanges.length.toLocaleString()} provider-page detail rows; the provider comparison CSV retains all rows.`,
        ]
      : []),
    ...(report.providerSampleChanges.length > 2_000
      ? [
          `Showing the first 2,000 of ${report.providerSampleChanges.length.toLocaleString()} provider sample rows; the JSON and provider comparison CSV retain all rows.`,
        ]
      : []),
  ];
  const metric = (value: number | null, suffix = '') =>
    value === null ? '—' : `${value.toLocaleString()}${suffix}`;
  const shareChange =
    report.matchedImpressionShareChangePercentagePoints === null
      ? '—'
      : `${report.matchedImpressionShareChangePercentagePoints.toLocaleString()} pp`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google AI citation concordance comparison</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f3f6fa;color:#132238}.wrap{max-width:1400px;margin:auto;padding:32px 20px}h1{margin:0 0 8px}.muted{color:#53657a}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:24px 0}.card,section{background:#fff;border:1px solid #dce4ec;border-radius:12px;padding:16px}.card strong{display:block;font-size:25px}.warnings{background:#fff8e8;border-color:#f1d28a;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;border-bottom:1px solid #e7edf3;padding:10px 8px;vertical-align:top}th{position:sticky;top:0;background:#f7f9fc}td a{overflow-wrap:anywhere;color:#2256a1}.table{overflow:auto;max-height:70vh}input,select{padding:7px;margin:4px 8px 4px 0}</style></head>
<body><main class="wrap"><h1>Google AI citation concordance comparison</h1><p class="muted">${htmlEscape(report.googleAiSurface)} URL changes between ${htmlEscape(report.baselineGoogleAiSourceFile ?? 'saved baseline')} and ${htmlEscape(report.currentGoogleAiSourceFile ?? 'current snapshot')}.</p>
<section class="warnings"><strong>Interpretation and coverage</strong><ul>${warnings.map((warning) => `<li>${htmlEscape(warning)}</li>`).join('')}</ul><p>${htmlEscape(report.note)}</p><p>Observed answers: ${report.baselineAnswerObservations.toLocaleString()} baseline, ${report.currentAnswerObservations.toLocaleString()} current. Cited pages: ${report.baselineAnswerCitationSourcePages.toLocaleString()} baseline, ${report.currentAnswerCitationSourcePages.toLocaleString()} current. Incomplete citation-list observations: ${metric(report.baselineIncompleteCitationListObservations)} baseline, ${metric(report.currentIncompleteCitationListObservations)} current. Citation events represented by retained page details: ${metric(report.baselineAnswerCitationEventDetailCoveragePercent, '%')} baseline, ${metric(report.currentAnswerCitationEventDetailCoveragePercent, '%')} current.</p></section>
<div class="cards"><div class="card"><span class="muted">Matched pages</span><strong>${metric(report.baselineMatchedPages)} → ${metric(report.currentMatchedPages)}</strong></div><div class="card"><span class="muted">Matched Google AI impression share</span><strong>${metric(report.baselineMatchedImpressionSharePercent, '%')} → ${metric(report.currentMatchedImpressionSharePercent, '%')}</strong><span>${shareChange}</span></div><div class="card"><span class="muted">Matched citation events</span><strong>${metric(report.baselineMatchedCitationEvents)} → ${metric(report.currentMatchedCitationEvents)}</strong></div><div class="card"><span class="muted">Newly matched / lost match</span><strong>${report.newlyMatchedPages.toLocaleString()} / ${report.lostMatchPages.toLocaleString()}</strong></div><div class="card"><span class="muted">Appeared / disappeared URLs</span><strong>${report.appearedPages.toLocaleString()} / ${report.disappearedPages.toLocaleString()}</strong></div></div>
<section><h2>Page transitions</h2><p><label for="query">Filter URL </label><input id="query" type="search" autocomplete="off"><label for="transition">Transition </label><select id="transition"><option value="">All</option><option>matched-both</option><option>newly-matched</option><option>lost-match</option><option>appeared</option><option>disappeared</option><option>unchanged-unmatched</option><option>changed-unmatched</option></select></p><div class="table"><table><thead><tr><th>Transition</th><th>Baseline join</th><th>Current join</th><th>URL</th><th>Baseline impressions</th><th>Current impressions</th><th>Change</th><th>Baseline citation events</th><th>Current citation events</th><th>Change</th><th>Baseline canonical ambiguous</th><th>Current canonical ambiguous</th></tr></thead><tbody id="pages">${visibleRows || '<tr><td colspan="12">No URL transitions are available.</td></tr>'}</tbody></table></div><p id="visible-count" class="muted" aria-live="polite"></p></section>
<section><h2>Provider by page</h2><p class="muted">One-sided detail means a provider/page count was retained in only one report. It is not a measured zero. Use the CSV for all retained provider-page rows.</p><p><label for="provider-query">Filter provider or URL </label><input id="provider-query" type="search" autocomplete="off"></p><div class="table"><table><thead><tr><th>Detail state</th><th>Provider</th><th>URL</th><th>Baseline citations</th><th>Current citations</th><th>Change</th><th>Baseline page-answer pairs</th><th>Current page-answer pairs</th><th>Change</th><th>Baseline page-prompt pairs</th><th>Current page-prompt pairs</th><th>Change</th></tr></thead><tbody id="provider-pages">${visibleProviderRows || '<tr><td colspan="12">No per-provider page details were retained in either report.</td></tr>'}</tbody></table></div><p id="provider-visible-count" class="muted" aria-live="polite"></p></section>
<section><h2>Provider sample support</h2><p class="muted">Observation, unique-prompt, and citation-event totals describe the supplied answer sample. Incomplete-list counts affect absence interpretation. A one-sided profile means sample detail was retained in one report only; it is not a zero. These totals do not standardize prompt mix.</p><div class="table"><table><thead><tr><th>Detail state</th><th>Provider</th><th>Baseline observations</th><th>Current observations</th><th>Change</th><th>Baseline unique prompts</th><th>Current unique prompts</th><th>Change</th><th>Baseline citation events</th><th>Current citation events</th><th>Change</th><th>Baseline incomplete lists</th><th>Current incomplete lists</th></tr></thead><tbody>${visibleProviderSampleRows || '<tr><td colspan="13">Provider sample profiles are unavailable in one or both snapshots, or no provider observations were retained.</td></tr>'}</tbody></table></div></section>
<script>(()=>{const q=document.getElementById('query'),s=document.getElementById('transition'),body=document.getElementById('pages'),count=document.getElementById('visible-count'),pq=document.getElementById('provider-query'),pbody=document.getElementById('provider-pages'),pcount=document.getElementById('provider-visible-count');if(q&&s&&body&&count){const apply=()=>{let n=0;for(const row of body.querySelectorAll('tr[data-transition]')){const visible=(!s.value||row.dataset.transition===s.value)&&row.textContent.toLowerCase().includes(q.value.trim().toLowerCase());row.hidden=!visible;if(visible)n+=1}count.textContent=n+' page rows shown'};q.addEventListener('input',apply);s.addEventListener('change',apply);apply()}if(pq&&pbody&&pcount){const applyProviders=()=>{let n=0;for(const row of pbody.querySelectorAll('tr[data-provider-row]')){const visible=row.textContent.toLowerCase().includes(pq.value.trim().toLowerCase());row.hidden=!visible;if(visible)n+=1}pcount.textContent=n+' provider-page rows shown'};pq.addEventListener('input',applyProviders);applyProviders()}})();</script>
</main></body></html>`;
}
