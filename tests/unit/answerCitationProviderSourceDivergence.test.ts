import { describe, expect, it } from 'vitest';
import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProviderProfile,
} from '../../src/geo/answerCitationObservations';
import { renderAiAnswerCitationProviderSourceDivergenceCsv } from '../../src/geo/answerCitationProviderSourceDivergence';

type DomainEvents = Array<{ domain: string; citationEvents: number }>;
type RankWeights = Array<{ domain: string; discountedCitationWeight: number }>;

function profile(
  provider: string,
  citationEvents: number,
  domains: DomainEvents | undefined,
  rankWeights: RankWeights | undefined,
  rankWeightTotal = rankWeights?.reduce((sum, item) => sum + item.discountedCitationWeight, 0) ?? 0,
  citedDomainsTruncated = false,
  rankWeightedDomainsTruncated = false
): AiAnswerCitationPromptProviderProfile {
  return {
    provider,
    observations: 1,
    observationsWithCitations: citationEvents > 0 ? 1 : 0,
    observationsWithoutCitations: citationEvents > 0 ? 0 : 1,
    citationEvents,
    firstObservedAt: '2026-09-30T10:00:00Z',
    lastObservedAt: '2026-09-30T10:00:00Z',
    citedDomains: domains?.map((item) => item.domain) ?? [],
    ...(domains ? { citedDomainCitationEvents: domains } : {}),
    citedDomainsTruncated,
    ...(rankWeights ? { rankWeightedDomainCitationEvents: rankWeights } : {}),
    rankWeightedCitationWeightTotal: rankWeightTotal,
    rankWeightedDomainsTruncated,
  };
}

function report(
  promptRows: Array<{
    prompt: string;
    providerProfiles?: AiAnswerCitationPromptProviderProfile[];
  }>,
  providerNames: Array<{ provider: string; uniquePrompts: number }>,
  promptsTruncated = false
): AiAnswerCitationObservationReport {
  return {
    source: 'Aviary observed AI answer citation analysis',
    schemaVersion: 1,
    analyzedAt: '2026-10-01T00:00:00Z',
    ownedDomains: [],
    summary: {} as AiAnswerCitationObservationReport['summary'],
    providers: providerNames as AiAnswerCitationObservationReport['providers'],
    domains: [],
    domainsTruncated: false,
    citedPages: [],
    citedPagesTruncated: false,
    prompts: promptRows as AiAnswerCitationObservationReport['prompts'],
    promptsTruncated,
    reviewQueue: [],
    reviewQueueTruncated: false,
    monthly: [],
    topicIntentCohorts: [],
    topicIntentCohortsTruncated: false,
  };
}

function parseCsv(csv: string): string[][] {
  return csv
    .trimEnd()
    .split('\r\n')
    .map((line) => {
      const cells: string[] = [];
      let value = '';
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index]!;
        if (character === '"') {
          if (quoted && line[index + 1] === '"') {
            value += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
        } else if (character === ',' && !quoted) {
          cells.push(value);
          value = '';
        } else {
          value += character;
        }
      }
      cells.push(value);
      return cells;
    });
}

function rowObject(headers: string[], row: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
}

function completePairReport(
  providerA = 'Search',
  providerB = 'Assistant',
  sameSourceMix = false
): AiAnswerCitationObservationReport {
  const alphaDomains = [{ domain: 'alpha.example', citationEvents: 2 }];
  const betaDomains = sameSourceMix
    ? alphaDomains
    : [{ domain: 'beta.example', citationEvents: 2 }];
  const alphaRanks = [{ domain: 'alpha.example', discountedCitationWeight: 1.5 }];
  const betaRanks = sameSourceMix
    ? alphaRanks
    : [{ domain: 'beta.example', discountedCitationWeight: 1.5 }];
  return report(
    ['Which guide is best?', 'How do I choose a guide?'].map((prompt) => ({
      prompt,
      providerProfiles: [
        profile(providerA, 2, alphaDomains, alphaRanks),
        profile(providerB, 2, betaDomains, betaRanks),
      ],
    })),
    [
      { provider: providerA, uniquePrompts: 2 },
      { provider: providerB, uniquePrompts: 2 },
    ]
  );
}

