import { describe, expect, it } from 'vitest';
import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProfile,
} from '../../src/geo/answerCitationObservations';
import {
  analyzeAiAnswerCitationPromptFamilyPartition,
  renderAiAnswerCitationPromptFamiliesCsv,
  renderAiAnswerCitationPromptFamiliesHtml,
  renderAiAnswerCitationPromptFamilyInfluenceCsv,
  renderAiAnswerCitationPromptFamilyInfluenceHtml,
  renderAiAnswerCitationPromptFamilyPeriodComparisonCsv,
  renderAiAnswerCitationPromptFamilyPeriodComparisonHtml,
  renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepCsv,
  renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepHtml,
  renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepSummaryCsv,
  renderAiAnswerCitationPromptFamilySourceRarefactionPanelHtml,
  renderAiAnswerCitationPromptFamilySourceRarefactionCsv,
  renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepCsv,
  renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepHtml,
  renderAiAnswerCitationPromptFamilyThresholdSweepCsv,
  renderAiAnswerCitationPromptFamilyThresholdSweepHtml,
  renderAiAnswerCitationPromptSimilarityCsv,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapCsv,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapHtml,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepCsv,
  renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepHtml,
} from '../../src/geo/answerCitationPromptSimilarity';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';

function profile(prompt: string, providers: string[] = ['Search']): AiAnswerCitationPromptProfile {
  return {
    prompt,
    observations: 1,
    uniqueProviders: providers.length,
    providers,
    observationsWithCitations: 1,
    observationsWithoutCitations: 0,
    citationEvents: 1,
    firstObservedAt: '2026-09-01T00:00:00.000Z',
    lastObservedAt: '2026-09-01T00:00:00.000Z',
    citedDomains: ['example.com'],
    citedDomainsTruncated: false,
    crossProviderCitedDomains: [],
    crossProviderCitedDomainsTruncated: false,
  };
}

function report(prompts: AiAnswerCitationPromptProfile[]): AiAnswerCitationObservationReport {
  return {
    prompts,
    promptsTruncated: false,
    ownedDomains: [],
    providers: [],
  } as unknown as AiAnswerCitationObservationReport;
}

function analyzedReport(period: string, current: boolean): AiAnswerCitationObservationReport {
  const prompts = [
    'blue apples sweet fruit guide',
    'blue apples ripe fruit guide',
    'yellow citrus tree care guide',
  ];
  const observations = ['Search', 'Assistant'].flatMap((provider, providerIndex) =>
    prompts.map((prompt, promptIndex) => {
      const ownedFirst = (providerIndex + promptIndex + Number(current)) % 2 === 0;
      return {
        observedAt: `${period}-12T10:${String(promptIndex * 10).padStart(2, '0')}:00Z`,
        provider,
        prompt,
        answerText: `A practical source guide for ${prompt}.`,
        citedUrls: ownedFirst
          ? ['https://owned.example/guides/fruit', 'https://review.example/source']
          : ['https://review.example/source', 'https://owned.example/guides/fruit'],
        citationListComplete: true,
        topic: 'fruit guides',
        intent: promptIndex === 2 ? 'care' : 'research',
        model: providerIndex === 0 ? 'search-v2' : 'assistant-v3',
        surface: providerIndex === 0 ? 'web search' : 'answer panel',
        locale: 'en-US',
      };
    })
  );
  return analyzeAiAnswerCitationObservations(
    { schemaVersion: 1, observations },
    ['owned.example'],
    `${period}-15T00:00:00.000Z`
  );
}

