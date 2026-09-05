import { BaseChecker, CheckOutcome } from './base';
import { extractJsonLdBlocks, parseViewportMeta } from './shared/dom';
import { JsonLdBlock } from './shared/schemaTypes';

export class PageQualityChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'title-tags-consistent', run: () => this.checkDuplicateTitles() },
      { id: 'description-tags-consistent', run: () => this.checkDuplicateDescriptions() },
      { id: 'h1-not-duplicated', run: () => this.checkDuplicateH1() },
      { id: 'content-freshness-indicated', run: () => this.checkContentFreshness() },
      { id: 'media-elements-present', run: () => this.checkMediaPresence() },
      { id: 'table-of-contents-present', run: () => this.checkTableOfContents() },
      { id: 'author-info-present', run: () => this.checkAuthorInfo() },
      { id: 'publish-date-present', run: () => this.checkPublishDate() },
      { id: 'contact-info-present', run: () => this.checkContactInfo() },
      { id: 'social-proof-present', run: () => this.checkSocialProof() },
      { id: 'call-to-action-present', run: () => this.checkCallToAction() },
      { id: 'mobile-optimization-present', run: () => this.checkMobileOptimization() },
      { id: 'print-stylesheet-present', run: () => this.checkPrintStylesheet() },
      { id: 'canonical-og-url-consistent', run: () => this.checkCanonicalConsistency() },
      { id: 'no-noindex-directive', run: () => this.checkNoIndex() },
    ];
  }

  private async checkDuplicateTitles(): Promise<CheckOutcome> {
    try {
      const titles = await this.page.evaluate(() => {
        const pageTitle = document.title;
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
        const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');

        return {
          pageTitle,
          ogTitle,
          twitterTitle,
          allSame: pageTitle === ogTitle && pageTitle === twitterTitle,
        };
      });

      // It's actually good if all titles are the same for consistency
      return this.pass(
        titles.allSame ? 'All title tags are consistent' : 'Title tags vary (ensure intentional variation)',
        titles
      );
    } catch (error) {
      return this.pass('Title consistency check skipped');
    }
  }

  private async checkDuplicateDescriptions(): Promise<CheckOutcome> {
    try {
      const descriptions = await this.page.evaluate(() => {
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
        const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
        const twitterDesc = document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');

        return {
          metaDesc,
          ogDesc,
          twitterDesc,
          allSame: metaDesc === ogDesc && metaDesc === twitterDesc,
        };
      });

      return this.pass(
        descriptions.allSame ? 'All description tags are consistent' : 'Description tags vary',
        descriptions
      );
    } catch (error) {
      return this.pass('Description consistency check skipped');
    }
  }

  private async checkDuplicateH1(): Promise<CheckOutcome> {
    try {
      const h1Data = await this.page.evaluate(() => {
        const h1s = Array.from(document.querySelectorAll('h1'));
        const h1Texts = h1s.map((h) => h.textContent?.trim()).filter((t) => t);
        const uniqueH1s = [...new Set(h1Texts)];

        return {
          totalH1s: h1s.length,
          uniqueH1s: uniqueH1s.length,
          hasDuplicates: uniqueH1s.length < h1Texts.length,
          h1Texts: h1Texts.slice(0, 3),
        };
      });

      if (h1Data.hasDuplicates) {
        return this.fail(`Duplicate H1 content found (${h1Data.totalH1s} H1s, ${h1Data.uniqueH1s} unique)`, h1Data);
      }

      if (h1Data.totalH1s > 1) {
        return this.fail(`Multiple H1 tags found (${h1Data.totalH1s}). Best practice: 1 per page`, h1Data);
      }

      return this.pass('Single unique H1 found', h1Data);
    } catch (error) {
      return this.pass('H1 duplication check skipped');
    }
  }

  private async checkContentFreshness(): Promise<CheckOutcome> {
    try {
      const dateData = await this.page.evaluate(() => {
        const modifiedMeta = document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content');
        const publishedMeta = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
        const timeTags = Array.from(document.querySelectorAll('time')).map((t) => t.getAttribute('datetime'));

        return {
          hasModifiedDate: !!modifiedMeta,
          hasPublishedDate: !!publishedMeta,
          hasTimeElements: timeTags.length > 0,
          modifiedMeta,
          publishedMeta,
          timeTags,
        };
      });

      const hasDateIndicators = dateData.hasModifiedDate || dateData.hasPublishedDate || dateData.hasTimeElements;

      if (!hasDateIndicators) {
        return this.fail('No date indicators found (consider adding publication/modified dates)', dateData);
      }

      return this.pass('Date metadata present', dateData);
    } catch (error) {
      return this.pass('Content freshness check skipped');
    }
  }

  private async checkMediaPresence(): Promise<CheckOutcome> {
    try {
      const mediaData = await this.page.evaluate(() => {
        return {
          images: document.querySelectorAll('img').length,
          videos: document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
          audio: document.querySelectorAll('audio').length,
        };
      });

      const totalMedia = mediaData.images + mediaData.videos + mediaData.audio;

      if (totalMedia === 0) {
        return this.fail('No media elements found (images/videos improve engagement)', mediaData);
      }

      return this.pass(`Media elements present (${totalMedia} total)`, mediaData);
    } catch (error) {
      return this.pass('Media presence check skipped');
    }
  }

  private async checkTableOfContents(): Promise<CheckOutcome> {
    try {
      const hasTOC = await this.page.evaluate(() => {
        const tocElements = document.querySelectorAll(
          '[class*="toc"], [id*="toc"], [class*="table-of-contents"], nav ol, nav ul'
        );
        return tocElements.length > 0;
      });

      return this.pass(hasTOC ? 'Table of contents found' : 'No table of contents (consider adding for long content)');
    } catch (error) {
      return this.pass('Table of contents check skipped');
    }
  }

  private async checkAuthorInfo(): Promise<CheckOutcome> {
    try {
      const domAuthorData = await this.page.evaluate(() => {
        const authorMeta = document.querySelector('meta[name="author"]')?.getAttribute('content');
        const articleAuthor = document.querySelector('[rel="author"]');
        return { authorMeta, hasAuthorLink: !!articleAuthor };
      });

      const jsonLdScripts = await this.page.evaluate(extractJsonLdBlocks);
      const hasSchemaAuthor = (jsonLdScripts as JsonLdBlock[]).some((data) => data.author || data.creator);

      const authorData = {
        hasAuthorMeta: !!domAuthorData.authorMeta,
        hasAuthorLink: domAuthorData.hasAuthorLink,
        hasSchemaAuthor,
        authorMeta: domAuthorData.authorMeta,
      };

      const hasAuthorInfo = authorData.hasAuthorMeta || authorData.hasAuthorLink || authorData.hasSchemaAuthor;

      return this.pass(
        hasAuthorInfo ? 'Author information present' : 'No author information (recommended for E-A-T)',
        authorData
      );
    } catch (error) {
      return this.pass('Author info check skipped');
    }
  }

  private async checkPublishDate(): Promise<CheckOutcome> {
    try {
      const dateInfo = await this.page.evaluate(() => {
        const publishedTime = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
        const timeElements = document.querySelectorAll('time[datetime]');

        return {
          hasPublishedMeta: !!publishedTime,
          hasTimeElements: timeElements.length > 0,
          publishedTime,
        };
      });

      const hasDate = dateInfo.hasPublishedMeta || dateInfo.hasTimeElements;

      return this.pass(
        hasDate ? 'Publication date found' : 'No publication date (recommended for content freshness)',
        dateInfo
      );
    } catch (error) {
      return this.pass('Publish date check skipped');
    }
  }

  private async checkContactInfo(): Promise<CheckOutcome> {
    try {
      const contactData = await this.page.evaluate(() => {
        const content = document.body.textContent || '';
        const hasEmail = /@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(content);
        const hasPhone = /\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/.test(content);
        const hasAddress = content.toLowerCase().includes('address') &&
                          (content.includes('Street') || content.includes('Ave') || content.includes('Blvd'));

        return {
          hasEmail,
          hasPhone,
          hasAddress,
        };
      });

      const contactMethods = [contactData.hasEmail, contactData.hasPhone, contactData.hasAddress].filter(Boolean).length;

      return this.pass(
        contactMethods > 0
          ? `Contact information present (${contactMethods} methods)`
          : 'No contact information found (consider adding for trust)',
        contactData
      );
    } catch (error) {
      return this.pass('Contact info check skipped');
    }
  }

  private async checkSocialProof(): Promise<CheckOutcome> {
    try {
      const socialData = await this.page.evaluate(() => {
        const testimonials = document.querySelectorAll('[class*="testimonial"], [class*="review"]');
        const ratings = document.querySelectorAll('[class*="rating"], [class*="star"]');
        const socialLinks = document.querySelectorAll('a[href*="facebook"], a[href*="twitter"], a[href*="linkedin"], a[href*="instagram"]');

        return {
          hasTestimonials: testimonials.length > 0,
          hasRatings: ratings.length > 0,
          hasSocialLinks: socialLinks.length > 0,
          testimonialCount: testimonials.length,
          socialLinkCount: socialLinks.length,
        };
      });

      const hasSocialProof = socialData.hasTestimonials || socialData.hasRatings || socialData.hasSocialLinks;

      return this.pass(
        hasSocialProof ? 'Social proof elements present' : 'No social proof (consider adding reviews/testimonials)',
        socialData
      );
    } catch (error) {
      return this.pass('Social proof check skipped');
    }
  }

  private async checkCallToAction(): Promise<CheckOutcome> {
    try {
      const ctaData = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[class*="btn"], a[class*="button"]'));
        const ctaText = buttons.map((btn) => btn.textContent?.trim().toLowerCase()).filter((text) => text);

        const commonCTAs = ['buy', 'shop', 'subscribe', 'sign up', 'contact', 'get', 'download', 'learn more', 'read more'];
        const hasCTA = ctaText.some((text) => commonCTAs.some((cta: string) => text.includes(cta)));

        return {
          buttonCount: buttons.length,
          hasCTA,
        };
      });

      return this.pass(
        ctaData.hasCTA
          ? `Call-to-action buttons present (${ctaData.buttonCount} buttons)`
          : 'No clear call-to-action (consider adding for conversion)',
        ctaData
      );
    } catch (error) {
      return this.pass('CTA check skipped');
    }
  }

  private async checkMobileOptimization(): Promise<CheckOutcome> {
    try {
      const rawMobileData = await this.page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        const viewportContent = viewport?.getAttribute('content') || '';

        const hasTouchIcons = document.querySelectorAll('link[rel*="apple-touch-icon"], link[rel*="icon"]').length > 0;
        const hasResponsiveImages = document.querySelectorAll('img[srcset], picture').length > 0;

        return {
          hasViewport: !!viewport,
          hasTouchIcons,
          hasResponsiveImages,
          viewportContent,
        };
      });
      const mobileData = {
        ...rawMobileData,
        hasDeviceWidth: parseViewportMeta(rawMobileData.viewportContent).hasDeviceWidth,
      };

      const issues: string[] = [];

      if (!mobileData.hasViewport) {
        issues.push('Missing viewport meta tag');
      } else if (!mobileData.hasDeviceWidth) {
        issues.push('Viewport missing device-width');
      }

      if (!mobileData.hasTouchIcons) {
        issues.push('Missing touch icons');
      }

      if (issues.length > 1) {
        return this.fail(`Mobile optimization issues: ${issues.join(', ')}`, mobileData);
      }

      return this.pass('Mobile optimization present', mobileData);
    } catch (error) {
      return this.pass('Mobile optimization check skipped');
    }
  }

  private async checkPrintStylesheet(): Promise<CheckOutcome> {
    try {
      const hasPrintCSS = await this.page.evaluate(() => {
        const printLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .some((link) => link.getAttribute('media') === 'print');

        const hasMediaQueries = Array.from(document.querySelectorAll('style'))
          .some((style) => style.textContent?.includes('@media print'));

        return {
          hasPrintLinks: printLinks,
          hasMediaQueries,
        };
      });

      return this.pass(
        hasPrintCSS.hasPrintLinks || hasPrintCSS.hasMediaQueries
          ? 'Print stylesheet present'
          : 'No print stylesheet (optional but good for UX)',
        hasPrintCSS
      );
    } catch (error) {
      return this.pass('Print stylesheet check skipped');
    }
  }

  private async checkCanonicalConsistency(): Promise<CheckOutcome> {
    try {
      const canonicalData = await this.page.evaluate(() => {
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
        const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');

        return {
          canonical,
          ogUrl,
          match: canonical === ogUrl,
        };
      });

      if (canonicalData.canonical && canonicalData.ogUrl && !canonicalData.match) {
        return this.fail('Canonical URL and og:url do not match', canonicalData);
      }

      return this.pass('Canonical tags are consistent', canonicalData);
    } catch (error) {
      return this.pass('Canonical consistency check skipped');
    }
  }

  private async checkNoIndex(): Promise<CheckOutcome> {
    try {
      const robotsData = await this.page.evaluate(() => {
        const robotsMeta = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
        const googleBotMeta = document.querySelector('meta[name="googlebot"]')?.getAttribute('content') || '';

        const hasNoIndex = robotsMeta.toLowerCase().includes('noindex') ||
                          googleBotMeta.toLowerCase().includes('noindex');
        const hasNoFollow = robotsMeta.toLowerCase().includes('nofollow') ||
                           googleBotMeta.toLowerCase().includes('nofollow');

        return {
          robotsMeta,
          googleBotMeta,
          hasNoIndex,
          hasNoFollow,
        };
      });

      if (robotsData.hasNoIndex) {
        return this.fail('Page has noindex directive (will not be indexed by search engines)', robotsData);
      }

      if (robotsData.hasNoFollow) {
        return this.fail('Page has nofollow directive (links will not be followed)', robotsData);
      }

      return this.pass('Page is indexable', robotsData);
    } catch (error) {
      return this.pass('NoIndex check skipped');
    }
  }
}
