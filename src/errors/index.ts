/**
 * Error handling module exports
 */

// Error types
export {
  SEOCheckerError,
  NetworkError,
  BrowserError,
  ConfigurationError,
  TimeoutError,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  categorizeError,
} from './types.js';

// Retry utilities
export { retry, RetryOptions, RetryContext } from './retry.js';

// Logger
export { ErrorLogger, LogLevel, LogEntry, LoggerOptions } from './logger.js';

// Graceful degradation
export { withGracefulDegradation, GracefulOptions } from './graceful.js';

// Checker helpers
export { CheckerErrorHandler } from './checkerHelpers.js';
