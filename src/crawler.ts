import { gunzipSync } from 'node:zlib';
import { AVIARY_CRAWLER_USER_AGENT, fetchRobotsPolicy } from './robots';
export { AVIARY_CRAWLER_USER_AGENT } from './robots';

export interface SitemapDiscoveryOptions {
  /** Maximum same-origin page URLs returned. Defaults to 1,000; maximum 10,000. */
  maxUrls?: number;
  /** Maximum sitemap documents fetched from an index. Defaults to 100. */
  maxSitemaps?: number;
  /** Maximum sitemap-index nesting depth. Defaults to 4. */
  maxDepth?: number;
  /** Maximum sitemap documents fetched in parallel. Defaults to 4; maximum 8. */
  concurrency?: number;
  /** Per-sitemap fetch timeout in milliseconds. Defaults to 30,000. */
  timeoutMs?: number;
  /** Abort in-flight sitemap requests and stop discovery. */
  signal?: AbortSignal;
  /** Revalidate sitemap responses across repeated discoveries, such as watch runs. Capped at 20 MiB. */
  cache?: SitemapDiscoveryCache;
  /** Called after each valid sitemap document is processed; observer errors are ignored. */
  onDocument?: (progress: SitemapDiscoveryProgress) => void;
  /** Called for each same-origin URL entry; duplicate entry observations are preserved. */
  onPageEntry?: (entry: SitemapPageEntry) => void;
}

export interface SitemapPageEntry {
  url: string;
  /** Raw sitemap `<lastmod>` text; validation is left to the consumer. */
  lastModified?: string;
}

export interface SitemapDiscoveryProgress {
  sitemapsFetched: number;
  sitemapsQueued: number;
  discoveredUrls: number;
  currentSitemap: string;
}

export interface SitemapDiscoveryCacheEntry {
  body: string;
  byteLength: number;
  etag?: string;
  lastModified?: string;
}

export type SitemapDiscoveryCache = Map<string, SitemapDiscoveryCacheEntry>;

export interface SiteCrawlCacheEntry {
  body: string;
  byteLength: number;
  etag?: string;
  lastModified?: string;
  xRobotsTag?: string;
}

export type SiteCrawlDiscoveryCache = Map<string, SiteCrawlCacheEntry>;

export interface SiteCrawlOptions {
  /** Maximum same-origin page URLs returned. Defaults to 1,000; maximum 10,000. */
  maxUrls?: number;
  /** Maximum number of link hops from the starting URL. Defaults to 2; maximum 32. */
  maxDepth?: number;
  /** Maximum pages fetched in parallel. Defaults to 2; maximum 8. */
  concurrency?: number;
  /** Per-page request timeout in milliseconds. Defaults to 30,000. */
  timeoutMs?: number;
  /** Maximum HTML response body size. Defaults to 2 MiB; maximum 10 MiB. */
  maxPageBytes?: number;
  /** Maximum combined HTML response bytes. Defaults to 100 MiB; maximum 1 GiB. */
  maxTotalBytes?: number;
  /** Revalidate pages across repeated discoveries, such as watch runs. Capped at 20 MiB. */
  cache?: SiteCrawlDiscoveryCache;
  /** Abort in-flight requests and stop discovery. */
  signal?: AbortSignal;
  /** Called after each visited page is considered for discovery; observer errors are ignored. */
  onPage?: (progress: SiteCrawlProgress) => void;
}

export interface SiteCrawlProgress {
  pagesProcessed: number;
  pagesQueued: number;
  discoveredUrls: number;
  pagesAtLinkLimit: number;
  responseBytesDownloaded: number;
  currentUrl: string;
}

const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;
const MAX_SITEMAP_CACHE_BYTES = 20 * 1024 * 1024;
const MAX_SITEMAP_CACHE_ENTRIES = 1_000;
const DEFAULT_CRAWL_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_CRAWL_PAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_CRAWL_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_CRAWL_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_CRAWL_CACHE_BYTES = 20 * 1024 * 1024;
const MAX_CRAWL_CACHE_ENTRIES = 1_000;
const MAX_CRAWL_LINKS_PER_PAGE = 10_000;
const X_ROBOTS_DIRECTIVES_WITH_VALUES = new Set([
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
  'unavailable_after',
]);

interface CrawlByteBudget {
  readonly maxBytes: number;
  readonly bytesRead: number;
  readonly exhausted: boolean;
  register(controller: AbortController): void;
  unregister(controller: AbortController): void;
  consume(byteLength: number): boolean;
}

