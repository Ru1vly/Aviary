import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { LinksChecker } from '../../src/checkers/links';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): LinksChecker {
  const page = createMockPage(opts);
  return new LinksChecker({ page: page as Page, checkerKey: 'links' });
}

function byName(results: Awaited<ReturnType<LinksChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('LinksChecker (mock-DOM, exercises page.evaluate bodies)', () => {
  it('fails link-structure-valid when there are no links at all', async () => {
    const results = await checkerFor({ html: '<p>no links</p>' }).checkAll();
    expect(byName(results, 'link-structure-valid').passed).toBe(false);
    expect(byName(results, 'link-structure-valid').message).toContain('No links found');
  });

  it('flags a page with no internal links and links missing descriptive text', async () => {
    const results = await checkerFor({
      url: 'https://example.com',
      html: '<a href="https://external.example/a">External</a><a href="https://external.example/b"></a>',
    }).checkAll();
    const structure = byName(results, 'link-structure-valid');
    expect(structure.passed).toBe(false);
    expect(structure.message).toContain('No internal links found');
    expect(structure.message).toContain('without descriptive text');
  });

  it('passes link-structure-valid for a healthy mix of internal/external links with text', async () => {
    const results = await checkerFor({
      url: 'https://example.com',
      html: '<a href="/about">About</a><a href="https://external.example/x">External</a>',
    }).checkAll();
    expect(byName(results, 'link-structure-valid').passed).toBe(true);
  });

  it('skips anchor and javascript: links entirely', async () => {
    const results = await checkerFor({
      url: 'https://example.com',
      html: '<a href="#section">Jump</a><a href="javascript:void(0)">JS</a><a href="/about">About</a>',
    }).checkAll();
    expect(byName(results, 'link-structure-valid').details?.internal).toBe(1);
  });

  it('reports "no external links" and flags external links missing rel=noopener', async () => {
    const none = await checkerFor({ url: 'https://example.com', html: '<a href="/about">About</a>' }).checkAll();
    expect(byName(none, 'external-links-secure').message).toContain('No external links');

    const bad = await checkerFor({
      url: 'https://example.com',
      html: '<a href="https://external.example/x" target="_blank">External</a>',
    }).checkAll();
    expect(byName(bad, 'external-links-secure').passed).toBe(false);
    expect(byName(bad, 'external-links-secure').message).toContain('noopener');

    const good = await checkerFor({
      url: 'https://example.com',
      html: '<a href="https://external.example/x" rel="noopener nofollow">External</a>',
    }).checkAll();
    const goodResult = byName(good, 'external-links-secure');
    expect(goodResult.passed).toBe(true);
    expect(goodResult.message).toContain('properly configured');
  });

  it('fails internal-links-descriptive with no internal links, and with unlabeled ones', async () => {
    const none = await checkerFor({
      url: 'https://example.com',
      html: '<a href="https://external.example/x">External</a>',
    }).checkAll();
    expect(byName(none, 'internal-links-descriptive').passed).toBe(false);
    expect(byName(none, 'internal-links-descriptive').message).toContain('No internal links found');

    const unlabeled = await checkerFor({ url: 'https://example.com', html: '<a href="/about"></a>' }).checkAll();
    expect(byName(unlabeled, 'internal-links-descriptive').passed).toBe(false);
    expect(byName(unlabeled, 'internal-links-descriptive').message).toContain('missing descriptive text');
  });

  it('passes internal-links-descriptive for well-labeled internal links', async () => {
    const results = await checkerFor({ url: 'https://example.com', html: '<a href="/about">About us</a>' }).checkAll();
    expect(byName(results, 'internal-links-descriptive').passed).toBe(true);
  });
});
