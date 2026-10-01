# Practical use cases

These examples assume a checkout of Aviary at the repository root. Install dependencies and Chromium with `pnpm install --frozen-lockfile` and `pnpm exec playwright install chromium`, then build with `pnpm run build`. Commands write reports under `reports/` unless a different path is supplied.

For the published package, the `aviary` command provides page audits and crawl workflows. The `pnpm run geo:*` commands below invoke bundled analysis scripts, not CLI flags. Run those scripts from the repository checkout, or invoke them from an npm install with `npm explore @ru1vly/aviary -- npm run <script> -- ...`; use absolute paths for inputs and outputs in that case. See the [GEO guide](../docs/GEO.md) for assumptions and interpretation limits.

## Audit a page and share the findings

Create machine-readable results and a readable report in one run:

```sh
node dist/cli.js -u https://example.com \
  --preset geo \
  --output reports/example-audit.json \
  --html reports/example-audit.html \
  --markdown reports/example-audit.md
```

The report records observed page signals. Its check score summarizes only the configured checks; it does not predict search or AI-answer visibility.

## Audit a section or site

Prefer a sitemap when the site has one. Aviary follows same-origin sitemap indexes and caps the number of audited URLs:

```sh
node dist/cli.js --sitemap https://example.com/sitemap.xml \
  --max-urls 500 \
  --concurrency 4 \
  --category geo \
  --output reports/site-audit.json \
  --html reports/site-audit.html
```

When there is no useful sitemap, discover pages from ordinary same-origin links:

```sh
node dist/cli.js --crawl https://example.com/ \
  --max-depth 3 \
  --max-urls 250 \
  --output reports/static-crawl.json
```

This link crawl is static. It does not discover links added only by client-side JavaScript. Use an explicit URL list for important routes that the sitemap or static crawl misses.

## Gate changes in CI

Save the current batch as JSON, then compare it with a prior report on the next run:

```sh
node dist/cli.js --urls urls.txt \
  --output reports/current.json \
  --baseline reports/baseline.json \
  --category geo \
  --fail-on-geo-change
```

For general check regressions, use `--fail-on-regression`. Batch output can also fail on duplicate metadata, duplicate main content, and canonical chains; see the [CLI reference](../README.md#command-line-options) for the available gates. The example [GitHub Actions workflow](./github-actions-audit.yml) shows a repeatable audit job.

## Compare two hosts on matching routes

Prepare one URL per line in each file. Keep route scope and crawl timing comparable:

```sh
bash examples/geo-live-host-review.sh \
  reports/primary-urls.txt \
  reports/secondary-urls.txt \
  reports/host-review 1500 domcontentloaded
```

The workflow saves both batch reports, sitewide GEO summaries, opportunity reviews, and a route-parity summary. It compares observed initial-HTML and rendered-text signals on matching paths; it does not claim that different hosts should have identical content.

## Review a sample of AI-answer citations

Aviary does not query proprietary answer engines for you. Provide a dated observation file containing the prompts, providers, answers or citations, and any relevant capture context. Then generate a paired review bundle:

```sh
pnpm run geo:review -- \
  reports/answers-baseline.json \
  reports/answers-current.json \
  example.com \
  reports/answer-review

pnpm run geo:review:verify -- reports/answer-review
```

The bundle combines captured citation changes with enabled crawler, audit, and policy evidence. It reports the supplied sample, not an estimate of future visibility or causal impact. Read the panel-comparability summary and completeness notes before interpreting period changes.

## Plan the next observation panel

Use the prompts and context in an existing observation file to plan a better-balanced follow-up sample:

```sh
pnpm run geo:prompt-plan -- \
  reports/answers-current.json \
  reports/prompt-plan \
  example.com
```

The output includes provider/cohort quotas and paired-provider effort budgets. Set `GEO_PROMPT_PLAN_MIN_PROMPTS`, `GEO_PROMPT_PLAN_MAX_TOTAL_PAIRED_GROUPS`, or `GEO_PROMPT_PLAN_COHORT_TARGETS` when the capture budget or cohort targets are known. The planner balances the supplied panel; it does not infer market demand.

## Measure citation repeatability

Repeated samples can help distinguish stable observations from prompt-level variation:

```sh
pnpm run geo:repeatability -- \
  reports/repeated-answers.json \
  reports/citation-repeatability.csv \
  --owned-domain example.com
```

This compares adjacent captures with matching provider, prompt, and context. Incomplete citation lists are counted and excluded where absence cannot be observed. Treat intervals and significance results as descriptive of the recorded prompt panel.

## Explore the offline GEO workflows

Generate an index of synthetic examples without contacting a website or answer provider:

```sh
pnpm run geo:toolbox:synthetic -- reports/geo-toolbox
```

Open `reports/geo-toolbox/index.html` to choose among prompt-family sensitivity, capture planning, citation opportunities, source portfolios, crawler-route review, and other workflows. Synthetic data demonstrates report behavior only; use retained observations for decisions.

## Start the audit API

Build Aviary and start the REST service on its loopback default:

```sh
pnpm run build
pnpm run api-server
```

Submit and poll bounded audit jobs through the REST API, or subscribe to progress with server-sent events. Before exposing the service beyond the local machine, configure authentication, TLS, and outbound network restrictions. See the [API guide](../docs/API.md) for endpoints, request limits, and shutdown behavior.
