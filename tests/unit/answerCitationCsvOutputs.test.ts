import { describe, expect, it } from 'vitest';
import {
  analyzeAiAnswerCitationObservations,
  compareAiAnswerCitationObservationPeriods,
} from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationObservationsReporter';

function report(ownedPromptCount: number, complete = true) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: ['2026-09-10', '2026-10-10'].flatMap((day) =>
        ['=Engine,"A"', 'Assistant'].flatMap((provider) =>
          [0, 1, 2].map((index) => ({
            observedAt: `${day}T0${index}:00:00Z`,
            provider,
            prompt: `Which guide explains subject ${index}?`,
            answerText: `Aviary and Rival explain subject ${index} with useful evidence.`,
            citedUrls:
              index < ownedPromptCount - (provider === 'Assistant' ? 1 : 0)
                ? ['https://owned.example/guide', 'https://rival.example/review']
                : ['https://rival.example/review'],
            citationListComplete: complete,
            model: 'model-v1',
            surface: 'web',
            locale: 'en-US',
            topic: 'guides',
            intent: 'research',
          }))
        )
      ),
    },
    ['owned.example'],
    '2026-10-04T00:00:00Z',
    ['Aviary', 'Rival'],
    { pathFamilyDepth: 2, includeCitationUrlPersistence: true }
  );
}
function rows(csv: string): string[][] {
  return csv
    .trimEnd()
    .split('\r\n')
    .map((line) =>
      [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1].replace(/""/g, '"'))
    );
}
const baseline = report(1);
const current = report(2);
current.periodComparison = compareAiAnswerCitationObservationPeriods(baseline, current);

