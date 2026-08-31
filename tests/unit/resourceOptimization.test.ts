import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { ResourceOptimizationChecker } from '../../src/checkers/resourceOptimization';
import { createMockPage } from '../mocks/mockPage';

function checkerFor(headHtml: string, html = ''): ResourceOptimizationChecker {
  const page = createMockPage({ headHtml, html });
  return new ResourceOptimizationChecker({ page: page as Page, checkerKey: 'resourceOptimization' });
}

function byName(results: Awaited<ReturnType<ResourceOptimizationChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('ResourceOptimizationChecker', () => {
  it('flags unminified, uncombined, non-CDN, non-optimized resources on a bare page', async () => {
    const checker = checkerFor(
      Array.from({ length: 12 }, (_, i) => `<script src="/js/app${i}.js"></script>`).join('') +
        Array.from({ length: 8 }, (_, i) => `<link rel="stylesheet" href="/css/s${i}.css">`).join('')
    );
    const results = await checker.checkAll();
    expect(byName(results, 'minification-adequate').passed).toBe(false);
    expect(byName(results, 'resource-combining-adequate').passed).toBe(false);
    expect(byName(results, 'cdn-usage-present').passed).toBe(false);
    expect(byName(results, 'resource-hints-present').passed).toBe(false);
    expect(byName(results, 'javascript-optimization-adequate').passed).toBe(false);
    expect(byName(results, 'resource-priority-configured').passed).toBe(false);
    expect(byName(results, 'http2-support-detected').passed).toBe(false);
    expect(byName(results, 'no-duplicate-resources').passed).toBe(true);
  });

  it('passes minification/combining/CDN when resources look optimized', async () => {
    const checker = checkerFor(
      '<script src="https://cdn.jsdelivr.net/app.min.js" async></script>' +
        '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/style.min.css">' +
        '<link rel="preconnect" href="https://cdn.jsdelivr.net">' +
        '<link rel="preload" href="/font.woff2" as="font">'
    );
    const results = await checker.checkAll();
    expect(byName(results, 'minification-adequate').passed).toBe(true);
    expect(byName(results, 'resource-combining-adequate').passed).toBe(true);
    expect(byName(results, 'cdn-usage-present').passed).toBe(true);
    expect(byName(results, 'resource-hints-present').passed).toBe(true);
    expect(byName(results, 'javascript-optimization-adequate').passed).toBe(true);
    expect(byName(results, 'resource-priority-configured').passed).toBe(true);
    expect(byName(results, 'font-optimization-adequate').passed).toBe(true);
  });

  it('reports "no X to check" when a resource category is entirely absent', async () => {
    const checker = checkerFor('');
    const results = await checker.checkAll();
    expect(byName(results, 'modern-image-formats-used').message).toMatch(/no images/i);
    expect(byName(results, 'css-optimization-adequate').message).toMatch(/no external stylesheets/i);
    expect(byName(results, 'javascript-optimization-adequate').message).toMatch(/no external scripts/i);
    expect(byName(results, 'font-optimization-adequate').message).toMatch(/no external fonts/i);
    expect(byName(results, 'resource-caching-present').message).toMatch(/no resources/i);
  });

  it('flags non-modern image formats and passes for webp/avif', async () => {
    const legacy = checkerFor(Array.from({ length: 8 }, (_, i) => `<img src="/img${i}.jpg">`).join(''));
    expect(byName(await legacy.checkAll(), 'modern-image-formats-used').passed).toBe(false);

    const modern = checkerFor('<img src="/a.webp">');
    expect(byName(await modern.checkAll(), 'modern-image-formats-used').passed).toBe(true);
  });

  it('flags large inline scripts/styles as a caching/inline-resource issue', async () => {
    const bigInline = 'x'.repeat(60000);
    const checker = checkerFor(`<style>${bigInline}</style>`);
    const results = await checker.checkAll();
    expect(byName(results, 'inline-resources-acceptable').passed).toBe(false);
  });

  it('detects duplicate script/style resources', async () => {
    const checker = checkerFor(
      '<script src="/dup.js"></script><script src="/dup.js"></script><link rel="stylesheet" href="/dup.css"><link rel="stylesheet" href="/dup.css">'
    );
    const results = await checker.checkAll();
    expect(byName(results, 'no-duplicate-resources').passed).toBe(false);
  });

  it('detects cache-busted resources and third-party resource share', async () => {
    const checker = checkerFor(
      '<script src="https://thirdparty.example/lib.abcdef1234567.js"></script>' +
        '<script src="/local.js?v=2"></script>'
    );
    const results = await checker.checkAll();
    expect(byName(results, 'third-party-resources-limited').message).toMatch(/%/);
    expect(byName(results, 'resource-caching-present').passed).toBe(true);
  });

  it('detects critical CSS via a large inline <style> block', async () => {
    const checker = checkerFor(`<style>${'.a{color:red}'.repeat(200)}</style>`);
    const results = await checker.checkAll();
    expect(byName(results, 'critical-resources-optimized').passed).toBe(true);
  });

  it('honors a rule-option override for minification-adequate', async () => {
    const page = createMockPage({ headHtml: '<script src="/a.min.js"></script>' });
    const checker = new ResourceOptimizationChecker({
      page: page as Page,
      checkerKey: 'resourceOptimization',
      config: { rules: { resourceOptimization: { 'minification-adequate': { options: { minRatePercent: 101 } } } } },
    });
    const results = await checker.checkAll();
    expect(byName(results, 'minification-adequate').passed).toBe(false);
  });
});
