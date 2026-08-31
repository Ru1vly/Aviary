/**
 * Custom error types for the aviary checker
 */

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  BROWSER = 'BROWSER',
  CONFIGURATION = 'CONFIGURATION',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL', // Fatal errors that stop execution
  ERROR = 'ERROR',       // Errors that affect results but allow continuation
  WARNING = 'WARNING',   // Issues that don't affect core functionality
  INFO = 'INFO',         // Informational messages
}

export interface ErrorContext {
  timestamp: Date;
  url?: string;
  checkName?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  originalError?: Error;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  retryCount?: number;
}

/**
 * Base error class for all aviary errors
 */
export class SEOCheckerError extends Error {
  public readonly context: ErrorContext;

  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message);
    this.name = 'SEOCheckerError';

    this.context = {
      timestamp: new Date(),
      category: context.category || ErrorCategory.UNKNOWN,
      severity: context.severity || ErrorSeverity.ERROR,
      ...context,
      stackTrace: context.stackTrace || this.stack,
    };

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: {
        ...this.context,
        timestamp: this.context.timestamp.toISOString(),
      },
    };
  }
}

/**
 * Network-related errors (connection failures, timeouts, HTTP errors)
 */
export class NetworkError extends SEOCheckerError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, {
      ...context,
      category: ErrorCategory.NETWORK,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Browser automation errors (page crashes, navigation failures)
 */
export class BrowserError extends SEOCheckerError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, {
      ...context,
      category: ErrorCategory.BROWSER,
    });
    this.name = 'BrowserError';
  }
}

/**
 * Configuration errors (missing or invalid config)
 */
export class ConfigurationError extends SEOCheckerError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, {
      ...context,
      category: ErrorCategory.CONFIGURATION,
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends SEOCheckerError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, {
      ...context,
      category: ErrorCategory.TIMEOUT,
    });
    this.name = 'TimeoutError';
  }
}

/**
 * Helper to categorize unknown errors
 */
export function categorizeError(error: unknown): SEOCheckerError {
  if (error instanceof SEOCheckerError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const originalError = error instanceof Error ? error : undefined;
  // Real Playwright errors are capitalized (e.g. "Timeout 30000ms exceeded"),
  // which the plain-lowercase 'timeout' check below misses.
  const errorMessageLower = errorMessage.toLowerCase();

  // Categorize based on error message patterns
  if (errorMessageLower.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return new TimeoutError(errorMessage, { originalError });
  }

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('ERR_CONNECTION') ||
    errorMessage.includes('ERR_NAME_NOT_RESOLVED')
  ) {
    return new NetworkError(errorMessage, { originalError });
  }

  if (
    errorMessage.includes('browser') ||
    errorMessage.includes('page crash') ||
    errorMessage.includes('navigation')
  ) {
    return new BrowserError(errorMessage, { originalError });
  }

  if (errorMessage.includes('config') || errorMessage.includes('configuration')) {
    return new ConfigurationError(errorMessage, { originalError });
  }

  return new SEOCheckerError(errorMessage, {
    category: ErrorCategory.UNKNOWN,
    originalError,
  });
}
