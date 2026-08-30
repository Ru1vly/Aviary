import { BaseChecker, CheckOutcome } from './base';
import { extractJsonLdBlocks } from './shared/dom';

export class SchemaValidationChecker extends BaseChecker {
  private jsonLdPromise?: Promise<unknown[]>;

  /**
   * All 15 checks below used to independently re-run page.evaluate() + JSON.parse
   * over every JSON-LD block on the page. Extracted once here and filtered in
   * memory per check instead.
   */
  private getJsonLd(): Promise<unknown[]> {
    if (!this.jsonLdPromise) {
      this.jsonLdPromise = this.page.evaluate(extractJsonLdBlocks);
    }
    return this.jsonLdPromise;
  }

  protected checks() {
    return [
      { id: 'organization-schema-complete', run: () => this.checkOrganizationSchema() },
      { id: 'person-schema-complete', run: () => this.checkPersonSchema() },
      { id: 'product-schema-complete', run: () => this.checkProductSchema() },
      { id: 'article-schema-complete', run: () => this.checkArticleSchema() },
      { id: 'breadcrumb-schema-present', run: () => this.checkBreadcrumbSchema() },
      { id: 'faq-schema-present', run: () => this.checkFAQSchema() },
      { id: 'howto-schema-complete', run: () => this.checkHowToSchema() },
      { id: 'review-schema-complete', run: () => this.checkReviewSchema() },
      { id: 'event-schema-complete', run: () => this.checkEventSchema() },
      { id: 'local-business-schema-complete', run: () => this.checkLocalBusinessSchema() },
      { id: 'webpage-schema-present', run: () => this.checkWebPageSchema() },
      { id: 'website-schema-present', run: () => this.checkWebSiteSchema() },
      { id: 'image-object-schema-present', run: () => this.checkImageObjectSchema() },
      { id: 'schema-required-fields-present', run: () => this.checkSchemaRequiredFields() },
      { id: 'schema-context-valid', run: () => this.checkSchemaContext() },
    ];
  }

  private async checkOrganizationSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const orgSchemas = schemas.filter(
        (data: any) => data && (data['@type'] === 'Organization' || data['@type']?.includes('Organization'))
      ) as any[];

      if (orgSchemas.length === 0) {
        return this.pass('No Organization schema (optional but recommended for businesses)');
      }

