import { Page, Response } from 'playwright';
import { SEOCheckResult, SEOReport } from '../types';
import { SEOConfig } from '../config';
import { MetaTagsChecker } from './metaTags';
import { HeadingsChecker } from './headings';
import { ImagesChecker } from './images';
import { PerformanceChecker } from './performance';
import { RobotsTxtChecker } from './robotsTxt';
import { SitemapChecker } from './sitemap';
import { SecurityChecker } from './security';
import { StructuredDataChecker } from './structuredData';
import { SocialMediaChecker } from './socialMedia';
import { ContentChecker } from './content';
import { LinksChecker } from './links';
import { UIElementsChecker } from './uiElements';
import { TechnicalChecker } from './technical';
import { AccessibilityChecker } from './accessibility';
import { URLFactorsChecker } from './urlFactors';
import { SpamDetectionChecker } from './spamDetection';
import { PageQualityChecker } from './pageQuality';
import { AdvancedImagesChecker } from './advancedImages';
import { MultimediaChecker } from './multimedia';
import { CoreWebVitalsChecker } from './coreWebVitals';
import { AnalyticsChecker } from './analytics';
import { MobileUXChecker } from './mobileUX';
import { SchemaValidationChecker } from './schemaValidation';
import { ResourceOptimizationChecker } from './resourceOptimization';
import { LegalComplianceChecker } from './legalCompliance';
import { EcommerceChecker } from './ecommerce';
import { InternationalizationChecker } from './internationalization';
import { HeatmapChecker } from './heatmap';

/** What every checker needs to be constructed, regardless of which subset it actually uses. */
export interface CheckerContext {
  page: Page;
  response: Response | null;
  /**
   * The resolved SEOConfig for this audit. Only consumed by checkers that
   * extend BaseChecker (src/checkers/base.ts), which resolves per-rule
   * enable/severity itself; checkers that haven't migrated yet ignore it —
   * SEOChecker.applyConfigToResults() still does that resolution for them
   * as a post-hoc fallback (see src/index.ts).
   */
  config: SEOConfig;
}

export interface Checker {
  checkAll(): Promise<SEOCheckResult[]>;
}

export type CheckerKey = keyof SEOReport['checks'];

export interface CheckerDescriptor {
  key: CheckerKey;
  label: string;
  icon: string;
  create: (ctx: CheckerContext) => Checker;
}

/**
 * Single source of truth for the 28 checkers: which class implements each
 * category, its display label/icon, and how to construct it.
 *
 * Before this existed, the same 28-item list (in the same order, so one
 * misordered entry would silently mislabel a whole category) was
 * hand-maintained in four places: SEOChecker.runAllCheckers() and the
 * report-object construction in src/index.ts, the `sections` array in
 * src/cli.ts, and the `SECTIONS` array in src/reporter.ts. The first three
 * now derive from this array; tui/src/main.rs's populate_categories()
 * cannot import a TS module, so it stays a hand-maintained fourth copy,
 * guarded by tests/unit/registry.test.ts's drift check instead.
 *
 * `create` absorbs the three different constructor shapes checkers use
 * (`(page)`, `(page, response)`, `(page, options)`) behind one signature,
 * without requiring every checker to be rewritten onto a shared base class
 * just to be listed here.
 */
