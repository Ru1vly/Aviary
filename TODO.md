# TODO: Production Readiness Checklist

This document outlines the remaining tasks to make the aviary checker tool production-ready.

This is a feature backlog, not a release sign-off: checked items mean the capability or workflow is implemented, not that it was re-verified in the current pass. For release blockers, current verification, and maintainer actions, see [`RELEASE_READINESS.md`](./RELEASE_READINESS.md). Unchecked items below are longer-term gaps or optional product directions; they are not all required for the next package release.

## 🐛 Known Issues / Fixes Required
- [x] **CLI Testing**: Integration tests time out even with 120s limit (fixed by replacing slow locator auto-waits with page.evaluate).

## 🎯 Core Features Enhancement

### SEO Checkers
- [x] **Structured Data Validation**
  - [x] JSON-LD schema detection and validation
  - [x] Microdata and RDFa support
  - [x] Schema.org vocabulary validation
  - [x] Rich snippets preview

- [x] **Content Analysis**
  - [x] Keyword density analyzer
  - [x] Content readability score (Flesch-Kincaid)
  - [x] Duplicate content detection
  - [x] Word count and content length analysis
  - [x] Internal and external link analysis
  - [x] Broken link detection

- [x] **Technical SEO**
  - [x] Robots.txt validation
  - [x] XML sitemap detection and validation
  - [x] SSL/HTTPS verification
  - [x] Mobile-friendliness test
  - [x] Page speed insights integration
  - [x] Core Web Vitals (LCP, CLS) — real values via `web-vitals`'/`PerformanceObserver`, injected before navigation; plus FCP and TTFB. INP itself isn't reported (it requires a real user interaction this unattended audit never performs) — Total Blocking Time (long-task entries) is the disclosed proxy instead, same as Lighthouse. See docs/ACCURACY_LIMITATIONS.md §3.4
  - [x] Server response time check
  - [x] Redirect chain detection
  - [x] 404 error detection
  - [x] Batch-level hreflang reciprocity analysis for alternate pages included in the audit set
  - [x] Batch-level canonical URL chain, loop, duplicate-target, and invalid-declaration analysis

