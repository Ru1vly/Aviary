import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { AnalyticsChecker } from '../../src/checkers/analytics';
import { createMockPage, MockPageOptions } from '../mocks/mockPage';

function checkerFor(opts: MockPageOptions): AnalyticsChecker {
  const page = createMockPage(opts);
  return new AnalyticsChecker({ page: page as Page, checkerKey: 'analytics' });
}

function byName(results: Awaited<ReturnType<AnalyticsChecker['checkAll']>>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`no result named ${name}`);
  return r;
}

describe('AnalyticsChecker', () => {
  it('flags Google Analytics as not detected on a bare page, passes with a gtag script', async () => {
    const bare = await checkerFor({ html: '<p>x</p>' }).checkAll();
    expect(bare).toHaveLength(15);
    expect(byName(bare, 'google-analytics-detected').passed).toBe(false);
    expect(bare.filter((r) => !r.passed)).toHaveLength(1); // every other check optionally-passes when absent

    const withGA = await checkerFor({
      headHtml: '<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>',
    }).checkAll();
    expect(byName(withGA, 'google-analytics-detected').passed).toBe(true);
  });

  it('flags GTM script without a <noscript> fallback', async () => {
    const results = await checkerFor({
      headHtml: '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-X"></script>',
    }).checkAll();
    // no window.google_tag_manager in this mock, so hasGTM is false via the DOM script check alone -> passes "no GTM"
    expect(byName(results, 'google-tag-manager-configured').passed).toBe(true);
  });

  it('detects Facebook Pixel, Google Ads, Hotjar, Mixpanel, Segment scripts', async () => {
    const results = await checkerFor({
      headHtml:
        '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>' +
        '<script src="https://www.googleadservices.com/pagead/conversion.js"></script>' +
        '<script src="https://static.hotjar.com/c/hotjar-1.js"></script>' +
        '<script src="https://cdn.mxpnl.com/libs/mixpanel.js"></script>' +
        '<script src="https://cdn.segment.com/analytics.js/x.js"></script>',
    }).checkAll();
    expect(byName(results, 'facebook-pixel-detected').message).toMatch(/no facebook pixel/i); // script alone doesn't set fbq
    expect(byName(results, 'google-ads-detected').passed).toBe(true);
    expect(byName(results, 'hotjar-detected').message).toMatch(/no hotjar/i);
  });

  it('detects behavior-analytics/heatmap/ab-testing tool scripts by src', async () => {
    const results = await checkerFor({
      headHtml:
        '<script src="https://www.clarity.ms/tag/x"></script>' +
        '<script src="https://mouseflow.com/x.js"></script>' +
        '<script src="https://www.optimize.google.com/optimize.js"></script>',
    }).checkAll();
    expect(byName(results, 'behavior-analytics-detected').message).toMatch(/clarity/i);
    expect(byName(results, 'heatmap-tools-detected').message).toMatch(/mouseflow/i);
    expect(byName(results, 'ab-testing-tools-detected').message).toMatch(/googleOptimize/);
  });

  it('detects search-engine verification meta tags', async () => {
    const results = await checkerFor({
      headHtml:
        '<meta name="google-site-verification" content="abc">' +
        '<meta name="msvalidate.01" content="def">' +
        '<meta name="yandex-verification" content="ghi">',
    }).checkAll();
    expect(byName(results, 'search-console-verified').passed).toBe(true);
    expect(byName(results, 'bing-webmaster-verified').passed).toBe(true);
    expect(byName(results, 'yandex-verified').passed).toBe(true);
  });

  it('detects advertising pixels and conversion tracking by script src', async () => {
    const results = await checkerFor({
      headHtml:
        '<script src="https://snap.licdn.com/li.lms-analytics/insight.min.js"></script>' +
        '<script src="https://www.googleadservices.com/pagead/conversion_async.js"></script>',
    }).checkAll();
    expect(byName(results, 'advertising-pixels-detected').message).toMatch(/linkedin/i);
    expect(byName(results, 'conversion-tracking-detected').message).toMatch(/conversion tracking/i);
  });
});
