/**
 * Named, per-rule-overridable thresholds for every checker's tunable judgment
 * calls (word-count minimums, size/length/count ceilings, percentage bands).
 *
 * Every constant here is a *default* — checkers read it via
 * `BaseChecker.threshold(ruleId, key, DEFAULT)` (src/checkers/base.ts), which
 * resolves a rule-level `options` override from config first and falls back
 * to the constant otherwise. Existence checks (`.length === 0`, HTTP status
 * comparisons) are intentionally not modeled here — they aren't tunable
 * judgment calls, they're presence/absence facts.
 *
 * Constants shared verbatim across files (their values already agreed before
 * this file existed) are named once and imported by every consumer, so a
 * future disagreement between them fails loudly instead of drifting silently
 * — the same reasoning that produced PAGE_LOAD_TIME_MS.
 */

/** Page load time (ms) above which a full-page-load check fails. Shared by performance.ts, coreWebVitals.ts, and mobileUX.ts. */
export const PAGE_LOAD_TIME_MS = 3000;

/** Inline <script>/<style> content length (chars) above which it's considered non-trivial. Shared by resourceOptimization.ts and coreWebVitals.ts. */
export const INLINE_CONTENT_NONTRIVIAL_LENGTH = 100;

// ---- content.ts ----
export const CONTENT_MIN_WORD_COUNT = 300;
export const CONTENT_EXCELLENT_WORD_COUNT = 1000;
export const FLESCH_VERY_EASY_SCORE = 80;
export const FLESCH_EASY_SCORE = 70;
export const FLESCH_FAIRLY_EASY_SCORE = 60;
export const FLESCH_STANDARD_SCORE = 50;
export const FLESCH_FAIRLY_DIFFICULT_SCORE = 30;
export const READABILITY_SHORT_WORD_MAX_LENGTH = 3;
export const CONTENT_STRUCTURE_MAX_ISSUES = 1;
export const TEXT_TO_HTML_MIN_RATIO_PERCENT = 10;
export const TEXT_TO_HTML_GOOD_RATIO_PERCENT = 25;

// ---- metaTags.ts ----
export const TITLE_MIN_LENGTH = 30;
export const TITLE_MAX_LENGTH = 60;
export const META_DESCRIPTION_MIN_LENGTH = 120;
export const META_DESCRIPTION_MAX_LENGTH = 160;

// ---- urlFactors.ts ----
export const URL_MAX_LENGTH = 100;
export const URL_WARN_LENGTH = 75;
export const URL_MIN_SEGMENT_LENGTH = 2;
export const URL_KEYWORD_MIN_LENGTH = 3;
export const URL_MAX_QUERY_PARAMS = 3;
export const URL_MAX_DEPTH = 4;
export const URL_WARN_DEPTH = 3;

// ---- headings.ts ----
export const HEADING_MAX_LENGTH = 70;

// ---- images.ts ----
export const IMAGE_MAX_COUNT = 50;

// ---- performance.ts ----
export const DOM_CONTENT_LOADED_WARN_SECONDS = 2;

// ---- technical.ts ----
export const HTML_SIZE_FAIL_KB = 200;
export const HTML_SIZE_WARN_KB = 100;

// ---- ecommerce.ts ----
export const PRODUCT_DESCRIPTION_MIN_LENGTH = 100;

// ---- accessibility.ts ----
export const MAX_NEGATIVE_TABINDEX_ELEMENTS = 5;

// ---- advancedImages.ts ----
export const IMAGE_EXTENSION_MIN_LENGTH = 2;
export const IMAGE_EXTENSION_MAX_LENGTH = 4;
export const RESPONSIVE_IMAGES_MIN_COUNT = 5;
export const RESPONSIVE_IMAGES_MIN_PERCENT = 50;
export const LAZY_LOAD_MIN_IMAGE_COUNT = 10;
export const MAX_IMAGES_WITHOUT_DIMENSIONS = 3;

// ---- resourceOptimization.ts ----
export const MIN_MINIFICATION_RATE_PERCENT = 50;
export const MAX_SEPARATE_SCRIPTS = 10;
export const MAX_SEPARATE_STYLESHEETS = 5;
export const MIN_MODERN_IMAGE_FORMAT_RATE_PERCENT = 50;
export const MODERN_IMAGE_FORMAT_MIN_IMAGE_COUNT = 5;
export const MIN_JS_OPTIMIZATION_RATE_PERCENT = 50;
export const MAX_THIRD_PARTY_RESOURCE_SHARE_PERCENT = 50;
export const MIN_CACHE_HEADER_RATE_PERCENT = 50;
export const MAX_TOTAL_INLINE_RESOURCE_BYTES = 50000;

