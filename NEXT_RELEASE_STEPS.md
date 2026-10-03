# Remaining release verification

Final frozen suite: 659 tests / 70 files pass. Coverage gate still fails. This inventory comes from coverage/coverage-final.json at 766fc79; counts below cover src files only, while the configured global gate also includes other instrumented files.

| Source file | Uncovered branch outcomes | Uncovered statements | Uncovered functions |
| --- | ---: | ---: | ---: |
| src/geo/answerCitationObservationsReporter.ts | 3962 | 1714 | 426 |
| src/geo/answerCitationObservations.ts | 1141 | 382 | 34 |
| src/geo/answerCitationPromptSimilarity.ts | 805 | 176 | 16 |
| src/geo/aiCrawlerLogs.ts | 784 | 542 | 54 |
| src/geo/answerCitationPagePairedReach.ts | 780 | 888 | 167 |
| src/reporter.ts | 691 | 409 | 101 |
| src/geo/answerCitationSourcePortfolioDrift.ts | 424 | 348 | 48 |
| src/sitewide.ts | 373 | 351 | 78 |
| src/geo/aiCrawlerLogsReporter.ts | 319 | 70 | 27 |
| src/geo/aiCrawlerPathFamilies.ts | 312 | 283 | 43 |
| src/geo/bingAiPerformance.ts | 304 | 68 | 14 |
| src/geo/platformMatrix.ts | 279 | 103 | 23 |

## Next audit cases

- Citation observations and exporters: malformed/legacy saved data, capped evidence, unknown absence, empty provider/cohort intersections, formula escaping and exact CSV row/header alignment. Assert outputs and statistical denominators; do not add assertion-free coverage calls.
- Prompt similarity: normalization, duplicate prompts, sampled cohorts and provider boundaries, capped pair detail and deterministic ordering.
- Crawler logs: all supported input formats, malformed timestamps/status/timing fields, verification availability, partial captures and missing audit correlation. Keep synthetic fixtures distinct from real site captures.
- Source portfolio drift: disjoint and capped domains, missing baseline/current support, unknown deltas and fail-closed gate decisions.
- General reporters: empty/partial older reports, escaped source labels, mobile table scrolling, missing optional GEO data, and PDF layout.

After fixes: hold source/tests fixed, run full coverage and package consumer checks again. Keep 80% thresholds. Validate all npm publishers and native platform smoke installs before releasing; resolve old v0.2.0 tag intentionally. The npm1.0.0 removal requires corrected authentication.

Full machine-readable uncovered branch line inventory: reports/final/coverage-gap-inventory.json.
