import { BaseChecker, CheckOutcome } from './base';

export class SocialMediaChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'twitter-card-configured', run: () => this.checkTwitterCards() },
      { id: 'open-graph-configured', run: () => this.checkOpenGraphTags() },
      { id: 'facebook-tags-present', run: () => this.checkFacebookTags() },
    ];
  }

  private async checkTwitterCards(): Promise<CheckOutcome> {
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
        return this.pass(`Twitter Card properly configured (${Object.keys(twitterTags).length} tags)`, {
          tags: twitterTags,
        });
      } else if (Object.keys(twitterTags).length === 0) {
        return this.fail('No Twitter Card tags found', { issues });
      } else {
        return this.fail(`Twitter Card incomplete: ${issues.join(', ')}`, { tags: twitterTags, issues });
      }
    } catch (error) {
      return this.fail(`Error checking Twitter Cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkOpenGraphTags(): Promise<CheckOutcome> {
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
        return this.pass(`Open Graph tags properly configured (${Object.keys(ogTags).length} tags)`, {
          tags: ogTags,
        });
      } else if (Object.keys(ogTags).length === 0) {
        return this.fail('No Open Graph tags found', { issues });
      } else {
        return this.fail(`Open Graph incomplete: ${issues.slice(0, 3).join(', ')}`, { tags: ogTags, issues });
      }
    } catch (error) {
      return this.fail(
        `Error checking Open Graph tags: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkFacebookTags(): Promise<CheckOutcome> {
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
        return this.pass('Facebook-specific tags found', fbTags);
      } else {
        return this.pass('No Facebook-specific tags (optional, but recommended for Facebook Insights)', {
          recommendation: 'Consider adding fb:app_id for Facebook Insights integration',
        });
      }
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Facebook tags check skipped due to error' };
    }
  }
}
