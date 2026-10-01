import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverLinkedUrls, discoverSitemapUrls, filterUrlsByRobotsTxt } from '../../src/crawler';

function stubFetch(routes: Record<string, Response | (() => Response)>) {
  const fetchMock = vi.fn(async (input: URL | RequestInfo | string) => {
    const url = input instanceof URL ? input.href : String(input);
    const route = routes[url];
    if (!route) throw new Error(`Unexpected crawl request: ${url}`);
    return typeof route === 'function' ? route() : route;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function robots(body: string) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } });
}

function html(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('same-origin HTML crawl', () => {
  it('uses the document base, ignores templates/comments/nofollow links, and removes fragments', async () => {
    const root = 'https://aviary.test/';
    const fetchMock = stubFetch({
      'https://aviary.test/robots.txt': robots('User-agent: *\nAllow: /'),
      [root]: html(`
        <!-- <a href="/comment-only">Ignored</a> -->
        <template><a href="/template-only">Ignored</a></template>
        <base href="/docs/">
        <a href="quick-start#overview">Guide</a>
        <a href="/nofollow" rel="external nofollow">Excluded</a>
        <a href="https://other.test/page">Out of scope</a>
        <a href="javascript:void(0)">Not a page</a>
      `),
    });
    const progress: string[] = [];

    const urls = await discoverLinkedUrls(root, {
      maxDepth: 1,
      onPage: ({ currentUrl }) => progress.push(currentUrl),
    });

    expect(urls).toEqual([root, 'https://aviary.test/docs/quick-start']);
    expect(progress).toEqual([root, 'https://aviary.test/docs/quick-start']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(
      'https://other.test/page'
    );
  });

  it('respects robots.txt and page-level nofollow directives before following links', async () => {
    const root = 'https://aviary.test/';
    stubFetch({
      'https://aviary.test/robots.txt': robots('User-agent: *\nDisallow: /private'),
      [root]: html(
        '<meta name="robots" content="index, follow"><a href="/private/article">Private</a><a href="/public">Public</a>'
      ),
    });

    await expect(discoverLinkedUrls(root, { maxDepth: 1 })).resolves.toEqual([
      root,
      'https://aviary.test/public',
    ]);
  });

  it('stops link expansion when a page tells crawlers not to follow links', async () => {
    const root = 'https://aviary.test/';
    stubFetch({
      'https://aviary.test/robots.txt': robots('User-agent: *\nAllow: /'),
      [root]: html('<meta name="AviaryBot" content="nofollow"><a href="/child">Child</a>'),
    });

    await expect(discoverLinkedUrls(root, { maxDepth: 1 })).resolves.toEqual([root]);
  });

  it('keeps same-origin sitemap pages, strips fragments, and preserves lastmod entries', async () => {
    const sitemapUrl = 'https://aviary.test/sitemap.xml';
    const fetchMock = stubFetch({
      [sitemapUrl]: new Response(
        '<urlset><url><loc>https://aviary.test/docs#top</loc><lastmod>2026-09-30</lastmod></url><url><loc>https://outside.test/page</loc></url></urlset>',
        { status: 200, headers: { 'content-type': 'application/xml' } }
      ),
    });
    const entries: Array<{ url: string; lastModified?: string }> = [];

    const urls = await discoverSitemapUrls(sitemapUrl, {
      onPageEntry: (entry) => entries.push(entry),
    });

    expect(urls).toEqual(['https://aviary.test/docs']);
    expect(entries).toEqual([{ url: 'https://aviary.test/docs', lastModified: '2026-09-30' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('robots URL filtering', () => {
  it('keeps only policy-allowed URLs on the requested origin', async () => {
    stubFetch({
      'https://aviary.test/robots.txt': robots('User-agent: AviaryBot\nDisallow: /drafts'),
    });
    const filtered: unknown[] = [];

    const urls = await filterUrlsByRobotsTxt(
      [
        'https://aviary.test/',
        'https://aviary.test/drafts/private',
        'https://outside.test/page',
        'not a URL',
      ],
      'https://aviary.test',
      { onFilter: (summary) => filtered.push(summary) }
    );

    expect(urls).toEqual(['https://aviary.test/']);
    expect(filtered).toEqual([{ listedUrls: 4, allowedUrls: 1, disallowedUrls: 3 }]);
  });
});
