import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  renderAiAnswerCitationSourceNetworkCsv,
  renderAiAnswerCitationSourceNetworkComparisonCsv,
} from '../../src/geo/answerCitationSourceNetwork';
import {
  renderAiAnswerCitationRankWeightedSourceNetworkCsv,
  renderAiAnswerCitationRankWeightedSourceNetworkComparisonCsv,
} from '../../src/geo/answerCitationRankWeightedSourceNetwork';
import {
  renderAiAnswerCitationProviderSourceNetworkOverlapCsv,
  renderAiAnswerCitationProviderSourceNetworkEdgeComparisonCsv,
} from '../../src/geo/answerCitationProviderSourceNetworkOverlap';
import { renderAiAnswerCitationProviderSourceNetworkEdgeDriftCsv } from '../../src/geo/answerCitationProviderSourceNetworkEdgeDrift';
import {
  renderAiAnswerCitationSourceDiversityUncertaintyCsv,
  renderAiAnswerCitationSourceDiversityComparisonCsv,
  renderAiAnswerCitationSourceDiversityComparisonHtml,
} from '../../src/geo/answerCitationSourceDiversityUncertainty';

function panel(provider = 'Search', uncited = false) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: [provider, 'Assistant'].flatMap((provider, engine) =>
        [0, 1, 2].map((prompt) => ({
          provider,
          prompt: `Question ${prompt}`,
          observedAt: '2026-10-01T00:00:00Z',
          citedUrls: uncited
            ? []
            : engine && prompt === 2
              ? ['https://other.example/new']
              : ['https://owned.example/a', `https://source${prompt}.example/a`],
          citationListComplete: true,
        }))
      ),
    },
    ['owned.example'],
    '2026-10-05T00:00:00Z'
  );
}
const baseline = panel();
const incomplete = structuredClone(baseline);
incomplete.promptsTruncated = true;
const legacy = structuredClone(baseline);
for (const prompt of legacy.prompts) delete prompt.providerProfiles;
const unknownRanks = structuredClone(baseline);
for (const prompt of unknownRanks.prompts)
  for (const provider of prompt.providerProfiles ?? []) {
    delete provider.rankWeightedDomainCitationEvents;
    delete provider.rankWeightedCitationWeightTotal;
  }
const domainCap = structuredClone(baseline);
for (const prompt of domainCap.prompts)
  for (const provider of prompt.providerProfiles ?? []) provider.citedDomainsTruncated = true;
const cases = [
  { name: 'one-sided provider', report: panel('Other') },
  { name: 'no source events', report: panel('Search', true) },
  { name: 'capped prompt catalog', report: incomplete },
  { name: 'legacy provider detail', report: legacy },
  { name: 'unavailable rank weights', report: unknownRanks },
  { name: 'capped domain detail', report: domainCap },
];
const exports = [
  renderAiAnswerCitationSourceNetworkCsv,
  renderAiAnswerCitationSourceNetworkComparisonCsv,
  renderAiAnswerCitationRankWeightedSourceNetworkCsv,
  renderAiAnswerCitationRankWeightedSourceNetworkComparisonCsv,
  renderAiAnswerCitationProviderSourceNetworkOverlapCsv,
  renderAiAnswerCitationProviderSourceNetworkEdgeComparisonCsv,
  renderAiAnswerCitationProviderSourceNetworkEdgeDriftCsv,
  renderAiAnswerCitationSourceDiversityUncertaintyCsv,
  renderAiAnswerCitationSourceDiversityComparisonCsv,
];
describe('source-network incomplete evidence contracts', () => {
  for (const scenario of cases)
    it.each(exports.map((render) => ({ name: render.name, render })))(
      `${scenario.name} $name preserves named CSV fields`,
      ({ render }) => {
        const csv = render(scenario.report, baseline);
        const rows = csv
          .trimEnd()
          .split('\r\n')
          .map((line) =>
            [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
          );
        expect(rows[0].length).toBeGreaterThan(1);
        expect(new Set(rows[0]).size).toBe(rows[0].length);
        for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
        expect(csv).not.toMatch(/NaN|Infinity/);
      }
    );
  it.each(cases)('$name diversity dashboard leaves missing support visible', ({ report }) => {
    const html = renderAiAnswerCitationSourceDiversityComparisonHtml(report, baseline);
    expect(html).toContain('Matched-provider detail');
    expect(html).not.toMatch(/NaN%|Infinity%/);
  });
});
