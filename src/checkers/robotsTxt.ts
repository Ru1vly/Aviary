import { CheckerErrorHandler } from '../errors/index.js';
import { BaseChecker, BaseCheckerDeps, CheckOutcome } from './base';
import { robotsTxtUrl } from './shared/robotsTxt';

export class RobotsTxtChecker extends BaseChecker {
  private errorHandler: CheckerErrorHandler;

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

  private async checkRobotsTxtExists(): Promise<CheckOutcome> {
    const result = await this.errorHandler.executeCheck(async () => {
      const robotsUrl = robotsTxtUrl(this.page);

      // Use retry mechanism for network requests
      const response = await this.errorHandler.fetchWithRetry(
        robotsUrl,
        'checkRobotsTxtExists',
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      const status = response.status();

      if (status === 200) {
        const content = await response.text();
        const hasUserAgent = content.toLowerCase().includes('user-agent:');
        const hasDisallow = content.toLowerCase().includes('disallow:');

        return {
          passed: true,
          message: 'robots.txt file exists and is accessible',
          details: {
            url: robotsUrl,
            status,
            hasUserAgent,
            hasDisallow,
            size: content.length,
          },
        };
      } else if (status === 404) {
        return {
          passed: false,
          message: 'robots.txt file not found (404)',
          details: { url: robotsUrl, status },
        };
      } else {
        return {
          passed: false,
          message: `robots.txt returned unexpected status: ${status}`,
          details: { url: robotsUrl, status },
        };
      }
    }, 'checkRobotsTxtExists');

    return { passed: result.passed, message: result.message, details: result.details, severity: result.severity };
  }

  private async checkRobotsTxtAccessible(): Promise<CheckOutcome> {
    const result = await this.errorHandler.executeCheck(async () => {
      const robotsUrl = robotsTxtUrl(this.page);

      // Use retry mechanism for network requests
      const response = await this.errorHandler.fetchWithRetry(
        robotsUrl,
        'checkRobotsTxtAccessible',
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      const content = await response.text();

      if (response.status() !== 200) {
        return {
          passed: true,
          message: 'robots.txt validation skipped (file not found)',
        };
      }

      // Check for common issues
      const issues: string[] = [];

      // Check if robots.txt blocks important resources
      if (content.toLowerCase().includes('disallow: /')) {
        const lines = content.split('\n');
        const disallowAll = lines.some(
          (line: string) =>
            line.trim().toLowerCase() === 'disallow: /' &&
            !line.trim().startsWith('#')
        );
        if (disallowAll) {
          issues.push('Warning: robots.txt contains "Disallow: /" which blocks all crawlers');
        }
      }

      // Check for sitemap reference
      const hasSitemapReference = content.toLowerCase().includes('sitemap:');

      if (!hasSitemapReference) {
        issues.push('Tip: Consider adding sitemap reference to robots.txt');
      }

      return {
        passed: issues.length === 0,
        message:
          issues.length === 0
            ? 'robots.txt is properly configured'
            : 'robots.txt has potential issues',
        details: {
          issues,
          hasSitemapReference,
          content: content.substring(0, 500), // First 500 chars
        },
      };
    }, 'checkRobotsTxtAccessible', {
      passOnError: true, // Gracefully degrade if check fails
      messagePrefix: 'robots.txt validation skipped due to error',
    });

    return { passed: result.passed, message: result.message, details: result.details, severity: result.severity };
  }
}
