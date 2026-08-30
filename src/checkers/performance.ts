import { PerformanceMetrics } from '../types';
import { BaseChecker, CheckOutcome } from './base';

export class PerformanceChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'load-time-acceptable', run: () => this.checkLoadTime() },
      { id: 'dom-content-loaded-acceptable', run: () => this.checkDOMContentLoaded() },
    ];
  }

  private metricsPromise?: Promise<PerformanceMetrics>;

  private getMetrics(): Promise<PerformanceMetrics> {
    // Both checks need the same navigation-timing snapshot; cache the one
    // page.evaluate() call so checkAll() doesn't re-measure it per check.
    if (!this.metricsPromise) {
      this.metricsPromise = this.page.evaluate(() => {
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
    return this.metricsPromise;
  }

  private async checkLoadTime(): Promise<CheckOutcome> {
    const metrics = await this.getMetrics();
    const loadTimeSec = metrics.loadTime / 1000;

    if (loadTimeSec > 3) {
      return this.fail(`Page load time is slow (${loadTimeSec.toFixed(2)}s). Recommended: < 3s`, {
        loadTime: loadTimeSec,
      });
    }

    return this.pass(`Page load time is good (${loadTimeSec.toFixed(2)}s)`, { loadTime: loadTimeSec });
  }

  private async checkDOMContentLoaded(): Promise<CheckOutcome> {
    const metrics = await this.getMetrics();
    const domTimeSec = metrics.domContentLoaded / 1000;

    if (domTimeSec > 2) {
      return this.fail(
        `DOM content loaded time is slow (${domTimeSec.toFixed(2)}s). Recommended: < 2s`,
        { domContentLoaded: domTimeSec }
      );
    }

    return this.pass(`DOM content loaded time is good (${domTimeSec.toFixed(2)}s)`, {
      domContentLoaded: domTimeSec,
    });
  }
}
