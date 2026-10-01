import type {
  AiCrawlerAccessLogAnalysis,
  AiCrawlerCloudFrontResultProfile,
  AiCrawlerCloudFrontResultType,
  AiCrawlerLogPath,
  AiCrawlerLogSummary,
  AiCrawlerTimingBand,
  AiCrawlerTimingDistribution,
  AiReferralTrafficSummary,
  AiReferralUtmSourceCoverage,
} from './aiCrawlerLogs';

export type AiCrawlerLogPeriodPathChange =
  | 'current-only-retained'
  | 'baseline-only-retained'
  | 'failure-emerged'
  | 'failure-cleared'
  | 'response-class-shift'
  | 'status-code-set-shift'
  | 'media-type-set-shift'
  | 'request-share-shift';

export interface AiCrawlerLogPeriodPathProfile {
  requests: number;
  failureRequests: number;
  requestSharePercent: number;
  failureRatePercent: number;
  responseClassSharesPercent: {
    successful2xx: number;
    redirects3xx: number;
    clientErrors4xx: number;
    serverErrors5xx: number;
    other: number;
  };
  statusCodes: number[];
  statusCodesTruncated: boolean;
  responseContentTypes: string[];
  responseContentTypesTruncated: boolean;
  lastSeenAt?: string;
}

export interface AiCrawlerLogPeriodPathChangeObservation {
  path: string;
  change: AiCrawlerLogPeriodPathChange;
  baseline?: AiCrawlerLogPeriodPathProfile;
  current?: AiCrawlerLogPeriodPathProfile;
  failureRateDeltaPercentagePoints: number | null;
  requestShareDeltaPercentagePoints: number | null;
}

export interface AiCrawlerLogTimingMetricComparison {
  baselineSamples: number | null;
  currentSamples: number | null;
  baselineP95Band: AiCrawlerTimingBand | null;
  currentP95Band: AiCrawlerTimingBand | null;
  change: 'faster' | 'same' | 'slower' | 'not-comparable';
}

export interface AiCrawlerLogTimingComparison {
  minimumComparableSamplesPerPeriod: number;
  responseDuration: AiCrawlerLogTimingMetricComparison;
  timeToFirstByte: AiCrawlerLogTimingMetricComparison;
}

export interface AiCrawlerCloudFrontResultTypePeriodComparison {
  resultType: AiCrawlerCloudFrontResultType;
  baselineRequests: number | null;
  currentRequests: number | null;
  baselineSharePercent: number | null;
  currentSharePercent: number | null;
  shareDeltaPercentagePoints: number | null;
}

export interface AiCrawlerCloudFrontResultPeriodComparison {
  comparisonAvailable: boolean;
  baselineRequestsWithResultType: number | null;
  currentRequestsWithResultType: number | null;
  baselineRequestsWithResponseResultType: number | null;
  currentRequestsWithResponseResultType: number | null;
  baselinePairedRequests: number | null;
  currentPairedRequests: number | null;
  baselineDifferingResultTypes: number | null;
  currentDifferingResultTypes: number | null;
  baselineDifferenceSharePercent: number | null;
  currentDifferenceSharePercent: number | null;
  differenceShareDeltaPercentagePoints: number | null;
  resultTypes: AiCrawlerCloudFrontResultTypePeriodComparison[];
  responseResultTypes: AiCrawlerCloudFrontResultTypePeriodComparison[];
}

export interface AiCrawlerLogPeriodCrawlerComparison {
  token: string;
  provider: string;
  activity: AiCrawlerLogSummary['activity'];
  baselineRequests: number;
  currentRequests: number;
  requestDelta: number;
  requestChangePercent: number | null;
  baselineFailureRatePercent: number;
  currentFailureRatePercent: number;
  failureRateDeltaPercentagePoints: number;
  baselineUniquePaths: number;
  currentUniquePaths: number;
  sharedRetainedPathsCompared: number;
  pathsOnlyInCurrentRetainedList: number;
  pathsOnlyInBaselineRetainedList: number;
  sharedPathsWithResponseClassShift: number;
  sharedPathsWithNewFailures: number;
  sharedPathsWithResolvedFailures: number;
  sharedPathsWithFailureRateIncrease: number;
  sharedPathsWithFailureRateDecrease: number;
  sharedPathsWithStatusCodeSetShift: number;
  sharedPathsWithMediaTypeSetShift: number;
  timing: AiCrawlerLogTimingComparison;
  cloudFrontResults: AiCrawlerCloudFrontResultPeriodComparison;
  baselineCloudflareBotFieldRequests: number | null;
  currentCloudflareBotFieldRequests: number | null;
  baselineCloudflareVerifiedBotRequests: number | null;
  currentCloudflareVerifiedBotRequests: number | null;
  baselineCloudflareSecurityActionRequests: number | null;
  currentCloudflareSecurityActionRequests: number | null;
  baselineCloudflareBlockingRequests: number | null;
  currentCloudflareBlockingRequests: number | null;
  baselineCloudflareChallengeRequests: number | null;
  currentCloudflareChallengeRequests: number | null;
  baselineSample: { sourceFile?: string; firstSeenAt?: string; lastSeenAt?: string };
  currentSample: { sourceFile?: string; firstSeenAt?: string; lastSeenAt?: string };
  inputPathsTruncated: boolean;
  pathChanges: AiCrawlerLogPeriodPathChangeObservation[];
  pathChangesTruncated: boolean;
}

