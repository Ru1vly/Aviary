# Independent GEO audit comparison: aviary-rs.com

Audited **2026-10-05**, approximately **19:39–19:48 UTC**. Three public services
were actually run against `https://aviary-rs.com/`; this was not a comparison of
their marketing pages. Aviary was run from revision
`bd9e707d5ceb77bdec9373c1c00af01056c3da1d` using the GEO preset.

**Assessment:** Aviary's basic observations agree with independent tools on this
page. Its 100 score does not establish content quality or AI visibility. This
benchmark also reproduces an extraction artifact in its source/rendered profile.
The external services are comparison instruments, not ground truth: their
content scores have not been independently calibrated against citation outcomes.

## Actual reports and scope

| Tool                                                                                        | Observed result                                     | Scope and meaning                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [GigAI report](https://gigai.tools/geo-audit?url=https%3A%2F%2Faviary-rs.com%2F)            | **79/100, B**; 8 passed, 2 warnings, 2 failed       | One homepage; access, markup, rendering markers and content heuristics. The link can rerun the audit; saved captures preserve this observation.                                                        |
| [Silverback report](https://geo.silverbackmarketing.com/audit/aviary-rs-com-20261005194319) | **65/100**, Promising                               | Ten sampled pages, with a homepage citability score of 33. Includes a 20-point bonus for its own optional AI readiness file set. Its site score is not directly comparable to Aviary's homepage score. |
| [Pyralis report](https://pyralislabs.io/geo-audit?run=1&url=https%3A%2F%2Faviary-rs.com%2F) | **0 fixes, 0 improvements**; 4 AI/GEO checks passed | One homepage; evidence-based diagnostics with no numeric quality score. This link also reruns the audit.                                                                                               |
| Aviary                                                                                      | **100**, 8 of 8 GEO checks passed                   | One browser-rendered homepage. All eight results have informational severity; successful inventories must not be read as endorsements of content quality.                                              |

The input redirects permanently to `https://www.aviary-rs.com/`, returning HTTP 200. Independent raw HTTP capture and Pyralis both identify this redirect.
No accounts or paid audits were used. GeoLens was skipped at its account gate.

## Compare observations before scores

| Observation                             | Aviary                                        | Independent result                                                                                                                    | Adjudication                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search crawler robots permission        | Eight checked tokens allowed                  | GigAI permits its seven selected tokens; Pyralis permits all its listed tokens; Silverback reports five crawler-like requests allowed | Captured robots.txt is 71 bytes: wildcard agent, `Allow: /`, sitemap. Common crawler decisions agree. Inventories contain different tokens and purposes.                          |
| Page-wide indexing/snippet restrictions | None observed; HTTP 200                       | Pyralis reports no indexability issues; Silverback homepage `noindex: false`                                                          | Raw response/HTML and rendered metadata show no relevant restriction. This is not actual index verification.                                                                      |
| Structured data                         | Six types including nested Offer and ListItem | Silverback reports the same six; GigAI and Pyralis show four top-level items                                                          | Same markup, different counting depth. Organization, WebSite, SoftwareApplication and BreadcrumbList are present. Presence is not rich-result eligibility or citation prediction. |
| Question headings                       | 0 of 11 total headings                        | GigAI 0 of 10 H2/H3; Silverback 0                                                                                                     | Counts agree after excluding H1. Whether headings must be questions is a separate, unsupported universal requirement.                                                             |
| External main-content links             | 3, all on github.com                          | GigAI and Silverback also count 3                                                                                                     | Actual destinations: repository, same repository again, and sponsor profile. They are navigation/support links, not three independent references supporting factual claims.       |
| Author/date                             | No visible author/date or schema author/date  | Silverback says `has_author: true`; Pyralis no publish/update date                                                                    | HTML contains `meta name="author" content="Aviary Contributors"`. This is compatible with no visible byline: the tools use different author definitions.                          |
| Optional llms.txt                       | HTTP 404; informational                       | Pyralis agrees optional; Silverback labels missing file High                                                                          | Missing-file observation agrees. Severity and claimed benefit differ. Google's official guidance supports the optional treatment for Google Search.                               |
| Homepage text length                    | 291 rendered tokens; 255 source tokens        | GigAI 236, Silverback 238, Pyralis 232 source words                                                                                   | Tokenization, excluded regions and markup boundaries differ. Do not interpret the counts as evidence of missing content or rank quality.                                          |

## A concrete Aviary output weakness

Aviary reports **55.4%** rendered five-word phrase overlap with initial HTML:
159 shared phrases out of 287, with 128 rendered-only phrases.

Independent parsing of the saved raw response exactly reproduces those numbers.
Its source extraction concatenates adjacent text nodes, producing strings such
as `sitethe` and `242checks29categories1real browser`. Browser `innerText`
introduces separators between those regions.

Joining the same source text nodes with separators yields **291 tokens** and
**287/287 shared phrases: 100% overlap**, with zero rendered-only phrases.
The browser text and raw HTML were captured independently of the GEO checker.
On this page the apparent gap is fully explained by extraction boundaries, not
content being added by JavaScript. Aviary mentions normalization as a limitation,
but the leading percentage is still easy to misinterpret.

This is an actionable measurement limitation, not a runtime correction in this
research change. A production fix needs consistent extraction on both sides,
with regression cases for adjacent blocks, inline split words, hidden content,
and genuinely added client content. Simply inserting spaces everywhere may
mis-handle words split across inline markup.

**Follow-up:** the subsequent [reliability review](GEO_RELIABILITY_PROOF.md)
corrects this extraction mismatch, verifies five previously failing cases and
reruns the live homepage. It also prevents saved-report text deltas across
different extraction methods. The original observations above are preserved as
the dated baseline, not the status of the corrected implementation.

Evidence: `reports/independent-geo-aviary-rs/parity-adjudication.json`,
`homepage.html`, `rendered-evidence.json`, and the original `aviary.json`.

## Why the competing grades are not ground truth

- GigAI marks question headings and retrieval chunks as failures, despite
  separately reporting nine of nine sections as self-contained. These are
  different heuristics; they do not demonstrate a real engine's retrieval
  behavior. Its 100/100 source-citation score also treats the three GitHub links
  as citations without establishing claim support.
- GigAI warns about a Next.js flight-data marker while confirming readable
  initial HTML. A framework marker alone does not prove inaccessible content.
  Our normalized source comparison finds the full rendered text in the response.
- Silverback's executive summary advises removing access blockers, although
  its crawler table reports all five permitted and its findings identify no
  access blocker. Its strong schema result is also inconsistent with presenting
  structured data as a principal deficiency without a concrete missing property.
- Silverback promotes a fifteen-file kit with a stated 20-point score bonus.
  That validates conformance to its rubric, not a 20-point gain in measured AI
  visibility. The report supplies no live prompt/citation observations for its
  individual platform readiness scores.
- Pyralis avoids an invented score and distinguishes optional conventions. Its
  no-fixes result still covers only its checks; it does not verify the accuracy
  of Aviary's product claims or actual citation performance.

## Three primary authorities used to judge disagreements

1. [Google's official generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): special AI files, specific rewriting/chunking and special schema are not required for Google Search. Google can process unblocked JavaScript. Useful content and foundational SEO matter; eligibility does not guarantee serving. This supports treating the competing penalties as heuristics rather than universal requirements.
2. [OpenAI's crawler documentation](https://developers.openai.com/api/docs/bots): OAI-SearchBot controls search and GPTBot controls training independently. Silverback labels GPTBot as ChatGPT access and omits OAI-SearchBot from its crawler table; that table cannot verify the documented search control. ChatGPT-User is a separate user-triggered fetcher.
3. [Microsoft Bing's AI Performance documentation](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/): actual citation counts and page activity are observed outputs, distinct from authority, ranking and placement. No such first-party export was available in this comparison.

These authorities support their own services' documented behavior. They are not
three-way corroboration of every crawler policy or every content recommendation.

Pyralis's optional live probe returned **308 for the browser and all eight tested
user-agent strings** on the submitted non-www URL. This only demonstrates equal
redirect responses at that endpoint; it does not verify final-page access from
real vendor IP addresses. Aviary's robots-only limitation remains appropriate.

## Retained evidence and reproduction

Local captures under `reports/independent-geo-aviary-rs/` include:

- Aviary JSON, Markdown, HTML and execution log.
- GigAI and Pyralis rendered report text and screenshots; Silverback downloaded
  JSON, rendered report text and screenshot.
- Raw homepage, robots and llms responses, status/headers/final URLs and hashes.
- Browser homepage text, headings, links, metadata and JSON-LD.
- Independent parity analysis, captured comparison metadata and artifact hashes.

Pyralis's JSON export did not produce a browser download within 20 seconds;
the visible completed report and probe were preserved instead. A synthesized
observation file is explicitly labelled and is not a native export.

The generated captures remain ignored by Git. The report links and this document
are retained; local snapshots are needed to reproduce the exact dated findings.

```sh
node dist/cli.js -u https://aviary-rs.com/ --preset geo \
  --wait-until domcontentloaded --settle-ms 1000 --json \
  --output reports/independent-geo-aviary-rs/aviary.json \
  --markdown reports/independent-geo-aviary-rs/aviary.md \
  --html reports/independent-geo-aviary-rs/aviary.html
```

## Trust assessment

This single-domain comparison supports the specific access, markup and optional
file observations above. It does **not** establish a population accuracy rate,
factual content quality, or predictive validity for AI citations. Aviary's source
comparison needs normalization work; its 100 score needs to remain clearly
separated from quality claims. A broader quality benchmark needs independently
reviewed real pages plus repeated prompt/citation observations or first-party
exports. The independent services do not replace that evidence.
