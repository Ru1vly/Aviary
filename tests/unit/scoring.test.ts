import { describe, it, expect } from 'vitest';
import { calculateWeightedScore } from '../../src/scoring';
import type { SEOCheckResult } from '../../src/types';
import scoringParityFixture from '../fixtures/scoring-parity.json';

function check(passed: boolean, severity?: SEOCheckResult['severity']): SEOCheckResult {
  return { passed, message: 'x', severity };
}

describe('calculateWeightedScore', () => {
  it('returns null, not a magic 0 or 100, when there is nothing to weigh', () => {
    expect(calculateWeightedScore([])).toBeNull();
  });

  it('returns 100 when every check passed', () => {
    expect(
      calculateWeightedScore([check(true, 'error'), check(true, 'warning'), check(true, 'info')])
    ).toBe(100);
  });

  it('returns 0 when every check failed', () => {
    expect(
      calculateWeightedScore([check(false, 'error'), check(false, 'warning'), check(false, 'info')])
    ).toBe(0);
  });

  it('weights error/warning/info at 3/1/0.5', () => {
    // One passed error (weight 3) out of error+warning+info (3+1+0.5=4.5) → 3/4.5 = 66.67% → 67
    const score = calculateWeightedScore([
      check(true, 'error'),
      check(false, 'warning'),
      check(false, 'info'),
    ]);
    expect(score).toBe(67);
  });

  it('treats an unset severity as warning weight (1)', () => {
    expect(calculateWeightedScore([check(true), check(false, 'warning')])).toBe(50);
  });

  // Shared with engine/src/lib.rs's own parity test (`cargo test scoring_parity`),
  // which loads this exact file — a change to either engine's weights that isn't
  // mirrored in the other fails whichever test runs against the stale value.
  describe('parity fixture (tests/fixtures/scoring-parity.json, shared with the Rust engine)', () => {
    for (const testCase of scoringParityFixture.cases) {
      it(testCase.name, () => {
        const checks = testCase.checks.map((c) =>
          check(c.passed, c.severity as SEOCheckResult['severity'])
        );
        expect(calculateWeightedScore(checks)).toBe(testCase.expectedScore);
      });
    }
  });
});
