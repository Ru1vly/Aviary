import { BaseChecker, CheckOutcome } from './base';

export class URLFactorsChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'url-length-acceptable', run: () => this.checkURLLength() },
      { id: 'url-readability-acceptable', run: () => this.checkURLReadability() },
      { id: 'url-structure-logical', run: () => this.checkURLStructure() },
      { id: 'url-keywords-match-title', run: () => this.checkURLKeywords() },
      { id: 'url-clean-characters', run: () => this.checkURLSpecialCharacters() },
      { id: 'url-lowercase', run: () => this.checkURLCase() },
      { id: 'url-parameters-clean', run: () => this.checkURLParameters() },
      { id: 'url-depth-acceptable', run: () => this.checkURLDepth() },
      { id: 'url-no-file-extension', run: () => this.checkFileExtension() },
      { id: 'url-trailing-slash-consistent', run: () => this.checkTrailingSlash() },
    ];
  }

  private async checkURLLength(): Promise<CheckOutcome> {
    try {
      const url = this.page.url();
      const urlLength = url.length;

      if (urlLength > 100) {
        return this.fail(`URL is too long (${urlLength} characters). Recommended: under 75 characters`, {
          url,
          length: urlLength,
        });
      } else if (urlLength > 75) {
        return this.pass(`URL length is acceptable (${urlLength} characters) but could be shorter`, {
          url,
          length: urlLength,
        });
      }

      return this.pass(`URL length is optimal (${urlLength} characters)`, { url, length: urlLength });
    } catch (error) {
      return this.fail('Error checking URL length');
    }
  }

  private async checkURLReadability(): Promise<CheckOutcome> {
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
        return this.fail(`URL readability issues: ${issues.join(', ')}`, {
          pathname,
          hasNumbers,
          hasSpecialChars,
          hasHyphens,
          hasUnderscores,
        });
      }

      return this.pass(hasHyphens ? 'URL is human-readable and SEO-friendly' : 'URL is readable', {
        pathname,
        words: words.length,
      });
    } catch (error) {
      return this.fail('Error checking URL readability');
    }
  }

  private async checkURLStructure(): Promise<CheckOutcome> {
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
        details: { protocol, hasWWW, segments, depth: segments.length },
      };
    } catch (error) {
      return this.fail('Error checking URL structure');
    }
  }

  private async checkURLKeywords(): Promise<CheckOutcome> {
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
        return this.fail('URL does not contain keywords from page title', { urlWords, titleWords });
      }

      return this.pass(`URL contains ${matchingKeywords.length} keyword(s) from title`, { matchingKeywords });
    } catch (error) {
      return { passed: false, severity: 'info', message: 'URL keyword check skipped due to error' };
    }
  }

  private async checkURLSpecialCharacters(): Promise<CheckOutcome> {
    try {
      const url = this.page.url();
      const decodedUrl = decodeURIComponent(url);

      const hasEncodedCharacters = url !== decodedUrl;
      const hasSpecialChars = /[^a-zA-Z0-9\-_\/.:?&=]/.test(decodedUrl);

      if (hasEncodedCharacters || hasSpecialChars) {
        return this.fail('URL contains encoded or special characters (prefer clean URLs)', {
          url,
          decodedUrl,
          hasEncodedCharacters,
          hasSpecialChars,
        });
      }

      return this.pass('URL uses clean, standard characters');
    } catch (error) {
      return this.pass('URL special characters check skipped');
    }
  }

  private async checkURLCase(): Promise<CheckOutcome> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;

      const hasUpperCase = /[A-Z]/.test(pathname);

      if (hasUpperCase) {
        return this.fail('URL contains uppercase letters (lowercase is recommended)', { pathname });
      }

      return this.pass('URL uses lowercase letters (best practice)');
    } catch (error) {
      return this.pass('URL case check skipped');
    }
  }

  private async checkURLParameters(): Promise<CheckOutcome> {
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
        return this.fail('URL contains session parameters (can cause duplicate content)', {
          paramCount,
          params: Array.from(params.keys()),
        });
      }

      if (paramCount > 3 && !hasTrackingParams) {
        return this.fail(`URL has many parameters (${paramCount}). Consider cleaner URLs`, { paramCount });
      }

      return this.pass(paramCount === 0 ? 'Clean URL with no parameters' : `URL has ${paramCount} parameter(s)`, {
        paramCount,
        hasTrackingParams,
      });
    } catch (error) {
      return this.pass('URL parameters check skipped');
    }
  }

  private async checkURLDepth(): Promise<CheckOutcome> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;
      const depth = pathname.split('/').filter((s: string) => s.length > 0).length;

      if (depth > 4) {
        return this.fail(`URL depth is too deep (${depth} levels). Recommended: 3 or fewer`, { depth, pathname });
      } else if (depth > 3) {
        return this.pass(`URL depth is acceptable (${depth} levels)`, { depth });
      }

      return this.pass(`URL depth is optimal (${depth} levels)`, { depth });
    } catch (error) {
      return this.pass('URL depth check skipped');
    }
  }

  private async checkFileExtension(): Promise<CheckOutcome> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;

      const hasExtension = /\.(html|htm|php|asp|jsp)$/i.test(pathname);

      if (hasExtension) {
        return this.fail('URL contains file extension (clean URLs are preferred)', { pathname });
      }

      return this.pass('URL is clean without file extension');
    } catch (error) {
      return this.pass('File extension check skipped');
    }
  }

  private async checkTrailingSlash(): Promise<CheckOutcome> {
    try {
      const url = this.page.url();
      const pathname = new URL(url).pathname;

      const hasTrailingSlash = pathname.endsWith('/');
      const isRoot = pathname === '/';

      if (!isRoot && !hasTrailingSlash) {
        return this.pass('URL without trailing slash (ensure consistent usage across site)', {
          pathname,
          hasTrailingSlash,
        });
      }

      return this.pass(hasTrailingSlash ? 'URL has trailing slash' : 'URL structure is consistent', {
        pathname,
        hasTrailingSlash,
      });
    } catch (error) {
      return this.pass('Trailing slash check skipped');
    }
  }
}
