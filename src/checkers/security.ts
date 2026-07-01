import { Page, Response } from 'playwright';
import { SEOCheckResult } from '../types';

export class SecurityChecker {
  constructor(private page: Page, private response: Response | null = null) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkHTTPS());
    results.push(await this.checkMixedContent());
    results.push(await this.checkSecurityHeaders());

    return results;
  }

  private async checkHTTPS(): Promise<SEOCheckResult> {
    const url = new URL(this.page.url());

    if (url.protocol === 'https:') {
      return {
        passed: true,
        message: 'Site is using HTTPS (secure connection)',
        details: { protocol: url.protocol },
      };
    } else {
      return {
        passed: false,
        message: 'Site is not using HTTPS - this negatively impacts SEO and user trust',
        details: { protocol: url.protocol },
      };
    }
  }

  private async checkMixedContent(): Promise<SEOCheckResult> {
    const url = new URL(this.page.url());

    if (url.protocol !== 'https:') {
      return {
        passed: true,
        message: 'Mixed content check skipped (not HTTPS)',
      };
    }

    try {
      // Check for HTTP resources on HTTPS page
      const mixedContent = await this.page.evaluate(() => {
        const resources: string[] = [];

        // Check images
        document.querySelectorAll('img[src^="http://"]').forEach((img) => {
          resources.push(`Image: ${img.getAttribute('src')}`);
        });

        // Check scripts
        document.querySelectorAll('script[src^="http://"]').forEach((script) => {
          resources.push(`Script: ${script.getAttribute('src')}`);
        });

        // Check stylesheets
        document.querySelectorAll('link[rel="stylesheet"][href^="http://"]').forEach((link) => {
          resources.push(`Stylesheet: ${link.getAttribute('href')}`);
        });

        return resources;
      });

      if (mixedContent.length > 0) {
        return {
          passed: false,
          message: `Found ${mixedContent.length} mixed content resources (HTTP on HTTPS page)`,
          details: {
            mixedContent: mixedContent.slice(0, 10), // First 10
            total: mixedContent.length,
          },
        };
      }

      return {
        passed: true,
        message: 'No mixed content detected',
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Mixed content check skipped due to error',
      };
    }
  }

  private async checkSecurityHeaders(): Promise<SEOCheckResult> {
    try {
      if (!this.response) {
        return {
          passed: false,
          message: 'Could not check security headers - no response available',
        };
      }

      const headers = this.response.headers();
      const securityHeaders = {
        'strict-transport-security': headers['strict-transport-security'],
        'x-content-type-options': headers['x-content-type-options'],
        'x-frame-options': headers['x-frame-options'],
        'content-security-policy': headers['content-security-policy'],
      };

      const presentHeaders = Object.entries(securityHeaders).filter(([_, value]) => value);
      const missingHeaders = Object.entries(securityHeaders)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingHeaders.length === 0) {
        return {
          passed: true,
          message: 'All important security headers are present',
          details: { headers: securityHeaders },
        };
      } else {
        return {
          passed: false,
          message: `Missing ${missingHeaders.length} security headers`,
          details: {
            present: presentHeaders.map(([key]) => key),
            missing: missingHeaders,
          },
        };
      }
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Security headers check skipped due to error',
      };
    }
  }
}
