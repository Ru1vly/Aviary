import { BaseChecker, BaseCheckerDeps, CheckOutcome } from './base';
import {
  HEATMAP_GOOD_CLICK_TARGET_WIDTH_PX,
  HEATMAP_GOOD_CLICK_TARGET_HEIGHT_PX,
  HEATMAP_MIN_GOOD_DISTRIBUTION_POINTS,
  HEATMAP_SCROLL_RATIO_MIN,
  HEATMAP_SCROLL_RATIO_MAX,
  HEATMAP_PARAGRAPH_CONTENT_MIN_LENGTH,
  HEATMAP_MIN_ELEMENT_SIZE_PX,
  HEATMAP_HERO_IMAGE_MIN_WIDTH_PX,
  HEATMAP_HERO_IMAGE_MIN_HEIGHT_PX,
  HEATMAP_MIN_F_PATTERN_COVERAGE,
  HEATMAP_CTA_TEXT_MAX_LENGTH,
  HEATMAP_H1_PROMINENCE_MIN_WIDTH_PX,
  HEATMAP_H1_PROMINENCE_MIN_HEIGHT_PX,
  HEATMAP_ABOVE_FOLD_TEXT_MIN_LENGTH,
  HEATMAP_MIN_ATTENTION_SCORE,
} from '../config/thresholds';

export interface HeatmapPoint {
  x: number;
  y: number;
  value: number;
  element?: string;
}

/**
 * A `getBoundingClientRect()` result as it actually survives serialization
 * across the `page.evaluate()` boundary — only the plain-object own
 * properties assigned below, not a real `DOMRect` (which doesn't survive
 * structured cloning with its prototype/methods intact).
 */
export interface ElementBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface HeatmapData {
  clickPrediction: HeatmapPoint[];
  scrollDepth: { depth: number; percentage: number }[];
  attentionZones: { selector: string; score: number; bounds: ElementBounds }[];
}

export interface HeatmapOptions {
  outputPath?: string;
  includeScrollMap?: boolean;
  includeClickMap?: boolean;
  includeAttentionMap?: boolean;
  simulateUserBehavior?: boolean;
}

export interface HeatmapCheckerDeps extends BaseCheckerDeps {
  options?: HeatmapOptions;
}

export class HeatmapChecker extends BaseChecker {
  private options: HeatmapOptions;

  constructor(deps: HeatmapCheckerDeps) {
    super(deps);
    this.options = {
      includeScrollMap: true,
      includeClickMap: true,
      includeAttentionMap: true,
      simulateUserBehavior: false,
      ...deps.options,
    };
  }

  protected checks() {
    const list: Array<{ id: string; run: () => Promise<CheckOutcome> }> = [];

    if (this.options.includeClickMap) {
      list.push({ id: 'click-heatmap-generated', run: () => this.generateClickHeatmap() });
    }
    if (this.options.includeScrollMap) {
      list.push({ id: 'scroll-depth-reasonable', run: () => this.analyzeScrollDepth() });
    }
    if (this.options.includeAttentionMap) {
      list.push({ id: 'attention-zones-strong', run: () => this.analyzeAttentionZones() });
    }
    list.push({ id: 'cta-above-fold', run: () => this.analyzeCTAPlacement() });
    list.push({ id: 'above-fold-content-strong', run: () => this.checkAboveFoldContent() });

    return list;
  }

