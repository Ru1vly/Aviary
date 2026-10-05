#!/usr/bin/env node
// Source-derived expectations, real HTTP responses and Chromium; no mocked checker internals.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { GeoChecker } from '../dist/checkers/geo.js';
import { calculateWeightedScore } from '../dist/scoring.js';
import {
  parseBingAiPerformanceCsvExport,
  summarizeBingAiPerformanceExport,
  compareBingAiPageCitationExports,
} from '../dist/geo/bingAiPerformance.js';
import {
  parseGoogleAiPerformanceCsvExport,
  summarizeGoogleAiPerformanceExport,
  compareGoogleAiPerformanceExports,
} from '../dist/geo/googleAiPerformance.js';

const sources = {
  google: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide',
  googleControls: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
  htmlText: 'https://html.spec.whatwg.org/multipage/dom.html#the-innertext-idl-attribute',
  googleMetrics: 'https://support.google.com/webmasters/answer/16984139?hl=en',
  openai: 'https://developers.openai.com/api/docs/bots',
  bing: 'https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/',
  bingControls:
    'https://blogs.bing.com/webmaster/2025/10/Bing-Introduces-Support-for-the-data-nosnippet-HTML-Attribute/',
  bingPreviews:
    'https://blogs.bing.com/webmaster/2020/4/Announcing-new-options-for-webmasters-to-control-their-snippets-at-Bing/',
  bingShare:
    'https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/',
};
const outputDirectory = path.resolve(process.argv[2] ?? 'reports/geo-output-validation');
const checks = [];
const raw = [];
const plainBody =
  '<main><p>One clear factual explanation for people visiting this page.</p></main>';