// ---- mobileUX.ts ----
export const TAP_TARGET_MIN_SIZE_PX = 44;
export const MAX_UNDERSIZED_TAP_TARGETS = 5;
export const TAP_TARGET_MIN_SPACING_PX = 8;
export const MAX_CLOSE_TAP_TARGET_PAIRS = 10;
export const MOBILE_BODY_FONT_MIN_PX = 16;
export const MOBILE_SMALL_FONT_MAX_PX = 14;
export const MAX_SMALL_TEXT_ELEMENTS = 10;
export const MOBILE_RESPONSIVE_IMAGES_MIN_COUNT = 5;
export const MOBILE_REAL_CONTENT_MIN_LENGTH = 20;

// ---- heatmap.ts ----
export const HEATMAP_GOOD_CLICK_TARGET_WIDTH_PX = 100;
export const HEATMAP_GOOD_CLICK_TARGET_HEIGHT_PX = 40;
export const HEATMAP_MIN_GOOD_DISTRIBUTION_POINTS = 5;
export const HEATMAP_SCROLL_RATIO_MIN = 1;
export const HEATMAP_SCROLL_RATIO_MAX = 10;
export const HEATMAP_MIN_ELEMENT_SIZE_PX = 50;
export const HEATMAP_HERO_IMAGE_MIN_WIDTH_PX = 300;
export const HEATMAP_HERO_IMAGE_MIN_HEIGHT_PX = 200;
export const HEATMAP_MIN_F_PATTERN_COVERAGE = 3;
export const HEATMAP_CTA_TEXT_MAX_LENGTH = 20;
export const HEATMAP_H1_PROMINENCE_MIN_WIDTH_PX = 200;
export const HEATMAP_H1_PROMINENCE_MIN_HEIGHT_PX = 150;
export const HEATMAP_ABOVE_FOLD_TEXT_MIN_LENGTH = 20;
export const HEATMAP_MIN_ATTENTION_SCORE = 3;
export const HEATMAP_PARAGRAPH_CONTENT_MIN_LENGTH = 50;

// ---- coreWebVitals.ts (resource-heuristic checks; real CWV constants are added in Phase 9) ----
export const CWV_PAGE_LOAD_WARN_MS = 2000;
export const CWV_DOM_LOAD_TIME_FAIL_MS = 1500;
export const CWV_MAX_HTTP_REQUESTS = 100;
export const CWV_WARN_HTTP_REQUESTS = 50;
export const CWV_PAGE_SIZE_FAIL_BYTES = 3 * 1024 * 1024;
export const CWV_PAGE_SIZE_WARN_BYTES = 1 * 1024 * 1024;
export const CWV_JS_SIZE_FAIL_BYTES = 500 * 1024;
export const CWV_CSS_SIZE_FAIL_BYTES = 100 * 1024;
export const CWV_IMAGE_SIZE_FAIL_BYTES = 2 * 1024 * 1024;
export const CWV_MAX_FONT_FILES = 5;
export const CWV_MAX_RENDER_BLOCKING_SCRIPTS = 3;
export const CWV_MAX_RENDER_BLOCKING_STYLES = 2;
export const CWV_LAZY_LOAD_MIN_MEDIA_COUNT = 10;
export const CWV_MAX_BLOCKING_SCRIPTS = 3;
export const CWV_TTFB_FAIL_MS = 600;
export const CWV_TTFB_WARN_MS = 200;

// ---- spamDetection.ts ----
export const HIDDEN_TEXT_MIN_LENGTH = 20;
export const KEYWORD_STUFFING_MIN_COUNT = 15;
export const KEYWORD_STUFFING_MIN_DENSITY = 0.03;
export const MAX_LINK_COUNT = 100;
export const MAX_LINK_TO_WORD_RATIO = 0.1;
export const TINY_IFRAME_DIMENSION_PX = 10;
export const MAX_IFRAME_COUNT = 5;
export const INVISIBLE_ELEMENT_MIN_TEXT_LENGTH = 50;
export const MAX_INVISIBLE_ELEMENTS = 3;
export const MAX_TEXT_TO_LINK_RATIO = 0.6;
export const DUPLICATE_CONTENT_MIN_LENGTH = 50;
export const MAX_DUPLICATE_PARAGRAPHS = 2;
export const MAX_ADULT_KEYWORD_MATCHES = 2;
export const SPAM_KEYWORD_MIN_OCCURRENCES = 3;
export const MAX_SPAM_KEYWORD_TYPES = 3;
export const MIN_META_REFRESH_DELAY_SECONDS = 3;
export const TINY_TEXT_MAX_FONT_SIZE_PX = 5;
export const TINY_TEXT_MIN_TEXT_LENGTH = 20;
