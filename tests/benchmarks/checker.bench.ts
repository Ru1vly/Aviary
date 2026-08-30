import { bench, describe } from 'vitest';
import { MetaTagsChecker } from '../../src/checkers/metaTags';
import { HeadingsChecker } from '../../src/checkers/headings';
import { ImagesChecker } from '../../src/checkers/images';
import { ContentChecker } from '../../src/checkers/content';
import { createMockPage } from '../mocks/mockPage';
import { Page } from 'playwright';

function headingsHtml(sectionCount: number): string {
  let html = '<h1>Main Title</h1>';
  for (let i = 0; i < sectionCount; i++) {
    html += `<h2>Section ${i}</h2><h3>Subsection ${i}</h3>`;
  }
  return html;
}

function imagesHtml(count: number): string {
  return Array(count)
    .fill(null)
    .map((_, i) => `<img src="img${i}.jpg" alt="Image ${i}">`)
    .join('');
}

describe('Checker Performance Benchmarks', () => {
  describe('MetaTagsChecker Performance', () => {
    bench('checkAll - optimal case', async () => {
      const mockPage = createMockPage({
        title: 'Perfect SEO Title Length Here For Testing',
        metaTags: {
          description:
            'This is an optimal meta description with perfect length between 120 and 160 characters for best SEO results.',
          viewport: 'width=device-width, initial-scale=1.0',
          canonical: 'https://example.com',
        },
        headHtml: `
          <meta property="og:title" content="Test">
          <meta property="og:description" content="Test">
          <meta property="og:image" content="https://example.com/test.jpg">
        `,
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      await checker.checkAll();
    });

    bench('checkAll - missing tags', async () => {
      const mockPage = createMockPage({
        title: 'Test',
        metaTags: {},
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      await checker.checkAll();
    });
  });

  describe('HeadingsChecker Performance', () => {
    bench('checkAll - small document', async () => {
      const mockPage = createMockPage({ html: headingsHtml(2) }) as Page;

      const checker = new HeadingsChecker(mockPage);
      await checker.checkAll();
    });

    bench('checkAll - large document', async () => {
      const mockPage = createMockPage({ html: headingsHtml(50) }) as Page;

      const checker = new HeadingsChecker(mockPage);
      await checker.checkAll();
    });
  });

  describe('ImagesChecker Performance', () => {
    bench('checkAll - few images', async () => {
      const mockPage = createMockPage({ html: imagesHtml(2) }) as Page;

      const checker = new ImagesChecker(mockPage);
      await checker.checkAll();
    });

    bench('checkAll - many images', async () => {
      const mockPage = createMockPage({ html: imagesHtml(100) }) as Page;

      const checker = new ImagesChecker(mockPage);
      await checker.checkAll();
    });
  });

  describe('ContentChecker Performance', () => {
    bench('checkAll - short content', async () => {
      const mockPage = createMockPage({ html: `<p>${'word '.repeat(100)}</p>` }) as Page;

      const checker = new ContentChecker(mockPage);
      await checker.checkAll();
    });

    bench('checkAll - long content', async () => {
      const mockPage = createMockPage({ html: `<p>${'word '.repeat(5000)}</p>` }) as Page;

      const checker = new ContentChecker(mockPage);
      await checker.checkAll();
    });
  });

  describe('Parallel Checker Execution', () => {
    bench('run multiple checkers sequentially', async () => {
      const mockPage = createMockPage({
        title: 'Test Page',
        metaTags: { description: 'Test description' },
        html: `<h1>Title</h1><p>${'word '.repeat(500)}</p>`,
      }) as Page;

      const metaChecker = new MetaTagsChecker(mockPage);
      const headingsChecker = new HeadingsChecker(mockPage);
      const contentChecker = new ContentChecker(mockPage);

      await metaChecker.checkAll();
      await headingsChecker.checkAll();
      await contentChecker.checkAll();
    });

    bench('run multiple checkers in parallel', async () => {
      const mockPage = createMockPage({
        title: 'Test Page',
        metaTags: { description: 'Test description' },
        html: `<h1>Title</h1><p>${'word '.repeat(500)}</p>`,
      }) as Page;

      const metaChecker = new MetaTagsChecker(mockPage);
      const headingsChecker = new HeadingsChecker(mockPage);
      const contentChecker = new ContentChecker(mockPage);

      await Promise.all([
        metaChecker.checkAll(),
        headingsChecker.checkAll(),
        contentChecker.checkAll(),
      ]);
    });
  });
});
