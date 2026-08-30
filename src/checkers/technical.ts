import { BaseChecker, CheckOutcome } from './base';

export class TechnicalChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'response-code-valid', run: () => this.checkResponseCode() },
      { id: 'page-size-acceptable', run: () => this.checkPageSize() },
      { id: 'compression-enabled', run: () => this.checkCompression() },
      { id: 'h1-structure-valid', run: () => this.checkDuplicateTitles() },
    ];
  }

  private async checkResponseCode(): Promise<CheckOutcome> {
    try {
      if (!this.response) {
        return this.fail('Could not get response from page');
      }

      const status = this.response.status();
      const url = this.response.url();
      const chain = this.response.request().redirectedFrom();

      // Count redirect chain
      let redirectCount = 0;
      let current = chain;
      while (current) {
        redirectCount++;
        current = current.redirectedFrom();
      }

      if (status === 200) {
        if (redirectCount > 0) {
          return {
            passed: redirectCount <= 1,
            message:
              redirectCount === 1
                ? 'Page accessible with 1 redirect (acceptable)'
                : `Warning: Page has ${redirectCount} redirects in chain (should be minimized)`,
            details: { status, url, redirectCount },
          };
        }

        return this.pass('Page returns 200 OK status with no redirects', { status, url });
      } else if (status >= 300 && status < 400) {
        return this.fail(`Page returns redirect status ${status} - should return 200`, { status, url });
      } else if (status === 404) {
        return this.fail('Page not found (404 error)', { status, url });
      } else if (status >= 400 && status < 500) {
        return this.fail(`Client error: ${status}`, { status, url });
      } else if (status >= 500) {
        return this.fail(`Server error: ${status}`, { status, url });
      }

      return this.fail(`Unexpected status code: ${status}`, { status, url });
    } catch (error) {
      return this.fail(
        `Error checking response code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkPageSize(): Promise<CheckOutcome> {
    try {
      const pageSize = await this.page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        return {
          htmlSize: html.length,
          htmlSizeKB: Math.round(html.length / 1024),
        };
      });

      // Recommended: HTML size should be under 100KB for optimal performance
      if (pageSize.htmlSizeKB > 200) {
        return this.fail(`HTML size is large (${pageSize.htmlSizeKB} KB). Recommended: under 100 KB`, pageSize);
      } else if (pageSize.htmlSizeKB > 100) {
        return this.pass(`HTML size is acceptable (${pageSize.htmlSizeKB} KB) but could be optimized`, pageSize);
      }

      return this.pass(`HTML size is optimal (${pageSize.htmlSizeKB} KB)`, pageSize);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Page size check skipped due to error' };
    }
  }

  private async checkCompression(): Promise<CheckOutcome> {
    try {
      if (!this.response) {
        return this.fail('Could not check compression - no response');
      }

      const headers = this.response.headers();
      const contentEncoding = headers['content-encoding'];
      const hasCompression = contentEncoding && (
        contentEncoding.includes('gzip') ||
        contentEncoding.includes('br') ||
        contentEncoding.includes('deflate')
      );

      if (!hasCompression) {
        return this.fail('No compression detected - enable gzip/brotli compression for better performance', {
          'content-encoding': contentEncoding || 'none',
        });
      }

      return this.pass(`Compression enabled (${contentEncoding})`, { 'content-encoding': contentEncoding });
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Compression check skipped due to error' };
    }
  }

  private async checkDuplicateTitles(): Promise<CheckOutcome> {
    try {
      const duplicates = await this.page.evaluate(() => {
        const title = document.title;
        const h1Elements = Array.from(document.querySelectorAll('h1'));

        const h1Texts = h1Elements.map((el) => el.textContent?.trim() || '');
        const duplicateH1s = h1Texts.filter(
          (text, index, self) => text && self.indexOf(text) !== index
        );

        const h1MatchesTitle = h1Texts.some(
          (h1Text) => h1Text.toLowerCase() === title.toLowerCase()
        );

        return {
          h1Count: h1Elements.length,
          h1Texts,
          hasDuplicateH1s: duplicateH1s.length > 0,
          duplicateH1s,
          h1MatchesTitle,
          title,
        };
      });

      const issues: string[] = [];

      if (duplicates.h1Count === 0) {
        issues.push('No H1 heading found');
      } else if (duplicates.h1Count > 1) {
        issues.push(`Multiple H1 tags found (${duplicates.h1Count}). Recommended: 1 per page`);
      }

      if (duplicates.hasDuplicateH1s) {
        issues.push('Duplicate H1 content found');
      }

      if (issues.length > 0) {
        return this.fail(`Heading issues: ${issues.join(', ')}`, duplicates);
      }

      return this.pass(
        duplicates.h1MatchesTitle
          ? 'H1 and Title are optimally aligned'
          : 'H1 structure is correct (different from title is acceptable)',
        duplicates
      );
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Duplicate title check skipped due to error' };
    }
  }
}