const exports = [
  renderer.renderAiAnswerCitationProviderPromptOverlapCsv,
  renderer.renderAiAnswerCitationProviderPromptSourceOverlapCsv,
  renderer.renderAiAnswerCitationCohortStandardizationCsv,
  renderer.renderAiAnswerCitationCohortPeriodStandardizationCsv,
  renderer.renderAiAnswerCitationPromptSamplingPlanCsv,
  renderer.renderAiAnswerCitationPromptPlanProviderPairsCsv,
  renderer.renderAiAnswerCitationTopicIntentProviderPairsCsv,
  renderer.renderAiAnswerCitationProviderSampleMixCsv,
  renderer.renderAiAnswerCitationTemporalStabilityCsv,
  renderer.renderAiAnswerCitationSourcePersistenceCsv,
  renderer.renderAiAnswerCitationUrlPersistenceCsv,
  renderer.renderAiAnswerCitationTopicIntentProviderMonthlyCsv,
  renderer.renderAiAnswerCitationListPositionsCsv,
  renderer.renderAiAnswerCitationDomainPromptCoverageCsv,
  renderer.renderAiAnswerCitationCoCitationCsv,
  renderer.renderAiAnswerCitationCoCitationComparisonCsv,
  renderer.renderAiAnswerCitationEntityMentionsCsv,
  renderer.renderAiAnswerCitationEntityPromptDetailsCsv,
  renderer.renderAiAnswerCitationEntityPromptProviderPairsCsv,
  renderer.renderAiAnswerCitationEntityPromptComparisonCsv,
  renderer.renderAiAnswerCitationEntityCitationPositionComparisonCsv,
  renderer.renderAiAnswerCitationEntityCoMentionsCsv,
  renderer.renderAiAnswerCitationEntityCoMentionComparisonCsv,
  renderer.renderAiAnswerCitationEntityCitationDomainsCsv,
  renderer.renderAiAnswerCitationEntityCitationDomainComparisonCsv,
  renderer.renderAiAnswerCitationEntityOpportunitiesCsv,
  renderer.renderAiAnswerCitationEntityPathFamiliesCsv,
  renderer.renderAiAnswerCitationEntityPathFamilyMonthlyCsv,
  renderer.renderAiAnswerCitationEntityPathFamilyComparisonCsv,
  renderer.renderAiAnswerCitationPathFamiliesCsv,
  renderer.renderAiAnswerCitationPathFamilyCohortsCsv,
  renderer.renderAiAnswerCitationPathFamilyTrendsCsv,
  renderer.renderAiAnswerCitationPathFamilyCohortComparisonCsv,
  renderer.renderAiAnswerCitationPathFamilyComparisonCsv,
  renderer.renderAiAnswerCitationProviderPagePositionComparisonCsv,

  renderer.renderAiAnswerCitationOwnedRankCsv,
  renderer.renderAiAnswerCitationOwnedPromptCoverageCsv,
  renderer.renderAiAnswerCitationOwnedPromptReachPeriodCsv,
  renderer.renderAiAnswerCitationOwnedPromptOpportunitiesCsv,
  renderer.renderAiAnswerCitationCompetitiveGapsCsv,
  renderer.renderAiAnswerCitationProviderOwnedGapsCsv,
  renderer.renderAiAnswerCitationProviderOwnedGapComparisonCsv,
  renderer.renderAiAnswerCitationCompetitiveGapComparisonCsv,
  renderer.renderAiAnswerCitationOwnedRankComparisonCsv,
  renderer.renderAiAnswerCitationOwnedPromptRankComparisonCsv,
  renderer.renderAiAnswerCitationObservationComparisonCsv,
  renderer.renderAiAnswerCitationTopicIntentComparisonCsv,
  renderer.renderAiAnswerCitationTopicIntentCohortsCsv,
  renderer.renderAiAnswerCitationExecutionContextCsv,
  renderer.renderAiAnswerCitationExecutionContextTrendsCsv,
  renderer.renderAiAnswerCitationExecutionContextCoverageCsv,
  renderer.renderAiAnswerCitationAnswerLengthProfilesCsv,
  renderer.renderAiAnswerCitationAnswerLengthTrendsCsv,
  renderer.renderAiAnswerCitationAnswerLengthComparisonCsv,
];
describe('answer-citation spreadsheet output contracts', () => {
  it.each(exports.map((render) => [render.name, render] as const))(
    '%s has named, aligned columns and safe captured labels',
    (_name, render) => {
      const paired = [
        renderer.renderAiAnswerCitationProviderOwnedGapComparisonCsv,
        renderer.renderAiAnswerCitationCompetitiveGapComparisonCsv,
        renderer.renderAiAnswerCitationAnswerLengthComparisonCsv,
      ];
      const csv = paired.includes(render as (typeof paired)[number])
        ? (render as (typeof paired)[number])(current, baseline)
        : (render as (report: typeof current) => string)(current);
      const data = rows(csv);
      expect(data.length).toBeGreaterThan(1);
      expect(data[0].every(Boolean)).toBe(true);
      expect(new Set(data[0]).size).toBe(data[0].length);
      for (const row of data.slice(1)) expect(row.length).toBe(data[0].length);
      expect(
        data
          .flat()
          .filter((cell) => cell.includes('Engine'))
          .every((cell) => !/^[\s]*[=+@-]/.test(cell))
      ).toBe(true);
      expect(data.flat()).not.toContain("'");
    }
  );
  it('names every monthly owned-share rank bucket and preserves its metric', () => {
    const data = rows(renderer.renderAiAnswerCitationTopicIntentProviderMonthlyCsv(current));
    for (const suffix of ['1', '2', '3', '4_5', '6_10', '11_plus']) {
      expect(data[0]).toContain(`owned_rank_${suffix}_share_within_rank_percent`);
    }
    const records = data
      .slice(1)
      .map((row) => Object.fromEntries(data[0].map((key, i) => [key, row[i]])));
    const month = records.find(
      (row) => row.month_utc === '2026-10' && row.provider.includes('Engine')
    )!;
    expect(Number(month.owned_rank_1_share_within_rank_percent)).toBeCloseTo(66.67, 1);
  });
  it('retains exact prompt coverage and rank counts independently of the CSV renderer', () => {
    const data = rows(renderer.renderAiAnswerCitationOwnedPromptCoverageCsv(current));
    const overall = Object.fromEntries(data[0].map((key, i) => [key, data[1][i]]));
    expect(Number(overall.unique_prompts)).toBe(3);
    expect(Number(overall.prompts_with_owned_citation)).toBe(2);
    expect(Number(overall.owned_citation_prompt_coverage_percent)).toBeCloseTo(66.67, 1);
    const ranks = rows(renderer.renderAiAnswerCitationOwnedRankCsv(current));
    const first = Object.fromEntries(ranks[0].map((key, i) => [key, ranks[1][i]]));
    expect(first.rank_bucket).toBe('1');
    expect(Number(first.owned_citation_events)).toBe(6);
  });
});

