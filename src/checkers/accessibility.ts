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
        const elementsWithAria = document.querySelectorAll(
          '[aria-label], [aria-labelledby], [aria-describedby]'
        );
        const interactiveElements = document.querySelectorAll(
          'button,a,area,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[role="menuitem"]'
        );

        const hasNonEmptyAttribute = (element: Element, attribute: string): boolean =>
          Boolean(element.getAttribute(attribute)?.trim());
        const hasReferencedLabel = (element: Element): boolean =>
          (element.getAttribute('aria-labelledby') ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .some((id) => Boolean(document.getElementById(id)?.textContent?.trim()));

        const interactiveWithoutAria = Array.from(interactiveElements).filter((el) => {
          const hasText = el.textContent?.trim();
          const hasAriaLabel = hasNonEmptyAttribute(el, 'aria-label');
          const hasAriaLabelledBy = hasReferencedLabel(el);
          const hasTitle = hasNonEmptyAttribute(el, 'title');
          const hasAlt = hasNonEmptyAttribute(el, 'alt');
          const hasImageAlternative = Array.from(el.querySelectorAll('img[alt]')).some((image) =>
            Boolean(image.getAttribute('alt')?.trim())
          );

          // Skip if element has any form of label
          if (
            hasText ||
            hasAriaLabel ||
            hasAriaLabelledBy ||
            hasTitle ||
            hasAlt ||
            hasImageAlternative
          ) {
            return false;
          }

          return true;
        });

        const landmarks = document.querySelectorAll(
          '[role="navigation"], [role="main"], [role="banner"], [role="contentinfo"], nav, main, header, footer'
        );

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

      return this.pass(
        `Good accessibility structure with ${ariaData.landmarksCount} landmarks`,
        ariaData
      );
    } catch (error) {
      return { passed: false, severity: 'info', message: 'ARIA labels check skipped due to error' };
    }
  }

  private async checkFormLabels(): Promise<CheckOutcome> {
    try {
      const formData = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        const hasReferencedLabel = (element: Element): boolean =>
          (element.getAttribute('aria-labelledby') ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .some((id) => Boolean(document.getElementById(id)?.textContent?.trim()));
        const inputsWithoutLabels = inputs.filter((input) => {
          const control = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          const hasLabel = Array.from(control.labels ?? []).some(
            (label) =>
              Boolean(label.textContent?.trim()) ||
              Array.from(label.querySelectorAll('img[alt]')).some((image) =>
                Boolean(image.getAttribute('alt')?.trim())
              )
          );
          const hasAriaLabel = Boolean(input.getAttribute('aria-label')?.trim());
          const hasAriaLabelledBy = hasReferencedLabel(input);
          const hasTitle = Boolean(input.getAttribute('title')?.trim());
          const type = input.getAttribute('type')?.toLowerCase();
          const hasAlt =
            input.tagName.toLowerCase() === 'input' &&
            type === 'image' &&
            Boolean(input.getAttribute('alt')?.trim());

          // Skip hidden controls and submit/button/reset inputs with native action labels.
          if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') {
            return false;
          }

          return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasAlt;
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
        return this.fail(
          `${formData.inputsWithoutLabels} form inputs missing labels (accessibility issue)`,
          formData
        );
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
        issues.push(
          `${tabIndexData.negativeTabIndexCount} elements with negative tabindex (removes from tab order)`
        );
      }

      if (tabIndexData.highTabIndexCount > 0) {
        issues.push(
          `${tabIndexData.highTabIndexCount} elements with positive tabindex (can disrupt natural tab order)`
        );
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
