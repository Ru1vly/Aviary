import {
  analyzeBingAiQueryPageMapping,
  analyzeBingAiTopicIntentIntersections,
  compareBingAiPageCitationExports,
  compareBingAiQueryPageMappings,
  compareBingAiTopicIntentExports,
  correlateBingAiCitationsWithAudit,
  parseBingAiPerformanceCsvExport,
  summarizeBingAiPerformanceExport,
} from '../../src/geo/bingAiPerformance';
import { renderBingAiPerformanceHtml } from '../../src/geo/bingAiReporter';
import { Window } from 'happy-dom';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';
import type { SEOReport } from '../../src/types';

describe('Bing AI performance reports', () => {
  it.each(['javascript:alert(1)', 'not a URL', 'https://user:password@example.com/a'])(
    'does not turn unsafe source URLs into links (%s)',
    (url) => {
      const data = parseBingAiPerformanceCsvExport(
        'Page,Query,Citations\nhttps://example.com/a,q,1'
      );
      const analysis = analyzeBingAiQueryPageMapping(data);
      analysis.queryGroups[0].pages[0].url = url;
      const html = renderBingAiPerformanceHtml({
        exports: [data],
        summaries: [],
        queryPageAnalyses: [analysis],
      });
      const window = new Window();
      window.document.write(html);
      expect(
        Array.from(window.document.querySelectorAll('a')).some(
          (link) => link.getAttribute('href') === url
        )
      ).toBe(false);
      expect(window.document.body.textContent).toContain(url);
      window.close();
    }
  );
  it('renders a searchable standalone HTML report with escaped query text and safe page links', () => {
    const exportData = parseBingAiPerformanceCsvExport(
      'Page,Grounding Query,Citations,Topic,Intent\njavascript:alert(1),"<script>alert(1)</script>",8,"<img src=x onerror=alert(1)>",Informational',
      { sourceFile: '<script>alert("file")</script>.csv' }
    );
    const html = renderBingAiPerformanceHtml({
      exports: [exportData],
      summaries: [summarizeBingAiPerformanceExport(exportData)],
      queryPageAnalyses: [analyzeBingAiQueryPageMapping(exportData)],
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Bing AI Performance · Aviary GEO report</title>');
    expect(html).toContain('data-filter');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('javascript:alert(1)');
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('https://cdn');
  });

  it('renders period comparisons with distinct gains, declines, unknown metrics and export-only URLs', () => {
    const baseline = parseBingAiPerformanceCsvExport(
      'Page,Citations,Citation share\nhttps://example.com/gain,10,10%\nhttps://example.com/drop,20,30%\nhttps://example.com/steady,5,5%\nhttps://example.com/old,4,4%\nhttps://example.com/unknown,,2%',
      { sourceFile: 'baseline.csv' }
    );
    const current = parseBingAiPerformanceCsvExport(
      'Page,Citations,Citation share\nhttps://example.com/gain,15,20%\nhttps://example.com/drop,10,20%\nhttps://example.com/steady,5,5%\nhttps://example.com/new,8,8%\nhttps://example.com/unknown,,3%',
      { sourceFile: 'current.csv' }
    );
    const html = renderBingAiPerformanceHtml({
      exports: [current],
      summaries: [summarizeBingAiPerformanceExport(current)],
      visibilityComparison: compareBingAiPageCitationExports(current, baseline),
    });
    const window = new Window();
    window.document.write(html);
    const tables = Array.from(window.document.querySelectorAll('table'));
    const table = tables.find((item) =>
      item.querySelector('caption')?.textContent?.startsWith('Page-level citation')
    );
    expect(table).toBeDefined();
    const rows = Array.from(table!.querySelectorAll('tbody tr'));
    const cells = (suffix: string) =>
      Array.from(
        rows
          .find((row) => row.querySelector('td')?.textContent?.endsWith(suffix))!
          .querySelectorAll('td')
      ).map((cell) => cell.textContent?.trim());
    expect(cells('/gain').slice(2)).toEqual(['10', '15', '+5', '+50.0%', '10%', '20%', '+10 pp']);
    expect(cells('/drop').slice(2)).toEqual(['20', '10', '-10', '-50.0%', '30%', '20%', '-10 pp']);
    expect(cells('/steady').slice(2)).toEqual(['5', '5', '0', '0.0%', '5%', '5%', '0 pp']);
    expect(cells('/unknown').slice(2, 6)).toEqual(['—', '—', '—', '—']);
    expect(cells('/new')[2]).toBe('—');
    expect(cells('/old')[3]).toBe('—');
    expect(html).toContain('Largest citation-share gains');
    expect(html).toContain('Largest citation-share declines');
    for (const row of rows) expect(row.querySelectorAll('td')).toHaveLength(9);
    expect(
      window.document.querySelector('a[href="https://example.com/gain"]')?.getAttribute('rel')
    ).toBe('noopener noreferrer');
    window.close();
  });

  it('renders query membership and topic/intent shifts without treating one-period samples as zero', () => {
    const baseline = parseBingAiPerformanceCsvExport(
      'Page,Query,Citations,Topic,Intent\nhttps://example.com/a,shared,5,Tools,Informational\nhttps://example.com/b,old phrase,8,Legacy,Research\nhttps://example.com/c,decline,9,Tools,Research'
    );
    const current = parseBingAiPerformanceCsvExport(
      'Page,Query,Citations,Topic,Intent\nhttps://example.com/a,shared,8,Tools,Informational\nhttps://example.com/d,"<img src=x onerror=alert(1)>",4,New,Research\nhttps://example.com/c,decline,2,Tools,Research\nhttps://example.com/e,shared,0,Tools,Informational'
    );
    const html = renderBingAiPerformanceHtml({
      exports: [current],
      summaries: [summarizeBingAiPerformanceExport(current)],
      queryPageAnalyses: [analyzeBingAiQueryPageMapping(current)],
      topicIntentAnalyses: [analyzeBingAiTopicIntentIntersections(current)],
      queryMappingComparison: compareBingAiQueryPageMappings(current, baseline),
      topicIntentComparison: compareBingAiTopicIntentExports(current, baseline),
    });
    const window = new Window();
    window.document.write(html);
    expect(window.document.querySelectorAll('h2')).toHaveLength(5);
    expect(html).toContain('Grounding phrase / page mapping comparison');
    expect(html).toContain('Topic and intent cohort movement');
    expect(html).toContain('current only');
    expect(html).toContain('baseline only');
    expect(html).toContain('5 → 8 citations (+3)');
    expect(html).toContain('9 → 2 citations (-7)');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(window.document.querySelector('img')).toBeNull();
    for (const table of window.document.querySelectorAll('table')) {
      const columns = table.querySelectorAll('thead th').length;
      for (const row of table.querySelectorAll('tbody tr')) {
        expect(
          Array.from(row.querySelectorAll('td')).reduce((total, cell) => total + cell.colSpan, 0)
        ).toBe(columns);
      }
    }
    window.close();
  });

  it('renders empty views and truncation disclosures without broken links or numeric placeholders', () => {
    const current = parseBingAiPerformanceCsvExport('Page,Citations\nhttps://example.com/a,1');
    const query = parseBingAiPerformanceCsvExport(
      'Page,Query,Citations,Topic,Intent\nhttps://example.com/a,q,1,Tools,Research'
    );
    const queryAnalysis = analyzeBingAiQueryPageMapping(query);
    const topicAnalysis = analyzeBingAiTopicIntentIntersections(query);
    const visibility = compareBingAiPageCitationExports(current, current);
    const mapping = compareBingAiQueryPageMappings(query, query);
    const topics = compareBingAiTopicIntentExports(query, query);
    const html = renderBingAiPerformanceHtml({
      exports: [current],
      summaries: [],
      correlations: [],
      queryPageAnalyses: [{ ...queryAnalysis, queryGroups: [], pages: [] }],
      topicIntentAnalyses: [{ ...topicAnalysis, cells: [], cellsTruncated: true }],
      visibilityComparison: {
        ...visibility,
        changes: [],
        changesTruncated: true,
        topCitationShareIncreases: [],
        topCitationShareDecreases: [],
      },
      queryMappingComparison: { ...mapping, queryGroups: [], queryGroupsTruncated: true },
      topicIntentComparison: { ...topics, cohorts: [], cohortsTruncated: true },
    });
    expect(html).toContain('No page changes are available.');
    expect(html).toContain('No query mapping groups were available.');
    expect(html).toContain('No topic/intent cohort comparisons are available.');
    expect(html).toContain('Page detail is capped at 1,000 rows.');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it.each([true, false, undefined])(
    'keeps current audit evidence and language validation explicit (%s)',
    (valid) => {
      const data = parseBingAiPerformanceCsvExport(
        'Page,Query,Citations,Date\nhttps://example.com/a,shared,10,2026-10-03\nhttps://example.com/a,other,0,2026-10-03\nhttps://example.com/unmatched,shared,2,2026-10-04'
      );
      const checks = Object.fromEntries(
        CHECKER_REGISTRY.map(({ key }) => [key, []])
      ) as SEOReport['checks'];
      checks.geo = [
        {
          name: 'ai-search-crawler-access',
          passed: false,
          message: 'Blocked',
          details: { crawlers: [{ token: 'bingbot', allowed: false }] },
        },
        {
          name: 'ai-search-preview-controls',
          passed: false,
          message: 'Restricted',
          details: {
            noindex: true,
            noSnippet: true,
            crawlerControls: [
              { token: 'bingbot', noindex: true, noSnippet: true, maxSnippetZero: true },
            ],
          },
        },
        {
          name: 'answer-content-profile',
          passed: true,
          message: 'Content',
          details: {
            questionHeadings: 2,
            conciseAnswerBlocks: 1,
            documentLanguage: 'en',
            ...(valid === undefined ? {} : { documentLanguageValid: valid }),
          },
        },
        {
          name: 'citation-evidence-profile',
          passed: true,
          message: 'Sources',
          details: { externalSourceLinkCount: 3 },
        },
      ];
      const audit: SEOReport = {
        url: 'https://example.com/a',
        timestamp: '2026-10-03T00:00:00Z',
        score: 75,
        summary: { total: 4, passed: 2, failed: 2 },
        checks,
      };
      const correlation = correlateBingAiCitationsWithAudit(data, audit);
      const html = renderBingAiPerformanceHtml({
        exports: [data],
        summaries: [summarizeBingAiPerformanceExport(data)],
        queryPageAnalyses: [analyzeBingAiQueryPageMapping(data, correlation)],
        correlations: [correlation],
      });
      expect(html).toContain('Bingbot blocked');
      expect(html).toContain('global noindex');
      expect(html).toContain('global nosnippet');
      expect(html).toContain('Bingbot max-snippet:0');
      expect(html).toContain('2 question headings');
      expect(html).toContain('1 concise answers');
      expect(html).toContain('3 source links');
      expect(html).toContain(
        `lang en${valid === true ? ' valid' : valid === false ? ' invalid' : ''}`
      );
      expect(html).toContain('Current Bingbot controls and page signals');
      expect(html).toContain('Time series');
      expect(html).toContain('2026-10-04');
      expect(html).toContain('not matched');
      const empty = renderBingAiPerformanceHtml({
        exports: [],
        summaries: [],
        correlations: [
          { ...correlation, currentControlObservations: [], currentContentObservations: [] },
        ],
      });
      expect(empty).toContain('No matched pages with assessed controls.');
      expect(empty).toContain('No matched pages with assessed content signals.');
    }
  );
});
