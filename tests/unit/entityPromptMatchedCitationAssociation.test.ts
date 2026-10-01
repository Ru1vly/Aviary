import { describe, expect, it } from 'vitest';
import type { AiAnswerCitationObservationInput } from '../../src/geo/answerCitationObservations';
import { renderAiAnswerCitationEntityPromptMatchedAssociationCsv } from '../../src/geo/entityPromptMatchedCitationAssociation';

function observation(
  prompt: string,
  answerText: string,
  citedUrls: string[],
  citationListComplete = true
): AiAnswerCitationObservationInput {
  return {
    observedAt: '2026-09-12T10:00:00.000Z',
    provider: 'Search',
    prompt,
    answerText,
    citedUrls,
    citationListComplete,
    model: 'search-v2',
    surface: 'web',
    locale: 'en-US',
    topic: 'cat care',
    intent: 'research',
  };
}

describe('entity matched citation association', () => {
  it('compares owned citation reach across entity-mentioned and unmentioned matched prompts', () => {
    const prompts = [
      'Best food for an indoor cat',
      'How to choose senior cat nutrition',
      'Compare feline ingredient labels',
    ];
    const captures = prompts.flatMap((prompt, index) => [
      observation(prompt, `Aviary recommends a careful ingredient comparison, option ${index}.`, [
        'https://www.owned.example/guides/cat-food?campaign=sample',
      ]),
      observation(prompt, `Use an independent source for option ${index}.`, [
        'https://independent.example/review',
      ]),
    ]);

    const csv = renderAiAnswerCitationEntityPromptMatchedAssociationCsv(
      captures,
      ['Aviary=Aviary SEO|Aviary Search'],
      ['owned.example']
    );

    expect(csv.startsWith('row_type,')).toBe(true);
    expect(csv).toContain('entity-prompt-detail');
    expect(csv).toContain('matched-complete');
    expect(csv).toContain('entity-provider-summary');
    expect(csv).toContain('owned_citation_reach_difference_percentage_points');
    expect(csv).toContain('Aviary SEO; Aviary Search');
    expect(csv).toContain('100');
  });

  it('withholds matched estimates when no complete citation lists are available', () => {
    const csv = renderAiAnswerCitationEntityPromptMatchedAssociationCsv(
      [
        observation('Indoor cat food', 'Aviary describes options.', [], false),
        observation('Indoor cat food', 'Other options are available.', [], false),
      ],
      ['Aviary'],
      ['owned.example']
    );

    expect(csv).toContain('no-complete-citation-lists');
    expect(csv).toContain('no-comparison-with-two-nontied-prompts');
  });

  it('rejects invalid entity, domain, observation, and citation inputs', () => {
    const valid = observation('Indoor cat food', 'Aviary guide.', []);
    expect(() =>
      renderAiAnswerCitationEntityPromptMatchedAssociationCsv([], [], ['owned.example'])
    ).toThrow('at least one configured answer entity');
    expect(() =>
      renderAiAnswerCitationEntityPromptMatchedAssociationCsv([], ['Aviary'], [])
    ).toThrow('at least one --geo-answer-owned-domain');
    expect(() =>
      renderAiAnswerCitationEntityPromptMatchedAssociationCsv([], ['Aviary='], ['owned.example'])
    ).toThrow('Aliases for answer entity');
    expect(() =>
      renderAiAnswerCitationEntityPromptMatchedAssociationCsv(
        [valid],
        ['Aviary'],
        ['owned.example/path']
      )
    ).toThrow('Invalid owned domain');
    expect(() =>
      renderAiAnswerCitationEntityPromptMatchedAssociationCsv(
        [{ ...valid, citedUrls: ['ftp://owned.example'] }],
        ['Aviary'],
        ['owned.example']
      )
    ).toThrow('Cited URLs must be credential-free HTTP(S) URLs.');
    expect(() =>
      renderAiAnswerCitationEntityPromptMatchedAssociationCsv(
        [{ ...valid, observedAt: 'not a date' }],
        ['Aviary'],
        ['owned.example']
      )
    ).toThrow('Observation 1 is invalid for matched entity citation analysis.');
  });
});
