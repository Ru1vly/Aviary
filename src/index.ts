import { chromium, Browser, Page, Response } from 'playwright';
import { SEOCheckerOptions, SEOReport, SEOCheckResult } from './types';
import { SEOConfig, ConfigLoader } from './config';
import { calculateWeightedScore } from './scoring';
import { MetaTagsChecker } from './checkers/metaTags';
import { HeadingsChecker } from './checkers/headings';
import { ImagesChecker } from './checkers/images';
import { PerformanceChecker } from './checkers/performance';
import { RobotsTxtChecker } from './checkers/robotsTxt';
import { SitemapChecker } from './checkers/sitemap';
import { SecurityChecker } from './checkers/security';
import { StructuredDataChecker } from './checkers/structuredData';
import { SocialMediaChecker } from './checkers/socialMedia';
import { ContentChecker } from './checkers/content';
import { LinksChecker } from './checkers/links';
import { UIElementsChecker } from './checkers/uiElements';
import { TechnicalChecker } from './checkers/technical';
import { AccessibilityChecker } from './checkers/accessibility';
import { URLFactorsChecker } from './checkers/urlFactors';
import { SpamDetectionChecker } from './checkers/spamDetection';
import { PageQualityChecker } from './checkers/pageQuality';
import { AdvancedImagesChecker } from './checkers/advancedImages';
import { MultimediaChecker } from './checkers/multimedia';
import { CoreWebVitalsChecker } from './checkers/coreWebVitals';
import { AnalyticsChecker } from './checkers/analytics';
import { MobileUXChecker } from './checkers/mobileUX';
import { SchemaValidationChecker } from './checkers/schemaValidation';
import { ResourceOptimizationChecker } from './checkers/resourceOptimization';
import { LegalComplianceChecker } from './checkers/legalCompliance';
import { EcommerceChecker } from './checkers/ecommerce';
import { InternationalizationChecker } from './checkers/internationalization';
import { HeatmapChecker } from './checkers/heatmap';

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

      // Run all checkers
      const results = await this.runAllCheckers();

      // Apply configuration to filter and modify results
      const { metaTags, headings, images, performance, robotsTxt, sitemap, security, structuredData, socialMedia, content, links, uiElements, technical, accessibility, urlFactors, spamDetection, pageQuality, advancedImages, multimedia, coreWebVitals, analytics, mobileUX, schemaValidation, resourceOptimization, legalCompliance, ecommerce, internationalization, heatmap } = results;

      const allChecks = [...metaTags, ...headings, ...images, ...performance, ...robotsTxt, ...sitemap, ...security, ...structuredData, ...socialMedia, ...content, ...links, ...uiElements, ...technical, ...accessibility, ...urlFactors, ...spamDetection, ...pageQuality, ...advancedImages, ...multimedia, ...coreWebVitals, ...analytics, ...mobileUX, ...schemaValidation, ...resourceOptimization, ...legalCompliance, ...ecommerce, ...internationalization, ...heatmap];
      const passed = allChecks.filter((c) => c.passed).length;
      const failed = allChecks.filter((c) => !c.passed).length;
      const score = calculateWeightedScore(allChecks);

      return {
        url: this.options.url,
        timestamp: new Date().toISOString(),
        checks: {
          metaTags,
          headings,
          images,
          performance,
          robotsTxt,
          sitemap,
          security,
          structuredData,
          socialMedia,
          content,
          links,
          uiElements,
          technical,
          accessibility,
          urlFactors,
          spamDetection,
          pageQuality,
          advancedImages,
          multimedia,
          coreWebVitals,
          analytics,
          mobileUX,
          schemaValidation,
          resourceOptimization,
          legalCompliance,
          ecommerce,
          internationalization,
          heatmap,
        },
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
   * Run all checkers and apply configuration
   */
  private async runAllCheckers() {
    const metaTagsChecker = new MetaTagsChecker(this.page!);
    const headingsChecker = new HeadingsChecker(this.page!);
    const imagesChecker = new ImagesChecker(this.page!);
    const performanceChecker = new PerformanceChecker(this.page!);
    const robotsTxtChecker = new RobotsTxtChecker(this.page!);
    const sitemapChecker = new SitemapChecker(this.page!);
    const securityChecker = new SecurityChecker(this.page!, this.response);
    const structuredDataChecker = new StructuredDataChecker(this.page!);
    const socialMediaChecker = new SocialMediaChecker(this.page!);
    const contentChecker = new ContentChecker(this.page!);
    const linksChecker = new LinksChecker(this.page!);
    const uiElementsChecker = new UIElementsChecker(this.page!);
    const technicalChecker = new TechnicalChecker(this.page!, this.response);
    const accessibilityChecker = new AccessibilityChecker(this.page!);
    const urlFactorsChecker = new URLFactorsChecker(this.page!);
    const spamDetectionChecker = new SpamDetectionChecker(this.page!);
    const pageQualityChecker = new PageQualityChecker(this.page!);
    const advancedImagesChecker = new AdvancedImagesChecker(this.page!);
    const multimediaChecker = new MultimediaChecker(this.page!);
    const coreWebVitalsChecker = new CoreWebVitalsChecker(this.page!, this.response);
    const analyticsChecker = new AnalyticsChecker(this.page!);
    const mobileUXChecker = new MobileUXChecker(this.page!);
    const schemaValidationChecker = new SchemaValidationChecker(this.page!);
    const resourceOptimizationChecker = new ResourceOptimizationChecker(this.page!);
    const legalComplianceChecker = new LegalComplianceChecker(this.page!);
    const ecommerceChecker = new EcommerceChecker(this.page!);
    const internationalizationChecker = new InternationalizationChecker(this.page!);
    const heatmapChecker = new HeatmapChecker(this.page!);

    // Run checkers in parallel, but only if they're enabled
    const checkerPromises = [];

    if (ConfigLoader.isCheckerEnabled(this.config, 'metaTags')) {
      checkerPromises.push(this.safeCheckAll('metaTags', metaTagsChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'headings')) {
      checkerPromises.push(this.safeCheckAll('headings', headingsChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'images')) {
      checkerPromises.push(this.safeCheckAll('images', imagesChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'performance')) {
      checkerPromises.push(this.safeCheckAll('performance', performanceChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'robotsTxt')) {
      checkerPromises.push(this.safeCheckAll('robotsTxt', robotsTxtChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'sitemap')) {
      checkerPromises.push(this.safeCheckAll('sitemap', sitemapChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'security')) {
      checkerPromises.push(this.safeCheckAll('security', securityChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'structuredData')) {
      checkerPromises.push(this.safeCheckAll('structuredData', structuredDataChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'socialMedia')) {
      checkerPromises.push(this.safeCheckAll('socialMedia', socialMediaChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'content')) {
      checkerPromises.push(this.safeCheckAll('content', contentChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'links')) {
      checkerPromises.push(this.safeCheckAll('links', linksChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'uiElements')) {
      checkerPromises.push(this.safeCheckAll('uiElements', uiElementsChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'technical')) {
      checkerPromises.push(this.safeCheckAll('technical', technicalChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'accessibility')) {
      checkerPromises.push(this.safeCheckAll('accessibility', accessibilityChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'urlFactors')) {
      checkerPromises.push(this.safeCheckAll('urlFactors', urlFactorsChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'spamDetection')) {
      checkerPromises.push(this.safeCheckAll('spamDetection', spamDetectionChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'pageQuality')) {
      checkerPromises.push(this.safeCheckAll('pageQuality', pageQualityChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'advancedImages')) {
      checkerPromises.push(this.safeCheckAll('advancedImages', advancedImagesChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'multimedia')) {
      checkerPromises.push(this.safeCheckAll('multimedia', multimediaChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'coreWebVitals')) {
      checkerPromises.push(this.safeCheckAll('coreWebVitals', coreWebVitalsChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'analytics')) {
      checkerPromises.push(this.safeCheckAll('analytics', analyticsChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'mobileUX')) {
      checkerPromises.push(this.safeCheckAll('mobileUX', mobileUXChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'schemaValidation')) {
      checkerPromises.push(this.safeCheckAll('schemaValidation', schemaValidationChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'resourceOptimization')) {
      checkerPromises.push(this.safeCheckAll('resourceOptimization', resourceOptimizationChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'legalCompliance')) {
      checkerPromises.push(this.safeCheckAll('legalCompliance', legalComplianceChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'ecommerce')) {
      checkerPromises.push(this.safeCheckAll('ecommerce', ecommerceChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'internationalization')) {
      checkerPromises.push(this.safeCheckAll('internationalization', internationalizationChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    if (ConfigLoader.isCheckerEnabled(this.config, 'heatmap')) {
      checkerPromises.push(this.safeCheckAll('heatmap', heatmapChecker.checkAll()));
    } else {
      checkerPromises.push(Promise.resolve([]));
    }

    const [metaTags, headings, images, performance, robotsTxt, sitemap, security, structuredData, socialMedia, content, links, uiElements, technical, accessibility, urlFactors, spamDetection, pageQuality, advancedImages, multimedia, coreWebVitals, analytics, mobileUX, schemaValidation, resourceOptimization, legalCompliance, ecommerce, internationalization, heatmap] = await Promise.all(checkerPromises);

    // Apply severity levels to results
    return {
      metaTags: this.applyConfigToResults('metaTags', metaTags),
      headings: this.applyConfigToResults('headings', headings),
      images: this.applyConfigToResults('images', images),
      performance: this.applyConfigToResults('performance', performance),
      robotsTxt: this.applyConfigToResults('robotsTxt', robotsTxt),
      sitemap: this.applyConfigToResults('sitemap', sitemap),
      security: this.applyConfigToResults('security', security),
      structuredData: this.applyConfigToResults('structuredData', structuredData),
      socialMedia: this.applyConfigToResults('socialMedia', socialMedia),
      content: this.applyConfigToResults('content', content),
      links: this.applyConfigToResults('links', links),
      uiElements: this.applyConfigToResults('uiElements', uiElements),
      technical: this.applyConfigToResults('technical', technical),
      accessibility: this.applyConfigToResults('accessibility', accessibility),
      urlFactors: this.applyConfigToResults('urlFactors', urlFactors),
      spamDetection: this.applyConfigToResults('spamDetection', spamDetection),
      pageQuality: this.applyConfigToResults('pageQuality', pageQuality),
      advancedImages: this.applyConfigToResults('advancedImages', advancedImages),
      multimedia: this.applyConfigToResults('multimedia', multimedia),
      coreWebVitals: this.applyConfigToResults('coreWebVitals', coreWebVitals),
      analytics: this.applyConfigToResults('analytics', analytics),
      mobileUX: this.applyConfigToResults('mobileUX', mobileUX),
      schemaValidation: this.applyConfigToResults('schemaValidation', schemaValidation),
      resourceOptimization: this.applyConfigToResults('resourceOptimization', resourceOptimization),
      legalCompliance: this.applyConfigToResults('legalCompliance', legalCompliance),
      ecommerce: this.applyConfigToResults('ecommerce', ecommerce),
      internationalization: this.applyConfigToResults('internationalization', internationalization),
      heatmap: this.applyConfigToResults('heatmap', heatmap),
    };
  }

  /**
   * Apply configuration to check results (severity levels, filtering)
   */
  private applyConfigToResults(checkerName: string, results: SEOCheckResult[]): SEOCheckResult[] {
    return results.map((result) => {
      // Apply default severity if not already set
      if (!result.severity) {
        result.severity = this.config.severity || 'warning';
      }
      return result;
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
