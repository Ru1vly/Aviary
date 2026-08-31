import { describe, it, expect } from 'vitest';
import { Page, Response } from 'playwright';
import { CoreWebVitalsChecker } from '../../src/checkers/coreWebVitals';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function navigationPrepare(overrides: Partial<{ loadEventEnd: number; domContentLoadedEventEnd: number; startTime: number }> = {}) {
  const nav = { loadEventEnd: 1000, domContentLoadedEventEnd: 800, startTime: 0, ...overrides };
  return (_doc: Document, win: Window) => {
    (win as unknown as { performance: { getEntriesByType: (t: string) => unknown[] } }).performance.getEntriesByType = (
      type: string
    ) => (type === 'navigation' ? [nav] : []);
  };
}

interface FakeResourceEntry {
  name: string;
  initiatorType: string;
  transferSize: number;
}

function resourcesPrepare(entries: FakeResourceEntry[]) {
  return (_doc: Document, win: Window) => {
    (win as unknown as { performance: { getEntriesByType: (t: string) => unknown[] } }).performance.getEntriesByType = (
      type: string
    ) => (type === 'resource' ? entries : []);
  };
}

function cwvMetricsPrepare(metrics: Record<string, unknown>) {
  return (_doc: Document, win: Window) => {
    (win as unknown as { __aviaryCWV: unknown }).__aviaryCWV = metrics;
  };
}

function ttfbPrepare(responseStart: number, navigationStart = 0) {
  return (_doc: Document, win: Window) => {
    (win as unknown as { performance: { timing: unknown } }).performance.timing = { responseStart, navigationStart };
  };
}

function checkerFor(
  opts: MockPageOptions,
  response: Partial<Response> | null = null
): CoreWebVitalsChecker {
  const page = createMockPage(opts);
  return new CoreWebVitalsChecker({ page: page as Page, response: response as Response, checkerKey: 'coreWebVitals' });
}

