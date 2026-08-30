import { describe, it, expect } from 'vitest';
import { HeadingsChecker } from '../../src/checkers/headings';
import { createMockPage } from '../mocks/mockPage';
import { Page } from 'playwright';

describe('HeadingsChecker', () => {
  describe('checkH1', () => {
    it('should pass when exactly one H1 is present', async () => {
      const mockPage = createMockPage({
        html: '<h1>Main Title</h1><h2>Subtitle</h2>',
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();
      const h1Result = results[0];

      expect(h1Result.passed).toBe(true);
      expect(h1Result.message).toContain('Single H1');
    });

    it('should fail when no H1 is present', async () => {
      const mockPage = createMockPage({
        html: '<h2>Subtitle</h2><h3>Section</h3>',
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();
      const h1Result = results[0];

      expect(h1Result.passed).toBe(false);
      expect(h1Result.message).toContain('No H1');
    });

    it('should fail when multiple H1s are present', async () => {
      const mockPage = createMockPage({
        html: '<h1>First Title</h1><h1>Second Title</h1><h2>Subtitle</h2>',
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();
      const h1Result = results[0];

      expect(h1Result.passed).toBe(false);
      expect(h1Result.message).toContain('Multiple H1');
    });
  });

  describe('checkHeadingHierarchy', () => {
    it('should pass when heading hierarchy is correct', async () => {
      const mockPage = createMockPage({
        html: '<h1>Main Title</h1><h2>Section 1</h2><h3>Subsection 1.1</h3><h2>Section 2</h2>',
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();
      const hierarchyResult = results[1];

      expect(hierarchyResult.passed).toBe(true);
      expect(hierarchyResult.message).toContain('properly structured');
    });

    it('should fail when heading levels are skipped', async () => {
      const mockPage = createMockPage({
        // h1 -> h3 skips h2
        html: '<h1>Main Title</h1><h3>Subsection</h3>',
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();
      const hierarchyResult = results[1];

      expect(hierarchyResult.passed).toBe(false);
      expect(hierarchyResult.message).toContain('issues');
    });
  });

  describe('checkHeadingLength', () => {
    it('should pass when all headings are appropriate length', async () => {
      const mockPage = createMockPage({
        html: '<h1>Short Title</h1><h2>Another Good Length Heading</h2>',
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();
      const lengthResult = results[2];

      expect(lengthResult.passed).toBe(true);
      expect(lengthResult.message).toContain('appropriate length');
    });

    it('should fail when headings are too long', async () => {
      const longHeading =
        'This is a very long heading that exceeds the recommended seventy character limit for optimal SEO';
      const mockPage = createMockPage({
        html: `<h1>${longHeading}</h1>`,
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();
      const lengthResult = results[2];

      expect(lengthResult.passed).toBe(false);
      expect(lengthResult.message).toContain('too long');
    });
  });

  describe('checkAll', () => {
    it('should return all heading check results', async () => {
      const mockPage = createMockPage({
        html: '<h1>Main Title</h1><h2>Section</h2>',
      }) as Page;

      const checker = new HeadingsChecker(mockPage);
      const results = await checker.checkAll();

      expect(results).toHaveLength(3);
      expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
    });
  });
});
