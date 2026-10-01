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
      const captureSitewideLinks = this.sitewideTargetIndexes !== undefined;
      const linkData = await this.page.evaluate((captureTargets) => {
        const links = document.querySelectorAll('a[href],area[href]');
        const currentOrigin = window.location.origin;
        const hasNamedReference = (link: Element): boolean =>
          (link.getAttribute('aria-labelledby') ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .some((id) => Boolean(document.getElementById(id)?.textContent?.trim()));

        let internal = 0;
        let external = 0;
        let nofollow = 0;
        let withoutText = 0;
        let invalid = 0;
        let ignored = 0;
        const invalidPreviews: string[] = [];
        const candidateTargets = new Set<string>();
        let candidateTargetsTruncated = false;
        const maxCandidateTargets = 1_000;

        links.forEach((link) => {
          const href = link.getAttribute('href') || '';
          const text = link.textContent?.trim() || link.getAttribute('alt')?.trim() || '';
          const relTokens = (link.getAttribute('rel') || '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
          const hasImageName = Array.from(link.querySelectorAll('img[alt]')).some((image) =>
            Boolean(image.getAttribute('alt')?.trim())
          );
          const svg = link.querySelector('svg');
          const hasSvgName = Boolean(
            svg &&
            (svg.getAttribute('aria-label')?.trim() ||
              svg.querySelector('title')?.textContent?.trim())
          );
          const hasDirectName = Boolean(
            link.getAttribute('aria-label')?.trim() || link.getAttribute('title')?.trim()
          );

          try {
            if (href.startsWith('#') || /^(?:javascript|mailto|tel|sms|data|blob):/i.test(href)) {
              ignored += 1;
              return;
            }

            const url = new URL(href, window.location.href);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
              ignored += 1;
              return;
            }

            if (url.origin === currentOrigin) {
              internal += 1;
            } else {
              external += 1;
            }

            if (relTokens.includes('nofollow')) {
              nofollow += 1;
            }

            if (
              !text &&
              !hasImageName &&
              !hasSvgName &&
              !hasDirectName &&
              !hasNamedReference(link)
            ) {
              withoutText += 1;
            }

            if (
              captureTargets &&
              (url.protocol === 'http:' || url.protocol === 'https:') &&
              !url.username &&
              !url.password
            ) {
              url.hash = '';
              if (url.href.length > 2_048) {
                candidateTargetsTruncated = true;
              } else if (!candidateTargets.has(url.href)) {
                if (candidateTargets.size < maxCandidateTargets) {
                  candidateTargets.add(url.href);
                } else {
                  candidateTargetsTruncated = true;
                }
              }
            }
          } catch {
            invalid += 1;
            if (invalidPreviews.length < 10) invalidPreviews.push(href.slice(0, 256));
          }
        });

        return {
          total: links.length,
          internal,
          external,
          nofollow,
          withoutText,
          invalid,
          invalidPreviews,
          ignored,
          candidateTargets: [...candidateTargets],
          candidateTargetsTruncated,
        };
      }, captureSitewideLinks);
      const { candidateTargets, candidateTargetsTruncated, ...linkCounts } = linkData;
      const details: Record<string, unknown> = { ...linkCounts };
      if (this.sitewideTargetIndexes) {
        const sitewideLinkTargets: number[] = [];
        const maxTargetsPerPage = 250;
        let sitewideLinkTargetsTruncated = candidateTargetsTruncated;
        for (const target of candidateTargets) {
          const index = this.sitewideTargetIndexes.get(target);
          if (index === undefined) continue;
          if (sitewideLinkTargets.length >= maxTargetsPerPage) {
            sitewideLinkTargetsTruncated = true;
            break;
          }
          sitewideLinkTargets.push(index);
        }
        details.sitewideLinkTargets = sitewideLinkTargets;
        details.sitewideLinkTargetsTruncated = sitewideLinkTargetsTruncated;
      }

      const issues: string[] = [];

      if (linkData.total === 0) {
        return this.fail('No links found on page', details);
      }

      if (linkData.internal === 0) {
        issues.push('No internal links found');
      }

      if (linkData.withoutText > 0) {
        issues.push(`${linkData.withoutText} links without descriptive text`);
      }
      if (linkData.invalid > 0) {
        issues.push(`${linkData.invalid} invalid link URLs`);
      }

      if (issues.length > 0) {
        return this.fail(`Link structure issues: ${issues.join(', ')}`, details);
      }

      return this.pass(
        `Good link structure (${linkData.total} links: ${linkData.internal} internal, ${linkData.external} external)`,
        details
      );
    } catch (error) {
      return this.fail(
        `Error checking link structure: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkExternalLinks(): Promise<CheckOutcome> {
    try {
      const externalLinkData = await this.page.evaluate(() => {
        const links = document.querySelectorAll('a[href],area[href]');
        const currentOrigin = window.location.origin;
        let total = 0;
        let withoutNoopener = 0;
        let withNofollow = 0;
        let explicitlyOpener = 0;
        let implicitBlankNoopener = 0;

        links.forEach((link) => {
          const href = link.getAttribute('href') || '';
          const relTokens = new Set(
            (link.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean)
          );
          try {
            const url = new URL(href, window.location.href);
            if (
              (url.protocol !== 'http:' && url.protocol !== 'https:') ||
              url.origin === currentOrigin
            )
              return;
          } catch {
            // Ignore invalid URLs.
            return;
          }
          total += 1;
          if (relTokens.has('nofollow')) withNofollow += 1;

          const target = (link.getAttribute('target') || '').trim().toLowerCase();
          const opensSeparateContext =
            target !== '' && !['_self', '_parent', '_top'].includes(target);
          const explicitlyIsolated = relTokens.has('noopener') || relTokens.has('noreferrer');
          if (opensSeparateContext && relTokens.has('opener') && !explicitlyIsolated) {
            explicitlyOpener += 1;
          } else if (opensSeparateContext && target !== '_blank' && !explicitlyIsolated) {
            withoutNoopener += 1;
          } else if (opensSeparateContext && target === '_blank' && !explicitlyIsolated) {
            // Modern browsers implicitly apply noopener to target="_blank".
            implicitBlankNoopener += 1;
          }
        });
        return { total, withoutNoopener, withNofollow, explicitlyOpener, implicitBlankNoopener };
      });

      if (externalLinkData.total === 0) {
        return this.pass('No external links found');
      }

      const issues: string[] = [];
      if (externalLinkData.withoutNoopener > 0) {
        issues.push(
          `${externalLinkData.withoutNoopener} external links open named browsing contexts without rel="noopener" or rel="noreferrer"`
        );
      }
      if (externalLinkData.explicitlyOpener > 0) {
        issues.push(
          `${externalLinkData.explicitlyOpener} external links explicitly retain window.opener`
        );
      }

      if (issues.length > 0) {
        return this.fail(issues.join(', '), {
          total: externalLinkData.total,
          withoutNoopener: externalLinkData.withoutNoopener,
          explicitlyOpener: externalLinkData.explicitlyOpener,
          implicitBlankNoopener: externalLinkData.implicitBlankNoopener,
        });
      }

      return this.pass(`${externalLinkData.total} external links checked for opener isolation`, {
        total: externalLinkData.total,
        withoutNoopener: externalLinkData.withoutNoopener,
        explicitlyOpener: externalLinkData.explicitlyOpener,
        withNofollow: externalLinkData.withNofollow,
        implicitBlankNoopener: externalLinkData.implicitBlankNoopener,
      });
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'External links check skipped due to error',
      };
    }
  }

  private async checkInternalLinks(): Promise<CheckOutcome> {
    try {
      const internalLinkData = await this.page.evaluate(() => {
        const links = document.querySelectorAll('a[href],area[href]');
        const currentOrigin = window.location.origin;
        let total = 0;
        let withoutText = 0;
        const hasNamedReference = (link: Element): boolean =>
          (link.getAttribute('aria-labelledby') ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .some((id) => Boolean(document.getElementById(id)?.textContent?.trim()));

        links.forEach((link) => {
          const href = link.getAttribute('href') || '';
          if (href.startsWith('#') || href.startsWith('javascript:')) return;
          let isInternal = false;
          try {
            const url = new URL(href, window.location.href);
            isInternal =
              (url.protocol === 'http:' || url.protocol === 'https:') &&
              url.origin === currentOrigin;
          } catch {
            // Invalid link URLs are reported by the link-structure check.
            return;
          }
          if (!isInternal) return;
          total += 1;
          const text = link.textContent?.trim() || link.getAttribute('alt')?.trim() || '';
          const hasImageName = Array.from(link.querySelectorAll('img[alt]')).some((image) =>
            Boolean(image.getAttribute('alt')?.trim())
          );
          const svg = link.querySelector('svg');
          const hasSvgName = Boolean(
            svg &&
            (svg.getAttribute('aria-label')?.trim() ||
              svg.querySelector('title')?.textContent?.trim())
          );
          const hasDirectName = Boolean(
            link.getAttribute('aria-label')?.trim() || link.getAttribute('title')?.trim()
          );
          if (!text && !hasImageName && !hasSvgName && !hasDirectName && !hasNamedReference(link))
            withoutText += 1;
        });
        return { total, withoutText };
      });

      if (internalLinkData.total === 0) {
        return this.fail('No internal links found - important for SEO and site navigation');
      }

      if (internalLinkData.withoutText > 0) {
        return this.fail(
          `${internalLinkData.withoutText} internal links missing descriptive text`,
          {
            total: internalLinkData.total,
            withoutText: internalLinkData.withoutText,
          }
        );
      }

      return this.pass(`${internalLinkData.total} internal links with descriptive text`, {
        total: internalLinkData.total,
      });
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Internal links check skipped due to error',
      };
    }
  }
}
