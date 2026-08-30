import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { MetaTagsChecker } from '../../src/checkers/metaTags';
import { HeadingsChecker } from '../../src/checkers/headings';
import { ImagesChecker } from '../../src/checkers/images';
import { ContentChecker } from '../../src/checkers/content';

describe('Integration Tests - Multiple Checkers', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await page.close();
    await browser.close();
  });

  it('should run multiple checkers on a test HTML page', async () => {
    // Create a test HTML page
    const testHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="This is a comprehensive test page for SEO validation with proper meta description length that should pass all checks.">
        <title>Comprehensive SEO Test Page for Validation</title>
        <link rel="canonical" href="https://example.com/test">
        <meta property="og:title" content="Test Page">
        <meta property="og:description" content="Test Description">
        <meta property="og:image" content="https://example.com/image.jpg">
      </head>
      <body>
        <h1>Main Title</h1>
        <h2>Section 1</h2>
        <p>${'Lorem ipsum dolor sit amet. '.repeat(100)}</p>
        <h2>Section 2</h2>
        <img src="test1.jpg" alt="Test Image 1">
        <img src="test2.jpg" alt="Test Image 2">
      </body>
      </html>
    `;

    await page.setContent(testHTML);

    // Test MetaTagsChecker
    const metaChecker = new MetaTagsChecker({ page, checkerKey: 'metaTags' });
    const metaResults = await metaChecker.checkAll();
    expect(metaResults.length).toBeGreaterThan(0);
    expect(metaResults.some((r) => r.passed)).toBe(true);

    // Test HeadingsChecker
    const headingsChecker = new HeadingsChecker({ page, checkerKey: 'headings' });
    const headingResults = await headingsChecker.checkAll();
    expect(headingResults.length).toBeGreaterThan(0);

    // Test ImagesChecker
    const imagesChecker = new ImagesChecker({ page, checkerKey: 'images' });
    const imageResults = await imagesChecker.checkAll();
    expect(imageResults.length).toBeGreaterThan(0);

    // Test ContentChecker
    const contentChecker = new ContentChecker({ page, checkerKey: 'content' });
    const contentResults = await contentChecker.checkAll();
    expect(contentResults.length).toBeGreaterThan(0);
  });

  it('should handle page with missing SEO elements', async () => {
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test</title>
      </head>
      <body>
        <p>Minimal content</p>
      </body>
      </html>
    `;

    await page.setContent(testHTML);

    const metaChecker = new MetaTagsChecker({ page, checkerKey: 'metaTags' });
    const results = await metaChecker.checkAll();

    // Should have failing checks for missing meta tags
    const failedChecks = results.filter((r) => !r.passed);
    expect(failedChecks.length).toBeGreaterThan(0);
  });

  it('should handle page with optimal SEO elements', async () => {
    const testHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="This is an optimal meta description with perfect length between 120 and 160 characters for best SEO results and search engine display.">
        <title>Perfect SEO Title Length Here For Testing</title>
        <link rel="canonical" href="https://example.com/optimal">
        <meta property="og:title" content="Optimal Page">
        <meta property="og:description" content="Optimal Description">
        <meta property="og:image" content="https://example.com/optimal.jpg">
      </head>
      <body>
        <h1>Main Heading</h1>
        <h2>Subheading 1</h2>
        <p>${'Content word. '.repeat(400)}</p>
        <img src="image.jpg" alt="Descriptive alt text">
      </body>
      </html>
    `;

    await page.setContent(testHTML);

    const metaChecker = new MetaTagsChecker({ page, checkerKey: 'metaTags' });
    const results = await metaChecker.checkAll();

    // Most checks should pass
    const passedChecks = results.filter((r) => r.passed);
    expect(passedChecks.length).toBeGreaterThan(3);
  });
}, 120000);
