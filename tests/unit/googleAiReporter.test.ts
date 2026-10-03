import {
  parseGoogleAiPerformanceCsvExport,
  summarizeGoogleAiPerformanceExport,
  compareGoogleAiDimensionExports,
  compareGoogleAiPerformanceExports,
  correlateGoogleAiPerformanceWithAudit,
} from '../../src/geo/googleAiPerformance';
import {
  renderGoogleAiPerformanceCsv,
  renderGoogleAiPerformanceHtml,
} from '../../src/geo/googleAiReporter';
import { Window } from 'happy-dom';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';
import type { SEOReport } from '../../src/types';

describe('Google AI performance reports', () => {
  it('renders matched page changes and keeps export-only counts unknown in HTML and CSV', () => {
    const baseline = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/gain,10\nhttps://example.com/drop,20\nhttps://example.com/steady,5\nhttps://example.com/old,8'
    );
    const current = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\nhttps://example.com/gain,15\nhttps://example.com/drop,10\nhttps://example.com/steady,5\nhttps://example.com/new,8'
    );
    const visibilityComparison = compareGoogleAiPerformanceExports(current, baseline);
    const input = {
      exports: [current],
      summaries: [summarizeGoogleAiPerformanceExport(current)],
      visibilityComparison,
    };
    const window = new Window();
    window.document.write(renderGoogleAiPerformanceHtml(input));
    const table = Array.from(window.document.querySelectorAll('table')).find(
      (t) =>
        t.querySelector('caption')?.textContent === 'Impression changes for Google AI page URLs'
    )!;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const cells = (suffix: string) =>
      Array.from(
        rows
          .find((r) => r.querySelector('td')?.textContent?.endsWith(suffix))!
          .querySelectorAll('td')
      ).map((c) => c.textContent?.trim());
    expect(cells('/gain').slice(2)).toEqual(['10', '15', '+5', '+50.0%']);
    expect(cells('/drop').slice(2)).toEqual(['20', '10', '-10', '-50.0%']);
    expect(cells('/steady').slice(2)).toEqual(['5', '5', '0', '0.0%']);
    expect(cells('/new').slice(2)).toEqual(['—', '8', '—', '—']);
    expect(cells('/old').slice(2)).toEqual(['8', '—', '—', '—']);
    const csv = renderGoogleAiPerformanceCsv(input);
    expect(csv).toContain('"15","5","50"');
    expect(csv).toContain('"10","-10","-50"');
    expect(csv).not.toContain('"\'"');
    window.close();
  });

  it('renders exact dimension cohorts and overview exports with aligned columns', () => {
    for (const header of ['Country,Device,Date,Impressions', 'Impressions']) {
      const baseline = parseGoogleAiPerformanceCsvExport(
        header === 'Impressions'
          ? header + '\n10'
          : header + '\nUS,Mobile,2026-10-03,10\nGB,Desktop,2026-10-03,20'
      );
      const current = parseGoogleAiPerformanceCsvExport(
        header === 'Impressions'
          ? header + '\n15'
          : header + '\nUS,Mobile,2026-10-03,15\nGB,Desktop,2026-10-03,10\nDE,Desktop,2026-10-03,2'
      );
      const dimensionComparison = compareGoogleAiDimensionExports(current, baseline);
      const input = {
        exports: [current],
        summaries: [summarizeGoogleAiPerformanceExport(current)],
        dimensionComparison,
      };
      const window = new Window();
      window.document.write(renderGoogleAiPerformanceHtml(input));
      for (const table of window.document.querySelectorAll('table')) {
        const width = table.querySelectorAll('thead th').length;
        for (const row of table.querySelectorAll('tbody tr'))
          expect(
            Array.from(row.querySelectorAll('td')).reduce((n, cell) => n + cell.colSpan, 0)
          ).toBe(width);
      }
      const lines = renderGoogleAiPerformanceCsv(input)
        .trimEnd()
        .split('\r\n')
        .map((line) => line.split(','));
      for (const row of lines) expect(row).toHaveLength(lines[0].length);
      expect(renderGoogleAiPerformanceCsv(input)).not.toContain('"\'"');
      if (header === 'Impressions') expect(lines[1][1]).toBe('"all_rows"');
      else expect(window.document.body.textContent).toContain('current only');
      window.close();
    }
  });

  it('renders current control associations and empty correlation states', () => {
    const data = parseGoogleAiPerformanceCsvExport('Page,Impressions\nhttps://example.com/a,10');
    const checks = Object.fromEntries(
      CHECKER_REGISTRY.map(({ key }) => [key, []])
    ) as SEOReport['checks'];
    checks.geo = [
      {
        name: 'ai-search-crawler-access',
        passed: false,
        message: 'Blocked',
        details: { crawlers: [{ token: 'Googlebot', allowed: false }] },
      },
      {
        name: 'ai-search-preview-controls',
        passed: false,
        message: 'Restricted',
        details: {
          crawlerControls: [
            { token: 'Googlebot', noindex: true, noSnippet: true, maxSnippetZero: true },
          ],
        },
      },
      {
        name: 'answer-content-profile',
        passed: true,
        message: 'Content',
        details: { questionHeadings: 1, conciseAnswerBlocks: 1 },
      },
    ];
    const audit: SEOReport = {
      url: 'https://example.com/a',
      timestamp: '2026-10-04T00:00:00Z',
      score: 75,
      summary: { total: 3, passed: 1, failed: 2 },
      checks,
    };
    const correlation = correlateGoogleAiPerformanceWithAudit(data, audit);
    const html = renderGoogleAiPerformanceHtml({
      exports: [data],
      summaries: [],
      correlations: [correlation],
    });
    expect(html).toContain('googlebot-robots-access');
    expect(html).toContain('googlebot-noindex');
    expect(html).toContain('question-headings');
    expect(html).toContain('Overlapping associations · not causal');
    const empty = renderGoogleAiPerformanceHtml({
      exports: [],
      summaries: [],
      correlations: [
        { ...correlation, currentControlObservations: [], currentContentObservations: [] },
      ],
    });
    expect(empty).toContain('No matched pages with assessed controls.');
    expect(empty).toContain('No matched pages with assessed content signals.');
  });
  it('preserves missing CSV dimensions as empty fields', () => {
    const data = parseGoogleAiPerformanceCsvExport('Page,Impressions\nhttps://example.com/a,12');
    const csv = renderGoogleAiPerformanceCsv({ exports: [data], summaries: [] });
    expect(csv.split('\r\n')[1]).toBe('"","search","page","https://example.com/a","","","","12"');
  });

  it('keeps an empty overview comparison row aligned with its header', () => {
    const data = parseGoogleAiPerformanceCsvExport('Impressions\n0');
    const comparison = compareGoogleAiDimensionExports(data, data);
    const html = renderGoogleAiPerformanceHtml({
      exports: [],
      summaries: [],
      dimensionComparison: { ...comparison, changes: [] },
    });
    const window = new Window();
    window.document.write(html);
    const table = window.document.querySelector('table')!;
    expect(table.querySelector('tbody td')!.colSpan).toBe(
      table.querySelectorAll('thead th').length
    );
    window.close();
  });
  it('renders an offline HTML report and escapes untrusted source labels and page values', () => {
    const exportData = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\njavascript:alert(1),7\nhttps://example.com/page,4',
      { sourceFile: '<script>alert("export")</script>.csv' }
    );
    const summary = summarizeGoogleAiPerformanceExport(exportData);
    const html = renderGoogleAiPerformanceHtml({ exports: [exportData], summaries: [summary] });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Google AI visibility · Aviary GEO</title>');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('&lt;script&gt;alert(&quot;export&quot;)&lt;/script&gt;.csv');
    expect(html).toContain('javascript:alert(1)');
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).not.toContain('<script>alert("export")</script>');
    expect(html).not.toContain('https://cdn');
  });

  it('quotes CSV and neutralizes spreadsheet formulas in imported values', () => {
    const exportData = parseGoogleAiPerformanceCsvExport(
      'Page,Impressions\n"=HYPERLINK(""https://evil.example"")",2',
      { sourceFile: '+SUM(1,2)' }
    );
    const csv = renderGoogleAiPerformanceCsv({
      exports: [exportData],
      summaries: [summarizeGoogleAiPerformanceExport(exportData)],
    });

    expect(csv).toContain('"\'+SUM(1,2)"');
    expect(csv).toContain('"\'=HYPERLINK(""https://evil.example"")"');
    expect(csv).toContain('\r\n');
  });
});
