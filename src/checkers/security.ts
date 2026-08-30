import { BaseChecker, CheckOutcome } from './base';

export class SecurityChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'https-enabled', run: () => this.checkHTTPS() },
      { id: 'mixed-content-check', run: () => this.checkMixedContent() },
      { id: 'security-headers', run: () => this.checkSecurityHeaders() },
    ];
  }

  private async checkHTTPS(): Promise<CheckOutcome> {
    const url = new URL(this.page.url());

    if (url.protocol === 'https:') {
      return this.pass('Site is using HTTPS (secure connection)', { protocol: url.protocol });
    } else {
      return this.fail('Site is not using HTTPS - this negatively impacts SEO and user trust', {
        protocol: url.protocol,
      });
    }
  }

  private async checkMixedContent(): Promise<CheckOutcome> {
    const url = new URL(this.page.url());

    if (url.protocol !== 'https:') {
      return this.pass('Mixed content check skipped (not HTTPS)');
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
        return this.fail(`Found ${mixedContent.length} mixed content resources (HTTP on HTTPS page)`, {
          mixedContent: mixedContent.slice(0, 10), // First 10
          total: mixedContent.length,
        });
      }

      return this.pass('No mixed content detected');
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Mixed content check skipped due to error' };
    }
  }

  private async checkSecurityHeaders(): Promise<CheckOutcome> {
    try {
      if (!this.response) {
        return this.fail('Could not check security headers - no response available');
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
        return this.pass('All important security headers are present', { headers: securityHeaders });
      } else {
        return this.fail(`Missing ${missingHeaders.length} security headers`, {
          present: presentHeaders.map(([key]) => key),
          missing: missingHeaders,
        });
      }
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Security headers check skipped due to error' };
    }
  }
}
