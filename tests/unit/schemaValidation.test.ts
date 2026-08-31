import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { SchemaValidationChecker } from '../../src/checkers/schemaValidation';
import { createMockPage } from '../mocks/mockPage';

function ldJson(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function checkerFor(blocks: unknown[]): SchemaValidationChecker {
  const page = createMockPage({ headHtml: blocks.map(ldJson).join('\n') });
  return new SchemaValidationChecker({ page: page as Page, checkerKey: 'schemaValidation' });
}

function byName(results: Awaited<ReturnType<SchemaValidationChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('SchemaValidationChecker', () => {
  it('passes every check with "no schema" messaging when the page has none', async () => {
    const results = await checkerFor([]).checkAll();
    expect(results).toHaveLength(15);
    expect(results.every((r) => r.passed)).toBe(true);
    expect(byName(results, 'schema-required-fields-present').message).toMatch(/no schema markup/i);
  });

  it('flags incomplete schemas and passes complete ones, per type', async () => {
    const results = await checkerFor([
      { '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' }, // missing url/logo
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Jane Doe',
        url: 'https://example.com/jane',
        image: 'https://example.com/jane.jpg',
        jobTitle: 'Engineer',
      },
      { '@context': 'https://schema.org', '@type': 'Product', name: 'Widget' }, // missing image/offers
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Hello',
        image: 'x.jpg',
        datePublished: '2026-01-01',
        author: { name: 'A' },
        publisher: { name: 'P' },
      },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem' }] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] }, // empty -> fail
      { '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to X' }, // missing step
      { '@context': 'https://schema.org', '@type': 'Review', ratingValue: 5 }, // missing author -> fail
      {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'Conf',
        startDate: '2026-01-01',
        location: 'Venue',
      },
      { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Shop' }, // missing address/telephone
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Home', url: 'https://example.com' },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Site', potentialAction: { '@type': 'SearchAction' } },
      { '@context': 'https://schema.org', '@type': 'ImageObject', url: 'x.jpg' },
    ]).checkAll();

    expect(byName(results, 'organization-schema-complete').passed).toBe(false);
    expect(byName(results, 'person-schema-complete').passed).toBe(true);
    expect(byName(results, 'product-schema-complete').passed).toBe(false);
    expect(byName(results, 'article-schema-complete').passed).toBe(true);
    expect(byName(results, 'breadcrumb-schema-present').passed).toBe(true);
    expect(byName(results, 'faq-schema-present').passed).toBe(false);
    expect(byName(results, 'howto-schema-complete').passed).toBe(false);
    expect(byName(results, 'review-schema-complete').passed).toBe(false);
    expect(byName(results, 'event-schema-complete').passed).toBe(true);
    expect(byName(results, 'local-business-schema-complete').passed).toBe(false);
    expect(byName(results, 'webpage-schema-present').passed).toBe(true);
    expect(byName(results, 'website-schema-present').message).toMatch(/search action/i);
    expect(byName(results, 'image-object-schema-present').message).toMatch(/1 ImageObject/);
  });

  it('matches Article via its NewsArticle/BlogPosting alias types', async () => {
    const results = await checkerFor([
      { '@type': 'BlogPosting', headline: 'H', image: 'i', datePublished: 'd', author: 'a', publisher: 'p' },
    ]).checkAll();
    expect(byName(results, 'article-schema-complete').passed).toBe(true);
  });

  it('flags schemas missing @context or @type as required-fields issues', async () => {
    const results = await checkerFor([{ '@type': 'Organization', name: 'X' }, { '@context': 'https://schema.org' }]).checkAll();
    const requiredFields = byName(results, 'schema-required-fields-present');
    expect(requiredFields.passed).toBe(false);
    expect(requiredFields.message).toMatch(/missing @context/);
    expect(requiredFields.message).toMatch(/missing @type/);
  });

  it('flags an invalid @context value', async () => {
    const results = await checkerFor([{ '@context': 'https://wrong.org', '@type': 'Thing' }]).checkAll();
    const context = byName(results, 'schema-context-valid');
    expect(context.passed).toBe(false);
    expect(context.message).toMatch(/invalid @context/);
  });

  it('accepts the http:// schema.org context variant', async () => {
    const results = await checkerFor([{ '@context': 'http://schema.org', '@type': 'Thing' }]).checkAll();
    expect(byName(results, 'schema-context-valid').passed).toBe(true);
  });

  it('treats an AggregateRating (no author requirement) as a passing Review-family schema', async () => {
    const results = await checkerFor([{ '@type': 'AggregateRating', ratingValue: 4.5 }]).checkAll();
    expect(byName(results, 'review-schema-complete').passed).toBe(true);
  });

  it('recovers from a malformed JSON-LD block instead of throwing', async () => {
    const page = createMockPage({ headHtml: '<script type="application/ld+json">{not valid json</script>' });
    const checker = new SchemaValidationChecker({ page: page as Page, checkerKey: 'schemaValidation' });
    const results = await checker.checkAll();
    expect(results).toHaveLength(15);
    expect(byName(results, 'schema-required-fields-present').message).toMatch(/no schema markup/i);
  });
});
