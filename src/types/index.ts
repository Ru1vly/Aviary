import type { RuleSeverity } from '../config/types';

export interface SEOCheckResult {
  passed: boolean;
  message: string;
  severity?: RuleSeverity;
  details?: Record<string, unknown>;
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
  /** Navigation readiness condition used to capture the page. */
  navigationWaitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  /** Fixed delay after navigation readiness, in milliseconds. */
  settleAfterNavigationMs?: number;
  /** Category keys selected for this audit; omitted when every category was requested. */
  categories?: string[];
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
    geo: SEOCheckResult[];
  };
  /** `null` when no check ran to weigh — see calculateWeightedScore in src/scoring.ts. */
  score: number | null;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export interface SEOCheckerOptions {
  url: string;
  /** @internal Map of normalized batch URLs to their positions for site-wide link analysis. */
  sitewideTargetIndexes?: ReadonlyMap<string, number>;
  /** Abort navigation and close the active page when this signal is triggered. */
  signal?: AbortSignal;
  headless?: boolean;
  timeout?: number;
  /** Browser navigation completion condition; defaults to networkidle. */
  navigationWaitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  /** Fixed delay after navigation readiness; defaults to 1000 ms (0–30000). */
  settleAfterNavigationMs?: number;
  /** Override the browser User-Agent for checks such as robots-aware crawling. */
  userAgent?: string;
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

export interface SEOAuditBatchOptions extends Omit<SEOCheckerOptions, 'url'> {
  /** Maximum number of browser audits to run at once; defaults to 2, maximum 8. */
  concurrency?: number;
  /** Abort active page audits and skip URLs that have not started yet. */
  signal?: AbortSignal;
  /** Called once as each URL finishes; observer errors do not interrupt the audit. */
  onProgress?: (progress: SEOAuditBatchProgress) => void;
}

/** Options for non-overlapping, periodic runs over the same URL collection. */
export interface SEOAuditWatchOptions extends SEOAuditBatchOptions {
  /** Idle delay between completed batches, in milliseconds. */
  intervalMs: number;
  /** Stop after the current batch completes; no new batch starts after abort. */
  signal?: AbortSignal;
  /** Called with each completed batch; callback errors do not stop the watch. */
  onAudit?: (batch: SEOAuditBatchReport) => void | Promise<void>;
}

export type SEOAuditBatchResult =
  | { status: 'complete'; url: string; report: SEOReport }
  | { status: 'error'; url: string; error: string };

export interface SEOAuditBatchProgress {
  completedUrls: number;
  requestedUrls: number;
  result: SEOAuditBatchResult;
}

export interface SEOAuditBatchReport {
  timestamp: string;
  summary: {
    requestedUrls: number;
    /** Actual number of browser workers created; omitted by older saved batch reports. */
    concurrency?: number;
    completedUrls: number;
    failedUrls: number;
    passedChecks: number;
    failedChecks: number;
    averageScore: number | null;
  };
  results: SEOAuditBatchResult[];
}

export interface SEOAuditHistoryRecord {
  timestamp: string;
  url: string;
  status: 'complete' | 'error';
  categories?: string[];
  navigationWaitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  settleAfterNavigationMs?: number;
  score: number | null;
  summary: { total: number; passed: number; failed: number };
  failedChecks: Array<{
    category: string;
    name: string;
    message: string;
    severity?: RuleSeverity;
  }>;
  error?: string;
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
