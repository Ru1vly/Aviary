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

  it('renders monthly, provider, execution-context, and answer-length panels from varied captures', () => {
    const prompts = [
      'Which guide explains indoor cat nutrition?',
      'What food works best for a senior cat?',
      'How do I compare cat food ingredients?',
    ];
    const observations = ['2026-09-12', '2026-10-12'].flatMap((day, monthIndex) =>
      ['Search', 'Assistant'].flatMap((provider, providerIndex) =>
        prompts.map((prompt, promptIndex) => ({
          observedAt: `${day}T0${promptIndex}:00:00Z`,
          provider,
          prompt,
          answerText: `Compare ingredients and review nutrition label ${promptIndex}.`,
          citedUrls:
            (monthIndex + providerIndex + promptIndex) % 2 === 0
              ? ['https://owned.example/guides/cat-food', 'https://independent.example/review']
              : ['https://independent.example/review'],
          citationListComplete: (monthIndex + promptIndex) % 3 !== 0,
          topic: 'cat care',
          intent: promptIndex === 2 ? 'comparison' : 'research',
          model: providerIndex === 0 ? 'search-v2' : 'assistant-v3',
          surface: providerIndex === 0 ? 'web' : 'answer panel',
          locale: 'en-US',
        }))
      )
    );
    const report = analyzeAiAnswerCitationObservations(
      { schemaVersion: 1, observations },
      ['owned.example'],
      '2026-10-13T00:00:00Z',
      ['Aviary']
    );

    const html = renderAiAnswerCitationObservationHtml(report);

    expect(html).toContain('Citation coverage by recorded execution context');
    expect(html).toContain('Citation patterns by captured answer length');
    expect(html).toContain('research');
    expect(html).toContain('owned.example');
    expect(html).toContain('2026-09');
    expect(html).toContain('2026-10');

    const categorizedHtml = renderAiAnswerCitationObservationHtml(report, [
      'owned.example=Owned sources',
      'independent.example=Independent reviews',
    ]);
    expect(categorizedHtml).toContain('Operator-defined citation source categories');
    expect(categorizedHtml).toContain('Owned sources');
    expect(categorizedHtml).toContain('Independent reviews');
    expect(() => renderAiAnswerCitationObservationHtml(report, ['invalid mapping'])).toThrow(
      'Source-category mapping 1 must use hostname=category format.'
    );
  });
});
