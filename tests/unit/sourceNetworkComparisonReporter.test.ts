import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import { renderAiAnswerCitationSourceNetworkComparisonHtml } from '../../src/geo/answerCitationSourceNetworkComparisonReporter';

function createNetworkReport() {
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
      citedUrls: ['https://alpha.example/a', 'https://gamma.example/c'],
      citationListComplete: true,
    },
  ]);
  return analyzeAiAnswerCitationObservations(
    { schemaVersion: 1, observations },
    [],
    '2026-10-01T00:00:00Z'
  );
}

describe('source-network comparison dashboard', () => {
  it('renders event and rank comparison data safely from headed CSV exports', () => {
    const report = createNetworkReport();
    const html = renderAiAnswerCitationSourceNetworkComparisonHtml(report, report);

    expect(html).toContain('<title>Aviary · Citation community drift</title>');
    expect(html).toContain('source-community-stability');
    expect(html).toContain('rank-weighted-community-stability');
    expect(html).toContain('\\u003cAI \\u0026 One\\u003e');
    expect(html).not.toContain('<AI & One>');
  });
});
