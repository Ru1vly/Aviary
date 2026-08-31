import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page as PlaywrightPage } from 'playwright';
import { Page } from 'playwright';
import { createMockPage } from '../mocks/mockPage';

// Checkers under test
import { AccessibilityChecker } from '../../src/checkers/accessibility';
import { LinksChecker } from '../../src/checkers/links';
import { SecurityChecker } from '../../src/checkers/security';
import { SitemapChecker } from '../../src/checkers/sitemap';
import { SocialMediaChecker } from '../../src/checkers/socialMedia';
import { StructuredDataChecker } from '../../src/checkers/structuredData';
import { TechnicalChecker } from '../../src/checkers/technical';
import { UIElementsChecker } from '../../src/checkers/uiElements';
import { URLFactorsChecker } from '../../src/checkers/urlFactors';
import { ContentChecker } from '../../src/checkers/content';
import { SpamDetectionChecker } from '../../src/checkers/spamDetection';

// ─── Browser for integration-style tests ─────────────────────────────────────
let browser: Browser;
let page: PlaywrightPage;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
});

afterAll(async () => {
  await page.close();
  await browser.close();
});

// Helper: set page content and return the page
async function withContent(html: string): Promise<PlaywrightPage> {
  await page.setContent(html);
  return page;
}

// ─── AccessibilityChecker ────────────────────────────────────────────────────
describe('AccessibilityChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <main><h1>Test</h1></main>
        <nav aria-label="Main navigation"><a href="/">Home</a></nav>
      </body></html>
    `);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('detects missing ARIA landmarks', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>Just text</p></body></html>`);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    const ariaResult = results[0];
    expect(ariaResult.passed).toBe(false);
    expect(ariaResult.message).toContain('landmarks');
  });

  it('passes when page has proper landmarks', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <header></header><main><h1>Title</h1></main><footer></footer><nav></nav>
      </body></html>
    `);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    // ARIA check (index 0) should pass – landmarks exist
    expect(results[0].passed).toBe(true);
  });

  it('detects form inputs missing labels', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <main></main>
        <form><input type="text"><input type="email"></form>
      </body></html>
    `);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    const formResult = results[1];
    expect(formResult.passed).toBe(false);
    expect(formResult.message).toContain('missing labels');
  });

  it('passes form labels check when inputs have labels', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <main></main>
        <form>
          <label for="email">Email</label>
          <input id="email" type="email">
        </form>
      </body></html>
    `);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(true);
  });

  it('fails when no skip links are present', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="/about">About</a></body></html>`);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    expect(results[2].passed).toBe(false);
  });

  it('passes when a skip link is present', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="#main">Skip to content</a></body></html>`);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    expect(results[2].passed).toBe(true);
  });

  it('flags elements with a positive tabindex', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="/" tabindex="3">Link</a></body></html>`);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    expect(results[3].passed).toBe(false);
    expect(results[3].message).toContain('positive tabindex');
  });

  it('passes tab order when there is no tabindex usage', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="/">Link</a></body></html>`);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    expect(results[3].passed).toBe(true);
  });

  it('flags negative-tabindex elements beyond a lowered threshold', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="/" tabindex="-1">Link</a></body></html>`);
    const checker = new AccessibilityChecker({
      page: p as Page,
      checkerKey: 'accessibility',
      config: { rules: { accessibility: { 'tab-order-natural': { options: { maxNegativeTabIndex: 0 } } } } },
    });
    const results = await checker.checkAll();
    expect(results[3].passed).toBe(false);
    expect(results[3].message).toContain('negative tabindex');
  });

  it('passes form labels when an input has a placeholder instead of a <label>', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><input type="text" placeholder="Name"></body></html>`);
    const checker = new AccessibilityChecker({ page: p as Page, checkerKey: 'accessibility' });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(true);
  });
});

// ─── LinksChecker ────────────────────────────────────────────────────────────
describe('LinksChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <a href="/about">About</a>
        <a href="https://external.com" rel="noopener">External</a>
      </body></html>
    `);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
  });

  it('fails when no links exist', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>No links</p></body></html>`);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    const linkStructure = results[0];
    expect(linkStructure.passed).toBe(false);
    expect(linkStructure.message).toContain('No links');
  });

  it('detects external links missing noopener', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <a href="/internal">Home</a>
        <a href="https://evil.com" target="_blank">External without noopener</a>
      </body></html>
    `);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    const externalResult = results[1];
    expect(externalResult.passed).toBe(false);
    expect(externalResult.message).toContain('noopener');
  });

  it('passes when external links have noopener', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <a href="/about">About</a>
        <a href="https://example.com" rel="noopener noreferrer">External</a>
      </body></html>
    `);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    const externalResult = results[1];
    expect(externalResult.passed).toBe(true);
  });

  it('flags links with no descriptive text', async () => {
    // Absolute URLs: page.setContent() leaves window.location at "about:blank",
    // where relative hrefs can't be URL-resolved at all (throws, caught, and
    // mis-classified as internal before the withoutText check ever runs) —
    // absolute hrefs avoid that resolution step entirely.
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <a href="https://external.example/about">About</a>
        <a href="https://external.example/other"></a>
      </body></html>
    `);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('without descriptive text');
  });

  it('fails internal-links-descriptive when there are no internal links at all', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body><a href="https://external.example/x">External only</a></body></html>
    `);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    const internalResult = results[2];
    expect(internalResult.passed).toBe(false);
    expect(internalResult.message).toContain('No internal links');
  });

  it('flags internal links missing descriptive text', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="/about"></a></body></html>`);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    const internalResult = results[2];
    expect(internalResult.passed).toBe(false);
    expect(internalResult.message).toContain('missing descriptive text');
  });

  it('passes internal-links-descriptive when links have text', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="/about">About us</a></body></html>`);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    expect(results[2].passed).toBe(true);
  });

  it('reports "no external links found" when every link is internal', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><a href="/about">About</a></body></html>`);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    expect(results[1].message).toContain('No external links');
  });

  it('reports external links with nofollow in the properly-configured summary', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <a href="https://external.example/x" rel="noopener nofollow">External</a>
      </body></html>
    `);
    const checker = new LinksChecker({ page: p as Page, checkerKey: 'links' });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(true);
    expect(results[1].message).toContain('properly configured');
  });
});

// ─── SecurityChecker ─────────────────────────────────────────────────────────
describe('SecurityChecker', () => {
  it('passes HTTPS check for HTTPS URL', () => {
    const mockPage = createMockPage({ url: 'https://example.com' }) as Page;
    const checker = new SecurityChecker({ page: mockPage, response: null, checkerKey: 'security' });
    return checker.checkAll().then((results) => {
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toContain('HTTPS');
    });
  });

  it('fails HTTPS check for HTTP URL', () => {
    const mockPage = createMockPage({ url: 'http://example.com' }) as Page;
    const checker = new SecurityChecker({ page: mockPage, response: null, checkerKey: 'security' });
    return checker.checkAll().then((results) => {
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain('not using HTTPS');
    });
  });

  it('fails security headers check when no response available', () => {
    const mockPage = createMockPage({ url: 'https://example.com' }) as Page;
    const checker = new SecurityChecker({ page: mockPage, response: null, checkerKey: 'security' });
    return checker.checkAll().then((results) => {
      expect(results[2].passed).toBe(false);
    });
  });

  it('returns exactly 3 check results', () => {
    const mockPage = createMockPage({ url: 'https://example.com' }) as Page;
    const checker = new SecurityChecker({ page: mockPage, response: null, checkerKey: 'security' });
    return checker.checkAll().then((results) => {
      expect(results).toHaveLength(3);
    });
  });
});

// ─── StructuredDataChecker ───────────────────────────────────────────────────
describe('StructuredDataChecker', () => {
  it('fails when no structured data found', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>No schema</p></body></html>`);
    const checker = new StructuredDataChecker({ page: p as Page, checkerKey: 'structuredData' });
    const results = await checker.checkAll();
    const jsonLdResult = results[0];
    expect(jsonLdResult.passed).toBe(false);
    expect(jsonLdResult.message).toContain('JSON-LD');
  });

  it('passes when valid JSON-LD is present', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"WebPage","name":"Test Page"}
        </script>
      </head><body></body></html>
    `);
    const checker = new StructuredDataChecker({ page: p as Page, checkerKey: 'structuredData' });
    const results = await checker.checkAll();
    const jsonLdResult = results[0];
    expect(jsonLdResult.passed).toBe(true);
  });

  it('returns results for all checks', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new StructuredDataChecker({ page: p as Page, checkerKey: 'structuredData' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });
});

// ─── SocialMediaChecker ──────────────────────────────────────────────────────
describe('SocialMediaChecker', () => {
  it('fails when Twitter card is missing', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new SocialMediaChecker({ page: p as Page, checkerKey: 'socialMedia' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(false);
  });

  it('passes when Twitter card is fully configured', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head>
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Test Title">
        <meta name="twitter:description" content="Test description here">
        <meta name="twitter:image" content="https://example.com/img.jpg">
      </head><body></body></html>
    `);
    const checker = new SocialMediaChecker({ page: p as Page, checkerKey: 'socialMedia' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(true);
  });

  it('returns results array', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new SocialMediaChecker({ page: p as Page, checkerKey: 'socialMedia' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r)).toBe(true);
  });

  it('fails Twitter Card when partially configured', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head><meta name="twitter:card" content="summary"></head><body></body></html>
    `);
    const checker = new SocialMediaChecker({ page: p as Page, checkerKey: 'socialMedia' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('incomplete');
  });

  it('fails Open Graph when no tags are present, and when partially configured', async () => {
    const none = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const noneChecker = new SocialMediaChecker({ page: none as Page, checkerKey: 'socialMedia' });
    const noneResults = await noneChecker.checkAll();
    expect(noneResults[1].passed).toBe(false);
    expect(noneResults[1].message).toContain('No Open Graph');

    const p = await withContent(`
      <!DOCTYPE html><html><head><meta property="og:title" content="Title"></head><body></body></html>
    `);
    const checker = new SocialMediaChecker({ page: p as Page, checkerKey: 'socialMedia' });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(false);
    expect(results[1].message).toContain('incomplete');
  });

  it('passes Open Graph tags when fully configured', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head>
        <meta property="og:title" content="Title">
        <meta property="og:description" content="Description text">
        <meta property="og:image" content="https://example.com/img.jpg">
        <meta property="og:image:width" content="1200">
        <meta property="og:url" content="https://example.com">
        <meta property="og:type" content="website">
      </head><body></body></html>
    `);
    const checker = new SocialMediaChecker({ page: p as Page, checkerKey: 'socialMedia' });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(true);
  });

  it('detects Facebook-specific tags and their absence', async () => {
    const none = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const noneChecker = new SocialMediaChecker({ page: none as Page, checkerKey: 'socialMedia' });
    const noneResults = await noneChecker.checkAll();
    expect(noneResults[2].message).toContain('No Facebook-specific tags');

    const p = await withContent(`
      <!DOCTYPE html><html><head><meta property="fb:app_id" content="12345"></head><body></body></html>
    `);
    const checker = new SocialMediaChecker({ page: p as Page, checkerKey: 'socialMedia' });
    const results = await checker.checkAll();
    expect(results[2].passed).toBe(true);
    expect(results[2].message).toContain('Facebook-specific tags found');
  });
});

