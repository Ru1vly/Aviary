import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SEOChecker } from '../../src/index';
import { chromium } from 'playwright';

// Mock chromium
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('SEOChecker', () => {
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    mockPage = {
      title: vi.fn().mockResolvedValue('Test Page'),
      url: vi.fn().mockReturnValue('https://example.com'),
      goto: vi.fn().mockResolvedValue(null),
      setDefaultTimeout: vi.fn(),
      addInitScript: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue([]),
      locator: vi.fn().mockReturnValue({
        getAttribute: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
      }),
      close: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      context: vi.fn().mockReturnValue({
        request: {
          get: vi.fn().mockResolvedValue({
            status: vi.fn().mockReturnValue(200),
            text: vi.fn().mockResolvedValue('User-agent: *\nDisallow:'),
            headers: vi.fn().mockReturnValue({}),
          }),
        },
      }),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };

    (chromium.launch as any).mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const checker = new SEOChecker({ url: 'https://example.com' });
      expect(checker).toBeInstanceOf(SEOChecker);
    });

    it('should create instance with custom options', () => {
      const checker = new SEOChecker({
        url: 'https://example.com',
        headless: false,
        timeout: 60000,
        viewport: { width: 1280, height: 720 },
      });
      expect(checker).toBeInstanceOf(SEOChecker);
    });
  });

  describe('check', () => {
    it('should return a complete SEO report', async () => {
      const checker = new SEOChecker({ url: 'https://example.com' });
      const report = await checker.check();

      expect(report).toHaveProperty('url');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('checks');
      expect(report).toHaveProperty('score');
      expect(report).toHaveProperty('summary');

      expect(report.url).toBe('https://example.com');
      expect(report.checks).toHaveProperty('metaTags');
      expect(report.checks).toHaveProperty('headings');
      expect(report.checks).toHaveProperty('images');
      expect(report.summary).toHaveProperty('total');
      expect(report.summary).toHaveProperty('passed');
      expect(report.summary).toHaveProperty('failed');
    });

    it('should launch browser with correct options', async () => {
      const checker = new SEOChecker({
        url: 'https://example.com',
        headless: true,
      });
      await checker.check();

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
      });
    });

    it('should navigate to the correct URL', async () => {
      const checker = new SEOChecker({ url: 'https://example.com/page' });
      await checker.check();

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com/page',
        expect.objectContaining({
          waitUntil: 'networkidle',
        })
      );
    });

    it('should close browser after check', async () => {
      const checker = new SEOChecker({ url: 'https://example.com' });
      await checker.check();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should calculate score correctly', async () => {
      const checker = new SEOChecker({ url: 'https://example.com' });
      const report = await checker.check();

      expect(typeof report.score).toBe('number');
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    });

    it('should close browser even on error', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

      const checker = new SEOChecker({ url: 'https://example.com' });

      await expect(checker.check()).rejects.toThrow('Navigation failed');
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should degrade a crashing checker to failed results instead of failing the whole audit', async () => {
      // Every checker that calls page.evaluate() will now throw. Before the
      // resilience fix, this would reject the shared Promise.all in
      // runAllCheckers() and take every other checker's results down with
      // it — check() would reject entirely instead of returning a report.
      //
      // Two independent safety nets now exist. safeCheckAll() in index.ts
      // catches a checker whose checkAll() rejects outright and synthesizes
      // one "<checker> checker crashed: ..." result with a hardcoded 'error'
      // severity — but as of Phase 3, every checker either has its own
      // per-method try/catch or extends BaseChecker (src/checkers/base.ts),
      // which catches per-*check*, not per-checker, and produces a "Check
      // '<id>' crashed: ..." result with config-resolved severity instead —
      // finer-grained than before, since the checker's other checks keep
      // running. This test asserts the outcome both nets guarantee (crashed
      // checks are marked failed, name the original error, and carry a
      // valid severity) rather than which specific net catches it, since
      // that's an implementation detail of how far Phase 3's migration has
      // progressed, not the behavior being verified.
      mockPage.evaluate = vi.fn().mockRejectedValue(new Error('boom: injected checker failure'));

      const checker = new SEOChecker({ url: 'https://example.com' });
      const report = await checker.check();

      expect(report).toHaveProperty('score');
      expect(typeof report.score).toBe('number');
      expect(report.summary.total).toBeGreaterThan(0);

      const allChecks = Object.values(report.checks).flat();
      const crashedChecks = allChecks.filter(
        (c) => c.message.includes('crashed') && c.message.includes('boom: injected checker failure')
      );
      // At least one evaluate()-dependent check should have degraded to a
      // failed result naming the crash, proving the failure was contained
      // rather than propagated or silently dropped.
      expect(crashedChecks.length).toBeGreaterThan(0);
      for (const check of crashedChecks) {
        expect(check.passed).toBe(false);
        expect(['error', 'warning', 'info']).toContain(check.severity);
      }
    });
  });

  describe('close', () => {
    it('should handle multiple close calls gracefully', async () => {
      const checker = new SEOChecker({ url: 'https://example.com' });
      await checker.check();

      // Calling close again should not throw
      await expect(checker.close()).resolves.not.toThrow();
    });
  });
});
