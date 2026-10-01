import * as fs from 'fs';
import * as path from 'path';
import { Browser, Page, Response } from 'playwright';
import { autoInstallAviaryChromium, launchAviaryBrowser } from './browser';
import type {
  SEOCheckerOptions,
  SEOReport,
  SEOCheckResult,
  SEOAuditBatchOptions,
  SEOAuditWatchOptions,
  SEOAuditBatchReport,
  SEOAuditBatchResult,
} from './types';
import { SEOConfig, ConfigLoader } from './config';
import { calculateWeightedScore } from './scoring';
import { CHECKER_REGISTRY, CheckerContext, CheckerKey } from './checkers/registry';

/**
 * web-vitals' IIFE build declares `var webVitals = ...` at its top level,
 * relying on non-module top-level `var` becoming a `window` property — true
 * for a plain inline `<script>`, but Playwright's `page.addInitScript()`
 * evaluates its source inside a wrapper function (confirmed empirically:
 * `{ path }` alone leaves `window.webVitals` undefined), so the `var` stays
 * local to that wrapper and never reaches `window`. Fix: read the file
 * ourselves and append an explicit `window.webVitals = webVitals;` in the
 * same script string — same wrapper scope, so the appended line still sees
 * the `var` declared earlier in that same source, and this time assigns
 * through `window` explicitly rather than relying on implicit global leakage.
 *
 * Also: web-vitals' package.json `exports` map only exposes its ESM/UMD
 * entry points (for `import`/`require` from Node), not this IIFE build — so
 * `require.resolve('web-vitals/dist/web-vitals.iife.js')` is blocked with
 * ERR_PACKAGE_PATH_NOT_EXPORTED. The IIFE file exists on disk next to the
 * UMD entry point that *is* exported, so resolve that (a real, supported
 * entry point) and rewrite the filename — this only touches the filesystem
 * path, not module resolution.
 */
function loadWebVitalsInitScriptSource(): string {
  const umdEntry = require.resolve('web-vitals');
  const iifePath = path.join(path.dirname(umdEntry), 'web-vitals.iife.js');
  return fs.readFileSync(iifePath, 'utf8') + '\nwindow.webVitals = webVitals;';
}

/**
 * Runs in the page before any application script. Calls web-vitals' onLCP/
 * onCLS/onFCP/onTTFB with `reportAllChanges: true` and stores the latest
 * reported value of each on `window.__aviaryCWV` — see the long comment on
 * the `coreWebVitals` registry entry for why `reportAllChanges` is required
 * here (these audits never trigger the library's normal "final value"
 * event) and why INP has no entry (it needs a real user interaction this
 * audit never performs; `totalBlockingTime` below is the substitute).
 * Also aggregates `PerformanceObserver('longtask')` entries into
 * `totalBlockingTime`, the standard Total Blocking Time definition (time
 * over the 50ms long-task threshold), as a lab proxy for interactivity.
 */
function cwvCollectorInitScript(): void {
  (window as unknown as { __aviaryCWV: Record<string, number> }).__aviaryCWV = {
    totalBlockingTime: 0,
  };
  const store = (window as unknown as { __aviaryCWV: Record<string, number> }).__aviaryCWV;

  const wv = (
    window as unknown as {
      webVitals?: Record<
        string,
        (cb: (m: { value: number }) => void, opts?: { reportAllChanges: boolean }) => void
      >;
    }
  ).webVitals;
  if (wv) {
    const report = (key: string) => (metric: { value: number }) => {
      store[key] = metric.value;
    };
    wv.onLCP?.(report('lcp'), { reportAllChanges: true });
    wv.onCLS?.(report('cls'), { reportAllChanges: true });
    wv.onFCP?.(report('fcp'), { reportAllChanges: true });
    wv.onTTFB?.(report('ttfb'), { reportAllChanges: true });
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const blocking = entry.duration - 50;
        if (blocking > 0) store.totalBlockingTime += blocking;
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    // longtask entry type unsupported in this browser — totalBlockingTime stays 0.
  }
}

