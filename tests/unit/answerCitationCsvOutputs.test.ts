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

const uncitedReport = analyzeAiAnswerCitationObservations(
  {
    schemaVersion: 1,
    observations: [
      {
        observedAt: '2026-10-01T00:00:00Z',
        provider: 'Search',
        prompt: 'Uncited prompt',
        citedUrls: [],
        citationListComplete: true,
      },
    ],
  },
  [],
  '2026-10-01T01:00:00Z'
);
const singleReport = analyzeAiAnswerCitationObservations(
  {
    schemaVersion: 1,
    observations: [
      {
        observedAt: '2026-10-01T00:00:00Z',
        provider: 'Search',
        prompt: 'Single prompt',
        citedUrls: ['https://owned.example/guide'],
        citationListComplete: false,
      },
    ],
  },
  ['owned.example'],
  '2026-10-01T01:00:00Z'
);
const cappedReport = structuredClone(current);
cappedReport.promptsTruncated = true;
cappedReport.domainsTruncated = true;
cappedReport.citedPagesTruncated = true;
const sparsePairedExports = [
  renderer.renderAiAnswerCitationProviderOwnedGapComparisonCsv,
  renderer.renderAiAnswerCitationCompetitiveGapComparisonCsv,
  renderer.renderAiAnswerCitationAnswerLengthComparisonCsv,
];
const sparsePrerequisites: Record<string, { states: string[]; message: string }> = {
  renderAiAnswerCitationCohortPeriodStandardizationCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'This report does not contain baseline/current topic-intent cohort comparison; supply --geo-answer-baseline-observations.',
  },
  renderAiAnswerCitationUrlPersistenceCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'This report does not contain citation-URL persistence detail; reanalyze with URL persistence enabled.',
  },
  renderAiAnswerCitationCoCitationComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Owned-source co-citation comparison requires baseline and current samples with retained co-citation detail.',
  },
  renderAiAnswerCitationEntityMentionsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Configured entity mention detail requires at least one --geo-answer-entity.',
  },
  renderAiAnswerCitationEntityPromptDetailsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Entity prompt detail requires at least one --geo-answer-entity.',
  },
  renderAiAnswerCitationEntityPromptProviderPairsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Entity prompt/provider comparisons require at least one --geo-answer-entity.',
  },
  renderAiAnswerCitationEntityPromptComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity prompt comparison requires baseline/current observations with configured entity detail.',
  },
  renderAiAnswerCitationEntityCitationPositionComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity citation-position comparison requires baseline/current answer observations with the same configured entity names and aliases.',
  },
  renderAiAnswerCitationEntityCoMentionsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity co-mention detail requires at least two --geo-answer-entity definitions and answer observations.',
  },
  renderAiAnswerCitationEntityCoMentionComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity co-mention comparison requires current and baseline observations with at least two matching configured entities.',
  },
  renderAiAnswerCitationEntityCitationDomainsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Entity citation-domain associations require at least one --geo-answer-entity.',
  },
  renderAiAnswerCitationEntityCitationDomainComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity citation-domain comparison requires baseline/current answer observations with the same configured entity names and aliases.',
  },
  renderAiAnswerCitationEntityOpportunitiesCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity mention opportunity detail requires configured answer entities and owned domains.',
  },
  renderAiAnswerCitationEntityPathFamiliesCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity/path-family associations require configured answer entities, answer observations, and a path-family depth.',
  },
  renderAiAnswerCitationEntityPathFamilyMonthlyCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Monthly entity/path-family associations require configured answer entities, answer observations, and a path-family depth.',
  },
  renderAiAnswerCitationEntityPathFamilyComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Entity/path-family comparison requires baseline/current answer observations with matching path depth and configured entities.',
  },
  renderAiAnswerCitationPathFamiliesCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Citation path-family detail requires a configured answer citation path-family depth.',
  },
  renderAiAnswerCitationPathFamilyCohortsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Citation path-family cohort detail requires a configured answer citation path-family depth.',
  },
  renderAiAnswerCitationPathFamilyTrendsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Monthly citation path-family cohorts require a configured answer citation path-family depth.',
  },
  renderAiAnswerCitationPathFamilyCohortComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Path-family cohort comparison requires baseline/current answer samples and the same configured path depth.',
  },
  renderAiAnswerCitationPathFamilyComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Path-family period comparison requires matching path depths and a baseline observation sample.',
  },
  renderAiAnswerCitationProviderPagePositionComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Provider-specific page-position comparison requires baseline and current answer observations with retained citation-position detail.',
  },
  renderAiAnswerCitationOwnedRankCsv: {
    states: ['uncited capture without owned scope'],
    message:
      'Owned citation rank export requires an answer-citation report analyzed with at least one owned domain.',
  },
  renderAiAnswerCitationOwnedPromptCoverageCsv: {
    states: ['uncited capture without owned scope'],
    message:
      'Owned prompt-coverage export requires an answer-citation report analyzed with at least one owned domain.',
  },
  renderAiAnswerCitationOwnedPromptReachPeriodCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Paired owned-prompt reach comparison requires baseline and current answer observations.',
  },
  renderAiAnswerCitationOwnedPromptOpportunitiesCsv: {
    states: ['uncited capture without owned scope'],
    message:
      'Owned prompt-opportunity export requires an answer-citation report analyzed with at least one owned domain.',
  },
  renderAiAnswerCitationCompetitiveGapsCsv: {
    states: ['uncited capture without owned scope'],
    message:
      'Competitive-gap export requires an answer-citation report analyzed with at least one owned domain.',
  },
  renderAiAnswerCitationProviderOwnedGapsCsv: {
    states: ['uncited capture without owned scope'],
    message:
      'Provider owned-gap export requires an answer-citation report analyzed with at least one owned domain.',
  },
  renderAiAnswerCitationProviderOwnedGapComparisonCsv: {
    states: ['uncited capture without owned scope'],
    message:
      'Provider owned-gap comparison requires baseline and current reports analyzed with the same non-empty owned-domain set.',
  },
  renderAiAnswerCitationCompetitiveGapComparisonCsv: {
    states: ['uncited capture without owned scope'],
    message:
      'Competitive-gap comparison requires baseline and current reports analyzed with the same non-empty owned-domain set.',
  },
  renderAiAnswerCitationOwnedRankComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Owned rank comparison requires baseline and current answer observations analyzed with the same owned domains.',
  },
  renderAiAnswerCitationOwnedPromptRankComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Owned prompt-rank comparison requires baseline and current answer observations analyzed with the same nonempty owned domains.',
  },
  renderAiAnswerCitationObservationComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'An answer-citation period comparison is required to render comparison CSV.',
  },
  renderAiAnswerCitationTopicIntentComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'An answer-citation topic/intent period comparison is required to render cohort comparison CSV.',
  },
  renderAiAnswerCitationExecutionContextCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Execution-context export requires answer observations with at least one model, surface, or locale label.',
  },
  renderAiAnswerCitationExecutionContextTrendsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Execution-context trends require answer observations with at least one model, surface, or locale label.',
  },
  renderAiAnswerCitationExecutionContextCoverageCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message:
      'Execution-context coverage requires answer observations with at least one model, surface, or locale label.',
  },
  renderAiAnswerCitationAnswerLengthProfilesCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Answer-length profiles require at least one observation with answerText.',
  },
  renderAiAnswerCitationAnswerLengthTrendsCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Answer-length trends require at least one observation with answerText.',
  },
  renderAiAnswerCitationAnswerLengthComparisonCsv: {
    states: ['uncited capture without owned scope', 'single incomplete capture'],
    message: 'Answer-length comparison requires answerText in both current and baseline samples.',
  },
};
describe.each([
  { name: 'uncited capture without owned scope', report: uncitedReport },
  { name: 'single incomplete capture', report: singleReport },
  { name: 'capped catalogs', report: cappedReport },
])('$name spreadsheet contracts', ({ name, report }) => {
  it.each(exports.map((render) => [render.name, render] as const))(
    '%s keeps headers and field widths valid',
    (_name, render) => {
      const renderCsv = () =>
        sparsePairedExports.includes(render as (typeof sparsePairedExports)[number])
          ? (render as (typeof sparsePairedExports)[number])(report, report)
          : (render as (report: typeof current) => string)(report);
      const prerequisite = sparsePrerequisites[render.name];
      if (prerequisite?.states.includes(name)) {
        expect(renderCsv).toThrow(prerequisite.message);
        return;
      }
      const csv = renderCsv();
      const records = rows(csv);
      expect(records[0].length).toBeGreaterThan(0);
      expect(records[0].every(Boolean)).toBe(true);
      expect(new Set(records[0]).size).toBe(records[0].length);
      for (const record of records.slice(1)) expect(record.length).toBe(records[0].length);
      expect(records.flat()).not.toContain("'");
      expect(csv).not.toContain('NaN');
    }
  );
});
