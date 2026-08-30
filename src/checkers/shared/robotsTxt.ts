import { Page } from 'playwright';
import { retry } from '../../errors/index.js';

/** Canonical robots.txt URL for the page's origin — was duplicated across robotsTxt.ts and sitemap.ts. */
export function robotsTxtUrl(page: Page): string {
  const url = new URL(page.url());
  return `${url.protocol}//${url.host}/robots.txt`;
}

/**
 * Fetches robots.txt with retry-with-backoff, for callers with no existing
 * error-handling wrapper of their own (robotsTxt.ts already retries via its
 * CheckerErrorHandler and keeps using that — this is for sitemap.ts, which
 * used to fetch the same resource with a single unretried attempt).
 */
export function fetchRobotsTxtWithRetry(page: Page) {
  return retry(() => page.context().request.get(robotsTxtUrl(page)), {
    maxAttempts: 3,
    initialDelay: 1000,
  });
}
