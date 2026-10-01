# Aviary Audit Best Practices

## Choose a useful audit scope

- Start with a representative set of important pages: the home page, main landing pages, key templates, and conversion paths.
- Use `--sitemap` for the broadest declared page list. Sitemap and link-crawl jobs filter pages through `robots.txt` rules for AviaryBot. If a sitemap is unavailable, use `--crawl` for bounded static same-origin link discovery; JavaScript routes remain outside that mode. Set `--max-urls` to a size that fits the machine and review one large site section at a time.
- Include each localized page when checking hreflang reciprocity. Batch reports can verify return links only when both alternate pages completed in the same batch; alternate targets outside the scan remain unverified.
- Use valid BCP 47 tags for `<html lang>` and `hreflang`. Aviary uses the runtime locale canonicalizer, accepts script subtags such as `zh-Hant`, and flags a self-reference whose primary language or explicitly declared script conflicts with the page's `lang`. Region-only differences and the actual prose language are not compared.
- Use `--category` to keep quick checks focused, then run a broader audit before release.
- Keep URLs in the same order for repeatable reports and baseline comparison. Avoid including fragments because they do not identify distinct pages.

## Tune browser concurrency

Batch audits reuse a browser per worker. Start at the default concurrency of 2, then raise it only when both the runner and target site can handle the extra browser load. If timeouts or resource pressure increase, lower concurrency before increasing timeout values.

Sitemap retrieval has a separate bounded concurrency of four, with a maximum of eight. It uses timeouts, same-origin filtering, and document-size limits before browser audits begin.

Link discovery uses the configured concurrency, follows only same-origin redirects, and caps both per-page and aggregate HTML response sizes. Its default total discovery-body limit is 100 MiB; set `--max-crawl-page-bytes`/`maxPageBytes` for larger pages or `--max-crawl-bytes`/`maxTotalBytes` when a larger scan needs more. Its default depth is two link hops; raise `--max-depth` when deeper navigation matters, and keep `--max-urls` explicit for larger sites.

## Make CI results actionable

Save the JSON batch report as the baseline artifact. Compare later scans with `--baseline` and `--fail-on-regression` so the job fails on score drops or new failed checks. Add `--category geo --fail-on-geo-change` when changes in crawler access and robots rule selection, snippet restrictions, answer-content structure, JSON-LD types and identity entities, source/rendered overlap, citation-evidence counts, or optional `llms.txt` availability should be reviewed before deployment. GEO changes remain informational by default; the gate is explicit because policy and content changes can be intentional, and it fails closed when matched pages lack comparable crawler-access or preview-control data. Use `--fail-on-findings` for projects that want every failed checker result to block a build, `--fail-on-duplicate-metadata` to gate repeated page titles or descriptions, `--fail-on-duplicate-content` to gate exact repeated main content, `--fail-on-hreflang` to gate missing reciprocal links between scanned language variants, and `--fail-on-canonical-chains` to catch canonical chains, loops, multiple declarations, or invalid URLs. The content, hreflang, and canonical gates fail closed when their required result data is unavailable. Hreflang and canonical targets outside the batch remain unverified, so include relevant language variants and canonical targets in the same audit scope. Shared canonical targets are reported for review but are not automatically a failure because they can be intentional.

Keep current JSON, JUnit, SARIF, Markdown, and HTML outputs as CI artifacts. SARIF carries failed checks and batch findings for code-scanning tools. JSON supports later re-rendering with `--render` without spending time on another browser audit. Advance the baseline only after a successful run so a temporary outage or failed audit does not become the new reference.

For long-running monitoring, `--watch` avoids overlapping batches. Sitemap and link-crawl watch modes rediscover URLs each cycle and revalidate discovery responses with a bounded validator cache. Append `--history` records and render the timeline separately with `--history-report`. Completed JSONL records keep `navigationWaitUntil` and `settleAfterNavigationMs`; use matched timing settings when comparing runs.

## Keep configuration maintainable

Use a preset as a starting point, then override only the rules that differ for the project. Store shared JSON or YAML settings in version control. Keep environment-specific URLs, keys, and output paths in environment variables or CI secrets instead of committing them.

Run a focused `--category` scan while adjusting a rule. Review the report's check `name` and details before changing a threshold; thresholds affect Aviary's own heuristics, not a search engine's ranking formula.

## Operate the REST API carefully

- Keep the listener on loopback for local use.
- For remote access, require both a long random API key and TLS.
- Give API access only to trusted operators. Audit URLs are opened by a browser on the API host and can reach its private network; use outbound network rules when clients are not fully trusted. Private-site audits are supported.
- Set the maximum batch size, job concurrency, pending queue, and rate limit to match available resources.
- Stop programmatic servers with `stopAviaryApiServer()` so queued jobs, active browser pages, and event streams are closed together.
- Store job reports outside the API if they must survive process restarts; the built-in store is in-memory and expires terminal jobs.
- Treat submitted URLs as browser navigation. Do not expose an unauthenticated listener to untrusted clients.

## Interpret reports responsibly

Read failed-check details alongside the page, templates, and intended behavior before applying a fix. Predicted heatmaps are static DOM heuristics; Core Web Vitals are lab measurements from a single browser run. They are not substitutes for field data or rankings. See [`ACCURACY_LIMITATIONS.md`](./ACCURACY_LIMITATIONS.md) for more context.

For observed Google AI visibility, export the Search Console Search Generative AI report and analyze it with `--google-ai-csv`; use `--google-ai-discover-csv` for the separate Discover report. Keep page, country, device, and date exports separate: Google's Search report uses page-level page rows and property-level other dimensions, while Discover has page, country, and date views with canonical page URLs. The reports measure impressions, not clicks or queries. When correlating page rows with Aviary, remember the audit controls are a current snapshot and may postdate the impressions. See Google's [Search](https://support.google.com/webmasters/answer/16984139?hl=en) and [Discover](https://support.google.com/webmasters/answer/16983858?hl=en) report documentation.

For period comparisons, use two page-dimension exports with `--google-ai-baseline-csv previous.csv --google-ai-csv current.csv`. Keep the Search Console property and filters consistent and change only the date range. The reports cap page tables at 1,000 rows; Aviary calculates deltas only for URLs present in both files and marks one-file URLs as export-only with unknown missing-period impressions. Treat matched-page changes as reported impression differences, not proof that SEO edits or crawler rules caused them.

If a Search or Discover report has no impressions, inspect the property's [Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en) in Search Console. Aviary's public page audit cannot inspect that authenticated property setting or determine whether low impressions reflect an eligibility choice, demand, or reporting thresholds.
