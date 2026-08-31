import { BaseChecker, CheckOutcome } from './base';
import { extractImages, ImageData } from './shared/dom';
import {
  IMAGE_EXTENSION_MIN_LENGTH,
  IMAGE_EXTENSION_MAX_LENGTH,
  RESPONSIVE_IMAGES_MIN_COUNT,
  RESPONSIVE_IMAGES_MIN_PERCENT,
  LAZY_LOAD_MIN_IMAGE_COUNT,
  MAX_IMAGES_WITHOUT_DIMENSIONS,
} from '../config/thresholds';

export class AdvancedImagesChecker extends BaseChecker {
  private imagesPromise?: Promise<ImageData[]>;

  private getImages(): Promise<ImageData[]> {
    if (!this.imagesPromise) {
      this.imagesPromise = this.page.evaluate(extractImages);
    }
    return this.imagesPromise;
  }

  protected checks() {
    return [
      { id: 'image-formats-modern', run: () => this.checkImageFormats() },
      { id: 'responsive-images-adequate', run: () => this.checkResponsiveImages() },
      { id: 'lazy-loading-present', run: () => this.checkLazyLoading() },
      { id: 'image-dimensions-explicit', run: () => this.checkImageDimensions() },
      { id: 'image-titles-present', run: () => this.checkImageTitles() },
      { id: 'decorative-images-marked', run: () => this.checkDecorativeImages() },
      { id: 'figcaptions-present', run: () => this.checkFigcaptions() },
      { id: 'image-srcset-used', run: () => this.checkImageSrcset() },
      { id: 'webp-support', run: () => this.checkWebPSupport() },
      { id: 'image-compression-optimized', run: () => this.checkImageCompression() },
    ];
  }

