# Accuracy and scope

Aviary reports observed browser/HTTP signals and analyzes data supplied by the
operator. A score summarizes the enabled checks. It does not establish search
rankings, factual quality, legal compliance or AI citation probability. No
population accuracy rate has been measured; earlier percentage estimates were
unsupported and have been removed.

## What requires interpretation

| Measurement | Practical limit |
| --- | --- |
| Metadata, headings, links and JSON-LD | Presence and structure do not prove meaning, factual correctness, rich-result eligibility or indexing. Nested schema types and top-level items are different counts. |
| Readability, spam and content heuristics | Language, page purpose, legitimate repetition and hidden interface content can affect findings. Inspect the actual page before changing it. |
| Accessibility markers | Automated checks cover selected signals; use keyboard, assistive technology and human review for conformance. |
| Performance and web-vitals | One browser run is lab data. Network, hardware, viewport and waiting strategy affect results; field INP and population experience are not established. |
| Heatmap/click/scroll predictions | Heuristic models rather than eye-tracking, user sessions or measured conversions. |
| Crawler policies | A matching robots rule describes documented permission. It does not authenticate a request or prove that a vendor fetched or indexed the page. |
| Source/rendered overlap | Uses shared semantic DOM boundaries. CSS-only inline layout, generated content, reading order and initial-source CSS visibility are unresolved. Low overlap does not prove crawler incapacity; comparisons across extraction methods omit text deltas. |
| Citation-shaped links | Counts links; does not check whether sources are credible or support nearby claims. A false-claim fixture can score 100. |
| Supplied answer citations and provider exports | Describe the captured sample and export scope. Missing rows, incomplete citation lists and capped detail remain unknown; they do not become zero outcomes. |
| Statistical intervals and gates | Describe supplied observations under stated assumptions. Prompt correlation and changes in prompt/model/locale/cohort mix limit generalization and causal interpretation. |

The [GEO validation guide](GEO_OUTPUT_VALIDATION.md) records 24 controlled output
cases, three external audit comparisons, 70 selected field comparisons on ten
pages of one domain, sources and reproduction. Those results support the named
observations, not a general accuracy percentage.

## Capture and discovery boundaries

- Chromium needs working browser binaries and system libraries. JavaScript,
  consent screens, authentication and delayed content can change the snapshot.
  Reports retain the navigation wait event and settle delay.
- Static `--crawl` discovery reads HTML anchors and follows robots rules for
  AviaryBot. It can miss client-only routes. Use a reviewed URL list or sitemap
  when completeness matters. Discovery caches do not cache browser audit results.
- Sitewide content/link analysis describes the supplied batch; it cannot infer
  pages outside that scope. Canonical ambiguity and missing comparisons must
  remain explicit.
- Log user-agent names are claims rather than authenticated identities. Explicit
  verification annotations are separate evidence. AI referral tags count request
  rows, not users, sessions, citations or conversions.
- Google/Bing metrics retain export aggregation, date windows and missing states.
  Citation-list position is captured array order, not a search ranking.

## Runtime boundaries

The Rust static engine does not execute page JavaScript. Its semantic analyzer
supports `stub` and `ollama`; other `AVIARY_LLM_PROVIDER` values currently select
the stub, and `AVIARY_LLM_API_KEY` is reserved. The browser path uses Playwright.
The CLI metrics endpoint binds to loopback; the REST server's outbound-network
boundary is described in [API](API.md) and [privacy](PRIVACY.md).

Aviary imports supported exports; it does not provide a direct Search Console
API integration or run Lighthouse. See [troubleshooting](TROUBLESHOOTING.md)
for browser, discovery, export and API failures.

## Verify a finding

Retain the version, command/config, snapshot timing and raw report. Check the
observed HTML/headers or supplied source rows, then compare the finding with the
relevant operator's documentation. For claimed improvements, compare like-for-like
captures and outcomes separately from check scores. Report reproducible errors
with sanitized input and expected behavior through [GitHub issues](https://github.com/Ru1vly/Aviary/issues).
