import { BaseChecker, CheckOutcome } from './base';
import { extractImages, extractResourceTimings, ResourceTimingEntry } from './shared/dom';
import { formatBytes } from './shared/format';
import {
  PAGE_LOAD_TIME_MS,
  CWV_PAGE_LOAD_WARN_MS,
  CWV_DOM_LOAD_TIME_FAIL_MS,
  CWV_MAX_HTTP_REQUESTS,
  CWV_WARN_HTTP_REQUESTS,
  CWV_PAGE_SIZE_FAIL_BYTES,
  CWV_PAGE_SIZE_WARN_BYTES,
  CWV_JS_SIZE_FAIL_BYTES,
  CWV_CSS_SIZE_FAIL_BYTES,
  CWV_IMAGE_SIZE_FAIL_BYTES,
  CWV_MAX_FONT_FILES,
  CWV_MAX_RENDER_BLOCKING_SCRIPTS,
  CWV_MAX_RENDER_BLOCKING_STYLES,
  CWV_LAZY_LOAD_MIN_MEDIA_COUNT,
  INLINE_CONTENT_NONTRIVIAL_LENGTH,
  CWV_MAX_BLOCKING_SCRIPTS,
  CWV_TTFB_FAIL_MS,
  CWV_TTFB_WARN_MS,
  CWV_LCP_GOOD_MS,
  CWV_CLS_GOOD,
  CWV_FCP_GOOD_MS,
  CWV_TTFB_GOOD_MS,
  CWV_TOTAL_BLOCKING_TIME_GOOD_MS,
} from '../config/thresholds';

/** Populated by the init script installed in src/index.ts's launch(), before navigation. */
interface AviaryCWVMetrics {
  lcp?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  totalBlockingTime: number;
}

export class CoreWebVitalsChecker extends BaseChecker {
  private resourceTimingsPromise?: Promise<ResourceTimingEntry[]>;
  private cwvMetricsPromise?: Promise<AviaryCWVMetrics | null>;

  private getResourceTimings(): Promise<ResourceTimingEntry[]> {
    if (!this.resourceTimingsPromise) {
      this.resourceTimingsPromise = this.page.evaluate(extractResourceTimings);
    }
    return this.resourceTimingsPromise;
  }

  /**
   * Reads window.__aviaryCWV, set by the init script in src/index.ts. Only
   * present when the coreWebVitals checker was enabled at launch time (the
   * init script is gated on the same config check) — null otherwise, e.g.
   * if this checker is constructed directly in a test without going through
   * SEOChecker.launch().
   */
  private getCWVMetrics(): Promise<AviaryCWVMetrics | null> {
    if (!this.cwvMetricsPromise) {
      this.cwvMetricsPromise = this.page.evaluate(() => {
        const w = window as unknown as { __aviaryCWV?: AviaryCWVMetrics };
        return w.__aviaryCWV ?? null;
      });
    }
    return this.cwvMetricsPromise;
  }

  protected checks() {
    return [
      { id: 'lcp-good', run: () => this.checkLCP() },
      { id: 'cls-good', run: () => this.checkCLS() },
      { id: 'fcp-good', run: () => this.checkFCP() },
      { id: 'ttfb-good', run: () => this.checkTTFB() },
      { id: 'total-blocking-time-acceptable', run: () => this.checkTotalBlockingTime() },
      { id: 'page-load-time-acceptable', run: () => this.checkPageLoadTime() },
      { id: 'dom-content-loaded-acceptable', run: () => this.checkDOMContentLoaded() },
      { id: 'resource-count-acceptable', run: () => this.checkResourceCount() },
      { id: 'page-size-acceptable', run: () => this.checkTotalPageSize() },
      { id: 'javascript-size-acceptable', run: () => this.checkJavaScriptSize() },
      { id: 'css-size-acceptable', run: () => this.checkCSSSize() },
      { id: 'image-size-acceptable', run: () => this.checkImageSize() },
      { id: 'font-loading-optimized', run: () => this.checkFontLoading() },
      { id: 'render-blocking-resources-minimal', run: () => this.checkRenderBlocking() },
      { id: 'lazy-load-implemented', run: () => this.checkLazyLoadImplementation() },
      { id: 'critical-css-present', run: () => this.checkCriticalCSS() },
      { id: 'async-scripts-used', run: () => this.checkAsyncScripts() },
      { id: 'resource-hints-present', run: () => this.checkPreloadPreconnect() },
      { id: 'cache-headers-present', run: () => this.checkCacheHeaders() },
      { id: 'server-response-time-acceptable', run: () => this.checkServerResponseTime() },
    ];
  }

