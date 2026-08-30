import { HeadingStructure } from '../types';
import { BaseChecker, CheckOutcome } from './base';

export class HeadingsChecker extends BaseChecker {
  protected checks() {
    return [
      // presets.ts models "H1 exists" and "H1 count valid" as two separate
      // rules, but the underlying logic has always been one pass validating
      // that exactly one H1 is present — 'h1-count-valid' is the more
      // accurate single name for what this check does (0 and >1 are both
      // invalid counts), matching Sweep 1's "name what actually exists"
      // precedent from performance.ts rather than splitting the check.
      { id: 'h1-count-valid', run: () => this.checkH1() },
      { id: 'heading-hierarchy-valid', run: () => this.checkHeadingHierarchy() },
      { id: 'heading-length-acceptable', run: () => this.checkHeadingLength() },
    ];
  }

  private headingsPromise?: Promise<HeadingStructure[]>;

  private getHeadings(): Promise<HeadingStructure[]> {
    if (!this.headingsPromise) {
      this.headingsPromise = this.page.evaluate(() => {
        const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const headings: HeadingStructure[] = [];

        headingTags.forEach((tag) => {
          const elements = Array.from(document.querySelectorAll(tag));
          elements.forEach((el) => {
            headings.push({
              tag,
              text: el.textContent?.trim() || '',
              level: parseInt(tag.substring(1)),
            });
          });
        });

        return headings.sort((a, b) => {
          const aIndex = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).findIndex(
            (el) => el.textContent?.trim() === a.text
          );
          const bIndex = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).findIndex(
            (el) => el.textContent?.trim() === b.text
          );
          return aIndex - bIndex;
        });
      });
    }
    return this.headingsPromise;
  }

  private async checkH1(): Promise<CheckOutcome> {
    const headings = await this.getHeadings();
    const h1s = headings.filter((h) => h.level === 1);

    if (h1s.length === 0) {
      return this.fail('No H1 heading found on the page');
    }

    if (h1s.length > 1) {
      return this.fail(`Multiple H1 headings found (${h1s.length}). Best practice: use only one H1 per page`, {
        h1s,
      });
    }

    return this.pass('Single H1 heading found', { h1: h1s[0] });
  }

  private async checkHeadingHierarchy(): Promise<CheckOutcome> {
    const headings = await this.getHeadings();
    const issues: string[] = [];

    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const curr = headings[i];

      if (curr.level > prev.level + 1) {
        issues.push(
          `Skipped heading level: ${prev.tag} followed by ${curr.tag} ("${curr.text.substring(0, 50)}...")`
        );
      }
    }

    if (issues.length > 0) {
      return this.fail('Heading hierarchy has issues', { issues, headings });
    }

    return this.pass(`Heading hierarchy is properly structured (${headings.length} headings)`, { headings });
  }

  private async checkHeadingLength(): Promise<CheckOutcome> {
    const headings = await this.getHeadings();
    const longHeadings = headings.filter((h) => h.text.length > 70);

    if (longHeadings.length > 0) {
      return this.fail(`${longHeadings.length} heading(s) are too long (>70 characters)`, { longHeadings });
    }

    return this.pass('All headings are of appropriate length');
  }
}
