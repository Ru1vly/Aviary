import type { SiteWideGeoAnalysis, SiteWideGeoPageSummary } from '../sitewide';
import type { SitemapPageEntry } from '../crawler';
import { createHash } from 'node:crypto';
import { parseRobotsTxtPolicy } from '../robots';
import * as ipaddr from 'ipaddr.js';

export type AiCrawlerActivity =
  | 'search-crawl'
  | 'user-initiated-fetch'
  | 'training-data-crawl'
  | 'data-use-crawl'
  | 'unclassified';
export type AiRobotsPolicyActivity = AiCrawlerActivity | 'data-use-policy';

export interface AiCrawlerDefinition {
  token: string;
  provider: string;
  activity: AiCrawlerActivity;
}

/** Built-in product tokens documented by their operators; match claims only, not authenticated identity. */
export const AI_CRAWLER_CATALOG: AiCrawlerDefinition[] = [
  { token: 'Googlebot-Image', provider: 'Google', activity: 'search-crawl' },
  { token: 'Googlebot-Video', provider: 'Google', activity: 'search-crawl' },
  { token: 'Googlebot', provider: 'Google', activity: 'search-crawl' },
  { token: 'bingbot', provider: 'Microsoft', activity: 'search-crawl' },
  { token: 'Amzn-SearchBot', provider: 'Amazon', activity: 'search-crawl' },
  { token: 'Applebot', provider: 'Apple', activity: 'search-crawl' },
  { token: 'OAI-SearchBot', provider: 'OpenAI', activity: 'search-crawl' },
  { token: 'ChatGPT-User', provider: 'OpenAI', activity: 'user-initiated-fetch' },
  { token: 'GPTBot', provider: 'OpenAI', activity: 'training-data-crawl' },
  { token: 'Amazonbot', provider: 'Amazon', activity: 'data-use-crawl' },
  { token: 'Claude-SearchBot', provider: 'Anthropic', activity: 'search-crawl' },
  { token: 'Claude-User', provider: 'Anthropic', activity: 'user-initiated-fetch' },
  { token: 'ClaudeBot', provider: 'Anthropic', activity: 'training-data-crawl' },
  { token: 'PerplexityBot', provider: 'Perplexity', activity: 'search-crawl' },
  { token: 'Perplexity-User', provider: 'Perplexity', activity: 'user-initiated-fetch' },
  { token: 'MistralAI-Index', provider: 'Mistral', activity: 'search-crawl' },
  { token: 'MistralAI-User', provider: 'Mistral', activity: 'user-initiated-fetch' },
  { token: 'MistralAI-Training', provider: 'Mistral', activity: 'training-data-crawl' },
  { token: 'Amzn-User', provider: 'Amazon', activity: 'user-initiated-fetch' },
];

const ROBOTS_CONTROLLED_USER_FETCH_TOKENS = new Set(['mistralai-user']);

function isDataUseCrawlerActivity(activity: AiCrawlerActivity): boolean {
  return activity === 'training-data-crawl' || activity === 'data-use-crawl';
}

export interface AiCrawlerLogPath {
  path: string;
  requests: number;
  statusCodes: Array<{ status: number; requests: number }>;
  statusCodesTruncated: boolean;
  originResponseStatusCodes: Array<{ status: number; requests: number }>;
  originResponseStatusCodesTruncated: boolean;
  edgeOriginStatusDifferences: number;
  responseContentTypes: Array<{ contentType: string; requests: number }>;
  responseContentTypesTruncated: boolean;
  responseTiming?: AiCrawlerResponseTiming;
  cloudFrontResultProfile?: AiCrawlerCloudFrontResultProfile;
  timestampedRequests: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  /** Whole days before the newest parseable request for this crawler in the supplied log. */
  daysBeforeLatestRequest?: number;
  successfulResponses: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  otherResponses: number;
}

export type AiCrawlerTimingBand =
  | '<=50ms'
  | '51-100ms'
  | '101-250ms'
  | '251-500ms'
  | '501-1000ms'
  | '1001-2500ms'
  | '2501-5000ms'
  | '>5000ms';

export interface AiCrawlerTimingDistribution {
  sampledRequests: number;
  p50Band: AiCrawlerTimingBand;
  p95Band: AiCrawlerTimingBand;
  bands: Array<{ band: AiCrawlerTimingBand; requests: number }>;
}

export interface AiCrawlerResponseTiming {
  responseDuration?: AiCrawlerTimingDistribution;
  timeToFirstByte?: AiCrawlerTimingDistribution;
}

export type AiCrawlerCloudFrontResultType =
  'Hit' | 'RefreshHit' | 'Miss' | 'LimitExceeded' | 'CapacityExceeded' | 'Error' | 'Other';

export interface AiCrawlerCloudFrontResultProfile {
  requestsWithResultType: number;
  resultTypes: Array<{ resultType: AiCrawlerCloudFrontResultType; requests: number }>;
  requestsWithResponseResultType: number;
  responseResultTypes: Array<{ resultType: AiCrawlerCloudFrontResultType; requests: number }>;
  pairedRequests: number;
  differingResultTypes: number;
}

export interface AiCrawlerLogDailyActivity {
  date: string;
  requests: number;
  successfulResponses: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  otherResponses: number;
  responseTiming?: AiCrawlerResponseTiming;
}

export interface AiCrawlerLogFailureHotspot extends AiCrawlerLogPath {
  failureRequests: number;
  failureSharePercent: number;
  cloudflareBotAnnotatedRequests: number;
  cloudflareVerifiedBotRequests: number;
  cloudflareVerifiedBotFailureRequests: number;
  cloudflareSecurityActionRequests: number;
  cloudflareBlockingFailureRequests: number;
  cloudflareChallengeFailureRequests: number;
  cloudflareChallengeResolvedFailureRequests: number;
}

export type CloudflareBotScoreSource =
  | 'Not Computed'
  | 'Heuristics'
  | 'Machine Learning'
  | 'Behavioral Analysis'
  | 'Verified Bot'
  | 'JS Fingerprinting'
  | 'Cloudflare Service';
export type CloudflareSecurityActionClass =
  'blocking' | 'challenge' | 'challenge-solved-or-bypassed' | 'allow-bypass-or-skip' | 'other';

export interface AiCrawlerCloudflareBotEvidence {
  requestsWithCloudflareBotFields: number;
  requestsWithBotScore: number;
  botScoreGroups: {
    notComputed: number;
    automated: number;
    likelyAutomated: number;
    likelyHuman: number;
  };
  requestsWithBotScoreSource: number;
  botScoreSourceCounts: Record<CloudflareBotScoreSource | 'other', number>;
  requestsWithVerifiedBotCategory: number;
  verifiedBotRequests: number;
  verifiedBotCategories: Array<{ category: string; requests: number }>;
  verifiedBotCategoriesTruncated: boolean;
}

export interface AiCrawlerCloudflareSecurityActions {
  requestsWithSecurityActions: number;
  blockingRequests: number;
  challengeRequests: number;
  challengeSolvedOrBypassedRequests: number;
  allowBypassOrSkipRequests: number;
  otherActionRequests: number;
}

export interface AiCrawlerLogSummary extends AiCrawlerDefinition {
  requests: number;
  uniquePaths: number;
  responseClasses: {
    successful2xx: number;
    redirects3xx: number;
    clientErrors4xx: number;
    serverErrors5xx: number;
    other: number;
  };
  responseTiming?: AiCrawlerResponseTiming;
  cloudFrontResultProfile?: AiCrawlerCloudFrontResultProfile;
  originStatusObservations: number;
  edgeOriginStatusDifferences: number;
  failureRequests: number;
  failureRatePercent: number;
  pathsWithFailures: number;
  failureHotspots: AiCrawlerLogFailureHotspot[];
  failureHotspotsTruncated: boolean;
  cloudflareBotEvidence: AiCrawlerCloudflareBotEvidence;
  cloudflareSecurityActions: AiCrawlerCloudflareSecurityActions;
  ipRangeVerification?: AiCrawlerIpRangeVerification;
  statusCodes: Array<{ status: number; requests: number }>;
  statusCodesTruncated: boolean;
  requestMethods: Array<{ method: string; requests: number }>;
  requestMethodsTruncated: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
  paths: AiCrawlerLogPath[];
  pathsTruncated: boolean;
  dailyActivity: AiCrawlerLogDailyActivity[];
  dailyActivityTruncated: boolean;
}

export interface AiCrawlerIpRangeVerification {
  configuredCidrCount: number;
  userAgentMatchedRequests: number;
  requestsWithMatchedRange: number;
  requestsOutsideConfiguredRanges: number;
  requestsWithoutClientIp: number;
  requestsWithInvalidClientIp: number;
}

export interface AiCrawlerIpRangeDefinition {
  token: string;
  cidrs: string[];
}

export interface AiCrawlerPathResponseProfile {
  crawlerToken: string;
  provider: string;
  requests: number;
  successfulResponses: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  otherResponses: number;
  statusCodes: Array<{ status: number; requests: number }>;
  statusCodesTruncated: boolean;
  responseContentTypes: Array<{ contentType: string; requests: number }>;
  responseContentTypesTruncated: boolean;
}

export interface AiCrawlerPathResponseDisparity {
  path: string;
  observedCrawlerCount: number;
  hasDifferentStatusCodeSets: boolean;
  statusCodeDetailsTruncated: boolean;
  hasDifferentContentTypeSets: boolean;
  contentTypeDetailsTruncated: boolean;
  hasSuccessFailureSplit: boolean;
  crawlers: AiCrawlerPathResponseProfile[];
}

export interface AiCrawlerPathResponseComparison {
  activity: 'search-crawl' | 'training-data-crawl';
  crawlersCompared: Array<{ crawlerToken: string; provider: string }>;
  sharedPathsCompared: number;
  pathsWithDifferentResponseClasses: number;
  pathsWithDifferentStatusCodeSets: number;
  pathsWithDifferentContentTypeSets: number;
  pathsWithSuccessFailureSplit: number;
  pathsWithTruncatedStatusCodeDetails: number;
  pathsWithTruncatedContentTypeDetails: number;
  inputPathsTruncated: boolean;
  rowsTruncated: boolean;
  disparities: AiCrawlerPathResponseDisparity[];
  note: string;
}

export interface AiCrawlerAccessLogAnalysis {
  source: 'Aviary AI crawler access log analysis';
  schemaVersion: 1;
  sourceFile?: string;
  linesRead: number;
  parsedRequests: number;
  parsedCombinedLogLines: number;
  parsedCloudFrontLogLines: number;
  parsedJsonLines: number;
  skippedLines: number;
  requestsWithoutUserAgent: number;
  requestsWithUnrecognizedUserAgent: number;
  requestsWithoutParseableTimestamp: number;
  recognizedAiCrawlerRequests: number;
  uniquePathsAcrossRecognizedBots: number;
  aiReferralTraffic: AiReferralTrafficSummary[];
  utmSourceAttributionCoverage?: AiReferralUtmSourceCoverage;
  firstSeenAt?: string;
  lastSeenAt?: string;
  crawlers: AiCrawlerLogSummary[];
  ipRangeVerification?: Array<AiCrawlerIpRangeVerification & { token: string }>;
  searchCrawlerPathComparison: AiCrawlerPathResponseComparison;
  trainingCrawlerPathComparison: AiCrawlerPathResponseComparison;
  note: string;
}

export interface AiCrawlerAccessLogOptions {
  sourceFile?: string;
  maxLines?: number;
  /** Additional case-insensitive user-agent product tokens, treated as unclassified claims. */
  customTokens?: string[];
  /** Exact utm_source values to aggregate as labeled AI referral request samples. */
  aiReferralSources?: Array<{ label: string; value: string }>;
  /** Offline, caller-supplied CIDR ranges keyed to explicit crawler tokens. Only aggregate match counts are retained. */
  ipRanges?: AiCrawlerIpRangeDefinition[];
}

export interface AiReferralTrafficPathSummary {
  path: string;
  requests: number;
  responseClasses: AiCrawlerLogSummary['responseClasses'];
  statusCodes: Array<{ status: number; requests: number }>;
  statusCodesTruncated: boolean;
  responseContentTypes: Array<{ contentType: string; requests: number }>;
  responseContentTypesTruncated: boolean;
  lastSeenAt?: string;
}

export interface AiReferralTrafficDailyActivity {
  date: string;
  requests: number;
}

export interface AiReferralTrafficSummary {
  source: string;
  requests: number;
  uniquePaths: number;
  uniquePathsTruncated: boolean;
  timestampedRequests: number;
  responseClasses: AiCrawlerLogSummary['responseClasses'];
  firstSeenAt?: string;
  lastSeenAt?: string;
  paths: AiReferralTrafficPathSummary[];
  pathsTruncated: boolean;
  dailyActivity: AiReferralTrafficDailyActivity[];
  dailyActivityTruncated: boolean;
}

export interface AiReferralUtmSourceCoverage {
  parsedRequestRows: number;
  requestsWithUtmSource: number;
  requestsWithConfiguredSource: number;
  requestsWithUnconfiguredSingleValue: number;
  requestsWithConflictingValues: number;
  requestsWithEmptyOrOversizedValue: number;
}

export interface AiCrawlerLogGeoPathObservation extends AiCrawlerLogPath {
  crawlerToken: string;
  provider: string;
  activity: AiCrawlerActivity;
  auditMatchType: 'matched' | 'ambiguous' | 'not-in-audit' | 'not-applicable';
  auditUrl?: string;
  currentRobotsAccess: 'allowed' | 'blocked' | 'not-assessed' | 'not-applicable';
  currentRobotsRule?: { directive: 'allow' | 'disallow'; pattern: string; line: number };
  currentNoArchive?: boolean;
  currentNoindex?: boolean;
  currentNoSnippet?: boolean;
  currentMaxSnippetZero?: boolean;
  answerContentCoverage?: 'measured' | 'not-assessed' | 'not-run';
  citationEvidenceCoverage?: 'measured' | 'not-assessed' | 'not-run';
  currentQuestionHeadings?: number;
  currentConciseAnswerBlocks?: number;
  currentSchemaIsAccessibleForFree?: boolean | 'mixed' | 'not-declared';
  currentSchemaHasNonBooleanAccessibleForFreeValue?: boolean;
  currentVisibleAuthor?: boolean;
  currentVisibleDate?: boolean;
  currentExternalSourceLinkCount?: number;
  currentInlineCitationMarkerCount?: number;
  currentUnresolvedCitationTargetCount?: number;
  reviewSignals?: AiCrawlerGeoReviewSignal[];
}

export type AiCrawlerGeoReviewSignal =
  | 'robots-blocked'
  | 'noindex'
  | 'nosnippet'
  | 'max-snippet-zero'
  | 'noarchive'
  | 'client-error-responses'
  | 'server-error-responses'
  | 'no-question-headings'
  | 'no-concise-answer-blocks'
  | 'no-visible-author'
  | 'no-visible-date'
  | 'no-external-source-links'
  | 'no-inline-citation-markers'
  | 'unresolved-citation-targets'
  | 'apple-ai-context-excluded-by-paywall-schema'
  | 'apple-ai-context-hidden-by-nosnippet';

export interface AiCrawlerGeoOpportunity {
  crawlerToken: string;
  provider: string;
  activity: AiCrawlerActivity;
  path: string;
  auditUrl: string;
  requests: number;
  crawlerRequests: number;
  crawlerRequestSharePercent: number;
  lastSeenAt?: string;
  daysBeforeLatestRequest?: number;
  currentNoArchive?: boolean;
  currentSchemaIsAccessibleForFree?: boolean | 'mixed' | 'not-declared';
  reviewSignals: AiCrawlerGeoReviewSignal[];
}

export interface AiCrawlerLogGeoCorrelation {
  sourceFile?: string;
  origin: string;
  auditTimestamp: string;
  auditPagesOnOrigin: number;
  logPathsMatchedToAudit: number;
  logPathsAmbiguousInAudit: number;
  logPathsNotInAudit: number;
  requestsMatchedToAuditedPaths: number;
  requestsOnAuditedPathsWithRedirects: number;
  requestsOnAuditedPathsWithClientErrors: number;
  requestsOnAuditedPathsWithServerErrors: number;
  requestsOnCurrentlyRobotsBlockedPaths: number;
  requestsOnCurrentlyNoindexPaths: number;
  requestsOnCurrentlySnippetRestrictedPaths: number;
  requestsOnAuditedPathsWithQuestionHeadings: number;
  requestsOnAuditedPathsWithConciseAnswerBlocks: number;
  requestsOnAuditedPathsWithExternalSourceLinks: number;
  requestsOnAuditedPathsWithInlineCitationMarkers: number;
  requestsOnApplebotPagesMarkedPaywalled: number;
  requestsOnApplebotPagesWithNoSnippet: number;
  requestsOnApplebotPagesWithDocumentedAiContextExclusion: number;
  pathObservations: AiCrawlerLogGeoPathObservation[];
  priorityReviewQueue: AiCrawlerGeoOpportunity[];
  priorityReviewQueueTruncated: boolean;
  aiReferralAuditCoverage: AiReferralGeoAuditCoverage;
  inputPathsTruncated: boolean;
  pathObservationsTruncated: boolean;
  auditPathCoverage: AiCrawlerLogGeoAuditPathCoverage;
  note: string;
}

export type AiCrawlerSitemapFreshnessState = 'updated-after-last-observed-request';

export interface AiCrawlerSitemapFreshnessOpportunity {
  crawlerToken: string;
  provider: string;
  activity: AiCrawlerActivity;
  path: string;
  requests: number;
  crawlerRequests: number;
  crawlerRequestSharePercent: number;
  sitemapLastModified: string;
  lastSeenAt: string;
  daysBetweenLastRequestAndUpdate: number;
  state: AiCrawlerSitemapFreshnessState;
}

export interface AiCrawlerSitemapCrawlerFreshness {
  crawlerToken: string;
  provider: string;
  activity: AiCrawlerActivity;
  sitemapUrlsProvided: number;
  pagesWithValidLastmod: number;
  pagesWithoutLastmod: number;
  pagesWithInvalidLastmod: number;
  pagesObservedInLog: number;
  pagesNotObservedInLog: number;
  pagesWithUpdateAfterLastObservedRequest: number;
  pagesObservedSameUtcDayAsLastmod: number;
  pagesObservedAfterLastmod: number;
  pagesObservedWithoutTimestamp: number;
  ambiguousPaths: number;
  pagesSkippedAsAmbiguous: number;
  requestsOnPagesWithValidLastmod: number;
  requestsOnPagesWithUpdateAfterLastObservedRequest: number;
  logPathsTruncated: boolean;
}

export type AiCrawlerSitemapSchemaDateOpportunityReason =
  'different-date' | 'multiple-dates' | 'missing-date' | 'non-date-value';

export interface AiCrawlerSitemapSchemaDateOpportunity {
  path: string;
  sitemapLastModified: string;
  schemaDateModifiedDays: string[];
  reason: AiCrawlerSitemapSchemaDateOpportunityReason;
}

export interface AiCrawlerSitemapSchemaDateComparison {
  auditTimestamp: string;
  sitemapUrlsWithValidLastmod: number;
  sitemapUrlsWithoutValidLastmod: number;
  auditPathsMatched: number;
  auditPathsNotFound: number;
  auditPathsAmbiguous: number;
  pagesWithSingleSchemaDateCompared: number;
  pagesWithMatchingSchemaDateModified: number;
  pagesWithDifferentSchemaDateModified: number;
  pagesWithMultipleSchemaDateModified: number;
  pagesWithoutSchemaDateModified: number;
  pagesWithNonDateSchemaDateModified: number;
  pagesWithUnassessedSchemaDateModified: number;
  opportunitiesTruncated: boolean;
  opportunities: AiCrawlerSitemapSchemaDateOpportunity[];
}

export interface AiCrawlerSitemapFreshnessAnalysis {
  sourceFile?: string;
  origin: string;
  sitemapUrl: string;
  sitemapUrlsProvided: number;
  duplicateSitemapEntries: number;
  pagesWithValidLastmod: number;
  pagesWithoutLastmod: number;
  pagesWithInvalidLastmod: number;
  sitemapUrlsWithQueryStrings: number;
  sitemapUrlsSkippedAsAmbiguous: number;
  sitemapUrlsTruncated: boolean;
  sitemapEntriesTruncated: boolean;
  inputLogPathsTruncated: boolean;
  opportunitiesTruncated: boolean;
  crawlers: AiCrawlerSitemapCrawlerFreshness[];
  updateOpportunities: AiCrawlerSitemapFreshnessOpportunity[];
  schemaDateComparison?: AiCrawlerSitemapSchemaDateComparison;
  note: string;
}

export interface AiCrawlerLogGeoAuditPathCoverage {
  auditPagesSkipped: number;
  uniqueAuditPaths: number;
  rowsTruncated: boolean;
  crawlers: Array<{
    crawlerToken: string;
    provider: string;
    activity: 'search-crawl' | 'user-initiated-fetch' | 'training-data-crawl' | 'data-use-crawl';
    pathsEvaluated: number;
    pathsObserved: number;
    pathsNotObservedInLog: number;
    pathsAmbiguous: number;
    pathsUnassessableBecauseTruncated: number;
    observedRequests: number;
    observedSuccessfulResponses: number;
    latestRequestAt?: string;
    observedPathsWithin7DaysOfLatestRequest: number;
    observedPaths8To30DaysBeforeLatestRequest: number;
    observedPathsOver30DaysBeforeLatestRequest: number;
    observedPathsWithoutTimestamp: number;
    currentlyRobotsBlockedPaths: number;
    currentlyNoindexPaths: number;
    currentlySnippetRestrictedPaths: number;
    currentlyNoArchivePaths: number;
    paths: Array<{
      path: string;
      auditedUrlCount: number;
      observation:
        | 'observed'
        | 'not-observed-in-log'
        | 'ambiguous-query-or-duplicate'
        | 'not-assessable-truncated';
      requests?: number;
      successfulResponses?: number;
      statusCodes?: Array<{ status: number; requests: number }>;
      statusCodesTruncated?: boolean;
      responseContentTypes?: Array<{ contentType: string; requests: number }>;
      responseContentTypesTruncated?: boolean;
      timestampedRequests?: number;
      lastSeenAt?: string;
      daysBeforeLatestRequest?: number;
      currentRobotsAccess: 'allowed' | 'blocked' | 'not-assessed';
      currentNoindex?: boolean;
      currentNoSnippet?: boolean;
      currentMaxSnippetZero?: boolean;
      currentNoArchive?: boolean;
    }>;
  }>;
  note: string;
}

export interface AiReferralGeoAuditPathObservation {
  source: string;
  path: string;
  requests: number;
  auditMatchType: 'matched' | 'ambiguous' | 'not-in-audit';
  searchCrawlers: AiReferralGeoCrawlerOverlap;
  trainingDataCrawlers: AiReferralGeoCrawlerOverlap;
  auditUrl?: string;
  currentNoindex?: boolean;
  currentNoSnippet?: boolean;
  currentMaxSnippetZero?: boolean;
  currentQuestionHeadings?: number;
  currentConciseAnswerBlocks?: number;
}

