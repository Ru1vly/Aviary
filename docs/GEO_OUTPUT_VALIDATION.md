# GEO output validation

Reviewed **2026-10-05**. The defensible use is **technical GEO diagnostics and
analysis of supplied observations**. This review does not establish Aviary as
a verifier of factual content quality or a predictor of AI citations.

## Proof from actual outputs

### Independently labelled HTTP/browser cases

`examples/geo-output-validation.mjs` serves known HTML, HTTP headers and robots
policies over loopback, runs the production GEO checker in Chromium, and checks
Google/Bing import results against hand-written expected interpretations.
It saves the raw outputs alongside expectations and source references.

The extended review has **24 cases**. The old implementation passed **19/24**;
the corrected implementation passes **24/24**. Five new cases reproduced an
extraction error before the correction. One initial expected inline-word count
was corrected from nine to eight after recounting the fixture; the old failure
was already its zero overlap, not that count. The retained baseline expectations
describe the same intended behavior.

The cases include:

- Search permission and training permission varied independently.
- Page-wide/scoped indexing and snippet restrictions, including `none` and
  `max-image-preview:none`, without leaking controls across crawler tokens.
- Unknown robots availability and HTTP 404, without inventing confirmed access.
- Missing optional llms files and markup, without inventing requirements.
- Adjacent blocks, inline split words, CSS block layout, line breaks, hidden and
  inert text, genuine client-added text, and removed text.
- Citation-shaped links beside an intentionally false claim, without claiming
  the links validate it.
- Out-of-range citation share and missing Google/Bing page rows, preserving
  unknown states and the meaning of the supplied exports.

Run after building:

```sh
node examples/geo-output-validation.mjs reports/geo-proof-review/after
```

