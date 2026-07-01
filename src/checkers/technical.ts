import { Page, Response } from 'playwright';
import { SEOCheckResult } from '../types';

export class TechnicalChecker {
  constructor(private page: Page, private response: Response | null = null) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkResponseCode());
    results.push(await this.checkPageSize());
    results.push(await this.checkCompression());
    results.push(await this.checkDuplicateTitles());

    return results;
  }

  private async checkResponseCode(): Promise<SEOCheckResult> {
    try {
      if (!this.response) {
        return {
          passed: false,
          message: 'Could not get response from page',
        };
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
            details: {
              status,
              url,
              redirectCount,
            },
          };
        }

        return {
          passed: true,
          message: 'Page returns 200 OK status with no redirects',
          details: { status, url },
        };
      } else if (status >= 300 && status < 400) {
        return {
          passed: false,
          message: `Page returns redirect status ${status} - should return 200`,
          details: { status, url },
        };
      } else if (status === 404) {
        return {
          passed: false,
          message: 'Page not found (404 error)',
          details: { status, url },
        };
      } else if (status >= 400 && status < 500) {
        return {
          passed: false,
          message: `Client error: ${status}`,
          details: { status, url },
        };
      } else if (status >= 500) {
        return {
          passed: false,
          message: `Server error: ${status}`,
          details: { status, url },
        };
      }

      return {
        passed: false,
        message: `Unexpected status code: ${status}`,
        details: { status, url },
      };
    } catch (error) {
      return {
        passed: false,
        message: `Error checking response code: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkPageSize(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `HTML size is large (${pageSize.htmlSizeKB} KB). Recommended: under 100 KB`,
          details: pageSize,
        };
      } else if (pageSize.htmlSizeKB > 100) {
        return {
          passed: true,
          message: `HTML size is acceptable (${pageSize.htmlSizeKB} KB) but could be optimized`,
          details: pageSize,
        };
      }

      return {
        passed: true,
        message: `HTML size is optimal (${pageSize.htmlSizeKB} KB)`,
        details: pageSize,
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Page size check skipped due to error',
      };
    }
  }

  private async checkCompression(): Promise<SEOCheckResult> {
    try {
      if (!this.response) {
        return {
          passed: false,
          message: 'Could not check compression - no response',
        };
      }

      const headers = this.response.headers();
      const contentEncoding = headers['content-encoding'];
      const hasCompression = contentEncoding && (
        contentEncoding.includes('gzip') ||
        contentEncoding.includes('br') ||
        contentEncoding.includes('deflate')
      );

      if (!hasCompression) {
        return {
          passed: false,
          message: 'No compression detected - enable gzip/brotli compression for better performance',
          details: {
            'content-encoding': contentEncoding || 'none',
          },
        };
      }

      return {
        passed: true,
        message: `Compression enabled (${contentEncoding})`,
        details: {
          'content-encoding': contentEncoding,
        },
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Compression check skipped due to error',
      };
    }
  }

  private async checkDuplicateTitles(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Heading issues: ${issues.join(', ')}`,
          details: duplicates,
        };
      }

      return {
        passed: true,
        message: duplicates.h1MatchesTitle
          ? 'H1 and Title are optimally aligned'
          : 'H1 structure is correct (different from title is acceptable)',
        details: duplicates,
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Duplicate title check skipped due to error',
      };
    }
  }
}
