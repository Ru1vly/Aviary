import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import { renderAiAnswerCitationProviderSourceNetworkEdgeHtml } from '../../src/geo/answerCitationProviderSourceNetworkEdgeReporter';
import { renderAiAnswerCitationProviderSourceNetworkOverlapCsv } from '../../src/geo/answerCitationProviderSourceNetworkOverlap';

function createProviderEdgeReport() {
  const observations = ['Question one', 'Question two'].flatMap((prompt, index) => [
    {
      observedAt: `2026-09-30T10:${String(index * 10).padStart(2, '0')}:00Z`,
      provider: '<AI & One>',
      prompt,
      citedUrls: ['https://alpha.example/a', 'https://beta.example/b'],
      citationListComplete: true,
    },
    {
      observedAt: `2026-09-30T10:${String(index * 10 + 1).padStart(2, '0')}:00Z`,
      provider: 'AI Two',
      prompt,
      citedUrls: ['https://alpha.example/a', 'https://beta.example/b'],
      citationListComplete: true,
    },
  ]);
  return analyzeAiAnswerCitationObservations(
    { schemaVersion: 1, observations },
    [],
    '2026-10-01T00:00:00Z'
  );
}

describe('provider source-network edge comparison dashboard', () => {
  it('reads comparison summary and provider names from its CSV export', () => {
    const report = createProviderEdgeReport();
    const csv = renderAiAnswerCitationProviderSourceNetworkOverlapCsv(report);
    const html = renderAiAnswerCitationProviderSourceNetworkEdgeHtml(report);

    expect(csv.startsWith('"row_type","provider')).toBe(true);
    expect(html).toContain('"providerPairsEvaluated":1');
    expect(html).toContain('\\u003cAI \\u0026 One\\u003e');
    expect(html).not.toContain('<AI & One>');
  });
});
