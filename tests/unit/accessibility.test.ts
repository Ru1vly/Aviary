import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { AccessibilityChecker } from '../../src/checkers/accessibility';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';
import { SEOConfig } from '../../src/config';

function checkerFor(opts: MockPageOptions, config?: SEOConfig): AccessibilityChecker {
  const page = createMockPage(opts);
  return new AccessibilityChecker({ page: page as Page, checkerKey: 'accessibility', config });
}

function byName(results: Awaited<ReturnType<AccessibilityChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('AccessibilityChecker (mock-DOM, exercises page.evaluate bodies)', () => {
  it('flags interactive elements without labels and missing landmarks', async () => {
    const results = await checkerFor({ html: '<button></button>' }).checkAll();
    const aria = byName(results, 'aria-labels-adequate');
    expect(aria.passed).toBe(false);
    expect(aria.message).toContain('missing labels');
    expect(aria.message).toContain('No ARIA landmarks');
  });

  it('passes aria-labels-adequate when elements are labeled and landmarks exist', async () => {
    const results = await checkerFor({
      html: '<main><button aria-label="Close">X</button></main>',
    }).checkAll();
    expect(byName(results, 'aria-labels-adequate').passed).toBe(true);
  });

  it('does not flag interactive elements that have text, title, or alt', async () => {
    const results = await checkerFor({
      html: '<main><button>Click</button><input alt="icon" type="image"><a title="link">x</a></main>',
    }).checkAll();
    expect(byName(results, 'aria-labels-adequate').passed).toBe(true);
  });

  it('reports "no form inputs" when the page has none', async () => {
    const results = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(byName(results, 'form-inputs-labeled').message).toContain('No form inputs');
  });

  it('flags inputs missing labels, and skips hidden/submit/button inputs', async () => {
    const results = await checkerFor({
      html: '<input type="text"><input type="hidden" value="x"><input type="submit" value="Go">',
    }).checkAll();
    expect(byName(results, 'form-inputs-labeled').passed).toBe(false);
    expect(byName(results, 'form-inputs-labeled').details?.inputsWithoutLabels).toBe(1);
  });

  it('passes form-inputs-labeled when a <label for> matches the input id', async () => {
    const results = await checkerFor({
      html: '<label for="email">Email</label><input id="email" type="email">',
    }).checkAll();
    expect(byName(results, 'form-inputs-labeled').passed).toBe(true);
  });

  it('passes form-inputs-labeled via aria-labelledby', async () => {
    const results = await checkerFor({
      html: '<span id="lbl">Email</span><input aria-labelledby="lbl" type="email">',
    }).checkAll();
    expect(byName(results, 'form-inputs-labeled').passed).toBe(true);
  });

  it('flags missing skip links and passes when one is present', async () => {
    const none = await checkerFor({ html: '<a href="/about">About</a>' }).checkAll();
    expect(byName(none, 'skip-links-present').passed).toBe(false);

    const withSkip = await checkerFor({ html: '<a href="#main">Skip to main content</a>' }).checkAll();
    expect(byName(withSkip, 'skip-links-present').passed).toBe(true);
  });

  it('flags excessive negative tabindex (via a lowered threshold) and positive tabindex', async () => {
    const negative = await checkerFor(
      { html: '<a href="/" tabindex="-1">x</a>' },
      { rules: { accessibility: { 'tab-order-natural': { options: { maxNegativeTabIndex: 0 } } } } }
    ).checkAll();
    expect(byName(negative, 'tab-order-natural').passed).toBe(false);
    expect(byName(negative, 'tab-order-natural').message).toContain('negative tabindex');

    const positive = await checkerFor({ html: '<a href="/" tabindex="5">x</a>' }).checkAll();
    expect(byName(positive, 'tab-order-natural').passed).toBe(false);
    expect(byName(positive, 'tab-order-natural').message).toContain('positive tabindex');
  });

  it('passes tab-order-natural with no tabindex usage', async () => {
    const results = await checkerFor({ html: '<a href="/">x</a>' }).checkAll();
    expect(byName(results, 'tab-order-natural').passed).toBe(true);
  });
});