let activeFixture;
const server = createServer((request, response) => {
  if (request.url === '/robots.txt') {
    response.writeHead(activeFixture.robotsStatus ?? 200, { 'content-type': 'text/plain' });
    response.end(activeFixture.robots ?? 'User-agent: *\nAllow: /\n');
  } else if (request.url === '/llms.txt' || request.url === '/llms-full.txt') {
    response.writeHead(404);
    response.end();
  } else {
    response.writeHead(activeFixture.status ?? 200, {
      'content-type': 'text/html',
      ...(activeFixture.headers ?? {}),
    });
    response.end(
      `<!doctype html><html lang="en"><head><title>Validation</title>${activeFixture.head ?? ''}</head><body>${activeFixture.body ?? plainBody}</body></html>`
    );
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const check = (results, name) => {
  const result = results.find((value) => value.name === name);
  assert.ok(result, `Missing ${name}`);
  return result;
};
const preview = (results) => check(results, 'ai-search-preview-controls').details;
const fixtures = [
  {
    id: 'clean-without-ai-markup',
    source: 'google',
    expected:
      'Missing llms.txt, schema and question headings do not fail the audit; 100 is only a check score.',
    verify(results) {
      assert.equal(calculateWeightedScore(results), 100);
      assert.equal(check(results, 'answer-content-profile').details.questionHeadings, 0);
      assert.match(
        check(results, 'llms-txt-convention-inventory').message,
        /not a search requirement/
      );
    },
  },
  {
    id: 'none-is-not-nosnippet',
    source: 'googleControls',
    expected: 'none implies noindex/nofollow, not a separately declared nosnippet.',
    head: '<meta name="robots" content="none">',
    verify(results) {
      assert.equal(preview(results).noindex, true);
      assert.equal(preview(results).noSnippet, false);
    },
  },
  {
    id: 'image-none-is-not-noindex',
    source: 'bingPreviews',
    expected: 'The value none in max-image-preview must not prohibit indexing or text snippets.',
    head: '<meta name="robots" content="max-image-preview: none">',
    verify(results) {
      assert.equal(preview(results).noindex, false);
      assert.equal(preview(results).noSnippet, false);
    },
  },
  {
    id: 'scoped-header',
    source: 'googleControls',
    expected: 'Googlebot-scoped X-Robots-Tag restrictions do not leak to OAI-SearchBot.',
    headers: { 'x-robots-tag': 'Googlebot: noindex, nosnippet' },
    verify(results) {
      const rows = preview(results).crawlerControls;
      assert.equal(rows.find((row) => row.token === 'Googlebot').noindex, true);
      assert.equal(rows.find((row) => row.token === 'OAI-SearchBot').noindex, false);
      assert.equal(rows.find((row) => row.token === 'OAI-SearchBot').noSnippet, false);
    },
  },
  {
    id: 'max-snippet-zero',
    source: 'googleControls',
    expected: 'max-snippet: 0 declares a text-snippet restriction.',
    head: '<meta name="robots" content="max-snippet: 0">',
    verify(results) {
      assert.equal(preview(results).maxSnippetZero, true);
      assert.equal(preview(results).noSnippet, true);
    },
  },
  {
    id: 'training-opt-out-search-permitted',
    source: 'openai',
    expected: 'Blocking GPTBot does not block OAI-SearchBot.',
    robots: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n',
    verify(results) {
      assert.equal(
        check(results, 'ai-search-crawler-access').details.crawlers.find(
          (row) => row.token === 'OAI-SearchBot'
        ).allowed,
        true
      );
      assert.equal(
        check(results, 'ai-data-use-crawler-policy').details.crawlers.find(
          (row) => row.token === 'GPTBot'
        ).allowed,
        false
      );
    },
  },
  {
    id: 'search-opt-out-training-permitted',
    source: 'openai',
    expected: 'Blocking OAI-SearchBot is reported independently from GPTBot.',
    robots: 'User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n',
    verify(results) {
      assert.equal(
        check(results, 'ai-search-crawler-access').details.crawlers.find(
          (row) => row.token === 'OAI-SearchBot'
        ).allowed,
        false
      );
      assert.equal(
        check(results, 'ai-data-use-crawler-policy').details.crawlers.find(
          (row) => row.token === 'GPTBot'
        ).allowed,
        true
      );
    },
  },
  {
    id: 'boolean-nosnippet-and-nesting',
    source: 'googleControls',
    expected: 'A false attribute value still marks a region; nested text is counted once.',
    body: '<main><section data-nosnippet="false">one two <div data-nosnippet>three four</div></section><p>five six</p></main>',
    verify(results) {
      assert.equal(preview(results).dataNoSnippetElements, 2);
      assert.equal(preview(results).dataNoSnippetWords, 4);
      assert.equal(preview(results).dataNoSnippetWordSharePercent, 66.7);
    },
  },
  {
    id: 'provider-specific-nosnippet-elements',
    source: 'bingControls',
    expected:
      'A marked p is inventoried for Bing, but Google element support must be stated explicitly.',
    body: '<main><p data-nosnippet>one two three four</p></main>',
    verify(results) {
      assert.equal(preview(results).dataNoSnippetWords, 4);
      assert.match(preview(results).interpretation ?? '', /Google.*span.*div.*section/);
    },
  },
  {
    id: 'javascript-is-not-citation-ineligibility',
    source: 'google',
    expected:
      'Rendered-only text produces low phrase overlap, without declaring a crawler incapable of indexing it.',
    body: '<main id="content"></main><script>document.getElementById("content").textContent="Distinct useful words are added by JavaScript for real human visitors";</script>',
    verify(results) {
      const parity = check(results, 'source-rendered-content-profile');
      assert.equal(parity.passed, true);
      assert.equal(parity.details.renderedPhraseCoveragePercent, 0);
      assert.match(parity.details.interpretation, /does not identify/);
    },
  },
  {
    id: 'adjacent-blocks-are-not-client-content',
    source: 'htmlText',
    expected: 'Identical source and rendered adjacent blocks have full normalized phrase overlap.',
    body: '<main><h1>alpha beta gamma</h1><p>delta epsilon zeta</p><div>eta theta iota</div></main>',
    verify(results) {
      const parity = check(results, 'source-rendered-content-profile').details;
      assert.equal(parity.renderedPhraseCoveragePercent, 100);
      assert.equal(parity.sourceWordCount, 9);
      assert.equal(parity.renderedWordCount, 9);
    },
  },
  {
    id: 'inline-split-words-stay-intact',
    source: 'htmlText',
    expected: 'Inline markup inside a word does not create fake words or a source/render gap.',
    body: '<main><p>Search op<strong>ti</strong>mization supports useful answers</p><p>for real people</p></main>',
    verify(results) {
      const parity = check(results, 'source-rendered-content-profile').details;
      assert.equal(parity.renderedPhraseCoveragePercent, 100);
      assert.equal(parity.sourceWordCount, 8);
      assert.equal(parity.renderedWordCount, 8);
    },
  },
  {
    id: 'css-layout-is-not-added-text',
    source: 'htmlText',
    expected: 'CSS-only block layout on inline elements does not imply text added by JavaScript.',
    head: '<style>.line { display: block; }</style>',
    body: '<main><h1><span class="line">alpha beta gamma</span><span class="line">delta epsilon zeta</span></h1><p>eta theta iota</p></main>',
    verify(results) {
      assert.equal(
        check(results, 'source-rendered-content-profile').details.renderedPhraseCoveragePercent,
        100
      );
    },
  },
  {
    id: 'hidden-client-text-is-not-visible-content',
    source: 'htmlText',
    expected: 'A client-added display:none paragraph is excluded from the rendered comparison.',
    body: '<main><p>alpha beta gamma delta epsilon zeta</p></main><script>const p=document.createElement("p"); p.style.display="none"; p.textContent="unrelated secret words not shown to people"; document.querySelector("main").append(p);</script>',
    verify(results) {
      const parity = check(results, 'source-rendered-content-profile').details;
      assert.equal(parity.renderedPhraseCoveragePercent, 100);
      assert.equal(parity.renderedWordCount, 6);
    },
  },
  {
    id: 'line-breaks-and-hidden-markup',
    source: 'htmlText',
    expected: 'Line breaks separate words; explicitly hidden and inert text is not counted.',
    body: '<main>alpha beta gamma<br>delta epsilon zeta<span hidden>not visible words</span><script type="application/ld+json">{"name":"irrelevant tokens"}</script><template>not rendered template words</template></main>',
    verify(results) {
      const parity = check(results, 'source-rendered-content-profile').details;
      assert.equal(parity.renderedPhraseCoveragePercent, 100);
      assert.equal(parity.sourceWordCount, 6);
      assert.equal(parity.renderedWordCount, 6);
    },
  },
  {
    id: 'removed-text-is-directional-coverage',
    source: 'htmlText',
    expected:
      'Removing source text does not imply rendered-only content; word counts expose removal.',
    body: '<main><p>alpha beta gamma delta epsilon zeta</p><p id="removed">these extra words disappear after rendering</p></main><script>document.getElementById("removed").remove();</script>',
    verify(results) {
      const parity = check(results, 'source-rendered-content-profile').details;
      assert.equal(parity.renderedPhraseCoveragePercent, 100);
      assert.equal(parity.renderedWordCount, 6);
      assert.equal(parity.sourceWordCount, 12);
    },
  },
  {
    id: 'unavailable-robots-is-not-confirmed-block',
    source: 'openai',
    expected:
      'HTTP 503 for robots.txt produces unassessed access, without inventing bot decisions.',
    robotsStatus: 503,
    verify(results) {
      const access = check(results, 'ai-search-crawler-access');
      assert.equal(access.passed, false);
      assert.equal(access.details.crawlers, undefined);
      assert.match(access.message, /could not be read/);
    },
  },
  {
    id: 'http-error-is-not-clean-eligibility',
    source: 'google',
    expected: 'A 404 response is visible in the preview-control assessment.',
    status: 404,
    verify(results) {
      assert.equal(check(results, 'ai-search-preview-controls').passed, false);
      assert.equal(preview(results).responseStatus, 404);
    },
  },
  {
    id: 'citation-count-is-not-claim-verification',
    source: 'bing',
    expected:
      'Three linked authorities are counted, without asserting that they support an intentionally false claim.',
    body: `<main><p>The moon is made of cheese.</p>${['google', 'openai', 'bing'].map((key) => `<a href="${sources[key]}">${key}</a>`).join(' ')}</main>`,
    verify(results) {
      const evidence = check(results, 'citation-evidence-profile');
      assert.equal(calculateWeightedScore(results), 100);
      assert.equal(evidence.details.externalSourceLinkCount, 3);
      assert.match(
        evidence.details.interpretation,
        /does not verify source quality, claim support/
      );
    },
  },
];

function record(id, source, expected, output, verify) {
  raw.push({
    id,
    ...(Array.isArray(output) ? { checkScore: calculateWeightedScore(output) } : {}),
    output,
  });
  try {
    verify(output);
    checks.push({ id, source: sources[source], expected, passed: true });
  } catch (error) {
    checks.push({ id, source: sources[source], expected, passed: false, failure: error.message });
  }
}

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // External citations are inert links. All browser/fetch fixture traffic stays on loopback.
  await page.route('**/*', (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort()
  );
  for (const fixture of fixtures) {
    activeFixture = fixture;
    const response = await page.goto(`${origin}/${fixture.id}`, { waitUntil: 'load' });
    const results = await new GeoChecker({ page, response, checkerKey: 'geo' }).checkAll();
    record(fixture.id, fixture.source, fixture.expected, results, fixture.verify);
  }

  const bing = parseBingAiPerformanceCsvExport(
    'Query,Citations,Citation Share\nfirst,2,20%\nsecond,8,80%'
  );
  record(
    'bing-share-must-be-a-percentage',
    'bingShare',
    'A 120% citation share is invalid and must remain unmeasured while valid citation counts are preserved.',
    parseBingAiPerformanceCsvExport('Query,Citations,Citation Share\nfirst,2,120%'),
    (exportData) => {
      assert.equal(exportData.rows[0].citations, 2);
      assert.equal(exportData.rows[0].citationShare, undefined);
    }
  );
  record(
    'bing-export-row-semantics',
    'bing',
    'Citation rows sum to 10; share means equal-weight rows (50%), not global citation share.',
    summarizeBingAiPerformanceExport(bing),
    (summary) => {
      assert.equal(summary.totalCitations, 10);
      assert.equal(summary.averageCitationShare, 50);
      assert.match(summary.note, /not complete counts/);
      assert.match(summary.note, /unweighted/);
    }
  );
  record(
    'bing-missing-page-is-not-zero',
    'bing',
    'A page missing from one export has an unknown period metric.',
    compareBingAiPageCitationExports(
      parseBingAiPerformanceCsvExport('URL,Citations\nhttps://example.com/a,2'),
      parseBingAiPerformanceCsvExport('URL,Citations\nhttps://example.com/b,8')
    ),
    (comparison) => {
      assert.ok(comparison.changes.every((row) => row.citationChange === undefined));
    }
  );
  const google = parseGoogleAiPerformanceCsvExport(
    'Page,Impressions\nhttps://example.com/a,3\nhttps://example.com/b,7'
  );
  record(
    'google-page-rows-not-property-total',
    'googleMetrics',
    'Page impressions sum to 10 in this export; views must stay separate and there is no click metric.',
    summarizeGoogleAiPerformanceExport(google),
    (summary) => {
      assert.equal(summary.rowSummedImpressions, 10);
      assert.match(summary.note, /different aggregation scopes and must not be added together/);
      assert.equal(summary.clicks, undefined);
    }
  );
  record(
    'google-missing-page-is-not-zero',
    'googleMetrics',
    'A missing page does not prove lost visibility.',
    compareGoogleAiPerformanceExports(
      parseGoogleAiPerformanceCsvExport('Page,Impressions\nhttps://example.com/b,9'),
      google
    ),
    (comparison) => {
      const missing = comparison.changes.find((row) => row.url === 'https://example.com/a');
      assert.equal(missing.currentImpressions, undefined);
      assert.equal(missing.impressionsChange, undefined);
    }
  );
  await mkdir(outputDirectory, { recursive: true });
  const assessment = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    scope:
      'Controlled fixtures and source-derived semantic checks; not a population accuracy estimate or live-provider citation benchmark.',
    sources,
    total: checks.length,
    passed: checks.filter((row) => row.passed).length,
    checks,
  };
  await writeFile(
    path.join(outputDirectory, 'assessment.json'),
    `${JSON.stringify(assessment, null, 2)}\n`
  );
  await writeFile(
    path.join(outputDirectory, 'raw-outputs.json'),
    `${JSON.stringify(raw, null, 2)}\n`
  );
  console.log(
    `${assessment.passed}/${assessment.total} source-derived output checks passed. Evidence: ${outputDirectory}`
  );
  for (const row of checks.filter((row) => !row.passed)) console.error(`${row.id}: ${row.failure}`);
  if (assessment.passed !== assessment.total) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}
