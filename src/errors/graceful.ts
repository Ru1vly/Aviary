/**
 * Graceful degradation utilities for handling errors without failing completely
 */

import { SEOCheckResult, RuleSeverity } from '../types/index.js';
import { categorizeError, ErrorSeverity } from './types.js';
import { ErrorLogger } from './logger.js';

export interface GracefulOptions {
  /**
   * Whether to mark check as passed when it fails
   * @default true (graceful degradation)
   */
  passOnError?: boolean;

  /**
   * Whether to include error details in the message
   * @default true
   */
  includeErrorDetails?: boolean;

  /**
   * Custom message prefix for degraded checks
   * @default 'Check skipped due to error'
   */
  messagePrefix?: string;

  /**
   * Whether to log the error
   * @default true
   */
  logError?: boolean;

  /**
   * Severity to log the error as, and to report on the degraded check
   * result (converted to the report's lowercase RuleSeverity — see
   * errorSeverityToRuleSeverity below)
   * @default ErrorSeverity.WARNING
   */
  logSeverity?: ErrorSeverity;
}

const DEFAULT_GRACEFUL_OPTIONS: Required<GracefulOptions> = {
  passOnError: true,
  includeErrorDetails: true,
  messagePrefix: 'Check skipped due to error',
  logError: true,
  logSeverity: ErrorSeverity.WARNING,
};

/**
 * Map the internal (uppercase) ErrorSeverity taxonomy to the report-facing
 * (lowercase) RuleSeverity used by SEOCheckResult.
 *
 * Previously, withGracefulDegradation wrote an ErrorSeverity value directly
 * into a field typed as RuleSeverity, hidden behind an `as unknown as T`
 * cast. Since reporter.ts compares severity case-sensitively (`=== 'error'`)
 * to pick badge/row styling, a degraded result's severity never matched
 * anything and silently rendered with no badge at all.
 */
function errorSeverityToRuleSeverity(severity: ErrorSeverity): RuleSeverity {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.ERROR:
      return 'error';
    case ErrorSeverity.INFO:
      return 'info';
    case ErrorSeverity.WARNING:
    default:
      return 'warning';
  }
}

/**
 * Execute a check with graceful degradation
 * Returns a passed check with error details if the check fails
 */
export async function withGracefulDegradation<T extends SEOCheckResult>(
  checkFn: () => Promise<T>,
  checkName: string,
  options: GracefulOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_GRACEFUL_OPTIONS, ...options };

  try {
    return await checkFn();
  } catch (error) {
    const categorized = categorizeError(error);
    categorized.context.checkName = checkName;
    categorized.context.severity = opts.logSeverity;

    if (opts.logError) {
      ErrorLogger.getInstance().logError(categorized);
    }

    const errorMessage = categorized.message;
    const detailsText = opts.includeErrorDetails ? `: ${errorMessage}` : '';
    const message = `${opts.messagePrefix}${detailsText}`;

    const result: SEOCheckResult = {
      passed: opts.passOnError,
      message,
      severity: errorSeverityToRuleSeverity(opts.logSeverity),
    };

    return result as T;
  }
}
