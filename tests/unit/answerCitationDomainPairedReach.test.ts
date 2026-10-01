import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  assessAiAnswerCitationDomainPairedReachDropGate,
  renderAiAnswerCitationDomainPairedReachComparisonCsv,
  renderAiAnswerCitationDomainPairedReachDropGateJson,
} from '../../src/geo/answerCitationDomainPairedReach';

function report(citationHosts: string[]) {
  const observations = citationHosts.map((host, index) => ({
    observedAt: '2026-09-12T10:00:00.000Z',
    provider: 'Search',
    prompt: `cat food guide ${index + 1}`,
    citedUrls: [`https://${host}/review`],
    citationListComplete: true,
  }));
  return analyzeAiAnswerCitationObservations(
    { schemaVersion: 1, observations },
    [],
    '2026-10-01T00:00:00.000Z'
  );
}

describe('domain paired citation reach', () => {
  it('calculates a supported domain decline and fails the configured gate', () => {
    const baseline = report(Array.from({ length: 10 }, () => 'owned.example'));
    const current = report(Array.from({ length: 10 }, () => 'independent.example'));
    const csv = renderAiAnswerCitationDomainPairedReachComparisonCsv(current, baseline);
    const assessment = assessAiAnswerCitationDomainPairedReachDropGate(
      current,
      baseline,
      50,
      0.01,
      10
    );

    expect(csv).toContain('"row_type"');
    expect(csv).toContain('"owned.example"');
    expect(assessment).toMatchObject({
      complete: true,
      exceeded: true,
      evaluatedComparisons: 2,
      eligibleComparisons: 2,
      failures: [
        expect.objectContaining({
          domain: 'owned.example',
          comparablePromptGroups: 10,
          lostPrompts: 10,
          reachChangePercentagePoints: -100,
        }),
      ],
    });
    expect(
      JSON.parse(renderAiAnswerCitationDomainPairedReachDropGateJson(assessment))
    ).toMatchObject({
      source: 'Aviary domain paired-reach drop gate assessment',
      schemaVersion: 1,
      exceeded: true,
    });
  });

  it('reports an incomplete gate when matched prompt support is below the minimum', () => {
    const baseline = report(['owned.example']);
    const current = report(['independent.example']);
    const assessment = assessAiAnswerCitationDomainPairedReachDropGate(
      current,
      baseline,
      10,
      0.05,
      2
    );

    expect(assessment.complete).toBe(false);
    expect(assessment.exceeded).toBe(false);
    expect(assessment.eligibleComparisons).toBe(0);
    expect(assessment.incompleteReasons).toContain(
      'no complete domain/provider comparison meets the 2-prompt support floor'
    );
  });
});
