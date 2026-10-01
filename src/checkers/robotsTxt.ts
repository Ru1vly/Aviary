import { CheckerErrorHandler } from '../errors/index.js';
import { BaseChecker, BaseCheckerDeps, CheckOutcome } from './base';
import { robotsTxtUrl } from './shared/robotsTxt';

interface RobotsTxtSnapshot {
  url: string;
  status: number;
  content: string;
}

function analyzeRobotsTxt(content: string): {
  hasUserAgent: boolean;
  hasDisallow: boolean;
  hasSitemapReference: boolean;
  invalidSitemapCount: number;
  invalidSitemapPreviews: string[];
  wildcardDisallowsAll: boolean;
} {
  let hasUserAgent = false;
  let hasDisallow = false;
  let hasSitemapReference = false;
  let invalidSitemapCount = 0;
  const invalidSitemapPreviews: string[] = [];
  let wildcardDisallowsRoot = false;
  let wildcardAllowsRoot = false;
  let agents: string[] = [];
  let groupHasRules = false;

  for (const rawLine of content.split(/\r\n?|\n/)) {
    const line = (rawLine.split('#', 1)[0] ?? '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (groupHasRules) {
        agents = [];
        groupHasRules = false;
      }
      if (value) {
        agents.push(value.toLowerCase());
        hasUserAgent = true;
      }
    } else if (field === 'allow' || field === 'disallow' || field === 'crawl-delay') {
      groupHasRules = true;
      if (field === 'disallow' && value) hasDisallow = true;
      if (value === '/' && agents.includes('*')) {
        if (field === 'disallow') wildcardDisallowsRoot = true;
        if (field === 'allow') wildcardAllowsRoot = true;
      }
    } else if (field === 'sitemap' && value) {
      hasSitemapReference = true;
      try {
        const sitemapUrl = new URL(value);
        if (
          (sitemapUrl.protocol !== 'http:' && sitemapUrl.protocol !== 'https:') ||
          sitemapUrl.username ||
          sitemapUrl.password
        ) {
          invalidSitemapCount += 1;
          if (invalidSitemapPreviews.length < 5) invalidSitemapPreviews.push(value.slice(0, 256));
        }
      } catch {
        invalidSitemapCount += 1;
        if (invalidSitemapPreviews.length < 5) invalidSitemapPreviews.push(value.slice(0, 256));
      }
    }
  }

  return {
    hasUserAgent,
    hasDisallow,
    hasSitemapReference,
    invalidSitemapCount,
    invalidSitemapPreviews,
    wildcardDisallowsAll: wildcardDisallowsRoot && !wildcardAllowsRoot,
  };
}

export class RobotsTxtChecker extends BaseChecker {
  private errorHandler: CheckerErrorHandler;
  private robotsTxtPromise?: Promise<RobotsTxtSnapshot>;

  constructor(deps: BaseCheckerDeps) {
    super(deps);
    this.errorHandler = new CheckerErrorHandler(this.page, 'RobotsTxtChecker');
  }

  protected checks() {
    return [
      { id: 'robots-txt-exists', run: () => this.checkRobotsTxtExists() },
      { id: 'robots-txt-configured', run: () => this.checkRobotsTxtAccessible() },
    ];
  }

  private getRobotsTxt(): Promise<RobotsTxtSnapshot> {
    if (!this.robotsTxtPromise) {
      this.robotsTxtPromise = (async () => {
        const url = robotsTxtUrl(this.page);
        const response = await this.errorHandler.fetchWithRetry(url, 'checkRobotsTxt', {
          maxAttempts: 3,
          initialDelay: 1000,
        });
        return { url, status: response.status(), content: await response.text() };
      })();
    }
    return this.robotsTxtPromise;
  }

  private async checkRobotsTxtExists(): Promise<CheckOutcome> {
    const result = await this.errorHandler.executeCheck(async () => {
      const { url, status, content } = await this.getRobotsTxt();

      if (status === 200) {
        const summary = analyzeRobotsTxt(content);

        return {
          passed: true,
          message: 'robots.txt file exists and is accessible',
          details: {
            url,
            status,
            hasUserAgent: summary.hasUserAgent,
            hasDisallow: summary.hasDisallow,
            size: content.length,
          },
        };
      } else if (status === 404) {
        return {
          passed: false,
          message: 'robots.txt file not found (404)',
          details: { url, status },
        };
      } else {
        return {
          passed: false,
          message: `robots.txt returned unexpected status: ${status}`,
          details: { url, status },
        };
      }
    }, 'checkRobotsTxtExists');

    return {
      passed: result.passed,
      message: result.message,
      details: result.details,
      severity: result.severity,
    };
  }

  private async checkRobotsTxtAccessible(): Promise<CheckOutcome> {
    const result = await this.errorHandler.executeCheck(
      async () => {
        const { url, status, content } = await this.getRobotsTxt();

        if (status !== 200) {
          return {
            passed: true,
            message: 'robots.txt validation skipped (file not found)',
          };
        }

        // Check for common issues
        const issues: string[] = [];
        const summary = analyzeRobotsTxt(content);
        if (summary.wildcardDisallowsAll) {
          issues.push(
            'Warning: the wildcard robots group contains "Disallow: /", which blocks general-purpose crawlers'
          );
        }
        if (summary.invalidSitemapCount > 0) {
          issues.push(
            `${summary.invalidSitemapCount} Sitemap directive(s) are not valid absolute HTTP(S) URLs without credentials`
          );
        }

        if (!summary.hasSitemapReference) {
          issues.push('Tip: Consider adding sitemap reference to robots.txt');
        }

        return {
          passed: issues.length === 0,
          message:
            issues.length === 0
              ? 'robots.txt is properly configured'
              : 'robots.txt has potential issues',
          details: {
            url,
            issues,
            hasSitemapReference: summary.hasSitemapReference,
            invalidSitemapCount: summary.invalidSitemapCount,
            invalidSitemapPreviews: summary.invalidSitemapPreviews,
            content: content.substring(0, 500), // First 500 chars
          },
        };
      },
      'checkRobotsTxtAccessible',
      {
        passOnError: true, // Gracefully degrade if check fails
        messagePrefix: 'robots.txt validation skipped due to error',
      }
    );

    return {
      passed: result.passed,
      message: result.message,
      details: result.details,
      severity: result.severity,
    };
  }
}