  /**
   * Generate predictive click heatmap based on interactive elements
   */
  private async generateClickHeatmap(): Promise<CheckOutcome> {
    const goodTargetWidth = this.threshold(
      'click-heatmap-generated',
      'goodTargetWidthPx',
      HEATMAP_GOOD_CLICK_TARGET_WIDTH_PX
    );
    const goodTargetHeight = this.threshold(
      'click-heatmap-generated',
      'goodTargetHeightPx',
      HEATMAP_GOOD_CLICK_TARGET_HEIGHT_PX
    );
    const heatmapData = await this.page.evaluate(({ goodTargetWidth, goodTargetHeight }) => {
      // Get all interactive elements
      const interactiveSelectors = [
        'a', 'button', 'input', 'select', 'textarea',
        '[onclick]', '[role="button"]', '[role="link"]',
        '[tabindex]', '.btn', '.button', '.cta'
      ];

      const elements = document.querySelectorAll(interactiveSelectors.join(','));
      const points: { x: number; y: number; value: number; element: string }[] = [];

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Calculate center point
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2 + window.scrollY);

          // Calculate importance value based on element properties
          let value = 50;

          // Boost for buttons and CTAs
          if (el.tagName === 'BUTTON' || el.classList.contains('cta') || el.classList.contains('btn')) {
            value += 30;
          }

          // Boost for larger elements
          if (rect.width > goodTargetWidth && rect.height > goodTargetHeight) {
            value += 15;
          }

          // Boost for elements above the fold
          if (rect.top < window.innerHeight) {
            value += 20;
          }

          // Boost for prominent colors (approximation)
          const style = getComputedStyle(el);
          const bgColor = style.backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            value += 10;
          }

          points.push({
            x,
            y,
            value: Math.min(value, 100),
            element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}`
          });
        }
      });

      return {
        points,
        totalInteractive: elements.length,
        viewportHeight: window.innerHeight,
        pageHeight: document.documentElement.scrollHeight
      };
    }, { goodTargetWidth, goodTargetHeight });

    const minGoodDistributionPoints = this.threshold(
      'click-heatmap-generated',
      'minGoodDistributionPoints',
      HEATMAP_MIN_GOOD_DISTRIBUTION_POINTS
    );
    const hasGoodDistribution = heatmapData.points.length > minGoodDistributionPoints;
    const aboveFoldPoints = heatmapData.points.filter(
      (p: HeatmapPoint) => p.y < heatmapData.viewportHeight
    );

    return {
      passed: hasGoodDistribution && aboveFoldPoints.length > 0,
      message: hasGoodDistribution
        ? `Click heatmap generated: ${heatmapData.points.length} interactive elements found (${aboveFoldPoints.length} above fold)`
        : `Low interactive element count: ${heatmapData.points.length} elements found`,
      details: {
        totalPoints: heatmapData.points.length,
        aboveFoldPoints: aboveFoldPoints.length,
        topElements: heatmapData.points
          .sort((a: HeatmapPoint, b: HeatmapPoint) => b.value - a.value)
          .slice(0, 10),
        pageHeight: heatmapData.pageHeight,
        viewportHeight: heatmapData.viewportHeight,
      },
    };
  }

  /**
   * Analyze scroll depth and content distribution
   */
  private async analyzeScrollDepth(): Promise<CheckOutcome> {
    const paragraphMinLength = this.threshold(
      'scroll-depth-reasonable',
      'paragraphMinLength',
      HEATMAP_PARAGRAPH_CONTENT_MIN_LENGTH
    );
    const scrollData = await this.page.evaluate((paragraphMinLength) => {
      const pageHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const folds = Math.ceil(pageHeight / viewportHeight);

      // Analyze content at different scroll depths
      const depthAnalysis: { depth: number; percentage: number; contentScore: number }[] = [];

      for (let i = 0; i <= 100; i += 25) {
        const yPosition = (pageHeight * i) / 100;

        // Count visible elements at this depth
        const elementsAtDepth = document.elementsFromPoint(
          viewportHeight / 2,
          Math.min(yPosition, pageHeight - 1)
        );

        // Calculate content score based on element types
        let contentScore = 0;
        elementsAtDepth.forEach((el) => {
          if (['H1', 'H2', 'H3', 'IMG', 'VIDEO', 'BUTTON', 'A'].includes(el.tagName)) {
            contentScore += 10;
          }
          if (el.tagName === 'P' && el.textContent && el.textContent.length > paragraphMinLength) {
            contentScore += 5;
          }
        });

        depthAnalysis.push({
          depth: i,
          percentage: i,
          contentScore: Math.min(contentScore, 100),
        });
      }

      return {
        pageHeight,
        viewportHeight,
        folds,
        depthAnalysis,
        scrollRatio: pageHeight / viewportHeight,
      };
    }, paragraphMinLength);

    const scrollRatioMin = this.threshold('scroll-depth-reasonable', 'scrollRatioMin', HEATMAP_SCROLL_RATIO_MIN);
    const scrollRatioMax = this.threshold('scroll-depth-reasonable', 'scrollRatioMax', HEATMAP_SCROLL_RATIO_MAX);
    const isReasonableLength =
      scrollData.scrollRatio >= scrollRatioMin && scrollData.scrollRatio <= scrollRatioMax;
    const hasContentDistribution = scrollData.depthAnalysis.every(
      (d: { contentScore: number }) => d.contentScore > 0
    );

    return {
      passed: isReasonableLength,
      message: isReasonableLength
        ? `Page has ${scrollData.folds} folds (${scrollData.scrollRatio.toFixed(1)}x viewport height)`
        : `Page length may be suboptimal: ${scrollData.scrollRatio.toFixed(1)}x viewport height`,
      details: {
        pageHeight: scrollData.pageHeight,
        viewportHeight: scrollData.viewportHeight,
        folds: scrollData.folds,
        scrollRatio: scrollData.scrollRatio,
        depthAnalysis: scrollData.depthAnalysis,
        hasEvenContentDistribution: hasContentDistribution,
      },
    };
  }

  /**
   * Analyze attention zones using F-pattern and visual hierarchy
   */
  private async analyzeAttentionZones(): Promise<CheckOutcome> {
    const minElementSize = this.threshold(
      'attention-zones-strong',
      'minElementSizePx',
      HEATMAP_MIN_ELEMENT_SIZE_PX
    );
    const heroImageMinWidth = this.threshold(
      'attention-zones-strong',
      'heroImageMinWidthPx',
      HEATMAP_HERO_IMAGE_MIN_WIDTH_PX
    );
    const heroImageMinHeight = this.threshold(
      'attention-zones-strong',
      'heroImageMinHeightPx',
      HEATMAP_HERO_IMAGE_MIN_HEIGHT_PX
    );
    const attentionData = await this.page.evaluate(
      ({ minElementSize, heroImageMinWidth, heroImageMinHeight }) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Find high-attention elements
      const attentionElements: { selector: string; score: number; zone: string; bounds: ElementBounds }[] = [];

      // Headings
      document.querySelectorAll('h1, h2, h3').forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        let score = el.tagName === 'H1' ? 100 : el.tagName === 'H2' ? 80 : 60;

        // Boost if above fold
        if (rect.top < viewportHeight) {
          score += 20;
        }

        attentionElements.push({
          selector: `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`,
          score: Math.min(score, 100),
          zone: rect.top < viewportHeight * 0.6 ? 'hero-area' : 'below-fold',
          bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        });
      });

      // Images
      document.querySelectorAll('img').forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < minElementSize || rect.height < minElementSize) return;

        let score = 50;

        // Large images get more attention
        if (rect.width > heroImageMinWidth && rect.height > heroImageMinHeight) {
          score += 30;
        }

        // Above fold boost
        if (rect.top < viewportHeight) {
          score += 20;
        }

        attentionElements.push({
          selector: `img:nth-of-type(${i + 1})`,
          score: Math.min(score, 100),
          zone: rect.top < viewportHeight ? 'above-fold' : 'below-fold',
          bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        });
      });

      // CTAs and buttons
      document.querySelectorAll('button, .cta, .btn, a.button, [role="button"]').forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0) return;

        let score = 70;

        // Primary CTAs (usually larger, colored)
        const style = getComputedStyle(el);
        if (style.backgroundColor && style.backgroundColor !== 'transparent') {
          score += 15;
        }

        // Above fold boost
        if (rect.top < viewportHeight) {
          score += 15;
        }

        attentionElements.push({
          selector: `cta:nth-of-type(${i + 1})`,
          score: Math.min(score, 100),
          zone: rect.top < viewportHeight ? 'above-fold' : 'below-fold',
          bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        });
      });

      return {
        viewportWidth,
        viewportHeight,
        attentionElements: attentionElements.sort((a, b) => b.score - a.score).slice(0, 20),
        fPatternCoverage: attentionElements.filter((e) => e.zone === 'hero-area' || e.zone === 'above-fold').length,
        totalElements: attentionElements.length,
      };
      },
      { minElementSize, heroImageMinWidth, heroImageMinHeight }
    );

    const minFPatternCoverage = this.threshold(
      'attention-zones-strong',
      'minFPatternCoverage',
      HEATMAP_MIN_F_PATTERN_COVERAGE
    );
    const hasStrongHeroContent = attentionData.fPatternCoverage >= minFPatternCoverage;

    return {
      passed: hasStrongHeroContent,
      message: hasStrongHeroContent
        ? `Strong attention zones: ${attentionData.fPatternCoverage} high-priority elements above fold`
        : `Weak attention zones: Only ${attentionData.fPatternCoverage} high-priority elements above fold`,
      details: {
        topAttentionElements: attentionData.attentionElements.slice(0, 10),
        aboveFoldCount: attentionData.fPatternCoverage,
        totalAnalyzed: attentionData.totalElements,
        viewport: {
          width: attentionData.viewportWidth,
          height: attentionData.viewportHeight,
        },
      },
    };
  }

  /**
   * Analyze CTA placement and visibility
   */
  private async analyzeCTAPlacement(): Promise<CheckOutcome> {
    const ctaTextMaxLength = this.threshold(
      'cta-above-fold',
      'ctaTextMaxLength',
      HEATMAP_CTA_TEXT_MAX_LENGTH
    );
    const ctaData = await this.page.evaluate((ctaTextMaxLength) => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const ctaSelectors = [
        'button[type="submit"]',
        '.cta', '.btn-primary', '.btn-cta',
        'a.button', 'a.btn',
        '[data-cta]', '[role="button"]',
        'button:not([type="button"])',
      ];

      const ctas = document.querySelectorAll(ctaSelectors.join(','));
      const ctaAnalysis: { text: string; position: string; visible: boolean; score: number }[] = [];

      let primaryCTAAboveFold = false;

      ctas.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const text = el.textContent?.trim().substring(0, 50) || '';
        const isAboveFold = rect.top < viewportHeight;
        const isVisible = rect.top >= 0 && rect.left >= 0 && rect.right <= viewportWidth;

        if (isAboveFold && isVisible) {
          primaryCTAAboveFold = true;
        }

        // Score based on placement
        let score = 50;
        if (isAboveFold) score += 30;
        if (isVisible) score += 10;
        if (text.length > 0 && text.length < ctaTextMaxLength) score += 10; // Good CTA text length

        ctaAnalysis.push({
          text,
          position: isAboveFold ? 'above-fold' : 'below-fold',
          visible: isVisible,
          score: Math.min(score, 100),
        });
      });

      return {
        totalCTAs: ctas.length,
        primaryCTAAboveFold,
        ctaAnalysis: ctaAnalysis.sort((a, b) => b.score - a.score),
        hasCTAs: ctas.length > 0,
      };
    }, ctaTextMaxLength);

    const hasPrimaryCTA = ctaData.primaryCTAAboveFold;

    return {
      passed: hasPrimaryCTA,
      message: hasPrimaryCTA
        ? `Primary CTA found above fold (${ctaData.totalCTAs} total CTAs)`
        : ctaData.hasCTAs
          ? `No CTA above fold - ${ctaData.totalCTAs} CTAs found below fold`
          : 'No CTAs detected on page',
      details: {
        totalCTAs: ctaData.totalCTAs,
        primaryAboveFold: ctaData.primaryCTAAboveFold,
        topCTAs: ctaData.ctaAnalysis.slice(0, 5),
      },
    };
  }

  /**
   * Check above-the-fold content quality
   */
  private async checkAboveFoldContent(): Promise<CheckOutcome> {
    const heroImageMinWidth = this.threshold(
      'above-fold-content-strong',
      'heroImageMinWidthPx',
      HEATMAP_H1_PROMINENCE_MIN_WIDTH_PX
    );
    const heroImageMinHeight = this.threshold(
      'above-fold-content-strong',
      'heroImageMinHeightPx',
      HEATMAP_H1_PROMINENCE_MIN_HEIGHT_PX
    );
    const valuePropMinLength = this.threshold(
      'above-fold-content-strong',
      'valuePropMinLength',
      HEATMAP_ABOVE_FOLD_TEXT_MIN_LENGTH
    );
    const foldData = await this.page.evaluate(
      ({ heroImageMinWidth, heroImageMinHeight, valuePropMinLength }) => {
      const viewportHeight = window.innerHeight;

      const checks = {
        hasH1: false,
        hasHeroImage: false,
        hasCTA: false,
        hasValueProposition: false,
        contentDensity: 0,
      };

      // Check for H1 above fold
      const h1 = document.querySelector('h1');
      if (h1) {
        const rect = h1.getBoundingClientRect();
        checks.hasH1 = rect.top < viewportHeight && rect.bottom > 0;
      }

      // Check for hero image
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        const rect = img.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.width > heroImageMinWidth && rect.height > heroImageMinHeight) {
          checks.hasHeroImage = true;
        }
      });

      // Check for CTA
      const ctaElements = document.querySelectorAll('button, .cta, .btn, a.button');
      ctaElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.width > 0) {
          checks.hasCTA = true;
        }
      });

      // Check for value proposition (subheading or prominent text)
      const subheadings = document.querySelectorAll('h2, .subtitle, .tagline, [class*="hero"] p');
      subheadings.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < viewportHeight && el.textContent && el.textContent.length > valuePropMinLength) {
          checks.hasValueProposition = true;
        }
      });

      // Calculate content density
      const elementsAboveFold = document.querySelectorAll('h1, h2, h3, p, img, button, a');
      let aboveFoldCount = 0;
      elementsAboveFold.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
          aboveFoldCount++;
        }
      });
      checks.contentDensity = aboveFoldCount;

      return checks;
      },
      { heroImageMinWidth, heroImageMinHeight, valuePropMinLength }
    );

    const score = [
      foldData.hasH1,
      foldData.hasHeroImage,
      foldData.hasCTA,
      foldData.hasValueProposition,
    ].filter(Boolean).length;

    const minScore = this.threshold('above-fold-content-strong', 'minScore', HEATMAP_MIN_ATTENTION_SCORE);
    const passed = score >= minScore;

    return {
      passed,
      message: passed
        ? `Above-fold content is strong (${score}/4 key elements present)`
        : `Above-fold content needs improvement (${score}/4 key elements present)`,
      details: {
        hasH1AboveFold: foldData.hasH1,
        hasHeroImage: foldData.hasHeroImage,
        hasCTAAboveFold: foldData.hasCTA,
        hasValueProposition: foldData.hasValueProposition,
        contentDensity: foldData.contentDensity,
        score: `${score}/4`,
      },
    };
  }

  /**
   * Get raw heatmap data for external processing
   */
  async getHeatmapData(): Promise<HeatmapData> {
    return await this.page.evaluate(() => {
      const viewportHeight = window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;

      // Click prediction points
      const clickPrediction: { x: number; y: number; value: number; element: string }[] = [];
      const interactiveSelectors = ['a', 'button', 'input', '[onclick]', '[role="button"]', '.btn', '.cta'];

      document.querySelectorAll(interactiveSelectors.join(',')).forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          clickPrediction.push({
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2 + window.scrollY),
            value: el.tagName === 'BUTTON' ? 90 : 70,
            element: el.tagName.toLowerCase(),
          });
        }
      });

      // Scroll depth data
      const scrollDepth: { depth: number; percentage: number }[] = [];
      for (let i = 0; i <= 100; i += 10) {
        scrollDepth.push({ depth: (pageHeight * i) / 100, percentage: i });
      }

      // Attention zones
      const attentionZones: { selector: string; score: number; bounds: ElementBounds }[] = [];
      document.querySelectorAll('h1, h2, h3, img, button, .cta').forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) {
          attentionZones.push({
            selector: `${el.tagName.toLowerCase()}:nth-child(${i + 1})`,
            score: rect.top < viewportHeight ? 80 : 50,
            bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          });
        }
      });

      return { clickPrediction, scrollDepth, attentionZones };
    });
  }
}
