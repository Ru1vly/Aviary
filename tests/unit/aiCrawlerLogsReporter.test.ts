import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import {
  analyzeAiCrawlerAccessLog,
  analyzeAiCrawlerLogRobotsPolicy,
  compareAiCrawlerRobotsPolicyReplays,
  analyzeAiCrawlerSitemapRecrawlCoverage,
} from '../../src/geo/aiCrawlerLogs';
import { compareAiCrawlerAccessLogs } from '../../src/geo/aiCrawlerLogComparison';
import { renderAiCrawlerAccessLogHtml } from '../../src/geo/aiCrawlerLogsReporter';

const rows = [
  {
    timestamp: '2026-09-30T10:00:00Z',
    path: '/private?secret=private-value',
    status: 429,
    origin_status: 503,
    user_agent: 'GPTBot private-agent',
    response_time_ms: 1300,
    time_to_first_byte_ms: 300,
    edgeResultType: 'Error',
    edgeResponseResultType: 'OriginError',
    bot_score: 1,
    bot_score_src: 'Machine Learning',
    security_action: 'block',
    client_ip: '203.0.113.17',
  },
  {
    timestamp: '2026-09-30T12:00:00Z',
    path: '/guide',
    status: 200,
    user_agent: 'OAI-SearchBot',
    content_type: 'text/html',
    response_time_ms: 100,
    time_to_first_byte_ms: 40,
  },
];
const baseline = analyzeAiCrawlerAccessLog(
  JSON.stringify({ ...rows[1], timestamp: '2026-09-01T00:00:00Z' })
);
const current = analyzeAiCrawlerAccessLog(rows.map((row) => JSON.stringify(row)).join('\n'), {
  sourceFile: '<img src=x onerror=alert(1)>',
  ipRanges: [{ token: 'GPTBot', cidrs: ['203.0.113.0/24'] }],
});
const policy = analyzeAiCrawlerLogRobotsPolicy(
  current,
  'User-agent: GPTBot\nDisallow: /private',
  'https://example.com'
);
const beforePolicy = analyzeAiCrawlerLogRobotsPolicy(
  current,
  'User-agent: *\nDisallow:',
  'https://example.com'
);
const policyChange = compareAiCrawlerRobotsPolicyReplays(beforePolicy, policy);
const period = compareAiCrawlerAccessLogs(baseline, current);
const freshness = analyzeAiCrawlerSitemapRecrawlCoverage(
  current,
  [
    { url: 'https://example.com/guide', lastModified: '2026-10-01' },
    { url: 'https://example.com/new', lastModified: '2026-09-20' },
  ],
  'https://example.com',
  'https://example.com/sitemap.xml'
);

describe('crawler log dashboard optional evidence panels', () => {
  it.each([
    { name: 'robots replay', html: () => renderAiCrawlerAccessLogHtml([current], [], [policy]) },
    {
      name: 'robots change',
      html: () => renderAiCrawlerAccessLogHtml([current], [], [policy], [policyChange]),
    },
    {
      name: 'log period comparison',
      html: () => renderAiCrawlerAccessLogHtml([current], [], [], [], [period]),
    },
    {
      name: 'sitemap freshness',
      html: () => renderAiCrawlerAccessLogHtml([current], [], [], [], [], [freshness]),
    },
    {
      name: 'combined evidence',
      html: () =>
        renderAiCrawlerAccessLogHtml(
          [current],
          [],
          [policy],
          [policyChange],
          [period],
          [freshness]
        ),
    },
  ])('$name retains aligned tables and excludes private input fields', ({ html }) => {
    const output = html();
    const window = new Window();
    window.document.write(output);
    expect(window.document.querySelectorAll('table').length).toBeGreaterThan(0);
    for (const table of window.document.querySelectorAll('table')) {
      const columns = [...table.querySelectorAll('thead tr:last-child th')].reduce(
        (n, cell) => n + cell.colSpan,
        0
      );
      for (const row of table.querySelectorAll('tbody tr'))
        expect([...row.cells].reduce((n, cell) => n + cell.colSpan, 0)).toBe(columns);
    }
    expect(output).not.toContain('private-value');
    expect(output).not.toContain('private-agent');
    expect(output).not.toContain('203.0.113.17');
    expect(output).not.toContain('<img src=x');
    expect(output).toContain('&lt;img');
  });
});
