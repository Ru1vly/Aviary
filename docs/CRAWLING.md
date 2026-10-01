# Page discovery and crawling

Aviary can take a page list from a URL file, a sitemap, or same-origin links on a starting page. Prefer a sitemap when one is available; use `--crawl` when the site has no usable sitemap.

CLI and REST sitemap audits filter their listed pages through `robots.txt` before auditing. The lower-level `discoverSitemapUrls()` library function returns the sitemap's same-origin entries as listed; call `filterUrlsByRobotsTxt()` before auditing them directly when you want the same policy behavior.

## Crawl from a starting URL

```sh
aviary --crawl https://example.com/ \
  --max-depth 3 \
  --max-urls 500 \
  --concurrency 2 \
  --html reports/site.html
```

`--crawl` uses breadth-first discovery. It always includes the starting URL, then follows links up to the selected depth. The limits are:

| Option | Default | Allowed range | Applies to |
| --- | ---: | ---: | --- |
| `--max-depth` | 2 | 0–32 | Number of link hops from the start URL |
| `--max-urls` | 1,000 | 1–10,000 | Total discovered URLs, including the start URL |
| `--max-crawl-page-bytes` | 2 MiB | 1 byte–10 MiB | Maximum HTML body size for one page |
| `--max-crawl-bytes` | 100 MiB | 1 byte–1 GiB | Combined HTML response bodies used for link discovery |
| `--concurrency` | 2 | 1–8 | Simultaneous page-discovery requests and batch browser audits |
| `--timeout` | 30,000 ms | Positive integer | Each page-discovery request and each browser audit |

Each HTML response fetched for link discovery is limited to 2 MiB by default, and combined discovery bodies are capped at 100 MiB. Pages at the selected maximum depth are still included in the audit, but discovery does not fetch their bodies because their links would not be followed. These byte limits apply to discovery requests, not the later Playwright page audits. Set `--max-crawl-page-bytes 5MiB` to adjust the per-page discovery limit and `--max-crawl-bytes 250MiB` to adjust the total; the CLI accepts byte counts or binary `KiB`, `MiB`, and `GiB` suffixes. If discovery needs more data, it stops with an error instead of auditing a partial URL set. The library API permits up to 10 MiB per page and 1 GiB total. A `--watch <seconds>` run rediscovers links on every cycle and does not overlap audit batches; it revalidates cached page bodies when the site provides ETag or Last-Modified headers.

The crawler considers active document anchors and image-map areas, skipping raw-text content and inert `<template>` contents. It considers at most 10,000 link URLs per page. Progress reports the number of pages that reached this capture limit.

## Discovery boundaries

The link crawler reads HTML responses and extracts `<a href>` and `<area href>` links. It:

- keeps URLs on the starting origin and removes fragments before deduplication;
- follows same-origin redirects only, up to five hops;
- skips non-HTML pages, inaccessible pages, malformed links, and off-origin links;
- honors link `rel="nofollow"`, page-level `nofollow` and `none` directives in `robots` or `AviaryBot` meta tags, and matching `X-Robots-Tag` headers;
- fetches `/robots.txt` as `AviaryBot`, merges matching groups, normalizes percent-encoded path octets, and applies the most-specific `Allow` or `Disallow` rule; equal-length ties favor `Allow`, and `/robots.txt` itself remains implicitly allowed;
- uses the same AviaryBot User-Agent for discovery requests and browser audits of discovered pages;
- stops at the URL, depth, byte, timeout, and concurrency limits.

It does not execute JavaScript or infer links from forms and scripts. Dynamic links may therefore be absent from results. A 4xx response for `robots.txt` is treated as unavailable; a 5xx, timeout, or network error stops discovery so Aviary does not continue without a policy. Robots content is parsed up to 1 MiB, and its redirects are followed for up to five hops. These behaviors follow [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html). Use an explicit URL list or sitemap when you need a complete, reviewed scope. Page audit failures remain visible in the batch report.

## Library API

`discoverLinkedUrls()` returns the discovered URLs in breadth-first order. It accepts an `AbortSignal`, a progress callback, and an optional reusable page cache:

```ts
import { AVIARY_CRAWLER_USER_AGENT, createSiteCrawlCache, discoverLinkedUrls, auditUrls } from '@ru1vly/aviary';

const crawlCache = createSiteCrawlCache();

const urls = await discoverLinkedUrls('https://example.com/', {
  maxDepth: 2,
  maxUrls: 250,
  concurrency: 2,
  cache: crawlCache,
  onPage: ({ pagesProcessed, discoveredUrls, currentUrl }) => {
    console.log(`${pagesProcessed} processed; ${discoveredUrls} found: ${currentUrl}`);
  },
});

const report = await auditUrls(urls, {
  concurrency: 2,
  userAgent: AVIARY_CRAWLER_USER_AGENT,
});
```

`discoverLinkedUrls()` options are documented in its `SiteCrawlOptions` type, including `maxPageBytes` and `maxTotalBytes`. Discovery errors for an individual page are skipped so one unavailable page does not stop the remaining crawl. Invalid start URLs and invalid limits reject the call; cancellation or reaching the aggregate byte limit before discovery completes rejects with an explanatory error.

Reuse the same cache for later discovery runs to send conditional requests for pages with ETag or Last-Modified validators. The cache retains at most 20 MiB and 1,000 entries, and does not store responses marked `Cache-Control: no-store`.