function byName(results: Awaited<ReturnType<CoreWebVitalsChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('CoreWebVitalsChecker — resource-heuristic checks (mock-DOM)', () => {
  it('skips navigation-timing checks gracefully when no navigation entry exists', async () => {
    const results = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(byName(results, 'page-load-time-acceptable').message).toContain('skipped');
    expect(byName(results, 'dom-content-loaded-acceptable').message).toContain('skipped');
  });

  it('flags a slow page load and DOM load time, passes a fast one', async () => {
    const slow = await checkerFor({ prepare: navigationPrepare({ loadEventEnd: 10000, domContentLoadedEventEnd: 9000 }) }).checkAll();
    expect(byName(slow, 'page-load-time-acceptable').passed).toBe(false);
    expect(byName(slow, 'dom-content-loaded-acceptable').passed).toBe(false);

    const fast = await checkerFor({ prepare: navigationPrepare({ loadEventEnd: 500, domContentLoadedEventEnd: 300 }) }).checkAll();
    expect(byName(fast, 'page-load-time-acceptable').message).toContain('excellent');
  });

  it('marks page load time as acceptable-but-not-excellent in the warn band', async () => {
    const results = await checkerFor({ prepare: navigationPrepare({ loadEventEnd: 2500 }) }).checkAll();
    expect(byName(results, 'page-load-time-acceptable').message).toContain('acceptable');
  });

  it('flags too many HTTP requests via resource timing entries, passes few', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ name: `/r${i}.js`, initiatorType: 'script', transferSize: 100 }));
    const results = await checkerFor(
      { prepare: resourcesPrepare(many) },
      null
    ).checkAll();
    const checker = new CoreWebVitalsChecker({
      page: createMockPage({ prepare: resourcesPrepare(many) }) as Page,
      checkerKey: 'coreWebVitals',
      config: { rules: { coreWebVitals: { 'resource-count-acceptable': { options: { maxRequests: 5, warnRequests: 2 } } } } },
    });
    const overridden = await checker.checkAll();
    expect(byName(overridden, 'resource-count-acceptable').passed).toBe(false);
    expect(byName(results, 'resource-count-acceptable').passed).toBe(true);
  });

  it('flags large JS/CSS/image/page sizes, passes small ones', async () => {
    const bigJs = [{ name: '/app.js', initiatorType: 'script', transferSize: 10_000_000 }];
    const results = await checkerFor({ prepare: resourcesPrepare(bigJs) }).checkAll();
    expect(byName(results, 'javascript-size-acceptable').passed).toBe(false);
    expect(byName(results, 'page-size-acceptable').passed).toBe(false);

    const small = await checkerFor({ prepare: resourcesPrepare([]) }).checkAll();
    expect(byName(small, 'javascript-size-acceptable').passed).toBe(true);
    expect(byName(small, 'page-size-acceptable').message).toContain('optimized');
  });

  it('flags large CSS and image resources', async () => {
    const entries = [
      { name: '/style.css', initiatorType: 'link', transferSize: 500_000 },
      { name: '/hero.jpg', initiatorType: 'img', transferSize: 5_000_000 },
    ];
    const results = await checkerFor({ prepare: resourcesPrepare(entries) }).checkAll();
    expect(byName(results, 'css-size-acceptable').passed).toBe(false);
    expect(byName(results, 'image-size-acceptable').passed).toBe(false);
  });

  it('flags too many font files and unpreloaded fonts, passes preloaded ones', async () => {
    const fonts = Array.from({ length: 6 }, (_, i) => ({ name: `/f${i}.woff2`, initiatorType: 'css', transferSize: 1000 }));
    const results = await checkerFor({ prepare: resourcesPrepare(fonts) }).checkAll();
    expect(byName(results, 'font-loading-optimized').passed).toBe(false);
    expect(byName(results, 'font-loading-optimized').message).toContain('Too many');

    const oneFont = [{ name: '/f.woff2', initiatorType: 'css', transferSize: 1000 }];
    const noPreload = await checkerFor({ prepare: resourcesPrepare(oneFont) }).checkAll();
    expect(byName(noPreload, 'font-loading-optimized').passed).toBe(false);
    expect(byName(noPreload, 'font-loading-optimized').message).toContain('not preloaded');

    const withPreload = await checkerFor({
      headHtml: '<link rel="preload" as="font" href="/f.woff2">',
      prepare: resourcesPrepare(oneFont),
    }).checkAll();
    expect(byName(withPreload, 'font-loading-optimized').passed).toBe(true);

    const noFonts = await checkerFor({ prepare: resourcesPrepare([]) }).checkAll();
    expect(byName(noFonts, 'font-loading-optimized').message).toContain('No custom fonts');
  });

  it('flags render-blocking scripts/styles, passes async/deferred ones', async () => {
    const page = createMockPage({ headHtml: '<script src="/a.js"></script><link rel="stylesheet" href="/a.css">' });
    const checker = new CoreWebVitalsChecker({
      page: page as Page,
      checkerKey: 'coreWebVitals',
      config: {
        rules: {
          coreWebVitals: {
            'render-blocking-resources-minimal': { options: { maxBlockingScripts: 0, maxBlockingStyles: 0 } },
          },
        },
      },
    });
    const bad = await checker.checkAll();
    expect(byName(bad, 'render-blocking-resources-minimal').passed).toBe(false);

    const good = await checkerFor({
      headHtml: '<script src="/a.js" async></script><link rel="stylesheet" href="/a.css" media="print">',
    }).checkAll();
    expect(byName(good, 'render-blocking-resources-minimal').passed).toBe(true);
  });

  it('flags missing lazy-loading with many images, passes with lazy attributes', async () => {
    const many = Array.from({ length: 12 }, (_, i) => `<img src="${i}.jpg">`).join('');
    const bad = await checkerFor({ html: many }).checkAll();
    expect(byName(bad, 'lazy-load-implemented').passed).toBe(false);

    const good = await checkerFor({ html: '<img src="a.jpg" loading="lazy">' }).checkAll();
    expect(byName(good, 'lazy-load-implemented').message).toContain('implemented');
  });

  it('detects inlined critical CSS', async () => {
    const none = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(byName(none, 'critical-css-present').message).toContain('No obvious');

    const withCritical = await checkerFor({ html: `<style>${'.a{color:red}'.repeat(50)}</style>` }).checkAll();
    expect(byName(withCritical, 'critical-css-present').message).toContain('inlined');
  });

  it('flags blocking scripts and passes async/defer/json-ld scripts', async () => {
    const page = createMockPage({ headHtml: '<script src="/a.js"></script>' });
    const checker = new CoreWebVitalsChecker({
      page: page as Page,
      checkerKey: 'coreWebVitals',
      config: { rules: { coreWebVitals: { 'async-scripts-used': { options: { maxBlocking: 0 } } } } },
    });
    const bad = await checker.checkAll();
    expect(byName(bad, 'async-scripts-used').passed).toBe(false);

    const good = await checkerFor({
      headHtml: '<script src="/a.js" async></script><script type="application/ld+json" src="/x.js"></script>',
    }).checkAll();
    expect(byName(good, 'async-scripts-used').passed).toBe(true);
  });

  it('reports resource hints present or absent', async () => {
    const none = await checkerFor({}).checkAll();
    expect(byName(none, 'resource-hints-present').message).toContain('No resource hints');

    const withHints = await checkerFor({ headHtml: '<link rel="preconnect" href="https://cdn.example">' }).checkAll();
    expect(byName(withHints, 'resource-hints-present').message).toContain('1 hints');
  });

  it('fails cache-headers-present with no response, flags missing headers, passes with them', async () => {
    const noResponse = await checkerFor({}).checkAll();
    expect(byName(noResponse, 'cache-headers-present').passed).toBe(false);

    const noCaching = await checkerFor({}, { headers: () => ({}) }).checkAll();
    expect(byName(noCaching, 'cache-headers-present').passed).toBe(false);

    const withCaching = await checkerFor({}, { headers: () => ({ 'cache-control': 'max-age=3600' }) }).checkAll();
    expect(byName(withCaching, 'cache-headers-present').passed).toBe(true);
  });

  it('flags a slow server response time, passes a fast one, and marks the warn band', async () => {
    const slow = await checkerFor({ prepare: ttfbPrepare(3000) }).checkAll();
    expect(byName(slow, 'server-response-time-acceptable').passed).toBe(false);

    const warn = await checkerFor({ prepare: ttfbPrepare(300) }).checkAll();
    expect(byName(warn, 'server-response-time-acceptable').message).toContain('acceptable');

    const fast = await checkerFor({ prepare: ttfbPrepare(50) }).checkAll();
    expect(byName(fast, 'server-response-time-acceptable').message).toContain('excellent');
  });
});

