import { describe, it, expect } from 'vitest';
import { ImagesChecker } from '../../src/checkers/images';
import { createMockPage } from '../mocks/mockPage';
import { Page } from 'playwright';

function imgTags(count: number, withAlt: boolean): string {
  return Array(count)
    .fill(null)
    .map((_, i) => `<img src="image${i}.jpg"${withAlt ? ` alt="Image ${i}"` : ''}>`)
    .join('');
}

describe('ImagesChecker', () => {
  describe('checkAltTags', () => {
    it('should pass when all images have alt text', async () => {
      const mockPage = createMockPage({
        html: '<img src="image1.jpg" alt="Description 1"><img src="image2.jpg" alt="Description 2">',
      }) as Page;

      const checker = new ImagesChecker(mockPage);
      const results = await checker.checkAll();
      const altResult = results[0];

      expect(altResult.passed).toBe(true);
      expect(altResult.message).toContain('All');
      expect(altResult.message).toContain('have alt text');
    });

    it('should fail when some images are missing alt text', async () => {
      const mockPage = createMockPage({
        html: '<img src="image1.jpg" alt="Description 1"><img src="image2.jpg"><img src="image3.jpg">',
      }) as Page;

      const checker = new ImagesChecker(mockPage);
      const results = await checker.checkAll();
      const altResult = results[0];

      expect(altResult.passed).toBe(false);
      expect(altResult.message).toContain('missing alt text');
    });

    it('should fail when all images are missing alt text', async () => {
      const mockPage = createMockPage({
        html: '<img src="image1.jpg"><img src="image2.jpg">',
      }) as Page;

      const checker = new ImagesChecker(mockPage);
      const results = await checker.checkAll();
      const altResult = results[0];

      expect(altResult.passed).toBe(false);
      expect(altResult.message).toContain('All');
      expect(altResult.message).toContain('missing');
    });
  });

  describe('checkImageCount', () => {
    it('should pass when no images are present', async () => {
      const mockPage = createMockPage({ html: '<p>No images here.</p>' }) as Page;

      const checker = new ImagesChecker(mockPage);
      const results = await checker.checkAll();
      const countResult = results[1];

      expect(countResult.passed).toBe(true);
      expect(countResult.message).toContain('No images');
    });

    it('should pass with reasonable image count', async () => {
      const mockPage = createMockPage({ html: imgTags(20, true) }) as Page;

      const checker = new ImagesChecker(mockPage);
      const results = await checker.checkAll();
      const countResult = results[1];

      expect(countResult.passed).toBe(true);
      expect(countResult.message).toContain('reasonable');
    });

    it('should fail with too many images', async () => {
      const mockPage = createMockPage({ html: imgTags(60, true) }) as Page;

      const checker = new ImagesChecker(mockPage);
      const results = await checker.checkAll();
      const countResult = results[1];

      expect(countResult.passed).toBe(false);
      expect(countResult.message).toContain('High number');
    });
  });

  describe('checkAll', () => {
    it('should return all image check results', async () => {
      const mockPage = createMockPage({
        html: '<img src="image1.jpg" alt="Description 1">',
      }) as Page;

      const checker = new ImagesChecker(mockPage);
      const results = await checker.checkAll();

      expect(results).toHaveLength(2);
      expect(results.every((r) => 'passed' in r && 'message' in r)).toBe(true);
    });
  });
});
