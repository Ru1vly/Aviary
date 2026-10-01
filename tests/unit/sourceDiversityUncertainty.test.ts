import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  renderAiAnswerCitationSourceDiversityComparisonCsv,
  renderAiAnswerCitationSourceDiversityComparisonHtml,
  renderAiAnswerCitationSourceDiversityUncertaintyCsv,
  renderAiAnswerCitationSourceDiversityUncertaintyHtml,
} from '../../src/geo/answerCitationSourceDiversityUncertainty';

function createSourceDiversityReport() {
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

describe('AI answer source-diversity uncertainty reports', () => {
  it('renders deterministic prompt-cluster bootstrap CSV with event and rank metrics', () => {
    const report = createSourceDiversityReport();
    const csv = renderAiAnswerCitationSourceDiversityUncertaintyCsv(report);

    expect(csv).toContain('event_weighted_domain_hhi_ci95_lower');
    expect(csv).toContain('rank_weighted_domain_hhi_ci95_upper');
    expect(csv).toContain('event_hhi_leave_one_prompt_out_valid_groups');
    expect(csv).toContain('"provider","<AI & Provider>"');
    expect(csv).toContain('"available"');
    expect(renderAiAnswerCitationSourceDiversityUncertaintyCsv(report)).toBe(csv);
  });

  it('renders a standalone escaped dashboard with sample and uncertainty context', () => {
    const html = renderAiAnswerCitationSourceDiversityUncertaintyHtml(
      createSourceDiversityReport()
    );

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('AI answer source-diversity uncertainty');
    expect(html).toContain('Event-weighted source concentration');
    expect(html).toContain('Rank-weighted source concentration');
    expect(html).toContain('&lt;AI &amp; Provider&gt;');
    expect(html).not.toContain('<AI & Provider>');
    expect(html).not.toContain('https://cdn');
  });

  it('compares matched provider and prompt clusters with paired uncertainty output', () => {
    const report = createSourceDiversityReport();
    const csv = renderAiAnswerCitationSourceDiversityComparisonCsv(report, report);
    const html = renderAiAnswerCitationSourceDiversityComparisonHtml(report, report);

    expect(csv).toContain('hhi_change_ci95_lower');
    expect(csv).toContain('rank_weighted_hhi_change_ci95_upper');
    expect(csv).toContain('"provider","<AI & Provider>"');
    expect(csv).toContain('"available"');
    expect(html).toContain('<title>AI answer source-diversity change</title>');
    expect(html).toContain('Matched-provider detail');
    expect(html).toContain('&lt;AI &amp; Provider&gt;');
  });
});
