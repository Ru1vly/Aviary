import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { UIElementsChecker } from '../../src/checkers/uiElements';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): UIElementsChecker {
  const page = createMockPage(opts);
  return new UIElementsChecker({ page: page as Page, checkerKey: 'uiElements' });
}

function byName(results: Awaited<ReturnType<UIElementsChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('UIElementsChecker (mock-DOM, exercises page.evaluate bodies)', () => {
  it('fails favicon-present when no icon link exists, passes with one', async () => {
    const none = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(byName(none, 'favicon-present').passed).toBe(false);

    const good = await checkerFor({ headHtml: '<link rel="icon" href="/favicon.ico">' }).checkAll();
    expect(byName(good, 'favicon-present').passed).toBe(true);
  });

  it('flags breadcrumb HTML without structured data, and no breadcrumbs at all', async () => {
    const none = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(byName(none, 'breadcrumbs-structured').message).toContain('No breadcrumbs found');

    const htmlOnly = await checkerFor({ html: '<nav class="breadcrumb"><a href="/">Home</a></nav>' }).checkAll();
    expect(byName(htmlOnly, 'breadcrumbs-structured').message).toContain('missing structured data');
  });

  it('passes breadcrumbs-structured with JSON-LD or microdata', async () => {
    const jsonLd = await checkerFor({
      headHtml: '<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>',
    }).checkAll();
    expect(byName(jsonLd, 'breadcrumbs-structured').passed).toBe(true);

    const microdata = await checkerFor({ html: '<div itemtype="https://schema.org/BreadcrumbList"></div>' }).checkAll();
    expect(byName(microdata, 'breadcrumbs-structured').passed).toBe(true);
  });

  it('flags a missing lang attribute and hreflang without x-default', async () => {
    const noLang = await checkerFor({}).checkAll();
    expect(byName(noLang, 'language-tags-configured').passed).toBe(false);
    expect(byName(noLang, 'language-tags-configured').message).toContain('Missing lang');

    const noDefault = await checkerFor({
      htmlAttrs: { lang: 'en' },
      headHtml: '<link rel="alternate" hreflang="fr" href="https://example.com/fr">',
    }).checkAll();
    expect(byName(noDefault, 'language-tags-configured').passed).toBe(false);
    expect(byName(noDefault, 'language-tags-configured').message).toContain('x-default');
  });

  it('passes language-tags-configured for a single-language site and a proper hreflang set', async () => {
    const single = await checkerFor({ htmlAttrs: { lang: 'en' } }).checkAll();
    expect(byName(single, 'language-tags-configured').passed).toBe(true);

    const withDefault = await checkerFor({
      htmlAttrs: { lang: 'en' },
      headHtml: '<link rel="alternate" hreflang="x-default" href="https://example.com">',
    }).checkAll();
    const result = byName(withDefault, 'language-tags-configured');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('hreflang tag');
  });

  it('flags a missing viewport, missing device-width, and disabled zoom', async () => {
    const none = await checkerFor({}).checkAll();
    expect(byName(none, 'mobile-viewport-configured').passed).toBe(false);
    expect(byName(none, 'mobile-viewport-configured').message).toContain('Missing viewport');

    const partial = await checkerFor({ headHtml: '<meta name="viewport" content="initial-scale=1">' }).checkAll();
    expect(byName(partial, 'mobile-viewport-configured').passed).toBe(false);
    expect(byName(partial, 'mobile-viewport-configured').message).toContain('width=device-width');

    const noZoom = await checkerFor({
      headHtml: '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">',
    }).checkAll();
    expect(byName(noZoom, 'mobile-viewport-configured').passed).toBe(false);
    expect(byName(noZoom, 'mobile-viewport-configured').message).toContain('user-scalable=no');
  });

  it('passes mobile-viewport-configured for a proper viewport tag', async () => {
    const results = await checkerFor({
      headHtml: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    }).checkAll();
    expect(byName(results, 'mobile-viewport-configured').passed).toBe(true);
  });
});