export interface AiReferralGeoCrawlerOverlap {
  logCoverage: 'observed' | 'observed-incomplete' | 'not-observed-in-sample' | 'incomplete';
  requests: number;
  failures: number;
  tokens: string[];
  latestRequestAt?: string;
}

export interface AiReferralGeoAuditSourceCoverage {
  source: string;
  requestsInSample: number;
  uniquePaths: number;
  uniquePathsTruncated: boolean;
  retainedPathsCompared: number;
  retainedRequestsCompared: number;
  retainedPathsMatchedToAudit: number;
  retainedPathsAmbiguousInAudit: number;
  retainedPathsNotInAudit: number;
  retainedRequestsMatchedToAudit: number;
  retainedRequestsOnNoindexPages: number;
  retainedRequestsOnSnippetRestrictedPages: number;
  retainedRequestsOnPagesWithQuestionHeadings: number;
  retainedRequestsOnPagesWithConciseAnswerBlocks: number;
  retainedPathsWithSearchCrawlerRequests: number;
  retainedPathsWithTrainingCrawlerRequests: number;
  retainedPathsWithSearchCrawlerFailures: number;
  retainedPathsWithTrainingCrawlerFailures: number;
  retainedPathsWithIncompleteSearchCrawlerCoverage: number;
  retainedPathsWithIncompleteTrainingCrawlerCoverage: number;
  searchCrawlerRequestsOnRetainedPaths: number;
  searchCrawlerFailuresOnRetainedPaths: number;
  trainingCrawlerRequestsOnRetainedPaths: number;
  trainingCrawlerFailuresOnRetainedPaths: number;
  pathsTruncated: boolean;
}

export interface AiReferralGeoAuditCoverage {
  sources: AiReferralGeoAuditSourceCoverage[];
  pathObservations: AiReferralGeoAuditPathObservation[];
  pathObservationsTruncated: boolean;
  note: string;
}

export interface AiCrawlerRobotsPolicyPathObservation extends AiCrawlerLogPath {
  crawlerToken: string;
  provider: string;
  activity: AiCrawlerActivity;
  policyDecision: 'allowed' | 'blocked' | 'not-assessed' | 'not-applicable';
  selectedAgents: string[];
  matchedRule?: {
    directive: 'allow' | 'disallow';
    pattern: string;
    specificity: number;
    line: number;
  };
}

export interface AiCrawlerRobotsPolicySummary extends AiCrawlerDefinition {
  pathsEvaluated: number;
  requestsEvaluated: number;
  allowedPaths: number;
  blockedPaths: number;
  notAssessedPaths: number;
  notApplicablePaths: number;
  allowedRequests: number;
  blockedRequests: number;
}

export interface AiCrawlerRobotsPolicyAnalysis {
  source: 'Aviary AI crawler robots policy replay';
  schemaVersion: 1;
  sourceFile?: string;
  sourceModifiedAt?: string;
  robotsSha256: string;
  origin: string;
  inputPathsTruncated: boolean;
  crawlers: AiCrawlerRobotsPolicySummary[];
  pathObservations: AiCrawlerRobotsPolicyPathObservation[];
  pathObservationsTruncated: boolean;
  note: string;
}

export interface AiCrawlerRobotsPolicyPathChange extends AiCrawlerRobotsPolicyPathObservation {
  baselineDecision?: AiCrawlerRobotsPolicyPathObservation['policyDecision'];
  baselineSelectedAgents?: string[];
  change: 'newly-blocked' | 'newly-allowed' | 'rule-changed' | 'unchanged' | 'not-comparable';
  baselineMatchedRule?: AiCrawlerRobotsPolicyPathObservation['matchedRule'];
}

export interface AiCrawlerRobotsPolicyComparison {
  source: 'Aviary AI crawler robots policy comparison';
  schemaVersion: 1;
  origin: string;
  baselineSnapshot: { sourceFile?: string; modifiedAt?: string; sha256: string };
  currentSnapshot: { sourceFile?: string; modifiedAt?: string; sha256: string };
  pathsCompared: number;
  pathsNewlyBlocked: number;
  pathsNewlyAllowed: number;
  pathsWithRuleChanges: number;
  pathsUnchanged: number;
  pathsNotComparable: number;
  pathsMissingFromBaseline: number;
  pathsMissingFromCurrent: number;
  requestsNewlyBlocked: number;
  requestsNewlyAllowed: number;
  inputPathsTruncated: boolean;
  pathChanges: AiCrawlerRobotsPolicyPathChange[];
  pathChangesTruncated: boolean;
  note: string;
}

export interface AiCrawlerRobotsAuditReplayRow {
  auditUrlIndex: number;
  url: string;
  queryStringEvaluated: boolean;
  queryParametersEvaluated: number;
  crawlerToken: string;
  provider: string;
  activity: AiRobotsPolicyActivity;
  customToken: boolean;
  allowed: boolean;
  selectedAgents: string[];
  matchedRule?: {
    directive: 'allow' | 'disallow';
    pattern: string;
    specificity: number;
    line: number;
  };
}

export interface AiCrawlerRobotsAuditReplay {
  source: 'Aviary GEO robots policy URL replay' | 'Aviary GEO robots policy audit replay';
  schemaVersion: 1;
  targetSource?: 'saved-audit' | 'sitemap';
  sourceFile?: string;
  sitemapUrl?: string;
  robotsFile?: string;
  robotsModifiedAt?: string;
  robotsSha256: string;
  origin: string;
  auditTimestamp?: string;
  uniqueTargetUrls?: number;
  targetsMayBeTruncated?: boolean;
  uniqueAuditUrls: number;
  pagesOnOrigin: number;
  pagesSkipped: number;
  auditPagesUnavailable: number;
  crawlerPolicies: Array<{
    token: string;
    provider: string;
    activity: AiRobotsPolicyActivity;
    customToken: boolean;
    pagesEvaluated: number;
    pagesAllowed: number;
    pagesBlocked: number;
    blockedUrls: string[];
    blockedUrlsTruncated: boolean;
  }>;
  rows: AiCrawlerRobotsAuditReplayRow[];
  rowsTruncated: boolean;
  note: string;
}

export interface AiCrawlerRobotsAuditReplayChange extends AiCrawlerRobotsAuditReplayRow {
  change: 'newly-blocked' | 'newly-allowed' | 'rule-changed' | 'unchanged' | 'not-comparable';
  baselineAllowed?: boolean;
  baselineSelectedAgents?: string[];
  baselineMatchedRule?: AiCrawlerRobotsAuditReplayRow['matchedRule'];
}

export interface AiCrawlerRobotsAuditReplayComparison {
  source:
    'Aviary GEO robots policy URL replay comparison' | 'Aviary GEO robots audit replay comparison';
  schemaVersion: 1;
  origin: string;
  targetSource?: 'saved-audit' | 'sitemap';
  baselineSnapshot: { robotsFile?: string; modifiedAt?: string; sha256: string };
  currentSnapshot: { robotsFile?: string; modifiedAt?: string; sha256: string };
  baselineAuditTimestamp?: string;
  currentAuditTimestamp?: string;
  urlTokenPairsCompared: number;
  urlTokenPairsNewlyBlocked: number;
  urlTokenPairsNewlyAllowed: number;
  urlTokenPairsWithRuleChanges: number;
  urlTokenPairsUnchanged: number;
  urlTokenPairsNotComparable: number;
  urlTokenPairsMissingFromBaseline: number;
  urlTokenPairsMissingFromCurrent: number;
  inputRowsTruncated: boolean;
  changes: AiCrawlerRobotsAuditReplayChange[];
  changesTruncated: boolean;
  note: string;
}

interface ParsedRequest {
  userAgent?: string;
  /** Used transiently for opt-in range matching; never copied to report data. */
  clientIp?: string;
  clientIpInvalid?: boolean;
  method: string;
  path: string;
  /** Transient exact UTM value; only configured source labels are retained in summaries. */
  utmSource?: string;
  utmSourceMarkerState?: 'single-value' | 'conflicting-values' | 'empty-or-oversized';
  status: number;
  originStatus?: number;
  responseContentType?: string;
  responseDurationMs?: number;
  timeToFirstByteMs?: number;
  cloudFrontResultType?: AiCrawlerCloudFrontResultType;
  cloudFrontResponseResultType?: AiCrawlerCloudFrontResultType;
  cloudflareBotScore?: number;
  cloudflareBotScoreSource?: CloudflareBotScoreSource | 'other';
  cloudflareVerifiedBotCategory?: string;
  cloudflareSecurityActionClasses?: CloudflareSecurityActionClass[];
  timestamp?: Date;
}

type MutablePath = Omit<
  AiCrawlerLogPath,
  | 'path'
  | 'statusCodes'
  | 'statusCodesTruncated'
  | 'originResponseStatusCodes'
  | 'originResponseStatusCodesTruncated'
  | 'responseContentTypes'
  | 'responseContentTypesTruncated'
  | 'firstSeenAt'
  | 'lastSeenAt'
  | 'daysBeforeLatestRequest'
> & {
  statusCodes: Map<number, number>;
  originResponseStatusCodes: Map<number, number>;
  responseContentTypes: Map<string, number>;
  responseContentTypesDropped: boolean;
  responseDurationBands: number[];
  timeToFirstByteBands: number[];
  cloudFrontResults: MutableCloudFrontResultProfile;
  cloudflareBotAnnotatedRequests: number;
  cloudflareVerifiedBotRequests: number;
  cloudflareVerifiedBotFailureRequests: number;
  cloudflareSecurityActionRequests: number;
  cloudflareBlockingFailureRequests: number;
  cloudflareChallengeFailureRequests: number;
  cloudflareChallengeResolvedFailureRequests: number;
  firstTimestamp?: number;
  lastTimestamp?: number;
};

interface MutableCrawler {
  definition: AiCrawlerDefinition;
  requests: number;
  responseClasses: AiCrawlerLogSummary['responseClasses'];
  responseDurationBands: number[];
  timeToFirstByteBands: number[];
  cloudFrontResults: MutableCloudFrontResultProfile;
  originStatusObservations: number;
  edgeOriginStatusDifferences: number;
  cloudflareBotRequests: number;
  cloudflareBotScoreGroups: AiCrawlerCloudflareBotEvidence['botScoreGroups'];
  cloudflareBotScoreObservations: number;
  cloudflareBotScoreSourceCounts: AiCrawlerCloudflareBotEvidence['botScoreSourceCounts'];
  cloudflareBotScoreSourceObservations: number;
  cloudflareVerifiedBotCategoryObservations: number;
  cloudflareVerifiedBotRequests: number;
  cloudflareVerifiedBotCategories: Map<string, number>;
  cloudflareVerifiedBotCategoriesDropped: boolean;
  cloudflareSecurityActions: AiCrawlerCloudflareSecurityActions;
  statusCodes: Map<number, number>;
  requestMethods: Map<string, number>;
  paths: Map<string, MutablePath>;
  dailyActivity: Map<string, MutableCrawlerDailyActivity>;
  timestamps: number[];
}

interface MutableIpRangeVerification {
  token: string;
  configuredCidrCount: number;
  userAgentMatchedRequests: number;
  requestsWithMatchedRange: number;
  requestsOutsideConfiguredRanges: number;
  requestsWithoutClientIp: number;
  requestsWithInvalidClientIp: number;
}

interface ParsedIpRangeSet {
  token: string;
  cidrs: Array<ReturnType<typeof ipaddr.parseCIDR>>;
}

function summarizeIpRangeVerification(
  verification: MutableIpRangeVerification
): AiCrawlerIpRangeVerification {
  return {
    configuredCidrCount: verification.configuredCidrCount,
    userAgentMatchedRequests: verification.userAgentMatchedRequests,
    requestsWithMatchedRange: verification.requestsWithMatchedRange,
    requestsOutsideConfiguredRanges: verification.requestsOutsideConfiguredRanges,
    requestsWithoutClientIp: verification.requestsWithoutClientIp,
    requestsWithInvalidClientIp: verification.requestsWithInvalidClientIp,
  };
}

interface MutableCrawlerDailyActivity {
  requests: number;
  successfulResponses: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  otherResponses: number;
  responseDurationBands: number[];
  timeToFirstByteBands: number[];
}

interface MutableCloudFrontResultProfile {
  resultTypes: number[];
  responseResultTypes: number[];
  pairedRequests: number;
  differingResultTypes: number;
}

interface MutableAiReferralPath {
  requests: number;
  responseClasses: AiCrawlerLogSummary['responseClasses'];
  statusCodes: Map<number, number>;
  responseContentTypes: Map<string, number>;
  responseContentTypesDropped: boolean;
  lastTimestamp?: number;
}

interface MutableAiReferralTraffic {
  source: string;
  requests: number;
  timestampedRequests: number;
  responseClasses: AiCrawlerLogSummary['responseClasses'];
  paths: Map<string, MutableAiReferralPath>;
  pathDetailsTruncated: boolean;
  dailyActivity: Map<string, number>;
  firstTimestamp?: number;
  lastTimestamp?: number;
}

const DEFAULT_MAX_LINES = 1_000_000;
const MAX_RETURNED_PATHS = 200;
const MAX_RETURNED_AI_REFERRAL_PATHS = 100;
const MAX_RETURNED_AI_REFERRAL_DAYS = 730;
const MAX_RETURNED_DAYS = 730;
const MAX_RETURNED_FAILURE_HOTSPOTS = 50;
const MAX_RETURNED_STATUS_CODES = 25;
const MAX_RETURNED_PATH_STATUS_CODES = 10;
const MAX_RETURNED_PATH_ORIGIN_STATUS_CODES = 10;
const MAX_RETURNED_PATH_CONTENT_TYPES = 5;
const MAX_TRACKED_PATH_CONTENT_TYPES = 64;
const AI_CRAWLER_TIMING_BANDS: AiCrawlerTimingBand[] = [
  '<=50ms',
  '51-100ms',
  '101-250ms',
  '251-500ms',
  '501-1000ms',
  '1001-2500ms',
  '2501-5000ms',
  '>5000ms',
];
const AI_CRAWLER_TIMING_UPPER_BOUNDS_MS = [
  50,
  100,
  250,
  500,
  1_000,
  2_500,
  5_000,
  Number.POSITIVE_INFINITY,
];
const AI_CRAWLER_CLOUDFRONT_RESULT_TYPES: AiCrawlerCloudFrontResultType[] = [
  'Hit',
  'RefreshHit',
  'Miss',
  'LimitExceeded',
  'CapacityExceeded',
  'Error',
  'Other',
];
const MAX_RETURNED_VERIFIED_BOT_CATEGORIES = 20;
const MAX_TRACKED_VERIFIED_BOT_CATEGORIES = 32;
const MAX_RETURNED_METHODS = 20;
const MAX_RETURNED_GEO_PATH_OBSERVATIONS = 2_000;
const MAX_RETURNED_GEO_OPPORTUNITIES = 100;
const MAX_RETURNED_SEARCH_CRAWLER_PATH_DISPARITIES = 500;
const MAX_RETURNED_ROBOTS_PATH_OBSERVATIONS = 2_000;
const MAX_RETURNED_ROBOTS_AUDIT_ROWS = 50_000;
const MAX_RETURNED_GEO_AUDIT_PATH_COVERAGE_ROWS = 50_000;
const MAX_RETURNED_AI_REFERRAL_AUDIT_PATHS = 2_000;
const MAX_RETURNED_SITEMAP_FRESHNESS_OPPORTUNITIES = 500;
const MAX_ROBOTS_AUDIT_URL_LENGTH = 8_192;
const KNOWN_TOKENS = [...AI_CRAWLER_CATALOG].sort(
  (left, right) => right.token.length - left.token.length
);
const DEFAULT_AI_REFERRAL_SOURCES = [{ label: 'ChatGPT (UTM)', value: 'chatgpt.com' }] as const;
const MAX_TRACKED_AI_REFERRAL_PATHS = 50_000;

function parseCommonTimestamp(value: string): Date | undefined {
  const match =
    /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(value);
  if (!match) return undefined;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months.findIndex((item) => item.toLowerCase() === match[2]?.toLowerCase());
  if (month < 0) return undefined;
  const localAsUtc = Date.UTC(
    Number(match[3]),
    month,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
  const offsetMinutes = (Number(match[8]) * 60 + Number(match[9])) * (match[7] === '+' ? 1 : -1);
  const date = new Date(localAsUtc - offsetMinutes * 60_000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseTimestamp(value: unknown): Date | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) >= 1_000_000_000_000 ? value : value * 1_000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const common = parseCommonTimestamp(value.trim());
  if (common) return common;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizedJsonFields(record: Record<string, unknown>): Map<string, unknown> {
  return new Map(
    Object.entries(record).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ''),
      value,
    ])
  );
}

function scalarString(
  record: Record<string, unknown>,
  fields: Map<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const value = record[key] ?? fields.get(normalizedKey);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function scalarValue(
  record: Record<string, unknown>,
  fields: Map<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const value = record[key] ?? fields.get(normalizedKey);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function normalizeRequestTarget(value: string):
  | {
      path: string;
      utmSource?: string;
      utmSourceMarkerState?: ParsedRequest['utmSourceMarkerState'];
    }
  | undefined {
  const target = value.trim();
  if (!target || target === '-') return undefined;
  try {
    const parsed = new URL(target, 'https://aviary.invalid');
    const path = (parsed.pathname || '/').slice(0, 2_048);
    const entries = [...parsed.searchParams.entries()].filter(
      ([key]) => key.toLowerCase() === 'utm_source'
    );
    const distinct = [
      ...new Set(entries.map(([, source]) => source.normalize('NFKC').trim().toLowerCase())),
    ];
    if (distinct.length === 0) return { path };
    if (distinct.length > 1) return { path, utmSourceMarkerState: 'conflicting-values' };
    const utmSource = distinct[0] ?? '';
    return utmSource && utmSource.length <= 128
      ? { path, utmSource, utmSourceMarkerState: 'single-value' }
      : { path, utmSourceMarkerState: 'empty-or-oversized' };
  } catch {
    const path = target.split(/[?#]/, 1)[0];
    return path ? { path: path.slice(0, 2_048) } : undefined;
  }
}

function parseRequestLine(target: string):
  | {
      method: string;
      path: string;
      utmSource?: string;
      utmSourceMarkerState?: ParsedRequest['utmSourceMarkerState'];
    }
  | undefined {
  const match = /^(\S{1,32})\s+(\S+)/.exec(target.trim());
  if (!match) return undefined;
  const normalized = normalizeRequestTarget(match[2] ?? '');
  if (!normalized) return undefined;
  return { method: (match[1] ?? 'UNKNOWN').toUpperCase(), ...normalized };
}

function normalizeContentType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const mediaType = value.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType &&
    mediaType.length <= 127 &&
    /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)
    ? mediaType
    : undefined;
}

function parseClientIp(value: unknown): Pick<ParsedRequest, 'clientIp' | 'clientIpInvalid'> {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'string') return { clientIpInvalid: true };
  const candidate = value.trim();
  if (!candidate || candidate === '-') return {};
  const valid = candidate.includes(':')
    ? !candidate.includes('%') && ipaddr.IPv6.isValid(candidate)
    : ipaddr.IPv4.isValidFourPartDecimal(candidate);
  return valid ? { clientIp: candidate } : { clientIpInvalid: true };
}

function parseIpRangeDefinitions(
  definitions: AiCrawlerIpRangeDefinition[] | undefined,
  customTokens: string[]
): Map<string, ParsedIpRangeSet> {
  const parsed = new Map<string, ParsedIpRangeSet>();
  if (!definitions) return parsed;
  if (!Array.isArray(definitions) || definitions.length < 1 || definitions.length > 100) {
    throw new Error('IP range configuration must define 1–100 crawler tokens.');
  }
  const knownTokens = new Set(
    [...AI_CRAWLER_CATALOG.map(({ token }) => token), ...customTokens].map((token) =>
      token.toLowerCase()
    )
  );
  let totalCidrs = 0;
  for (const definition of definitions) {
    if (
      !definition ||
      typeof definition.token !== 'string' ||
      !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(definition.token)
    ) {
      throw new Error(
        'Each IP range definition needs a crawler token of 1–64 letters, digits, dots, underscores, or hyphens.'
      );
    }
    const token = definition.token.trim();
    const tokenKey = token.toLowerCase();
    if (!knownTokens.has(tokenKey)) {
      throw new Error(
        `IP range configuration references unknown crawler token "${token}"; built-in tokens or --geo-crawler-token entries are accepted.`
      );
    }
    if (parsed.has(tokenKey))
      throw new Error(`IP range configuration defines crawler token "${token}" more than once.`);
    if (
      !Array.isArray(definition.cidrs) ||
      definition.cidrs.length < 1 ||
      definition.cidrs.length > 500
    ) {
      throw new Error(`IP range definition for "${token}" must contain 1–500 CIDR ranges.`);
    }
    const uniqueCidrs = new Set<string>();
    const cidrs: Array<ReturnType<typeof ipaddr.parseCIDR>> = [];
    for (const rawCidr of definition.cidrs) {
      if (typeof rawCidr !== 'string' || rawCidr.length > 80) {
        throw new Error(
          `IP ranges for "${token}" must be unique CIDR strings of at most 80 characters.`
        );
      }
      const cidr = rawCidr.trim();
      const cidrKey = cidr.toLowerCase();
      if (!cidr || uniqueCidrs.has(cidrKey)) {
        throw new Error(
          `IP ranges for "${token}" must be unique CIDR strings of at most 80 characters.`
        );
      }
      const isIpv6 = cidr.includes(':');
      const valid = isIpv6
        ? !cidr.includes('%') && ipaddr.IPv6.isValidCIDR(cidr)
        : ipaddr.IPv4.isValidCIDRFourPartDecimal(cidr);
      if (!valid)
        throw new Error(`Invalid or unsupported CIDR "${rawCidr}" for crawler token "${token}".`);
      uniqueCidrs.add(cidrKey);
      try {
        const parsedCidr = ipaddr.parseCIDR(cidr);
        const [network, prefix] = parsedCidr;
        if (network instanceof ipaddr.IPv6 && network.isIPv4MappedAddress()) {
          if (prefix < 96) throw new Error('Mapped ranges broader than /96 are not supported.');
          cidrs.push([network.toIPv4Address(), prefix - 96]);
        } else {
          cidrs.push(parsedCidr);
        }
      } catch {
        throw new Error(`Could not parse CIDR "${rawCidr}" for crawler token "${token}".`);
      }
    }
    totalCidrs += cidrs.length;
    if (totalCidrs > 5_000)
      throw new Error('IP range configuration is limited to 5,000 total CIDR ranges.');
    parsed.set(tokenKey, { token, cidrs });
  }
  return parsed;
}

function parseLogDurationMs(value: unknown, unitMultiplier: number): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const text = typeof value === 'string' ? value.trim() : String(value);
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(text)) return undefined;
  const milliseconds = Number(text) * unitMultiplier;
  return Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds <= 86_400_000
    ? milliseconds
    : undefined;
}

function emptyTimingBands(): number[] {
  return AI_CRAWLER_TIMING_BANDS.map(() => 0);
}

