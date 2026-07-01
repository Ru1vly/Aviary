import { Page } from 'playwright';
import { SEOCheckResult } from '../types';

export class URLFactorsChecker {
  constructor(private page: Page) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkURLLength());
    results.push(await this.checkURLReadability());
    results.push(await this.checkURLStructure());
    results.push(await this.checkURLKeywords());
    results.push(await this.checkURLSpecialCharacters());
    results.push(await this.checkURLCase());
    results.push(await this.checkURLParameters());
    results.push(await this.checkURLDepth());
    results.push(await this.checkFileExtension());
    results.push(await this.checkTrailingSlash());

    return results;
  }

  private async checkURLLength(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const urlLength = url.length;

      if (urlLength > 100) {
        return {
          passed: false,
          message: `URL is too long (${urlLength} characters). Recommended: under 75 characters`,
          details: { url, length: urlLength },
        };
      } else if (urlLength > 75) {
        return {
          passed: true,
          message: `URL length is acceptable (${urlLength} characters) but could be shorter`,
          details: { url, length: urlLength },
        };
      }

      return {
        passed: true,
        message: `URL length is optimal (${urlLength} characters)`,
        details: { url, length: urlLength },
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Error checking URL length',
      };
    }
  }

  private async checkURLReadability(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;

      // Check for human-readable words (not just random characters/IDs)
      const hasNumbers = /\d{3,}/.test(pathname); // 3+ consecutive numbers (likely IDs)
      const hasSpecialChars = /[^a-zA-Z0-9\-_\/.]/.test(pathname);
      const hasHyphens = pathname.includes('-');
      const hasUnderscores = pathname.includes('_');
      const words = pathname.split(/[\/-]/).filter((part: string) => part.length > 0);

      const issues: string[] = [];

      if (hasNumbers) {
        issues.push('URL contains numeric IDs (prefer descriptive slugs)');
      }

      if (hasSpecialChars) {
        issues.push('URL contains special characters (use only letters, numbers, hyphens)');
      }

      if (hasUnderscores) {
        issues.push('URL uses underscores (hyphens are preferred for SEO)');
      }

      if (words.length === 0) {
        issues.push('URL has no descriptive words');
      }

      if (issues.length > 0) {
        return {
          passed: false,
          message: `URL readability issues: ${issues.join(', ')}`,
          details: { pathname, hasNumbers, hasSpecialChars, hasHyphens, hasUnderscores },
        };
      }

      return {
        passed: true,
        message: hasHyphens ? 'URL is human-readable and SEO-friendly' : 'URL is readable',
        details: { pathname, words: words.length },
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Error checking URL readability',
      };
    }
  }

  private async checkURLStructure(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const parsedUrl = new URL(url);

      const hasWWW = parsedUrl.hostname.startsWith('www.');
      const protocol = parsedUrl.protocol;
      const pathname = parsedUrl.pathname;

      // Check for logical hierarchy
      const segments = pathname.split('/').filter((s: string) => s.length > 0);
      const hasLogicalHierarchy = segments.every((seg: string) => seg.length > 2);

      return {
        passed: hasLogicalHierarchy,
        message: hasLogicalHierarchy
          ? `URL has logical hierarchy (${segments.length} levels)`
          : 'URL structure could be more logical',
        details: {
          protocol,
          hasWWW,
          segments,
          depth: segments.length,
        },
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Error checking URL structure',
      };
    }
  }

  private async checkURLKeywords(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;
      const title = await this.page.title();

      // Extract words from pathname
      const urlWords = pathname
        .toLowerCase()
        .split(/[\/-]/)
        .filter((w: string) => w.length > 3);

      // Extract words from title
      const titleWords = title
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3);

      // Find matching keywords
      const matchingKeywords = urlWords.filter((word: string) =>
        titleWords.some((titleWord: string) => titleWord.includes(word) || word.includes(titleWord))
      );

      if (matchingKeywords.length === 0) {
        return {
          passed: false,
          message: 'URL does not contain keywords from page title',
          details: { urlWords, titleWords },
        };
      }

      return {
        passed: true,
        message: `URL contains ${matchingKeywords.length} keyword(s) from title`,
        details: { matchingKeywords },
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'URL keyword check skipped due to error',
      };
    }
  }

  private async checkURLSpecialCharacters(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const decodedUrl = decodeURIComponent(url);

      const hasEncodedCharacters = url !== decodedUrl;
      const hasSpecialChars = /[^a-zA-Z0-9\-_\/.:?&=]/.test(decodedUrl);

      if (hasEncodedCharacters || hasSpecialChars) {
        return {
          passed: false,
          message: 'URL contains encoded or special characters (prefer clean URLs)',
          details: { url, decodedUrl, hasEncodedCharacters, hasSpecialChars },
        };
      }

      return {
        passed: true,
        message: 'URL uses clean, standard characters',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'URL special characters check skipped',
      };
    }
  }

  private async checkURLCase(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;

      const hasUpperCase = /[A-Z]/.test(pathname);

      if (hasUpperCase) {
        return {
          passed: false,
          message: 'URL contains uppercase letters (lowercase is recommended)',
          details: { pathname },
        };
      }

      return {
        passed: true,
        message: 'URL uses lowercase letters (best practice)',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'URL case check skipped',
      };
    }
  }

  private async checkURLParameters(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const params = new URL(url).searchParams;
      const paramCount = Array.from(params.keys()).length;

      // Check for session IDs or tracking parameters
      const sessionParams = ['sessionid', 'sid', 'phpsessid', 'jsessionid'];
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];

      const hasSessionParams = Array.from(params.keys()).some((key: string) =>
        sessionParams.some((sp: string) => key.toLowerCase().includes(sp))
      );

      const hasTrackingParams = Array.from(params.keys()).some((key: string) =>
        trackingParams.includes(key.toLowerCase())
      );

      if (hasSessionParams) {
        return {
          passed: false,
          message: 'URL contains session parameters (can cause duplicate content)',
          details: { paramCount, params: Array.from(params.keys()) },
        };
      }

      if (paramCount > 3 && !hasTrackingParams) {
        return {
          passed: false,
          message: `URL has many parameters (${paramCount}). Consider cleaner URLs`,
          details: { paramCount },
        };
      }

      return {
        passed: true,
        message: paramCount === 0 ? 'Clean URL with no parameters' : `URL has ${paramCount} parameter(s)`,
        details: { paramCount, hasTrackingParams },
      };
    } catch (error) {
      return {
        passed: true,
        message: 'URL parameters check skipped',
      };
    }
  }

  private async checkURLDepth(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;
      const depth = pathname.split('/').filter((s: string) => s.length > 0).length;

      if (depth > 4) {
        return {
          passed: false,
          message: `URL depth is too deep (${depth} levels). Recommended: 3 or fewer`,
          details: { depth, pathname },
        };
      } else if (depth > 3) {
        return {
          passed: true,
          message: `URL depth is acceptable (${depth} levels)`,
          details: { depth },
        };
      }

      return {
        passed: true,
        message: `URL depth is optimal (${depth} levels)`,
        details: { depth },
      };
    } catch (error) {
      return {
        passed: true,
        message: 'URL depth check skipped',
      };
    }
  }

  private async checkFileExtension(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;

      const hasExtension = /\.(html|htm|php|asp|jsp)$/i.test(pathname);

      if (hasExtension) {
        return {
          passed: false,
          message: 'URL contains file extension (clean URLs are preferred)',
          details: { pathname },
        };
      }

      return {
        passed: true,
        message: 'URL is clean without file extension',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'File extension check skipped',
      };
    }
  }

  private async checkTrailingSlash(): Promise<SEOCheckResult> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;

      const hasTrailingSlash = pathname.endsWith('/');
      const isRoot = pathname === '/';

      if (!isRoot && !hasTrailingSlash) {
        return {
          passed: true,
          message: 'URL without trailing slash (ensure consistent usage across site)',
          details: { pathname, hasTrailingSlash },
        };
      }

      return {
        passed: true,
        message: hasTrailingSlash ? 'URL has trailing slash' : 'URL structure is consistent',
        details: { pathname, hasTrailingSlash },
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Trailing slash check skipped',
      };
    }
  }
}
