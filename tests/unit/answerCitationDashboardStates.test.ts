import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import {
  analyzeAiAnswerCitationObservations,
  compareAiAnswerCitationObservationPeriods,
} from '../../src/geo/answerCitationObservations';
import {
  renderAiAnswerCitationObservationHtml,
  renderAiAnswerCitationSourceCategoryShareTrendsHtml,
  renderAiAnswerCitationSourceCategoryConcentrationTrendsHtml,
  renderAiAnswerCitationSourceCategoryMixDecompositionHtml,
} from '../../src/geo/answerCitationObservationsReporter';

function snapshot(complete: boolean, owned: boolean) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: ['2026-09-01', '2026-10-01'].flatMap((day) =>
        ['Search', 'Assistant'].flatMap((provider) =>
          [0, 1, 2].map((index) => ({
            observedAt: `${day}T00:00:00Z`,
            provider,
            prompt: `Guide ${index}`,
            answerText: 'PRIVATE ANSWER WORDS SHOULD NEVER APPEAR',
            citedUrls:
              owned && index < 2
                ? ['https://owned.example/guide', 'https://news.example/review']
                : ['https://news.example/review'],
            citationListComplete: complete,
            topic: 'guides',
            intent: 'research',
            model: 'model-v1',
            surface: 'web',
            locale: 'en-US',
          }))
        )
      ),
    },
    ['owned.example'],
    '2026-10-01T01:00:00Z',
    ['Aviary'],
    { includeCitationUrlPersistence: true }
  );
}
const baseline = snapshot(true, false);
const current = snapshot(true, true);
current.periodComparison = compareAiAnswerCitationObservationPeriods(baseline, current);
const incomplete = snapshot(false, true);
const categories = ['owned.example=Owned', 'news.example=News'];
function check(output: string) {
  const window = new Window();
  window.document.write(output);
  expect(window.document.title.length).toBeGreaterThan(0);
  expect(output).not.toContain('PRIVATE ANSWER WORDS SHOULD NEVER APPEAR');
  expect(output).not.toContain('NaN%');
  for (const table of window.document.querySelectorAll('table')) {
    const header = table.querySelector('thead tr:last-child');
    if (!header) continue;
    const columns = [...header.children].reduce(
      (n, c) => n + (Number(c.getAttribute('colspan')) || 1),
      0
    );
    for (const row of table.querySelectorAll('tbody tr'))
      expect(
        [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)
      ).toBe(columns);
  }
}
describe('citation dashboard evidence states', () => {
  it.each([
    { name: 'complete paired capture', report: current },
    { name: 'incomplete citation lists', report: incomplete },
    { name: 'single capture without owned reach', report: baseline },
  ])('$name retains readable private-answer-free output', ({ report }) =>
    check(renderAiAnswerCitationObservationHtml(report, categories, 5, 10, 0.5, 10, [], 20))
  );
  it('renders mapped monthly share and concentration dashboards', () => {
    check(renderAiAnswerCitationSourceCategoryShareTrendsHtml(current, categories));
    check(renderAiAnswerCitationSourceCategoryConcentrationTrendsHtml(current, categories));
  });
  it('renders paired category mix decomposition', () =>
    check(renderAiAnswerCitationSourceCategoryMixDecompositionHtml(current, baseline, categories)));
});
