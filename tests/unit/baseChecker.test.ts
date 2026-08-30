import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { BaseChecker, CheckOutcome } from '../../src/checkers/base';
import { SEOConfig } from '../../src/config/types';

// A minimal test double exercising BaseChecker's contract without needing
// a real Page — checkAll() never touches `this.page`/`this.response` here.
class TestChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'always-pass', run: async (): Promise<CheckOutcome> => this.pass('ok') },
      { id: 'always-fail', run: async (): Promise<CheckOutcome> => this.fail('not ok', { reason: 'x' }) },
      {
        id: 'always-throws',
        run: async (): Promise<CheckOutcome> => {
          throw new Error('boom');
        },
      },
      { id: 'runs-after-throw', run: async (): Promise<CheckOutcome> => this.pass('still runs') },
    ];
  }
}

function makeChecker(config: SEOConfig = {}) {
  return new TestChecker({ page: {} as Page, config, checkerKey: 'metaTags' });
}

describe('BaseChecker', () => {
  it('stamps each result with its rule id as name', async () => {
    const results = await makeChecker().checkAll();
    expect(results.map((r) => r.name)).toEqual([
      'always-pass',
      'always-fail',
      'always-throws',
      'runs-after-throw',
    ]);
  });

  it('pass()/fail() shorthand produce correctly-shaped results', async () => {
    const results = await makeChecker().checkAll();
    expect(results[0]).toMatchObject({ passed: true, message: 'ok' });
    expect(results[1]).toMatchObject({ passed: false, message: 'not ok', details: { reason: 'x' } });
  });

  it('resolves severity from global config when nothing more specific is set', async () => {
    const results = await makeChecker({ severity: 'error' }).checkAll();
    expect(results[0].severity).toBe('error');
  });

  // The core reliability property: one check throwing must not prevent the
  // checker's other checks from running, and must not crash checkAll()
  // itself — it degrades to a single failed result for that one rule id.
  it('isolates a single check throwing to one failed result, without dropping subsequent checks', async () => {
    const results = await makeChecker().checkAll();

    const thrown = results.find((r) => r.name === 'always-throws');
    expect(thrown?.passed).toBe(false);
    expect(thrown?.message).toContain('boom');

    const after = results.find((r) => r.name === 'runs-after-throw');
    expect(after?.passed).toBe(true);
    expect(after?.message).toBe('still runs');
  });

  it('honours a per-rule { enabled: false } config by omitting that result entirely', async () => {
    const results = await makeChecker({
      rules: { metaTags: { 'always-fail': { enabled: false } } },
    }).checkAll();

    expect(results.map((r) => r.name)).not.toContain('always-fail');
    expect(results).toHaveLength(3);
  });

  it('honours checker-level { enabled: false } by skipping every check', async () => {
    const results = await makeChecker({
      rules: { metaTags: { enabled: false } },
    }).checkAll();

    expect(results).toHaveLength(0);
  });

  it('inherits checker-level severity for every check under that checker', async () => {
    const results = await makeChecker({
      severity: 'warning',
      rules: { metaTags: { enabled: true, severity: 'info' } },
    }).checkAll();

    expect(results.every((r) => r.severity === 'info')).toBe(true);
  });

  it('lets a specific check outcome override the config-resolved severity', async () => {
    class OverrideChecker extends BaseChecker {
      protected checks() {
        return [
          {
            id: 'critical-thing',
            run: async (): Promise<CheckOutcome> => ({
              passed: false,
              message: 'always error-severity regardless of config',
              severity: 'error',
            }),
          },
        ];
      }
    }
    const checker = new OverrideChecker({
      page: {} as Page,
      config: { severity: 'info' },
      checkerKey: 'metaTags',
    });

    const results = await checker.checkAll();
    expect(results[0].severity).toBe('error');
  });
});
