import { BaseChecker, CheckOutcome } from './base';

export class UIElementsChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'favicon-present', run: () => this.checkFavicon() },
      { id: 'breadcrumbs-structured', run: () => this.checkBreadcrumbs() },
      { id: 'language-tags-configured', run: () => this.checkLanguageTags() },
      { id: 'mobile-viewport-configured', run: () => this.checkMobileViewport() },
    ];
  }

  private async checkFavicon(): Promise<CheckOutcome> {
    try {
      const faviconData = await this.page.evaluate(() => {
        const faviconLinks = [
          document.querySelector('link[rel="icon"]'),
          document.querySelector('link[rel="shortcut icon"]'),
          document.querySelector('link[rel="apple-touch-icon"]'),
        ];

        const favicons = faviconLinks
          .filter((link) => link !== null)
          .map((link) => ({
            rel: link?.getAttribute('rel'),
            href: link?.getAttribute('href'),
            type: link?.getAttribute('type'),
          }));

        return {
          hasFavicon: favicons.length > 0,
          favicons,
        };
      });

      if (!faviconData.hasFavicon) {
        return this.fail('No favicon found - important for branding and user experience');
      }

      return this.pass(`Favicon found (${faviconData.favicons.length} icon(s) defined)`, faviconData);
    } catch (error) {
      return this.fail(`Error checking favicon: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkBreadcrumbs(): Promise<CheckOutcome> {
    try {
      const breadcrumbsData = await this.page.evaluate(() => {
        // Check for structured data breadcrumbs (JSON-LD)
        const jsonLdBreadcrumbs = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]')
        )
          .map((script) => {
            try {
              const data = JSON.parse(script.textContent || '{}');
              return data['@type'] === 'BreadcrumbList' ? data : null;
            } catch {
              return null;
            }
          })
          .filter((data) => data !== null);

        // Check for Microdata breadcrumbs
        const microdataBreadcrumbs = document.querySelectorAll(
          '[itemtype*="BreadcrumbList"]'
        );

        // Check for common breadcrumb HTML patterns
        const commonBreadcrumbs = document.querySelectorAll(
          '[class*="breadcrumb"], [id*="breadcrumb"], nav ol, nav ul'
        );

        return {
          hasJsonLd: jsonLdBreadcrumbs.length > 0,
          hasMicrodata: microdataBreadcrumbs.length > 0,
          hasHtmlBreadcrumbs: commonBreadcrumbs.length > 0,
          jsonLdCount: jsonLdBreadcrumbs.length,
          microdataCount: microdataBreadcrumbs.length,
          htmlCount: commonBreadcrumbs.length,
        };
      });

      if (!breadcrumbsData.hasJsonLd && !breadcrumbsData.hasMicrodata) {
        return this.fail(
          breadcrumbsData.hasHtmlBreadcrumbs
            ? 'Breadcrumbs found but missing structured data (JSON-LD or Microdata)'
            : 'No breadcrumbs found - important for navigation and SEO',
          breadcrumbsData
        );
      }

      return this.pass('Breadcrumbs properly implemented with structured data', breadcrumbsData);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Breadcrumbs check skipped due to error' };
    }
  }

  private async checkLanguageTags(): Promise<CheckOutcome> {
    try {
      const languageData = await this.page.evaluate(() => {
        const htmlLang = document.documentElement.getAttribute('lang');
        const hreflangLinks = Array.from(
          document.querySelectorAll('link[rel="alternate"][hreflang]')
        ).map((link) => ({
          hreflang: link.getAttribute('hreflang'),
          href: link.getAttribute('href'),
        }));

        const ogLocale = document
          .querySelector('meta[property="og:locale"]')
          ?.getAttribute('content');

        return {
          htmlLang,
          hasHtmlLang: !!htmlLang,
          hreflangLinks,
          hasHreflang: hreflangLinks.length > 0,
          ogLocale,
          hasOgLocale: !!ogLocale,
        };
      });

      const issues: string[] = [];

      if (!languageData.hasHtmlLang) {
        issues.push('Missing lang attribute on <html> tag');
      }

      if (languageData.hasHreflang && !languageData.hreflangLinks.some((link: any) => link.hreflang === 'x-default')) {
        issues.push('Consider adding hreflang="x-default" for international targeting');
      }

      if (issues.length > 0) {
        return this.fail(`Language configuration issues: ${issues.join(', ')}`, languageData);
      }

      return this.pass(
        languageData.hasHreflang
          ? `Language properly configured with ${languageData.hreflangLinks.length} hreflang tag(s)`
          : 'Language configured (no hreflang needed for single-language sites)',
        languageData
      );
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Language tags check skipped due to error' };
    }
  }

  private async checkMobileViewport(): Promise<CheckOutcome> {
    try {
      const viewportData = await this.page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        const content = viewport?.getAttribute('content') || '';

        const hasWidth = content.includes('width=');
        const hasDeviceWidth = content.includes('width=device-width');
        const hasInitialScale = content.includes('initial-scale=');
        const hasUserScalable = content.includes('user-scalable=');

        return {
          hasViewport: !!viewport,
          content,
          hasWidth,
          hasDeviceWidth,
          hasInitialScale,
          hasUserScalable,
          userScalableValue: content.match(/user-scalable=([^,\s]+)/)?.[1],
        };
      });

      if (!viewportData.hasViewport) {
        return this.fail('Missing viewport meta tag - critical for mobile SEO');
      }

      const issues: string[] = [];

      if (!viewportData.hasDeviceWidth) {
        issues.push('Viewport should include "width=device-width"');
      }

      if (!viewportData.hasInitialScale) {
        issues.push('Consider adding "initial-scale=1"');
      }

      if (viewportData.userScalableValue === 'no') {
        issues.push('Warning: user-scalable=no prevents zoom (accessibility issue)');
      }

      if (issues.length > 0) {
        return this.fail(`Viewport issues: ${issues.join(', ')}`, viewportData);
      }

      return this.pass('Viewport properly configured for mobile devices', viewportData);
    } catch (error) {
      return this.fail(`Error checking viewport: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
