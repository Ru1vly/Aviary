import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  parseAiAnswerCitationPromptPlanCohortTargets,
  renderAiAnswerCitationPromptPlanProviderPairsCsv,
  renderAiAnswerCitationPromptSamplingPlanCsv,
  renderAiAnswerCitationPromptSamplingPlanJson,
  summarizeAiAnswerCitationPromptPlanTargets,
} from '../../src/geo/answerCitationObservationsReporter';

function createPromptPlanReport() {
  const observations: Array<{
    observedAt: string;
    provider: string;
    prompt: string;
    citedUrls: string[];
    topic: string;
    intent: string;
  }> = [];
  let minute = 0;
  const add = (provider: string, topic: string, intent: string, prompts: string[]) => {
    for (const prompt of prompts) {
      observations.push({
        observedAt: new Date(Date.UTC(2026, 0, 1, 0, minute++)).toISOString(),
        provider,
        topic,
        intent,
        prompt,
        citedUrls: [],
      });
    }
  };

  add('A', 'cats', 'research', ['cat-1', 'cat-2', 'cat-3', 'cat-4']);
  add('B', 'cats', 'research', ['cat-1']);
  add('C', 'cats', 'research', ['cat-1', 'cat-2', 'cat-3', 'cat-4']);
  add('A', 'dogs', 'evaluation', ['dog-1', 'dog-2']);
  add('C', 'dogs', 'evaluation', ['dog-1', 'dog-2', 'dog-3', 'dog-4']);

  return analyzeAiAnswerCitationObservations(
    { schemaVersion: 1, observations },
    [],
    '2026-10-01T00:00:00Z'
  );
}

const cohortTargets = parseAiAnswerCitationPromptPlanCohortTargets({
  schemaVersion: 1,
  targets: [
    {
      topic: ' cats ',
      intent: 'research',
      minimumPromptsPerProviderCohort: 7,
      maximumPairedFollowUpGroups: 10,
    },
    {
      topic: 'dogs',
      intent: 'evaluation',
      minimumPromptsPerProviderCohort: 5,
      maximumPairedFollowUpGroups: 1,
    },
  ],
});

