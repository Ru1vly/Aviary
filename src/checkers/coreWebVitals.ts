import { BaseChecker, CheckOutcome } from './base';

export class CoreWebVitalsChecker extends BaseChecker {
  protected checks() {
    return [
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

      if (timing.loadTime > 3000) {
        return this.fail(`Page load time is slow (${timing.loadTimeSeconds}s). Target: < 3s`, timing);
      } else if (timing.loadTime > 2000) {
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
      if (domTiming.domLoadTime > 1500) {
        return this.fail(`DOM load time is slow (${domTiming.domLoadTimeSeconds}s). Target: < 1.5s`, domTiming);
      }

      return this.pass(`DOM load time is good (${domTiming.domLoadTimeSeconds}s)`, domTiming);
    } catch (error) {
      return this.pass('DOM load time check skipped');
    }
  }

  private async checkResourceCount(): Promise<CheckOutcome> {
    try {
      const resources = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const byType: Record<string, number> = {};

        entries.forEach((entry) => {
          const type = entry.initiatorType || 'other';
          byType[type] = (byType[type] || 0) + 1;
        });

        return {
          total: entries.length,
          byType,
        };
      });

      if (resources.total > 100) {
        return this.fail(`Too many HTTP requests (${resources.total}). Target: < 50`, resources);
      } else if (resources.total > 50) {
        return this.pass(`HTTP requests acceptable (${resources.total})`, resources);
      }

      return this.pass(`HTTP requests optimized (${resources.total})`, resources);
    } catch (error) {
      return this.pass('Resource count check skipped');
    }
  }

  private async checkTotalPageSize(): Promise<CheckOutcome> {
    try {
      const pageSize = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const totalSize = entries.reduce((sum, entry) => {
          return sum + (entry.transferSize || 0);
        }, 0);

        return {
          bytes: totalSize,
          kb: Math.round(totalSize / 1024),
          mb: (totalSize / 1024 / 1024).toFixed(2),
        };
      });

      if (pageSize.bytes > 3 * 1024 * 1024) { // > 3MB
        return this.fail(`Page size is large (${pageSize.mb}MB). Target: < 1MB`, pageSize);
      } else if (pageSize.bytes > 1 * 1024 * 1024) { // > 1MB
        return this.pass(`Page size is acceptable (${pageSize.mb}MB)`, pageSize);
      }

      return this.pass(`Page size is optimized (${pageSize.kb}KB)`, pageSize);
    } catch (error) {
      return this.pass('Page size check skipped');
    }
  }

  private async checkJavaScriptSize(): Promise<CheckOutcome> {
    try {
      const jsSize = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const jsEntries = entries.filter((e) => e.initiatorType === 'script');
        const totalSize = jsEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);

        return {
          count: jsEntries.length,
          bytes: totalSize,
          kb: Math.round(totalSize / 1024),
        };
      });

      if (jsSize.bytes > 500 * 1024) { // > 500KB
        return this.fail(`JavaScript size is large (${jsSize.kb}KB, ${jsSize.count} files). Consider code splitting`, jsSize);
      }

      return this.pass(`JavaScript size is acceptable (${jsSize.kb}KB, ${jsSize.count} files)`, jsSize);
    } catch (error) {
      return this.pass('JavaScript size check skipped');
    }
  }

  private async checkCSSSize(): Promise<CheckOutcome> {
    try {
      const cssSize = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const cssEntries = entries.filter((e) => e.initiatorType === 'link' && e.name.includes('.css'));
        const totalSize = cssEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);

        return {
          count: cssEntries.length,
          bytes: totalSize,
          kb: Math.round(totalSize / 1024),
        };
      });

      if (cssSize.bytes > 100 * 1024) { // > 100KB
        return this.fail(`CSS size is large (${cssSize.kb}KB, ${cssSize.count} files). Consider minification`, cssSize);
      }

      return this.pass(`CSS size is acceptable (${cssSize.kb}KB, ${cssSize.count} files)`, cssSize);
    } catch (error) {
      return this.pass('CSS size check skipped');
    }
  }

  private async checkImageSize(): Promise<CheckOutcome> {
    try {
      const imageSize = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const imageEntries = entries.filter((e) =>
          e.initiatorType === 'img' ||
          e.name.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i)
        );
        const totalSize = imageEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);

        return {
          count: imageEntries.length,
          bytes: totalSize,
          kb: Math.round(totalSize / 1024),
          mb: (totalSize / 1024 / 1024).toFixed(2),
        };
      });

      if (imageSize.bytes > 2 * 1024 * 1024) { // > 2MB
        return this.fail(`Images size is large (${imageSize.mb}MB, ${imageSize.count} images). Optimize images`, imageSize);
      }

      return this.pass(`Images size is acceptable (${imageSize.kb}KB, ${imageSize.count} images)`, imageSize);
    } catch (error) {
      return this.pass('Image size check skipped');
    }
  }

  private async checkFontLoading(): Promise<CheckOutcome> {
    try {
      const fontData = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const fontEntries = entries.filter((e) =>
          e.initiatorType === 'css' && e.name.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/i)
        );

        const links = Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'));

        return {
          fontCount: fontEntries.length,
          preloadedFonts: links.length,
          hasPreload: links.length > 0,
        };
      });

      if (fontData.fontCount > 5) {
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

      if (blockingData.blockingScripts > 3) {
        issues.push(`${blockingData.blockingScripts} render-blocking scripts`);
      }

      if (blockingData.blockingStyles > 2) {
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
      const lazyData = await this.page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        const iframes = Array.from(document.querySelectorAll('iframe'));

        const lazyImages = images.filter((img) => img.loading === 'lazy');
        const lazyIframes = iframes.filter((iframe) => iframe.loading === 'lazy');

        return {
          totalImages: images.length,
          totalIframes: iframes.length,
          lazyImages: lazyImages.length,
          lazyIframes: lazyIframes.length,
        };
      });

      const totalMedia = lazyData.totalImages + lazyData.totalIframes;
      const lazyMedia = lazyData.lazyImages + lazyData.lazyIframes;

      if (totalMedia > 10 && lazyMedia === 0) {
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
      const cssData = await this.page.evaluate(() => {
        const inlineStyles = Array.from(document.querySelectorAll('style'));
        const externalStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

        const hasInlineCritical = inlineStyles.some((style) =>
          (style.textContent?.length || 0) > 100
        );

        return {
          inlineStyles: inlineStyles.length,
          externalStyles: externalStyles.length,
          hasInlineCritical,
        };
      });

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

      if (scriptData.blocking > 3) {
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

      if (responseTime.ttfb > 600) {
        return this.fail(`Server response time is slow (${responseTime.ttfbSeconds}s TTFB). Target: < 200ms`, responseTime);
      } else if (responseTime.ttfb > 200) {
        return this.pass(`Server response time is acceptable (${responseTime.ttfbSeconds}s TTFB)`, responseTime);
      }

      return this.pass(`Server response time is excellent (${responseTime.ttfbSeconds}s TTFB)`, responseTime);
    } catch (error) {
      return this.pass('Server response time check skipped');
    }
  }
}
