# SEO Checker Tool - Accuracy Limitations

**Last Updated:** 2026-08-30

## Overview

This document provides transparency about the aviary tool's accuracy limitations, known issues, and areas where manual verification is recommended.

**Important:** This tool is designed to identify *potential* SEO issues. Not all findings indicate actual problems, and the tool cannot catch every SEO issue. Always apply professional judgment when interpreting results.

---

## 1. Previously Fixed Issues

### 1.1 Previously Disabled Checks ✅ FIXED

The following checks were disabled in earlier versions but have been re-enabled:

| Check | Location | Status | Description |
|-------|----------|--------|-------------|
| **Response Code Validation** | Technical Checker | ✅ Fixed | Now properly checks HTTP status codes (200, 404, 500, etc.) |
| **Compression Detection** | Technical Checker | ✅ Fixed | Detects gzip, brotli, and deflate compression |
| **Security Headers** | Security Checker | ✅ Fixed | Validates HSTS, X-Frame-Options, CSP, X-Content-Type-Options |
| **Cache Headers** | Core Web Vitals | ✅ Fixed | Checks Cache-Control, ETag, Expires headers |

**Previous Behavior:** These checks always returned `passed: true` even when issues existed.

**Fix:** The tool now captures the initial HTTP response during navigation and passes it to all checkers that need HTTP headers, eliminating the execution context destruction issue.

### 1.2 Image Format Parsing Bug ✅ FIXED

**Previous Issue:** Image format detection showed invalid formats like:
- `co/67x84/d2df5b/656f10`
- `co/1044x532/9ca3af/374151`

These were from placeholder/data URLs that weren't properly filtered.

**Fix:** Enhanced image format extraction to:
1. Skip data URLs and placeholders
2. Properly parse file extensions from URLs
3. Detect WebP, AVIF, and other modern formats
4. Fallback to MIME type when extension unavailable

### 1.3 Hidden Text Detection Improvements ✅ PARTIALLY FIXED

**Previous Issue:** Legitimate content was flagged as "hidden text spam":
- Collapsed accordions
- Tab content
- Off-screen navigation
- Truncated text with "read more" buttons

**Fix:** Updated hidden text detection to:
1. Ignore common UI patterns (accordions, tabs, modals) on direct parents
2. Check for legitimate accessibility hiding (screen readers)
3. Reduce false positives for content overflow
4. Only flag truly suspicious hiding techniques

---

## 2. Inherent Limitations & Code Bugs (Heuristic-Based)

These checks use statistical models or heuristics that cannot be 100% accurate, or contain specific implementation bugs:

### 2.1 Readability Scores (~85% accurate)

**Check:** Content Readability (Flesch-Kincaid, Gunning Fog)

**Limitation:**
- Based on syllable counting and sentence length
- Cannot understand context or domain complexity
- Medical/legal content will score poorly despite being appropriate
- Creative writing may score unexpectedly

**Recommendation:** Use as a guideline, not absolute rule. Consider your target audience's education level.

### 2.2 Spam Detection (~60% accurate)

**Check:** Spam Patterns, Keyword Stuffing, Hidden Text

**Limitation & Code Bugs:**
- Pattern-based detection has false positives
- Cannot understand intent
- **Shallow DOM Hidden Text check bug:** In `spamDetection.ts`, the `isLegitimateHidden()` function only evaluates the hidden element itself and its direct parent (`el.parentElement`) for accordion or collapse framework classes. In Tailwind and Bootstrap components, interactive container classes (such as `.collapse` or `.accordion`) are often located on higher ancestors. Because the checker does not traverse up the DOM tree, it flags these legitimate hidden elements as potential hidden text spam.
- **Keyword density** thresholds are heuristic-based
- Industry-specific terminology may be flagged as repetitive

**Known False Positives:**
- Product descriptions with natural keyword repetition
- Legal disclaimers with repeated terms
- Multi-language content
- Lists of similar items (product catalogs)

**Recommendation:** Manually review flagged items. High spam scores (>70%) are more reliable.

### 2.3 Content Quality Assessment (~70% accurate)

**Check:** Content Depth, Uniqueness, Structure

**Limitation & Code Bugs:**
- Cannot judge factual accuracy
- Cannot assess expertise or authority
- **Regulatory Auditing Omission Gap:** In `legalCompliance.ts`, the checks for GDPR and CCPA return `passed: true` if their respective compliance terms are missing. This means if a site completely lacks a privacy policy or regulatory statements, the checker still passes instead of warning or failing.

**What It Can Detect:**
- ✅ Thin content (word count)
- ✅ Poor structure (headings)
- ✅ Missing key elements

