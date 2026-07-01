import { Page } from 'playwright';
import { SEOCheckResult } from '../types';

export class SocialMediaChecker {
  constructor(private page: Page) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkTwitterCards());
    results.push(await this.checkOpenGraphTags());
    results.push(await this.checkFacebookTags());

    return results;
  }

  private async checkTwitterCards(): Promise<SEOCheckResult> {
    try {
      const twitterTags = await this.page.evaluate(() => {
        const tags = Array.from(document.querySelectorAll('meta[name^="twitter:"]'));
        return tags.reduce((acc: Record<string, string>, tag) => {
          const name = tag.getAttribute('name');
          const content = tag.getAttribute('content');
          if (name && content) {
            acc[name] = content;
          }
          return acc;
        }, {});
      });

      const hasCard = twitterTags['twitter:card'];
      const hasTitle = twitterTags['twitter:title'];
      const hasDescription = twitterTags['twitter:description'];
      const hasImage = twitterTags['twitter:image'];

      const issues: string[] = [];

      if (!hasCard) {
        issues.push('Missing twitter:card');
      }
      if (!hasTitle) {
        issues.push('Missing twitter:title');
      }
      if (!hasDescription) {
        issues.push('Missing twitter:description');
      }
      if (!hasImage) {
        issues.push('Missing twitter:image');
      }

      if (issues.length === 0) {
        return {
          passed: true,
          message: `Twitter Card properly configured (${Object.keys(twitterTags).length} tags)`,
          details: { tags: twitterTags },
        };
      } else if (Object.keys(twitterTags).length === 0) {
        return {
          passed: false,
          message: 'No Twitter Card tags found',
          details: { issues },
        };
      } else {
        return {
          passed: false,
          message: `Twitter Card incomplete: ${issues.join(', ')}`,
          details: { tags: twitterTags, issues },
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `Error checking Twitter Cards: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkOpenGraphTags(): Promise<SEOCheckResult> {
    try {
      const ogTags = await this.page.evaluate(() => {
        const tags = Array.from(document.querySelectorAll('meta[property^="og:"]'));
        return tags.reduce((acc: Record<string, string>, tag) => {
          const property = tag.getAttribute('property');
          const content = tag.getAttribute('content');
          if (property && content) {
            acc[property] = content;
          }
          return acc;
        }, {});
      });

      const hasTitle = ogTags['og:title'];
      const hasDescription = ogTags['og:description'];
      const hasImage = ogTags['og:image'];
      const hasUrl = ogTags['og:url'];
      const hasType = ogTags['og:type'];

      const issues: string[] = [];

      if (!hasTitle) {
        issues.push('Missing og:title');
      }
      if (!hasDescription) {
        issues.push('Missing og:description');
      }
      if (!hasImage) {
        issues.push('Missing og:image');
      }
      if (!hasUrl) {
        issues.push('Missing og:url');
      }
      if (!hasType) {
        issues.push('Missing og:type');
      }

      // Check image dimensions if og:image exists
      if (hasImage && !ogTags['og:image:width']) {
        issues.push('Consider adding og:image:width and og:image:height');
      }

      if (issues.length === 0) {
        return {
          passed: true,
          message: `Open Graph tags properly configured (${Object.keys(ogTags).length} tags)`,
          details: { tags: ogTags },
        };
      } else if (Object.keys(ogTags).length === 0) {
        return {
          passed: false,
          message: 'No Open Graph tags found',
          details: { issues },
        };
      } else {
        return {
          passed: false,
          message: `Open Graph incomplete: ${issues.slice(0, 3).join(', ')}`,
          details: { tags: ogTags, issues },
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `Error checking Open Graph tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async checkFacebookTags(): Promise<SEOCheckResult> {
    try {
      const fbTags = await this.page.evaluate(() => {
        const appId = document.querySelector('meta[property="fb:app_id"]');
        const admins = document.querySelector('meta[property="fb:admins"]');

        return {
          hasAppId: !!appId?.getAttribute('content'),
          hasAdmins: !!admins?.getAttribute('content'),
          appId: appId?.getAttribute('content'),
          admins: admins?.getAttribute('content'),
        };
      });

      if (fbTags.hasAppId || fbTags.hasAdmins) {
        return {
          passed: true,
          message: 'Facebook-specific tags found',
          details: fbTags,
        };
      } else {
        return {
          passed: true,
          message: 'No Facebook-specific tags (optional, but recommended for Facebook Insights)',
          details: {
            recommendation: 'Consider adding fb:app_id for Facebook Insights integration',
          },
        };
      }
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Facebook tags check skipped due to error',
      };
    }
  }
}