export class SEOChecker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private response: Response | null = null;
  private ownsBrowser: boolean;
  private config: SEOConfig;

  constructor(
    private options: SEOCheckerOptions,
    sharedBrowser?: Browser
  ) {
    this.browser = sharedBrowser ?? null;
    this.ownsBrowser = !sharedBrowser;
    this.options.headless = options.headless !== false;
    this.options.timeout = options.timeout || 30000;
    this.options.navigationWaitUntil = options.navigationWaitUntil || 'networkidle';
    const settleAfterNavigationMs = options.settleAfterNavigationMs ?? 1000;
    if (
      !Number.isInteger(settleAfterNavigationMs) ||
      settleAfterNavigationMs < 0 ||
      settleAfterNavigationMs > 30_000
    ) {
      throw new Error('settleAfterNavigationMs must be an integer from 0 to 30000.');
    }
    this.options.settleAfterNavigationMs = settleAfterNavigationMs;
    this.options.viewport = options.viewport || { width: 1920, height: 1080 };

    // Load configuration
    if (options.configFile) {
      this.config = ConfigLoader.loadFromFile(options.configFile);
    } else if (options.config) {
      this.config = ConfigLoader.loadFromObject(options.config);
    } else {
      // Try to find config file in default locations
      const foundConfig = ConfigLoader.findAndLoad();
      this.config = foundConfig || { severity: 'warning' };
    }
  }

  async check(): Promise<SEOReport> {
    const signal = this.options.signal;
    let abortClose: Promise<void> | undefined;
    const closePageOnAbort = (): void => {
      const page = this.page;
      if (page && !page.isClosed()) abortClose ??= page.close().catch(() => undefined);
    };
    try {
      if (signal?.aborted) throw new Error('Audit was cancelled.');
      await this.launch();
      if (signal) {
        signal.addEventListener('abort', closePageOnAbort, { once: true });
        if (signal.aborted) closePageOnAbort();
      }
      if (signal?.aborted) throw new Error('Audit was cancelled.');
      await this.navigate();

      const checks = await this.runAllCheckers();
      const allChecks = Object.values(checks).flat();
      const passed = allChecks.filter((c) => c.passed).length;
      const failed = allChecks.filter((c) => !c.passed).length;
      const score = calculateWeightedScore(allChecks);

      return {
        url: this.options.url,
        timestamp: new Date().toISOString(),
        navigationWaitUntil: this.options.navigationWaitUntil,
        settleAfterNavigationMs: this.options.settleAfterNavigationMs,
        ...(this.options.categories ? { categories: [...new Set(this.options.categories)] } : {}),
        checks,
        score,
        summary: {
          total: allChecks.length,
          passed,
          failed,
        },
      };
    } finally {
      signal?.removeEventListener('abort', closePageOnAbort);
      if (abortClose) await abortClose;
      await this.close();
    }
  }

  private async launch(): Promise<void> {
    if (!this.browser) this.browser = await this.launchBrowser();

    this.page = await this.browser.newPage({
      viewport: this.options.viewport,
      userAgent: this.options.userAgent,
    });

    await this.page.setDefaultTimeout(this.options.timeout!);

    // Must run before navigate() — LCP/CLS/FCP observers only see entries
    // dispatched after they attach, so they have to exist before the page
    // we're auditing starts loading. Gated on the checker being enabled so
    // audits that don't want it don't pay for a third-party script load.
    if (ConfigLoader.isCheckerEnabled(this.config, 'coreWebVitals')) {
      await this.page.addInitScript({ content: loadWebVitalsInitScriptSource() });
      await this.page.addInitScript(cwvCollectorInitScript);
    }
  }

  private async launchBrowser(): Promise<Browser> {
    return launchAviaryBrowser({
      headless: this.options.headless !== false,
      installChromium: () => this.autoInstallChromium(),
    });
  }

  private autoInstallChromium(): boolean {
    return autoInstallAviaryChromium();
  }

  private async navigate(): Promise<void> {
    if (!this.page) {
      throw new Error('Page is not initialized');
    }

    // Navigate and wait for the configured readiness condition.
    // Capture the response for checkers that need HTTP headers
    this.response = await this.page.goto(this.options.url, {
      waitUntil: this.options.navigationWaitUntil,
      timeout: this.options.timeout,
    });

    // Let client-rendered content settle after the browser readiness event.
    const settleAfterNavigationMs = this.options.settleAfterNavigationMs ?? 1000;
    if (settleAfterNavigationMs > 0) {
      await this.page.waitForTimeout(settleAfterNavigationMs);
    }
  }

  /**
   * Run a single checker's checkAll(), converting a thrown/rejected error
   * into one failed result instead of letting it propagate. Without this,
   * a single checker throwing (e.g. from a page.evaluate() that runs during
   * navigation and hits a destroyed execution context) would fail the
   * entire audit via Promise.all, taking every other checker's results
   * down with it.
   */
  private async safeCheckAll(
    checkerName: string,
    promise: Promise<SEOCheckResult[]>
  ): Promise<SEOCheckResult[]> {
    try {
      return await promise;
    } catch (err) {
      return [
        {
          passed: false,
          message: `${checkerName} checker crashed: ${(err as Error).message}`,
          severity: 'error',
        },
      ];
    }
  }

  /**
   * Run all checkers (skipping disabled ones per config) and apply
   * severity configuration to their results.
   */
  private async runAllCheckers(): Promise<SEOReport['checks']> {
    const ctx: CheckerContext = {
      page: this.page!,
      response: this.response,
      config: this.config,
      sitewideTargetIndexes: this.options.sitewideTargetIndexes,
    };
    const requested = this.options.categories;

    const resultsByKey = await Promise.all(
      CHECKER_REGISTRY.map(async ({ key, create }): Promise<[CheckerKey, SEOCheckResult[]]> => {
        if (requested && !requested.includes(key)) {
          return [key, []];
        }
        if (!ConfigLoader.isCheckerEnabled(this.config, key)) {
          return [key, []];
        }
        const results = await this.safeCheckAll(key, create(ctx).checkAll());
        return [key, this.applyConfigToResults(key, results)];
      })
    );

    return Object.fromEntries(resultsByKey) as SEOReport['checks'];
  }

  /**
   * Apply configuration to check results (severity levels).
   *
   * A result that already has a severity (set by the checker itself, or by
   * a rule-level config resolution once a checker migrates onto
   * BaseChecker — see src/checkers/base.ts) keeps it. Otherwise this falls
   * back through checker-level config (e.g. `coreWebVitals: { severity:
   * 'warning' }` in a preset) to the global default — not just the global
   * default outright, which is what this used to do regardless of
   * `checkerName`.
   */
  private applyConfigToResults(
    checkerName: CheckerKey,
    results: SEOCheckResult[]
  ): SEOCheckResult[] {
    return results.map((result) => {
      if (result.severity) return result;
      const resolved = ConfigLoader.getRuleConfig(this.config, checkerName, result.name ?? '');
      return { ...result, severity: resolved.severity };
    });
  }

  async close(): Promise<void> {
    // A throwing page.close() must not prevent an owned browser from closing.
    // Batch workers only close their page; auditUrls closes the shared browser pool.
    try {
      if (this.page) {
        if (!this.page.isClosed()) await this.page.close();
      }
    } finally {
      this.page = null;
      this.response = null;
      if (this.browser && this.ownsBrowser) {
        const browser = this.browser;
        this.browser = null;
        await browser.close();
      }
    }
  }

  /** @internal Launch a reusable browser for bounded batch workers. */
  static async launchSharedBrowser(headless = true): Promise<Browser> {
    const launcher = new SEOChecker({ url: 'about:blank', headless });
    return launcher.launchBrowser();
  }
}

