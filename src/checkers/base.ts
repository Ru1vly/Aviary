import { Page, Response } from 'playwright';
import { SEOCheckResult, RuleSeverity } from '../types';
import { SEOConfig, ConfigLoader } from '../config';
import { categorizeError } from '../errors/index.js';
import { CheckerKey } from './registry';

export interface BaseCheckerDeps {
  page: Page;
  response?: Response | null;
  config?: SEOConfig;
  /** Registry key this checker is listed under — used to resolve per-rule config. */
  checkerKey: CheckerKey;
}

/** What a single named check returns before config resolution stamps a name/severity onto it. */
export interface CheckOutcome {
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
  /** Overrides the config-resolved severity for this specific result. Rarely needed. */
  severity?: RuleSeverity;
}

/**
 * Base class for checkers migrated onto the shared registry/config
 * infrastructure (src/checkers/registry.ts, src/config/loader.ts).
 *
 * A subclass declares its checks as a list of `{ id, run }` pairs via
 * `checks()`. Each one runs, and is config-resolved, independently: a
 * single check throwing produces one failed result for *that* rule id and
 * does not prevent the checker's other checks from running — unlike a
 * single try/catch wrapped around a whole `checkAll()` body, which most of
 * the not-yet-migrated checkers still use today (a throw partway through
 * silently drops every check after it). `id` also becomes the result's
 * `name`, which is what makes per-rule config (`{enabled: false}` on one
 * specific rule, not just the whole checker) actually resolvable.
 *
 * Not adopted by any checker yet — this is infrastructure for the 28-file
 * migration, done in small batches, not applied all at once.
 */
export abstract class BaseChecker {
  protected page: Page;
  protected response: Response | null;
  protected config: SEOConfig;
  protected checkerKey: CheckerKey;

  constructor(deps: BaseCheckerDeps) {
    this.page = deps.page;
    this.response = deps.response ?? null;
    this.config = deps.config ?? {};
    this.checkerKey = deps.checkerKey;
  }

  /** Shorthand for a passing CheckOutcome. */
  protected pass(message: string, details?: Record<string, unknown>): CheckOutcome {
    return { passed: true, message, details };
  }

  /** Shorthand for a failing CheckOutcome. */
  protected fail(message: string, details?: Record<string, unknown>): CheckOutcome {
    return { passed: false, message, details };
  }

  /**
   * Resolves a tunable threshold for one rule: a rule-level config override
   * (`options[key]`) if present, otherwise the checker's own default constant.
   * Lets `src/config/thresholds.ts`'s named constants stay overridable per rule
   * without changing `checks()`'s `{id, run}` shape — `config`/`checkerKey` are
   * already available on `this`.
   */
  protected threshold<T>(ruleId: string, key: string, defaultValue: T): T {
    const resolved = ConfigLoader.getRuleConfig(this.config, this.checkerKey, ruleId);
    return (resolved.options?.[key] as T) ?? defaultValue;
  }

  /** The named checks this checker runs. Each `id` should match a rule name used in presets.ts. */
  protected abstract checks(): Array<{ id: string; run: () => Promise<CheckOutcome> }>;

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    for (const { id, run } of this.checks()) {
      const resolved = ConfigLoader.getRuleConfig(this.config, this.checkerKey, id);
      if (!resolved.enabled) continue;

      try {
        const outcome = await run();
        results.push({
          passed: outcome.passed,
          message: outcome.message,
          details: outcome.details,
          severity: outcome.severity ?? resolved.severity,
          name: id,
        });
      } catch (err) {
        const categorized = categorizeError(err);
        results.push({
          passed: false,
          message: `Check '${id}' crashed: ${categorized.message}`,
          severity: resolved.severity,
          name: id,
        });
      }
    }

    return results;
  }
}
