import { Page } from 'playwright';
import { SEOCheckResult } from '../types';

export class SitemapChecker {
  constructor(private page: Page) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkSitemapExists());
    results.push(await this.checkSitemapInRobotsTxt());

    return results;
  }

  private async checkSitemapExists(): Promise<SEOCheckResult> {
    try {
      const url = new URL(this.page.url());
      const commonSitemapUrls = [
        `${url.protocol}//${url.host}/sitemap.xml`,
        `${url.protocol}//${url.host}/sitemap_index.xml`,
        `${url.protocol}//${url.host}/sitemap1.xml`,
      ];

      for (const sitemapUrl of commonSitemapUrls) {
        try {
          const response = await this.page.context().request.get(sitemapUrl);

          if (response.status() === 200) {
            const content = await response.text();
            const isXml =
              content.includes('<?xml') ||
              content.includes('<urlset') ||
              content.includes('<sitemapindex');

            if (isXml) {
              // Count URLs in sitemap
              const urlMatches = content.match(/<loc>/g);
              const urlCount = urlMatches ? urlMatches.length : 0;

              return {
                passed: true,
                message: `XML sitemap found with ${urlCount} URLs`,
                details: {
                  url: sitemapUrl,
                  urlCount,
                  size: content.length,
                },
              };
            }
          }
        } catch (error) {
          // Continue to next URL
          continue;
        }
      }

      return {
        passed: false,
        message: 'XML sitemap not found at common locations (sitemap.xml, sitemap_index.xml)',
        details: {
          checkedUrls: commonSitemapUrls,
        },
      };
    } catch (error) {
      return {
        passed: false,
        message: `Error checking sitemap: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkSitemapInRobotsTxt(): Promise<SEOCheckResult> {
    try {
      const url = new URL(this.page.url());
      const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;

      const response = await this.page.context().request.get(robotsUrl);

      if (response.status() === 200) {
        const content = await response.text();
        const sitemapLines = content
          .split('\n')
          .filter(
            (line: string) =>
              line.toLowerCase().startsWith('sitemap:') && !line.trim().startsWith('#')
          );

        if (sitemapLines.length > 0) {
          const sitemaps = sitemapLines.map((line: string) => line.split(':').slice(1).join(':').trim());

          return {
            passed: true,
            message: `Sitemap referenced in robots.txt (${sitemapLines.length} sitemap(s) found)`,
            details: {
              sitemaps,
            },
          };
        } else {
          return {
            passed: false,
            message: 'Sitemap not referenced in robots.txt',
          };
        }
      } else {
        return {
          passed: true,
          message: 'robots.txt not found, sitemap reference check skipped',
        };
      }
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Sitemap reference check skipped due to error',
      };
    }
  }
}
