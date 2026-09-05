/**
 * Browser-side DOM extraction functions shared across checkers.
 *
 * Each function here is self-contained (no closures over outer scope) so it can be
 * passed directly to `page.evaluate(fn)` — Playwright serializes the function via
 * `toString()` and runs it inside the page, so it must not reference anything from
 * the Node.js/module scope. Callers memoize the resulting promise per checker
 * instance (the pattern `performance.ts`/`images.ts` established in Sweep 1) so a
 * checker with several checks needing the same data makes one round trip, not one
 * per check.
 */

export interface ImageData {
  src: string;
  /** Attribute value, or null if the `alt` attribute is absent (distinct from present-but-empty). */
  alt: string | null;
  hasAltAttribute: boolean;
  title: string | null;
  role: string | null;
  hasSrcset: boolean;
  srcsetValue: string | null;
  hasSizes: boolean;
  hasLoading: boolean;
  loadingValue: string | null;
  hasWidth: boolean;
  hasHeight: boolean;
  inPicture: boolean;
}

export function extractImages(): ImageData[] {
  return Array.from(document.querySelectorAll('img')).map((img) => ({
    src: img.src || '',
    alt: img.hasAttribute('alt') ? img.getAttribute('alt') : null,
    hasAltAttribute: img.hasAttribute('alt'),
    title: img.hasAttribute('title') ? img.getAttribute('title') : null,
    role: img.getAttribute('role'),
    hasSrcset: img.hasAttribute('srcset'),
    srcsetValue: img.getAttribute('srcset'),
    hasSizes: img.hasAttribute('sizes'),
    hasLoading: img.hasAttribute('loading'),
    loadingValue: img.getAttribute('loading'),
    hasWidth: img.hasAttribute('width'),
    hasHeight: img.hasAttribute('height'),
    inPicture: !!img.closest('picture'),
  }));
}

export interface LinkData {
  /** Lowercased visible text. */
  text: string;
  /** Lowercased href attribute, or '' if absent. */
  href: string;
  inFooter: boolean;
}

export function extractLinks(): LinkData[] {
  return Array.from(document.querySelectorAll('a')).map((link) => ({
    text: (link.textContent || '').toLowerCase(),
    href: (link.getAttribute('href') || '').toLowerCase(),
    inFooter: !!link.closest('footer'),
  }));
}

/** Parses every `<script type="application/ld+json">` block; unparseable blocks are dropped. */
export function extractJsonLdBlocks(): unknown[] {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => {
      try {
        return JSON.parse(script.textContent || '{}');
      } catch {
        return null;
      }
    })
    .filter((data) => data !== null);
}

export interface ResourceTimingEntry {
  name: string;
  initiatorType: string;
  transferSize: number;
}

export function extractResourceTimings(): ResourceTimingEntry[] {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  return entries.map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    transferSize: entry.transferSize || 0,
  }));
}

export interface CharsetInfo {
  charset?: string;
  isUTF8: boolean;
}

/**
 * Resolves the page's declared charset from either the modern `<meta charset>`
 * form or the older `<meta http-equiv="Content-Type" content="...;
 * charset=...">` form. Two checks (internationalization.ts's
 * `charset-utf8` and `unicode-support-utf8`) used to each re-derive this
 * independently, and the unicode one only handled the `meta[charset]` form —
 * false-failing real pages (e.g. older CMS templates) that only declare
 * charset the older way. Both now call this single function so they can't
 * drift apart again.
 */
export function getCharset(): CharsetInfo {
  const metaCharset = document.querySelector('meta[charset]');
  const metaContentType = document.querySelector('meta[http-equiv="Content-Type"]');
  const charset =
    metaCharset?.getAttribute('charset') ||
    metaContentType?.getAttribute('content')?.match(/charset=([^;]+)/)?.[1];
  return {
    charset: charset?.toUpperCase(),
    isUTF8: charset?.toUpperCase() === 'UTF-8',
  };
}

export interface ViewportMeta {
  hasDeviceWidth: boolean;
  hasInitialScale: boolean;
  hasUserScalable: boolean;
  userScalableValue?: string;
  hasMaximumScale: boolean;
  maximumScaleValue?: string;
}

