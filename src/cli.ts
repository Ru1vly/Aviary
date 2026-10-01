#!/usr/bin/env node

import {
  SEOChecker,
  auditUrls,
  watchUrls,
  discoverSitemapUrls,
  discoverLinkedUrls,
  filterUrlsByRobotsTxt,
  createSitemapDiscoveryCache,
  createSiteCrawlCache,
  analyzeSiteWideCanonicals,
  analyzeSiteWideContent,
  analyzeSiteWideGeo,
  renderSiteWideGeoCsv,
  renderSiteWideGeoEntityVariantsCsv,
  renderSiteWideGeoCrawlerAccessCsv,
  analyzeSiteWideHreflang,
  analyzeSiteWideLinkGraph,
  analyzeSiteWideMetadata,
} from './index';
import {
  generateHtmlReport,
  generatePdfReport,
  generateJunitReport,
  generateMarkdownReport,
  generateCsvReport,
  generateSarifReport,
  generateBatchJunitReport,
  generateBatchSarifReport,
  generateBatchMarkdownReport,
  generateBatchHtmlReport,
  generateBatchPdfReport,
  generateBatchCsvReport,
  generatePdfFromHtml,
} from './reporter';
import { CHECKER_REGISTRY } from './checkers/registry';
import {
  calculateWeightedScore,
  compareSEOAuditBatches,
  compareSEOReports,
  evaluateSEOAuditGeoChangeGate,
  renderGeoSignalChangesCsv,
} from './scoring';
import type {
  SEOAuditBatchComparison,
  SEOAuditGeoGateEvaluation,
  SEOAuditGeoSignalChange,
  SEOAuditGeoSignalFilters,
  SEOReportComparison,
} from './scoring';
import {
  appendSEOAuditBatchHistory,
  appendSEOReportHistory,
  generateSEOAuditHistoryReportFromFile,
} from './history';
import type { SEOAuditBatchReport, SEOCheckResult, SEOReport } from './types';
import type { SiteWideGeoAnalysis } from './sitewide';
import * as fs from 'fs';
import * as path from 'path';
import { loadEnvConfig } from './config/env';
import { ConfigLoader } from './config';
import { categorizeError, ErrorCategory } from './errors/types';
import { createLogger } from './config/logger';
import { expandUrlListFiles } from './utils/fileGlob';
import { pathsReferToSameFile } from './utils/filePath';
import { renderShellCompletion, type CompletionShell } from './completions';
import * as http from 'http';
import * as client from 'prom-client';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { AVIARY_CRAWLER_USER_AGENT } from './robots';
import {
  analyzeBingAiQueryPageMapping,
  analyzeBingAiTopicIntentIntersections,
  compareBingAiPageCitationExports,
  compareBingAiQueryPageMappings,
  compareBingAiTopicIntentExports,
  correlateBingAiCitationsWithAudit,
  parseBingAiPerformanceCsvExport,
  summarizeBingAiPerformanceExport,
} from './geo/bingAiPerformance';
import type { BingAiPerformanceExport } from './geo/bingAiPerformance';
import { parseBingAiPerformanceXlsxExport } from './geo/bingAiWorkbook';
import { parseGoogleAiPerformanceXlsxExport } from './geo/googleAiWorkbook';
import { renderBingAiPerformanceHtml } from './geo/bingAiReporter';
import {
  compareGoogleAiDimensionExports,
  compareGoogleAiPerformanceExports,
  correlateGoogleAiPerformanceWithAudit,
  parseGoogleAiPerformanceCsvExport,
  summarizeGoogleAiPerformanceExport,
} from './geo/googleAiPerformance';
import type { GoogleAiPerformanceExport } from './geo/googleAiPerformance';
import {
  renderGoogleAiPerformanceCsv,
  renderGoogleAiPerformanceHtml,
} from './geo/googleAiReporter';
import {
  compareGoogleAiSurfaceMatrices,
  compareGoogleAiSurfacePageObservations,
  isGoogleSurfacePageMatrix,
} from './geo/googleSurfaceMatrix';
import {
  renderGoogleSurfaceMatrixCsv,
  renderGoogleSurfaceMatrixHtml,
  renderGoogleSurfacePathFamilyCsv,
} from './geo/googleSurfaceMatrixReporter';
import {
  compareAiPlatformPageMatrices,
  compareAiPlatformPageObservations,
  isAiPlatformPageMatrix,
} from './geo/platformMatrix';
import {
  renderAiPlatformPageMatrixCsv,
  renderAiPlatformPageMatrixHtml,
} from './geo/platformMatrixReporter';
import {
  analyzeAiCrawlerAccessLog,
  analyzeAiCrawlerLogRobotsPolicy,
  analyzeAiCrawlerRobotsAuditReplay,
  analyzeAiCrawlerSitemapRecrawlCoverage,
  compareAiCrawlerRobotsAuditReplays,
  compareAiCrawlerRobotsPolicyReplays,
  correlateAiCrawlerAccessLogWithGeoAudit,
} from './geo/aiCrawlerLogs';
import {
  renderAiCrawlerAccessLogHtml,
  renderAiCrawlerRobotsAuditReplayHtml,
} from './geo/aiCrawlerLogsReporter';
import {
  assessAiCrawlerPathFamilyFailureRise,
  renderAiCrawlerPathFamiliesCsv,
  renderAiCrawlerPathFamiliesJsonFromCsv,
  renderAiCrawlerPathFamiliesHtml,
  renderAiCrawlerPathFamilyAuditCorrelationCsv,
  renderAiCrawlerPathFamilyAuditCorrelationJsonFromCsv,
  renderAiCrawlerPathFamilyAuditCorrelationHtml,
  renderAiCrawlerPathFamilyAuditComparisonCsv,
  renderAiCrawlerPathFamilyAuditComparisonJsonFromCsv,
  renderAiCrawlerPathFamilyAuditComparisonHtml,
  renderAiCrawlerPathFamilyFailureGateJson,
  renderAiCrawlerPathFamilyPeriodComparisonCsv,
  renderAiCrawlerPathFamilyPeriodComparisonJsonFromCsv,
  renderAiCrawlerPathFamilyPeriodComparisonHtml,
} from './geo/aiCrawlerPathFamilies';
import { compareAiCrawlerAccessLogs } from './geo/aiCrawlerLogComparison';
import type {
  AiCrawlerAccessLogAnalysis,
  AiCrawlerCloudFrontResultProfile,
  AiCrawlerIpRangeDefinition,
  AiCrawlerLogGeoCorrelation,
  AiCrawlerResponseTiming,
} from './geo/aiCrawlerLogs';
import type { SitemapPageEntry } from './crawler';
import {
  analyzeAiAnswerCitationObservations,
  compareAiAnswerCitationObservationPeriods,
  correlateAiAnswerCitationObservationsWithAudit,
  correlateAiAnswerCitationObservationsWithCrawlerLogs,
} from './geo/answerCitationObservations';
import {
  renderAiAnswerCitationPromptFamiliesCsv,
  renderAiAnswerCitationPromptFamiliesHtml,
  renderAiAnswerCitationPromptFamilyInfluenceCsv,
  renderAiAnswerCitationPromptFamilyInfluenceHtml,
  renderAiAnswerCitationPromptFamilySourceRarefactionCsv,
  renderAiAnswerCitationPromptFamilySourceRarefactionPanelHtml,
  renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepCsv,
  renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepHtml,
  renderAiAnswerCitationPromptFamilyThresholdSweepCsv,
  renderAiAnswerCitationPromptFamilyThresholdSweepHtml,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapCsv,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapHtml,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepCsv,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepHtml,
  renderAiAnswerCitationPromptFamilyPeriodComparisonCsv,
  renderAiAnswerCitationPromptFamilyPeriodComparisonHtml,
  renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepCsv,
  renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepSummaryCsv,
  renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepHtml,
  renderAiAnswerCitationPromptSimilarityCsv,
} from './geo/answerCitationPromptSimilarity';
import {
  assessAiAnswerCitationDomainPairedReachDropGateFromCsv,
  renderAiAnswerCitationDomainPairedReachComparisonCsv,
  renderAiAnswerCitationDomainPairedReachComparisonJsonFromCsv,
  renderAiAnswerCitationDomainPairedReachDropGateJson,
} from './geo/answerCitationDomainPairedReach';
import {
  assessAiAnswerCitationPageOpportunityMonthlyRiseGateFromCsv,
  assessAiAnswerCitationPagePairedReachDropGate,
  assessAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateFromCsv,
  compareAiAnswerCitationPagePairedReach,
  renderAiAnswerCitationPageOpportunitiesCsv,
  renderAiAnswerCitationPageOpportunityMonthlyRiseGateJson,
  renderAiAnswerCitationPageOpportunityPathFamiliesCsv,
  renderAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateJson,
  renderAiAnswerCitationPageOpportunityPathFamilyDepthSweepCsv,
  renderAiAnswerCitationPageOpportunityPathFamilyDepthSweepHtmlFromCsv,
  renderAiAnswerCitationPageOpportunityPathFamilyTrendsCsv,
  renderAiAnswerCitationPageOpportunityPathFamilyTrendsHtmlFromCsv,
  renderAiAnswerCitationPageOpportunityTrendsCsv,
  renderAiAnswerCitationPagePairedReachComparisonCsv,
  renderAiAnswerCitationPagePairedReachComparisonJson,
  renderAiAnswerCitationPagePairedReachDropGateJson,
} from './geo/answerCitationPagePairedReach';
import {
  renderAiAnswerCitationEntityPromptMatchedAssociationCsv,
  renderAiAnswerCitationEntityPromptMatchedAssociationHtmlFromCsv,
} from './geo/entityPromptMatchedCitationAssociation';
import {
  analyzeGoogleAiCitationConcordance,
  renderGoogleAiCitationConcordanceCsv,
  renderGoogleAiCitationConcordanceHtml,
  renderGoogleAiCitationConcordancePathDepthSweepCsv,
  renderGoogleAiCitationConcordancePathFamilyCsv,
  renderGoogleAiCitationConcordanceProviderCsv,
} from './geo/googleAiCitationConcordance';
import {
  compareGoogleAiCitationConcordanceReports,
  isGoogleAiCitationConcordanceReport,
  renderGoogleAiCitationConcordanceComparisonCsv,
  renderGoogleAiCitationConcordanceComparisonHtml,
  renderGoogleAiCitationConcordanceProviderComparisonCsv,
} from './geo/googleAiCitationConcordanceComparison';
import type { AiAnswerCitationObservationInputFile } from './geo/answerCitationObservations';
import { renderAiAnswerCitationSourceRarefactionCsv } from './geo/answerCitationSourceRarefaction';
import {
  renderAiAnswerCitationSourceDiversityComparisonCsv,
  renderAiAnswerCitationSourceDiversityComparisonHtml,
  renderAiAnswerCitationSourceDiversityUncertaintyCsv,
  renderAiAnswerCitationSourceDiversityUncertaintyHtml,
} from './geo/answerCitationSourceDiversityUncertainty';
import { renderAiAnswerCitationProviderSourceDivergenceCsv } from './geo/answerCitationProviderSourceDivergence';
import { renderAiAnswerCitationSourceCategoryShareTrendsCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationSourceCategoryShareTrendsHtml } from './geo/answerCitationObservationsReporter';
import {
  renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv,
  renderAiAnswerCitationAuditedOwnedPageProviderInventoryHtmlFromCsv,
  renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv,
  renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonHtmlFromCsv,
  renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonJsonFromCsv,
} from './geo/answerCitationObservationsReporter';
import { assessAiAnswerCitationSourceCategoryMonthlyJsdGate } from './geo/answerCitationObservationsReporter';
import { assessAiAnswerCitationSourceCategoryMonthlyHhiRiseGate } from './geo/answerCitationObservationsReporter';
import { assessAiAnswerCitationSourceCategoryMonthlyHhiAboveGate } from './geo/answerCitationObservationsReporter';
import { assessAiAnswerCitationSourceCategoryPromptBalancedJsdGate } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationSourceCategoryPromptBalancedJsdGateJson } from './geo/answerCitationObservationsReporter';
import { assessAiAnswerCitationSourceCategoryShareDropGate } from './geo/answerCitationObservationsReporter';
import {
  assessAiAnswerCitationOwnedSourceShareDrop,
  renderAiAnswerCitationOwnedSourceShareGateCsv,
  renderAiAnswerCitationSourcePortfolioDriftCsv,
  renderAiAnswerCitationSourcePortfolioDriftHtmlFromCsv,
  renderAiAnswerCitationSourcePortfolioDriftJsonFromCsv,
  renderAiAnswerCitationSourcePortfolioAttributionArtifacts,
  renderAiAnswerCitationOwnedSourceShareGateJson,
} from './geo/answerCitationSourcePortfolioDrift';
import {
  renderAiAnswerCitationSourceNetworkComparisonCsv,
  renderAiAnswerCitationSourceNetworkCsv,
} from './geo/answerCitationSourceNetwork';
import {
  renderAiAnswerCitationRankWeightedSourceNetworkComparisonCsv,
  renderAiAnswerCitationRankWeightedSourceNetworkCsv,
} from './geo/answerCitationRankWeightedSourceNetwork';
import { renderAiAnswerCitationSourceNetworkHtml } from './geo/answerCitationSourceNetworkReporter';
import { renderAiAnswerCitationSourceNetworkComparisonHtml } from './geo/answerCitationSourceNetworkComparisonReporter';
import {
  renderAiAnswerCitationProviderSourceNetworkEdgeComparisonCsv,
  renderAiAnswerCitationProviderSourceNetworkOverlapCsv,
} from './geo/answerCitationProviderSourceNetworkOverlap';
import { renderAiAnswerCitationOwnedSourceNetworkGapsCsv } from './geo/answerCitationOwnedSourceNetworkGaps';
import { renderAiAnswerCitationProviderSourceNetworkEdgeHtml } from './geo/answerCitationProviderSourceNetworkEdgeReporter';
import { renderAiAnswerCitationProviderSourceNetworkEdgeDriftCsv } from './geo/answerCitationProviderSourceNetworkEdgeDrift';
import { renderAiAnswerCitationProviderSourceNetworkEdgeDriftHtml } from './geo/answerCitationProviderSourceNetworkEdgeDriftReporter';
import {
  renderAiAnswerCitationObservationComparisonCsv,
  renderAiAnswerCitationObservationHtml,
  renderAiAnswerCitationTopicIntentCohortsCsv,
  renderAiAnswerCitationTopicIntentComparisonCsv,
  renderAiAnswerCitationTopicIntentProviderPairsCsv,
  renderAiAnswerCitationProviderSampleMixCsv,
  renderAiAnswerCitationTopicIntentProviderMonthlyCsv,
  renderAiAnswerCitationAuditSignalsCsv,
  renderAiAnswerCitationAuditedOwnedPagesCsv,
  renderAiAnswerCitationAuditedOwnedPageComparisonCsv,
  renderAiAnswerCitationAuditedOwnedPageProvidersCsv,
  renderAiAnswerCitationAuditedOwnedPageProviderComparisonCsv,
  renderAiAnswerCitationSourceCategoriesCsv,
  renderAiAnswerCitationSourceCategoryMappingAuditCsv,
  renderAiAnswerCitationSourceCategoryComparisonCsv,
  renderAiAnswerCitationSourceCategoryPromptCoverageCsv,
  renderAiAnswerCitationSourceCategoryPromptDetailsCsv,
  renderAiAnswerCitationSourceCategoryTrendsCsv,
  renderAiAnswerCitationSourceCategoryProviderPairsCsv,
  renderAiAnswerCitationSourceCategoryCooccurrenceCsv,
  renderAiAnswerCitationSourceCategoryPathFamiliesCsv,
  renderAiAnswerCitationSourceCategoryPathFamilyComparisonCsv,
  renderAiAnswerCitationListPositionsCsv,
  renderAiAnswerCitationDomainPromptCoverageCsv,
  renderAiAnswerCitationDomainPromptCoverageComparisonCsv,
  renderAiAnswerCitationOwnedRankCsv,
  renderAiAnswerCitationOwnedPromptCoverageCsv,
  renderAiAnswerCitationOwnedPromptReachPeriodCsv,
  renderAiAnswerCitationOwnedPromptOpportunitiesCsv,
  renderAiAnswerCitationCompetitiveGapsCsv,
  renderAiAnswerCitationProviderOwnedGapsCsv,
  renderAiAnswerCitationProviderOwnedGapComparisonCsv,
  renderAiAnswerCitationCompetitiveGapComparisonCsv,
  renderAiAnswerCitationOwnedRankComparisonCsv,
  renderAiAnswerCitationOwnedPromptRankComparisonCsv,
  renderAiAnswerCitationCoCitationCsv,
  renderAiAnswerCitationCoCitationComparisonCsv,
  renderAiAnswerCitationTemporalStabilityCsv,
  renderAiAnswerCitationSourcePersistenceCsv,
  renderAiAnswerCitationUrlPersistenceCsv,
  renderAiAnswerCitationEntityMentionsCsv,
  renderAiAnswerCitationEntityPromptDetailsCsv,
  renderAiAnswerCitationEntityPromptProviderPairsCsv,
  renderAiAnswerCitationEntityPromptComparisonCsv,
  renderAiAnswerCitationEntityCoMentionsCsv,
  renderAiAnswerCitationEntityCoMentionComparisonCsv,
  renderAiAnswerCitationEntityCitationDomainsCsv,
  renderAiAnswerCitationEntityCitationPagesCsv,
  renderAiAnswerCitationEntityCitationDomainComparisonCsv,
  renderAiAnswerCitationEntityCitationPageComparisonCsv,
  renderAiAnswerCitationEntityCitationPositionComparisonCsv,
  renderAiAnswerCitationEntityOpportunitiesCsv,
  renderAiAnswerCitationPathFamiliesCsv,
  renderAiAnswerCitationPathFamilyComparisonCsv,
  renderAiAnswerCitationCrawlerLogMatchesCsv,
  renderAiAnswerCitationProviderPagePositionComparisonCsv,
  normalizeSourceCategoryMappings,
} from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationEntitySourceCategoriesCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationSourceCategoryMixDecompositionCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationSourceCategoryConcentrationTrendsCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationSourceCategoryConcentrationTrendsHtml } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationSourceCategoryMixDecompositionHtml } from './geo/answerCitationObservationsReporter';
import {
  renderAiAnswerCitationAnswerLengthProfilesCsv,
  renderAiAnswerCitationAnswerLengthComparisonCsv,
  renderAiAnswerCitationAnswerLengthTrendsCsv,
} from './geo/answerCitationObservationsReporter';
import {
  renderAiAnswerCitationCohortStandardizationCsv,
  renderAiAnswerCitationCohortPeriodStandardizationCsv,
  renderAiAnswerCitationPromptSamplingPlanCsv,
  renderAiAnswerCitationPromptSamplingPlanJson,
  renderAiAnswerCitationPromptPlanProviderPairsCsv,
  renderAiAnswerCitationExecutionContextCsv,
  renderAiAnswerCitationExecutionContextCoverageCsv,
} from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationPathFamilyCohortsCsv } from './geo/answerCitationObservationsReporter';
import { summarizeAiAnswerCitationPromptPlanTargets } from './geo/answerCitationObservationsReporter';
import { parseAiAnswerCitationPromptPlanCohortTargets } from './geo/answerCitationObservationsReporter';
import type { AiAnswerCitationPromptPlanTotalPairAllocation } from './geo/answerCitationObservationsReporter';
import {
  getAiAnswerCitationProviderPromptOverlapProfiles,
  renderAiAnswerCitationProviderPromptOverlapCsv,
  renderAiAnswerCitationProviderPromptSourceOverlapCsv,
} from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationPathFamilyCohortComparisonCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationPathFamilyTrendsCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationDateModifiedAlignmentCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationEntitySourceCategoryComparisonCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationEntityPathFamiliesCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationEntityPathFamilyComparisonCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationEntityPathFamilyMonthlyCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationExecutionContextComparisonCsv } from './geo/answerCitationObservationsReporter';
import { renderAiAnswerCitationExecutionContextTrendsCsv } from './geo/answerCitationObservationsReporter';

const MAX_URL_LIST_ENTRIES = 10_000;
const MAX_URL_LIST_BYTES = 25 * 1024 * 1024;

function bootstrapPairedMeanDeltaConfidenceInterval95(
  values: number[],
  seedText: string
): { lower: number; upper: number } | null {
  if (values.length < 2) return null;
  let seed = 2166136261;
  for (const character of seedText)
    seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  if (seed === 0) seed = 0x6d2b79f5;
  let state = seed;
  const iterations = 1_000;
  const means = new Array<number>(iterations);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;
    for (let sample = 0; sample < values.length; sample += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      total += values[Math.floor((state / 0x1_0000_0000) * values.length)]!;
    }
    means[iteration] = total / values.length;
  }
  means.sort((left, right) => left - right);
  return {
    lower: Number(means[Math.floor((iterations - 1) * 0.025)]!.toFixed(2)),
    upper: Number(means[Math.ceil((iterations - 1) * 0.975)]!.toFixed(2)),
  };
}

const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

function startMetricsServer(): void {
  const configuredPort = process.env.AVIARY_METRICS_PORT?.trim();
  const metricsPort = configuredPort ? Number(configuredPort) : 9090;
  if (!Number.isInteger(metricsPort) || metricsPort < 1 || metricsPort > 65_535) {
    process.stderr.write('❌ AVIARY_METRICS_PORT must be an integer from 1 to 65,535.\n');
    process.exit(2);
  }
  client.collectDefaultMetrics();
  metricsServer.on('error', (error: NodeJS.ErrnoException) => {
    process.stderr.write(
      `⚠️ Prometheus metrics are unavailable on 127.0.0.1:${metricsPort}: ${error.message}\n`
    );
  });
  metricsServer.listen(metricsPort, '127.0.0.1');
  metricsServer.unref();
}

function formatSiteWideGeoSummary(analysis: ReturnType<typeof analyzeSiteWideGeo>): string {
  const crawlerCoverage = analysis.searchCrawlerCoverage
    .map(
      ({ token, allowedPages, blockedPages, unassessedPages }) =>
        `${token}: ${allowedPages} allowed, ${blockedPages} blocked, ${unassessedPages} unassessed`
    )
    .join('; ');
  const dataUseCoverage = analysis.dataUseCrawlerPolicy
    .map(
      ({ token, allowedPages, blockedPages, unassessedPages }) =>
        `${token}: ${allowedPages} allowed, ${blockedPages} blocked, ${unassessedPages} unassessed`
    )
    .join('; ');
  const userFetchCoverage = (analysis.userInitiatedFetchPolicy ?? [])
    .map(
      ({ token, allowedPages, blockedPages, unassessedPages }) =>
        `${token}: ${allowedPages} allowed, ${blockedPages} blocked, ${unassessedPages} unassessed`
    )
    .join('; ');
  const noArchiveCoverage = (analysis.dataUseNoArchiveCoverage ?? [])
    .map(
      ({ token, pagesWithNoArchive, pagesAssessed }) =>
        `${token}: ${pagesWithNoArchive}/${pagesAssessed} audited pages have a noarchive directive`
    )
    .join('; ');
  const optionalFiles =
    analysis.optionalLlmsFiles
      .map(
        ({
          path: file,
          pagesFound,
          pagesAbsent,
          pagesUnconfirmed,
          pagesUnassessed,
          linkTargetTotals,
        }) =>
          file +
          ': ' +
          pagesFound +
          ' found, ' +
          pagesAbsent +
          ' absent, ' +
          pagesUnconfirmed +
          ' unconfirmed, ' +
          pagesUnassessed +
          ' unassessed' +
          (linkTargetTotals && linkTargetTotals.profilesMeasured > 0
            ? '; ' +
              linkTargetTotals.profilesMeasured +
              ' link profile(s), ' +
              linkTargetTotals.markdownLinks +
              ' Markdown links / ' +
              linkTargetTotals.uniqueWebTargets +
              ' unique web targets (' +
              linkTargetTotals.duplicateWebTargets +
              ' repeated), ' +
              linkTargetTotals.sameOriginWebLinks +
              ' same-origin, ' +
              linkTargetTotals.externalHttpsLinks +
              ' external HTTPS, ' +
              linkTargetTotals.externalHttpLinks +
              ' external HTTP, ' +
              linkTargetTotals.relativeLinks +
              ' relative, ' +
              linkTargetTotals.unsupportedSchemeLinks +
              ' unsupported-scheme, ' +
              linkTargetTotals.invalidTargets +
              ' invalid, ' +
              linkTargetTotals.emptyLabels +
              ' empty-label, ' +
              linkTargetTotals.malformedLinkCandidates +
              ' malformed' +
              (linkTargetTotals.truncatedProfiles > 0
                ? '; first-64-KiB content cap affected ' +
                  linkTargetTotals.truncatedProfiles +
                  ' profile(s)'
                : '')
            : '; link structure not sampled')
      )
      .join('; ') || 'not assessed';
  const sourceHosts = analysis.sourceHostCoverage
    .slice(0, 5)
    .map(
      ({ host, pagesLinked, observedLinks }) =>
        `${host} (${pagesLinked} page(s)${observedLinks === undefined ? '' : `, ${observedLinks} retained links`})`
    )
    .join(', ');
  const content = analysis.contentProfile;
  const entities = analysis.entityAnalysis;
  const sameAsHosts = entities.sameAsHostCoverage
    .slice(0, 5)
    .map(({ host, pages }) => `${host} (${pages} page(s))`)
    .join(', ');
  return (
    `Sitewide GEO: ${analysis.pagesWithGeoData}/${analysis.pagesAnalyzed} pages assessed; ` +
    `search bots ${crawlerCoverage || 'not assessed'}; data-use bots ${dataUseCoverage || 'not assessed'}; robots-controlled user fetches ${userFetchCoverage || 'not assessed'}; ` +
    `data-use noarchive ${noArchiveCoverage || 'not assessed'}; ` +
    `${analysis.pagesWithNoindex} noindex, ${analysis.pagesWithNoSnippet} no-snippet, ` +
    `${analysis.pagesWithDataNoSnippetRegions} with visible data-nosnippet regions (${analysis.totalDataNoSnippetWords} words; mean ${analysis.dataNoSnippetWordShareMeanPercent === null ? 'unavailable' : `${analysis.dataNoSnippetWordShareMeanPercent}% of visible words`}), ` +
    `${analysis.pagesWithExternalSources} pages with external sources, ` +
    `${analysis.pagesWithCitationMarkersOrReferences} with citation markers/references, ${analysis.totalResolvedInlineCitationTargetsWithExternalLinks} resolved citation targets with external links and ${analysis.totalResolvedInlineCitationTargetsWithoutExternalLinks} without, ` +
    `${analysis.pagesWithUnresolvedInlineCitationTargets} pages with unresolved in-page citation targets (${analysis.totalUnresolvedInlineCitationTargets} links); ` +
    `content profile ${content.pagesAssessed} pages assessed (${content.pagesWithMainOrArticleRegion} main/article, ` +
    `${content.pagesWithQuestionHeadings} with question headings, ${content.totalConciseAnswerBlocks} concise answer blocks, ` +
    `${content.pagesWithVisibleAuthor} visible authors, ${content.pagesWithVisibleDate} visible dates, ` +
    `isAccessibleForFree: ${content.pagesWithFreeAccessSchemaDeclaration} free, ${content.pagesWithPaywalledSchemaDeclaration} paywalled, ${content.pagesWithConflictingFreeAccessSchemaDeclarations} conflicting, ${content.pagesWithoutFreeAccessSchemaDeclaration} not declared, ${content.pagesWithNonBooleanFreeAccessSchemaValue} non-boolean; ` +
    `${content.sourceRenderedPhraseCoverageMeanPercent === null ? 'unavailable' : `${content.sourceRenderedPhraseCoverageMeanPercent}% source/rendered phrase overlap on ${content.sourceRenderedPhraseCoverageSamples} pages`}; ` +
    `author visible/schema ${content.authorSignalCrossTab.visibleAndSchema} both, ${content.authorSignalCrossTab.visibleOnly} visible only, ${content.authorSignalCrossTab.schemaOnly} schema only, ${content.authorSignalCrossTab.neither} neither; date ${content.dateSignalCrossTab.visibleAndSchema} both, ${content.dateSignalCrossTab.visibleOnly} visible only, ${content.dateSignalCrossTab.schemaOnly} schema only, ${content.dateSignalCrossTab.neither} neither; ` +
    `overlap bands ${content.sourceRenderedPhraseCoverageBands.map(({ band, pages }) => `${band} ${pages}`).join(', ')}; ${content.sourceRenderedPhraseCoverageWithoutUsableSample} without enough sampled text; ` +
    `schema identity entities on ${entities.pagesWithIdentityEntities} pages, ${entities.identityIdsSharedAcrossPages} IDs shared across pages, ${entities.entitiesWithNameVariants} shared IDs with name variants, ${entities.entitiesWithTypeVariants} IDs with cross-page @type differences; ` +
    `${entities.pagesWithSameAsReferences} pages expose ${entities.totalSameAsReferences} sameAs profile links across ${sameAsHosts || 'no observed hosts'}; ` +
    `observed source hosts: ${sourceHosts || 'none'}${analysis.pagesWithTruncatedSourceHostLists > 0 ? ` (${analysis.pagesWithTruncatedSourceHostLists} page host lists capped)` : ''}${analysis.pagesWithTruncatedSourceHostLinkCounts > 0 ? ` (${analysis.pagesWithTruncatedSourceHostLinkCounts} pages capped at 12 source domains)` : ''}; ` +
    `optional llms.txt files: ${optionalFiles}`
  );
}

function formatAiCrawlerTiming(timing: AiCrawlerResponseTiming | undefined): string {
  if (!timing) return 'not logged';
  const pieces = [
    timing.timeToFirstByte
      ? `TTFB p50 ${timing.timeToFirstByte.p50Band}, p95 ${timing.timeToFirstByte.p95Band} (${timing.timeToFirstByte.sampledRequests} samples)`
      : undefined,
    timing.responseDuration
      ? `duration p50 ${timing.responseDuration.p50Band}, p95 ${timing.responseDuration.p95Band} (${timing.responseDuration.sampledRequests} samples)`
      : undefined,
  ].filter((value): value is string => value !== undefined);
  return pieces.join('; ') || 'not logged';
}

function formatAiCrawlerCloudFrontResults(
  profile: AiCrawlerCloudFrontResultProfile | undefined
): string {
  if (!profile) return '';
  const results =
    profile.resultTypes.map(({ resultType, requests }) => `${resultType} ${requests}`).join(', ') ||
    'not logged';
  const responseResults =
    profile.responseResultTypes
      .map(({ resultType, requests }) => `${resultType} ${requests}`)
      .join(', ') || 'not logged';
  return `; CloudFront edge result ${results}; response result ${responseResults}; differing pairs ${profile.differingResultTypes}/${profile.pairedRequests}`;
}

function writeGeoSummaryFile(
  outputPath: string,
  analysis: ReturnType<typeof analyzeSiteWideGeo>
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2), 'utf8');
}

async function parseBingAiInputFile(
  file: string,
  xlsx: boolean
): Promise<BingAiPerformanceExport[]> {
  const stats = fs.statSync(file);
  if (!stats.isFile()) throw new Error(`${file} is not a regular file.`);
  if (stats.size > 25 * 1024 * 1024) throw new Error(`${file} exceeds the 25 MiB input limit.`);
  if (xlsx) return parseBingAiPerformanceXlsxExport(fs.readFileSync(file), { sourceFile: file });
  return [parseBingAiPerformanceCsvExport(fs.readFileSync(file, 'utf8'), { sourceFile: file })];
}

async function parseGoogleAiInputFile(
  file: string,
  surface: 'search' | 'discover',
  xlsx: boolean
): Promise<GoogleAiPerformanceExport[]> {
  const stats = fs.statSync(file);
  if (!stats.isFile()) throw new Error(`${file} is not a regular file.`);
  if (stats.size > 25 * 1024 * 1024) throw new Error(`${file} exceeds the 25 MiB input limit.`);
  if (xlsx)
    return parseGoogleAiPerformanceXlsxExport(fs.readFileSync(file), { sourceFile: file, surface });
  return [
    parseGoogleAiPerformanceCsvExport(fs.readFileSync(file, 'utf8'), { sourceFile: file, surface }),
  ];
}

interface CliArgs {
  url?: string;
  urls?: string;
  sitemap?: string;
  crawl?: string;
  maxUrls?: number;
  maxDepth?: number;
  maxCrawlBytes?: number;
  maxCrawlPageBytes?: number;
  concurrency?: number;
  watchSeconds?: number;
  timeout?: number;
  navigationWaitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  settleAfterNavigationMs?: number;
  output?: string;
  comparisonOutput?: string;
  geoComparisonCsv?: string;
  geoGateOutput?: string;
  geoSummaryOutput?: string;
  geoSummaryCsv?: string;
  geoEntityVariantsCsv?: string;
  geoCrawlerAccessCsv?: string;
  geoPlatformMatrix?: boolean;
  geoGoogleSurfaceMatrix?: boolean;
  geoPlatformBaselineJson?: string;
  geoGoogleSurfaceBaselineJson?: string;
  geoGoogleSurfacePathFamilyCsv?: string;
  geoSitemap?: string;
  geoSitemapMaxUrls?: number;
  geoPathDepth?: number;
  renderReport?: string;
  html?: string;
  pdf?: string;
  history?: string;
  historyReport?: string;
  junit?: string;
  sarif?: string;
  markdown?: string;
  csv?: string;
  failOnFindings?: boolean;
  failOnDuplicateMetadata?: boolean;
  failOnDuplicateContent?: boolean;
  failOnHreflang?: boolean;
  failOnCanonicalChains?: boolean;
  failBelowScore?: number;
  baseline?: string;
  failOnRegression?: boolean;
  failOnGeoChange?: boolean;
  failOnGeoChangeSignals?: string[];
  failOnGeoChangeUrls?: string[];
  failOnGeoChangeTransitions?: Array<{ before: string; after: string }>;
  categories?: string[];
  headless?: boolean;
  viewport?: string;
  config?: string;
  preset?: string;
  help?: boolean;
  version?: boolean;
  completion?: CompletionShell;
  initConfig?: boolean;
  json?: boolean;
  verbose?: boolean;
  doctor?: boolean;
  bingAiCsv?: string[];
  bingAiXlsx?: string[];
  bingAiBaselineCsv?: string;
  bingAiBaselineXlsx?: string;
  bingAiQueryBaselineCsv?: string;
  bingAiQueryBaselineXlsx?: string;
  bingAiTopicBaselineCsv?: string;
  bingAiTopicBaselineXlsx?: string;
  googleAiCsv?: string[];
  googleAiXlsx?: string[];
  googleAiDiscoverCsv?: string[];
  googleAiDiscoverXlsx?: string[];
  googleAiBaselineCsv?: string;
  googleAiBaselineXlsx?: string;
  googleAiDimensionBaselineCsv?: string;
  googleAiDimensionBaselineXlsx?: string;
  geoGoogleAiCitationConcordanceCsv?: string;
  geoGoogleAiCitationConcordanceHtml?: string;
  geoGoogleAiCitationConcordancePathFamilyCsv?: string;
  geoGoogleAiCitationConcordanceProviderCsv?: string;
  geoGoogleAiCitationConcordancePathDepth?: number;
  geoGoogleAiCitationConcordancePathDepthSweepCsv?: string;
  geoGoogleAiCitationConcordanceBaselineJson?: string;
  geoGoogleAiCitationConcordanceComparisonCsv?: string;
  geoGoogleAiCitationConcordanceComparisonJson?: string;
  geoGoogleAiCitationConcordanceComparisonHtml?: string;
  geoGoogleAiCitationConcordanceProviderComparisonCsv?: string;
  geoAuditJson?: string;
  geoAuditBaselineJson?: string;
  geoCrawlerLogs?: string[];
  geoCrawlerBaselineJson?: string;
  geoCrawlerTokens?: string[];
  geoCrawlerIpRanges?: string;
  geoCrawlerPathFamiliesCsv?: string;
  geoCrawlerPathFamiliesJson?: string;
  geoCrawlerPathFamiliesHtml?: string;
  geoCrawlerPathFamilyAuditCsv?: string;
  geoCrawlerPathFamilyAuditJson?: string;
  geoCrawlerPathFamilyAuditHtml?: string;
  geoCrawlerPathFamilyAuditComparisonCsv?: string;
  geoCrawlerPathFamilyAuditComparisonJson?: string;
  geoCrawlerPathFamilyAuditComparisonHtml?: string;
  geoCrawlerPathFamilyComparisonCsv?: string;
  geoCrawlerPathFamilyComparisonJson?: string;
  geoCrawlerPathFamilyComparisonHtml?: string;
  geoCrawlerPathFamilyFailureGateJson?: string;
  geoCrawlerPathDepth?: number;
  geoAiReferralSources?: string[];
  geoAnswerObservations?: string;
  geoAnswerBaselineObservations?: string;
  geoAnswerComparisonCsv?: string;
  geoAnswerProviderPositionComparisonCsv?: string;
  geoAnswerCohortsCsv?: string;
  geoAnswerCohortComparisonCsv?: string;
  geoAnswerProviderPairsCsv?: string;
  geoAnswerProviderPromptOverlapCsv?: string;
  geoAnswerProviderPromptSourceOverlapCsv?: string;
  geoAnswerSampleMixCsv?: string;
  geoAnswerCohortStandardizationCsv?: string;
  geoAnswerCohortPeriodStandardizationCsv?: string;
  geoAnswerPromptSamplingPlanCsv?: string;
  geoAnswerPromptSamplingPlanJson?: string;
  geoAnswerPromptPlanProviderPairsCsv?: string;
  geoAnswerExecutionContextCsv?: string;
  geoAnswerExecutionContextCoverageCsv?: string;
  geoAnswerExecutionContextComparisonCsv?: string;
  geoAnswerExecutionContextTrendsCsv?: string;
  geoAnswerLengthProfilesCsv?: string;
  geoAnswerLengthComparisonCsv?: string;
  geoAnswerLengthTrendsCsv?: string;
  geoAnswerPromptPlanMinPrompts?: number;
  geoAnswerPromptPlanOwnedReachMargin?: number;
  geoAnswerPromptPlanMinimumJaccard?: number;
  geoAnswerPromptPlanMaxPairedGroups?: number;
  geoAnswerPromptPlanMaxTotalPairedGroups?: number;
  geoAnswerPromptPlanTotalAllocation?: AiAnswerCitationPromptPlanTotalPairAllocation;
  geoAnswerPromptPlanCohortTargets?: string;
  failOnGeoAnswerPromptPlanMiss?: boolean;
  geoAnswerTemporalStabilityCsv?: string;
  geoAnswerSourcePersistenceCsv?: string;
  geoAnswerCitationUrlPersistenceCsv?: string;
  geoAnswerCohortTrendsCsv?: string;
  geoAnswerAuditSignalsCsv?: string;
  geoAnswerAuditedOwnedPageProviderInventoryCsv?: string;
  geoAnswerAuditedOwnedPageProviderInventoryHtml?: string;
  geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv?: string;
  geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml?: string;
  geoAnswerAuditedOwnedPageProviderInventoryComparisonJson?: string;
  geoAnswerAuditedOwnedPagesCsv?: string;
  geoAnswerAuditedOwnedPageComparisonCsv?: string;
  geoAnswerAuditedOwnedPageProvidersCsv?: string;
  geoAnswerAuditedOwnedPageProviderComparisonCsv?: string;
  geoAnswerSourceCategoriesCsv?: string;
  geoAnswerSourceCategoryMappingAuditCsv?: string;
  geoAnswerSourceCategoryComparisonCsv?: string;
  geoAnswerSourceCategoryMixDecompositionCsv?: string;
  geoAnswerSourceCategoryMixDecompositionHtml?: string;
  geoAnswerSourceCategoryConcentrationTrendsCsv?: string;
  geoAnswerSourceCategoryConcentrationTrendsHtml?: string;
  geoAnswerSourceCategoryShareTrendsCsv?: string;
  geoAnswerSourceCategoryShareTrendsHtml?: string;
  geoAnswerSourceCategoryMonthlyGatesJson?: string;
  failOnGeoAnswerSourceCategoryMonthlyJsdAbove?: number;
  failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove?: number;
  failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove?: number;
  failOnGeoAnswerSourceCategoryMonthlyHhiAbove?: number;
  failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove?: number;
  failOnGeoAnswerSourceCategoryMonthlyMinEvents?: number;
  failOnGeoAnswerSourceCategoryShareDrop?: number;
  failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove?: number;
  failOnGeoAnswerSourceCategoryPromptBalancedJsdMinPrompts?: number;
  geoAnswerSourceCategoryPromptBalancedJsdGateJson?: string;
  geoAnswerSourceCategoryPromptCoverageCsv?: string;
  geoAnswerSourceCategoryPromptDetailsCsv?: string;
  geoAnswerSourceCategoryTrendsCsv?: string;
  geoAnswerSourceCategoryProviderPairsCsv?: string;
  geoAnswerSourceCategoryCooccurrenceCsv?: string;
  geoAnswerSourceCategoryPathFamiliesCsv?: string;
  geoAnswerSourceCategoryPathFamilyComparisonCsv?: string;
  geoAnswerCitationPositionsCsv?: string;
  geoAnswerDomainPromptCoverageCsv?: string;
  geoAnswerSourceRarefactionCsv?: string;
  geoAnswerPromptFamilySourceRarefactionCsv?: string;
  geoAnswerPromptFamilySourceRarefactionHtml?: string;
  geoAnswerPromptFamilySourceRarefactionSweepCsv?: string;
  geoAnswerPromptFamilySourceRarefactionSweepHtml?: string;
  geoAnswerProviderPromptFamilySourceOverlapCsv?: string;
  geoAnswerProviderPromptFamilySourceOverlapHtml?: string;
  geoAnswerProviderPromptFamilySourceOverlapSweepCsv?: string;
  geoAnswerProviderPromptFamilySourceOverlapSweepHtml?: string;
  geoAnswerPromptFamilyPeriodComparisonCsv?: string;
  geoAnswerPromptFamilyPeriodComparisonHtml?: string;
  geoAnswerPromptFamilyPeriodComparisonSweepCsv?: string;
  geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv?: string;
  geoAnswerPromptFamilyPeriodComparisonSweepHtml?: string;
  geoAnswerSourceRarefactionBatchSize?: number;
  geoAnswerDomainPromptCoverageComparisonCsv?: string;
  geoAnswerPromptSimilarityCsv?: string;
  geoAnswerPromptSimilarityThreshold?: number;
  geoAnswerPromptFamiliesCsv?: string;
  geoAnswerPromptFamiliesHtml?: string;
  geoAnswerPromptFamilyInfluenceCsv?: string;
  geoAnswerPromptFamilyInfluenceHtml?: string;
  geoAnswerPromptFamilyThresholdSweepCsv?: string;
  geoAnswerPromptFamilyThresholdSweepHtml?: string;
  geoAnswerPromptFamilyThreshold?: number;
  geoAnswerDomainPairedReachComparisonCsv?: string;
  geoAnswerDomainPairedReachComparisonJson?: string;
  failOnGeoAnswerDomainPairedReachDrop?: number;
  failOnGeoAnswerDomainPairedReachAlpha?: number;
  failOnGeoAnswerDomainPairedReachMinPrompts?: number;
  geoAnswerDomainPairedReachGateJson?: string;
  geoAnswerPagePairedReachComparisonCsv?: string;
  geoAnswerPagePairedReachComparisonJson?: string;
  geoAnswerPageOpportunitiesCsv?: string;
  geoAnswerPageOpportunityTrendsCsv?: string;
  geoAnswerPageOpportunityPathFamiliesCsv?: string;
  geoAnswerPageOpportunityPathFamilyDepthSweepCsv?: string;
  geoAnswerPageOpportunityPathFamilyDepthSweepHtml?: string;
  geoAnswerPageOpportunityPathFamilyTrendsCsv?: string;
  geoAnswerPageOpportunityPathFamilyTrendsHtml?: string;
  geoAnswerPageOpportunityPathDepth?: number;
  failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise?: number;
  failOnGeoAnswerPageOpportunityPathFamilyMonthlyAlpha?: number;
  failOnGeoAnswerPageOpportunityPathFamilyMonthlyMinPrompts?: number;
  geoAnswerPageOpportunityPathFamilyMonthlyGateJson?: string;
  failOnGeoAnswerPageOpportunityMonthlyRise?: number;
  failOnGeoAnswerPageOpportunityMonthlyAlpha?: number;
  failOnGeoAnswerPageOpportunityMonthlyMinPrompts?: number;
  geoAnswerPageOpportunityMonthlyGateJson?: string;
  geoAnswerPagePairedReachOwnedOnly?: boolean;
  failOnGeoAnswerPagePairedReachDrop?: number;
  failOnGeoAnswerPagePairedReachAlpha?: number;
  failOnGeoAnswerPagePairedReachMinPrompts?: number;
  geoAnswerPagePairedReachMetric?: 'citation-reach' | 'top-three-reach' | 'first-position-reach';
  geoAnswerPagePairedReachGateJson?: string;
  geoAnswerSourceDiversityUncertaintyCsv?: string;
  geoAnswerSourceDiversityUncertaintyHtml?: string;
  geoAnswerSourceDiversityComparisonCsv?: string;
  geoAnswerSourceDiversityComparisonHtml?: string;
  geoAnswerProviderSourceDivergenceCsv?: string;
  geoAnswerSourcePortfolioDriftCsv?: string;
  geoAnswerSourcePortfolioDriftHtml?: string;
  geoAnswerSourcePortfolioDriftJson?: string;
  geoAnswerSourcePortfolioAttributionCsv?: string;
  geoAnswerSourcePortfolioAttributionJson?: string;
  geoAnswerSourcePortfolioAttributionHtml?: string;
  geoAnswerOwnedSourceShareGateCsv?: string;
  geoAnswerOwnedSourceShareGateJson?: string;
  failOnGeoAnswerOwnedSourceShareDrop?: number;
  failOnGeoAnswerOwnedSourceShareDropLowerCi?: number;
  failOnGeoAnswerOwnedSourceShareSignTestAlpha?: number;
  failOnGeoAnswerOwnedSourceShareMinPrompts?: number;
  geoAnswerSourceNetworkCsv?: string;
  geoAnswerSourceNetworkComparisonCsv?: string;
  geoAnswerRankWeightedSourceNetworkCsv?: string;
  geoAnswerRankWeightedSourceNetworkComparisonCsv?: string;
  geoAnswerSourceNetworkHtml?: string;
  geoAnswerSourceNetworkComparisonHtml?: string;
  geoAnswerProviderSourceNetworkOverlapCsv?: string;
  geoAnswerProviderSourceNetworkEdgeDriftCsv?: string;
  geoAnswerProviderSourceNetworkEdgeDriftHtml?: string;
  geoAnswerProviderSourceNetworkEdgeComparisonCsv?: string;
  geoAnswerProviderSourceNetworkEdgeHtml?: string;
  geoAnswerOwnedSourceNetworkGapsCsv?: string;
  geoAnswerCitationDateAlignmentCsv?: string;
  geoAnswerOwnedRankCsv?: string;
  geoAnswerOwnedPromptCoverageCsv?: string;
  geoAnswerOwnedPromptReachPeriodCsv?: string;
  geoAnswerOwnedPromptOpportunitiesCsv?: string;
  geoAnswerCompetitiveGapsCsv?: string;
  geoAnswerProviderOwnedGapsCsv?: string;
  geoAnswerProviderOwnedGapComparisonCsv?: string;
  geoAnswerCompetitiveGapComparisonCsv?: string;
  geoAnswerOwnedRankComparisonCsv?: string;
  geoAnswerOwnedPromptRankComparisonCsv?: string;
  geoAnswerCoCitationCsv?: string;
  geoAnswerCoCitationComparisonCsv?: string;
  geoAnswerEntityMentionsCsv?: string;
  geoAnswerEntityPromptDetailsCsv?: string;
  geoAnswerEntityPromptProviderPairsCsv?: string;
  geoAnswerEntityPromptComparisonCsv?: string;
  geoAnswerEntityCoMentionsCsv?: string;
  geoAnswerEntityCoMentionComparisonCsv?: string;
  geoAnswerEntityCitationDomainsCsv?: string;
  geoAnswerEntityCitationPagesCsv?: string;
  geoAnswerEntitySourceCategoriesCsv?: string;
  geoAnswerEntitySourceCategoryComparisonCsv?: string;
  geoAnswerEntityCitationDomainComparisonCsv?: string;
  geoAnswerEntityCitationPageComparisonCsv?: string;
  geoAnswerEntityCitationPositionComparisonCsv?: string;
  geoAnswerEntityOpportunitiesCsv?: string;
  geoAnswerEntityPromptMatchedAssociationCsv?: string;
  geoAnswerEntityPromptMatchedAssociationHtml?: string;
  geoAnswerEntityPathFamiliesCsv?: string;
  geoAnswerEntityPathFamilyMonthlyCsv?: string;
  geoAnswerEntityPathFamilyComparisonCsv?: string;
  geoAnswerPathFamiliesCsv?: string;
  geoAnswerPathFamilyCohortsCsv?: string;
  geoAnswerPathFamilyTrendsCsv?: string;
  geoAnswerPathFamilyCohortComparisonCsv?: string;
  geoAnswerPathFamilyComparisonCsv?: string;
  geoAnswerCrawlerReport?: string;
  geoAnswerCrawlerOrigin?: string;
  geoAnswerCrawlerMatchesCsv?: string;
  geoAnswerPathDepth?: number;
  geoAnswerOwnedDomains?: string[];
  geoAnswerEntities?: string[];
  geoAnswerSourceCategories?: string[];
  geoCrawlerOrigin?: string;
  geoCrawlerSitemap?: string;
  geoCrawlerSitemapMaxUrls?: number;
  geoRobotsTxt?: string;
  geoRobotsBaselineTxt?: string;
  geoRobotsOrigin?: string;
  geoRobotsSitemap?: string;
  geoRobotsTokens?: string[];
  failOnNewlyBlockedGeoPaths?: boolean;
  failOnNewlyBlockedGeoAuditPages?: boolean;
  failOnNewlyBlockedGeoTargets?: boolean;
  failOnNewGeoCrawlerFailures?: boolean;
  failOnNewAiReferralFailures?: boolean;
  failOnAiCrawlerTimingRegression?: boolean;
  failOnGeoCrawlerPathFamilyFailureRise?: number;
  failOnGeoAnswerOwnedCitationDrop?: number;
  failOnGeoAnswerOwnedReachBoundDrop?: number;
  failOnGeoAnswerIncompleteListShare?: number;
  failOnGeoAnswerIncompleteListShareRise?: number;
  failOnGeoAnswerUnknownOwnedObservationShare?: number;
  failOnGeoAnswerUnknownOwnedPromptShare?: number;
  failOnGeoAnswerUnknownOwnedStateShareRise?: number;
  failOnGeoAnswerProviderBalancedCitationDrop?: number;
  failOnGeoAnswerOwnedPromptCoverageDrop?: number;
  failOnGeoAnswerCohortOwnedPromptCoverageDrop?: number;
  failOnGeoAnswerCohortOwnedMrrDrop?: number;
  failOnGeoAnswerCohortOwnedMrrMinPrompts?: number;
  failOnGeoAnswerCohortMonthlyOwnedMrrDrop?: number;
  failOnGeoAnswerCohortMonthlyOwnedMrrMinPrompts?: number;
  failOnGeoAnswerCohortMonthlyPairedMrrDrop?: number;
  failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi?: number;
  failOnGeoAnswerCohortMonthlyPairedMrrMinMatchedPrompts?: number;
  failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop?: number;
  failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi?: number;
  failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline?: number;
  failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmAlpha?: number;
  failOnGeoAnswerCohortMonthlyOwnedPromptCoverageMinMatchedPrompts?: number;
  failOnGeoAnswerOwnedTopThreeDrop?: number;
  failOnGeoAnswerOwnedFirstPositionDrop?: number;
  failOnGeoAnswerOwnedPromptBalancedTopThreeDrop?: number;
  failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi?: number;
  failOnGeoAnswerOwnedPromptBalancedFirstPositionDrop?: number;
  failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi?: number;
  failOnGeoAnswerOwnedPromptBalancedMrrDrop?: number;
  failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi?: number;
  failOnGeoAnswerOwnedPromptBalancedRankMinMatchedPrompts?: number;
  failOnGeoAnswerLengthOwnedTopThreeDrop?: number;
  failOnGeoAnswerLengthOwnedTopThreeDropLowerCi?: number;
  failOnGeoAnswerLengthOwnedFirstPositionDrop?: number;
  failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi?: number;
  failOnGeoAnswerLengthOwnedMrrDrop?: number;
  failOnGeoAnswerLengthOwnedMrrDropLowerCi?: number;
  failOnGeoAnswerLengthOwnedRankMinMatchedPrompts?: number;
  failOnGeoAnswerEntityMentionDrop?: number;
  failOnGeoAnswerEntityOwnedTopThreeDrop?: number;
  failOnGeoAnswerPathFamilyCoverageDrop?: number;
  failOnGeoAnswerPathFamilyPromptCoverageDrop?: number;
  failOnGeoAnswerPathFamilyOverIndexDrop?: number;
  failOnGeoAnswerEntityPathFamilyPromptCoverageDrop?: number;
  failOnGeoAnswerEntityPathFamilyTopThreeDrop?: number;
  failOnGeoAnswerEntityCitationPagePromptCoverageDrop?: number;
  failOnGeoAnswerEntityCitationPageTopThreeDrop?: number;
  failOnGeoAnswerEntityPromptMentionDrop?: number;
  failOnGeoAnswerEntityPromptBalancedMentionDrop?: number;
  failOnGeoAnswerEntityPromptMinMatchedPrompts?: number;
  failOnGeoAnswerProviderPromptOverlapBelow?: number;
  failOnGeoAnswerProviderMinPrompts?: number;
  failOnGeoAnswerProviderMinMatchedPrompts?: number;
  failOnGeoAnswerSampleMixDivergence?: number;
  failOnGeoAnswerCohortStandardizedCitationDrop?: string[];
  failOnGeoAnswerCohortStandardizedOwnedPromptCoverageDrop?: string[];
  failOnAiCrawlerCloudFrontResultRegression?: boolean;
}

type DoctorStatus = 'ok' | 'warning' | 'error';

function printDoctor(configPath?: string, asJson = false): void {
  const checks: Array<{ status: DoctorStatus; label: string; detail: string }> = [];
  const add = (status: DoctorStatus, label: string, detail: string): void => {
    checks.push({ status, label, detail });
  };

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor >= 20) {
    add('ok', 'Node.js', `${process.versions.node} satisfies the >=20 requirement.`);
  } else {
    add(
      'error',
      'Node.js',
      `${process.versions.node} is too old; Aviary requires Node.js 20 or newer.`
    );
  }

  const chromiumPath = chromium.executablePath();
  if (fs.existsSync(chromiumPath)) {
    add('ok', 'Playwright Chromium', 'The browser executable is installed.');
  } else {
    add(
      'error',
      'Playwright Chromium',
      'The browser executable is missing. Install it with `pnpm exec playwright install chromium`.'
    );
  }

  try {
    const envConfig = loadEnvConfig();
    const problems: string[] = [];
    if (
      envConfig.timeout !== undefined &&
      (!Number.isInteger(envConfig.timeout) ||
        envConfig.timeout < 1 ||
        envConfig.timeout > 2_147_483_647)
    ) {
      problems.push('AVIARY_TIMEOUT must be an integer from 1 to 2,147,483,647.');
    }
    if (
      envConfig.settleAfterNavigationMs !== undefined &&
      (!Number.isInteger(envConfig.settleAfterNavigationMs) ||
        envConfig.settleAfterNavigationMs < 0 ||
        envConfig.settleAfterNavigationMs > 30_000)
    ) {
      problems.push('AVIARY_SETTLE_AFTER_NAVIGATION_MS must be an integer from 0 to 30000.');
    }
    if (
      envConfig.concurrency !== undefined &&
      (!Number.isInteger(envConfig.concurrency) ||
        envConfig.concurrency < 1 ||
        envConfig.concurrency > 8)
    ) {
      problems.push('AVIARY_CONCURRENCY must be an integer from 1 to 8.');
    }
    if (
      envConfig.failBelowScore !== undefined &&
      (!Number.isFinite(envConfig.failBelowScore) ||
        envConfig.failBelowScore < 0 ||
        envConfig.failBelowScore > 100)
    ) {
      problems.push('AVIARY_FAIL_BELOW_SCORE must be a number from 0 to 100.');
    }
    if (envConfig.viewport !== undefined) {
      const match = /^(\d+)x(\d+)$/i.exec(envConfig.viewport.trim());
      const width = match ? Number(match[1]) : Number.NaN;
      const height = match ? Number(match[2]) : Number.NaN;
      if (
        !Number.isSafeInteger(width) ||
        width < 1 ||
        !Number.isSafeInteger(height) ||
        height < 1
      ) {
        problems.push('AVIARY_VIEWPORT must use positive integer WxH dimensions, such as 375x667.');
      }
    }
    const knownCategories = new Set<string>(CHECKER_REGISTRY.map(({ key }) => key));
    const invalidCategories =
      envConfig.categories?.filter((category) => !knownCategories.has(category)) ?? [];
    if (invalidCategories.length > 0) {
      problems.push(`AVIARY_CATEGORIES contains unknown keys: ${invalidCategories.join(', ')}.`);
    }
    const metricsPort = process.env.AVIARY_METRICS_PORT?.trim();
    if (metricsPort) {
      const value = Number(metricsPort);
      if (!Number.isInteger(value) || value < 1 || value > 65_535) {
        problems.push('AVIARY_METRICS_PORT must be an integer from 1 to 65,535.');
      }
    }
    if (problems.length === 0) {
      add('ok', 'Environment', 'Aviary environment settings are valid.');
    } else {
      add('error', 'Environment', problems.join(' '));
    }
  } catch (error) {
    add('error', 'Environment', error instanceof Error ? error.message : String(error));
  }

  try {
    const config = configPath ? ConfigLoader.loadFromFile(configPath) : ConfigLoader.findAndLoad();
    if (configPath) {
      add('ok', 'Configuration', `Loaded ${configPath}.`);
    } else if (config) {
      add('ok', 'Configuration', 'Aviary found and loaded a default config file.');
    } else {
      add('ok', 'Configuration', 'No config file found; Aviary will use its default rules.');
    }
  } catch (error) {
    add('error', 'Configuration', error instanceof Error ? error.message : String(error));
  }

  const ok = !checks.some(({ status }) => status === 'error');
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  } else {
    process.stdout.write('Aviary diagnostics\n');
    for (const check of checks) {
      const icon = check.status === 'ok' ? '✓' : check.status === 'warning' ? '!' : '✗';
      process.stdout.write(`${icon} ${check.label}: ${check.detail}\n`);
    }
    process.stdout.write('\n');
  }
  process.exitCode = ok ? 0 : 1;
}

function requireOptionValue(
  option: string,
  value: string | undefined,
  allowStdinMarker = false
): string {
  if (!value || (value.startsWith('-') && !(allowStdinMarker && value === '-'))) {
    process.stderr.write(`❌ ${option} requires a value.\n`);
    process.exit(2);
  }
  return value;
}

function parseByteLimit(value: string | undefined): number {
  if (value === undefined) return Number.NaN;
  const match = /^(\d+(?:\.\d+)?)\s*(B|KiB|MiB|GiB)?$/i.exec(value.trim());
  if (!match) return Number.NaN;
  const multiplier = {
    b: 1,
    kib: 1024,
    mib: 1024 * 1024,
    gib: 1024 * 1024 * 1024,
  }[(match[2] ?? 'b').toLowerCase() as 'b' | 'kib' | 'mib' | 'gib'];
  const bytes = Number(match[1]) * multiplier;
  return Number.isSafeInteger(bytes) ? bytes : Number.NaN;
}

function parseViewport(value?: string): { width: number; height: number } | undefined {
  if (!value) return undefined;
  const match = /^(\d+)x(\d+)$/i.exec(value.trim());
  const width = match ? Number(match[1]) : Number.NaN;
  const height = match ? Number(match[2]) : Number.NaN;
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    process.stderr.write(
      '❌ AVIARY_VIEWPORT / --viewport must use positive integer WxH dimensions, such as 375x667.\n'
    );
    process.exit(2);
  }
  return { width, height };
}

function ensureDistinctOutputPaths(outputs: Record<string, string | undefined>): void {
  const entries = Object.entries(outputs).filter((entry): entry is [string, string] =>
    Boolean(entry[1])
  );
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const first = entries[left]!;
      const second = entries[right]!;
      if (pathsReferToSameFile(first[1], second[1])) {
        process.stderr.write(
          `❌ ${first[0]} and ${second[0]} outputs must use different file paths.\n`
        );
        process.exit(2);
      }
    }
  }
}

function readUrlListSource(
  filePath: string,
  maxBytes: number
): { text: string; byteLength: number } {
  const fileDescriptor = filePath === '-' ? 0 : fs.openSync(filePath, 'r');
  const closeDescriptor = filePath !== '-';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let byteLength = 0;
  try {
    while (true) {
      const bytesRead = fs.readSync(fileDescriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (byteLength > maxBytes) {
        throw new Error(
          `URL-list input exceeds the ${MAX_URL_LIST_BYTES / (1024 * 1024)} MiB total size limit.`
        );
      }
      chunks.push(decoder.decode(buffer.subarray(0, bytesRead), { stream: true }));
    }
    chunks.push(decoder.decode());
    return { text: chunks.join(''), byteLength };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`URL-list input "${filePath}" is not valid UTF-8.`);
    }
    throw error;
  } finally {
    if (closeDescriptor) fs.closeSync(fileDescriptor);
  }
}

function appendUrlListEntries(source: string, urls: string[]): void {
  let offset = 0;
  while (offset <= source.length) {
    const newline = source.indexOf('\n', offset);
    const end = newline === -1 ? source.length : newline;
    const line = source.slice(offset, end).replace(/\r$/, '').trim();
    if (line && !line.startsWith('#')) {
      urls.push(line);
      if (urls.length > MAX_URL_LIST_ENTRIES) {
        throw new Error(
          `URL-list input contains more than ${MAX_URL_LIST_ENTRIES} URLs; narrow the source.`
        );
      }
    }
    if (newline === -1) break;
    offset = newline + 1;
  }
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-V':
      case '--version':
        args.version = true;
        break;
      case '--completion': {
        const shell = requireOptionValue('--completion', argv[++i]);
        if (shell !== 'bash' && shell !== 'zsh' && shell !== 'fish') {
          process.stderr.write('❌ --completion requires one of: bash, zsh, fish.\n');
          process.exit(2);
        }
        args.completion = shell;
        break;
      }
      case '-u':
      case '--url':
        args.url = requireOptionValue(arg, argv[++i]);
        break;
      case '--urls': {
        const file = requireOptionValue('--urls', argv[++i], true);
        args.urls = file;
        break;
      }
      case '--sitemap': {
        const url = requireOptionValue('--sitemap', argv[++i]);
        args.sitemap = url;
        break;
      }
      case '--crawl': {
        const url = requireOptionValue('--crawl', argv[++i]);
        args.crawl = url;
        break;
      }
      case '--max-urls': {
        const rawCount = argv[++i];
        const maxUrls =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(maxUrls) || maxUrls < 1 || maxUrls > 10_000) {
          process.stderr.write('❌ --max-urls requires an integer from 1 to 10,000.\n');
          process.exit(2);
        }
        args.maxUrls = maxUrls;
        break;
      }
      case '--max-depth': {
        const rawDepth = argv[++i];
        const maxDepth =
          rawDepth === undefined || rawDepth.trim() === '' ? Number.NaN : Number(rawDepth);
        if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 32) {
          process.stderr.write('❌ --max-depth requires an integer from 0 to 32.\n');
          process.exit(2);
        }
        args.maxDepth = maxDepth;
        break;
      }
      case '--max-crawl-bytes': {
        const rawBytes = argv[++i];
        const maxCrawlBytes = parseByteLimit(rawBytes);
        if (
          !Number.isInteger(maxCrawlBytes) ||
          maxCrawlBytes < 1 ||
          maxCrawlBytes > 1024 * 1024 * 1024
        ) {
          process.stderr.write(
            '❌ --max-crawl-bytes requires a whole byte count from 1 to 1,073,741,824, or a binary suffix such as 100MiB.\n'
          );
          process.exit(2);
        }
        args.maxCrawlBytes = maxCrawlBytes;
        break;
      }
      case '--max-crawl-page-bytes': {
        const rawBytes = argv[++i];
        const maxCrawlPageBytes = parseByteLimit(rawBytes);
        if (
          !Number.isInteger(maxCrawlPageBytes) ||
          maxCrawlPageBytes < 1 ||
          maxCrawlPageBytes > 10 * 1024 * 1024
        ) {
          process.stderr.write(
            '❌ --max-crawl-page-bytes requires a whole byte count from 1 to 10,485,760, or a binary suffix such as 5MiB.\n'
          );
          process.exit(2);
        }
        args.maxCrawlPageBytes = maxCrawlPageBytes;
        break;
      }
      case '--concurrency': {
        const rawConcurrency = argv[++i];
        const concurrency =
          rawConcurrency === undefined || rawConcurrency.trim() === ''
            ? Number.NaN
            : Number(rawConcurrency);
        if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
          process.stderr.write('❌ --concurrency requires an integer from 1 to 8.\n');
          process.exit(2);
        }
        args.concurrency = concurrency;
        break;
      }
      case '--watch': {
        const rawSeconds = argv[++i];
        const seconds =
          rawSeconds === undefined || rawSeconds.trim() === '' ? Number.NaN : Number(rawSeconds);
        if (!Number.isInteger(seconds) || seconds < 1 || seconds > 2_147_483) {
          process.stderr.write('❌ --watch requires an interval in seconds from 1 to 2,147,483.\n');
          process.exit(2);
        }
        args.watchSeconds = seconds;
        break;
      }
      case '--timeout': {
        const rawTimeout = argv[++i];
        const timeout =
          rawTimeout === undefined || rawTimeout.trim() === '' ? Number.NaN : Number(rawTimeout);
        if (!Number.isInteger(timeout) || timeout < 1) {
          process.stderr.write('❌ --timeout requires a positive integer in milliseconds.\n');
          process.exit(2);
        }
        args.timeout = timeout;
        break;
      }
      case '--wait-until': {
        const waitUntil = argv[++i];
        if (
          waitUntil !== 'domcontentloaded' &&
          waitUntil !== 'load' &&
          waitUntil !== 'networkidle'
        ) {
          process.stderr.write('❌ --wait-until must be domcontentloaded, load, or networkidle.\n');
          process.exit(2);
        }
        args.navigationWaitUntil = waitUntil;
        break;
      }
      case '--settle-ms': {
        const raw = argv[++i];
        const ms = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
        if (!Number.isInteger(ms) || ms < 0 || ms > 30_000) {
          process.stderr.write('❌ --settle-ms requires an integer from 0 to 30000.\n');
          process.exit(2);
        }
        args.settleAfterNavigationMs = ms;
        break;
      }
      case '-o':
      case '--output':
        args.output = requireOptionValue(arg, argv[++i]);
        break;
      case '--render': {
        const reportPath = requireOptionValue('--render', argv[++i]);
        args.renderReport = reportPath;
        break;
      }
      case '--html':
        args.html = requireOptionValue('--html', argv[++i]);
        break;
      case '--pdf':
        args.pdf = requireOptionValue('--pdf', argv[++i]);
        break;
      case '--history':
        args.history = requireOptionValue('--history', argv[++i]);
        break;
      case '--history-report': {
        const historyPath = requireOptionValue('--history-report', argv[++i]);
        args.historyReport = historyPath;
        break;
      }
      case '--junit':
        args.junit = requireOptionValue('--junit', argv[++i]);
        break;
      case '--sarif':
        args.sarif = requireOptionValue('--sarif', argv[++i]);
        break;
      case '--markdown':
        args.markdown = requireOptionValue('--markdown', argv[++i]);
        break;
      case '--csv':
        args.csv = requireOptionValue('--csv', argv[++i]);
        break;
      case '--bing-ai-csv': {
        const file = requireOptionValue('--bing-ai-csv', argv[++i]);
        args.bingAiCsv = [...(args.bingAiCsv ?? []), file];
        break;
      }
      case '--bing-ai-xlsx': {
        const file = requireOptionValue('--bing-ai-xlsx', argv[++i]);
        args.bingAiXlsx = [...(args.bingAiXlsx ?? []), file];
        break;
      }
      case '--bing-ai-baseline-csv':
        args.bingAiBaselineCsv = requireOptionValue('--bing-ai-baseline-csv', argv[++i]);
        break;
      case '--bing-ai-baseline-xlsx':
        args.bingAiBaselineXlsx = requireOptionValue('--bing-ai-baseline-xlsx', argv[++i]);
        break;
      case '--bing-ai-query-baseline-csv':
        args.bingAiQueryBaselineCsv = requireOptionValue('--bing-ai-query-baseline-csv', argv[++i]);
        break;
      case '--bing-ai-query-baseline-xlsx':
        args.bingAiQueryBaselineXlsx = requireOptionValue(
          '--bing-ai-query-baseline-xlsx',
          argv[++i]
        );
        break;
      case '--bing-ai-topic-baseline-csv':
        args.bingAiTopicBaselineCsv = requireOptionValue('--bing-ai-topic-baseline-csv', argv[++i]);
        break;
      case '--bing-ai-topic-baseline-xlsx':
        args.bingAiTopicBaselineXlsx = requireOptionValue(
          '--bing-ai-topic-baseline-xlsx',
          argv[++i]
        );
        break;
      case '--google-ai-csv': {
        const file = requireOptionValue('--google-ai-csv', argv[++i]);
        args.googleAiCsv = [...(args.googleAiCsv ?? []), file];
        break;
      }
      case '--google-ai-xlsx': {
        const file = requireOptionValue('--google-ai-xlsx', argv[++i]);
        args.googleAiXlsx = [...(args.googleAiXlsx ?? []), file];
        break;
      }
      case '--google-ai-discover-csv': {
        const file = requireOptionValue('--google-ai-discover-csv', argv[++i]);
        args.googleAiDiscoverCsv = [...(args.googleAiDiscoverCsv ?? []), file];
        break;
      }
      case '--google-ai-discover-xlsx': {
        const file = requireOptionValue('--google-ai-discover-xlsx', argv[++i]);
        args.googleAiDiscoverXlsx = [...(args.googleAiDiscoverXlsx ?? []), file];
        break;
      }
      case '--google-ai-baseline-csv':
        args.googleAiBaselineCsv = requireOptionValue('--google-ai-baseline-csv', argv[++i]);
        break;
      case '--google-ai-baseline-xlsx':
        args.googleAiBaselineXlsx = requireOptionValue('--google-ai-baseline-xlsx', argv[++i]);
        break;
      case '--google-ai-dimension-baseline-csv':
        args.googleAiDimensionBaselineCsv = requireOptionValue(
          '--google-ai-dimension-baseline-csv',
          argv[++i]
        );
        break;
      case '--google-ai-dimension-baseline-xlsx':
        args.googleAiDimensionBaselineXlsx = requireOptionValue(
          '--google-ai-dimension-baseline-xlsx',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-csv':
        args.geoGoogleAiCitationConcordanceCsv = requireOptionValue(
          '--geo-google-ai-citation-concordance-csv',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-html':
        args.geoGoogleAiCitationConcordanceHtml = requireOptionValue(
          '--geo-google-ai-citation-concordance-html',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-path-family-csv':
        args.geoGoogleAiCitationConcordancePathFamilyCsv = requireOptionValue(
          '--geo-google-ai-citation-concordance-path-family-csv',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-provider-csv':
        args.geoGoogleAiCitationConcordanceProviderCsv = requireOptionValue(
          '--geo-google-ai-citation-concordance-provider-csv',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-path-depth-sweep-csv':
        args.geoGoogleAiCitationConcordancePathDepthSweepCsv = requireOptionValue(
          '--geo-google-ai-citation-concordance-path-depth-sweep-csv',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-baseline-json':
        args.geoGoogleAiCitationConcordanceBaselineJson = requireOptionValue(
          '--geo-google-ai-citation-concordance-baseline-json',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-comparison-csv':
        args.geoGoogleAiCitationConcordanceComparisonCsv = requireOptionValue(
          '--geo-google-ai-citation-concordance-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-comparison-json':
        args.geoGoogleAiCitationConcordanceComparisonJson = requireOptionValue(
          '--geo-google-ai-citation-concordance-comparison-json',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-comparison-html':
        args.geoGoogleAiCitationConcordanceComparisonHtml = requireOptionValue(
          '--geo-google-ai-citation-concordance-comparison-html',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-provider-comparison-csv':
        args.geoGoogleAiCitationConcordanceProviderComparisonCsv = requireOptionValue(
          '--geo-google-ai-citation-concordance-provider-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-google-ai-citation-concordance-path-depth': {
        const rawDepth = requireOptionValue(
          '--geo-google-ai-citation-concordance-path-depth',
          argv[++i]
        );
        const depth = Number(rawDepth);
        if (!Number.isInteger(depth) || depth < 1 || depth > 5) {
          process.stderr.write(
            '❌ --geo-google-ai-citation-concordance-path-depth requires an integer from 1 to 5.\n'
          );
          process.exit(2);
        }
        args.geoGoogleAiCitationConcordancePathDepth = depth;
        break;
      }
      case '--geo-platform-matrix':
        args.geoPlatformMatrix = true;
        break;
      case '--geo-google-surface-matrix':
        args.geoGoogleSurfaceMatrix = true;
        break;
      case '--geo-google-surface-baseline-json':
        args.geoGoogleSurfaceBaselineJson = requireOptionValue(
          '--geo-google-surface-baseline-json',
          argv[++i]
        );
        break;
      case '--geo-google-surface-path-family-csv':
        args.geoGoogleSurfacePathFamilyCsv = requireOptionValue(
          '--geo-google-surface-path-family-csv',
          argv[++i]
        );
        break;
      case '--geo-platform-baseline-json':
        args.geoPlatformBaselineJson = requireOptionValue(
          '--geo-platform-baseline-json',
          argv[++i]
        );
        break;
      case '--geo-sitemap':
        args.geoSitemap = requireOptionValue('--geo-sitemap', argv[++i]);
        break;
      case '--geo-sitemap-max-urls': {
        const rawCount = argv[++i];
        const maxUrls =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(maxUrls) || maxUrls < 1 || maxUrls > 10_000) {
          process.stderr.write('❌ --geo-sitemap-max-urls requires an integer from 1 to 10,000.\n');
          process.exit(2);
        }
        args.geoSitemapMaxUrls = maxUrls;
        break;
      }
      case '--geo-path-depth': {
        const rawDepth = argv[++i];
        const depth =
          rawDepth === undefined || rawDepth.trim() === '' ? Number.NaN : Number(rawDepth);
        if (!Number.isInteger(depth) || depth < 1 || depth > 5) {
          process.stderr.write('❌ --geo-path-depth requires an integer from 1 to 5.\n');
          process.exit(2);
        }
        args.geoPathDepth = depth;
        break;
      }
      case '--geo-audit-json':
        args.geoAuditJson = requireOptionValue('--geo-audit-json', argv[++i]);
        break;
      case '--geo-audit-baseline-json':
        args.geoAuditBaselineJson = requireOptionValue('--geo-audit-baseline-json', argv[++i]);
        break;
      case '--geo-crawler-path-families-csv':
        args.geoCrawlerPathFamiliesCsv = requireOptionValue(
          '--geo-crawler-path-families-csv',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-families-json':
        args.geoCrawlerPathFamiliesJson = requireOptionValue(
          '--geo-crawler-path-families-json',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-families-html':
        args.geoCrawlerPathFamiliesHtml = requireOptionValue(
          '--geo-crawler-path-families-html',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-audit-csv':
        args.geoCrawlerPathFamilyAuditCsv = requireOptionValue(
          '--geo-crawler-path-family-audit-csv',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-audit-json':
        args.geoCrawlerPathFamilyAuditJson = requireOptionValue(
          '--geo-crawler-path-family-audit-json',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-audit-html':
        args.geoCrawlerPathFamilyAuditHtml = requireOptionValue(
          '--geo-crawler-path-family-audit-html',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-audit-comparison-csv':
        args.geoCrawlerPathFamilyAuditComparisonCsv = requireOptionValue(
          '--geo-crawler-path-family-audit-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-audit-comparison-json':
        args.geoCrawlerPathFamilyAuditComparisonJson = requireOptionValue(
          '--geo-crawler-path-family-audit-comparison-json',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-audit-comparison-html':
        args.geoCrawlerPathFamilyAuditComparisonHtml = requireOptionValue(
          '--geo-crawler-path-family-audit-comparison-html',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-comparison-csv':
        args.geoCrawlerPathFamilyComparisonCsv = requireOptionValue(
          '--geo-crawler-path-family-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-comparison-json':
        args.geoCrawlerPathFamilyComparisonJson = requireOptionValue(
          '--geo-crawler-path-family-comparison-json',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-comparison-html':
        args.geoCrawlerPathFamilyComparisonHtml = requireOptionValue(
          '--geo-crawler-path-family-comparison-html',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-family-failure-gate-json':
        args.geoCrawlerPathFamilyFailureGateJson = requireOptionValue(
          '--geo-crawler-path-family-failure-gate-json',
          argv[++i]
        );
        break;
      case '--geo-crawler-path-depth': {
        const depth = Number(requireOptionValue('--geo-crawler-path-depth', argv[++i]));
        if (!Number.isInteger(depth) || depth < 1 || depth > 5) {
          process.stderr.write('❌ --geo-crawler-path-depth requires an integer from 1 to 5.\n');
          process.exit(2);
        }
        args.geoCrawlerPathDepth = depth;
        break;
      }
      case '--geo-crawler-log': {
        const file = requireOptionValue('--geo-crawler-log', argv[++i]);
        args.geoCrawlerLogs = [...(args.geoCrawlerLogs ?? []), file];
        break;
      }
      case '--geo-crawler-sitemap':
        args.geoCrawlerSitemap = requireOptionValue('--geo-crawler-sitemap', argv[++i]);
        break;
      case '--geo-crawler-sitemap-max-urls': {
        const rawLimit = requireOptionValue('--geo-crawler-sitemap-max-urls', argv[++i]);
        const limit = Number(rawLimit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
          process.stderr.write(
            '❌ --geo-crawler-sitemap-max-urls requires an integer from 1 to 10,000.\n'
          );
          process.exit(2);
        }
        args.geoCrawlerSitemapMaxUrls = limit;
        break;
      }
      case '--geo-crawler-baseline-json':
        args.geoCrawlerBaselineJson = requireOptionValue('--geo-crawler-baseline-json', argv[++i]);
        break;
      case '--geo-crawler-token': {
        const token = requireOptionValue('--geo-crawler-token', argv[++i]);
        args.geoCrawlerTokens = [...(args.geoCrawlerTokens ?? []), token];
        break;
      }
      case '--geo-crawler-ip-ranges':
        args.geoCrawlerIpRanges = requireOptionValue('--geo-crawler-ip-ranges', argv[++i]);
        break;
      case '--geo-ai-referral-source': {
        const source = requireOptionValue('--geo-ai-referral-source', argv[++i]);
        args.geoAiReferralSources = [...(args.geoAiReferralSources ?? []), source];
        break;
      }
      case '--geo-answer-observations':
        args.geoAnswerObservations = requireOptionValue('--geo-answer-observations', argv[++i]);
        break;
      case '--geo-answer-baseline-observations':
        args.geoAnswerBaselineObservations = requireOptionValue(
          '--geo-answer-baseline-observations',
          argv[++i]
        );
        break;
      case '--geo-answer-comparison-csv':
        args.geoAnswerComparisonCsv = requireOptionValue('--geo-answer-comparison-csv', argv[++i]);
        break;
      case '--geo-answer-provider-position-comparison-csv':
        args.geoAnswerProviderPositionComparisonCsv = requireOptionValue(
          '--geo-answer-provider-position-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-cohort-comparison-csv':
        args.geoAnswerCohortComparisonCsv = requireOptionValue(
          '--geo-answer-cohort-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-cohorts-csv':
        args.geoAnswerCohortsCsv = requireOptionValue('--geo-answer-cohorts-csv', argv[++i]);
        break;
      case '--geo-answer-provider-pairs-csv':
        args.geoAnswerProviderPairsCsv = requireOptionValue(
          '--geo-answer-provider-pairs-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-prompt-overlap-csv':
        args.geoAnswerProviderPromptOverlapCsv = requireOptionValue(
          '--geo-answer-provider-prompt-overlap-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-prompt-source-overlap-csv':
        args.geoAnswerProviderPromptSourceOverlapCsv = requireOptionValue(
          '--geo-answer-provider-prompt-source-overlap-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-sample-mix-csv':
        args.geoAnswerSampleMixCsv = requireOptionValue('--geo-answer-sample-mix-csv', argv[++i]);
        break;
      case '--geo-answer-cohort-standardization-csv':
        args.geoAnswerCohortStandardizationCsv = requireOptionValue(
          '--geo-answer-cohort-standardization-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-cohort-period-standardization-csv':
        args.geoAnswerCohortPeriodStandardizationCsv = requireOptionValue(
          '--geo-answer-cohort-period-standardization-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-sampling-plan-csv':
        args.geoAnswerPromptSamplingPlanCsv = requireOptionValue(
          '--geo-answer-prompt-sampling-plan-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-sampling-plan-json':
        args.geoAnswerPromptSamplingPlanJson = requireOptionValue(
          '--geo-answer-prompt-sampling-plan-json',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-plan-provider-pairs-csv':
        args.geoAnswerPromptPlanProviderPairsCsv = requireOptionValue(
          '--geo-answer-prompt-plan-provider-pairs-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-execution-context-csv':
        args.geoAnswerExecutionContextCsv = requireOptionValue(
          '--geo-answer-execution-context-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-execution-context-coverage-csv':
        args.geoAnswerExecutionContextCoverageCsv = requireOptionValue(
          '--geo-answer-execution-context-coverage-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-execution-context-comparison-csv':
        args.geoAnswerExecutionContextComparisonCsv = requireOptionValue(
          '--geo-answer-execution-context-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-execution-context-trends-csv':
        args.geoAnswerExecutionContextTrendsCsv = requireOptionValue(
          '--geo-answer-execution-context-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-length-profiles-csv':
        args.geoAnswerLengthProfilesCsv = requireOptionValue(
          '--geo-answer-length-profiles-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-length-comparison-csv':
        args.geoAnswerLengthComparisonCsv = requireOptionValue(
          '--geo-answer-length-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-length-trends-csv':
        args.geoAnswerLengthTrendsCsv = requireOptionValue(
          '--geo-answer-length-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-plan-min-prompts': {
        const rawCount = argv[++i];
        const minimumPrompts =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(minimumPrompts) || minimumPrompts < 1 || minimumPrompts > 10_000) {
          process.stderr.write(
            '❌ --geo-answer-prompt-plan-min-prompts requires an integer from 1 to 10,000.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptPlanMinPrompts = minimumPrompts;
        break;
      }
      case '--geo-answer-prompt-plan-owned-reach-margin': {
        const rawMargin = argv[++i];
        const margin =
          rawMargin === undefined || rawMargin.trim() === '' ? Number.NaN : Number(rawMargin);
        if (!Number.isFinite(margin) || margin < 0.5 || margin > 50) {
          process.stderr.write(
            '❌ --geo-answer-prompt-plan-owned-reach-margin requires a value from 0.5 to 50 percentage points.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptPlanOwnedReachMargin = margin;
        break;
      }
      case '--geo-answer-prompt-plan-min-jaccard': {
        const rawTarget = argv[++i];
        const target =
          rawTarget === undefined || rawTarget.trim() === '' ? Number.NaN : Number(rawTarget);
        if (!Number.isFinite(target) || target < 0.5 || target > 0.99) {
          process.stderr.write(
            '❌ --geo-answer-prompt-plan-min-jaccard requires a value from 0.5 to 0.99.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptPlanMinimumJaccard = target;
        break;
      }
      case '--geo-answer-prompt-plan-max-paired-groups': {
        const rawMaximum = argv[++i];
        const maximum =
          rawMaximum === undefined || rawMaximum.trim() === '' ? Number.NaN : Number(rawMaximum);
        if (!Number.isSafeInteger(maximum) || maximum < 0) {
          process.stderr.write(
            '❌ --geo-answer-prompt-plan-max-paired-groups requires a non-negative safe integer.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptPlanMaxPairedGroups = maximum;
        break;
      }
      case '--geo-answer-prompt-plan-max-total-paired-groups': {
        const rawMaximum = argv[++i];
        const maximum =
          rawMaximum === undefined || rawMaximum.trim() === '' ? Number.NaN : Number(rawMaximum);
        if (!Number.isSafeInteger(maximum) || maximum < 0) {
          process.stderr.write(
            '❌ --geo-answer-prompt-plan-max-total-paired-groups requires a non-negative safe integer.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptPlanMaxTotalPairedGroups = maximum;
        break;
      }
      case '--geo-answer-prompt-plan-total-allocation': {
        const allocation = requireOptionValue(
          '--geo-answer-prompt-plan-total-allocation',
          argv[++i]
        );
        if (allocation !== 'balanced' && allocation !== 'proportional') {
          process.stderr.write(
            '❌ --geo-answer-prompt-plan-total-allocation requires balanced or proportional.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptPlanTotalAllocation = allocation;
        break;
      }
      case '--geo-answer-prompt-plan-cohort-targets':
        args.geoAnswerPromptPlanCohortTargets = requireOptionValue(
          '--geo-answer-prompt-plan-cohort-targets',
          argv[++i]
        );
        break;
      case '--fail-on-geo-answer-prompt-plan-miss':
        args.failOnGeoAnswerPromptPlanMiss = true;
        break;
      case '--geo-answer-stability-csv':
        args.geoAnswerTemporalStabilityCsv = requireOptionValue(
          '--geo-answer-stability-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-persistence-csv':
        args.geoAnswerSourcePersistenceCsv = requireOptionValue(
          '--geo-answer-source-persistence-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-citation-url-persistence-csv':
        args.geoAnswerCitationUrlPersistenceCsv = requireOptionValue(
          '--geo-answer-citation-url-persistence-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-cohort-trends-csv':
        args.geoAnswerCohortTrendsCsv = requireOptionValue(
          '--geo-answer-cohort-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-audit-signals-csv':
        args.geoAnswerAuditSignalsCsv = requireOptionValue(
          '--geo-answer-audit-signals-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-provider-inventory-csv':
        args.geoAnswerAuditedOwnedPageProviderInventoryCsv = requireOptionValue(
          '--geo-answer-audited-owned-page-provider-inventory-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-provider-inventory-html':
        args.geoAnswerAuditedOwnedPageProviderInventoryHtml = requireOptionValue(
          '--geo-answer-audited-owned-page-provider-inventory-html',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-provider-inventory-comparison-csv':
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv = requireOptionValue(
          '--geo-answer-audited-owned-page-provider-inventory-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-provider-inventory-comparison-html':
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml = requireOptionValue(
          '--geo-answer-audited-owned-page-provider-inventory-comparison-html',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-provider-inventory-comparison-json':
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson = requireOptionValue(
          '--geo-answer-audited-owned-page-provider-inventory-comparison-json',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-pages-csv':
        args.geoAnswerAuditedOwnedPagesCsv = requireOptionValue(
          '--geo-answer-audited-owned-pages-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-comparison-csv':
        args.geoAnswerAuditedOwnedPageComparisonCsv = requireOptionValue(
          '--geo-answer-audited-owned-page-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-providers-csv':
        args.geoAnswerAuditedOwnedPageProvidersCsv = requireOptionValue(
          '--geo-answer-audited-owned-page-providers-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-audited-owned-page-provider-comparison-csv':
        args.geoAnswerAuditedOwnedPageProviderComparisonCsv = requireOptionValue(
          '--geo-answer-audited-owned-page-provider-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category': {
        const mapping = requireOptionValue('--geo-answer-source-category', argv[++i]);
        args.geoAnswerSourceCategories = [...(args.geoAnswerSourceCategories ?? []), mapping];
        break;
      }
      case '--geo-answer-source-categories-csv':
        args.geoAnswerSourceCategoriesCsv = requireOptionValue(
          '--geo-answer-source-categories-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-mapping-audit-csv':
        args.geoAnswerSourceCategoryMappingAuditCsv = requireOptionValue(
          '--geo-answer-source-category-mapping-audit-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-concentration-trends-html':
        args.geoAnswerSourceCategoryConcentrationTrendsHtml = requireOptionValue(
          '--geo-answer-source-category-concentration-trends-html',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-concentration-trends-csv':
        args.geoAnswerSourceCategoryConcentrationTrendsCsv = requireOptionValue(
          '--geo-answer-source-category-concentration-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-share-trends-csv':
        args.geoAnswerSourceCategoryShareTrendsCsv = requireOptionValue(
          '--geo-answer-source-category-share-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-share-trends-html':
        args.geoAnswerSourceCategoryShareTrendsHtml = requireOptionValue(
          '--geo-answer-source-category-share-trends-html',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-monthly-gates-json':
        args.geoAnswerSourceCategoryMonthlyGatesJson = requireOptionValue(
          '--geo-answer-source-category-monthly-gates-json',
          argv[++i]
        );
        break;
      case '--fail-on-geo-answer-source-category-monthly-jsd-above': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-source-category-monthly-jsd-above',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (!rawThreshold.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-monthly-jsd-above must be between 0 and 1 bit.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove = threshold;
        break;
      }
      case '--fail-on-geo-answer-source-category-monthly-hhi-rise-above': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-source-category-monthly-hhi-rise-above',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (!rawThreshold.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-monthly-hhi-rise-above must be between 0 and 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove = threshold;
        break;
      }
      case '--fail-on-geo-answer-source-category-monthly-top-three-hhi-rise-above': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-source-category-monthly-top-three-hhi-rise-above',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (!rawThreshold.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-monthly-top-three-hhi-rise-above must be between 0 and 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove = threshold;
        break;
      }
      case '--fail-on-geo-answer-source-category-monthly-hhi-above': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-source-category-monthly-hhi-above',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (!rawThreshold.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-monthly-hhi-above must be between 0 and 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove = threshold;
        break;
      }
      case '--fail-on-geo-answer-source-category-monthly-top-three-hhi-above': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-source-category-monthly-top-three-hhi-above',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (!rawThreshold.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-monthly-top-three-hhi-above must be between 0 and 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove = threshold;
        break;
      }
      case '--fail-on-geo-answer-source-category-monthly-min-events': {
        const rawMinimum = requireOptionValue(
          '--fail-on-geo-answer-source-category-monthly-min-events',
          argv[++i]
        );
        const minimum = Number(rawMinimum);
        if (
          !rawMinimum.trim() ||
          !Number.isInteger(minimum) ||
          minimum < 1 ||
          minimum > 1_000_000
        ) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-monthly-min-events must be an integer from 1 to 1000000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryMonthlyMinEvents = minimum;
        break;
      }
      case '--fail-on-geo-answer-source-category-prompt-balanced-jsd-lower-ci-above': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-source-category-prompt-balanced-jsd-lower-ci-above',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (!rawThreshold.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-prompt-balanced-jsd-lower-ci-above must be between 0 and 1 bit.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove = threshold;
        break;
      }
      case '--fail-on-geo-answer-source-category-prompt-balanced-jsd-min-prompts': {
        const rawMinimum = requireOptionValue(
          '--fail-on-geo-answer-source-category-prompt-balanced-jsd-min-prompts',
          argv[++i]
        );
        const minimum = Number(rawMinimum);
        if (!rawMinimum.trim() || !Number.isInteger(minimum) || minimum < 2 || minimum > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-prompt-balanced-jsd-min-prompts must be an integer from 2 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryPromptBalancedJsdMinPrompts = minimum;
        break;
      }
      case '--geo-answer-source-category-prompt-balanced-jsd-gate-json':
        args.geoAnswerSourceCategoryPromptBalancedJsdGateJson = requireOptionValue(
          '--geo-answer-source-category-prompt-balanced-jsd-gate-json',
          argv[++i]
        );
        break;
      case '--fail-on-geo-answer-source-category-share-drop': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-source-category-share-drop',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (
          !rawThreshold.trim() ||
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 100
        ) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-source-category-share-drop must be between 0 and 100 percentage points.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSourceCategoryShareDrop = threshold;
        break;
      }
      case '--geo-answer-source-category-mix-decomposition-html':
        args.geoAnswerSourceCategoryMixDecompositionHtml = requireOptionValue(
          '--geo-answer-source-category-mix-decomposition-html',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-mix-decomposition-csv':
        args.geoAnswerSourceCategoryMixDecompositionCsv = requireOptionValue(
          '--geo-answer-source-category-mix-decomposition-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-comparison-csv':
        args.geoAnswerSourceCategoryComparisonCsv = requireOptionValue(
          '--geo-answer-source-category-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-prompt-coverage-csv':
        args.geoAnswerSourceCategoryPromptCoverageCsv = requireOptionValue(
          '--geo-answer-source-category-prompt-coverage-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-prompt-details-csv':
        args.geoAnswerSourceCategoryPromptDetailsCsv = requireOptionValue(
          '--geo-answer-source-category-prompt-details-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-trends-csv':
        args.geoAnswerSourceCategoryTrendsCsv = requireOptionValue(
          '--geo-answer-source-category-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-provider-pairs-csv':
        args.geoAnswerSourceCategoryProviderPairsCsv = requireOptionValue(
          '--geo-answer-source-category-provider-pairs-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-cooccurrence-csv':
        args.geoAnswerSourceCategoryCooccurrenceCsv = requireOptionValue(
          '--geo-answer-source-category-cooccurrence-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-path-families-csv':
        args.geoAnswerSourceCategoryPathFamiliesCsv = requireOptionValue(
          '--geo-answer-source-category-path-families-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-category-path-family-comparison-csv':
        args.geoAnswerSourceCategoryPathFamilyComparisonCsv = requireOptionValue(
          '--geo-answer-source-category-path-family-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-citation-positions-csv':
        args.geoAnswerCitationPositionsCsv = requireOptionValue(
          '--geo-answer-citation-positions-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-domain-prompt-coverage-csv':
        args.geoAnswerDomainPromptCoverageCsv = requireOptionValue(
          '--geo-answer-domain-prompt-coverage-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-rarefaction-csv':
        args.geoAnswerSourceRarefactionCsv = requireOptionValue(
          '--geo-answer-source-rarefaction-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-source-rarefaction-csv':
        args.geoAnswerPromptFamilySourceRarefactionCsv = requireOptionValue(
          '--geo-answer-prompt-family-source-rarefaction-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-source-rarefaction-html':
        args.geoAnswerPromptFamilySourceRarefactionHtml = requireOptionValue(
          '--geo-answer-prompt-family-source-rarefaction-html',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-source-rarefaction-sweep-csv':
        args.geoAnswerPromptFamilySourceRarefactionSweepCsv = requireOptionValue(
          '--geo-answer-prompt-family-source-rarefaction-sweep-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-source-rarefaction-sweep-html':
        args.geoAnswerPromptFamilySourceRarefactionSweepHtml = requireOptionValue(
          '--geo-answer-prompt-family-source-rarefaction-sweep-html',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-prompt-family-source-overlap-csv':
        args.geoAnswerProviderPromptFamilySourceOverlapCsv = requireOptionValue(
          '--geo-answer-provider-prompt-family-source-overlap-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-prompt-family-source-overlap-html':
        args.geoAnswerProviderPromptFamilySourceOverlapHtml = requireOptionValue(
          '--geo-answer-provider-prompt-family-source-overlap-html',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-prompt-family-source-overlap-sweep-csv':
        args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv = requireOptionValue(
          '--geo-answer-provider-prompt-family-source-overlap-sweep-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-prompt-family-source-overlap-sweep-html':
        args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml = requireOptionValue(
          '--geo-answer-provider-prompt-family-source-overlap-sweep-html',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-period-comparison-csv':
        args.geoAnswerPromptFamilyPeriodComparisonCsv = requireOptionValue(
          '--geo-answer-prompt-family-period-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-period-comparison-html':
        args.geoAnswerPromptFamilyPeriodComparisonHtml = requireOptionValue(
          '--geo-answer-prompt-family-period-comparison-html',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-period-comparison-sweep-csv':
        args.geoAnswerPromptFamilyPeriodComparisonSweepCsv = requireOptionValue(
          '--geo-answer-prompt-family-period-comparison-sweep-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-period-comparison-sweep-summary-csv':
        args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv = requireOptionValue(
          '--geo-answer-prompt-family-period-comparison-sweep-summary-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-period-comparison-sweep-html':
        args.geoAnswerPromptFamilyPeriodComparisonSweepHtml = requireOptionValue(
          '--geo-answer-prompt-family-period-comparison-sweep-html',
          argv[++i]
        );
        break;
      case '--geo-answer-source-rarefaction-batch-size': {
        const rawBatchSize = argv[++i];
        const batchSize =
          rawBatchSize === undefined || rawBatchSize.trim() === ''
            ? Number.NaN
            : Number(rawBatchSize);
        if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
          process.stderr.write(
            '❌ --geo-answer-source-rarefaction-batch-size requires a whole number from 1 to 1,000.\n'
          );
          process.exit(2);
        }
        args.geoAnswerSourceRarefactionBatchSize = batchSize;
        break;
      }
      case '--geo-answer-domain-prompt-coverage-comparison-csv':
        args.geoAnswerDomainPromptCoverageComparisonCsv = requireOptionValue(
          '--geo-answer-domain-prompt-coverage-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-similarity-csv':
        args.geoAnswerPromptSimilarityCsv = requireOptionValue(
          '--geo-answer-prompt-similarity-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-families-csv':
        args.geoAnswerPromptFamiliesCsv = requireOptionValue(
          '--geo-answer-prompt-families-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-families-html':
        args.geoAnswerPromptFamiliesHtml = requireOptionValue(
          '--geo-answer-prompt-families-html',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-influence-csv':
        args.geoAnswerPromptFamilyInfluenceCsv = requireOptionValue(
          '--geo-answer-prompt-family-influence-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-influence-html':
        args.geoAnswerPromptFamilyInfluenceHtml = requireOptionValue(
          '--geo-answer-prompt-family-influence-html',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-threshold-sweep-csv':
        args.geoAnswerPromptFamilyThresholdSweepCsv = requireOptionValue(
          '--geo-answer-prompt-family-threshold-sweep-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-family-threshold-sweep-html':
        args.geoAnswerPromptFamilyThresholdSweepHtml = requireOptionValue(
          '--geo-answer-prompt-family-threshold-sweep-html',
          argv[++i]
        );
        break;
      case '--geo-answer-domain-paired-reach-comparison-csv':
        args.geoAnswerDomainPairedReachComparisonCsv = requireOptionValue(
          '--geo-answer-domain-paired-reach-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-domain-paired-reach-comparison-json':
        args.geoAnswerDomainPairedReachComparisonJson = requireOptionValue(
          '--geo-answer-domain-paired-reach-comparison-json',
          argv[++i]
        );
        break;
      case '--fail-on-geo-answer-domain-paired-reach-drop': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-domain-paired-reach-drop',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (
          !rawThreshold.trim() ||
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 100
        ) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-domain-paired-reach-drop must be between 0 and 100 percentage points.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerDomainPairedReachDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-domain-paired-reach-alpha': {
        const rawAlpha = requireOptionValue(
          '--fail-on-geo-answer-domain-paired-reach-alpha',
          argv[++i]
        );
        const alpha = Number(rawAlpha);
        if (!rawAlpha.trim() || !Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-domain-paired-reach-alpha must be greater than 0 and at most 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerDomainPairedReachAlpha = alpha;
        break;
      }
      case '--fail-on-geo-answer-domain-paired-reach-min-prompts': {
        const rawMinimum = requireOptionValue(
          '--fail-on-geo-answer-domain-paired-reach-min-prompts',
          argv[++i]
        );
        const minimum = Number(rawMinimum);
        if (!rawMinimum.trim() || !Number.isInteger(minimum) || minimum < 2 || minimum > 100000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-domain-paired-reach-min-prompts must be an integer from 2 to 100000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerDomainPairedReachMinPrompts = minimum;
        break;
      }
      case '--geo-answer-domain-paired-reach-gate-json':
        args.geoAnswerDomainPairedReachGateJson = requireOptionValue(
          '--geo-answer-domain-paired-reach-gate-json',
          argv[++i]
        );
        break;
      case '--geo-answer-page-paired-reach-comparison-csv':
        args.geoAnswerPagePairedReachComparisonCsv = requireOptionValue(
          '--geo-answer-page-paired-reach-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-page-paired-reach-comparison-json':
        args.geoAnswerPagePairedReachComparisonJson = requireOptionValue(
          '--geo-answer-page-paired-reach-comparison-json',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunities-csv':
        args.geoAnswerPageOpportunitiesCsv = requireOptionValue(
          '--geo-answer-page-opportunities-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunity-trends-csv':
        args.geoAnswerPageOpportunityTrendsCsv = requireOptionValue(
          '--geo-answer-page-opportunity-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunity-path-families-csv':
        args.geoAnswerPageOpportunityPathFamiliesCsv = requireOptionValue(
          '--geo-answer-page-opportunity-path-families-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunity-path-family-depth-sweep-csv':
        args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv = requireOptionValue(
          '--geo-answer-page-opportunity-path-family-depth-sweep-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunity-path-family-depth-sweep-html':
        args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml = requireOptionValue(
          '--geo-answer-page-opportunity-path-family-depth-sweep-html',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunity-path-family-trends-csv':
        args.geoAnswerPageOpportunityPathFamilyTrendsCsv = requireOptionValue(
          '--geo-answer-page-opportunity-path-family-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunity-path-family-trends-html':
        args.geoAnswerPageOpportunityPathFamilyTrendsHtml = requireOptionValue(
          '--geo-answer-page-opportunity-path-family-trends-html',
          argv[++i]
        );
        break;
      case '--geo-answer-page-opportunity-path-depth': {
        const rawDepth = argv[++i];
        const depth =
          rawDepth === undefined || rawDepth.trim() === '' ? Number.NaN : Number(rawDepth);
        if (!Number.isInteger(depth) || depth < 1 || depth > 5) {
          process.stderr.write(
            '❌ --geo-answer-page-opportunity-path-depth requires an integer from 1 to 5.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPageOpportunityPathDepth = depth;
        break;
      }
      case '--fail-on-geo-answer-page-opportunity-monthly-rise': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-opportunity-monthly-rise requires a value from 0 to 100 percentage points.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPageOpportunityMonthlyRise = threshold;
        break;
      }
      case '--fail-on-geo-answer-page-opportunity-monthly-alpha': {
        const rawAlpha = argv[++i];
        const alpha =
          rawAlpha === undefined || rawAlpha.trim() === '' ? Number.NaN : Number(rawAlpha);
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-opportunity-monthly-alpha requires a value greater than 0 and at most 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPageOpportunityMonthlyAlpha = alpha;
        break;
      }
      case '--fail-on-geo-answer-page-opportunity-monthly-min-prompts': {
        const rawMinimum = argv[++i];
        const minimum =
          rawMinimum === undefined || rawMinimum.trim() === '' ? Number.NaN : Number(rawMinimum);
        if (!Number.isInteger(minimum) || minimum < 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-opportunity-monthly-min-prompts requires a positive integer.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPageOpportunityMonthlyMinPrompts = minimum;
        break;
      }
      case '--geo-answer-page-opportunity-monthly-gate-json':
        args.geoAnswerPageOpportunityMonthlyGateJson = requireOptionValue(
          '--geo-answer-page-opportunity-monthly-gate-json',
          argv[++i]
        );
        break;
      case '--fail-on-geo-answer-page-opportunity-path-family-monthly-rise': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-opportunity-path-family-monthly-rise requires a value from 0 to 100 percentage points.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise = threshold;
        break;
      }
      case '--fail-on-geo-answer-page-opportunity-path-family-monthly-alpha': {
        const rawAlpha = argv[++i];
        const alpha =
          rawAlpha === undefined || rawAlpha.trim() === '' ? Number.NaN : Number(rawAlpha);
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-opportunity-path-family-monthly-alpha requires a value greater than 0 and at most 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyAlpha = alpha;
        break;
      }
      case '--fail-on-geo-answer-page-opportunity-path-family-monthly-min-prompts': {
        const rawMinimum = argv[++i];
        const minimum =
          rawMinimum === undefined || rawMinimum.trim() === '' ? Number.NaN : Number(rawMinimum);
        if (!Number.isInteger(minimum) || minimum < 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-opportunity-path-family-monthly-min-prompts requires a positive integer.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyMinPrompts = minimum;
        break;
      }
      case '--geo-answer-page-opportunity-path-family-monthly-gate-json':
        args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson = requireOptionValue(
          '--geo-answer-page-opportunity-path-family-monthly-gate-json',
          argv[++i]
        );
        break;
      case '--geo-answer-page-paired-reach-owned-only':
        args.geoAnswerPagePairedReachOwnedOnly = true;
        break;
      case '--fail-on-geo-answer-page-paired-reach-drop': {
        const rawThreshold = requireOptionValue(
          '--fail-on-geo-answer-page-paired-reach-drop',
          argv[++i]
        );
        const threshold = Number(rawThreshold);
        if (
          !rawThreshold.trim() ||
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 100
        ) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-paired-reach-drop must be between 0 and 100 percentage points.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPagePairedReachDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-page-paired-reach-alpha': {
        const rawAlpha = requireOptionValue(
          '--fail-on-geo-answer-page-paired-reach-alpha',
          argv[++i]
        );
        const alpha = Number(rawAlpha);
        if (!rawAlpha.trim() || !Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-paired-reach-alpha must be greater than 0 and at most 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPagePairedReachAlpha = alpha;
        break;
      }
      case '--fail-on-geo-answer-page-paired-reach-min-prompts': {
        const rawMinimum = requireOptionValue(
          '--fail-on-geo-answer-page-paired-reach-min-prompts',
          argv[++i]
        );
        const minimum = Number(rawMinimum);
        if (!rawMinimum.trim() || !Number.isInteger(minimum) || minimum < 2 || minimum > 100000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-page-paired-reach-min-prompts must be an integer from 2 to 100000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPagePairedReachMinPrompts = minimum;
        break;
      }
      case '--geo-answer-page-paired-reach-metric': {
        const metric = requireOptionValue('--geo-answer-page-paired-reach-metric', argv[++i]);
        if (!['citation-reach', 'top-three-reach', 'first-position-reach'].includes(metric)) {
          process.stderr.write(
            '❌ --geo-answer-page-paired-reach-metric must be citation-reach, top-three-reach, or first-position-reach.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPagePairedReachMetric = metric as NonNullable<
          CliArgs['geoAnswerPagePairedReachMetric']
        >;
        break;
      }
      case '--geo-answer-page-paired-reach-gate-json':
        args.geoAnswerPagePairedReachGateJson = requireOptionValue(
          '--geo-answer-page-paired-reach-gate-json',
          argv[++i]
        );
        break;
      case '--geo-answer-source-diversity-uncertainty-csv':
        args.geoAnswerSourceDiversityUncertaintyCsv = requireOptionValue(
          '--geo-answer-source-diversity-uncertainty-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-diversity-uncertainty-html':
        args.geoAnswerSourceDiversityUncertaintyHtml = requireOptionValue(
          '--geo-answer-source-diversity-uncertainty-html',
          argv[++i]
        );
        break;
      case '--geo-answer-source-diversity-comparison-csv':
        args.geoAnswerSourceDiversityComparisonCsv = requireOptionValue(
          '--geo-answer-source-diversity-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-diversity-comparison-html':
        args.geoAnswerSourceDiversityComparisonHtml = requireOptionValue(
          '--geo-answer-source-diversity-comparison-html',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-source-divergence-csv':
        args.geoAnswerProviderSourceDivergenceCsv = requireOptionValue(
          '--geo-answer-provider-source-divergence-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-portfolio-drift-csv':
        args.geoAnswerSourcePortfolioDriftCsv = requireOptionValue(
          '--geo-answer-source-portfolio-drift-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-portfolio-drift-html':
        args.geoAnswerSourcePortfolioDriftHtml = requireOptionValue(
          '--geo-answer-source-portfolio-drift-html',
          argv[++i]
        );
        break;
      case '--geo-answer-source-portfolio-drift-json':
        args.geoAnswerSourcePortfolioDriftJson = requireOptionValue(
          '--geo-answer-source-portfolio-drift-json',
          argv[++i]
        );
        break;
      case '--geo-answer-source-portfolio-attribution-csv':
        args.geoAnswerSourcePortfolioAttributionCsv = requireOptionValue(
          '--geo-answer-source-portfolio-attribution-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-portfolio-attribution-json':
        args.geoAnswerSourcePortfolioAttributionJson = requireOptionValue(
          '--geo-answer-source-portfolio-attribution-json',
          argv[++i]
        );
        break;
      case '--geo-answer-source-portfolio-attribution-html':
        args.geoAnswerSourcePortfolioAttributionHtml = requireOptionValue(
          '--geo-answer-source-portfolio-attribution-html',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-source-share-gate-csv':
        args.geoAnswerOwnedSourceShareGateCsv = requireOptionValue(
          '--geo-answer-owned-source-share-gate-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-source-share-gate-json':
        args.geoAnswerOwnedSourceShareGateJson = requireOptionValue(
          '--geo-answer-owned-source-share-gate-json',
          argv[++i]
        );
        break;
      case '--geo-answer-source-network-csv':
        args.geoAnswerSourceNetworkCsv = requireOptionValue(
          '--geo-answer-source-network-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-network-comparison-csv':
        args.geoAnswerSourceNetworkComparisonCsv = requireOptionValue(
          '--geo-answer-source-network-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-rank-weighted-source-network-csv':
        args.geoAnswerRankWeightedSourceNetworkCsv = requireOptionValue(
          '--geo-answer-rank-weighted-source-network-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-rank-weighted-source-network-comparison-csv':
        args.geoAnswerRankWeightedSourceNetworkComparisonCsv = requireOptionValue(
          '--geo-answer-rank-weighted-source-network-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-source-network-html':
        args.geoAnswerSourceNetworkHtml = requireOptionValue(
          '--geo-answer-source-network-html',
          argv[++i]
        );
        break;
      case '--geo-answer-source-network-comparison-html':
        args.geoAnswerSourceNetworkComparisonHtml = requireOptionValue(
          '--geo-answer-source-network-comparison-html',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-source-network-overlap-csv':
        args.geoAnswerProviderSourceNetworkOverlapCsv = requireOptionValue(
          '--geo-answer-provider-source-network-overlap-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-source-network-edge-drift-csv':
        args.geoAnswerProviderSourceNetworkEdgeDriftCsv = requireOptionValue(
          '--geo-answer-provider-source-network-edge-drift-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-source-network-edge-drift-html':
        args.geoAnswerProviderSourceNetworkEdgeDriftHtml = requireOptionValue(
          '--geo-answer-provider-source-network-edge-drift-html',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-source-network-edge-comparison-csv':
        args.geoAnswerProviderSourceNetworkEdgeComparisonCsv = requireOptionValue(
          '--geo-answer-provider-source-network-edge-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-source-network-edge-html':
        args.geoAnswerProviderSourceNetworkEdgeHtml = requireOptionValue(
          '--geo-answer-provider-source-network-edge-html',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-source-network-gaps-csv':
        args.geoAnswerOwnedSourceNetworkGapsCsv = requireOptionValue(
          '--geo-answer-owned-source-network-gaps-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-prompt-similarity-threshold': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --geo-answer-prompt-similarity-threshold requires a cosine similarity from 0 to 1.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptSimilarityThreshold = threshold;
        break;
      }
      case '--geo-answer-prompt-family-threshold': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --geo-answer-prompt-family-threshold requires a cosine similarity from 0 to 1.\n'
          );
          process.exit(2);
        }
        args.geoAnswerPromptFamilyThreshold = threshold;
        break;
      }
      case '--geo-answer-citation-date-alignment-csv':
        args.geoAnswerCitationDateAlignmentCsv = requireOptionValue(
          '--geo-answer-citation-date-alignment-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-prompt-coverage-csv':
        args.geoAnswerOwnedPromptCoverageCsv = requireOptionValue(
          '--geo-answer-owned-prompt-coverage-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-prompt-reach-period-csv':
        args.geoAnswerOwnedPromptReachPeriodCsv = requireOptionValue(
          '--geo-answer-owned-prompt-reach-period-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-prompt-opportunities-csv':
        args.geoAnswerOwnedPromptOpportunitiesCsv = requireOptionValue(
          '--geo-answer-owned-prompt-opportunities-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-competitive-gaps-csv':
        args.geoAnswerCompetitiveGapsCsv = requireOptionValue(
          '--geo-answer-competitive-gaps-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-owned-gaps-csv':
        args.geoAnswerProviderOwnedGapsCsv = requireOptionValue(
          '--geo-answer-provider-owned-gaps-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-provider-owned-gap-comparison-csv':
        args.geoAnswerProviderOwnedGapComparisonCsv = requireOptionValue(
          '--geo-answer-provider-owned-gap-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-competitive-gap-comparison-csv':
        args.geoAnswerCompetitiveGapComparisonCsv = requireOptionValue(
          '--geo-answer-competitive-gap-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-rank-csv':
        args.geoAnswerOwnedRankCsv = requireOptionValue('--geo-answer-owned-rank-csv', argv[++i]);
        break;
      case '--geo-answer-owned-rank-comparison-csv':
        args.geoAnswerOwnedRankComparisonCsv = requireOptionValue(
          '--geo-answer-owned-rank-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-prompt-rank-comparison-csv':
        args.geoAnswerOwnedPromptRankComparisonCsv = requireOptionValue(
          '--geo-answer-owned-prompt-rank-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-co-citation-csv':
        args.geoAnswerCoCitationCsv = requireOptionValue('--geo-answer-co-citation-csv', argv[++i]);
        break;
      case '--geo-answer-co-citation-comparison-csv':
        args.geoAnswerCoCitationComparisonCsv = requireOptionValue(
          '--geo-answer-co-citation-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity': {
        const entity = requireOptionValue('--geo-answer-entity', argv[++i]);
        args.geoAnswerEntities = [...(args.geoAnswerEntities ?? []), entity];
        break;
      }
      case '--geo-answer-entity-mentions-csv':
        args.geoAnswerEntityMentionsCsv = requireOptionValue(
          '--geo-answer-entity-mentions-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-prompt-details-csv':
        args.geoAnswerEntityPromptDetailsCsv = requireOptionValue(
          '--geo-answer-entity-prompt-details-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-prompt-provider-pairs-csv':
        args.geoAnswerEntityPromptProviderPairsCsv = requireOptionValue(
          '--geo-answer-entity-prompt-provider-pairs-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-prompt-comparison-csv':
        args.geoAnswerEntityPromptComparisonCsv = requireOptionValue(
          '--geo-answer-entity-prompt-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-co-mentions-csv':
        args.geoAnswerEntityCoMentionsCsv = requireOptionValue(
          '--geo-answer-entity-co-mentions-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-co-mention-comparison-csv':
        args.geoAnswerEntityCoMentionComparisonCsv = requireOptionValue(
          '--geo-answer-entity-co-mention-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-citation-domains-csv':
        args.geoAnswerEntityCitationDomainsCsv = requireOptionValue(
          '--geo-answer-entity-citation-domains-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-citation-pages-csv':
        args.geoAnswerEntityCitationPagesCsv = requireOptionValue(
          '--geo-answer-entity-citation-pages-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-source-categories-csv':
        args.geoAnswerEntitySourceCategoriesCsv = requireOptionValue(
          '--geo-answer-entity-source-categories-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-source-category-comparison-csv':
        args.geoAnswerEntitySourceCategoryComparisonCsv = requireOptionValue(
          '--geo-answer-entity-source-category-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-citation-domain-comparison-csv':
        args.geoAnswerEntityCitationDomainComparisonCsv = requireOptionValue(
          '--geo-answer-entity-citation-domain-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-citation-page-comparison-csv':
        args.geoAnswerEntityCitationPageComparisonCsv = requireOptionValue(
          '--geo-answer-entity-citation-page-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-citation-position-comparison-csv':
        args.geoAnswerEntityCitationPositionComparisonCsv = requireOptionValue(
          '--geo-answer-entity-citation-position-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-opportunities-csv':
        args.geoAnswerEntityOpportunitiesCsv = requireOptionValue(
          '--geo-answer-entity-opportunities-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-prompt-matched-association-csv':
        args.geoAnswerEntityPromptMatchedAssociationCsv = requireOptionValue(
          '--geo-answer-entity-prompt-matched-association-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-prompt-matched-association-html':
        args.geoAnswerEntityPromptMatchedAssociationHtml = requireOptionValue(
          '--geo-answer-entity-prompt-matched-association-html',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-path-families-csv':
        args.geoAnswerEntityPathFamiliesCsv = requireOptionValue(
          '--geo-answer-entity-path-families-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-path-family-monthly-csv':
        args.geoAnswerEntityPathFamilyMonthlyCsv = requireOptionValue(
          '--geo-answer-entity-path-family-monthly-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-entity-path-family-comparison-csv':
        args.geoAnswerEntityPathFamilyComparisonCsv = requireOptionValue(
          '--geo-answer-entity-path-family-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-path-depth': {
        const rawDepth = argv[++i];
        const depth =
          rawDepth === undefined || rawDepth.trim() === '' ? Number.NaN : Number(rawDepth);
        if (!Number.isInteger(depth) || depth < 1 || depth > 5) {
          process.stderr.write('❌ --geo-answer-path-depth requires an integer from 1 to 5.\n');
          process.exit(2);
        }
        args.geoAnswerPathDepth = depth;
        break;
      }
      case '--geo-answer-path-family-csv':
        args.geoAnswerPathFamiliesCsv = requireOptionValue(
          '--geo-answer-path-family-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-path-family-cohorts-csv':
        args.geoAnswerPathFamilyCohortsCsv = requireOptionValue(
          '--geo-answer-path-family-cohorts-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-path-family-trends-csv':
        args.geoAnswerPathFamilyTrendsCsv = requireOptionValue(
          '--geo-answer-path-family-trends-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-path-family-cohort-comparison-csv':
        args.geoAnswerPathFamilyCohortComparisonCsv = requireOptionValue(
          '--geo-answer-path-family-cohort-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-path-family-comparison-csv':
        args.geoAnswerPathFamilyComparisonCsv = requireOptionValue(
          '--geo-answer-path-family-comparison-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-crawler-report':
        args.geoAnswerCrawlerReport = requireOptionValue('--geo-answer-crawler-report', argv[++i]);
        break;
      case '--geo-answer-crawler-origin':
        args.geoAnswerCrawlerOrigin = requireOptionValue('--geo-answer-crawler-origin', argv[++i]);
        break;
      case '--geo-answer-crawler-matches-csv':
        args.geoAnswerCrawlerMatchesCsv = requireOptionValue(
          '--geo-answer-crawler-matches-csv',
          argv[++i]
        );
        break;
      case '--geo-answer-owned-domain': {
        const domain = requireOptionValue('--geo-answer-owned-domain', argv[++i]);
        args.geoAnswerOwnedDomains = [...(args.geoAnswerOwnedDomains ?? []), domain];
        break;
      }
      case '--geo-crawler-origin':
        args.geoCrawlerOrigin = requireOptionValue('--geo-crawler-origin', argv[++i]);
        break;
      case '--geo-robots-txt':
        args.geoRobotsTxt = requireOptionValue('--geo-robots-txt', argv[++i]);
        break;
      case '--geo-robots-baseline-txt':
        args.geoRobotsBaselineTxt = requireOptionValue('--geo-robots-baseline-txt', argv[++i]);
        break;
      case '--geo-robots-origin':
        args.geoRobotsOrigin = requireOptionValue('--geo-robots-origin', argv[++i]);
        break;
      case '--geo-robots-sitemap':
        args.geoRobotsSitemap = requireOptionValue('--geo-robots-sitemap', argv[++i]);
        break;
      case '--geo-robots-token': {
        const token = requireOptionValue('--geo-robots-token', argv[++i]);
        args.geoRobotsTokens = [...(args.geoRobotsTokens ?? []), token];
        break;
      }
      case '--fail-on-findings':
        args.failOnFindings = true;
        break;
      case '--fail-on-newly-blocked-geo-paths':
        args.failOnNewlyBlockedGeoPaths = true;
        break;
      case '--fail-on-newly-blocked-geo-audit-pages':
        args.failOnNewlyBlockedGeoAuditPages = true;
        break;
      case '--fail-on-newly-blocked-geo-targets':
        args.failOnNewlyBlockedGeoTargets = true;
        break;
      case '--fail-on-new-geo-crawler-failures':
        args.failOnNewGeoCrawlerFailures = true;
        break;
      case '--fail-on-new-ai-referral-failures':
        args.failOnNewAiReferralFailures = true;
        break;
      case '--fail-on-ai-crawler-timing-regression':
        args.failOnAiCrawlerTimingRegression = true;
        break;
      case '--fail-on-geo-crawler-path-family-failure-rise': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-crawler-path-family-failure-rise requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoCrawlerPathFamilyFailureRise = threshold;
        break;
      }
      case '--fail-on-ai-crawler-cloudfront-result-regression':
        args.failOnAiCrawlerCloudFrontResultRegression = true;
        break;
      case '--fail-on-geo-answer-owned-citation-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-citation-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedCitationDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-owned-source-share-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-source-share-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedSourceShareDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-owned-source-share-drop-lower-ci': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-source-share-drop-lower-ci requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedSourceShareDropLowerCi = threshold;
        break;
      }
      case '--fail-on-geo-answer-owned-source-share-sign-test-alpha': {
        const rawAlpha = argv[++i];
        const alpha =
          rawAlpha === undefined || rawAlpha.trim() === '' ? Number.NaN : Number(rawAlpha);
        if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-source-share-sign-test-alpha requires an alpha from 0 to 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedSourceShareSignTestAlpha = alpha;
        break;
      }
      case '--fail-on-geo-answer-owned-source-share-min-prompts': {
        const rawMinimum = argv[++i];
        const minimum =
          rawMinimum === undefined || rawMinimum.trim() === '' ? Number.NaN : Number(rawMinimum);
        if (!Number.isSafeInteger(minimum) || minimum < 2 || minimum > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-source-share-min-prompts requires an integer from 2 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedSourceShareMinPrompts = minimum;
        break;
      }
      case '--fail-on-geo-answer-owned-reach-bound-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-reach-bound-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedReachBoundDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-incomplete-list-share': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-incomplete-list-share requires a percentage threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerIncompleteListShare = threshold;
        break;
      }
      case '--fail-on-geo-answer-incomplete-list-share-rise': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-incomplete-list-share-rise requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerIncompleteListShareRise = threshold;
        break;
      }
      case '--fail-on-geo-answer-unknown-owned-observation-share': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-unknown-owned-observation-share requires a percentage threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerUnknownOwnedObservationShare = threshold;
        break;
      }
      case '--fail-on-geo-answer-unknown-owned-prompt-share': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-unknown-owned-prompt-share requires a percentage threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerUnknownOwnedPromptShare = threshold;
        break;
      }
      case '--fail-on-geo-answer-unknown-owned-state-share-rise': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-unknown-owned-state-share-rise requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerUnknownOwnedStateShareRise = threshold;
        break;
      }
      case '--fail-on-geo-answer-provider-balanced-citation-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-provider-balanced-citation-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerProviderBalancedCitationDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-owned-prompt-coverage-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-prompt-coverage-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedPromptCoverageDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-cohort-owned-prompt-coverage-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-owned-prompt-coverage-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortOwnedPromptCoverageDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-cohort-owned-mrr-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-owned-mrr-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortOwnedMrrDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-cohort-owned-mrr-min-prompts': {
        const rawCount = argv[++i];
        const count =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(count) || count < 1 || count > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-owned-mrr-min-prompts requires a whole number from 1 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortOwnedMrrMinPrompts = count;
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-owned-mrr-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-monthly-owned-mrr-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortMonthlyOwnedMrrDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-owned-mrr-min-prompts': {
        const rawCount = argv[++i];
        const count =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(count) || count < 1 || count > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-monthly-owned-mrr-min-prompts requires a whole number from 1 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortMonthlyOwnedMrrMinPrompts = count;
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-paired-mrr-drop':
      case '--fail-on-geo-answer-cohort-monthly-paired-mrr-drop-lower-ci': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            `❌ ${argv[i - 1]} requires a percentage-point threshold from 0 to 100.\n`
          );
          process.exit(2);
        }
        if (argv[i - 1] === '--fail-on-geo-answer-cohort-monthly-paired-mrr-drop-lower-ci') {
          args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi = threshold;
        } else {
          args.failOnGeoAnswerCohortMonthlyPairedMrrDrop = threshold;
        }
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-paired-mrr-min-matched-prompts': {
        const rawCount = argv[++i];
        const count =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(count) || count < 1 || count > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-monthly-paired-mrr-min-matched-prompts requires a whole number from 1 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortMonthlyPairedMrrMinMatchedPrompts = count;
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop':
      case '--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop-lower-ci': {
        const option = argv[i];
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            `❌ ${option} requires a percentage-point threshold from 0 to 100.\n`
          );
          process.exit(2);
        }
        if (option === '--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop-lower-ci') {
          args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi = threshold;
        } else {
          args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop = threshold;
        }
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-decline': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-decline requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline = threshold;
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-alpha': {
        const rawAlpha = argv[++i];
        const alpha =
          rawAlpha === undefined || rawAlpha.trim() === '' ? Number.NaN : Number(rawAlpha);
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-alpha requires a p-value threshold greater than 0 and at most 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmAlpha = alpha;
        break;
      }
      case '--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-min-matched-prompts': {
        const rawCount = argv[++i];
        const count =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(count) || count < 1 || count > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-min-matched-prompts requires a whole number from 1 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageMinMatchedPrompts = count;
        break;
      }
      case '--fail-on-geo-answer-owned-first-position-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-first-position-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedFirstPositionDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-owned-top-three-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-top-three-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedTopThreeDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-owned-prompt-balanced-first-position-drop':
      case '--fail-on-geo-answer-owned-prompt-balanced-first-position-drop-lower-ci':
      case '--fail-on-geo-answer-owned-prompt-balanced-top-three-drop':
      case '--fail-on-geo-answer-owned-prompt-balanced-top-three-drop-lower-ci':
      case '--fail-on-geo-answer-owned-prompt-balanced-mrr-drop':
      case '--fail-on-geo-answer-owned-prompt-balanced-mrr-drop-lower-ci': {
        const option = argv[i]!;
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            `❌ ${option} requires a percentage-point threshold from 0 to 100.\n`
          );
          process.exit(2);
        }
        if (option.endsWith('first-position-drop'))
          args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDrop = threshold;
        else if (option.endsWith('first-position-drop-lower-ci'))
          args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi = threshold;
        else if (option.endsWith('top-three-drop'))
          args.failOnGeoAnswerOwnedPromptBalancedTopThreeDrop = threshold;
        else if (option.endsWith('top-three-drop-lower-ci'))
          args.failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi = threshold;
        else if (option.endsWith('mrr-drop'))
          args.failOnGeoAnswerOwnedPromptBalancedMrrDrop = threshold;
        else args.failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi = threshold;
        break;
      }
      case '--fail-on-geo-answer-owned-prompt-balanced-rank-min-matched-prompts': {
        const rawCount = argv[++i];
        const count =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(count) || count < 2 || count > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-owned-prompt-balanced-rank-min-matched-prompts requires a whole number from 2 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerOwnedPromptBalancedRankMinMatchedPrompts = count;
        break;
      }
      case '--fail-on-geo-answer-length-owned-top-three-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-length-owned-top-three-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerLengthOwnedTopThreeDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-length-owned-top-three-drop-lower-ci': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-length-owned-top-three-drop-lower-ci requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi = threshold;
        break;
      }
      case '--fail-on-geo-answer-length-owned-first-position-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-length-owned-first-position-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerLengthOwnedFirstPositionDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-length-owned-first-position-drop-lower-ci': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-length-owned-first-position-drop-lower-ci requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi = threshold;
        break;
      }
      case '--fail-on-geo-answer-length-owned-mrr-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-length-owned-mrr-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerLengthOwnedMrrDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-length-owned-mrr-drop-lower-ci': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-length-owned-mrr-drop-lower-ci requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerLengthOwnedMrrDropLowerCi = threshold;
        break;
      }
      case '--fail-on-geo-answer-length-owned-rank-min-matched-prompts': {
        const rawCount = argv[++i];
        const count =
          rawCount === undefined || rawCount.trim() === '' ? Number.NaN : Number(rawCount);
        if (!Number.isInteger(count) || count < 2 || count > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-length-owned-rank-min-matched-prompts requires a whole number from 2 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerLengthOwnedRankMinMatchedPrompts = count;
        break;
      }
      case '--fail-on-geo-answer-entity-mention-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-mention-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityMentionDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-owned-top-three-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-owned-top-three-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityOwnedTopThreeDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-path-family-coverage-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-path-family-coverage-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPathFamilyCoverageDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-path-family-prompt-coverage-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-path-family-prompt-coverage-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPathFamilyPromptCoverageDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-path-family-over-index-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-path-family-over-index-drop requires a relative-drop threshold from 0 to 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerPathFamilyOverIndexDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-path-family-prompt-coverage-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-path-family-prompt-coverage-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityPathFamilyPromptCoverageDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-path-family-top-three-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-path-family-top-three-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityPathFamilyTopThreeDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-citation-page-prompt-coverage-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-citation-page-prompt-coverage-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityCitationPagePromptCoverageDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-citation-page-top-three-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-citation-page-top-three-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityCitationPageTopThreeDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-prompt-mention-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-prompt-mention-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityPromptMentionDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-prompt-balanced-mention-drop': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-prompt-balanced-mention-drop requires a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityPromptBalancedMentionDrop = threshold;
        break;
      }
      case '--fail-on-geo-answer-entity-prompt-min-matched-prompts': {
        const rawMinimum = argv[++i];
        const minimum =
          rawMinimum === undefined || rawMinimum.trim() === '' ? Number.NaN : Number(rawMinimum);
        if (!Number.isInteger(minimum) || minimum < 1 || minimum > 100_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-entity-prompt-min-matched-prompts requires a whole prompt count from 1 to 100000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerEntityPromptMinMatchedPrompts = minimum;
        break;
      }
      case '--fail-on-geo-answer-provider-prompt-overlap-below': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-provider-prompt-overlap-below requires a prompt-set Jaccard threshold from 0 to 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerProviderPromptOverlapBelow = threshold;
        break;
      }
      case '--fail-on-geo-answer-provider-min-prompts': {
        const rawMinimum = argv[++i];
        const minimum =
          rawMinimum === undefined || rawMinimum.trim() === '' ? Number.NaN : Number(rawMinimum);
        if (!Number.isInteger(minimum) || minimum < 1 || minimum > 10_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-provider-min-prompts requires a whole prompt count from 1 to 10000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerProviderMinPrompts = minimum;
        break;
      }
      case '--fail-on-geo-answer-provider-min-matched-prompts': {
        const rawMinimum = argv[++i];
        const minimum =
          rawMinimum === undefined || rawMinimum.trim() === '' ? Number.NaN : Number(rawMinimum);
        if (!Number.isInteger(minimum) || minimum < 1 || minimum > 100_000) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-provider-min-matched-prompts requires a whole prompt count from 1 to 100000.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerProviderMinMatchedPrompts = minimum;
        break;
      }
      case '--fail-on-geo-answer-sample-mix-divergence': {
        const rawThreshold = argv[++i];
        const threshold =
          rawThreshold === undefined || rawThreshold.trim() === ''
            ? Number.NaN
            : Number(rawThreshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-sample-mix-divergence requires a normalized Jensen–Shannon divergence threshold from 0 to 1.\n'
          );
          process.exit(2);
        }
        args.failOnGeoAnswerSampleMixDivergence = threshold;
        break;
      }
      case '--fail-on-geo-answer-cohort-standardized-citation-drop': {
        const value = requireOptionValue(
          '--fail-on-geo-answer-cohort-standardized-citation-drop',
          argv[++i]
        );
        const separator = value.lastIndexOf('=');
        const provider = separator >= 0 ? value.slice(0, separator).trim() : '';
        const rawThreshold = separator >= 0 ? value.slice(separator + 1).trim() : '';
        const threshold = rawThreshold ? Number(rawThreshold) : Number.NaN;
        if (
          !provider ||
          !/^\d+(?:\.\d+)?$/u.test(rawThreshold) ||
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 100
        ) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-standardized-citation-drop requires provider=threshold, with a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        const normalizedProvider = provider
          .normalize('NFKC')
          .replace(/\s+/gu, ' ')
          .trim()
          .toLocaleLowerCase('en-US');
        if (
          (args.failOnGeoAnswerCohortStandardizedCitationDrop ?? []).some(
            (item) =>
              item
                .slice(0, item.lastIndexOf('='))
                .normalize('NFKC')
                .replace(/\s+/gu, ' ')
                .trim()
                .toLocaleLowerCase('en-US') === normalizedProvider
          )
        ) {
          process.stderr.write(
            `❌ Only one standardized citation-drop threshold may be configured for provider ${provider}.\n`
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortStandardizedCitationDrop = [
          ...(args.failOnGeoAnswerCohortStandardizedCitationDrop ?? []),
          `${provider}=${threshold}`,
        ];
        break;
      }
      case '--fail-on-geo-answer-cohort-standardized-owned-prompt-coverage-drop': {
        const value = requireOptionValue(
          '--fail-on-geo-answer-cohort-standardized-owned-prompt-coverage-drop',
          argv[++i]
        );
        const separator = value.lastIndexOf('=');
        const provider = separator >= 0 ? value.slice(0, separator).trim() : '';
        const rawThreshold = separator >= 0 ? value.slice(separator + 1).trim() : '';
        const threshold = rawThreshold ? Number(rawThreshold) : Number.NaN;
        if (
          !provider ||
          !/^\d+(?:\.\d+)?$/u.test(rawThreshold) ||
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 100
        ) {
          process.stderr.write(
            '❌ --fail-on-geo-answer-cohort-standardized-owned-prompt-coverage-drop requires provider=threshold, with a percentage-point threshold from 0 to 100.\n'
          );
          process.exit(2);
        }
        const normalizedProvider = provider
          .normalize('NFKC')
          .replace(/\s+/gu, ' ')
          .trim()
          .toLocaleLowerCase('en-US');
        if (
          (args.failOnGeoAnswerCohortStandardizedOwnedPromptCoverageDrop ?? []).some(
            (item) =>
              item
                .slice(0, item.lastIndexOf('='))
                .normalize('NFKC')
                .replace(/\s+/gu, ' ')
                .trim()
                .toLocaleLowerCase('en-US') === normalizedProvider
          )
        ) {
          process.stderr.write(
            `❌ Only one standardized owned-prompt threshold may be configured for provider ${provider}.\n`
          );
          process.exit(2);
        }
        args.failOnGeoAnswerCohortStandardizedOwnedPromptCoverageDrop = [
          ...(args.failOnGeoAnswerCohortStandardizedOwnedPromptCoverageDrop ?? []),
          `${provider}=${threshold}`,
        ];
        break;
      }
      case '--fail-on-duplicate-metadata':
        args.failOnDuplicateMetadata = true;
        break;
      case '--fail-on-duplicate-content':
        args.failOnDuplicateContent = true;
        break;
      case '--fail-on-hreflang':
        args.failOnHreflang = true;
        break;
      case '--fail-on-canonical-chains':
        args.failOnCanonicalChains = true;
        break;
      case '--fail-below-score': {
        const rawScore = argv[++i];
        const score =
          rawScore === undefined || rawScore.trim() === '' ? Number.NaN : Number(rawScore);
        if (!Number.isFinite(score) || score < 0 || score > 100) {
          process.stderr.write('❌ --fail-below-score requires a number from 0 to 100.\n');
          process.exit(2);
        }
        args.failBelowScore = score;
        break;
      }
      case '--baseline':
        args.baseline = requireOptionValue('--baseline', argv[++i]);
        break;
      case '--comparison-output':
        args.comparisonOutput = requireOptionValue('--comparison-output', argv[++i]);
        break;
      case '--geo-comparison-csv':
        args.geoComparisonCsv = requireOptionValue('--geo-comparison-csv', argv[++i]);
        break;
      case '--geo-gate-output':
        args.geoGateOutput = requireOptionValue('--geo-gate-output', argv[++i]);
        break;
      case '--geo-summary-output':
        args.geoSummaryOutput = requireOptionValue('--geo-summary-output', argv[++i]);
        break;
      case '--geo-summary-csv':
        args.geoSummaryCsv = requireOptionValue('--geo-summary-csv', argv[++i]);
        break;
      case '--geo-entity-variants-csv':
        args.geoEntityVariantsCsv = requireOptionValue('--geo-entity-variants-csv', argv[++i]);
        break;
      case '--geo-crawler-access-csv':
        args.geoCrawlerAccessCsv = requireOptionValue('--geo-crawler-access-csv', argv[++i]);
        break;
      case '--fail-on-regression':
        args.failOnRegression = true;
        break;
      case '--fail-on-geo-change':
        args.failOnGeoChange = true;
        break;
      case '--fail-on-geo-change-signal': {
        const signal = requireOptionValue('--fail-on-geo-change-signal', argv[++i]).trim();
        if (!signal) {
          process.stderr.write(
            '❌ --fail-on-geo-change-signal requires a non-empty exact signal label.\n'
          );
          process.exit(2);
        }
        args.failOnGeoChangeSignals = [...(args.failOnGeoChangeSignals ?? []), signal];
        break;
      }
      case '--fail-on-geo-change-url': {
        const url = requireOptionValue('--fail-on-geo-change-url', argv[++i]).trim();
        if (!url) {
          process.stderr.write('❌ --fail-on-geo-change-url requires a non-empty exact URL.\n');
          process.exit(2);
        }
        args.failOnGeoChangeUrls = [...(args.failOnGeoChangeUrls ?? []), url];
        break;
      }
      case '--fail-on-geo-change-transition': {
        const transition = requireOptionValue('--fail-on-geo-change-transition', argv[++i]);
        const separator = transition.indexOf('=>');
        const before = separator < 0 ? '' : transition.slice(0, separator).trim();
        const after = separator < 0 ? '' : transition.slice(separator + 2).trim();
        if (!before || !after) {
          process.stderr.write(
            '❌ --fail-on-geo-change-transition requires an exact <before=>after> value.\n'
          );
          process.exit(2);
        }
        args.failOnGeoChangeTransitions = [
          ...(args.failOnGeoChangeTransitions ?? []),
          { before, after },
        ];
        break;
      }
      case '--category': {
        const rawCategory = requireOptionValue('--category', argv[++i]);
        const categories = rawCategory
          .split(',')
          .map((category) => category.trim())
          .filter(Boolean);
        if (categories.length === 0) {
          process.stderr.write('❌ --category requires one or more category keys.\n');
          process.exit(2);
        }
        args.categories = [...(args.categories ?? []), ...categories];
        break;
      }
      case '--headed':
        args.headless = false;
        break;
      case '--viewport':
        args.viewport = requireOptionValue('--viewport', argv[++i]);
        break;
      case '-c':
      case '--config':
        args.config = requireOptionValue(arg, argv[++i]);
        break;
      case '-p':
      case '--preset':
        args.preset = requireOptionValue(arg, argv[++i]);
        break;
      case '--init-config':
        args.initConfig = true;
        break;
      case '--doctor':
        args.doctor = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '-v':
      case '--verbose':
        args.verbose = true;
        break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`❌ Unknown option: ${arg}\n`);
          process.exit(2);
        }
        if (!arg.startsWith('-')) {
          process.stderr.write(`❌ Error: Positional URL arguments are no longer supported.\n`);
          process.stderr.write(`   Please use the -u or --url flag to specify the URL, e.g.:\n`);
          process.stderr.write(`     aviary -u ${arg}\n`);
          process.stderr.write(
            `\n   Or run "aviary" with no arguments to launch the interactive Terminal User Interface (TUI).\n`
          );
          process.exit(1);
        }
    }
  }

  return args;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const AI_CRAWLER_ACTIVITIES = new Set([
  'search-crawl',
  'user-initiated-fetch',
  'training-data-crawl',
  'data-use-crawl',
  'unclassified',
]);

function isAiCrawlerAccessLogAnalysis(value: unknown): value is AiCrawlerAccessLogAnalysis {
  if (
    !isRecord(value) ||
    value.source !== 'Aviary AI crawler access log analysis' ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.crawlers) ||
    value.crawlers.length > 100
  )
    return false;
  return value.crawlers.every((crawler) => {
    if (
      !isRecord(crawler) ||
      typeof crawler.token !== 'string' ||
      crawler.token.length > 100 ||
      typeof crawler.provider !== 'string' ||
      crawler.provider.length > 100 ||
      typeof crawler.activity !== 'string' ||
      !AI_CRAWLER_ACTIVITIES.has(crawler.activity) ||
      typeof crawler.pathsTruncated !== 'boolean' ||
      !Array.isArray(crawler.paths) ||
      crawler.paths.length > 200
    )
      return false;
    return crawler.paths.every((pathEntry) => {
      if (
        !isRecord(pathEntry) ||
        typeof pathEntry.path !== 'string' ||
        pathEntry.path.length > 10_000
      )
        return false;
      for (const key of [
        'requests',
        'successfulResponses',
        'redirects',
        'clientErrors',
        'serverErrors',
      ]) {
        const metric = pathEntry[key];
        if (typeof metric !== 'number' || !Number.isSafeInteger(metric) || metric < 0) return false;
      }
      const daysBeforeLatestRequest = pathEntry.daysBeforeLatestRequest;
      return (
        (pathEntry.firstSeenAt === undefined || typeof pathEntry.firstSeenAt === 'string') &&
        (pathEntry.lastSeenAt === undefined || typeof pathEntry.lastSeenAt === 'string') &&
        (daysBeforeLatestRequest === undefined ||
          (typeof daysBeforeLatestRequest === 'number' &&
            Number.isInteger(daysBeforeLatestRequest) &&
            daysBeforeLatestRequest >= 0))
      );
    });
  });
}

function readAiCrawlerAccessLogAnalyses(value: unknown): AiCrawlerAccessLogAnalysis[] | undefined {
  if (
    !isRecord(value) ||
    value.source !== 'Aviary AI crawler access log analysis' ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.analyses) ||
    value.analyses.length < 1 ||
    value.analyses.length > 100 ||
    !value.analyses.every(isAiCrawlerAccessLogAnalysis)
  )
    return undefined;
  return value.analyses;
}

function isSiteWideGeoAnalysis(value: unknown): value is SiteWideGeoAnalysis {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.auditTimestamp !== 'string' ||
    !Array.isArray(value.pageSummaries)
  ) {
    return false;
  }
  const signalNames = [
    'searchCrawlerAccess',
    'dataUseCrawlerPolicy',
    'userInitiatedFetchAccess',
    'previewControls',
    'answerContent',
    'sourceRenderedContent',
    'citationEvidence',
    'optionalLlmsFiles',
  ] as const;
  const validCrawlerRows = (rows: unknown): boolean =>
    Array.isArray(rows) &&
    hasUniqueTokens(rows) &&
    rows.every((crawler) => {
      if (
        !isRecord(crawler) ||
        typeof crawler.token !== 'string' ||
        typeof crawler.allowed !== 'boolean'
      )
        return false;
      if (
        crawler.matchedAgents !== undefined &&
        (!Array.isArray(crawler.matchedAgents) ||
          !crawler.matchedAgents.every((agent) => typeof agent === 'string'))
      )
        return false;
      if (crawler.matchedRule !== undefined) {
        const rule = crawler.matchedRule;
        if (
          !isRecord(rule) ||
          (rule.directive !== 'allow' && rule.directive !== 'disallow') ||
          typeof rule.pattern !== 'string' ||
          !Number.isInteger(rule.line)
        )
          return false;
      }
      return true;
    });
  const hasUniqueTokens = (rows: unknown): boolean => {
    if (!Array.isArray(rows)) return false;
    const seen = new Set<string>();
    for (const row of rows) {
      if (
        !isRecord(row) ||
        typeof row.token !== 'string' ||
        !row.token.trim() ||
        row.token !== row.token.trim()
      )
        return false;
      const token = row.token.trim().toLowerCase();
      if (seen.has(token)) return false;
      seen.add(token);
    }
    return true;
  };
  const hasUniqueLlmsPaths = (files: unknown): boolean => {
    if (!Array.isArray(files)) return false;
    const seen = new Set<string>();
    for (const file of files) {
      if (
        !isRecord(file) ||
        typeof file.path !== 'string' ||
        !file.path.trim() ||
        file.path !== file.path.trim()
      )
        return false;
      if (seen.has(file.path)) return false;
      seen.add(file.path);
    }
    return true;
  };
  const validLlmsLinkTargetProfile = (profile: unknown): boolean => {
    if (!isRecord(profile)) return false;
    const fields = [
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
    return fields.every(
      (field) =>
        typeof profile[field] === 'number' &&
        Number.isInteger(profile[field]) &&
        (profile[field] as number) >= 0
    );
  };
  return value.pageSummaries.every((page) => {
    if (!isRecord(page) || typeof page.url !== 'string' || typeof page.geoAssessed !== 'boolean')
      return false;
    const coverage = page.signalCoverage;
    if (!isRecord(coverage)) return false;
    if (page.canonicalUrl !== undefined && typeof page.canonicalUrl !== 'string') return false;
    if (
      !signalNames.every((signal) =>
        ['measured', 'not-assessed', 'not-run'].includes(String(coverage[signal]))
      )
    )
      return false;
    if (
      page.signalNotes !== undefined &&
      (!isRecord(page.signalNotes) ||
        !Object.values(page.signalNotes).every((note) => typeof note === 'string'))
    )
      return false;
    if (page.searchCrawlerAccess !== undefined && !validCrawlerRows(page.searchCrawlerAccess))
      return false;
    if (page.dataUseCrawlerPolicy !== undefined && !validCrawlerRows(page.dataUseCrawlerPolicy))
      return false;
    if (
      page.userInitiatedFetchAccess !== undefined &&
      !validCrawlerRows(page.userInitiatedFetchAccess)
    )
      return false;
    if (page.previewControls !== undefined) {
      if (!isRecord(page.previewControls)) return false;
      const preview = page.previewControls;
      const nonNegativeIntegerFields = [
        'responseStatus',
        'dataNoSnippetElements',
        'dataNoSnippetWords',
        'visibleTextWords',
      ] as const;
      if (
        nonNegativeIntegerFields.some(
          (field) =>
            preview[field] !== undefined &&
            (typeof preview[field] !== 'number' ||
              !Number.isInteger(preview[field]) ||
              (preview[field] as number) < 0)
        )
      )
        return false;
      if (
        preview.responseStatus !== undefined &&
        (typeof preview.responseStatus !== 'number' ||
          preview.responseStatus < 100 ||
          preview.responseStatus > 599)
      )
        return false;
      if (
        preview.dataNoSnippetWordSharePercent !== undefined &&
        preview.dataNoSnippetWordSharePercent !== null &&
        (typeof preview.dataNoSnippetWordSharePercent !== 'number' ||
          !Number.isFinite(preview.dataNoSnippetWordSharePercent) ||
          preview.dataNoSnippetWordSharePercent < 0 ||
          preview.dataNoSnippetWordSharePercent > 100)
      )
        return false;
      if (
        typeof preview.visibleTextWords === 'number' &&
        typeof preview.dataNoSnippetWords === 'number' &&
        preview.dataNoSnippetWords > preview.visibleTextWords
      )
        return false;
      if (
        typeof preview.visibleTextWords === 'number' &&
        preview.dataNoSnippetWordSharePercent !== undefined
      ) {
        const share = preview.dataNoSnippetWordSharePercent;
        if (preview.visibleTextWords === 0 ? share !== null : share === null) return false;
        if (
          preview.visibleTextWords > 0 &&
          typeof share === 'number' &&
          typeof preview.dataNoSnippetWords === 'number'
        ) {
          const calculatedShare = Number(
            ((preview.dataNoSnippetWords / preview.visibleTextWords) * 100).toFixed(1)
          );
          if (Math.abs(share - calculatedShare) > 0.051) return false;
        }
      }
      if (
        ['noindex', 'noSnippet', 'maxSnippetZero'].some(
          (field) => preview[field] !== undefined && typeof preview[field] !== 'boolean'
        )
      )
        return false;
      if (
        page.previewControls.crawlerControls !== undefined &&
        (!Array.isArray(page.previewControls.crawlerControls) ||
          !hasUniqueTokens(page.previewControls.crawlerControls) ||
          !page.previewControls.crawlerControls.every(
            (control) =>
              isRecord(control) &&
              typeof control.token === 'string' &&
              typeof control.noindex === 'boolean' &&
              typeof control.noSnippet === 'boolean' &&
              typeof control.maxSnippetZero === 'boolean'
          ))
      )
        return false;
      if (
        page.previewControls.dataUseCrawlerControls !== undefined &&
        (!Array.isArray(page.previewControls.dataUseCrawlerControls) ||
          !hasUniqueTokens(page.previewControls.dataUseCrawlerControls) ||
          !page.previewControls.dataUseCrawlerControls.every(
            (control) =>
              isRecord(control) &&
              typeof control.token === 'string' &&
              typeof control.noArchive === 'boolean' &&
              (control.noindex === undefined || typeof control.noindex === 'boolean')
          ))
      )
        return false;
    }
    if (page.answerContent !== undefined) {
      const answer = page.answerContent;
      if (!isRecord(answer)) return false;
      const nonNegativeIntegerFields = [
        'contentWords',
        'headingCount',
        'questionHeadings',
        'conciseAnswerBlocks',
        'listCount',
        'tableCount',
        'externalContentLinks',
      ] as const;
      if (
        nonNegativeIntegerFields.some(
          (field) =>
            answer[field] !== undefined &&
            (typeof answer[field] !== 'number' ||
              !Number.isInteger(answer[field]) ||
              (answer[field] as number) < 0)
        )
      )
        return false;
      const booleanFields = [
        'mainOrArticleRegion',
        'visibleAuthor',
        'visibleDate',
        'schemaAuthor',
        'schemaDate',
        'schemaDateModifiedDaysTruncated',
        'schemaDateModifiedHasNonDateValue',
        'schemaHasNonBooleanAccessibleForFreeValue',
        'jsonLdTypeListTruncated',
        'identityEntityListTruncated',
        'documentLanguageValid',
      ] as const;
      if (
        booleanFields.some(
          (field) => answer[field] !== undefined && typeof answer[field] !== 'boolean'
        )
      )
        return false;
      if (
        answer.schemaDateModifiedDays !== undefined &&
        (!Array.isArray(answer.schemaDateModifiedDays) ||
          !answer.schemaDateModifiedDays.every(
            (day) =>
              typeof day === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(day) &&
              Number.isFinite(Date.parse(`${day}T00:00:00.000Z`)) &&
              new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day
          ))
      )
        return false;
      if (
        answer.jsonLdTypes !== undefined &&
        (!Array.isArray(answer.jsonLdTypes) ||
          !answer.jsonLdTypes.every((type) => typeof type === 'string'))
      )
        return false;
      if (
        answer.schemaIsAccessibleForFree !== undefined &&
        ![true, false, 'mixed', 'not-declared'].includes(
          answer.schemaIsAccessibleForFree as boolean | string
        )
      )
        return false;
      if (answer.documentLanguage !== undefined && typeof answer.documentLanguage !== 'string')
        return false;
      if (
        answer.identityEntities !== undefined &&
        (!Array.isArray(answer.identityEntities) ||
          !answer.identityEntities.every(
            (entity) =>
              isRecord(entity) &&
              Array.isArray(entity.types) &&
              entity.types.every((type) => typeof type === 'string') &&
              (entity.id === undefined || typeof entity.id === 'string') &&
              (entity.name === undefined || typeof entity.name === 'string') &&
              Array.isArray(entity.sameAs) &&
              entity.sameAs.every((url) => typeof url === 'string') &&
              typeof entity.sameAsTruncated === 'boolean'
          ))
      )
        return false;
    }
    if (page.sourceRenderedContent !== undefined) {
      const rendered = page.sourceRenderedContent;
      if (!isRecord(rendered) || typeof rendered.assessed !== 'boolean') return false;
      if (rendered.reason !== undefined && typeof rendered.reason !== 'string') return false;
      const nonNegativeIntegerFields = [
        'sourceWordCount',
        'renderedWordCount',
        'sourcePhraseCount',
        'renderedPhraseCount',
        'sharedRenderedPhraseCount',
        'renderedOnlyPhraseCount',
      ] as const;
      if (
        nonNegativeIntegerFields.some(
          (field) =>
            rendered[field] !== undefined &&
            (typeof rendered[field] !== 'number' ||
              !Number.isInteger(rendered[field]) ||
              (rendered[field] as number) < 0)
        )
      )
        return false;
      if (rendered.sampleTruncated !== undefined && typeof rendered.sampleTruncated !== 'boolean')
        return false;
      const coverage = rendered.renderedPhraseCoveragePercent;
      if (
        coverage !== undefined &&
        coverage !== null &&
        (typeof coverage !== 'number' ||
          !Number.isFinite(coverage) ||
          coverage < 0 ||
          coverage > 100)
      )
        return false;
    }
    if (
      page.optionalLlmsFiles !== undefined &&
      (!Array.isArray(page.optionalLlmsFiles) ||
        !hasUniqueLlmsPaths(page.optionalLlmsFiles) ||
        !page.optionalLlmsFiles.every(
          (file) =>
            isRecord(file) &&
            typeof file.path === 'string' &&
            ['found', 'absent', 'unconfirmed', 'unassessed'].includes(String(file.state)) &&
            (file.status === undefined ||
              (typeof file.status === 'number' &&
                Number.isInteger(file.status) &&
                file.status >= 100 &&
                file.status <= 599)) &&
            (file.contentTruncated === undefined || typeof file.contentTruncated === 'boolean') &&
            (file.linkTargetProfile === undefined ||
              validLlmsLinkTargetProfile(file.linkTargetProfile))
        ))
    )
      return false;
    if (page.citationEvidence !== undefined) {
      const evidence = page.citationEvidence;
      if (!isRecord(evidence)) return false;
      const countFields = [
        'externalSourceLinkCount',
        'uniqueSourceHosts',
        'descriptiveSourceLinkCount',
        'referenceSectionCount',
        'referenceSectionLinkCount',
        'inlineCitationMarkerCount',
        'resolvedInlineCitationTargetsWithExternalLinks',
        'resolvedInlineCitationTargetsWithoutExternalLinks',
        'unresolvedInlineCitationTargetCount',
        'jsonLdBlocksWithCitationField',
      ] as const;
      if (
        countFields.some(
          (field) =>
            evidence[field] !== undefined &&
            (typeof evidence[field] !== 'number' ||
              !Number.isInteger(evidence[field]) ||
              (evidence[field] as number) < 0)
        )
      )
        return false;
      const booleanFields = [
        'sourceHostListTruncated',
        'sourceHostLinkCountsTruncated',
        'unresolvedInlineCitationTargetsTruncated',
      ] as const;
      if (
        booleanFields.some(
          (field) => evidence[field] !== undefined && typeof evidence[field] !== 'boolean'
        )
      )
        return false;
      const share = evidence.topSourceHostLinkSharePercent;
      if (
        share !== undefined &&
        share !== null &&
        (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 100)
      )
        return false;
      if (
        evidence.sourceHosts !== undefined &&
        (!Array.isArray(evidence.sourceHosts) ||
          !evidence.sourceHosts.every((host) => typeof host === 'string'))
      )
        return false;
      if (
        evidence.unresolvedInlineCitationTargets !== undefined &&
        (!Array.isArray(evidence.unresolvedInlineCitationTargets) ||
          !evidence.unresolvedInlineCitationTargets.every((target) => typeof target === 'string'))
      )
        return false;
      if (
        evidence.sourceHostLinkCounts !== undefined &&
        (!Array.isArray(evidence.sourceHostLinkCounts) ||
          !evidence.sourceHostLinkCounts.every(
            (entry) =>
              isRecord(entry) &&
              typeof entry.host === 'string' &&
              typeof entry.links === 'number' &&
              Number.isInteger(entry.links) &&
              entry.links >= 0
          ))
      )
        return false;
    }
    return true;
  });
}

function isSEOReport(value: unknown): value is SEOReport {
  const parsed = value;
  if (!isRecord(parsed)) {
    return false;
  }

  const checksByCategory = parsed.checks;
  const summary = parsed.summary;
  const knownCategories = new Set<string>(CHECKER_REGISTRY.map(({ key }) => key));
  if (
    typeof parsed.url !== 'string' ||
    typeof parsed.timestamp !== 'string' ||
    !isRecord(checksByCategory) ||
    !isRecord(summary) ||
    !(
      parsed.score === null ||
      (typeof parsed.score === 'number' &&
        Number.isFinite(parsed.score) &&
        parsed.score >= 0 &&
        parsed.score <= 100)
    ) ||
    Object.keys(checksByCategory).some((key) => !knownCategories.has(key)) ||
    (parsed.categories !== undefined &&
      (!Array.isArray(parsed.categories) ||
        parsed.categories.some(
          (category) => typeof category !== 'string' || !knownCategories.has(category)
        ) ||
        new Set(parsed.categories).size !== parsed.categories.length))
  ) {
    return false;
  }

  const total = summary.total;
  const passed = summary.passed;
  const failed = summary.failed;
  const categories = parsed.categories as string[] | undefined;
  const validCount = (count: unknown): count is number =>
    typeof count === 'number' && Number.isInteger(count) && count >= 0;
  if (
    !validCount(total) ||
    !validCount(passed) ||
    !validCount(failed) ||
    total !== passed + failed
  ) {
    return false;
  }

  let observedPassed = 0;
  let observedFailed = 0;
  const allChecks: SEOCheckResult[] = [];
  for (const { key } of CHECKER_REGISTRY) {
    const checks = checksByCategory[key];
    if (!Array.isArray(checks)) return false;
    if (categories && !categories.includes(key) && checks.length > 0) return false;
    for (const check of checks) {
      if (
        !isRecord(check) ||
        typeof check.passed !== 'boolean' ||
        typeof check.message !== 'string' ||
        (check.name !== undefined && typeof check.name !== 'string') ||
        (check.severity !== undefined &&
          check.severity !== 'error' &&
          check.severity !== 'warning' &&
          check.severity !== 'info') ||
        (check.details !== undefined && !isRecord(check.details))
      ) {
        return false;
      }
      if (check.passed) observedPassed += 1;
      else observedFailed += 1;
      allChecks.push(check as unknown as SEOCheckResult);
    }
  }

  return (
    total === observedPassed + observedFailed &&
    passed === observedPassed &&
    failed === observedFailed &&
    parsed.score === calculateWeightedScore(allChecks)
  );
}

function loadBaselineReport(filePath: string): SEOReport {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!isSEOReport(parsed)) {
    throw new Error('The file is not a valid Aviary JSON report.');
  }
  return parsed;
}

function loadBaselineBatchReport(filePath: string): SEOAuditBatchReport {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!isSEOAuditBatchReport(parsed)) {
    throw new Error('The file is not a valid Aviary batch JSON report.');
  }
  return parsed;
}

function isSEOAuditBatchReport(value: unknown): value is SEOAuditBatchReport {
  if (
    !isRecord(value) ||
    typeof value.timestamp !== 'string' ||
    !isRecord(value.summary) ||
    !Array.isArray(value.results)
  ) {
    return false;
  }

  const summary = value.summary;
  const validCount = (count: unknown): count is number =>
    typeof count === 'number' && Number.isInteger(count) && count >= 0;
  if (
    !validCount(summary.requestedUrls) ||
    (summary.concurrency !== undefined &&
      (!validCount(summary.concurrency) || summary.concurrency > 8)) ||
    !validCount(summary.completedUrls) ||
    !validCount(summary.failedUrls) ||
    !validCount(summary.passedChecks) ||
    !validCount(summary.failedChecks) ||
    !(
      summary.averageScore === null ||
      (typeof summary.averageScore === 'number' &&
        Number.isInteger(summary.averageScore) &&
        summary.averageScore >= 0 &&
        summary.averageScore <= 100)
    )
  ) {
    return false;
  }
  if (summary.concurrency === 0 && summary.completedUrls !== 0) return false;

  let completedUrls = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  const scores: number[] = [];
  for (const result of value.results) {
    if (!isRecord(result) || typeof result.url !== 'string') return false;
    if (result.status === 'error') {
      if (typeof result.error !== 'string') return false;
      continue;
    }
    if (
      result.status !== 'complete' ||
      !isSEOReport(result.report) ||
      result.report.url !== result.url
    )
      return false;
    completedUrls += 1;
    passedChecks += result.report.summary.passed;
    failedChecks += result.report.summary.failed;
    if (result.report.score !== null) scores.push(result.report.score);
  }

  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
      : null;
  return (
    summary.requestedUrls === value.results.length &&
    summary.completedUrls === completedUrls &&
    summary.failedUrls === value.results.length - completedUrls &&
    summary.passedChecks === passedChecks &&
    summary.failedChecks === failedChecks &&
    summary.averageScore === averageScore
  );
}

function extractGeoAuditUrls(value: unknown): {
  urls: string[];
  auditTimestamp?: string;
  unavailablePages: number;
} {
  if (isSiteWideGeoAnalysis(value)) {
    return {
      urls: value.pageSummaries.map(({ url }) => url),
      auditTimestamp: value.auditTimestamp,
      unavailablePages: 0,
    };
  }
  if (isSEOAuditBatchReport(value)) {
    return {
      urls: value.results.flatMap((result) =>
        result.status === 'complete' ? [result.report.url] : []
      ),
      auditTimestamp: value.timestamp,
      unavailablePages: value.summary.failedUrls,
    };
  }
  if (isSEOReport(value)) {
    return { urls: [value.url], auditTimestamp: value.timestamp, unavailablePages: 0 };
  }
  throw new Error(
    'Audit JSON must contain one SEO report, an SEO batch report, or a version 1 sitewide GEO summary.'
  );
}

function printHelp() {
  process.stderr.write(`
aviary - End-to-end SEO checker tool

Usage: aviary -u <url> [options]
       aviary --urls <file-or-glob> [--concurrency <1-8>] [--watch <seconds>] [options]
       aviary --sitemap <url> [--max-urls <1-10000>] [batch options]
       aviary --crawl <url> [--max-depth <0-32>] [--max-urls <1-10000>] [--max-crawl-page-bytes <bytes>] [--max-crawl-bytes <bytes>] [batch options]
       aviary --render <report.json> [report output options]
       aviary --history-report <history.jsonl> --html <trend.html>

Options:
  -u, --url <url>        URL to check (required)
  --urls <file-or-glob>  Read up to 10,000 URL lines / 25 MiB from a file or quoted glob; use - for stdin
  --sitemap <url>        Discover same-origin pages from a sitemap or sitemap index
  --crawl <url>          Discover same-origin pages by following HTML links
  --max-urls <n>         Limit sitemap/crawl discovery (default: 1000, max: 10000)
  --max-depth <n>        Limit link-crawl depth from the starting URL (default: 2, max: 32)
  --max-crawl-page-bytes <n> Limit each HTML body fetched for discovery (default: 2 MiB, max: 10 MiB)
  --max-crawl-bytes <n> Limit combined HTML discovery downloads in bytes or KiB/MiB/GiB (default: 100 MiB, max: 1 GiB)
  --concurrency <n>      Maximum concurrent browser audits for batch scans (default: 2, max: 8)
  --watch <seconds>      Repeat --urls/--sitemap/--crawl audits with this idle delay; Ctrl+C stops after the active batch
  --timeout <ms>         Page load timeout in milliseconds (overrides AVIARY_TIMEOUT)
  --wait-until <state>   Navigation readiness: domcontentloaded, load, or networkidle (default: networkidle)
  --settle-ms <ms>       Fixed post-navigation settle delay (default: 1000, range: 0–30000)
  -o, --output <file>    Save JSON report to file
  --comparison-output <file> Save the baseline comparison, including GEO diffs, as JSON
  --geo-comparison-csv <file> Save baseline GEO signal changes as spreadsheet-friendly CSV
  --geo-gate-output <file> Save the GEO gate decision, reasons, coverage, and matched changes as JSON
  --geo-summary-output <file> Save sitewide and per-page GEO signals from a batch audit as JSON
  --geo-summary-csv <file>   Save filterable per-page GEO signals from a batch audit as CSV
  --geo-entity-variants-csv <file> Export cross-page structured entity differences as CSV
  --geo-crawler-access-csv <file> Export per-page, per-crawler policy and preview directives as CSV
  --render <file>        Regenerate reports and batch GEO exports from saved JSON without auditing
  --html <file>          Save a visual HTML report; batch audits and GEO exports get searchable dashboards
  --pdf <file>           Save a print-ready PDF report
  --history <file>       Append compact JSONL history for each audit
  --history-report <file> Read JSONL history and write its URL score timelines with --html
  --junit <file>         Save JUnit XML for CI test dashboards
  --sarif <file>         Save SARIF 2.1.0 findings for compatible issue dashboards
  --markdown <file>      Save a Markdown summary with category results and findings
  --csv <file>           Save spreadsheet-friendly rows for audit or GEO exports and comparisons
  --bing-ai-csv <file>   Analyze a Bing AI Performance CSV export by page, query, topic, intent, and date; repeatable
  --bing-ai-xlsx <file>  Analyze recognized Bing AI Performance tables from an XLSX workbook; repeatable
  --bing-ai-baseline-csv <file> Compare one current Bing page-citations export with a previous export
  --bing-ai-baseline-xlsx <file> Compare one current Bing page export with an XLSX table baseline
  --bing-ai-query-baseline-csv <file> Compare current Bing query-to-page mappings with a baseline export
  --bing-ai-query-baseline-xlsx <file> Compare current Bing query-to-page mappings with an XLSX table baseline
  --bing-ai-topic-baseline-csv <file> Compare Bing topic/intent cohorts and phrase turnover with a baseline
  --bing-ai-topic-baseline-xlsx <file> Compare Bing topic/intent cohorts with an XLSX table baseline
  --google-ai-csv <file> Analyze a Google Search Console generative AI CSV export; repeatable
  --google-ai-xlsx <file> Analyze recognized Google Search Console generative AI tables from XLSX; repeatable
  --google-ai-discover-csv <file> Analyze a Google Discover generative AI CSV export; repeatable
  --google-ai-discover-xlsx <file> Analyze Google Discover generative AI tables from XLSX; repeatable
  --google-ai-baseline-csv <file> Compare one current Google page export with a CSV baseline
  --google-ai-baseline-xlsx <file> Compare one current Google page export with an XLSX table baseline
  --google-ai-dimension-baseline-csv <file> Compare same-surface Search/Discover cohorts with matching CSV dimensions
  --google-ai-dimension-baseline-xlsx <file> Compare same-surface Search/Discover cohorts with matching XLSX dimensions
  --geo-google-ai-citation-concordance-csv <file> Join one Google AI page export to locally observed answer citation URLs
  --geo-google-ai-citation-concordance-html <file> Save a dashboard for the Google AI / answer citation URL join
  --geo-google-ai-citation-concordance-path-family-csv <file> Export GEO citation concordance grouped by URL prefix
  --geo-google-ai-citation-concordance-provider-csv <file> Export cited-page measures by answer provider
  --geo-google-ai-citation-concordance-path-depth <n> Choose URL-prefix depth from 1 to 5 (default 2)
  --geo-google-ai-citation-concordance-path-depth-sweep-csv <file> Export URL-family sensitivity at every depth from 1 to 5
  --geo-google-ai-citation-concordance-baseline-json <file> Compare the current concordance with a saved prior report
  --geo-google-ai-citation-concordance-comparison-csv <file> Export page transitions and measure changes from a prior concordance
  --geo-google-ai-citation-concordance-comparison-json <file> Save comparison totals, sample sizes, warnings, and page transitions
  --geo-google-ai-citation-concordance-comparison-html <file> Save a filterable offline view of period changes and sample coverage
  --geo-google-ai-citation-concordance-provider-comparison-csv <file> Compare retained page/provider citation metrics across periods
  --geo-google-surface-matrix Join Google Search and Discover generative AI page exports by URL
  --geo-google-surface-baseline-json <file> Compare a saved Google Search/Discover matrix with the current matrix
  --geo-google-surface-path-family-csv <file> Save one CSV row per retained Google Search/Discover path family
  --geo-platform-matrix Join Google Search and Bing page exports by URL; optionally bridge unique audit canonicals
  --geo-platform-baseline-json <file> Compare a saved GEO platform matrix with the current matrix
  --geo-sitemap <url>  Compare matrix URLs with one supplied same-origin sitemap or index
  --geo-sitemap-max-urls <n> Maximum sitemap URLs to inspect (1–10,000; default 1,000)
  --geo-path-depth <n> Group GEO matrix URLs by origin and first 1–5 path segments
  --geo-audit-json <file> Correlate exports with a saved audit; add GEO review to Bing query-page groups
  --geo-audit-baseline-json <file> Supply the prior saved sitewide audit for owned-page/provider GEO period comparisons
  --geo-crawler-log <file> Analyze Apache/Nginx, CloudFront, or JSONL logs; major search/AI crawler, failure, timing, and bot evidence; repeatable, gzip supported
  --geo-crawler-path-families-csv <file> Aggregate retained AI-crawler log paths by route family; depth defaults to 2
  --geo-crawler-path-families-json <file> Save the route-family inventory as typed versioned JSON
  --geo-crawler-path-families-html <file> Write an offline, filterable route-family dashboard
  --geo-crawler-path-family-audit-csv <file> Aggregate crawler/audit evidence by route family; requires --geo-audit-json and --geo-crawler-origin
  --geo-crawler-path-family-audit-html <file> Render a filterable offline family-level audit dashboard
  --geo-crawler-path-family-audit-comparison-csv <file> Compare current GEO audit signals on shared exact paths by route family
  --geo-crawler-path-family-audit-comparison-json <file> Save paired path/audit signals as typed versioned JSON
  --geo-crawler-path-family-audit-comparison-html <file> Render shared-path GEO audit changes as a filterable dashboard
  --geo-crawler-path-family-comparison-csv <file> Compare matched baseline/current route-family crawl volume and failures
  --geo-crawler-path-family-comparison-json <file> Save the route-family comparison as typed versioned JSON
  --geo-crawler-path-family-comparison-html <file> Write a filterable offline route-family change dashboard
  --geo-crawler-path-family-failure-gate-json <file> Save the route-family failure gate assessment as versioned JSON
  --geo-crawler-path-depth <1-5> Set the leading path-segment depth for route-family CSV, HTML, audit-correlation, or comparison output
  --fail-on-geo-crawler-path-family-failure-rise <pp> Fail if any sufficiently sampled matched route family's 4xx/5xx share rises above this percentage-point threshold
  --geo-crawler-ip-ranges <file> Compare claimed crawler user agents with locally supplied IPv4/IPv6 CIDR ranges; raw addresses are not retained
  --geo-answer-observations <file> Analyze a local JSON file of manually recorded AI answer prompts and cited URLs
  --geo-answer-baseline-observations <file> Compare matched provider/prompt citation coverage with a previous observation sample
  --geo-answer-comparison-csv <file> Export matched provider/prompt period changes to spreadsheet-safe CSV
  --geo-answer-provider-position-comparison-csv <file> Compare page positions and rank-bucket shares by provider across samples
  --geo-answer-cohort-comparison-csv <file> Export matched and one-period-only topic/intent/provider rows to spreadsheet-safe CSV
  --geo-answer-provider-pairs-csv <file> Compare shared-prompt owned reach, MRR, exact McNemar, and Holm adjustment
  --geo-answer-provider-prompt-overlap-csv <file> Export whole-sample exact-prompt set overlap for every provider pair, including disjoint pairs
  --geo-answer-provider-prompt-source-overlap-csv <file> Export cited-domain overlap for every same-prompt provider pair
  --geo-answer-sample-mix-csv <file> Export topic/intent sample distribution divergence by provider pair
  --geo-answer-cohort-standardization-csv <file> Compare provider rates standardized to a shared topic/intent cohort mix
  --geo-answer-cohort-period-standardization-csv <file> Compare baseline/current provider rates on a shared topic/intent cohort mix
  --geo-answer-prompt-sampling-plan-csv <file> Plan additional exact prompts to balance provider topic/intent cohorts
  --geo-answer-prompt-sampling-plan-json <file> Save the same typed, budget-aware plan for downstream automation
  --geo-answer-prompt-plan-provider-pairs-csv <file> Export one budget summary row per provider pair
  --geo-answer-execution-context-csv <file> Export citation coverage by recorded model, surface, locale, and topic/intent
  --geo-answer-execution-context-coverage-csv <file> Audit missing and recorded model/surface/locale labels by provider and cohort
  --geo-answer-execution-context-comparison-csv <file> Compare execution-context coverage across baseline/current answer samples
  --geo-answer-execution-context-trends-csv <file> Export monthly execution-context citation coverage and sampled-month changes
  --geo-answer-length-profiles-csv <file> Export citation density, owned rank, and MRR by captured answer length
  --geo-answer-length-comparison-csv <file> Compare answer-length profiles, paired-prompt owned ranks, and within-band versus answer-length-mix changes
  --geo-answer-length-trends-csv <file> Export UTC-month answer-length citation rates, density, and prior-sampled-month changes
  --geo-answer-prompt-plan-min-prompts <n> Raise every planned provider/cohort quota to at least this many unique prompts
  --geo-answer-prompt-plan-owned-reach-margin <pp> Plan owned-domain prompt reach quotas for a worst-case 95% Wilson half-width of 0.5–50 pp
  --geo-answer-prompt-plan-min-jaccard <ratio> Raise paired follow-up quotas to reach exact-prompt Jaccard of 0.5–0.99 per cohort
  --geo-answer-prompt-plan-max-paired-groups <n> Cap paired follow-up groups per provider pair and distribute them across cohorts
  --geo-answer-prompt-plan-max-total-paired-groups <n> Cap paired prompt groups across all provider pairs; choose even or demand-proportional allocation
  --geo-answer-prompt-plan-total-allocation <mode> Allocate a total cap evenly or in proportion to each pair's required capture groups
  --geo-answer-prompt-plan-cohort-targets <file> Set selected topic/intent quota floors and paired-group ceilings using a versioned JSON target file
  --fail-on-geo-answer-prompt-plan-miss Fail when the planned capture budget cannot meet requested GEO prompt-panel targets
  --geo-answer-stability-csv <file> Export repeated-prompt citation-source stability profiles
  --geo-answer-source-persistence-csv <file> Export cadence-stratified retention with prompt-cluster intervals
  --geo-answer-citation-url-persistence-csv <file> Export exact citation-page retention across prompt timestamps
  --geo-answer-cohort-trends-csv <file> Export monthly provider/topic/intent citation coverage rows
  --geo-answer-audit-signals-csv <file> Export current audited crawl, preview, content, and citation signals by cited-page state
  --geo-answer-audited-owned-page-provider-inventory-csv <file> Cross every audited owned URL with providers and explicit citation absence states
  --geo-answer-audited-owned-page-provider-inventory-html <file> Render a filterable offline view of owned-page/provider audit evidence
  --geo-answer-audited-owned-page-provider-inventory-comparison-csv <file> Compare provider/page citations and audit signals across periods
  --geo-answer-audited-owned-page-provider-inventory-comparison-html <file> Review period transitions in an offline, filterable dashboard
  --geo-answer-audited-owned-page-provider-inventory-comparison-json <file> Save typed page/provider and audit-signal period evidence as JSON
  --geo-answer-audited-owned-pages-csv <file> Join every audited owned URL to captured citation evidence; requires observations, audit, and owned domains
  --geo-answer-audited-owned-page-comparison-csv <file> Compare audited owned-URL citations and placement across baseline/current samples
  --geo-answer-audited-owned-page-providers-csv <file> Export owned audited-page citation position and rank buckets by provider
  --geo-answer-audited-owned-page-provider-comparison-csv <file> Compare owned audited-page citation rank buckets by provider across samples
  --geo-answer-source-category <hostname=category> Group cited hosts in category, source-discovery, and prompt-family reports; requires --geo-answer-observations
  --geo-answer-source-categories-csv <file> Export category shares, source-list ranks, and category concentration
  --geo-answer-source-category-mapping-audit-csv <file> Audit mapped, shadowed, and unmatched citation domains against category host rules
  --geo-answer-source-category-concentration-trends-csv <file> Track monthly mapped-category coverage, HHI, and category-mix JSD versus the prior sampled month
  --geo-answer-source-category-concentration-trends-html <file> View monthly mapped-category concentration, coverage, and mix divergence in an offline dashboard
  --geo-answer-source-category-share-trends-csv <file> Track category-level citation share changes by provider/cohort and sampled month
  --geo-answer-source-category-share-trends-html <file> View per-category monthly citation-share changes in an offline dashboard
  --geo-answer-source-category-monthly-gates-json <file> Save enabled monthly category-gate assessments and support states as versioned JSON
  --fail-on-geo-answer-source-category-monthly-jsd-above <bits> Fail if complete monthly category-mix divergence exceeds 0–1 bit; fail closed on incomplete support
  --fail-on-geo-answer-source-category-monthly-hhi-rise-above <fraction> Fail if mapped-category HHI rises above this 0–1 delta; fail closed on incomplete support
  --fail-on-geo-answer-source-category-monthly-top-three-hhi-rise-above <fraction> Fail if top-three mapped-category HHI rises by more than this delta
  --fail-on-geo-answer-source-category-monthly-hhi-above <fraction> Fail if mapped-category HHI exceeds this 0–1 level in any sampled month
  --fail-on-geo-answer-source-category-monthly-top-three-hhi-above <fraction> Fail if top-three mapped-category HHI exceeds this 0–1 level in any sampled month
  --fail-on-geo-answer-source-category-monthly-min-events <n> Require this many mapped citation events for monthly category gates (default 10)
  --fail-on-geo-answer-source-category-share-drop <pp> Fail on a mapped category share decline above 0–100 percentage points; fail closed on incomplete support
  --fail-on-geo-answer-source-category-prompt-balanced-jsd-lower-ci-above <bits> Fail only if the prompt-cluster 95% lower bound for category-mix JSD exceeds this 0–1 bit threshold
  --fail-on-geo-answer-source-category-prompt-balanced-jsd-min-prompts <n> Require this many comparable exact prompts for the prompt-balanced JSD gate (default 10)
  --geo-answer-source-category-prompt-balanced-jsd-gate-json <file> Save the prompt-balanced category JSD gate decision and interval as versioned JSON
  --geo-answer-source-category-mix-decomposition-csv <file> Separate category-share movement within providers from changes in provider citation mix; requires a baseline and mappings
  --geo-answer-source-category-mix-decomposition-html <file> View category-share and HHI decomposition in an offline dashboard
  --geo-answer-source-category-comparison-csv <file> Compare category shares, rank mixes, and category concentration across samples
  --geo-answer-source-category-prompt-coverage-csv <file> Compare category presence across unique prompts by provider; with owned domains, summarize joint/category-only citations
  --geo-answer-source-category-prompt-details-csv <file> Show prompt/provider category and owned-citation evidence with top-domain cap states
  --geo-answer-source-category-trends-csv <file> Track category presence across sampled provider/topic/intent months
  --geo-answer-source-category-provider-pairs-csv <file> Compare categories across providers on shared exact prompts
  --geo-answer-source-category-cooccurrence-csv <file> Export category co-citation support, lift, conditional presence, and Jaccard by provider
  --geo-answer-source-category-path-families-csv <file> Cross source categories with cited path families by provider; requires mappings and path depth
  --geo-answer-source-category-path-family-comparison-csv <file> Compare category path families across answer samples; requires a baseline, mappings, and path depth
  --geo-answer-citation-positions-csv <file> Export page/domain source-list positions and rank buckets from supplied citation order
  --geo-answer-domain-prompt-coverage-csv <file> Export domain reach across distinct prompts overall and by provider, with nominal intervals
  --geo-answer-source-rarefaction-csv <file> Estimate domain/category discovery, observed-catalog sample targets, next-batch yield, and list uncertainty
  --geo-answer-prompt-family-source-rarefaction-csv <file> Repeat source discovery estimates with lexical prompt families as sampling units
  --geo-answer-prompt-family-source-rarefaction-html <file> Render family-weighted source-discovery curves as a standalone HTML report
  --geo-answer-prompt-family-source-rarefaction-sweep-csv <file> Compare family-weighted source discovery across standard lexical thresholds
  --geo-answer-prompt-family-source-rarefaction-sweep-html <file> Render family-weighted source-discovery curves across standard lexical thresholds
  --geo-answer-provider-prompt-family-source-overlap-csv <file> Compare provider source portfolios within shared lexical prompt families
  --geo-answer-provider-prompt-family-source-overlap-html <file> Render a bounded offline provider source-overlap dashboard
  --geo-answer-provider-prompt-family-source-overlap-sweep-csv <file> Compare family source overlap across standard lexical thresholds
  --geo-answer-provider-prompt-family-source-overlap-sweep-html <file> Plot provider source-divergence sensitivity across lexical thresholds
  --geo-answer-prompt-family-period-comparison-csv <file> Compare provider sources within lexical prompt families across baseline/current samples
  --geo-answer-prompt-family-period-comparison-html <file> Render an offline dashboard of family-level source changes
  --geo-answer-prompt-family-period-comparison-sweep-csv <file> Compare family-level source turnover across standard lexical thresholds
  --geo-answer-prompt-family-period-comparison-sweep-summary-csv <file> Export equal-family divergence means and bootstrap intervals by cutoff
  --geo-answer-prompt-family-period-comparison-sweep-html <file> Visualize longitudinal family source divergence across lexical thresholds
  --geo-answer-source-rarefaction-batch-size <n> Size of the marginal prompt batch (1–1,000; default 10)
  --geo-answer-domain-prompt-coverage-comparison-csv <file> Compare domain prompt reach across baseline/current answer observations
  --geo-answer-prompt-similarity-csv <file> Screen retained exact prompts for high lexical overlap; does not merge prompts
  --geo-answer-prompt-similarity-threshold <0-1> Minimum TF-IDF cosine similarity for the prompt wording screen (default 0.65)
  --geo-answer-prompt-families-csv <file> Group similar prompts, compare family-balanced reach/source/category concentration, and export provider/family evidence
  --geo-answer-prompt-families-html <file> Compare pooled prompt weighting with equal-family reach, source, and mapped-category concentration
  --geo-answer-prompt-family-influence-csv <file> Rank families by leave-one-out source/category concentration and citation reach shifts
  --geo-answer-prompt-family-influence-html <file> Plot signed domain/category concentration and reach influence with family audit details
  --geo-answer-prompt-family-threshold-sweep-csv <file> Show clustering, reach, and mapped-category concentration sensitivity across cutoffs
  --geo-answer-prompt-family-threshold-sweep-html <file> Visualize family topology, provider reach, and mapped-category concentration across cutoffs
  --geo-answer-prompt-family-threshold <0-1> Minimum TF-IDF cosine edge for prompt-family analysis (default 0.85)
  --geo-answer-domain-paired-reach-comparison-csv <file> Compare per-domain citation reach on matched exact prompts with McNemar, bootstrap, and Holm results
  --geo-answer-domain-paired-reach-comparison-json <file> Write the paired domain reach comparison as structured JSON
  --fail-on-geo-answer-domain-paired-reach-drop <pp> Fail on a domain reach drop at least this large with Holm-adjusted exact McNemar p ≤ 0.05 by default
  --fail-on-geo-answer-domain-paired-reach-alpha <alpha> Adjusted p-value ceiling for the paired-reach gate (0 < alpha ≤ 1; default 0.05)
  --fail-on-geo-answer-domain-paired-reach-min-prompts <n> Minimum complete matched prompts per provider/domain comparison (default 10)
  --geo-answer-domain-paired-reach-gate-json <file> Save the paired-reach gate support and significant domain losses as versioned JSON
  --geo-answer-page-paired-reach-comparison-csv <file> Compare exact cited-page reach on matched provider prompts with McNemar, bootstrap, and Holm results
  --geo-answer-page-paired-reach-comparison-json <file> Write the paired page reach comparison as structured JSON
  --geo-answer-page-opportunities-csv <file> Rank exact third-party pages cited when owned-page absence is confirmed on complete prompt groups
  --geo-answer-page-opportunity-trends-csv <file> Track confirmed-no-owned exact-page opportunities by provider and UTC month
  --fail-on-geo-answer-page-opportunity-monthly-rise <pp> Fail on a paired, Holm-significant exact-page reach rise of at least this many points
  --fail-on-geo-answer-page-opportunity-monthly-alpha <alpha> Adjusted p-value ceiling for the monthly page-opportunity rise gate (default 0.05)
  --fail-on-geo-answer-page-opportunity-monthly-min-prompts <n> Minimum shared complete no-owned prompts per monthly comparison (default 10)
  --geo-answer-page-opportunity-monthly-gate-json <file> Save monthly page-opportunity gate support and significant rises as versioned JSON
  --geo-answer-page-opportunity-path-families-csv <file> Group confirmed-no-owned exact pages by origin and path prefix
  --geo-answer-page-opportunity-path-family-depth-sweep-csv <file> Compare how page opportunities consolidate across path depths 1–5
  --geo-answer-page-opportunity-path-family-depth-sweep-html <file> Render a standalone chart and filterable path-depth sensitivity dashboard
  --geo-answer-page-opportunity-path-family-trends-csv <file> Track confirmed-no-owned path-family reach by provider and UTC month, with paired prompt transitions
  --geo-answer-page-opportunity-path-family-trends-html <file> Render a standalone, filterable path-family reach and transition dashboard
  --geo-answer-page-opportunity-path-depth <n> Leading URL path segments in page families (1–5; default 2)
  --fail-on-geo-answer-page-opportunity-path-family-monthly-rise <pp> Fail on a Holm-significant paired monthly path-family reach rise
  --fail-on-geo-answer-page-opportunity-path-family-monthly-alpha <alpha> Adjusted p-value ceiling for the path-family monthly rise gate (default 0.05)
  --fail-on-geo-answer-page-opportunity-path-family-monthly-min-prompts <n> Minimum matched prompts per monthly path-family comparison (default 10)
  --geo-answer-page-opportunity-path-family-monthly-gate-json <file> Save versioned monthly path-family rise gate JSON
  --geo-answer-page-paired-reach-owned-only Restrict page paired-reach comparisons to --geo-answer-owned-domain hosts and their subdomains
  --fail-on-geo-answer-page-paired-reach-drop <pp> Fail when an exact page loses this much matched-prompt reach with Holm-adjusted McNemar significance
  --fail-on-geo-answer-page-paired-reach-alpha <alpha> Adjusted p-value ceiling for the page paired-reach gate (0 < alpha ≤ 1; default 0.05)
  --fail-on-geo-answer-page-paired-reach-min-prompts <n> Minimum complete matched prompts per provider/page comparison (default 10)
  --geo-answer-page-paired-reach-metric <name> Gate citation-reach (default), top-three-reach, or first-position-reach
  --geo-answer-page-paired-reach-gate-json <file> Save page-reach gate support and significant exact-page losses as versioned JSON
  --geo-answer-source-diversity-uncertainty-csv <file> Bootstrap event- and rank-weighted source HHI, effective breadth, top-source share, and prompt richness
  --geo-answer-source-diversity-uncertainty-html <file> Plot provider source-concentration estimates and prompt-cluster bootstrap intervals
  --geo-answer-source-diversity-comparison-csv <file> Compare citation-source diversity on matched prompts across baseline/current samples
  --geo-answer-source-diversity-comparison-html <file> Plot matched-prompt event and rank concentration changes with paired intervals
  --geo-answer-provider-source-divergence-csv <file> Compare providers’ citation-domain distributions over shared exact prompts with Jensen–Shannon divergence
  --geo-answer-source-portfolio-drift-csv <file> Compare baseline/current source portfolios over matched provider prompts with event/rank-weighted Jensen–Shannon divergence
  --geo-answer-source-portfolio-drift-html <file> Review event/rank divergence, prompt-cluster intervals, and source turnover offline
  --geo-answer-source-portfolio-drift-json <file> Save typed version 1 source-drift summary and provider rows without raw prompts
  --geo-answer-source-portfolio-attribution-csv <file> Attribute matched-prompt citation-share changes to individual domains
  --geo-answer-source-portfolio-attribution-json <file> Save capped domain-level attribution rows and uncertainty metadata as structured JSON
  --geo-answer-source-portfolio-attribution-html <file> Review domain-level prompt-balanced and pooled citation-share changes offline
  --geo-answer-owned-source-share-gate-csv <file> Save provider-level point/CI owned citation-share gate assessment for CI artifacts
  --geo-answer-owned-source-share-gate-json <file> Save structured provider-level gate assessment, including exact sign-test p-values, for CI artifacts
  --geo-answer-source-network-csv <file> Export provider-specific citation-source co-occurrence edges and network centrality
  --geo-answer-source-network-comparison-csv <file> Compare matched-period provider citation-source networks and co-occurrence transitions
  --geo-answer-rank-weighted-source-network-csv <file> Export source co-citations and centrality weighted by reciprocal-log-rank citation positions
  --geo-answer-rank-weighted-source-network-comparison-csv <file> Compare matched-period rank-weighted source networks and edge-strength drift
  --geo-answer-source-network-html <file> Render an interactive, offline provider/source network dashboard
  --geo-answer-source-network-comparison-html <file> Review matched-period source-community lineage and network drift offline
  --geo-answer-provider-source-network-overlap-csv <file> Compare provider co-citation topology on shared exact prompts
  --geo-answer-provider-source-network-edge-drift-csv <file> Compare baseline/current provider edge gaps on matched exact prompts
  --geo-answer-provider-source-network-edge-drift-html <file> Render an offline provider edge-drift review page
  --geo-answer-provider-source-network-edge-comparison-csv <file> Compare provider edge presence on matched exact prompts
  --geo-answer-provider-source-network-edge-html <file> Render an offline provider edge-comparison review table
  --geo-answer-owned-source-network-gaps-csv <file> Find source pairs associated with owned-citation gaps
  --geo-answer-citation-date-alignment-csv <file> Compare audited schema dateModified days with the last captured citation day
  --geo-answer-owned-rank-csv <file> Export owned rank buckets and first-owned-citation mean reciprocal rank overall and by provider
  --geo-answer-owned-prompt-coverage-csv <file> Export distinct-prompt owned-citation reach overall and by provider; requires an owned domain
  --geo-answer-owned-prompt-reach-period-csv <file> Compare matched owned reach with sensitivity, exact McNemar, bootstrap, and Holm results
  --geo-answer-owned-prompt-opportunities-csv <file> List exact provider/prompt groups with no owned citation in the retained sample; requires an owned domain
  --geo-answer-competitive-gaps-csv <file> Rank cited alternative domains for provider/prompt gaps by citation events; requires an owned domain
  --geo-answer-provider-owned-gaps-csv <file> Find exact prompts where another provider cites an owned domain; requires an owned domain
  --geo-answer-provider-owned-gap-comparison-csv <file> Track same-prompt owned-citation gap changes across baseline/current samples
  --geo-answer-competitive-gap-comparison-csv <file> Compare alternative-domain event shares in no-owned-citation prompts across periods; requires a baseline and owned domain
  --geo-answer-owned-rank-comparison-csv <file> Compare overall owned citation rank buckets across baseline/current samples
  --geo-answer-co-citation-csv <file> Export external domains appearing alongside owned-domain citations by provider
  --geo-answer-co-citation-comparison-csv <file> Compare retained co-citation domains across baseline/current samples
  --geo-answer-entity <name[=alias1|alias2]> Track exact entity mentions in optional captured answerText; repeatable
  --geo-answer-entity-mentions-csv <file> Export configured answer-entity mentions and citation coverage by provider
  --geo-answer-entity-prompt-details-csv <file> Drill into exact prompt/provider entity mentions, citation coverage, and owned placement
  --geo-answer-entity-prompt-provider-pairs-csv <file> Compare entity mentions and citations across providers on shared exact prompts
  --geo-answer-entity-prompt-comparison-csv <file> Compare matched and one-period entity prompt outcomes across baseline/current samples
  --geo-answer-entity-co-mentions-csv <file> Export exact co-mentions, prompt overlap, lift, and monthly cohorts for configured entities
  --geo-answer-entity-co-mention-comparison-csv <file> Compare pair rates, overlap, and lift across baseline/current samples
  --geo-answer-entity-citation-domains-csv <file> Compare cited-domain shares in answers with/without configured entity mentions
  --geo-answer-entity-citation-pages-csv <file> Export exact cited-page coverage, placement, and mention/non-mention contrasts
  --geo-answer-entity-source-categories-csv <file> Roll entity-conditioned citation mix up to source categories; requires entity and category mappings
  --geo-answer-entity-source-category-comparison-csv <file> Compare entity-conditioned source-category citation mixes across baseline/current answer samples
  --geo-answer-entity-citation-domain-comparison-csv <file> Compare those entity-associated citation shares across samples
  --geo-answer-entity-citation-page-comparison-csv <file> Compare exact entity-associated cited-page movement across baseline/current samples
  --geo-answer-entity-citation-position-comparison-csv <file> Compare owned source rank within entity-mention and non-mention samples; requires owned domains
  --geo-answer-entity-opportunities-csv <file> Export answer mentions without owned-domain citations for review
  --geo-answer-entity-prompt-matched-association-csv <file> Compare owned citation reach in entity-mentioned vs non-mentioned answers on the same exact prompts
  --geo-answer-entity-prompt-matched-association-html <file> Render a filterable offline entity/prompt matched citation dashboard
  --geo-answer-entity-path-families-csv <file> Compare cited path-family coverage in exact entity-mentioned and non-mentioned answers
  --geo-answer-entity-path-family-monthly-csv <file> Export UTC-month entity-conditioned path-family profiles
  --geo-answer-entity-path-family-comparison-csv <file> Compare entity-conditioned path-family evidence across baseline/current samples
  --geo-answer-path-depth <n> Group cited answer URLs by origin and the first 1–5 path segments
  --geo-answer-path-family-csv <file> Export captured-answer citation volume and source positions by path family
  --geo-answer-path-family-cohorts-csv <file> Cross-tab cited path families by provider and supplied topic/intent cohort
  --geo-answer-path-family-trends-csv <file> Export monthly path-family coverage by provider and topic/intent
  --geo-answer-path-family-cohort-comparison-csv <file> Compare family coverage by provider and topic/intent across baseline/current samples
  --geo-answer-path-family-comparison-csv <file> Compare same-depth path-family citations with a baseline sample
  --geo-answer-crawler-report <file> Join cited page paths with retained paths from a prior AI crawler log report
  --geo-answer-crawler-origin <origin> Exact site origin used to scope the crawler-log path join
  --geo-answer-crawler-matches-csv <file> Export cited-page and observed crawler-path evidence
  --fail-on-geo-answer-owned-citation-drop <pp> Exit 1 when owned-citation answer coverage drops beyond this threshold; requires matching baseline/current samples and an owned domain
  --fail-on-geo-answer-owned-source-share-drop <pp> Fail closed if prompt-balanced owned citation-event share drops beyond this threshold (default minimum 10 matched prompts)
  --fail-on-geo-answer-owned-source-share-drop-lower-ci <pp> Fail if a provider's 95% prompt-cluster lower bound for owned-share decline exceeds this threshold
  --fail-on-geo-answer-owned-source-share-sign-test-alpha <alpha> Require a provider's one-sided exact prompt sign test for declines beyond the point threshold, lower-CI threshold, or 0 pp to pass Holm correction
  --fail-on-geo-answer-owned-source-share-min-prompts <n> Minimum both-cited matched prompts per provider for either owned source-share gate (2–10000; default 10)
  --fail-on-geo-answer-incomplete-list-share <percent> Exit 1 when the overall or any provider's incomplete citation-list share exceeds this limit
  --fail-on-geo-answer-incomplete-list-share-rise <pp> Exit 1 when any provider/cohort's list-truncation share rises beyond this threshold across sampled months
  --fail-on-geo-answer-unknown-owned-observation-share <percent> Exit 1 when too many snapshots have an unknown owned-citation state
  --fail-on-geo-answer-unknown-owned-prompt-share <percent> Exit 1 when too many prompt groups have an unknown owned-citation reach state
  --fail-on-geo-answer-unknown-owned-state-share-rise <pp> Exit 1 when unknown owned-citation observation or prompt share rises beyond this monthly threshold
  --fail-on-geo-answer-provider-balanced-citation-drop <pp> Exit 1 when any provider's equal-prompt citation-coverage mean drops beyond this threshold; requires complete matching baseline/current prompt detail
  --fail-on-geo-answer-owned-prompt-coverage-drop <pp> Exit 1 when any provider's share of matched prompts citing an owned domain falls beyond this threshold
  --fail-on-geo-answer-owned-reach-bound-drop <pp> Exit 1 only when the optimistic completeness bound confirms an owned-prompt reach decline; requires two matched prompts per provider
  --fail-on-geo-answer-cohort-owned-prompt-coverage-drop <pp> Exit 1 when a matched topic/intent/provider cohort's owned-cited prompt reach drops beyond this threshold
  --fail-on-geo-answer-cohort-owned-mrr-drop <pp> Gate prompt-balanced first-owned-citation MRR declines in every matched cohort
  --fail-on-geo-answer-cohort-owned-mrr-min-prompts <n> Minimum owned-cited prompts per period/cohort for the MRR gate (default 2)
  --fail-on-geo-answer-cohort-monthly-owned-mrr-drop <pp> Gate latest sampled-month first-owned-citation MRR declines by cohort
  --fail-on-geo-answer-cohort-monthly-owned-mrr-min-prompts <n> Minimum owned-cited prompts in each sampled month (default 2)
  --fail-on-geo-answer-cohort-monthly-paired-mrr-drop <pp> Gate first-owned-citation MRR declines on shared exact prompts (default 2 prompts)
  --fail-on-geo-answer-cohort-monthly-paired-mrr-drop-lower-ci <pp> Gate only when the 95% paired-prompt interval confirms a decline (default 10 prompts)
  --fail-on-geo-answer-cohort-monthly-paired-mrr-min-matched-prompts <n> Override paired monthly MRR gate support floor
  --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop <pp> Gate paired owned-cited prompt-reach declines (default 2 matched prompts)
  --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop-lower-ci <pp> Gate only when the 95% paired-prompt interval confirms a reach decline (default 10 prompts)
  --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-decline <pp> Gate declines confirmed by Holm-adjusted exact McNemar p-value (default alpha 0.05)
  --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-alpha <p> Adjusted p-value cutoff for the Holm decline gate
  --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-min-matched-prompts <n> Override paired monthly owned-reach gate support floor
  --fail-on-geo-answer-owned-first-position-drop <pp> Exit 1 when owned citation-event share at rank 1 drops beyond this threshold; requires matching baseline/current samples and an owned domain
  --fail-on-geo-answer-owned-top-three-drop <pp> Exit 1 when owned citations in ranks 1–3 drop beyond this threshold; requires matching baseline/current samples and an owned domain
  --geo-answer-owned-prompt-rank-comparison-csv <path> Export exact-prompt-balanced owned rank-one/top-three changes and paired-prompt bootstrap intervals; requires baseline/current samples and an owned domain
  --fail-on-geo-answer-owned-prompt-balanced-first-position-drop <pp> Gate the exact-prompt-balanced rank-one mean decline; defaults to two matched prompts
  --fail-on-geo-answer-owned-prompt-balanced-first-position-drop-lower-ci <pp> Gate rank-one decline only when its paired-prompt 95% bootstrap lower bound exceeds the threshold; defaults to ten prompts
  --fail-on-geo-answer-owned-prompt-balanced-top-three-drop <pp> Gate the exact-prompt-balanced top-three mean decline; defaults to two matched prompts
  --fail-on-geo-answer-owned-prompt-balanced-top-three-drop-lower-ci <pp> Gate top-three decline only when its paired-prompt 95% bootstrap lower bound exceeds the threshold; defaults to ten prompts
  --fail-on-geo-answer-owned-prompt-balanced-mrr-drop <pp> Gate equal-prompt mean reciprocal rank of the first owned citation; defaults to two matched prompts
  --fail-on-geo-answer-owned-prompt-balanced-mrr-drop-lower-ci <pp> Gate MRR decline only when its paired-prompt 95% bootstrap lower bound exceeds the threshold; defaults to ten prompts
  --fail-on-geo-answer-owned-prompt-balanced-rank-min-matched-prompts <n> Set the support floor for exact-prompt-balanced owned-rank gates (2–10000)
  --fail-on-geo-answer-length-owned-top-three-drop <pp> Gate paired-prompt owned top-three-share drops within matched bands; requires complete profiles and comparable owned domains
  --fail-on-geo-answer-length-owned-top-three-drop-lower-ci <pp> Fail only when the lower 95% paired-prompt bootstrap bound for a band's mean top-three-share drop exceeds this threshold; defaults to 10 matched prompts per band
  --fail-on-geo-answer-length-owned-first-position-drop <pp> Gate paired-prompt owned rank-one-share drops within matched bands
  --fail-on-geo-answer-length-owned-first-position-drop-lower-ci <pp> Fail only when the lower 95% paired-prompt bootstrap bound for a band's mean rank-one-share drop exceeds this threshold; defaults to 10 matched prompts per band
  --fail-on-geo-answer-length-owned-mrr-drop <pp> Gate exact-prompt-balanced first-owned-citation MRR drops within matched answer-length bands
  --fail-on-geo-answer-length-owned-mrr-drop-lower-ci <pp> Fail only when the lower 95% paired-prompt bootstrap bound for a band's mean MRR drop exceeds this threshold; defaults to 10 matched prompts per band
  --fail-on-geo-answer-length-owned-rank-min-matched-prompts <n> Minimum shared exact prompts with owned citations in both periods per matched band (2–10000; default 2, or 10 with lower-CI gate); fails closed if any band misses the floor
  --fail-on-geo-answer-entity-mention-drop <pp> Exit 1 when any configured entity mention rate drops beyond this threshold in captured answer text
  --fail-on-geo-answer-entity-owned-top-three-drop <pp> Exit 1 when owned citation rank in entity mentions drops beyond this threshold
  --fail-on-geo-answer-path-family-coverage-drop <pp> Exit 1 when a matched provider/cohort path family loses snapshot coverage beyond this threshold
  --fail-on-geo-answer-path-family-prompt-coverage-drop <pp> Exit 1 when a matched provider/cohort path family loses distinct-prompt coverage beyond this threshold
  --fail-on-geo-answer-path-family-over-index-drop <fraction> Exit 1 when a family’s whole-sample-relative cohort share drops by more than this fraction
  --fail-on-geo-answer-entity-path-family-prompt-coverage-drop <pp> Exit 1 when entity-mentioned family prompt coverage declines beyond this threshold
  --fail-on-geo-answer-entity-path-family-top-three-drop <pp> Exit 1 when entity-mentioned family top-three citation share declines beyond this threshold
  --fail-on-geo-answer-entity-citation-page-prompt-coverage-drop <pp> Exit 1 when an exact page loses distinct-prompt coverage in entity-mentioned answers
  --fail-on-geo-answer-entity-citation-page-top-three-drop <pp> Exit 1 when an exact page loses top-three citation share in entity-mentioned answers
  --fail-on-geo-answer-entity-prompt-mention-drop <pp> Exit 1 when pooled entity mention rate falls across matched prompt/provider rows
  --fail-on-geo-answer-entity-prompt-balanced-mention-drop <pp> Exit 1 when equal-prompt/provider mean entity mention rate falls beyond this threshold
  --fail-on-geo-answer-entity-prompt-min-matched-prompts <count> Exit 1 when any entity has fewer than this many shared exact prompts with answer text
  --fail-on-geo-answer-provider-prompt-overlap-below <jaccard> Exit 1 when a provider pair's whole-sample exact-prompt Jaccard is below this value
  --fail-on-geo-answer-provider-min-prompts <count> Exit 1 when any provider has fewer distinct prompts than this count
  --fail-on-geo-answer-provider-min-matched-prompts <count> Exit 1 when any provider has fewer shared exact prompts across baseline/current samples than this count
  --fail-on-geo-answer-sample-mix-divergence <max-jsd> Exit 1 when provider topic/intent sample distributions diverge beyond this value
  --fail-on-geo-answer-cohort-standardized-citation-drop <provider=pp> Exit 1 when that provider's cohort-standardized citation coverage drops too far; repeatable
  --fail-on-geo-answer-cohort-standardized-owned-prompt-coverage-drop <provider=pp> Gate owned-cited exact-prompt reach after cohort adjustment; requires an owned domain
  --geo-answer-cohorts-csv <file> Export topic/intent/provider citation profiles and unique owned-cited prompt reach to CSV
  --geo-answer-owned-domain <host> Mark a domain and its subdomains as owned; repeatable
  --geo-crawler-baseline-json <file> Compare current crawler-log samples with a previous Aviary log report
  --fail-on-new-geo-crawler-failures Fail on newly failing paths, higher failure rates, or incomplete comparison
  --fail-on-new-ai-referral-failures Fail on rising tagged-referral failures or incomplete source/path comparison
  --fail-on-ai-crawler-timing-regression Fail on slower comparable p95 timing bands; requires 20 timing rows per sample and a baseline
  --fail-on-ai-crawler-cloudfront-result-regression Fail on increased CloudFront error-class shares; requires 20 field rows per period and a baseline
  --geo-crawler-token <token> Add a user-agent token to match; repeatable, reported as unclassified
  --geo-ai-referral-source <label=value> Aggregate exact utm_source values by label in crawler-log reports; repeatable
  --geo-crawler-origin <origin> Origin for audit or sitemap correlation; requires matching input data
  --geo-crawler-sitemap <url> Compare sitemap lastmod dates with crawler log visits; requires --geo-crawler-origin
  --geo-crawler-sitemap-max-urls <n> Limit sitemap URLs for crawler freshness comparison (1–10,000; default 1,000)
  --geo-robots-txt <file>   Replay logged paths, audited URLs, or sitemap URLs against a robots.txt snapshot
  --geo-robots-baseline-txt <file> Compare a previous robots.txt snapshot with --geo-robots-txt
  --geo-robots-origin <origin> Origin for robots replay; requires --geo-robots-txt
  --geo-robots-sitemap <url> Replay up to 10,000 same-origin sitemap URLs against robots snapshots without page audits
  --pdf <file>              Save robots replay reports as print-ready PDF alongside HTML/JSON
  --geo-robots-token <token> Add a custom token for saved-audit or sitemap replay; repeatable, always labeled custom
  --fail-on-newly-blocked-geo-paths Exit 1 on new blocks or incomplete snapshot comparison
  --fail-on-newly-blocked-geo-audit-pages Exit 1 on saved-audit policy blocks or incomplete comparison
  --fail-on-newly-blocked-geo-targets Exit 1 on newly blocked sitemap or saved-audit URL/token pairs
  --fail-on-findings     Exit with code 1 when the audit finds failed checks
  --fail-on-duplicate-metadata Exit with code 1 when a batch has repeated page titles or descriptions
  --fail-on-duplicate-content Exit with code 1 when a batch has exact repeated main content
  --fail-on-hreflang     Exit with code 1 when scanned alternate pages lack reciprocal hreflang links
  --fail-on-canonical-chains Exit on chains, loops, invalid declarations, or missing result data
  --fail-below-score <n> Exit with code 1 when the score is below 0-100 threshold
  --baseline <file>     Compare with a previous single-URL or batch JSON report
  --fail-on-regression  Fail on a score drop or newly failing check (requires --baseline)
  --fail-on-geo-change  Fail on GEO changes or missing comparable data; supports live audits and offline --render with --baseline
  --fail-on-geo-change-signal <label> Restrict failures to exact CSV/JSON signal labels; repeatable, requires --fail-on-geo-change
  --fail-on-geo-change-url <url> Restrict failures to exact changed-page URLs; repeatable, requires --fail-on-geo-change
  --fail-on-geo-change-transition <before=>after> Restrict failures to exact state transitions (quote the value); repeatable, requires --fail-on-geo-change
  --category <keys>     Run selected comma-separated category keys only; repeatable
  --json                 Output raw JSON to stdout (no formatted text)
  -c, --config <file>    Configuration file (JSON or YAML)
  -p, --preset <name>    Use preset configuration (basic, advanced, strict, geo)
  --init-config          Create a default configuration file
  --doctor               Check Node.js, Chromium, environment, and configuration readiness (--json for structured output)
  --headed               Run browser in headed mode (default: headless)
  --viewport <WxH>       Set viewport size (e.g., 1920x1080 or 375x667)
  -v, --verbose          Show details for failed checks
  -h, --help             Show this help message
  -V, --version          Show the installed Aviary version
  --completion <shell>   Print shell completions (bash, zsh, or fish)

Environment Variables (12-Factor config):
  AVIARY_URL            Target URL (overridden by --url)
  AVIARY_HEADLESS       "true"/"false" (overridden by --headed)
  AVIARY_TIMEOUT        Timeout in milliseconds (default: 30000; overridden by --timeout)
  AVIARY_SETTLE_AFTER_NAVIGATION_MS Fixed post-navigation delay in ms (default: 1000; overridden by --settle-ms)
  AVIARY_VIEWPORT       Viewport "WxH" format (overridden by --viewport)
  AVIARY_PRESET         Preset name: basic/advanced/strict/geo (overridden by --preset)
  AVIARY_OUTPUT         JSON output file path (overridden by --output)
  AVIARY_HTML_OUTPUT    HTML report path (overridden by --html)
  AVIARY_PDF_OUTPUT     PDF report path (overridden by --pdf)
  AVIARY_HISTORY_OUTPUT Append per-audit records to this JSONL file (overridden by --history)
  AVIARY_JUNIT_OUTPUT   JUnit XML report path (overridden by --junit)
  AVIARY_SARIF_OUTPUT   SARIF 2.1.0 report path (overridden by --sarif)
  AVIARY_MARKDOWN_OUTPUT Markdown report path (overridden by --markdown)
  AVIARY_CSV_OUTPUT      CSV report path (overridden by --csv)
  AVIARY_CONCURRENCY     Concurrent audits for --urls (1 to 8; --concurrency overrides)
  AVIARY_FAIL_ON_FINDINGS "true" to exit with code 1 when checks fail
  AVIARY_FAIL_ON_DUPLICATE_METADATA "true" to fail batch scans with repeated titles/descriptions
  AVIARY_FAIL_ON_DUPLICATE_CONTENT "true" to fail batch scans with exact repeated main content
  AVIARY_FAIL_BELOW_SCORE Minimum score from 0 to 100 (CLI flag overrides)
  AVIARY_BASELINE_REPORT Previous JSON report to compare against (overridden by --baseline)
  AVIARY_FAIL_ON_REGRESSION "true" to fail on score drops/new failed checks
  AVIARY_CATEGORIES     Comma-separated checker keys (overridden by --category)
  AVIARY_LOG_LEVEL      Log level: debug/info/warn/error (default: info)
  AVIARY_LLM_PROVIDER   LLM provider (default: stub)
  AVIARY_LLM_ENDPOINT   LLM endpoint URL (default: http://localhost:11434)
  AVIARY_LLM_MODEL      Ollama model name (default: llama3)
  AVIARY_LLM_API_KEY    Reserved for a future provider; unused by stub/Ollama
  AVIARY_METRICS_PORT   Loopback-only Prometheus port (integer 1-65535, default: 9090)

Examples:
  aviary -u https://example.com
  aviary -u https://example.com -o report.json
  aviary -u https://example.com --junit reports/aviary.xml
  aviary -u https://example.com --markdown reports/aviary.md
  aviary -u https://example.com --csv reports/aviary.csv
  aviary --bing-ai-csv exports/pages.csv --geo-audit-json reports/site.json --json
  aviary --bing-ai-xlsx exports/ai-performance.xlsx --geo-audit-json reports/site.json --html reports/bing-ai.html
  aviary --bing-ai-baseline-csv exports/last-month-pages.csv --bing-ai-csv exports/this-month-pages.csv --json
  aviary --bing-ai-baseline-xlsx exports/last-month-pages.xlsx --bing-ai-xlsx exports/this-month-pages.xlsx --html reports/bing-period-diff.html
  aviary --bing-ai-query-baseline-csv exports/last-month-queries.csv --bing-ai-csv exports/this-month-queries.csv --html reports/query-mapping-diff.html
  aviary --bing-ai-topic-baseline-csv exports/last-month-topics.csv --bing-ai-csv exports/this-month-topics.csv --html reports/topic-intent-diff.html
  aviary --bing-ai-csv exports/query-page-mapping.csv --html reports/bing-ai.html
  aviary --google-ai-csv exports/gen-ai-pages.csv --geo-audit-json reports/site.json --html reports/google-ai.html
  aviary --google-ai-xlsx exports/gen-ai-workbook.xlsx --geo-audit-json reports/site.json --html reports/google-ai.html
  aviary --google-ai-discover-csv exports/discover-pages.csv --geo-audit-json reports/site.json --html reports/discover-ai.html
  aviary --google-ai-discover-xlsx exports/discover-workbook.xlsx --geo-audit-json reports/site.json --html reports/discover-ai.html
  aviary --geo-google-surface-matrix --google-ai-csv exports/search-ai-pages.csv --google-ai-discover-csv exports/discover-ai-pages.csv --html reports/google-surfaces.html
  aviary --geo-google-surface-matrix --google-ai-xlsx exports/search-ai.xlsx --google-ai-discover-xlsx exports/discover-ai.xlsx --html reports/google-surfaces.html
  aviary --geo-google-surface-matrix --geo-path-depth 2 --google-ai-csv exports/search-ai-pages.csv --google-ai-discover-csv exports/discover-ai-pages.csv --output reports/google-surfaces.json
  aviary --geo-google-surface-matrix --geo-path-depth 2 --google-ai-csv exports/search-ai-pages.csv --google-ai-discover-csv exports/discover-ai-pages.csv --geo-google-surface-path-family-csv reports/google-surface-families.csv
  aviary --geo-google-surface-matrix --geo-google-surface-baseline-json reports/google-surfaces-previous.json --google-ai-csv exports/search-ai-pages.csv --google-ai-discover-csv exports/discover-ai-pages.csv --html reports/google-surfaces-diff.html
  aviary --geo-platform-matrix --google-ai-csv exports/google-pages.csv --bing-ai-csv exports/bing-pages.csv --geo-audit-json reports/site.json --html reports/platform-pages.html
  aviary --geo-platform-matrix --google-ai-xlsx exports/google-pages.xlsx --bing-ai-xlsx exports/bing-pages.xlsx --geo-audit-json reports/site.json --html reports/platform-pages.html
  aviary --geo-crawler-log logs/access.log --geo-crawler-log logs/access.log.1.gz --html reports/ai-crawlers.html\n  aviary --geo-crawler-log logs/access.log --geo-crawler-path-families-csv reports/crawler-path-families.csv --geo-crawler-path-families-json reports/crawler-path-families.json --geo-crawler-path-families-html reports/crawler-path-families.html --geo-crawler-path-depth 2\n  aviary --geo-crawler-log logs/access.log --geo-crawler-origin https://example.com --geo-audit-json reports/site.json --geo-crawler-path-family-audit-csv reports/path-audit.csv --geo-crawler-path-family-audit-json reports/path-audit.json --geo-crawler-path-family-audit-html reports/path-audit.html\n  aviary --geo-crawler-baseline-json reports/crawlers-previous.json --geo-crawler-log logs/current.jsonl --geo-crawler-path-family-comparison-csv reports/path-family-period.csv --geo-crawler-path-family-comparison-json reports/path-family-period.json --geo-crawler-path-family-comparison-html reports/path-family-period.html --fail-on-geo-crawler-path-family-failure-rise 10
  aviary --geo-crawler-baseline-json reports/crawlers-previous.json --geo-crawler-log logs/current.jsonl --output reports/crawlers-diff.json --html reports/crawlers-diff.html
  aviary --geo-crawler-baseline-json reports/crawlers-previous.json --geo-crawler-log logs/current.jsonl --fail-on-new-geo-crawler-failures --json
  aviary --geo-crawler-log logs/access.jsonl --geo-crawler-token ExaBot --geo-crawler-token Amazonbot --json
  aviary --geo-crawler-log logs/access.jsonl --geo-ai-referral-source Perplexity=perplexity.ai --html reports/referrals.html
  aviary --geo-crawler-log logs/access.log --geo-crawler-origin https://example.com --geo-audit-json reports/geo-summary.json --html reports/crawler-audit.html
  aviary --geo-crawler-log logs/access.log --geo-crawler-origin https://example.com --geo-crawler-sitemap https://example.com/sitemap.xml --html reports/recrawl-review.html
  aviary --geo-crawler-log logs/access.jsonl --geo-crawler-ip-ranges ranges.json --html reports/crawler-identity.html
  aviary --geo-answer-observations samples/answers.json --geo-answer-owned-domain example.com --html reports/answer-citations.html --output reports/answer-citations.json
  aviary --geo-answer-observations samples/answers.json --geo-audit-json reports/site.json --geo-answer-owned-domain example.com --html reports/answer-citations.html
  aviary --geo-answer-observations samples/current.json --geo-answer-baseline-observations samples/previous.json --geo-answer-owned-domain example.com --html reports/answer-period.html --geo-answer-comparison-csv reports/answer-period.csv
  aviary --geo-robots-sitemap https://example.com/sitemap.xml --geo-sitemap-max-urls 5000 --geo-robots-origin https://example.com --geo-robots-txt snapshots/robots-current.txt --geo-robots-baseline-txt snapshots/robots-previous.txt --fail-on-newly-blocked-geo-targets --html reports/robots-sitemap.html
  aviary --google-ai-baseline-csv exports/last-month.csv --google-ai-csv exports/this-month.csv --json
  aviary --google-ai-dimension-baseline-csv exports/last-month-device.csv --google-ai-csv exports/this-month-device.csv --html reports/google-device-shift.html
  aviary --google-ai-dimension-baseline-xlsx exports/last-month-device.xlsx --google-ai-xlsx exports/this-month-device.xlsx --html reports/google-device-shift.html
  aviary --render reports/current.json --html reports/visual.html --pdf reports/print.pdf
  aviary --render reports/current.json --baseline reports/previous.json --html reports/geo-review.html --fail-on-geo-change
  aviary --render reports/current-batch.json --baseline reports/previous-batch.json --geo-summary-output reports/geo.json --geo-summary-csv reports/geo.csv --fail-on-geo-change
  aviary --history-report reports/history.jsonl --html reports/history.html
  aviary -u https://example.com --baseline reports/baseline.json --fail-on-regression
  aviary -u https://example.com --category metaTags,accessibility
  aviary -u https://example.com/article --preset geo
  aviary --urls urls.txt --concurrency 4 --markdown reports/pages.md --junit reports/pages.xml
  aviary --urls urls.txt --watch 300 --history reports/history.jsonl
  aviary -u https://example.com --viewport 375x667
  aviary -u https://example.com --headed
  aviary -u https://example.com --preset basic
  aviary -u https://example.com --config .aviary.json
  AVIARY_URL=https://example.com aviary --json
  aviary --init-config

Checks performed (242 checks across ${CHECKER_REGISTRY.length} categories):
  • Meta tags (title, description, Open Graph, canonical, viewport)
  • Heading structure (H1-H6 hierarchy)
  • Image optimization (alt text)
  • Performance metrics (load time, DOM content loaded)
  • Robots.txt validation
  • XML sitemap detection
  • AI discoverability (GEO): crawler controls, snippet-word coverage, source/rendered text overlap, answer structure, sources, citation exports, and optional llms.txt inventory
  • Security (HTTPS, mixed content, security headers)
  • Structured data (JSON-LD, Microdata)
  • Social media tags (Twitter Cards, Facebook Open Graph)
  • Content analysis (word count, readability)
  • Links analysis (internal/external links)
  • UI elements (favicon, breadcrumbs, language tags)
  • Technical SEO (redirects, response codes, compression, duplicates)
  • Accessibility (ARIA labels, form labels, tab order)
  • URL factors (length, readability, keywords, structure)
  • Spam detection (hidden text, keyword stuffing, cloaking)
  • Page quality (duplicates, freshness, E-A-T signals)
  • Advanced images (responsive, lazy loading, WebP, dimensions)
  • Multimedia (videos, audio, accessibility, schema)
  • Core Web Vitals (LCP, CLS, FCP, TTFB, Total Blocking Time, page load, resource sizes, caching)
  • Analytics (Google Analytics, GTM, pixels, tracking, verification)
  • Mobile UX (tap targets, viewport, responsive, PWA, AMP)
  • Schema Validation (Product, Article, Organization, Event, etc.)
  • Resource Optimization (minification, CDN, fonts, HTTP/2)
  • Legal Compliance (privacy, GDPR, CCPA, cookies, copyright)
  • E-commerce (products, pricing, reviews, checkout, security)
  • Internationalization (hreflang, languages, localization, Unicode)
  • Heatmap & UX (predictive click maps, scroll depth, above-the-fold scoring)

For more information, visit: https://github.com/Ru1vly/Aviary
  `);
}

function writeSitemapProgress(progress: {
  sitemapsFetched: number;
  sitemapsQueued: number;
  discoveredUrls: number;
  currentSitemap: string;
}): void {
  process.stderr.write(
    `Sitemap discovery: ${progress.sitemapsFetched} document(s) read, ${progress.sitemapsQueued} queued, ` +
      `${progress.discoveredUrls} page URL(s) found (${progress.currentSitemap})\n`
  );
}

function writeCrawlProgress(progress: {
  pagesProcessed: number;
  pagesQueued: number;
  discoveredUrls: number;
  pagesAtLinkLimit: number;
  responseBytesDownloaded: number;
  currentUrl: string;
}): void {
  process.stderr.write(
    `Link crawl: ${progress.pagesProcessed} page(s) processed, ${progress.pagesQueued} queued, ` +
      `${progress.discoveredUrls} URL(s) found, ${(progress.responseBytesDownloaded / (1024 * 1024)).toFixed(1)} MiB of HTML downloaded (${progress.currentUrl})` +
      `${progress.pagesAtLinkLimit > 0 ? `; ${progress.pagesAtLinkLimit} page(s) hit the 10,000-link capture limit` : ''}\n`
  );
}

async function main() {
  const args = parseArgs();
  const bingAiInputCount = (args.bingAiCsv?.length ?? 0) + (args.bingAiXlsx?.length ?? 0);
  const googleAiSearchInputCount =
    (args.googleAiCsv?.length ?? 0) + (args.googleAiXlsx?.length ?? 0);
  const googleAiDiscoverInputCount =
    (args.googleAiDiscoverCsv?.length ?? 0) + (args.googleAiDiscoverXlsx?.length ?? 0);
  const googleAiInputCount = googleAiSearchInputCount + googleAiDiscoverInputCount;
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (
    ((args.failOnGeoChangeSignals?.length ?? 0) > 0 ||
      (args.failOnGeoChangeUrls?.length ?? 0) > 0 ||
      (args.failOnGeoChangeTransitions?.length ?? 0) > 0) &&
    !args.failOnGeoChange
  ) {
    process.stderr.write('❌ GEO change filters require --fail-on-geo-change.\n');
    process.exit(2);
  }
  const hasGeoChangeFilters = Boolean(
    args.failOnGeoChangeSignals?.length ||
    args.failOnGeoChangeUrls?.length ||
    args.failOnGeoChangeTransitions?.length
  );
  const geoChangeFilters: SEOAuditGeoSignalFilters = {
    ...(args.failOnGeoChangeSignals?.length ? { signals: args.failOnGeoChangeSignals } : {}),
    ...(args.failOnGeoChangeUrls?.length ? { urls: args.failOnGeoChangeUrls } : {}),
    ...(args.failOnGeoChangeTransitions?.length
      ? { transitions: args.failOnGeoChangeTransitions }
      : {}),
  };
  const evaluateGate = (
    comparison: SEOReportComparison | SEOAuditBatchComparison,
    currentFailedUrls = 0,
    baselineFailedUrls = 0
  ): SEOAuditGeoGateEvaluation =>
    evaluateSEOAuditGeoChangeGate(comparison, {
      filters: geoChangeFilters,
      currentFailedUrls,
      baselineFailedUrls,
    });
  const writeGeoGateOutput = (
    outputPath: string,
    comparison: SEOReportComparison | SEOAuditBatchComparison,
    currentTimestamp: string,
    gate: SEOAuditGeoGateEvaluation,
    currentPageUrl?: string
  ): void => {
    const isBatch = 'geoComparedPages' in comparison;
    if (!isBatch && !currentPageUrl)
      throw new Error('Single-page GEO gate output requires the current page URL.');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          artifactType: 'geo-change-gate',
          schemaVersion: 1,
          scope: isBatch
            ? { type: 'batch' }
            : {
                type: 'single-page',
                baselineUrl: comparison.baselineUrl,
                currentUrl: currentPageUrl,
              },
          baselineTimestamp: comparison.baselineTimestamp,
          currentTimestamp,
          geoComparedBasis: comparison.geoComparedBasis,
          filters: {
            signals: (geoChangeFilters.signals ?? []).map((value) => value.trim()),
            urls: (geoChangeFilters.urls ?? []).map((value) => value.trim()),
            transitions: (geoChangeFilters.transitions ?? []).map(({ before, after }) => ({
              before: before.trim(),
              after: after.trim(),
            })),
          },
          ...gate,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  };
  const summarizeGateGeoChanges = (selected: ReadonlyArray<SEOAuditGeoSignalChange>): string => {
    const label = hasGeoChangeFilters ? 'selected GEO signal change(s)' : 'GEO signal change(s)';
    if (selected.length === 0) return `0 ${label}`;
    const shorten = (value: string): string => {
      const normalized = value
        .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
      const chars = Array.from(normalized);
      return chars.length > 100 ? `${chars.slice(0, 97).join('')}…` : normalized;
    };
    const details = selected
      .slice(0, 8)
      .map(
        ({ signal, before, after, url }) =>
          `${shorten(signal)} ${shorten(before)} → ${shorten(after)} at ${shorten(url)}`
      )
      .join('; ');
    const remainder = selected.length > 8 ? `; and ${selected.length - 8} more` : '';
    return `${selected.length} ${label}: ${details}${remainder}`;
  };
  const gateFailureMessages = (gate: SEOAuditGeoGateEvaluation): string[] =>
    gate.failureReasons.map((reason) =>
      reason.code === 'selected-changes'
        ? summarizeGateGeoChanges(gate.matchingChanges)
        : reason.message
    );
  if (args.maxCrawlBytes !== undefined && !args.crawl) {
    process.stderr.write('❌ --max-crawl-bytes can only be used with --crawl.\n');
    process.exit(2);
  }
  if (args.maxCrawlPageBytes !== undefined && !args.crawl) {
    process.stderr.write('❌ --max-crawl-page-bytes can only be used with --crawl.\n');
    process.exit(2);
  }
  if (args.version) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    ) as { version?: unknown };
    process.stdout.write(
      `${typeof packageJson.version === 'string' ? packageJson.version : 'unknown'}\n`
    );
    return;
  }
  if (args.completion) {
    const categories = CHECKER_REGISTRY.map(({ key }) => key);
    process.stdout.write(renderShellCompletion(args.completion, categories));
    return;
  }
  if (args.doctor) {
    const incompatibleOptions = Object.keys(args).filter(
      (key) => !['doctor', 'config', 'help', 'json'].includes(key)
    );
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ --doctor can only be combined with --config to inspect a specific configuration file.\n'
      );
      process.exit(2);
    }
    printDoctor(args.config, args.json);
    return;
  }
  if (args.geoAnswerOwnedDomains?.length && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-owned-domain requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerOwnedCitationDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-owned-citation-drop requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerOwnedSourceShareDrop !== undefined ||
    args.failOnGeoAnswerOwnedSourceShareDropLowerCi !== undefined ||
    args.failOnGeoAnswerOwnedSourceShareSignTestAlpha !== undefined
  ) {
    if (
      !args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length
    ) {
      process.stderr.write(
        '❌ Owned source-share gates require current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
      );
      process.exit(2);
    }
  }
  if (
    args.failOnGeoAnswerOwnedSourceShareMinPrompts !== undefined &&
    args.failOnGeoAnswerOwnedSourceShareDrop === undefined &&
    args.failOnGeoAnswerOwnedSourceShareDropLowerCi === undefined &&
    args.failOnGeoAnswerOwnedSourceShareSignTestAlpha === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-owned-source-share-min-prompts requires an owned source-share gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedSourceShareGateCsv !== undefined &&
    args.failOnGeoAnswerOwnedSourceShareDrop === undefined &&
    args.failOnGeoAnswerOwnedSourceShareDropLowerCi === undefined &&
    args.failOnGeoAnswerOwnedSourceShareSignTestAlpha === undefined
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-source-share-gate-csv requires an owned source-share gate threshold.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedSourceShareGateJson !== undefined &&
    args.failOnGeoAnswerOwnedSourceShareDrop === undefined &&
    args.failOnGeoAnswerOwnedSourceShareDropLowerCi === undefined &&
    args.failOnGeoAnswerOwnedSourceShareSignTestAlpha === undefined
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-source-share-gate-json requires an owned source-share gate.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerOwnedReachBoundDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-owned-reach-bound-drop requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerProviderBalancedCitationDrop !== undefined &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-provider-balanced-citation-drop requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerOwnedPromptCoverageDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-owned-prompt-coverage-drop requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortOwnedPromptCoverageDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-owned-prompt-coverage-drop requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortOwnedMrrDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-owned-mrr-drop requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortOwnedMrrMinPrompts !== undefined &&
    args.failOnGeoAnswerCohortOwnedMrrDrop === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-owned-mrr-min-prompts requires --fail-on-geo-answer-cohort-owned-mrr-drop.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortMonthlyOwnedMrrDrop !== undefined &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-monthly-owned-mrr-drop requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortMonthlyOwnedMrrMinPrompts !== undefined &&
    args.failOnGeoAnswerCohortMonthlyOwnedMrrDrop === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-monthly-owned-mrr-min-prompts requires --fail-on-geo-answer-cohort-monthly-owned-mrr-drop.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerCohortMonthlyPairedMrrDrop !== undefined ||
      args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi !== undefined) &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ Monthly paired owned-MRR gates require --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortMonthlyPairedMrrMinMatchedPrompts !== undefined &&
    args.failOnGeoAnswerCohortMonthlyPairedMrrDrop === undefined &&
    args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-monthly-paired-mrr-min-matched-prompts requires a paired monthly MRR gate.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop !== undefined ||
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi !== undefined ||
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline !== undefined
  ) {
    if (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length) {
      process.stderr.write(
        '❌ Monthly cohort owned-prompt-reach gates require --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
      );
      process.exit(2);
    }
  }
  if (
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmAlpha !== undefined &&
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-alpha requires --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-decline.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageMinMatchedPrompts !== undefined &&
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop === undefined &&
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi === undefined &&
    args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-min-matched-prompts requires a monthly owned-prompt-reach gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedRankComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-rank-comparison-csv requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedPromptRankComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-prompt-rank-comparison-csv requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedRankCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-rank-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedPromptCoverageCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-prompt-coverage-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedPromptReachPeriodCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-prompt-reach-period-csv requires current and baseline answer observations and at least one shared --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedPromptOpportunitiesCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-prompt-opportunities-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerCompetitiveGapsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-competitive-gaps-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerProviderOwnedGapsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-provider-owned-gaps-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerProviderOwnedGapComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-provider-owned-gap-comparison-csv requires current and baseline answer observations and the same non-empty owned-domain set.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerCompetitiveGapComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-competitive-gap-comparison-csv requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerOwnedFirstPositionDrop !== undefined ||
      args.failOnGeoAnswerOwnedTopThreeDrop !== undefined ||
      args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDrop !== undefined ||
      args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi !== undefined ||
      args.failOnGeoAnswerOwnedPromptBalancedTopThreeDrop !== undefined ||
      args.failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi !== undefined ||
      args.failOnGeoAnswerOwnedPromptBalancedMrrDrop !== undefined ||
      args.failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi !== undefined) &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ Owned citation rank regression gates require current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerOwnedPromptBalancedRankMinMatchedPrompts !== undefined &&
    args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDrop === undefined &&
    args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi === undefined &&
    args.failOnGeoAnswerOwnedPromptBalancedTopThreeDrop === undefined &&
    args.failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi === undefined &&
    args.failOnGeoAnswerOwnedPromptBalancedMrrDrop === undefined &&
    args.failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-owned-prompt-balanced-rank-min-matched-prompts requires an exact-prompt-balanced owned-rank gate.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerLengthOwnedTopThreeDrop !== undefined ||
      args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi !== undefined ||
      args.failOnGeoAnswerLengthOwnedFirstPositionDrop !== undefined ||
      args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi !== undefined ||
      args.failOnGeoAnswerLengthOwnedMrrDrop !== undefined ||
      args.failOnGeoAnswerLengthOwnedMrrDropLowerCi !== undefined) &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ Length-stratified owned-rank gate requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerLengthOwnedRankMinMatchedPrompts !== undefined &&
    args.failOnGeoAnswerLengthOwnedTopThreeDrop === undefined &&
    args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi === undefined &&
    args.failOnGeoAnswerLengthOwnedFirstPositionDrop === undefined &&
    args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi === undefined &&
    args.failOnGeoAnswerLengthOwnedMrrDrop === undefined &&
    args.failOnGeoAnswerLengthOwnedMrrDropLowerCi === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-length-owned-rank-min-matched-prompts requires a length-stratified owned rank drop gate.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityMentionDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-mention-drop requires current and baseline answer observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityOwnedTopThreeDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-owned-top-three-drop requires current and baseline answer observations, at least one --geo-answer-entity, and --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerPathFamilyCoverageDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-path-family-coverage-drop requires baseline/current observations and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerPathFamilyPromptCoverageDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-path-family-prompt-coverage-drop requires baseline/current observations and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerPathFamilyOverIndexDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-path-family-over-index-drop requires baseline/current observations and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityPathFamilyPromptCoverageDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-path-family-prompt-coverage-drop requires baseline/current observations, at least one --geo-answer-entity, and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityPathFamilyTopThreeDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-path-family-top-three-drop requires baseline/current observations, at least one --geo-answer-entity, and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityCitationPagePromptCoverageDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-citation-page-prompt-coverage-drop requires baseline/current observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityCitationPageTopThreeDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-citation-page-top-three-drop requires baseline/current observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityPromptMentionDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-prompt-mention-drop requires baseline/current observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityPromptBalancedMentionDrop !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-prompt-balanced-mention-drop requires baseline/current observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerEntityPromptMinMatchedPrompts !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-entity-prompt-min-matched-prompts requires baseline/current observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (args.failOnGeoAnswerProviderPromptOverlapBelow !== undefined && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-provider-prompt-overlap-below requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.failOnGeoAnswerProviderMinPrompts !== undefined && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-provider-min-prompts requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerProviderMinMatchedPrompts !== undefined &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-provider-min-matched-prompts requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.failOnGeoAnswerSampleMixDivergence !== undefined && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-sample-mix-divergence requires --geo-answer-observations and at least two provider labels.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortStandardizedCitationDrop &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-standardized-citation-drop requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerCohortStandardizedOwnedPromptCoverageDrop &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-cohort-standardized-owned-prompt-coverage-drop requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerCohortsCsv && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-cohorts-csv requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (args.geoAnswerCohortStandardizationCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-cohort-standardization-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerPromptSamplingPlanCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-prompt-sampling-plan-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerPromptSamplingPlanJson && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-prompt-sampling-plan-json requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerPromptPlanProviderPairsCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-provider-pairs-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerExecutionContextCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-execution-context-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerExecutionContextCoverageCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-execution-context-coverage-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  const promptPlanHasOutput = Boolean(
    args.geoAnswerPromptSamplingPlanCsv ||
    args.geoAnswerPromptSamplingPlanJson ||
    args.geoAnswerPromptPlanProviderPairsCsv ||
    args.html ||
    args.failOnGeoAnswerPromptPlanMiss
  );
  if (
    args.geoAnswerPromptPlanCohortTargets &&
    (!args.geoAnswerObservations || !promptPlanHasOutput)
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-cohort-targets requires answer observations and a prompt-plan output or fail gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPromptPlanMinPrompts !== undefined &&
    (!args.geoAnswerObservations || !promptPlanHasOutput)
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-min-prompts requires answer observations and a prompt-plan output or fail gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPromptPlanOwnedReachMargin !== undefined &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length || !promptPlanHasOutput)
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-owned-reach-margin requires answer observations, an owned domain, and a prompt-plan output or fail gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPromptPlanMinimumJaccard !== undefined &&
    (!args.geoAnswerObservations || !promptPlanHasOutput)
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-min-jaccard requires answer observations and a prompt-plan output or fail gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPromptPlanMaxPairedGroups !== undefined &&
    (!args.geoAnswerObservations || !promptPlanHasOutput)
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-max-paired-groups requires answer observations and a prompt-plan output or fail gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPromptPlanMaxTotalPairedGroups !== undefined &&
    (!args.geoAnswerObservations || !promptPlanHasOutput)
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-max-total-paired-groups requires answer observations and a prompt-plan output or fail gate.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPromptPlanTotalAllocation !== undefined &&
    (args.geoAnswerPromptPlanMaxTotalPairedGroups === undefined ||
      !args.geoAnswerObservations ||
      !promptPlanHasOutput)
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-plan-total-allocation requires a total paired-group cap, answer observations, and a prompt-plan output or fail gate.\n'
    );
    process.exit(2);
  }
  if (args.failOnGeoAnswerPromptPlanMiss && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-prompt-plan-miss requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerCohortPeriodStandardizationCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-cohort-period-standardization-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerExecutionContextComparisonCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-execution-context-comparison-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerExecutionContextTrendsCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-execution-context-trends-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerLengthProfilesCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-length-profiles-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerLengthComparisonCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-length-comparison-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerLengthTrendsCsv && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-length-trends-csv requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (args.geoAnswerProviderPairsCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-provider-pairs-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerProviderPromptOverlapCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-provider-prompt-overlap-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerProviderPromptSourceOverlapCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-provider-prompt-source-overlap-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerSampleMixCsv && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-sample-mix-csv requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (args.geoAnswerTemporalStabilityCsv && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-stability-csv requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (args.geoAnswerSourcePersistenceCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-source-persistence-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerCitationUrlPersistenceCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-citation-url-persistence-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerCohortTrendsCsv && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-cohort-trends-csv requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (args.geoAnswerAuditSignalsCsv && (!args.geoAnswerObservations || !args.geoAuditJson)) {
    process.stderr.write(
      '❌ --geo-answer-audit-signals-csv requires --geo-answer-observations and --geo-audit-json.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerAuditedOwnedPageProviderInventoryCsv ||
      args.geoAnswerAuditedOwnedPageProviderInventoryHtml ||
      args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv ||
      args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml ||
      args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson) &&
    (!args.geoAnswerObservations || !args.geoAuditJson || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ The owned-page provider inventory requires --geo-answer-observations, --geo-audit-json, and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv ||
      args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml ||
      args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson) &&
    !args.geoAnswerBaselineObservations
  ) {
    process.stderr.write(
      '❌ Owned-page/provider comparison outputs require --geo-answer-baseline-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAuditBaselineJson &&
    (!args.geoAuditJson ||
      !args.geoAnswerBaselineObservations ||
      !(
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv ||
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml ||
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson
      ))
  ) {
    process.stderr.write(
      '❌ --geo-audit-baseline-json requires --geo-audit-json, baseline answer observations, and an owned-page/provider inventory comparison output.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAuditBaselineJson &&
    (args.geoAnswerAuditedOwnedPageComparisonCsv ||
      args.geoAnswerAuditedOwnedPageProviderComparisonCsv)
  ) {
    process.stderr.write(
      '❌ --geo-audit-baseline-json cannot be combined with owned-page citation-placement comparisons that require one shared audit snapshot.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerAuditedOwnedPagesCsv &&
    (!args.geoAnswerObservations || !args.geoAuditJson || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-audited-owned-pages-csv requires --geo-answer-observations, --geo-audit-json, and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerAuditedOwnedPageComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAuditJson ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-audited-owned-page-comparison-csv requires current and baseline answer observations, --geo-audit-json, and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerAuditedOwnedPageProvidersCsv &&
    (!args.geoAnswerObservations || !args.geoAuditJson || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-audited-owned-page-providers-csv requires --geo-answer-observations, --geo-audit-json, and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerAuditedOwnedPageProviderComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAuditJson ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-audited-owned-page-provider-comparison-csv requires current and baseline observations, --geo-audit-json, and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerSourceCategories?.length && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-source-category requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategories?.length &&
    !args.geoAnswerSourceCategoriesCsv &&
    !args.geoAnswerSourceCategoryMappingAuditCsv &&
    !args.geoAnswerSourceCategoryComparisonCsv &&
    !args.geoAnswerSourceCategoryMixDecompositionCsv &&
    !args.geoAnswerSourceCategoryMixDecompositionHtml &&
    !args.geoAnswerSourceCategoryConcentrationTrendsCsv &&
    !args.geoAnswerSourceCategoryConcentrationTrendsHtml &&
    !args.geoAnswerSourceCategoryShareTrendsCsv &&
    !args.geoAnswerSourceCategoryShareTrendsHtml &&
    !args.geoAnswerSourceCategoryMonthlyGatesJson &&
    args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryShareDrop === undefined &&
    args.failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove === undefined &&
    !args.geoAnswerSourceCategoryPromptBalancedJsdGateJson &&
    !args.geoAnswerSourceCategoryPromptCoverageCsv &&
    !args.geoAnswerSourceCategoryPromptDetailsCsv &&
    !args.geoAnswerSourceCategoryTrendsCsv &&
    !args.geoAnswerSourceCategoryProviderPairsCsv &&
    !args.geoAnswerSourceCategoryCooccurrenceCsv &&
    !args.geoAnswerSourceCategoryPathFamiliesCsv &&
    !args.geoAnswerSourceCategoryPathFamilyComparisonCsv &&
    !args.geoAnswerEntitySourceCategoriesCsv &&
    !args.geoAnswerEntitySourceCategoryComparisonCsv &&
    !args.geoAnswerEntityOpportunitiesCsv &&
    !args.geoAnswerPromptFamiliesCsv &&
    !args.geoAnswerPromptFamiliesHtml &&
    !args.geoAnswerPromptFamilyInfluenceCsv &&
    !args.geoAnswerPromptFamilyInfluenceHtml &&
    !args.geoAnswerPromptFamilyThresholdSweepCsv &&
    !args.geoAnswerPromptFamilyThresholdSweepHtml &&
    !args.geoAnswerSourceRarefactionCsv &&
    !args.geoAnswerPromptFamilySourceRarefactionCsv &&
    !args.geoAnswerPromptFamilySourceRarefactionHtml &&
    !args.geoAnswerProviderPromptFamilySourceOverlapCsv &&
    !args.geoAnswerProviderPromptFamilySourceOverlapHtml &&
    !args.html
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category requires a category-aware report output or --html output.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoriesCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-categories-csv requires --geo-answer-observations and at least one --geo-answer-source-category hostname=category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryMappingAuditCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-mapping-audit-csv requires --geo-answer-observations and at least one --geo-answer-source-category hostname=category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-comparison-csv requires current and baseline observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerSourceCategoryMixDecompositionCsv ||
      args.geoAnswerSourceCategoryMixDecompositionHtml) &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ Source-category mix-decomposition outputs require current and baseline observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryMonthlyGatesJson &&
    args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryShareDrop === undefined
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-monthly-gates-json requires at least one monthly source-category threshold gate.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerSourceCategoryMonthlyMinEvents !== undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove === undefined &&
    args.failOnGeoAnswerSourceCategoryShareDrop === undefined
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-source-category-monthly-min-events requires a monthly source-category threshold gate.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerSourceCategoryPromptBalancedJsdMinPrompts !== undefined ||
      args.geoAnswerSourceCategoryPromptBalancedJsdGateJson) &&
    args.failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove === undefined
  ) {
    process.stderr.write(
      '❌ Prompt-balanced JSD gate support/output options require --fail-on-geo-answer-source-category-prompt-balanced-jsd-lower-ci-above.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove !== undefined &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ The prompt-balanced source-category JSD gate requires current and baseline answer observations and at least one source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerSourceCategoryConcentrationTrendsCsv ||
      args.geoAnswerSourceCategoryConcentrationTrendsHtml ||
      args.geoAnswerSourceCategoryShareTrendsCsv ||
      args.geoAnswerSourceCategoryShareTrendsHtml ||
      args.geoAnswerSourceCategoryMonthlyGatesJson ||
      args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove !== undefined ||
      args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove !== undefined ||
      args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove !== undefined ||
      args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove !== undefined ||
      args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove !== undefined ||
      args.failOnGeoAnswerSourceCategoryShareDrop !== undefined) &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ Source-category trend outputs require --geo-answer-observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryPromptCoverageCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-prompt-coverage-csv requires --geo-answer-observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryPromptDetailsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-prompt-details-csv requires --geo-answer-observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryTrendsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-trends-csv requires --geo-answer-observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryProviderPairsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-provider-pairs-csv requires --geo-answer-observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryCooccurrenceCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-cooccurrence-csv requires --geo-answer-observations and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerDomainPromptCoverageComparisonCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-domain-prompt-coverage-comparison-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerDomainPairedReachComparisonCsv ||
      args.geoAnswerDomainPairedReachComparisonJson) &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-domain-paired-reach-comparison-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerDomainPairedReachAlpha !== undefined ||
      args.failOnGeoAnswerDomainPairedReachMinPrompts !== undefined ||
      args.geoAnswerDomainPairedReachGateJson) &&
    args.failOnGeoAnswerDomainPairedReachDrop === undefined
  ) {
    process.stderr.write(
      '❌ Paired domain reach gate options require --fail-on-geo-answer-domain-paired-reach-drop.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerDomainPairedReachDrop !== undefined &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ The paired domain reach gate requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerPagePairedReachComparisonCsv || args.geoAnswerPagePairedReachComparisonJson) &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ Paired page reach comparison outputs require current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPagePairedReachOwnedOnly &&
    !args.geoAnswerPagePairedReachComparisonCsv &&
    !args.geoAnswerPagePairedReachComparisonJson &&
    args.failOnGeoAnswerPagePairedReachDrop === undefined
  ) {
    process.stderr.write(
      '❌ --geo-answer-page-paired-reach-owned-only requires a page paired-reach comparison or gate.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerPagePairedReachOwnedOnly && !args.geoAnswerOwnedDomains?.length) {
    process.stderr.write(
      '❌ --geo-answer-page-paired-reach-owned-only requires at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPageOpportunitiesCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-page-opportunities-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPageOpportunityTrendsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-page-opportunity-trends-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerPageOpportunityPathFamiliesCsv ||
      args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv ||
      args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml ||
      args.geoAnswerPageOpportunityPathFamilyTrendsCsv ||
      args.geoAnswerPageOpportunityPathFamilyTrendsHtml) &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ Page opportunity path-family reports require --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPageOpportunityPathDepth !== undefined &&
    !args.geoAnswerPageOpportunityPathFamiliesCsv &&
    !args.geoAnswerPageOpportunityPathFamilyTrendsCsv &&
    !args.geoAnswerPageOpportunityPathFamilyTrendsHtml
  ) {
    process.stderr.write(
      '❌ --geo-answer-page-opportunity-path-depth requires a page opportunity path-family report.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerPageOpportunityMonthlyAlpha !== undefined ||
      args.failOnGeoAnswerPageOpportunityMonthlyMinPrompts !== undefined ||
      args.geoAnswerPageOpportunityMonthlyGateJson) &&
    args.failOnGeoAnswerPageOpportunityMonthlyRise === undefined
  ) {
    process.stderr.write(
      '❌ Monthly page-opportunity gate options require --fail-on-geo-answer-page-opportunity-monthly-rise.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerPageOpportunityMonthlyRise !== undefined &&
    !args.geoAnswerPageOpportunityTrendsCsv
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-page-opportunity-monthly-rise requires --geo-answer-page-opportunity-trends-csv.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPageOpportunityTrendsCsv &&
    args.geoAnswerPageOpportunityMonthlyGateJson &&
    pathsReferToSameFile(
      args.geoAnswerPageOpportunityTrendsCsv,
      args.geoAnswerPageOpportunityMonthlyGateJson
    )
  ) {
    process.stderr.write(
      '❌ The monthly page-opportunity CSV and gate JSON must use different output paths.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyAlpha !== undefined ||
      args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyMinPrompts !== undefined ||
      args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson) &&
    args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise === undefined
  ) {
    process.stderr.write(
      '❌ Monthly page-opportunity path-family gate options require --fail-on-geo-answer-page-opportunity-path-family-monthly-rise.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise !== undefined &&
    !args.geoAnswerPageOpportunityPathFamilyTrendsCsv
  ) {
    process.stderr.write(
      '❌ --fail-on-geo-answer-page-opportunity-path-family-monthly-rise requires --geo-answer-page-opportunity-path-family-trends-csv.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerPagePairedReachAlpha !== undefined ||
      args.failOnGeoAnswerPagePairedReachMinPrompts !== undefined ||
      args.geoAnswerPagePairedReachGateJson) &&
    args.failOnGeoAnswerPagePairedReachDrop === undefined
  ) {
    process.stderr.write(
      '❌ Page paired-reach gate options require --fail-on-geo-answer-page-paired-reach-drop.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPagePairedReachMetric &&
    args.failOnGeoAnswerPagePairedReachDrop === undefined
  ) {
    process.stderr.write(
      '❌ --geo-answer-page-paired-reach-metric requires --fail-on-geo-answer-page-paired-reach-drop.\n'
    );
    process.exit(2);
  }
  if (
    args.failOnGeoAnswerPagePairedReachDrop !== undefined &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ The page paired-reach gate requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerSourceDiversityUncertaintyCsv || args.geoAnswerSourceDiversityUncertaintyHtml) &&
    !args.geoAnswerObservations
  ) {
    process.stderr.write(
      '❌ Source-diversity uncertainty outputs require --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerSourceDiversityComparisonCsv || args.geoAnswerSourceDiversityComparisonHtml) &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ Source-diversity comparison outputs require current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerProviderSourceDivergenceCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-provider-source-divergence-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerSourcePortfolioDriftCsv ||
      args.geoAnswerSourcePortfolioDriftHtml ||
      args.geoAnswerSourcePortfolioDriftJson) &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ Source-portfolio drift outputs require current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerSourcePortfolioAttributionCsv || args.geoAnswerSourcePortfolioAttributionHtml) &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ Source-portfolio attribution outputs require current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerSourceNetworkCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-source-network-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceNetworkComparisonCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-network-comparison-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerRankWeightedSourceNetworkCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-rank-weighted-source-network-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerRankWeightedSourceNetworkComparisonCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-rank-weighted-source-network-comparison-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerProviderSourceNetworkEdgeDriftCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-provider-source-network-edge-drift-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerProviderSourceNetworkEdgeDriftHtml &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-provider-source-network-edge-drift-html requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerSourceNetworkHtml && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-source-network-html requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceNetworkComparisonHtml &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-network-comparison-html requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerProviderSourceNetworkOverlapCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-provider-source-network-overlap-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerProviderSourceNetworkEdgeComparisonCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-provider-source-network-edge-comparison-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerProviderSourceNetworkEdgeHtml && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-provider-source-network-edge-html requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerOwnedSourceNetworkGapsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-owned-source-network-gaps-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerDomainPromptCoverageCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-domain-prompt-coverage-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerPromptSimilarityCsv ||
      args.geoAnswerPromptFamiliesCsv ||
      args.geoAnswerPromptFamiliesHtml ||
      args.geoAnswerPromptFamilyInfluenceCsv ||
      args.geoAnswerPromptFamilyInfluenceHtml ||
      args.geoAnswerPromptFamilyThresholdSweepCsv ||
      args.geoAnswerPromptFamilyThresholdSweepHtml ||
      args.geoAnswerPromptFamilySourceRarefactionCsv ||
      args.geoAnswerPromptFamilySourceRarefactionHtml ||
      args.geoAnswerPromptFamilySourceRarefactionSweepCsv ||
      args.geoAnswerPromptFamilySourceRarefactionSweepHtml ||
      args.geoAnswerProviderPromptFamilySourceOverlapCsv ||
      args.geoAnswerProviderPromptFamilySourceOverlapHtml ||
      args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv ||
      args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml ||
      args.geoAnswerPromptFamilyPeriodComparisonCsv ||
      args.geoAnswerPromptFamilyPeriodComparisonHtml ||
      args.geoAnswerPromptFamilyPeriodComparisonSweepCsv ||
      args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv ||
      args.geoAnswerPromptFamilyPeriodComparisonSweepHtml) &&
    !args.geoAnswerObservations
  ) {
    process.stderr.write(
      '❌ Prompt similarity, prompt-family, and family source-overlap outputs require --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerPromptFamilyPeriodComparisonCsv ||
      args.geoAnswerPromptFamilyPeriodComparisonHtml ||
      args.geoAnswerPromptFamilyPeriodComparisonSweepCsv ||
      args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv ||
      args.geoAnswerPromptFamilyPeriodComparisonSweepHtml) &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ Prompt-family period-comparison outputs require --geo-answer-observations and --geo-answer-baseline-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerPromptSimilarityThreshold !== undefined && !args.geoAnswerPromptSimilarityCsv) {
    process.stderr.write(
      '❌ --geo-answer-prompt-similarity-threshold requires --geo-answer-prompt-similarity-csv.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPromptFamilyThreshold !== undefined &&
    !args.geoAnswerPromptFamiliesCsv &&
    !args.geoAnswerPromptFamiliesHtml &&
    !args.geoAnswerPromptFamilyInfluenceCsv &&
    !args.geoAnswerPromptFamilyInfluenceHtml &&
    !args.geoAnswerPromptFamilyThresholdSweepCsv &&
    !args.geoAnswerPromptFamilyThresholdSweepHtml &&
    !args.geoAnswerPromptFamilySourceRarefactionCsv &&
    !args.geoAnswerPromptFamilySourceRarefactionHtml &&
    !args.geoAnswerPromptFamilySourceRarefactionSweepCsv &&
    !args.geoAnswerPromptFamilySourceRarefactionSweepHtml &&
    !args.geoAnswerProviderPromptFamilySourceOverlapCsv &&
    !args.geoAnswerProviderPromptFamilySourceOverlapHtml &&
    !args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv &&
    !args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml &&
    !args.geoAnswerPromptFamilyPeriodComparisonCsv &&
    !args.geoAnswerPromptFamilyPeriodComparisonHtml &&
    !args.geoAnswerPromptFamilyPeriodComparisonSweepCsv &&
    !args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv &&
    !args.geoAnswerPromptFamilyPeriodComparisonSweepHtml
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-family-threshold requires a prompt-family CSV, family threshold sweep, family source-rarefaction, family source-overlap, or family period-comparison output.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerCitationPositionsCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-citation-positions-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerSourceRarefactionCsv && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-source-rarefaction-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerPromptFamilySourceRarefactionCsv ||
      args.geoAnswerPromptFamilySourceRarefactionHtml ||
      args.geoAnswerPromptFamilySourceRarefactionSweepCsv ||
      args.geoAnswerPromptFamilySourceRarefactionSweepHtml) &&
    !args.geoAnswerObservations
  ) {
    process.stderr.write(
      '❌ --geo-answer-prompt-family-source-rarefaction-csv requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceRarefactionBatchSize !== undefined &&
    (!args.geoAnswerObservations ||
      (!args.geoAnswerSourceRarefactionCsv &&
        !args.geoAnswerPromptFamilySourceRarefactionCsv &&
        !args.geoAnswerPromptFamilySourceRarefactionHtml &&
        !args.geoAnswerPromptFamilySourceRarefactionSweepCsv &&
        !args.geoAnswerPromptFamilySourceRarefactionSweepHtml &&
        !args.html))
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-rarefaction-batch-size requires --geo-answer-observations and a source-rarefaction CSV, family source-rarefaction HTML, or --html.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerCitationDateAlignmentCsv &&
    (!args.geoAnswerObservations || !args.geoAuditJson)
  ) {
    process.stderr.write(
      '❌ --geo-answer-citation-date-alignment-csv requires --geo-answer-observations and --geo-audit-json.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerCoCitationCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-co-citation-csv requires --geo-answer-observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerCoCitationComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-co-citation-comparison-csv requires current and baseline answer observations and at least one --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerEntities?.length && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-entity requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (
    args.geoAnswerEntityMentionsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-mentions-csv requires --geo-answer-observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityPromptDetailsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-prompt-details-csv requires --geo-answer-observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityPromptProviderPairsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-prompt-provider-pairs-csv requires --geo-answer-observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityPromptComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-prompt-comparison-csv requires baseline/current observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityCoMentionsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerEntities || args.geoAnswerEntities.length < 2)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-co-mentions-csv requires --geo-answer-observations and at least two --geo-answer-entity definitions.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityCoMentionComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities ||
      args.geoAnswerEntities.length < 2)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-co-mention-comparison-csv requires baseline/current observations and at least two --geo-answer-entity definitions.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityCitationDomainsCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-citation-domains-csv requires --geo-answer-observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityCitationPagesCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-citation-pages-csv requires --geo-answer-observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntitySourceCategoriesCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerEntities?.length ||
      !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-source-categories-csv requires --geo-answer-observations, at least one --geo-answer-entity, and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntitySourceCategoryComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length ||
      !args.geoAnswerSourceCategories?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-source-category-comparison-csv requires current and baseline observations, at least one --geo-answer-entity, and at least one --geo-answer-source-category mapping.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityCitationDomainComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-citation-domain-comparison-csv requires current and baseline answer observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityCitationPageComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-citation-page-comparison-csv requires current and baseline answer observations and at least one --geo-answer-entity.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityCitationPositionComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-citation-position-comparison-csv requires current and baseline answer observations, at least one --geo-answer-entity, and --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityOpportunitiesCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerEntities?.length ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-opportunities-csv requires --geo-answer-observations, at least one --geo-answer-entity, and --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    (args.geoAnswerEntityPromptMatchedAssociationCsv ||
      args.geoAnswerEntityPromptMatchedAssociationHtml) &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerEntities?.length ||
      !args.geoAnswerOwnedDomains?.length)
  ) {
    process.stderr.write(
      '❌ Prompt-matched entity/citation analysis requires --geo-answer-observations, at least one --geo-answer-entity, and --geo-answer-owned-domain.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityPathFamiliesCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerEntities?.length ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-path-families-csv requires --geo-answer-observations, at least one --geo-answer-entity, and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityPathFamilyMonthlyCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerEntities?.length ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-path-family-monthly-csv requires --geo-answer-observations, at least one --geo-answer-entity, and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerEntityPathFamilyComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerEntities?.length ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-entity-path-family-comparison-csv requires baseline/current observations, at least one --geo-answer-entity, and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerPathDepth !== undefined && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-path-depth requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryPathFamiliesCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerSourceCategories?.length ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-path-families-csv requires --geo-answer-observations, at least one --geo-answer-source-category mapping, and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerSourceCategoryPathFamilyComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      !args.geoAnswerSourceCategories?.length ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-source-category-path-family-comparison-csv requires current and baseline observations, at least one --geo-answer-source-category mapping, and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerPathFamiliesCsv && args.geoAnswerPathDepth === undefined) {
    process.stderr.write('❌ --geo-answer-path-family-csv requires --geo-answer-path-depth.\n');
    process.exit(2);
  }
  if (
    args.geoAnswerPathFamilyCohortsCsv &&
    (!args.geoAnswerObservations || args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-path-family-cohorts-csv requires --geo-answer-observations and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPathFamilyTrendsCsv &&
    (!args.geoAnswerObservations || args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-path-family-trends-csv requires --geo-answer-observations and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPathFamilyCohortComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-path-family-cohort-comparison-csv requires baseline/current observations and --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerPathFamilyComparisonCsv &&
    (!args.geoAnswerObservations ||
      !args.geoAnswerBaselineObservations ||
      args.geoAnswerPathDepth === undefined)
  ) {
    process.stderr.write(
      '❌ --geo-answer-path-family-comparison-csv requires current and baseline observations plus --geo-answer-path-depth.\n'
    );
    process.exit(2);
  }
  if (Boolean(args.geoAnswerCrawlerReport) !== Boolean(args.geoAnswerCrawlerOrigin)) {
    process.stderr.write(
      '❌ --geo-answer-crawler-report and --geo-answer-crawler-origin must be supplied together.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerCrawlerReport && !args.geoAnswerObservations) {
    process.stderr.write('❌ --geo-answer-crawler-report requires --geo-answer-observations.\n');
    process.exit(2);
  }
  if (
    args.geoAnswerCrawlerMatchesCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerCrawlerReport || !args.geoAnswerCrawlerOrigin)
  ) {
    process.stderr.write(
      '❌ --geo-answer-crawler-matches-csv requires observed answers, a crawler report, and its origin.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerBaselineObservations && !args.geoAnswerObservations) {
    process.stderr.write(
      '❌ --geo-answer-baseline-observations requires --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerComparisonCsv && !args.geoAnswerBaselineObservations) {
    process.stderr.write(
      '❌ --geo-answer-comparison-csv requires --geo-answer-baseline-observations and --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (
    args.geoAnswerProviderPositionComparisonCsv &&
    (!args.geoAnswerObservations || !args.geoAnswerBaselineObservations)
  ) {
    process.stderr.write(
      '❌ --geo-answer-provider-position-comparison-csv requires current and baseline answer observations.\n'
    );
    process.exit(2);
  }
  if (
    (args.failOnGeoAnswerIncompleteListShare !== undefined ||
      args.failOnGeoAnswerIncompleteListShareRise !== undefined ||
      args.failOnGeoAnswerUnknownOwnedObservationShare !== undefined ||
      args.failOnGeoAnswerUnknownOwnedPromptShare !== undefined ||
      args.failOnGeoAnswerUnknownOwnedStateShareRise !== undefined) &&
    !args.geoAnswerObservations
  ) {
    process.stderr.write(
      '❌ GEO citation-list completeness gates require --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  if (args.geoAnswerCohortComparisonCsv && !args.geoAnswerBaselineObservations) {
    process.stderr.write(
      '❌ --geo-answer-cohort-comparison-csv requires --geo-answer-baseline-observations and --geo-answer-observations.\n'
    );
    process.exit(2);
  }
  const hasGoogleAiAnswerConcordanceSources = Boolean(
    args.geoAnswerObservations &&
    (args.googleAiCsv?.length ?? 0) +
      (args.googleAiXlsx?.length ?? 0) +
      (args.googleAiDiscoverCsv?.length ?? 0) +
      (args.googleAiDiscoverXlsx?.length ?? 0) >
      0
  );
  if (
    args.geoGoogleAiCitationConcordancePathDepth !== undefined &&
    !args.geoGoogleAiCitationConcordanceCsv &&
    !args.geoGoogleAiCitationConcordanceHtml &&
    !args.geoGoogleAiCitationConcordancePathFamilyCsv &&
    !args.geoGoogleAiCitationConcordancePathDepthSweepCsv &&
    !(hasGoogleAiAnswerConcordanceSources && args.output)
  ) {
    process.stderr.write(
      '--geo-google-ai-citation-concordance-path-depth requires a citation concordance output.\n'
    );
    process.exit(2);
  }
  if (
    Boolean(args.geoGoogleAiCitationConcordanceBaselineJson) !==
    Boolean(
      args.geoGoogleAiCitationConcordanceComparisonCsv ||
      args.geoGoogleAiCitationConcordanceComparisonJson ||
      args.geoGoogleAiCitationConcordanceComparisonHtml ||
      args.geoGoogleAiCitationConcordanceProviderComparisonCsv
    )
  ) {
    process.stderr.write(
      '--geo-google-ai-citation-concordance-baseline-json must be paired with at least one comparison CSV, provider-comparison CSV, JSON, or HTML output.\n'
    );
    process.exit(2);
  }
  if (
    args.geoGoogleAiCitationConcordanceCsv ||
    args.geoGoogleAiCitationConcordanceHtml ||
    args.geoGoogleAiCitationConcordancePathFamilyCsv ||
    args.geoGoogleAiCitationConcordanceProviderCsv ||
    args.geoGoogleAiCitationConcordancePathDepthSweepCsv ||
    args.geoGoogleAiCitationConcordanceBaselineJson ||
    args.geoGoogleAiCitationConcordanceComparisonCsv ||
    args.geoGoogleAiCitationConcordanceComparisonJson ||
    args.geoGoogleAiCitationConcordanceComparisonHtml ||
    args.geoGoogleAiCitationConcordanceProviderComparisonCsv ||
    (hasGoogleAiAnswerConcordanceSources && args.output)
  ) {
    try {
      if (!args.geoAnswerObservations)
        throw new Error('Citation concordance requires --geo-answer-observations.');
      const googleInputs = [
        ...(args.googleAiCsv ?? []).map((file) => ({
          file,
          surface: 'search' as const,
          xlsx: false,
        })),
        ...(args.googleAiXlsx ?? []).map((file) => ({
          file,
          surface: 'search' as const,
          xlsx: true,
        })),
        ...(args.googleAiDiscoverCsv ?? []).map((file) => ({
          file,
          surface: 'discover' as const,
          xlsx: false,
        })),
        ...(args.googleAiDiscoverXlsx ?? []).map((file) => ({
          file,
          surface: 'discover' as const,
          xlsx: true,
        })),
      ];
      if (googleInputs.length !== 1)
        throw new Error(
          'Citation concordance requires exactly one Google Search or Discover AI CSV/XLSX input.'
        );
      const allowedOptions = new Set([
        'geoAnswerObservations',
        'geoAnswerOwnedDomains',
        'googleAiCsv',
        'googleAiXlsx',
        'googleAiDiscoverCsv',
        'googleAiDiscoverXlsx',
        'geoGoogleAiCitationConcordanceCsv',
        'geoGoogleAiCitationConcordanceHtml',
        'geoGoogleAiCitationConcordancePathFamilyCsv',
        'geoGoogleAiCitationConcordanceProviderCsv',
        'geoGoogleAiCitationConcordancePathDepth',
        'geoGoogleAiCitationConcordancePathDepthSweepCsv',
        'geoGoogleAiCitationConcordanceBaselineJson',
        'geoGoogleAiCitationConcordanceComparisonCsv',
        'geoGoogleAiCitationConcordanceComparisonJson',
        'geoGoogleAiCitationConcordanceComparisonHtml',
        'geoAuditJson',
        'output',
        'geoGoogleAiCitationConcordanceProviderComparisonCsv',
      ]);
      const incompatibleOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
      if (incompatibleOptions.length > 0) {
        throw new Error(
          `Citation concordance only combines one Google AI page export, answer observations, optional owned domains, and concordance outputs. Incompatible options: ${incompatibleOptions.join(', ')}`
        );
      }

      const observationStats = fs.statSync(args.geoAnswerObservations);
      if (!observationStats.isFile())
        throw new Error(`${args.geoAnswerObservations} is not a regular JSON file.`);
      if (observationStats.size > 25 * 1024 * 1024)
        throw new Error(`${args.geoAnswerObservations} exceeds the 25 MiB input limit.`);
      let answerText: string;
      try {
        answerText = new TextDecoder('utf-8', { fatal: true }).decode(
          fs.readFileSync(args.geoAnswerObservations)
        );
      } catch {
        throw new Error(`${args.geoAnswerObservations} is not valid UTF-8 text.`);
      }
      const answerInput: unknown = JSON.parse(answerText);
      const googleInput = googleInputs[0]!;
      const googleExports = await parseGoogleAiInputFile(
        googleInput.file,
        googleInput.surface,
        googleInput.xlsx
      );
      if (googleExports.length !== 1)
        throw new Error(
          'Citation concordance requires one recognized Google AI page table; select a page-only workbook.'
        );
      const answerReport = analyzeAiAnswerCitationObservations(
        answerInput,
        args.geoAnswerOwnedDomains
      );
      let audit: SiteWideGeoAnalysis | undefined;
      if (args.geoAuditJson) {
        const auditStats = fs.statSync(args.geoAuditJson);
        if (!auditStats.isFile())
          throw new Error(`${args.geoAuditJson} is not a regular sitewide GEO audit JSON file.`);
        if (auditStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoAuditJson} exceeds the 100 MiB input limit.`);
        const auditText = new TextDecoder('utf-8', { fatal: true }).decode(
          fs.readFileSync(args.geoAuditJson)
        );
        const auditValue: unknown = JSON.parse(auditText);
        if (!isSiteWideGeoAnalysis(auditValue))
          throw new Error(
            '--geo-audit-json must contain a version 1 sitewide GEO summary when used for canonical concordance bridging.'
          );
        audit = auditValue;
      }
      const concordance = analyzeGoogleAiCitationConcordance(
        googleExports[0]!,
        answerReport,
        args.geoGoogleAiCitationConcordancePathDepth,
        audit
      );
      let comparison: ReturnType<typeof compareGoogleAiCitationConcordanceReports> | undefined;
      if (args.geoGoogleAiCitationConcordanceBaselineJson) {
        const baselineStats = fs.statSync(args.geoGoogleAiCitationConcordanceBaselineJson);
        if (!baselineStats.isFile())
          throw new Error(
            `${args.geoGoogleAiCitationConcordanceBaselineJson} is not a regular concordance JSON file.`
          );
        if (baselineStats.size > 100 * 1024 * 1024)
          throw new Error(
            `${args.geoGoogleAiCitationConcordanceBaselineJson} exceeds the 100 MiB input limit.`
          );
        const baselineText = new TextDecoder('utf-8', { fatal: true }).decode(
          fs.readFileSync(args.geoGoogleAiCitationConcordanceBaselineJson)
        );
        const baselineValue: unknown = JSON.parse(baselineText);
        if (!isGoogleAiCitationConcordanceReport(baselineValue)) {
          throw new Error(
            '--geo-google-ai-citation-concordance-baseline-json must contain a valid version 1 Google AI citation concordance report.'
          );
        }
        comparison = compareGoogleAiCitationConcordanceReports(baselineValue, concordance);
      }
      const inputFiles = [
        args.geoAnswerObservations,
        googleInput.file,
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
        ...(args.geoGoogleAiCitationConcordanceBaselineJson
          ? [args.geoGoogleAiCitationConcordanceBaselineJson]
          : []),
      ];
      const outputFiles = [
        args.output,
        args.geoGoogleAiCitationConcordanceCsv,
        args.geoGoogleAiCitationConcordanceHtml,
        args.geoGoogleAiCitationConcordancePathFamilyCsv,
        args.geoGoogleAiCitationConcordancePathDepthSweepCsv,
        args.geoGoogleAiCitationConcordanceProviderCsv,
        args.geoGoogleAiCitationConcordanceComparisonCsv,
        args.geoGoogleAiCitationConcordanceComparisonJson,
        args.geoGoogleAiCitationConcordanceComparisonHtml,
        args.geoGoogleAiCitationConcordanceProviderComparisonCsv,
      ].filter((file): file is string => Boolean(file));
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        )
      ) {
        throw new Error('Concordance output paths must differ from both input files.');
      }
      for (let index = 0; index < outputFiles.length; index += 1) {
        if (
          outputFiles
            .slice(index + 1)
            .some((otherFile) => pathsReferToSameFile(outputFiles[index]!, otherFile))
        ) {
          throw new Error(
            'Concordance JSON, CSV, HTML, and path-family outputs must be different files.'
          );
        }
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, JSON.stringify(concordance, null, 2), 'utf8');
      }
      if (args.geoGoogleAiCitationConcordanceCsv) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordanceCsv), { recursive: true });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordanceCsv,
          renderGoogleAiCitationConcordanceCsv(concordance),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordanceHtml) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordanceHtml), { recursive: true });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordanceHtml,
          renderGoogleAiCitationConcordanceHtml(concordance),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordancePathFamilyCsv) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordancePathFamilyCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordancePathFamilyCsv,
          renderGoogleAiCitationConcordancePathFamilyCsv(concordance),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordanceProviderCsv) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordanceProviderCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordanceProviderCsv,
          renderGoogleAiCitationConcordanceProviderCsv(concordance),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordancePathDepthSweepCsv) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordancePathDepthSweepCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordancePathDepthSweepCsv,
          renderGoogleAiCitationConcordancePathDepthSweepCsv(concordance),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordanceComparisonCsv && comparison) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordanceComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordanceComparisonCsv,
          renderGoogleAiCitationConcordanceComparisonCsv(comparison),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordanceComparisonJson && comparison) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordanceComparisonJson), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordanceComparisonJson,
          JSON.stringify(comparison, null, 2),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordanceComparisonHtml && comparison) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordanceComparisonHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordanceComparisonHtml,
          renderGoogleAiCitationConcordanceComparisonHtml(comparison),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordanceProviderComparisonCsv && comparison) {
        fs.mkdirSync(path.dirname(args.geoGoogleAiCitationConcordanceProviderComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoGoogleAiCitationConcordanceProviderComparisonCsv,
          renderGoogleAiCitationConcordanceProviderComparisonCsv(comparison),
          'utf8'
        );
      }
      if (args.geoGoogleAiCitationConcordanceCsv)
        process.stderr.write(
          `Google AI / observed answer citation concordance CSV saved to ${args.geoGoogleAiCitationConcordanceCsv}\n`
        );
      if (args.geoGoogleAiCitationConcordanceHtml)
        process.stderr.write(
          `Google AI / observed answer citation concordance dashboard saved to ${args.geoGoogleAiCitationConcordanceHtml}\n`
        );
      if (args.geoGoogleAiCitationConcordancePathFamilyCsv)
        process.stderr.write(
          `Google AI / observed answer citation path-family CSV saved to ${args.geoGoogleAiCitationConcordancePathFamilyCsv}\n`
        );
      if (args.geoGoogleAiCitationConcordanceProviderCsv)
        process.stderr.write(
          `Google AI / observed answer citation provider CSV saved to ${args.geoGoogleAiCitationConcordanceProviderCsv}\n`
        );
      if (args.geoGoogleAiCitationConcordancePathDepthSweepCsv)
        process.stderr.write(
          `Google AI / observed answer citation path-depth sensitivity CSV saved to ${args.geoGoogleAiCitationConcordancePathDepthSweepCsv}\n`
        );
      if (args.geoGoogleAiCitationConcordanceComparisonCsv)
        process.stderr.write(
          `Google AI / observed answer citation comparison CSV saved to ${args.geoGoogleAiCitationConcordanceComparisonCsv}\n`
        );
      if (args.geoGoogleAiCitationConcordanceComparisonJson)
        process.stderr.write(
          `Google AI / observed answer citation comparison JSON saved to ${args.geoGoogleAiCitationConcordanceComparisonJson}\n`
        );
      if (args.geoGoogleAiCitationConcordanceComparisonHtml)
        process.stderr.write(
          `Google AI / observed answer citation comparison dashboard saved to ${args.geoGoogleAiCitationConcordanceComparisonHtml}\n`
        );
      if (args.geoGoogleAiCitationConcordanceProviderComparisonCsv)
        process.stderr.write(
          `Google AI / observed answer citation provider comparison CSV saved to ${args.geoGoogleAiCitationConcordanceProviderComparisonCsv}\n`
        );
      if (args.output)
        process.stderr.write(
          `Google AI / observed answer citation concordance JSON saved to ${args.output}\n`
        );
    } catch (error) {
      process.stderr.write(
        `❌ Could not build Google AI citation concordance: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 2;
    }
    return;
  }
  if (args.geoAnswerObservations) {
    const allowedOptions = new Set([
      'geoAnswerObservations',
      'geoAnswerBaselineObservations',
      'geoAnswerComparisonCsv',
      'geoAnswerProviderPositionComparisonCsv',
      'geoAnswerCohortsCsv',
      'geoAnswerCohortComparisonCsv',
      'geoAnswerCohortStandardizationCsv',
      'geoAnswerCohortPeriodStandardizationCsv',
      'geoAnswerPromptSamplingPlanCsv',
      'geoAnswerPromptSamplingPlanJson',
      'geoAnswerPromptPlanProviderPairsCsv',
      'geoAnswerExecutionContextCsv',
      'geoAnswerExecutionContextCoverageCsv',
      'geoAnswerExecutionContextComparisonCsv',
      'geoAnswerExecutionContextTrendsCsv',
      'geoAnswerLengthProfilesCsv',
      'geoAnswerLengthComparisonCsv',
      'geoAnswerLengthTrendsCsv',
      'geoAnswerPromptPlanMinPrompts',
      'geoAnswerPromptPlanOwnedReachMargin',
      'geoAnswerPromptPlanMinimumJaccard',
      'geoAnswerPromptPlanMaxPairedGroups',
      'geoAnswerPromptPlanMaxTotalPairedGroups',
      'geoAnswerPromptPlanTotalAllocation',
      'geoAnswerPromptPlanCohortTargets',
      'failOnGeoAnswerPromptPlanMiss',
      'geoAnswerProviderPairsCsv',
      'geoAnswerProviderPromptOverlapCsv',
      'geoAnswerProviderPromptSourceOverlapCsv',
      'geoAnswerSampleMixCsv',
      'geoAnswerTemporalStabilityCsv',
      'geoAnswerSourcePersistenceCsv',
      'geoAnswerCitationUrlPersistenceCsv',
      'geoAnswerCohortTrendsCsv',
      'geoAnswerAuditSignalsCsv',
      'geoAnswerAuditedOwnedPageProviderInventoryCsv',
      'geoAnswerAuditedOwnedPageProviderInventoryHtml',
      'geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv',
      'geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml',
      'geoAnswerAuditedOwnedPageProviderInventoryComparisonJson',
      'geoAnswerAuditedOwnedPagesCsv',
      'geoAnswerAuditedOwnedPageComparisonCsv',
      'geoAnswerAuditedOwnedPageProvidersCsv',
      'geoAnswerAuditedOwnedPageProviderComparisonCsv',
      'geoAnswerSourceCategoriesCsv',
      'geoAnswerSourceCategoryMappingAuditCsv',
      'geoAnswerSourceCategoryComparisonCsv',
      'geoAnswerSourceCategoryMixDecompositionCsv',
      'geoAnswerSourceCategoryMixDecompositionHtml',
      'geoAnswerSourceCategoryConcentrationTrendsCsv',
      'geoAnswerSourceCategoryConcentrationTrendsHtml',
      'geoAnswerSourceCategoryShareTrendsCsv',
      'geoAnswerSourceCategoryShareTrendsHtml',
      'geoAnswerSourceCategoryPromptCoverageCsv',
      'geoAnswerSourceCategoryPromptDetailsCsv',
      'geoAnswerSourceCategoryTrendsCsv',
      'geoAnswerSourceCategoryProviderPairsCsv',
      'geoAnswerSourceCategoryCooccurrenceCsv',
      'geoAnswerSourceCategoryPathFamiliesCsv',
      'geoAnswerSourceCategoryPathFamilyComparisonCsv',
      'geoAnswerSourceCategoriesCsv',
      'geoAnswerCitationPositionsCsv',
      'geoAnswerDomainPromptCoverageCsv',
      'geoAnswerSourceRarefactionCsv',
      'geoAnswerPromptFamilySourceRarefactionCsv',
      'geoAnswerPromptFamilySourceRarefactionHtml',
      'geoAnswerPromptFamilySourceRarefactionSweepCsv',
      'geoAnswerPromptFamilySourceRarefactionSweepHtml',
      'geoAnswerProviderPromptFamilySourceOverlapCsv',
      'geoAnswerProviderPromptFamilySourceOverlapHtml',
      'geoAnswerProviderPromptFamilySourceOverlapSweepCsv',
      'geoAnswerProviderPromptFamilySourceOverlapSweepHtml',
      'geoAnswerPromptFamilyPeriodComparisonCsv',
      'geoAnswerPromptFamilyPeriodComparisonHtml',
      'geoAnswerPromptFamilyPeriodComparisonSweepCsv',
      'geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv',
      'geoAnswerPromptFamilyPeriodComparisonSweepHtml',
      'geoAnswerSourceRarefactionBatchSize',
      'geoAnswerDomainPromptCoverageComparisonCsv',
      'geoAnswerPromptSimilarityCsv',
      'geoAnswerPromptFamiliesCsv',
      'geoAnswerPromptFamiliesHtml',
      'geoAnswerPromptFamilyInfluenceCsv',
      'geoAnswerPromptFamilyInfluenceHtml',
      'geoAnswerPromptFamilyThresholdSweepCsv',
      'geoAnswerPromptFamilyThresholdSweepHtml',
      'geoAnswerPromptFamilyThreshold',
      'geoAnswerDomainPairedReachComparisonCsv',
      'geoAnswerDomainPairedReachComparisonJson',
      'geoAnswerDomainPairedReachGateJson',
      'failOnGeoAnswerDomainPairedReachDrop',
      'failOnGeoAnswerDomainPairedReachAlpha',
      'failOnGeoAnswerDomainPairedReachMinPrompts',
      'geoAnswerSourceDiversityUncertaintyCsv',
      'geoAnswerSourceDiversityUncertaintyHtml',
      'geoAnswerSourceDiversityComparisonCsv',
      'geoAnswerSourceDiversityComparisonHtml',
      'geoAnswerProviderSourceDivergenceCsv',
      'geoAnswerSourcePortfolioDriftCsv',
      'geoAnswerPromptSimilarityThreshold',
      'geoAnswerCitationDateAlignmentCsv',
      'geoAnswerOwnedRankCsv',
      'geoAnswerOwnedPromptCoverageCsv',
      'geoAnswerOwnedPromptReachPeriodCsv',
      'geoAnswerOwnedPromptOpportunitiesCsv',
      'geoAnswerCompetitiveGapsCsv',
      'geoAnswerProviderOwnedGapsCsv',
      'geoAnswerProviderOwnedGapComparisonCsv',
      'geoAnswerCompetitiveGapComparisonCsv',
      'geoAnswerOwnedRankComparisonCsv',
      'geoAnswerOwnedPromptRankComparisonCsv',
      'geoAnswerCoCitationCsv',
      'geoAnswerCoCitationComparisonCsv',
      'geoAnswerEntityMentionsCsv',
      'geoAnswerEntityPromptDetailsCsv',
      'geoAnswerEntityPromptProviderPairsCsv',
      'geoAnswerEntityPromptComparisonCsv',
      'geoAnswerEntityCoMentionsCsv',
      'geoAnswerEntityCoMentionComparisonCsv',
      'geoAnswerEntityCitationDomainsCsv',
      'geoAnswerEntityCitationPagesCsv',
      'geoAnswerEntitySourceCategoriesCsv',
      'geoAnswerEntitySourceCategoryComparisonCsv',
      'geoAnswerEntityCitationDomainComparisonCsv',
      'geoAnswerEntityCitationPageComparisonCsv',
      'geoAnswerEntityCitationPositionComparisonCsv',
      'geoAnswerEntityOpportunitiesCsv',
      'geoAnswerPathDepth',
      'geoAnswerPathFamiliesCsv',
      'geoAnswerPathFamilyCohortsCsv',
      'geoAnswerPathFamilyTrendsCsv',
      'geoAnswerPathFamilyCohortComparisonCsv',
      'geoAnswerPathFamilyComparisonCsv',
      'geoAnswerCrawlerReport',
      'geoAnswerCrawlerOrigin',
      'geoAnswerCrawlerMatchesCsv',
      'geoAnswerEntities',
      'geoAnswerOwnedDomains',
      'failOnGeoAnswerOwnedCitationDrop',
      'failOnGeoAnswerOwnedReachBoundDrop',
      'failOnGeoAnswerIncompleteListShare',
      'failOnGeoAnswerIncompleteListShareRise',
      'failOnGeoAnswerUnknownOwnedObservationShare',
      'failOnGeoAnswerUnknownOwnedPromptShare',
      'failOnGeoAnswerUnknownOwnedStateShareRise',
      'failOnGeoAnswerProviderBalancedCitationDrop',
      'failOnGeoAnswerOwnedPromptCoverageDrop',
      'failOnGeoAnswerCohortOwnedPromptCoverageDrop',
      'failOnGeoAnswerCohortOwnedMrrDrop',
      'failOnGeoAnswerCohortOwnedMrrMinPrompts',
      'failOnGeoAnswerCohortMonthlyOwnedMrrDrop',
      'failOnGeoAnswerCohortMonthlyOwnedMrrMinPrompts',
      'failOnGeoAnswerCohortMonthlyPairedMrrDrop',
      'failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi',
      'failOnGeoAnswerCohortMonthlyPairedMrrMinMatchedPrompts',
      'failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop',
      'failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi',
      'failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline',
      'failOnGeoAnswerCohortMonthlyOwnedPromptCoverageMinMatchedPrompts',
      'failOnGeoAnswerProviderMinMatchedPrompts',
      'failOnGeoAnswerOwnedTopThreeDrop',
      'failOnGeoAnswerOwnedFirstPositionDrop',
      'failOnGeoAnswerOwnedPromptBalancedTopThreeDrop',
      'failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi',
      'failOnGeoAnswerOwnedPromptBalancedFirstPositionDrop',
      'failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi',
      'failOnGeoAnswerOwnedPromptBalancedRankMinMatchedPrompts',
      'failOnGeoAnswerOwnedPromptBalancedMrrDrop',
      'failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi',
      'failOnGeoAnswerLengthOwnedTopThreeDrop',
      'failOnGeoAnswerLengthOwnedTopThreeDropLowerCi',
      'failOnGeoAnswerLengthOwnedFirstPositionDrop',
      'failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi',
      'failOnGeoAnswerLengthOwnedMrrDrop',
      'failOnGeoAnswerLengthOwnedMrrDropLowerCi',
      'failOnGeoAnswerLengthOwnedRankMinMatchedPrompts',
      'failOnGeoAnswerEntityMentionDrop',
      'failOnGeoAnswerEntityOwnedTopThreeDrop',
      'failOnGeoAnswerPathFamilyCoverageDrop',
      'failOnGeoAnswerPathFamilyPromptCoverageDrop',
      'failOnGeoAnswerPathFamilyOverIndexDrop',
      'failOnGeoAnswerEntityPathFamilyPromptCoverageDrop',
      'failOnGeoAnswerEntityPathFamilyTopThreeDrop',
      'failOnGeoAnswerEntityCitationPagePromptCoverageDrop',
      'failOnGeoAnswerEntityCitationPageTopThreeDrop',
      'failOnGeoAnswerEntityPromptMentionDrop',
      'failOnGeoAnswerEntityPromptBalancedMentionDrop',
      'failOnGeoAnswerEntityPromptMinMatchedPrompts',
      'failOnGeoAnswerProviderPromptOverlapBelow',
      'failOnGeoAnswerProviderMinPrompts',
      'failOnGeoAnswerSampleMixDivergence',
      'failOnGeoAnswerCohortStandardizedCitationDrop',
      'failOnGeoAnswerCohortStandardizedOwnedPromptCoverageDrop',
      'geoAuditJson',
      'json',
      'output',
      'html',
    ]);
    allowedOptions.add('geoAuditBaselineJson');
    allowedOptions.add('geoAnswerSourcePortfolioAttributionCsv');
    allowedOptions.add('geoAnswerSourcePortfolioDriftHtml');
    allowedOptions.add('geoAnswerSourcePortfolioDriftJson');
    allowedOptions.add('geoAnswerSourceCategories');
    allowedOptions.add('geoAnswerSourcePortfolioAttributionJson');
    allowedOptions.add('geoAnswerSourcePortfolioAttributionHtml');
    allowedOptions.add('geoAnswerOwnedSourceShareGateCsv');
    allowedOptions.add('geoAnswerOwnedSourceShareGateJson');
    allowedOptions.add('failOnGeoAnswerOwnedSourceShareDrop');
    allowedOptions.add('failOnGeoAnswerOwnedSourceShareDropLowerCi');
    allowedOptions.add('failOnGeoAnswerOwnedSourceShareSignTestAlpha');
    allowedOptions.add('failOnGeoAnswerOwnedSourceShareMinPrompts');
    allowedOptions.add('failOnGeoAnswerSourceCategoryMonthlyJsdAbove');
    allowedOptions.add('failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove');
    allowedOptions.add('failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove');
    allowedOptions.add('failOnGeoAnswerSourceCategoryMonthlyHhiAbove');
    allowedOptions.add('failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove');
    allowedOptions.add('geoAnswerSourceCategoryMonthlyGatesJson');
    allowedOptions.add('failOnGeoAnswerSourceCategoryMonthlyMinEvents');
    allowedOptions.add('failOnGeoAnswerSourceCategoryShareDrop');
    allowedOptions.add('failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove');
    allowedOptions.add('failOnGeoAnswerSourceCategoryPromptBalancedJsdMinPrompts');
    allowedOptions.add('geoAnswerSourceCategoryPromptBalancedJsdGateJson');
    allowedOptions.add('geoAnswerPagePairedReachComparisonCsv');
    allowedOptions.add('geoAnswerPagePairedReachComparisonJson');
    allowedOptions.add('geoAnswerEntityPromptMatchedAssociationCsv');
    allowedOptions.add('geoAnswerEntityPromptMatchedAssociationHtml');
    allowedOptions.add('geoAnswerPageOpportunitiesCsv');
    allowedOptions.add('geoAnswerPageOpportunityTrendsCsv');
    allowedOptions.add('geoAnswerPageOpportunityPathFamiliesCsv');
    allowedOptions.add('geoAnswerPageOpportunityPathFamilyDepthSweepCsv');
    allowedOptions.add('geoAnswerPageOpportunityPathFamilyDepthSweepHtml');
    allowedOptions.add('geoAnswerPageOpportunityPathFamilyTrendsCsv');
    allowedOptions.add('geoAnswerPageOpportunityPathFamilyTrendsHtml');
    allowedOptions.add('geoAnswerPageOpportunityPathDepth');
    allowedOptions.add('failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise');
    allowedOptions.add('failOnGeoAnswerPageOpportunityPathFamilyMonthlyAlpha');
    allowedOptions.add('failOnGeoAnswerPageOpportunityPathFamilyMonthlyMinPrompts');
    allowedOptions.add('geoAnswerPageOpportunityPathFamilyMonthlyGateJson');
    allowedOptions.add('failOnGeoAnswerPageOpportunityMonthlyRise');
    allowedOptions.add('failOnGeoAnswerPageOpportunityMonthlyAlpha');
    allowedOptions.add('failOnGeoAnswerPageOpportunityMonthlyMinPrompts');
    allowedOptions.add('geoAnswerPageOpportunityMonthlyGateJson');
    allowedOptions.add('geoAnswerPagePairedReachOwnedOnly');
    allowedOptions.add('failOnGeoAnswerPagePairedReachDrop');
    allowedOptions.add('failOnGeoAnswerPagePairedReachAlpha');
    allowedOptions.add('failOnGeoAnswerPagePairedReachMinPrompts');
    allowedOptions.add('geoAnswerPagePairedReachMetric');
    allowedOptions.add('geoAnswerPagePairedReachGateJson');
    allowedOptions.add('geoAnswerSourceNetworkComparisonHtml');
    allowedOptions.add('geoAnswerProviderSourceNetworkEdgeDriftHtml');
    allowedOptions.add('geoAnswerSourceNetworkCsv');
    allowedOptions.add('geoAnswerSourceNetworkComparisonCsv');
    allowedOptions.add('geoAnswerRankWeightedSourceNetworkCsv');
    allowedOptions.add('geoAnswerRankWeightedSourceNetworkComparisonCsv');
    allowedOptions.add('geoAnswerSourceNetworkHtml');
    allowedOptions.add('geoAnswerProviderSourceNetworkOverlapCsv');
    allowedOptions.add('geoAnswerProviderSourceNetworkEdgeDriftCsv');
    allowedOptions.add('geoAnswerProviderSourceNetworkEdgeComparisonCsv');
    allowedOptions.add('geoAnswerProviderSourceNetworkEdgeHtml');
    allowedOptions.add('geoAnswerOwnedSourceNetworkGapsCsv');
    allowedOptions.add('geoAnswerEntityPathFamiliesCsv');
    allowedOptions.add('geoAnswerEntityPathFamilyMonthlyCsv');
    allowedOptions.add('geoAnswerEntityPathFamilyComparisonCsv');
    const incompatibleOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ --geo-answer-observations can only be combined with supported observed-answer options, including --geo-answer-source-category-prompt-coverage-csv, --geo-answer-source-category-prompt-details-csv, --geo-answer-source-category-trends-csv, --geo-answer-source-category-provider-pairs-csv, --geo-answer-source-category-cooccurrence-csv, --geo-answer-baseline-observations, --geo-audit-json, --json, --output, and --html.\n'
      );
      process.stderr.write(
        `Incompatible observed-answer options: ${incompatibleOptions.join(', ')}\n`
      );
      process.exit(2);
    }
    try {
      const readObservationInput = (file: string): unknown => {
        const inputStats = fs.statSync(file);
        if (!inputStats.isFile()) throw new Error(`${file} is not a regular JSON file.`);
        if (inputStats.size > 25 * 1024 * 1024)
          throw new Error(`${file} exceeds the 25 MiB input limit.`);
        const inputBytes = fs.readFileSync(file);
        let inputText: string;
        try {
          inputText = new TextDecoder('utf-8', { fatal: true }).decode(inputBytes);
        } catch {
          throw new Error(`${file} is not valid UTF-8 text.`);
        }
        return JSON.parse(inputText) as unknown;
      };
      const inputData = readObservationInput(args.geoAnswerObservations);
      const promptPlanCohortTargets = args.geoAnswerPromptPlanCohortTargets
        ? parseAiAnswerCitationPromptPlanCohortTargets(
            readObservationInput(args.geoAnswerPromptPlanCohortTargets)
          )
        : [];
      let report = analyzeAiAnswerCitationObservations(
        inputData,
        args.geoAnswerOwnedDomains,
        new Date().toISOString(),
        args.geoAnswerEntities,
        {
          ...(args.geoAnswerPathDepth === undefined
            ? {}
            : { pathFamilyDepth: args.geoAnswerPathDepth }),
          ...(args.geoAnswerCitationUrlPersistenceCsv
            ? { includeCitationUrlPersistence: true }
            : {}),
        }
      );
      let baselineReportForAnswer:
        ReturnType<typeof analyzeAiAnswerCitationObservations> | undefined;
      let baselineInputData: unknown;
      if (args.geoAnswerCrawlerReport) {
        if (!args.geoAnswerCrawlerOrigin)
          throw new Error(
            '--geo-answer-crawler-origin is required with --geo-answer-crawler-report.'
          );
        const crawlerReportData = readObservationInput(args.geoAnswerCrawlerReport);
        const crawlerAnalyses = readAiCrawlerAccessLogAnalyses(crawlerReportData);
        if (!crawlerAnalyses)
          throw new Error(
            '--geo-answer-crawler-report must contain a version 1 Aviary crawler report with up to 100 valid analyses.'
          );
        report = correlateAiAnswerCitationObservationsWithCrawlerLogs(
          report,
          crawlerAnalyses,
          args.geoAnswerCrawlerOrigin
        );
      }
      if (args.geoAnswerBaselineObservations) {
        const baselineData = readObservationInput(args.geoAnswerBaselineObservations);
        baselineInputData = baselineData;
        const baselineReport = analyzeAiAnswerCitationObservations(
          baselineData,
          args.geoAnswerOwnedDomains,
          new Date().toISOString(),
          args.geoAnswerEntities,
          args.geoAnswerPathDepth === undefined
            ? undefined
            : { pathFamilyDepth: args.geoAnswerPathDepth }
        );
        baselineReportForAnswer = baselineReport;
        report = {
          ...report,
          periodComparison: compareAiAnswerCitationObservationPeriods(baselineReport, report),
        };
        if (args.failOnGeoAnswerOwnedCitationDrop !== undefined) {
          const coverage = report.periodComparison?.ownedCitationCoverageComparison;
          if (!coverage)
            throw new Error(
              'Owned-citation regression gate requires owned-domain coverage in both samples.'
            );
          const baselineRate =
            coverage.baselineObservationsWithOwnedCitation / coverage.baselineObservations;
          const currentRate =
            coverage.currentObservationsWithOwnedCitation / coverage.currentObservations;
          const changePercentagePoints = (currentRate - baselineRate) * 100;
          process.stderr.write(
            `Owned-citation answer coverage: ${coverage.baselineOwnedCitationCoveragePercent}% → ${coverage.currentOwnedCitationCoveragePercent}% (Δ ${changePercentagePoints > 0 ? '+' : ''}${changePercentagePoints.toFixed(2)} pp; drop threshold ${args.failOnGeoAnswerOwnedCitationDrop} pp).\n`
          );
          if (baselineRate - currentRate > args.failOnGeoAnswerOwnedCitationDrop / 100) {
            process.stderr.write(
              '❌ Owned-citation coverage fell beyond the configured threshold in the supplied answer samples.\n'
            );
            process.exitCode = 1;
          }
        }
        if (args.failOnGeoAnswerOwnedFirstPositionDrop !== undefined) {
          const baselineFirstPositionEvents =
            baselineReport.summary.ownedCitationPositionBuckets
              ?.filter(({ range }) => range === '1')
              .reduce((sum, bucket) => sum + bucket.ownedCitationEvents, 0) ?? 0;
          const currentFirstPositionEvents =
            report.summary.ownedCitationPositionBuckets
              ?.filter(({ range }) => range === '1')
              .reduce((sum, bucket) => sum + bucket.ownedCitationEvents, 0) ?? 0;
          const baselineOwnedEvents = baselineReport.summary.ownedCitationEvents ?? 0;
          const currentOwnedEvents = report.summary.ownedCitationEvents ?? 0;
          if (baselineOwnedEvents === 0 || currentOwnedEvents === 0) {
            process.stderr.write(
              '❌ Owned citation rank-one regression gate is not comparable: both samples need at least one owned citation event.\n'
            );
            process.exitCode = 1;
          } else {
            const baselineRate = baselineFirstPositionEvents / baselineOwnedEvents;
            const currentRate = currentFirstPositionEvents / currentOwnedEvents;
            const changePercentagePoints = (currentRate - baselineRate) * 100;
            process.stderr.write(
              `Owned citation events at rank 1: ${(baselineRate * 100).toFixed(2)}% → ${(currentRate * 100).toFixed(2)}% (Δ ${changePercentagePoints > 0 ? '+' : ''}${changePercentagePoints.toFixed(2)} pp; drop threshold ${args.failOnGeoAnswerOwnedFirstPositionDrop} pp; ${baselineOwnedEvents} → ${currentOwnedEvents} owned events).\n`
            );
            if (baselineRate - currentRate > args.failOnGeoAnswerOwnedFirstPositionDrop / 100) {
              process.stderr.write(
                '❌ Owned citation placement at rank 1 fell beyond the configured threshold in the supplied answer samples.\n'
              );
              process.exitCode = 1;
            }
          }
        }
        if (args.failOnGeoAnswerOwnedTopThreeDrop !== undefined) {
          const position = report.periodComparison?.ownedCitationCoverageComparison;
          const baselineTopThreeEvents =
            baselineReport.summary.ownedCitationPositionBuckets
              ?.filter(({ range }) => range === '1' || range === '2' || range === '3')
              .reduce((sum, bucket) => sum + bucket.ownedCitationEvents, 0) ?? 0;
          const currentTopThreeEvents =
            report.summary.ownedCitationPositionBuckets
              ?.filter(({ range }) => range === '1' || range === '2' || range === '3')
              .reduce((sum, bucket) => sum + bucket.ownedCitationEvents, 0) ?? 0;
          const baselineOwnedEvents = baselineReport.summary.ownedCitationEvents ?? 0;
          const currentOwnedEvents = report.summary.ownedCitationEvents ?? 0;
          if (!position || baselineOwnedEvents === 0 || currentOwnedEvents === 0) {
            process.stderr.write(
              '❌ Owned citation top-three rank regression gate is not comparable: both samples need at least one owned citation event.\n'
            );
            process.exitCode = 1;
          } else {
            const baselineRate = baselineTopThreeEvents / baselineOwnedEvents;
            const currentRate = currentTopThreeEvents / currentOwnedEvents;
            const changePercentagePoints = (currentRate - baselineRate) * 100;
            process.stderr.write(
              `Owned citation events in ranks 1–3: ${position.baselineOwnedTopThreePositionSharePercent ?? 'not available'}% → ${position.currentOwnedTopThreePositionSharePercent ?? 'not available'}% (Δ ${changePercentagePoints > 0 ? '+' : ''}${changePercentagePoints.toFixed(2)} pp; drop threshold ${args.failOnGeoAnswerOwnedTopThreeDrop} pp; ${baselineOwnedEvents} → ${currentOwnedEvents} owned events).\n`
            );
            if (baselineRate - currentRate > args.failOnGeoAnswerOwnedTopThreeDrop / 100) {
              process.stderr.write(
                '❌ Owned citation placement in the top three fell beyond the configured threshold in the supplied answer samples.\n'
              );
              process.exitCode = 1;
            }
          }
        }
        const hasPromptBalancedRankGate =
          args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDrop !== undefined ||
          args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi !== undefined ||
          args.failOnGeoAnswerOwnedPromptBalancedTopThreeDrop !== undefined ||
          args.failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi !== undefined ||
          args.failOnGeoAnswerOwnedPromptBalancedMrrDrop !== undefined ||
          args.failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi !== undefined;
        if (hasPromptBalancedRankGate) {
          const promptRank = report.periodComparison?.ownedPromptRankComparison;
          const usesLowerCi =
            args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi !== undefined ||
            args.failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi !== undefined ||
            args.failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi !== undefined;
          const minimumMatchedPrompts =
            args.failOnGeoAnswerOwnedPromptBalancedRankMinMatchedPrompts ?? (usesLowerCi ? 10 : 2);
          if (!promptRank?.complete || promptRank.pairedExactPrompts < minimumMatchedPrompts) {
            process.stderr.write(
              `❌ Exact-prompt-balanced owned-rank gate is incomplete: uncapped prompt detail and at least ${minimumMatchedPrompts} exact prompts with owned citations in both periods are required${promptRank ? ` (complete=${promptRank.complete}, support=${promptRank.pairedExactPrompts})` : ''}.\n`
            );
            process.exitCode = 1;
          } else {
            const checkPromptRankGate = (
              label: string,
              metric: NonNullable<typeof promptRank.firstPosition>,
              threshold: number | undefined,
              lowerCi: boolean
            ) => {
              if (threshold === undefined) return;
              const drop = lowerCi
                ? metric.pairedPromptBootstrapConfidenceInterval95
                  ? -metric.pairedPromptBootstrapConfidenceInterval95.upperPercentagePoints
                  : null
                : -metric.changePercentagePoints;
              const interval = metric.pairedPromptBootstrapConfidenceInterval95;
              const gateKind = lowerCi
                ? '95% paired-prompt CI lower-bound drop'
                : 'prompt-balanced mean drop';
              process.stderr.write(
                `${label}: ${metric.baselineMeanPercent}% → ${metric.currentMeanPercent}% (Δ ${metric.changePercentagePoints > 0 ? '+' : ''}${metric.changePercentagePoints.toFixed(2)} pp; ${gateKind} ${drop === null ? 'unavailable' : `${drop.toFixed(2)} pp`}; threshold ${threshold} pp; ${promptRank.pairedExactPrompts} prompts${interval ? `; change CI ${interval.lowerPercentagePoints} to ${interval.upperPercentagePoints} pp` : ''}).\n`
              );
              if (drop === null || drop > threshold) {
                process.stderr.write(
                  `❌ Exact-prompt-balanced owned ${label.toLowerCase()} placement fell beyond the configured threshold or lacks paired-prompt interval support.\n`
                );
                process.exitCode = 1;
              }
            };
            checkPromptRankGate(
              'Owned citation rank 1',
              promptRank.firstPosition!,
              args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDrop,
              false
            );
            checkPromptRankGate(
              'Owned citation rank 1',
              promptRank.firstPosition!,
              args.failOnGeoAnswerOwnedPromptBalancedFirstPositionDropLowerCi,
              true
            );
            checkPromptRankGate(
              'Owned citation top three',
              promptRank.topThree!,
              args.failOnGeoAnswerOwnedPromptBalancedTopThreeDrop,
              false
            );
            checkPromptRankGate(
              'Owned citation top three',
              promptRank.topThree!,
              args.failOnGeoAnswerOwnedPromptBalancedTopThreeDropLowerCi,
              true
            );
            checkPromptRankGate(
              'First owned citation mean reciprocal rank',
              promptRank.meanReciprocalRank!,
              args.failOnGeoAnswerOwnedPromptBalancedMrrDrop,
              false
            );
            checkPromptRankGate(
              'First owned citation mean reciprocal rank',
              promptRank.meanReciprocalRank!,
              args.failOnGeoAnswerOwnedPromptBalancedMrrDropLowerCi,
              true
            );
          }
        }
        if (
          args.failOnGeoAnswerLengthOwnedTopThreeDrop !== undefined ||
          args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi !== undefined ||
          args.failOnGeoAnswerLengthOwnedFirstPositionDrop !== undefined ||
          args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi !== undefined ||
          args.failOnGeoAnswerLengthOwnedMrrDrop !== undefined ||
          args.failOnGeoAnswerLengthOwnedMrrDropLowerCi !== undefined
        ) {
          const baselineProfiles = baselineReport.answerLengthProfiles;
          const currentProfiles = report.answerLengthProfiles;
          const baselinePromptRanks = baselineReport.answerLengthPromptRankProfiles;
          const currentPromptRanks = report.answerLengthPromptRankProfiles;
          const sameOwnedDomains =
            JSON.stringify([...baselineReport.ownedDomains].sort()) ===
            JSON.stringify([...report.ownedDomains].sort());
          if (
            !baselineProfiles ||
            !currentProfiles ||
            !baselinePromptRanks ||
            !currentPromptRanks ||
            baselineReport.answerLengthProfilesTruncated ||
            report.answerLengthProfilesTruncated ||
            baselineReport.answerLengthPromptRankProfilesTruncated ||
            report.answerLengthPromptRankProfilesTruncated ||
            !sameOwnedDomains ||
            baselineReport.ownedDomains.length === 0
          ) {
            process.stderr.write(
              '❌ Length-stratified owned-rank gate is not comparable: complete answer-text and prompt-rank profiles plus the same nonempty owned-domain set are required.\n'
            );
            process.exitCode = 1;
          } else {
            const normalizeLabel = (value: string | undefined): string =>
              value?.normalize('NFKC').trim().toLocaleLowerCase('en-US') ?? '';
            const contextBandKey = (profile: {
              provider: string;
              model?: string;
              surface?: string;
              locale?: string;
              topic?: string;
              intent?: string;
              unlabeledTopicIntent: boolean;
              lengthBand: string;
            }): string =>
              JSON.stringify([
                JSON.stringify([
                  normalizeLabel(profile.provider),
                  normalizeLabel(profile.model),
                  normalizeLabel(profile.surface),
                  normalizeLabel(profile.locale),
                  normalizeLabel(profile.topic),
                  normalizeLabel(profile.intent),
                  profile.unlabeledTopicIntent,
                ]),
                profile.lengthBand,
              ]);
            const groupPromptRanks = (
              profiles: typeof baselinePromptRanks
            ): Map<string, Map<string, (typeof baselinePromptRanks)[number]>> => {
              const groups = new Map<string, Map<string, (typeof baselinePromptRanks)[number]>>();
              for (const profile of profiles) {
                const key = contextBandKey(profile);
                const group =
                  groups.get(key) ?? new Map<string, (typeof baselinePromptRanks)[number]>();
                group.set(profile.promptFingerprint, profile);
                groups.set(key, group);
              }
              return groups;
            };
            const baselineRankGroups = groupPromptRanks(baselinePromptRanks);
            const currentRankGroups = groupPromptRanks(currentPromptRanks);
            const baselineByKey = new Map(
              baselineProfiles.map((profile) => [contextBandKey(profile), profile])
            );
            const baselineProfileKeys = new Set(baselineProfiles.map(contextBandKey));
            const currentProfileKeys = new Set(currentProfiles.map(contextBandKey));
            const baselineOnlyProfiles = [...baselineProfileKeys].filter(
              (key) => !currentProfileKeys.has(key)
            ).length;
            const currentOnlyProfiles = [...currentProfileKeys].filter(
              (key) => !baselineProfileKeys.has(key)
            ).length;
            let comparableProfiles = 0;
            let unsupportedMatchedProfiles = 0;
            let failedProfiles = 0;
            let largestObservedDrop: { value: number; profile: string } | undefined;
            let largestFirstPositionDrop: { value: number; profile: string } | undefined;
            let largestOwnedMrrDrop: { value: number; profile: string } | undefined;
            let largestTopThreeLowerBound: { value: number; profile: string } | undefined;
            let largestFirstPositionLowerBound: { value: number; profile: string } | undefined;
            let largestOwnedMrrLowerBound: { value: number; profile: string } | undefined;
            for (const currentProfile of currentProfiles) {
              const groupKey = contextBandKey(currentProfile);
              const baselineProfile = baselineByKey.get(groupKey);
              if (!baselineProfile) continue;
              const before =
                baselineRankGroups.get(groupKey) ??
                new Map<string, (typeof baselinePromptRanks)[number]>();
              const after =
                currentRankGroups.get(groupKey) ??
                new Map<string, (typeof baselinePromptRanks)[number]>();
              const matchedFingerprints = [...before.keys()].filter((fingerprint) =>
                after.has(fingerprint)
              );
              const pairs = matchedFingerprints.flatMap((fingerprint) => {
                const baselinePrompt = before.get(fingerprint)!;
                const currentPrompt = after.get(fingerprint)!;
                return baselinePrompt.ownedCitationEvents > 0 &&
                  currentPrompt.ownedCitationEvents > 0
                  ? [{ baselinePrompt, currentPrompt }]
                  : [];
              });
              const ownedMrrGateConfigured =
                args.failOnGeoAnswerLengthOwnedMrrDrop !== undefined ||
                args.failOnGeoAnswerLengthOwnedMrrDropLowerCi !== undefined;
              const ownedMrrPairs = pairs.flatMap((pair) => {
                const baselineMrr =
                  pair.baselinePrompt.ownedCitationObservations > 0
                    ? (pair.baselinePrompt.ownedFirstCitationReciprocalRankSum /
                        pair.baselinePrompt.ownedCitationObservations) *
                      100
                    : null;
                const currentMrr =
                  pair.currentPrompt.ownedCitationObservations > 0
                    ? (pair.currentPrompt.ownedFirstCitationReciprocalRankSum /
                        pair.currentPrompt.ownedCitationObservations) *
                      100
                    : null;
                return baselineMrr === null || currentMrr === null
                  ? []
                  : [{ ...pair, baselineMrr, currentMrr }];
              });
              const ownedMrrDetailComplete = ownedMrrPairs.length === pairs.length;
              const minimumMatchedPrompts =
                args.failOnGeoAnswerLengthOwnedRankMinMatchedPrompts ??
                (args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi === undefined &&
                args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi === undefined &&
                args.failOnGeoAnswerLengthOwnedMrrDropLowerCi === undefined
                  ? 2
                  : 10);
              if (
                pairs.length < minimumMatchedPrompts ||
                (ownedMrrGateConfigured &&
                  (!ownedMrrDetailComplete || ownedMrrPairs.length < minimumMatchedPrompts))
              ) {
                unsupportedMatchedProfiles += 1;
                continue;
              }
              comparableProfiles += 1;
              const meanTopThreeShare = (
                profiles: typeof pairs,
                key: 'baselinePrompt' | 'currentPrompt'
              ): number =>
                profiles.reduce(
                  (sum, pair) =>
                    sum +
                    (pair[key].ownedTopThreeCitationEvents / pair[key].ownedCitationEvents) * 100,
                  0
                ) / profiles.length;
              const baselineShare = meanTopThreeShare(pairs, 'baselinePrompt');
              const currentShare = meanTopThreeShare(pairs, 'currentPrompt');
              const dropPercentagePoints = baselineShare - currentShare;
              if (!largestObservedDrop || dropPercentagePoints > largestObservedDrop.value) {
                largestObservedDrop = {
                  value: dropPercentagePoints,
                  profile: `${currentProfile.provider}/${currentProfile.lengthBand}`,
                };
              }
              const meanFirstPositionShare = (
                profiles: typeof pairs,
                key: 'baselinePrompt' | 'currentPrompt'
              ): number =>
                profiles.reduce(
                  (sum, pair) =>
                    sum +
                    (pair[key].ownedFirstPositionCitationEvents / pair[key].ownedCitationEvents) *
                      100,
                  0
                ) / profiles.length;
              const baselineFirstPositionShare = meanFirstPositionShare(pairs, 'baselinePrompt');
              const currentFirstPositionShare = meanFirstPositionShare(pairs, 'currentPrompt');
              const firstPositionDropPercentagePoints =
                baselineFirstPositionShare - currentFirstPositionShare;
              if (
                !largestFirstPositionDrop ||
                firstPositionDropPercentagePoints > largestFirstPositionDrop.value
              ) {
                largestFirstPositionDrop = {
                  value: firstPositionDropPercentagePoints,
                  profile: `${currentProfile.provider}/${currentProfile.lengthBand}`,
                };
              }
              const baselineOwnedMrr =
                ownedMrrPairs.length > 0
                  ? ownedMrrPairs.reduce((sum, pair) => sum + pair.baselineMrr, 0) /
                    ownedMrrPairs.length
                  : null;
              const currentOwnedMrr =
                ownedMrrPairs.length > 0
                  ? ownedMrrPairs.reduce((sum, pair) => sum + pair.currentMrr, 0) /
                    ownedMrrPairs.length
                  : null;
              const ownedMrrDropPercentagePoints =
                baselineOwnedMrr === null || currentOwnedMrr === null
                  ? null
                  : baselineOwnedMrr - currentOwnedMrr;
              if (
                ownedMrrDropPercentagePoints !== null &&
                (!largestOwnedMrrDrop || ownedMrrDropPercentagePoints > largestOwnedMrrDrop.value)
              ) {
                largestOwnedMrrDrop = {
                  value: ownedMrrDropPercentagePoints,
                  profile: `${currentProfile.provider}/${currentProfile.lengthBand}`,
                };
              }
              const pairedChangePercentagePoints = pairs.map(
                ({ baselinePrompt, currentPrompt }) =>
                  (currentPrompt.ownedTopThreeCitationEvents / currentPrompt.ownedCitationEvents) *
                    100 -
                  (baselinePrompt.ownedTopThreeCitationEvents /
                    baselinePrompt.ownedCitationEvents) *
                    100
              );
              const changeInterval =
                args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi === undefined
                  ? null
                  : bootstrapPairedMeanDeltaConfidenceInterval95(
                      pairedChangePercentagePoints,
                      `${groupKey}:paired-owned-top-three-share`
                    );
              const dropInterval = changeInterval
                ? { lower: -changeInterval.upper, upper: -changeInterval.lower }
                : null;
              if (
                dropInterval &&
                (!largestTopThreeLowerBound || dropInterval.lower > largestTopThreeLowerBound.value)
              ) {
                largestTopThreeLowerBound = {
                  value: dropInterval.lower,
                  profile: `${currentProfile.provider}/${currentProfile.lengthBand}`,
                };
              }
              const pairedFirstPositionChangePercentagePoints = pairs.map(
                ({ baselinePrompt, currentPrompt }) =>
                  (currentPrompt.ownedFirstPositionCitationEvents /
                    currentPrompt.ownedCitationEvents) *
                    100 -
                  (baselinePrompt.ownedFirstPositionCitationEvents /
                    baselinePrompt.ownedCitationEvents) *
                    100
              );
              const firstPositionChangeInterval =
                args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi === undefined
                  ? null
                  : bootstrapPairedMeanDeltaConfidenceInterval95(
                      pairedFirstPositionChangePercentagePoints,
                      `${groupKey}:paired-owned-first-position-share`
                    );
              const firstPositionDropInterval = firstPositionChangeInterval
                ? {
                    lower: -firstPositionChangeInterval.upper,
                    upper: -firstPositionChangeInterval.lower,
                  }
                : null;
              if (
                firstPositionDropInterval &&
                (!largestFirstPositionLowerBound ||
                  firstPositionDropInterval.lower > largestFirstPositionLowerBound.value)
              ) {
                largestFirstPositionLowerBound = {
                  value: firstPositionDropInterval.lower,
                  profile: `${currentProfile.provider}/${currentProfile.lengthBand}`,
                };
              }
              const ownedMrrChangeInterval =
                args.failOnGeoAnswerLengthOwnedMrrDropLowerCi === undefined
                  ? null
                  : bootstrapPairedMeanDeltaConfidenceInterval95(
                      ownedMrrPairs.map(({ baselineMrr, currentMrr }) => currentMrr - baselineMrr),
                      `${groupKey}:paired-owned-first-citation-mrr`
                    );
              const ownedMrrDropInterval = ownedMrrChangeInterval
                ? { lower: -ownedMrrChangeInterval.upper, upper: -ownedMrrChangeInterval.lower }
                : null;
              if (
                ownedMrrDropInterval &&
                (!largestOwnedMrrLowerBound ||
                  ownedMrrDropInterval.lower > largestOwnedMrrLowerBound.value)
              ) {
                largestOwnedMrrLowerBound = {
                  value: ownedMrrDropInterval.lower,
                  profile: `${currentProfile.provider}/${currentProfile.lengthBand}`,
                };
              }
              const failedPointGate =
                args.failOnGeoAnswerLengthOwnedTopThreeDrop !== undefined &&
                dropPercentagePoints > args.failOnGeoAnswerLengthOwnedTopThreeDrop;
              const failedFirstPositionGate =
                args.failOnGeoAnswerLengthOwnedFirstPositionDrop !== undefined &&
                firstPositionDropPercentagePoints >
                  args.failOnGeoAnswerLengthOwnedFirstPositionDrop;
              const failedLowerCiGate =
                args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi !== undefined &&
                dropInterval !== null &&
                dropInterval.lower > args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi;
              const failedFirstPositionLowerCiGate =
                args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi !== undefined &&
                firstPositionDropInterval !== null &&
                firstPositionDropInterval.lower >
                  args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi;
              const failedOwnedMrrGate =
                args.failOnGeoAnswerLengthOwnedMrrDrop !== undefined &&
                ownedMrrDropPercentagePoints !== null &&
                ownedMrrDropPercentagePoints > args.failOnGeoAnswerLengthOwnedMrrDrop;
              const failedOwnedMrrLowerCiGate =
                args.failOnGeoAnswerLengthOwnedMrrDropLowerCi !== undefined &&
                ownedMrrDropInterval !== null &&
                ownedMrrDropInterval.lower > args.failOnGeoAnswerLengthOwnedMrrDropLowerCi;
              if (
                failedPointGate ||
                failedFirstPositionGate ||
                failedLowerCiGate ||
                failedFirstPositionLowerCiGate ||
                failedOwnedMrrGate ||
                failedOwnedMrrLowerCiGate
              ) {
                failedProfiles += 1;
                const changes = [
                  failedPointGate
                    ? `top-three drop ${dropPercentagePoints.toFixed(2)} pp (baseline ${baselineShare.toFixed(2)}% → current ${currentShare.toFixed(2)}%)`
                    : undefined,
                  failedFirstPositionGate
                    ? `rank-one drop ${firstPositionDropPercentagePoints.toFixed(2)} pp (baseline ${baselineFirstPositionShare.toFixed(2)}% → current ${currentFirstPositionShare.toFixed(2)}%)`
                    : undefined,
                  failedLowerCiGate && dropInterval
                    ? `top-three 95% bootstrap drop interval ${dropInterval.lower.toFixed(2)}–${dropInterval.upper.toFixed(2)} pp`
                    : undefined,
                  failedFirstPositionLowerCiGate && firstPositionDropInterval
                    ? `rank-one 95% bootstrap drop interval ${firstPositionDropInterval.lower.toFixed(2)}–${firstPositionDropInterval.upper.toFixed(2)} pp`
                    : undefined,
                  failedOwnedMrrGate && ownedMrrDropPercentagePoints !== null
                    ? `first-owned-citation MRR drop ${ownedMrrDropPercentagePoints.toFixed(2)} pp (baseline ${baselineOwnedMrr?.toFixed(2)}% → current ${currentOwnedMrr?.toFixed(2)}%)`
                    : undefined,
                  failedOwnedMrrLowerCiGate && ownedMrrDropInterval
                    ? `first-owned-citation MRR 95% bootstrap drop interval ${ownedMrrDropInterval.lower.toFixed(2)}–${ownedMrrDropInterval.upper.toFixed(2)} pp`
                    : undefined,
                ]
                  .filter((change): change is string => change !== undefined)
                  .join('; ');
                process.stderr.write(
                  `❌ Paired-prompt owned-rank regression in ${currentProfile.provider}/${currentProfile.lengthBand}: ${changes}; ${pairs.length} exact prompts had owned citations in both periods.\n`
                );
              }
            }
            const minimumMatchedPrompts =
              args.failOnGeoAnswerLengthOwnedRankMinMatchedPrompts ??
              (args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi === undefined &&
              args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi === undefined &&
              args.failOnGeoAnswerLengthOwnedMrrDropLowerCi === undefined
                ? 2
                : 10);
            const configuredThresholds = [
              args.failOnGeoAnswerLengthOwnedTopThreeDrop === undefined
                ? undefined
                : `top-three point-estimate ${args.failOnGeoAnswerLengthOwnedTopThreeDrop} pp`,
              args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi === undefined
                ? undefined
                : `95% lower bound ${args.failOnGeoAnswerLengthOwnedTopThreeDropLowerCi} pp`,
              args.failOnGeoAnswerLengthOwnedFirstPositionDrop === undefined
                ? undefined
                : `rank-one point-estimate ${args.failOnGeoAnswerLengthOwnedFirstPositionDrop} pp`,
              args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi === undefined
                ? undefined
                : `rank-one 95% lower bound ${args.failOnGeoAnswerLengthOwnedFirstPositionDropLowerCi} pp`,
              args.failOnGeoAnswerLengthOwnedMrrDrop === undefined
                ? undefined
                : `first-owned-citation MRR point-estimate ${args.failOnGeoAnswerLengthOwnedMrrDrop} pp`,
              args.failOnGeoAnswerLengthOwnedMrrDropLowerCi === undefined
                ? undefined
                : `first-owned-citation MRR 95% lower bound ${args.failOnGeoAnswerLengthOwnedMrrDropLowerCi} pp`,
            ]
              .filter((threshold): threshold is string => threshold !== undefined)
              .join(' and ');
            const observedSummary = [
              largestObservedDrop
                ? `largest top-three baseline-minus-current paired mean change ${largestObservedDrop.value.toFixed(2)} pp in ${largestObservedDrop.profile}`
                : undefined,
              largestFirstPositionDrop
                ? `largest rank-one baseline-minus-current paired mean change ${largestFirstPositionDrop.value.toFixed(2)} pp in ${largestFirstPositionDrop.profile}`
                : undefined,
              largestOwnedMrrDrop
                ? `largest first-owned-citation MRR baseline-minus-current paired mean change ${largestOwnedMrrDrop.value.toFixed(2)} pp in ${largestOwnedMrrDrop.profile}`
                : undefined,
              largestTopThreeLowerBound
                ? `largest top-three 95% lower bound ${largestTopThreeLowerBound.value.toFixed(2)} pp in ${largestTopThreeLowerBound.profile}`
                : undefined,
              largestFirstPositionLowerBound
                ? `largest rank-one 95% lower bound ${largestFirstPositionLowerBound.value.toFixed(2)} pp in ${largestFirstPositionLowerBound.profile}`
                : undefined,
              largestOwnedMrrLowerBound
                ? `largest first-owned-citation MRR 95% lower bound ${largestOwnedMrrLowerBound.value.toFixed(2)} pp in ${largestOwnedMrrLowerBound.profile}`
                : undefined,
            ]
              .filter((value): value is string => value !== undefined)
              .join('; ');
            process.stderr.write(
              `Paired-prompt length-stratified owned-rank gate compared ${comparableProfiles} matched answer-length profiles; ${unsupportedMatchedProfiles} matched profiles had fewer than ${minimumMatchedPrompts} shared owned-citation prompts; excluded ${baselineOnlyProfiles} baseline-only and ${currentOnlyProfiles} current-only profiles; ${configuredThresholds}${observedSummary ? `; ${observedSummary}` : ''}.\n`
            );
            if (comparableProfiles === 0) {
              process.stderr.write(
                `❌ Length-stratified owned-rank gate is not comparable: no matched answer-length profile has at least ${minimumMatchedPrompts} exact prompts with owned citations in both periods.\n`
              );
              process.exitCode = 1;
            } else if (unsupportedMatchedProfiles > 0) {
              process.stderr.write(
                `❌ Length-stratified owned-rank gate is incomplete: ${unsupportedMatchedProfiles} matched answer-length profile(s) fell below the ${minimumMatchedPrompts}-prompt support floor.\n`
              );
              process.exitCode = 1;
            } else if (failedProfiles > 0) {
              process.exitCode = 1;
            }
          }
        }
        if (args.failOnGeoAnswerEntityMentionDrop !== undefined) {
          const entities = report.periodComparison?.entityMentionComparison?.entities ?? [];
          if (entities.length === 0) {
            process.stderr.write(
              '❌ Entity-mention regression gate is not comparable: both samples need configured entities with answer-text profiles.\n'
            );
            process.exitCode = 1;
          }
          for (const entity of entities) {
            const baselineRate = entity.baseline?.entityMentionRatePercent;
            const currentRate = entity.current?.entityMentionRatePercent;
            const baselineAnswers = entity.baseline?.observationsWithAnswerText ?? 0;
            const currentAnswers = entity.current?.observationsWithAnswerText ?? 0;
            if (
              baselineRate === null ||
              baselineRate === undefined ||
              currentRate === null ||
              currentRate === undefined ||
              baselineAnswers === 0 ||
              currentAnswers === 0
            ) {
              process.stderr.write(
                `❌ Entity mention rate for ${entity.entity} is not comparable: both samples need answer text.\n`
              );
              process.exitCode = 1;
              continue;
            }
            const changePercentagePoints = currentRate - baselineRate;
            process.stderr.write(
              `Entity mention rate for ${entity.entity}: ${baselineRate}% → ${currentRate}% (Δ ${changePercentagePoints > 0 ? '+' : ''}${changePercentagePoints.toFixed(2)} pp; drop threshold ${args.failOnGeoAnswerEntityMentionDrop} pp; ${baselineAnswers} → ${currentAnswers} answer-text samples).\n`
            );
            if (baselineRate - currentRate > args.failOnGeoAnswerEntityMentionDrop) {
              process.stderr.write(
                `❌ Entity mention rate for ${entity.entity} fell beyond the configured threshold in the supplied answer samples.\n`
              );
              process.exitCode = 1;
            }
          }
        }
        if (args.failOnGeoAnswerEntityOwnedTopThreeDrop !== undefined) {
          const entities = report.periodComparison?.entityMentionComparison?.entities ?? [];
          if (entities.length === 0) {
            process.stderr.write(
              '❌ Entity-owned citation rank gate is not comparable: both samples need configured entities, answer text, and owned-domain citations.\n'
            );
            process.exitCode = 1;
          }
          for (const entity of entities) {
            const baselineSlice = entity.baseline;
            const currentSlice = entity.current;
            const baselinePosition = baselineSlice?.ownedCitationPositionWhenMentioned;
            const currentPosition = currentSlice?.ownedCitationPositionWhenMentioned;
            const baselineRate = baselinePosition?.topThreeCitationSharePercent;
            const currentRate = currentPosition?.topThreeCitationSharePercent;
            if (
              !baselineSlice ||
              !currentSlice ||
              baselineSlice.observationsWithAnswerText === 0 ||
              currentSlice.observationsWithAnswerText === 0 ||
              baselineSlice.observationsMentioningEntity === 0 ||
              currentSlice.observationsMentioningEntity === 0 ||
              !baselinePosition ||
              !currentPosition ||
              baselinePosition.citationEvents === 0 ||
              currentPosition.citationEvents === 0 ||
              baselineRate === null ||
              baselineRate === undefined ||
              currentRate === null ||
              currentRate === undefined
            ) {
              process.stderr.write(
                `❌ Owned citation rank for ${entity.entity} is not comparable: both periods need entity mentions and owned citation events in those answers.\n`
              );
              process.exitCode = 1;
              continue;
            }
            const changePercentagePoints = currentRate - baselineRate;
            process.stderr.write(
              `Owned citation top-three share when ${entity.entity} is mentioned: ${baselineRate}% → ${currentRate}% (Δ ${changePercentagePoints > 0 ? '+' : ''}${changePercentagePoints.toFixed(2)} pp; drop threshold ${args.failOnGeoAnswerEntityOwnedTopThreeDrop} pp; ${baselinePosition.citationEvents} → ${currentPosition.citationEvents} owned events).\n`
            );
            if (baselineRate - currentRate > args.failOnGeoAnswerEntityOwnedTopThreeDrop) {
              process.stderr.write(
                `❌ Owned citation top-three share when ${entity.entity} is mentioned fell beyond the configured threshold in the supplied answer samples.\n`
              );
              process.exitCode = 1;
            }
          }
        }
      }
      if (args.failOnGeoAnswerSampleMixDivergence !== undefined) {
        const mixes = report.providerSampleMixComparisons ?? [];
        if (report.providerSampleMixComparisonsTruncated || mixes.length === 0) {
          process.stderr.write(
            '❌ Provider sample-mix gate is not comparable: it needs at least two provider labels and complete pairwise mix detail.\n'
          );
          process.exitCode = 1;
        } else {
          const divergent = mixes.filter(
            (mix) =>
              mix.normalizedJensenShannonDivergence > args.failOnGeoAnswerSampleMixDivergence!
          );
          process.stderr.write(
            `Provider sample-mix gate checked ${mixes.length} pairs; maximum normalized Jensen–Shannon divergence ${args.failOnGeoAnswerSampleMixDivergence}.\n`
          );
          for (const mix of divergent.slice(0, 10)) {
            process.stderr.write(
              `❌ ${mix.providerA} vs ${mix.providerB}: divergence ${mix.normalizedJensenShannonDivergence} (distance ${mix.jensenShannonDistance}); ${mix.sharedSampleSegments} shared and ${mix.sampleSegmentsOnlyInProviderA + mix.sampleSegmentsOnlyInProviderB} one-sided topic/intent segments.\n`
            );
          }
          if (divergent.length > 10)
            process.stderr.write(
              `… and ${divergent.length - 10} more provider pairs exceeded the sample-mix threshold.\n`
            );
          if (divergent.length > 0) process.exitCode = 1;
        }
      }
      const runCohortStandardizedDropGate = (
        configuredThresholds: string[] | undefined,
        metric: 'citation' | 'owned-prompt'
      ): void => {
        if (!configuredThresholds?.length) return;
        const comparison = report.periodComparison?.topicIntentComparison;
        const cohorts = comparison?.cohorts ?? [];
        const normalizeProvider = (value: string): string =>
          value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
        const unavailable =
          !comparison?.providerCohortCoverageComplete ||
          comparison.cohortsTruncated ||
          cohorts.length === 0;
        for (const configured of configuredThresholds) {
          const separator = configured.lastIndexOf('=');
          const provider = configured.slice(0, separator);
          const threshold = Number(configured.slice(separator + 1));
          const providerCohorts = cohorts.filter(
            (row) => normalizeProvider(row.provider) === normalizeProvider(provider)
          );
          const valuesFor = (row: (typeof cohorts)[number]) =>
            metric === 'citation'
              ? {
                  baselineDenominator: row.baselineObservations,
                  currentDenominator: row.currentObservations,
                  baselineSuccesses: row.baselineObservationsWithCitations,
                  currentSuccesses: row.currentObservationsWithCitations,
                }
              : {
                  baselineDenominator: row.baselineUniquePrompts,
                  currentDenominator: row.currentUniquePrompts,
                  baselineSuccesses: row.baselinePromptsWithOwnedCitation,
                  currentSuccesses: row.currentPromptsWithOwnedCitation,
                };
          const rowsValid =
            providerCohorts.length > 0 &&
            providerCohorts.every((row) => {
              const values = valuesFor(row);
              return (
                Number.isSafeInteger(values.baselineDenominator) &&
                values.baselineDenominator > 0 &&
                Number.isSafeInteger(values.currentDenominator) &&
                values.currentDenominator > 0 &&
                Number.isSafeInteger(values.baselineSuccesses) &&
                values.baselineSuccesses! >= 0 &&
                values.baselineSuccesses! <= values.baselineDenominator! &&
                Number.isSafeInteger(values.currentSuccesses) &&
                values.currentSuccesses! >= 0 &&
                values.currentSuccesses! <= values.currentDenominator!
              );
            });
          if (unavailable || !rowsValid) {
            process.stderr.write(
              `❌ Cohort-standardized ${metric} gate for ${provider} is not comparable: complete matched labeled cohorts with valid denominators are required.\n`
            );
            process.exitCode = 1;
            continue;
          }
          const totalWeight = providerCohorts.reduce((sum, row) => {
            const values = valuesFor(row);
            return sum + values.baselineDenominator! + values.currentDenominator!;
          }, 0);
          const baselineRate = providerCohorts.reduce((sum, row) => {
            const values = valuesFor(row);
            const weight = (values.baselineDenominator! + values.currentDenominator!) / totalWeight;
            return sum + (values.baselineSuccesses! / values.baselineDenominator!) * 100 * weight;
          }, 0);
          const currentRate = providerCohorts.reduce((sum, row) => {
            const values = valuesFor(row);
            const weight = (values.baselineDenominator! + values.currentDenominator!) / totalWeight;
            return sum + (values.currentSuccesses! / values.currentDenominator!) * 100 * weight;
          }, 0);
          const delta = currentRate - baselineRate;
          const weighting =
            metric === 'citation' ? 'pooled period snapshot' : 'pooled exact-prompt';
          process.stderr.write(
            `Cohort-standardized ${metric} gate for ${provider} checked ${providerCohorts.length} matched labeled cohorts using ${weighting} weights: ${baselineRate.toFixed(2)}% → ${currentRate.toFixed(2)}% (Δ ${delta > 0 ? '+' : ''}${delta.toFixed(2)} pp; maximum drop ${threshold.toFixed(2)} pp).\n`
          );
          if (baselineRate - currentRate > threshold) {
            process.stderr.write(
              `❌ Cohort-standardized ${metric} coverage for ${provider} fell beyond the configured threshold.\n`
            );
            process.exitCode = 1;
          }
          if (comparison!.onlyInBaseline.length > 0 || comparison!.onlyInCurrent.length > 0) {
            process.stderr.write(
              `ℹ️ ${comparison!.onlyInBaseline.length + comparison!.onlyInCurrent.length} one-period-only cohorts are excluded from ${provider}'s standardized gate.\n`
            );
          }
        }
      };
      runCohortStandardizedDropGate(args.failOnGeoAnswerCohortStandardizedCitationDrop, 'citation');
      runCohortStandardizedDropGate(
        args.failOnGeoAnswerCohortStandardizedOwnedPromptCoverageDrop,
        'owned-prompt'
      );
      if (args.failOnGeoAnswerProviderPromptOverlapBelow !== undefined) {
        const comparison = getAiAnswerCitationProviderPromptOverlapProfiles(report);
        if (!comparison.complete || comparison.profiles.length === 0) {
          process.stderr.write(
            '❌ Provider prompt-overlap gate is not comparable: it needs at least two providers and an uncapped exact-prompt catalog.\n'
          );
          process.exitCode = 1;
        } else {
          const belowThreshold = comparison.profiles
            .filter(
              (profile) =>
                profile.promptSetJaccard! < args.failOnGeoAnswerProviderPromptOverlapBelow!
            )
            .sort((left, right) => left.promptSetJaccard! - right.promptSetJaccard!);
          process.stderr.write(
            `Provider exact-prompt overlap gate checked ${comparison.profiles.length} provider pairs; minimum prompt-set Jaccard ${args.failOnGeoAnswerProviderPromptOverlapBelow}.\n`
          );
          for (const pair of belowThreshold.slice(0, 10)) {
            process.stderr.write(
              `❌ ${pair.providerA} vs ${pair.providerB}: ${(pair.promptSetJaccard! * 100).toFixed(2)}% Jaccard (${pair.sharedPromptGroups} shared of ${pair.sharedPromptGroups + pair.promptsOnlyInProviderA + pair.promptsOnlyInProviderB} union prompts; ${pair.providerAPromptGroups} and ${pair.providerBPromptGroups} prompts).\n`
            );
          }
          if (belowThreshold.length > 10)
            process.stderr.write(
              `… and ${belowThreshold.length - 10} more provider pairs fell below the exact-prompt overlap threshold.\n`
            );
          if (belowThreshold.length > 0) process.exitCode = 1;
        }
      }
      if (args.failOnGeoAnswerProviderMinPrompts !== undefined) {
        const providers = report.providers;
        if (providers.length === 0 || providers.length !== report.summary.uniqueProviders) {
          process.stderr.write(
            '❌ Provider prompt-support gate is not comparable: complete provider profiles are unavailable.\n'
          );
          process.exitCode = 1;
        } else {
          const belowMinimum = providers.filter(
            (provider) => provider.uniquePrompts < args.failOnGeoAnswerProviderMinPrompts!
          );
          process.stderr.write(
            `Provider prompt-support gate checked ${providers.length} providers; minimum ${args.failOnGeoAnswerProviderMinPrompts} distinct exact prompts per provider.\n`
          );
          for (const provider of belowMinimum.slice(0, 10)) {
            process.stderr.write(
              `❌ ${provider.provider}: ${provider.uniquePrompts} prompt groups across ${provider.observations} snapshots.\n`
            );
          }
          if (belowMinimum.length > 10)
            process.stderr.write(
              `… and ${belowMinimum.length - 10} more providers fell below the exact-prompt support threshold.\n`
            );
          if (belowMinimum.length > 0) process.exitCode = 1;
        }
      }
      if (args.failOnGeoAnswerPathFamilyCoverageDrop !== undefined) {
        const comparison = report.periodComparison?.pathFamilyCohortComparison;
        const comparableRows =
          comparison?.rows.filter(
            (row) =>
              row.sampleState === 'both-periods' &&
              row.observationCoverageChangePercentagePoints !== null
          ) ?? [];
        if (!comparison || !comparison.coverageComplete || comparableRows.length === 0) {
          process.stderr.write(
            '❌ Path-family cohort coverage gate is not comparable: matching path depth, complete retained cohort detail, and at least one family present in both samples are required.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = comparableRows.filter((row) => {
            if (
              !row.baseline ||
              !row.current ||
              row.baseline.cohortObservations === 0 ||
              row.current.cohortObservations === 0
            )
              return false;
            const baselineRate =
              row.baseline.observationsCitingFamily / row.baseline.cohortObservations;
            const currentRate =
              row.current.observationsCitingFamily / row.current.cohortObservations;
            return (baselineRate - currentRate) * 100 > args.failOnGeoAnswerPathFamilyCoverageDrop!;
          });
          process.stderr.write(
            `Path-family cohort coverage gate checked ${comparableRows.length} matched provider/cohort/family rows at depth ${comparison.pathFamilyDepth}; drop threshold ${args.failOnGeoAnswerPathFamilyCoverageDrop} pp.\n`
          );
          if (declines.length > 0) {
            for (const row of declines.slice(0, 10)) {
              process.stderr.write(
                `❌ ${row.provider} · ${row.unlabeled ? 'Unlabeled' : `${row.topic ?? '—'} / ${row.intent ?? '—'}`} · ${row.pathFamily}: ${row.baseline?.observationCoveragePercent}% → ${row.current?.observationCoveragePercent}% (Δ ${row.observationCoverageChangePercentagePoints} pp).\n`
              );
            }
            if (declines.length > 10)
              process.stderr.write(`… and ${declines.length - 10} more path-family declines.\n`);
            process.exitCode = 1;
          }
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only families are shown as sample presence and are excluded from numeric gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerPathFamilyPromptCoverageDrop !== undefined) {
        const comparison = report.periodComparison?.pathFamilyCohortComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) => row.baseline!.cohortUniquePrompts > 0 && row.current!.cohortUniquePrompts > 0
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Path-family prompt-coverage gate is not comparable: it needs complete matched detail and non-empty prompt denominators.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = comparableRows.filter((row) => {
            const baselineRate =
              row.baseline!.uniquePromptsCitingFamily / row.baseline!.cohortUniquePrompts;
            const currentRate =
              row.current!.uniquePromptsCitingFamily / row.current!.cohortUniquePrompts;
            return (
              (baselineRate - currentRate) * 100 > args.failOnGeoAnswerPathFamilyPromptCoverageDrop!
            );
          });
          process.stderr.write(
            `Path-family prompt-coverage gate checked ${comparableRows.length} matched provider/cohort/family rows at depth ${comparison.pathFamilyDepth}; drop threshold ${args.failOnGeoAnswerPathFamilyPromptCoverageDrop} pp.\n`
          );
          for (const row of declines.slice(0, 10)) {
            const baselineRate =
              row.baseline!.uniquePromptsCitingFamily / row.baseline!.cohortUniquePrompts;
            const currentRate =
              row.current!.uniquePromptsCitingFamily / row.current!.cohortUniquePrompts;
            process.stderr.write(
              `❌ ${row.provider} · ${row.unlabeled ? 'Unlabeled' : `${row.topic ?? '—'} / ${row.intent ?? '—'}`} · ${row.pathFamily}: ${row.baseline!.uniquePromptsCitingFamily}/${row.baseline!.cohortUniquePrompts} prompts (${(baselineRate * 100).toFixed(2)}%) → ${row.current!.uniquePromptsCitingFamily}/${row.current!.cohortUniquePrompts} (${(currentRate * 100).toFixed(2)}%; Δ ${((currentRate - baselineRate) * 100).toFixed(2)} pp).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more path-family prompt-coverage declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only families are shown as sample presence and are excluded from numeric gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerPathFamilyOverIndexDrop !== undefined) {
        const comparison = report.periodComparison?.pathFamilyCohortComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) =>
            row.baseline?.citationEventShareBenchmark === 'whole-sample' &&
            row.current?.citationEventShareBenchmark === 'whole-sample' &&
            Number.isFinite(row.baseline.cohortEventShareLiftVsBenchmark) &&
            Number.isFinite(row.current.cohortEventShareLiftVsBenchmark) &&
            (row.baseline.cohortEventShareLiftVsBenchmark ?? 0) > 0
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Path-family over-index gate is not comparable: it needs complete matched detail and whole-sample benchmark ratios for every matched row.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = comparableRows.filter((row) => {
            const baselineRatio = row.baseline!.cohortEventShareLiftVsBenchmark!;
            const currentRatio = row.current!.cohortEventShareLiftVsBenchmark!;
            return (
              (baselineRatio - currentRatio) / baselineRatio >
              args.failOnGeoAnswerPathFamilyOverIndexDrop!
            );
          });
          process.stderr.write(
            `Path-family over-index gate checked ${comparableRows.length} matched provider/cohort/family rows at depth ${comparison.pathFamilyDepth}; maximum relative drop ${args.failOnGeoAnswerPathFamilyOverIndexDrop} (${args.failOnGeoAnswerPathFamilyOverIndexDrop! * 100}%).\n`
          );
          for (const row of declines.slice(0, 10)) {
            const baselineRatio = row.baseline!.cohortEventShareLiftVsBenchmark!;
            const currentRatio = row.current!.cohortEventShareLiftVsBenchmark!;
            const relativeDrop = (baselineRatio - currentRatio) / baselineRatio;
            process.stderr.write(
              `❌ ${row.provider} · ${row.unlabeled ? 'Unlabeled' : `${row.topic ?? '—'} / ${row.intent ?? '—'}`} · ${row.pathFamily}: ${baselineRatio.toFixed(2)}× → ${currentRatio.toFixed(2)}× (${(relativeDrop * 100).toFixed(1)}% relative decline).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more path-family over-index declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only families are shown as sample presence and are excluded from numeric gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerEntityPathFamilyPromptCoverageDrop !== undefined) {
        const comparison = report.periodComparison?.entityPathFamilyComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) =>
            row.baseline!.whenMentioned.uniquePrompts > 0 &&
            row.current!.whenMentioned.uniquePrompts > 0
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Entity path-family prompt-coverage gate is not comparable: matching path depth, complete matched detail, and non-empty entity-mentioned prompt denominators are required.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = comparableRows.filter((row) => {
            const before = row.baseline!.whenMentioned;
            const after = row.current!.whenMentioned;
            return (
              (before.uniquePromptsCitingFamily / before.uniquePrompts -
                after.uniquePromptsCitingFamily / after.uniquePrompts) *
                100 >
              args.failOnGeoAnswerEntityPathFamilyPromptCoverageDrop!
            );
          });
          process.stderr.write(
            `Entity-mentioned path-family prompt-coverage gate checked ${comparableRows.length} matched entity/provider/cohort/family rows at depth ${comparison.pathFamilyDepth}; drop threshold ${args.failOnGeoAnswerEntityPathFamilyPromptCoverageDrop} pp.\n`
          );
          for (const row of declines.slice(0, 10)) {
            const before = row.baseline!.whenMentioned;
            const after = row.current!.whenMentioned;
            const beforeRate = before.uniquePromptsCitingFamily / before.uniquePrompts;
            const afterRate = after.uniquePromptsCitingFamily / after.uniquePrompts;
            process.stderr.write(
              `❌ ${row.entity} · ${row.provider} · ${row.unlabeled ? 'Unlabeled' : `${row.topic ?? '—'} / ${row.intent ?? '—'}`} · ${row.pathFamily}: ${before.uniquePromptsCitingFamily}/${before.uniquePrompts} (${(beforeRate * 100).toFixed(2)}%) → ${after.uniquePromptsCitingFamily}/${after.uniquePrompts} (${(afterRate * 100).toFixed(2)}%; Δ ${((afterRate - beforeRate) * 100).toFixed(2)} pp).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more entity/path-family prompt-coverage declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only entity/path-family rows are sample-presence states and are excluded from numeric gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerEntityPathFamilyTopThreeDrop !== undefined) {
        const comparison = report.periodComparison?.entityPathFamilyComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) =>
            (row.baseline?.whenMentioned.citationEvents ?? 0) > 0 &&
            (row.current?.whenMentioned.citationEvents ?? 0) > 0 &&
            Number.isFinite(
              row.baseline?.whenMentioned.citationListPosition?.topThreeCitationSharePercent
            ) &&
            Number.isFinite(
              row.current?.whenMentioned.citationListPosition?.topThreeCitationSharePercent
            )
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Entity path-family top-three gate is not comparable: matching path depth, complete matched detail, and entity-mentioned citation events in both periods are required.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = comparableRows.filter((row) => {
            const before =
              row.baseline!.whenMentioned.citationListPosition!.topThreeCitationSharePercent;
            const after =
              row.current!.whenMentioned.citationListPosition!.topThreeCitationSharePercent;
            return before - after > args.failOnGeoAnswerEntityPathFamilyTopThreeDrop!;
          });
          process.stderr.write(
            `Entity-mentioned path-family top-three gate checked ${comparableRows.length} matched entity/provider/cohort/family rows at depth ${comparison.pathFamilyDepth}; drop threshold ${args.failOnGeoAnswerEntityPathFamilyTopThreeDrop} pp.\n`
          );
          for (const row of declines.slice(0, 10)) {
            const before =
              row.baseline!.whenMentioned.citationListPosition!.topThreeCitationSharePercent;
            const after =
              row.current!.whenMentioned.citationListPosition!.topThreeCitationSharePercent;
            process.stderr.write(
              `❌ ${row.entity} · ${row.provider} · ${row.unlabeled ? 'Unlabeled' : `${row.topic ?? '—'} / ${row.intent ?? '—'}`} · ${row.pathFamily}: ${before.toFixed(2)}% → ${after.toFixed(2)}% (Δ ${(after - before).toFixed(2)} pp).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more entity/path-family top-three declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only entity/path-family rows are sample-presence states and are excluded from numeric gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerEntityCitationPagePromptCoverageDrop !== undefined) {
        const comparison = report.periodComparison?.entityCitationPageComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) =>
            row.baseline!.whenMentioned.uniquePrompts > 0 &&
            row.current!.whenMentioned.uniquePrompts > 0
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Entity citation-page prompt-coverage gate is not comparable: complete exact-page detail and non-empty entity-mentioned prompt denominators for every matched page are required.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = comparableRows.filter((row) => {
            const before = row.baseline!.whenMentioned;
            const after = row.current!.whenMentioned;
            return (
              (before.uniquePromptsCitingPage / before.uniquePrompts -
                after.uniquePromptsCitingPage / after.uniquePrompts) *
                100 >
              args.failOnGeoAnswerEntityCitationPagePromptCoverageDrop!
            );
          });
          process.stderr.write(
            `Entity-mentioned exact-page prompt-coverage gate checked ${comparableRows.length} matched entity/provider/cohort/URL rows; drop threshold ${args.failOnGeoAnswerEntityCitationPagePromptCoverageDrop} pp.\n`
          );
          for (const row of declines.slice(0, 10)) {
            const before = row.baseline!.whenMentioned;
            const after = row.current!.whenMentioned;
            const beforeRate = before.uniquePromptsCitingPage / before.uniquePrompts;
            const afterRate = after.uniquePromptsCitingPage / after.uniquePrompts;
            process.stderr.write(
              `❌ ${row.entity} · ${row.provider} · ${row.unlabeled ? 'Unlabeled' : `${row.topic ?? '—'} / ${row.intent ?? '—'}`} · ${row.url}: ${before.uniquePromptsCitingPage}/${before.uniquePrompts} (${(beforeRate * 100).toFixed(2)}%) → ${after.uniquePromptsCitingPage}/${after.uniquePrompts} (${(afterRate * 100).toFixed(2)}%; Δ ${((afterRate - beforeRate) * 100).toFixed(2)} pp).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more entity citation-page prompt-coverage declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only entity citation-page rows are sample-presence states and are excluded from numeric gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerEntityCitationPageTopThreeDrop !== undefined) {
        const comparison = report.periodComparison?.entityCitationPageComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) =>
            (row.baseline?.whenMentioned.citationEvents ?? 0) > 0 &&
            (row.current?.whenMentioned.citationEvents ?? 0) > 0 &&
            Number.isFinite(
              row.baseline?.whenMentioned.citationListPosition?.topThreeCitationSharePercent
            ) &&
            Number.isFinite(
              row.current?.whenMentioned.citationListPosition?.topThreeCitationSharePercent
            )
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Entity citation-page top-three gate is not comparable: complete exact-page detail and entity-mentioned citation events on every matched URL in both periods are required.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = comparableRows.filter(
            (row) =>
              row.baseline!.whenMentioned.citationListPosition!.topThreeCitationSharePercent -
                row.current!.whenMentioned.citationListPosition!.topThreeCitationSharePercent >
              args.failOnGeoAnswerEntityCitationPageTopThreeDrop!
          );
          process.stderr.write(
            `Entity-mentioned exact-page top-three gate checked ${comparableRows.length} matched entity/provider/cohort/URL rows; drop threshold ${args.failOnGeoAnswerEntityCitationPageTopThreeDrop} pp.\n`
          );
          for (const row of declines.slice(0, 10)) {
            const before =
              row.baseline!.whenMentioned.citationListPosition!.topThreeCitationSharePercent;
            const after =
              row.current!.whenMentioned.citationListPosition!.topThreeCitationSharePercent;
            process.stderr.write(
              `❌ ${row.entity} · ${row.provider} · ${row.unlabeled ? 'Unlabeled' : `${row.topic ?? '—'} / ${row.intent ?? '—'}`} · ${row.url}: ${before.toFixed(2)}% → ${after.toFixed(2)}% (Δ ${(after - before).toFixed(2)} pp).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more entity citation-page top-three declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only entity citation-page rows are sample-presence states and are excluded from numeric gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerEntityPromptMentionDrop !== undefined) {
        const comparison = report.periodComparison?.entityPromptComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) =>
            row.baseline!.observationsWithAnswerText > 0 &&
            row.current!.observationsWithAnswerText > 0
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Entity prompt mention gate is not comparable: complete matched prompt/provider detail and answer text on both sides of every matched row are required.\n'
          );
          process.exitCode = 1;
        } else {
          const byEntity = new Map<
            string,
            {
              baselineMentions: number;
              baselineAnswers: number;
              currentMentions: number;
              currentAnswers: number;
            }
          >();
          for (const row of comparableRows) {
            const totals = byEntity.get(row.entity) ?? {
              baselineMentions: 0,
              baselineAnswers: 0,
              currentMentions: 0,
              currentAnswers: 0,
            };
            totals.baselineMentions += row.baseline!.observationsMentioningEntity;
            totals.baselineAnswers += row.baseline!.observationsWithAnswerText;
            totals.currentMentions += row.current!.observationsMentioningEntity;
            totals.currentAnswers += row.current!.observationsWithAnswerText;
            byEntity.set(row.entity, totals);
          }
          const declines = [...byEntity.entries()]
            .map(([entity, totals]) => {
              const baselineRate = (totals.baselineMentions / totals.baselineAnswers) * 100;
              const currentRate = (totals.currentMentions / totals.currentAnswers) * 100;
              return {
                entity,
                ...totals,
                baselineRate,
                currentRate,
                delta: currentRate - baselineRate,
              };
            })
            .filter((row) => -row.delta > args.failOnGeoAnswerEntityPromptMentionDrop!);
          process.stderr.write(
            `Entity prompt mention gate checked ${comparableRows.length} matched prompt/provider rows across ${byEntity.size} entities; pooled snapshot-weighted drop threshold ${args.failOnGeoAnswerEntityPromptMentionDrop} pp.\n`
          );
          for (const row of declines.slice(0, 10)) {
            process.stderr.write(
              `❌ ${row.entity}: ${row.baselineMentions}/${row.baselineAnswers} (${row.baselineRate.toFixed(2)}%) → ${row.currentMentions}/${row.currentAnswers} (${row.currentRate.toFixed(2)}%; Δ ${row.delta.toFixed(2)} pp).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more entity prompt mention declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only entity prompt rows are sample-presence states and are excluded from pooled gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerEntityPromptBalancedMentionDrop !== undefined) {
        const comparison = report.periodComparison?.entityPromptComparison;
        const matchedRows =
          comparison?.rows.filter(
            (row) => row.sampleState === 'both-periods' && row.baseline && row.current
          ) ?? [];
        const comparableRows = matchedRows.filter(
          (row) =>
            row.baseline!.observationsWithAnswerText > 0 &&
            row.current!.observationsWithAnswerText > 0 &&
            row.baseline!.entityMentionRatePercent !== null &&
            row.current!.entityMentionRatePercent !== null
        );
        if (
          !comparison ||
          !comparison.coverageComplete ||
          comparison.rowsTruncated ||
          comparableRows.length === 0 ||
          comparableRows.length !== matchedRows.length
        ) {
          process.stderr.write(
            '❌ Equal-prompt entity mention gate is not comparable: complete matched prompt/provider detail and answer text on both sides of every matched row are required.\n'
          );
          process.exitCode = 1;
        } else {
          const byEntity = new Map<
            string,
            { baselineRateTotal: number; currentRateTotal: number; rows: number }
          >();
          for (const row of comparableRows) {
            const totals = byEntity.get(row.entity) ?? {
              baselineRateTotal: 0,
              currentRateTotal: 0,
              rows: 0,
            };
            totals.baselineRateTotal += row.baseline!.entityMentionRatePercent!;
            totals.currentRateTotal += row.current!.entityMentionRatePercent!;
            totals.rows += 1;
            byEntity.set(row.entity, totals);
          }
          const declines = [...byEntity.entries()]
            .map(([entity, totals]) => {
              const baselineMeanRate = totals.baselineRateTotal / totals.rows;
              const currentMeanRate = totals.currentRateTotal / totals.rows;
              return {
                entity,
                rows: totals.rows,
                baselineMeanRate,
                currentMeanRate,
                meanDelta: currentMeanRate - baselineMeanRate,
              };
            })
            .filter((row) => -row.meanDelta > args.failOnGeoAnswerEntityPromptBalancedMentionDrop!);
          process.stderr.write(
            `Equal-prompt entity mention gate checked ${comparableRows.length} matched prompt/provider rows across ${byEntity.size} entities; mean drop threshold ${args.failOnGeoAnswerEntityPromptBalancedMentionDrop} pp.\n`
          );
          for (const row of declines.slice(0, 10)) {
            process.stderr.write(
              `❌ ${row.entity}: ${row.baselineMeanRate.toFixed(2)}% → ${row.currentMeanRate.toFixed(2)}% (equal-prompt/provider mean Δ ${row.meanDelta.toFixed(2)} pp across ${row.rows} matched rows).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more entity prompt-balanced mention declines.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.rows.some((row) => row.sampleState !== 'both-periods')) {
            process.stderr.write(
              'ℹ️ One-period-only entity prompt rows are sample-presence states and are excluded from prompt-balanced gate deltas.\n'
            );
          }
        }
      }
      if (args.failOnGeoAnswerProviderBalancedCitationDrop !== undefined) {
        const comparison = report.periodComparison;
        const matchedRows = comparison?.prompts ?? [];
        const allProviderProfiles = [
          ...(baselineReportForAnswer?.providers ?? []),
          ...report.providers,
        ];
        const providerKey = (provider: string): string =>
          provider.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
        const providers = new Map(
          allProviderProfiles.map((profile) => [providerKey(profile.provider), profile.provider])
        );
        const matchedProviderKeys = new Set(matchedRows.map((row) => providerKey(row.provider)));
        const providerProfilesComplete =
          Boolean(baselineReportForAnswer) &&
          baselineReportForAnswer!.providers.length ===
            baselineReportForAnswer!.summary.uniqueProviders &&
          report.providers.length === report.summary.uniqueProviders;
        if (
          !comparison?.providerPromptCoverageComplete ||
          comparison.promptsTruncated ||
          matchedRows.length === 0 ||
          !providerProfilesComplete ||
          [...providers.keys()].some((key) => !matchedProviderKeys.has(key))
        ) {
          process.stderr.write(
            '❌ Provider-balanced citation coverage gate is not comparable: complete matched provider/exact-prompt detail is required in both periods.\n'
          );
          process.exitCode = 1;
        } else {
          const byProvider = new Map<
            string,
            { provider: string; baselineTotal: number; currentTotal: number; prompts: number }
          >();
          for (const row of matchedRows) {
            const key = row.provider
              .normalize('NFKC')
              .replace(/\s+/gu, ' ')
              .trim()
              .toLocaleLowerCase('en-US');
            const totals = byProvider.get(key) ?? {
              provider: row.provider,
              baselineTotal: 0,
              currentTotal: 0,
              prompts: 0,
            };
            totals.baselineTotal +=
              (row.baselineObservationsWithCitations / row.baselineObservations) * 100;
            totals.currentTotal +=
              (row.currentObservationsWithCitations / row.currentObservations) * 100;
            totals.prompts += 1;
            byProvider.set(key, totals);
          }
          const providerChanges = [...byProvider.values()].map((totals) => {
            const baselineMean = totals.baselineTotal / totals.prompts;
            const currentMean = totals.currentTotal / totals.prompts;
            return { ...totals, baselineMean, currentMean, delta: currentMean - baselineMean };
          });
          process.stderr.write(
            `Provider-balanced citation-coverage gate checked ${matchedRows.length} matched provider/prompt rows across ${providerChanges.length} providers; threshold ${args.failOnGeoAnswerProviderBalancedCitationDrop} pp. Each prompt has equal weight within its provider.\n`
          );
          for (const item of providerChanges) {
            process.stderr.write(
              `${item.delta < -args.failOnGeoAnswerProviderBalancedCitationDrop ? '❌ ' : '✓ '}${item.provider}: ${item.baselineMean.toFixed(2)}% → ${item.currentMean.toFixed(2)}% (equal-prompt Δ ${item.delta > 0 ? '+' : ''}${item.delta.toFixed(2)} pp across ${item.prompts} shared prompts).\n`
            );
          }
          if (
            providerChanges.some(
              (item) => -item.delta > args.failOnGeoAnswerProviderBalancedCitationDrop!
            )
          ) {
            process.stderr.write(
              '❌ At least one provider’s equal-prompt citation coverage fell beyond the configured threshold.\n'
            );
            process.exitCode = 1;
          }
        }
      }
      if (args.failOnGeoAnswerOwnedPromptCoverageDrop !== undefined) {
        const comparison = report.periodComparison;
        const matchedRows = comparison?.prompts ?? [];
        const allProviderProfiles = [
          ...(baselineReportForAnswer?.providers ?? []),
          ...report.providers,
        ];
        const providerKey = (provider: string): string =>
          provider.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
        const providers = new Map(
          allProviderProfiles.map((profile) => [providerKey(profile.provider), profile.provider])
        );
        const matchedProviderKeys = new Set(matchedRows.map((row) => providerKey(row.provider)));
        const providerProfilesComplete =
          Boolean(baselineReportForAnswer) &&
          baselineReportForAnswer!.providers.length ===
            baselineReportForAnswer!.summary.uniqueProviders &&
          report.providers.length === report.summary.uniqueProviders;
        const ownedMetricsComplete = matchedRows.every(
          (row) =>
            row.baselineObservationsWithOwnedCitation !== undefined &&
            row.currentObservationsWithOwnedCitation !== undefined
        );
        if (
          !comparison?.providerPromptCoverageComplete ||
          comparison.promptsTruncated ||
          matchedRows.length === 0 ||
          !providerProfilesComplete ||
          !ownedMetricsComplete ||
          [...providers.keys()].some((key) => !matchedProviderKeys.has(key))
        ) {
          process.stderr.write(
            '❌ Owned-citation prompt-coverage gate is not comparable: owned domains and complete matched provider/exact-prompt detail are required in both periods.\n'
          );
          process.exitCode = 1;
        } else {
          const byProvider = new Map<
            string,
            {
              provider: string;
              baselineOwnedPrompts: number;
              currentOwnedPrompts: number;
              sharedPrompts: number;
            }
          >();
          for (const row of matchedRows) {
            const key = providerKey(row.provider);
            const totals = byProvider.get(key) ?? {
              provider: row.provider,
              baselineOwnedPrompts: 0,
              currentOwnedPrompts: 0,
              sharedPrompts: 0,
            };
            totals.baselineOwnedPrompts += row.baselineObservationsWithOwnedCitation! > 0 ? 1 : 0;
            totals.currentOwnedPrompts += row.currentObservationsWithOwnedCitation! > 0 ? 1 : 0;
            totals.sharedPrompts += 1;
            byProvider.set(key, totals);
          }
          const providerChanges = [...byProvider.values()].map((totals) => {
            const baselineRate = (totals.baselineOwnedPrompts / totals.sharedPrompts) * 100;
            const currentRate = (totals.currentOwnedPrompts / totals.sharedPrompts) * 100;
            return { ...totals, baselineRate, currentRate, delta: currentRate - baselineRate };
          });
          process.stderr.write(
            `Owned-citation prompt-coverage gate checked ${matchedRows.length} matched provider/prompt rows across ${providerChanges.length} providers; threshold ${args.failOnGeoAnswerOwnedPromptCoverageDrop} pp. Each exact prompt counts once.\n`
          );
          for (const item of providerChanges) {
            process.stderr.write(
              `${item.delta < -args.failOnGeoAnswerOwnedPromptCoverageDrop ? '❌ ' : '✓ '}${item.provider}: ${item.baselineOwnedPrompts}/${item.sharedPrompts} prompts (${item.baselineRate.toFixed(2)}%) → ${item.currentOwnedPrompts}/${item.sharedPrompts} (${item.currentRate.toFixed(2)}%; Δ ${item.delta > 0 ? '+' : ''}${item.delta.toFixed(2)} pp).\n`
            );
          }
          if (
            providerChanges.some(
              (item) => -item.delta > args.failOnGeoAnswerOwnedPromptCoverageDrop!
            )
          ) {
            process.stderr.write(
              '❌ At least one provider’s distinct-prompt owned-citation coverage fell beyond the configured threshold.\n'
            );
            process.exitCode = 1;
          }
        }
      }
      if (args.failOnGeoAnswerOwnedReachBoundDrop !== undefined) {
        const comparison = report.periodComparison;
        const bounds = comparison?.ownedCitationReachCompletenessBounds;
        const allProviderProfiles = [
          ...(baselineReportForAnswer?.providers ?? []),
          ...report.providers,
        ];
        const providerKey = (provider: string): string =>
          provider.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
        const expectedProviders = new Set(
          allProviderProfiles.map((profile) => providerKey(profile.provider))
        );
        const comparedProviders = new Set(
          bounds?.providerComparisons.map((item) => providerKey(item.provider)) ?? []
        );
        const providerProfilesComplete =
          Boolean(baselineReportForAnswer) &&
          baselineReportForAnswer!.providers.length ===
            baselineReportForAnswer!.summary.uniqueProviders &&
          report.providers.length === report.summary.uniqueProviders;
        const enoughSupport =
          Boolean(bounds?.providerComparisons.length) &&
          bounds!.providerComparisons.every((item) => item.sharedProviderPromptGroups >= 2);
        if (
          !bounds?.complete ||
          !comparison?.providerPromptCoverageComplete ||
          comparison.promptsTruncated ||
          !providerProfilesComplete ||
          bounds.sharedProviderPromptGroups === 0 ||
          !enoughSupport ||
          [...expectedProviders].some((key) => !comparedProviders.has(key))
        ) {
          process.stderr.write(
            '❌ Owned-reach completeness-bound gate is not comparable: uncapped matched provider/prompt detail, complete provider profiles, and at least two matched prompts for every provider are required.\n'
          );
          process.exitCode = 1;
        } else {
          process.stderr.write(
            `Owned-reach completeness-bound gate checked ${bounds.sharedProviderPromptGroups} matched provider/prompt groups across ${bounds.providerComparisons.length} providers; threshold ${args.failOnGeoAnswerOwnedReachBoundDrop} pp. It fails only when even the optimistic current-minus-baseline bound exceeds the decline threshold.\n`
          );
          for (const item of bounds.providerComparisons) {
            const lower = item.changeLowerBoundPercentagePoints;
            const upper = item.changeUpperBoundPercentagePoints;
            const declineConfirmed =
              upper !== null && upper < -args.failOnGeoAnswerOwnedReachBoundDrop;
            process.stderr.write(
              `${declineConfirmed ? '❌ ' : '✓ '}${item.provider}: reach change bound ${lower === null ? 'n/a' : `${lower > 0 ? '+' : ''}${lower.toFixed(2)}`} to ${upper === null ? 'n/a' : `${upper > 0 ? '+' : ''}${upper.toFixed(2)}`} pp across ${item.sharedProviderPromptGroups} matched prompts (${item.unknownBaselineGroups} baseline and ${item.unknownCurrentGroups} current unknown groups).\n`
            );
          }
          if (
            bounds.providerComparisons.some(
              (item) =>
                item.changeUpperBoundPercentagePoints !== null &&
                item.changeUpperBoundPercentagePoints < -args.failOnGeoAnswerOwnedReachBoundDrop!
            )
          ) {
            process.stderr.write(
              '❌ At least one provider’s owned-citation reach declined beyond the configured threshold under every state assignment consistent with captured source-list completeness.\n'
            );
            process.exitCode = 1;
          }
        }
      }
      if (args.failOnGeoAnswerCohortOwnedPromptCoverageDrop !== undefined) {
        const comparison = report.periodComparison?.topicIntentComparison;
        const matchedCohorts = comparison?.cohorts ?? [];
        const cohortMetricsComplete = matchedCohorts.every(
          (row) =>
            Number.isSafeInteger(row.baselinePromptsWithOwnedCitation) &&
            Number.isSafeInteger(row.currentPromptsWithOwnedCitation) &&
            row.baselinePromptsWithOwnedCitation! >= 0 &&
            row.currentPromptsWithOwnedCitation! >= 0 &&
            row.baselinePromptsWithOwnedCitation! <= row.baselineUniquePrompts &&
            row.currentPromptsWithOwnedCitation! <= row.currentUniquePrompts &&
            row.baselineUniquePrompts > 0 &&
            row.currentUniquePrompts > 0 &&
            row.baselineOwnedCitationPromptCoveragePercent !== undefined &&
            Number.isFinite(row.baselineOwnedCitationPromptCoveragePercent) &&
            row.baselineOwnedCitationPromptCoveragePercent >= 0 &&
            row.baselineOwnedCitationPromptCoveragePercent <= 100 &&
            row.currentOwnedCitationPromptCoveragePercent !== undefined &&
            Number.isFinite(row.currentOwnedCitationPromptCoveragePercent) &&
            row.currentOwnedCitationPromptCoveragePercent >= 0 &&
            row.currentOwnedCitationPromptCoveragePercent <= 100 &&
            row.ownedCitationPromptCoverageChangePercentagePoints !== undefined &&
            Number.isFinite(row.ownedCitationPromptCoverageChangePercentagePoints)
        );
        if (
          !comparison?.providerCohortCoverageComplete ||
          comparison.cohortsTruncated ||
          matchedCohorts.length === 0 ||
          !cohortMetricsComplete
        ) {
          process.stderr.write(
            '❌ Cohort owned-citation prompt-coverage gate is not comparable: owned domains, complete retained cohort detail, and owned-cited prompt reach for at least one matched topic/intent/provider cohort are required.\n'
          );
          process.exitCode = 1;
        } else {
          const declines = matchedCohorts.filter(
            (row) =>
              row.ownedCitationPromptCoverageChangePercentagePoints! <
              -args.failOnGeoAnswerCohortOwnedPromptCoverageDrop!
          );
          process.stderr.write(
            `Cohort owned-citation prompt-reach gate checked ${matchedCohorts.length} matched topic/intent/provider cohorts; threshold ${args.failOnGeoAnswerCohortOwnedPromptCoverageDrop} pp. Each period uses its own unique-prompt denominator, so the comparison is sample-mix-sensitive.\n`
          );
          for (const row of declines.slice(0, 10)) {
            process.stderr.write(
              `❌ ${row.provider} · ${row.topic ?? 'Unlabeled'} / ${row.intent ?? 'Unlabeled'}: ${row.baselinePromptsWithOwnedCitation}/${row.baselineUniquePrompts} prompts (${row.baselineOwnedCitationPromptCoveragePercent!.toFixed(2)}%) → ${row.currentPromptsWithOwnedCitation}/${row.currentUniquePrompts} (${row.currentOwnedCitationPromptCoveragePercent!.toFixed(2)}%; Δ ${row.ownedCitationPromptCoverageChangePercentagePoints!.toFixed(2)} pp).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more topic/intent/provider cohorts exceeded the threshold.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.onlyInBaseline.length > 0 || comparison.onlyInCurrent.length > 0) {
            process.stderr.write(
              `ℹ️ ${comparison.onlyInBaseline.length + comparison.onlyInCurrent.length} one-period-only cohorts are excluded from numeric gate deltas.\n`
            );
          }
        }
      }
      if (args.failOnGeoAnswerCohortOwnedMrrDrop !== undefined) {
        const comparison = report.periodComparison?.topicIntentComparison;
        const matchedCohorts = comparison?.cohorts ?? [];
        const minimumPrompts = args.failOnGeoAnswerCohortOwnedMrrMinPrompts ?? 2;
        const supportShortfalls = matchedCohorts.filter(
          (row) =>
            (row.baselinePromptsWithOwnedCitation ?? 0) < minimumPrompts ||
            (row.currentPromptsWithOwnedCitation ?? 0) < minimumPrompts
        );
        const cohortMetricsComplete = matchedCohorts.every(
          (row) =>
            Number.isSafeInteger(row.baselinePromptsWithOwnedCitation) &&
            Number.isSafeInteger(row.currentPromptsWithOwnedCitation) &&
            row.baselinePromptsWithOwnedCitation! >= minimumPrompts &&
            row.currentPromptsWithOwnedCitation! >= minimumPrompts &&
            row.baselineEqualPromptMeanOwnedFirstCitationMrrPercent !== undefined &&
            Number.isFinite(row.baselineEqualPromptMeanOwnedFirstCitationMrrPercent) &&
            row.currentEqualPromptMeanOwnedFirstCitationMrrPercent !== undefined &&
            Number.isFinite(row.currentEqualPromptMeanOwnedFirstCitationMrrPercent) &&
            row.equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints !== undefined &&
            row.equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints !== null &&
            Number.isFinite(row.equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints) &&
            Math.abs(
              row.equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints -
                (row.currentEqualPromptMeanOwnedFirstCitationMrrPercent! -
                  row.baselineEqualPromptMeanOwnedFirstCitationMrrPercent!)
            ) <= 0.011
        );
        if (
          !comparison?.providerCohortCoverageComplete ||
          comparison.cohortsTruncated ||
          matchedCohorts.length === 0 ||
          !cohortMetricsComplete
        ) {
          process.stderr.write(
            `❌ Cohort first-owned-citation MRR gate is not comparable: complete retained cohort detail and at least ${minimumPrompts} owned-cited prompts in each period for every matched provider/cohort are required.\n`
          );
          for (const row of supportShortfalls.slice(0, 10)) {
            process.stderr.write(
              `  ${row.provider} · ${row.topic ?? 'Unlabeled'} / ${row.intent ?? 'Unlabeled'}: owned-cited prompt support ${row.baselinePromptsWithOwnedCitation ?? 'unavailable'} baseline, ${row.currentPromptsWithOwnedCitation ?? 'unavailable'} current.\n`
            );
          }
          if (supportShortfalls.length > 10)
            process.stderr.write(
              `  … and ${supportShortfalls.length - 10} more provider/cohort rows below the support floor.\n`
            );
          process.exitCode = 1;
        } else {
          const declines = matchedCohorts.filter(
            (row) =>
              row.equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints! <
              -args.failOnGeoAnswerCohortOwnedMrrDrop!
          );
          process.stderr.write(
            `Cohort first-owned-citation MRR gate checked ${matchedCohorts.length} matched topic/intent/provider cohorts; threshold ${args.failOnGeoAnswerCohortOwnedMrrDrop} pp; minimum ${minimumPrompts} owned-cited prompts per period. Prompt sets are balanced independently and can differ.\n`
          );
          for (const row of declines.slice(0, 10)) {
            process.stderr.write(
              `❌ ${row.provider} · ${row.topic ?? 'Unlabeled'} / ${row.intent ?? 'Unlabeled'}: ${row.baselineEqualPromptMeanOwnedFirstCitationMrrPercent!.toFixed(2)}% → ${row.currentEqualPromptMeanOwnedFirstCitationMrrPercent!.toFixed(2)}% (Δ ${row.equalPromptMeanOwnedFirstCitationMrrChangePercentagePoints!.toFixed(2)} pp; ${row.baselinePromptsWithOwnedCitation}/${row.currentPromptsWithOwnedCitation} owned-cited prompts).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more topic/intent/provider cohorts exceeded the threshold.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
          if (comparison.onlyInBaseline.length > 0 || comparison.onlyInCurrent.length > 0) {
            process.stderr.write(
              `ℹ️ ${comparison.onlyInBaseline.length + comparison.onlyInCurrent.length} one-period-only cohorts are excluded from numeric gate deltas.\n`
            );
          }
        }
      }
      if (args.failOnGeoAnswerProviderMinMatchedPrompts !== undefined) {
        const comparison = report.periodComparison;
        const baselineProviders = baselineReportForAnswer?.providers ?? [];
        const currentProviders = report.providers;
        const providerProfilesComplete =
          Boolean(baselineReportForAnswer) &&
          baselineProviders.length === baselineReportForAnswer!.summary.uniqueProviders &&
          currentProviders.length === report.summary.uniqueProviders;
        const complete =
          Boolean(comparison?.providerPromptCoverageComplete) &&
          !comparison!.promptsTruncated &&
          providerProfilesComplete;
        if (!complete) {
          process.stderr.write(
            '❌ Provider matched-prompt support gate is not comparable: complete provider profiles and uncapped matched prompt detail are required.\n'
          );
          process.exitCode = 1;
        } else {
          const providerKey = (provider: string): string =>
            provider.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
          const providers = new Map(
            [...baselineProviders, ...currentProviders].map((profile) => [
              providerKey(profile.provider),
              profile.provider,
            ])
          );
          const matchedPromptCounts = new Map<string, Set<string>>();
          for (const row of comparison!.prompts) {
            const key = providerKey(row.provider);
            const prompts = matchedPromptCounts.get(key) ?? new Set<string>();
            prompts.add(
              row.prompt.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US')
            );
            matchedPromptCounts.set(key, prompts);
          }
          const results = [...providers.entries()].map(([key, provider]) => ({
            provider,
            matchedPrompts: matchedPromptCounts.get(key)?.size ?? 0,
          }));
          const belowMinimum = results.filter(
            (item) => item.matchedPrompts < args.failOnGeoAnswerProviderMinMatchedPrompts!
          );
          process.stderr.write(
            `Provider matched-prompt support gate checked ${results.length} providers; minimum ${args.failOnGeoAnswerProviderMinMatchedPrompts} shared exact prompts across both periods.\n`
          );
          for (const item of belowMinimum.slice(0, 10)) {
            process.stderr.write(
              `❌ ${item.provider}: ${item.matchedPrompts} shared exact prompts.\n`
            );
          }
          if (belowMinimum.length > 10)
            process.stderr.write(
              `… and ${belowMinimum.length - 10} more providers fell below the matched-prompt support threshold.\n`
            );
          if (belowMinimum.length > 0 || results.length === 0) process.exitCode = 1;
        }
      }
      if (args.failOnGeoAnswerEntityPromptMinMatchedPrompts !== undefined) {
        const comparison = report.periodComparison?.entityPromptComparison;
        const normalize = (value: string): string =>
          value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
        const entities = new Map(
          (args.geoAnswerEntities ?? []).map((spec) => {
            const name = spec.split('=', 1)[0].trim();
            const key = normalize(name);
            return [
              key,
              { name, prompts: new Set<string>(), providerPromptRows: new Set<string>() },
            ] as const;
          })
        );
        if (comparison) {
          for (const row of comparison.rows) {
            const entity = entities.get(normalize(row.entity));
            if (
              row.sampleState !== 'both-periods' ||
              !row.baseline ||
              !row.current ||
              row.baseline.observationsWithAnswerText === 0 ||
              row.current.observationsWithAnswerText === 0 ||
              !entity
            )
              continue;
            const promptKey = normalize(row.prompt);
            entity.prompts.add(promptKey);
            entity.providerPromptRows.add(JSON.stringify([normalize(row.provider), promptKey]));
          }
        }
        if (!comparison || !comparison.coverageComplete || comparison.rowsTruncated) {
          process.stderr.write(
            '❌ Entity prompt support gate is unavailable: complete, uncapped baseline/current entity prompt detail is required.\n'
          );
          process.exitCode = 1;
        } else {
          const insufficient = [...entities.values()].filter(
            ({ prompts }) => prompts.size < args.failOnGeoAnswerEntityPromptMinMatchedPrompts!
          );
          process.stderr.write(
            `Entity prompt support gate checked ${entities.size} entities; minimum ${args.failOnGeoAnswerEntityPromptMinMatchedPrompts} distinct shared prompts with answer text in both periods.\n`
          );
          for (const { name, prompts, providerPromptRows } of [...entities.values()]) {
            process.stderr.write(
              `${insufficient.some((item) => item.name === name) ? '❌' : '✓'} ${name}: ${prompts.size} distinct prompts across ${providerPromptRows.size} matched prompt/provider rows.\n`
            );
          }
          if (insufficient.length > 0) process.exitCode = 1;
        }
      }
      let auditSummaryForAnswer: SiteWideGeoAnalysis | undefined;
      let baselineAuditSummaryForAnswer: SiteWideGeoAnalysis | undefined;
      if (args.geoAuditJson) {
        const readAudit = (filePath: string): SiteWideGeoAnalysis => {
          const auditStats = fs.statSync(filePath);
          if (!auditStats.isFile())
            throw new Error(`${filePath} is not a regular audit JSON file.`);
          if (auditStats.size > 100 * 1024 * 1024)
            throw new Error(`${filePath} exceeds the 100 MiB input limit.`);
          const rawAudit: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (isSiteWideGeoAnalysis(rawAudit)) return rawAudit;
          let batch: SEOAuditBatchReport;
          if (isSEOAuditBatchReport(rawAudit)) {
            batch = rawAudit;
          } else if (isSEOReport(rawAudit)) {
            batch = {
              timestamp: rawAudit.timestamp,
              summary: {
                requestedUrls: 1,
                concurrency: 1,
                completedUrls: 1,
                failedUrls: 0,
                passedChecks: rawAudit.summary.passed,
                failedChecks: rawAudit.summary.failed,
                averageScore: rawAudit.score,
              },
              results: [{ status: 'complete', url: rawAudit.url, report: rawAudit }],
            };
          } else {
            throw new Error(
              `${filePath} must contain one SEO report, an SEO batch report, or a version 1 sitewide GEO summary.`
            );
          }
          return analyzeSiteWideGeo(batch);
        };
        const geoSummary = readAudit(args.geoAuditJson);
        baselineAuditSummaryForAnswer = args.geoAuditBaselineJson
          ? readAudit(args.geoAuditBaselineJson)
          : geoSummary;
        report = correlateAiAnswerCitationObservationsWithAudit(report, geoSummary);
        if (baselineReportForAnswer)
          baselineReportForAnswer = correlateAiAnswerCitationObservationsWithAudit(
            baselineReportForAnswer,
            baselineAuditSummaryForAnswer
          );
        auditSummaryForAnswer = geoSummary;
      }
      if (args.failOnGeoAnswerCohortMonthlyOwnedMrrDrop !== undefined) {
        const profiles = report.topicIntentProviderMonthly;
        const minimumPrompts = args.failOnGeoAnswerCohortMonthlyOwnedMrrMinPrompts ?? 2;
        const normalizeSegmentPart = (value: string | undefined): string | null =>
          value?.toLowerCase() ?? null;
        const latestBySegment = new Map<string, NonNullable<typeof profiles>[number]>();
        for (const profile of profiles ?? []) {
          const key = JSON.stringify([
            normalizeSegmentPart(profile.topic),
            normalizeSegmentPart(profile.intent),
            profile.unlabeled,
            normalizeSegmentPart(profile.provider),
          ]);
          latestBySegment.set(key, profile);
        }
        const latestRows = [...latestBySegment.values()];
        const trendRows = latestRows.filter(
          (profile) => profile.previousObservedMonth !== undefined
        );
        const supportShortfalls = trendRows.filter(
          (profile) =>
            !Number.isSafeInteger(profile.promptsWithOwnedCitation) ||
            profile.promptsWithOwnedCitation! < minimumPrompts ||
            !Number.isSafeInteger(profile.previousPromptsWithOwnedCitation) ||
            profile.previousPromptsWithOwnedCitation! < minimumPrompts
        );
        const metricsComplete = trendRows.every((profile) => {
          const previous = profile.previousEqualPromptMeanOwnedFirstCitationMrrPercent;
          const current = profile.equalPromptMeanOwnedFirstCitationMrrPercent;
          const change =
            profile.equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints;
          return (
            previous !== undefined &&
            previous !== null &&
            Number.isFinite(previous) &&
            previous >= 0 &&
            previous <= 100 &&
            current !== undefined &&
            current !== null &&
            Number.isFinite(current) &&
            current >= 0 &&
            current <= 100 &&
            change !== undefined &&
            change !== null &&
            Number.isFinite(change) &&
            Math.abs(change - (current - previous)) <= 0.011
          );
        });
        if (
          !profiles ||
          profiles.length === 0 ||
          report.topicIntentProviderMonthlyTruncated ||
          trendRows.length === 0 ||
          supportShortfalls.length > 0 ||
          !metricsComplete
        ) {
          process.stderr.write(
            `❌ Monthly cohort first-owned-citation MRR gate is not comparable: uncapped monthly detail, at least one previous sampled-month transition, and at least ${minimumPrompts} owned-cited prompts in both months for every latest cohort transition are required.\n`
          );
          if (report.topicIntentProviderMonthlyTruncated)
            process.stderr.write(
              '  Monthly provider/cohort detail was capped; rerun with a smaller observation set.\n'
            );
          if (trendRows.length === 0)
            process.stderr.write('  No cohort has a previous sampled-month transition.\n');
          for (const profile of supportShortfalls.slice(0, 10)) {
            process.stderr.write(
              `  ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): owned-cited prompt support ${profile.previousPromptsWithOwnedCitation ?? 'unavailable'} prior, ${profile.promptsWithOwnedCitation ?? 'unavailable'} current.\n`
            );
          }
          if (supportShortfalls.length > 10)
            process.stderr.write(
              `  … and ${supportShortfalls.length - 10} more cohort transitions below the support floor.\n`
            );
          if (trendRows.length > 0 && !metricsComplete && supportShortfalls.length === 0)
            process.stderr.write(
              '  One or more prior/current MRR fields are missing or internally inconsistent.\n'
            );
          process.exitCode = 1;
        } else {
          const declines = trendRows.filter(
            (profile) =>
              profile.equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints! <
              -args.failOnGeoAnswerCohortMonthlyOwnedMrrDrop!
          );
          process.stderr.write(
            `Monthly cohort first-owned-citation MRR gate checked ${trendRows.length} latest provider/topic/intent series; threshold ${args.failOnGeoAnswerCohortMonthlyOwnedMrrDrop} pp; minimum ${minimumPrompts} owned-cited prompts in each sampled month. Comparisons use each month’s independently prompt-balanced estimate; previous sampled months may be non-adjacent.\n`
          );
          for (const profile of declines.slice(0, 10)) {
            process.stderr.write(
              `❌ ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): ${profile.previousEqualPromptMeanOwnedFirstCitationMrrPercent!.toFixed(2)}% → ${profile.equalPromptMeanOwnedFirstCitationMrrPercent!.toFixed(2)}% (Δ ${profile.equalPromptMeanOwnedFirstCitationMrrChangeFromPreviousSampledMonthPercentagePoints!.toFixed(2)} pp; ${profile.previousPromptsWithOwnedCitation}/${profile.promptsWithOwnedCitation} owned-cited prompts).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more cohorts exceeded the threshold.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
        }
      }
      if (
        args.failOnGeoAnswerCohortMonthlyPairedMrrDrop !== undefined ||
        args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi !== undefined
      ) {
        const profiles = report.topicIntentProviderMonthly;
        const minimumPrompts =
          args.failOnGeoAnswerCohortMonthlyPairedMrrMinMatchedPrompts ??
          (args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi !== undefined ? 10 : 2);
        const normalizeSegmentPart = (value: string | undefined): string | null =>
          value?.toLowerCase() ?? null;
        const latestBySegment = new Map<string, NonNullable<typeof profiles>[number]>();
        for (const profile of profiles ?? []) {
          const key = JSON.stringify([
            normalizeSegmentPart(profile.topic),
            normalizeSegmentPart(profile.intent),
            profile.unlabeled,
            normalizeSegmentPart(profile.provider),
          ]);
          latestBySegment.set(key, profile);
        }
        const latestRows = [...latestBySegment.values()];
        const trendRows = latestRows.filter(
          (profile) => profile.previousObservedMonth !== undefined
        );
        const supportShortfalls = trendRows.filter(
          (profile) =>
            !Number.isSafeInteger(profile.promptsWithOwnedCitationRankInBothSampledMonths) ||
            profile.promptsWithOwnedCitationRankInBothSampledMonths! < minimumPrompts
        );
        const metricsComplete = trendRows.every((profile) => {
          const previous = profile.previousPairedPromptMeanOwnedFirstCitationMrrPercent;
          const current = profile.currentPairedPromptMeanOwnedFirstCitationMrrPercent;
          const change = profile.pairedPromptMeanOwnedFirstCitationMrrChangePercentagePoints;
          const interval =
            profile.pairedPromptMeanOwnedFirstCitationMrrChangeConfidenceInterval95PercentagePoints;
          const pointEstimateValid =
            previous !== undefined &&
            previous !== null &&
            Number.isFinite(previous) &&
            previous >= 0 &&
            previous <= 100 &&
            current !== undefined &&
            current !== null &&
            Number.isFinite(current) &&
            current >= 0 &&
            current <= 100 &&
            change !== undefined &&
            change !== null &&
            Number.isFinite(change) &&
            Math.abs(change - (current - previous)) <= 0.011;
          const intervalValid =
            args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi === undefined ||
            (interval !== undefined &&
              interval !== null &&
              Number.isFinite(interval.upperPercentagePoints) &&
              interval.upperPercentagePoints >= -100 &&
              interval.upperPercentagePoints <= 100);
          return pointEstimateValid && intervalValid;
        });
        if (
          !profiles ||
          profiles.length === 0 ||
          report.topicIntentProviderMonthlyTruncated ||
          trendRows.length === 0 ||
          supportShortfalls.length > 0 ||
          !metricsComplete
        ) {
          process.stderr.write(
            `❌ Monthly paired cohort first-owned-citation MRR gate is not comparable: uncapped monthly detail, at least one previous sampled-month transition, and at least ${minimumPrompts} shared owned-cited exact prompts per transition are required.\n`
          );
          if (report.topicIntentProviderMonthlyTruncated)
            process.stderr.write(
              '  Monthly provider/cohort detail was capped; rerun with a smaller observation set.\n'
            );
          if (trendRows.length === 0)
            process.stderr.write('  No cohort has a previous sampled-month transition.\n');
          for (const profile of supportShortfalls.slice(0, 10)) {
            process.stderr.write(
              `  ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): ${profile.promptsWithOwnedCitationRankInBothSampledMonths ?? 'unavailable'} shared prompts with an owned-citation rank.\n`
            );
          }
          if (supportShortfalls.length > 10)
            process.stderr.write(
              `  … and ${supportShortfalls.length - 10} more cohort transitions below the support floor.\n`
            );
          if (trendRows.length > 0 && !metricsComplete && supportShortfalls.length === 0)
            process.stderr.write(
              '  One or more paired MRR estimates or requested bootstrap intervals are missing or inconsistent.\n'
            );
          process.exitCode = 1;
        } else {
          const failsPointGate = (profile: NonNullable<typeof profiles>[number]): boolean =>
            args.failOnGeoAnswerCohortMonthlyPairedMrrDrop !== undefined &&
            profile.pairedPromptMeanOwnedFirstCitationMrrChangePercentagePoints! <
              -args.failOnGeoAnswerCohortMonthlyPairedMrrDrop;
          const failsIntervalGate = (profile: NonNullable<typeof profiles>[number]): boolean =>
            args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi !== undefined &&
            profile.pairedPromptMeanOwnedFirstCitationMrrChangeConfidenceInterval95PercentagePoints!
              .upperPercentagePoints < -args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi;
          const declines = trendRows.filter(
            (profile) => failsPointGate(profile) || failsIntervalGate(profile)
          );
          process.stderr.write(
            `Monthly paired cohort first-owned-citation MRR gate checked ${trendRows.length} latest provider/topic/intent series; minimum ${minimumPrompts} shared owned-cited exact prompts per transition. Shared prompt changes use a deterministic 1,000-resample paired-prompt bootstrap; previous sampled months may be non-adjacent.\n`
          );
          if (args.failOnGeoAnswerCohortMonthlyPairedMrrDrop !== undefined)
            process.stderr.write(
              `  Point-estimate decline threshold: ${args.failOnGeoAnswerCohortMonthlyPairedMrrDrop} pp.\n`
            );
          if (args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi !== undefined)
            process.stderr.write(
              `  95% interval-confirmed decline threshold: ${args.failOnGeoAnswerCohortMonthlyPairedMrrDropLowerCi} pp.\n`
            );
          for (const profile of declines.slice(0, 10)) {
            const interval =
              profile.pairedPromptMeanOwnedFirstCitationMrrChangeConfidenceInterval95PercentagePoints;
            process.stderr.write(
              `❌ ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): ${profile.previousPairedPromptMeanOwnedFirstCitationMrrPercent!.toFixed(2)}% → ${profile.currentPairedPromptMeanOwnedFirstCitationMrrPercent!.toFixed(2)}% (Δ ${profile.pairedPromptMeanOwnedFirstCitationMrrChangePercentagePoints!.toFixed(2)} pp${interval ? `; 95% CI ${interval.lowerPercentagePoints.toFixed(2)} to ${interval.upperPercentagePoints.toFixed(2)} pp` : ''}; ${profile.promptsWithOwnedCitationRankInBothSampledMonths} shared prompts).\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more cohorts exceeded a paired-MRR threshold.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
        }
      }
      if (
        args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop !== undefined ||
        args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi !== undefined ||
        args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline !== undefined
      ) {
        const profiles = report.topicIntentProviderMonthly;
        const minimumPrompts =
          args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageMinMatchedPrompts ??
          (args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi !== undefined ? 10 : 2);
        const holmGateRequested =
          args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline !== undefined;
        const holmAlpha = args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmAlpha ?? 0.05;
        const normalizeSegmentPart = (value: string | undefined): string | null =>
          value?.toLowerCase() ?? null;
        const latestBySegment = new Map<string, NonNullable<typeof profiles>[number]>();
        for (const profile of profiles ?? []) {
          const key = JSON.stringify([
            normalizeSegmentPart(profile.topic),
            normalizeSegmentPart(profile.intent),
            profile.unlabeled,
            normalizeSegmentPart(profile.provider),
          ]);
          latestBySegment.set(key, profile);
        }
        const latestRows = [...latestBySegment.values()];
        const trendRows = latestRows.filter(
          (profile) => profile.previousObservedMonth !== undefined
        );
        const supportShortfalls = trendRows.filter(
          (profile) =>
            !Number.isSafeInteger(profile.promptsInBothSampledMonths) ||
            profile.promptsInBothSampledMonths! < minimumPrompts
        );
        const metricsComplete = trendRows.every((profile) => {
          const change = profile.pairedPromptOwnedCitationReachChangePercentagePoints;
          const interval =
            profile.pairedPromptOwnedCitationReachChangeConfidenceInterval95PercentagePoints;
          const sharedPrompts = profile.promptsInBothSampledMonths;
          const gainedPrompts = profile.ownedCitationPromptsGainedSincePreviousSampledMonth;
          const lostPrompts = profile.ownedCitationPromptsLostSincePreviousSampledMonth;
          const pointEstimateValid =
            change !== undefined &&
            change !== null &&
            Number.isFinite(change) &&
            change >= -100 &&
            change <= 100 &&
            Number.isSafeInteger(sharedPrompts) &&
            sharedPrompts! > 0 &&
            Number.isSafeInteger(gainedPrompts) &&
            Number.isSafeInteger(lostPrompts) &&
            gainedPrompts! >= 0 &&
            lostPrompts! >= 0 &&
            gainedPrompts! + lostPrompts! <= sharedPrompts! &&
            Math.abs(change - ((gainedPrompts! - lostPrompts!) / sharedPrompts!) * 100) <= 0.011;
          const intervalValid =
            args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi === undefined ||
            (interval !== undefined &&
              interval !== null &&
              Number.isFinite(interval.upperPercentagePoints) &&
              interval.upperPercentagePoints >= -100 &&
              interval.upperPercentagePoints <= 100);
          return pointEstimateValid && intervalValid;
        });
        const holmComparisonComplete =
          trendRows.length > 0 &&
          !report.topicIntentProviderMonthlyTruncated &&
          trendRows.every(
            (profile) =>
              profile.latestMonthlyPairedOwnedPromptReachHolmStatus === 'complete' &&
              Number.isSafeInteger(profile.latestMonthlyPairedOwnedPromptReachHolmFamilySize) &&
              profile.latestMonthlyPairedOwnedPromptReachHolmFamilySize === trendRows.length &&
              profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue !== null &&
              profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue !== undefined &&
              Number.isFinite(
                profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue
              ) &&
              profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue >= 0 &&
              profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue <= 1
          );
        if (
          !profiles ||
          profiles.length === 0 ||
          report.topicIntentProviderMonthlyTruncated ||
          trendRows.length === 0 ||
          supportShortfalls.length > 0 ||
          !metricsComplete ||
          (holmGateRequested && !holmComparisonComplete)
        ) {
          process.stderr.write(
            `❌ Monthly cohort owned-prompt-reach gate is not comparable: uncapped monthly detail, at least one previous sampled-month transition, and at least ${minimumPrompts} shared exact prompts per transition are required.\n`
          );
          if (report.topicIntentProviderMonthlyTruncated)
            process.stderr.write(
              '  Monthly provider/cohort detail was capped; rerun with a smaller observation set.\n'
            );
          if (trendRows.length === 0)
            process.stderr.write('  No cohort has a previous sampled-month transition.\n');
          if (holmGateRequested && !holmComparisonComplete)
            process.stderr.write(
              '  The complete report-wide Holm family of latest paired transitions is unavailable.\n'
            );
          for (const profile of supportShortfalls.slice(0, 10)) {
            process.stderr.write(
              `  ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): ${profile.promptsInBothSampledMonths ?? 'unavailable'} shared prompts.\n`
            );
          }
          if (supportShortfalls.length > 10)
            process.stderr.write(
              `  … and ${supportShortfalls.length - 10} more cohort transitions below the support floor.\n`
            );
          if (trendRows.length > 0 && !metricsComplete && supportShortfalls.length === 0)
            process.stderr.write(
              '  One or more paired reach estimates or requested bootstrap intervals are missing.\n'
            );
          process.exitCode = 1;
        } else {
          const failsHolmGate = (profile: NonNullable<typeof profiles>[number]): boolean =>
            holmGateRequested &&
            profile.pairedPromptOwnedCitationReachChangePercentagePoints! <
              -args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline! &&
            profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue! <= holmAlpha;
          const failsPointGate = (profile: NonNullable<typeof profiles>[number]): boolean =>
            args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop !== undefined &&
            profile.pairedPromptOwnedCitationReachChangePercentagePoints! <
              -args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop;
          const failsIntervalGate = (profile: NonNullable<typeof profiles>[number]): boolean =>
            args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi !== undefined &&
            profile.pairedPromptOwnedCitationReachChangeConfidenceInterval95PercentagePoints!
              .upperPercentagePoints <
              -args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi;
          const declines = trendRows.filter(
            (profile) =>
              failsPointGate(profile) || failsIntervalGate(profile) || failsHolmGate(profile)
          );
          process.stderr.write(
            `Monthly cohort owned-prompt-reach gate checked ${trendRows.length} latest provider/topic/intent series; minimum ${minimumPrompts} shared exact prompts per transition. Exact two-sided McNemar p-values are descriptive; the optional confidence gate uses deterministic paired-prompt bootstrap intervals. Previous sampled months may be non-adjacent.\n`
          );
          if (args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop !== undefined)
            process.stderr.write(
              `  Point-estimate decline threshold: ${args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDrop} pp.\n`
            );
          if (args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi !== undefined)
            process.stderr.write(
              `  95% interval-confirmed decline threshold: ${args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageDropLowerCi} pp.\n`
            );
          if (holmGateRequested)
            process.stderr.write(
              `  Holm-adjusted decline threshold: ${args.failOnGeoAnswerCohortMonthlyOwnedPromptCoverageHolmDecline} pp at adjusted p ≤ ${holmAlpha} across ${trendRows.length} latest cohort transitions.\n`
            );
          for (const profile of declines.slice(0, 10)) {
            const interval =
              profile.pairedPromptOwnedCitationReachChangeConfidenceInterval95PercentagePoints;
            process.stderr.write(
              `❌ ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): Δ ${profile.pairedPromptOwnedCitationReachChangePercentagePoints!.toFixed(2)} pp; ${profile.ownedCitationPromptsGainedSincePreviousSampledMonth}/${profile.ownedCitationPromptsLostSincePreviousSampledMonth} gained/lost, ${profile.promptsInBothSampledMonths} shared prompts${interval ? `; 95% CI ${interval.lowerPercentagePoints.toFixed(2)} to ${interval.upperPercentagePoints.toFixed(2)} pp` : ''}; exact McNemar p ${profile.pairedPromptOwnedCitationReachExactMcNemarPValue?.toPrecision(3) ?? 'unavailable'}${profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue === undefined || profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue === null ? '' : `; Holm p ${profile.latestMonthlyPairedOwnedPromptReachHolmAdjustedMcNemarPValue.toPrecision(3)}`}.\n`
            );
          }
          if (declines.length > 10)
            process.stderr.write(
              `… and ${declines.length - 10} more cohorts exceeded an owned-prompt-reach threshold.\n`
            );
          if (declines.length > 0) process.exitCode = 1;
        }
      }
      const outputFiles = [
        args.output,
        args.html,
        args.geoAnswerOwnedSourceShareGateCsv,
        args.geoAnswerOwnedSourceShareGateJson,
        args.geoAnswerComparisonCsv,
        args.geoAnswerProviderPositionComparisonCsv,
        args.geoAnswerCohortsCsv,
        args.geoAnswerCohortStandardizationCsv,
        args.geoAnswerCohortPeriodStandardizationCsv,
        args.geoAnswerPromptSamplingPlanCsv,
        args.geoAnswerPromptSamplingPlanJson,
        args.geoAnswerPromptPlanProviderPairsCsv,
        args.geoAnswerExecutionContextCsv,
        args.geoAnswerExecutionContextCoverageCsv,
        args.geoAnswerExecutionContextComparisonCsv,
        args.geoAnswerExecutionContextTrendsCsv,
        args.geoAnswerLengthProfilesCsv,
        args.geoAnswerLengthComparisonCsv,
        args.geoAnswerLengthTrendsCsv,
        args.geoAnswerCohortComparisonCsv,
        args.geoAnswerProviderPairsCsv,
        args.geoAnswerProviderPromptOverlapCsv,
        args.geoAnswerProviderPromptSourceOverlapCsv,
        args.geoAnswerSampleMixCsv,
        args.geoAnswerTemporalStabilityCsv,
        args.geoAnswerSourcePersistenceCsv,
        args.geoAnswerCitationUrlPersistenceCsv,
        args.geoAnswerCohortTrendsCsv,
        args.geoAnswerAuditSignalsCsv,
        args.geoAnswerAuditedOwnedPageProviderInventoryCsv,
        args.geoAnswerAuditedOwnedPageProviderInventoryHtml,
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv,
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml,
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson,
        args.geoAnswerAuditedOwnedPagesCsv,
        args.geoAnswerAuditedOwnedPageComparisonCsv,
        args.geoAnswerAuditedOwnedPageProvidersCsv,
        args.geoAnswerAuditedOwnedPageProviderComparisonCsv,
        args.geoAnswerSourceCategoriesCsv,
        args.geoAnswerSourceCategoryMappingAuditCsv,
        args.geoAnswerSourceCategoryComparisonCsv,
        args.geoAnswerSourceCategoryMixDecompositionCsv,
        args.geoAnswerSourceCategoryMixDecompositionHtml,
        args.geoAnswerSourceCategoryPromptBalancedJsdGateJson,
        args.geoAnswerSourceCategoryConcentrationTrendsCsv,
        args.geoAnswerSourceCategoryConcentrationTrendsHtml,
        args.geoAnswerSourceCategoryShareTrendsCsv,
        args.geoAnswerSourceCategoryShareTrendsHtml,
        args.geoAnswerSourceCategoryMonthlyGatesJson,
        args.geoAnswerSourceCategoryPromptCoverageCsv,
        args.geoAnswerSourceCategoryPromptDetailsCsv,
        args.geoAnswerSourceCategoryTrendsCsv,
        args.geoAnswerSourceCategoryProviderPairsCsv,
        args.geoAnswerSourceCategoryCooccurrenceCsv,
        args.geoAnswerSourceCategoryPathFamiliesCsv,
        args.geoAnswerSourceCategoryPathFamilyComparisonCsv,
        args.geoAnswerCitationPositionsCsv,
        args.geoAnswerSourceRarefactionCsv,
        args.geoAnswerPromptFamilySourceRarefactionCsv,
        args.geoAnswerPromptFamilySourceRarefactionHtml,
        args.geoAnswerPromptFamilySourceRarefactionSweepCsv,
        args.geoAnswerPromptFamilySourceRarefactionSweepHtml,
        args.geoAnswerProviderPromptFamilySourceOverlapCsv,
        args.geoAnswerProviderPromptFamilySourceOverlapHtml,
        args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv,
        args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml,
        args.geoAnswerPromptFamilyPeriodComparisonCsv,
        args.geoAnswerPromptFamilyPeriodComparisonHtml,
        args.geoAnswerPromptFamilyPeriodComparisonSweepCsv,
        args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv,
        args.geoAnswerPromptFamilyPeriodComparisonSweepHtml,
        args.geoAnswerCitationDateAlignmentCsv,
        args.geoAnswerPromptSimilarityCsv,
        args.geoAnswerPromptFamiliesCsv,
        args.geoAnswerPromptFamiliesHtml,
        args.geoAnswerPromptFamilyInfluenceCsv,
        args.geoAnswerPromptFamilyInfluenceHtml,
        args.geoAnswerPromptFamilyThresholdSweepCsv,
        args.geoAnswerPromptFamilyThresholdSweepHtml,
        args.geoAnswerDomainPairedReachComparisonCsv,
        args.geoAnswerDomainPairedReachComparisonJson,
        args.geoAnswerDomainPairedReachGateJson,
        args.geoAnswerPageOpportunityTrendsCsv,
        args.geoAnswerSourceDiversityUncertaintyCsv,
        args.geoAnswerSourceDiversityUncertaintyHtml,
        args.geoAnswerSourceDiversityComparisonCsv,
        args.geoAnswerSourceDiversityComparisonHtml,
        args.geoAnswerProviderSourceDivergenceCsv,
        args.geoAnswerSourcePortfolioDriftCsv,
        args.geoAnswerSourcePortfolioDriftHtml,
        args.geoAnswerSourcePortfolioDriftJson,
        args.geoAnswerSourcePortfolioAttributionCsv,
        args.geoAnswerSourcePortfolioAttributionJson,
        args.geoAnswerSourcePortfolioAttributionHtml,
        args.geoAnswerSourceNetworkCsv,
        args.geoAnswerSourceNetworkComparisonCsv,
        args.geoAnswerRankWeightedSourceNetworkCsv,
        args.geoAnswerRankWeightedSourceNetworkComparisonCsv,
        args.geoAnswerSourceNetworkHtml,
        args.geoAnswerSourceNetworkComparisonHtml,
        args.geoAnswerProviderSourceNetworkOverlapCsv,
        args.geoAnswerProviderSourceNetworkEdgeDriftCsv,
        args.geoAnswerProviderSourceNetworkEdgeDriftHtml,
        args.geoAnswerProviderSourceNetworkEdgeComparisonCsv,
        args.geoAnswerProviderSourceNetworkEdgeHtml,
        args.geoAnswerOwnedSourceNetworkGapsCsv,
        args.geoAnswerOwnedRankCsv,
        args.geoAnswerOwnedPromptCoverageCsv,
        args.geoAnswerOwnedPromptReachPeriodCsv,
        args.geoAnswerOwnedPromptOpportunitiesCsv,
        args.geoAnswerOwnedRankComparisonCsv,
        args.geoAnswerOwnedPromptRankComparisonCsv,
        args.geoAnswerCoCitationCsv,
        args.geoAnswerCoCitationComparisonCsv,
        args.geoAnswerEntityMentionsCsv,
        args.geoAnswerEntityPromptDetailsCsv,
        args.geoAnswerEntityPromptProviderPairsCsv,
        args.geoAnswerEntityPromptComparisonCsv,
        args.geoAnswerEntityCoMentionsCsv,
        args.geoAnswerEntityCoMentionComparisonCsv,
        args.geoAnswerEntityCitationDomainsCsv,
        args.geoAnswerEntityCitationPagesCsv,
        args.geoAnswerEntitySourceCategoriesCsv,
        args.geoAnswerEntitySourceCategoryComparisonCsv,
        args.geoAnswerEntityCitationDomainComparisonCsv,
        args.geoAnswerEntityCitationPageComparisonCsv,
        args.geoAnswerEntityCitationPositionComparisonCsv,
        args.geoAnswerEntityOpportunitiesCsv,
        args.geoAnswerEntityPromptMatchedAssociationCsv,
        args.geoAnswerEntityPromptMatchedAssociationHtml,
        args.geoAnswerEntityPathFamiliesCsv,
        args.geoAnswerEntityPathFamilyMonthlyCsv,
        args.geoAnswerEntityPathFamilyComparisonCsv,
        args.geoAnswerPathFamiliesCsv,
        args.geoAnswerPathFamilyCohortsCsv,
        args.geoAnswerPathFamilyTrendsCsv,
        args.geoAnswerPathFamilyCohortComparisonCsv,
        args.geoAnswerPathFamilyComparisonCsv,
        args.geoAnswerCrawlerMatchesCsv,
      ].filter((file): file is string => Boolean(file));
      if (args.geoAnswerCompetitiveGapsCsv) outputFiles.push(args.geoAnswerCompetitiveGapsCsv);
      if (args.geoAnswerProviderOwnedGapsCsv) outputFiles.push(args.geoAnswerProviderOwnedGapsCsv);
      if (args.geoAnswerProviderOwnedGapComparisonCsv)
        outputFiles.push(args.geoAnswerProviderOwnedGapComparisonCsv);
      if (args.geoAnswerCompetitiveGapComparisonCsv)
        outputFiles.push(args.geoAnswerCompetitiveGapComparisonCsv);
      if (args.geoAnswerDomainPromptCoverageCsv)
        outputFiles.push(args.geoAnswerDomainPromptCoverageCsv);
      if (args.geoAnswerDomainPromptCoverageComparisonCsv)
        outputFiles.push(args.geoAnswerDomainPromptCoverageComparisonCsv);
      if (args.geoAnswerPagePairedReachComparisonCsv)
        outputFiles.push(args.geoAnswerPagePairedReachComparisonCsv);
      if (args.geoAnswerPagePairedReachComparisonJson)
        outputFiles.push(args.geoAnswerPagePairedReachComparisonJson);
      if (args.geoAnswerPageOpportunitiesCsv) outputFiles.push(args.geoAnswerPageOpportunitiesCsv);
      if (args.geoAnswerPageOpportunityMonthlyGateJson)
        outputFiles.push(args.geoAnswerPageOpportunityMonthlyGateJson);
      if (args.geoAnswerPageOpportunityPathFamiliesCsv)
        outputFiles.push(args.geoAnswerPageOpportunityPathFamiliesCsv);
      if (args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv)
        outputFiles.push(args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv);
      if (args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml)
        outputFiles.push(args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml);
      if (args.geoAnswerPageOpportunityPathFamilyTrendsCsv)
        outputFiles.push(args.geoAnswerPageOpportunityPathFamilyTrendsCsv);
      if (args.geoAnswerPageOpportunityPathFamilyTrendsHtml)
        outputFiles.push(args.geoAnswerPageOpportunityPathFamilyTrendsHtml);
      if (args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson)
        outputFiles.push(args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson);
      if (args.geoAnswerPagePairedReachGateJson)
        outputFiles.push(args.geoAnswerPagePairedReachGateJson);
      const inputFiles = [
        args.geoAnswerObservations,
        ...(args.geoAnswerBaselineObservations ? [args.geoAnswerBaselineObservations] : []),
        ...(args.geoAnswerCrawlerReport ? [args.geoAnswerCrawlerReport] : []),
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
        ...(args.geoAnswerPromptPlanCohortTargets ? [args.geoAnswerPromptPlanCohortTargets] : []),
      ];
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        )
      ) {
        throw new Error(
          'Report output paths must differ from observed-answer, prompt-plan target, and GEO audit input files.'
        );
      }
      for (let index = 0; index < outputFiles.length; index += 1) {
        for (let next = index + 1; next < outputFiles.length; next += 1) {
          if (pathsReferToSameFile(outputFiles[index]!, outputFiles[next]!)) {
            throw new Error('Report output paths must point to different files.');
          }
        }
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, JSON.stringify(report, null, 2), 'utf8');
      }
      if (args.html) {
        fs.mkdirSync(path.dirname(args.html), { recursive: true });
        fs.writeFileSync(
          args.html,
          renderAiAnswerCitationObservationHtml(
            report,
            args.geoAnswerSourceCategories ?? [],
            args.geoAnswerPromptPlanMinPrompts ?? 0,
            args.geoAnswerPromptPlanOwnedReachMargin,
            args.geoAnswerPromptPlanMinimumJaccard,
            args.geoAnswerPromptPlanMaxPairedGroups,
            promptPlanCohortTargets,
            args.geoAnswerPromptPlanMaxTotalPairedGroups,
            args.geoAnswerPromptPlanTotalAllocation ?? 'balanced',
            args.geoAnswerSourceRarefactionBatchSize ?? 10
          ),
          'utf8'
        );
      }
      if (args.geoAnswerComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerComparisonCsv,
          renderAiAnswerCitationObservationComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPositionComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPositionComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderPositionComparisonCsv,
          renderAiAnswerCitationProviderPagePositionComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCohortComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCohortComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCohortComparisonCsv,
          renderAiAnswerCitationTopicIntentComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCohortsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCohortsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCohortsCsv,
          renderAiAnswerCitationTopicIntentCohortsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPairsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPairsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerProviderPairsCsv,
          renderAiAnswerCitationTopicIntentProviderPairsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPromptOverlapCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPromptOverlapCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerProviderPromptOverlapCsv,
          renderAiAnswerCitationProviderPromptOverlapCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPromptSourceOverlapCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPromptSourceOverlapCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderPromptSourceOverlapCsv,
          renderAiAnswerCitationProviderPromptSourceOverlapCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerSampleMixCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSampleMixCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSampleMixCsv,
          renderAiAnswerCitationProviderSampleMixCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCohortStandardizationCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCohortStandardizationCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCohortStandardizationCsv,
          renderAiAnswerCitationCohortStandardizationCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCohortPeriodStandardizationCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCohortPeriodStandardizationCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerCohortPeriodStandardizationCsv,
          renderAiAnswerCitationCohortPeriodStandardizationCsv(report),
          'utf8'
        );
      }
      let promptPlanTargetSummary:
        ReturnType<typeof summarizeAiAnswerCitationPromptPlanTargets> | undefined;
      if (args.geoAnswerPromptSamplingPlanCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptSamplingPlanCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPromptSamplingPlanCsv,
          renderAiAnswerCitationPromptSamplingPlanCsv(
            report,
            args.geoAnswerPromptPlanMinPrompts ?? 0,
            args.geoAnswerPromptPlanOwnedReachMargin,
            args.geoAnswerPromptPlanMinimumJaccard,
            args.geoAnswerPromptPlanMaxPairedGroups,
            promptPlanCohortTargets,
            args.geoAnswerPromptPlanMaxTotalPairedGroups,
            args.geoAnswerPromptPlanTotalAllocation ?? 'balanced'
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptSamplingPlanJson) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptSamplingPlanJson), { recursive: true });
        const promptPlanJson = renderAiAnswerCitationPromptSamplingPlanJson(
          report,
          args.geoAnswerPromptPlanMinPrompts ?? 0,
          args.geoAnswerPromptPlanOwnedReachMargin,
          args.geoAnswerPromptPlanMinimumJaccard,
          args.geoAnswerPromptPlanMaxPairedGroups,
          promptPlanCohortTargets,
          args.geoAnswerPromptPlanMaxTotalPairedGroups,
          args.geoAnswerPromptPlanTotalAllocation ?? 'balanced'
        );
        fs.writeFileSync(args.geoAnswerPromptSamplingPlanJson, promptPlanJson, 'utf8');
        promptPlanTargetSummary = (
          JSON.parse(promptPlanJson) as {
            targetSummary: ReturnType<typeof summarizeAiAnswerCitationPromptPlanTargets>;
          }
        ).targetSummary;
      }
      if (args.geoAnswerPromptPlanProviderPairsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptPlanProviderPairsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPromptPlanProviderPairsCsv,
          renderAiAnswerCitationPromptPlanProviderPairsCsv(
            report,
            args.geoAnswerPromptPlanMinPrompts ?? 0,
            args.geoAnswerPromptPlanOwnedReachMargin,
            args.geoAnswerPromptPlanMinimumJaccard,
            args.geoAnswerPromptPlanMaxPairedGroups,
            promptPlanCohortTargets,
            args.geoAnswerPromptPlanMaxTotalPairedGroups,
            args.geoAnswerPromptPlanTotalAllocation ?? 'balanced'
          ),
          'utf8'
        );
      }
      if (args.geoAnswerExecutionContextCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerExecutionContextCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerExecutionContextCsv,
          renderAiAnswerCitationExecutionContextCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerExecutionContextCoverageCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerExecutionContextCoverageCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerExecutionContextCoverageCsv,
          renderAiAnswerCitationExecutionContextCoverageCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerExecutionContextComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-execution-context-comparison-csv requires a baseline sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerExecutionContextComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerExecutionContextComparisonCsv,
          renderAiAnswerCitationExecutionContextComparisonCsv(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerExecutionContextTrendsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerExecutionContextTrendsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerExecutionContextTrendsCsv,
          renderAiAnswerCitationExecutionContextTrendsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerLengthProfilesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerLengthProfilesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerLengthProfilesCsv,
          renderAiAnswerCitationAnswerLengthProfilesCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerLengthComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error('--geo-answer-length-comparison-csv requires a baseline sample.');
        fs.mkdirSync(path.dirname(args.geoAnswerLengthComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerLengthComparisonCsv,
          renderAiAnswerCitationAnswerLengthComparisonCsv(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerLengthTrendsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerLengthTrendsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerLengthTrendsCsv,
          renderAiAnswerCitationAnswerLengthTrendsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerTemporalStabilityCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerTemporalStabilityCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerTemporalStabilityCsv,
          renderAiAnswerCitationTemporalStabilityCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerSourcePersistenceCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourcePersistenceCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourcePersistenceCsv,
          renderAiAnswerCitationSourcePersistenceCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCitationUrlPersistenceCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCitationUrlPersistenceCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCitationUrlPersistenceCsv,
          renderAiAnswerCitationUrlPersistenceCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCohortTrendsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCohortTrendsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCohortTrendsCsv,
          renderAiAnswerCitationTopicIntentProviderMonthlyCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerAuditSignalsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerAuditSignalsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerAuditSignalsCsv,
          renderAiAnswerCitationAuditSignalsCsv(report),
          'utf8'
        );
      }
      if (
        args.geoAnswerAuditedOwnedPageProviderInventoryCsv ||
        args.geoAnswerAuditedOwnedPageProviderInventoryHtml
      ) {
        if (!auditSummaryForAnswer)
          throw new Error('The owned-page provider inventory requires --geo-audit-json.');
        const inventoryCsv = renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv(
          report,
          auditSummaryForAnswer
        );
        if (args.geoAnswerAuditedOwnedPageProviderInventoryCsv) {
          fs.mkdirSync(path.dirname(args.geoAnswerAuditedOwnedPageProviderInventoryCsv), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerAuditedOwnedPageProviderInventoryCsv,
            inventoryCsv,
            'utf8'
          );
        }
        if (args.geoAnswerAuditedOwnedPageProviderInventoryHtml) {
          fs.mkdirSync(path.dirname(args.geoAnswerAuditedOwnedPageProviderInventoryHtml), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerAuditedOwnedPageProviderInventoryHtml,
            renderAiAnswerCitationAuditedOwnedPageProviderInventoryHtmlFromCsv(inventoryCsv),
            'utf8'
          );
        }
      }
      if (
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv ||
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml ||
        args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson
      ) {
        if (!auditSummaryForAnswer || !baselineReportForAnswer)
          throw new Error(
            'Owned-page/provider inventory comparison outputs require baseline answer observations and --geo-audit-json.'
          );
        const comparisonCsv = renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
          report,
          baselineReportForAnswer,
          auditSummaryForAnswer,
          baselineAuditSummaryForAnswer ?? auditSummaryForAnswer
        );
        if (args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv) {
          fs.mkdirSync(path.dirname(args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv,
            comparisonCsv,
            'utf8'
          );
        }
        if (args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml) {
          fs.mkdirSync(
            path.dirname(args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml),
            { recursive: true }
          );
          fs.writeFileSync(
            args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml,
            renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonHtmlFromCsv(
              comparisonCsv
            ),
            'utf8'
          );
        }
        if (args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson) {
          fs.mkdirSync(
            path.dirname(args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson),
            { recursive: true }
          );
          fs.writeFileSync(
            args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson,
            `${JSON.stringify(
              renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonJsonFromCsv(
                comparisonCsv,
                {
                  baselineAuditTimestamp: baselineAuditSummaryForAnswer?.auditTimestamp,
                  currentAuditTimestamp: auditSummaryForAnswer?.auditTimestamp,
                }
              ),
              null,
              2
            )}\n`,
            'utf8'
          );
        }
      }
      if (args.geoAnswerAuditedOwnedPagesCsv) {
        if (!auditSummaryForAnswer)
          throw new Error('--geo-answer-audited-owned-pages-csv requires --geo-audit-json.');
        fs.mkdirSync(path.dirname(args.geoAnswerAuditedOwnedPagesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerAuditedOwnedPagesCsv,
          renderAiAnswerCitationAuditedOwnedPagesCsv(report, auditSummaryForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerAuditedOwnedPageComparisonCsv) {
        if (!auditSummaryForAnswer || !baselineReportForAnswer)
          throw new Error(
            '--geo-answer-audited-owned-page-comparison-csv requires a baseline sample and --geo-audit-json.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerAuditedOwnedPageComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerAuditedOwnedPageComparisonCsv,
          renderAiAnswerCitationAuditedOwnedPageComparisonCsv(
            report,
            baselineReportForAnswer,
            auditSummaryForAnswer
          ),
          'utf8'
        );
      }
      if (args.geoAnswerAuditedOwnedPageProvidersCsv) {
        if (!auditSummaryForAnswer)
          throw new Error(
            '--geo-answer-audited-owned-page-providers-csv requires --geo-audit-json.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerAuditedOwnedPageProvidersCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerAuditedOwnedPageProvidersCsv,
          renderAiAnswerCitationAuditedOwnedPageProvidersCsv(report, auditSummaryForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerAuditedOwnedPageProviderComparisonCsv) {
        if (!auditSummaryForAnswer || !baselineReportForAnswer)
          throw new Error(
            '--geo-answer-audited-owned-page-provider-comparison-csv requires a baseline sample and --geo-audit-json.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerAuditedOwnedPageProviderComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerAuditedOwnedPageProviderComparisonCsv,
          renderAiAnswerCitationAuditedOwnedPageProviderComparisonCsv(
            report,
            baselineReportForAnswer,
            auditSummaryForAnswer
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoriesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoriesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceCategoriesCsv,
          renderAiAnswerCitationSourceCategoriesCsv(report, args.geoAnswerSourceCategories ?? []),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryMappingAuditCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryMappingAuditCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryMappingAuditCsv,
          renderAiAnswerCitationSourceCategoryMappingAuditCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-category-comparison-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryComparisonCsv,
          renderAiAnswerCitationSourceCategoryComparisonCsv(
            report,
            baselineReportForAnswer,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryConcentrationTrendsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryConcentrationTrendsCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryConcentrationTrendsCsv,
          renderAiAnswerCitationSourceCategoryConcentrationTrendsCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryShareTrendsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryShareTrendsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryShareTrendsCsv,
          renderAiAnswerCitationSourceCategoryShareTrendsCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryShareTrendsHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryShareTrendsHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryShareTrendsHtml,
          renderAiAnswerCitationSourceCategoryShareTrendsHtml(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryMixDecompositionHtml) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-category-mix-decomposition-html requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryMixDecompositionHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryMixDecompositionHtml,
          renderAiAnswerCitationSourceCategoryMixDecompositionHtml(
            report,
            baselineReportForAnswer,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryConcentrationTrendsHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryConcentrationTrendsHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryConcentrationTrendsHtml,
          renderAiAnswerCitationSourceCategoryConcentrationTrendsHtml(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryMixDecompositionCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-category-mix-decomposition-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryMixDecompositionCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryMixDecompositionCsv,
          renderAiAnswerCitationSourceCategoryMixDecompositionCsv(
            report,
            baselineReportForAnswer,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryPromptCoverageCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryPromptCoverageCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryPromptCoverageCsv,
          renderAiAnswerCitationSourceCategoryPromptCoverageCsv(
            report,
            args.geoAnswerSourceCategories ?? [],
            baselineReportForAnswer
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryPromptDetailsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryPromptDetailsCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryPromptDetailsCsv,
          renderAiAnswerCitationSourceCategoryPromptDetailsCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryTrendsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryTrendsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryTrendsCsv,
          renderAiAnswerCitationSourceCategoryTrendsCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryProviderPairsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryProviderPairsCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryProviderPairsCsv,
          renderAiAnswerCitationSourceCategoryProviderPairsCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryCooccurrenceCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryCooccurrenceCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryCooccurrenceCsv,
          renderAiAnswerCitationSourceCategoryCooccurrenceCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryPathFamiliesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryPathFamiliesCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryPathFamiliesCsv,
          renderAiAnswerCitationSourceCategoryPathFamiliesCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceCategoryPathFamilyComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-category-path-family-comparison-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryPathFamilyComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryPathFamilyComparisonCsv,
          renderAiAnswerCitationSourceCategoryPathFamilyComparisonCsv(
            report,
            baselineReportForAnswer,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerDomainPromptCoverageComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerDomainPromptCoverageComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerDomainPromptCoverageComparisonCsv,
          renderAiAnswerCitationDomainPromptCoverageComparisonCsv(report, baselineReportForAnswer!),
          'utf8'
        );
      }
      const needsPairedDomainReach =
        Boolean(
          args.geoAnswerDomainPairedReachComparisonCsv ||
          args.geoAnswerDomainPairedReachComparisonJson
        ) || args.failOnGeoAnswerDomainPairedReachDrop !== undefined;
      if (needsPairedDomainReach && !baselineReportForAnswer)
        throw new Error('Paired domain reach analysis requires a baseline answer sample.');
      const pairedDomainReachCsv = needsPairedDomainReach
        ? renderAiAnswerCitationDomainPairedReachComparisonCsv(report, baselineReportForAnswer!)
        : undefined;
      if (args.geoAnswerDomainPairedReachComparisonJson) {
        fs.mkdirSync(path.dirname(args.geoAnswerDomainPairedReachComparisonJson), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerDomainPairedReachComparisonJson,
          renderAiAnswerCitationDomainPairedReachComparisonJsonFromCsv(
            pairedDomainReachCsv!,
            report,
            baselineReportForAnswer!
          ),
          'utf8'
        );
      }
      if (args.geoAnswerDomainPairedReachComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-domain-paired-reach-comparison-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerDomainPairedReachComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerDomainPairedReachComparisonCsv,
          pairedDomainReachCsv!,
          'utf8'
        );
      }
      if (args.geoAnswerPageOpportunitiesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunitiesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPageOpportunitiesCsv,
          renderAiAnswerCitationPageOpportunitiesCsv(
            (inputData as AiAnswerCitationObservationInputFile).observations,
            args.geoAnswerOwnedDomains ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPageOpportunityPathFamiliesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityPathFamiliesCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPageOpportunityPathFamiliesCsv,
          renderAiAnswerCitationPageOpportunityPathFamiliesCsv(
            (inputData as AiAnswerCitationObservationInputFile).observations,
            args.geoAnswerOwnedDomains ?? [],
            args.geoAnswerPageOpportunityPathDepth ?? 2
          ),
          'utf8'
        );
      }
      if (
        args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv ||
        args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml
      ) {
        const pageOpportunityPathFamilyDepthSweepCsv =
          renderAiAnswerCitationPageOpportunityPathFamilyDepthSweepCsv(
            (inputData as AiAnswerCitationObservationInputFile).observations,
            args.geoAnswerOwnedDomains ?? []
          );
        if (args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv) {
          fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv,
            pageOpportunityPathFamilyDepthSweepCsv,
            'utf8'
          );
        }
        if (args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml) {
          fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml,
            renderAiAnswerCitationPageOpportunityPathFamilyDepthSweepHtmlFromCsv(
              pageOpportunityPathFamilyDepthSweepCsv
            ),
            'utf8'
          );
        }
      }
      let pageOpportunityPathFamilyTrendsCsv: string | undefined;
      if (
        args.geoAnswerPageOpportunityPathFamilyTrendsCsv ||
        args.geoAnswerPageOpportunityPathFamilyTrendsHtml ||
        args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise !== undefined
      ) {
        pageOpportunityPathFamilyTrendsCsv =
          renderAiAnswerCitationPageOpportunityPathFamilyTrendsCsv(
            (inputData as AiAnswerCitationObservationInputFile).observations,
            args.geoAnswerOwnedDomains ?? [],
            args.geoAnswerPageOpportunityPathDepth ?? 2
          );
        if (args.geoAnswerPageOpportunityPathFamilyTrendsCsv) {
          fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityPathFamilyTrendsCsv), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerPageOpportunityPathFamilyTrendsCsv,
            pageOpportunityPathFamilyTrendsCsv,
            'utf8'
          );
        }
        if (args.geoAnswerPageOpportunityPathFamilyTrendsHtml) {
          fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityPathFamilyTrendsHtml), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerPageOpportunityPathFamilyTrendsHtml,
            renderAiAnswerCitationPageOpportunityPathFamilyTrendsHtmlFromCsv(
              pageOpportunityPathFamilyTrendsCsv
            ),
            'utf8'
          );
        }
      }
      let pageOpportunityTrendsCsv: string | undefined;
      if (args.geoAnswerPageOpportunityTrendsCsv) {
        pageOpportunityTrendsCsv = renderAiAnswerCitationPageOpportunityTrendsCsv(
          (inputData as AiAnswerCitationObservationInputFile).observations,
          args.geoAnswerOwnedDomains ?? []
        );
        fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityTrendsCsv), { recursive: true });
        fs.writeFileSync(args.geoAnswerPageOpportunityTrendsCsv, pageOpportunityTrendsCsv, 'utf8');
      }
      if (args.failOnGeoAnswerPageOpportunityMonthlyRise !== undefined) {
        if (!pageOpportunityTrendsCsv)
          throw new Error(
            'Monthly page-opportunity rise gating requires --geo-answer-page-opportunity-trends-csv.'
          );
        const assessment = assessAiAnswerCitationPageOpportunityMonthlyRiseGateFromCsv(
          pageOpportunityTrendsCsv,
          args.failOnGeoAnswerPageOpportunityMonthlyRise,
          args.failOnGeoAnswerPageOpportunityMonthlyAlpha,
          args.failOnGeoAnswerPageOpportunityMonthlyMinPrompts
        );
        process.stderr.write(
          `Monthly page-opportunity rise gate: reach increase ≥ ${assessment.thresholdPercentagePoints} pp; adjusted α ${assessment.alpha}; minimum ${assessment.minimumComparablePromptGroups} matched prompts; ${assessment.eligibleComparisons}/${assessment.evaluatedComparisons} eligible provider/page/month comparisons; Holm family ${assessment.holmFamilySize ?? 'unavailable'}; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const failure of assessment.failures.slice(0, 10)) {
          process.stderr.write(
            `❌ ${failure.provider} · ${failure.pageUrl} (${failure.previousMonthUtc} → ${failure.monthUtc}): +${failure.reachChangePercentagePoints} pp across ${failure.comparablePromptGroups} prompts (Holm p=${failure.holmAdjustedPValue.toPrecision(4)}).\n`
          );
        }
        if (assessment.failures.length > 10)
          process.stderr.write(
            `… and ${assessment.failures.length - 10} more page-opportunity rises exceeded the gate.\n`
          );
        for (const reason of assessment.incompleteReasons)
          process.stderr.write(`  Incomplete: ${reason}\n`);
        if (args.geoAnswerPageOpportunityMonthlyGateJson) {
          fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityMonthlyGateJson), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerPageOpportunityMonthlyGateJson,
            renderAiAnswerCitationPageOpportunityMonthlyRiseGateJson(assessment),
            'utf8'
          );
        }
        if (!assessment.complete || assessment.exceeded) process.exitCode = 1;
      }
      if (args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise !== undefined) {
        if (!pageOpportunityPathFamilyTrendsCsv)
          throw new Error(
            'Monthly page-opportunity path-family rise gating requires --geo-answer-page-opportunity-path-family-trends-csv.'
          );
        const assessment = assessAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateFromCsv(
          pageOpportunityPathFamilyTrendsCsv,
          args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise,
          args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyAlpha,
          args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyMinPrompts
        );
        process.stderr.write(
          `Monthly page-opportunity path-family rise gate: reach increase ≥ ${assessment.thresholdPercentagePoints} pp; adjusted α ${assessment.alpha}; minimum ${assessment.minimumComparablePromptGroups} matched prompts; ${assessment.eligibleComparisons}/${assessment.evaluatedComparisons} eligible provider/family/month comparisons; Holm family ${assessment.holmFamilySize ?? 'unavailable'}; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const failure of assessment.failures.slice(0, 10)) {
          process.stderr.write(
            `❌ ${failure.provider} · ${failure.pathFamily} (${failure.previousMonthUtc} → ${failure.monthUtc}): +${failure.reachChangePercentagePoints} pp across ${failure.comparablePromptGroups} prompts (Holm p=${failure.holmAdjustedPValue.toPrecision(4)}).\n`
          );
        }
        if (assessment.failures.length > 10)
          process.stderr.write(
            `… and ${assessment.failures.length - 10} more page-opportunity path-family rises exceeded the gate.\n`
          );
        for (const reason of assessment.incompleteReasons)
          process.stderr.write(`  Incomplete: ${reason}\n`);
        if (args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson) {
          fs.mkdirSync(path.dirname(args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson,
            renderAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateJson(assessment),
            'utf8'
          );
        }
        if (!assessment.complete || assessment.exceeded) process.exitCode = 1;
      }
      if (args.failOnGeoAnswerDomainPairedReachDrop !== undefined) {
        if (!baselineReportForAnswer)
          throw new Error('Paired domain reach gating requires a baseline answer sample.');
        const assessment = assessAiAnswerCitationDomainPairedReachDropGateFromCsv(
          pairedDomainReachCsv!,
          args.failOnGeoAnswerDomainPairedReachDrop,
          args.failOnGeoAnswerDomainPairedReachAlpha,
          args.failOnGeoAnswerDomainPairedReachMinPrompts
        );
        process.stderr.write(
          `Paired domain reach gate: drop ≥ ${assessment.thresholdPercentagePoints} pp; adjusted α ${assessment.alpha}; minimum ${assessment.minimumComparablePromptGroups} matched prompts; ${assessment.eligibleComparisons}/${assessment.evaluatedComparisons} eligible provider/domain comparisons; Holm family ${assessment.holmFamilySize ?? 'unavailable'}; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const failure of assessment.failures.slice(0, 10)) {
          process.stderr.write(
            `❌ ${failure.provider} · ${failure.domain}: ${failure.reachChangePercentagePoints} pp across ${failure.comparablePromptGroups} prompts (Holm p=${failure.holmAdjustedPValue.toPrecision(4)}).\n`
          );
        }
        if (assessment.failures.length > 10)
          process.stderr.write(
            `… and ${assessment.failures.length - 10} more domain losses exceeded the gate.\n`
          );
        for (const reason of assessment.incompleteReasons)
          process.stderr.write(`  Incomplete: ${reason}.\n`);
        if (args.geoAnswerDomainPairedReachGateJson) {
          fs.mkdirSync(path.dirname(args.geoAnswerDomainPairedReachGateJson), { recursive: true });
          fs.writeFileSync(
            args.geoAnswerDomainPairedReachGateJson,
            renderAiAnswerCitationDomainPairedReachDropGateJson(assessment),
            'utf8'
          );
          process.stderr.write(
            `Paired domain reach gate JSON saved to ${args.geoAnswerDomainPairedReachGateJson}\n`
          );
        }
        if (!assessment.complete || assessment.exceeded) process.exitCode = 1;
      }
      const needsPairedPageReach =
        Boolean(
          args.geoAnswerPagePairedReachComparisonCsv || args.geoAnswerPagePairedReachComparisonJson
        ) || args.failOnGeoAnswerPagePairedReachDrop !== undefined;
      if (needsPairedPageReach && !baselineInputData)
        throw new Error('Paired page reach analysis requires a baseline answer sample.');
      const pairedPageReach = needsPairedPageReach
        ? compareAiAnswerCitationPagePairedReach(
            (inputData as AiAnswerCitationObservationInputFile).observations,
            (baselineInputData as AiAnswerCitationObservationInputFile).observations,
            args.geoAnswerPagePairedReachOwnedOnly ? args.geoAnswerOwnedDomains : undefined
          )
        : undefined;
      if (args.geoAnswerPagePairedReachComparisonJson && pairedPageReach) {
        fs.mkdirSync(path.dirname(args.geoAnswerPagePairedReachComparisonJson), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPagePairedReachComparisonJson,
          renderAiAnswerCitationPagePairedReachComparisonJson(pairedPageReach),
          'utf8'
        );
      }
      if (args.geoAnswerPagePairedReachComparisonCsv && pairedPageReach) {
        fs.mkdirSync(path.dirname(args.geoAnswerPagePairedReachComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPagePairedReachComparisonCsv,
          renderAiAnswerCitationPagePairedReachComparisonCsv(pairedPageReach),
          'utf8'
        );
      }
      if (args.failOnGeoAnswerPagePairedReachDrop !== undefined && pairedPageReach) {
        const assessment = assessAiAnswerCitationPagePairedReachDropGate(
          pairedPageReach,
          args.failOnGeoAnswerPagePairedReachDrop,
          args.failOnGeoAnswerPagePairedReachAlpha,
          args.failOnGeoAnswerPagePairedReachMinPrompts,
          args.geoAnswerPagePairedReachMetric
        );
        process.stderr.write(
          `Paired page ${assessment.metric} gate: drop ≥ ${assessment.thresholdPercentagePoints} pp; adjusted α ${assessment.alpha}; minimum ${assessment.minimumComparablePromptGroups} matched prompts; ${assessment.eligibleComparisons}/${assessment.evaluatedComparisons} eligible provider/page comparisons; Holm family ${assessment.holmFamilySize ?? 'unavailable'}; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const failure of assessment.failures.slice(0, 10)) {
          process.stderr.write(
            `❌ ${failure.provider} · ${failure.pageUrl}: ${failure.reachChangePercentagePoints} pp across ${failure.comparablePromptGroups} prompts (Holm p=${failure.holmAdjustedPValue.toPrecision(4)}).\n`
          );
        }
        if (assessment.failures.length > 10)
          process.stderr.write(
            `… and ${assessment.failures.length - 10} more page losses exceeded the gate.\n`
          );
        for (const reason of assessment.incompleteReasons)
          process.stderr.write(`  Incomplete: ${reason}.\n`);
        if (args.geoAnswerPagePairedReachGateJson) {
          fs.mkdirSync(path.dirname(args.geoAnswerPagePairedReachGateJson), { recursive: true });
          fs.writeFileSync(
            args.geoAnswerPagePairedReachGateJson,
            renderAiAnswerCitationPagePairedReachDropGateJson(assessment),
            'utf8'
          );
          process.stderr.write(
            `Paired page reach gate JSON saved to ${args.geoAnswerPagePairedReachGateJson}\n`
          );
        }
        if (!assessment.complete || assessment.exceeded) process.exitCode = 1;
      }
      if (args.geoAnswerSourceDiversityUncertaintyCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceDiversityUncertaintyCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceDiversityUncertaintyCsv,
          renderAiAnswerCitationSourceDiversityUncertaintyCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerSourceDiversityUncertaintyHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceDiversityUncertaintyHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceDiversityUncertaintyHtml,
          renderAiAnswerCitationSourceDiversityUncertaintyHtml(report),
          'utf8'
        );
      }
      if (args.geoAnswerSourceDiversityComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-diversity-comparison-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceDiversityComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceDiversityComparisonCsv,
          renderAiAnswerCitationSourceDiversityComparisonCsv(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerSourceDiversityComparisonHtml) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-diversity-comparison-html requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceDiversityComparisonHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceDiversityComparisonHtml,
          renderAiAnswerCitationSourceDiversityComparisonHtml(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerProviderSourceDivergenceCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderSourceDivergenceCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerProviderSourceDivergenceCsv,
          renderAiAnswerCitationProviderSourceDivergenceCsv(report),
          'utf8'
        );
      }
      if (
        args.geoAnswerSourcePortfolioDriftCsv ||
        args.geoAnswerSourcePortfolioDriftHtml ||
        args.geoAnswerSourcePortfolioDriftJson
      ) {
        if (!baselineReportForAnswer)
          throw new Error('source-portfolio drift outputs require a baseline answer sample.');
        const driftCsv = renderAiAnswerCitationSourcePortfolioDriftCsv(
          report,
          baselineReportForAnswer
        );
        if (args.geoAnswerSourcePortfolioDriftCsv) {
          fs.mkdirSync(path.dirname(args.geoAnswerSourcePortfolioDriftCsv), { recursive: true });
          fs.writeFileSync(args.geoAnswerSourcePortfolioDriftCsv, driftCsv, 'utf8');
        }
        if (args.geoAnswerSourcePortfolioDriftHtml) {
          fs.mkdirSync(path.dirname(args.geoAnswerSourcePortfolioDriftHtml), { recursive: true });
          fs.writeFileSync(
            args.geoAnswerSourcePortfolioDriftHtml,
            renderAiAnswerCitationSourcePortfolioDriftHtmlFromCsv(driftCsv),
            'utf8'
          );
        }
        if (args.geoAnswerSourcePortfolioDriftJson) {
          fs.mkdirSync(path.dirname(args.geoAnswerSourcePortfolioDriftJson), { recursive: true });
          fs.writeFileSync(
            args.geoAnswerSourcePortfolioDriftJson,
            renderAiAnswerCitationSourcePortfolioDriftJsonFromCsv(driftCsv),
            'utf8'
          );
        }
      }
      if (
        args.geoAnswerSourcePortfolioAttributionCsv ||
        args.geoAnswerSourcePortfolioAttributionJson ||
        args.geoAnswerSourcePortfolioAttributionHtml
      ) {
        if (!baselineReportForAnswer)
          throw new Error('source-portfolio attribution outputs require a baseline answer sample.');
        const attributionArtifacts = renderAiAnswerCitationSourcePortfolioAttributionArtifacts(
          report,
          baselineReportForAnswer,
          {
            csv: Boolean(args.geoAnswerSourcePortfolioAttributionCsv),
            json: Boolean(args.geoAnswerSourcePortfolioAttributionJson),
            html: Boolean(args.geoAnswerSourcePortfolioAttributionHtml),
          }
        );
        if (args.geoAnswerSourcePortfolioAttributionCsv && attributionArtifacts.csv !== undefined) {
          fs.mkdirSync(path.dirname(args.geoAnswerSourcePortfolioAttributionCsv), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerSourcePortfolioAttributionCsv,
            attributionArtifacts.csv,
            'utf8'
          );
        }
        if (
          args.geoAnswerSourcePortfolioAttributionJson &&
          attributionArtifacts.json !== undefined
        ) {
          fs.mkdirSync(path.dirname(args.geoAnswerSourcePortfolioAttributionJson), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerSourcePortfolioAttributionJson,
            attributionArtifacts.json,
            'utf8'
          );
        }
        if (
          args.geoAnswerSourcePortfolioAttributionHtml &&
          attributionArtifacts.html !== undefined
        ) {
          fs.mkdirSync(path.dirname(args.geoAnswerSourcePortfolioAttributionHtml), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerSourcePortfolioAttributionHtml,
            attributionArtifacts.html,
            'utf8'
          );
        }
      }
      if (
        args.failOnGeoAnswerOwnedSourceShareDrop !== undefined ||
        args.failOnGeoAnswerOwnedSourceShareDropLowerCi !== undefined ||
        args.failOnGeoAnswerOwnedSourceShareSignTestAlpha !== undefined
      ) {
        if (!baselineReportForAnswer)
          throw new Error('an owned source-share gate requires a baseline answer sample.');
        const assessment = assessAiAnswerCitationOwnedSourceShareDrop(
          report,
          baselineReportForAnswer,
          args.failOnGeoAnswerOwnedSourceShareDrop ?? null,
          args.failOnGeoAnswerOwnedSourceShareMinPrompts ?? 10,
          args.failOnGeoAnswerOwnedSourceShareDropLowerCi,
          args.failOnGeoAnswerOwnedSourceShareSignTestAlpha
        );
        if (args.geoAnswerOwnedSourceShareGateCsv) {
          fs.mkdirSync(path.dirname(args.geoAnswerOwnedSourceShareGateCsv), { recursive: true });
          fs.writeFileSync(
            args.geoAnswerOwnedSourceShareGateCsv,
            renderAiAnswerCitationOwnedSourceShareGateCsv(assessment),
            'utf8'
          );
        }
        if (args.geoAnswerOwnedSourceShareGateJson) {
          fs.mkdirSync(path.dirname(args.geoAnswerOwnedSourceShareGateJson), { recursive: true });
          fs.writeFileSync(
            args.geoAnswerOwnedSourceShareGateJson,
            renderAiAnswerCitationOwnedSourceShareGateJson(assessment),
            'utf8'
          );
        }
        process.stderr.write(
          `Owned source-share gate: ${assessment.status}; point-decline threshold ${assessment.thresholdPercentagePoints === null ? 'disabled' : `${assessment.thresholdPercentagePoints} pp`}; 95% lower-CI threshold ${assessment.lowerCiThresholdPercentagePoints === null ? 'disabled' : `${assessment.lowerCiThresholdPercentagePoints} pp`}; exact sign-test gate ${assessment.signTestAlpha === null ? 'disabled' : `alpha ${assessment.signTestAlpha} for declines above ${assessment.signTestDeclineThresholdPercentagePoints} pp`}; minimum ${assessment.minimumMatchedPromptGroups} matched both-cited prompts per provider; ${assessment.providersEvaluated} providers evaluated; ${assessment.bootstrapDrawsUsed} bootstrap draws used.\n`
        );
        for (const row of assessment.rows) {
          if (row.state !== 'available') {
            process.stderr.write(
              `❌ ${row.provider}: ${row.state} with ${row.matchedBothCitedPromptGroups} matched both-cited prompts.\n`
            );
            continue;
          }
          const pointExceeded = row.pointThresholdExceeded === true;
          const lowerCiExceeded = row.lowerCiThresholdExceeded === true;
          const confidenceIncomplete =
            assessment.lowerCiThresholdPercentagePoints !== null &&
            row.lowerCiThresholdExceeded === null;
          const signTestFailed = row.signTestThresholdExceeded === true;
          const signTestIncomplete =
            assessment.signTestAlpha !== null && row.signTestState !== 'available';
          const signTestDetail =
            assessment.signTestAlpha === null
              ? ''
              : `; exact sign test ${row.signTestDeclinePromptGroups}/${row.signTestEligiblePromptGroups} prompts above ${assessment.signTestDeclineThresholdPercentagePoints} pp, Holm p ${row.signTestHolmAdjustedPValue?.toPrecision(3) ?? `unavailable (${row.signTestState})`}`;
          process.stderr.write(
            `${pointExceeded || lowerCiExceeded || confidenceIncomplete || signTestFailed || signTestIncomplete ? '❌' : '✓'} ${row.provider}: owned prompt-balanced citation-event share ${row.baselinePromptBalancedOwnedSharePercent!.toFixed(2)}% → ${row.currentPromptBalancedOwnedSharePercent!.toFixed(2)}% (decline ${row.declinePercentagePoints!.toFixed(2)} pp${row.bootstrapState === 'available' ? `; 95% decline interval ${row.declineCi95LowerPercentagePoints!.toFixed(2)} to ${row.declineCi95UpperPercentagePoints!.toFixed(2)} pp (${row.bootstrapResamples} resamples)` : confidenceIncomplete ? `; 95% decline interval unavailable (${row.bootstrapState})` : ''}${signTestDetail}; ${row.matchedBothCitedPromptGroups} prompts).\n`
          );
        }
        for (const reason of assessment.reasons) process.stderr.write(`  Incomplete: ${reason}.\n`);
        if (assessment.status !== 'passed') process.exitCode = 1;
      }
      const monthlySourceCategoryGateChecks: Array<{ name: string; assessment: unknown }> = [];
      if (args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove !== undefined) {
        const assessment = assessAiAnswerCitationSourceCategoryMonthlyJsdGate(
          report,
          args.geoAnswerSourceCategories ?? [],
          args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove,
          args.failOnGeoAnswerSourceCategoryMonthlyMinEvents
        );
        monthlySourceCategoryGateChecks.push({ name: 'monthly-jsd', assessment });
        process.stderr.write(
          `Monthly source-category JSD gate: threshold ${assessment.thresholdBits} bits; minimum ${assessment.minimumMappedCitationEvents} mapped events per month; ${assessment.comparableCohortMonths} provider/cohort month comparisons; ${assessment.exceededCohortMonthCount} exceeded; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const row of assessment.exceededCohortMonths.slice(0, 10)) {
          process.stderr.write(
            `❌ ${row.provider}${row.topic ? ` · ${row.topic}` : ''}${row.intent ? ` / ${row.intent}` : ''}: ${row.previousMonth} → ${row.month}, ${row.jsdBits} bits.\n`
          );
        }
        if (assessment.exceededCohortMonthCount > 10)
          process.stderr.write(
            `… and ${assessment.exceededCohortMonthCount - 10} more cohort-month comparisons exceeded the threshold.\n`
          );
        if (assessment.incompleteCohortMonths > 0)
          process.stderr.write(`  Incomplete comparisons: ${assessment.incompleteCohortMonths}.\n`);
        if (assessment.belowSupportCohortMonths > 0)
          process.stderr.write(
            `  Comparisons below mapped-event support floor: ${assessment.belowSupportCohortMonths}.\n`
          );
        if (assessment.monthlyCohortProfilesTruncated || assessment.trendRowsTruncated)
          process.stderr.write('  Retained monthly comparison detail was capped.\n');
        if (!assessment.complete || assessment.exceededCohortMonthCount > 0) process.exitCode = 1;
      }
      if (args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove !== undefined) {
        const assessment = assessAiAnswerCitationSourceCategoryMonthlyHhiRiseGate(
          report,
          args.geoAnswerSourceCategories ?? [],
          args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove,
          args.failOnGeoAnswerSourceCategoryMonthlyMinEvents
        );
        monthlySourceCategoryGateChecks.push({
          name: 'monthly-hhi-rise-all-citations',
          assessment,
        });
        process.stderr.write(
          `Monthly source-category HHI-rise gate: threshold ${assessment.thresholdRise}; minimum ${assessment.minimumMappedCitationEvents} mapped citation events per month; ${assessment.comparableCohortMonths} provider/cohort month comparisons; ${assessment.exceededCohortMonthCount} exceeded; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const row of assessment.exceededCohortMonths.slice(0, 10)) {
          process.stderr.write(
            `❌ ${row.provider}${row.topic ? ` · ${row.topic}` : ''}${row.intent ? ` / ${row.intent}` : ''}: ${row.previousMonth} → ${row.month}, HHI ${row.previousHhi} → ${row.currentHhi} (+${row.rise}).\n`
          );
        }
        if (assessment.exceededCohortMonthCount > 10)
          process.stderr.write(
            `… and ${assessment.exceededCohortMonthCount - 10} more cohort-month comparisons exceeded the threshold.\n`
          );
        if (assessment.incompleteCohortMonths > 0)
          process.stderr.write(`  Incomplete comparisons: ${assessment.incompleteCohortMonths}.\n`);
        if (assessment.belowSupportCohortMonths > 0)
          process.stderr.write(
            `  Comparisons below mapped-event support floor: ${assessment.belowSupportCohortMonths}.\n`
          );
        if (assessment.monthlyCohortProfilesTruncated || assessment.trendRowsTruncated)
          process.stderr.write('  Retained monthly comparison detail was capped.\n');
        if (!assessment.complete || assessment.exceededCohortMonthCount > 0) process.exitCode = 1;
      }
      if (args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove !== undefined) {
        const assessment = assessAiAnswerCitationSourceCategoryMonthlyHhiRiseGate(
          report,
          args.geoAnswerSourceCategories ?? [],
          args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove,
          args.failOnGeoAnswerSourceCategoryMonthlyMinEvents,
          'top-three'
        );
        monthlySourceCategoryGateChecks.push({ name: 'monthly-hhi-rise-top-three', assessment });
        process.stderr.write(
          `Monthly top-three source-category HHI-rise gate: threshold ${assessment.thresholdRise}; minimum ${assessment.minimumMappedCitationEvents} mapped top-three events on each sampled month; ${assessment.comparableCohortMonths} cohort-month transitions evaluated; ${assessment.exceededCohortMonthCount} exceeded; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const row of assessment.exceededCohortMonths.slice(0, 10)) {
          process.stderr.write(
            `❌ ${row.provider}${row.topic ? ` · ${row.topic}` : ''}${row.intent ? ` / ${row.intent}` : ''} · ${row.previousMonth} → ${row.month}: top-three HHI ${row.previousHhi} → ${row.currentHhi} (+${row.rise}).\n`
          );
        }
        if (assessment.exceededCohortMonthCount > 10)
          process.stderr.write(
            `… and ${assessment.exceededCohortMonthCount - 10} more cohort-month transitions exceeded the threshold.\n`
          );
        if (assessment.incompleteCohortMonths > 0)
          process.stderr.write(`  Incomplete comparisons: ${assessment.incompleteCohortMonths}.\n`);
        if (assessment.belowSupportCohortMonths > 0)
          process.stderr.write(
            `  Comparisons below mapped top-three event support floor: ${assessment.belowSupportCohortMonths}.\n`
          );
        if (assessment.monthlyCohortProfilesTruncated || assessment.trendRowsTruncated)
          process.stderr.write('  Retained monthly comparison detail was capped.\n');
        if (!assessment.complete || assessment.exceededCohortMonthCount > 0) process.exitCode = 1;
      }
      if (args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove !== undefined) {
        const assessment = assessAiAnswerCitationSourceCategoryMonthlyHhiAboveGate(
          report,
          args.geoAnswerSourceCategories ?? [],
          args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove,
          args.failOnGeoAnswerSourceCategoryMonthlyMinEvents
        );
        monthlySourceCategoryGateChecks.push({
          name: 'monthly-hhi-absolute-all-citations',
          assessment,
        });
        process.stderr.write(
          `Monthly source-category HHI gate: threshold ${assessment.thresholdHhi}; minimum ${assessment.minimumMappedCitationEvents} mapped citation events; ${assessment.evaluatedCohortMonths} provider/cohort months evaluated; ${assessment.exceededCohortMonthCount} exceeded; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const row of assessment.exceededCohortMonths.slice(0, 10)) {
          process.stderr.write(
            `❌ ${row.provider}${row.topic ? ` · ${row.topic}` : ''}${row.intent ? ` / ${row.intent}` : ''}: ${row.month}, HHI ${row.hhi} on ${row.mappedCitationEvents} mapped events.\n`
          );
        }
        if (assessment.exceededCohortMonthCount > 10)
          process.stderr.write(
            `… and ${assessment.exceededCohortMonthCount - 10} more cohort-months exceeded the threshold.\n`
          );
        if (assessment.incompleteCohortMonths > 0)
          process.stderr.write(
            `  Incomplete cohort-months: ${assessment.incompleteCohortMonths}.\n`
          );
        if (assessment.belowSupportCohortMonths > 0)
          process.stderr.write(
            `  Cohort-months below mapped-event support floor: ${assessment.belowSupportCohortMonths}.\n`
          );
        if (assessment.monthlyCohortProfilesTruncated || assessment.trendRowsTruncated)
          process.stderr.write('  Retained monthly comparison detail was capped.\n');
        if (!assessment.complete || assessment.exceededCohortMonthCount > 0) process.exitCode = 1;
      }
      if (args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove !== undefined) {
        const assessment = assessAiAnswerCitationSourceCategoryMonthlyHhiAboveGate(
          report,
          args.geoAnswerSourceCategories ?? [],
          args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove,
          args.failOnGeoAnswerSourceCategoryMonthlyMinEvents,
          'top-three'
        );
        monthlySourceCategoryGateChecks.push({
          name: 'monthly-hhi-absolute-top-three',
          assessment,
        });
        process.stderr.write(
          `Monthly top-three source-category HHI gate: threshold ${assessment.thresholdHhi}; minimum ${assessment.minimumMappedCitationEvents} mapped top-three events; ${assessment.evaluatedCohortMonths} provider/cohort months evaluated; ${assessment.exceededCohortMonthCount} exceeded; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const row of assessment.exceededCohortMonths.slice(0, 10)) {
          process.stderr.write(
            `❌ ${row.provider}${row.topic ? ` · ${row.topic}` : ''}${row.intent ? ` / ${row.intent}` : ''}: ${row.month}, top-three HHI ${row.hhi} on ${row.mappedCitationEvents} mapped top-three events.\n`
          );
        }
        if (assessment.exceededCohortMonthCount > 10)
          process.stderr.write(
            `… and ${assessment.exceededCohortMonthCount - 10} more cohort-months exceeded the threshold.\n`
          );
        if (assessment.incompleteCohortMonths > 0)
          process.stderr.write(
            `  Incomplete cohort-months: ${assessment.incompleteCohortMonths}.\n`
          );
        if (assessment.belowSupportCohortMonths > 0)
          process.stderr.write(
            `  Cohort-months below mapped top-three event support floor: ${assessment.belowSupportCohortMonths}.\n`
          );
        if (assessment.monthlyCohortProfilesTruncated || assessment.trendRowsTruncated)
          process.stderr.write('  Retained monthly comparison detail was capped.\n');
        if (!assessment.complete || assessment.exceededCohortMonthCount > 0) process.exitCode = 1;
      }
      if (args.failOnGeoAnswerSourceCategoryShareDrop !== undefined) {
        const assessment = assessAiAnswerCitationSourceCategoryShareDropGate(
          report,
          args.geoAnswerSourceCategories ?? [],
          args.failOnGeoAnswerSourceCategoryShareDrop,
          args.failOnGeoAnswerSourceCategoryMonthlyMinEvents
        );
        monthlySourceCategoryGateChecks.push({ name: 'monthly-share-drop', assessment });
        process.stderr.write(
          `Monthly source-category share gate: maximum decline ${assessment.thresholdPercentagePoints} pp; minimum ${assessment.minimumMappedCitationEvents} mapped events per month; ${assessment.comparableCategoryCohortMonths} category/cohort month comparisons; ${assessment.exceededCategoryCohortMonthCount} exceeded; ${assessment.complete ? 'complete support' : 'incomplete support'}.\n`
        );
        for (const row of assessment.exceededCategoryCohortMonths.slice(0, 10)) {
          process.stderr.write(
            `❌ ${row.provider}${row.topic ? ` · ${row.topic}` : ''}${row.intent ? ` / ${row.intent}` : ''} · ${row.category}: ${row.previousMonth} → ${row.month}, decline ${row.declinePercentagePoints} pp.\n`
          );
        }
        if (assessment.exceededCategoryCohortMonthCount > 10)
          process.stderr.write(
            `… and ${assessment.exceededCategoryCohortMonthCount - 10} more category/cohort month comparisons exceeded the threshold.\n`
          );
        if (assessment.incompleteCategoryCohortMonths > 0)
          process.stderr.write(
            `  Incomplete comparisons: ${assessment.incompleteCategoryCohortMonths}.\n`
          );
        if (assessment.belowSupportCategoryCohortMonths > 0)
          process.stderr.write(
            `  Category comparisons below mapped-event support floor: ${assessment.belowSupportCategoryCohortMonths}.\n`
          );
        if (assessment.monthlyCohortProfilesTruncated || assessment.trendRowsTruncated)
          process.stderr.write('  Retained monthly comparison detail was capped.\n');
        if (!assessment.complete || assessment.exceededCategoryCohortMonthCount > 0)
          process.exitCode = 1;
      }
      if (args.geoAnswerSourceCategoryMonthlyGatesJson) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryMonthlyGatesJson), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerSourceCategoryMonthlyGatesJson,
          `${JSON.stringify(
            {
              source: 'Aviary monthly source-category gate assessments',
              schemaVersion: 1,
              checks: monthlySourceCategoryGateChecks,
            },
            null,
            2
          )}\n`,
          'utf8'
        );
      }
      if (args.failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove !== undefined) {
        if (!baselineReportForAnswer)
          throw new Error(
            'Prompt-balanced source-category JSD gating requires a baseline answer sample.'
          );
        const assessment = assessAiAnswerCitationSourceCategoryPromptBalancedJsdGate(
          report,
          baselineReportForAnswer,
          args.geoAnswerSourceCategories ?? [],
          args.failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove,
          args.failOnGeoAnswerSourceCategoryPromptBalancedJsdMinPrompts
        );
        process.stderr.write(
          `Prompt-balanced source-category JSD gate: threshold ${assessment.thresholdBits} bits; ${assessment.complete ? 'complete support' : 'incomplete support'}; ${assessment.comparablePromptGroups}/${assessment.minimumComparablePromptGroups} minimum comparable prompts; bootstrap ${assessment.bootstrapState}.\n`
        );
        process.stderr.write(
          `  Prompt-balanced JSD ${assessment.promptBalancedJsdBits?.toFixed(4) ?? 'unavailable'} bits; 95% interval ${assessment.promptBalancedJsdCi95LowerBits?.toFixed(4) ?? 'unavailable'} to ${assessment.promptBalancedJsdCi95UpperBits?.toFixed(4) ?? 'unavailable'} bits.\n`
        );
        if (args.geoAnswerSourceCategoryPromptBalancedJsdGateJson) {
          fs.mkdirSync(path.dirname(args.geoAnswerSourceCategoryPromptBalancedJsdGateJson), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerSourceCategoryPromptBalancedJsdGateJson,
            renderAiAnswerCitationSourceCategoryPromptBalancedJsdGateJson(assessment),
            'utf8'
          );
          process.stderr.write(
            `Prompt-balanced source-category JSD gate JSON saved to ${args.geoAnswerSourceCategoryPromptBalancedJsdGateJson}\n`
          );
        }
        if (assessment.exceeded)
          process.stderr.write(
            `❌ Prompt-cluster lower bound ${assessment.promptBalancedJsdCi95LowerBits!.toFixed(4)} bits exceeds the configured threshold.\n`
          );
        else if (!assessment.complete)
          process.stderr.write(
            '❌ The category-mix prompt interval or required prompt support is incomplete.\n'
          );
        if (!assessment.complete || assessment.exceeded) process.exitCode = 1;
      }
      if (args.geoAnswerSourceNetworkCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceNetworkCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceNetworkCsv,
          renderAiAnswerCitationSourceNetworkCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerSourceNetworkComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-network-comparison-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceNetworkComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceNetworkComparisonCsv,
          renderAiAnswerCitationSourceNetworkComparisonCsv(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerRankWeightedSourceNetworkCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerRankWeightedSourceNetworkCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerRankWeightedSourceNetworkCsv,
          renderAiAnswerCitationRankWeightedSourceNetworkCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerRankWeightedSourceNetworkComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-rank-weighted-source-network-comparison-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerRankWeightedSourceNetworkComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerRankWeightedSourceNetworkComparisonCsv,
          renderAiAnswerCitationRankWeightedSourceNetworkComparisonCsv(
            report,
            baselineReportForAnswer
          ),
          'utf8'
        );
      }
      if (args.geoAnswerSourceNetworkHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceNetworkHtml), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceNetworkHtml,
          renderAiAnswerCitationSourceNetworkHtml(report),
          'utf8'
        );
      }
      if (args.geoAnswerSourceNetworkComparisonHtml) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-source-network-comparison-html requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerSourceNetworkComparisonHtml), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceNetworkComparisonHtml,
          renderAiAnswerCitationSourceNetworkComparisonHtml(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerProviderSourceNetworkOverlapCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderSourceNetworkOverlapCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderSourceNetworkOverlapCsv,
          renderAiAnswerCitationProviderSourceNetworkOverlapCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerProviderSourceNetworkEdgeDriftCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-provider-source-network-edge-drift-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerProviderSourceNetworkEdgeDriftCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderSourceNetworkEdgeDriftCsv,
          renderAiAnswerCitationProviderSourceNetworkEdgeDriftCsv(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerProviderSourceNetworkEdgeDriftHtml) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-provider-source-network-edge-drift-html requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerProviderSourceNetworkEdgeDriftHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderSourceNetworkEdgeDriftHtml,
          renderAiAnswerCitationProviderSourceNetworkEdgeDriftHtml(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerProviderSourceNetworkEdgeComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderSourceNetworkEdgeComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderSourceNetworkEdgeComparisonCsv,
          renderAiAnswerCitationProviderSourceNetworkEdgeComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerProviderSourceNetworkEdgeHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderSourceNetworkEdgeHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderSourceNetworkEdgeHtml,
          renderAiAnswerCitationProviderSourceNetworkEdgeHtml(report),
          'utf8'
        );
      }
      if (args.geoAnswerOwnedSourceNetworkGapsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerOwnedSourceNetworkGapsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerOwnedSourceNetworkGapsCsv,
          renderAiAnswerCitationOwnedSourceNetworkGapsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerDomainPromptCoverageCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerDomainPromptCoverageCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerDomainPromptCoverageCsv,
          renderAiAnswerCitationDomainPromptCoverageCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerSourceRarefactionCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerSourceRarefactionCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerSourceRarefactionCsv,
          renderAiAnswerCitationSourceRarefactionCsv(
            report,
            args.geoAnswerSourceRarefactionBatchSize,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilySourceRarefactionCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilySourceRarefactionCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilySourceRarefactionCsv,
          renderAiAnswerCitationPromptFamilySourceRarefactionCsv(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceRarefactionBatchSize ?? 10,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilySourceRarefactionHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilySourceRarefactionHtml), {
          recursive: true,
        });
        const panel = renderAiAnswerCitationPromptFamilySourceRarefactionPanelHtml(
          report,
          args.geoAnswerPromptFamilyThreshold ?? 0.85,
          args.geoAnswerSourceRarefactionBatchSize ?? 10,
          args.geoAnswerSourceCategories?.length
            ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
            : []
        );
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt-family source discovery</title><style>body{font:16px system-ui,sans-serif;color:#172033;margin:0 auto;padding:1rem;max-width:1500px;background:#f6f8fb}.panel{background:#fff;border:1px solid #d5dce6;border-radius:14px;padding:1.25rem;margin:1rem 0}.table-wrap{overflow-x:auto}</style></head><body><main><h1>AI answer source discovery by lexical prompt family</h1><p>Offline rarefaction of retained citation sources using connected lexical prompt families as sampling units.</p>${panel}</main></body></html>\n`;
        fs.writeFileSync(args.geoAnswerPromptFamilySourceRarefactionHtml, html, 'utf8');
      }
      if (args.geoAnswerPromptFamilySourceRarefactionSweepCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilySourceRarefactionSweepCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilySourceRarefactionSweepCsv,
          renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepCsv(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceRarefactionBatchSize ?? 10,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilySourceRarefactionSweepHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilySourceRarefactionSweepHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilySourceRarefactionSweepHtml,
          renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepHtml(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceRarefactionBatchSize ?? 10,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPromptFamilySourceOverlapCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPromptFamilySourceOverlapCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderPromptFamilySourceOverlapCsv,
          renderAiAnswerCitationProviderPromptFamilySourceOverlapCsv(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPromptFamilySourceOverlapHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPromptFamilySourceOverlapHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderPromptFamilySourceOverlapHtml,
          renderAiAnswerCitationProviderPromptFamilySourceOverlapHtml(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv,
          renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepCsv(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml,
          renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepHtml(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyPeriodComparisonCsv && baselineReportForAnswer) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyPeriodComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyPeriodComparisonCsv,
          renderAiAnswerCitationPromptFamilyPeriodComparisonCsv(
            baselineReportForAnswer,
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyPeriodComparisonHtml && baselineReportForAnswer) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyPeriodComparisonHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyPeriodComparisonHtml,
          renderAiAnswerCitationPromptFamilyPeriodComparisonHtml(
            baselineReportForAnswer,
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyPeriodComparisonSweepCsv && baselineReportForAnswer) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyPeriodComparisonSweepCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyPeriodComparisonSweepCsv,
          renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepCsv(
            baselineReportForAnswer,
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv && baselineReportForAnswer) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv,
          renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepSummaryCsv(
            baselineReportForAnswer,
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyPeriodComparisonSweepHtml && baselineReportForAnswer) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyPeriodComparisonSweepHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyPeriodComparisonSweepHtml,
          renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepHtml(
            baselineReportForAnswer,
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptSimilarityCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptSimilarityCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPromptSimilarityCsv,
          renderAiAnswerCitationPromptSimilarityCsv(
            report,
            args.geoAnswerPromptSimilarityThreshold
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamiliesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamiliesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPromptFamiliesCsv,
          renderAiAnswerCitationPromptFamiliesCsv(
            report,
            args.geoAnswerPromptFamilyThreshold,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamiliesHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamiliesHtml), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPromptFamiliesHtml,
          renderAiAnswerCitationPromptFamiliesHtml(
            report,
            args.geoAnswerPromptFamilyThreshold,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyInfluenceCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyInfluenceCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyInfluenceCsv,
          renderAiAnswerCitationPromptFamilyInfluenceCsv(
            report,
            args.geoAnswerPromptFamilyThreshold,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyInfluenceHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyInfluenceHtml), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyInfluenceHtml,
          renderAiAnswerCitationPromptFamilyInfluenceHtml(
            report,
            args.geoAnswerPromptFamilyThreshold,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyThresholdSweepCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyThresholdSweepCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyThresholdSweepCsv,
          renderAiAnswerCitationPromptFamilyThresholdSweepCsv(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerPromptFamilyThresholdSweepHtml) {
        fs.mkdirSync(path.dirname(args.geoAnswerPromptFamilyThresholdSweepHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPromptFamilyThresholdSweepHtml,
          renderAiAnswerCitationPromptFamilyThresholdSweepHtml(
            report,
            args.geoAnswerPromptFamilyThreshold ?? 0.85,
            args.geoAnswerSourceCategories?.length
              ? normalizeSourceCategoryMappings(args.geoAnswerSourceCategories)
              : []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerCitationPositionsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCitationPositionsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCitationPositionsCsv,
          renderAiAnswerCitationListPositionsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCitationDateAlignmentCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCitationDateAlignmentCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCitationDateAlignmentCsv,
          renderAiAnswerCitationDateModifiedAlignmentCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerOwnedRankCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerOwnedRankCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerOwnedRankCsv,
          renderAiAnswerCitationOwnedRankCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerOwnedPromptCoverageCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerOwnedPromptCoverageCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerOwnedPromptCoverageCsv,
          renderAiAnswerCitationOwnedPromptCoverageCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerOwnedPromptReachPeriodCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerOwnedPromptReachPeriodCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerOwnedPromptReachPeriodCsv,
          renderAiAnswerCitationOwnedPromptReachPeriodCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerOwnedPromptOpportunitiesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerOwnedPromptOpportunitiesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerOwnedPromptOpportunitiesCsv,
          renderAiAnswerCitationOwnedPromptOpportunitiesCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCompetitiveGapsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCompetitiveGapsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCompetitiveGapsCsv,
          renderAiAnswerCitationCompetitiveGapsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerProviderOwnedGapsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerProviderOwnedGapsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerProviderOwnedGapsCsv,
          renderAiAnswerCitationProviderOwnedGapsCsv(report, args.geoAnswerSourceCategories ?? []),
          'utf8'
        );
      }
      if (args.geoAnswerProviderOwnedGapComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-provider-owned-gap-comparison-csv requires a baseline sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerProviderOwnedGapComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerProviderOwnedGapComparisonCsv,
          renderAiAnswerCitationProviderOwnedGapComparisonCsv(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerCompetitiveGapComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-competitive-gap-comparison-csv requires a baseline sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerCompetitiveGapComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCompetitiveGapComparisonCsv,
          renderAiAnswerCitationCompetitiveGapComparisonCsv(report, baselineReportForAnswer),
          'utf8'
        );
      }
      if (args.geoAnswerOwnedRankComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerOwnedRankComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerOwnedRankComparisonCsv,
          renderAiAnswerCitationOwnedRankComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerOwnedPromptRankComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerOwnedPromptRankComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerOwnedPromptRankComparisonCsv,
          renderAiAnswerCitationOwnedPromptRankComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCoCitationCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCoCitationCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCoCitationCsv,
          renderAiAnswerCitationCoCitationCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCoCitationComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCoCitationComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCoCitationComparisonCsv,
          renderAiAnswerCitationCoCitationComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityMentionsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityMentionsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityMentionsCsv,
          renderAiAnswerCitationEntityMentionsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityPromptDetailsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityPromptDetailsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityPromptDetailsCsv,
          renderAiAnswerCitationEntityPromptDetailsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityPromptProviderPairsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityPromptProviderPairsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityPromptProviderPairsCsv,
          renderAiAnswerCitationEntityPromptProviderPairsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityPromptComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityPromptComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityPromptComparisonCsv,
          renderAiAnswerCitationEntityPromptComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityCoMentionsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityCoMentionsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityCoMentionsCsv,
          renderAiAnswerCitationEntityCoMentionsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityCoMentionComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityCoMentionComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityCoMentionComparisonCsv,
          renderAiAnswerCitationEntityCoMentionComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityCitationDomainsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityCitationDomainsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityCitationDomainsCsv,
          renderAiAnswerCitationEntityCitationDomainsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityCitationPagesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityCitationPagesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityCitationPagesCsv,
          renderAiAnswerCitationEntityCitationPagesCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntitySourceCategoriesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntitySourceCategoriesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntitySourceCategoriesCsv,
          renderAiAnswerCitationEntitySourceCategoriesCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerEntitySourceCategoryComparisonCsv) {
        if (!baselineReportForAnswer)
          throw new Error(
            '--geo-answer-entity-source-category-comparison-csv requires a baseline answer sample.'
          );
        fs.mkdirSync(path.dirname(args.geoAnswerEntitySourceCategoryComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerEntitySourceCategoryComparisonCsv,
          renderAiAnswerCitationEntitySourceCategoryComparisonCsv(
            report,
            baselineReportForAnswer,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (args.geoAnswerEntityCitationDomainComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityCitationDomainComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerEntityCitationDomainComparisonCsv,
          renderAiAnswerCitationEntityCitationDomainComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityCitationPageComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityCitationPageComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerEntityCitationPageComparisonCsv,
          renderAiAnswerCitationEntityCitationPageComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityCitationPositionComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityCitationPositionComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerEntityCitationPositionComparisonCsv,
          renderAiAnswerCitationEntityCitationPositionComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityOpportunitiesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityOpportunitiesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityOpportunitiesCsv,
          renderAiAnswerCitationEntityOpportunitiesCsv(
            report,
            args.geoAnswerSourceCategories ?? []
          ),
          'utf8'
        );
      }
      if (
        args.geoAnswerEntityPromptMatchedAssociationCsv ||
        args.geoAnswerEntityPromptMatchedAssociationHtml
      ) {
        const matchedAssociationCsv = renderAiAnswerCitationEntityPromptMatchedAssociationCsv(
          (inputData as AiAnswerCitationObservationInputFile).observations,
          args.geoAnswerEntities ?? [],
          args.geoAnswerOwnedDomains ?? []
        );
        if (args.geoAnswerEntityPromptMatchedAssociationCsv) {
          fs.mkdirSync(path.dirname(args.geoAnswerEntityPromptMatchedAssociationCsv), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerEntityPromptMatchedAssociationCsv,
            matchedAssociationCsv,
            'utf8'
          );
        }
        if (args.geoAnswerEntityPromptMatchedAssociationHtml) {
          fs.mkdirSync(path.dirname(args.geoAnswerEntityPromptMatchedAssociationHtml), {
            recursive: true,
          });
          fs.writeFileSync(
            args.geoAnswerEntityPromptMatchedAssociationHtml,
            renderAiAnswerCitationEntityPromptMatchedAssociationHtmlFromCsv(matchedAssociationCsv),
            'utf8'
          );
        }
      }
      if (args.geoAnswerEntityPathFamilyMonthlyCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityPathFamilyMonthlyCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityPathFamilyMonthlyCsv,
          renderAiAnswerCitationEntityPathFamilyMonthlyCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityPathFamiliesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityPathFamiliesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerEntityPathFamiliesCsv,
          renderAiAnswerCitationEntityPathFamiliesCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerEntityPathFamilyComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerEntityPathFamilyComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerEntityPathFamilyComparisonCsv,
          renderAiAnswerCitationEntityPathFamilyComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerPathFamiliesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPathFamiliesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPathFamiliesCsv,
          renderAiAnswerCitationPathFamiliesCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerPathFamilyTrendsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPathFamilyTrendsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPathFamilyTrendsCsv,
          renderAiAnswerCitationPathFamilyTrendsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerPathFamilyCohortComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPathFamilyCohortComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoAnswerPathFamilyCohortComparisonCsv,
          renderAiAnswerCitationPathFamilyCohortComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerPathFamilyCohortsCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPathFamilyCohortsCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPathFamilyCohortsCsv,
          renderAiAnswerCitationPathFamilyCohortsCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerPathFamilyComparisonCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerPathFamilyComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerPathFamilyComparisonCsv,
          renderAiAnswerCitationPathFamilyComparisonCsv(report),
          'utf8'
        );
      }
      if (args.geoAnswerCrawlerMatchesCsv) {
        fs.mkdirSync(path.dirname(args.geoAnswerCrawlerMatchesCsv), { recursive: true });
        fs.writeFileSync(
          args.geoAnswerCrawlerMatchesCsv,
          renderAiAnswerCitationCrawlerLogMatchesCsv(report),
          'utf8'
        );
      }
      if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      else if (
        !args.output &&
        !args.html &&
        !args.geoAnswerComparisonCsv &&
        !args.geoAnswerProviderPositionComparisonCsv &&
        !args.geoAnswerCohortsCsv &&
        !args.geoAnswerCohortStandardizationCsv &&
        !args.geoAnswerCohortPeriodStandardizationCsv &&
        !args.geoAnswerPromptSamplingPlanCsv &&
        !args.geoAnswerPromptSamplingPlanJson &&
        !args.geoAnswerCohortComparisonCsv &&
        !args.geoAnswerProviderPairsCsv &&
        !args.geoAnswerProviderPromptOverlapCsv &&
        !args.geoAnswerProviderPromptSourceOverlapCsv &&
        !args.geoAnswerSampleMixCsv &&
        !args.geoAnswerTemporalStabilityCsv &&
        !args.geoAnswerSourcePersistenceCsv &&
        !args.geoAnswerCitationUrlPersistenceCsv &&
        !args.geoAnswerCohortTrendsCsv &&
        !args.geoAnswerAuditSignalsCsv &&
        !args.geoAnswerAuditedOwnedPageProviderInventoryCsv &&
        !args.geoAnswerAuditedOwnedPageProviderInventoryHtml &&
        !args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv &&
        !args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml &&
        !args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson &&
        !args.geoAnswerAuditedOwnedPagesCsv &&
        !args.geoAnswerAuditedOwnedPageComparisonCsv &&
        !args.geoAnswerAuditedOwnedPageProvidersCsv &&
        !args.geoAnswerAuditedOwnedPageProviderComparisonCsv &&
        !args.geoAnswerSourceCategoriesCsv &&
        !args.geoAnswerSourceCategoryMappingAuditCsv &&
        !args.geoAnswerSourceCategoryComparisonCsv &&
        !args.geoAnswerSourceCategoryMixDecompositionCsv &&
        !args.geoAnswerSourceCategoryMixDecompositionHtml &&
        !args.geoAnswerSourceCategoryConcentrationTrendsCsv &&
        !args.geoAnswerSourceCategoryConcentrationTrendsHtml &&
        !args.geoAnswerSourceCategoryShareTrendsCsv &&
        !args.geoAnswerSourceCategoryShareTrendsHtml &&
        !args.geoAnswerSourceCategoryMonthlyGatesJson &&
        args.failOnGeoAnswerSourceCategoryMonthlyJsdAbove === undefined &&
        args.failOnGeoAnswerSourceCategoryMonthlyHhiRiseAbove === undefined &&
        args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiRiseAbove === undefined &&
        args.failOnGeoAnswerSourceCategoryMonthlyHhiAbove === undefined &&
        args.failOnGeoAnswerSourceCategoryMonthlyTopThreeHhiAbove === undefined &&
        args.failOnGeoAnswerSourceCategoryShareDrop === undefined &&
        args.failOnGeoAnswerSourceCategoryPromptBalancedJsdLowerCiAbove === undefined &&
        !args.geoAnswerSourceCategoryPromptBalancedJsdGateJson &&
        !args.geoAnswerSourceCategoryPromptCoverageCsv &&
        !args.geoAnswerSourceCategoryPromptDetailsCsv &&
        !args.geoAnswerSourceCategoryTrendsCsv &&
        !args.geoAnswerSourceCategoryProviderPairsCsv &&
        !args.geoAnswerSourceCategoryCooccurrenceCsv &&
        !args.geoAnswerSourceCategoryPathFamiliesCsv &&
        !args.geoAnswerSourceCategoryPathFamilyComparisonCsv &&
        !args.geoAnswerDomainPromptCoverageComparisonCsv &&
        !args.geoAnswerDomainPromptCoverageCsv &&
        !args.geoAnswerSourceRarefactionCsv &&
        !args.geoAnswerPromptFamilySourceRarefactionCsv &&
        !args.geoAnswerPromptFamilySourceRarefactionHtml &&
        !args.geoAnswerPromptFamilySourceRarefactionSweepCsv &&
        !args.geoAnswerPromptFamilySourceRarefactionSweepHtml &&
        !args.geoAnswerProviderPromptFamilySourceOverlapCsv &&
        !args.geoAnswerProviderPromptFamilySourceOverlapHtml &&
        !args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv &&
        !args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml &&
        !args.geoAnswerPromptFamilyPeriodComparisonCsv &&
        !args.geoAnswerPromptFamilyPeriodComparisonHtml &&
        !args.geoAnswerPromptFamilyPeriodComparisonSweepCsv &&
        !args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv &&
        !args.geoAnswerPromptFamilyPeriodComparisonSweepHtml &&
        !args.geoAnswerPromptSimilarityCsv &&
        !args.geoAnswerPromptFamiliesCsv &&
        !args.geoAnswerPromptFamiliesHtml &&
        !args.geoAnswerPromptFamilyInfluenceCsv &&
        !args.geoAnswerPromptFamilyInfluenceHtml &&
        !args.geoAnswerPromptFamilyThresholdSweepCsv &&
        !args.geoAnswerPromptFamilyThresholdSweepHtml &&
        !args.geoAnswerDomainPairedReachComparisonCsv &&
        !args.geoAnswerDomainPairedReachComparisonJson &&
        args.failOnGeoAnswerDomainPairedReachDrop === undefined &&
        !args.geoAnswerDomainPairedReachGateJson &&
        !args.geoAnswerPagePairedReachComparisonCsv &&
        !args.geoAnswerPagePairedReachComparisonJson &&
        !args.geoAnswerPageOpportunitiesCsv &&
        !args.geoAnswerPageOpportunityTrendsCsv &&
        !args.geoAnswerPageOpportunityPathFamiliesCsv &&
        !args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv &&
        !args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml &&
        !args.geoAnswerPageOpportunityPathFamilyTrendsCsv &&
        !args.geoAnswerPageOpportunityPathFamilyTrendsHtml &&
        !args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson &&
        args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyRise === undefined &&
        args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyAlpha === undefined &&
        args.failOnGeoAnswerPageOpportunityPathFamilyMonthlyMinPrompts === undefined &&
        !args.geoAnswerPageOpportunityMonthlyGateJson &&
        args.failOnGeoAnswerPageOpportunityMonthlyRise === undefined &&
        args.failOnGeoAnswerPageOpportunityMonthlyAlpha === undefined &&
        args.failOnGeoAnswerPageOpportunityMonthlyMinPrompts === undefined &&
        args.failOnGeoAnswerPagePairedReachDrop === undefined &&
        !args.geoAnswerPagePairedReachGateJson &&
        !args.geoAnswerPagePairedReachOwnedOnly &&
        !args.geoAnswerSourceDiversityUncertaintyCsv &&
        !args.geoAnswerSourceDiversityUncertaintyHtml &&
        !args.geoAnswerSourceDiversityComparisonCsv &&
        !args.geoAnswerSourceDiversityComparisonHtml &&
        !args.geoAnswerProviderSourceDivergenceCsv &&
        !args.geoAnswerSourcePortfolioDriftCsv &&
        !args.geoAnswerSourcePortfolioDriftHtml &&
        !args.geoAnswerSourcePortfolioDriftJson &&
        !args.geoAnswerSourcePortfolioAttributionCsv &&
        !args.geoAnswerSourcePortfolioAttributionJson &&
        !args.geoAnswerSourcePortfolioAttributionHtml &&
        !args.geoAnswerSourceNetworkCsv &&
        !args.geoAnswerSourceNetworkComparisonCsv &&
        !args.geoAnswerRankWeightedSourceNetworkCsv &&
        !args.geoAnswerRankWeightedSourceNetworkComparisonCsv &&
        !args.geoAnswerSourceNetworkHtml &&
        !args.geoAnswerSourceNetworkComparisonHtml &&
        !args.geoAnswerProviderSourceNetworkOverlapCsv &&
        !args.geoAnswerProviderSourceNetworkEdgeDriftCsv &&
        !args.geoAnswerProviderSourceNetworkEdgeDriftHtml &&
        !args.geoAnswerProviderSourceNetworkEdgeComparisonCsv &&
        !args.geoAnswerProviderSourceNetworkEdgeHtml &&
        !args.geoAnswerOwnedSourceNetworkGapsCsv &&
        !args.geoAnswerCitationPositionsCsv &&
        !args.geoAnswerCitationDateAlignmentCsv &&
        !args.geoAnswerOwnedRankCsv &&
        !args.geoAnswerOwnedPromptCoverageCsv &&
        !args.geoAnswerOwnedPromptReachPeriodCsv &&
        !args.geoAnswerOwnedPromptOpportunitiesCsv &&
        !args.geoAnswerCompetitiveGapsCsv &&
        !args.geoAnswerProviderOwnedGapsCsv &&
        !args.geoAnswerProviderOwnedGapComparisonCsv &&
        !args.geoAnswerCompetitiveGapComparisonCsv &&
        !args.geoAnswerOwnedRankComparisonCsv &&
        !args.geoAnswerOwnedPromptRankComparisonCsv &&
        !args.geoAnswerCoCitationCsv &&
        !args.geoAnswerCoCitationComparisonCsv &&
        !args.geoAnswerEntityMentionsCsv &&
        !args.geoAnswerEntityPromptDetailsCsv &&
        !args.geoAnswerEntityPromptProviderPairsCsv &&
        !args.geoAnswerEntityPromptComparisonCsv &&
        !args.geoAnswerEntityCoMentionsCsv &&
        !args.geoAnswerEntityCoMentionComparisonCsv &&
        !args.geoAnswerEntityCitationDomainsCsv &&
        !args.geoAnswerEntityCitationPagesCsv &&
        !args.geoAnswerEntitySourceCategoriesCsv &&
        !args.geoAnswerEntitySourceCategoryComparisonCsv &&
        !args.geoAnswerEntityCitationDomainComparisonCsv &&
        !args.geoAnswerEntityCitationPageComparisonCsv &&
        !args.geoAnswerEntityCitationPositionComparisonCsv &&
        !args.geoAnswerEntityOpportunitiesCsv &&
        !args.geoAnswerEntityPromptMatchedAssociationCsv &&
        !args.geoAnswerEntityPromptMatchedAssociationHtml &&
        !args.geoAnswerEntityPathFamiliesCsv &&
        !args.geoAnswerEntityPathFamilyMonthlyCsv &&
        !args.geoAnswerEntityPathFamilyComparisonCsv &&
        !args.geoAnswerPathFamiliesCsv &&
        !args.geoAnswerPathFamilyCohortsCsv &&
        !args.geoAnswerPathFamilyTrendsCsv &&
        !args.geoAnswerPathFamilyCohortComparisonCsv &&
        !args.geoAnswerPathFamilyComparisonCsv &&
        !args.geoAnswerCrawlerMatchesCsv &&
        !args.geoAnswerOwnedSourceShareGateCsv &&
        !args.geoAnswerOwnedSourceShareGateJson
      ) {
        const ownCoverage =
          report.summary.ownedCitationCoveragePercent === undefined
            ? 'owned domains not configured'
            : `${report.summary.ownedCitationCoveragePercent}% of snapshots cited an owned domain`;
        const comparison = report.periodComparison
          ? `; ${report.periodComparison.sharedProviderPromptGroups} matched provider/prompt groups and ${report.periodComparison.topicIntentComparison?.sharedProviderCohorts ?? 0} matched topic/intent/provider cohorts (${report.periodComparison.providerPromptCoverageComplete && (report.periodComparison.topicIntentComparison?.providerCohortCoverageComplete ?? true) ? 'complete retained detail' : 'incomplete retained detail'})`
          : '';
        process.stdout.write(
          `Observed AI answers: ${report.summary.observations} snapshots across ${report.summary.uniquePrompts} exact prompt groups and ${report.summary.uniqueProviders} providers; ${report.summary.citationEvents} citation events across ${report.summary.distinctCitedDomains} domains; ${report.summary.incompleteCitationListObservations ?? 0} incomplete citation lists; ${ownCoverage}${comparison}.\n`
        );
      }
      if (args.output)
        process.stderr.write(`Structured observed-answer GEO report saved to ${args.output}\n`);
      if (args.html) process.stderr.write(`Observed-answer GEO dashboard saved to ${args.html}\n`);
      if (args.geoAnswerSourcePortfolioAttributionJson)
        process.stderr.write(
          `Observed-answer domain source-portfolio attribution JSON saved to ${args.geoAnswerSourcePortfolioAttributionJson}\n`
        );
      if (args.geoAnswerOwnedSourceShareGateCsv)
        process.stderr.write(
          `Owned source-share gate CSV saved to ${args.geoAnswerOwnedSourceShareGateCsv}\n`
        );
      if (args.geoAnswerOwnedSourceShareGateJson)
        process.stderr.write(
          `Owned source-share gate JSON saved to ${args.geoAnswerOwnedSourceShareGateJson}\n`
        );
      if (args.geoAnswerComparisonCsv)
        process.stderr.write(
          `Observed-answer period comparison CSV saved to ${args.geoAnswerComparisonCsv}\n`
        );
      if (args.geoAnswerProviderPositionComparisonCsv)
        process.stderr.write(
          `Observed-answer provider-specific cited-page position comparison CSV saved to ${args.geoAnswerProviderPositionComparisonCsv}\n`
        );
      if (args.geoAnswerCohortComparisonCsv)
        process.stderr.write(
          `Observed-answer topic/intent cohort comparison CSV saved to ${args.geoAnswerCohortComparisonCsv}\n`
        );
      if (args.geoAnswerCohortsCsv)
        process.stderr.write(
          `Observed-answer topic/intent cohort CSV saved to ${args.geoAnswerCohortsCsv}\n`
        );
      if (args.geoAnswerProviderPairsCsv)
        process.stderr.write(
          `Observed-answer same-prompt provider comparison CSV saved to ${args.geoAnswerProviderPairsCsv}\n`
        );
      if (args.geoAnswerProviderPromptOverlapCsv)
        process.stderr.write(
          `Observed-answer provider prompt-panel overlap CSV saved to ${args.geoAnswerProviderPromptOverlapCsv}\n`
        );
      if (args.geoAnswerProviderPromptSourceOverlapCsv)
        process.stderr.write(
          `Observed-answer same-prompt provider citation-source overlap CSV saved to ${args.geoAnswerProviderPromptSourceOverlapCsv}\n`
        );
      if (args.geoAnswerSampleMixCsv)
        process.stderr.write(
          `Observed-answer provider sample-mix comparison CSV saved to ${args.geoAnswerSampleMixCsv}\n`
        );
      if (args.geoAnswerCohortStandardizationCsv)
        process.stderr.write(
          `Observed-answer cohort-standardized provider comparison CSV saved to ${args.geoAnswerCohortStandardizationCsv}${report.topicIntentCohortsTruncated || report.providerSampleMixComparisonsTruncated ? ' (retained cohort or provider-pair detail is capped)' : ''}\n`
        );
      if (args.geoAnswerCohortPeriodStandardizationCsv)
        process.stderr.write(
          `Observed-answer cohort-standardized period comparison CSV saved to ${args.geoAnswerCohortPeriodStandardizationCsv}${report.periodComparison?.topicIntentComparison?.providerCohortCoverageComplete ? '' : ' (matched cohort comparison is incomplete)'}\n`
        );
      if (args.geoAnswerPromptSamplingPlanCsv)
        process.stderr.write(
          `Observed-answer balanced prompt-panel plan CSV saved to ${args.geoAnswerPromptSamplingPlanCsv}${args.geoAnswerPromptPlanMinPrompts ? ` (minimum ${args.geoAnswerPromptPlanMinPrompts} per provider/cohort)` : ''}${args.geoAnswerPromptPlanOwnedReachMargin ? ` (owned-reach Wilson half-width target ±${args.geoAnswerPromptPlanOwnedReachMargin} pp)` : ''}${args.geoAnswerPromptPlanMinimumJaccard ? ` (minimum exact-prompt Jaccard ${args.geoAnswerPromptPlanMinimumJaccard})` : ''}${args.geoAnswerPromptPlanMaxPairedGroups !== undefined ? ` (maximum ${args.geoAnswerPromptPlanMaxPairedGroups} paired groups per provider pair)` : ''}${args.geoAnswerPromptPlanMaxTotalPairedGroups !== undefined ? ` (maximum ${args.geoAnswerPromptPlanMaxTotalPairedGroups} paired groups total)` : ''}${report.topicIntentCohortsTruncated || report.providerSampleMixComparisonsTruncated ? ' (retained cohort or provider-pair detail is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptSamplingPlanJson)
        process.stderr.write(
          `Observed-answer typed prompt-panel plan JSON saved to ${args.geoAnswerPromptSamplingPlanJson}\n`
        );
      if (args.geoAnswerTemporalStabilityCsv)
        process.stderr.write(
          `Observed-answer repeated-prompt source-stability CSV saved to ${args.geoAnswerTemporalStabilityCsv}\n`
        );
      if (args.geoAnswerSourcePersistenceCsv)
        process.stderr.write(
          `Observed-answer citation-source persistence CSV saved to ${args.geoAnswerSourcePersistenceCsv}\n`
        );
      if (args.geoAnswerCitationUrlPersistenceCsv)
        process.stderr.write(
          `Observed-answer citation-page URL persistence CSV saved to ${args.geoAnswerCitationUrlPersistenceCsv}\n`
        );
      if (args.geoAnswerCohortTrendsCsv)
        process.stderr.write(
          `Observed-answer monthly provider/cohort trends CSV saved to ${args.geoAnswerCohortTrendsCsv}\n`
        );
      if (args.geoAnswerAuditSignalsCsv)
        process.stderr.write(
          `Observed-answer cited-page GEO audit signals CSV saved to ${args.geoAnswerAuditSignalsCsv}\n`
        );
      if (args.geoAnswerAuditedOwnedPageProviderInventoryCsv)
        process.stderr.write(
          `Observed-answer audited owned-page/provider inventory CSV saved to ${args.geoAnswerAuditedOwnedPageProviderInventoryCsv}\n`
        );
      if (args.geoAnswerAuditedOwnedPageProviderInventoryHtml)
        process.stderr.write(
          `Observed-answer audited owned-page/provider inventory HTML saved to ${args.geoAnswerAuditedOwnedPageProviderInventoryHtml}\n`
        );
      if (args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv)
        process.stderr.write(
          `Observed-answer audited owned-page/provider inventory comparison CSV saved to ${args.geoAnswerAuditedOwnedPageProviderInventoryComparisonCsv}\n`
        );
      if (args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml)
        process.stderr.write(
          `Observed-answer audited owned-page/provider inventory comparison dashboard saved to ${args.geoAnswerAuditedOwnedPageProviderInventoryComparisonHtml}\n`
        );
      if (args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson)
        process.stderr.write(
          `Observed-answer audited owned-page/provider inventory comparison JSON saved to ${args.geoAnswerAuditedOwnedPageProviderInventoryComparisonJson}\n`
        );
      if (args.geoAnswerAuditedOwnedPagesCsv)
        process.stderr.write(
          `Observed-answer audited owned-page citation inventory CSV saved to ${args.geoAnswerAuditedOwnedPagesCsv}\n`
        );
      if (args.geoAnswerAuditedOwnedPageComparisonCsv)
        process.stderr.write(
          `Observed-answer audited owned-page comparison CSV saved to ${args.geoAnswerAuditedOwnedPageComparisonCsv}\n`
        );
      if (args.geoAnswerAuditedOwnedPageProvidersCsv)
        process.stderr.write(
          `Observed-answer audited owned-page/provider CSV saved to ${args.geoAnswerAuditedOwnedPageProvidersCsv}\n`
        );
      if (args.geoAnswerAuditedOwnedPageProviderComparisonCsv)
        process.stderr.write(
          `Observed-answer audited owned-page/provider comparison CSV saved to ${args.geoAnswerAuditedOwnedPageProviderComparisonCsv}\n`
        );
      if (args.geoAnswerSourceCategoriesCsv)
        process.stderr.write(
          `Observed-answer source-category CSV saved to ${args.geoAnswerSourceCategoriesCsv}\n`
        );
      if (args.geoAnswerSourceCategoryMappingAuditCsv)
        process.stderr.write(
          `Observed-answer source-category mapping-audit CSV saved to ${args.geoAnswerSourceCategoryMappingAuditCsv}\n`
        );
      if (args.geoAnswerSourceCategoryConcentrationTrendsCsv)
        process.stderr.write(
          `Observed-answer source-category concentration-trends CSV saved to ${args.geoAnswerSourceCategoryConcentrationTrendsCsv}\n`
        );
      if (args.geoAnswerSourceCategoryConcentrationTrendsHtml)
        process.stderr.write(
          `Observed-answer source-category concentration-trends dashboard saved to ${args.geoAnswerSourceCategoryConcentrationTrendsHtml}\n`
        );
      if (args.geoAnswerSourceCategoryShareTrendsCsv)
        process.stderr.write(
          `Observed-answer source-category share-trends CSV saved to ${args.geoAnswerSourceCategoryShareTrendsCsv}\n`
        );
      if (args.geoAnswerSourceCategoryShareTrendsHtml)
        process.stderr.write(
          `Observed-answer source-category share-trends dashboard saved to ${args.geoAnswerSourceCategoryShareTrendsHtml}\n`
        );
      if (args.geoAnswerSourceCategoryMonthlyGatesJson)
        process.stderr.write(
          `Observed-answer monthly source-category gate JSON saved to ${args.geoAnswerSourceCategoryMonthlyGatesJson}\n`
        );
      if (args.geoAnswerSourceCategoryMixDecompositionCsv)
        process.stderr.write(
          `Observed-answer source-category mix-decomposition CSV saved to ${args.geoAnswerSourceCategoryMixDecompositionCsv}\n`
        );
      if (args.geoAnswerSourceCategoryMixDecompositionHtml)
        process.stderr.write(
          `Observed-answer source-category mix-decomposition dashboard saved to ${args.geoAnswerSourceCategoryMixDecompositionHtml}\n`
        );
      if (args.geoAnswerSourceCategoryComparisonCsv)
        process.stderr.write(
          `Observed-answer source-category comparison CSV saved to ${args.geoAnswerSourceCategoryComparisonCsv}\n`
        );
      if (args.geoAnswerSourceCategoryPromptCoverageCsv)
        process.stderr.write(
          `Observed-answer source-category exact-prompt coverage CSV saved to ${args.geoAnswerSourceCategoryPromptCoverageCsv}\n`
        );
      if (args.geoAnswerSourceCategoryPromptDetailsCsv)
        process.stderr.write(
          `Observed-answer source-category prompt evidence CSV saved to ${args.geoAnswerSourceCategoryPromptDetailsCsv}\n`
        );
      if (args.geoAnswerSourceCategoryTrendsCsv)
        process.stderr.write(
          `Observed-answer source-category monthly trends CSV saved to ${args.geoAnswerSourceCategoryTrendsCsv}\n`
        );
      if (args.geoAnswerSourceCategoryProviderPairsCsv)
        process.stderr.write(
          `Observed-answer same-prompt source-category provider comparison CSV saved to ${args.geoAnswerSourceCategoryProviderPairsCsv}\n`
        );
      if (args.geoAnswerSourceCategoryCooccurrenceCsv)
        process.stderr.write(
          `Observed-answer source-category co-occurrence CSV saved to ${args.geoAnswerSourceCategoryCooccurrenceCsv}\n`
        );
      if (args.geoAnswerSourceCategoryPathFamiliesCsv)
        process.stderr.write(
          `Observed-answer source-category path-family CSV saved to ${args.geoAnswerSourceCategoryPathFamiliesCsv}\n`
        );
      if (args.geoAnswerSourceCategoryPathFamilyComparisonCsv)
        process.stderr.write(
          `Observed-answer source-category path-family comparison CSV saved to ${args.geoAnswerSourceCategoryPathFamilyComparisonCsv}\n`
        );
      if (args.geoAnswerDomainPromptCoverageComparisonCsv)
        process.stderr.write(
          `Observed-answer domain prompt-coverage comparison CSV saved to ${args.geoAnswerDomainPromptCoverageComparisonCsv}\n`
        );
      if (args.geoAnswerDomainPairedReachComparisonCsv)
        process.stderr.write(
          `Observed-answer paired domain prompt-reach comparison CSV saved to ${args.geoAnswerDomainPairedReachComparisonCsv}\n`
        );
      if (args.geoAnswerDomainPairedReachComparisonJson)
        process.stderr.write(
          `Observed-answer paired domain prompt-reach comparison JSON saved to ${args.geoAnswerDomainPairedReachComparisonJson}\n`
        );
      if (args.geoAnswerPagePairedReachComparisonCsv)
        process.stderr.write(
          `Observed-answer paired page prompt-reach comparison CSV saved to ${args.geoAnswerPagePairedReachComparisonCsv}\n`
        );
      if (args.geoAnswerPagePairedReachComparisonJson)
        process.stderr.write(
          `Observed-answer paired page prompt-reach comparison JSON saved to ${args.geoAnswerPagePairedReachComparisonJson}\n`
        );
      if (args.geoAnswerPageOpportunitiesCsv)
        process.stderr.write(
          `Observed-answer confirmed-no-owned-citation page opportunities CSV saved to ${args.geoAnswerPageOpportunitiesCsv}\n`
        );
      if (args.geoAnswerPageOpportunityTrendsCsv)
        process.stderr.write(
          `Observed-answer UTC-month page opportunity trends CSV saved to ${args.geoAnswerPageOpportunityTrendsCsv}\n`
        );
      if (args.geoAnswerPageOpportunityPathFamiliesCsv)
        process.stderr.write(
          `Observed-answer confirmed-no-owned page opportunity path-family CSV saved to ${args.geoAnswerPageOpportunityPathFamiliesCsv}\n`
        );
      if (args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv)
        process.stderr.write(
          `Observed-answer path-family depth sensitivity CSV saved to ${args.geoAnswerPageOpportunityPathFamilyDepthSweepCsv}\n`
        );
      if (args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml)
        process.stderr.write(
          `Observed-answer path-family depth sensitivity dashboard saved to ${args.geoAnswerPageOpportunityPathFamilyDepthSweepHtml}\n`
        );
      if (args.geoAnswerPageOpportunityPathFamilyTrendsCsv)
        process.stderr.write(
          `Observed-answer UTC-month page opportunity path-family trends CSV saved to ${args.geoAnswerPageOpportunityPathFamilyTrendsCsv}\n`
        );
      if (args.geoAnswerPageOpportunityPathFamilyTrendsHtml)
        process.stderr.write(
          `Observed-answer UTC-month page opportunity path-family trends dashboard saved to ${args.geoAnswerPageOpportunityPathFamilyTrendsHtml}\n`
        );
      if (args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson)
        process.stderr.write(
          `Observed-answer monthly page-opportunity path-family rise gate JSON saved to ${args.geoAnswerPageOpportunityPathFamilyMonthlyGateJson}\n`
        );
      if (args.geoAnswerPageOpportunityMonthlyGateJson)
        process.stderr.write(
          `Observed-answer monthly page-opportunity rise gate JSON saved to ${args.geoAnswerPageOpportunityMonthlyGateJson}\n`
        );
      if (args.geoAnswerSourceDiversityUncertaintyCsv)
        process.stderr.write(
          `Observed-answer citation source diversity uncertainty CSV saved to ${args.geoAnswerSourceDiversityUncertaintyCsv}\n`
        );
      if (args.geoAnswerSourceDiversityUncertaintyHtml)
        process.stderr.write(
          `Observed-answer citation source diversity uncertainty HTML saved to ${args.geoAnswerSourceDiversityUncertaintyHtml}\n`
        );
      if (args.geoAnswerSourceDiversityComparisonCsv)
        process.stderr.write(
          `Observed-answer paired citation source diversity CSV saved to ${args.geoAnswerSourceDiversityComparisonCsv}\n`
        );
      if (args.geoAnswerSourceDiversityComparisonHtml)
        process.stderr.write(
          `Observed-answer paired citation source diversity HTML saved to ${args.geoAnswerSourceDiversityComparisonHtml}\n`
        );
      if (args.geoAnswerProviderSourceDivergenceCsv)
        process.stderr.write(
          `Observed-answer provider source-distribution divergence CSV saved to ${args.geoAnswerProviderSourceDivergenceCsv}\n`
        );
      if (args.geoAnswerSourcePortfolioDriftCsv)
        process.stderr.write(
          `Observed-answer baseline/current source-portfolio drift CSV saved to ${args.geoAnswerSourcePortfolioDriftCsv}\n`
        );
      if (args.geoAnswerSourcePortfolioDriftHtml)
        process.stderr.write(
          `Observed-answer baseline/current source-portfolio drift dashboard saved to ${args.geoAnswerSourcePortfolioDriftHtml}\n`
        );
      if (args.geoAnswerSourcePortfolioDriftJson)
        process.stderr.write(
          `Observed-answer baseline/current source-portfolio drift JSON saved to ${args.geoAnswerSourcePortfolioDriftJson}\n`
        );
      if (args.geoAnswerSourcePortfolioAttributionCsv)
        process.stderr.write(
          `Observed-answer domain source-portfolio attribution CSV saved to ${args.geoAnswerSourcePortfolioAttributionCsv}\n`
        );
      if (args.geoAnswerSourcePortfolioAttributionHtml)
        process.stderr.write(
          `Observed-answer domain source-portfolio attribution dashboard saved to ${args.geoAnswerSourcePortfolioAttributionHtml}\n`
        );
      if (args.geoAnswerSourceNetworkCsv)
        process.stderr.write(
          `Observed-answer provider source co-occurrence network CSV saved to ${args.geoAnswerSourceNetworkCsv}\n`
        );
      if (args.geoAnswerSourceNetworkComparisonCsv)
        process.stderr.write(
          `Observed-answer baseline/current source-network comparison CSV saved to ${args.geoAnswerSourceNetworkComparisonCsv}\n`
        );
      if (args.geoAnswerRankWeightedSourceNetworkCsv)
        process.stderr.write(
          `Observed-answer rank-weighted source network CSV saved to ${args.geoAnswerRankWeightedSourceNetworkCsv}\n`
        );
      if (args.geoAnswerRankWeightedSourceNetworkComparisonCsv)
        process.stderr.write(
          `Observed-answer baseline/current rank-weighted source network comparison CSV saved to ${args.geoAnswerRankWeightedSourceNetworkComparisonCsv}\n`
        );
      if (args.geoAnswerSourceNetworkHtml)
        process.stderr.write(
          `Observed-answer interactive source-network dashboard saved to ${args.geoAnswerSourceNetworkHtml}\n`
        );
      if (args.geoAnswerSourceNetworkComparisonHtml)
        process.stderr.write(
          `Observed-answer source-network community-drift dashboard saved to ${args.geoAnswerSourceNetworkComparisonHtml}\n`
        );
      if (args.geoAnswerProviderSourceNetworkOverlapCsv)
        process.stderr.write(
          `Observed-answer provider source-network overlap CSV saved to ${args.geoAnswerProviderSourceNetworkOverlapCsv}\n`
        );
      if (args.geoAnswerProviderSourceNetworkEdgeDriftCsv)
        process.stderr.write(
          `Observed-answer baseline/current provider source-network edge-drift CSV saved to ${args.geoAnswerProviderSourceNetworkEdgeDriftCsv}\n`
        );
      if (args.geoAnswerProviderSourceNetworkEdgeDriftHtml)
        process.stderr.write(
          `Observed-answer baseline/current provider source-network edge-drift dashboard saved to ${args.geoAnswerProviderSourceNetworkEdgeDriftHtml}\n`
        );
      if (args.geoAnswerProviderSourceNetworkEdgeComparisonCsv)
        process.stderr.write(
          `Observed-answer provider source-network edge comparison CSV saved to ${args.geoAnswerProviderSourceNetworkEdgeComparisonCsv}\n`
        );
      if (args.geoAnswerProviderSourceNetworkEdgeHtml)
        process.stderr.write(
          `Observed-answer provider source-network edge comparison dashboard saved to ${args.geoAnswerProviderSourceNetworkEdgeHtml}\n`
        );
      if (args.geoAnswerOwnedSourceNetworkGapsCsv)
        process.stderr.write(
          `Observed-answer owned-citation source-network gaps CSV saved to ${args.geoAnswerOwnedSourceNetworkGapsCsv}\n`
        );
      if (args.geoAnswerDomainPromptCoverageCsv)
        process.stderr.write(
          `Observed-answer domain prompt-coverage CSV saved to ${args.geoAnswerDomainPromptCoverageCsv}${report.domainsTruncated ? ' (domain catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerSourceRarefactionCsv)
        process.stderr.write(
          `Observed-answer source-domain rarefaction CSV saved to ${args.geoAnswerSourceRarefactionCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilySourceRarefactionCsv)
        process.stderr.write(
          `Observed-answer lexical prompt-family source rarefaction CSV saved to ${args.geoAnswerPromptFamilySourceRarefactionCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilySourceRarefactionHtml)
        process.stderr.write(
          `Observed-answer lexical prompt-family source rarefaction HTML saved to ${args.geoAnswerPromptFamilySourceRarefactionHtml}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilySourceRarefactionSweepCsv)
        process.stderr.write(
          `Observed-answer prompt-family source rarefaction threshold-sweep CSV saved to ${args.geoAnswerPromptFamilySourceRarefactionSweepCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilySourceRarefactionSweepHtml)
        process.stderr.write(
          `Observed-answer prompt-family source rarefaction threshold-sweep HTML saved to ${args.geoAnswerPromptFamilySourceRarefactionSweepHtml}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerProviderPromptFamilySourceOverlapCsv)
        process.stderr.write(
          `Observed-answer provider prompt-family source-overlap CSV saved to ${args.geoAnswerProviderPromptFamilySourceOverlapCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerProviderPromptFamilySourceOverlapHtml)
        process.stderr.write(
          `Observed-answer provider prompt-family source-overlap HTML saved to ${args.geoAnswerProviderPromptFamilySourceOverlapHtml}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv)
        process.stderr.write(
          `Observed-answer provider prompt-family source-overlap threshold-sweep CSV saved to ${args.geoAnswerProviderPromptFamilySourceOverlapSweepCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml)
        process.stderr.write(
          `Observed-answer provider prompt-family source-overlap threshold-sweep HTML saved to ${args.geoAnswerProviderPromptFamilySourceOverlapSweepHtml}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilyPeriodComparisonCsv)
        process.stderr.write(
          `Observed-answer lexical prompt-family period-comparison CSV saved to ${args.geoAnswerPromptFamilyPeriodComparisonCsv}\n`
        );
      if (args.geoAnswerPromptFamilyPeriodComparisonHtml)
        process.stderr.write(
          `Observed-answer lexical prompt-family period-comparison HTML saved to ${args.geoAnswerPromptFamilyPeriodComparisonHtml}\n`
        );
      if (args.geoAnswerPromptFamilyPeriodComparisonSweepCsv)
        process.stderr.write(
          `Observed-answer lexical prompt-family period-comparison threshold-sweep CSV saved to ${args.geoAnswerPromptFamilyPeriodComparisonSweepCsv}\n`
        );
      if (args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv)
        process.stderr.write(
          `Observed-answer lexical prompt-family period-comparison threshold-sweep summary CSV saved to ${args.geoAnswerPromptFamilyPeriodComparisonSweepSummaryCsv}\n`
        );
      if (args.geoAnswerPromptFamilyPeriodComparisonSweepHtml)
        process.stderr.write(
          `Observed-answer lexical prompt-family period-comparison threshold-sweep HTML saved to ${args.geoAnswerPromptFamilyPeriodComparisonSweepHtml}\n`
        );
      if (args.geoAnswerPromptSimilarityCsv)
        process.stderr.write(
          `Observed-answer prompt lexical-similarity CSV saved to ${args.geoAnswerPromptSimilarityCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamiliesCsv)
        process.stderr.write(
          `Observed-answer lexical prompt-family CSV saved to ${args.geoAnswerPromptFamiliesCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamiliesHtml)
        process.stderr.write(
          `Observed-answer prompt-family weighting-sensitivity HTML saved to ${args.geoAnswerPromptFamiliesHtml}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilyInfluenceCsv)
        process.stderr.write(
          `Observed-answer prompt-family influence CSV saved to ${args.geoAnswerPromptFamilyInfluenceCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilyInfluenceHtml)
        process.stderr.write(
          `Observed-answer prompt-family influence HTML saved to ${args.geoAnswerPromptFamilyInfluenceHtml}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilyThresholdSweepCsv)
        process.stderr.write(
          `Observed-answer prompt-family threshold-sensitivity CSV saved to ${args.geoAnswerPromptFamilyThresholdSweepCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerPromptFamilyThresholdSweepHtml)
        process.stderr.write(
          `Observed-answer prompt-family threshold-sensitivity HTML saved to ${args.geoAnswerPromptFamilyThresholdSweepHtml}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerCitationPositionsCsv)
        process.stderr.write(
          `Observed-answer citation-list position CSV saved to ${args.geoAnswerCitationPositionsCsv}\n`
        );
      if (args.geoAnswerCitationDateAlignmentCsv)
        process.stderr.write(
          `Observed-answer citation dateModified alignment CSV saved to ${args.geoAnswerCitationDateAlignmentCsv}\n`
        );
      if (args.geoAnswerOwnedRankCsv)
        process.stderr.write(
          `Owned citation rank-distribution CSV saved to ${args.geoAnswerOwnedRankCsv}\n`
        );
      if (args.geoAnswerOwnedPromptCoverageCsv)
        process.stderr.write(
          `Owned citation prompt-coverage CSV saved to ${args.geoAnswerOwnedPromptCoverageCsv}\n`
        );
      if (args.geoAnswerOwnedPromptReachPeriodCsv)
        process.stderr.write(
          `Paired owned-citation prompt-reach period CSV saved to ${args.geoAnswerOwnedPromptReachPeriodCsv}\n`
        );
      if (args.geoAnswerOwnedPromptOpportunitiesCsv)
        process.stderr.write(
          `Owned citation prompt-opportunities CSV saved to ${args.geoAnswerOwnedPromptOpportunitiesCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerCompetitiveGapsCsv)
        process.stderr.write(
          `Owned citation competitive-gap CSV saved to ${args.geoAnswerCompetitiveGapsCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerProviderOwnedGapsCsv)
        process.stderr.write(
          `Cross-provider owned-citation gap CSV saved to ${args.geoAnswerProviderOwnedGapsCsv}${report.promptsTruncated ? ' (retained prompt catalog is capped)' : ''}\n`
        );
      if (args.geoAnswerProviderOwnedGapComparisonCsv)
        process.stderr.write(
          `Cross-provider owned-citation gap comparison CSV saved to ${args.geoAnswerProviderOwnedGapComparisonCsv}\n`
        );
      if (args.geoAnswerCompetitiveGapComparisonCsv)
        process.stderr.write(
          `Owned citation competitive-gap comparison CSV saved to ${args.geoAnswerCompetitiveGapComparisonCsv}\n`
        );
      if (args.geoAnswerOwnedRankComparisonCsv)
        process.stderr.write(
          `Owned citation rank-comparison CSV saved to ${args.geoAnswerOwnedRankComparisonCsv}\n`
        );
      if (args.geoAnswerOwnedPromptRankComparisonCsv)
        process.stderr.write(
          `Exact-prompt-balanced owned-rank comparison CSV saved to ${args.geoAnswerOwnedPromptRankComparisonCsv}\n`
        );
      if (args.geoAnswerCoCitationCsv)
        process.stderr.write(
          `Observed-answer owned-source co-citation CSV saved to ${args.geoAnswerCoCitationCsv}\n`
        );
      if (args.geoAnswerCoCitationComparisonCsv)
        process.stderr.write(
          `Observed-answer owned-source co-citation comparison CSV saved to ${args.geoAnswerCoCitationComparisonCsv}\n`
        );
      if (args.geoAnswerEntityMentionsCsv)
        process.stderr.write(
          `Observed-answer entity mentions CSV saved to ${args.geoAnswerEntityMentionsCsv}\n`
        );
      if (args.geoAnswerEntityPromptDetailsCsv)
        process.stderr.write(
          `Observed-answer exact entity prompt-detail CSV saved to ${args.geoAnswerEntityPromptDetailsCsv}\n`
        );
      if (args.geoAnswerEntityPromptProviderPairsCsv)
        process.stderr.write(
          `Observed-answer entity prompt/provider pair CSV saved to ${args.geoAnswerEntityPromptProviderPairsCsv}\n`
        );
      if (args.geoAnswerEntityPromptComparisonCsv)
        process.stderr.write(
          `Observed-answer exact entity prompt comparison CSV saved to ${args.geoAnswerEntityPromptComparisonCsv}\n`
        );
      if (args.geoAnswerEntityCoMentionsCsv)
        process.stderr.write(
          `Observed-answer entity co-mentions CSV saved to ${args.geoAnswerEntityCoMentionsCsv}\n`
        );
      if (args.geoAnswerEntityCoMentionComparisonCsv)
        process.stderr.write(
          `Observed-answer entity co-mention comparison CSV saved to ${args.geoAnswerEntityCoMentionComparisonCsv}\n`
        );
      if (args.geoAnswerEntityCitationDomainsCsv)
        process.stderr.write(
          `Observed-answer entity citation-domain association CSV saved to ${args.geoAnswerEntityCitationDomainsCsv}\n`
        );
      if (args.geoAnswerEntityCitationPagesCsv)
        process.stderr.write(
          `Observed-answer entity citation-page association CSV saved to ${args.geoAnswerEntityCitationPagesCsv}\n`
        );
      if (args.geoAnswerEntitySourceCategoriesCsv)
        process.stderr.write(
          `Observed-answer entity/source-category CSV saved to ${args.geoAnswerEntitySourceCategoriesCsv}\n`
        );
      if (args.geoAnswerEntitySourceCategoryComparisonCsv)
        process.stderr.write(
          `Observed-answer entity/source-category period comparison CSV saved to ${args.geoAnswerEntitySourceCategoryComparisonCsv}\n`
        );
      if (args.geoAnswerEntityCitationDomainComparisonCsv)
        process.stderr.write(
          `Observed-answer entity citation-domain comparison CSV saved to ${args.geoAnswerEntityCitationDomainComparisonCsv}\n`
        );
      if (args.geoAnswerEntityCitationPageComparisonCsv)
        process.stderr.write(
          `Observed-answer entity citation-page comparison CSV saved to ${args.geoAnswerEntityCitationPageComparisonCsv}\n`
        );
      if (args.geoAnswerEntityCitationPositionComparisonCsv)
        process.stderr.write(
          `Observed-answer entity citation-position comparison CSV saved to ${args.geoAnswerEntityCitationPositionComparisonCsv}\n`
        );
      if (args.geoAnswerEntityOpportunitiesCsv)
        process.stderr.write(
          `Observed-answer entity opportunity CSV saved to ${args.geoAnswerEntityOpportunitiesCsv}\n`
        );
      if (args.geoAnswerEntityPromptMatchedAssociationCsv)
        process.stderr.write(
          `Matched exact-prompt entity/citation association CSV saved to ${args.geoAnswerEntityPromptMatchedAssociationCsv}\n`
        );
      if (args.geoAnswerEntityPromptMatchedAssociationHtml)
        process.stderr.write(
          `Matched exact-prompt entity/citation dashboard saved to ${args.geoAnswerEntityPromptMatchedAssociationHtml}\n`
        );
      if (args.geoAnswerEntityPathFamiliesCsv)
        process.stderr.write(
          `Observed-answer entity/path-family association CSV saved to ${args.geoAnswerEntityPathFamiliesCsv}\n`
        );
      if (args.geoAnswerEntityPathFamilyMonthlyCsv)
        process.stderr.write(
          `Observed-answer monthly entity/path-family CSV saved to ${args.geoAnswerEntityPathFamilyMonthlyCsv}\n`
        );
      if (args.geoAnswerEntityPathFamilyComparisonCsv)
        process.stderr.write(
          `Observed-answer entity/path-family comparison CSV saved to ${args.geoAnswerEntityPathFamilyComparisonCsv}\n`
        );
      if (args.geoAnswerPathFamilyTrendsCsv)
        process.stderr.write(
          `Observed-answer monthly path-family trend CSV saved to ${args.geoAnswerPathFamilyTrendsCsv}\n`
        );
      if (args.geoAnswerPathFamilyCohortComparisonCsv)
        process.stderr.write(
          `Observed-answer path-family cohort comparison CSV saved to ${args.geoAnswerPathFamilyCohortComparisonCsv}\n`
        );
      if (args.geoAnswerPathFamilyCohortsCsv)
        process.stderr.write(
          `Observed-answer path-family cohort CSV saved to ${args.geoAnswerPathFamilyCohortsCsv}\n`
        );
      if (args.geoAnswerPathFamiliesCsv)
        process.stderr.write(
          `Observed-answer citation path-family CSV saved to ${args.geoAnswerPathFamiliesCsv}\n`
        );
      if (args.geoAnswerPathFamilyComparisonCsv)
        process.stderr.write(
          `Observed-answer citation path-family comparison CSV saved to ${args.geoAnswerPathFamilyComparisonCsv}\n`
        );
      if (args.geoAnswerCrawlerMatchesCsv)
        process.stderr.write(
          `Observed-answer cited-page crawler-log match CSV saved to ${args.geoAnswerCrawlerMatchesCsv}\n`
        );
      if (report.crawlerLogCorrelation) {
        const correlation = report.crawlerLogCorrelation;
        process.stderr.write(
          `Observed crawler paths match ${correlation.citedPagesWithCrawlerRequests}/${correlation.citedPagesReviewed} retained cited pages (${correlation.citedPagePathCoveragePercent === null ? 'no cited pages' : `${correlation.citedPagePathCoveragePercent}%`}); missing paths are sample absences, not block or fetch-failure evidence.\n`
        );
      }
      if (args.failOnGeoAnswerIncompleteListShare !== undefined) {
        const overallIncomplete = report.summary.incompleteCitationListObservations ?? 0;
        const overallShare =
          report.summary.observations > 0
            ? (overallIncomplete / report.summary.observations) * 100
            : 0;
        const providerShares = report.providers.map((profile) => {
          const incomplete = profile.incompleteCitationListObservations;
          return {
            provider: profile.provider,
            incomplete,
            observations: profile.observations,
            share:
              incomplete === undefined
                ? null
                : profile.observations > 0
                  ? (incomplete / profile.observations) * 100
                  : 0,
          };
        });
        const unknownProviders = providerShares.filter((profile) => profile.share === null);
        const failingProviders = providerShares.filter(
          (profile) =>
            profile.share !== null && profile.share > args.failOnGeoAnswerIncompleteListShare!
        );
        const overallFails = overallShare > args.failOnGeoAnswerIncompleteListShare;
        process.stderr.write(
          `Incomplete citation-list gate: ${overallIncomplete}/${report.summary.observations} overall (${overallShare.toFixed(2)}%); threshold ${args.failOnGeoAnswerIncompleteListShare}% applies overall and per provider.\n`
        );
        for (const profile of failingProviders.slice(0, 10)) {
          process.stderr.write(
            `❌ ${profile.provider}: ${profile.incomplete}/${profile.observations} incomplete (${profile.share!.toFixed(2)}%).\n`
          );
        }
        if (failingProviders.length > 10)
          process.stderr.write(
            `… and ${failingProviders.length - 10} more providers above the completeness limit.\n`
          );
        if (unknownProviders.length > 0)
          process.stderr.write(
            `❌ Completeness metadata is unavailable for ${unknownProviders.length} provider profile(s).\n`
          );
        if (overallFails || failingProviders.length > 0 || unknownProviders.length > 0)
          process.exitCode = 1;
      }
      if (args.failOnGeoAnswerIncompleteListShareRise !== undefined) {
        const profiles = report.topicIntentProviderMonthly ?? [];
        const transitions = profiles.filter(
          (profile) => profile.incompleteCitationListShareChangePercentagePoints !== undefined
        );
        const missingCurrent = profiles.some(
          (profile) =>
            profile.incompleteCitationListObservations === undefined ||
            profile.incompleteCitationListSharePercent === undefined
        );
        const missingTransition = transitions.some(
          (profile) => profile.previousIncompleteCitationListSharePercent === undefined
        );
        if (
          profiles.length === 0 ||
          transitions.length === 0 ||
          report.topicIntentProviderMonthlyTruncated ||
          missingCurrent ||
          missingTransition
        ) {
          process.stderr.write(
            '❌ Incomplete citation-list monthly-rise gate is not comparable: complete monthly completeness profiles and at least one sampled-month transition are required.\n'
          );
          if (report.topicIntentProviderMonthlyTruncated)
            process.stderr.write('  Provider/cohort monthly detail was capped.\n');
          if (transitions.length === 0)
            process.stderr.write('  No provider/cohort has two sampled months.\n');
          process.exitCode = 1;
        } else {
          const rises = transitions
            .filter(
              (profile) =>
                profile.incompleteCitationListShareChangePercentagePoints! >
                args.failOnGeoAnswerIncompleteListShareRise!
            )
            .sort(
              (left, right) =>
                right.incompleteCitationListShareChangePercentagePoints! -
                left.incompleteCitationListShareChangePercentagePoints!
            );
          process.stderr.write(
            `Monthly incomplete-list-share gate checked ${transitions.length} provider/cohort transitions against a +${args.failOnGeoAnswerIncompleteListShareRise} pp rise threshold.\n`
          );
          for (const profile of rises.slice(0, 10)) {
            process.stderr.write(
              `❌ ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): ${profile.previousIncompleteCitationListSharePercent!.toFixed(2)}% → ${profile.incompleteCitationListSharePercent!.toFixed(2)}% (Δ +${profile.incompleteCitationListShareChangePercentagePoints!.toFixed(2)} pp; ${profile.incompleteCitationListObservations}/${profile.observations} current lists incomplete).\n`
            );
          }
          if (rises.length > 10)
            process.stderr.write(
              `… and ${rises.length - 10} more provider/cohort completeness rises.\n`
            );
          if (rises.length > 0) process.exitCode = 1;
        }
      }
      const checkUnknownOwnedCitationStateShare = (
        label: string,
        threshold: number | undefined,
        overallUnknown: number | undefined,
        overallTotal: number,
        providers: Array<{ provider: string; unknown: number | undefined; total: number }>
      ): void => {
        if (threshold === undefined) return;
        const overallShare =
          overallUnknown === undefined || overallTotal <= 0
            ? null
            : (overallUnknown / overallTotal) * 100;
        const providerShares = providers.map((profile) => ({
          ...profile,
          share:
            profile.unknown === undefined || profile.total <= 0
              ? null
              : (profile.unknown / profile.total) * 100,
        }));
        const unknownMetadata =
          overallShare === null || providerShares.some((profile) => profile.share === null);
        const failing = providerShares.filter(
          (profile) => profile.share !== null && profile.share > threshold
        );
        process.stderr.write(
          `Unknown owned-citation ${label} gate: ${overallUnknown ?? 'unavailable'}/${overallTotal} overall (${overallShare === null ? 'unavailable' : `${overallShare.toFixed(2)}%`}); threshold ${threshold}% applies overall and per provider.\n`
        );
        for (const profile of failing.slice(0, 10)) {
          process.stderr.write(
            `❌ ${profile.provider}: ${profile.unknown}/${profile.total} unknown (${profile.share!.toFixed(2)}%).\n`
          );
        }
        if (failing.length > 10)
          process.stderr.write(
            `… and ${failing.length - 10} more providers above the unknown-state limit.\n`
          );
        if (unknownMetadata)
          process.stderr.write(
            '❌ Owned-citation completeness metadata is unavailable; the gate requires reports analyzed with configured owned domains.\n'
          );
        if (
          unknownMetadata ||
          (overallShare !== null && overallShare > threshold) ||
          failing.length > 0
        )
          process.exitCode = 1;
      };
      checkUnknownOwnedCitationStateShare(
        'observation-share',
        args.failOnGeoAnswerUnknownOwnedObservationShare,
        report.summary.observationsWithUnknownOwnedCitationState,
        report.summary.observations,
        report.providers.map((profile) => ({
          provider: profile.provider,
          unknown: profile.observationsWithUnknownOwnedCitationState,
          total: profile.observations,
        }))
      );
      checkUnknownOwnedCitationStateShare(
        'prompt-share',
        args.failOnGeoAnswerUnknownOwnedPromptShare,
        report.summary.promptsWithUnknownOwnedCitationState,
        report.summary.uniquePrompts,
        report.providers.map((profile) => ({
          provider: profile.provider,
          unknown: profile.promptsWithUnknownOwnedCitationState,
          total: profile.uniquePrompts,
        }))
      );
      if (args.failOnGeoAnswerUnknownOwnedStateShareRise !== undefined) {
        const profiles = report.topicIntentProviderMonthly ?? [];
        const transitions = profiles.filter(
          (profile) =>
            profile.unknownOwnedCitationStateObservationShareChangePercentagePoints !== undefined ||
            profile.unknownOwnedCitationStatePromptShareChangePercentagePoints !== undefined
        );
        const missingCurrent = profiles.some(
          (profile) =>
            profile.unknownOwnedCitationStateObservationSharePercent === undefined ||
            profile.unknownOwnedCitationStatePromptSharePercent === undefined
        );
        const missingPrevious = transitions.some(
          (profile) =>
            profile.previousUnknownOwnedCitationStateObservationSharePercent === undefined ||
            profile.previousUnknownOwnedCitationStatePromptSharePercent === undefined
        );
        if (
          profiles.length === 0 ||
          transitions.length === 0 ||
          report.topicIntentProviderMonthlyTruncated ||
          missingCurrent ||
          missingPrevious
        ) {
          process.stderr.write(
            '❌ Unknown owned-citation monthly-rise gate is not comparable: owned domains, complete monthly profiles, and at least one sampled-month transition are required.\n'
          );
          if (report.topicIntentProviderMonthlyTruncated)
            process.stderr.write('  Provider/cohort monthly detail was capped.\n');
          if (transitions.length === 0)
            process.stderr.write('  No provider/cohort has two sampled months.\n');
          process.exitCode = 1;
        } else {
          const rises = transitions
            .map((profile) => ({
              profile,
              observationRise:
                profile.unknownOwnedCitationStateObservationShareChangePercentagePoints ?? 0,
              promptRise: profile.unknownOwnedCitationStatePromptShareChangePercentagePoints ?? 0,
            }))
            .filter(
              (row) =>
                row.observationRise > args.failOnGeoAnswerUnknownOwnedStateShareRise! ||
                row.promptRise > args.failOnGeoAnswerUnknownOwnedStateShareRise!
            )
            .sort(
              (left, right) =>
                Math.max(right.observationRise, right.promptRise) -
                Math.max(left.observationRise, left.promptRise)
            );
          process.stderr.write(
            `Monthly unknown-owned-state gate checked ${transitions.length} provider/cohort transitions against a +${args.failOnGeoAnswerUnknownOwnedStateShareRise} pp threshold for snapshot and prompt shares.\n`
          );
          for (const { profile, observationRise, promptRise } of rises.slice(0, 10)) {
            process.stderr.write(
              `❌ ${profile.provider} · ${profile.topic ?? 'Unlabeled'} / ${profile.intent ?? 'Unlabeled'} (${profile.previousObservedMonth} → ${profile.month}): snapshot unknown ${profile.previousUnknownOwnedCitationStateObservationSharePercent!.toFixed(2)}% → ${profile.unknownOwnedCitationStateObservationSharePercent!.toFixed(2)}% (Δ ${observationRise > 0 ? '+' : ''}${observationRise.toFixed(2)} pp), prompt unknown ${profile.previousUnknownOwnedCitationStatePromptSharePercent!.toFixed(2)}% → ${profile.unknownOwnedCitationStatePromptSharePercent!.toFixed(2)}% (Δ ${promptRise > 0 ? '+' : ''}${promptRise.toFixed(2)} pp).\n`
            );
          }
          if (rises.length > 10)
            process.stderr.write(
              `… and ${rises.length - 10} more provider/cohort unknown-state rises.\n`
            );
          if (rises.length > 0) process.exitCode = 1;
        }
      }
      if (args.failOnGeoAnswerPromptPlanMiss) {
        const summary =
          promptPlanTargetSummary ??
          summarizeAiAnswerCitationPromptPlanTargets(
            report,
            args.geoAnswerPromptPlanMinPrompts ?? 0,
            args.geoAnswerPromptPlanOwnedReachMargin,
            args.geoAnswerPromptPlanMinimumJaccard,
            args.geoAnswerPromptPlanMaxPairedGroups,
            promptPlanCohortTargets,
            args.geoAnswerPromptPlanMaxTotalPairedGroups,
            args.geoAnswerPromptPlanTotalAllocation ?? 'balanced'
          );
        const reasons = [
          summary.cohortRowsAnalyzed === 0 ? 'no retained labeled provider/cohort rows' : undefined,
          summary.providerCohortQuotasBelowTarget > 0
            ? `${summary.providerCohortQuotasBelowTarget} provider/cohort quota row(s) below target`
            : undefined,
          summary.cohortsBelowPromptOverlapTarget > 0
            ? `${summary.cohortsBelowPromptOverlapTarget} cohort(s) below the exact-prompt overlap target`
            : undefined,
          summary.providerCohortPrecisionMarginsAboveTarget > 0
            ? `${summary.providerCohortPrecisionMarginsAboveTarget} provider/cohort precision margin(s) above target`
            : undefined,
          summary.detailsCapped ? 'cohort or provider-pair detail is capped' : undefined,
          summary.outputRowsTruncated ? 'prompt-plan output rows are truncated' : undefined,
        ].filter((reason): reason is string => Boolean(reason));
        const effortSummary = `${summary.plannedPairedPromptGroups}/${summary.requiredPairedPromptGroups} paired prompt groups planned (${summary.plannedPairedProviderCaptureRuns} provider captures; ${summary.deferredPairedPromptGroups} groups deferred)`;
        if (!summary.targetsMet) {
          process.stderr.write(
            `❌ GEO prompt-plan target check failed: ${reasons.join('; ')}; ${effortSummary}.\n`
          );
          process.exitCode = 1;
        } else {
          process.stderr.write(
            `✓ GEO prompt-plan targets met across ${summary.cohortRowsAnalyzed} provider/cohort rows; ${effortSummary}.\n`
          );
        }
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not analyze observed AI answer citations: ${message}\n`);
      process.exit(1);
    }
  }
  if (
    (args.geoCrawlerPathFamiliesCsv ||
      args.geoCrawlerPathFamiliesJson ||
      args.geoCrawlerPathFamiliesHtml ||
      args.geoCrawlerPathFamilyAuditCsv ||
      args.geoCrawlerPathFamilyAuditJson ||
      args.geoCrawlerPathFamilyAuditHtml ||
      args.geoCrawlerPathFamilyAuditComparisonCsv ||
      args.geoCrawlerPathFamilyAuditComparisonJson ||
      args.geoCrawlerPathFamilyAuditComparisonHtml ||
      args.geoCrawlerPathFamilyComparisonCsv ||
      args.geoCrawlerPathFamilyComparisonJson ||
      args.geoCrawlerPathFamilyComparisonHtml ||
      args.geoCrawlerPathFamilyFailureGateJson ||
      args.geoCrawlerPathDepth !== undefined ||
      args.failOnGeoCrawlerPathFamilyFailureRise !== undefined) &&
    !args.geoCrawlerLogs?.length
  ) {
    process.stderr.write(
      '❌ GEO crawler path-family output requires at least one --geo-crawler-log input.\n'
    );
    process.exit(2);
  }
  if (args.geoCrawlerIpRanges && !args.geoCrawlerLogs?.length) {
    process.stderr.write(
      '❌ --geo-crawler-ip-ranges requires at least one --geo-crawler-log input.\n'
    );
    process.exit(2);
  }
  if (args.geoCrawlerLogs?.length) {
    const allowedOptions = new Set([
      'geoCrawlerLogs',
      'geoCrawlerBaselineJson',
      'geoCrawlerTokens',
      'geoCrawlerIpRanges',
      'geoCrawlerPathFamiliesCsv',
      'geoCrawlerPathFamiliesJson',
      'geoCrawlerPathFamiliesHtml',
      'geoCrawlerPathFamilyAuditCsv',
      'geoCrawlerPathFamilyAuditJson',
      'geoCrawlerPathFamilyAuditHtml',
      'geoCrawlerPathFamilyAuditComparisonCsv',
      'geoCrawlerPathFamilyAuditComparisonJson',
      'geoCrawlerPathFamilyAuditComparisonHtml',
      'geoCrawlerPathFamilyComparisonCsv',
      'geoCrawlerPathFamilyComparisonJson',
      'geoCrawlerPathFamilyComparisonHtml',
      'geoCrawlerPathFamilyFailureGateJson',
      'geoCrawlerPathDepth',
      'geoAiReferralSources',
      'geoCrawlerOrigin',
      'geoCrawlerSitemap',
      'geoCrawlerSitemapMaxUrls',
      'geoAuditJson',
      'geoRobotsTxt',
      'geoRobotsBaselineTxt',
      'geoRobotsOrigin',
      'failOnNewlyBlockedGeoPaths',
      'failOnNewGeoCrawlerFailures',
      'failOnNewAiReferralFailures',
      'failOnAiCrawlerTimingRegression',
      'failOnGeoCrawlerPathFamilyFailureRise',
      'failOnAiCrawlerCloudFrontResultRegression',
      'json',
      'output',
      'html',
    ]);
    const incompatibleOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ --geo-crawler-log can only be combined with other GEO crawler-log options, --json, --output, and --html.\n'
      );
      process.exit(2);
    }
    if (
      args.geoCrawlerPathDepth !== undefined &&
      !args.geoCrawlerPathFamiliesCsv &&
      !args.geoCrawlerPathFamiliesJson &&
      !args.geoCrawlerPathFamiliesHtml &&
      !args.geoCrawlerPathFamilyAuditCsv &&
      !args.geoCrawlerPathFamilyAuditJson &&
      !args.geoCrawlerPathFamilyAuditHtml &&
      !args.geoCrawlerPathFamilyAuditComparisonCsv &&
      !args.geoCrawlerPathFamilyAuditComparisonJson &&
      !args.geoCrawlerPathFamilyAuditComparisonHtml &&
      !args.geoCrawlerPathFamilyComparisonCsv &&
      !args.geoCrawlerPathFamilyComparisonJson &&
      !args.geoCrawlerPathFamilyComparisonHtml &&
      args.failOnGeoCrawlerPathFamilyFailureRise === undefined
    ) {
      process.stderr.write(
        '❌ --geo-crawler-path-depth requires a route-family CSV, HTML, audit-correlation, or period-comparison output.\n'
      );
      process.exit(2);
    }
    if (
      (args.geoCrawlerPathFamilyComparisonCsv ||
        args.geoCrawlerPathFamilyComparisonJson ||
        args.geoCrawlerPathFamilyComparisonHtml) &&
      !args.geoCrawlerBaselineJson
    ) {
      process.stderr.write(
        '❌ Route-family period comparison output requires --geo-crawler-baseline-json.\n'
      );
      process.exit(2);
    }
    if (
      (args.geoCrawlerPathFamilyAuditCsv ||
        args.geoCrawlerPathFamilyAuditJson ||
        args.geoCrawlerPathFamilyAuditHtml ||
        args.geoCrawlerPathFamilyAuditComparisonCsv ||
        args.geoCrawlerPathFamilyAuditComparisonJson ||
        args.geoCrawlerPathFamilyAuditComparisonHtml) &&
      (!args.geoAuditJson || !args.geoCrawlerOrigin)
    ) {
      process.stderr.write(
        '❌ Route-family audit output requires both --geo-audit-json and --geo-crawler-origin.\n'
      );
      process.exit(2);
    }
    if (
      (args.geoCrawlerPathFamilyAuditComparisonCsv ||
        args.geoCrawlerPathFamilyAuditComparisonJson ||
        args.geoCrawlerPathFamilyAuditComparisonHtml) &&
      !args.geoCrawlerBaselineJson
    ) {
      process.stderr.write(
        '❌ Route-family audit comparison output requires --geo-crawler-baseline-json with prior audit correlations.\n'
      );
      process.exit(2);
    }
    if (args.geoCrawlerLogs.length > 100) {
      process.stderr.write('❌ --geo-crawler-log accepts at most 100 input files per run.\n');
      process.exit(2);
    }
    if (args.failOnNewGeoCrawlerFailures && !args.geoCrawlerBaselineJson) {
      process.stderr.write(
        '❌ --fail-on-new-geo-crawler-failures requires --geo-crawler-baseline-json.\n'
      );
      process.exit(2);
    }
    if (args.failOnNewAiReferralFailures && !args.geoCrawlerBaselineJson) {
      process.stderr.write(
        '❌ --fail-on-new-ai-referral-failures requires --geo-crawler-baseline-json.\n'
      );
      process.exit(2);
    }
    if (args.failOnAiCrawlerTimingRegression && !args.geoCrawlerBaselineJson) {
      process.stderr.write(
        '❌ --fail-on-ai-crawler-timing-regression requires --geo-crawler-baseline-json.\n'
      );
      process.exit(2);
    }
    if (args.failOnGeoCrawlerPathFamilyFailureRise !== undefined && !args.geoCrawlerBaselineJson) {
      process.stderr.write(
        '❌ --fail-on-geo-crawler-path-family-failure-rise requires --geo-crawler-baseline-json.\n'
      );
      process.exit(2);
    }
    if (
      args.geoCrawlerPathFamilyFailureGateJson &&
      args.failOnGeoCrawlerPathFamilyFailureRise === undefined
    ) {
      process.stderr.write(
        '❌ --geo-crawler-path-family-failure-gate-json requires --fail-on-geo-crawler-path-family-failure-rise.\n'
      );
      process.exit(2);
    }
    if (args.failOnAiCrawlerCloudFrontResultRegression && !args.geoCrawlerBaselineJson) {
      process.stderr.write(
        '❌ --fail-on-ai-crawler-cloudfront-result-regression requires --geo-crawler-baseline-json.\n'
      );
      process.exit(2);
    }
    if (
      (args.geoAuditJson && !args.geoCrawlerOrigin) ||
      (args.geoCrawlerOrigin && !args.geoAuditJson && !args.geoCrawlerSitemap) ||
      (args.geoCrawlerSitemap && !args.geoCrawlerOrigin)
    ) {
      process.stderr.write(
        '❌ --geo-audit-json requires --geo-crawler-origin; --geo-crawler-origin also accepts --geo-crawler-sitemap for sitemap date comparison.\n'
      );
      process.exit(2);
    }
    if (args.geoCrawlerSitemapMaxUrls !== undefined && !args.geoCrawlerSitemap) {
      process.stderr.write('❌ --geo-crawler-sitemap-max-urls requires --geo-crawler-sitemap.\n');
      process.exit(2);
    }
    if (Boolean(args.geoRobotsTxt) !== Boolean(args.geoRobotsOrigin)) {
      process.stderr.write(
        '❌ --geo-robots-txt and --geo-robots-origin must be supplied together for path-level robots replay.\n'
      );
      process.exit(2);
    }
    if (args.geoRobotsBaselineTxt && !args.geoRobotsTxt) {
      process.stderr.write(
        '❌ --geo-robots-baseline-txt requires a current --geo-robots-txt snapshot.\n'
      );
      process.exit(2);
    }
    if (
      args.failOnNewlyBlockedGeoPaths &&
      (!args.geoRobotsBaselineTxt || !args.geoRobotsTxt || !args.geoRobotsOrigin)
    ) {
      process.stderr.write(
        '❌ --fail-on-newly-blocked-geo-paths requires --geo-robots-baseline-txt, --geo-robots-txt, and --geo-robots-origin.\n'
      );
      process.exit(2);
    }
    try {
      let aiCrawlerIpRanges: AiCrawlerIpRangeDefinition[] | undefined;
      if (args.geoCrawlerIpRanges) {
        const rangeStats = fs.statSync(args.geoCrawlerIpRanges);
        if (!rangeStats.isFile())
          throw new Error(`${args.geoCrawlerIpRanges} is not a regular IP range JSON file.`);
        if (rangeStats.size > 5 * 1024 * 1024)
          throw new Error(`${args.geoCrawlerIpRanges} exceeds the 5 MiB input limit.`);
        const rangeData: unknown = JSON.parse(fs.readFileSync(args.geoCrawlerIpRanges, 'utf8'));
        if (
          !isRecord(rangeData) ||
          rangeData.schemaVersion !== 1 ||
          !Array.isArray(rangeData.crawlers)
        ) {
          throw new Error('IP range input must be a version 1 JSON object with a crawlers array.');
        }
        aiCrawlerIpRanges = rangeData.crawlers as AiCrawlerIpRangeDefinition[];
      }
      const aiReferralSources = args.geoAiReferralSources?.map((specification) => {
        const separator = specification.indexOf('=');
        if (separator < 1 || separator === specification.length - 1) {
          throw new Error(
            `Invalid --geo-ai-referral-source value "${specification}"; use label=exact_utm_source_value.`
          );
        }
        return {
          label: specification.slice(0, separator),
          value: specification.slice(separator + 1),
        };
      });
      const seenInputs = new Set<string>();
      let expandedBytes = 0;
      const analyses = args.geoCrawlerLogs.map((file) => {
        const stats = fs.statSync(file);
        if (!stats.isFile()) throw new Error(`${file} is not a regular file.`);
        if (stats.size > 100 * 1024 * 1024)
          throw new Error(`${file} exceeds the 100 MiB compressed or uncompressed input limit.`);
        const realPath = fs.realpathSync(file);
        if (seenInputs.has(realPath))
          throw new Error(`Input log ${file} is listed more than once.`);
        seenInputs.add(realPath);
        const bytes = fs.readFileSync(file);
        let content: Buffer;
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
          try {
            content = gunzipSync(bytes, { maxOutputLength: 256 * 1024 * 1024 });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Could not decompress ${file}: ${message}`);
          }
        } else {
          content = bytes;
        }
        expandedBytes += content.byteLength;
        if (expandedBytes > 250 * 1024 * 1024)
          throw new Error('Combined decompressed GEO log input exceeds the 250 MiB limit.');
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(content);
        } catch {
          throw new Error(`${file} is not valid UTF-8 text.`);
        }
        return analyzeAiCrawlerAccessLog(text, {
          sourceFile: file,
          ...(args.geoCrawlerTokens ? { customTokens: args.geoCrawlerTokens } : {}),
          ...(aiCrawlerIpRanges ? { ipRanges: aiCrawlerIpRanges } : {}),
          ...(aiReferralSources ? { aiReferralSources } : {}),
        });
      });
      let geoSummary: SiteWideGeoAnalysis | undefined;
      if (args.geoAuditJson) {
        const auditStats = fs.statSync(args.geoAuditJson);
        if (!auditStats.isFile())
          throw new Error(`${args.geoAuditJson} is not a regular audit JSON file.`);
        if (auditStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoAuditJson} exceeds the 100 MiB input limit.`);
        const rawAudit: unknown = JSON.parse(fs.readFileSync(args.geoAuditJson, 'utf8'));
        if (isSiteWideGeoAnalysis(rawAudit)) {
          geoSummary = rawAudit;
        } else {
          let batch: SEOAuditBatchReport;
          if (isSEOAuditBatchReport(rawAudit)) {
            batch = rawAudit;
          } else if (isSEOReport(rawAudit)) {
            batch = {
              timestamp: rawAudit.timestamp,
              summary: {
                requestedUrls: 1,
                concurrency: 1,
                completedUrls: 1,
                failedUrls: 0,
                passedChecks: rawAudit.summary.passed,
                failedChecks: rawAudit.summary.failed,
                averageScore: rawAudit.score,
              },
              results: [{ status: 'complete', url: rawAudit.url, report: rawAudit }],
            };
          } else {
            throw new Error(
              'Audit JSON must contain one SEO report, an SEO batch report, or a version 1 sitewide GEO summary.'
            );
          }
          geoSummary = analyzeSiteWideGeo(batch);
        }
      }
      const correlations =
        geoSummary && args.geoCrawlerOrigin
          ? analyses.map((analysis) =>
              correlateAiCrawlerAccessLogWithGeoAudit(analysis, geoSummary!, args.geoCrawlerOrigin!)
            )
          : undefined;
      let sitemapFreshnessAnalyses:
        ReturnType<typeof analyzeAiCrawlerSitemapRecrawlCoverage>[] | undefined;
      if (args.geoCrawlerSitemap && args.geoCrawlerOrigin) {
        let sitemapLocation: URL;
        let crawlerOrigin: URL;
        try {
          sitemapLocation = new URL(args.geoCrawlerSitemap);
          crawlerOrigin = new URL(args.geoCrawlerOrigin);
        } catch {
          throw new Error(
            '--geo-crawler-sitemap and --geo-crawler-origin must be valid absolute URLs.'
          );
        }
        if (
          !['http:', 'https:'].includes(sitemapLocation.protocol) ||
          sitemapLocation.username ||
          sitemapLocation.password ||
          sitemapLocation.search ||
          !['http:', 'https:'].includes(crawlerOrigin.protocol) ||
          crawlerOrigin.username ||
          crawlerOrigin.password ||
          crawlerOrigin.pathname !== '/' ||
          crawlerOrigin.search ||
          crawlerOrigin.hash ||
          sitemapLocation.origin !== crawlerOrigin.origin
        ) {
          throw new Error(
            '--geo-crawler-sitemap must be a credential-free HTTP(S) URL without a query string and share the --geo-crawler-origin origin.'
          );
        }
        sitemapLocation.hash = '';
        const maxUrls = args.geoCrawlerSitemapMaxUrls ?? 1_000;
        const sitemapEntries: SitemapPageEntry[] = [];
        let sitemapEntriesTruncated = false;
        const discoveredUrls = await discoverSitemapUrls(sitemapLocation.href, {
          maxUrls,
          onPageEntry: (entry) => {
            if (sitemapEntries.length < 50_000) sitemapEntries.push(entry);
            else sitemapEntriesTruncated = true;
          },
        });
        const sitemapUrlsTruncated = discoveredUrls.length >= maxUrls;
        sitemapFreshnessAnalyses = analyses.map((analysis) =>
          analyzeAiCrawlerSitemapRecrawlCoverage(
            analysis,
            sitemapEntries,
            crawlerOrigin.origin,
            sitemapLocation.href,
            {
              sitemapUrlsTruncated,
              entriesTruncated: sitemapEntriesTruncated,
              ...(geoSummary ? { audit: geoSummary } : {}),
            }
          )
        );
      }
      let robotsPolicyCorrelations:
        ReturnType<typeof analyzeAiCrawlerLogRobotsPolicy>[] | undefined;
      let robotsPolicyComparisons:
        ReturnType<typeof compareAiCrawlerRobotsPolicyReplays>[] | undefined;
      const readRobotsSnapshot = (file: string): { source: string; modifiedAt: string } => {
        const robotsStats = fs.statSync(file);
        if (!robotsStats.isFile()) throw new Error(`${file} is not a regular robots.txt file.`);
        if (robotsStats.size > 1024 * 1024)
          throw new Error(`${file} exceeds the 1 MiB robots.txt snapshot limit.`);
        const bytes = fs.readFileSync(file);
        let source: string;
        try {
          source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          throw new Error(`${file} is not valid UTF-8 text.`);
        }
        return { source, modifiedAt: robotsStats.mtime.toISOString() };
      };
      if (args.geoRobotsTxt && args.geoRobotsOrigin) {
        const currentSnapshot = readRobotsSnapshot(args.geoRobotsTxt);
        robotsPolicyCorrelations = analyses.map((analysis) =>
          analyzeAiCrawlerLogRobotsPolicy(analysis, currentSnapshot.source, args.geoRobotsOrigin!, {
            sourceFile: args.geoRobotsTxt,
            sourceModifiedAt: currentSnapshot.modifiedAt,
          })
        );
        if (args.geoRobotsBaselineTxt) {
          const baselineSnapshot = readRobotsSnapshot(args.geoRobotsBaselineTxt);
          const baselineReplays = analyses.map((analysis) =>
            analyzeAiCrawlerLogRobotsPolicy(
              analysis,
              baselineSnapshot.source,
              args.geoRobotsOrigin!,
              {
                sourceFile: args.geoRobotsBaselineTxt,
                sourceModifiedAt: baselineSnapshot.modifiedAt,
              }
            )
          );
          robotsPolicyComparisons = baselineReplays.map((baseline, index) =>
            compareAiCrawlerRobotsPolicyReplays(baseline, robotsPolicyCorrelations![index]!)
          );
        }
      }
      let logPeriodComparisons: ReturnType<typeof compareAiCrawlerAccessLogs>[] | undefined;
      let crawlerRouteFamilyPeriodComparisonCsv: string | undefined;
      let crawlerRouteFamilyPeriodComparisonJson: string | undefined;
      let crawlerRouteFamilyPeriodComparisonHtml: string | undefined;
      let crawlerRouteFamilyAuditComparisonCsv: string | undefined;
      let crawlerRouteFamilyAuditComparisonJson: string | undefined;
      let crawlerRouteFamilyAuditComparisonHtml: string | undefined;
      let crawlerPathFamilyFailureGate:
        ReturnType<typeof assessAiCrawlerPathFamilyFailureRise> | undefined;
      if (args.geoCrawlerBaselineJson) {
        const baselineStats = fs.statSync(args.geoCrawlerBaselineJson);
        if (!baselineStats.isFile())
          throw new Error(
            `${args.geoCrawlerBaselineJson} is not a regular crawler-log report JSON file.`
          );
        if (baselineStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoCrawlerBaselineJson} exceeds the 100 MiB input limit.`);
        const baselineReport: unknown = JSON.parse(
          fs.readFileSync(args.geoCrawlerBaselineJson, 'utf8')
        );
        if (
          !baselineReport ||
          typeof baselineReport !== 'object' ||
          !Array.isArray((baselineReport as { analyses?: unknown }).analyses)
        ) {
          throw new Error(
            'Crawler baseline JSON must be an Aviary access-log report with an analyses array.'
          );
        }
        const baselineAnalyses = (baselineReport as { analyses: unknown[] }).analyses;
        if (baselineAnalyses.length !== analyses.length) {
          throw new Error(
            `Crawler baseline has ${baselineAnalyses.length} analysis sample(s), but the current run has ${analyses.length}; pair one baseline analysis with each current log input.`
          );
        }
        const validBaselineAnalyses = baselineAnalyses.map((candidate, index) => {
          if (!candidate || typeof candidate !== 'object')
            throw new Error(`Baseline analysis ${index + 1} is not an object.`);
          const value = candidate as Partial<AiCrawlerAccessLogAnalysis>;
          if (
            value.source !== 'Aviary AI crawler access log analysis' ||
            value.schemaVersion !== 1 ||
            !Array.isArray(value.crawlers)
          ) {
            throw new Error(
              `Baseline analysis ${index + 1} is not a supported version 1 Aviary crawler-log analysis.`
            );
          }
          return value as AiCrawlerAccessLogAnalysis;
        });
        logPeriodComparisons = analyses.map((analysis, index) =>
          compareAiCrawlerAccessLogs(validBaselineAnalyses[index]!, analysis)
        );
        if (args.geoCrawlerPathFamilyComparisonCsv || args.geoCrawlerPathFamilyComparisonJson) {
          crawlerRouteFamilyPeriodComparisonCsv = renderAiCrawlerPathFamilyPeriodComparisonCsv(
            validBaselineAnalyses,
            analyses,
            args.geoCrawlerPathDepth ?? 2
          );
          if (args.geoCrawlerPathFamilyComparisonJson) {
            crawlerRouteFamilyPeriodComparisonJson =
              renderAiCrawlerPathFamilyPeriodComparisonJsonFromCsv(
                crawlerRouteFamilyPeriodComparisonCsv,
                validBaselineAnalyses,
                analyses
              );
          }
        }
        if (args.geoCrawlerPathFamilyComparisonHtml) {
          crawlerRouteFamilyPeriodComparisonHtml = renderAiCrawlerPathFamilyPeriodComparisonHtml(
            validBaselineAnalyses,
            analyses,
            args.geoCrawlerPathDepth ?? 2
          );
        }
        if (args.failOnGeoCrawlerPathFamilyFailureRise !== undefined) {
          crawlerPathFamilyFailureGate = assessAiCrawlerPathFamilyFailureRise(
            validBaselineAnalyses,
            analyses,
            args.failOnGeoCrawlerPathFamilyFailureRise,
            args.geoCrawlerPathDepth ?? 2
          );
        }
        if (
          args.geoCrawlerPathFamilyAuditComparisonCsv ||
          args.geoCrawlerPathFamilyAuditComparisonJson ||
          args.geoCrawlerPathFamilyAuditComparisonHtml
        ) {
          const rawCorrelations = (baselineReport as { correlations?: unknown }).correlations;
          if (
            !Array.isArray(rawCorrelations) ||
            rawCorrelations.length !== correlations?.length ||
            !correlations
          ) {
            throw new Error(
              'Route-family audit comparison requires a baseline crawler report with one exact-path GEO correlation per current log input.'
            );
          }
          const validBaselineCorrelations = rawCorrelations.map((candidate, index) => {
            if (!candidate || typeof candidate !== 'object')
              throw new Error(`Baseline audit correlation ${index + 1} is not an object.`);
            const value = candidate as Partial<AiCrawlerLogGeoCorrelation>;
            if (
              typeof value.origin !== 'string' ||
              typeof value.auditTimestamp !== 'string' ||
              !Array.isArray(value.pathObservations)
            ) {
              throw new Error(
                `Baseline audit correlation ${index + 1} is missing its origin, snapshot timestamp, or path observations.`
              );
            }
            return value as AiCrawlerLogGeoCorrelation;
          });
          if (
            args.geoCrawlerPathFamilyAuditComparisonCsv ||
            args.geoCrawlerPathFamilyAuditComparisonJson
          ) {
            crawlerRouteFamilyAuditComparisonCsv = renderAiCrawlerPathFamilyAuditComparisonCsv(
              validBaselineCorrelations,
              correlations,
              args.geoCrawlerPathDepth ?? 2
            );
            if (args.geoCrawlerPathFamilyAuditComparisonJson) {
              crawlerRouteFamilyAuditComparisonJson =
                renderAiCrawlerPathFamilyAuditComparisonJsonFromCsv(
                  crawlerRouteFamilyAuditComparisonCsv,
                  validBaselineCorrelations,
                  correlations
                );
            }
          }
          if (args.geoCrawlerPathFamilyAuditComparisonHtml) {
            crawlerRouteFamilyAuditComparisonHtml = renderAiCrawlerPathFamilyAuditComparisonHtml(
              validBaselineCorrelations,
              correlations,
              args.geoCrawlerPathDepth ?? 2
            );
          }
        }
      }
      const inputFiles = [
        ...seenInputs,
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
        ...(args.geoRobotsTxt ? [args.geoRobotsTxt] : []),
        ...(args.geoRobotsBaselineTxt ? [args.geoRobotsBaselineTxt] : []),
        ...(args.geoCrawlerBaselineJson ? [args.geoCrawlerBaselineJson] : []),
        ...(args.geoCrawlerIpRanges ? [args.geoCrawlerIpRanges] : []),
      ];
      const outputFiles = [
        args.output,
        args.html,
        args.geoCrawlerPathFamiliesCsv,
        args.geoCrawlerPathFamiliesJson,
        args.geoCrawlerPathFamiliesHtml,
        args.geoCrawlerPathFamilyAuditCsv,
        args.geoCrawlerPathFamilyAuditJson,
        args.geoCrawlerPathFamilyAuditHtml,
        args.geoCrawlerPathFamilyAuditComparisonCsv,
        args.geoCrawlerPathFamilyAuditComparisonJson,
        args.geoCrawlerPathFamilyAuditComparisonHtml,
        args.geoCrawlerPathFamilyComparisonCsv,
        args.geoCrawlerPathFamilyComparisonJson,
        args.geoCrawlerPathFamilyComparisonHtml,
        args.geoCrawlerPathFamilyFailureGateJson,
      ].filter((file): file is string => Boolean(file));
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        )
      ) {
        throw new Error(
          'JSON, HTML, and CSV output paths must differ from all crawler input files.'
        );
      }
      for (let index = 0; index < outputFiles.length; index += 1) {
        for (let next = index + 1; next < outputFiles.length; next += 1) {
          if (pathsReferToSameFile(outputFiles[index]!, outputFiles[next]!)) {
            throw new Error('Crawler log report output paths must point to different files.');
          }
        }
      }
      const report = {
        source: 'Aviary AI crawler access log analysis',
        schemaVersion: 1,
        analyses,
        ...(correlations ? { correlations } : {}),
        ...(sitemapFreshnessAnalyses ? { sitemapFreshnessAnalyses } : {}),
        ...(robotsPolicyCorrelations ? { robotsPolicyCorrelations } : {}),
        ...(robotsPolicyComparisons ? { robotsPolicyComparisons } : {}),
        ...(logPeriodComparisons ? { logPeriodComparisons } : {}),
      };
      if (args.failOnNewlyBlockedGeoPaths) {
        const failures = (robotsPolicyComparisons ?? []).filter(
          (comparison) =>
            comparison.pathsNewlyBlocked > 0 ||
            comparison.inputPathsTruncated ||
            comparison.pathChangesTruncated ||
            comparison.pathsMissingFromBaseline > 0 ||
            comparison.pathsMissingFromCurrent > 0
        );
        if (failures.length > 0) {
          const blockedPaths = failures.reduce(
            (sum, comparison) => sum + comparison.pathsNewlyBlocked,
            0
          );
          const blockedRequests = failures.reduce(
            (sum, comparison) => sum + comparison.requestsNewlyBlocked,
            0
          );
          const incomplete = failures.some(
            (comparison) =>
              comparison.inputPathsTruncated ||
              comparison.pathChangesTruncated ||
              comparison.pathsMissingFromBaseline > 0 ||
              comparison.pathsMissingFromCurrent > 0
          );
          process.stderr.write(
            `❌ GEO robots release gate failed: ${blockedPaths} comparable path(s) became blocked across ${blockedRequests} logged request(s)${incomplete ? '; comparison detail was truncated or incomplete' : ''}.\n`
          );
          process.exitCode = 1;
        }
      }
      if (args.failOnNewGeoCrawlerFailures && logPeriodComparisons) {
        const regressionRows = logPeriodComparisons.flatMap((comparison) =>
          comparison.crawlers.map((crawler) => {
            const newlyFailingRetainedPaths =
              crawler.sharedPathsWithNewFailures +
              crawler.pathChanges.filter(
                ({ change, current: path }) =>
                  change === 'current-only-retained' && (path?.failureRatePercent ?? 0) > 0
              ).length;
            return {
              token: crawler.token,
              newlyFailingRetainedPaths,
              failureRateDelta: crawler.failureRateDeltaPercentagePoints,
              incomplete: crawler.inputPathsTruncated || crawler.pathChangesTruncated,
            };
          })
        );
        const regressions = regressionRows.filter(
          (row) => row.newlyFailingRetainedPaths > 0 || row.failureRateDelta > 0 || row.incomplete
        );
        if (regressions.length > 0) {
          const newlyFailingPaths = regressions.reduce(
            (sum, row) => sum + row.newlyFailingRetainedPaths,
            0
          );
          const incomplete = regressions.some((row) => row.incomplete);
          process.stderr.write(
            `❌ GEO crawler regression gate failed: ${newlyFailingPaths} retained path(s) gained 4xx/5xx responses, ${regressions.filter((row) => row.failureRateDelta > 0).length} crawler failure rate(s) increased${incomplete ? ', and at least one comparison is incomplete' : ''}.\n`
          );
          process.exitCode = 1;
        }
      }
      if (args.failOnNewAiReferralFailures && logPeriodComparisons) {
        const referralComparisons = logPeriodComparisons.flatMap(
          ({ aiReferralSources }) => aiReferralSources
        );
        const failureRateIncreased = (source: (typeof referralComparisons)[number]): boolean => {
          if (
            !source.comparisonAvailable ||
            source.baselineRequests === null ||
            source.currentRequests === null ||
            source.baselineFailureRequests === null ||
            source.currentFailureRequests === null ||
            source.currentRequests === 0
          )
            return false;
          if (source.baselineRequests === 0) return source.currentFailureRequests > 0;
          return (
            source.currentFailureRequests * source.baselineRequests >
            source.baselineFailureRequests * source.currentRequests
          );
        };
        const regressions = referralComparisons.filter(
          (source) =>
            !source.comparisonAvailable ||
            failureRateIncreased(source) ||
            source.pathsWithNewFailures > 0 ||
            source.baselinePathsTruncated === true ||
            source.currentPathsTruncated === true ||
            source.pathChangesTruncated
        );
        if (regressions.length > 0) {
          const newlyFailingPaths = regressions.reduce(
            (sum, source) => sum + source.pathsWithNewFailures,
            0
          );
          const risingFailureRates = regressions.filter(failureRateIncreased).length;
          const incomplete = regressions.some(
            (source) =>
              !source.comparisonAvailable ||
              source.baselinePathsTruncated === true ||
              source.currentPathsTruncated === true ||
              source.pathChangesTruncated
          );
          process.stderr.write(
            `❌ GEO AI-referral release gate failed: ${newlyFailingPaths} retained path(s) gained 4xx/5xx responses, ${risingFailureRates} source failure rate(s) increased${incomplete ? ', and at least one source/path comparison is missing, truncated, or incomplete' : ''}.\n`
          );
          process.exitCode = 1;
        }
      }
      if (
        args.failOnGeoCrawlerPathFamilyFailureRise !== undefined &&
        crawlerPathFamilyFailureGate
      ) {
        const gate = crawlerPathFamilyFailureGate;
        if (args.geoCrawlerPathFamilyFailureGateJson) {
          fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyFailureGateJson), { recursive: true });
          fs.writeFileSync(
            args.geoCrawlerPathFamilyFailureGateJson,
            renderAiCrawlerPathFamilyFailureGateJson(gate),
            'utf8'
          );
          process.stderr.write(
            `AI-crawler route-family failure gate JSON saved to ${args.geoCrawlerPathFamilyFailureGateJson}\n`
          );
        }
        const insufficientSupport = gate.supportInsufficient;
        if (gate.incomplete || insufficientSupport || gate.familiesAboveThreshold.length > 0) {
          const examples = gate.familiesAboveThreshold
            .slice(0, 5)
            .map(
              (item) =>
                `${item.crawlerToken} ${item.pathFamily} +${item.increasePercentagePoints} pp (${item.baselineRequests} → ${item.currentRequests} requests)`
            );
          const capNote = gate.incomplete ? '; retained path/output details are truncated' : '';
          const supportNote = insufficientSupport
            ? gate.matchedFamilies === 0
              ? '; no route families matched between the two periods'
              : gate.matchedFamiliesBelowSupport === gate.matchedFamilies
                ? `; all ${gate.matchedFamilies} matched families were below ${gate.minimumRequestsPerPeriod} requests in one or both periods`
                : '; matched route-family rows did not have usable failure-rate data'
            : '';
          const detail = examples.length > 0 ? `; ${examples.join('; ')}` : '';
          process.stderr.write(
            `❌ GEO crawler route-family failure gate failed: ${gate.familiesAboveThreshold.length} matched family/families exceeded the ${gate.thresholdPercentagePoints} pp rise threshold across ${gate.matchedFamiliesCompared} sufficiently sampled family/families${capNote}${supportNote}${detail}.\n`
          );
          process.exitCode = 1;
        } else {
          process.stderr.write(
            `✓ GEO crawler route-family failure gate passed: no failure-rate rise exceeded ${gate.thresholdPercentagePoints} pp across ${gate.matchedFamiliesCompared} matched families with at least ${gate.minimumRequestsPerPeriod} requests per period.\n`
          );
        }
      }
      if (args.failOnAiCrawlerTimingRegression && logPeriodComparisons) {
        const timingMetrics = logPeriodComparisons.flatMap(({ crawlers }) =>
          crawlers.flatMap(({ token, timing }) => [
            { token, metric: 'response duration', comparison: timing.responseDuration },
            { token, metric: 'time to first byte', comparison: timing.timeToFirstByte },
          ])
        );
        const comparable = timingMetrics.filter(
          ({ comparison }) => comparison.change !== 'not-comparable'
        );
        const regressions = comparable.filter(({ comparison }) => comparison.change === 'slower');
        if (regressions.length > 0 || comparable.length === 0) {
          const durationRegressions = regressions.filter(
            ({ metric }) => metric === 'response duration'
          ).length;
          const firstByteRegressions = regressions.filter(
            ({ metric }) => metric === 'time to first byte'
          ).length;
          process.stderr.write(
            `❌ GEO crawler timing gate failed: ${durationRegressions} response-duration and ${firstByteRegressions} first-byte p95 bands worsened across ${comparable.length} comparable metrics; ${timingMetrics.length - comparable.length} metrics lacked at least 20 timing rows in both periods.\n`
          );
          process.exitCode = 1;
        }
      }
      if (args.failOnAiCrawlerCloudFrontResultRegression && logPeriodComparisons) {
        const errorResultTypes = new Set(['Error', 'CapacityExceeded', 'LimitExceeded']);
        const metrics = logPeriodComparisons.flatMap(({ crawlers }) =>
          crawlers.flatMap((crawler) => {
            const fields = [
              {
                field: 'x-edge-result-type',
                baselineSamples: crawler.cloudFrontResults.baselineRequestsWithResultType,
                currentSamples: crawler.cloudFrontResults.currentRequestsWithResultType,
                types: crawler.cloudFrontResults.resultTypes,
              },
              {
                field: 'x-edge-response-result-type',
                baselineSamples: crawler.cloudFrontResults.baselineRequestsWithResponseResultType,
                currentSamples: crawler.cloudFrontResults.currentRequestsWithResponseResultType,
                types: crawler.cloudFrontResults.responseResultTypes,
              },
            ];
            return fields.flatMap((source) =>
              source.types
                .filter(({ resultType }) => errorResultTypes.has(resultType))
                .map((comparison) => ({
                  token: crawler.token,
                  field: source.field,
                  resultType: comparison.resultType,
                  baselineSamples: source.baselineSamples,
                  currentSamples: source.currentSamples,
                  baselineRequests: comparison.baselineRequests,
                  currentRequests: comparison.currentRequests,
                  shareDelta: comparison.shareDeltaPercentagePoints,
                  rawShareDelta:
                    source.baselineSamples !== null &&
                    source.currentSamples !== null &&
                    source.baselineSamples > 0 &&
                    source.currentSamples > 0 &&
                    comparison.baselineRequests !== null &&
                    comparison.currentRequests !== null
                      ? Number(
                          (
                            (comparison.currentRequests / source.currentSamples -
                              comparison.baselineRequests / source.baselineSamples) *
                            100
                          ).toFixed(4)
                        )
                      : null,
                }))
            );
          })
        );
        const comparable = metrics.filter(
          ({ baselineSamples, currentSamples, shareDelta }) =>
            baselineSamples !== null &&
            currentSamples !== null &&
            baselineSamples >= 20 &&
            currentSamples >= 20 &&
            shareDelta !== null
        );
        const regressions = comparable.filter(
          ({ baselineSamples, currentSamples, baselineRequests, currentRequests }) =>
            baselineSamples !== null &&
            currentSamples !== null &&
            baselineRequests !== null &&
            currentRequests !== null &&
            BigInt(currentRequests) * BigInt(baselineSamples) >
              BigInt(baselineRequests) * BigInt(currentSamples)
        );
        if (regressions.length > 0 || comparable.length === 0) {
          const examples = regressions
            .slice(0, 5)
            .map(
              ({ token, field, resultType, rawShareDelta }) =>
                `${token} ${field} ${resultType} ${rawShareDelta !== null && rawShareDelta >= 0.01 ? `+${rawShareDelta} pp` : 'increased by under 0.01 pp'}`
            )
            .join('; ');
          process.stderr.write(
            `❌ GEO CloudFront crawler-result gate failed: ${regressions.length} error-class share(s) increased across ${comparable.length} comparable field/category metrics${comparable.length === 0 ? '; no field/category pair had at least 20 rows in both periods' : ''}${examples ? `; ${examples}` : ''}.\n`
          );
          process.exitCode = 1;
        }
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
      }
      if (args.html) {
        fs.mkdirSync(path.dirname(args.html), { recursive: true });
        fs.writeFileSync(
          args.html,
          renderAiCrawlerAccessLogHtml(
            analyses,
            correlations,
            robotsPolicyCorrelations,
            robotsPolicyComparisons,
            logPeriodComparisons,
            sitemapFreshnessAnalyses
          ),
          'utf8'
        );
      }
      const crawlerPathFamiliesCsv =
        args.geoCrawlerPathFamiliesCsv || args.geoCrawlerPathFamiliesJson
          ? renderAiCrawlerPathFamiliesCsv(analyses, args.geoCrawlerPathDepth ?? 2)
          : undefined;
      if (args.geoCrawlerPathFamiliesCsv) {
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamiliesCsv), { recursive: true });
        fs.writeFileSync(args.geoCrawlerPathFamiliesCsv, crawlerPathFamiliesCsv!, 'utf8');
        process.stderr.write(
          `AI-crawler route-family CSV saved to ${args.geoCrawlerPathFamiliesCsv}\n`
        );
      }
      if (args.geoCrawlerPathFamiliesJson) {
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamiliesJson), { recursive: true });
        fs.writeFileSync(
          args.geoCrawlerPathFamiliesJson,
          renderAiCrawlerPathFamiliesJsonFromCsv(crawlerPathFamiliesCsv!, analyses),
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family JSON saved to ${args.geoCrawlerPathFamiliesJson}\n`
        );
      }
      if (args.geoCrawlerPathFamiliesHtml) {
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamiliesHtml), { recursive: true });
        fs.writeFileSync(
          args.geoCrawlerPathFamiliesHtml,
          renderAiCrawlerPathFamiliesHtml(analyses, args.geoCrawlerPathDepth ?? 2),
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family dashboard saved to ${args.geoCrawlerPathFamiliesHtml}\n`
        );
      }
      const crawlerPathFamilyAuditCsv =
        args.geoCrawlerPathFamilyAuditCsv || args.geoCrawlerPathFamilyAuditJson
          ? correlations
            ? renderAiCrawlerPathFamilyAuditCorrelationCsv(
                correlations,
                args.geoCrawlerPathDepth ?? 2
              )
            : undefined
          : undefined;
      if (args.geoCrawlerPathFamilyAuditJson) {
        if (!crawlerPathFamilyAuditCsv)
          throw new Error('Crawler route-family audit correlation was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyAuditJson), { recursive: true });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyAuditJson,
          renderAiCrawlerPathFamilyAuditCorrelationJsonFromCsv(
            crawlerPathFamilyAuditCsv,
            correlations
          ),
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family audit correlation JSON saved to ${args.geoCrawlerPathFamilyAuditJson}\n`
        );
      }
      if (args.geoCrawlerPathFamilyAuditCsv) {
        if (!crawlerPathFamilyAuditCsv)
          throw new Error('Crawler route-family audit correlation was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyAuditCsv), { recursive: true });
        fs.writeFileSync(args.geoCrawlerPathFamilyAuditCsv, crawlerPathFamilyAuditCsv, 'utf8');
        process.stderr.write(
          `AI-crawler route-family audit correlation CSV saved to ${args.geoCrawlerPathFamilyAuditCsv}\n`
        );
      }
      if (args.geoCrawlerPathFamilyAuditHtml) {
        if (!correlations)
          throw new Error('Crawler route-family audit correlation was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyAuditHtml), { recursive: true });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyAuditHtml,
          renderAiCrawlerPathFamilyAuditCorrelationHtml(
            correlations,
            args.geoCrawlerPathDepth ?? 2
          ),
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family audit dashboard saved to ${args.geoCrawlerPathFamilyAuditHtml}\n`
        );
      }
      if (args.geoCrawlerPathFamilyAuditComparisonJson) {
        if (!crawlerRouteFamilyAuditComparisonCsv)
          throw new Error('Crawler route-family audit comparison was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyAuditComparisonJson), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyAuditComparisonJson,
          crawlerRouteFamilyAuditComparisonJson!,
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family audit comparison JSON saved to ${args.geoCrawlerPathFamilyAuditComparisonJson}\n`
        );
      }
      if (args.geoCrawlerPathFamilyAuditComparisonCsv) {
        if (!crawlerRouteFamilyAuditComparisonCsv)
          throw new Error('Crawler route-family audit comparison was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyAuditComparisonCsv), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyAuditComparisonCsv,
          crawlerRouteFamilyAuditComparisonCsv,
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family audit comparison CSV saved to ${args.geoCrawlerPathFamilyAuditComparisonCsv}\n`
        );
      }
      if (args.geoCrawlerPathFamilyAuditComparisonHtml) {
        if (!crawlerRouteFamilyAuditComparisonHtml)
          throw new Error('Crawler route-family audit comparison dashboard was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyAuditComparisonHtml), {
          recursive: true,
        });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyAuditComparisonHtml,
          crawlerRouteFamilyAuditComparisonHtml,
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family audit comparison dashboard saved to ${args.geoCrawlerPathFamilyAuditComparisonHtml}\n`
        );
      }
      if (args.geoCrawlerPathFamilyComparisonJson) {
        if (!crawlerRouteFamilyPeriodComparisonCsv)
          throw new Error('Crawler route-family period comparison was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyComparisonJson), { recursive: true });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyComparisonJson,
          crawlerRouteFamilyPeriodComparisonJson!,
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family period comparison JSON saved to ${args.geoCrawlerPathFamilyComparisonJson}\n`
        );
      }
      if (args.geoCrawlerPathFamilyComparisonCsv) {
        if (!crawlerRouteFamilyPeriodComparisonCsv)
          throw new Error('Crawler route-family period comparison was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyComparisonCsv), { recursive: true });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyComparisonCsv,
          crawlerRouteFamilyPeriodComparisonCsv,
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family period comparison CSV saved to ${args.geoCrawlerPathFamilyComparisonCsv}\n`
        );
      }
      if (args.geoCrawlerPathFamilyComparisonHtml) {
        if (!crawlerRouteFamilyPeriodComparisonHtml)
          throw new Error('Crawler route-family period comparison dashboard was not produced.');
        fs.mkdirSync(path.dirname(args.geoCrawlerPathFamilyComparisonHtml), { recursive: true });
        fs.writeFileSync(
          args.geoCrawlerPathFamilyComparisonHtml,
          crawlerRouteFamilyPeriodComparisonHtml,
          'utf8'
        );
        process.stderr.write(
          `AI-crawler route-family period comparison dashboard saved to ${args.geoCrawlerPathFamilyComparisonHtml}\n`
        );
      }
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (args.output)
          process.stderr.write(`Structured crawler log report saved to ${args.output}\n`);
        if (args.html)
          process.stderr.write(`Offline crawler log HTML report saved to ${args.html}\n`);
      } else {
        for (const [index, analysis] of analyses.entries()) {
          process.stdout.write(
            `AI crawler access log (${analysis.sourceFile}): ${analysis.recognizedAiCrawlerRequests} claimed crawler requests across ${analysis.crawlers.length} tokens and ${analysis.uniquePathsAcrossRecognizedBots} paths\n`
          );
          const utmCoverage = analysis.utmSourceAttributionCoverage;
          if (utmCoverage) {
            const markerShare =
              utmCoverage.parsedRequestRows > 0
                ? `${((utmCoverage.requestsWithUtmSource / utmCoverage.parsedRequestRows) * 100).toFixed(1)}%`
                : '—';
            process.stdout.write(
              `  UTM source markers: ${utmCoverage.requestsWithUtmSource}/${utmCoverage.parsedRequestRows} parsed requests (${markerShare}); ${utmCoverage.requestsWithConfiguredSource} configured, ${utmCoverage.requestsWithUnconfiguredSingleValue} unconfigured single values, ${utmCoverage.requestsWithConflictingValues} conflicting, ${utmCoverage.requestsWithEmptyOrOversizedValue} empty/oversized; unmatched values are discarded and not assumed to be AI referrals.\n`
            );
          }
          const referralSources = analysis.aiReferralTraffic.filter(({ requests }) => requests > 0);
          if (referralSources.length === 0) {
            process.stdout.write(
              '  AI referral UTM tags: no configured source values observed (request counts do not represent sessions).\n'
            );
          } else {
            for (const source of referralSources.slice(0, 10)) {
              process.stdout.write(
                `  AI referral ${source.source}: ${source.requests} tagged requests across ${source.uniquePaths}${source.uniquePathsTruncated ? '+' : ''} retained paths; ` +
                  `${source.responseClasses.successful2xx} 2xx, ${source.responseClasses.redirects3xx} 3xx, ${source.responseClasses.clientErrors4xx} 4xx, ${source.responseClasses.serverErrors5xx} 5xx` +
                  `${source.firstSeenAt ? `; ${source.firstSeenAt} → ${source.lastSeenAt ?? source.firstSeenAt}` : '; no parseable timestamps'}${source.pathsTruncated ? '; path details capped' : ''}.\n`
              );
            }
          }
          for (const crawler of analysis.crawlers) {
            process.stdout.write(
              `  ${crawler.provider} ${crawler.token} [${crawler.activity}]: ${crawler.requests} requests, ${crawler.uniquePaths} paths; ` +
                `${crawler.responseClasses.successful2xx} 2xx, ${crawler.responseClasses.redirects3xx} 3xx, ${crawler.responseClasses.clientErrors4xx} 4xx, ${crawler.responseClasses.serverErrors5xx} 5xx, ${crawler.responseClasses.other} other` +
                `${crawler.originStatusObservations ? `; edge/origin differ on ${crawler.edgeOriginStatusDifferences}/${crawler.originStatusObservations} paired responses` : ''}; request timing ${formatAiCrawlerTiming(crawler.responseTiming)}${formatAiCrawlerCloudFrontResults(crawler.cloudFrontResultProfile)}\n`
            );
            if (crawler.pathsWithFailures > 0) {
              const hotspots = crawler.failureHotspots
                .slice(0, 3)
                .map(
                  ({
                    path: pathname,
                    failureRequests,
                    requests,
                    cloudflareVerifiedBotFailureRequests,
                    cloudflareVerifiedBotRequests,
                    cloudflareBlockingFailureRequests,
                    cloudflareChallengeFailureRequests,
                    cloudflareChallengeResolvedFailureRequests,
                    cloudflareSecurityActionRequests,
                  }) =>
                    `${pathname} (${failureRequests}/${requests}, ${Number(((failureRequests / requests) * 100).toFixed(1))}%${cloudflareVerifiedBotRequests ? `; Cloudflare-verified ${cloudflareVerifiedBotFailureRequests}/${cloudflareVerifiedBotRequests} failed` : ''}${cloudflareSecurityActionRequests ? `; edge actions on path ${cloudflareBlockingFailureRequests} block/${cloudflareChallengeFailureRequests} challenge/${cloudflareChallengeResolvedFailureRequests} resolved failures` : ''})`
                )
                .join('; ');
              process.stdout.write(
                `    4xx/5xx: ${crawler.failureRequests}/${crawler.requests} requests (${crawler.failureRatePercent}%) across ${crawler.pathsWithFailures} paths; leading hotspots: ${hotspots}${crawler.failureHotspotsTruncated ? '; additional paths omitted' : ''}\n`
              );
            }
            if (crawler.cloudflareBotEvidence.requestsWithCloudflareBotFields > 0) {
              const evidence = crawler.cloudflareBotEvidence;
              const groups = evidence.botScoreGroups;
              const sources = Object.entries(evidence.botScoreSourceCounts)
                .filter(([, requests]) => requests > 0)
                .map(([source, requests]) => `${source} ${requests}`)
                .join(', ');
              const verifiedCategories = evidence.verifiedBotCategories
                .slice(0, 3)
                .map(({ category, requests }) => `${category} ${requests}`)
                .join(', ');
              process.stdout.write(
                `    Cloudflare bot fields: ${evidence.requestsWithCloudflareBotFields} requests; ${evidence.verifiedBotRequests} with verified-bot evidence; ` +
                  `scores: ${groups.automated} automated, ${groups.likelyAutomated} likely automated, ${groups.likelyHuman} likely human, ${groups.notComputed} not computed (${evidence.requestsWithBotScore} scored); ` +
                  `sources: ${sources || 'not supplied'}; verified categories: ${verifiedCategories || 'not supplied'}${evidence.verifiedBotCategoriesTruncated || evidence.verifiedBotCategories.length > 3 ? ', more omitted' : ''}. These annotations do not prove the claimed product identity.\n`
              );
            }
            const security = crawler.cloudflareSecurityActions;
            if (security.requestsWithSecurityActions > 0) {
              process.stdout.write(
                `    Cloudflare security actions: ${security.blockingRequests} blocking, ${security.challengeRequests} challenge, ${security.challengeSolvedOrBypassedRequests} solved/bypassed, ${security.allowBypassOrSkipRequests} allow/bypass/skip, ${security.otherActionRequests} other across ${security.requestsWithSecurityActions} requests. Counts can overlap.\n`
              );
            }
          }
          for (const responseComparison of [
            analysis.searchCrawlerPathComparison,
            analysis.trainingCrawlerPathComparison,
          ]) {
            if (responseComparison.crawlersCompared.length < 2) continue;
            const groupName =
              responseComparison.activity === 'search-crawl' ? 'Search' : 'Training-data';
            process.stdout.write(
              `  ${groupName} crawler path response differences: ${responseComparison.pathsWithDifferentResponseClasses}/${responseComparison.sharedPathsCompared} shared paths differ by class; ` +
                `${responseComparison.pathsWithDifferentStatusCodeSets} differ by reported HTTP codes; ${responseComparison.pathsWithSuccessFailureSplit} show a 2xx versus 4xx/5xx split${responseComparison.inputPathsTruncated ? ' (some path lists truncated)' : ''}.\n`
            );
            for (const item of responseComparison.disparities.slice(0, 5)) {
              const tokens = item.crawlers
                .map(
                  ({
                    crawlerToken,
                    successfulResponses,
                    clientErrors,
                    serverErrors,
                    statusCodes,
                    responseContentTypes,
                  }) =>
                    `${crawlerToken} ${successfulResponses}×2xx/${clientErrors + serverErrors}×4xx–5xx [${statusCodes.map(({ status, requests }) => `${status === 0 ? '000' : status}×${requests}`).join(', ')}; ${responseContentTypes.map(({ contentType, requests }) => `${contentType}×${requests}`).join(', ') || 'media type unknown'}]`
                )
                .join('; ');
              process.stdout.write(
                `    ${item.path}${item.hasSuccessFailureSplit ? ' [2xx/4xx–5xx split]' : item.hasDifferentContentTypeSets ? ' [media type difference]' : ''}: ${tokens}\n`
              );
            }
          }
          process.stdout.write(
            `  Parsed ${analysis.parsedRequests}/${analysis.linesRead} request lines (combined ${analysis.parsedCombinedLogLines}, CloudFront ${analysis.parsedCloudFrontLogLines}, JSON ${analysis.parsedJsonLines}); ${analysis.skippedLines} skipped. User-Agent claims are unverified.\n`
          );
          const periodComparison = logPeriodComparisons?.[index];
          if (periodComparison) {
            process.stdout.write(
              `  Crawler-log period comparison (${periodComparison.crawlers.length} tokens; baseline ${periodComparison.crawlers[0]?.baselineSample.sourceFile ?? 'saved report'} → current ${analysis.sourceFile ?? 'input'}):\n`
            );
            const notable = periodComparison.crawlers.filter(
              (crawler) =>
                crawler.requestDelta !== 0 ||
                crawler.failureRateDeltaPercentagePoints !== 0 ||
                crawler.sharedPathsWithNewFailures > 0 ||
                crawler.sharedPathsWithResolvedFailures > 0 ||
                crawler.pathsOnlyInCurrentRetainedList > 0 ||
                crawler.pathsOnlyInBaselineRetainedList > 0 ||
                crawler.baselineCloudflareVerifiedBotRequests !==
                  crawler.currentCloudflareVerifiedBotRequests ||
                crawler.baselineCloudflareSecurityActionRequests !==
                  crawler.currentCloudflareSecurityActionRequests ||
                crawler.baselineCloudflareBlockingRequests !==
                  crawler.currentCloudflareBlockingRequests ||
                crawler.baselineCloudflareChallengeRequests !==
                  crawler.currentCloudflareChallengeRequests ||
                crawler.cloudFrontResults.resultTypes.some(
                  ({ shareDeltaPercentagePoints }) =>
                    shareDeltaPercentagePoints !== null && shareDeltaPercentagePoints !== 0
                ) ||
                crawler.cloudFrontResults.responseResultTypes.some(
                  ({ shareDeltaPercentagePoints }) =>
                    shareDeltaPercentagePoints !== null && shareDeltaPercentagePoints !== 0
                ) ||
                (crawler.cloudFrontResults.differenceShareDeltaPercentagePoints !== null &&
                  crawler.cloudFrontResults.differenceShareDeltaPercentagePoints !== 0) ||
                crawler.timing.responseDuration.change === 'slower' ||
                crawler.timing.responseDuration.change === 'faster' ||
                crawler.timing.timeToFirstByte.change === 'slower' ||
                crawler.timing.timeToFirstByte.change === 'faster'
            );
            for (const crawler of (notable.length > 0 ? notable : periodComparison.crawlers).slice(
              0,
              10
            )) {
              const failureDelta =
                crawler.failureRateDeltaPercentagePoints > 0
                  ? `+${crawler.failureRateDeltaPercentagePoints}`
                  : `${crawler.failureRateDeltaPercentagePoints}`;
              const formatTimingDelta = (metric: typeof crawler.timing.responseDuration): string =>
                metric.change === 'not-comparable'
                  ? `not comparable (${metric.baselineSamples ?? '?'} → ${metric.currentSamples ?? '?'} samples)`
                  : `${metric.baselineP95Band} → ${metric.currentP95Band} (${metric.change}; ${metric.baselineSamples} → ${metric.currentSamples} samples)`;
              const cloudflareCoverage =
                crawler.baselineCloudflareVerifiedBotRequests === null &&
                crawler.currentCloudflareVerifiedBotRequests === null &&
                crawler.baselineCloudflareSecurityActionRequests === null &&
                crawler.currentCloudflareSecurityActionRequests === null
                  ? ''
                  : `; Cloudflare verified ${crawler.baselineCloudflareVerifiedBotRequests ?? '?'} → ${crawler.currentCloudflareVerifiedBotRequests ?? '?'}, actions ${crawler.baselineCloudflareSecurityActionRequests ?? '?'} → ${crawler.currentCloudflareSecurityActionRequests ?? '?'}, blocks ${crawler.baselineCloudflareBlockingRequests ?? '?'} → ${crawler.currentCloudflareBlockingRequests ?? '?'}, challenges ${crawler.baselineCloudflareChallengeRequests ?? '?'} → ${crawler.currentCloudflareChallengeRequests ?? '?'}`;
              const changedEdgeResults = crawler.cloudFrontResults.resultTypes
                .concat(crawler.cloudFrontResults.responseResultTypes)
                .filter(
                  ({ shareDeltaPercentagePoints }) =>
                    shareDeltaPercentagePoints !== null && shareDeltaPercentagePoints !== 0
                )
                .map(
                  ({ resultType, shareDeltaPercentagePoints }) =>
                    `${resultType} ${shareDeltaPercentagePoints! > 0 ? '+' : ''}${shareDeltaPercentagePoints} pp`
                );
              const cloudFrontCoverage = crawler.cloudFrontResults.comparisonAvailable
                ? `; CloudFront result-share changes ${changedEdgeResults.join(', ') || 'none'}; paired differing classifications ${crawler.cloudFrontResults.baselineDifferenceSharePercent ?? '?'}% → ${crawler.cloudFrontResults.currentDifferenceSharePercent ?? '?'}%`
                : '; CloudFront result distribution not comparable';
              process.stdout.write(
                `    ${crawler.token}: ${crawler.baselineRequests} → ${crawler.currentRequests} requests (${crawler.requestDelta > 0 ? '+' : ''}${crawler.requestDelta}); failure rate ${crawler.baselineFailureRatePercent}% → ${crawler.currentFailureRatePercent}% (${failureDelta} pp); ` +
                  `${crawler.sharedPathsWithNewFailures} shared paths gained failures, ${crawler.sharedPathsWithResolvedFailures} cleared; ${crawler.pathsOnlyInCurrentRetainedList} current-only and ${crawler.pathsOnlyInBaselineRetainedList} baseline-only retained paths${crawler.inputPathsTruncated ? '; path comparison capped' : ''}; response-duration p95 ${formatTimingDelta(crawler.timing.responseDuration)}; TTFB p95 ${formatTimingDelta(crawler.timing.timeToFirstByte)}${cloudflareCoverage}${cloudFrontCoverage}.\n`
              );
              for (const change of crawler.pathChanges
                .filter(
                  ({ change: kind }) => kind === 'failure-emerged' || kind === 'failure-cleared'
                )
                .slice(0, 2)) {
                process.stdout.write(
                  `      ${change.change}: ${change.path} (${change.baseline?.failureRatePercent ?? 0}% → ${change.current?.failureRatePercent ?? 0}% failure share)\n`
                );
              }
            }
            const referralRateIncreased = (
              item: (typeof periodComparison.aiReferralSources)[number]
            ): boolean => {
              if (
                !item.comparisonAvailable ||
                item.baselineRequests === null ||
                item.currentRequests === null ||
                item.baselineFailureRequests === null ||
                item.currentFailureRequests === null ||
                item.currentRequests === 0
              )
                return false;
              if (item.baselineRequests === 0) return item.currentFailureRequests > 0;
              return (
                item.currentFailureRequests * item.baselineRequests >
                item.baselineFailureRequests * item.currentRequests
              );
            };
            for (const source of periodComparison.aiReferralSources
              .filter(
                (item) =>
                  !item.comparisonAvailable ||
                  item.requestDelta !== 0 ||
                  item.failureRateDeltaPercentagePoints !== 0 ||
                  referralRateIncreased(item) ||
                  item.pathsWithNewFailures > 0 ||
                  item.pathsWithResolvedFailures > 0
              )
              .slice(0, 10)) {
              const baselineCount =
                source.baselineRequests === null ? 'unknown' : String(source.baselineRequests);
              const currentCount =
                source.currentRequests === null ? 'unknown' : String(source.currentRequests);
              const delta =
                source.requestDelta === null
                  ? 'not comparable'
                  : `${source.requestDelta > 0 ? '+' : ''}${source.requestDelta}`;
              const failureRates =
                source.baselineFailureRatePercent === null ||
                source.currentFailureRatePercent === null
                  ? 'failure rate not comparable'
                  : `failure rate ${source.baselineFailureRatePercent}% (${source.baselineFailureRequests ?? '?'} failures) → ${source.currentFailureRatePercent}% (${source.currentFailureRequests ?? '?'} failures) (${source.failureRateDeltaPercentagePoints === null || source.failureRateDeltaPercentagePoints <= 0 ? '' : '+'}${source.failureRateDeltaPercentagePoints} pp)`;
              process.stdout.write(
                `    AI referral ${source.source}: ${baselineCount} → ${currentCount} tagged requests (${delta}); ${failureRates}; ${source.pathsWithNewFailures} retained paths gained failures, ${source.pathsWithResolvedFailures} cleared${source.currentPathsTruncated ? '; path list capped' : ''}.\n`
              );
            }
            const utmCoverage = periodComparison.utmSourceAttributionCoverage;
            if (utmCoverage) {
              const countPair = (field: keyof NonNullable<typeof utmCoverage.baseline>): string =>
                `${utmCoverage.baseline?.[field] ?? '?'} → ${utmCoverage.current?.[field] ?? '?'}`;
              const markerShare = (coverage: typeof utmCoverage.baseline): string =>
                coverage === null
                  ? '?'
                  : coverage.parsedRequestRows > 0
                    ? `${((coverage.requestsWithUtmSource / coverage.parsedRequestRows) * 100).toFixed(1)}%`
                    : '—';
              process.stdout.write(
                `    UTM marker coverage baseline → current: ${countPair('requestsWithUtmSource')} markers (${markerShare(utmCoverage.baseline)} → ${markerShare(utmCoverage.current)} parsed-request share), ${countPair('requestsWithConfiguredSource')} configured, ${countPair('requestsWithUnconfiguredSingleValue')} unconfigured, ${countPair('requestsWithConflictingValues')} conflicting, ${countPair('requestsWithEmptyOrOversizedValue')} empty/oversized${utmCoverage.comparisonAvailable ? '' : '; one report version lacks coverage data'}.\n`
              );
            }
            process.stdout.write(`    ${periodComparison.note}\n`);
          }
          const correlation = correlations?.[index];
          if (correlation) {
            process.stdout.write(
              `  Audit path match: ${correlation.logPathsMatchedToAudit} path rows, ${correlation.requestsMatchedToAuditedPaths} requests matched at ${correlation.origin}; ` +
                `${correlation.requestsOnCurrentlyRobotsBlockedPaths} requests currently blocked, ${correlation.requestsOnAuditedPathsWithClientErrors} client errors, ${correlation.requestsOnAuditedPathsWithServerErrors} server errors, ` +
                `${correlation.requestsOnAuditedPathsWithQuestionHeadings} requests on paths with measured question headings, ${correlation.requestsOnAuditedPathsWithConciseAnswerBlocks} with concise answer blocks, ` +
                `${correlation.requestsOnAuditedPathsWithExternalSourceLinks} with external source links, ${correlation.requestsOnAuditedPathsWithInlineCitationMarkers} with citation markers, ${correlation.logPathsAmbiguousInAudit} ambiguous paths. Audit time ${correlation.auditTimestamp}.\n`
            );
            if (correlation.priorityReviewQueue.length > 0) {
              process.stdout.write(
                '    GEO review queue: ' +
                  correlation.priorityReviewQueue.length +
                  ' measured-signal path rows, ranked by request share within crawler token samples' +
                  (correlation.priorityReviewQueueTruncated ? '; coverage capped' : '') +
                  '.\n'
              );
              for (const item of correlation.priorityReviewQueue.slice(0, 5)) {
                process.stdout.write(
                  '      ' +
                    item.crawlerToken +
                    ' ' +
                    item.path +
                    ': ' +
                    item.requests +
                    ' requests (' +
                    item.crawlerRequestSharePercent +
                    '% of ' +
                    item.crawlerRequests +
                    '); review ' +
                    item.reviewSignals.map((signal) => signal.replace(/-/g, ' ')).join(', ') +
                    '.\n'
                );
              }
            }
            for (const coverage of correlation.auditPathCoverage.crawlers
              .filter(
                ({
                  pathsObserved,
                  pathsNotObservedInLog,
                  pathsAmbiguous,
                  pathsUnassessableBecauseTruncated,
                }) =>
                  pathsObserved ||
                  pathsNotObservedInLog ||
                  pathsAmbiguous ||
                  pathsUnassessableBecauseTruncated
              )
              .slice(0, 10)) {
              process.stdout.write(
                `    ${coverage.crawlerToken} audited paths relative to ${coverage.latestRequestAt ?? 'unknown latest event'}: ${coverage.pathsObserved} observed (${coverage.observedPathsWithin7DaysOfLatestRequest} within 7 days, ${coverage.observedPaths8To30DaysBeforeLatestRequest} 8–30 days back, ${coverage.observedPathsOver30DaysBeforeLatestRequest} over 30 days back, ${coverage.observedPathsWithoutTimestamp} without timestamps), ${coverage.pathsNotObservedInLog} not observed in log, ${coverage.pathsAmbiguous} ambiguous, ${coverage.pathsUnassessableBecauseTruncated} unassessable.\n`
              );
            }
            for (const referral of correlation.aiReferralAuditCoverage.sources
              .filter(({ requestsInSample }) => requestsInSample > 0)
              .slice(0, 10)) {
              process.stdout.write(
                `    AI referral ${referral.source}: ${referral.requestsInSample} total tagged requests; retained paths matched ${referral.retainedPathsMatchedToAudit}/${referral.retainedPathsCompared}, ${referral.retainedPathsAmbiguousInAudit} ambiguous, ${referral.retainedPathsNotInAudit} not in audit; ${referral.retainedRequestsMatchedToAudit}/${referral.retainedRequestsCompared} retained requests mapped to audited paths${referral.pathsTruncated ? '; path details capped' : ''}.\n`
              );
              process.stdout.write(
                `      Same-path crawler sample: search ${referral.retainedPathsWithSearchCrawlerRequests} referral paths / ${referral.searchCrawlerRequestsOnRetainedPaths} crawler requests / ${referral.searchCrawlerFailuresOnRetainedPaths} failures (${referral.retainedPathsWithIncompleteSearchCrawlerCoverage} incomplete paths); training ${referral.retainedPathsWithTrainingCrawlerRequests} paths / ${referral.trainingCrawlerRequestsOnRetainedPaths} requests / ${referral.trainingCrawlerFailuresOnRetainedPaths} failures (${referral.retainedPathsWithIncompleteTrainingCrawlerCoverage} incomplete paths).\n`
              );
            }
            for (const item of correlation.pathObservations
              .filter(({ currentRobotsAccess }) => currentRobotsAccess === 'blocked')
              .slice(0, 5)) {
              process.stdout.write(
                `    ${item.crawlerToken} ${item.path}: ${item.requests} requests; current robots rule ${item.currentRobotsRule?.directive ?? 'blocked'} ${item.currentRobotsRule?.pattern ?? ''}\n`
              );
            }
          }
          const sitemapFreshness = sitemapFreshnessAnalyses?.[index];
          if (sitemapFreshness) {
            process.stdout.write(
              `  Sitemap lastmod comparison (${sitemapFreshness.sitemapUrlsProvided} URLs): ${sitemapFreshness.sitemapUrlsSkippedAsAmbiguous} ambiguous, ${sitemapFreshness.pagesWithValidLastmod} valid dates, ${sitemapFreshness.duplicateSitemapEntries} duplicate entries${sitemapFreshness.sitemapUrlsTruncated ? ', URL limit reached' : ''}${sitemapFreshness.sitemapEntriesTruncated ? ', entry detail capped' : ''}.\n`
            );
            for (const crawler of sitemapFreshness.crawlers
              .filter(
                ({ pagesWithUpdateAfterLastObservedRequest, pagesNotObservedInLog }) =>
                  pagesWithUpdateAfterLastObservedRequest || pagesNotObservedInLog
              )
              .slice(0, 12)) {
              process.stdout.write(
                `    ${crawler.provider} ${crawler.crawlerToken}: ${crawler.pagesWithUpdateAfterLastObservedRequest} sitemap dates are later than the last retained request (${crawler.requestsOnPagesWithUpdateAfterLastObservedRequest} requests on those paths); ${crawler.pagesNotObservedInLog} valid-lastmod URLs not observed in this sample${crawler.logPathsTruncated ? ' (log paths capped)' : ''}.\n`
              );
            }
            const schemaDateComparison = sitemapFreshness.schemaDateComparison;
            if (schemaDateComparison) {
              process.stdout.write(
                `    Sitemap vs audited JSON-LD dateModified: ${schemaDateComparison.pagesWithMatchingSchemaDateModified} match, ${schemaDateComparison.pagesWithDifferentSchemaDateModified} differ, ${schemaDateComparison.pagesWithMultipleSchemaDateModified} multiple values, ${schemaDateComparison.pagesWithoutSchemaDateModified} missing valid values, ${schemaDateComparison.auditPathsNotFound} not audited, ${schemaDateComparison.auditPathsAmbiguous} ambiguous.\n`
              );
              for (const item of schemaDateComparison.opportunities.slice(0, 5)) {
                process.stdout.write(
                  `      ${item.path}: sitemap ${item.sitemapLastModified}, schema ${item.schemaDateModifiedDays.join(', ') || item.reason.replace(/-/g, ' ')}.\n`
                );
              }
            }
          }
          const robotsReplay = robotsPolicyCorrelations?.[index];
          if (robotsReplay) {
            const blockedRequests = robotsReplay.crawlers.reduce(
              (sum, crawler) => sum + crawler.blockedRequests,
              0
            );
            const allowedRequests = robotsReplay.crawlers.reduce(
              (sum, crawler) => sum + crawler.allowedRequests,
              0
            );
            process.stdout.write(
              `  Saved robots.txt replay (${robotsReplay.origin}): ${blockedRequests} retained-path requests blocked, ${allowedRequests} allowed under current rules; snapshot SHA-256 ${robotsReplay.robotsSha256}.\n`
            );
            for (const item of robotsReplay.pathObservations
              .filter(({ policyDecision }) => policyDecision === 'blocked')
              .slice(0, 5)) {
              process.stdout.write(
                `    ${item.crawlerToken} ${item.path}: ${item.requests} logged requests; current rule ${item.matchedRule?.directive ?? 'blocked'} ${item.matchedRule?.pattern ?? ''}\n`
              );
            }
          }
          const robotsComparison = robotsPolicyComparisons?.[index];
          if (robotsComparison) {
            process.stdout.write(
              `  robots.txt snapshot changes: ${robotsComparison.pathsNewlyBlocked} newly blocked, ${robotsComparison.pathsNewlyAllowed} newly allowed, ${robotsComparison.pathsWithRuleChanges} rule changes across ${robotsComparison.pathsCompared} comparable paths; ${robotsComparison.requestsNewlyBlocked} logged requests moved to blocked paths. ${robotsComparison.pathsMissingFromBaseline} current rows lack a baseline; ${robotsComparison.pathsMissingFromCurrent} baseline rows are absent from current detail.\n`
            );
            for (const item of robotsComparison.pathChanges
              .filter(({ change }) => change === 'newly-blocked' || change === 'newly-allowed')
              .slice(0, 5)) {
              process.stdout.write(
                `    ${item.crawlerToken} ${item.path}: ${item.change} (${item.requests} logged requests).\n`
              );
            }
          }
        }
        if (args.output) process.stdout.write(`Structured report saved to ${args.output}\n`);
        if (args.html)
          process.stdout.write(`Offline crawler log HTML report saved to ${args.html}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not analyze AI crawler access logs: ${message}\n`);
      process.exit(2);
    }
    return;
  }
  if (args.geoRobotsTxt && args.geoRobotsOrigin && (args.geoAuditJson || args.geoRobotsSitemap)) {
    const allowedOptions = new Set([
      'geoAuditJson',
      'geoRobotsSitemap',
      'geoSitemapMaxUrls',
      'geoRobotsTxt',
      'geoRobotsBaselineTxt',
      'geoRobotsOrigin',
      'geoRobotsTokens',
      'failOnNewlyBlockedGeoAuditPages',
      'failOnNewlyBlockedGeoTargets',
      'json',
      'output',
      'html',
      'pdf',
    ]);
    const incompatibleOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ GEO robots target replay can only be combined with --geo-audit-json or --geo-robots-sitemap, robots snapshot options, --geo-sitemap-max-urls, --json, --output, --html, and --pdf.\n'
      );
      process.exit(2);
    }
    if (args.geoAuditJson && args.geoRobotsSitemap) {
      process.stderr.write(
        '❌ Choose either --geo-audit-json or --geo-robots-sitemap as the robots replay URL source.\n'
      );
      process.exit(2);
    }
    if (args.failOnNewlyBlockedGeoAuditPages && args.geoRobotsSitemap) {
      process.stderr.write(
        '❌ --fail-on-newly-blocked-geo-audit-pages is for saved-audit replay; use --fail-on-newly-blocked-geo-targets for sitemap targets.\n'
      );
      process.exit(2);
    }
    if (
      (args.failOnNewlyBlockedGeoAuditPages || args.failOnNewlyBlockedGeoTargets) &&
      !args.geoRobotsBaselineTxt
    ) {
      process.stderr.write(
        '❌ A newly-blocked GEO robots gate requires --geo-robots-baseline-txt.\n'
      );
      process.exit(2);
    }
    try {
      let targetUrls: string[];
      let auditTimestamp: string | undefined;
      let auditPagesUnavailable = 0;
      let targetsMayBeTruncated = false;
      let sourceSitemapUrl: string | undefined;
      if (args.geoRobotsSitemap) {
        let sitemapLocation: URL;
        let robotsOrigin: URL;
        try {
          sitemapLocation = new URL(args.geoRobotsSitemap);
          robotsOrigin = new URL(args.geoRobotsOrigin);
        } catch {
          throw new Error(
            '--geo-robots-sitemap and --geo-robots-origin must be valid absolute URLs.'
          );
        }
        if (
          !['http:', 'https:'].includes(sitemapLocation.protocol) ||
          sitemapLocation.username ||
          sitemapLocation.password ||
          !['http:', 'https:'].includes(robotsOrigin.protocol) ||
          robotsOrigin.username ||
          robotsOrigin.password ||
          robotsOrigin.pathname !== '/' ||
          robotsOrigin.search ||
          robotsOrigin.hash ||
          sitemapLocation.origin !== robotsOrigin.origin
        ) {
          throw new Error(
            '--geo-robots-sitemap must be credential-free and share the origin in --geo-robots-origin.'
          );
        }
        sitemapLocation.search = '';
        sitemapLocation.hash = '';
        sourceSitemapUrl = sitemapLocation.href;
        const maxUrls = args.geoSitemapMaxUrls ?? 1_000;
        targetUrls = await discoverSitemapUrls(args.geoRobotsSitemap, { maxUrls });
        targetsMayBeTruncated = targetUrls.length >= maxUrls;
      } else {
        if (!args.geoAuditJson)
          throw new Error(
            'Provide --geo-audit-json or --geo-robots-sitemap as the target URL source.'
          );
        const auditStats = fs.statSync(args.geoAuditJson);
        if (!auditStats.isFile())
          throw new Error(`${args.geoAuditJson} is not a regular audit JSON file.`);
        if (auditStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoAuditJson} exceeds the 100 MiB input limit.`);
        const auditRaw: unknown = JSON.parse(fs.readFileSync(args.geoAuditJson, 'utf8'));
        const audit = extractGeoAuditUrls(auditRaw);
        targetUrls = audit.urls;
        auditTimestamp = audit.auditTimestamp;
        auditPagesUnavailable = audit.unavailablePages;
      }
      const robotsStats = fs.statSync(args.geoRobotsTxt);
      if (!robotsStats.isFile())
        throw new Error(`${args.geoRobotsTxt} is not a regular robots.txt file.`);
      if (robotsStats.size > 1024 * 1024)
        throw new Error(`${args.geoRobotsTxt} exceeds the 1 MiB robots.txt snapshot limit.`);
      let robotsSource: string;
      try {
        robotsSource = new TextDecoder('utf-8', { fatal: true }).decode(
          fs.readFileSync(args.geoRobotsTxt)
        );
      } catch {
        throw new Error(`${args.geoRobotsTxt} is not valid UTF-8 text.`);
      }
      const targetOptions = {
        targetSource: args.geoRobotsSitemap ? ('sitemap' as const) : ('saved-audit' as const),
        ...(args.geoAuditJson ? { sourceFile: args.geoAuditJson } : {}),
        ...(sourceSitemapUrl ? { sitemapUrl: sourceSitemapUrl } : {}),
        ...(auditTimestamp ? { auditTimestamp } : {}),
        auditPagesUnavailable,
        targetsMayBeTruncated,
        ...(args.geoRobotsTokens ? { customTokens: args.geoRobotsTokens } : {}),
      };
      const replay = analyzeAiCrawlerRobotsAuditReplay(
        targetUrls,
        robotsSource,
        args.geoRobotsOrigin,
        {
          ...targetOptions,
          robotsFile: args.geoRobotsTxt,
          robotsModifiedAt: robotsStats.mtime.toISOString(),
        }
      );
      let comparison: ReturnType<typeof compareAiCrawlerRobotsAuditReplays> | undefined;
      if (args.geoRobotsBaselineTxt) {
        const baselineStats = fs.statSync(args.geoRobotsBaselineTxt);
        if (!baselineStats.isFile())
          throw new Error(`${args.geoRobotsBaselineTxt} is not a regular robots.txt file.`);
        if (baselineStats.size > 1024 * 1024)
          throw new Error(
            `${args.geoRobotsBaselineTxt} exceeds the 1 MiB robots.txt snapshot limit.`
          );
        let baselineSource: string;
        try {
          baselineSource = new TextDecoder('utf-8', { fatal: true }).decode(
            fs.readFileSync(args.geoRobotsBaselineTxt)
          );
        } catch {
          throw new Error(`${args.geoRobotsBaselineTxt} is not valid UTF-8 text.`);
        }
        const baselineReplay = analyzeAiCrawlerRobotsAuditReplay(
          targetUrls,
          baselineSource,
          args.geoRobotsOrigin,
          {
            ...targetOptions,
            robotsFile: args.geoRobotsBaselineTxt,
            robotsModifiedAt: baselineStats.mtime.toISOString(),
          }
        );
        comparison = compareAiCrawlerRobotsAuditReplays(baselineReplay, replay);
      }
      const inputFiles = [
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
        args.geoRobotsTxt,
        ...(args.geoRobotsBaselineTxt ? [args.geoRobotsBaselineTxt] : []),
      ];
      const outputFiles = [args.output, args.html, args.pdf].filter((file): file is string =>
        Boolean(file)
      );
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        ) ||
        (args.output && args.html && pathsReferToSameFile(args.output, args.html))
      ) {
        throw new Error(
          'JSON, HTML, and PDF output paths must differ from all input files and from each other.'
        );
      }
      const report = { ...replay, ...(comparison ? { comparison } : {}) };
      if (
        (args.failOnNewlyBlockedGeoAuditPages || args.failOnNewlyBlockedGeoTargets) &&
        comparison
      ) {
        const incomplete =
          replay.rowsTruncated ||
          replay.pagesSkipped > 0 ||
          replay.auditPagesUnavailable > 0 ||
          replay.targetsMayBeTruncated === true ||
          comparison.changesTruncated ||
          comparison.urlTokenPairsNotComparable > 0 ||
          comparison.urlTokenPairsMissingFromBaseline > 0 ||
          comparison.urlTokenPairsMissingFromCurrent > 0;
        if (comparison.urlTokenPairsNewlyBlocked > 0 || incomplete) {
          process.stderr.write(
            `❌ GEO robots release gate failed: ${comparison.urlTokenPairsNewlyBlocked} URL/token pair(s) became blocked${incomplete ? '; target coverage or comparison detail is incomplete' : ''}.\n`
          );
          process.exitCode = 1;
        }
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
      }
      if (args.html) {
        fs.mkdirSync(path.dirname(args.html), { recursive: true });
        fs.writeFileSync(
          args.html,
          renderAiCrawlerRobotsAuditReplayHtml(replay, comparison),
          'utf8'
        );
      }
      if (args.pdf) {
        fs.mkdirSync(path.dirname(args.pdf), { recursive: true });
        await generatePdfFromHtml(
          renderAiCrawlerRobotsAuditReplayHtml(replay, comparison),
          args.pdf
        );
      }
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (args.output) process.stderr.write(`GEO robots audit replay saved to ${args.output}\n`);
        if (args.html) process.stderr.write(`Offline GEO robots report saved to ${args.html}\n`);
        if (args.pdf) process.stderr.write(`GEO robots PDF report saved to ${args.pdf}\n`);
      } else {
        const sourceLabel =
          replay.targetSource === 'sitemap' ? 'sitemap targets' : 'saved-audit URLs';
        process.stdout.write(
          `GEO robots replay at ${replay.origin}: ${replay.pagesOnOrigin}/${replay.uniqueTargetUrls ?? replay.uniqueAuditUrls} unique ${sourceLabel} evaluated; ${replay.pagesSkipped} skipped${replay.targetSource === 'sitemap' ? (replay.targetsMayBeTruncated ? ' (sitemap URL cap reached)' : '') : `, ${replay.auditPagesUnavailable} source-audit failures`}.\n`
        );
        if (comparison) {
          process.stdout.write(
            `  Snapshot change: ${comparison.urlTokenPairsNewlyBlocked} URL/token pairs newly blocked, ${comparison.urlTokenPairsNewlyAllowed} newly allowed, ${comparison.urlTokenPairsWithRuleChanges} rule changes across ${comparison.urlTokenPairsCompared} comparable pairs.\n`
          );
          for (const item of comparison.changes
            .filter(({ change }) => change === 'newly-blocked' || change === 'newly-allowed')
            .slice(0, 5)) {
            process.stdout.write(
              `    ${item.crawlerToken} ${item.url}${item.queryStringEvaluated ? ' [query values omitted]' : ''}: ${item.change}.\n`
            );
          }
        }
        for (const crawler of replay.crawlerPolicies) {
          process.stdout.write(
            `  ${crawler.provider} ${crawler.token}${crawler.customToken ? ' [custom]' : ''}: ${crawler.pagesAllowed} allowed, ${crawler.pagesBlocked} blocked.\n`
          );
          for (const url of crawler.blockedUrls.slice(0, 3))
            process.stdout.write(`    blocked by current snapshot: ${url}\n`);
        }
        if (args.output)
          process.stdout.write(`Structured GEO robots report saved to ${args.output}\n`);
        if (args.html) process.stdout.write(`Offline GEO robots HTML saved to ${args.html}\n`);
        if (args.pdf) process.stdout.write(`GEO robots PDF saved to ${args.pdf}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not replay GEO robots policy for the targets: ${message}\n`);
      process.exit(2);
    }
    return;
  }
  if (args.geoCrawlerTokens?.length) {
    process.stderr.write('❌ --geo-crawler-token requires at least one --geo-crawler-log input.\n');
    process.exit(2);
  }
  if (args.geoAiReferralSources?.length) {
    process.stderr.write(
      '❌ --geo-ai-referral-source requires at least one --geo-crawler-log input.\n'
    );
    process.exit(2);
  }
  if (args.geoCrawlerBaselineJson) {
    process.stderr.write(
      '❌ --geo-crawler-baseline-json requires at least one current --geo-crawler-log input.\n'
    );
    process.exit(2);
  }
  if (args.failOnNewGeoCrawlerFailures) {
    process.stderr.write(
      '❌ --fail-on-new-geo-crawler-failures requires current crawler logs and --geo-crawler-baseline-json.\n'
    );
    process.exit(2);
  }
  if (args.failOnNewAiReferralFailures) {
    process.stderr.write(
      '❌ --fail-on-new-ai-referral-failures requires current crawler logs and --geo-crawler-baseline-json.\n'
    );
    process.exit(2);
  }
  if (args.failOnAiCrawlerTimingRegression) {
    process.stderr.write(
      '❌ --fail-on-ai-crawler-timing-regression requires current crawler logs and --geo-crawler-baseline-json.\n'
    );
    process.exit(2);
  }
  if (args.failOnGeoCrawlerPathFamilyFailureRise !== undefined) {
    process.stderr.write(
      '❌ --fail-on-geo-crawler-path-family-failure-rise requires current crawler logs and --geo-crawler-baseline-json.\n'
    );
    process.exit(2);
  }
  if (args.failOnAiCrawlerCloudFrontResultRegression) {
    process.stderr.write(
      '❌ --fail-on-ai-crawler-cloudfront-result-regression requires current crawler logs and --geo-crawler-baseline-json.\n'
    );
    process.exit(2);
  }
  if (args.geoRobotsTxt || args.geoRobotsBaselineTxt || args.geoRobotsOrigin) {
    process.stderr.write(
      '❌ Robots snapshots require --geo-crawler-log or a saved-audit/sitemap replay; --geo-robots-txt and --geo-robots-origin must be supplied together, and --geo-robots-baseline-txt requires --geo-robots-txt.\n'
    );
    process.exit(2);
  }
  if (args.geoRobotsSitemap && args.geoAuditJson) {
    process.stderr.write(
      '❌ Choose either --geo-robots-sitemap or --geo-audit-json as the URL source for robots replay.\n'
    );
    process.exit(2);
  }
  if (args.geoRobotsSitemap && (!args.geoRobotsTxt || !args.geoRobotsOrigin)) {
    process.stderr.write(
      '❌ --geo-robots-sitemap requires --geo-robots-txt and --geo-robots-origin.\n'
    );
    process.exit(2);
  }
  if (args.geoRobotsTokens?.length) {
    process.stderr.write(
      '❌ --geo-robots-token requires --geo-robots-txt and --geo-robots-origin plus either --geo-audit-json or --geo-robots-sitemap.\n'
    );
    process.exit(2);
  }
  if (args.failOnNewlyBlockedGeoPaths) {
    process.stderr.write(
      '❌ --fail-on-newly-blocked-geo-paths requires crawler logs and baseline/current robots snapshots.\n'
    );
    process.exit(2);
  }
  if (args.failOnNewlyBlockedGeoAuditPages) {
    process.stderr.write(
      '❌ --fail-on-newly-blocked-geo-audit-pages requires a saved-audit robots comparison.\n'
    );
    process.exit(2);
  }
  if (args.failOnNewlyBlockedGeoTargets) {
    process.stderr.write(
      '❌ --fail-on-newly-blocked-geo-targets requires a saved-audit or sitemap robots comparison.\n'
    );
    process.exit(2);
  }
  if (args.geoCrawlerSitemap && !args.geoCrawlerLogs?.length) {
    process.stderr.write(
      '❌ --geo-crawler-sitemap requires at least one --geo-crawler-log input.\n'
    );
    process.exit(2);
  }
  if (args.geoCrawlerSitemapMaxUrls !== undefined && !args.geoCrawlerSitemap) {
    process.stderr.write('❌ --geo-crawler-sitemap-max-urls requires --geo-crawler-sitemap.\n');
    process.exit(2);
  }
  if (args.geoCrawlerOrigin) {
    process.stderr.write(
      '❌ --geo-crawler-origin requires --geo-crawler-log plus --geo-audit-json or --geo-crawler-sitemap.\n'
    );
    process.exit(2);
  }
  if (args.geoAuditJson && !bingAiInputCount && !googleAiInputCount) {
    process.stderr.write(
      '❌ --geo-audit-json requires at least one Bing, Google Search, or Google Discover export.\n'
    );
    process.exit(2);
  }
  if (args.geoSitemapMaxUrls !== undefined && !args.geoSitemap && !args.geoRobotsSitemap) {
    process.stderr.write(
      '❌ --geo-sitemap-max-urls requires --geo-sitemap or --geo-robots-sitemap.\n'
    );
    process.exit(2);
  }
  if (args.geoSitemap && !args.geoPlatformMatrix) {
    process.stderr.write('❌ --geo-sitemap can only be used with --geo-platform-matrix.\n');
    process.exit(2);
  }
  if (args.geoPathDepth !== undefined && !args.geoPlatformMatrix && !args.geoGoogleSurfaceMatrix) {
    process.stderr.write(
      '❌ --geo-path-depth can only be used with --geo-platform-matrix or --geo-google-surface-matrix.\n'
    );
    process.exit(2);
  }
  if (args.geoPlatformBaselineJson && !args.geoPlatformMatrix) {
    process.stderr.write(
      '❌ --geo-platform-baseline-json can only be used with --geo-platform-matrix.\n'
    );
    process.exit(2);
  }
  if (args.geoGoogleSurfaceBaselineJson && !args.geoGoogleSurfaceMatrix) {
    process.stderr.write(
      '❌ --geo-google-surface-baseline-json can only be used with --geo-google-surface-matrix.\n'
    );
    process.exit(2);
  }
  if (args.geoGoogleSurfacePathFamilyCsv && !args.geoGoogleSurfaceMatrix) {
    process.stderr.write(
      '❌ --geo-google-surface-path-family-csv can only be used with --geo-google-surface-matrix.\n'
    );
    process.exit(2);
  }
  if (args.geoGoogleSurfacePathFamilyCsv && args.geoPathDepth === undefined) {
    process.stderr.write('❌ --geo-google-surface-path-family-csv requires --geo-path-depth.\n');
    process.exit(2);
  }
  if (args.geoGoogleSurfaceMatrix && args.geoPlatformMatrix) {
    process.stderr.write(
      '❌ Choose either the Google Search/Discover matrix or the Google/Bing platform matrix.\n'
    );
    process.exit(2);
  }
  if (
    args.geoGoogleSurfaceMatrix &&
    (googleAiSearchInputCount !== 1 || googleAiDiscoverInputCount !== 1)
  ) {
    process.stderr.write(
      '❌ --geo-google-surface-matrix requires exactly one Search export and one Discover export, using CSV or XLSX inputs.\n'
    );
    process.exit(2);
  }
  if (googleAiSearchInputCount && googleAiDiscoverInputCount && !args.geoGoogleSurfaceMatrix) {
    process.stderr.write(
      '❌ Analyze Search and Discover exports separately, or add --geo-google-surface-matrix to join page exports while keeping their measures separate.\n'
    );
    process.exit(2);
  }
  if ((args.googleAiBaselineCsv || args.googleAiBaselineXlsx) && !googleAiInputCount) {
    process.stderr.write(
      '❌ A Google page baseline requires one current Search or Discover CSV/XLSX export.\n'
    );
    process.exit(2);
  }
  if (
    (args.googleAiDimensionBaselineCsv || args.googleAiDimensionBaselineXlsx) &&
    !googleAiInputCount
  ) {
    process.stderr.write(
      '❌ A Google dimension baseline requires one current Search or Discover CSV/XLSX export.\n'
    );
    process.exit(2);
  }
  if (
    (args.googleAiBaselineCsv && args.googleAiBaselineXlsx) ||
    (args.googleAiDimensionBaselineCsv && args.googleAiDimensionBaselineXlsx)
  ) {
    process.stderr.write(
      '❌ Choose only one CSV or XLSX baseline input for each Google comparison type.\n'
    );
    process.exit(2);
  }
  const googlePageBaseline = args.googleAiBaselineCsv ?? args.googleAiBaselineXlsx;
  const googleDimensionBaseline =
    args.googleAiDimensionBaselineCsv ?? args.googleAiDimensionBaselineXlsx;
  if (googlePageBaseline && googleDimensionBaseline) {
    process.stderr.write(
      '❌ Choose either the page-only or exact-dimension Google AI comparison for one export.\n'
    );
    process.exit(2);
  }
  if (
    (args.bingAiBaselineCsv && args.bingAiBaselineXlsx) ||
    (args.bingAiQueryBaselineCsv && args.bingAiQueryBaselineXlsx) ||
    (args.bingAiTopicBaselineCsv && args.bingAiTopicBaselineXlsx)
  ) {
    process.stderr.write(
      '❌ Choose only one CSV or XLSX baseline input for each Bing comparison type.\n'
    );
    process.exit(2);
  }
  const bingPageBaseline = args.bingAiBaselineCsv ?? args.bingAiBaselineXlsx;
  const bingQueryBaseline = args.bingAiQueryBaselineCsv ?? args.bingAiQueryBaselineXlsx;
  const bingTopicBaseline = args.bingAiTopicBaselineCsv ?? args.bingAiTopicBaselineXlsx;
  if (bingPageBaseline && !bingAiInputCount) {
    process.stderr.write('❌ A Bing page baseline requires one current Bing page export.\n');
    process.exit(2);
  }
  if (bingPageBaseline && bingAiInputCount !== 1) {
    process.stderr.write('❌ A Bing page baseline requires exactly one current Bing export.\n');
    process.exit(2);
  }
  if (bingQueryBaseline && bingPageBaseline) {
    process.stderr.write(
      '❌ Choose either the page-citations or query-mapping baseline comparison for one Bing export.\n'
    );
    process.exit(2);
  }
  if (bingQueryBaseline && !bingAiInputCount) {
    process.stderr.write(
      '❌ A Bing query-page baseline requires one current query-page mapping export.\n'
    );
    process.exit(2);
  }
  if (bingQueryBaseline && bingAiInputCount !== 1) {
    process.stderr.write('❌ A Bing query-page baseline requires exactly one current export.\n');
    process.exit(2);
  }
  if (bingTopicBaseline && !bingAiInputCount) {
    process.stderr.write(
      '❌ A Bing topic/intent baseline requires one current export with topic and intent dimensions.\n'
    );
    process.exit(2);
  }
  if (bingTopicBaseline && bingAiInputCount !== 1) {
    process.stderr.write('❌ A Bing topic/intent baseline requires exactly one current export.\n');
    process.exit(2);
  }
  if (args.geoPlatformMatrix) {
    const allowedOptions = new Set([
      'geoPlatformMatrix',
      'geoPlatformBaselineJson',
      'bingAiCsv',
      'bingAiXlsx',
      'googleAiCsv',
      'googleAiXlsx',
      'geoAuditJson',
      'geoSitemap',
      'geoSitemapMaxUrls',
      'geoPathDepth',
      'json',
      'output',
      'html',
      'csv',
    ]);
    const incompatibleOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ --geo-platform-matrix accepts one Google Search CSV/XLSX export, one Bing CSV/XLSX page export, optional --geo-audit-json, --geo-sitemap, --geo-path-depth, --geo-platform-baseline-json, --json, --output, --html, and --csv. It cannot be combined with Discover exports or other baselines.\n'
      );
      process.exit(2);
    }
    if (googleAiSearchInputCount !== 1 || bingAiInputCount !== 1) {
      process.stderr.write(
        '❌ --geo-platform-matrix requires exactly one Google Search CSV/XLSX export and one Bing page export from --bing-ai-csv or --bing-ai-xlsx.\n'
      );
      process.exit(2);
    }
  }
  if (bingAiInputCount && googleAiInputCount && !args.geoPlatformMatrix) {
    process.stderr.write(
      '❌ Analyze Bing and Google Search Console exports in separate runs so their metrics remain distinct.\n'
    );
    process.exit(2);
  }
  if (args.geoPlatformMatrix) {
    try {
      const googleFile = (args.googleAiCsv ?? args.googleAiXlsx ?? [])[0]!;
      const bingFile = (args.bingAiCsv ?? args.bingAiXlsx ?? [])[0];
      if (!bingFile) throw new Error('One Bing page export is required for the platform matrix.');
      const googleExports = await parseGoogleAiInputFile(
        googleFile,
        'search',
        Boolean(args.googleAiXlsx?.length)
      );
      if (googleExports.length !== 1)
        throw new Error(
          '--geo-platform-matrix needs a Google workbook with exactly one recognized data worksheet.'
        );
      const google = googleExports[0]!;
      const bingExports = await parseBingAiInputFile(bingFile, Boolean(args.bingAiXlsx?.length));
      if (bingExports.length !== 1)
        throw new Error(
          '--geo-platform-matrix needs a Bing workbook with exactly one recognized data worksheet.'
        );
      const bing = bingExports[0]!;
      let audit: SEOAuditBatchReport | SEOReport | SiteWideGeoAnalysis | undefined;
      if (args.geoAuditJson) {
        const auditStats = fs.statSync(args.geoAuditJson);
        if (!auditStats.isFile())
          throw new Error(`${args.geoAuditJson} is not a regular audit JSON file.`);
        if (auditStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoAuditJson} exceeds the 100 MiB input limit.`);
        const rawAudit: unknown = JSON.parse(fs.readFileSync(args.geoAuditJson, 'utf8'));
        if (
          !rawAudit ||
          typeof rawAudit !== 'object' ||
          (!('results' in rawAudit && Array.isArray(rawAudit.results)) &&
            !('url' in rawAudit && typeof rawAudit.url === 'string' && 'checks' in rawAudit) &&
            !isSiteWideGeoAnalysis(rawAudit))
        ) {
          throw new Error(
            'Audit JSON must contain one SEO report, an SEO batch report, or a version 1 GEO summary.'
          );
        }
        audit = rawAudit as SEOAuditBatchReport | SEOReport | SiteWideGeoAnalysis;
      }
      const sitemapUrls = args.geoSitemap
        ? await discoverSitemapUrls(args.geoSitemap, { maxUrls: args.geoSitemapMaxUrls ?? 1_000 })
        : undefined;
      const sitemapLimit = args.geoSitemapMaxUrls ?? 1_000;
      const matrix = compareAiPlatformPageObservations(
        google,
        bing,
        audit,
        sitemapUrls && args.geoSitemap
          ? {
              url: args.geoSitemap,
              pageUrls: sitemapUrls,
              resultMayBeTruncated: sitemapUrls.length >= sitemapLimit,
            }
          : undefined,
        args.geoPathDepth === undefined ? undefined : { pathFamilyDepth: args.geoPathDepth }
      );
      let periodComparison: ReturnType<typeof compareAiPlatformPageMatrices> | undefined;
      if (args.geoPlatformBaselineJson) {
        if (
          [googleFile, bingFile, ...(args.geoAuditJson ? [args.geoAuditJson] : [])].some(
            (inputFile) => pathsReferToSameFile(args.geoPlatformBaselineJson!, inputFile)
          )
        )
          throw new Error(
            '--geo-platform-baseline-json must differ from the current CSV exports and audit JSON.'
          );
        const baselineStats = fs.statSync(args.geoPlatformBaselineJson);
        if (!baselineStats.isFile())
          throw new Error(`${args.geoPlatformBaselineJson} is not a regular matrix JSON file.`);
        if (baselineStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoPlatformBaselineJson} exceeds the 100 MiB input limit.`);
        const rawBaseline: unknown = JSON.parse(
          fs.readFileSync(args.geoPlatformBaselineJson, 'utf8')
        );
        if (!isAiPlatformPageMatrix(rawBaseline))
          throw new Error(
            `${args.geoPlatformBaselineJson} is not a supported version 1 GEO platform matrix.`
          );
        periodComparison = compareAiPlatformPageMatrices(matrix, rawBaseline);
      }
      const report = { ...matrix, ...(periodComparison ? { periodComparison } : {}) };
      const inputFiles = [
        googleFile,
        bingFile,
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
        ...(args.geoPlatformBaselineJson ? [args.geoPlatformBaselineJson] : []),
      ];
      const outputFiles = [args.output, args.html, args.csv].filter((file): file is string =>
        Boolean(file)
      );
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        )
      ) {
        throw new Error('JSON, HTML, and CSV output paths must differ from all input files.');
      }
      for (let index = 0; index < outputFiles.length; index += 1) {
        for (const otherOutput of outputFiles.slice(index + 1)) {
          if (pathsReferToSameFile(outputFiles[index]!, otherOutput)) {
            throw new Error('JSON, HTML, and CSV output paths must be different files.');
          }
        }
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, JSON.stringify(report, null, 2));
      }
      if (args.html) {
        fs.mkdirSync(path.dirname(args.html), { recursive: true });
        fs.writeFileSync(
          args.html,
          renderAiPlatformPageMatrixHtml(matrix, periodComparison),
          'utf8'
        );
      }
      if (args.csv) {
        fs.mkdirSync(path.dirname(args.csv), { recursive: true });
        fs.writeFileSync(args.csv, renderAiPlatformPageMatrixCsv(matrix, periodComparison), 'utf8');
      }
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (args.output) process.stderr.write(`Structured report saved to ${args.output}\n`);
        if (args.html) process.stderr.write(`Offline GEO HTML matrix saved to ${args.html}\n`);
        if (args.csv) process.stderr.write(`GEO page matrix CSV saved to ${args.csv}\n`);
      } else {
        process.stdout.write(
          `Cross-platform GEO page matrix (${googleFile} × ${bingFile}): ${matrix.pagesObservedByBoth} URLs observed in both exports; ` +
            `${matrix.pagesOnlyInGoogleExport} only in Google file, ${matrix.pagesOnlyInBingExport} only in Bing file\n`
        );
        process.stdout.write(
          `  Google Search AI: ${matrix.googleSearchAiPages} pages, ${matrix.googleExportRowSummedImpressions} row-summed impressions; ` +
            `Bing AI: ${matrix.bingAiPages} pages` +
            `${matrix.bingExportRowSummedCitations === undefined ? '' : `, ${matrix.bingExportRowSummedCitations} row-summed citations`}\n`
        );
        const comparableShareRows = matrix.pages.filter(
          ({ googleImpressionSharePercent, bingCitationSharePercent }) =>
            googleImpressionSharePercent !== undefined && bingCitationSharePercent !== undefined
        );
        const shareGapAtLeastFive = comparableShareRows.filter(
          ({ platformShareGapPercentagePoints }) =>
            Math.abs(platformShareGapPercentagePoints ?? 0) >= 5
        ).length;
        const shareGapAtLeastFifteen = comparableShareRows.filter(
          ({ platformShareGapPercentagePoints }) =>
            Math.abs(platformShareGapPercentagePoints ?? 0) >= 15
        ).length;
        process.stdout.write(
          `  Within-export shares: ${comparableShareRows.length} returned URLs with both values; ${shareGapAtLeastFive} have a gap ≥5 pp and ${shareGapAtLeastFifteen} ≥15 pp. This compares distributions of distinct measures.\n`
        );
        if (matrix.sitemapCoverage) {
          process.stdout.write(
            `  Supplied sitemap URL groups: ${matrix.sitemapCoverage.pagesFoundInSuppliedSitemapList} found, ${matrix.sitemapCoverage.pagesNotFoundInSuppliedSitemapList} not found in this supplied list` +
              `, ${matrix.sitemapCoverage.pagesWithPossibleAliasMatchFromTruncatedSourceLists} possible alias matches` +
              `${matrix.sitemapCoverage.sitemapResultMayBeTruncated ? ' (URL cap reached; list may be incomplete)' : ''}\n`
          );
        }
        if (matrix.pathFamilies && matrix.pathFamilyDepth !== undefined) {
          process.stdout.write(
            `  URL path families: ${matrix.pathFamilyCount} origin/prefix groups at depth ${matrix.pathFamilyDepth}; ` +
              `${matrix.pathFamilies.length} shown${matrix.pathFamiliesTruncated ? ' (group list capped)' : ''}. Google and Bing remain separate measures.\n`
          );
        }
        if (matrix.currentAuditExposure) {
          const exposure = matrix.currentAuditExposure;
          const googleAccess = exposure.controls.find(
            ({ control }) => control === 'googlebot-currently-blocked'
          );
          const bingAccess = exposure.controls.find(
            ({ control }) => control === 'bingbot-currently-blocked'
          );
          process.stdout.write(
            `  Current audit snapshot: ${exposure.pagesWithCurrentAudit}/${exposure.joinedPageGroups} URL groups audited; ` +
              `Googlebot blocked ${googleAccess?.pages ?? 0}/${googleAccess?.pagesAssessed ?? 0} assessed, bingbot blocked ${bingAccess?.pages ?? 0}/${bingAccess?.pagesAssessed ?? 0} assessed. Metric shares on these groups remain separate and time-misaligned.\n`
          );
        }
        if (matrix.platformShareOverlap) {
          const googleOverlap =
            matrix.platformShareOverlap.googleMetricShareOnBothExportUrlsPercent;
          const bingOverlap = matrix.platformShareOverlap.bingMetricShareOnBothExportUrlsPercent;
          process.stdout.write(
            `  Metric share on URLs present in both exports: Google ${googleOverlap === undefined ? 'not measured' : `${googleOverlap.toFixed(2)}%`}; ` +
              `Bing ${bingOverlap === undefined ? 'not measured' : `${bingOverlap.toFixed(2)}%`} (separate export measures)\n`
          );
          const medianGap = matrix.platformShareOverlap.medianAbsoluteShareGapPercentagePoints;
          process.stdout.write(
            `  Median absolute share gap across the full URL join: ${medianGap === undefined ? 'not measured' : `${medianGap.toFixed(2)} pp`}\n`
          );
        }
        if (periodComparison) {
          process.stdout.write(
            `  Period comparison on retained matrix rows: ${periodComparison.pagesPresentInBothReturnedLists} shared URLs, ` +
              `${periodComparison.pagesOnlyInCurrentReturnedList} current-only and ${periodComparison.pagesOnlyInBaselineReturnedList} baseline-only; ` +
              `Google shares increased/decreased on ${periodComparison.googlePagesWithIncreasingShare}/${periodComparison.googlePagesWithDecreasingShare} pages, ` +
              `Bing on ${periodComparison.bingPagesWithIncreasingShare}/${periodComparison.bingPagesWithDecreasingShare}. ` +
              `${periodComparison.pagesTruncated || periodComparison.baselinePagesTruncated || periodComparison.currentPagesTruncated ? 'One or more detail lists are capped.' : 'Details complete for supplied matrix lists.'}\n`
          );
          if (periodComparison.pathFamilyComparison) {
            const families = periodComparison.pathFamilyComparison;
            process.stdout.write(
              `  Same-depth path families (${families.pathFamilyDepth}): ${families.familiesPresentInBothReturnedLists} shared, ` +
                `${families.familiesOnlyInCurrentReturnedList} current-only, ${families.familiesOnlyInBaselineReturnedList} baseline-only in retained lists` +
                `${families.baselineFamiliesTruncated || families.currentFamiliesTruncated || families.familiesTruncated ? ' (family details capped)' : ''}.\n`
            );
          }
        }
        if (matrix.auditBridge) {
          process.stdout.write(
            `  Canonical audit bridge: ${matrix.auditBridge.googlePagesMatchedByCanonical} Google URLs, ` +
              `${matrix.auditBridge.bingPagesMatchedByCanonical} Bing URLs mapped by unique canonical; ` +
              `${matrix.auditBridge.googlePagesWithAmbiguousCanonical + matrix.auditBridge.bingPagesWithAmbiguousCanonical} ambiguous matches left separate\n`
          );
          process.stdout.write(
            '  Audit controls are a current snapshot and may postdate platform report periods.\n'
          );
        }
        process.stdout.write(
          '  Measures, date ranges, and exports remain separate; a URL missing from either file is not treated as zero activity.\n'
        );
        if (
          matrix.rowsWithoutUsableUrl.googleRows > 0 ||
          matrix.rowsWithoutUsableUrl.bingRows > 0
        ) {
          process.stdout.write(
            `  Unusable page URL rows excluded from page groups: ${matrix.rowsWithoutUsableUrl.googleRows} Google, ${matrix.rowsWithoutUsableUrl.bingRows} Bing\n`
          );
        }
        if (args.output) process.stdout.write(`Structured report saved to ${args.output}\n`);
        if (args.html) process.stdout.write(`Offline GEO HTML matrix saved to ${args.html}\n`);
        if (args.csv) process.stdout.write(`GEO page matrix CSV saved to ${args.csv}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not create cross-platform GEO matrix: ${message}\n`);
      process.exit(2);
    }
    return;
  }
  if (args.geoGoogleSurfaceMatrix) {
    const allowedOptions = new Set([
      'geoGoogleSurfaceMatrix',
      'geoGoogleSurfaceBaselineJson',
      'geoGoogleSurfacePathFamilyCsv',
      'googleAiCsv',
      'googleAiXlsx',
      'googleAiDiscoverCsv',
      'googleAiDiscoverXlsx',
      'geoAuditJson',
      'geoPathDepth',
      'json',
      'output',
      'html',
      'csv',
    ]);
    const incompatibleOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ --geo-google-surface-matrix accepts one Search CSV/XLSX export, one Discover CSV/XLSX export, optional --geo-audit-json, --geo-path-depth, --geo-google-surface-baseline-json, --geo-google-surface-path-family-csv, --json, --output, --html, and --csv.\n'
      );
      process.exit(2);
    }
    try {
      const searchFile = (args.googleAiCsv ?? args.googleAiXlsx ?? [])[0]!;
      const discoverFile = (args.googleAiDiscoverCsv ?? args.googleAiDiscoverXlsx ?? [])[0]!;
      if (pathsReferToSameFile(searchFile, discoverFile))
        throw new Error('Search and Discover inputs must be different files.');
      const searchExports = await parseGoogleAiInputFile(
        searchFile,
        'search',
        Boolean(args.googleAiXlsx?.length)
      );
      const discoverExports = await parseGoogleAiInputFile(
        discoverFile,
        'discover',
        Boolean(args.googleAiDiscoverXlsx?.length)
      );
      if (searchExports.length !== 1)
        throw new Error(
          'The Search matrix workbook must contain exactly one recognized data worksheet.'
        );
      if (discoverExports.length !== 1)
        throw new Error(
          'The Discover matrix workbook must contain exactly one recognized data worksheet.'
        );
      const search = searchExports[0]!;
      const discover = discoverExports[0]!;
      let audit: SEOAuditBatchReport | SEOReport | SiteWideGeoAnalysis | undefined;
      if (args.geoAuditJson) {
        const auditStats = fs.statSync(args.geoAuditJson);
        if (!auditStats.isFile())
          throw new Error(`${args.geoAuditJson} is not a regular audit JSON file.`);
        if (auditStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoAuditJson} exceeds the 100 MiB input limit.`);
        const rawAudit: unknown = JSON.parse(fs.readFileSync(args.geoAuditJson, 'utf8'));
        if (
          !rawAudit ||
          typeof rawAudit !== 'object' ||
          (!('results' in rawAudit && Array.isArray(rawAudit.results)) &&
            !('url' in rawAudit && typeof rawAudit.url === 'string' && 'checks' in rawAudit) &&
            !isSiteWideGeoAnalysis(rawAudit))
        ) {
          throw new Error(
            'Audit JSON must contain one SEO report, an SEO batch report, or a version 1 GEO summary.'
          );
        }
        audit = rawAudit as SEOAuditBatchReport | SEOReport | SiteWideGeoAnalysis;
      }
      const matrix = compareGoogleAiSurfacePageObservations(
        search,
        discover,
        audit,
        args.geoPathDepth === undefined ? undefined : { pathFamilyDepth: args.geoPathDepth }
      );
      let periodComparison: ReturnType<typeof compareGoogleAiSurfaceMatrices> | undefined;
      if (args.geoGoogleSurfaceBaselineJson) {
        if (
          [searchFile, discoverFile, ...(args.geoAuditJson ? [args.geoAuditJson] : [])].some(
            (inputFile) => pathsReferToSameFile(args.geoGoogleSurfaceBaselineJson!, inputFile)
          )
        )
          throw new Error(
            '--geo-google-surface-baseline-json must differ from current CSV exports and audit JSON.'
          );
        const baselineStats = fs.statSync(args.geoGoogleSurfaceBaselineJson);
        if (!baselineStats.isFile())
          throw new Error(
            `${args.geoGoogleSurfaceBaselineJson} is not a regular matrix JSON file.`
          );
        if (baselineStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoGoogleSurfaceBaselineJson} exceeds the 100 MiB input limit.`);
        const rawBaseline: unknown = JSON.parse(
          fs.readFileSync(args.geoGoogleSurfaceBaselineJson, 'utf8')
        );
        if (!isGoogleSurfacePageMatrix(rawBaseline))
          throw new Error(
            `${args.geoGoogleSurfaceBaselineJson} is not a supported version 1 Google surface matrix.`
          );
        periodComparison = compareGoogleAiSurfaceMatrices(matrix, rawBaseline);
      }
      const report = { ...matrix, ...(periodComparison ? { periodComparison } : {}) };
      const inputFiles = [
        searchFile,
        discoverFile,
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
        ...(args.geoGoogleSurfaceBaselineJson ? [args.geoGoogleSurfaceBaselineJson] : []),
      ];
      const outputFiles = [
        args.output,
        args.html,
        args.csv,
        args.geoGoogleSurfacePathFamilyCsv,
      ].filter((file): file is string => Boolean(file));
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        )
      ) {
        throw new Error('JSON, HTML, and CSV output paths must differ from all input files.');
      }
      for (let index = 0; index < outputFiles.length; index += 1) {
        for (const otherOutput of outputFiles.slice(index + 1)) {
          if (pathsReferToSameFile(outputFiles[index]!, otherOutput))
            throw new Error('JSON, HTML, and CSV output paths must be different files.');
        }
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, JSON.stringify(report, null, 2), 'utf8');
      }
      if (args.html) {
        fs.mkdirSync(path.dirname(args.html), { recursive: true });
        fs.writeFileSync(args.html, renderGoogleSurfaceMatrixHtml(report), 'utf8');
      }
      if (args.csv) {
        fs.mkdirSync(path.dirname(args.csv), { recursive: true });
        fs.writeFileSync(args.csv, renderGoogleSurfaceMatrixCsv(report), 'utf8');
      }
      if (args.geoGoogleSurfacePathFamilyCsv) {
        fs.mkdirSync(path.dirname(args.geoGoogleSurfacePathFamilyCsv), { recursive: true });
        fs.writeFileSync(
          args.geoGoogleSurfacePathFamilyCsv,
          renderGoogleSurfacePathFamilyCsv(report),
          'utf8'
        );
      }
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (args.output)
          process.stderr.write(`Structured Google surface matrix saved to ${args.output}\n`);
        if (args.html)
          process.stderr.write(`Offline Google surface matrix saved to ${args.html}\n`);
        if (args.csv) process.stderr.write(`Google surface matrix CSV saved to ${args.csv}\n`);
        if (args.geoGoogleSurfacePathFamilyCsv)
          process.stderr.write(
            `Google surface path-family CSV saved to ${args.geoGoogleSurfacePathFamilyCsv}\n`
          );
      } else {
        process.stdout.write(
          `Google Search/Discover AI page matrix: ${matrix.pagesObservedByBoth} URLs in both exports; ` +
            `${matrix.pagesOnlyInSearchExport} Search-only, ${matrix.pagesOnlyInDiscoverExport} Discover-only\n`
        );
        process.stdout.write(
          `  Search AI: ${matrix.searchPages} pages, ${matrix.searchExportRowSummedImpressions} row-summed impressions; ` +
            `Discover AI: ${matrix.discoverPages} pages, ${matrix.discoverExportRowSummedImpressions} row-summed impressions\n`
        );
        process.stdout.write(
          `  ${matrix.pagesWithComparableShares} returned URLs have both within-surface shares; ` +
            `metric share on URLs present in both exports: Search ${matrix.searchImpressionShareOnBothPagesPercent === undefined ? 'not measured' : `${matrix.searchImpressionShareOnBothPagesPercent}%`}, ` +
            `Discover ${matrix.discoverImpressionShareOnBothPagesPercent === undefined ? 'not measured' : `${matrix.discoverImpressionShareOnBothPagesPercent}%`}\n`
        );
        if (periodComparison)
          process.stdout.write(
            `  Period comparison: ${periodComparison.pagesPresentInBothReturnedLists} URLs retained in both periods; ${periodComparison.pagesOnlyInCurrentReturnedList} current-only, ${periodComparison.pagesOnlyInBaselineReturnedList} baseline-only. Search matched-page impression change ${periodComparison.matchedSearchImpressionChange ?? 'not comparable'}; Discover ${periodComparison.matchedDiscoverImpressionChange ?? 'not comparable'}. Search share rose/fell on ${periodComparison.searchPagesWithIncreasingShare}/${periodComparison.searchPagesWithDecreasingShare} URLs; Discover ${periodComparison.discoverPagesWithIncreasingShare}/${periodComparison.discoverPagesWithDecreasingShare}. Measures remain separate.\n`
          );
        if (matrix.pathFamilyCount !== undefined)
          process.stdout.write(
            `  Path families at depth ${matrix.pathFamilyDepth}: ${matrix.pathFamilyCount} origin/prefix groups; ${matrix.pathFamilies?.length ?? 0} retained${matrix.pathFamiliesTruncated ? ' (capped)' : ''}${periodComparison?.pathFamilyComparison ? `; ${periodComparison.pathFamilyComparison.familiesPresentInBothReturnedLists} groups present in both periods` : ''}.\n`
          );
        if (matrix.pagesTruncated)
          process.stdout.write('  Page detail is capped at 1,000 URL groups.\n');
        if (args.output) process.stdout.write(`Structured matrix saved to ${args.output}\n`);
        if (args.html) process.stdout.write(`Offline HTML matrix saved to ${args.html}\n`);
        if (args.csv) process.stdout.write(`Matrix CSV saved to ${args.csv}\n`);
        if (args.geoGoogleSurfacePathFamilyCsv)
          process.stdout.write(`Path-family CSV saved to ${args.geoGoogleSurfacePathFamilyCsv}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not create Google Search/Discover GEO matrix: ${message}\n`);
      process.exit(2);
    }
    return;
  }
  if (bingAiInputCount) {
    const incompatibleOptions = Object.keys(args).filter(
      (key) =>
        ![
          'bingAiCsv',
          'bingAiXlsx',
          'bingAiBaselineCsv',
          'bingAiBaselineXlsx',
          'bingAiQueryBaselineCsv',
          'bingAiQueryBaselineXlsx',
          'bingAiTopicBaselineCsv',
          'bingAiTopicBaselineXlsx',
          'geoAuditJson',
          'json',
          'output',
          'html',
        ].includes(key)
    );
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ Bing AI exports can only be combined with --json, --output, --html, --geo-audit-json, Bing baseline comparisons, and --geo-platform-matrix.\n'
      );
      process.exit(2);
    }
    try {
      const csvExports = await Promise.all(
        (args.bingAiCsv ?? []).map((file) => parseBingAiInputFile(file, false))
      );
      const xlsxExports = await Promise.all(
        (args.bingAiXlsx ?? []).map((file) => parseBingAiInputFile(file, true))
      );
      const exports = [...csvExports, ...xlsxExports].flat();
      if ((bingPageBaseline || bingQueryBaseline || bingTopicBaseline) && exports.length !== 1) {
        throw new Error(
          'Bing period comparisons require exactly one recognized current table; select a workbook with one matching worksheet.'
        );
      }
      const currentFile = (args.bingAiCsv ?? args.bingAiXlsx ?? [])[0];
      if (!currentFile) throw new Error('A current Bing export is required.');
      const summaries = exports.map(summarizeBingAiPerformanceExport);
      const topicIntentAnalyses = exports.map((item) =>
        item.rows.some((row) => row.topic?.trim() && row.intent?.trim())
          ? analyzeBingAiTopicIntentIntersections(item)
          : undefined
      );
      let visibilityComparison: ReturnType<typeof compareBingAiPageCitationExports> | undefined;
      if (bingPageBaseline) {
        if (pathsReferToSameFile(bingPageBaseline, currentFile)) {
          throw new Error(
            'The Bing page baseline and current export must point to different files.'
          );
        }
        const baselineExports = await parseBingAiInputFile(
          bingPageBaseline,
          Boolean(args.bingAiBaselineXlsx)
        );
        if (baselineExports.length !== 1)
          throw new Error(
            'A Bing page baseline workbook must contain exactly one recognized table.'
          );
        const baseline = baselineExports[0]!;
        visibilityComparison = compareBingAiPageCitationExports(exports[0]!, baseline);
      }
      let queryMappingComparison: ReturnType<typeof compareBingAiQueryPageMappings> | undefined;
      if (bingQueryBaseline) {
        if (pathsReferToSameFile(bingQueryBaseline, currentFile)) {
          throw new Error(
            'The Bing query-page baseline and current export must point to different files.'
          );
        }
        const baselineExports = await parseBingAiInputFile(
          bingQueryBaseline,
          Boolean(args.bingAiQueryBaselineXlsx)
        );
        if (baselineExports.length !== 1)
          throw new Error(
            'A Bing query-page baseline workbook must contain exactly one recognized table.'
          );
        const baseline = baselineExports[0]!;
        queryMappingComparison = compareBingAiQueryPageMappings(exports[0]!, baseline);
      }
      let topicIntentComparison: ReturnType<typeof compareBingAiTopicIntentExports> | undefined;
      if (bingTopicBaseline) {
        if (pathsReferToSameFile(bingTopicBaseline, currentFile)) {
          throw new Error(
            'The Bing topic/intent baseline and current export must point to different files.'
          );
        }
        const baselineExports = await parseBingAiInputFile(
          bingTopicBaseline,
          Boolean(args.bingAiTopicBaselineXlsx)
        );
        if (baselineExports.length !== 1)
          throw new Error(
            'A Bing topic/intent baseline workbook must contain exactly one recognized table.'
          );
        const baseline = baselineExports[0]!;
        topicIntentComparison = compareBingAiTopicIntentExports(exports[0]!, baseline);
      }
      let correlations: ReturnType<typeof correlateBingAiCitationsWithAudit>[] | undefined;
      if (args.geoAuditJson) {
        const auditStats = fs.statSync(args.geoAuditJson);
        if (!auditStats.isFile())
          throw new Error(`${args.geoAuditJson} is not a regular audit JSON file.`);
        if (auditStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoAuditJson} exceeds the 100 MiB input limit.`);
        const rawAudit: unknown = JSON.parse(fs.readFileSync(args.geoAuditJson, 'utf8'));
        if (
          !rawAudit ||
          typeof rawAudit !== 'object' ||
          (!('results' in rawAudit && Array.isArray(rawAudit.results)) &&
            !('url' in rawAudit && typeof rawAudit.url === 'string' && 'checks' in rawAudit) &&
            !isSiteWideGeoAnalysis(rawAudit))
        ) {
          throw new Error(
            'Audit JSON must contain one SEO report, an SEO batch report, or a version 1 sitewide GEO summary.'
          );
        }
        const audit = rawAudit as SEOAuditBatchReport | SEOReport | SiteWideGeoAnalysis;
        correlations = exports.map((item) => correlateBingAiCitationsWithAudit(item, audit));
      }
      const queryPageAnalyses = exports.map((item, index) =>
        item.datasetKind === 'query-page-mapping'
          ? analyzeBingAiQueryPageMapping(item, correlations?.[index])
          : undefined
      );
      const report = {
        source: 'Bing Webmaster Tools AI Performance export',
        schemaVersion: 1,
        note: 'Microsoft reports aggregated, sampled citation activity. Grounding queries are grouped phrases, not individual prompts. Row counts are observations and do not represent rankings, authority, every answer, or causal effects.',
        exports,
        summaries,
        ...(queryPageAnalyses.some(Boolean)
          ? { queryPageAnalyses: queryPageAnalyses.filter((item) => item !== undefined) }
          : {}),
        ...(topicIntentAnalyses.some(Boolean)
          ? { topicIntentAnalyses: topicIntentAnalyses.filter((item) => item !== undefined) }
          : {}),
        ...(visibilityComparison ? { visibilityComparison } : {}),
        ...(queryMappingComparison ? { queryMappingComparison } : {}),
        ...(topicIntentComparison ? { topicIntentComparison } : {}),
        ...(correlations ? { correlations } : {}),
      };
      const inputFiles = [
        ...(args.bingAiCsv ?? []),
        ...(args.bingAiXlsx ?? []),
        ...(bingPageBaseline ? [bingPageBaseline] : []),
        ...(bingQueryBaseline ? [bingQueryBaseline] : []),
        ...(bingTopicBaseline ? [bingTopicBaseline] : []),
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
      ];
      const outputFiles = [args.output, args.html].filter((file): file is string => Boolean(file));
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        )
      ) {
        throw new Error('JSON and HTML output paths must differ from all input files.');
      }
      if (args.output && args.html && pathsReferToSameFile(args.output, args.html)) {
        throw new Error('--output and --html must point to different files.');
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, JSON.stringify(report, null, 2));
      }
      if (args.html) {
        fs.mkdirSync(path.dirname(args.html), { recursive: true });
        fs.writeFileSync(
          args.html,
          renderBingAiPerformanceHtml({
            exports,
            summaries,
            queryPageAnalyses: queryPageAnalyses.filter((item) => item !== undefined),
            topicIntentAnalyses: topicIntentAnalyses.filter((item) => item !== undefined),
            ...(visibilityComparison ? { visibilityComparison } : {}),
            ...(queryMappingComparison ? { queryMappingComparison } : {}),
            ...(topicIntentComparison ? { topicIntentComparison } : {}),
            ...(correlations ? { correlations } : {}),
          }),
          'utf8'
        );
      }
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (args.output) process.stderr.write(`Structured report saved to ${args.output}\n`);
        if (args.html) process.stderr.write(`Offline GEO HTML report saved to ${args.html}\n`);
      } else {
        for (const [index, item] of exports.entries()) {
          const summary = summaries[index];
          const queryPageAnalysis = queryPageAnalyses[index];
          const topicIntentAnalysis = topicIntentAnalyses[index];
          process.stdout.write(
            `${item.sourceFile ?? 'Bing AI Performance export'}: ${item.datasetKind}, ` +
              `${item.rowCount} rows, ${item.skippedRows} skipped, ${item.uniquePageCount} pages, ${item.uniqueQueryCount} grounding queries\n`
          );
          if (summary?.totalCitations !== undefined) {
            process.stdout.write(
              `  Export-row citation total: ${summary.totalCitations}; interpretation is limited to this sampled export view\n`
            );
          }
          if (summary?.firstToLastCitationChange) {
            const trend = summary.firstToLastCitationChange;
            const percentage =
              trend.percentChange === undefined
                ? ''
                : ` (${trend.percentChange > 0 ? '+' : ''}${trend.percentChange.toFixed(1)}%)`;
            process.stdout.write(
              `  Time-series change: ${trend.firstPeriod} → ${trend.lastPeriod}: ${trend.absoluteChange > 0 ? '+' : ''}${trend.absoluteChange}${percentage}\n`
            );
          }
          if (summary?.topPages.length) {
            process.stdout.write(
              `  Top pages by exported metric: ${summary.topPages
                .slice(0, 3)
                .map(
                  ({ value, citations, citedPages, averageCitationShare }) =>
                    `${value} (${citations ?? citedPages ?? `${averageCitationShare ?? 0}%`})`
                )
                .join('; ')}\n`
            );
          }
          if (summary?.topQueries.length) {
            process.stdout.write(
              `  Top grounding queries by exported metric: ${summary.topQueries
                .slice(0, 3)
                .map(
                  ({ value, citations, citedPages, averageCitationShare }) =>
                    `${value} (${citations ?? citedPages ?? `${averageCitationShare ?? 0}%`})`
                )
                .join('; ')}\n`
            );
          }
          if (summary?.topTopics.length) {
            process.stdout.write(
              `  Top topics by exported metric: ${summary.topTopics
                .slice(0, 3)
                .map(
                  ({ value, citations, citedPages, averageCitationShare }) =>
                    `${value} (${citations ?? citedPages ?? `${averageCitationShare ?? 0}%`})`
                )
                .join('; ')}\n`
            );
          }
          if (summary?.topIntents.length) {
            process.stdout.write(
              `  Top intents by exported metric: ${summary.topIntents
                .slice(0, 3)
                .map(
                  ({ value, citations, citedPages, averageCitationShare }) =>
                    `${value} (${citations ?? citedPages ?? `${averageCitationShare ?? 0}%`})`
                )
                .join('; ')}\n`
            );
          }
          if (queryPageAnalysis) {
            process.stdout.write(
              `  Query-page map: ${queryPageAnalysis.queryCount} exact phrases across ${queryPageAnalysis.pageCount} cited URLs; ` +
                `${queryPageAnalysis.queriesMappedToMultiplePages} phrases map to multiple URLs, ${queryPageAnalysis.pagesMappedFromMultipleQueries} URLs map from multiple phrases.\n`
            );
            if (queryPageAnalysis.citationDistributionSummary) {
              const spread = queryPageAnalysis.citationDistributionSummary;
              process.stdout.write(
                `  Citation distribution: median largest-page share ${spread.medianLargestPageCitationSharePercent === undefined ? 'not measured' : `${spread.medianLargestPageCitationSharePercent.toFixed(1)}%`}; ` +
                  `median effective pages ${spread.medianEffectiveCitationPages === undefined ? 'not measured' : spread.medianEffectiveCitationPages.toFixed(2)} across ${spread.queriesWithMeasuredDistribution} phrases; ` +
                  `${spread.queriesWithPartialPageMetricCoverage} phrases have partial page-metric coverage.\n`
              );
            }
            if (queryPageAnalysis.queryRowsWithoutUsableUrl > 0) {
              process.stdout.write(
                `  Query rows without a usable HTTP(S) page URL: ${queryPageAnalysis.queryRowsWithoutUsableUrl}\n`
              );
            }
            process.stdout.write(
              '  Phrase-to-page overlap is an observation, not proof of query cannibalization or answer overlap.\n'
            );
          }
          if (topicIntentAnalysis) {
            process.stdout.write(
              `  Topic / intent cross-tab: ${topicIntentAnalysis.topicCount} topics × ${topicIntentAnalysis.intentCount} intents across ${topicIntentAnalysis.cellCount} observed cells and ${topicIntentAnalysis.mappedRows} rows; ` +
                `${topicIntentAnalysis.rowSummedCitations === undefined ? 'citation metric unavailable' : `${topicIntentAnalysis.rowSummedCitations} row-summed citations`}\n`
            );
            if (topicIntentAnalysis.cells.length) {
              process.stdout.write(
                `  Top observed intersections: ${topicIntentAnalysis.cells
                  .slice(0, 3)
                  .map(
                    ({ topic, intent, citations }) =>
                      `${topic} / ${intent} (${citations ?? 'no citation metric'})`
                  )
                  .join('; ')}\n`
              );
            }
          }
        }
        if (correlations) {
          for (const item of correlations) {
            process.stdout.write(
              `  Correlation: ${item.citedPagesMatchedToAudit}/${item.uniqueCitedPages} cited pages matched; ` +
                `${item.citedPagesMatchedByCanonical} through a unique canonical URL, ${item.citedPagesWithAmbiguousCanonicalMatch} with ambiguous canonical targets; ` +
                `${item.matchedPagesWithCurrentCrawlerBlocks} currently blocked by robots.txt; ` +
                `${item.matchedPagesWithCurrentBingbotNoindex} currently noindex for bingbot, ${item.matchedPagesWithCurrentBingbotNoSnippet} with bingbot snippet restrictions, ` +
                `${item.matchedPagesWithCurrentBingbotMaxSnippetZero} with bingbot max-snippet:0, ` +
                `${item.matchedPagesWithCurrentDataNoSnippet} with data-nosnippet content\n`
            );
            for (const observation of item.currentControlObservations.filter(
              ({ state, exportRows }) => state === 'present' && exportRows > 0
            )) {
              process.stdout.write(
                `    Current ${observation.control}: ${observation.matchedPages} matched pages across ${observation.exportRows} export rows` +
                  `${observation.rowSummedCitations === undefined ? '' : `; ${observation.rowSummedCitations} row-summed citations from ${observation.rowsWithCitationMetric} rows`}\n`
              );
            }
            for (const observation of item.currentContentObservations.filter(
              ({ state, exportRows }) => state === 'present' && exportRows > 0
            )) {
              process.stdout.write(
                `    Current content signal ${observation.signal}: ${observation.matchedPages} matched pages across ${observation.exportRows} export rows` +
                  `${observation.rowSummedCitations === undefined ? '' : `; ${observation.rowSummedCitations} row-summed citations from ${observation.rowsWithCitationMetric} rows`}\n`
              );
            }
          }
        }
        if (visibilityComparison) {
          const comparison = visibilityComparison;
          const percentage =
            comparison.matchedPagePercentChange === undefined
              ? ''
              : ` (${comparison.matchedPagePercentChange > 0 ? '+' : ''}${comparison.matchedPagePercentChange.toFixed(1)}%)`;
          process.stdout.write(
            `  Matched-page citation change: ${comparison.matchedPageCitationChange > 0 ? '+' : ''}${comparison.matchedPageCitationChange}${percentage} across ${comparison.pagesCompared} URLs; ` +
              `${comparison.pagesWithIncreasedCitations} increased, ${comparison.pagesWithDecreasedCitations} decreased, ${comparison.unchangedPages} unchanged\n`
          );
          if (comparison.meanPageCitationShareChangePercentagePoints !== undefined) {
            const shareDelta = comparison.meanPageCitationShareChangePercentagePoints;
            process.stdout.write(
              `  Mean per-page citation-share change: ${shareDelta > 0 ? '+' : ''}${shareDelta.toFixed(1)} percentage points across ${comparison.pagesWithCitationShareComparison} URLs ` +
                `(baseline ${comparison.meanBaselinePageCitationShare!.toFixed(1)}% → current ${comparison.meanCurrentPageCitationShare!.toFixed(1)}%)\n`
            );
          } else {
            process.stdout.write(
              `  Citation-share comparison: unavailable across shared URLs without share metrics in both exports\n`
            );
          }
          process.stdout.write(
            `  Export-only URLs: ${comparison.pagesOnlyInCurrentExport} current, ${comparison.pagesOnlyInBaselineExport} baseline; ` +
              `${comparison.pagesWithUnavailableCitationMetric} shared URLs lack comparable citation metrics. Missing export rows are unknown, not zero citations.\n`
          );
        }
        if (queryMappingComparison) {
          process.stdout.write(
            `  Query-page comparison: ${queryMappingComparison.queriesPresentInBoth} exact phrases present in both exports; ` +
              `${queryMappingComparison.queriesOnlyInCurrentExport} current-only, ${queryMappingComparison.queriesOnlyInBaselineExport} baseline-only. ` +
              `${queryMappingComparison.pageMappingsOnlyInCurrentExport} current-only and ${queryMappingComparison.pageMappingsOnlyInBaselineExport} baseline-only sampled URL mappings; ` +
              `${queryMappingComparison.pageMappingsCompared} shared phrase/URL pairs have a citation change of ${queryMappingComparison.matchedCitationChange > 0 ? '+' : ''}${queryMappingComparison.matchedCitationChange}, ` +
              `${queryMappingComparison.pageMappingsWithUnavailableCitationMetric} without comparable citation metrics.\n`
          );
          process.stdout.write(
            '  Exact query/page deltas compare sampled export mappings; an absent row does not prove that a phrase or citation disappeared.\n'
          );
        }
        if (topicIntentComparison) {
          process.stdout.write(
            `  Topic/intent comparison: ${topicIntentComparison.cohortsPresentInBoth} cohorts present in both exports; ` +
              `${topicIntentComparison.cohortsOnlyInCurrentExport} current-only, ${topicIntentComparison.cohortsOnlyInBaselineExport} baseline-only. ` +
              `${topicIntentComparison.cohortsComparedWithCitationMetrics} shared cohorts have comparable citation totals; ` +
              `${topicIntentComparison.cohortsTruncated ? 'details capped at 500' : 'all cohort details shown'}.\n`
          );
        }
        if (args.output) process.stdout.write(`Structured report saved to ${args.output}\n`);
        if (args.html) process.stdout.write(`Offline GEO HTML report saved to ${args.html}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not analyze Bing AI Performance CSV: ${message}\n`);
      process.exit(2);
    }
    return;
  }
  const googleAiSearchFiles = [...(args.googleAiCsv ?? []), ...(args.googleAiXlsx ?? [])];
  const googleAiDiscoverFiles = [
    ...(args.googleAiDiscoverCsv ?? []),
    ...(args.googleAiDiscoverXlsx ?? []),
  ];
  const googleAiFiles = [...googleAiSearchFiles, ...googleAiDiscoverFiles];
  const googleAiInputs = [
    ...(args.googleAiCsv ?? []).map((file) => ({ file, xlsx: false, surface: 'search' as const })),
    ...(args.googleAiXlsx ?? []).map((file) => ({ file, xlsx: true, surface: 'search' as const })),
    ...(args.googleAiDiscoverCsv ?? []).map((file) => ({
      file,
      xlsx: false,
      surface: 'discover' as const,
    })),
    ...(args.googleAiDiscoverXlsx ?? []).map((file) => ({
      file,
      xlsx: true,
      surface: 'discover' as const,
    })),
  ];
  const googleAiSurface = googleAiDiscoverInputCount ? ('discover' as const) : ('search' as const);
  if (googleAiInputs.length) {
    const incompatibleOptions = Object.keys(args).filter(
      (key) =>
        ![
          'googleAiCsv',
          'googleAiXlsx',
          'googleAiDiscoverCsv',
          'googleAiDiscoverXlsx',
          'googleAiBaselineCsv',
          'googleAiBaselineXlsx',
          'googleAiDimensionBaselineCsv',
          'googleAiDimensionBaselineXlsx',
          'geoAuditJson',
          'json',
          'output',
          'html',
          'csv',
        ].includes(key)
    );
    if (incompatibleOptions.length > 0) {
      process.stderr.write(
        '❌ Google generative AI imports can only be combined with --json, --output, --html, --csv, --geo-audit-json, and Google AI baseline comparisons.\n'
      );
      process.exit(2);
    }
    try {
      if ((googlePageBaseline || googleDimensionBaseline) && googleAiFiles.length !== 1) {
        throw new Error(
          'Google AI baseline comparisons require exactly one current generative AI export.'
        );
      }
      const baselineFile = googlePageBaseline ?? googleDimensionBaseline;
      if (baselineFile && pathsReferToSameFile(baselineFile, googleAiFiles[0] ?? '')) {
        throw new Error('The baseline and current inputs must be different files.');
      }
      const exports = (
        await Promise.all(
          googleAiInputs.map(({ file, surface, xlsx }) =>
            parseGoogleAiInputFile(file, surface, xlsx)
          )
        )
      ).flat();
      if ((googlePageBaseline || googleDimensionBaseline) && exports.length !== 1) {
        throw new Error(
          'Google AI baseline comparisons require exactly one recognized current data table.'
        );
      }
      const summaries = exports.map(summarizeGoogleAiPerformanceExport);
      let visibilityComparison: ReturnType<typeof compareGoogleAiPerformanceExports> | undefined;
      let dimensionComparison: ReturnType<typeof compareGoogleAiDimensionExports> | undefined;
      if (googlePageBaseline) {
        const baselineExports = await parseGoogleAiInputFile(
          googlePageBaseline,
          googleAiSurface,
          Boolean(args.googleAiBaselineXlsx)
        );
        if (baselineExports.length !== 1)
          throw new Error(
            'A Google XLSX baseline must contain exactly one recognized data worksheet.'
          );
        const baseline = baselineExports[0]!;
        visibilityComparison = compareGoogleAiPerformanceExports(exports[0]!, baseline);
      }
      if (googleDimensionBaseline) {
        const baselineExports = await parseGoogleAiInputFile(
          googleDimensionBaseline,
          googleAiSurface,
          Boolean(args.googleAiDimensionBaselineXlsx)
        );
        if (baselineExports.length !== 1)
          throw new Error(
            'A Google XLSX baseline must contain exactly one recognized data worksheet.'
          );
        const baseline = baselineExports[0]!;
        dimensionComparison = compareGoogleAiDimensionExports(exports[0]!, baseline);
      }
      let correlations: ReturnType<typeof correlateGoogleAiPerformanceWithAudit>[] | undefined;
      if (args.geoAuditJson) {
        const auditStats = fs.statSync(args.geoAuditJson);
        if (!auditStats.isFile())
          throw new Error(`${args.geoAuditJson} is not a regular audit JSON file.`);
        if (auditStats.size > 100 * 1024 * 1024)
          throw new Error(`${args.geoAuditJson} exceeds the 100 MiB input limit.`);
        const rawAudit: unknown = JSON.parse(fs.readFileSync(args.geoAuditJson, 'utf8'));
        if (
          !rawAudit ||
          typeof rawAudit !== 'object' ||
          (!('results' in rawAudit && Array.isArray(rawAudit.results)) &&
            !('url' in rawAudit && typeof rawAudit.url === 'string' && 'checks' in rawAudit) &&
            !isSiteWideGeoAnalysis(rawAudit))
        ) {
          throw new Error(
            'Audit JSON must contain one SEO report, an SEO batch report, or a version 1 sitewide GEO summary.'
          );
        }
        const audit = rawAudit as SEOAuditBatchReport | SEOReport | SiteWideGeoAnalysis;
        correlations = exports.map((item) => correlateGoogleAiPerformanceWithAudit(item, audit));
      }
      const report = {
        source:
          googleAiSurface === 'search'
            ? 'Google Search Console Search Generative AI performance export'
            : 'Google Search Console Discover Generative AI performance export',
        schemaVersion: 1,
        note:
          googleAiSurface === 'search'
            ? 'This report measures impressions from AI Overviews and AI Mode, not citations, clicks, grounding queries, ranking, or causal impact. Each downloaded report view stays separate because page, country, device, and date tables have different aggregation scopes.'
            : 'This report measures impressions from generative AI features in Google Discover, not citations, clicks, grounding queries, ranking, or causal impact. The Discover report is distinct from Search report views and uses canonical page URLs.',
        exports,
        summaries,
        ...(visibilityComparison ? { visibilityComparison } : {}),
        ...(dimensionComparison ? { dimensionComparison } : {}),
        ...(correlations ? { correlations } : {}),
      };
      const inputFiles = [
        ...googleAiFiles,
        ...(googlePageBaseline ? [googlePageBaseline] : []),
        ...(googleDimensionBaseline ? [googleDimensionBaseline] : []),
        ...(args.geoAuditJson ? [args.geoAuditJson] : []),
      ];
      const outputFiles = [args.output, args.html, args.csv].filter((file): file is string =>
        Boolean(file)
      );
      if (
        outputFiles.some((outputFile) =>
          inputFiles.some((inputFile) => pathsReferToSameFile(inputFile, outputFile))
        )
      ) {
        throw new Error('JSON, HTML, and CSV output paths must differ from all input files.');
      }
      if (
        outputFiles.some((outputFile, index) =>
          outputFiles
            .slice(index + 1)
            .some((otherFile) => pathsReferToSameFile(outputFile, otherFile))
        )
      ) {
        throw new Error('--output, --html, and --csv must point to different files.');
      }
      if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, JSON.stringify(report, null, 2));
      }
      if (args.html) {
        fs.mkdirSync(path.dirname(args.html), { recursive: true });
        fs.writeFileSync(
          args.html,
          renderGoogleAiPerformanceHtml({
            exports,
            summaries,
            ...(visibilityComparison ? { visibilityComparison } : {}),
            ...(dimensionComparison ? { dimensionComparison } : {}),
            ...(correlations ? { correlations } : {}),
          }),
          'utf8'
        );
      }
      if (args.csv) {
        fs.mkdirSync(path.dirname(args.csv), { recursive: true });
        fs.writeFileSync(
          args.csv,
          renderGoogleAiPerformanceCsv({
            exports,
            summaries,
            ...(visibilityComparison ? { visibilityComparison } : {}),
            ...(dimensionComparison ? { dimensionComparison } : {}),
          }),
          'utf8'
        );
      }
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (args.output) process.stderr.write(`Structured report saved to ${args.output}\n`);
        if (args.html)
          process.stderr.write(`Offline Google GEO HTML report saved to ${args.html}\n`);
        if (args.csv)
          process.stderr.write(`Spreadsheet-friendly Google GEO CSV saved to ${args.csv}\n`);
      } else {
        for (const summary of summaries) {
          process.stdout.write(
            `${summary.sourceFile ?? `Google Search Console ${googleAiSurface} generative AI export`}: ${summary.datasetKind}, ` +
              `${summary.rowCount} rows, ${summary.uniquePageCount} pages, ${summary.rowSummedImpressions} row-summed impressions\n`
          );
          if (summary.topPages.length > 0)
            process.stdout.write(
              `  Top pages: ${summary.topPages
                .slice(0, 5)
                .map(({ value, impressions }) => `${value} (${impressions})`)
                .join('; ')}\n`
            );
          if (summary.timeSeries.length > 0)
            process.stdout.write(
              `  Date buckets: ${summary.timeSeries[0]?.value} → ${summary.timeSeries[summary.timeSeries.length - 1]?.value}\n`
            );
        }
        if (visibilityComparison) {
          const percent =
            visibilityComparison.matchedPagePercentChange === undefined
              ? ''
              : ` (${visibilityComparison.matchedPagePercentChange > 0 ? '+' : ''}${visibilityComparison.matchedPagePercentChange.toFixed(1)}%)`;
          process.stdout.write(
            `  Matched-page row-sum change: ${visibilityComparison.matchedPageImpressionChange > 0 ? '+' : ''}${visibilityComparison.matchedPageImpressionChange} impressions across ${visibilityComparison.pagesCompared} shared URLs${percent}; ` +
              `${visibilityComparison.pagesOnlyInCurrentExport} URLs only in current export, ${visibilityComparison.pagesOnlyInBaselineExport} only in baseline (absence is unknown under the 1,000-row limit)\n`
          );
        }
        if (dimensionComparison) {
          process.stdout.write(
            `  Exact-dimension comparison (${dimensionComparison.dimensions.join(' × ') || 'overview'}): ` +
              `${dimensionComparison.cohortsCompared} cohorts shared; ${dimensionComparison.cohortsWithIncreasedImpressions} increased, ` +
              `${dimensionComparison.cohortsWithDecreasedImpressions} decreased; matched row-sum change ` +
              `${dimensionComparison.matchedImpressionChange > 0 ? '+' : ''}${dimensionComparison.matchedImpressionChange} impressions.\n`
          );
          process.stdout.write(
            `  Within-export impression share rose on ${dimensionComparison.cohortsWithIncreasingShare} shared cohorts and fell on ${dimensionComparison.cohortsWithDecreasingShare}; baseline/current row sums ${dimensionComparison.baselineImpressionsInExport}/${dimensionComparison.currentImpressionsInExport}.\n`
          );
          process.stdout.write(
            '  Exact-dimension deltas describe the sampled export cohorts; current-only and baseline-only rows are not zeroes.\n'
          );
        }
        if (correlations) {
          for (const item of correlations) {
            process.stdout.write(
              `  Audit correlation: ${item.pagesMatchedToAudit}/${item.uniqueReportPages} pages matched; ` +
                `${item.matchedPagesWithCurrentGooglebotBlocks} currently blocked to Googlebot; ` +
                `${item.matchedPagesWithCurrentGooglebotNoindex} currently noindex; ` +
                `${item.matchedPagesWithCurrentGooglebotSnippetRestrictions} with Googlebot snippet restrictions\n`
            );
            const controlLabels: Record<string, string> = {
              'googlebot-robots-access': 'Googlebot robots blocks',
              'googlebot-noindex': 'Googlebot noindex',
              'googlebot-snippet-restriction': 'Googlebot snippet restrictions',
              'data-nosnippet': 'data-nosnippet regions',
            };
            const presentControls = item.currentControlObservations.filter(
              ({ state, exportRows }) => state === 'present' && exportRows > 0
            );
            if (presentControls.length > 0) {
              process.stdout.write(
                `    Current-control observations (overlapping, snapshot only): ${presentControls
                  .map(
                    ({ control, matchedPages, rowSummedImpressions }) =>
                      `${controlLabels[control] ?? control}: ${matchedPages} page(s), ${rowSummedImpressions} row-summed impressions`
                  )
                  .join('; ')}\n`
              );
            }
            const presentContent = item.currentContentObservations.filter(
              ({ state, exportRows }) => state === 'present' && exportRows > 0
            );
            if (presentContent.length > 0) {
              process.stdout.write(
                `    Current content observations (overlapping, snapshot only): ${presentContent
                  .map(
                    ({ signal, matchedPages, rowSummedImpressions }) =>
                      `${signal}: ${matchedPages} page(s), ${rowSummedImpressions} row-summed impressions`
                  )
                  .join('; ')}\n`
              );
            }
          }
        }
        if (args.output) process.stdout.write(`Structured report saved to ${args.output}\n`);
        if (args.html)
          process.stdout.write(`Offline Google GEO HTML report saved to ${args.html}\n`);
        if (args.csv)
          process.stdout.write(`Spreadsheet-friendly Google GEO CSV saved to ${args.csv}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `❌ Could not analyze Google Search Console ${googleAiSurface} generative AI CSV: ${message}\n`
      );
      process.exit(2);
    }
    return;
  }
  startMetricsServer();

  // ── 12-Factor: Load config from environment first ──────────────────────────
  const envConfig = loadEnvConfig();
  const logger = createLogger(
    (envConfig.logLevel as 'debug' | 'info' | 'warn' | 'error') || 'info'
  );

  // If run with no arguments and no AVIARY_URL, launch the interactive TUI
  const hasNoArgs = process.argv.slice(2).length === 0;
  if (hasNoArgs && !envConfig.url) {
    const path = await import('path');
    const { spawn } = await import('child_process');
    const { resolveTuiBinary, supportedPlatforms } = await import('./tuiBinary');
    const tuiPath = resolveTuiBinary();

    if (!tuiPath) {
      process.stderr.write('❌ Error: TUI binary not found for this platform.\n');
      process.stderr.write(`   Supported platforms: ${supportedPlatforms().join(', ')}\n`);
      process.stderr.write(`   Detected: ${process.platform}-${process.arch}\n`);
      process.stderr.write('   If you are building from source, run "npm run build" first.\n');
      process.exit(1);
    }

    // Spawn TUI inheriting standard streams
    const tuiProcess = spawn(tuiPath, ['--cli-path', path.join(__dirname, 'cli.js')], {
      stdio: 'inherit',
    });

    tuiProcess.on('exit', (code) => {
      process.exit(code || 0);
    });
    return;
  }

  if (args.historyReport) {
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    if (
      !args.html ||
      args.url ||
      args.urls ||
      args.sitemap ||
      args.crawl ||
      args.maxUrls !== undefined ||
      args.maxDepth !== undefined ||
      args.maxCrawlBytes !== undefined ||
      args.maxCrawlPageBytes !== undefined ||
      args.history ||
      args.renderReport ||
      args.pdf ||
      args.junit ||
      args.sarif ||
      args.markdown ||
      args.csv ||
      args.output ||
      args.baseline ||
      args.comparisonOutput ||
      args.geoComparisonCsv ||
      args.geoGateOutput ||
      args.geoSummaryOutput ||
      args.geoSummaryCsv ||
      args.geoEntityVariantsCsv ||
      args.geoCrawlerAccessCsv ||
      args.failOnRegression ||
      args.failOnGeoChange ||
      args.failOnAiCrawlerCloudFrontResultRegression ||
      args.failOnFindings ||
      args.failOnDuplicateMetadata ||
      args.failOnDuplicateContent ||
      args.failOnHreflang ||
      args.failOnCanonicalChains ||
      args.failBelowScore !== undefined ||
      args.categories ||
      args.json ||
      args.timeout !== undefined ||
      args.concurrency !== undefined ||
      args.watchSeconds !== undefined ||
      args.config ||
      args.preset ||
      args.headless === false ||
      args.viewport ||
      args.initConfig ||
      args.verbose
    ) {
      process.stderr.write(
        '❌ --history-report requires --html and cannot be combined with audit options.\n'
      );
      process.exit(2);
    }
    try {
      generateSEOAuditHistoryReportFromFile(args.historyReport, args.html);
      logger.info('Audit history report written', { input: args.historyReport, output: args.html });
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not generate audit history report: ${message}\n`);
      process.exit(2);
    }
  }

  if (args.renderReport) {
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    if (
      args.url ||
      args.urls ||
      args.sitemap ||
      args.crawl ||
      args.maxUrls !== undefined ||
      args.maxDepth !== undefined ||
      args.maxCrawlBytes !== undefined ||
      args.maxCrawlPageBytes !== undefined ||
      args.history ||
      args.historyReport ||
      args.output ||
      args.failOnRegression ||
      args.failOnAiCrawlerCloudFrontResultRegression ||
      args.failOnFindings ||
      args.failOnDuplicateMetadata ||
      args.failOnDuplicateContent ||
      args.failOnHreflang ||
      args.failOnCanonicalChains ||
      args.failBelowScore !== undefined ||
      args.categories ||
      args.json ||
      args.timeout !== undefined ||
      args.concurrency !== undefined ||
      args.watchSeconds !== undefined ||
      args.config ||
      args.preset ||
      args.headless === false ||
      args.viewport ||
      args.initConfig ||
      args.verbose
    ) {
      process.stderr.write(
        '❌ --render cannot be combined with audit options or --history-report.\n'
      );
      process.exit(2);
    }

    const outputs = {
      html: args.html || envConfig.htmlOutput,
      pdf: args.pdf || envConfig.pdfOutput,
      junit: args.junit || envConfig.junitOutput,
      sarif: args.sarif || envConfig.sarifOutput,
      markdown: args.markdown || envConfig.markdownOutput,
      csv: args.csv || envConfig.csvOutput,
      comparison: args.comparisonOutput,
      'GEO comparison CSV': args.geoComparisonCsv,
      'GEO gate JSON': args.geoGateOutput,
      'GEO summary JSON': args.geoSummaryOutput,
      'GEO summary CSV': args.geoSummaryCsv,
      'GEO entity variants CSV': args.geoEntityVariantsCsv,
      'GEO crawler access CSV': args.geoCrawlerAccessCsv,
    };
    ensureDistinctOutputPaths(outputs);
    if (
      Object.values(outputs).some(
        (outputPath) => outputPath && pathsReferToSameFile(args.renderReport!, outputPath)
      )
    ) {
      process.stderr.write(
        '❌ A rendered report output path must differ from the saved JSON input path.\n'
      );
      process.exit(2);
    }
    if (!Object.values(outputs).some(Boolean) && !args.failOnGeoChange) {
      process.stderr.write(
        '❌ --render requires at least one report output option (for example --html or --markdown).\n'
      );
      process.exit(2);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(args.renderReport, 'utf8'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not read saved report "${args.renderReport}": ${message}\n`);
      process.exit(2);
    }

    const singleReport = isSEOReport(parsed) ? parsed : undefined;
    const batchReport = !singleReport && isSEOAuditBatchReport(parsed) ? parsed : undefined;
    if (!singleReport && !batchReport) {
      process.stderr.write(
        `❌ Saved report "${args.renderReport}" is not a valid Aviary single or batch JSON report.\n`
      );
      process.exit(2);
    }
    const renderBaselinePath = args.baseline || envConfig.baselineReport;
    if (args.failOnGeoChange && !renderBaselinePath) {
      process.stderr.write(
        '❌ --fail-on-geo-change with --render requires --baseline or AVIARY_BASELINE_REPORT.\n'
      );
      process.exit(2);
    }
    if (
      (args.comparisonOutput || args.geoComparisonCsv || args.geoGateOutput) &&
      !renderBaselinePath
    ) {
      process.stderr.write(
        '❌ Comparison outputs with --render require --baseline or AVIARY_BASELINE_REPORT.\n'
      );
      process.exit(2);
    }
    if (args.geoGateOutput && !args.failOnGeoChange) {
      process.stderr.write('❌ --geo-gate-output requires --fail-on-geo-change.\n');
      process.exit(2);
    }
    if (
      batchReport === undefined &&
      (args.geoSummaryOutput ||
        args.geoSummaryCsv ||
        args.geoEntityVariantsCsv ||
        args.geoCrawlerAccessCsv)
    ) {
      process.stderr.write(
        '❌ GEO summary and crawler CSV outputs with --render require a saved batch report.\n'
      );
      process.exit(2);
    }
    const inputPaths = [args.renderReport, renderBaselinePath].filter((value): value is string =>
      Boolean(value)
    );
    if (
      Object.values(outputs).some(
        (outputPath) =>
          outputPath && inputPaths.some((inputPath) => pathsReferToSameFile(outputPath, inputPath))
      )
    ) {
      process.stderr.write(
        '❌ A rendered output path must differ from the saved report and baseline input paths.\n'
      );
      process.exit(2);
    }
    for (const outputPath of Object.values(outputs)) {
      if (outputPath) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }
    const offlineGeoGateReasons: string[] = [];
    let offlineGeoGateSummary = '';
    try {
      if (singleReport) {
        const comparison = renderBaselinePath
          ? compareSEOReports(singleReport, loadBaselineReport(renderBaselinePath))
          : undefined;
        if (outputs.html) generateHtmlReport(singleReport, outputs.html, comparison);
        if (outputs.pdf) await generatePdfReport(singleReport, outputs.pdf, {}, comparison);
        if (outputs.junit) generateJunitReport(singleReport, outputs.junit);
        if (outputs.sarif) generateSarifReport(singleReport, outputs.sarif);
        if (outputs.markdown) generateMarkdownReport(singleReport, outputs.markdown, comparison);
        if (outputs.csv) generateCsvReport(singleReport, outputs.csv);
        if (outputs.comparison && comparison)
          fs.writeFileSync(outputs.comparison, JSON.stringify(comparison, null, 2), 'utf8');
        if (outputs['GEO comparison CSV'] && comparison)
          fs.writeFileSync(
            outputs['GEO comparison CSV'],
            renderGeoSignalChangesCsv({ ...comparison, currentTimestamp: singleReport.timestamp }),
            'utf8'
          );
        if (args.failOnGeoChange && comparison) {
          const gate = evaluateGate(comparison);
          if (args.geoGateOutput)
            writeGeoGateOutput(
              args.geoGateOutput,
              comparison,
              singleReport.timestamp,
              gate,
              singleReport.url
            );
          offlineGeoGateSummary = `${gate.matchingChanges.length}${hasGeoChangeFilters ? ` selected of ${gate.totalChanges}` : ''} GEO signal changes; crawler/preview controls ${gate.comparablePages > 0 ? 'comparable' : 'not comparable'}`;
          offlineGeoGateReasons.push(...gateFailureMessages(gate));
        }
      } else if (batchReport) {
        const baselineBatch = renderBaselinePath
          ? loadBaselineBatchReport(renderBaselinePath)
          : undefined;
        const comparison = baselineBatch
          ? compareSEOAuditBatches(batchReport, baselineBatch)
          : undefined;
        if (outputs.html) generateBatchHtmlReport(batchReport, outputs.html, comparison);
        if (outputs.pdf) await generateBatchPdfReport(batchReport, outputs.pdf, {}, comparison);
        if (outputs.junit) generateBatchJunitReport(batchReport, outputs.junit);
        if (outputs.sarif) generateBatchSarifReport(batchReport, outputs.sarif);
        if (outputs.markdown)
          generateBatchMarkdownReport(batchReport, outputs.markdown, comparison);
        if (outputs.csv) generateBatchCsvReport(batchReport, outputs.csv);
        if (outputs.comparison && comparison)
          fs.writeFileSync(outputs.comparison, JSON.stringify(comparison, null, 2), 'utf8');
        if (outputs['GEO comparison CSV'] && comparison)
          fs.writeFileSync(
            outputs['GEO comparison CSV'],
            renderGeoSignalChangesCsv(comparison),
            'utf8'
          );
        if (args.failOnGeoChange && comparison) {
          const gate = evaluateGate(
            comparison,
            batchReport.summary.failedUrls,
            baselineBatch?.summary.failedUrls ?? 0
          );
          if (args.geoGateOutput)
            writeGeoGateOutput(args.geoGateOutput, comparison, batchReport.timestamp, gate);
          offlineGeoGateSummary = `${gate.matchingChanges.length}${hasGeoChangeFilters ? ` selected of ${gate.totalChanges}` : ''} GEO signal changes; crawler/preview controls comparable on ${gate.comparablePages} of ${gate.matchedPages} matched pages`;
          offlineGeoGateReasons.push(...gateFailureMessages(gate));
        }
        if (
          args.geoSummaryOutput ||
          args.geoSummaryCsv ||
          args.geoEntityVariantsCsv ||
          args.geoCrawlerAccessCsv
        ) {
          const geoAnalysis = analyzeSiteWideGeo(batchReport);
          if (args.geoSummaryOutput) writeGeoSummaryFile(args.geoSummaryOutput, geoAnalysis);
          if (args.geoSummaryCsv)
            fs.writeFileSync(args.geoSummaryCsv, renderSiteWideGeoCsv(geoAnalysis), 'utf8');
          if (args.geoEntityVariantsCsv)
            fs.writeFileSync(
              args.geoEntityVariantsCsv,
              renderSiteWideGeoEntityVariantsCsv(geoAnalysis),
              'utf8'
            );
          if (args.geoCrawlerAccessCsv)
            fs.writeFileSync(
              args.geoCrawlerAccessCsv,
              renderSiteWideGeoCrawlerAccessCsv(geoAnalysis),
              'utf8'
            );
        }
      }
      const renderedOutputs = Object.values(outputs).filter(Boolean);
      if (renderedOutputs.length > 0) {
        logger.info('Saved report rendered', {
          input: args.renderReport,
          outputs: renderedOutputs,
        });
      } else if (args.failOnGeoChange) {
        logger.info('Saved GEO baseline comparison completed', {
          input: args.renderReport,
          baseline: renderBaselinePath,
        });
      }
      if (offlineGeoGateReasons.length > 0) {
        process.stderr.write(`❌ GEO baseline gate failed: ${offlineGeoGateReasons.join('; ')}.\n`);
        process.exitCode = 1;
        return;
      }
      if (args.failOnGeoChange)
        process.stderr.write(`✅ GEO baseline gate passed: ${offlineGeoGateSummary}.\n`);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not render saved report: ${message}\n`);
      process.exit(2);
    }
  }

  const failBelowScore = args.failBelowScore ?? envConfig.failBelowScore;
  if (
    failBelowScore !== undefined &&
    (!Number.isFinite(failBelowScore) || failBelowScore < 0 || failBelowScore > 100)
  ) {
    process.stderr.write('❌ AVIARY_FAIL_BELOW_SCORE must be a number from 0 to 100.\n');
    process.exit(2);
  }
  const effectiveTimeout = args.timeout ?? envConfig.timeout;
  if (
    effectiveTimeout !== undefined &&
    (!Number.isInteger(effectiveTimeout) || effectiveTimeout < 1)
  ) {
    process.stderr.write(
      '❌ AVIARY_TIMEOUT / --timeout must be a positive integer in milliseconds.\n'
    );
    process.exit(2);
  }
  const effectiveSettleAfterNavigationMs =
    args.settleAfterNavigationMs ?? envConfig.settleAfterNavigationMs;
  if (
    effectiveSettleAfterNavigationMs !== undefined &&
    (!Number.isInteger(effectiveSettleAfterNavigationMs) ||
      effectiveSettleAfterNavigationMs < 0 ||
      effectiveSettleAfterNavigationMs > 30_000)
  ) {
    process.stderr.write(
      '❌ AVIARY_SETTLE_AFTER_NAVIGATION_MS / --settle-ms must be an integer from 0 to 30000.\n'
    );
    process.exit(2);
  }
  const baselinePath = args.baseline || envConfig.baselineReport;
  const failOnRegression = args.failOnRegression ?? envConfig.failOnRegression ?? false;
  const failOnGeoChange = args.failOnGeoChange ?? false;
  if (args.comparisonOutput && !baselinePath) {
    process.stderr.write('❌ --comparison-output requires --baseline or AVIARY_BASELINE_REPORT.\n');
    process.exit(2);
  }
  if (args.geoComparisonCsv && !baselinePath) {
    process.stderr.write(
      '❌ --geo-comparison-csv requires --baseline or AVIARY_BASELINE_REPORT.\n'
    );
    process.exit(2);
  }
  if (args.geoGateOutput && !failOnGeoChange) {
    process.stderr.write('❌ --geo-gate-output requires --fail-on-geo-change.\n');
    process.exit(2);
  }
  if (
    [args.comparisonOutput, args.geoComparisonCsv, args.geoGateOutput].some(
      (output) => output && baselinePath && pathsReferToSameFile(output, baselinePath)
    )
  ) {
    process.stderr.write('❌ Comparison outputs must not overwrite the baseline report.\n');
    process.exit(2);
  }
  if (failOnRegression && !baselinePath) {
    process.stderr.write(
      '❌ --fail-on-regression requires --baseline or AVIARY_BASELINE_REPORT.\n'
    );
    process.exit(2);
  }
  if (failOnGeoChange && !baselinePath) {
    process.stderr.write(
      '❌ --fail-on-geo-change requires --baseline or AVIARY_BASELINE_REPORT.\n'
    );
    process.exit(2);
  }
  const requestedCategories = args.categories ?? envConfig.categories;
  const categories = requestedCategories ? [...new Set(requestedCategories)] : undefined;
  if (categories) {
    const knownCategories = new Set<string>(CHECKER_REGISTRY.map(({ key }) => key));
    const invalidCategories = categories.filter((category) => !knownCategories.has(category));
    if (invalidCategories.length > 0) {
      process.stderr.write(
        `❌ Unknown category key(s): ${invalidCategories.join(', ')}. Available keys: ${[...knownCategories].join(', ')}.\n`
      );
      process.exit(2);
    }
  }
  if (failOnGeoChange && categories && !categories.includes('geo')) {
    process.stderr.write('❌ --fail-on-geo-change requires the geo category to be selected.\n');
    process.exit(2);
  }
  if (
    (args.failOnDuplicateContent ?? envConfig.failOnDuplicateContent) &&
    categories &&
    !categories.includes('content')
  ) {
    process.stderr.write(
      '❌ --fail-on-duplicate-content requires the content category to be selected.\n'
    );
    process.exit(2);
  }
  if (args.failOnHreflang && categories && !categories.includes('internationalization')) {
    process.stderr.write(
      '❌ --fail-on-hreflang requires the internationalization category to be selected.\n'
    );
    process.exit(2);
  }
  if (args.failOnCanonicalChains && categories && !categories.includes('metaTags')) {
    process.stderr.write(
      '❌ --fail-on-canonical-chains requires the metaTags category to be selected.\n'
    );
    process.exit(2);
  }

  // Handle --init-config flag
  if (args.initConfig) {
    const { ConfigLoader } = await import('./config');
    const configPath = '.aviary.json';
    // CLI --preset > ENV AVIARY_PRESET > default
    const preset =
      (args.preset as 'basic' | 'advanced' | 'strict' | 'geo') || envConfig.preset || 'advanced';
    ConfigLoader.createDefaultConfig(configPath, preset);
    process.stderr.write(`✓ Created configuration file: ${configPath}\n`);
    process.stderr.write(`  Using preset: ${preset}\n`);
    process.stderr.write(`\nEdit the file to customize your SEO rules and settings.\n`);
    process.exit(0);
  }

  // Resolve effective URL: CLI --url > ENV AVIARY_URL
  const effectiveUrl = args.url || envConfig.url;
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.maxUrls !== undefined && !args.sitemap && !args.crawl) {
    process.stderr.write('❌ --max-urls can only be used with --sitemap or --crawl.\n');
    process.exit(2);
  }
  if (args.maxDepth !== undefined && !args.crawl) {
    process.stderr.write('❌ --max-depth can only be used with --crawl.\n');
    process.exit(2);
  }
  if (args.watchSeconds !== undefined && !args.urls && !args.sitemap && !args.crawl) {
    process.stderr.write(
      '❌ --watch requires --urls <file>, --sitemap <url>, or --crawl <url> so the page collection is explicit.\n'
    );
    process.exit(2);
  }
  if (args.geoSummaryOutput && !args.urls && !args.sitemap && !args.crawl) {
    process.stderr.write(
      '❌ --geo-summary-output requires --urls, --sitemap, or --crawl batch mode.\n'
    );
    process.exit(2);
  }
  if (args.geoSummaryCsv && !args.urls && !args.sitemap && !args.crawl) {
    process.stderr.write(
      '❌ --geo-summary-csv requires --urls, --sitemap, or --crawl batch mode.\n'
    );
    process.exit(2);
  }
  if (args.geoEntityVariantsCsv && !args.urls && !args.sitemap && !args.crawl) {
    process.stderr.write(
      '❌ --geo-entity-variants-csv requires --urls, --sitemap, or --crawl batch mode.\n'
    );
    process.exit(2);
  }
  if (args.geoCrawlerAccessCsv && !args.urls && !args.sitemap && !args.crawl) {
    process.stderr.write(
      '❌ --geo-crawler-access-csv requires --urls, --sitemap, or --crawl batch mode.\n'
    );
    process.exit(2);
  }
  if (
    [
      args.geoSummaryOutput,
      args.geoSummaryCsv,
      args.geoEntityVariantsCsv,
      args.geoCrawlerAccessCsv,
    ].some((output) => output && baselinePath && pathsReferToSameFile(output, baselinePath))
  ) {
    process.stderr.write('❌ GEO summary outputs must not overwrite the baseline report.\n');
    process.exit(2);
  }
  if (!effectiveUrl && !args.urls && !args.sitemap && !args.crawl) {
    printHelp();
    process.exit(1);
  }

  if (args.urls || args.sitemap || args.crawl) {
    if (args.url || ((args.sitemap || args.crawl) && envConfig.url)) {
      process.stderr.write(
        '❌ Use either --url, --urls, --sitemap, or --crawl, not more than one.\n'
      );
      process.exit(2);
    }
    if ([args.urls, args.sitemap, args.crawl].filter(Boolean).length > 1) {
      process.stderr.write('❌ Choose only one batch source: --urls, --sitemap, or --crawl.\n');
      process.exit(2);
    }
    if (args.maxUrls !== undefined && !args.sitemap && !args.crawl) {
      process.stderr.write('❌ --max-urls can only be used with --sitemap or --crawl.\n');
      process.exit(2);
    }
    if (args.maxDepth !== undefined && !args.crawl) {
      process.stderr.write('❌ --max-depth can only be used with --crawl.\n');
      process.exit(2);
    }
    if (
      args.watchSeconds !== undefined &&
      (baselinePath ||
        failOnRegression ||
        failOnGeoChange ||
        (args.failOnFindings ?? envConfig.failOnFindings) ||
        (args.failOnDuplicateMetadata ?? envConfig.failOnDuplicateMetadata) ||
        (args.failOnDuplicateContent ?? envConfig.failOnDuplicateContent) ||
        args.failOnHreflang ||
        args.failOnCanonicalChains ||
        failBelowScore !== undefined)
    ) {
      process.stderr.write(
        '❌ --watch cannot be combined with baselines or one-shot CI failure gates.\n'
      );
      process.exit(2);
    }

    let baselineBatch: SEOAuditBatchReport | undefined;
    if (baselinePath) {
      try {
        baselineBatch = loadBaselineBatchReport(baselinePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `❌ Could not load batch baseline report "${baselinePath}": ${message}\n`
        );
        process.exit(2);
      }
    }

    let urls: string[];
    if (args.sitemap || args.crawl) {
      if (args.watchSeconds !== undefined) {
        urls = [];
      } else if (args.sitemap) {
        try {
          urls = await discoverSitemapUrls(args.sitemap, {
            maxUrls: args.maxUrls,
            timeoutMs: effectiveTimeout,
            onDocument: writeSitemapProgress,
          });
          urls = await filterUrlsByRobotsTxt(urls, args.sitemap, {
            timeoutMs: effectiveTimeout,
            onFilter: ({ allowedUrls, disallowedUrls }) => {
              if (disallowedUrls > 0) {
                process.stderr.write(
                  `robots.txt: skipped ${disallowedUrls} disallowed page URL(s); ${allowedUrls} remain.\n`
                );
              }
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(
            `❌ Could not discover pages from sitemap "${args.sitemap}": ${message}\n`
          );
          process.exit(2);
        }
      } else {
        try {
          urls = await discoverLinkedUrls(args.crawl!, {
            maxUrls: args.maxUrls,
            maxDepth: args.maxDepth,
            maxTotalBytes: args.maxCrawlBytes,
            maxPageBytes: args.maxCrawlPageBytes,
            concurrency: args.concurrency ?? envConfig.concurrency,
            timeoutMs: effectiveTimeout,
            onPage: writeCrawlProgress,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(`❌ Could not crawl pages from "${args.crawl}": ${message}\n`);
          process.exit(2);
        }
      }
    } else {
      try {
        const listFiles = args.urls === '-' ? ['-'] : expandUrlListFiles(args.urls!);
        if (
          [
            args.geoSummaryOutput,
            args.geoSummaryCsv,
            args.geoEntityVariantsCsv,
            args.geoCrawlerAccessCsv,
            args.geoComparisonCsv,
            args.geoGateOutput,
          ].some(
            (output) =>
              output && listFiles.some((file) => file !== '-' && pathsReferToSameFile(output, file))
          )
        ) {
          process.stderr.write('❌ GEO outputs must not overwrite a --urls input file.\n');
          process.exit(2);
        }
        urls = [];
        let inputBytes = 0;
        for (const file of listFiles) {
          const { text: source, byteLength } = readUrlListSource(
            file,
            MAX_URL_LIST_BYTES - inputBytes
          );
          inputBytes += byteLength;
          appendUrlListEntries(source.replace(/^\uFEFF/, ''), urls);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`❌ Could not read URL list "${args.urls}": ${message}\n`);
        process.exit(2);
      }
    }
    const watchDiscovery = Boolean((args.sitemap || args.crawl) && args.watchSeconds !== undefined);
    if (urls.length === 0 && !watchDiscovery) {
      process.stderr.write('❌ No URLs were found in the selected batch source.\n');
      process.exit(2);
    }

    const effectivePreset = args.preset || envConfig.preset;
    const effectiveViewportStr = args.viewport || envConfig.viewport;
    const viewport = parseViewport(effectiveViewportStr) ?? { width: 1920, height: 1080 };
    const headless = args.headless === false ? false : (envConfig.headless ?? true);
    const config = effectivePreset
      ? { preset: effectivePreset as 'basic' | 'advanced' | 'strict' | 'geo' }
      : undefined;

    const concurrency = args.concurrency ?? envConfig.concurrency ?? 2;
    const effectiveOutput = args.output || envConfig.output;
    const comparisonOutput = args.comparisonOutput;
    const effectiveHistoryOutput = args.history || envConfig.historyOutput;
    const effectiveJunitOutput = args.junit || envConfig.junitOutput;
    const effectiveSarifOutput = args.sarif || envConfig.sarifOutput;
    const effectiveMarkdownOutput = args.markdown || envConfig.markdownOutput;
    const effectiveCsvOutput = args.csv || envConfig.csvOutput;
    const effectiveHtmlOutput = args.html || envConfig.htmlOutput;
    const effectivePdfOutput = args.pdf || envConfig.pdfOutput;

    ensureDistinctOutputPaths({
      JSON: effectiveOutput,
      comparison: comparisonOutput,
      'GEO comparison CSV': args.geoComparisonCsv,
      'GEO gate JSON': args.geoGateOutput,
      'GEO summary': args.geoSummaryOutput,
      'GEO summary CSV': args.geoSummaryCsv,
      'GEO entity variants CSV': args.geoEntityVariantsCsv,
      'GEO crawler access CSV': args.geoCrawlerAccessCsv,
      history: effectiveHistoryOutput,
      JUnit: effectiveJunitOutput,
      SARIF: effectiveSarifOutput,
      Markdown: effectiveMarkdownOutput,
      CSV: effectiveCsvOutput,
      HTML: effectiveHtmlOutput,
      PDF: effectivePdfOutput,
    });

    if (args.watchSeconds !== undefined) {
      const controller = new AbortController();
      let watchError: Error | undefined;
      const abortWatch = (): void => controller.abort();
      process.on('SIGINT', abortWatch);
      process.on('SIGTERM', abortWatch);

      logger.info('Watching URL batch', {
        source: args.sitemap || args.crawl || 'URL list',
        urls: args.sitemap || args.crawl ? 'rediscovered each cycle' : urls.length,
        concurrency,
        intervalSeconds: args.watchSeconds,
      });
      try {
        const sitemapCache = args.sitemap ? createSitemapDiscoveryCache() : undefined;
        const crawlCache = args.crawl ? createSiteCrawlCache() : undefined;
        const urlSource = args.sitemap
          ? async () => {
              const discovered = await discoverSitemapUrls(args.sitemap!, {
                maxUrls: args.maxUrls,
                timeoutMs: effectiveTimeout,
                signal: controller.signal,
                cache: sitemapCache,
                onDocument: writeSitemapProgress,
              });
              return filterUrlsByRobotsTxt(discovered, args.sitemap!, {
                timeoutMs: effectiveTimeout,
                signal: controller.signal,
                onFilter: ({ allowedUrls, disallowedUrls }) => {
                  if (disallowedUrls > 0) {
                    process.stderr.write(
                      `robots.txt: skipped ${disallowedUrls} disallowed page URL(s); ${allowedUrls} remain.\n`
                    );
                  }
                },
              });
            }
          : args.crawl
            ? () =>
                discoverLinkedUrls(args.crawl!, {
                  maxUrls: args.maxUrls,
                  maxDepth: args.maxDepth,
                  maxTotalBytes: args.maxCrawlBytes,
                  maxPageBytes: args.maxCrawlPageBytes,
                  cache: crawlCache,
                  concurrency: args.concurrency ?? envConfig.concurrency,
                  timeoutMs: effectiveTimeout,
                  signal: controller.signal,
                  onPage: writeCrawlProgress,
                })
            : urls;
        await watchUrls(urlSource, {
          intervalMs: args.watchSeconds * 1000,
          signal: controller.signal,
          concurrency,
          headless,
          viewport,
          timeout: effectiveTimeout,
          navigationWaitUntil: args.navigationWaitUntil,
          settleAfterNavigationMs: effectiveSettleAfterNavigationMs,
          ...(args.crawl || args.sitemap ? { userAgent: AVIARY_CRAWLER_USER_AGENT } : {}),
          configFile: args.config,
          config,
          categories,
          onProgress: ({ completedUrls, requestedUrls, result }) => {
            const status = result.status === 'complete' ? 'complete' : 'error';
            process.stderr.write(
              `Audit progress: ${completedUrls}/${requestedUrls} ${result.url} (${status})\n`
            );
          },
          onAudit: async (batch) => {
            try {
              if (effectiveOutput) {
                fs.mkdirSync(path.dirname(effectiveOutput), { recursive: true });
                fs.writeFileSync(effectiveOutput, JSON.stringify(batch, null, 2));
              }
              if (effectiveJunitOutput) generateBatchJunitReport(batch, effectiveJunitOutput);
              if (effectiveSarifOutput) generateBatchSarifReport(batch, effectiveSarifOutput);
              if (effectiveMarkdownOutput)
                generateBatchMarkdownReport(batch, effectiveMarkdownOutput);
              if (effectiveCsvOutput) generateBatchCsvReport(batch, effectiveCsvOutput);
              if (effectiveHtmlOutput) generateBatchHtmlReport(batch, effectiveHtmlOutput);
              if (effectivePdfOutput) await generateBatchPdfReport(batch, effectivePdfOutput);
              if (effectiveHistoryOutput) appendSEOAuditBatchHistory(batch, effectiveHistoryOutput);
              if ((args.geoComparisonCsv || args.geoGateOutput) && baselineBatch) {
                const comparison = compareSEOAuditBatches(batch, baselineBatch);
                if (args.geoComparisonCsv) {
                  fs.mkdirSync(path.dirname(args.geoComparisonCsv), { recursive: true });
                  fs.writeFileSync(
                    args.geoComparisonCsv,
                    renderGeoSignalChangesCsv(comparison),
                    'utf8'
                  );
                }
                if (args.geoGateOutput) {
                  const gate = evaluateGate(
                    comparison,
                    batch.summary.failedUrls,
                    baselineBatch.summary.failedUrls
                  );
                  writeGeoGateOutput(args.geoGateOutput, comparison, batch.timestamp, gate);
                }
              }
              const geoAnalysis = analyzeSiteWideGeo(batch);
              if (args.geoSummaryOutput) {
                writeGeoSummaryFile(args.geoSummaryOutput, geoAnalysis);
                logger.info('Sitewide GEO summary saved', { path: args.geoSummaryOutput });
              }
              if (args.geoSummaryCsv) {
                fs.mkdirSync(path.dirname(args.geoSummaryCsv), { recursive: true });
                fs.writeFileSync(args.geoSummaryCsv, renderSiteWideGeoCsv(geoAnalysis), 'utf8');
                logger.info('Per-page GEO summary CSV saved', { path: args.geoSummaryCsv });
              }
              if (args.geoEntityVariantsCsv) {
                fs.mkdirSync(path.dirname(args.geoEntityVariantsCsv), { recursive: true });
                fs.writeFileSync(
                  args.geoEntityVariantsCsv,
                  renderSiteWideGeoEntityVariantsCsv(geoAnalysis),
                  'utf8'
                );
                logger.info('GEO entity variants CSV saved', { path: args.geoEntityVariantsCsv });
              }
              if (args.geoCrawlerAccessCsv) {
                fs.mkdirSync(path.dirname(args.geoCrawlerAccessCsv), { recursive: true });
                fs.writeFileSync(
                  args.geoCrawlerAccessCsv,
                  renderSiteWideGeoCrawlerAccessCsv(geoAnalysis),
                  'utf8'
                );
                logger.info('GEO crawler access CSV saved', { path: args.geoCrawlerAccessCsv });
              }
              if (args.json) {
                process.stdout.write(`${JSON.stringify(batch)}\n`);
              } else {
                process.stderr.write(
                  `\n📊 Watch audit complete: ${batch.summary.completedUrls}/${batch.summary.requestedUrls} URLs, ` +
                    `score ${batch.summary.averageScore ?? 'N/A'}, ${batch.summary.failedChecks} failed checks.\n`
                );
                if (geoAnalysis.pagesWithGeoData > 0)
                  process.stderr.write(`${formatSiteWideGeoSummary(geoAnalysis)}\n`);
              }
            } catch (error) {
              watchError = error instanceof Error ? error : new Error(String(error));
              controller.abort();
            }
          },
        });
      } catch (error) {
        watchError = error instanceof Error ? error : new Error(String(error));
      } finally {
        process.off('SIGINT', abortWatch);
        process.off('SIGTERM', abortWatch);
      }
      if (watchError) {
        process.stderr.write(`❌ Watch mode stopped: ${watchError.message}\n`);
        process.exitCode = 2;
      } else {
        logger.info('Watch mode stopped');
      }
      return;
    }

    if (!args.json) logger.info('Running batch SEO check', { urls: urls.length, concurrency });
    let batch: SEOAuditBatchReport;
    try {
      batch = await auditUrls(urls, {
        concurrency,
        headless,
        viewport,
        timeout: effectiveTimeout,
        navigationWaitUntil: args.navigationWaitUntil,
        settleAfterNavigationMs: effectiveSettleAfterNavigationMs,
        ...(args.crawl || args.sitemap ? { userAgent: AVIARY_CRAWLER_USER_AGENT } : {}),
        configFile: args.config,
        config,
        categories,
        onProgress: ({ completedUrls, requestedUrls, result }) => {
          const status = result.status === 'complete' ? 'complete' : 'error';
          process.stderr.write(
            `Audit progress: ${completedUrls}/${requestedUrls} ${result.url} (${status})\n`
          );
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Batch audit could not start: ${message}\n`);
      process.exit(2);
    }

    let comparison: SEOAuditBatchComparison | undefined;
    if (baselineBatch) {
      try {
        comparison = compareSEOAuditBatches(batch, baselineBatch);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`❌ Could not compare batch reports: ${message}\n`);
        process.exit(2);
      }
    }

    if (comparisonOutput && comparison) {
      const dir = path.dirname(comparisonOutput);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(comparisonOutput, JSON.stringify(comparison, null, 2));
      logger.info('JSON baseline comparison saved', { path: comparisonOutput });
    }
    if (args.geoComparisonCsv && comparison) {
      fs.mkdirSync(path.dirname(args.geoComparisonCsv), { recursive: true });
      fs.writeFileSync(args.geoComparisonCsv, renderGeoSignalChangesCsv(comparison), 'utf8');
      logger.info('GEO signal changes CSV saved', { path: args.geoComparisonCsv });
    }

    if (effectiveOutput) {
      const dir = path.dirname(effectiveOutput);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(effectiveOutput, JSON.stringify(batch, null, 2));
      logger.info('JSON batch report saved', { path: effectiveOutput });
    }
    if (effectiveJunitOutput) {
      generateBatchJunitReport(batch, effectiveJunitOutput);
      logger.info('JUnit batch report saved', { path: effectiveJunitOutput });
    }
    if (effectiveSarifOutput) {
      generateBatchSarifReport(batch, effectiveSarifOutput);
      logger.info('SARIF batch report saved', { path: effectiveSarifOutput });
    }
    if (effectiveHtmlOutput) {
      generateBatchHtmlReport(batch, effectiveHtmlOutput, comparison);
      logger.info('HTML batch dashboard saved', { path: effectiveHtmlOutput });
    }
    if (effectivePdfOutput) {
      await generateBatchPdfReport(batch, effectivePdfOutput, {}, comparison);
      logger.info('PDF batch report saved', { path: effectivePdfOutput });
    }
    if (effectiveMarkdownOutput) {
      generateBatchMarkdownReport(batch, effectiveMarkdownOutput, comparison);
      logger.info('Markdown batch report saved', { path: effectiveMarkdownOutput });
    }
    if (effectiveCsvOutput) {
      generateBatchCsvReport(batch, effectiveCsvOutput);
      logger.info('CSV batch report saved', { path: effectiveCsvOutput });
    }
    if (effectiveHistoryOutput) {
      appendSEOAuditBatchHistory(batch, effectiveHistoryOutput);
      logger.info('Batch history appended', {
        path: effectiveHistoryOutput,
        records: batch.results.length,
      });
    }

    const failReasons: string[] = [];
    const metadataAnalysis = analyzeSiteWideMetadata(batch);
    const contentAnalysis = analyzeSiteWideContent(batch);
    const linkGraphAnalysis = analyzeSiteWideLinkGraph(batch);
    const hreflangAnalysis = analyzeSiteWideHreflang(batch);
    const canonicalAnalysis = analyzeSiteWideCanonicals(batch);
    const geoAnalysis = analyzeSiteWideGeo(batch);
    if (args.geoSummaryOutput) {
      writeGeoSummaryFile(args.geoSummaryOutput, geoAnalysis);
      logger.info('Sitewide GEO summary saved', { path: args.geoSummaryOutput });
    }
    if (args.geoSummaryCsv) {
      fs.mkdirSync(path.dirname(args.geoSummaryCsv), { recursive: true });
      fs.writeFileSync(args.geoSummaryCsv, renderSiteWideGeoCsv(geoAnalysis), 'utf8');
      logger.info('Per-page GEO summary CSV saved', { path: args.geoSummaryCsv });
    }
    if (args.geoEntityVariantsCsv) {
      fs.mkdirSync(path.dirname(args.geoEntityVariantsCsv), { recursive: true });
      fs.writeFileSync(
        args.geoEntityVariantsCsv,
        renderSiteWideGeoEntityVariantsCsv(geoAnalysis),
        'utf8'
      );
      logger.info('GEO entity variants CSV saved', { path: args.geoEntityVariantsCsv });
    }
    if (args.geoCrawlerAccessCsv) {
      fs.mkdirSync(path.dirname(args.geoCrawlerAccessCsv), { recursive: true });
      fs.writeFileSync(
        args.geoCrawlerAccessCsv,
        renderSiteWideGeoCrawlerAccessCsv(geoAnalysis),
        'utf8'
      );
      logger.info('GEO crawler access CSV saved', { path: args.geoCrawlerAccessCsv });
    }
    if (batch.summary.failedUrls > 0) {
      failReasons.push(`${batch.summary.failedUrls} URL audit(s) could not complete`);
    }
    if ((args.failOnFindings ?? envConfig.failOnFindings) && batch.summary.failedChecks > 0) {
      failReasons.push(`${batch.summary.failedChecks} failed check(s)`);
    }
    if (
      (args.failOnDuplicateMetadata ?? envConfig.failOnDuplicateMetadata) &&
      (metadataAnalysis.duplicateTitles.length > 0 ||
        metadataAnalysis.duplicateDescriptions.length > 0)
    ) {
      failReasons.push(
        `${metadataAnalysis.duplicateTitles.length} duplicate title group(s) and ${metadataAnalysis.duplicateDescriptions.length} duplicate description group(s)`
      );
    }
    if (
      (args.failOnDuplicateContent ?? envConfig.failOnDuplicateContent) &&
      contentAnalysis.duplicateContent.length > 0
    ) {
      failReasons.push(
        `${contentAnalysis.duplicateContent.length} exact duplicate content group(s)`
      );
    }
    if (
      (args.failOnDuplicateContent ?? envConfig.failOnDuplicateContent) &&
      contentAnalysis.pagesSkipped > 0
    ) {
      failReasons.push(
        `content fingerprints unavailable for ${contentAnalysis.pagesSkipped} page(s)`
      );
    }
    if (args.failOnHreflang && hreflangAnalysis.missingReciprocals.length > 0) {
      failReasons.push(
        `${hreflangAnalysis.missingReciprocals.length} missing hreflang return link(s)`
      );
    }
    if (args.failOnHreflang && hreflangAnalysis.pagesSkipped > 0) {
      failReasons.push(
        `hreflang result data unavailable for ${hreflangAnalysis.pagesSkipped} page(s)`
      );
    }
    if (args.failOnCanonicalChains && canonicalAnalysis.pagesSkipped > 0) {
      failReasons.push(
        `canonical result data unavailable for ${canonicalAnalysis.pagesSkipped} page(s)`
      );
    }
    if (args.failOnCanonicalChains && canonicalAnalysis.pagesWithInvalidCanonical > 0) {
      failReasons.push(`${canonicalAnalysis.pagesWithInvalidCanonical} invalid canonical URL(s)`);
    }
    if (args.failOnCanonicalChains && canonicalAnalysis.pagesWithMultipleCanonicals > 0) {
      failReasons.push(
        `${canonicalAnalysis.pagesWithMultipleCanonicals} page(s) with multiple canonical declarations`
      );
    }
    if (args.failOnCanonicalChains && canonicalAnalysis.canonicalChains.length > 0) {
      failReasons.push(`${canonicalAnalysis.canonicalChains.length} canonical chain(s)`);
    }
    if (args.failOnCanonicalChains && canonicalAnalysis.canonicalLoops.length > 0) {
      failReasons.push(`${canonicalAnalysis.canonicalLoops.length} canonical loop(s)`);
    }
    if (failOnRegression && comparison) {
      if (comparison.scoreDelta !== null && comparison.scoreDelta < 0) {
        failReasons.push(`average score dropped by ${Math.abs(comparison.scoreDelta)} points`);
      }
      if (comparison.newFailures.length > 0) {
        failReasons.push(`${comparison.newFailures.length} newly failed check(s)`);
      }
    }
    if (failOnGeoChange && comparison) {
      const gate = evaluateGate(
        comparison,
        batch.summary.failedUrls,
        baselineBatch?.summary.failedUrls ?? 0
      );
      if (args.geoGateOutput)
        writeGeoGateOutput(args.geoGateOutput, comparison, batch.timestamp, gate);
      failReasons.push(...gateFailureMessages(gate));
    }
    if (
      failBelowScore !== undefined &&
      (batch.summary.averageScore === null || batch.summary.averageScore < failBelowScore)
    ) {
      failReasons.push(
        batch.summary.averageScore === null
          ? `average score unavailable (minimum ${failBelowScore})`
          : `average score ${batch.summary.averageScore} is below minimum ${failBelowScore}`
      );
    }

    if (args.json) {
      process.stdout.write(JSON.stringify(batch, null, 2) + '\n');
    } else {
      process.stderr.write(`📊 Batch SEO Report\n\n`);
      process.stderr.write(
        `URLs: ${batch.summary.completedUrls} completed, ${batch.summary.failedUrls} failed, ${batch.summary.requestedUrls} requested\n`
      );
      process.stderr.write(
        `Browser workers: ${batch.summary.concurrency ?? 'unknown (legacy report)'}\n`
      );
      process.stderr.write(
        `Checks: ${batch.summary.passedChecks} passed, ${batch.summary.failedChecks} failed\n`
      );
      process.stderr.write(
        `Average score: ${batch.summary.averageScore === null ? 'N/A' : `${batch.summary.averageScore}/100`}\n`
      );
      process.stderr.write(
        'Score summarizes checks run; it is not a search-ranking or GEO-readiness prediction.\n\n'
      );
      if (geoAnalysis.pagesWithGeoData > 0)
        process.stderr.write(`${formatSiteWideGeoSummary(geoAnalysis)}\n`);
      process.stderr.write(
        `Cross-page metadata: ${metadataAnalysis.duplicateTitles.length} duplicate title group(s), ${metadataAnalysis.duplicateDescriptions.length} duplicate description group(s)\n`
      );
      if (contentAnalysis.pagesWithFingerprint > 0) {
        process.stderr.write(
          `Exact page-text duplicates: ${contentAnalysis.duplicateContent.length} group(s) across ${contentAnalysis.pagesWithFingerprint} fingerprinted pages\n`
        );
      }
      if (linkGraphAnalysis.pagesWithGraphData > 0) {
        process.stderr.write(
          `Scanned-page link graph: ${linkGraphAnalysis.linksAnalyzed} observed links; ${linkGraphAnalysis.pagesWithNoInboundLinks.length} page(s) with no observed inbound links\n`
        );
      }
      if (hreflangAnalysis.pagesWithData > 0) {
        process.stderr.write(
          `Cross-page hreflang: ${hreflangAnalysis.missingReciprocals.length} missing return link(s) across ${hreflangAnalysis.pagesWithData} page(s) with result data\n`
        );
      }
      if (canonicalAnalysis.pagesWithData > 0) {
        process.stderr.write(
          `Canonical consistency: ${canonicalAnalysis.canonicalChains.length} chain(s), ${canonicalAnalysis.canonicalLoops.length} loop(s), ${canonicalAnalysis.duplicateCanonicalTargets.length} shared target group(s)\n`
        );
      }
      process.stderr.write('\n');
      if (comparison) {
        const delta =
          comparison.scoreDelta === null
            ? 'N/A'
            : `${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta}`;
        process.stderr.write(
          `Baseline average: ${comparison.baselineAverageScore ?? 'N/A'} → ${comparison.currentAverageScore ?? 'N/A'} (${delta}); `
        );
        const gatedChangeCount = evaluateGate(comparison).matchingChanges.length;
        const geoChangeSummary = hasGeoChangeFilters
          ? `${gatedChangeCount} selected of ${comparison.geoChanges.length} signal changes`
          : `${comparison.geoChanges.length} signal changes`;
        process.stderr.write(
          `${comparison.newFailures.length} new, ${comparison.resolvedFailures.length} resolved failed checks; GEO: ${geoChangeSummary} across ${comparison.geoComparedPages} comparable page(s), ${comparison.geoUnassessedPages} unassessed\n\n`
        );
      }
      for (const result of batch.results) {
        process.stderr.write(
          result.status === 'complete'
            ? `  ✓ ${result.url} — ${result.report.score === null ? 'N/A' : `${result.report.score}/100`}\n`
            : `  ✗ ${result.url} — ${result.error}\n`
        );
      }
    }

    if (failReasons.length > 0) {
      process.stderr.write(
        `❌ Batch audit did not meet the CI threshold (${failReasons.join('; ')}); exiting with code 1.\n`
      );
      process.exitCode = 1;
    }
    return;
  }

  if (
    (args.failOnDuplicateMetadata ?? envConfig.failOnDuplicateMetadata) ||
    (args.failOnDuplicateContent ?? envConfig.failOnDuplicateContent) ||
    args.failOnHreflang ||
    args.failOnCanonicalChains
  ) {
    process.stderr.write(
      '❌ Duplicate metadata/content, hreflang, and canonical CI gates require --urls, --sitemap, or --crawl batch mode.\n'
    );
    process.exit(2);
  }

  if (!effectiveUrl) {
    printHelp();
    process.exit(1);
    return;
  }

  // Validate URL before launching browser
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(effectiveUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('URL must use http:// or https:// protocol');
    }
  } catch {
    const suggestion = effectiveUrl.startsWith('http')
      ? ''
      : ` Did you mean https://${effectiveUrl}?`;
    process.stderr.write(`❌ Invalid URL: "${effectiveUrl}".${suggestion}\n`);
    process.exit(1);
  }

  let baselineReport: SEOReport | undefined;
  if (baselinePath) {
    try {
      baselineReport = loadBaselineReport(baselinePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`❌ Could not load baseline report "${baselinePath}": ${message}\n`);
      process.exit(2);
    }
  }

  if (!args.json) {
    logger.info('Running SEO check', { url: effectiveUrl });
  }

  // Resolve viewport: CLI --viewport > ENV AVIARY_VIEWPORT > default
  const effectiveViewportStr = args.viewport || envConfig.viewport;
  const viewport = parseViewport(effectiveViewportStr) ?? { width: 1920, height: 1080 };

  // Resolve preset: CLI --preset > ENV AVIARY_PRESET > undefined
  const effectivePreset = args.preset || envConfig.preset;

  // Resolve timeout: CLI --timeout > ENV AVIARY_TIMEOUT > default

  // Resolve headless: CLI --headed (args.headless=false) > ENV AVIARY_HEADLESS > default (true)
  let effectiveHeadless = true;
  if (args.headless === false) {
    effectiveHeadless = false;
  } else if (envConfig.headless !== undefined) {
    effectiveHeadless = envConfig.headless;
  }

  // Build configuration
  let config;
  if (effectivePreset) {
    config = { preset: effectivePreset as 'basic' | 'advanced' | 'strict' | 'geo' };
  }

  logger.debug('SEOChecker configuration', {
    url: effectiveUrl,
    headless: effectiveHeadless,
    viewport,
    preset: effectivePreset,
    configFile: args.config,
  });

  const effectiveOutput = args.output || envConfig.output;
  const comparisonOutput = args.comparisonOutput;
  const effectiveHtmlOutput = args.html || envConfig.htmlOutput;
  const effectivePdfOutput = args.pdf || envConfig.pdfOutput;
  const effectiveHistoryOutput = args.history || envConfig.historyOutput;
  const effectiveJunitOutput = args.junit || envConfig.junitOutput;
  const effectiveSarifOutput = args.sarif || envConfig.sarifOutput;
  const effectiveMarkdownOutput = args.markdown || envConfig.markdownOutput;
  const effectiveCsvOutput = args.csv || envConfig.csvOutput;
  ensureDistinctOutputPaths({
    JSON: effectiveOutput,
    comparison: comparisonOutput,
    'GEO gate JSON': args.geoGateOutput,
    history: effectiveHistoryOutput,
    JUnit: effectiveJunitOutput,
    SARIF: effectiveSarifOutput,
    Markdown: effectiveMarkdownOutput,
    CSV: effectiveCsvOutput,
    HTML: effectiveHtmlOutput,
    PDF: effectivePdfOutput,
  });

  const checker = new SEOChecker({
    url: effectiveUrl,
    headless: effectiveHeadless,
    viewport,
    timeout: effectiveTimeout,
    navigationWaitUntil: args.navigationWaitUntil,
    settleAfterNavigationMs: effectiveSettleAfterNavigationMs,
    configFile: args.config,
    config,
    categories,
  });

  try {
    const report = await checker.check();
    const comparison = baselineReport ? compareSEOReports(report, baselineReport) : undefined;

    if (comparisonOutput && comparison) {
      const dir = path.dirname(comparisonOutput);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(comparisonOutput, JSON.stringify(comparison, null, 2), 'utf8');
      logger.info('JSON baseline comparison saved', { path: comparisonOutput });
    }
    if (args.geoComparisonCsv && comparison) {
      fs.mkdirSync(path.dirname(args.geoComparisonCsv), { recursive: true });
      fs.writeFileSync(
        args.geoComparisonCsv,
        renderGeoSignalChangesCsv({ ...comparison, currentTimestamp: report.timestamp }),
        'utf8'
      );
      logger.info('GEO signal changes CSV saved', { path: args.geoComparisonCsv });
    }

    // Write requested report files before the --json early-return below --
    // both flags are commonly passed together (e.g. the TUI always passes
    // both --json, to parse results back, and --html), and used to silently
    // skip --html/--output entirely because that write lived after this
    // return.
    if (effectiveOutput) {
      const dir = path.dirname(effectiveOutput);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(effectiveOutput, JSON.stringify(report, null, 2), 'utf8');
      logger.info('JSON report saved', { path: effectiveOutput });
    }

    if (effectiveHtmlOutput) {
      generateHtmlReport(report, effectiveHtmlOutput, comparison);
      logger.info('HTML report saved', { path: effectiveHtmlOutput });
    }

    if (effectivePdfOutput) {
      await generatePdfReport(report, effectivePdfOutput, {}, comparison);
      logger.info('PDF report saved', { path: effectivePdfOutput });
    }

    if (effectiveHistoryOutput) {
      appendSEOReportHistory(report, effectiveHistoryOutput);
      logger.info('Audit history appended', { path: effectiveHistoryOutput });
    }

    if (effectiveJunitOutput) {
      generateJunitReport(report, effectiveJunitOutput);
      logger.info('JUnit XML report saved', { path: effectiveJunitOutput });
    }
    if (effectiveSarifOutput) {
      generateSarifReport(report, effectiveSarifOutput);
      logger.info('SARIF report saved', { path: effectiveSarifOutput });
    }

    if (effectiveMarkdownOutput) {
      generateMarkdownReport(report, effectiveMarkdownOutput, comparison);
      logger.info('Markdown report saved', { path: effectiveMarkdownOutput });
    }

    if (effectiveCsvOutput) {
      generateCsvReport(report, effectiveCsvOutput);
      logger.info('CSV report saved', { path: effectiveCsvOutput });
    }

    const failReasons: string[] = [];
    if ((args.failOnFindings ?? envConfig.failOnFindings) && report.summary.failed > 0) {
      failReasons.push(`${report.summary.failed} failed check(s)`);
    }
    if (failOnRegression && comparison) {
      if (comparison.scoreDelta !== null && comparison.scoreDelta < 0) {
        failReasons.push(`score dropped by ${Math.abs(comparison.scoreDelta)} points`);
      }
      if (comparison.newFailures.length > 0) {
        failReasons.push(`${comparison.newFailures.length} newly failed check(s)`);
      }
    }
    if (failOnGeoChange && comparison) {
      const gate = evaluateGate(comparison);
      if (args.geoGateOutput)
        writeGeoGateOutput(args.geoGateOutput, comparison, report.timestamp, gate, report.url);
      failReasons.push(...gateFailureMessages(gate));
    }
    if (failBelowScore !== undefined && (report.score === null || report.score < failBelowScore)) {
      failReasons.push(
        report.score === null
          ? `score unavailable (minimum ${failBelowScore})`
          : `score ${report.score} is below minimum ${failBelowScore}`
      );
    }

    // If JSON output is requested, ONLY print JSON to stdout (12-Factor: clean stdout)
    if (args.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      if (failReasons.length > 0) process.exitCode = 1;
      return;
    }

    // All diagnostic output goes to stderr
    process.stderr.write(`📊 SEO Report for ${report.url}\n\n`);
    process.stderr.write(
      `Score: ${report.score !== null ? `${report.score}/100` : 'N/A (no checks ran)'}\n`
    );
    process.stderr.write(
      'Score summarizes checks run; it is not a search-ranking or GEO-readiness prediction.\n'
    );
    process.stderr.write(`Timestamp: ${report.timestamp}\n\n`);

    process.stderr.write('Summary:\n');
    process.stderr.write(`  Total checks: ${report.summary.total}\n`);
    process.stderr.write(`  ✓ Passed: ${report.summary.passed}\n`);
    process.stderr.write(`  ✗ Failed: ${report.summary.failed}\n\n`);

    if (comparison) {
      const delta =
        comparison.scoreDelta === null
          ? 'N/A'
          : `${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta}`;
      process.stderr.write(
        `Baseline: ${comparison.baselineScore ?? 'N/A'} → ${comparison.currentScore ?? 'N/A'} (${delta}); `
      );
      const gatedChangeCount = evaluateGate(comparison).matchingChanges.length;
      const geoChangeSummary = hasGeoChangeFilters
        ? `${gatedChangeCount} selected of ${comparison.geoChanges.length} signal changes`
        : `${comparison.geoChanges.length} signal changes`;
      process.stderr.write(
        `${comparison.newFailures.length} new, ${comparison.resolvedFailures.length} resolved failed checks; GEO: ${geoChangeSummary}${comparison.geoCompared ? '' : ' (not comparable)'}\n\n`
      );
    }

    const sections = CHECKER_REGISTRY.map(({ key, label }) => ({
      name: label,
      checks: report.checks[key],
    }));

    sections.forEach((section) => {
      process.stderr.write(`${section.name}:\n`);
      section.checks.forEach((check) => {
        const icon = check.passed ? '✓' : '✗';
        const color = check.passed ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';

        // Display severity if present
        let severityBadge = '';
        if (check.severity && !check.passed) {
          const severityColors = {
            error: '\x1b[41m\x1b[37m', // Red background, white text
            warning: '\x1b[43m\x1b[30m', // Yellow background, black text
            info: '\x1b[44m\x1b[37m', // Blue background, white text
          };
          const severityColor = severityColors[check.severity as keyof typeof severityColors];
          severityBadge = ` ${severityColor} ${check.severity.toUpperCase()} ${reset}`;
        }

        process.stderr.write(`  ${color}${icon}${reset} ${check.message}${severityBadge}\n`);

        // --verbose: print details for failed checks
        if (args.verbose && !check.passed && check.details) {
          const detailLines = JSON.stringify(check.details, null, 2)
            .split('\n')
            .map((l) => `      ${l}`);
          process.stderr.write(detailLines.join('\n') + '\n');
        }
      });
      process.stderr.write('\n');
    });

    if (failReasons.length > 0) {
      process.stderr.write(
        `❌ Audit did not meet the CI threshold (${failReasons.join('; ')}); exiting with code 1.\n`
      );
      process.exitCode = 1;
    }

    // By default a completed audit succeeds regardless of its SEO score.
    return;
  } catch (error) {
    const categorized = categorizeError(error);
    logger.debug('Audit failed (raw)', {
      message: categorized.message,
      category: categorized.context.category,
    });
    const friendly: Partial<Record<ErrorCategory, string>> = {
      [ErrorCategory.NETWORK]: `❌ Could not reach ${effectiveUrl}. Check the domain and your network connection.`,
      [ErrorCategory.TIMEOUT]: `❌ Timed out waiting for ${effectiveUrl} to load.`,
    };
    process.stderr.write(
      (friendly[categorized.context.category] ?? `❌ Audit failed: ${categorized.message}`) + '\n'
    );
    process.exit(1);
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`❌ Aviary CLI failed: ${message}\n`);
    process.exitCode = 2;
  });
}