  private async checkPageLoadTime(): Promise<CheckOutcome> {
    try {
      const timing = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (!nav) return null;
        const loadTime = Math.round(nav.loadEventEnd - nav.startTime);
        return {
          loadTime,
          loadTimeSeconds: (loadTime / 1000).toFixed(2),
        };
      });

      if (!timing) {
        return this.pass('Page load time check skipped (navigation timing unavailable)');
      }

      const failMs = this.threshold('page-load-time-acceptable', 'failMs', PAGE_LOAD_TIME_MS);
      const warnMs = this.threshold('page-load-time-acceptable', 'warnMs', CWV_PAGE_LOAD_WARN_MS);

      if (timing.loadTime > failMs) {
        return this.fail(`Page load time is slow (${timing.loadTimeSeconds}s). Target: < ${failMs / 1000}s`, timing);
      } else if (timing.loadTime > warnMs) {
        return this.pass(`Page load time is acceptable (${timing.loadTimeSeconds}s)`, timing);
      }

      return this.pass(`Page load time is excellent (${timing.loadTimeSeconds}s)`, timing);
    } catch (error) {
      return this.pass('Page load time check skipped');
    }
  }

  private async checkDOMContentLoaded(): Promise<CheckOutcome> {
    try {
      const domTiming = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (!nav) return null;
        const domLoadTime = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
        return {
          domLoadTime,
          domLoadTimeSeconds: (domLoadTime / 1000).toFixed(2),
        };
      });

      if (!domTiming) {
        return this.pass('DOM load time check skipped (navigation timing unavailable)');
      }
      const failMs = this.threshold(
        'dom-content-loaded-acceptable',
        'failMs',
        CWV_DOM_LOAD_TIME_FAIL_MS
      );

      if (domTiming.domLoadTime > failMs) {
        return this.fail(
          `DOM load time is slow (${domTiming.domLoadTimeSeconds}s). Target: < ${failMs / 1000}s`,
          domTiming
        );
      }

      return this.pass(`DOM load time is good (${domTiming.domLoadTimeSeconds}s)`, domTiming);
    } catch (error) {
      return this.pass('DOM load time check skipped');
    }
  }

  private async checkResourceCount(): Promise<CheckOutcome> {
    try {
      const entries = await this.getResourceTimings();
      const byType: Record<string, number> = {};

      entries.forEach((entry) => {
        const type = entry.initiatorType || 'other';
        byType[type] = (byType[type] || 0) + 1;
      });

      const resources = {
        total: entries.length,
        byType,
      };

      const maxRequests = this.threshold('resource-count-acceptable', 'maxRequests', CWV_MAX_HTTP_REQUESTS);
      const warnRequests = this.threshold(
        'resource-count-acceptable',
        'warnRequests',
        CWV_WARN_HTTP_REQUESTS
      );

      if (resources.total > maxRequests) {
        return this.fail(`Too many HTTP requests (${resources.total}). Target: < ${warnRequests}`, resources);
      } else if (resources.total > warnRequests) {
        return this.pass(`HTTP requests acceptable (${resources.total})`, resources);
      }

      return this.pass(`HTTP requests optimized (${resources.total})`, resources);
    } catch (error) {
      return this.pass('Resource count check skipped');
    }
  }

  private async checkTotalPageSize(): Promise<CheckOutcome> {
    try {
      const entries = await this.getResourceTimings();
      const totalSize = entries.reduce((sum, entry) => sum + entry.transferSize, 0);
      const pageSize = { ...formatBytes(totalSize) };

      const failBytes = this.threshold('page-size-acceptable', 'failBytes', CWV_PAGE_SIZE_FAIL_BYTES);
      const warnBytes = this.threshold('page-size-acceptable', 'warnBytes', CWV_PAGE_SIZE_WARN_BYTES);

      if (pageSize.bytes > failBytes) {
        return this.fail(`Page size is large (${pageSize.mb}MB). Target: < ${Math.round(warnBytes / 1024 / 1024)}MB`, pageSize);
      } else if (pageSize.bytes > warnBytes) {
        return this.pass(`Page size is acceptable (${pageSize.mb}MB)`, pageSize);
      }

      return this.pass(`Page size is optimized (${pageSize.kb}KB)`, pageSize);
    } catch (error) {
      return this.pass('Page size check skipped');
    }
  }

  private async checkJavaScriptSize(): Promise<CheckOutcome> {
    try {
      const entries = await this.getResourceTimings();
      const jsEntries = entries.filter((e) => e.initiatorType === 'script');
      const totalSize = jsEntries.reduce((sum, entry) => sum + entry.transferSize, 0);
      const jsSize = { count: jsEntries.length, ...formatBytes(totalSize) };

      const failBytes = this.threshold('javascript-size-acceptable', 'failBytes', CWV_JS_SIZE_FAIL_BYTES);

      if (jsSize.bytes > failBytes) {
        return this.fail(`JavaScript size is large (${jsSize.kb}KB, ${jsSize.count} files). Consider code splitting`, jsSize);
      }

      return this.pass(`JavaScript size is acceptable (${jsSize.kb}KB, ${jsSize.count} files)`, jsSize);
    } catch (error) {
      return this.pass('JavaScript size check skipped');
    }
  }

  private async checkCSSSize(): Promise<CheckOutcome> {
    try {
      const entries = await this.getResourceTimings();
      const cssEntries = entries.filter((e) => e.initiatorType === 'link' && e.name.includes('.css'));
      const totalSize = cssEntries.reduce((sum, entry) => sum + entry.transferSize, 0);
      const cssSize = { count: cssEntries.length, ...formatBytes(totalSize) };

      const failBytes = this.threshold('css-size-acceptable', 'failBytes', CWV_CSS_SIZE_FAIL_BYTES);

      if (cssSize.bytes > failBytes) {
        return this.fail(`CSS size is large (${cssSize.kb}KB, ${cssSize.count} files). Consider minification`, cssSize);
      }

      return this.pass(`CSS size is acceptable (${cssSize.kb}KB, ${cssSize.count} files)`, cssSize);
    } catch (error) {
      return this.pass('CSS size check skipped');
    }
  }

  private async checkImageSize(): Promise<CheckOutcome> {
    try {
      const entries = await this.getResourceTimings();
      const imageEntries = entries.filter((e) =>
        e.initiatorType === 'img' ||
        e.name.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i)
      );
      const totalSize = imageEntries.reduce((sum, entry) => sum + entry.transferSize, 0);
      const imageSize = { count: imageEntries.length, ...formatBytes(totalSize) };

      const failBytes = this.threshold('image-size-acceptable', 'failBytes', CWV_IMAGE_SIZE_FAIL_BYTES);

      if (imageSize.bytes > failBytes) {
        return this.fail(`Images size is large (${imageSize.mb}MB, ${imageSize.count} images). Optimize images`, imageSize);
      }

      return this.pass(`Images size is acceptable (${imageSize.kb}KB, ${imageSize.count} images)`, imageSize);
    } catch (error) {
      return this.pass('Image size check skipped');
    }
  }

  private async checkFontLoading(): Promise<CheckOutcome> {
    try {
      const entries = await this.getResourceTimings();
      const fontEntries = entries.filter((e) =>
        e.initiatorType === 'css' && e.name.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/i)
      );

      const preloadedFonts = await this.page.evaluate(
        () => document.querySelectorAll('link[rel="preload"][as="font"]').length
      );

      const fontData = {
        fontCount: fontEntries.length,
        preloadedFonts,
        hasPreload: preloadedFonts > 0,
      };

      const maxFonts = this.threshold('font-loading-optimized', 'maxFonts', CWV_MAX_FONT_FILES);

      if (fontData.fontCount > maxFonts) {
        return this.fail(`Too many font files (${fontData.fontCount}). Consider limiting to 2-3`, fontData);
      }

      if (fontData.fontCount > 0 && !fontData.hasPreload) {
        return this.fail(`Fonts not preloaded (${fontData.fontCount} fonts). Add <link rel="preload">`, fontData);
      }

      return this.pass(
        fontData.hasPreload
          ? `Fonts properly preloaded (${fontData.fontCount} fonts)`
          : 'No custom fonts (good for performance)',
        fontData
      );
    } catch (error) {
      return this.pass('Font loading check skipped');
    }
  }

  private async checkRenderBlocking(): Promise<CheckOutcome> {
    try {
      const blockingData = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

        const blockingScripts = scripts.filter((s) =>
          !s.hasAttribute('async') &&
          !s.hasAttribute('defer') &&
          !s.hasAttribute('type') // Exclude JSON-LD
        );

        const blockingStyles = styles.filter((s) =>
          !s.hasAttribute('media') ||
          s.getAttribute('media') === 'all' ||
          s.getAttribute('media') === 'screen'
        );

        return {
          blockingScripts: blockingScripts.length,
          blockingStyles: blockingStyles.length,
          totalScripts: scripts.length,
          totalStyles: styles.length,
        };
      });

      const issues: string[] = [];
      const maxBlockingScripts = this.threshold(
        'render-blocking-resources-minimal',
        'maxBlockingScripts',
        CWV_MAX_RENDER_BLOCKING_SCRIPTS
      );
      const maxBlockingStyles = this.threshold(
        'render-blocking-resources-minimal',
        'maxBlockingStyles',
        CWV_MAX_RENDER_BLOCKING_STYLES
      );

      if (blockingData.blockingScripts > maxBlockingScripts) {
        issues.push(`${blockingData.blockingScripts} render-blocking scripts`);
      }

      if (blockingData.blockingStyles > maxBlockingStyles) {
        issues.push(`${blockingData.blockingStyles} render-blocking stylesheets`);
      }

      if (issues.length > 0) {
        return this.fail(`Render-blocking resources: ${issues.join(', ')}`, blockingData);
      }

      return this.pass('Minimal render-blocking resources', blockingData);
    } catch (error) {
      return this.pass('Render-blocking check skipped');
    }
  }

  private async checkLazyLoadImplementation(): Promise<CheckOutcome> {
    try {
      const images = await this.page.evaluate(extractImages);
      const iframeData = await this.page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        return { total: iframes.length, lazy: iframes.filter((f) => f.loading === 'lazy').length };
      });

      const lazyImages = images.filter((img) => img.loadingValue === 'lazy');

      const lazyData = {
        totalImages: images.length,
        totalIframes: iframeData.total,
        lazyImages: lazyImages.length,
        lazyIframes: iframeData.lazy,
      };

      const totalMedia = lazyData.totalImages + lazyData.totalIframes;
      const lazyMedia = lazyData.lazyImages + lazyData.lazyIframes;

      const minMediaCount = this.threshold(
        'lazy-load-implemented',
        'minMediaCount',
        CWV_LAZY_LOAD_MIN_MEDIA_COUNT
      );

      if (totalMedia > minMediaCount && lazyMedia === 0) {
        return this.fail('No lazy loading implemented despite many images/iframes', lazyData);
      }

      return this.pass(
        lazyMedia > 0
          ? `Lazy loading implemented (${lazyMedia}/${totalMedia} media)`
          : 'Lazy loading not needed (few media elements)',
        lazyData
      );
    } catch (error) {
      return this.pass('Lazy load implementation check skipped');
    }
  }

  private async checkCriticalCSS(): Promise<CheckOutcome> {
    try {
      const minLength = this.threshold(
        'critical-css-present',
        'minInlineLength',
        INLINE_CONTENT_NONTRIVIAL_LENGTH
      );
      const cssData = await this.page.evaluate((minLength) => {
        const inlineStyles = Array.from(document.querySelectorAll('style'));
        const externalStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

        const hasInlineCritical = inlineStyles.some((style) =>
          (style.textContent?.length || 0) > minLength
        );

        return {
          inlineStyles: inlineStyles.length,
          externalStyles: externalStyles.length,
          hasInlineCritical,
        };
      }, minLength);

      return this.pass(
        cssData.hasInlineCritical
          ? 'Critical CSS appears to be inlined'
          : 'No obvious critical CSS inlining (consider for above-fold content)',
        cssData
      );
    } catch (error) {
      return this.pass('Critical CSS check skipped');
    }
  }

  private async checkAsyncScripts(): Promise<CheckOutcome> {
    try {
      const scriptData = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));

        const async = scripts.filter((s) => s.hasAttribute('async'));
        const defer = scripts.filter((s) => s.hasAttribute('defer'));
        const neither = scripts.filter((s) =>
          !s.hasAttribute('async') &&
          !s.hasAttribute('defer') &&
          s.getAttribute('type') !== 'application/ld+json'
        );

        return {
          total: scripts.length,
          async: async.length,
          defer: defer.length,
          blocking: neither.length,
        };
      });

      const maxBlocking = this.threshold('async-scripts-used', 'maxBlocking', CWV_MAX_BLOCKING_SCRIPTS);

      if (scriptData.blocking > maxBlocking) {
        return this.fail(`${scriptData.blocking} scripts without async/defer (use async or defer)`, scriptData);
      }

      return this.pass('Most scripts use async/defer', scriptData);
    } catch (error) {
      return this.pass('Async scripts check skipped');
    }
  }

  private async checkPreloadPreconnect(): Promise<CheckOutcome> {
    try {
      const resourceHints = await this.page.evaluate(() => {
        const preload = Array.from(document.querySelectorAll('link[rel="preload"]'));
        const preconnect = Array.from(document.querySelectorAll('link[rel="preconnect"]'));
        const dnsPrefetch = Array.from(document.querySelectorAll('link[rel="dns-prefetch"]'));
        const prefetch = Array.from(document.querySelectorAll('link[rel="prefetch"]'));

        return {
          preload: preload.length,
          preconnect: preconnect.length,
          dnsPrefetch: dnsPrefetch.length,
          prefetch: prefetch.length,
        };
      });

      const total = resourceHints.preload + resourceHints.preconnect +
                   resourceHints.dnsPrefetch + resourceHints.prefetch;

      return this.pass(
        total > 0 ? `Resource hints implemented (${total} hints)` : 'No resource hints (consider adding for critical resources)',
        resourceHints
      );
    } catch (error) {
      return this.pass('Resource hints check skipped');
    }
  }

  private async checkCacheHeaders(): Promise<CheckOutcome> {
    try {
      if (!this.response) {
        return this.fail('Could not check cache headers');
      }

      const headers = this.response.headers();
      const cacheControl = headers['cache-control'];
      const expires = headers['expires'];
      const etag = headers['etag'];

      const hasCaching = !!(cacheControl || expires || etag);

      if (!hasCaching) {
        return this.fail('No cache headers found (add Cache-Control)', { cacheControl, expires, etag });
      }

      return this.pass('Cache headers present', { cacheControl, expires, etag });
    } catch (error) {
      return this.pass('Cache headers check skipped');
    }
  }

  private async checkServerResponseTime(): Promise<CheckOutcome> {
    try {
      const responseTime = await this.page.evaluate(() => {
        const perf = performance.timing;
        const ttfb = perf.responseStart - perf.navigationStart;
        return {
          ttfb,
          ttfbSeconds: (ttfb / 1000).toFixed(2),
        };
      });

      const failMs = this.threshold('server-response-time-acceptable', 'failMs', CWV_TTFB_FAIL_MS);
      const warnMs = this.threshold('server-response-time-acceptable', 'warnMs', CWV_TTFB_WARN_MS);

      if (responseTime.ttfb > failMs) {
        return this.fail(
          `Server response time is slow (${responseTime.ttfbSeconds}s TTFB). Target: < ${warnMs}ms`,
          responseTime
        );
      } else if (responseTime.ttfb > warnMs) {
        return this.pass(`Server response time is acceptable (${responseTime.ttfbSeconds}s TTFB)`, responseTime);
      }

      return this.pass(`Server response time is excellent (${responseTime.ttfbSeconds}s TTFB)`, responseTime);
    } catch (error) {
      return this.pass('Server response time check skipped');
    }
  }

  private async checkLCP(): Promise<CheckOutcome> {
    try {
      const metrics = await this.getCWVMetrics();
      if (!metrics || metrics.lcp === undefined) {
        return this.pass('LCP check skipped (no largest-contentful-paint entry observed)');
      }
      const goodMs = this.threshold('lcp-good', 'goodMs', CWV_LCP_GOOD_MS);
      const seconds = (metrics.lcp / 1000).toFixed(2);
      if (metrics.lcp > goodMs) {
        return this.fail(`LCP is slow (${seconds}s). Target: < ${goodMs / 1000}s`, { lcp: metrics.lcp });
      }
      return this.pass(`LCP is good (${seconds}s)`, { lcp: metrics.lcp });
    } catch (error) {
      return this.pass('LCP check skipped');
    }
  }

  private async checkCLS(): Promise<CheckOutcome> {
    try {
      const metrics = await this.getCWVMetrics();
      if (!metrics || metrics.cls === undefined) {
        return this.pass('CLS check skipped (no layout-shift entries observed)');
      }
      const goodScore = this.threshold('cls-good', 'goodScore', CWV_CLS_GOOD);
      if (metrics.cls > goodScore) {
        return this.fail(`CLS is high (${metrics.cls.toFixed(3)}). Target: < ${goodScore}`, { cls: metrics.cls });
      }
      return this.pass(`CLS is good (${metrics.cls.toFixed(3)})`, { cls: metrics.cls });
    } catch (error) {
      return this.pass('CLS check skipped');
    }
  }

  private async checkFCP(): Promise<CheckOutcome> {
    try {
      const metrics = await this.getCWVMetrics();
      if (!metrics || metrics.fcp === undefined) {
        return this.pass('FCP check skipped (no first-contentful-paint entry observed)');
      }
      const goodMs = this.threshold('fcp-good', 'goodMs', CWV_FCP_GOOD_MS);
      const seconds = (metrics.fcp / 1000).toFixed(2);
      if (metrics.fcp > goodMs) {
        return this.fail(`FCP is slow (${seconds}s). Target: < ${goodMs / 1000}s`, { fcp: metrics.fcp });
      }
      return this.pass(`FCP is good (${seconds}s)`, { fcp: metrics.fcp });
    } catch (error) {
      return this.pass('FCP check skipped');
    }
  }

  private async checkTTFB(): Promise<CheckOutcome> {
    try {
      const metrics = await this.getCWVMetrics();
      if (!metrics || metrics.ttfb === undefined) {
        return this.pass('TTFB check skipped (no navigation timing entry observed)');
      }
      const goodMs = this.threshold('ttfb-good', 'goodMs', CWV_TTFB_GOOD_MS);
      const seconds = (metrics.ttfb / 1000).toFixed(2);
      if (metrics.ttfb > goodMs) {
        return this.fail(`TTFB is slow (${seconds}s). Target: < ${goodMs / 1000}s`, { ttfb: metrics.ttfb });
      }
      return this.pass(`TTFB is good (${seconds}s)`, { ttfb: metrics.ttfb });
    } catch (error) {
      return this.pass('TTFB check skipped');
    }
  }

  private async checkTotalBlockingTime(): Promise<CheckOutcome> {
    try {
      const metrics = await this.getCWVMetrics();
      if (!metrics) {
        return this.pass('Total Blocking Time check skipped (metrics unavailable)');
      }
      const goodMs = this.threshold(
        'total-blocking-time-acceptable',
        'goodMs',
        CWV_TOTAL_BLOCKING_TIME_GOOD_MS
      );
      const tbt = Math.round(metrics.totalBlockingTime);
      if (tbt > goodMs) {
        return this.fail(
          `Total Blocking Time is high (${tbt}ms) — lab proxy for interactivity since INP needs real user input this unattended audit never provides. Target: < ${goodMs}ms`,
          { totalBlockingTime: tbt }
        );
      }
      return this.pass(`Total Blocking Time is good (${tbt}ms)`, { totalBlockingTime: tbt });
    } catch (error) {
      return this.pass('Total Blocking Time check skipped');
    }
  }
}