/** Run independent audits with bounded browser concurrency and per-URL outcomes. */
export async function auditUrls(
  urls: string[],
  options: SEOAuditBatchOptions = {}
): Promise<SEOAuditBatchReport> {
  if (!Array.isArray(urls)) throw new Error('The URL list must be an array of strings.');
  if (urls.length === 0) throw new Error('At least one URL is required.');

  const { concurrency = 2, onProgress, signal, ...checkerOptions } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error('Audit concurrency must be an integer from 1 to 8.');
  }

  const targets = urls.map((input, index) => {
    if (typeof input !== 'string')
      throw new Error(`URL at position ${index + 1} must be a string.`);
    const candidate = input.trim();
    if (!candidate) throw new Error('The URL list contains an empty entry.');
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(`Invalid URL in batch: "${candidate}".`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Unsupported URL protocol in batch: "${candidate}".`);
    }
    return url.href;
  });
  const sitewideTargetIndexes = new Map<string, number>();
  targets.forEach((url, index) => {
    const graphUrl = new URL(url);
    graphUrl.hash = '';
    if (!sitewideTargetIndexes.has(graphUrl.href)) sitewideTargetIndexes.set(graphUrl.href, index);
  });

  const results: Array<SEOAuditBatchResult | undefined> = new Array(targets.length);
  let nextIndex = 0;
  let progressCount = 0;
  const notifyProgress = (result: SEOAuditBatchResult): void => {
    progressCount += 1;
    try {
      onProgress?.({ completedUrls: progressCount, requestedUrls: targets.length, result });
    } catch {
      // Progress observers must not cancel or alter audit results.
    }
  };

  if (signal?.aborted) {
    const cancelledResults: SEOAuditBatchResult[] = targets.map((url) => ({
      status: 'error',
      url,
      error: 'Audit was cancelled before it started.',
    }));
    cancelledResults.forEach(notifyProgress);
    return {
      timestamp: new Date().toISOString(),
      summary: {
        requestedUrls: targets.length,
        concurrency: 0,
        completedUrls: 0,
        failedUrls: targets.length,
        passedChecks: 0,
        failedChecks: 0,
        averageScore: null,
      },
      results: cancelledResults,
    };
  }

  const requestedWorkers = Math.min(concurrency, targets.length);
  const browserPool: Browser[] = [];
  try {
    // Start one browser first so a missing-browser install is attempted once;
    // then grow the pool in parallel where the host has enough resources.
    browserPool.push(await SEOChecker.launchSharedBrowser(checkerOptions.headless !== false));
    const additionalBrowsers = await Promise.allSettled(
      Array.from({ length: requestedWorkers - 1 }, () =>
        SEOChecker.launchSharedBrowser(checkerOptions.headless !== false)
      )
    );
    for (const result of additionalBrowsers) {
      if (result.status === 'fulfilled') browserPool.push(result.value);
    }
  } catch (error) {
    const message = signal?.aborted
      ? 'Audit was cancelled before browser startup.'
      : error instanceof Error
        ? error.message
        : String(error);
    const failedResults: SEOAuditBatchResult[] = targets.map((url) => ({
      status: 'error',
      url,
      error: message,
    }));
    failedResults.forEach(notifyProgress);
    return {
      timestamp: new Date().toISOString(),
      summary: {
        requestedUrls: targets.length,
        concurrency: 0,
        completedUrls: 0,
        failedUrls: targets.length,
        passedChecks: 0,
        failedChecks: 0,
        averageScore: null,
      },
      results: failedResults,
    };
  }

  const worker = async (browser: Browser): Promise<void> => {
    let workerBrowser = browser;
    while (!signal?.aborted) {
      const index = nextIndex++;
      if (index >= targets.length) return;
      const url = targets[index];
      if (!workerBrowser.isConnected()) {
        try {
          const disconnectedBrowser = workerBrowser;
          workerBrowser = await SEOChecker.launchSharedBrowser(checkerOptions.headless !== false);
          const disconnectedIndex = browserPool.indexOf(disconnectedBrowser);
          if (disconnectedIndex !== -1) browserPool.splice(disconnectedIndex, 1);
          browserPool.push(workerBrowser);
        } catch (error) {
          const result: SEOAuditBatchResult = {
            status: 'error',
            url,
            error: error instanceof Error ? error.message : String(error),
          };
          results[index] = result;
          notifyProgress(result);
          continue;
        }
      }
      try {
        const report = await new SEOChecker(
          { ...checkerOptions, url, signal, sitewideTargetIndexes },
          workerBrowser
        ).check();
        const result: SEOAuditBatchResult = { status: 'complete', url, report };
        results[index] = result;
        notifyProgress(result);
      } catch (error) {
        const result: SEOAuditBatchResult = {
          status: 'error',
          url,
          error: signal?.aborted
            ? 'Audit was cancelled.'
            : error instanceof Error
              ? error.message
              : String(error),
        };
        results[index] = result;
        notifyProgress(result);
      }
    }
  };

  const actualConcurrency = browserPool.length;
  try {
    await Promise.all(browserPool.map(worker));
  } finally {
    await Promise.allSettled(browserPool.map((browser) => browser.close()));
  }
  for (let index = 0; index < targets.length; index += 1) {
    if (results[index]) continue;
    const result: SEOAuditBatchResult = {
      status: 'error',
      url: targets[index]!,
      error: 'Audit was cancelled before this URL started.',
    };
    results[index] = result;
    notifyProgress(result);
  }
  const finalizedResults = results.filter(
    (result): result is SEOAuditBatchResult => result !== undefined
  );
  const completed = finalizedResults.filter(
    (result): result is Extract<SEOAuditBatchResult, { status: 'complete' }> =>
      result.status === 'complete'
  );
  const scores = completed
    .map(({ report }) => report.score)
    .filter((score): score is number => score !== null);

  return {
    timestamp: new Date().toISOString(),
    summary: {
      requestedUrls: targets.length,
      concurrency: actualConcurrency,
      completedUrls: completed.length,
      failedUrls: targets.length - completed.length,
      passedChecks: completed.reduce((total, { report }) => total + report.summary.passed, 0),
      failedChecks: completed.reduce((total, { report }) => total + report.summary.failed, 0),
      averageScore:
        scores.length > 0
          ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
          : null,
    },
    results: finalizedResults,
  };
}

function waitForWatchInterval(intervalMs: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (continueWatching: boolean): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(continueWatching);
    };
    const onAbort = (): void => finish(false);
    timer = setTimeout(() => finish(true), intervalMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

/** Run non-overlapping batch audits from a fixed URL list or an async URL source. */
export async function watchUrls(
  urls: string[] | (() => Promise<string[]>),
  options: SEOAuditWatchOptions
): Promise<void> {
  const { intervalMs, signal, onAudit, ...auditOptions } = options;
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 2_147_483_647) {
    throw new Error(
      'Watch interval must be a positive integer no greater than 2,147,483,647 milliseconds.'
    );
  }

  while (!signal?.aborted) {
    const currentUrls = typeof urls === 'function' ? await urls() : urls;
    if (signal?.aborted) return;
    const batch = await auditUrls(currentUrls, auditOptions);
    try {
      await onAudit?.(batch);
    } catch {
      // An observer error must not cancel future scheduled audits.
    }
    if (signal?.aborted || !(await waitForWatchInterval(intervalMs, signal))) return;
  }
}

export * from './types';
export * from './config';
export * from './history';
export * from './crawler';
export * from './sitewide';
export { AVIARY_CRAWLER_USER_AGENT, parseRobotsTxtPolicy } from './robots';
export type { RobotsDecision, RobotsPolicy } from './robots';
export * from './geo/bingAiPerformance';
export * from './geo/bingAiWorkbook';
export * from './geo/bingAiReporter';
export * from './geo/googleAiPerformance';
export * from './geo/googleAiWorkbook';
export * from './geo/googleAiReporter';
export * from './geo/googleSurfaceMatrix';
export * from './geo/googleSurfaceMatrixReporter';
export * from './geo/platformMatrix';
export * from './geo/platformMatrixReporter';
export * from './geo/aiCrawlerLogs';
export * from './geo/aiCrawlerLogComparison';
export * from './geo/aiCrawlerLogsReporter';
export * from './geo/aiCrawlerPathFamilies';
export * from './geo/answerCitationObservations';
export * from './geo/answerCitationObservationsReporter';
export * from './geo/answerCitationPromptSimilarity';
export * from './geo/answerCitationDomainPairedReach';
export * from './geo/answerCitationPagePairedReach';
export * from './geo/entityPromptMatchedCitationAssociation';
export {
  renderAiAnswerCitationSourceRarefactionCsv,
  renderAiAnswerCitationSourceRarefactionPanelHtml,
} from './geo/answerCitationSourceRarefaction';
export type { AiAnswerCitationSourceRarefactionSamplingMetadata } from './geo/answerCitationSourceRarefaction';
export * from './geo/answerCitationSourceDiversityUncertainty';
export * from './geo/answerCitationProviderSourceDivergence';
export * from './geo/answerCitationSourcePortfolioDrift';
export * from './geo/answerCitationSourceNetwork';
export * from './geo/answerCitationRankWeightedSourceNetwork';
export * from './geo/answerCitationSourceNetworkReporter';
export * from './geo/answerCitationSourceNetworkComparisonReporter';
export * from './geo/answerCitationProviderSourceNetworkOverlap';
export * from './geo/answerCitationProviderSourceNetworkEdgeDrift';
export * from './geo/answerCitationProviderSourceNetworkEdgeDriftReporter';
export * from './geo/answerCitationOwnedSourceNetworkGaps';
export * from './geo/answerCitationProviderSourceNetworkEdgeReporter';
export * from './api/server';
export * from './api/client';
export { generateSEORecommendations } from './recommendations';
export type {
  SEORecommendation,
  SEORecommendationPriority,
  SEORecommendationExample,
} from './recommendations';
export {
  calculateWeightedScore,
  compareSEOReports,
  compareSEOAuditBatches,
  compareSEOWithCompetitors,
  filterSEOAuditGeoSignalChanges,
  evaluateSEOAuditGeoChangeGate,
  GEO_COMPARABILITY_BASIS,
  GEO_COMPARISON_SCHEMA_VERSION,
} from './scoring';
export type { SEOAuditGeoSignalFilters } from './scoring';
export type {
  SEOReportComparison,
  SEOAuditBatchComparison,
  SEOAuditGeoSignalChange,
  SEOAuditGeoGateEvaluation,
  SEOAuditGeoGateFailureCode,
  SEOAuditGeoGateFailureReason,
  SEOReportFinding,
  SEOCompetitorComparison,
  SEOCompetitorFinding,
  SEOCompetitorScore,
} from './scoring';
export {
  generateHtmlReport,
  renderHtmlReport,
  generatePdfReport,
  renderPdfReport,
  generateJunitReport,
  renderJunitReport,
  generateSarifReport,
  renderSarifReport,
  generateMarkdownReport,
  renderMarkdownReport,
  generateCsvReport,
  renderCsvReport,
  generateBatchJunitReport,
  renderBatchJunitReport,
  generateBatchSarifReport,
  renderBatchSarifReport,
  generateBatchMarkdownReport,
  renderBatchMarkdownReport,
  generateBatchHtmlReport,
  renderBatchHtmlReport,
  generateBatchPdfReport,
  renderBatchPdfReport,
  generateBatchCsvReport,
  renderBatchCsvReport,
  renderSEOCompetitorMarkdownReport,
  generateSEOCompetitorMarkdownReport,
} from './reporter';
export type { PdfReportOptions } from './reporter';
export { CHECKER_REGISTRY } from './checkers/registry';
export type { CheckerContext, CheckerDescriptor, CheckerKey } from './checkers/registry';
export { MetaTagsChecker } from './checkers/metaTags';
export { HeadingsChecker } from './checkers/headings';
export { ImagesChecker } from './checkers/images';
export { PerformanceChecker } from './checkers/performance';
export { RobotsTxtChecker } from './checkers/robotsTxt';
export { SitemapChecker } from './checkers/sitemap';
export { SecurityChecker } from './checkers/security';
export { StructuredDataChecker } from './checkers/structuredData';
export { SocialMediaChecker } from './checkers/socialMedia';
export { ContentChecker } from './checkers/content';
export { LinksChecker } from './checkers/links';
export { UIElementsChecker } from './checkers/uiElements';
export { TechnicalChecker } from './checkers/technical';
export { AccessibilityChecker } from './checkers/accessibility';
export { URLFactorsChecker } from './checkers/urlFactors';
export { SpamDetectionChecker } from './checkers/spamDetection';
export { PageQualityChecker } from './checkers/pageQuality';
export { AdvancedImagesChecker } from './checkers/advancedImages';
export { MultimediaChecker } from './checkers/multimedia';
export { CoreWebVitalsChecker } from './checkers/coreWebVitals';
export { AnalyticsChecker } from './checkers/analytics';
export { MobileUXChecker } from './checkers/mobileUX';
export { SchemaValidationChecker } from './checkers/schemaValidation';
export { ResourceOptimizationChecker } from './checkers/resourceOptimization';
export { LegalComplianceChecker } from './checkers/legalCompliance';
export { EcommerceChecker } from './checkers/ecommerce';
export { InternationalizationChecker } from './checkers/internationalization';
export { HeatmapChecker } from './checkers/heatmap';
export { GeoChecker } from './checkers/geo';
export * from './geo/googleAiCitationConcordance';
export * from './geo/googleAiCitationConcordanceComparison';
