import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import {
  analyzeAiAnswerCitationObservations,
  compareAiAnswerCitationObservationPeriods,
} from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationObservationsReporter';

const entities = ['Aviary', 'Rival', 'Never Mentioned'];
const mappings = ['owned.example=Owned', 'news.example=News', 'reference.example=Reference'];
function panel(period: string, shift: number, complete: boolean, owned: boolean, text: boolean) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: ['Search', 'Assistant', '<Engine & "third">'].flatMap((provider, engine) =>
        Array.from({ length: shift ? 6 : 8 }, (_, index) => {
          const bucket = (index + engine + shift) % 4;
          const citedUrls =
            bucket === 3
              ? []
              : bucket === 0
                ? ['https://owned.example/guides/one', 'https://news.example/reviews/two']
                : bucket === 1
                  ? ['https://news.example/reviews/two', 'https://owned.example/guides/one']
                  : ['https://reference.example/research/three'];
          return {
            observedAt: `${period}-${index % 2 ? '15' : '01'}T00:00:00Z`,
            provider,
            prompt: `Which guide explains subject ${index}?`,
            ...(text
              ? {
                  answerText:
                    bucket === 0
                      ? 'Aviary and Rival PRIVATE_ANSWER_MARKER'
                      : bucket === 1
                        ? 'Aviary PRIVATE_ANSWER_MARKER'
                        : bucket === 2
                          ? 'Rival PRIVATE_ANSWER_MARKER'
                          : 'Other PRIVATE_ANSWER_MARKER',
                }
              : {}),
            citedUrls,
            citationListComplete: complete,
            ...(index % 3 ? { topic: 'guides', intent: index % 2 ? 'compare' : 'research' } : {}),
            ...(index % 2 ? { model: 'v1', surface: 'web', locale: 'en-US' } : {}),
          };
        })
      ),
    },
    owned ? ['owned.example'] : [],
    '2026-10-05T00:00:00Z',
    entities,
    { pathFamilyDepth: 2, includeCitationUrlPersistence: true }
  );
}
const baselines = new WeakMap<ReturnType<typeof panel>, ReturnType<typeof panel>>();
function paired(shift: number, complete: boolean, owned: boolean, text: boolean) {
  const baseline = panel('2026-08', 0, complete, owned, text);
  const current = panel('2026-10', shift, complete, owned, text);
  current.periodComparison = compareAiAnswerCitationObservationPeriods(baseline, current);
  baselines.set(current, baseline);
  return current;
}
const scenarios = [
  { name: 'owned supported movement', report: paired(1, true, true, true) },
  { name: 'opposite supported movement', report: paired(3, true, true, true) },
  { name: 'unchanged paired evidence', report: paired(0, true, true, true) },
  { name: 'incomplete captured lists', report: paired(1, false, true, true) },
  { name: 'no owned-domain configuration', report: paired(1, true, false, true) },
  { name: 'no captured answer text', report: paired(1, true, true, false) },
];
const exporters = [
  renderer.renderAiAnswerCitationEntityCitationPagesCsv,
  renderer.renderAiAnswerCitationEntityCitationPageComparisonCsv,
  renderer.renderAiAnswerCitationEntityCitationPositionComparisonCsv,
  renderer.renderAiAnswerCitationEntityPromptProviderPairsCsv,
  renderer.renderAiAnswerCitationEntityPromptComparisonCsv,
  renderer.renderAiAnswerCitationEntityCoMentionComparisonCsv,
  renderer.renderAiAnswerCitationEntityPathFamilyComparisonCsv,
  renderer.renderAiAnswerCitationEntityCitationDomainsCsv,
  renderer.renderAiAnswerCitationEntityCitationDomainComparisonCsv,
  (report: Parameters<typeof renderer.renderAiAnswerCitationEntitySourceCategoriesCsv>[0]) =>
    renderer.renderAiAnswerCitationEntitySourceCategoriesCsv(report, mappings),
  (
    report: Parameters<typeof renderer.renderAiAnswerCitationEntitySourceCategoryComparisonCsv>[0]
  ) =>
    renderer.renderAiAnswerCitationEntitySourceCategoryComparisonCsv(
      report,
      baselines.get(report)!,
      mappings
    ),
];

describe('entity citation evidence states', () => {
  it.each(scenarios)('$name dashboard keeps sample states and table alignment', ({ report }) => {
    const html = renderer.renderAiAnswerCitationObservationHtml(report, mappings);
    const window = new Window();
    window.document.write(html);
    expect(window.document.querySelectorAll('table').length).toBeGreaterThan(5);
    expect(html).not.toContain('PRIVATE_ANSWER_MARKER');
    expect(html).not.toContain('<Engine & "third">');
    expect(html).not.toMatch(/NaN%|Infinity%/);
    for (const table of window.document.querySelectorAll('table')) {
      const columns = table.querySelectorAll(':scope > thead > tr:last-child > th').length;
      for (const row of table.querySelectorAll(':scope > tbody > tr'))
        expect(
          [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)
        ).toBe(columns);
    }
  });
  for (const scenario of scenarios) {
    it.each(exporters.map((render) => ({ name: render.name, render })))(
      `${scenario.name} $name preserves unique columns and absent metrics`,
      ({ render }) => {
        if (
          !scenario.report.ownedDomains.length &&
          render === renderer.renderAiAnswerCitationEntityCitationPositionComparisonCsv
        ) {
          expect(() => render(scenario.report)).toThrow(/owned-domain configuration/);
          return;
        }
        const csv = render(scenario.report);
        const rows = csv
          .trimEnd()
          .split('\r\n')
          .map((line) =>
            [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
          );
        expect(new Set(rows[0]).size).toBe(rows[0].length);
        for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
        expect(csv).not.toContain('PRIVATE_ANSWER_MARKER');
        expect(csv).not.toMatch(/NaN|Infinity/);
        if (!scenario.report.ownedDomains.length) {
          const ownedColumns = rows[0]
            .map((header, i) => (header.includes('owned') && !header.includes('unknown') ? i : -1))
            .filter((i) => i >= 0);
          // Configuration indicators may be false; rates cannot be fabricated.
          for (const i of ownedColumns.filter((i) => rows[0][i].includes('percent')))
            for (const row of rows.slice(1)) expect(row[i]).toBe('');
        }
      }
    );
  }
  it('counts mentions using captured answer text rather than all observations', () => {
    const report = scenarios[0].report;
    const csv = renderer.renderAiAnswerCitationEntityPromptDetailsCsv(report);
    expect(csv).toContain('"Aviary"');
    expect(csv).toContain('"Rival"');
    const absent = paired(1, true, true, false);
    expect(
      absent.entityPromptProfiles?.every(
        (profile) =>
          profile.observationsWithAnswerText === 0 && profile.entityMentionRatePercent === null
      )
    ).toBe(true);
  });
});