- [x] **AI Search / GEO Diagnostics**
  - [x] Package a reproducible prompt-family sensitivity workflow with a synthetic example command
  - [x] Package a configurable cohort-balanced prompt-panel planning workflow with synthetic inputs
  - [x] Page-specific robots.txt matrix with the selected group and exact matching rule/line for major search and AI retrieval crawlers
  - [x] Extend the crawler matrix with user-configured tokens
  - [x] Separate model-training/data-use crawler controls from search access
  - [x] Search preview restriction checks for noindex, nosnippet, and data-nosnippet
  - [x] Measure visible word count/share inside data-nosnippet regions and compare those changes against baselines
  - [x] Compare owned citation rank with exact-prompt balancing, provider summaries, and paired-prompt confidence intervals
  - [x] Gate exact-prompt-balanced rank-one and top-three changes with configurable support and paired-prompt lower-CI checks
  - [x] Gate matched domain citation losses by exact-prompt support, practical decline, and Holm-adjusted McNemar significance
  - [x] Alert on absolute source-category concentration within top-three citation positions using rank-specific mapped-event support
  - [x] Track sampled-month changes in top-three source-category concentration with rank-specific event support
  - [x] Export consolidated versioned assessments for enabled monthly source-category CI gates
  - [x] Cross audited owned-page/provider citation evidence with crawler and preview signals, retaining explicit incomplete-sample absence states
  - [x] Content extraction and citation/evidence profiles for answer-style sections, structured content, provenance, and external source links
  - [x] Generate prioritized Markdown GEO opportunity reviews from sitewide summaries, with optional per-page evidence and observed strengths
  - [x] Compare source/rendered phrase coverage across matching routes on two hosts with scope-checked GEO batch reports
  - [x] Provide one command to capture two live URL sets and generate matched GEO summaries, opportunity reviews, HTML dashboards, and route parity
  - [x] Configure the fixed post-navigation settle delay through CLI, REST, MCP, environment defaults, and per-page report metadata for reproducible client-rendered content audits
  - [x] Rank bounded per-page citation source-host link counts and report leading-host concentration as a review cue
  - [x] Detect citation-shaped fragment links whose in-page targets are missing from the rendered DOM snapshot and count resolved targets containing external source links
  - [x] Compare initial HTML text with browser-rendered phrase samples and summarize sitewide overlap
  - [x] Bounded, robots-aware inventory for optional llms.txt and llms-full.txt conventions
  - [x] Profile optional llms.txt Markdown links by safe target class, duplicates, empty labels, and malformed candidates without fetching or retaining destinations
  - [x] Site-wide batch aggregation for crawler coverage, preview restrictions, sources, and optional GEO files
  - [x] Structured sitewide GEO JSON export with normalized per-page crawler, preview, content, citation, and optional-file signals
  - [x] Versioned GEO summary schema and collapsible per-page dashboard matrix
  - [x] Local analyzer for first-party Bing AI Performance CSV exports
  - [x] Analyze manually sampled AI answer citations by provider, domain, page, exact prompt, month, and operator-labeled cohorts
  - [x] Measure adjacent-capture citation repeatability by exact URL/domain sets, rank-biased overlap, owned-citation persistence, and prompt-balanced bootstrap intervals with explicit sample-completeness exclusions
  - [x] Compare within-period citation repeatability across baseline/current samples on shared provider/context/prompt IDs with one-sided support and matched-prompt uncertainty
  - [x] Gate prompt-paired citation repeatability regressions with configurable support floors and nominal bootstrap upper-bound thresholds
  - [x] Add exact paired-prompt direction sign tests with complete-family Holm adjustment and a shared bounded-work policy
  - [x] Include configured repeatability gate rules, decisions, and failure state in the integrity-checked GEO review bundle
  - [x] Preflight baseline/current GEO capture panels for context and unique-prompt mix drift, exact-prompt support, metadata coverage, capture-depth skew, period and within-period timestamp gaps, UTC-day timeline exports, citation-list completeness, and retained duplicate rows
  - [x] Configure GEO panel warning cutoffs with versioned profiles and emit stable warning codes, observed values, and active cutoffs for CI and offline HTML review
  - [x] Quantify repeated-prompt capture concentration with Kish effective prompt sample size, redundancy factor, largest-prompt share, and a selectable CI warning gate
  - [x] Screen retained exact-prompt panels for bounded TF-IDF lexical near-duplicates without merging groups or claiming semantic equivalence
  - [x] Export lexical prompt components with edge-density signals and family-balanced citation-reach/source-concentration sensitivity intervals
  - [x] Bound exact-prompt and family-balanced owned reach when captured citation lists are incomplete; export unknown states and endpoint-specific family-cluster intervals
  - [x] Sweep lexical prompt-family cosine thresholds to expose clustering topology and provider family-balanced citation/owned-reach sensitivity
  - [x] Render family topology, citation reach, and owned-reach cutoff sensitivity as a bounded offline dashboard
  - [x] Compare pooled and family-balanced mapped-category concentration, leave-one-family-out category influence, and category coverage across lexical thresholds
  - [x] Add prompt-equal hypergeometric owned/non-owned citation-domain and mapped source-category discovery, configured-category match coverage and unmatched-label evidence, configurable marginal next-batch yields, observed-catalog target sample sizing, and per-sample source-list/detail exposure probabilities
  - [x] Add accessible per-provider SVG rarefaction curves to the answer-citation HTML dashboard
  - [x] Add lexical prompt-family weighted source rarefaction for near-duplicate wording sensitivity
  - [x] Compare family-weighted source discovery across similarity thresholds
  - [x] Render offline family source-discovery threshold sweeps with unique accessible chart IDs and a shared HTML row budget
  - [x] Render offline family-weighted source-discovery charts with capped-graph, category, and source-list completeness context
  - [x] Compare provider citation-domain portfolios across lexical prompt families, splitting owned/non-owned hosts and optional mapped categories
  - [x] Render provider/family source-portfolio divergence as a bounded offline dashboard with list-completeness context
  - [x] Sweep provider family-level source overlap across lexical cosine thresholds with one bounded candidate graph
  - [x] Compare baseline/current family source portfolios across lexical thresholds, with citation intensity, event/rank divergence, mapped categories, top domain share shifts, and equal-weight shared-prompt controls
  - [x] Add standalone offline HTML dashboards for family-weighted source discovery and period-level source-mix changes
  - [x] Plot longitudinal family source-divergence sensitivity across cosine thresholds with capped per-cutoff drilldowns
  - [x] Add provider-by-prompt-family evidence rows with citation coverage, owned-reach bounds, owned-rank placement, exact-prompt gap samples, and capped alternative-domain context
  - [x] Add answer-capture support and observed first/top-three placement for alternative domains in entity-mentioned answers without an observed owned citation
  - [x] Split answer citation coverage by operator-recorded model/surface/locale with snapshot intervals, unique-prompt reach, equal-prompt means, and dashboard/CSV exports
  - [x] Export model/surface/locale label completeness by provider and cohort, including UTC-month coverage and explicit retained-profile truncation state
  - [x] Compare baseline/current citation coverage across matching recorded execution contexts while preserving one-sided samples and owned-domain compatibility
  - [x] Decompose matched-context citation-coverage changes into within-context rate movement and execution-context sample-mix shifts
  - [x] Trend execution-context citation coverage by UTC month with prompt-balanced measures and previous-sampled-month gaps
  - [x] Compare captured-answer citation coverage and event density across word-count bands by recorded execution context
  - [x] Compare answer-length citation profiles across periods with one-sided and cap-hidden sample states
  - [x] Trend answer-length citation coverage and density by UTC month with sampled-month gap handling
  - [x] Add prompt-equal answer citation density with deterministic prompt-cluster intervals and monthly/period deltas
  - [x] Decompose matched-support citation-density and owned-citation rank-one/top-three changes into within-band and answer-length-mix effects
  - [x] Compare event-weighted and prompt-equal owned rank-one/top-three shares across answer-length bands and sampled months, with prompt-cluster intervals
  - [x] Compare exact-prompt paired owned rank changes across baseline/current answer-length bands with deterministic paired prompt-cluster intervals
  - [x] Gate paired-prompt owned top-three-share declines within matched answer-length bands; configure exact-prompt support and gate rank-one drops separately and optionally require the 95% bootstrap lower bound for either rank measure to exceed threshold
  - [x] Export exact provider/prompt groups with no owned citation, separating uncited captures from alternate-domain citations and marking retained-detail caps
  - [x] Prioritize alternative-domain citation-event support within owned-citation prompt gaps and compare gap-domain shares across periods with cap-aware states
  - [x] Measure each cited domain's distinct-prompt reach overall and by provider, with nominal intervals and period comparisons
  - [x] Compare per-domain citation reach on matched provider/exact-prompt pairs with gain/loss counts, exact McNemar, paired bootstrap intervals, and fail-closed Holm completeness
  - [x] Add nominal prompt-level Wilson intervals to owned-cited prompt reach overall, by provider, and by labeled cohort
  - [x] Break topic/intent answer-citation cohorts down by provider with separate sample denominators and owned-domain coverage
  - [x] Make providers without observations explicit in each labeled answer-citation cohort
  - [x] Retain provider-specific date ranges in labeled answer-citation cohorts and period comparisons
  - [x] Compare manual AI answer samples on matched provider/prompt cohorts with explicit denominators, observed dates, and owned-citation changes
  - [x] Bound matched owned-prompt reach changes under incomplete citation lists and add a conservative CI gate that requires an optimistic-bound decline
  - [x] Compare labeled topic/intent/provider answer-citation cohorts across periods with denominators, coverage deltas, and bounded domain overlap
  - [x] Gate period-specific owned-cited prompt reach declines within matched labeled cohorts, failing closed on incomplete retained detail
  - [x] Compare owned-cited unique prompt reach for labeled cohorts across periods while preserving separate sample denominators
  - [x] Retain and export baseline-only/current-only labeled cohort presence without implying visibility loss or gain
  - [x] Export matched and unmatched topic/intent/provider answer-citation cohort comparisons to spreadsheet-safe CSV
  - [x] Export current provider/topic/intent citation coverage rows, labeling unsampled pairs distinctly
  - [x] Compare providers within labeled cohorts on shared exact prompts using pooled and equal-prompt citation coverage plus full-cohort prompt overlap
  - [x] Compare matched-provider owned citation-event shares and first-position/top-three citation placement on exact shared prompts
  - [x] Bound cross-provider owned-cited prompt reach under incomplete source lists and export unknown-state counts with provider-pair intervals
  - [x] Quantify provider topic/intent sample-mix divergence with normalized Jensen–Shannon measures
  - [x] Compare provider citation rates standardized to a shared labeled topic/intent cohort mix
  - [x] Flag displayed direction reversals between common-support crude and cohort-standardized provider citation deltas
  - [x] Decompose matched-support crude provider gaps into standardized cohort-rate and sample-mix contributions
  - [x] Standardize baseline/current provider coverage to a shared period mix and decompose cohort contributions
  - [x] Generate pair-specific future prompt quotas from the pooled observed topic/intent panel mix
  - [x] Add an optional minimum unique-prompt quota per provider/cohort to the follow-up plan
  - [x] Plan per-provider/cohort prompt quotas for a worst-case owned-citation reach Wilson interval width
  - [x] Add a minimum exact-prompt Jaccard floor to paired follow-up plans
  - [x] Cap paired prompt follow-up effort per provider pair with explicit deferred cohort targets
  - [x] Cap total paired prompt follow-up effort across provider pairs with deterministic even allocation
  - [x] Allocate a total prompt-plan cap proportionally to required pair demand, with deterministic rounding
  - [x] Include deduplicated provider-pair effort budgets in typed plan summaries
  - [x] Export one provider-pair capture-budget row to spreadsheet-safe CSV
  - [x] Gate GEO prompt-panel plans on quota, overlap, and owned-reach precision targets
  - [x] Export budgeted prompt-panel plans as typed JSON with a published schema and machine-readable target summary
  - [x] Raise minimum sample quotas for selected topic/intent cohorts from a validated JSON target file
  - [x] Set per-cohort paired-group ceilings in prompt-plan budget files
  - [x] Gate baseline/current provider citation and owned-cited prompt-reach declines after standardizing to a matched topic/intent cohort mix
  - [x] Retain monthly provider/topic/intent citation coverage with separate sample denominators
  - [x] Measure provider/source-domain retention across next distinct timestamps of the same prompt and recorded context, with cadence and previous-rank strata, prompt-cluster intervals, and explicit work/output caps
  - [x] Measure exact cited-page URL retention separately from domain persistence, with timestamp-level simultaneous-capture pooling and bounded work/output reporting
  - [x] Mark citation-list completeness on observations and exclude unobservable capped-list absences from domain/page persistence denominators
  - [x] Break source-list completeness down by provider and add absolute and month-over-month CI guardrails
  - [x] Trend incomplete source-list share by provider and topic/intent cohort across sampled months
  - [x] Carry source-list completeness into owned-prompt and entity opportunity rows so incomplete-list gaps remain explicitly qualified
  - [x] Bound owned-citation snapshot and prompt reach under incomplete source lists, trend monthly uncertainty, export known/unknown states, and add fail-closed absolute and monthly-rise CI gates
  - [x] Track monthly owned-cited prompt reach with Wilson intervals, matched-prompt gained/lost transitions, paired bootstrap/McNemar summaries, and fail-closed point/interval CI gates
  - [x] Trend first-owned-citation MRR by month with snapshot/prompt-balanced metrics, paired exact-prompt changes, bootstrap intervals, and fail-closed cohort gates
  - [x] Compare provider cited-domain overlap on shared prompts with set, event-weighted, and reciprocal-rank-weighted similarities
  - [x] Summarize citation-domain concentration and effective source breadth by provider and matched prompt cohort
  - [x] Add exact-prompt cluster bootstrap intervals for provider citation-domain concentration and source breadth, withholding them on capped or inconsistent prompt detail
  - [x] Compare event-weighted and reciprocal-log-rank-weighted source concentration, effective breadth, largest-source share, and prompt-equal domain richness on matched baseline/current provider-prompt clusters
  - [x] Add leave-one-exact-prompt-out HHI influence ranges for event-weighted and rank-discounted source portfolios alongside cluster-bootstrap intervals
  - [x] Compare same-sample provider citation-domain distributions with matched-prompt Jensen–Shannon divergence, event/rank-weighted metrics, cluster intervals, and bounded pair-panel reporting
  - [x] Measure baseline/current source-portfolio drift on matched provider/exact-prompt groups with event/rank-weighted Jensen–Shannon divergence and source-presence gains/losses
  - [x] Attribute matched-prompt source-share shifts to domains with prompt-cluster intervals, offline filtering, structured JSON/CSV exports, and fail-closed point/lower-CI and Holm-adjusted exact sign-test gates with CI artifact CSV
  - [x] Compare same-sample provider citation-domain distributions with matched-prompt Jensen–Shannon divergence, pooled and prompt-balanced metrics, cluster intervals, and bounded pair-panel reporting
  - [x] Export provider citation-source co-occurrence networks with prompt-level Jaccard/lift, conditional rates, weighted degree, PageRank, connected components, and explicit domain/work/output caps
  - [x] Compare baseline/current provider source networks on matched exact prompts, including node-centrality drift, edge transitions, adjusted-Rand community stability, and bounded comparison work
  - [x] Emit bounded community-lineage rows that distinguish stable groups, splits, merges, and membership reconfiguration across periods
  - [x] Build reciprocal-log-rank-weighted provider source networks with normalized per-prompt source-share edge strength, weighted PageRank, and independent rank-detail completeness
  - [x] Compare provider co-citation edge reach on matched prompts with exact/approximate McNemar, complete-family Holm correction, and leave-one-prompt-out sensitivity bounds
  - [x] Compare baseline/current provider co-citation edge-gap changes on four-cell matched prompts with prompt-cluster uncertainty, Holm correction, and explicit detail/work caps
  - [x] Add an exact leave-one-prompt-out sensitivity range to provider edge-gap difference-in-differences
  - [x] Render matched-period provider edge-gap changes in an offline, filterable GEO review page
  - [x] Download the currently filtered matched-edge rows from both offline comparison dashboards as spreadsheet-safe CSV
  - [x] Add deterministic, work-bounded weighted label-propagation communities to event/rank-weighted source networks and dashboard
  - [x] Add weighted modularity and per-community contributions to qualify retained citation-community separation against a degree-preserving graph reference
  - [x] Emit one bounded provider-network summary row with retained graph size, community count, largest group, modularity, and detail/convergence state
  - [x] Add an offline event/rank community-lineage review page with provider, row-type, transition-class, support, and text filters, weighted flow diagram, and safe CSV/SVG exports
  - [x] Compare rank-weighted source-network reach, edge strength, centrality drift, and adjusted-Rand community stability across matched exact prompts with independent detail and work caps
  - [x] Add an offline interactive source-network dashboard with provider filtering, domain search, support thresholds, pan/zoom, and node metric inspection
  - [x] Surface aggregate rank-discounted source HHI and effective breadth beside event-weighted concentration in the answer dashboard
  - [x] Aggregate current GEO audit states across cited pages by signal, dimension, and measured/not-run/not-assessed state; export owned-page and owned-event shares when configured
  - [x] Summarize mean, median, first, and top-three positions in manually captured cited-URL lists for each retained page and domain
  - [x] Gate baseline/current owned citation-event share at rank 1 without requiring captured answer text
  - [x] Split cited-page and domain source positions by provider, retaining event, answer, and prompt denominators
  - [x] Compare retained provider/page source positions across answer samples with explicit one-period presence and truncation states
  - [x] Inventory all audited owned URLs against captured citation pages with current crawl/content signals and sample-aware absence states
  - [x] Compare audited owned-page citation volume and source-list position by page and provider across baseline/current answer samples
  - [x] Compare owned-page/provider citation evidence and measured GEO audit-signal changes across baseline/current audit snapshots
  - [x] Group citation domains into operator-defined source categories with provider rank mixes and baseline/current share changes
  - [x] Decompose mapped source-category share change into within-provider movement and provider citation-mix effects on shared provider support
  - [x] Track monthly source-category concentration, diversity, and mapped-event coverage by provider/topic/intent cohort
  - [x] Gate absolute mapped source-category HHI and month-over-month spikes with configurable thresholds, minimum event support, and fail-closed completeness checks
  - [x] Aggregate AI crawler access logs into configurable, dynamic-segment-aware route families
  - [x] Render route-family dashboards, aggregate exact crawler/audit signals by URL template, compare paired crawl periods and shared-path audit snapshots, and gate matched-family failure-share rises with explicit support and cap states
  - [x] Render monthly source-category concentration and coverage as a filtered offline dashboard
  - [x] Visualize within-provider and provider-mix category effects in an offline period-comparison dashboard
  - [x] Audit source-category host mappings for specific-child precedence, unmatched high-support domains, and retained-catalog coverage
  - [x] Quantify operator-defined source-category mix concentration with HHI, effective category count, and largest share
  - [x] Report baseline/current category-distribution Jensen–Shannon divergence on shared providers, including when HHI stays unchanged and expose signed category contributions plus exact-prompt-balanced uncertainty
  - [x] Measure operator-defined source-category presence across unique provider/prompt groups with explicit retained-domain cap states
  - [x] Export prompt/provider/category evidence rows with matched source domains and cap-aware absence states
  - [x] Track monthly provider/cohort source-category presence with previous-sample comparisons and cap-aware states
  - [x] Compare provider source-category presence on shared exact prompt groups with cap-aware denominators
  - [x] Identify source-category co-citation pairs by provider and exact prompt with complete-profile overlap, conditional presence, lift, and excess over independence
  - [x] Compare category-without-owned-citation gaps on matched exact prompts, with cap-aware states and same-owned-domain requirements
  - [x] Show operator-defined category share, source position, and complete-only concentration in the answer HTML dashboard
  - [x] Cross source categories with cited URL path families by provider and source-list placement
  - [x] Compare category/path-family citation volume and placement across baseline/current samples with cap-aware deltas
  - [x] Add a fail-closed baseline/current gate for large path-family cohort over-index declines
  - [x] Track path-family over-index ratio changes against the prior family-cited month with cap-aware states
  - [x] Report snapshot-weighted and prompt-balanced path-family coverage with period deltas

  - [x] Cross entity mentions with cited URL path-family coverage and prompt-balanced coverage by provider/cohort

  - [x] Compare entity-conditioned path-family coverage across baseline/current answer samples and gate prompt coverage declines

  - [x] Track entity-conditioned path-family citation coverage by UTC month, provider, and supplied cohort

  - [x] Add a fail-closed baseline/current threshold for prompt-balanced path-family coverage drops
  - [x] Join cited answer pages to exact paths in prior AI crawler-log reports and compare their timestamp ranges
  - [x] Profile external-domain co-citations alongside owned citations, with provider denominators, bounded examples, and CSV export
  - [x] Compare external-domain co-citation coverage and event shares across manually sampled answer periods
  - [x] Compare cited-domain source mix for exact entity-mentioned and non-mentioned answer-text samples, by provider and month
  - [x] Roll entity-conditioned citation-event shares into operator-defined source categories with provider/cohort slices and cap-aware deltas
  - [x] Compare entity-conditioned source-category event shares across baseline/current samples with one-period and truncation states
  - [x] Quantify mention/non-mention source-category mix divergence with cap-aware Jensen–Shannon metrics
  - [x] Compare entity-associated domain citation shares across matching baseline/current answer samples
  - [x] Track exact entity-associated cited-page coverage, event share, and source placement by mention status, provider, cohort, and UTC month
  - [x] Compare exact entity-associated cited-page movement across baseline/current samples with cap-aware one-sided states
  - [x] Gate CI on exact-page distinct-prompt coverage drops within entity-mentioned answers
  - [x] Gate CI on exact-page top-three citation-share drops within entity-mentioned answers
  - [x] Compare owned citation rank shares in exact entity-mention and non-mention answers by provider and retained month/topic/intent cohort
  - [x] Track entity mention and owned-citation rank changes against the previous sampled month without treating unsampled months as zero
  - [x] Retain alternative-domain citation-event counts in entity-mentioned answers without owned citations, with source-category rollups
  - [x] Add nominal Wilson 95% intervals to entity mention and citation-coverage rates, including clear repeated-prompt caveats
  - [x] Profile exact entity co-mentions by provider and month/topic/intent with conditional rates, snapshot/prompt Jaccard, lift, and rate intervals
  - [x] Compare entity co-mention rates, overlap, and lift across baseline/current samples with cap-aware missing-pair states
  - [x] Gate CI on drops in owned citation top-three share within exact entity-mention answer samples
  - [x] Drill entity mention and citation coverage down to exact prompt/provider rows with uncertainty intervals
  - [x] Compare exact entity prompt outcomes across baseline/current samples with cap-aware presence states
  - [x] Gate entity mention-rate drops over matched exact prompt/provider rows with fail-closed coverage requirements
  - [x] Compare entity mention and citation outcomes across providers on shared exact prompts
  - [x] Compare entity-mentioned and non-mentioned citation outcomes within matched provider/exact-prompt groups, with citation-list completeness states and prompt-cluster intervals
  - [x] Add per-provider Wilson intervals and a Newcombe-Wilson interval for shared-prompt pooled entity mention-rate contrasts
  - [x] Show snapshot-weighted and equal-prompt mean mention rates side by side to reveal prompt-volume weighting
  - [x] Retain provider-specific observed dates in exact-prompt entity comparisons
  - [x] Add descriptive Wilson intervals to exact-prompt mention-conditioned citation coverage and shared-provider citation coverage
  - [x] Add equal-prompt mean citation coverage and deterministic prompt-cluster bootstrap intervals to general provider-pair comparisons
  - [x] Apply the equal-prompt bootstrap comparison to owned-citation snapshot coverage as well
  - [x] Bootstrap equal-prompt provider mention-rate and mention-conditioned citation-coverage differences by exact prompt group, keeping repeated snapshots within their prompt cluster
  - [x] Add a fail-closed baseline/current gate using equal weight for each matched prompt/provider entity-mention row
  - [x] Require configurable distinct matched-prompt support per entity before accepting answer-period comparisons
  - [x] Gate cross-provider comparison on minimum whole-sample exact-prompt Jaccard overlap, including disjoint panels
  - [x] Export provider prompt-panel overlap counts and Jaccard with explicit prompt-catalog truncation state
  - [x] Gate GEO comparisons on minimum distinct exact-prompt support per provider
  - [x] Require minimum matched exact-prompt support per provider across baseline/current answer samples
  - [x] Gate CI on explicit percentage-point drops in owned-citation snapshot coverage across answer samples
  - [x] Gate provider-level owned-citation reach across shared exact prompts, independently of repeated snapshot volume
  - [x] Report distinct-prompt owned-citation reach overall and by provider alongside snapshot and citation-event coverage
  - [x] Export owned-citation prompt reach with its prompt, snapshot, and citation-event denominators as spreadsheet-safe CSV
  - [x] Report owned-cited exact-prompt reach by topic/intent cohort and provider
  - [x] Export exact-prompt citation-domain overlap for provider pairs with explicit domain-list and output truncation states
  - [x] Find same-prompt cross-provider owned-citation gaps with per-side support, alternative domains, date ranges, and truncation states
  - [x] Track baseline/current transitions in exact-prompt cross-provider owned-citation gap states
  - [x] Compare within-provider owned-citation prompt reach on matched prompts across periods with paired state counts
  - [x] Add exact paired McNemar and leave-one-prompt-out sensitivity to matched-period owned-citation reach
  - [x] Compare exact cited-page reach on matched prompts with prompt-cluster intervals, Holm-adjusted McNemar gates, and fail-closed citation-list completeness
  - [x] Rank exact third-party page opportunities only on provider/prompt groups with confirmed complete-list absence of owned citations
  - [x] Summarize page opportunities across providers with equal-provider and pooled-prompt reach side by side
  - [x] Track confirmed-no-owned exact-page opportunities independently by UTC month and provider
  - [x] Compare matched monthly exact-page opportunity changes with McNemar, Holm, prompt bootstrap, and a fail-closed reach-rise gate
  - [x] Aggregate confirmed-no-owned exact-page opportunities into configurable origin/path-prefix families
  - [x] Compare confirmed-no-owned page-family reach across all supported URL prefix depths
  - [x] Track monthly path-family opportunity reach with cross-provider means and paired-prompt significance
  - [x] Gate significant monthly path-family opportunity rises with support, completeness, and versioned JSON
  - [x] Add exact McNemar, Holm adjustment, and leave-one-prompt-out sensitivity to same-prompt cross-provider owned-citation reach comparisons
  - [x] Gate each provider on equal-prompt mean citation-coverage drops across complete matched baseline/current samples
  - [x] Compare cited-page JSON-LD `dateModified` days to the latest captured answer-citation day, preserving audit/sample ordering and incomplete date states
  - [x] Cross-tab answer citation path families by provider and supplied topic/intent, compare cohort coverage across periods, and export bounded UTC-month trends with Wilson intervals and a fail-closed CI gate
  - [x] Fail GEO CI on excessive provider topic/intent sample-mix divergence before treating cross-provider sample rates as comparable
  - [x] Gate CI on answer-text mention-rate drops for configured entities with a closed incomplete-sample state
  - [x] Report owned-domain citation-event share separately from answer-snapshot coverage, including provider, prompt, month, and topic/intent breakdowns
  - [x] Track monthly source-list position changes and repeated-prompt domain/URL turnover across timestamped observations; export bounded stability profiles including owned-host and owned-event-share changes
  - [x] Add prompt-paired monthly owned-citation reach with exact McNemar results, Holm adjustment across latest cohort transitions, and a fail-closed effect-size/p-value CI gate
  - [x] Report citation-list first-position and top-three reach per distinct prompt for domains, pages, and providers, with Wilson intervals alongside event-weighted ranks
  - [x] Export matched manual answer-citation period rows to spreadsheet-safe CSV with retained-domain overlap states
  - [x] Add cap-aware exact-prompt/provider cited-domain Jaccard to baseline/current answer comparisons
  - [x] Compare claimed crawler user-agent tokens against caller-supplied IP CIDRs while excluding raw addresses and ranges from reports
  - [x] Distinguish Amazon search, broad AI/product data-use, and user-triggered crawler tokens in GEO checks and access-log analysis
  - [x] Add Mistral search, training, and user-triggered crawlers as separate GEO policy and access-log classes
  - [x] Audit MistralAI-User robots access separately and include it in saved-policy replay, sitewide coverage, baselines, and crawl-log correlation
  - [x] Add Applebot search access and Applebot-Extended model-training policy without counting the policy token as a page crawler
  - [x] Surface per-token data-use `noindex`/`noarchive` directives in GEO audits, saved summaries, baseline comparisons, and Amazonbot crawl review prompts
  - [x] Read bounded Bing AI Performance XLSX worksheets as separate export views and compare one-table XLSX baselines for page, query-map, and topic/intent GEO views
  - [x] Compare Bing page-citation exports across periods using only shared, metric-comparable URLs
  - [x] Compare Bing citation-share averages per URL in percentage points, separately from citation-count deltas
  - [x] Summarize exact-phrase query-to-page overlap from Bing mapping exports with bounded, non-causal reporting
  - [x] Cross-tab Bing topic and intent dimensions with bounded citation metrics
  - [x] Compare Bing topic/intent cohorts across exports, including labeled-row share shifts and bounded phrase turnover
  - [x] Generate an offline searchable HTML review of Bing GEO exports, query mappings, period changes, and current controls
  - [x] Local analyzer for Google Search Console's Search and Discover Generative AI Performance CSV and bounded XLSX exports
  - [x] Join Google Search and Discover AI page exports with independent surface totals/shares, canonical audit bridge, offline filters, and CSV
  - [x] Compare saved Google Search/Discover page matrices across periods with surface-specific impression and share movements
  - [x] Group Google Search/Discover GEO pages by origin and path prefix, with separate surface totals/shares and same-depth family movement, plus current audit-control context
  - [x] Export bounded Google Search/Discover path-family metrics and same-depth period movement to a separate CSV
  - [x] Compare page impression exports by period and correlate AI feature visibility with current Googlebot and snippet controls
  - [x] Compare Google Search/Discover impressions by exact matching country/device/date/page dimension cohorts, separately from page-only baselines
  - [x] Group matched Google report rows by current crawler and preview signals with overlapping, non-causal row-sum observations
  - [x] Join Google AI page impressions with observed answer citations by provider, bridge unique audited canonicals, sweep URL-family depths, and compare saved page/provider snapshots with coverage diagnostics
  - [x] Summarize local AI crawler access logs by provider, activity type, response status, path, and UTC day
  - [x] Aggregate ChatGPT and configurable exact AI-referral `utm_source` request tags into bounded path/status/UTC-day evidence
  - [x] Compare tagged-referral request/error rates and retained paths across saved log periods
  - [x] Correlate retained tagged-referral paths with current GEO audit controls, answer structures, and same-path search/training crawler log evidence
  - [x] Accept Cloudflare HTTP request JSONL field names and compare EdgeResponseStatus with OriginResponseStatus
  - [x] Parse header-driven AWS CloudFront standard access logs, including split UTC date/time and logged no-response status
  - [x] Summarize CloudFront edge and response-result classifications by AI crawler and path, compare period shares, and gate increases in logged error-class shares
  - [x] Summarize crawler response-duration and first-byte timing by crawler/path/day, compare comparable p95 bands, and gate timing regressions
  - [x] Compare exact-path HTTP response classes separately within recognized search and training-data crawler groups
  - [x] Rank crawler 4xx/5xx hotspots across all observed paths and report per-path failure share
  - [x] Summarize optional Cloudflare bot-score ranges, score sources, verified categories, and verified-evidence failures by path
  - [x] Summarize Cloudflare security actions and cross-reference logged block/challenge outcomes with failed crawler paths
  - [x] Compare saved crawler-log periods by token and retained path, including normalized response/failure shifts
  - [x] Add a CI gate for crawler-log failure regressions and incomplete retained-path comparisons
  - [x] Add a CI gate for tagged-referral failure regressions using raw rate counts and fail-closed incomplete comparisons
  - [x] Compare logged response media-type coverage across exact paths shared by crawler tokens
  - [x] Include redirect and other HTTP response classes in the per-crawler UTC daily trend
  - [x] Correlate observed crawler log paths with exact current GEO audit signals and snapshot timestamps
  - [x] Join observed crawler paths to measured answer structure, visible author/date markers, and citation/source evidence from the saved GEO audit
  - [x] Compare GEO audit paths with crawler-log coverage, preserving query ambiguity and log truncation states
  - [x] Summarize logged redirects and 4xx/5xx responses on paths matched to the saved GEO audit
  - [x] Report per-path crawl recency and audited-page coverage bands relative to each crawler's newest supplied-log event
  - [x] Replay observed crawler paths against a saved robots.txt snapshot, including paths outside the page audit
  - [x] Compare robots.txt snapshots on observed paths and provide a fail-on-newly-blocked-paths CI gate
  - [x] Replay every same-origin saved-audit URL, including query strings, against a local robots.txt snapshot
  - [x] Replay a bounded same-origin sitemap URL list against a local robots snapshot without auditing page content
  - [x] Compare robots policy snapshots across saved audit URL/token pairs and explain rule changes
  - [x] Add a fail-closed CI gate for newly blocked saved-audit URL/token pairs and incomplete comparisons
  - [x] Join Google Search and Bing page exports into a bounded URL matrix, with optional unique-canonical and current-control audit signals while keeping platform metrics separate
  - [x] Compare saved Google/Bing GEO matrices across periods with independent platform-specific metric and within-export share deltas
  - [x] Compare path-family GEO metric and share movement across saved matrices at matching URL-family depth
  - [x] Publish a versioned JSON Schema for the cross-platform GEO matrix export
  - [x] Render the cross-platform matrix as an offline searchable HTML review table
  - [x] Add a within-export Google/Bing share scatter plot, audit-control filters, share-gap threshold filters, and sortable page rows
  - [x] Export the bounded cross-platform GEO page matrix to spreadsheet-safe CSV with separate platform measures and audit fields
  - [x] Generate offline HTML reports for Google Search and Discover generative AI exports
  - [x] Correlate observed cited pages with current crawler, Bingbot, and snippet controls; resolve exact or unique canonical URLs
  - [x] Group matched Bing citation rows by current answer-content, author/date, and source-link observations
  - [x] Group Google generative-AI impression rows by current answer-content, author/date, and source-link observations
  - [x] Add compact page-content profiles to the Google/Bing cross-platform GEO matrix
  - [x] Group cross-platform export coverage by current audited document language with measured-profile and missing-tag counts
  - [x] Report each page's within-export Google impression and Bing citation shares, plus a bounded percentage-point distribution-gap review filter
  - [x] Quantify what portion of each platform's usable-URL metric is carried by URLs present in both export files
  - [x] Summarize weighted export overlap and the median absolute within-export page-share gap across the full URL join
  - [x] Compare exported GEO page groups with an explicitly supplied, bounded sitemap result, including exact aliases, possible capped aliases, per-platform metric shares, and list-membership filters
  - [x] Group Google/Bing page observations by configurable URL origin and leading path segments, with separate metrics and current audit-control counts
  - [x] Quantify the separate Google/Bing metric shares carried by currently audited crawler, indexing, snippet, and data-nosnippet control cohorts
  - [x] Validate `<html lang>` and `hreflang` values with BCP 47 locale canonicalization; check self-reference language/script alignment
  - [x] Add per-grounding-query current GEO audit coverage, Bingbot access, preview-control, answer-structure, and language review summaries
  - [x] Filter Bing query groups by observed crawler blocks, indexing/snippet restrictions, and audit coverage in the offline report
  - [x] Quantify per-grounding-phrase citation concentration across mapped URLs, expose citation-metric coverage, and summarize effective-page and largest-share medians
  - [x] Compare Bing query-page exports by exact normalized phrase and URL, retaining export-only states and comparable shared-pair citation changes
  - [x] Summarize Bing export views with top page/query/topic/intent rows and date-bucket changes without merging overlapping datasets
  - [x] Compare saved GEO audit snapshots for crawler, snippet, answer-content, source/rendered, citation-evidence, and optional-file changes
  - [x] Compare selected robots groups/rules and structured entity identity changes in GEO baselines
  - [x] Make GEO CI gate require comparable search-crawler and preview-control data on matched reports
  - [x] Aggregate answer-content profiles, exact restricted URLs, shared structured entity-ID name and type variants (bounded to 50 findings and 50 page observations per ID), differing complete sameAs link sets, and sameAs host coverage across pages
  - [x] GEO accuracy guide with explicit limits and first-party visibility measurement sources
  - [x] Add sitewide source/rendered phrase-overlap bands and visible/schema author/date presence cross-tabs
  - [x] Prioritize matched AI-crawler paths for GEO review using observed request volume and explicitly measured control, response, answer, and citation-evidence prompts
  - [x] Inventory literal JSON-LD `isAccessibleForFree` declarations, compare baseline changes, and correlate Applebot requests with Apple's paywall-to-AI-context behavior
  - [x] Label Applebot `nosnippet` as an AI-context control in observed crawler-log review prompts

