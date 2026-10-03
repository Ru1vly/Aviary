import { describe, expect, it } from 'vitest';
import {
  analyzeAiAnswerCitationObservations,
  compareAiAnswerCitationObservationPeriods,
} from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationObservationsReporter';

function report(ownedPromptCount: number) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: ['2026-09-10', '2026-10-10'].flatMap((day) =>
        ['=Engine,"A"', 'Assistant'].flatMap((provider) =>
          [0, 1, 2].map((index) => ({
            observedAt: `${day}T0${index}:00:00Z`,
            provider,
            prompt: `Which guide explains subject ${index}?`,
            answerText: `Aviary explains subject ${index} with useful evidence.`,
            citedUrls:
              index < ownedPromptCount - (provider === 'Assistant' ? 1 : 0)
                ? ['https://owned.example/guide', 'https://rival.example/review']
                : ['https://rival.example/review'],
            citationListComplete: true,
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
    ['Aviary']
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
          .every((cell) => cell.startsWith("'="))
      ).toBe(true);
      expect(data.flat()).not.toContain("'");
    }
  );
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