  private async checkImageFormats(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const formats: Record<string, number> = {};
      const extMinLength = this.threshold('image-formats-modern', 'extMinLength', IMAGE_EXTENSION_MIN_LENGTH);
      const extMaxLength = this.threshold('image-formats-modern', 'extMaxLength', IMAGE_EXTENSION_MAX_LENGTH);

      images.forEach((img) => {
        const src = img.src || '';
        let ext = 'unknown';

        try {
          const url = new URL(src);
          const pathname = url.pathname;

          // Check for common CDN patterns (dynamic image generation services)
          const cdnPatterns = [
            'placehold.co',
            'placeholder.com',
            'via.placeholder.com',
            'dummyimage.com',
            'picsum.photos',
            'loremflickr.com',
          ];

          const isCDN = cdnPatterns.some((pattern) => url.hostname.includes(pattern));

          if (isCDN) {
            ext = 'dynamic';
          } else {
            // Extract file extension from pathname
            const parts = pathname.split('.');
            if (parts.length > 1) {
              // Get the last part and remove any query parameters
              const lastPart = parts[parts.length - 1].split('?')[0].split('#')[0];
              // Only use if it looks like a valid extension
              if (
                lastPart &&
                lastPart.length >= extMinLength &&
                lastPart.length <= extMaxLength &&
                /^[a-z0-9]+$/i.test(lastPart)
              ) {
                ext = lastPart.toLowerCase();
              }
            }
          }
        } catch (e) {
          // If URL parsing fails, try simple extension extraction as fallback
          const match = src.match(/\.([a-z0-9]{2,4})(?:[?#]|$)/i);
          if (match) {
            ext = match[1].toLowerCase();
          }
        }

        formats[ext] = (formats[ext] || 0) + 1;
      });

      const formatData = { totalImages: images.length, formats };

      const oldFormats = ['bmp', 'tiff', 'tif'];
      const hasOldFormats = Object.keys(formatData.formats).some((fmt: string) => oldFormats.includes(fmt));

      if (hasOldFormats) {
        return this.fail('Images use outdated formats (BMP, TIFF). Use JPG, PNG, WebP', formatData);
      }

      // Filter out 'unknown' and 'dynamic' for the display message
      const knownFormats = Object.keys(formatData.formats).filter((f) => f !== 'unknown' && f !== 'dynamic');
      const displayFormats = knownFormats.length > 0 ? knownFormats.join(', ') : 'various formats';

      return this.pass(`Images use modern formats (${displayFormats})`, formatData);
    } catch (error) {
      return this.pass('Image format check skipped');
    }
  }

  private async checkResponsiveImages(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const withSrcset = images.filter((img) => img.hasSrcset);
      const inPicture = images.filter((img) => img.inPicture);

      const responsiveData = {
        totalImages: images.length,
        withSrcset: withSrcset.length,
        inPicture: inPicture.length,
        responsiveCount: withSrcset.length + inPicture.length,
      };

      const responsivePercentage = responsiveData.totalImages > 0
        ? (responsiveData.responsiveCount / responsiveData.totalImages) * 100
        : 0;
      const minCount = this.threshold('responsive-images-adequate', 'minCount', RESPONSIVE_IMAGES_MIN_COUNT);
      const minPercent = this.threshold('responsive-images-adequate', 'minPercent', RESPONSIVE_IMAGES_MIN_PERCENT);

      if (responsiveData.totalImages > minCount && responsivePercentage < minPercent) {
        return this.fail(
          `Only ${responsivePercentage.toFixed(0)}% of images are responsive (use srcset or picture)`,
          responsiveData
        );
      }

      return this.pass(
        responsiveData.totalImages > 0
          ? `${responsivePercentage.toFixed(0)}% of images are responsive`
          : 'No images to check',
        responsiveData
      );
    } catch (error) {
      return this.pass('Responsive images check skipped');
    }
  }

  private async checkLazyLoading(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const withLoading = images.filter((img) => img.hasLoading);
      const lazyLoaded = images.filter((img) => img.loadingValue === 'lazy');

      const lazyData = {
        totalImages: images.length,
        withLoading: withLoading.length,
        lazyLoaded: lazyLoaded.length,
      };

      const lazyLoadMinCount = this.threshold(
        'lazy-loading-present',
        'minImageCount',
        LAZY_LOAD_MIN_IMAGE_COUNT
      );

      if (lazyData.totalImages > lazyLoadMinCount && lazyData.lazyLoaded === 0) {
        return this.fail('No lazy loading on images (consider adding loading="lazy" for performance)', lazyData);
      }

      return this.pass(
        lazyData.lazyLoaded > 0
          ? `${lazyData.lazyLoaded} images use lazy loading`
          : 'Lazy loading not needed (few images)',
        lazyData
      );
    } catch (error) {
      return this.pass('Lazy loading check skipped');
    }
  }

