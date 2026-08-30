import { describe, it, expect } from 'vitest';
import { ContentChecker } from '../../src/checkers/content';
import { createMockPage } from '../mocks/mockPage';
import { Page } from 'playwright';

describe('ContentChecker', () => {
  describe('checkWordCount', () => {
    it('should pass with good content length (>300 words)', async () => {
      const longContent = 'word '.repeat(500);
      const mockPage = createMockPage({ html: `<p>${longContent}</p>` }) as Page;

      const checker = new ContentChecker(mockPage);
      const results = await checker.checkAll();
      const wordCountResult = results[0];

      expect(wordCountResult.passed).toBe(true);
      expect(wordCountResult.message).toContain('content length');
    });

    it('should fail with too short content (<300 words)', async () => {
      const shortContent = 'word '.repeat(50);
      const mockPage = createMockPage({ html: `<p>${shortContent}</p>` }) as Page;

      const checker = new ContentChecker(mockPage);
      const results = await checker.checkAll();
      const wordCountResult = results[0];

      expect(wordCountResult.passed).toBe(false);
      expect(wordCountResult.message).toContain('too short');
    });

    it('should report excellent content length (>1000 words)', async () => {
      const excellentContent = 'word '.repeat(1500);
      const mockPage = createMockPage({ html: `<p>${excellentContent}</p>` }) as Page;

      const checker = new ContentChecker(mockPage);
      const results = await checker.checkAll();
      const wordCountResult = results[0];

      expect(wordCountResult.passed).toBe(true);
      expect(wordCountResult.message).toContain('Excellent');
    });

    it('excludes script, style, nav, footer, and header content from the word count', async () => {
      // Real-DOM regression test: the old mock's canned `innerText` value
      // could never actually verify this exclusion logic runs correctly,
      // since it just handed back a pre-computed string. This exercises
      // ContentChecker's real clone-and-strip behavior.
      const html = `
        <script>var shouldNotCount = "${'scripttext '.repeat(400)}";</script>
        <style>.should-not-count { content: "${'styletext '.repeat(400)}"; }</style>
        <nav>${'navtext '.repeat(400)}</nav>
        <header>${'headertext '.repeat(400)}</header>
        <footer>${'footertext '.repeat(400)}</footer>
        <p>${'word '.repeat(50)}</p>
      `;
      const mockPage = createMockPage({ html }) as Page;

      const checker = new ContentChecker(mockPage);
      const results = await checker.checkAll();
      const wordCountResult = results[0];

      // Only the <p> content (50 words) should count — well under 300,
      // even though script/style/nav/header/footer alone would exceed it.
      expect(wordCountResult.passed).toBe(false);
      expect(wordCountResult.details?.wordCount).toBe(50);
    });
  });

  describe('checkAll', () => {
    it('should return all content check results', async () => {
      const mockPage = createMockPage({
        html: `<h1>Heading</h1><p>${'word '.repeat(500)}</p><ul><li>item</li></ul>`,
      }) as Page;

      const checker = new ContentChecker(mockPage);
      const results = await checker.checkAll();

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
    });
  });
});