**What It Cannot Detect:**
- ❌ Plagiarism from other sites
- ❌ Factual errors
- ❌ Content relevance to search intent
- ❌ E-A-T signals (Expertise, Authority, Trust)

### 2.4 Mobile Usability & Heatmaps (~75% accurate)

**Check:** Tap Target Size, Viewport Configuration, Scroll Depth

**Limitation & Code Bugs:**
- 44px tap target rule is a guideline (WCAG 2.5.5)
- Viewport simulation vs. actual device behavior
- **Scroll Depth Coordinate Bug:** In `heatmap.ts`, the scroll depth content density checker uses the document-relative vertical offset `yPosition` inside `document.elementsFromPoint()`. Because `elementsFromPoint` expects viewport-relative client coordinates, passing any coordinate that exceeds the viewport height (`yPosition > viewportHeight`) returns an empty array. This breaks the density scoring calculation for pages taller than the viewport height.

**Recommendation:** Test on real devices for critical pages.

---

## 3. Client-Side Architectural Limitations

These limitations stem from the tool running in a browser context:

### 3.1 Network Timing Variability

**Limitation:**
- Performance metrics vary per run
- Network conditions affect results
- Geographic location matters

**Recommendation:**
- Run multiple checks and average results
- Use dedicated performance tools (Lighthouse, WebPageTest) for detailed analysis

### 3.2 JavaScript Execution Required

**Limitation:**
- Only sees what JavaScript renders
- Cannot test "JavaScript disabled" experience
- May miss noscript content

### 3.3 Cannot Verify Actual Indexing

**Limitation:**
- Tool checks *if* page is indexable, not if it's *indexed*
- Cannot verify Google's actual index status

### 3.4 Core Web Vitals Measurement Approximations

The **Core Web Vitals** category (`coreWebVitals`) measures real LCP, CLS, FCP, and TTFB via the standard `web-vitals` library, injected into the page before navigation so its observers can see load-time entries. Two disclosed approximations follow directly from running as an unattended, single-shot audit rather than a real browser session:

- **Latest-value, not final-value.** `web-vitals` normally reports a metric's *final* value when the page is navigated away from or the tab is hidden — neither ever happens here, since the audit closes the browser outright. Metrics are instead collected with `reportAllChanges: true` and read at the same point every other checker reads the page (after `networkidle` plus a stability wait). For a page that has finished loading, this is normally the same value a real session would report, but it isn't guaranteed down to the millisecond.
- **No real INP — Total Blocking Time substitutes.** INP (Interaction to Next Paint) requires a real user interaction (click, tap, keypress) to measure, and this audit never interacts with the page — there's no honest way to synthesize one. Rather than fabricate an interaction to claim an "INP" number, the `total-blocking-time-acceptable` check reports Total Blocking Time (summed `longtask` entries over the 50ms threshold) as a disclosed lab proxy for interactivity — the same substitution Lighthouse makes, and for the same reason.

---

## 4. Missing Production Features & Hidden Behaviors

Not yet implemented, or undocumented CLI behaviors worth knowing about:

- ❌ **Parallel URL checking** (checking multiple URLs in one run)
- ❌ **Caching mechanisms** (reusing results from previous runs)
- ❌ **Lighthouse integration** (Google's official tool)
- ❌ **Google Search Console API integration**
- ❌ **Historical data tracking and trend analysis**

### 4.1 Missing OpenAI Provider in Rust Engine

- `.env.example` lists `openai` as a valid value for `AVIARY_LLM_PROVIDER`, but `engine/src/semantic/factory.rs` only implements `ollama` and `stub`. Setting the provider to `openai` silently falls back to the `StubAnalyzer` rather than erroring.

### 4.2 Prometheus Metrics Server Starts on Import

- Importing the CLI registers and starts a Prometheus metrics server (`prom-client`), configurable via `AVIARY_METRICS_PORT` (default `9090`). It starts silently in the background as a side effect of import rather than an explicit opt-in, which can surprise anything embedding `src/cli.ts` as a library and may conflict with another local service already on that port.

---

## 5. Known False Positives by Category

### 5.1 Meta Tags & SEO Basics (95% accurate)

**Rare False Positives:**
- Brand information in non-standard meta tags
- Alternative meta tag implementations (custom CMS)
- Structured data in non-JSON-LD formats

### 5.2 Structured Data (90% accurate)

**Known Issues:**
- May flag valid but uncommon schema types
- Nested schema validation can be overly strict
- Custom schema extensions may not validate

### 5.3 Performance Metrics (85% accurate)

**Known Issues:**
- Network timing varies ±20% per run; a single-run measurement may not represent typical performance
- Doesn't account for CDN edge caching
- First visit vs. cached visit differences
- Cannot detect server-side rendering optimizations or HTTP/2 push resources

**Recommendation:** Run multiple checks and cross-reference with a dedicated tool (Lighthouse, PageSpeed Insights, WebPageTest) for production analysis.

### 5.4 Accessibility (80% accurate)

**Known Issues:**
- Color contrast calculation doesn't account for gradients
- ARIA validation may flag valid custom implementations
- Cannot evaluate alt text *quality*, only presence
- Cannot test keyboard navigation flows or verify actual screen reader compatibility
- May miss dynamically loaded content

**Recommendation:** Supplement with manual testing using an actual screen reader and keyboard-only navigation.

### 5.5 Image Optimization (75% accurate)

**Known Issues:**
- Cannot verify actual compression quality
- **CDN Format Detection Limit:** CDNs like Cloudinary are not automatically recognized as `'dynamic'` in the TS `cdnPatterns` array (`src/checkers/advancedImages.ts`). Only common placeholder sites (e.g. `placehold.co`, `dummyimage.com`) are correctly categorized as dynamic placeholders. Other CDNs fall back to raw file extensions or are marked as `'unknown'`.

### 5.6 Spam Detection (60% accurate)

**High False Positive Rate:**
- Product descriptions with natural keyword density
- Technical documentation with repeated terms
- Legal disclaimers
- Interactive elements inside nested container components (accordion, collapse, modal) due to shallow DOM traversal limit.

---

## 6. Accuracy Estimates by Check Type

| Check Category | Accuracy | Confidence Level | Notes |
|---------------|----------|------------------|-------|
| Meta Tags | ~95% | High | Straightforward DOM parsing |
| Heading Structure | ~95% | High | Clear hierarchy rules |
| HTTPS/Security | ~90% | High | Binary checks (present/absent) |
| Structured Data | ~90% | High | Schema.org validation |
| Response Codes | ~90% | High | HTTP standard compliance |
| Compression | ~90% | High | Header presence check |
| Performance Metrics | ~85% | Medium | Network variability |
| Accessibility | ~80% | Medium | Complex WCAG rules |
| Mobile Usability | ~75% | Medium | Viewport relative scroll depth bug |
| Image Optimization | ~75% | Medium | CDN detection limitations |
| Content Quality | ~70% | Medium | Regulatory compliance gap |
| Spam Detection | ~60% | Low | Shallow DOM check, false positives |
| Readability | ~70% | Low | Statistical estimation |

---

## 7. Best Practices for Using This Tool

### 7.1 Interpretation Guidelines

1. **Errors (Red):** Address these - likely real issues
2. **Warnings (Yellow):** Review manually - may be false positives
3. **Info (Blue):** Suggestions - consider for optimization

### 7.2 Verification Workflow

For critical findings:

1. ✅ Run check 2-3 times to confirm consistency
2. ✅ Cross-reference with official tools (Google Search Console, Rich Results Test)
3. ✅ Manual inspection in browser DevTools
4. ✅ Test on real devices (mobile checks)

### 7.3 Priority-Based Actions

**High Priority (Fix Immediately):**
- ✅ Missing title/meta description
- ✅ Broken HTTPS/mixed content
- ✅ 404/500 response codes
- ✅ Mobile viewport not set
- ✅ No robots.txt

**Medium Priority (Review & Fix):**
- ⚠️ Missing structured data
- ⚠️ Slow performance metrics
- ⚠️ Accessibility violations
- ⚠️ Missing alt attributes
- ⚠️ Broken links

**Low Priority (Consider Optimization):**
- ℹ️ Image format suggestions
- ℹ️ Readability improvements
- ℹ️ Additional schema markup
- ℹ️ Content length recommendations

---

## 8. Reporting Issues

If you encounter false positives or inaccurate checks:

1. **Verify:** Is this actually incorrect?
2. **Report:** Create GitHub issue with tested URL, failed check, and expected behavior.

**GitHub Issues:** [https://github.com/Ru1vly/e2e-seo/issues](https://github.com/Ru1vly/e2e-seo/issues)

---

## 9. Conclusion

**The aviary tool is most accurate for:**
- ✅ Technical SEO fundamentals (meta tags, headers)
- ✅ Structural issues (headings, links)
- ✅ Basic accessibility
- ✅ HTTPS/security checks
- ✅ Structured data validation

**Use with caution for:**
- ⚠️ Spam detection (shallow DOM checking)
- ⚠️ Content quality assessment (subjective and regulatory gaps)
- ⚠️ Performance metrics (network variability)
- ⚠️ Readability scores (domain-dependent)
- ⚠️ Heatmaps & Scroll depth (pages taller than viewport height)

---

*This document will be updated as the tool evolves and accuracy improves.*
