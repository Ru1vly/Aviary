import { Window } from 'happy-dom';
import { Page } from 'playwright';

export interface MetaTagOptions {
  description?: string;
  keywords?: string;
  viewport?: string;
  /** Becomes <link rel="canonical" href="..."> rather than a <meta> tag. */
  canonical?: string;
  robots?: string;
  [name: string]: string | undefined;
}

export interface MockPageOptions {
  /** HTML for the page <body>. */
  html?: string;
  url?: string;
  /** Sets <title>. */
  title?: string;
  /** Synthesizes <meta name="..." content="..."> tags (or <link rel="canonical"> for the 'canonical' key). */
  metaTags?: MetaTagOptions;
  /**
   * Raw markup injected into <head> as-is, for anything metaTags can't
   * express — e.g. <meta property="og:..."> tags, which use `property`
   * rather than `name`.
   */
  headHtml?: string;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build a fake Playwright Page backed by a real (happy-dom) document.
 *
 * page.evaluate() genuinely executes the given callback against that
 * document — it does not inspect the callback's source text in any way.
 * This is deliberate: an earlier version of this mock matched callbacks by
 * calling `fn.toString()` and checking whether it *contained* a configured
 * substring (e.g. 'querySelectorAll', 'og:'). That made every mock-based
 * test coupled to the literal source text of the checker's evaluate()
 * body — refactoring a checker (renaming a variable, extracting a shared
 * DOM-query helper, reformatting) could silently make a key stop matching
 * (test now gets `[]` and fails loudly) or, worse, start matching a
 * *different* configured key by accident (test silently asserts on the
 * wrong data). Running against a real DOM tests behavior, not source text,
 * so it survives exactly the kind of internal refactoring the checkers are
 * going to get.
 */
/**
 * Rects/styles to stamp onto elements after the DOM is built, keyed by a
 * `querySelectorAll` selector. happy-dom has no real layout engine — every
 * element's `getBoundingClientRect()` is `{0,0,0,0}` and `getComputedStyle()`
 * returns computed-nothing — so any checker that branches on element size or
 * position (heatmap.ts, mobileUX.ts, spamDetection.ts) needs this to exercise
 * its "found something real" branches at all, not just its zero-element ones.
 */
export interface MockElementGeometry {
  selector: string;
  rect?: Partial<{ top: number; left: number; width: number; height: number; right: number; bottom: number }>;
  style?: Partial<CSSStyleDeclaration> & Record<string, string>;
}

export interface MockPageOptions {
  /** HTML for the page <body>. */
  html?: string;
  url?: string;
  /** Sets <title>. */
  title?: string;
  /** Synthesizes <meta name="..." content="..."> tags (or <link rel="canonical"> for the 'canonical' key). */
  metaTags?: MetaTagOptions;
  /**
   * Raw markup injected into <head> as-is, for anything metaTags can't
   * express — e.g. <meta property="og:..."> tags, which use `property`
   * rather than `name`.
   */
  headHtml?: string;
  /** Per-element getBoundingClientRect()/getComputedStyle() overrides — see MockElementGeometry. */
  geometry?: MockElementGeometry[];
  /** window.innerWidth / window.innerHeight (default 1920x1080, matching SEOCheckerOptions' default viewport). */
  viewport?: { width?: number; height?: number };
  /** Attributes on the <html> element, e.g. { lang: 'en', dir: 'rtl' }. */
  htmlAttrs?: Record<string, string>;
  /**
   * Escape hatch, called with the constructed (document, window) right after
   * the DOM is built — for anything `geometry`/`htmlAttrs` doesn't cover
   * (happy-dom is missing some DOM APIs entirely, e.g. `elementsFromPoint`;
   * this is where a test polyfills them, or sets `scrollHeight`, or reaches
   * into APIs no dedicated option exists for).
   */
  prepare?: (doc: Document, win: Window) => void;
}

function applyGeometry(doc: Document, win: Window, geometry: MockElementGeometry[] = []): void {
  for (const { selector, rect, style } of geometry) {
    const elements = doc.querySelectorAll(selector);
    elements.forEach((el) => {
      if (rect) {
        const full = { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}), ...rect };
        full.right = rect.right ?? full.left + full.width;
        full.bottom = rect.bottom ?? full.top + full.height;
        (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => full as DOMRect;
      }
      if (style) {
        const computed = { backgroundColor: '', ...style } as CSSStyleDeclaration;
        (win as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle =
          new Proxy((win as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle, {
            apply(target, thisArg, args) {
              if (args[0] === el) return computed;
              return Reflect.apply(target, thisArg, args);
            },
          });
      }
    });
  }
}

export function createMockPage(options: MockPageOptions = {}): Partial<Page> {
  const { html = '', url = 'https://example.com', title = '', metaTags = {}, headHtml = '', geometry, viewport, htmlAttrs = {}, prepare } =
    options;

  const metaTagsHtml = Object.entries(metaTags)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, content]) =>
      name === 'canonical'
        ? `<link rel="canonical" href="${escapeAttr(content)}">`
        : `<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}">`
    )
    .join('\n');

  const htmlAttrsStr = Object.entries(htmlAttrs)
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join('');

  const documentHtml = `<!DOCTYPE html><html${htmlAttrsStr}><head><title>${escapeText(title)}</title>${metaTagsHtml}${headHtml}</head><body>${html}</body></html>`;

  const window = new Window({
    url,
    innerWidth: viewport?.width ?? 1920,
    innerHeight: viewport?.height ?? 1080,
  });
  window.document.write(documentHtml);
  const doc = window.document;
  if (geometry) applyGeometry(doc as unknown as Document, window as unknown as Window, geometry);
  if (prepare) prepare(doc as unknown as Document, window as unknown as Window);

  const mockPage: Partial<Page> = {
    title: async () => doc.title,
    url: () => url,
    content: async () => doc.documentElement.outerHTML,

    // Real Playwright's evaluate(pageFunction, arg?) takes at most one
    // serializable argument — matched here rather than the previous
    // mock's non-standard variadic (...args) signature, which no checker
    // actually relied on (every evaluate() call site in src/checkers/
    // passes a zero-argument closure).
    evaluate: (async (pageFunction: unknown, arg?: unknown) => {
      if (typeof pageFunction !== 'function') {
        throw new Error('mockPage.evaluate: only function page functions are supported');
      }

      // page.evaluate() callbacks reference `document`/`window` as ambient
      // globals (as they would running in a real page's JS context, a
      // separate process from the Node process in real Playwright) rather
      // than as parameters, so they're installed as temporary globals here
      // and restored afterwards. This mock is not safe for evaluate() calls
      // against two different mock pages running concurrently within the
      // same test file (a real risk only if a test uses `.concurrent` or
      // fires multiple evaluate() calls via Promise.all across different
      // mock instances) — none of the current tests do either.
      const globals = globalThis as Record<string, unknown>;
      const previous = {
        document: globals.document,
        window: globals.window,
        getComputedStyle: globals.getComputedStyle,
        performance: globals.performance,
      };
      globals.document = doc;
      globals.window = window;
      // Real pages expose these as bare globals (not just window.X), and
      // checker evaluate() bodies call them unqualified — mirrored here so
      // e.g. heatmap.ts's getComputedStyle(el) and resourceOptimization.ts's
      // performance.getEntriesByType(...) don't throw "not defined".
      globals.getComputedStyle = (window as unknown as { getComputedStyle: unknown }).getComputedStyle;
      globals.performance = (window as unknown as { performance: unknown }).performance;
      try {
        return await (pageFunction as (arg?: unknown) => unknown)(arg);
      } finally {
        globals.document = previous.document;
        globals.window = previous.window;
        globals.getComputedStyle = previous.getComputedStyle;
        globals.performance = previous.performance;
      }
    }) as Page['evaluate'],

    $: async () => null,
    $$: async () => [],
    waitForSelector: async () => null as never,
    waitForLoadState: async () => {},
    goto: async () => null as never,
  };

  return mockPage;
}

export function createMockPageWithMetaTags(metaTags: MetaTagOptions): Partial<Page> {
  return createMockPage({ metaTags });
}

export function createMockPageWithTitle(title: string): Partial<Page> {
  return createMockPage({ title });
}