describe('AI answer prompt-panel plans', () => {
  it('normalizes versioned cohort targets and rejects malformed or ambiguous targets', () => {
    expect(cohortTargets[0]).toEqual({
      topic: 'cats',
      intent: 'research',
      minimumPromptsPerProviderCohort: 7,
      maximumPairedFollowUpGroups: 10,
    });
    expect(cohortTargets[1]).toEqual({
      topic: 'dogs',
      intent: 'evaluation',
      minimumPromptsPerProviderCohort: 5,
      maximumPairedFollowUpGroups: 1,
    });

    for (const invalid of [
      null,
      [],
      {},
      { schemaVersion: 2, targets: [] },
      { schemaVersion: 1, targets: [], extra: true },
      { schemaVersion: 1, targets: [null] },
      { schemaVersion: 1, targets: [{ topic: 'cats' }] },
      {
        schemaVersion: 1,
        targets: [{ topic: null, intent: null, minimumPromptsPerProviderCohort: 1 }],
      },
      { schemaVersion: 1, targets: [{ topic: 'cats', intent: 'research' }] },
      {
        schemaVersion: 1,
        targets: [
          { topic: ' Cats  ', intent: 'research', minimumPromptsPerProviderCohort: 1 },
          { topic: 'cats', intent: ' RESEARCH ', maximumPairedFollowUpGroups: 0 },
        ],
      },
      {
        schemaVersion: 1,
        targets: [{ topic: 'cats', intent: 'research', minimumPromptsPerProviderCohort: 0 }],
      },
      {
        schemaVersion: 1,
        targets: [{ topic: 'cats', intent: 'research', maximumPairedFollowUpGroups: 10_001 }],
      },
    ]) {
      expect(() => parseAiAnswerCitationPromptPlanCohortTargets(invalid)).toThrow();
    }
  });

  it('allocates one shared budget across provider pairs using balanced and proportional policies', () => {
    const report = createPromptPlanReport();
    const balanced = JSON.parse(
      renderAiAnswerCitationPromptSamplingPlanJson(
        report,
        0,
        undefined,
        0.75,
        undefined,
        cohortTargets,
        8,
        'balanced'
      )
    );
    const proportional = JSON.parse(
      renderAiAnswerCitationPromptSamplingPlanJson(
        report,
        0,
        undefined,
        0.75,
        undefined,
        cohortTargets,
        8,
        'proportional'
      )
    );

    expect(balanced).toMatchObject({
      schemaVersion: 1,
      rowCount: 12,
      targetsMet: false,
      targetSummary: {
        requiredPairedPromptGroups: 41,
        plannedPairedPromptGroups: 8,
        deferredPairedPromptGroups: 33,
        plannedPairedProviderCaptureRuns: 16,
        outputRowsTruncated: false,
      },
    });
    expect(balanced.targetSummary.providerPairBudgets).toEqual([
      {
        providerA: 'A',
        providerB: 'B',
        requiredPairedPromptGroups: 14,
        plannedPairedPromptGroups: 3,
        deferredPairedPromptGroups: 11,
        allocation: 'balanced',
      },
      {
        providerA: 'A',
        providerB: 'C',
        requiredPairedPromptGroups: 7,
        plannedPairedPromptGroups: 3,
        deferredPairedPromptGroups: 4,
        allocation: 'balanced',
      },
      {
        providerA: 'B',
        providerB: 'C',
        requiredPairedPromptGroups: 20,
        plannedPairedPromptGroups: 2,
        deferredPairedPromptGroups: 18,
        allocation: 'balanced',
      },
    ]);
    expect(proportional.targetSummary.providerPairBudgets).toEqual([
      {
        providerA: 'A',
        providerB: 'B',
        requiredPairedPromptGroups: 14,
        plannedPairedPromptGroups: 3,
        deferredPairedPromptGroups: 11,
        allocation: 'proportional',
      },
      {
        providerA: 'A',
        providerB: 'C',
        requiredPairedPromptGroups: 7,
        plannedPairedPromptGroups: 2,
        deferredPairedPromptGroups: 5,
        allocation: 'proportional',
      },
      {
        providerA: 'B',
        providerB: 'C',
        requiredPairedPromptGroups: 20,
        plannedPairedPromptGroups: 3,
        deferredPairedPromptGroups: 17,
        allocation: 'proportional',
      },
    ]);

    const csv = renderAiAnswerCitationPromptSamplingPlanCsv(
      report,
      0,
      undefined,
      0.75,
      undefined,
      cohortTargets,
      8,
      'balanced'
    );
    expect(csv).toMatch(/^"provider_a","provider_b","provider","topic"/u);
    expect(csv).toContain('"budget-constrained"');
    expect(csv.trimEnd().split('\r\n')).toHaveLength(13);

    const pairCsv = renderAiAnswerCitationPromptPlanProviderPairsCsv(
      report,
      0,
      undefined,
      0.75,
      undefined,
      cohortTargets,
      8,
      'proportional'
    );
    expect(pairCsv).toContain('"A","B","14","3","11","28","6"');
    expect(pairCsv).toContain('"A","C","7","2","5","14","4"');
    expect(pairCsv).toContain('"B","C","20","3","17","40","6"');

    const summary = summarizeAiAnswerCitationPromptPlanTargets(
      report,
      0,
      undefined,
      0.75,
      undefined,
      cohortTargets,
      8,
      'balanced'
    );
    expect(summary.plannedPairedPromptGroups).toBe(8);
    expect(summary.plannedPairedProviderCaptureRuns).toBe(16);
    expect(summary.targetsMet).toBe(false);
  });

  it('rejects invalid budget policies, bounds, and cohort labels that are absent from the sample', () => {
    const report = createPromptPlanReport();
    expect(() =>
      renderAiAnswerCitationPromptSamplingPlanCsv(
        report,
        0,
        undefined,
        undefined,
        undefined,
        [],
        5,
        'weighted' as never
      )
    ).toThrow('Total provider-pair allocation must be balanced or proportional.');
    expect(() =>
      renderAiAnswerCitationPromptSamplingPlanCsv(
        report,
        0,
        undefined,
        undefined,
        undefined,
        [],
        -1
      )
    ).toThrow('Maximum total paired follow-up prompt groups must be a non-negative safe integer.');
    expect(() =>
      renderAiAnswerCitationPromptSamplingPlanCsv(
        report,
        0,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        'proportional'
      )
    ).toThrow(
      'A non-default total provider-pair allocation requires a maximum total paired follow-up group budget.'
    );
    expect(() =>
      renderAiAnswerCitationPromptSamplingPlanCsv(report, 0, undefined, undefined, undefined, [
        { topic: 'birds', intent: 'research', minimumPromptsPerProviderCohort: 3 },
      ])
    ).toThrow('does not match a retained labeled cohort');
  });
});
