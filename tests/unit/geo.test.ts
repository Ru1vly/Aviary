import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, Response } from 'playwright';
import { GeoChecker } from '../../src/checkers/geo';
import { fetchRobotsPolicy } from '../../src/robots';
import type { RobotsPolicy } from '../../src/robots';
import { createMockPage } from '../mocks/mockPage';

vi.mock('../../src/robots', () => ({ fetchRobotsPolicy: vi.fn() }));

const visibleGeometry = [
  'html',
  'body',
  'main',
  'h1',
  'h2',
  'p',
  'a',
  'ul',
  'li',
  'sup',
  'time',
  '[rel="author"]',
].map((selector) => ({ selector, rect: { width: 100, height: 20 } }));

function policy(options: { allowed?: boolean; failureReason?: string } = {}): RobotsPolicy {
  return {
    allows: () => options.allowed ?? true,
    explain: (url) => ({
      allowed: options.allowed ?? true,
      matchedAgents: ['*'],
      ...(options.allowed === false
        ? { matchedRule: { directive: 'disallow' as const, pattern: '/', specificity: 1, line: 2 } }
        : { matchedRule: { directive: 'allow' as const, pattern: '/', specificity: 1, line: 2 } }),
    }),
    ...(options.failureReason ? { failureReason: options.failureReason } : {}),
  };
}

function response(html: string, headers: Record<string, string> = { 'content-type': 'text/html' }) {
  return {
    status: () => 200,
    headers: () => headers,
    text: async () => html,
  } as unknown as Response;
}

function makeChecker(
  html: string,
  options: { sourceHtml?: string; response?: Response | null } = {}
): GeoChecker {
  const page = createMockPage({
    url: 'https://aviary.test/article',
    html,
    geometry: visibleGeometry,
  });
  return new GeoChecker({
    page: page as Page,
    response:
      options.response === undefined
        ? response(options.sourceHtml ?? `<!doctype html><html><body>${html}</body></html>`)
        : options.response,
    checkerKey: 'geo',
  });
}

function byName(results: Awaited<ReturnType<GeoChecker['checkAll']>>, name: string) {
  const result = results.find((item) => item.name === name);
  if (!result) throw new Error(`No GEO result named ${name}`);
  return result;
}

