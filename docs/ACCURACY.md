# Accuracy Limitations & Recommendations

This document outlines the known accuracy limitations of the E2E SEO Checker tool and provides guidance on when manual verification is recommended.

## Overview

The E2E SEO Checker is designed to automate SEO analysis, but like all automated tools, it has inherent limitations. Understanding these limitations will help you interpret results correctly and know when manual verification is necessary.

## Accuracy by Category

### Meta Tags & Headings: ~95% Accurate

**What works well:**
- Detecting presence/absence of title, description, and meta tags
- Measuring length and character counts
- Identifying duplicate headings
- Checking heading hierarchy

**Known limitations:**
- Cannot evaluate semantic quality or relevance
- Cannot determine if content matches user intent
- May not detect dynamically injected meta tags in complex SPAs (handled via fallback rendering)
- **Engine Threshold Discrepancy:** The TypeScript checker expects titles of **30-60 characters** and descriptions of **120-160 characters**. The Rust crawler engine uses different limits (**10-60 characters** for titles, and **50-160 characters** for descriptions).

**Recommendation:** Always manually review meta tag content for quality and relevance.

### Performance Metrics: ~85% Accurate

**What works well:**
- Measuring page load time and DOM ready time
- Counting HTTP requests
- Detecting render-blocking resources
- Analyzing resource sizes

**Known limitations:**
- Network-dependent (varies per run based on connection speed)
- Cannot detect server-side rendering optimizations
- Misses HTTP/2 push resources
- Cache state affects measurements
- Single-run measurements may not represent typical performance

**Recommendation:** Run multiple tests and use additional tools like Google Lighthouse or PageSpeed Insights for production analysis.

### Accessibility: ~80% Accurate

**What works well:**
- Detecting missing alt text
- Checking ARIA attributes
- Validating color contrast ratios
- Identifying form label issues

**Known limitations:**
- Cannot evaluate alt text quality (only presence)
- Complex ARIA patterns may be misinterpreted
- Cannot test keyboard navigation flows
- May miss dynamically loaded content
- Cannot verify screen reader compatibility

**Recommendation:** Supplement with manual testing using actual screen readers and keyboard-only navigation.

### Structured Data: ~90% Accurate

**What works well:**
- Detecting JSON-LD, Microdata, and RDFa
- Validating Schema.org vocabulary
- Checking for required properties

**Known limitations:**
- Cannot verify if data matches actual page content
- May not detect all validation errors that Google's Rich Results Test would find
- Cannot predict if rich results will actually appear in search

**Recommendation:** Validate critical structured data using Google's Rich Results Test tool.

### Spam Detection: ~60% Accurate (Higher False Positive Rate)

**What works well:**
- Detecting obvious spam patterns
- Identifying excessive links (>100 links or >10% link-to-word count ratio)
- Finding suspicious scripts

**Known limitations:**
- **Hidden text detection** may flag legitimate UI components:
  - Accordions and collapsible sections
  - Tab panels and carousels
  - Modal dialogs and dropdowns
  - Screen reader-only text
- **Shallow DOM Traversal Bug:** The `isLegitimateHidden` helper only checks the hidden element itself and its direct parent (`el.parentElement`) for framework collapse/accordion classes. In Tailwind and Bootstrap components, interactive container classes (such as `.collapse` or `.accordion`) are often located on higher ancestors. Because the checker does not traverse up the DOM tree, it flags these legitimate hidden elements as potential hidden text spam.
- **Keyword density** thresholds are heuristic-based (flags words that appear >15 times and represent >3% of total page word count)
- Industry-specific terminology may be flagged as repetitive

**Recent improvements (v1.1.0):**
- Enhanced detection excludes elements with ARIA attributes
- Filters out common UI framework patterns (Bootstrap, Tailwind, etc.) on direct parents
- Checks for data-* attributes used in interactive components

**Recommendation:** Manually review all spam detection warnings, especially for sites with rich interactive UIs.

### Image Analysis: ~85% Accurate

**What works well:**
- Detecting missing alt attributes
- Counting images
- Checking for lazy loading attributes
- Validating image dimensions in markup

**Known limitations:**
- **CDN Format Detection Limit:** Although format detection was improved in v1.1.0, CDNs like Cloudinary are not automatically recognized as `'dynamic'` in the TS `cdnPatterns` array. Only common placeholder sites (e.g., `placehold.co` and `dummyimage.com`) are correctly categorized as dynamic placeholders. Other CDNs fall back to raw file extensions or are marked as `'unknown'`.
- Cannot measure actual file sizes (only transfer sizes)
- Cannot determine visual quality
- Cannot verify if images are actually optimized

**Recommendation:** Use specialized image optimization tools for production sites.

### Content Quality & Regulatory Audit: ~70% Accurate

**What works well:**
- Word count and content length (fails if under 300 words)
- Readability scores (Flesch-Kincaid Reading Ease, fails if under 50)
- Text-to-HTML ratio (fails if under 10%)

**Known limitations:**
- **Readability scores** are statistical estimates, not absolute measures. Non-English content may have inaccurate readability scores.
- Cannot evaluate content accuracy or usefulness
- Cannot determine E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
- **Regulatory Auditing Compliance Gap:** In `legalCompliance.ts`, the checks for GDPR and CCPA return `passed: true` if their respective compliance terms are missing. This means if a site completely lacks a privacy policy or regulatory statements, the checker still passes instead of warning or failing.

