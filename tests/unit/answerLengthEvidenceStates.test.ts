import { describe, expect, it } from 'vitest';
import {
  analyzeAiAnswerCitationObservations,
  compareAiAnswerCitationObservationPeriods,
} from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationObservationsReporter';

function panel(shift: number, complete: boolean, owned: boolean) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: ['2026-08-01', '2026-10-01'].flatMap((day) =>
        ['Search', 'Assistant'].flatMap((provider, engine) =>
          [10, 100, 300, 800, 1600].flatMap((words, band) =>
            [0, 1, 2].map((prompt) => ({
              observedAt: `${day}T0${prompt}:00:00Z`,
              provider,
              prompt: `Question ${band}-${prompt}`,
              answerText: 'word '.repeat(words + shift * (prompt + 1)),
              citedUrls:
                (band + prompt + engine + shift) % 3 === 0
                  ? []
                  : (band + engine + shift) % 2 === 0
                    ? ['https://owned.example/guide', 'https://news.example/review']
                    : ['https://news.example/review', 'https://owned.example/guide'],
              citationListComplete: complete,
              ...(engine ? { model: 'v2', surface: 'answer', locale: 'en-US' } : {}),
              ...(prompt
                ? { topic: 'guides', intent: prompt === 1 ? 'research' : 'comparison' }
                : {}),
            }))
          )
        )
      ),
    },
    owned ? ['owned.example'] : [],
    '2026-10-05T00:00:00Z'
  );
}
function paired(complete: boolean, owned: boolean) {
  const baseline = panel(0, complete, owned),
    current = panel(1, complete, owned);
  current.periodComparison = compareAiAnswerCitationObservationPeriods(baseline, current);
  return current;
}
const cases = [
  { name: 'complete owned evidence', report: paired(true, true), baseline: panel(0, true, true) },
  {
    name: 'unknown citation absence',
    report: paired(false, true),
    baseline: panel(0, false, true),
  },
  { name: 'unconfigured ownership', report: paired(true, false), baseline: panel(0, true, false) },
];
const exporters = [
  renderer.renderAiAnswerCitationAnswerLengthProfilesCsv,
  renderer.renderAiAnswerCitationAnswerLengthTrendsCsv,
  renderer.renderAiAnswerCitationAnswerLengthComparisonCsv,
  renderer.renderAiAnswerCitationExecutionContextCsv,
  renderer.renderAiAnswerCitationExecutionContextTrendsCsv,
  renderer.renderAiAnswerCitationExecutionContextComparisonCsv,
];
describe('answer-length and execution-context evidence', () => {
  for (const scenario of cases)
    it.each(exporters.map((render) => ({ name: render.name, render })))(
      `${scenario.name} $name preserves bands, row widths and unconfigured metrics`,
      ({ render }) => {
        const csv = render(scenario.report, scenario.baseline);
        const rows = csv
          .trimEnd()
          .split('\r\n')
          .map((line) =>
            [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
          );
        expect(rows.length).toBeGreaterThan(1);
        expect(new Set(rows[0]).size).toBe(rows[0].length);
        for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
        expect(csv).not.toMatch(/NaN|Infinity/);
        if (!scenario.report.ownedDomains.length)
          for (const [i, header] of rows[0].entries())
            if (header.includes('owned') && header.includes('percent'))
              for (const row of rows.slice(1)) expect(row[i]).toBe('');
      }
    );
  it.each(cases)('$name exposes measured length bands and omits answer text', ({ report }) => {
    expect(new Set(report.answerLengthProfiles?.map((p) => p.lengthBand)).size).toBe(5);
    const html = renderer.renderAiAnswerCitationObservationHtml(report);
    expect(html).toContain('Citation patterns by captured answer length');
    expect(html).not.toContain('word word word');
    expect(html).not.toMatch(/NaN%|Infinity%/);
  });
});