// ─── TechnicalChecker ────────────────────────────────────────────────────────
describe('TechnicalChecker', () => {
  it('returns all check results', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head><title>Test Page Title</title></head>
      <body><h1>Main Heading</h1></body></html>
    `);
    const checker = new TechnicalChecker({ page: p as Page, response: null, checkerKey: 'technical' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('fails response code check when no response provided', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new TechnicalChecker({ page: p as Page, response: null, checkerKey: 'technical' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('response');
  });

  it('detects multiple H1 tags', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head><title>Test</title></head>
      <body><h1>First H1</h1><h1>Second H1</h1></body></html>
    `);
    const checker = new TechnicalChecker({ page: p as Page, response: null, checkerKey: 'technical' });
    const results = await checker.checkAll();
    const duplicateResult = results[3]; // checkDuplicateTitles
    expect(duplicateResult.passed).toBe(false);
    expect(duplicateResult.message).toContain('Multiple H1');
  });

  it('passes when single H1 is present', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head><title>Test</title></head>
      <body><h1>Only One Heading</h1></body></html>
    `);
    const checker = new TechnicalChecker({ page: p as Page, response: null, checkerKey: 'technical' });
    const results = await checker.checkAll();
    const duplicateResult = results[3];
    expect(duplicateResult.passed).toBe(true);
  });

  it('flags a missing H1', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>`);
    const checker = new TechnicalChecker({ page: p as Page, response: null, checkerKey: 'technical' });
    const results = await checker.checkAll();
    expect(results[3].passed).toBe(false);
    expect(results[3].message).toContain('No H1');
  });

  it('marks H1/Title alignment as optimal when they match', async () => {
    const p = await withContent(
      `<!DOCTYPE html><html><head><title>Same Text</title></head><body><h1>Same Text</h1></body></html>`
    );
    const checker = new TechnicalChecker({ page: p as Page, response: null, checkerKey: 'technical' });
    const results = await checker.checkAll();
    expect(results[3].passed).toBe(true);
    expect(results[3].message).toContain('optimally aligned');
  });

  it('flags a large HTML page size (via a lowered threshold) and passes a small one', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>${'x'.repeat(500)}</p></body></html>`);
    const checker = new TechnicalChecker({
      page: p as Page,
      response: null,
      checkerKey: 'technical',
      config: { rules: { technical: { 'page-size-acceptable': { options: { failKB: 0.1, warnKB: 0.05 } } } } },
    });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(false);
    expect(results[1].message).toContain('large');

    const smallChecker = new TechnicalChecker({ page: p as Page, response: null, checkerKey: 'technical' });
    const smallResults = await smallChecker.checkAll();
    expect(smallResults[1].passed).toBe(true);
  });

  it('marks page size as acceptable-but-optimizable between warnKB and failKB', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>${'x'.repeat(500)}</p></body></html>`);
    const checker = new TechnicalChecker({
      page: p as Page,
      response: null,
      checkerKey: 'technical',
      config: { rules: { technical: { 'page-size-acceptable': { options: { failKB: 1000, warnKB: 0.05 } } } } },
    });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(true);
    expect(results[1].message).toContain('could be optimized');
  });
});

