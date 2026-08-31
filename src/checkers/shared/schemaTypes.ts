/**
 * Loose types for JSON-LD/schema.org blocks parsed from a page under audit.
 *
 * Real-world JSON-LD is unreliable — sites omit fields, use non-standard shapes,
 * or nest things unexpectedly. Every field below is optional and untyped beyond
 * its JS-native shape; these exist to narrow `unknown` enough to drop `any` at
 * the checker call sites (schemaValidation.ts, structuredData.ts), not to
 * validate schema.org compliance.
 */

export interface JsonLdBlock {
  '@context'?: string;
  '@type'?: string | string[];
  [key: string]: unknown;
}

export interface OrganizationSchema extends JsonLdBlock {
  name?: string;
  url?: string;
  logo?: unknown;
  sameAs?: unknown;
  contactPoint?: unknown;
}

export interface PersonSchema extends JsonLdBlock {
  name?: string;
  url?: string;
  image?: unknown;
  jobTitle?: string;
}

export interface ProductOffer {
  price?: unknown;
  priceCurrency?: unknown;
  availability?: unknown;
}

export interface ProductSchema extends JsonLdBlock {
  name?: string;
  image?: unknown;
  description?: string;
  offers?: ProductOffer;
  sku?: string;
  brand?: unknown;
  aggregateRating?: unknown;
}

export interface ArticleSchema extends JsonLdBlock {
  headline?: string;
  image?: unknown;
  datePublished?: string;
  author?: unknown;
  publisher?: unknown;
}

export interface BreadcrumbListSchema extends JsonLdBlock {
  itemListElement?: unknown[];
}

export interface FAQPageSchema extends JsonLdBlock {
  mainEntity?: unknown[];
}

export interface HowToSchema extends JsonLdBlock {
  name?: string;
  step?: unknown[];
}

export interface ReviewSchema extends JsonLdBlock {
  ratingValue?: unknown;
  reviewRating?: unknown;
  author?: unknown;
}

export interface EventSchema extends JsonLdBlock {
  name?: string;
  startDate?: string;
  location?: unknown;
}

export interface LocalBusinessSchema extends JsonLdBlock {
  name?: string;
  address?: unknown;
  telephone?: string;
  openingHoursSpecification?: unknown;
}

export interface WebPageSchema extends JsonLdBlock {
  name?: string;
  url?: string;
  description?: string;
}

export interface WebSiteSchema extends JsonLdBlock {
  name?: string;
  url?: string;
  potentialAction?: unknown;
}

export type ImageObjectSchema = JsonLdBlock;

/**
 * Narrows a JsonLdBlock by `@type`, matching the exact per-site semantics each
 * checker already relied on before this was typed:
 *  - one or more exact `@type` values (most sites)
 *  - `opts.includes: true` additionally matches when `@type` is a string
 *    containing `type` as a substring, or an array containing it — this was
 *    schemaValidation.ts's original Organization-only fallback
 *    (`data['@type'] === 'Organization' || data['@type']?.includes('Organization')`)
 *    and is opt-in so the other 11 types keep their original exact-match-only behavior.
 */
export function isSchemaType<T extends JsonLdBlock>(
  data: JsonLdBlock,
  types: string | string[],
  opts: { includes?: boolean } = {}
): data is T {
  if (!data) return false;
  const wanted = Array.isArray(types) ? types : [types];
  const actual = data['@type'];

  if (wanted.some((type) => actual === type)) return true;

  if (opts.includes && (typeof actual === 'string' || Array.isArray(actual))) {
    return wanted.some((type) => (actual as string | string[]).includes(type));
  }

  return false;
}
