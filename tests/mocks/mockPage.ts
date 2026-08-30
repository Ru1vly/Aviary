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
export function createMockPage(options: MockPageOptions = {}): Partial<Page> {
  const { html = '', url = 'https://example.com', title = '', metaTags = {}, headHtml = '' } = options;

  const metaTagsHtml = Object.entries(metaTags)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, content]) =>
      name === 'canonical'
        ? `<link rel="canonical" href="${escapeAttr(content)}">`
        : `<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}">`
    )
    .join('\n');

  const documentHtml = `<!DOCTYPE html><html><head><title>${escapeText(title)}</title>${metaTagsHtml}${headHtml}</head><body>${html}</body></html>`;

  const window = new Window({ url });
  window.document.write(documentHtml);
  const doc = window.document;

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
      const previous = {
        document: (globalThis as { document?: unknown }).document,
        window: (globalThis as { window?: unknown }).window,
      };
      (globalThis as { document?: unknown }).document = doc;
      (globalThis as { window?: unknown }).window = window;
      try {
        return await (pageFunction as (arg?: unknown) => unknown)(arg);
      } finally {
        (globalThis as { document?: unknown }).document = previous.document;
        (globalThis as { window?: unknown }).window = previous.window;
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
