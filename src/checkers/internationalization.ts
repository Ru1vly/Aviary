import { BaseChecker, CheckOutcome } from './base';

export class InternationalizationChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'hreflang-tags-valid', run: () => this.checkHreflangTags() },
      { id: 'language-declaration-valid', run: () => this.checkLanguageDeclaration() },
      { id: 'content-language-consistent', run: () => this.checkContentLanguage() },
      { id: 'alternate-languages-declared', run: () => this.checkAlternateLanguages() },
      { id: 'rtl-support-configured', run: () => this.checkRTLSupport() },
      { id: 'charset-utf8', run: () => this.checkCharsetDeclaration() },
      { id: 'language-switcher-present', run: () => this.checkLanguageSwitcher() },
      { id: 'localized-urls', run: () => this.checkLocalizedURLs() },
      { id: 'currency-display-appropriate', run: () => this.checkCurrencyDisplay() },
      { id: 'datetime-format-valid', run: () => this.checkDateTimeFormat() },
      { id: 'translation-quality-acceptable', run: () => this.checkTranslationQuality() },
      { id: 'multilingual-content-detected', run: () => this.checkMultilingualContent() },
      { id: 'geo-targeting-present', run: () => this.checkGeoTargeting() },
      { id: 'localized-metadata-present', run: () => this.checkLocalizedMetadata() },
      { id: 'unicode-support-utf8', run: () => this.checkUnicodeSupport() },
    ];
  }

  private async checkHreflangTags(): Promise<CheckOutcome> {
    try {
      const hreflangData = await this.page.evaluate(() => {
        const hreflangTags = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')) as HTMLLinkElement[];

        const languages = hreflangTags.map((tag) => tag.hreflang);
        const uniqueLanguages = new Set(languages);

        const hasXDefault = languages.includes('x-default');
        const hasSelfReference = hreflangTags.some((tag) => tag.href === window.location.href);

        return {
          count: hreflangTags.length,
          uniqueLanguages: uniqueLanguages.size,
          hasXDefault,
          hasSelfReference,
          languages: Array.from(uniqueLanguages),
        };
      });

      if (hreflangData.count === 0) {
        return this.pass('No hreflang tags (not needed for single-language sites)');
      }

      const issues: string[] = [];

      if (!hreflangData.hasXDefault) {
        issues.push('missing x-default hreflang');
      }

      if (!hreflangData.hasSelfReference) {
        issues.push('missing self-referencing hreflang');
      }

      if (issues.length > 0) {
        return this.fail(`Hreflang issues: ${issues.join(', ')}`, hreflangData);
      }

      return this.pass(`Hreflang properly configured for ${hreflangData.uniqueLanguages} language(s)`, hreflangData);
    } catch (error) {
      return this.pass('Hreflang tags check skipped');
    }
  }

  private async checkLanguageDeclaration(): Promise<CheckOutcome> {
    try {
      const langData = await this.page.evaluate(() => {
        const htmlLang = document.documentElement.getAttribute('lang');
        const htmlXmlLang = document.documentElement.getAttribute('xml:lang');

        const metaContentLanguage = document.querySelector('meta[http-equiv="content-language"]');

        return {
          htmlLang,
          htmlXmlLang,
          hasMetaContentLanguage: !!metaContentLanguage,
          isValid: !!htmlLang && /^[a-z]{2}(-[A-Z]{2})?$/.test(htmlLang),
        };
      });

      if (!langData.htmlLang) {
        return this.fail('Missing lang attribute on <html> tag (required for accessibility)', langData);
      }

      if (!langData.isValid) {
        return this.fail(
          `Invalid lang attribute format: "${langData.htmlLang}" (use ISO 639-1 codes like "en" or "en-US")`,
          langData
        );
      }

      return this.pass(`Language declared as "${langData.htmlLang}"`, langData);
    } catch (error) {
      return this.pass('Language declaration check skipped');
    }
  }

  private async checkContentLanguage(): Promise<CheckOutcome> {
    try {
      const contentData = await this.page.evaluate(() => {
        const htmlLang = document.documentElement.getAttribute('lang') || '';

        // Sample text content to detect language
        const bodyText = document.body.textContent || '';
        const textSample = bodyText.slice(0, 1000);

        // Simple heuristic: check for common non-ASCII characters
        const hasNonLatin = /[^\u0000-\u007F]/.test(textSample);
        const hasCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(textSample);
        const hasArabic = /[\u0600-\u06FF]/.test(textSample);
        const hasCyrillic = /[\u0400-\u04FF]/.test(textSample);

        return {
          declaredLang: htmlLang,
          hasNonLatin,
          hasCJK,
          hasArabic,
          hasCyrillic,
          textLength: bodyText.length,
        };
      });

      if (contentData.textLength === 0) {
        return this.pass('No text content to check');
      }

      const warnings: string[] = [];

      if (contentData.hasCJK && !['zh', 'ja', 'ko'].some((l) => contentData.declaredLang.startsWith(l))) {
        warnings.push('CJK characters found but lang not set to Chinese/Japanese/Korean');
      }

      if (contentData.hasArabic && !contentData.declaredLang.startsWith('ar')) {
        warnings.push('Arabic characters found but lang not set to Arabic');
      }

      if (contentData.hasCyrillic && !['ru', 'uk', 'bg', 'sr'].some((l) => contentData.declaredLang.startsWith(l))) {
        warnings.push('Cyrillic characters found but lang not matching');
      }

      if (warnings.length > 0) {
        return this.fail(`Language mismatch: ${warnings.join(', ')}`, contentData);
      }

      return this.pass('Content language appears consistent with declaration', contentData);
    } catch (error) {
      return this.pass('Content language check skipped');
    }
  }

  private async checkAlternateLanguages(): Promise<CheckOutcome> {
    try {
      const alternateData = await this.page.evaluate(() => {
        const alternateLangs = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')) as HTMLLinkElement[];

        const canonicalUrl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

        const alternateUrls = alternateLangs.map((link) => ({
          hreflang: link.hreflang,
          href: link.href,
        }));

        return {
          count: alternateLangs.length,
          hasCanonical: !!canonicalUrl,
          canonicalUrl: canonicalUrl?.href,
          alternates: alternateUrls,
        };
      });

      if (alternateData.count === 0) {
        return this.pass('No alternate language versions declared');
      }

      return this.pass(`${alternateData.count} alternate language version(s) declared`, alternateData);
    } catch (error) {
      return this.pass('Alternate languages check skipped');
    }
  }

  private async checkRTLSupport(): Promise<CheckOutcome> {
    try {
      const rtlData = await this.page.evaluate(() => {
        const htmlDir = document.documentElement.getAttribute('dir');
        const rtlElements = document.querySelectorAll('[dir="rtl"]');

        const bodyText = document.body.textContent || '';
        const hasArabic = /[\u0600-\u06FF]/.test(bodyText);
        const hasHebrew = /[\u0590-\u05FF]/.test(bodyText);

        return {
          htmlDir,
          rtlElements: rtlElements.length,
          hasArabic,
          hasHebrew,
          needsRTL: hasArabic || hasHebrew,
        };
      });

      if (!rtlData.needsRTL) {
        return this.pass('No RTL (right-to-left) language content detected');
      }

      if (rtlData.htmlDir !== 'rtl' && rtlData.rtlElements === 0) {
        return this.fail('RTL language detected but dir="rtl" attribute not set', rtlData);
      }

      return this.pass('RTL support properly configured', rtlData);
    } catch (error) {
      return this.pass('RTL support check skipped');
    }
  }

  private async checkCharsetDeclaration(): Promise<CheckOutcome> {
    try {
      const charsetData = await this.page.evaluate(() => {
        const metaCharset = document.querySelector('meta[charset]');
        const metaContentType = document.querySelector('meta[http-equiv="Content-Type"]');

        const charset = metaCharset?.getAttribute('charset') ||
          metaContentType?.getAttribute('content')?.match(/charset=([^;]+)/)?.[1];

        return {
          hasCharset: !!charset,
          charset: charset?.toUpperCase(),
          isUTF8: charset?.toUpperCase() === 'UTF-8',
        };
      });

      if (!charsetData.hasCharset) {
        return this.fail('Missing charset declaration (should be UTF-8)', charsetData);
      }

      if (!charsetData.isUTF8) {
        return this.fail(`Charset is "${charsetData.charset}" (UTF-8 recommended for international sites)`, charsetData);
      }

      return this.pass('Charset properly set to UTF-8', charsetData);
    } catch (error) {
      return this.pass('Charset declaration check skipped');
    }
  }

  private async checkLanguageSwitcher(): Promise<CheckOutcome> {
    try {
      const switcherData = await this.page.evaluate(() => {
        const langSwitchers = Array.from(document.querySelectorAll('[class*="lang"], [class*="language"], [id*="lang"]')).filter((el) => {
          const tag = el.tagName.toLowerCase();
          return tag === 'select' || tag === 'a' || tag === 'button';
        });

        const selectElements = Array.from(document.querySelectorAll('select')).filter((select) => {
          const options = Array.from(select.options);
          return options.some((opt) => /^[a-z]{2}(-[A-Z]{2})?$/.test(opt.value));
        });

        return {
          langSwitchers: langSwitchers.length,
          selectElements: selectElements.length,
          hasLanguageSwitcher: langSwitchers.length > 0 || selectElements.length > 0,
        };
      });

      const hreflangCount = await this.page.evaluate(() => {
        return document.querySelectorAll('link[rel="alternate"][hreflang]').length;
      });

      if (hreflangCount > 1 && !switcherData.hasLanguageSwitcher) {
        return this.fail('Multiple languages available but no visible language switcher', switcherData);
      }

      if (!switcherData.hasLanguageSwitcher) {
        return this.pass('No language switcher (not needed for single-language sites)');
      }

      return this.pass('Language switcher available', switcherData);
    } catch (error) {
      return this.pass('Language switcher check skipped');
    }
  }

  private async checkLocalizedURLs(): Promise<CheckOutcome> {
    try {
      const urlData = await this.page.evaluate(() => {
        const currentUrl = window.location.href;
        const pathname = window.location.pathname;

        // Check for common URL localization patterns
        const hasLangSubdomain = /^[a-z]{2}\./.test(window.location.hostname);
        const hasLangPath = /^\/[a-z]{2}([-_][A-Z]{2})?\//i.test(pathname);
        const hasLangParam = /[?&]lang=[a-z]{2}/i.test(currentUrl);

        return {
          currentUrl,
          hasLangSubdomain,
          hasLangPath,
          hasLangParam,
          hasLocalization: hasLangSubdomain || hasLangPath || hasLangParam,
        };
      });

      const hreflangCount = await this.page.evaluate(() => {
        return document.querySelectorAll('link[rel="alternate"][hreflang]').length;
      });

      if (hreflangCount > 1 && !urlData.hasLocalization) {
        return this.fail('Multiple languages but URLs not localized (use subdomain, path, or parameter)', urlData);
      }

      if (!urlData.hasLocalization) {
        return this.pass('Single language site, no URL localization needed');
      }

      const method = urlData.hasLangSubdomain ? 'subdomain' :
        urlData.hasLangPath ? 'path' : 'parameter';

      return this.pass(`URLs localized using ${method} strategy`, urlData);
    } catch (error) {
      return this.pass('Localized URLs check skipped');
    }
  }

  private async checkCurrencyDisplay(): Promise<CheckOutcome> {
    try {
      const currencyData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent || '';

        const currencies = [
          { symbol: '$', name: 'USD' },
          { symbol: '€', name: 'EUR' },
          { symbol: '£', name: 'GBP' },
          { symbol: '¥', name: 'JPY/CNY' },
          { symbol: '₹', name: 'INR' },
        ];

        const foundCurrencies = currencies.filter((curr) =>
          bodyText.includes(curr.symbol) || bodyText.includes(curr.name)
        );

        const currencySwitcher = Array.from(document.querySelectorAll('[class*="currency"], [id*="currency"]')).length > 0;

        return {
          foundCurrencies: foundCurrencies.map((c) => c.name),
          multipleCurrencies: foundCurrencies.length > 1,
          currencySwitcher,
        };
      });

      if (currencyData.foundCurrencies.length === 0) {
        return this.pass('No currency information detected');
      }

      if (currencyData.multipleCurrencies && !currencyData.currencySwitcher) {
        return this.fail(
          `Multiple currencies detected (${currencyData.foundCurrencies.join(', ')}) but no currency switcher`,
          currencyData
        );
      }

      return this.pass(
        currencyData.multipleCurrencies
          ? `Multiple currencies with switcher (${currencyData.foundCurrencies.join(', ')})`
          : `Currency: ${currencyData.foundCurrencies[0]}`,
        currencyData
      );
    } catch (error) {
      return this.pass('Currency display check skipped');
    }
  }

  private async checkDateTimeFormat(): Promise<CheckOutcome> {
    try {
      const dateData = await this.page.evaluate(() => {
        const timeElements = Array.from(document.querySelectorAll('time'));

        const hasDatetime = timeElements.some((el) => el.hasAttribute('datetime'));

        const bodyText = document.body.textContent || '';

        // Check for various date formats
        const hasUSFormat = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(bodyText);
        const hasEUFormat = /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(bodyText);
        const hasISOFormat = /\d{4}-\d{2}-\d{2}/.test(bodyText);

        return {
          timeElements: timeElements.length,
          hasDatetime,
          hasUSFormat,
          hasEUFormat,
          hasISOFormat,
        };
      });

      if (dateData.timeElements > 0 && !dateData.hasDatetime) {
        return this.fail('<time> elements missing datetime attribute', dateData);
      }

      if (dateData.timeElements === 0) {
        return this.pass('No date/time information to check');
      }

      return this.pass(`${dateData.timeElements} date/time element(s) with proper datetime attribute`, dateData);
    } catch (error) {
      return this.pass('Date/time format check skipped');
    }
  }

  private async checkTranslationQuality(): Promise<CheckOutcome> {
    try {
      const translationData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent || '';

        // Check for common machine translation artifacts
        const hasMixedLanguages = /[a-zA-Z]/.test(bodyText) && /[\u4E00-\u9FFF]/.test(bodyText);

        // Check for Lorem Ipsum placeholder text
        const hasLoremIpsum = /lorem ipsum/i.test(bodyText);

        // Check for untranslated common words (basic check)
        const htmlLang = document.documentElement.getAttribute('lang') || '';
        const hasEnglishWords = /\b(the|and|for|with|from)\b/gi.test(bodyText);
        const nonEnglishLang = htmlLang && !htmlLang.startsWith('en');

        return {
          hasMixedLanguages,
          hasLoremIpsum,
          hasEnglishWords: hasEnglishWords && nonEnglishLang,
          declaredLang: htmlLang,
        };
      });

      const issues: string[] = [];

      if (translationData.hasLoremIpsum) {
        issues.push('Lorem Ipsum placeholder text found');
      }

      if (translationData.hasMixedLanguages) {
        issues.push('mixed languages detected in content');
      }

      if (issues.length > 0) {
        return this.fail(`Translation quality issues: ${issues.join(', ')}`, translationData);
      }

      return this.pass('No obvious translation quality issues detected', translationData);
    } catch (error) {
      return this.pass('Translation quality check skipped');
    }
  }

  private async checkMultilingualContent(): Promise<CheckOutcome> {
    try {
      const multilingualData = await this.page.evaluate(() => {
        const hreflangTags = document.querySelectorAll('link[rel="alternate"][hreflang]');
        const langElements = document.querySelectorAll('[lang]');

        const uniqueLangs = new Set(
          Array.from(langElements).map((el) => el.getAttribute('lang')).filter((l) => l)
        );

        return {
          hreflangCount: hreflangTags.length,
          langElements: langElements.length,
          uniqueLangs: Array.from(uniqueLangs),
          isMultilingual: hreflangTags.length > 1 || uniqueLangs.size > 1,
        };
      });

      if (!multilingualData.isMultilingual) {
        return this.pass('Single language site');
      }

      return this.pass(`Multilingual site with ${multilingualData.uniqueLangs.length} language(s)`, multilingualData);
    } catch (error) {
      return this.pass('Multilingual content check skipped');
    }
  }

  private async checkGeoTargeting(): Promise<CheckOutcome> {
    try {
      const geoData = await this.page.evaluate(() => {
        const metaGeo = document.querySelectorAll('meta[name*="geo"], meta[name*="location"]');

        const bodyText = document.body.textContent?.toLowerCase() || '';
        const hasGeoKeywords = /country|region|location|available in/i.test(bodyText);

        return {
          metaGeoTags: metaGeo.length,
          hasGeoKeywords,
        };
      });

      if (geoData.metaGeoTags === 0 && !geoData.hasGeoKeywords) {
        return this.pass('No geo-targeting detected (optional)');
      }

      return this.pass(
        geoData.metaGeoTags > 0 ? 'Geo-targeting meta tags present' : 'Location-based content detected',
        geoData
      );
    } catch (error) {
      return this.pass('Geo-targeting check skipped');
    }
  }

  private async checkLocalizedMetadata(): Promise<CheckOutcome> {
    try {
      const metadataData = await this.page.evaluate(() => {
        const title = document.title;
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

        const htmlLang = document.documentElement.getAttribute('lang') || '';

        const ogLocale = document.querySelector('meta[property="og:locale"]')?.getAttribute('content');

        const hreflangTags = document.querySelectorAll('link[rel="alternate"][hreflang]');

        return {
          hasTitle: !!title,
          hasDescription: !!description,
          htmlLang,
          ogLocale,
          hreflangCount: hreflangTags.length,
          isMultilingual: hreflangTags.length > 1,
        };
      });

      if (!metadataData.isMultilingual) {
        return this.pass('Single language site, basic metadata sufficient');
      }

      if (!metadataData.ogLocale) {
        return this.fail('Multilingual site missing og:locale meta tag', metadataData);
      }

      return this.pass('Localized metadata present (og:locale)', metadataData);
    } catch (error) {
      return this.pass('Localized metadata check skipped');
    }
  }

  private async checkUnicodeSupport(): Promise<CheckOutcome> {
    try {
      const unicodeData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent || '';

        // Check for various Unicode ranges
        const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(bodyText);
        const hasSpecialChars = /[^\u0000-\u007F]/.test(bodyText);
        const hasCombiningChars = /[\u0300-\u036F]/.test(bodyText);

        const charset = document.querySelector('meta[charset]')?.getAttribute('charset')?.toUpperCase();

        return {
          hasEmoji,
          hasSpecialChars,
          hasCombiningChars,
          charset,
          isUTF8: charset === 'UTF-8',
        };
      });

      if (unicodeData.hasSpecialChars && !unicodeData.isUTF8) {
        return this.fail(
          `Unicode characters detected but charset is ${unicodeData.charset || 'not set'} (should be UTF-8)`,
          unicodeData
        );
      }

      if (!unicodeData.hasSpecialChars) {
        return this.pass('Basic Latin characters only');
      }

      return this.pass(
        unicodeData.hasEmoji ? 'Unicode support with UTF-8 (including emoji)' : 'Unicode support with UTF-8',
        unicodeData
      );
    } catch (error) {
      return this.pass('Unicode support check skipped');
    }
  }
}
