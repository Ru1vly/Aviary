import { BaseChecker, CheckOutcome } from './base';

export class AnalyticsChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'google-analytics-detected', run: () => this.checkGoogleAnalytics() },
      { id: 'google-tag-manager-configured', run: () => this.checkGoogleTagManager() },
      { id: 'facebook-pixel-detected', run: () => this.checkFacebookPixel() },
      { id: 'google-ads-detected', run: () => this.checkGoogleAds() },
      { id: 'hotjar-detected', run: () => this.checkHotjar() },
      { id: 'mixpanel-detected', run: () => this.checkMixpanel() },
      { id: 'segment-detected', run: () => this.checkSegment() },
      { id: 'behavior-analytics-detected', run: () => this.checkClarityOrSimilar() },
      { id: 'search-console-verified', run: () => this.checkSearchConsoleVerification() },
      { id: 'bing-webmaster-verified', run: () => this.checkBingWebmasterVerification() },
      { id: 'yandex-verified', run: () => this.checkYandexVerification() },
      { id: 'advertising-pixels-detected', run: () => this.checkPixelTracking() },
      { id: 'conversion-tracking-detected', run: () => this.checkConversionTracking() },
      { id: 'heatmap-tools-detected', run: () => this.checkHeatmapTools() },
      { id: 'ab-testing-tools-detected', run: () => this.checkABTestingTools() },
    ];
  }

  private async checkGoogleAnalytics(): Promise<CheckOutcome> {
    try {
      const gaData = await this.page.evaluate(() => {
        const hasGA4 = !!(window as any).gtag || !!(window as any).dataLayer;
        const hasUA = !!(window as any).ga;
        const hasGtag = document.querySelector('script[src*="googletagmanager.com/gtag"]');
        const hasAnalytics = document.querySelector('script[src*="google-analytics.com/analytics"]');

        return {
          hasGA4,
          hasUA,
          hasGtag: !!hasGtag,
          hasAnalytics: !!hasAnalytics,
        };
      });

      if (!gaData.hasGA4 && !gaData.hasUA && !gaData.hasGtag && !gaData.hasAnalytics) {
        return this.fail('Google Analytics not detected (recommended for tracking)', gaData);
      }

      return this.pass(
        gaData.hasGA4 ? 'Google Analytics 4 detected' : 'Google Analytics (UA) detected - consider upgrading to GA4',
        gaData
      );
    } catch (error) {
      return this.pass('Google Analytics check skipped');
    }
  }

  private async checkGoogleTagManager(): Promise<CheckOutcome> {
    try {
      const gtmData = await this.page.evaluate(() => {
        const hasGTM = !!(window as any).google_tag_manager;
        const gtmScript = document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
        const gtmNoscript = document.querySelector('noscript iframe[src*="googletagmanager.com/ns.html"]');

        return {
          hasGTM,
          hasScript: !!gtmScript,
          hasNoscript: !!gtmNoscript,
        };
      });

      if (gtmData.hasGTM && !gtmData.hasNoscript) {
        return this.fail('GTM detected but missing <noscript> fallback', gtmData);
      }

      return this.pass(
        gtmData.hasGTM ? 'Google Tag Manager properly implemented' : 'No Google Tag Manager (optional)',
        gtmData
      );
    } catch (error) {
      return this.pass('GTM check skipped');
    }
  }

  private async checkFacebookPixel(): Promise<CheckOutcome> {
    try {
      const fbData = await this.page.evaluate(() => {
        const hasFBQ = !!(window as any).fbq;
        const fbScript = document.querySelector('script[src*="connect.facebook.net"]');

        return {
          hasFacebookPixel: hasFBQ,
          hasScript: !!fbScript,
        };
      });

      return this.pass(
        fbData.hasFacebookPixel ? 'Facebook Pixel detected' : 'No Facebook Pixel (optional)',
        fbData
      );
    } catch (error) {
      return this.pass('Facebook Pixel check skipped');
    }
  }

  private async checkGoogleAds(): Promise<CheckOutcome> {
    try {
      const adsData = await this.page.evaluate(() => {
        const hasGoogleAds = document.querySelector('script[src*="googleadservices.com"]') ||
                             document.querySelector('script[src*="googlesyndication.com"]');

        return {
          hasGoogleAds: !!hasGoogleAds,
        };
      });

      return this.pass(adsData.hasGoogleAds ? 'Google Ads tracking detected' : 'No Google Ads (optional)', adsData);
    } catch (error) {
      return this.pass('Google Ads check skipped');
    }
  }

  private async checkHotjar(): Promise<CheckOutcome> {
    try {
      const hotjarData = await this.page.evaluate(() => {
        const hasHotjar = !!(window as any).hj;
        const hotjarScript = document.querySelector('script[src*="static.hotjar.com"]');

        return {
          hasHotjar,
          hasScript: !!hotjarScript,
        };
      });

      return this.pass(hotjarData.hasHotjar ? 'Hotjar detected' : 'No Hotjar (optional heatmap tool)', hotjarData);
    } catch (error) {
      return this.pass('Hotjar check skipped');
    }
  }

  private async checkMixpanel(): Promise<CheckOutcome> {
    try {
      const mixpanelData = await this.page.evaluate(() => {
        const hasMixpanel = !!(window as any).mixpanel;
        const mixpanelScript = document.querySelector('script[src*="cdn.mxpnl.com"]');

        return {
          hasMixpanel,
          hasScript: !!mixpanelScript,
        };
      });

      return this.pass(mixpanelData.hasMixpanel ? 'Mixpanel detected' : 'No Mixpanel (optional)', mixpanelData);
    } catch (error) {
      return this.pass('Mixpanel check skipped');
    }
  }

  private async checkSegment(): Promise<CheckOutcome> {
    try {
      const segmentData = await this.page.evaluate(() => {
        const hasSegment = !!(window as any).analytics;
        const segmentScript = document.querySelector('script[src*="cdn.segment.com"]');

        return {
          hasSegment,
          hasScript: !!segmentScript,
        };
      });

      return this.pass(segmentData.hasSegment ? 'Segment detected' : 'No Segment (optional)', segmentData);
    } catch (error) {
      return this.pass('Segment check skipped');
    }
  }

  private async checkClarityOrSimilar(): Promise<CheckOutcome> {
    try {
      const clarityData = await this.page.evaluate(() => {
        const hasClarity = !!(window as any).clarity;
        const clarityScript = document.querySelector('script[src*="clarity.ms"]');
        const hasMouseflow = document.querySelector('script[src*="mouseflow.com"]');
        const hasCrazyEgg = document.querySelector('script[src*="crazyegg.com"]');

        return {
          hasClarity: !!clarityScript || hasClarity,
          hasMouseflow: !!hasMouseflow,
          hasCrazyEgg: !!hasCrazyEgg,
        };
      });

      const tools = [];
      if (clarityData.hasClarity) tools.push('Clarity');
      if (clarityData.hasMouseflow) tools.push('Mouseflow');
      if (clarityData.hasCrazyEgg) tools.push('CrazyEgg');

      return this.pass(
        tools.length > 0 ? `Behavior analytics detected: ${tools.join(', ')}` : 'No behavior analytics tools',
        clarityData
      );
    } catch (error) {
      return this.pass('Behavior analytics check skipped');
    }
  }

  private async checkSearchConsoleVerification(): Promise<CheckOutcome> {
    try {
      const verification = await this.page.evaluate(() => {
        const meta = document.querySelector('meta[name="google-site-verification"]');
        return {
          hasVerification: !!meta,
          content: meta?.getAttribute('content'),
        };
      });

      return this.pass(
        verification.hasVerification
          ? 'Google Search Console verification found'
          : 'No Search Console verification (add for better SEO insights)',
        verification
      );
    } catch (error) {
      return this.pass('Search Console verification check skipped');
    }
  }

  private async checkBingWebmasterVerification(): Promise<CheckOutcome> {
    try {
      const verification = await this.page.evaluate(() => {
        const meta = document.querySelector('meta[name="msvalidate.01"]');
        return {
          hasVerification: !!meta,
          content: meta?.getAttribute('content'),
        };
      });

      return this.pass(
        verification.hasVerification
          ? 'Bing Webmaster Tools verification found'
          : 'No Bing Webmaster verification (optional)',
        verification
      );
    } catch (error) {
      return this.pass('Bing verification check skipped');
    }
  }

  private async checkYandexVerification(): Promise<CheckOutcome> {
    try {
      const verification = await this.page.evaluate(() => {
        const meta = document.querySelector('meta[name="yandex-verification"]');
        return {
          hasVerification: !!meta,
          content: meta?.getAttribute('content'),
        };
      });

      return this.pass(
        verification.hasVerification ? 'Yandex Webmaster verification found' : 'No Yandex verification (optional)',
        verification
      );
    } catch (error) {
      return this.pass('Yandex verification check skipped');
    }
  }

  private async checkPixelTracking(): Promise<CheckOutcome> {
    try {
      const pixelData = await this.page.evaluate(() => {
        const pixels = {
          linkedin: document.querySelector('script[src*="snap.licdn.com"]'),
          twitter: document.querySelector('script[src*="static.ads-twitter.com"]'),
          pinterest: document.querySelector('script[src*="pintrk"]'),
          tiktok: document.querySelector('script[src*="analytics.tiktok.com"]'),
          reddit: document.querySelector('script[src*="rdt.js"]'),
        };

        const detected = Object.entries(pixels)
          .filter(([_, exists]) => exists)
          .map(([name]) => name);

        return {
          pixels,
          detected,
          count: detected.length,
        };
      });

      return this.pass(
        pixelData.count > 0
          ? `${pixelData.count} advertising pixels detected: ${pixelData.detected.join(', ')}`
          : 'No advertising pixels detected',
        pixelData
      );
    } catch (error) {
      return this.pass('Pixel tracking check skipped');
    }
  }

  private async checkConversionTracking(): Promise<CheckOutcome> {
    try {
      const conversionData = await this.page.evaluate(() => {
        const hasGoogleConversion = document.querySelector('script[src*="googleadservices.com/pagead/conversion"]');
        const hasFBConversion = !!(window as any).fbq;
        const hasLinkedInConversion = document.querySelector('script[src*="snap.licdn.com"]');

        return {
          hasGoogleConversion: !!hasGoogleConversion,
          hasFBConversion,
          hasLinkedInConversion: !!hasLinkedInConversion,
        };
      });

      const tools = [];
      if (conversionData.hasGoogleConversion) tools.push('Google Ads');
      if (conversionData.hasFBConversion) tools.push('Facebook');
      if (conversionData.hasLinkedInConversion) tools.push('LinkedIn');

      return this.pass(
        tools.length > 0 ? `Conversion tracking: ${tools.join(', ')}` : 'No conversion tracking detected',
        conversionData
      );
    } catch (error) {
      return this.pass('Conversion tracking check skipped');
    }
  }

  private async checkHeatmapTools(): Promise<CheckOutcome> {
    try {
      const heatmapData = await this.page.evaluate(() => {
        const tools = {
          hotjar: !!(window as any).hj,
          clarity: !!(window as any).clarity,
          mouseflow: !!document.querySelector('script[src*="mouseflow.com"]'),
          crazyegg: !!document.querySelector('script[src*="crazyegg.com"]'),
          luckyorange: !!document.querySelector('script[src*="luckyorange.com"]'),
        };

        const detected = Object.entries(tools)
          .filter(([_, exists]) => exists)
          .map(([name]) => name);

        return {
          tools,
          detected,
          count: detected.length,
        };
      });

      return this.pass(
        heatmapData.count > 0
          ? `Heatmap tools detected: ${heatmapData.detected.join(', ')}`
          : 'No heatmap tools (consider for UX insights)',
        heatmapData
      );
    } catch (error) {
      return this.pass('Heatmap tools check skipped');
    }
  }

  private async checkABTestingTools(): Promise<CheckOutcome> {
    try {
      const abTestData = await this.page.evaluate(() => {
        const tools = {
          optimizely: !!(window as any).optimizely,
          vwo: !!(window as any)._vwo_code,
          googleOptimize: !!document.querySelector('script[src*="optimize.google.com"]'),
          abtasty: !!(window as any).ABTasty,
        };

        const detected = Object.entries(tools)
          .filter(([_, exists]) => exists)
          .map(([name]) => name);

        return {
          tools,
          detected,
          count: detected.length,
        };
      });

      return this.pass(
        abTestData.count > 0
          ? `A/B testing tools detected: ${abTestData.detected.join(', ')}`
          : 'No A/B testing tools (optional)',
        abTestData
      );
    } catch (error) {
      return this.pass('A/B testing tools check skipped');
    }
  }
}
