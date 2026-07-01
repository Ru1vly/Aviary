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
    const checker = new AccessibilityChecker(p as Page);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('detects missing ARIA landmarks', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>Just text</p></body></html>`);
    const checker = new AccessibilityChecker(p as Page);
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
    const checker = new AccessibilityChecker(p as Page);
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
    const checker = new AccessibilityChecker(p as Page);
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
    const checker = new AccessibilityChecker(p as Page);
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
    const checker = new LinksChecker(p as Page);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
  });

  it('fails when no links exist', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>No links</p></body></html>`);
    const checker = new LinksChecker(p as Page);
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
    const checker = new LinksChecker(p as Page);
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
    const checker = new LinksChecker(p as Page);
    const results = await checker.checkAll();
    const externalResult = results[1];
    expect(externalResult.passed).toBe(true);
  });
});

// ─── SecurityChecker ─────────────────────────────────────────────────────────
describe('SecurityChecker', () => {
  it('passes HTTPS check for HTTPS URL', () => {
    const mockPage = createMockPage({ url: 'https://example.com' }) as Page;
    const checker = new SecurityChecker(mockPage, null);
    return checker.checkAll().then((results) => {
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toContain('HTTPS');
    });
  });

  it('fails HTTPS check for HTTP URL', () => {
    const mockPage = createMockPage({ url: 'http://example.com' }) as Page;
    const checker = new SecurityChecker(mockPage, null);
    return checker.checkAll().then((results) => {
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain('not using HTTPS');
    });
  });

  it('fails security headers check when no response available', () => {
    const mockPage = createMockPage({ url: 'https://example.com' }) as Page;
    const checker = new SecurityChecker(mockPage, null);
    return checker.checkAll().then((results) => {
      expect(results[2].passed).toBe(false);
    });
  });

  it('returns exactly 3 check results', () => {
    const mockPage = createMockPage({ url: 'https://example.com' }) as Page;
    const checker = new SecurityChecker(mockPage, null);
    return checker.checkAll().then((results) => {
      expect(results).toHaveLength(3);
    });
  });
});

// ─── StructuredDataChecker ───────────────────────────────────────────────────
describe('StructuredDataChecker', () => {
  it('fails when no structured data found', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>No schema</p></body></html>`);
    const checker = new StructuredDataChecker(p as Page);
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
    const checker = new StructuredDataChecker(p as Page);
    const results = await checker.checkAll();
    const jsonLdResult = results[0];
    expect(jsonLdResult.passed).toBe(true);
  });

  it('returns results for all checks', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new StructuredDataChecker(p as Page);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });
});

// ─── SocialMediaChecker ──────────────────────────────────────────────────────
describe('SocialMediaChecker', () => {
  it('fails when Twitter card is missing', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new SocialMediaChecker(p as Page);
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
    const checker = new SocialMediaChecker(p as Page);
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(true);
  });

  it('returns results array', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new SocialMediaChecker(p as Page);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r)).toBe(true);
  });
});

// ─── TechnicalChecker ────────────────────────────────────────────────────────
describe('TechnicalChecker', () => {
  it('returns all check results', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head><title>Test Page Title</title></head>
      <body><h1>Main Heading</h1></body></html>
    `);
    const checker = new TechnicalChecker(p as Page, null);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('fails response code check when no response provided', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new TechnicalChecker(p as Page, null);
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('response');
  });

  it('detects multiple H1 tags', async () => {
    const p = await withContent(`
      <!DOCTYPE html><html><head><title>Test</title></head>
      <body><h1>First H1</h1><h1>Second H1</h1></body></html>
    `);
    const checker = new TechnicalChecker(p as Page, null);
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
    const checker = new TechnicalChecker(p as Page, null);
    const results = await checker.checkAll();
    const duplicateResult = results[3];
    expect(duplicateResult.passed).toBe(true);
  });
});

// ─── UIElementsChecker ───────────────────────────────────────────────────────
describe('UIElementsChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new UIElementsChecker(p as Page);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
  });

  it('fails when favicon is missing', async () => {
    const p = await withContent(`<!DOCTYPE html><html><head></head><body></body></html>`);
    const checker = new UIElementsChecker(p as Page);
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
    const checker = new UIElementsChecker(p as Page);
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(true);
  });
});

// ─── URLFactorsChecker ───────────────────────────────────────────────────────
describe('URLFactorsChecker', () => {
  it('returns results array', async () => {
    const mockPage = createMockPage({ url: 'https://example.com/about' }) as Page;
    const checker = new URLFactorsChecker(mockPage);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('passes URL length check for a short URL', async () => {
    const mockPage = createMockPage({ url: 'https://example.com/about' }) as Page;
    const checker = new URLFactorsChecker(mockPage);
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(true);
    expect(results[0].message).toContain('optimal');
  });

  it('fails URL length check for a very long URL', async () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(120);
    const mockPage = createMockPage({ url: longUrl }) as Page;
    const checker = new URLFactorsChecker(mockPage);
    const results = await checker.checkAll();
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('too long');
  });

  it('fails readability check for URL with underscores', async () => {
    const mockPage = createMockPage({ url: 'https://example.com/my_page_about_seo' }) as Page;
    const checker = new URLFactorsChecker(mockPage);
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
    const checker = new ContentChecker(p as Page);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
  });

  it('fails word count check for thin content', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body><p>Too short.</p></body></html>`);
    const checker = new ContentChecker(p as Page);
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
    const checker = new ContentChecker(p as Page);
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
    const checker = new SpamDetectionChecker(p as Page);
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
    const checker = new SpamDetectionChecker(p as Page);
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
    const checker = new SpamDetectionChecker(p as Page);
    const results = await checker.checkAll();
    const stuffingResult = results[1]; // checkKeywordStuffing
    expect(stuffingResult.passed).toBe(false);
  });
});

// ─── SitemapChecker ──────────────────────────────────────────────────────────
describe('SitemapChecker', () => {
  it('returns results array', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new SitemapChecker(p as Page);
    const results = await checker.checkAll();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
  });

  it('returns exactly 2 checks', async () => {
    const p = await withContent(`<!DOCTYPE html><html><body></body></html>`);
    const checker = new SitemapChecker(p as Page);
    const results = await checker.checkAll();
    expect(results).toHaveLength(2);
  });
});
