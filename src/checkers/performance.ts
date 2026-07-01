import { Page } from 'playwright';
import { SEOCheckResult, PerformanceMetrics } from '../types';

export class PerformanceChecker {
  constructor(private page: Page) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    const metrics = await this.getMetrics();
    results.push(this.checkLoadTime(metrics));
    results.push(this.checkDOMContentLoaded(metrics));

    return results;
  }

  private async getMetrics(): Promise<PerformanceMetrics> {
    return await this.page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0,
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : 0,
        firstContentfulPaint: performance
          .getEntriesByType('paint')
          .find((entry) => entry.name === 'first-contentful-paint')?.startTime,
      };
    });
  }

  private checkLoadTime(metrics: PerformanceMetrics): SEOCheckResult {
    const loadTimeSec = metrics.loadTime / 1000;

    if (loadTimeSec > 3) {
      return {
        passed: false,
        message: `Page load time is slow (${loadTimeSec.toFixed(2)}s). Recommended: < 3s`,
        details: { loadTime: loadTimeSec },
      };
    }

    return {
      passed: true,
      message: `Page load time is good (${loadTimeSec.toFixed(2)}s)`,
      details: { loadTime: loadTimeSec },
    };
  }

  private checkDOMContentLoaded(metrics: PerformanceMetrics): SEOCheckResult {
    const domTimeSec = metrics.domContentLoaded / 1000;

    if (domTimeSec > 2) {
      return {
        passed: false,
        message: `DOM content loaded time is slow (${domTimeSec.toFixed(2)}s). Recommended: < 2s`,
        details: { domContentLoaded: domTimeSec },
      };
    }

    return {
      passed: true,
      message: `DOM content loaded time is good (${domTimeSec.toFixed(2)}s)`,
      details: { domContentLoaded: domTimeSec },
    };
  }
}
