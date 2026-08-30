import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  SEOConfig,
  ResolvedRuleConfig,
  CheckerRules,
  CheckerLevelConfig,
  CheckerConfig,
} from './types';
import { presets } from './presets';

/**
 * Configuration loader for SEO checker
 * Supports JSON and YAML configuration files
 */
export class ConfigLoader {
  /**
   * Load configuration from a file
   * Supports .json, .yaml, and .yml files
   */
  static loadFromFile(configPath: string): SEOConfig {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const ext = path.extname(configPath).toLowerCase();
    const content = fs.readFileSync(configPath, 'utf-8');

    let config: SEOConfig;

    switch (ext) {
      case '.json':
        config = JSON.parse(content);
        break;
      case '.yaml':
      case '.yml':
        config = yaml.load(content) as SEOConfig;
        break;
      default:
        throw new Error(`Unsupported configuration file format: ${ext}. Use .json, .yaml, or .yml`);
    }

    return this.resolveConfig(config);
  }

  /**
   * Load configuration from an object
   */
  static loadFromObject(config: SEOConfig): SEOConfig {
    return this.resolveConfig(config);
  }

  /**
   * Resolve configuration by applying preset and merging rules
   */
  static resolveConfig(config: SEOConfig): SEOConfig {
    let resolved: SEOConfig = {
      severity: config.severity || 'warning',
      rules: {},
    };

    // Apply preset if specified
    if (config.preset && presets[config.preset]) {
      const preset = presets[config.preset];
      resolved = {
        ...resolved,
        ...preset,
        severity: config.severity || preset.severity || 'warning',
      };
    }

    // Merge custom rules over preset
    if (config.rules) {
      resolved.rules = this.mergeRules(resolved.rules || {}, config.rules);
    }

    // Preserve custom rules
    if (config.customRules) {
      resolved.customRules = config.customRules;
    }

    return resolved;
  }

  /**
   * Merge two rule configurations
   */
  private static mergeRules(
    base: NonNullable<SEOConfig['rules']>,
    override: NonNullable<SEOConfig['rules']>
  ): NonNullable<SEOConfig['rules']> {
    const merged = { ...base };

    for (const [checkerName, checkerRules] of Object.entries(override)) {
      const key = checkerName as keyof typeof merged;
      if (checkerRules === false) {
        // Disable entire checker
        merged[key] = false;
      } else if (checkerRules === true) {
        // Enable entire checker with defaults
        merged[key] = true;
      } else if (typeof checkerRules === 'object') {
        // Merge individual rules
        const baseCheckerRules = (merged[key] || {}) as CheckerRules;
        merged[key] = {
          ...baseCheckerRules,
          ...checkerRules,
        } as CheckerConfig;
      }
    }

    return merged;
  }

  /**
   * Distinguish a checker-level `{ enabled, severity }` object from a
   * per-rule `CheckerRules` map. `CheckerRules`'s index signature only
   * accepts `RuleConfig | boolean` values, which a bare `severity` string
   * can never satisfy — so a string `severity` unambiguously means
   * checker-level config. A lone boolean `enabled` with no other keys is
   * also treated as checker-level, since that's the exact shape
   * `{ enabled: false }` needs to disable a whole checker.
   *
   * This can only misfire if a user names one of their own rules "enabled"
   * or "severity" AND gives it no sibling rules — an edge case not used by
   * any built-in preset or example config.
   */
  private static isCheckerLevelConfig(
    value: CheckerRules | CheckerLevelConfig
  ): value is CheckerLevelConfig {
    const keys = Object.keys(value);
    if (keys.length === 0 || !keys.every((k) => k === 'enabled' || k === 'severity')) {
      return false;
    }
    const v = value as CheckerLevelConfig;
    return typeof v.enabled === 'boolean' || typeof v.severity === 'string';
  }

  /**
   * Check if a checker is enabled
   */
  static isCheckerEnabled(config: SEOConfig, checkerName: string): boolean {
    if (!config.rules) return true;

    const checkerRules = config.rules[checkerName as keyof typeof config.rules];

    if (checkerRules === undefined) return true;
    if (checkerRules === false) return false;
    if (checkerRules === true) return true;

    if (this.isCheckerLevelConfig(checkerRules)) {
      return checkerRules.enabled !== false;
    }

    // Per-rule detail map with no checker-level `enabled` — the checker
    // itself is enabled; individual rules are resolved by getRuleConfig.
    return true;
  }

  /**
   * Get resolved configuration for a specific rule
   */
  static getRuleConfig(
    config: SEOConfig,
    checkerName: string,
    ruleName: string
  ): ResolvedRuleConfig {
    const defaultConfig: ResolvedRuleConfig = {
      enabled: true,
      severity: config.severity || 'warning',
      options: {},
    };

    if (!config.rules) return defaultConfig;

    const checkerRules = config.rules[checkerName as keyof typeof config.rules];

    // Checker is disabled
    if (checkerRules === false) {
      return { ...defaultConfig, enabled: false };
    }

    // Checker is enabled with all defaults
    if (checkerRules === true || checkerRules === undefined) {
      return defaultConfig;
    }

    // Checker-level { enabled, severity } with no per-rule detail — every
    // rule in the checker inherits this as its own default.
    if (this.isCheckerLevelConfig(checkerRules)) {
      return {
        enabled: checkerRules.enabled !== false,
        severity: checkerRules.severity || config.severity || 'warning',
        options: {},
      };
    }

    // Check specific rule configuration
    const ruleConfig = (checkerRules as CheckerRules)[ruleName];

    if (ruleConfig === undefined) {
      return defaultConfig;
    }

    if (ruleConfig === false) {
      return { ...defaultConfig, enabled: false };
    }

    if (ruleConfig === true) {
      return defaultConfig;
    }

    // Rule has detailed configuration
    return {
      enabled: ruleConfig.enabled !== false,
      severity: ruleConfig.severity || config.severity || 'warning',
      options: ruleConfig.options || {},
    };
  }

  /**
   * Find and load configuration from default locations
   * Searches for .aviary.json, .aviary.yaml, .aviary.yml in current directory
   */
  static findAndLoad(): SEOConfig | null {
    const configFiles = [
      '.aviary.json',
      '.aviary.yaml',
      '.aviary.yml',
      'aviary.config.json',
      'aviary.config.yaml',
      'aviary.config.yml',
    ];

    for (const filename of configFiles) {
      const configPath = path.join(process.cwd(), filename);
      if (fs.existsSync(configPath)) {
        return this.loadFromFile(configPath);
      }
    }

    return null;
  }

  /**
   * Create a default configuration file
   */
  static createDefaultConfig(
    outputPath: string,
    preset: 'basic' | 'advanced' | 'strict' = 'advanced'
  ): void {
    const config: SEOConfig = {
      preset,
      severity: 'warning',
      rules: {
        // Example custom rule overrides
        metaTags: {
          'title-length-valid': { enabled: true, severity: 'warning' },
        },
      },
    };

    const ext = path.extname(outputPath).toLowerCase();
    let content: string;

    if (ext === '.yaml' || ext === '.yml') {
      content = yaml.dump(config, { indent: 2 });
    } else {
      content = JSON.stringify(config, null, 2);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
  }
}