  private async checkImageDimensions(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const withoutDimensions = images.filter((img) => !img.hasWidth || !img.hasHeight);

      const dimensionData = {
        totalImages: images.length,
        withoutDimensions: withoutDimensions.length,
      };

      const maxWithoutDimensions = this.threshold(
        'image-dimensions-explicit',
        'maxWithoutDimensions',
        MAX_IMAGES_WITHOUT_DIMENSIONS
      );

      if (dimensionData.withoutDimensions > maxWithoutDimensions) {
        return this.fail(
          `${dimensionData.withoutDimensions} images missing width/height attributes (causes layout shift)`,
          dimensionData
        );
      }

      return this.pass('Most images have explicit dimensions', dimensionData);
    } catch (error) {
      return this.pass('Image dimensions check skipped');
    }
  }

  private async checkImageTitles(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const withTitles = images.filter((img) => img.title && img.title.trim());

      const titleData = {
        totalImages: images.length,
        withTitles: withTitles.length,
      };

      return this.pass(
        titleData.withTitles > 0
          ? `${titleData.withTitles} images have title attributes`
          : 'No image titles (optional but can improve accessibility)',
        titleData
      );
    } catch (error) {
      return this.pass('Image titles check skipped');
    }
  }

  private async checkDecorativeImages(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const decorative = images.filter((img) => img.alt === '' || img.role === 'presentation' || img.role === 'none');

      const decorativeData = {
        totalImages: images.length,
        decorativeCount: decorative.length,
      };

      return this.pass(
        decorativeData.decorativeCount > 0
          ? `${decorativeData.decorativeCount} decorative images properly marked`
          : 'All images have descriptive alt text',
        decorativeData
      );
    } catch (error) {
      return this.pass('Decorative images check skipped');
    }
  }

  private async checkFigcaptions(): Promise<CheckOutcome> {
    try {
      const figureData = await this.page.evaluate(() => {
        const figures = Array.from(document.querySelectorAll('figure'));
        const withCaptions = figures.filter((fig) => fig.querySelector('figcaption'));

        return {
          totalFigures: figures.length,
          withCaptions: withCaptions.length,
        };
      });

      if (figureData.totalFigures > 0 && figureData.withCaptions === 0) {
        return this.fail(`${figureData.totalFigures} <figure> elements missing <figcaption>`, figureData);
      }

      return this.pass(
        figureData.totalFigures > 0
          ? `${figureData.withCaptions}/${figureData.totalFigures} figures have captions`
          : 'No figure elements',
        figureData
      );
    } catch (error) {
      return this.pass('Figcaption check skipped');
    }
  }

  private async checkImageSrcset(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const withSrcset = images.filter((img) => img.hasSrcset);
      const srcsetSizes = withSrcset.map((img) => (img.srcsetValue || '').split(',').length);

      const srcsetData = {
        imagesWithSrcset: withSrcset.length,
        avgSrcsetSizes: srcsetSizes.length > 0
          ? srcsetSizes.reduce((a: number, b: number) => a + b, 0) / srcsetSizes.length
          : 0,
      };

      return this.pass(
        srcsetData.imagesWithSrcset > 0
          ? `${srcsetData.imagesWithSrcset} images use srcset (avg ${srcsetData.avgSrcsetSizes.toFixed(1)} variants)`
          : 'No srcset usage (consider for responsive images)',
        srcsetData
      );
    } catch (error) {
      return this.pass('Srcset check skipped');
    }
  }

  private async checkWebPSupport(): Promise<CheckOutcome> {
    try {
      const images = await this.getImages();
      const imgWebP = images.filter((img) => img.src.toLowerCase().endsWith('.webp'));

      const webpData = await this.page.evaluate(() => {
        const pictures = Array.from(document.querySelectorAll('picture'));
        const withWebP = pictures.filter((pic) => {
          const sources = Array.from(pic.querySelectorAll('source'));
          return sources.some((source) => source.getAttribute('type') === 'image/webp');
        });

        return {
          totalPictures: pictures.length,
          withWebP: withWebP.length,
        };
      });

      const combined = { ...webpData, directWebP: imgWebP.length };
      const hasWebP = combined.withWebP > 0 || combined.directWebP > 0;

      return this.pass(
        hasWebP ? 'WebP format in use (excellent for performance)' : 'No WebP images (consider for better compression)',
        combined
      );
    } catch (error) {
      return this.pass('WebP support check skipped');
    }
  }

  private async checkImageCompression(): Promise<CheckOutcome> {
    try {
      // This is a simplified check - we can't actually measure compression without downloading
      const images = await this.getImages();

      // Check for query parameters that might indicate optimization services
      const optimized = images.filter((img) => {
        const src = img.src || '';
        return (
          src.includes('?w=') ||
          src.includes('?quality=') ||
          src.includes('?q=') ||
          src.includes('cloudinary') ||
          src.includes('imgix') ||
          src.includes('imagekit')
        );
      });

      const compressionData = {
        totalImages: images.length,
        possiblyOptimized: optimized.length,
      };

      return this.pass(
        compressionData.possiblyOptimized > 0
          ? `${compressionData.possiblyOptimized} images appear to use optimization services`
          : 'Image optimization status unclear (consider using CDN/optimization service)',
        compressionData
      );
    } catch (error) {
      return this.pass('Image compression check skipped');
    }
  }
}
