import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { SpamDetectionChecker } from '../../src/checkers/spamDetection';
import { createMockPage, MockPageOptions, MockElementGeometry } from '../mocks/mockPage';
import { SEOConfig } from '../../src/config';

function checkerFor(opts: MockPageOptions, config?: SEOConfig): SpamDetectionChecker {
  const page = createMockPage(opts);
  return new SpamDetectionChecker({ page: page as Page, checkerKey: 'spamDetection', config });
}

function byName(results: Awaited<ReturnType<SpamDetectionChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('SpamDetectionChecker', () => {
  it('flags hidden text with real content, passes visible text', async () => {
    const geometry: MockElementGeometry[] = [{ selector: '.secret', style: { display: 'none' } }];
    const bad = await checkerFor({
      html: `<div class="secret">${'hidden spam text '.repeat(3)}</div>`,
      geometry,
    }).checkAll();
    expect(byName(bad, 'hidden-text-absent').passed).toBe(false);

    const good = await checkerFor({ html: '<p>visible content here</p>' }).checkAll();
    expect(byName(good, 'hidden-text-absent').passed).toBe(true);
  });

  it('does not flag legitimately-hidden UI content (aria-hidden, accordion/tab classes)', async () => {
    const geometry: MockElementGeometry[] = [{ selector: '.legit', style: { display: 'none' } }];
    const results = await checkerFor({
      html: `<div class="legit accordion">${'legit hidden panel text '.repeat(3)}</div>`,
      geometry,
    }).checkAll();
    expect(byName(results, 'hidden-text-absent').passed).toBe(true);
  });

  it('flags keyword stuffing (via lowered thresholds) and passes normal content', async () => {
    const bad = await checkerFor(
      { html: `<p>${Array.from({ length: 20 }, () => 'widget').join(' ')} is great</p>` },
      { rules: { spamDetection: { 'keyword-stuffing-absent': { options: { minCount: 5, minDensity: 0.01 } } } } }
    ).checkAll();
    expect(byName(bad, 'keyword-stuffing-absent').passed).toBe(false);

    const good = await checkerFor({ html: '<p>a short normal sentence about widgets and gadgets</p>' }).checkAll();
    expect(byName(good, 'keyword-stuffing-absent').passed).toBe(true);
  });

  it('flags excessive links (via a lowered threshold) and passes a normal link count', async () => {
    const bad = await checkerFor(
      { html: '<p>some words here for content</p><a href="/1">x</a><a href="/2">y</a>' },
      { rules: { spamDetection: { 'excessive-links-absent': { options: { maxLinks: 1 } } } } }
    ).checkAll();
    expect(byName(bad, 'excessive-links-absent').passed).toBe(false);

    const good = await checkerFor({ html: '<p>plenty of words in this paragraph for a healthy ratio</p><a href="/1">x</a>' }).checkAll();
    expect(byName(good, 'excessive-links-absent').passed).toBe(true);
  });

  it('flags a suspicious inline script and passes clean scripts', async () => {
    const bad = await checkerFor({ html: '<script>eval("x")</script>' }).checkAll();
    expect(byName(bad, 'suspicious-scripts-absent').passed).toBe(false);

    const good = await checkerFor({ html: '<script>console.log("hi")</script>' }).checkAll();
    expect(byName(good, 'suspicious-scripts-absent').passed).toBe(true);
  });

  it('flags a hidden/tiny iframe, and too many iframes (via a lowered threshold)', async () => {
    const geometry: MockElementGeometry[] = [{ selector: 'iframe', style: { display: 'none' } }];
    const hidden = await checkerFor({ html: '<iframe src="https://x.com"></iframe>', geometry }).checkAll();
    expect(byName(hidden, 'iframes-acceptable').passed).toBe(false);
    expect(byName(hidden, 'iframes-acceptable').message).toMatch(/hidden iframes/i);

    const many = await checkerFor(
      { html: '<iframe src="/a"></iframe><iframe src="/b"></iframe>' },
      { rules: { spamDetection: { 'iframes-acceptable': { options: { maxIframes: 1 } } } } }
    ).checkAll();
    expect(byName(many, 'iframes-acceptable').passed).toBe(false);
    expect(byName(many, 'iframes-acceptable').message).toMatch(/many iframes/i);

    const none = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(byName(none, 'iframes-acceptable').message).toMatch(/no iframes found/i);
  });

  it('flags invisible elements with real content (default zero-geometry in happy-dom)', async () => {
    const results = await checkerFor({
      html: Array.from({ length: 4 }, () => `<div>${'x'.repeat(60)}</div>`).join(''),
    }).checkAll();
    expect(byName(results, 'invisible-elements-absent').passed).toBe(false);

    const visible = await checkerFor({
      html: '<div>short</div>',
      geometry: [{ selector: 'div', rect: { width: 200, height: 50 } }],
    }).checkAll();
    expect(byName(visible, 'invisible-elements-absent').passed).toBe(true);
  });

  it('flags a very high link-text-to-content ratio', async () => {
    const results = await checkerFor({
      html: '<a href="/1">' + 'link text '.repeat(30) + '</a><p>short</p>',
    }).checkAll();
    expect(byName(results, 'text-to-link-ratio-healthy').passed).toBe(false);
  });

  it('flags duplicate paragraphs beyond the threshold', async () => {
    const dup = '<p>' + 'This exact paragraph repeats itself many times over. '.repeat(2) + '</p>';
    const results = await checkerFor({ html: dup + dup + dup + dup }).checkAll();
    expect(byName(results, 'repetitive-content-absent').passed).toBe(false);
  });

  it('flags meta-refresh and JS redirects', async () => {
    const meta = await checkerFor({ headHtml: '<meta http-equiv="refresh" content="0;url=https://x.com">' }).checkAll();
    expect(byName(meta, 'suspicious-redirects-absent').passed).toBe(false);
    expect(byName(meta, 'meta-refresh-safe').passed).toBe(false);

    const js = await checkerFor({ html: '<script>window.location.href = "https://x.com";</script>' }).checkAll();
    expect(byName(js, 'suspicious-redirects-absent').passed).toBe(false);

    const safeMeta = await checkerFor({ headHtml: '<meta http-equiv="refresh" content="10;url=https://x.com">' }).checkAll();
    expect(byName(safeMeta, 'meta-refresh-safe').passed).toBe(true);
  });

  it('flags a googlebot user-agent check as potential cloaking', async () => {
    const results = await checkerFor({
      html: '<script>if (navigator.userAgent.includes("Googlebot")) { }</script>',
    }).checkAll();
    expect(byName(results, 'cloaking-absent').passed).toBe(false);
  });

  it('flags adult-content and spam keywords beyond configured thresholds', async () => {
    const adult = await checkerFor(
      { html: '<p>casino casino viagra</p>' },
      { rules: { spamDetection: { 'adult-content-absent': { options: { maxMatches: 1 } } } } }
    ).checkAll();
    expect(byName(adult, 'adult-content-absent').passed).toBe(false);

    const spam = await checkerFor({
      html:
        '<p>' +
        'buy now buy now buy now buy now '.repeat(1) +
        'act now act now act now act now '.repeat(1) +
        'free money free money free money free money '.repeat(1) +
        'click here click here click here click here'.repeat(1) +
        '</p>',
    }).checkAll();
    expect(byName(spam, 'spam-keywords-absent').passed).toBe(false);
  });

  it('flags outgoing links to suspicious TLDs', async () => {
    const results = await checkerFor({ html: '<a href="https://spammy.tk/x">click</a>' }).checkAll();
    expect(byName(results, 'outgoing-link-quality-good').passed).toBe(false);
  });

  it('flags tiny text with real content', async () => {
    const geometry: MockElementGeometry[] = [{ selector: '.tiny', style: { fontSize: '3px' } }];
    const results = await checkerFor({
      html: `<p class="tiny">${'x'.repeat(40)}</p>`,
      geometry,
    }).checkAll();
    expect(byName(results, 'tiny-text-absent').passed).toBe(false);
  });
});