const categoryMappings = ['owned.example=Owned', 'rival.example=Independent,"quoted"'];
const categoryExports = [
  {
    name: 'SourceCategories',
    render: () => renderer.renderAiAnswerCitationSourceCategoriesCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryMappingAudit',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryMappingAuditCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryPromptCoverage',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryPromptCoverageCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryPromptDetails',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryPromptDetailsCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryTrends',
    render: () => renderer.renderAiAnswerCitationSourceCategoryTrendsCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryConcentrationTrends',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryConcentrationTrendsCsv(
        current,
        categoryMappings
      ),
  },
  {
    name: 'SourceCategoryShareTrends',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryShareTrendsCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryProviderPairs',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryProviderPairsCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryCooccurrence',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryCooccurrenceCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryPathFamilies',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryPathFamiliesCsv(current, categoryMappings),
  },
  {
    name: 'EntitySourceCategories',
    render: () =>
      renderer.renderAiAnswerCitationEntitySourceCategoriesCsv(current, categoryMappings),
  },
  {
    name: 'SourceCategoryPathFamilyComparison',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryPathFamilyComparisonCsv(
        current,
        baseline,
        categoryMappings
      ),
  },
  {
    name: 'SourceCategoryComparison',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryComparisonCsv(
        current,
        baseline,
        categoryMappings
      ),
  },
  {
    name: 'SourceCategoryMixDecomposition',
    render: () =>
      renderer.renderAiAnswerCitationSourceCategoryMixDecompositionCsv(
        current,
        baseline,
        categoryMappings
      ),
  },
  {
    name: 'EntitySourceCategoryComparison',
    render: () =>
      renderer.renderAiAnswerCitationEntitySourceCategoryComparisonCsv(
        current,
        baseline,
        categoryMappings
      ),
  },
];
describe('mapped source-category spreadsheet contracts', () => {
  it.each(categoryExports)(
    '$name retains uniquely named, aligned category columns',
    ({ render }) => {
      const data = rows(render());
      expect(data.length).toBeGreaterThan(1);
      expect(new Set(data[0]).size).toBe(data[0].length);
      expect(data[0].every(Boolean)).toBe(true);
      for (const row of data.slice(1)) expect(row.length).toBe(data[0].length);
      expect(data.flat()).not.toContain("'");
      expect(
        data
          .flat()
          .filter((cell) => cell.includes('Engine'))
          .every((cell) => !/^[\s]*[=+@-]/.test(cell))
      ).toBe(true);
    }
  );
  it.each(categoryExports)('$name rejects malformed category mappings', ({ render }) => {
    const original = categoryMappings[0];
    try {
      categoryMappings[0] = 'invalid mapping';
      expect(render).toThrow(/mapping|hostname/);
    } finally {
      categoryMappings[0] = original;
    }
  });
});

describe('category prompt-coverage truncation flag placement', () => {
  it.each([undefined, baseline])(
    'retains one truncation flag and final evidence note',
    (before) => {
      const data = rows(
        renderer.renderAiAnswerCitationSourceCategoryPromptCoverageCsv(
          current,
          categoryMappings,
          before
        )
      );
      for (const row of data.slice(1)) {
        expect(row.length).toBe(data[0].length);
        expect(row[row.length - 2]).toBe('false');
        expect(row[row.length - 1]).toMatch(/^Prompt coverage counts each exact prompt/);
      }
    }
  );
});

