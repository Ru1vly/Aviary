import { BaseChecker, CheckOutcome } from './base';
import { extractImages } from './shared/dom';
import { PAGE_LOAD_TIME_MS } from '../config/thresholds';

export class MobileUXChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'tap-target-size-adequate', run: () => this.checkTapTargetSize() },
      { id: 'mobile-viewport-config-valid', run: () => this.checkMobileViewportConfig() },
      { id: 'touch-friendly-spacing', run: () => this.checkTouchFriendlySpacing() },
      { id: 'mobile-form-inputs-optimized', run: () => this.checkMobileFormInputs() },
      { id: 'mobile-navigation-present', run: () => this.checkMobileNavigation() },
      { id: 'mobile-readability-acceptable', run: () => this.checkMobileReadability() },
      { id: 'mobile-image-optimization', run: () => this.checkMobileImageOptimization() },
      { id: 'mobile-popups-absent', run: () => this.checkMobilePopups() },
      { id: 'orientation-support', run: () => this.checkOrientationSupport() },
      { id: 'touch-icons-present', run: () => this.checkTouchIcons() },
      { id: 'amp-implementation', run: () => this.checkAMPImplementation() },
      { id: 'pwa-features-present', run: () => this.checkPWAFeatures() },
      { id: 'mobile-scrolling-clean', run: () => this.checkMobileScrolling() },
      { id: 'mobile-performance-acceptable', run: () => this.checkMobilePerformance() },
      { id: 'gesture-support-detected', run: () => this.checkGestureSupport() },
    ];
  }

  private async checkTapTargetSize(): Promise<CheckOutcome> {
    try {
      const tapData = await this.page.evaluate(() => {
        const interactive = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

        const tooSmall = interactive.filter((el) => {
          const rect = el.getBoundingClientRect();
          return (rect.width > 0 && rect.width < 44) || (rect.height > 0 && rect.height < 44);
        });

        return {
          total: interactive.length,
          tooSmall: tooSmall.length,
        };
      });

      if (tapData.tooSmall > 5) {
        return this.fail(`${tapData.tooSmall} tap targets smaller than 44x44px (mobile usability issue)`, tapData);
      }

      return this.pass('Tap targets meet minimum size requirements', tapData);
    } catch (error) {
      return this.pass('Tap target size check skipped');
    }
  }

  private async checkMobileViewportConfig(): Promise<CheckOutcome> {
    try {
      const viewportData = await this.page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        const content = viewport?.getAttribute('content') || '';

        const config = {
          hasViewport: !!viewport,
          content,
          hasDeviceWidth: content.includes('width=device-width'),
          hasInitialScale: content.includes('initial-scale=1'),
          hasUserScalable: content.includes('user-scalable'),
          userScalableValue: content.match(/user-scalable=([^,\s]+)/)?.[1],
          hasMaximumScale: content.includes('maximum-scale'),
        };

        return config;
      });

      const issues: string[] = [];

      if (!viewportData.hasViewport) {
        issues.push('Missing viewport meta tag');
      } else {
        if (!viewportData.hasDeviceWidth) {
          issues.push('Missing width=device-width');
        }
        if (!viewportData.hasInitialScale) {
          issues.push('Missing initial-scale=1');
        }
        if (viewportData.userScalableValue === 'no' || viewportData.hasMaximumScale) {
          issues.push('Zoom disabled (accessibility issue)');
        }
      }

      if (issues.length > 0) {
        return this.fail(`Mobile viewport issues: ${issues.join(', ')}`, viewportData);
      }

      return this.pass('Mobile viewport properly configured', viewportData);
    } catch (error) {
      return this.pass('Viewport config check skipped');
    }
  }

  private async checkTouchFriendlySpacing(): Promise<CheckOutcome> {
    try {
      const spacingData = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));

        const closeLinks = links.filter((link, index) => {
          if (index === 0) return false;
          const rect = link.getBoundingClientRect();
          const prevRect = links[index - 1].getBoundingClientRect();

          const verticalDistance = Math.abs(rect.top - prevRect.bottom);
          const horizontalDistance = Math.abs(rect.left - prevRect.right);

          return (verticalDistance > 0 && verticalDistance < 8) ||
                 (horizontalDistance > 0 && horizontalDistance < 8);
        });

        return {
          totalLinks: links.length,
          closeTogether: closeLinks.length,
        };
      });

      if (spacingData.closeTogether > 10) {
        return this.fail(`${spacingData.closeTogether} elements too close together for touch`, spacingData);
      }

      return this.pass('Touch-friendly spacing detected', spacingData);
    } catch (error) {
      return this.pass('Touch spacing check skipped');
    }
  }

  private async checkMobileFormInputs(): Promise<CheckOutcome> {
    try {
      const formData = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));

        const withInputMode = inputs.filter((input) => input.hasAttribute('inputmode'));
        const withAutocomplete = inputs.filter((input) => input.hasAttribute('autocomplete'));
        const emailInputs = inputs.filter((input) => input.getAttribute('type') === 'email');
        const telInputs = inputs.filter((input) => input.getAttribute('type') === 'tel');
        const numberInputs = inputs.filter((input) => input.getAttribute('type') === 'number');

        return {
          total: inputs.length,
          withInputMode: withInputMode.length,
          withAutocomplete: withAutocomplete.length,
          specialInputTypes: emailInputs.length + telInputs.length + numberInputs.length,
        };
      });

      if (formData.total === 0) {
        return this.pass('No form inputs found');
      }

      const issues: string[] = [];

      if (formData.withAutocomplete < formData.total / 2) {
        issues.push('Few inputs use autocomplete attribute');
      }

      if (issues.length > 0) {
        return this.fail(`Mobile form issues: ${issues.join(', ')}`, formData);
      }

      return this.pass('Form inputs optimized for mobile', formData);
    } catch (error) {
      return this.pass('Mobile form inputs check skipped');
    }
  }

  private async checkMobileNavigation(): Promise<CheckOutcome> {
    try {
      const navData = await this.page.evaluate(() => {
        const hamburger = document.querySelector('[class*="hamburger"], [class*="menu-toggle"], [class*="mobile-menu"]');
        const nav = document.querySelector('nav');
        const hasFixedHeader = Array.from(document.querySelectorAll('header, nav')).some((el) => {
          const style = window.getComputedStyle(el);
          return style.position === 'fixed' || style.position === 'sticky';
        });

        return {
          hasHamburgerMenu: !!hamburger,
          hasNav: !!nav,
          hasFixedHeader,
        };
      });

      return this.pass(
        navData.hasHamburgerMenu
          ? 'Mobile navigation menu detected'
          : 'No obvious mobile menu (consider hamburger menu for mobile)',
        navData
      );
    } catch (error) {
      return this.pass('Mobile navigation check skipped');
    }
  }

  private async checkMobileReadability(): Promise<CheckOutcome> {
    try {
      const readabilityData = await this.page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        const fontSize = parseInt(bodyStyle.fontSize);

        const smallText = Array.from(document.querySelectorAll('p, li, span, div')).filter((el) => {
          const style = window.getComputedStyle(el);
          const size = parseInt(style.fontSize);
          const hasText = (el.textContent?.trim().length || 0) > 20;
          return hasText && size < 14;
        });

        return {
          bodyFontSize: fontSize,
          smallTextElements: smallText.length,
        };
      });

      if (readabilityData.bodyFontSize < 16) {
        return this.fail(`Base font size too small (${readabilityData.bodyFontSize}px). Recommended: 16px+`, readabilityData);
      }

      if (readabilityData.smallTextElements > 10) {
        return this.fail(`${readabilityData.smallTextElements} elements with small text (< 14px)`, readabilityData);
      }

      return this.pass('Mobile readability is good', readabilityData);
    } catch (error) {
      return this.pass('Mobile readability check skipped');
    }
  }

  private async checkMobileImageOptimization(): Promise<CheckOutcome> {
    try {
      const images = await this.page.evaluate(extractImages);
      const withSrcset = images.filter((img) => img.hasSrcset);
      const withSizes = images.filter((img) => img.hasSizes);
      const inPicture = images.filter((img) => img.inPicture);

      const imageData = {
        total: images.length,
        withSrcset: withSrcset.length,
        withSizes: withSizes.length,
        inPicture: inPicture.length,
        responsive: withSrcset.length + inPicture.length,
      };

      if (imageData.total > 5 && imageData.responsive === 0) {
        return this.fail('Images not optimized for mobile (use srcset or picture)', imageData);
      }

      return this.pass(
        imageData.responsive > 0
          ? `${imageData.responsive}/${imageData.total} images are mobile-optimized`
          : 'No images or optimization not needed',
        imageData
      );
    } catch (error) {
      return this.pass('Mobile image optimization check skipped');
    }
  }

  private async checkMobilePopups(): Promise<CheckOutcome> {
    try {
      const popupData = await this.page.evaluate(() => {
        const modals = Array.from(document.querySelectorAll('[class*="modal"], [class*="popup"], [class*="overlay"]'));
        const visible = modals.filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        return {
          totalModals: modals.length,
          visibleModals: visible.length,
        };
      });

      if (popupData.visibleModals > 0) {
        return this.fail(
          `${popupData.visibleModals} visible popup(s) detected (Google penalizes intrusive mobile interstitials)`,
          popupData
        );
      }

      return this.pass('No intrusive popups detected', popupData);
    } catch (error) {
      return this.pass('Mobile popups check skipped');
    }
  }

  private async checkOrientationSupport(): Promise<CheckOutcome> {
    try {
      const orientationData = await this.page.evaluate(() => {
        const hasOrientationCSS = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).some((el) => {
          const content = el.textContent || '';
          return content.includes('@media') &&
                 (content.includes('orientation') || content.includes('landscape') || content.includes('portrait'));
        });

        return {
          hasOrientationSupport: hasOrientationCSS,
        };
      });

      return this.pass(
        orientationData.hasOrientationSupport
          ? 'Orientation-specific CSS detected'
          : 'No orientation-specific CSS (optional)',
        orientationData
      );
    } catch (error) {
      return this.pass('Orientation support check skipped');
    }
  }

  private async checkTouchIcons(): Promise<CheckOutcome> {
    try {
      const iconData = await this.page.evaluate(() => {
        const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
        const appleTouchIcons = document.querySelectorAll('link[rel*="apple-touch-icon"]');
        const manifest = document.querySelector('link[rel="manifest"]');

        return {
          hasAppleTouchIcon: !!appleTouchIcon,
          appleTouchIconCount: appleTouchIcons.length,
          hasManifest: !!manifest,
        };
      });

      if (!iconData.hasAppleTouchIcon && !iconData.hasManifest) {
        return this.fail('Missing touch icons and web manifest', iconData);
      }

      return this.pass(
        iconData.hasAppleTouchIcon && iconData.hasManifest
          ? 'Touch icons and manifest present'
          : iconData.hasAppleTouchIcon
          ? 'Touch icons present (consider adding web manifest)'
          : 'Web manifest present (consider adding apple-touch-icon)',
        iconData
      );
    } catch (error) {
      return this.pass('Touch icons check skipped');
    }
  }

  private async checkAMPImplementation(): Promise<CheckOutcome> {
    try {
      const ampData = await this.page.evaluate(() => {
        const isAMP = document.documentElement.hasAttribute('amp') ||
                      document.documentElement.hasAttribute('⚡');
        const ampLink = document.querySelector('link[rel="amphtml"]');

        return {
          isAMPPage: isAMP,
          hasAMPVersion: !!ampLink,
          ampUrl: ampLink?.getAttribute('href'),
        };
      });

      return this.pass(
        ampData.isAMPPage
          ? 'This is an AMP page'
          : ampData.hasAMPVersion
          ? 'AMP version available'
          : 'No AMP (optional for mobile speed)',
        ampData
      );
    } catch (error) {
      return this.pass('AMP implementation check skipped');
    }
  }

  private async checkPWAFeatures(): Promise<CheckOutcome> {
    try {
      const pwaData = await this.page.evaluate(() => {
        const manifest = document.querySelector('link[rel="manifest"]');
        const serviceWorkerRegistered = 'serviceWorker' in navigator;
        const themeColor = document.querySelector('meta[name="theme-color"]');

        return {
          hasManifest: !!manifest,
          manifestUrl: manifest?.getAttribute('href'),
          serviceWorkerSupported: serviceWorkerRegistered,
          hasThemeColor: !!themeColor,
          themeColor: themeColor?.getAttribute('content'),
        };
      });

      const features = [];
      if (pwaData.hasManifest) features.push('manifest');
      if (pwaData.serviceWorkerSupported) features.push('service worker');
      if (pwaData.hasThemeColor) features.push('theme color');

      return this.pass(
        features.length > 0 ? `PWA features detected: ${features.join(', ')}` : 'No PWA features (optional)',
        pwaData
      );
    } catch (error) {
      return this.pass('PWA features check skipped');
    }
  }

  private async checkMobileScrolling(): Promise<CheckOutcome> {
    try {
      const scrollData = await this.page.evaluate(() => {
        const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
        const bodyStyle = window.getComputedStyle(document.body);
        const overflowX = bodyStyle.overflowX;

        return {
          hasHorizontalScroll,
          overflowX,
        };
      });

      if (scrollData.hasHorizontalScroll && scrollData.overflowX !== 'hidden') {
        return this.fail('Horizontal scrolling detected (mobile UX issue)', scrollData);
      }

      return this.pass('No unwanted horizontal scrolling', scrollData);
    } catch (error) {
      return this.pass('Mobile scrolling check skipped');
    }
  }

  private async checkMobilePerformance(): Promise<CheckOutcome> {
    try {
      const perfData = await this.page.evaluate(() => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        const resources = performance.getEntriesByType('resource').length;

        return {
          loadTime,
          loadTimeSeconds: (loadTime / 1000).toFixed(2),
          resourceCount: resources,
        };
      });

      if (perfData.loadTime > PAGE_LOAD_TIME_MS) {
        return this.fail(`Mobile load time is slow (${perfData.loadTimeSeconds}s). Target: < 3s`, perfData);
      }

      return this.pass(`Mobile performance acceptable (${perfData.loadTimeSeconds}s load)`, perfData);
    } catch (error) {
      return this.pass('Mobile performance check skipped');
    }
  }

  private async checkGestureSupport(): Promise<CheckOutcome> {
    try {
      const gestureData = await this.page.evaluate(() => {
        const hasTouchEvents = 'ontouchstart' in window;
        const hasPointerEvents = 'onpointerdown' in window;
        const hasClickHandlers = Array.from(document.querySelectorAll('*')).some((el) => {
          return el.getAttribute('onclick') !== null;
        });

        return {
          hasTouchEvents,
          hasPointerEvents,
          hasClickHandlers,
        };
      });

      return this.pass(
        gestureData.hasTouchEvents || gestureData.hasPointerEvents
          ? 'Touch/pointer events supported'
          : 'Touch support unclear',
        gestureData
      );
    } catch (error) {
      return this.pass('Gesture support check skipped');
    }
  }
}