export interface AiReferralTrafficPeriodComparison {
  source: string;
  comparisonAvailable: boolean;
  baselineRequests: number | null;
  currentRequests: number | null;
  requestDelta: number | null;
  requestChangePercent: number | null;
  baselineFailureRequests: number | null;
  currentFailureRequests: number | null;
  baselineFailureRatePercent: number | null;
  currentFailureRatePercent: number | null;
  failureRateDeltaPercentagePoints: number | null;
  baselineUniquePaths: number | null;
  currentUniquePaths: number | null;
  baselinePathsTruncated: boolean | null;
  currentPathsTruncated: boolean | null;
  pathsOnlyInCurrentRetainedList: number;
  pathsOnlyInBaselineRetainedList: number;
  pathsWithNewFailures: number;
  pathsWithResolvedFailures: number;
  pathChanges: AiCrawlerLogPeriodPathChangeObservation[];
  pathChangesTruncated: boolean;
}

export interface AiReferralUtmSourceCoveragePeriodComparison {
  comparisonAvailable: boolean;
  baseline: AiReferralUtmSourceCoverage | null;
  current: AiReferralUtmSourceCoverage | null;
}

export interface AiCrawlerLogPeriodComparison {
  source: 'Aviary AI crawler log period comparison';
  schemaVersion: 1;
  baselineUniquePathsAcrossRecognizedBots: number;
  currentUniquePathsAcrossRecognizedBots: number;
  crawlers: AiCrawlerLogPeriodCrawlerComparison[];
  aiReferralSources: AiReferralTrafficPeriodComparison[];
  utmSourceAttributionCoverage?: AiReferralUtmSourceCoveragePeriodComparison;
  note: string;
}

const MAX_RETURNED_PATH_CHANGES = 100;
const MIN_COMPARABLE_TIMING_SAMPLES = 20;
const TIMING_BAND_ORDER: AiCrawlerTimingBand[] = [
  '<=50ms',
  '51-100ms',
  '101-250ms',
  '251-500ms',
  '501-1000ms',
  '1001-2500ms',
  '2501-5000ms',
  '>5000ms',
];
const CLOUDFRONT_RESULT_TYPES: AiCrawlerCloudFrontResultType[] = [
  'Hit',
  'RefreshHit',
  'Miss',
  'LimitExceeded',
  'CapacityExceeded',
  'Error',
  'Other',
];

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function normalizeCloudFrontResultProfile(
  value: unknown
): AiCrawlerCloudFrontResultProfile | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const profile = value as Record<string, unknown>;
  const requestsWithResultType = profile.requestsWithResultType;
  const requestsWithResponseResultType = profile.requestsWithResponseResultType;
  const pairedRequests = profile.pairedRequests;
  const differingResultTypes = profile.differingResultTypes;
  if (
    !validCount(requestsWithResultType) ||
    !validCount(requestsWithResponseResultType) ||
    !validCount(pairedRequests) ||
    !validCount(differingResultTypes) ||
    !Array.isArray(profile.resultTypes) ||
    !Array.isArray(profile.responseResultTypes) ||
    profile.resultTypes.length > CLOUDFRONT_RESULT_TYPES.length ||
    profile.responseResultTypes.length > CLOUDFRONT_RESULT_TYPES.length
  )
    return undefined;
  const parseRows = (
    valueRows: unknown,
    expectedTotal: number
  ): AiCrawlerCloudFrontResultProfile['resultTypes'] | undefined => {
    if (!Array.isArray(valueRows)) return undefined;
    const seen = new Set<AiCrawlerCloudFrontResultType>();
    const rows: AiCrawlerCloudFrontResultProfile['resultTypes'] = [];
    let total = 0;
    for (const rawRow of valueRows) {
      if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) return undefined;
      const row = rawRow as Record<string, unknown>;
      if (
        typeof row.resultType !== 'string' ||
        !CLOUDFRONT_RESULT_TYPES.includes(row.resultType as AiCrawlerCloudFrontResultType) ||
        !validCount(row.requests) ||
        row.requests === 0 ||
        seen.has(row.resultType as AiCrawlerCloudFrontResultType)
      )
        return undefined;
      total += row.requests;
      if (!Number.isSafeInteger(total)) return undefined;
      seen.add(row.resultType as AiCrawlerCloudFrontResultType);
      rows.push({
        resultType: row.resultType as AiCrawlerCloudFrontResultType,
        requests: row.requests,
      });
    }
    return total === expectedTotal ? rows : undefined;
  };
  const resultTypes = parseRows(profile.resultTypes, requestsWithResultType);
  const responseResultTypes = parseRows(
    profile.responseResultTypes,
    requestsWithResponseResultType
  );
  if (
    !resultTypes ||
    !responseResultTypes ||
    differingResultTypes > pairedRequests ||
    pairedRequests > Math.min(requestsWithResultType, requestsWithResponseResultType) ||
    (pairedRequests === 0 && differingResultTypes !== 0)
  )
    return undefined;
  return {
    requestsWithResultType,
    resultTypes,
    requestsWithResponseResultType,
    responseResultTypes,
    pairedRequests,
    differingResultTypes,
  };
}

