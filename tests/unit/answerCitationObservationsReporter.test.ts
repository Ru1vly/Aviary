import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import { renderAiAnswerCitationObservationHtml } from '../../src/geo/answerCitationObservationsReporter';

describe('observed AI-answer citation report', () => {
  it('renders a self-contained report while escaping captured provider and answer text', () => {
    const report = analyzeAiAnswerCitationObservations(
      {
        schemaVersion: 1,
        observations: [
          {
            observedAt: '2026-09-30T10:00:00Z',
            provider: '<Answer & Engine>',
            prompt: 'Which guide is best for indoor cats?',
            answerText: 'Start with <img src=x onerror=alert(1)> and compare food labels.',
            citedUrls: ['https://owned.example/guides/cats?session=private'],
            citationListComplete: true,
            topic: 'cat care',
            intent: 'research',
            model: 'sample-v1',
            surface: 'web search',
            locale: 'en-US',
          },
          {
            observedAt: '2026-09-30T10:05:00Z',
            provider: '<Answer & Engine>',
            prompt: 'How should I feed an indoor cat?',
            answerText: '</script><script>alert(2)</script>',
            citedUrls: ['https://independent.example/reviews/cat-food'],
            citationListComplete: false,
            topic: 'cat care',
            intent: 'research',
            model: 'sample-v1',
            surface: 'web search',
            locale: 'en-US',
          },
        ],
      },
      ['owned.example'],
      '2026-10-01T00:00:00Z',
      ['Aviary']
    );

    const html = renderAiAnswerCitationObservationHtml(report);
    expect(html).toContain('Aviary · GEO observatory');
    expect(html).toContain('Manually captured evidence');
    expect(html).toContain('complete citation lists');
    expect(html).toContain('&lt;Answer &amp; Engine&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('</script><script>alert(2)</script>');
    expect(html).not.toContain('session=private');
  });
});
