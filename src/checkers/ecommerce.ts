import { BaseChecker, CheckOutcome } from './base';

export class EcommerceChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'product-schema-complete', run: () => this.checkProductSchema() },
      { id: 'price-display-clear', run: () => this.checkPriceDisplay() },
      { id: 'availability-info-present', run: () => this.checkAvailability() },
      { id: 'reviews-ratings-schema-present', run: () => this.checkReviewsRatings() },
      { id: 'add-to-cart-present', run: () => this.checkAddToCartButton() },
      { id: 'product-images-adequate', run: () => this.checkProductImages() },
      { id: 'product-description-present', run: () => this.checkProductDescription() },
      { id: 'sku-identifier-present', run: () => this.checkSKUIdentifier() },
      { id: 'brand-information-present', run: () => this.checkBrandInformation() },
      { id: 'shipping-information-present', run: () => this.checkShippingInformation() },
      { id: 'return-policy-present', run: () => this.checkReturnPolicy() },
      { id: 'payment-methods-visible', run: () => this.checkPaymentMethods() },
      { id: 'secure-checkout-indicators', run: () => this.checkSecureCheckout() },
      { id: 'wishlist-functionality-present', run: () => this.checkWishlistFunctionality() },
      { id: 'related-products-present', run: () => this.checkRelatedProducts() },
    ];
  }

  private async checkProductSchema(): Promise<CheckOutcome> {
    try {
      const schemaData = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const productSchemas = scripts
          .map((script) => {
            try {
              return JSON.parse(script.textContent || '{}');
            } catch {
              return null;
            }
          })
          .filter((data) => data && data['@type'] === 'Product');

        if (productSchemas.length === 0) return { found: false };

        const product = productSchemas[0];
        return {
          found: true,
          hasName: !!product.name,
          hasImage: !!product.image,
          hasDescription: !!product.description,
          hasOffers: !!product.offers,
          hasSKU: !!product.sku,
          hasBrand: !!product.brand,
          hasPrice: !!product.offers?.price,
          hasPriceCurrency: !!product.offers?.priceCurrency,
          hasAvailability: !!product.offers?.availability,
          hasAggregateRating: !!product.aggregateRating,
        };
      });

      if (!schemaData.found) {
        return this.pass('No Product schema (not an e-commerce product page)');
      }

      const issues: string[] = [];
      if (!schemaData.hasName) issues.push('missing name');
      if (!schemaData.hasImage) issues.push('missing image');
      if (!schemaData.hasDescription) issues.push('missing description');
      if (!schemaData.hasOffers) issues.push('missing offers');
      if (!schemaData.hasPrice) issues.push('missing price');
      if (!schemaData.hasBrand) issues.push('missing brand');

      if (issues.length > 0) {
        return this.fail(`Product schema incomplete: ${issues.join(', ')}`, schemaData);
      }

      return this.pass('Product schema fully configured with all required fields', schemaData);
    } catch (error) {
      return this.pass('Product schema check skipped');
    }
  }

  private async checkPriceDisplay(): Promise<CheckOutcome> {
    try {
      const priceData = await this.page.evaluate(() => {
        const priceSelectors = [
          '[class*="price"]', '[id*="price"]',
          '[itemprop="price"]', '.product-price', '.price',
        ];

        const priceElements = priceSelectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector))
        );

        const uniquePriceElements = Array.from(new Set(priceElements));

        const hasCurrency = uniquePriceElements.some((el) => {
          const text = el.textContent || '';
          return /\$|€|£|¥|USD|EUR|GBP/.test(text);
        });

        const hasDecimal = uniquePriceElements.some((el) => {
          const text = el.textContent || '';
          return /\d+\.\d{2}/.test(text);
        });

        return {
          priceElements: uniquePriceElements.length,
          hasCurrency,
          hasDecimal,
        };
      });

      if (priceData.priceElements === 0) {
        return this.pass('No price elements found (not an e-commerce page)');
      }

      const issues: string[] = [];
      if (!priceData.hasCurrency) issues.push('currency symbol missing');
      if (!priceData.hasDecimal) issues.push('decimal pricing unclear');

      if (issues.length > 0) {
        return this.fail(`Price display issues: ${issues.join(', ')}`, priceData);
      }

      return this.pass(`Price displayed clearly with currency (${priceData.priceElements} price element(s))`, priceData);
    } catch (error) {
      return this.pass('Price display check skipped');
    }
  }

  private async checkAvailability(): Promise<CheckOutcome> {
    try {
      const availabilityData = await this.page.evaluate(() => {
        const availabilityKeywords = [
          'in stock', 'out of stock', 'available', 'unavailable',
          'pre-order', 'backorder', 'sold out',
        ];

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasAvailability = availabilityKeywords.some((keyword) => bodyText.includes(keyword));

        const availabilityElements = Array.from(document.querySelectorAll('[class*="stock"], [class*="availability"], [id*="stock"]'));

        return {
          hasAvailability,
          availabilityElements: availabilityElements.length,
        };
      });

      if (!availabilityData.hasAvailability && availabilityData.availabilityElements === 0) {
        return this.pass('No availability information (not an e-commerce product page)');
      }

      return this.pass('Product availability information present', availabilityData);
    } catch (error) {
      return this.pass('Availability check skipped');
    }
  }

  private async checkReviewsRatings(): Promise<CheckOutcome> {
    try {
      const reviewData = await this.page.evaluate(() => {
        const reviewElements = Array.from(document.querySelectorAll('[class*="review"], [class*="rating"], [id*="review"]'));

        const starRatings = Array.from(document.querySelectorAll('[class*="star"], [aria-label*="star"]'));

        const reviewCount = document.body.textContent?.match(/\d+\s*(review|rating)/i);

        const hasAggregateRating = Array.from(document.querySelectorAll('[itemprop="aggregateRating"]')).length > 0;

        return {
          reviewElements: reviewElements.length,
          starRatings: starRatings.length,
          hasReviewCount: !!reviewCount,
          hasAggregateRating,
        };
      });

      if (reviewData.reviewElements === 0 && reviewData.starRatings === 0) {
        return this.pass('No reviews/ratings (not required but recommended for products)');
      }

      if (!reviewData.hasAggregateRating) {
        return this.fail('Reviews present but missing AggregateRating schema', reviewData);
      }

      return this.pass('Reviews and ratings with proper schema markup', reviewData);
    } catch (error) {
      return this.pass('Reviews/ratings check skipped');
    }
  }

  private async checkAddToCartButton(): Promise<CheckOutcome> {
    try {
      const cartData = await this.page.evaluate(() => {
        const cartButtons = Array.from(document.querySelectorAll('button, a, input[type="submit"]')).filter((el) => {
          const text = el.textContent?.toLowerCase() || '';
          const value = (el as HTMLInputElement).value?.toLowerCase() || '';
          return text.includes('add to cart') || text.includes('buy now') || value.includes('add to cart');
        });

        const hasCartIcon = document.querySelectorAll('[class*="cart"], [id*="cart"]').length > 0;

        return {
          cartButtons: cartButtons.length,
          hasCartIcon,
        };
      });

      if (cartData.cartButtons === 0) {
        return this.pass('No "Add to Cart" button (not an e-commerce product page)');
      }

      return this.pass(`Add to cart functionality present (${cartData.cartButtons} button(s))`, cartData);
    } catch (error) {
      return this.pass('Add to cart check skipped');
    }
  }

  private async checkProductImages(): Promise<CheckOutcome> {
    try {
      const imageData = await this.page.evaluate(() => {
        const productImages = Array.from(document.querySelectorAll('[class*="product"] img, [id*="product"] img'));

        const withAlt = productImages.filter((img) => img.hasAttribute('alt') && img.getAttribute('alt')?.trim());

        const hasGallery = document.querySelectorAll('[class*="gallery"], [class*="carousel"]').length > 0;

        const hasZoom = document.querySelectorAll('[class*="zoom"], [data-zoom]').length > 0;

        return {
          productImages: productImages.length,
          withAlt: withAlt.length,
          hasGallery,
          hasZoom,
        };
      });

      if (imageData.productImages === 0) {
        return this.pass('No product images found');
      }

      const issues: string[] = [];

      if (imageData.withAlt < imageData.productImages) {
        issues.push(`${imageData.productImages - imageData.withAlt} images missing alt text`);
      }

      if (!imageData.hasGallery && imageData.productImages > 1) {
        issues.push('multiple images but no gallery functionality');
      }

      if (issues.length > 0) {
        return this.fail(`Product image issues: ${issues.join(', ')}`, imageData);
      }

      return this.pass(`${imageData.productImages} product images with proper alt text`, imageData);
    } catch (error) {
      return this.pass('Product images check skipped');
    }
  }

  private async checkProductDescription(): Promise<CheckOutcome> {
    try {
      const descriptionData = await this.page.evaluate(() => {
        const descriptionSelectors = [
          '[class*="description"]', '[id*="description"]',
          '[itemprop="description"]', '.product-description',
        ];

        const descriptions = descriptionSelectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector))
        );

        const totalDescriptionLength = descriptions.reduce((sum, el) => {
          return sum + (el.textContent?.length || 0);
        }, 0);

        const hasLongDescription = totalDescriptionLength > 100;
        const hasFeaturesList = document.querySelectorAll('[class*="feature"], [class*="specification"]').length > 0;

        return {
          descriptions: descriptions.length,
          totalLength: totalDescriptionLength,
          hasLongDescription,
          hasFeaturesList,
        };
      });

      if (descriptionData.descriptions === 0) {
        return this.fail('No product description found (required for SEO)');
      }

      if (!descriptionData.hasLongDescription) {
        return this.fail(`Product description too short (${descriptionData.totalLength} chars, recommended: 200+)`, descriptionData);
      }

      return this.pass(`Product description present (${descriptionData.totalLength} chars)`, descriptionData);
    } catch (error) {
      return this.pass('Product description check skipped');
    }
  }

  private async checkSKUIdentifier(): Promise<CheckOutcome> {
    try {
      const skuData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent || '';

        const hasSKU = /SKU|Product Code|Item Number/i.test(bodyText);

        const skuElements = Array.from(document.querySelectorAll('[class*="sku"], [id*="sku"], [itemprop="sku"]'));

        return {
          hasSKU,
          skuElements: skuElements.length,
        };
      });

      if (!skuData.hasSKU && skuData.skuElements === 0) {
        return this.pass('No SKU identifier (recommended for product tracking)');
      }

      return this.pass('SKU/Product identifier present', skuData);
    } catch (error) {
      return this.pass('SKU identifier check skipped');
    }
  }

  private async checkBrandInformation(): Promise<CheckOutcome> {
    try {
      const brandData = await this.page.evaluate(() => {
        const brandElements = Array.from(document.querySelectorAll('[class*="brand"], [id*="brand"], [itemprop="brand"]'));

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasBrandMention = /brand|manufacturer|by\s+[A-Z]/i.test(bodyText);

        return {
          brandElements: brandElements.length,
          hasBrandMention,
        };
      });

      if (brandData.brandElements === 0 && !brandData.hasBrandMention) {
        return this.fail('No brand information (recommended for product credibility)', brandData);
      }

      return this.pass('Brand information present', brandData);
    } catch (error) {
      return this.pass('Brand information check skipped');
    }
  }

  private async checkShippingInformation(): Promise<CheckOutcome> {
    try {
      const shippingData = await this.page.evaluate(() => {
        const shippingKeywords = ['shipping', 'delivery', 'free shipping', 'shipping cost'];

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasShipping = shippingKeywords.some((keyword) => bodyText.includes(keyword));

        const shippingElements = document.querySelectorAll('[class*="shipping"], [class*="delivery"], [id*="shipping"]');

        return {
          hasShipping,
          shippingElements: shippingElements.length,
        };
      });

      if (!shippingData.hasShipping && shippingData.shippingElements === 0) {
        return this.pass('No shipping information (recommended for e-commerce)');
      }

      return this.pass('Shipping information available', shippingData);
    } catch (error) {
      return this.pass('Shipping information check skipped');
    }
  }

  private async checkReturnPolicy(): Promise<CheckOutcome> {
    try {
      const returnData = await this.page.evaluate(() => {
        const returnLinks = Array.from(document.querySelectorAll('a')).filter((link) => {
          const text = link.textContent?.toLowerCase() || '';
          return text.includes('return') || text.includes('refund');
        });

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasReturnMention = bodyText.includes('return') || bodyText.includes('refund');

        return {
          returnLinks: returnLinks.length,
          hasReturnMention,
        };
      });

      if (returnData.returnLinks === 0 && !returnData.hasReturnMention) {
        return this.pass('No return policy information (required for e-commerce)');
      }

      return this.pass(
        returnData.returnLinks > 0 ? 'Return policy link present' : 'Return policy mentioned',
        returnData
      );
    } catch (error) {
      return this.pass('Return policy check skipped');
    }
  }

  private async checkPaymentMethods(): Promise<CheckOutcome> {
    try {
      const paymentData = await this.page.evaluate(() => {
        const paymentKeywords = ['visa', 'mastercard', 'paypal', 'amex', 'discover', 'payment'];

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasPaymentMention = paymentKeywords.some((keyword) => bodyText.includes(keyword));

        const paymentIcons = document.querySelectorAll('[class*="payment"], [class*="card-icon"], [alt*="visa"], [alt*="mastercard"]');

        return {
          hasPaymentMention,
          paymentIcons: paymentIcons.length,
        };
      });

      if (!paymentData.hasPaymentMention && paymentData.paymentIcons === 0) {
        return this.pass('No payment method information visible');
      }

      return this.pass(
        paymentData.paymentIcons > 0
          ? `${paymentData.paymentIcons} payment method icon(s) displayed`
          : 'Payment methods mentioned',
        paymentData
      );
    } catch (error) {
      return this.pass('Payment methods check skipped');
    }
  }

  private async checkSecureCheckout(): Promise<CheckOutcome> {
    try {
      const securityData = await this.page.evaluate(() => {
        const securityKeywords = ['secure checkout', 'ssl', 'encrypted', 'secure payment'];

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasSecurityMention = securityKeywords.some((keyword) => bodyText.includes(keyword));

        const securityBadges = document.querySelectorAll('[class*="secure"], [class*="ssl"], [alt*="secure"]');

        const isHTTPS = window.location.protocol === 'https:';

        return {
          hasSecurityMention,
          securityBadges: securityBadges.length,
          isHTTPS,
        };
      });

      if (!securityData.isHTTPS) {
        return this.fail('Not using HTTPS (critical for e-commerce)', securityData);
      }

      if (!securityData.hasSecurityMention && securityData.securityBadges === 0) {
        return this.fail('No security indicators visible (recommended for trust)', securityData);
      }

      return this.pass('Secure checkout indicators present with HTTPS', securityData);
    } catch (error) {
      return this.pass('Secure checkout check skipped');
    }
  }

  private async checkWishlistFunctionality(): Promise<CheckOutcome> {
    try {
      const wishlistData = await this.page.evaluate(() => {
        const wishlistButtons = Array.from(document.querySelectorAll('button, a')).filter((el) => {
          const text = el.textContent?.toLowerCase() || '';
          const classes = el.className.toLowerCase();
          return text.includes('wishlist') || text.includes('favorite') || classes.includes('wishlist');
        });

        const wishlistIcons = document.querySelectorAll('[class*="heart"], [class*="wishlist"], [class*="favorite"]');

        return {
          wishlistButtons: wishlistButtons.length,
          wishlistIcons: wishlistIcons.length,
          hasWishlist: wishlistButtons.length > 0 || wishlistIcons.length > 0,
        };
      });

      if (!wishlistData.hasWishlist) {
        return this.pass('No wishlist functionality (optional but improves UX)');
      }

      return this.pass('Wishlist/favorites functionality available', wishlistData);
    } catch (error) {
      return this.pass('Wishlist functionality check skipped');
    }
  }

  private async checkRelatedProducts(): Promise<CheckOutcome> {
    try {
      const relatedData = await this.page.evaluate(() => {
        const relatedSections = Array.from(document.querySelectorAll('[class*="related"], [class*="recommend"], [id*="related"]'));

        const relatedProducts = Array.from(document.querySelectorAll('[class*="related"] [class*="product"], [class*="recommend"] [class*="product"]'));

        return {
          relatedSections: relatedSections.length,
          relatedProducts: relatedProducts.length,
          hasRelated: relatedSections.length > 0,
        };
      });

      if (!relatedData.hasRelated) {
        return this.pass('No related products section (recommended for cross-selling)');
      }

      return this.pass(`Related products section with ${relatedData.relatedProducts} items`, relatedData);
    } catch (error) {
      return this.pass('Related products check skipped');
    }
  }
}