function createCrawlByteBudget(maxBytes: number): CrawlByteBudget {
  const activeRequests = new Set<AbortController>();
  let bytesRead = 0;
  let exhausted = false;
  return {
    maxBytes,
    get bytesRead() {
      return bytesRead;
    },
    get exhausted() {
      return exhausted;
    },
    register(controller) {
      if (exhausted) controller.abort();
      else activeRequests.add(controller);
    },
    unregister(controller) {
      activeRequests.delete(controller);
    },
    consume(byteLength) {
      if (exhausted) return false;
      if (byteLength > maxBytes - bytesRead) {
        exhausted = true;
        for (const controller of activeRequests) controller.abort();
        return false;
      }
      bytesRead += byteLength;
      return true;
    },
  };
}

/** Create a bounded cache that can be reused by repeated sitemap discoveries. */
export function createSitemapDiscoveryCache(): SitemapDiscoveryCache {
  return new Map();
}

/** Create a bounded cache that can be reused by repeated link discoveries. */
export function createSiteCrawlCache(): SiteCrawlDiscoveryCache {
  return new Map();
}

function cacheSitemap(
  cache: SitemapDiscoveryCache | undefined,
  url: string,
  entry: SitemapDiscoveryCacheEntry
): void {
  if (!cache) return;
  if (entry.byteLength > MAX_SITEMAP_CACHE_BYTES || (!entry.etag && !entry.lastModified)) {
    cache.delete(url);
    return;
  }
  cache.delete(url);
  cache.set(url, entry);
  let totalBytes = [...cache.values()].reduce((total, value) => total + value.byteLength, 0);
  while (totalBytes > MAX_SITEMAP_CACHE_BYTES || cache.size > MAX_SITEMAP_CACHE_ENTRIES) {
    const oldest = cache.entries().next().value as [string, SitemapDiscoveryCacheEntry] | undefined;
    if (!oldest) break;
    cache.delete(oldest[0]);
    totalBytes -= oldest[1].byteLength;
  }
}

function cacheCrawlPage(
  cache: SiteCrawlDiscoveryCache | undefined,
  url: string,
  entry: SiteCrawlCacheEntry
): void {
  if (!cache) return;
  if (entry.byteLength > MAX_CRAWL_CACHE_BYTES || (!entry.etag && !entry.lastModified)) {
    cache.delete(url);
    return;
  }
  cache.delete(url);
  cache.set(url, entry);
  let totalBytes = [...cache.values()].reduce((total, value) => total + value.byteLength, 0);
  while (totalBytes > MAX_CRAWL_CACHE_BYTES || cache.size > MAX_CRAWL_CACHE_ENTRIES) {
    const oldest = cache.entries().next().value as [string, SiteCrawlCacheEntry] | undefined;
    if (!oldest) break;
    cache.delete(oldest[0]);
    totalBytes -= oldest[1].byteLength;
  }
}

function responseDisallowsCaching(response: Response): boolean {
  return /(?:^|,)\s*no-store\b/i.test(response.headers.get('cache-control') ?? '');
}

function isValidXmlCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([\da-f]+);/gi, (entity, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return isValidXmlCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    })
    .replace(/&#(\d+);/g, (entity, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return isValidXmlCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseLocations(xml: string): string[] {
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '');
  const locations: string[] = [];
  const expression = /<(?:[\w.-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?loc\s*>/gi;
  for (const match of withoutComments.matchAll(expression)) {
    const raw = (match[1] ?? '').replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
    const value = decodeXmlText(raw).trim();
    if (value) locations.push(value);
  }
  return locations;
}

function parseSitemapPageEntries(xml: string): SitemapPageEntry[] {
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '');
  const entries: SitemapPageEntry[] = [];
  const elementExpression = /<(?:[\w.-]+:)?url\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?url\s*>/gi;
  const valueExpression = (name: string): RegExp =>
    new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}\\s*>`, 'i');
  for (const match of withoutComments.matchAll(elementExpression)) {
    const contents = match[1] ?? '';
    const readValue = (name: string): string | undefined => {
      const valueMatch = valueExpression(name).exec(contents);
      if (!valueMatch) return undefined;
      const raw = (valueMatch[1] ?? '').replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
      return decodeXmlText(raw).trim() || undefined;
    };
    const url = readValue('loc');
    const lastModified = readValue('lastmod');
    if (url) entries.push({ url, ...(lastModified ? { lastModified } : {}) });
  }
  return entries;
}

async function readSitemapBody(response: Response, sitemapUrl: string): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SITEMAP_BYTES) {
    throw new Error(`Sitemap "${sitemapUrl}" exceeds the 5 MiB size limit.`);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_SITEMAP_BYTES) {
        await reader.cancel();
        throw new Error(`Sitemap "${sitemapUrl}" exceeds the 5 MiB size limit.`);
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!isGzip) return new TextDecoder('utf-8').decode(bytes);
    try {
      return new TextDecoder('utf-8').decode(
        gunzipSync(bytes, { maxOutputLength: MAX_SITEMAP_BYTES })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('larger than')) {
        throw new Error(`Sitemap "${sitemapUrl}" exceeds the 5 MiB uncompressed size limit.`);
      }
      throw new Error(`Sitemap "${sitemapUrl}" is not a valid gzip stream: ${message}`);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

async function fetchSitemap(
  url: URL,
  timeoutMs: number,
  signal?: AbortSignal,
  cache?: SitemapDiscoveryCache
): Promise<string> {
  if (signal?.aborted) throw new Error('Sitemap discovery was cancelled.');
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const cached = cache?.get(url.href);
  const headers = new Headers({ accept: 'application/xml, text/xml;q=0.9, */*;q=0.1' });
  if (cached?.etag) headers.set('if-none-match', cached.etag);
  if (cached?.lastModified) headers.set('if-modified-since', cached.lastModified);
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      redirect: 'error',
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    if (signal?.aborted) throw new Error('Sitemap discovery was cancelled.');
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted) {
      throw new Error(
        `Could not fetch sitemap "${url.href}": request timed out after ${timeoutMs} ms.`
      );
    }
    throw new Error(`Could not fetch sitemap "${url.href}": ${message}`);
  }
  if (response.status === 304 && cached) {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    await response.body?.cancel().catch(() => undefined);
    if (responseDisallowsCaching(response)) cache?.delete(url.href);
    else {
      cache?.delete(url.href);
      cache?.set(url.href, cached);
    }
    return cached.body;
  }
  if (!response.ok) {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Sitemap "${url.href}" returned HTTP ${response.status}.`);
  }
  try {
    const body = await readSitemapBody(response, url.href);
    if (responseDisallowsCaching(response)) cache?.delete(url.href);
    else {
      cacheSitemap(cache, url.href, {
        body,
        byteLength: Buffer.byteLength(body, 'utf8'),
        ...(response.headers.get('etag') ? { etag: response.headers.get('etag')! } : {}),
        ...(response.headers.get('last-modified')
          ? { lastModified: response.headers.get('last-modified')! }
          : {}),
      });
    }
    return body;
  } catch (error) {
    await response.body?.cancel().catch(() => undefined);
    if (signal?.aborted) throw new Error('Sitemap discovery was cancelled.');
    if (controller.signal.aborted) {
      throw new Error(`Sitemap "${url.href}" timed out after ${timeoutMs} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Discover same-origin page URLs from a sitemap or nested sitemap index. */
export async function discoverSitemapUrls(
  sitemapUrl: string,
  options: SitemapDiscoveryOptions = {}
): Promise<string[]> {
  const maxUrls = options.maxUrls ?? 1_000;
  const maxSitemaps = options.maxSitemaps ?? 100;
  const maxDepth = options.maxDepth ?? 4;
  const concurrency = options.concurrency ?? 4;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const signal = options.signal;
  const cache = options.cache;
  if (!Number.isInteger(maxUrls) || maxUrls < 1 || maxUrls > 10_000) {
    throw new Error('Sitemap maxUrls must be an integer from 1 to 10,000.');
  }
  if (!Number.isInteger(maxSitemaps) || maxSitemaps < 1 || maxSitemaps > 1_000) {
    throw new Error('Sitemap maxSitemaps must be an integer from 1 to 1,000.');
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 8) {
    throw new Error('Sitemap maxDepth must be an integer from 0 to 8.');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error('Sitemap concurrency must be an integer from 1 to 8.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('Sitemap timeoutMs must be a positive integer no greater than 2,147,483,647.');
  }

  let root: URL;
  try {
    root = new URL(sitemapUrl);
  } catch {
    throw new Error(`Invalid sitemap URL: "${sitemapUrl}".`);
  }
  if ((root.protocol !== 'http:' && root.protocol !== 'https:') || root.username || root.password) {
    throw new Error('Sitemap URL must use HTTP or HTTPS and cannot contain credentials.');
  }
  root.hash = '';

  const origin = root.origin;
  const visitedSitemaps = new Set<string>();
  const pageUrls = new Set<string>();
  let fetchedSitemaps = 0;
  let stoppedAtLimit = false;
  let frontier: Array<{ url: URL; depth: number }> = [{ url: root, depth: 0 }];
  visitedSitemaps.add(root.href);

  while (frontier.length > 0 && !stoppedAtLimit) {
    if (signal?.aborted) throw new Error('Sitemap discovery was cancelled.');
    const nextFrontier: Array<{ url: URL; depth: number }> = [];
    for (let offset = 0; offset < frontier.length && !stoppedAtLimit; offset += concurrency) {
      const batch = frontier.slice(offset, offset + concurrency);
      const documents = await Promise.allSettled(
        batch.map(({ url }) => fetchSitemap(url, timeoutMs, signal, cache))
      );
      const failed = documents.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;

      for (let index = 0; index < batch.length; index += 1) {
        const item = batch[index];
        const result = documents[index];
        if (!item || result?.status !== 'fulfilled') continue;
        const { url, depth } = item;
        const xml = result.value.replace(/<!--[\s\S]*?-->/g, '');
        const locations = parseLocations(xml);
        if (/<(?:[\w.-]+:)?sitemapindex\b/i.test(xml)) {
          for (const location of locations) {
            let child: URL;
            try {
              child = new URL(location, url);
            } catch {
              continue;
            }
            if (
              (child.protocol !== 'http:' && child.protocol !== 'https:') ||
              child.origin !== origin ||
              child.username ||
              child.password
            )
              continue;
            child.hash = '';
            if (visitedSitemaps.has(child.href)) continue;
            if (depth + 1 > maxDepth) {
              throw new Error(`Sitemap index nesting exceeds the depth limit of ${maxDepth}.`);
            }
            if (visitedSitemaps.size >= maxSitemaps) {
              throw new Error(`Sitemap discovery exceeded the ${maxSitemaps}-document limit.`);
            }
            visitedSitemaps.add(child.href);
            nextFrontier.push({ url: child, depth: depth + 1 });
          }
          fetchedSitemaps += 1;
          try {
            options.onDocument?.({
              sitemapsFetched: fetchedSitemaps,
              sitemapsQueued: Math.max(0, visitedSitemaps.size - fetchedSitemaps),
              discoveredUrls: pageUrls.size,
              currentSitemap: url.href,
            });
          } catch {
            // Progress observers must not interrupt discovery.
          }
          continue;
        }
        if (!/<(?:[\w.-]+:)?urlset\b/i.test(xml)) {
          throw new Error(`Sitemap "${url.href}" is not a sitemap index or URL set.`);
        }

        const pageEntries = parseSitemapPageEntries(xml);
        // Keep legacy location discovery for malformed-but-readable URL sets while attaching
        // lastmod from matching well-formed <url> entries when it is available.
        const entriesByLocation = new Map<string, SitemapPageEntry[]>();
        for (const entry of pageEntries) {
          const group = entriesByLocation.get(entry.url) ?? [];
          group.push(entry);
          entriesByLocation.set(entry.url, group);
        }
        const entriesToAdd: SitemapPageEntry[] = locations.map(
          (location) => entriesByLocation.get(location)?.shift() ?? { url: location }
        );
        for (const entry of entriesToAdd) {
          let page: URL;
          try {
            page = new URL(entry.url, url);
          } catch {
            continue;
          }
          if (
            (page.protocol !== 'http:' && page.protocol !== 'https:') ||
            page.origin !== origin ||
            page.username ||
            page.password
          )
            continue;
          page.hash = '';
          pageUrls.add(page.href);
          try {
            options.onPageEntry?.({
              url: page.href,
              ...(entry?.lastModified ? { lastModified: entry.lastModified } : {}),
            });
          } catch {
            // Entry observers must not interrupt URL discovery.
          }
          if (pageUrls.size >= maxUrls) {
            stoppedAtLimit = true;
            break;
          }
        }
        fetchedSitemaps += 1;
        try {
          options.onDocument?.({
            sitemapsFetched: fetchedSitemaps,
            sitemapsQueued: Math.max(0, visitedSitemaps.size - fetchedSitemaps),
            discoveredUrls: pageUrls.size,
            currentSitemap: url.href,
          });
        } catch {
          // Progress observers must not interrupt discovery.
        }
        if (stoppedAtLimit) break;
      }
    }
    frontier = nextFrontier;
  }

  if (pageUrls.size === 0)
    throw new Error(`No same-origin page URLs were found in sitemap "${root.href}".`);
  return [...pageUrls];
}

function findTagEnd(source: string, start: number): number {
  let quote: '"' | "'" | undefined;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  return source.length - 1;
}

function parseHtmlAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const body = tag.replace(/^<[\w:-]+|\/?\s*>$/g, '');
  const expression = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(expression)) {
    const name = match[1]?.toLowerCase();
    if (!name || attributes.has(name)) continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#x([\da-f]+);?/gi, (entity, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .replace(/&#(\d+);?/g, (entity, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, '\u00a0');
}

function declaresNoFollow(content: string): boolean {
  return /(?:^|[\s,])(?:nofollow|none)(?:$|[\s,])/i.test(content);
}

function xRobotsTagDisallowsFollowing(value: string): boolean {
  let appliesToAviary = true;
  for (const part of value.split(',')) {
    let directive = part.trim();
    const scopedDirective = /^([^\s:,]+)\s*:\s*(.*)$/.exec(directive);
    const scope = (scopedDirective?.[1] ?? '').toLowerCase();
    if (scopedDirective && !X_ROBOTS_DIRECTIVES_WITH_VALUES.has(scope)) {
      appliesToAviary =
        scope === 'robots' ||
        scope === '*' ||
        scope === 'aviarybot' ||
        scope.startsWith('aviarybot/');
      directive = scopedDirective[2] ?? '';
    }
    if (appliesToAviary && declaresNoFollow(directive)) return true;
  }
  return false;
}

function extractCrawlLinks(html: string): {
  hrefs: string[];
  baseHref?: string;
  nofollowPage: boolean;
  linksTruncated: boolean;
} {
  const hrefs: string[] = [];
  let baseHref: string | undefined;
  let nofollowPage = false;
  let linksTruncated = false;
  let templateDepth = 0;
  const rawTextTags = new Set(['script', 'style', 'textarea', 'title']);
  const lowerHtml = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start === -1) break;
    if (html.startsWith('<!--', start)) {
      const commentEnd = html.indexOf('-->', start + 4);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }
    const nameStart = start + 1;
    if (html[nameStart] === '/') {
      let closeNameEnd = nameStart + 1;
      while (/[\w:-]/.test(html[closeNameEnd] ?? '')) closeNameEnd += 1;
      const closingTagName = html.slice(nameStart + 1, closeNameEnd).toLowerCase();
      if (closingTagName === 'template' && templateDepth > 0) templateDepth -= 1;
      cursor = findTagEnd(html, closeNameEnd) + 1;
      continue;
    }
    if (html[nameStart] === '!' || html[nameStart] === '?') {
      cursor = findTagEnd(html, start + 1) + 1;
      continue;
    }

    let nameEnd = nameStart;
    while (/[\w:-]/.test(html[nameEnd] ?? '')) nameEnd += 1;
    if (nameEnd === nameStart) {
      cursor = start + 1;
      continue;
    }
    const tagName = html.slice(nameStart, nameEnd).toLowerCase();
    const tagEnd = findTagEnd(html, nameEnd);
    const attributes = parseHtmlAttributes(html.slice(start, tagEnd + 1));
    cursor = tagEnd + 1;

    if (tagName === 'template') templateDepth += 1;

    if (
      templateDepth === 0 &&
      (tagName === 'a' || tagName === 'area') &&
      !/(?:^|\s)nofollow(?:\s|$)/i.test(attributes.get('rel') ?? '')
    ) {
      const href = attributes.get('href');
      if (href) {
        const decodedHref = decodeHtmlAttribute(href).trim();
        if (
          !decodedHref ||
          decodedHref.startsWith('#') ||
          /^(?:mailto|tel|javascript|data|blob):/i.test(decodedHref)
        )
          continue;
        if (hrefs.length < MAX_CRAWL_LINKS_PER_PAGE) hrefs.push(decodedHref);
        else linksTruncated = true;
      }
    } else if (templateDepth === 0 && tagName === 'base' && baseHref === undefined) {
      const href = attributes.get('href');
      if (href) baseHref = decodeHtmlAttribute(href).trim();
    } else if (templateDepth === 0 && tagName === 'meta') {
      const directiveTarget = (attributes.get('name') ?? '').trim().toLowerCase();
      if (
        (directiveTarget === 'robots' || directiveTarget === 'aviarybot') &&
        declaresNoFollow(attributes.get('content') ?? '')
      )
        nofollowPage = true;
    }

    if (rawTextTags.has(tagName)) {
      const closeStart = lowerHtml.indexOf(`</${tagName}`, cursor);
      if (closeStart === -1) break;
      cursor = findTagEnd(html, closeStart + 2 + tagName.length) + 1;
    }
  }

  return { hrefs, ...(baseHref !== undefined ? { baseHref } : {}), nofollowPage, linksTruncated };
}

async function readHtmlBody(
  response: Response,
  pageUrl: string,
  maxPageBytes: number,
  byteBudget: CrawlByteBudget
): Promise<{ html: string; byteLength: number }> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxPageBytes) {
    throw new Error(`Page "${pageUrl}" exceeds the ${maxPageBytes}-byte response limit.`);
  }
  if (!response.body) return { html: '', byteLength: 0 };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!byteBudget.consume(value.byteLength)) {
        await reader.cancel();
        throw new Error(
          `Crawl exceeded the ${byteBudget.maxBytes}-byte aggregate HTML response limit.`
        );
      }
      byteLength += value.byteLength;
      if (byteLength > maxPageBytes) {
        await reader.cancel();
        throw new Error(`Page "${pageUrl}" exceeds the ${maxPageBytes}-byte response limit.`);
      }
      chunks.push(value);
    }
    const charset = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(
      response.headers.get('content-type') ?? ''
    )?.[1];
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(charset || 'utf-8');
    } catch {
      decoder = new TextDecoder('utf-8');
    }
    return { html: decoder.decode(Buffer.concat(chunks)), byteLength };
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

async function fetchCrawlLinks(
  startUrl: URL,
  origin: string,
  robotsAllows: (url: URL) => boolean,
  timeoutMs: number,
  maxPageBytes: number,
  byteBudget: CrawlByteBudget,
  cache: SiteCrawlDiscoveryCache | undefined,
  signal?: AbortSignal
): Promise<{ hrefs: string[]; linksTruncated: boolean; pageAllowed: boolean }> {
  if (signal?.aborted) throw new Error('Page discovery was cancelled.');
  if (byteBudget.exhausted) return { hrefs: [], linksTruncated: false, pageAllowed: true };
  const controller = new AbortController();
  byteBudget.register(controller);
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(onAbort, timeoutMs);
  let currentUrl = startUrl;

  try {
    let response: Response | undefined;
    let cachedPage: SiteCrawlCacheEntry | undefined;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      const cached = cache?.get(currentUrl.href);
      const headers: Record<string, string> = {
        accept: 'text/html, application/xhtml+xml;q=0.9',
        'user-agent': AVIARY_CRAWLER_USER_AGENT,
      };
      if (cached?.etag) headers['if-none-match'] = cached.etag;
      if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified;
      response = await fetch(currentUrl, {
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status === 304) {
        await response.body?.cancel().catch(() => undefined);
        if (!cached) return { hrefs: [], linksTruncated: false, pageAllowed: true };
        if (cached.byteLength > maxPageBytes) {
          // A cache entry may have been populated under a more permissive limit.
          // Do not let revalidation bypass the current crawl's per-page cap.
          cache?.delete(currentUrl.href);
          return { hrefs: [], linksTruncated: false, pageAllowed: true };
        }
        const refreshedEtag = response.headers.get('etag');
        const refreshedLastModified = response.headers.get('last-modified');
        const refreshedXRobotsTag = response.headers.get('x-robots-tag');
        cachedPage = {
          ...cached,
          ...(refreshedEtag !== null ? { etag: refreshedEtag } : {}),
          ...(refreshedLastModified !== null ? { lastModified: refreshedLastModified } : {}),
          ...(refreshedXRobotsTag !== null ? { xRobotsTag: refreshedXRobotsTag } : {}),
        };
        if (responseDisallowsCaching(response)) cache?.delete(currentUrl.href);
        else cacheCrawlPage(cache, currentUrl.href, cachedPage);
        break;
      }
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);
      if (!location || redirectCount === 5)
        return { hrefs: [], linksTruncated: false, pageAllowed: true };
      let destination: URL;
      try {
        destination = new URL(location, currentUrl);
      } catch {
        return { hrefs: [], linksTruncated: false, pageAllowed: true };
      }
      if (
        destination.origin !== origin ||
        (destination.protocol !== 'http:' && destination.protocol !== 'https:') ||
        destination.username ||
        destination.password
      )
        return { hrefs: [], linksTruncated: false, pageAllowed: true };
      destination.hash = '';
      if (!robotsAllows(destination))
        return { hrefs: [], linksTruncated: false, pageAllowed: false };
      currentUrl = destination;
    }

    let html: string;
    let xRobotsTag: string | undefined;
    if (cachedPage) {
      html = cachedPage.body;
      xRobotsTag = response?.headers.get('x-robots-tag') ?? cachedPage.xRobotsTag;
    } else {
      if (!response?.ok) {
        await response?.body?.cancel().catch(() => undefined);
        if (response && response.status < 500) cache?.delete(currentUrl.href);
        return { hrefs: [], linksTruncated: false, pageAllowed: true };
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        await response.body?.cancel().catch(() => undefined);
        cache?.delete(currentUrl.href);
        return { hrefs: [], linksTruncated: false, pageAllowed: true };
      }
      const pageBody = await readHtmlBody(response, currentUrl.href, maxPageBytes, byteBudget);
      html = pageBody.html;
      xRobotsTag = response.headers.get('x-robots-tag') ?? undefined;
      if (responseDisallowsCaching(response)) cache?.delete(currentUrl.href);
      else {
        cacheCrawlPage(cache, currentUrl.href, {
          body: html,
          byteLength: pageBody.byteLength,
          ...(response.headers.get('etag') ? { etag: response.headers.get('etag')! } : {}),
          ...(response.headers.get('last-modified')
            ? { lastModified: response.headers.get('last-modified')! }
            : {}),
          ...(xRobotsTag ? { xRobotsTag } : {}),
        });
      }
    }
    if (signal?.aborted) throw new Error('Page discovery was cancelled.');
    const { hrefs, baseHref, nofollowPage, linksTruncated } = extractCrawlLinks(html);
    if (nofollowPage || xRobotsTagDisallowsFollowing(xRobotsTag ?? '')) {
      return { hrefs: [], linksTruncated: false, pageAllowed: true };
    }
    let base = currentUrl;
    if (baseHref) {
      try {
        base = new URL(baseHref, currentUrl);
      } catch {
        // Invalid <base> values are ignored by browsers.
      }
    }
    const discovered: string[] = [];
    for (const href of hrefs) {
      if (!href || href.startsWith('#')) continue;
      try {
        const link = new URL(href, base);
        if (
          (link.protocol !== 'http:' && link.protocol !== 'https:') ||
          link.origin !== origin ||
          link.username ||
          link.password
        )
          continue;
        link.hash = '';
        discovered.push(link.href);
      } catch {
        // Invalid and non-URL anchor values are ignored.
      }
    }
    return { hrefs: discovered, linksTruncated, pageAllowed: true };
  } catch (error) {
    if (signal?.aborted) throw new Error('Page discovery was cancelled.');
    if (byteBudget.exhausted) return { hrefs: [], linksTruncated: false, pageAllowed: true };
    // A broken or timed-out page does not prevent discovery from other pages.
    return { hrefs: [], linksTruncated: false, pageAllowed: true };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    byteBudget.unregister(controller);
  }
}

export interface RobotsFilterOptions {
  /** Per-robots.txt request timeout in milliseconds. Defaults to 30,000. */
  timeoutMs?: number;
  /** Abort the robots policy request. */
  signal?: AbortSignal;
  /** Called after filtering; observer errors are ignored. */
  onFilter?: (summary: RobotsFilterSummary) => void;
}

export interface RobotsFilterSummary {
  listedUrls: number;
  allowedUrls: number;
  disallowedUrls: number;
}

/** Filter same-origin sitemap URLs through the site's robots.txt policy for AviaryBot. */
export async function filterUrlsByRobotsTxt(
  urls: string[],
  siteUrl: string,
  options: RobotsFilterOptions = {}
): Promise<string[]> {
  if (!Array.isArray(urls)) throw new Error('The URL list must be an array of strings.');
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('Robots timeoutMs must be a positive integer no greater than 2,147,483,647.');
  }
  let root: URL;
  try {
    root = new URL(siteUrl);
  } catch {
    throw new Error(`Invalid robots policy site URL: "${siteUrl}".`);
  }
  if ((root.protocol !== 'http:' && root.protocol !== 'https:') || root.username || root.password) {
    throw new Error(
      'Robots policy site URL must use HTTP or HTTPS and cannot contain credentials.'
    );
  }
  const policy = await fetchRobotsPolicy(root.origin, timeoutMs, options.signal);
  if (policy.failureReason) {
    throw new Error(
      `Robots policy could not be applied: ${policy.failureReason}; Aviary fails closed when robots.txt cannot be read.`
    );
  }
  const allowed = urls.filter((value) => {
    try {
      const url = new URL(value);
      return url.origin === root.origin && policy.allows(url);
    } catch {
      return false;
    }
  });
  try {
    options.onFilter?.({
      listedUrls: urls.length,
      allowedUrls: allowed.length,
      disallowedUrls: urls.length - allowed.length,
    });
  } catch {
    // Progress observers must not interrupt filtering.
  }
  return allowed;
}

/** Discover linked HTML pages with a bounded breadth-first crawl from one URL. */
export async function discoverLinkedUrls(
  startUrl: string,
  options: SiteCrawlOptions = {}
): Promise<string[]> {
  const maxUrls = options.maxUrls ?? 1_000;
  const maxDepth = options.maxDepth ?? 2;
  const concurrency = options.concurrency ?? 2;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxPageBytes = options.maxPageBytes ?? DEFAULT_CRAWL_PAGE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_CRAWL_TOTAL_BYTES;
  const signal = options.signal;
  if (!Number.isInteger(maxUrls) || maxUrls < 1 || maxUrls > 10_000) {
    throw new Error('Crawl maxUrls must be an integer from 1 to 10,000.');
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 32) {
    throw new Error('Crawl maxDepth must be an integer from 0 to 32.');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error('Crawl concurrency must be an integer from 1 to 8.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new Error('Crawl timeoutMs must be a positive integer no greater than 2,147,483,647.');
  }
  if (!Number.isInteger(maxPageBytes) || maxPageBytes < 1 || maxPageBytes > MAX_CRAWL_PAGE_BYTES) {
    throw new Error(`Crawl maxPageBytes must be an integer from 1 to ${MAX_CRAWL_PAGE_BYTES}.`);
  }
  if (
    !Number.isInteger(maxTotalBytes) ||
    maxTotalBytes < 1 ||
    maxTotalBytes > MAX_CRAWL_TOTAL_BYTES
  ) {
    throw new Error(`Crawl maxTotalBytes must be an integer from 1 to ${MAX_CRAWL_TOTAL_BYTES}.`);
  }

  let root: URL;
  try {
    root = new URL(startUrl);
  } catch {
    throw new Error(`Invalid crawl start URL: "${startUrl}".`);
  }
  if ((root.protocol !== 'http:' && root.protocol !== 'https:') || root.username || root.password) {
    throw new Error('Crawl start URL must use HTTP or HTTPS and cannot contain credentials.');
  }
  root.hash = '';
  const robotsPolicy = await fetchRobotsPolicy(root.origin, timeoutMs, signal);
  if (robotsPolicy.failureReason) {
    throw new Error(
      `Crawl stopped because ${robotsPolicy.failureReason}; Aviary fails closed when robots.txt cannot be read.`
    );
  }
  if (!robotsPolicy.allows(root)) {
    throw new Error(
      `Crawl stopped because robots.txt disallows the starting URL "${root.href}" for ${AVIARY_CRAWLER_USER_AGENT}.`
    );
  }
  if (maxDepth === 0 || maxUrls === 1) {
    try {
      options.onPage?.({
        pagesProcessed: 1,
        pagesQueued: 0,
        discoveredUrls: 1,
        pagesAtLinkLimit: 0,
        responseBytesDownloaded: 0,
        currentUrl: root.href,
      });
    } catch {
      // Progress observers must not interrupt discovery.
    }
    return [root.href];
  }

  const visited = new Set<string>([root.href]);
  const byteBudget = createCrawlByteBudget(maxTotalBytes);
  const blockedPageUrls = new Set<string>();
  let frontier: Array<{ url: URL; depth: number }> = [{ url: root, depth: 0 }];
  let pagesProcessed = 0;
  let pagesAtLinkLimit = 0;
  while (frontier.length > 0 && (pagesProcessed === 0 || visited.size < maxUrls)) {
    if (signal?.aborted) throw new Error('Page discovery was cancelled.');
    if (byteBudget.exhausted && visited.size < maxUrls) {
      throw new Error(
        `Crawl exceeded the ${maxTotalBytes}-byte aggregate HTML response limit before discovery completed.`
      );
    }
    if (byteBudget.bytesRead >= maxTotalBytes && visited.size < maxUrls) {
      throw new Error(
        `Crawl reached the ${maxTotalBytes}-byte aggregate HTML response limit before discovery completed.`
      );
    }
    const nextFrontier: Array<{ url: URL; depth: number }> = [];
    for (let offset = 0; offset < frontier.length; offset += concurrency) {
      const batch = frontier.slice(offset, offset + concurrency);
      const pageResults = await Promise.all(
        batch.map(async ({ url, depth }) => ({
          url,
          depth,
          links:
            depth >= maxDepth
              ? { hrefs: [], linksTruncated: false, pageAllowed: true }
              : await fetchCrawlLinks(
                  url,
                  root.origin,
                  robotsPolicy.allows,
                  timeoutMs,
                  maxPageBytes,
                  byteBudget,
                  options.cache,
                  signal
                ),
        }))
      );
      if (signal?.aborted) throw new Error('Page discovery was cancelled.');
      for (const { url, depth, links } of pageResults) {
        pagesProcessed += 1;
        if (!links.pageAllowed) blockedPageUrls.add(url.href);
        if (links.linksTruncated) pagesAtLinkLimit += 1;
        if (depth < maxDepth) {
          for (const href of links.hrefs) {
            if (visited.has(href)) continue;
            if (visited.size >= maxUrls) break;
            if (!robotsPolicy.allows(new URL(href))) continue;
            visited.add(href);
            nextFrontier.push({ url: new URL(href), depth: depth + 1 });
            if (visited.size >= maxUrls) break;
          }
        }
        try {
          options.onPage?.({
            pagesProcessed,
            pagesQueued: Math.max(0, visited.size - pagesProcessed),
            discoveredUrls: visited.size - blockedPageUrls.size,
            pagesAtLinkLimit,
            responseBytesDownloaded: byteBudget.bytesRead,
            currentUrl: url.href,
          });
        } catch {
          // Progress observers must not interrupt discovery.
        }
        if (visited.size >= maxUrls) break;
      }
      if (visited.size >= maxUrls) break;
    }
    frontier = nextFrontier;
    if (byteBudget.exhausted && visited.size < maxUrls) {
      throw new Error(
        `Crawl exceeded the ${maxTotalBytes}-byte aggregate HTML response limit before discovery completed.`
      );
    }
  }
  const crawlUrls = [...visited].filter((url) => !blockedPageUrls.has(url));
  if (crawlUrls.length === 0) throw new Error('Crawl found no pages allowed by robots.txt.');
  return crawlUrls;
}