- [x] **Heatmap & User Experience**
  - [x] Click heatmap generation — predictive, from static DOM position/element-type heuristics, not recorded user interactions
  - [x] Scroll depth tracking
  - [ ] Mouse movement tracking — not implemented
  - [x] Attention heatmap — static heuristic scoring (heading level, above-the-fold, element size), not time-based
  - [x] Visual hierarchy analysis
  - [x] Above-the-fold content detection
      
- [x] **Social Media Optimization**
  - [x] Twitter Card validation
  - [x] Facebook Open Graph validation
  - [x] LinkedIn meta tags
  - [x] Pinterest rich pins
  - [x] Social share preview generation
        
- [x] **Accessibility (A11y)**
  - [x] ARIA attributes validation
  - [x] Color contrast checking
  - [x] Keyboard navigation testing
  - [x] Screen reader compatibility
  - [x] WCAG compliance levels

## 🏗️ Architecture & Code Quality

- [x] **Testing**
  - [x] Unit tests for all checkers (Jest/Vitest)
  - [x] Integration tests
  - [x] E2E tests for the tool itself
  - [x] Test coverage > 80%
  - [x] Mock server setup for consistent testing
  - [x] Performance benchmarks

- [x] **Configuration**
  - [x] Configuration file support (JSON, YAML)
  - [x] Custom rule definitions
  - [x] Rule severity levels (error, warning, info)
  - [x] Rule enabling/disabling
  - [x] Preset configurations (basic, advanced, strict)

