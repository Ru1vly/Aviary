import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { PageQualityChecker } from '../../src/checkers/pageQuality';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): PageQualityChecker {
  const page = createMockPage(opts);
  return new PageQualityChecker({ page: page as Page, checkerKey: 'pageQuality' });
}

function byName(results: Awaited<ReturnType<PageQualityChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('PageQualityChecker', () => {
  it('reports mismatched title/description tags and duplicate H1s', async () => {
    const results = await checkerFor({
      title: 'Page Title',
      headHtml: '<meta property="og:title" content="Different Title"><meta property="og:description" content="d1"><meta name="description" content="d2">',
      html: '<h1>Same</h1><h1>Same</h1>',
    }).checkAll();
    expect(byName(results, 'title-tags-consistent').message).toMatch(/vary/i);
    expect(byName(results, 'description-tags-consistent').message).toMatch(/vary/i);
    expect(byName(results, 'h1-not-duplicated').passed).toBe(false);
    expect(byName(results, 'h1-not-duplicated').message).toMatch(/duplicate h1/i);
  });

  it('flags multiple distinct H1s and passes a single H1', async () => {
    const multi = await checkerFor({ html: '<h1>One</h1><h1>Two</h1>' }).checkAll();
    expect(byName(multi, 'h1-not-duplicated').message).toMatch(/multiple h1/i);

    const single = await checkerFor({ html: '<h1>One</h1>' }).checkAll();
    expect(byName(single, 'h1-not-duplicated').passed).toBe(true);
  });

  it('flags no date indicators / no media / no viewport / noindex', async () => {
    const results = await checkerFor({ html: '<p>plain</p>' }).checkAll();
    expect(byName(results, 'content-freshness-indicated').passed).toBe(false);
    expect(byName(results, 'media-elements-present').passed).toBe(false);
    expect(byName(results, 'mobile-optimization-present').passed).toBe(false);
  });

  it('passes date/media/mobile checks when present', async () => {
    const results = await checkerFor({
      headHtml:
        '<meta property="article:published_time" content="2026-01-01">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<link rel="icon" href="/favicon.ico">',
      html: '<img src="a.jpg">',
    }).checkAll();
    expect(byName(results, 'content-freshness-indicated').passed).toBe(true);
    expect(byName(results, 'media-elements-present').passed).toBe(true);
    expect(byName(results, 'mobile-optimization-present').passed).toBe(true);
    expect(byName(results, 'publish-date-present').message).toMatch(/publication date found/i);
  });

  it('detects author info from meta, rel=author, or JSON-LD', async () => {
    const meta = await checkerFor({ headHtml: '<meta name="author" content="Jane">' }).checkAll();
    expect(byName(meta, 'author-info-present').passed).toBe(true);

    const none = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(byName(none, 'author-info-present').message).toMatch(/no author/i);
  });

  it('detects contact info, social proof, and CTAs', async () => {
    const results = await checkerFor({
      html:
        '<p>Email us at hi@example.com or call 555-123-4567</p>' +
        '<div class="testimonial">Great!</div>' +
        '<a href="https://facebook.com/x">FB</a>' +
        '<button>Sign Up</button>',
    }).checkAll();
    expect(byName(results, 'contact-info-present').message).toMatch(/\d+ methods/);
    expect(byName(results, 'social-proof-present').passed).toBe(true);
    expect(byName(results, 'call-to-action-present').passed).toBe(true);
  });

  it('detects a table of contents and print stylesheet', async () => {
    const toc = await checkerFor({ html: '<nav><ol><li>1</li></ol></nav>' }).checkAll();
    expect(byName(toc, 'table-of-contents-present').message).toMatch(/found/i);

    const print = await checkerFor({ headHtml: '<link rel="stylesheet" href="/print.css" media="print">' }).checkAll();
    expect(byName(print, 'print-stylesheet-present').message).toMatch(/present/i);
  });

  it('flags mismatched canonical/og:url, and noindex/nofollow directives', async () => {
    const mismatch = await checkerFor({
      headHtml:
        '<link rel="canonical" href="https://example.com/a">' +
        '<meta property="og:url" content="https://example.com/b">',
    }).checkAll();
    expect(byName(mismatch, 'canonical-og-url-consistent').passed).toBe(false);

    const noindex = await checkerFor({ headHtml: '<meta name="robots" content="noindex">' }).checkAll();
    expect(byName(noindex, 'no-noindex-directive').passed).toBe(false);
    expect(byName(noindex, 'no-noindex-directive').message).toMatch(/noindex/i);

    const nofollow = await checkerFor({ headHtml: '<meta name="robots" content="nofollow">' }).checkAll();
    expect(byName(nofollow, 'no-noindex-directive').message).toMatch(/nofollow/i);

    const clean = await checkerFor({ headHtml: '<meta name="robots" content="index, follow">' }).checkAll();
    expect(byName(clean, 'no-noindex-directive').passed).toBe(true);
  });
});
