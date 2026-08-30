import type { RuleSeverity } from '../config/types';

export interface SEOCheckResult {
  passed: boolean;
  message: string;
  severity?: RuleSeverity;
  details?: Record<string, any>;
  /**
   * Stable rule identifier (e.g. 'title-exists', 'https-enabled'), matching
   * the rule names used in preset/config files (see src/config/presets.ts).
   * Optional for now — populated as each checker migrates onto BaseChecker
   * (see src/checkers/base.ts); until then this is undefined and per-rule
   * config falls back to checker-level resolution.
   */
  name?: string;
}

export type { RuleSeverity };

export interface SEOReport {
  url: string;
  timestamp: string;
  checks: {
    metaTags: SEOCheckResult[];
    headings: SEOCheckResult[];
    images: SEOCheckResult[];
    performance: SEOCheckResult[];
    robotsTxt: SEOCheckResult[];
    sitemap: SEOCheckResult[];
    security: SEOCheckResult[];
    structuredData: SEOCheckResult[];
    socialMedia: SEOCheckResult[];
    content: SEOCheckResult[];
    links: SEOCheckResult[];
    uiElements: SEOCheckResult[];
    technical: SEOCheckResult[];
    accessibility: SEOCheckResult[];
    urlFactors: SEOCheckResult[];
    spamDetection: SEOCheckResult[];
    pageQuality: SEOCheckResult[];
    advancedImages: SEOCheckResult[];
    multimedia: SEOCheckResult[];
    coreWebVitals: SEOCheckResult[];
    analytics: SEOCheckResult[];
    mobileUX: SEOCheckResult[];
    schemaValidation: SEOCheckResult[];
    resourceOptimization: SEOCheckResult[];
    legalCompliance: SEOCheckResult[];
    ecommerce: SEOCheckResult[];
    internationalization: SEOCheckResult[];
    heatmap: SEOCheckResult[];
  };
  score: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export interface SEOCheckerOptions {
  url: string;
  headless?: boolean;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
  config?: import('../config').SEOConfig;
  configFile?: string;
  /**
   * Restrict the audit to these checker keys (see CHECKER_REGISTRY in
   * src/checkers/registry.ts). Runs every checker (subject to config
   * enable/disable) when omitted. Typed as string[] rather than CheckerKey
   * here to avoid a type-only circular import between this file and
   * checkers/registry.ts (which imports SEOReport from here); invalid keys
   * are simply never matched against the registry, not rejected.
   */
  categories?: string[];
}

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface HeadingStructure {
  tag: string;
  text: string;
  level: number;
}

export interface ImageInfo {
  src: string;
  alt: string | null;
  hasAlt: boolean;
}

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint?: number;
}
