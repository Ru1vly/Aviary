# aviary

An end-to-end SEO and Generative Engine Optimization (GEO) toolkit for websites. Built with TypeScript and Playwright, with browser audits, AI-crawler diagnostics, and evidence-based answer-citation analysis.

<p align="left">
  <a href="https://www.npmjs.com/package/@ru1vly/aviary"><img src="https://img.shields.io/npm/v/@ru1vly/aviary.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/Ru1vly/Aviary/releases/latest"><img src="https://img.shields.io/github/v/release/Ru1vly/Aviary?style=flat-square" alt="GitHub release" /></a>
  <a href="https://ru1vly.github.io/Aviary-Docs/"><img src="https://img.shields.io/badge/docs-live-blue.svg?style=flat-square" alt="Documentation" /></a>
  <a href="https://github.com/Ru1vly/Aviary/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg?style=flat-square" alt="License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg?style=flat-square" alt="Node" /></a>
</p>

<table>
  <tr>
    <td width="50%" valign="top">
      <h4>🌐 <a href="https://ru1vly.github.io/Aviary-Docs/">Documentation Portal</a></h4>
      <p>Full guides, CLI reference, 12-factor configuration, and accuracy disclosures.</p>
    </td>
    <td width="50%" valign="top">
      <h4>🤖 <a href="#model-context-protocol-mcp-server">Model Context Protocol (MCP)</a></h4>
      <p>Stdio MCP server (<code>aviary-mcp</code>) allowing AI coding agents (Claude, Cursor, Codex) to audit sites.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4>🖥️ <a href="#quick-start">Terminal UI (TUI) Dashboard</a></h4>
      <p>Full-screen interactive Ratatui console dashboard with score meters and issue inspector.</p>
    </td>
    <td width="50%" valign="top">
      <h4>⚡ <a href="#native-architecture--terminal-ui">Fast Rust Static Engine</a></h4>
      <p>Microsecond raw HTTP static parser (<code>aviary-fast</code>) for high-throughput evaluations.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4>📦 <a href="https://www.npmjs.com/package/@ru1vly/aviary">npm Distribution</a></h4>
      <p>Zero-config installation with automatic Playwright Chromium provisioning and Chrome fallback.</p>
    </td>
    <td width="50%" valign="top">
      <h4>📊 <a href="#features">29 Categories · 242 Checks</a></h4>
      <p>Real Core Web Vitals, predictive heatmaps, JSON-LD schema, security headers, and UX.</p>
    </td>
  </tr>
</table>

> [!IMPORTANT]
> Aviary can audit pages in Chromium so browser-dependent checks can inspect client-rendered metadata and layouts and collect lab performance measurements. See the [accuracy guide](docs/ACCURACY_LIMITATIONS.md) for scope and limits.

## Contents

