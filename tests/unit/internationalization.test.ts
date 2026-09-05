import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { InternationalizationChecker } from '../../src/checkers/internationalization';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): InternationalizationChecker {
  const page = createMockPage(opts);
  return new InternationalizationChecker({ page: page as Page, checkerKey: 'internationalization' });
}

function byName(results: Awaited<ReturnType<InternationalizationChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('InternationalizationChecker', () => {
  it('passes every "not needed" branch for a plain single-language English page', async () => {
    const results = await checkerFor({ htmlAttrs: { lang: 'en' }, headHtml: '<meta charset="UTF-8">', html: '<p>Hello world</p>' }).checkAll();
    expect(results).toHaveLength(15);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('fails when <html> has no lang attribute, and when lang is malformed', async () => {
    expect(byName(await checkerFor({}).checkAll(), 'language-declaration-valid').passed).toBe(false);
    expect(
      byName(await checkerFor({ htmlAttrs: { lang: 'english' } }).checkAll(), 'language-declaration-valid').passed
    ).toBe(false);
    expect(
      byName(await checkerFor({ htmlAttrs: { lang: 'en-US' } }).checkAll(), 'language-declaration-valid').passed
    ).toBe(true);
  });

  it('flags hreflang tags missing x-default/self-reference, passes when both present', async () => {
    const bad = await checkerFor({
      url: 'https://example.com/',
      headHtml: '<link rel="alternate" hreflang="fr" href="https://example.com/fr">',
    }).checkAll();
    expect(byName(bad, 'hreflang-tags-valid').passed).toBe(false);

    const good = await checkerFor({
      url: 'https://example.com/',
      headHtml:
        '<link rel="alternate" hreflang="x-default" href="https://example.com/">' +
        '<link rel="alternate" hreflang="en" href="https://example.com/">',
    }).checkAll();
    expect(byName(good, 'hreflang-tags-valid').passed).toBe(true);
  });

  it('flags a language/content mismatch (CJK text under an English lang tag)', async () => {
    const results = await checkerFor({ htmlAttrs: { lang: 'en' }, html: '<p>你好世界，这是中文内容测试</p>' }).checkAll();
    expect(byName(results, 'content-language-consistent').passed).toBe(false);
  });

  it('detects Arabic content and requires dir="rtl"', async () => {
    const noDir = await checkerFor({ htmlAttrs: { lang: 'ar' }, html: '<p>مرحبا بالعالم</p>' }).checkAll();
    expect(byName(noDir, 'rtl-support-configured').passed).toBe(false);

    const withDir = await checkerFor({ htmlAttrs: { lang: 'ar', dir: 'rtl' }, html: '<p>مرحبا بالعالم</p>' }).checkAll();
    expect(byName(withDir, 'rtl-support-configured').passed).toBe(true);
  });

  it('flags missing/non-UTF8 charset, passes UTF-8', async () => {
    expect(byName(await checkerFor({}).checkAll(), 'charset-utf8').passed).toBe(false);
    expect(
      byName(await checkerFor({ headHtml: '<meta charset="ISO-8859-1">' }).checkAll(), 'charset-utf8').passed
    ).toBe(false);
    expect(byName(await checkerFor({ headHtml: '<meta charset="UTF-8">' }).checkAll(), 'charset-utf8').passed).toBe(
      true
    );
  });

  // Regression test: charset-utf8 and unicode-support-utf8 used to disagree
  // on the older http-equiv charset declaration -- charset-utf8 handled it
  // correctly, but unicode-support-utf8 only checked `meta[charset]` and
  // false-failed real pages (confirmed on books.toscrape.com) that only
  // declare charset this way. Both now share shared/dom.ts's getCharset().
  it('agrees with charset-utf8 on the older http-equiv charset declaration', async () => {
    const results = await checkerFor({
      headHtml: '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
      html: '<p>café</p>', // non-ASCII, to exercise unicode-support-utf8's charset branch
    }).checkAll();

    expect(byName(results, 'charset-utf8').passed).toBe(true);
    expect(byName(results, 'unicode-support-utf8').passed).toBe(true);
  });

  it('requires a language switcher when multiple hreflang languages are declared', async () => {
    const noSwitcher = await checkerFor({
      headHtml:
        '<link rel="alternate" hreflang="en" href="https://example.com/en">' +
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr">',
    }).checkAll();
    expect(byName(noSwitcher, 'language-switcher-present').passed).toBe(false);

    const withSwitcher = await checkerFor({
      headHtml:
        '<link rel="alternate" hreflang="en" href="https://example.com/en">' +
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr">',
      html: '<select class="lang-select"><option value="en">EN</option></select>',
    }).checkAll();
    expect(byName(withSwitcher, 'language-switcher-present').passed).toBe(true);
  });

  it('requires localized URLs when multiple languages are declared', async () => {
    const results = await checkerFor({
      url: 'https://example.com/page',
      headHtml:
        '<link rel="alternate" hreflang="en" href="https://example.com/page">' +
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr/page">',
    }).checkAll();
    expect(byName(results, 'localized-urls').passed).toBe(false);

    const localized = await checkerFor({
      url: 'https://example.com/en/page',
      headHtml:
        '<link rel="alternate" hreflang="en" href="https://example.com/en/page">' +
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr/page">',
    }).checkAll();
    expect(byName(localized, 'localized-urls').passed).toBe(true);
  });

  it('flags multiple currencies without a currency switcher', async () => {
    const results = await checkerFor({ html: '<p>Price: $10 or €9</p>' }).checkAll();
    expect(byName(results, 'currency-display-appropriate').passed).toBe(false);

    const withSwitcher = await checkerFor({
      html: '<p>Price: $10 or €9</p><select class="currency-select"></select>',
    }).checkAll();
    expect(byName(withSwitcher, 'currency-display-appropriate').passed).toBe(true);
  });

  it('flags <time> elements missing a datetime attribute', async () => {
    const results = await checkerFor({ html: '<time>Jan 1</time>' }).checkAll();
    expect(byName(results, 'datetime-format-valid').passed).toBe(false);

    const good = await checkerFor({ html: '<time datetime="2026-01-01">Jan 1</time>' }).checkAll();
    expect(byName(good, 'datetime-format-valid').passed).toBe(true);
  });

  it('flags Lorem Ipsum placeholder text as a translation-quality issue', async () => {
    const results = await checkerFor({ html: '<p>Lorem ipsum dolor sit amet</p>' }).checkAll();
    expect(byName(results, 'translation-quality-acceptable').passed).toBe(false);
  });

  it('detects multilingual content via multiple [lang] elements', async () => {
    const results = await checkerFor({
      html: '<p lang="en">Hi</p><p lang="fr">Salut</p>',
    }).checkAll();
    expect(byName(results, 'multilingual-content-detected').message).toMatch(/multilingual site with 2/i);
  });

  it('detects geo-targeting meta tags and keyword content', async () => {
    const meta = await checkerFor({ headHtml: '<meta name="geo.region" content="US">' }).checkAll();
    expect(byName(meta, 'geo-targeting-present').message).toMatch(/meta tags present/i);

    const keyword = await checkerFor({ html: '<p>Available in your region</p>' }).checkAll();
    expect(byName(keyword, 'geo-targeting-present').message).toMatch(/location-based content/i);
  });

  it('requires og:locale on multilingual pages', async () => {
    const missing = await checkerFor({
      headHtml:
        '<link rel="alternate" hreflang="en" href="https://example.com/en">' +
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr">',
    }).checkAll();
    expect(byName(missing, 'localized-metadata-present').passed).toBe(false);

    const present = await checkerFor({
      headHtml:
        '<link rel="alternate" hreflang="en" href="https://example.com/en">' +
        '<link rel="alternate" hreflang="fr" href="https://example.com/fr">' +
        '<meta property="og:locale" content="en_US">',
    }).checkAll();
    expect(byName(present, 'localized-metadata-present').passed).toBe(true);
  });

  it('flags non-ASCII content under a non-UTF8 charset, passes emoji under UTF-8', async () => {
    const bad = await checkerFor({
      headHtml: '<meta charset="ISO-8859-1">',
      html: '<p>Café</p>',
    }).checkAll();
    expect(byName(bad, 'unicode-support-utf8').passed).toBe(false);

    const good = await checkerFor({
      headHtml: '<meta charset="UTF-8">',
      html: '<p>Great! 🎉</p>',
    }).checkAll();
    expect(byName(good, 'unicode-support-utf8').message).toMatch(/emoji/i);
  });
});