The source references include [Google's AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide),
[OpenAI's crawler documentation](https://developers.openai.com/api/docs/bots),
and [Microsoft Bing's AI Performance documentation](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/).
Each policy is checked against its own operator. Text-extraction expectations
also reference the [HTML standard's distinction between rendered text and DOM text](https://html.spec.whatwg.org/multipage/dom.html#the-innertext-idl-attribute).

### Ten live pages, independently captured and parsed

All ten URLs from the [Silverback audit](https://geo.silverbackmarketing.com/audit/aviary-rs-com-20261005194319)
were audited with the corrected Aviary GEO preset. All ten completed; the
output contains **80 GEO check results**.

A separate Python program captured each raw HTTP response and parsed it with
the standard-library HTML parser, importing no Aviary code. **70/70 selected
field comparisons agree**, across:

1. HTTP status.
2. Document language.
3. Main-region presence.
4. Nested JSON-LD type inventory.
5. Main-content heading count.
6. Main-content external link count.
7. Literal page-wide meta noindex state on these clean pages.

This is ten pages on **one domain**, not seventy independent websites or a
population accuracy percentage. Raw heading/link counts do not independently
verify CSS visibility. These pages have no restrictive directives; the
controlled cases above cover restrictive and unavailable states.

Evidence is retained under `reports/geo-proof-review/`: `live-batch.json`,
`live-summary.json`, `live-http.json`, `page-00.html` through `page-09.html`,
`verify-live.py`, and `live-independent-assessment.json`.

### A reproduced defect and a verified correction

Before the correction, aviary-rs.com produced **55.4%** source/rendered phrase
overlap. Independent parsing showed all rendered text already present in the
response; adjacent text nodes had been concatenated differently from browser
`innerText`.

The correction uses the same semantic DOM boundaries on both sides, preserves
inline split words, and excludes hidden rendered text. A fresh live homepage
audit produces **100% normalized overlap**, **280/280 shared phrases**, and
**zero rendered-only phrases**. Both sides contain **284 normalized tokens**.
This is a different normalization from the earlier independent experiment that
inserted spaces at every text node (291 tokens); that experiment demonstrated
the artifact, but would incorrectly split some words with inline markup.

The output names the extraction method and its limits. Saved-report comparisons
with different extraction methods withhold word/overlap deltas and disclose the
method change. The method is also retained in sitewide JSON. Do not read this
before/after correction as evidence that the website improved its GEO performance.

CSS-only inline layout boundaries, visual reading order and generated content
are not compared. Initial source CSS visibility is unresolved. DOM/visibility
changes can still affect overlap; a low value is not proof of crawler incapacity.

## The counterexample that limits the trust claim

The controlled fixture saying **the moon is made of cheese**, with links to
Google, OpenAI and Bing, receives an Aviary check score of **100**. The evidence
profile counts three links and explicitly says source quality and claim support
were not verified.

Therefore 100 means the included checks passed; it cannot mean the page is
factually correct, its sources support its claims, or an AI system will cite it.
Users should rely on the concrete observations and their scope, and independently
review factual claims and cited passages.

## Decision for users

| Use                                                                                 | Evidence supports it?                                                                                    |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Inspect documented robots policy and separate search/training controls              | Yes, within the named policies and tested cases; robots permission is not authenticated provider access. |
| Inspect observed HTTP/indexing/snippet controls and content/schema/link inventories | Yes, within recorded snapshots and stated extraction limits.                                             |
| Analyze supplied Google/Bing exports with missing metrics kept unknown              | Yes for reviewed parser semantics; export coverage and aggregation still apply.                          |
| Treat an Aviary score as factual quality, source credibility or GEO success         | No. The false-claim counterexample disproves that interpretation.                                        |
| Predict citations, rankings, indexing or the lift from suggested edits              | No predictive benchmark was established.                                                                 |
| Claim a general accuracy rate from these results                                    | No. This is a bounded set of cases and one live domain.                                                  |

## Independent audits of aviary-rs.com

Three completed external audits were captured on 2026-10-05:

| Service | Scope and result | What the comparison establishes |
| --- | --- | --- |
| [GigAI](https://gigai.tools/geo-audit?url=https%3A%2F%2Faviary-rs.com%2F) | Homepage; 79/100, grade B | Agrees on permissive robots, four top-level JSON-LD items, no question headings and three external links. |
| [Silverback](https://geo.silverbackmarketing.com/audit/aviary-rs-com-20261005194319) | Ten pages; 65/100, homepage citability 33 | Same six nested schema types and three external homepage links. Its author flag refers to author metadata, while Aviary reports visible/schema authors separately. |
| [Pyralis](https://pyralislabs.io/geo-audit?run=1&url=https%3A%2F%2Faviary-rs.com%2F) | Homepage; zero fixes/improvements, four GEO checks passed | Agrees on readable initial HTML, permissive crawler rules and optional missing llms files. |

Aviary's homepage GEO checks all pass. These grades use different rules and
cannot be averaged into an accuracy measure. GigAI and Pyralis links rerun an
audit; Silverback retains a dated report. Saved captures retain the original
results. The three external links are repository/support links on GitHub, not
three independently verified sources supporting page claims.

GigAI penalizes question headings/chunking; Silverback heavily penalizes missing
llms files and offers a score bonus for its own readiness kit. Those scores do
not measure actual AI citations. Silverback labels GPTBot as ChatGPT access and
omits OAI-SearchBot; OpenAI documents search and training controls separately.
Pyralis's user-agent probes returned equal 308 redirects at the non-www URL,
which does not establish final-page access from authenticated vendor IPs.

## Primary sources and interpretation

1. [Google AI optimization](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): no special llms file, chunking or schema requirement for Google Search. Unblocked JavaScript can be processed; eligibility does not guarantee serving.
2. [OpenAI bots](https://developers.openai.com/api/docs/bots): OAI-SearchBot governs search and GPTBot training independently. ChatGPT-User is a separate user-triggered fetcher.
3. [Bing AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/): observed citation counts describe visibility in the supplied data, not authority, answer ranking or causal lift.

Rule-level sources include [Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag),
[Bing preview controls](https://blogs.bing.com/webmaster/2020/4/Announcing-new-options-for-webmasters-to-control-their-snippets-at-Bing/),
[Bing data-nosnippet support](https://blogs.bing.com/webmaster/2025/10/Bing-Introduces-Support-for-the-data-nosnippet-HTML-Attribute/),
[Bing citation-share definitions](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/),
and [Google's AI performance report](https://support.google.com/webmasters/answer/16984139?hl=en).
`none` means noindex/nofollow rather than a separate nosnippet declaration;
`max-image-preview:none` is an image-preview value. Bing accepts data-nosnippet
on any element; Google's documented support is span/div/section. Citation
share stays within 0–100; an unweighted mean of query-row shares is not combined
share. Missing export rows remain unknown.

Each operator is authoritative for its own policies. Three sources do not
corroborate every provider-specific rule.

## Reproduce and retain evidence

```sh
pnpm run build:ts
node examples/geo-output-validation.mjs reports/geo-output-validation
node dist/cli.js -u https://aviary-rs.com/ --preset geo --json --output reports/live-geo.json
```

The validator is also shipped with the npm package. CI builds before running it
and retains raw output and assessment artifacts, including failures. Historical
baseline results were 13/18 before directive/share corrections and 19/24 before
the text extraction correction. The final corrected results are 24/24.

Dated local evidence remains under `reports/independent-geo-aviary-rs/` (three
external reports, screenshots, response captures and hashes) and
`reports/geo-proof-review/` (before/after/consumer cases, ten-page outputs,
independent parser, raw pages and SHA-256 manifest). These generated captures
are ignored by Git; live report links cannot recreate every historical byte.
Pyralis's JSON download timed out, so its completed visible report was retained.

The corrected-source engineering run passed 1,510 tests in 91 files, with
coverage S90.88%, B80.05%, F94.21%, L92.20%. Engineering coverage is separate
from output validation. Publication and fresh package verification are recorded
by the [release workflow](RELEASING.md).

A broader outcome-quality claim needs independently reviewed pages across
multiple domains plus repeated controlled AI-answer captures or first-party
exports. That benchmark was not established here. Review factual claims against
the actual cited passages; do not use check scores as proof of claim support,
source credibility, indexing or future citations.