**Recommendation:** Have human editors review content for quality, accuracy, and user value.

### Mobile Usability & Heatmaps: ~75% Accurate

**What works well:**
- Detecting viewport configuration
- Checking tap target sizes
- Identifying responsive image usage

**Known limitations:**
- 44×44px tap target rule is a guideline, not absolute
- Cannot test actual touch interaction
- Cannot verify responsive design breakpoints
- **Scroll Depth Coordinate Bug:** In `heatmap.ts`, the scroll depth content density checker uses the document-relative vertical offset `yPosition` inside `document.elementsFromPoint()`. Because `elementsFromPoint` expects viewport-relative client coordinates, passing any coordinate that exceeds the viewport height (`yPosition > viewportHeight`) returns an empty array. This breaks the density scoring calculation for pages taller than the viewport height.

**Recommendation:** Test on actual mobile devices in addition to using this tool.

## Client-Side Limitations

The tool runs in a headless browser and only sees what JavaScript renders. This means:

### What it CAN detect:
- Client-side rendered content
- JavaScript-injected elements
- Single Page Application (SPA) content after initial render

### What it CANNOT detect:
- Server-side rendering optimizations
- Progressive enhancement strategies
- Crawl-time behavior differences
- How search engine bots render the page
- Actual Google indexing status

**Recommendation:** Use Google Search Console to verify how Google actually sees and indexes your pages.

## HTTP Header Checks: Now Accurate (v1.1.0)

**Previously disabled checks now working:**
- ✅ Security headers (Strict-Transport-Security, X-Content-Type-Options, etc.)
- ✅ Response code validation (200, 301, 404, 500 detection)
- ✅ Compression checks (gzip, brotli, deflate)
- ✅ Cache headers (Cache-Control, Expires, ETag)

**How it works:**
- Captures initial HTTP response during navigation
- No longer reloads the page (was causing execution context issues)

## Missing Production Features & Hidden Behaviors

The following features are planned but not yet implemented, or represent hidden CLI behaviors:

- ❌ **Parallel URL checking** (checking multiple URLs simultaneously)
- ❌ **Caching mechanisms** (results from previous runs)
- ❌ **Lighthouse integration** (Google's official tool)
- ❌ **Google Search Console API integration**
- ❌ **Historical data tracking and trend analysis**
- ❌ **Missing OpenAI Provider in Rust Engine:** Setting `AVIARY_LLM_PROVIDER` to `openai` defaults to the Stub Analyzer because only `ollama` and `stub` are implemented in `engine/src/semantic/factory.rs`.
- ⚠️ **Silent Prometheus Metrics Server:** Importing the CLI silently registers and starts a Prometheus metrics server on port `9090`. This port binds silently in the background, which may conflict with other local monitoring services.
- ⚠️ **MCP Redaction Logic:** The Model Context Protocol (MCP) server sanitizes output using `sanitizeOutput()`. If audit payloads contain keywords like `<script`, `javascript:`, `onload=`, or SQL statements (`union select`, `drop table`), the server redacts the entire output with `[REDACTED: Potential Security Payload Detected]`.

---

## Accuracy Estimates Summary

| Check Category | Accuracy | False Positive Rate | Manual Verification Needed |
|----------------|----------|---------------------|----------------------------|
| Meta Tags | 95% | Low | Medium |
| Headings | 95% | Low | Low |
| Images | 85% | Low | Medium |
| Performance | 85% | Low | High |
| Accessibility | 80% | Medium | High |
| Structured Data | 90% | Low | Medium |
| Content Quality | 70% | Medium | High |
| Spam Detection | 60% | High | Very High |
| Mobile Usability | 75% | Medium | High |
| HTTP Headers | 95% | Low | Low |

## When to Trust the Tool

**High confidence (manual verification rarely needed):**
- Missing meta tags
- Missing alt attributes
- Broken heading hierarchy
- HTTP status codes
- Security headers
- Compression status

**Medium confidence (spot-check recommended):**
- Image format detection (for non-placeholder CDNs)
- Performance metrics
- Mobile usability
- Structured data validation

**Low confidence (always verify manually):**
- Spam detection warnings (due to shallow DOM checking)
- Content quality scores
- Readability metrics
- Keyword optimization
- Regulatory GDPR/CCPA audits (due to omission logic gap)

## Reporting Issues

If you encounter inaccurate results or false positives, please report them:

1. Provide the URL being tested
2. Describe the expected vs. actual result
3. Include screenshots if applicable
4. Note any special circumstances (SPA, dynamic content, etc.)

Report issues at: [GitHub Issues](https://github.com/yourusername/aviary/issues)

## Changelog

### v1.1.0 (Current)
- ✅ Fixed: Security headers check now working (previously disabled)
- ✅ Fixed: Response code validation now working (previously disabled)
- ✅ Fixed: Compression check now working (previously disabled)
- ✅ Fixed: Cache headers check now working (previously disabled)
- ✅ Improved: Image format parsing now handles CDN URLs correctly (placeholder CDNs detected)
- ✅ Improved: Spam detection now filters out legitimate UI patterns (on direct parents)

### v1.0.0
- Initial release with known limitations in HTTP header checks

---

**Remember:** This tool is designed to complement, not replace, human judgment and other SEO tools. Use it as part of a comprehensive SEO strategy that includes manual testing, user feedback, and real-world metrics.
