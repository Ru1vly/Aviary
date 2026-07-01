import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEOChecker } from '../../src/index';
import { MockServer } from '../mocks/mockServer';

describe('E2E Tests - Full SEOChecker', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    mockServer = new MockServer(3456);
    await mockServer.start();
    // Wait a bit for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    await mockServer.stop();
  });

  it('should perform complete SEO check on optimal page', async () => {
    const checker = new SEOChecker({
      url: mockServer.getUrl('/optimal'),
      headless: true,
      timeout: 30000,
    });

    const report = await checker.check();

    // Verify report structure
    expect(report).toHaveProperty('url');
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('checks');
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('summary');

    // Verify URL
    expect(report.url).toBe(mockServer.getUrl('/optimal'));

    // Verify timestamp is valid ISO date
    expect(() => new Date(report.timestamp)).not.toThrow();

    // Verify score is a valid number
    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);

    // Verify summary
    expect(report.summary.total).toBeGreaterThan(0);
    expect(report.summary.passed + report.summary.failed).toBe(report.summary.total);

    // Verify all checker categories exist
    expect(report.checks.metaTags).toBeDefined();
    expect(report.checks.headings).toBeDefined();
    expect(report.checks.images).toBeDefined();
    expect(report.checks.content).toBeDefined();
    expect(report.checks.performance).toBeDefined();

    // For optimal page, score should be reasonably high
    expect(report.score).toBeGreaterThan(30);
  }, 60000);

  it('should perform complete SEO check on poor page', async () => {
    const checker = new SEOChecker({
      url: mockServer.getUrl('/poor'),
      headless: true,
      timeout: 30000,
    });

    const report = await checker.check();

    // Verify report structure
    expect(report).toHaveProperty('url');
    expect(report).toHaveProperty('checks');
    expect(report).toHaveProperty('score');

    // For poor page, should have many failed checks
    expect(report.summary.failed).toBeGreaterThan(0);

    // Score should be lower for poor page
    expect(report.score).toBeLessThan(85);
  }, 60000);

  it('should perform complete SEO check on medium page', async () => {
    const checker = new SEOChecker({
      url: mockServer.getUrl('/medium'),
      headless: true,
      timeout: 30000,
    });

    const report = await checker.check();

    // Verify report structure
    expect(report).toHaveProperty('url');
    expect(report).toHaveProperty('checks');

    // Should have some passed and some failed checks
    expect(report.summary.passed).toBeGreaterThan(0);
    expect(report.summary.total).toBeGreaterThan(0);
  }, 60000);

  it('should handle custom viewport settings', async () => {
    const checker = new SEOChecker({
      url: mockServer.getUrl('/optimal'),
      headless: true,
      timeout: 30000,
      viewport: { width: 375, height: 667 }, // Mobile viewport
    });

    const report = await checker.check();

    expect(report).toHaveProperty('score');
    expect(report.summary.total).toBeGreaterThan(0);
  }, 60000);

  it('should handle timeout settings', async () => {
    const checker = new SEOChecker({
      url: mockServer.getUrl('/optimal'),
      headless: true,
      timeout: 60000,
    });

    const report = await checker.check();

    expect(report).toHaveProperty('score');
  }, 70000);

  it('should properly close browser after check', async () => {
    const checker = new SEOChecker({
      url: mockServer.getUrl('/optimal'),
      headless: true,
    });

    await checker.check();

    // Should not throw when closing again
    await expect(checker.close()).resolves.not.toThrow();
  }, 60000);

  it('should compare scores between optimal and poor pages', async () => {
    const optimalChecker = new SEOChecker({
      url: mockServer.getUrl('/optimal'),
      headless: true,
    });

    const poorChecker = new SEOChecker({
      url: mockServer.getUrl('/poor'),
      headless: true,
    });

    const [optimalReport, poorReport] = await Promise.all([
      optimalChecker.check(),
      poorChecker.check(),
    ]);

    // Optimal page should have higher score than poor page
    expect(optimalReport.score).toBeGreaterThan(poorReport.score);

    // Optimal page should have more passed checks
    expect(optimalReport.summary.passed).toBeGreaterThan(poorReport.summary.passed);
  }, 90000);
});
