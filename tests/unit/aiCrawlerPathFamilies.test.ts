import { describe, expect, it } from 'vitest';
import { analyzeAiCrawlerAccessLog } from '../../src/geo/aiCrawlerLogs';
import {
  assessAiCrawlerPathFamilyFailureRise,
  renderAiCrawlerPathFamiliesCsv,
  renderAiCrawlerPathFamiliesHtml,
  renderAiCrawlerPathFamiliesJsonFromCsv,
  renderAiCrawlerPathFamilyFailureGateJson,
  renderAiCrawlerPathFamilyPeriodComparisonCsv,
  renderAiCrawlerPathFamilyPeriodComparisonHtml,
  renderAiCrawlerPathFamilyPeriodComparisonJsonFromCsv,
} from '../../src/geo/aiCrawlerPathFamilies';

function crawlerLog(statuses: number[], sourceFile: string) {
  const rows = statuses.map((status, index) =>
    JSON.stringify({
      timestamp: `2026-09-30T10:${String(index).padStart(2, '0')}:00Z`,
      path: `/guides/${100_000 + index}/cats?tracking=private`,
      status,
      user_agent: 'GPTBot/1.0',
      client_ip: '203.0.113.15',
    })
  );
  return analyzeAiCrawlerAccessLog(rows.join('\n'), { sourceFile });
}

describe('AI crawler route-family reports', () => {
  it('aggregates path IDs and statuses into a typed, privacy-safe offline report', () => {
    const analysis = crawlerLog([200, 301, 404, 500], 'nightly.jsonl');
    const csv = renderAiCrawlerPathFamiliesCsv([analysis]);

    expect(csv.split('\r\n')[0]).toContain('crawler_token');
    expect(csv).toContain('/guides/:id/*');
    expect(csv).toContain('\"50\"');
    expect(csv).not.toContain('tracking=private');
    expect(csv).not.toContain('203.0.113.15');

    const report = JSON.parse(renderAiCrawlerPathFamiliesJsonFromCsv(csv, [analysis]));
    expect(report).toMatchObject({
      source: 'Aviary AI crawler route-family inventory',
      schemaVersion: 1,
    });
    expect(report.rows[0]).toMatchObject({
      source_file: 'nightly.jsonl',
      crawler_token: 'GPTBot',
      provider: 'OpenAI',
      path_family: '/guides/:id/*',
      family_requests: 4,
      distinct_retained_paths: 4,
      successful_2xx_responses: 1,
      redirects_3xx: '1',
      client_errors_4xx: '1',
      server_errors_5xx: '1',
      failure_rate_percent: 50,
    });

    const html = renderAiCrawlerPathFamiliesHtml([analysis]);
    expect(html).toContain('Most requested route families');
    expect(html).toContain('family-data');
    expect(html).not.toContain('<script src=');
    expect(() => renderAiCrawlerPathFamiliesCsv([analysis], 6)).toThrow(
      'Crawler path-family depth must be an integer from 1 to 5.'
    );
  });

  it('detects supported failure-rate rises and pairs comparison rows by crawler and family', () => {
    const baseline = crawlerLog(
      Array.from({ length: 10 }, () => 200),
      'baseline.jsonl'
    );
    const current = crawlerLog(
      [500, 500, ...Array.from({ length: 8 }, () => 200)],
      'current.jsonl'
    );

    const gate = assessAiCrawlerPathFamilyFailureRise([baseline], [current], 10);
    expect(gate).toMatchObject({
      thresholdPercentagePoints: 10,
      minimumRequestsPerPeriod: 10,
      matchedFamilies: 1,
      matchedFamiliesCompared: 1,
      supportInsufficient: false,
      incomplete: false,
      familiesAboveThreshold: [
        {
          crawlerToken: 'GPTBot',
          pathFamily: '/guides/:id/*',
          baselineRequests: 10,
          currentRequests: 10,
          baselineFailureRatePercent: 0,
          currentFailureRatePercent: 20,
          increasePercentagePoints: 20,
        },
      ],
    });

    const comparison = renderAiCrawlerPathFamilyPeriodComparisonCsv([baseline], [current]);
    expect(comparison.split('\r\n')[0]).toContain('failure_rate_delta_percentage_points');
    expect(comparison).toContain('/guides/:id/*');
    expect(comparison).toContain('20');
    const comparisonJson = JSON.parse(
      renderAiCrawlerPathFamilyPeriodComparisonJsonFromCsv(comparison, [baseline], [current])
    );
    expect(comparisonJson).toMatchObject({
      source: 'Aviary AI crawler route-family period comparison',
      rows: [
        {
          change_state: 'matched-retained',
          crawler_token: 'GPTBot',
          path_family: '/guides/:id/*',
          failure_rate_delta_percentage_points: 20,
        },
      ],
    });
    expect(renderAiCrawlerPathFamilyPeriodComparisonHtml([baseline], [current])).toContain(
      'AI crawler route-family comparison'
    );
    expect(JSON.parse(renderAiCrawlerPathFamilyFailureGateJson(gate))).toMatchObject({
      source: 'Aviary AI crawler route-family failure gate',
      familiesAboveThreshold: [{ increasePercentagePoints: 20 }],
    });
    expect(() => assessAiCrawlerPathFamilyFailureRise([baseline], [], 10)).toThrow(
      'Crawler route-family failure checks require one baseline analysis paired with each current log input.'
    );
    expect(() => assessAiCrawlerPathFamilyFailureRise([baseline], [current], 101)).toThrow(
      'Crawler route-family failure-rise threshold must be from 0 to 100 percentage points.'
    );
    expect(() => assessAiCrawlerPathFamilyFailureRise([baseline], [current], 10, 2, 0)).toThrow(
      'Crawler route-family failure-rise minimum request support must be a positive integer.'
    );
  });
});