// ─── UIElementsChecker ───────────────────────────────────────────────────────
describe('UIElementsChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
  });

  it('fails when favicon is missing', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    const faviconResult = results[0];
    expect(faviconResult.passed).toBe(false);
    expect(faviconResult.message.toLowerCase()).toContain('favicon');
  });

  it('passes when favicon is set', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html lang="en"><head>
        <link rel="icon" href="/favicon.ico">
      </head><body></body></html>
    `);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(true);
  });

  it('flags breadcrumb HTML present without structured data', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body><nav class="breadcrumb"><a href="/">Home</a></nav></body></html>
    `);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(false);
    expect(results[1].message).toContain('missing structured data');
  });

  it('passes breadcrumbs when JSON-LD BreadcrumbList is present', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head>
        <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
      </head><body></body></html>
    `);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    expect(results[1].passed).toBe(true);
  });

  it('flags a missing lang attribute, and hreflang without x-default', async () => {
    const noLang = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const noLangChecker = new UIElementsChecker({ page: noLang as Page, checkerKey: 'uiElements' });
    const noLangResults = await noLangChecker.checkAll();
    expect(noLangResults[2].passed).toBe(false);

    const p = await withContent(`
      <!DOCTYPE html><html lang="en"><head>
        <link rel="alternate" hreflang="fr" href="https://example.com/fr">
      </head><body></body></html>
    `);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    expect(results[2].passed).toBe(false);
    expect(results[2].message).toContain('x-default');
  });

  it('passes language tags with a proper x-default hreflang', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html lang="en"><head>
        <link rel="alternate" hreflang="x-default" href="https://example.com/">
      </head><body></body></html>
    `);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    expect(results[2].passed).toBe(true);
    expect(results[2].message).toContain('hreflang tag');
  });

  it('flags a missing viewport, and warns when user-scalable=no', async () => {
    const missing = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const missingChecker = new UIElementsChecker({ page: missing as Page, checkerKey: 'uiElements' });
    const missingResults = await missingChecker.checkAll();
    expect(missingResults[3].passed).toBe(false);
    expect(missingResults[3].message).toContain('Missing viewport');

    const noZoom = await withContent(`
      <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
      </head><body></body></html>
    `);
    const noZoomChecker = new UIElementsChecker({ page: noZoom as Page, checkerKey: 'uiElements' });
    const noZoomResults = await noZoomChecker.checkAll();
    expect(noZoomResults[3].passed).toBe(false);
    expect(noZoomResults[3].message).toContain('user-scalable=no');
  });

  it('passes a properly configured mobile viewport', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head><body></body></html>
    `);
    const checker = new UIElementsChecker({ page: p as Page, checkerKey: 'uiElements' });
    const results = await checker.checkAll();
    expect(results[3].passed).toBe(true);
  });
});

// ─── URLFactorsChecker ───────────────────────────────────────────────────────
describe('URLFactorsChecker', () => {
  it('returns results array', async () => {
    const mockPage = createMockPage({ url: 'https://example.com/about' }) as Page;
    const checker = new URLFactorsChecker({ page: mockPage, checkerKey: 'urlFactors' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('passes URL length check for a short URL', async () => {
    const mockPage = createMockPage({ url: 'https://example.com/about' }) as Page;
    const checker = new URLFactorsChecker({ page: mockPage, checkerKey: 'urlFactors' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(true);
    expect(results[0].message).toContain('optimal');
  });

  it('fails URL length check for a very long URL', async () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(120);
    const mockPage = createMockPage({ url: longUrl }) as Page;
    const checker = new URLFactorsChecker({ page: mockPage, checkerKey: 'urlFactors' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('too long');
  });

  it('fails readability check for URL with underscores', async () => {
    const mockPage = createMockPage({ url: 'https://example.com/my_page_about_seo' }) as Page;
    const checker = new URLFactorsChecker({ page: mockPage, checkerKey: 'urlFactors' });
    const results = await checker.checkAll();
    const readabilityResult = results[1];
    expect(readabilityResult.passed).toBe(false);
    expect(readabilityResult.message.toLowerCase()).toContain('underscore');
  });
});

// ─── ContentChecker ──────────────────────────────────────────────────────────
describe('ContentChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <p>${'Content word. '.repeat(200)}</p>
      </body></html>
    `);
    const checker = new ContentChecker({ page: p as Page, checkerKey: 'content' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
  });

  it('fails word count check for thin content', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>Too short.</p></body></html>`);
    const checker = new ContentChecker({ page: p as Page, checkerKey: 'content' });
    const results = await checker.checkAll();
    const wordCountResult = results[0];
    expect(wordCountResult.passed).toBe(false);
  });

  it('passes word count check for rich content', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <p>${'The quick brown fox jumps over the lazy dog. '.repeat(80)}</p>
      </body></html>
    `);
    const checker = new ContentChecker({ page: p as Page, checkerKey: 'content' });
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(true);
  });
});

