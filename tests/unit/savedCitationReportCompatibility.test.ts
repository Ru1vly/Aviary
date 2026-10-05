import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import {
  analyzeAiAnswerCitationObservations,
  compareAiAnswerCitationObservationPeriods,
} from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationObservationsReporter';

function panel(provider: string, month: string, domain: string) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: [provider, 'Assistant'].flatMap((provider, engine) =>
        Array.from({ length: 6 }, (_, i) => ({
          provider,
          observedAt: `${month}-0${i + 1}T00:00:00Z`,
          prompt: `Explain topic ${i}`,
          topic: i % 2 ? 'guide' : undefined,
          intent: i % 3 ? 'research' : undefined,
          answerText: i % 2 ? 'Aviary Rival PRIVATE_CAPTURE' : 'Other PRIVATE_CAPTURE',
          citedUrls:
            i % 3
              ? [`https://${domain}/guide`, 'https://news.example/article']
              : engine
                ? []
                : ['https://reference.example/book'],
          citationListComplete: i % 2 === 0,
        }))
      ),
    },
    ['owned.example'],
    '2026-10-05T00:00:00Z',
    ['Aviary', 'Rival'],
    { pathFamilyDepth: 1, includeCitationUrlPersistence: true }
  );
}
const baseline = panel('Search', '2026-08', 'owned.example');
const fresh = panel('Search', '2026-10', 'owned.example');
function omitDeep(value: unknown, predicate: (key: string) => boolean) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (predicate(key)) delete (value as Record<string, unknown>)[key];
    else omitDeep((value as Record<string, unknown>)[key], predicate);
  }
}
function scenario(kind: string) {
  const current =
    kind === 'provider turnover'
      ? panel('Other', '2026-10', 'new.example')
      : structuredClone(fresh);
  const before = structuredClone(baseline);
  if (kind === 'missing intervals') {
    for (const report of [current, before])
      omitDeep(report, (key) => /ConfidenceInterval95Percent$/.test(key));
  }
  if (kind === 'missing rank reach') {
    for (const report of [current, before])
      omitDeep(report, (key) =>
        /^(promptsWithFirstPositionCitation|firstPositionPromptCoverage|promptsWithTopThreeCitation|topThreePromptCoverage)/.test(
          key
        )
      );
  }
  if (kind === 'missing completeness bounds') {
    for (const report of [current, before])
      omitDeep(report, (key) =>
        /^(incompleteCitationListObservations|observationsWithUnknownOwnedCitationState|promptsWithUnknownOwnedCitationState|ownedCitationCoverageAmongKnownObservations|ownedCitationCoverageUpperBound|ownedCitationPromptCoverageAmongKnownPrompts|ownedCitationPromptCoverageUpperBound)/.test(
          key
        )
      );
  }
  if (kind === 'capped retained catalogs') {
    current.domainsTruncated = true;
    current.citedPagesTruncated = true;
    current.promptsTruncated = true;
    for (const domain of current.domains) domain.sampleUrlsTruncated = true;
  }
  if (kind === 'missing concentration')
    for (const report of [current, before])
      omitDeep(report, (key) => /DomainConcentration$|^domainConcentration$/.test(key));
  if (kind === 'missing owned metrics')
    for (const report of [current, before])
      omitDeep(report, (key) =>
        /^(ownedCitationCoveragePercent|ownedCitationPromptCoveragePercent|ownedCitationEventSharePercent|ownedFirstCitationMeanReciprocalRankPercent|ownedCitationPositionBuckets)$/.test(
          key
        )
      );
  if (kind === 'bounded supplementary detail') {
    function cap(value: unknown) {
      if (!value || typeof value !== 'object') return;
      for (const key of Object.keys(value)) {
        if (
          key.endsWith('Truncated') &&
          typeof (value as Record<string, unknown>)[key] === 'boolean'
        )
          (value as Record<string, unknown>)[key] = true;
        else cap((value as Record<string, unknown>)[key]);
      }
    }
    cap(current);
  }
  if (kind === 'mixed optional monthly and review counts') {
    delete current.monthly[0].observationsWithOwnedCitation;
    delete current.monthly[0].ownedCitationEventSharePercent;
    delete current.reviewQueue[0].observationsWithOwnedCitation;
    current.monthly.push(structuredClone(before.monthly[0]));
  }
  current.periodComparison = compareAiAnswerCitationObservationPeriods(before, current);
  if (kind === 'legacy prompt provider detail')
    for (const report of [current, before])
      for (const prompt of report.prompts) delete prompt.providerProfiles;
  return { current, before };
}
const kinds = [
  'missing intervals',
  'missing rank reach',
  'missing completeness bounds',
  'capped retained catalogs',
  'missing concentration',
  'provider turnover',
  'missing owned metrics',
  'legacy prompt provider detail',
  'bounded supplementary detail',
  'mixed optional monthly and review counts',
];
const exporters = [
  renderer.renderAiAnswerCitationDomainPromptCoverageComparisonCsv,
  renderer.renderAiAnswerCitationOwnedRankComparisonCsv,
  renderer.renderAiAnswerCitationOwnedPromptRankComparisonCsv,
  renderer.renderAiAnswerCitationObservationComparisonCsv,
  renderer.renderAiAnswerCitationProviderOwnedGapComparisonCsv,
  renderer.renderAiAnswerCitationCompetitiveGapComparisonCsv,
  renderer.renderAiAnswerCitationEntityCitationDomainComparisonCsv,
  renderer.renderAiAnswerCitationEntityCitationPageComparisonCsv,
  renderer.renderAiAnswerCitationProviderPagePositionComparisonCsv,
];
function aligned(csv: string) {
  const rows = csv
    .trimEnd()
    .split('\r\n')
    .map((line) =>
      [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
    );
  expect(new Set(rows[0]).size).toBe(rows[0].length);
  for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
  expect(csv).not.toMatch(/NaN|Infinity|PRIVATE_CAPTURE/);
}
describe('older saved citation reports retain export contracts', () => {
  for (const kind of kinds) {
    it(`${kind} dashboard preserves captured totals and aligned tables`, () => {
      const { current } = scenario(kind);
      const html = renderer.renderAiAnswerCitationObservationHtml(current, [
        'owned.example=Owned',
        'news.example=News',
        'reference.example=Reference',
      ]);
      const window = new Window();
      window.document.write(html);
      expect(current.summary.observations).toBe(12);
      expect(window.document.querySelectorAll('table').length).toBeGreaterThan(5);
      for (const table of window.document.querySelectorAll('table')) {
        const columns = table.querySelectorAll(':scope > thead > tr:last-child > th').length;
        for (const row of table.querySelectorAll(':scope > tbody > tr'))
          expect(
            [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0),
            table.querySelector('thead')?.textContent
          ).toBe(columns);
      }
      expect(html).not.toMatch(/NaN%|Infinity%|PRIVATE_CAPTURE/);
      if (kind.startsWith('missing'))
        expect(html).toMatch(/unavailable|not available|not recorded|not configured/);
    });
    it.each(exporters.map((render) => ({ name: render.name, render })))(
      `${kind} $name preserves named columns and absent values`,
      ({ render }) => {
        const { current, before } = scenario(kind);
        if (
          kind === 'missing owned metrics' &&
          render === renderer.renderAiAnswerCitationOwnedRankComparisonCsv
        ) {
          expect(() => render(current, before)).toThrow(/same owned domains/);
          return;
        }
        if (
          kind === 'legacy prompt provider detail' &&
          [
            renderer.renderAiAnswerCitationProviderOwnedGapComparisonCsv,
            renderer.renderAiAnswerCitationCompetitiveGapComparisonCsv,
          ].includes(render)
        ) {
          expect(() => render(current, before)).toThrow(/retained provider-level/);
          return;
        }
        aligned(render(current, before));
      }
    );
  }
});