describe('GeoChecker', () => {
  beforeEach(() => {
    vi.mocked(fetchRobotsPolicy).mockResolvedValue(policy());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new globalThis.Response(null, { status: 404 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Google defines none as noindex/nofollow. A parameter value is not a rule:
  // https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
  it.each([
    { directive: 'none', noindex: true, noSnippet: false, noArchive: false },
    { directive: 'max-image-preview: none', noindex: false, noSnippet: false, noArchive: false },
    { directive: 'max-image-preview:none', noindex: false, noSnippet: false, noArchive: false },
    {
      directive: 'max-image-preview: none, nosnippet',
      noindex: false,
      noSnippet: true,
      noArchive: false,
    },
    {
      directive: 'max-image-preview: none, noindex, noarchive',
      noindex: true,
      noSnippet: false,
      noArchive: true,
    },
    { directive: 'max-snippet: 0', noindex: false, noSnippet: true, noArchive: false },
  ])(
    'interprets standalone rules separately from values: $directive',
    async ({ directive, noindex, noSnippet, noArchive }) => {
      const results = await makeChecker(
        `<meta name="robots" content="${directive}"><main><p>Useful content.</p></main>`
      ).checkAll();
      const details = byName(results, 'ai-search-preview-controls').details;
      expect(details).toMatchObject({ noindex, noSnippet });
      expect(
        (details?.crawlerControls as Array<Record<string, unknown>>).every(
          (row) => row.noindex === noindex && row.noSnippet === noSnippet
        )
      ).toBe(true);
      expect(
        (details?.dataUseCrawlerControls as Array<Record<string, unknown>>).every(
          (row) => row.noindex === noindex && row.noArchive === noArchive
        )
      ).toBe(true);
    }
  );

  it('returns all GEO signals and distinguishes indexing policy from training controls', async () => {
    const results = await makeChecker(
      '<main><h1>A useful article</h1><p>Clear and informative content.</p></main>'
    ).checkAll();

    expect(results.map(({ name }) => name)).toEqual([
      'ai-search-crawler-access',
      'ai-data-use-crawler-policy',
      'ai-user-initiated-fetch-access',
      'ai-search-preview-controls',
      'answer-content-profile',
      'source-rendered-content-profile',
      'citation-evidence-profile',
      'llms-txt-convention-inventory',
    ]);
    expect(byName(results, 'ai-search-crawler-access').message).toContain('permits all 8');
    expect(byName(results, 'ai-data-use-crawler-policy').message).toContain(
      'controls are separate from search access'
    );
    expect(byName(results, 'llms-txt-convention-inventory').message).toContain(
      'Neither optional llms.txt'
    );
    expect(fetchRobotsPolicy).toHaveBeenCalledTimes(1);
  });

  it('reports question-answer, identity, author, date, and citation evidence without scoring it as a ranking', async () => {
    const html = `
      <main>
        <h1>Research summary</h1>
        <h2>How does this work?</h2>
        <p>This answer gives enough clear words to describe the method in useful detail.</p>
        <p rel="author">By Aviary Research</p>
        <time datetime="2026-10-01">October 1, 2026</time>
        <p>See <a href="https://sources.example/report">the cited research report</a>.</p>
        <sup><a href="#ref-one">[1]</a></sup>
        <h2>References</h2>
        <ul><li id="ref-one"><a href="https://sources.example/report">Research report</a></li></ul>
        <script type="application/ld+json">{"@type":"Organization","@id":"https://aviary.test/#org","name":"Aviary","sameAs":"https://social.example/aviary","author":{"@type":"Person","name":"A. Editor"},"dateModified":"2026-10-01","isAccessibleForFree":true}</script>
      </main>`;
    const result = byName(await makeChecker(html).checkAll(), 'answer-content-profile');
    const details = result.details!;

    expect(result.passed).toBe(true);
    expect(details.questionHeadings).toBe(1);
    expect(details.conciseAnswerBlocks).toBe(1);
    expect(details.visibleAuthor).toBe(true);
    expect(details.visibleDate).toBe(true);
    expect(details.schemaAuthor).toBe(true);
    expect(details.schemaDateModifiedDays).toEqual(['2026-10-01']);
    expect(details.identityEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Aviary', sameAs: ['https://social.example/aviary'] }),
      ])
    );
    expect(details.interpretation).toContain('not known requirements');

    const evidence = byName(await makeChecker(html).checkAll(), 'citation-evidence-profile');
    expect(evidence.details).toMatchObject({
      externalSourceLinkCount: 2,
      uniqueSourceHosts: 1,
      referenceSectionLinkCount: 1,
      resolvedInlineCitationTargetsWithExternalLinks: 1,
      unresolvedInlineCitationTargetCount: 0,
    });
  });

  it('measures overlap between bounded initial HTML and rendered text', async () => {
    const rendered =
      '<main><p>alpha beta gamma delta epsilon zeta eta theta iota kappa lambda</p></main>';
    const source =
      '<!doctype html><html><body><main><p>alpha beta gamma delta epsilon</p></main></body></html>';
    const result = byName(
      await makeChecker(rendered, { sourceHtml: source }).checkAll(),
      'source-rendered-content-profile'
    );

    expect(result.passed).toBe(true);
    expect(result.details).toMatchObject({
      assessed: true,
      sourceHasMainOrArticle: true,
      renderedHasMainOrArticle: true,
      sourceWordCount: 5,
      renderedWordCount: 11,
      sharedRenderedPhraseCount: 1,
      renderedPhraseCoveragePercent: 14.3,
    });
  });

  it.each([
    {
      label: 'adjacent semantic blocks',
      html: '<main><h1>alpha beta gamma</h1><p>delta epsilon zeta</p><div>eta theta iota</div></main>',
      words: 9,
    },
    {
      label: 'inline split words',
      html: '<main><p>Search op<strong>ti</strong>mization supports useful answers</p><p>for real people</p></main>',
      words: 8,
    },
    {
      label: 'line breaks and explicitly hidden text',
      html: '<main>alpha beta gamma<br>delta epsilon zeta<span hidden>secret hidden words</span></main>',
      words: 6,
    },
    {
      label: 'inert script and template content',
      html: '<main><p>alpha beta gamma delta epsilon zeta</p><script type="application/ld+json">{"name":"other tokens"}</script><template>unused text tokens</template></main>',
      words: 6,
    },
  ])('does not fabricate a content gap for $label', async ({ html, words }) => {
    const result = byName(await makeChecker(html).checkAll(), 'source-rendered-content-profile');
    expect(result.details).toMatchObject({
      sourceWordCount: words,
      renderedWordCount: words,
      renderedOnlyPhraseCount: 0,
      renderedPhraseCoveragePercent: 100,
    });
    expect(result.details?.textExtraction).toContain('inline words preserved');
  });

  it('excludes a hidden rendered addition while retaining actual added visible text', async () => {
    const original = '<main><p>alpha beta gamma delta epsilon zeta</p></main>';
    const hidden = original.replace(
      '</main>',
      '<p style="display:none">new unseen tokens</p></main>'
    );
    const hiddenProfile = byName(
      await makeChecker(hidden, { sourceHtml: original }).checkAll(),
      'source-rendered-content-profile'
    );
    expect(hiddenProfile.details).toMatchObject({
      renderedWordCount: 6,
      renderedPhraseCoveragePercent: 100,
    });
    const visible = original.replace(
      '</main>',
      '<p>new visible client words appear here</p></main>'
    );
    const visibleProfile = byName(
      await makeChecker(visible, { sourceHtml: original }).checkAll(),
      'source-rendered-content-profile'
    );
    expect(visibleProfile.details?.renderedOnlyPhraseCount).toBeGreaterThan(0);
    expect(visibleProfile.details?.renderedPhraseCoveragePercent).toBeLessThan(100);
  });

  it('does not fetch optional llms.txt files when robots policy disallows AviaryBot', async () => {
    vi.mocked(fetchRobotsPolicy).mockResolvedValue(policy({ allowed: false }));
    const fetchMock = vi.mocked(globalThis.fetch);
    const result = byName(
      await makeChecker('<main>Content</main>').checkAll(),
      'llms-txt-convention-inventory'
    );

    expect(result.passed).toBe(true);
    expect(
      (result.details?.resources as Array<Record<string, unknown>>).every(
        (item) => item.robotsAllowed === false
      )
    ).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('summarizes llms.txt content and classifies bounded inline-link targets', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new globalThis.Response(
          '# Docs\n[Guide](/guide)\n[Source](https://reference.example/a)\n[Duplicate](https://reference.example/a)\n[Email](mailto:team@example.com)',
          { status: 200, headers: { 'content-type': 'text/markdown' } }
        )
      )
      .mockResolvedValueOnce(new globalThis.Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = byName(
      await makeChecker('<main><p>Visible site content.</p></main>').checkAll(),
      'llms-txt-convention-inventory'
    );
    const resources = result.details?.resources as Array<Record<string, unknown>>;
    const llms = resources[0];

    expect(result.message).toContain('Found /llms.txt');
    expect(llms).toMatchObject({ found: true, markdownHeadingCount: 1, markdownLinkCount: 4 });
    expect(llms.linkTargetProfile).toMatchObject({
      markdownLinks: 4,
      uniqueWebTargets: 2,
      duplicateWebTargets: 1,
      sameOriginWebLinks: 1,
      externalHttpsLinks: 2,
      unsupportedSchemeLinks: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
