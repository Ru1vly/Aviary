import { ImageInfo } from '../types';
import { BaseChecker, CheckOutcome } from './base';

export class ImagesChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'images-have-alt', run: () => this.checkAltTags() },
      { id: 'image-count-reasonable', run: () => this.checkImageCount() },
    ];
  }

  private imagesPromise?: Promise<ImageInfo[]>;

  private getImages(): Promise<ImageInfo[]> {
    if (!this.imagesPromise) {
      this.imagesPromise = this.page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.map((img) => ({
          src: img.src,
          alt: img.alt || null,
          hasAlt: img.hasAttribute('alt') && img.alt.trim().length > 0,
        }));
      });
    }
    return this.imagesPromise;
  }

  private async checkAltTags(): Promise<CheckOutcome> {
    const images = await this.getImages();
    const missingAlt = images.filter((img) => !img.hasAlt);

    if (missingAlt.length === 0) {
      return this.pass(`All ${images.length} images have alt text`, { totalImages: images.length });
    }

    if (missingAlt.length === images.length) {
      return this.fail(`All ${images.length} images are missing alt text`, { missingAlt });
    }

    return this.fail(`${missingAlt.length} out of ${images.length} images are missing alt text`, {
      missingAlt,
      totalImages: images.length,
    });
  }

  private async checkImageCount(): Promise<CheckOutcome> {
    const images = await this.getImages();

    if (images.length === 0) {
      return this.pass('No images found on the page');
    }

    if (images.length > 50) {
      return this.fail(`High number of images (${images.length}). Consider optimization for performance`, {
        imageCount: images.length,
      });
    }

    return this.pass(`Image count is reasonable (${images.length})`, { imageCount: images.length });
  }
}