function compareTimingMetric(
  baseline: AiCrawlerTimingDistribution | undefined,
  current: AiCrawlerTimingDistribution | undefined
): AiCrawlerLogTimingMetricComparison {
  const validSampleCount = (value: unknown): number | null =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const validBand = (value: unknown): value is AiCrawlerTimingBand =>
    typeof value === 'string' && TIMING_BAND_ORDER.includes(value as AiCrawlerTimingBand);
  const baselineSamples = validSampleCount(baseline?.sampledRequests);
  const currentSamples = validSampleCount(current?.sampledRequests);
  const baselineP95Band = validBand(baseline?.p95Band) ? baseline.p95Band : null;
  const currentP95Band = validBand(current?.p95Band) ? current.p95Band : null;
  const comparable =
    (baselineSamples ?? 0) >= MIN_COMPARABLE_TIMING_SAMPLES &&
    (currentSamples ?? 0) >= MIN_COMPARABLE_TIMING_SAMPLES &&
    baselineP95Band !== null &&
    currentP95Band !== null;
  const baselineRank = baselineP95Band === null ? -1 : TIMING_BAND_ORDER.indexOf(baselineP95Band);
  const currentRank = currentP95Band === null ? -1 : TIMING_BAND_ORDER.indexOf(currentP95Band);
  return {
    baselineSamples,
    currentSamples,
    baselineP95Band,
    currentP95Band,
    change: !comparable
      ? 'not-comparable'
      : currentRank > baselineRank
        ? 'slower'
        : currentRank < baselineRank
          ? 'faster'
          : 'same',
  };
}

function compareCloudFrontResultTypes(
  baseline: AiCrawlerCloudFrontResultProfile | undefined,
  current: AiCrawlerCloudFrontResultProfile | undefined,
  field: 'resultTypes' | 'responseResultTypes',
  countField: 'requestsWithResultType' | 'requestsWithResponseResultType'
): AiCrawlerCloudFrontResultTypePeriodComparison[] {
  const baselineTotal = baseline?.[countField] ?? null;
  const currentTotal = current?.[countField] ?? null;
  const baselineCounts = new Map(
    (baseline?.[field] ?? []).map(({ resultType, requests }) => [resultType, requests])
  );
  const currentCounts = new Map(
    (current?.[field] ?? []).map(({ resultType, requests }) => [resultType, requests])
  );
  return CLOUDFRONT_RESULT_TYPES.map((resultType) => {
    const baselineRequests = baselineTotal === null ? null : (baselineCounts.get(resultType) ?? 0);
    const currentRequests = currentTotal === null ? null : (currentCounts.get(resultType) ?? 0);
    const baselineSharePercent =
      baselineTotal && baselineRequests !== null
        ? roundedPercent(baselineRequests, baselineTotal)
        : null;
    const currentSharePercent =
      currentTotal && currentRequests !== null
        ? roundedPercent(currentRequests, currentTotal)
        : null;
    return {
      resultType,
      baselineRequests,
      currentRequests,
      baselineSharePercent,
      currentSharePercent,
      shareDeltaPercentagePoints:
        baselineSharePercent !== null && currentSharePercent !== null
          ? Number((currentSharePercent - baselineSharePercent).toFixed(1))
          : null,
    };
  });
}

function compareCloudFrontResults(
  baseline: AiCrawlerCloudFrontResultProfile | undefined,
  current: AiCrawlerCloudFrontResultProfile | undefined
): AiCrawlerCloudFrontResultPeriodComparison {
  const resultTypes = compareCloudFrontResultTypes(
    baseline,
    current,
    'resultTypes',
    'requestsWithResultType'
  );
  const responseResultTypes = compareCloudFrontResultTypes(
    baseline,
    current,
    'responseResultTypes',
    'requestsWithResponseResultType'
  );
  const baselinePairedRequests = baseline?.pairedRequests ?? null;
  const currentPairedRequests = current?.pairedRequests ?? null;
  const baselineDifferingResultTypes = baseline?.differingResultTypes ?? null;
  const currentDifferingResultTypes = current?.differingResultTypes ?? null;
  const baselineDifferenceSharePercent =
    baselinePairedRequests !== null &&
    baselinePairedRequests > 0 &&
    baselineDifferingResultTypes !== null
      ? roundedPercent(baselineDifferingResultTypes, baselinePairedRequests)
      : null;
  const currentDifferenceSharePercent =
    currentPairedRequests !== null &&
    currentPairedRequests > 0 &&
    currentDifferingResultTypes !== null
      ? roundedPercent(currentDifferingResultTypes, currentPairedRequests)
      : null;
  const hasComparableDistribution =
    resultTypes.some((item) => item.shareDeltaPercentagePoints !== null) ||
    responseResultTypes.some((item) => item.shareDeltaPercentagePoints !== null);
  return {
    comparisonAvailable:
      hasComparableDistribution ||
      (baselineDifferenceSharePercent !== null && currentDifferenceSharePercent !== null),
    baselineRequestsWithResultType: baseline?.requestsWithResultType ?? null,
    currentRequestsWithResultType: current?.requestsWithResultType ?? null,
    baselineRequestsWithResponseResultType: baseline?.requestsWithResponseResultType ?? null,
    currentRequestsWithResponseResultType: current?.requestsWithResponseResultType ?? null,
    baselinePairedRequests,
    currentPairedRequests,
    baselineDifferingResultTypes,
    currentDifferingResultTypes,
    baselineDifferenceSharePercent,
    currentDifferenceSharePercent,
    differenceShareDeltaPercentagePoints:
      baselineDifferenceSharePercent !== null && currentDifferenceSharePercent !== null
        ? Number((currentDifferenceSharePercent - baselineDifferenceSharePercent).toFixed(1))
        : null,
    resultTypes,
    responseResultTypes,
  };
}

