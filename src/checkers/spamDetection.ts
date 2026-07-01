import { Page } from 'playwright';
import { SEOCheckResult } from '../types';

export class SpamDetectionChecker {
  constructor(private page: Page) {}

  async checkAll(): Promise<SEOCheckResult[]> {
    const results: SEOCheckResult[] = [];

    results.push(await this.checkHiddenText());
    results.push(await this.checkKeywordStuffing());
    results.push(await this.checkExcessiveLinks());
    results.push(await this.checkSuspiciousScripts());
    results.push(await this.checkIframes());
    results.push(await this.checkInvisibleElements());
    results.push(await this.checkTextToLinkRatio());
    results.push(await this.checkRepetitiveContent());
    results.push(await this.checkSuspiciousRedirects());
    results.push(await this.checkCloaking());
    results.push(await this.checkAdultContent());
    results.push(await this.checkSpamKeywords());
    results.push(await this.checkOutgoingLinkQuality());
    results.push(await this.checkMetaRefresh());
    results.push(await this.checkTinyText());

    return results;
  }

  private async checkHiddenText(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Found ${hiddenTextData.count} elements with hidden text (potential spam technique)`,
          details: hiddenTextData,
        };
      }

      return {
        passed: true,
        message: 'No hidden text detected',
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Hidden text check skipped due to error',
      };
    }
  }

  private async checkKeywordStuffing(): Promise<SEOCheckResult> {
    try {
      const content = await this.page.evaluate(() => {
        return document.body.innerText || '';
      });

      const words = content
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3);

      const wordCounts: Record<string, number> = {};
      words.forEach((word: string) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });

      const totalWords = words.length;
      const stuffedWords = Object.entries(wordCounts)
        .filter(([_, count]) => count > 15 && (count / totalWords) > 0.03)
        .map(([word, count]) => ({ word, count, percentage: ((count / totalWords) * 100).toFixed(2) }));

      if (stuffedWords.length > 0) {
        return {
          passed: false,
          message: `Possible keyword stuffing detected (${stuffedWords.length} over-used words)`,
          details: { stuffedWords: stuffedWords.slice(0, 5), totalWords },
        };
      }

      return {
        passed: true,
        message: 'No keyword stuffing detected',
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Keyword stuffing check skipped due to error',
      };
    }
  }

  private async checkExcessiveLinks(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Excessive links detected (${linkData.linkCount}). Recommended: under 100`,
          details: linkData,
        };
      }

      // Check if too many links relative to content
      if (linkData.ratio > 0.1) {
        return {
          passed: false,
          message: `High link-to-content ratio (${(linkData.ratio * 100).toFixed(1)}%)`,
          details: linkData,
        };
      }

      return {
        passed: true,
        message: `Appropriate number of links (${linkData.linkCount})`,
        details: linkData,
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Excessive links check skipped due to error',
      };
    }
  }

  private async checkSuspiciousScripts(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Found ${scriptData.suspiciousCount} suspicious scripts (potential malware/spam)`,
          details: scriptData,
        };
      }

      return {
        passed: true,
        message: 'No suspicious scripts detected',
        details: scriptData,
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Suspicious scripts check skipped due to error',
      };
    }
  }

  private async checkIframes(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Found ${iframeData.hiddenIframes} hidden iframes (spam technique)`,
          details: iframeData,
        };
      }

      if (iframeData.totalIframes > 5) {
        return {
          passed: false,
          message: `Many iframes detected (${iframeData.totalIframes}). Review for necessity`,
          details: iframeData,
        };
      }

      return {
        passed: true,
        message: iframeData.totalIframes === 0 ? 'No iframes found' : `${iframeData.totalIframes} iframes (acceptable)`,
        details: iframeData,
      };
    } catch (error) {
      return {
        passed: false,

        severity: 'info',

        message: 'Iframes check skipped due to error',
      };
    }
  }

  private async checkInvisibleElements(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Found ${invisibleData.count} invisible elements with content`,
          details: invisibleData,
        };
      }

      return {
        passed: true,
        message: 'No suspicious invisible elements',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Invisible elements check skipped',
      };
    }
  }

  private async checkTextToLinkRatio(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Very high link text ratio (${(ratio.ratio * 100).toFixed(1)}%)`,
          details: ratio,
        };
      }

      return {
        passed: true,
        message: `Healthy text-to-link ratio (${(ratio.ratio * 100).toFixed(1)}%)`,
        details: ratio,
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Text-to-link ratio check skipped',
      };
    }
  }

  private async checkRepetitiveContent(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Found ${repetition.duplicates} duplicate paragraphs`,
          details: repetition,
        };
      }

      return {
        passed: true,
        message: 'No significant content repetition detected',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Repetitive content check skipped',
      };
    }
  }

  private async checkSuspiciousRedirects(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Suspicious redirects: ${issues.join(', ')}`,
          details: redirectData,
        };
      }

      return {
        passed: true,
        message: 'No suspicious redirects detected',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Redirect check skipped',
      };
    }
  }

  private async checkCloaking(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: 'Potential cloaking detected (user-agent checks in scripts)',
          details: cloakingIndicators,
        };
      }

      return {
        passed: true,
        message: 'No cloaking indicators detected',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Cloaking check skipped',
      };
    }
  }

  private async checkAdultContent(): Promise<SEOCheckResult> {
    try {
      const content = await this.page.evaluate(() => {
        return (document.body.textContent || '').toLowerCase();
      });

      // Basic check for adult keywords (simplified)
      const adultKeywords = ['xxx', 'porn', 'sex', 'adult', 'casino', 'viagra', 'cialis'];
      const foundKeywords = adultKeywords.filter((keyword: string) => content.includes(keyword));

      if (foundKeywords.length > 2) {
        return {
          passed: false,
          message: `Potential adult content keywords detected (${foundKeywords.length} keywords)`,
          details: { foundKeywords },
        };
      }

      return {
        passed: true,
        message: 'No adult content detected',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Adult content check skipped',
      };
    }
  }

  private async checkSpamKeywords(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Multiple spam keywords detected (${foundKeywords.length} types)`,
          details: { foundKeywords },
        };
      }

      return {
        passed: true,
        message: 'No excessive spam keywords detected',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Spam keywords check skipped',
      };
    }
  }

  private async checkOutgoingLinkQuality(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Found ${linkQuality.suspiciousLinks} links to suspicious domains`,
          details: linkQuality,
        };
      }

      return {
        passed: true,
        message: 'Outgoing links appear legitimate',
        details: linkQuality,
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Outgoing link quality check skipped',
      };
    }
  }

  private async checkMetaRefresh(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Fast meta refresh detected (${metaRefresh.delay}s) - spam technique`,
          details: metaRefresh,
        };
      }

      return {
        passed: true,
        message: 'No problematic meta refresh',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Meta refresh check skipped',
      };
    }
  }

  private async checkTinyText(): Promise<SEOCheckResult> {
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
        return {
          passed: false,
          message: `Found ${tinyText.count} elements with tiny text (potential spam)`,
          details: tinyText,
        };
      }

      return {
        passed: true,
        message: 'No tiny text detected',
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Tiny text check skipped',
      };
    }
  }
}