/**
 * Parses a viewport meta tag's `content` attribute into its individual
 * directives. Four checkers (metaTags, pageQuality, mobileUX, uiElements)
 * each used to re-derive a subset of these facts by hand -- mobileUX.ts
 * checked for `maximum-scale`, uiElements.ts never did, so the same tag
 * (`maximum-scale=1`) made one checker fail on "zoom disabled" and the other
 * pass. Each checker still decides its own pass/fail *policy* from these
 * facts (they legitimately care about different directives), but none of
 * them can now be unaware a directive exists.
 */
export function parseViewportMeta(content: string | null | undefined): ViewportMeta {
  const c = content ?? '';
  return {
    hasDeviceWidth: c.includes('width=device-width'),
    hasInitialScale: c.includes('initial-scale=1'),
    hasUserScalable: c.includes('user-scalable'),
    userScalableValue: c.match(/user-scalable=([^,\s]+)/)?.[1],
    hasMaximumScale: c.includes('maximum-scale'),
    maximumScaleValue: c.match(/maximum-scale=([^,\s]+)/)?.[1],
  };
}

/** Every `<meta property="og:...">` tag, keyed by property name. */
export function extractOgTags(): Record<string, string> {
  const tags: Record<string, string> = {};
  document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
    const property = el.getAttribute('property');
    const content = el.getAttribute('content');
    if (property && content) {
      tags[property] = content;
    }
  });
  return tags;
}

/** Whether a page URL uses HTTPS. Shared so browser-side checks don't each hand-roll `window.location.protocol === 'https:'`. */
export function isHttpsUrl(url: string): boolean {
  return new URL(url).protocol === 'https:';
}

export interface DescriptiveTextResult {
  /** Number of distinct elements matched by the given selectors. */
  containerCount: number;
  text: string;
  length: number;
}

/**
 * Measures the text "near" a set of wildcard-matched containers (e.g.
 * `[id*="description"]`), not just their own descendant text. Some sites
 * name the *label* of a content section (a heading-only wrapper like
 * `<div id="product_description"><h2>Product Description</h2></div>`) and
 * put the actual text as a DOM *sibling* of that wrapper rather than a
 * child -- a plain `el.textContent` sum would then undercount the real
 * content (confirmed on books.toscrape.com: 41 chars measured vs. ~600
 * actual). When a matched element's own text looks like a bare label (under
 * `minLength`), this also pulls in its parent's other children -- deduping
 * by element so text already counted isn't counted again when multiple
 * matches share a parent or a sibling is independently matched too.
 *
 * Siblings that are themselves a *different* structured product field
 * (price, name/title, sku, brand -- via `itemprop` or a `[class*=...]`/
 * `[id*=...]` naming convention identical to the ones ecommerce.ts's other
 * checks key off) are skipped: confirmed on a real product card
 * (webscraper.io) where a genuinely short 99-char description sits next to
 * a price and title under the same wrapper -- without this exclusion, the
 * fallback would pad the count with unrelated field text (99 -> 166 chars)
 * rather than only rescuing description text that was merely misplaced.
 */
export function resolveDescriptiveText({
  selectors,
  minLength,
}: {
  selectors: string[];
  minLength: number;
}): DescriptiveTextResult {
  const seen = new Set<Element>();
  const parts: string[] = [];
  const containers = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

  for (const el of containers) {
    if (seen.has(el)) continue;
    seen.add(el);

    const ownText = el.textContent || '';
    parts.push(ownText);

    if (ownText.trim().length < minLength && el.parentElement) {
      for (const sibling of Array.from(el.parentElement.children)) {
        if (sibling === el || seen.has(sibling)) continue;

        // Skip a sibling that's itself a *different* structured product
        // field (price, name/title, sku, brand) rather than description
        // prose -- otherwise the fallback pads a genuinely short
        // description with unrelated field text instead of only rescuing
        // text that was merely misplaced (see function doc comment).
        const siblingItemprop = sibling.getAttribute('itemprop');
        const isOtherField =
          (siblingItemprop && siblingItemprop !== 'description') ||
          /\b(price|title|name|sku|brand)\b/.test((sibling.className + ' ' + sibling.id).toLowerCase());
        if (isOtherField) continue;

        seen.add(sibling);
        parts.push(sibling.textContent || '');
      }
    }
  }

  const text = parts.join(' ').trim();
  return { containerCount: containers.length, text, length: text.length };
}
