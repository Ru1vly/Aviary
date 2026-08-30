export type RuleSeverity = 'error' | 'warning' | 'info';
export type PresetName = 'basic' | 'advanced' | 'strict';

export interface RuleConfig {
  enabled: boolean;
  severity?: RuleSeverity;
  options?: Record<string, unknown>;
}

export interface CheckerRules {
  [checkName: string]: RuleConfig | boolean;
}

/**
 * Whole-checker enable/disable plus an optional default severity applied to
 * every rule in that checker, without specifying each rule individually.
 * This is distinct from `CheckerRules`, whose index signature only accepts
 * `RuleConfig | boolean` values — a bare `severity: 'warning'` string can
 * never satisfy that, which is why presets previously needed `as any` to
 * write `{ enabled: true, severity: 'warning' }` at the checker level.
 */
export interface CheckerLevelConfig {
  enabled: boolean;
  severity?: RuleSeverity;
}

export type CheckerConfig = boolean | CheckerLevelConfig | CheckerRules;

export interface SEOConfig {
  // Preset configuration
  preset?: PresetName;

  // Global settings
  severity?: RuleSeverity;

  // Checker-specific rules
  rules?: {
    metaTags?: CheckerConfig;
    headings?: CheckerConfig;
    images?: CheckerConfig;
    performance?: CheckerConfig;
    robotsTxt?: CheckerConfig;
    sitemap?: CheckerConfig;
    security?: CheckerConfig;
    structuredData?: CheckerConfig;
    socialMedia?: CheckerConfig;
    content?: CheckerConfig;
    links?: CheckerConfig;
    uiElements?: CheckerConfig;
    technical?: CheckerConfig;
    accessibility?: CheckerConfig;
    urlFactors?: CheckerConfig;
    spamDetection?: CheckerConfig;
    pageQuality?: CheckerConfig;
    advancedImages?: CheckerConfig;
    multimedia?: CheckerConfig;
    coreWebVitals?: CheckerConfig;
    analytics?: CheckerConfig;
    mobileUX?: CheckerConfig;
    schemaValidation?: CheckerConfig;
    resourceOptimization?: CheckerConfig;
    legalCompliance?: CheckerConfig;
    ecommerce?: CheckerConfig;
    internationalization?: CheckerConfig;
    heatmap?: CheckerConfig;
  };

  // Custom rules (extensibility for future)
  customRules?: {
    [ruleName: string]: RuleConfig;
  };
}

export interface ResolvedRuleConfig {
  enabled: boolean;
  severity: RuleSeverity;
  options: Record<string, unknown>;
}
