/**
 * Retry utility with exponential backoff for network and transient failures
 */

import { NetworkError, TimeoutError, BrowserError, categorizeError } from './types.js';
import { ErrorLogger } from './logger.js';

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds between retries
   * @default 10000
   */
  maxDelay?: number;

  /**
   * Backoff multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Whether to add random jitter to delays
   * @default true
   */
  jitter?: boolean;

  /**
   * Custom function to determine if an error should be retried
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /**
   * Callback for retry attempts
   */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: unknown;
  startTime: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
  shouldRetry: defaultShouldRetry,
  onRetry: () => {}, // no-op by default
};

/**
 * Default retry logic - retries on network errors, timeouts, and specific HTTP status codes
 */
function defaultShouldRetry(error: unknown, attempt: number): boolean {
  const categorized = categorizeError(error);

  // Always retry network and timeout errors
  if (categorized instanceof NetworkError || categorized instanceof TimeoutError) {
    return true;
  }

  // Retry browser errors only once
  if (categorized instanceof BrowserError && attempt === 1) {
    return true;
  }

  // Check for specific retryable HTTP status codes
  const errorMessage = error instanceof Error ? error.message : String(error);
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

  for (const code of retryableStatusCodes) {
    if (errorMessage.includes(`${code}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(options: Required<RetryOptions>, attempt: number): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  let delay = Math.min(exponentialDelay, options.maxDelay);

  if (options.jitter) {
    // Add random jitter between 0% and 25% of the delay
    const jitterAmount = delay * 0.25 * Math.random();
    delay = delay + jitterAmount;
  }

  return Math.floor(delay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 5, initialDelay: 500 }
 * );
 * ```
 */
export async function retry<T>(
  fn: (context: RetryContext) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const context: RetryContext = {
      attempt,
      totalAttempts: opts.maxAttempts,
      lastError,
      startTime,
    };

    try {
      const result = await fn(context);
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = opts.shouldRetry(error, attempt);
      const isLastAttempt = attempt === opts.maxAttempts;

      if (!shouldRetry || isLastAttempt) {
        // Log final failure
        ErrorLogger.getInstance().logError(categorizeError(error), {
          retryAttempts: attempt,
          totalDuration: Date.now() - startTime,
        });
        throw error;
      }

      // Calculate delay and wait before next retry
      const delay = calculateDelay(opts, attempt);
      opts.onRetry(error, attempt, delay);

      // Log retry attempt
      ErrorLogger.getInstance().logRetry(categorizeError(error), attempt, delay);

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

