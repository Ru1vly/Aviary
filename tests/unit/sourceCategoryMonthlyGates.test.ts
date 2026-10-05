import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  assessAiAnswerCitationSourceCategoryMonthlyJsdGate as jsd,
  assessAiAnswerCitationSourceCategoryMonthlyHhiRiseGate as rise,
  assessAiAnswerCitationSourceCategoryMonthlyHhiAboveGate as above,
  assessAiAnswerCitationSourceCategoryShareDropGate as drop,
} from '../../src/geo/answerCitationObservationsReporter';

const mappings = ['news.example=News', 'reference.example=Reference'];
function panel(concentrated = true, labeled = true) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: ['2026-08-01', '2026-10-01'].flatMap((day, month) =>
        ['Search', 'Assistant'].flatMap((provider) =>
          Array.from({ length: 12 }, (_, index) => ({
            observedAt: `${day}T00:00:00Z`,
            provider,
            prompt: `Question ${index}`,
            citedUrls:
              month && concentrated
                ? ['https://news.example/new']
                : ['https://news.example/old', 'https://reference.example/old'],
            citationListComplete: true,
            ...(labeled ? { topic: 'guides', intent: 'research' } : {}),
          }))
        )
      ),
    },
    ['news.example'],
    '2026-10-05T00:00:00Z'
  );
}
const shifted = panel();
const unchanged = panel(false);

describe('monthly source-category release gates', () => {
  it.each([true, false])('measures a 0.5 HHI rise with labeled=%s', (labeled) => {
    const report = labeled ? shifted : panel(true, false);
    for (const basis of ['all-citations', 'top-three'] as const) {
      const result = rise(report, mappings, 0.49, 10, basis);
      expect(result.complete).toBe(true);
      expect(result.exceededCohortMonthCount).toBeGreaterThan(0);
      expect(result.exceededCohortMonthCount).toBe(result.comparableCohortMonths);
      for (const row of result.exceededCohortMonths) {
        expect(row).toMatchObject({
          previousMonth: '2026-08',
          month: '2026-10',
          previousHhi: 0.5,
          currentHhi: 1,
          rise: 0.5,
        });
      }
      expect(rise(report, mappings, 0.5, 10, basis).exceededCohortMonthCount).toBe(0);
      expect(above(report, mappings, 0.75, 10, basis).exceededCohortMonthCount).toBe(
        result.comparableCohortMonths
      );
      expect(above(report, mappings, 1, 10, basis).exceededCohortMonthCount).toBe(0);
    }
  });
  it('reports a 50-point reference-share loss with a strict threshold', () => {
    const result = drop(shifted, mappings, 49);
    expect(result.complete).toBe(true);
    expect(result.exceededCategoryCohortMonthCount).toBeGreaterThan(0);
    for (const row of result.exceededCategoryCohortMonths)
      expect(row).toMatchObject({ category: 'Reference', declinePercentagePoints: 50 });
    expect(drop(shifted, mappings, 50).exceededCategoryCohortMonthCount).toBe(0);
  });
  it('measures source turnover but passes an unchanged panel', () => {
    const result = jsd(shifted, mappings, 0.1);
    expect(result.complete).toBe(true);
    expect(result.exceededCohortMonthCount).toBeGreaterThan(0);
    for (const row of result.exceededCohortMonths) expect(row.jsdBits).toBeCloseTo(0.311278, 5);
    expect(jsd(shifted, mappings, 1).exceededCohortMonthCount).toBe(0);
    expect(jsd(unchanged, mappings, 0).exceededCohortMonthCount).toBe(0);
    expect(rise(unchanged, mappings, 0).exceededCohortMonthCount).toBe(0);
    expect(drop(unchanged, mappings, 0).exceededCategoryCohortMonthCount).toBe(0);
  });
  it.each([jsd, rise, above, drop])('%s withholds completeness below support', (gate) => {
    const result = gate(shifted, mappings, 0.1, 1000);
    expect(result.complete).toBe(false);
    expect(
      'belowSupportCohortMonths' in result
        ? result.belowSupportCohortMonths
        : result.belowSupportCategoryCohortMonths
    ).toBeGreaterThan(0);
  });
  it.each([jsd, rise, above, drop])(
    '%s withholds completeness for capped monthly detail',
    (gate) => {
      const capped = structuredClone(shifted);
      capped.topicIntentProviderMonthlyTruncated = true;
      expect(gate(capped, mappings, 0.1).complete).toBe(false);
      expect(gate(capped, ['unobserved.example=Unobserved'], 0.1).complete).toBe(false);
    }
  );
  it.each([jsd, rise, above, drop])('%s rejects invalid thresholds and support', (gate) => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => gate(shifted, mappings, value)).toThrow(RangeError);
    expect(() => gate(shifted, mappings, gate === drop ? 101 : 1.01)).toThrow(RangeError);
    for (const support of [0, 1.5, 1_000_001, Number.NaN])
      expect(() => gate(shifted, mappings, 0.1, support)).toThrow(RangeError);
  });
  it.each([rise, above])('%s rejects unsupported rank bases', (gate) => {
    expect(() => gate(shifted, mappings, 0.1, 10, 'invalid' as 'top-three')).toThrow(/basis/);
  });
  for (const state of [
    'missing domain profiles',
    'capped domain profiles',
    'missing previous month',
  ] as const) {
    it.each([jsd, rise, above, drop].map((gate) => ({ name: gate.name, gate })))(
      `${state}: $name preserves incomplete support`,
      ({ gate }) => {
        const partial = structuredClone(shifted);
        if (state === 'missing previous month') {
          partial.topicIntentProviderMonthly = partial.topicIntentProviderMonthly?.filter(
            (profile) => profile.month === '2026-10'
          );
        } else {
          for (const profile of partial.topicIntentProviderMonthly ?? []) {
            if (state === 'missing domain profiles') delete profile.citationDomainProfiles;
            else profile.citationDomainProfilesTruncated = true;
          }
        }
        const result = gate(partial, mappings, 0.1);
        if (state === 'missing previous month' && gate === above) {
          expect(result.complete).toBe(true);
          expect('evaluatedCohortMonths' in result && result.evaluatedCohortMonths).toBeGreaterThan(
            0
          );
          return;
        }
        expect(result.complete).toBe(false);
        if (state === 'missing domain profiles' && gate === drop) {
          expect(
            'comparableCategoryCohortMonths' in result && result.comparableCategoryCohortMonths
          ).toBe(0);
          return;
        }
        expect(
          'incompleteCohortMonths' in result
            ? result.incompleteCohortMonths
            : result.incompleteCategoryCohortMonths
        ).toBeGreaterThan(0);
      }
    );
  }
});
