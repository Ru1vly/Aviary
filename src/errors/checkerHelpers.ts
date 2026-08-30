/**
 * Helper utilities for checkers to handle errors consistently
 */

import { Page, APIResponse } from 'playwright';
import { SEOCheckResult } from '../types/index.js';
import { retry, RetryOptions } from './retry.js';
import { ErrorLogger } from './logger.js';
import { categorizeError, NetworkError } from './types.js';
import { withGracefulDegradation, GracefulOptions } from './graceful.js';

export class CheckerErrorHandler {
  constructor(
    private page: Page,
    private checkerName: string
  ) {}

  /**
   * Execute a network request with retry logic
   */
  async executeNetworkRequest<T>(
    requestFn: () => Promise<T>,
    checkName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const url = this.page.url();

    return retry(
      async (context) => {
        try {
          return await requestFn();
        } catch (error) {
          const categorized = categorizeError(error);

          if (!(categorized instanceof NetworkError)) {
            throw new NetworkError(categorized.message, {
              checkName: `${this.checkerName}.${checkName}`,
              url,
              retryCount: context.attempt - 1,
              originalError: categorized.context.originalError,
            });
          }

          categorized.context.checkName = `${this.checkerName}.${checkName}`;
          categorized.context.url = url;
          categorized.context.retryCount = context.attempt - 1;
          throw categorized;
        }
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        onRetry: (error, attempt, delay) => {
          ErrorLogger.getInstance().info(
            `Retrying ${this.checkerName}.${checkName} (attempt ${attempt}) after ${delay}ms`,
            { url, error: error instanceof Error ? error.message : String(error) }
          );
        },
        ...options,
      }
    );
  }

  /**
   * Execute a check with graceful degradation
   */
  async executeCheck(
    checkFn: () => Promise<SEOCheckResult>,
    checkName: string,
    options: GracefulOptions = {}
  ): Promise<SEOCheckResult> {
    return withGracefulDegradation(
      checkFn,
      `${this.checkerName}.${checkName}`,
      options
    );
  }

  /**
   * Fetch a URL with retry logic
   */
  async fetchWithRetry(
    url: string,
    checkName: string,
    options: RetryOptions = {}
  ): Promise<APIResponse> {
    return this.executeNetworkRequest(
      async () => {
        const response = await this.page.context().request.get(url);
        return response;
      },
      checkName,
      options
    );
  }
}
