import { describe, expect, it } from 'vitest';
import type { AiAnswerCitationObservationInput } from '../../src/geo/answerCitationObservations';
import {
  assessAiAnswerCitationPagePairedReachDropGate,
  compareAiAnswerCitationPagePairedReach,
  renderAiAnswerCitationPagePairedReachComparisonCsv,
  renderAiAnswerCitationPagePairedReachComparisonJson,
  renderAiAnswerCitationPagePairedReachDropGateJson,
} from '../../src/geo/answerCitationPagePairedReach';

const targetUrl = 'https://example.com/article';

function observation(
  prompt: string,
  citedUrls: string[],
  citationListComplete = true,
  provider = 'Search'
): AiAnswerCitationObservationInput {
  return {
    observedAt: '2026-09-01T12:00:00.000Z',
    provider,
    prompt,
    citedUrls,
    citationListComplete,
  };
}

function repeatedDropSamples(promptCount: number) {
  const prompts = Array.from({ length: promptCount }, (_, index) => `prompt ${index + 1}`);
  return {
    baseline: prompts.map((prompt) => observation(prompt, [targetUrl])),
    current: prompts.map((prompt) => observation(prompt, [])),
  };
}

describe('AI answer page paired reach', () => {
  it('normalizes prompt, provider, and cited URL keys and compares each reach endpoint', () => {
    const comparison = compareAiAnswerCitationPagePairedReach(
      [
        observation('  Brand   comparison ', ['https://EXAMPLE.com./article?new=1#current']),
        observation('product guide', ['https://other.example/source']),
        observation('third prompt', [targetUrl]),
      ],
      [
        observation('brand comparison', ['https://example.com/article?old=1'], true, ' search '),
        observation('product   guide', [targetUrl], true, 'search'),
        observation('third prompt', [targetUrl], true, 'SEARCH'),
      ]
    );

    expect(comparison.pageScope).toBe('all-cited-pages');
    expect(comparison.familyComplete).toBe(true);
    expect(comparison.bootstrapResamplesPerTest).toBe(1000);
    const row = comparison.rows.find((candidate) => candidate.pageUrl === targetUrl);
    expect(row).toMatchObject({
      provider: ' search ',
      sharedPromptGroups: 3,
      comparablePromptGroups: 3,
      baselinePresent: 3,
      currentPresent: 2,
      lost: 1,
      baselineFirstPositionPresent: 3,
      currentFirstPositionPresent: 2,
      baselineReachPercent: 100,
      currentReachPercent: 66.67,
      reachChangePercentagePoints: -33.33,
      comparisonComplete: true,
    });
    expect(row?.bootstrapInterval).not.toBeNull();
    expect(row?.topThreeBootstrapInterval).not.toBeNull();
    expect(row?.firstPositionBootstrapInterval).not.toBeNull();
  });

  it('keeps absent pages unknown when a repeated capture has an incomplete citation list', () => {
    const comparison = compareAiAnswerCitationPagePairedReach(
      [
        observation('shared page', [targetUrl]),
        observation('uncertain page', ['https://outside.example/source'], false),
      ],
      [
        observation('shared page', [targetUrl]),
        observation('uncertain page', ['https://outside.example/source']),
      ]
    );

    const row = comparison.rows.find((candidate) => candidate.pageUrl === targetUrl);
    expect(row).toMatchObject({
      comparablePromptGroups: 1,
      unknownPagePromptGroups: 1,
      comparisonComplete: false,
      holmAdjustedPValue: null,
    });
    expect(comparison.familyComplete).toBe(false);
    expect(comparison.familySize).toBeNull();
  });

  it('limits normalized output to owned domains and their subdomains', () => {
    const observations = [
      observation('owned root', ['https://www.example.com/article']),
      observation('owned subdomain', ['https://shop.example.com/product']),
      observation('similar but external', ['https://notexample.com/article']),
    ];
    const comparison = compareAiAnswerCitationPagePairedReach(observations, observations, [
      ' .EXAMPLE.com. ',
    ]);

    expect(comparison.pageScope).toBe('owned-pages');
    expect(comparison.rows.map((row) => row.pageUrl)).toEqual([
      'https://shop.example.com/product',
      'https://www.example.com/article',
    ]);
    expect(comparison.rows).toHaveLength(2);
  });

  it('fails a supported, complete citation-reach loss and serializes the assessment', () => {
    const { baseline, current } = repeatedDropSamples(10);
    const comparison = compareAiAnswerCitationPagePairedReach(current, baseline);
    const assessment = assessAiAnswerCitationPagePairedReachDropGate(
      comparison,
      50,
      0.01,
      10,
      'citation-reach'
    );

    expect(assessment).toMatchObject({
      pageScope: 'all-cited-pages',
      metric: 'citation-reach',
      complete: true,
      exceeded: true,
      evaluatedComparisons: 1,
      eligibleComparisons: 1,
      failures: [
        {
          pageUrl: targetUrl,
          comparablePromptGroups: 10,
          gainedPrompts: 0,
          lostPrompts: 10,
          reachChangePercentagePoints: -100,
        },
      ],
    });
    expect(assessment.failures[0]?.holmAdjustedPValue).toBeCloseTo(0.001953125);

    const json = JSON.parse(renderAiAnswerCitationPagePairedReachDropGateJson(assessment));
    expect(json).toMatchObject({
      schemaVersion: 1,
      complete: true,
      exceeded: true,
      metric: 'citation-reach',
    });
  });

  it('uses endpoint-specific gate metrics and reports insufficient support without failing', () => {
    const { baseline, current } = repeatedDropSamples(1);
    const comparison = compareAiAnswerCitationPagePairedReach(current, baseline);
    const assessment = assessAiAnswerCitationPagePairedReachDropGate(
      comparison,
      10,
      0.05,
      2,
      'top-three-reach'
    );

    expect(assessment.metric).toBe('top-three-reach');
    expect(assessment.complete).toBe(false);
    expect(assessment.exceeded).toBe(false);
    expect(assessment.eligibleComparisons).toBe(0);
    expect(assessment.incompleteReasons).toContain(
      'no complete page/provider comparison meets the 2-prompt support floor'
    );
  });

  it('renders headered CSV and typed JSON while escaping spreadsheet formulas', () => {
    const { baseline, current } = repeatedDropSamples(1);
    baseline[0]!.provider = '=SUM(1,1)';
    current[0]!.provider = '=SUM(1,1)';
    const comparison = compareAiAnswerCitationPagePairedReach(current, baseline);
    const csv = renderAiAnswerCitationPagePairedReachComparisonCsv(comparison);
    const json = JSON.parse(renderAiAnswerCitationPagePairedReachComparisonJson(comparison));

    expect(csv.startsWith('"row_type","page_scope","provider","page_url",')).toBe(true);
    expect(csv).toContain("'=SUM(1,1)");
    expect(json).toMatchObject({
      source: 'Aviary paired answer citation page reach comparison',
      schemaVersion: 1,
      pageScope: 'all-cited-pages',
      rows: [{ provider: '=SUM(1,1)', page_url: targetUrl }],
    });
  });

  it('rejects malformed observations, cited URLs, owned domains, and gate bounds', () => {
    expect(() => compareAiAnswerCitationPagePairedReach([{} as never], [])).toThrow(
      'Observation 1 is invalid for page paired-reach analysis.'
    );
    expect(() =>
      compareAiAnswerCitationPagePairedReach([observation('p', ['ftp://example.com'])], [])
    ).toThrow('Cited page URLs must be credential-free HTTP(S) URLs.');
    expect(() => compareAiAnswerCitationPagePairedReach([], [], ['example.com/path'])).toThrow(
      'Invalid owned domain "example.com/path"'
    );

    const comparison = compareAiAnswerCitationPagePairedReach([], []);
    expect(() => assessAiAnswerCitationPagePairedReachDropGate(comparison, -1)).toThrow(
      'Page paired-reach drop threshold must be between 0 and 100 percentage points.'
    );
    expect(() => assessAiAnswerCitationPagePairedReachDropGate(comparison, 10, 0)).toThrow(
      'Page paired-reach alpha must be greater than 0 and at most 1.'
    );
    expect(() => assessAiAnswerCitationPagePairedReachDropGate(comparison, 10, 0.05, 1)).toThrow(
      'Page paired-reach minimum comparable prompts must be an integer from 2 to 100000.'
    );
    expect(() =>
      assessAiAnswerCitationPagePairedReachDropGate(
        comparison,
        10,
        0.05,
        10,
        'unsupported' as never
      )
    ).toThrow(
      'Page paired-reach metric must be citation-reach, top-three-reach, or first-position-reach.'
    );
  });
});
