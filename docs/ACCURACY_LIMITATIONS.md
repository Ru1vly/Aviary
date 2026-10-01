# SEO Checker Tool - Accuracy Limitations

**Last Updated:** 2026-10-01

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
| **Security Headers** | Security Checker | ✅ Fixed | Checks header presence and basic HSTS, X-Frame-Options, CSP syntax, and X-Content-Type-Options values; it does not prove the full CSP is safe |
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

### 1.4 Trust-of-Analysis Bug Sweep (2026-09-06) ✅ FIXED

Found by empirically running the tool against real sites (books.toscrape.com, demo.vercel.store) and hand-verifying flagged results against the raw DOM, then sweeping the rest of the codebase for the same two bug shapes:

**Duplicated detection logic that had drifted out of sync** (the same underlying fact re-derived independently by two checks, with no shared source of truth):

| Facts | Checks involved | Was | Fix |
|---|---|---|---|
| Charset declaration | `internationalization.ts`: `charset-utf8`, `unicode-support-utf8` | `unicode-support-utf8` only checked `meta[charset]`, false-failing pages (confirmed on books.toscrape.com) that declare charset via the older `<meta http-equiv="Content-Type" content="...;charset=...">` form | Both call `shared/dom.ts`'s new `getCharset()` |
| Viewport directives | `mobileUX.ts`, `uiElements.ts`, `pageQuality.ts` | `mobileUX.ts` failed on `maximum-scale` (zoom lock); `uiElements.ts` never checked for it at all, silently passing the same tag | All three parse via `shared/dom.ts`'s new `parseViewportMeta()` (each keeps its own pass/fail policy) |
| Open Graph tags | `metaTags.ts` (`og-tags-configured`), `socialMedia.ts` (`open-graph-configured`) | Each hand-rolled its own `querySelectorAll('meta[property^="og:"]')` | Both call `shared/dom.ts`'s new `extractOgTags()` |
| HTTPS/protocol | `ecommerce.ts`, `legalCompliance.ts` | Each duplicated `window.location.protocol === 'https:'` in a browser `evaluate()` | Both now use `shared/dom.ts`'s new `isHttpsUrl(this.page.url())`, matching `security.ts`'s existing Node-side technique |

