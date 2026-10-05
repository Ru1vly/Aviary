# CLI reference

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
| `--geo-answer-prompt-sampling-plan-json` | | string (path) | Save typed plan rows, target status, and per-provider-pair capture budgets; see the [published schema](geo-answer-prompt-sampling-plan.schema.json) |
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
| `--geo-answer-prompt-plan-cohort-targets` | | string (path) | Raise selected topic/intent quota floors and/or cap per-cohort paired groups from a versioned [JSON target file](geo-answer-prompt-plan-cohort-targets.schema.json) |
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
| `--comparison-output` | | string (path) | Save baseline deltas, including structured GEO changes, as a separate JSON artifact; requires a baseline. See the [comparison JSON Schema](geo-report-comparison.schema.json) and [single-page](../examples/geo-report-comparison.single-page.example.json) / [batch](../examples/geo-report-comparison.batch.example.json) examples |
| `--geo-comparison-csv` | | string (path) | Save per-page baseline GEO signal changes and comparison coverage as CSV; requires a baseline |
| `--geo-gate-output` | | string (path) | With `--fail-on-geo-change`, save the versioned gate decision, single-page or batch scope, normalized filters, failure codes, coverage counts, and matching changes as JSON; see the [gate schema](geo-change-gate.schema.json), [single-page example](../examples/geo-change-gate.example.json), and [batch example](../examples/geo-change-gate.batch.example.json) |
| `--geo-crawler-path-family-failure-gate-json` | | string (path) | With `--fail-on-geo-crawler-path-family-failure-rise`, save matched-family support, truncation, and failure-rise details as versioned JSON; see the [schema](geo-crawler-path-family-failure-gate.schema.json) and [example](../examples/geo-crawler-path-family-failure-gate.example.json) |
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
| `--help` | `-h` | boolean | Print the CLI usage and available options |
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

Batch GEO summaries can be saved as machine-readable JSON alongside the full audit report. The `schemaVersion: 1` summary includes its source audit timestamp, sitewide crawler access, snippet controls, answer-content and source/rendered profiles, citation evidence with bounded source-domain link distributions, entity identity, source hosts, and optional `llms.txt` coverage. Its compact per-page matrix exposes the same observed signals for each audited URL, omits page prose, and does not define a GEO score. Per-page structured identity inventories show schema types, IDs, names, and `sameAs` URLs, with explicit indicators when their 20-entity or 10-link limits are reached. The summary lists shared identity IDs whose normalized @type sets differ and whose complete `sameAs` link sets differ across pages for consistency review; capped entity/link inventories are excluded from sameAs comparisons. Validate the summary with the [GEO summary JSON Schema](geo-summary.schema.json). In watch mode, the file contains the latest completed batch.

```sh
aviary --sitemap https://example.com/sitemap.xml --category geo --geo-summary-output reports/geo-summary.json --geo-summary-csv reports/geo-pages.csv --geo-entity-variants-csv reports/geo-entity-variants.csv --geo-crawler-access-csv reports/geo-crawler-access.csv --output reports/audit.json
```

`--sitemap <url>` recursively reads same-origin sitemap indexes, including gzip-compressed sitemap files, filters page URLs through the origin's `robots.txt` policy, and audits up to `--max-urls` allowed pages (default 1,000). External page URLs and sitemap indexes are skipped. Sitemap documents are limited to 5 MiB both before and after decompression. Discovery progress is written to stderr so JSON stdout stays clean.

The programmatic `discoverSitemapUrls(url, options)` API accepts `onDocument` for progress updates and an optional `SitemapDiscoveryCache` for conditional requests across repeated scans. Use `filterUrlsByRobotsTxt(urls, siteUrl)` to apply the same policy before auditing those URLs yourself.

`--crawl <url>` discovers pages by following links from fetched same-origin HTML when a sitemap is unavailable. It returns the start URL plus pages found within `--max-depth` (default 2, max 32), capped by `--max-urls` (default 1,000, max 10,000). Discovery concurrency follows `--concurrency`; each page request has a 30-second timeout and 2 MiB HTML-body cap (`--max-crawl-page-bytes` can raise it to 10 MiB), with a combined 100 MiB body cap (`--max-crawl-bytes` can raise it to 1 GiB), plus a 10,000-link capture cap. It follows same-origin anchor and image-map area links and skips off-origin links and redirects. Discovery and browser audits use AviaryBot's user agent and honor `nofollow` directives and `robots.txt` rules; JavaScript is not executed. See the [crawling guide](CRAWLING.md) for details and the `discoverLinkedUrls()` library API.

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

## Configuration files

See [configuration examples](../examples/CONFIG.md) for presets, thresholds and YAML/JSON configuration. For complete GEO workflows, use the [GEO guide](GEO.md).
