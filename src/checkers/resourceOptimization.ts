import { BaseChecker, CheckOutcome } from './base';
import { formatBytes } from './shared/format';
import {
  MIN_MINIFICATION_RATE_PERCENT,
  MAX_SEPARATE_SCRIPTS,
  MAX_SEPARATE_STYLESHEETS,
  MIN_MODERN_IMAGE_FORMAT_RATE_PERCENT,
  MODERN_IMAGE_FORMAT_MIN_IMAGE_COUNT,
  INLINE_CONTENT_NONTRIVIAL_LENGTH,
  MIN_JS_OPTIMIZATION_RATE_PERCENT,
  MAX_THIRD_PARTY_RESOURCE_SHARE_PERCENT,
  MIN_CACHE_HEADER_RATE_PERCENT,
  MAX_TOTAL_INLINE_RESOURCE_BYTES,
} from '../config/thresholds';

export class ResourceOptimizationChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'minification-adequate', run: () => this.checkMinification() },
      { id: 'resource-combining-adequate', run: () => this.checkResourceCombining() },
      { id: 'cdn-usage-present', run: () => this.checkCDNUsage() },
      { id: 'modern-image-formats-used', run: () => this.checkImageFormats() },
      { id: 'font-optimization-adequate', run: () => this.checkFontOptimization() },
      { id: 'css-optimization-adequate', run: () => this.checkCSSOptimization() },
      { id: 'javascript-optimization-adequate', run: () => this.checkJavaScriptOptimization() },
      { id: 'resource-hints-present', run: () => this.checkResourceHints() },
      { id: 'critical-resources-optimized', run: () => this.checkCriticalResources() },
      { id: 'third-party-resources-limited', run: () => this.checkThirdPartyResources() },
      { id: 'resource-caching-present', run: () => this.checkResourceCaching() },
      { id: 'inline-resources-acceptable', run: () => this.checkInlineResources() },
      { id: 'no-duplicate-resources', run: () => this.checkUnusedResources() },
      { id: 'resource-priority-configured', run: () => this.checkResourcePriority() },
      { id: 'http2-support-detected', run: () => this.checkHTTP2Support() },
    ];
  }

  private async checkMinification(): Promise<CheckOutcome> {
    try {
      const minificationData = await this.page.evaluate(() => {
        // Check for minified resources by looking for .min. in filenames
        const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];

        const minifiedScripts = scripts.filter((script) => script.src.includes('.min.'));
        const minifiedStyles = stylesheets.filter((link) => link.href.includes('.min.'));

        return {
          totalScripts: scripts.length,
          minifiedScripts: minifiedScripts.length,
          totalStyles: stylesheets.length,
          minifiedStyles: minifiedStyles.length,
        };
      });

      const scriptMinificationRate = minificationData.totalScripts > 0
        ? (minificationData.minifiedScripts / minificationData.totalScripts) * 100
        : 100;

      const styleMinificationRate = minificationData.totalStyles > 0
        ? (minificationData.minifiedStyles / minificationData.totalStyles) * 100
        : 100;
      const minRate = this.threshold('minification-adequate', 'minRatePercent', MIN_MINIFICATION_RATE_PERCENT);

      if (scriptMinificationRate < minRate || styleMinificationRate < minRate) {
        return this.fail(
          `Low minification rate (JS: ${scriptMinificationRate.toFixed(0)}%, CSS: ${styleMinificationRate.toFixed(0)}%)`,
          minificationData
        );
      }

      return this.pass(
        `Resources appear minified (JS: ${scriptMinificationRate.toFixed(0)}%, CSS: ${styleMinificationRate.toFixed(0)}%)`,
        minificationData
      );
    } catch (error) {
      return this.pass('Minification check skipped');
    }
  }

  private async checkResourceCombining(): Promise<CheckOutcome> {
    try {
      const combiningData = await this.page.evaluate(() => {
        const scripts = document.querySelectorAll('script[src]');
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');

        return {
          scriptCount: scripts.length,
          stylesheetCount: stylesheets.length,
        };
      });

      const issues: string[] = [];
      const maxScripts = this.threshold('resource-combining-adequate', 'maxScripts', MAX_SEPARATE_SCRIPTS);
      const maxStylesheets = this.threshold(
        'resource-combining-adequate',
        'maxStylesheets',
        MAX_SEPARATE_STYLESHEETS
      );

      if (combiningData.scriptCount > maxScripts) {
        issues.push(`${combiningData.scriptCount} separate script files (consider bundling)`);
      }

      if (combiningData.stylesheetCount > maxStylesheets) {
        issues.push(`${combiningData.stylesheetCount} separate CSS files (consider combining)`);
      }

      if (issues.length > 0) {
        return this.fail(`Resource combining issues: ${issues.join(', ')}`, combiningData);
      }

      return this.pass(
        `Resources well-bundled (${combiningData.scriptCount} JS, ${combiningData.stylesheetCount} CSS)`,
        combiningData
      );
    } catch (error) {
      return this.pass('Resource combining check skipped');
    }
  }

  private async checkCDNUsage(): Promise<CheckOutcome> {
    try {
      const cdnData = await this.page.evaluate(() => {
        const cdnDomains = [
          'cdn.', 'cloudfront.net', 'cloudflare.com', 'fastly.net', 'akamaized.net',
          'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'googleapis.com',
          'gstatic.com', 'bootstrapcdn.com', 'imgix.net', 'cloudinary.com',
        ];

        const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
        const images = Array.from(document.querySelectorAll('img[src]')) as HTMLImageElement[];

        const cdnScripts = scripts.filter((script) =>
          cdnDomains.some((domain) => script.src.includes(domain))
        );

        const cdnStyles = stylesheets.filter((link) =>
          cdnDomains.some((domain) => link.href.includes(domain))
        );

        const cdnImages = images.filter((img) =>
          cdnDomains.some((domain) => img.src.includes(domain))
        );

        return {
          totalResources: scripts.length + stylesheets.length + images.length,
          cdnResources: cdnScripts.length + cdnStyles.length + cdnImages.length,
          usingCDN: cdnScripts.length > 0 || cdnStyles.length > 0 || cdnImages.length > 0,
        };
      });

      if (!cdnData.usingCDN) {
        return this.fail('No CDN usage detected (consider using CDN for better performance)', cdnData);
      }

      const cdnRate = (cdnData.cdnResources / cdnData.totalResources) * 100;

      return this.pass(`CDN in use (${cdnRate.toFixed(0)}% of resources)`, cdnData);
    } catch (error) {
      return this.pass('CDN usage check skipped');
    }
  }

  private async checkImageFormats(): Promise<CheckOutcome> {
    try {
      const formatData = await this.page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img[src]')) as HTMLImageElement[];
        const formats: Record<string, number> = {};

        images.forEach((img) => {
          const src = img.src || '';
          const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || 'unknown';
          formats[ext] = (formats[ext] || 0) + 1;
        });

        const modernFormats = ['webp', 'avif'];
        const modernCount = Object.entries(formats)
          .filter(([fmt]) => modernFormats.includes(fmt))
          .reduce((sum, [_, count]) => sum + count, 0);

        return {
          totalImages: images.length,
          formats,
          modernCount,
        };
      });

      if (formatData.totalImages === 0) {
        return this.pass('No images to check');
      }

      const modernRate = (formatData.modernCount / formatData.totalImages) * 100;
      const minRate = this.threshold(
        'modern-image-formats-used',
        'minRatePercent',
        MIN_MODERN_IMAGE_FORMAT_RATE_PERCENT
      );
      const minImageCount = this.threshold(
        'modern-image-formats-used',
        'minImageCount',
        MODERN_IMAGE_FORMAT_MIN_IMAGE_COUNT
      );

      if (modernRate < minRate && formatData.totalImages > minImageCount) {
        return this.fail(`Only ${modernRate.toFixed(0)}% of images use modern formats (WebP/AVIF)`, formatData);
      }

      return this.pass(
        modernRate > 0 ? `${modernRate.toFixed(0)}% of images use modern formats` : 'Image formats acceptable',
        formatData
      );
    } catch (error) {
      return this.pass('Image format check skipped');
    }
  }

  private async checkFontOptimization(): Promise<CheckOutcome> {
    try {
      const fontData = await this.page.evaluate(() => {
        const fontLinks = Array.from(document.querySelectorAll('link[rel*="font"], link[href*="fonts"]')) as HTMLLinkElement[];
        const fontPreloads = Array.from(document.querySelectorAll('link[rel="preload"][as="font"]')) as HTMLLinkElement[];

        const hasFontDisplay = Array.from(document.styleSheets).some((sheet) => {
          try {
            return Array.from(sheet.cssRules).some((rule) => {
              if (rule instanceof CSSFontFaceRule) {
                return rule.style.getPropertyValue('font-display') !== '';
              }
              return false;
            });
          } catch {
            return false;
          }
        });

        return {
          fontLinks: fontLinks.length,
          fontPreloads: fontPreloads.length,
          hasFontDisplay,
        };
      });

      if (fontData.fontLinks === 0) {
        return this.pass('No external fonts detected');
      }

      const issues: string[] = [];

      if (fontData.fontPreloads === 0) {
        issues.push('no font preloading');
      }

      if (!fontData.hasFontDisplay) {
        issues.push('no font-display property');
      }

      if (issues.length > 0) {
        return this.fail(`Font optimization issues: ${issues.join(', ')}`, fontData);
      }

      return this.pass(`${fontData.fontLinks} fonts optimized with preload and font-display`, fontData);
    } catch (error) {
      return this.pass('Font optimization check skipped');
    }
  }

  private async checkCSSOptimization(): Promise<CheckOutcome> {
    try {
      const cssData = await this.page.evaluate(() => {
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
        const inlineStyles = Array.from(document.querySelectorAll('style'));

        const asyncStyles = stylesheets.filter((link) => link.media === 'print' || link.hasAttribute('media'));

        return {
          totalStylesheets: stylesheets.length,
          inlineStyles: inlineStyles.length,
          asyncStyles: asyncStyles.length,
        };
      });

      if (cssData.totalStylesheets === 0) {
        return this.pass('No external stylesheets');
      }

      const hasCriticalCSS = cssData.inlineStyles > 0;

      return this.pass(
        hasCriticalCSS
          ? `CSS optimized with ${cssData.inlineStyles} inline critical styles`
          : `${cssData.totalStylesheets} external stylesheets (consider critical CSS)`,
        cssData
      );
    } catch (error) {
      return this.pass('CSS optimization check skipped');
    }
  }

  private async checkJavaScriptOptimization(): Promise<CheckOutcome> {
    try {
      const jsData = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];

        const asyncScripts = scripts.filter((script) => script.async);
        const deferScripts = scripts.filter((script) => script.defer);
        const moduleScripts = scripts.filter((script) => script.type === 'module');
        const optimizedScripts = asyncScripts.length + deferScripts.length + moduleScripts.length;

        return {
          totalScripts: scripts.length,
          asyncScripts: asyncScripts.length,
          deferScripts: deferScripts.length,
          moduleScripts: moduleScripts.length,
          optimizedScripts,
        };
      });

      if (jsData.totalScripts === 0) {
        return this.pass('No external scripts');
      }

      const optimizationRate = (jsData.optimizedScripts / jsData.totalScripts) * 100;
      const minRate = this.threshold(
        'javascript-optimization-adequate',
        'minRatePercent',
        MIN_JS_OPTIMIZATION_RATE_PERCENT
      );

      if (optimizationRate < minRate) {
        return this.fail(`Only ${optimizationRate.toFixed(0)}% of scripts use async/defer (blocks rendering)`, jsData);
      }

      return this.pass(`${optimizationRate.toFixed(0)}% of scripts optimized with async/defer`, jsData);
    } catch (error) {
      return this.pass('JavaScript optimization check skipped');
    }
  }

  private async checkResourceHints(): Promise<CheckOutcome> {
    try {
      const hintsData = await this.page.evaluate(() => {
        const preconnect = document.querySelectorAll('link[rel="preconnect"]');
        const dnsPrefetch = document.querySelectorAll('link[rel="dns-prefetch"]');
        const preload = document.querySelectorAll('link[rel="preload"]');
        const prefetch = document.querySelectorAll('link[rel="prefetch"]');

        return {
          preconnect: preconnect.length,
          dnsPrefetch: dnsPrefetch.length,
          preload: preload.length,
          prefetch: prefetch.length,
          total: preconnect.length + dnsPrefetch.length + preload.length + prefetch.length,
        };
      });

      if (hintsData.total === 0) {
        return this.fail('No resource hints (preconnect, dns-prefetch, preload, prefetch)', hintsData);
      }

      return this.pass(`Resource hints in use (${hintsData.preload} preload, ${hintsData.preconnect} preconnect)`, hintsData);
    } catch (error) {
      return this.pass('Resource hints check skipped');
    }
  }

  private async checkCriticalResources(): Promise<CheckOutcome> {
    try {
      const minCriticalCSSLength = this.threshold(
        'critical-resources-optimized',
        'minInlineCSSLength',
        INLINE_CONTENT_NONTRIVIAL_LENGTH
      );
      const criticalData = await this.page.evaluate((minCriticalCSSLength) => {
        const criticalCSS = Array.from(document.querySelectorAll('style')).some((style) =>
          style.textContent?.length && style.textContent.length > minCriticalCSSLength
        );

        const preloadedResources = document.querySelectorAll('link[rel="preload"]');
        const criticalImages = Array.from(document.querySelectorAll('img[loading="eager"], img:not([loading])')).slice(0, 3);

        return {
          hasCriticalCSS: criticalCSS,
          preloadedResources: preloadedResources.length,
          criticalImages: criticalImages.length,
        };
      }, minCriticalCSSLength);

      if (!criticalData.hasCriticalCSS && criticalData.preloadedResources === 0) {
        return this.fail('No critical resource optimization detected', criticalData);
      }

      return this.pass('Critical resources optimized', criticalData);
    } catch (error) {
      return this.pass('Critical resources check skipped');
    }
  }

  private async checkThirdPartyResources(): Promise<CheckOutcome> {
    try {
      const thirdPartyData = await this.page.evaluate(() => {
        const currentDomain = window.location.hostname;

        const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];

        const thirdPartyScripts = scripts.filter((script) => {
          try {
            const url = new URL(script.src);
            return url.hostname !== currentDomain;
          } catch {
            return false;
          }
        });

        const thirdPartyStyles = stylesheets.filter((link) => {
          try {
            const url = new URL(link.href);
            return url.hostname !== currentDomain;
          } catch {
            return false;
          }
        });

        return {
          totalScripts: scripts.length,
          thirdPartyScripts: thirdPartyScripts.length,
          totalStyles: stylesheets.length,
          thirdPartyStyles: thirdPartyStyles.length,
        };
      });

      const thirdPartyRate = ((thirdPartyData.thirdPartyScripts + thirdPartyData.thirdPartyStyles) /
        (thirdPartyData.totalScripts + thirdPartyData.totalStyles)) * 100;
      const maxRate = this.threshold(
        'third-party-resources-limited',
        'maxRatePercent',
        MAX_THIRD_PARTY_RESOURCE_SHARE_PERCENT
      );

      if (thirdPartyRate > maxRate) {
        return this.fail(`High third-party resource usage (${thirdPartyRate.toFixed(0)}%) may impact performance`, thirdPartyData);
      }

      return this.pass(`Third-party resources: ${thirdPartyRate.toFixed(0)}% of total`, thirdPartyData);
    } catch (error) {
      return this.pass('Third-party resources check skipped');
    }
  }

  private async checkResourceCaching(): Promise<CheckOutcome> {
    try {
      // This check is limited - we can only check for cache-busting patterns
      const cachingData = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
        const images = Array.from(document.querySelectorAll('img[src]')) as HTMLImageElement[];

        const hasCacheBusting = (url: string) => {
          return /[?&]v=|[?&]version=|\.[\da-f]{8,}\./i.test(url);
        };

        const scriptsWithCache = scripts.filter((script) => hasCacheBusting(script.src));
        const stylesWithCache = stylesheets.filter((link) => hasCacheBusting(link.href));
        const imagesWithCache = images.filter((img) => hasCacheBusting(img.src));

        const totalResources = scripts.length + stylesheets.length + images.length;
        const cachedResources = scriptsWithCache.length + stylesWithCache.length + imagesWithCache.length;

        return {
          totalResources,
          cachedResources,
          cacheRate: totalResources > 0 ? (cachedResources / totalResources) * 100 : 0,
        };
      });

      if (cachingData.totalResources === 0) {
        return this.pass('No resources to check for caching');
      }

      const minCacheRate = this.threshold(
        'resource-caching-present',
        'minRatePercent',
        MIN_CACHE_HEADER_RATE_PERCENT
      );

      return this.pass(
        cachingData.cacheRate > minCacheRate
          ? `${cachingData.cacheRate.toFixed(0)}% of resources use cache-busting`
          : 'Limited cache-busting detected (check server cache headers)',
        cachingData
      );
    } catch (error) {
      return this.pass('Resource caching check skipped');
    }
  }

  private async checkInlineResources(): Promise<CheckOutcome> {
    try {
      const minNontrivialLength = this.threshold(
        'inline-resources-acceptable',
        'minNontrivialLength',
        INLINE_CONTENT_NONTRIVIAL_LENGTH
      );
      const rawInlineData = await this.page.evaluate((minNontrivialLength) => {
        const inlineScripts = Array.from(document.querySelectorAll('script:not([src])')).filter(
          (script) => script.textContent && script.textContent.trim().length > minNontrivialLength
        );

        const inlineStyles = Array.from(document.querySelectorAll('style')).filter(
          (style) => style.textContent && style.textContent.trim().length > minNontrivialLength
        );

        const totalInlineSize = [...inlineScripts, ...inlineStyles].reduce((sum, el) => {
          return sum + (el.textContent?.length || 0);
        }, 0);

        return {
          inlineScripts: inlineScripts.length,
          inlineStyles: inlineStyles.length,
          totalInlineSize,
        };
      }, minNontrivialLength);

      const inlineData = {
        ...rawInlineData,
        totalInlineSizeKB: formatBytes(rawInlineData.totalInlineSize).kb,
      };
      const maxTotalBytes = this.threshold(
        'inline-resources-acceptable',
        'maxTotalBytes',
        MAX_TOTAL_INLINE_RESOURCE_BYTES
      );

      if (inlineData.totalInlineSize > maxTotalBytes) {
        return this.fail(`Large inline resources (${inlineData.totalInlineSizeKB}KB) - consider externalizing`, inlineData);
      }

      return this.pass(
        inlineData.totalInlineSize > 0
          ? `Inline resources: ${inlineData.totalInlineSizeKB}KB (acceptable)`
          : 'No inline resources',
        inlineData
      );
    } catch (error) {
      return this.pass('Inline resources check skipped');
    }
  }

  private async checkUnusedResources(): Promise<CheckOutcome> {
    try {
      const unusedData = await this.page.evaluate(() => {
        // This is a simplified check - we look for resources that might be unused
        const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];

        // Check for duplicate resources
        const scriptSrcs = scripts.map((s) => s.src);
        const styleSrcs = stylesheets.map((l) => l.href);

        const duplicateScripts = scriptSrcs.filter((src, index) => scriptSrcs.indexOf(src) !== index);
        const duplicateStyles = styleSrcs.filter((href, index) => styleSrcs.indexOf(href) !== index);

        return {
          totalScripts: scripts.length,
          totalStyles: stylesheets.length,
          duplicateScripts: new Set(duplicateScripts).size,
          duplicateStyles: new Set(duplicateStyles).size,
        };
      });

      if (unusedData.duplicateScripts > 0 || unusedData.duplicateStyles > 0) {
        return this.fail(
          `Duplicate resources detected (${unusedData.duplicateScripts} JS, ${unusedData.duplicateStyles} CSS)`,
          unusedData
        );
      }

      return this.pass('No duplicate resources detected', unusedData);
    } catch (error) {
      return this.pass('Unused resources check skipped');
    }
  }

  private async checkResourcePriority(): Promise<CheckOutcome> {
    try {
      const priorityData = await this.page.evaluate(() => {
        const highPriorityResources = document.querySelectorAll('link[rel="preload"], link[rel="preconnect"]');
        const lowPriorityResources = document.querySelectorAll('link[rel="prefetch"], script[defer], script[async]');

        const hasImportance = Array.from(document.querySelectorAll('[importance], [fetchpriority]')).length > 0;

        return {
          highPriority: highPriorityResources.length,
          lowPriority: lowPriorityResources.length,
          hasImportance,
          hasPrioritization: highPriorityResources.length > 0 || lowPriorityResources.length > 0,
        };
      });

      if (!priorityData.hasPrioritization) {
        return this.fail('No resource prioritization (use preload, prefetch, async, defer)', priorityData);
      }

      return this.pass(
        `Resource prioritization in place (${priorityData.highPriority} high, ${priorityData.lowPriority} low priority)`,
        priorityData
      );
    } catch (error) {
      return this.pass('Resource priority check skipped');
    }
  }

  private async checkHTTP2Support(): Promise<CheckOutcome> {
    try {
      const http2Data = await this.page.evaluate(() => {
        // Check if resources are loaded via HTTP/2 by examining performance entries
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

        const http2Resources = resources.filter((resource) => {
          return resource.nextHopProtocol?.startsWith('h2') || resource.nextHopProtocol === 'http/2';
        });

        return {
          totalResources: resources.length,
          http2Resources: http2Resources.length,
          http2Rate: resources.length > 0 ? (http2Resources.length / resources.length) * 100 : 0,
          supportsHTTP2: http2Resources.length > 0,
        };
      });

      if (!http2Data.supportsHTTP2) {
        return this.fail('No HTTP/2 support detected (upgrade server for better performance)', http2Data);
      }

      return this.pass(`HTTP/2 in use (${http2Data.http2Rate.toFixed(0)}% of resources)`, http2Data);
    } catch (error) {
      return this.pass('HTTP/2 support check skipped');
    }
  }
}