function roundedPercent(numerator: number, denominator: number): number {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function failureRate(summary: AiCrawlerLogSummary): number {
  if (Number.isFinite(summary.failureRatePercent)) return summary.failureRatePercent;
  const failures =
    summary.responseClasses.clientErrors4xx + summary.responseClasses.serverErrors5xx;
  return roundedPercent(failures, summary.requests);
}

function sampleProfile(
  summary: AiCrawlerLogSummary,
  path: AiCrawlerLogPath
): AiCrawlerLogPeriodPathProfile {
  return {
    requests: path.requests,
    failureRequests: path.clientErrors + path.serverErrors,
    requestSharePercent: roundedPercent(path.requests, summary.requests),
    failureRatePercent: roundedPercent(path.clientErrors + path.serverErrors, path.requests),
    responseClassSharesPercent: {
      successful2xx: roundedPercent(path.successfulResponses, path.requests),
      redirects3xx: roundedPercent(path.redirects, path.requests),
      clientErrors4xx: roundedPercent(path.clientErrors, path.requests),
      serverErrors5xx: roundedPercent(path.serverErrors, path.requests),
      other: roundedPercent(path.otherResponses, path.requests),
    },
    statusCodes: (path.statusCodes ?? [])
      .map(({ status }) => status)
      .sort((left, right) => left - right),
    statusCodesTruncated: path.statusCodesTruncated ?? false,
    responseContentTypes: (path.responseContentTypes ?? [])
      .map(({ contentType }) => contentType)
      .sort(),
    responseContentTypesTruncated: path.responseContentTypesTruncated ?? false,
    ...(path.lastSeenAt ? { lastSeenAt: path.lastSeenAt } : {}),
  };
}

function sampleReferralProfile(
  summary: AiReferralTrafficSummary,
  path: AiReferralTrafficSummary['paths'][number]
): AiCrawlerLogPeriodPathProfile {
  return {
    requests: path.requests,
    failureRequests: path.responseClasses.clientErrors4xx + path.responseClasses.serverErrors5xx,
    requestSharePercent: roundedPercent(path.requests, summary.requests),
    failureRatePercent: roundedPercent(
      path.responseClasses.clientErrors4xx + path.responseClasses.serverErrors5xx,
      path.requests
    ),
    responseClassSharesPercent: {
      successful2xx: roundedPercent(path.responseClasses.successful2xx, path.requests),
      redirects3xx: roundedPercent(path.responseClasses.redirects3xx, path.requests),
      clientErrors4xx: roundedPercent(path.responseClasses.clientErrors4xx, path.requests),
      serverErrors5xx: roundedPercent(path.responseClasses.serverErrors5xx, path.requests),
      other: roundedPercent(path.responseClasses.other, path.requests),
    },
    statusCodes: path.statusCodes.map(({ status }) => status).sort((left, right) => left - right),
    statusCodesTruncated: path.statusCodesTruncated,
    responseContentTypes: path.responseContentTypes.map(({ contentType }) => contentType).sort(),
    responseContentTypesTruncated: path.responseContentTypesTruncated,
    ...(path.lastSeenAt ? { lastSeenAt: path.lastSeenAt } : {}),
  };
}

function sameNumberProfile(
  left: AiCrawlerLogPeriodPathProfile['responseClassSharesPercent'],
  right: AiCrawlerLogPeriodPathProfile['responseClassSharesPercent']
): boolean {
  return (
    left.successful2xx === right.successful2xx &&
    left.redirects3xx === right.redirects3xx &&
    left.clientErrors4xx === right.clientErrors4xx &&
    left.serverErrors5xx === right.serverErrors5xx &&
    left.other === right.other
  );
}

function sameArray<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function selectPathChange(
  baseline: AiCrawlerLogPeriodPathProfile | undefined,
  current: AiCrawlerLogPeriodPathProfile | undefined
): AiCrawlerLogPeriodPathChange | undefined {
  if (!baseline && current) return 'current-only-retained';
  if (baseline && !current) return 'baseline-only-retained';
  if (!baseline || !current) return undefined;
  if (baseline.failureRequests === 0 && current.failureRequests > 0) return 'failure-emerged';
  if (baseline.failureRequests > 0 && current.failureRequests === 0) return 'failure-cleared';
  if (!sameNumberProfile(baseline.responseClassSharesPercent, current.responseClassSharesPercent))
    return 'response-class-shift';
  if (!sameArray(baseline.statusCodes, current.statusCodes)) return 'status-code-set-shift';
  if (!sameArray(baseline.responseContentTypes, current.responseContentTypes))
    return 'media-type-set-shift';
  if (current.requestSharePercent !== baseline.requestSharePercent) return 'request-share-shift';
  return undefined;
}

function compareCrawler(
  baseline: AiCrawlerLogSummary,
  current: AiCrawlerLogSummary,
  samples: {
    hasBaseline: boolean;
    hasCurrent: boolean;
    baselineSourceFile?: string;
    currentSourceFile?: string;
  }
): AiCrawlerLogPeriodCrawlerComparison {
  const baselineByPath = new Map(baseline.paths.map((path) => [path.path, path]));
  const currentByPath = new Map(current.paths.map((path) => [path.path, path]));
  const pathNames = [...new Set([...baselineByPath.keys(), ...currentByPath.keys()])].sort();
  let sharedRetainedPathsCompared = 0;
  let pathsOnlyInCurrentRetainedList = 0;
  let pathsOnlyInBaselineRetainedList = 0;
  let sharedPathsWithResponseClassShift = 0;
  let sharedPathsWithNewFailures = 0;
  let sharedPathsWithResolvedFailures = 0;
  let sharedPathsWithFailureRateIncrease = 0;
  let sharedPathsWithFailureRateDecrease = 0;
  let sharedPathsWithStatusCodeSetShift = 0;
  let sharedPathsWithMediaTypeSetShift = 0;
  const pathChanges: AiCrawlerLogPeriodPathChangeObservation[] = [];

  for (const path of pathNames) {
    const baselinePath = baselineByPath.get(path);
    const currentPath = currentByPath.get(path);
    const baselineProfile = baselinePath ? sampleProfile(baseline, baselinePath) : undefined;
    const currentProfile = currentPath ? sampleProfile(current, currentPath) : undefined;
    const change = selectPathChange(baselineProfile, currentProfile);
    const failureRateDeltaPercentagePoints =
      baselineProfile && currentProfile
        ? Number(
            (currentProfile.failureRatePercent - baselineProfile.failureRatePercent).toFixed(1)
          )
        : null;
    const requestShareDeltaPercentagePoints =
      baselineProfile && currentProfile
        ? Number(
            (currentProfile.requestSharePercent - baselineProfile.requestSharePercent).toFixed(1)
          )
        : null;

    if (!baselineProfile && currentProfile) pathsOnlyInCurrentRetainedList += 1;
    else if (baselineProfile && !currentProfile) pathsOnlyInBaselineRetainedList += 1;
    else if (baselineProfile && currentProfile) {
      sharedRetainedPathsCompared += 1;
      if (
        !sameNumberProfile(
          baselineProfile.responseClassSharesPercent,
          currentProfile.responseClassSharesPercent
        )
      )
        sharedPathsWithResponseClassShift += 1;
      if (baselineProfile.failureRequests === 0 && currentProfile.failureRequests > 0)
        sharedPathsWithNewFailures += 1;
      if (baselineProfile.failureRequests > 0 && currentProfile.failureRequests === 0)
        sharedPathsWithResolvedFailures += 1;
      if (
        currentProfile.failureRequests * baselineProfile.requests >
        baselineProfile.failureRequests * currentProfile.requests
      )
        sharedPathsWithFailureRateIncrease += 1;
      if (
        currentProfile.failureRequests * baselineProfile.requests <
        baselineProfile.failureRequests * currentProfile.requests
      )
        sharedPathsWithFailureRateDecrease += 1;
      if (!sameArray(baselineProfile.statusCodes, currentProfile.statusCodes))
        sharedPathsWithStatusCodeSetShift += 1;
      if (!sameArray(baselineProfile.responseContentTypes, currentProfile.responseContentTypes))
        sharedPathsWithMediaTypeSetShift += 1;
    }
    if (change) {
      pathChanges.push({
        path,
        change,
        ...(baselineProfile ? { baseline: baselineProfile } : {}),
        ...(currentProfile ? { current: currentProfile } : {}),
        failureRateDeltaPercentagePoints,
        requestShareDeltaPercentagePoints,
      });
    }
  }

  const changePriority: Record<AiCrawlerLogPeriodPathChange, number> = {
    'failure-emerged': 0,
    'failure-cleared': 1,
    'current-only-retained': 2,
    'baseline-only-retained': 3,
    'response-class-shift': 4,
    'status-code-set-shift': 5,
    'media-type-set-shift': 6,
    'request-share-shift': 7,
  };
  pathChanges.sort(
    (left, right) =>
      changePriority[left.change] - changePriority[right.change] ||
      Math.abs(right.failureRateDeltaPercentagePoints ?? 0) -
        Math.abs(left.failureRateDeltaPercentagePoints ?? 0) ||
      Math.abs(right.requestShareDeltaPercentagePoints ?? 0) -
        Math.abs(left.requestShareDeltaPercentagePoints ?? 0) ||
      left.path.localeCompare(right.path)
  );

  const requestDelta = current.requests - baseline.requests;
  return {
    token: current.token,
    provider: current.provider,
    activity: current.activity,
    baselineRequests: baseline.requests,
    currentRequests: current.requests,
    requestDelta,
    requestChangePercent:
      baseline.requests > 0 ? Number(((requestDelta / baseline.requests) * 100).toFixed(1)) : null,
    baselineFailureRatePercent: failureRate(baseline),
    currentFailureRatePercent: failureRate(current),
    failureRateDeltaPercentagePoints: Number(
      (failureRate(current) - failureRate(baseline)).toFixed(1)
    ),
    baselineUniquePaths: baseline.uniquePaths,
    currentUniquePaths: current.uniquePaths,
    sharedRetainedPathsCompared,
    pathsOnlyInCurrentRetainedList,
    pathsOnlyInBaselineRetainedList,
    sharedPathsWithResponseClassShift,
    sharedPathsWithNewFailures,
    sharedPathsWithResolvedFailures,
    sharedPathsWithFailureRateIncrease,
    sharedPathsWithFailureRateDecrease,
    sharedPathsWithStatusCodeSetShift,
    sharedPathsWithMediaTypeSetShift,
    timing: {
      minimumComparableSamplesPerPeriod: MIN_COMPARABLE_TIMING_SAMPLES,
      responseDuration: compareTimingMetric(
        baseline.responseTiming?.responseDuration,
        current.responseTiming?.responseDuration
      ),
      timeToFirstByte: compareTimingMetric(
        baseline.responseTiming?.timeToFirstByte,
        current.responseTiming?.timeToFirstByte
      ),
    },
    cloudFrontResults: compareCloudFrontResults(
      normalizeCloudFrontResultProfile(baseline.cloudFrontResultProfile),
      normalizeCloudFrontResultProfile(current.cloudFrontResultProfile)
    ),
    baselineCloudflareBotFieldRequests:
      baseline.cloudflareBotEvidence?.requestsWithCloudflareBotFields ?? null,
    currentCloudflareBotFieldRequests:
      current.cloudflareBotEvidence?.requestsWithCloudflareBotFields ?? null,
    baselineCloudflareVerifiedBotRequests:
      baseline.cloudflareBotEvidence?.verifiedBotRequests ?? null,
    currentCloudflareVerifiedBotRequests:
      current.cloudflareBotEvidence?.verifiedBotRequests ?? null,
    baselineCloudflareSecurityActionRequests:
      baseline.cloudflareSecurityActions?.requestsWithSecurityActions ?? null,
    currentCloudflareSecurityActionRequests:
      current.cloudflareSecurityActions?.requestsWithSecurityActions ?? null,
    baselineCloudflareBlockingRequests:
      baseline.cloudflareSecurityActions?.blockingRequests ?? null,
    currentCloudflareBlockingRequests: current.cloudflareSecurityActions?.blockingRequests ?? null,
    baselineCloudflareChallengeRequests:
      baseline.cloudflareSecurityActions?.challengeRequests ?? null,
    currentCloudflareChallengeRequests:
      current.cloudflareSecurityActions?.challengeRequests ?? null,
    baselineSample: {
      ...(samples.baselineSourceFile ? { sourceFile: samples.baselineSourceFile } : {}),
      ...(samples.hasBaseline && baseline.firstSeenAt ? { firstSeenAt: baseline.firstSeenAt } : {}),
      ...(samples.hasBaseline && baseline.lastSeenAt ? { lastSeenAt: baseline.lastSeenAt } : {}),
    },
    currentSample: {
      ...(samples.currentSourceFile ? { sourceFile: samples.currentSourceFile } : {}),
      ...(samples.hasCurrent && current.firstSeenAt ? { firstSeenAt: current.firstSeenAt } : {}),
      ...(samples.hasCurrent && current.lastSeenAt ? { lastSeenAt: current.lastSeenAt } : {}),
    },
    inputPathsTruncated: baseline.pathsTruncated || current.pathsTruncated,
    pathChanges: pathChanges.slice(0, MAX_RETURNED_PATH_CHANGES),
    pathChangesTruncated: pathChanges.length > MAX_RETURNED_PATH_CHANGES,
  };
}

function referralFailureRate(summary: AiReferralTrafficSummary | undefined): number | null {
  if (!summary) return null;
  const failures =
    summary.responseClasses.clientErrors4xx + summary.responseClasses.serverErrors5xx;
  return roundedPercent(failures, summary.requests);
}

function referralFailureRequests(summary: AiReferralTrafficSummary | undefined): number | null {
  if (!summary) return null;
  return summary.responseClasses.clientErrors4xx + summary.responseClasses.serverErrors5xx;
}

function compareReferralTraffic(
  baseline: AiReferralTrafficSummary | undefined,
  current: AiReferralTrafficSummary | undefined
): AiReferralTrafficPeriodComparison {
  const hasComparableSamples = Boolean(baseline && current);
  let pathsOnlyInCurrentRetainedList = 0;
  let pathsOnlyInBaselineRetainedList = 0;
  let pathsWithNewFailures = 0;
  let pathsWithResolvedFailures = 0;
  const pathChanges: AiCrawlerLogPeriodPathChangeObservation[] = [];

  if (hasComparableSamples && baseline && current) {
    const baselineByPath = new Map(baseline.paths.map((path) => [path.path, path]));
    const currentByPath = new Map(current.paths.map((path) => [path.path, path]));
    for (const pathname of [
      ...new Set([...baselineByPath.keys(), ...currentByPath.keys()]),
    ].sort()) {
      const baselinePath = baselineByPath.get(pathname);
      const currentPath = currentByPath.get(pathname);
      const baselineProfile = baselinePath
        ? sampleReferralProfile(baseline, baselinePath)
        : undefined;
      const currentProfile = currentPath ? sampleReferralProfile(current, currentPath) : undefined;
      const change = selectPathChange(baselineProfile, currentProfile);
      if (!baselinePath && currentPath) pathsOnlyInCurrentRetainedList += 1;
      else if (baselinePath && !currentPath) pathsOnlyInBaselineRetainedList += 1;
      else if (baselineProfile && currentProfile) {
        if (baselinePath && currentPath) {
          const baselineFailures =
            baselinePath.responseClasses.clientErrors4xx +
            baselinePath.responseClasses.serverErrors5xx;
          const currentFailures =
            currentPath.responseClasses.clientErrors4xx +
            currentPath.responseClasses.serverErrors5xx;
          if (baselineFailures === 0 && currentFailures > 0) pathsWithNewFailures += 1;
          if (baselineFailures > 0 && currentFailures === 0) pathsWithResolvedFailures += 1;
        }
      }
      if (change) {
        pathChanges.push({
          path: pathname,
          change,
          ...(baselineProfile ? { baseline: baselineProfile } : {}),
          ...(currentProfile ? { current: currentProfile } : {}),
          failureRateDeltaPercentagePoints:
            baselineProfile && currentProfile
              ? Number(
                  (currentProfile.failureRatePercent - baselineProfile.failureRatePercent).toFixed(
                    1
                  )
                )
              : null,
          requestShareDeltaPercentagePoints:
            baselineProfile && currentProfile
              ? Number(
                  (
                    currentProfile.requestSharePercent - baselineProfile.requestSharePercent
                  ).toFixed(1)
                )
              : null,
        });
      }
    }
    const priority: Record<AiCrawlerLogPeriodPathChange, number> = {
      'failure-emerged': 0,
      'failure-cleared': 1,
      'current-only-retained': 2,
      'baseline-only-retained': 3,
      'response-class-shift': 4,
      'status-code-set-shift': 5,
      'media-type-set-shift': 6,
      'request-share-shift': 7,
    };
    pathChanges.sort(
      (left, right) =>
        priority[left.change] - priority[right.change] ||
        Math.abs(right.failureRateDeltaPercentagePoints ?? 0) -
          Math.abs(left.failureRateDeltaPercentagePoints ?? 0) ||
        Math.abs(right.requestShareDeltaPercentagePoints ?? 0) -
          Math.abs(left.requestShareDeltaPercentagePoints ?? 0) ||
        left.path.localeCompare(right.path)
    );
  }

  const requestDelta = baseline && current ? current.requests - baseline.requests : null;
  return {
    source: current?.source ?? baseline?.source ?? 'Unknown AI referral source',
    comparisonAvailable: hasComparableSamples,
    baselineRequests: baseline?.requests ?? null,
    currentRequests: current?.requests ?? null,
    requestDelta,
    requestChangePercent:
      baseline && current && baseline.requests > 0
        ? Number((((current.requests - baseline.requests) / baseline.requests) * 100).toFixed(1))
        : null,
    baselineFailureRequests: referralFailureRequests(baseline),
    currentFailureRequests: referralFailureRequests(current),
    baselineFailureRatePercent: referralFailureRate(baseline),
    currentFailureRatePercent: referralFailureRate(current),
    failureRateDeltaPercentagePoints:
      baseline && current
        ? Number(
            ((referralFailureRate(current) ?? 0) - (referralFailureRate(baseline) ?? 0)).toFixed(1)
          )
        : null,
    baselineUniquePaths: baseline?.uniquePaths ?? null,
    currentUniquePaths: current?.uniquePaths ?? null,
    baselinePathsTruncated: baseline?.pathsTruncated ?? null,
    currentPathsTruncated: current?.pathsTruncated ?? null,
    pathsOnlyInCurrentRetainedList,
    pathsOnlyInBaselineRetainedList,
    pathsWithNewFailures,
    pathsWithResolvedFailures,
    pathChanges: pathChanges.slice(0, MAX_RETURNED_PATH_CHANGES),
    pathChangesTruncated: pathChanges.length > MAX_RETURNED_PATH_CHANGES,
  };
}

/** Compare two single access-log analyses. Missing paths mean absent from the retained frequent-path lists, not zero crawl activity. */
export function compareAiCrawlerAccessLogs(
  baseline: AiCrawlerAccessLogAnalysis,
  current: AiCrawlerAccessLogAnalysis
): AiCrawlerLogPeriodComparison {
  const baselineByToken = new Map(
    baseline.crawlers.map((crawler) => [crawler.token.toLowerCase(), crawler])
  );
  const currentByToken = new Map(
    current.crawlers.map((crawler) => [crawler.token.toLowerCase(), crawler])
  );
  const tokens = [...new Set([...baselineByToken.keys(), ...currentByToken.keys()])].sort();
  const crawlers: AiCrawlerLogPeriodCrawlerComparison[] = [];
  for (const token of tokens) {
    const before = baselineByToken.get(token);
    const after = currentByToken.get(token);
    if (before && after) {
      crawlers.push(
        compareCrawler(before, after, {
          hasBaseline: true,
          hasCurrent: true,
          baselineSourceFile: baseline.sourceFile,
          currentSourceFile: current.sourceFile,
        })
      );
    } else {
      const observed = before ?? after!;
      const empty: AiCrawlerLogSummary = {
        ...observed,
        requests: 0,
        uniquePaths: 0,
        responseClasses: {
          successful2xx: 0,
          redirects3xx: 0,
          clientErrors4xx: 0,
          serverErrors5xx: 0,
          other: 0,
        },
        responseTiming: undefined,
        originStatusObservations: 0,
        edgeOriginStatusDifferences: 0,
        failureRequests: 0,
        failureRatePercent: 0,
        pathsWithFailures: 0,
        failureHotspots: [],
        failureHotspotsTruncated: false,
        cloudflareBotEvidence: observed.cloudflareBotEvidence ?? {
          requestsWithCloudflareBotFields: 0,
          requestsWithBotScore: 0,
          botScoreGroups: { notComputed: 0, automated: 0, likelyAutomated: 0, likelyHuman: 0 },
          requestsWithBotScoreSource: 0,
          botScoreSourceCounts: {
            'Not Computed': 0,
            Heuristics: 0,
            'Machine Learning': 0,
            'Behavioral Analysis': 0,
            'Verified Bot': 0,
            'JS Fingerprinting': 0,
            'Cloudflare Service': 0,
            other: 0,
          },
          requestsWithVerifiedBotCategory: 0,
          verifiedBotRequests: 0,
          verifiedBotCategories: [],
          verifiedBotCategoriesTruncated: false,
        },
        cloudflareSecurityActions: observed.cloudflareSecurityActions ?? {
          requestsWithSecurityActions: 0,
          blockingRequests: 0,
          challengeRequests: 0,
          challengeSolvedOrBypassedRequests: 0,
          allowBypassOrSkipRequests: 0,
          otherActionRequests: 0,
        },
        statusCodes: [],
        statusCodesTruncated: false,
        requestMethods: [],
        requestMethodsTruncated: false,
        paths: [],
        pathsTruncated: false,
        dailyActivity: [],
        dailyActivityTruncated: false,
      };
      crawlers.push(
        before
          ? compareCrawler(before, empty, {
              hasBaseline: true,
              hasCurrent: false,
              baselineSourceFile: baseline.sourceFile,
            })
          : compareCrawler(empty, after!, {
              hasBaseline: false,
              hasCurrent: true,
              currentSourceFile: current.sourceFile,
            })
      );
    }
  }
  const baselineReferralSources = Array.isArray(baseline.aiReferralTraffic)
    ? baseline.aiReferralTraffic
    : undefined;
  const currentReferralSources = Array.isArray(current.aiReferralTraffic)
    ? current.aiReferralTraffic
    : undefined;
  const baselineReferralBySource = new Map(
    (baselineReferralSources ?? []).map((source) => [source.source.toLowerCase(), source])
  );
  const currentReferralBySource = new Map(
    (currentReferralSources ?? []).map((source) => [source.source.toLowerCase(), source])
  );
  const referralSourceLabels = [
    ...new Set([...baselineReferralBySource.keys(), ...currentReferralBySource.keys()]),
  ].sort();
  const aiReferralSources = referralSourceLabels.map((label) =>
    compareReferralTraffic(baselineReferralBySource.get(label), currentReferralBySource.get(label))
  );
  return {
    source: 'Aviary AI crawler log period comparison',
    schemaVersion: 1,
    baselineUniquePathsAcrossRecognizedBots: baseline.uniquePathsAcrossRecognizedBots,
    currentUniquePathsAcrossRecognizedBots: current.uniquePathsAcrossRecognizedBots,
    crawlers,
    aiReferralSources,
    utmSourceAttributionCoverage: {
      comparisonAvailable: Boolean(
        baseline.utmSourceAttributionCoverage && current.utmSourceAttributionCoverage
      ),
      baseline: baseline.utmSourceAttributionCoverage ?? null,
      current: current.utmSourceAttributionCoverage ?? null,
    },
    note: 'Compares the two supplied log samples, not complete provider crawl histories. Request and failure-rate changes can reflect different sample duration or coverage. Path-level crawler comparison uses each report’s retained frequent-path list (up to 200 paths per crawler); AI referral comparisons use each source’s bounded retained path list. A path absent from a retained list is not evidence of zero requests. “Current-only” and “baseline-only” mean absent from one retained list, not definitively new or discontinued activity. AI referral changes are comparable only when both reports contain the same source label and were produced with the same exact UTM mapping. Referral counts represent request rows, not users or sessions. User-Agent matches remain claims, and Cloudflare action/status co-occurrence does not establish cause.',
  };
}
