import { BaseChecker, CheckOutcome } from './base';
import { fetchRobotsTxtWithRetry } from './shared/robotsTxt';

export class SitemapChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'sitemap-exists', run: () => this.checkSitemapExists() },
      { id: 'sitemap-referenced-in-robots-txt', run: () => this.checkSitemapInRobotsTxt() },
    ];
  }

  private async checkSitemapExists(): Promise<CheckOutcome> {
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

              return this.pass(`XML sitemap found with ${urlCount} URLs`, {
                url: sitemapUrl,
                urlCount,
                size: content.length,
              });
            }
          }
        } catch (error) {
          // Continue to next URL
          continue;
        }
      }

      return this.fail('XML sitemap not found at common locations (sitemap.xml, sitemap_index.xml)', {
        checkedUrls: commonSitemapUrls,
      });
    } catch (error) {
      return this.fail(`Error checking sitemap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkSitemapInRobotsTxt(): Promise<CheckOutcome> {
    try {
      const response = await fetchRobotsTxtWithRetry(this.page);

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

          return this.pass(`Sitemap referenced in robots.txt (${sitemapLines.length} sitemap(s) found)`, {
            sitemaps,
          });
        } else {
          return this.fail('Sitemap not referenced in robots.txt');
        }
      } else {
        return this.pass('robots.txt not found, sitemap reference check skipped');
      }
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Sitemap reference check skipped due to error' };
    }
  }
}
