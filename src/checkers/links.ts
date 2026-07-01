import { Page } from 'playwright';
import { SEOCheckResult } from '../types';

export class LinksChecker {
  constructor(private page: Page) { }

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkLinkStructure());
    results.push(await this.checkExternalLinks());
    results.push(await this.checkInternalLinks());

    return results;
  }

  private async checkLinkStructure(): Promise<SEOCheckResult> {
    try {
      const linkData = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const currentHost = window.location.hostname;

        const internal: string[] = [];
        const external: string[] = [];
        const nofollow: string[] = [];
        const withoutText: string[] = [];

        links.forEach((link) => {
          const href = link.getAttribute('href') || '';
          const text = link.textContent?.trim() || '';
          const rel = link.getAttribute('rel') || '';

          try {
            if (href.startsWith('#') || href.startsWith('javascript:')) {
              return; // Skip anchors and javascript links
            }

            const url = new URL(href, window.location.href);

            if (url.hostname === currentHost) {
              internal.push(href);
            } else {
              external.push(href);
            }

            if (rel.includes('nofollow')) {
              nofollow.push(href);
            }

            if (!text && !link.querySelector('img') && !link.querySelector('svg') && !link.getAttribute('aria-label')) {
              withoutText.push(href);
            }
          } catch {
            // Invalid URL, treat as internal
            internal.push(href);
          }
        });

        return {
          total: links.length,
          internal: internal.length,
          external: external.length,
          nofollow: nofollow.length,
          withoutText: withoutText.length,
        };
      });

      const issues: string[] = [];

      if (linkData.total === 0) {
        return {
          passed: false,
          message: 'No links found on page',
          details: linkData,
        };
      }

      if (linkData.internal === 0) {
        issues.push('No internal links found');
      }

      if (linkData.withoutText > 0) {
        issues.push(`${linkData.withoutText} links without descriptive text`);
      }

      if (issues.length > 0) {
        return {
          passed: false,
          message: `Link structure issues: ${issues.join(', ')}`,
          details: linkData,
        };
      }

      return {
        passed: true,
        message: `Good link structure (${linkData.total} links: ${linkData.internal} internal, ${linkData.external} external)`,
        details: linkData,
      };
    } catch (error) {
      return {
        passed: false,
        message: `Error checking link structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkExternalLinks(): Promise<SEOCheckResult> {
    try {
      const externalLinks = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const currentHost = window.location.hostname;

        return links
          .map((link) => {
            const href = link.getAttribute('href') || '';
            const rel = link.getAttribute('rel') || '';
            const target = link.getAttribute('target') || '';

            try {
              const url = new URL(href, window.location.href);
              if (url.hostname !== currentHost) {
                return {
                  href,
                  rel,
                  target,
                  hasNofollow: rel.includes('nofollow'),
                  hasNoopener: rel.includes('noopener'),
                  hasNoreferrer: rel.includes('noreferrer'),
                };
              }
            } catch {
              // Invalid URL
            }
            return null;
          })
          .filter((link) => link !== null);
      });

      if (externalLinks.length === 0) {
        return {
          passed: true,
          message: 'No external links found',
        };
      }

      const issues: string[] = [];
      const linksWithoutNoopener = externalLinks.filter((link: any) => !link.hasNoopener);

      if (linksWithoutNoopener.length > 0) {
        issues.push(
          `${linksWithoutNoopener.length} external links missing rel="noopener" (security risk)`
        );
      }

      if (issues.length > 0) {
        return {
          passed: false,
          message: issues.join(', '),
          details: {
            total: externalLinks.length,
            withoutNoopener: linksWithoutNoopener.length,
          },
        };
      }

      return {
        passed: true,
        message: `${externalLinks.length} external links properly configured`,
        details: {
          total: externalLinks.length,
          withNofollow: externalLinks.filter((link: any) => link.hasNofollow).length,
        },
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'External links check skipped due to error',
      };
    }
  }

  private async checkInternalLinks(): Promise<SEOCheckResult> {
    try {
      const internalLinks = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const currentHost = window.location.hostname;

        return links
          .map((link) => {
            const href = link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '';

            if (href.startsWith('#') || href.startsWith('javascript:')) {
              return null;
            }

            try {
              const url = new URL(href, window.location.href);
              if (url.hostname === currentHost) {
                return { href, text, hasText: text.length > 0 };
              }
            } catch {
              // Relative URL, treat as internal
              return { href, text, hasText: text.length > 0 };
            }
            return null;
          })
          .filter((link) => link !== null);
      });

      if (internalLinks.length === 0) {
        return {
          passed: false,
          message: 'No internal links found - important for SEO and site navigation',
        };
      }

      const linksWithoutText = internalLinks.filter((link: any) => !link.hasText);

      if (linksWithoutText.length > 0) {
        return {
          passed: false,
          message: `${linksWithoutText.length} internal links missing descriptive text`,
          details: {
            total: internalLinks.length,
            withoutText: linksWithoutText.length,
          },
        };
      }

      return {
        passed: true,
        message: `${internalLinks.length} internal links with descriptive text`,
        details: { total: internalLinks.length },
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Internal links check skipped due to error',
      };
    }
  }
}
