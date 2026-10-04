import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import type { AiAnswerCitationObservationInput } from '../../src/geo/answerCitationObservations';
import * as pages from '../../src/geo/answerCitationPagePairedReach';
const owned = ['owned.example'];
function samples(complete = true): AiAnswerCitationObservationInput[] {
  return ['2026-09-01', '2026-10-01'].flatMap((day, month) =>
    ['Search', 'Assistant'].flatMap((provider) =>
      Array.from({ length: 12 }, (_, index) => ({
        observedAt: `${day}T00:00:00Z`,
        provider,
        prompt: `Question ${index}`,
        citedUrls: month
          ? ['https://news.example/guides/review?tracking=private']
          : ['https://archive.example/reference/old'],
        citationListComplete: complete,
      }))
    )
  );
}
const data = samples();
const trends = pages.renderAiAnswerCitationPageOpportunityTrendsCsv(data, owned);
const families = pages.renderAiAnswerCitationPageOpportunityPathFamilyTrendsCsv(data, owned, 2);
function checkCsv(csv: string) {
  const rows = csv
    .trimEnd()
    .split('\r\n')
    .map((line) =>
      [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
    );
  expect(rows.length).toBeGreaterThan(1);
  for (const row of rows) expect(row.length).toBe(rows[0].length);
  expect(csv).not.toContain('tracking=private');
  expect(csv).not.toContain('NaN');
}
describe('monthly page-opportunity export contracts', () => {
  it.each([true, false])(
    'preserves aligned monthly and path-family evidence for completeness=%s',
    (complete) => {
      const observations = samples(complete);
      checkCsv(pages.renderAiAnswerCitationPageOpportunitiesCsv(observations, owned));
      checkCsv(pages.renderAiAnswerCitationPageOpportunityTrendsCsv(observations, owned));
      checkCsv(
        pages.renderAiAnswerCitationPageOpportunityPathFamilyTrendsCsv(observations, owned, 2)
      );
      checkCsv(pages.renderAiAnswerCitationPageOpportunityPathFamiliesCsv(observations, owned, 2));
    }
  );
  it('gates a statistically supported monthly rise and preserves assessment JSON', () => {
    const assessment = pages.assessAiAnswerCitationPageOpportunityMonthlyRiseGateFromCsv(
      trends,
      10,
      0.05,
      10
    );
    expect(assessment.exceeded).toBe(true);
    expect(assessment.failures.length).toBeGreaterThan(0);
    expect(
      JSON.parse(pages.renderAiAnswerCitationPageOpportunityMonthlyRiseGateJson(assessment))
    ).toMatchObject(assessment);
    const family = pages.assessAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateFromCsv(
      families,
      10,
      0.05,
      10
    );
    expect(family.exceeded).toBe(true);
    expect(
      JSON.parse(pages.renderAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateJson(family))
    ).toMatchObject(family);
  });
  it('fails closed on insufficient evidence rather than inventing a supported rise', () => {
    const empty = pages.renderAiAnswerCitationPageOpportunityTrendsCsv([], owned);
    const assessment = pages.assessAiAnswerCitationPageOpportunityMonthlyRiseGateFromCsv(empty, 10);
    expect(assessment.complete).toBe(false);
    expect(assessment.exceeded).toBe(false);
  });
  it('renders populated and empty path-family dashboards', () => {
    for (const csv of [
      families,
      pages.renderAiAnswerCitationPageOpportunityPathFamilyTrendsCsv([], owned, 2),
    ]) {
      const window = new Window();
      window.document.write(
        pages.renderAiAnswerCitationPageOpportunityPathFamilyTrendsHtmlFromCsv(csv)
      );
      expect(window.document.title.length).toBeGreaterThan(0);
      expect(window.document.querySelector('script')).not.toBeNull();
    }
  });
  it.each([NaN, -1, 101])('rejects invalid threshold %s', (value) => {
    expect(() =>
      pages.assessAiAnswerCitationPageOpportunityMonthlyRiseGateFromCsv(trends, value)
    ).toThrow();
    expect(() =>
      pages.assessAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateFromCsv(families, value)
    ).toThrow();
  });
  it.each([0, 6, 1.5])('rejects invalid path depth %s', (depth) => {
    expect(() =>
      pages.renderAiAnswerCitationPageOpportunityPathFamiliesCsv(data, owned, depth)
    ).toThrow();
    expect(() =>
      pages.renderAiAnswerCitationPageOpportunityPathFamilyTrendsCsv(data, owned, depth)
    ).toThrow();
  });
  it('requires owned scope and a summary row for monthly family reports', () => {
    expect(() => pages.renderAiAnswerCitationPageOpportunityTrendsCsv(data, [])).toThrow();
    expect(() =>
      pages.renderAiAnswerCitationPageOpportunityPathFamilyTrendsHtmlFromCsv('')
    ).toThrow();
  });
});
