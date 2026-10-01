import { describe, expect, it } from 'vitest';
import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProfile,
} from '../../src/geo/answerCitationObservations';
import {
  analyzeAiAnswerCitationPromptFamilyPartition,
  renderAiAnswerCitationPromptFamiliesCsv,
  renderAiAnswerCitationPromptFamilySourceRarefactionCsv,
  renderAiAnswerCitationPromptSimilarityCsv,
} from '../../src/geo/answerCitationPromptSimilarity';

function profile(prompt: string, providers: string[] = ['Search']): AiAnswerCitationPromptProfile {
  return {
    prompt,
    observations: 1,
    uniqueProviders: providers.length,
    providers,
    observationsWithCitations: 1,
    observationsWithoutCitations: 0,
    citationEvents: 1,
    firstObservedAt: '2026-09-01T00:00:00.000Z',
    lastObservedAt: '2026-09-01T00:00:00.000Z',
    citedDomains: ['example.com'],
    citedDomainsTruncated: false,
    crossProviderCitedDomains: [],
    crossProviderCitedDomainsTruncated: false,
  };
}

function report(prompts: AiAnswerCitationPromptProfile[]): AiAnswerCitationObservationReport {
  return {
    prompts,
    promptsTruncated: false,
    ownedDomains: [],
    providers: [],
  } as unknown as AiAnswerCitationObservationReport;
}

describe('AI answer citation prompt similarity', () => {
  it('partitions connected lexical prompt families and preserves isolated prompts', () => {
    const input = report([
      profile('blue apples sweet fruit'),
      profile('blue apples ripe fruit'),
      profile('quantum computing qubits'),
    ]);

    const result = analyzeAiAnswerCitationPromptFamilyPartition(input, 0.1);

    expect(result.families.map((family) => family.map(({ prompt }) => prompt))).toEqual([
      ['blue apples ripe fruit', 'blue apples sweet fruit'],
      ['quantum computing qubits'],
    ]);
    expect(result.candidatePairsConsidered).toBeGreaterThan(0);
    expect(result.highFrequencyPostingCutoff).toBe(12);
    expect(result.candidatePairsCapped).toBe(false);
    expect(result.promptCatalogTruncated).toBe(false);
  });

  it('renders a headered CSV summary and formula-safe prompt/provider cells', () => {
    const csv = renderAiAnswerCitationPromptSimilarityCsv(
      report([
        profile('=blue apples sweet fruit', ['+Search']),
        profile('blue apples ripe fruit', ['Search']),
      ]),
      0.1
    );

    expect(csv.startsWith('"row_type","prompt_a","prompt_b",')).toBe(true);
    expect(csv).toContain('"summary"');
    expect(csv).toContain("'=blue apples sweet fruit");
    expect(csv).toContain("'+Search");
    expect(csv).toContain('"pair"');
  });

  it('reports articulation prompts in a connected family graph', () => {
    const input = report([
      profile('alpha omega'),
      profile('alpha bravo'),
      profile('bravo charlie'),
    ]);

    const csv = renderAiAnswerCitationPromptFamiliesCsv(input, 0.3);

    expect(csv).toContain('prompt_family_id');
    expect(csv).toContain('lexically-connected');
    expect(csv).toContain('articulation_prompts_json');
    expect(csv).toContain('alpha bravo');
    expect(csv).toContain('family-00001');
  });

  it('labels source rarefaction as a family-level sampling estimate', () => {
    const csv = renderAiAnswerCitationPromptFamilySourceRarefactionCsv(
      report([
        profile('blue apples sweet fruit'),
        profile('blue apples ripe fruit'),
        profile('quantum computing qubits'),
      ]),
      0.1,
      3
    );

    expect(csv).toContain('lexical-prompt-family');
    expect(csv).toContain('family_similarity_threshold');
    expect(csv).toContain('family_candidate_pairs_considered');
    expect(csv).toContain('Search');
  });

  it('rejects invalid similarity thresholds', () => {
    const input = report([]);
    expect(() => analyzeAiAnswerCitationPromptFamilyPartition(input, -0.01)).toThrow(
      'Prompt-family similarity threshold must be between 0 and 1.'
    );
    expect(() => renderAiAnswerCitationPromptSimilarityCsv(input, 1.01)).toThrow(
      'Prompt similarity threshold must be between 0 and 1.'
    );
  });
});
