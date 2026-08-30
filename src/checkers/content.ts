import { BaseChecker, CheckOutcome } from './base';

export class ContentChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'word-count-adequate', run: () => this.checkWordCount() },
      { id: 'readability-acceptable', run: () => this.checkReadability() },
      { id: 'content-structure-present', run: () => this.checkContentStructure() },
      { id: 'text-to-html-ratio-acceptable', run: () => this.checkTextToHtmlRatio() },
    ];
  }

  private async checkWordCount(): Promise<CheckOutcome> {
    try {
      const content = await this.page.evaluate(() => {
        // Get main content, excluding script, style, nav, footer
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, nav, footer, header').forEach((el) => el.remove());
        return clone.innerText || '';
      });

      const words = content
        .trim()
        .split(/\s+/)
        .filter((word: string) => word.length > 0);
      const wordCount = words.length;

      if (wordCount < 300) {
        return this.fail(`Content is too short (${wordCount} words). Recommended: at least 300 words`, {
          wordCount,
        });
      } else if (wordCount >= 300 && wordCount < 1000) {
        return this.pass(`Good content length (${wordCount} words)`, { wordCount });
      } else {
        return this.pass(`Excellent content length (${wordCount} words)`, { wordCount });
      }
    } catch (error) {
      return this.fail(`Error checking word count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkReadability(): Promise<CheckOutcome> {
    try {
      const content = await this.page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, nav, footer, header').forEach((el) => el.remove());
        return clone.innerText || '';
      });

      // Calculate Flesch Reading Ease approximation
      const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
      const words = content
        .trim()
        .split(/\s+/)
        .filter((word: string) => word.length > 0);
      const syllables = words.reduce((acc: number, word: string) => acc + this.countSyllables(word), 0);

      if (sentences.length === 0 || words.length === 0) {
        return this.fail('Not enough content to calculate readability');
      }

      const avgWordsPerSentence = words.length / sentences.length;
      const avgSyllablesPerWord = syllables / words.length;

      // Flesch Reading Ease formula
      const fleschScore =
        206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

      let level: string;
      let passed = true;

      if (fleschScore >= 80) {
        level = 'Very Easy (5th grade)';
      } else if (fleschScore >= 70) {
        level = 'Easy (6th grade)';
      } else if (fleschScore >= 60) {
        level = 'Fairly Easy (7th-8th grade)';
      } else if (fleschScore >= 50) {
        level = 'Standard (10th-12th grade)';
      } else if (fleschScore >= 30) {
        level = 'Fairly Difficult (College)';
        passed = false;
      } else {
        level = 'Difficult (College Graduate)';
        passed = false;
      }

      return {
        passed,
        message: `Readability: ${level} (Flesch Score: ${Math.round(fleschScore)})`,
        details: {
          fleschScore: Math.round(fleschScore),
          level,
          avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
          avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
        },
      };
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Readability check skipped due to error' };
    }
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');

    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private async checkContentStructure(): Promise<CheckOutcome> {
    try {
      const structure = await this.page.evaluate(() => {
        const paragraphs = document.querySelectorAll('p');
        const lists = document.querySelectorAll('ul, ol');
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

        return {
          paragraphs: paragraphs.length,
          lists: lists.length,
          headings: headings.length,
        };
      });

      const issues: string[] = [];

      if (structure.paragraphs === 0) {
        issues.push('No paragraphs found');
      }
      if (structure.headings === 0) {
        issues.push('No headings found');
      }
      if (structure.lists === 0) {
        issues.push('Consider adding lists for better content structure');
      }

      if (issues.length === 0) {
        return this.pass('Content has good structural elements', structure);
      } else {
        return {
          passed: issues.length <= 1,
          message: issues.length === 1 ? issues[0] : `Content structure issues: ${issues.join(', ')}`,
          details: structure,
        };
      }
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Content structure check skipped due to error' };
    }
  }

  private async checkTextToHtmlRatio(): Promise<CheckOutcome> {
    try {
      const ratio = await this.page.evaluate(() => {
        const htmlSize = document.documentElement.outerHTML.length;
        const textContent = document.body.innerText || '';
        const textSize = textContent.length;

        return {
          htmlSize,
          textSize,
          ratio: htmlSize > 0 ? (textSize / htmlSize) * 100 : 0,
        };
      });

      const ratioPercent = Math.round(ratio.ratio);

      if (ratioPercent < 10) {
        return this.fail(`Low text-to-HTML ratio (${ratioPercent}%). Page may have too much code`, ratio);
      } else if (ratioPercent >= 25) {
        return this.pass(`Excellent text-to-HTML ratio (${ratioPercent}%)`, ratio);
      } else {
        return this.pass(`Acceptable text-to-HTML ratio (${ratioPercent}%)`, ratio);
      }
    } catch (error) {
      return { passed: false, severity: 'info', message: 'Text-to-HTML ratio check skipped due to error' };
    }
  }
}