- [Features](#features)
- [Prerequisites and installation](#prerequisites)
- [Quick start](#quick-start)
- [Model Context Protocol (MCP) server](#model-context-protocol-mcp-server)
- [REST API](#rest-api)
- [Command-line options](#command-line-options)
- [Environment variables](#environment-variables-12-factor-config)
- [Configuration](#configuration)
- [Native architecture and terminal UI](#native-architecture--terminal-ui)
- [Project structure](#project-structure)
- [Development setup](#development-setup)
- [License](#license)

---

## Features

The library executes 242 individual checks across 29 categories (heatmap's click/scroll/attention checks are opt-in and included in that default count). Below is an overview of the core checker modules:

| Category | Description | Key Checks |
|---|---|---|
| Meta Tags | Validates standard page descriptors | Title presence/length, description presence/length, Open Graph tags configuration, canonical link validation |
| Headings | Audits heading structure and semantics | H1 presence and uniqueness, heading hierarchy levels, heading length optimization |
| Images | Evaluates image attributes and layouts | Alt text presence, source validity, count, dimension optimization |
| Performance | Measures basic site load times | Page load duration, DOM Content Loaded event timing, First Contentful Paint |
| Technical SEO | Verifies server configuration and response status | Response status codes, page sizes, compression headers, duplicate content detection |
| Heatmap & UX | Models visual hierarchy and attention zones | Predictive click maps, scroll depth levels, above-the-fold content scoring, CTA visibility |
| Accessibility | Inspects basic accessibility markers | ARIA landmarks, form input labeling, keyboard navigation order, skip links |
| Core Web Vitals | Measures real LCP/CLS/FCP/TTFB via `web-vitals`, plus navigation/resource heuristics | Largest Contentful Paint, Cumulative Layout Shift, First Contentful Paint, Time to First Byte, Total Blocking Time, DOM load time, HTTP request counts, resource weights |
| URL Factors | Audits the page address format | URL length, character validity, directory depth, readability rules |
| Spam Detection | Guards against search engine red flags | Hidden text, excessive keyword repetitions, link densities, iframe abuses |
| AI Discoverability (GEO) | Reports crawler controls, observable content signals, and evidence-based GEO review opportunities | Search crawler access and matching rules, separate training-bot controls, snippet restrictions, answer-content and source/rendered profiles, per-URL opportunity reviews, cross-host route parity, matched-period source-domain attribution in CSV/JSON with prompt-cluster intervals and owned-share confidence/sign-test gates, lexical prompt-family source-discovery and provider-overlap analysis, crawler-log diagnosis, tagged AI-referral requests, optional `llms.txt` inventory |

---

## Prerequisites

- **Node.js**: `>= 20.0.0` (required by MCP server and modern runtime libraries)
- **Browsers**: Chromium (automatically downloaded on first run if missing, with fallback to system Google Chrome)

---

## Installation

Install the package into your project:

```bash
# Using npm
npm install @ru1vly/aviary

# Using pnpm
pnpm add @ru1vly/aviary
```

To install globally as a command-line tool:

```bash
npm install -g @ru1vly/aviary
# or with pnpm
pnpm add -g @ru1vly/aviary
```

Or run directly without installing:

```bash
npx @ru1vly/aviary -u https://example.com
```

---

## Quick Start

Analyze any URL directly from your shell.

Running the command with no arguments launches the full-screen interactive Terminal User Interface (TUI) Dashboard:

```bash
# Launch interactive TUI Dashboard
aviary
```

To run audits directly in stdout mode (for scripts, CI pipelines, or AI agents), pass one target with
`-u` / `--url`, or use `--urls` with a newline-separated URL file:

```bash
# Run direct audit
aviary -u https://example.com

# Save detailed JSON report to a file
aviary -u https://example.com --output report.json

# Save a visual HTML report to a file
aviary -u https://example.com --html report.html

# Save a print-ready PDF report for one page or a batch dashboard
aviary -u https://example.com --pdf reports/aviary.pdf

# Save check results in JUnit XML for CI test dashboards
aviary -u https://example.com --junit reports/aviary.xml

# Save findings as SARIF 2.1.0 for compatible issue dashboards
aviary -u https://example.com --sarif reports/aviary.sarif

# Save a compact Markdown summary for pull request artifacts
aviary -u https://example.com --markdown reports/aviary.md

# Save spreadsheet-friendly check rows
aviary -u https://example.com --csv reports/aviary.csv

# Re-render saved JSON without running another audit
aviary --render reports/current.json --html reports/visual.html --pdf reports/print.pdf --sarif reports/current.sarif

# Regenerate batch GEO details from saved audits and gate the baseline comparison
aviary --render reports/current-batch.json --baseline reports/previous-batch.json --geo-summary-output reports/geo.json --geo-summary-csv reports/geo.csv --fail-on-geo-change

# Run only the saved-report GEO gate (no render artifacts)
aviary --render reports/current-batch.json --baseline reports/previous-batch.json --fail-on-geo-change

# Gate a chosen GEO signal on a chosen page (copy exact labels from the GEO comparison CSV)
aviary --render reports/current-batch.json --baseline reports/previous-batch.json --fail-on-geo-change \
  --fail-on-geo-change-signal "Google-Extended search access" \
  --fail-on-geo-change-transition "allowed=>blocked" \
  --fail-on-geo-change-url "https://example.com/guides/robots/"

# Append this run's score and failures to a JSON Lines history file
aviary -u https://example.com --history reports/history.jsonl

# Make CI fail when any checks fail
aviary -u https://example.com --junit reports/aviary.xml --fail-on-findings

# Use a score floor instead of failing on every individual finding
aviary -u https://example.com --fail-below-score 80

# Run only the metadata and accessibility checker categories
aviary -u https://example.com --category metaTags,accessibility

# Review AI-search crawler controls and page-level content signals
aviary -u https://example.com --preset geo --markdown reports/geo.md

# Audit a newline-separated URL list (blank lines and # comments are ignored)
aviary --urls urls.txt --concurrency 4 --junit reports/pages.xml --sarif reports/pages.sarif --markdown reports/pages.md

# Discover up to 2,000 same-origin pages from a sitemap index
aviary --sitemap https://example.com/sitemap.xml --max-urls 2000 --concurrency 4 --html reports/site.html --markdown reports/site.md

# Discover pages from static same-origin links when there is no sitemap
aviary --crawl https://example.com/ --max-depth 3 --max-urls 500 --html reports/site.html

# Fail CI when scanned pages repeat a title or meta description
aviary --sitemap https://example.com/sitemap.xml --fail-on-duplicate-metadata
aviary --sitemap https://example.com/sitemap.xml --fail-on-duplicate-content
aviary --sitemap https://example.com/sitemap.xml --fail-on-canonical-chains

# Re-audit the list every five minutes; Ctrl+C stops after the active batch
aviary --urls urls.txt --watch 300 --history reports/history.jsonl
aviary --history-report reports/history.jsonl --html reports/history.html
aviary --doctor

# Read the URL list from a pipe
cat urls.txt | aviary --urls - --json

# Compare with a previous single-URL JSON report and fail on SEO regressions
aviary -u https://example.com --baseline reports/previous.json --fail-on-regression

# Compare a URL-list run with its previous batch JSON report
aviary --urls urls.txt --output reports/current.json --baseline reports/previous-batch.json --fail-on-regression
aviary --urls urls.txt --baseline reports/previous-batch.json --comparison-output reports/comparison.json

# Fail when assessed GEO controls or page signals change
aviary --urls urls.txt --output reports/current.json --baseline reports/previous-batch.json --category geo --fail-on-geo-change

# Run checks with verbose outputs (lists failure details)
aviary -u https://example.com --verbose

# Run with a mobile viewport simulation
aviary -u https://example.com --viewport 375x667

# Set a custom navigation timeout in milliseconds
aviary -u https://example.com --timeout 45000
```

JSON output for a single audit and a URL batch follows the [single-page report schema](docs/audit-report.schema.json) and [batch report schema](docs/audit-batch-report.schema.json). The current payloads do not embed a `schemaVersion`; these documents describe the emitted structure, including per-URL errors in batch results.

For complete release-gate, static-crawl, accessibility, and history workflows, see [the use-case examples](examples/USE_CASES.md). For AI-search crawler and page-signal diagnostics, see the [GEO guide](docs/GEO.md). For local processing, report retention, the loopback metrics endpoint, and optional LLM data flows, see the [data-handling guide](docs/PRIVACY.md).

The `pnpm run geo:*` commands below call bundled workflow scripts; they are separate from flags on the `aviary` CLI. Run them from a source checkout, or from an npm install with `npm explore @ru1vly/aviary -- npm run <script> -- ...`. Use absolute input and output paths when invoking scripts from the installed package.

Run `pnpm geo:review:synthetic` to generate a complete synthetic answer-citation, crawler, Google AI transition, and robots replay review. For your own paired observations, use `pnpm run geo:review -- baseline.json current.json example.com reports/geo-review` and optionally add crawl and site-audit inputs. Verify a saved bundle with `pnpm run geo:review:verify -- reports/geo-review` to check its manifest, file sizes, and SHA-256 checksums. Each bundle includes `overview.html` and `overview.json` for capture-panel balance, retained reach, provider source drift, Google AI transitions, robots changes, and enabled gate results, including optional citation-repeatability regression checks, plus within-period citation repeatability dashboards and paired repeatability-change reports. Set `GEO_CITATION_REPEATABILITY_GATE_RULES` to add a fail-closed, prompt-paired regression gate to the bundle. Set `GEO_PANEL_COMPARABILITY_FAIL_ON_WARNINGS=1` to fail after the bundle is saved when the panel preflight reports any warning.

To measure repeatability across repeated answer captures, run `pnpm run geo:repeatability -- observations.json reports/citation-repeatability.csv --owned-domain example.com`. It compares adjacent captures for the same exact provider/prompt/context, equal-weights prompts, reports citation URL/domain stability and rank-biased overlap plus owned-citation persistence, and excludes/counts incomplete citation-list pairs. The command writes summary and prompt-level CSVs, versioned JSON, and HTML. Compare baseline/current prompt-detail files with `pnpm run geo:repeatability:compare -- baseline-prompts.csv current-prompts.csv reports/repeatability-change.csv`; the comparison adds matched-prompt bootstrap intervals and report-wide Holm-adjusted sign tests. Optionally apply exact-context regression rules with `pnpm run geo:repeatability:gate -- reports/repeatability-change.json rules.json reports/repeatability-gate.json`, requiring both interval and Holm evidence for selected rules. A [GitHub Actions workflow template](examples/geo-citation-repeatability-gate.github-actions.yml) shows this capture-file review flow in CI. The comparator verifies matching owned-domain configuration fingerprints when owned-citation metrics are present. See [the GEO guide](docs/GEO.md#citation-repeatability-across-repeated-captures).

Preflight two saved capture panels with `pnpm run geo:panel:compare -- baseline.json current.json reports/panel`. It reports exact-context balance and separate observation/prompt-mix total-variation shifts, prompt overlap, capture-depth skew, effective prompt sample size, capture redundancy and largest-prompt share (with a configurable concentration warning), inter-period and within-panel capture-window gaps, distinct UTC capture instants/dates and observations per date, context-dimension coverage, citation-list completeness, and exact duplicate rows, plus a day-level baseline/current capture-timeline CSV, structured warning-code CSV, and searchable offline HTML overview, before interpreting period changes. Duplicate rows are flagged but retained in denominators; prompt text, answer text, and input path strings stay out of the generated reports.

Inspect lexical prompt-family sensitivity with `pnpm run geo:prompt-family:synthetic`, or analyze your own capture set with `pnpm run geo:prompt-family -- answers.json reports/prompt-families example.com=Publisher standards.example=Standards`. The offline bundle compares prompt and family weighting, ranks leave-one-family-out changes in provider reach and source concentration, estimates source discovery by family, compares provider source portfolios within shared families, and sweeps the clustering threshold. Its `index.html` links all dashboards and CSVs. See [the GEO guide](docs/GEO.md) for interpretation limits and output details.

Plan additional provider/cohort prompt captures with `pnpm run geo:prompt-plan:synthetic`, or run `pnpm run geo:prompt-plan -- answers.json reports/prompt-plan example.com` for your own panel. It writes a provider/cohort quota CSV, paired provider-pair effort summary, versioned JSON, and an offline launch page. Set `GEO_PROMPT_PLAN_MIN_PROMPTS`, `GEO_PROMPT_PLAN_MIN_JACCARD`, `GEO_PROMPT_PLAN_MAX_TOTAL_PAIRED_GROUPS`, and optionally `GEO_PROMPT_PLAN_COHORT_TARGETS` to configure targets; when owned domains are supplied, it also plans a conservative owned-reach interval margin. Use `GEO_PROMPT_PLAN_FAIL_ON_MISS=1` to fail when the capped budget cannot meet configured targets. The generated plan balances the supplied panel and does not infer market demand.

Preview confirmed-no-owned-citation page opportunities with `pnpm run geo:page-opportunities:synthetic`; inspect monthly page and path-family movement with `pnpm run geo:page-opportunity-trends:synthetic`. Both use clearly labeled synthetic answer observations and produce reports under `reports/`.

Explore monthly source-category turnover with `pnpm run geo:source-category-turnover:synthetic`; trigger concentration alerts with `pnpm run geo:source-category-hhi:synthetic`. The alert example intentionally exits successfully only when its synthetic HHI and top-three concentration gates fire as expected.

Compare source portfolios across two answer panels with `pnpm run geo:source-portfolio:synthetic`. It produces drift and domain-attribution dashboards plus a paired owned-source regression gate, keeping event-weighted and rank-weighted changes separate.

Run `pnpm run geo:toolbox:synthetic` to generate ten sample workflows under `reports/geo-toolbox/` and open its `index.html` for links to the prompt-family, capture-plan, page-opportunity, crawler route/audit, Google AI concordance, entity association, source-category, and source-portfolio reviews. Pass `-- output-directory` to choose a different report folder.

Run the cross-surface Google AI/Search Console citation join by itself with `pnpm run geo:google-ai-concordance:synthetic`, or the exact-prompt entity/owned-citation association with `pnpm run geo:entity-association:synthetic`.

Inspect synthetic AI-crawler route families with their saved page-audit signals using `pnpm run geo:crawler-route-families:synthetic`.

Tune the panel review flags with `--thresholds-file examples/geo-panel-comparability-thresholds.example.json`. The versioned profile is strict about unknown fields, records its effective values in the report, and leaves the underlying descriptive metrics unchanged. It can optionally list `failOnWarningCodes` to make only selected diagnostics fatal; the CLI also accepts repeatable `--fail-on-warning-code <code>` flags. It customizes numeric cutoffs; missing-stratum and malformed-row warnings remain active. It can also set a tolerated exact-duplicate capture percentage; the default warns on any duplicates and always retains them in denominators. The JSON adds stable warning codes and the measured value/cutoff pair alongside human-readable warnings; the offline HTML shows the codes and active cutoffs for reviewers. `GEO_PANEL_COMPARABILITY_THRESHOLDS_FILE` applies the same profile inside `pnpm run geo:review`; the selected file is included in the bundle manifest.

Analyze a deliberately sampled set of manually recorded AI answers with `aviary --geo-answer-observations answers.json --geo-answer-owned-domain example.com --geo-audit-json reports/site.json --geo-answer-cohorts-csv reports/answer-cohorts.csv --geo-answer-provider-pairs-csv reports/provider-pairs.csv --geo-answer-sample-mix-csv reports/provider-mix.csv --geo-answer-stability-csv reports/prompt-stability.csv --geo-answer-source-persistence-csv reports/source-persistence.csv --geo-answer-citation-url-persistence-csv reports/source-url-persistence.csv --geo-answer-cohort-trends-csv reports/cohort-monthly.csv --geo-answer-audit-signals-csv reports/cited-page-audit-signals.csv --geo-answer-citation-positions-csv reports/source-list-positions.csv --geo-answer-owned-rank-csv reports/owned-rank-distribution.csv --output reports/answer-citations.json --html reports/answer-citations.html`. Aviary ranks cited URLs and domains by provider, month, exact repeated prompt, and optional operator-labeled topic/intent cohorts, and queues repeated prompts with no citations or incomplete owned-domain citation coverage. The optional `--geo-answer-source-persistence-csv` report summarizes next-distinct-timestamp source retention within each exact prompt and recorded context, pooling simultaneous captures and exposing its work/output caps, five follow-up interval bands, previous source-list rank bands, and equal-prompt cluster-bootstrap intervals; it describes sampled transitions rather than future persistence. Add `--geo-answer-citation-url-persistence-csv reports/source-url-persistence.csv` to track normalized cited-page URLs separately from domain continuity and identify page-level turnover. Persistence analysis accepts `citationListComplete: false` for clipped lists; unmarked lists of 50 URLs are treated as incomplete, and absences from wholly incomplete follow-up captures are excluded from retention denominators. Per-provider and per-prompt summaries include observed citation-domain concentration (HHI, effective cited-domain count, and largest-domain share); `--geo-answer-source-rarefaction-csv reports/source-discovery.csv` estimates distinct all/owned/non-owned domains and mapped categories as a uniformly chosen subset of unique prompts grows, reports expected next-batch yield, and gives retained-panel prompt sizes for expected 50/80/90/95% discovery of the observed catalogs; it does not extrapolate beyond that panel, and incomplete-list and catalog states remain explicit. Add `--geo-answer-prompt-family-source-rarefaction-csv reports/family-source-discovery.csv` to repeat the estimate with lexical prompt families as sampling units; tune their connected-component cutoff with `--geo-answer-prompt-family-threshold 0.9`, or export the standard 0.50–0.95 cutoff sweep with `--geo-answer-prompt-family-source-rarefaction-sweep-csv reports/family-source-thresholds.csv`. Add `--geo-answer-provider-prompt-family-source-overlap-csv reports/family-source-overlap.csv` to compare provider domain portfolios inside shared lexical families, including exact-prompt overlap and source-list/detail completeness. Render an offline dashboard of the 500 largest event/rank source-mix divergences with `--geo-answer-provider-prompt-family-source-overlap-html reports/family-source-overlap.html`. Add `--geo-answer-provider-prompt-family-source-overlap-sweep-csv reports/family-source-overlap-thresholds.csv` to check that comparison across family cutoffs. Use `--geo-answer-provider-prompt-family-source-overlap-sweep-html reports/family-source-overlap-thresholds.html` for an offline trend chart and capped provider/family drilldowns. topic/intent cohorts break out denominators, citation coverage, owned-domain coverage, and cited domains by provider, while naming provider labels not sampled in each cohort. The same-prompt comparison summarizes provider citation coverage and owned-domain citation-event share over exact prompts both labels sampled inside each cohort, with pooled and per-prompt deltas, plus each provider's full prompt count, exclusive prompts, and exact-prompt Jaccard overlap; prompts without citation events on both sides are excluded from the per-prompt event-share comparison. It also compares first-position and top-three source-list shares on those matched prompts using the supplied citation order, plus reciprocal-rank-weighted URL similarity with greater weight for earlier listed sources. A sample-mix report quantifies how differently those provider labels were distributed across supplied topic/intent segments, including unlabeled observations. Add `--geo-answer-cohort-standardization-csv reports/cohort-standardized.csv` to compare citation coverage after reweighting the shared labeled cohorts to one pooled snapshot mix; with an owned domain it also compares owned-citation snapshot coverage and exact-prompt reach using their respective denominators. It includes per-cohort rates and full-sample/common-cohort crude rates, plus common-support crude and standardized deltas, the sample-mix component, and a direction-reversal signal for Simpson’s-paradox review. Per-cohort contributions decompose each matched-support crude gap into standardized within-cohort and sample-mix components. The dashboard highlights the aggregate signal; it is descriptive and does not establish a provider effect. Capped cohort detail limits the adjusted comparison to retained shared cohorts, and the adjustment does not remove within-cohort prompt differences. The export considers up to 1,000 provider pairs, prioritized by sample-mix divergence and 50,000 rows, with truncation columns. Add `--geo-answer-prompt-sampling-plan-csv reports/prompt-panel-plan.csv` to plan additional unique prompts for each provider/cohort until both sides reach a common minimum total and per-cohort quotas matching that pair’s pooled observed labeled-prompt mix. It includes one-provider-only cohorts, counts prompts once within a provider/cohort, and flags cohort/pair/output caps. This balances the supplied collection panel; it does not estimate market demand or a representative query distribution. Rows also report how many new identical prompt groups to capture on both providers and the paired provider-capture run count; this paired panel can require more runs on one side than its provider-specific quota deficit when current exact-prompt sets differ. Add `--geo-answer-prompt-plan-min-prompts 20` with the plan CSV or HTML output to enforce a minimum of 20 unique prompts per provider/cohort; ceiling quotas can make the final plan larger. With `--geo-answer-owned-domain`, add `--geo-answer-prompt-plan-owned-reach-margin 5` to raise each provider/cohort quota to the conservative worst-case sample size for a nominal 95% Wilson interval half-width of at most five percentage points. This precision target assumes independent prompts and does not make a hand-selected panel representative. The plan CSV shows worst-case Wilson half-widths at current cohort counts and planned quotas. For longitudinal changes, add `--geo-answer-cohort-period-standardization-csv reports/cohort-period.csv` with baseline and current observations. The answer HTML dashboard also shows a compact provider-level view. Each provider’s rates are standardized to one pooled mix across shared labeled cohorts, and per-cohort rows include baseline/current observation spans and split the matched-support crude change into within-cohort and sample-mix components; one-period cohorts are excluded and incomplete retained detail is marked. Repeat `--fail-on-geo-answer-cohort-standardized-citation-drop "Provider A=5"` with baseline/current samples to gate standardized citation decline. With an owned domain, add `--fail-on-geo-answer-cohort-standardized-owned-prompt-coverage-drop "Provider A=5"` to gate standardized owned-cited prompt reach. Repeated-prompt stability profiles track adjacent domain and URL overlap, citation appearance/disappearance, and source-order volatility over time, excluding adjacent snapshots with identical timestamps. With owned domains configured, they also compare owned-host overlap, owned citation presence, and owned event-share volatility. Monthly cohort trends preserve provider-specific denominators across time and compare each sample with the previous sampled month, counting intervening unsampled months explicitly. They also track mean/median source position and first-position/top-three shares, with share changes against the previous sampled month. With owned domains configured, they add per-rank owned-citation mix and rank-share deltas against the previous sampled month. When you configure owned domains, Aviary reports both snapshot coverage (answers with any owned citation) and event share (owned URLs divided by all captured citation events). Citation-position summaries pool the preserved `citedUrls` capture order across labels; the dashboard and CSV also split page/domain positions by provider, with each provider’s citation-event, answer, and prompt denominators. They report rank buckets 1, 2, 3, 4–5, 6–10, and 11+ so you can distinguish early-list citations from sources that appear deeper in captured lists. Use source-order measures only when collection preserves array order. Add `--geo-answer-domain-prompt-coverage-csv reports/domain-prompt-reach.csv` to compare each retained domain’s share of distinct prompts with its event-weighted citation share, overall and by provider. It includes nominal Wilson intervals using exact prompts as trials; manually selected or semantically related prompts may be correlated. Add baseline/current captures with `--geo-answer-domain-prompt-coverage-comparison-csv reports/domain-prompt-reach-changes.csv` to compare domain reach and citation-event share by provider, with uncited, unsampled, and catalog-capped states kept distinct. The per-period prompt sets may differ, so coverage changes are not paired-prompt effects. A saved GEO audit can add current crawler, preview, and page-structure observations to cited URLs, then group measured access rules, preview controls, answer structure, rendered-content coverage, and citation-evidence states with page and citation-event counts. `--geo-answer-audited-owned-pages-csv` joins every audited URL on configured owned domains to the retained cited-page sample, exporting observed versus not-observed state, source-list prominence, and current crawl/content signals; the inventory is capped at 20,000 pages and marks truncation. An unobserved page is simply absent from this supplied sample. `--geo-answer-audited-owned-page-providers-csv` breaks retained owned-page citations into provider rows with rank-bucket shares and current audit signals; it emits observed pairs only, rather than filling missing page/provider pairs with assumed zeros. Use repeatable `--geo-answer-source-category hostname=label` mappings with `--geo-answer-source-categories-csv` to summarize citation events, rank buckets, category HHI, effective category count, and largest-category share for your manually defined source classes. The most specific matching hostname wins; shares use categorized retained events only, unconfigured domains stay out of the denominator, and the 50,000-row output marks truncation. Supplying these mappings with the answer HTML output adds category shares, source position, rank-one/top-three shares, a provider breakdown, and a cap-aware concentration readout. Add `--geo-answer-source-category-comparison-csv` with baseline/current samples to inspect pooled and provider-specific category event and rank-share deltas plus changes in overall category concentration; provider rows distinguish unsampled providers from sampled providers with no categorized citations. If either source-domain list is capped, change metrics remain blank. Add `--geo-answer-source-category-prompt-coverage-csv` to count each exact prompt once per provider/category; this complements event-weighted citation shares and marks prompt/source-list detail caps. If a baseline sample is supplied, the same CSV also compares source-category presence on exact prompts sampled in both periods. With owned domains configured, it counts category/owned co-citation and category-present prompts without owned citations, separating complete profiles from cap-hidden absences. If baseline and current use the same owned-domain set, it also compares those category-without-owned prompt gaps on shared exact prompts. Use `--geo-answer-source-category-prompt-details-csv` to drill down to each retained prompt/provider/category row, including the domains that matched and whether an absent category is conclusive. When owned domains are configured, it also shows owned-host matches and distinguishes category citations without owned citations from capped-list uncertainty, helping prioritize prompts for review. `--geo-answer-source-category-trends-csv` reports category presence, citation-event share, and source-list placement across sampled month/provider/topic/intent segments; adjacent sampled months are compared only when the top-ten domain profile is complete. `--geo-answer-source-category-provider-pairs-csv` compares category presence across providers on the same exact prompts, excluding category states hidden by capped domain lists. `--geo-answer-source-category-cooccurrence-csv` finds source-category pairs cited together within provider/prompt groups and reports complete-profile support, directional conditional presence, independence-expected co-occurrence, lift, excess co-occurrence, and Jaccard overlap. Lift above 1 means the pair co-occurs more often than the independence baseline expects; below 1 means less. Association metrics use uncapped source lists and describe sampled co-occurrence, not statistical significance or causation. `--geo-answer-source-category-path-families-csv` cross-tabulates those host categories with cited URL path families and source placement by provider; it requires `--geo-answer-path-depth`. Add `--geo-answer-source-category-path-family-comparison-csv` with baseline/current answer samples to compare category-family presence, citation volume, event share, and source placement; deltas are withheld when retained cited-page detail is capped. When owned domains are configured, each audit-state row also shows owned pages and owned-event share within that state. The report describes only the supplied observations; it does not estimate rankings or citation probability. See the [input example](examples/geo-answer-observations.example.json), [input schema](docs/geo-answer-observations.schema.json), and [GEO guide](docs/GEO.md).

Use `--geo-answer-prompt-similarity-csv reports/prompt-wording-overlap.csv` to screen retained exact prompt groups for lexical near-duplicates. The export ranks candidate pairs with TF-IDF cosine and token Jaccard, includes their shared terms and provider support, and defaults to a 0.65 cosine threshold; tune it with `--geo-answer-prompt-similarity-threshold 0.75`. This is a wording-review aid only: Aviary keeps exact prompt groups separate and does not infer shared intent or statistical independence. Search is bounded to the retained prompt catalog, omits pairs that share only high-frequency terms, and marks candidate/output caps in a leading summary row, even when no pairs pass the threshold. The CSV contains the supplied prompt text for review.

Use `--geo-answer-prompt-families-csv reports/prompt-families.csv` to review connected components of lexically similar exact prompts. Its separate `--geo-answer-prompt-family-threshold` defaults to 0.85; the output retains exact prompts, shows family edge density so sparse transitive chains are visible, and flags prompt/candidate/output caps. Provider summary rows compare exact-prompt citation reach and source concentration with family-balanced reach/HHI, effective breadth, and largest-source share, with lexical-family intervals when detail is complete; owned reach appears when configured. This helps assess wording overlap when reading prompt-level uncertainty or planning collections, without deciding semantic equivalence or independence. For cutoff robustness, `--geo-answer-prompt-family-threshold-sweep-csv reports/prompt-family-thresholds.csv` adds connected-component and family-balanced coverage summaries across 0.50–0.95 cosine thresholds, plus the selected threshold. Candidate and prompt caps are explicit. Provider rows also include deterministic percentile-bootstrap intervals that resample whole lexical families at each cutoff; intervals are suppressed for capped graphs/catalogs, fewer than two provider-supported families, or a draw-budget limit. Owned lower and upper endpoints are resampled separately. The offline `--geo-answer-prompt-family-threshold-sweep-html reports/prompt-family-sensitivity.html` view charts topology and provider reach sensitivity, then exposes the estimates and interval states by cutoff. These intervals describe the retained manually sampled panel conditional on the lexical cutoff; they are not population guarantees. Run `bash examples/geo-prompt-family-sensitivity.sh [observations.json] [output-directory]` to create the family CSV, pooled-versus-equal-family dashboard, leave-one-family-out influence CSV/dashboard, and threshold sweep together. Family rows mark articulation prompts whose removal splits the retained lexical component.
For family-weighted source discovery, use `--geo-answer-prompt-family-source-rarefaction-csv reports/family-source-discovery.csv` or render the same finite-panel curves and completeness exposure as an offline SVG dashboard with `--geo-answer-prompt-family-source-rarefaction-html reports/family-source-discovery.html`. The optional `--geo-answer-source-category hostname=label` mappings add categorized discovery; use `--geo-answer-prompt-family-source-rarefaction-sweep-csv reports/family-source-thresholds.csv` to check cutoff sensitivity. Render all threshold panels offline with `--geo-answer-prompt-family-source-rarefaction-sweep-html reports/family-source-thresholds.html`; the dashboard shares a 12,000-row value-table budget across cutoffs.
For baseline/current GEO source comparisons where wording changes, add `--geo-answer-baseline-observations previous.json --geo-answer-prompt-family-period-comparison-csv reports/family-source-period.csv` (or `--geo-answer-prompt-family-period-comparison-html reports/family-source-period.html` for an offline dashboard) alongside the current `--geo-answer-observations answers.json`. It aligns exact prompt groups through connected lexical families built over both samples, then reports provider prompt support, citation-event volume, observed domain gains/losses, event/rank source-mix divergence, matched-prompt mix changes, and the largest per-domain share shifts when detail is complete, with list/detail completeness and graph-cap metadata. Repeat `--geo-answer-source-category hostname=label` to add mapped category-mix divergence and mapped citation-weight coverage. Add `--geo-answer-prompt-family-period-comparison-sweep-csv reports/family-source-period-thresholds.csv` to compare the longitudinal results across the standard lexical cutoffs with one bounded graph. Use `--geo-answer-prompt-family-period-comparison-sweep-summary-csv reports/family-source-period-summary.csv` for one row per cutoff with equal-family means, family-bootstrap intervals, support, and cap states. Add `--geo-answer-prompt-family-period-comparison-sweep-html reports/family-source-period-thresholds.html` for an offline equal-family divergence trend chart with whole-family percentile-bootstrap intervals and cutoff-specific, highest-change detail capped at 1,000 rows. The dashboard reports why intervals are unavailable when graph/catalog caps, threshold row caps, too few supported families, or the shared draw budget limit them. Set `--geo-answer-prompt-family-threshold` for cutoff sensitivity; the families are a lexical comparison aid, not semantic intent labels.


`--geo-answer-domain-paired-reach-comparison-csv reports/domain-paired-reach.csv` compares each cited domain’s presence over matched exact prompts separately within each provider. Repeated captures are pooled to one presence state per prompt. The export reports matched/comparable support, gained/lost/both/neither counts, baseline/current reach and the paired percentage-point change, a leave-one-prompt-out range, exact McNemar p-values, prompt-cluster bootstrap intervals, and a Holm adjustment across testable provider/domain rows when prompt, domain, and per-prompt source detail is complete. A leading summary row records completeness and bootstrap resample budget. Capped per-prompt top-domain lists make absent domains unknown; those pairs are excluded from the point estimate and suppress the Holm family adjustment. This is a descriptive comparison of supplied samples, not an engine-visibility or causal measure. Add `--geo-answer-domain-paired-reach-comparison-json reports/domain-paired-reach.json` for the same typed rows and completeness summary as versioned JSON.

For page-level prioritization, `--geo-answer-page-opportunities-csv reports/page-opportunities.csv` ranks exact third-party URLs on complete provider/prompt groups where a configured owned domain was confirmed absent. Its cross-provider rows show provider-equal and pooled prompt reach side by side. `--geo-answer-page-opportunity-trends-csv reports/monthly-page-opportunities.csv` preserves UTC-month movement and compares matched prompts between sampled months with McNemar tests, Holm correction, and bounded paired-bootstrap intervals. Add `--fail-on-geo-answer-page-opportunity-monthly-rise 15` to alert CI on a significant competitor-page reach gain of at least 15 pp; the gate fails closed on incomplete source or comparison support. `--geo-answer-page-opportunity-path-families-csv reports/page-families.csv --geo-answer-page-opportunity-path-depth 2` groups confirmed opportunities by origin and URL prefix. Incomplete citation lists remain unknown, not confirmed gaps; these are sample prioritization signals rather than explanations for provider choices. Run `bash examples/geo-page-opportunities.sh` for exact-page and path-family exports, or `bash examples/geo-page-opportunity-trends.sh` for a monthly example.

Add `--geo-answer-page-opportunity-path-family-trends-csv reports/monthly-page-families.csv` to see whether complete no-owned prompt reach is concentrating in particular competitor URL prefixes over time. The report has zero-opportunity provider/month summaries, provider-equal and pooled cross-provider reach, and paired prompt-level family transitions with Holm-adjusted McNemar results. Use `--geo-answer-page-opportunity-path-family-trends-html reports/monthly-page-families.html` for a filterable offline chart and review tables. It reuses `--geo-answer-page-opportunity-path-depth`; families are URL-structure buckets and do not identify page semantics.

For CI, pair the path-family trends CSV with `--fail-on-geo-answer-page-opportunity-path-family-monthly-rise 15`; the gate fails on a significant matched-prompt rise of at least 15 pp and fails closed when support or completeness is insufficient. `--geo-answer-page-opportunity-path-family-monthly-gate-json reports/path-family-rise-gate.json` saves the decision and support.

To check whether the URL prefix choice changes the picture, `--geo-answer-page-opportunity-path-family-depth-sweep-csv reports/path-family-depths.csv` emits the same no-owned opportunity panel at depths 1 through 5. It retains a summary per depth and warns that broader and narrower prefixes overlap. Use `--geo-answer-page-opportunity-path-family-depth-sweep-html reports/path-family-depths.html` for a family-count chart and filterable detail. The combined CSV omits family detail if its shared row budget is exceeded.

For source-mix analysis, `--geo-answer-provider-source-divergence-csv reports/provider-source-divergence.csv` compares providers on shared exact prompts in one sample, while `--geo-answer-source-portfolio-drift-csv reports/source-portfolio-drift.csv` compares matched prompts across baseline/current observations. Add `--geo-answer-source-portfolio-drift-html reports/source-portfolio-drift.html` for an offline filterable dashboard with interval whiskers and headered filtered CSV download. `--geo-answer-source-portfolio-drift-json reports/source-portfolio-drift.json` exports typed summary/provider records for downstream analysis. Both report Jensen–Shannon divergence for raw citation events and reciprocal-log-rank-weighted source shares, with prompt-cluster intervals and explicit cap states; the drift report also counts source-presence transitions. These describe sampled source mixes; they do not estimate provider quality or causal effects.

`--geo-answer-source-network-csv reports/source-network.csv` maps provider-specific source co-citations across exact prompts. It exports provider summary rows, prompt reach, degree, weighted degree, PageRank, connected components, deterministic weighted label-propagation communities, and pairwise co-occurrence support with Jaccard, lift, and conditional rates. Community rows include within/between co-occurrence support, per-community modularity contribution, overall weighted modularity, and convergence states. Provider summaries make community count, largest community, modularity, retained nodes/edges, and completeness available without aggregating node rows. Modularity compares the retained partition with a degree-preserving random-graph reference; it does not indicate topic meaning. The graph is built from complete retained source lists, capped to the 100 most prompt-supported domains per provider, and reports provider/comparison/output caps.

Add `--geo-answer-source-network-comparison-csv reports/source-network-changes.csv` with baseline observations to see paired source reach, centrality, and edge co-citation transitions on shared exact prompts. Provider summary rows compare source-community partitions with the adjusted Rand index and report weighted-modularity drift; community-transition rows identify stable, split, merged, or reconfigured groups; node rows include period-local community IDs and whether each source's full membership changed. The report uses source detail complete in both periods, selects one joint top-domain catalog, and records community-visit, node-check, edge-update, transition, and output caps. Community stability describes the retained graphs and is complete only when both label-propagation runs converge without catalog truncation.

For source-list position sensitivity, `--geo-answer-rank-weighted-source-network-csv reports/rank-weighted-source-network.csv` builds a companion graph from complete reciprocal-log-rank citation weights. Edge strength combines co-citation prompt support with normalized rank shares; weighted degree/PageRank and rank-weighted communities reflect that strength. Rank-detail completeness and caps are reported separately from event-domain detail.

Use `--geo-answer-rank-weighted-source-network-comparison-csv reports/rank-weighted-network-changes.csv` with baseline observations to track higher-ranked source-share and co-citation-strength changes on matched prompts. It reports source reach, average rank share, centrality drift, edge gains/losses, adjusted-Rand community stability, weighted-modularity drift, exact source-community membership transitions and split/merge rows, and rank-detail uncertainty states without treating the observed sample as causal.

To review both event and rank-weighted community lineages interactively, add `--geo-answer-source-network-comparison-html reports/community-drift.html` alongside current and baseline answer observations. Filter by provider, row type, stable/split/merge/reconfigured lineage, support, or source/community search; switch from the detail table to a weighted community-flow diagram; then download the visible subset as spreadsheet-safe CSV or the flow as a standalone SVG. The page also summarizes equal-provider mean adjusted Rand similarity and modularity drift with each denominator.

To explore source networks visually, add `--geo-answer-source-network-html reports/source-network.html`. The offline dashboard switches between event and reciprocal-log-rank weighting and supports provider selection, domain search, minimum shared-prompt filters, pan/zoom, community-colored nodes, a provider-level community/modularity summary, clickable node details, and a keyboard-accessible source metrics table; it carries forward each CSV output-cap notice.

Compare provider co-citation structures with `--geo-answer-provider-source-network-overlap-csv reports/provider-network-overlap.csv`. It matches exact prompts, then reports pooled edge-support Jensen–Shannon divergence, distinct-edge catalog Jaccard, prompt-level edge Jaccard with a deterministic 1,000-resample prompt-cluster interval, and provider B edge gains/losses. Incomplete source lists are marked unknown, and provider-pair, prompt-check, edge-update, bootstrap-draw, and output-row budgets are explicit in the summary row.

With baseline and current answer observations, use `--geo-answer-provider-source-network-edge-drift-csv reports/provider-edge-drift.csv` to see whether each co-cited source pair’s B-minus-A reach gap widened or narrowed on exact prompts with complete source detail in all four provider/period cells. The report includes all four reach rates, the change in provider gap, and a leave-one-prompt-out range; prompt-cluster normal intervals and p-values require at least 30 matched prompts and nonzero interaction variance, with Holm correction for a complete eligible edge family. Add `--geo-answer-provider-source-network-edge-drift-html reports/provider-edge-drift.html` for an offline filtered review page that can download the visible rows.

For the edge-level view, add `--geo-answer-provider-source-network-edge-comparison-csv reports/provider-network-edges.csv`. Each provider/domain-pair row compares edge presence on shared exact prompts, with paired gains/losses, prompt-balanced reach difference, a nominal Newcombe interval, a leave-one-prompt-out sensitivity range, and a paired McNemar p-value. Holm-adjusted p-values are included only when the provider/edge catalog is complete; work, candidate-edge, support, and output caps are reported.

Add `--geo-answer-provider-source-network-edge-html reports/provider-network-edges.html` for a self-contained review page with provider-pair and domain filters, paired support counts, reach differences, confidence intervals, leave-one-prompt-out ranges, and Holm status. It uses the same bounded edge-comparison output and can download the visible rows as CSV.

When you pass `--geo-answer-owned-domain example.com`, use `--geo-answer-owned-source-network-gaps-csv reports/owned-network-gaps.csv` to find external source pairs that co-occur more often in exact prompts with no owned citation. It compares prompt-level pair presence against prompts where the owned site was cited, includes nominal rate-difference intervals and an owned-gap lift, and reports incomplete source detail and scan caps. Treat high-support pairs as review leads; the association does not show that those sites cause an owned-citation gap.

For entity/category analysis, combine repeatable `--geo-answer-entity` and `--geo-answer-source-category hostname=label` options with `--geo-answer-entity-source-categories-csv reports/entity-source-categories.csv`. The export compares category citation-event shares in captured answer text with and without each exact entity mention, split by provider and sampled month/topic/intent, with incomplete domain-detail states exposed. It also reports cap-aware Jensen–Shannon divergence between the two mapped-category event mixes. Add `--geo-answer-baseline-observations previous.json --geo-answer-entity-source-category-comparison-csv reports/entity-source-category-changes.csv` for period deltas; capped detail suppresses those comparisons. These are descriptive associations, not causal attribution.

With baseline/current answer observations, an entity, and an owned domain configured, `--geo-answer-entity-citation-position-comparison-csv reports/entity-citation-rank-changes.csv` compares first-position and top-three owned-citation event shares for answers with and without exact entity mentions, overall, by provider, and by retained month/topic/intent cohort. The CSV keeps owned-event denominators visible, labels one-period cohorts, and leaves shares blank when no owned citation events were captured. The entity mention export and dashboard also compare monthly mention, owned-coverage, and rank rates to the previous sampled month, retaining any skipped-month gap. With two or more configured entities, the dashboard and `--geo-answer-entity-co-mentions-csv reports/entity-co-mentions.csv` report exact-phrase pair overlap by provider and sampled month/topic/intent cohort, including conditional mention rates, snapshot/prompt Jaccard, co-mention lift against an independence baseline, and nominal Wilson intervals for pair rates. Add a baseline sample with `--geo-answer-entity-co-mention-comparison-csv reports/entity-co-mention-changes.csv` to compare pair rates, prompt overlap, and lift; capped absences are labeled unavailable. Mention and citation-coverage rates include nominal 95% Wilson intervals in JSON/CSV and the dashboard; repeated prompts can be correlated, so read those intervals as descriptive context.

When the same category mappings are configured, the entity opportunity CSV and HTML review panel group alternative cited domains by source category and show retained citation URL-event counts; capped domain lists remain marked incomplete.

When you configure `--geo-answer-owned-domain`, Aviary also profiles external domains that appear in the same captured answers as an owned citation. Use `--geo-answer-co-citation-csv reports/answer-co-citations.csv` to export pooled and provider-specific answer denominators, external citation-event shares, and bounded example URLs. This reports sample co-occurrence only; it does not imply endorsement, rank, or causation. Add `--geo-answer-baseline-observations previous.json --geo-answer-co-citation-comparison-csv reports/answer-co-citation-changes.csv` to compare provider-aware answer coverage and external citation-event share across retained samples, with explicit one-period-only and truncation states.

For each configured answer entity, `--geo-answer-entity-citation-domains-csv reports/entity-citation-domains.csv` compares domain-level citation-event shares in answer-text samples with an exact mention against samples without that mention, with provider and monthly cohort rows. It retains event and answer denominators and caps each group at 25 domains. This is a source-mix association, not sentence-level attribution or a causal explanation. Add `--geo-answer-baseline-observations previous.json --geo-answer-entity-citation-domain-comparison-csv reports/entity-citation-domain-changes.csv` to compare these shares across samples; both samples must use the same entity names and aliases.

For exact-URL analysis, add `--geo-answer-entity-citation-pages-csv reports/entity-citation-pages.csv`. It reports snapshot and prompt coverage, citation-event share, and source-list placement for each exact normalized cited URL, split by entity-mention status, provider, and supplied cohort; the dashboard and JSON include the same bounded profiles plus UTC-month rows. Monthly detail compares each page-cited month with its previous page-cited month, reports intervening calendar months, and tracks mention/non-mention prompt coverage and top-three placement changes; these trends are withheld when monthly detail is capped. With baseline/current observations, `--geo-answer-entity-citation-page-comparison-csv reports/entity-citation-page-changes.csv` joins exact URLs and shows mention/non-mention coverage, event-share and top-three movement, with cap-hidden rows kept separate from true sample presence. This describes captured samples and is not sentence-level attribution or visibility evidence.

For a CI guard on exact URLs, `--fail-on-geo-answer-entity-citation-page-prompt-coverage-drop 5` fails when a matched page’s distinct-prompt coverage among entity-mentioned answers falls by more than five percentage points. It requires complete retained page detail and non-empty mentioned-prompt denominators for every matched URL; one-period-only URLs remain sample-presence states.

`--fail-on-geo-answer-entity-citation-page-top-three-drop 5` also gates a matched page’s share of citation events in ranks 1–3 when the configured entity is mentioned. It fails closed unless every matched URL has entity-mentioned citation events in both periods and the exact-page comparison is complete.

For a CI guard, add `--fail-on-geo-answer-owned-citation-drop 5` alongside current and baseline observation files and `--geo-answer-owned-domain`. Aviary exits with status 1 only when the measured owned-citation answer-coverage decrease is greater than the supplied percentage-point threshold. To inspect every owned rank-bucket shift, use `--geo-answer-owned-rank-comparison-csv reports/owned-rank-changes.csv` with both samples. For a capture-frequency-resistant view, add `--geo-answer-owned-prompt-rank-comparison-csv reports/owned-prompt-ranks.csv`: it pools repeated captures within each provider/prompt, averages providers within each exact prompt, and gives every matched prompt equal weight. The CSV has an overall row with a paired-prompt bootstrap interval, per-provider summaries, and pseudonymous prompt-fingerprint rows; raw prompt text is not exported. The comparison also measures the prompt-balanced mean reciprocal rank (MRR) of each answer’s first owned citation, where higher values mean earlier placement. Use `--fail-on-geo-answer-owned-prompt-balanced-first-position-drop <pp>`, `--fail-on-geo-answer-owned-prompt-balanced-top-three-drop <pp>`, or `--fail-on-geo-answer-owned-prompt-balanced-mrr-drop <pp>` to gate the corresponding equal-prompt means; the `-lower-ci` variants gate only when the lower 95% bootstrap bound on decline clears the threshold. Point gates require two matched prompts by default, CI gates ten; set `--fail-on-geo-answer-owned-prompt-balanced-rank-min-matched-prompts` to choose another support floor. Gates fail closed when retained prompt detail is capped. To watch rank-one prominence without requiring answer text, use `--fail-on-geo-answer-owned-first-position-drop 5`; it compares the owned-citation event share at rank 1. To watch top-three prominence, use `--fail-on-geo-answer-owned-top-three-drop 5`; it compares the share of owned citation events in ranks 1–3 and fails closed when either sample has no owned citation events. To isolate that rank gate to answers with exact brand mentions, use `--fail-on-geo-answer-entity-owned-top-three-drop 5`; it requires both periods to contain mentions and owned citation events for each entity. Use `--fail-on-geo-answer-length-owned-top-three-drop 5` to gate a decline in paired-prompt owned top-three share within matched answer-length bands. It requires complete profiles and the same owned-domain set; every matched band must meet the prompt-support floor or the gate exits nonzero as incomplete. Each band needs two shared exact prompts with owned citations in both periods by default; tune support with `--fail-on-geo-answer-length-owned-rank-min-matched-prompts 10`. To catch rank-one movement separately, add `--fail-on-geo-answer-length-owned-first-position-drop 5`; for the conservative uncertainty-aware version, use `--fail-on-geo-answer-length-owned-first-position-drop-lower-ci 5`. Both share the same matched-prompt floor and incomplete-band behavior. For a conservative CI guard, use `--fail-on-geo-answer-length-owned-top-three-drop-lower-ci 5`: it fails only when the deterministic paired-prompt 95% bootstrap lower bound for mean decline exceeds five points, and defaults to ten matched prompts per band. To gate earlier/later owned-source placement itself, `--fail-on-geo-answer-length-owned-mrr-drop <pp>` checks the exact-prompt-balanced first-owned-citation MRR decline within each band; `--fail-on-geo-answer-length-owned-mrr-drop-lower-ci <pp>` uses the lower 95% paired-prompt bootstrap bound and defaults to ten prompts. Both fail closed when prompt-rank detail or support is incomplete. Short/long answer mix shifts do not trigger these within-band gates. For answer-text brand mention monitoring, `--fail-on-geo-answer-entity-mention-drop 5` fails when any configured entity’s exact mention rate falls beyond five points and fails closed if either sample has no answer text. Add `--fail-on-geo-answer-sample-mix-divergence 0.2` to fail when any provider pair has a topic/intent snapshot-mix divergence above 0.2 (0 means identical mix; 1 means maximally distinct). This is a sampling-balance guard, not a visibility metric. These gates are sample-based; keep provider, model, prompt, and collection conditions as consistent as practical.

To catch citation-coverage losses hidden by snapshot volume, add `--fail-on-geo-answer-provider-balanced-citation-drop 5` with baseline and current observations. It averages the change in citation coverage for each matched exact prompt equally within each provider, then fails if any provider’s mean decline exceeds five percentage points. Repeated snapshots still determine the rate inside a prompt; prompt groups receive equal weight. The gate fails closed when matched prompt detail is truncated or incomplete.

To track citation reach across the prompt panel, add `--fail-on-geo-answer-owned-prompt-coverage-drop 5` with baseline/current observations and `--geo-answer-owned-domain`. Each exact prompt/provider row counts once if any captured snapshot cites an owned domain. The gate compares the share of shared prompts with an owned citation per provider and fails on declines greater than five percentage points; incomplete prompt detail fails closed. Current reports also show distinct prompt reach overall and by provider, separate from snapshot coverage and citation-event share. Labeled topic/intent cohorts now report this unique-prompt reach overall and by provider in JSON, HTML, and `--geo-answer-cohorts-csv`. With baseline/current samples, `--fail-on-geo-answer-cohort-owned-prompt-coverage-drop 5` fails when a matched provider/topic/intent cohort’s owned-cited prompt reach drops by more than five percentage points. It requires complete cohort detail and owned domains; each period has its own prompt denominator, so the gate is sensitive to sample composition. Add `--fail-on-geo-answer-cohort-owned-mrr-drop 5` to guard first-owned-citation placement within every matched topic/intent/provider cohort. It compares prompt-balanced MRR separately in each period, requires at least two owned-cited prompts per cohort/period by default, and fails closed when any matched cohort is incomplete; use `--fail-on-geo-answer-cohort-owned-mrr-min-prompts` to set the support floor. Prompt sets can differ between periods, so the gate is sample-composition-sensitive. For longitudinal CI monitoring, `--fail-on-geo-answer-cohort-monthly-owned-mrr-drop 5` checks each cohort's latest sampled-month transition in the observation file, including gaps between sampled months. It requires uncapped monthly detail and at least two owned-cited prompts in both samples by default; a support override is available with `--fail-on-geo-answer-cohort-monthly-owned-mrr-min-prompts`. The two months are balanced independently, so this point-estimate gate is descriptive and sample-composition-sensitive. For a within-panel trend, use `--fail-on-geo-answer-cohort-monthly-paired-mrr-drop 5`; it compares the exact prompts with owned citations in both months, and the paired `-lower-ci` variant fails only when the 95% paired-prompt bootstrap interval confirms a decline beyond the threshold. The point gate defaults to two shared prompts and the interval gate to ten; `--fail-on-geo-answer-cohort-monthly-paired-mrr-min-matched-prompts` overrides the floor. Reports also show shared, prior-only, and current-only owned-citing prompts so rank movement is visible separately from prompt-panel turnover. Monthly prompt reach also reports Wilson intervals, reach movement on all exact prompts shared by the two sampled months, gained/lost prompt counts, a paired-prompt bootstrap interval, and exact McNemar p-value. Each series’ latest transition also reports a Holm-adjusted McNemar value across the provider/topic/intent family; the adjustment is withheld when monthly rows or paired prompt evidence are incomplete. These p-values remain descriptive because manually selected prompt groups may be correlated. Use `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop 5` for a paired point gate or add `-lower-ci` to require the 95% interval to confirm the decline; the matched-prompt floor defaults to two or ten respectively and is configurable with `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-min-matched-prompts`. For familywise screening across provider/topic/intent cohorts, `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-decline 5` requires a paired decline beyond five points and an adjusted p-value at or below 0.05; change the cutoff with `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-alpha`.

Export the current owned-citation reach summary with `--geo-answer-owned-prompt-coverage-csv reports/owned-prompt-coverage.csv`. It includes one overall row and one row per provider, with distinct prompt and snapshot denominators alongside owned citation-event share and a nominal 95% Wilson interval for the prompt-level rate. The interval describes the manually selected prompt panel; semantically related prompts may remain correlated. With baseline/current samples, `--geo-answer-owned-prompt-reach-period-csv reports/owned-prompt-reach-changes.csv` compares only matched provider/exact-prompt groups, counts retained/gained/lost/neither states, and adds a prompt-cluster bootstrap interval, a leave-one-prompt-out reach-delta range, a two-sided exact McNemar p-value for discordant prompt transitions, and a Holm-adjusted p-value across providers when matched prompt detail is complete; prompts missing from either period are excluded. Treat the p-values as a descriptive screen because prompts are manually selected and may be correlated. For follow-up work, `--geo-answer-owned-prompt-opportunities-csv reports/owned-prompt-opportunities.csv` lists exact provider/prompt groups with no owned-citing snapshot, separating prompts with no captured citations from prompts whose snapshots cite other domains. It includes snapshot counts, observed dates, retained top cited domains, and explicit domain/prompt-catalog truncation; these are sample review cues, not competitor or source-quality scores. Add `--geo-answer-competitive-gaps-csv reports/competitive-gaps.csv` to expand no-owned-citation provider/prompt groups into one row per retained alternative domain, with citation-event counts and within-prompt citation-event shares. Rows are ordered by repeated sample support and cite frequency; domain and prompt caps stay explicit. These measures describe the captured citation lists, not competitor quality or answer-level probability. Add `--geo-answer-provider-owned-gaps-csv reports/provider-owned-gaps.csv` to find exact normalized prompts where one provider cited an owned domain and another did not; it includes each side’s snapshot support, date range, and retained domains, and prioritizes gaps with more observations. The answer HTML also compares owned-cited reach over each provider pair’s shared exact prompts and shows the ten highest-support gaps. Repeat `--geo-answer-source-category hostname=label` to add operator-assigned alternative-source categories; the CSV and dashboard mark category detail incomplete when cited-domain profiles are capped. With a baseline, `--geo-answer-provider-owned-gap-comparison-csv reports/provider-owned-gap-changes.csv` tracks each exact prompt/provider pair’s owned-citation state across both samples, retaining only prompts present for both providers in both periods and prioritizing changed states. The four states distinguish both providers, either provider, or neither citing an owned domain. `--geo-answer-competitive-gap-comparison-csv reports/competitive-gap-changes.csv` separately compares alternative-domain event shares for matched provider/prompt groups, but only in periods where every snapshot lacked an owned citation. It marks one-period gaps, unsampled prompts, top-domain truncation, and the prompt-catalog cap; hidden domains remain unknown.

For explicit entity visibility, add optional `answerText` to selected snapshots and repeat `--geo-answer-entity "Aviary=Aviary checker|Aviary SEO"`. Matching is case-insensitive, literal, and bounded by Unicode letter/number boundaries; Aviary does not infer synonyms or sentiment. The dashboard and `--geo-answer-entity-mentions-csv reports/entity-mentions.csv` compare mention rates, repeated match counts, first-third share, median first-mention position, and captured citation coverage for answers with and without each mention, with provider breakdowns and monthly topic/intent/provider trends. If `--geo-answer-owned-domain` is configured, the same table separates owned-citation coverage. Raw answer text stays local; reports retain aggregate counts, rates, and bounded cited-domain associations. If you compare a baseline period, use the same entity and alias flags on both samples to get mention-rate and citation-coverage deltas.

For prompt-level diagnosis, add `--geo-answer-entity-prompt-details-csv reports/entity-prompt-details.csv`. It exports exact prompt/provider/entity rows with mention-rate and mention-conditioned citation-coverage Wilson intervals, plus owned-citation coverage intervals when owned domains are configured and top-three owned placement. Repeated snapshots are summarized within each prompt/provider row; because repeated prompts may be correlated, these intervals are descriptive. Output is capped and reports truncation; prompts are included in the CSV, while raw `answerText` is never exported. With baseline/current samples, `--geo-answer-entity-prompt-comparison-csv reports/entity-prompt-changes.csv` compares shared prompt/provider/entity outcomes and labels one-period and cap-hidden rows separately.

For a prompt-matched view of entity/citation association, use `--geo-answer-entity-prompt-matched-association-csv reports/entity-prompt-matched-association.csv` with configured entities and owned domains. It compares owned citation reach, top-three reach, and first-position reach in entity-mentioned versus non-mentioned answers on the same provider, exact-prompt, UTC-month, and recorded model/surface/locale/topic/intent context, excluding incomplete citation lists. Each matched context-month stratum is averaged within its prompt before equal-prompt estimates and bounded prompt-cluster intervals; snapshot-weighted differences are included for context. Exact two-sided sign tests count positive, negative, and tied prompt differences and use a Holm correction across the entity/provider/metric family; bootstrap intervals remain unadjusted. Prompt IDs are hashed, and answer/prompt text is omitted. Add `--geo-answer-entity-prompt-matched-association-html reports/entity-prompt-matched-association.html` for a filterable offline chart and detail table. The descriptive association does not establish causation. See `bash examples/geo-entity-prompt-matched-association.sh` for a synthetic example.

For a prompt-mix-aware CI check, `--fail-on-geo-answer-entity-prompt-mention-drop 5` compares the snapshot-weighted entity mention rate only across matched exact prompt/provider rows. It fails closed if retained prompt detail is incomplete or any matched row lacks answer text on either side.

To keep cross-provider comparisons on comparable prompt panels, add `--fail-on-geo-answer-provider-prompt-overlap-below 0.5`. It requires every provider pair’s whole-sample exact-prompt Jaccard to meet 0.5, counts each normalized prompt once, includes pairs with zero overlap, and fails closed if the prompt catalog is capped. Pair this with the topic/intent mix gate when labeled sampling balance also matters.

Add `--fail-on-geo-answer-provider-min-prompts 20` to require at least 20 distinct exact prompt groups per provider. This guards against treating a tiny provider sample as comparable even when its prompt overlap is high; snapshot volume does not increase the prompt count.

For baseline/current support, `--fail-on-geo-answer-provider-min-matched-prompts 20` requires at least 20 shared exact prompts for every provider appearing in either period. Providers with no shared prompts count as zero, and capped comparisons fail closed.

The answer dashboard also shows the first 100 whole-sample provider-prompt pairs. For a full reviewable breakdown, add `--geo-answer-provider-prompt-overlap-csv reports/provider-prompt-overlap.csv`. It exports each provider pair’s prompt counts, shared and exclusive prompt groups, and Jaccard. When the prompt catalog is capped, counts describe retained detail and the Jaccard is blank.

To inspect where providers cite different sources for the same exact prompt, export `--geo-answer-provider-prompt-source-overlap-csv reports/provider-prompt-sources.csv`. Rows show each provider pair’s citation coverage, retained domain lists, shared domains, and domain Jaccard when both lists are complete. Per-provider domain lists are capped at ten; the export caps at 20,000 comparison rows and marks catalog or row truncation.

For a gate that gives each matched exact prompt/provider row equal weight, use `--fail-on-geo-answer-entity-prompt-balanced-mention-drop 5`. It fails when the per-entity mean of row-level mention-rate changes drops by more than five points, and it uses the same fail-closed completeness rules.

To prevent a low-support comparison from silently passing CI, add `--fail-on-geo-answer-entity-prompt-min-matched-prompts 20`. It requires at least 20 distinct exact prompts per entity with answer text in both periods, counts a prompt once across providers, and fails closed when the matched-prompt detail is capped.

To compare providers on the same prompts, use `--geo-answer-entity-prompt-provider-pairs-csv reports/entity-prompt-provider-pairs.csv`. The dashboard and CSV show each provider’s retained date range. It reports provider-level pooled mention rates with nominal 95% Wilson intervals and a Newcombe-Wilson interval for the pooled rate difference, alongside equal-prompt mean rates, mean/median prompt-level changes, and prompt-cluster bootstrap intervals for equal-prompt mean mention-rate and citation-coverage differences. Mention-conditioned coverage levels include Wilson intervals, with owned-citation coverage intervals when configured; top-three share is separate. Repeated snapshots are resampled within exact prompt groups; semantically related prompts may still be correlated, so intervals are descriptive. Prompts without answer text on either side remain counted but do not enter rate comparisons; pair detail has explicit truncation flags.

To see which site sections supply citations in the captured sample, add `--geo-answer-path-depth 1` through `5` and optionally `--geo-answer-path-family-csv reports/answer-path-families.csv`. Path families group normalized citation URLs by origin and their leading path segments, then report distinct pages, citation-event share, answer coverage, providers, source-list positions, and observed dates. Shares use only the supplied answers and cited URLs; this is a sample description, not a visibility or quality score. Add `--geo-answer-path-family-cohorts-csv reports/path-family-cohorts.csv` to split path-family coverage by provider and supplied topic/intent. Its snapshot denominator includes all observations in each cohort, even those with no citations; event share uses citations within that same provider/cohort. Each family row also compares cohort event share with the family’s whole-sample share: a ratio of 1.00× means equal share, above 1 means the family has a larger share in that cohort, and below 1 means smaller. This is a descriptive mix comparison, not a visibility or quality score. Snapshot coverage includes a nominal 95% Wilson interval; a separate prompt-balanced coverage rate counts each distinct normalized prompt once, including prompts with no citations, and includes its own nominal interval. Repeated or semantically similar prompts may correlate, so these are descriptive, not significance tests. `--geo-answer-path-family-trends-csv reports/path-family-monthly.csv` applies these measures by UTC month, provider, and supplied cohort. Monthly rows compare the cohort share with the same family’s share across providers in that month; the ratio is withheld when the monthly family denominator is incomplete due to a detail cap. When monthly cohort detail is complete, the trend export also compares each family/provider/cohort ratio with the previous month that retained citations for that family; intervening months can contain snapshots but have no family row. Aggregation caps suppress this comparison. The cohort detail is bounded, and truncated reports mark rows omitted by the aggregation cap. With baseline/current files, `--geo-answer-path-family-cohort-comparison-csv reports/path-family-cohort-changes.csv` compares cohort snapshot coverage, prompt-balanced coverage, and within-cohort event shares; one-sided rows hidden by caps remain explicit and do not receive zero-filled deltas. In CI, `--fail-on-geo-answer-path-family-coverage-drop 5` fails when any comparable provider/cohort path-family snapshot-coverage decline exceeds five percentage points; it fails closed if retained cohort detail is capped or no family is comparable. Add `--fail-on-geo-answer-path-family-prompt-coverage-drop 5` to fail when the distinct-prompt share citing a matched family drops by more than five percentage points; it fails closed on capped or incomparable detail. Add `--fail-on-geo-answer-path-family-over-index-drop 0.25` to fail when a matched family’s ratio against its whole-sample share falls by more than 25% relative to baseline; that gate also requires complete detail.

With configured `--geo-answer-entity` aliases and answer text, `--geo-answer-entity-path-families-csv reports/entity-path-families.csv` compares cited path-family snapshot coverage, distinct-prompt coverage, citation-event share, and source positions between answers that mention each entity and answers that do not. Add `--html` to see the same bounded analysis in the dashboard; JSON retains aggregate counts only and never includes captured answer text. The comparison is descriptive co-occurrence, not a causal or visibility score.

`--geo-answer-entity-path-family-monthly-csv reports/entity-path-families-monthly.csv` adds UTC-month provider/topic/intent slices; the offline dashboard includes the recent monthly rows. Monthly groups with no retained family citation have no family row and should not be read as zero-activity calendar gaps. Rows also compare entity-mentioned and non-mentioned prompt coverage, their gap, and top-three source share with the previous family-cited month; intervening months may still contain observations, while any detail cap suppresses these deltas.

With `--geo-answer-baseline-observations previous.json`, `--geo-answer-entity-path-family-comparison-csv reports/entity-path-family-changes.csv` reports mention/non-mention coverage, event-share, and source-list placement movement with explicit one-sided and cap-hidden sample states. For CI, `--fail-on-geo-answer-entity-path-family-prompt-coverage-drop 5` fails if any matched entity-mentioned family loses more than five percentage points of distinct-prompt coverage. `--fail-on-geo-answer-entity-path-family-top-three-drop 5` gates declines in that family’s share of citation events placed in ranks 1–3 when the configured entity is mentioned; both gates fail closed when detail is capped or comparable denominators are missing.

For period movement, pass the same `--geo-answer-path-depth` with `--geo-answer-baseline-observations previous.json` and add `--geo-answer-path-family-comparison-csv reports/answer-path-changes.csv`. Matched families get event, answer-coverage, page-count, and source-position deltas; baseline-only/current-only families remain explicitly labeled as sample presence.

Compare two sampled answer-citation files with `--geo-answer-observations current.json --geo-answer-baseline-observations previous.json`. Add `--geo-answer-comparison-csv reports/answer-period.csv` for a spreadsheet-safe matched-prompt export, or `--geo-answer-cohort-comparison-csv reports/answer-cohorts.csv` for matched and one-period-only topic/intent/provider rows. The report adds exact provider/prompt and labeled cohort coverage deltas, sample denominators, observed date ranges, and top cited domains; it marks capped detail incomplete and labels unmatched cohort rows as sample presence rather than lost or gained visibility. Prompt and topic/intent rows include provider-specific sample profiles. With matching owned domains, labeled cohorts also compare the unique prompts with at least one owned-citing snapshot per period; these separate-period reach rates can reflect sample composition. Add `--geo-answer-provider-position-comparison-csv reports/provider-position-changes.csv` to compare exact cited URLs by provider across periods, including first/top-three shares, mean/median source position, and per-rank-bucket event/share changes; one-period-only pairs remain sample-presence rows. `--geo-answer-provider-pairs-csv reports/provider-pairs.csv` additionally compares provider labels within the current sample on exact normalized prompts that appear under both labels within a matching cohort or the unlabeled group, reporting snapshot-weighted and equal-prompt mean coverage, mean/median prompt-level deltas, a deterministic prompt-cluster bootstrap interval for the mean delta when at least two shared prompts are present; the interval is descriptive because semantically related prompts can remain correlated. When owned domains are configured, it gives owned-citation snapshot coverage the same equal-prompt mean and bootstrap treatment, and reports distinct-prompt owned-citation reach on shared prompts with paired A-only/B-only/both/neither outcomes and a prompt-cluster bootstrap interval for the reach gap. It also reports distinct-host and event-weighted citation-domain overlap. See the [current sample](examples/geo-answer-observations.example.json), [baseline sample](examples/geo-answer-observations.baseline.example.json), and [GEO guide](docs/GEO.md).

Matched provider/prompt period rows also include `citationDomainJaccard` and the CSV column `citation_domain_jaccard`. This is the distinct cited-domain Jaccard between baseline and current for that prompt/provider pair; it is blank when either retained top-ten domain list is capped or neither period has citations.

Analyze first-party Bing Webmaster AI Performance exports with `aviary --bing-ai-csv export.csv --geo-audit-json reports/site.json --json`; add `--html reports/bing-ai.html` for a searchable, self-contained report. Repeat the CSV option to combine page, query, topic, intent, and time-series exports. When a file has both topic and intent dimensions, Aviary adds an intersection cross-tab. Query-page mapping exports also receive an exact-phrase overlap report showing phrases mapped to several cited URLs and URLs mapped from several phrases; for each phrase the report can show largest-page citation share, Herfindahl concentration, and effective cited-page count with citation-metric coverage made explicit. This is a review aid for sampled rows, not a cannibalization, quality, or ranking diagnosis. With `--geo-audit-json`, each phrase group adds its current audit coverage, Bingbot access, preview restrictions, measured answer/source structure, and declared language tags with BCP 47 validity when available, plus per-URL audit match/access signals. The HTML can filter groups with crawler blocks, indexing or snippet restrictions, invalid language tags, incomplete audit matches, or no audit. These current snapshots can postdate the export and do not explain the mapping. Compare page-citation periods with `--bing-ai-baseline-csv previous.csv --bing-ai-csv current.csv`; only URLs present in both exports get citation-count deltas. Per-URL average citation-share changes are separately reported in percentage points, never summed; one-file URLs remain export-only because Bing reports sampled observations. Use `--bing-ai-query-baseline-csv previous-query-page.csv --bing-ai-csv current-query-page.csv` to compare exact phrase/URL mappings across two query-page exports; shared-pair citation deltas require metrics in both periods, and export-only rows remain unknown under Bing sampling. Use `--bing-ai-topic-baseline-csv previous.csv --bing-ai-csv current.csv` when both exports carry topic and intent labels; the comparison shows cohort row/citation changes, measured citation-share shifts within labeled rows, and normalized query phrase turnover with bounded samples. It keeps taxonomy labels exact apart from case/whitespace normalization; labeled-row shares and row sums describe sampled exports, not all prompts or property activity. The offline report shows phrase and page-map states with capped URL-pair detail. The structured output declares `schemaVersion: 1` and follows the [Bing analysis schema](docs/bing-ai-report.schema.json). `--geo-audit-json` accepts a full audit or the version 1 compact GEO summary. Correlation matches exact audit URLs first, then a unique declared canonical URL, and includes current Bingbot controls plus present/absent/not-assessed groupings for observed page-content structures.

For Excel workbooks, pass one or more `--bing-ai-xlsx` files; Aviary scans up to 32 worksheets and analyzes each recognized table as a separate export view. The importer caps workbooks at 25 MiB compressed, 128 MiB expanded, 100,000 non-empty rows, and 256 columns per row. Formula expressions are never evaluated; only cached scalar values are read. A `--geo-platform-matrix` run requires the workbook to contain exactly one recognized Bing table.
Page, query-page, and topic/intent comparisons also accept `--bing-ai-baseline-xlsx`, `--bing-ai-query-baseline-xlsx`, and `--bing-ai-topic-baseline-xlsx`. Each XLSX baseline must contain exactly one recognized table for the selected comparison.

To see which URLs appear in both Google's Search generative AI report and Bing's page-citations export, use `--geo-platform-matrix` with one page export from each service. Aviary normalizes URLs and can use `--geo-audit-json` to bridge a unique declared canonical URL; ambiguous canonical matches remain separate. Matched pages also carry current crawler/preview controls and compact page-content signals from the audit. The summary also shows each current control group’s separate share of Google impressions and Bing citations, with audit-time caveats. When a saved audit measured the answer-content profile, JSON and HTML group joined pages by declared document language, report BCP 47 tag validation when available, and keep Google impression and Bing citation sums separate; language is an audit-time snapshot and may postdate either export. Each page also gets its share of its own platform's usable-URL row sum; the Google-minus-Bing percentage-point gap is a distribution review cue across distinct measures, not a comparative performance score. The summary reports how much of each platform's metric total falls on URLs listed in both exports, plus the median absolute percentage-point share gap across the full URL join. Optionally pass `--geo-sitemap` with a same-origin sitemap or index to review export-page list membership and the platform metric shares on listed page groups; absence from this one list is not an indexing or citation finding. Add `--geo-path-depth 1` through `5` to group URL observations by origin and leading path segments, with separate platform metrics, current audit-control counts, and sample URLs. Save an initial matrix with `--output reports/matrix-previous.json`, then pass `--geo-platform-baseline-json reports/matrix-previous.json` with new exports to compare Google impressions and within-Google share changes separately from Bing citation and within-Bing share changes; HTML includes the page-level period table and CSV adds comparison columns. Matrices built with the same `--geo-path-depth` also compare family-level movement. The comparison only covers URLs retained by the saved matrices, and source matrices capped at 1,000 page rows are marked incomplete. The HTML plots shared page shares, filters coverage, current audit/control states, invalid language tags, sitemap membership, and absolute gaps of at least 5 or 15 points, and sorts by gap or platform metric; `--csv` writes one spreadsheet-friendly row per returned page including sitemap membership when assessed. The matrix labels URLs present in only one input as export-only. Add `--html` to create an offline searchable page matrix with coverage filtering, language coverage, and source URL details. The version 1 JSON output follows the [platform matrix schema](docs/geo-platform-matrix.schema.json). It does not equate Google impressions with Bing citations or interpret a missing export row as zero activity.

Inspect claimed AI crawler requests from local Apache/Nginx combined, AWS CloudFront standard, or JSONL access logs with repeatable `--geo-crawler-log` inputs; gzip rotated files are supported. CloudFront standard rows are parsed according to their `#Fields:` header, including reordered fields. JSONL accepts common case/underscore variants and Cloudflare HTTP request fields such as `ClientRequestURI`, `ClientRequestUserAgent`, `EdgeResponseStatus`, and `OriginResponseStatus`; when both statuses are present, edge/origin disagreements are summarized per path. Cloudflare origin status `0` means no origin response and an edge-served response, so mismatches are diagnostic rather than automatic failures. Aviary groups Googlebot, Bingbot, OpenAI, Anthropic, and Perplexity user-agent tokens by provider/activity, then summarizes status codes, paths, and daily requests. Path rows include first/last observed timestamps, log-relative recency, frequent status codes, and logged response media types. The same report compares status classes, frequent codes, and media types for exact paths shared by search-crawler and training-data-crawler tokens separately, and flags 2xx versus 4xx/5xx splits for investigation; these comparisons do not explain a cause or authenticate the bot. It also ranks up to 50 crawler 4xx/5xx failure hotspots across all observed paths, including those outside the frequent-path list, with sample-wide and per-path failure shares. The report additionally recognizes OpenAI's documented `utm_source=chatgpt.com` marker and supports exact custom `utm_source` labels through `--geo-ai-referral-source Label=value`; these aggregates count tagged requests, not sessions, and omit query values. Tagged referral paths also show bounded logged response media types when available; these headers do not describe response-body quality. The ranked paths are investigation leads, not cause attribution. Each file remains a separate analysis. Query strings, request hosts, raw referral values, referrers, IP addresses, and raw user-agent strings are omitted; claimed user-agent matches are unverified and are not evidence of indexing or citations. Add `--geo-crawler-token` for emerging or private tokens, which stay unclassified. Pair `--geo-audit-json` with `--geo-crawler-origin` to join crawler and tagged-referral paths against a current GEO audit; this is a path-only snapshot correlation, so scope log inputs to the audited host. Referral path matches show current page controls and content signals for up to 100 retained paths per source. They also compare exact referral paths with search-crawler and training-crawler request counts, failures, tokens, and last-seen times from the same supplied logs; list truncation is surfaced, and no sequence or cause is inferred. Crawler page coverage groups audited URLs by log-relative recency, with a separate unknown-timestamp count. These bands describe the supplied sample and are not current freshness claims. Or pair `--geo-robots-txt` with `--geo-robots-origin` to replay retained log paths against a local robots.txt snapshot, including paths outside the page audit; it shows current rules separately from historical HTTP status. Add `--html` for a searchable offline report. The version 1 JSON follows [the access-log schema](docs/ai-crawler-log-report.schema.json).

For a declared-update versus visit comparison, add `--geo-crawler-sitemap https://example.com/sitemap.xml --geo-crawler-origin https://example.com` to a crawler-log run. Sitemap indexes are followed within same-origin and size limits; `--geo-crawler-sitemap-max-urls` sets a 1–10,000 page cap (default 1,000). The report compares valid `<lastmod>` calendar days with each crawl-like token's latest retained request day, highlights pages where the declared update is later, and surfaces missing dates and ambiguous query/duplicate paths. JSON includes per-token counts and up to 500 high-request update opportunities. Add `--geo-audit-json` to compare sitemap dates with valid normalized JSON-LD `dateModified` days on unique audited paths, keeping differing, missing, multiple, invalid, unassessed, and ambiguous values separate. Same-day comparisons are indeterminate; capped log paths and sitemap URLs are marked. This is a comparison of publisher-declared dates and a supplied log sample, not a provider recrawl schedule. Google uses `<lastmod>` only when it is accurate and reflects significant changes, and sitemaps are crawl hints rather than guarantees; see [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
The optional `llms.txt` inventory also classifies Markdown links in found files: same-origin and external web targets, relative references, repeated destinations, unsupported schemes, and malformed or empty-label links. It recognizes inline `[label](destination)` syntax, profiles only the first 64 KiB, stores no target strings, and does not follow the links. Relative links can also count as same-origin. This is a structure inventory for the optional convention, not a search requirement.

When crawler logs are joined to a saved GEO audit with `--geo-audit-json` and `--geo-crawler-origin`, path details also show measured question/answer structure, visible author/date markers, source-link and inline-citation counts, and unresolved citation targets. The summary totals requests on matched paths where these signals are present. Coverage labels distinguish measured zeroes from signals the audit did not run or assess; all page signals are current audit observations that may postdate the log.

For optional source-address review, `--geo-crawler-ip-ranges config/ai-crawler-ranges.json` compares logged client addresses with operator-supplied IPv4/IPv6 CIDRs. The result reports counts only; range membership is not crawler authentication, and Aviary does not refresh provider ranges. See the [CIDR schema](docs/geo-crawler-ip-ranges.schema.json) and [documentation-only example](examples/geo-crawler-ip-ranges.example.json).

When crawler logs are joined to a saved GEO audit, the offline report also includes a review queue ordered by request share within each crawler token sample, then raw request count; each row shows its token denominator for matched paths with measured policy, response, answer-structure, or citation-evidence prompts. It distinguishes explicit measured gaps from unassessed signals, reports token/path rows and their request counts, and marks capped coverage. Treat it as a page-review aid; it does not score pages or predict citations.

When CloudFront standard logs or JSONL exports contain known timing fields, crawler, path, and UTC-day summaries show approximate p50/p95 bands for response duration and time to first byte, alongside the number of requests with usable timing. These fields are interpreted in their documented seconds or explicitly named milliseconds. Loggers measure different intervals, so compare like sources and treat them as server observations rather than user-perceived latency. See the [CloudFront log fields](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logs-reference.html) and [Nginx log variables](https://nginx.org/en/docs/http/ngx_http_log_module.html).

CloudFront `x-edge-result-type` and `x-edge-response-result-type` are grouped by crawler and path when present. Aviary shows each bounded category and how often both fields were present but differed; unknown labels are counted as `Other`. The two values are CloudFront classifications recorded at different points in response delivery, not a standalone cache diagnosis. See the [CloudFront standard logging reference](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logs-reference.html).

Saved crawler-log period comparisons also show per-crawler CloudFront result-category share changes when both snapshots include those fields. The two fields use separate sample denominators; paired disagreement uses only rows with both values.

`utmSourceAttributionCoverage` reports configured source matches, unconfigured single-value markers, conflicting values, and empty or oversized values without exposing unmatched strings or treating them as AI traffic. CLI and HTML reports also show marker share against all parsed requests, which makes period-size changes easier to interpret. In the audit join, a same-path crawler sum is a lower bound when a truncated crawler list omits that path; a missing path is shown as incomplete rather than zero.

Cloudflare JSONL exports can also supply `BotScore`, `BotScoreSrc`, and `VerifiedBotCategory`. Aviary summarizes the documented score groupings, score sources, and verified-bot category observations for matched crawler-token requests. Each failure hotspot reports whether Cloudflare fields were available, how many requests carried verified-bot evidence, and how many such requests received 4xx/5xx responses. `SecurityAction` and `SecurityActions` add edge block/challenge outcomes by crawler and correlate those logged actions with failed paths. These fields are optional and may depend on Cloudflare plan/export configuration; Cloudflare verification annotations add evidence but do not authenticate the named crawler identity.

Save an access-log report with `--output`, then compare the next sample using `--geo-crawler-baseline-json`. The comparison tracks crawler request/failure rates, Cloudflare evidence coverage, tagged-referral request/error rates, retained path changes, and counts of configured/unconfigured/conflicting UTM markers across similarly scoped periods. Unmatched values stay private and are not assumed to be AI sources; older reports without marker-coverage data show it as unavailable. Path-only list differences are bounded observations, not proof of a crawler starting or stopping. Keep exact referral UTM mappings the same in both reports.
Add `--fail-on-new-geo-crawler-failures` in CI to fail when a retained path gains 4xx/5xx responses, a crawler's failure rate rises, or the path comparison is truncated.
Add `--fail-on-new-ai-referral-failures` with the same baseline to fail on rising configured referral-source failure rates, shared paths gaining failures, or missing/truncated source comparison. Keep UTM mappings and sample scope consistent; current-only paths remain incomparable, not newly failed.
Add `--fail-on-ai-crawler-timing-regression` to fail when a comparable crawler's response-duration or time-to-first-byte p95 band becomes slower. It requires at least 20 timed requests for that metric in both periods; samples without usable timing in either period are not comparable.

Use `--fail-on-ai-crawler-cloudfront-result-regression` with a saved baseline to fail when the share of CloudFront `Error`, `CapacityExceeded`, or `LimitExceeded` result types increases for a claimed crawler. It requires at least 20 rows for each compared result field in both periods and fails closed when no such comparison is possible. It reports a logged edge-result change; review the paired status and CDN configuration to identify the cause.
Compare policy releases by adding `--geo-robots-baseline-txt previous/robots.txt` alongside the current `--geo-robots-txt`; Aviary highlights observed paths that became blocked or allowed and rules that changed without changing access. For CI, add `--fail-on-newly-blocked-geo-paths` to exit with status 1 when any comparable observed path becomes blocked or the retained path comparison is incomplete.
For a saved page audit without access logs, combine `--geo-audit-json`, `--geo-robots-txt`, and `--geo-robots-origin` to replay every same-origin audited URL with its query string applied to policy matching. Query values are omitted from output. Add `--geo-robots-baseline-txt` to compare old and current rules over the same page/token pairs. Use `--fail-on-newly-blocked-geo-audit-pages` to fail CI when a URL/token pair becomes blocked or the audit comparison is incomplete, including missing or non-comparable pairs. Repeat `--geo-robots-token` to evaluate additional explicitly named groups. The report follows [the GEO robots audit replay schema](docs/geo-robots-audit-replay.schema.json).

To check a whole URL inventory without first auditing each page, use `--geo-robots-sitemap https://example.com/sitemap.xml --geo-robots-origin https://example.com --geo-robots-txt snapshots/robots.txt`. Sitemap discovery follows same-origin sitemap indexes and the live site’s robots policy, then evaluates up to 10,000 discovered page URLs against the supplied local snapshot without fetching page content. Add `--geo-sitemap-max-urls` to set a lower limit. Pair a previous snapshot with `--geo-robots-baseline-txt`; `--fail-on-newly-blocked-geo-targets` fails on newly blocked page/token pairs or incomplete sitemap/decision coverage. The existing `--fail-on-newly-blocked-geo-audit-pages` flag remains available for saved-audit replay. Sitemap query values are omitted from output, and a reached URL cap is marked as potentially incomplete.

Analyze Google's first-party Search Generative AI Performance report with `aviary --google-ai-csv exports/gen-ai-pages.csv --geo-audit-json reports/site.json --json`; repeat the option for separately downloaded page, country, device, or date views. XLSX workbooks are also accepted through repeatable `--google-ai-xlsx` inputs; Aviary scans up to 32 worksheets and treats each recognized table as an independent export view. Workbook imports are bounded to 25 MiB compressed, 128 MiB expanded, 100,000 non-empty rows, and 256 columns per row. Formula expressions are not evaluated; cached scalar results can be read. This report provides observed impressions for AI Overviews and AI Mode. Aviary keeps each view separate because their aggregation scopes differ, summarizes page/country/device/date dimensions, and can match page rows to current Googlebot controls and audited page structures. The JSON correlation groups matched rows by robots/snippet controls, question headings, concise answer blocks, visible author/date markers, and external/reference links; groups can overlap and do not imply those present-day signals caused report-period impressions. The version 1 JSON follows the [Google GEO export schema](docs/google-ai-report.schema.json). It does not invent query, click, or citation data. The report's last URL is the final URL after redirects, and impressions are assigned mostly to canonical URLs; Aviary uses exact matches first, then a unique declared canonical URL. Date labels stay as exported; Google uses Pacific Time. Compare two page exports with `--google-ai-baseline-csv previous.csv --google-ai-csv current.csv` or `--google-ai-baseline-xlsx previous.xlsx --google-ai-xlsx current.xlsx`; the baseline workbook must contain exactly one recognized table. Impression changes are computed only for URLs present in both exports. URLs present in just one export are labeled export-only because Search Console limits the table to 1,000 rows; absence from one file does not prove new or lost visibility. [Google's Search report documentation](https://support.google.com/webmasters/answer/16984139?hl=en) describes its dimensions, impression counting, limits, and export behavior.

For country, device, date, page-country, or other multi-dimension period reviews, use `--google-ai-dimension-baseline-csv previous.csv` or `--google-ai-dimension-baseline-xlsx previous.xlsx` with exactly one current Google Search or Discover CSV/XLSX table. Both exports must use the same surface and identical dimensions; the report compares exact cohorts, shows shared-cohort impression deltas and each cohort’s within-export share change in percentage points, and leaves export-only cohorts unknown under Google’s 1,000-row table limit. Add `--csv reports/google-cohorts.csv` for spreadsheet-safe rows with each cohort’s impressions, within-export shares, and percentage-point change. This also supports multi-dimension exports where a page-only baseline would discard useful segmentation.

For Google's separate Generative AI in Discover report, use `--google-ai-discover-csv exports/discover-pages.csv` or `--google-ai-discover-xlsx exports/discover-workbook.xlsx`. It measures Discover impressions, uses canonical page URLs, and has page, country, and date views; keep those exports separate from Search. The same page and exact-dimension baseline options accept CSV or XLSX. `--geo-audit-json` correlates page rows with a current audit. Discover tables have the same 1,000-row limitation, so export-only URLs are not evidence of new or lost visibility. [Google's Discover report documentation](https://support.google.com/webmasters/answer/16983858?hl=en) describes its impression, canonical URL, and row-limit rules.

For Google Search and Discover exports, add `--html reports/google-ai.html` to generate a self-contained view of dimensions, period changes, and current Googlebot-control observations.

To compare Google's AI page impressions with URLs cited in your own sampled assistant answers, combine exactly one Search or Discover page export with `--geo-answer-observations samples/answers.json` and request `--geo-google-ai-citation-concordance-csv reports/ai-citation-concordance.csv`; add `--geo-google-ai-citation-concordance-provider-csv reports/ai-citation-providers.csv` to split citation events, page-answer pairs, and page-prompt pairs by answer provider, or use `--geo-google-ai-citation-concordance-html reports/ai-citation-concordance.html` for an offline dashboard. The join removes query strings and fragments to match the answer citation analyzer's page URL normalization and lists both unmatched sets. If you also pass a version 1 sitewide GEO summary with `--geo-audit-json`, URLs that share one unique audited canonical can bridge; conflicting canonical declarations remain exact-only, and each row records its join method. Use `--output reports/ai-citation-concordance.json` for the complete machine-readable report. It follows the [concordance schema](docs/geo-google-ai-citation-concordance.schema.json). Add `--geo-google-ai-citation-concordance-path-family-csv reports/ai-citation-path-families.csv` to group both sources by URL origin and the first two path segments; change that grouping with `--geo-google-ai-citation-concordance-path-depth` from 1 to 5. Add `--geo-google-ai-citation-concordance-path-depth-sweep-csv reports/ai-citation-depth-sweep.csv` to export all five groupings side by side and check whether URL-family conclusions are sensitive to the chosen depth. For a later-period comparison, save the first run's JSON with `--output reports/period-1.json`, then supply it as `--geo-google-ai-citation-concordance-baseline-json reports/period-1.json` and request any combination of `--geo-google-ai-citation-concordance-comparison-csv reports/period-2-changes.csv`, `--geo-google-ai-citation-concordance-comparison-json reports/period-2-comparison.json`, and `--geo-google-ai-citation-concordance-comparison-html reports/period-2.html`, and `--geo-google-ai-citation-concordance-provider-comparison-csv reports/provider-period.csv` on the next run. The comparison labels newly matched, lost-match, appeared, and disappeared URLs and includes per-page changes, answer sample counts, completeness state, and canonical ambiguity; it requires the same Google surface, canonical-bridge availability, and owned-domain assessment setting; if enabled, use the same `--geo-answer-owned-domain` values for both runs. Keep answer sample sizes and prompt mixes comparable before interpreting citation changes. The report keeps Google impressions, answer citation events, observed answers, and unique prompts in separate columns and denominators. It surfaces incomplete answer-citation-list counts, reports what share of the answer report’s citation events have retained page detail, and signals when cited-page detail was capped. This is a cross-source URL overlap inventory, not evidence of clicks, shared queries, ranking, or causal impact. `bash examples/geo-google-ai-citation-concordance.sh` produces a synthetic example.

To compare page coverage between these two Search Console surfaces, pass one page export to each of `--google-ai-csv`/`--google-ai-xlsx` and `--google-ai-discover-csv`/`--google-ai-discover-xlsx` with `--geo-google-surface-matrix`. Each XLSX must contain exactly one recognized table. The report keeps Search and Discover impressions and within-surface shares separate, can bridge a unique canonical URL from `--geo-audit-json`, and provides HTML filters for coverage and current crawler/indexing/snippet controls plus spreadsheet-safe CSV. Coverage and share gaps are descriptive across separate report surfaces; a row missing from one export is not zero activity. The output follows [the Google surface matrix schema](docs/google-ai-surface-matrix.schema.json). Save one run's JSON and pass it as `--geo-google-surface-baseline-json` on the next run for page-presence, impression, and within-surface share changes across snapshots; both Google surfaces stay separate, and the comparison CSV includes the retained URL union. Add `--geo-path-depth 1` through `5` to group joined pages into origin/path families with separate Search and Discover totals, shares, and same-depth period changes. The HTML report also summarizes current audit matches and crawler/indexing/snippet controls by family; these audit snapshots can postdate the export windows. Add `--geo-google-surface-path-family-csv reports/google-families.csv` to export one row per group, including same-depth baseline changes when available.

### GitHub Actions

Copy [`examples/github-actions-audit.yml`](examples/github-actions-audit.yml) into your repository's
`.github/workflows/` directory and add an `AVIARY_TARGET_URL` repository secret. The example runs a
weekly audit and on manual dispatch, uploads JUnit XML, SARIF, Markdown, PDF, and score-history dashboard reports as a workflow artifact,
compares against the latest successful audit, and fails the job on score drops or newly failing
checks. The history cache retains every attempted audit while the regression baseline advances only on successful runs. The workflow installs Playwright Chromium for PDF export. It builds Aviary from the public `main` branch; pin the clone command to a release tag or
commit for repeatable runs. Use `--fail-below-score 80` when you want a score floor that tolerates
individual findings.

### Programmatic API

Import the `SEOChecker` class to run checks programmatically within your Node.js application:

```typescript
import { SEOChecker } from '@ru1vly/aviary';

async function runAudit() {
  const checker = new SEOChecker({
    url: 'https://example.com',
    headless: true,
  });

  const report = await checker.check();
  console.log(`Overall SEO Score: ${report.score}/100`);
  console.log(`Passed: ${report.summary.passed}/${report.summary.total} checks`);
}

runAudit();
```

For a bounded parallel run over a list of pages, use `auditUrls`. Results stay in input order;
individual URL failures are returned alongside successful reports, and concurrency defaults to 2
(maximum 8). Each worker reuses its browser across assigned pages to avoid relaunching Chromium
for every URL. Pass `onProgress` to receive completion-order updates; the returned results remain
in input order:

```typescript
import { auditUrls } from '@ru1vly/aviary';

async function auditPages() {
  const batch = await auditUrls(
    ['https://example.com/', 'https://example.com/about'],
    { concurrency: 2, categories: ['metaTags', 'accessibility'] }
  );

  console.log(batch.summary);
  for (const result of batch.results) {
    if (result.status === 'error') console.error(result.url, result.error);
  }
}

auditPages();
```

Pass an `AbortSignal` to `auditUrls` or `SEOChecker` to stop active page audits. Active pages close, and URLs that have not started are returned as error outcomes with a cancellation message:

```typescript
import { auditUrls } from '@ru1vly/aviary';

async function cancelLongAudit() {
  const controller = new AbortController();
  const stopAfter = setTimeout(() => controller.abort(), 30_000);
  try {
    const batch = await auditUrls(['https://example.com/', 'https://example.com/about'], {
      concurrency: 2,
      signal: controller.signal,
    });
    console.log(`${batch.summary.completedUrls} completed, ${batch.summary.failedUrls} failed or cancelled`);
  } finally {
    clearTimeout(stopAfter);
  }
}

void cancelLongAudit();
```

For periodic monitoring, `watchUrls` waits until each batch is complete before starting the next one. The interval is an idle delay after a completed batch, so runs never overlap. Abort the signal to stop after the active batch; `onAudit` can append each result to JSONL history:

```typescript
import { appendSEOAuditBatchHistory, watchUrls } from '@ru1vly/aviary';

async function monitorPages() {
  const controller = new AbortController();
  const stopTimer = setTimeout(() => controller.abort(), 60 * 60 * 1000);
  try {
    await watchUrls(['https://example.com/'], {
      intervalMs: 5 * 60 * 1000,
      signal: controller.signal,
      onAudit: (batch) => appendSEOAuditBatchHistory(batch, './reports/history.jsonl'),
    });
  } finally {
    clearTimeout(stopTimer);
  }
}

void monitorPages();
```

Pass an async URL provider to refresh the collection before every batch—for example, to rediscover pages from a sitemap:

```typescript
import { appendSEOAuditBatchHistory, createSitemapDiscoveryCache, discoverSitemapUrls, watchUrls } from '@ru1vly/aviary';

const sitemapCache = createSitemapDiscoveryCache();

async function monitorSitemap() {
  await watchUrls(() => discoverSitemapUrls('https://example.com/sitemap.xml', { cache: sitemapCache }), {
    intervalMs: 5 * 60 * 1000,
    onAudit: (batch) => appendSEOAuditBatchHistory(batch, './reports/history.jsonl'),
  });
}

void monitorSitemap();
```

---

## Model Context Protocol (MCP) Server

Aviary includes a built-in Model Context Protocol (MCP) server that exposes real-browser SEO auditing tools directly to AI coding agents (Claude Desktop, Cursor, Windsurf, Antigravity, etc.).

The server communicates via standard I/O (`stdio`) and provides three registered tools:

| Tool | Parameters | Description |
|---|---|---|
| `seo_audit` | `url`, `preset?` (`basic`\|`advanced`\|`strict`\|`geo`), `categories?`, `settleAfterNavigationMs?` (0–30000) | SEO audit returning structured results for enabled categories; `geo` runs only AI discoverability checks. The settle delay defaults to 1000 ms and is echoed in the report. |
| `seo_score` | `url`, `settleAfterNavigationMs?` (0–30000) | Quick audit returning overall score (0-100), letter grade (`A`-`F`), pass/fail counts, and capture timing. |
| `seo_check_category` | `url`, `category`, `settleAfterNavigationMs?` (0–30000) | Targeted category checks with capture timing in the result. |

### Running the MCP Server

```bash
# Via binary entry point
aviary-mcp

# Or via npx
npx @ru1vly/aviary aviary-mcp

# Or directly from source/monorepo
pnpm run mcp-server
```

### Agent Configuration (`claude_desktop_config.json` / MCP Settings)

```json
{
  "mcpServers": {
    "aviary": {
      "command": "npx",
      "args": ["-y", "@ru1vly/aviary", "aviary-mcp"]
    }
  }
}
```

---

## REST API

See the [REST API reference](docs/API.md) for endpoint schemas, limits, response codes, SSE events, and the typed client.
For browser setup, sitemap/link-crawl limits, report errors, and API status codes, see the [troubleshooting guide](docs/TROUBLESHOOTING.md).
For repeatable CI scans and API operations, see [audit best practices](docs/BEST_PRACTICES.md).
For local setup, repository layout, and pull request guidance, see [contributing to Aviary](docs/CONTRIBUTING.md).

The optional `aviary-api` server accepts asynchronous batch audits. Jobs run through a bounded queue and are retained in memory for up to one hour (subject to the configured job-store limit). The listener binds to `127.0.0.1:3333` by default; local use does not require a key.

```bash
# Start the loopback-only API
aviary-api

# Or from the repository after building
pnpm run api-server

# Submit a batch
curl -X POST http://127.0.0.1:3333/v1/audits \
  -H 'Content-Type: application/json' \
  -d '{"urls":["https://example.com/","https://example.com/about"],"concurrency":2}'

# Or ask Aviary to discover pages from a sitemap
curl -X POST http://127.0.0.1:3333/v1/audits \
  -H 'Content-Type: application/json' \
  -d '{"sitemap":"https://example.com/sitemap.xml","maxUrls":250}'

# Or follow same-origin HTML links from a starting page
curl -X POST http://127.0.0.1:3333/v1/audits \
  -H 'Content-Type: application/json' \
  -d '{"crawl":"https://example.com/","maxUrls":250,"maxDepth":2}'

# Poll the returned self URL until status is completed
curl http://127.0.0.1:3333/v1/audits/PASTE_JOB_ID_HERE

# Or stream progress updates until the job is terminal
curl -N http://127.0.0.1:3333/v1/audits/PASTE_JOB_ID_HERE/events
```

The service also provides `GET /health`, serves its OpenAPI contract from `GET /openapi.yaml`, and streams live progress over `GET /v1/audits/{id}/events` using Server-Sent Events. Batch submissions accept one of a URL array, a sitemap URL, or a starting URL for bounded link discovery. URL arrays accept 1–100 URLs by default (up to 1,000 when configured with `AVIARY_API_MAX_BATCH_URLS`); sitemap and crawl scans are bounded by the same limit. Sitemap discovery follows nested indexes and gzip files; link discovery follows static same-origin HTML links with a configurable depth limit. Both discovery modes support optional concurrency from 1 to 8, a timeout, a preset, and selected checker categories. It rejects duplicate URLs, embedded URL credentials, non-HTTP schemes, and request bodies over 3 MiB. Rate limiting defaults to 60 requests per IP each minute. API results omit inline heatmap screenshots to keep retained job data bounded; the geometry and check results remain available. `DELETE /v1/audits/{id}` cancels a queued job immediately or returns `202` when a running job begins stopping. Completed page results remain in the cancelled job's partial report.

When launched with `aviary-api`, `AVIARY_HEADLESS`, `AVIARY_TIMEOUT`, `AVIARY_SETTLE_AFTER_NAVIGATION_MS`, `AVIARY_VIEWPORT`, `AVIARY_PRESET`, `AVIARY_CATEGORIES`, and `AVIARY_CONCURRENCY` provide default audit settings. `AVIARY_SETTLE_AFTER_NAVIGATION_MS` also sets the default for CLI and MCP audits. Values supplied to an audit override the matching defaults.

For access outside the local machine, configure both an API key and TLS certificate/key. The API refuses non-loopback listeners without both. Keep access limited to trusted operators: audit jobs open submitted URLs in a real browser on the API host, which can reach private-network services. If API clients are not fully trusted, isolate the service with outbound network rules. Private-site audits remain supported. See the [data-handling guide](docs/PRIVACY.md) for network, report-retention, metrics, and optional semantic-analysis behavior.

```bash
export AVIARY_API_HOST=0.0.0.0
export AVIARY_API_PORT=3333
export AVIARY_API_KEY='replace-with-a-random-secret-at-least-24-characters'
export AVIARY_API_TLS_CERT=/path/to/fullchain.pem
export AVIARY_API_TLS_KEY=/path/to/private-key.pem
aviary-api
```

Requests that require authentication use `Authorization: Bearer <API_KEY>`. The OpenAPI 3.1 contract is in [`docs/openapi.yaml`](docs/openapi.yaml). The programmatic exports are `createAviaryApiApp()`, `startAviaryApiServer()`, and `stopAviaryApiServer()`.

The typed client can submit and poll URL-list, sitemap, or link-crawl audits, report progress, and cancel a queued or running job. Use `streamAudit()` to consume the Server-Sent Events feed instead of polling:

```typescript
import { AviaryApiClient } from '@ru1vly/aviary';

async function main() {
  const client = new AviaryApiClient({ baseUrl: 'http://127.0.0.1:3333' });
  const job = await client.audit(
    { crawl: 'https://example.com/', maxUrls: 250, maxDepth: 2, concurrency: 3 },
    { onUpdate: (update) => console.log(`${update.progress.completedUrls}/${update.progress.requestedUrls}`) }
  );
  console.log(job.status, job.report?.summary);
}

void main();
```

---

## Command Line Options

The command-line interface supports the following parameters:

| Option | Shortcut | Type | Description |
|---|---|---|---|
| `--url` | `-u` | string | Target website URL to analyze (required for CLI audit mode) |
| `--urls` | | string (path or glob) | Audit up to 10,000 URL lines / 25 MiB from a file or quoted `*`, `?`, `**` glob (`-` reads stdin) |
| `--sitemap` | | URL | Discover same-origin page URLs from a sitemap or nested sitemap index |
| `--crawl` | | URL | Discover same-origin pages by following static HTML links |
| `--max-urls` | | integer | Maximum sitemap/crawl URLs to audit (default 1,000; maximum 10,000) |
| `--max-depth` | | integer | Maximum HTML link hops from the start page (default 2; maximum 32) |
| `--max-crawl-page-bytes` | | byte count | Maximum HTML discovery body size per fetched page (default 2 MiB; maximum 10 MiB) |
| `--max-crawl-bytes` | | byte count | Combined HTML discovery body limit (default 100 MiB; maximum 1 GiB; accepts `KiB`, `MiB`, or `GiB` suffixes) |
| `--concurrency` | | integer | Maximum simultaneous URL audits from 1 to 8 (default 2; used with batch scans) |
| `--watch` | | integer (seconds) | Repeat `--urls`, `--sitemap`, or `--crawl` audits after this idle delay; Ctrl+C stops after the active batch |
| `--timeout` | | integer (ms) | Page load timeout in milliseconds (overrides `AVIARY_TIMEOUT`) |
| `--wait-until` | | `domcontentloaded` / `load` / `networkidle` | Browser navigation readiness condition (default `networkidle`); choose an earlier condition for sites with persistent requests |
| `--settle-ms` | | integer 0–30000 | Fixed delay after navigation readiness for client-rendered content (default 1000 ms) |
| `--output` | `-o` | string | File path to write the JSON results payload |
| `--geo-summary-output` | | string (path) | Save structured sitewide and per-page GEO signals for a `--urls`, `--sitemap`, or `--crawl` batch; watch mode refreshes it after each batch |
| `--geo-summary-csv` | | string (path) | Save filterable per-page GEO signals as spreadsheet-safe CSV; watch mode refreshes it after each batch |
| `--geo-entity-variants-csv` | | string (path) | Export shared structured-entity name, type, and `sameAs` differences by page |
| `--geo-crawler-access-csv` | | string (path) | Export per-page crawler access and preview observations as normalized rows |
| `--render` | | string (path) | Regenerate artifacts from saved single or batch JSON without auditing; batch reports also support GEO summary exports and baseline comparisons |
| `--html` | | string | File path to write the visual report; batch audits use a searchable page dashboard |
| `--pdf` | | string | File path to write a print-ready PDF report |
| `--history` | | string (path) | Append one compact JSONL record per audited URL |
| `--history-report` | | string (path) | Read JSONL history and write the score timeline dashboard with `--html` |
| `--junit` | | string | File path to write a JUnit XML report for CI dashboards |
| `--sarif` | | string | File path to write a SARIF 2.1.0 report with failed checks and batch findings |
| `--markdown` | | string | File path to write a Markdown summary and failed-check table |
| `--csv` | | string | File path for spreadsheet-friendly audit or GEO export and comparison rows |
| `--bing-ai-csv` | | string (path) | Import a local Bing Webmaster Tools AI Performance export; repeatable and kept separate per export view |
| `--bing-ai-xlsx` | | string (path) | Import recognized Bing AI Performance tables from an XLSX workbook; repeatable, bounded, and kept separate per worksheet |
| `--bing-ai-baseline-csv` | | string (path) | Compare one current Bing page-citations export with a previous export by citation changes |
| `--bing-ai-baseline-xlsx` | | string (path) | Compare a current Bing page export with one recognized XLSX baseline table |
| `--bing-ai-query-baseline-csv` | | string (path) | Compare Bing query-to-page mappings with a previous CSV export |
| `--bing-ai-query-baseline-xlsx` | | string (path) | Compare Bing query-page mappings with one recognized XLSX baseline table |
| `--bing-ai-topic-baseline-csv` | | string (path) | Compare Bing topic/intent cohorts with a previous CSV export |
| `--bing-ai-topic-baseline-xlsx` | | string (path) | Compare Bing topic/intent cohorts with one recognized XLSX baseline table |
| `--google-ai-csv` | | string (path) | Import a local Search Console Search Generative AI report export; repeatable and kept separate per view |
| `--google-ai-xlsx` | | string (path) | Import recognized Google Search Generative AI tables from a bounded XLSX workbook; repeatable and kept separate per worksheet |
| `--google-ai-discover-csv` | | string (path) | Import a local Search Console Generative AI in Discover report export; repeatable and kept separate from Search |
| `--google-ai-discover-xlsx` | | string (path) | Import recognized Google Discover Generative AI tables from a bounded XLSX workbook |
| `--google-ai-baseline-csv` | | string (path) | Compare one current Search or Discover page export with a previous export by impression changes |
| `--google-ai-baseline-xlsx` | | string (path) | Compare a current Search or Discover page export with one recognized XLSX baseline table |
| `--google-ai-dimension-baseline-csv` | | string (path) | Compare same-surface Google Search/Discover exports by identical country, device, date, and/or page dimensions |
| `--google-ai-dimension-baseline-xlsx` | | string (path) | Compare exact Google Search/Discover cohorts with one recognized XLSX baseline table |
| `--geo-google-ai-citation-concordance-csv` | | string (path) | Join one Google AI page export with locally observed answer citation URLs |
| `--geo-google-ai-citation-concordance-provider-csv` | | string (path) | Split cited-page measures by observed answer provider |
| `--geo-google-ai-citation-concordance-html` | | string (path) | Save a filterable offline Google AI / answer citation URL dashboard |
| `--geo-google-ai-citation-concordance-path-family-csv` | | string (path) | Group the concordance by origin and URL path prefix |
| `--geo-google-ai-citation-concordance-path-depth` | | integer (1–5) | Set path-family depth for the Google AI citation concordance; default 2 |
| `--geo-google-ai-citation-concordance-path-depth-sweep-csv` | | string (path) | Export URL-family sensitivity at each path depth from 1 to 5 |
| `--geo-google-ai-citation-concordance-baseline-json` | | string (path) | Compare the current concordance with a saved version 1 report |
| `--geo-google-ai-citation-concordance-comparison-csv` | | string (path) | Export URL transitions and per-page metric changes from a saved report |
| `--geo-google-ai-citation-concordance-comparison-json` | | string (path) | Save comparison totals, sample sizes, warnings, and page transitions |
| `--geo-google-ai-citation-concordance-comparison-html` | | string (path) | Save a filterable offline view of period changes and sample coverage |
| `--geo-google-ai-citation-concordance-provider-comparison-csv` | | string (path) | Compare retained URL/provider citation detail and sample support across two snapshots |
| `--geo-google-surface-matrix` | | boolean | Join Google Search and Discover page exports by URL while retaining distinct impressions and shares |
| `--geo-google-surface-baseline-json` | | string (path) | Compare a current Search/Discover matrix with a saved matrix by page presence, impressions, and separate surface shares |
| `--geo-google-surface-path-family-csv` | | string (path) | Export one CSV row per retained Search/Discover path family; requires `--geo-path-depth` |
| `--geo-path-depth` | | integer (1–5) | Group either GEO matrix by origin and leading URL path segments; same-depth Google surface matrices also compare families |
| `--geo-platform-matrix` | | boolean | Join Google Search and Bing page exports by normalized URL; optionally bridge unique audited canonicals while keeping measures separate |
| `--geo-audit-json` | | string (path) | Correlate Bing or Google report page rows with a full audit or version 1 GEO summary |
| `--geo-audit-baseline-json` | | string (path) | Add the prior audit snapshot to owned-page/provider GEO period comparisons |
| `--geo-answer-observations` | | string (path) | Analyze locally recorded AI answer prompts and cited URLs; optional owned-domain coverage and audit correlation |
| `--geo-answer-baseline-observations` | | string (path) | Compare a previous manual sample with the current provider/prompt cohorts; requires `--geo-answer-observations` |
| `--geo-answer-comparison-csv` | | string (path) | Export matched provider/prompt period changes to CSV; requires both observation samples |
| `--geo-answer-provider-position-comparison-csv` | | string (path) | Compare retained cited-page positions and rank-bucket event/share changes by provider across periods |
| `--geo-answer-cohorts-csv` | | string (path) | Export current topic/intent/provider cohort profiles; requires `--geo-answer-observations` |
| `--geo-answer-cohort-comparison-csv` | | string (path) | Export matched and one-period-only topic/intent/provider changes; requires both observation samples |
| `--geo-answer-provider-pairs-csv` | | string (path) | Compare shared-prompt owned reach with leave-one-out sensitivity, exact McNemar, and Holm adjustment; requires `--geo-answer-observations` |
| `--geo-answer-prompt-sampling-plan-csv` | | string (path) | Plan balanced follow-up prompt quotas by provider and topic/intent cohort |
| `--geo-answer-prompt-sampling-plan-json` | | string (path) | Save typed plan rows, target status, and per-provider-pair capture budgets; see the [published schema](docs/geo-answer-prompt-sampling-plan.schema.json) |
| `--geo-answer-prompt-plan-provider-pairs-csv` | | string (path) | Export one required, planned, and deferred budget row per provider pair |
| `--geo-answer-execution-context-csv` | | string (path) | Compare snapshot and prompt-reach citation coverage by recorded model, surface, locale, and topic/intent |
| `--geo-answer-execution-context-coverage-csv` | | string (path) | Audit recorded model, surface, and locale label coverage by provider, cohort, and month |
| `--geo-answer-execution-context-comparison-csv` | | string (path) | Compare recorded contexts across periods with one-sided states and matched-context sample-mix decomposition |
| `--geo-answer-execution-context-trends-csv` | | string (path) | Export UTC-month citation trends by recorded model, surface, locale, and topic/intent |
| `--geo-answer-length-profiles-csv` | | string (path) | Export coverage, pooled and prompt-equal density intervals, event-weighted and prompt-equal owned rank shares by answer length band |
| `--geo-answer-length-comparison-csv` | | string (path) | Compare answer-length GEO profiles; export matched-prompt owned rank changes and decompose citation density and rank movement into within-band and answer-length-mix effects |
| `--geo-answer-length-trends-csv` | | string (path) | Export UTC-month citation-density and prompt-equal owned rank-share trends by sampled context |
| `--geo-answer-prompt-plan-min-prompts` | | integer (1–10,000) | Set a minimum unique-prompt quota for every provider/cohort in the plan |
| `--geo-answer-prompt-plan-owned-reach-margin` | | number (0.5–50 percentage points) | Raise quotas for a worst-case 95% Wilson half-width target on owned-cited prompt reach; requires an owned domain |
| `--geo-answer-prompt-plan-min-jaccard` | | number (0.5–0.99) | Raise paired follow-up groups to meet a per-cohort exact-prompt overlap floor |
| `--geo-answer-prompt-plan-max-paired-groups` | | integer (0 or greater) | Cap paired follow-up groups per provider pair and distribute them across retained cohorts |
| `--geo-answer-prompt-plan-max-total-paired-groups` | | integer (0 or greater) | Cap total paired follow-up groups across pairs, with balanced allocation by default |
| `--geo-answer-prompt-plan-total-allocation` | | `balanced` or `proportional` | Choose even or demand-proportional allocation for the total paired-group cap |
| `--geo-answer-prompt-plan-cohort-targets` | | string (path) | Raise selected topic/intent quota floors and/or cap per-cohort paired groups from a versioned [JSON target file](docs/geo-answer-prompt-plan-cohort-targets.schema.json) |
| `--fail-on-geo-answer-prompt-plan-miss` | | boolean | Exit with code 1 when prompt quotas, requested overlap/precision targets, or retained plan detail are incomplete |
| `--geo-answer-provider-prompt-overlap-csv` | | string (path) | Export whole-sample exact-prompt set overlap for every provider pair, including disjoint pairs |
| `--geo-answer-sample-mix-csv` | | string (path) | Export provider topic/intent snapshot-mix divergence; requires `--geo-answer-observations` |
| `--geo-answer-stability-csv` | | string (path) | Export repeated-prompt domain/URL stability and source-order volatility; requires `--geo-answer-observations` |
| `--geo-answer-source-persistence-csv` | | string (path) | Export citation-domain retention by provider/context, follow-up interval, and previous source-list rank; requires `--geo-answer-observations` |
| `--geo-answer-citation-url-persistence-csv` | | string (path) | Export exact cited-page URL retention across next distinct prompt timestamps; requires `--geo-answer-observations` |
| `--geo-answer-cohort-trends-csv` | | string (path) | Export monthly provider/topic/intent citation coverage; requires `--geo-answer-observations` |
| `--geo-answer-audit-signals-csv` | | string (path) | Export current audit signal states for cited pages; requires observations and `--geo-audit-json` |
| `--geo-answer-audited-owned-page-provider-inventory-csv` | | string (path) | Cross audited owned pages with answer providers and cap-aware citation observation states |
| `--geo-answer-audited-owned-page-provider-inventory-html` | | string (path) | Render a filterable offline owned-page/provider GEO audit dashboard |
| `--geo-answer-audited-owned-page-provider-inventory-comparison-csv` | | string (path) | Compare provider/page citation and audit signals across sample periods |
| `--geo-answer-audited-owned-page-provider-inventory-comparison-html` | | string (path) | Review provider/page transitions in a filterable offline dashboard |
| `--geo-answer-audited-owned-page-provider-inventory-comparison-json` | | string (path) | Save typed page/provider transitions and GEO audit-signal deltas as JSON |
| `--geo-answer-audited-owned-pages-csv` | | string (path) | Inventory audited owned URLs with observed citation evidence and crawl/content signals; requires observations, audit, and `--geo-answer-owned-domain` |
| `--geo-answer-audited-owned-page-comparison-csv` | | string (path) | Compare citation frequency and source-list placement per audited owned URL; requires baseline/current observations, audit, and owned domain |
| `--geo-answer-audited-owned-page-providers-csv` | | string (path) | Export observed owned-page citation rank and crawl/content signals by provider; requires observations, audit, and owned domain |
| `--geo-answer-audited-owned-page-provider-comparison-csv` | | string (path) | Compare owned-page rank-bucket shifts per provider; requires baseline/current observations, audit, and owned domain |
| `--geo-answer-source-category` | | string (hostname=category) | Assign a source category to a citation hostname for CSV exports or the answer HTML dashboard; subdomains inherit the most-specific match |
| `--geo-answer-source-categories-csv` | | string (path) | Export source-category shares, rank distributions, category HHI, effective category count, and largest-category share; requires observations and category mappings |
| `--geo-answer-source-category-comparison-csv` | | string (path) | Compare pooled and provider-specific category event shares, rank distributions, and mix-concentration changes; requires baseline/current observations and category mappings |
| `--geo-answer-source-category-prompt-coverage-csv` | | string (path) | Count exact-prompt category presence by provider; with owned domains, summarize category/owned citations; with a baseline, compare shared prompts |
| `--geo-answer-source-category-prompt-details-csv` | | string (path) | Drill into category and owned-citation evidence per prompt/provider, with cap-aware absence states |
| `--geo-answer-source-category-trends-csv` | | string (path) | Compare category shares and source-list placement across sampled months and labeled provider cohorts |
| `--geo-answer-source-category-provider-pairs-csv` | | string (path) | Compare category citation coverage across providers on matched exact prompts |
| `--geo-answer-source-category-cooccurrence-csv` | | string (path) | Measure category support, conditional presence, lift, excess co-occurrence, and Jaccard by provider |
| `--geo-answer-source-category-path-families-csv` | | string (path) | Cross mapped source categories with cited URL path families by provider; requires `--geo-answer-path-depth` |
| `--geo-answer-source-category-path-family-comparison-csv` | | string (path) | Compare category/path-family citation volume and placement across baseline/current samples; requires mappings and path depth |
| `--geo-answer-citation-positions-csv` | | string (path) | Export pooled and provider-specific page/domain event ranks and distinct-prompt first-position/top-three reach with Wilson intervals; requires `--geo-answer-observations` |
| `--geo-answer-domain-prompt-coverage-csv` | | string (path) | Export domain citation reach and first-position/top-three prompt reach overall and by provider, with nominal Wilson intervals; requires answer observations |
| `--geo-answer-source-rarefaction-csv` | | string (path) | Estimate domain/category discovery, observed-catalog sample targets, next-batch yield, and source-list uncertainty across prompt sample sizes |
| `--geo-answer-source-rarefaction-batch-size` | | number (1–1,000; default 10) | Set the number of remaining prompts used for marginal source-yield estimates; requires the rarefaction CSV or `--html` |
| `--geo-answer-domain-prompt-coverage-comparison-csv` | | string (path) | Compare domain prompt reach, first-position/top-three prompt reach, and citation-event share across periods overall and by provider; requires baseline/current observations |
| `--geo-answer-citation-date-alignment-csv` | | string (path) | Compare audited JSON-LD `dateModified` days with the last captured citation day; requires observations and `--geo-audit-json` |
| `--geo-answer-owned-rank-csv` | | string (path) | Export overall and per-provider owned citation rank distributions plus first-owned-citation mean reciprocal rank |
| `--geo-answer-owned-rank-comparison-csv` | | string (path) | Export baseline/current owned citation rank-bucket changes; requires both samples and `--geo-answer-owned-domain` |
| `--fail-on-geo-answer-owned-prompt-balanced-first-position-drop` | | number (0–100 pp) | Gate equal-prompt owned rank-one decline; requires baseline/current samples, owned domains, and matched prompt support |
| `--fail-on-geo-answer-owned-prompt-balanced-first-position-drop-lower-ci` | | number (0–100 pp) | Gate rank-one decline using the paired-prompt 95% bootstrap lower bound |
| `--fail-on-geo-answer-owned-prompt-balanced-top-three-drop` | | number (0–100 pp) | Gate equal-prompt owned top-three decline |
| `--fail-on-geo-answer-owned-prompt-balanced-top-three-drop-lower-ci` | | number (0–100 pp) | Gate top-three decline using the paired-prompt 95% bootstrap lower bound |
| `--fail-on-geo-answer-owned-prompt-balanced-mrr-drop` | | number (0–100 pp) | Gate prompt-balanced mean reciprocal rank of the first owned citation |
| `--fail-on-geo-answer-owned-prompt-balanced-mrr-drop-lower-ci` | | number (0–100 pp) | Gate MRR decline using the paired-prompt 95% bootstrap lower bound |
| `--fail-on-geo-answer-owned-prompt-balanced-rank-min-matched-prompts` | | integer (2–10,000) | Set exact-prompt support for prompt-balanced rank gates (default 2; 10 when using a lower-CI gate) |
| `--geo-answer-owned-prompt-rank-comparison-csv` | | string (path) | Export exact-prompt-balanced owned rank-one/top-three changes, provider rows, pseudonymous prompt fingerprints, and paired-prompt intervals |
| `--geo-answer-co-citation-csv` | | string (path) | Export external domains appearing alongside owned citations by provider; requires observations and an owned domain |
| `--geo-answer-co-citation-comparison-csv` | | string (path) | Compare retained co-citation domains across samples; requires baseline/current observations and an owned domain |
| `--geo-answer-entity` | | `name[=alias1|alias2]` | Match explicitly configured entity names in optional captured answer text; repeatable |
| `--geo-answer-entity-mentions-csv` | | string (path) | Export entity mention rates and citation coverage by provider; requires entities and answer observations |
| `--geo-answer-entity-prompt-details-csv` | | string (path) | Export exact prompt/provider/entity mention, citation coverage, and owned placement detail; requires entities and answer observations |
| `--geo-answer-entity-prompt-matched-association-csv` | | string (path) | Compare entity-mentioned vs non-mentioned owned-citation reach on matched exact prompts; requires entities, owned domains, and answer observations |
| `--geo-answer-entity-prompt-matched-association-html` | | string (path) | Render the prompt-matched entity/citation analysis as a filterable offline dashboard |
| `--geo-answer-entity-prompt-provider-pairs-csv` | | string (path) | Compare entity outcomes across providers on shared exact prompts; requires entities and answer observations |
| `--geo-answer-entity-prompt-comparison-csv` | | string (path) | Compare exact prompt/provider/entity outcomes across baseline/current samples; requires entities and both samples |
| `--fail-on-geo-answer-entity-prompt-mention-drop` | | number (percentage points) | Fail on a pooled entity mention-rate drop over shared exact prompt/provider rows; requires complete baseline/current entity detail |
| `--fail-on-geo-answer-entity-prompt-balanced-mention-drop` | | number (percentage points) | Fail on an equal-prompt/provider mean mention-rate drop; requires complete baseline/current entity detail |
| `--fail-on-geo-answer-entity-prompt-min-matched-prompts` | | integer prompt count | Require minimum distinct shared exact prompts with answer text for every entity; requires complete baseline/current entity detail |
| `--fail-on-geo-answer-provider-prompt-overlap-below` | | number (0–1 Jaccard) | Fail when any provider pair has less exact-prompt overlap than this value; requires complete prompt detail and two providers |
| `--fail-on-geo-answer-provider-min-prompts` | | integer prompt count | Require each provider to cover at least this many distinct exact prompt groups |
| `--fail-on-geo-answer-provider-min-matched-prompts` | | integer prompt count | Require each provider to have this many distinct exact prompts shared across baseline/current samples; capped detail fails closed |
| `--geo-answer-entity-co-mentions-csv` | | string (path) | Export co-mentioned configured entities, conditional rates, prompt overlap, and lift; requires two or more entities |
| `--geo-answer-entity-co-mention-comparison-csv` | | string (path) | Compare entity-pair mention rates, overlap, and lift across periods; requires baseline/current samples and two or more entities |
| `--geo-answer-entity-citation-domains-csv` | | string (path) | Compare cited-domain event shares when an exact entity is mentioned versus absent; requires entity and answer observations |
| `--geo-answer-entity-citation-pages-csv` | | string (path) | Export exact cited-page coverage and placement by entity mention, provider, cohort, and UTC month |
| `--geo-answer-entity-citation-domain-comparison-csv` | | string (path) | Compare entity-associated cited-domain shares across samples; requires matching entities and baseline/current observations |
| `--geo-answer-entity-citation-page-comparison-csv` | | string (path) | Compare exact entity-associated cited-page coverage and placement across baseline/current samples |
| `--geo-answer-entity-citation-position-comparison-csv` | | string (path) | Compare owned citation rank for entity-mention and non-mention answers; requires matching samples, entities, and an owned domain |
| `--geo-answer-entity-opportunities-csv` | | string (path) | Export exact prompt/provider groups where a mentioned entity lacks an owned citation; requires entities, observations, and an owned domain |
| `--geo-answer-entity-path-families-csv` | | string (path) | Compare path-family citation coverage in entity-mentioned and non-mentioned answer text; requires entities and path depth |
| `--geo-answer-entity-path-family-monthly-csv` | | string (path) | Export entity-conditioned path-family coverage by UTC month, provider, and supplied cohort |
| `--geo-answer-entity-path-family-comparison-csv` | | string (path) | Compare entity-conditioned path-family coverage across baseline/current answer samples |
| `--geo-answer-path-depth` | | integer (1–5) | Group captured answer citations by URL origin and leading path segments; requires `--geo-answer-observations` |
| `--geo-answer-path-family-csv` | | string (path) | Export answer citation counts, coverage, and source positions by retained path family; requires `--geo-answer-path-depth` |
| `--geo-answer-path-family-cohorts-csv` | | string (path) | Cross-tab snapshot and prompt-balanced cited path-family coverage and source positions by provider and supplied topic/intent; requires `--geo-answer-path-depth` |
| `--geo-answer-path-family-trends-csv` | | string (path) | Export UTC-month path-family coverage by provider and supplied topic/intent; requires `--geo-answer-path-depth` |
| `--geo-answer-path-family-cohort-comparison-csv` | | string (path) | Compare snapshot and prompt-balanced path-family coverage plus citation-event share across baseline/current samples; requires equal path depth |
| `--geo-answer-path-family-comparison-csv` | | string (path) | Export matched and one-period-only path-family changes; requires current/baseline observations and `--geo-answer-path-depth` |
| `--geo-answer-crawler-report` | | string (path) | Join cited answer URLs to exact paths in a prior Aviary crawler-log report; pair with `--geo-answer-crawler-origin` |
| `--geo-answer-crawler-origin` | | URL origin | Scope cited-page correlation to an exact origin; requires `--geo-answer-crawler-report` |
| `--geo-answer-crawler-matches-csv` | | string (path) | Export each retained cited page and its matching crawler token/log evidence; requires answer observations and crawler report |
| `--geo-crawler-log` | | string (path) | Analyze Apache/Nginx combined, CloudFront standard, or JSONL AI crawler logs, including failure hotspots, timing bands, and common Cloudflare fields; repeatable and gzip-aware |
| `--geo-crawler-ip-ranges` | | string (path) | Compare logged crawler source addresses with operator-supplied IPv4/IPv6 CIDRs; emits aggregate counts only |
| `--geo-crawler-token` | | string | Additional user-agent product token to include as unclassified; repeatable with `--geo-crawler-log` |
| `--geo-ai-referral-source` | | `label=value` | Count requests with an exact `utm_source` value under a safe label; repeatable (ChatGPT is built in) |
| `--geo-crawler-origin` | | URL origin | Correlate crawler logs with `--geo-audit-json` or `--geo-crawler-sitemap` |
| `--geo-crawler-sitemap` | | URL | Compare same-origin sitemap `<lastmod>` dates with crawler-log visits; requires crawler logs and origin |
| `--geo-crawler-sitemap-max-urls` | | integer (1–10,000) | Cap sitemap pages in the crawler date comparison; default 1,000 |
| `--geo-robots-txt` | | string (path) | Replay crawler-log paths, saved-audit URLs, or sitemap URLs against a local robots.txt snapshot (maximum 1 MiB) |
| `--geo-robots-baseline-txt` | | string (path) | Compare a previous robots snapshot with the current snapshot over retained log paths or audited URL/token pairs |
| `--geo-robots-origin` | | URL origin | Site origin to evaluate in the saved robots.txt snapshot; requires crawler logs, `--geo-audit-json`, or `--geo-robots-sitemap` |
| `--geo-robots-sitemap` | | URL | Discover same-origin sitemap page URLs for robots-policy replay; max 10,000, with no page fetches |
| `--geo-robots-token` | | string | Additional user-agent product token for saved-audit or sitemap replay; repeatable and labeled custom |
| `--fail-on-newly-blocked-geo-paths` | | boolean | Exit 1 if a logged path becomes blocked or snapshot comparison is incomplete |
| `--fail-on-newly-blocked-geo-audit-pages` | | boolean | Exit 1 if an audited URL/token pair becomes blocked or audit comparison is incomplete |
| `--fail-on-newly-blocked-geo-targets` | | boolean | Exit 1 if an audited or sitemap URL/token pair becomes blocked or target coverage is incomplete |
| `--fail-on-new-ai-referral-failures` | | boolean | Exit 1 on higher configured referral-source failure rates, shared paths gaining failures, or incomplete comparison; requires a crawler-log baseline |
| `--fail-on-geo-answer-owned-citation-drop` | | number (percentage points) | Exit 1 when owned-citation snapshot coverage falls beyond this threshold; requires current/baseline answer samples and an owned domain |
| `--fail-on-geo-answer-owned-prompt-coverage-drop` | | number (percentage points) | Exit 1 when any provider’s share of shared exact prompts citing an owned domain declines beyond this threshold; requires owned domains and complete baseline/current detail |
| `--fail-on-geo-answer-cohort-owned-prompt-coverage-drop` | | number (percentage points) | Exit 1 when a matched topic/intent/provider cohort’s period-specific owned-cited prompt reach drops beyond this threshold; requires complete cohort detail and owned domains |
| `--fail-on-geo-answer-cohort-owned-mrr-drop` | | number (percentage points) | Exit 1 when prompt-balanced first-owned-citation MRR drops in any matched topic/intent/provider cohort; requires owned domains and complete cohort detail |
| `--fail-on-geo-answer-cohort-owned-mrr-min-prompts` | | integer | Minimum owned-cited exact prompts in each period/cohort for the MRR gate; requires the MRR gate (default 2) |
| `--fail-on-geo-answer-cohort-monthly-owned-mrr-drop` | | number (percentage points) | Exit 1 when a cohort's latest sampled-month prompt-balanced MRR declines beyond this threshold; requires owned domains and uncapped monthly detail |
| `--fail-on-geo-answer-cohort-monthly-owned-mrr-min-prompts` | | integer | Minimum owned-cited exact prompts in both samples for the monthly MRR gate; requires the monthly MRR gate (default 2) |
| `--fail-on-geo-answer-cohort-monthly-paired-mrr-drop` | | number (percentage points) | Exit 1 when paired-prompt first-owned-citation MRR declines beyond this threshold; requires two shared owned-citing prompts by default |
| `--fail-on-geo-answer-cohort-monthly-paired-mrr-drop-lower-ci` | | number (percentage points) | Exit 1 only when the 95% paired-prompt bootstrap interval confirms a decline beyond this threshold; requires ten shared prompts by default |
| `--fail-on-geo-answer-cohort-monthly-paired-mrr-min-matched-prompts` | | integer | Override paired monthly MRR support floor; requires either paired monthly MRR gate |
| `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop` | | number (percentage points) | Exit 1 when paired exact-prompt owned-citation reach drops beyond this threshold; requires two matched prompts by default |
| `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-drop-lower-ci` | | number (percentage points) | Exit 1 only when the 95% paired-prompt bootstrap interval confirms a reach decline; requires ten matched prompts by default |
| `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-decline` | | number (percentage points) | Exit 1 when latest-transition reach decline exceeds this amount and the report-wide Holm-adjusted McNemar p-value is at most 0.05; fails closed on incomplete family detail |
| `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-holm-alpha` | | number (p-value) | Override the Holm gate p-value cutoff; requires the Holm decline gate |
| `--fail-on-geo-answer-cohort-monthly-owned-prompt-coverage-min-matched-prompts` | | integer | Override monthly owned-reach gate support floor; requires a monthly owned-reach gate |
| `--geo-answer-owned-prompt-coverage-csv` | | string (path) | Export owned-citation distinct-prompt reach, snapshot coverage, and event share overall and by provider; requires answer observations and an owned domain |
| `--geo-answer-owned-prompt-reach-period-csv` | | string (path) | Compare matched owned reach with leave-one-out sensitivity, bootstrap interval, exact McNemar, and Holm adjustment |
| `--geo-answer-owned-prompt-opportunities-csv` | | string (path) | List exact provider/prompt groups with no owned citation, alternate cited domains, dates, and cap state; requires answer observations and an owned domain |
| `--geo-answer-provider-owned-gaps-csv` | | string (path) | Find exact prompts with owned citation on one provider but not another; requires answer observations and an owned domain |
| `--geo-answer-provider-owned-gap-comparison-csv` | | string (path) | Track matched exact-prompt provider owned-citation gap states across baseline/current samples; requires the same owned-domain set |
| `--geo-answer-competitive-gaps-csv` | | string (path) | Rank retained alternative cited domains by provider/prompt citation-event support for gaps without owned citations; requires answer observations and an owned domain |
| `--geo-answer-competitive-gap-comparison-csv` | | string (path) | Compare alternative-domain citation-event shares for matched provider/prompt groups across periods; requires baseline/current observations and an owned domain |
| `--fail-on-geo-answer-provider-balanced-citation-drop` | | number (percentage points) | Exit 1 when any provider’s equal-prompt citation-coverage mean falls beyond this threshold; requires complete matched baseline/current prompt detail |
| `--fail-on-geo-answer-owned-first-position-drop` | | number (percentage points) | Exit 1 when the event share of owned citations at rank 1 falls beyond this threshold; requires baseline/current samples and owned citations on both sides |
| `--fail-on-geo-answer-owned-top-three-drop` | | number (percentage points) | Exit 1 when owned citation-event share in ranks 1–3 falls beyond this threshold; requires baseline/current samples and owned citations on both sides |
| `--fail-on-geo-answer-length-owned-top-three-drop` | | number (percentage points) | Exit 1 when paired-prompt owned top-three share falls within a matched answer-length band; requires complete profiles and the same owned-domain set |
| `--fail-on-geo-answer-length-owned-first-position-drop` | | number (percentage points) | Exit 1 when paired-prompt owned rank-one share declines within any matched answer-length band; uses the shared exact-prompt support floor |
| `--fail-on-geo-answer-length-owned-first-position-drop-lower-ci` | | number (percentage points) | Fail only when the deterministic paired-prompt 95% bootstrap lower bound for rank-one-share decline exceeds this threshold; default support is 10 matched prompts per band |
| `--fail-on-geo-answer-length-owned-mrr-drop` | | number (percentage points) | Exit 1 when exact-prompt-balanced first-owned-citation MRR declines beyond this threshold within any matched answer-length band; requires complete owned prompt-rank detail |
| `--fail-on-geo-answer-length-owned-mrr-drop-lower-ci` | | number (percentage points) | Fail only when the deterministic paired-prompt 95% bootstrap lower bound for first-owned-citation MRR decline exceeds this threshold; default support is 10 matched prompts per band |
| `--fail-on-geo-answer-length-owned-top-three-drop-lower-ci` | | number (percentage points) | Fail only when the deterministic paired-prompt 95% bootstrap lower bound for a band's mean owned top-three-share decline exceeds this threshold; default support is 10 matched prompts per band |
| `--fail-on-geo-answer-length-owned-rank-min-matched-prompts` | | integer (2–10000) | Minimum exact prompts with owned citations in both periods for every matched band; the gate exits nonzero if any matched band misses this floor; requires a length-stratified rank gate; default 2, or 10 with either lower-CI gate |
| `--fail-on-geo-answer-entity-mention-drop` | | number (percentage points) | Exit 1 when a configured entity’s answer-text mention rate falls beyond this threshold; requires baseline/current samples and comparable answer text |
| `--fail-on-geo-answer-entity-owned-top-three-drop` | | number (percentage points) | Exit 1 when owned citation top-three share in entity-mentioned answers falls beyond this threshold; requires matching samples, entity mentions, owned domain, and owned citations |
| `--fail-on-geo-answer-path-family-coverage-drop` | | number (percentage points) | Fail closed when comparable provider/cohort path-family coverage drops beyond this threshold; requires baseline/current samples and path depth |
| `--fail-on-geo-answer-path-family-prompt-coverage-drop` | | number (percentage points) | Fail closed when comparable distinct-prompt path-family coverage drops beyond this threshold; requires baseline/current samples and path depth |
| `--fail-on-geo-answer-path-family-over-index-drop` | | number (0–1 relative decline) | Fail closed when matched provider/cohort path-family over-index ratios fall beyond this relative threshold; requires baseline/current samples and path depth |
| `--fail-on-geo-answer-entity-path-family-prompt-coverage-drop` | | number (0–100) | Fail on a distinct-prompt path-family coverage decline among entity-mentioned answers; requires baseline/current, entities, and path depth |
| `--fail-on-geo-answer-entity-path-family-top-three-drop` | | number (0–100) | Fail on a path-family top-three citation-share decline among entity-mentioned answers; requires baseline/current, entities, path depth, and citations on both sides |
| `--fail-on-geo-answer-entity-citation-page-prompt-coverage-drop` | | number (0–100) | Fail on an exact page’s distinct-prompt coverage decline in entity-mentioned answers; requires baseline/current, entities, and complete comparable detail |
| `--fail-on-geo-answer-entity-citation-page-top-three-drop` | | number (0–100) | Fail on an exact page’s top-three citation-share decline in entity-mentioned answers; requires comparable cited URLs in both periods |
| `--fail-on-geo-answer-sample-mix-divergence` | | number (0–1 normalized JSD) | Exit 1 when provider labels have a topic/intent sample-mix divergence above this value; requires two or more providers |
| `--fail-on-ai-crawler-timing-regression` | | boolean | Exit 1 on slower comparable response-duration or first-byte p95 bands; requires 20 timed rows per period and a crawler-log baseline |
| `--fail-on-ai-crawler-cloudfront-result-regression` | | boolean | Exit 1 on increased CloudFront Error, CapacityExceeded, or LimitExceeded shares; requires 20 result rows per field and period, plus a baseline |
| `--fail-on-findings` | | boolean | Exit with code 1 when the audit has any failed checks |
| `--fail-on-duplicate-metadata` | | boolean | Exit with code 1 when a batch repeats page titles or meta descriptions |
| `--fail-on-duplicate-content` | | boolean | Exit with code 1 when a batch has exact repeated main content (50+ words) |
| `--fail-on-hreflang` | | boolean | Exit with code 1 when scanned alternate pages lack reciprocal hreflang links; requires internationalization results |
| `--fail-on-canonical-chains` | | boolean | Exit with code 1 when audited canonical URLs form chains or loops, a page declares multiple or invalid canonical URLs, or result data is unavailable; requires metaTags results |
| `--fail-below-score` | | number | Exit with code 1 when the score is below the given 0-100 threshold |
| `--baseline` | | string (path) | Compare against a previous single-audit or matching URL-list batch JSON report |
| `--comparison-output` | | string (path) | Save baseline deltas, including structured GEO changes, as a separate JSON artifact; requires a baseline. See the [comparison JSON Schema](docs/geo-report-comparison.schema.json) and [single-page](examples/geo-report-comparison.single-page.example.json) / [batch](examples/geo-report-comparison.batch.example.json) examples |
| `--geo-comparison-csv` | | string (path) | Save per-page baseline GEO signal changes and comparison coverage as CSV; requires a baseline |
| `--geo-gate-output` | | string (path) | With `--fail-on-geo-change`, save the versioned gate decision, single-page or batch scope, normalized filters, failure codes, coverage counts, and matching changes as JSON; see the [gate schema](docs/geo-change-gate.schema.json), [single-page example](examples/geo-change-gate.example.json), and [batch example](examples/geo-change-gate.batch.example.json) |
| `--geo-crawler-path-family-failure-gate-json` | | string (path) | With `--fail-on-geo-crawler-path-family-failure-rise`, save matched-family support, truncation, and failure-rise details as versioned JSON; see the [schema](docs/geo-crawler-path-family-failure-gate.schema.json) and [example](examples/geo-crawler-path-family-failure-gate.example.json) |
| `--fail-on-regression` | | boolean | Exit with code 1 on a score drop or newly failing check; requires a baseline |
| `--fail-on-geo-change` | | boolean | Exit with code 1 when GEO signals change or matched reports lack comparable GEO data; requires a baseline and GEO checks; also works with saved reports via `--render` |
| `--fail-on-geo-change-signal` | | string (exact signal label) | Repeat to fail only on selected GEO signal changes; copy labels from `--geo-comparison-csv`; requires `--fail-on-geo-change` |
| `--fail-on-geo-change-url` | | string (exact URL) | Repeat to restrict GEO change failures to selected page URLs; combines with signal filters; copy URLs from `--geo-comparison-csv`; requires `--fail-on-geo-change` |
| `--fail-on-geo-change-transition` | | string (`before=>after`) | Repeat to gate only exact state transitions, such as `allowed=>blocked`; combines with signal and URL filters; requires `--fail-on-geo-change` |
| `--category` | | string | Run only the comma-separated checker keys provided; repeatable |
| `--json` | | boolean | Output raw JSON string directly to standard output |
| `--config` | `-c` | string | Path to a custom JSON or YAML configuration file |
| `--preset` | `-p` | string | Configuration preset name (`basic`, `advanced`, `strict`, `geo`) |
| `--verbose` | `-v` | boolean | Output check details object for failed entries |
| `--headed` | | boolean | Run the browser simulator in headed mode (visible) |
| `--viewport` | | string | Set simulator window size (e.g. `1920x1080` or `375x667`) |
| `--init-config`| | boolean | Create a default configuration template file in the CWD |
| `--doctor` | | boolean | Check Node.js, Chromium, environment, and configuration readiness; add `--json` for structured output |
| `--version` | `-V` | boolean | Print the installed Aviary version |
| `--completion` | | `bash`, `zsh`, or `fish` | Print a shell completion definition to stdout |

### Shell Completions

Generate a completion file for the shell you use:

```bash
# Bash
mkdir -p ~/.local/share/bash-completion/completions
aviary --completion bash > ~/.local/share/bash-completion/completions/aviary

# Zsh
mkdir -p ~/.zfunc
aviary --completion zsh > ~/.zfunc/_aviary

# Fish
mkdir -p ~/.config/fish/completions
aviary --completion fish > ~/.config/fish/completions/aviary.fish
```

Add `fpath=(~/.zfunc $fpath)` and `autoload -Uz compinit && compinit` to `~/.zshrc`, then restart Zsh. For Fish, write the output to `~/.config/fish/completions/aviary.fish`. Regenerate the completion file after upgrading Aviary to refresh its option and checker-category list.

`--render <report.json>` recreates formats from a saved Aviary JSON report. Single reports support
HTML, PDF, JUnit, SARIF, Markdown, and CSV; batch reports support every format listed here.

Batch GEO summaries can be saved as machine-readable JSON alongside the full audit report. The `schemaVersion: 1` summary includes its source audit timestamp, sitewide crawler access, snippet controls, answer-content and source/rendered profiles, citation evidence with bounded source-domain link distributions, entity identity, source hosts, and optional `llms.txt` coverage. Its compact per-page matrix exposes the same observed signals for each audited URL, omits page prose, and does not define a GEO score. Per-page structured identity inventories show schema types, IDs, names, and `sameAs` URLs, with explicit indicators when their 20-entity or 10-link limits are reached. The summary lists shared identity IDs whose normalized @type sets differ and whose complete `sameAs` link sets differ across pages for consistency review; capped entity/link inventories are excluded from sameAs comparisons. Validate the summary with the [GEO summary JSON Schema](docs/geo-summary.schema.json). In watch mode, the file contains the latest completed batch.

```sh
aviary --sitemap https://example.com/sitemap.xml --category geo --geo-summary-output reports/geo-summary.json --geo-summary-csv reports/geo-pages.csv --geo-entity-variants-csv reports/geo-entity-variants.csv --geo-crawler-access-csv reports/geo-crawler-access.csv --output reports/audit.json
```

`--sitemap <url>` recursively reads same-origin sitemap indexes, including gzip-compressed sitemap files, filters page URLs through the origin's `robots.txt` policy, and audits up to `--max-urls` allowed pages (default 1,000). External page URLs and sitemap indexes are skipped. Sitemap documents are limited to 5 MiB both before and after decompression. Discovery progress is written to stderr so JSON stdout stays clean.

The programmatic `discoverSitemapUrls(url, options)` API accepts `onDocument` for progress updates and an optional `SitemapDiscoveryCache` for conditional requests across repeated scans. Use `filterUrlsByRobotsTxt(urls, siteUrl)` to apply the same policy before auditing those URLs yourself.

`--crawl <url>` discovers pages by following links from fetched same-origin HTML when a sitemap is unavailable. It returns the start URL plus pages found within `--max-depth` (default 2, max 32), capped by `--max-urls` (default 1,000, max 10,000). Discovery concurrency follows `--concurrency`; each page request has a 30-second timeout and 2 MiB HTML-body cap (`--max-crawl-page-bytes` can raise it to 10 MiB), with a combined 100 MiB body cap (`--max-crawl-bytes` can raise it to 1 GiB), plus a 10,000-link capture cap. It follows same-origin anchor and image-map area links and skips off-origin links and redirects. Discovery and browser audits use AviaryBot's user agent and honor `nofollow` directives and `robots.txt` rules; JavaScript is not executed. See the [crawling guide](docs/CRAWLING.md) for details and the `discoverLinkedUrls()` library API.

```bash
aviary --crawl https://example.com/ --max-depth 3 --max-urls 500 --concurrency 2 --html reports/site.html
```

HTML, PDF, Markdown, JUnit, SARIF, and CSV batch reports include cross-page metadata findings, exact duplicate page text, hreflang reciprocity, and canonical consistency. Reciprocity and canonical chains are checked only when relevant target pages completed in the batch; targets outside the batch remain unverified. Shared canonical targets are informational because alternate copies may intentionally canonicalize to one URL. The scanned-page link graph counts only links between completed URLs in the batch, shows the most-linked pages and pages with no observed inbound or outbound links, and marks pages where bounded link capture may be incomplete. `analyzeSiteWideLinkGraph(batch)`, `analyzeSiteWideHreflang(batch)`, and `analyzeSiteWideCanonicals(batch)` return these summaries to library callers.

`--urls` also accepts a quoted local file glob. Aviary supports `*`, `?`, and recursive `**`, reads matching files in sorted path order, and combines their URL lines:

```bash
aviary --urls 'url-lists/**/*.txt' --concurrency 4 --html reports/site.html
```

The glob can match up to 1,000 files, visit at most 100,000 filesystem entries, and traverse at most 32 directory levels. Hidden paths are skipped by wildcard segments; symlinks are not followed.
List files and stdin must contain valid UTF-8. The combined list is capped at 10,000 URLs and 25 MiB of input, including when reading stdin.

`--watch <seconds>` reruns a `--urls` collection or rediscovers sitemap/crawl pages each cycle, without overlap, and rewrites selected reports after each batch. Sitemap and link-crawl watch modes revalidate cached discovery responses with ETag/Last-Modified headers; each cache is bounded at 20 MiB and 1,000 entries.
`--history` appends every batch to JSONL. With `--json`, watch mode writes one compact JSON batch per stdout line. Watch mode does not use baselines or one-shot CI failure gates.

`--wait-until` selects the browser navigation event that allows checks to begin. `networkidle` waits for network activity to settle; `load` and `domcontentloaded` can handle pages with long-lived requests, but may audit before late client-rendered content appears.
Completed JSON page reports include `navigationWaitUntil` and `settleAfterNavigationMs` for audit traceability. `--settle-ms` sets a fixed 0–30,000 ms delay after that event; the default is 1,000 ms.

For `--urls`, an audit error on any listed URL makes the CLI exit non-zero; use
`--fail-on-findings` as well when completed pages should also fail the run for SEO check findings.

---

## Environment Variables (12-Factor Config)

CLI runtime options can be configured via environment variables for 12-factor deployment and
container environments. Use `--urls` to provide a multi-page input file:

| Variable | Type / Values | Description |
|---|---|---|
| `AVIARY_URL` | string | Target URL (overridden by `-u` / `--url`) |
| `AVIARY_HEADLESS` | `"true"` \| `"false"` | Run browser headless (overridden by `--headed`) |
| `AVIARY_TIMEOUT` | number (ms) | Page load timeout in milliseconds (default: `30000`; overridden by `--timeout`) |
| `AVIARY_SETTLE_AFTER_NAVIGATION_MS` | integer (0–30000 ms) | Fixed delay after navigation readiness (default: `1000`; overridden by `--settle-ms` or an API/MCP request field) |
| `AVIARY_VIEWPORT` | `"WxH"` | Simulator viewport size (overridden by `--viewport`) |
| `AVIARY_PRESET` | `"basic"` \| `"advanced"` \| `"strict"` \| `"geo"` | Active rule preset (overridden by `--preset`) |
| `AVIARY_OUTPUT` | string (path) | Destination path for JSON report (overridden by `--output`) |
| `AVIARY_HTML_OUTPUT` | string (path) | Destination path for HTML report (overridden by `--html`) |
| `AVIARY_PDF_OUTPUT` | string (path) | Destination path for PDF report (overridden by `--pdf`) |
| `AVIARY_HISTORY_OUTPUT` | string (path) | Append audit history records to a JSONL file (overridden by `--history`) |
| `AVIARY_JUNIT_OUTPUT` | string (path) | Destination path for JUnit XML report (overridden by `--junit`) |
| `AVIARY_SARIF_OUTPUT` | string (path) | Destination path for SARIF 2.1.0 report (overridden by `--sarif`) |
| `AVIARY_MARKDOWN_OUTPUT` | string (path) | Destination path for Markdown report (overridden by `--markdown`) |
| `AVIARY_CSV_OUTPUT` | string (path) | Destination path for CSV report (overridden by `--csv`) |
| `AVIARY_CONCURRENCY` | integer (1-8) | Maximum simultaneous URL audits (default `2`; overridden by `--concurrency`) |
| `AVIARY_FAIL_ON_FINDINGS` | `"true"` | Return a failing exit code when the audit has failed checks |
| `AVIARY_FAIL_ON_DUPLICATE_METADATA` | `"true"` | Fail batch scans with repeated page titles or descriptions |
| `AVIARY_FAIL_ON_DUPLICATE_CONTENT` | `"true"` | Fail batch scans with exact repeated main content |
| `AVIARY_FAIL_BELOW_SCORE` | number (0-100) | Return a failing exit code when the score is below the threshold; overridden by `--fail-below-score` |
| `AVIARY_BASELINE_REPORT` | string (path) | Previous report to compare against (overridden by `--baseline`) |
| `AVIARY_FAIL_ON_REGRESSION` | `"true"` | Fail on a score drop or newly failed check; requires a baseline |
| `AVIARY_CATEGORIES` | comma-separated keys | Run only the listed checker categories (overridden by `--category`) |
| `AVIARY_LOG_LEVEL` | `"debug"` \| `"info"` \| `"warn"` \| `"error"` | Log verbosity (default: `info`) |
| `AVIARY_LLM_PROVIDER`| `"ollama"` \| `"stub"` | LLM provider for semantic checks (default: `stub`) |
| `AVIARY_LLM_ENDPOINT`| string | LLM endpoint URL (default: `http://localhost:11434`) |
| `AVIARY_LLM_MODEL` | string | Ollama model identifier (default: `llama3`) |
| `AVIARY_LLM_API_KEY` | string | Reserved for a future provider; unused by the current stub and Ollama analyzers |
| `AVIARY_METRICS_PORT`| integer (1-65,535) | Loopback-only Prometheus `/metrics` port (default: `9090`) |
| `AVIARY_API_HOST` | string | REST API bind address (default: `127.0.0.1`) |
| `AVIARY_API_PORT` | integer | REST API listen port (default: `3333`) |
| `AVIARY_API_KEY` | secret | Optional bearer key for local API use; required for non-loopback access |
| `AVIARY_API_TLS_CERT` / `AVIARY_API_TLS_KEY` | file paths | TLS certificate and private key; both required for non-loopback API binds |
| `AVIARY_API_MAX_BATCH_URLS` | integer (1-1,000) | Maximum URLs accepted in one API job (default: `100`) |
| `AVIARY_API_MAX_CONCURRENT_JOBS` | integer (1-8) | Simultaneous batch jobs (default: `2`) |
| `AVIARY_API_MAX_PENDING_JOBS` | integer (0-100) | Jobs waiting for a worker (default: `10`) |
| `AVIARY_API_MAX_STORED_JOBS` | integer (1-10,000) | Job records retained in memory (default: `100`) |
| `AVIARY_API_RATE_LIMIT_REQUESTS` | integer | Requests per IP per window (default: `60`) |
| `AVIARY_API_RATE_LIMIT_WINDOW_MS` | integer (1,000-86,400,000) | Rate-limit window duration in milliseconds (default: `60,000`) |

### Prometheus Metrics

The CLI starts a lightweight, loopback-only Prometheus server on `127.0.0.1:9090` (or the port selected by `AVIARY_METRICS_PORT`). Scrape `http://127.0.0.1:9090/metrics` for default Node.js runtime metrics. The server is started only when the CLI runs as an executable, not when its module is imported.

---

## Configuration

You can customize which audits to run and modify their rules via custom config files or presets.

> [!NOTE]
> Presets restrict or expand the check list:
> - **basic**: Fast, essential checks (ideal for rapid CI checks)
> - **advanced**: Comprehensive analysis covering heatmap simulations (default)
> - **strict**: Full checks with stricter scoring rules

Beyond enabling/disabling rules and setting severity, individual checks' numeric thresholds (minimum word count, title length bounds, image count ceilings, and so on) can be overridden per rule via an `options` object in the config file — see [`examples/CONFIG.md`](examples/CONFIG.md) for the full schema and available checkers.

To write an HTML report programmatically:

```typescript
import { SEOChecker, generateHtmlReport, generatePdfReport } from '@ru1vly/aviary';

async function exportReport() {
  const checker = new SEOChecker({ url: 'https://example.com' });
  const report = await checker.check();
  
  // Write the report to disk
  generateHtmlReport(report, './reports/seo-analysis.html');
  await generatePdfReport(report, './reports/seo-analysis.pdf');
}
```

For a PDF artifact, `renderPdfReport` returns PDF bytes and `generatePdfReport` writes the report
to disk. PDF export uses headless Playwright Chromium; if the browser is missing, install it with
`pnpm exec playwright install chromium`. Batch CLI runs support HTML, PDF, Markdown, JUnit, SARIF, and CSV outputs.

To include single-page baseline changes in HTML or PDF, calculate a comparison first and pass it
to the renderer:

```typescript
import { compareSEOReports, generateHtmlReport, generatePdfReport } from '@ru1vly/aviary';

const comparison = compareSEOReports(report, baselineReport);
generateHtmlReport(report, './reports/seo-analysis.html', comparison);
await generatePdfReport(report, './reports/seo-analysis.pdf', {}, comparison);
```

The comparison panel includes score movement, new and resolved checks, and GEO signal changes.
The GEO differences describe saved audit snapshots and do not predict citations.

For CI systems that ingest JUnit XML, import `renderJunitReport` to get the XML string or
`generateJunitReport` to write it to disk. Each SEO check is a testcase grouped under its checker
category; failed checks appear as JUnit failures. `renderMarkdownReport` and
`generateMarkdownReport` provide a compact human-readable version with category counts and failed
findings.
`renderSarifReport` and `generateSarifReport` create [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html) logs from failed checks. Batch
variants also include failed URL audits and cross-page metadata, content, hreflang, and canonical
findings; related pages appear as SARIF related locations. Results point to the audited page URL
because these are page-level findings rather than source-code line diagnostics. Rule help includes
Aviary's suggested action and, when available, a small code example.
`renderCsvReport` and `generateCsvReport` export every check, including its category, rule name,
pass state, severity, message, JSON details, and (for failures) the recommended action, priority,
estimated Aviary score lift, quick-win flag, and any example snippet. Batch CSV includes the same
action columns per URL. Formula-like cell values are prefixed so they stay inert when opened in spreadsheet software.
`compareSEOReports(current, baseline)` returns the score delta, newly failing checks, and resolved
checks; pass the result as the optional third argument to `generateMarkdownReport` to include the
comparison in the Markdown artifact. Category-filtered JSON reports record their selected scope, and
comparison rejects reports that used different category selections.
`compareSEOAuditBatches(current, baseline)` compares completed pages by URL, reports added and removed
URLs, and suppresses the average score delta when the URL list changes so the regression gate only
compares matching collections.
`compareSEOWithCompetitors(target, competitors)` aggregates target-only and competitor-only failed checks and compares the target score with the competitor average. `renderSEOCompetitorMarkdownReport` / `generateSEOCompetitorMarkdownReport` produce a readable report. Compare equivalent page types with the same category scope; the score gap is Aviary’s audit score, not a search-ranking prediction.

```typescript
import { auditUrls, generateSEOCompetitorMarkdownReport } from '@ru1vly/aviary';

async function comparePages() {
  const batch = await auditUrls([
    'https://store.example.com/product-a', // target page
    'https://competitor-one.example/product-a',
    'https://competitor-two.example/product-a',
  ]);
  const targetResult = batch.results[0];
  if (targetResult.status !== 'complete') throw new Error(targetResult.error);
  const competitorReports = batch.results.slice(1).flatMap((result) =>
    result.status === 'complete' ? [result.report] : []
  );
  if (competitorReports.length === 0) throw new Error('No competitor audits completed');
  generateSEOCompetitorMarkdownReport(targetResult.report, competitorReports, './reports/competitors.md');
}

comparePages();
```

`generateSEORecommendations(report)` turns failed checks into severity-ordered, category-aware actions with code snippets for common missing metadata and accessibility fields. HTML and Markdown reports include the highest-priority steps, quick-win labels, and an estimated single-check lift in Aviary's own weighted score (not a search-ranking prediction).

Batch results have matching `renderBatch*Report` and `generateBatch*Report` functions for HTML,
PDF, Markdown, JUnit XML, SARIF, and CSV. The self-contained HTML dashboard supports URL/finding search,
health filters, sorting, expandable per-page findings, and optional baseline deltas. They include URL-level audit errors in the Markdown and CSV output and report
them as JUnit errors, while completed pages retain their per-check results:

Batch exports also include cross-page repeated titles, descriptions, and exact page text: JUnit
records each duplicate group as a failing testcase, and CSV adds a `sitewide` row with affected URLs
in its JSON `details` cell. Content matching uses a SHA-256 fingerprint of normalized extracted text;
it needs at least 50 words and skips pages whose normalized content exceeds 256,000 characters. The
hash is retained in JSON and CSV check details, but the page text is not. The CI gate fails when it
cannot fingerprint an eligible page, so selecting the `content` category is required.
Link graph capture considers up to 1,000 unique targets per source page, accepts candidates up to
2,048 characters, and stores at most 250 audited-page edges. The report calls out pages where a bound
was reached.

```typescript
import {
  auditUrls,
  generateBatchHtmlReport,
  generateBatchPdfReport,
  generateBatchJunitReport,
  generateBatchMarkdownReport,
  generateBatchCsvReport,
} from '@ru1vly/aviary';

const batch = await auditUrls(['https://example.com/', 'https://example.com/about']);
generateBatchHtmlReport(batch, './reports/pages.html');
await generateBatchPdfReport(batch, './reports/pages.pdf');
generateBatchJunitReport(batch, './reports/pages.xml');
generateBatchMarkdownReport(batch, './reports/pages.md');
generateBatchCsvReport(batch, './reports/pages.csv');
```

To keep a trend trail, `appendSEOReportHistory` writes one line for a single report and
`appendSEOAuditBatchHistory` writes one line per URL, including failed audit attempts. The CLI
equivalent is `--history <file>` or `AVIARY_HISTORY_OUTPUT`; each line is an independent JSON record. Completed records retain `navigationWaitUntil` and `settleAfterNavigationMs` so trend samples preserve browser capture timing.
Use `readSEOAuditHistory` and `generateSEOAuditHistoryHtmlReport` to create a self-contained score
timeline by URL, or call `generateSEOAuditHistoryReportFromFile` to read JSONL and write HTML in one step.
The CLI equivalent is `aviary --history-report reports/history.jsonl --html reports/history.html`. The self-contained dashboard supports URL search, health filters, and sorting.
The history reader processes JSONL incrementally and rejects individual records larger than 10 MiB.

```typescript
import { SEOChecker, generateJunitReport, generateMarkdownReport, generateCsvReport } from '@ru1vly/aviary';

const checker = new SEOChecker({ url: 'https://example.com' });
const report = await checker.check();
generateJunitReport(report, './reports/aviary.xml');
generateMarkdownReport(report, './reports/aviary.md');
generateCsvReport(report, './reports/aviary.csv');
```

---

## Native Architecture & Terminal UI

Aviary combines a high-fidelity TypeScript + Playwright browser crawler with high-performance Rust components:

1. **Interactive TUI Dashboard**: Built with [Ratatui](https://crates.io/crates/ratatui) and Crossterm in `tui/`. Running `aviary` with no arguments boots into a responsive terminal dashboard with real-time audit navigation, score meters, and issue inspectors.
2. **Fast Static Engine (`aviary-fast`)**: Native Rust parser built with `reqwest`, `scraper`, and `tokio` for microsecond-level raw HTTP checks.
3. **Platform Prebuilt Binaries**: Shipped via optional dependencies for zero-compilation startup:
   - `@ru1vly/aviary-linux-x64`
   - `@ru1vly/aviary-linux-arm64`
   - `@ru1vly/aviary-darwin-x64`
   - `@ru1vly/aviary-darwin-arm64`
   - `@ru1vly/aviary-win32-x64`

---

## Project Structure

```
aviary/
├── src/                   # Source code
│   ├── api/               # Versioned REST API and server entry point
│   ├── checkers/          # 28 SEO checker modules
│   ├── config/            # Loader, presets, and configuration types
│   ├── errors/            # Logger, error handlers, and retry mechanism
│   ├── types/             # Common TypeScript interfaces
│   ├── index.ts           # Core library entry point
│   ├── crawler.ts         # Bounded sitemap and same-origin link discovery
│   ├── history.ts         # JSONL audit history and trend dashboard
│   ├── cli.ts             # CLI command runner
│   └── reporter.ts        # HTML, PDF, JUnit, SARIF, Markdown, and CSV report generators
├── examples/              # Code samples and config file templates
├── docs/openapi.yaml      # REST API contract
├── tests/                 # Unit, integration, and E2E tests
└── dist/                  # Compiled JavaScript distribution
```

---

## Development Setup

To build and test the tool locally:

```bash
# Clone the repository
git clone https://github.com/Ru1vly/Aviary.git
cd Aviary

# Install project dependencies
pnpm install

# Download required browser binaries
pnpm exec playwright install chromium

# Compile TypeScript code to distribution folder
pnpm run build

# Run unit and integration tests
pnpm run test
```

---

## License

This project is licensed under the MIT License.
