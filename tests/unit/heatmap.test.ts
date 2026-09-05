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
    // analyzeScrollDepth buckets each candidate element by its own
    // document-relative position (getBoundingClientRect().top + scrollY), not
    // by what elementsFromPoint reports at a given coordinate -- so one
    // paragraph is placed at each of the five sampled depths (0/25/50/75/100%
    // of the 5000px page) to genuinely exercise "content found at every
    // depth" rather than relying on a mocked elementsFromPoint that returns
    // the same elements regardless of position.
    const depths = [0, 1250, 2500, 3750, 5000];
    const html = depths.map((top, i) => `<p id="p${i}">${'x'.repeat(60)}</p>`).join('');
    const geometry: MockElementGeometry[] = depths.map((top, i) => ({
      selector: `#p${i}`,
      rect: { top, left: 0, width: 400, height: 20 },
    }));
    const results = await checkerFor({
      html,
      geometry,
      prepare: (doc) => {
        Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 5000, configurable: true });
      },
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

  // --- Rank-plausibility and score-stability tests -------------------------
  //
  // The tests above only assert the aggregate pass/fail of each rule, never
  // the ordinal claims or the exact weighting behind them -- so a regression
  // that silently swapped, say, the CTA class boost and the above-fold boost
  // would pass every test above unchanged. Since there's no real click/
  // attention ground truth to validate these heuristics against, the two
  // things that actually *can* be verified are: the relative ranking makes
  // sense (a real CTA should outscore a buried link), and the score doesn't
  // silently drift (pinning exact values turns an accidental weight change
  // into a visible, deliberate test update). See docs/ACCURACY_LIMITATIONS.md.

  it('ranks an above-fold colored CTA button above a below-fold plain link in the click heatmap', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: '.hero-cta', rect: { top: 50, left: 0, width: 150, height: 50 }, style: { backgroundColor: 'rgb(0,0,255)' } },
      { selector: '.footer-link', rect: { top: 5000, left: 0, width: 40, height: 20 } },
    ];
    const results = await checkerFor({
      html: '<button class="hero-cta">Buy now</button><a class="footer-link" href="/terms">Terms</a>',
      geometry,
    }).checkAll();
    const points = byName(results, 'click-heatmap-generated').details?.allPoints as { element: string; value: number }[];
    const cta = points.find((p) => p.element.includes('hero-cta'))!;
    const link = points.find((p) => p.element.includes('footer-link'))!;
    expect(cta.value).toBeGreaterThan(link.value);
  });

  it('pins the click-heatmap weighting constants so an accidental swap fails loudly', async () => {
    const geometry: MockElementGeometry[] = [
      // Base (50) + above-fold (+20) only.
      { selector: '.el-a', rect: { top: 50, left: 0, width: 50, height: 20 } },
      // Base (50) + tag-is-button boost (+30) only (below fold, too small for the size boost).
      { selector: '.el-b', rect: { top: 5000, left: 0, width: 50, height: 20 } },
      // Base (50) + class="cta" boost (+30) + large-target size boost (+15) only.
      { selector: '.el-c', rect: { top: 5000, left: 0, width: 150, height: 50 } },
      // Base (50) + colored-background boost (+10) only.
      { selector: '.el-d', rect: { top: 5000, left: 0, width: 50, height: 20 }, style: { backgroundColor: 'rgb(0,0,255)' } },
    ];
    const results = await checkerFor({
      html:
        '<a class="el-a">A</a>' +
        '<button class="el-b">B</button>' +
        '<a class="el-c cta">C</a>' +
        '<a class="el-d">D</a>',
      geometry,
    }).checkAll();
    const points = byName(results, 'click-heatmap-generated').details?.allPoints as { element: string; value: number }[];
    const find = (cls: string) => points.find((p) => p.element.includes(cls))!.value;

    expect(find('el-a')).toBe(70); // 50 + 20 (above fold)
    expect(find('el-b')).toBe(80); // 50 + 30 (button tag)
    expect(find('el-c')).toBe(95); // 50 + 30 (cta class) + 15 (large target)
    expect(find('el-d')).toBe(60); // 50 + 10 (colored background)
  });

  it('ranks an above-fold H1 above a below-fold H3, and a large hero image above a small icon, in attention zones', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'h1', rect: { top: 50, left: 0, width: 600, height: 60 } },
      { selector: 'h3', rect: { top: 5000, left: 0, width: 300, height: 30 } },
      { selector: 'img.hero', rect: { top: 100, left: 0, width: 400, height: 300 } },
      { selector: 'img.icon', rect: { top: 5000, left: 0, width: 60, height: 60 } },
    ];
    const results = await checkerFor({
      html: '<h1>Hero</h1><h3>Footer note</h3><img class="hero" src="hero.jpg"><img class="icon" src="icon.png">',
      geometry,
    }).checkAll();
    const elements = byName(results, 'attention-zones-strong').details?.allAttentionElements as {
      selector: string;
      score: number;
    }[];
    const h1 = elements.find((e) => e.selector.startsWith('h1'))!;
    const h3 = elements.find((e) => e.selector.startsWith('h3'))!;
    const hero = elements.find((e) => e.selector === 'img:nth-of-type(1)')!;
    const icon = elements.find((e) => e.selector === 'img:nth-of-type(2)')!;

    expect(h1.score).toBeGreaterThan(h3.score);
    expect(hero.score).toBeGreaterThan(icon.score);
  });

  it('pins the attention-zone weighting constants for headings, images, and CTAs', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'h2', rect: { top: 5000, left: 0, width: 400, height: 40 } },
      { selector: 'h3', rect: { top: 50, left: 0, width: 300, height: 30 } },
      { selector: 'img.large', rect: { top: 5000, left: 0, width: 350, height: 250 } },
      { selector: 'img.small', rect: { top: 50, left: 0, width: 60, height: 60 } },
      {
        selector: 'button',
        rect: { top: 5000, left: 0, width: 120, height: 44 },
        style: { backgroundColor: 'rgb(0,0,255)' },
      },
      { selector: 'a.button', rect: { top: 50, left: 0, width: 120, height: 44 } },
    ];
    const results = await checkerFor({
      html:
        '<h2>Subhead</h2><h3>Footer note</h3>' +
        '<img class="large" src="a.jpg"><img class="small" src="b.jpg">' +
        '<button>Buy</button><a class="button" href="/x">Shop</a>',
      geometry,
    }).checkAll();
    const elements = byName(results, 'attention-zones-strong').details?.allAttentionElements as {
      selector: string;
      score: number;
    }[];
    const scoreOf = (selector: string) => elements.find((e) => e.selector === selector)!.score;

    expect(scoreOf('h2:nth-of-type(1)')).toBe(80); // h2 base, below fold (no +20)
    // Index is the position within the combined `h1, h2, h3` querySelectorAll
    // match (h2 is first, h3 second), not a true per-tag nth-of-type.
    expect(scoreOf('h3:nth-of-type(2)')).toBe(80); // h3 base (60) + above-fold (+20)
    expect(scoreOf('img:nth-of-type(1)')).toBe(80); // image base (50) + large-hero boost (+30), below fold
    expect(scoreOf('img:nth-of-type(2)')).toBe(70); // image base (50) + above-fold (+20), too small for hero boost
    expect(scoreOf('cta:nth-of-type(1)')).toBe(85); // cta base (70) + colored-background (+15), below fold
    expect(scoreOf('cta:nth-of-type(2)')).toBe(85); // cta base (70) + above-fold (+15), no color
  });

  it('sits right at the click-heatmap-generated distribution-count boundary', async () => {
    const linksHtml = (n: number) => Array.from({ length: n }, (_, i) => `<a href="/${i}">Link ${i}</a>`).join('');
    const geometry: MockElementGeometry[] = [{ selector: 'a', rect: { top: 50, left: 0, width: 60, height: 20 } }];

    // HEATMAP_MIN_GOOD_DISTRIBUTION_POINTS (5) is a strict ">" comparison:
    // exactly 5 points must still fail, 6 must pass.
    const atThreshold = await checkerFor({ html: linksHtml(5), geometry }).checkAll();
    expect(byName(atThreshold, 'click-heatmap-generated').passed).toBe(false);

    const overThreshold = await checkerFor({ html: linksHtml(6), geometry }).checkAll();
    expect(byName(overThreshold, 'click-heatmap-generated').passed).toBe(true);
  });

  it('sits right at the attention-zones-strong F-pattern-coverage boundary', async () => {
    const geometry: MockElementGeometry[] = [
      { selector: 'h1', rect: { top: 50, left: 0, width: 600, height: 60 } },
      { selector: 'h2', rect: { top: 150, left: 0, width: 400, height: 40 } },
      { selector: 'h3', rect: { top: 250, left: 0, width: 300, height: 30 } },
    ];

    // HEATMAP_MIN_F_PATTERN_COVERAGE (3) is a ">=" comparison against the
    // count of above-fold/hero-area elements: 2 must still fail, 3 must pass.
    const belowThreshold = await checkerFor({
      html: '<h1>Hero</h1><h2>Subhead</h2>',
      geometry,
    }).checkAll();
    expect(byName(belowThreshold, 'attention-zones-strong').passed).toBe(false);

    const atThreshold = await checkerFor({
      html: '<h1>Hero</h1><h2>Subhead</h2><h3>Third</h3>',
      geometry,
    }).checkAll();
    expect(byName(atThreshold, 'attention-zones-strong').passed).toBe(true);
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