// ─── SpamDetectionChecker ────────────────────────────────────────────────────
describe('SpamDetectionChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body><p>Normal clean content here.</p></body></html>
    `);
    const checker = new SpamDetectionChecker({ page: p as Page, checkerKey: 'spamDetection' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('passes hidden text check for clean page', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <h1>Welcome</h1>
        <p>This is a clean, well-written page about web development best practices.</p>
      </body></html>
    `);
    const checker = new SpamDetectionChecker({ page: p as Page, checkerKey: 'spamDetection' });
    const results = await checker.checkAll();
    const hiddenTextResult = results[0];
    expect(hiddenTextResult.passed).toBe(true);
  });

  it('fails keyword stuffing check for repetitive content', async () => {
    const keyword = 'buy cheap';
    const p = await withContent(`
      <!DOCTYPE html><html><body>
        <p>${(keyword + ' ').repeat(60)}</p>
      </body></html>
    `);
    const checker = new SpamDetectionChecker({ page: p as Page, checkerKey: 'spamDetection' });
    const results = await checker.checkAll();
    const stuffingResult = results[1]; // checkKeywordStuffing
    expect(stuffingResult.passed).toBe(false);
  });
});

// ─── SitemapChecker ──────────────────────────────────────────────────────────
describe('SitemapChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new SitemapChecker({ page: p as Page, checkerKey: 'sitemap' });
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('returns exactly 2 checks', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new SitemapChecker({ page: p as Page, checkerKey: 'sitemap' });
    const results = await checker.checkAll();
    expect(results).toHaveLength(2);
  });
});