- [x] **Error Handling**
  - [x] Comprehensive error handling
  - [x] Retry mechanisms for network failures
  - [x] Graceful degradation
  - [x] Detailed error messages
  - [x] Error logging and reporting

- [ ] **Performance**
  - [x] Bounded parallel checking for multiple URLs via `auditUrls`
  - [x] Reuse one browser instance per batch worker
  - [x] AbortSignal cancellation for active and queued URL batch audits
- [x] Bounded sitemap and link-crawl response caches — watch mode revalidates stored bodies with ETag/Last-Modified and honors `Cache-Control: no-store`
  - [x] Resource pooling (browser instances across batch audits)
  - [x] Memory leak prevention — checker pages close in `finally`, batch browsers close in pool cleanup, and disconnected browser references are pruned on relaunch
  - [ ] Optimization for large-scale scanning

## 📊 Reporting & Output

- [x] **Report Formats**
  - [x] JSON output
  - [x] HTML report with charts
  - [x] Searchable multi-page HTML dashboard with filters, sorting, page findings, and baseline deltas
  - [x] JUnit XML export for CI dashboards
  - [x] SARIF 2.1.0 export for page and cross-page findings
  - [x] Markdown summary
  - [x] PDF report generation from the HTML report using Playwright Chromium
  - [x] CSV export for data analysis
  - [x] JSON schemas for single-page and batch audit reports, including failed URL results