describe('source-category incomplete captured lists', () => {
  it('withholds confirmed absence and paired changes when captured lists are incomplete', () => {
    const incomplete = report(0, false);
    const data = rows(
      renderer.renderAiAnswerCitationSourceCategoryPromptCoverageCsv(
        incomplete,
        categoryMappings,
        baseline
      )
    );
    const records = data
      .slice(1)
      .map((row) => Object.fromEntries(data[0].map((key, i) => [key, row[i]])));
    const owned = records.find(
      (row) => row.category === 'Owned' && row.provider === 'All providers'
    )!;
    expect(owned.complete_citation_domain_profiles).toBe('0');
    expect(owned.comparable_shared_citation_prompt_groups).toBe('0');
    expect(owned.comparison_coverage_complete).toBe('false');
    const independent = records.find(
      (row) => row.category.startsWith('Independent') && row.provider === 'All providers'
    )!;
    expect(independent.category_present_prompt_groups).toBe('3');
    expect(independent.complete_category_without_owned_prompt_groups).toBe('0');
  });
});

describe('category capture-completeness compatibility', () => {
  it('reports unknown list completeness in legacy provider detail without confirming absence', () => {
    const legacy = report(0);
    for (const prompt of legacy.prompts)
      for (const profile of prompt.providerProfiles ?? []) {
        delete profile.incompleteCitationListObservations;
      }
    const data = rows(
      renderer.renderAiAnswerCitationSourceCategoryPromptCoverageCsv(
        legacy,
        categoryMappings,
        baseline
      )
    );
    const records = data
      .slice(1)
      .map((row) => Object.fromEntries(data[0].map((key, i) => [key, row[i]])));
    const owned = records.find(
      (row) => row.category === 'Owned' && row.provider === 'All providers'
    )!;
    expect(owned.unknown_captured_citation_list_completeness_prompt_groups).toBe('3');
    expect(owned.complete_citation_domain_profiles).toBe('0');
    expect(owned.coverage_state).toBe('captured-citation-list-completeness-unavailable');
    expect(owned.comparison_coverage_complete).toBe('false');
  });
  it('discloses incomplete captured support even where category presence is confirmed', () => {
    const incomplete = report(0, false);
    const data = rows(
      renderer.renderAiAnswerCitationSourceCategoryPromptCoverageCsv(
        incomplete,
        categoryMappings,
        baseline
      )
    );
    const records = data
      .slice(1)
      .map((row) => Object.fromEntries(data[0].map((key, i) => [key, row[i]])));
    const known = records.find(
      (row) => row.category.startsWith('Independent') && row.provider === 'All providers'
    )!;
    expect(known.category_present_prompt_groups).toBe('3');
    expect(known.incomplete_captured_citation_list_prompt_groups).toBe('3');
    expect(known.unknown_due_to_top_domain_cap_prompt_groups).toBe('0');
    expect(known.comparison_coverage_complete).toBe('false');
    expect(known.category_owned_comparison_coverage_complete).toBe('false');
    expect(known.coverage_state).toBe('incomplete-captured-citation-lists');
  });
});

describe('category prompt detail unknown evidence', () => {
  it('keeps observed categories positive without confirming an owned-source gap', () => {
    const data = rows(
      renderer.renderAiAnswerCitationSourceCategoryPromptDetailsCsv(
        report(0, false),
        categoryMappings
      )
    );
    const records = data
      .slice(1)
      .map((row) => Object.fromEntries(data[0].map((key, i) => [key, row[i]])));
    for (const row of records) {
      expect(row.captured_citation_list_completeness).toBe('incomplete');
      expect(row.owned_citation_state).toBe(
        'owned-domain-absence-unknown-captured-list-incomplete'
      );
      expect(row.state).toContain(row.category === 'Owned' ? 'absence-unknown' : 'observed');
      expect(row.category_owned_citation_state).toContain('unknown');
    }
  });
});
