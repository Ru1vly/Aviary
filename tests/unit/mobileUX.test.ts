import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { MobileUXChecker } from '../../src/checkers/mobileUX';
import { createMockPage, MockPageOptions, MockElementGeometry } from '../mocks/mockPage';
import { SEOConfig } from '../../src/config';

function checkerFor(opts: MockPageOptions, config?: SEOConfig): MobileUXChecker {
  const page = createMockPage(opts);
  return new MobileUXChecker({ page: page as Page, checkerKey: 'mobileUX', config });
}

function byName(results: Awaited<ReturnType<MobileUXChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

function perfPrepare(loadTimeMs: number) {
  return (_doc: Document, win: Window) => {
    (win as unknown as { performance: { timing: unknown } }).performance.timing = {
      navigationStart: 0,
      loadEventEnd: loadTimeMs,
    };
  };
}

describe('MobileUXChecker', () => {
  it('flags undersized tap targets (via a lowered threshold) and passes normal-sized ones', async () => {
    const geometry: MockElementGeometry[] = [{ selector: 'a', rect: { width: 20, height: 20 } }];
    const bad = await checkerFor(
      { html: '<a href="/1">x</a>', geometry, prepare: perfPrepare(1000) },
      { rules: { mobileUX: { 'tap-target-size-adequate': { options: { maxTooSmall: 0 } } } } }
    ).checkAll();
    expect(byName(bad, 'tap-target-size-adequate').passed).toBe(false);

    const good = await checkerFor({
      html: '<a href="/1">x</a>',
      geometry: [{ selector: 'a', rect: { width: 60, height: 50 } }],
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(good, 'tap-target-size-adequate').passed).toBe(true);
  });

  it('flags missing/incomplete viewport config and passes a proper one', async () => {
    const missing = await checkerFor({ prepare: perfPrepare(1000) }).checkAll();
    expect(byName(missing, 'mobile-viewport-config-valid').passed).toBe(false);
    expect(byName(missing, 'mobile-viewport-config-valid').message).toMatch(/missing viewport/i);

    const zoomDisabled = await checkerFor({
      headHtml: '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(zoomDisabled, 'mobile-viewport-config-valid').passed).toBe(false);
    expect(byName(zoomDisabled, 'mobile-viewport-config-valid').message).toMatch(/zoom disabled/i);

    const good = await checkerFor({
      headHtml: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(good, 'mobile-viewport-config-valid').passed).toBe(true);
  });

  it('flags tap targets placed too close together (via a lowered threshold)', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'a:nth-of-type(1)', rect: { top: 0, left: 0, width: 50, height: 20, bottom: 20, right: 50 } },
      { selector: 'a:nth-of-type(2)', rect: { top: 22, left: 0, width: 50, height: 20, bottom: 42, right: 50 } },
    ];
    const results = await checkerFor(
      { html: '<a href="/1">A</a><a href="/2">B</a>', geometry, prepare: perfPrepare(1000) },
      { rules: { mobileUX: { 'touch-friendly-spacing': { options: { maxClosePairs: 0 } } } } }
    ).checkAll();
    expect(byName(results, 'touch-friendly-spacing').passed).toBe(false);
  });

  it('flags forms with low autocomplete coverage, passes well-optimized forms, and "no inputs"', async () => {
    const none = await checkerFor({ prepare: perfPrepare(1000) }).checkAll();
    expect(byName(none, 'mobile-form-inputs-optimized').message).toMatch(/no form inputs/i);

    const bad = await checkerFor({
      html: '<input type="text"><input type="text"><input type="text">',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(bad, 'mobile-form-inputs-optimized').passed).toBe(false);

    const good = await checkerFor({
      html: '<input type="email" autocomplete="email" inputmode="email">',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(good, 'mobile-form-inputs-optimized').passed).toBe(true);
  });

  it('detects a hamburger menu and reports its absence otherwise', async () => {
    const results = await checkerFor({ html: '<div class="hamburger-menu"></div>', prepare: perfPrepare(1000) }).checkAll();
    expect(byName(results, 'mobile-navigation-present').message).toMatch(/mobile navigation menu detected/i);
  });

  it('flags a small base font size and excessive small-text elements', async () => {
    const smallBody = await checkerFor({
      html: '<p>x</p>',
      geometry: [{ selector: 'body', style: { fontSize: '12px' } }],
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(smallBody, 'mobile-readability-acceptable').passed).toBe(false);
    expect(byName(smallBody, 'mobile-readability-acceptable').message).toMatch(/base font size too small/i);

    const smallText = await checkerFor(
      {
        html: `<p class="tiny">${'word '.repeat(10)}</p>`,
        geometry: [
          { selector: 'body', style: { fontSize: '16px' } },
          { selector: '.tiny', style: { fontSize: '10px' } },
        ],
        prepare: perfPrepare(1000),
      },
      { rules: { mobileUX: { 'mobile-readability-acceptable': { options: { maxSmallTextElements: 0 } } } } }
    ).checkAll();
    expect(byName(smallText, 'mobile-readability-acceptable').passed).toBe(false);
    expect(byName(smallText, 'mobile-readability-acceptable').message).toMatch(/small text/i);
  });

  it('flags non-responsive images above the minimum count and passes responsive ones', async () => {
    const bad = await checkerFor(
      { html: Array.from({ length: 3 }, (_, i) => `<img src="${i}.jpg">`).join(''), prepare: perfPrepare(1000) },
      { rules: { mobileUX: { 'mobile-image-optimization': { options: { minImageCount: 0 } } } } }
    ).checkAll();
    expect(byName(bad, 'mobile-image-optimization').passed).toBe(false);

    const good = await checkerFor({ html: '<img src="a.jpg" srcset="a.jpg 1x, a@2x.jpg 2x">', prepare: perfPrepare(1000) }).checkAll();
    expect(byName(good, 'mobile-image-optimization').passed).toBe(true);
  });

  it('flags visible popups and passes when none are visible', async () => {
    const bad = await checkerFor({
      html: '<div class="modal-overlay">Sign up now!</div>',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(bad, 'mobile-popups-absent').passed).toBe(false);

    const hidden = await checkerFor({
      html: '<div class="modal-overlay">Sign up now!</div>',
      geometry: [{ selector: '.modal-overlay', style: { display: 'none' } }],
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(hidden, 'mobile-popups-absent').passed).toBe(true);
  });

  it('detects orientation-specific CSS', async () => {
    const results = await checkerFor({
      html: '<style>@media (orientation: landscape) { .x { display: none; } }</style>',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(results, 'orientation-support').message).toMatch(/orientation-specific css detected/i);
  });

  it('flags missing touch icons/manifest and passes when both present', async () => {
    const bad = await checkerFor({ prepare: perfPrepare(1000) }).checkAll();
    expect(byName(bad, 'touch-icons-present').passed).toBe(false);

    const good = await checkerFor({
      headHtml: '<link rel="apple-touch-icon" href="/icon.png"><link rel="manifest" href="/manifest.json">',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(good, 'touch-icons-present').message).toMatch(/touch icons and manifest present/i);
  });

  it('detects an AMP page and an AMP alternate version', async () => {
    const ampPage = await checkerFor({ htmlAttrs: { amp: '' }, prepare: perfPrepare(1000) }).checkAll();
    expect(byName(ampPage, 'amp-implementation').message).toMatch(/this is an amp page/i);

    const ampAlt = await checkerFor({
      headHtml: '<link rel="amphtml" href="/amp">',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(ampAlt, 'amp-implementation').message).toMatch(/amp version available/i);
  });

  it('detects PWA features (manifest + theme-color)', async () => {
    const results = await checkerFor({
      headHtml: '<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#000">',
      prepare: perfPrepare(1000),
    }).checkAll();
    expect(byName(results, 'pwa-features-present').message).toMatch(/manifest/);
    expect(byName(results, 'pwa-features-present').message).toMatch(/theme color/);
  });

  it('flags horizontal scrolling', async () => {
    const results = await checkerFor({
      html: '<p>x</p>',
      prepare: (doc, win) => {
        Object.defineProperty(doc.documentElement, 'scrollWidth', { value: 3000, configurable: true });
        Object.defineProperty(win, 'innerWidth', { value: 375, configurable: true });
        (win as unknown as { performance: { timing: unknown } }).performance.timing = {
          navigationStart: 0,
          loadEventEnd: 1000,
        };
      },
    }).checkAll();
    expect(byName(results, 'mobile-scrolling-clean').passed).toBe(false);
  });

  it('flags slow mobile load time and passes a fast one', async () => {
    const slow = await checkerFor({ html: '<p>x</p>', prepare: perfPrepare(10000) }).checkAll();
    expect(byName(slow, 'mobile-performance-acceptable').passed).toBe(false);

    const fast = await checkerFor({ html: '<p>x</p>', prepare: perfPrepare(500) }).checkAll();
    expect(byName(fast, 'mobile-performance-acceptable').passed).toBe(true);
  });

  it('reports touch support based on ontouchstart presence', async () => {
    const results = await checkerFor({
      html: '<p>x</p>',
      prepare: (_doc, win) => {
        Object.defineProperty(win, 'ontouchstart', { value: null, configurable: true });
        (win as unknown as { performance: { timing: unknown } }).performance.timing = {
          navigationStart: 0,
          loadEventEnd: 1000,
        };
      },
    }).checkAll();
    expect(byName(results, 'gesture-support-detected').message).toMatch(/touch\/pointer events supported/i);
  });
});