- [x] **Visualization**
  - [x] Interactive dashboard — self-contained history view with URL search, health filters, and sorting
  - [x] Score trend charts by URL in the history HTML report
  - [x] Heatmap visualization overlay — rendered in the HTML report when screenshot data is available
  - [x] Before/after score and failed-check comparison against a JSON baseline
  - [x] Append-only JSONL audit history by URL

- [x] **Actionable Insights**
  - [x] Prioritized recommendations — severity-ordered, category-aware next steps in reports
  - [x] Fix suggestions with code examples — snippets provided for common missing titles, descriptions, canonical links, viewports, H1s, image alt text, form labels, accessible button names, favicons, language, and basic JSON-LD
  - [x] Impact scoring for each issue — reports show the estimated Aviary score lift if one failed check passes, not a ranking prediction
  - [x] Quick wins identification — clear missing metadata fields are tagged as quick wins
  - [x] Competitor comparison — compare matched-scope check findings and audit-score averages across supplied competitor reports

## 🔧 Developer Experience

- [x] **CLI Tool**
  - [x] Command-line interface
  - [x] `--version` output for installed package
  - [x] Read-only environment diagnostics for Node.js, Chromium, config, and CLI settings
  - [x] Bash, Zsh, and Fish completion output via `--completion`
  - [x] Interactive mode — launches the full-screen terminal UI when run without arguments
  - [x] URL-batch progress output
  - [x] CLI watch mode for development — repeat `--urls` batches with an idle interval and history output
  - [x] Line-separated URL list support (`--urls`)
  - [x] Bounded same-origin sitemap discovery, including nested and gzip-compressed sitemaps
  - [x] Bounded same-origin HTML link discovery for sites without a sitemap, with depth, per-page and aggregate byte, timeout, and concurrency caps
  - [x] Re-render single and batch report artifacts from saved JSON without rerunning audits
  - [x] Glob pattern support for multiple URLs — merge URL-list files matched by quoted `--urls` globs
  - [x] Bound URL-list input to 10,000 URLs and 25 MiB, including stdin
  - [x] CI/CD integration examples

