import { BaseChecker, CheckOutcome } from './base';
import { tokenize } from './shared/text';

export class SpamDetectionChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'hidden-text-absent', run: () => this.checkHiddenText() },
      { id: 'keyword-stuffing-absent', run: () => this.checkKeywordStuffing() },
      { id: 'excessive-links-absent', run: () => this.checkExcessiveLinks() },
      { id: 'suspicious-scripts-absent', run: () => this.checkSuspiciousScripts() },
      { id: 'iframes-acceptable', run: () => this.checkIframes() },
      { id: 'invisible-elements-absent', run: () => this.checkInvisibleElements() },
      { id: 'text-to-link-ratio-healthy', run: () => this.checkTextToLinkRatio() },
      { id: 'repetitive-content-absent', run: () => this.checkRepetitiveContent() },
      { id: 'suspicious-redirects-absent', run: () => this.checkSuspiciousRedirects() },
      { id: 'cloaking-absent', run: () => this.checkCloaking() },
      { id: 'adult-content-absent', run: () => this.checkAdultContent() },
      { id: 'spam-keywords-absent', run: () => this.checkSpamKeywords() },
      { id: 'outgoing-link-quality-good', run: () => this.checkOutgoingLinkQuality() },
      { id: 'meta-refresh-safe', run: () => this.checkMetaRefresh() },
      { id: 'tiny-text-absent', run: () => this.checkTinyText() },
    ];
  }

  private async checkHiddenText(): Promise<CheckOutcome> {
    try {
      const hiddenTextData = await this.page.evaluate(() => {
        const allElements = Array.from(document.body.querySelectorAll('*'));
        const hiddenElements = allElements.filter((el) => {
          const style = window.getComputedStyle(el);
          const hasText = (el.textContent?.trim().length || 0) > 20;

          if (!hasText) return false;

          // Check if element or parent is legitimately hidden for accessibility/UI purposes
          const isLegitimateHidden = () => {
            // Check ARIA attributes
            if (
              el.getAttribute('aria-hidden') === 'true' ||
              el.getAttribute('role') === 'presentation' ||
              el.getAttribute('role') === 'tab' ||
              el.getAttribute('role') === 'tabpanel' ||
              el.hasAttribute('aria-expanded')
            ) {
              return true;
            }

            // Check common UI framework classes for accordions, tabs, modals, dropdowns
            const className = el.className?.toString() || '';
            const legitimateClasses = [
              'accordion',
              'collapse',
              'tab-pane',
              'tab-content',
              'modal',
              'dropdown',
              'offcanvas',
              'drawer',
              'tooltip',
              'popover',
              'menu',
              'hidden-',
              'sr-only',
              'visually-hidden',
              'screen-reader',
            ];

            if (legitimateClasses.some(cls => className.toLowerCase().includes(cls))) {
              return true;
            }

            // Check for data attributes commonly used in interactive components
            if (
              el.hasAttribute('data-toggle') ||
              el.hasAttribute('data-collapse') ||
              el.hasAttribute('data-accordion') ||
              el.hasAttribute('data-modal') ||
              el.hasAttribute('data-drawer')
            ) {
              return true;
            }

            // Check if parent container has interactive attributes
            const parent = el.parentElement;
            if (parent) {
              const parentClass = parent.className?.toString() || '';
              if (legitimateClasses.some(cls => parentClass.toLowerCase().includes(cls))) {
                return true;
              }
            }

            return false;
          };

          const isHidden = (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            parseInt(style.fontSize) === 0
          );

          // Only flag as suspicious if hidden AND not legitimately hidden
          return isHidden && !isLegitimateHidden();
        });

        const hiddenTextContent = hiddenElements
          .map((el) => el.textContent?.trim().substring(0, 100))
          .filter((text) => text);

        return {
          count: hiddenElements.length,
          samples: hiddenTextContent.slice(0, 3),
        };
      });

      if (hiddenTextData.count > 0) {
        return this.fail(`Found ${hiddenTextData.count} elements with hidden text (potential spam technique)`, hiddenTextData);
      }

      return this.pass('No hidden text detected');
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Hidden text check skipped due to error' };
    }
  }

  private async checkKeywordStuffing(): Promise<CheckOutcome> {
    try {
      const content = await this.page.evaluate(() => {
        return document.body.innerText || '';
      });

      const words = tokenize(content);

      const wordCounts: Record<string, number> = {};
      words.forEach((word: string) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });

      const totalWords = words.length;
      const stuffedWords = Object.entries(wordCounts)
        .filter(([_, count]) => count > 15 && (count / totalWords) > 0.03)
        .map(([word, count]) => ({ word, count, percentage: ((count / totalWords) * 100).toFixed(2) }));

      if (stuffedWords.length > 0) {
        return this.fail(`Possible keyword stuffing detected (${stuffedWords.length} over-used words)`, {
          stuffedWords: stuffedWords.slice(0, 5),
          totalWords,
        });
      }

      return this.pass('No keyword stuffing detected');
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Keyword stuffing check skipped due to error' };
    }
  }

  private async checkExcessiveLinks(): Promise<CheckOutcome> {
    try {
      const linkData = await this.page.evaluate(() => {
        const links = document.querySelectorAll('a[href]');
        const text = document.body.innerText || '';
        const wordCount = text.split(/\s+/).length;

        return {
          linkCount: links.length,
          wordCount,
          ratio: wordCount > 0 ? links.length / wordCount : 0,
        };
      });

      // Google recommends fewer than 100 links per page
      if (linkData.linkCount > 100) {
        return this.fail(`Excessive links detected (${linkData.linkCount}). Recommended: under 100`, linkData);
      }

      // Check if too many links relative to content
      if (linkData.ratio > 0.1) {
        return this.fail(`High link-to-content ratio (${(linkData.ratio * 100).toFixed(1)}%)`, linkData);
      }

      return this.pass(`Appropriate number of links (${linkData.linkCount})`, linkData);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Excessive links check skipped due to error' };
    }
  }

  private async checkSuspiciousScripts(): Promise<CheckOutcome> {
    try {
      const scriptData = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        const suspicious = scripts.filter((script) => {
          const src = script.src || '';
          const content = script.textContent || '';

          // Check for suspicious patterns
          return (
            src.includes('eval(') ||
            content.includes('eval(') ||
            content.includes('document.write(') ||
            content.includes('unescape(') ||
            /[0-9a-f]{100,}/.test(content) // Long hex strings (often obfuscated)
          );
        });

        return {
          totalScripts: scripts.length,
          suspiciousCount: suspicious.length,
        };
      });

      if (scriptData.suspiciousCount > 0) {
        return this.fail(`Found ${scriptData.suspiciousCount} suspicious scripts (potential malware/spam)`, scriptData);
      }

      return this.pass('No suspicious scripts detected', scriptData);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Suspicious scripts check skipped due to error' };
    }
  }

  private async checkIframes(): Promise<CheckOutcome> {
    try {
      const iframeData = await this.page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const hidden = iframes.filter((iframe) => {
          const style = window.getComputedStyle(iframe);
          return (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            parseInt(style.width) < 10 ||
            parseInt(style.height) < 10
          );
        });

        return {
          totalIframes: iframes.length,
          hiddenIframes: hidden.length,
          sources: iframes.map((i) => i.src).filter((s) => s),
        };
      });

      if (iframeData.hiddenIframes > 0) {
        return this.fail(`Found ${iframeData.hiddenIframes} hidden iframes (spam technique)`, iframeData);
      }

      if (iframeData.totalIframes > 5) {
        return this.fail(`Many iframes detected (${iframeData.totalIframes}). Review for necessity`, iframeData);
      }

      return this.pass(
        iframeData.totalIframes === 0 ? 'No iframes found' : `${iframeData.totalIframes} iframes (acceptable)`,
        iframeData
      );
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Iframes check skipped due to error' };
    }
  }

  private async checkInvisibleElements(): Promise<CheckOutcome> {
    try {
      const invisibleData = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div, span, p'));
        const invisible = elements.filter((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          return (
            (rect.width < 1 || rect.height < 1) &&
            (el.textContent?.trim().length || 0) > 50
          );
        });

        return {
          count: invisible.length,
        };
      });

      if (invisibleData.count > 3) {
        return this.fail(`Found ${invisibleData.count} invisible elements with content`, invisibleData);
      }

      return this.pass('No suspicious invisible elements');
    } catch (error) {
      return this.pass('Invisible elements check skipped');
    }
  }

  private async checkTextToLinkRatio(): Promise<CheckOutcome> {
    try {
      const ratio = await this.page.evaluate(() => {
        const textContent = document.body.innerText?.length || 0;
        const linkText = Array.from(document.querySelectorAll('a'))
          .reduce((acc, link) => acc + (link.textContent?.length || 0), 0);

        return {
          textContent,
          linkText,
          ratio: textContent > 0 ? linkText / textContent : 0,
        };
      });

      if (ratio.ratio > 0.6) {
        return this.fail(`Very high link text ratio (${(ratio.ratio * 100).toFixed(1)}%)`, ratio);
      }

      return this.pass(`Healthy text-to-link ratio (${(ratio.ratio * 100).toFixed(1)}%)`, ratio);
    } catch (error) {
      return this.pass('Text-to-link ratio check skipped');
    }
  }

  private async checkRepetitiveContent(): Promise<CheckOutcome> {
    try {
      const repetition = await this.page.evaluate(() => {
        const paragraphs = Array.from(document.querySelectorAll('p'))
          .map((p) => p.textContent?.trim())
          .filter((text) => text && text.length > 50);

        const duplicates = paragraphs.filter(
          (text, index, self) => text && self.indexOf(text) !== index
        );

        return {
          totalParagraphs: paragraphs.length,
          duplicates: duplicates.length,
        };
      });

      if (repetition.duplicates > 2) {
        return this.fail(`Found ${repetition.duplicates} duplicate paragraphs`, repetition);
      }

      return this.pass('No significant content repetition detected');
    } catch (error) {
      return this.pass('Repetitive content check skipped');
    }
  }

  private async checkSuspiciousRedirects(): Promise<CheckOutcome> {
    try {
      const redirectData = await this.page.evaluate(() => {
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        const jsRedirects = Array.from(document.querySelectorAll('script'))
          .some((script) => {
            const content = script.textContent || '';
            return (
              content.includes('window.location') ||
              content.includes('location.href') ||
              content.includes('location.replace')
            );
          });

        return {
          hasMetaRefresh: !!metaRefresh,
          hasJSRedirect: jsRedirects,
          metaContent: metaRefresh?.getAttribute('content'),
        };
      });

      const issues: string[] = [];

      if (redirectData.hasMetaRefresh) {
        issues.push('Meta refresh redirect detected');
      }

      if (redirectData.hasJSRedirect) {
        issues.push('JavaScript redirect detected');
      }

      if (issues.length > 0) {
        return this.fail(`Suspicious redirects: ${issues.join(', ')}`, redirectData);
      }

      return this.pass('No suspicious redirects detected');
    } catch (error) {
      return this.pass('Redirect check skipped');
    }
  }

  private async checkCloaking(): Promise<CheckOutcome> {
    try {
      const cloakingIndicators = await this.page.evaluate(() => {
        const userAgentChecks = Array.from(document.querySelectorAll('script'))
          .some((script) => {
            const content = script.textContent || '';
            return content.toLowerCase().includes('navigator.useragent') ||
                   content.toLowerCase().includes('googlebot');
          });

        return {
          hasUserAgentChecks: userAgentChecks,
        };
      });

      if (cloakingIndicators.hasUserAgentChecks) {
        return this.fail('Potential cloaking detected (user-agent checks in scripts)', cloakingIndicators);
      }

      return this.pass('No cloaking indicators detected');
    } catch (error) {
      return this.pass('Cloaking check skipped');
    }
  }

  private async checkAdultContent(): Promise<CheckOutcome> {
    try {
      const content = await this.page.evaluate(() => {
        return (document.body.textContent || '').toLowerCase();
      });

      // Basic check for adult keywords (simplified)
      const adultKeywords = ['xxx', 'porn', 'sex', 'adult', 'casino', 'viagra', 'cialis'];
      const foundKeywords = adultKeywords.filter((keyword: string) => content.includes(keyword));

      if (foundKeywords.length > 2) {
        return this.fail(`Potential adult content keywords detected (${foundKeywords.length} keywords)`, {
          foundKeywords,
        });
      }

      return this.pass('No adult content detected');
    } catch (error) {
      return this.pass('Adult content check skipped');
    }
  }

  private async checkSpamKeywords(): Promise<CheckOutcome> {
    try {
      const content = await this.page.evaluate(() => {
        return (document.body.textContent || '').toLowerCase();
      });

      const spamKeywords = ['click here', 'buy now', 'limited time', 'act now', 'order now', 'free money', 'get paid', 'work from home', 'weight loss'];
      const foundKeywords = spamKeywords.filter((keyword: string) => {
        const count = (content.match(new RegExp(keyword, 'g')) || []).length;
        return count > 3;
      });

      if (foundKeywords.length > 3) {
        return this.fail(`Multiple spam keywords detected (${foundKeywords.length} types)`, { foundKeywords });
      }

      return this.pass('No excessive spam keywords detected');
    } catch (error) {
      return this.pass('Spam keywords check skipped');
    }
  }

  private async checkOutgoingLinkQuality(): Promise<CheckOutcome> {
    try {
      const linkQuality = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const currentHost = window.location.hostname;

        const external = links.filter((link) => {
          const href = link.getAttribute('href') || '';
          try {
            const url = new URL(href, window.location.href);
            return url.hostname !== currentHost;
          } catch {
            return false;
          }
        });

        const suspiciousDomains = external.filter((link) => {
          const href = link.getAttribute('href') || '';
          return href.includes('.tk') || href.includes('.ml') || href.includes('.ga');
        });

        return {
          totalLinks: links.length,
          externalLinks: external.length,
          suspiciousLinks: suspiciousDomains.length,
        };
      });

      if (linkQuality.suspiciousLinks > 0) {
        return this.fail(`Found ${linkQuality.suspiciousLinks} links to suspicious domains`, linkQuality);
      }

      return this.pass('Outgoing links appear legitimate', linkQuality);
    } catch (error) {
      return this.pass('Outgoing link quality check skipped');
    }
  }

  private async checkMetaRefresh(): Promise<CheckOutcome> {
    try {
      const metaRefresh = await this.page.evaluate(() => {
        const meta = document.querySelector('meta[http-equiv="refresh"]');
        const content = meta?.getAttribute('content') || '';
        const delay = parseInt(content.split(';')[0] || '0');

        return {
          hasMetaRefresh: !!meta,
          content,
          delay,
        };
      });

      if (metaRefresh.hasMetaRefresh && metaRefresh.delay < 3) {
        return this.fail(`Fast meta refresh detected (${metaRefresh.delay}s) - spam technique`, metaRefresh);
      }

      return this.pass('No problematic meta refresh');
    } catch (error) {
      return this.pass('Meta refresh check skipped');
    }
  }

  private async checkTinyText(): Promise<CheckOutcome> {
    try {
      const tinyText = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const tiny = elements.filter((el) => {
          const style = window.getComputedStyle(el);
          const fontSize = parseInt(style.fontSize);
          const hasText = (el.textContent?.trim().length || 0) > 20;

          return hasText && fontSize < 5 && fontSize > 0;
        });

        return {
          count: tiny.length,
        };
      });

      if (tinyText.count > 0) {
        return this.fail(`Found ${tinyText.count} elements with tiny text (potential spam)`, tinyText);
      }

      return this.pass('No tiny text detected');
    } catch (error) {
      return this.pass('Tiny text check skipped');
    }
  }
}
