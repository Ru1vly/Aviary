import {
  analyzeBingAiQueryPageMapping,
  parseBingAiPerformanceCsvExport,
  summarizeBingAiPerformanceExport,
} from '../../src/geo/bingAiPerformance';
import { renderBingAiPerformanceHtml } from '../../src/geo/bingAiReporter';

describe('Bing AI performance reports', () => {
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
});
