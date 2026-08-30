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
