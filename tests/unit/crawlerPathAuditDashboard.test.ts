import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { runInNewContext } from 'node:vm';
import { analyzeSiteWideGeo } from '../../src/sitewide';
import {
  analyzeAiCrawlerAccessLog,
  correlateAiCrawlerAccessLogWithGeoAudit,
} from '../../src/geo/aiCrawlerLogs';
import { renderAiCrawlerPathFamilyAuditCorrelationHtml } from '../../src/geo/aiCrawlerPathFamilies';

const audit = analyzeSiteWideGeo({
  timestamp: '2026-10-01T00:00:00Z',
  summary: {
    requestedUrls: 0,
    completedUrls: 0,
    failedUrls: 0,
    passedChecks: 0,
    failedChecks: 0,
    averageScore: null,
  },
  results: [],
});

function dashboard(log: string) {
  const analysis = analyzeAiCrawlerAccessLog(log);
  const correlation = correlateAiCrawlerAccessLogWithGeoAudit(
    analysis,
    audit,
    'https://example.com'
  );
  const window = new Window();
  window.document.write(renderAiCrawlerPathFamilyAuditCorrelationHtml([correlation]));
  const script = window.document.querySelector('script:not([type])')!;
  runInNewContext(script.textContent!, { document: window.document });
  return window;
}

describe('route-family audit dashboard script', () => {
  it('renders populated cells without an undefined index and filters crawler rows', () => {
    const window = dashboard(
      ['GPTBot', 'OAI-SearchBot']
        .map((user_agent) =>
          JSON.stringify({
            timestamp: '2026-10-01T01:00:00Z',
            path: '/guides/intro',
            status: 200,
            user_agent,
          })
        )
        .join('\n')
    );
    const rows = () => [...window.document.querySelectorAll('#family-rows tr')];
    expect(rows()).toHaveLength(2);
    for (const row of rows()) expect(row.querySelectorAll('td')).toHaveLength(16);
    const filter = window.document.querySelector('#crawler-filter') as HTMLSelectElement;
    filter.value = 'GPTBot';
    filter.dispatchEvent(new window.Event('change'));
    expect(rows()).toHaveLength(1);
    expect(rows()[0].children[1].textContent).toBe('GPTBot');
    filter.value = '';
    filter.dispatchEvent(new window.Event('change'));
    expect(rows()).toHaveLength(2);
  });

  it('shows an honest empty state without fabricating family rows', () => {
    const window = dashboard('');
    expect(window.document.querySelectorAll('#family-rows tr')).toHaveLength(0);
    expect(window.document.querySelector('#family-chart')?.textContent).toContain(
      'No retained route-family rows match this filter.'
    );
  });
});
