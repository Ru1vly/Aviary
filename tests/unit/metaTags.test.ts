import { describe, it, expect } from 'vitest';
import { MetaTagsChecker } from '../../src/checkers/metaTags';
import { createMockPage } from '../mocks/mockPage';
import { Page } from 'playwright';

describe('MetaTagsChecker', () => {
  describe('checkTitle', () => {
    it('should pass with optimal title length', async () => {
      const mockPage = createMockPage({
        title: 'This is an optimal SEO title here',
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const titleResult = results[0];

      expect(titleResult.passed).toBe(true);
      expect(titleResult.message).toContain('optimal');
    });

    it('should fail when title is missing', async () => {
      const mockPage = createMockPage({ title: '' }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const titleResult = results[0];

      expect(titleResult.passed).toBe(false);
      expect(titleResult.message).toContain('missing');
    });

    it('should fail when title is too short', async () => {
      const mockPage = createMockPage({ title: 'Short' }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const titleResult = results[0];

      expect(titleResult.passed).toBe(false);
      expect(titleResult.message).toContain('too short');
    });

    it('should fail when title is too long', async () => {
      const mockPage = createMockPage({
        title: 'This is a very long title that exceeds the recommended sixty character limit for SEO optimization',
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const titleResult = results[0];

      expect(titleResult.passed).toBe(false);
      expect(titleResult.message).toContain('too long');
    });
  });

  describe('checkMetaDescription', () => {
    it('should pass with optimal meta description', async () => {
      const mockPage = createMockPage({
        metaTags: {
          description: 'This is an optimal meta description that is between 120 and 160 characters long, providing enough detail for search engines.',
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const descResult = results[1];

      expect(descResult.passed).toBe(true);
      expect(descResult.message).toContain('optimal');
    });

    it('should fail when meta description is missing', async () => {
      const mockPage = createMockPage({
        metaTags: {},
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const descResult = results[1];

      expect(descResult.passed).toBe(false);
      expect(descResult.message).toContain('missing');
    });

    it('should fail when meta description is too short', async () => {
      const mockPage = createMockPage({
        metaTags: {
          description: 'Too short',
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const descResult = results[1];

      expect(descResult.passed).toBe(false);
      expect(descResult.message).toContain('too short');
    });

    it('should fail when meta description is too long', async () => {
      const mockPage = createMockPage({
        metaTags: {
          description: 'This is an extremely long meta description that far exceeds the recommended 160 character limit for optimal search engine results display and user experience and marketing purposes and goals.',
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const descResult = results[1];

      expect(descResult.passed).toBe(false);
      expect(descResult.message).toContain('too long');
    });
  });

  describe('checkMetaKeywords', () => {
    it('should pass even when keywords are missing', async () => {
      const mockPage = createMockPage({
        metaTags: {},
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const keywordsResult = results[2];

      expect(keywordsResult.passed).toBe(true);
      expect(keywordsResult.message).toContain('not critical');
    });

    it('should pass when keywords are present', async () => {
      const mockPage = createMockPage({
        metaTags: {
          keywords: 'seo, testing, web',
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const keywordsResult = results[2];

      expect(keywordsResult.passed).toBe(true);
    });
  });

  describe('checkOpenGraphTags', () => {
    it('should pass when all essential OG tags are present and valid', async () => {
      const mockPage = createMockPage({
        evaluateResults: {
          'og:': [
            { property: 'og:title', content: 'Test Title' },
            { property: 'og:description', content: 'Test Description' },
            { property: 'og:image', content: 'https://example.com/image.jpg' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://example.com/page' },
          ],
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const ogResult = results[3];

      expect(ogResult.passed).toBe(true);
      expect(ogResult.message).toContain('properly configured');
    });

    it('should fail when essential OG tags are missing', async () => {
      const mockPage = createMockPage({
        evaluateResults: {
          'og:': [{ property: 'og:title', content: 'Test Title' }],
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const ogResult = results[3];

      expect(ogResult.passed).toBe(false);
      expect(ogResult.message).toContain('Missing essential');
    });

    it('should fail when og:image is a relative URL', async () => {
      const mockPage = createMockPage({
        evaluateResults: {
          'og:': [
            { property: 'og:title', content: 'Test Title' },
            { property: 'og:description', content: 'Test Description' },
            { property: 'og:image', content: '/images/photo.jpg' }, // relative!
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://example.com/page' },
          ],
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const ogResult = results[3];

      expect(ogResult.passed).toBe(false);
      expect(ogResult.message).toContain('absolute URL');
    });
  });

  describe('checkCanonicalUrl', () => {
    it('should pass when canonical URL is present', async () => {
      const mockPage = createMockPage({
        metaTags: {
          canonical: 'https://example.com/page',
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const canonicalResult = results[4];

      expect(canonicalResult.passed).toBe(true);
      expect(canonicalResult.message).toContain('present');
    });

    it('should fail when canonical URL is missing', async () => {
      const mockPage = createMockPage({
        metaTags: {},
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const canonicalResult = results[4];

      expect(canonicalResult.passed).toBe(false);
      expect(canonicalResult.message).toContain('missing');
    });
  });

  describe('checkViewport', () => {
    it('should pass when viewport meta tag is present', async () => {
      const mockPage = createMockPage({
        metaTags: {
          viewport: 'width=device-width, initial-scale=1.0',
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const viewportResult = results[5];

      expect(viewportResult.passed).toBe(true);
      expect(viewportResult.message).toContain('present');
    });

    it('should fail when viewport meta tag is missing', async () => {
      const mockPage = createMockPage({
        metaTags: {},
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();
      const viewportResult = results[5];

      expect(viewportResult.passed).toBe(false);
      expect(viewportResult.message).toContain('missing');
    });
  });

  describe('checkAll', () => {
    it('should return all check results', async () => {
      const mockPage = createMockPage({
        title: 'This is an optimal SEO title here',
        metaTags: {
          description: 'This is an optimal meta description that is between 120 and 160 characters long, providing enough detail for search engines.',
          viewport: 'width=device-width, initial-scale=1.0',
        },
      }) as Page;

      const checker = new MetaTagsChecker(mockPage);
      const results = await checker.checkAll();

      expect(results).toHaveLength(6);
      expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
    });
  });
});
