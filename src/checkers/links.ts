import { BaseChecker, CheckOutcome } from './base';

export class LinksChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'link-structure-valid', run: () => this.checkLinkStructure() },
      { id: 'external-links-secure', run: () => this.checkExternalLinks() },
      { id: 'internal-links-descriptive', run: () => this.checkInternalLinks() },
    ];
  }

  private async checkLinkStructure(): Promise<CheckOutcome> {
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
        return this.fail('No links found on page', linkData);
      }

      if (linkData.internal === 0) {
        issues.push('No internal links found');
      }

      if (linkData.withoutText > 0) {
        issues.push(`${linkData.withoutText} links without descriptive text`);
      }

      if (issues.length > 0) {
        return this.fail(`Link structure issues: ${issues.join(', ')}`, linkData);
      }

      return this.pass(
        `Good link structure (${linkData.total} links: ${linkData.internal} internal, ${linkData.external} external)`,
        linkData
      );
    } catch (error) {
      return this.fail(
        `Error checking link structure: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkExternalLinks(): Promise<CheckOutcome> {
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
        return this.pass('No external links found');
      }

      const issues: string[] = [];
      const linksWithoutNoopener = externalLinks.filter((link: any) => !link.hasNoopener);

      if (linksWithoutNoopener.length > 0) {
        issues.push(
          `${linksWithoutNoopener.length} external links missing rel="noopener" (security risk)`
        );
      }

      if (issues.length > 0) {
        return this.fail(issues.join(', '), {
          total: externalLinks.length,
          withoutNoopener: linksWithoutNoopener.length,
        });
      }

      return this.pass(`${externalLinks.length} external links properly configured`, {
        total: externalLinks.length,
        withNofollow: externalLinks.filter((link: any) => link.hasNofollow).length,
      });
    } catch (error) {
      return { passed: false, severity: 'info', message: 'External links check skipped due to error' };
    }
  }

  private async checkInternalLinks(): Promise<CheckOutcome> {
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
        return this.fail('No internal links found - important for SEO and site navigation');
      }

      const linksWithoutText = internalLinks.filter((link: any) => !link.hasText);

      if (linksWithoutText.length > 0) {
        return this.fail(`${linksWithoutText.length} internal links missing descriptive text`, {
          total: internalLinks.length,
          withoutText: linksWithoutText.length,
        });
      }

      return this.pass(`${internalLinks.length} internal links with descriptive text`, {
        total: internalLinks.length,
      });
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Internal links check skipped due to error' };
    }
  }
}
