import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { SocialMediaChecker } from '../../src/checkers/socialMedia';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): SocialMediaChecker {
  const page = createMockPage(opts);
  return new SocialMediaChecker({ page: page as Page, checkerKey: 'socialMedia' });
}

function byName(results: Awaited<ReturnType<SocialMediaChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('SocialMediaChecker (mock-DOM, exercises page.evaluate bodies)', () => {
  it('fails twitter-card-configured with no tags, and with a partial set', async () => {
    const none = await checkerFor({}).checkAll();
    expect(byName(none, 'twitter-card-configured').message).toContain('No Twitter Card tags found');

    const partial = await checkerFor({ headHtml: '<meta name="twitter:card" content="summary">' }).checkAll();
    const result = byName(partial, 'twitter-card-configured');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('incomplete');
  });

  it('passes twitter-card-configured when all 4 tags are present', async () => {
    const results = await checkerFor({
      headHtml:
        '<meta name="twitter:card" content="summary_large_image">' +
        '<meta name="twitter:title" content="Title">' +
        '<meta name="twitter:description" content="Description">' +
        '<meta name="twitter:image" content="https://example.com/img.jpg">',
    }).checkAll();
    expect(byName(results, 'twitter-card-configured').passed).toBe(true);
  });

  it('fails open-graph-configured with no tags, and flags a missing og:image:width', async () => {
    const none = await checkerFor({}).checkAll();
    expect(byName(none, 'open-graph-configured').message).toContain('No Open Graph tags found');

    const noWidth = await checkerFor({
      headHtml:
        '<meta property="og:title" content="T">' +
        '<meta property="og:description" content="D">' +
        '<meta property="og:image" content="i.jpg">' +
        '<meta property="og:url" content="https://example.com">' +
        '<meta property="og:type" content="website">',
    }).checkAll();
    const result = byName(noWidth, 'open-graph-configured');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('image:width');
  });

  it('passes open-graph-configured when fully configured including image dimensions', async () => {
    const results = await checkerFor({
      headHtml:
        '<meta property="og:title" content="T">' +
        '<meta property="og:description" content="D">' +
        '<meta property="og:image" content="i.jpg">' +
        '<meta property="og:image:width" content="1200">' +
        '<meta property="og:url" content="https://example.com">' +
        '<meta property="og:type" content="website">',
    }).checkAll();
    expect(byName(results, 'open-graph-configured').passed).toBe(true);
  });

  it('reports Facebook tags absent, and present via app_id or admins', async () => {
    const none = await checkerFor({}).checkAll();
    const noneResult = byName(none, 'facebook-tags-present');
    expect(noneResult.passed).toBe(true);
    expect(noneResult.message).toContain('No Facebook-specific tags');

    const appId = await checkerFor({ headHtml: '<meta property="fb:app_id" content="123">' }).checkAll();
    expect(byName(appId, 'facebook-tags-present').message).toContain('Facebook-specific tags found');

    const admins = await checkerFor({ headHtml: '<meta property="fb:admins" content="456">' }).checkAll();
    expect(byName(admins, 'facebook-tags-present').message).toContain('Facebook-specific tags found');
  });
});