describe('AI answer citation prompt similarity', () => {
  it('partitions connected lexical prompt families and preserves isolated prompts', () => {
    const input = report([
      profile('blue apples sweet fruit'),
      profile('blue apples ripe fruit'),
      profile('quantum computing qubits'),
    ]);

    const result = analyzeAiAnswerCitationPromptFamilyPartition(input, 0.1);

    expect(result.families.map((family) => family.map(({ prompt }) => prompt))).toEqual([
      ['blue apples ripe fruit', 'blue apples sweet fruit'],
      ['quantum computing qubits'],
    ]);
    expect(result.candidatePairsConsidered).toBeGreaterThan(0);
    expect(result.highFrequencyPostingCutoff).toBe(12);
    expect(result.candidatePairsCapped).toBe(false);
    expect(result.promptCatalogTruncated).toBe(false);
  });

  it('renders a headered CSV summary and formula-safe prompt/provider cells', () => {
    const csv = renderAiAnswerCitationPromptSimilarityCsv(
      report([
        profile('=blue apples sweet fruit', ['+Search']),
        profile('blue apples ripe fruit', ['Search']),
      ]),
      0.1
    );

    expect(csv.startsWith('"row_type","prompt_a","prompt_b",')).toBe(true);
    expect(csv).toContain('"summary"');
    expect(csv).toContain("'=blue apples sweet fruit");
    expect(csv).toContain("'+Search");
    expect(csv).toContain('"pair"');
  });

  it('reports articulation prompts in a connected family graph', () => {
    const input = report([
      profile('alpha omega'),
      profile('alpha bravo'),
      profile('bravo charlie'),
    ]);

    const csv = renderAiAnswerCitationPromptFamiliesCsv(input, 0.3);

    expect(csv).toContain('prompt_family_id');
    expect(csv).toContain('lexically-connected');
    expect(csv).toContain('articulation_prompts_json');
    expect(csv).toContain('alpha bravo');
    expect(csv).toContain('family-00001');
  });

  it('labels source rarefaction as a family-level sampling estimate', () => {
    const csv = renderAiAnswerCitationPromptFamilySourceRarefactionCsv(
      report([
        profile('blue apples sweet fruit'),
        profile('blue apples ripe fruit'),
        profile('quantum computing qubits'),
      ]),
      0.1,
      3
    );

    expect(csv).toContain('lexical-prompt-family');
    expect(csv).toContain('family_similarity_threshold');
    expect(csv).toContain('family_candidate_pairs_considered');
    expect(csv).toContain('Search');
  });

  it('rejects invalid similarity thresholds', () => {
    const input = report([]);
    expect(() => analyzeAiAnswerCitationPromptFamilyPartition(input, -0.01)).toThrow(
      'Prompt-family similarity threshold must be between 0 and 1.'
    );
    expect(() => renderAiAnswerCitationPromptSimilarityCsv(input, 1.01)).toThrow(
      'Prompt similarity threshold must be between 0 and 1.'
    );
  });

  it('renders family, provider-overlap, influence, and period-sensitivity artifacts', () => {
    const baseline = analyzedReport('2026-09', false);
    const current = analyzedReport('2026-10', true);
    const categories = [
      { domain: 'owned.example', label: 'Owned', labelKey: 'owned' },
      { domain: 'review.example', label: 'Reviews', labelKey: 'reviews' },
    ];

    const rarefactionPanel = renderAiAnswerCitationPromptFamilySourceRarefactionPanelHtml(
      baseline,
      0.25,
      3,
      categories
    );
    const rarefactionSweepCsv =
      renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepCsv(
        baseline,
        0.25,
        3,
        categories
      );
    const rarefactionSweepHtml =
      renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepHtml(
        baseline,
        0.25,
        3,
        categories
      );
    expect(rarefactionPanel).toContain('connected lexical prompt families');
    expect(rarefactionSweepCsv).toContain('family_similarity_threshold');
    expect(rarefactionSweepHtml).toContain('Prompt-family source-discovery threshold sweep');

    const overlapCsv = renderAiAnswerCitationProviderPromptFamilySourceOverlapCsv(
      baseline,
      0.25,
      categories
    );
    const overlapHtml = renderAiAnswerCitationProviderPromptFamilySourceOverlapHtml(
      baseline,
      0.25,
      categories
    );
    const overlapSweepCsv =
      renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepCsv(
        baseline,
        0.25,
        categories
      );
    const overlapSweepHtml =
      renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepHtml(
        baseline,
        0.25,
        categories
      );
    expect(overlapCsv).toContain('provider_a');
    expect(overlapHtml).toContain('Provider source overlap by prompt family');
    expect(overlapSweepCsv).toContain('family_similarity_threshold');
    expect(overlapSweepHtml).toContain('Provider prompt-family source-overlap threshold sweep');

    const periodCsv = renderAiAnswerCitationPromptFamilyPeriodComparisonCsv(
      baseline,
      current,
      0.25,
      categories
    );
    const periodHtml = renderAiAnswerCitationPromptFamilyPeriodComparisonHtml(
      baseline,
      current,
      0.25,
      categories
    );
    const periodSweepCsv = renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepCsv(
      baseline,
      current,
      0.25,
      categories
    );
    const periodSummaryCsv =
      renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepSummaryCsv(
        baseline,
        current,
        0.25,
        categories
      );
    const periodSweepHtml = renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepHtml(
      baseline,
      current,
      0.25,
      categories
    );
    expect(periodCsv).toContain('family_similarity_threshold');
    expect(periodHtml).toContain('Prompt-family source period comparison');
    expect(periodSweepCsv).toContain('family_similarity_threshold');
    expect(periodSummaryCsv).toContain('threshold-summary');
    expect(periodSweepHtml).toContain('Prompt-family source-period threshold sweep');

    const familyHtml = renderAiAnswerCitationPromptFamiliesHtml(baseline, 0.25, categories);
    const influenceCsv = renderAiAnswerCitationPromptFamilyInfluenceCsv(baseline, 0.25, categories);
    const influenceHtml = renderAiAnswerCitationPromptFamilyInfluenceHtml(
      baseline,
      0.25,
      categories
    );
    const thresholdCsv = renderAiAnswerCitationPromptFamilyThresholdSweepCsv(
      baseline,
      0.25,
      categories
    );
    const thresholdHtml = renderAiAnswerCitationPromptFamilyThresholdSweepHtml(
      baseline,
      0.25,
      categories
    );
    expect(familyHtml).toContain('Does prompt weighting change the provider story?');
    expect(influenceCsv).toContain('family-influence');
    expect(influenceHtml).toContain('Prompt-family influence audit');
    expect(thresholdCsv).toContain('threshold-summary');
    expect(thresholdHtml).toContain('Prompt-family topology threshold sensitivity');
  });
});
