import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import * as bing from '../../src/geo/bingAiPerformance';
import { renderBingAiPerformanceHtml } from '../../src/geo/bingAiReporter';

function capture(metric: 'missing' | 'zero' | 'positive', turnover = false) {
  const count = metric === 'missing' ? '' : metric === 'zero' ? '0' : '10';
  const share = metric === 'missing' ? '' : metric === 'zero' ? '0%' : '25%';
  return bing.parseBingAiPerformanceCsvExport(
    `Page,Query,Date,Citations,Cited Pages,Citation Share,Topic,Intent\nhttps://example.com/a,shared,late period,${count},2,${share},Web,Research\nhttps://example.com/b,${turnover ? 'new' : 'old'},early period,${count},1,${share},${turnover ? 'AI' : 'Web'},Compare\nhttps://example.com/a,shared,late period,${count},2,${share},Web,Research\n,orphan,unknown period,${count},1,${share},,Research`
  );
}
const cases = [
  ['missing', 'positive'],
  ['positive', 'missing'],
  ['missing', 'missing'],
  ['zero', 'positive'],
  ['positive', 'zero'],
  ['zero', 'zero'],
] as const;
describe('Bing partial metric evidence across exports', () => {
  it.each(cases)(
    '%s current versus %s baseline retains measured zero and unknown totals',
    (currentMetric, baselineMetric) => {
      const current = capture(currentMetric, true),
        baseline = capture(baselineMetric);
      const summary = bing.summarizeBingAiPerformanceExport(current);
      expect(summary.totalCitations).toBe(
        currentMetric === 'missing' ? undefined : currentMetric === 'zero' ? 0 : 40
      );
      expect(summary.totalCitedPages).toBe(6);
      expect(summary.timeSeries.map((row) => row.period)).toEqual([
        'early period',
        'late period',
        'unknown period',
      ]);
      const analysis = bing.analyzeBingAiQueryPageMapping(current);
      const before = bing.analyzeBingAiQueryPageMapping(baseline);
      expect(analysis.queryRowsWithoutUsableUrl).toBe(1);
      const pages = (data: typeof current) =>
        bing.parseBingAiPerformanceCsvExport(
          'Page,Citations,Cited Pages,Citation Share\n' +
            data.rows
              .filter((row) => row.url)
              .map((row) =>
                [row.url, row.citations ?? '', row.citedPages ?? '', row.citationShare ?? ''].join(
                  ','
                )
              )
              .join('\n')
        );
      const visibility = bing.compareBingAiPageCitationExports(pages(current), pages(baseline));
      if (currentMetric === 'missing' || baselineMetric === 'missing')
        expect(visibility.changes.every((row) => row.citationChange === undefined)).toBe(true);
      const cohorts = bing.analyzeBingAiTopicIntentIntersections(current);
      expect(cohorts.mappedRows).toBe(3);
      const html = renderBingAiPerformanceHtml({
        exports: [current, baseline],
        summaries: [summary, bing.summarizeBingAiPerformanceExport(baseline)],
        queryPageAnalyses: [analysis, before],
        queryMappingComparison: bing.compareBingAiQueryPageMappings(current, baseline),
        topicIntentAnalyses: [cohorts],
        topicIntentComparison: bing.compareBingAiTopicIntentExports(current, baseline),
        visibilityComparison: visibility,
      });
      const window = new Window();
      window.document.write(html);
      for (const table of window.document.querySelectorAll('table')) {
        const count = table.querySelectorAll(':scope > thead > tr:last-child > th').length;
        for (const row of table.querySelectorAll(':scope > tbody > tr'))
          expect(
            [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)
          ).toBe(count);
      }
      expect(html).not.toMatch(/NaN|Infinity/);
    }
  );
});

describe('Bing retained detail boundaries', () => {
  it('keeps partially measured page distributions separate from missing metrics', () => {
    const data = bing.parseBingAiPerformanceCsvExport(
      'Page,Query,Citations,Cited Pages,Topic,Intent\nhttps://example.com/a,shared,10,,Web,Research\nhttps://example.com/b,shared,,2,Web,Research\nhttps://example.com/c,other,0,,Web,Research'
    );
    const analysis = bing.analyzeBingAiQueryPageMapping(data);
    const shared = analysis.queryGroups.find((row) => row.query === 'shared')!;
    expect(shared.citationDistribution).toMatchObject({
      pagesWithCitationMetric: 1,
      pagesWithoutCitationMetric: 1,
      citationsAcrossMeasuredPages: 10,
      largestPageCitationSharePercent: 100,
    });
    expect(analysis.citationDistributionSummary.queriesWithPartialPageMetricCoverage).toBe(1);
    const summary = bing.summarizeBingAiPerformanceExport(data);
    expect(summary.totalCitations).toBe(10);
    expect(summary.totalCitedPages).toBe(2);
  });
  it('discloses bounded cohort detail while retaining aggregate totals', () => {
    const data = bing.parseBingAiPerformanceCsvExport(
      'Page,Query,Citations,Topic,Intent\n' +
        Array.from(
          { length: 501 },
          (_, i) => `https://example.com/${i},question ${i},1,Topic ${i},Research`
        ).join('\n')
    );
    const result = bing.compareBingAiTopicIntentExports(data, data);
    expect(result.cohorts).toHaveLength(500);
    expect(result.cohortsTruncated).toBe(true);
    const summary = bing.summarizeBingAiPerformanceExport(data);
    expect(summary.totalCitations).toBe(501);
    expect(summary.topPages).toHaveLength(20);
    expect(
      renderBingAiPerformanceHtml({
        exports: [data],
        summaries: [summary],
        topicIntentComparison: result,
      })
    ).not.toMatch(/NaN|Infinity/);
  });
});
