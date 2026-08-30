import { describe, it, expect, vi } from 'vitest';
import { Page } from 'playwright';
import { RobotsTxtChecker } from '../../src/checkers/robotsTxt';

// RobotsTxtChecker is the one checker wired to src/errors/ (via
// CheckerErrorHandler), so these tests exercise executeCheck, fetchWithRetry,
// and withGracefulDegradation end to end, not just robots.txt parsing.

function mockPageWithRobotsResponse(response: {
  status: number;
  text: string;
} | null): Page {
  const get = response
    ? vi.fn().mockResolvedValue({
        status: () => response.status,
        text: async () => response.text,
      })
    : vi.fn().mockRejectedValue(new Error('network error: ECONNREFUSED'));

  return {
    url: () => 'https://example.com/some-page',
    context: () => ({ request: { get } }),
  } as unknown as Page;
}

describe('RobotsTxtChecker', () => {
  it('passes when robots.txt exists and is well-formed', async () => {
    const page = mockPageWithRobotsResponse({
      status: 200,
      text: 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml',
    });
    const checker = new RobotsTxtChecker({ page, checkerKey: 'robotsTxt' });
    const results = await checker.checkAll();

    expect(results).toHaveLength(2);
    const [existsResult, accessibleResult] = results;

    expect(existsResult.passed).toBe(true);
    expect(existsResult.message).toContain('exists');

    expect(accessibleResult.passed).toBe(true);
    expect(accessibleResult.message).toContain('properly configured');
  });

  it('fails when robots.txt returns 404', async () => {
    const page = mockPageWithRobotsResponse({ status: 404, text: '' });
    const checker = new RobotsTxtChecker({ page, checkerKey: 'robotsTxt' });
    const results = await checker.checkAll();

    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('404');
  });

  it('flags a robots.txt that disallows all crawlers', async () => {
    const page = mockPageWithRobotsResponse({
      status: 200,
      text: 'User-agent: *\nDisallow: /',
    });
    const checker = new RobotsTxtChecker({ page, checkerKey: 'robotsTxt' });
    const results = await checker.checkAll();

    const accessibleResult = results[1];
    expect(accessibleResult.passed).toBe(false);
    expect(accessibleResult.details?.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('blocks all crawlers')])
    );
  });

  // Regression test for the severity-casing bug in withGracefulDegradation:
  // it used to write the internal (uppercase) ErrorSeverity enum value
  // directly into a field typed as the report's (lowercase) RuleSeverity,
  // so a degraded result's severity could never match 'error' | 'warning' |
  // 'info' and would silently render with no severity badge.
  it('degrades gracefully with a valid lowercase RuleSeverity when the network request keeps failing', async () => {
    const page = mockPageWithRobotsResponse(null); // always rejects
    const checker = new RobotsTxtChecker({ page, checkerKey: 'robotsTxt' });

    const results = await checker.checkAll();

    for (const result of results) {
      expect(result.severity).toBeDefined();
      expect(['error', 'warning', 'info']).toContain(result.severity);
      // Guards against the exact prior bug: ErrorSeverity enum values are
      // uppercase ('ERROR', 'WARNING', 'INFO') and would fail this.
      expect(result.severity).toBe(result.severity?.toLowerCase());
    }
  }, 15000); // retries with backoff, so this legitimately takes a few seconds
});
