import { describe, expect, it } from 'vitest';
import { analyzeAiCrawlerAccessLog } from '../../src/geo/aiCrawlerLogs';
import { compareAiCrawlerAccessLogs } from '../../src/geo/aiCrawlerLogComparison';

function analysis(
  rows: Array<{ timestamp: string; path: string; status: number; user_agent: string }>,
  sourceFile: string
) {
  return analyzeAiCrawlerAccessLog(rows.map((row) => JSON.stringify(row)).join('\n'), {
    sourceFile,
    aiReferralSources: [{ label: 'ChatGPT', value: 'chatgpt' }],
  });
}

describe('AI crawler access-log period comparison', () => {
  it('compares retained crawler paths, failure changes, and labeled referral samples', () => {
    const baseline = analysis(
      [
        {
          timestamp: '2026-09-01T10:00:00Z',
          path: '/article',
          status: 200,
          user_agent: 'GPTBot/1.0',
        },
        {
          timestamp: '2026-09-01T10:01:00Z',
          path: '/broken',
          status: 500,
          user_agent: 'GPTBot/1.0',
        },
        {
          timestamp: '2026-09-01T10:02:00Z',
          path: '/gone',
          status: 404,
          user_agent: 'ClaudeBot/1.0',
        },
        {
          timestamp: '2026-09-01T10:03:00Z',
          path: '/article?utm_source=chatgpt',
          status: 200,
          user_agent: 'Mozilla/5.0',
        },
      ],
      'baseline.jsonl'
    );
    const current = analysis(
      [
        {
          timestamp: '2026-10-01T10:00:00Z',
          path: '/article',
          status: 500,
          user_agent: 'GPTBot/1.0',
        },
        {
          timestamp: '2026-10-01T10:01:00Z',
          path: '/new',
          status: 200,
          user_agent: 'GPTBot/1.0',
        },
        {
          timestamp: '2026-10-01T10:02:00Z',
          path: '/new',
          status: 200,
          user_agent: 'Claude-SearchBot/1.0',
        },
        {
          timestamp: '2026-10-01T10:03:00Z',
          path: '/article?utm_source=chatgpt',
          status: 404,
          user_agent: 'Mozilla/5.0',
        },
      ],
      'current.jsonl'
    );

    const comparison = compareAiCrawlerAccessLogs(baseline, current);
    expect(comparison).toMatchObject({
      source: 'Aviary AI crawler log period comparison',
      schemaVersion: 1,
      baselineUniquePathsAcrossRecognizedBots: 3,
      currentUniquePathsAcrossRecognizedBots: 2,
    });
    expect(comparison.crawlers.map(({ token }) => token)).toEqual([
      'Claude-SearchBot',
      'ClaudeBot',
      'GPTBot',
    ]);
    expect(comparison.crawlers.find(({ token }) => token === 'GPTBot')).toMatchObject({
      baselineRequests: 2,
      currentRequests: 2,
      requestDelta: 0,
      sharedPathsWithNewFailures: 1,
      pathsOnlyInCurrentRetainedList: 1,
      pathsOnlyInBaselineRetainedList: 1,
    });
    expect(
      comparison.crawlers
        .find(({ token }) => token === 'GPTBot')
        ?.pathChanges.map(({ path, change }) => ({ path, change }))
    ).toEqual(
      expect.arrayContaining([
        { path: '/article', change: 'failure-emerged' },
        { path: '/new', change: 'current-only-retained' },
        { path: '/broken', change: 'baseline-only-retained' },
      ])
    );
    expect(comparison.aiReferralSources.find(({ source }) => source === 'ChatGPT')).toMatchObject({
      source: 'ChatGPT',
      comparisonAvailable: true,
      baselineRequests: 1,
      currentRequests: 1,
      requestDelta: 0,
    });
  });
});
