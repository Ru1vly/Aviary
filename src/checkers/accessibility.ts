import { BaseChecker, CheckOutcome } from './base';
import { MAX_NEGATIVE_TABINDEX_ELEMENTS } from '../config/thresholds';

export class AccessibilityChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'aria-labels-adequate', run: () => this.checkAriaLabels() },
      { id: 'form-inputs-labeled', run: () => this.checkFormLabels() },
      { id: 'skip-links-present', run: () => this.checkSkipLinks() },
      { id: 'tab-order-natural', run: () => this.checkTabIndex() },
    ];
  }

  private async checkAriaLabels(): Promise<CheckOutcome> {
    try {
      const ariaData = await this.page.evaluate(() => {
        const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');

        const interactiveWithoutAria = Array.from(interactiveElements).filter((el) => {
          const hasText = el.textContent?.trim();
          const hasAriaLabel = el.hasAttribute('aria-label');
          const hasAriaLabelledBy = el.hasAttribute('aria-labelledby');
          const hasTitle = el.hasAttribute('title');
          const hasAlt = el.hasAttribute('alt');

          // Skip if element has any form of label
          if (hasText || hasAriaLabel || hasAriaLabelledBy || hasTitle || hasAlt) {
            return false;
          }

          return true;
        });

        const landmarks = document.querySelectorAll('[role="navigation"], [role="main"], [role="banner"], [role="contentinfo"], nav, main, header, footer');

        return {
          elementsWithAria: elementsWithAria.length,
          interactiveElements: interactiveElements.length,
          interactiveWithoutLabel: interactiveWithoutAria.length,
          hasLandmarks: landmarks.length > 0,
          landmarksCount: landmarks.length,
        };
      });

      const issues: string[] = [];

      if (ariaData.interactiveWithoutLabel > 0) {
        issues.push(`${ariaData.interactiveWithoutLabel} interactive elements missing labels`);
      }

      if (!ariaData.hasLandmarks) {
        issues.push('No ARIA landmarks found (nav, main, header, footer)');
      }

      if (issues.length > 0) {
        return this.fail(`Accessibility issues: ${issues.join(', ')}`, ariaData);
      }

      return this.pass(`Good accessibility structure with ${ariaData.landmarksCount} landmarks`, ariaData);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'ARIA labels check skipped due to error' };
    }
  }

  private async checkFormLabels(): Promise<CheckOutcome> {
    try {
      const formData = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        const inputsWithoutLabels = inputs.filter((input) => {
          const id = input.getAttribute('id');
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = input.hasAttribute('aria-label');
          const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
          const hasPlaceholder = input.hasAttribute('placeholder');
          const type = input.getAttribute('type');

          // Skip hidden, submit, button inputs
          if (type === 'hidden' || type === 'submit' || type === 'button') {
            return false;
          }

          return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasPlaceholder;
        });

        return {
          totalInputs: inputs.length,
          inputsWithoutLabels: inputsWithoutLabels.length,
        };
      });

      if (formData.totalInputs === 0) {
        return this.pass('No form inputs found on page');
      }

      if (formData.inputsWithoutLabels > 0) {
        return this.fail(`${formData.inputsWithoutLabels} form inputs missing labels (accessibility issue)`, formData);
      }

      return this.pass(`All ${formData.totalInputs} form inputs have proper labels`, formData);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Form labels check skipped due to error' };
    }
  }

  private async checkSkipLinks(): Promise<CheckOutcome> {
    try {
      const skipLinkData = await this.page.evaluate(() => {
        const skipLinks = Array.from(document.querySelectorAll('a[href^="#"]')).filter((link) => {
          const text = link.textContent?.toLowerCase() || '';
          return text.includes('skip') || text.includes('jump');
        });

        return {
          hasSkipLinks: skipLinks.length > 0,
          count: skipLinks.length,
        };
      });

      if (!skipLinkData.hasSkipLinks) {
        return this.fail('No skip navigation links found - recommended for accessibility');
      }

      return this.pass(`Skip navigation link(s) found (${skipLinkData.count})`, skipLinkData);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Skip links check skipped due to error' };
    }
  }

  private async checkTabIndex(): Promise<CheckOutcome> {
    try {
      const tabIndexData = await this.page.evaluate(() => {
        const negativeTabIndex = document.querySelectorAll('[tabindex^="-"]');
        const highTabIndex = Array.from(document.querySelectorAll('[tabindex]')).filter((el) => {
          const tabindex = parseInt(el.getAttribute('tabindex') || '0');
          return tabindex > 0;
        });

        return {
          negativeTabIndexCount: negativeTabIndex.length,
          highTabIndexCount: highTabIndex.length,
        };
      });

      const issues: string[] = [];
      const maxNegativeTabIndex = this.threshold(
        'tab-order-natural',
        'maxNegativeTabIndex',
        MAX_NEGATIVE_TABINDEX_ELEMENTS
      );

      if (tabIndexData.negativeTabIndexCount > maxNegativeTabIndex) {
        issues.push(`${tabIndexData.negativeTabIndexCount} elements with negative tabindex (removes from tab order)`);
      }

      if (tabIndexData.highTabIndexCount > 0) {
        issues.push(`${tabIndexData.highTabIndexCount} elements with positive tabindex (can disrupt natural tab order)`);
      }

      if (issues.length > 0) {
        return this.fail(`Tab order issues: ${issues.join(', ')}`, tabIndexData);
      }

      return this.pass('Tab order follows natural document flow', tabIndexData);
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Tab index check skipped due to error' };
    }
  }
}
