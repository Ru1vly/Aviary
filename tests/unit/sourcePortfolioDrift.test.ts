import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  renderAiAnswerCitationSourcePortfolioDriftCsv,
  renderAiAnswerCitationSourcePortfolioDriftHtml,
  renderAiAnswerCitationSourcePortfolioDriftJson,
} from '../../src/geo/answerCitationSourcePortfolioDrift';

function createSourcePortfolioReport() {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: [
        {
          observedAt: '2026-09-30T10:00:00Z',
          provider: '<AI & Provider>',
          prompt: 'Question one',
          citedUrls: ['https://alpha.example/a', 'https://beta.example/b'],
          citationListComplete: true,
        },
        {
          observedAt: '2026-09-30T10:05:00Z',
          provider: '<AI & Provider>',
          prompt: 'Question two',
          citedUrls: ['https://alpha.example/c', 'https://gamma.example/d'],
          citationListComplete: true,
        },
      ],
    },
    [],
    '2026-10-01T00:00:00Z'
  );
}

describe('AI answer source-portfolio drift reports', () => {
  it('includes CSV headers so companion HTML and JSON preserve provider records', () => {
    const report = createSourcePortfolioReport();
    const csv = renderAiAnswerCitationSourcePortfolioDriftCsv(report, report);
    const html = renderAiAnswerCitationSourcePortfolioDriftHtml(report, report);
    const json = JSON.parse(renderAiAnswerCitationSourcePortfolioDriftJson(report, report)) as {
      summary: Record<string, unknown>;
      providerRows: Array<Record<string, unknown>>;
    };

    expect(csv.startsWith('"row_type","provider",')).toBe(true);
    expect(csv).toContain('"provider","<AI & Provider>"');
    expect(html).toContain('Provider detail');
    expect(html).toContain('\\u003cAI \\u0026 Provider\\u003e');
    expect(html).not.toContain('<AI & Provider>');
    expect(json.summary.row_type).toBe('summary');
    expect(json.providerRows).toHaveLength(1);
    expect(json.providerRows[0]?.provider).toBe('<AI & Provider>');
  });
});