describe('CoreWebVitalsChecker — real field metrics from window.__aviaryCWV (mock-DOM)', () => {
  it('skips LCP/CLS/FCP/TTFB/TBT when no metrics were collected', async () => {
    const results = await checkerFor({}).checkAll();
    expect(byName(results, 'lcp-good').message).toContain('skipped');
    expect(byName(results, 'cls-good').message).toContain('skipped');
    expect(byName(results, 'fcp-good').message).toContain('skipped');
    expect(byName(results, 'ttfb-good').message).toContain('skipped');
    expect(byName(results, 'total-blocking-time-acceptable').message).toContain('skipped');
  });

  it('flags a slow LCP/CLS/FCP/TTFB/TBT, passes good values', async () => {
    const bad = await checkerFor({
      prepare: cwvMetricsPrepare({ lcp: 5000, cls: 0.5, fcp: 4000, ttfb: 1000, totalBlockingTime: 500 }),
    }).checkAll();
    expect(byName(bad, 'lcp-good').passed).toBe(false);
    expect(byName(bad, 'cls-good').passed).toBe(false);
    expect(byName(bad, 'fcp-good').passed).toBe(false);
    expect(byName(bad, 'ttfb-good').passed).toBe(false);
    expect(byName(bad, 'total-blocking-time-acceptable').passed).toBe(false);
    expect(byName(bad, 'total-blocking-time-acceptable').message).toContain('INP');

    const good = await checkerFor({
      prepare: cwvMetricsPrepare({ lcp: 1500, cls: 0.02, fcp: 1000, ttfb: 100, totalBlockingTime: 0 }),
    }).checkAll();
    expect(byName(good, 'lcp-good').passed).toBe(true);
    expect(byName(good, 'cls-good').passed).toBe(true);
    expect(byName(good, 'fcp-good').passed).toBe(true);
    expect(byName(good, 'ttfb-good').passed).toBe(true);
    expect(byName(good, 'total-blocking-time-acceptable').passed).toBe(true);
  });

  it('honors a rule-option override for lcp-good', async () => {
    const page = createMockPage({ prepare: cwvMetricsPrepare({ lcp: 2000, totalBlockingTime: 0 }) });
    const checker = new CoreWebVitalsChecker({
      page: page as Page,
      checkerKey: 'coreWebVitals',
      config: { rules: { coreWebVitals: { 'lcp-good': { options: { goodMs: 1000 } } } } },
    });
    const results = await checker.checkAll();
    expect(byName(results, 'lcp-good').passed).toBe(false);
  });
});