export const CHECKER_REGISTRY: CheckerDescriptor[] = [
  { key: 'metaTags', label: 'Meta Tags', icon: '🏷️', create: (ctx) => new MetaTagsChecker({ ...ctx, checkerKey: 'metaTags' }) },
  { key: 'headings', label: 'Headings', icon: '📝', create: (ctx) => new HeadingsChecker({ ...ctx, checkerKey: 'headings' }) },
  { key: 'images', label: 'Images', icon: '🖼️', create: (ctx) => new ImagesChecker({ ...ctx, checkerKey: 'images' }) },
  { key: 'performance', label: 'Performance', icon: '⚡', create: (ctx) => new PerformanceChecker({ ...ctx, checkerKey: 'performance' }) },
  { key: 'robotsTxt', label: 'Robots.txt', icon: '🤖', create: (ctx) => new RobotsTxtChecker({ ...ctx, checkerKey: 'robotsTxt' }) },
  { key: 'sitemap', label: 'Sitemap', icon: '🗺️', create: (ctx) => new SitemapChecker({ ...ctx, checkerKey: 'sitemap' }) },
  { key: 'security', label: 'Security', icon: '🔒', create: (ctx) => new SecurityChecker({ ...ctx, checkerKey: 'security' }) },
  { key: 'structuredData', label: 'Structured Data', icon: '📋', create: (ctx) => new StructuredDataChecker({ ...ctx, checkerKey: 'structuredData' }) },
  { key: 'socialMedia', label: 'Social Media', icon: '📱', create: (ctx) => new SocialMediaChecker({ ...ctx, checkerKey: 'socialMedia' }) },
  { key: 'content', label: 'Content', icon: '📄', create: (ctx) => new ContentChecker({ ...ctx, checkerKey: 'content' }) },
  { key: 'links', label: 'Links', icon: '🔗', create: (ctx) => new LinksChecker({ ...ctx, checkerKey: 'links' }) },
  { key: 'uiElements', label: 'UI Elements', icon: '🎨', create: (ctx) => new UIElementsChecker({ ...ctx, checkerKey: 'uiElements' }) },
  { key: 'technical', label: 'Technical SEO', icon: '⚙️', create: (ctx) => new TechnicalChecker({ ...ctx, checkerKey: 'technical' }) },
  { key: 'accessibility', label: 'Accessibility', icon: '♿', create: (ctx) => new AccessibilityChecker({ ...ctx, checkerKey: 'accessibility' }) },
  { key: 'urlFactors', label: 'URL Factors', icon: '🌐', create: (ctx) => new URLFactorsChecker({ ...ctx, checkerKey: 'urlFactors' }) },
  { key: 'spamDetection', label: 'Spam Detection', icon: '🚫', create: (ctx) => new SpamDetectionChecker(ctx.page) },
  { key: 'pageQuality', label: 'Page Quality', icon: '⭐', create: (ctx) => new PageQualityChecker({ ...ctx, checkerKey: 'pageQuality' }) },
  { key: 'advancedImages', label: 'Advanced Images', icon: '📷', create: (ctx) => new AdvancedImagesChecker({ ...ctx, checkerKey: 'advancedImages' }) },
  { key: 'multimedia', label: 'Multimedia', icon: '🎬', create: (ctx) => new MultimediaChecker({ ...ctx, checkerKey: 'multimedia' }) },
  { key: 'coreWebVitals', label: 'Core Web Vitals', icon: '📊', create: (ctx) => new CoreWebVitalsChecker({ ...ctx, checkerKey: 'coreWebVitals' }) },
  { key: 'analytics', label: 'Analytics & Tracking', icon: '📈', create: (ctx) => new AnalyticsChecker({ ...ctx, checkerKey: 'analytics' }) },
  { key: 'mobileUX', label: 'Mobile UX', icon: '📲', create: (ctx) => new MobileUXChecker({ ...ctx, checkerKey: 'mobileUX' }) },
  { key: 'schemaValidation', label: 'Schema Validation', icon: '✅', create: (ctx) => new SchemaValidationChecker(ctx.page) },
  { key: 'resourceOptimization', label: 'Resource Optimization', icon: '🚀', create: (ctx) => new ResourceOptimizationChecker(ctx.page) },
  { key: 'legalCompliance', label: 'Legal & Compliance', icon: '⚖️', create: (ctx) => new LegalComplianceChecker({ ...ctx, checkerKey: 'legalCompliance' }) },
  { key: 'ecommerce', label: 'E-commerce', icon: '🛒', create: (ctx) => new EcommerceChecker(ctx.page) },
  { key: 'internationalization', label: 'Internationalization', icon: '🌍', create: (ctx) => new InternationalizationChecker(ctx.page) },
  { key: 'heatmap', label: 'Heatmap & UX', icon: '🔥', create: (ctx) => new HeatmapChecker({ ...ctx, checkerKey: 'heatmap' }) },
];
