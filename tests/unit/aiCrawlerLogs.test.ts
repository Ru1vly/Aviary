import { describe, expect, it } from 'vitest';
import {
  analyzeAiCrawlerAccessLog,
  analyzeAiCrawlerLogRobotsPolicy,
  analyzeAiCrawlerSitemapRecrawlCoverage,
} from '../../src/geo/aiCrawlerLogs';
import { renderAiCrawlerAccessLogHtml } from '../../src/geo/aiCrawlerLogsReporter';

describe('analyzeAiCrawlerAccessLog', () => {
  it('normalizes paths, groups crawler activity, and retains no client IP or raw user agent', () => {
    const rows = [
      '203.0.113.10 - - [30/Sep/2026:10:00:00 +0000] "GET /guide?secret=123 HTTP/1.1" 200 300 "-" "Mozilla/5.0 GPTBot/1.0"',
      JSON.stringify({
        timestamp: '2026-09-30T10:05:00Z',
        path: '/guide?secret=456',
        status: 503,
        user_agent: 'OAI-SearchBot',
        client_ip: '198.51.100.20',
        content_type: 'text/html; charset=UTF-8',
      }),
      JSON.stringify({
        timestamp: '2026-09-30T10:06:00Z',
        path: '/guide?secret=789',
        status: 200,
        user_agent: 'Claude-SearchBot',
      }),
      JSON.stringify({
        timestamp: '2026-09-30T10:10:00Z',
        path: '/custom',
        status: 200,
        user_agent: 'CustomIndexer',
      }),
      JSON.stringify({ timestamp: '2026-09-30T10:15:00Z', path: '/no-agent', status: 200 }),
      'not a valid request log',
    ].join('\n');

    const analysis = analyzeAiCrawlerAccessLog(rows, {
      customTokens: ['CustomIndexer'],
      ipRanges: [{ token: 'GPTBot', cidrs: ['203.0.113.0/24'] }],
    });
    const getCrawler = (token: string) =>
      analysis.crawlers.find((crawler) => crawler.token === token)!;

    expect(analysis).toMatchObject({
      schemaVersion: 1,
      linesRead: 6,
      parsedRequests: 5,
      parsedCombinedLogLines: 1,
      parsedJsonLines: 4,
      skippedLines: 1,
      requestsWithoutUserAgent: 1,
      uniquePathsAcrossRecognizedBots: 2,
    });
    expect(getCrawler('GPTBot')).toMatchObject({
      activity: 'training-data-crawl',
      requests: 1,
      paths: [{ path: '/guide', successfulResponses: 1 }],
      ipRangeVerification: {
        configuredCidrCount: 1,
        requestsWithMatchedRange: 1,
        requestsOutsideConfiguredRanges: 0,
      },
    });
    expect(getCrawler('OAI-SearchBot')).toMatchObject({
      activity: 'search-crawl',
      paths: [
        { path: '/guide', serverErrors: 1, responseContentTypes: [{ contentType: 'text/html' }] },
      ],
    });
    expect(getCrawler('CustomIndexer').activity).toBe('unclassified');
    expect(analysis.searchCrawlerPathComparison.pathsWithSuccessFailureSplit).toBe(1);
    const serialized = JSON.stringify(analysis);
    expect(serialized).not.toContain('203.0.113.10');
    expect(serialized).not.toContain('198.51.100.20');
    expect(serialized).not.toContain('Mozilla/5.0 GPTBot/1.0');
    expect(serialized).not.toContain('secret=123');
  });

  it('rejects unsafe options and line counts rather than silently truncating the input', () => {
    expect(() => analyzeAiCrawlerAccessLog('line', { maxLines: 0 })).toThrow(
      'AI crawler log maxLines must be an integer from 1 to 5,000,000.'
    );
    expect(() => analyzeAiCrawlerAccessLog('line', { customTokens: ['GPTBot'] })).toThrow(
      'Custom AI crawler tokens must not duplicate a built-in token.'
    );
    expect(() => analyzeAiCrawlerAccessLog('one\ntwo', { maxLines: 1 })).toThrow(
      'Log contains more than 1 non-empty lines.'
    );
  });

  it('attributes only exact configured UTM source values and reports ambiguous tags', () => {
    const rows = [
      { path: '/pricing?utm_source=ChatGPT.com', status: 200 },
      { path: '/guide?utm_source=partner-ai', status: 302 },
      { path: '/guide?utm_source=partner-ai&utm_source=chatgpt.com', status: 200 },
      { path: '/unknown?utm_source=other-ai', status: 200 },
      { path: '/empty?utm_source=', status: 200 },
      { path: '/ordinary', status: 200 },
    ].map((row) => JSON.stringify(row));

    const analysis = analyzeAiCrawlerAccessLog(rows.join('\n'), {
      aiReferralSources: [{ label: 'Partner AI', value: 'partner-ai' }],
    });

    expect(analysis.utmSourceAttributionCoverage).toEqual({
      parsedRequestRows: 6,
      requestsWithUtmSource: 5,
      requestsWithConfiguredSource: 2,
      requestsWithUnconfiguredSingleValue: 1,
      requestsWithConflictingValues: 1,
      requestsWithEmptyOrOversizedValue: 1,
    });
    expect(
      analysis.aiReferralTraffic.find(({ source }) => source === 'ChatGPT (UTM)')
    ).toMatchObject({
      requests: 1,
      uniquePaths: 1,
      paths: [{ path: '/pricing', requests: 1 }],
    });
    expect(analysis.aiReferralTraffic.find(({ source }) => source === 'Partner AI')).toMatchObject({
      requests: 1,
      paths: [{ path: '/guide', requests: 1 }],
    });
    expect(JSON.stringify(analysis)).not.toContain('chatgpt.com');
    expect(JSON.stringify(analysis)).not.toContain('partner-ai');
  });

  it('replays observed paths against robots policy while separating crawler classes', () => {
    const analysis = analyzeAiCrawlerAccessLog(
      [
        { path: '/private/a', status: 200, user_agent: 'GPTBot' },
        { path: '/public', status: 200, user_agent: 'OAI-SearchBot' },
        { path: '/private/user', status: 200, user_agent: 'ChatGPT-User' },
        { path: '/private/custom', status: 200, user_agent: 'CustomIndexer' },
      ]
        .map((row) => JSON.stringify(row))
        .join('\n'),
      { customTokens: ['CustomIndexer'] }
    );

    const replay = analyzeAiCrawlerLogRobotsPolicy(
      analysis,
      'User-agent: GPTBot\nDisallow: /private/\n\nUser-agent: *\nDisallow: /blocked/',
      'https://example.com',
      { sourceFile: 'robots.txt', sourceModifiedAt: '2026-09-30T10:00:00Z' }
    );
    const decision = (token: string) =>
      replay.pathObservations.find((observation) => observation.crawlerToken === token)
        ?.policyDecision;

    expect(replay).toMatchObject({
      sourceFile: 'robots.txt',
      sourceModifiedAt: '2026-09-30T10:00:00Z',
      origin: 'https://example.com',
      inputPathsTruncated: false,
    });
    expect(decision('GPTBot')).toBe('blocked');
    expect(decision('OAI-SearchBot')).toBe('allowed');
    expect(decision('ChatGPT-User')).toBe('not-applicable');
    expect(decision('CustomIndexer')).toBe('not-assessed');
    expect(replay.crawlers.find(({ token }) => token === 'GPTBot')).toMatchObject({
      blockedPaths: 1,
      blockedRequests: 1,
    });
  });

  it('compares sitemap lastmod days with observed crawler paths and excludes ambiguous URLs', () => {
    const analysis = analyzeAiCrawlerAccessLog(
      [
        { path: '/updated', status: 200, timestamp: '2026-09-28T12:00:00Z', user_agent: 'GPTBot' },
        { path: '/same-day', status: 200, timestamp: '2026-09-30T08:00:00Z', user_agent: 'GPTBot' },
        { path: '/query', status: 200, timestamp: '2026-09-28T12:00:00Z', user_agent: 'GPTBot' },
      ]
        .map((row) => JSON.stringify(row))
        .join('\n')
    );

    const freshness = analyzeAiCrawlerSitemapRecrawlCoverage(
      analysis,
      [
        { url: 'https://example.com/updated', lastModified: '2026-09-30' },
        { url: 'https://example.com/same-day', lastModified: '2026-09-30T23:59:00Z' },
        { url: 'https://example.com/query?variant=a', lastModified: '2026-09-30' },
        { url: 'https://example.com/query?variant=b', lastModified: '2026-10-01' },
        { url: 'https://example.com/invalid', lastModified: 'yesterday' },
        { url: 'https://elsewhere.test/off-origin', lastModified: '2026-10-01' },
      ],
      'https://example.com',
      'https://example.com/sitemap.xml',
      { sitemapUrlsTruncated: true }
    );

    expect(freshness).toMatchObject({
      sitemapUrlsProvided: 5,
      pagesWithValidLastmod: 4,
      pagesWithInvalidLastmod: 1,
      sitemapUrlsWithQueryStrings: 2,
      sitemapUrlsSkippedAsAmbiguous: 2,
      sitemapUrlsTruncated: true,
    });
    expect(freshness.crawlers.find(({ crawlerToken }) => crawlerToken === 'GPTBot')).toMatchObject({
      pagesObservedInLog: 2,
      pagesWithUpdateAfterLastObservedRequest: 1,
      pagesObservedSameUtcDayAsLastmod: 1,
      pagesSkippedAsAmbiguous: 2,
      pagesWithInvalidLastmod: 1,
    });
    expect(freshness.updateOpportunities).toMatchObject([
      {
        crawlerToken: 'GPTBot',
        path: '/updated',
        daysBetweenLastRequestAndUpdate: 2,
        state: 'updated-after-last-observed-request',
      },
    ]);
  });

  it('renders a self-contained escaped report without restoring private log fields', () => {
    const analysis = analyzeAiCrawlerAccessLog(
      JSON.stringify({
        path: '/guide?private=value',
        status: 200,
        user_agent: 'GPTBot/1.0 private-agent-suffix',
      }),
      { sourceFile: '<img src=x onerror=alert(1)>' }
    );

    const html = renderAiCrawlerAccessLogHtml([analysis]);

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('AI crawler access');
    expect(html).toContain('/guide');
    expect(html).not.toContain('private=value');
    expect(html).not.toContain('private-agent-suffix');
    expect(html).not.toContain('<script src=');
  });
});