function addTimingSample(bands: number[], milliseconds: number | undefined): void {
  if (milliseconds === undefined) return;
  const bandIndex = AI_CRAWLER_TIMING_UPPER_BOUNDS_MS.findIndex(
    (upperBound) => milliseconds <= upperBound
  );
  if (bandIndex >= 0) bands[bandIndex] = (bands[bandIndex] ?? 0) + 1;
}

function summarizeTimingBands(bands: number[]): AiCrawlerTimingDistribution | undefined {
  const sampledRequests = bands.reduce((sum, count) => sum + count, 0);
  if (sampledRequests === 0) return undefined;
  const percentileBand = (percentile: number): AiCrawlerTimingBand => {
    const rank = Math.max(1, Math.ceil(sampledRequests * percentile));
    let cumulative = 0;
    for (let index = 0; index < AI_CRAWLER_TIMING_BANDS.length; index += 1) {
      cumulative += bands[index] ?? 0;
      if (cumulative >= rank) return AI_CRAWLER_TIMING_BANDS[index] ?? '>5000ms';
    }
    return '>5000ms';
  };
  return {
    sampledRequests,
    p50Band: percentileBand(0.5),
    p95Band: percentileBand(0.95),
    bands: AI_CRAWLER_TIMING_BANDS.map((band, index) => ({ band, requests: bands[index] ?? 0 })),
  };
}

function summarizeResponseTiming(
  responseDurationBands: number[],
  timeToFirstByteBands: number[]
): AiCrawlerResponseTiming | undefined {
  const responseDuration = summarizeTimingBands(responseDurationBands);
  const timeToFirstByte = summarizeTimingBands(timeToFirstByteBands);
  return responseDuration || timeToFirstByte
    ? {
        ...(responseDuration ? { responseDuration } : {}),
        ...(timeToFirstByte ? { timeToFirstByte } : {}),
      }
    : undefined;
}

function emptyCloudFrontResultProfile(): MutableCloudFrontResultProfile {
  return {
    resultTypes: AI_CRAWLER_CLOUDFRONT_RESULT_TYPES.map(() => 0),
    responseResultTypes: AI_CRAWLER_CLOUDFRONT_RESULT_TYPES.map(() => 0),
    pairedRequests: 0,
    differingResultTypes: 0,
  };
}

function normalizeCloudFrontResultType(
  value: string | undefined
): AiCrawlerCloudFrontResultType | undefined {
  if (!value || value.trim() === '-') return undefined;
  const normalized = value.trim().toLowerCase();
  return (
    AI_CRAWLER_CLOUDFRONT_RESULT_TYPES.find(
      (resultType) => resultType.toLowerCase() === normalized
    ) ?? 'Other'
  );
}

function addCloudFrontResult(
  profile: MutableCloudFrontResultProfile,
  resultType: AiCrawlerCloudFrontResultType | undefined,
  responseResultType: AiCrawlerCloudFrontResultType | undefined
): void {
  if (resultType) {
    const index = AI_CRAWLER_CLOUDFRONT_RESULT_TYPES.indexOf(resultType);
    if (index >= 0) profile.resultTypes[index] = (profile.resultTypes[index] ?? 0) + 1;
  }
  if (responseResultType) {
    const index = AI_CRAWLER_CLOUDFRONT_RESULT_TYPES.indexOf(responseResultType);
    if (index >= 0)
      profile.responseResultTypes[index] = (profile.responseResultTypes[index] ?? 0) + 1;
  }
  if (resultType && responseResultType) {
    profile.pairedRequests += 1;
    if (resultType !== responseResultType) profile.differingResultTypes += 1;
  }
}

function summarizeCloudFrontResults(
  profile: MutableCloudFrontResultProfile
): AiCrawlerCloudFrontResultProfile | undefined {
  const resultCount = profile.resultTypes.reduce((sum, count) => sum + count, 0);
  const responseResultCount = profile.responseResultTypes.reduce((sum, count) => sum + count, 0);
  if (resultCount === 0 && responseResultCount === 0) return undefined;
  const rows = (counts: number[]) =>
    AI_CRAWLER_CLOUDFRONT_RESULT_TYPES.flatMap((resultType, index) => {
      const requests = counts[index] ?? 0;
      return requests > 0 ? [{ resultType, requests }] : [];
    });
  return {
    requestsWithResultType: resultCount,
    resultTypes: rows(profile.resultTypes),
    requestsWithResponseResultType: responseResultCount,
    responseResultTypes: rows(profile.responseResultTypes),
    pairedRequests: profile.pairedRequests,
    differingResultTypes: profile.differingResultTypes,
  };
}

function classifyCloudflareSecurityAction(
  value: string
): CloudflareSecurityActionClass | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!normalized || normalized === '-') return undefined;
  if (['block', 'connectionclose', 'forceconnectionclose'].includes(normalized)) return 'blocking';
  if (
    ['challenge', 'jschallenge', 'managedchallenge', 'precursorinterstitialpageissued'].includes(
      normalized
    )
  )
    return 'challenge';
  if (
    [
      'challengesolved',
      'challengebypassed',
      'jschallengesolved',
      'jschallengebypassed',
      'managedchallengenoninteractivesolved',
      'managedchallengeinteractivesolved',
      'managedchallengebypassed',
      'precursorinterstitialpagebypassed',
      'precursorinterstitialpagesolved',
    ].includes(normalized)
  )
    return 'challenge-solved-or-bypassed';
  if (['allow', 'bypass', 'skip'].includes(normalized)) return 'allow-bypass-or-skip';
  return 'other';
}

function parseJsonLine(line: string): ParsedRequest | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const fields = normalizedJsonFields(record);
  const statusText = scalarString(record, fields, [
    'status',
    'status_code',
    'statusCode',
    'sc_status',
    'response_status',
    'EdgeResponseStatus',
  ]);
  const originStatusText = scalarString(record, fields, [
    'origin_status',
    'origin_response_status',
    'OriginResponseStatus',
  ]);
  const status = Number(statusText ?? originStatusText);
  if (!Number.isInteger(status) || (status !== 0 && (status < 100 || status > 599)))
    return undefined;
  const parsedOriginStatus =
    statusText !== undefined && originStatusText !== undefined
      ? Number(originStatusText)
      : undefined;
  const originStatus =
    parsedOriginStatus !== undefined &&
    Number.isInteger(parsedOriginStatus) &&
    (parsedOriginStatus === 0 || (parsedOriginStatus >= 100 && parsedOriginStatus <= 599))
      ? parsedOriginStatus
      : undefined;
  const target = scalarString(record, fields, [
    'path',
    'url',
    'request_uri',
    'requestUri',
    'uri',
    'request_url',
    'requestUrl',
    'cs_uri_stem',
    'request',
    'ClientRequestURI',
    'ClientRequestURL',
    'ClientRequestPath',
  ]);
  if (!target) return undefined;
  const query = scalarString(record, fields, [
    'cs_uri_query',
    'request_query',
    'ClientRequestQuery',
  ]);
  const requestTarget =
    query && query !== '-'
      ? `${target}${target.includes('?') ? '&' : '?'}${query.replace(/^\?/, '')}`
      : target;
  const method = scalarString(record, fields, [
    'method',
    'request_method',
    'requestMethod',
    'http_method',
    'httpMethod',
    'verb',
    'cs_method',
    'ClientRequestMethod',
  ]);
  const request =
    parseRequestLine(requestTarget) ??
    (() => {
      const normalized = normalizeRequestTarget(requestTarget);
      return normalized
        ? { method: method?.slice(0, 32).toUpperCase() ?? 'UNKNOWN', ...normalized }
        : undefined;
    })();
  if (!request) return undefined;
  const userAgent = scalarString(record, fields, [
    'user_agent',
    'userAgent',
    'http_user_agent',
    'httpUserAgent',
    'ua',
    'agent',
    'cs_user_agent',
    'ClientRequestUserAgent',
  ]);
  const clientIpFields = parseClientIp(
    scalarValue(record, fields, [
      'c-ip',
      'ClientIP',
      'ClientIp',
      'ClientRequestIP',
      'ClientRequestClientIP',
      'client_ip',
      'remote_addr',
      'remoteAddress',
      'source_ip',
      'sourceIp',
    ])
  );
  const responseContentType = normalizeContentType(
    scalarString(record, fields, [
      'content_type',
      'contentType',
      'response_content_type',
      'sc_content_type',
      'EdgeResponseContentType',
      'OriginResponseContentType',
    ])
  );
  const responseDurationMs =
    parseLogDurationMs(
      scalarValue(record, fields, [
        'time-taken',
        'timeTaken',
        'request_time',
        'requestTime',
        'response_time_seconds',
        'responseTimeSeconds',
        'duration_seconds',
        'durationSeconds',
      ]),
      1_000
    ) ??
    parseLogDurationMs(
      scalarValue(record, fields, [
        'response_time_ms',
        'responseTimeMs',
        'request_time_ms',
        'requestTimeMs',
        'duration_ms',
        'durationMs',
      ]),
      1
    );
  const timeToFirstByteMs =
    parseLogDurationMs(
      scalarValue(record, fields, [
        'time-to-first-byte',
        'timeToFirstByte',
        'time_to_first_byte',
        'ttfb_seconds',
        'ttfbSeconds',
      ]),
      1_000
    ) ??
    parseLogDurationMs(
      scalarValue(record, fields, [
        'time_to_first_byte_ms',
        'timeToFirstByteMs',
        'ttfb_ms',
        'ttfbMs',
      ]),
      1
    );
  const cloudFrontResultType = normalizeCloudFrontResultType(
    scalarString(record, fields, ['x-edge-result-type', 'edgeResultType', 'cloudFrontResultType'])
  );
  const cloudFrontResponseResultType = normalizeCloudFrontResultType(
    scalarString(record, fields, [
      'x-edge-response-result-type',
      'edgeResponseResultType',
      'cloudFrontResponseResultType',
    ])
  );
  const rawBotScore = scalarValue(record, fields, ['BotScore', 'bot_score', 'botScore']);
  const parsedBotScore =
    typeof rawBotScore === 'number'
      ? rawBotScore
      : typeof rawBotScore === 'string' && /^\d{1,3}$/.test(rawBotScore.trim())
        ? Number(rawBotScore.trim())
        : Number.NaN;
  const cloudflareBotScore =
    Number.isInteger(parsedBotScore) && parsedBotScore >= 0 && parsedBotScore <= 99
      ? parsedBotScore
      : undefined;
  const rawBotScoreSource = scalarString(record, fields, [
    'BotScoreSrc',
    'bot_score_src',
    'botScoreSource',
  ]);
  const knownBotScoreSources: CloudflareBotScoreSource[] = [
    'Not Computed',
    'Heuristics',
    'Machine Learning',
    'Behavioral Analysis',
    'Verified Bot',
    'JS Fingerprinting',
    'Cloudflare Service',
  ];
  const cloudflareBotScoreSource =
    rawBotScoreSource && rawBotScoreSource !== '-'
      ? (knownBotScoreSources.find(
          (source) => source.toLowerCase() === rawBotScoreSource.toLowerCase()
        ) ?? 'other')
      : undefined;
  const rawVerifiedBotCategory = scalarString(record, fields, [
    'VerifiedBotCategory',
    'verified_bot_category',
    'verifiedBotCategory',
  ]);
  const cloudflareVerifiedBotCategory =
    rawVerifiedBotCategory && rawVerifiedBotCategory !== '-'
      ? rawVerifiedBotCategory
          .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
          .trim()
          .slice(0, 80) || undefined
      : undefined;
  const rawSecurityActions = scalarValue(record, fields, [
    'SecurityActions',
    'security_actions',
    'securityActions',
  ]);
  const rawSingularSecurityAction = scalarValue(record, fields, [
    'SecurityAction',
    'security_action',
    'securityAction',
  ]);
  const securityActionValues = [
    ...(Array.isArray(rawSecurityActions)
      ? rawSecurityActions.filter((value): value is string => typeof value === 'string')
      : typeof rawSecurityActions === 'string'
        ? [rawSecurityActions]
        : []),
    ...(typeof rawSingularSecurityAction === 'string' ? [rawSingularSecurityAction] : []),
  ];
  const cloudflareSecurityActionClasses = [
    ...new Set(
      securityActionValues
        .map(classifyCloudflareSecurityAction)
        .filter((value): value is CloudflareSecurityActionClass => value !== undefined)
    ),
  ];
  const timestamp =
    parseTimestamp(
      scalarValue(record, fields, [
        'timestamp',
        '@timestamp',
        'datetime',
        'ts',
        'EdgeStartTimestamp',
      ])
    ) ??
    parseTimestamp(scalarValue(record, fields, ['time'])) ??
    (() => {
      const date = scalarString(record, fields, ['date']);
      const time = scalarString(record, fields, ['time']);
      return date && time ? parseTimestamp(`${date}T${time.replace(/Z$/i, '')}Z`) : undefined;
    })();
  return {
    ...request,
    status,
    ...clientIpFields,
    ...(originStatus !== undefined ? { originStatus } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(responseContentType ? { responseContentType } : {}),
    ...(responseDurationMs !== undefined ? { responseDurationMs } : {}),
    ...(timeToFirstByteMs !== undefined ? { timeToFirstByteMs } : {}),
    ...(cloudFrontResultType ? { cloudFrontResultType } : {}),
    ...(cloudFrontResponseResultType ? { cloudFrontResponseResultType } : {}),
    ...(cloudflareBotScore !== undefined ? { cloudflareBotScore } : {}),
    ...(cloudflareBotScoreSource ? { cloudflareBotScoreSource } : {}),
    ...(cloudflareVerifiedBotCategory ? { cloudflareVerifiedBotCategory } : {}),
    ...(cloudflareSecurityActionClasses.length > 0 ? { cloudflareSecurityActionClasses } : {}),
    ...(timestamp ? { timestamp } : {}),
  };
}

function parseCloudFrontLine(line: string, headerFields: string[]): ParsedRequest | undefined {
  const values = line.split('\t');
  if (values.length < headerFields.length) return undefined;
  const fields = new Map(
    headerFields.map((field, index) => [
      field.toLowerCase().replace(/[^a-z0-9]/g, ''),
      values[index] ?? '',
    ])
  );
  const get = (...names: string[]): string | undefined => {
    for (const name of names) {
      const value = fields.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''))?.trim();
      if (value && value !== '-') return value;
    }
    return undefined;
  };
  const statusText = get('sc-status');
  const status = Number(statusText);
  if (!Number.isInteger(status) || (status !== 0 && (status < 100 || status > 599)))
    return undefined;
  const method = get('cs-method') ?? 'UNKNOWN';
  const target = get('cs-uri-stem', 'cs-uri');
  if (!target) return undefined;
  const query = get('cs-uri-query');
  const requestTarget = query
    ? `${target}${target.includes('?') ? '&' : '?'}${query.replace(/^\?/, '')}`
    : target;
  const request = parseRequestLine(`${method} ${requestTarget}`);
  if (!request) return undefined;
  const userAgent = get('cs(User-Agent)');
  const clientIpFields = parseClientIp(get('c-ip'));
  const responseContentType = normalizeContentType(get('sc-content-type'));
  const responseDurationMs = parseLogDurationMs(get('time-taken'), 1_000);
  const timeToFirstByteMs = parseLogDurationMs(get('time-to-first-byte'), 1_000);
  const cloudFrontResultType = normalizeCloudFrontResultType(get('x-edge-result-type'));
  const cloudFrontResponseResultType = normalizeCloudFrontResultType(
    get('x-edge-response-result-type')
  );
  const date = get('date');
  const time = get('time');
  const timestamp =
    date && time ? parseTimestamp(`${date}T${time.replace(/Z$/i, '')}Z`) : undefined;
  return {
    ...request,
    status,
    ...clientIpFields,
    ...(userAgent ? { userAgent } : {}),
    ...(responseContentType ? { responseContentType } : {}),
    ...(responseDurationMs !== undefined ? { responseDurationMs } : {}),
    ...(timeToFirstByteMs !== undefined ? { timeToFirstByteMs } : {}),
    ...(cloudFrontResultType ? { cloudFrontResultType } : {}),
    ...(cloudFrontResponseResultType ? { cloudFrontResponseResultType } : {}),
    ...(timestamp ? { timestamp } : {}),
  };
}