describe('answer-citation provider source divergence CSV', () => {
  it('reports deterministic event and rank-weighted divergence for complete matched prompts', () => {
    const input = completePairReport();
    const csv = renderAiAnswerCitationProviderSourceDivergenceCsv(input);
    const [headers, summaryRow, pairRow] = parseCsv(csv);
    const summary = rowObject(headers!, summaryRow!);
    const pair = rowObject(headers!, pairRow!);

    expect(csv).toContain('"row_type","provider_a","provider_b"');
    expect(renderAiAnswerCitationProviderSourceDivergenceCsv(input)).toBe(csv);
    expect(summary).toMatchObject({
      row_type: 'summary',
      provider_pairs_available: '1',
      provider_pairs_evaluated: '1',
      provider_pairs_omitted_by_budget: '0',
      pair_prompt_comparisons_evaluated: '2',
      bootstrap_resamples: '1000',
      bootstrap_budget_state: 'full-budget',
    });
    expect(pair).toMatchObject({
      row_type: 'provider-pair',
      provider_a: 'Assistant',
      provider_b: 'Search',
      shared_exact_prompt_groups: '2',
      comparable_domain_detail_prompt_groups: '2',
      event_detail_eligible_both_cited_prompt_groups: '2',
      pooled_domain_jensen_shannon_divergence_bits: '1',
      prompt_balanced_mean_jensen_shannon_divergence_bits: '1',
      prompt_balanced_median_jensen_shannon_divergence_bits: '1',
      prompt_balanced_mean_jsd_ci95_lower: '1',
      prompt_balanced_mean_jsd_ci95_upper: '1',
      pooled_rank_weighted_domain_jsd_bits: '1',
      prompt_balanced_mean_rank_weighted_jsd_bits: '1',
      rank_weighted_bootstrap_interval_state: 'available',
      bootstrap_interval_state: 'available',
      comparison_complete: 'true',
      rank_weighted_comparison_complete: 'true',
    });
  });

  it('reports zero divergence when matched providers have the same normalized source mix', () => {
    const [, , pairRow] = parseCsv(
      renderAiAnswerCitationProviderSourceDivergenceCsv(
        completePairReport(' Search ', 'Assistant', true)
      )
    );
    const [headers] = parseCsv(
      renderAiAnswerCitationProviderSourceDivergenceCsv(
        completePairReport(' Search ', 'Assistant', true)
      )
    );
    const pair = rowObject(headers!, pairRow!);
    expect(pair).toMatchObject({
      provider_a: ' Search ',
      provider_b: 'Assistant',
      pooled_domain_jensen_shannon_divergence_bits: '0',
      prompt_balanced_mean_jensen_shannon_divergence_bits: '0',
      pooled_rank_weighted_domain_jsd_bits: '0',
      comparison_complete: 'true',
    });
  });

  it('separates uncited support from unknown domain and rank detail', () => {
    const input = report(
      [
        {
          prompt: 'one side cited',
          providerProfiles: [
            profile(
              'A',
              1,
              [{ domain: 'a.example', citationEvents: 1 }],
              [{ domain: 'a.example', discountedCitationWeight: 1 }]
            ),
            profile('B', 0, [], []),
          ],
        },
        {
          prompt: 'detail missing',
          providerProfiles: [
            profile('A', 1, undefined, undefined),
            profile(
              'B',
              1,
              [{ domain: 'b.example', citationEvents: 1 }],
              [{ domain: 'b.example', discountedCitationWeight: 1 }]
            ),
          ],
        },
        {
          prompt: 'both uncited',
          providerProfiles: [profile('A', 0, [], []), profile('B', 0, [], [])],
        },
      ],
      [
        { provider: 'A', uniquePrompts: 3 },
        { provider: 'B', uniquePrompts: 3 },
      ]
    );
    const [headers, , pairRow] = parseCsv(renderAiAnswerCitationProviderSourceDivergenceCsv(input));
    const pair = rowObject(headers!, pairRow!);

    expect(pair).toMatchObject({
      shared_exact_prompt_groups: '3',
      comparable_domain_detail_prompt_groups: '2',
      unknown_domain_detail_prompt_groups: '1',
      shared_both_cited_prompt_groups: '1',
      event_detail_eligible_both_cited_prompt_groups: '0',
      one_side_uncited_prompt_groups: '1',
      both_uncited_prompt_groups: '1',
      matched_domain_detail_complete: 'false',
      comparison_complete: 'false',
      rank_weighted_unknown_detail_prompt_groups: '1',
      rank_weighted_comparison_complete: 'false',
      bootstrap_interval_state: 'matched-domain-detail-incomplete',
      rank_weighted_bootstrap_interval_state: 'rank-domain-detail-incomplete',
    });
  });

  it('treats invalid event counts and inconsistent rank totals as unknown detail', () => {
    const input = report(
      [
        {
          prompt: 'invalid detail',
          providerProfiles: [
            profile(
              'A',
              1,
              [{ domain: 'a.example', citationEvents: -1 }],
              [{ domain: 'a.example', discountedCitationWeight: -0.5 }],
              0.5
            ),
            profile(
              'B',
              1,
              [{ domain: 'b.example', citationEvents: 1 }],
              [{ domain: 'b.example', discountedCitationWeight: 0.25 }],
              0.5
            ),
          ],
        },
      ],
      [
        { provider: 'A', uniquePrompts: 1 },
        { provider: 'B', uniquePrompts: 1 },
      ]
    );
    const [headers, , pairRow] = parseCsv(renderAiAnswerCitationProviderSourceDivergenceCsv(input));
    const pair = rowObject(headers!, pairRow!);

    expect(pair).toMatchObject({
      shared_exact_prompt_groups: '1',
      unknown_domain_detail_prompt_groups: '1',
      rank_weighted_unknown_detail_prompt_groups: '1',
      event_detail_eligible_both_cited_prompt_groups: '0',
      rank_weighted_detail_eligible_both_cited_prompt_groups: '0',
      comparison_complete: 'false',
      rank_weighted_comparison_complete: 'false',
    });
  });

  it('merges duplicate provider/prompt slices before comparing source distributions', () => {
    const input = report(
      [
        {
          prompt: 'shared prompt',
          providerProfiles: [
            profile(
              'A',
              1,
              [{ domain: 'a.example', citationEvents: 1 }],
              [{ domain: 'a.example', discountedCitationWeight: 0.5 }]
            ),
            profile(
              'A',
              1,
              [{ domain: 'a.example', citationEvents: 1 }],
              [{ domain: 'a.example', discountedCitationWeight: 0.5 }]
            ),
            profile(
              'B',
              2,
              [{ domain: 'b.example', citationEvents: 2 }],
              [{ domain: 'b.example', discountedCitationWeight: 1 }]
            ),
          ],
        },
      ],
      [
        { provider: 'A', uniquePrompts: 1 },
        { provider: 'B', uniquePrompts: 1 },
      ]
    );
    const [headers, , pairRow] = parseCsv(renderAiAnswerCitationProviderSourceDivergenceCsv(input));
    const pair = rowObject(headers!, pairRow!);

    expect(pair).toMatchObject({
      provider_a_pooled_citation_events_on_both_cited_support: '2',
      provider_b_pooled_citation_events_on_both_cited_support: '2',
      shared_exact_prompt_groups: '1',
      comparable_domain_detail_prompt_groups: '1',
      pooled_domain_jensen_shannon_divergence_bits: '1',
      rank_weighted_comparable_prompt_groups: '1',
      pooled_rank_weighted_domain_jsd_bits: '1',
    });
  });

  it('marks missing prompt catalogs and provider catalog mismatches incomplete', () => {
    const missingProfiles = report(
      [{ prompt: 'unknown capture catalog' }],
      [
        { provider: 'A', uniquePrompts: 1 },
        { provider: 'B', uniquePrompts: 1 },
      ],
      true
    );
    const [headers, , pairRow] = parseCsv(
      renderAiAnswerCitationProviderSourceDivergenceCsv(missingProfiles)
    );
    const pair = rowObject(headers!, pairRow!);
    expect(pair).toMatchObject({
      shared_exact_prompt_groups: '0',
      prompt_catalog_complete: 'false',
      matched_domain_detail_complete: 'true',
      comparison_complete: 'false',
      bootstrap_interval_state: 'prompt-catalog-incomplete',
      rank_weighted_bootstrap_interval_state: 'prompt-catalog-incomplete',
    });
  });

  it('escapes spreadsheet formulas and quoted provider labels in CSV cells', () => {
    const csv = renderAiAnswerCitationProviderSourceDivergenceCsv(
      completePairReport('=Search, "one"', 'Assistant')
    );
    const [headers, , pairRow] = parseCsv(csv);
    const pair = rowObject(headers!, pairRow!);
    expect(pair.provider_a).toBe('\'=Search, "one"');
    expect(csv).toContain('\'=Search, ""one""');
  });

  it('caps large pair output and reports omitted provider pairs at the pair budget', () => {
    const providerNames = Array.from({ length: 318 }, (_, index) => ({
      provider: `Provider ${String(index).padStart(3, '0')}`,
      uniquePrompts: 0,
    }));
    const input = report([], providerNames);
    const rows = parseCsv(renderAiAnswerCitationProviderSourceDivergenceCsv(input));
    const headers = rows[0]!;
    const summary = rowObject(headers, rows[1]!);
    const firstPair = rowObject(headers, rows[2]!);
    const lastPair = rowObject(headers, rows.at(-1)!);

    expect(summary).toMatchObject({
      provider_pairs_available: '50403',
      provider_pairs_evaluated: '50000',
      provider_pairs_omitted_by_budget: '403',
      pair_panel_budget_truncated: 'true',
      output_rows_truncated: 'true',
    });
    expect(firstPair.row_type).toBe('provider-pair');
    expect(lastPair.provider_a).toBe('Provider 070');
  });

  it('reports bootstrap intervals as budget-limited when the shared draw cap is exhausted', () => {
    const promptCount = 100_001;
    const alphaDomains = [{ domain: 'alpha.example', citationEvents: 1 }];
    const betaDomains = [{ domain: 'beta.example', citationEvents: 1 }];
    const alphaRanks = [{ domain: 'alpha.example', discountedCitationWeight: 1 }];
    const betaRanks = [{ domain: 'beta.example', discountedCitationWeight: 1 }];
    const prompts = Array.from({ length: promptCount }, (_, index) => ({
      prompt: `bounded prompt ${index}`,
      providerProfiles: [
        profile('A', 1, alphaDomains, alphaRanks),
        profile('B', 1, betaDomains, betaRanks),
      ],
    }));
    const input = report(prompts, [
      { provider: 'A', uniquePrompts: promptCount },
      { provider: 'B', uniquePrompts: promptCount },
    ]);
    const [headers, summaryRow, pairRow] = parseCsv(
      renderAiAnswerCitationProviderSourceDivergenceCsv(input)
    );
    const summary = rowObject(headers!, summaryRow!);
    const pair = rowObject(headers!, pairRow!);

    expect(summary).toMatchObject({
      bootstrap_resamples: '0',
      rank_weighted_bootstrap_resamples: '0',
      bootstrap_budget_state: 'insufficient-support-or-budget',
    });
    expect(pair).toMatchObject({
      shared_exact_prompt_groups: String(promptCount),
      bootstrap_interval_state: 'budget-limited',
      rank_weighted_bootstrap_interval_state: 'budget-limited',
      prompt_balanced_mean_jensen_shannon_divergence_bits: '1',
      prompt_balanced_mean_rank_weighted_jsd_bits: '1',
    });
  });
});
