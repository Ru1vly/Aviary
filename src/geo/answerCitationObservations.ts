import { createHash } from 'node:crypto';
import type { SiteWideGeoAnalysis, SiteWideGeoPageSummary } from '../sitewide';
import type { AiCrawlerAccessLogAnalysis, AiCrawlerActivity } from './aiCrawlerLogs';

export interface AiAnswerCitationObservationInput {
  observedAt: string;
  provider: string;
  prompt: string;
  citedUrls: string[];
  citationListComplete?: boolean;
  answerText?: string;
  topic?: string;
  intent?: string;
  model?: string;
  surface?: string;
  locale?: string;
}

export interface AiAnswerCitationRateConfidenceInterval95 {
  lowerPercent: number;
  upperPercent: number;
}

export interface AiAnswerCitationRateDifferenceConfidenceInterval95 {
  lowerPercentagePoints: number;
  upperPercentagePoints: number;
}

export interface AiAnswerCitationEntityMentionSlice {
  observationsWithAnswerText: number;
  observationsWithoutAnswerText: number;
  observationsMentioningEntity: number;
  entityMentionRatePercent: number | null;
  entityMentionRateConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  entityMentionOccurrences: number;
  answersMentionedInFirstThird: number;
  firstThirdMentionSharePercent: number | null;
  firstThirdMentionShareConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  medianFirstMentionPositionPercent: number | null;
  observationsMentioningWithAnyCitation: number;
  anyCitationCoverageWhenMentionedPercent: number | null;
  anyCitationCoverageWhenMentionedConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  observationsWithoutEntityMention: number;
  observationsWithoutEntityMentionWithAnyCitation: number;
  anyCitationCoverageWhenNotMentionedPercent: number | null;
  anyCitationCoverageWhenNotMentionedConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  observationsMentioningWithOwnedCitation?: number;
  ownedCitationCoverageWhenMentionedPercent?: number | null;
  ownedCitationCoverageWhenMentionedConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  observationsWithoutEntityMentionWithOwnedCitation?: number;
  ownedCitationCoverageWhenNotMentionedPercent?: number | null;
  ownedCitationCoverageWhenNotMentionedConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationPositionWhenMentioned?: AiAnswerCitationEntityOwnedPositionProfile;
  ownedCitationPositionWhenNotMentioned?: AiAnswerCitationEntityOwnedPositionProfile;
  citationDomainAssociations?: AiAnswerCitationEntityMentionDomainAssociation[];
  citationDomainAssociationsTruncated?: boolean;
}

export interface AiAnswerCitationEntityOwnedPositionProfile {
  citationEvents: number;
  firstPositionCitationEvents: number;
  firstPositionCitationSharePercent: number | null;
  topThreeCitationEvents: number;
  topThreeCitationSharePercent: number | null;
}

export interface AiAnswerCitationEntityMentionDomainAssociation {
  domain: string;
  citationEventsInMentionedAnswerSamples: number;
  citationEventsWhenMentioned: number;
  observationsWithDomainWhenMentioned: number;
  uniquePromptsWhenMentioned: number;
  citationEventShareWhenMentionedPercent: number | null;
  citationEventsInNonMentionedAnswerSamples: number;
  citationEventsWhenNotMentioned: number;
  observationsWithDomainWhenNotMentioned: number;
  uniquePromptsWhenNotMentioned: number;
  citationEventShareWhenNotMentionedPercent: number | null;
  citationEventShareChangePercentagePoints: number | null;
}

export interface AiAnswerCitationEntityMentionProfile extends AiAnswerCitationEntityMentionSlice {
  entity: string;
  aliases: string[];
  providerProfiles: Array<AiAnswerCitationEntityMentionSlice & { provider: string }>;
}

/** Exact prompt/provider drilldown for locally observed answer-text entity outcomes. */
export interface AiAnswerCitationEntityPromptProfile {
  entity: string;
  aliases: string[];
  prompt: string;
  provider: string;
  observations: number;
  observationsWithAnswerText: number;
  observationsWithoutAnswerText: number;
  observationsMentioningEntity: number;
  entityMentionRatePercent: number | null;
  entityMentionRateConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  observationsMentioningWithAnyCitation: number;
  anyCitationCoverageWhenMentionedPercent: number | null;
  anyCitationCoverageWhenMentionedConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  observationsWithoutEntityMention: number;
  observationsWithoutEntityMentionWithAnyCitation: number;
  anyCitationCoverageWhenNotMentionedPercent: number | null;
  anyCitationCoverageWhenNotMentionedConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  observationsMentioningWithOwnedCitation?: number;
  ownedCitationCoverageWhenMentionedPercent?: number | null;
  ownedCitationCoverageWhenMentionedConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationEventsWhenMentioned?: number;
  ownedTopThreeCitationEventsWhenMentioned?: number;
  ownedTopThreeCitationShareWhenMentionedPercent?: number | null;
  observationsWithoutEntityMentionWithOwnedCitation?: number;
  ownedCitationCoverageWhenNotMentionedPercent?: number | null;
  ownedCitationCoverageWhenNotMentionedConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface AiAnswerCitationEntityPromptProviderPairProfile {
  entity: string;
  aliases: string[];
  providerA: string;
  providerB: string;
  sharedPromptGroups: number;
  comparablePromptGroups: number;
  promptGroupsMissingAnswerTextOnEitherSide: number;
  providerAFirstObservedAt: string | null;
  providerALastObservedAt: string | null;
  providerBFirstObservedAt: string | null;
  providerBLastObservedAt: string | null;
  providerAObservationsWithAnswerText: number;
  providerBObservationsWithAnswerText: number;
  providerAObservationsMentioningEntity: number;
  providerBObservationsMentioningEntity: number;
  providerAMentionRatePercent: number | null;
  providerAEqualPromptMeanMentionRatePercent: number | null;
  providerAMentionRateConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  providerBMentionRatePercent: number | null;
  providerBEqualPromptMeanMentionRatePercent: number | null;
  providerBMentionRateConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  providerBMentionRateDeltaPercentagePoints: number | null;
  providerBMentionRateDifferenceConfidenceInterval95PercentagePoints: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  meanPromptMentionRateDeltaPercentagePoints: number | null;
  meanPromptMentionRateDeltaBootstrapConfidenceInterval95PercentagePoints: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  medianPromptMentionRateDeltaPercentagePoints: number | null;
  promptsWithProviderAHigherMentionRate: number;
  promptsWithProviderBHigherMentionRate: number;
  promptsWithEqualMentionRate: number;
  promptsWithEntityMentionOnBothSides: number;
  providerAAnyCitationCoverageWhenMentionedPercent: number | null;
  providerAAnyCitationCoverageWhenMentionedConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  providerBAnyCitationCoverageWhenMentionedPercent: number | null;
  providerBAnyCitationCoverageWhenMentionedConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  providerBAnyCitationCoverageWhenMentionedDeltaPercentagePoints: number | null;
  promptsWithComparableAnyCitationCoverageWhenMentioned: number;
  meanPromptAnyCitationCoverageWhenMentionedDeltaPercentagePoints: number | null;
  meanPromptAnyCitationCoverageWhenMentionedDeltaBootstrapConfidenceInterval95PercentagePoints: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  medianPromptAnyCitationCoverageWhenMentionedDeltaPercentagePoints: number | null;
  ownedDomainsConfigured?: boolean;
  providerAOwnedCitationCoverageWhenMentionedPercent?: number | null;
  providerAOwnedCitationCoverageWhenMentionedConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  providerBOwnedCitationCoverageWhenMentionedPercent?: number | null;
  providerBOwnedCitationCoverageWhenMentionedConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  providerBOwnedCitationCoverageWhenMentionedDeltaPercentagePoints?: number | null;
  promptsWithComparableOwnedCitationCoverageWhenMentioned?: number;
  meanPromptOwnedCitationCoverageWhenMentionedDeltaPercentagePoints?: number | null;
  meanPromptOwnedCitationCoverageWhenMentionedDeltaBootstrapConfidenceInterval95PercentagePoints?: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  medianPromptOwnedCitationCoverageWhenMentionedDeltaPercentagePoints?: number | null;
  providerAOwnedTopThreeCitationShareWhenMentionedPercent?: number | null;
  providerBOwnedTopThreeCitationShareWhenMentionedPercent?: number | null;
  providerBOwnedTopThreeCitationShareWhenMentionedDeltaPercentagePoints?: number | null;
  promptsWithOwnedCitationEventsWhenMentionedOnBothSides?: number;
}

export interface AiAnswerCitationEntityMentionMonthlyProfile extends AiAnswerCitationEntityMentionSlice {
  entity: string;
  month: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  provider: string;
  observations: number;
  uniquePrompts: number;
  previousSampledMonth?: string;
  interveningUnsampledCalendarMonths?: number;
  entityMentionRateChangePercentagePointsFromPreviousSampledMonth?: number | null;
  ownedCitationCoverageWhenMentionedChangePercentagePointsFromPreviousSampledMonth?: number | null;
  ownedTopThreeCitationShareChangePercentagePointsFromPreviousSampledMonth?: number | null;
}

export interface AiAnswerCitationEntityCoMentionProfile {
  entity: string;
  aliases: string[];
  otherEntity: string;
  otherAliases: string[];
  scope: 'overall' | 'provider' | 'month-provider-cohort';
  provider?: string;
  month?: string;
  topic?: string;
  intent?: string;
  unlabeled?: boolean;
  answerTextObservations: number;
  uniquePrompts: number;
  observationsMentioningEntity: number;
  observationsMentioningOtherEntity: number;
  observationsMentioningBoth: number;
  coMentionRatePercent: number;
  coMentionRateConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95;
  coMentionGivenEntityPercent: number;
  coMentionGivenEntityConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95;
  coMentionGivenOtherEntityPercent: number;
  coMentionGivenOtherEntityConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95;
  snapshotJaccardPercent: number;
  independentExpectedCoMentionRatePercent: number;
  coMentionLift: number | null;
  uniquePromptsMentioningEntity: number;
  uniquePromptsMentioningOtherEntity: number;
  uniquePromptsMentioningBoth: number;
  promptJaccardPercent: number;
}

export type AiAnswerCitationEntityCoMentionPeriodMetrics = Omit<
  AiAnswerCitationEntityCoMentionProfile,
  | 'entity'
  | 'aliases'
  | 'otherEntity'
  | 'otherAliases'
  | 'scope'
  | 'provider'
  | 'month'
  | 'topic'
  | 'intent'
  | 'unlabeled'
>;

export interface AiAnswerCitationEntityCoMentionPeriodRow {
  entity: string;
  aliases: string[];
  otherEntity: string;
  otherAliases: string[];
  scope: 'overall' | 'provider' | 'month-provider-cohort';
  provider?: string;
  month?: string;
  topic?: string;
  intent?: string;
  unlabeled?: boolean;
  sampleState:
    | 'matched'
    | 'baseline-only'
    | 'current-only'
    | 'baseline-detail-capped'
    | 'current-detail-capped';
  baseline: AiAnswerCitationEntityCoMentionPeriodMetrics | null;
  current: AiAnswerCitationEntityCoMentionPeriodMetrics | null;
  coMentionRateChangePercentagePoints: number | null;
  coMentionGivenEntityChangePercentagePoints: number | null;
  coMentionGivenOtherEntityChangePercentagePoints: number | null;
  snapshotJaccardChangePercentagePoints: number | null;
  promptJaccardChangePercentagePoints: number | null;
  coMentionLiftChange: number | null;
}

export interface AiAnswerCitationEntityCoMentionPeriodComparison {
  rows: AiAnswerCitationEntityCoMentionPeriodRow[];
  rowsTruncated: boolean;
  coverageComplete: boolean;
  note: string;
}

export interface AiAnswerCitationEntityMentionOpportunity {
  entity: string;
  aliases: string[];
  provider: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  prompt: string;
  answerTextObservations: number;
  observationsMentioningEntity: number;
  entityMentionRatePercent: number;
  entityMentionOccurrences: number;
  observationsMentioningWithOwnedCitation: number;
  observationsMentioningWithoutOwnedCitation: number;
  incompleteCitationListsWithoutOwnedCitation?: number;
  ownedCitationCoverageWhenMentionedPercent: number;
  citedDomainsWithoutOwnedCitation: string[];
  citedDomainCitationEventsWithoutOwnedCitation?: Array<{
    domain: string;
    citationEvents: number;
    observationsWithDomain?: number;
    firstPositionCitationEvents?: number;
    topThreeCitationEvents?: number;
    observationsWithFirstPositionCitation?: number;
    observationsWithTopThreeCitation?: number;
  }>;
  citedDomainsTruncated: boolean;
  firstMentionObservedAt: string;
  lastMentionObservedAt: string;
}

export interface AiAnswerCitationPathFamilyProfile {
  pathFamily: string;
  origin: string;
  pathPrefix: string;
  owned?: boolean;
  pages: number;
  citationEvents: number;
  observedAnswers: number;
  observationCoveragePercent: number;
  uniquePrompts: number;
  providers: string[];
  citationEventSharePercent: number;
  citationListPosition: AiAnswerCitationListPositionProfile;
  firstObservedAt: string;
  lastObservedAt: string;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
}

export interface AiAnswerCitationPathFamilyCohortProfile {
  month?: string;
  pathFamily: string;
  origin: string;
  pathPrefix: string;
  owned?: boolean;
  provider: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  pages: number;
  citationEvents: number;
  observationsCitingFamily: number;
  cohortObservations: number;
  observationCoveragePercent: number;
  observationCoverageConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  uniquePromptsCitingFamily: number;
  cohortUniquePrompts: number;
  promptCoveragePercent?: number;
  promptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  cohortCitationEvents: number;
  citationEventShareWithinCohortPercent: number;
  citationEventShareBenchmark?: 'whole-sample' | 'same-month';
  benchmarkCitationEventSharePercent?: number;
  cohortEventShareDifferenceFromBenchmarkPercentagePoints?: number;
  cohortEventShareLiftVsBenchmark?: number;
  citationListPosition: AiAnswerCitationListPositionProfile;
  firstObservedAt: string;
  lastObservedAt: string;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
}

export interface AiAnswerCitationPathFamilyMonthlyProfile extends AiAnswerCitationPathFamilyCohortProfile {
  month: string;
  previousFamilyCitedMonth?: string | null;
  interveningCalendarMonthsWithoutFamilyRow?: number;
  cohortEventShareLiftChangeFromPreviousFamilyCitedMonth?: number | null;
  cohortEventShareLiftRelativeChangePercentFromPreviousFamilyCitedMonth?: number | null;
}

export interface AiAnswerCitationEntityPathFamilySideProfile {
  answerTextObservations: number;
  uniquePrompts: number;
  citationEventsInAnswerTextSamples: number;
  observationsCitingFamily: number;
  observationCoveragePercent: number | null;
  observationCoverageConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  uniquePromptsCitingFamily: number;
  promptCoveragePercent: number | null;
  promptCoverageConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  citationEvents: number;
  citationEventSharePercent: number | null;
  pages: number;
  citationListPosition: AiAnswerCitationListPositionProfile | null;
  firstObservedAt?: string;
  lastObservedAt?: string;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
}

export interface AiAnswerCitationEntityPathFamilyProfile {
  entity: string;
  aliases: string[];
  provider: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  pathFamily: string;
  origin: string;
  pathPrefix: string;
  owned?: boolean;
  observationsWithoutAnswerText: number;
  whenMentioned: AiAnswerCitationEntityPathFamilySideProfile;
  whenNotMentioned: AiAnswerCitationEntityPathFamilySideProfile;
  observationCoverageDifferencePercentagePoints: number | null;
  promptCoverageDifferencePercentagePoints: number | null;
  citationEventShareDifferencePercentagePoints: number | null;
}

export interface AiAnswerCitationEntityPathFamilyMonthlyProfile extends AiAnswerCitationEntityPathFamilyProfile {
  month: string;
  previousFamilyCitedMonth?: string | null;
  interveningCalendarMonthsWithoutFamilyRow?: number;
  mentionedPromptCoverageChangeFromPreviousFamilyCitedMonth?: number | null;
  notMentionedPromptCoverageChangeFromPreviousFamilyCitedMonth?: number | null;
  promptCoverageDifferenceChangeFromPreviousFamilyCitedMonth?: number | null;
  mentionedTopThreeCitationShareChangeFromPreviousFamilyCitedMonth?: number | null;
  notMentionedTopThreeCitationShareChangeFromPreviousFamilyCitedMonth?: number | null;
}

export interface AiAnswerCitationEntityCitationPageSideProfile {
  answerTextObservations: number;
  uniquePrompts: number;
  citationEventsInAnswerTextSamples: number;
  observationsCitingPage: number;
  observationCoveragePercent: number | null;
  observationCoverageConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  uniquePromptsCitingPage: number;
  promptCoveragePercent: number | null;
  promptCoverageConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  citationEvents: number;
  citationEventSharePercent: number | null;
  citationListPosition: AiAnswerCitationListPositionProfile | null;
}

export interface AiAnswerCitationEntityCitationPageProfile {
  entity: string;
  aliases: string[];
  provider: string;
  month?: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  url: string;
  domain: string;
  owned: boolean;
  observationsWithoutAnswerText: number;
  whenMentioned: AiAnswerCitationEntityCitationPageSideProfile;
  whenNotMentioned: AiAnswerCitationEntityCitationPageSideProfile;
  observationCoverageDifferencePercentagePoints: number | null;
  promptCoverageDifferencePercentagePoints: number | null;
  citationEventShareDifferencePercentagePoints: number | null;
}

export interface AiAnswerCitationEntityCitationPageMonthlyProfile extends AiAnswerCitationEntityCitationPageProfile {
  month: string;
  previousPageCitedMonth?: string | null;
  interveningCalendarMonthsWithoutPageRow?: number;
  mentionedPromptCoverageChangeFromPreviousPageCitedMonth?: number | null;
  notMentionedPromptCoverageChangeFromPreviousPageCitedMonth?: number | null;
  promptCoverageDifferenceChangeFromPreviousPageCitedMonth?: number | null;
  mentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth?: number | null;
  notMentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth?: number | null;
}

export interface AiAnswerCitationEntityCitationPageChange {
  entity: string;
  aliases: string[];
  provider: string;
  month?: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  url: string;
  domain: string;
  owned: boolean;
  sampleState:
    | 'both-periods'
    | 'baseline-only'
    | 'current-only'
    | 'baseline-detail-capped'
    | 'current-detail-capped';
  baseline: AiAnswerCitationEntityCitationPageProfile | null;
  current: AiAnswerCitationEntityCitationPageProfile | null;
  mentionedPromptCoverageChangePercentagePoints: number | null;
  notMentionedPromptCoverageChangePercentagePoints: number | null;
  mentionedCitationEventShareChangePercentagePoints: number | null;
  notMentionedCitationEventShareChangePercentagePoints: number | null;
  mentionedTopThreeCitationShareChangePercentagePoints: number | null;
  notMentionedTopThreeCitationShareChangePercentagePoints: number | null;
  promptCoverageAssociationChangePercentagePoints: number | null;
}

export interface AiAnswerCitationEntityCitationPageComparison {
  baselineRetainedRows: number;
  currentRetainedRows: number;
  sharedRows: number;
  baselineOnlyRetainedRows: number;
  currentOnlyRetainedRows: number;
  baselineDetailTruncated: boolean;
  currentDetailTruncated: boolean;
  coverageComplete: boolean;
  rows: AiAnswerCitationEntityCitationPageChange[];
  rowsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationEntityPathFamilyChange extends Omit<
  AiAnswerCitationEntityPathFamilyProfile,
  | 'whenMentioned'
  | 'whenNotMentioned'
  | 'observationCoverageDifferencePercentagePoints'
  | 'promptCoverageDifferencePercentagePoints'
  | 'citationEventShareDifferencePercentagePoints'
> {
  sampleState:
    | 'both-periods'
    | 'baseline-only'
    | 'current-only'
    | 'baseline-detail-capped'
    | 'current-detail-capped';
  baseline: AiAnswerCitationEntityPathFamilyProfile | null;
  current: AiAnswerCitationEntityPathFamilyProfile | null;
  mentionedObservationCoverageChangePercentagePoints: number | null;
  mentionedPromptCoverageChangePercentagePoints: number | null;
  mentionedCitationEventShareChangePercentagePoints: number | null;
  mentionedMeanSourcePositionChange: number | null;
  mentionedMedianSourcePositionChange: number | null;
  mentionedFirstPositionCitationShareChangePercentagePoints: number | null;
  mentionedTopThreeCitationShareChangePercentagePoints: number | null;
  notMentionedObservationCoverageChangePercentagePoints: number | null;
  notMentionedPromptCoverageChangePercentagePoints: number | null;
  notMentionedCitationEventShareChangePercentagePoints: number | null;
  notMentionedMeanSourcePositionChange: number | null;
  notMentionedMedianSourcePositionChange: number | null;
  notMentionedFirstPositionCitationShareChangePercentagePoints: number | null;
  notMentionedTopThreeCitationShareChangePercentagePoints: number | null;
  observationCoverageAssociationChangePercentagePoints: number | null;
  promptCoverageAssociationChangePercentagePoints: number | null;
  citationEventShareAssociationChangePercentagePoints: number | null;
}

export interface AiAnswerCitationEntityPathFamilyComparison {
  pathFamilyDepth: number;
  baselineRetainedRows: number;
  currentRetainedRows: number;
  sharedRows: number;
  baselineOnlyRetainedRows: number;
  currentOnlyRetainedRows: number;
  coverageComplete: boolean;
  rows: AiAnswerCitationEntityPathFamilyChange[];
  rowsTruncated: boolean;
  note: string;
}

export type AiAnswerCitationPathFamilyCohortMetrics = Omit<
  AiAnswerCitationPathFamilyCohortProfile,
  | 'month'
  | 'pathFamily'
  | 'origin'
  | 'pathPrefix'
  | 'owned'
  | 'provider'
  | 'topic'
  | 'intent'
  | 'unlabeled'
>;

export interface AiAnswerCitationPathFamilyCohortChange {
  pathFamily: string;
  origin: string;
  pathPrefix: string;
  owned?: boolean;
  provider: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  sampleState:
    | 'both-periods'
    | 'baseline-only'
    | 'current-only'
    | 'baseline-detail-capped'
    | 'current-detail-capped';
  baseline: AiAnswerCitationPathFamilyCohortMetrics | null;
  current: AiAnswerCitationPathFamilyCohortMetrics | null;
  citationEventsChange: number | null;
  observationCoverageChangePercentagePoints: number | null;
  promptCoverageChangePercentagePoints: number | null;
  citationEventShareChangePercentagePoints: number | null;
}

export interface AiAnswerCitationPathFamilyCohortComparison {
  pathFamilyDepth: number;
  baselineRetainedRows: number;
  currentRetainedRows: number;
  sharedRows: number;
  baselineOnlyRetainedRows: number;
  currentOnlyRetainedRows: number;
  baselineOnlyRowsHiddenByCap: boolean;
  currentOnlyRowsHiddenByCap: boolean;
  coverageComplete: boolean;
  rows: AiAnswerCitationPathFamilyCohortChange[];
  rowsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationObservationOptions {
  pathFamilyDepth?: number;
  includeCitationUrlPersistence?: boolean;
}

export interface AiAnswerCitationObservationInputFile {
  schemaVersion: 1;
  observations: AiAnswerCitationObservationInput[];
}

export type AiAnswerCitationReviewReason =
  'repeated-without-owned-citation' | 'inconsistent-owned-citation' | 'repeated-without-citations';

export interface AiAnswerCitationOwnedPositionBucketProfile {
  range: AiAnswerCitationPositionBucket['range'];
  ownedCitationEvents: number;
  ownedCitationEventSharePercent: number | null;
  citationEvents: number;
  ownedShareWithinPositionPercent: number | null;
}

export interface AiAnswerCitationProviderProfile {
  provider: string;
  observations: number;
  uniquePrompts: number;
  observationsWithCitations: number;
  observationsWithoutCitations: number;
  incompleteCitationListObservations?: number;
  observationsWithKnownOwnedCitationState?: number;
  observationsWithUnknownOwnedCitationState?: number;
  citationEvents: number;
  distinctCitedDomains: number;
  domainConcentration?: AiAnswerCitationDomainConcentration;
  rankWeightedDomainConcentration?: AiAnswerCitationDomainConcentration;
  observationsWithOwnedCitation?: number;
  observationsWithoutOwnedCitation?: number;
  ownedCitationCoveragePercent?: number;
  ownedCitationCoverageAmongKnownObservationsPercent?: number | null;
  ownedCitationCoverageUpperBoundPercent?: number;
  promptsWithOwnedCitation?: number;
  ownedCitationPromptCoveragePercent?: number;
  promptsWithKnownOwnedCitationState?: number;
  promptsWithUnknownOwnedCitationState?: number;
  ownedCitationPromptCoverageAmongKnownPromptsPercent?: number | null;
  ownedCitationPromptCoverageUpperBoundPercent?: number;
  ownedCitationPromptCoverageAmongKnownPromptsConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  ownedFirstCitationMeanReciprocalRankPercent?: number | null;
  ownedCitationPositionBuckets?: AiAnswerCitationOwnedPositionBucketProfile[];
}

export interface AiAnswerCitationDomainConcentration {
  distinctCitedDomains: number;
  herfindahlIndex: number | null;
  effectiveCitedDomainCount: number | null;
  largestDomainCitationSharePercent: number | null;
}

export interface AiAnswerCitationListPositionProfile {
  meanPosition: number;
  medianPosition: number;
  firstPositionCitationEvents: number;
  firstPositionCitationSharePercent: number;
  topThreeCitationEvents: number;
  topThreeCitationSharePercent: number;
  positionBuckets: AiAnswerCitationPositionBucket[];
}

export interface AiAnswerCitationPositionBucket {
  range: '1' | '2' | '3' | '4-5' | '6-10' | '11+';
  citationEvents: number;
  citationSharePercent: number;
}

const CITATION_POSITION_BUCKET_RANGES: AiAnswerCitationPositionBucket['range'][] = [
  '1',
  '2',
  '3',
  '4-5',
  '6-10',
  '11+',
];

type CitationPositionBucketCounters = Map<
  AiAnswerCitationPositionBucket['range'],
  { citationEvents: number; ownedCitationEvents: number }
>;

function createCitationPositionBucketCounters(): CitationPositionBucketCounters {
  return new Map(
    CITATION_POSITION_BUCKET_RANGES.map((range) => [
      range,
      { citationEvents: 0, ownedCitationEvents: 0 },
    ])
  );
}

function citationPositionBucketRange(position: number): AiAnswerCitationPositionBucket['range'] {
  if (position === 1) return '1';
  if (position === 2) return '2';
  if (position === 3) return '3';
  if (position <= 5) return '4-5';
  if (position <= 10) return '6-10';
  return '11+';
}

function summarizeOwnedCitationPositionBuckets(
  counters: CitationPositionBucketCounters
): AiAnswerCitationOwnedPositionBucketProfile[] {
  const ownedTotal = [...counters.values()].reduce(
    (sum, bucket) => sum + bucket.ownedCitationEvents,
    0
  );
  return CITATION_POSITION_BUCKET_RANGES.map((range) => {
    const bucket = counters.get(range)!;
    return {
      range,
      ownedCitationEvents: bucket.ownedCitationEvents,
      ownedCitationEventSharePercent:
        ownedTotal > 0
          ? Number(((bucket.ownedCitationEvents / ownedTotal) * 100).toFixed(2))
          : null,
      citationEvents: bucket.citationEvents,
      ownedShareWithinPositionPercent:
        bucket.citationEvents > 0
          ? Number(((bucket.ownedCitationEvents / bucket.citationEvents) * 100).toFixed(2))
          : null,
    };
  });
}

export interface AiAnswerCitationPromptRankReachProfile {
  promptsWithFirstPositionCitation?: number;
  firstPositionPromptCoveragePercent?: number;
  firstPositionPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  promptsWithTopThreeCitation?: number;
  topThreePromptCoveragePercent?: number;
  topThreePromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
}

export interface AiAnswerCitationProviderPositionProfile extends AiAnswerCitationPromptRankReachProfile {
  provider: string;
  citationEvents: number;
  observedAnswers: number;
  uniquePrompts: number;
  providerUniquePrompts?: number;
  promptCoveragePercent?: number;
  promptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  citationListPosition: AiAnswerCitationListPositionProfile;
}

export interface AiAnswerCitationDomainProfile extends AiAnswerCitationPromptRankReachProfile {
  domain: string;
  owned: boolean;
  citationEvents: number;
  observedAnswers: number;
  uniquePrompts: number;
  promptCoveragePercent?: number;
  promptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  providers: string[];
  citationEventSharePercent: number;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
  citationListPosition: AiAnswerCitationListPositionProfile;
  providerCitationListPositions?: AiAnswerCitationProviderPositionProfile[];
}

export interface AiAnswerCitationCoCitationProviderProfile {
  provider: string;
  ownedCitationObservations: number;
  externalCitationEvents: number;
  citationEvents: number;
  observedAnswers: number;
  uniquePrompts: number;
  answerCoveragePercent: number;
  externalCitationEventSharePercent: number | null;
}

export interface AiAnswerCitationCoCitationDomainProfile {
  domain: string;
  citationEvents: number;
  observedAnswers: number;
  uniquePrompts: number;
  providers: string[];
  answerCoveragePercent: number;
  externalCitationEventSharePercent: number | null;
  firstObservedAt: string;
  lastObservedAt: string;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
  providerProfiles: AiAnswerCitationCoCitationProviderProfile[];
}

export interface AiAnswerCitationCoCitationSummary {
  ownedCitationObservations: number;
  externalCitationEvents: number;
  distinctExternalDomains: number;
  domainsTruncated: boolean;
}

export interface AiAnswerCitationCoCitationPeriodMetrics {
  ownedCitationObservations: number;
  externalCitationEvents: number;
  citationEvents: number;
  observedAnswers: number;
  uniquePrompts: number;
  answerCoveragePercent: number;
  externalCitationEventSharePercent: number | null;
}

export interface AiAnswerCitationCoCitationPeriodChange {
  scope: 'domain' | 'provider';
  domain: string;
  provider?: string;
  sampleState: 'both-periods' | 'baseline-only' | 'current-only';
  baseline: AiAnswerCitationCoCitationPeriodMetrics | null;
  current: AiAnswerCitationCoCitationPeriodMetrics | null;
  citationEventsChange: number | null;
  answerCoverageChangePercentagePoints: number | null;
  externalCitationEventShareChangePercentagePoints: number | null;
}

export interface AiAnswerCitationCoCitationPeriodComparison {
  baselineRetainedRows: number;
  currentRetainedRows: number;
  sharedRows: number;
  baselineOnlyRetainedRows: number;
  currentOnlyRetainedRows: number;
  coverageComplete: boolean;
  rows: AiAnswerCitationCoCitationPeriodChange[];
  rowsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationPageProfile extends AiAnswerCitationPromptRankReachProfile {
  url: string;
  domain: string;
  owned: boolean;
  citationEvents: number;
  observedAnswers: number;
  uniquePrompts: number;
  providers: string[];
  citationEventSharePercent: number;
  firstObservedAt: string;
  lastObservedAt: string;
  citationListPosition: AiAnswerCitationListPositionProfile;
  providerCitationListPositions?: AiAnswerCitationProviderPositionProfile[];
  auditMatch?: AiAnswerCitationAuditPageMatch;
  dateModifiedAlignment?: AiAnswerCitationDateModifiedAlignment;
  crawlerLogState?: 'path-observed' | 'path-not-observed';
  crawlerLogMatches?: AiAnswerCitationCrawlerLogMatch[];
  crawlerLogMatchesTruncated?: boolean;
}

export interface AiAnswerCitationDateModifiedAlignment {
  state:
    | 'compared'
    | 'no-valid-schema-date'
    | 'audit-predates-citation-sample'
    | 'date-after-audit-snapshot';
  auditTimestamp: string;
  lastCitationObservedAt: string;
  schemaDateModifiedDays: string[];
  latestSchemaDateModifiedDay?: string;
  daysFromLastCitationObservationToSchemaDateModified?: number | null;
  schemaDateModifiedDaysTruncated: boolean;
  schemaDateModifiedHasNonDateValue: boolean;
}

export interface AiAnswerCitationCrawlerLogMatch {
  logIndex: number;
  crawlerToken: string;
  provider: string;
  activity: AiCrawlerActivity;
  requests: number;
  successfulResponses: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  daysBeforeLatestRequest?: number;
  temporalRelation?:
    | 'crawler-before-citation-sample'
    | 'observed-ranges-overlap'
    | 'crawler-after-citation-sample'
    | 'unknown';
  daysFromLatestCitationToLastRequest?: number;
}

export interface AiAnswerCitationCrawlerLogCorrelation {
  origin: string;
  logAnalyses: number;
  uniqueCrawlerTokens: number;
  citedPagesReviewed: number;
  citedPagesWithCrawlerRequests: number;
  citationEventsInRetainedPages: number;
  citationEventsOnObservedPaths: number;
  citedPagePathCoveragePercent: number | null;
  retainedCitationEventCoveragePercent: number | null;
  citedPagesTruncated: boolean;
  crawlerPathsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationAuditPageMatch {
  state:
    'exact-url' | 'unique-canonical' | 'ambiguous-audit-url' | 'ambiguous-canonical' | 'not-found';
  auditUrl?: string;
  geoAssessed?: boolean;
  signalCoverage?: SiteWideGeoPageSummary['signalCoverage'];
  searchCrawlerAccess?: Array<{ token: string; allowed: boolean }>;
  dataUseCrawlerPolicy?: Array<{ token: string; allowed: boolean }>;
  userInitiatedFetchAccess?: Array<{ token: string; allowed: boolean }>;
  previewControls?: {
    noindex?: boolean;
    noSnippet?: boolean;
    maxSnippetZero?: boolean;
    dataNoSnippetWords?: number;
  };
  answerContent?: {
    questionHeadings?: number;
    conciseAnswerBlocks?: number;
    externalContentLinks?: number;
    visibleAuthor?: boolean;
    visibleDate?: boolean;
    documentLanguage?: string;
    schemaDateModifiedDays?: string[];
    schemaDateModifiedDaysTruncated?: boolean;
    schemaDateModifiedHasNonDateValue?: boolean;
  };
  sourceRenderedContent?: {
    assessed: boolean;
    renderedPhraseCoveragePercent?: number | null;
    sourceWordCount?: number;
    renderedWordCount?: number;
    sharedRenderedPhraseCount?: number;
    renderedOnlyPhraseCount?: number;
  };
  citationEvidence?: {
    externalSourceLinkCount?: number;
    referenceSectionLinkCount?: number;
    unresolvedInlineCitationTargetCount?: number;
  };
}

export interface AiAnswerCitationAuditCorrelation {
  auditTimestamp: string;
  citedUrlsReviewed: number;
  citedUrlsTruncated: boolean;
  exactUrlMatches: number;
  uniqueCanonicalMatches: number;
  ambiguousAuditUrlMatches: number;
  ambiguousCanonicalMatches: number;
  unmatchedCitedUrls: number;
  matchedCitationEvents: number;
  note: string;
}

export interface AiAnswerCitationAuditSignalBreakdownRow {
  signal:
    | 'audit-match'
    | 'signal-coverage'
    | 'search-crawler-access'
    | 'data-use-crawler-policy'
    | 'user-initiated-fetch-access'
    | 'preview-control'
    | 'answer-content'
    | 'source-rendered-content'
    | 'citation-evidence';
  dimension: string;
  state: string;
  citedPages: number;
  citationEvents: number;
  pagePromptPairs: number;
  ownedCitedPages?: number;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
}

export interface AiAnswerCitationPromptProviderProfile {
  provider: string;
  observations: number;
  incompleteCitationListObservations?: number;
  observationsWithCitations: number;
  observationsWithoutCitations: number;
  citationEvents: number;
  domainConcentration?: AiAnswerCitationDomainConcentration;
  observationsWithOwnedCitation?: number;
  observationsWithoutOwnedCitation?: number;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  ownedFirstPositionCitationEvents?: number;
  ownedTopThreeCitationEvents?: number;
  ownedFirstCitationMeanReciprocalRankPercent?: number | null;
  firstObservedAt: string;
  lastObservedAt: string;
  citedDomains: string[];
  citedDomainCitationEvents?: Array<{ domain: string; citationEvents: number }>;
  citedDomainsTruncated: boolean;
  rankWeightedDomainCitationEvents?: Array<{ domain: string; discountedCitationWeight: number }>;
  rankWeightedCitationWeightTotal?: number;
  rankWeightedDomainsTruncated?: boolean;
}

export interface AiAnswerCitationPromptProfile {
  prompt: string;
  observations: number;
  uniqueProviders: number;
  providers: string[];
  observationsWithCitations: number;
  observationsWithoutCitations: number;
  citationEvents: number;
  observationsWithOwnedCitation?: number;
  observationsWithoutOwnedCitation?: number;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  providerProfiles?: AiAnswerCitationPromptProviderProfile[];
  firstObservedAt: string;
  lastObservedAt: string;
  citedDomains: string[];
  citedDomainsTruncated: boolean;
  crossProviderCitedDomains: Array<{ domain: string; providers: string[]; citationEvents: number }>;
  crossProviderCitedDomainsTruncated: boolean;
}

export interface AiAnswerCitationReviewOpportunity {
  reason: AiAnswerCitationReviewReason;
  prompt: string;
  observations: number;
  uniqueProviders: number;
  observationsWithCitations: number;
  observationsWithOwnedCitation?: number;
  citedDomains: string[];
}

export interface AiAnswerCitationMonthlyProfile {
  month: string;
  observations: number;
  observationsWithCitations: number;
  observationsWithoutCitations: number;
  observationsWithOwnedCitation?: number;
  observationsWithoutOwnedCitation?: number;
  citationEvents: number;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  citationListPosition?: AiAnswerCitationListPositionProfile | null;
}

/** Aggregated citation observations split by operator-recorded model, surface, locale, and topic/intent. */
export interface AiAnswerCitationExecutionContextProfile {
  provider: string;
  model?: string;
  surface?: string;
  locale?: string;
  topic?: string;
  intent?: string;
  unlabeledTopicIntent: boolean;
  observations: number;
  uniquePrompts: number;
  observationsWithCitations: number;
  citationCoveragePercent: number;
  citationCoverageConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  promptsWithCitations: number;
  promptCitationReachPercent: number;
  promptCitationReachConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  equalPromptMeanCitationCoveragePercent: number;
  citationEvents: number;
  firstObservedAt: string;
  lastObservedAt: string;
  observationsWithOwnedCitation?: number;
  promptsWithOwnedCitation?: number;
  ownedCitationCoveragePercent?: number;
  ownedCitationPromptCoveragePercent?: number;
  ownedCitationPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedPromptCitationReachPercent?: number;
  ownedPromptCitationReachConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  equalPromptMeanOwnedCitationCoveragePercent?: number;
}

export interface AiAnswerCitationExecutionContextMonthlyProfile extends AiAnswerCitationExecutionContextProfile {
  month: string;
  previousSampledMonth: string | null;
  interveningUnsampledCalendarMonths: number;
  citationCoverageChangeFromPreviousSampledMonthPercentagePoints: number | null;
  promptCitationReachChangeFromPreviousSampledMonthPercentagePoints: number | null;
  equalPromptMeanCitationCoverageChangeFromPreviousSampledMonthPercentagePoints: number | null;
  ownedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints?: number | null;
  ownedPromptCitationReachChangeFromPreviousSampledMonthPercentagePoints?: number | null;
  equalPromptMeanOwnedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints?:
    number | null;
}

export interface AiAnswerCitationMetricConfidenceInterval95 {
  lower: number;
  upper: number;
}

export type AiAnswerCitationAnswerLengthBand =
  '0-99' | '100-299' | '300-599' | '600-999' | '1000-plus';

/** Citation rates grouped by approximate word-count bands of operator-supplied answer text. */
export interface AiAnswerCitationAnswerLengthProfile {
  provider: string;
  model?: string;
  surface?: string;
  locale?: string;
  topic?: string;
  intent?: string;
  unlabeledTopicIntent: boolean;
  lengthBand: AiAnswerCitationAnswerLengthBand;
  minimumAnswerWords: number;
  maximumAnswerWords: number | null;
  contextObservations: number;
  answerTextObservationsInContext: number;
  answerTextShareInContextPercent: number;
  observations: number;
  uniquePrompts: number;
  observationsWithCitations: number;
  citationCoveragePercent: number;
  citationCoverageConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  promptsWithCitations: number;
  promptCitationReachPercent: number;
  promptCitationReachConfidenceInterval95Percent: AiAnswerCitationRateConfidenceInterval95 | null;
  citationEvents: number;
  meanCitationEventsPerAnswer: number;
  promptsWithAnswerWords: number;
  equalPromptMeanCitationEventsPer100AnswerWords: number | null;
  equalPromptMeanCitationEventsPer100AnswerWordsConfidenceInterval95: AiAnswerCitationMetricConfidenceInterval95 | null;
  totalAnswerWords: number;
  meanAnswerWords: number;
  medianAnswerWords: number;
  citationEventsPer100AnswerWords: number | null;
  firstObservedAt: string;
  lastObservedAt: string;
  observationsWithOwnedCitation?: number;
  ownedCitationCoveragePercent?: number | null;
  ownedCitationCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  promptsWithOwnedCitation?: number;
  ownedPromptCitationReachPercent?: number;
  ownedPromptCitationReachConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  ownedFirstPositionCitationEvents?: number;
  ownedFirstPositionCitationEventSharePercent?: number | null;
  ownedTopThreeCitationEvents?: number;
  ownedTopThreeCitationEventSharePercent?: number | null;
  promptsWithOwnedCitationEvents?: number;
  equalPromptMeanOwnedFirstPositionSharePercent?: number | null;
  equalPromptMeanOwnedFirstPositionShareConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  equalPromptMeanOwnedTopThreeSharePercent?: number | null;
  equalPromptMeanOwnedTopThreeShareConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  ownedFirstCitationMeanReciprocalRankPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  equalPromptMeanOwnedCitationEventsPer100AnswerWords?: number | null;
  equalPromptMeanOwnedCitationEventsPer100AnswerWordsConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
}

export interface AiAnswerCitationAnswerLengthMonthlyProfile extends AiAnswerCitationAnswerLengthProfile {
  month: string;
  previousSampledMonth: string | null;
  interveningUnsampledCalendarMonths: number;
  citationCoverageChangeFromPreviousSampledMonthPercentagePoints: number | null;
  promptCitationReachChangeFromPreviousSampledMonthPercentagePoints: number | null;
  citationEventsPer100AnswerWordsChangeFromPreviousSampledMonth: number | null;
  equalPromptMeanCitationEventsPer100AnswerWordsChangeFromPreviousSampledMonth: number | null;
  ownedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints?: number | null;
  ownedPromptCitationReachChangeFromPreviousSampledMonthPercentagePoints?: number | null;
  ownedCitationEventShareChangeFromPreviousSampledMonthPercentagePoints?: number | null;
  equalPromptMeanOwnedCitationEventsPer100AnswerWordsChangeFromPreviousSampledMonth?: number | null;
  ownedFirstPositionCitationEventShareChangeFromPreviousSampledMonthPercentagePoints?:
    number | null;
  ownedTopThreeCitationEventShareChangeFromPreviousSampledMonthPercentagePoints?: number | null;
  equalPromptMeanOwnedFirstPositionShareChangeFromPreviousSampledMonthPercentagePoints?:
    number | null;
  equalPromptMeanOwnedTopThreeShareChangeFromPreviousSampledMonthPercentagePoints?: number | null;
  equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints?:
    number | null;
}

/** Prompt-keyed owned rank counts used only for matched-prompt answer-length comparisons. */
export interface AiAnswerCitationAnswerLengthPromptRankProfile {
  provider: string;
  model?: string;
  surface?: string;
  locale?: string;
  topic?: string;
  intent?: string;
  unlabeledTopicIntent: boolean;
  lengthBand: AiAnswerCitationAnswerLengthBand;
  promptFingerprint: string;
  observations: number;
  ownedCitationEvents: number;
  ownedFirstPositionCitationEvents: number;
  ownedTopThreeCitationEvents: number;
  ownedCitationObservations: number;
  ownedFirstCitationReciprocalRankSum: number;
}

export interface AiAnswerCitationTopicIntentProviderMonthlyProfile {
  month: string;
  topic?: string;
  intent?: string;
  provider: string;
  unlabeled: boolean;
  observations: number;
  uniquePrompts: number;
  incompleteCitationListObservations?: number;
  incompleteCitationListSharePercent?: number;
  previousIncompleteCitationListSharePercent?: number;
  incompleteCitationListShareChangePercentagePoints?: number;
  unknownOwnedCitationStateObservations?: number;
  unknownOwnedCitationStateObservationSharePercent?: number;
  ownedCitationCoverageAmongKnownObservationsPercent?: number | null;
  ownedCitationCoverageUpperBoundPercent?: number;
  previousUnknownOwnedCitationStateObservationSharePercent?: number;
  unknownOwnedCitationStateObservationShareChangePercentagePoints?: number;
  unknownOwnedCitationStatePrompts?: number;
  unknownOwnedCitationStatePromptSharePercent?: number;
  ownedCitationPromptCoverageAmongKnownPromptsPercent?: number | null;
  ownedCitationPromptCoverageUpperBoundPercent?: number;
  previousUnknownOwnedCitationStatePromptSharePercent?: number;
  unknownOwnedCitationStatePromptShareChangePercentagePoints?: number;
  observationsWithCitations: number;
  citationCoveragePercent: number;
  citationEvents: number;
  citationDomainProfiles?: AiAnswerCitationMonthlyDomainProfile[];
  citationDomainProfilesTruncated?: boolean;
  observationsWithOwnedCitation?: number;
  promptsWithOwnedCitation?: number;
  ownedCitationCoveragePercent?: number;
  ownedCitationPromptCoveragePercent?: number;
  ownedCitationPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  ownedFirstCitationMeanReciprocalRankPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  ownedCitationPositionBuckets?: AiAnswerCitationOwnedPositionBucketProfile[];
  ownedCitationPositionBucketChanges?: AiAnswerCitationOwnedPositionBucketTrend[];
  citationPositionBucketChanges?: AiAnswerCitationPositionBucketTrend[];
  citationListPosition?: AiAnswerCitationListPositionProfile | null;
  citedDomains: string[];
  citedDomainsTruncated: boolean;
  previousObservedMonth?: string;
  monthsWithoutSamplesBetweenPreviousObservation?: number;
  previousObservations?: number;
  previousUniquePrompts?: number;
  previousObservationsWithCitations?: number;
  previousCitationCoveragePercent?: number;
  citationCoverageChangePercentagePoints?: number;
  previousOwnedCitationCoveragePercent?: number;
  ownedCitationCoverageChangePercentagePoints?: number;
  previousPromptsWithOwnedCitation?: number;
  previousOwnedCitationPromptCoveragePercent?: number;
  ownedCitationPromptCoverageChangePercentagePoints?: number;
  promptsInBothSampledMonths?: number;
  ownedCitationPromptsGainedSincePreviousSampledMonth?: number;
  ownedCitationPromptsLostSincePreviousSampledMonth?: number;
  pairedPromptOwnedCitationReachChangePercentagePoints?: number | null;
  pairedPromptOwnedCitationReachChangeConfidenceInterval95PercentagePoints?: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  pairedPromptOwnedCitationReachExactMcNemarPValue?: number | null;
  latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue?: number | null;
  latestMonthlyPairedOwnedPromptReachHolmFamilySize?: number;
  latestMonthlyPairedOwnedPromptReachHolmStatus?:
    'complete' | 'incomplete-monthly-detail' | 'incomplete-paired-data';
  previousOwnedFirstCitationMeanReciprocalRankPercent?: number | null;
  ownedFirstCitationMeanReciprocalRankChangeFromPreviousSampledMonthPercentagePoints?:
    number | null;
  previousEqualPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints?:
    number | null;
  promptsWithOwnedCitationRankInBothSampledMonths?: number;
  previousOnlyPromptsWithOwnedCitationRank?: number;
  currentOnlyPromptsWithOwnedCitationRank?: number;
  previousPairedPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  currentPairedPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  pairedPromptMeanOwnedFirstCitationMrrChangePercentagePoints?: number | null;
  pairedPromptMeanOwnedFirstCitationMrrChangeConfidenceInterval95PercentagePoints?: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  previousOwnedCitationEventSharePercent?: number | null;
  ownedCitationEventShareChangePercentagePoints?: number | null;
  previousCitedDomains?: string[];
  sharedTopCitedDomainsWithPreviousMonth?: string[];
  previousOnlyTopCitedDomains?: string[];
  currentOnlyTopCitedDomains?: string[];
  citedDomainComparisonComplete?: boolean;
  previousFirstPositionCitationSharePercent?: number | null;
  firstPositionCitationShareChangePercentagePoints?: number | null;
  previousTopThreeCitationSharePercent?: number | null;
  topThreeCitationShareChangePercentagePoints?: number | null;
}

export interface AiAnswerCitationMonthlyDomainProfile {
  domain: string;
  citationEvents: number;
  citationListPosition: AiAnswerCitationListPositionProfile;
}

export interface AiAnswerCitationOwnedPositionBucketTrend {
  range: AiAnswerCitationPositionBucket['range'];
  previousOwnedCitationEvents: number | null;
  previousOwnedCitationEventSharePercent: number | null;
  ownedCitationEventShareChangePercentagePoints: number | null;
}

export interface AiAnswerCitationPositionBucketTrend {
  range: AiAnswerCitationPositionBucket['range'];
  previousCitationEvents: number | null;
  previousCitationSharePercent: number | null;
  citationShareChangePercentagePoints: number | null;
}

export interface AiAnswerCitationOwnedPositionBucketPeriodChange {
  range: AiAnswerCitationPositionBucket['range'];
  baselineOwnedCitationEvents: number | null;
  baselineOwnedCitationEventSharePercent: number | null;
  baselineCitationEvents: number | null;
  baselineOwnedShareWithinPositionPercent: number | null;
  currentOwnedCitationEvents: number | null;
  currentOwnedCitationEventSharePercent: number | null;
  currentCitationEvents: number | null;
  currentOwnedShareWithinPositionPercent: number | null;
  ownedCitationEventShareChangePercentagePoints: number | null;
  ownedShareWithinPositionChangePercentagePoints: number | null;
}

export interface AiAnswerCitationProviderPromptPeriodChange {
  provider: string;
  prompt: string;
  baselineObservations: number;
  currentObservations: number;
  baselineObservationsWithCitations: number;
  currentObservationsWithCitations: number;
  baselineCitationCoveragePercent: number;
  currentCitationCoveragePercent: number;
  citationCoverageDeltaPercentagePoints: number;
  baselineObservationsWithOwnedCitation?: number;
  currentObservationsWithOwnedCitation?: number;
  baselineOwnedCitationCoveragePercent?: number;
  currentOwnedCitationCoveragePercent?: number;
  ownedCitationCoverageDeltaPercentagePoints?: number;
  baselineOwnedReachCompletenessState?: 'present' | 'absent' | 'unknown';
  currentOwnedReachCompletenessState?: 'present' | 'absent' | 'unknown';
  baselineOwnedReachLowerBound?: number;
  baselineOwnedReachUpperBound?: number;
  currentOwnedReachLowerBound?: number;
  currentOwnedReachUpperBound?: number;
  ownedReachChangeLowerBoundPercentagePoints?: number;
  ownedReachChangeUpperBoundPercentagePoints?: number;
  baselineFirstObservedAt: string;
  baselineLastObservedAt: string;
  currentFirstObservedAt: string;
  currentLastObservedAt: string;
  baselineCitedDomains: string[];
  baselineCitedDomainsTruncated: boolean;
  currentCitedDomains: string[];
  currentCitedDomainsTruncated: boolean;
  baselineDomainConcentration?: AiAnswerCitationDomainConcentration;
  currentDomainConcentration?: AiAnswerCitationDomainConcentration;
  herfindahlDelta?: number | null;
  effectiveCitedDomainCountDelta?: number | null;
  largestDomainCitationShareDeltaPercentagePoints?: number | null;
  sharedCitedDomains: string[];
  baselineOnlyTopCitedDomains: string[];
  currentOnlyTopCitedDomains: string[];
  citedDomainDetailComplete: boolean;
  citationDomainJaccard?: number | null;
}

export interface AiAnswerCitationObservationPeriodComparison {
  baselineObservations: number;
  currentObservations: number;
  citationListCompletenessComparison?: {
    baselineIncompleteObservations: number;
    baselineIncompletePercent: number;
    currentIncompleteObservations: number;
    currentIncompletePercent: number;
    incompleteShareChangePercentagePoints: number;
  };
  baselineRetainedProviderPromptGroups: number;
  currentRetainedProviderPromptGroups: number;
  sharedProviderPromptGroups: number;
  providerPromptGroupsOnlyInBaselineRetainedDetail: number;
  providerPromptGroupsOnlyInCurrentRetainedDetail: number;
  providerPromptCoverageComplete: boolean;
  sharedGroupsWithCitationCoverageIncrease: number;
  sharedGroupsWithCitationCoverageDecrease: number;
  sharedGroupsWithNoCitationCoverageChange: number;
  prompts: AiAnswerCitationProviderPromptPeriodChange[];
  promptsTruncated: boolean;
  topicIntentComparison?: AiAnswerCitationTopicIntentPeriodComparison;
  entityMentionComparison?: AiAnswerCitationEntityMentionPeriodComparison;
  entityPromptComparison?: AiAnswerCitationEntityPromptComparison;
  entityCoMentionComparison?: AiAnswerCitationEntityCoMentionPeriodComparison;
  pathFamilyComparison?: AiAnswerCitationPathFamilyPeriodComparison;
  pathFamilyCohortComparison?: AiAnswerCitationPathFamilyCohortComparison;
  entityPathFamilyComparison?: AiAnswerCitationEntityPathFamilyComparison;
  entityCitationPageComparison?: AiAnswerCitationEntityCitationPageComparison;
  providerPagePositionComparison?: AiAnswerCitationProviderPagePositionComparison;
  coCitationComparison?: AiAnswerCitationCoCitationPeriodComparison;
  ownedCitationCoverageComparison?: AiAnswerCitationOwnedCoveragePeriodComparison;
  ownedCitationReachCompletenessBounds?: AiAnswerCitationOwnedReachCompletenessBounds;
  ownedPromptRankComparison?: AiAnswerCitationOwnedPromptRankPeriodComparison;
  note: string;
}

export interface AiAnswerCitationOwnedReachCompletenessBounds {
  complete: boolean;
  sharedProviderPromptGroups: number;
  knownBaselineGroups: number;
  unknownBaselineGroups: number;
  knownCurrentGroups: number;
  unknownCurrentGroups: number;
  baselineReachLowerBoundPercent: number | null;
  baselineReachUpperBoundPercent: number | null;
  currentReachLowerBoundPercent: number | null;
  currentReachUpperBoundPercent: number | null;
  changeLowerBoundPercentagePoints: number | null;
  changeUpperBoundPercentagePoints: number | null;
  providerComparisons: AiAnswerCitationOwnedReachCompletenessProviderBounds[];
  note: string;
}

export interface AiAnswerCitationOwnedReachCompletenessProviderBounds {
  provider: string;
  sharedProviderPromptGroups: number;
  knownBaselineGroups: number;
  unknownBaselineGroups: number;
  knownCurrentGroups: number;
  unknownCurrentGroups: number;
  baselineReachLowerBoundPercent: number | null;
  baselineReachUpperBoundPercent: number | null;
  currentReachLowerBoundPercent: number | null;
  currentReachUpperBoundPercent: number | null;
  changeLowerBoundPercentagePoints: number | null;
  changeUpperBoundPercentagePoints: number | null;
}

export interface AiAnswerCitationOwnedPromptRankMetricComparison {
  baselineMeanPercent: number;
  currentMeanPercent: number;
  changePercentagePoints: number;
  pairedPromptBootstrapConfidenceInterval95: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
}

export interface AiAnswerCitationOwnedPromptRankProviderComparison {
  provider: string;
  matchedPrompts: number;
  matchedProviderPromptGroups: number;
  firstPosition: AiAnswerCitationOwnedPromptRankMetricComparison;
  topThree: AiAnswerCitationOwnedPromptRankMetricComparison;
  meanReciprocalRank: AiAnswerCitationOwnedPromptRankMetricComparison;
}

export interface AiAnswerCitationOwnedPromptRankPromptComparison {
  promptFingerprint: string;
  matchedProviders: number;
  firstPosition: AiAnswerCitationOwnedPromptRankMetricComparison;
  topThree: AiAnswerCitationOwnedPromptRankMetricComparison;
  meanReciprocalRank: AiAnswerCitationOwnedPromptRankMetricComparison;
}

export interface AiAnswerCitationOwnedPromptRankPeriodComparison {
  complete: boolean;
  baselineProviderPromptGroups: number;
  currentProviderPromptGroups: number;
  sharedProviderPromptGroups: number;
  matchedProviderPromptGroupsWithOwnedCitations: number;
  sharedGroupsWithoutOwnedCitationsInEitherPeriod: number;
  pairedExactPrompts: number;
  firstPosition: AiAnswerCitationOwnedPromptRankMetricComparison | null;
  topThree: AiAnswerCitationOwnedPromptRankMetricComparison | null;
  meanReciprocalRank: AiAnswerCitationOwnedPromptRankMetricComparison | null;
  providerComparisons: AiAnswerCitationOwnedPromptRankProviderComparison[];
  prompts: AiAnswerCitationOwnedPromptRankPromptComparison[];
  promptsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationOwnedCoveragePeriodComparison {
  baselineObservations: number;
  currentObservations: number;
  baselineObservationsWithOwnedCitation: number;
  currentObservationsWithOwnedCitation: number;
  baselineOwnedCitationCoveragePercent: number;
  currentOwnedCitationCoveragePercent: number;
  ownedCitationCoverageDeltaPercentagePoints: number;
  baselineOwnedCitationEvents: number;
  currentOwnedCitationEvents: number;
  baselineOwnedCitationEventSharePercent: number | null;
  currentOwnedCitationEventSharePercent: number | null;
  ownedCitationEventShareDeltaPercentagePoints: number | null;
  baselineOwnedTopThreePositionSharePercent?: number | null;
  currentOwnedTopThreePositionSharePercent?: number | null;
  ownedTopThreePositionShareDeltaPercentagePoints?: number | null;
  ownedCitationPositionBucketChanges?: AiAnswerCitationOwnedPositionBucketPeriodChange[];
}

export interface AiAnswerCitationProviderPagePositionMetrics {
  citationEvents: number;
  observedAnswers: number;
  uniquePrompts: number;
  citationListPosition: AiAnswerCitationListPositionProfile;
}

export interface AiAnswerCitationPositionBucketPeriodChange {
  range: AiAnswerCitationPositionBucket['range'];
  baselineCitationEvents: number | null;
  baselineSharePercent: number | null;
  currentCitationEvents: number | null;
  currentSharePercent: number | null;
  changePercentagePoints: number | null;
}

export interface AiAnswerCitationProviderPagePositionChange {
  provider: string;
  url: string;
  domain: string;
  sampleState: 'both-periods' | 'baseline-only' | 'current-only';
  baseline: AiAnswerCitationProviderPagePositionMetrics | null;
  current: AiAnswerCitationProviderPagePositionMetrics | null;
  citationEventsChange: number | null;
  meanPositionChange: number | null;
  firstPositionShareChangePercentagePoints: number | null;
  topThreeShareChangePercentagePoints: number | null;
  positionBucketChanges?: AiAnswerCitationPositionBucketPeriodChange[];
}

export interface AiAnswerCitationProviderPagePositionComparison {
  baselineRetainedRows: number;
  currentRetainedRows: number;
  sharedRows: number;
  baselineOnlyRetainedRows: number;
  currentOnlyRetainedRows: number;
  coverageComplete: boolean;
  rows: AiAnswerCitationProviderPagePositionChange[];
  rowsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationPathFamilyPeriodMetrics {
  owned?: boolean;
  pages: number;
  citationEvents: number;
  citationEventSharePercent: number;
  observedAnswers: number;
  observationCoveragePercent: number;
  firstPositionCitationSharePercent: number;
  topThreeCitationSharePercent: number;
  firstObservedAt: string;
  lastObservedAt: string;
  sampleUrls: string[];
  sampleUrlsTruncated: boolean;
}

export interface AiAnswerCitationPathFamilyPeriodChange {
  pathFamily: string;
  origin: string;
  pathPrefix: string;
  sampleState: 'both-periods' | 'baseline-only' | 'current-only';
  baseline: AiAnswerCitationPathFamilyPeriodMetrics | null;
  current: AiAnswerCitationPathFamilyPeriodMetrics | null;
  pagesChange: number | null;
  citationEventsChange: number | null;
  citationEventShareChangePercentagePoints: number | null;
  observedAnswersChange: number | null;
  observationCoverageChangePercentagePoints: number | null;
  firstPositionShareChangePercentagePoints: number | null;
  topThreeShareChangePercentagePoints: number | null;
}

export interface AiAnswerCitationPathFamilyPeriodComparison {
  pathFamilyDepth: number;
  baselineFamilyCount: number;
  currentFamilyCount: number;
  sharedFamilies: number;
  baselineOnlyRetainedFamilies: number;
  currentOnlyRetainedFamilies: number;
  familyCoverageComplete: boolean;
  families: AiAnswerCitationPathFamilyPeriodChange[];
  familiesTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationEntityMentionPeriodRow {
  provider?: string;
  baseline: AiAnswerCitationEntityMentionSlice | null;
  current: AiAnswerCitationEntityMentionSlice | null;
  entityMentionRateChangePercentagePoints: number | null;
  entityMentionOccurrencesChange: number | null;
  firstThirdMentionShareChangePercentagePoints: number | null;
  medianFirstMentionPositionChangePercentagePoints: number | null;
  anyCitationCoverageWhenMentionedChangePercentagePoints: number | null;
  anyCitationCoverageWhenNotMentionedChangePercentagePoints: number | null;
  ownedCitationCoverageWhenMentionedChangePercentagePoints?: number | null;
  ownedCitationCoverageWhenNotMentionedChangePercentagePoints?: number | null;
  ownedFirstPositionShareWhenMentionedChangePercentagePoints?: number | null;
  ownedTopThreeShareWhenMentionedChangePercentagePoints?: number | null;
  ownedFirstPositionShareWhenNotMentionedChangePercentagePoints?: number | null;
  ownedTopThreeShareWhenNotMentionedChangePercentagePoints?: number | null;
}

export interface AiAnswerCitationEntityMentionMonthlyPeriodRow extends AiAnswerCitationEntityMentionPeriodRow {
  month: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  provider: string;
  sampleState: 'matched' | 'baseline-only' | 'current-only';
  baselineObservations: number | null;
  currentObservations: number | null;
  baselineUniquePrompts: number | null;
  currentUniquePrompts: number | null;
}

export interface AiAnswerCitationEntityMentionPeriodProfile extends AiAnswerCitationEntityMentionPeriodRow {
  entity: string;
  aliases: string[];
  providerProfiles: Array<AiAnswerCitationEntityMentionPeriodRow & { provider: string }>;
  monthlyProfiles: AiAnswerCitationEntityMentionMonthlyPeriodRow[];
  monthlyProfilesTruncated: boolean;
}

export interface AiAnswerCitationEntityMentionPeriodComparison {
  entities: AiAnswerCitationEntityMentionPeriodProfile[];
  note: string;
}

export interface AiAnswerCitationEntityPromptChange {
  entity: string;
  aliases: string[];
  provider: string;
  prompt: string;
  sampleState:
    | 'both-periods'
    | 'baseline-only'
    | 'current-only'
    | 'baseline-detail-capped'
    | 'current-detail-capped';
  baseline: AiAnswerCitationEntityPromptProfile | null;
  current: AiAnswerCitationEntityPromptProfile | null;
  entityMentionRateChangePercentagePoints: number | null;
  anyCitationCoverageWhenMentionedChangePercentagePoints: number | null;
  anyCitationCoverageWhenNotMentionedChangePercentagePoints: number | null;
  ownedCitationCoverageWhenMentionedChangePercentagePoints?: number | null;
  ownedTopThreeCitationShareWhenMentionedChangePercentagePoints?: number | null;
}

export interface AiAnswerCitationEntityPromptComparison {
  baselineRetainedRows: number;
  currentRetainedRows: number;
  sharedRows: number;
  baselineOnlyRetainedRows: number;
  currentOnlyRetainedRows: number;
  baselineOnlyRowsHiddenByCap: boolean;
  currentOnlyRowsHiddenByCap: boolean;
  coverageComplete: boolean;
  rows: AiAnswerCitationEntityPromptChange[];
  rowsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationTopicIntentProviderPeriodChange {
  topic?: string;
  intent?: string;
  provider: string;
  baselineObservations: number;
  currentObservations: number;
  baselineUniquePrompts: number;
  currentUniquePrompts: number;
  baselineObservationsWithCitations: number;
  currentObservationsWithCitations: number;
  baselineCitationCoveragePercent: number;
  currentCitationCoveragePercent: number;
  citationCoverageDeltaPercentagePoints: number;
  baselineFirstObservedAt?: string;
  baselineLastObservedAt?: string;
  currentFirstObservedAt?: string;
  currentLastObservedAt?: string;
  baselineObservationsWithOwnedCitation?: number;
  currentObservationsWithOwnedCitation?: number;
  baselineOwnedCitationCoveragePercent?: number;
  currentOwnedCitationCoveragePercent?: number;
  ownedCitationCoverageDeltaPercentagePoints?: number;
  baselinePromptsWithOwnedCitation?: number;
  currentPromptsWithOwnedCitation?: number;
  baselineOwnedCitationPromptCoveragePercent?: number;
  currentOwnedCitationPromptCoveragePercent?: number;
  ownedCitationPromptCoverageChangePercentagePoints?: number;
  baselineOwnedFirstCitationMeanReciprocalRankPercent?: number | null;
  currentOwnedFirstCitationMeanReciprocalRankPercent?: number | null;
  ownedFirstCitationMeanReciprocalRankChangePercentagePoints?: number | null;
  baselineEqualPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  currentEqualPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints?: number | null;
  baselineCitedDomains: string[];
  currentCitedDomains: string[];
  sharedCitedDomains: string[];
  baselineOnlyTopCitedDomains: string[];
  currentOnlyTopCitedDomains: string[];
  citedDomainDetailComplete: boolean;
}

export interface AiAnswerCitationTopicIntentPeriodComparison {
  baselineRetainedProviderCohorts: number;
  currentRetainedProviderCohorts: number;
  sharedProviderCohorts: number;
  providerCohortsOnlyInBaselineRetainedDetail: number;
  providerCohortsOnlyInCurrentRetainedDetail: number;
  providerCohortCoverageComplete: boolean;
  sharedCohortsWithCitationCoverageIncrease: number;
  sharedCohortsWithCitationCoverageDecrease: number;
  sharedCohortsWithNoCitationCoverageChange: number;
  cohorts: AiAnswerCitationTopicIntentProviderPeriodChange[];
  cohortsTruncated: boolean;
  onlyInBaseline: AiAnswerCitationTopicIntentProviderPeriodPresence[];
  onlyInCurrent: AiAnswerCitationTopicIntentProviderPeriodPresence[];
  unmatchedCohortsTruncated: boolean;
  note: string;
}

export interface AiAnswerCitationTopicIntentProviderPeriodPresence {
  topic?: string;
  intent?: string;
  provider: string;
  observations: number;
  uniquePrompts: number;
  observationsWithCitations: number;
  citationCoveragePercent: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
  observationsWithOwnedCitation?: number;
  ownedCitationCoveragePercent?: number;
  promptsWithOwnedCitation?: number;
  ownedCitationPromptCoveragePercent?: number;
  ownedCitationPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedFirstCitationMeanReciprocalRankPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  citedDomains: string[];
  citedDomainsTruncated: boolean;
}

export interface AiAnswerCitationTopicIntentProfile {
  topic?: string;
  intent?: string;
  observations: number;
  uniquePrompts: number;
  uniqueProviders: number;
  observationsWithCitations: number;
  observationsWithoutCitations: number;
  citationEvents: number;
  observationsWithOwnedCitation?: number;
  observationsWithoutOwnedCitation?: number;
  ownedCitationCoveragePercent?: number;
  promptsWithOwnedCitation?: number;
  ownedCitationPromptCoveragePercent?: number;
  ownedCitationPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  ownedFirstCitationMeanReciprocalRankPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  citedDomains: string[];
  citedDomainsTruncated: boolean;
  providerProfiles?: AiAnswerCitationTopicIntentProviderProfile[];
  providersWithoutObservations?: string[];
}

export interface AiAnswerCitationTopicIntentProviderProfile {
  provider: string;
  observations: number;
  uniquePrompts: number;
  observationsWithCitations: number;
  observationsWithoutCitations: number;
  citationCoveragePercent: number;
  citationEvents: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
  observationsWithOwnedCitation?: number;
  observationsWithoutOwnedCitation?: number;
  ownedCitationCoveragePercent?: number;
  promptsWithOwnedCitation?: number;
  ownedCitationPromptCoveragePercent?: number;
  ownedCitationPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
  ownedCitationEvents?: number;
  ownedCitationEventSharePercent?: number | null;
  ownedFirstCitationMeanReciprocalRankPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  citedDomains: string[];
  citedDomainsTruncated: boolean;
}

export interface AiAnswerCitationTopicIntentProviderPairComparison {
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  providerA: string;
  providerB: string;
  sharedPrompts: number;
  providerAPromptGroups?: number;
  providerBPromptGroups?: number;
  promptsOnlyInProviderA?: number;
  promptsOnlyInProviderB?: number;
  promptCoverageJaccard?: number;
  providerAObservations: number;
  providerBObservations: number;
  providerAObservationsWithCitations: number;
  providerBObservationsWithCitations: number;
  providerACitationCoveragePercent: number;
  providerBCitationCoveragePercent: number;
  providerBCitationCoverageDeltaPercentagePoints: number;
  providerAEqualPromptMeanCitationCoveragePercent?: number;
  providerBEqualPromptMeanCitationCoveragePercent?: number;
  meanPromptCitationCoverageDeltaPercentagePoints?: number;
  meanPromptCitationCoverageDeltaBootstrapConfidenceInterval95PercentagePoints?: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  medianPromptCitationCoverageDeltaPercentagePoints: number;
  promptsWithProviderAHigherCitationCoverage: number;
  promptsWithProviderBHigherCitationCoverage: number;
  promptsWithEqualCitationCoverage: number;
  providerADistinctCitationDomains: number;
  providerBDistinctCitationDomains: number;
  sharedCitationDomains: number;
  citationDomainJaccard: number | null;
  citationEventWeightedDomainSimilarity: number | null;
  reciprocalRankWeightedPageSimilarity?: number | null;
  promptsWithRankedPageComparison?: number;
  medianPromptReciprocalRankWeightedPageSimilarity?: number | null;
  promptsWithAtLeastOneCitationDomain: number;
  promptsWithCitationDomainsOnBothSides: number;
  medianPromptCitationDomainJaccard: number | null;
  providerAFirstObservedAt: string;
  providerALastObservedAt: string;
  providerBFirstObservedAt: string;
  providerBLastObservedAt: string;
  providerAObservationsWithOwnedCitation?: number;
  providerBObservationsWithOwnedCitation?: number;
  providerAOwnedCitationCoveragePercent?: number;
  providerBOwnedCitationCoveragePercent?: number;
  providerBOwnedCitationCoverageDeltaPercentagePoints?: number;
  providerAEqualPromptMeanOwnedCitationCoveragePercent?: number;
  providerBEqualPromptMeanOwnedCitationCoveragePercent?: number;
  meanPromptOwnedCitationCoverageDeltaPercentagePoints?: number;
  meanPromptOwnedCitationCoverageDeltaBootstrapConfidenceInterval95PercentagePoints?: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  medianPromptOwnedCitationCoverageDeltaPercentagePoints?: number;
  promptsWithProviderAHigherOwnedCitationCoverage?: number;
  promptsWithProviderBHigherOwnedCitationCoverage?: number;
  promptsWithEqualOwnedCitationCoverage?: number;
  providerAOwnedCitationPromptGroups?: number;
  providerBOwnedCitationPromptGroups?: number;
  providerAOwnedCitationPromptReachPercent?: number;
  providerBOwnedCitationPromptReachPercent?: number;
  providerAUnknownOwnedCitationPromptGroups?: number;
  providerBUnknownOwnedCitationPromptGroups?: number;
  providerAOwnedCitationPromptReachLowerBoundPercent?: number;
  providerAOwnedCitationPromptReachUpperBoundPercent?: number;
  providerBOwnedCitationPromptReachLowerBoundPercent?: number;
  providerBOwnedCitationPromptReachUpperBoundPercent?: number;
  providerBOwnedCitationPromptReachDeltaPercentagePoints?: number;
  providerBOwnedCitationPromptReachChangeLowerBoundPercentagePoints?: number;
  providerBOwnedCitationPromptReachChangeUpperBoundPercentagePoints?: number;
  meanPromptOwnedCitationPromptReachDeltaBootstrapConfidenceInterval95PercentagePoints?: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  promptsWithOwnedCitationOnlyForProviderA?: number;
  promptsWithOwnedCitationOnlyForProviderB?: number;
  promptsWithOwnedCitationForBothProviders?: number;
  promptsWithOwnedCitationForNeitherProvider?: number;
  /** Matched exact prompts with a known owned-reach state for both providers; paired inference uses this complete-case subset. */
  promptsWithOwnedCitationReachKnownOnBothProviders?: number;
  providerACitationEvents?: number;
  providerBCitationEvents?: number;
  providerAOwnedCitationEvents?: number;
  providerBOwnedCitationEvents?: number;
  providerAOwnedCitationEventSharePercent?: number | null;
  providerBOwnedCitationEventSharePercent?: number | null;
  providerBOwnedCitationEventShareDeltaPercentagePoints?: number | null;
  promptsWithOwnedCitationEventsOnBothSides?: number;
  medianPromptOwnedCitationEventShareDeltaPercentagePoints?: number | null;
  promptsWithProviderAHigherOwnedCitationEventShare?: number;
  promptsWithProviderBHigherOwnedCitationEventShare?: number;
  promptsWithEqualOwnedCitationEventShare?: number;
  promptsWithOwnedFirstCitationRankOnBothSides?: number;
  providerAEqualPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  providerBEqualPromptMeanOwnedFirstCitationMrrPercent?: number | null;
  meanPromptOwnedFirstCitationMrrDeltaPercentagePoints?: number | null;
  meanPromptOwnedFirstCitationMrrDeltaBootstrapConfidenceInterval95PercentagePoints?: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  medianPromptOwnedFirstCitationMrrDeltaPercentagePoints?: number | null;
  promptsWithProviderAHigherOwnedFirstCitationMrr?: number;
  promptsWithProviderBHigherOwnedFirstCitationMrr?: number;
  promptsWithEqualOwnedFirstCitationMrr?: number;
  providerAFirstPositionCitationEvents?: number;
  providerBFirstPositionCitationEvents?: number;
  providerAFirstPositionCitationSharePercent?: number | null;
  providerBFirstPositionCitationSharePercent?: number | null;
  providerBFirstPositionCitationShareDeltaPercentagePoints?: number | null;
  providerATopThreeCitationEvents?: number;
  providerBTopThreeCitationEvents?: number;
  providerATopThreeCitationSharePercent?: number | null;
  providerBTopThreeCitationSharePercent?: number | null;
  providerBTopThreeCitationShareDeltaPercentagePoints?: number | null;
  promptsWithCitationPositionsOnBothSides?: number;
  medianPromptFirstPositionCitationShareDeltaPercentagePoints?: number | null;
  promptsWithProviderAHigherFirstPositionShare?: number;
  promptsWithProviderBHigherFirstPositionShare?: number;
  promptsWithEqualFirstPositionShare?: number;
  medianPromptTopThreeCitationShareDeltaPercentagePoints?: number | null;
  promptsWithProviderAHigherTopThreeCitationShare?: number;
  promptsWithProviderBHigherTopThreeCitationShare?: number;
  promptsWithEqualTopThreeCitationShare?: number;
  providerATopCitedDomains: string[];
  providerBTopCitedDomains: string[];
  sharedTopCitedDomains: string[];
  providerAOnlyTopCitedDomains: string[];
  providerBOnlyTopCitedDomains: string[];
  citedDomainDetailComplete: boolean;
}

export interface AiAnswerCitationProviderSampleMixSegment {
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  providerAObservations: number;
  providerBObservations: number;
  providerASharePercent: number;
  providerBSharePercent: number;
  providerBShareDeltaPercentagePoints: number;
  divergenceContributionPercent: number;
}

export interface AiAnswerCitationProviderSampleMixComparison {
  providerA: string;
  providerB: string;
  providerAObservations: number;
  providerBObservations: number;
  providerAUnlabeledObservations: number;
  providerBUnlabeledObservations: number;
  sharedSampleSegments: number;
  sampleSegmentsOnlyInProviderA: number;
  sampleSegmentsOnlyInProviderB: number;
  normalizedJensenShannonDivergence: number;
  jensenShannonDistance: number;
  leadingDivergentSegments: AiAnswerCitationProviderSampleMixSegment[];
  leadingSegmentsTruncated: boolean;
}

export interface AiAnswerCitationTemporalStabilityProfile {
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  provider: string;
  prompt: string;
  snapshots: number;
  snapshotTransitions: number;
  orderedTransitions: number;
  sameTimestampAdjacentPairs: number;
  firstObservedAt: string;
  lastObservedAt: string;
  citationPresenceChanges: number;
  citationPresenceTransitionsUnobservedDueToTruncation: number;
  consecutiveNoCitationTransitions: number;
  incompleteSourceListTransitions: number;
  domainOverlapTransitions: number;
  meanAdjacentDomainJaccard: number | null;
  medianAdjacentDomainJaccard: number | null;
  pageOverlapTransitions: number;
  meanAdjacentPageJaccard: number | null;
  medianAdjacentPageJaccard: number | null;
  domainAppearances: number;
  domainDisappearances: number;
  domainPresenceComparisonsUnobservedDueToTruncation: number;
  citationUrlPresenceComparisonsUnobservedDueToTruncation: number;
  distinctDomainsObserved: number;
  distinctCitationUrlsObserved: number;
  positionShareTransitions: number;
  positionShareTransitionsUnobservedDueToTruncation: number;
  medianAbsoluteFirstPositionShareChangePercentagePoints: number | null;
  medianAbsoluteTopThreeShareChangePercentagePoints: number | null;
  ownedCitationPresenceChanges?: number;
  ownedCitationPresenceTransitionsUnobservedDueToTruncation?: number;
  ownedDomainOverlapTransitions?: number;
  meanAdjacentOwnedDomainJaccard?: number | null;
  medianAdjacentOwnedDomainJaccard?: number | null;
  ownedEventShareTransitions?: number;
  ownedEventShareTransitionsUnobservedDueToTruncation?: number;
  medianAbsoluteOwnedCitationEventShareChangePercentagePoints?: number | null;
}

/** Exact-prompt source recurrence measured only between distinct captured timestamps. */
export interface AiAnswerCitationSourcePersistenceProfile {
  provider: string;
  sourceDomain: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  model?: string;
  surface?: string;
  locale?: string;
  promptGroupsWithSource: number;
  capturesWithSource: number;
  sampledTimestampsWithSource: number;
  promptGroupsStartingWithSource: number;
  promptGroupsEndingWithSource: number;
  orderedTransitionsWithSourcePresence: number;
  sourcePresentAtPreviousTimestamp: number;
  sourcePresentAtBothTimestamps: number;
  sourceAbsentAtNextTimestamp: number;
  sourceTransitionsObservedAtNextTimestamp?: number;
  sourceNextTimestampUnobservedDueToTruncation?: number;
  sourceFirstAppearedAtNextTimestamp: number;
  sourcePresenceAtPreviousTimestampUnobservedDueToTruncation?: number;
  nextTimestampRetentionPercent: number | null;
  promptGroupsWithSourcePresentTransitions?: number;
  equalPromptMeanNextTimestampRetentionPercent?: number | null;
  equalPromptMeanNextTimestampRetentionConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  retentionBootstrapStatus?:
    | 'complete'
    | 'insufficient-prompt-support'
    | 'work-budget-exceeded'
    | 'source-analysis-truncated';
  retentionByFollowUpInterval?: AiAnswerCitationSourcePersistenceIntervalProfile[];
  retentionByPreviousCitationRank?: AiAnswerCitationSourcePersistenceRankProfile[];
  meanDaysUntilNextSampleWhenPreviouslyCited: number | null;
  longestConsecutiveSampledTimestampsWithSource: number;
  firstObservedCitationAt: string;
  lastObservedCitationAt: string;
}

export interface AiAnswerCitationSourcePersistenceIntervalProfile {
  intervalLabel: string;
  maximumDays: number | null;
  transitionsAtRisk: number;
  retainedAtNextTimestamp: number;
  transitionsUnobservedDueToTruncation?: number;
  retentionPercent: number | null;
  promptGroupsAtRisk?: number;
  equalPromptMeanRetentionPercent?: number | null;
  equalPromptMeanRetentionConfidenceInterval95?: AiAnswerCitationMetricConfidenceInterval95 | null;
  bootstrapStatus?:
    | 'complete'
    | 'insufficient-prompt-support'
    | 'work-budget-exceeded'
    | 'source-analysis-truncated';
}

export interface AiAnswerCitationSourcePersistenceRankProfile {
  rankBand: string;
  maximumRank: number | null;
  transitionsAtRisk: number;
  promptGroupsAtRisk: number;
  retainedAtNextTimestamp: number;
  transitionsUnobservedDueToTruncation?: number;
  retentionPercent: number | null;
}

export interface AiAnswerCitationUrlPersistenceProfile {
  provider: string;
  citationUrl: string;
  topic?: string;
  intent?: string;
  unlabeled: boolean;
  model?: string;
  surface?: string;
  locale?: string;
  promptGroupsWithUrl: number;
  capturesWithUrl: number;
  sampledTimestampsWithUrl: number;
  promptGroupsStartingWithUrl: number;
  promptGroupsEndingWithUrl: number;
  orderedTransitionsWithUrlPresence: number;
  urlPresentAtPreviousTimestamp: number;
  urlPresentAtBothTimestamps: number;
  urlAbsentAtNextTimestamp: number;
  urlTransitionsObservedAtNextTimestamp?: number;
  urlNextTimestampUnobservedDueToTruncation?: number;
  urlFirstAppearedAtNextTimestamp: number;
  urlPresenceAtPreviousTimestampUnobservedDueToTruncation?: number;
  nextTimestampRetentionPercent: number | null;
  firstObservedCitationAt: string;
  lastObservedCitationAt: string;
}

export interface AiAnswerCitationObservationReport {
  source: 'Aviary observed AI answer citation analysis';
  schemaVersion: 1;
  analyzedAt: string;
  ownedDomains: string[];
  summary: {
    observations: number;
    uniqueProviders: number;
    uniquePrompts: number;
    repeatedPrompts: number;
    observationsWithCitations: number;
    observationsWithoutCitations: number;
    incompleteCitationListObservations?: number;
    observationsWithKnownOwnedCitationState?: number;
    observationsWithUnknownOwnedCitationState?: number;
    citationEvents: number;
    domainConcentration?: AiAnswerCitationDomainConcentration;
    distinctCitedDomains: number;
    distinctCitedUrls: number;
    duplicateCitationUrlsDropped: number;
    labeledObservations: number;
    unlabeledObservations: number;
    topicLabels: number;
    intentLabels: number;
    observationsWithOwnedCitation?: number;
    observationsWithoutOwnedCitation?: number;
    ownedCitationCoveragePercent?: number;
    ownedCitationCoverageAmongKnownObservationsPercent?: number | null;
    ownedCitationCoverageUpperBoundPercent?: number;
    promptsWithOwnedCitation?: number;
    ownedCitationPromptCoveragePercent?: number;
    promptsWithKnownOwnedCitationState?: number;
    promptsWithUnknownOwnedCitationState?: number;
    ownedCitationPromptCoverageAmongKnownPromptsPercent?: number | null;
    ownedCitationPromptCoverageUpperBoundPercent?: number;
    ownedCitationPromptCoverageAmongKnownPromptsConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
    ownedCitationPromptCoverageConfidenceInterval95Percent?: AiAnswerCitationRateConfidenceInterval95 | null;
    ownedCitationEvents?: number;
    ownedCitationEventSharePercent?: number | null;
    ownedFirstCitationMeanReciprocalRankPercent?: number | null;
    ownedCitationPositionBuckets?: AiAnswerCitationOwnedPositionBucketProfile[];
    promptsWithNoOwnedCitation?: number;
  };
  coCitationSummary?: AiAnswerCitationCoCitationSummary;
  coCitationDomains?: AiAnswerCitationCoCitationDomainProfile[];
  providers: AiAnswerCitationProviderProfile[];
  domains: AiAnswerCitationDomainProfile[];
  domainsTruncated: boolean;
  citedPages: AiAnswerCitationPageProfile[];
  citedPagesTruncated: boolean;
  auditCorrelation?: AiAnswerCitationAuditCorrelation;
  auditSignalBreakdown?: AiAnswerCitationAuditSignalBreakdownRow[];
  auditSignalBreakdownTruncated?: boolean;
  prompts: AiAnswerCitationPromptProfile[];
  promptsTruncated: boolean;
  reviewQueue: AiAnswerCitationReviewOpportunity[];
  reviewQueueTruncated: boolean;
  monthly: AiAnswerCitationMonthlyProfile[];
  topicIntentProviderMonthly?: AiAnswerCitationTopicIntentProviderMonthlyProfile[];
  topicIntentProviderMonthlyTruncated?: boolean;
  topicIntentCohorts: AiAnswerCitationTopicIntentProfile[];
  topicIntentCohortsTruncated: boolean;
  executionContextProfiles?: AiAnswerCitationExecutionContextProfile[];
  executionContextProfilesTruncated?: boolean;
  executionContextMonthlyProfiles?: AiAnswerCitationExecutionContextMonthlyProfile[];
  executionContextMonthlyProfilesTruncated?: boolean;
  answerLengthProfiles?: AiAnswerCitationAnswerLengthProfile[];
  answerLengthProfilesTruncated?: boolean;
  answerLengthPromptRankProfiles?: AiAnswerCitationAnswerLengthPromptRankProfile[];
  answerLengthPromptRankProfilesTruncated?: boolean;
  answerLengthMonthlyProfiles?: AiAnswerCitationAnswerLengthMonthlyProfile[];
  answerLengthMonthlyProfilesTruncated?: boolean;
  topicIntentProviderPairComparisons?: AiAnswerCitationTopicIntentProviderPairComparison[];
  topicIntentProviderPairComparisonsTruncated?: boolean;
  providerSampleMixComparisons?: AiAnswerCitationProviderSampleMixComparison[];
  providerSampleMixComparisonsTruncated?: boolean;
  temporalStabilityProfiles?: AiAnswerCitationTemporalStabilityProfile[];
  temporalStabilityProfilesTruncated?: boolean;
  sourcePersistenceProfiles?: AiAnswerCitationSourcePersistenceProfile[];
  sourcePersistenceProfilesTruncated?: boolean;
  sourcePersistenceProfilesAvailable?: number;
  sourcePersistenceWorkingProfileCap?: number;
  sourcePersistenceTimestampCheckBudget?: number;
  sourcePersistenceTimestampChecksPerformed?: number;
  sourcePersistenceBootstrapUpdateBudget?: number;
  sourcePersistenceBootstrapUpdatesPerformed?: number;
  sourcePersistenceBootstrapWorkTruncated?: boolean;
  sourcePersistenceOutputProfileCap?: number;
  sourcePersistenceWorkTruncated?: boolean;
  citationUrlPersistenceProfiles?: AiAnswerCitationUrlPersistenceProfile[];
  citationUrlPersistenceProfilesTruncated?: boolean;
  citationUrlPersistenceProfilesAvailable?: number;
  citationUrlPersistenceWorkingProfileCap?: number;
  citationUrlPersistenceTimestampCheckBudget?: number;
  citationUrlPersistenceTimestampChecksPerformed?: number;
  citationUrlPersistenceOutputProfileCap?: number;
  citationUrlPersistenceWorkTruncated?: boolean;
  entityMentionProfiles?: AiAnswerCitationEntityMentionProfile[];
  entityPromptProfiles?: AiAnswerCitationEntityPromptProfile[];
  entityPromptProfilesTruncated?: boolean;
  entityPromptProviderPairComparisons?: AiAnswerCitationEntityPromptProviderPairProfile[];
  entityPromptProviderPairComparisonsTruncated?: boolean;
  entityCoMentionProfiles?: AiAnswerCitationEntityCoMentionProfile[];
  entityCoMentionProfilesTruncated?: boolean;
  entityMentionMonthlyProfiles?: AiAnswerCitationEntityMentionMonthlyProfile[];
  entityMentionMonthlyProfilesTruncated?: boolean;
  entityMentionOpportunities?: AiAnswerCitationEntityMentionOpportunity[];
  entityMentionOpportunitiesTruncated?: boolean;
  entityPathFamilyAssociations?: AiAnswerCitationEntityPathFamilyProfile[];
  entityPathFamilyAssociationsTruncated?: boolean;
  entityPathFamilyMonthlyAssociations?: AiAnswerCitationEntityPathFamilyMonthlyProfile[];
  entityPathFamilyMonthlyAssociationsTruncated?: boolean;
  entityCitationPageAssociations?: AiAnswerCitationEntityCitationPageProfile[];
  entityCitationPageAssociationsTruncated?: boolean;
  entityCitationPageMonthlyAssociations?: AiAnswerCitationEntityCitationPageMonthlyProfile[];
  entityCitationPageMonthlyAssociationsTruncated?: boolean;
  pathFamilyDepth?: number;
  pathFamilyCount?: number;
  pathFamilies?: AiAnswerCitationPathFamilyProfile[];
  pathFamiliesTruncated?: boolean;
  pathFamilyCohorts?: AiAnswerCitationPathFamilyCohortProfile[];
  pathFamilyCohortsTruncated?: boolean;
  pathFamilyMonthlyCohorts?: AiAnswerCitationPathFamilyMonthlyProfile[];
  pathFamilyMonthlyCohortsTruncated?: boolean;
  crawlerLogCorrelation?: AiAnswerCitationCrawlerLogCorrelation;
  periodComparison?: AiAnswerCitationObservationPeriodComparison;
  note: string;
}

const MAX_OBSERVATIONS = 20_000;
const MAX_CITATIONS_PER_OBSERVATION = 50;
const MAX_PROVIDERS = 100;
const MAX_PROMPTS = 10_000;
const MAX_DOMAINS = 2_000;
const MAX_CITED_PAGES = 20_000;
const MAX_RETURNED_PERIOD_COMPARISON_ROWS = 1_000;
const MAX_RETURNED_PROVIDER_PAIR_ROWS = 1_000;
const MAX_RETURNED_SAMPLE_MIX_ROWS = 1_000;
const MAX_RETURNED_TEMPORAL_STABILITY_ROWS = 1_000;
const MAX_SOURCE_PERSISTENCE_WORKING_PROFILES = 50_000;
const MAX_SOURCE_PERSISTENCE_TIMESTAMP_CHECKS = 5_000_000;
const MAX_SOURCE_PERSISTENCE_BOOTSTRAP_UPDATES = 20_000_000;
const MAX_RETURNED_SOURCE_PERSISTENCE_PROFILES = 10_000;
const MAX_CITATION_URL_PERSISTENCE_WORKING_PROFILES = 50_000;
const MAX_CITATION_URL_PERSISTENCE_TIMESTAMP_CHECKS = 5_000_000;
const MAX_RETURNED_CITATION_URL_PERSISTENCE_PROFILES = 10_000;
const SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS = [
  { label: '0–1 days', maximumDays: 1 },
  { label: '>1–7 days', maximumDays: 7 },
  { label: '>7–30 days', maximumDays: 30 },
  { label: '>30–90 days', maximumDays: 90 },
  { label: '>90 days', maximumDays: null },
] as const;
const SOURCE_PERSISTENCE_PREVIOUS_RANK_BANDS = [
  { label: 'rank 1', maximumRank: 1 },
  { label: 'ranks 2–3', maximumRank: 3 },
  { label: 'ranks 4–5', maximumRank: 5 },
  { label: 'ranks 6–10', maximumRank: 10 },
  { label: 'ranks 11+', maximumRank: null },
] as const;
const MAX_RETURNED_COHORT_MONTHLY_ROWS = 5_000;
const MAX_RETURNED_EXECUTION_CONTEXT_PROFILES = 5_000;
const MAX_RETURNED_EXECUTION_CONTEXT_MONTHLY_PROFILES = 10_000;
const MAX_ANSWER_LENGTH_PROFILE_WORKING_ROWS = 20_000;
const MAX_RETURNED_ANSWER_LENGTH_PROFILES = 10_000;
const MAX_RETURNED_ANSWER_LENGTH_PROMPT_RANK_PROFILES = MAX_OBSERVATIONS;
const MAX_RETURNED_AUDIT_SIGNAL_ROWS = 500;
const MAX_RETURNED_ENTITY_MENTION_MONTHLY_ROWS = 5_000;
const MAX_RETURNED_ENTITY_MENTION_PERIOD_MONTHLY_ROWS = 10_000;
const MAX_RETURNED_ENTITY_MENTION_OPPORTUNITIES = 250;
const MAX_ENTITY_PATH_FAMILY_COHORT_WORKING_ROWS = 20_000;
const MAX_ENTITY_PATH_FAMILY_WORKING_ROWS = 20_000;
const MAX_RETURNED_ENTITY_PATH_FAMILY_PROFILES = 10_000;
const MAX_ENTITY_PATH_FAMILY_MONTHLY_COHORT_WORKING_ROWS = 20_000;
const MAX_ENTITY_PATH_FAMILY_MONTHLY_WORKING_ROWS = 20_000;
const MAX_RETURNED_ENTITY_PATH_FAMILY_MONTHLY_PROFILES = 10_000;
const MAX_ENTITY_CITATION_PAGE_COHORT_WORKING_ROWS = 20_000;
const MAX_ENTITY_CITATION_PAGE_WORKING_ROWS = 20_000;
const MAX_RETURNED_ENTITY_CITATION_PAGE_PROFILES = 10_000;
const MAX_ENTITY_CITATION_PAGE_MONTHLY_COHORT_WORKING_ROWS = 20_000;
const MAX_ENTITY_CITATION_PAGE_MONTHLY_WORKING_ROWS = 20_000;
const MAX_RETURNED_ENTITY_CITATION_PAGE_MONTHLY_PROFILES = 10_000;
const MAX_RETURNED_ENTITY_CITATION_PAGE_COMPARISON_ROWS = 10_000;
const MAX_RETURNED_ENTITY_CO_MENTION_PROFILES = 10_000;
const MAX_RETURNED_ENTITY_CO_MENTION_PERIOD_ROWS = 10_000;
const MAX_RETURNED_ENTITY_PROMPT_COMPARISON_ROWS = 10_000;
const MAX_ENTITY_PROMPT_PROFILE_WORKING_ROWS = 20_000;
const MAX_RETURNED_ENTITY_PROMPT_PROFILES = 10_000;
const MAX_ENTITY_PROMPT_PROVIDER_PAIR_WORKING_ROWS = 20_000;
const MAX_ENTITY_PROMPT_PROVIDER_PAIR_WORKING_COMPARISONS = 50_000;
const MAX_RETURNED_ENTITY_PROMPT_PROVIDER_PAIRS = 10_000;
const MAX_ENTITY_CITATION_DOMAIN_ASSOCIATIONS = 25;
const MAX_RETURNED_ANSWER_PATH_FAMILIES = 1_000;
const MAX_RETURNED_ANSWER_PATH_FAMILY_COHORTS = 10_000;
const MAX_ANSWER_PATH_FAMILY_COHORT_WORKING_ROWS = 20_000;
const MAX_RETURNED_ANSWER_PATH_FAMILY_MONTHLY_COHORTS = 10_000;
const MAX_ANSWER_PATH_FAMILY_MONTHLY_COHORT_WORKING_ROWS = 20_000;
const MAX_RETURNED_CO_CITATION_DOMAINS = 250;
const MAX_SAMPLE_CO_CITATION_URLS = 5;
const MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS = 5;
const MAX_CRAWLER_LOG_ANALYSES_FOR_CITATION_JOIN = 100;
const MAX_CRAWLER_MATCHES_PER_CITED_PAGE = 50;

function summarizeDomainConcentration(
  domainCitationEvents: Iterable<number>,
  totalCitationEvents: number
): AiAnswerCitationDomainConcentration {
  const counts = [...domainCitationEvents];
  if (totalCitationEvents === 0) {
    return {
      distinctCitedDomains: 0,
      herfindahlIndex: null,
      effectiveCitedDomainCount: null,
      largestDomainCitationSharePercent: null,
    };
  }
  const shares = counts.map((count) => count / totalCitationEvents);
  const herfindahlIndex = shares.reduce((sum, share) => sum + share ** 2, 0);
  return {
    distinctCitedDomains: counts.length,
    herfindahlIndex: Number(herfindahlIndex.toFixed(4)),
    effectiveCitedDomainCount:
      herfindahlIndex > 0 ? Number((1 / herfindahlIndex).toFixed(2)) : null,
    largestDomainCitationSharePercent: Number((Math.max(0, ...shares) * 100).toFixed(2)),
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length === 0
    ? 0
    : sorted.length % 2 === 0
      ? (sorted[middle - 1]! + sorted[middle]!) / 2
      : sorted[middle]!;
}

function summarizeCitationListPositions(positions: number[]): AiAnswerCitationListPositionProfile {
  const firstPositionCitationEvents = positions.filter((position) => position === 1).length;
  const topThreeCitationEvents = positions.filter((position) => position <= 3).length;
  const bucketDefinitions: Array<{
    range: AiAnswerCitationPositionBucket['range'];
    matches: (position: number) => boolean;
  }> = [
    { range: '1', matches: (position) => position === 1 },
    { range: '2', matches: (position) => position === 2 },
    { range: '3', matches: (position) => position === 3 },
    { range: '4-5', matches: (position) => position >= 4 && position <= 5 },
    { range: '6-10', matches: (position) => position >= 6 && position <= 10 },
    { range: '11+', matches: (position) => position >= 11 },
  ];
  return {
    meanPosition: Number(
      (positions.reduce((sum, position) => sum + position, 0) / positions.length).toFixed(2)
    ),
    medianPosition: Number(median(positions).toFixed(2)),
    firstPositionCitationEvents,
    firstPositionCitationSharePercent: Number(
      ((firstPositionCitationEvents / positions.length) * 100).toFixed(2)
    ),
    topThreeCitationEvents,
    topThreeCitationSharePercent: Number(
      ((topThreeCitationEvents / positions.length) * 100).toFixed(2)
    ),
    positionBuckets: bucketDefinitions.map(({ range, matches }) => {
      const citationEvents = positions.filter(matches).length;
      return {
        range,
        citationEvents,
        citationSharePercent: Number(((citationEvents / positions.length) * 100).toFixed(2)),
      };
    }),
  };
}

function wilsonRateConfidenceInterval95(
  successes: number,
  trials: number
): AiAnswerCitationRateConfidenceInterval95 | null {
  if (trials === 0) return null;
  const z = 1.96;
  const proportion = successes / trials;
  const denominator = 1 + z ** 2 / trials;
  const center = (proportion + z ** 2 / (2 * trials)) / denominator;
  const margin =
    (z * Math.sqrt((proportion * (1 - proportion) + z ** 2 / (4 * trials)) / trials)) / denominator;
  return {
    lowerPercent: Number((Math.max(0, center - margin) * 100).toFixed(2)),
    upperPercent: Number((Math.min(1, center + margin) * 100).toFixed(2)),
  };
}

function summarizePromptRankReach(
  promptsWithFirstPositionCitation: Set<string>,
  promptsWithTopThreeCitation: Set<string>,
  totalPrompts: number
): AiAnswerCitationPromptRankReachProfile {
  return {
    promptsWithFirstPositionCitation: promptsWithFirstPositionCitation.size,
    firstPositionPromptCoveragePercent:
      totalPrompts > 0
        ? Number(((promptsWithFirstPositionCitation.size / totalPrompts) * 100).toFixed(2))
        : 0,
    firstPositionPromptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
      promptsWithFirstPositionCitation.size,
      totalPrompts
    ),
    promptsWithTopThreeCitation: promptsWithTopThreeCitation.size,
    topThreePromptCoveragePercent:
      totalPrompts > 0
        ? Number(((promptsWithTopThreeCitation.size / totalPrompts) * 100).toFixed(2))
        : 0,
    topThreePromptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
      promptsWithTopThreeCitation.size,
      totalPrompts
    ),
  };
}

function newcombeRateDifferenceConfidenceInterval95(
  successesA: number,
  trialsA: number,
  successesB: number,
  trialsB: number
): AiAnswerCitationRateDifferenceConfidenceInterval95 | null {
  const intervalA = wilsonRateConfidenceInterval95(successesA, trialsA);
  const intervalB = wilsonRateConfidenceInterval95(successesB, trialsB);
  if (!intervalA || !intervalB) return null;
  const rateA = successesA / trialsA;
  const rateB = successesB / trialsB;
  const lowerA = intervalA.lowerPercent / 100;
  const upperA = intervalA.upperPercent / 100;
  const lowerB = intervalB.lowerPercent / 100;
  const upperB = intervalB.upperPercent / 100;
  const difference = rateB - rateA;
  const lower = Math.max(-1, difference - Math.sqrt((rateA - lowerA) ** 2 + (upperB - rateB) ** 2));
  const upper = Math.min(1, difference + Math.sqrt((upperA - rateA) ** 2 + (rateB - lowerB) ** 2));
  return {
    lowerPercentagePoints: Number((lower * 100).toFixed(2)),
    upperPercentagePoints: Number((upper * 100).toFixed(2)),
  };
}

function bootstrapMeanDifferenceConfidenceInterval95(
  values: number[],
  seedText: string
): AiAnswerCitationRateDifferenceConfidenceInterval95 | null {
  if (values.length < 2) return null;
  const sortedValues = values.slice().sort((left, right) => left - right);
  let seed = 2166136261;
  for (const character of seedText)
    seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  if (seed === 0) seed = 0x6d2b79f5;
  let state = seed;
  const sampleCount = sortedValues.length;
  const bootstrapIterations = 1_000;
  const bootstrapMeans = new Array<number>(bootstrapIterations);
  for (let iteration = 0; iteration < bootstrapIterations; iteration += 1) {
    let total = 0;
    for (let sample = 0; sample < sampleCount; sample += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const sampleIndex = Math.floor((state / 0x1_0000_0000) * sampleCount);
      total += sortedValues[sampleIndex]!;
    }
    bootstrapMeans[iteration] = total / sampleCount;
  }
  bootstrapMeans.sort((left, right) => left - right);
  const lower = bootstrapMeans[Math.floor((bootstrapIterations - 1) * 0.025)]!;
  const upper = bootstrapMeans[Math.ceil((bootstrapIterations - 1) * 0.975)]!;
  return {
    lowerPercentagePoints: Number(lower.toFixed(2)),
    upperPercentagePoints: Number(upper.toFixed(2)),
  };
}

function pairedExactMcNemarPValue(gained: number, lost: number): number {
  const discordant = gained + lost;
  if (discordant === 0 || gained === lost) return 1;
  const lowerTail = Math.min(gained, lost);
  let logProbability = -discordant * Math.LN2;
  let logCumulativeProbability = Number.NEGATIVE_INFINITY;
  for (let successes = 0; successes <= lowerTail; successes += 1) {
    const maximum = Math.max(logCumulativeProbability, logProbability);
    logCumulativeProbability =
      maximum + Math.log1p(Math.exp(Math.min(logCumulativeProbability, logProbability) - maximum));
    if (successes < lowerTail)
      logProbability += Math.log(discordant - successes) - Math.log(successes + 1);
  }
  return Number(Math.min(1, Math.exp(Math.LN2 + logCumulativeProbability)).toPrecision(15));
}

function holmAdjustedPValues(pValues: number[]): number[] {
  const ranked = pValues
    .map((pValue, index) => ({ pValue, index }))
    .sort((left, right) => left.pValue - right.pValue || left.index - right.index);
  const adjusted = new Array<number>(pValues.length);
  let monotoneMaximum = 0;
  ranked.forEach(({ pValue, index }, rank) => {
    monotoneMaximum = Math.max(monotoneMaximum, Math.min(1, pValue * (ranked.length - rank)));
    adjusted[index] = Number(monotoneMaximum.toPrecision(15));
  });
  return adjusted;
}

function bootstrapMeanMetricConfidenceInterval95(
  values: number[],
  seedText: string
): AiAnswerCitationMetricConfidenceInterval95 | null {
  if (values.length < 2) return null;
  let seed = 2166136261;
  for (const character of seedText)
    seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  if (seed === 0) seed = 0x6d2b79f5;
  let state = seed;
  const bootstrapIterations = 1_000;
  const bootstrapMeans = new Array<number>(bootstrapIterations);
  for (let iteration = 0; iteration < bootstrapIterations; iteration += 1) {
    let total = 0;
    for (let sample = 0; sample < values.length; sample += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      total += values[Math.floor((state / 0x1_0000_0000) * values.length)]!;
    }
    bootstrapMeans[iteration] = total / values.length;
  }
  bootstrapMeans.sort((left, right) => left - right);
  return {
    lower: Number(bootstrapMeans[Math.floor((bootstrapIterations - 1) * 0.025)]!.toFixed(2)),
    upper: Number(bootstrapMeans[Math.ceil((bootstrapIterations - 1) * 0.975)]!.toFixed(2)),
  };
}

function pathFamilyForCitationUrl(
  value: string,
  depth: number
): { pathFamily: string; origin: string; pathPrefix: string } | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    const segments = url.pathname.split('/').filter(Boolean).slice(0, depth);
    const pathPrefix = segments.length > 0 ? `/${segments.join('/')}` : '/';
    return { pathFamily: `${url.origin}${pathPrefix}`, origin: url.origin, pathPrefix };
  } catch {
    return undefined;
  }
}

function countOwnedCitationEvents(
  domainEvents: Iterable<[string, number]>,
  ownedDomains: string[]
): number {
  if (ownedDomains.length === 0) return 0;
  let total = 0;
  for (const [domain, events] of domainEvents) {
    if (isOwnedDomain(domain, ownedDomains)) total += events;
  }
  return total;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!normalized) throw new Error(`${field} must not be empty.`);
  if (normalized.length > maxLength)
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  return normalized;
}

function normalizeAnswerEntities(inputs: string[]): NormalizedAnswerEntity[] {
  if (inputs.length > 100) throw new Error('Configure no more than 100 answer entities.');
  const entityNames = new Set<string>();
  const aliasOwners = new Map<string, string>();
  return inputs.map((input, index) => {
    const separator = input.indexOf('=');
    const entity = requiredText(
      separator < 0 ? input : input.slice(0, separator),
      `Answer entity ${index + 1} name`,
      100
    );
    const entityKey = entity.normalize('NFKC').toLocaleLowerCase('en-US');
    if (entityNames.has(entityKey))
      throw new Error(`Answer entity "${entity}" is configured more than once.`);
    entityNames.add(entityKey);
    const rawAliases = separator < 0 ? [] : input.slice(separator + 1).split('|');
    if (rawAliases.length > 20)
      throw new Error(`Answer entity "${entity}" may have no more than 20 aliases.`);
    const aliases = [
      ...new Set([
        entity,
        ...rawAliases.map((alias, aliasIndex) =>
          requiredText(alias, `Answer entity ${index + 1} alias ${aliasIndex + 1}`, 100)
        ),
      ]),
    ];
    for (const alias of aliases) {
      const aliasKey = alias
        .normalize('NFKC')
        .replace(/\s+/gu, ' ')
        .trim()
        .toLocaleLowerCase('en-US');
      const owner = aliasOwners.get(aliasKey);
      if (owner && owner !== entity)
        throw new Error(`Answer alias "${alias}" is assigned to both "${owner}" and "${entity}".`);
      aliasOwners.set(aliasKey, entity);
    }
    const patterns = [...aliases]
      .sort((left, right) => right.length - left.length || left.localeCompare(right))
      .map((alias) =>
        alias
          .trim()
          .split(/\s+/u)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s+')
      );
    const matcherSource = `(?:^|[^\\p{L}\\p{N}])(?:${patterns.join('|')})(?=$|[^\\p{L}\\p{N}])`;
    return {
      entity,
      aliases,
      occurrenceMatcher: new RegExp(matcherSource, 'giu'),
    };
  });
}

function normalizeTimestamp(value: unknown, index: number): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    throw new Error(
      `Observation ${index}: observedAt must be an ISO 8601 date-time with an explicit timezone.`
    );
  }
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!parts) throw new Error(`Observation ${index}: observedAt is not a valid date-time.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const maxDay = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (day < 1 || day > maxDay || hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Observation ${index}: observedAt is not a valid calendar date-time.`);
  }
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(value);
  if (
    offset &&
    (Number(offset[2]) > 14 ||
      Number(offset[3]) > 59 ||
      (Number(offset[2]) === 14 && Number(offset[3]) !== 0))
  ) {
    throw new Error(`Observation ${index}: observedAt has an invalid timezone offset.`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error(`Observation ${index}: observedAt is not a valid date-time.`);
  return parsed.toISOString();
}

function normalizeCitationUrl(
  value: unknown,
  index: number,
  citationIndex: number
): { url: string; domain: string } {
  if (typeof value !== 'string' || value.length > 2_048) {
    throw new Error(
      `Observation ${index}: citedUrls[${citationIndex}] must be a URL string of at most 2,048 characters.`
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `Observation ${index}: citedUrls[${citationIndex}] must be a valid absolute HTTP(S) URL.`
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new Error(
      `Observation ${index}: citedUrls[${citationIndex}] must be a credential-free HTTP(S) URL.`
    );
  }
  url.hash = '';
  url.search = '';
  const domain = url.hostname.toLowerCase().replace(/\.$/, '');
  url.hostname = domain;
  return { url: url.href, domain };
}

function normalizeOwnedDomain(value: string): string {
  const candidate = value.trim().replace(/^\.+|\.+$/g, '');
  if (!candidate || /[\s/@?#]/.test(candidate))
    throw new Error(`Invalid owned domain "${value}"; use a hostname without a URL path.`);
  let url: URL;
  try {
    url = new URL(`https://${candidate}`);
  } catch {
    throw new Error(`Invalid owned domain "${value}"; use a hostname such as example.com.`);
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.hostname.includes('%')
  ) {
    throw new Error(`Invalid owned domain "${value}"; use a hostname such as example.com.`);
  }
  return url.hostname.toLowerCase().replace(/\.$/, '');
}

function isOwnedDomain(domain: string, ownedDomains: string[]): boolean {
  return ownedDomains.some((owned) => domain === owned || domain.endsWith(`.${owned}`));
}

function normalizeAuditUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

function auditSignalBreakdown(
  citedPages: AiAnswerCitationPageProfile[],
  ownedDomains: string[]
): { rows: AiAnswerCitationAuditSignalBreakdownRow[]; truncated: boolean } {
  const buckets = new Map<string, AiAnswerCitationAuditSignalBreakdownRow>();
  const add = (
    page: AiAnswerCitationPageProfile,
    signal: AiAnswerCitationAuditSignalBreakdownRow['signal'],
    dimension: string,
    state: string
  ): void => {
    const key = JSON.stringify([signal, dimension, state]);
    const row = buckets.get(key) ?? {
      signal,
      dimension,
      state,
      citedPages: 0,
      citationEvents: 0,
      pagePromptPairs: 0,
      ...(ownedDomains.length > 0
        ? { ownedCitedPages: 0, ownedCitationEvents: 0, ownedCitationEventSharePercent: null }
        : {}),
    };
    row.citedPages += 1;
    row.citationEvents += page.citationEvents;
    row.pagePromptPairs += page.uniquePrompts;
    if (ownedDomains.length > 0) {
      row.ownedCitedPages = (row.ownedCitedPages ?? 0) + (page.owned ? 1 : 0);
      row.ownedCitationEvents =
        (row.ownedCitationEvents ?? 0) + (page.owned ? page.citationEvents : 0);
      row.ownedCitationEventSharePercent =
        row.citationEvents > 0
          ? Number(((row.ownedCitationEvents / row.citationEvents) * 100).toFixed(2))
          : null;
    }
    buckets.set(key, row);
  };
  const presentState = (value: number | undefined): string =>
    value === undefined ? 'unknown' : value > 0 ? 'present' : 'none';
  const booleanState = (value: boolean | undefined): string =>
    value === undefined ? 'unknown' : value ? 'yes' : 'no';
  const measuredState = (coverage: string | undefined, state: string): string =>
    coverage === 'measured' ? state : (coverage ?? 'unknown');
  const coverageKeys = [
    'searchCrawlerAccess',
    'dataUseCrawlerPolicy',
    'userInitiatedFetchAccess',
    'previewControls',
    'answerContent',
    'sourceRenderedContent',
    'citationEvidence',
    'optionalLlmsFiles',
  ] as const;

  for (const page of citedPages) {
    const match = page.auditMatch;
    if (!match) continue;
    add(page, 'audit-match', 'url', match.state);
    if (match.state !== 'exact-url' && match.state !== 'unique-canonical') continue;

    const coverage = match.signalCoverage;
    for (const key of coverageKeys) {
      const status = coverage?.[key];
      if (status) add(page, 'signal-coverage', key, status);
    }

    for (const [signal, rows] of [
      ['search-crawler-access', match.searchCrawlerAccess],
      ['data-use-crawler-policy', match.dataUseCrawlerPolicy],
      ['user-initiated-fetch-access', match.userInitiatedFetchAccess],
    ] as const) {
      for (const row of rows ?? [])
        add(page, signal, row.token, row.allowed ? 'allowed' : 'blocked');
    }

    const previewCoverage = coverage?.previewControls;
    for (const [dimension, value] of [
      ['noindex', match.previewControls?.noindex],
      ['noSnippet', match.previewControls?.noSnippet],
      ['maxSnippetZero', match.previewControls?.maxSnippetZero],
    ] as const) {
      add(page, 'preview-control', dimension, measuredState(previewCoverage, booleanState(value)));
    }
    const noSnippetWords = match.previewControls?.dataNoSnippetWords;
    add(
      page,
      'preview-control',
      'dataNoSnippetWords',
      measuredState(
        previewCoverage,
        noSnippetWords === undefined ? 'unknown' : noSnippetWords > 0 ? 'present' : 'none'
      )
    );

    const contentCoverage = coverage?.answerContent;
    const answerContent = match.answerContent;
    add(
      page,
      'answer-content',
      'questionHeadings',
      measuredState(contentCoverage, presentState(answerContent?.questionHeadings))
    );
    add(
      page,
      'answer-content',
      'conciseAnswerBlocks',
      measuredState(contentCoverage, presentState(answerContent?.conciseAnswerBlocks))
    );
    add(
      page,
      'answer-content',
      'visibleAuthor',
      measuredState(contentCoverage, booleanState(answerContent?.visibleAuthor))
    );
    add(
      page,
      'answer-content',
      'visibleDate',
      measuredState(contentCoverage, booleanState(answerContent?.visibleDate))
    );

    const renderedCoverage = coverage?.sourceRenderedContent;
    const rendered = match.sourceRenderedContent;
    let phraseCoverageState = 'unknown';
    if (rendered?.assessed === false) phraseCoverageState = 'not-assessed';
    else if (typeof rendered?.renderedPhraseCoveragePercent === 'number') {
      const score = rendered.renderedPhraseCoveragePercent;
      phraseCoverageState =
        score === 100
          ? '100%'
          : score >= 75
            ? '75-99.9%'
            : score >= 50
              ? '50-74.9%'
              : score >= 25
                ? '25-49.9%'
                : score > 0
                  ? '0.1-24.9%'
                  : '0%';
    }
    add(
      page,
      'source-rendered-content',
      'renderedPhraseCoveragePercent',
      measuredState(renderedCoverage, phraseCoverageState)
    );

    const evidenceCoverage = coverage?.citationEvidence;
    add(
      page,
      'citation-evidence',
      'externalSourceLinkCount',
      measuredState(evidenceCoverage, presentState(match.citationEvidence?.externalSourceLinkCount))
    );
    add(
      page,
      'citation-evidence',
      'referenceSectionLinkCount',
      measuredState(
        evidenceCoverage,
        presentState(match.citationEvidence?.referenceSectionLinkCount)
      )
    );
    add(
      page,
      'citation-evidence',
      'unresolvedInlineCitationTargetCount',
      measuredState(
        evidenceCoverage,
        presentState(match.citationEvidence?.unresolvedInlineCitationTargetCount)
      )
    );
  }

  const rows = [...buckets.values()].sort(
    (left, right) =>
      right.citationEvents - left.citationEvents ||
      left.signal.localeCompare(right.signal) ||
      left.dimension.localeCompare(right.dimension) ||
      left.state.localeCompare(right.state)
  );
  return {
    rows: rows.slice(0, MAX_RETURNED_AUDIT_SIGNAL_ROWS),
    truncated: rows.length > MAX_RETURNED_AUDIT_SIGNAL_ROWS,
  };
}

/** Attach current GEO audit observations to retained cited URLs using exact URL then unique-canonical matching. */
export function correlateAiAnswerCitationObservationsWithAudit(
  report: AiAnswerCitationObservationReport,
  audit: SiteWideGeoAnalysis
): AiAnswerCitationObservationReport {
  const exactPages = new Map<string, SiteWideGeoPageSummary[]>();
  const canonicalPages = new Map<string, Map<string, SiteWideGeoPageSummary[]>>();
  for (const page of audit.pageSummaries) {
    const exactKey = normalizeAuditUrl(page.url);
    if (exactKey) {
      const exactMatches = exactPages.get(exactKey) ?? [];
      exactMatches.push(page);
      exactPages.set(exactKey, exactMatches);
    }
    const canonicalKey = page.canonicalUrl ? normalizeAuditUrl(page.canonicalUrl) : undefined;
    if (canonicalKey && exactKey) {
      const aliases =
        canonicalPages.get(canonicalKey) ?? new Map<string, SiteWideGeoPageSummary[]>();
      const aliasPages = aliases.get(exactKey) ?? [];
      aliasPages.push(page);
      aliases.set(exactKey, aliasPages);
      canonicalPages.set(canonicalKey, aliases);
    }
  }
  const toContext = (
    page: SiteWideGeoPageSummary,
    state: 'exact-url' | 'unique-canonical'
  ): AiAnswerCitationAuditPageMatch => ({
    state,
    auditUrl: page.url,
    geoAssessed: page.geoAssessed,
    signalCoverage: page.signalCoverage,
    ...(page.searchCrawlerAccess
      ? {
          searchCrawlerAccess: page.searchCrawlerAccess
            .slice(0, 20)
            .map(({ token, allowed }) => ({ token, allowed })),
        }
      : {}),
    ...(page.dataUseCrawlerPolicy
      ? {
          dataUseCrawlerPolicy: page.dataUseCrawlerPolicy
            .slice(0, 20)
            .map(({ token, allowed }) => ({ token, allowed })),
        }
      : {}),
    ...(page.userInitiatedFetchAccess
      ? {
          userInitiatedFetchAccess: page.userInitiatedFetchAccess
            .slice(0, 20)
            .map(({ token, allowed }) => ({ token, allowed })),
        }
      : {}),
    ...(page.previewControls
      ? {
          previewControls: {
            ...(typeof page.previewControls.noindex === 'boolean'
              ? { noindex: page.previewControls.noindex }
              : {}),
            ...(typeof page.previewControls.noSnippet === 'boolean'
              ? { noSnippet: page.previewControls.noSnippet }
              : {}),
            ...(typeof page.previewControls.maxSnippetZero === 'boolean'
              ? { maxSnippetZero: page.previewControls.maxSnippetZero }
              : {}),
            ...(typeof page.previewControls.dataNoSnippetWords === 'number'
              ? { dataNoSnippetWords: page.previewControls.dataNoSnippetWords }
              : {}),
          },
        }
      : {}),
    ...(page.answerContent
      ? {
          answerContent: {
            ...(typeof page.answerContent.questionHeadings === 'number'
              ? { questionHeadings: page.answerContent.questionHeadings }
              : {}),
            ...(typeof page.answerContent.conciseAnswerBlocks === 'number'
              ? { conciseAnswerBlocks: page.answerContent.conciseAnswerBlocks }
              : {}),
            ...(typeof page.answerContent.externalContentLinks === 'number'
              ? { externalContentLinks: page.answerContent.externalContentLinks }
              : {}),
            ...(typeof page.answerContent.visibleAuthor === 'boolean'
              ? { visibleAuthor: page.answerContent.visibleAuthor }
              : {}),
            ...(typeof page.answerContent.visibleDate === 'boolean'
              ? { visibleDate: page.answerContent.visibleDate }
              : {}),
            ...(typeof page.answerContent.documentLanguage === 'string'
              ? { documentLanguage: page.answerContent.documentLanguage }
              : {}),
            ...(page.answerContent.schemaDateModifiedDays
              ? { schemaDateModifiedDays: page.answerContent.schemaDateModifiedDays.slice(0, 10) }
              : {}),
            ...(typeof page.answerContent.schemaDateModifiedDaysTruncated === 'boolean'
              ? {
                  schemaDateModifiedDaysTruncated:
                    page.answerContent.schemaDateModifiedDaysTruncated,
                }
              : {}),
            ...(typeof page.answerContent.schemaDateModifiedHasNonDateValue === 'boolean'
              ? {
                  schemaDateModifiedHasNonDateValue:
                    page.answerContent.schemaDateModifiedHasNonDateValue,
                }
              : {}),
          },
        }
      : {}),
    ...(page.sourceRenderedContent
      ? {
          sourceRenderedContent: {
            assessed: page.sourceRenderedContent.assessed,
            ...(typeof page.sourceRenderedContent.renderedPhraseCoveragePercent === 'number' ||
            page.sourceRenderedContent.renderedPhraseCoveragePercent === null
              ? {
                  renderedPhraseCoveragePercent:
                    page.sourceRenderedContent.renderedPhraseCoveragePercent,
                }
              : {}),
            ...(typeof page.sourceRenderedContent.sourceWordCount === 'number'
              ? { sourceWordCount: page.sourceRenderedContent.sourceWordCount }
              : {}),
            ...(typeof page.sourceRenderedContent.renderedWordCount === 'number'
              ? { renderedWordCount: page.sourceRenderedContent.renderedWordCount }
              : {}),
            ...(typeof page.sourceRenderedContent.sharedRenderedPhraseCount === 'number'
              ? { sharedRenderedPhraseCount: page.sourceRenderedContent.sharedRenderedPhraseCount }
              : {}),
            ...(typeof page.sourceRenderedContent.renderedOnlyPhraseCount === 'number'
              ? { renderedOnlyPhraseCount: page.sourceRenderedContent.renderedOnlyPhraseCount }
              : {}),
          },
        }
      : {}),
    ...(page.citationEvidence
      ? {
          citationEvidence: {
            ...(typeof page.citationEvidence.externalSourceLinkCount === 'number'
              ? { externalSourceLinkCount: page.citationEvidence.externalSourceLinkCount }
              : {}),
            ...(typeof page.citationEvidence.referenceSectionLinkCount === 'number'
              ? { referenceSectionLinkCount: page.citationEvidence.referenceSectionLinkCount }
              : {}),
            ...(typeof page.citationEvidence.unresolvedInlineCitationTargetCount === 'number'
              ? {
                  unresolvedInlineCitationTargetCount:
                    page.citationEvidence.unresolvedInlineCitationTargetCount,
                }
              : {}),
          },
        }
      : {}),
  });

  let exactUrlMatches = 0;
  let uniqueCanonicalMatches = 0;
  let ambiguousAuditUrlMatches = 0;
  let ambiguousCanonicalMatches = 0;
  let unmatchedCitedUrls = 0;
  let matchedCitationEvents = 0;
  const citedPages = report.citedPages.map((citedPage) => {
    const key = normalizeAuditUrl(citedPage.url);
    const exactMatches = key ? exactPages.get(key) : undefined;
    if (exactMatches?.length === 1) {
      exactUrlMatches += 1;
      matchedCitationEvents += citedPage.citationEvents;
      return { ...citedPage, auditMatch: toContext(exactMatches[0]!, 'exact-url') };
    }
    if (exactMatches && exactMatches.length > 1) {
      ambiguousAuditUrlMatches += 1;
      return { ...citedPage, auditMatch: { state: 'ambiguous-audit-url' as const } };
    }
    const canonicalMatches = key ? canonicalPages.get(key) : undefined;
    const canonicalPagesForKey = canonicalMatches ? [...canonicalMatches.values()].flat() : [];
    if (canonicalPagesForKey.length === 1) {
      uniqueCanonicalMatches += 1;
      matchedCitationEvents += citedPage.citationEvents;
      return { ...citedPage, auditMatch: toContext(canonicalPagesForKey[0]!, 'unique-canonical') };
    }
    if (canonicalMatches && canonicalPagesForKey.length > 1) {
      if (canonicalMatches.size === 1) {
        ambiguousAuditUrlMatches += 1;
        return { ...citedPage, auditMatch: { state: 'ambiguous-audit-url' as const } };
      }
      ambiguousCanonicalMatches += 1;
      return { ...citedPage, auditMatch: { state: 'ambiguous-canonical' as const } };
    }
    unmatchedCitedUrls += 1;
    return { ...citedPage, auditMatch: { state: 'not-found' as const } };
  });
  const citedPagesWithDateAlignment = citedPages.map((citedPage): AiAnswerCitationPageProfile => {
    const answerContent = citedPage.auditMatch?.answerContent;
    if (!answerContent) return citedPage;
    const schemaDateModifiedDays = (answerContent.schemaDateModifiedDays ?? [])
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
      .sort();
    const latestSchemaDateModifiedDay = schemaDateModifiedDays[schemaDateModifiedDays.length - 1];
    const auditTime = Date.parse(audit.auditTimestamp);
    const citationTime = Date.parse(citedPage.lastObservedAt);
    const auditDay = Number.isFinite(auditTime)
      ? new Date(auditTime).toISOString().slice(0, 10)
      : undefined;
    let state: AiAnswerCitationDateModifiedAlignment['state'] = 'no-valid-schema-date';
    let daysFromLastCitationObservationToSchemaDateModified: number | null | undefined;
    if (
      latestSchemaDateModifiedDay &&
      Number.isFinite(citationTime) &&
      Number.isFinite(auditTime) &&
      auditTime < citationTime
    ) {
      state = 'audit-predates-citation-sample';
    } else if (latestSchemaDateModifiedDay && auditDay && latestSchemaDateModifiedDay > auditDay) {
      state = 'date-after-audit-snapshot';
    } else if (latestSchemaDateModifiedDay && Number.isFinite(citationTime)) {
      state = 'compared';
      const citationDay = new Date(citationTime).toISOString().slice(0, 10);
      daysFromLastCitationObservationToSchemaDateModified = Math.round(
        (Date.parse(`${latestSchemaDateModifiedDay}T00:00:00.000Z`) -
          Date.parse(`${citationDay}T00:00:00.000Z`)) /
          86_400_000
      );
    }
    return {
      ...citedPage,
      dateModifiedAlignment: {
        state,
        auditTimestamp: audit.auditTimestamp,
        lastCitationObservedAt: citedPage.lastObservedAt,
        schemaDateModifiedDays,
        ...(latestSchemaDateModifiedDay ? { latestSchemaDateModifiedDay } : {}),
        ...(daysFromLastCitationObservationToSchemaDateModified === undefined
          ? {}
          : { daysFromLastCitationObservationToSchemaDateModified }),
        schemaDateModifiedDaysTruncated: answerContent.schemaDateModifiedDaysTruncated ?? false,
        schemaDateModifiedHasNonDateValue: answerContent.schemaDateModifiedHasNonDateValue ?? false,
      },
    };
  });
  const signals = auditSignalBreakdown(citedPagesWithDateAlignment, report.ownedDomains);
  return {
    ...report,
    citedPages: citedPagesWithDateAlignment,
    auditSignalBreakdown: signals.rows,
    auditSignalBreakdownTruncated: signals.truncated,
    auditCorrelation: {
      auditTimestamp: audit.auditTimestamp,
      citedUrlsReviewed: report.citedPages.length,
      citedUrlsTruncated: report.citedPagesTruncated,
      exactUrlMatches,
      uniqueCanonicalMatches,
      ambiguousAuditUrlMatches,
      ambiguousCanonicalMatches,
      unmatchedCitedUrls,
      matchedCitationEvents,
      note: 'Cited URLs are matched to exact audited URLs first, then to a single audit page that declares the cited URL as canonical. Ambiguous canonical targets remain unmatched. Controls and page profiles come from the supplied audit snapshot and may postdate the answer observation; the association does not explain why a page was cited.',
    },
  };
}

/** Join retained cited-page paths with locally summarized AI crawler log paths on an exact origin/path basis. */
export function correlateAiAnswerCitationObservationsWithCrawlerLogs(
  report: AiAnswerCitationObservationReport,
  analyses: AiCrawlerAccessLogAnalysis[],
  originInput: string
): AiAnswerCitationObservationReport {
  if (
    report.source !== 'Aviary observed AI answer citation analysis' ||
    report.schemaVersion !== 1
  ) {
    throw new Error('Crawler-log correlation requires a version 1 Aviary answer-citation report.');
  }
  if (analyses.length < 1 || analyses.length > MAX_CRAWLER_LOG_ANALYSES_FOR_CITATION_JOIN) {
    throw new Error(
      `Crawler-log correlation requires 1 to ${MAX_CRAWLER_LOG_ANALYSES_FOR_CITATION_JOIN} report analyses.`
    );
  }
  let siteOrigin: string;
  try {
    const url = new URL(originInput);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'origin must be an HTTP(S) origin without credentials, path, query, or fragment.'
      );
    }
    siteOrigin = url.origin;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('origin must')) throw error;
    throw new Error('Crawler-log correlation origin must be a valid HTTP(S) origin.');
  }
  const pathsByUrl = new Map<string, AiAnswerCitationCrawlerLogMatch[]>();
  const crawlerTokens = new Set<string>();
  let crawlerPathsTruncated = false;
  analyses.forEach((analysis, logIndex) => {
    if (
      analysis.source !== 'Aviary AI crawler access log analysis' ||
      analysis.schemaVersion !== 1 ||
      !Array.isArray(analysis.crawlers)
    ) {
      throw new Error(
        `Crawler log report ${logIndex + 1} is not a version 1 Aviary crawler analysis.`
      );
    }
    for (const crawler of analysis.crawlers) {
      crawlerTokens.add(crawler.token.toLowerCase());
      crawlerPathsTruncated ||= crawler.pathsTruncated;
      for (const path of crawler.paths) {
        let url: URL;
        try {
          url = new URL(path.path, siteOrigin);
        } catch {
          continue;
        }
        if (url.origin !== siteOrigin || !['http:', 'https:'].includes(url.protocol)) continue;
        const pageUrl = `${url.origin}${url.pathname}`;
        const matches = pathsByUrl.get(pageUrl) ?? [];
        matches.push({
          logIndex: logIndex + 1,
          crawlerToken: crawler.token,
          provider: crawler.provider,
          activity: crawler.activity,
          requests: path.requests,
          successfulResponses: path.successfulResponses,
          redirects: path.redirects,
          clientErrors: path.clientErrors,
          serverErrors: path.serverErrors,
          ...(path.firstSeenAt ? { firstSeenAt: path.firstSeenAt } : {}),
          ...(path.lastSeenAt ? { lastSeenAt: path.lastSeenAt } : {}),
          ...(path.daysBeforeLatestRequest === undefined
            ? {}
            : { daysBeforeLatestRequest: path.daysBeforeLatestRequest }),
        });
        pathsByUrl.set(pageUrl, matches);
      }
    }
  });
  let citedPagesWithCrawlerRequests = 0;
  let citationEventsOnObservedPaths = 0;
  const citationEventsInRetainedPages = report.citedPages.reduce(
    (sum, page) => sum + page.citationEvents,
    0
  );
  const citedPages = report.citedPages.map((page) => {
    const matches = pathsByUrl.get(page.url) ?? [];
    if (matches.length > 0) {
      citedPagesWithCrawlerRequests += 1;
      citationEventsOnObservedPaths += page.citationEvents;
    }
    const orderedMatches = [...matches]
      .sort(
        (left, right) =>
          right.requests - left.requests ||
          left.crawlerToken.localeCompare(right.crawlerToken) ||
          left.logIndex - right.logIndex
      )
      .map((match): AiAnswerCitationCrawlerLogMatch => {
        const crawlerFirst = match.firstSeenAt ? Date.parse(match.firstSeenAt) : Number.NaN;
        const crawlerLast = match.lastSeenAt ? Date.parse(match.lastSeenAt) : Number.NaN;
        const citationFirst = Date.parse(page.firstObservedAt);
        const citationLast = Date.parse(page.lastObservedAt);
        const datesAreValid = [crawlerFirst, crawlerLast, citationFirst, citationLast].every(
          Number.isFinite
        );
        const temporalRelation = !datesAreValid
          ? 'unknown'
          : crawlerLast < citationFirst
            ? 'crawler-before-citation-sample'
            : crawlerFirst > citationLast
              ? 'crawler-after-citation-sample'
              : 'observed-ranges-overlap';
        return {
          ...match,
          temporalRelation,
          ...(Number.isFinite(crawlerLast) && Number.isFinite(citationLast)
            ? {
                daysFromLatestCitationToLastRequest: Number(
                  ((crawlerLast - citationLast) / 86_400_000).toFixed(2)
                ),
              }
            : {}),
        };
      });
    return {
      ...page,
      crawlerLogState:
        matches.length > 0 ? ('path-observed' as const) : ('path-not-observed' as const),
      crawlerLogMatches: orderedMatches.slice(0, MAX_CRAWLER_MATCHES_PER_CITED_PAGE),
      crawlerLogMatchesTruncated: orderedMatches.length > MAX_CRAWLER_MATCHES_PER_CITED_PAGE,
    };
  });
  return {
    ...report,
    citedPages,
    crawlerLogCorrelation: {
      origin: siteOrigin,
      logAnalyses: analyses.length,
      uniqueCrawlerTokens: crawlerTokens.size,
      citedPagesReviewed: report.citedPages.length,
      citedPagesWithCrawlerRequests,
      citationEventsInRetainedPages,
      citationEventsOnObservedPaths,
      citedPagePathCoveragePercent:
        report.citedPages.length > 0
          ? Number(((citedPagesWithCrawlerRequests / report.citedPages.length) * 100).toFixed(2))
          : null,
      retainedCitationEventCoveragePercent:
        citationEventsInRetainedPages > 0
          ? Number(
              ((citationEventsOnObservedPaths / citationEventsInRetainedPages) * 100).toFixed(2)
            )
          : null,
      citedPagesTruncated: report.citedPagesTruncated,
      crawlerPathsTruncated,
      note: 'Cited pages are joined only when their normalized origin and path match a retained crawler-log request path exactly; query strings and fragments are ignored. The supplied log report can overlap periods or omit truncated paths. “Path not observed” is not evidence of a robots block, provider ineligibility, or a failed fetch. User-agent tokens are claims in logged headers and are not authenticated identities.',
    },
  };
}

interface NormalizedObservation {
  observedAt: string;
  provider: string;
  providerKey: string;
  prompt: string;
  promptKey: string;
  topic?: string;
  topicKey?: string;
  intent?: string;
  intentKey?: string;
  model?: string;
  modelKey?: string;
  surface?: string;
  surfaceKey?: string;
  locale?: string;
  localeKey?: string;
  answerText?: string;
  answerWordCount?: number;
  citationListComplete: boolean;
  citations: Array<{ url: string; domain: string; position: number }>;
}

interface ExecutionContextAccumulator {
  provider: string;
  model?: string;
  surface?: string;
  locale?: string;
  topic?: string;
  intent?: string;
  unlabeledTopicIntent: boolean;
  observations: number;
  prompts: Map<
    string,
    {
      observations: number;
      observationsWithCitations: number;
      observationsWithOwnedCitation: number;
    }
  >;
  observationsWithCitations: number;
  citationEvents: number;
  firstObservedAt: string;
  lastObservedAt: string;
  observationsWithOwnedCitation: number;
}

interface ExecutionContextMonthlyAccumulator extends ExecutionContextAccumulator {
  month: string;
  contextKey: string;
}

function executionContextKey(observation: NormalizedObservation): string {
  return JSON.stringify([
    observation.providerKey,
    observation.modelKey ?? null,
    observation.surfaceKey ?? null,
    observation.localeKey ?? null,
    observation.topicKey ?? null,
    observation.intentKey ?? null,
  ]);
}

function createExecutionContextAccumulator(
  observation: NormalizedObservation
): ExecutionContextAccumulator {
  return {
    provider: observation.provider,
    ...(observation.model ? { model: observation.model } : {}),
    ...(observation.surface ? { surface: observation.surface } : {}),
    ...(observation.locale ? { locale: observation.locale } : {}),
    ...(observation.topic ? { topic: observation.topic } : {}),
    ...(observation.intent ? { intent: observation.intent } : {}),
    unlabeledTopicIntent: observation.topicKey === undefined && observation.intentKey === undefined,
    observations: 0,
    prompts: new Map(),
    observationsWithCitations: 0,
    citationEvents: 0,
    firstObservedAt: observation.observedAt,
    lastObservedAt: observation.observedAt,
    observationsWithOwnedCitation: 0,
  };
}

function addExecutionContextObservation(
  bucket: ExecutionContextAccumulator,
  observation: NormalizedObservation,
  ownedDomains: string[]
): void {
  bucket.observations += 1;
  const hasCitation = observation.citations.length > 0;
  const hasOwnedCitation =
    ownedDomains.length > 0 &&
    observation.citations.some((citation) => isOwnedDomain(citation.domain, ownedDomains));
  const promptBucket = bucket.prompts.get(observation.promptKey) ?? {
    observations: 0,
    observationsWithCitations: 0,
    observationsWithOwnedCitation: 0,
  };
  promptBucket.observations += 1;
  if (hasCitation) {
    bucket.observationsWithCitations += 1;
    promptBucket.observationsWithCitations += 1;
  }
  bucket.citationEvents += observation.citations.length;
  if (hasOwnedCitation) {
    bucket.observationsWithOwnedCitation += 1;
    promptBucket.observationsWithOwnedCitation += 1;
  }
  bucket.prompts.set(observation.promptKey, promptBucket);
  if (observation.observedAt < bucket.firstObservedAt)
    bucket.firstObservedAt = observation.observedAt;
  if (observation.observedAt > bucket.lastObservedAt)
    bucket.lastObservedAt = observation.observedAt;
}

function executionContextProfileFromAccumulator(
  bucket: ExecutionContextAccumulator,
  ownedDomainsConfigured: boolean
): AiAnswerCitationExecutionContextProfile {
  const prompts = [...bucket.prompts.values()];
  const promptsWithCitations = prompts.filter(
    (prompt) => prompt.observationsWithCitations > 0
  ).length;
  const equalPromptMeanCitationCoveragePercent =
    prompts.length > 0
      ? Number(
          (
            (prompts.reduce(
              (sum, prompt) => sum + prompt.observationsWithCitations / prompt.observations,
              0
            ) /
              prompts.length) *
            100
          ).toFixed(2)
        )
      : 0;
  const promptsWithOwnedCitation = prompts.filter(
    (prompt) => prompt.observationsWithOwnedCitation > 0
  ).length;
  const equalPromptMeanOwnedCitationCoveragePercent =
    prompts.length > 0
      ? Number(
          (
            (prompts.reduce(
              (sum, prompt) => sum + prompt.observationsWithOwnedCitation / prompt.observations,
              0
            ) /
              prompts.length) *
            100
          ).toFixed(2)
        )
      : 0;
  return {
    provider: bucket.provider,
    ...(bucket.model ? { model: bucket.model } : {}),
    ...(bucket.surface ? { surface: bucket.surface } : {}),
    ...(bucket.locale ? { locale: bucket.locale } : {}),
    ...(bucket.topic ? { topic: bucket.topic } : {}),
    ...(bucket.intent ? { intent: bucket.intent } : {}),
    unlabeledTopicIntent: bucket.unlabeledTopicIntent,
    observations: bucket.observations,
    uniquePrompts: bucket.prompts.size,
    observationsWithCitations: bucket.observationsWithCitations,
    citationCoveragePercent: Number(
      ((bucket.observationsWithCitations / bucket.observations) * 100).toFixed(2)
    ),
    citationCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
      bucket.observationsWithCitations,
      bucket.observations
    ),
    promptsWithCitations,
    promptCitationReachPercent: Number(((promptsWithCitations / prompts.length) * 100).toFixed(2)),
    promptCitationReachConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
      promptsWithCitations,
      prompts.length
    ),
    equalPromptMeanCitationCoveragePercent,
    citationEvents: bucket.citationEvents,
    firstObservedAt: bucket.firstObservedAt,
    lastObservedAt: bucket.lastObservedAt,
    ...(ownedDomainsConfigured
      ? {
          observationsWithOwnedCitation: bucket.observationsWithOwnedCitation,
          ownedCitationCoveragePercent: Number(
            ((bucket.observationsWithOwnedCitation / bucket.observations) * 100).toFixed(2)
          ),
          ownedCitationCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
            bucket.observationsWithOwnedCitation,
            bucket.observations
          ),
          promptsWithOwnedCitation,
          ownedPromptCitationReachPercent: Number(
            ((promptsWithOwnedCitation / prompts.length) * 100).toFixed(2)
          ),
          ownedPromptCitationReachConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
            promptsWithOwnedCitation,
            prompts.length
          ),
          equalPromptMeanOwnedCitationCoveragePercent,
        }
      : {}),
  };
}

interface NormalizedAnswerEntity {
  entity: string;
  aliases: string[];
  occurrenceMatcher: RegExp;
}

function findEntityMentionOffsets(
  answerText: string,
  definition: NormalizedAnswerEntity
): number[] {
  const offsets: number[] = [];
  definition.occurrenceMatcher.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = definition.occurrenceMatcher.exec(answerText)) !== null) {
    offsets.push(match.index);
    if (match[0].length === 0) definition.occurrenceMatcher.lastIndex += 1;
  }
  return offsets;
}

function characterPositionPercent(answerText: string, offset: number): number {
  const characterCount = Array.from(answerText).length;
  return characterCount > 0
    ? (Array.from(answerText.slice(0, offset)).length / characterCount) * 100
    : 0;
}

function countAnswerWords(answerText: string): number {
  return answerText.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function answerLengthBand(wordCount: number): {
  band: AiAnswerCitationAnswerLengthBand;
  minimum: number;
  maximum: number | null;
} {
  if (wordCount < 100) return { band: '0-99', minimum: 0, maximum: 99 };
  if (wordCount < 300) return { band: '100-299', minimum: 100, maximum: 299 };
  if (wordCount < 600) return { band: '300-599', minimum: 300, maximum: 599 };
  if (wordCount < 1_000) return { band: '600-999', minimum: 600, maximum: 999 };
  return { band: '1000-plus', minimum: 1_000, maximum: null };
}

function buildAnswerLengthMonthlyProfiles(
  observations: NormalizedObservation[],
  ownedDomains: string[]
): {
  profiles: Array<AiAnswerCitationAnswerLengthProfile & { month: string }>;
  truncated: boolean;
} {
  const answerLengthContextCounts = new Map<
    string,
    {
      month: string;
      provider: string;
      providerKey: string;
      model?: string;
      modelKey?: string;
      surface?: string;
      surfaceKey?: string;
      locale?: string;
      localeKey?: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      observations: number;
      answerTextObservations: number;
    }
  >();
  const answerLengthBuckets = new Map<
    string,
    {
      month: string;
      contextKey: string;
      provider: string;
      model?: string;
      surface?: string;
      locale?: string;
      topic?: string;
      intent?: string;
      unlabeledTopicIntent: boolean;
      lengthBand: AiAnswerCitationAnswerLengthBand;
      minimumAnswerWords: number;
      maximumAnswerWords: number | null;
      prompts: Map<
        string,
        {
          observations: number;
          citations: number;
          ownedCitations: number;
          citationEvents: number;
          ownedCitationEvents: number;
          ownedFirstPositionCitationEvents: number;
          ownedTopThreeCitationEvents: number;
          ownedFirstCitationReciprocalRankSum: number;
          totalAnswerWords: number;
        }
      >;
      observations: number;
      observationsWithCitations: number;
      observationsWithOwnedCitation: number;
      citationEvents: number;
      ownedCitationEvents: number;
      ownedFirstPositionCitationEvents: number;
      ownedTopThreeCitationEvents: number;
      ownedFirstCitationReciprocalRankSum: number;
      totalAnswerWords: number;
      answerWordCounts: number[];
      firstObservedAt: string;
      lastObservedAt: string;
    }
  >();
  let answerLengthProfilesTruncated = false;
  for (const observation of observations) {
    const month = observation.observedAt.slice(0, 7);
    const contextKey = JSON.stringify([
      month,
      observation.providerKey,
      observation.modelKey ?? '',
      observation.surfaceKey ?? '',
      observation.localeKey ?? '',
      observation.topicKey ?? '',
      observation.intentKey ?? '',
    ]);
    let context = answerLengthContextCounts.get(contextKey);
    if (!context && answerLengthContextCounts.size < MAX_ANSWER_LENGTH_PROFILE_WORKING_ROWS) {
      context = {
        month,
        provider: observation.provider,
        providerKey: observation.providerKey,
        ...(observation.model === undefined
          ? {}
          : { model: observation.model, modelKey: observation.modelKey }),
        ...(observation.surface === undefined
          ? {}
          : { surface: observation.surface, surfaceKey: observation.surfaceKey }),
        ...(observation.locale === undefined
          ? {}
          : { locale: observation.locale, localeKey: observation.localeKey }),
        ...(observation.topic === undefined
          ? {}
          : { topic: observation.topic, topicKey: observation.topicKey }),
        ...(observation.intent === undefined
          ? {}
          : { intent: observation.intent, intentKey: observation.intentKey }),
        observations: 0,
        answerTextObservations: 0,
      };
      answerLengthContextCounts.set(contextKey, context);
    }
    if (!context) {
      answerLengthProfilesTruncated = true;
      continue;
    }
    context.observations += 1;
    if (observation.answerText === undefined) continue;
    context.answerTextObservations += 1;
    const wordCount = observation.answerWordCount ?? 0;
    const band = answerLengthBand(wordCount);
    const key = JSON.stringify([contextKey, band.band]);
    let bucket = answerLengthBuckets.get(key);
    if (!bucket && answerLengthBuckets.size < MAX_ANSWER_LENGTH_PROFILE_WORKING_ROWS) {
      bucket = {
        month,
        contextKey,
        provider: context.provider,
        ...(context.model === undefined ? {} : { model: context.model }),
        ...(context.surface === undefined ? {} : { surface: context.surface }),
        ...(context.locale === undefined ? {} : { locale: context.locale }),
        ...(context.topic === undefined ? {} : { topic: context.topic }),
        ...(context.intent === undefined ? {} : { intent: context.intent }),
        unlabeledTopicIntent: context.topic === undefined && context.intent === undefined,
        lengthBand: band.band,
        minimumAnswerWords: band.minimum,
        maximumAnswerWords: band.maximum,
        prompts: new Map(),
        observations: 0,
        observationsWithCitations: 0,
        observationsWithOwnedCitation: 0,
        citationEvents: 0,
        ownedCitationEvents: 0,
        ownedFirstPositionCitationEvents: 0,
        ownedTopThreeCitationEvents: 0,
        ownedFirstCitationReciprocalRankSum: 0,
        totalAnswerWords: 0,
        answerWordCounts: [],
        firstObservedAt: observation.observedAt,
        lastObservedAt: observation.observedAt,
      };
      answerLengthBuckets.set(key, bucket);
    }
    if (!bucket) {
      answerLengthProfilesTruncated = true;
      continue;
    }
    const ownedCitations = observation.citations.filter(({ domain }) =>
      isOwnedDomain(domain, ownedDomains)
    );
    const ownedCitationEvents = ownedCitations.length;
    const ownedFirstPositionCitationEvents = ownedCitations.filter(
      ({ position }) => position === 1
    ).length;
    const ownedTopThreeCitationEvents = ownedCitations.filter(
      ({ position }) => position <= 3
    ).length;
    const ownedFirstCitationReciprocalRank =
      ownedCitations.length > 0
        ? 1 /
          ownedCitations.reduce(
            (firstPosition, citation) => Math.min(firstPosition, citation.position),
            Number.POSITIVE_INFINITY
          )
        : 0;
    bucket.observations += 1;
    bucket.observationsWithCitations += Number(observation.citations.length > 0);
    bucket.observationsWithOwnedCitation += Number(ownedCitationEvents > 0);
    bucket.citationEvents += observation.citations.length;
    bucket.ownedCitationEvents += ownedCitationEvents;
    bucket.ownedFirstPositionCitationEvents += ownedFirstPositionCitationEvents;
    bucket.ownedTopThreeCitationEvents += ownedTopThreeCitationEvents;
    bucket.ownedFirstCitationReciprocalRankSum += ownedFirstCitationReciprocalRank;
    bucket.totalAnswerWords += wordCount;
    bucket.answerWordCounts.push(wordCount);
    if (observation.observedAt < bucket.firstObservedAt)
      bucket.firstObservedAt = observation.observedAt;
    if (observation.observedAt > bucket.lastObservedAt)
      bucket.lastObservedAt = observation.observedAt;
    const prompt = bucket.prompts.get(observation.promptKey) ?? {
      observations: 0,
      citations: 0,
      ownedCitations: 0,
      citationEvents: 0,
      ownedCitationEvents: 0,
      ownedFirstPositionCitationEvents: 0,
      ownedTopThreeCitationEvents: 0,
      ownedFirstCitationReciprocalRankSum: 0,
      totalAnswerWords: 0,
    };
    prompt.observations += 1;
    prompt.citations += Number(observation.citations.length > 0);
    prompt.ownedCitations += Number(ownedCitationEvents > 0);
    prompt.citationEvents += observation.citations.length;
    prompt.ownedCitationEvents += ownedCitationEvents;
    prompt.ownedFirstPositionCitationEvents += ownedFirstPositionCitationEvents;
    prompt.ownedTopThreeCitationEvents += ownedTopThreeCitationEvents;
    prompt.ownedFirstCitationReciprocalRankSum += ownedFirstCitationReciprocalRank;
    prompt.totalAnswerWords += wordCount;
    bucket.prompts.set(observation.promptKey, prompt);
  }
  const answerLengthProfiles: Array<AiAnswerCitationAnswerLengthProfile & { month: string }> = [
    ...answerLengthBuckets.values(),
  ]
    .map((bucket) => {
      const context = answerLengthContextCounts.get(bucket.contextKey)!;
      const prompts = [...bucket.prompts.values()];
      const promptsWithCitations = prompts.filter(({ citations }) => citations > 0).length;
      const promptsWithOwnedCitation = prompts.filter(
        ({ ownedCitations }) => ownedCitations > 0
      ).length;
      const promptsWithOwnedCitationEvents = prompts.filter(
        ({ ownedCitationEvents }) => ownedCitationEvents > 0
      );
      const ownedFirstPositionPromptShares = promptsWithOwnedCitationEvents.map(
        ({ ownedFirstPositionCitationEvents, ownedCitationEvents }) =>
          (ownedFirstPositionCitationEvents / ownedCitationEvents) * 100
      );
      const ownedTopThreePromptShares = promptsWithOwnedCitationEvents.map(
        ({ ownedTopThreeCitationEvents, ownedCitationEvents }) =>
          (ownedTopThreeCitationEvents / ownedCitationEvents) * 100
      );
      const ownedFirstCitationPromptMrrValues = prompts
        .filter(({ ownedCitations }) => ownedCitations > 0)
        .map(
          ({ ownedFirstCitationReciprocalRankSum, ownedCitations }) =>
            (ownedFirstCitationReciprocalRankSum / ownedCitations) * 100
        );
      const promptDensityValues = prompts
        .filter(({ totalAnswerWords }) => totalAnswerWords > 0)
        .map(({ citationEvents, totalAnswerWords }) => (citationEvents / totalAnswerWords) * 100);
      const ownedPromptDensityValues = prompts
        .filter(({ totalAnswerWords }) => totalAnswerWords > 0)
        .map(
          ({ ownedCitationEvents, totalAnswerWords }) =>
            (ownedCitationEvents / totalAnswerWords) * 100
        );
      const metricSeed = JSON.stringify([
        bucket.month,
        bucket.provider,
        bucket.model ?? '',
        bucket.surface ?? '',
        bucket.locale ?? '',
        bucket.topic ?? '',
        bucket.intent ?? '',
        bucket.lengthBand,
      ]);
      return {
        month: bucket.month,
        provider: bucket.provider,
        ...(bucket.model === undefined ? {} : { model: bucket.model }),
        ...(bucket.surface === undefined ? {} : { surface: bucket.surface }),
        ...(bucket.locale === undefined ? {} : { locale: bucket.locale }),
        ...(bucket.topic === undefined ? {} : { topic: bucket.topic }),
        ...(bucket.intent === undefined ? {} : { intent: bucket.intent }),
        unlabeledTopicIntent: bucket.unlabeledTopicIntent,
        lengthBand: bucket.lengthBand,
        minimumAnswerWords: bucket.minimumAnswerWords,
        maximumAnswerWords: bucket.maximumAnswerWords,
        contextObservations: context.observations,
        answerTextObservationsInContext: context.answerTextObservations,
        answerTextShareInContextPercent: Number(
          ((context.answerTextObservations / context.observations) * 100).toFixed(2)
        ),
        observations: bucket.observations,
        uniquePrompts: prompts.length,
        observationsWithCitations: bucket.observationsWithCitations,
        citationCoveragePercent: Number(
          ((bucket.observationsWithCitations / bucket.observations) * 100).toFixed(2)
        ),
        citationCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          bucket.observationsWithCitations,
          bucket.observations
        ),
        promptsWithCitations,
        promptCitationReachPercent: Number(
          ((promptsWithCitations / prompts.length) * 100).toFixed(2)
        ),
        promptCitationReachConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          promptsWithCitations,
          prompts.length
        ),
        citationEvents: bucket.citationEvents,
        meanCitationEventsPerAnswer: Number(
          (bucket.citationEvents / bucket.observations).toFixed(2)
        ),
        promptsWithAnswerWords: promptDensityValues.length,
        equalPromptMeanCitationEventsPer100AnswerWords:
          promptDensityValues.length > 0
            ? Number(
                (
                  promptDensityValues.reduce((sum, value) => sum + value, 0) /
                  promptDensityValues.length
                ).toFixed(2)
              )
            : null,
        equalPromptMeanCitationEventsPer100AnswerWordsConfidenceInterval95:
          bootstrapMeanMetricConfidenceInterval95(
            promptDensityValues,
            `${metricSeed}:citation-density`
          ),
        totalAnswerWords: bucket.totalAnswerWords,
        meanAnswerWords: Number((bucket.totalAnswerWords / bucket.observations).toFixed(2)),
        medianAnswerWords: Number(median(bucket.answerWordCounts).toFixed(2)),
        citationEventsPer100AnswerWords:
          bucket.totalAnswerWords > 0
            ? Number(((bucket.citationEvents / bucket.totalAnswerWords) * 100).toFixed(2))
            : null,
        firstObservedAt: bucket.firstObservedAt,
        lastObservedAt: bucket.lastObservedAt,
        ...(ownedDomains.length > 0
          ? {
              observationsWithOwnedCitation: bucket.observationsWithOwnedCitation,
              ownedCitationCoveragePercent: Number(
                ((bucket.observationsWithOwnedCitation / bucket.observations) * 100).toFixed(2)
              ),
              ownedCitationCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
                bucket.observationsWithOwnedCitation,
                bucket.observations
              ),
              promptsWithOwnedCitation,
              ownedPromptCitationReachPercent: Number(
                ((promptsWithOwnedCitation / prompts.length) * 100).toFixed(2)
              ),
              ownedPromptCitationReachConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
                promptsWithOwnedCitation,
                prompts.length
              ),
              ownedCitationEvents: bucket.ownedCitationEvents,
              ownedCitationEventSharePercent:
                bucket.citationEvents > 0
                  ? Number(((bucket.ownedCitationEvents / bucket.citationEvents) * 100).toFixed(2))
                  : null,
              ownedFirstPositionCitationEvents: bucket.ownedFirstPositionCitationEvents,
              ownedFirstPositionCitationEventSharePercent:
                bucket.ownedCitationEvents > 0
                  ? Number(
                      (
                        (bucket.ownedFirstPositionCitationEvents / bucket.ownedCitationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              ownedTopThreeCitationEvents: bucket.ownedTopThreeCitationEvents,
              ownedTopThreeCitationEventSharePercent:
                bucket.ownedCitationEvents > 0
                  ? Number(
                      (
                        (bucket.ownedTopThreeCitationEvents / bucket.ownedCitationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              promptsWithOwnedCitationEvents: promptsWithOwnedCitationEvents.length,
              ownedFirstCitationMeanReciprocalRankPercent:
                bucket.observationsWithOwnedCitation > 0
                  ? Number(
                      (
                        (bucket.ownedFirstCitationReciprocalRankSum /
                          bucket.observationsWithOwnedCitation) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrPercent:
                ownedFirstCitationPromptMrrValues.length > 0
                  ? Number(
                      (
                        ownedFirstCitationPromptMrrValues.reduce((sum, value) => sum + value, 0) /
                        ownedFirstCitationPromptMrrValues.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedFirstCitationPromptMrrValues,
                  `${metricSeed}:owned-first-citation-mrr`
                ),
              equalPromptMeanOwnedFirstPositionSharePercent:
                ownedFirstPositionPromptShares.length > 0
                  ? Number(
                      (
                        ownedFirstPositionPromptShares.reduce((sum, value) => sum + value, 0) /
                        ownedFirstPositionPromptShares.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstPositionShareConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedFirstPositionPromptShares,
                  `${metricSeed}:owned-first-position-share`
                ),
              equalPromptMeanOwnedTopThreeSharePercent:
                ownedTopThreePromptShares.length > 0
                  ? Number(
                      (
                        ownedTopThreePromptShares.reduce((sum, value) => sum + value, 0) /
                        ownedTopThreePromptShares.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedTopThreeShareConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedTopThreePromptShares,
                  `${metricSeed}:owned-top-three-share`
                ),
              equalPromptMeanOwnedCitationEventsPer100AnswerWords:
                ownedPromptDensityValues.length > 0
                  ? Number(
                      (
                        ownedPromptDensityValues.reduce((sum, value) => sum + value, 0) /
                        ownedPromptDensityValues.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedCitationEventsPer100AnswerWordsConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedPromptDensityValues,
                  `${metricSeed}:owned-citation-density`
                ),
            }
          : {}),
      };
    })
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        left.provider.localeCompare(right.provider) ||
        (left.model ?? '').localeCompare(right.model ?? '') ||
        (left.surface ?? '').localeCompare(right.surface ?? '') ||
        (left.locale ?? '').localeCompare(right.locale ?? '') ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.minimumAnswerWords - right.minimumAnswerWords
    );
  return {
    profiles: answerLengthProfiles,
    truncated:
      answerLengthProfilesTruncated ||
      answerLengthProfiles.length > MAX_RETURNED_ANSWER_LENGTH_PROFILES,
  };
}

/** Analyze locally captured answer citations; this intentionally does not call any AI service. */
export function analyzeAiAnswerCitationObservations(
  value: unknown,
  ownedDomainInputs: string[] = [],
  analyzedAt = new Date().toISOString(),
  entityInputs: string[] = [],
  options: AiAnswerCitationObservationOptions = {}
): AiAnswerCitationObservationReport {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.observations)) {
    throw new Error(
      'Observed-answer input must be an object with schemaVersion 1 and an observations array.'
    );
  }
  if (value.observations.length < 1 || value.observations.length > MAX_OBSERVATIONS) {
    throw new Error(
      `observations must contain between 1 and ${MAX_OBSERVATIONS.toLocaleString('en-US')} records.`
    );
  }
  const ownedDomains = [...new Set(ownedDomainInputs.map(normalizeOwnedDomain))].sort();
  const answerEntities = normalizeAnswerEntities(entityInputs);
  const pathFamilyDepth = options.pathFamilyDepth;
  if (
    pathFamilyDepth !== undefined &&
    (!Number.isInteger(pathFamilyDepth) || pathFamilyDepth < 1 || pathFamilyDepth > 5)
  ) {
    throw new Error('Answer citation path-family depth must be an integer from 1 to 5.');
  }
  const observations: NormalizedObservation[] = [];
  let duplicateCitationUrlsDropped = 0;
  const providerLabels = new Map<string, string>();
  const promptLabels = new Map<string, string>();
  const domainLabels = new Map<string, string>();
  const topicLabels = new Map<string, string>();
  const intentLabels = new Map<string, string>();
  const modelLabels = new Map<string, string>();
  const surfaceLabels = new Map<string, string>();
  const localeLabels = new Map<string, string>();

  value.observations.forEach((candidate, offset) => {
    const index = offset + 1;
    if (!isRecord(candidate)) throw new Error(`Observation ${index} must be an object.`);
    const observedAt = normalizeTimestamp(candidate.observedAt, index);
    const provider = requiredText(candidate.provider, `Observation ${index} provider`, 100);
    const providerKey = provider.toLowerCase();
    if (!providerLabels.has(providerKey)) providerLabels.set(providerKey, provider);
    const prompt = requiredText(candidate.prompt, `Observation ${index} prompt`, 5_000);
    const promptKey = prompt.toLowerCase();
    if (!promptLabels.has(promptKey)) promptLabels.set(promptKey, prompt);
    const topic =
      candidate.topic === undefined
        ? undefined
        : requiredText(candidate.topic, `Observation ${index} topic`, 100);
    const topicKey = topic?.toLowerCase();
    if (topic && topicKey && !topicLabels.has(topicKey)) topicLabels.set(topicKey, topic);
    const intent =
      candidate.intent === undefined
        ? undefined
        : requiredText(candidate.intent, `Observation ${index} intent`, 100);
    const intentKey = intent?.toLowerCase();
    if (intent && intentKey && !intentLabels.has(intentKey)) intentLabels.set(intentKey, intent);
    const model =
      candidate.model === undefined
        ? undefined
        : requiredText(candidate.model, `Observation ${index} model`, 100);
    const modelKey = model?.normalize('NFKC').toLocaleLowerCase('en-US');
    if (model && modelKey && !modelLabels.has(modelKey)) modelLabels.set(modelKey, model);
    const surface =
      candidate.surface === undefined
        ? undefined
        : requiredText(candidate.surface, `Observation ${index} surface`, 100);
    const surfaceKey = surface?.normalize('NFKC').toLocaleLowerCase('en-US');
    if (surface && surfaceKey && !surfaceLabels.has(surfaceKey))
      surfaceLabels.set(surfaceKey, surface);
    const locale =
      candidate.locale === undefined
        ? undefined
        : requiredText(candidate.locale, `Observation ${index} locale`, 100);
    const localeKey = locale?.normalize('NFKC').toLocaleLowerCase('en-US');
    if (locale && localeKey && !localeLabels.has(localeKey)) localeLabels.set(localeKey, locale);
    if (
      candidate.answerText !== undefined &&
      (typeof candidate.answerText !== 'string' || candidate.answerText.length > 12_000)
    ) {
      throw new Error(
        `Observation ${index} answerText must be a string of at most 12,000 characters.`
      );
    }
    if (
      !Array.isArray(candidate.citedUrls) ||
      candidate.citedUrls.length > MAX_CITATIONS_PER_OBSERVATION
    ) {
      throw new Error(
        `Observation ${index} citedUrls must be an array with no more than ${MAX_CITATIONS_PER_OBSERVATION} URLs.`
      );
    }
    if (
      candidate.citationListComplete !== undefined &&
      typeof candidate.citationListComplete !== 'boolean'
    ) {
      throw new Error(`Observation ${index} citationListComplete must be a boolean when provided.`);
    }
    const citationListComplete =
      candidate.citationListComplete === undefined
        ? candidate.citedUrls.length < MAX_CITATIONS_PER_OBSERVATION
        : candidate.citationListComplete;
    const citationsByUrl = new Map<string, { url: string; domain: string; position: number }>();
    candidate.citedUrls.forEach((rawUrl, citationOffset) => {
      const citation = normalizeCitationUrl(rawUrl, index, citationOffset + 1);
      if (citationsByUrl.has(citation.url)) duplicateCitationUrlsDropped += 1;
      else citationsByUrl.set(citation.url, { ...citation, position: citationOffset + 1 });
      if (!domainLabels.has(citation.domain)) domainLabels.set(citation.domain, citation.domain);
    });
    observations.push({
      observedAt,
      provider: providerLabels.get(providerKey)!,
      providerKey,
      prompt: promptLabels.get(promptKey)!,
      promptKey,
      ...(topic && topicKey ? { topic: topicLabels.get(topicKey)!, topicKey } : {}),
      ...(intent && intentKey ? { intent: intentLabels.get(intentKey)!, intentKey } : {}),
      ...(model && modelKey ? { model: modelLabels.get(modelKey)!, modelKey } : {}),
      ...(surface && surfaceKey ? { surface: surfaceLabels.get(surfaceKey)!, surfaceKey } : {}),
      ...(locale && localeKey ? { locale: localeLabels.get(localeKey)!, localeKey } : {}),
      ...(typeof candidate.answerText === 'string'
        ? {
            answerText: candidate.answerText,
            answerWordCount: countAnswerWords(candidate.answerText),
          }
        : {}),
      citationListComplete,
      citations: [...citationsByUrl.values()],
    });
  });
  if (providerLabels.size > MAX_PROVIDERS)
    throw new Error(`Input has more than ${MAX_PROVIDERS} distinct providers.`);
  if (promptLabels.size > MAX_PROMPTS)
    throw new Error(`Input has more than ${MAX_PROMPTS.toLocaleString('en-US')} distinct prompts.`);
  if (domainLabels.size > MAX_DOMAINS)
    throw new Error(
      `Input has more than ${MAX_DOMAINS.toLocaleString('en-US')} distinct cited domains.`
    );
  if (topicLabels.size > 100 || intentLabels.size > 100)
    throw new Error(
      'Input may contain no more than 100 distinct topic labels or 100 distinct intent labels.'
    );
  if (modelLabels.size > 100 || surfaceLabels.size > 100 || localeLabels.size > 100) {
    throw new Error(
      'Input may contain no more than 100 distinct model, surface, or locale labels each.'
    );
  }

  interface PromptBucket {
    prompt: string;
    observations: number;
    providers: Set<string>;
    withCitations: number;
    withoutCitations: number;
    incompleteCitationLists: number;
    citationEvents: number;
    withOwnedCitation: number;
    withoutOwnedCitation: number;
    firstObservedAt: string;
    lastObservedAt: string;
    domains: Map<string, number>;
    domainsByProvider: Map<string, Map<string, number>>;
    providerSamples: Map<string, PromptProviderBucket>;
  }
  interface PromptProviderBucket {
    provider: string;
    observations: number;
    incompleteCitationLists: number;
    withCitations: number;
    withoutCitations: number;
    withOwnedCitation: number;
    withoutOwnedCitation: number;
    citationEvents: number;
    ownedCitationEvents: number;
    ownedFirstPositionCitationEvents: number;
    ownedTopThreeCitationEvents: number;
    ownedFirstCitationReciprocalRankSum: number;
    firstObservedAt: string;
    lastObservedAt: string;
    domains: Map<string, number>;
    rankWeightedDomains: Map<string, number>;
    rankWeightedCitationWeightTotal: number;
  }
  interface ProviderBucket {
    provider: string;
    observations: number;
    prompts: Set<string>;
    ownedPrompts: Set<string>;
    incompletePrompts: Set<string>;
    withCitations: number;
    withoutCitations: number;
    incompleteCitationLists: number;
    unknownOwnedObservations: number;
    citationEvents: number;
    domains: Set<string>;
    domainCitationEvents: Map<string, number>;
    rankWeightedDomainCitationWeights: Map<string, number>;
    rankWeightedCitationWeightTotal: number;
    withOwnedCitation: number;
    withoutOwnedCitation: number;
    ownedFirstCitationReciprocalRankSum: number;
  }
  interface DomainBucket {
    domain: string;
    citationEvents: number;
    answers: Set<number>;
    prompts: Set<string>;
    providers: Set<string>;
    urls: Set<string>;
    positions: number[];
    promptsWithFirstPositionCitation: Set<string>;
    promptsWithTopThreeCitation: Set<string>;
    positionsByProvider: Map<
      string,
      {
        provider: string;
        positions: number[];
        answers: Set<number>;
        prompts: Set<string>;
        promptsWithFirstPositionCitation: Set<string>;
        promptsWithTopThreeCitation: Set<string>;
      }
    >;
  }
  interface PageBucket {
    url: string;
    domain: string;
    citationEvents: number;
    answers: Set<number>;
    prompts: Set<string>;
    providers: Set<string>;
    firstObservedAt: string;
    lastObservedAt: string;
    positions: number[];
    promptsWithFirstPositionCitation: Set<string>;
    promptsWithTopThreeCitation: Set<string>;
    positionsByProvider: Map<
      string,
      {
        provider: string;
        positions: number[];
        answers: Set<number>;
        prompts: Set<string>;
        promptsWithFirstPositionCitation: Set<string>;
        promptsWithTopThreeCitation: Set<string>;
      }
    >;
  }
  interface MonthBucket {
    observations: number;
    withCitations: number;
    withoutCitations: number;
    withOwnedCitation: number;
    withoutOwnedCitation: number;
    citationEvents: number;
    domains: Map<string, number>;
    positions: number[];
  }
  interface TopicIntentMonthBucket {
    month: string;
    topic?: string;
    intent?: string;
    provider: string;
    unlabeled: boolean;
    observations: number;
    prompts: Set<string>;
    incompleteCitationListObservations: number;
    ownedPrompts: Set<string>;
    incompletePrompts: Set<string>;
    unknownOwnedCitationStateObservations: number;
    withCitations: number;
    withOwnedCitation: number;
    ownedFirstCitationReciprocalRankSum: number;
    ownedFirstCitationPromptRanks: Map<string, { reciprocalRankSum: number; observations: number }>;
    citationEvents: number;
    domains: Map<string, number>;
    domainPositions: Map<string, number[]>;
    positions: number[];
    ownedPositionBuckets?: CitationPositionBucketCounters;
  }
  interface TopicIntentBucket {
    promptCohortKey: string;
    topic?: string;
    intent?: string;
    observations: number;
    prompts: Set<string>;
    ownedPrompts: Set<string>;
    providers: Set<string>;
    withCitations: number;
    withoutCitations: number;
    citationEvents: number;
    withOwnedCitation: number;
    withoutOwnedCitation: number;
    ownedFirstCitationReciprocalRankSum: number;
    domains: Map<string, number>;
    providerSamples: Map<string, TopicIntentProviderBucket>;
  }
  interface TopicIntentProviderBucket {
    provider: string;
    observations: number;
    prompts: Set<string>;
    ownedPrompts: Set<string>;
    withCitations: number;
    withoutCitations: number;
    citationEvents: number;
    withOwnedCitation: number;
    withoutOwnedCitation: number;
    ownedFirstCitationReciprocalRankSum: number;
    domains: Map<string, number>;
    firstObservedAt: string;
    lastObservedAt: string;
  }
  interface TopicPromptProviderBucket {
    provider: string;
    observations: number;
    incompleteCitationListObservations: number;
    withCitations: number;
    withOwnedCitation: number;
    firstObservedAt: string;
    lastObservedAt: string;
    domains: Map<string, number>;
    citationEvents: number;
    firstPositionEvents: number;
    topThreeEvents: number;
    ownedFirstCitationReciprocalRankSum: number;
    reciprocalRankWeights: Map<string, number>;
  }
  interface TopicIntentPromptBucket {
    topic?: string;
    intent?: string;
    unlabeled: boolean;
    prompts: Map<string, Map<string, TopicPromptProviderBucket>>;
  }
  interface ProviderPairBucket {
    cohortKey: string;
    providerKeyA: string;
    providerKeyB: string;
    topic?: string;
    intent?: string;
    unlabeled: boolean;
    providerA: string;
    providerB: string;
    sharedPrompts: number;
    observationsA: number;
    observationsB: number;
    withCitationsA: number;
    withCitationsB: number;
    withOwnedCitationA: number;
    withOwnedCitationB: number;
    citationDeltas: number[];
    promptCitationCoverageA: number[];
    promptCitationCoverageB: number[];
    promptDomainJaccards: number[];
    ownedCitationDeltas: number[];
    promptOwnedCitationCoverageA: number[];
    promptOwnedCitationCoverageB: number[];
    promptOwnedCitationReachDeltas: number[];
    promptOwnedCitationReachLowerDeltas: number[];
    promptOwnedCitationReachUpperDeltas: number[];
    ownedCitationPromptGroupsA: number;
    ownedCitationPromptGroupsB: number;
    unknownOwnedReachPromptsA: number;
    unknownOwnedReachPromptsB: number;
    ownedCitationEventShareDeltas: number[];
    ownedFirstCitationMrrDeltas: number[];
    ownedFirstCitationMrrA: number[];
    ownedFirstCitationMrrB: number[];
    firstPositionShareDeltas: number[];
    topThreeShareDeltas: number[];
    promptReciprocalRankSimilarities: number[];
    promptsAHigher: number;
    promptsBHigher: number;
    promptsEqual: number;
    promptsWithAnyCitationDomain: number;
    promptsWithDomainsOnBothSides: number;
    promptsOwnedAHigher: number;
    promptsOwnedBHigher: number;
    promptsOwnedEqual: number;
    promptsOwnedOnlyA: number;
    promptsOwnedOnlyB: number;
    promptsOwnedBoth: number;
    promptsOwnedNeither: number;
    promptsWithOwnedEventsOnBothSides: number;
    promptsOwnedEventShareAHigher: number;
    promptsOwnedEventShareBHigher: number;
    promptsOwnedEventShareEqual: number;
    firstPositionEventsA: number;
    firstPositionEventsB: number;
    topThreeEventsA: number;
    topThreeEventsB: number;
    promptsWithPositionsOnBothSides: number;
    promptsFirstPositionAHigher: number;
    promptsFirstPositionBHigher: number;
    promptsFirstPositionEqual: number;
    promptsTopThreeAHigher: number;
    promptsTopThreeBHigher: number;
    promptsTopThreeEqual: number;
    firstObservedAtA: string;
    lastObservedAtA: string;
    firstObservedAtB: string;
    lastObservedAtB: string;
    domainsA: Map<string, number>;
    domainsB: Map<string, number>;
    reciprocalRankWeightsA: Map<string, number>;
    reciprocalRankWeightsB: Map<string, number>;
  }

  const promptBuckets = new Map<string, PromptBucket>();
  const providerBuckets = new Map<string, ProviderBucket>();
  const domainBuckets = new Map<string, DomainBucket>();
  const pageBuckets = new Map<string, PageBucket>();
  const monthlyBuckets = new Map<string, MonthBucket>();
  const topicIntentMonthlyBuckets = new Map<string, TopicIntentMonthBucket>();
  const topicIntentBuckets = new Map<string, TopicIntentBucket>();
  const topicIntentPromptBuckets = new Map<string, TopicIntentPromptBucket>();
  const pathFamilyBuckets = new Map<
    string,
    {
      pathFamily: string;
      origin: string;
      pathPrefix: string;
      owned: boolean;
      urls: Set<string>;
      citationEvents: number;
      answers: Set<number>;
      prompts: Set<string>;
      providers: Set<string>;
      positions: number[];
      firstObservedAt: string;
      lastObservedAt: string;
    }
  >();
  const pathFamilyCohortSamples = new Map<
    string,
    {
      provider: string;
      providerKey: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      unlabeled: boolean;
      observations: number;
      prompts: Set<string>;
      citationEvents: number;
    }
  >();
  const pathFamilyCohortBuckets = new Map<
    string,
    {
      pathFamily: string;
      origin: string;
      pathPrefix: string;
      owned: boolean;
      provider: string;
      providerKey: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      unlabeled: boolean;
      urls: Set<string>;
      citationEvents: number;
      answers: Set<number>;
      prompts: Set<string>;
      positions: number[];
      firstObservedAt: string;
      lastObservedAt: string;
    }
  >();
  let pathFamilyCohortBucketsTruncated = false;
  const pathFamilyMonthlyCohortSamples = new Map<
    string,
    {
      month: string;
      provider: string;
      providerKey: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      unlabeled: boolean;
      observations: number;
      prompts: Set<string>;
      citationEvents: number;
    }
  >();
  const pathFamilyMonthlyCohortBuckets = new Map<
    string,
    {
      month: string;
      pathFamily: string;
      origin: string;
      pathPrefix: string;
      owned: boolean;
      provider: string;
      providerKey: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      unlabeled: boolean;
      urls: Set<string>;
      citationEvents: number;
      answers: Set<number>;
      prompts: Set<string>;
      positions: number[];
      firstObservedAt: string;
      lastObservedAt: string;
    }
  >();
  let pathFamilyMonthlyCohortBucketsTruncated = false;
  let labeledObservations = 0;
  let unlabeledObservations = 0;
  let observationsWithCitations = 0;
  let observationsWithoutCitations = 0;
  let observationsWithOwnedCitation = 0;
  let observationsWithoutOwnedCitation = 0;
  let ownedFirstCitationReciprocalRankSum = 0;
  let citationEvents = 0;
  const ownedPositionBucketCounters = createCitationPositionBucketCounters();
  const ownedPositionBucketCountersByProvider = new Map<string, CitationPositionBucketCounters>();

  observations.forEach((observation, observationIndex) => {
    const prompt = promptBuckets.get(observation.promptKey) ?? {
      prompt: observation.prompt,
      observations: 0,
      providers: new Set<string>(),
      withCitations: 0,
      withoutCitations: 0,
      incompleteCitationLists: 0,
      citationEvents: 0,
      withOwnedCitation: 0,
      withoutOwnedCitation: 0,
      firstObservedAt: observation.observedAt,
      lastObservedAt: observation.observedAt,
      domains: new Map<string, number>(),
      domainsByProvider: new Map<string, Map<string, number>>(),
      providerSamples: new Map<string, PromptProviderBucket>(),
    };
    const promptProvider = prompt.providerSamples.get(observation.providerKey) ?? {
      provider: observation.provider,
      observations: 0,
      incompleteCitationListObservations: 0,
      incompleteCitationLists: 0,
      withCitations: 0,
      withoutCitations: 0,
      withOwnedCitation: 0,
      withoutOwnedCitation: 0,
      citationEvents: 0,
      ownedCitationEvents: 0,
      ownedFirstPositionCitationEvents: 0,
      ownedTopThreeCitationEvents: 0,
      ownedFirstCitationReciprocalRankSum: 0,
      firstObservedAt: observation.observedAt,
      lastObservedAt: observation.observedAt,
      domains: new Map<string, number>(),
      rankWeightedDomains: new Map<string, number>(),
      rankWeightedCitationWeightTotal: 0,
    };
    const provider = providerBuckets.get(observation.providerKey) ?? {
      provider: observation.provider,
      observations: 0,
      prompts: new Set<string>(),
      incompleteCitationListObservations: 0,
      ownedPrompts: new Set<string>(),
      incompletePrompts: new Set<string>(),
      withCitations: 0,
      withoutCitations: 0,
      incompleteCitationLists: 0,
      unknownOwnedObservations: 0,
      citationEvents: 0,
      domains: new Set<string>(),
      domainCitationEvents: new Map<string, number>(),
      rankWeightedDomainCitationWeights: new Map<string, number>(),
      rankWeightedCitationWeightTotal: 0,
      withOwnedCitation: 0,
      withoutOwnedCitation: 0,
      ownedFirstCitationReciprocalRankSum: 0,
    };
    if (
      ownedDomains.length > 0 &&
      !ownedPositionBucketCountersByProvider.has(observation.providerKey)
    ) {
      ownedPositionBucketCountersByProvider.set(
        observation.providerKey,
        createCitationPositionBucketCounters()
      );
    }
    const monthKey = observation.observedAt.slice(0, 7);
    const month = monthlyBuckets.get(monthKey) ?? {
      observations: 0,
      withCitations: 0,
      withoutCitations: 0,
      withOwnedCitation: 0,
      withoutOwnedCitation: 0,
      citationEvents: 0,
      domains: new Map<string, number>(),
      positions: [],
    };
    const hasTopicIntentLabel =
      observation.topicKey !== undefined || observation.intentKey !== undefined;
    const topicIntentKey = `${observation.topicKey ?? ''}\u0000${observation.intentKey ?? ''}`;
    const comparisonCohortKey = JSON.stringify([hasTopicIntentLabel, topicIntentKey]);
    const pathFamilyCohortKey = JSON.stringify([
      observation.providerKey,
      hasTopicIntentLabel ? topicIntentKey : null,
    ]);
    if (pathFamilyDepth !== undefined) {
      const cohort = pathFamilyCohortSamples.get(pathFamilyCohortKey) ?? {
        provider: observation.provider,
        providerKey: observation.providerKey,
        ...(observation.topic ? { topic: observation.topic, topicKey: observation.topicKey } : {}),
        ...(observation.intent
          ? { intent: observation.intent, intentKey: observation.intentKey }
          : {}),
        unlabeled: !hasTopicIntentLabel,
        observations: 0,
        prompts: new Set<string>(),
        citationEvents: 0,
      };
      cohort.observations += 1;
      cohort.prompts.add(observation.promptKey);
      cohort.citationEvents += observation.citations.length;
      pathFamilyCohortSamples.set(pathFamilyCohortKey, cohort);
      const pathFamilyMonthlyCohortKey = JSON.stringify([monthKey, pathFamilyCohortKey]);
      const monthlyCohort = pathFamilyMonthlyCohortSamples.get(pathFamilyMonthlyCohortKey) ?? {
        month: monthKey,
        provider: observation.provider,
        providerKey: observation.providerKey,
        ...(observation.topic ? { topic: observation.topic, topicKey: observation.topicKey } : {}),
        ...(observation.intent
          ? { intent: observation.intent, intentKey: observation.intentKey }
          : {}),
        unlabeled: !hasTopicIntentLabel,
        observations: 0,
        prompts: new Set<string>(),
        citationEvents: 0,
      };
      monthlyCohort.observations += 1;
      monthlyCohort.prompts.add(observation.promptKey);
      monthlyCohort.citationEvents += observation.citations.length;
      pathFamilyMonthlyCohortSamples.set(pathFamilyMonthlyCohortKey, monthlyCohort);
    }
    const topicIntentBucket = hasTopicIntentLabel
      ? (topicIntentBuckets.get(topicIntentKey) ?? {
          promptCohortKey: comparisonCohortKey,
          ...(observation.topic ? { topic: observation.topic } : {}),
          ...(observation.intent ? { intent: observation.intent } : {}),
          observations: 0,
          prompts: new Set<string>(),
          ownedPrompts: new Set<string>(),
          providers: new Set<string>(),
          withCitations: 0,
          withoutCitations: 0,
          citationEvents: 0,
          withOwnedCitation: 0,
          withoutOwnedCitation: 0,
          ownedFirstCitationReciprocalRankSum: 0,
          domains: new Map<string, number>(),
          providerSamples: new Map<string, TopicIntentProviderBucket>(),
        })
      : undefined;
    const topicIntentProvider = topicIntentBucket
      ? (topicIntentBucket.providerSamples.get(observation.providerKey) ?? {
          provider: observation.provider,
          observations: 0,
          prompts: new Set<string>(),
          ownedPrompts: new Set<string>(),
          withCitations: 0,
          withoutCitations: 0,
          citationEvents: 0,
          withOwnedCitation: 0,
          withoutOwnedCitation: 0,
          ownedFirstCitationReciprocalRankSum: 0,
          domains: new Map<string, number>(),
          firstObservedAt: observation.observedAt,
          lastObservedAt: observation.observedAt,
        })
      : undefined;
    const ownedCitation = observation.citations.some(({ domain }) =>
      isOwnedDomain(domain, ownedDomains)
    );
    const firstOwnedCitationPosition = observation.citations
      .filter(({ domain }) => isOwnedDomain(domain, ownedDomains))
      .reduce(
        (firstPosition, citation) => Math.min(firstPosition, citation.position),
        Number.POSITIVE_INFINITY
      );
    const topicIntentMonthKey = JSON.stringify([
      monthKey,
      hasTopicIntentLabel ? topicIntentKey : null,
      observation.providerKey,
    ]);
    const topicIntentMonth = topicIntentMonthlyBuckets.get(topicIntentMonthKey) ?? {
      month: monthKey,
      ...(observation.topic ? { topic: observation.topic } : {}),
      ...(observation.intent ? { intent: observation.intent } : {}),
      provider: observation.provider,
      unlabeled: !hasTopicIntentLabel,
      observations: 0,
      prompts: new Set<string>(),
      incompleteCitationListObservations: 0,
      ownedPrompts: new Set<string>(),
      incompletePrompts: new Set<string>(),
      unknownOwnedCitationStateObservations: 0,
      withCitations: 0,
      withOwnedCitation: 0,
      ownedFirstCitationReciprocalRankSum: 0,
      ownedFirstCitationPromptRanks: new Map<
        string,
        { reciprocalRankSum: number; observations: number }
      >(),
      citationEvents: 0,
      domains: new Map<string, number>(),
      domainPositions: new Map<string, number[]>(),
      positions: [],
      ...(ownedDomains.length > 0
        ? { ownedPositionBuckets: createCitationPositionBucketCounters() }
        : {}),
    };
    topicIntentMonth.observations += 1;
    topicIntentMonth.prompts.add(observation.promptKey);
    if (!observation.citationListComplete) {
      topicIntentMonth.incompleteCitationListObservations += 1;
      topicIntentMonth.incompletePrompts.add(observation.promptKey);
    }
    if (!observation.citationListComplete && !ownedCitation)
      topicIntentMonth.unknownOwnedCitationStateObservations += 1;
    topicIntentMonth.withCitations += observation.citations.length > 0 ? 1 : 0;
    topicIntentMonth.withOwnedCitation += ownedCitation ? 1 : 0;
    if (ownedCitation) {
      topicIntentMonth.ownedPrompts.add(observation.promptKey);
      topicIntentMonth.ownedFirstCitationReciprocalRankSum += 1 / firstOwnedCitationPosition;
      const promptRank = topicIntentMonth.ownedFirstCitationPromptRanks.get(
        observation.promptKey
      ) ?? { reciprocalRankSum: 0, observations: 0 };
      promptRank.reciprocalRankSum += 1 / firstOwnedCitationPosition;
      promptRank.observations += 1;
      topicIntentMonth.ownedFirstCitationPromptRanks.set(observation.promptKey, promptRank);
    }
    topicIntentMonth.citationEvents += observation.citations.length;
    for (const citation of observation.citations) {
      topicIntentMonth.domains.set(
        citation.domain,
        (topicIntentMonth.domains.get(citation.domain) ?? 0) + 1
      );
      const domainPositions = topicIntentMonth.domainPositions.get(citation.domain) ?? [];
      domainPositions.push(citation.position);
      topicIntentMonth.domainPositions.set(citation.domain, domainPositions);
      topicIntentMonth.positions.push(citation.position);
      if (topicIntentMonth.ownedPositionBuckets) {
        const bucket = topicIntentMonth.ownedPositionBuckets.get(
          citationPositionBucketRange(citation.position)
        )!;
        bucket.citationEvents += 1;
        if (isOwnedDomain(citation.domain, ownedDomains)) bucket.ownedCitationEvents += 1;
      }
    }
    topicIntentMonthlyBuckets.set(topicIntentMonthKey, topicIntentMonth);
    const cohortPrompts = topicIntentPromptBuckets.get(comparisonCohortKey) ?? {
      ...(observation.topic ? { topic: observation.topic } : {}),
      ...(observation.intent ? { intent: observation.intent } : {}),
      unlabeled: !hasTopicIntentLabel,
      prompts: new Map<string, Map<string, TopicPromptProviderBucket>>(),
    };
    const promptProviders =
      cohortPrompts.prompts.get(observation.promptKey) ??
      new Map<string, TopicPromptProviderBucket>();
    const comparableProvider = promptProviders.get(observation.providerKey) ?? {
      provider: observation.provider,
      observations: 0,
      incompleteCitationListObservations: 0,
      withCitations: 0,
      withOwnedCitation: 0,
      firstObservedAt: observation.observedAt,
      lastObservedAt: observation.observedAt,
      domains: new Map<string, number>(),
      citationEvents: 0,
      firstPositionEvents: 0,
      topThreeEvents: 0,
      ownedFirstCitationReciprocalRankSum: 0,
      reciprocalRankWeights: new Map<string, number>(),
    };
    comparableProvider.observations += 1;
    if (!observation.citationListComplete)
      comparableProvider.incompleteCitationListObservations += 1;
    comparableProvider.firstObservedAt =
      observation.observedAt < comparableProvider.firstObservedAt
        ? observation.observedAt
        : comparableProvider.firstObservedAt;
    comparableProvider.lastObservedAt =
      observation.observedAt > comparableProvider.lastObservedAt
        ? observation.observedAt
        : comparableProvider.lastObservedAt;
    if (observation.citations.length > 0) comparableProvider.withCitations += 1;
    if (ownedCitation) {
      comparableProvider.withOwnedCitation += 1;
      comparableProvider.ownedFirstCitationReciprocalRankSum += 1 / firstOwnedCitationPosition;
    }
    for (const citation of observation.citations) {
      comparableProvider.domains.set(
        citation.domain,
        (comparableProvider.domains.get(citation.domain) ?? 0) + 1
      );
      comparableProvider.citationEvents += 1;
      if (citation.position === 1) comparableProvider.firstPositionEvents += 1;
      if (citation.position <= 3) comparableProvider.topThreeEvents += 1;
      comparableProvider.reciprocalRankWeights.set(
        citation.url,
        (comparableProvider.reciprocalRankWeights.get(citation.url) ?? 0) + 1 / citation.position
      );
    }
    promptProviders.set(observation.providerKey, comparableProvider);
    cohortPrompts.prompts.set(observation.promptKey, promptProviders);
    topicIntentPromptBuckets.set(comparisonCohortKey, cohortPrompts);
    prompt.observations += 1;
    if (!observation.citationListComplete) prompt.incompleteCitationLists += 1;
    prompt.providers.add(observation.provider);
    prompt.firstObservedAt =
      observation.observedAt < prompt.firstObservedAt
        ? observation.observedAt
        : prompt.firstObservedAt;
    prompt.lastObservedAt =
      observation.observedAt > prompt.lastObservedAt
        ? observation.observedAt
        : prompt.lastObservedAt;
    promptProvider.observations += 1;
    if (!observation.citationListComplete) promptProvider.incompleteCitationLists += 1;
    promptProvider.firstObservedAt =
      observation.observedAt < promptProvider.firstObservedAt
        ? observation.observedAt
        : promptProvider.firstObservedAt;
    promptProvider.lastObservedAt =
      observation.observedAt > promptProvider.lastObservedAt
        ? observation.observedAt
        : promptProvider.lastObservedAt;
    provider.observations += 1;
    if (!observation.citationListComplete) provider.incompleteCitationLists += 1;
    if (!observation.citationListComplete) provider.incompletePrompts.add(observation.promptKey);
    else provider.unknownOwnedObservations += 1;
    provider.prompts.add(observation.promptKey);
    month.observations += 1;
    if (topicIntentBucket) {
      labeledObservations += 1;
      topicIntentBucket.observations += 1;
      topicIntentBucket.prompts.add(observation.promptKey);
      topicIntentBucket.providers.add(observation.provider);
      topicIntentProvider!.observations += 1;
      topicIntentProvider!.prompts.add(observation.promptKey);
      topicIntentProvider!.firstObservedAt =
        observation.observedAt < topicIntentProvider!.firstObservedAt
          ? observation.observedAt
          : topicIntentProvider!.firstObservedAt;
      topicIntentProvider!.lastObservedAt =
        observation.observedAt > topicIntentProvider!.lastObservedAt
          ? observation.observedAt
          : topicIntentProvider!.lastObservedAt;
    } else {
      unlabeledObservations += 1;
    }
    if (observation.citations.length > 0) {
      observationsWithCitations += 1;
      prompt.withCitations += 1;
      provider.withCitations += 1;
      month.withCitations += 1;
      if (topicIntentBucket) topicIntentBucket.withCitations += 1;
      if (topicIntentProvider) topicIntentProvider.withCitations += 1;
      promptProvider.withCitations += 1;
    } else {
      observationsWithoutCitations += 1;
      prompt.withoutCitations += 1;
      provider.withoutCitations += 1;
      month.withoutCitations += 1;
      if (topicIntentBucket) topicIntentBucket.withoutCitations += 1;
      if (topicIntentProvider) topicIntentProvider.withoutCitations += 1;
      promptProvider.withoutCitations += 1;
    }
    if (ownedDomains.length > 0) {
      if (ownedCitation) {
        observationsWithOwnedCitation += 1;
        prompt.withOwnedCitation += 1;
        provider.withOwnedCitation += 1;
        provider.ownedPrompts.add(observation.promptKey);
        month.withOwnedCitation += 1;
        if (topicIntentBucket) topicIntentBucket.withOwnedCitation += 1;
        if (topicIntentBucket) topicIntentBucket.ownedPrompts.add(observation.promptKey);
        if (topicIntentProvider) {
          topicIntentProvider.withOwnedCitation += 1;
          topicIntentProvider.ownedPrompts.add(observation.promptKey);
          topicIntentProvider.ownedFirstCitationReciprocalRankSum += 1 / firstOwnedCitationPosition;
        }
        if (topicIntentBucket)
          topicIntentBucket.ownedFirstCitationReciprocalRankSum += 1 / firstOwnedCitationPosition;
        promptProvider.withOwnedCitation += 1;
        promptProvider.ownedFirstCitationReciprocalRankSum += 1 / firstOwnedCitationPosition;
        provider.ownedFirstCitationReciprocalRankSum += 1 / firstOwnedCitationPosition;
        ownedFirstCitationReciprocalRankSum += 1 / firstOwnedCitationPosition;
      } else {
        observationsWithoutOwnedCitation += 1;
        prompt.withoutOwnedCitation += 1;
        provider.withoutOwnedCitation += 1;
        month.withoutOwnedCitation += 1;
        if (topicIntentBucket) topicIntentBucket.withoutOwnedCitation += 1;
        if (topicIntentProvider) topicIntentProvider.withoutOwnedCitation += 1;
        promptProvider.withoutOwnedCitation += 1;
      }
    }
    for (const citation of observation.citations) {
      citationEvents += 1;
      if (ownedDomains.length > 0) {
        const range = citationPositionBucketRange(citation.position);
        const positionBucket = ownedPositionBucketCounters.get(range)!;
        const providerPositionBucket = ownedPositionBucketCountersByProvider
          .get(observation.providerKey)!
          .get(range)!;
        positionBucket.citationEvents += 1;
        providerPositionBucket.citationEvents += 1;
        if (isOwnedDomain(citation.domain, ownedDomains)) {
          positionBucket.ownedCitationEvents += 1;
          providerPositionBucket.ownedCitationEvents += 1;
          promptProvider.ownedCitationEvents += 1;
          if (citation.position === 1) promptProvider.ownedFirstPositionCitationEvents += 1;
          if (citation.position <= 3) promptProvider.ownedTopThreeCitationEvents += 1;
        }
      }
      prompt.citationEvents += 1;
      prompt.domains.set(citation.domain, (prompt.domains.get(citation.domain) ?? 0) + 1);
      const providerDomains =
        prompt.domainsByProvider.get(observation.providerKey) ?? new Map<string, number>();
      providerDomains.set(citation.domain, (providerDomains.get(citation.domain) ?? 0) + 1);
      prompt.domainsByProvider.set(observation.providerKey, providerDomains);
      promptProvider.citationEvents += 1;
      promptProvider.domains.set(
        citation.domain,
        (promptProvider.domains.get(citation.domain) ?? 0) + 1
      );
      const discountedCitationWeight = 1 / Math.log2(citation.position + 1);
      promptProvider.rankWeightedCitationWeightTotal += discountedCitationWeight;
      promptProvider.rankWeightedDomains.set(
        citation.domain,
        (promptProvider.rankWeightedDomains.get(citation.domain) ?? 0) + discountedCitationWeight
      );
      if (topicIntentBucket)
        topicIntentBucket.domains.set(
          citation.domain,
          (topicIntentBucket.domains.get(citation.domain) ?? 0) + 1
        );
      if (topicIntentProvider) {
        topicIntentProvider.citationEvents += 1;
        topicIntentProvider.domains.set(
          citation.domain,
          (topicIntentProvider.domains.get(citation.domain) ?? 0) + 1
        );
      }
      provider.citationEvents += 1;
      provider.domains.add(citation.domain);
      provider.domainCitationEvents.set(
        citation.domain,
        (provider.domainCitationEvents.get(citation.domain) ?? 0) + 1
      );
      provider.rankWeightedCitationWeightTotal += discountedCitationWeight;
      provider.rankWeightedDomainCitationWeights.set(
        citation.domain,
        (provider.rankWeightedDomainCitationWeights.get(citation.domain) ?? 0) +
          discountedCitationWeight
      );
      month.citationEvents += 1;
      month.domains.set(citation.domain, (month.domains.get(citation.domain) ?? 0) + 1);
      month.positions.push(citation.position);
      const domain = domainBuckets.get(citation.domain) ?? {
        domain: domainLabels.get(citation.domain) ?? citation.domain,
        citationEvents: 0,
        answers: new Set<number>(),
        prompts: new Set<string>(),
        providers: new Set<string>(),
        urls: new Set<string>(),
        positions: [] as number[],
        promptsWithFirstPositionCitation: new Set<string>(),
        promptsWithTopThreeCitation: new Set<string>(),
        positionsByProvider: new Map(),
      };
      domain.citationEvents += 1;
      domain.answers.add(observationIndex);
      domain.prompts.add(observation.promptKey);
      domain.providers.add(observation.provider);
      domain.urls.add(citation.url);
      domain.positions.push(citation.position);
      if (citation.position === 1)
        domain.promptsWithFirstPositionCitation.add(observation.promptKey);
      if (citation.position <= 3) domain.promptsWithTopThreeCitation.add(observation.promptKey);
      const domainProviderPositions = domain.positionsByProvider.get(observation.providerKey) ?? {
        provider: observation.provider,
        positions: [] as number[],
        answers: new Set<number>(),
        prompts: new Set<string>(),
        promptsWithFirstPositionCitation: new Set<string>(),
        promptsWithTopThreeCitation: new Set<string>(),
      };
      domainProviderPositions.positions.push(citation.position);
      domainProviderPositions.answers.add(observationIndex);
      domainProviderPositions.prompts.add(observation.promptKey);
      if (citation.position === 1)
        domainProviderPositions.promptsWithFirstPositionCitation.add(observation.promptKey);
      if (citation.position <= 3)
        domainProviderPositions.promptsWithTopThreeCitation.add(observation.promptKey);
      domain.positionsByProvider.set(observation.providerKey, domainProviderPositions);
      domainBuckets.set(citation.domain, domain);
      const page = pageBuckets.get(citation.url) ?? {
        url: citation.url,
        domain: citation.domain,
        citationEvents: 0,
        answers: new Set<number>(),
        prompts: new Set<string>(),
        providers: new Set<string>(),
        firstObservedAt: observation.observedAt,
        lastObservedAt: observation.observedAt,
        positions: [] as number[],
        promptsWithFirstPositionCitation: new Set<string>(),
        promptsWithTopThreeCitation: new Set<string>(),
        positionsByProvider: new Map(),
      };
      page.citationEvents += 1;
      page.answers.add(observationIndex);
      page.prompts.add(observation.promptKey);
      page.providers.add(observation.provider);
      page.firstObservedAt =
        observation.observedAt < page.firstObservedAt
          ? observation.observedAt
          : page.firstObservedAt;
      page.lastObservedAt =
        observation.observedAt > page.lastObservedAt ? observation.observedAt : page.lastObservedAt;
      page.positions.push(citation.position);
      if (citation.position === 1) page.promptsWithFirstPositionCitation.add(observation.promptKey);
      if (citation.position <= 3) page.promptsWithTopThreeCitation.add(observation.promptKey);
      const pageProviderPositions = page.positionsByProvider.get(observation.providerKey) ?? {
        provider: observation.provider,
        positions: [] as number[],
        answers: new Set<number>(),
        prompts: new Set<string>(),
        promptsWithFirstPositionCitation: new Set<string>(),
        promptsWithTopThreeCitation: new Set<string>(),
      };
      pageProviderPositions.positions.push(citation.position);
      pageProviderPositions.answers.add(observationIndex);
      pageProviderPositions.prompts.add(observation.promptKey);
      if (citation.position === 1)
        pageProviderPositions.promptsWithFirstPositionCitation.add(observation.promptKey);
      if (citation.position <= 3)
        pageProviderPositions.promptsWithTopThreeCitation.add(observation.promptKey);
      page.positionsByProvider.set(observation.providerKey, pageProviderPositions);
      pageBuckets.set(citation.url, page);
      if (pathFamilyDepth !== undefined) {
        const family = pathFamilyForCitationUrl(citation.url, pathFamilyDepth);
        if (family) {
          const pathFamily = pathFamilyBuckets.get(family.pathFamily) ?? {
            ...family,
            owned: ownedDomains.length > 0 && isOwnedDomain(citation.domain, ownedDomains),
            urls: new Set<string>(),
            citationEvents: 0,
            answers: new Set<number>(),
            prompts: new Set<string>(),
            providers: new Set<string>(),
            positions: [],
            firstObservedAt: observation.observedAt,
            lastObservedAt: observation.observedAt,
          };
          pathFamily.urls.add(citation.url);
          pathFamily.citationEvents += 1;
          pathFamily.answers.add(observationIndex);
          pathFamily.prompts.add(observation.promptKey);
          pathFamily.providers.add(observation.provider);
          pathFamily.positions.push(citation.position);
          pathFamily.firstObservedAt =
            observation.observedAt < pathFamily.firstObservedAt
              ? observation.observedAt
              : pathFamily.firstObservedAt;
          pathFamily.lastObservedAt =
            observation.observedAt > pathFamily.lastObservedAt
              ? observation.observedAt
              : pathFamily.lastObservedAt;
          pathFamilyBuckets.set(family.pathFamily, pathFamily);
          const pathFamilyCohortProfileKey = JSON.stringify([
            family.pathFamily,
            pathFamilyCohortKey,
          ]);
          const existingPathFamilyCohort = pathFamilyCohortBuckets.get(pathFamilyCohortProfileKey);
          if (
            existingPathFamilyCohort ||
            pathFamilyCohortBuckets.size < MAX_ANSWER_PATH_FAMILY_COHORT_WORKING_ROWS
          ) {
            const pathFamilyCohort = existingPathFamilyCohort ?? {
              ...family,
              owned: ownedDomains.length > 0 && isOwnedDomain(citation.domain, ownedDomains),
              provider: observation.provider,
              providerKey: observation.providerKey,
              ...(observation.topic
                ? { topic: observation.topic, topicKey: observation.topicKey }
                : {}),
              ...(observation.intent
                ? { intent: observation.intent, intentKey: observation.intentKey }
                : {}),
              unlabeled: !hasTopicIntentLabel,
              urls: new Set<string>(),
              citationEvents: 0,
              answers: new Set<number>(),
              prompts: new Set<string>(),
              positions: [],
              firstObservedAt: observation.observedAt,
              lastObservedAt: observation.observedAt,
            };
            pathFamilyCohort.urls.add(citation.url);
            pathFamilyCohort.citationEvents += 1;
            pathFamilyCohort.answers.add(observationIndex);
            pathFamilyCohort.prompts.add(observation.promptKey);
            pathFamilyCohort.positions.push(citation.position);
            pathFamilyCohort.firstObservedAt =
              observation.observedAt < pathFamilyCohort.firstObservedAt
                ? observation.observedAt
                : pathFamilyCohort.firstObservedAt;
            pathFamilyCohort.lastObservedAt =
              observation.observedAt > pathFamilyCohort.lastObservedAt
                ? observation.observedAt
                : pathFamilyCohort.lastObservedAt;
            pathFamilyCohortBuckets.set(pathFamilyCohortProfileKey, pathFamilyCohort);
          } else {
            pathFamilyCohortBucketsTruncated = true;
          }
          const monthlyProfileKey = JSON.stringify([
            monthKey,
            family.pathFamily,
            pathFamilyCohortKey,
          ]);
          const existingMonthlyProfile = pathFamilyMonthlyCohortBuckets.get(monthlyProfileKey);
          if (
            existingMonthlyProfile ||
            pathFamilyMonthlyCohortBuckets.size < MAX_ANSWER_PATH_FAMILY_MONTHLY_COHORT_WORKING_ROWS
          ) {
            const monthlyProfile = existingMonthlyProfile ?? {
              month: monthKey,
              ...family,
              owned: ownedDomains.length > 0 && isOwnedDomain(citation.domain, ownedDomains),
              provider: observation.provider,
              providerKey: observation.providerKey,
              ...(observation.topic
                ? { topic: observation.topic, topicKey: observation.topicKey }
                : {}),
              ...(observation.intent
                ? { intent: observation.intent, intentKey: observation.intentKey }
                : {}),
              unlabeled: !hasTopicIntentLabel,
              urls: new Set<string>(),
              citationEvents: 0,
              answers: new Set<number>(),
              prompts: new Set<string>(),
              positions: [],
              firstObservedAt: observation.observedAt,
              lastObservedAt: observation.observedAt,
            };
            monthlyProfile.urls.add(citation.url);
            monthlyProfile.citationEvents += 1;
            monthlyProfile.answers.add(observationIndex);
            monthlyProfile.prompts.add(observation.promptKey);
            monthlyProfile.positions.push(citation.position);
            monthlyProfile.firstObservedAt =
              observation.observedAt < monthlyProfile.firstObservedAt
                ? observation.observedAt
                : monthlyProfile.firstObservedAt;
            monthlyProfile.lastObservedAt =
              observation.observedAt > monthlyProfile.lastObservedAt
                ? observation.observedAt
                : monthlyProfile.lastObservedAt;
            pathFamilyMonthlyCohortBuckets.set(monthlyProfileKey, monthlyProfile);
          } else {
            pathFamilyMonthlyCohortBucketsTruncated = true;
          }
        }
      }
    }
    promptBuckets.set(observation.promptKey, prompt);
    prompt.providerSamples.set(observation.providerKey, promptProvider);
    providerBuckets.set(observation.providerKey, provider);
    monthlyBuckets.set(monthKey, month);
    if (topicIntentBucket) {
      topicIntentBucket.citationEvents += observation.citations.length;
      if (topicIntentProvider)
        topicIntentBucket.providerSamples.set(observation.providerKey, topicIntentProvider);
      topicIntentBuckets.set(topicIntentKey, topicIntentBucket);
    }
  });
  if (pageBuckets.size > MAX_CITED_PAGES)
    throw new Error(
      `Input has more than ${MAX_CITED_PAGES.toLocaleString('en-US')} distinct cited URLs.`
    );

  const providers = [...providerBuckets.entries()]
    .map(([providerKey, bucket]): AiAnswerCitationProviderProfile => {
      const unknownOwnedPromptCount = [...bucket.incompletePrompts].filter(
        (promptKey) => !bucket.ownedPrompts.has(promptKey)
      ).length;
      const knownOwnedPromptCount = bucket.prompts.size - unknownOwnedPromptCount;
      return {
        provider: bucket.provider,
        observations: bucket.observations,
        uniquePrompts: bucket.prompts.size,
        observationsWithCitations: bucket.withCitations,
        observationsWithoutCitations: bucket.withoutCitations,
        incompleteCitationListObservations: bucket.incompleteCitationLists,
        citationEvents: bucket.citationEvents,
        distinctCitedDomains: bucket.domains.size,
        domainConcentration: summarizeDomainConcentration(
          bucket.domainCitationEvents.values(),
          bucket.citationEvents
        ),
        rankWeightedDomainConcentration: summarizeDomainConcentration(
          bucket.rankWeightedDomainCitationWeights.values(),
          bucket.rankWeightedCitationWeightTotal
        ),
        ...(ownedDomains.length > 0
          ? {
              observationsWithOwnedCitation: bucket.withOwnedCitation,
              observationsWithoutOwnedCitation: bucket.withoutOwnedCitation,
              ownedCitationCoveragePercent: Number(
                ((bucket.withOwnedCitation / bucket.observations) * 100).toFixed(2)
              ),
              observationsWithKnownOwnedCitationState:
                bucket.observations - bucket.unknownOwnedObservations,
              observationsWithUnknownOwnedCitationState: bucket.unknownOwnedObservations,
              ownedCitationCoverageAmongKnownObservationsPercent:
                bucket.observations > bucket.unknownOwnedObservations
                  ? Number(
                      (
                        (bucket.withOwnedCitation /
                          (bucket.observations - bucket.unknownOwnedObservations)) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              ownedCitationCoverageUpperBoundPercent: Number(
                (
                  ((bucket.withOwnedCitation + bucket.unknownOwnedObservations) /
                    bucket.observations) *
                  100
                ).toFixed(2)
              ),
              promptsWithOwnedCitation: bucket.ownedPrompts.size,
              ownedCitationPromptCoveragePercent: Number(
                ((bucket.ownedPrompts.size / bucket.prompts.size) * 100).toFixed(2)
              ),
              promptsWithKnownOwnedCitationState: knownOwnedPromptCount,
              promptsWithUnknownOwnedCitationState: unknownOwnedPromptCount,
              ownedCitationPromptCoverageAmongKnownPromptsPercent:
                knownOwnedPromptCount > 0
                  ? Number(((bucket.ownedPrompts.size / knownOwnedPromptCount) * 100).toFixed(2))
                  : null,
              ownedCitationPromptCoverageUpperBoundPercent: Number(
                (
                  ((bucket.ownedPrompts.size + unknownOwnedPromptCount) / bucket.prompts.size) *
                  100
                ).toFixed(2)
              ),
              ownedCitationPromptCoverageAmongKnownPromptsConfidenceInterval95Percent:
                wilsonRateConfidenceInterval95(bucket.ownedPrompts.size, knownOwnedPromptCount),
              ownedCitationPromptCoverageConfidenceInterval95Percent:
                wilsonRateConfidenceInterval95(bucket.ownedPrompts.size, bucket.prompts.size),
              ownedCitationEvents: countOwnedCitationEvents(
                bucket.domainCitationEvents,
                ownedDomains
              ),
              ownedCitationEventSharePercent:
                bucket.citationEvents > 0
                  ? Number(
                      (
                        (countOwnedCitationEvents(bucket.domainCitationEvents, ownedDomains) /
                          bucket.citationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              ownedFirstCitationMeanReciprocalRankPercent:
                bucket.withOwnedCitation > 0
                  ? Number(
                      (
                        (bucket.ownedFirstCitationReciprocalRankSum / bucket.withOwnedCitation) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              ownedCitationPositionBuckets: summarizeOwnedCitationPositionBuckets(
                ownedPositionBucketCountersByProvider.get(providerKey) ??
                  createCitationPositionBucketCounters()
              ),
            }
          : {}),
      };
    })
    .sort((a, b) => b.observations - a.observations || a.provider.localeCompare(b.provider));

  const domains = [...domainBuckets.values()]
    .map((bucket): AiAnswerCitationDomainProfile => ({
      domain: bucket.domain,
      owned: isOwnedDomain(bucket.domain, ownedDomains),
      citationEvents: bucket.citationEvents,
      observedAnswers: bucket.answers.size,
      uniquePrompts: bucket.prompts.size,
      ...summarizePromptRankReach(
        bucket.promptsWithFirstPositionCitation,
        bucket.promptsWithTopThreeCitation,
        promptLabels.size
      ),
      promptCoveragePercent: Number(((bucket.prompts.size / promptLabels.size) * 100).toFixed(2)),
      promptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
        bucket.prompts.size,
        promptLabels.size
      ),
      providers: [...bucket.providers].sort(),
      citationEventSharePercent:
        citationEvents > 0
          ? Number(((bucket.citationEvents / citationEvents) * 100).toFixed(2))
          : 0,
      sampleUrls: [...bucket.urls].sort().slice(0, 5),
      sampleUrlsTruncated: bucket.urls.size > 5,
      citationListPosition: summarizeCitationListPositions(bucket.positions),
      providerCitationListPositions: [...bucket.positionsByProvider.entries()]
        .map(
          ([
            providerKey,
            {
              provider,
              positions,
              answers,
              prompts,
              promptsWithFirstPositionCitation,
              promptsWithTopThreeCitation,
            },
          ]) => {
            const providerUniquePrompts = providerBuckets.get(providerKey)?.prompts.size ?? 0;
            return {
              provider,
              citationEvents: positions.length,
              observedAnswers: answers.size,
              uniquePrompts: prompts.size,
              providerUniquePrompts,
              promptCoveragePercent:
                providerUniquePrompts > 0
                  ? Number(((prompts.size / providerUniquePrompts) * 100).toFixed(2))
                  : 0,
              promptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
                prompts.size,
                providerUniquePrompts
              ),
              ...summarizePromptRankReach(
                promptsWithFirstPositionCitation,
                promptsWithTopThreeCitation,
                providerUniquePrompts
              ),
              citationListPosition: summarizeCitationListPositions(positions),
            };
          }
        )
        .sort((left, right) => left.provider.localeCompare(right.provider)),
    }))
    .sort(
      (a, b) =>
        b.citationEvents - a.citationEvents ||
        b.observedAnswers - a.observedAnswers ||
        a.domain.localeCompare(b.domain)
    );

  const citedPages = [...pageBuckets.values()]
    .map((bucket): AiAnswerCitationPageProfile => ({
      url: bucket.url,
      domain: bucket.domain,
      owned: isOwnedDomain(bucket.domain, ownedDomains),
      citationEvents: bucket.citationEvents,
      observedAnswers: bucket.answers.size,
      uniquePrompts: bucket.prompts.size,
      providers: [...bucket.providers].sort(),
      citationEventSharePercent:
        citationEvents > 0
          ? Number(((bucket.citationEvents / citationEvents) * 100).toFixed(2))
          : 0,
      firstObservedAt: bucket.firstObservedAt,
      lastObservedAt: bucket.lastObservedAt,
      ...summarizePromptRankReach(
        bucket.promptsWithFirstPositionCitation,
        bucket.promptsWithTopThreeCitation,
        promptLabels.size
      ),
      citationListPosition: summarizeCitationListPositions(bucket.positions),
      providerCitationListPositions: [...bucket.positionsByProvider.entries()]
        .map(
          ([
            providerKey,
            {
              provider,
              positions,
              answers,
              prompts,
              promptsWithFirstPositionCitation,
              promptsWithTopThreeCitation,
            },
          ]) => {
            const providerUniquePrompts = providerBuckets.get(providerKey)?.prompts.size ?? 0;
            return {
              provider,
              citationEvents: positions.length,
              observedAnswers: answers.size,
              uniquePrompts: prompts.size,
              providerUniquePrompts,
              promptCoveragePercent:
                providerUniquePrompts > 0
                  ? Number(((prompts.size / providerUniquePrompts) * 100).toFixed(2))
                  : 0,
              promptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
                prompts.size,
                providerUniquePrompts
              ),
              ...summarizePromptRankReach(
                promptsWithFirstPositionCitation,
                promptsWithTopThreeCitation,
                providerUniquePrompts
              ),
              citationListPosition: summarizeCitationListPositions(positions),
            };
          }
        )
        .sort((left, right) => left.provider.localeCompare(right.provider)),
    }))
    .sort(
      (a, b) =>
        b.citationEvents - a.citationEvents ||
        b.observedAnswers - a.observedAnswers ||
        a.url.localeCompare(b.url)
    );

  const pathFamilies: AiAnswerCitationPathFamilyProfile[] = [...pathFamilyBuckets.values()]
    .map((bucket) => ({
      pathFamily: bucket.pathFamily,
      origin: bucket.origin,
      pathPrefix: bucket.pathPrefix,
      ...(ownedDomains.length > 0 ? { owned: bucket.owned } : {}),
      pages: bucket.urls.size,
      citationEvents: bucket.citationEvents,
      observedAnswers: bucket.answers.size,
      observationCoveragePercent: Number(
        ((bucket.answers.size / observations.length) * 100).toFixed(2)
      ),
      uniquePrompts: bucket.prompts.size,
      providers: [...bucket.providers].sort(),
      citationEventSharePercent:
        citationEvents > 0
          ? Number(((bucket.citationEvents / citationEvents) * 100).toFixed(2))
          : 0,
      citationListPosition: summarizeCitationListPositions(bucket.positions),
      firstObservedAt: bucket.firstObservedAt,
      lastObservedAt: bucket.lastObservedAt,
      sampleUrls: [...bucket.urls].sort().slice(0, MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS),
      sampleUrlsTruncated: bucket.urls.size > MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS,
    }))
    .sort(
      (left, right) =>
        right.citationEvents - left.citationEvents ||
        right.observedAnswers - left.observedAnswers ||
        left.pathFamily.localeCompare(right.pathFamily)
    );

  const pathFamilyCohorts: AiAnswerCitationPathFamilyCohortProfile[] = [
    ...pathFamilyCohortBuckets.values(),
  ]
    .map((bucket) => {
      const cohortKey = JSON.stringify([
        bucket.providerKey,
        bucket.unlabeled ? null : `${bucket.topicKey ?? ''}\u0000${bucket.intentKey ?? ''}`,
      ]);
      const cohort = pathFamilyCohortSamples.get(cohortKey)!;
      const wholeSampleFamily = pathFamilyBuckets.get(bucket.pathFamily)!;
      const wholeSampleShareRaw = (wholeSampleFamily.citationEvents / citationEvents) * 100;
      const wholeSampleShare = Number(wholeSampleShareRaw.toFixed(2));
      const cohortShareRaw =
        cohort.citationEvents > 0 ? (bucket.citationEvents / cohort.citationEvents) * 100 : 0;
      const cohortShare = Number(cohortShareRaw.toFixed(2));
      return {
        pathFamily: bucket.pathFamily,
        origin: bucket.origin,
        pathPrefix: bucket.pathPrefix,
        ...(ownedDomains.length > 0 ? { owned: bucket.owned } : {}),
        provider: bucket.provider,
        ...(bucket.topic ? { topic: bucket.topic } : {}),
        ...(bucket.intent ? { intent: bucket.intent } : {}),
        unlabeled: bucket.unlabeled,
        pages: bucket.urls.size,
        citationEvents: bucket.citationEvents,
        observationsCitingFamily: bucket.answers.size,
        cohortObservations: cohort.observations,
        observationCoveragePercent: Number(
          ((bucket.answers.size / cohort.observations) * 100).toFixed(2)
        ),
        observationCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          bucket.answers.size,
          cohort.observations
        ),
        uniquePromptsCitingFamily: bucket.prompts.size,
        cohortUniquePrompts: cohort.prompts.size,
        promptCoveragePercent: Number(
          ((bucket.prompts.size / cohort.prompts.size) * 100).toFixed(2)
        ),
        promptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          bucket.prompts.size,
          cohort.prompts.size
        ),
        cohortCitationEvents: cohort.citationEvents,
        citationEventShareWithinCohortPercent: cohortShare,
        citationEventShareBenchmark: 'whole-sample' as const,
        benchmarkCitationEventSharePercent: wholeSampleShare,
        cohortEventShareDifferenceFromBenchmarkPercentagePoints: Number(
          (cohortShareRaw - wholeSampleShareRaw).toFixed(2)
        ),
        cohortEventShareLiftVsBenchmark:
          wholeSampleShareRaw > 0 ? Number((cohortShareRaw / wholeSampleShareRaw).toFixed(4)) : 0,
        citationListPosition: summarizeCitationListPositions(bucket.positions),
        firstObservedAt: bucket.firstObservedAt,
        lastObservedAt: bucket.lastObservedAt,
        sampleUrls: [...bucket.urls].sort().slice(0, MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS),
        sampleUrlsTruncated: bucket.urls.size > MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS,
      };
    })
    .sort(
      (left, right) =>
        right.citationEvents - left.citationEvents ||
        right.observationsCitingFamily - left.observationsCitingFamily ||
        left.provider.localeCompare(right.provider) ||
        left.pathFamily.localeCompare(right.pathFamily)
    );

  const monthlyCohortCitationEventTotals = new Map<string, number>();
  for (const cohort of pathFamilyMonthlyCohortSamples.values()) {
    monthlyCohortCitationEventTotals.set(
      cohort.month,
      (monthlyCohortCitationEventTotals.get(cohort.month) ?? 0) + cohort.citationEvents
    );
  }
  const monthlyPathFamilyCitationEventTotals = new Map<string, number>();
  for (const bucket of pathFamilyMonthlyCohortBuckets.values()) {
    const key = JSON.stringify([bucket.month, bucket.pathFamily]);
    monthlyPathFamilyCitationEventTotals.set(
      key,
      (monthlyPathFamilyCitationEventTotals.get(key) ?? 0) + bucket.citationEvents
    );
  }
  const pathFamilyMonthlyCohorts: AiAnswerCitationPathFamilyMonthlyProfile[] = [
    ...pathFamilyMonthlyCohortBuckets.values(),
  ]
    .map((bucket) => {
      const topicIntentKey = `${bucket.topicKey ?? ''}\u0000${bucket.intentKey ?? ''}`;
      const cohortKey = JSON.stringify([
        bucket.month,
        JSON.stringify([bucket.providerKey, bucket.unlabeled ? null : topicIntentKey]),
      ]);
      const cohort = pathFamilyMonthlyCohortSamples.get(cohortKey)!;
      const monthCitationEvents = monthlyCohortCitationEventTotals.get(bucket.month) ?? 0;
      const monthFamilyCitationEvents =
        monthlyPathFamilyCitationEventTotals.get(
          JSON.stringify([bucket.month, bucket.pathFamily])
        ) ?? 0;
      const monthBenchmarkShareRaw =
        monthCitationEvents > 0 ? (monthFamilyCitationEvents / monthCitationEvents) * 100 : 0;
      const monthBenchmarkShare = Number(monthBenchmarkShareRaw.toFixed(2));
      const cohortShareRaw =
        cohort.citationEvents > 0 ? (bucket.citationEvents / cohort.citationEvents) * 100 : 0;
      const cohortShare = Number(cohortShareRaw.toFixed(2));
      return {
        month: bucket.month,
        previousFamilyCitedMonth: null,
        pathFamily: bucket.pathFamily,
        origin: bucket.origin,
        pathPrefix: bucket.pathPrefix,
        ...(ownedDomains.length > 0 ? { owned: bucket.owned } : {}),
        provider: bucket.provider,
        ...(bucket.topic ? { topic: bucket.topic } : {}),
        ...(bucket.intent ? { intent: bucket.intent } : {}),
        unlabeled: bucket.unlabeled,
        pages: bucket.urls.size,
        citationEvents: bucket.citationEvents,
        observationsCitingFamily: bucket.answers.size,
        cohortObservations: cohort.observations,
        observationCoveragePercent: Number(
          ((bucket.answers.size / cohort.observations) * 100).toFixed(2)
        ),
        observationCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          bucket.answers.size,
          cohort.observations
        ),
        uniquePromptsCitingFamily: bucket.prompts.size,
        cohortUniquePrompts: cohort.prompts.size,
        promptCoveragePercent: Number(
          ((bucket.prompts.size / cohort.prompts.size) * 100).toFixed(2)
        ),
        promptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          bucket.prompts.size,
          cohort.prompts.size
        ),
        cohortCitationEvents: cohort.citationEvents,
        citationEventShareWithinCohortPercent: cohortShare,
        ...(!pathFamilyMonthlyCohortBucketsTruncated && monthCitationEvents > 0
          ? {
              citationEventShareBenchmark: 'same-month' as const,
              benchmarkCitationEventSharePercent: monthBenchmarkShare,
              cohortEventShareDifferenceFromBenchmarkPercentagePoints: Number(
                (cohortShareRaw - monthBenchmarkShareRaw).toFixed(2)
              ),
              cohortEventShareLiftVsBenchmark:
                monthBenchmarkShareRaw > 0
                  ? Number((cohortShareRaw / monthBenchmarkShareRaw).toFixed(4))
                  : 0,
            }
          : {}),
        citationListPosition: summarizeCitationListPositions(bucket.positions),
        firstObservedAt: bucket.firstObservedAt,
        lastObservedAt: bucket.lastObservedAt,
        sampleUrls: [...bucket.urls].sort().slice(0, MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS),
        sampleUrlsTruncated: bucket.urls.size > MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS,
      };
    })
    .sort(
      (left, right) =>
        right.month.localeCompare(left.month) ||
        right.citationEvents - left.citationEvents ||
        left.provider.localeCompare(right.provider) ||
        left.pathFamily.localeCompare(right.pathFamily)
    );

  if (pathFamilyMonthlyCohortBucketsTruncated) {
    for (const profile of pathFamilyMonthlyCohorts) {
      profile.previousFamilyCitedMonth = undefined;
      profile.interveningCalendarMonthsWithoutFamilyRow = undefined;
      profile.cohortEventShareLiftChangeFromPreviousFamilyCitedMonth = null;
      profile.cohortEventShareLiftRelativeChangePercentFromPreviousFamilyCitedMonth = null;
    }
  } else {
    const pathFamilyMonthlySeries = new Map<string, AiAnswerCitationPathFamilyMonthlyProfile[]>();
    for (const profile of pathFamilyMonthlyCohorts) {
      const cohortKey = profile.unlabeled
        ? null
        : `${profile.topic ?? ''}\u0000${profile.intent ?? ''}`;
      const seriesKey = JSON.stringify([profile.pathFamily, profile.provider, cohortKey]);
      const series = pathFamilyMonthlySeries.get(seriesKey) ?? [];
      series.push(profile);
      pathFamilyMonthlySeries.set(seriesKey, series);
    }
    for (const series of pathFamilyMonthlySeries.values()) {
      series.sort((left, right) => left.month.localeCompare(right.month));
      for (let index = 1; index < series.length; index += 1) {
        const previous = series[index - 1]!;
        const current = series[index]!;
        const previousMonth =
          Number(previous.month.slice(0, 4)) * 12 + Number(previous.month.slice(5, 7)) - 1;
        const currentMonth =
          Number(current.month.slice(0, 4)) * 12 + Number(current.month.slice(5, 7)) - 1;
        current.previousFamilyCitedMonth = previous.month;
        current.interveningCalendarMonthsWithoutFamilyRow = Math.max(
          0,
          currentMonth - previousMonth - 1
        );
        const previousLift = previous.cohortEventShareLiftVsBenchmark;
        const currentLift = current.cohortEventShareLiftVsBenchmark;
        if (previousLift === undefined || currentLift === undefined) {
          current.cohortEventShareLiftChangeFromPreviousFamilyCitedMonth = null;
          current.cohortEventShareLiftRelativeChangePercentFromPreviousFamilyCitedMonth = null;
        } else {
          const absoluteChange = currentLift - previousLift;
          current.cohortEventShareLiftChangeFromPreviousFamilyCitedMonth = Number(
            absoluteChange.toFixed(4)
          );
          current.cohortEventShareLiftRelativeChangePercentFromPreviousFamilyCitedMonth =
            previousLift > 0 ? Number(((absoluteChange / previousLift) * 100).toFixed(2)) : null;
        }
      }
    }
  }

  const prompts = [...promptBuckets.values()]
    .map((bucket): AiAnswerCitationPromptProfile => {
      const citedDomains = [...bucket.domains.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([domain]) => domain);
      const domainProviderCounts = new Map<
        string,
        { providers: Set<string>; citationEvents: number }
      >();
      for (const [providerKey, providerDomains] of bucket.domainsByProvider) {
        for (const [domain, providerCitationEvents] of providerDomains) {
          const shared = domainProviderCounts.get(domain) ?? {
            providers: new Set<string>(),
            citationEvents: 0,
          };
          shared.providers.add(providerLabels.get(providerKey) ?? providerKey);
          shared.citationEvents += providerCitationEvents;
          domainProviderCounts.set(domain, shared);
        }
      }
      const crossProviderCitedDomains = [...domainProviderCounts.entries()]
        .filter(([, value]) => value.providers.size > 1)
        .map(([domain, value]) => ({
          domain,
          providers: [...value.providers].sort(),
          citationEvents: value.citationEvents,
        }))
        .sort(
          (left, right) =>
            right.providers.length - left.providers.length ||
            right.citationEvents - left.citationEvents ||
            left.domain.localeCompare(right.domain)
        );
      const providerProfiles = [...bucket.providerSamples.values()]
        .map((providerProfile): AiAnswerCitationPromptProviderProfile => {
          const providerDomains = [...providerProfile.domains.entries()]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .map(([domain]) => domain);
          return {
            provider: providerProfile.provider,
            observations: providerProfile.observations,
            incompleteCitationListObservations: providerProfile.incompleteCitationLists,
            observationsWithCitations: providerProfile.withCitations,
            observationsWithoutCitations: providerProfile.withoutCitations,
            citationEvents: providerProfile.citationEvents,
            domainConcentration: summarizeDomainConcentration(
              providerProfile.domains.values(),
              providerProfile.citationEvents
            ),
            ...(ownedDomains.length > 0
              ? {
                  observationsWithOwnedCitation: providerProfile.withOwnedCitation,
                  observationsWithoutOwnedCitation: providerProfile.withoutOwnedCitation,
                  ownedCitationEvents: providerProfile.ownedCitationEvents,
                  ownedCitationEventSharePercent:
                    providerProfile.citationEvents > 0
                      ? Number(
                          (
                            (providerProfile.ownedCitationEvents / providerProfile.citationEvents) *
                            100
                          ).toFixed(2)
                        )
                      : null,
                  ownedFirstPositionCitationEvents:
                    providerProfile.ownedFirstPositionCitationEvents,
                  ownedTopThreeCitationEvents: providerProfile.ownedTopThreeCitationEvents,
                  ownedFirstCitationMeanReciprocalRankPercent:
                    providerProfile.withOwnedCitation > 0
                      ? Number(
                          (
                            (providerProfile.ownedFirstCitationReciprocalRankSum /
                              providerProfile.withOwnedCitation) *
                            100
                          ).toFixed(2)
                        )
                      : null,
                }
              : {}),
            firstObservedAt: providerProfile.firstObservedAt,
            lastObservedAt: providerProfile.lastObservedAt,
            citedDomains: providerDomains.slice(0, 10),
            citedDomainCitationEvents: [...providerProfile.domains.entries()]
              .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
              .slice(0, 10)
              .map(([domain, citationEvents]) => ({ domain, citationEvents })),
            citedDomainsTruncated: providerDomains.length > 10,
            rankWeightedDomainCitationEvents: [...providerProfile.rankWeightedDomains.entries()]
              .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
              .slice(0, 10)
              .map(([domain, discountedCitationWeight]) => ({ domain, discountedCitationWeight })),
            rankWeightedCitationWeightTotal: providerProfile.rankWeightedCitationWeightTotal,
            rankWeightedDomainsTruncated: providerProfile.rankWeightedDomains.size > 10,
          };
        })
        .sort((left, right) => left.provider.localeCompare(right.provider));
      return {
        prompt: bucket.prompt,
        observations: bucket.observations,
        uniqueProviders: bucket.providers.size,
        providers: [...bucket.providers].sort(),
        observationsWithCitations: bucket.withCitations,
        observationsWithoutCitations: bucket.withoutCitations,
        citationEvents: bucket.citationEvents,
        ...(ownedDomains.length > 0
          ? {
              observationsWithOwnedCitation: bucket.withOwnedCitation,
              observationsWithoutOwnedCitation: bucket.withoutOwnedCitation,
              ownedCitationEvents: countOwnedCitationEvents(bucket.domains, ownedDomains),
              ownedCitationEventSharePercent:
                bucket.citationEvents > 0
                  ? Number(
                      (
                        (countOwnedCitationEvents(bucket.domains, ownedDomains) /
                          bucket.citationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
            }
          : {}),
        providerProfiles,
        firstObservedAt: bucket.firstObservedAt,
        lastObservedAt: bucket.lastObservedAt,
        citedDomains: citedDomains.slice(0, 10),
        citedDomainsTruncated: citedDomains.length > 10,
        crossProviderCitedDomains: crossProviderCitedDomains.slice(0, 10),
        crossProviderCitedDomainsTruncated: crossProviderCitedDomains.length > 10,
      };
    })
    .sort(
      (a, b) =>
        b.observations - a.observations ||
        b.uniqueProviders - a.uniqueProviders ||
        a.prompt.localeCompare(b.prompt)
    );

  const reviewQueue: AiAnswerCitationReviewOpportunity[] = prompts
    .flatMap((profile) => {
      if (profile.observations < 2) return [];
      let reason: AiAnswerCitationReviewReason | undefined;
      if (profile.observationsWithCitations === 0) reason = 'repeated-without-citations';
      else if (ownedDomains.length > 0 && profile.observationsWithOwnedCitation === 0)
        reason = 'repeated-without-owned-citation';
      else if (
        ownedDomains.length > 0 &&
        (profile.observationsWithOwnedCitation ?? 0) < profile.observations
      )
        reason = 'inconsistent-owned-citation';
      if (!reason) return [];
      return [
        {
          reason,
          prompt: profile.prompt,
          observations: profile.observations,
          uniqueProviders: profile.uniqueProviders,
          observationsWithCitations: profile.observationsWithCitations,
          ...(ownedDomains.length > 0
            ? { observationsWithOwnedCitation: profile.observationsWithOwnedCitation }
            : {}),
          citedDomains: profile.citedDomains,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.observations - a.observations ||
        b.uniqueProviders - a.uniqueProviders ||
        a.prompt.localeCompare(b.prompt)
    );

  const monthly = [...monthlyBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, bucket]): AiAnswerCitationMonthlyProfile => ({
      month,
      observations: bucket.observations,
      observationsWithCitations: bucket.withCitations,
      observationsWithoutCitations: bucket.withoutCitations,
      ...(ownedDomains.length > 0
        ? {
            observationsWithOwnedCitation: bucket.withOwnedCitation,
            observationsWithoutOwnedCitation: bucket.withoutOwnedCitation,
            ownedCitationEvents: countOwnedCitationEvents(bucket.domains, ownedDomains),
            ownedCitationEventSharePercent:
              bucket.citationEvents > 0
                ? Number(
                    (
                      (countOwnedCitationEvents(bucket.domains, ownedDomains) /
                        bucket.citationEvents) *
                      100
                    ).toFixed(2)
                  )
                : null,
          }
        : {}),
      citationEvents: bucket.citationEvents,
      citationListPosition:
        bucket.positions.length > 0 ? summarizeCitationListPositions(bucket.positions) : null,
    }));

  const monthlyOwnedCitationPromptRanks = new WeakMap<
    AiAnswerCitationTopicIntentProviderMonthlyProfile,
    TopicIntentMonthBucket['ownedFirstCitationPromptRanks']
  >();
  const monthlyPromptPanels = new WeakMap<
    AiAnswerCitationTopicIntentProviderMonthlyProfile,
    Pick<TopicIntentMonthBucket, 'prompts' | 'ownedPrompts'>
  >();
  const topicIntentProviderMonthly = [...topicIntentMonthlyBuckets.values()]
    .map((bucket): AiAnswerCitationTopicIntentProviderMonthlyProfile => {
      const citedDomains = [...bucket.domains.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([domain]) => domain);
      const ownedMrrPromptValues = [...bucket.ownedFirstCitationPromptRanks.values()]
        .filter((prompt) => prompt.observations > 0)
        .map((prompt) => (prompt.reciprocalRankSum / prompt.observations) * 100);
      const ownedMrrSeed = JSON.stringify([
        bucket.month,
        bucket.topic ?? '',
        bucket.intent ?? '',
        bucket.provider,
        bucket.unlabeled,
      ]);
      const unknownOwnedPromptCount = [...bucket.incompletePrompts].filter(
        (promptKey) => !bucket.ownedPrompts.has(promptKey)
      ).length;
      const knownOwnedPromptCount = bucket.prompts.size - unknownOwnedPromptCount;
      const knownOwnedObservationCount =
        bucket.observations - bucket.unknownOwnedCitationStateObservations;
      const profile: AiAnswerCitationTopicIntentProviderMonthlyProfile = {
        month: bucket.month,
        ...(bucket.topic ? { topic: bucket.topic } : {}),
        ...(bucket.intent ? { intent: bucket.intent } : {}),
        provider: bucket.provider,
        unlabeled: bucket.unlabeled,
        observations: bucket.observations,
        uniquePrompts: bucket.prompts.size,
        incompleteCitationListObservations: bucket.incompleteCitationListObservations,
        incompleteCitationListSharePercent: Number(
          ((bucket.incompleteCitationListObservations / bucket.observations) * 100).toFixed(2)
        ),
        ...(ownedDomains.length > 0
          ? {
              unknownOwnedCitationStateObservations: bucket.unknownOwnedCitationStateObservations,
              unknownOwnedCitationStateObservationSharePercent: Number(
                (
                  (bucket.unknownOwnedCitationStateObservations / bucket.observations) *
                  100
                ).toFixed(2)
              ),
              ownedCitationCoverageAmongKnownObservationsPercent:
                knownOwnedObservationCount > 0
                  ? Number(
                      ((bucket.withOwnedCitation / knownOwnedObservationCount) * 100).toFixed(2)
                    )
                  : null,
              ownedCitationCoverageUpperBoundPercent: Number(
                (
                  ((bucket.withOwnedCitation + bucket.unknownOwnedCitationStateObservations) /
                    bucket.observations) *
                  100
                ).toFixed(2)
              ),
              unknownOwnedCitationStatePrompts: unknownOwnedPromptCount,
              unknownOwnedCitationStatePromptSharePercent:
                bucket.prompts.size > 0
                  ? Number(((unknownOwnedPromptCount / bucket.prompts.size) * 100).toFixed(2))
                  : 0,
              ownedCitationPromptCoverageAmongKnownPromptsPercent:
                knownOwnedPromptCount > 0
                  ? Number(((bucket.ownedPrompts.size / knownOwnedPromptCount) * 100).toFixed(2))
                  : null,
              ownedCitationPromptCoverageUpperBoundPercent:
                bucket.prompts.size > 0
                  ? Number(
                      (
                        ((bucket.ownedPrompts.size + unknownOwnedPromptCount) /
                          bucket.prompts.size) *
                        100
                      ).toFixed(2)
                    )
                  : 0,
            }
          : {}),
        observationsWithCitations: bucket.withCitations,
        citationCoveragePercent: Number(
          ((bucket.withCitations / bucket.observations) * 100).toFixed(2)
        ),
        citationEvents: bucket.citationEvents,
        citationListPosition:
          bucket.positions.length > 0 ? summarizeCitationListPositions(bucket.positions) : null,
        citationDomainProfiles: citedDomains
          .slice(0, 10)
          .map((domain): AiAnswerCitationMonthlyDomainProfile => ({
            domain,
            citationEvents: bucket.domains.get(domain) ?? 0,
            citationListPosition: summarizeCitationListPositions(
              bucket.domainPositions.get(domain) ?? []
            ),
          })),
        citationDomainProfilesTruncated: citedDomains.length > 10,
        ...(ownedDomains.length > 0
          ? {
              ownedCitationEvents: countOwnedCitationEvents(bucket.domains, ownedDomains),
              ownedCitationEventSharePercent:
                bucket.citationEvents > 0
                  ? Number(
                      (
                        (countOwnedCitationEvents(bucket.domains, ownedDomains) /
                          bucket.citationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              ownedCitationPositionBuckets: summarizeOwnedCitationPositionBuckets(
                bucket.ownedPositionBuckets ?? createCitationPositionBucketCounters()
              ),
            }
          : {}),
        ...(ownedDomains.length > 0
          ? {
              observationsWithOwnedCitation: bucket.withOwnedCitation,
              promptsWithOwnedCitation: bucket.ownedPrompts.size,
              ownedCitationCoveragePercent: Number(
                ((bucket.withOwnedCitation / bucket.observations) * 100).toFixed(2)
              ),
              ownedCitationPromptCoveragePercent:
                bucket.prompts.size > 0
                  ? Number(((bucket.ownedPrompts.size / bucket.prompts.size) * 100).toFixed(2))
                  : 0,
              ownedCitationPromptCoverageConfidenceInterval95Percent:
                wilsonRateConfidenceInterval95(bucket.ownedPrompts.size, bucket.prompts.size),
              ownedFirstCitationMeanReciprocalRankPercent:
                bucket.withOwnedCitation > 0
                  ? Number(
                      (
                        (bucket.ownedFirstCitationReciprocalRankSum / bucket.withOwnedCitation) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrPercent:
                ownedMrrPromptValues.length > 0
                  ? Number(
                      (
                        ownedMrrPromptValues.reduce((sum, value) => sum + value, 0) /
                        ownedMrrPromptValues.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedMrrPromptValues,
                  `${ownedMrrSeed}:owned-first-citation-mrr`
                ),
            }
          : {}),
        citedDomains: citedDomains.slice(0, 10),
        citedDomainsTruncated: citedDomains.length > 10,
      };
      if (ownedDomains.length > 0) {
        monthlyOwnedCitationPromptRanks.set(profile, bucket.ownedFirstCitationPromptRanks);
        monthlyPromptPanels.set(profile, {
          prompts: bucket.prompts,
          ownedPrompts: bucket.ownedPrompts,
        });
      }
      return profile;
    })
    .sort(
      (left, right) =>
        left.month.localeCompare(right.month) ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.provider.localeCompare(right.provider)
    );
  const previousSampleBySegment = new Map<
    string,
    AiAnswerCitationTopicIntentProviderMonthlyProfile
  >();
  const monthIndex = (month: string): number => {
    const [year, monthNumber] = month.split('-').map(Number);
    return year! * 12 + monthNumber! - 1;
  };
  for (const profile of topicIntentProviderMonthly) {
    const segmentKey = JSON.stringify([
      profile.topic?.toLowerCase() ?? null,
      profile.intent?.toLowerCase() ?? null,
      profile.unlabeled,
      profile.provider.toLowerCase(),
    ]);
    const previous = previousSampleBySegment.get(segmentKey);
    if (previous) {
      const monthGap = monthIndex(profile.month) - monthIndex(previous.month);
      const previousDomains = new Set(previous.citedDomains);
      const currentDomains = new Set(profile.citedDomains);
      profile.previousObservedMonth = previous.month;
      profile.monthsWithoutSamplesBetweenPreviousObservation = Math.max(0, monthGap - 1);
      profile.previousObservations = previous.observations;
      profile.previousUniquePrompts = previous.uniquePrompts;
      if (
        profile.incompleteCitationListSharePercent !== undefined &&
        previous.incompleteCitationListSharePercent !== undefined
      ) {
        profile.previousIncompleteCitationListSharePercent =
          previous.incompleteCitationListSharePercent;
        profile.incompleteCitationListShareChangePercentagePoints = Number(
          (
            profile.incompleteCitationListSharePercent - previous.incompleteCitationListSharePercent
          ).toFixed(2)
        );
      }
      if (
        profile.unknownOwnedCitationStateObservationSharePercent !== undefined &&
        previous.unknownOwnedCitationStateObservationSharePercent !== undefined
      ) {
        profile.previousUnknownOwnedCitationStateObservationSharePercent =
          previous.unknownOwnedCitationStateObservationSharePercent;
        profile.unknownOwnedCitationStateObservationShareChangePercentagePoints = Number(
          (
            profile.unknownOwnedCitationStateObservationSharePercent -
            previous.unknownOwnedCitationStateObservationSharePercent
          ).toFixed(2)
        );
      }
      if (
        profile.unknownOwnedCitationStatePromptSharePercent !== undefined &&
        previous.unknownOwnedCitationStatePromptSharePercent !== undefined
      ) {
        profile.previousUnknownOwnedCitationStatePromptSharePercent =
          previous.unknownOwnedCitationStatePromptSharePercent;
        profile.unknownOwnedCitationStatePromptShareChangePercentagePoints = Number(
          (
            profile.unknownOwnedCitationStatePromptSharePercent -
            previous.unknownOwnedCitationStatePromptSharePercent
          ).toFixed(2)
        );
      }
      profile.previousObservationsWithCitations = previous.observationsWithCitations;
      profile.previousCitationCoveragePercent = previous.citationCoveragePercent;
      profile.citationCoverageChangePercentagePoints = Number(
        (
          (profile.observationsWithCitations / profile.observations) * 100 -
          (previous.observationsWithCitations / previous.observations) * 100
        ).toFixed(2)
      );
      if (
        profile.ownedCitationCoveragePercent !== undefined &&
        previous.ownedCitationCoveragePercent !== undefined
      ) {
        profile.previousOwnedCitationCoveragePercent = previous.ownedCitationCoveragePercent;
        profile.ownedCitationCoverageChangePercentagePoints = Number(
          (profile.ownedCitationCoveragePercent - previous.ownedCitationCoveragePercent).toFixed(2)
        );
      }
      if (
        profile.promptsWithOwnedCitation !== undefined &&
        previous.promptsWithOwnedCitation !== undefined
      ) {
        profile.previousPromptsWithOwnedCitation = previous.promptsWithOwnedCitation;
      }
      if (
        profile.ownedCitationPromptCoveragePercent !== undefined &&
        previous.ownedCitationPromptCoveragePercent !== undefined
      ) {
        profile.previousOwnedCitationPromptCoveragePercent =
          previous.ownedCitationPromptCoveragePercent;
        profile.ownedCitationPromptCoverageChangePercentagePoints = Number(
          (
            profile.ownedCitationPromptCoveragePercent - previous.ownedCitationPromptCoveragePercent
          ).toFixed(2)
        );
        const previousPanel = monthlyPromptPanels.get(previous);
        const currentPanel = monthlyPromptPanels.get(profile);
        if (previousPanel && currentPanel) {
          const pairedPromptDeltas: number[] = [];
          let gained = 0;
          let lost = 0;
          for (const promptKey of previousPanel.prompts) {
            if (!currentPanel.prompts.has(promptKey)) continue;
            const previousOwned = previousPanel.ownedPrompts.has(promptKey);
            const currentOwned = currentPanel.ownedPrompts.has(promptKey);
            if (!previousOwned && currentOwned) gained += 1;
            if (previousOwned && !currentOwned) lost += 1;
            pairedPromptDeltas.push((currentOwned ? 100 : 0) - (previousOwned ? 100 : 0));
          }
          profile.promptsInBothSampledMonths = pairedPromptDeltas.length;
          profile.ownedCitationPromptsGainedSincePreviousSampledMonth = gained;
          profile.ownedCitationPromptsLostSincePreviousSampledMonth = lost;
          profile.pairedPromptOwnedCitationReachChangePercentagePoints =
            pairedPromptDeltas.length > 0
              ? Number(
                  (
                    pairedPromptDeltas.reduce((sum, value) => sum + value, 0) /
                    pairedPromptDeltas.length
                  ).toFixed(2)
                )
              : null;
          profile.pairedPromptOwnedCitationReachChangeConfidenceInterval95PercentagePoints =
            bootstrapMeanDifferenceConfidenceInterval95(
              pairedPromptDeltas,
              JSON.stringify([
                previous.month,
                profile.month,
                profile.provider,
                profile.topic ?? null,
                profile.intent ?? null,
                profile.unlabeled,
                'paired-owned-prompt-reach',
              ])
            );
          profile.pairedPromptOwnedCitationReachExactMcNemarPValue =
            pairedPromptDeltas.length > 0 ? pairedExactMcNemarPValue(gained, lost) : null;
        }
      }
      if (
        profile.ownedFirstCitationMeanReciprocalRankPercent !== undefined &&
        previous.ownedFirstCitationMeanReciprocalRankPercent !== undefined
      ) {
        profile.previousOwnedFirstCitationMeanReciprocalRankPercent =
          previous.ownedFirstCitationMeanReciprocalRankPercent;
        profile.ownedFirstCitationMeanReciprocalRankChangeFromPreviousSampledMonthPercentagePoints =
          profile.ownedFirstCitationMeanReciprocalRankPercent === null ||
          previous.ownedFirstCitationMeanReciprocalRankPercent === null
            ? null
            : Number(
                (
                  profile.ownedFirstCitationMeanReciprocalRankPercent -
                  previous.ownedFirstCitationMeanReciprocalRankPercent
                ).toFixed(2)
              );
      }
      if (
        profile.equalPromptMeanOwnedFirstCitationMrrPercent !== undefined &&
        previous.equalPromptMeanOwnedFirstCitationMrrPercent !== undefined
      ) {
        profile.previousEqualPromptMeanOwnedFirstCitationMrrPercent =
          previous.equalPromptMeanOwnedFirstCitationMrrPercent;
        profile.equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints =
          profile.equalPromptMeanOwnedFirstCitationMrrPercent === null ||
          previous.equalPromptMeanOwnedFirstCitationMrrPercent === null
            ? null
            : Number(
                (
                  profile.equalPromptMeanOwnedFirstCitationMrrPercent -
                  previous.equalPromptMeanOwnedFirstCitationMrrPercent
                ).toFixed(2)
              );
      }
      if (
        profile.promptsWithOwnedCitation !== undefined &&
        previous.promptsWithOwnedCitation !== undefined
      ) {
        const emptyPromptRanks = (): TopicIntentMonthBucket['ownedFirstCitationPromptRanks'] =>
          new Map();
        const previousPromptRanks =
          monthlyOwnedCitationPromptRanks.get(previous) ?? emptyPromptRanks();
        const currentPromptRanks =
          monthlyOwnedCitationPromptRanks.get(profile) ?? emptyPromptRanks();
        const pairedPromptRanks: Array<{ previousRank: number; currentRank: number }> = [];
        for (const [promptKey, previousRank] of previousPromptRanks) {
          const currentRank = currentPromptRanks.get(promptKey);
          if (!currentRank || previousRank.observations <= 0 || currentRank.observations <= 0)
            continue;
          pairedPromptRanks.push({
            previousRank: (previousRank.reciprocalRankSum / previousRank.observations) * 100,
            currentRank: (currentRank.reciprocalRankSum / currentRank.observations) * 100,
          });
        }
        const pairedPromptDeltas = pairedPromptRanks.map(
          ({ previousRank, currentRank }) => currentRank - previousRank
        );
        const pairedPromptMean = (values: number[]): number | null =>
          values.length > 0
            ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
            : null;
        profile.promptsWithOwnedCitationRankInBothSampledMonths = pairedPromptRanks.length;
        profile.previousOnlyPromptsWithOwnedCitationRank =
          previousPromptRanks.size - pairedPromptRanks.length;
        profile.currentOnlyPromptsWithOwnedCitationRank =
          currentPromptRanks.size - pairedPromptRanks.length;
        profile.previousPairedPromptMeanOwnedFirstCitationMrrPercent = pairedPromptMean(
          pairedPromptRanks.map(({ previousRank }) => previousRank)
        );
        profile.currentPairedPromptMeanOwnedFirstCitationMrrPercent = pairedPromptMean(
          pairedPromptRanks.map(({ currentRank }) => currentRank)
        );
        profile.pairedPromptMeanOwnedFirstCitationMrrChangePercentagePoints =
          pairedPromptMean(pairedPromptDeltas);
        profile.pairedPromptMeanOwnedFirstCitationMrrChangeConfidenceInterval95PercentagePoints =
          bootstrapMeanDifferenceConfidenceInterval95(
            pairedPromptDeltas,
            JSON.stringify([
              previous.month,
              profile.month,
              profile.provider,
              profile.topic ?? null,
              profile.intent ?? null,
              profile.unlabeled,
              'paired-owned-first-citation-mrr',
            ])
          );
      }
      if (
        profile.ownedCitationEventSharePercent !== undefined &&
        previous.ownedCitationEventSharePercent !== undefined
      ) {
        profile.previousOwnedCitationEventSharePercent = previous.ownedCitationEventSharePercent;
        profile.ownedCitationEventShareChangePercentagePoints =
          profile.ownedCitationEventSharePercent === null ||
          previous.ownedCitationEventSharePercent === null
            ? null
            : Number(
                (
                  profile.ownedCitationEventSharePercent - previous.ownedCitationEventSharePercent
                ).toFixed(2)
              );
      }
      if (profile.ownedCitationPositionBuckets && previous.ownedCitationPositionBuckets) {
        profile.ownedCitationPositionBucketChanges = CITATION_POSITION_BUCKET_RANGES.map(
          (range) => {
            const before = previous.ownedCitationPositionBuckets!.find(
              (bucket) => bucket.range === range
            )!;
            const after = profile.ownedCitationPositionBuckets!.find(
              (bucket) => bucket.range === range
            )!;
            return {
              range,
              previousOwnedCitationEvents: before.ownedCitationEvents,
              previousOwnedCitationEventSharePercent: before.ownedCitationEventSharePercent,
              ownedCitationEventShareChangePercentagePoints:
                before.ownedCitationEventSharePercent === null ||
                after.ownedCitationEventSharePercent === null
                  ? null
                  : Number(
                      (
                        after.ownedCitationEventSharePercent - before.ownedCitationEventSharePercent
                      ).toFixed(2)
                    ),
            };
          }
        );
      }
      if (
        profile.citationListPosition !== undefined &&
        previous.citationListPosition !== undefined
      ) {
        const currentPosition = profile.citationListPosition;
        const previousPosition = previous.citationListPosition;
        if (currentPosition?.positionBuckets && previousPosition?.positionBuckets) {
          profile.citationPositionBucketChanges = CITATION_POSITION_BUCKET_RANGES.map((range) => {
            const before = previousPosition.positionBuckets!.find(
              (bucket) => bucket.range === range
            );
            const after = currentPosition.positionBuckets!.find((bucket) => bucket.range === range);
            return {
              range,
              previousCitationEvents: before?.citationEvents ?? null,
              previousCitationSharePercent: before?.citationSharePercent ?? null,
              citationShareChangePercentagePoints:
                before === undefined || after === undefined
                  ? null
                  : Number((after.citationSharePercent - before.citationSharePercent).toFixed(2)),
            };
          });
        }
        profile.previousFirstPositionCitationSharePercent =
          previousPosition?.firstPositionCitationSharePercent ?? null;
        profile.firstPositionCitationShareChangePercentagePoints =
          currentPosition === null || previousPosition === null
            ? null
            : Number(
                (
                  currentPosition.firstPositionCitationSharePercent -
                  previousPosition.firstPositionCitationSharePercent
                ).toFixed(2)
              );
        profile.previousTopThreeCitationSharePercent =
          previousPosition?.topThreeCitationSharePercent ?? null;
        profile.topThreeCitationShareChangePercentagePoints =
          currentPosition === null || previousPosition === null
            ? null
            : Number(
                (
                  currentPosition.topThreeCitationSharePercent -
                  previousPosition.topThreeCitationSharePercent
                ).toFixed(2)
              );
      }
      profile.previousCitedDomains = previous.citedDomains;
      profile.sharedTopCitedDomainsWithPreviousMonth = profile.citedDomains.filter((domain) =>
        previousDomains.has(domain)
      );
      profile.previousOnlyTopCitedDomains = previous.citedDomains.filter(
        (domain) => !currentDomains.has(domain)
      );
      profile.currentOnlyTopCitedDomains = profile.citedDomains.filter(
        (domain) => !previousDomains.has(domain)
      );
      profile.citedDomainComparisonComplete =
        !previous.citedDomainsTruncated && !profile.citedDomainsTruncated;
    }
    previousSampleBySegment.set(segmentKey, profile);
  }

  const latestMonthlyPairedReachProfiles = [...previousSampleBySegment.values()].filter(
    (profile) => profile.previousObservedMonth !== undefined
  );
  if (ownedDomains.length > 0 && latestMonthlyPairedReachProfiles.length > 0) {
    const monthlyDetailComplete =
      topicIntentProviderMonthly.length <= MAX_RETURNED_COHORT_MONTHLY_ROWS;
    const pairedDataComplete = latestMonthlyPairedReachProfiles.every(
      (profile) =>
        profile.pairedPromptOwnedCitationReachExactMcNemarPValue !== null &&
        profile.pairedPromptOwnedCitationReachExactMcNemarPValue !== undefined &&
        Number.isFinite(profile.pairedPromptOwnedCitationReachExactMcNemarPValue)
    );
    const status = !monthlyDetailComplete
      ? 'incomplete-monthly-detail'
      : !pairedDataComplete
        ? 'incomplete-paired-data'
        : 'complete';
    const pValues =
      status === 'complete'
        ? latestMonthlyPairedReachProfiles.map(
            (profile) => profile.pairedPromptOwnedCitationReachExactMcNemarPValue!
          )
        : [];
    const adjustedPValues = status === 'complete' ? holmAdjustedPValues(pValues) : [];
    latestMonthlyPairedReachProfiles.forEach((profile, index) => {
      profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue =
        status === 'complete' ? adjustedPValues[index]! : null;
      profile.latestMonthlyPairedOwnedPromptReachHolmFamilySize =
        latestMonthlyPairedReachProfiles.length;
      profile.latestMonthlyPairedOwnedPromptReachHolmStatus = status;
    });
  }

  const topicIntentCohorts = [...topicIntentBuckets.values()]
    .map((bucket): AiAnswerCitationTopicIntentProfile => {
      const cohortPromptBucket = topicIntentPromptBuckets.get(bucket.promptCohortKey);
      const cohortPromptOwnedMrrValues = [...(cohortPromptBucket?.prompts.values() ?? [])]
        .map((promptProviders) => {
          let reciprocalRankSum = 0;
          let ownedCitationObservations = 0;
          for (const providerProfile of promptProviders.values()) {
            reciprocalRankSum += providerProfile.ownedFirstCitationReciprocalRankSum;
            ownedCitationObservations += providerProfile.withOwnedCitation;
          }
          return ownedCitationObservations > 0
            ? (reciprocalRankSum / ownedCitationObservations) * 100
            : null;
        })
        .filter((value): value is number => value !== null);
      const citedDomains = [...bucket.domains.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([domain]) => domain);
      const providerProfiles = [...bucket.providerSamples.entries()]
        .map(([providerKey, provider]): AiAnswerCitationTopicIntentProviderProfile => {
          const providerPromptOwnedMrrValues = [...(cohortPromptBucket?.prompts.values() ?? [])]
            .map((promptProviders) => promptProviders.get(providerKey))
            .filter(
              (profile): profile is TopicPromptProviderBucket =>
                profile !== undefined && profile.withOwnedCitation > 0
            )
            .map(
              (profile) =>
                (profile.ownedFirstCitationReciprocalRankSum / profile.withOwnedCitation) * 100
            );
          const providerDomains = [...provider.domains.entries()]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .map(([domain]) => domain);
          return {
            provider: provider.provider,
            observations: provider.observations,
            uniquePrompts: provider.prompts.size,
            observationsWithCitations: provider.withCitations,
            observationsWithoutCitations: provider.withoutCitations,
            citationCoveragePercent: Number(
              ((provider.withCitations / provider.observations) * 100).toFixed(2)
            ),
            citationEvents: provider.citationEvents,
            firstObservedAt: provider.firstObservedAt,
            lastObservedAt: provider.lastObservedAt,
            ...(ownedDomains.length > 0
              ? {
                  observationsWithOwnedCitation: provider.withOwnedCitation,
                  observationsWithoutOwnedCitation: provider.withoutOwnedCitation,
                  ownedCitationCoveragePercent: Number(
                    ((provider.withOwnedCitation / provider.observations) * 100).toFixed(2)
                  ),
                  promptsWithOwnedCitation: provider.ownedPrompts.size,
                  ownedCitationPromptCoveragePercent:
                    provider.prompts.size > 0
                      ? Number(
                          ((provider.ownedPrompts.size / provider.prompts.size) * 100).toFixed(2)
                        )
                      : 0,
                  ownedCitationPromptCoverageConfidenceInterval95Percent:
                    wilsonRateConfidenceInterval95(
                      provider.ownedPrompts.size,
                      provider.prompts.size
                    ),
                  ownedCitationEvents: countOwnedCitationEvents(provider.domains, ownedDomains),
                  ownedCitationEventSharePercent:
                    provider.citationEvents > 0
                      ? Number(
                          (
                            (countOwnedCitationEvents(provider.domains, ownedDomains) /
                              provider.citationEvents) *
                            100
                          ).toFixed(2)
                        )
                      : null,
                  ownedFirstCitationMeanReciprocalRankPercent:
                    provider.withOwnedCitation > 0
                      ? Number(
                          (
                            (provider.ownedFirstCitationReciprocalRankSum /
                              provider.withOwnedCitation) *
                            100
                          ).toFixed(2)
                        )
                      : null,
                  equalPromptMeanOwnedFirstCitationMrrPercent:
                    providerPromptOwnedMrrValues.length > 0
                      ? Number(
                          (
                            providerPromptOwnedMrrValues.reduce((sum, value) => sum + value, 0) /
                            providerPromptOwnedMrrValues.length
                          ).toFixed(2)
                        )
                      : null,
                  equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95:
                    bootstrapMeanMetricConfidenceInterval95(
                      providerPromptOwnedMrrValues,
                      `${bucket.promptCohortKey}:${providerKey}:owned-first-citation-mrr`
                    ),
                }
              : {}),
            citedDomains: providerDomains.slice(0, 10),
            citedDomainsTruncated: providerDomains.length > 10,
          };
        })
        .sort(
          (left, right) =>
            right.observations - left.observations || left.provider.localeCompare(right.provider)
        );
      return {
        ...(bucket.topic ? { topic: bucket.topic } : {}),
        ...(bucket.intent ? { intent: bucket.intent } : {}),
        observations: bucket.observations,
        uniquePrompts: bucket.prompts.size,
        uniqueProviders: bucket.providers.size,
        observationsWithCitations: bucket.withCitations,
        observationsWithoutCitations: bucket.withoutCitations,
        citationEvents: bucket.citationEvents,
        ...(ownedDomains.length > 0
          ? {
              observationsWithOwnedCitation: bucket.withOwnedCitation,
              observationsWithoutOwnedCitation: bucket.withoutOwnedCitation,
              ownedCitationCoveragePercent: Number(
                ((bucket.withOwnedCitation / bucket.observations) * 100).toFixed(2)
              ),
              promptsWithOwnedCitation: bucket.ownedPrompts.size,
              ownedCitationPromptCoveragePercent:
                bucket.prompts.size > 0
                  ? Number(((bucket.ownedPrompts.size / bucket.prompts.size) * 100).toFixed(2))
                  : 0,
              ownedCitationPromptCoverageConfidenceInterval95Percent:
                wilsonRateConfidenceInterval95(bucket.ownedPrompts.size, bucket.prompts.size),
              ownedCitationEvents: countOwnedCitationEvents(bucket.domains, ownedDomains),
              ownedCitationEventSharePercent:
                bucket.citationEvents > 0
                  ? Number(
                      (
                        (countOwnedCitationEvents(bucket.domains, ownedDomains) /
                          bucket.citationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              ownedFirstCitationMeanReciprocalRankPercent:
                bucket.withOwnedCitation > 0
                  ? Number(
                      (
                        (bucket.ownedFirstCitationReciprocalRankSum / bucket.withOwnedCitation) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrPercent:
                cohortPromptOwnedMrrValues.length > 0
                  ? Number(
                      (
                        cohortPromptOwnedMrrValues.reduce((sum, value) => sum + value, 0) /
                        cohortPromptOwnedMrrValues.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  cohortPromptOwnedMrrValues,
                  `${bucket.promptCohortKey}:owned-first-citation-mrr`
                ),
            }
          : {}),
        citedDomains: citedDomains.slice(0, 10),
        citedDomainsTruncated: citedDomains.length > 10,
        providerProfiles,
        providersWithoutObservations: [...providerLabels.entries()]
          .filter(([providerKey]) => !bucket.providerSamples.has(providerKey))
          .map(([, provider]) => provider)
          .sort((left, right) => left.localeCompare(right)),
      };
    })
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        (right.observationsWithOwnedCitation ?? 0) - (left.observationsWithOwnedCitation ?? 0) ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '')
    );

  const providerPromptCoverage = new Map<
    string,
    {
      providerAPromptGroups: number;
      providerBPromptGroups: number;
      promptsOnlyInProviderA: number;
      promptsOnlyInProviderB: number;
      promptCoverageJaccard: number;
    }
  >();
  for (const [cohortKey, cohort] of topicIntentPromptBuckets) {
    const promptsByProvider = new Map<string, Set<string>>();
    for (const [promptKey, promptProviders] of cohort.prompts) {
      for (const providerKey of promptProviders.keys()) {
        const prompts = promptsByProvider.get(providerKey) ?? new Set<string>();
        prompts.add(promptKey);
        promptsByProvider.set(providerKey, prompts);
      }
    }
    const sortedProviderKeys = [...promptsByProvider.keys()].sort();
    for (let leftIndex = 0; leftIndex < sortedProviderKeys.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < sortedProviderKeys.length;
        rightIndex += 1
      ) {
        const providerKeyA = sortedProviderKeys[leftIndex]!;
        const providerKeyB = sortedProviderKeys[rightIndex]!;
        const promptsA = promptsByProvider.get(providerKeyA)!;
        const promptsB = promptsByProvider.get(providerKeyB)!;
        const shared = [...promptsA].filter((promptKey) => promptsB.has(promptKey)).length;
        if (shared === 0) continue;
        const onlyA = promptsA.size - shared;
        const onlyB = promptsB.size - shared;
        const union = shared + onlyA + onlyB;
        providerPromptCoverage.set(JSON.stringify([cohortKey, providerKeyA, providerKeyB]), {
          providerAPromptGroups: promptsA.size,
          providerBPromptGroups: promptsB.size,
          promptsOnlyInProviderA: onlyA,
          promptsOnlyInProviderB: onlyB,
          promptCoverageJaccard: union > 0 ? Number((shared / union).toFixed(4)) : 0,
        });
      }
    }
  }
  const providerPairBuckets = new Map<string, ProviderPairBucket>();
  for (const [cohortKey, cohort] of topicIntentPromptBuckets) {
    for (const promptProviders of cohort.prompts.values()) {
      const sortedProviders = [...promptProviders.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      );
      for (let leftIndex = 0; leftIndex < sortedProviders.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < sortedProviders.length; rightIndex += 1) {
          const [providerKeyA, providerA] = sortedProviders[leftIndex]!;
          const [providerKeyB, providerB] = sortedProviders[rightIndex]!;
          const pairKey = JSON.stringify([cohortKey, providerKeyA, providerKeyB]);
          const pair =
            providerPairBuckets.get(pairKey) ??
            ({
              cohortKey,
              providerKeyA,
              providerKeyB,
              ...(cohort.topic ? { topic: cohort.topic } : {}),
              ...(cohort.intent ? { intent: cohort.intent } : {}),
              unlabeled: cohort.unlabeled,
              providerA: providerA.provider,
              providerB: providerB.provider,
              sharedPrompts: 0,
              observationsA: 0,
              observationsB: 0,
              withCitationsA: 0,
              withCitationsB: 0,
              withOwnedCitationA: 0,
              withOwnedCitationB: 0,
              citationDeltas: [],
              promptCitationCoverageA: [],
              promptCitationCoverageB: [],
              promptDomainJaccards: [],
              ownedCitationDeltas: [],
              promptOwnedCitationCoverageA: [],
              promptOwnedCitationCoverageB: [],
              promptOwnedCitationReachDeltas: [],
              promptOwnedCitationReachLowerDeltas: [],
              promptOwnedCitationReachUpperDeltas: [],
              ownedCitationPromptGroupsA: 0,
              ownedCitationPromptGroupsB: 0,
              unknownOwnedReachPromptsA: 0,
              unknownOwnedReachPromptsB: 0,
              ownedCitationEventShareDeltas: [],
              ownedFirstCitationMrrDeltas: [],
              ownedFirstCitationMrrA: [],
              ownedFirstCitationMrrB: [],
              firstPositionShareDeltas: [],
              topThreeShareDeltas: [],
              promptReciprocalRankSimilarities: [],
              promptsAHigher: 0,
              promptsBHigher: 0,
              promptsEqual: 0,
              promptsWithAnyCitationDomain: 0,
              promptsWithDomainsOnBothSides: 0,
              promptsOwnedAHigher: 0,
              promptsOwnedBHigher: 0,
              promptsOwnedEqual: 0,
              promptsOwnedOnlyA: 0,
              promptsOwnedOnlyB: 0,
              promptsOwnedBoth: 0,
              promptsOwnedNeither: 0,
              promptsWithOwnedEventsOnBothSides: 0,
              promptsOwnedEventShareAHigher: 0,
              promptsOwnedEventShareBHigher: 0,
              promptsOwnedEventShareEqual: 0,
              firstPositionEventsA: 0,
              firstPositionEventsB: 0,
              topThreeEventsA: 0,
              topThreeEventsB: 0,
              promptsWithPositionsOnBothSides: 0,
              promptsFirstPositionAHigher: 0,
              promptsFirstPositionBHigher: 0,
              promptsFirstPositionEqual: 0,
              promptsTopThreeAHigher: 0,
              promptsTopThreeBHigher: 0,
              promptsTopThreeEqual: 0,
              firstObservedAtA: providerA.firstObservedAt,
              lastObservedAtA: providerA.lastObservedAt,
              firstObservedAtB: providerB.firstObservedAt,
              lastObservedAtB: providerB.lastObservedAt,
              domainsA: new Map<string, number>(),
              domainsB: new Map<string, number>(),
              reciprocalRankWeightsA: new Map<string, number>(),
              reciprocalRankWeightsB: new Map<string, number>(),
            } satisfies ProviderPairBucket);
          pair.sharedPrompts += 1;
          pair.observationsA += providerA.observations;
          pair.observationsB += providerB.observations;
          pair.withCitationsA += providerA.withCitations;
          pair.withCitationsB += providerB.withCitations;
          pair.withOwnedCitationA += providerA.withOwnedCitation;
          pair.withOwnedCitationB += providerB.withOwnedCitation;
          pair.firstObservedAtA =
            providerA.firstObservedAt < pair.firstObservedAtA
              ? providerA.firstObservedAt
              : pair.firstObservedAtA;
          pair.lastObservedAtA =
            providerA.lastObservedAt > pair.lastObservedAtA
              ? providerA.lastObservedAt
              : pair.lastObservedAtA;
          pair.firstObservedAtB =
            providerB.firstObservedAt < pair.firstObservedAtB
              ? providerB.firstObservedAt
              : pair.firstObservedAtB;
          pair.lastObservedAtB =
            providerB.lastObservedAt > pair.lastObservedAtB
              ? providerB.lastObservedAt
              : pair.lastObservedAtB;
          for (const [domain, count] of providerA.domains)
            pair.domainsA.set(domain, (pair.domainsA.get(domain) ?? 0) + count);
          for (const [domain, count] of providerB.domains)
            pair.domainsB.set(domain, (pair.domainsB.get(domain) ?? 0) + count);
          for (const [url, weight] of providerA.reciprocalRankWeights)
            pair.reciprocalRankWeightsA.set(
              url,
              (pair.reciprocalRankWeightsA.get(url) ?? 0) + weight
            );
          for (const [url, weight] of providerB.reciprocalRankWeights)
            pair.reciprocalRankWeightsB.set(
              url,
              (pair.reciprocalRankWeightsB.get(url) ?? 0) + weight
            );
          const firstPositionEventsA = providerA.firstPositionEvents;
          const firstPositionEventsB = providerB.firstPositionEvents;
          const topThreeEventsA = providerA.topThreeEvents;
          const topThreeEventsB = providerB.topThreeEvents;
          pair.firstPositionEventsA += firstPositionEventsA;
          pair.firstPositionEventsB += firstPositionEventsB;
          pair.topThreeEventsA += topThreeEventsA;
          pair.topThreeEventsB += topThreeEventsB;

          const coverageA = (providerA.withCitations / providerA.observations) * 100;
          const coverageB = (providerB.withCitations / providerB.observations) * 100;
          pair.citationDeltas.push(coverageB - coverageA);
          pair.promptCitationCoverageA.push(coverageA);
          pair.promptCitationCoverageB.push(coverageB);
          const citationDifference =
            providerA.withCitations * providerB.observations -
            providerB.withCitations * providerA.observations;
          if (citationDifference > 0) pair.promptsAHigher += 1;
          else if (citationDifference < 0) pair.promptsBHigher += 1;
          else pair.promptsEqual += 1;

          const domainsAForPrompt = new Set(providerA.domains.keys());
          const domainsBForPrompt = new Set(providerB.domains.keys());
          const promptDomainUnion = new Set([...domainsAForPrompt, ...domainsBForPrompt]);
          if (promptDomainUnion.size > 0) {
            const promptSharedDomains = [...domainsAForPrompt].filter((domain) =>
              domainsBForPrompt.has(domain)
            ).length;
            pair.promptDomainJaccards.push(promptSharedDomains / promptDomainUnion.size);
            pair.promptsWithAnyCitationDomain += 1;
            if (domainsAForPrompt.size > 0 && domainsBForPrompt.size > 0)
              pair.promptsWithDomainsOnBothSides += 1;
          }

          if (ownedDomains.length > 0) {
            const ownedCoverageA = (providerA.withOwnedCitation / providerA.observations) * 100;
            const ownedCoverageB = (providerB.withOwnedCitation / providerB.observations) * 100;
            pair.ownedCitationDeltas.push(ownedCoverageB - ownedCoverageA);
            pair.promptOwnedCitationCoverageA.push(ownedCoverageA);
            pair.promptOwnedCitationCoverageB.push(ownedCoverageB);
            const ownsPromptA = providerA.withOwnedCitation > 0;
            const ownsPromptB = providerB.withOwnedCitation > 0;
            const reachBoundsFor = (
              profile: TopicPromptProviderBucket
            ): { state: 'present' | 'absent' | 'unknown'; lower: number; upper: number } => {
              if (profile.withOwnedCitation > 0)
                return { state: 'present', lower: 100, upper: 100 };
              if (profile.incompleteCitationListObservations === 0)
                return { state: 'absent', lower: 0, upper: 0 };
              return { state: 'unknown', lower: 0, upper: 100 };
            };
            const reachA = reachBoundsFor(providerA);
            const reachB = reachBoundsFor(providerB);
            if (reachA.state === 'present') pair.ownedCitationPromptGroupsA += 1;
            if (reachB.state === 'present') pair.ownedCitationPromptGroupsB += 1;
            if (reachA.state === 'unknown') pair.unknownOwnedReachPromptsA += 1;
            if (reachB.state === 'unknown') pair.unknownOwnedReachPromptsB += 1;
            pair.promptOwnedCitationReachLowerDeltas.push(reachB.lower - reachA.upper);
            pair.promptOwnedCitationReachUpperDeltas.push(reachB.upper - reachA.lower);
            if (reachA.state !== 'unknown' && reachB.state !== 'unknown') {
              pair.promptOwnedCitationReachDeltas.push(
                (Number(ownsPromptB) - Number(ownsPromptA)) * 100
              );
              if (ownsPromptA && ownsPromptB) pair.promptsOwnedBoth += 1;
              else if (ownsPromptA) pair.promptsOwnedOnlyA += 1;
              else if (ownsPromptB) pair.promptsOwnedOnlyB += 1;
              else pair.promptsOwnedNeither += 1;
            }
            const ownedDifference =
              providerA.withOwnedCitation * providerB.observations -
              providerB.withOwnedCitation * providerA.observations;
            if (ownedDifference > 0) pair.promptsOwnedAHigher += 1;
            else if (ownedDifference < 0) pair.promptsOwnedBHigher += 1;
            else pair.promptsOwnedEqual += 1;

            if (ownsPromptA && ownsPromptB) {
              const ownedFirstCitationMrrA =
                (providerA.ownedFirstCitationReciprocalRankSum / providerA.withOwnedCitation) * 100;
              const ownedFirstCitationMrrB =
                (providerB.ownedFirstCitationReciprocalRankSum / providerB.withOwnedCitation) * 100;
              pair.ownedFirstCitationMrrA.push(ownedFirstCitationMrrA);
              pair.ownedFirstCitationMrrB.push(ownedFirstCitationMrrB);
              pair.ownedFirstCitationMrrDeltas.push(
                ownedFirstCitationMrrB - ownedFirstCitationMrrA
              );
            }

            const citationEventsA = [...providerA.domains.values()].reduce(
              (sum, count) => sum + count,
              0
            );
            const citationEventsB = [...providerB.domains.values()].reduce(
              (sum, count) => sum + count,
              0
            );
            if (citationEventsA > 0 && citationEventsB > 0) {
              const ownedEventsA = countOwnedCitationEvents(providerA.domains, ownedDomains);
              const ownedEventsB = countOwnedCitationEvents(providerB.domains, ownedDomains);
              pair.promptsWithOwnedEventsOnBothSides += 1;
              pair.ownedCitationEventShareDeltas.push(
                (ownedEventsB / citationEventsB - ownedEventsA / citationEventsA) * 100
              );
              const eventShareDifference =
                ownedEventsA * citationEventsB - ownedEventsB * citationEventsA;
              if (eventShareDifference > 0) pair.promptsOwnedEventShareAHigher += 1;
              else if (eventShareDifference < 0) pair.promptsOwnedEventShareBHigher += 1;
              else pair.promptsOwnedEventShareEqual += 1;
            }
          }
          if (providerA.citationEvents > 0 && providerB.citationEvents > 0) {
            pair.promptsWithPositionsOnBothSides += 1;
            const firstPositionShareA = firstPositionEventsA / providerA.citationEvents;
            const firstPositionShareB = firstPositionEventsB / providerB.citationEvents;
            const firstPositionDelta = (firstPositionShareB - firstPositionShareA) * 100;
            pair.firstPositionShareDeltas.push(firstPositionDelta);
            if (firstPositionDelta > 0) pair.promptsFirstPositionBHigher += 1;
            else if (firstPositionDelta < 0) pair.promptsFirstPositionAHigher += 1;
            else pair.promptsFirstPositionEqual += 1;
            const topThreeShareA = topThreeEventsA / providerA.citationEvents;
            const topThreeShareB = topThreeEventsB / providerB.citationEvents;
            const topThreeDelta = (topThreeShareB - topThreeShareA) * 100;
            pair.topThreeShareDeltas.push(topThreeDelta);
            if (topThreeDelta > 0) pair.promptsTopThreeBHigher += 1;
            else if (topThreeDelta < 0) pair.promptsTopThreeAHigher += 1;
            else pair.promptsTopThreeEqual += 1;
          }
          const promptRankedUrls = new Set([
            ...providerA.reciprocalRankWeights.keys(),
            ...providerB.reciprocalRankWeights.keys(),
          ]);
          const promptRankUnion = [...promptRankedUrls].reduce(
            (sum, url) =>
              sum +
              Math.max(
                providerA.reciprocalRankWeights.get(url) ?? 0,
                providerB.reciprocalRankWeights.get(url) ?? 0
              ),
            0
          );
          if (promptRankUnion > 0) {
            const promptRankOverlap = [...promptRankedUrls].reduce(
              (sum, url) =>
                sum +
                Math.min(
                  providerA.reciprocalRankWeights.get(url) ?? 0,
                  providerB.reciprocalRankWeights.get(url) ?? 0
                ),
              0
            );
            pair.promptReciprocalRankSimilarities.push(promptRankOverlap / promptRankUnion);
          }
          providerPairBuckets.set(pairKey, pair);
        }
      }
    }
  }
  const providerPairComparisons = [...providerPairBuckets.values()]
    .map((pair): AiAnswerCitationTopicIntentProviderPairComparison => {
      const promptCoverage = providerPromptCoverage.get(
        JSON.stringify([pair.cohortKey, pair.providerKeyA, pair.providerKeyB])
      );
      const domainsA = [...pair.domainsA.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([domain]) => domain);
      const domainsB = [...pair.domainsB.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([domain]) => domain);
      const topDomainsA = domainsA.slice(0, 10);
      const topDomainsB = domainsB.slice(0, 10);
      const domainSetA = new Set(topDomainsA);
      const domainSetB = new Set(topDomainsB);
      const allDomainsA = new Set(pair.domainsA.keys());
      const allDomainsB = new Set(pair.domainsB.keys());
      const allDomainsUnion = new Set([...allDomainsA, ...allDomainsB]);
      const sharedCitationDomains = [...allDomainsA].filter((domain) =>
        allDomainsB.has(domain)
      ).length;
      const weightedOverlapNumerator = [...allDomainsUnion].reduce(
        (sum, domain) =>
          sum + Math.min(pair.domainsA.get(domain) ?? 0, pair.domainsB.get(domain) ?? 0),
        0
      );
      const weightedOverlapDenominator = [...allDomainsUnion].reduce(
        (sum, domain) =>
          sum + Math.max(pair.domainsA.get(domain) ?? 0, pair.domainsB.get(domain) ?? 0),
        0
      );
      const citationEventsA = [...pair.domainsA.values()].reduce((sum, count) => sum + count, 0);
      const citationEventsB = [...pair.domainsB.values()].reduce((sum, count) => sum + count, 0);
      const allRankedUrls = new Set([
        ...pair.reciprocalRankWeightsA.keys(),
        ...pair.reciprocalRankWeightsB.keys(),
      ]);
      const rankWeightedOverlap = [...allRankedUrls].reduce(
        (sum, url) =>
          sum +
          Math.min(
            pair.reciprocalRankWeightsA.get(url) ?? 0,
            pair.reciprocalRankWeightsB.get(url) ?? 0
          ),
        0
      );
      const rankWeightedUnion = [...allRankedUrls].reduce(
        (sum, url) =>
          sum +
          Math.max(
            pair.reciprocalRankWeightsA.get(url) ?? 0,
            pair.reciprocalRankWeightsB.get(url) ?? 0
          ),
        0
      );
      return {
        ...(pair.topic ? { topic: pair.topic } : {}),
        ...(pair.intent ? { intent: pair.intent } : {}),
        unlabeled: pair.unlabeled,
        providerA: pair.providerA,
        providerB: pair.providerB,
        sharedPrompts: pair.sharedPrompts,
        ...(promptCoverage ?? {}),
        providerAObservations: pair.observationsA,
        providerBObservations: pair.observationsB,
        providerAObservationsWithCitations: pair.withCitationsA,
        providerBObservationsWithCitations: pair.withCitationsB,
        providerACitationCoveragePercent: Number(
          ((pair.withCitationsA / pair.observationsA) * 100).toFixed(2)
        ),
        providerBCitationCoveragePercent: Number(
          ((pair.withCitationsB / pair.observationsB) * 100).toFixed(2)
        ),
        providerBCitationCoverageDeltaPercentagePoints: Number(
          (
            (pair.withCitationsB / pair.observationsB) * 100 -
            (pair.withCitationsA / pair.observationsA) * 100
          ).toFixed(2)
        ),
        providerAEqualPromptMeanCitationCoveragePercent: Number(
          (
            pair.promptCitationCoverageA.reduce((sum, value) => sum + value, 0) /
            pair.promptCitationCoverageA.length
          ).toFixed(2)
        ),
        providerBEqualPromptMeanCitationCoveragePercent: Number(
          (
            pair.promptCitationCoverageB.reduce((sum, value) => sum + value, 0) /
            pair.promptCitationCoverageB.length
          ).toFixed(2)
        ),
        meanPromptCitationCoverageDeltaPercentagePoints: Number(
          (
            pair.citationDeltas.reduce((sum, value) => sum + value, 0) / pair.citationDeltas.length
          ).toFixed(2)
        ),
        meanPromptCitationCoverageDeltaBootstrapConfidenceInterval95PercentagePoints:
          bootstrapMeanDifferenceConfidenceInterval95(
            pair.citationDeltas,
            `${pair.cohortKey}\u0000${pair.providerA}\u0000${pair.providerB}`
          ),
        medianPromptCitationCoverageDeltaPercentagePoints: Number(
          median(pair.citationDeltas).toFixed(2)
        ),
        promptsWithProviderAHigherCitationCoverage: pair.promptsAHigher,
        promptsWithProviderBHigherCitationCoverage: pair.promptsBHigher,
        promptsWithEqualCitationCoverage: pair.promptsEqual,
        providerADistinctCitationDomains: allDomainsA.size,
        providerBDistinctCitationDomains: allDomainsB.size,
        sharedCitationDomains,
        citationDomainJaccard:
          allDomainsUnion.size > 0
            ? Number((sharedCitationDomains / allDomainsUnion.size).toFixed(4))
            : null,
        citationEventWeightedDomainSimilarity:
          weightedOverlapDenominator > 0
            ? Number((weightedOverlapNumerator / weightedOverlapDenominator).toFixed(4))
            : null,
        reciprocalRankWeightedPageSimilarity:
          rankWeightedUnion > 0
            ? Number((rankWeightedOverlap / rankWeightedUnion).toFixed(4))
            : null,
        promptsWithRankedPageComparison: pair.promptReciprocalRankSimilarities.length,
        medianPromptReciprocalRankWeightedPageSimilarity:
          pair.promptReciprocalRankSimilarities.length > 0
            ? Number(median(pair.promptReciprocalRankSimilarities).toFixed(4))
            : null,
        promptsWithAtLeastOneCitationDomain: pair.promptsWithAnyCitationDomain,
        promptsWithCitationDomainsOnBothSides: pair.promptsWithDomainsOnBothSides,
        medianPromptCitationDomainJaccard:
          pair.promptDomainJaccards.length > 0
            ? Number(median(pair.promptDomainJaccards).toFixed(4))
            : null,
        providerAFirstObservedAt: pair.firstObservedAtA,
        providerALastObservedAt: pair.lastObservedAtA,
        providerBFirstObservedAt: pair.firstObservedAtB,
        providerBLastObservedAt: pair.lastObservedAtB,
        ...(ownedDomains.length > 0
          ? {
              providerAObservationsWithOwnedCitation: pair.withOwnedCitationA,
              providerBObservationsWithOwnedCitation: pair.withOwnedCitationB,
              providerAOwnedCitationCoveragePercent: Number(
                ((pair.withOwnedCitationA / pair.observationsA) * 100).toFixed(2)
              ),
              providerBOwnedCitationCoveragePercent: Number(
                ((pair.withOwnedCitationB / pair.observationsB) * 100).toFixed(2)
              ),
              providerBOwnedCitationCoverageDeltaPercentagePoints: Number(
                (
                  (pair.withOwnedCitationB / pair.observationsB) * 100 -
                  (pair.withOwnedCitationA / pair.observationsA) * 100
                ).toFixed(2)
              ),
              providerAEqualPromptMeanOwnedCitationCoveragePercent: Number(
                (
                  pair.promptOwnedCitationCoverageA.reduce((sum, value) => sum + value, 0) /
                  pair.promptOwnedCitationCoverageA.length
                ).toFixed(2)
              ),
              providerBEqualPromptMeanOwnedCitationCoveragePercent: Number(
                (
                  pair.promptOwnedCitationCoverageB.reduce((sum, value) => sum + value, 0) /
                  pair.promptOwnedCitationCoverageB.length
                ).toFixed(2)
              ),
              meanPromptOwnedCitationCoverageDeltaPercentagePoints: Number(
                (
                  pair.ownedCitationDeltas.reduce((sum, value) => sum + value, 0) /
                  pair.ownedCitationDeltas.length
                ).toFixed(2)
              ),
              meanPromptOwnedCitationCoverageDeltaBootstrapConfidenceInterval95PercentagePoints:
                bootstrapMeanDifferenceConfidenceInterval95(
                  pair.ownedCitationDeltas,
                  `${pair.cohortKey}\u0000${pair.providerA}\u0000${pair.providerB}\u0000owned-coverage`
                ),
              medianPromptOwnedCitationCoverageDeltaPercentagePoints: Number(
                median(pair.ownedCitationDeltas).toFixed(2)
              ),
              promptsWithProviderAHigherOwnedCitationCoverage: pair.promptsOwnedAHigher,
              promptsWithProviderBHigherOwnedCitationCoverage: pair.promptsOwnedBHigher,
              promptsWithEqualOwnedCitationCoverage: pair.promptsOwnedEqual,
              providerAOwnedCitationPromptGroups: pair.ownedCitationPromptGroupsA,
              providerBOwnedCitationPromptGroups: pair.ownedCitationPromptGroupsB,
              providerAOwnedCitationPromptReachPercent: Number(
                ((pair.ownedCitationPromptGroupsA / pair.sharedPrompts) * 100).toFixed(2)
              ),
              providerBOwnedCitationPromptReachPercent: Number(
                ((pair.ownedCitationPromptGroupsB / pair.sharedPrompts) * 100).toFixed(2)
              ),
              providerBOwnedCitationPromptReachDeltaPercentagePoints: Number(
                (
                  ((pair.ownedCitationPromptGroupsB - pair.ownedCitationPromptGroupsA) /
                    pair.sharedPrompts) *
                  100
                ).toFixed(2)
              ),
              providerAUnknownOwnedCitationPromptGroups: pair.unknownOwnedReachPromptsA,
              providerBUnknownOwnedCitationPromptGroups: pair.unknownOwnedReachPromptsB,
              providerAOwnedCitationPromptReachLowerBoundPercent: Number(
                ((pair.ownedCitationPromptGroupsA / pair.sharedPrompts) * 100).toFixed(2)
              ),
              providerAOwnedCitationPromptReachUpperBoundPercent: Number(
                (
                  ((pair.ownedCitationPromptGroupsA + pair.unknownOwnedReachPromptsA) /
                    pair.sharedPrompts) *
                  100
                ).toFixed(2)
              ),
              providerBOwnedCitationPromptReachLowerBoundPercent: Number(
                ((pair.ownedCitationPromptGroupsB / pair.sharedPrompts) * 100).toFixed(2)
              ),
              providerBOwnedCitationPromptReachUpperBoundPercent: Number(
                (
                  ((pair.ownedCitationPromptGroupsB + pair.unknownOwnedReachPromptsB) /
                    pair.sharedPrompts) *
                  100
                ).toFixed(2)
              ),
              providerBOwnedCitationPromptReachChangeLowerBoundPercentagePoints: Number(
                (
                  pair.promptOwnedCitationReachLowerDeltas.reduce((sum, value) => sum + value, 0) /
                  pair.promptOwnedCitationReachLowerDeltas.length
                ).toFixed(2)
              ),
              providerBOwnedCitationPromptReachChangeUpperBoundPercentagePoints: Number(
                (
                  pair.promptOwnedCitationReachUpperDeltas.reduce((sum, value) => sum + value, 0) /
                  pair.promptOwnedCitationReachUpperDeltas.length
                ).toFixed(2)
              ),
              meanPromptOwnedCitationPromptReachDeltaBootstrapConfidenceInterval95PercentagePoints:
                bootstrapMeanDifferenceConfidenceInterval95(
                  pair.promptOwnedCitationReachDeltas,
                  `${pair.cohortKey}\u0000${pair.providerA}\u0000${pair.providerB}\u0000owned-prompt-reach`
                ),
              promptsWithOwnedCitationOnlyForProviderA: pair.promptsOwnedOnlyA,
              promptsWithOwnedCitationOnlyForProviderB: pair.promptsOwnedOnlyB,
              promptsWithOwnedCitationForBothProviders: pair.promptsOwnedBoth,
              promptsWithOwnedCitationForNeitherProvider: pair.promptsOwnedNeither,
              promptsWithOwnedCitationReachKnownOnBothProviders:
                pair.promptsOwnedOnlyA +
                pair.promptsOwnedOnlyB +
                pair.promptsOwnedBoth +
                pair.promptsOwnedNeither,
              providerACitationEvents: citationEventsA,
              providerBCitationEvents: citationEventsB,
              providerAOwnedCitationEvents: countOwnedCitationEvents(pair.domainsA, ownedDomains),
              providerBOwnedCitationEvents: countOwnedCitationEvents(pair.domainsB, ownedDomains),
              providerAOwnedCitationEventSharePercent:
                citationEventsA > 0
                  ? Number(
                      (
                        (countOwnedCitationEvents(pair.domainsA, ownedDomains) / citationEventsA) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              providerBOwnedCitationEventSharePercent:
                citationEventsB > 0
                  ? Number(
                      (
                        (countOwnedCitationEvents(pair.domainsB, ownedDomains) / citationEventsB) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              providerBOwnedCitationEventShareDeltaPercentagePoints:
                citationEventsA > 0 && citationEventsB > 0
                  ? Number(
                      (
                        (countOwnedCitationEvents(pair.domainsB, ownedDomains) / citationEventsB -
                          countOwnedCitationEvents(pair.domainsA, ownedDomains) / citationEventsA) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              promptsWithOwnedCitationEventsOnBothSides: pair.promptsWithOwnedEventsOnBothSides,
              medianPromptOwnedCitationEventShareDeltaPercentagePoints:
                pair.ownedCitationEventShareDeltas.length > 0
                  ? Number(median(pair.ownedCitationEventShareDeltas).toFixed(2))
                  : null,
              promptsWithProviderAHigherOwnedCitationEventShare: pair.promptsOwnedEventShareAHigher,
              promptsWithProviderBHigherOwnedCitationEventShare: pair.promptsOwnedEventShareBHigher,
              promptsWithEqualOwnedCitationEventShare: pair.promptsOwnedEventShareEqual,
              promptsWithOwnedFirstCitationRankOnBothSides: pair.ownedFirstCitationMrrDeltas.length,
              providerAEqualPromptMeanOwnedFirstCitationMrrPercent:
                pair.ownedFirstCitationMrrA.length > 0
                  ? Number(
                      (
                        pair.ownedFirstCitationMrrA.reduce((sum, value) => sum + value, 0) /
                        pair.ownedFirstCitationMrrA.length
                      ).toFixed(2)
                    )
                  : null,
              providerBEqualPromptMeanOwnedFirstCitationMrrPercent:
                pair.ownedFirstCitationMrrB.length > 0
                  ? Number(
                      (
                        pair.ownedFirstCitationMrrB.reduce((sum, value) => sum + value, 0) /
                        pair.ownedFirstCitationMrrB.length
                      ).toFixed(2)
                    )
                  : null,
              meanPromptOwnedFirstCitationMrrDeltaPercentagePoints:
                pair.ownedFirstCitationMrrDeltas.length > 0
                  ? Number(
                      (
                        pair.ownedFirstCitationMrrDeltas.reduce((sum, value) => sum + value, 0) /
                        pair.ownedFirstCitationMrrDeltas.length
                      ).toFixed(2)
                    )
                  : null,
              meanPromptOwnedFirstCitationMrrDeltaBootstrapConfidenceInterval95PercentagePoints:
                bootstrapMeanDifferenceConfidenceInterval95(
                  pair.ownedFirstCitationMrrDeltas,
                  `${pair.cohortKey}\u0000${pair.providerA}\u0000${pair.providerB}\u0000owned-first-citation-mrr`
                ),
              medianPromptOwnedFirstCitationMrrDeltaPercentagePoints:
                pair.ownedFirstCitationMrrDeltas.length > 0
                  ? Number(median(pair.ownedFirstCitationMrrDeltas).toFixed(2))
                  : null,
              promptsWithProviderAHigherOwnedFirstCitationMrr:
                pair.ownedFirstCitationMrrDeltas.filter((value) => value < 0).length,
              promptsWithProviderBHigherOwnedFirstCitationMrr:
                pair.ownedFirstCitationMrrDeltas.filter((value) => value > 0).length,
              promptsWithEqualOwnedFirstCitationMrr: pair.ownedFirstCitationMrrDeltas.filter(
                (value) => value === 0
              ).length,
            }
          : {}),
        providerAFirstPositionCitationEvents: pair.firstPositionEventsA,
        providerBFirstPositionCitationEvents: pair.firstPositionEventsB,
        providerAFirstPositionCitationSharePercent:
          citationEventsA > 0
            ? Number(((pair.firstPositionEventsA / citationEventsA) * 100).toFixed(2))
            : null,
        providerBFirstPositionCitationSharePercent:
          citationEventsB > 0
            ? Number(((pair.firstPositionEventsB / citationEventsB) * 100).toFixed(2))
            : null,
        providerBFirstPositionCitationShareDeltaPercentagePoints:
          citationEventsA > 0 && citationEventsB > 0
            ? Number(
                (
                  (pair.firstPositionEventsB / citationEventsB -
                    pair.firstPositionEventsA / citationEventsA) *
                  100
                ).toFixed(2)
              )
            : null,
        providerATopThreeCitationEvents: pair.topThreeEventsA,
        providerBTopThreeCitationEvents: pair.topThreeEventsB,
        providerATopThreeCitationSharePercent:
          citationEventsA > 0
            ? Number(((pair.topThreeEventsA / citationEventsA) * 100).toFixed(2))
            : null,
        providerBTopThreeCitationSharePercent:
          citationEventsB > 0
            ? Number(((pair.topThreeEventsB / citationEventsB) * 100).toFixed(2))
            : null,
        providerBTopThreeCitationShareDeltaPercentagePoints:
          citationEventsA > 0 && citationEventsB > 0
            ? Number(
                (
                  (pair.topThreeEventsB / citationEventsB -
                    pair.topThreeEventsA / citationEventsA) *
                  100
                ).toFixed(2)
              )
            : null,
        promptsWithCitationPositionsOnBothSides: pair.promptsWithPositionsOnBothSides,
        medianPromptFirstPositionCitationShareDeltaPercentagePoints:
          pair.firstPositionShareDeltas.length > 0
            ? Number(median(pair.firstPositionShareDeltas).toFixed(2))
            : null,
        promptsWithProviderAHigherFirstPositionShare: pair.promptsFirstPositionAHigher,
        promptsWithProviderBHigherFirstPositionShare: pair.promptsFirstPositionBHigher,
        promptsWithEqualFirstPositionShare: pair.promptsFirstPositionEqual,
        medianPromptTopThreeCitationShareDeltaPercentagePoints:
          pair.topThreeShareDeltas.length > 0
            ? Number(median(pair.topThreeShareDeltas).toFixed(2))
            : null,
        promptsWithProviderAHigherTopThreeCitationShare: pair.promptsTopThreeAHigher,
        promptsWithProviderBHigherTopThreeCitationShare: pair.promptsTopThreeBHigher,
        promptsWithEqualTopThreeCitationShare: pair.promptsTopThreeEqual,
        providerATopCitedDomains: topDomainsA,
        providerBTopCitedDomains: topDomainsB,
        sharedTopCitedDomains: topDomainsA.filter((domain) => domainSetB.has(domain)),
        providerAOnlyTopCitedDomains: topDomainsA.filter((domain) => !domainSetB.has(domain)),
        providerBOnlyTopCitedDomains: topDomainsB.filter((domain) => !domainSetA.has(domain)),
        citedDomainDetailComplete: domainsA.length <= 10 && domainsB.length <= 10,
      };
    })
    .sort(
      (left, right) =>
        right.sharedPrompts - left.sharedPrompts ||
        right.providerAObservations +
          right.providerBObservations -
          left.providerAObservations -
          left.providerBObservations ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.providerA.localeCompare(right.providerA) ||
        left.providerB.localeCompare(right.providerB)
    );

  const mixSegmentLabels = new Map<
    string,
    { topic?: string; intent?: string; unlabeled: boolean }
  >();
  const providerMixCounts = new Map<string, Map<string, number>>();
  const labeledCountsByProvider = new Map<string, number>();
  for (const [cohortKey, cohort] of topicIntentBuckets) {
    const segmentKey = JSON.stringify(['labeled', cohortKey]);
    mixSegmentLabels.set(segmentKey, {
      ...(cohort.topic ? { topic: cohort.topic } : {}),
      ...(cohort.intent ? { intent: cohort.intent } : {}),
      unlabeled: false,
    });
    for (const [providerKey, provider] of cohort.providerSamples) {
      const distribution = providerMixCounts.get(providerKey) ?? new Map<string, number>();
      distribution.set(segmentKey, provider.observations);
      providerMixCounts.set(providerKey, distribution);
      labeledCountsByProvider.set(
        providerKey,
        (labeledCountsByProvider.get(providerKey) ?? 0) + provider.observations
      );
    }
  }
  const unlabeledSegmentKey = JSON.stringify(['unlabeled']);
  mixSegmentLabels.set(unlabeledSegmentKey, { unlabeled: true });
  for (const [providerKey, provider] of providerBuckets) {
    const unlabeledObservations =
      provider.observations - (labeledCountsByProvider.get(providerKey) ?? 0);
    if (unlabeledObservations > 0) {
      const distribution = providerMixCounts.get(providerKey) ?? new Map<string, number>();
      distribution.set(unlabeledSegmentKey, unlabeledObservations);
      providerMixCounts.set(providerKey, distribution);
    }
  }
  const providerEntries = [...providerBuckets.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const providerSampleMixComparisons = [] as AiAnswerCitationProviderSampleMixComparison[];
  for (let leftIndex = 0; leftIndex < providerEntries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < providerEntries.length; rightIndex += 1) {
      const [providerKeyA, providerA] = providerEntries[leftIndex]!;
      const [providerKeyB, providerB] = providerEntries[rightIndex]!;
      const countsA = providerMixCounts.get(providerKeyA) ?? new Map<string, number>();
      const countsB = providerMixCounts.get(providerKeyB) ?? new Map<string, number>();
      const segmentKeys = new Set([...countsA.keys(), ...countsB.keys()]);
      const segments: Array<{
        key: string;
        contribution: number;
        profile: AiAnswerCitationProviderSampleMixSegment;
      }> = [];
      let divergence = 0;
      let sharedSegments = 0;
      let onlyA = 0;
      let onlyB = 0;
      for (const segmentKey of segmentKeys) {
        const countA = countsA.get(segmentKey) ?? 0;
        const countB = countsB.get(segmentKey) ?? 0;
        const shareA = countA / providerA.observations;
        const shareB = countB / providerB.observations;
        if (countA > 0 && countB > 0) sharedSegments += 1;
        else if (countA > 0) onlyA += 1;
        else if (countB > 0) onlyB += 1;
        const meanShare = (shareA + shareB) / 2;
        const contribution = (share: number): number =>
          share > 0 ? 0.5 * share * Math.log2(share / meanShare) : 0;
        const segmentDivergence = contribution(shareA) + contribution(shareB);
        divergence += segmentDivergence;
        const label = mixSegmentLabels.get(segmentKey) ?? { unlabeled: true };
        segments.push({
          key: segmentKey,
          contribution: segmentDivergence,
          profile: {
            ...('topic' in label && label.topic ? { topic: label.topic } : {}),
            ...('intent' in label && label.intent ? { intent: label.intent } : {}),
            unlabeled: label.unlabeled,
            providerAObservations: countA,
            providerBObservations: countB,
            providerASharePercent: Number((shareA * 100).toFixed(2)),
            providerBSharePercent: Number((shareB * 100).toFixed(2)),
            providerBShareDeltaPercentagePoints: Number(((shareB - shareA) * 100).toFixed(2)),
            divergenceContributionPercent: 0,
          },
        });
      }
      const divergentSegments = segments
        .filter((segment) => segment.contribution > 0)
        .sort(
          (left, right) =>
            right.contribution - left.contribution ||
            Math.abs(right.profile.providerBShareDeltaPercentagePoints) -
              Math.abs(left.profile.providerBShareDeltaPercentagePoints) ||
            (left.profile.topic ?? '').localeCompare(right.profile.topic ?? '') ||
            (left.profile.intent ?? '').localeCompare(right.profile.intent ?? '')
        );
      const leadingSegments = divergentSegments.slice(0, 5).map(({ contribution, profile }) => ({
        ...profile,
        divergenceContributionPercent:
          divergence > 0 ? Number(((contribution / divergence) * 100).toFixed(2)) : 0,
      }));
      providerSampleMixComparisons.push({
        providerA: providerA.provider,
        providerB: providerB.provider,
        providerAObservations: providerA.observations,
        providerBObservations: providerB.observations,
        providerAUnlabeledObservations:
          providerA.observations - (labeledCountsByProvider.get(providerKeyA) ?? 0),
        providerBUnlabeledObservations:
          providerB.observations - (labeledCountsByProvider.get(providerKeyB) ?? 0),
        sharedSampleSegments: sharedSegments,
        sampleSegmentsOnlyInProviderA: onlyA,
        sampleSegmentsOnlyInProviderB: onlyB,
        normalizedJensenShannonDivergence: Number(Math.max(0, Math.min(1, divergence)).toFixed(4)),
        jensenShannonDistance: Number(Math.sqrt(Math.max(0, Math.min(1, divergence))).toFixed(4)),
        leadingDivergentSegments: leadingSegments,
        leadingSegmentsTruncated: divergentSegments.length > 5,
      });
    }
  }
  providerSampleMixComparisons.sort(
    (left, right) =>
      right.normalizedJensenShannonDivergence - left.normalizedJensenShannonDivergence ||
      right.providerAObservations +
        right.providerBObservations -
        left.providerAObservations -
        left.providerBObservations ||
      left.providerA.localeCompare(right.providerA) ||
      left.providerB.localeCompare(right.providerB)
  );

  const temporalGroups = new Map<
    string,
    {
      topic?: string;
      intent?: string;
      unlabeled: boolean;
      provider: string;
      prompt: string;
      snapshots: Array<{
        observedAt: string;
        inputIndex: number;
        citations: (typeof observations)[number]['citations'];
        citationListComplete: boolean;
      }>;
    }
  >();
  observations.forEach((observation, inputIndex) => {
    const key = JSON.stringify([
      observation.providerKey,
      observation.topicKey ?? null,
      observation.intentKey ?? null,
      observation.promptKey,
    ]);
    const group = temporalGroups.get(key) ?? {
      ...(observation.topic ? { topic: observation.topic } : {}),
      ...(observation.intent ? { intent: observation.intent } : {}),
      unlabeled: observation.topicKey === undefined && observation.intentKey === undefined,
      provider: observation.provider,
      prompt: observation.prompt,
      snapshots: [],
    };
    group.snapshots.push({
      observedAt: observation.observedAt,
      inputIndex,
      citations: observation.citations,
      citationListComplete: observation.citationListComplete,
    });
    temporalGroups.set(key, group);
  });
  const sourcePersistenceSeries = new Map<
    string,
    {
      providerKey: string;
      provider: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      model?: string;
      modelKey?: string;
      surface?: string;
      surfaceKey?: string;
      locale?: string;
      localeKey?: string;
      promptKey: string;
      snapshots: Array<{
        observedAt: string;
        inputIndex: number;
        citations: (typeof observations)[number]['citations'];
        citationListComplete: boolean;
      }>;
    }
  >();
  observations.forEach((observation, inputIndex) => {
    const key = JSON.stringify([
      observation.providerKey,
      observation.modelKey ?? null,
      observation.surfaceKey ?? null,
      observation.localeKey ?? null,
      observation.topicKey ?? null,
      observation.intentKey ?? null,
      observation.promptKey,
    ]);
    const group = sourcePersistenceSeries.get(key) ?? {
      providerKey: observation.providerKey,
      provider: observation.provider,
      ...(observation.topic ? { topic: observation.topic, topicKey: observation.topicKey } : {}),
      ...(observation.intent
        ? { intent: observation.intent, intentKey: observation.intentKey }
        : {}),
      ...(observation.model ? { model: observation.model, modelKey: observation.modelKey } : {}),
      ...(observation.surface
        ? { surface: observation.surface, surfaceKey: observation.surfaceKey }
        : {}),
      ...(observation.locale
        ? { locale: observation.locale, localeKey: observation.localeKey }
        : {}),
      promptKey: observation.promptKey,
      snapshots: [],
    };
    group.snapshots.push({
      observedAt: observation.observedAt,
      inputIndex,
      citations: observation.citations,
      citationListComplete: observation.citationListComplete,
    });
    sourcePersistenceSeries.set(key, group);
  });
  const sourcePersistenceStats = new Map<
    string,
    {
      provider: string;
      providerKey: string;
      sourceDomain: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      unlabeled: boolean;
      model?: string;
      modelKey?: string;
      surface?: string;
      surfaceKey?: string;
      locale?: string;
      localeKey?: string;
      promptGroupsWithSource: number;
      capturesWithSource: number;
      sampledTimestampsWithSource: number;
      promptGroupsStartingWithSource: number;
      promptGroupsEndingWithSource: number;
      orderedTransitionsWithSourcePresence: number;
      sourcePresentAtPreviousTimestamp: number;
      sourcePresentAtBothTimestamps: number;
      sourceAbsentAtNextTimestamp: number;
      sourceTransitionsObservedAtNextTimestamp: number;
      sourceNextTimestampUnobservedDueToTruncation: number;
      sourceFirstAppearedAtNextTimestamp: number;
      sourcePresenceAtPreviousTimestampUnobservedDueToTruncation: number;
      retentionByFollowUpInterval: Array<{
        transitionsAtRisk: number;
        retainedAtNextTimestamp: number;
        transitionsUnobservedDueToTruncation: number;
      }>;
      retentionByPreviousCitationRank: Array<{
        transitionsAtRisk: number;
        promptGroupsAtRisk: number;
        retainedAtNextTimestamp: number;
        transitionsUnobservedDueToTruncation: number;
      }>;
      promptRetentionRates: number[];
      promptRetentionRatesByInterval: number[][];
      nextTimestampRetentionPercent: number | null;
      gapDaysTotal: number;
      meanDaysUntilNextSampleWhenPreviouslyCited: number | null;
      longestConsecutiveSampledTimestampsWithSource: number;
      firstObservedCitationAt: string;
      lastObservedCitationAt: string;
    }
  >();
  let sourcePersistenceWorkTruncated = false;
  let sourcePersistenceTimestampChecksPerformed = 0;
  for (const group of [...sourcePersistenceSeries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value)) {
    const orderedCaptures = [...group.snapshots].sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) || left.inputIndex - right.inputIndex
    );
    const timestampBuckets: Array<{
      observedAt: string;
      captures: number;
      completeCitationListCaptures: number;
      domainCaptureCounts: Map<string, number>;
      domainMinimumPositions: Map<string, number>;
    }> = [];
    for (const capture of orderedCaptures) {
      let bucket = timestampBuckets[timestampBuckets.length - 1];
      if (!bucket || bucket.observedAt !== capture.observedAt) {
        bucket = {
          observedAt: capture.observedAt,
          captures: 0,
          completeCitationListCaptures: 0,
          domainCaptureCounts: new Map(),
          domainMinimumPositions: new Map(),
        };
        timestampBuckets.push(bucket);
      }
      bucket.captures += 1;
      if (capture.citationListComplete) bucket.completeCitationListCaptures += 1;
      const captureDomainPositions = new Map<string, number>();
      for (const citation of capture.citations) {
        const previousPosition = captureDomainPositions.get(citation.domain);
        if (previousPosition === undefined || citation.position < previousPosition)
          captureDomainPositions.set(citation.domain, citation.position);
      }
      for (const [domain, bestPosition] of captureDomainPositions) {
        bucket.domainCaptureCounts.set(domain, (bucket.domainCaptureCounts.get(domain) ?? 0) + 1);
        const previousBestPosition = bucket.domainMinimumPositions.get(domain);
        if (previousBestPosition === undefined || bestPosition < previousBestPosition)
          bucket.domainMinimumPositions.set(domain, bestPosition);
      }
    }
    const sourceDomains = [
      ...new Set(timestampBuckets.flatMap((bucket) => [...bucket.domainCaptureCounts.keys()])),
    ].sort();
    for (const sourceDomain of sourceDomains) {
      const profileKey = JSON.stringify([
        group.providerKey,
        group.modelKey ?? null,
        group.surfaceKey ?? null,
        group.localeKey ?? null,
        group.topicKey ?? null,
        group.intentKey ?? null,
        sourceDomain.toLowerCase(),
      ]);
      let stats = sourcePersistenceStats.get(profileKey);
      if (
        sourcePersistenceTimestampChecksPerformed + timestampBuckets.length >
        MAX_SOURCE_PERSISTENCE_TIMESTAMP_CHECKS
      ) {
        sourcePersistenceWorkTruncated = true;
        break;
      }
      if (!stats && sourcePersistenceStats.size >= MAX_SOURCE_PERSISTENCE_WORKING_PROFILES) {
        sourcePersistenceWorkTruncated = true;
        break;
      }
      sourcePersistenceTimestampChecksPerformed += timestampBuckets.length;
      if (!stats) {
        stats = {
          provider: group.provider,
          providerKey: group.providerKey,
          sourceDomain,
          ...(group.topic ? { topic: group.topic, topicKey: group.topicKey } : {}),
          ...(group.intent ? { intent: group.intent, intentKey: group.intentKey } : {}),
          unlabeled: group.topicKey === undefined && group.intentKey === undefined,
          ...(group.model ? { model: group.model, modelKey: group.modelKey } : {}),
          ...(group.surface ? { surface: group.surface, surfaceKey: group.surfaceKey } : {}),
          ...(group.locale ? { locale: group.locale, localeKey: group.localeKey } : {}),
          promptGroupsWithSource: 0,
          capturesWithSource: 0,
          sampledTimestampsWithSource: 0,
          promptGroupsStartingWithSource: 0,
          promptGroupsEndingWithSource: 0,
          orderedTransitionsWithSourcePresence: 0,
          sourcePresentAtPreviousTimestamp: 0,
          sourcePresentAtBothTimestamps: 0,
          sourceAbsentAtNextTimestamp: 0,
          sourceTransitionsObservedAtNextTimestamp: 0,
          sourceNextTimestampUnobservedDueToTruncation: 0,
          sourceFirstAppearedAtNextTimestamp: 0,
          sourcePresenceAtPreviousTimestampUnobservedDueToTruncation: 0,
          retentionByFollowUpInterval: SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS.map(() => ({
            transitionsAtRisk: 0,
            retainedAtNextTimestamp: 0,
            transitionsUnobservedDueToTruncation: 0,
          })),
          retentionByPreviousCitationRank: SOURCE_PERSISTENCE_PREVIOUS_RANK_BANDS.map(() => ({
            transitionsAtRisk: 0,
            promptGroupsAtRisk: 0,
            retainedAtNextTimestamp: 0,
            transitionsUnobservedDueToTruncation: 0,
          })),
          promptRetentionRates: [],
          promptRetentionRatesByInterval: SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS.map(() => []),
          nextTimestampRetentionPercent: null,
          gapDaysTotal: 0,
          meanDaysUntilNextSampleWhenPreviouslyCited: null,
          longestConsecutiveSampledTimestampsWithSource: 0,
          firstObservedCitationAt: '',
          lastObservedCitationAt: '',
        };
        sourcePersistenceStats.set(profileKey, stats);
      }
      stats.promptGroupsWithSource += 1;
      let runLength = 0;
      let longestRun = 0;
      let promptTransitionsAtRisk = 0;
      let promptRetainedTransitions = 0;
      const promptIntervalTransitionsAtRisk = SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS.map(
        () => 0
      );
      const promptIntervalRetainedTransitions = SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS.map(
        () => 0
      );
      const promptRankTransitionsAtRisk = SOURCE_PERSISTENCE_PREVIOUS_RANK_BANDS.map(() => 0);
      for (let index = 0; index < timestampBuckets.length; index += 1) {
        const bucket = timestampBuckets[index]!;
        const capturesWithSource = bucket.domainCaptureCounts.get(sourceDomain) ?? 0;
        const sourcePresent = capturesWithSource > 0;
        stats.capturesWithSource += capturesWithSource;
        if (sourcePresent) {
          stats.sampledTimestampsWithSource += 1;
          if (!stats.firstObservedCitationAt || bucket.observedAt < stats.firstObservedCitationAt) {
            stats.firstObservedCitationAt = bucket.observedAt;
          }
          if (!stats.lastObservedCitationAt || bucket.observedAt > stats.lastObservedCitationAt) {
            stats.lastObservedCitationAt = bucket.observedAt;
          }
          runLength += 1;
          longestRun = Math.max(longestRun, runLength);
        } else runLength = 0;
        if (index === 0 && sourcePresent) stats.promptGroupsStartingWithSource += 1;
        if (index === timestampBuckets.length - 1 && sourcePresent)
          stats.promptGroupsEndingWithSource += 1;
        if (index === 0) continue;
        const previous = timestampBuckets[index - 1]!;
        const previousPresent = previous.domainCaptureCounts.has(sourceDomain);
        if (previousPresent || sourcePresent) stats.orderedTransitionsWithSourcePresence += 1;
        if (!previousPresent && sourcePresent) {
          if (previous.completeCitationListCaptures > 0)
            stats.sourceFirstAppearedAtNextTimestamp += 1;
          else stats.sourcePresenceAtPreviousTimestampUnobservedDueToTruncation += 1;
        }
        if (!previousPresent) continue;
        stats.sourcePresentAtPreviousTimestamp += 1;
        const gapDays =
          Math.max(0, Date.parse(bucket.observedAt) - Date.parse(previous.observedAt)) / 86_400_000;
        stats.gapDaysTotal += gapDays;
        const intervalBandIndex = SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS.findIndex(
          ({ maximumDays }) => maximumDays === null || gapDays <= maximumDays
        );
        const intervalBand = stats.retentionByFollowUpInterval[intervalBandIndex]!;
        intervalBand.transitionsAtRisk += 1;
        const previousRank = previous.domainMinimumPositions.get(sourceDomain)!;
        const previousRankBandIndex = SOURCE_PERSISTENCE_PREVIOUS_RANK_BANDS.findIndex(
          ({ maximumRank }) => maximumRank === null || previousRank <= maximumRank
        );
        const previousRankBand = stats.retentionByPreviousCitationRank[previousRankBandIndex]!;
        previousRankBand.transitionsAtRisk += 1;
        promptRankTransitionsAtRisk[previousRankBandIndex]! += 1;
        const nextAbsenceIsKnown = sourcePresent || bucket.completeCitationListCaptures > 0;
        if (!nextAbsenceIsKnown) {
          stats.sourceNextTimestampUnobservedDueToTruncation += 1;
          intervalBand.transitionsUnobservedDueToTruncation += 1;
          previousRankBand.transitionsUnobservedDueToTruncation += 1;
          continue;
        }
        stats.sourceTransitionsObservedAtNextTimestamp += 1;
        promptTransitionsAtRisk += 1;
        promptIntervalTransitionsAtRisk[intervalBandIndex] += 1;
        if (sourcePresent) {
          stats.sourcePresentAtBothTimestamps += 1;
          promptRetainedTransitions += 1;
          intervalBand.retainedAtNextTimestamp += 1;
          promptIntervalRetainedTransitions[intervalBandIndex] += 1;
        } else stats.sourceAbsentAtNextTimestamp += 1;
        if (sourcePresent) previousRankBand.retainedAtNextTimestamp += 1;
      }
      if (promptTransitionsAtRisk > 0) {
        stats.promptRetentionRates.push(
          (promptRetainedTransitions / promptTransitionsAtRisk) * 100
        );
      }
      promptIntervalTransitionsAtRisk.forEach((transitions, index) => {
        if (transitions > 0) {
          stats.promptRetentionRatesByInterval[index]!.push(
            (promptIntervalRetainedTransitions[index]! / transitions) * 100
          );
        }
      });
      promptRankTransitionsAtRisk.forEach((transitions, index) => {
        if (transitions > 0) stats.retentionByPreviousCitationRank[index]!.promptGroupsAtRisk += 1;
      });
      stats.longestConsecutiveSampledTimestampsWithSource = Math.max(
        stats.longestConsecutiveSampledTimestampsWithSource,
        longestRun
      );
    }
    if (sourcePersistenceWorkTruncated) break;
  }
  let sourcePersistenceBootstrapUpdatesPerformed = 0;
  let sourcePersistenceBootstrapWorkTruncated = false;
  const sortedSourcePersistenceStats = [...sourcePersistenceStats.values()].sort(
    (left, right) =>
      right.sourcePresentAtPreviousTimestamp - left.sourcePresentAtPreviousTimestamp ||
      right.promptGroupsWithSource - left.promptGroupsWithSource ||
      left.provider.localeCompare(right.provider) ||
      left.sourceDomain.localeCompare(right.sourceDomain) ||
      (left.model ?? '').localeCompare(right.model ?? '') ||
      (left.surface ?? '').localeCompare(right.surface ?? '') ||
      (left.locale ?? '').localeCompare(right.locale ?? '') ||
      (left.topic ?? '').localeCompare(right.topic ?? '') ||
      (left.intent ?? '').localeCompare(right.intent ?? '')
  );
  const sourcePersistenceProfiles = sortedSourcePersistenceStats
    .slice(0, MAX_RETURNED_SOURCE_PERSISTENCE_PROFILES)
    .map((stats): AiAnswerCitationSourcePersistenceProfile => {
      const promptRetentionRates = stats.promptRetentionRates;
      let retentionBootstrapStatus: AiAnswerCitationSourcePersistenceProfile['retentionBootstrapStatus'];
      let retentionConfidenceInterval: AiAnswerCitationMetricConfidenceInterval95 | null = null;
      if (sourcePersistenceWorkTruncated) {
        retentionBootstrapStatus = 'source-analysis-truncated';
      } else if (promptRetentionRates.length < 2) {
        retentionBootstrapStatus = 'insufficient-prompt-support';
      } else {
        const bootstrapUpdatesRequired = promptRetentionRates.length * 1_000;
        if (
          sourcePersistenceBootstrapUpdatesPerformed + bootstrapUpdatesRequired >
          MAX_SOURCE_PERSISTENCE_BOOTSTRAP_UPDATES
        ) {
          retentionBootstrapStatus = 'work-budget-exceeded';
          sourcePersistenceBootstrapWorkTruncated = true;
        } else {
          sourcePersistenceBootstrapUpdatesPerformed += bootstrapUpdatesRequired;
          retentionConfidenceInterval = bootstrapMeanMetricConfidenceInterval95(
            promptRetentionRates,
            JSON.stringify([
              stats.providerKey,
              stats.sourceDomain.toLowerCase(),
              stats.modelKey ?? null,
              stats.surfaceKey ?? null,
              stats.localeKey ?? null,
              stats.topicKey ?? null,
              stats.intentKey ?? null,
            ])
          );
          retentionBootstrapStatus = 'complete';
        }
      }
      return {
        provider: stats.provider,
        sourceDomain: stats.sourceDomain,
        ...(stats.topic ? { topic: stats.topic } : {}),
        ...(stats.intent ? { intent: stats.intent } : {}),
        unlabeled: stats.unlabeled,
        ...(stats.model ? { model: stats.model } : {}),
        ...(stats.surface ? { surface: stats.surface } : {}),
        ...(stats.locale ? { locale: stats.locale } : {}),
        promptGroupsWithSource: stats.promptGroupsWithSource,
        capturesWithSource: stats.capturesWithSource,
        sampledTimestampsWithSource: stats.sampledTimestampsWithSource,
        promptGroupsStartingWithSource: stats.promptGroupsStartingWithSource,
        promptGroupsEndingWithSource: stats.promptGroupsEndingWithSource,
        orderedTransitionsWithSourcePresence: stats.orderedTransitionsWithSourcePresence,
        sourcePresentAtPreviousTimestamp: stats.sourcePresentAtPreviousTimestamp,
        sourcePresentAtBothTimestamps: stats.sourcePresentAtBothTimestamps,
        sourceAbsentAtNextTimestamp: stats.sourceAbsentAtNextTimestamp,
        sourceTransitionsObservedAtNextTimestamp: stats.sourceTransitionsObservedAtNextTimestamp,
        sourceNextTimestampUnobservedDueToTruncation:
          stats.sourceNextTimestampUnobservedDueToTruncation,
        sourceFirstAppearedAtNextTimestamp: stats.sourceFirstAppearedAtNextTimestamp,
        sourcePresenceAtPreviousTimestampUnobservedDueToTruncation:
          stats.sourcePresenceAtPreviousTimestampUnobservedDueToTruncation,
        nextTimestampRetentionPercent:
          stats.sourceTransitionsObservedAtNextTimestamp > 0
            ? Number(
                (
                  (stats.sourcePresentAtBothTimestamps /
                    stats.sourceTransitionsObservedAtNextTimestamp) *
                  100
                ).toFixed(4)
              )
            : null,
        promptGroupsWithSourcePresentTransitions: promptRetentionRates.length,
        equalPromptMeanNextTimestampRetentionPercent:
          promptRetentionRates.length > 0
            ? Number(
                (
                  promptRetentionRates.reduce((sum, value) => sum + value, 0) /
                  promptRetentionRates.length
                ).toFixed(4)
              )
            : null,
        equalPromptMeanNextTimestampRetentionConfidenceInterval95: retentionConfidenceInterval,
        retentionBootstrapStatus,
        retentionByFollowUpInterval: stats.retentionByFollowUpInterval.map((band, index) => {
          const promptRates = stats.promptRetentionRatesByInterval[index]!;
          let bootstrapStatus: AiAnswerCitationSourcePersistenceIntervalProfile['bootstrapStatus'];
          let confidenceInterval: AiAnswerCitationMetricConfidenceInterval95 | null = null;
          if (sourcePersistenceWorkTruncated) {
            bootstrapStatus = 'source-analysis-truncated';
          } else if (promptRates.length < 2) {
            bootstrapStatus = 'insufficient-prompt-support';
          } else {
            const bootstrapUpdatesRequired = promptRates.length * 1_000;
            if (
              sourcePersistenceBootstrapUpdatesPerformed + bootstrapUpdatesRequired >
              MAX_SOURCE_PERSISTENCE_BOOTSTRAP_UPDATES
            ) {
              bootstrapStatus = 'work-budget-exceeded';
              sourcePersistenceBootstrapWorkTruncated = true;
            } else {
              sourcePersistenceBootstrapUpdatesPerformed += bootstrapUpdatesRequired;
              confidenceInterval = bootstrapMeanMetricConfidenceInterval95(
                promptRates,
                JSON.stringify([
                  stats.providerKey,
                  stats.sourceDomain.toLowerCase(),
                  stats.modelKey ?? null,
                  stats.surfaceKey ?? null,
                  stats.localeKey ?? null,
                  stats.topicKey ?? null,
                  stats.intentKey ?? null,
                  'follow-up-interval',
                  index,
                ])
              );
              bootstrapStatus = 'complete';
            }
          }
          return {
            intervalLabel: SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS[index]!.label,
            maximumDays: SOURCE_PERSISTENCE_FOLLOW_UP_INTERVAL_BANDS[index]!.maximumDays,
            transitionsAtRisk: band.transitionsAtRisk,
            retainedAtNextTimestamp: band.retainedAtNextTimestamp,
            transitionsUnobservedDueToTruncation: band.transitionsUnobservedDueToTruncation,
            retentionPercent:
              band.transitionsAtRisk - band.transitionsUnobservedDueToTruncation > 0
                ? Number(
                    (
                      (band.retainedAtNextTimestamp /
                        (band.transitionsAtRisk - band.transitionsUnobservedDueToTruncation)) *
                      100
                    ).toFixed(4)
                  )
                : null,
            promptGroupsAtRisk: promptRates.length,
            equalPromptMeanRetentionPercent:
              promptRates.length > 0
                ? Number(
                    (
                      promptRates.reduce((sum, value) => sum + value, 0) / promptRates.length
                    ).toFixed(4)
                  )
                : null,
            equalPromptMeanRetentionConfidenceInterval95: confidenceInterval,
            bootstrapStatus,
          };
        }),
        retentionByPreviousCitationRank: stats.retentionByPreviousCitationRank.map(
          (band, index) => ({
            rankBand: SOURCE_PERSISTENCE_PREVIOUS_RANK_BANDS[index]!.label,
            maximumRank: SOURCE_PERSISTENCE_PREVIOUS_RANK_BANDS[index]!.maximumRank,
            transitionsAtRisk: band.transitionsAtRisk,
            promptGroupsAtRisk: band.promptGroupsAtRisk,
            retainedAtNextTimestamp: band.retainedAtNextTimestamp,
            transitionsUnobservedDueToTruncation: band.transitionsUnobservedDueToTruncation,
            retentionPercent:
              band.transitionsAtRisk - band.transitionsUnobservedDueToTruncation > 0
                ? Number(
                    (
                      (band.retainedAtNextTimestamp /
                        (band.transitionsAtRisk - band.transitionsUnobservedDueToTruncation)) *
                      100
                    ).toFixed(4)
                  )
                : null,
          })
        ),
        meanDaysUntilNextSampleWhenPreviouslyCited:
          stats.sourcePresentAtPreviousTimestamp > 0
            ? Number((stats.gapDaysTotal / stats.sourcePresentAtPreviousTimestamp).toFixed(4))
            : null,
        longestConsecutiveSampledTimestampsWithSource:
          stats.longestConsecutiveSampledTimestampsWithSource,
        firstObservedCitationAt: stats.firstObservedCitationAt,
        lastObservedCitationAt: stats.lastObservedCitationAt,
      };
    });
  const sourcePersistenceProfilesTruncated =
    sourcePersistenceWorkTruncated ||
    sortedSourcePersistenceStats.length > MAX_RETURNED_SOURCE_PERSISTENCE_PROFILES;
  let citationUrlPersistenceProfiles: AiAnswerCitationUrlPersistenceProfile[] | undefined;
  let citationUrlPersistenceProfilesTruncated = false;
  let citationUrlPersistenceProfilesAvailable = 0;
  let citationUrlPersistenceWorkTruncated = false;
  let citationUrlPersistenceTimestampChecksPerformed = 0;
  if (options.includeCitationUrlPersistence) {
    const citationUrlPersistenceStats = new Map<
      string,
      {
        provider: string;
        providerKey: string;
        citationUrl: string;
        topic?: string;
        topicKey?: string;
        intent?: string;
        intentKey?: string;
        unlabeled: boolean;
        model?: string;
        modelKey?: string;
        surface?: string;
        surfaceKey?: string;
        locale?: string;
        localeKey?: string;
        promptGroupsWithUrl: number;
        capturesWithUrl: number;
        sampledTimestampsWithUrl: number;
        promptGroupsStartingWithUrl: number;
        promptGroupsEndingWithUrl: number;
        orderedTransitionsWithUrlPresence: number;
        urlPresentAtPreviousTimestamp: number;
        urlPresentAtBothTimestamps: number;
        urlAbsentAtNextTimestamp: number;
        urlTransitionsObservedAtNextTimestamp: number;
        urlNextTimestampUnobservedDueToTruncation: number;
        urlFirstAppearedAtNextTimestamp: number;
        urlPresenceAtPreviousTimestampUnobservedDueToTruncation: number;
        firstObservedCitationAt: string;
        lastObservedCitationAt: string;
      }
    >();
    for (const group of [...sourcePersistenceSeries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value)) {
      const orderedCaptures = [...group.snapshots].sort(
        (left, right) =>
          left.observedAt.localeCompare(right.observedAt) || left.inputIndex - right.inputIndex
      );
      const timestampBuckets: Array<{
        observedAt: string;
        captures: number;
        completeCitationListCaptures: number;
        urlCaptureCounts: Map<string, number>;
      }> = [];
      for (const capture of orderedCaptures) {
        let bucket = timestampBuckets[timestampBuckets.length - 1];
        if (!bucket || bucket.observedAt !== capture.observedAt) {
          bucket = {
            observedAt: capture.observedAt,
            captures: 0,
            completeCitationListCaptures: 0,
            urlCaptureCounts: new Map(),
          };
          timestampBuckets.push(bucket);
        }
        bucket.captures += 1;
        if (capture.citationListComplete) bucket.completeCitationListCaptures += 1;
        for (const url of new Set(capture.citations.map(({ url: citedUrl }) => citedUrl))) {
          bucket.urlCaptureCounts.set(url, (bucket.urlCaptureCounts.get(url) ?? 0) + 1);
        }
      }
      const citationUrlSet = new Set<string>();
      for (const bucket of timestampBuckets) {
        for (const url of bucket.urlCaptureCounts.keys()) citationUrlSet.add(url);
      }
      const citationUrls = [...citationUrlSet].sort();
      for (const citationUrl of citationUrls) {
        const profileKey = JSON.stringify([
          group.providerKey,
          group.modelKey ?? null,
          group.surfaceKey ?? null,
          group.localeKey ?? null,
          group.topicKey ?? null,
          group.intentKey ?? null,
          citationUrl,
        ]);
        let stats = citationUrlPersistenceStats.get(profileKey);
        if (
          citationUrlPersistenceTimestampChecksPerformed + timestampBuckets.length >
          MAX_CITATION_URL_PERSISTENCE_TIMESTAMP_CHECKS
        ) {
          citationUrlPersistenceWorkTruncated = true;
          break;
        }
        if (
          !stats &&
          citationUrlPersistenceStats.size >= MAX_CITATION_URL_PERSISTENCE_WORKING_PROFILES
        ) {
          citationUrlPersistenceWorkTruncated = true;
          break;
        }
        citationUrlPersistenceTimestampChecksPerformed += timestampBuckets.length;
        if (!stats) {
          stats = {
            provider: group.provider,
            providerKey: group.providerKey,
            citationUrl,
            ...(group.topic ? { topic: group.topic, topicKey: group.topicKey } : {}),
            ...(group.intent ? { intent: group.intent, intentKey: group.intentKey } : {}),
            unlabeled: group.topicKey === undefined && group.intentKey === undefined,
            ...(group.model ? { model: group.model, modelKey: group.modelKey } : {}),
            ...(group.surface ? { surface: group.surface, surfaceKey: group.surfaceKey } : {}),
            ...(group.locale ? { locale: group.locale, localeKey: group.localeKey } : {}),
            promptGroupsWithUrl: 0,
            capturesWithUrl: 0,
            sampledTimestampsWithUrl: 0,
            promptGroupsStartingWithUrl: 0,
            promptGroupsEndingWithUrl: 0,
            orderedTransitionsWithUrlPresence: 0,
            urlPresentAtPreviousTimestamp: 0,
            urlPresentAtBothTimestamps: 0,
            urlAbsentAtNextTimestamp: 0,
            urlTransitionsObservedAtNextTimestamp: 0,
            urlNextTimestampUnobservedDueToTruncation: 0,
            urlFirstAppearedAtNextTimestamp: 0,
            urlPresenceAtPreviousTimestampUnobservedDueToTruncation: 0,
            firstObservedCitationAt: '',
            lastObservedCitationAt: '',
          };
          citationUrlPersistenceStats.set(profileKey, stats);
        }
        stats.promptGroupsWithUrl += 1;
        for (let index = 0; index < timestampBuckets.length; index += 1) {
          const bucket = timestampBuckets[index]!;
          const capturesWithUrl = bucket.urlCaptureCounts.get(citationUrl) ?? 0;
          const urlPresent = capturesWithUrl > 0;
          stats.capturesWithUrl += capturesWithUrl;
          if (urlPresent) {
            stats.sampledTimestampsWithUrl += 1;
            if (!stats.firstObservedCitationAt || bucket.observedAt < stats.firstObservedCitationAt)
              stats.firstObservedCitationAt = bucket.observedAt;
            if (!stats.lastObservedCitationAt || bucket.observedAt > stats.lastObservedCitationAt)
              stats.lastObservedCitationAt = bucket.observedAt;
          }
          if (index === 0 && urlPresent) stats.promptGroupsStartingWithUrl += 1;
          if (index === timestampBuckets.length - 1 && urlPresent)
            stats.promptGroupsEndingWithUrl += 1;
          if (index === 0) continue;
          const previousPresent = timestampBuckets[index - 1]!.urlCaptureCounts.has(citationUrl);
          if (previousPresent || urlPresent) stats.orderedTransitionsWithUrlPresence += 1;
          if (!previousPresent && urlPresent) {
            if (timestampBuckets[index - 1]!.completeCitationListCaptures > 0) {
              stats.urlFirstAppearedAtNextTimestamp += 1;
            } else stats.urlPresenceAtPreviousTimestampUnobservedDueToTruncation += 1;
          }
          if (!previousPresent) continue;
          stats.urlPresentAtPreviousTimestamp += 1;
          if (urlPresent) {
            stats.urlPresentAtBothTimestamps += 1;
            stats.urlTransitionsObservedAtNextTimestamp += 1;
          } else if (bucket.completeCitationListCaptures > 0) {
            stats.urlAbsentAtNextTimestamp += 1;
            stats.urlTransitionsObservedAtNextTimestamp += 1;
          } else stats.urlNextTimestampUnobservedDueToTruncation += 1;
        }
      }
      if (citationUrlPersistenceWorkTruncated) break;
    }
    const sortedCitationUrlPersistenceStats = [...citationUrlPersistenceStats.values()].sort(
      (left, right) =>
        right.urlPresentAtPreviousTimestamp - left.urlPresentAtPreviousTimestamp ||
        right.promptGroupsWithUrl - left.promptGroupsWithUrl ||
        left.provider.localeCompare(right.provider) ||
        left.citationUrl.localeCompare(right.citationUrl) ||
        (left.model ?? '').localeCompare(right.model ?? '') ||
        (left.surface ?? '').localeCompare(right.surface ?? '') ||
        (left.locale ?? '').localeCompare(right.locale ?? '') ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '')
    );
    citationUrlPersistenceProfilesAvailable = sortedCitationUrlPersistenceStats.length;
    citationUrlPersistenceProfilesTruncated =
      citationUrlPersistenceWorkTruncated ||
      sortedCitationUrlPersistenceStats.length > MAX_RETURNED_CITATION_URL_PERSISTENCE_PROFILES;
    citationUrlPersistenceProfiles = sortedCitationUrlPersistenceStats
      .slice(0, MAX_RETURNED_CITATION_URL_PERSISTENCE_PROFILES)
      .map((stats): AiAnswerCitationUrlPersistenceProfile => ({
        provider: stats.provider,
        citationUrl: stats.citationUrl,
        ...(stats.topic ? { topic: stats.topic } : {}),
        ...(stats.intent ? { intent: stats.intent } : {}),
        unlabeled: stats.unlabeled,
        ...(stats.model ? { model: stats.model } : {}),
        ...(stats.surface ? { surface: stats.surface } : {}),
        ...(stats.locale ? { locale: stats.locale } : {}),
        promptGroupsWithUrl: stats.promptGroupsWithUrl,
        capturesWithUrl: stats.capturesWithUrl,
        sampledTimestampsWithUrl: stats.sampledTimestampsWithUrl,
        promptGroupsStartingWithUrl: stats.promptGroupsStartingWithUrl,
        promptGroupsEndingWithUrl: stats.promptGroupsEndingWithUrl,
        orderedTransitionsWithUrlPresence: stats.orderedTransitionsWithUrlPresence,
        urlPresentAtPreviousTimestamp: stats.urlPresentAtPreviousTimestamp,
        urlPresentAtBothTimestamps: stats.urlPresentAtBothTimestamps,
        urlAbsentAtNextTimestamp: stats.urlAbsentAtNextTimestamp,
        urlTransitionsObservedAtNextTimestamp: stats.urlTransitionsObservedAtNextTimestamp,
        urlNextTimestampUnobservedDueToTruncation: stats.urlNextTimestampUnobservedDueToTruncation,
        urlFirstAppearedAtNextTimestamp: stats.urlFirstAppearedAtNextTimestamp,
        urlPresenceAtPreviousTimestampUnobservedDueToTruncation:
          stats.urlPresenceAtPreviousTimestampUnobservedDueToTruncation,
        nextTimestampRetentionPercent:
          stats.urlTransitionsObservedAtNextTimestamp > 0
            ? Number(
                (
                  (stats.urlPresentAtBothTimestamps / stats.urlTransitionsObservedAtNextTimestamp) *
                  100
                ).toFixed(4)
              )
            : null,
        firstObservedCitationAt: stats.firstObservedCitationAt,
        lastObservedCitationAt: stats.lastObservedCitationAt,
      }));
  }
  const temporalStabilityProfiles = [...temporalGroups.values()]
    .flatMap((group): AiAnswerCitationTemporalStabilityProfile[] => {
      if (group.snapshots.length < 2) return [];
      const snapshots = [...group.snapshots].sort(
        (left, right) =>
          left.observedAt.localeCompare(right.observedAt) || left.inputIndex - right.inputIndex
      );
      const distinctDomains = new Set<string>();
      const distinctUrls = new Set<string>();
      const domainJaccards: number[] = [];
      const ownedDomainJaccards: number[] = [];
      const pageJaccards: number[] = [];
      const absoluteFirstPositionDeltas: number[] = [];
      const absoluteTopThreeDeltas: number[] = [];
      const absoluteOwnedEventShareDeltas: number[] = [];
      let sameTimestampAdjacentPairs = 0;
      let orderedTransitions = 0;
      let citationPresenceChanges = 0;
      let citationPresenceTransitionsUnobservedDueToTruncation = 0;
      let consecutiveNoCitationTransitions = 0;
      let incompleteSourceListTransitions = 0;
      let ownedCitationPresenceChanges = 0;
      let ownedCitationPresenceTransitionsUnobservedDueToTruncation = 0;
      let ownedEventShareTransitionsUnobservedDueToTruncation = 0;
      let domainAppearances = 0;
      let domainDisappearances = 0;
      let domainPresenceComparisonsUnobservedDueToTruncation = 0;
      let citationUrlPresenceComparisonsUnobservedDueToTruncation = 0;
      let positionShareTransitionsUnobservedDueToTruncation = 0;
      for (let index = 0; index < snapshots.length; index += 1) {
        const current = snapshots[index]!;
        const currentDomains = new Set(current.citations.map(({ domain }) => domain));
        const currentUrls = new Set(current.citations.map(({ url }) => url));
        for (const domain of currentDomains) distinctDomains.add(domain);
        for (const url of currentUrls) distinctUrls.add(url);
        if (index === 0) continue;
        const previous = snapshots[index - 1]!;
        if (previous.observedAt === current.observedAt) {
          sameTimestampAdjacentPairs += 1;
          continue;
        }
        orderedTransitions += 1;
        const previousDomains = new Set(previous.citations.map(({ domain }) => domain));
        const previousUrls = new Set(previous.citations.map(({ url }) => url));
        const sourceListsComplete = previous.citationListComplete && current.citationListComplete;
        if (!sourceListsComplete) {
          incompleteSourceListTransitions += 1;
        }
        const previousOwnedDomains =
          ownedDomains.length > 0
            ? new Set(
                previous.citations
                  .filter(({ domain }) => isOwnedDomain(domain, ownedDomains))
                  .map(({ domain }) => domain)
              )
            : undefined;
        const currentOwnedDomains =
          ownedDomains.length > 0
            ? new Set(
                current.citations
                  .filter(({ domain }) => isOwnedDomain(domain, ownedDomains))
                  .map(({ domain }) => domain)
              )
            : undefined;
        const previousCitationPresenceKnown =
          previousUrls.size > 0 || previous.citationListComplete;
        const currentCitationPresenceKnown = currentUrls.size > 0 || current.citationListComplete;
        if (previousCitationPresenceKnown && currentCitationPresenceKnown) {
          if (previousUrls.size > 0 !== currentUrls.size > 0) citationPresenceChanges += 1;
          if (previousUrls.size === 0 && currentUrls.size === 0)
            consecutiveNoCitationTransitions += 1;
        } else citationPresenceTransitionsUnobservedDueToTruncation += 1;
        if (previousOwnedDomains && currentOwnedDomains) {
          const previousOwnedPresenceKnown =
            previousOwnedDomains.size > 0 || previous.citationListComplete;
          const currentOwnedPresenceKnown =
            currentOwnedDomains.size > 0 || current.citationListComplete;
          if (previousOwnedPresenceKnown && currentOwnedPresenceKnown) {
            if (previousOwnedDomains.size > 0 !== currentOwnedDomains.size > 0)
              ownedCitationPresenceChanges += 1;
          } else ownedCitationPresenceTransitionsUnobservedDueToTruncation += 1;
        }
        for (const domain of currentDomains) {
          if (!previousDomains.has(domain)) {
            if (previous.citationListComplete) domainAppearances += 1;
            else domainPresenceComparisonsUnobservedDueToTruncation += 1;
          }
        }
        for (const domain of previousDomains) {
          if (!currentDomains.has(domain)) {
            if (current.citationListComplete) domainDisappearances += 1;
            else domainPresenceComparisonsUnobservedDueToTruncation += 1;
          }
        }
        for (const url of currentUrls) {
          if (!previousUrls.has(url) && !previous.citationListComplete)
            citationUrlPresenceComparisonsUnobservedDueToTruncation += 1;
        }
        for (const url of previousUrls) {
          if (!currentUrls.has(url) && !current.citationListComplete)
            citationUrlPresenceComparisonsUnobservedDueToTruncation += 1;
        }
        if (sourceListsComplete) {
          const domainUnion = new Set([...previousDomains, ...currentDomains]);
          if (domainUnion.size > 0) {
            const sharedDomains = [...previousDomains].filter((domain) =>
              currentDomains.has(domain)
            ).length;
            domainJaccards.push(sharedDomains / domainUnion.size);
          }
          const urlUnion = new Set([...previousUrls, ...currentUrls]);
          if (urlUnion.size > 0) {
            const sharedUrls = [...previousUrls].filter((url) => currentUrls.has(url)).length;
            pageJaccards.push(sharedUrls / urlUnion.size);
          }
          if (previousOwnedDomains && currentOwnedDomains) {
            const ownedDomainUnion = new Set([...previousOwnedDomains, ...currentOwnedDomains]);
            if (ownedDomainUnion.size > 0) {
              const sharedOwnedDomains = [...previousOwnedDomains].filter((domain) =>
                currentOwnedDomains.has(domain)
              ).length;
              ownedDomainJaccards.push(sharedOwnedDomains / ownedDomainUnion.size);
            }
          }
        }
        if (previous.citations.length > 0 && current.citations.length > 0) {
          if (!sourceListsComplete) {
            positionShareTransitionsUnobservedDueToTruncation += 1;
            if (ownedDomains.length > 0) ownedEventShareTransitionsUnobservedDueToTruncation += 1;
          } else {
            const previousFirstShare =
              previous.citations.filter(({ position }) => position === 1).length /
              previous.citations.length;
            const currentFirstShare =
              current.citations.filter(({ position }) => position === 1).length /
              current.citations.length;
            const previousTopThreeShare =
              previous.citations.filter(({ position }) => position <= 3).length /
              previous.citations.length;
            const currentTopThreeShare =
              current.citations.filter(({ position }) => position <= 3).length /
              current.citations.length;
            absoluteFirstPositionDeltas.push(
              Math.abs(currentFirstShare - previousFirstShare) * 100
            );
            absoluteTopThreeDeltas.push(
              Math.abs(currentTopThreeShare - previousTopThreeShare) * 100
            );
            if (ownedDomains.length > 0) {
              const previousOwnedShare =
                previous.citations.filter(({ domain }) => isOwnedDomain(domain, ownedDomains))
                  .length / previous.citations.length;
              const currentOwnedShare =
                current.citations.filter(({ domain }) => isOwnedDomain(domain, ownedDomains))
                  .length / current.citations.length;
              absoluteOwnedEventShareDeltas.push(
                Math.abs(currentOwnedShare - previousOwnedShare) * 100
              );
            }
          }
        }
      }
      const mean = (values: number[]): number | null =>
        values.length > 0
          ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
          : null;
      const medianOrNull = (values: number[]): number | null =>
        values.length > 0 ? Number(median(values).toFixed(4)) : null;
      return [
        {
          ...(group.topic ? { topic: group.topic } : {}),
          ...(group.intent ? { intent: group.intent } : {}),
          unlabeled: group.unlabeled,
          provider: group.provider,
          prompt: group.prompt,
          snapshots: snapshots.length,
          snapshotTransitions: snapshots.length - 1,
          orderedTransitions,
          sameTimestampAdjacentPairs,
          firstObservedAt: snapshots[0]!.observedAt,
          lastObservedAt: snapshots[snapshots.length - 1]!.observedAt,
          citationPresenceChanges,
          citationPresenceTransitionsUnobservedDueToTruncation,
          consecutiveNoCitationTransitions,
          incompleteSourceListTransitions,
          domainOverlapTransitions: domainJaccards.length,
          meanAdjacentDomainJaccard: mean(domainJaccards),
          medianAdjacentDomainJaccard: medianOrNull(domainJaccards),
          pageOverlapTransitions: pageJaccards.length,
          meanAdjacentPageJaccard: mean(pageJaccards),
          medianAdjacentPageJaccard: medianOrNull(pageJaccards),
          domainAppearances,
          domainDisappearances,
          domainPresenceComparisonsUnobservedDueToTruncation,
          citationUrlPresenceComparisonsUnobservedDueToTruncation,
          distinctDomainsObserved: distinctDomains.size,
          distinctCitationUrlsObserved: distinctUrls.size,
          positionShareTransitions: absoluteFirstPositionDeltas.length,
          positionShareTransitionsUnobservedDueToTruncation,
          medianAbsoluteFirstPositionShareChangePercentagePoints: medianOrNull(
            absoluteFirstPositionDeltas
          ),
          medianAbsoluteTopThreeShareChangePercentagePoints: medianOrNull(absoluteTopThreeDeltas),
          ...(ownedDomains.length > 0
            ? {
                ownedCitationPresenceChanges,
                ownedCitationPresenceTransitionsUnobservedDueToTruncation,
                ownedDomainOverlapTransitions: ownedDomainJaccards.length,
                meanAdjacentOwnedDomainJaccard: mean(ownedDomainJaccards),
                medianAdjacentOwnedDomainJaccard: medianOrNull(ownedDomainJaccards),
                ownedEventShareTransitions: absoluteOwnedEventShareDeltas.length,
                ownedEventShareTransitionsUnobservedDueToTruncation,
                medianAbsoluteOwnedCitationEventShareChangePercentagePoints: medianOrNull(
                  absoluteOwnedEventShareDeltas
                ),
              }
            : {}),
        },
      ];
    })
    .sort((left, right) => {
      if (left.medianAdjacentDomainJaccard === null && right.medianAdjacentDomainJaccard !== null)
        return 1;
      if (left.medianAdjacentDomainJaccard !== null && right.medianAdjacentDomainJaccard === null)
        return -1;
      return (
        (left.medianAdjacentDomainJaccard ?? 0) - (right.medianAdjacentDomainJaccard ?? 0) ||
        (left.medianAdjacentPageJaccard ?? 0) - (right.medianAdjacentPageJaccard ?? 0) ||
        right.citationPresenceChanges - left.citationPresenceChanges ||
        right.orderedTransitions - left.orderedTransitions ||
        left.provider.localeCompare(right.provider) ||
        left.prompt.localeCompare(right.prompt)
      );
    });

  const observationsByProvider = new Map<string, NormalizedObservation[]>();
  for (const observation of observations) {
    const providerObservations = observationsByProvider.get(observation.provider) ?? [];
    providerObservations.push(observation);
    observationsByProvider.set(observation.provider, providerObservations);
  }
  const confidenceInterval95 = wilsonRateConfidenceInterval95;
  const summarizeMentions = (
    subset: NormalizedObservation[],
    definition: NormalizedAnswerEntity
  ): AiAnswerCitationEntityMentionSlice => {
    const answerSamples = subset.flatMap((observation) => {
      if (observation.answerText === undefined) return [];
      return [
        { observation, offsets: findEntityMentionOffsets(observation.answerText, definition) },
      ];
    });
    const mentioned = answerSamples.filter(({ offsets }) => offsets.length > 0);
    const notMentioned = answerSamples.filter(({ offsets }) => offsets.length === 0);
    const mentionedWithCitations = mentioned.filter(
      ({ observation }) => observation.citations.length > 0
    ).length;
    const notMentionedWithCitations = notMentioned.filter(
      ({ observation }) => observation.citations.length > 0
    ).length;
    const firstMentionPositions = mentioned.map(({ observation, offsets }) =>
      characterPositionPercent(observation.answerText!, offsets[0]!)
    );
    const firstThirdMentions = firstMentionPositions.filter(
      (position) => position <= 100 / 3
    ).length;
    const citationDomainBreakdown = (
      items: typeof mentioned
    ): {
      citationEvents: number;
      domains: Map<
        string,
        { citationEvents: number; answers: Set<NormalizedObservation>; prompts: Set<string> }
      >;
    } => {
      const domains = new Map<
        string,
        { citationEvents: number; answers: Set<NormalizedObservation>; prompts: Set<string> }
      >();
      let citationEvents = 0;
      for (const { observation } of items) {
        citationEvents += observation.citations.length;
        const domainsInAnswer = new Set<string>();
        for (const citation of observation.citations) {
          const profile = domains.get(citation.domain) ?? {
            citationEvents: 0,
            answers: new Set<NormalizedObservation>(),
            prompts: new Set<string>(),
          };
          profile.citationEvents += 1;
          profile.prompts.add(observation.promptKey);
          domainsInAnswer.add(citation.domain);
          domains.set(citation.domain, profile);
        }
        for (const domain of domainsInAnswer) domains.get(domain)!.answers.add(observation);
      }
      return { citationEvents, domains };
    };
    const mentionedCitationDomains = citationDomainBreakdown(mentioned);
    const notMentionedCitationDomains = citationDomainBreakdown(notMentioned);
    const summarizeOwnedCitationPositions = (
      items: typeof mentioned
    ): AiAnswerCitationEntityOwnedPositionProfile => {
      let citationEvents = 0;
      let firstPositionCitationEvents = 0;
      let topThreeCitationEvents = 0;
      for (const { observation } of items) {
        for (const citation of observation.citations) {
          if (!isOwnedDomain(citation.domain, ownedDomains)) continue;
          citationEvents += 1;
          if (citation.position === 1) firstPositionCitationEvents += 1;
          if (citation.position <= 3) topThreeCitationEvents += 1;
        }
      }
      return {
        citationEvents,
        firstPositionCitationEvents,
        firstPositionCitationSharePercent:
          citationEvents > 0
            ? Number(((firstPositionCitationEvents / citationEvents) * 100).toFixed(2))
            : null,
        topThreeCitationEvents,
        topThreeCitationSharePercent:
          citationEvents > 0
            ? Number(((topThreeCitationEvents / citationEvents) * 100).toFixed(2))
            : null,
      };
    };
    const associatedDomains = [
      ...new Set([
        ...mentionedCitationDomains.domains.keys(),
        ...notMentionedCitationDomains.domains.keys(),
      ]),
    ]
      .map((domain): AiAnswerCitationEntityMentionDomainAssociation => {
        const withMention = mentionedCitationDomains.domains.get(domain);
        const withoutMention = notMentionedCitationDomains.domains.get(domain);
        const mentionedShare =
          mentionedCitationDomains.citationEvents > 0
            ? Number(
                (
                  ((withMention?.citationEvents ?? 0) / mentionedCitationDomains.citationEvents) *
                  100
                ).toFixed(2)
              )
            : null;
        const notMentionedShare =
          notMentionedCitationDomains.citationEvents > 0
            ? Number(
                (
                  ((withoutMention?.citationEvents ?? 0) /
                    notMentionedCitationDomains.citationEvents) *
                  100
                ).toFixed(2)
              )
            : null;
        return {
          domain,
          citationEventsInMentionedAnswerSamples: mentionedCitationDomains.citationEvents,
          citationEventsWhenMentioned: withMention?.citationEvents ?? 0,
          observationsWithDomainWhenMentioned: withMention?.answers.size ?? 0,
          uniquePromptsWhenMentioned: withMention?.prompts.size ?? 0,
          citationEventShareWhenMentionedPercent: mentionedShare,
          citationEventsInNonMentionedAnswerSamples: notMentionedCitationDomains.citationEvents,
          citationEventsWhenNotMentioned: withoutMention?.citationEvents ?? 0,
          observationsWithDomainWhenNotMentioned: withoutMention?.answers.size ?? 0,
          uniquePromptsWhenNotMentioned: withoutMention?.prompts.size ?? 0,
          citationEventShareWhenNotMentionedPercent: notMentionedShare,
          citationEventShareChangePercentagePoints:
            mentionedShare === null || notMentionedShare === null
              ? null
              : Number((mentionedShare - notMentionedShare).toFixed(2)),
        };
      })
      .sort((left, right) => {
        const movement = (row: AiAnswerCitationEntityMentionDomainAssociation): number =>
          Math.abs(row.citationEventShareChangePercentagePoints ?? 0);
        return (
          movement(right) - movement(left) ||
          right.citationEventsWhenMentioned +
            right.citationEventsWhenNotMentioned -
            (left.citationEventsWhenMentioned + left.citationEventsWhenNotMentioned) ||
          left.domain.localeCompare(right.domain)
        );
      });
    const result: AiAnswerCitationEntityMentionSlice = {
      observationsWithAnswerText: answerSamples.length,
      observationsWithoutAnswerText: subset.length - answerSamples.length,
      observationsMentioningEntity: mentioned.length,
      entityMentionRatePercent:
        answerSamples.length > 0
          ? Number(((mentioned.length / answerSamples.length) * 100).toFixed(2))
          : null,
      entityMentionRateConfidenceInterval95Percent: confidenceInterval95(
        mentioned.length,
        answerSamples.length
      ),
      entityMentionOccurrences: mentioned.reduce((sum, { offsets }) => sum + offsets.length, 0),
      answersMentionedInFirstThird: firstThirdMentions,
      firstThirdMentionSharePercent:
        mentioned.length > 0
          ? Number(((firstThirdMentions / mentioned.length) * 100).toFixed(2))
          : null,
      firstThirdMentionShareConfidenceInterval95Percent: confidenceInterval95(
        firstThirdMentions,
        mentioned.length
      ),
      medianFirstMentionPositionPercent:
        firstMentionPositions.length > 0 ? Number(median(firstMentionPositions).toFixed(2)) : null,
      observationsMentioningWithAnyCitation: mentionedWithCitations,
      anyCitationCoverageWhenMentionedPercent:
        mentioned.length > 0
          ? Number(((mentionedWithCitations / mentioned.length) * 100).toFixed(2))
          : null,
      anyCitationCoverageWhenMentionedConfidenceInterval95Percent: confidenceInterval95(
        mentionedWithCitations,
        mentioned.length
      ),
      observationsWithoutEntityMention: notMentioned.length,
      observationsWithoutEntityMentionWithAnyCitation: notMentionedWithCitations,
      anyCitationCoverageWhenNotMentionedPercent:
        notMentioned.length > 0
          ? Number(((notMentionedWithCitations / notMentioned.length) * 100).toFixed(2))
          : null,
      anyCitationCoverageWhenNotMentionedConfidenceInterval95Percent: confidenceInterval95(
        notMentionedWithCitations,
        notMentioned.length
      ),
      citationDomainAssociations: associatedDomains.slice(
        0,
        MAX_ENTITY_CITATION_DOMAIN_ASSOCIATIONS
      ),
      citationDomainAssociationsTruncated:
        associatedDomains.length > MAX_ENTITY_CITATION_DOMAIN_ASSOCIATIONS,
    };
    if (ownedDomains.length > 0) {
      const mentionedWithOwned = mentioned.filter(({ observation }) =>
        observation.citations.some(({ domain }) => isOwnedDomain(domain, ownedDomains))
      ).length;
      const notMentionedWithOwned = notMentioned.filter(({ observation }) =>
        observation.citations.some(({ domain }) => isOwnedDomain(domain, ownedDomains))
      ).length;
      result.observationsMentioningWithOwnedCitation = mentionedWithOwned;
      result.ownedCitationCoverageWhenMentionedPercent =
        mentioned.length > 0
          ? Number(((mentionedWithOwned / mentioned.length) * 100).toFixed(2))
          : null;
      result.ownedCitationCoverageWhenMentionedConfidenceInterval95Percent = confidenceInterval95(
        mentionedWithOwned,
        mentioned.length
      );
      result.observationsWithoutEntityMentionWithOwnedCitation = notMentionedWithOwned;
      result.ownedCitationCoverageWhenNotMentionedPercent =
        notMentioned.length > 0
          ? Number(((notMentionedWithOwned / notMentioned.length) * 100).toFixed(2))
          : null;
      result.ownedCitationCoverageWhenNotMentionedConfidenceInterval95Percent =
        confidenceInterval95(notMentionedWithOwned, notMentioned.length);
      result.ownedCitationPositionWhenMentioned = summarizeOwnedCitationPositions(mentioned);
      result.ownedCitationPositionWhenNotMentioned = summarizeOwnedCitationPositions(notMentioned);
    }
    return result;
  };
  const entityMentionProfiles: AiAnswerCitationEntityMentionProfile[] = answerEntities.map(
    (definition) => {
      const providerProfiles = [...observationsByProvider.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([provider, providerObservations]) => ({
          provider,
          ...summarizeMentions(providerObservations, definition),
        }));
      return {
        entity: definition.entity,
        aliases: definition.aliases,
        ...summarizeMentions(observations, definition),
        providerProfiles,
      };
    }
  );
  const entityPromptBuckets = new Map<
    string,
    {
      entity: NormalizedAnswerEntity;
      prompt: string;
      provider: string;
      observations: number;
      observationsWithAnswerText: number;
      observationsMentioningEntity: number;
      observationsMentioningWithAnyCitation: number;
      observationsMentioningWithOwnedCitation: number;
      observationsWithoutEntityMention: number;
      observationsWithoutEntityMentionWithAnyCitation: number;
      observationsWithoutEntityMentionWithOwnedCitation: number;
      ownedCitationEventsWhenMentioned: number;
      ownedTopThreeCitationEventsWhenMentioned: number;
      firstObservedAt: string;
      lastObservedAt: string;
    }
  >();
  let entityPromptBucketsTruncated = false;
  if (answerEntities.length > 0) {
    for (const observation of observations) {
      for (const entity of answerEntities) {
        const key = JSON.stringify([
          entity.entity.normalize('NFKC').toLocaleLowerCase('en-US'),
          observation.providerKey,
          observation.promptKey,
        ]);
        let bucket = entityPromptBuckets.get(key);
        if (!bucket) {
          if (entityPromptBuckets.size >= MAX_ENTITY_PROMPT_PROFILE_WORKING_ROWS) {
            entityPromptBucketsTruncated = true;
            continue;
          }
          bucket = {
            entity,
            prompt: observation.prompt,
            provider: observation.provider,
            observations: 0,
            observationsWithAnswerText: 0,
            observationsMentioningEntity: 0,
            observationsMentioningWithAnyCitation: 0,
            observationsMentioningWithOwnedCitation: 0,
            observationsWithoutEntityMention: 0,
            observationsWithoutEntityMentionWithAnyCitation: 0,
            observationsWithoutEntityMentionWithOwnedCitation: 0,
            ownedCitationEventsWhenMentioned: 0,
            ownedTopThreeCitationEventsWhenMentioned: 0,
            firstObservedAt: observation.observedAt,
            lastObservedAt: observation.observedAt,
          };
          entityPromptBuckets.set(key, bucket);
        }
        bucket.observations += 1;
        if (observation.observedAt < bucket.firstObservedAt)
          bucket.firstObservedAt = observation.observedAt;
        if (observation.observedAt > bucket.lastObservedAt)
          bucket.lastObservedAt = observation.observedAt;
        if (observation.answerText === undefined) continue;
        bucket.observationsWithAnswerText += 1;
        const mentioned = findEntityMentionOffsets(observation.answerText, entity).length > 0;
        const hasAnyCitation = observation.citations.length > 0;
        const ownedCitations = observation.citations.filter(({ domain }) =>
          isOwnedDomain(domain, ownedDomains)
        );
        if (mentioned) {
          bucket.observationsMentioningEntity += 1;
          if (hasAnyCitation) bucket.observationsMentioningWithAnyCitation += 1;
          if (ownedCitations.length > 0) bucket.observationsMentioningWithOwnedCitation += 1;
          bucket.ownedCitationEventsWhenMentioned += ownedCitations.length;
          bucket.ownedTopThreeCitationEventsWhenMentioned += ownedCitations.filter(
            ({ position }) => position <= 3
          ).length;
        } else {
          bucket.observationsWithoutEntityMention += 1;
          if (hasAnyCitation) bucket.observationsWithoutEntityMentionWithAnyCitation += 1;
          if (ownedCitations.length > 0)
            bucket.observationsWithoutEntityMentionWithOwnedCitation += 1;
        }
      }
    }
  }
  const entityPromptProfiles: AiAnswerCitationEntityPromptProfile[] = [
    ...entityPromptBuckets.values(),
  ]
    .map((bucket) => ({
      entity: bucket.entity.entity,
      aliases: bucket.entity.aliases,
      prompt: bucket.prompt,
      provider: bucket.provider,
      observations: bucket.observations,
      observationsWithAnswerText: bucket.observationsWithAnswerText,
      observationsWithoutAnswerText: bucket.observations - bucket.observationsWithAnswerText,
      observationsMentioningEntity: bucket.observationsMentioningEntity,
      entityMentionRatePercent:
        bucket.observationsWithAnswerText > 0
          ? Number(
              (
                (bucket.observationsMentioningEntity / bucket.observationsWithAnswerText) *
                100
              ).toFixed(2)
            )
          : null,
      entityMentionRateConfidenceInterval95Percent: confidenceInterval95(
        bucket.observationsMentioningEntity,
        bucket.observationsWithAnswerText
      ),
      observationsMentioningWithAnyCitation: bucket.observationsMentioningWithAnyCitation,
      anyCitationCoverageWhenMentionedPercent:
        bucket.observationsMentioningEntity > 0
          ? Number(
              (
                (bucket.observationsMentioningWithAnyCitation /
                  bucket.observationsMentioningEntity) *
                100
              ).toFixed(2)
            )
          : null,
      anyCitationCoverageWhenMentionedConfidenceInterval95Percent: confidenceInterval95(
        bucket.observationsMentioningWithAnyCitation,
        bucket.observationsMentioningEntity
      ),
      observationsWithoutEntityMention: bucket.observationsWithoutEntityMention,
      observationsWithoutEntityMentionWithAnyCitation:
        bucket.observationsWithoutEntityMentionWithAnyCitation,
      anyCitationCoverageWhenNotMentionedPercent:
        bucket.observationsWithoutEntityMention > 0
          ? Number(
              (
                (bucket.observationsWithoutEntityMentionWithAnyCitation /
                  bucket.observationsWithoutEntityMention) *
                100
              ).toFixed(2)
            )
          : null,
      anyCitationCoverageWhenNotMentionedConfidenceInterval95Percent: confidenceInterval95(
        bucket.observationsWithoutEntityMentionWithAnyCitation,
        bucket.observationsWithoutEntityMention
      ),
      ...(ownedDomains.length > 0
        ? {
            observationsMentioningWithOwnedCitation: bucket.observationsMentioningWithOwnedCitation,
            ownedCitationCoverageWhenMentionedPercent:
              bucket.observationsMentioningEntity > 0
                ? Number(
                    (
                      (bucket.observationsMentioningWithOwnedCitation /
                        bucket.observationsMentioningEntity) *
                      100
                    ).toFixed(2)
                  )
                : null,
            ownedCitationCoverageWhenMentionedConfidenceInterval95Percent: confidenceInterval95(
              bucket.observationsMentioningWithOwnedCitation,
              bucket.observationsMentioningEntity
            ),
            ownedCitationEventsWhenMentioned: bucket.ownedCitationEventsWhenMentioned,
            ownedTopThreeCitationEventsWhenMentioned:
              bucket.ownedTopThreeCitationEventsWhenMentioned,
            ownedTopThreeCitationShareWhenMentionedPercent:
              bucket.ownedCitationEventsWhenMentioned > 0
                ? Number(
                    (
                      (bucket.ownedTopThreeCitationEventsWhenMentioned /
                        bucket.ownedCitationEventsWhenMentioned) *
                      100
                    ).toFixed(2)
                  )
                : null,
            observationsWithoutEntityMentionWithOwnedCitation:
              bucket.observationsWithoutEntityMentionWithOwnedCitation,
            ownedCitationCoverageWhenNotMentionedPercent:
              bucket.observationsWithoutEntityMention > 0
                ? Number(
                    (
                      (bucket.observationsWithoutEntityMentionWithOwnedCitation /
                        bucket.observationsWithoutEntityMention) *
                      100
                    ).toFixed(2)
                  )
                : null,
            ownedCitationCoverageWhenNotMentionedConfidenceInterval95Percent: confidenceInterval95(
              bucket.observationsWithoutEntityMentionWithOwnedCitation,
              bucket.observationsWithoutEntityMention
            ),
          }
        : {}),
      firstObservedAt: bucket.firstObservedAt,
      lastObservedAt: bucket.lastObservedAt,
    }))
    .sort(
      (left, right) =>
        right.observationsWithAnswerText - left.observationsWithAnswerText ||
        left.entity.localeCompare(right.entity) ||
        left.provider.localeCompare(right.provider) ||
        left.prompt.localeCompare(right.prompt)
    );
  const retainedEntityPromptProfiles = entityPromptProfiles.slice(
    0,
    MAX_RETURNED_ENTITY_PROMPT_PROFILES
  );
  const entityPromptProfilesTruncated =
    entityPromptBucketsTruncated ||
    entityPromptProfiles.length > MAX_RETURNED_ENTITY_PROMPT_PROFILES;
  type EntityPromptProviderPairBucket = {
    entity: string;
    aliases: string[];
    providerA: string;
    providerB: string;
    sharedPromptGroups: number;
    comparablePromptGroups: number;
    promptGroupsMissingAnswerTextOnEitherSide: number;
    providerAFirstObservedAt: string | null;
    providerALastObservedAt: string | null;
    providerBFirstObservedAt: string | null;
    providerBLastObservedAt: string | null;
    providerAObservationsWithAnswerText: number;
    providerBObservationsWithAnswerText: number;
    providerAObservationsMentioningEntity: number;
    providerBObservationsMentioningEntity: number;
    providerAEqualPromptMentionRateTotal: number;
    providerBEqualPromptMentionRateTotal: number;
    mentionDeltas: number[];
    promptsWithProviderAHigherMentionRate: number;
    promptsWithProviderBHigherMentionRate: number;
    promptsWithEqualMentionRate: number;
    promptsWithEntityMentionOnBothSides: number;
    providerAMentionedWithAnyCitation: number;
    providerAMentionedObservations: number;
    providerBMentionedWithAnyCitation: number;
    providerBMentionedObservations: number;
    anyCitationCoverageDeltas: number[];
    promptsWithComparableAnyCitationCoverageWhenMentioned: number;
    providerAMentionedWithOwnedCitation: number;
    providerAOwnedMentionedObservations: number;
    providerBMentionedWithOwnedCitation: number;
    providerBOwnedMentionedObservations: number;
    ownedCoverageDeltas: number[];
    promptsWithComparableOwnedCitationCoverageWhenMentioned: number;
    providerAOwnedCitationEvents: number;
    providerAOwnedTopThreeCitationEvents: number;
    providerBOwnedCitationEvents: number;
    providerBOwnedTopThreeCitationEvents: number;
    promptsWithOwnedCitationEventsWhenMentionedOnBothSides: number;
  };
  const entityPromptProviderPairBuckets = new Map<string, EntityPromptProviderPairBucket>();
  let entityPromptProviderPairComparisonsTruncated = entityPromptProfilesTruncated;
  let processedPromptProviderPairs = 0;
  const entityPromptProviderGroups = new Map<string, AiAnswerCitationEntityPromptProfile[]>();
  for (const profile of retainedEntityPromptProfiles) {
    const groupKey = JSON.stringify([
      profile.entity.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US'),
      profile.prompt.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US'),
    ]);
    const group = entityPromptProviderGroups.get(groupKey) ?? [];
    group.push(profile);
    entityPromptProviderGroups.set(groupKey, group);
  }
  pairGroups: for (const group of entityPromptProviderGroups.values()) {
    const ordered = group
      .slice()
      .sort((left, right) => left.provider.localeCompare(right.provider));
    for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
        if (processedPromptProviderPairs >= MAX_ENTITY_PROMPT_PROVIDER_PAIR_WORKING_COMPARISONS) {
          entityPromptProviderPairComparisonsTruncated = true;
          break pairGroups;
        }
        const providerA = ordered[leftIndex]!;
        const providerB = ordered[rightIndex]!;
        const entityKey = providerA.entity
          .normalize('NFKC')
          .replace(/\s+/gu, ' ')
          .trim()
          .toLocaleLowerCase('en-US');
        const pairKey = JSON.stringify([
          entityKey,
          providerA.provider.toLocaleLowerCase('en-US'),
          providerB.provider.toLocaleLowerCase('en-US'),
        ]);
        let bucket = entityPromptProviderPairBuckets.get(pairKey);
        if (!bucket) {
          if (
            entityPromptProviderPairBuckets.size >= MAX_ENTITY_PROMPT_PROVIDER_PAIR_WORKING_ROWS
          ) {
            entityPromptProviderPairComparisonsTruncated = true;
            processedPromptProviderPairs += 1;
            continue;
          }
          bucket = {
            entity: providerA.entity,
            aliases: providerA.aliases,
            providerA: providerA.provider,
            providerB: providerB.provider,
            sharedPromptGroups: 0,
            comparablePromptGroups: 0,
            promptGroupsMissingAnswerTextOnEitherSide: 0,
            providerAFirstObservedAt: null,
            providerALastObservedAt: null,
            providerBFirstObservedAt: null,
            providerBLastObservedAt: null,
            providerAObservationsWithAnswerText: 0,
            providerBObservationsWithAnswerText: 0,
            providerAObservationsMentioningEntity: 0,
            providerBObservationsMentioningEntity: 0,
            providerAEqualPromptMentionRateTotal: 0,
            providerBEqualPromptMentionRateTotal: 0,
            mentionDeltas: [],
            promptsWithProviderAHigherMentionRate: 0,
            promptsWithProviderBHigherMentionRate: 0,
            promptsWithEqualMentionRate: 0,
            promptsWithEntityMentionOnBothSides: 0,
            providerAMentionedWithAnyCitation: 0,
            providerAMentionedObservations: 0,
            providerBMentionedWithAnyCitation: 0,
            providerBMentionedObservations: 0,
            anyCitationCoverageDeltas: [],
            promptsWithComparableAnyCitationCoverageWhenMentioned: 0,
            providerAMentionedWithOwnedCitation: 0,
            providerAOwnedMentionedObservations: 0,
            providerBMentionedWithOwnedCitation: 0,
            providerBOwnedMentionedObservations: 0,
            ownedCoverageDeltas: [],
            promptsWithComparableOwnedCitationCoverageWhenMentioned: 0,
            providerAOwnedCitationEvents: 0,
            providerAOwnedTopThreeCitationEvents: 0,
            providerBOwnedCitationEvents: 0,
            providerBOwnedTopThreeCitationEvents: 0,
            promptsWithOwnedCitationEventsWhenMentionedOnBothSides: 0,
          };
          entityPromptProviderPairBuckets.set(pairKey, bucket);
        }
        bucket.sharedPromptGroups += 1;
        const hasAnswerTextOnBothSides =
          providerA.observationsWithAnswerText > 0 && providerB.observationsWithAnswerText > 0;
        if (!hasAnswerTextOnBothSides) {
          bucket.promptGroupsMissingAnswerTextOnEitherSide += 1;
          processedPromptProviderPairs += 1;
          continue;
        }
        bucket.comparablePromptGroups += 1;
        bucket.providerAFirstObservedAt =
          bucket.providerAFirstObservedAt === null ||
          providerA.firstObservedAt < bucket.providerAFirstObservedAt
            ? providerA.firstObservedAt
            : bucket.providerAFirstObservedAt;
        bucket.providerALastObservedAt =
          bucket.providerALastObservedAt === null ||
          providerA.lastObservedAt > bucket.providerALastObservedAt
            ? providerA.lastObservedAt
            : bucket.providerALastObservedAt;
        bucket.providerBFirstObservedAt =
          bucket.providerBFirstObservedAt === null ||
          providerB.firstObservedAt < bucket.providerBFirstObservedAt
            ? providerB.firstObservedAt
            : bucket.providerBFirstObservedAt;
        bucket.providerBLastObservedAt =
          bucket.providerBLastObservedAt === null ||
          providerB.lastObservedAt > bucket.providerBLastObservedAt
            ? providerB.lastObservedAt
            : bucket.providerBLastObservedAt;
        bucket.providerAObservationsWithAnswerText += providerA.observationsWithAnswerText;
        bucket.providerBObservationsWithAnswerText += providerB.observationsWithAnswerText;
        bucket.providerAObservationsMentioningEntity += providerA.observationsMentioningEntity;
        bucket.providerBObservationsMentioningEntity += providerB.observationsMentioningEntity;
        const mentionRateA =
          (providerA.observationsMentioningEntity / providerA.observationsWithAnswerText) * 100;
        const mentionRateB =
          (providerB.observationsMentioningEntity / providerB.observationsWithAnswerText) * 100;
        bucket.providerAEqualPromptMentionRateTotal += mentionRateA;
        bucket.providerBEqualPromptMentionRateTotal += mentionRateB;
        const mentionDelta = mentionRateB - mentionRateA;
        bucket.mentionDeltas.push(mentionDelta);
        if (mentionDelta > 0) bucket.promptsWithProviderBHigherMentionRate += 1;
        else if (mentionDelta < 0) bucket.promptsWithProviderAHigherMentionRate += 1;
        else bucket.promptsWithEqualMentionRate += 1;
        const mentionedA = providerA.observationsMentioningEntity;
        const mentionedB = providerB.observationsMentioningEntity;
        if (mentionedA > 0 && mentionedB > 0) {
          bucket.promptsWithEntityMentionOnBothSides += 1;
          bucket.providerAMentionedObservations += mentionedA;
          bucket.providerAMentionedWithAnyCitation +=
            providerA.observationsMentioningWithAnyCitation;
          bucket.providerBMentionedObservations += mentionedB;
          bucket.providerBMentionedWithAnyCitation +=
            providerB.observationsMentioningWithAnyCitation;
          const anyCoverageA = (providerA.observationsMentioningWithAnyCitation / mentionedA) * 100;
          const anyCoverageB = (providerB.observationsMentioningWithAnyCitation / mentionedB) * 100;
          bucket.anyCitationCoverageDeltas.push(anyCoverageB - anyCoverageA);
          bucket.promptsWithComparableAnyCitationCoverageWhenMentioned += 1;
          if (ownedDomains.length > 0) {
            const ownedMentionsA = providerA.observationsMentioningWithOwnedCitation ?? 0;
            const ownedMentionsB = providerB.observationsMentioningWithOwnedCitation ?? 0;
            bucket.providerAOwnedMentionedObservations += mentionedA;
            bucket.providerBMentionedWithOwnedCitation += ownedMentionsB;
            bucket.providerBOwnedMentionedObservations += mentionedB;
            bucket.providerAMentionedWithOwnedCitation += ownedMentionsA;
            if (ownedMentionsA > 0 && ownedMentionsB > 0) {
              bucket.ownedCoverageDeltas.push(
                (ownedMentionsB / mentionedB) * 100 - (ownedMentionsA / mentionedA) * 100
              );
              bucket.promptsWithComparableOwnedCitationCoverageWhenMentioned += 1;
            }
            const ownedEventsA = providerA.ownedCitationEventsWhenMentioned ?? 0;
            const ownedEventsB = providerB.ownedCitationEventsWhenMentioned ?? 0;
            bucket.providerAOwnedCitationEvents += ownedEventsA;
            bucket.providerAOwnedTopThreeCitationEvents +=
              providerA.ownedTopThreeCitationEventsWhenMentioned ?? 0;
            bucket.providerBOwnedCitationEvents += ownedEventsB;
            bucket.providerBOwnedTopThreeCitationEvents +=
              providerB.ownedTopThreeCitationEventsWhenMentioned ?? 0;
            if (ownedEventsA > 0 && ownedEventsB > 0)
              bucket.promptsWithOwnedCitationEventsWhenMentionedOnBothSides += 1;
          }
        }
        processedPromptProviderPairs += 1;
      }
    }
  }
  const medianOrNull = (values: number[]): number | null =>
    values.length > 0 ? Number(median(values).toFixed(2)) : null;
  const entityPromptProviderPairComparisons = [...entityPromptProviderPairBuckets.values()]
    .map((bucket): AiAnswerCitationEntityPromptProviderPairProfile => {
      const providerAMentionRatePercent =
        bucket.providerAObservationsWithAnswerText > 0
          ? Number(
              (
                (bucket.providerAObservationsMentioningEntity /
                  bucket.providerAObservationsWithAnswerText) *
                100
              ).toFixed(2)
            )
          : null;
      const providerBMentionRatePercent =
        bucket.providerBObservationsWithAnswerText > 0
          ? Number(
              (
                (bucket.providerBObservationsMentioningEntity /
                  bucket.providerBObservationsWithAnswerText) *
                100
              ).toFixed(2)
            )
          : null;
      const providerAAnyCitationCoverage =
        bucket.providerAMentionedObservations > 0
          ? Number(
              (
                (bucket.providerAMentionedWithAnyCitation / bucket.providerAMentionedObservations) *
                100
              ).toFixed(2)
            )
          : null;
      const providerBAnyCitationCoverage =
        bucket.providerBMentionedObservations > 0
          ? Number(
              (
                (bucket.providerBMentionedWithAnyCitation / bucket.providerBMentionedObservations) *
                100
              ).toFixed(2)
            )
          : null;
      return {
        entity: bucket.entity,
        aliases: bucket.aliases,
        providerA: bucket.providerA,
        providerB: bucket.providerB,
        sharedPromptGroups: bucket.sharedPromptGroups,
        comparablePromptGroups: bucket.comparablePromptGroups,
        promptGroupsMissingAnswerTextOnEitherSide: bucket.promptGroupsMissingAnswerTextOnEitherSide,
        providerAFirstObservedAt: bucket.providerAFirstObservedAt,
        providerALastObservedAt: bucket.providerALastObservedAt,
        providerBFirstObservedAt: bucket.providerBFirstObservedAt,
        providerBLastObservedAt: bucket.providerBLastObservedAt,
        providerAObservationsWithAnswerText: bucket.providerAObservationsWithAnswerText,
        providerBObservationsWithAnswerText: bucket.providerBObservationsWithAnswerText,
        providerAObservationsMentioningEntity: bucket.providerAObservationsMentioningEntity,
        providerBObservationsMentioningEntity: bucket.providerBObservationsMentioningEntity,
        providerAMentionRatePercent,
        providerAEqualPromptMeanMentionRatePercent:
          bucket.comparablePromptGroups > 0
            ? Number(
                (
                  bucket.providerAEqualPromptMentionRateTotal / bucket.comparablePromptGroups
                ).toFixed(2)
              )
            : null,
        providerAMentionRateConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          bucket.providerAObservationsMentioningEntity,
          bucket.providerAObservationsWithAnswerText
        ),
        providerBMentionRatePercent,
        providerBEqualPromptMeanMentionRatePercent:
          bucket.comparablePromptGroups > 0
            ? Number(
                (
                  bucket.providerBEqualPromptMentionRateTotal / bucket.comparablePromptGroups
                ).toFixed(2)
              )
            : null,
        providerBMentionRateConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
          bucket.providerBObservationsMentioningEntity,
          bucket.providerBObservationsWithAnswerText
        ),
        providerBMentionRateDeltaPercentagePoints:
          providerAMentionRatePercent === null || providerBMentionRatePercent === null
            ? null
            : Number((providerBMentionRatePercent - providerAMentionRatePercent).toFixed(2)),
        providerBMentionRateDifferenceConfidenceInterval95PercentagePoints:
          newcombeRateDifferenceConfidenceInterval95(
            bucket.providerAObservationsMentioningEntity,
            bucket.providerAObservationsWithAnswerText,
            bucket.providerBObservationsMentioningEntity,
            bucket.providerBObservationsWithAnswerText
          ),
        meanPromptMentionRateDeltaPercentagePoints:
          bucket.mentionDeltas.length > 0
            ? Number(
                (
                  bucket.mentionDeltas.reduce((sum, value) => sum + value, 0) /
                  bucket.mentionDeltas.length
                ).toFixed(2)
              )
            : null,
        meanPromptMentionRateDeltaBootstrapConfidenceInterval95PercentagePoints:
          bootstrapMeanDifferenceConfidenceInterval95(
            bucket.mentionDeltas,
            `${bucket.entity}\u0000${bucket.providerA}\u0000${bucket.providerB}`
          ),
        medianPromptMentionRateDeltaPercentagePoints: medianOrNull(bucket.mentionDeltas),
        promptsWithProviderAHigherMentionRate: bucket.promptsWithProviderAHigherMentionRate,
        promptsWithProviderBHigherMentionRate: bucket.promptsWithProviderBHigherMentionRate,
        promptsWithEqualMentionRate: bucket.promptsWithEqualMentionRate,
        promptsWithEntityMentionOnBothSides: bucket.promptsWithEntityMentionOnBothSides,
        providerAAnyCitationCoverageWhenMentionedPercent: providerAAnyCitationCoverage,
        providerAAnyCitationCoverageWhenMentionedConfidenceInterval95Percent: confidenceInterval95(
          bucket.providerAMentionedWithAnyCitation,
          bucket.providerAMentionedObservations
        ),
        providerBAnyCitationCoverageWhenMentionedPercent: providerBAnyCitationCoverage,
        providerBAnyCitationCoverageWhenMentionedConfidenceInterval95Percent: confidenceInterval95(
          bucket.providerBMentionedWithAnyCitation,
          bucket.providerBMentionedObservations
        ),
        providerBAnyCitationCoverageWhenMentionedDeltaPercentagePoints:
          providerAAnyCitationCoverage === null || providerBAnyCitationCoverage === null
            ? null
            : Number((providerBAnyCitationCoverage - providerAAnyCitationCoverage).toFixed(2)),
        promptsWithComparableAnyCitationCoverageWhenMentioned:
          bucket.promptsWithComparableAnyCitationCoverageWhenMentioned,
        meanPromptAnyCitationCoverageWhenMentionedDeltaPercentagePoints:
          medianOrNull(bucket.anyCitationCoverageDeltas) === null
            ? null
            : Number(
                (
                  bucket.anyCitationCoverageDeltas.reduce((sum, value) => sum + value, 0) /
                  bucket.anyCitationCoverageDeltas.length
                ).toFixed(2)
              ),
        meanPromptAnyCitationCoverageWhenMentionedDeltaBootstrapConfidenceInterval95PercentagePoints:
          bootstrapMeanDifferenceConfidenceInterval95(
            bucket.anyCitationCoverageDeltas,
            `${bucket.entity}\u0000${bucket.providerA}\u0000${bucket.providerB}\u0000any-citation-coverage`
          ),
        medianPromptAnyCitationCoverageWhenMentionedDeltaPercentagePoints: medianOrNull(
          bucket.anyCitationCoverageDeltas
        ),
        ...(ownedDomains.length > 0
          ? {
              ownedDomainsConfigured: true,
              providerAOwnedCitationCoverageWhenMentionedPercent:
                bucket.providerAOwnedMentionedObservations > 0
                  ? Number(
                      (
                        (bucket.providerAMentionedWithOwnedCitation /
                          bucket.providerAOwnedMentionedObservations) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              providerAOwnedCitationCoverageWhenMentionedConfidenceInterval95Percent:
                confidenceInterval95(
                  bucket.providerAMentionedWithOwnedCitation,
                  bucket.providerAOwnedMentionedObservations
                ),
              providerBOwnedCitationCoverageWhenMentionedPercent:
                bucket.providerBOwnedMentionedObservations > 0
                  ? Number(
                      (
                        (bucket.providerBMentionedWithOwnedCitation /
                          bucket.providerBOwnedMentionedObservations) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              providerBOwnedCitationCoverageWhenMentionedConfidenceInterval95Percent:
                confidenceInterval95(
                  bucket.providerBMentionedWithOwnedCitation,
                  bucket.providerBOwnedMentionedObservations
                ),
              providerBOwnedCitationCoverageWhenMentionedDeltaPercentagePoints:
                bucket.providerAOwnedMentionedObservations > 0 &&
                bucket.providerBOwnedMentionedObservations > 0
                  ? Number(
                      (
                        (bucket.providerBMentionedWithOwnedCitation /
                          bucket.providerBOwnedMentionedObservations -
                          bucket.providerAMentionedWithOwnedCitation /
                            bucket.providerAOwnedMentionedObservations) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              promptsWithComparableOwnedCitationCoverageWhenMentioned:
                bucket.promptsWithComparableOwnedCitationCoverageWhenMentioned,
              meanPromptOwnedCitationCoverageWhenMentionedDeltaPercentagePoints:
                bucket.ownedCoverageDeltas.length > 0
                  ? Number(
                      (
                        bucket.ownedCoverageDeltas.reduce((sum, value) => sum + value, 0) /
                        bucket.ownedCoverageDeltas.length
                      ).toFixed(2)
                    )
                  : null,
              meanPromptOwnedCitationCoverageWhenMentionedDeltaBootstrapConfidenceInterval95PercentagePoints:
                bootstrapMeanDifferenceConfidenceInterval95(
                  bucket.ownedCoverageDeltas,
                  `${bucket.entity}\u0000${bucket.providerA}\u0000${bucket.providerB}\u0000owned-citation-coverage`
                ),
              medianPromptOwnedCitationCoverageWhenMentionedDeltaPercentagePoints: medianOrNull(
                bucket.ownedCoverageDeltas
              ),
              providerAOwnedTopThreeCitationShareWhenMentionedPercent:
                bucket.providerAOwnedCitationEvents > 0
                  ? Number(
                      (
                        (bucket.providerAOwnedTopThreeCitationEvents /
                          bucket.providerAOwnedCitationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              providerBOwnedTopThreeCitationShareWhenMentionedPercent:
                bucket.providerBOwnedCitationEvents > 0
                  ? Number(
                      (
                        (bucket.providerBOwnedTopThreeCitationEvents /
                          bucket.providerBOwnedCitationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              providerBOwnedTopThreeCitationShareWhenMentionedDeltaPercentagePoints:
                bucket.providerAOwnedCitationEvents > 0 && bucket.providerBOwnedCitationEvents > 0
                  ? Number(
                      (
                        (bucket.providerBOwnedTopThreeCitationEvents /
                          bucket.providerBOwnedCitationEvents -
                          bucket.providerAOwnedTopThreeCitationEvents /
                            bucket.providerAOwnedCitationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              promptsWithOwnedCitationEventsWhenMentionedOnBothSides:
                bucket.promptsWithOwnedCitationEventsWhenMentionedOnBothSides,
            }
          : {}),
      };
    })
    .sort(
      (left, right) =>
        right.comparablePromptGroups - left.comparablePromptGroups ||
        right.sharedPromptGroups - left.sharedPromptGroups ||
        Math.abs(right.providerBMentionRateDeltaPercentagePoints ?? 0) -
          Math.abs(left.providerBMentionRateDeltaPercentagePoints ?? 0) ||
        left.entity.localeCompare(right.entity) ||
        left.providerA.localeCompare(right.providerA) ||
        left.providerB.localeCompare(right.providerB)
    );
  if (entityPromptProviderPairComparisons.length > MAX_RETURNED_ENTITY_PROMPT_PROVIDER_PAIRS)
    entityPromptProviderPairComparisonsTruncated = true;
  type EntityCitationPageDenominator = {
    observations: number;
    prompts: Set<string>;
    citationEvents: number;
  };
  type EntityCitationPageSideBucket = {
    answers: Set<number>;
    prompts: Set<string>;
    citationEvents: number;
    positions: number[];
  };
  type EntityCitationPageCohort = {
    entity: NormalizedAnswerEntity;
    provider: string;
    month?: string;
    topic?: string;
    intent?: string;
    unlabeled: boolean;
    observationsWithoutAnswerText: number;
    whenMentioned: EntityCitationPageDenominator;
    whenNotMentioned: EntityCitationPageDenominator;
  };
  type EntityCitationPageBucket = {
    cohortKey: string;
    url: string;
    domain: string;
    owned: boolean;
    whenMentioned: EntityCitationPageSideBucket;
    whenNotMentioned: EntityCitationPageSideBucket;
  };
  type EntityCitationPageCollection = {
    cohorts: Map<string, EntityCitationPageCohort>;
    buckets: Map<string, EntityCitationPageBucket>;
    truncated: boolean;
  };
  const createEntityCitationPageDenominator = (): EntityCitationPageDenominator => ({
    observations: 0,
    prompts: new Set<string>(),
    citationEvents: 0,
  });
  const createEntityCitationPageSideBucket = (): EntityCitationPageSideBucket => ({
    answers: new Set<number>(),
    prompts: new Set<string>(),
    citationEvents: 0,
    positions: [],
  });
  const createEntityCitationPageCollection = (): EntityCitationPageCollection => ({
    cohorts: new Map(),
    buckets: new Map(),
    truncated: false,
  });
  const entityCitationPageCollection = createEntityCitationPageCollection();
  const entityCitationPageMonthlyCollection = createEntityCitationPageCollection();
  const collectEntityCitationPageObservation = (
    observation: NormalizedObservation,
    observationIndex: number,
    definition: NormalizedAnswerEntity,
    month: string | undefined,
    collection: EntityCitationPageCollection,
    maxCohorts: number,
    maxPages: number
  ): void => {
    const hasTopicIntentLabel =
      observation.topicKey !== undefined || observation.intentKey !== undefined;
    const topicIntentKey = `${observation.topicKey ?? ''}\u0000${observation.intentKey ?? ''}`;
    const cohortKey = JSON.stringify([
      definition.entity,
      month ?? null,
      observation.providerKey,
      hasTopicIntentLabel ? topicIntentKey : null,
    ]);
    let cohort = collection.cohorts.get(cohortKey);
    if (!cohort) {
      if (collection.cohorts.size >= maxCohorts) {
        collection.truncated = true;
        return;
      }
      cohort = {
        entity: definition,
        provider: observation.provider,
        ...(month ? { month } : {}),
        ...(observation.topic ? { topic: observation.topic } : {}),
        ...(observation.intent ? { intent: observation.intent } : {}),
        unlabeled: !hasTopicIntentLabel,
        observationsWithoutAnswerText: 0,
        whenMentioned: createEntityCitationPageDenominator(),
        whenNotMentioned: createEntityCitationPageDenominator(),
      };
      collection.cohorts.set(cohortKey, cohort);
    }
    if (observation.answerText === undefined) {
      cohort.observationsWithoutAnswerText += 1;
      return;
    }
    const mentioned = findEntityMentionOffsets(observation.answerText, definition).length > 0;
    const stateName = mentioned ? 'whenMentioned' : 'whenNotMentioned';
    const denominator = cohort[stateName];
    denominator.observations += 1;
    denominator.prompts.add(observation.promptKey);
    denominator.citationEvents += observation.citations.length;
    for (const citation of observation.citations) {
      const pageKey = JSON.stringify([cohortKey, citation.url]);
      let bucket = collection.buckets.get(pageKey);
      if (!bucket) {
        if (collection.buckets.size >= maxPages) {
          collection.truncated = true;
          continue;
        }
        bucket = {
          cohortKey,
          url: citation.url,
          domain: citation.domain,
          owned: ownedDomains.length > 0 && isOwnedDomain(citation.domain, ownedDomains),
          whenMentioned: createEntityCitationPageSideBucket(),
          whenNotMentioned: createEntityCitationPageSideBucket(),
        };
        collection.buckets.set(pageKey, bucket);
      }
      const side = bucket[stateName];
      side.answers.add(observationIndex);
      side.prompts.add(observation.promptKey);
      side.citationEvents += 1;
      side.positions.push(citation.position);
    }
  };
  if (answerEntities.length > 0) {
    observations.forEach((observation, observationIndex) => {
      const month = observation.observedAt.slice(0, 7);
      for (const definition of answerEntities) {
        collectEntityCitationPageObservation(
          observation,
          observationIndex,
          definition,
          undefined,
          entityCitationPageCollection,
          MAX_ENTITY_CITATION_PAGE_COHORT_WORKING_ROWS,
          MAX_ENTITY_CITATION_PAGE_WORKING_ROWS
        );
        collectEntityCitationPageObservation(
          observation,
          observationIndex,
          definition,
          month,
          entityCitationPageMonthlyCollection,
          MAX_ENTITY_CITATION_PAGE_MONTHLY_COHORT_WORKING_ROWS,
          MAX_ENTITY_CITATION_PAGE_MONTHLY_WORKING_ROWS
        );
      }
    });
  }
  type EntityPathFamilyDenominator = {
    observations: number;
    prompts: Set<string>;
    citationEvents: number;
  };
  type EntityPathFamilyCohort = {
    entity: NormalizedAnswerEntity;
    provider: string;
    providerKey: string;
    month?: string;
    topic?: string;
    intent?: string;
    unlabeled: boolean;
    observationsWithoutAnswerText: number;
    whenMentioned: EntityPathFamilyDenominator;
    whenNotMentioned: EntityPathFamilyDenominator;
  };
  type EntityPathFamilySideBucket = {
    answers: Set<number>;
    prompts: Set<string>;
    citationEvents: number;
    urls: Set<string>;
    positions: number[];
    firstObservedAt?: string;
    lastObservedAt?: string;
  };
  type EntityPathFamilyBucket = {
    cohortKey: string;
    month?: string;
    pathFamily: string;
    origin: string;
    pathPrefix: string;
    owned: boolean;
    whenMentioned: EntityPathFamilySideBucket;
    whenNotMentioned: EntityPathFamilySideBucket;
  };
  type EntityPathFamilyCitation = {
    pathFamily: string;
    origin: string;
    pathPrefix: string;
    url: string;
    position: number;
    domain: string;
  };
  type EntityPathFamilyCollection = {
    cohorts: Map<string, EntityPathFamilyCohort>;
    buckets: Map<string, EntityPathFamilyBucket>;
    truncated: boolean;
  };
  const createEntityPathFamilyDenominator = (): EntityPathFamilyDenominator => ({
    observations: 0,
    prompts: new Set<string>(),
    citationEvents: 0,
  });
  const createEntityPathFamilySideBucket = (): EntityPathFamilySideBucket => ({
    answers: new Set<number>(),
    prompts: new Set<string>(),
    citationEvents: 0,
    urls: new Set<string>(),
    positions: [],
  });
  const createEntityPathFamilyCollection = (): EntityPathFamilyCollection => ({
    cohorts: new Map(),
    buckets: new Map(),
    truncated: false,
  });
  const entityPathFamilyCollection = createEntityPathFamilyCollection();
  const entityPathFamilyMonthlyCollection = createEntityPathFamilyCollection();
  const collectEntityPathFamilyObservation = (
    observation: NormalizedObservation,
    observationIndex: number,
    definition: NormalizedAnswerEntity,
    citationFamilies: EntityPathFamilyCitation[],
    month: string | undefined,
    collection: EntityPathFamilyCollection,
    maxCohorts: number,
    maxBuckets: number
  ): void => {
    const hasTopicIntentLabel =
      observation.topicKey !== undefined || observation.intentKey !== undefined;
    const topicIntentKey = `${observation.topicKey ?? ''}\u0000${observation.intentKey ?? ''}`;
    const cohortKey = JSON.stringify([
      definition.entity,
      month ?? null,
      observation.providerKey,
      hasTopicIntentLabel ? topicIntentKey : null,
    ]);
    let cohort = collection.cohorts.get(cohortKey);
    if (!cohort) {
      if (collection.cohorts.size >= maxCohorts) {
        collection.truncated = true;
        return;
      }
      cohort = {
        entity: definition,
        provider: observation.provider,
        providerKey: observation.providerKey,
        ...(month ? { month } : {}),
        ...(observation.topic ? { topic: observation.topic } : {}),
        ...(observation.intent ? { intent: observation.intent } : {}),
        unlabeled: !hasTopicIntentLabel,
        observationsWithoutAnswerText: 0,
        whenMentioned: createEntityPathFamilyDenominator(),
        whenNotMentioned: createEntityPathFamilyDenominator(),
      };
      collection.cohorts.set(cohortKey, cohort);
    }
    if (observation.answerText === undefined) {
      cohort.observationsWithoutAnswerText += 1;
      return;
    }
    const mentioned = findEntityMentionOffsets(observation.answerText, definition).length > 0;
    const denominator = mentioned ? cohort.whenMentioned : cohort.whenNotMentioned;
    denominator.observations += 1;
    denominator.prompts.add(observation.promptKey);
    denominator.citationEvents += observation.citations.length;
    const stateName = mentioned ? 'whenMentioned' : 'whenNotMentioned';
    for (const citation of citationFamilies) {
      const profileKey = JSON.stringify([cohortKey, citation.pathFamily]);
      let bucket = collection.buckets.get(profileKey);
      if (!bucket) {
        if (collection.buckets.size >= maxBuckets) {
          collection.truncated = true;
          continue;
        }
        bucket = {
          cohortKey,
          ...(month ? { month } : {}),
          pathFamily: citation.pathFamily,
          origin: citation.origin,
          pathPrefix: citation.pathPrefix,
          owned: ownedDomains.length > 0 && isOwnedDomain(citation.domain, ownedDomains),
          whenMentioned: createEntityPathFamilySideBucket(),
          whenNotMentioned: createEntityPathFamilySideBucket(),
        };
        collection.buckets.set(profileKey, bucket);
      }
      const side = bucket[stateName];
      side.answers.add(observationIndex);
      side.prompts.add(observation.promptKey);
      side.citationEvents += 1;
      side.urls.add(citation.url);
      side.positions.push(citation.position);
      side.firstObservedAt =
        side.firstObservedAt === undefined || observation.observedAt < side.firstObservedAt
          ? observation.observedAt
          : side.firstObservedAt;
      side.lastObservedAt =
        side.lastObservedAt === undefined || observation.observedAt > side.lastObservedAt
          ? observation.observedAt
          : side.lastObservedAt;
    }
  };
  if (pathFamilyDepth !== undefined && answerEntities.length > 0) {
    observations.forEach((observation, observationIndex) => {
      const citationFamilies = observation.citations.flatMap(
        (citation): EntityPathFamilyCitation[] => {
          const family = pathFamilyForCitationUrl(citation.url, pathFamilyDepth);
          return family
            ? [
                {
                  ...family,
                  url: citation.url,
                  position: citation.position,
                  domain: citation.domain,
                },
              ]
            : [];
        }
      );
      const month = observation.observedAt.slice(0, 7);
      for (const definition of answerEntities) {
        collectEntityPathFamilyObservation(
          observation,
          observationIndex,
          definition,
          citationFamilies,
          undefined,
          entityPathFamilyCollection,
          MAX_ENTITY_PATH_FAMILY_COHORT_WORKING_ROWS,
          MAX_ENTITY_PATH_FAMILY_WORKING_ROWS
        );
        collectEntityPathFamilyObservation(
          observation,
          observationIndex,
          definition,
          citationFamilies,
          month,
          entityPathFamilyMonthlyCollection,
          MAX_ENTITY_PATH_FAMILY_MONTHLY_COHORT_WORKING_ROWS,
          MAX_ENTITY_PATH_FAMILY_MONTHLY_WORKING_ROWS
        );
      }
    });
  }
  const entityPathFamilySideProfile = (
    denominator: EntityPathFamilyDenominator,
    bucket: EntityPathFamilySideBucket
  ): AiAnswerCitationEntityPathFamilySideProfile => ({
    answerTextObservations: denominator.observations,
    uniquePrompts: denominator.prompts.size,
    citationEventsInAnswerTextSamples: denominator.citationEvents,
    observationsCitingFamily: bucket.answers.size,
    observationCoveragePercent:
      denominator.observations > 0
        ? Number(((bucket.answers.size / denominator.observations) * 100).toFixed(2))
        : null,
    observationCoverageConfidenceInterval95Percent:
      denominator.observations > 0
        ? wilsonRateConfidenceInterval95(bucket.answers.size, denominator.observations)
        : null,
    uniquePromptsCitingFamily: bucket.prompts.size,
    promptCoveragePercent:
      denominator.prompts.size > 0
        ? Number(((bucket.prompts.size / denominator.prompts.size) * 100).toFixed(2))
        : null,
    promptCoverageConfidenceInterval95Percent:
      denominator.prompts.size > 0
        ? wilsonRateConfidenceInterval95(bucket.prompts.size, denominator.prompts.size)
        : null,
    citationEvents: bucket.citationEvents,
    citationEventSharePercent:
      denominator.citationEvents > 0
        ? Number(((bucket.citationEvents / denominator.citationEvents) * 100).toFixed(2))
        : null,
    pages: bucket.urls.size,
    citationListPosition:
      bucket.positions.length > 0 ? summarizeCitationListPositions(bucket.positions) : null,
    ...(bucket.firstObservedAt ? { firstObservedAt: bucket.firstObservedAt } : {}),
    ...(bucket.lastObservedAt ? { lastObservedAt: bucket.lastObservedAt } : {}),
    sampleUrls: [...bucket.urls].sort().slice(0, MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS),
    sampleUrlsTruncated: bucket.urls.size > MAX_SAMPLE_ANSWER_PATH_FAMILY_URLS,
  });
  const summarizeEntityPathFamilyCollection = (
    collection: EntityPathFamilyCollection
  ): Array<{ profile: AiAnswerCitationEntityPathFamilyProfile; month?: string }> =>
    [...collection.buckets.values()]
      .map((bucket) => {
        const cohort = collection.cohorts.get(bucket.cohortKey)!;
        const whenMentioned = entityPathFamilySideProfile(
          cohort.whenMentioned,
          bucket.whenMentioned
        );
        const whenNotMentioned = entityPathFamilySideProfile(
          cohort.whenNotMentioned,
          bucket.whenNotMentioned
        );
        const rate = (numerator: number, denominator: number): number | null =>
          denominator > 0 ? (numerator / denominator) * 100 : null;
        const delta = (mentioned: number | null, notMentioned: number | null): number | null =>
          mentioned === null || notMentioned === null
            ? null
            : Number((mentioned - notMentioned).toFixed(2));
        return {
          ...(cohort.month ? { month: cohort.month } : {}),
          profile: {
            entity: cohort.entity.entity,
            aliases: cohort.entity.aliases,
            provider: cohort.provider,
            ...(cohort.topic ? { topic: cohort.topic } : {}),
            ...(cohort.intent ? { intent: cohort.intent } : {}),
            unlabeled: cohort.unlabeled,
            pathFamily: bucket.pathFamily,
            origin: bucket.origin,
            pathPrefix: bucket.pathPrefix,
            ...(ownedDomains.length > 0 ? { owned: bucket.owned } : {}),
            observationsWithoutAnswerText: cohort.observationsWithoutAnswerText,
            whenMentioned,
            whenNotMentioned,
            observationCoverageDifferencePercentagePoints: delta(
              rate(bucket.whenMentioned.answers.size, cohort.whenMentioned.observations),
              rate(bucket.whenNotMentioned.answers.size, cohort.whenNotMentioned.observations)
            ),
            promptCoverageDifferencePercentagePoints: delta(
              rate(bucket.whenMentioned.prompts.size, cohort.whenMentioned.prompts.size),
              rate(bucket.whenNotMentioned.prompts.size, cohort.whenNotMentioned.prompts.size)
            ),
            citationEventShareDifferencePercentagePoints: delta(
              rate(bucket.whenMentioned.citationEvents, cohort.whenMentioned.citationEvents),
              rate(bucket.whenNotMentioned.citationEvents, cohort.whenNotMentioned.citationEvents)
            ),
          },
        };
      })
      .sort((left, right) => {
        const leftDifference =
          left.profile.observationCoverageDifferencePercentagePoints === null
            ? -1
            : Math.abs(left.profile.observationCoverageDifferencePercentagePoints);
        const rightDifference =
          right.profile.observationCoverageDifferencePercentagePoints === null
            ? -1
            : Math.abs(right.profile.observationCoverageDifferencePercentagePoints);
        const leftEvents =
          left.profile.whenMentioned.citationEvents + left.profile.whenNotMentioned.citationEvents;
        const rightEvents =
          right.profile.whenMentioned.citationEvents +
          right.profile.whenNotMentioned.citationEvents;
        return (
          rightDifference - leftDifference ||
          rightEvents - leftEvents ||
          left.profile.entity.localeCompare(right.profile.entity) ||
          left.profile.provider.localeCompare(right.profile.provider) ||
          left.profile.pathFamily.localeCompare(right.profile.pathFamily)
        );
      });
  const entityCitationPageSideProfile = (
    denominator: EntityCitationPageDenominator,
    bucket: EntityCitationPageSideBucket
  ): AiAnswerCitationEntityCitationPageSideProfile => ({
    answerTextObservations: denominator.observations,
    uniquePrompts: denominator.prompts.size,
    citationEventsInAnswerTextSamples: denominator.citationEvents,
    observationsCitingPage: bucket.answers.size,
    observationCoveragePercent:
      denominator.observations > 0
        ? Number(((bucket.answers.size / denominator.observations) * 100).toFixed(2))
        : null,
    observationCoverageConfidenceInterval95Percent:
      denominator.observations > 0
        ? wilsonRateConfidenceInterval95(bucket.answers.size, denominator.observations)
        : null,
    uniquePromptsCitingPage: bucket.prompts.size,
    promptCoveragePercent:
      denominator.prompts.size > 0
        ? Number(((bucket.prompts.size / denominator.prompts.size) * 100).toFixed(2))
        : null,
    promptCoverageConfidenceInterval95Percent:
      denominator.prompts.size > 0
        ? wilsonRateConfidenceInterval95(bucket.prompts.size, denominator.prompts.size)
        : null,
    citationEvents: bucket.citationEvents,
    citationEventSharePercent:
      denominator.citationEvents > 0
        ? Number(((bucket.citationEvents / denominator.citationEvents) * 100).toFixed(2))
        : null,
    citationListPosition:
      bucket.positions.length > 0 ? summarizeCitationListPositions(bucket.positions) : null,
  });
  const summarizeEntityCitationPageCollection = (
    collection: EntityCitationPageCollection
  ): AiAnswerCitationEntityCitationPageProfile[] =>
    [...collection.buckets.values()]
      .map((bucket) => {
        const cohort = collection.cohorts.get(bucket.cohortKey)!;
        const whenMentioned = entityCitationPageSideProfile(
          cohort.whenMentioned,
          bucket.whenMentioned
        );
        const whenNotMentioned = entityCitationPageSideProfile(
          cohort.whenNotMentioned,
          bucket.whenNotMentioned
        );
        const rate = (numerator: number, denominator: number): number | null =>
          denominator > 0 ? (numerator / denominator) * 100 : null;
        const delta = (mentioned: number | null, notMentioned: number | null): number | null =>
          mentioned === null || notMentioned === null
            ? null
            : Number((mentioned - notMentioned).toFixed(2));
        return {
          entity: cohort.entity.entity,
          aliases: cohort.entity.aliases,
          provider: cohort.provider,
          ...(cohort.month ? { month: cohort.month } : {}),
          ...(cohort.topic ? { topic: cohort.topic } : {}),
          ...(cohort.intent ? { intent: cohort.intent } : {}),
          unlabeled: cohort.unlabeled,
          url: bucket.url,
          domain: bucket.domain,
          owned: bucket.owned,
          observationsWithoutAnswerText: cohort.observationsWithoutAnswerText,
          whenMentioned,
          whenNotMentioned,
          observationCoverageDifferencePercentagePoints: delta(
            rate(bucket.whenMentioned.answers.size, cohort.whenMentioned.observations),
            rate(bucket.whenNotMentioned.answers.size, cohort.whenNotMentioned.observations)
          ),
          promptCoverageDifferencePercentagePoints: delta(
            rate(bucket.whenMentioned.prompts.size, cohort.whenMentioned.prompts.size),
            rate(bucket.whenNotMentioned.prompts.size, cohort.whenNotMentioned.prompts.size)
          ),
          citationEventShareDifferencePercentagePoints: delta(
            rate(bucket.whenMentioned.citationEvents, cohort.whenMentioned.citationEvents),
            rate(bucket.whenNotMentioned.citationEvents, cohort.whenNotMentioned.citationEvents)
          ),
        };
      })
      .sort(
        (left, right) =>
          Math.abs(right.observationCoverageDifferencePercentagePoints ?? 0) -
            Math.abs(left.observationCoverageDifferencePercentagePoints ?? 0) ||
          right.whenMentioned.citationEvents +
            right.whenNotMentioned.citationEvents -
            (left.whenMentioned.citationEvents + left.whenNotMentioned.citationEvents) ||
          left.entity.localeCompare(right.entity) ||
          left.provider.localeCompare(right.provider) ||
          left.url.localeCompare(right.url)
      );
  const entityCitationPageAssociations = summarizeEntityCitationPageCollection(
    entityCitationPageCollection
  );
  const entityCitationPageMonthlyAssociations: AiAnswerCitationEntityCitationPageMonthlyProfile[] =
    summarizeEntityCitationPageCollection(entityCitationPageMonthlyCollection)
      .map((profile) => ({ ...profile, month: profile.month! }))
      .sort(
        (left, right) =>
          (right.month ?? '').localeCompare(left.month ?? '') ||
          Math.abs(right.observationCoverageDifferencePercentagePoints ?? 0) -
            Math.abs(left.observationCoverageDifferencePercentagePoints ?? 0) ||
          right.whenMentioned.citationEvents +
            right.whenNotMentioned.citationEvents -
            (left.whenMentioned.citationEvents + left.whenNotMentioned.citationEvents) ||
          left.entity.localeCompare(right.entity) ||
          left.provider.localeCompare(right.provider) ||
          left.url.localeCompare(right.url)
      );
  const entityCitationPageAssociationsTruncated =
    entityCitationPageCollection.truncated ||
    entityCitationPageAssociations.length > MAX_RETURNED_ENTITY_CITATION_PAGE_PROFILES;
  const entityCitationPageMonthlyAssociationsTruncated =
    entityCitationPageMonthlyCollection.truncated ||
    entityCitationPageMonthlyAssociations.length >
      MAX_RETURNED_ENTITY_CITATION_PAGE_MONTHLY_PROFILES;
  const entityCitationPageTrendKey = (
    profile: AiAnswerCitationEntityCitationPageMonthlyProfile
  ): string =>
    JSON.stringify([
      profile.entity.toLocaleLowerCase('en-US'),
      profile.aliases.map((alias) => alias.toLocaleLowerCase('en-US')).sort(),
      profile.provider.toLocaleLowerCase('en-US'),
      profile.unlabeled ? null : (profile.topic?.toLocaleLowerCase('en-US') ?? null),
      profile.unlabeled ? null : (profile.intent?.toLocaleLowerCase('en-US') ?? null),
      profile.unlabeled,
      profile.url,
    ]);
  if (entityCitationPageMonthlyAssociationsTruncated) {
    for (const profile of entityCitationPageMonthlyAssociations) {
      profile.previousPageCitedMonth = undefined;
      profile.interveningCalendarMonthsWithoutPageRow = undefined;
      profile.mentionedPromptCoverageChangeFromPreviousPageCitedMonth = null;
      profile.notMentionedPromptCoverageChangeFromPreviousPageCitedMonth = null;
      profile.promptCoverageDifferenceChangeFromPreviousPageCitedMonth = null;
      profile.mentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth = null;
      profile.notMentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth = null;
    }
  } else {
    const pageSeries = new Map<string, AiAnswerCitationEntityCitationPageMonthlyProfile[]>();
    for (const profile of entityCitationPageMonthlyAssociations) {
      const key = entityCitationPageTrendKey(profile);
      const rows = pageSeries.get(key) ?? [];
      rows.push(profile);
      pageSeries.set(key, rows);
    }
    const ordinal = (month: string): number =>
      Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
    const promptRateChange = (
      beforeCount: number,
      beforeTotal: number,
      afterCount: number,
      afterTotal: number
    ): number | null =>
      beforeTotal > 0 && afterTotal > 0
        ? Number(((afterCount / afterTotal - beforeCount / beforeTotal) * 100).toFixed(2))
        : null;
    const valueChange = (
      before: number | null | undefined,
      after: number | null | undefined
    ): number | null =>
      before === null || before === undefined || after === null || after === undefined
        ? null
        : Number((after - before).toFixed(2));
    for (const rows of pageSeries.values()) {
      rows.sort((left, right) => left.month.localeCompare(right.month));
      rows.forEach((profile, index) => {
        const previous = rows[index - 1];
        if (!previous) {
          profile.previousPageCitedMonth = null;
          profile.interveningCalendarMonthsWithoutPageRow = 0;
          profile.mentionedPromptCoverageChangeFromPreviousPageCitedMonth = null;
          profile.notMentionedPromptCoverageChangeFromPreviousPageCitedMonth = null;
          profile.promptCoverageDifferenceChangeFromPreviousPageCitedMonth = null;
          profile.mentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth = null;
          profile.notMentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth = null;
          return;
        }
        profile.previousPageCitedMonth = previous.month;
        profile.interveningCalendarMonthsWithoutPageRow = Math.max(
          0,
          ordinal(profile.month) - ordinal(previous.month) - 1
        );
        profile.mentionedPromptCoverageChangeFromPreviousPageCitedMonth = promptRateChange(
          previous.whenMentioned.uniquePromptsCitingPage,
          previous.whenMentioned.uniquePrompts,
          profile.whenMentioned.uniquePromptsCitingPage,
          profile.whenMentioned.uniquePrompts
        );
        profile.notMentionedPromptCoverageChangeFromPreviousPageCitedMonth = promptRateChange(
          previous.whenNotMentioned.uniquePromptsCitingPage,
          previous.whenNotMentioned.uniquePrompts,
          profile.whenNotMentioned.uniquePromptsCitingPage,
          profile.whenNotMentioned.uniquePrompts
        );
        const previousMentionRate =
          previous.whenMentioned.uniquePrompts > 0
            ? previous.whenMentioned.uniquePromptsCitingPage / previous.whenMentioned.uniquePrompts
            : null;
        const previousNotMentionRate =
          previous.whenNotMentioned.uniquePrompts > 0
            ? previous.whenNotMentioned.uniquePromptsCitingPage /
              previous.whenNotMentioned.uniquePrompts
            : null;
        const currentMentionRate =
          profile.whenMentioned.uniquePrompts > 0
            ? profile.whenMentioned.uniquePromptsCitingPage / profile.whenMentioned.uniquePrompts
            : null;
        const currentNotMentionRate =
          profile.whenNotMentioned.uniquePrompts > 0
            ? profile.whenNotMentioned.uniquePromptsCitingPage /
              profile.whenNotMentioned.uniquePrompts
            : null;
        const previousGap =
          previousMentionRate === null || previousNotMentionRate === null
            ? null
            : previousMentionRate - previousNotMentionRate;
        const currentGap =
          currentMentionRate === null || currentNotMentionRate === null
            ? null
            : currentMentionRate - currentNotMentionRate;
        profile.promptCoverageDifferenceChangeFromPreviousPageCitedMonth =
          previousGap === null || currentGap === null
            ? null
            : Number(((currentGap - previousGap) * 100).toFixed(2));
        profile.mentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth = valueChange(
          previous.whenMentioned.citationListPosition?.topThreeCitationSharePercent,
          profile.whenMentioned.citationListPosition?.topThreeCitationSharePercent
        );
        profile.notMentionedTopThreeCitationShareChangeFromPreviousPageCitedMonth = valueChange(
          previous.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent,
          profile.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent
        );
      });
    }
  }
  const entityPathFamilyProfileRows = summarizeEntityPathFamilyCollection(
    entityPathFamilyCollection
  );
  const entityPathFamilyAssociations = entityPathFamilyProfileRows.map(({ profile }) => profile);
  const entityPathFamilyMonthlyAssociations: AiAnswerCitationEntityPathFamilyMonthlyProfile[] =
    summarizeEntityPathFamilyCollection(entityPathFamilyMonthlyCollection)
      .map(({ profile, month }) => ({ ...profile, month: month! }))
      .sort(
        (left, right) =>
          left.month.localeCompare(right.month) ||
          Math.abs(right.observationCoverageDifferencePercentagePoints ?? 0) -
            Math.abs(left.observationCoverageDifferencePercentagePoints ?? 0) ||
          right.whenMentioned.citationEvents +
            right.whenNotMentioned.citationEvents -
            (left.whenMentioned.citationEvents + left.whenNotMentioned.citationEvents) ||
          left.entity.localeCompare(right.entity) ||
          left.provider.localeCompare(right.provider) ||
          left.pathFamily.localeCompare(right.pathFamily)
      );
  const entityPathFamilyAssociationsTruncated =
    entityPathFamilyCollection.truncated ||
    entityPathFamilyAssociations.length > MAX_RETURNED_ENTITY_PATH_FAMILY_PROFILES;
  const entityPathFamilyMonthlyAssociationsTruncated =
    entityPathFamilyMonthlyCollection.truncated ||
    entityPathFamilyMonthlyAssociations.length > MAX_RETURNED_ENTITY_PATH_FAMILY_MONTHLY_PROFILES;
  if (entityPathFamilyMonthlyAssociationsTruncated) {
    for (const profile of entityPathFamilyMonthlyAssociations) {
      profile.previousFamilyCitedMonth = undefined;
      profile.interveningCalendarMonthsWithoutFamilyRow = undefined;
      profile.mentionedPromptCoverageChangeFromPreviousFamilyCitedMonth = null;
      profile.notMentionedPromptCoverageChangeFromPreviousFamilyCitedMonth = null;
      profile.promptCoverageDifferenceChangeFromPreviousFamilyCitedMonth = null;
      profile.mentionedTopThreeCitationShareChangeFromPreviousFamilyCitedMonth = null;
      profile.notMentionedTopThreeCitationShareChangeFromPreviousFamilyCitedMonth = null;
    }
  } else {
    const series = new Map<string, AiAnswerCitationEntityPathFamilyMonthlyProfile[]>();
    for (const profile of entityPathFamilyMonthlyAssociations) {
      const key = JSON.stringify([
        profile.entity.toLocaleLowerCase('en-US'),
        profile.aliases.map((alias) => alias.toLocaleLowerCase('en-US')).sort(),
        profile.provider.toLocaleLowerCase('en-US'),
        profile.unlabeled ? null : (profile.topic?.toLocaleLowerCase('en-US') ?? null),
        profile.unlabeled ? null : (profile.intent?.toLocaleLowerCase('en-US') ?? null),
        profile.unlabeled,
        profile.pathFamily,
      ]);
      const rows = series.get(key) ?? [];
      rows.push(profile);
      series.set(key, rows);
    }
    const rate = (numerator: number, denominator: number): number | null =>
      denominator > 0 ? (numerator / denominator) * 100 : null;
    const rateChange = (
      previousNumerator: number,
      previousDenominator: number,
      currentNumerator: number,
      currentDenominator: number
    ): number | null => {
      const previousRate = rate(previousNumerator, previousDenominator);
      const currentRate = rate(currentNumerator, currentDenominator);
      return previousRate === null || currentRate === null
        ? null
        : Number((currentRate - previousRate).toFixed(2));
    };
    const valueChange = (
      previous: number | null | undefined,
      current: number | null | undefined
    ): number | null =>
      previous === null || previous === undefined || current === null || current === undefined
        ? null
        : Number((current - previous).toFixed(2));
    for (const rows of series.values()) {
      rows.sort((left, right) => left.month.localeCompare(right.month));
      for (let index = 0; index < rows.length; index += 1) {
        const current = rows[index]!;
        const previous = rows[index - 1];
        if (!previous) {
          current.previousFamilyCitedMonth = null;
          continue;
        }
        const previousMonthIndex =
          Number(previous.month.slice(0, 4)) * 12 + Number(previous.month.slice(5, 7)) - 1;
        const currentMonthIndex =
          Number(current.month.slice(0, 4)) * 12 + Number(current.month.slice(5, 7)) - 1;
        current.previousFamilyCitedMonth = previous.month;
        current.interveningCalendarMonthsWithoutFamilyRow = Math.max(
          0,
          currentMonthIndex - previousMonthIndex - 1
        );
        current.mentionedPromptCoverageChangeFromPreviousFamilyCitedMonth = rateChange(
          previous.whenMentioned.uniquePromptsCitingFamily,
          previous.whenMentioned.uniquePrompts,
          current.whenMentioned.uniquePromptsCitingFamily,
          current.whenMentioned.uniquePrompts
        );
        current.notMentionedPromptCoverageChangeFromPreviousFamilyCitedMonth = rateChange(
          previous.whenNotMentioned.uniquePromptsCitingFamily,
          previous.whenNotMentioned.uniquePrompts,
          current.whenNotMentioned.uniquePromptsCitingFamily,
          current.whenNotMentioned.uniquePrompts
        );
        const previousMentionPromptRate = rate(
          previous.whenMentioned.uniquePromptsCitingFamily,
          previous.whenMentioned.uniquePrompts
        );
        const previousNonMentionPromptRate = rate(
          previous.whenNotMentioned.uniquePromptsCitingFamily,
          previous.whenNotMentioned.uniquePrompts
        );
        const currentMentionPromptRate = rate(
          current.whenMentioned.uniquePromptsCitingFamily,
          current.whenMentioned.uniquePrompts
        );
        const currentNonMentionPromptRate = rate(
          current.whenNotMentioned.uniquePromptsCitingFamily,
          current.whenNotMentioned.uniquePrompts
        );
        const previousGap =
          previousMentionPromptRate === null || previousNonMentionPromptRate === null
            ? null
            : previousMentionPromptRate - previousNonMentionPromptRate;
        const currentGap =
          currentMentionPromptRate === null || currentNonMentionPromptRate === null
            ? null
            : currentMentionPromptRate - currentNonMentionPromptRate;
        current.promptCoverageDifferenceChangeFromPreviousFamilyCitedMonth = valueChange(
          previousGap,
          currentGap
        );
        current.mentionedTopThreeCitationShareChangeFromPreviousFamilyCitedMonth = valueChange(
          previous.whenMentioned.citationListPosition?.topThreeCitationSharePercent,
          current.whenMentioned.citationListPosition?.topThreeCitationSharePercent
        );
        current.notMentionedTopThreeCitationShareChangeFromPreviousFamilyCitedMonth = valueChange(
          previous.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent,
          current.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent
        );
      }
    }
  }
  const answerEntityByName = new Map(
    answerEntities.map((definition) => [definition.entity, definition])
  );
  type EntityCoMentionAccumulator = {
    scope: 'overall' | 'provider' | 'month-provider-cohort';
    provider?: string;
    month?: string;
    topic?: string;
    intent?: string;
    unlabeled?: boolean;
    answerTextObservations: number;
    uniquePrompts: Set<string>;
    mentionCounts: Map<string, number>;
    mentionPrompts: Map<string, Set<string>>;
    pairs: Map<
      string,
      { entity: string; otherEntity: string; observations: number; prompts: Set<string> }
    >;
  };
  const createEntityCoMentionScope = (
    dimensions: Pick<
      EntityCoMentionAccumulator,
      'scope' | 'provider' | 'month' | 'topic' | 'intent' | 'unlabeled'
    >
  ): EntityCoMentionAccumulator => ({
    ...dimensions,
    answerTextObservations: 0,
    uniquePrompts: new Set<string>(),
    mentionCounts: new Map<string, number>(),
    mentionPrompts: new Map<string, Set<string>>(),
    pairs: new Map<
      string,
      { entity: string; otherEntity: string; observations: number; prompts: Set<string> }
    >(),
  });
  const overallEntityCoMentionScope = createEntityCoMentionScope({ scope: 'overall' });
  const providerEntityCoMentionScopes = new Map(
    [...observationsByProvider.keys()]
      .sort((left, right) => left.localeCompare(right))
      .map((provider) => [provider, createEntityCoMentionScope({ scope: 'provider', provider })])
  );
  const cohortEntityCoMentionScopes = new Map<string, EntityCoMentionAccumulator>();
  if (answerEntities.length > 1) {
    for (const observation of observations) {
      if (observation.answerText === undefined) continue;
      const mentionedEntities = answerEntities.filter(
        (definition) => findEntityMentionOffsets(observation.answerText!, definition).length > 0
      );
      const promptKey = observation.promptKey;
      const cohortKey = JSON.stringify([
        observation.observedAt.slice(0, 7),
        observation.topicKey ?? null,
        observation.intentKey ?? null,
        observation.providerKey,
      ]);
      const cohortScope =
        cohortEntityCoMentionScopes.get(cohortKey) ??
        createEntityCoMentionScope({
          scope: 'month-provider-cohort',
          month: observation.observedAt.slice(0, 7),
          ...(observation.topic ? { topic: observation.topic } : {}),
          ...(observation.intent ? { intent: observation.intent } : {}),
          unlabeled: observation.topicKey === undefined && observation.intentKey === undefined,
          provider: observation.provider,
        });
      cohortEntityCoMentionScopes.set(cohortKey, cohortScope);
      const targetScopes = [
        overallEntityCoMentionScope,
        providerEntityCoMentionScopes.get(observation.provider)!,
        cohortScope,
      ];
      for (const scope of targetScopes) {
        scope.answerTextObservations += 1;
        scope.uniquePrompts.add(promptKey);
        for (const definition of mentionedEntities) {
          scope.mentionCounts.set(
            definition.entity,
            (scope.mentionCounts.get(definition.entity) ?? 0) + 1
          );
          const prompts = scope.mentionPrompts.get(definition.entity) ?? new Set<string>();
          prompts.add(promptKey);
          scope.mentionPrompts.set(definition.entity, prompts);
        }
        for (let leftIndex = 0; leftIndex < mentionedEntities.length; leftIndex += 1) {
          for (
            let rightIndex = leftIndex + 1;
            rightIndex < mentionedEntities.length;
            rightIndex += 1
          ) {
            const entity = mentionedEntities[leftIndex]!;
            const otherEntity = mentionedEntities[rightIndex]!;
            const key = JSON.stringify([entity.entity, otherEntity.entity]);
            const pair = scope.pairs.get(key) ?? {
              entity: entity.entity,
              otherEntity: otherEntity.entity,
              observations: 0,
              prompts: new Set<string>(),
            };
            pair.observations += 1;
            pair.prompts.add(promptKey);
            scope.pairs.set(key, pair);
          }
        }
      }
    }
  }
  const entityCoMentionScopes = [
    overallEntityCoMentionScope,
    ...providerEntityCoMentionScopes.values(),
    ...cohortEntityCoMentionScopes.values(),
  ];
  const entityCoMentionProfiles: AiAnswerCitationEntityCoMentionProfile[] =
    answerEntities.length > 1
      ? entityCoMentionScopes
          .flatMap((scope) =>
            [...scope.pairs.values()].map((pair): AiAnswerCitationEntityCoMentionProfile => {
              const entityMentioned = scope.mentionCounts.get(pair.entity) ?? 0;
              const otherEntityMentioned = scope.mentionCounts.get(pair.otherEntity) ?? 0;
              const uniquePromptsMentioningEntity =
                scope.mentionPrompts.get(pair.entity)?.size ?? 0;
              const uniquePromptsMentioningOtherEntity =
                scope.mentionPrompts.get(pair.otherEntity)?.size ?? 0;
              const promptUnion =
                uniquePromptsMentioningEntity +
                uniquePromptsMentioningOtherEntity -
                pair.prompts.size;
              const entityDefinition = answerEntityByName.get(pair.entity)!;
              const otherEntityDefinition = answerEntityByName.get(pair.otherEntity)!;
              const total = scope.answerTextObservations;
              const entityRate = entityMentioned / total;
              const otherEntityRate = otherEntityMentioned / total;
              const expectedRate = entityRate * otherEntityRate;
              return {
                entity: pair.entity,
                aliases: entityDefinition.aliases,
                otherEntity: pair.otherEntity,
                otherAliases: otherEntityDefinition.aliases,
                scope: scope.scope,
                ...(scope.provider ? { provider: scope.provider } : {}),
                ...(scope.month ? { month: scope.month } : {}),
                ...(scope.topic ? { topic: scope.topic } : {}),
                ...(scope.intent ? { intent: scope.intent } : {}),
                ...(scope.unlabeled === undefined ? {} : { unlabeled: scope.unlabeled }),
                answerTextObservations: total,
                uniquePrompts: scope.uniquePrompts.size,
                observationsMentioningEntity: entityMentioned,
                observationsMentioningOtherEntity: otherEntityMentioned,
                observationsMentioningBoth: pair.observations,
                coMentionRatePercent: Number(((pair.observations / total) * 100).toFixed(2)),
                coMentionRateConfidenceInterval95Percent: confidenceInterval95(
                  pair.observations,
                  total
                )!,
                coMentionGivenEntityPercent: Number(
                  ((pair.observations / entityMentioned) * 100).toFixed(2)
                ),
                coMentionGivenEntityConfidenceInterval95Percent: confidenceInterval95(
                  pair.observations,
                  entityMentioned
                )!,
                coMentionGivenOtherEntityPercent: Number(
                  ((pair.observations / otherEntityMentioned) * 100).toFixed(2)
                ),
                coMentionGivenOtherEntityConfidenceInterval95Percent: confidenceInterval95(
                  pair.observations,
                  otherEntityMentioned
                )!,
                snapshotJaccardPercent: Number(
                  (
                    (pair.observations /
                      (entityMentioned + otherEntityMentioned - pair.observations)) *
                    100
                  ).toFixed(2)
                ),
                independentExpectedCoMentionRatePercent: Number((expectedRate * 100).toFixed(2)),
                coMentionLift:
                  expectedRate > 0
                    ? Number((pair.observations / total / expectedRate).toFixed(3))
                    : null,
                uniquePromptsMentioningEntity,
                uniquePromptsMentioningOtherEntity,
                uniquePromptsMentioningBoth: pair.prompts.size,
                promptJaccardPercent:
                  promptUnion > 0
                    ? Number(((pair.prompts.size / promptUnion) * 100).toFixed(2))
                    : 0,
              };
            })
          )
          .sort((left, right) => {
            const scopeOrder = (scope: AiAnswerCitationEntityCoMentionProfile['scope']): number =>
              scope === 'overall' ? 0 : scope === 'provider' ? 1 : 2;
            return (
              scopeOrder(left.scope) - scopeOrder(right.scope) ||
              right.observationsMentioningBoth - left.observationsMentioningBoth ||
              right.promptJaccardPercent - left.promptJaccardPercent ||
              left.month?.localeCompare(right.month ?? '') ||
              (left.provider ?? '').localeCompare(right.provider ?? '') ||
              left.entity.localeCompare(right.entity) ||
              left.otherEntity.localeCompare(right.otherEntity)
            );
          })
      : [];
  const entityMentionMonthGroups = new Map<
    string,
    {
      entity: string;
      month: string;
      topic?: string;
      intent?: string;
      unlabeled: boolean;
      provider: string;
      observations: NormalizedObservation[];
      prompts: Set<string>;
    }
  >();
  for (const definition of answerEntities) {
    for (const observation of observations) {
      const month = observation.observedAt.slice(0, 7);
      const groupKey = JSON.stringify([
        definition.entity,
        month,
        observation.providerKey,
        observation.topicKey ?? null,
        observation.intentKey ?? null,
      ]);
      const group = entityMentionMonthGroups.get(groupKey) ?? {
        entity: definition.entity,
        month,
        ...(observation.topic ? { topic: observation.topic } : {}),
        ...(observation.intent ? { intent: observation.intent } : {}),
        unlabeled: observation.topicKey === undefined && observation.intentKey === undefined,
        provider: observation.provider,
        observations: [],
        prompts: new Set<string>(),
      };
      group.observations.push(observation);
      group.prompts.add(observation.promptKey);
      entityMentionMonthGroups.set(groupKey, group);
    }
  }
  const entityMentionMonthlyBaseRows = [...entityMentionMonthGroups.values()].map(
    (group): AiAnswerCitationEntityMentionMonthlyProfile => ({
      entity: group.entity,
      month: group.month,
      ...(group.topic ? { topic: group.topic } : {}),
      ...(group.intent ? { intent: group.intent } : {}),
      unlabeled: group.unlabeled,
      provider: group.provider,
      observations: group.observations.length,
      uniquePrompts: group.prompts.size,
      ...summarizeMentions(group.observations, answerEntityByName.get(group.entity)!),
    })
  );
  const monthlyTrendKey = (profile: AiAnswerCitationEntityMentionMonthlyProfile): string =>
    JSON.stringify([
      profile.entity.normalize('NFKC').toLocaleLowerCase('en-US'),
      profile.provider.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US'),
      profile.topic?.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US') ??
        '',
      profile.intent?.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US') ??
        '',
      profile.unlabeled,
    ]);
  const monthOrdinal = (month: string): number =>
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
  const monthlyTrendGroups = new Map<string, AiAnswerCitationEntityMentionMonthlyProfile[]>();
  for (const profile of entityMentionMonthlyBaseRows) {
    const key = monthlyTrendKey(profile);
    const group = monthlyTrendGroups.get(key) ?? [];
    group.push(profile);
    monthlyTrendGroups.set(key, group);
  }
  const percentPointDelta = (
    previous: number | null | undefined,
    current: number | null | undefined
  ): number | null =>
    previous === null || previous === undefined || current === null || current === undefined
      ? null
      : Number((current - previous).toFixed(2));
  const entityMentionMonthlyRows = [...monthlyTrendGroups.values()]
    .flatMap((profiles) => {
      const ordered = profiles.sort((left, right) => left.month.localeCompare(right.month));
      return ordered.map((profile, index): AiAnswerCitationEntityMentionMonthlyProfile => {
        const previous = ordered[index - 1];
        if (!previous) return profile;
        const ownedCoverageChange = percentPointDelta(
          previous.ownedCitationCoverageWhenMentionedPercent,
          profile.ownedCitationCoverageWhenMentionedPercent
        );
        const previousOwnedTopThree =
          previous.ownedCitationPositionWhenMentioned?.topThreeCitationSharePercent;
        const currentOwnedTopThree =
          profile.ownedCitationPositionWhenMentioned?.topThreeCitationSharePercent;
        return {
          ...profile,
          previousSampledMonth: previous.month,
          interveningUnsampledCalendarMonths: Math.max(
            0,
            monthOrdinal(profile.month) - monthOrdinal(previous.month) - 1
          ),
          entityMentionRateChangePercentagePointsFromPreviousSampledMonth: percentPointDelta(
            previous.entityMentionRatePercent,
            profile.entityMentionRatePercent
          ),
          ...(previous.ownedCitationCoverageWhenMentionedPercent === undefined ||
          profile.ownedCitationCoverageWhenMentionedPercent === undefined
            ? {}
            : {
                ownedCitationCoverageWhenMentionedChangePercentagePointsFromPreviousSampledMonth:
                  ownedCoverageChange,
              }),
          ...(previous.ownedCitationPositionWhenMentioned === undefined ||
          profile.ownedCitationPositionWhenMentioned === undefined
            ? {}
            : {
                ownedTopThreeCitationShareChangePercentagePointsFromPreviousSampledMonth:
                  percentPointDelta(previousOwnedTopThree, currentOwnedTopThree),
              }),
        };
      });
    })
    .sort(
      (left, right) =>
        right.month.localeCompare(left.month) ||
        right.observations - left.observations ||
        left.entity.localeCompare(right.entity) ||
        left.provider.localeCompare(right.provider) ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '')
    );
  const entityMentionOpportunityGroups = new Map<
    string,
    {
      entity: string;
      aliases: string[];
      provider: string;
      topic?: string;
      intent?: string;
      unlabeled: boolean;
      prompt: string;
      answerTextObservations: number;
      observationsMentioningEntity: number;
      entityMentionOccurrences: number;
      observationsMentioningWithOwnedCitation: number;
      incompleteCitationListsWithoutOwnedCitation: number;
      firstMentionObservedAt: string;
      lastMentionObservedAt: string;
      citedDomainsWithoutOwnedCitation: Map<
        string,
        {
          citationEvents: number;
          observationsWithDomain: number;
          firstPositionCitationEvents: number;
          topThreeCitationEvents: number;
          observationsWithFirstPositionCitation: number;
          observationsWithTopThreeCitation: number;
        }
      >;
    }
  >();
  if (ownedDomains.length > 0) {
    for (const definition of answerEntities) {
      for (const observation of observations) {
        if (observation.answerText === undefined) continue;
        const offsets = findEntityMentionOffsets(observation.answerText, definition);
        const groupKey = JSON.stringify([
          definition.entity,
          observation.providerKey,
          observation.topicKey ?? null,
          observation.intentKey ?? null,
          observation.promptKey,
        ]);
        const group = entityMentionOpportunityGroups.get(groupKey) ?? {
          entity: definition.entity,
          aliases: definition.aliases,
          provider: observation.provider,
          ...(observation.topic ? { topic: observation.topic } : {}),
          ...(observation.intent ? { intent: observation.intent } : {}),
          unlabeled: observation.topicKey === undefined && observation.intentKey === undefined,
          prompt: observation.prompt,
          answerTextObservations: 0,
          observationsMentioningEntity: 0,
          entityMentionOccurrences: 0,
          observationsMentioningWithOwnedCitation: 0,
          incompleteCitationListsWithoutOwnedCitation: 0,
          firstMentionObservedAt: observation.observedAt,
          lastMentionObservedAt: observation.observedAt,
          citedDomainsWithoutOwnedCitation: new Map(),
        };
        group.answerTextObservations += 1;
        if (offsets.length === 0) {
          entityMentionOpportunityGroups.set(groupKey, group);
          continue;
        }
        group.observationsMentioningEntity += 1;
        group.entityMentionOccurrences += offsets.length;
        group.firstMentionObservedAt =
          observation.observedAt < group.firstMentionObservedAt
            ? observation.observedAt
            : group.firstMentionObservedAt;
        group.lastMentionObservedAt =
          observation.observedAt > group.lastMentionObservedAt
            ? observation.observedAt
            : group.lastMentionObservedAt;
        if (observation.citations.some(({ domain }) => isOwnedDomain(domain, ownedDomains))) {
          group.observationsMentioningWithOwnedCitation += 1;
        } else {
          if (!observation.citationListComplete)
            group.incompleteCitationListsWithoutOwnedCitation += 1;
          const observedAlternativeDomains = new Map<
            string,
            { first: boolean; topThree: boolean }
          >();
          for (const { domain, position } of observation.citations) {
            const profile = group.citedDomainsWithoutOwnedCitation.get(domain) ?? {
              citationEvents: 0,
              observationsWithDomain: 0,
              firstPositionCitationEvents: 0,
              topThreeCitationEvents: 0,
              observationsWithFirstPositionCitation: 0,
              observationsWithTopThreeCitation: 0,
            };
            profile.citationEvents += 1;
            if (position === 1) profile.firstPositionCitationEvents += 1;
            if (position <= 3) profile.topThreeCitationEvents += 1;
            group.citedDomainsWithoutOwnedCitation.set(domain, profile);
            const observed = observedAlternativeDomains.get(domain) ?? {
              first: false,
              topThree: false,
            };
            observed.first ||= position === 1;
            observed.topThree ||= position <= 3;
            observedAlternativeDomains.set(domain, observed);
          }
          for (const [domain, observed] of observedAlternativeDomains) {
            const profile = group.citedDomainsWithoutOwnedCitation.get(domain)!;
            profile.observationsWithDomain += 1;
            if (observed.first) profile.observationsWithFirstPositionCitation += 1;
            if (observed.topThree) profile.observationsWithTopThreeCitation += 1;
          }
        }
        entityMentionOpportunityGroups.set(groupKey, group);
      }
    }
  }
  const entityMentionOpportunityRows: AiAnswerCitationEntityMentionOpportunity[] = [
    ...entityMentionOpportunityGroups.values(),
  ]
    .filter(
      (group) => group.observationsMentioningEntity > group.observationsMentioningWithOwnedCitation
    )
    .map((group) => {
      const domains = [...group.citedDomainsWithoutOwnedCitation.entries()].sort(
        (left, right) =>
          right[1].citationEvents - left[1].citationEvents || left[0].localeCompare(right[0])
      );
      const observationsMentioningWithoutOwnedCitation =
        group.observationsMentioningEntity - group.observationsMentioningWithOwnedCitation;
      return {
        entity: group.entity,
        aliases: group.aliases,
        provider: group.provider,
        ...(group.topic ? { topic: group.topic } : {}),
        ...(group.intent ? { intent: group.intent } : {}),
        unlabeled: group.unlabeled,
        prompt: group.prompt,
        answerTextObservations: group.answerTextObservations,
        observationsMentioningEntity: group.observationsMentioningEntity,
        entityMentionRatePercent: Number(
          ((group.observationsMentioningEntity / group.answerTextObservations) * 100).toFixed(2)
        ),
        entityMentionOccurrences: group.entityMentionOccurrences,
        observationsMentioningWithOwnedCitation: group.observationsMentioningWithOwnedCitation,
        observationsMentioningWithoutOwnedCitation,
        incompleteCitationListsWithoutOwnedCitation:
          group.incompleteCitationListsWithoutOwnedCitation,
        ownedCitationCoverageWhenMentionedPercent: Number(
          (
            (group.observationsMentioningWithOwnedCitation / group.observationsMentioningEntity) *
            100
          ).toFixed(2)
        ),
        citedDomainsWithoutOwnedCitation: domains.slice(0, 5).map(([domain]) => domain),
        citedDomainCitationEventsWithoutOwnedCitation: domains
          .slice(0, 5)
          .map(([domain, profile]) => ({ domain, ...profile })),
        citedDomainsTruncated: domains.length > 5,
        firstMentionObservedAt: group.firstMentionObservedAt,
        lastMentionObservedAt: group.lastMentionObservedAt,
      };
    })
    .sort(
      (left, right) =>
        right.observationsMentioningWithoutOwnedCitation -
          left.observationsMentioningWithoutOwnedCitation ||
        right.observationsMentioningEntity - left.observationsMentioningEntity ||
        left.entity.localeCompare(right.entity) ||
        left.provider.localeCompare(right.provider) ||
        left.prompt.localeCompare(right.prompt)
    );

  let coCitationSummary: AiAnswerCitationCoCitationSummary | undefined;
  let coCitationDomains: AiAnswerCitationCoCitationDomainProfile[] | undefined;
  if (ownedDomains.length > 0) {
    interface CoCitationProviderBucket {
      provider: string;
      citationEvents: number;
      answers: Set<number>;
      prompts: Set<string>;
    }
    interface CoCitationDomainBucket {
      domain: string;
      citationEvents: number;
      answers: Set<number>;
      prompts: Set<string>;
      providers: Map<string, CoCitationProviderBucket>;
      sampleUrls: Set<string>;
      sampleUrlsTruncated: boolean;
      firstObservedAt: string;
      lastObservedAt: string;
    }
    const coCitationBuckets = new Map<string, CoCitationDomainBucket>();
    const ownedObservationsByProvider = new Map<string, number>();
    const externalEventsByProvider = new Map<string, number>();
    let ownedCitationObservations = 0;
    let externalCitationEvents = 0;
    for (let observationIndex = 0; observationIndex < observations.length; observationIndex += 1) {
      const observation = observations[observationIndex]!;
      if (!observation.citations.some(({ domain }) => isOwnedDomain(domain, ownedDomains)))
        continue;
      ownedCitationObservations += 1;
      ownedObservationsByProvider.set(
        observation.providerKey,
        (ownedObservationsByProvider.get(observation.providerKey) ?? 0) + 1
      );
      const externalDomainsInObservation = new Set<string>();
      for (const citation of observation.citations) {
        if (isOwnedDomain(citation.domain, ownedDomains)) continue;
        externalCitationEvents += 1;
        externalEventsByProvider.set(
          observation.providerKey,
          (externalEventsByProvider.get(observation.providerKey) ?? 0) + 1
        );
        externalDomainsInObservation.add(citation.domain);
        const bucket = coCitationBuckets.get(citation.domain) ?? {
          domain: citation.domain,
          citationEvents: 0,
          answers: new Set<number>(),
          prompts: new Set<string>(),
          providers: new Map<string, CoCitationProviderBucket>(),
          sampleUrls: new Set<string>(),
          sampleUrlsTruncated: false,
          firstObservedAt: observation.observedAt,
          lastObservedAt: observation.observedAt,
        };
        bucket.citationEvents += 1;
        bucket.answers.add(observationIndex);
        bucket.prompts.add(observation.promptKey);
        bucket.firstObservedAt =
          observation.observedAt < bucket.firstObservedAt
            ? observation.observedAt
            : bucket.firstObservedAt;
        bucket.lastObservedAt =
          observation.observedAt > bucket.lastObservedAt
            ? observation.observedAt
            : bucket.lastObservedAt;
        if (!bucket.sampleUrls.has(citation.url)) {
          if (bucket.sampleUrls.size < MAX_SAMPLE_CO_CITATION_URLS)
            bucket.sampleUrls.add(citation.url);
          else bucket.sampleUrlsTruncated = true;
        }
        const providerBucket = bucket.providers.get(observation.providerKey) ?? {
          provider: observation.provider,
          citationEvents: 0,
          answers: new Set<number>(),
          prompts: new Set<string>(),
        };
        providerBucket.citationEvents += 1;
        providerBucket.answers.add(observationIndex);
        providerBucket.prompts.add(observation.promptKey);
        bucket.providers.set(observation.providerKey, providerBucket);
        coCitationBuckets.set(citation.domain, bucket);
      }
    }
    const coCitationDomainRows = [...coCitationBuckets.values()]
      .map((bucket): AiAnswerCitationCoCitationDomainProfile => ({
        domain: bucket.domain,
        citationEvents: bucket.citationEvents,
        observedAnswers: bucket.answers.size,
        uniquePrompts: bucket.prompts.size,
        providers: [...bucket.providers.values()]
          .map(({ provider }) => provider)
          .sort((left, right) => left.localeCompare(right)),
        answerCoveragePercent:
          ownedCitationObservations > 0
            ? Number(((bucket.answers.size / ownedCitationObservations) * 100).toFixed(2))
            : 0,
        externalCitationEventSharePercent:
          externalCitationEvents > 0
            ? Number(((bucket.citationEvents / externalCitationEvents) * 100).toFixed(2))
            : null,
        firstObservedAt: bucket.firstObservedAt,
        lastObservedAt: bucket.lastObservedAt,
        sampleUrls: [...bucket.sampleUrls],
        sampleUrlsTruncated: bucket.sampleUrlsTruncated,
        providerProfiles: [...bucket.providers.entries()]
          .map(([providerKey, providerBucket]): AiAnswerCitationCoCitationProviderProfile => {
            const providerOwnedObservations = ownedObservationsByProvider.get(providerKey) ?? 0;
            const providerExternalEvents = externalEventsByProvider.get(providerKey) ?? 0;
            return {
              provider: providerBucket.provider,
              ownedCitationObservations: providerOwnedObservations,
              externalCitationEvents: providerExternalEvents,
              citationEvents: providerBucket.citationEvents,
              observedAnswers: providerBucket.answers.size,
              uniquePrompts: providerBucket.prompts.size,
              answerCoveragePercent:
                providerOwnedObservations > 0
                  ? Number(
                      ((providerBucket.answers.size / providerOwnedObservations) * 100).toFixed(2)
                    )
                  : 0,
              externalCitationEventSharePercent:
                providerExternalEvents > 0
                  ? Number(
                      ((providerBucket.citationEvents / providerExternalEvents) * 100).toFixed(2)
                    )
                  : null,
            };
          })
          .sort((left, right) => left.provider.localeCompare(right.provider)),
      }))
      .sort(
        (left, right) =>
          right.observedAnswers - left.observedAnswers ||
          right.citationEvents - left.citationEvents ||
          left.domain.localeCompare(right.domain)
      );
    coCitationSummary = {
      ownedCitationObservations,
      externalCitationEvents,
      distinctExternalDomains: coCitationDomainRows.length,
      domainsTruncated: coCitationDomainRows.length > MAX_RETURNED_CO_CITATION_DOMAINS,
    };
    coCitationDomains = coCitationDomainRows.slice(0, MAX_RETURNED_CO_CITATION_DOMAINS);
  }

  const hasExecutionContextLabels =
    modelLabels.size > 0 || surfaceLabels.size > 0 || localeLabels.size > 0;
  const executionContextBuckets = new Map<string, ExecutionContextAccumulator>();
  const executionContextMonthlyBuckets = new Map<string, ExecutionContextMonthlyAccumulator>();
  if (hasExecutionContextLabels) {
    for (const observation of observations) {
      const key = executionContextKey(observation);
      const bucket =
        executionContextBuckets.get(key) ?? createExecutionContextAccumulator(observation);
      addExecutionContextObservation(bucket, observation, ownedDomains);
      executionContextBuckets.set(key, bucket);
      const month = observation.observedAt.slice(0, 7);
      const monthlyKey = JSON.stringify([month, key]);
      const monthlyBucket = executionContextMonthlyBuckets.get(monthlyKey) ?? {
        ...createExecutionContextAccumulator(observation),
        month,
        contextKey: key,
      };
      addExecutionContextObservation(monthlyBucket, observation, ownedDomains);
      executionContextMonthlyBuckets.set(monthlyKey, monthlyBucket);
    }
  }
  const executionContextProfiles: AiAnswerCitationExecutionContextProfile[] = [
    ...executionContextBuckets.values(),
  ]
    .map((bucket) => executionContextProfileFromAccumulator(bucket, ownedDomains.length > 0))
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        left.provider.localeCompare(right.provider) ||
        (left.model ?? '').localeCompare(right.model ?? '') ||
        (left.surface ?? '').localeCompare(right.surface ?? '') ||
        (left.locale ?? '').localeCompare(right.locale ?? '') ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '')
    );
  const monthlyContextProfilesBySeries = new Map<
    string,
    AiAnswerCitationExecutionContextMonthlyProfile[]
  >();
  for (const bucket of executionContextMonthlyBuckets.values()) {
    const profile: AiAnswerCitationExecutionContextMonthlyProfile = {
      ...executionContextProfileFromAccumulator(bucket, ownedDomains.length > 0),
      month: bucket.month,
      previousSampledMonth: null,
      interveningUnsampledCalendarMonths: 0,
      citationCoverageChangeFromPreviousSampledMonthPercentagePoints: null,
      promptCitationReachChangeFromPreviousSampledMonthPercentagePoints: null,
      equalPromptMeanCitationCoverageChangeFromPreviousSampledMonthPercentagePoints: null,
      ...(ownedDomains.length > 0
        ? {
            ownedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints: null,
            ownedPromptCitationReachChangeFromPreviousSampledMonthPercentagePoints: null,
            equalPromptMeanOwnedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints:
              null,
          }
        : {}),
    };
    const series = monthlyContextProfilesBySeries.get(bucket.contextKey) ?? [];
    series.push(profile);
    monthlyContextProfilesBySeries.set(bucket.contextKey, series);
  }
  const executionContextMonthlyProfiles: AiAnswerCitationExecutionContextMonthlyProfile[] = [];
  const executionContextDelta = (
    currentValue: number | undefined,
    previousValue: number | undefined
  ): number | null =>
    currentValue === undefined || previousValue === undefined
      ? null
      : Number((currentValue - previousValue).toFixed(2));
  const executionContextMonthOrdinal = (month: string): number =>
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  for (const series of monthlyContextProfilesBySeries.values()) {
    series.sort((left, right) => left.month.localeCompare(right.month));
    series.forEach((profile, index) => {
      const previous = series[index - 1];
      if (!previous) return;
      profile.previousSampledMonth = previous.month;
      profile.interveningUnsampledCalendarMonths = Math.max(
        0,
        executionContextMonthOrdinal(profile.month) -
          executionContextMonthOrdinal(previous.month) -
          1
      );
      profile.citationCoverageChangeFromPreviousSampledMonthPercentagePoints =
        executionContextDelta(profile.citationCoveragePercent, previous.citationCoveragePercent);
      profile.promptCitationReachChangeFromPreviousSampledMonthPercentagePoints =
        executionContextDelta(
          profile.promptCitationReachPercent,
          previous.promptCitationReachPercent
        );
      profile.equalPromptMeanCitationCoverageChangeFromPreviousSampledMonthPercentagePoints =
        executionContextDelta(
          profile.equalPromptMeanCitationCoveragePercent,
          previous.equalPromptMeanCitationCoveragePercent
        );
      if (ownedDomains.length > 0) {
        profile.ownedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints =
          executionContextDelta(
            profile.ownedCitationCoveragePercent,
            previous.ownedCitationCoveragePercent
          );
        profile.ownedPromptCitationReachChangeFromPreviousSampledMonthPercentagePoints =
          executionContextDelta(
            profile.ownedPromptCitationReachPercent,
            previous.ownedPromptCitationReachPercent
          );
        profile.equalPromptMeanOwnedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints =
          executionContextDelta(
            profile.equalPromptMeanOwnedCitationCoveragePercent,
            previous.equalPromptMeanOwnedCitationCoveragePercent
          );
      }
    });
    executionContextMonthlyProfiles.push(...series);
  }
  const retainedExecutionContextMonthlyProfiles = [...executionContextMonthlyProfiles]
    .sort(
      (left, right) =>
        right.month.localeCompare(left.month) ||
        right.observations - left.observations ||
        left.provider.localeCompare(right.provider) ||
        (left.model ?? '').localeCompare(right.model ?? '') ||
        (left.surface ?? '').localeCompare(right.surface ?? '') ||
        (left.locale ?? '').localeCompare(right.locale ?? '') ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '')
    )
    .slice(0, MAX_RETURNED_EXECUTION_CONTEXT_MONTHLY_PROFILES)
    .sort(
      (left, right) =>
        left.month.localeCompare(right.month) ||
        right.observations - left.observations ||
        left.provider.localeCompare(right.provider) ||
        (left.model ?? '').localeCompare(right.model ?? '') ||
        (left.surface ?? '').localeCompare(right.surface ?? '') ||
        (left.locale ?? '').localeCompare(right.locale ?? '') ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '')
    );
  const answerLengthContextCounts = new Map<
    string,
    {
      provider: string;
      providerKey: string;
      model?: string;
      modelKey?: string;
      surface?: string;
      surfaceKey?: string;
      locale?: string;
      localeKey?: string;
      topic?: string;
      topicKey?: string;
      intent?: string;
      intentKey?: string;
      observations: number;
      answerTextObservations: number;
    }
  >();
  const answerLengthBuckets = new Map<
    string,
    {
      contextKey: string;
      provider: string;
      model?: string;
      surface?: string;
      locale?: string;
      topic?: string;
      intent?: string;
      unlabeledTopicIntent: boolean;
      lengthBand: AiAnswerCitationAnswerLengthBand;
      minimumAnswerWords: number;
      maximumAnswerWords: number | null;
      prompts: Map<
        string,
        {
          observations: number;
          citations: number;
          ownedCitations: number;
          citationEvents: number;
          ownedCitationEvents: number;
          ownedFirstPositionCitationEvents: number;
          ownedTopThreeCitationEvents: number;
          ownedFirstCitationReciprocalRankSum: number;
          totalAnswerWords: number;
        }
      >;
      observations: number;
      observationsWithCitations: number;
      observationsWithOwnedCitation: number;
      citationEvents: number;
      ownedCitationEvents: number;
      ownedFirstPositionCitationEvents: number;
      ownedTopThreeCitationEvents: number;
      ownedFirstCitationReciprocalRankSum: number;
      totalAnswerWords: number;
      answerWordCounts: number[];
      firstObservedAt: string;
      lastObservedAt: string;
    }
  >();
  let answerLengthProfilesTruncated = false;
  for (const observation of observations) {
    const contextKey = JSON.stringify([
      observation.providerKey,
      observation.modelKey ?? '',
      observation.surfaceKey ?? '',
      observation.localeKey ?? '',
      observation.topicKey ?? '',
      observation.intentKey ?? '',
    ]);
    let context = answerLengthContextCounts.get(contextKey);
    if (!context && answerLengthContextCounts.size < MAX_ANSWER_LENGTH_PROFILE_WORKING_ROWS) {
      context = {
        provider: observation.provider,
        providerKey: observation.providerKey,
        ...(observation.model === undefined
          ? {}
          : { model: observation.model, modelKey: observation.modelKey }),
        ...(observation.surface === undefined
          ? {}
          : { surface: observation.surface, surfaceKey: observation.surfaceKey }),
        ...(observation.locale === undefined
          ? {}
          : { locale: observation.locale, localeKey: observation.localeKey }),
        ...(observation.topic === undefined
          ? {}
          : { topic: observation.topic, topicKey: observation.topicKey }),
        ...(observation.intent === undefined
          ? {}
          : { intent: observation.intent, intentKey: observation.intentKey }),
        observations: 0,
        answerTextObservations: 0,
      };
      answerLengthContextCounts.set(contextKey, context);
    }
    if (!context) {
      answerLengthProfilesTruncated = true;
      continue;
    }
    context.observations += 1;
    if (observation.answerText === undefined) continue;
    context.answerTextObservations += 1;
    const wordCount = observation.answerWordCount ?? 0;
    const band = answerLengthBand(wordCount);
    const key = JSON.stringify([contextKey, band.band]);
    let bucket = answerLengthBuckets.get(key);
    if (!bucket && answerLengthBuckets.size < MAX_ANSWER_LENGTH_PROFILE_WORKING_ROWS) {
      bucket = {
        contextKey,
        provider: context.provider,
        ...(context.model === undefined ? {} : { model: context.model }),
        ...(context.surface === undefined ? {} : { surface: context.surface }),
        ...(context.locale === undefined ? {} : { locale: context.locale }),
        ...(context.topic === undefined ? {} : { topic: context.topic }),
        ...(context.intent === undefined ? {} : { intent: context.intent }),
        unlabeledTopicIntent: context.topic === undefined && context.intent === undefined,
        lengthBand: band.band,
        minimumAnswerWords: band.minimum,
        maximumAnswerWords: band.maximum,
        prompts: new Map(),
        observations: 0,
        observationsWithCitations: 0,
        observationsWithOwnedCitation: 0,
        citationEvents: 0,
        ownedCitationEvents: 0,
        ownedFirstPositionCitationEvents: 0,
        ownedTopThreeCitationEvents: 0,
        ownedFirstCitationReciprocalRankSum: 0,
        totalAnswerWords: 0,
        answerWordCounts: [],
        firstObservedAt: observation.observedAt,
        lastObservedAt: observation.observedAt,
      };
      answerLengthBuckets.set(key, bucket);
    }
    if (!bucket) {
      answerLengthProfilesTruncated = true;
      continue;
    }
    const ownedCitations = observation.citations.filter(({ domain }) =>
      isOwnedDomain(domain, ownedDomains)
    );
    const ownedCitationEvents = ownedCitations.length;
    const ownedFirstPositionCitationEvents = ownedCitations.filter(
      ({ position }) => position === 1
    ).length;
    const ownedTopThreeCitationEvents = ownedCitations.filter(
      ({ position }) => position <= 3
    ).length;
    const ownedFirstCitationReciprocalRank =
      ownedCitations.length > 0
        ? 1 /
          ownedCitations.reduce(
            (firstPosition, citation) => Math.min(firstPosition, citation.position),
            Number.POSITIVE_INFINITY
          )
        : 0;
    bucket.observations += 1;
    bucket.observationsWithCitations += Number(observation.citations.length > 0);
    bucket.observationsWithOwnedCitation += Number(ownedCitationEvents > 0);
    bucket.citationEvents += observation.citations.length;
    bucket.ownedCitationEvents += ownedCitationEvents;
    bucket.ownedFirstPositionCitationEvents += ownedFirstPositionCitationEvents;
    bucket.ownedTopThreeCitationEvents += ownedTopThreeCitationEvents;
    bucket.ownedFirstCitationReciprocalRankSum += ownedFirstCitationReciprocalRank;
    bucket.totalAnswerWords += wordCount;
    bucket.answerWordCounts.push(wordCount);
    if (observation.observedAt < bucket.firstObservedAt)
      bucket.firstObservedAt = observation.observedAt;
    if (observation.observedAt > bucket.lastObservedAt)
      bucket.lastObservedAt = observation.observedAt;
    const prompt = bucket.prompts.get(observation.promptKey) ?? {
      observations: 0,
      citations: 0,
      ownedCitations: 0,
      citationEvents: 0,
      ownedCitationEvents: 0,
      ownedFirstPositionCitationEvents: 0,
      ownedTopThreeCitationEvents: 0,
      ownedFirstCitationReciprocalRankSum: 0,
      totalAnswerWords: 0,
    };
    prompt.observations += 1;
    prompt.citations += Number(observation.citations.length > 0);
    prompt.ownedCitations += Number(ownedCitationEvents > 0);
    prompt.citationEvents += observation.citations.length;
    prompt.ownedCitationEvents += ownedCitationEvents;
    prompt.ownedFirstPositionCitationEvents += ownedFirstPositionCitationEvents;
    prompt.ownedTopThreeCitationEvents += ownedTopThreeCitationEvents;
    prompt.ownedFirstCitationReciprocalRankSum += ownedFirstCitationReciprocalRank;
    prompt.totalAnswerWords += wordCount;
    bucket.prompts.set(observation.promptKey, prompt);
  }
  const answerLengthProfiles: AiAnswerCitationAnswerLengthProfile[] = [
    ...answerLengthBuckets.values(),
  ]
    .map((bucket) => {
      const context = answerLengthContextCounts.get(bucket.contextKey)!;
      const prompts = [...bucket.prompts.values()];
      const promptsWithCitations = prompts.filter(({ citations }) => citations > 0).length;
      const promptsWithOwnedCitation = prompts.filter(
        ({ ownedCitations }) => ownedCitations > 0
      ).length;
      const promptsWithOwnedCitationEvents = prompts.filter(
        ({ ownedCitationEvents }) => ownedCitationEvents > 0
      );
      const ownedFirstPositionPromptShares = promptsWithOwnedCitationEvents.map(
        ({ ownedFirstPositionCitationEvents, ownedCitationEvents }) =>
          (ownedFirstPositionCitationEvents / ownedCitationEvents) * 100
      );
      const ownedTopThreePromptShares = promptsWithOwnedCitationEvents.map(
        ({ ownedTopThreeCitationEvents, ownedCitationEvents }) =>
          (ownedTopThreeCitationEvents / ownedCitationEvents) * 100
      );
      const ownedFirstCitationPromptMrrValues = prompts
        .filter(({ ownedCitations }) => ownedCitations > 0)
        .map(
          ({ ownedFirstCitationReciprocalRankSum, ownedCitations }) =>
            (ownedFirstCitationReciprocalRankSum / ownedCitations) * 100
        );
      const promptDensityValues = prompts
        .filter(({ totalAnswerWords }) => totalAnswerWords > 0)
        .map(({ citationEvents, totalAnswerWords }) => (citationEvents / totalAnswerWords) * 100);
      const ownedPromptDensityValues = prompts
        .filter(({ totalAnswerWords }) => totalAnswerWords > 0)
        .map(
          ({ ownedCitationEvents, totalAnswerWords }) =>
            (ownedCitationEvents / totalAnswerWords) * 100
        );
      const metricSeed = JSON.stringify([
        bucket.provider,
        bucket.model ?? '',
        bucket.surface ?? '',
        bucket.locale ?? '',
        bucket.topic ?? '',
        bucket.intent ?? '',
        bucket.lengthBand,
      ]);
      return {
        provider: bucket.provider,
        ...(bucket.model === undefined ? {} : { model: bucket.model }),
        ...(bucket.surface === undefined ? {} : { surface: bucket.surface }),
        ...(bucket.locale === undefined ? {} : { locale: bucket.locale }),
        ...(bucket.topic === undefined ? {} : { topic: bucket.topic }),
        ...(bucket.intent === undefined ? {} : { intent: bucket.intent }),
        unlabeledTopicIntent: bucket.unlabeledTopicIntent,
        lengthBand: bucket.lengthBand,
        minimumAnswerWords: bucket.minimumAnswerWords,
        maximumAnswerWords: bucket.maximumAnswerWords,
        contextObservations: context.observations,
        answerTextObservationsInContext: context.answerTextObservations,
        answerTextShareInContextPercent: Number(
          ((context.answerTextObservations / context.observations) * 100).toFixed(2)
        ),
        observations: bucket.observations,
        uniquePrompts: prompts.length,
        observationsWithCitations: bucket.observationsWithCitations,
        citationCoveragePercent: Number(
          ((bucket.observationsWithCitations / bucket.observations) * 100).toFixed(2)
        ),
        citationCoverageConfidenceInterval95Percent: confidenceInterval95(
          bucket.observationsWithCitations,
          bucket.observations
        ),
        promptsWithCitations,
        promptCitationReachPercent: Number(
          ((promptsWithCitations / prompts.length) * 100).toFixed(2)
        ),
        promptCitationReachConfidenceInterval95Percent: confidenceInterval95(
          promptsWithCitations,
          prompts.length
        ),
        citationEvents: bucket.citationEvents,
        meanCitationEventsPerAnswer: Number(
          (bucket.citationEvents / bucket.observations).toFixed(2)
        ),
        promptsWithAnswerWords: promptDensityValues.length,
        equalPromptMeanCitationEventsPer100AnswerWords:
          promptDensityValues.length > 0
            ? Number(
                (
                  promptDensityValues.reduce((sum, value) => sum + value, 0) /
                  promptDensityValues.length
                ).toFixed(2)
              )
            : null,
        equalPromptMeanCitationEventsPer100AnswerWordsConfidenceInterval95:
          bootstrapMeanMetricConfidenceInterval95(
            promptDensityValues,
            `${metricSeed}:citation-density`
          ),
        totalAnswerWords: bucket.totalAnswerWords,
        meanAnswerWords: Number((bucket.totalAnswerWords / bucket.observations).toFixed(2)),
        medianAnswerWords: Number(median(bucket.answerWordCounts).toFixed(2)),
        citationEventsPer100AnswerWords:
          bucket.totalAnswerWords > 0
            ? Number(((bucket.citationEvents / bucket.totalAnswerWords) * 100).toFixed(2))
            : null,
        firstObservedAt: bucket.firstObservedAt,
        lastObservedAt: bucket.lastObservedAt,
        ...(ownedDomains.length > 0
          ? {
              observationsWithOwnedCitation: bucket.observationsWithOwnedCitation,
              ownedCitationCoveragePercent: Number(
                ((bucket.observationsWithOwnedCitation / bucket.observations) * 100).toFixed(2)
              ),
              ownedCitationCoverageConfidenceInterval95Percent: confidenceInterval95(
                bucket.observationsWithOwnedCitation,
                bucket.observations
              ),
              promptsWithOwnedCitation,
              ownedPromptCitationReachPercent: Number(
                ((promptsWithOwnedCitation / prompts.length) * 100).toFixed(2)
              ),
              ownedPromptCitationReachConfidenceInterval95Percent: confidenceInterval95(
                promptsWithOwnedCitation,
                prompts.length
              ),
              ownedCitationEvents: bucket.ownedCitationEvents,
              ownedCitationEventSharePercent:
                bucket.citationEvents > 0
                  ? Number(((bucket.ownedCitationEvents / bucket.citationEvents) * 100).toFixed(2))
                  : null,
              ownedFirstPositionCitationEvents: bucket.ownedFirstPositionCitationEvents,
              ownedFirstPositionCitationEventSharePercent:
                bucket.ownedCitationEvents > 0
                  ? Number(
                      (
                        (bucket.ownedFirstPositionCitationEvents / bucket.ownedCitationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              ownedTopThreeCitationEvents: bucket.ownedTopThreeCitationEvents,
              ownedTopThreeCitationEventSharePercent:
                bucket.ownedCitationEvents > 0
                  ? Number(
                      (
                        (bucket.ownedTopThreeCitationEvents / bucket.ownedCitationEvents) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              promptsWithOwnedCitationEvents: promptsWithOwnedCitationEvents.length,
              ownedFirstCitationMeanReciprocalRankPercent:
                bucket.observationsWithOwnedCitation > 0
                  ? Number(
                      (
                        (bucket.ownedFirstCitationReciprocalRankSum /
                          bucket.observationsWithOwnedCitation) *
                        100
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrPercent:
                ownedFirstCitationPromptMrrValues.length > 0
                  ? Number(
                      (
                        ownedFirstCitationPromptMrrValues.reduce((sum, value) => sum + value, 0) /
                        ownedFirstCitationPromptMrrValues.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedFirstCitationPromptMrrValues,
                  `${metricSeed}:owned-first-citation-mrr`
                ),
              equalPromptMeanOwnedFirstPositionSharePercent:
                ownedFirstPositionPromptShares.length > 0
                  ? Number(
                      (
                        ownedFirstPositionPromptShares.reduce((sum, value) => sum + value, 0) /
                        ownedFirstPositionPromptShares.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedFirstPositionShareConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedFirstPositionPromptShares,
                  `${metricSeed}:owned-first-position-share`
                ),
              equalPromptMeanOwnedTopThreeSharePercent:
                ownedTopThreePromptShares.length > 0
                  ? Number(
                      (
                        ownedTopThreePromptShares.reduce((sum, value) => sum + value, 0) /
                        ownedTopThreePromptShares.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedTopThreeShareConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedTopThreePromptShares,
                  `${metricSeed}:owned-top-three-share`
                ),
              equalPromptMeanOwnedCitationEventsPer100AnswerWords:
                ownedPromptDensityValues.length > 0
                  ? Number(
                      (
                        ownedPromptDensityValues.reduce((sum, value) => sum + value, 0) /
                        ownedPromptDensityValues.length
                      ).toFixed(2)
                    )
                  : null,
              equalPromptMeanOwnedCitationEventsPer100AnswerWordsConfidenceInterval95:
                bootstrapMeanMetricConfidenceInterval95(
                  ownedPromptDensityValues,
                  `${metricSeed}:owned-citation-density`
                ),
            }
          : {}),
      };
    })
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        left.provider.localeCompare(right.provider) ||
        (left.model ?? '').localeCompare(right.model ?? '') ||
        (left.surface ?? '').localeCompare(right.surface ?? '') ||
        (left.locale ?? '').localeCompare(right.locale ?? '') ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.minimumAnswerWords - right.minimumAnswerWords
    );
  answerLengthProfilesTruncated ||= answerLengthBuckets.size > MAX_RETURNED_ANSWER_LENGTH_PROFILES;
  const answerLengthPromptRankProfiles =
    ownedDomains.length > 0
      ? [...answerLengthBuckets.values()]
          .flatMap((bucket) =>
            [...bucket.prompts.entries()].map(
              ([promptKey, prompt]) =>
                ({
                  provider: bucket.provider,
                  ...(bucket.model === undefined ? {} : { model: bucket.model }),
                  ...(bucket.surface === undefined ? {} : { surface: bucket.surface }),
                  ...(bucket.locale === undefined ? {} : { locale: bucket.locale }),
                  ...(bucket.topic === undefined ? {} : { topic: bucket.topic }),
                  ...(bucket.intent === undefined ? {} : { intent: bucket.intent }),
                  unlabeledTopicIntent: bucket.unlabeledTopicIntent,
                  lengthBand: bucket.lengthBand,
                  promptFingerprint: createHash('sha256')
                    .update(`aviary:answer-length-prompt:v1\0${promptKey}`, 'utf8')
                    .digest('hex'),
                  observations: prompt.observations,
                  ownedCitationEvents: prompt.ownedCitationEvents,
                  ownedFirstPositionCitationEvents: prompt.ownedFirstPositionCitationEvents,
                  ownedTopThreeCitationEvents: prompt.ownedTopThreeCitationEvents,
                  ownedCitationObservations: prompt.ownedCitations,
                  ownedFirstCitationReciprocalRankSum: prompt.ownedFirstCitationReciprocalRankSum,
                }) satisfies AiAnswerCitationAnswerLengthPromptRankProfile
            )
          )
          .sort(
            (left, right) =>
              left.provider.localeCompare(right.provider) ||
              (left.model ?? '').localeCompare(right.model ?? '') ||
              (left.surface ?? '').localeCompare(right.surface ?? '') ||
              (left.locale ?? '').localeCompare(right.locale ?? '') ||
              (left.topic ?? '').localeCompare(right.topic ?? '') ||
              (left.intent ?? '').localeCompare(right.intent ?? '') ||
              left.lengthBand.localeCompare(right.lengthBand) ||
              left.promptFingerprint.localeCompare(right.promptFingerprint)
          )
      : undefined;
  const answerLengthPromptRankProfilesTruncated =
    ownedDomains.length > 0 &&
    (answerLengthProfilesTruncated ||
      (answerLengthPromptRankProfiles?.length ?? 0) >
        MAX_RETURNED_ANSWER_LENGTH_PROMPT_RANK_PROFILES);
  const retainedAnswerLengthPromptRankProfiles = answerLengthPromptRankProfiles?.slice(
    0,
    MAX_RETURNED_ANSWER_LENGTH_PROMPT_RANK_PROFILES
  );
  const answerLengthMonthlyAggregation = [...answerLengthContextCounts.values()].some(
    ({ answerTextObservations }) => answerTextObservations > 0
  )
    ? buildAnswerLengthMonthlyProfiles(observations, ownedDomains)
    : { profiles: [], truncated: false };
  const answerLengthSeriesKey = (profile: AiAnswerCitationAnswerLengthProfile): string =>
    JSON.stringify([
      profile.provider.normalize('NFKC').toLocaleLowerCase('en-US'),
      profile.model?.normalize('NFKC').toLocaleLowerCase('en-US') ?? '',
      profile.surface?.normalize('NFKC').toLocaleLowerCase('en-US') ?? '',
      profile.locale?.normalize('NFKC').toLocaleLowerCase('en-US') ?? '',
      profile.topic?.normalize('NFKC').toLocaleLowerCase('en-US') ?? '',
      profile.intent?.normalize('NFKC').toLocaleLowerCase('en-US') ?? '',
      profile.unlabeledTopicIntent,
      profile.lengthBand,
    ]);
  const answerLengthDelta = (
    currentValue: number | null | undefined,
    previousValue: number | null | undefined
  ): number | null =>
    typeof currentValue === 'number' && typeof previousValue === 'number'
      ? Number((currentValue - previousValue).toFixed(2))
      : null;
  const answerLengthMonthlyBySeries = new Map<
    string,
    AiAnswerCitationAnswerLengthMonthlyProfile[]
  >();
  for (const profile of answerLengthMonthlyAggregation.profiles) {
    const monthly: AiAnswerCitationAnswerLengthMonthlyProfile = {
      ...profile,
      month: profile.month,
      previousSampledMonth: null,
      interveningUnsampledCalendarMonths: 0,
      citationCoverageChangeFromPreviousSampledMonthPercentagePoints: null,
      promptCitationReachChangeFromPreviousSampledMonthPercentagePoints: null,
      citationEventsPer100AnswerWordsChangeFromPreviousSampledMonth: null,
      equalPromptMeanCitationEventsPer100AnswerWordsChangeFromPreviousSampledMonth: null,
      ...(ownedDomains.length > 0
        ? {
            ownedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints: null,
            ownedPromptCitationReachChangeFromPreviousSampledMonthPercentagePoints: null,
            ownedCitationEventShareChangeFromPreviousSampledMonthPercentagePoints: null,
            equalPromptMeanOwnedCitationEventsPer100AnswerWordsChangeFromPreviousSampledMonth: null,
            ownedFirstPositionCitationEventShareChangeFromPreviousSampledMonthPercentagePoints:
              null,
            ownedTopThreeCitationEventShareChangeFromPreviousSampledMonthPercentagePoints: null,
            equalPromptMeanOwnedFirstPositionShareChangeFromPreviousSampledMonthPercentagePoints:
              null,
            equalPromptMeanOwnedTopThreeShareChangeFromPreviousSampledMonthPercentagePoints: null,
            equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints:
              null,
          }
        : {}),
    };
    const key = answerLengthSeriesKey(profile);
    const series = answerLengthMonthlyBySeries.get(key) ?? [];
    series.push(monthly);
    answerLengthMonthlyBySeries.set(key, series);
  }
  const answerLengthMonthlyProfiles: AiAnswerCitationAnswerLengthMonthlyProfile[] = [];
  for (const series of answerLengthMonthlyBySeries.values()) {
    series.sort((left, right) => left.month.localeCompare(right.month));
    series.forEach((profile, index) => {
      const previous = series[index - 1];
      if (!previous) return;
      profile.previousSampledMonth = previous.month;
      profile.interveningUnsampledCalendarMonths = Math.max(
        0,
        executionContextMonthOrdinal(profile.month) -
          executionContextMonthOrdinal(previous.month) -
          1
      );
      profile.citationCoverageChangeFromPreviousSampledMonthPercentagePoints = answerLengthDelta(
        profile.citationCoveragePercent,
        previous.citationCoveragePercent
      );
      profile.promptCitationReachChangeFromPreviousSampledMonthPercentagePoints = answerLengthDelta(
        profile.promptCitationReachPercent,
        previous.promptCitationReachPercent
      );
      profile.citationEventsPer100AnswerWordsChangeFromPreviousSampledMonth = answerLengthDelta(
        profile.citationEventsPer100AnswerWords,
        previous.citationEventsPer100AnswerWords
      );
      profile.equalPromptMeanCitationEventsPer100AnswerWordsChangeFromPreviousSampledMonth =
        answerLengthDelta(
          profile.equalPromptMeanCitationEventsPer100AnswerWords,
          previous.equalPromptMeanCitationEventsPer100AnswerWords
        );
      if (ownedDomains.length > 0) {
        profile.ownedCitationCoverageChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.ownedCitationCoveragePercent,
            previous.ownedCitationCoveragePercent
          );
        profile.ownedPromptCitationReachChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.ownedPromptCitationReachPercent,
            previous.ownedPromptCitationReachPercent
          );
        profile.ownedCitationEventShareChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.ownedCitationEventSharePercent,
            previous.ownedCitationEventSharePercent
          );
        profile.equalPromptMeanOwnedCitationEventsPer100AnswerWordsChangeFromPreviousSampledMonth =
          answerLengthDelta(
            profile.equalPromptMeanOwnedCitationEventsPer100AnswerWords,
            previous.equalPromptMeanOwnedCitationEventsPer100AnswerWords
          );
        profile.ownedFirstPositionCitationEventShareChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.ownedFirstPositionCitationEventSharePercent,
            previous.ownedFirstPositionCitationEventSharePercent
          );
        profile.ownedTopThreeCitationEventShareChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.ownedTopThreeCitationEventSharePercent,
            previous.ownedTopThreeCitationEventSharePercent
          );
        profile.equalPromptMeanOwnedFirstPositionShareChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.equalPromptMeanOwnedFirstPositionSharePercent,
            previous.equalPromptMeanOwnedFirstPositionSharePercent
          );
        profile.equalPromptMeanOwnedTopThreeShareChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.equalPromptMeanOwnedTopThreeSharePercent,
            previous.equalPromptMeanOwnedTopThreeSharePercent
          );
        profile.equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints =
          answerLengthDelta(
            profile.equalPromptMeanOwnedFirstCitationMrrPercent,
            previous.equalPromptMeanOwnedFirstCitationMrrPercent
          );
      }
    });
    answerLengthMonthlyProfiles.push(...series);
  }
  const retainedAnswerLengthMonthlyProfiles = [...answerLengthMonthlyProfiles]
    .sort(
      (left, right) =>
        right.month.localeCompare(left.month) ||
        right.observations - left.observations ||
        left.provider.localeCompare(right.provider)
    )
    .slice(0, MAX_RETURNED_ANSWER_LENGTH_PROFILES)
    .sort(
      (left, right) =>
        left.month.localeCompare(right.month) ||
        left.provider.localeCompare(right.provider) ||
        (left.model ?? '').localeCompare(right.model ?? '') ||
        (left.surface ?? '').localeCompare(right.surface ?? '') ||
        (left.locale ?? '').localeCompare(right.locale ?? '') ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.minimumAnswerWords - right.minimumAnswerWords
    );
  const answerLengthMonthlyProfilesTruncated =
    answerLengthMonthlyAggregation.truncated ||
    answerLengthMonthlyProfiles.length > MAX_RETURNED_ANSWER_LENGTH_PROFILES;

  const repeatedPrompts = [...promptBuckets.values()].filter(
    ({ observations: promptObservations }) => promptObservations > 1
  ).length;
  const ownedCitationEvents = [...domainBuckets.entries()]
    .filter(([domain]) => isOwnedDomain(domain, ownedDomains))
    .reduce((sum, [, bucket]) => sum + bucket.citationEvents, 0);
  const unknownOwnedObservations = observations.filter(
    (observation) =>
      !observation.citationListComplete &&
      !observation.citations.some(({ domain }) => isOwnedDomain(domain, ownedDomains))
  ).length;
  const promptsWithOwnedCitation = [...promptBuckets.values()].filter(
    ({ withOwnedCitation }) => withOwnedCitation > 0
  ).length;
  const unknownOwnedPrompts = [...promptBuckets.values()].filter(
    (prompt) => prompt.withOwnedCitation === 0 && prompt.incompleteCitationLists > 0
  ).length;
  const knownOwnedPrompts = promptBuckets.size - unknownOwnedPrompts;
  return {
    source: 'Aviary observed AI answer citation analysis',
    schemaVersion: 1,
    analyzedAt: new Date(analyzedAt).toISOString(),
    ownedDomains,
    summary: {
      observations: observations.length,
      uniqueProviders: providerBuckets.size,
      uniquePrompts: promptBuckets.size,
      repeatedPrompts,
      observationsWithCitations,
      observationsWithoutCitations,
      incompleteCitationListObservations: observations.filter(
        (observation) => !observation.citationListComplete
      ).length,
      ...(ownedDomains.length > 0
        ? {
            observationsWithKnownOwnedCitationState: observations.length - unknownOwnedObservations,
            observationsWithUnknownOwnedCitationState: unknownOwnedObservations,
          }
        : {}),
      citationEvents,
      domainConcentration: summarizeDomainConcentration(
        [...domainBuckets.values()].map(({ citationEvents: events }) => events),
        citationEvents
      ),
      distinctCitedDomains: domainBuckets.size,
      distinctCitedUrls: pageBuckets.size,
      duplicateCitationUrlsDropped,
      labeledObservations,
      unlabeledObservations,
      topicLabels: topicLabels.size,
      intentLabels: intentLabels.size,
      ...(ownedDomains.length > 0
        ? {
            observationsWithOwnedCitation,
            observationsWithoutOwnedCitation,
            ownedCitationCoveragePercent: Number(
              ((observationsWithOwnedCitation / observations.length) * 100).toFixed(2)
            ),
            ownedCitationCoverageAmongKnownObservationsPercent:
              observations.length > unknownOwnedObservations
                ? Number(
                    (
                      (observationsWithOwnedCitation /
                        (observations.length - unknownOwnedObservations)) *
                      100
                    ).toFixed(2)
                  )
                : null,
            ownedCitationCoverageUpperBoundPercent: Number(
              (
                ((observationsWithOwnedCitation + unknownOwnedObservations) / observations.length) *
                100
              ).toFixed(2)
            ),
            promptsWithOwnedCitation,
            ownedCitationPromptCoveragePercent:
              promptBuckets.size > 0
                ? Number(((promptsWithOwnedCitation / promptBuckets.size) * 100).toFixed(2))
                : 0,
            promptsWithKnownOwnedCitationState: knownOwnedPrompts,
            promptsWithUnknownOwnedCitationState: unknownOwnedPrompts,
            ownedCitationPromptCoverageAmongKnownPromptsPercent:
              knownOwnedPrompts > 0
                ? Number(((promptsWithOwnedCitation / knownOwnedPrompts) * 100).toFixed(2))
                : null,
            ownedCitationPromptCoverageUpperBoundPercent:
              promptBuckets.size > 0
                ? Number(
                    (
                      ((promptsWithOwnedCitation + unknownOwnedPrompts) / promptBuckets.size) *
                      100
                    ).toFixed(2)
                  )
                : 0,
            ownedCitationPromptCoverageAmongKnownPromptsConfidenceInterval95Percent:
              wilsonRateConfidenceInterval95(promptsWithOwnedCitation, knownOwnedPrompts),
            ownedCitationPromptCoverageConfidenceInterval95Percent: wilsonRateConfidenceInterval95(
              promptsWithOwnedCitation,
              promptBuckets.size
            ),
            ownedCitationEvents,
            ownedCitationEventSharePercent:
              citationEvents > 0
                ? Number(((ownedCitationEvents! / citationEvents) * 100).toFixed(2))
                : null,
            ownedFirstCitationMeanReciprocalRankPercent:
              observationsWithOwnedCitation > 0
                ? Number(
                    (
                      (ownedFirstCitationReciprocalRankSum / observationsWithOwnedCitation) *
                      100
                    ).toFixed(2)
                  )
                : null,
            ownedCitationPositionBuckets: summarizeOwnedCitationPositionBuckets(
              ownedPositionBucketCounters
            ),
            promptsWithNoOwnedCitation: [...promptBuckets.values()].filter(
              ({ withOwnedCitation }) => withOwnedCitation === 0
            ).length,
          }
        : {}),
    },
    ...(coCitationSummary ? { coCitationSummary, coCitationDomains: coCitationDomains ?? [] } : {}),
    providers,
    domains: domains.slice(0, 250),
    domainsTruncated: domains.length > 250,
    citedPages: citedPages.slice(0, 1_000),
    citedPagesTruncated: citedPages.length > 1_000,
    prompts: prompts.slice(0, 2_000),
    promptsTruncated: prompts.length > 2_000,
    reviewQueue: reviewQueue.slice(0, 250),
    reviewQueueTruncated: reviewQueue.length > 250,
    monthly,
    topicIntentProviderMonthly: topicIntentProviderMonthly
      .slice(-MAX_RETURNED_COHORT_MONTHLY_ROWS)
      .sort(
        (left, right) =>
          left.month.localeCompare(right.month) ||
          (left.topic ?? '').localeCompare(right.topic ?? '') ||
          (left.intent ?? '').localeCompare(right.intent ?? '') ||
          left.provider.localeCompare(right.provider)
      ),
    topicIntentProviderMonthlyTruncated:
      topicIntentProviderMonthly.length > MAX_RETURNED_COHORT_MONTHLY_ROWS,
    topicIntentCohorts: topicIntentCohorts.slice(0, 500),
    topicIntentCohortsTruncated: topicIntentCohorts.length > 500,
    ...(hasExecutionContextLabels
      ? {
          executionContextProfiles: executionContextProfiles.slice(
            0,
            MAX_RETURNED_EXECUTION_CONTEXT_PROFILES
          ),
          executionContextProfilesTruncated:
            executionContextProfiles.length > MAX_RETURNED_EXECUTION_CONTEXT_PROFILES,
          executionContextMonthlyProfiles: retainedExecutionContextMonthlyProfiles,
          executionContextMonthlyProfilesTruncated:
            executionContextMonthlyProfiles.length >
            MAX_RETURNED_EXECUTION_CONTEXT_MONTHLY_PROFILES,
        }
      : {}),
    ...(answerLengthContextCounts.size > 0 &&
    [...answerLengthContextCounts.values()].some(
      ({ answerTextObservations }) => answerTextObservations > 0
    )
      ? {
          answerLengthProfiles: answerLengthProfiles.slice(0, MAX_RETURNED_ANSWER_LENGTH_PROFILES),
          answerLengthProfilesTruncated,
          ...(ownedDomains.length > 0
            ? {
                answerLengthPromptRankProfiles: retainedAnswerLengthPromptRankProfiles ?? [],
                answerLengthPromptRankProfilesTruncated,
              }
            : {}),
          answerLengthMonthlyProfiles: retainedAnswerLengthMonthlyProfiles,
          answerLengthMonthlyProfilesTruncated,
        }
      : {}),
    topicIntentProviderPairComparisons: providerPairComparisons.slice(
      0,
      MAX_RETURNED_PROVIDER_PAIR_ROWS
    ),
    topicIntentProviderPairComparisonsTruncated:
      providerPairComparisons.length > MAX_RETURNED_PROVIDER_PAIR_ROWS,
    providerSampleMixComparisons: providerSampleMixComparisons.slice(
      0,
      MAX_RETURNED_SAMPLE_MIX_ROWS
    ),
    providerSampleMixComparisonsTruncated:
      providerSampleMixComparisons.length > MAX_RETURNED_SAMPLE_MIX_ROWS,
    temporalStabilityProfiles: temporalStabilityProfiles.slice(
      0,
      MAX_RETURNED_TEMPORAL_STABILITY_ROWS
    ),
    temporalStabilityProfilesTruncated:
      temporalStabilityProfiles.length > MAX_RETURNED_TEMPORAL_STABILITY_ROWS,
    sourcePersistenceProfiles: sourcePersistenceProfiles.slice(
      0,
      MAX_RETURNED_SOURCE_PERSISTENCE_PROFILES
    ),
    sourcePersistenceProfilesTruncated,
    sourcePersistenceProfilesAvailable: sortedSourcePersistenceStats.length,
    sourcePersistenceWorkingProfileCap: MAX_SOURCE_PERSISTENCE_WORKING_PROFILES,
    sourcePersistenceTimestampCheckBudget: MAX_SOURCE_PERSISTENCE_TIMESTAMP_CHECKS,
    sourcePersistenceTimestampChecksPerformed,
    sourcePersistenceBootstrapUpdateBudget: MAX_SOURCE_PERSISTENCE_BOOTSTRAP_UPDATES,
    sourcePersistenceBootstrapUpdatesPerformed,
    sourcePersistenceBootstrapWorkTruncated,
    sourcePersistenceOutputProfileCap: MAX_RETURNED_SOURCE_PERSISTENCE_PROFILES,
    sourcePersistenceWorkTruncated: sourcePersistenceWorkTruncated,
    ...(citationUrlPersistenceProfiles
      ? {
          citationUrlPersistenceProfiles,
          citationUrlPersistenceProfilesTruncated,
          citationUrlPersistenceProfilesAvailable,
          citationUrlPersistenceWorkingProfileCap: MAX_CITATION_URL_PERSISTENCE_WORKING_PROFILES,
          citationUrlPersistenceTimestampCheckBudget: MAX_CITATION_URL_PERSISTENCE_TIMESTAMP_CHECKS,
          citationUrlPersistenceTimestampChecksPerformed,
          citationUrlPersistenceOutputProfileCap: MAX_RETURNED_CITATION_URL_PERSISTENCE_PROFILES,
          citationUrlPersistenceWorkTruncated,
        }
      : {}),
    ...(answerEntities.length > 0 ? { entityMentionProfiles } : {}),
    ...(answerEntities.length > 0
      ? {
          entityPromptProfiles: retainedEntityPromptProfiles,
          entityPromptProfilesTruncated,
          entityPromptProviderPairComparisons: entityPromptProviderPairComparisons.slice(
            0,
            MAX_RETURNED_ENTITY_PROMPT_PROVIDER_PAIRS
          ),
          entityPromptProviderPairComparisonsTruncated:
            entityPromptProviderPairComparisonsTruncated,
        }
      : {}),
    ...(answerEntities.length > 1
      ? {
          entityCoMentionProfiles: entityCoMentionProfiles.slice(
            0,
            MAX_RETURNED_ENTITY_CO_MENTION_PROFILES
          ),
          entityCoMentionProfilesTruncated:
            entityCoMentionProfiles.length > MAX_RETURNED_ENTITY_CO_MENTION_PROFILES,
        }
      : {}),
    ...(answerEntities.length > 0
      ? {
          entityMentionMonthlyProfiles: entityMentionMonthlyRows
            .slice(0, MAX_RETURNED_ENTITY_MENTION_MONTHLY_ROWS)
            .sort(
              (left, right) =>
                left.month.localeCompare(right.month) ||
                left.entity.localeCompare(right.entity) ||
                left.provider.localeCompare(right.provider) ||
                (left.topic ?? '').localeCompare(right.topic ?? '') ||
                (left.intent ?? '').localeCompare(right.intent ?? '')
            ),
          entityMentionMonthlyProfilesTruncated:
            entityMentionMonthlyRows.length > MAX_RETURNED_ENTITY_MENTION_MONTHLY_ROWS,
        }
      : {}),
    ...(answerEntities.length > 0 && ownedDomains.length > 0
      ? {
          entityMentionOpportunities: entityMentionOpportunityRows.slice(
            0,
            MAX_RETURNED_ENTITY_MENTION_OPPORTUNITIES
          ),
          entityMentionOpportunitiesTruncated:
            entityMentionOpportunityRows.length > MAX_RETURNED_ENTITY_MENTION_OPPORTUNITIES,
        }
      : {}),
    ...(answerEntities.length > 0
      ? {
          entityCitationPageAssociations: entityCitationPageAssociations.slice(
            0,
            MAX_RETURNED_ENTITY_CITATION_PAGE_PROFILES
          ),
          entityCitationPageAssociationsTruncated: entityCitationPageAssociationsTruncated,
          entityCitationPageMonthlyAssociations: entityCitationPageMonthlyAssociations.slice(
            0,
            MAX_RETURNED_ENTITY_CITATION_PAGE_MONTHLY_PROFILES
          ),
          entityCitationPageMonthlyAssociationsTruncated:
            entityCitationPageMonthlyAssociationsTruncated,
        }
      : {}),
    ...(pathFamilyDepth !== undefined && answerEntities.length > 0
      ? {
          entityPathFamilyAssociations: entityPathFamilyAssociations.slice(
            0,
            MAX_RETURNED_ENTITY_PATH_FAMILY_PROFILES
          ),
          entityPathFamilyAssociationsTruncated:
            entityPathFamilyAssociationsTruncated ||
            entityPathFamilyAssociations.length > MAX_RETURNED_ENTITY_PATH_FAMILY_PROFILES,
          entityPathFamilyMonthlyAssociations: [...entityPathFamilyMonthlyAssociations]
            .sort(
              (left, right) =>
                right.month.localeCompare(left.month) ||
                right.whenMentioned.citationEvents +
                  right.whenNotMentioned.citationEvents -
                  (left.whenMentioned.citationEvents + left.whenNotMentioned.citationEvents)
            )
            .slice(0, MAX_RETURNED_ENTITY_PATH_FAMILY_MONTHLY_PROFILES)
            .sort(
              (left, right) =>
                left.month.localeCompare(right.month) ||
                Math.abs(right.observationCoverageDifferencePercentagePoints ?? 0) -
                  Math.abs(left.observationCoverageDifferencePercentagePoints ?? 0) ||
                right.whenMentioned.citationEvents +
                  right.whenNotMentioned.citationEvents -
                  (left.whenMentioned.citationEvents + left.whenNotMentioned.citationEvents)
            ),
          entityPathFamilyMonthlyAssociationsTruncated:
            entityPathFamilyMonthlyAssociationsTruncated ||
            entityPathFamilyMonthlyAssociations.length >
              MAX_RETURNED_ENTITY_PATH_FAMILY_MONTHLY_PROFILES,
        }
      : {}),
    ...(pathFamilyDepth !== undefined
      ? {
          pathFamilyDepth,
          pathFamilyCount: pathFamilies.length,
          pathFamilies: pathFamilies.slice(0, MAX_RETURNED_ANSWER_PATH_FAMILIES),
          pathFamiliesTruncated: pathFamilies.length > MAX_RETURNED_ANSWER_PATH_FAMILIES,
          pathFamilyCohorts: pathFamilyCohorts.slice(0, MAX_RETURNED_ANSWER_PATH_FAMILY_COHORTS),
          pathFamilyCohortsTruncated:
            pathFamilyCohortBucketsTruncated ||
            pathFamilyCohorts.length > MAX_RETURNED_ANSWER_PATH_FAMILY_COHORTS,
          pathFamilyMonthlyCohorts: pathFamilyMonthlyCohorts.slice(
            0,
            MAX_RETURNED_ANSWER_PATH_FAMILY_MONTHLY_COHORTS
          ),
          pathFamilyMonthlyCohortsTruncated:
            pathFamilyMonthlyCohortBucketsTruncated ||
            pathFamilyMonthlyCohorts.length > MAX_RETURNED_ANSWER_PATH_FAMILY_MONTHLY_COHORTS,
        }
      : {}),
    note: `These are manually supplied answer snapshots, not a random or representative sample of prompts. Citation coverage, URL/domain shares, prompt repetition, topic/intent cohorts, and the review queue describe only the supplied observations and configured owned domains. Topic and intent labels are operator-supplied; Aviary does not classify prompts. Model, surface, and locale labels are operator-recorded metadata; Aviary does not detect or verify the serving configuration. Prompt groups use exact text after case and whitespace normalization; paraphrases are not merged. A missing citation is unknown coverage, not evidence that a provider omitted every source. No raw answerText is stored in this report; when supplied, its approximate Unicode word counts are retained only in aggregate length-band profiles${ownedDomains.length > 0 && answerLengthPromptRankProfiles ? '; owned answer-length prompt-rank rows use stable SHA-256 fingerprints of normalized exact prompts, which are pseudonymous identifiers rather than anonymization' : ''}${answerEntities.length > 0 ? ', and configured exact entity aliases are scanned locally for aggregate mention/citation counts' : ''}. Citation URL query strings and fragments are removed before analysis, and duplicate normalized URLs within one observation count once. Source-persistence rows compare a domain only from a sampled timestamp where it was present to the next distinct timestamp in the same provider, normalized prompt, and recorded model/surface/locale/topic/intent context. Simultaneous captures are combined as presence if any capture cites the domain. ${options.includeCitationUrlPersistence ? 'Optional citation-URL persistence profiles apply the same simultaneous-capture and next-timestamp rules to normalized page URLs, with separately bounded work and output.' : ''} The next-timestamp retention share describes these captured transitions only; follow-up interval bands stratify that same sampled transition by elapsed time between captures. Neither measure is continuous-time survival, future persistence, or a quality measure, and citation-list completeness is carried through persistence, temporal-stability, and matched-period summaries; censored absences are not counted as confirmed losses.${pathFamilyDepth === undefined ? '' : ` Optional path-family profiles group each cited URL by origin and its first ${pathFamilyDepth} non-empty path segments; the top ${MAX_RETURNED_ANSWER_PATH_FAMILIES.toLocaleString('en-US')} groups are retained overall, with up to ${MAX_RETURNED_ANSWER_PATH_FAMILY_COHORTS.toLocaleString('en-US')} provider/topic/intent rows and ${MAX_RETURNED_ANSWER_PATH_FAMILY_MONTHLY_COHORTS.toLocaleString('en-US')} monthly rows. Each cross-tab has a 20,000-row aggregation working cap and reports truncation.`}${pathFamilyDepth !== undefined && answerEntities.length > 0 ? ` Entity/path-family associations compare family coverage in answer-text observations with and without each configured exact entity mention. Overall and UTC-month tables retain up to ${MAX_RETURNED_ENTITY_PATH_FAMILY_PROFILES.toLocaleString('en-US')} and ${MAX_RETURNED_ENTITY_PATH_FAMILY_MONTHLY_PROFILES.toLocaleString('en-US')} rows respectively; the monthly output prioritizes the newest months. They have separate 20,000 entity/provider/cohort and family working caps.` : ''}${answerEntities.length > 0 ? ` Exact-page entity associations compare citation coverage and source placement in answer-text samples with and without configured literal mentions; monthly rows use UTC dates and all detail is bounded. Exact prompt/provider/entity profiles add prompt-level mention, citation coverage, and optional owned-source placement; at most ${MAX_RETURNED_ENTITY_PROMPT_PROFILES.toLocaleString('en-US')} rows are returned from a ${MAX_ENTITY_PROMPT_PROFILE_WORKING_ROWS.toLocaleString('en-US')}-row working cap, with truncation reported. Provider-pair profiles compare rates only on shared exact entity/prompt groups; answer-text omissions remain in support counts but out of rate denominators. Pair work and output rows are capped and exposed through entityPromptProviderPairComparisonsTruncated.` : ''}${hasExecutionContextLabels ? ` Execution-context profiles split rates by operator-recorded labels; monthly profiles use UTC months and compare each context with its prior sampled month. Context and monthly caps are explicit.` : ''} This report does not call AI providers, infer rankings, measure citation quality, or establish causation.`,
  };
}

function ownedTopThreeCitationPositionShare(
  summary: AiAnswerCitationObservationReport['summary']
): number | null {
  const ownedCitationEvents = summary.ownedCitationEvents;
  const buckets = summary.ownedCitationPositionBuckets;
  if (ownedCitationEvents === undefined || ownedCitationEvents === 0 || buckets === undefined)
    return null;
  const topThreeOwnedEvents = buckets
    .filter(({ range }) => range === '1' || range === '2' || range === '3')
    .reduce((sum, bucket) => sum + bucket.ownedCitationEvents, 0);
  return Number(((topThreeOwnedEvents / ownedCitationEvents) * 100).toFixed(2));
}

function compareOwnedCitationPositionBuckets(
  baseline: AiAnswerCitationObservationReport['summary'],
  current: AiAnswerCitationObservationReport['summary']
): AiAnswerCitationOwnedPositionBucketPeriodChange[] | undefined {
  const beforeBuckets = baseline.ownedCitationPositionBuckets;
  const afterBuckets = current.ownedCitationPositionBuckets;
  if (!beforeBuckets || !afterBuckets) return undefined;
  return CITATION_POSITION_BUCKET_RANGES.map((range) => {
    const before = beforeBuckets.find((bucket) => bucket.range === range);
    const after = afterBuckets.find((bucket) => bucket.range === range);
    const delta = (
      left: number | null | undefined,
      right: number | null | undefined
    ): number | null =>
      left === null || left === undefined || right === null || right === undefined
        ? null
        : Number((right - left).toFixed(2));
    return {
      range,
      baselineOwnedCitationEvents: before?.ownedCitationEvents ?? null,
      baselineOwnedCitationEventSharePercent: before?.ownedCitationEventSharePercent ?? null,
      baselineCitationEvents: before?.citationEvents ?? null,
      baselineOwnedShareWithinPositionPercent: before?.ownedShareWithinPositionPercent ?? null,
      currentOwnedCitationEvents: after?.ownedCitationEvents ?? null,
      currentOwnedCitationEventSharePercent: after?.ownedCitationEventSharePercent ?? null,
      currentCitationEvents: after?.citationEvents ?? null,
      currentOwnedShareWithinPositionPercent: after?.ownedShareWithinPositionPercent ?? null,
      ownedCitationEventShareChangePercentagePoints: delta(
        before?.ownedCitationEventSharePercent,
        after?.ownedCitationEventSharePercent
      ),
      ownedShareWithinPositionChangePercentagePoints: delta(
        before?.ownedShareWithinPositionPercent,
        after?.ownedShareWithinPositionPercent
      ),
    };
  });
}

/** Compare retained exact prompt/provider cohorts from two manually collected answer snapshots. */
export function compareAiAnswerCitationObservationPeriods(
  baseline: AiAnswerCitationObservationReport,
  current: AiAnswerCitationObservationReport
): AiAnswerCitationObservationPeriodComparison {
  if (
    baseline.source !== 'Aviary observed AI answer citation analysis' ||
    current.source !== 'Aviary observed AI answer citation analysis' ||
    baseline.schemaVersion !== 1 ||
    current.schemaVersion !== 1
  ) {
    throw new Error(
      'Answer-citation period comparison requires two version 1 Aviary observation reports.'
    );
  }
  if (
    JSON.stringify([...baseline.ownedDomains].sort()) !==
    JSON.stringify([...current.ownedDomains].sort())
  ) {
    throw new Error(
      'Answer-citation period comparison requires the same owned-domain configuration in both samples.'
    );
  }
  const ownedCitationCoverageComparison: AiAnswerCitationOwnedCoveragePeriodComparison | undefined =
    baseline.summary.ownedCitationCoveragePercent !== undefined &&
    current.summary.ownedCitationCoveragePercent !== undefined &&
    baseline.summary.observationsWithOwnedCitation !== undefined &&
    current.summary.observationsWithOwnedCitation !== undefined &&
    baseline.summary.ownedCitationEvents !== undefined &&
    current.summary.ownedCitationEvents !== undefined
      ? {
          baselineObservations: baseline.summary.observations,
          currentObservations: current.summary.observations,
          baselineObservationsWithOwnedCitation: baseline.summary.observationsWithOwnedCitation,
          currentObservationsWithOwnedCitation: current.summary.observationsWithOwnedCitation,
          baselineOwnedCitationCoveragePercent: baseline.summary.ownedCitationCoveragePercent,
          currentOwnedCitationCoveragePercent: current.summary.ownedCitationCoveragePercent,
          ownedCitationCoverageDeltaPercentagePoints: Number(
            (
              current.summary.ownedCitationCoveragePercent -
              baseline.summary.ownedCitationCoveragePercent
            ).toFixed(2)
          ),
          baselineOwnedCitationEvents: baseline.summary.ownedCitationEvents,
          currentOwnedCitationEvents: current.summary.ownedCitationEvents,
          baselineOwnedCitationEventSharePercent:
            baseline.summary.ownedCitationEventSharePercent ?? null,
          currentOwnedCitationEventSharePercent:
            current.summary.ownedCitationEventSharePercent ?? null,
          ownedCitationEventShareDeltaPercentagePoints:
            baseline.summary.ownedCitationEventSharePercent === undefined ||
            current.summary.ownedCitationEventSharePercent === undefined ||
            baseline.summary.ownedCitationEventSharePercent === null ||
            current.summary.ownedCitationEventSharePercent === null
              ? null
              : Number(
                  (
                    current.summary.ownedCitationEventSharePercent -
                    baseline.summary.ownedCitationEventSharePercent
                  ).toFixed(2)
                ),
          baselineOwnedTopThreePositionSharePercent: ownedTopThreeCitationPositionShare(
            baseline.summary
          ),
          currentOwnedTopThreePositionSharePercent: ownedTopThreeCitationPositionShare(
            current.summary
          ),
          ownedTopThreePositionShareDeltaPercentagePoints: (() => {
            const before = ownedTopThreeCitationPositionShare(baseline.summary);
            const after = ownedTopThreeCitationPositionShare(current.summary);
            return before === null || after === null ? null : Number((after - before).toFixed(2));
          })(),
          ownedCitationPositionBucketChanges: compareOwnedCitationPositionBuckets(
            baseline.summary,
            current.summary
          ),
        }
      : undefined;
  const baselineEntityProfiles = baseline.entityMentionProfiles ?? [];
  const currentEntityProfiles = current.entityMentionProfiles ?? [];
  const entityConfiguration = (profiles: AiAnswerCitationEntityMentionProfile[]) =>
    profiles
      .map(
        (profile) =>
          [
            profile.entity.normalize('NFKC').toLocaleLowerCase('en-US'),
            [...profile.aliases]
              .map((alias) =>
                alias.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US')
              )
              .sort(),
          ] as const
      )
      .sort(([left], [right]) => left.localeCompare(right));
  if (
    JSON.stringify(entityConfiguration(baselineEntityProfiles)) !==
    JSON.stringify(entityConfiguration(currentEntityProfiles))
  ) {
    throw new Error(
      'Answer-citation period comparison requires the same configured entity names and aliases in both samples.'
    );
  }
  const collectProviderPrompts = (
    report: AiAnswerCitationObservationReport
  ): Map<
    string,
    {
      prompt: string;
      profile: AiAnswerCitationPromptProviderProfile;
    }
  > => {
    const profiles = new Map<
      string,
      { prompt: string; profile: AiAnswerCitationPromptProviderProfile }
    >();
    for (const prompt of report.prompts) {
      if (!Array.isArray(prompt.providerProfiles)) {
        throw new Error(
          'Answer-citation period comparison requires prompt/provider detail generated by a current Aviary version.'
        );
      }
      for (const providerProfile of prompt.providerProfiles) {
        const key = `${providerProfile.provider.toLowerCase()}\u0000${prompt.prompt.toLowerCase()}`;
        profiles.set(key, { prompt: prompt.prompt, profile: providerProfile });
      }
    }
    return profiles;
  };
  const baselineProfiles = collectProviderPrompts(baseline);
  const currentProfiles = collectProviderPrompts(current);
  const sharedKeys = [...baselineProfiles.keys()].filter((key) => currentProfiles.has(key));
  const onlyBaseline = [...baselineProfiles.keys()].filter((key) => !currentProfiles.has(key));
  const onlyCurrent = [...currentProfiles.keys()].filter((key) => !baselineProfiles.has(key));
  const hasOwnedDomains = baseline.ownedDomains.length > 0;
  const ownedCitationReachCompletenessBounds:
    AiAnswerCitationOwnedReachCompletenessBounds | undefined = hasOwnedDomains
    ? (() => {
        type ReachState = 'present' | 'absent' | 'unknown';
        interface BoundGroup {
          provider: string;
          baselineState: ReachState;
          currentState: ReachState;
        }
        const stateFor = (profile: AiAnswerCitationPromptProviderProfile): ReachState => {
          if ((profile.observationsWithOwnedCitation ?? 0) > 0) return 'present';
          if (
            profile.observationsWithOwnedCitation === 0 &&
            profile.incompleteCitationListObservations === 0
          )
            return 'absent';
          return 'unknown';
        };
        const groups: BoundGroup[] = sharedKeys.map((key) => ({
          provider: currentProfiles.get(key)!.profile.provider,
          baselineState: stateFor(baselineProfiles.get(key)!.profile),
          currentState: stateFor(currentProfiles.get(key)!.profile),
        }));
        const summarize = (
          items: BoundGroup[]
        ): Omit<AiAnswerCitationOwnedReachCompletenessProviderBounds, 'provider'> => {
          const baselinePresent = items.filter((item) => item.baselineState === 'present').length;
          const baselineUnknown = items.filter((item) => item.baselineState === 'unknown').length;
          const currentPresent = items.filter((item) => item.currentState === 'present').length;
          const currentUnknown = items.filter((item) => item.currentState === 'unknown').length;
          const n = items.length;
          const baselineUpper = baselinePresent + baselineUnknown;
          const currentUpper = currentPresent + currentUnknown;
          let changeLower = 0;
          let changeUpper = 0;
          for (const item of items) {
            const beforeLower = item.baselineState === 'present' ? 1 : 0;
            const beforeUpper = item.baselineState === 'absent' ? 0 : 1;
            const afterLower = item.currentState === 'present' ? 1 : 0;
            const afterUpper = item.currentState === 'absent' ? 0 : 1;
            changeLower += afterLower - beforeUpper;
            changeUpper += afterUpper - beforeLower;
          }
          const pct = (value: number): number => Number(((value / n) * 100).toFixed(2));
          return {
            sharedProviderPromptGroups: n,
            knownBaselineGroups: n - baselineUnknown,
            unknownBaselineGroups: baselineUnknown,
            knownCurrentGroups: n - currentUnknown,
            unknownCurrentGroups: currentUnknown,
            baselineReachLowerBoundPercent: n === 0 ? null : pct(baselinePresent),
            baselineReachUpperBoundPercent: n === 0 ? null : pct(baselineUpper),
            currentReachLowerBoundPercent: n === 0 ? null : pct(currentPresent),
            currentReachUpperBoundPercent: n === 0 ? null : pct(currentUpper),
            changeLowerBoundPercentagePoints: n === 0 ? null : pct(changeLower),
            changeUpperBoundPercentagePoints: n === 0 ? null : pct(changeUpper),
          };
        };
        const byProvider = new Map<string, BoundGroup[]>();
        for (const group of groups) {
          const key = group.provider.toLowerCase();
          const bucket = byProvider.get(key) ?? [];
          bucket.push(group);
          byProvider.set(key, bucket);
        }
        const providerComparisons = [...byProvider.entries()]
          .map(([key, items]) => ({
            provider: items[0]?.provider ?? key,
            ...summarize(items),
          }))
          .sort((left, right) => left.provider.localeCompare(right.provider));
        const overall = summarize(groups);
        return {
          complete: !baseline.promptsTruncated && !current.promptsTruncated,
          ...overall,
          providerComparisons,
          note: 'Bounds are calculated on matched exact provider/prompt groups only. A group is present when an owned citation was observed, absent when every retained source list is complete and none contains an owned citation, and unknown otherwise. Unknown groups contribute [0, 1]; current-minus-baseline bounds use paired group states, then average across matched groups. These are deterministic completeness bounds, not confidence intervals. Source prompt caps make retained-detail results incomplete.',
        };
      })()
    : undefined;
  const ownedPromptRankComparison: AiAnswerCitationOwnedPromptRankPeriodComparison | undefined =
    hasOwnedDomains
      ? (() => {
          interface RankPair {
            baselineFirst: number;
            currentFirst: number;
            baselineTopThree: number;
            currentTopThree: number;
            baselineMrr: number;
            currentMrr: number;
          }
          interface PromptRankBucket {
            prompt: string;
            providers: RankPair[];
          }
          interface ProviderRankBucket {
            provider: string;
            prompts: RankPair[];
          }
          const promptBuckets = new Map<string, PromptRankBucket>();
          const providerBuckets = new Map<string, ProviderRankBucket>();
          let complete = !baseline.promptsTruncated && !current.promptsTruncated;
          let matchedProviderPromptGroupsWithOwnedCitations = 0;
          let sharedGroupsWithoutOwnedCitationsInEitherPeriod = 0;
          for (const key of sharedKeys) {
            const before = baselineProfiles.get(key)!.profile;
            const after = currentProfiles.get(key)!.profile;
            if (
              before.ownedCitationEvents === undefined ||
              after.ownedCitationEvents === undefined ||
              before.ownedFirstPositionCitationEvents === undefined ||
              after.ownedFirstPositionCitationEvents === undefined ||
              before.ownedTopThreeCitationEvents === undefined ||
              after.ownedTopThreeCitationEvents === undefined ||
              before.ownedFirstCitationMeanReciprocalRankPercent === undefined ||
              before.ownedFirstCitationMeanReciprocalRankPercent === null ||
              after.ownedFirstCitationMeanReciprocalRankPercent === undefined ||
              after.ownedFirstCitationMeanReciprocalRankPercent === null
            ) {
              complete = false;
              continue;
            }
            if (before.ownedCitationEvents === 0 || after.ownedCitationEvents === 0) {
              sharedGroupsWithoutOwnedCitationsInEitherPeriod += 1;
              continue;
            }
            matchedProviderPromptGroupsWithOwnedCitations += 1;
            const pair: RankPair = {
              baselineFirst:
                (before.ownedFirstPositionCitationEvents / before.ownedCitationEvents) * 100,
              currentFirst:
                (after.ownedFirstPositionCitationEvents / after.ownedCitationEvents) * 100,
              baselineTopThree:
                (before.ownedTopThreeCitationEvents / before.ownedCitationEvents) * 100,
              currentTopThree:
                (after.ownedTopThreeCitationEvents / after.ownedCitationEvents) * 100,
              baselineMrr: before.ownedFirstCitationMeanReciprocalRankPercent,
              currentMrr: after.ownedFirstCitationMeanReciprocalRankPercent,
            };
            const promptKey = currentProfiles.get(key)!.prompt.toLowerCase();
            const promptBucket = promptBuckets.get(promptKey) ?? {
              prompt: currentProfiles.get(key)!.prompt,
              providers: [],
            };
            promptBucket.providers.push(pair);
            promptBuckets.set(promptKey, promptBucket);
            const providerKey = after.provider.toLowerCase();
            const providerBucket = providerBuckets.get(providerKey) ?? {
              provider: after.provider,
              prompts: [],
            };
            providerBucket.prompts.push(pair);
            providerBuckets.set(providerKey, providerBucket);
          }
          const metric = (
            pairs: RankPair[],
            position: 'first' | 'topThree' | 'mrr',
            seed: string,
            includeBootstrap = true
          ): AiAnswerCitationOwnedPromptRankMetricComparison | null => {
            if (pairs.length === 0) return null;
            const select = (pair: RankPair, period: 'baseline' | 'current'): number => {
              if (position === 'first')
                return period === 'baseline' ? pair.baselineFirst : pair.currentFirst;
              if (position === 'topThree')
                return period === 'baseline' ? pair.baselineTopThree : pair.currentTopThree;
              return period === 'baseline' ? pair.baselineMrr : pair.currentMrr;
            };
            const baselineValues = pairs.map((pair) => select(pair, 'baseline'));
            const currentValues = pairs.map((pair) => select(pair, 'current'));
            const deltas = pairs.map((pair) => select(pair, 'current') - select(pair, 'baseline'));
            const mean = (values: number[]) =>
              values.reduce((sum, value) => sum + value, 0) / values.length;
            return {
              baselineMeanPercent: Number(mean(baselineValues).toFixed(2)),
              currentMeanPercent: Number(mean(currentValues).toFixed(2)),
              changePercentagePoints: Number(mean(deltas).toFixed(2)),
              pairedPromptBootstrapConfidenceInterval95: includeBootstrap
                ? bootstrapMeanDifferenceConfidenceInterval95(deltas, seed)
                : null,
            };
          };
          const metricSeed = `${baseline.ownedDomains.slice().sort().join(',')}\u0000${current.ownedDomains.length}\u0000owned-prompt-balanced-rank`;
          const promptRows = [...promptBuckets.entries()]
            .map(([promptKey, bucket]) => {
              const promptFingerprint = createHash('sha256')
                .update(`aviary:answer-prompt:v1\0${promptKey}`, 'utf8')
                .digest('hex');
              return {
                promptFingerprint,
                matchedProviders: bucket.providers.length,
                firstPosition: metric(
                  bucket.providers,
                  'first',
                  `${metricSeed}:first-position:${promptFingerprint}`,
                  false
                )!,
                topThree: metric(
                  bucket.providers,
                  'topThree',
                  `${metricSeed}:top-three:${promptFingerprint}`,
                  false
                )!,
                meanReciprocalRank: metric(
                  bucket.providers,
                  'mrr',
                  `${metricSeed}:mean-reciprocal-rank:${promptFingerprint}`,
                  false
                )!,
              };
            })
            .sort(
              (left, right) =>
                Math.max(
                  Math.abs(right.firstPosition.changePercentagePoints),
                  Math.abs(right.topThree.changePercentagePoints),
                  Math.abs(right.meanReciprocalRank.changePercentagePoints)
                ) -
                  Math.max(
                    Math.abs(left.firstPosition.changePercentagePoints),
                    Math.abs(left.topThree.changePercentagePoints),
                    Math.abs(left.meanReciprocalRank.changePercentagePoints)
                  ) || left.promptFingerprint.localeCompare(right.promptFingerprint)
            );
          const providerComparisons = [...providerBuckets.entries()]
            .map(([providerKey, bucket]) => ({
              provider: bucket.provider,
              matchedPrompts: bucket.prompts.length,
              matchedProviderPromptGroups: bucket.prompts.length,
              firstPosition: metric(
                bucket.prompts,
                'first',
                `${metricSeed}:provider:${providerKey}:first-position`,
                false
              )!,
              topThree: metric(
                bucket.prompts,
                'topThree',
                `${metricSeed}:provider:${providerKey}:top-three`,
                false
              )!,
              meanReciprocalRank: metric(
                bucket.prompts,
                'mrr',
                `${metricSeed}:provider:${providerKey}:mean-reciprocal-rank`,
                false
              )!,
            }))
            .sort((left, right) => left.provider.localeCompare(right.provider));
          const promptBalancedPairs = [...promptBuckets.values()].map((bucket): RankPair => {
            const mean = (values: number[]) =>
              values.reduce((sum, value) => sum + value, 0) / values.length;
            return {
              baselineFirst: mean(bucket.providers.map((pair) => pair.baselineFirst)),
              currentFirst: mean(bucket.providers.map((pair) => pair.currentFirst)),
              baselineTopThree: mean(bucket.providers.map((pair) => pair.baselineTopThree)),
              currentTopThree: mean(bucket.providers.map((pair) => pair.currentTopThree)),
              baselineMrr: mean(bucket.providers.map((pair) => pair.baselineMrr)),
              currentMrr: mean(bucket.providers.map((pair) => pair.currentMrr)),
            };
          });
          return {
            complete,
            baselineProviderPromptGroups: baselineProfiles.size,
            currentProviderPromptGroups: currentProfiles.size,
            sharedProviderPromptGroups: sharedKeys.length,
            matchedProviderPromptGroupsWithOwnedCitations,
            sharedGroupsWithoutOwnedCitationsInEitherPeriod,
            pairedExactPrompts: promptRows.length,
            firstPosition: metric(
              promptBalancedPairs,
              'first',
              `${metricSeed}:exact-prompt:first-position`
            ),
            topThree: metric(
              promptBalancedPairs,
              'topThree',
              `${metricSeed}:exact-prompt:top-three`
            ),
            meanReciprocalRank: metric(
              promptBalancedPairs,
              'mrr',
              `${metricSeed}:exact-prompt:mean-reciprocal-rank`
            ),
            providerComparisons,
            prompts: promptRows.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
            promptsTruncated: promptRows.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS,
            note: 'Each exact prompt is weighted once after averaging matched provider/prompt groups within that prompt. Repeated captures are pooled within each provider/prompt group. Rank shares and mean reciprocal rank are conditional on owned citations appearing in both periods; groups with no owned citations in at least one period are excluded from rank summaries and counted separately. Mean reciprocal rank is the average reciprocal position of the first owned citation per snapshot, expressed as a percentage; it is higher when owned citations appear earlier. Overall confidence intervals are descriptive paired-prompt percentile-bootstrap intervals; prompt fingerprints are pseudonymous, not anonymized. Source prompt caps can make this comparison incomplete.',
          };
        })()
      : undefined;
  let increases = 0;
  let decreases = 0;
  let unchanged = 0;
  const changes = sharedKeys
    .map((key): AiAnswerCitationProviderPromptPeriodChange => {
      const before = baselineProfiles.get(key)!;
      const after = currentProfiles.get(key)!;
      const beforeCoverage = Number(
        ((before.profile.observationsWithCitations / before.profile.observations) * 100).toFixed(2)
      );
      const afterCoverage = Number(
        ((after.profile.observationsWithCitations / after.profile.observations) * 100).toFixed(2)
      );
      const citationCoverageDelta = Number(
        (
          (after.profile.observationsWithCitations / after.profile.observations -
            before.profile.observationsWithCitations / before.profile.observations) *
          100
        ).toFixed(2)
      );
      const beforeCitationCrossProduct =
        before.profile.observationsWithCitations * after.profile.observations;
      const currentCitationCrossProduct =
        after.profile.observationsWithCitations * before.profile.observations;
      if (currentCitationCrossProduct > beforeCitationCrossProduct) increases += 1;
      else if (currentCitationCrossProduct < beforeCitationCrossProduct) decreases += 1;
      else unchanged += 1;
      const baselineOwnedCount = before.profile.observationsWithOwnedCitation;
      const currentOwnedCount = after.profile.observationsWithOwnedCitation;
      const baselineOwnedCoverage =
        hasOwnedDomains && baselineOwnedCount !== undefined
          ? Number(((baselineOwnedCount / before.profile.observations) * 100).toFixed(2))
          : undefined;
      const currentOwnedCoverage =
        hasOwnedDomains && currentOwnedCount !== undefined
          ? Number(((currentOwnedCount / after.profile.observations) * 100).toFixed(2))
          : undefined;
      const ownedCitationCoverageDelta =
        baselineOwnedCount !== undefined && currentOwnedCount !== undefined
          ? Number(
              (
                (currentOwnedCount / after.profile.observations -
                  baselineOwnedCount / before.profile.observations) *
                100
              ).toFixed(2)
            )
          : undefined;
      const ownedReachState = (
        profile: AiAnswerCitationPromptProviderProfile
      ): 'present' | 'absent' | 'unknown' => {
        if ((profile.observationsWithOwnedCitation ?? 0) > 0) return 'present';
        if (
          profile.observationsWithOwnedCitation === 0 &&
          profile.incompleteCitationListObservations === 0
        )
          return 'absent';
        return 'unknown';
      };
      const baselineReachState = ownedReachState(before.profile);
      const currentReachState = ownedReachState(after.profile);
      const reachLower = (state: 'present' | 'absent' | 'unknown'): number =>
        state === 'present' ? 100 : 0;
      const reachUpper = (state: 'present' | 'absent' | 'unknown'): number =>
        state === 'absent' ? 0 : 100;
      const beforeProviderLabel = before.profile.provider;
      const baselineDomains = new Set(before.profile.citedDomains);
      const currentDomains = new Set(after.profile.citedDomains);
      const sharedDomains = [...baselineDomains]
        .filter((domain) => currentDomains.has(domain))
        .sort();
      const domainUnionSize = new Set([...baselineDomains, ...currentDomains]).size;
      const citedDomainDetailComplete =
        !before.profile.citedDomainsTruncated && !after.profile.citedDomainsTruncated;
      const baselineDomainConcentration = before.profile.domainConcentration;
      const currentDomainConcentration = after.profile.domainConcentration;
      const concentrationComparison =
        baselineDomainConcentration && currentDomainConcentration
          ? {
              baselineDomainConcentration,
              currentDomainConcentration,
              herfindahlDelta:
                baselineDomainConcentration.herfindahlIndex === null ||
                currentDomainConcentration.herfindahlIndex === null
                  ? null
                  : Number(
                      (
                        currentDomainConcentration.herfindahlIndex -
                        baselineDomainConcentration.herfindahlIndex
                      ).toFixed(4)
                    ),
              effectiveCitedDomainCountDelta:
                baselineDomainConcentration.effectiveCitedDomainCount === null ||
                currentDomainConcentration.effectiveCitedDomainCount === null
                  ? null
                  : Number(
                      (
                        currentDomainConcentration.effectiveCitedDomainCount -
                        baselineDomainConcentration.effectiveCitedDomainCount
                      ).toFixed(2)
                    ),
              largestDomainCitationShareDeltaPercentagePoints:
                baselineDomainConcentration.largestDomainCitationSharePercent === null ||
                currentDomainConcentration.largestDomainCitationSharePercent === null
                  ? null
                  : Number(
                      (
                        currentDomainConcentration.largestDomainCitationSharePercent -
                        baselineDomainConcentration.largestDomainCitationSharePercent
                      ).toFixed(2)
                    ),
            }
          : {};
      return {
        provider: beforeProviderLabel,
        prompt: before.prompt,
        baselineObservations: before.profile.observations,
        currentObservations: after.profile.observations,
        baselineObservationsWithCitations: before.profile.observationsWithCitations,
        currentObservationsWithCitations: after.profile.observationsWithCitations,
        baselineCitationCoveragePercent: beforeCoverage,
        currentCitationCoveragePercent: afterCoverage,
        citationCoverageDeltaPercentagePoints: citationCoverageDelta,
        ...(baselineOwnedCoverage !== undefined && currentOwnedCoverage !== undefined
          ? {
              baselineObservationsWithOwnedCitation: baselineOwnedCount,
              currentObservationsWithOwnedCitation: currentOwnedCount,
              baselineOwnedCitationCoveragePercent: baselineOwnedCoverage,
              currentOwnedCitationCoveragePercent: currentOwnedCoverage,
              ownedCitationCoverageDeltaPercentagePoints: ownedCitationCoverageDelta,
            }
          : {}),
        ...(hasOwnedDomains
          ? {
              baselineOwnedReachCompletenessState: baselineReachState,
              currentOwnedReachCompletenessState: currentReachState,
              baselineOwnedReachLowerBound: reachLower(baselineReachState),
              baselineOwnedReachUpperBound: reachUpper(baselineReachState),
              currentOwnedReachLowerBound: reachLower(currentReachState),
              currentOwnedReachUpperBound: reachUpper(currentReachState),
              ownedReachChangeLowerBoundPercentagePoints: Number(
                (reachLower(currentReachState) - reachUpper(baselineReachState)).toFixed(2)
              ),
              ownedReachChangeUpperBoundPercentagePoints: Number(
                (reachUpper(currentReachState) - reachLower(baselineReachState)).toFixed(2)
              ),
            }
          : {}),
        baselineFirstObservedAt: before.profile.firstObservedAt,
        baselineLastObservedAt: before.profile.lastObservedAt,
        currentFirstObservedAt: after.profile.firstObservedAt,
        currentLastObservedAt: after.profile.lastObservedAt,
        baselineCitedDomains: before.profile.citedDomains,
        baselineCitedDomainsTruncated: before.profile.citedDomainsTruncated,
        currentCitedDomains: after.profile.citedDomains,
        currentCitedDomainsTruncated: after.profile.citedDomainsTruncated,
        ...concentrationComparison,
        sharedCitedDomains: sharedDomains,
        baselineOnlyTopCitedDomains: [...baselineDomains]
          .filter((domain) => !currentDomains.has(domain))
          .sort(),
        currentOnlyTopCitedDomains: [...currentDomains]
          .filter((domain) => !baselineDomains.has(domain))
          .sort(),
        citedDomainDetailComplete,
        citationDomainJaccard:
          !citedDomainDetailComplete || domainUnionSize === 0
            ? null
            : Number((sharedDomains.length / domainUnionSize).toFixed(4)),
      };
    })
    .sort(
      (left, right) =>
        Math.abs(right.citationCoverageDeltaPercentagePoints) -
          Math.abs(left.citationCoverageDeltaPercentagePoints) ||
        right.baselineObservations +
          right.currentObservations -
          (left.baselineObservations + left.currentObservations) ||
        left.provider.localeCompare(right.provider) ||
        left.prompt.localeCompare(right.prompt)
    );
  const promptsTruncated = changes.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS;
  const collectTopicIntentProviderCohorts = (
    report: AiAnswerCitationObservationReport
  ): Map<
    string,
    {
      topic?: string;
      intent?: string;
      profile: AiAnswerCitationTopicIntentProviderProfile;
    }
  > => {
    const profiles = new Map<
      string,
      {
        topic?: string;
        intent?: string;
        profile: AiAnswerCitationTopicIntentProviderProfile;
      }
    >();
    for (const cohort of report.topicIntentCohorts ?? []) {
      if (!Array.isArray(cohort.providerProfiles)) continue;
      for (const providerProfile of cohort.providerProfiles) {
        const topicKey = cohort.topic?.toLowerCase() ?? '';
        const intentKey = cohort.intent?.toLowerCase() ?? '';
        const key = `${providerProfile.provider.toLowerCase()}\u0000${topicKey}\u0000${intentKey}`;
        profiles.set(key, {
          ...(cohort.topic ? { topic: cohort.topic } : {}),
          ...(cohort.intent ? { intent: cohort.intent } : {}),
          profile: providerProfile,
        });
      }
    }
    return profiles;
  };
  const baselineTopicIntentProfiles = collectTopicIntentProviderCohorts(baseline);
  const currentTopicIntentProfiles = collectTopicIntentProviderCohorts(current);
  const sharedTopicIntentKeys = [...baselineTopicIntentProfiles.keys()].filter((key) =>
    currentTopicIntentProfiles.has(key)
  );
  const onlyBaselineTopicIntentKeys = [...baselineTopicIntentProfiles.keys()].filter(
    (key) => !currentTopicIntentProfiles.has(key)
  );
  const onlyCurrentTopicIntentKeys = [...currentTopicIntentProfiles.keys()].filter(
    (key) => !baselineTopicIntentProfiles.has(key)
  );
  let cohortIncreases = 0;
  let cohortDecreases = 0;
  let cohortUnchanged = 0;
  const cohortChanges = sharedTopicIntentKeys
    .map((key): AiAnswerCitationTopicIntentProviderPeriodChange => {
      const before = baselineTopicIntentProfiles.get(key)!;
      const after = currentTopicIntentProfiles.get(key)!;
      const baselineRate = before.profile.observationsWithCitations / before.profile.observations;
      const currentRate = after.profile.observationsWithCitations / after.profile.observations;
      const delta = Number(((currentRate - baselineRate) * 100).toFixed(2));
      const baselineCrossProduct =
        before.profile.observationsWithCitations * after.profile.observations;
      const currentCrossProduct =
        after.profile.observationsWithCitations * before.profile.observations;
      if (currentCrossProduct > baselineCrossProduct) cohortIncreases += 1;
      else if (currentCrossProduct < baselineCrossProduct) cohortDecreases += 1;
      else cohortUnchanged += 1;
      const hasOwnedDomains = baseline.ownedDomains.length > 0;
      const baselineOwned = before.profile.observationsWithOwnedCitation;
      const currentOwned = after.profile.observationsWithOwnedCitation;
      const baselineOwnedRate =
        hasOwnedDomains && baselineOwned !== undefined
          ? baselineOwned / before.profile.observations
          : undefined;
      const currentOwnedRate =
        hasOwnedDomains && currentOwned !== undefined
          ? currentOwned / after.profile.observations
          : undefined;
      const baselineOwnedPromptCount = before.profile.promptsWithOwnedCitation;
      const currentOwnedPromptCount = after.profile.promptsWithOwnedCitation;
      const baselineOwnedPromptRate =
        hasOwnedDomains && baselineOwnedPromptCount !== undefined
          ? baselineOwnedPromptCount / before.profile.uniquePrompts
          : undefined;
      const currentOwnedPromptRate =
        hasOwnedDomains && currentOwnedPromptCount !== undefined
          ? currentOwnedPromptCount / after.profile.uniquePrompts
          : undefined;
      const baselineOwnedSnapshotMrr = hasOwnedDomains
        ? before.profile.ownedFirstCitationMeanReciprocalRankPercent
        : undefined;
      const currentOwnedSnapshotMrr = hasOwnedDomains
        ? after.profile.ownedFirstCitationMeanReciprocalRankPercent
        : undefined;
      const baselineOwnedPromptMrr = hasOwnedDomains
        ? before.profile.equalPromptMeanOwnedFirstCitationMrrPercent
        : undefined;
      const currentOwnedPromptMrr = hasOwnedDomains
        ? after.profile.equalPromptMeanOwnedFirstCitationMrrPercent
        : undefined;
      const baselineDomains = new Set(before.profile.citedDomains);
      const currentDomains = new Set(after.profile.citedDomains);
      return {
        ...(before.topic ? { topic: before.topic } : {}),
        ...(before.intent ? { intent: before.intent } : {}),
        provider: before.profile.provider,
        baselineObservations: before.profile.observations,
        currentObservations: after.profile.observations,
        baselineUniquePrompts: before.profile.uniquePrompts,
        currentUniquePrompts: after.profile.uniquePrompts,
        baselineObservationsWithCitations: before.profile.observationsWithCitations,
        currentObservationsWithCitations: after.profile.observationsWithCitations,
        baselineCitationCoveragePercent: Number((baselineRate * 100).toFixed(2)),
        currentCitationCoveragePercent: Number((currentRate * 100).toFixed(2)),
        citationCoverageDeltaPercentagePoints: delta,
        ...(before.profile.firstObservedAt
          ? { baselineFirstObservedAt: before.profile.firstObservedAt }
          : {}),
        ...(before.profile.lastObservedAt
          ? { baselineLastObservedAt: before.profile.lastObservedAt }
          : {}),
        ...(after.profile.firstObservedAt
          ? { currentFirstObservedAt: after.profile.firstObservedAt }
          : {}),
        ...(after.profile.lastObservedAt
          ? { currentLastObservedAt: after.profile.lastObservedAt }
          : {}),
        ...(baselineOwnedRate !== undefined && currentOwnedRate !== undefined
          ? {
              baselineObservationsWithOwnedCitation: baselineOwned,
              currentObservationsWithOwnedCitation: currentOwned,
              baselineOwnedCitationCoveragePercent: Number((baselineOwnedRate * 100).toFixed(2)),
              currentOwnedCitationCoveragePercent: Number((currentOwnedRate * 100).toFixed(2)),
              ownedCitationCoverageDeltaPercentagePoints: Number(
                ((currentOwnedRate - baselineOwnedRate) * 100).toFixed(2)
              ),
            }
          : {}),
        ...(baselineOwnedPromptRate !== undefined && currentOwnedPromptRate !== undefined
          ? {
              baselinePromptsWithOwnedCitation: baselineOwnedPromptCount,
              currentPromptsWithOwnedCitation: currentOwnedPromptCount,
              baselineOwnedCitationPromptCoveragePercent: Number(
                (baselineOwnedPromptRate * 100).toFixed(2)
              ),
              currentOwnedCitationPromptCoveragePercent: Number(
                (currentOwnedPromptRate * 100).toFixed(2)
              ),
              ownedCitationPromptCoverageChangePercentagePoints: Number(
                ((currentOwnedPromptRate - baselineOwnedPromptRate) * 100).toFixed(2)
              ),
            }
          : {}),
        ...(baselineOwnedSnapshotMrr !== undefined && currentOwnedSnapshotMrr !== undefined
          ? {
              baselineOwnedFirstCitationMeanReciprocalRankPercent: baselineOwnedSnapshotMrr,
              currentOwnedFirstCitationMeanReciprocalRankPercent: currentOwnedSnapshotMrr,
              ownedFirstCitationMeanReciprocalRankChangePercentagePoints:
                baselineOwnedSnapshotMrr === null || currentOwnedSnapshotMrr === null
                  ? null
                  : Number((currentOwnedSnapshotMrr - baselineOwnedSnapshotMrr).toFixed(2)),
            }
          : {}),
        ...(baselineOwnedPromptMrr !== undefined && currentOwnedPromptMrr !== undefined
          ? {
              baselineEqualPromptMeanOwnedFirstCitationMrrPercent: baselineOwnedPromptMrr,
              currentEqualPromptMeanOwnedFirstCitationMrrPercent: currentOwnedPromptMrr,
              equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints:
                baselineOwnedPromptMrr === null || currentOwnedPromptMrr === null
                  ? null
                  : Number((currentOwnedPromptMrr - baselineOwnedPromptMrr).toFixed(2)),
            }
          : {}),
        baselineCitedDomains: before.profile.citedDomains,
        currentCitedDomains: after.profile.citedDomains,
        sharedCitedDomains: [...baselineDomains]
          .filter((domain) => currentDomains.has(domain))
          .sort(),
        baselineOnlyTopCitedDomains: [...baselineDomains]
          .filter((domain) => !currentDomains.has(domain))
          .sort(),
        currentOnlyTopCitedDomains: [...currentDomains]
          .filter((domain) => !baselineDomains.has(domain))
          .sort(),
        citedDomainDetailComplete:
          !before.profile.citedDomainsTruncated && !after.profile.citedDomainsTruncated,
      };
    })
    .sort(
      (left, right) =>
        Math.abs(right.citationCoverageDeltaPercentagePoints) -
          Math.abs(left.citationCoverageDeltaPercentagePoints) ||
        right.baselineObservations +
          right.currentObservations -
          (left.baselineObservations + left.currentObservations) ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.provider.localeCompare(right.provider)
    );
  const cohortChangesTruncated = cohortChanges.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS;
  const presenceFromProfile = (value: {
    topic?: string;
    intent?: string;
    profile: AiAnswerCitationTopicIntentProviderProfile;
  }): AiAnswerCitationTopicIntentProviderPeriodPresence => ({
    ...(value.topic ? { topic: value.topic } : {}),
    ...(value.intent ? { intent: value.intent } : {}),
    provider: value.profile.provider,
    observations: value.profile.observations,
    uniquePrompts: value.profile.uniquePrompts,
    observationsWithCitations: value.profile.observationsWithCitations,
    citationCoveragePercent: Number(
      ((value.profile.observationsWithCitations / value.profile.observations) * 100).toFixed(2)
    ),
    ...(value.profile.firstObservedAt ? { firstObservedAt: value.profile.firstObservedAt } : {}),
    ...(value.profile.lastObservedAt ? { lastObservedAt: value.profile.lastObservedAt } : {}),
    ...(value.profile.observationsWithOwnedCitation === undefined
      ? {}
      : {
          observationsWithOwnedCitation: value.profile.observationsWithOwnedCitation,
          ...(value.profile.ownedCitationCoveragePercent === undefined
            ? {}
            : { ownedCitationCoveragePercent: value.profile.ownedCitationCoveragePercent }),
          ...(value.profile.promptsWithOwnedCitation === undefined
            ? {}
            : { promptsWithOwnedCitation: value.profile.promptsWithOwnedCitation }),
          ...(value.profile.ownedCitationPromptCoveragePercent === undefined
            ? {}
            : {
                ownedCitationPromptCoveragePercent:
                  value.profile.ownedCitationPromptCoveragePercent,
              }),
          ...(value.profile.ownedFirstCitationMeanReciprocalRankPercent === undefined
            ? {}
            : {
                ownedFirstCitationMeanReciprocalRankPercent:
                  value.profile.ownedFirstCitationMeanReciprocalRankPercent,
              }),
          ...(value.profile.equalPromptMeanOwnedFirstCitationMrrPercent === undefined
            ? {}
            : {
                equalPromptMeanOwnedFirstCitationMrrPercent:
                  value.profile.equalPromptMeanOwnedFirstCitationMrrPercent,
              }),
          ...(value.profile.equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95 === undefined
            ? {}
            : {
                equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95:
                  value.profile.equalPromptMeanOwnedFirstCitationMrrConfidenceInterval95,
              }),
        }),
    citedDomains: value.profile.citedDomains,
    citedDomainsTruncated: value.profile.citedDomainsTruncated,
  });
  const onlyInBaseline = onlyBaselineTopicIntentKeys
    .map((key) => presenceFromProfile(baselineTopicIntentProfiles.get(key)!))
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.provider.localeCompare(right.provider)
    );
  const onlyInCurrent = onlyCurrentTopicIntentKeys
    .map((key) => presenceFromProfile(currentTopicIntentProfiles.get(key)!))
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        (left.topic ?? '').localeCompare(right.topic ?? '') ||
        (left.intent ?? '').localeCompare(right.intent ?? '') ||
        left.provider.localeCompare(right.provider)
    );
  const unmatchedCohortsTruncated =
    onlyInBaseline.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS ||
    onlyInCurrent.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS;
  const hasCompleteTopicIntentProviderDetail = (
    report: AiAnswerCitationObservationReport
  ): boolean =>
    Array.isArray(report.topicIntentCohorts) &&
    !report.topicIntentCohortsTruncated &&
    ((report.summary.labeledObservations ?? 0) === 0 || report.topicIntentCohorts.length > 0) &&
    report.topicIntentCohorts.every((cohort) => Array.isArray(cohort.providerProfiles));
  const topicIntentComparison: AiAnswerCitationTopicIntentPeriodComparison = {
    baselineRetainedProviderCohorts: baselineTopicIntentProfiles.size,
    currentRetainedProviderCohorts: currentTopicIntentProfiles.size,
    sharedProviderCohorts: sharedTopicIntentKeys.length,
    providerCohortsOnlyInBaselineRetainedDetail: onlyBaselineTopicIntentKeys.length,
    providerCohortsOnlyInCurrentRetainedDetail: onlyCurrentTopicIntentKeys.length,
    providerCohortCoverageComplete:
      hasCompleteTopicIntentProviderDetail(baseline) &&
      hasCompleteTopicIntentProviderDetail(current) &&
      !cohortChangesTruncated &&
      !unmatchedCohortsTruncated,
    sharedCohortsWithCitationCoverageIncrease: cohortIncreases,
    sharedCohortsWithCitationCoverageDecrease: cohortDecreases,
    sharedCohortsWithNoCitationCoverageChange: cohortUnchanged,
    cohorts: cohortChanges.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
    cohortsTruncated: cohortChangesTruncated,
    onlyInBaseline: onlyInBaseline.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
    onlyInCurrent: onlyInCurrent.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
    unmatchedCohortsTruncated,
    note: 'Cohort rows match case-normalized topic and intent labels plus provider label. Citation and owned-domain coverage use each period’s observed snapshot denominator. Cited-domain lists are top-ten samples. Only retained complete provider profiles are compared; baseline-only and current-only rows identify sample presence, not lost or gained visibility, and changes do not establish causation.',
  };
  const entityMentionComparison: AiAnswerCitationEntityMentionPeriodComparison | undefined =
    baselineEntityProfiles.length > 0
      ? {
          entities: baselineEntityProfiles.map((beforeEntity) => {
            const afterEntity = currentEntityProfiles.find(
              (profile) =>
                profile.entity.normalize('NFKC').toLocaleLowerCase('en-US') ===
                beforeEntity.entity.normalize('NFKC').toLocaleLowerCase('en-US')
            )!;
            const compareSlices = (
              before: AiAnswerCitationEntityMentionSlice | null,
              after: AiAnswerCitationEntityMentionSlice | null,
              includeCitationDomains = true
            ): AiAnswerCitationEntityMentionPeriodRow => {
              const delta = (
                left: number | null | undefined,
                right: number | null | undefined
              ): number | null =>
                left === null || left === undefined || right === null || right === undefined
                  ? null
                  : Number((right - left).toFixed(2));
              const asSlice = (
                slice: AiAnswerCitationEntityMentionSlice | null
              ): AiAnswerCitationEntityMentionSlice | null =>
                slice
                  ? {
                      observationsWithAnswerText: slice.observationsWithAnswerText,
                      observationsWithoutAnswerText: slice.observationsWithoutAnswerText,
                      observationsMentioningEntity: slice.observationsMentioningEntity,
                      entityMentionRatePercent: slice.entityMentionRatePercent,
                      entityMentionRateConfidenceInterval95Percent:
                        slice.entityMentionRateConfidenceInterval95Percent,
                      entityMentionOccurrences: slice.entityMentionOccurrences,
                      answersMentionedInFirstThird: slice.answersMentionedInFirstThird,
                      firstThirdMentionSharePercent: slice.firstThirdMentionSharePercent,
                      firstThirdMentionShareConfidenceInterval95Percent:
                        slice.firstThirdMentionShareConfidenceInterval95Percent,
                      medianFirstMentionPositionPercent: slice.medianFirstMentionPositionPercent,
                      observationsMentioningWithAnyCitation:
                        slice.observationsMentioningWithAnyCitation,
                      anyCitationCoverageWhenMentionedPercent:
                        slice.anyCitationCoverageWhenMentionedPercent,
                      anyCitationCoverageWhenMentionedConfidenceInterval95Percent:
                        slice.anyCitationCoverageWhenMentionedConfidenceInterval95Percent,
                      observationsWithoutEntityMention: slice.observationsWithoutEntityMention,
                      observationsWithoutEntityMentionWithAnyCitation:
                        slice.observationsWithoutEntityMentionWithAnyCitation,
                      anyCitationCoverageWhenNotMentionedPercent:
                        slice.anyCitationCoverageWhenNotMentionedPercent,
                      anyCitationCoverageWhenNotMentionedConfidenceInterval95Percent:
                        slice.anyCitationCoverageWhenNotMentionedConfidenceInterval95Percent,
                      ...(!includeCitationDomains || slice.citationDomainAssociations === undefined
                        ? {}
                        : {
                            citationDomainAssociations: slice.citationDomainAssociations,
                            citationDomainAssociationsTruncated:
                              slice.citationDomainAssociationsTruncated,
                          }),
                      ...(slice.observationsMentioningWithOwnedCitation === undefined
                        ? {}
                        : {
                            observationsMentioningWithOwnedCitation:
                              slice.observationsMentioningWithOwnedCitation,
                            ownedCitationCoverageWhenMentionedPercent:
                              slice.ownedCitationCoverageWhenMentionedPercent,
                            ownedCitationCoverageWhenMentionedConfidenceInterval95Percent:
                              slice.ownedCitationCoverageWhenMentionedConfidenceInterval95Percent,
                            observationsWithoutEntityMentionWithOwnedCitation:
                              slice.observationsWithoutEntityMentionWithOwnedCitation,
                            ownedCitationCoverageWhenNotMentionedPercent:
                              slice.ownedCitationCoverageWhenNotMentionedPercent,
                            ownedCitationCoverageWhenNotMentionedConfidenceInterval95Percent:
                              slice.ownedCitationCoverageWhenNotMentionedConfidenceInterval95Percent,
                            ownedCitationPositionWhenMentioned:
                              slice.ownedCitationPositionWhenMentioned,
                            ownedCitationPositionWhenNotMentioned:
                              slice.ownedCitationPositionWhenNotMentioned,
                          }),
                    }
                  : null;
              return {
                baseline: asSlice(before),
                current: asSlice(after),
                entityMentionRateChangePercentagePoints: delta(
                  before?.entityMentionRatePercent,
                  after?.entityMentionRatePercent
                ),
                entityMentionOccurrencesChange:
                  before && after
                    ? after.entityMentionOccurrences - before.entityMentionOccurrences
                    : null,
                firstThirdMentionShareChangePercentagePoints: delta(
                  before?.firstThirdMentionSharePercent,
                  after?.firstThirdMentionSharePercent
                ),
                medianFirstMentionPositionChangePercentagePoints: delta(
                  before?.medianFirstMentionPositionPercent,
                  after?.medianFirstMentionPositionPercent
                ),
                anyCitationCoverageWhenMentionedChangePercentagePoints: delta(
                  before?.anyCitationCoverageWhenMentionedPercent,
                  after?.anyCitationCoverageWhenMentionedPercent
                ),
                anyCitationCoverageWhenNotMentionedChangePercentagePoints: delta(
                  before?.anyCitationCoverageWhenNotMentionedPercent,
                  after?.anyCitationCoverageWhenNotMentionedPercent
                ),
                ...(baseline.ownedDomains.length > 0
                  ? {
                      ownedCitationCoverageWhenMentionedChangePercentagePoints: delta(
                        before?.ownedCitationCoverageWhenMentionedPercent,
                        after?.ownedCitationCoverageWhenMentionedPercent
                      ),
                      ownedCitationCoverageWhenNotMentionedChangePercentagePoints: delta(
                        before?.ownedCitationCoverageWhenNotMentionedPercent,
                        after?.ownedCitationCoverageWhenNotMentionedPercent
                      ),
                      ownedFirstPositionShareWhenMentionedChangePercentagePoints: delta(
                        before?.ownedCitationPositionWhenMentioned
                          ?.firstPositionCitationSharePercent,
                        after?.ownedCitationPositionWhenMentioned?.firstPositionCitationSharePercent
                      ),
                      ownedTopThreeShareWhenMentionedChangePercentagePoints: delta(
                        before?.ownedCitationPositionWhenMentioned?.topThreeCitationSharePercent,
                        after?.ownedCitationPositionWhenMentioned?.topThreeCitationSharePercent
                      ),
                      ownedFirstPositionShareWhenNotMentionedChangePercentagePoints: delta(
                        before?.ownedCitationPositionWhenNotMentioned
                          ?.firstPositionCitationSharePercent,
                        after?.ownedCitationPositionWhenNotMentioned
                          ?.firstPositionCitationSharePercent
                      ),
                      ownedTopThreeShareWhenNotMentionedChangePercentagePoints: delta(
                        before?.ownedCitationPositionWhenNotMentioned?.topThreeCitationSharePercent,
                        after?.ownedCitationPositionWhenNotMentioned?.topThreeCitationSharePercent
                      ),
                    }
                  : {}),
              };
            };
            const currentProviders = new Map(
              afterEntity.providerProfiles.map((profile) => [
                profile.provider.toLocaleLowerCase('en-US'),
                profile,
              ])
            );
            const providerNames = new Map<string, string>();
            for (const profile of [
              ...beforeEntity.providerProfiles,
              ...afterEntity.providerProfiles,
            ]) {
              providerNames.set(profile.provider.toLocaleLowerCase('en-US'), profile.provider);
            }
            const beforeProviders = new Map(
              beforeEntity.providerProfiles.map((profile) => [
                profile.provider.toLocaleLowerCase('en-US'),
                profile,
              ])
            );
            const providerProfiles = [...providerNames.entries()]
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([providerKey, provider]) => ({
                provider,
                ...compareSlices(
                  beforeProviders.get(providerKey) ?? null,
                  currentProviders.get(providerKey) ?? null
                ),
              }));
            const normalizeMonthDimension = (value: string | undefined): string =>
              (value ?? '')
                .normalize('NFKC')
                .replace(/\s+/gu, ' ')
                .trim()
                .toLocaleLowerCase('en-US');
            const sameEntity = (profile: AiAnswerCitationEntityMentionMonthlyProfile): boolean =>
              profile.entity.normalize('NFKC').toLocaleLowerCase('en-US') ===
              beforeEntity.entity.normalize('NFKC').toLocaleLowerCase('en-US');
            const monthlyKey = (profile: AiAnswerCitationEntityMentionMonthlyProfile): string =>
              JSON.stringify([
                profile.month,
                normalizeMonthDimension(profile.topic),
                normalizeMonthDimension(profile.intent),
                profile.unlabeled,
                normalizeMonthDimension(profile.provider),
              ]);
            const beforeMonthly = new Map(
              (baseline.entityMentionMonthlyProfiles ?? [])
                .filter(sameEntity)
                .map((profile) => [monthlyKey(profile), profile])
            );
            const afterMonthly = new Map(
              (current.entityMentionMonthlyProfiles ?? [])
                .filter(sameEntity)
                .map((profile) => [monthlyKey(profile), profile])
            );
            const monthlyKeys = new Set([...beforeMonthly.keys(), ...afterMonthly.keys()]);
            const monthlyProfiles = [...monthlyKeys]
              .map((key): AiAnswerCitationEntityMentionMonthlyPeriodRow => {
                const before = beforeMonthly.get(key);
                const after = afterMonthly.get(key);
                const source = after ?? before!;
                return {
                  month: source.month,
                  ...(source.topic ? { topic: source.topic } : {}),
                  ...(source.intent ? { intent: source.intent } : {}),
                  unlabeled: source.unlabeled,
                  provider: source.provider,
                  sampleState:
                    before && after ? 'matched' : before ? 'baseline-only' : 'current-only',
                  baselineObservations: before?.observations ?? null,
                  currentObservations: after?.observations ?? null,
                  baselineUniquePrompts: before?.uniquePrompts ?? null,
                  currentUniquePrompts: after?.uniquePrompts ?? null,
                  ...compareSlices(before ?? null, after ?? null, false),
                };
              })
              .sort(
                (left, right) =>
                  right.month.localeCompare(left.month) ||
                  left.provider.localeCompare(right.provider) ||
                  (left.topic ?? '').localeCompare(right.topic ?? '') ||
                  (left.intent ?? '').localeCompare(right.intent ?? '')
              );
            const monthlyProfilesTruncated =
              monthlyProfiles.length > MAX_RETURNED_ENTITY_MENTION_PERIOD_MONTHLY_ROWS ||
              baseline.entityMentionMonthlyProfilesTruncated === true ||
              current.entityMentionMonthlyProfilesTruncated === true;
            return {
              entity: beforeEntity.entity,
              aliases: beforeEntity.aliases,
              ...compareSlices(beforeEntity, afterEntity),
              providerProfiles,
              monthlyProfiles: monthlyProfiles.slice(
                0,
                MAX_RETURNED_ENTITY_MENTION_PERIOD_MONTHLY_ROWS
              ),
              monthlyProfilesTruncated,
            };
          }),
          note: 'Rates use only snapshots with captured answer text. Citation coverage is descriptive co-occurrence for answers with and without each configured entity mention. Per-provider period rows preserve missing samples as unavailable and do not imply gained or lost visibility.',
        }
      : undefined;
  const pathFamilyComparison: AiAnswerCitationPathFamilyPeriodComparison | undefined =
    baseline.pathFamilyDepth !== undefined &&
    baseline.pathFamilyDepth === current.pathFamilyDepth &&
    baseline.pathFamilies !== undefined &&
    current.pathFamilies !== undefined
      ? (() => {
          const baselineFamilies = new Map(
            baseline.pathFamilies!.map((profile) => [profile.pathFamily, profile])
          );
          const currentFamilies = new Map(
            current.pathFamilies!.map((profile) => [profile.pathFamily, profile])
          );
          const familyKeys = new Set([...baselineFamilies.keys(), ...currentFamilies.keys()]);
          const toMetrics = (
            profile: AiAnswerCitationPathFamilyProfile | undefined
          ): AiAnswerCitationPathFamilyPeriodMetrics | null =>
            profile
              ? {
                  ...(profile.owned === undefined ? {} : { owned: profile.owned }),
                  pages: profile.pages,
                  citationEvents: profile.citationEvents,
                  citationEventSharePercent: profile.citationEventSharePercent,
                  observedAnswers: profile.observedAnswers,
                  observationCoveragePercent: profile.observationCoveragePercent,
                  firstPositionCitationSharePercent:
                    profile.citationListPosition.firstPositionCitationSharePercent,
                  topThreeCitationSharePercent:
                    profile.citationListPosition.topThreeCitationSharePercent,
                  firstObservedAt: profile.firstObservedAt,
                  lastObservedAt: profile.lastObservedAt,
                  sampleUrls: profile.sampleUrls,
                  sampleUrlsTruncated: profile.sampleUrlsTruncated,
                }
              : null;
          const changes = [...familyKeys]
            .map((pathFamily): AiAnswerCitationPathFamilyPeriodChange => {
              const before = baselineFamilies.get(pathFamily);
              const after = currentFamilies.get(pathFamily);
              const beforeMetrics = toMetrics(before);
              const afterMetrics = toMetrics(after);
              const delta = (left: number | undefined, right: number | undefined): number | null =>
                left === undefined || right === undefined
                  ? null
                  : Number((right - left).toFixed(2));
              return {
                pathFamily,
                origin: after?.origin ?? before!.origin,
                pathPrefix: after?.pathPrefix ?? before!.pathPrefix,
                sampleState:
                  before && after ? 'both-periods' : before ? 'baseline-only' : 'current-only',
                baseline: beforeMetrics,
                current: afterMetrics,
                pagesChange: delta(before?.pages, after?.pages),
                citationEventsChange: delta(before?.citationEvents, after?.citationEvents),
                citationEventShareChangePercentagePoints: delta(
                  before?.citationEventSharePercent,
                  after?.citationEventSharePercent
                ),
                observedAnswersChange: delta(before?.observedAnswers, after?.observedAnswers),
                observationCoverageChangePercentagePoints: delta(
                  before?.observationCoveragePercent,
                  after?.observationCoveragePercent
                ),
                firstPositionShareChangePercentagePoints: delta(
                  before?.citationListPosition.firstPositionCitationSharePercent,
                  after?.citationListPosition.firstPositionCitationSharePercent
                ),
                topThreeShareChangePercentagePoints: delta(
                  before?.citationListPosition.topThreeCitationSharePercent,
                  after?.citationListPosition.topThreeCitationSharePercent
                ),
              };
            })
            .sort((left, right) => {
              const leftDelta =
                left.citationEventShareChangePercentagePoints === null
                  ? -1
                  : Math.abs(left.citationEventShareChangePercentagePoints);
              const rightDelta =
                right.citationEventShareChangePercentagePoints === null
                  ? -1
                  : Math.abs(right.citationEventShareChangePercentagePoints);
              return (
                rightDelta - leftDelta ||
                (right.current?.citationEvents ?? right.baseline?.citationEvents ?? 0) -
                  (left.current?.citationEvents ?? left.baseline?.citationEvents ?? 0) ||
                left.pathFamily.localeCompare(right.pathFamily)
              );
            });
          const baselineOnlyRetainedFamilies = changes.filter(
            ({ sampleState }) => sampleState === 'baseline-only'
          ).length;
          const currentOnlyRetainedFamilies = changes.filter(
            ({ sampleState }) => sampleState === 'current-only'
          ).length;
          const familiesTruncated =
            changes.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS ||
            baseline.pathFamiliesTruncated === true ||
            current.pathFamiliesTruncated === true;
          return {
            pathFamilyDepth: baseline.pathFamilyDepth!,
            baselineFamilyCount: baseline.pathFamilyCount ?? baseline.pathFamilies!.length,
            currentFamilyCount: current.pathFamilyCount ?? current.pathFamilies!.length,
            sharedFamilies:
              changes.length - baselineOnlyRetainedFamilies - currentOnlyRetainedFamilies,
            baselineOnlyRetainedFamilies,
            currentOnlyRetainedFamilies,
            familyCoverageComplete: !familiesTruncated,
            families: changes.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
            familiesTruncated,
            note: 'Families match by exact normalized origin/path prefix at the configured depth. Citation-event and observation-coverage deltas compare each period’s own supplied sample; source positions depend on preserved citation order. One-period-only families describe sample presence and keep the other period unavailable rather than assuming zero activity. Capped source family lists or comparison detail make retained-family coverage incomplete; none of these changes establish gained or lost visibility or causation.',
          };
        })()
      : undefined;
  const pathFamilyCohortComparison: AiAnswerCitationPathFamilyCohortComparison | undefined =
    baseline.pathFamilyDepth !== undefined &&
    baseline.pathFamilyDepth === current.pathFamilyDepth &&
    baseline.pathFamilyCohorts !== undefined &&
    current.pathFamilyCohorts !== undefined
      ? (() => {
          const keyOf = (profile: AiAnswerCitationPathFamilyCohortProfile): string =>
            JSON.stringify([
              profile.pathFamily,
              profile.provider.toLocaleLowerCase('en-US'),
              profile.unlabeled ? null : (profile.topic?.toLocaleLowerCase('en-US') ?? null),
              profile.unlabeled ? null : (profile.intent?.toLocaleLowerCase('en-US') ?? null),
              profile.unlabeled,
            ]);
          const baselineRows = new Map(
            baseline.pathFamilyCohorts!.map((profile) => [keyOf(profile), profile])
          );
          const currentRows = new Map(
            current.pathFamilyCohorts!.map((profile) => [keyOf(profile), profile])
          );
          const keys = new Set([...baselineRows.keys(), ...currentRows.keys()]);
          const metricsOf = (
            profile: AiAnswerCitationPathFamilyCohortProfile | undefined
          ): AiAnswerCitationPathFamilyCohortMetrics | null => {
            if (!profile) return null;
            const {
              pathFamily: _pathFamily,
              origin: _origin,
              pathPrefix: _pathPrefix,
              owned: _owned,
              provider: _provider,
              topic: _topic,
              intent: _intent,
              unlabeled: _unlabeled,
              ...metrics
            } = profile;
            return metrics;
          };
          const delta = (before: number | undefined, after: number | undefined): number | null =>
            before === undefined || after === undefined
              ? null
              : Number((after - before).toFixed(2));
          const changes = [...keys]
            .map((key): AiAnswerCitationPathFamilyCohortChange => {
              const before = baselineRows.get(key);
              const after = currentRows.get(key);
              const state: AiAnswerCitationPathFamilyCohortChange['sampleState'] =
                before && after
                  ? 'both-periods'
                  : after
                    ? baseline.pathFamilyCohortsTruncated
                      ? 'baseline-detail-capped'
                      : 'current-only'
                    : current.pathFamilyCohortsTruncated
                      ? 'current-detail-capped'
                      : 'baseline-only';
              const identity = after ?? before!;
              const canCompare = Boolean(before && after);
              return {
                pathFamily: identity.pathFamily,
                origin: identity.origin,
                pathPrefix: identity.pathPrefix,
                ...(identity.owned === undefined ? {} : { owned: identity.owned }),
                provider: identity.provider,
                ...(identity.topic ? { topic: identity.topic } : {}),
                ...(identity.intent ? { intent: identity.intent } : {}),
                unlabeled: identity.unlabeled,
                sampleState: state,
                baseline: metricsOf(before),
                current: metricsOf(after),
                citationEventsChange: canCompare
                  ? delta(before!.citationEvents, after!.citationEvents)
                  : null,
                observationCoverageChangePercentagePoints: canCompare
                  ? delta(before!.observationCoveragePercent, after!.observationCoveragePercent)
                  : null,
                promptCoverageChangePercentagePoints: canCompare
                  ? delta(before!.promptCoveragePercent, after!.promptCoveragePercent)
                  : null,
                citationEventShareChangePercentagePoints: canCompare
                  ? delta(
                      before!.citationEventShareWithinCohortPercent,
                      after!.citationEventShareWithinCohortPercent
                    )
                  : null,
              };
            })
            .sort((left, right) => {
              const leftChange =
                left.citationEventShareChangePercentagePoints === null
                  ? -1
                  : Math.abs(left.citationEventShareChangePercentagePoints);
              const rightChange =
                right.citationEventShareChangePercentagePoints === null
                  ? -1
                  : Math.abs(right.citationEventShareChangePercentagePoints);
              return (
                rightChange - leftChange ||
                (right.current?.citationEvents ?? right.baseline?.citationEvents ?? 0) -
                  (left.current?.citationEvents ?? left.baseline?.citationEvents ?? 0) ||
                left.provider.localeCompare(right.provider) ||
                left.pathFamily.localeCompare(right.pathFamily)
              );
            });
          const rowsTruncated = changes.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS;
          const retainedChanges = changes.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS);
          const sharedRows = changes.filter(
            ({ sampleState }) => sampleState === 'both-periods'
          ).length;
          const baselineOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'baseline-only'
          ).length;
          const currentOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'current-only'
          ).length;
          const baselineOnlyRowsHiddenByCap = changes.some(
            ({ sampleState }) => sampleState === 'baseline-detail-capped'
          );
          const currentOnlyRowsHiddenByCap = changes.some(
            ({ sampleState }) => sampleState === 'current-detail-capped'
          );
          const incompleteSource =
            baseline.pathFamilyCohortsTruncated === true ||
            current.pathFamilyCohortsTruncated === true;
          return {
            pathFamilyDepth: baseline.pathFamilyDepth!,
            baselineRetainedRows: baseline.pathFamilyCohorts!.length,
            currentRetainedRows: current.pathFamilyCohorts!.length,
            sharedRows,
            baselineOnlyRetainedRows,
            currentOnlyRetainedRows,
            baselineOnlyRowsHiddenByCap,
            currentOnlyRowsHiddenByCap,
            coverageComplete: !incompleteSource && !rowsTruncated,
            rows: retainedChanges,
            rowsTruncated,
            note: 'Rows join exact path-family prefixes, case-normalized provider labels, and normalized supplied topic/intent labels. Coverage uses each period’s full provider/cohort snapshot denominator, including no-citation observations; event share uses that cohort’s citation events. One-period-only rows describe sample presence, while missing rows hidden by a source cap are labeled as capped. Deltas are descriptive sample changes, not visibility or causal effects.',
          };
        })()
      : undefined;
  const hasProviderPagePositions = (report: AiAnswerCitationObservationReport): boolean =>
    report.citedPages.every((page) => Array.isArray(page.providerCitationListPositions)) &&
    (report.citedPages.length > 0 || report.summary.citationEvents === 0);
  const entityPathFamilyComparison: AiAnswerCitationEntityPathFamilyComparison | undefined =
    baseline.pathFamilyDepth !== undefined &&
    baseline.pathFamilyDepth === current.pathFamilyDepth &&
    baseline.entityPathFamilyAssociations !== undefined &&
    current.entityPathFamilyAssociations !== undefined
      ? (() => {
          const normalize = (value: string): string => value.trim().toLocaleLowerCase('en-US');
          const keyOf = (profile: AiAnswerCitationEntityPathFamilyProfile): string =>
            JSON.stringify([
              normalize(profile.entity),
              profile.aliases.map(normalize).sort(),
              normalize(profile.provider),
              profile.unlabeled ? null : normalize(profile.topic ?? ''),
              profile.unlabeled ? null : normalize(profile.intent ?? ''),
              profile.unlabeled,
              profile.pathFamily,
            ]);
          const baselineRows = new Map(
            baseline.entityPathFamilyAssociations!.map((profile) => [keyOf(profile), profile])
          );
          const currentRows = new Map(
            current.entityPathFamilyAssociations!.map((profile) => [keyOf(profile), profile])
          );
          const keys = new Set([...baselineRows.keys(), ...currentRows.keys()]);
          const delta = (
            before: number | null | undefined,
            after: number | null | undefined
          ): number | null =>
            before === null || before === undefined || after === null || after === undefined
              ? null
              : Number((after - before).toFixed(2));
          const changes = [...keys]
            .map((key): AiAnswerCitationEntityPathFamilyChange => {
              const before = baselineRows.get(key);
              const after = currentRows.get(key);
              const identity = after ?? before!;
              const sampleState: AiAnswerCitationEntityPathFamilyChange['sampleState'] =
                before && after
                  ? 'both-periods'
                  : after
                    ? baseline.entityPathFamilyAssociationsTruncated
                      ? 'baseline-detail-capped'
                      : 'current-only'
                    : current.entityPathFamilyAssociationsTruncated
                      ? 'current-detail-capped'
                      : 'baseline-only';
              return {
                entity: identity.entity,
                aliases: identity.aliases,
                provider: identity.provider,
                ...(identity.topic ? { topic: identity.topic } : {}),
                ...(identity.intent ? { intent: identity.intent } : {}),
                unlabeled: identity.unlabeled,
                pathFamily: identity.pathFamily,
                origin: identity.origin,
                pathPrefix: identity.pathPrefix,
                ...(identity.owned === undefined ? {} : { owned: identity.owned }),
                observationsWithoutAnswerText: identity.observationsWithoutAnswerText,
                sampleState,
                baseline: before ?? null,
                current: after ?? null,
                mentionedObservationCoverageChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.observationCoveragePercent,
                        after.whenMentioned.observationCoveragePercent
                      )
                    : null,
                mentionedPromptCoverageChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.promptCoveragePercent,
                        after.whenMentioned.promptCoveragePercent
                      )
                    : null,
                mentionedCitationEventShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.citationEventSharePercent,
                        after.whenMentioned.citationEventSharePercent
                      )
                    : null,
                mentionedMeanSourcePositionChange:
                  before && after
                    ? delta(
                        before.whenMentioned.citationListPosition?.meanPosition,
                        after.whenMentioned.citationListPosition?.meanPosition
                      )
                    : null,
                mentionedMedianSourcePositionChange:
                  before && after
                    ? delta(
                        before.whenMentioned.citationListPosition?.medianPosition,
                        after.whenMentioned.citationListPosition?.medianPosition
                      )
                    : null,
                mentionedFirstPositionCitationShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.citationListPosition
                          ?.firstPositionCitationSharePercent,
                        after.whenMentioned.citationListPosition?.firstPositionCitationSharePercent
                      )
                    : null,
                mentionedTopThreeCitationShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.citationListPosition?.topThreeCitationSharePercent,
                        after.whenMentioned.citationListPosition?.topThreeCitationSharePercent
                      )
                    : null,
                notMentionedObservationCoverageChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.observationCoveragePercent,
                        after.whenNotMentioned.observationCoveragePercent
                      )
                    : null,
                notMentionedPromptCoverageChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.promptCoveragePercent,
                        after.whenNotMentioned.promptCoveragePercent
                      )
                    : null,
                notMentionedCitationEventShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.citationEventSharePercent,
                        after.whenNotMentioned.citationEventSharePercent
                      )
                    : null,
                notMentionedMeanSourcePositionChange:
                  before && after
                    ? delta(
                        before.whenNotMentioned.citationListPosition?.meanPosition,
                        after.whenNotMentioned.citationListPosition?.meanPosition
                      )
                    : null,
                notMentionedMedianSourcePositionChange:
                  before && after
                    ? delta(
                        before.whenNotMentioned.citationListPosition?.medianPosition,
                        after.whenNotMentioned.citationListPosition?.medianPosition
                      )
                    : null,
                notMentionedFirstPositionCitationShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.citationListPosition
                          ?.firstPositionCitationSharePercent,
                        after.whenNotMentioned.citationListPosition
                          ?.firstPositionCitationSharePercent
                      )
                    : null,
                notMentionedTopThreeCitationShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent,
                        after.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent
                      )
                    : null,
                observationCoverageAssociationChangePercentagePoints:
                  before && after
                    ? delta(
                        before.observationCoverageDifferencePercentagePoints,
                        after.observationCoverageDifferencePercentagePoints
                      )
                    : null,
                promptCoverageAssociationChangePercentagePoints:
                  before && after
                    ? delta(
                        before.promptCoverageDifferencePercentagePoints,
                        after.promptCoverageDifferencePercentagePoints
                      )
                    : null,
                citationEventShareAssociationChangePercentagePoints:
                  before && after
                    ? delta(
                        before.citationEventShareDifferencePercentagePoints,
                        after.citationEventShareDifferencePercentagePoints
                      )
                    : null,
              };
            })
            .sort(
              (left, right) =>
                Math.abs(right.mentionedPromptCoverageChangePercentagePoints ?? 0) -
                  Math.abs(left.mentionedPromptCoverageChangePercentagePoints ?? 0) ||
                (right.current?.whenMentioned.citationEvents ??
                  right.baseline?.whenMentioned.citationEvents ??
                  0) -
                  (left.current?.whenMentioned.citationEvents ??
                    left.baseline?.whenMentioned.citationEvents ??
                    0) ||
                left.entity.localeCompare(right.entity) ||
                left.provider.localeCompare(right.provider) ||
                left.pathFamily.localeCompare(right.pathFamily)
            );
          const rowsTruncated = changes.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS;
          const sharedRows = changes.filter(
            ({ sampleState }) => sampleState === 'both-periods'
          ).length;
          const baselineOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'baseline-only'
          ).length;
          const currentOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'current-only'
          ).length;
          const sourceTruncated =
            baseline.entityPathFamilyAssociationsTruncated === true ||
            current.entityPathFamilyAssociationsTruncated === true;
          return {
            pathFamilyDepth: baseline.pathFamilyDepth!,
            baselineRetainedRows: baseline.entityPathFamilyAssociations!.length,
            currentRetainedRows: current.entityPathFamilyAssociations!.length,
            sharedRows,
            baselineOnlyRetainedRows,
            currentOnlyRetainedRows,
            coverageComplete: !sourceTruncated && !rowsTruncated,
            rows: changes.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
            rowsTruncated,
            note: 'Rows match configured entity names and aliases, normalized provider/topic/intent labels, and exact path-family prefixes. Mention and non-mention rates use each period’s answer-text denominators; snapshots without answer text are counted separately. One-sided rows are sample-presence states and become detail-capped when a source profile list was truncated. These deltas describe manually captured samples, not semantic attribution, visibility change, or causation.',
          };
        })()
      : undefined;
  const entityCitationPageComparison: AiAnswerCitationEntityCitationPageComparison | undefined =
    baseline.entityCitationPageAssociations !== undefined &&
    current.entityCitationPageAssociations !== undefined
      ? (() => {
          const normalize = (value: string): string =>
            value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
          const keyOf = (profile: AiAnswerCitationEntityCitationPageProfile): string =>
            JSON.stringify([
              normalize(profile.entity),
              profile.aliases.map(normalize).sort(),
              normalize(profile.provider),
              profile.month ?? null,
              profile.unlabeled ? null : normalize(profile.topic ?? ''),
              profile.unlabeled ? null : normalize(profile.intent ?? ''),
              profile.unlabeled,
              profile.url,
            ]);
          const beforeRows = new Map(
            baseline.entityCitationPageAssociations.map((profile) => [keyOf(profile), profile])
          );
          const afterRows = new Map(
            current.entityCitationPageAssociations.map((profile) => [keyOf(profile), profile])
          );
          const keys = new Set([...beforeRows.keys(), ...afterRows.keys()]);
          const delta = (
            before: number | null | undefined,
            after: number | null | undefined
          ): number | null =>
            before === null || before === undefined || after === null || after === undefined
              ? null
              : Number((after - before).toFixed(2));
          const changes = [...keys]
            .map((key): AiAnswerCitationEntityCitationPageChange => {
              const before = beforeRows.get(key);
              const after = afterRows.get(key);
              const identity = after ?? before!;
              const sampleState: AiAnswerCitationEntityCitationPageChange['sampleState'] =
                before && after
                  ? 'both-periods'
                  : after
                    ? baseline.entityCitationPageAssociationsTruncated
                      ? 'baseline-detail-capped'
                      : 'current-only'
                    : current.entityCitationPageAssociationsTruncated
                      ? 'current-detail-capped'
                      : 'baseline-only';
              return {
                entity: identity.entity,
                aliases: identity.aliases,
                provider: identity.provider,
                ...(identity.month ? { month: identity.month } : {}),
                ...(identity.topic ? { topic: identity.topic } : {}),
                ...(identity.intent ? { intent: identity.intent } : {}),
                unlabeled: identity.unlabeled,
                url: identity.url,
                domain: identity.domain,
                owned: identity.owned,
                sampleState,
                baseline: before ?? null,
                current: after ?? null,
                mentionedPromptCoverageChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.promptCoveragePercent,
                        after.whenMentioned.promptCoveragePercent
                      )
                    : null,
                notMentionedPromptCoverageChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.promptCoveragePercent,
                        after.whenNotMentioned.promptCoveragePercent
                      )
                    : null,
                mentionedCitationEventShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.citationEventSharePercent,
                        after.whenMentioned.citationEventSharePercent
                      )
                    : null,
                notMentionedCitationEventShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.citationEventSharePercent,
                        after.whenNotMentioned.citationEventSharePercent
                      )
                    : null,
                mentionedTopThreeCitationShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenMentioned.citationListPosition?.topThreeCitationSharePercent,
                        after.whenMentioned.citationListPosition?.topThreeCitationSharePercent
                      )
                    : null,
                notMentionedTopThreeCitationShareChangePercentagePoints:
                  before && after
                    ? delta(
                        before.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent,
                        after.whenNotMentioned.citationListPosition?.topThreeCitationSharePercent
                      )
                    : null,
                promptCoverageAssociationChangePercentagePoints:
                  before && after
                    ? delta(
                        before.promptCoverageDifferencePercentagePoints,
                        after.promptCoverageDifferencePercentagePoints
                      )
                    : null,
              };
            })
            .sort(
              (left, right) =>
                Math.abs(right.mentionedPromptCoverageChangePercentagePoints ?? 0) -
                  Math.abs(left.mentionedPromptCoverageChangePercentagePoints ?? 0) ||
                (right.current?.whenMentioned.citationEvents ??
                  right.baseline?.whenMentioned.citationEvents ??
                  0) -
                  (left.current?.whenMentioned.citationEvents ??
                    left.baseline?.whenMentioned.citationEvents ??
                    0) ||
                left.entity.localeCompare(right.entity) ||
                left.provider.localeCompare(right.provider) ||
                left.url.localeCompare(right.url)
            );
          const rowsTruncated = changes.length > MAX_RETURNED_ENTITY_CITATION_PAGE_COMPARISON_ROWS;
          const sharedRows = changes.filter((row) => row.sampleState === 'both-periods').length;
          const baselineOnlyRetainedRows = changes.filter(
            (row) => row.sampleState === 'baseline-only'
          ).length;
          const currentOnlyRetainedRows = changes.filter(
            (row) => row.sampleState === 'current-only'
          ).length;
          const sourceTruncated =
            baseline.entityCitationPageAssociationsTruncated === true ||
            current.entityCitationPageAssociationsTruncated === true;
          return {
            baselineRetainedRows: baseline.entityCitationPageAssociations.length,
            currentRetainedRows: current.entityCitationPageAssociations.length,
            sharedRows,
            baselineOnlyRetainedRows,
            currentOnlyRetainedRows,
            baselineDetailTruncated: baseline.entityCitationPageAssociationsTruncated === true,
            currentDetailTruncated: current.entityCitationPageAssociationsTruncated === true,
            coverageComplete: !sourceTruncated && !rowsTruncated,
            rows: changes.slice(0, MAX_RETURNED_ENTITY_CITATION_PAGE_COMPARISON_ROWS),
            rowsTruncated,
            note: 'Rows match configured entity names and aliases, normalized provider/topic/intent labels, and the exact normalized citation URL. Mention and non-mention coverage use answer-text prompt denominators, and source placement uses citation events for that URL. One-sided rows describe sample presence; a source or output cap can hide additional rows. This is a descriptive comparison of supplied answer snapshots, not visibility or causal attribution.',
          };
        })()
      : undefined;
  const providerPagePositionComparison: AiAnswerCitationProviderPagePositionComparison | undefined =
    hasProviderPagePositions(baseline) && hasProviderPagePositions(current)
      ? (() => {
          type RetainedPosition = {
            provider: string;
            url: string;
            domain: string;
            metrics: AiAnswerCitationProviderPagePositionMetrics;
          };
          const collect = (
            report: AiAnswerCitationObservationReport
          ): Map<string, RetainedPosition> => {
            const positions = new Map<string, RetainedPosition>();
            for (const page of report.citedPages) {
              for (const profile of page.providerCitationListPositions ?? []) {
                const providerKey = profile.provider.toLocaleLowerCase('en-US');
                const key = JSON.stringify([providerKey, page.url]);
                positions.set(key, {
                  provider: profile.provider,
                  url: page.url,
                  domain: page.domain,
                  metrics: {
                    citationEvents: profile.citationEvents,
                    observedAnswers: profile.observedAnswers,
                    uniquePrompts: profile.uniquePrompts,
                    citationListPosition: profile.citationListPosition,
                  },
                });
              }
            }
            return positions;
          };
          const baselinePositions = collect(baseline);
          const currentPositions = collect(current);
          const keys = new Set([...baselinePositions.keys(), ...currentPositions.keys()]);
          const changes = [...keys]
            .map((key): AiAnswerCitationProviderPagePositionChange => {
              const before = baselinePositions.get(key);
              const after = currentPositions.get(key);
              const delta = (left: number | undefined, right: number | undefined): number | null =>
                left === undefined || right === undefined
                  ? null
                  : Number((right - left).toFixed(2));
              const positionRanges: AiAnswerCitationPositionBucket['range'][] = [
                '1',
                '2',
                '3',
                '4-5',
                '6-10',
                '11+',
              ];
              return {
                provider: after?.provider ?? before!.provider,
                url: after?.url ?? before!.url,
                domain: after?.domain ?? before!.domain,
                sampleState:
                  before && after ? 'both-periods' : before ? 'baseline-only' : 'current-only',
                baseline: before?.metrics ?? null,
                current: after?.metrics ?? null,
                citationEventsChange: delta(
                  before?.metrics.citationEvents,
                  after?.metrics.citationEvents
                ),
                meanPositionChange: delta(
                  before?.metrics.citationListPosition.meanPosition,
                  after?.metrics.citationListPosition.meanPosition
                ),
                firstPositionShareChangePercentagePoints: delta(
                  before?.metrics.citationListPosition.firstPositionCitationSharePercent,
                  after?.metrics.citationListPosition.firstPositionCitationSharePercent
                ),
                topThreeShareChangePercentagePoints: delta(
                  before?.metrics.citationListPosition.topThreeCitationSharePercent,
                  after?.metrics.citationListPosition.topThreeCitationSharePercent
                ),
                positionBucketChanges: positionRanges.map((range) => {
                  const baselineBucket = before?.metrics.citationListPosition.positionBuckets?.find(
                    (bucket) => bucket.range === range
                  );
                  const currentBucket = after?.metrics.citationListPosition.positionBuckets?.find(
                    (bucket) => bucket.range === range
                  );
                  const baselineSharePercent = baselineBucket?.citationSharePercent ?? null;
                  const currentSharePercent = currentBucket?.citationSharePercent ?? null;
                  return {
                    range,
                    baselineCitationEvents: baselineBucket?.citationEvents ?? null,
                    baselineSharePercent,
                    currentCitationEvents: currentBucket?.citationEvents ?? null,
                    currentSharePercent,
                    changePercentagePoints:
                      baselineSharePercent === null || currentSharePercent === null
                        ? null
                        : Number((currentSharePercent - baselineSharePercent).toFixed(2)),
                  };
                }),
              };
            })
            .sort((left, right) => {
              const movement = (row: AiAnswerCitationProviderPagePositionChange): number =>
                row.firstPositionShareChangePercentagePoints === null ||
                row.topThreeShareChangePercentagePoints === null
                  ? -1
                  : Math.max(
                      Math.abs(row.firstPositionShareChangePercentagePoints),
                      Math.abs(row.topThreeShareChangePercentagePoints)
                    );
              return (
                movement(right) - movement(left) ||
                (right.current?.citationEvents ?? right.baseline?.citationEvents ?? 0) -
                  (left.current?.citationEvents ?? left.baseline?.citationEvents ?? 0) ||
                left.provider.localeCompare(right.provider) ||
                left.url.localeCompare(right.url)
              );
            });
          const baselineOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'baseline-only'
          ).length;
          const currentOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'current-only'
          ).length;
          const rowsTruncated = changes.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS;
          return {
            baselineRetainedRows: baselinePositions.size,
            currentRetainedRows: currentPositions.size,
            sharedRows: changes.length - baselineOnlyRetainedRows - currentOnlyRetainedRows,
            baselineOnlyRetainedRows,
            currentOnlyRetainedRows,
            coverageComplete:
              !rowsTruncated && !baseline.citedPagesTruncated && !current.citedPagesTruncated,
            rows: changes.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
            rowsTruncated,
            note: 'Rows match case-normalized provider labels and exact normalized cited-page URLs in the retained page lists. Position deltas compare the supplied citation-array order within each provider; positive mean-position change means the page appeared later in the list. One-period-only rows indicate sample presence, not lost or gained visibility. Capped cited-page lists make the comparison incomplete, and none of these changes establish causation.',
          };
        })()
      : undefined;
  const coCitationComparison: AiAnswerCitationCoCitationPeriodComparison | undefined =
    baseline.coCitationSummary &&
    current.coCitationSummary &&
    baseline.coCitationDomains !== undefined &&
    current.coCitationDomains !== undefined
      ? (() => {
          interface RetainedCoCitation {
            scope: 'domain' | 'provider';
            domain: string;
            provider?: string;
            metrics: AiAnswerCitationCoCitationPeriodMetrics;
          }
          const collect = (
            report: AiAnswerCitationObservationReport
          ): Map<string, RetainedCoCitation> => {
            const rows = new Map<string, RetainedCoCitation>();
            for (const profile of report.coCitationDomains ?? []) {
              rows.set(JSON.stringify(['domain', profile.domain.toLowerCase()]), {
                scope: 'domain',
                domain: profile.domain,
                metrics: {
                  ownedCitationObservations: report.coCitationSummary!.ownedCitationObservations,
                  externalCitationEvents: report.coCitationSummary!.externalCitationEvents,
                  citationEvents: profile.citationEvents,
                  observedAnswers: profile.observedAnswers,
                  uniquePrompts: profile.uniquePrompts,
                  answerCoveragePercent: profile.answerCoveragePercent,
                  externalCitationEventSharePercent: profile.externalCitationEventSharePercent,
                },
              });
              for (const provider of profile.providerProfiles) {
                rows.set(
                  JSON.stringify([
                    'provider',
                    profile.domain.toLowerCase(),
                    provider.provider.toLocaleLowerCase('en-US'),
                  ]),
                  {
                    scope: 'provider',
                    domain: profile.domain,
                    provider: provider.provider,
                    metrics: {
                      ownedCitationObservations: provider.ownedCitationObservations,
                      externalCitationEvents: provider.externalCitationEvents,
                      citationEvents: provider.citationEvents,
                      observedAnswers: provider.observedAnswers,
                      uniquePrompts: provider.uniquePrompts,
                      answerCoveragePercent: provider.answerCoveragePercent,
                      externalCitationEventSharePercent: provider.externalCitationEventSharePercent,
                    },
                  }
                );
              }
            }
            return rows;
          };
          const baselineRows = collect(baseline);
          const currentRows = collect(current);
          const keys = new Set([...baselineRows.keys(), ...currentRows.keys()]);
          const delta = (
            before: number | null | undefined,
            after: number | null | undefined
          ): number | null =>
            before === null || before === undefined || after === null || after === undefined
              ? null
              : Number((after - before).toFixed(2));
          const changes = [...keys]
            .map((key): AiAnswerCitationCoCitationPeriodChange => {
              const before = baselineRows.get(key);
              const after = currentRows.get(key);
              const beforeMetrics = before?.metrics ?? null;
              const afterMetrics = after?.metrics ?? null;
              return {
                scope: after?.scope ?? before!.scope,
                domain: after?.domain ?? before!.domain,
                ...((after?.provider ?? before?.provider)
                  ? { provider: after?.provider ?? before?.provider }
                  : {}),
                sampleState:
                  before && after ? 'both-periods' : before ? 'baseline-only' : 'current-only',
                baseline: beforeMetrics,
                current: afterMetrics,
                citationEventsChange: delta(
                  beforeMetrics?.citationEvents,
                  afterMetrics?.citationEvents
                ),
                answerCoverageChangePercentagePoints: delta(
                  beforeMetrics?.answerCoveragePercent,
                  afterMetrics?.answerCoveragePercent
                ),
                externalCitationEventShareChangePercentagePoints: delta(
                  beforeMetrics?.externalCitationEventSharePercent,
                  afterMetrics?.externalCitationEventSharePercent
                ),
              };
            })
            .sort((left, right) => {
              const movement = (row: AiAnswerCitationCoCitationPeriodChange): number =>
                Math.max(
                  Math.abs(row.answerCoverageChangePercentagePoints ?? 0),
                  Math.abs(row.externalCitationEventShareChangePercentagePoints ?? 0)
                );
              return (
                movement(right) - movement(left) ||
                (right.current?.observedAnswers ?? right.baseline?.observedAnswers ?? 0) -
                  (left.current?.observedAnswers ?? left.baseline?.observedAnswers ?? 0) ||
                left.scope.localeCompare(right.scope) ||
                left.domain.localeCompare(right.domain) ||
                (left.provider ?? '').localeCompare(right.provider ?? '')
              );
            });
          const baselineOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'baseline-only'
          ).length;
          const currentOnlyRetainedRows = changes.filter(
            ({ sampleState }) => sampleState === 'current-only'
          ).length;
          const rowsTruncated = changes.length > MAX_RETURNED_PERIOD_COMPARISON_ROWS;
          const sourceDomainsTruncated =
            baseline.coCitationSummary!.domainsTruncated ||
            current.coCitationSummary!.domainsTruncated;
          return {
            baselineRetainedRows: baselineRows.size,
            currentRetainedRows: currentRows.size,
            sharedRows: changes.length - baselineOnlyRetainedRows - currentOnlyRetainedRows,
            baselineOnlyRetainedRows,
            currentOnlyRetainedRows,
            coverageComplete: !sourceDomainsTruncated && !rowsTruncated,
            rows: changes.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
            rowsTruncated,
            note: 'Rows match normalized external hostnames; provider rows also match case-normalized provider labels. Answer coverage uses owned-citing snapshots as its denominator, and event share uses external cited URL events within those snapshots. One-period-only rows describe retained sample presence, not visibility gains or losses. Source domain caps or comparison caps make coverage incomplete; co-occurrence does not establish endorsement, relationships, or causation.',
          };
        })()
      : undefined;
  const entityPromptComparison: AiAnswerCitationEntityPromptComparison | undefined =
    baseline.entityPromptProfiles !== undefined && current.entityPromptProfiles !== undefined
      ? (() => {
          const normalize = (value: string): string =>
            value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
          const keyOf = (profile: AiAnswerCitationEntityPromptProfile): string =>
            JSON.stringify([
              normalize(profile.entity),
              profile.aliases.map(normalize).sort(),
              normalize(profile.provider),
              normalize(profile.prompt),
            ]);
          const beforeRows = new Map(
            baseline.entityPromptProfiles!.map((profile) => [keyOf(profile), profile])
          );
          const afterRows = new Map(
            current.entityPromptProfiles!.map((profile) => [keyOf(profile), profile])
          );
          const keys = new Set([...beforeRows.keys(), ...afterRows.keys()]);
          const delta = (
            before: number | null | undefined,
            after: number | null | undefined
          ): number | null =>
            before === null || before === undefined || after === null || after === undefined
              ? null
              : Number((after - before).toFixed(2));
          const changes = [...keys]
            .map((key): AiAnswerCitationEntityPromptChange => {
              const before = beforeRows.get(key);
              const after = afterRows.get(key);
              const identity = after ?? before!;
              const sampleState: AiAnswerCitationEntityPromptChange['sampleState'] =
                before && after
                  ? 'both-periods'
                  : after
                    ? baseline.entityPromptProfilesTruncated
                      ? 'baseline-detail-capped'
                      : 'current-only'
                    : current.entityPromptProfilesTruncated
                      ? 'current-detail-capped'
                      : 'baseline-only';
              const matched = Boolean(before && after);
              return {
                entity: identity.entity,
                aliases: identity.aliases,
                provider: identity.provider,
                prompt: identity.prompt,
                sampleState,
                baseline: before ?? null,
                current: after ?? null,
                entityMentionRateChangePercentagePoints: matched
                  ? delta(before!.entityMentionRatePercent, after!.entityMentionRatePercent)
                  : null,
                anyCitationCoverageWhenMentionedChangePercentagePoints: matched
                  ? delta(
                      before!.anyCitationCoverageWhenMentionedPercent,
                      after!.anyCitationCoverageWhenMentionedPercent
                    )
                  : null,
                anyCitationCoverageWhenNotMentionedChangePercentagePoints: matched
                  ? delta(
                      before!.anyCitationCoverageWhenNotMentionedPercent,
                      after!.anyCitationCoverageWhenNotMentionedPercent
                    )
                  : null,
                ...(baseline.ownedDomains.length > 0
                  ? {
                      ownedCitationCoverageWhenMentionedChangePercentagePoints: matched
                        ? delta(
                            before!.ownedCitationCoverageWhenMentionedPercent,
                            after!.ownedCitationCoverageWhenMentionedPercent
                          )
                        : null,
                      ownedTopThreeCitationShareWhenMentionedChangePercentagePoints: matched
                        ? delta(
                            before!.ownedTopThreeCitationShareWhenMentionedPercent,
                            after!.ownedTopThreeCitationShareWhenMentionedPercent
                          )
                        : null,
                    }
                  : {}),
              };
            })
            .sort(
              (left, right) =>
                Math.max(
                  Math.abs(right.entityMentionRateChangePercentagePoints ?? 0),
                  Math.abs(right.ownedTopThreeCitationShareWhenMentionedChangePercentagePoints ?? 0)
                ) -
                  Math.max(
                    Math.abs(left.entityMentionRateChangePercentagePoints ?? 0),
                    Math.abs(
                      left.ownedTopThreeCitationShareWhenMentionedChangePercentagePoints ?? 0
                    )
                  ) ||
                (right.current?.observationsWithAnswerText ??
                  right.baseline?.observationsWithAnswerText ??
                  0) -
                  (left.current?.observationsWithAnswerText ??
                    left.baseline?.observationsWithAnswerText ??
                    0) ||
                left.entity.localeCompare(right.entity) ||
                left.provider.localeCompare(right.provider) ||
                left.prompt.localeCompare(right.prompt)
            );
          const rowsTruncated = changes.length > MAX_RETURNED_ENTITY_PROMPT_COMPARISON_ROWS;
          const sourceTruncated =
            baseline.entityPromptProfilesTruncated === true ||
            current.entityPromptProfilesTruncated === true;
          const baselineOnlyRowsHiddenByCap = changes.some(
            ({ sampleState }) => sampleState === 'baseline-detail-capped'
          );
          const currentOnlyRowsHiddenByCap = changes.some(
            ({ sampleState }) => sampleState === 'current-detail-capped'
          );
          return {
            baselineRetainedRows: beforeRows.size,
            currentRetainedRows: afterRows.size,
            sharedRows: changes.filter(({ sampleState }) => sampleState === 'both-periods').length,
            baselineOnlyRetainedRows: changes.filter(
              ({ sampleState }) => sampleState === 'baseline-only'
            ).length,
            currentOnlyRetainedRows: changes.filter(
              ({ sampleState }) => sampleState === 'current-only'
            ).length,
            baselineOnlyRowsHiddenByCap,
            currentOnlyRowsHiddenByCap,
            coverageComplete: !sourceTruncated && !rowsTruncated,
            rows: changes.slice(0, MAX_RETURNED_ENTITY_PROMPT_COMPARISON_ROWS),
            rowsTruncated,
            note: 'Rows match configured entity names and aliases, normalized provider labels, and exact prompts after case/whitespace normalization. Mention and citation rates use answer-text snapshots within each matched prompt/provider group; owned top-three share uses owned citation events in entity-mentioned answers. One-period-only rows describe sample presence, and cap-hidden absences are labeled separately. Changes describe supplied samples, not visibility or causal effects.',
          };
        })()
      : undefined;
  const entityCoMentionComparison: AiAnswerCitationEntityCoMentionPeriodComparison | undefined =
    baseline.entityCoMentionProfiles !== undefined && current.entityCoMentionProfiles !== undefined
      ? (() => {
          const normalize = (value: string): string =>
            value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
          const keyFor = (profile: AiAnswerCitationEntityCoMentionProfile): string =>
            JSON.stringify([
              normalize(profile.entity),
              normalize(profile.otherEntity),
              profile.scope,
              normalize(profile.provider ?? ''),
              profile.month ?? '',
              normalize(profile.topic ?? ''),
              normalize(profile.intent ?? ''),
              profile.unlabeled ?? false,
            ]);
          const beforeProfiles = new Map(
            baseline.entityCoMentionProfiles!.map((profile) => [keyFor(profile), profile])
          );
          const afterProfiles = new Map(
            current.entityCoMentionProfiles!.map((profile) => [keyFor(profile), profile])
          );
          const keys = new Set([...beforeProfiles.keys(), ...afterProfiles.keys()]);
          const metrics = (
            profile: AiAnswerCitationEntityCoMentionProfile | undefined
          ): AiAnswerCitationEntityCoMentionPeriodMetrics | null =>
            profile
              ? {
                  answerTextObservations: profile.answerTextObservations,
                  uniquePrompts: profile.uniquePrompts,
                  observationsMentioningEntity: profile.observationsMentioningEntity,
                  observationsMentioningOtherEntity: profile.observationsMentioningOtherEntity,
                  observationsMentioningBoth: profile.observationsMentioningBoth,
                  coMentionRatePercent: profile.coMentionRatePercent,
                  coMentionRateConfidenceInterval95Percent:
                    profile.coMentionRateConfidenceInterval95Percent,
                  coMentionGivenEntityPercent: profile.coMentionGivenEntityPercent,
                  coMentionGivenEntityConfidenceInterval95Percent:
                    profile.coMentionGivenEntityConfidenceInterval95Percent,
                  coMentionGivenOtherEntityPercent: profile.coMentionGivenOtherEntityPercent,
                  coMentionGivenOtherEntityConfidenceInterval95Percent:
                    profile.coMentionGivenOtherEntityConfidenceInterval95Percent,
                  snapshotJaccardPercent: profile.snapshotJaccardPercent,
                  independentExpectedCoMentionRatePercent:
                    profile.independentExpectedCoMentionRatePercent,
                  coMentionLift: profile.coMentionLift,
                  uniquePromptsMentioningEntity: profile.uniquePromptsMentioningEntity,
                  uniquePromptsMentioningOtherEntity: profile.uniquePromptsMentioningOtherEntity,
                  uniquePromptsMentioningBoth: profile.uniquePromptsMentioningBoth,
                  promptJaccardPercent: profile.promptJaccardPercent,
                }
              : null;
          const delta = (
            before: number | null | undefined,
            after: number | null | undefined
          ): number | null =>
            before === null || before === undefined || after === null || after === undefined
              ? null
              : Number((after - before).toFixed(2));
          const rows = [...keys]
            .map((key): AiAnswerCitationEntityCoMentionPeriodRow => {
              const beforeProfile = beforeProfiles.get(key);
              const afterProfile = afterProfiles.get(key);
              const before = metrics(beforeProfile);
              const after = metrics(afterProfile);
              const source = afterProfile ?? beforeProfile!;
              const sampleState: AiAnswerCitationEntityCoMentionPeriodRow['sampleState'] =
                beforeProfile && afterProfile
                  ? 'matched'
                  : !beforeProfile && baseline.entityCoMentionProfilesTruncated
                    ? 'baseline-detail-capped'
                    : !afterProfile && current.entityCoMentionProfilesTruncated
                      ? 'current-detail-capped'
                      : beforeProfile
                        ? 'baseline-only'
                        : 'current-only';
              return {
                entity: source.entity,
                aliases: source.aliases,
                otherEntity: source.otherEntity,
                otherAliases: source.otherAliases,
                scope: source.scope,
                ...(source.provider ? { provider: source.provider } : {}),
                ...(source.month ? { month: source.month } : {}),
                ...(source.topic ? { topic: source.topic } : {}),
                ...(source.intent ? { intent: source.intent } : {}),
                ...(source.unlabeled === undefined ? {} : { unlabeled: source.unlabeled }),
                sampleState,
                baseline: before,
                current: after,
                coMentionRateChangePercentagePoints: delta(
                  before?.coMentionRatePercent,
                  after?.coMentionRatePercent
                ),
                coMentionGivenEntityChangePercentagePoints: delta(
                  before?.coMentionGivenEntityPercent,
                  after?.coMentionGivenEntityPercent
                ),
                coMentionGivenOtherEntityChangePercentagePoints: delta(
                  before?.coMentionGivenOtherEntityPercent,
                  after?.coMentionGivenOtherEntityPercent
                ),
                snapshotJaccardChangePercentagePoints: delta(
                  before?.snapshotJaccardPercent,
                  after?.snapshotJaccardPercent
                ),
                promptJaccardChangePercentagePoints: delta(
                  before?.promptJaccardPercent,
                  after?.promptJaccardPercent
                ),
                coMentionLiftChange: delta(before?.coMentionLift, after?.coMentionLift),
              };
            })
            .sort(
              (left, right) =>
                Math.abs(right.coMentionRateChangePercentagePoints ?? 0) -
                  Math.abs(left.coMentionRateChangePercentagePoints ?? 0) ||
                (right.current?.observationsMentioningBoth ??
                  right.baseline?.observationsMentioningBoth ??
                  0) -
                  (left.current?.observationsMentioningBoth ??
                    left.baseline?.observationsMentioningBoth ??
                    0) ||
                left.scope.localeCompare(right.scope) ||
                left.entity.localeCompare(right.entity) ||
                left.otherEntity.localeCompare(right.otherEntity) ||
                (left.provider ?? '').localeCompare(right.provider ?? '')
            );
          const rowsTruncated = rows.length > MAX_RETURNED_ENTITY_CO_MENTION_PERIOD_ROWS;
          const profilesTruncated =
            baseline.entityCoMentionProfilesTruncated === true ||
            current.entityCoMentionProfilesTruncated === true;
          return {
            rows: rows.slice(0, MAX_RETURNED_ENTITY_CO_MENTION_PERIOD_ROWS),
            rowsTruncated,
            coverageComplete: !profilesTruncated && !rowsTruncated,
            note: 'Rows match normalized ordered entity pairs and normalized provider labels. Missing rows are sample-presence states; if either source profile list was capped, an absent pair is marked detail-capped and rates are unavailable. Pair-rate, Jaccard, and lift deltas describe captured answer text only, not visibility gain, semantic relationships, or causation.',
          };
        })()
      : undefined;
  return {
    baselineObservations: baseline.summary.observations,
    currentObservations: current.summary.observations,
    ...(baseline.summary.incompleteCitationListObservations !== undefined &&
    current.summary.incompleteCitationListObservations !== undefined
      ? {
          citationListCompletenessComparison: {
            baselineIncompleteObservations: baseline.summary.incompleteCitationListObservations,
            baselineIncompletePercent: Number(
              (
                (baseline.summary.incompleteCitationListObservations /
                  baseline.summary.observations) *
                100
              ).toFixed(4)
            ),
            currentIncompleteObservations: current.summary.incompleteCitationListObservations,
            currentIncompletePercent: Number(
              (
                (current.summary.incompleteCitationListObservations /
                  current.summary.observations) *
                100
              ).toFixed(4)
            ),
            incompleteShareChangePercentagePoints: Number(
              (
                (current.summary.incompleteCitationListObservations / current.summary.observations -
                  baseline.summary.incompleteCitationListObservations /
                    baseline.summary.observations) *
                100
              ).toFixed(4)
            ),
          },
        }
      : {}),
    baselineRetainedProviderPromptGroups: baselineProfiles.size,
    currentRetainedProviderPromptGroups: currentProfiles.size,
    sharedProviderPromptGroups: sharedKeys.length,
    providerPromptGroupsOnlyInBaselineRetainedDetail: onlyBaseline.length,
    providerPromptGroupsOnlyInCurrentRetainedDetail: onlyCurrent.length,
    providerPromptCoverageComplete:
      !baseline.promptsTruncated && !current.promptsTruncated && !promptsTruncated,
    sharedGroupsWithCitationCoverageIncrease: increases,
    sharedGroupsWithCitationCoverageDecrease: decreases,
    sharedGroupsWithNoCitationCoverageChange: unchanged,
    prompts: changes.slice(0, MAX_RETURNED_PERIOD_COMPARISON_ROWS),
    promptsTruncated,
    topicIntentComparison,
    ...(entityMentionComparison ? { entityMentionComparison } : {}),
    ...(entityPromptComparison ? { entityPromptComparison } : {}),
    ...(entityCoMentionComparison ? { entityCoMentionComparison } : {}),
    ...(pathFamilyComparison ? { pathFamilyComparison } : {}),
    ...(pathFamilyCohortComparison ? { pathFamilyCohortComparison } : {}),
    ...(entityPathFamilyComparison ? { entityPathFamilyComparison } : {}),
    ...(entityCitationPageComparison ? { entityCitationPageComparison } : {}),
    ...(providerPagePositionComparison ? { providerPagePositionComparison } : {}),
    ...(coCitationComparison ? { coCitationComparison } : {}),
    ...(ownedCitationCoverageComparison ? { ownedCitationCoverageComparison } : {}),
    ...(ownedCitationReachCompletenessBounds ? { ownedCitationReachCompletenessBounds } : {}),
    ...(ownedPromptRankComparison ? { ownedPromptRankComparison } : {}),
    note: `This comparison joins exact prompt text after case/whitespace normalization and provider labels after case normalization. Citation coverage uses observations in each matched provider/prompt group as its denominator; displayed rates round to two decimals while increase/decrease totals use the exact observation fractions. Owned-domain coverage appears only when the same owned domains were configured for both samples. Rows are ordered by absolute observed coverage change and sample size for review, not as a priority or performance ranking. Domain lists show each group's top ten observed domains and may be capped. Citation-domain HHI is the sum of squared normalized URL citation-event shares grouped by hostname; its reciprocal is an effective domain count. These describe the sample source mix, not source quality or authority. Only provider/prompt groups in retained prompt detail are compared; when either source report or the returned rows are truncated, group totals and unmatched counts are incomplete. Changes and domain presence describe the collected snapshots only: sampling differences, provider/model changes, prompt execution conditions, and time windows can affect them, and missing groups/domains do not prove visibility was gained or lost.`,
  };
}
