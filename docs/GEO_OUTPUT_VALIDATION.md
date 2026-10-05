# GEO output quality validation

Reviewed 2026-10-05 against official documentation from **Google, OpenAI, and
Microsoft Bing**. Engineering tests alone did not establish output quality.

Aviary can be used as a diagnostic and observation-analysis aid within its
reported scope. Its content and evidence profiles do **not** establish factual
accuracy, originality, source credibility, or whether linked sources support a
claim. Its scores do **not** predict indexing, ranking, AI-answer inclusion, or
future citations. No population accuracy percentage has been established.

## Comparison with three independent authorities

| Authority and primary source | What was compared | Assessment |
| --- | --- | --- |
| [Google: generative AI optimization](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) | Optional llms files, schema, answer formatting, JavaScript and eligibility claims | Missing AI-specific files or formatting must not fail a page. Source/render differences cannot establish crawler inability. Aviary preserves those distinctions. Search Console inclusion and actual index state remain unverified. |
| [OpenAI: crawler documentation](https://developers.openai.com/api/docs/bots) | Search, training and user-requested fetching | OAI-SearchBot and GPTBot controls are independent. Both allow-search/block-training and block-search/allow-training fixtures produce the correct separate decisions. ChatGPT-User is not used as an automatic search-indexing control. Robots permission alone does not verify firewall access or actual inclusion. |
| [Bing: AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/) | Citation counts, grounding queries and interpretation of observed visibility | Imported row sums describe the supplied export. They are not an authority score, answer rank, a complete universe of citations, or proof that content changes caused a citation. Missing export rows remain unknown rather than zero. |

These are independent operators, but their policies are not interchangeable.
Three sources do not corroborate every provider-specific rule. The comparison
uses the appropriate operator's documentation for each rule, including cases
where operators differ.

Additional rule-level sources were checked:

- [Google robots meta specification](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag): `none` means `noindex, nofollow`; `max-snippet:0` restricts text snippets. A parameter value must not be parsed as a separate rule.
- [Bing preview controls](https://blogs.bing.com/webmaster/2020/4/Announcing-new-options-for-webmasters-to-control-their-snippets-at-Bing/): `max-image-preview:none` suppresses image previews, without declaring `noindex`.
- [Bing data-nosnippet support](https://blogs.bing.com/webmaster/2025/10/Bing-Introduces-Support-for-the-data-nosnippet-HTML-Attribute/): Bing accepts any HTML element. Google's specification documents `span`, `div`, and `section`. Aviary's all-element counts inventory markup; they do not measure excluded AI-answer content.
- [Bing citation-share definition](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/): share is a percentage for a specific grounding query. Its range is 0–100. A cross-query mean of row percentages is not an overall citation share without all-site denominators.
- [Google Search AI performance report](https://support.google.com/webmasters/answer/16984139?hl=en): impressions, aggregation scopes, export limits and absent-page interpretation. Aviary keeps views separate and does not invent clicks or missing-period impression deltas.

## Actual output checks

The reproducible validator serves controlled pages and robots files over local
HTTP and runs the production GEO checker in Chromium. It also feeds known CSV
inputs through the production Google and Bing parsers. Expected interpretations
were written from the sources above, rather than copied from implementation.
It retains raw outputs beside individual expectations, source URLs and failures.

The unmodified `4f8a047` implementation passed **13 of 18** checks. The revised
implementation passes **18 of 18**. This is a bounded semantic regression
result, **not** an estimated accuracy rate on real websites or AI engines.

| Check | Original | Revised |
| --- | --- | --- |
| Clean page without llms files, schema or question headings | Pass | Pass |
| `none` does not separately declare `nosnippet` | Fail | Pass |
| `max-image-preview: none` does not declare `noindex` | Fail | Pass |
| Googlebot-scoped HTTP restrictions do not leak to OAI-SearchBot | Pass | Pass |
| `max-snippet: 0` declares a snippet restriction | Pass | Pass |
| GPTBot opt-out preserves OAI-SearchBot access | Pass | Pass |
| OAI-SearchBot opt-out preserves GPTBot access | Pass | Pass |
| Boolean data-nosnippet values and nested word counting | Pass | Pass |
| Different Google/Bing supported element types are explained | Fail | Pass |
| JavaScript-only content is not declared citation-ineligible | Pass | Pass |
| Unavailable robots policy does not invent confirmed bot blocks | Pass | Pass |
| HTTP 404 is exposed instead of reported as clean eligibility | Pass | Pass |
| Three authority links do not establish support for a false claim | Pass | Pass |
| Invalid 120% citation share stays unmeasured; valid counts survive | Fail | Pass |
| Mean row share is explicitly unweighted, not combined share | Fail | Pass |
| Bing missing-page metrics stay unknown | Pass | Pass |
| Google page export rows retain their aggregation scope | Pass | Pass |
| Google missing-page metrics stay unknown | Pass | Pass |

Three production errors were corrected: the two directive interpretation errors
and acceptance of out-of-range citation shares. Output explanations now expose
provider-specific element support and row-share averaging. Plain check messages
also state that structure counts and citation-shaped links do not verify content
quality or claim support.

The false-claim fixture is deliberate: it says the moon is made of cheese and
links to the three authorities. Aviary correctly counts three external source
links and declares that claim support was not checked. Its check score is 100.
A passing evidence
profile therefore cannot be presented as a factual-quality endorsement. Even
three reputable links can be irrelevant to the sentence they accompany.

Run from a built source checkout:

```sh
pnpm build:ts
node examples/geo-output-validation.mjs reports/geo-output-validation/after
```

CI runs this validation after building the integration-test checkout and saves
the raw outputs and assessment as an artifact, including when the check fails.
This protects the reviewed semantics against regression; source-policy changes
still require a fresh documentation review.

The local comparison retains `before/assessment.json`, `before/raw-outputs.json`,
`after/assessment.json`, and `after/raw-outputs.json` under
`reports/geo-output-validation/`. The baseline uses the unchanged production
modules from revision `4f8a047`; its reconstruction provenance is saved in
`baseline-source/provenance.json`. Generated reports stay ignored by Git.

## Limits of the evidence

This validation does not authenticate real provider crawls, inspect private
Search Console settings, or benchmark future citation behavior. The existing
synthetic review bundle demonstrates report behavior and layout; it is not
independent evidence of real-world effectiveness. No private first-party exports
or longitudinal live-provider capture panel were supplied for this review.

To establish operational output quality, retain real first-party exports and
repeated captures with fixed prompts, provider/model, locale, dates and complete
citation lists. Review claims against the actual cited passages, with at least
three relevant independent authorities when corroboration is appropriate.
Measure factual-support errors and citation outcomes separately from check scores.
Until that benchmark exists, cite this validation only for the specific controls
and export interpretations above.
