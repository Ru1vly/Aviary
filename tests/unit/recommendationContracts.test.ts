import { describe, expect, it } from 'vitest';
import { generateSEORecommendations } from '../../src/recommendations';
import { CHECKER_REGISTRY, type CheckerKey } from '../../src/checkers/registry';
import type { SEOCheckResult, SEOReport } from '../../src/types';
function report(category: CheckerKey, check: SEOCheckResult): SEOReport {
  const checks = Object.fromEntries(
    CHECKER_REGISTRY.map(({ key }) => [key, []])
  ) as SEOReport['checks'];
  checks[category] = [check];
  return {
    url: 'https://example.com',
    timestamp: '2026-10-01T00:00:00Z',
    checks,
    score: 0,
    summary: { total: 1, passed: 0, failed: 1 },
  };
}
describe('recommendation contracts', () => {
  it.each(CHECKER_REGISTRY.map(({ key, label }) => [key, label] as const))(
    '%s has a named actionable fallback',
    (key, label) => {
      const result = generateSEORecommendations(
        report(key, {
          name: 'generic-finding',
          passed: false,
          message: 'Review this finding',
          severity: 'warning',
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        category: key,
        categoryLabel: label,
        priority: 'medium',
        quickWin: false,
      });
      expect(result[0].action.length).toBeGreaterThan(15);
      expect(result[0].example).toBeUndefined();
    }
  );
  it.each([
    ['metaTags', 'Title missing', '<title>'],
    ['metaTags', 'Meta description missing', 'name="description"'],
    ['metaTags', 'Canonical missing', 'rel="canonical"'],
    ['metaTags', 'Viewport missing', 'name="viewport"'],
    ['metaTags', 'Open graph missing', 'og:title'],
    ['headings', 'No H1 found', '<h1>'],
    ['images', 'Alt text missing', 'alt="'],
    ['accessibility', 'Form label missing', '<label'],
    ['accessibility', 'Interactive elements missing labels', 'aria-label'],
    ['uiElements', 'No favicon found', 'rel="icon"'],
    ['uiElements', 'Language missing', 'lang="en"'],
    ['structuredData', 'JSON-LD missing', 'schema.org'],
  ] as const)('%s %s supplies a relevant example', (category, message, expected) => {
    const result = generateSEORecommendations(report(category, { passed: false, message }));
    expect(result[0].example?.code).toContain(expected);
  });
  it.each([
    ['error', 'high'],
    ['warning', 'medium'],
    ['info', 'low'],
    [undefined, 'medium'],
  ] as const)('uses %s severity priority %s', (severity, priority) => {
    const result = generateSEORecommendations(
      report('content', { passed: false, message: 'Content needs review', severity })
    );
    expect(result[0].priority).toBe(priority);
  });
  it('omits passed findings and keeps skipped checks from suggesting page edits', () => {
    expect(
      generateSEORecommendations(report('images', { passed: true, message: 'Alt text valid' }))
    ).toEqual([]);
    const result = generateSEORecommendations(
      report('images', {
        passed: false,
        message: 'Skipped due to error: unavailable',
        severity: 'info',
      })
    );
    expect(result[0]).toMatchObject({ priority: 'low', scoreLift: null, quickWin: false });
    expect(result[0].action).toContain('run the check again');
    expect(result[0].example).toBeUndefined();
  });
  it('deduplicates configured security header targets and discards non-string diagnostics', () => {
    const result = generateSEORecommendations(
      report('security', {
        name: 'security-headers',
        passed: false,
        message: 'Headers missing',
        details: {
          missing: ['X-Frame-Options', 'X-Frame-Options', 4],
          invalid: ['Content-Security-Policy'],
          diagnostics: ['Use a valid policy', 5],
        },
      })
    );
    expect(result[0].action).toBe(
      'Configure X-Frame-Options, Content-Security-Policy on page responses at the server or CDN. Use a valid policy'
    );
    expect(
      generateSEORecommendations(
        report('security', { name: 'security-headers', passed: false, message: 'Headers missing' })
      )[0].action
    ).toContain('reported security headers');
  });
});