function parseCombinedLine(line: string): ParsedRequest | undefined {
  const match =
    /^\S+\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"((?:\\.|[^"\\])*)"\s+(\d{3})\s+\S+(?:\s+"(?:\\.|[^"\\])*"\s+"((?:\\.|[^"\\])*)")?.*$/.exec(
      line
    );
  if (!match) return undefined;
  const request = parseRequestLine((match[2] ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  const status = Number(match[3]);
  if (!request || status < 100 || status > 599) return undefined;
  const userAgent = (match[4] ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  const clientIpFields = parseClientIp(line.trim().split(/\s+/, 1)[0]);
  const timestamp = parseCommonTimestamp(match[1] ?? '');
  return {
    ...request,
    status,
    ...clientIpFields,
    ...(userAgent ? { userAgent } : {}),
    ...(timestamp ? { timestamp } : {}),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function identifyCrawler(
  userAgent: string,
  customDefinitions: AiCrawlerDefinition[]
): AiCrawlerDefinition | undefined {
  const lower = userAgent.toLowerCase();
  const definitions = [...KNOWN_TOKENS, ...customDefinitions].sort(
    (left, right) => right.token.length - left.token.length
  );
  return definitions.find(({ token }) =>
    new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(token.toLowerCase())}(?:$|[^a-z0-9])`).test(lower)
  );
}

function responseClass(status: number): keyof AiCrawlerLogSummary['responseClasses'] {
  if (status >= 200 && status < 300) return 'successful2xx';
  if (status >= 300 && status < 400) return 'redirects3xx';
  if (status >= 400 && status < 500) return 'clientErrors4xx';
  if (status >= 500 && status < 600) return 'serverErrors5xx';
  return 'other';
}

function createAiReferralTraffic(source: string): MutableAiReferralTraffic {
  return {
    source,
    requests: 0,
    timestampedRequests: 0,
    responseClasses: {
      successful2xx: 0,
      redirects3xx: 0,
      clientErrors4xx: 0,
      serverErrors5xx: 0,
      other: 0,
    },
    paths: new Map(),
    pathDetailsTruncated: false,
    dailyActivity: new Map(),
  };
}

function addAiReferralRequest(summary: MutableAiReferralTraffic, request: ParsedRequest): void {
  summary.requests += 1;
  const classification = responseClass(request.status);
  summary.responseClasses[classification] += 1;
  let path = summary.paths.get(request.path);
  if (!path && summary.paths.size < MAX_TRACKED_AI_REFERRAL_PATHS) {
    path = {
      requests: 0,
      responseClasses: {
        successful2xx: 0,
        redirects3xx: 0,
        clientErrors4xx: 0,
        serverErrors5xx: 0,
        other: 0,
      },
      statusCodes: new Map(),
      responseContentTypes: new Map(),
      responseContentTypesDropped: false,
    };
    summary.paths.set(request.path, path);
  } else if (!path) {
    summary.pathDetailsTruncated = true;
  }
  if (path) {
    path.requests += 1;
    path.responseClasses[classification] += 1;
    path.statusCodes.set(request.status, (path.statusCodes.get(request.status) ?? 0) + 1);
    if (request.responseContentType) {
      if (path.responseContentTypes.has(request.responseContentType)) {
        path.responseContentTypes.set(
          request.responseContentType,
          (path.responseContentTypes.get(request.responseContentType) ?? 0) + 1
        );
      } else if (path.responseContentTypes.size < MAX_TRACKED_PATH_CONTENT_TYPES) {
        path.responseContentTypes.set(request.responseContentType, 1);
      } else {
        path.responseContentTypesDropped = true;
      }
    }
  }
  if (request.timestamp) {
    const timestamp = request.timestamp.getTime();
    summary.timestampedRequests += 1;
    summary.firstTimestamp =
      summary.firstTimestamp === undefined
        ? timestamp
        : Math.min(summary.firstTimestamp, timestamp);
    summary.lastTimestamp =
      summary.lastTimestamp === undefined ? timestamp : Math.max(summary.lastTimestamp, timestamp);
    if (path)
      path.lastTimestamp =
        path.lastTimestamp === undefined ? timestamp : Math.max(path.lastTimestamp, timestamp);
    const date = request.timestamp.toISOString().slice(0, 10);
    summary.dailyActivity.set(date, (summary.dailyActivity.get(date) ?? 0) + 1);
  }
}

function summarizeAiReferralTraffic(summary: MutableAiReferralTraffic): AiReferralTrafficSummary {
  const paths = [...summary.paths.entries()]
    .map(([path, value]): AiReferralTrafficPathSummary => {
      const statusCodes = [...value.statusCodes.entries()]
        .map(([status, requests]) => ({ status, requests }))
        .sort((left, right) => right.requests - left.requests || left.status - right.status);
      const responseContentTypes = [...value.responseContentTypes.entries()]
        .map(([contentType, requests]) => ({ contentType, requests }))
        .sort(
          (left, right) =>
            right.requests - left.requests || left.contentType.localeCompare(right.contentType)
        );
      return {
        path,
        requests: value.requests,
        responseClasses: value.responseClasses,
        statusCodes: statusCodes.slice(0, MAX_RETURNED_PATH_STATUS_CODES),
        statusCodesTruncated: statusCodes.length > MAX_RETURNED_PATH_STATUS_CODES,
        responseContentTypes: responseContentTypes.slice(0, MAX_RETURNED_PATH_CONTENT_TYPES),
        responseContentTypesTruncated:
          value.responseContentTypesDropped ||
          responseContentTypes.length > MAX_RETURNED_PATH_CONTENT_TYPES,
        ...(value.lastTimestamp !== undefined
          ? { lastSeenAt: new Date(value.lastTimestamp).toISOString() }
          : {}),
      };
    })
    .sort((left, right) => right.requests - left.requests || left.path.localeCompare(right.path));
  const dailyActivity = [...summary.dailyActivity.entries()]
    .map(([date, requests]) => ({ date, requests }))
    .sort((left, right) => left.date.localeCompare(right.date));
  return {
    source: summary.source,
    requests: summary.requests,
    uniquePaths: summary.paths.size,
    uniquePathsTruncated: summary.pathDetailsTruncated,
    timestampedRequests: summary.timestampedRequests,
    responseClasses: summary.responseClasses,
    ...(summary.firstTimestamp !== undefined
      ? { firstSeenAt: new Date(summary.firstTimestamp).toISOString() }
      : {}),
    ...(summary.lastTimestamp !== undefined
      ? { lastSeenAt: new Date(summary.lastTimestamp).toISOString() }
      : {}),
    paths: paths.slice(0, MAX_RETURNED_AI_REFERRAL_PATHS),
    pathsTruncated:
      summary.paths.size > MAX_RETURNED_AI_REFERRAL_PATHS || summary.pathDetailsTruncated,
    dailyActivity: dailyActivity.slice(-MAX_RETURNED_AI_REFERRAL_DAYS),
    dailyActivityTruncated: dailyActivity.length > MAX_RETURNED_AI_REFERRAL_DAYS,
  };
}

function createCrawler(definition: AiCrawlerDefinition): MutableCrawler {
  return {
    definition,
    requests: 0,
    responseClasses: {
      successful2xx: 0,
      redirects3xx: 0,
      clientErrors4xx: 0,
      serverErrors5xx: 0,
      other: 0,
    },
    responseDurationBands: emptyTimingBands(),
    timeToFirstByteBands: emptyTimingBands(),
    cloudFrontResults: emptyCloudFrontResultProfile(),
    originStatusObservations: 0,
    edgeOriginStatusDifferences: 0,
    cloudflareBotRequests: 0,
    cloudflareBotScoreGroups: { notComputed: 0, automated: 0, likelyAutomated: 0, likelyHuman: 0 },
    cloudflareBotScoreObservations: 0,
    cloudflareBotScoreSourceCounts: {
      'Not Computed': 0,
      Heuristics: 0,
      'Machine Learning': 0,
      'Behavioral Analysis': 0,
      'Verified Bot': 0,
      'JS Fingerprinting': 0,
      'Cloudflare Service': 0,
      other: 0,
    },
    cloudflareBotScoreSourceObservations: 0,
    cloudflareVerifiedBotCategoryObservations: 0,
    cloudflareVerifiedBotRequests: 0,
    cloudflareVerifiedBotCategories: new Map(),
    cloudflareVerifiedBotCategoriesDropped: false,
    cloudflareSecurityActions: {
      requestsWithSecurityActions: 0,
      blockingRequests: 0,
      challengeRequests: 0,
      challengeSolvedOrBypassedRequests: 0,
      allowBypassOrSkipRequests: 0,
      otherActionRequests: 0,
    },
    statusCodes: new Map(),
    requestMethods: new Map(),
    paths: new Map(),
    dailyActivity: new Map(),
    timestamps: [],
  };
}

function addRequest(crawler: MutableCrawler, request: ParsedRequest): void {
  crawler.requests += 1;
  crawler.responseClasses[responseClass(request.status)] += 1;
  crawler.statusCodes.set(request.status, (crawler.statusCodes.get(request.status) ?? 0) + 1);
  crawler.requestMethods.set(request.method, (crawler.requestMethods.get(request.method) ?? 0) + 1);
  addCloudFrontResult(
    crawler.cloudFrontResults,
    request.cloudFrontResultType,
    request.cloudFrontResponseResultType
  );
  if (
    request.cloudflareBotScore !== undefined ||
    request.cloudflareBotScoreSource !== undefined ||
    request.cloudflareVerifiedBotCategory !== undefined
  ) {
    crawler.cloudflareBotRequests += 1;
  }
  if (request.cloudflareBotScore !== undefined) {
    crawler.cloudflareBotScoreObservations += 1;
    if (request.cloudflareBotScore === 0) crawler.cloudflareBotScoreGroups.notComputed += 1;
    else if (request.cloudflareBotScore === 1) crawler.cloudflareBotScoreGroups.automated += 1;
    else if (request.cloudflareBotScore < 30) crawler.cloudflareBotScoreGroups.likelyAutomated += 1;
    else crawler.cloudflareBotScoreGroups.likelyHuman += 1;
  }
  if (request.cloudflareBotScoreSource !== undefined) {
    crawler.cloudflareBotScoreSourceObservations += 1;
    crawler.cloudflareBotScoreSourceCounts[request.cloudflareBotScoreSource] += 1;
  }
  if (request.cloudflareVerifiedBotCategory !== undefined) {
    crawler.cloudflareVerifiedBotCategoryObservations += 1;
    if (crawler.cloudflareVerifiedBotCategories.has(request.cloudflareVerifiedBotCategory)) {
      crawler.cloudflareVerifiedBotCategories.set(
        request.cloudflareVerifiedBotCategory,
        (crawler.cloudflareVerifiedBotCategories.get(request.cloudflareVerifiedBotCategory) ?? 0) +
          1
      );
    } else if (crawler.cloudflareVerifiedBotCategories.size < MAX_TRACKED_VERIFIED_BOT_CATEGORIES) {
      crawler.cloudflareVerifiedBotCategories.set(request.cloudflareVerifiedBotCategory, 1);
    } else {
      crawler.cloudflareVerifiedBotCategoriesDropped = true;
    }
  }
  if (
    request.cloudflareVerifiedBotCategory !== undefined ||
    request.cloudflareBotScoreSource === 'Verified Bot'
  ) {
    crawler.cloudflareVerifiedBotRequests += 1;
  }
  const securityActionClasses = request.cloudflareSecurityActionClasses ?? [];
  if (securityActionClasses.length > 0)
    crawler.cloudflareSecurityActions.requestsWithSecurityActions += 1;
  for (const actionClass of securityActionClasses) {
    if (actionClass === 'blocking') crawler.cloudflareSecurityActions.blockingRequests += 1;
    else if (actionClass === 'challenge') crawler.cloudflareSecurityActions.challengeRequests += 1;
    else if (actionClass === 'challenge-solved-or-bypassed')
      crawler.cloudflareSecurityActions.challengeSolvedOrBypassedRequests += 1;
    else if (actionClass === 'allow-bypass-or-skip')
      crawler.cloudflareSecurityActions.allowBypassOrSkipRequests += 1;
    else crawler.cloudflareSecurityActions.otherActionRequests += 1;
  }
  const path: MutablePath = crawler.paths.get(request.path) ?? {
    requests: 0,
    statusCodes: new Map<number, number>(),
    originResponseStatusCodes: new Map<number, number>(),
    edgeOriginStatusDifferences: 0,
    responseContentTypes: new Map<string, number>(),
    responseContentTypesDropped: false,
    responseDurationBands: emptyTimingBands(),
    timeToFirstByteBands: emptyTimingBands(),
    cloudFrontResults: emptyCloudFrontResultProfile(),
    cloudflareBotAnnotatedRequests: 0,
    cloudflareVerifiedBotRequests: 0,
    cloudflareVerifiedBotFailureRequests: 0,
    cloudflareSecurityActionRequests: 0,
    cloudflareBlockingFailureRequests: 0,
    cloudflareChallengeFailureRequests: 0,
    cloudflareChallengeResolvedFailureRequests: 0,
    timestampedRequests: 0,
    successfulResponses: 0,
    redirects: 0,
    clientErrors: 0,
    serverErrors: 0,
    otherResponses: 0,
  };
  const hasCloudflareBotSignal =
    request.cloudflareBotScore !== undefined ||
    request.cloudflareBotScoreSource !== undefined ||
    request.cloudflareVerifiedBotCategory !== undefined;
  const hasCloudflareVerifiedBotSignal =
    request.cloudflareVerifiedBotCategory !== undefined ||
    request.cloudflareBotScoreSource === 'Verified Bot';
  if (hasCloudflareBotSignal) path.cloudflareBotAnnotatedRequests += 1;
  if (hasCloudflareVerifiedBotSignal) {
    path.cloudflareVerifiedBotRequests += 1;
    if (
      responseClass(request.status) === 'clientErrors4xx' ||
      responseClass(request.status) === 'serverErrors5xx'
    ) {
      path.cloudflareVerifiedBotFailureRequests += 1;
    }
  }
  if (securityActionClasses.length > 0) {
    path.cloudflareSecurityActionRequests += 1;
    const isFailure =
      responseClass(request.status) === 'clientErrors4xx' ||
      responseClass(request.status) === 'serverErrors5xx';
    if (isFailure && securityActionClasses.includes('blocking'))
      path.cloudflareBlockingFailureRequests += 1;
    if (isFailure && securityActionClasses.includes('challenge'))
      path.cloudflareChallengeFailureRequests += 1;
    if (isFailure && securityActionClasses.includes('challenge-solved-or-bypassed'))
      path.cloudflareChallengeResolvedFailureRequests += 1;
  }
  path.requests += 1;
  addCloudFrontResult(
    path.cloudFrontResults,
    request.cloudFrontResultType,
    request.cloudFrontResponseResultType
  );
  addTimingSample(crawler.responseDurationBands, request.responseDurationMs);
  addTimingSample(crawler.timeToFirstByteBands, request.timeToFirstByteMs);
  addTimingSample(path.responseDurationBands, request.responseDurationMs);
  addTimingSample(path.timeToFirstByteBands, request.timeToFirstByteMs);
  path.statusCodes.set(request.status, (path.statusCodes.get(request.status) ?? 0) + 1);
  if (request.originStatus !== undefined) {
    crawler.originStatusObservations += 1;
    path.originResponseStatusCodes.set(
      request.originStatus,
      (path.originResponseStatusCodes.get(request.originStatus) ?? 0) + 1
    );
    if (request.originStatus !== request.status) {
      crawler.edgeOriginStatusDifferences += 1;
      path.edgeOriginStatusDifferences += 1;
    }
  }
  if (request.responseContentType) {
    if (path.responseContentTypes.has(request.responseContentType)) {
      path.responseContentTypes.set(
        request.responseContentType,
        (path.responseContentTypes.get(request.responseContentType) ?? 0) + 1
      );
    } else if (path.responseContentTypes.size < MAX_TRACKED_PATH_CONTENT_TYPES) {
      path.responseContentTypes.set(request.responseContentType, 1);
    } else {
      path.responseContentTypesDropped = true;
    }
  }
  const category = responseClass(request.status);
  if (category === 'successful2xx') path.successfulResponses += 1;
  else if (category === 'redirects3xx') path.redirects += 1;
  else if (category === 'clientErrors4xx') path.clientErrors += 1;
  else if (category === 'serverErrors5xx') path.serverErrors += 1;
  else path.otherResponses += 1;
  crawler.paths.set(request.path, path);
  if (request.timestamp) {
    const epoch = request.timestamp.getTime();
    path.timestampedRequests += 1;
    path.firstTimestamp =
      path.firstTimestamp === undefined ? epoch : Math.min(path.firstTimestamp, epoch);
    path.lastTimestamp =
      path.lastTimestamp === undefined ? epoch : Math.max(path.lastTimestamp, epoch);
    crawler.timestamps.push(epoch);
    const date = request.timestamp.toISOString().slice(0, 10);
    const daily = crawler.dailyActivity.get(date) ?? {
      requests: 0,
      successfulResponses: 0,
      redirects: 0,
      clientErrors: 0,
      serverErrors: 0,
      otherResponses: 0,
      responseDurationBands: emptyTimingBands(),
      timeToFirstByteBands: emptyTimingBands(),
    };
    daily.requests += 1;
    addTimingSample(daily.responseDurationBands, request.responseDurationMs);
    addTimingSample(daily.timeToFirstByteBands, request.timeToFirstByteMs);
    if (category === 'successful2xx') daily.successfulResponses += 1;
    if (category === 'redirects3xx') daily.redirects += 1;
    if (category === 'clientErrors4xx') daily.clientErrors += 1;
    if (category === 'serverErrors5xx') daily.serverErrors += 1;
    if (category === 'other') daily.otherResponses += 1;
    crawler.dailyActivity.set(date, daily);
  }
}

/** Compare HTTP status-code and response-class availability within one activity class on exact normalized paths. */
function compareCrawlerPathResponses(
  crawlers: AiCrawlerLogSummary[],
  activity: AiCrawlerPathResponseComparison['activity']
): AiCrawlerPathResponseComparison {
  const activityCrawlers = crawlers.filter((crawler) => crawler.activity === activity);
  const byPath = new Map<string, AiCrawlerPathResponseProfile[]>();
  for (const crawler of activityCrawlers) {
    for (const path of crawler.paths) {
      const profiles = byPath.get(path.path) ?? [];
      profiles.push({
        crawlerToken: crawler.token,
        provider: crawler.provider,
        requests: path.requests,
        successfulResponses: path.successfulResponses,
        redirects: path.redirects,
        clientErrors: path.clientErrors,
        serverErrors: path.serverErrors,
        otherResponses: path.otherResponses,
        statusCodes: path.statusCodes,
        statusCodesTruncated: path.statusCodesTruncated,
        responseContentTypes: path.responseContentTypes,
        responseContentTypesTruncated: path.responseContentTypesTruncated,
      });
      byPath.set(path.path, profiles);
    }
  }

  let sharedPathsCompared = 0;
  let pathsWithDifferentResponseClasses = 0;
  let pathsWithDifferentStatusCodeSets = 0;
  let pathsWithDifferentContentTypeSets = 0;
  let pathsWithSuccessFailureSplit = 0;
  let pathsWithTruncatedStatusCodeDetails = 0;
  let pathsWithTruncatedContentTypeDetails = 0;
  const disparities: AiCrawlerPathResponseDisparity[] = [];
  for (const [path, profiles] of byPath) {
    if (profiles.length < 2) continue;
    sharedPathsCompared += 1;
    const statusCodeDetailsTruncated = profiles.some(
      ({ statusCodesTruncated }) => statusCodesTruncated
    );
    if (statusCodeDetailsTruncated) pathsWithTruncatedStatusCodeDetails += 1;
    const contentTypeDetailsTruncated = profiles.some(
      ({ responseContentTypesTruncated }) => responseContentTypesTruncated
    );
    if (contentTypeDetailsTruncated) pathsWithTruncatedContentTypeDetails += 1;
    const classProfiles = new Set(
      profiles.map((profile) =>
        [
          profile.successfulResponses > 0,
          profile.redirects > 0,
          profile.clientErrors > 0,
          profile.serverErrors > 0,
          profile.otherResponses > 0,
        ]
          .map(Number)
          .join('')
      )
    );
    const hasDifferentResponseClasses = classProfiles.size > 1;
    if (hasDifferentResponseClasses) pathsWithDifferentResponseClasses += 1;
    const statusCodeSets = new Set(
      profiles.map((profile) =>
        profile.statusCodes
          .map(({ status }) => status)
          .sort((left, right) => left - right)
          .join(',')
      )
    );
    const hasDifferentStatusCodeSets = statusCodeSets.size > 1;
    if (hasDifferentStatusCodeSets) pathsWithDifferentStatusCodeSets += 1;
    const profilesWithContentTypeData = profiles.filter(
      (profile) => profile.responseContentTypes.length > 0
    );
    const contentTypeSets = new Set(
      profilesWithContentTypeData.map((profile) =>
        profile.responseContentTypes
          .map(({ contentType }) => contentType)
          .sort()
          .join(',')
      )
    );
    const hasDifferentContentTypeSets =
      profilesWithContentTypeData.length > 1 && contentTypeSets.size > 1;
    if (hasDifferentContentTypeSets) pathsWithDifferentContentTypeSets += 1;
    if (!hasDifferentResponseClasses && !hasDifferentStatusCodeSets && !hasDifferentContentTypeSets)
      continue;
    const hasSuccessFailureSplit = profiles.some(
      (profile) =>
        profile.successfulResponses > 0 &&
        profiles.some(
          (other) =>
            other.crawlerToken !== profile.crawlerToken &&
            (other.clientErrors > 0 || other.serverErrors > 0)
        )
    );
    if (hasSuccessFailureSplit) pathsWithSuccessFailureSplit += 1;
    disparities.push({
      path,
      observedCrawlerCount: profiles.length,
      hasDifferentStatusCodeSets,
      statusCodeDetailsTruncated,
      hasDifferentContentTypeSets,
      contentTypeDetailsTruncated,
      hasSuccessFailureSplit,
      crawlers: profiles.sort((left, right) => left.crawlerToken.localeCompare(right.crawlerToken)),
    });
  }
  disparities.sort(
    (left, right) =>
      Number(right.hasSuccessFailureSplit) - Number(left.hasSuccessFailureSplit) ||
      right.observedCrawlerCount - left.observedCrawlerCount ||
      right.crawlers.reduce((sum, item) => sum + item.clientErrors + item.serverErrors, 0) -
        left.crawlers.reduce((sum, item) => sum + item.clientErrors + item.serverErrors, 0) ||
      left.path.localeCompare(right.path)
  );
  return {
    activity,
    crawlersCompared: activityCrawlers.map(({ token, provider }) => ({
      crawlerToken: token,
      provider,
    })),
    sharedPathsCompared,
    pathsWithDifferentResponseClasses,
    pathsWithDifferentStatusCodeSets,
    pathsWithDifferentContentTypeSets,
    pathsWithSuccessFailureSplit,
    pathsWithTruncatedStatusCodeDetails,
    pathsWithTruncatedContentTypeDetails,
    inputPathsTruncated: activityCrawlers.some(({ pathsTruncated }) => pathsTruncated),
    rowsTruncated: disparities.length > MAX_RETURNED_SEARCH_CRAWLER_PATH_DISPARITIES,
    disparities: disparities.slice(0, MAX_RETURNED_SEARCH_CRAWLER_PATH_DISPARITIES),
    note: `These rows compare HTTP status-code, response-class, and response media-type presence for exact normalized paths seen under at least two recognized ${activity === 'search-crawl' ? 'search-crawler' : 'training-data-crawler'} User-Agent tokens in this log sample. A split means one token claim received a 2xx and another received a 4xx or 5xx; it does not explain the cause, authenticate the crawler, or establish robots compliance. Response media types describe logged headers, not body quality or rendered content; media-type differences are counted only when at least two tokens have media-type observations for that path. Query strings are removed. Each path retains its ten most frequent HTTP status codes and reports up to five most frequent media types among at most 64 tracked values per path; truncation flags signal omitted values. Only each crawler’s retained top 200 paths participate; inputPathsTruncated signals when comparisons may omit less-requested paths. Other activity classes, user-triggered fetches, and custom unclassified tokens are excluded.`,
  };
}

/** Analyze Apache/Nginx combined logs, header-driven CloudFront standard logs, or line-delimited JSON without network access. */
export function analyzeAiCrawlerAccessLog(
  text: string,
  options: AiCrawlerAccessLogOptions = {}
): AiCrawlerAccessLogAnalysis {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  if (!Number.isSafeInteger(maxLines) || maxLines < 1 || maxLines > 5_000_000) {
    throw new Error('AI crawler log maxLines must be an integer from 1 to 5,000,000.');
  }
  const customTokens = options.customTokens ?? [];
  if (
    customTokens.length > 50 ||
    customTokens.some((token) => !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(token)) ||
    new Set(customTokens.map((token) => token.toLowerCase())).size !== customTokens.length
  ) {
    throw new Error(
      'Custom AI crawler tokens must be unique product tokens of 1-64 letters, digits, dots, underscores, or hyphens; at most 50 are accepted.'
    );
  }
  const builtInTokens = new Set(AI_CRAWLER_CATALOG.map(({ token }) => token.toLowerCase()));
  if (customTokens.some((token) => builtInTokens.has(token.toLowerCase()))) {
    throw new Error('Custom AI crawler tokens must not duplicate a built-in token.');
  }
  const ipRangeSets = parseIpRangeDefinitions(options.ipRanges, customTokens);
  const ipRangeVerification = new Map<string, MutableIpRangeVerification>(
    [...ipRangeSets.entries()].map(([tokenKey, rangeSet]) => [
      tokenKey,
      {
        token: rangeSet.token,
        configuredCidrCount: rangeSet.cidrs.length,
        userAgentMatchedRequests: 0,
        requestsWithMatchedRange: 0,
        requestsOutsideConfiguredRanges: 0,
        requestsWithoutClientIp: 0,
        requestsWithInvalidClientIp: 0,
      },
    ])
  );
  const configuredReferralSources = [
    ...DEFAULT_AI_REFERRAL_SOURCES,
    ...(options.aiReferralSources ?? []),
  ];
  if (configuredReferralSources.length > 20) {
    throw new Error(
      'At most 20 AI referral UTM sources, including the built-in ChatGPT source, are accepted.'
    );
  }
  const referralSourceByValue = new Map<string, string>();
  const referralTraffic = new Map<string, MutableAiReferralTraffic>();
  const utmSourceAttributionCoverage: AiReferralUtmSourceCoverage = {
    parsedRequestRows: 0,
    requestsWithUtmSource: 0,
    requestsWithConfiguredSource: 0,
    requestsWithUnconfiguredSingleValue: 0,
    requestsWithConflictingValues: 0,
    requestsWithEmptyOrOversizedValue: 0,
  };
  for (const source of configuredReferralSources) {
    if (typeof source?.label !== 'string' || typeof source.value !== 'string') {
      throw new Error(
        'AI referral sources must provide string labels and exact UTM source values.'
      );
    }
    const label = source.label.normalize('NFKC').trim();
    const labelKey = label.toLowerCase();
    const value = source.value.normalize('NFKC').trim().toLowerCase();
    if (
      !/^[\p{L}\p{N}][\p{L}\p{N} ._()/-]{0,47}$/u.test(label) ||
      !value ||
      value.length > 128 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(value)
    ) {
      throw new Error(
        'AI referral labels must be 1-48 plain letters, numbers, spaces, dots, underscores, parentheses, slashes, or hyphens; UTM source values must be 1-128 characters without control characters.'
      );
    }
    if (referralSourceByValue.has(value)) {
      throw new Error(`AI referral UTM source "${value}" is configured more than once.`);
    }
    if (!referralTraffic.has(labelKey))
      referralTraffic.set(labelKey, createAiReferralTraffic(label));
    referralSourceByValue.set(value, labelKey);
  }
  const customDefinitions = customTokens
    .map((token) => ({ token, provider: 'Custom', activity: 'unclassified' as const }))
    .sort((left, right) => right.token.length - left.token.length);
  const lines = text.split(/\r\n?|\n/).filter((line) => line.trim());
  if (lines.length > maxLines)
    throw new Error(`Log contains more than ${maxLines.toLocaleString()} non-empty lines.`);

  const crawlers = new Map<string, MutableCrawler>();
  const uniquePathsAcrossRecognizedBots = new Set<string>();
  let parsedRequests = 0;
  let parsedCombinedLogLines = 0;
  let parsedCloudFrontLogLines = 0;
  let parsedJsonLines = 0;
  let skippedLines = 0;
  let requestsWithoutUserAgent = 0;
  let requestsWithUnrecognizedUserAgent = 0;
  let requestsWithoutParseableTimestamp = 0;
  let cloudFrontHeaderFields: string[] | undefined;
  const recognizedTimestamps: number[] = [];

  for (const line of lines) {
    const header = /^#Fields:\s*(.*)$/i.exec(line.trim());
    if (header) {
      cloudFrontHeaderFields = (header[1] ?? '').trim().split(/\s+/).filter(Boolean);
      skippedLines += 1;
      continue;
    }
    const jsonLine = line.trimStart().startsWith('{');
    const cloudFrontLine = !jsonLine && Boolean(cloudFrontHeaderFields);
    const request = jsonLine
      ? parseJsonLine(line)
      : cloudFrontLine
        ? parseCloudFrontLine(line, cloudFrontHeaderFields ?? [])
        : parseCombinedLine(line);
    if (!request) {
      skippedLines += 1;
      continue;
    }
    parsedRequests += 1;
    if (jsonLine) parsedJsonLines += 1;
    else if (cloudFrontLine) parsedCloudFrontLogLines += 1;
    else parsedCombinedLogLines += 1;
    if (request.utmSourceMarkerState) {
      utmSourceAttributionCoverage.requestsWithUtmSource += 1;
      if (request.utmSourceMarkerState === 'conflicting-values') {
        utmSourceAttributionCoverage.requestsWithConflictingValues += 1;
      } else if (request.utmSourceMarkerState === 'empty-or-oversized') {
        utmSourceAttributionCoverage.requestsWithEmptyOrOversizedValue += 1;
      } else if (request.utmSource) {
        const referralKey = referralSourceByValue.get(request.utmSource);
        const referral = referralKey ? referralTraffic.get(referralKey) : undefined;
        if (referral) {
          utmSourceAttributionCoverage.requestsWithConfiguredSource += 1;
          addAiReferralRequest(referral, request);
        } else {
          utmSourceAttributionCoverage.requestsWithUnconfiguredSingleValue += 1;
        }
      }
    }
    if (!request.userAgent) {
      requestsWithoutUserAgent += 1;
      continue;
    }
    const definition = identifyCrawler(request.userAgent, customDefinitions);
    if (!definition) {
      requestsWithUnrecognizedUserAgent += 1;
      continue;
    }
    const verification = ipRangeVerification.get(definition.token.toLowerCase());
    const configuredRanges = ipRangeSets.get(definition.token.toLowerCase());
    if (verification && configuredRanges) {
      verification.userAgentMatchedRequests += 1;
      if (request.clientIpInvalid) {
        verification.requestsWithInvalidClientIp += 1;
      } else if (!request.clientIp) {
        verification.requestsWithoutClientIp += 1;
      } else {
        const clientAddress = ipaddr.process(request.clientIp);
        const matchesRange = configuredRanges.cidrs.some(
          ([network, prefix]) =>
            clientAddress.kind() === network.kind() && clientAddress.match([network, prefix])
        );
        if (matchesRange) verification.requestsWithMatchedRange += 1;
        else verification.requestsOutsideConfiguredRanges += 1;
      }
    }
    if (!request.timestamp) requestsWithoutParseableTimestamp += 1;
    const crawler = crawlers.get(definition.token) ?? createCrawler(definition);
    addRequest(crawler, request);
    crawlers.set(definition.token, crawler);
    uniquePathsAcrossRecognizedBots.add(request.path);
    if (request.timestamp) recognizedTimestamps.push(request.timestamp.getTime());
  }

  const toIso = (values: number[]): { first?: string; last?: string } => {
    if (!values.length) return {};
    let first = Number.POSITIVE_INFINITY;
    let last = Number.NEGATIVE_INFINITY;
    for (const value of values) {
      if (value < first) first = value;
      if (value > last) last = value;
    }
    return {
      first: new Date(first).toISOString(),
      last: new Date(last).toISOString(),
    };
  };
  const crawlerSummaries = [...crawlers.values()]
    .sort(
      (left, right) =>
        right.requests - left.requests ||
        left.definition.token.localeCompare(right.definition.token)
    )
    .map((crawler): AiCrawlerLogSummary => {
      const timestamps = toIso(crawler.timestamps);
      const latestRequestEpoch = timestamps.last ? Date.parse(timestamps.last) : undefined;
      const allPaths = [...crawler.paths.entries()]
        .map(([pathname, values]) => {
          const {
            firstTimestamp,
            lastTimestamp,
            statusCodes: pathStatusCodes,
            originResponseStatusCodes: pathOriginStatusCodes,
            responseContentTypes: pathContentTypes,
            responseContentTypesDropped,
          } = values;
          const pathValues = {
            requests: values.requests,
            edgeOriginStatusDifferences: values.edgeOriginStatusDifferences,
            responseTiming: summarizeResponseTiming(
              values.responseDurationBands,
              values.timeToFirstByteBands
            ),
            cloudFrontResultProfile: summarizeCloudFrontResults(values.cloudFrontResults),
            timestampedRequests: values.timestampedRequests,
            successfulResponses: values.successfulResponses,
            redirects: values.redirects,
            clientErrors: values.clientErrors,
            serverErrors: values.serverErrors,
            otherResponses: values.otherResponses,
          };
          const statusCodes = [...pathStatusCodes.entries()]
            .map(([status, requests]) => ({ status, requests }))
            .sort((left, right) => right.requests - left.requests || left.status - right.status);
          const originResponseStatusCodes = [...pathOriginStatusCodes.entries()]
            .map(([status, requests]) => ({ status, requests }))
            .sort((left, right) => right.requests - left.requests || left.status - right.status);
          const responseContentTypes = [...pathContentTypes.entries()]
            .map(([contentType, requests]) => ({ contentType, requests }))
            .sort(
              (left, right) =>
                right.requests - left.requests || left.contentType.localeCompare(right.contentType)
            );
          return {
            path: pathname,
            ...pathValues,
            statusCodes: statusCodes.slice(0, MAX_RETURNED_PATH_STATUS_CODES),
            statusCodesTruncated: statusCodes.length > MAX_RETURNED_PATH_STATUS_CODES,
            originResponseStatusCodes: originResponseStatusCodes.slice(
              0,
              MAX_RETURNED_PATH_ORIGIN_STATUS_CODES
            ),
            originResponseStatusCodesTruncated:
              originResponseStatusCodes.length > MAX_RETURNED_PATH_ORIGIN_STATUS_CODES,
            responseContentTypes: responseContentTypes.slice(0, MAX_RETURNED_PATH_CONTENT_TYPES),
            responseContentTypesTruncated:
              responseContentTypesDropped ||
              responseContentTypes.length > MAX_RETURNED_PATH_CONTENT_TYPES,
            ...(firstTimestamp !== undefined
              ? { firstSeenAt: new Date(firstTimestamp).toISOString() }
              : {}),
            ...(lastTimestamp !== undefined
              ? { lastSeenAt: new Date(lastTimestamp).toISOString() }
              : {}),
            ...(lastTimestamp !== undefined && latestRequestEpoch !== undefined
              ? {
                  daysBeforeLatestRequest: Math.floor(
                    (latestRequestEpoch - lastTimestamp) / 86_400_000
                  ),
                }
              : {}),
          };
        })
        .sort(
          (left, right) => right.requests - left.requests || left.path.localeCompare(right.path)
        );
      const failureRequests =
        crawler.responseClasses.clientErrors4xx + crawler.responseClasses.serverErrors5xx;
      const failureHotspots = allPaths
        .flatMap((item) => {
          const pathFailures = item.clientErrors + item.serverErrors;
          if (pathFailures === 0) return [];
          return [
            {
              ...item,
              failureRequests: pathFailures,
              failureSharePercent: Number(((pathFailures / item.requests) * 100).toFixed(1)),
              cloudflareBotAnnotatedRequests:
                crawler.paths.get(item.path)?.cloudflareBotAnnotatedRequests ?? 0,
              cloudflareVerifiedBotRequests:
                crawler.paths.get(item.path)?.cloudflareVerifiedBotRequests ?? 0,
              cloudflareVerifiedBotFailureRequests:
                crawler.paths.get(item.path)?.cloudflareVerifiedBotFailureRequests ?? 0,
              cloudflareSecurityActionRequests:
                crawler.paths.get(item.path)?.cloudflareSecurityActionRequests ?? 0,
              cloudflareBlockingFailureRequests:
                crawler.paths.get(item.path)?.cloudflareBlockingFailureRequests ?? 0,
              cloudflareChallengeFailureRequests:
                crawler.paths.get(item.path)?.cloudflareChallengeFailureRequests ?? 0,
              cloudflareChallengeResolvedFailureRequests:
                crawler.paths.get(item.path)?.cloudflareChallengeResolvedFailureRequests ?? 0,
            },
          ];
        })
        .sort(
          (left, right) =>
            right.serverErrors - left.serverErrors ||
            right.failureRequests - left.failureRequests ||
            right.failureSharePercent - left.failureSharePercent ||
            left.path.localeCompare(right.path)
        );
      const verifiedBotCategories = [...crawler.cloudflareVerifiedBotCategories.entries()]
        .map(([category, requests]) => ({ category, requests }))
        .sort(
          (left, right) =>
            right.requests - left.requests || left.category.localeCompare(right.category)
        );
      const daily = [...crawler.dailyActivity.entries()]
        .map(([date, values]): AiCrawlerLogDailyActivity => {
          const responseTiming = summarizeResponseTiming(
            values.responseDurationBands,
            values.timeToFirstByteBands
          );
          return {
            date,
            requests: values.requests,
            successfulResponses: values.successfulResponses,
            redirects: values.redirects,
            clientErrors: values.clientErrors,
            serverErrors: values.serverErrors,
            otherResponses: values.otherResponses,
            ...(responseTiming ? { responseTiming } : {}),
          };
        })
        .sort((left, right) => left.date.localeCompare(right.date));
      return {
        ...crawler.definition,
        requests: crawler.requests,
        uniquePaths: crawler.paths.size,
        responseClasses: crawler.responseClasses,
        responseTiming: summarizeResponseTiming(
          crawler.responseDurationBands,
          crawler.timeToFirstByteBands
        ),
        cloudFrontResultProfile: summarizeCloudFrontResults(crawler.cloudFrontResults),
        originStatusObservations: crawler.originStatusObservations,
        edgeOriginStatusDifferences: crawler.edgeOriginStatusDifferences,
        failureRequests,
        failureRatePercent:
          crawler.requests > 0
            ? Number(((failureRequests / crawler.requests) * 100).toFixed(1))
            : 0,
        pathsWithFailures: failureHotspots.length,
        failureHotspots: failureHotspots.slice(0, MAX_RETURNED_FAILURE_HOTSPOTS),
        failureHotspotsTruncated: failureHotspots.length > MAX_RETURNED_FAILURE_HOTSPOTS,
        cloudflareBotEvidence: {
          requestsWithCloudflareBotFields: crawler.cloudflareBotRequests,
          requestsWithBotScore: crawler.cloudflareBotScoreObservations,
          botScoreGroups: { ...crawler.cloudflareBotScoreGroups },
          requestsWithBotScoreSource: crawler.cloudflareBotScoreSourceObservations,
          botScoreSourceCounts: { ...crawler.cloudflareBotScoreSourceCounts },
          requestsWithVerifiedBotCategory: crawler.cloudflareVerifiedBotCategoryObservations,
          verifiedBotRequests: crawler.cloudflareVerifiedBotRequests,
          verifiedBotCategories: verifiedBotCategories.slice(
            0,
            MAX_RETURNED_VERIFIED_BOT_CATEGORIES
          ),
          verifiedBotCategoriesTruncated:
            crawler.cloudflareVerifiedBotCategoriesDropped ||
            verifiedBotCategories.length > MAX_RETURNED_VERIFIED_BOT_CATEGORIES,
        },
        cloudflareSecurityActions: { ...crawler.cloudflareSecurityActions },
        ...(ipRangeVerification.has(crawler.definition.token.toLowerCase())
          ? {
              ipRangeVerification: summarizeIpRangeVerification(
                ipRangeVerification.get(crawler.definition.token.toLowerCase())!
              ),
            }
          : {}),
        statusCodes: [...crawler.statusCodes.entries()]
          .map(([status, requests]) => ({ status, requests }))
          .sort((left, right) => right.requests - left.requests || left.status - right.status)
          .slice(0, MAX_RETURNED_STATUS_CODES),
        statusCodesTruncated: crawler.statusCodes.size > MAX_RETURNED_STATUS_CODES,
        requestMethods: [...crawler.requestMethods.entries()]
          .map(([method, requests]) => ({ method, requests }))
          .sort(
            (left, right) =>
              right.requests - left.requests || left.method.localeCompare(right.method)
          )
          .slice(0, MAX_RETURNED_METHODS),
        requestMethodsTruncated: crawler.requestMethods.size > MAX_RETURNED_METHODS,
        ...(timestamps.first ? { firstSeenAt: timestamps.first } : {}),
        ...(timestamps.last ? { lastSeenAt: timestamps.last } : {}),
        paths: allPaths.slice(0, MAX_RETURNED_PATHS),
        pathsTruncated: allPaths.length > MAX_RETURNED_PATHS,
        dailyActivity: daily.slice(-MAX_RETURNED_DAYS),
        dailyActivityTruncated: daily.length > MAX_RETURNED_DAYS,
      };
    });
  const allTimes = toIso(recognizedTimestamps);
  utmSourceAttributionCoverage.parsedRequestRows = parsedRequests;
  return {
    source: 'Aviary AI crawler access log analysis',
    schemaVersion: 1,
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    linesRead: lines.length,
    parsedRequests,
    parsedCombinedLogLines,
    parsedCloudFrontLogLines,
    parsedJsonLines,
    skippedLines,
    requestsWithoutUserAgent,
    requestsWithUnrecognizedUserAgent,
    requestsWithoutParseableTimestamp,
    recognizedAiCrawlerRequests: crawlerSummaries.reduce(
      (sum, crawler) => sum + crawler.requests,
      0
    ),
    uniquePathsAcrossRecognizedBots: uniquePathsAcrossRecognizedBots.size,
    aiReferralTraffic: [...referralTraffic.values()]
      .map(summarizeAiReferralTraffic)
      .sort(
        (left, right) => right.requests - left.requests || left.source.localeCompare(right.source)
      ),
    utmSourceAttributionCoverage,
    ...(allTimes.first ? { firstSeenAt: allTimes.first } : {}),
    ...(allTimes.last ? { lastSeenAt: allTimes.last } : {}),
    crawlers: crawlerSummaries,
    ...(ipRangeVerification.size > 0
      ? {
          ipRangeVerification: [...ipRangeVerification.values()].map((verification) => ({
            token: verification.token,
            ...summarizeIpRangeVerification(verification),
          })),
        }
      : {}),
    searchCrawlerPathComparison: compareCrawlerPathResponses(crawlerSummaries, 'search-crawl'),
    trainingCrawlerPathComparison: compareCrawlerPathResponses(
      crawlerSummaries,
      'training-data-crawl'
    ),
    note: 'Crawler identity and activity type are inferred from the logged User-Agent token and are not authenticated; verify IP ownership with the provider before firewall or access-control changes. Optional IP range observations compare logged client addresses only with operator-supplied CIDRs; ranges are neither fetched nor checked for freshness, and a match is address-range membership rather than crawler authentication. The report retains neither source IPs nor CIDR values. Custom tokens are user-supplied and always unclassified. Paths omit query strings and fragments, and request hosts, full user-agent strings, and referrers are not retained. AI referral traffic aggregates only exact configured utm_source values, emits source labels rather than raw values, and counts requests rather than users or sessions; absent tags are unknown coverage. Audit correlation is path-only, so use logs scoped to one host when joining them to one origin. Correlated answer-content and citation fields are current audit snapshots that may postdate the log rows; their coverage fields distinguish measured values from signals that were not assessed or run. These rows show only requests present in the supplied logs, not indexing, AI citations, robots compliance, or complete CDN/origin traffic. Google-Extended and Applebot-Extended are robots policy tokens rather than HTTP crawlers and do not appear as separate access-log agents.',
  };
}

/** Join observed request paths to current, same-origin sitewide audit signals without guessing across queries or canonicals. */
export function correlateAiCrawlerAccessLogWithGeoAudit(
  analysis: AiCrawlerAccessLogAnalysis,
  audit: SiteWideGeoAnalysis,
  originValue: string
): AiCrawlerLogGeoCorrelation {
  let originUrl: URL;
  try {
    originUrl = new URL(originValue);
  } catch {
    throw new Error('Crawler log correlation origin must be an absolute HTTP(S) origin URL.');
  }
  if (
    !['http:', 'https:'].includes(originUrl.protocol) ||
    originUrl.username ||
    originUrl.password ||
    originUrl.pathname !== '/' ||
    originUrl.search ||
    originUrl.hash
  ) {
    throw new Error(
      'Crawler log correlation origin must contain only an HTTP(S) scheme and host, such as https://example.com.'
    );
  }
  const origin = originUrl.origin;
  const pagesByPath = new Map<string, Array<{ page: SiteWideGeoPageSummary; hasQuery: boolean }>>();
  for (const page of audit.pageSummaries) {
    try {
      const url = new URL(page.url);
      if (url.origin !== origin) continue;
      const candidates = pagesByPath.get(url.pathname) ?? [];
      candidates.push({ page, hasQuery: Boolean(url.search) });
      pagesByPath.set(url.pathname, candidates);
    } catch {
      // Invalid saved URLs cannot be joined to an origin-scoped request path.
    }
  }

  const pathObservations: AiCrawlerLogGeoPathObservation[] = [];
  const counts = {
    logPathsMatchedToAudit: 0,
    logPathsAmbiguousInAudit: 0,
    logPathsNotInAudit: 0,
    requestsMatchedToAuditedPaths: 0,
    requestsOnAuditedPathsWithRedirects: 0,
    requestsOnAuditedPathsWithClientErrors: 0,
    requestsOnAuditedPathsWithServerErrors: 0,
    requestsOnCurrentlyRobotsBlockedPaths: 0,
    requestsOnCurrentlyNoindexPaths: 0,
    requestsOnCurrentlySnippetRestrictedPaths: 0,
    requestsOnAuditedPathsWithQuestionHeadings: 0,
    requestsOnAuditedPathsWithConciseAnswerBlocks: 0,
    requestsOnAuditedPathsWithExternalSourceLinks: 0,
    requestsOnAuditedPathsWithInlineCitationMarkers: 0,
    requestsOnApplebotPagesMarkedPaywalled: 0,
    requestsOnApplebotPagesWithNoSnippet: 0,
    requestsOnApplebotPagesWithDocumentedAiContextExclusion: 0,
  };
  let inputPathsTruncated = false;

  for (const crawler of analysis.crawlers) {
    inputPathsTruncated ||= crawler.pathsTruncated;
    for (const path of crawler.paths) {
      let auditMatchType: AiCrawlerLogGeoPathObservation['auditMatchType'] = 'not-in-audit';
      let page: SiteWideGeoPageSummary | undefined;
      const candidates = pagesByPath.get(path.path) ?? [];
      if (candidates.length > 1 || (candidates.length === 1 && candidates[0]!.hasQuery)) {
        auditMatchType = 'ambiguous';
      } else if (candidates.length === 1) {
        auditMatchType = 'matched';
        page = candidates[0]!.page;
      }

      let currentRobotsAccess: AiCrawlerLogGeoPathObservation['currentRobotsAccess'] =
        'not-assessed';
      let currentRobotsRule: AiCrawlerLogGeoPathObservation['currentRobotsRule'];
      let control: { noindex: boolean; noSnippet: boolean; maxSnippetZero: boolean } | undefined;
      let dataUseControl: { noArchive: boolean; noindex?: boolean } | undefined;
      if (
        crawler.activity === 'user-initiated-fetch' &&
        !ROBOTS_CONTROLLED_USER_FETCH_TOKENS.has(crawler.token.toLowerCase())
      ) {
        currentRobotsAccess = 'not-applicable';
      } else if (crawler.activity === 'unclassified') {
        currentRobotsAccess = 'not-assessed';
      } else if (page && auditMatchType === 'matched') {
        const isDataUseCrawler = isDataUseCrawlerActivity(crawler.activity);
        const isRobotsControlledUserFetcher = crawler.activity === 'user-initiated-fetch';
        const coverage = isDataUseCrawler
          ? page.signalCoverage.dataUseCrawlerPolicy
          : isRobotsControlledUserFetcher
            ? page.signalCoverage.userInitiatedFetchAccess
            : page.signalCoverage.searchCrawlerAccess;
        const accessRows = isDataUseCrawler
          ? page.dataUseCrawlerPolicy
          : isRobotsControlledUserFetcher
            ? page.userInitiatedFetchAccess
            : page.searchCrawlerAccess;
        const access = accessRows?.find(
          ({ token }) => token.toLowerCase() === crawler.token.toLowerCase()
        );
        if (coverage === 'measured' && access) {
          currentRobotsAccess = access.allowed ? 'allowed' : 'blocked';
          currentRobotsRule = access.matchedRule;
        }
        if (isDataUseCrawlerActivity(crawler.activity)) {
          dataUseControl = page.previewControls?.dataUseCrawlerControls?.find(
            ({ token }) => token.toLowerCase() === crawler.token.toLowerCase()
          );
        } else {
          control = page.previewControls?.crawlerControls?.find(
            ({ token }) => token.toLowerCase() === crawler.token.toLowerCase()
          );
        }
      }
      const currentNoindex = control?.noindex ?? dataUseControl?.noindex;
      const currentSchemaIsAccessibleForFree = page?.answerContent?.schemaIsAccessibleForFree;
      const currentSchemaHasNonBooleanAccessibleForFreeValue =
        page?.answerContent?.schemaHasNonBooleanAccessibleForFreeValue;

      const reviewSignals: AiCrawlerGeoReviewSignal[] = [];
      if (page && auditMatchType === 'matched') {
        if (currentRobotsAccess === 'blocked') reviewSignals.push('robots-blocked');
        if (currentNoindex) reviewSignals.push('noindex');
        if (control?.noSnippet) {
          reviewSignals.push(
            crawler.token.toLowerCase() === 'applebot'
              ? 'apple-ai-context-hidden-by-nosnippet'
              : 'nosnippet'
          );
        }
        if (control?.maxSnippetZero) reviewSignals.push('max-snippet-zero');
        if (crawler.token.toLowerCase() === 'amazonbot' && dataUseControl?.noArchive)
          reviewSignals.push('noarchive');
        if (
          crawler.token.toLowerCase() === 'applebot' &&
          currentSchemaIsAccessibleForFree === false
        ) {
          reviewSignals.push('apple-ai-context-excluded-by-paywall-schema');
        }
        if (path.clientErrors > 0) reviewSignals.push('client-error-responses');
        if (path.serverErrors > 0) reviewSignals.push('server-error-responses');
        if (page.signalCoverage.answerContent === 'measured') {
          if (
            typeof page.answerContent?.questionHeadings === 'number' &&
            page.answerContent.questionHeadings === 0
          )
            reviewSignals.push('no-question-headings');
          if (
            typeof page.answerContent?.conciseAnswerBlocks === 'number' &&
            page.answerContent.conciseAnswerBlocks === 0
          )
            reviewSignals.push('no-concise-answer-blocks');
          if (page.answerContent?.visibleAuthor === false) reviewSignals.push('no-visible-author');
          if (page.answerContent?.visibleDate === false) reviewSignals.push('no-visible-date');
        }
        if (page.signalCoverage.citationEvidence === 'measured') {
          if (
            typeof page.citationEvidence?.externalSourceLinkCount === 'number' &&
            page.citationEvidence.externalSourceLinkCount === 0
          )
            reviewSignals.push('no-external-source-links');
          if (
            typeof page.citationEvidence?.inlineCitationMarkerCount === 'number' &&
            page.citationEvidence.inlineCitationMarkerCount === 0
          )
            reviewSignals.push('no-inline-citation-markers');
          if ((page.citationEvidence?.unresolvedInlineCitationTargetCount ?? 0) > 0)
            reviewSignals.push('unresolved-citation-targets');
        }
      }

      if (page && auditMatchType === 'matched') {
        counts.logPathsMatchedToAudit += 1;
        counts.requestsMatchedToAuditedPaths += path.requests;
        counts.requestsOnAuditedPathsWithRedirects += path.redirects;
        counts.requestsOnAuditedPathsWithClientErrors += path.clientErrors;
        counts.requestsOnAuditedPathsWithServerErrors += path.serverErrors;
        if (currentRobotsAccess === 'blocked')
          counts.requestsOnCurrentlyRobotsBlockedPaths += path.requests;
        if (currentNoindex) counts.requestsOnCurrentlyNoindexPaths += path.requests;
        if (control?.noSnippet || control?.maxSnippetZero)
          counts.requestsOnCurrentlySnippetRestrictedPaths += path.requests;
        if (
          page.signalCoverage.answerContent === 'measured' &&
          (page.answerContent?.questionHeadings ?? 0) > 0
        )
          counts.requestsOnAuditedPathsWithQuestionHeadings += path.requests;
        if (
          page.signalCoverage.answerContent === 'measured' &&
          (page.answerContent?.conciseAnswerBlocks ?? 0) > 0
        )
          counts.requestsOnAuditedPathsWithConciseAnswerBlocks += path.requests;
        if (
          page.signalCoverage.citationEvidence === 'measured' &&
          (page.citationEvidence?.externalSourceLinkCount ?? 0) > 0
        )
          counts.requestsOnAuditedPathsWithExternalSourceLinks += path.requests;
        if (
          page.signalCoverage.citationEvidence === 'measured' &&
          (page.citationEvidence?.inlineCitationMarkerCount ?? 0) > 0
        )
          counts.requestsOnAuditedPathsWithInlineCitationMarkers += path.requests;
        if (
          crawler.token.toLowerCase() === 'applebot' &&
          currentSchemaIsAccessibleForFree === false
        ) {
          counts.requestsOnApplebotPagesMarkedPaywalled += path.requests;
        }
        if (crawler.token.toLowerCase() === 'applebot' && control?.noSnippet) {
          counts.requestsOnApplebotPagesWithNoSnippet += path.requests;
        }
        if (
          crawler.token.toLowerCase() === 'applebot' &&
          (currentSchemaIsAccessibleForFree === false || control?.noSnippet)
        ) {
          counts.requestsOnApplebotPagesWithDocumentedAiContextExclusion += path.requests;
        }
      } else if (auditMatchType === 'ambiguous') {
        counts.logPathsAmbiguousInAudit += 1;
      } else if (auditMatchType === 'not-in-audit') {
        counts.logPathsNotInAudit += 1;
      }

      pathObservations.push({
        ...path,
        crawlerToken: crawler.token,
        provider: crawler.provider,
        activity: crawler.activity,
        auditMatchType,
        ...(page && auditMatchType === 'matched' ? { auditUrl: page.url } : {}),
        currentRobotsAccess,
        ...(currentRobotsRule ? { currentRobotsRule } : {}),
        ...(currentNoindex !== undefined ? { currentNoindex } : {}),
        ...(control
          ? { currentNoSnippet: control.noSnippet, currentMaxSnippetZero: control.maxSnippetZero }
          : {}),
        ...(dataUseControl ? { currentNoArchive: dataUseControl.noArchive } : {}),
        ...(page && auditMatchType === 'matched'
          ? {
              answerContentCoverage: page.signalCoverage.answerContent,
              citationEvidenceCoverage: page.signalCoverage.citationEvidence,
              ...(page.signalCoverage.answerContent === 'measured'
                ? {
                    ...(typeof page.answerContent?.questionHeadings === 'number'
                      ? { currentQuestionHeadings: page.answerContent.questionHeadings }
                      : {}),
                    ...(typeof page.answerContent?.conciseAnswerBlocks === 'number'
                      ? { currentConciseAnswerBlocks: page.answerContent.conciseAnswerBlocks }
                      : {}),
                    ...(currentSchemaIsAccessibleForFree !== undefined
                      ? { currentSchemaIsAccessibleForFree }
                      : {}),
                    ...(typeof currentSchemaHasNonBooleanAccessibleForFreeValue === 'boolean'
                      ? { currentSchemaHasNonBooleanAccessibleForFreeValue }
                      : {}),
                    ...(typeof page.answerContent?.visibleAuthor === 'boolean'
                      ? { currentVisibleAuthor: page.answerContent.visibleAuthor }
                      : {}),
                    ...(typeof page.answerContent?.visibleDate === 'boolean'
                      ? { currentVisibleDate: page.answerContent.visibleDate }
                      : {}),
                  }
                : {}),
              ...(page.signalCoverage.citationEvidence === 'measured'
                ? {
                    ...(typeof page.citationEvidence?.externalSourceLinkCount === 'number'
                      ? {
                          currentExternalSourceLinkCount:
                            page.citationEvidence.externalSourceLinkCount,
                        }
                      : {}),
                    ...(typeof page.citationEvidence?.inlineCitationMarkerCount === 'number'
                      ? {
                          currentInlineCitationMarkerCount:
                            page.citationEvidence.inlineCitationMarkerCount,
                        }
                      : {}),
                    ...(typeof page.citationEvidence?.unresolvedInlineCitationTargetCount ===
                    'number'
                      ? {
                          currentUnresolvedCitationTargetCount:
                            page.citationEvidence.unresolvedInlineCitationTargetCount,
                        }
                      : {}),
                  }
                : {}),
            }
          : {}),
        ...(reviewSignals.length > 0 ? { reviewSignals } : {}),
      });
    }
  }

  const orderedObservations = pathObservations.sort(
    (left, right) =>
      right.requests - left.requests ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.path.localeCompare(right.path)
  );
  const requestDenominators = new Map(
    analysis.crawlers.map((crawler) => [crawler.token.toLowerCase(), crawler.requests])
  );
  const geoOpportunityCandidates = pathObservations
    .filter(
      (
        item
      ): item is AiCrawlerLogGeoPathObservation & {
        auditUrl: string;
        reviewSignals: AiCrawlerGeoReviewSignal[];
      } => Boolean(item.auditUrl && item.reviewSignals?.length)
    )
    .sort(
      (left, right) =>
        (() => {
          const leftTotal = requestDenominators.get(left.crawlerToken.toLowerCase()) ?? 0;
          const rightTotal = requestDenominators.get(right.crawlerToken.toLowerCase()) ?? 0;
          if (leftTotal === 0 || rightTotal === 0) return 0;
          const rightShareCrossProduct = BigInt(right.requests) * BigInt(leftTotal);
          const leftShareCrossProduct = BigInt(left.requests) * BigInt(rightTotal);
          return rightShareCrossProduct > leftShareCrossProduct
            ? 1
            : rightShareCrossProduct < leftShareCrossProduct
              ? -1
              : 0;
        })() ||
        right.requests - left.requests ||
        right.reviewSignals.length - left.reviewSignals.length ||
        left.crawlerToken.localeCompare(right.crawlerToken) ||
        left.path.localeCompare(right.path)
    );
  const priorityReviewQueue: AiCrawlerGeoOpportunity[] = geoOpportunityCandidates
    .slice(0, MAX_RETURNED_GEO_OPPORTUNITIES)
    .map(
      ({
        crawlerToken,
        provider,
        activity,
        path,
        auditUrl,
        requests,
        lastSeenAt,
        daysBeforeLatestRequest,
        currentNoArchive,
        currentSchemaIsAccessibleForFree,
        reviewSignals,
      }) => {
        const crawlerRequests = requestDenominators.get(crawlerToken.toLowerCase()) ?? 0;
        return {
          crawlerToken,
          provider,
          activity,
          path,
          auditUrl,
          requests,
          crawlerRequests,
          crawlerRequestSharePercent:
            crawlerRequests > 0 ? Number(((requests / crawlerRequests) * 100).toFixed(3)) : 0,
          ...(lastSeenAt ? { lastSeenAt } : {}),
          ...(daysBeforeLatestRequest !== undefined ? { daysBeforeLatestRequest } : {}),
          ...(currentNoArchive !== undefined ? { currentNoArchive } : {}),
          ...(currentSchemaIsAccessibleForFree !== undefined
            ? { currentSchemaIsAccessibleForFree }
            : {}),
          reviewSignals,
        };
      }
    );
  const coverageDefinitions = AI_CRAWLER_CATALOG.filter(
    ({ activity, token }) =>
      activity === 'search-crawl' ||
      isDataUseCrawlerActivity(activity) ||
      (activity === 'user-initiated-fetch' &&
        ROBOTS_CONTROLLED_USER_FETCH_TOKENS.has(token.toLowerCase()))
  );
  const coverageRowsPerCrawler = Math.max(
    1,
    Math.floor(MAX_RETURNED_GEO_AUDIT_PATH_COVERAGE_ROWS / coverageDefinitions.length)
  );
  let coverageRowsTruncated = false;
  const auditPathCoverage: AiCrawlerLogGeoAuditPathCoverage = {
    auditPagesSkipped: audit.pagesSkipped ?? 0,
    uniqueAuditPaths: pagesByPath.size,
    rowsTruncated: false,
    crawlers: coverageDefinitions.map((definition) => {
      const logCrawler = analysis.crawlers.find(
        ({ token }) => token.toLowerCase() === definition.token.toLowerCase()
      );
      const observedPaths = new Map((logCrawler?.paths ?? []).map((item) => [item.path, item]));
      const summary: AiCrawlerLogGeoAuditPathCoverage['crawlers'][number] = {
        crawlerToken: definition.token,
        provider: definition.provider,
        activity: definition.activity as Exclude<AiCrawlerActivity, 'unclassified'>,
        pathsEvaluated: 0,
        pathsObserved: 0,
        pathsNotObservedInLog: 0,
        pathsAmbiguous: 0,
        pathsUnassessableBecauseTruncated: 0,
        observedRequests: 0,
        observedSuccessfulResponses: 0,
        ...(logCrawler?.lastSeenAt ? { latestRequestAt: logCrawler.lastSeenAt } : {}),
        observedPathsWithin7DaysOfLatestRequest: 0,
        observedPaths8To30DaysBeforeLatestRequest: 0,
        observedPathsOver30DaysBeforeLatestRequest: 0,
        observedPathsWithoutTimestamp: 0,
        currentlyRobotsBlockedPaths: 0,
        currentlyNoindexPaths: 0,
        currentlySnippetRestrictedPaths: 0,
        currentlyNoArchivePaths: 0,
        paths: [],
      };
      const candidatePaths = [...pagesByPath.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      );
      for (const [pathname, candidates] of candidatePaths) {
        const observed = observedPaths.get(pathname);
        const singlePage = candidates.length === 1 ? candidates[0]!.page : undefined;
        const isAmbiguous = candidates.length > 1 || Boolean(candidates[0]?.hasQuery);
        const observation: AiCrawlerLogGeoAuditPathCoverage['crawlers'][number]['paths'][number]['observation'] =
          isAmbiguous
            ? 'ambiguous-query-or-duplicate'
            : observed
              ? 'observed'
              : logCrawler?.pathsTruncated
                ? 'not-assessable-truncated'
                : 'not-observed-in-log';
        let currentRobotsAccess: AiCrawlerLogGeoAuditPathCoverage['crawlers'][number]['paths'][number]['currentRobotsAccess'] =
          'not-assessed';
        let currentRobotsAllowed: boolean | undefined;
        let currentNoindex: boolean | undefined;
        let currentNoSnippet: boolean | undefined;
        let currentMaxSnippetZero: boolean | undefined;
        let currentNoArchive: boolean | undefined;
        if (singlePage) {
          const isDataUseCrawler = isDataUseCrawlerActivity(definition.activity);
          const isRobotsControlledUserFetcher = definition.activity === 'user-initiated-fetch';
          const signal = isDataUseCrawler
            ? singlePage.signalCoverage.dataUseCrawlerPolicy
            : isRobotsControlledUserFetcher
              ? singlePage.signalCoverage.userInitiatedFetchAccess
              : singlePage.signalCoverage.searchCrawlerAccess;
          const accessRows = isDataUseCrawler
            ? singlePage.dataUseCrawlerPolicy
            : isRobotsControlledUserFetcher
              ? singlePage.userInitiatedFetchAccess
              : singlePage.searchCrawlerAccess;
          const access = accessRows?.find(
            ({ token }) => token.toLowerCase() === definition.token.toLowerCase()
          );
          if (signal === 'measured' && access) {
            currentRobotsAllowed = access.allowed;
            currentRobotsAccess = access.allowed ? 'allowed' : 'blocked';
          }
          if (isDataUseCrawler) {
            const controls = singlePage.previewControls?.dataUseCrawlerControls?.find(
              ({ token }) => token.toLowerCase() === definition.token.toLowerCase()
            );
            if (controls) {
              currentNoArchive = controls.noArchive;
              currentNoindex = controls.noindex;
            }
          } else {
            const controls = singlePage.previewControls?.crawlerControls?.find(
              ({ token }) => token.toLowerCase() === definition.token.toLowerCase()
            );
            if (controls) {
              currentNoindex = controls.noindex;
              currentNoSnippet = controls.noSnippet;
              currentMaxSnippetZero = controls.maxSnippetZero;
            }
          }
        }
        summary.pathsEvaluated += 1;
        if (observation === 'observed' && observed) {
          summary.pathsObserved += 1;
          summary.observedRequests += observed.requests;
          summary.observedSuccessfulResponses += observed.successfulResponses;
          if (observed.daysBeforeLatestRequest === undefined) {
            summary.observedPathsWithoutTimestamp += 1;
          } else if (observed.daysBeforeLatestRequest <= 7) {
            summary.observedPathsWithin7DaysOfLatestRequest += 1;
          } else if (observed.daysBeforeLatestRequest <= 30) {
            summary.observedPaths8To30DaysBeforeLatestRequest += 1;
          } else {
            summary.observedPathsOver30DaysBeforeLatestRequest += 1;
          }
        } else if (observation === 'not-observed-in-log') {
          summary.pathsNotObservedInLog += 1;
        } else if (observation === 'ambiguous-query-or-duplicate') {
          summary.pathsAmbiguous += 1;
        } else {
          summary.pathsUnassessableBecauseTruncated += 1;
        }
        if (observation === 'observed' && currentRobotsAllowed === false)
          summary.currentlyRobotsBlockedPaths += 1;
        if (observation === 'observed' && currentNoindex) summary.currentlyNoindexPaths += 1;
        if (observation === 'observed' && (currentNoSnippet || currentMaxSnippetZero))
          summary.currentlySnippetRestrictedPaths += 1;
        if (observation === 'observed' && currentNoArchive) summary.currentlyNoArchivePaths += 1;
        if (summary.paths.length < coverageRowsPerCrawler) {
          summary.paths.push({
            path: pathname,
            auditedUrlCount: candidates.length,
            observation,
            ...(observation === 'observed' && observed
              ? {
                  requests: observed.requests,
                  successfulResponses: observed.successfulResponses,
                  statusCodes: observed.statusCodes,
                  statusCodesTruncated: observed.statusCodesTruncated,
                  responseContentTypes: observed.responseContentTypes,
                  responseContentTypesTruncated: observed.responseContentTypesTruncated,
                  timestampedRequests: observed.timestampedRequests,
                  ...(observed.lastSeenAt ? { lastSeenAt: observed.lastSeenAt } : {}),
                  ...(observed.daysBeforeLatestRequest !== undefined
                    ? { daysBeforeLatestRequest: observed.daysBeforeLatestRequest }
                    : {}),
                }
              : {}),
            currentRobotsAccess,
            ...(currentNoindex !== undefined ? { currentNoindex } : {}),
            ...(currentNoSnippet !== undefined ? { currentNoSnippet } : {}),
            ...(currentMaxSnippetZero !== undefined ? { currentMaxSnippetZero } : {}),
            ...(currentNoArchive !== undefined ? { currentNoArchive } : {}),
          });
        } else {
          coverageRowsTruncated = true;
        }
      }
      return summary;
    }),
    note: 'Coverage is a path-only comparison between the saved audit and retained paths for each built-in search or data-use crawler token. “Not observed” means absent from this supplied log sample; it does not mean the crawler never visited. Per-path recency is measured in whole days before that token’s newest parseable request timestamp in the supplied log, not against the present time or a provider crawl schedule. Paths with some unparseable request timestamps retain a timestampedRequests count. Query URLs and duplicate paths are ambiguous because log query strings are discarded. If a crawler path list was truncated, absent paths are marked not assessable. User-triggered fetchers are excluded, custom tokens remain unclassified, and current controls may differ from the log period.',
  };
  auditPathCoverage.rowsTruncated = coverageRowsTruncated;
  const aiReferralPathObservations: AiReferralGeoAuditPathObservation[] = [];
  const aiReferralSummaries = Array.isArray(analysis.aiReferralTraffic)
    ? analysis.aiReferralTraffic
    : [];
  const buildReferralCrawlerPathIndex = (activity: 'search-crawl' | 'training-data-crawl') => {
    const relevantCrawlers = analysis.crawlers.filter((crawler) => crawler.activity === activity);
    const paths = new Map<
      string,
      { requests: number; failures: number; tokens: Set<string>; latestRequestAt?: string }
    >();
    for (const crawler of relevantCrawlers) {
      for (const path of crawler.paths) {
        const evidence = paths.get(path.path) ?? {
          requests: 0,
          failures: 0,
          tokens: new Set<string>(),
        };
        evidence.requests += path.requests;
        evidence.failures += path.clientErrors + path.serverErrors;
        evidence.tokens.add(crawler.token);
        if (
          path.lastSeenAt &&
          (!evidence.latestRequestAt || path.lastSeenAt > evidence.latestRequestAt)
        ) {
          evidence.latestRequestAt = path.lastSeenAt;
        }
        paths.set(path.path, evidence);
      }
    }
    return { paths, relevantCrawlers };
  };
  const searchCrawlerPathIndex = buildReferralCrawlerPathIndex('search-crawl');
  const trainingCrawlerPathIndex = buildReferralCrawlerPathIndex('training-data-crawl');
  const getReferralCrawlerOverlap = (
    path: string,
    index: ReturnType<typeof buildReferralCrawlerPathIndex>
  ): AiReferralGeoCrawlerOverlap => {
    const evidence = index.paths.get(path);
    const omittedFromTruncatedList = index.relevantCrawlers.some(
      (crawler) =>
        crawler.pathsTruncated && !crawler.paths.some((observedPath) => observedPath.path === path)
    );
    if (!evidence) {
      return {
        logCoverage: omittedFromTruncatedList ? 'incomplete' : 'not-observed-in-sample',
        requests: 0,
        failures: 0,
        tokens: [],
      };
    }
    return {
      logCoverage: omittedFromTruncatedList ? 'observed-incomplete' : 'observed',
      requests: evidence.requests,
      failures: evidence.failures,
      tokens: [...evidence.tokens].sort((left, right) => left.localeCompare(right)),
      ...(evidence.latestRequestAt ? { latestRequestAt: evidence.latestRequestAt } : {}),
    };
  };
  const aiReferralAuditCoverage: AiReferralGeoAuditCoverage = {
    sources: aiReferralSummaries
      .map((source): AiReferralGeoAuditSourceCoverage => {
        const summary: AiReferralGeoAuditSourceCoverage = {
          source: source.source,
          requestsInSample: source.requests,
          uniquePaths: source.uniquePaths,
          uniquePathsTruncated: source.uniquePathsTruncated,
          retainedPathsCompared: source.paths.length,
          retainedRequestsCompared: 0,
          retainedPathsMatchedToAudit: 0,
          retainedPathsAmbiguousInAudit: 0,
          retainedPathsNotInAudit: 0,
          retainedRequestsMatchedToAudit: 0,
          retainedRequestsOnNoindexPages: 0,
          retainedRequestsOnSnippetRestrictedPages: 0,
          retainedRequestsOnPagesWithQuestionHeadings: 0,
          retainedRequestsOnPagesWithConciseAnswerBlocks: 0,
          retainedPathsWithSearchCrawlerRequests: 0,
          retainedPathsWithTrainingCrawlerRequests: 0,
          retainedPathsWithSearchCrawlerFailures: 0,
          retainedPathsWithTrainingCrawlerFailures: 0,
          retainedPathsWithIncompleteSearchCrawlerCoverage: 0,
          retainedPathsWithIncompleteTrainingCrawlerCoverage: 0,
          searchCrawlerRequestsOnRetainedPaths: 0,
          searchCrawlerFailuresOnRetainedPaths: 0,
          trainingCrawlerRequestsOnRetainedPaths: 0,
          trainingCrawlerFailuresOnRetainedPaths: 0,
          pathsTruncated: source.pathsTruncated,
        };
        for (const path of source.paths) {
          summary.retainedRequestsCompared += path.requests;
          const searchCrawlers = getReferralCrawlerOverlap(path.path, searchCrawlerPathIndex);
          const trainingDataCrawlers = getReferralCrawlerOverlap(
            path.path,
            trainingCrawlerPathIndex
          );
          if (searchCrawlers.requests > 0) summary.retainedPathsWithSearchCrawlerRequests += 1;
          if (trainingDataCrawlers.requests > 0)
            summary.retainedPathsWithTrainingCrawlerRequests += 1;
          if (searchCrawlers.failures > 0) summary.retainedPathsWithSearchCrawlerFailures += 1;
          if (trainingDataCrawlers.failures > 0)
            summary.retainedPathsWithTrainingCrawlerFailures += 1;
          if (
            searchCrawlers.logCoverage === 'incomplete' ||
            searchCrawlers.logCoverage === 'observed-incomplete'
          )
            summary.retainedPathsWithIncompleteSearchCrawlerCoverage += 1;
          if (
            trainingDataCrawlers.logCoverage === 'incomplete' ||
            trainingDataCrawlers.logCoverage === 'observed-incomplete'
          )
            summary.retainedPathsWithIncompleteTrainingCrawlerCoverage += 1;
          summary.searchCrawlerRequestsOnRetainedPaths += searchCrawlers.requests;
          summary.searchCrawlerFailuresOnRetainedPaths += searchCrawlers.failures;
          summary.trainingCrawlerRequestsOnRetainedPaths += trainingDataCrawlers.requests;
          summary.trainingCrawlerFailuresOnRetainedPaths += trainingDataCrawlers.failures;
          const candidates = pagesByPath.get(path.path) ?? [];
          const ambiguous =
            candidates.length > 1 || (candidates.length === 1 && candidates[0]!.hasQuery);
          const page = candidates.length === 1 && !ambiguous ? candidates[0]!.page : undefined;
          const auditMatchType: AiReferralGeoAuditPathObservation['auditMatchType'] = ambiguous
            ? 'ambiguous'
            : page
              ? 'matched'
              : 'not-in-audit';
          if (ambiguous) summary.retainedPathsAmbiguousInAudit += 1;
          else if (page) {
            summary.retainedPathsMatchedToAudit += 1;
            summary.retainedRequestsMatchedToAudit += path.requests;
            if (page.previewControls?.noindex)
              summary.retainedRequestsOnNoindexPages += path.requests;
            if (page.previewControls?.noSnippet || page.previewControls?.maxSnippetZero)
              summary.retainedRequestsOnSnippetRestrictedPages += path.requests;
            if ((page.answerContent?.questionHeadings ?? 0) > 0)
              summary.retainedRequestsOnPagesWithQuestionHeadings += path.requests;
            if ((page.answerContent?.conciseAnswerBlocks ?? 0) > 0)
              summary.retainedRequestsOnPagesWithConciseAnswerBlocks += path.requests;
          } else summary.retainedPathsNotInAudit += 1;
          aiReferralPathObservations.push({
            source: source.source,
            path: path.path,
            requests: path.requests,
            auditMatchType,
            searchCrawlers,
            trainingDataCrawlers,
            ...(page
              ? {
                  auditUrl: page.url,
                  ...(typeof page.previewControls?.noindex === 'boolean'
                    ? { currentNoindex: page.previewControls.noindex }
                    : {}),
                  ...(typeof page.previewControls?.noSnippet === 'boolean'
                    ? { currentNoSnippet: page.previewControls.noSnippet }
                    : {}),
                  ...(typeof page.previewControls?.maxSnippetZero === 'boolean'
                    ? { currentMaxSnippetZero: page.previewControls.maxSnippetZero }
                    : {}),
                  ...(typeof page.answerContent?.questionHeadings === 'number'
                    ? { currentQuestionHeadings: page.answerContent.questionHeadings }
                    : {}),
                  ...(typeof page.answerContent?.conciseAnswerBlocks === 'number'
                    ? { currentConciseAnswerBlocks: page.answerContent.conciseAnswerBlocks }
                    : {}),
                }
              : {}),
          });
        }
        return summary;
      })
      .sort(
        (left, right) =>
          right.requestsInSample - left.requestsInSample || left.source.localeCompare(right.source)
      ),
    pathObservations: [],
    pathObservationsTruncated: false,
    note: 'Tagged referral requests are joined to the saved audit and to claimed search/training crawler paths by exact origin path after removing the URL query. Duplicate audit paths and query-bearing audit URLs are ambiguous; canonical aliases are not inferred. Crawler request totals sum matching retained token/path rows and may include repeat requests or overlapping log sources; if a truncated crawler list omits the path, other token rows may be missing and any observed sum is a lower bound. A missing path in a truncated list is incomplete, not a measured zero. Overlap does not establish that a crawler caused, preceded, or knew about a referral. Only retained referral paths are compared, up to 100 per source, and counts marked retained describe that bounded set. Current noindex, snippet, and answer-content signals are an audit snapshot that may postdate the referral request; they do not explain or cause referral traffic. UTM attribution counts request rows, not sessions or unique users.',
  };
  aiReferralPathObservations.sort(
    (left, right) =>
      right.requests - left.requests ||
      left.source.localeCompare(right.source) ||
      left.path.localeCompare(right.path)
  );
  aiReferralAuditCoverage.pathObservations = aiReferralPathObservations.slice(
    0,
    MAX_RETURNED_AI_REFERRAL_AUDIT_PATHS
  );
  aiReferralAuditCoverage.pathObservationsTruncated =
    aiReferralPathObservations.length > MAX_RETURNED_AI_REFERRAL_AUDIT_PATHS;
  return {
    ...(analysis.sourceFile ? { sourceFile: analysis.sourceFile } : {}),
    origin,
    auditTimestamp: audit.auditTimestamp,
    auditPagesOnOrigin: [...pagesByPath.values()].reduce((sum, pages) => sum + pages.length, 0),
    ...counts,
    pathObservations: orderedObservations.slice(0, MAX_RETURNED_GEO_PATH_OBSERVATIONS),
    priorityReviewQueue,
    priorityReviewQueueTruncated:
      geoOpportunityCandidates.length > MAX_RETURNED_GEO_OPPORTUNITIES ||
      inputPathsTruncated ||
      audit.pagesSkipped > 0,
    aiReferralAuditCoverage,
    inputPathsTruncated,
    pathObservationsTruncated: orderedObservations.length > MAX_RETURNED_GEO_PATH_OBSERVATIONS,
    auditPathCoverage,
    note: 'This is a path-only join to the audit snapshot; request hosts are not retained or checked. Scope the supplied log to the origin passed here before correlating. Requests lose query strings, so audited URLs containing a query and duplicate paths are marked ambiguous; canonical aliases are not guessed. Current robots, indexing, and snippet controls may differ from the log period. Applebot rows can expose a current literal JSON-LD isAccessibleForFree:false declaration; Apple says this leaves Apple Search eligibility intact but excludes the page from additional context for AI outputs. HTTP response status and a current robots decision are separate observations; user-agent strings are claims and are not authenticated. User-triggered fetchers and custom unclassified tokens are not assigned search-crawler policy outcomes.',
  };
}

function sitemapLastmodUtcDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === trimmed
      ? trimmed
      : undefined;
  }
  // Require an explicit timezone for timestamps so the result is independent of the host's locale.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed))
    return undefined;
  if (!sitemapLastmodUtcDay(trimmed.slice(0, 10))) return undefined;
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
}

function utcDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
}

/** Compare sitemap-declared lastmod days with observed crawler requests in a supplied log sample. */
export function analyzeAiCrawlerSitemapRecrawlCoverage(
  analysis: AiCrawlerAccessLogAnalysis,
  sitemapEntries: SitemapPageEntry[],
  originValue: string,
  sitemapUrlValue: string,
  options: {
    sitemapUrlsTruncated?: boolean;
    entriesTruncated?: boolean;
    audit?: SiteWideGeoAnalysis;
  } = {}
): AiCrawlerSitemapFreshnessAnalysis {
  let originUrl: URL;
  let sitemapUrl: URL;
  try {
    originUrl = new URL(originValue);
    sitemapUrl = new URL(sitemapUrlValue);
  } catch {
    throw new Error('Sitemap crawler comparison requires absolute origin and sitemap URLs.');
  }
  if (
    !['http:', 'https:'].includes(originUrl.protocol) ||
    originUrl.username ||
    originUrl.password ||
    originUrl.pathname !== '/' ||
    originUrl.search ||
    originUrl.hash
  ) {
    throw new Error(
      'Sitemap crawler comparison origin must contain only an HTTP(S) scheme and host.'
    );
  }
  if (
    !['http:', 'https:'].includes(sitemapUrl.protocol) ||
    sitemapUrl.username ||
    sitemapUrl.password ||
    sitemapUrl.search ||
    sitemapUrl.origin !== originUrl.origin
  ) {
    throw new Error(
      'Crawler comparison sitemap must be a credential-free HTTP(S) URL without a query string on the supplied origin.'
    );
  }
  if (sitemapEntries.length > 50_000)
    throw new Error('Sitemap crawler comparison accepts at most 50,000 sitemap entries.');
  const origin = originUrl.origin;
  sitemapUrl.hash = '';
  const uniqueEntries = new Map<
    string,
    {
      path: string;
      hasQuery: boolean;
      lastmodState: 'valid' | 'missing' | 'invalid';
      lastmodDay?: string;
    }
  >();
  let duplicateSitemapEntries = 0;
  for (const entry of sitemapEntries) {
    let pageUrl: URL;
    try {
      pageUrl = new URL(entry.url);
    } catch {
      continue;
    }
    if (
      !['http:', 'https:'].includes(pageUrl.protocol) ||
      pageUrl.username ||
      pageUrl.password ||
      pageUrl.origin !== origin
    )
      continue;
    pageUrl.hash = '';
    const lastmodDay = sitemapLastmodUtcDay(entry.lastModified);
    const lastmodState = entry.lastModified?.trim()
      ? lastmodDay
        ? 'valid'
        : 'invalid'
      : 'missing';
    const current = uniqueEntries.get(pageUrl.href);
    if (!current) {
      uniqueEntries.set(pageUrl.href, {
        path: pageUrl.pathname,
        hasQuery: Boolean(pageUrl.search),
        lastmodState,
        ...(lastmodDay ? { lastmodDay } : {}),
      });
      continue;
    }
    duplicateSitemapEntries += 1;
    if (lastmodDay && (!current.lastmodDay || lastmodDay > current.lastmodDay)) {
      current.lastmodState = 'valid';
      current.lastmodDay = lastmodDay;
    } else if (
      !current.lastmodDay &&
      current.lastmodState === 'missing' &&
      lastmodState === 'invalid'
    ) {
      current.lastmodState = 'invalid';
    }
  }

  const pathCounts = new Map<string, number>();
  for (const entry of uniqueEntries.values())
    pathCounts.set(entry.path, (pathCounts.get(entry.path) ?? 0) + 1);
  const ambiguousPaths = new Set<string>();
  for (const [path, count] of pathCounts) if (count > 1) ambiguousPaths.add(path);
  let sitemapUrlsWithQueryStrings = 0;
  for (const entry of uniqueEntries.values()) {
    if (entry.hasQuery) {
      sitemapUrlsWithQueryStrings += 1;
      ambiguousPaths.add(entry.path);
    }
  }
  const sitemapUrlsSkippedAsAmbiguous = [...uniqueEntries.values()].filter(({ path }) =>
    ambiguousPaths.has(path)
  ).length;
  const pagesWithValidLastmod = [...uniqueEntries.values()].filter(
    ({ lastmodState }) => lastmodState === 'valid'
  ).length;
  const pagesWithoutLastmod = [...uniqueEntries.values()].filter(
    ({ lastmodState }) => lastmodState === 'missing'
  ).length;
  const pagesWithInvalidLastmod = [...uniqueEntries.values()].filter(
    ({ lastmodState }) => lastmodState === 'invalid'
  ).length;
  const pathObservations: AiCrawlerSitemapFreshnessOpportunity[] = [];
  const eligibleCrawlers = analysis.crawlers.filter(
    ({ activity }) => activity !== 'user-initiated-fetch' && activity !== 'unclassified'
  );
  let inputLogPathsTruncated = false;
  const crawlers = eligibleCrawlers.map((crawler): AiCrawlerSitemapCrawlerFreshness => {
    inputLogPathsTruncated ||= crawler.pathsTruncated;
    const pathsByName = new Map(crawler.paths.map((item) => [item.path, item]));
    const counts: AiCrawlerSitemapCrawlerFreshness = {
      crawlerToken: crawler.token,
      provider: crawler.provider,
      activity: crawler.activity,
      sitemapUrlsProvided: uniqueEntries.size,
      pagesWithValidLastmod: 0,
      pagesWithoutLastmod: 0,
      pagesWithInvalidLastmod: 0,
      pagesObservedInLog: 0,
      pagesNotObservedInLog: 0,
      pagesWithUpdateAfterLastObservedRequest: 0,
      pagesObservedSameUtcDayAsLastmod: 0,
      pagesObservedAfterLastmod: 0,
      pagesObservedWithoutTimestamp: 0,
      ambiguousPaths: 0,
      pagesSkippedAsAmbiguous: 0,
      requestsOnPagesWithValidLastmod: 0,
      requestsOnPagesWithUpdateAfterLastObservedRequest: 0,
      logPathsTruncated: crawler.pathsTruncated,
    };
    counts.ambiguousPaths = ambiguousPaths.size;
    counts.pagesSkippedAsAmbiguous = sitemapUrlsSkippedAsAmbiguous;
    for (const entry of uniqueEntries.values()) {
      const logPath = pathsByName.get(entry.path);
      const ambiguous = ambiguousPaths.has(entry.path);
      if (ambiguous) continue;
      if (entry.lastmodState === 'missing') {
        counts.pagesWithoutLastmod += 1;
        continue;
      }
      if (entry.lastmodState === 'invalid' || !entry.lastmodDay) {
        counts.pagesWithInvalidLastmod += 1;
        continue;
      }
      counts.pagesWithValidLastmod += 1;
      if (!logPath) {
        counts.pagesNotObservedInLog += 1;
        continue;
      }
      counts.pagesObservedInLog += 1;
      counts.requestsOnPagesWithValidLastmod += logPath.requests;
      const requestDay = utcDay(logPath.lastSeenAt);
      if (!requestDay) {
        counts.pagesObservedWithoutTimestamp += 1;
        continue;
      }
      if (entry.lastmodDay > requestDay) {
        counts.pagesWithUpdateAfterLastObservedRequest += 1;
        counts.requestsOnPagesWithUpdateAfterLastObservedRequest += logPath.requests;
        const daysBetweenLastRequestAndUpdate = Math.round(
          (Date.parse(`${entry.lastmodDay}T00:00:00Z`) - Date.parse(`${requestDay}T00:00:00Z`)) /
            86_400_000
        );
        pathObservations.push({
          crawlerToken: crawler.token,
          provider: crawler.provider,
          activity: crawler.activity,
          path: entry.path,
          requests: logPath.requests,
          crawlerRequests: crawler.requests,
          crawlerRequestSharePercent:
            crawler.requests > 0
              ? Number(((logPath.requests / crawler.requests) * 100).toFixed(3))
              : 0,
          sitemapLastModified: entry.lastmodDay,
          lastSeenAt: logPath.lastSeenAt!,
          daysBetweenLastRequestAndUpdate,
          state: 'updated-after-last-observed-request',
        });
      } else if (entry.lastmodDay === requestDay) {
        counts.pagesObservedSameUtcDayAsLastmod += 1;
      } else {
        counts.pagesObservedAfterLastmod += 1;
      }
    }
    return counts;
  });
  let schemaDateComparison: AiCrawlerSitemapSchemaDateComparison | undefined;
  if (options.audit) {
    const auditPagesByPath = new Map<
      string,
      Array<{ page: SiteWideGeoPageSummary; hasQuery: boolean }>
    >();
    for (const page of options.audit.pageSummaries) {
      try {
        const pageUrl = new URL(page.url);
        if (pageUrl.origin !== origin) continue;
        const candidates = auditPagesByPath.get(pageUrl.pathname) ?? [];
        candidates.push({ page, hasQuery: Boolean(pageUrl.search) });
        auditPagesByPath.set(pageUrl.pathname, candidates);
      } catch {
        // Invalid or non-HTTP audit URLs cannot be joined to a sitemap path.
      }
    }
    const schemaDateOpportunities: AiCrawlerSitemapSchemaDateOpportunity[] = [];
    const schemaCounts: AiCrawlerSitemapSchemaDateComparison = {
      auditTimestamp: options.audit.auditTimestamp,
      sitemapUrlsWithValidLastmod: 0,
      sitemapUrlsWithoutValidLastmod: 0,
      auditPathsMatched: 0,
      auditPathsNotFound: 0,
      auditPathsAmbiguous: 0,
      pagesWithSingleSchemaDateCompared: 0,
      pagesWithMatchingSchemaDateModified: 0,
      pagesWithDifferentSchemaDateModified: 0,
      pagesWithMultipleSchemaDateModified: 0,
      pagesWithoutSchemaDateModified: 0,
      pagesWithNonDateSchemaDateModified: 0,
      pagesWithUnassessedSchemaDateModified: 0,
      opportunitiesTruncated: false,
      opportunities: [],
    };
    for (const entry of uniqueEntries.values()) {
      if (ambiguousPaths.has(entry.path)) continue;
      if (entry.lastmodState !== 'valid' || !entry.lastmodDay) {
        schemaCounts.sitemapUrlsWithoutValidLastmod += 1;
        continue;
      }
      schemaCounts.sitemapUrlsWithValidLastmod += 1;
      const candidates = auditPagesByPath.get(entry.path) ?? [];
      if (candidates.length > 1 || candidates.some(({ hasQuery }) => hasQuery)) {
        schemaCounts.auditPathsAmbiguous += 1;
        continue;
      }
      const page = candidates[0]?.page;
      if (!page) {
        schemaCounts.auditPathsNotFound += 1;
        continue;
      }
      schemaCounts.auditPathsMatched += 1;
      const answerContent = page.answerContent;
      const schemaDays = answerContent?.schemaDateModifiedDays;
      if (page.signalCoverage.answerContent !== 'measured' || !Array.isArray(schemaDays)) {
        schemaCounts.pagesWithUnassessedSchemaDateModified += 1;
        continue;
      }
      const distinctSchemaDays = [...new Set(schemaDays)].sort();
      const hasNonDateValue = answerContent?.schemaDateModifiedHasNonDateValue === true;
      if (hasNonDateValue) schemaCounts.pagesWithNonDateSchemaDateModified += 1;
      if (distinctSchemaDays.length === 0) {
        schemaCounts.pagesWithoutSchemaDateModified += 1;
        schemaDateOpportunities.push({
          path: entry.path,
          sitemapLastModified: entry.lastmodDay,
          schemaDateModifiedDays: [],
          reason: hasNonDateValue ? 'non-date-value' : 'missing-date',
        });
        continue;
      }
      if (
        distinctSchemaDays.length > 1 ||
        answerContent?.schemaDateModifiedDaysTruncated === true
      ) {
        schemaCounts.pagesWithMultipleSchemaDateModified += 1;
        schemaDateOpportunities.push({
          path: entry.path,
          sitemapLastModified: entry.lastmodDay,
          schemaDateModifiedDays: distinctSchemaDays.slice(0, 10),
          reason: 'multiple-dates',
        });
        continue;
      }
      schemaCounts.pagesWithSingleSchemaDateCompared += 1;
      if (distinctSchemaDays[0] === entry.lastmodDay) {
        schemaCounts.pagesWithMatchingSchemaDateModified += 1;
      } else {
        schemaCounts.pagesWithDifferentSchemaDateModified += 1;
        schemaDateOpportunities.push({
          path: entry.path,
          sitemapLastModified: entry.lastmodDay,
          schemaDateModifiedDays: distinctSchemaDays,
          reason: 'different-date',
        });
      }
    }
    const reasonPriority: Record<AiCrawlerSitemapSchemaDateOpportunityReason, number> = {
      'different-date': 0,
      'multiple-dates': 1,
      'missing-date': 2,
      'non-date-value': 3,
    };
    schemaDateOpportunities.sort(
      (left, right) =>
        reasonPriority[left.reason] - reasonPriority[right.reason] ||
        left.path.localeCompare(right.path)
    );
    schemaCounts.opportunitiesTruncated =
      schemaDateOpportunities.length > MAX_RETURNED_SITEMAP_FRESHNESS_OPPORTUNITIES;
    schemaCounts.opportunities = schemaDateOpportunities.slice(
      0,
      MAX_RETURNED_SITEMAP_FRESHNESS_OPPORTUNITIES
    );
    schemaDateComparison = schemaCounts;
  }
  pathObservations.sort(
    (left, right) =>
      right.requests - left.requests ||
      right.daysBetweenLastRequestAndUpdate - left.daysBetweenLastRequestAndUpdate ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.path.localeCompare(right.path)
  );
  return {
    ...(analysis.sourceFile ? { sourceFile: analysis.sourceFile } : {}),
    origin,
    sitemapUrl: sitemapUrl.href,
    sitemapUrlsProvided: uniqueEntries.size,
    duplicateSitemapEntries,
    pagesWithValidLastmod,
    pagesWithoutLastmod,
    pagesWithInvalidLastmod,
    sitemapUrlsWithQueryStrings,
    sitemapUrlsSkippedAsAmbiguous,
    sitemapUrlsTruncated: options.sitemapUrlsTruncated === true,
    sitemapEntriesTruncated: options.entriesTruncated === true,
    inputLogPathsTruncated,
    opportunitiesTruncated: pathObservations.length > MAX_RETURNED_SITEMAP_FRESHNESS_OPPORTUNITIES,
    crawlers,
    updateOpportunities: pathObservations.slice(0, MAX_RETURNED_SITEMAP_FRESHNESS_OPPORTUNITIES),
    ...(schemaDateComparison ? { schemaDateComparison } : {}),
    note:
      'This report compares publisher-declared sitemap lastmod calendar days with the last parseable request timestamp for claimed crawler tokens in the supplied log sample. It is a day-level, path-only comparison; same-day order is indeterminate, query-bearing or duplicate sitemap paths are excluded as ambiguous, and off-origin or malformed URLs are skipped. Search-crawl, training-data, and data-use tokens are summarized; user-triggered fetches and custom unclassified tokens are excluded because their request timing is not a recrawl schedule. A sitemap lastmod is not proof of page content changes or a crawl instruction that was followed. No request in these retained logs means not observed in this sample, not never crawled; truncated log details can understate matches. These observations do not predict indexing, freshness in an AI product, or citation.' +
      (schemaDateComparison
        ? ` The optional JSON-LD dateModified comparison uses the saved audit snapshot at ${schemaDateComparison.auditTimestamp}, matches unique exact paths only, and treats absent or multiple date values as review cases; pages outside that saved audit are not compared.`
        : ''),
  };
}

/** Replay retained log paths against a caller-supplied robots.txt snapshot without fetching the site. */
export function analyzeAiCrawlerLogRobotsPolicy(
  analysis: AiCrawlerAccessLogAnalysis,
  robotsSource: string,
  originValue: string,
  options: { sourceFile?: string; sourceModifiedAt?: string } = {}
): AiCrawlerRobotsPolicyAnalysis {
  let originUrl: URL;
  try {
    originUrl = new URL(originValue);
  } catch {
    throw new Error('Crawler robots-policy origin must be an absolute HTTP(S) origin URL.');
  }
  if (
    !['http:', 'https:'].includes(originUrl.protocol) ||
    originUrl.username ||
    originUrl.password ||
    originUrl.pathname !== '/' ||
    originUrl.search ||
    originUrl.hash
  ) {
    throw new Error(
      'Crawler robots-policy origin must contain only an HTTP(S) scheme and host, such as https://example.com.'
    );
  }
  const origin = originUrl.origin;
  const policy = parseRobotsTxtPolicy(robotsSource);
  const pathObservations: AiCrawlerRobotsPolicyPathObservation[] = [];
  const crawlers = analysis.crawlers.map((crawler): AiCrawlerRobotsPolicySummary => {
    const summary: AiCrawlerRobotsPolicySummary = {
      token: crawler.token,
      provider: crawler.provider,
      activity: crawler.activity,
      pathsEvaluated: 0,
      requestsEvaluated: 0,
      allowedPaths: 0,
      blockedPaths: 0,
      notAssessedPaths: 0,
      notApplicablePaths: 0,
      allowedRequests: 0,
      blockedRequests: 0,
    };
    for (const path of crawler.paths) {
      let policyDecision: AiCrawlerRobotsPolicyPathObservation['policyDecision'];
      let selectedAgents: string[] = [];
      let matchedRule: AiCrawlerRobotsPolicyPathObservation['matchedRule'];
      if (
        crawler.activity === 'user-initiated-fetch' &&
        !ROBOTS_CONTROLLED_USER_FETCH_TOKENS.has(crawler.token.toLowerCase())
      ) {
        policyDecision = 'not-applicable';
        summary.notApplicablePaths += 1;
      } else if (crawler.activity === 'unclassified') {
        policyDecision = 'not-assessed';
        summary.notAssessedPaths += 1;
      } else {
        const decision = policy.explain(new URL(path.path, origin), crawler.token);
        policyDecision = decision.allowed ? 'allowed' : 'blocked';
        selectedAgents = decision.matchedAgents;
        matchedRule = decision.matchedRule;
        summary.pathsEvaluated += 1;
        summary.requestsEvaluated += path.requests;
        if (decision.allowed) {
          summary.allowedPaths += 1;
          summary.allowedRequests += path.requests;
        } else {
          summary.blockedPaths += 1;
          summary.blockedRequests += path.requests;
        }
      }
      pathObservations.push({
        ...path,
        crawlerToken: crawler.token,
        provider: crawler.provider,
        activity: crawler.activity,
        policyDecision,
        selectedAgents,
        ...(matchedRule ? { matchedRule } : {}),
      });
    }
    return summary;
  });
  const orderedObservations = pathObservations.sort(
    (left, right) =>
      (left.policyDecision === 'blocked' ? 0 : 1) - (right.policyDecision === 'blocked' ? 0 : 1) ||
      right.requests - left.requests ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.path.localeCompare(right.path)
  );
  return {
    source: 'Aviary AI crawler robots policy replay',
    schemaVersion: 1,
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    ...(options.sourceModifiedAt ? { sourceModifiedAt: options.sourceModifiedAt } : {}),
    robotsSha256: createHash('sha256').update(robotsSource, 'utf8').digest('hex'),
    origin,
    inputPathsTruncated: analysis.crawlers.some(({ pathsTruncated }) => pathsTruncated),
    crawlers,
    pathObservations: orderedObservations.slice(0, MAX_RETURNED_ROBOTS_PATH_OBSERVATIONS),
    pathObservationsTruncated: orderedObservations.length > MAX_RETURNED_ROBOTS_PATH_OBSERVATIONS,
    note: 'This replays only paths retained by the supplied log analysis against the provided robots.txt snapshot. Results describe current saved rules, not historical policy at request time or the server response actually delivered. Query strings were removed from logs, so query-dependent rules cannot be evaluated exactly. The snapshot is hashed but its content is not retained. Search, training-only, and broader data-use crawler tokens are evaluated separately. Mistral documents MistralAI-User as a user-triggered fetch controlled by its robots policy; other user-triggered fetchers and custom unclassified tokens receive no inferred robots decision here. Google-Extended and Applebot-Extended are robots policy tokens without separate HTTP crawler identities, so they are not expected in access logs. User-agent identities remain unverified claims.',
  };
}

/** Compare two robots-policy replays over the same retained log observations. */
export function compareAiCrawlerRobotsPolicyReplays(
  baseline: AiCrawlerRobotsPolicyAnalysis,
  current: AiCrawlerRobotsPolicyAnalysis
): AiCrawlerRobotsPolicyComparison {
  if (baseline.origin !== current.origin) {
    throw new Error('Robots policy snapshots must use the same origin to be compared.');
  }
  const baselinePaths = new Map(
    baseline.pathObservations.map((item) => [
      `${item.crawlerToken.toLowerCase()}\u0000${item.path}`,
      item,
    ])
  );
  const currentPaths = new Map(
    current.pathObservations.map((item) => [
      `${item.crawlerToken.toLowerCase()}\u0000${item.path}`,
      item,
    ])
  );
  const counts = {
    pathsCompared: 0,
    pathsNewlyBlocked: 0,
    pathsNewlyAllowed: 0,
    pathsWithRuleChanges: 0,
    pathsUnchanged: 0,
    pathsNotComparable: 0,
    pathsMissingFromBaseline: 0,
    pathsMissingFromCurrent: 0,
    requestsNewlyBlocked: 0,
    requestsNewlyAllowed: 0,
  };
  const pathChanges = current.pathObservations.map((item): AiCrawlerRobotsPolicyPathChange => {
    const prior = baselinePaths.get(`${item.crawlerToken.toLowerCase()}\u0000${item.path}`);
    let change: AiCrawlerRobotsPolicyPathChange['change'] = 'not-comparable';
    if (
      prior &&
      prior.requests === item.requests &&
      prior.activity === item.activity &&
      ['allowed', 'blocked'].includes(prior.policyDecision) &&
      ['allowed', 'blocked'].includes(item.policyDecision)
    ) {
      counts.pathsCompared += 1;
      if (prior.policyDecision === 'allowed' && item.policyDecision === 'blocked') {
        change = 'newly-blocked';
        counts.pathsNewlyBlocked += 1;
        counts.requestsNewlyBlocked += item.requests;
      } else if (prior.policyDecision === 'blocked' && item.policyDecision === 'allowed') {
        change = 'newly-allowed';
        counts.pathsNewlyAllowed += 1;
        counts.requestsNewlyAllowed += item.requests;
      } else {
        const priorAgents = [...prior.selectedAgents]
          .map((agent) => agent.toLowerCase())
          .sort()
          .join('\u0000');
        const currentAgents = [...item.selectedAgents]
          .map((agent) => agent.toLowerCase())
          .sort()
          .join('\u0000');
        const priorRule = prior.matchedRule
          ? `${prior.matchedRule.directive}:${prior.matchedRule.pattern}`
          : '';
        const currentRule = item.matchedRule
          ? `${item.matchedRule.directive}:${item.matchedRule.pattern}`
          : '';
        if (priorAgents !== currentAgents || priorRule !== currentRule) {
          change = 'rule-changed';
          counts.pathsWithRuleChanges += 1;
        } else {
          change = 'unchanged';
          counts.pathsUnchanged += 1;
        }
      }
    } else {
      counts.pathsNotComparable += 1;
      if (!prior) counts.pathsMissingFromBaseline += 1;
    }
    return {
      ...item,
      ...(prior
        ? {
            baselineDecision: prior.policyDecision,
            baselineSelectedAgents: prior.selectedAgents,
            ...(prior.matchedRule ? { baselineMatchedRule: prior.matchedRule } : {}),
          }
        : {}),
      change,
    };
  });
  counts.pathsMissingFromCurrent = [...baselinePaths.keys()].filter(
    (key) => !currentPaths.has(key)
  ).length;
  const changeOrder: Record<AiCrawlerRobotsPolicyPathChange['change'], number> = {
    'newly-blocked': 0,
    'newly-allowed': 1,
    'rule-changed': 2,
    unchanged: 3,
    'not-comparable': 4,
  };
  pathChanges.sort(
    (left, right) =>
      changeOrder[left.change] - changeOrder[right.change] ||
      right.requests - left.requests ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.path.localeCompare(right.path)
  );
  return {
    source: 'Aviary AI crawler robots policy comparison',
    schemaVersion: 1,
    origin: current.origin,
    baselineSnapshot: {
      ...(baseline.sourceFile ? { sourceFile: baseline.sourceFile } : {}),
      ...(baseline.sourceModifiedAt ? { modifiedAt: baseline.sourceModifiedAt } : {}),
      sha256: baseline.robotsSha256,
    },
    currentSnapshot: {
      ...(current.sourceFile ? { sourceFile: current.sourceFile } : {}),
      ...(current.sourceModifiedAt ? { modifiedAt: current.sourceModifiedAt } : {}),
      sha256: current.robotsSha256,
    },
    ...counts,
    inputPathsTruncated: baseline.inputPathsTruncated || current.inputPathsTruncated,
    pathChanges: pathChanges.slice(0, MAX_RETURNED_ROBOTS_PATH_OBSERVATIONS),
    pathChangesTruncated:
      baseline.pathObservationsTruncated ||
      current.pathObservationsTruncated ||
      pathChanges.length > MAX_RETURNED_ROBOTS_PATH_OBSERVATIONS,
    note: 'Changes compare the same retained access-log path/request observations against two supplied robots.txt snapshots. Newly blocked or allowed paths reflect current parsed rules only; they do not prove a crawler saw or obeyed either file. A rule change can alter selected groups or the winning directive/pattern while leaving access unchanged. Query strings are absent from logged paths, and user-agent claims remain unauthenticated. Non-comparable rows lack a matching baseline observation or have a different activity/request count.',
  };
}

/** Re-evaluate every retained audit URL against a supplied robots.txt snapshot, preserving URL query strings. */
export function analyzeAiCrawlerRobotsAuditReplay(
  auditUrls: string[],
  robotsSource: string,
  originValue: string,
  options: {
    sourceFile?: string;
    sitemapUrl?: string;
    targetSource?: 'saved-audit' | 'sitemap';
    targetsMayBeTruncated?: boolean;
    robotsFile?: string;
    robotsModifiedAt?: string;
    auditTimestamp?: string;
    auditPagesUnavailable?: number;
    customTokens?: string[];
  } = {}
): AiCrawlerRobotsAuditReplay {
  const targetSource = options.targetSource ?? 'saved-audit';
  if (targetSource === 'sitemap' && !options.sitemapUrl)
    throw new Error('A sitemap URL is required for sitemap-target robots replay.');
  if (targetSource === 'saved-audit' && options.sitemapUrl)
    throw new Error('A sitemap URL requires sitemap-target robots replay.');
  let originUrl: URL;
  try {
    originUrl = new URL(originValue);
  } catch {
    throw new Error('GEO robots audit origin must be an absolute HTTP(S) origin URL.');
  }
  if (
    !['http:', 'https:'].includes(originUrl.protocol) ||
    originUrl.username ||
    originUrl.password ||
    originUrl.pathname !== '/' ||
    originUrl.search ||
    originUrl.hash
  ) {
    throw new Error(
      'GEO robots audit origin must contain only an HTTP(S) scheme and host, such as https://example.com.'
    );
  }
  if (options.sitemapUrl) {
    let sitemapUrl: URL;
    try {
      sitemapUrl = new URL(options.sitemapUrl);
    } catch {
      throw new Error('GEO robots sitemap URL must be an absolute HTTP(S) URL.');
    }
    if (
      !['http:', 'https:'].includes(sitemapUrl.protocol) ||
      sitemapUrl.username ||
      sitemapUrl.password ||
      sitemapUrl.origin !== originUrl.origin
    ) {
      throw new Error(
        'GEO robots sitemap URL must be credential-free and share the replay origin.'
      );
    }
  }
  if (auditUrls.length > 10_000)
    throw new Error('GEO robots audit replay accepts at most 10,000 URLs.');
  const definitions: Array<
    Omit<AiCrawlerDefinition, 'activity'> & { activity: AiRobotsPolicyActivity }
  > = [
    ...AI_CRAWLER_CATALOG.filter(
      ({ activity, token }) =>
        activity === 'search-crawl' ||
        isDataUseCrawlerActivity(activity) ||
        (activity === 'user-initiated-fetch' &&
          ROBOTS_CONTROLLED_USER_FETCH_TOKENS.has(token.toLowerCase()))
    ),
    { token: 'Applebot-Extended', provider: 'Apple', activity: 'data-use-policy' },
    { token: 'Google-Extended', provider: 'Google', activity: 'data-use-policy' },
  ];
  const seenTokens = new Set(definitions.map(({ token }) => token.toLowerCase()));
  const customTokens = [...new Set((options.customTokens ?? []).map((token) => token.trim()))];
  if (
    customTokens.length > 20 ||
    customTokens.some((token) => !/^[A-Za-z][A-Za-z\d_-]{0,79}$/.test(token))
  ) {
    throw new Error(
      'GEO robots audit replay accepts at most 20 custom tokens, each 1-80 letters, digits, underscores, or hyphens and starting with a letter.'
    );
  }
  for (const token of customTokens) {
    if (seenTokens.has(token.toLowerCase()))
      throw new Error(`Custom GEO robots token ${token} duplicates a built-in crawler token.`);
    seenTokens.add(token.toLowerCase());
  }
  const allDefinitions: Array<
    Omit<AiCrawlerDefinition, 'activity'> & {
      activity: AiRobotsPolicyActivity;
      customToken: boolean;
    }
  > = [
    ...definitions.map((definition) => ({ ...definition, customToken: false })),
    ...customTokens.map((token) => ({
      token,
      provider: 'Custom',
      activity: 'unclassified' as const,
      customToken: true,
    })),
  ];
  const policy = parseRobotsTxtPolicy(robotsSource);
  const uniqueUrls = [...new Set(auditUrls)];
  const pages: Array<{ url: URL; auditUrlIndex: number }> = [];
  const pageRequestTargets = new Set<string>();
  let pagesSkipped = 0;
  for (const value of uniqueUrls) {
    try {
      const url = new URL(value);
      if (
        url.origin !== originUrl.origin ||
        url.username ||
        url.password ||
        !['http:', 'https:'].includes(url.protocol) ||
        url.href.length > MAX_ROBOTS_AUDIT_URL_LENGTH
      ) {
        pagesSkipped += 1;
        continue;
      }
      url.hash = '';
      if (pageRequestTargets.has(url.href)) continue;
      pageRequestTargets.add(url.href);
      pages.push({ url, auditUrlIndex: pages.length + 1 });
    } catch {
      pagesSkipped += 1;
    }
  }
  const rows: AiCrawlerRobotsAuditReplayRow[] = [];
  let rowsSeen = 0;
  const perCrawlerDetailLimit = Math.floor(MAX_RETURNED_ROBOTS_AUDIT_ROWS / allDefinitions.length);
  const crawlerPolicies = allDefinitions.map((definition) => {
    let pagesAllowed = 0;
    let pagesBlocked = 0;
    const blockedUrls = new Set<string>();
    const detailRows: AiCrawlerRobotsAuditReplayRow[] = [];
    for (const { url, auditUrlIndex } of pages) {
      const decision = policy.explain(url, definition.token);
      if (decision.allowed) pagesAllowed += 1;
      else {
        pagesBlocked += 1;
        const displayUrl = new URL(url);
        displayUrl.search = '';
        displayUrl.hash = '';
        blockedUrls.add(displayUrl.href);
      }
      rowsSeen += 1;
      if (detailRows.length < perCrawlerDetailLimit) {
        const displayUrl = new URL(url);
        displayUrl.search = '';
        displayUrl.hash = '';
        detailRows.push({
          auditUrlIndex,
          url: displayUrl.href,
          queryStringEvaluated: Boolean(url.search),
          queryParametersEvaluated: url.searchParams.size,
          crawlerToken: definition.token,
          provider: definition.provider,
          activity: definition.activity,
          customToken: definition.customToken,
          allowed: decision.allowed,
          selectedAgents: decision.matchedAgents,
          ...(decision.matchedRule ? { matchedRule: decision.matchedRule } : {}),
        });
      }
    }
    rows.push(...detailRows);
    return {
      token: definition.token,
      provider: definition.provider,
      activity: definition.activity,
      customToken: definition.customToken,
      pagesEvaluated: pages.length,
      pagesAllowed,
      pagesBlocked,
      blockedUrls: [...blockedUrls].slice(0, 100),
      blockedUrlsTruncated: blockedUrls.size > 100,
    };
  });
  rows.sort(
    (left, right) =>
      Number(left.customToken) - Number(right.customToken) ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.auditUrlIndex - right.auditUrlIndex
  );
  const sitemapNote =
    targetSource === 'sitemap'
      ? `Page URLs came from the live sitemap source ${options.sitemapUrl}; sitemap discovery is separate from this supplied robots.txt snapshot. Page content is not fetched for replay.`
      : 'The supplied target list came from a saved page audit, which may predate this robots snapshot.';
  return {
    source: 'Aviary GEO robots policy URL replay',
    schemaVersion: 1,
    targetSource,
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    ...(options.sitemapUrl ? { sitemapUrl: options.sitemapUrl } : {}),
    ...(options.robotsFile ? { robotsFile: options.robotsFile } : {}),
    ...(options.robotsModifiedAt ? { robotsModifiedAt: options.robotsModifiedAt } : {}),
    robotsSha256: createHash('sha256').update(robotsSource, 'utf8').digest('hex'),
    origin: originUrl.origin,
    ...(options.auditTimestamp ? { auditTimestamp: options.auditTimestamp } : {}),
    uniqueTargetUrls: uniqueUrls.length,
    ...(options.targetsMayBeTruncated
      ? { targetsMayBeTruncated: true }
      : { targetsMayBeTruncated: false }),
    uniqueAuditUrls: targetSource === 'saved-audit' ? pages.length + pagesSkipped : 0,
    pagesOnOrigin: pages.length,
    pagesSkipped,
    auditPagesUnavailable:
      targetSource === 'saved-audit' ? (options.auditPagesUnavailable ?? 0) : 0,
    crawlerPolicies,
    rows: rows.slice(0, MAX_RETURNED_ROBOTS_AUDIT_ROWS),
    rowsTruncated: rowsSeen > MAX_RETURNED_ROBOTS_AUDIT_ROWS,
    note: `This replay evaluates ${targetSource === 'sitemap' ? 'URLs discovered from the supplied sitemap' : 'saved audit URLs'} against a caller-supplied robots.txt snapshot without fetching page content. ${sitemapNote} Query strings are applied to the policy decision, but their values and URL fragments are omitted from output; query presence and parameter counts remain. The snapshot hash is included but the policy text is not retained. Search and data-use policy tokens are evaluated separately; Google-Extended and Applebot-Extended are identified as data-use policy tokens, not HTTP crawler identities. MistralAI-User is included because Mistral documents its robots policy as governing these user-triggered page fetches; other user-triggered fetchers are excluded. Custom tokens are explicitly user-supplied and have unknown provider/activity. User-agent product tokens are policy labels, not authenticated crawler identity. ${options.targetsMayBeTruncated ? 'The sitemap URL limit was reached, so the page list may be incomplete.' : ''}`,
  };
}

/** Compare matching audit URL/token decisions across two policy snapshots. */
export function compareAiCrawlerRobotsAuditReplays(
  baseline: AiCrawlerRobotsAuditReplay,
  current: AiCrawlerRobotsAuditReplay
): AiCrawlerRobotsAuditReplayComparison {
  if (baseline.origin !== current.origin)
    throw new Error('Robots target replays must use the same origin to be compared.');
  const baselineTargetSource = baseline.targetSource ?? 'saved-audit';
  const currentTargetSource = current.targetSource ?? 'saved-audit';
  if (baselineTargetSource !== currentTargetSource)
    throw new Error('Robots target replays must use the same source type to be compared.');
  if (baselineTargetSource === 'sitemap' && baseline.sitemapUrl !== current.sitemapUrl) {
    throw new Error('Sitemap robots replays must use the same sitemap URL to be compared.');
  }
  const keyFor = ({
    crawlerToken,
    auditUrlIndex,
    url,
    queryStringEvaluated,
    queryParametersEvaluated,
  }: AiCrawlerRobotsAuditReplayRow): string =>
    queryStringEvaluated
      ? `${crawlerToken.toLowerCase()}\u0000query-index:${auditUrlIndex}:${queryParametersEvaluated}`
      : `${crawlerToken.toLowerCase()}\u0000url:${url}`;
  const baselineByKey = new Map(baseline.rows.map((row) => [keyFor(row), row]));
  const currentByKey = new Map(current.rows.map((row) => [keyFor(row), row]));
  const counts = {
    urlTokenPairsCompared: 0,
    urlTokenPairsNewlyBlocked: 0,
    urlTokenPairsNewlyAllowed: 0,
    urlTokenPairsWithRuleChanges: 0,
    urlTokenPairsUnchanged: 0,
    urlTokenPairsNotComparable: 0,
    urlTokenPairsMissingFromBaseline: 0,
    urlTokenPairsMissingFromCurrent: 0,
  };
  const changes = current.rows.map((row): AiCrawlerRobotsAuditReplayChange => {
    const prior = baselineByKey.get(keyFor(row));
    let change: AiCrawlerRobotsAuditReplayChange['change'] = 'not-comparable';
    if (
      prior &&
      prior.url === row.url &&
      prior.queryStringEvaluated === row.queryStringEvaluated &&
      prior.queryParametersEvaluated === row.queryParametersEvaluated &&
      prior.customToken === row.customToken
    ) {
      counts.urlTokenPairsCompared += 1;
      if (!prior.allowed && row.allowed) {
        change = 'newly-allowed';
        counts.urlTokenPairsNewlyAllowed += 1;
      } else if (prior.allowed && !row.allowed) {
        change = 'newly-blocked';
        counts.urlTokenPairsNewlyBlocked += 1;
      } else {
        const priorAgents = [...prior.selectedAgents]
          .map((agent) => agent.toLowerCase())
          .sort()
          .join('\u0000');
        const currentAgents = [...row.selectedAgents]
          .map((agent) => agent.toLowerCase())
          .sort()
          .join('\u0000');
        const priorRule = prior.matchedRule
          ? `${prior.matchedRule.directive}:${prior.matchedRule.pattern}`
          : '';
        const currentRule = row.matchedRule
          ? `${row.matchedRule.directive}:${row.matchedRule.pattern}`
          : '';
        if (priorAgents !== currentAgents || priorRule !== currentRule) {
          change = 'rule-changed';
          counts.urlTokenPairsWithRuleChanges += 1;
        } else {
          change = 'unchanged';
          counts.urlTokenPairsUnchanged += 1;
        }
      }
    } else {
      counts.urlTokenPairsNotComparable += 1;
      if (!prior) counts.urlTokenPairsMissingFromBaseline += 1;
    }
    return {
      ...row,
      change,
      ...(prior
        ? {
            baselineAllowed: prior.allowed,
            baselineSelectedAgents: prior.selectedAgents,
            ...(prior.matchedRule ? { baselineMatchedRule: prior.matchedRule } : {}),
          }
        : {}),
    };
  });
  counts.urlTokenPairsMissingFromCurrent = [...baselineByKey.keys()].filter(
    (key) => !currentByKey.has(key)
  ).length;
  const order: Record<AiCrawlerRobotsAuditReplayChange['change'], number> = {
    'newly-blocked': 0,
    'newly-allowed': 1,
    'rule-changed': 2,
    unchanged: 3,
    'not-comparable': 4,
  };
  changes.sort(
    (left, right) =>
      order[left.change] - order[right.change] ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.auditUrlIndex - right.auditUrlIndex
  );
  return {
    source: 'Aviary GEO robots policy URL replay comparison',
    schemaVersion: 1,
    origin: current.origin,
    targetSource: currentTargetSource,
    baselineSnapshot: {
      ...(baseline.robotsFile ? { robotsFile: baseline.robotsFile } : {}),
      ...(baseline.robotsModifiedAt ? { modifiedAt: baseline.robotsModifiedAt } : {}),
      sha256: baseline.robotsSha256,
    },
    currentSnapshot: {
      ...(current.robotsFile ? { robotsFile: current.robotsFile } : {}),
      ...(current.robotsModifiedAt ? { modifiedAt: current.robotsModifiedAt } : {}),
      sha256: current.robotsSha256,
    },
    ...(baseline.auditTimestamp ? { baselineAuditTimestamp: baseline.auditTimestamp } : {}),
    ...(current.auditTimestamp ? { currentAuditTimestamp: current.auditTimestamp } : {}),
    ...counts,
    inputRowsTruncated:
      baseline.rowsTruncated ||
      current.rowsTruncated ||
      baseline.targetsMayBeTruncated === true ||
      current.targetsMayBeTruncated === true,
    changes: changes.slice(0, MAX_RETURNED_ROBOTS_AUDIT_ROWS),
    changesTruncated:
      baseline.rowsTruncated ||
      current.rowsTruncated ||
      baseline.targetsMayBeTruncated === true ||
      current.targetsMayBeTruncated === true ||
      changes.length > MAX_RETURNED_ROBOTS_AUDIT_ROWS,
    note: `The comparison joins ${currentTargetSource === 'sitemap' ? 'same-origin sitemap URLs' : 'saved-audit URLs'} and crawler tokens across two supplied robots.txt snapshots. Query values are omitted from output but applied during matching. Newly blocked/allowed results describe the supplied snapshots only; they do not prove what providers crawled or which policy they received. A rule selection can change without access changing. The row detail is bounded, and missing rows or truncated target lists are reported explicitly.`,
  };
}