- [x] **API**
  - [x] Periodic `watchUrls` API — non-overlapping audit batches, AbortSignal stop, and per-run callback
  - [x] REST API server — versioned asynchronous batch jobs with a bounded queue and polling endpoint
  - [x] Server-Sent Events progress stream for audit jobs
  - [ ] WebSocket for real-time updates — REST polling and SSE are implemented; WebSocket is not.
  - [x] API authentication — constant-time bearer key checks; TLS and a key for non-loopback binds
  - [x] Rate limiting — per-IP fixed window, request caps, and retry headers
  - [x] API documentation — OpenAPI 3.1 contract at `docs/openapi.yaml`
  - [x] Running-job cancellation through REST DELETE, with partial reports and SSE updates

- [x] **Documentation**
  - [x] Comprehensive README
  - [x] API reference — REST lifecycle, request fields, limits, SSE, and typed client in `docs/API.md`
  - [x] Configuration guide — JSON/YAML, presets, rule overrides, thresholds, and precedence in `examples/CONFIG.md`
  - [x] Best practices guide — scope, concurrency, CI baselines, configuration, and API operations in `docs/BEST_PRACTICES.md`
  - [x] Troubleshooting guide — browser setup, URL/sitemap inputs, reports, and API errors in `docs/TROUBLESHOOTING.md`
  - [x] Contributing guidelines
  - [x] Example use cases — release gates, bounded section crawls, focused accessibility scans, and recurring history in `examples/USE_CASES.md`
  - [ ] Video tutorials

