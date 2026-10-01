import {
  parseGoogleAiPerformanceCsvExport,
  summarizeGoogleAiPerformanceExport,
} from '../../src/geo/googleAiPerformance';
import {
  renderGoogleAiPerformanceCsv,
  renderGoogleAiPerformanceHtml,
} from '../../src/geo/googleAiReporter';

describe('Google AI performance reports', () => {
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
