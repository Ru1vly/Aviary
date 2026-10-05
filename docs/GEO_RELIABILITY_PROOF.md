# What users can rely on in Aviary's GEO output

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

A comprehensive outcome-quality claim would require independently reviewed
pages across multiple domains plus repeated, controlled live AI-answer captures
or first-party exports. No such complete panel was supplied here. The three
[external audits](GEO_INDEPENDENT_BENCHMARK.md) do not substitute for it.

This correction is in the working source and subsequent unpublished candidate;
an already published package is not updated by these local changes. Build,
regression, packaging and consumer evidence are retained separately from the
output-quality evidence, so passing engineering tests does not become a claim
about actual AI outcomes.

The final corrected-source verification passes **1,510 tests in 91 files**,
with unchanged coverage gates: statements **90.88%**, branches **80.05%**,
functions **94.21%**, lines **92.20%**. The fresh candidate and its exact source
commit/checksum are recorded under
`reports/release-candidates/geo-reliability-proof/`. Installed-consumer validation
is saved under `reports/geo-proof-review/consumer/` when complete.