- [ ] **IDE Integration**
  - [ ] VSCode extension
  - [ ] Inline warnings in editor
  - [ ] Quick fix actions

## 🚀 DevOps & Deployment

- [ ] **CI/CD**
  - [x] GitHub Actions audit workflow example
  - [x] Automated testing — unit, integration, and E2E jobs are defined in `.github/workflows/ci.yml`; latest status still needs an external CI run.
  - [x] Automated releases — tag-triggered workflow is defined in `.github/workflows/release.yml`; publishing credentials and latest workflow status still need external verification.
  - [x] Semantic versioning — release tags use `vMAJOR.MINOR.PATCH` and drive package versions.
  - [x] Changelog generation — release notes are generated from commits since the prior tag.

- [ ] **Package Distribution**
  - [x] NPM package publishing — root and all five platform packages are published; registry version and next-tag alignment are tracked in the publish handoff.
  - [x] Docker image publication — the tag-triggered release workflow builds and pushes versioned and `latest` GHCR images; as of 2026-10-01, GHCR `latest` still resolves to the `0.1.0` manifest while `0.1.1` has a different digest, so refresh and verify it on the next approved release.
  - [ ] Standalone binary (pkg/nexe)
  - [x] GitHub releases with artifacts — tag-triggered Rust binaries and changelog are configured in `release.yml`.

