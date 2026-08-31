import { MetaTag } from '../types';
import { BaseChecker, CheckOutcome } from './base';
import {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  META_DESCRIPTION_MIN_LENGTH,
  META_DESCRIPTION_MAX_LENGTH,
} from '../config/thresholds';

export class MetaTagsChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'title-length-valid', run: () => this.checkTitle() },
      { id: 'meta-description-length-valid', run: () => this.checkMetaDescription() },
      { id: 'meta-keywords-present', run: () => this.checkMetaKeywords() },
      { id: 'og-tags-configured', run: () => this.checkOpenGraphTags() },
      { id: 'canonical-url-exists', run: () => this.checkCanonicalUrl() },
      { id: 'viewport-meta-exists', run: () => this.checkViewport() },
    ];
  }

  private async checkTitle(): Promise<CheckOutcome> {
    try {
      const title = await this.page.title();
      const titleLength = title.length;

      if (!title || titleLength === 0) {
        return this.fail('Page title is missing');
      }

      const minLength = this.threshold('title-length-valid', 'minLength', TITLE_MIN_LENGTH);
      const maxLength = this.threshold('title-length-valid', 'maxLength', TITLE_MAX_LENGTH);

      if (titleLength < minLength) {
        return this.fail(
          `Title is too short (${titleLength} characters). Recommended: ${minLength}-${maxLength} characters`,
          { title, length: titleLength }
        );
      }

      if (titleLength > maxLength) {
        return this.fail(
          `Title is too long (${titleLength} characters). Recommended: ${minLength}-${maxLength} characters`,
          { title, length: titleLength }
        );
      }

      return this.pass(`Title is optimal (${titleLength} characters)`, { title, length: titleLength });
    } catch (error) {
      return this.fail(`Failed to check title: ${(error as Error).message}`);
    }
  }

  private async checkMetaDescription(): Promise<CheckOutcome> {
    const description = await this.page.evaluate(() => {
      return document.querySelector('meta[name="description"]')?.getAttribute('content') || null;
    });

    if (!description) {
      return this.fail('Meta description is missing');
    }

    const descLength = description.length;
    const minLength = this.threshold(
      'meta-description-length-valid',
      'minLength',
      META_DESCRIPTION_MIN_LENGTH
    );
    const maxLength = this.threshold(
      'meta-description-length-valid',
      'maxLength',
      META_DESCRIPTION_MAX_LENGTH
    );

    if (descLength < minLength) {
      return this.fail(
        `Meta description is too short (${descLength} characters). Recommended: ${minLength}-${maxLength} characters`,
        { description, length: descLength }
      );
    }

    if (descLength > maxLength) {
      return this.fail(
        `Meta description is too long (${descLength} characters). Recommended: ${minLength}-${maxLength} characters`,
        { description, length: descLength }
      );
    }

    return this.pass(`Meta description is optimal (${descLength} characters)`, {
      description,
      length: descLength,
    });
  }

  private async checkMetaKeywords(): Promise<CheckOutcome> {
    const keywords = await this.page.evaluate(() => {
      return document.querySelector('meta[name="keywords"]')?.getAttribute('content') || null;
    });

    if (!keywords) {
      return this.pass('Meta keywords not present (optional, not critical for modern SEO)');
    }

    return this.pass('Meta keywords present', { keywords });
  }

  private async checkOpenGraphTags(): Promise<CheckOutcome> {
    const ogTags: MetaTag[] = await this.page.evaluate(() => {
      const tags = Array.from(document.querySelectorAll('meta[property^="og:"]'));
      return tags.map((tag) => ({
        property: tag.getAttribute('property') || undefined,
        content: tag.getAttribute('content') || '',
      }));
    });

    const hasOgTitle = ogTags.some((tag) => tag.property === 'og:title');
    const hasOgDescription = ogTags.some((tag) => tag.property === 'og:description');
    const hasOgImage = ogTags.some((tag) => tag.property === 'og:image');
    const hasOgType = ogTags.some((tag) => tag.property === 'og:type');
    const hasOgUrl = ogTags.some((tag) => tag.property === 'og:url');

    const ogImageTag = ogTags.find((tag) => tag.property === 'og:image');
    const ogImageIsAbsolute = ogImageTag
      ? /^https?:\/\//.test(ogImageTag.content)
      : true; // no image = separate issue

    const missingTags: string[] = [];
    const issues: string[] = [];

    if (!hasOgTitle) missingTags.push('og:title');
    if (!hasOgDescription) missingTags.push('og:description');
    if (!hasOgImage) missingTags.push('og:image');

    if (missingTags.length > 0) {
      return this.fail(`Missing essential Open Graph tags: ${missingTags.join(', ')}`, {
        ogTags,
        hasOgTitle,
        hasOgDescription,
        hasOgImage,
      });
    }

    if (!ogImageIsAbsolute) {
      issues.push('og:image must be an absolute URL (relative URLs break social sharing)');
    }
    if (!hasOgType) {
      issues.push('og:type is missing (recommended: "website" or "article")');
    }
    if (!hasOgUrl) {
      issues.push('og:url is missing (recommended for canonical social sharing URL)');
    }

    if (issues.length > 0) {
      return this.fail(`Open Graph issues: ${issues.join('; ')}`, {
        ogTags,
        issues,
        hasOgType,
        hasOgUrl,
        ogImageIsAbsolute,
      });
    }

    return this.pass(`Open Graph tags properly configured (${ogTags.length} tags found)`, { ogTags });
  }

  private async checkCanonicalUrl(): Promise<CheckOutcome> {
    const canonical = await this.page.evaluate(() => {
      return document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
    });

    if (!canonical) {
      return this.fail('Canonical URL is missing');
    }

    return this.pass('Canonical URL is present', { canonical });
  }

  private async checkViewport(): Promise<CheckOutcome> {
    const viewport = await this.page.evaluate(() => {
      return document.querySelector('meta[name="viewport"]')?.getAttribute('content') || null;
    });

    if (!viewport) {
      return this.fail('Viewport meta tag is missing (important for mobile SEO)');
    }

    return this.pass('Viewport meta tag is present', { viewport });
  }
}
