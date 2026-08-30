import { chromium, Browser, Page, Response } from 'playwright';
import { SEOCheckerOptions, SEOReport, SEOCheckResult } from './types';
import { SEOConfig, ConfigLoader } from './config';
import { calculateWeightedScore } from './scoring';
import { CHECKER_REGISTRY, CheckerContext, CheckerKey } from './checkers/registry';

export class SEOChecker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private response: Response | null = null;
  private config: SEOConfig;

  constructor(private options: SEOCheckerOptions) {
    this.options.headless = options.headless !== false;
    this.options.timeout = options.timeout || 30000;
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
    try {
      await this.launch();
      await this.navigate();

      const checks = await this.runAllCheckers();
      const allChecks = Object.values(checks).flat();
      const passed = allChecks.filter((c) => c.passed).length;
      const failed = allChecks.filter((c) => !c.passed).length;
      const score = calculateWeightedScore(allChecks);

      return {
        url: this.options.url,
        timestamp: new Date().toISOString(),
        checks,
        score,
        summary: {
          total: allChecks.length,
          passed,
          failed,
        },
      };
    } finally {
      await this.close();
    }
  }

  private async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless,
    });

    this.page = await this.browser.newPage({
      viewport: this.options.viewport,
    });

    await this.page.setDefaultTimeout(this.options.timeout!);
  }

  private async navigate(): Promise<void> {
    if (!this.page) {
      throw new Error('Page is not initialized');
    }

    // Navigate and wait for the page to be fully loaded
    // Capture the response for checkers that need HTTP headers
    this.response = await this.page.goto(this.options.url, {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // Additional stability wait
    await this.page.waitForTimeout(1000);
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
    const ctx: CheckerContext = { page: this.page!, response: this.response, config: this.config };
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
  private applyConfigToResults(checkerName: CheckerKey, results: SEOCheckResult[]): SEOCheckResult[] {
    return results.map((result) => {
      if (result.severity) return result;
      const resolved = ConfigLoader.getRuleConfig(this.config, checkerName, result.name ?? '');
      return { ...result, severity: resolved.severity };
    });
  }

  async close(): Promise<void> {
    // A throwing page.close() must not prevent browser.close() from running
    // — otherwise a single closed/crashed page leaks the whole Chromium
    // process for the lifetime of the Node process that spawned it.
    try {
      if (this.page) {
        await this.page.close();
      }
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

export * from './types';
export * from './config';
export { calculateWeightedScore } from './scoring';
export { generateHtmlReport, renderHtmlReport } from './reporter';
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