- [ ] **Monitoring & Telemetry**
  - [ ] Anonymous usage analytics (opt-in)
  - [ ] Error tracking (Sentry)
  - [ ] Performance monitoring
  - [ ] Feature usage statistics

## 🔒 Security & Privacy

- [ ] **Security Scanning**
  - [x] Dependency vulnerability scanning — full/production npm audits and `cargo audit` are clean with no current advisories or allowed Rust warnings. Security and tagged release gates fail on npm findings at moderate severity or higher and any Rust audit advisory.
  - [x] Security headers check — validates presence and basic HSTS, nosniff, frame-options, and CSP directive values
  - [ ] XSS vulnerability detection
  - [ ] CORS configuration check
  - [x] Basic Content Security Policy directive validation — syntax and framing protection are checked; this is not a full policy-security analysis.

- [ ] **Privacy**
  - [x] No outbound usage telemetry by default — report, URL, and error data are not uploaded to Aviary maintainers; see `docs/PRIVACY.md` for target-site requests and the opt-in semantic endpoint.
  - [ ] GDPR compliance
  - [ ] Cookie consent detection
  - [ ] Privacy policy detection

## 🌐 Multi-language & Internationalization

- [ ] **i18n Support**
  - [ ] Multi-language reports
  - [ ] Language-specific SEO rules
  - [x] Character encoding detection — checks declared charset and UTF-8 support.
  - [ ] RTL language support

## 🔌 Integrations

- [ ] **Third-party Tools**
  - [ ] Google Search Console API
  - [ ] Google Analytics integration
  - [ ] Ahrefs/SEMrush API integration
  - [ ] PageSpeed Insights API
  - [ ] Lighthouse integration

- [ ] **CMS Plugins**
  - [ ] WordPress plugin
  - [ ] Shopify app
  - [ ] Contentful integration
  - [ ] Netlify plugin

- [ ] **Version Control**
  - [ ] GitHub App
  - [ ] GitLab integration
  - [ ] Bitbucket integration
  - [ ] Pre-commit hooks

## 📱 Platform Support

- [ ] **Browser Support**
  - [ ] Firefox support
  - [ ] Safari support
  - [ ] Edge support
  - [ ] Mobile browser testing

- [ ] **Operating Systems**
  - [ ] Windows compatibility testing
  - [ ] macOS compatibility testing
  - [ ] Linux compatibility testing

## 📚 Community & Ecosystem

- [ ] **Community Building**
  - [ ] GitHub Discussions setup
  - [ ] Discord/Slack community
  - [x] Contributing guidelines — see `docs/CONTRIBUTING.md`.
  - [ ] Code of conduct
  - [ ] Issue templates
  - [ ] PR templates

- [ ] **Marketing**
  - [ ] Project website
  - [ ] Blog posts and tutorials
  - [ ] Social media presence
  - [ ] Demo videos
  - [ ] Case studies

## 🎓 Advanced Features

- [x] Bounded GEO source-network analysis: compare provider topology and edge transitions, and surface owned-citation gap bundles with uncertainty and explicit detail/work caps

- [ ] **AI/ML Integration**
  - [ ] Content quality scoring using NLP
  - [ ] Automated keyword suggestions
  - [ ] Competitor analysis using ML
  - [ ] Predictive SEO insights

- [ ] **Continuous Monitoring**
  - [ ] Scheduled scans
  - [ ] Alerting system
  - [x] Regression detection against a prior JSON audit report
  - [x] Performance tracking over time — per-URL score history with time-series charts
  - [ ] SEO ranking correlation

- [ ] **Multi-page Analysis**
  - [x] Sitemap-driven same-origin URL discovery with a bounded CLI page limit
  - [x] Bounded same-origin HTML link crawl for static pages without a sitemap
  - [ ] Full website crawling with JavaScript-rendered link discovery — keep it opt-in; preserve robots, same-origin and redirect restrictions, depth/URL/body/time/concurrency caps, cancellation, progress reporting, page and header `nofollow`, and provenance indicating whether each route came from static or rendered HTML. Bound or block subresource requests so rendered discovery cannot create unbounded network or memory use. Existing `--crawl` remains static-only.
  - [x] Site-wide report — batch formats include metadata/content, hreflang, and canonical findings; HTML, PDF, Markdown, and CSV include link-graph analysis
  - [x] Link graph analysis among completed pages in a batch
  - [x] Cross-page duplicate title and meta description detection
  - [x] CI gate for repeated metadata values in a batch
  - [x] Exact duplicate main-content detection and CI gate across batch pages
  - [x] Canonical chain/loop detection and CI gate across batch pages

## 🔄 Maintenance

- [ ] **Dependencies**
  - [ ] Regular dependency updates
  - [ ] Security patches
  - [ ] Playwright version compatibility
  - [ ] Node.js version compatibility

- [ ] **Deprecation Policy**
  - [ ] Version support policy
  - [ ] Migration guides
  - [ ] Backward compatibility guarantees

---

## Priority Levels

🔴 **High Priority** - Essential for a production release
🟡 **Medium Priority** - Important but can be added in v1.x
🟢 **Low Priority** - Nice to have, can be added in future versions

## Next Steps

The original bootstrap checklist above is largely complete; this section tracks the remaining project work and links to the release-specific gate.

1. Re-run full and production dependency audits immediately before release. Current results are clean and recorded in [`RELEASE_READINESS.md`](./RELEASE_READINESS.md).
2. The user selected and authorized `0.2.0`, which remains unused on npm for the root and all five platform packages. The mistaken `1.0.0` packages remain published because the available npm token cannot satisfy 2FA; see [`RELEASE_READINESS.md`](./RELEASE_READINESS.md). Verify each platform binary artifact and decide whether platform `beta` dist-tags should move from `0.1.0` to match the root's `0.1.1` beta tag.
3. Run the complete clean-checkout release verification after the release diff is frozen, including the test suite, package tarball import/CLI checks, and CI/security workflows.
4. Expand first-party GEO capture coverage with an explicitly maintained high-value route list for the homepage, product, pricing, and documentation sections. Keep matched host comparisons on the same route IDs, category scope, and capture settings.
5. Add a JavaScript-rendered discovery mode only when needed for sites whose navigation links are absent from initial HTML; keep its request, page, and byte budgets bounded like the existing static crawler.
6. Decide and document support/deprecation policy and community contribution policy before a major-version release.
7. After coverage passes and npm trusted publishing is configured, create the authorized `v0.2.0` tag and follow the release sequence in the publish handoff. Do not tag while the required coverage job is red.
