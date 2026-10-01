# Release-candidate GEO evidence

These results were generated with the compiled local Aviary CLI against the public `aviary-rs.com` test site on 2026-10-01. They are point-in-time observations of the pages and saved inputs, not measurements of search rank or AI citation outcomes.

## Live-site captures

- A depth-4 static-link crawl with a 50-URL cap discovered nine same-origin routes. All nine browser audits completed, with 72 of 72 GEO checks passing. The mean initial-HTML/rendered five-word phrase overlap was 28.5%; six pages were below 20%, one was between 40% and 60%, and two were at least 80%. The 100/100 average is an Aviary check score over this capture, not a ranking or GEO-readiness prediction.
- A separate homepage GEO capture completed all eight checks and measured 57% initial-HTML/rendered phrase overlap. Its 100/100 score covers only those eight checks.
- A fresh homepage capture at 12:05 UTC repeated the 8/8 result and measured the same 57% phrase overlap. Its JSON, HTML, PDF, Markdown, exact command, and limitations are preserved locally in `reports/aviary-rs-live/usage-meter-recheck-2026-10-01/`.
- The installed simulated 0.2.0 Linux x64 `aviary-fast` package generated an 18-check static report for the homepage: 17 checks passed and the content-to-HTML ratio advisory measured 6.5%. The raw report and reproduction command are in `reports/aviary-rs-live/native-fast-2026-10-01/`; this is the partial fast engine's point-in-time result, not a full browser audit.
- A saved-audit robots replay evaluated 17 crawler tokens across the nine captured URLs: all 153 decisions allowed, with no blocked or skipped URLs. The robots snapshot and site audit were captured at different times, and the robots file points to an off-origin documentation sitemap. The replay describes only the supplied policy text; it does not show that any crawler fetched, indexed, or cited the pages.

The crawl follows links found in static HTML and can miss client-rendered routes. Keep route set, navigation readiness, and settle delay consistent when comparing future captures.

## Synthetic workflow evidence

- The packaged synthetic GEO toolbox workflow generated 60 offline artifacts: 22 HTML, 28 CSV, 9 JSON, and 1 log file. These are generated from fixtures and are not live provider answers.
- The GEO renderer recheck used paired synthetic observation fixtures to exercise source-diversity, source-portfolio, and provider source-network comparison paths. It verified CSV headers and the dashboards that consume them; it does not establish live citation performance.

## Reproduction and local artifacts

The raw JSON, HTML, PDF, and CSV captures remain under `reports/aviary-rs-live/`. Synthetic output and renderer-recheck files remain under `reports/geo-toolbox-finalization-2026-10-01/` and `reports/geo-report-recheck-2026-10-01/`. These generated files are intentionally excluded from npm and are not committed wholesale.

The dated README files beside the local captures record the exact CLI commands and file names. Rebuild first, then use those commands to regenerate the outputs. The checked-in summary intentionally preserves the interpretation and limitations without adding tens of megabytes of generated reports to the release branch.