**Check-id collisions** (two checkers registering the same rule id with different pass/fail criteria — since a rule id becomes a result's `name`, this conflates two different verdicts under one label in any flat, cross-checker view of a report):

| Id | Checkers | Fix |
|---|---|---|
| `product-schema-complete` | `schemaValidation.ts`, `ecommerce.ts` | Renamed ecommerce.ts's to `ecommerce-product-schema-complete` |
| `dom-content-loaded-acceptable` | `performance.ts`, `coreWebVitals.ts` | Renamed coreWebVitals.ts's to `cwv-dom-content-loaded-acceptable` |
| `page-size-acceptable` | `technical.ts` (raw HTML size), `coreWebVitals.ts` (total page weight) | Renamed coreWebVitals.ts's to `cwv-page-size-acceptable` |
| `resource-hints-present` | `resourceOptimization.ts`, `coreWebVitals.ts` | Renamed coreWebVitals.ts's to `cwv-resource-hints-present` |

A new test (`tests/unit/registry.test.ts`) now asserts no two checkers registered on `BaseChecker` share a rule id, so this bug class can't reappear silently.

**Sibling/descendant text-measurement bug** (confirmed false negative): `ecommerce.ts`'s `checkProductDescription` summed `textContent.length` only over the *descendants* of elements matched by `[class*="description"]`/`[id*="description"]`. On books.toscrape.com, the matched container (`<div id="product_description">`) holds only a heading — the actual paragraph is a DOM *sibling*, not a child — so the check measured 41 characters against an actual description of several hundred, and false-failed. `shared/dom.ts`'s new `resolveDescriptiveText()` falls back to a container's siblings when its own text looks like a bare label.

**`analyzeScrollDepth`'s coordinate bug** (`heatmap.ts`, previously documented below in §2.4): fixed by replacing the `elementsFromPoint` probe with a document-relative bounding-box bucketing approach — see §2.4 for what the bug was.

### 1.5 Retest Findings (2026-09-06) ✅ FIXED

A follow-up retest against a broader set of real sites (webscraper.io's e-commerce test catalog, en.wikipedia.org, plus re-running books.toscrape.com and demo.vercel.store) surfaced two more issues, one of them introduced by §1.4's own fix:

**`resolveDescriptiveText()` over-padding a genuinely short description:** the sibling-rescue fallback added in §1.4 correctly fixed the books.toscrape.com case, but on a real product card (webscraper.io) it also pulled in a *price* and *title* element that happened to be siblings of a genuinely short (99-character) description, padding the count to 166 and passing a description that should have failed by one character. Fixed by excluding siblings that are themselves a different structured product field (detected via `itemprop` or a `price`/`title`/`name`/`sku`/`brand` naming convention) from the fallback — it now only rescues text that was actually misplaced, not any nearby text.

**A serialization hazard in the same fix, caught only by manually running the CLI:** the first version of that exclusion logic used a nested helper function (`const isOtherStructuredField = (el) => {...}`) declared inside `resolveDescriptiveText`. Running the tool via `npx tsx src/cli.ts` (the dev-mode runner used throughout this project's own testing) crashed with `ReferenceError: __name is not defined` — tsx's esbuild-based transform wraps nested function declarations with a name-preservation helper call that isn't included when Playwright serializes just the outer function's source via `.toString()` for `page.evaluate()`. The crash was caught by the check's existing `try/catch` and degraded gracefully to "check skipped" rather than crashing the audit — so real-world impact was silent under-reporting, not a hard failure. **This did not affect the actual published package**: the production build (`tsc`, via `npm run build:ts`) and the Vitest test suite (a different esbuild configuration) both compile the nested closure as plain JS with no such wrapper, and neither was affected — confirmed by building and running the compiled `dist/cli.js` with the buggy version in place. Fixed by inlining the check directly rather than declaring a nested named function, matching this file's own top-of-file rule that every function passed to `page.evaluate()` must be fully self-contained. A real-browser end-to-end test (`tests/e2e/seoChecker.e2e.test.ts`'s "resolves product-description-present against a real page without crashing") now exercises this function against an actual Playwright page rather than the mock DOM every other unit test uses — closing the specific blind spot where mock-DOM tests can't validate that a function actually survives Playwright's serialization boundary. That test does not reproduce the tsx-specific wrapper (Vitest doesn't inject it either), so the real protection against *this exact* hazard going forward is the "no nested closures" code pattern, not the test.

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

**What It Can Detect:**
- ✅ Thin content (word count)
- ✅ Poor structure (headings)
- ✅ Missing key elements

**What It Cannot Detect:**
- ❌ Plagiarism from other sites
- ❌ Factual errors
- ❌ Content relevance to search intent
- ❌ E-A-T signals (Expertise, Authority, Trust)

### 2.3a Privacy and regulatory text indicators (not legal review)

**Check:** GDPR and CCPA text indicators (`legalCompliance.ts`)

These checks search visible page text and link labels or URLs for a small set of privacy-related terms. They do not determine which laws apply, review the full policy, test consent controls, or verify whether a business meets any legal requirement. A detected phrase is not evidence of compliance. No detected phrase means the scan could not assess the page; it does not establish that the site is noncompliant. Missing indicators are reported with informational severity.

**Recommendation:** Have a qualified reviewer assess the disclosures and consent behavior for the regions and services involved.

### 2.3b Generative Engine Optimization (GEO) diagnostics

**Checks:** AI crawler access, search preview controls including visible `data-nosnippet` content counts, answer-content profiles, initial-HTML versus rendered-text phrase overlap, citation-shaped evidence, optional `llms.txt` availability, and cross-page structured entity identity observations.

Rendered-page checks begin after the configured navigation readiness event and a fixed settle delay (`--settle-ms`, REST `settleAfterNavigationMs`, or `AVIARY_SETTLE_AFTER_NAVIGATION_MS`; default 1,000 ms). This gives client-rendered pages a reproducible observation window, but a fixed delay cannot guarantee that asynchronous content has finished loading. Successful page reports record both timing values; compare audits only when their settings match.

Aviary does not calculate a standalone GEO-readiness score. A page or batch score is the weighted result of the checks actually run, so a perfect score from the `geo` preset means those selected diagnostics passed for that capture; it does not mean a page will be found, indexed, retrieved, or cited by a search or answer engine. Initial-HTML/rendered-text phrase overlap compares sampled browser and source text at the recorded timing settings; it does not show what a particular crawler fetched or how an engine used the page.

Citation-source communities are deterministic weighted label-propagation clusters over the retained co-citation graph; label IDs are period-local and are not semantic topic labels. Baseline/current comparisons use the adjusted Rand index over the jointly retained domain catalog, while per-source membership changes compare complete retained community member sets. Transition rows characterize overlaps among those retained member sets; truncation of transition output can omit otherwise available rows. Scores therefore describe partition agreement in these sampled graphs, not agreement about a subject, provider quality, or causal source influence. Weighted modularity compares a partition against a degree-preserving random-graph reference, but a higher value still does not demonstrate semantic or topical coherence. A catalog cap or a label-propagation work/iteration cap marks the stability result incomplete.

Source-rarefaction estimates use exact hypergeometric sampling without replacement over each provider’s retained unique exact prompts; repeat snapshots do not add prompt weight. The optional lexical prompt-family rarefaction instead samples connected TF-IDF wording families and unions member prompt sources; transitive lexical similarity is not semantic equivalence or independent demand, and a bounded candidate graph can leave related prompts split. The threshold sweep uses the same capped candidate graph at every cutoff, so it reveals cutoff sensitivity but cannot measure the effect of omitted candidate edges. Family-level cross-provider source overlap can pair different exact prompts within a connected family; it is a descriptive lexical comparison, and observed domain Jaccard may shift in either direction when citation detail is incomplete. Event-weighted and rank-weighted Jensen–Shannon values compare the retained distributions only and are withheld when their required detail is capped or unavailable. Its threshold sweep reuses one bounded candidate graph and allocates the shared output-row cap across cutoffs; candidate edges skipped or omitted by caps remain unmeasured. Domain and operator-mapped category counts describe only retained citation detail, and subdomain category assignments use the most-specific configured hostname. Minimum prompt sizes for 50%, 80%, 90%, and 95% expected discovery are relative to the already-observed retained domain/category catalogs, including separate owned/non-owned domain catalogs when configured. They support retrospective sample planning inside this finite panel, not estimates of unseen sources, future answers, rankings, or market query distributions. Incomplete citation lists and capped domain detail can hide domains or categories; configured category labels without retained matches are therefore not confirmed absences, and the configured-label match share may be a lower bound whenever source-list or domain-detail completeness is incomplete.

`--geo-answer-prompt-family-period-comparison-csv` clusters the union of baseline/current retained prompts before comparing provider source portfolios. A lexical family may contain prompts that are not semantically interchangeable, and the union graph can be incomplete when prompt catalogs or candidate pairs are capped. Provider prompt-group turnover is exact-text support within those lexical components; it is not a measure of changing search demand. Citation-event counts and events per observation describe recorded list entries and can move when list capture completeness changes. Domain gains, losses, and Jaccard are observations from the retained source detail, not confirmed changes to a complete source universe; the export reports list and domain-detail completeness separately. Its event/rank Jensen–Shannon divergence compares the normalized observed citation mix within each period, so it describes distribution shape rather than citation-volume change and does not restore hidden sources from incomplete captures. The top-five domain-share examples are omitted when either period’s weighted detail is incomplete and are not a full enumeration of contributing sources. The matched-prompt divergence is conditional on exact prompts having citations in both periods; each qualifying prompt is normalized and equally weighted, but the metric does not remove capture changes or semantic-panel differences. Its matched source-list flag indicates whether those captures were marked complete; otherwise the divergence describes only the recorded citations. Optional category divergence normalizes over only the citation weight assigned by the configured host mappings; it does not represent unmapped domains, and its mapped-share fields should be reviewed as a coverage check. The optional HTML dashboard ranks at most 500 provider/family rows by the largest retained overall or matched source-mix divergences; it is a review aid, not a full export. `--geo-answer-prompt-family-period-comparison-sweep-csv` reuses the same bounded graph at every cutoff, so it cannot measure omitted edges, and its shared row cap can omit some threshold/family rows. Comparisons are descriptive and do not identify provider-caused changes.

These checks report observable robots rules, current page markup, and bounded fetch outcomes. They do not prove that a crawler can reach the page through a CDN or authentication layer, that a search system indexed the page, or that an AI service cited it. The GEO data-use `noindex` and `noarchive` inventory records token-scoped directives as observed markup or headers. Amazon documents a model-training meaning for Amazonbot `noarchive`; Aviary does not assume that other providers assign the same meaning. Visible `data-nosnippet` counts and shares describe marked text in one rendered snapshot; baseline changes in element, word, or share values are content-difference signals, not citation outcomes. The source/rendered text overlap is measured from one browser session and can be affected by hidden markup, late updates, personalization, and text normalization; it does not simulate a named crawler. The content profile and external-link counts do not assess answer quality, source reliability, factual support, or ranking. In-page citation target checks inspect fragment IDs in the rendered DOM at audit time; late script changes can affect the result, and external sources are not fetched or validated. `llms.txt` is treated as an optional convention, not a search requirement. Shared entity IDs with multiple names can reflect localization or intentional branding; review the source pages before changing schema. Bing export correlation may use a unique declared canonical URL; ambiguous canonical matches are left unmatched. Topic and intent groups only summarize dimensions supplied in an export. Bing AI Performance imports retain the limitations of Microsoft's sampled, aggregated reporting. Google Search and Discover Generative AI export correlations are observed impression-to-current-audit associations: current robots and snippet controls may differ from the report period. Current-control groups can overlap, and row-summed impressions are not time-aligned impact estimates. Google reports impressions, not clicks or query strings. Search and Discover exports use separate reporting surfaces and aggregation scopes; page tables are capped at 1,000 rows. An URL omitted from one CSV may be outside that table limit and is not evidence of new or lost visibility. Matched-page impression changes are still aggregates from exported rows, not property totals. The optional cross-platform matrix joins Google Search and Bing page exports by normalized URL and can use a saved audit's unique canonical declarations to bridge aliases and expose its current crawler/preview snapshot; it does not equate Google impressions with Bing's sampled citation counts. Ambiguous aliases stay separate, source URL lists are capped, and URLs missing from either input are not treated as zero activity. Neither data source predicts rankings or proves why a page appeared. No GEO prediction accuracy is claimed. Optional model, surface, and locale dimensions in manually assembled answer samples are operator-recorded labels. They are not independently verified and should not be treated as inferred provider metadata. The execution-context export separates observed rates by those labels; it does not estimate the causal effect of changing a model, surface, or locale. Manually sampled answer-citation reports also expose distinct-prompt domain reach and alternative-domain activity in owned-citation gaps. Those metrics describe the supplied prompt panel and captured citation events; event share is not answer coverage, period reach uses each period’s own denominator, and no source association establishes causation or quality. The cross-provider owned-citation gap export pairs the same normalized prompt when one provider’s retained sample includes an owned citation and another provider’s does not; snapshots may differ in date, model, and execution, so this is a review cue rather than a controlled provider comparison. The dashboard’s paired reach summary counts each retained normalized prompt once and only includes prompt groups captured under both provider labels. The baseline/current state export further requires the exact prompt and both provider profiles in both periods; prompts missing from any cell are excluded, and capture dates or model versions may differ. The within-provider owned-prompt reach period export likewise uses only matched provider/exact-prompt groups, collapses repeated captures to a binary state per period, and bootstraps across prompts; it does not represent prompts absent from either period. The owned-reach comparison exports also show a two-sided exact McNemar p-value from prompts that changed state, a Holm-adjusted value across provider comparisons when the comparison set is complete, and a leave-one-prompt-out delta range. The p-value assumes prompt groups act as independent units; manually selected prompts and semantically related queries can violate that assumption. The leave-one-out range is a sensitivity check, not a confidence interval, and the prompt-cluster bootstrap is descriptive for the supplied panel.

Answer-length profiles use an approximate Unicode word split on operator-supplied answer text; they neither retain nor export that text, and answer-text availability can differ by provider or context. Prompt-equal density and owned-rank shares first aggregate repeated captures within each exact prompt, then weight prompts equally. Their deterministic 1,000-resample intervals resample prompts, not individual snapshots, but manually selected or semantically related prompts can remain correlated. Owned citation ranks follow the citation-array order supplied in the observation file. Baseline/current rank decomposition standardizes event-weighted rank-one/top-three shares to pooled owned-citation-event weights across answer-length bands; it is withheld when profile detail is capped, owned-domain sets differ, or a band containing owned citations lacks support in either period. The within-band and answer-length-mix components describe this sample’s accounting identity and do not establish that answer length caused a rank change. Paired owned-rank changes use exact prompt fingerprints present in both periods, and exclude prompts without owned citations on either side; their bootstrap resamples matched prompts, while semantically related prompts may still correlate. A prompt fingerprint is a stable pseudonymous SHA-256 identifier, not anonymization. The lower-confidence-bound CI gates for top-three and rank-one share compare their deterministic bootstrap intervals with operator thresholds; this is not a hypothesis test or a guarantee that future answers will follow the observed prompt panel.

Provider cohort-standardized citation rates use the same pooled snapshot weights across labeled topic/intent cohorts observed for both provider labels. Owned-cited exact-prompt reach uses a separate pooled exact-prompt weight base. They exclude unlabeled and one-sided cohorts from the adjusted estimate and do not adjust prompt mix within each label; capped cohort detail limits the estimate to retained shared cohorts. Read the adjusted values beside the full-sample and common-cohort crude rates as descriptive summaries, not causal provider effects. The cohort-standardization CSV and dashboard compare the common-support crude delta with the adjusted delta and label a displayed sign reversal as a Simpson’s-paradox signal. The label compares deltas rounded to two decimal percentage points; it is not a significance test and does not establish why the direction changed. CSV contribution rows show how the retained cohorts account for the crude-to-standardized shift; tiny per-cohort values can round, so their displayed sum may differ slightly from the summary. The prompt-panel planner derives its target distribution from the providers’ pooled observed unique-prompt shares across retained labeled cohorts. That is a way to balance a future sample against this panel, not evidence of a representative market query mix. Both providers use the same minimum target prompt total and cohort quota distribution, computed to retain existing per-cohort counts after ceiling rounding. An optional per-cohort quota floor raises the target. An operator-supplied JSON target file can raise selected cohort floors; each topic/intent key must match a retained labeled cohort. The planner uses the largest of the global floor, cohort floor, pooled-mix quota, and precision minimum, so custom floors alter future capture allocation but not the observed panel or measured rates. The owned-reach margin option computes a conservative minimum prompt count from the worst-case 50% rate for a nominal 95% Wilson interval half-width; it targets interval width under independent-prompt assumptions and does not correct prompt selection or semantic correlation. The paired follow-up count means new identical prompts captured on both providers; paired capture runs can exceed one side’s provider-specific quota additions when its existing exact prompts do not overlap. A prompt assigned inconsistent topic/intent labels can count in more than one cohort. For longitudinal standardization, the tool uses shared labeled provider/topic/intent cohorts and a pooled baseline/current cohort mix. Baseline-only and current-only cohorts are excluded from rates and counted separately; truncated matched detail is marked incomplete. The cohort decomposition separates within-cohort rate movement from sample-mix movement in the supplied panel, but it does not account for prompt changes inside labels or support causal claims. The citation CI gate compares periods using pooled baseline/current snapshot weights; the owned-prompt gate uses pooled exact-prompt weights. Both use matched labeled cohorts, exclude one-period-only cohorts, and fail closed when retained cohort detail is incomplete.

The profile also reads literal JSON-LD booleans for `isAccessibleForFree`, counts `true`, `false`, conflicting true/false declarations, and pages without a boolean declaration, and separately marks non-boolean values. Apple documents that `false` keeps a page eligible for Apple Search while preventing the page from supplying additional context to Apple AI outputs. The Applebot correlation is therefore a current audit/log association; its request count does not imply a citation, search exclusion, or cause.

Access-log evidence is bounded to the supplied log files. Built-in and custom user-agent matches are claims rather than authenticated identities; only Cloudflare's explicit log annotations supply separate verification evidence. AI-referral tags match exact configured `utm_source` values and count request rows, not visits, users, sessions, citations, or conversions. Aggregate coverage counts can show unconfigured or malformed marker rows without preserving their values, but unconfigured values may belong to any campaign. Path joins discard queries and require callers to scope logs to the audited origin. Referral/crawler path overlap does not establish event order or causation; when a truncated crawler path list omits a referral path, observed cross-token sums are lower bounds and that path is marked incomplete. Period and CI comparisons are only useful when source mappings, log fields, origins, and sample scopes are sufficiently comparable.

Crawler response timing is summarized only when the log provides recognized duration fields. Fixed bands make reported p50/p95 values approximate; the number of sampled rows can be smaller than the crawler request total. The source logger determines what interval is measured: CloudFront's output-queue timing, Nginx's request-to-log-write timing, and other exporter fields are not interchangeable. These observations exclude client network conditions and are not end-user performance metrics. Malformed and over-24-hour values are ignored.

### 2.4 Mobile Usability & Heatmaps (~75% accurate)

**Check:** Tap Target Size, Viewport Configuration, Scroll Depth

**Limitation & Code Bugs:**
- 44px tap target rule is a guideline (WCAG 2.5.5)
- Viewport simulation vs. actual device behavior
- **Scroll Depth Coordinate Bug ✅ FIXED (see §1.4):** `heatmap.ts`'s scroll depth content density checker used to pass the document-relative vertical offset `yPosition` into `document.elementsFromPoint()`, which expects viewport-relative client coordinates -- since the audit never actually scrolls the page, any `yPosition` beyond one viewport height returned an empty array, zeroing the density score for nearly every depth band on a typical page. Replaced with a bounding-box bucketing approach that doesn't depend on the page having scrolled there.

**Recommendation:** Test on real devices for critical pages.

### 2.4a Heatmap & Click Prediction (no ground truth available)

**Check:** Click Heatmap, Attention Zones (`heatmap.ts`'s `generateClickHeatmap` and `analyzeAttentionZones`)

Unlike every other check in this document, these aren't measuring a DOM fact that can be right or wrong -- they assign ad-hoc weighted scores (element type, size, position, background color) modeling where a real user would click or look. **There is no ground truth available from a static crawl**: real click/attention data comes from recorded user sessions (Hotjar, Microsoft Clarity, GA4 scroll-depth), which this tool has no access to. `heatmap.ts` is the only checker in the codebase built this way.

**What this means in practice:**
- Messages are worded "predicted"/"estimated" deliberately, not decoratively -- they should never be read as measured facts the way, say, an HTTPS check result is.
- What *can* be validated without ground truth: the relative ranking makes sense (a colored above-fold CTA should outscore a buried below-fold link) and the scoring doesn't silently drift (a regression that swapped two weight constants should be caught by a test, not ship silently). `tests/unit/heatmap.test.ts` has rank-plausibility and exact-score-pinning tests for this.
- What can't be validated: whether the absolute scores correlate with real user behavior on any given site. That requires correlating against actual analytics on a live, operated site -- out of scope for a static audit tool.

**Recommendation:** Treat heatmap scores as a heuristic prioritization aid (which elements *should* draw attention, per visual-hierarchy best practice), not as a substitute for real user analytics.

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

### 3.5 Batch-level content and link graph scope

- Exact duplicate-content groups compare normalized page text after removing script, style, navigation, header, and footer elements. They require at least 50 words and skip content over 256,000 normalized characters; near-duplicates are not identified.
- The link graph includes only edges between completed URLs in the submitted batch. A page with no observed inbound links may still be linked from an unscanned page.
- Hreflang reciprocity is checked only between completed pages in the batch. Alternate URLs outside the submitted scope and pages without internationalization result data remain unverified; this is not a site-wide crawl of every declared locale.
- Canonical chains and loops are checked only between completed pages in the batch. Targets outside the submitted scope and pages without canonical result data remain unverified. Multiple pages sharing one canonical target are reported but are not inherently an error.
- Link collection accepts URL candidates up to 2,048 characters, is bounded at 1,000 unique candidates and 250 in-batch destinations per source page, and reports when a bound was reached. Inbound counts can be incomplete for those scans.

---

## 4. Missing Production Features & Hidden Behaviors

Features still absent or narrower than their broader roadmap descriptions:

- ❌ **Page-result caching** — sitemap documents and link-crawl HTML can be revalidated between watch cycles, but browser audits run again for each page on every cycle.
- ❌ **Lighthouse integration** (Google's official tool)
- ❌ **Google Search Console API integration**
- ✅ **Batch audits and history** — URL lists, sitemaps, and bounded same-origin HTML link discovery supply pages for parallel audits; sitemap/link discovery filters through robots.txt for AviaryBot. `--history` plus `--history-report` provide JSONL trend tracking.
- ⚠️ **Link-crawl coverage** — `--crawl` reads static HTML anchors without executing JavaScript; dynamic routes can be missed. It honors robots.txt rules for AviaryBot, but use a sitemap or reviewed URL list for a complete scope.

### 4.1 Unsupported Rust LLM providers silently select the stub

- `engine/src/semantic/factory.rs` implements `ollama`; every other `AVIARY_LLM_PROVIDER` value, including a typo or `openai`, selects the `StubAnalyzer` without an error. `.env.example` lists only `stub` and `ollama`. `AVIARY_LLM_API_KEY` is reserved and is not used by either current analyzer.

### 4.2 Prometheus Metrics Server Exposure

- The CLI's Prometheus endpoint is limited to the local machine at `127.0.0.1` and is started only when the executable runs. `AVIARY_METRICS_PORT` selects the port (default `9090`); a port conflict is reported while the audit continues without metrics.

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
| HTTPS/Security | ~90% | High | Mixed-content checks cover resource-timing entries and common resource markup, but can miss late-added or blocked resources; header checks do not replace a security review |
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
| GEO diagnostics | Not estimated | Informational | Observable controls and markup only; no citation or ranking prediction |

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

**GitHub Issues:** [https://github.com/Ru1vly/Aviary/issues](https://github.com/Ru1vly/Aviary/issues)

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

`compareBingAiPageCitationExports` compares citation counts only where shared URLs have a citation metric in both sampled `page-citations` exports. It separately compares per-URL average citation share where both exports contain that metric; these unweighted per-page share differences and their mean are in percentage points, not additive totals. Citation-count and citation-share comparability can therefore have different URL counts. Export-only URLs have unknown missing-period values, not zero citations or shares. The comparison is not a complete property total and does not show why Bing cited a page. `currentControlObservations` reports row sums grouped by the current audit's controls; buckets overlap, audits may postdate Bing's report, and the association is not causal.

Matched-prompt source-portfolio attribution and owned-source-share gates compare only the manually supplied baseline/current prompt panels with complete citation detail. Attribution is grouped by provider and exact prompt, not standardized for model, surface, or locale composition, so context mix can contribute to apparent movement; they are not estimates of population-wide provider behavior or causes of citation movement. Prompt-cluster percentile intervals are nominal and are not adjusted for the number of reported domains or providers. The optional exact sign-test gate assumes its non-tied prompt groups are independent under the null; near-duplicate or otherwise related prompts can violate that assumption. Holm correction controls the declared provider test family, but it does not remove within-panel prompt dependence. Read these results as evidence about the captured panel and preserve the completeness and support fields when acting on them.

The saved-panel comparability report’s Kish effective prompt sample size, capture redundancy factor, and largest-prompt share describe concentration across exact prompt captures; they do not establish independence or guarantee the precision of downstream estimates. Distinct timestamp/date counts and largest within-panel timestamp gaps describe when the supplied observations were collected, not whether the capture schedule represents real user activity. Their configurable warning cutoffs are operational review gates, not statistical significance thresholds.

*This document will be updated as the tool evolves and accuracy improves.*