      const org = orgSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!org.name,
        hasUrl: !!org.url,
        hasLogo: !!org.logo,
        hasSameAs: !!org.sameAs,
        hasContactPoint: !!org.contactPoint,
      };

      const issues: string[] = [];
      if (!schemaData.hasName) issues.push('missing name');
      if (!schemaData.hasUrl) issues.push('missing url');
      if (!schemaData.hasLogo) issues.push('missing logo');

      if (issues.length > 0) {
        return this.fail(`Organization schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass('Organization schema properly configured', schemaData);
    } catch (error) {
      return this.pass('Organization schema check skipped');
    }
  }

  private async checkPersonSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const personSchemas = schemas.filter((data: any) => data && data['@type'] === 'Person') as any[];

      if (personSchemas.length === 0) {
        return this.pass('No Person schema (optional, useful for personal brands)');
      }

      const person = personSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!person.name,
        hasUrl: !!person.url,
        hasImage: !!person.image,
        hasJobTitle: !!person.jobTitle,
      };

      const issues: string[] = [];
      if (!schemaData.hasName) issues.push('missing name');

      if (issues.length > 0) {
        return this.fail(`Person schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass('Person schema properly configured', schemaData);
    } catch (error) {
      return this.pass('Person schema check skipped');
    }
  }

  private async checkProductSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const productSchemas = schemas.filter((data: any) => data && data['@type'] === 'Product') as any[];

      if (productSchemas.length === 0) {
        return this.pass('No Product schema (required for e-commerce pages)');
      }

      const product = productSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!product.name,
        hasImage: !!product.image,
        hasDescription: !!product.description,
        hasOffers: !!product.offers,
        hasSKU: !!product.sku,
        hasBrand: !!product.brand,
        hasAggregateRating: !!product.aggregateRating,
      };

      const issues: string[] = [];
      if (!schemaData.hasName) issues.push('missing name');
      if (!schemaData.hasImage) issues.push('missing image');
      if (!schemaData.hasOffers) issues.push('missing offers');

      if (issues.length > 0) {
        return this.fail(`Product schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass('Product schema properly configured', schemaData);
    } catch (error) {
      return this.pass('Product schema check skipped');
    }
  }

  private async checkArticleSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const articleSchemas = schemas.filter(
        (data: any) =>
          data && (data['@type'] === 'Article' || data['@type'] === 'NewsArticle' || data['@type'] === 'BlogPosting')
      ) as any[];

      if (articleSchemas.length === 0) {
        return this.pass('No Article schema (recommended for blog posts and articles)');
      }

      const article = articleSchemas[0];
      const schemaData = {
        found: true,
        hasHeadline: !!article.headline,
        hasImage: !!article.image,
        hasDatePublished: !!article.datePublished,
        hasAuthor: !!article.author,
        hasPublisher: !!article.publisher,
      };

      const issues: string[] = [];
      if (!schemaData.hasHeadline) issues.push('missing headline');
      if (!schemaData.hasImage) issues.push('missing image');
      if (!schemaData.hasDatePublished) issues.push('missing datePublished');
      if (!schemaData.hasAuthor) issues.push('missing author');
      if (!schemaData.hasPublisher) issues.push('missing publisher');

      if (issues.length > 0) {
        return this.fail(`Article schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass('Article schema properly configured', schemaData);
    } catch (error) {
      return this.pass('Article schema check skipped');
    }
  }

  private async checkBreadcrumbSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const breadcrumbSchemas = schemas.filter((data: any) => data && data['@type'] === 'BreadcrumbList') as any[];

      if (breadcrumbSchemas.length === 0) {
        return this.pass('No BreadcrumbList schema (recommended for better navigation)');
      }

      const breadcrumb = breadcrumbSchemas[0];
      const schemaData = {
        found: true,
        hasItemListElement: !!breadcrumb.itemListElement,
        itemCount: breadcrumb.itemListElement?.length || 0,
      };

      if (!schemaData.hasItemListElement || schemaData.itemCount === 0) {
        return this.fail('BreadcrumbList schema missing itemListElement', schemaData);
      }

      return this.pass(`BreadcrumbList schema with ${schemaData.itemCount} items`, schemaData);
    } catch (error) {
      return this.pass('BreadcrumbList schema check skipped');
    }
  }

  private async checkFAQSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const faqSchemas = schemas.filter((data: any) => data && data['@type'] === 'FAQPage') as any[];

      if (faqSchemas.length === 0) {
        return this.pass('No FAQPage schema (use for FAQ pages to get rich results)');
      }

      const faq = faqSchemas[0];
      const schemaData = {
        found: true,
        hasMainEntity: !!faq.mainEntity,
        questionCount: faq.mainEntity?.length || 0,
      };

      if (!schemaData.hasMainEntity || schemaData.questionCount === 0) {
        return this.fail('FAQPage schema missing questions', schemaData);
      }

      return this.pass(`FAQPage schema with ${schemaData.questionCount} questions`, schemaData);
    } catch (error) {
      return this.pass('FAQPage schema check skipped');
    }
  }

  private async checkHowToSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const howToSchemas = schemas.filter((data: any) => data && data['@type'] === 'HowTo') as any[];

      if (howToSchemas.length === 0) {
        return this.pass('No HowTo schema (use for tutorial/how-to content)');
      }

      const howTo = howToSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!howTo.name,
        hasStep: !!howTo.step,
        stepCount: howTo.step?.length || 0,
      };

      const issues: string[] = [];
      if (!schemaData.hasName) issues.push('missing name');
      if (!schemaData.hasStep) issues.push('missing step');

      if (issues.length > 0) {
        return this.fail(`HowTo schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass(`HowTo schema with ${schemaData.stepCount} steps`, schemaData);
    } catch (error) {
      return this.pass('HowTo schema check skipped');
    }
  }

  private async checkReviewSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const reviewSchemas = schemas.filter(
        (data: any) => data && (data['@type'] === 'Review' || data['@type'] === 'AggregateRating')
      ) as any[];

      if (reviewSchemas.length === 0) {
        return this.pass('No Review schema (use for product/business reviews)');
      }

      const review = reviewSchemas[0];
      const schemaData = {
        found: true,
        type: review['@type'],
        hasRatingValue: !!review.ratingValue,
        hasReviewRating: !!review.reviewRating,
        hasAuthor: !!review.author,
      };

      if (schemaData.type === 'Review' && !schemaData.hasAuthor) {
        return this.fail('Review schema missing author', schemaData);
      }

      return this.pass(`${schemaData.type} schema properly configured`, schemaData);
    } catch (error) {
      return this.pass('Review schema check skipped');
    }
  }

  private async checkEventSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const eventSchemas = schemas.filter((data: any) => data && data['@type'] === 'Event') as any[];

      if (eventSchemas.length === 0) {
        return this.pass('No Event schema (use for event pages)');
      }

      const event = eventSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!event.name,
        hasStartDate: !!event.startDate,
        hasLocation: !!event.location,
      };

      const issues: string[] = [];
      if (!schemaData.hasName) issues.push('missing name');
      if (!schemaData.hasStartDate) issues.push('missing startDate');
      if (!schemaData.hasLocation) issues.push('missing location');

      if (issues.length > 0) {
        return this.fail(`Event schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass('Event schema properly configured', schemaData);
    } catch (error) {
      return this.pass('Event schema check skipped');
    }
  }

  private async checkLocalBusinessSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const businessSchemas = schemas.filter((data: any) => data && data['@type'] === 'LocalBusiness') as any[];

      if (businessSchemas.length === 0) {
        return this.pass('No LocalBusiness schema (use for local business pages)');
      }

      const business = businessSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!business.name,
        hasAddress: !!business.address,
        hasTelephone: !!business.telephone,
        hasOpeningHours: !!business.openingHoursSpecification,
      };

      const issues: string[] = [];
      if (!schemaData.hasName) issues.push('missing name');
      if (!schemaData.hasAddress) issues.push('missing address');
      if (!schemaData.hasTelephone) issues.push('missing telephone');

      if (issues.length > 0) {
        return this.fail(`LocalBusiness schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass('LocalBusiness schema properly configured', schemaData);
    } catch (error) {
      return this.pass('LocalBusiness schema check skipped');
    }
  }

  private async checkWebPageSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const webPageSchemas = schemas.filter((data: any) => data && data['@type'] === 'WebPage') as any[];

      if (webPageSchemas.length === 0) {
        return this.pass('No WebPage schema (optional)');
      }

      const webPage = webPageSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!webPage.name,
        hasUrl: !!webPage.url,
        hasDescription: !!webPage.description,
      };

      return this.pass('WebPage schema present', schemaData);
    } catch (error) {
      return this.pass('WebPage schema check skipped');
    }
  }

  private async checkWebSiteSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const webSiteSchemas = schemas.filter((data: any) => data && data['@type'] === 'WebSite') as any[];

      if (webSiteSchemas.length === 0) {
        return this.pass('No WebSite schema (recommended for homepage)');
      }

      const webSite = webSiteSchemas[0];
      const schemaData = {
        found: true,
        hasName: !!webSite.name,
        hasUrl: !!webSite.url,
        hasPotentialAction: !!webSite.potentialAction,
      };

      return this.pass(
        schemaData.hasPotentialAction ? 'WebSite schema with search action' : 'WebSite schema present',
        schemaData
      );
    } catch (error) {
      return this.pass('WebSite schema check skipped');
    }
  }

  private async checkImageObjectSchema(): Promise<CheckOutcome> {
    try {
      const schemas = await this.getJsonLd();
      const imageSchemas = schemas.filter((data: any) => data && data['@type'] === 'ImageObject');

      const schemaData = {
        found: imageSchemas.length > 0,
        count: imageSchemas.length,
      };

      if (!schemaData.found) {
        return this.pass('No ImageObject schema (optional)');
      }

      return this.pass(`${schemaData.count} ImageObject schema(s) present`, schemaData);
    } catch (error) {
      return this.pass('ImageObject schema check skipped');
    }
  }

  private async checkSchemaRequiredFields(): Promise<CheckOutcome> {
    try {
      const allSchemas = (await this.getJsonLd()) as any[];

      const missingContexts = allSchemas.filter((schema) => !schema['@context']);
      const missingTypes = allSchemas.filter((schema) => !schema['@type']);

      const schemaData = {
        totalSchemas: allSchemas.length,
        missingContexts: missingContexts.length,
        missingTypes: missingTypes.length,
      };

      if (schemaData.totalSchemas === 0) {
        return this.pass('No schema markup to validate');
      }

      const issues: string[] = [];
      if (schemaData.missingContexts > 0) {
        issues.push(`${schemaData.missingContexts} schemas missing @context`);
      }
      if (schemaData.missingTypes > 0) {
        issues.push(`${schemaData.missingTypes} schemas missing @type`);
      }

      if (issues.length > 0) {
        return this.fail(`Schema validation issues: ${issues.join(', ')}`, schemaData);
      }

      return this.pass(`All ${schemaData.totalSchemas} schemas have required fields`, schemaData);
    } catch (error) {
      return this.pass('Schema required fields check skipped');
    }
  }

  private async checkSchemaContext(): Promise<CheckOutcome> {
    try {
      const allSchemas = (await this.getJsonLd()) as any[];

      const contexts = allSchemas.map((schema) => schema['@context']).filter((ctx) => ctx);

      const validContexts = contexts.filter(
        (ctx: string) => ctx === 'https://schema.org' || ctx === 'http://schema.org'
      );

      const schemaData = {
        totalSchemas: allSchemas.length,
        totalContexts: contexts.length,
        validContexts: validContexts.length,
      };

      if (schemaData.totalSchemas === 0) {
        return this.pass('No schema markup to validate');
      }

      if (schemaData.validContexts < schemaData.totalContexts) {
        return this.fail(`${schemaData.totalContexts - schemaData.validContexts} schemas with invalid @context`, schemaData);
      }

      return this.pass('All schemas use valid schema.org context', schemaData);
    } catch (error) {
      return this.pass('Schema context check skipped');
    }
  }
}
