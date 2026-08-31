import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { HeatmapChecker } from '../../src/checkers/heatmap';
import { createMockPage, MockPageOptions, MockElementGeometry } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): HeatmapChecker {
  const page = createMockPage(opts);
  return new HeatmapChecker({ page: page as Page, checkerKey: 'heatmap' });
}

function byName(results: Awaited<ReturnType<HeatmapChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

/** Polyfills happy-dom's missing elementsFromPoint so analyzeScrollDepth doesn't throw. */
function withScrollDepthSupport(returnHasContent: boolean) {
  return (doc: Document) => {
    (doc as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = () =>
      returnHasContent ? Array.from(doc.querySelectorAll('h1, p')) : [];
    Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 5000, configurable: true });
  };
}

describe('HeatmapChecker', () => {
  it('generates a click heatmap from real interactive-element geometry (above and below fold)', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'button, a', rect: { top: 100, left: 100, width: 120, height: 44 } },
    ];
    const html = Array.from({ length: 6 }, (_, i) => `<a href="/${i}" class="btn">Link ${i}</a>`).join('');
    const results = await checkerFor({ html, geometry, prepare: withScrollDepthSupport(true) }).checkAll();
    const click = byName(results, 'click-heatmap-generated');
    expect(click.passed).toBe(true);
    expect(click.details?.totalPoints).toBe(6);
  });

  it('reports low interactive element count below the distribution threshold', async () => {
    const geometry: MockElementGeometry[] = [{ selector: 'a', rect: { top: 100, left: 100, width: 120, height: 44 } }];
    const results = await checkerFor({
      html: '<a href="/1">One</a>',
      geometry,
      prepare: withScrollDepthSupport(true),
    }).checkAll();
    expect(byName(results, 'click-heatmap-generated').passed).toBe(false);
  });

  it('flags a page whose scroll ratio is outside the reasonable range', async () => {
    const results = await checkerFor({
      html: '<p>short</p>',
      prepare: (doc) => {
        (doc as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => [];
        Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 100, configurable: true });
      },
    }).checkAll();
    expect(byName(results, 'scroll-depth-reasonable').passed).toBe(false);
  });

  it('passes scroll-depth-reasonable for a page within the ratio band with content at every depth', async () => {
    const results = await checkerFor({
      html: '<h1>Title</h1><p>' + 'x'.repeat(60) + '</p>',
      prepare: withScrollDepthSupport(true),
    }).checkAll();
    const scroll = byName(results, 'scroll-depth-reasonable');
    expect(scroll.passed).toBe(true);
    expect((scroll.details?.hasEvenContentDistribution as boolean)).toBe(true);
  });

  it('finds strong attention zones from headings, a hero image, and a CTA above the fold', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'h1', rect: { top: 50, left: 0, width: 600, height: 60 } },
      { selector: 'h2', rect: { top: 150, left: 0, width: 400, height: 40 } },
      { selector: 'img', rect: { top: 200, left: 0, width: 350, height: 250 } },
      { selector: 'button', rect: { top: 500, left: 0, width: 120, height: 44 }, style: { backgroundColor: 'rgb(0,0,255)' } },
    ];
    const results = await checkerFor({
      html: '<h1>Hero</h1><h2>Subhead</h2><img src="hero.jpg"><button>Buy Now</button>',
      geometry,
      prepare: withScrollDepthSupport(true),
    }).checkAll();
    expect(byName(results, 'attention-zones-strong').passed).toBe(true);
  });

  it('flags weak attention zones with no prominent above-fold elements', async () => {
    const results = await checkerFor({ html: '<p>plain text, no headings</p>' }).checkAll();
    expect(byName(results, 'attention-zones-strong').passed).toBe(false);
  });

  it('finds a primary CTA above the fold', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'button', rect: { top: 100, left: 100, width: 150, height: 44, right: 250, bottom: 144 } },
    ];
    const results = await checkerFor({ html: '<button class="btn-primary">Buy</button>', geometry }).checkAll();
    const cta = byName(results, 'cta-above-fold');
    expect(cta.passed).toBe(true);
    expect(cta.message).toMatch(/primary cta found/i);
  });

  it('reports no CTAs when none are present, and below-fold CTAs when off-screen', async () => {
    const none = await checkerFor({ html: '<p>no buttons here</p>' }).checkAll();
    expect(byName(none, 'cta-above-fold').message).toMatch(/no ctas detected/i);

    const geometry: MockElementGeometry[] = [
      { selector: 'button', rect: { top: 5000, left: 100, width: 150, height: 44, right: 250, bottom: 5044 } },
    ];
    const belowFold = await checkerFor({ html: '<button>Buy</button>', geometry }).checkAll();
    expect(byName(belowFold, 'cta-above-fold').message).toMatch(/below fold/i);
  });

  it('rates above-fold content as strong when H1, hero image, CTA, and value prop are all present', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'h1', rect: { top: 50, left: 0, width: 600, height: 60, bottom: 110 } },
      { selector: 'img', rect: { top: 150, left: 0, width: 350, height: 250 } },
      { selector: 'button', rect: { top: 450, left: 0, width: 120, height: 44 } },
      { selector: 'h2', rect: { top: 500, left: 0, width: 400, height: 40 } },
    ];
    const results = await checkerFor({
      html: '<h1>Big Headline</h1><img src="hero.jpg"><button>Get Started</button><h2>A compelling value proposition here</h2>',
      geometry,
    }).checkAll();
    expect(byName(results, 'above-fold-content-strong').passed).toBe(true);
  });

  it('rates above-fold content as weak on a mostly empty page', async () => {
    const results = await checkerFor({ html: '<p>nothing much</p>' }).checkAll();
    expect(byName(results, 'above-fold-content-strong').passed).toBe(false);
  });

  it('honors a rule-option override for cta-above-fold', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'button', rect: { top: 100, left: 100, width: 150, height: 44, right: 250, bottom: 144 } },
    ];
    const page = createMockPage({ html: '<button>Buy</button>', geometry });
    const checker = new HeatmapChecker({
      page: page as Page,
      checkerKey: 'heatmap',
      config: { rules: { heatmap: { 'click-heatmap-generated': { enabled: false } } } },
    });
    const results = await checker.checkAll();
    expect(results.find((r) => r.name === 'click-heatmap-generated')).toBeUndefined();
  });

  it('respects HeatmapOptions to include only a subset of checks', async () => {
    const page = createMockPage({ html: '<p>x</p>' });
    const checker = new HeatmapChecker({
      page: page as Page,
      checkerKey: 'heatmap',
      options: { includeClickMap: false, includeScrollMap: false, includeAttentionMap: false },
    });
    const results = await checker.checkAll();
    expect(results.map((r) => r.name).sort()).toEqual(['above-fold-content-strong', 'cta-above-fold']);
  });
});
