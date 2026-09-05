import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { EcommerceChecker } from '../../src/checkers/ecommerce';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): EcommerceChecker {
  const page = createMockPage(opts);
  return new EcommerceChecker({ page: page as Page, checkerKey: 'ecommerce' });
}

function ldJson(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function byName(results: Awaited<ReturnType<EcommerceChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('EcommerceChecker', () => {
  it('reports "not an e-commerce page" for schema/price/availability/reviews/cart on a plain content page', async () => {
    const results = await checkerFor({ html: '<p>Just an article.</p>' }).checkAll();
    expect(results).toHaveLength(15);
    expect(byName(results, 'ecommerce-product-schema-complete').message).toMatch(/not an e-commerce/i);
    expect(byName(results, 'price-display-clear').passed).toBe(true);
    expect(byName(results, 'availability-info-present').passed).toBe(true);
    expect(byName(results, 'add-to-cart-present').passed).toBe(true);
  });

  it('does not punish a non-e-commerce page for lacking a description, brand info, or checkout security signals', async () => {
    // Unlike the other checks above, these three previously evaluated
    // universal criteria regardless of whether the page had any
    // e-commerce signal at all, failing (and dragging the score down) on
    // plain content pages just for not being a storefront.
    const results = await checkerFor({ url: 'http://example.com', html: '<p>Just an article.</p>' }).checkAll();
    expect(byName(results, 'product-description-present').passed).toBe(true);
    expect(byName(results, 'product-description-present').message).toMatch(/not an e-commerce page/i);
    expect(byName(results, 'brand-information-present').passed).toBe(true);
    expect(byName(results, 'brand-information-present').message).toMatch(/not an e-commerce page/i);
    expect(byName(results, 'secure-checkout-indicators').passed).toBe(true);
    expect(byName(results, 'secure-checkout-indicators').message).toMatch(/not an e-commerce page/i);
  });

  it('flags an incomplete Product schema and passes a complete one', async () => {
    const incomplete = await checkerFor({ headHtml: ldJson({ '@type': 'Product', name: 'Widget' }) }).checkAll();
    expect(byName(incomplete, 'ecommerce-product-schema-complete').passed).toBe(false);

    const complete = await checkerFor({
      headHtml: ldJson({
        '@type': 'Product',
        name: 'Widget',
        image: 'w.jpg',
        description: 'A fine widget',
        brand: 'Acme',
        offers: { price: '9.99', priceCurrency: 'USD', availability: 'InStock' },
      }),
    }).checkAll();
    expect(byName(complete, 'ecommerce-product-schema-complete').passed).toBe(true);
  });

  it('flags price display missing currency/decimal, passes a clean price', async () => {
    const bad = await checkerFor({ html: '<span class="price">99</span>' }).checkAll();
    expect(byName(bad, 'price-display-clear').passed).toBe(false);

    const good = await checkerFor({ html: '<span class="price">$99.00</span>' }).checkAll();
    expect(byName(good, 'price-display-clear').passed).toBe(true);
  });

  it('detects availability info from keywords or elements', async () => {
    const results = await checkerFor({ html: '<p>In Stock</p>' }).checkAll();
    expect(byName(results, 'availability-info-present').passed).toBe(true);
  });

  it('requires AggregateRating schema when review UI is present', async () => {
    const noSchema = await checkerFor({ html: '<div class="review-count">42 reviews</div>' }).checkAll();
    expect(byName(noSchema, 'reviews-ratings-schema-present').passed).toBe(false);

    const withSchema = await checkerFor({
      html: '<div class="review-count">42 reviews</div><div itemprop="aggregateRating"></div>',
    }).checkAll();
    expect(byName(withSchema, 'reviews-ratings-schema-present').passed).toBe(true);
  });

  it('detects an "Add to Cart" button', async () => {
    const results = await checkerFor({ html: '<button>Add to Cart</button>' }).checkAll();
    expect(byName(results, 'add-to-cart-present').message).toMatch(/1 button/);
  });

  it('flags product images missing alt text or a gallery', async () => {
    const results = await checkerFor({
      html: '<div class="product-gallery"><img src="a.jpg"><img src="b.jpg"></div>',
    }).checkAll();
    expect(byName(results, 'product-images-adequate').passed).toBe(false);

    const good = await checkerFor({
      html: '<div class="product-gallery"><img src="a.jpg" alt="Widget front"></div>',
    }).checkAll();
    expect(byName(good, 'product-images-adequate').passed).toBe(true);
  });

  it('requires a product description and flags a short one, on an actual product page', async () => {
    const priceHtml = '<span class="price">$9.99</span>';

    const missing = await checkerFor({ html: priceHtml + '<p>plain text</p>' }).checkAll();
    expect(byName(missing, 'product-description-present').passed).toBe(false);
    expect(byName(missing, 'product-description-present').message).toMatch(/no product description/i);

    const short = await checkerFor({ html: priceHtml + '<div class="description">short</div>' }).checkAll();
    expect(byName(short, 'product-description-present').passed).toBe(false);
    expect(byName(short, 'product-description-present').message).toMatch(/too short/i);

    const long = await checkerFor({
      html: priceHtml + `<div class="description">${'x'.repeat(200)}</div>`,
    }).checkAll();
    expect(byName(long, 'product-description-present').passed).toBe(true);
  });

  // Regression test for a confirmed false negative found testing against
  // books.toscrape.com: the site names only the *label* of its description
  // section (`<div id="product_description">` holding just a heading) and
  // puts the actual paragraph as a DOM sibling, not a child -- a plain
  // textContent sum over the matched container undercounted (41 chars
  // measured vs. ~600 actual) and false-failed. resolveDescriptiveText
  // (shared/dom.ts) now falls back to the container's siblings when its own
  // text looks like a bare label.
  it('finds a product description that lives as a sibling of its labeled container, not a child', async () => {
    const priceHtml = '<span class="price">$9.99</span>';
    const siblingShaped = await checkerFor({
      html:
        priceHtml +
        '<div id="product_description"><h2>Product Description</h2></div>' +
        `<p>${'x'.repeat(200)}</p>`,
    }).checkAll();

    expect(byName(siblingShaped, 'product-description-present').passed).toBe(true);
  });

  // Regression test for a real product card (webscraper.io) where a
  // genuinely short (99-char) description sits inside the same wrapper as
  // its price and title, as itemprop-tagged siblings. Without excluding
  // those, the sibling-rescue fallback above pads a legitimately-thin
  // description with unrelated field text (99 -> 166 chars) instead of only
  // rescuing text that was merely misplaced -- so this must still fail.
  it('does not pad a genuinely short description with a sibling price/title field', async () => {
    const shortWithPriceAndTitleSiblings = await checkerFor({
      html: `
        <div class="caption">
          <h4 class="price" itemprop="offers"><span itemprop="price">$295.99</span></h4>
          <h4 class="title card-title" itemprop="name">Asus VivoBook X441NA-GA190</h4>
          <p class="description card-text" itemprop="description">${'x'.repeat(99)}</p>
        </div>
      `,
    }).checkAll();

    const result = byName(shortWithPriceAndTitleSiblings, 'product-description-present');
    expect(result.passed).toBe(false);
    expect(result.details?.totalLength).toBe(99);
  });

  it('honors a rule-option override for product-description-present', async () => {
    const page = createMockPage({
      html: `<span class="price">$9.99</span><div class="description">${'x'.repeat(150)}</div>`,
    });
    const checker = new EcommerceChecker({
      page: page as Page,
      checkerKey: 'ecommerce',
      config: { rules: { ecommerce: { 'product-description-present': { options: { minLength: 500 } } } } },
    });
    const results = await checker.checkAll();
    expect(byName(results, 'product-description-present').passed).toBe(false);
  });

  it('detects SKU, brand, shipping, return policy, payment, and wishlist signals', async () => {
    const results = await checkerFor({
      html:
        '<span class="price">$9.99</span>' +
        '<p>SKU: 12345</p><p>Brand: Acme</p><p>Free shipping available</p>' +
        '<a href="/returns">Return policy</a><p>We accept Visa and PayPal</p>' +
        '<button class="wishlist-btn">Add to wishlist</button>' +
        '<div class="related-products"><div class="product-card"></div></div>',
    }).checkAll();
    expect(byName(results, 'sku-identifier-present').passed).toBe(true);
    expect(byName(results, 'brand-information-present').passed).toBe(true);
    expect(byName(results, 'shipping-information-present').passed).toBe(true);
    expect(byName(results, 'return-policy-present').message).toMatch(/link present/i);
    expect(byName(results, 'payment-methods-visible').message).toMatch(/mentioned/i);
    expect(byName(results, 'wishlist-functionality-present').passed).toBe(true);
    expect(byName(results, 'related-products-present').message).toMatch(/1 items/);
  });

  it('fails secure-checkout on HTTP and requires a security indicator on HTTPS, on an actual product page', async () => {
    const priceHtml = '<span class="price">$9.99</span>';

    const http = await checkerFor({ url: 'http://example.com', html: priceHtml }).checkAll();
    expect(byName(http, 'secure-checkout-indicators').message).toMatch(/not using https/i);

    const httpsNoIndicator = await checkerFor({ url: 'https://example.com', html: priceHtml }).checkAll();
    expect(byName(httpsNoIndicator, 'secure-checkout-indicators').passed).toBe(false);

    const httpsWithIndicator = await checkerFor({
      url: 'https://example.com',
      html: priceHtml + '<p>SSL secure checkout</p>',
    }).checkAll();
    expect(byName(httpsWithIndicator, 'secure-checkout-indicators').passed).toBe(true);
  });
});
