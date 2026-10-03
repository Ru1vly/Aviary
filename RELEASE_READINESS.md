# 0.2.0 release handoff

Last reviewed: 2026-10-04
Current package checkout: `@ru1vly/aviary` **0.1.1**, with all five optional platform packages at **0.1.1**. The selected release is **0.2.0**.

## Release decision

**Do not publish yet.** The 2026-10-03 registry check still lists root versions `0.1.0`, `0.1.1`, and `1.0.0`; `1.0.0` remains deprecated as a mistaken test release. Main was pushed and `v0.2.0` was tagged, but release run `37151847503` failed its coverage gate before any platform builds or publication. No 0.2.0 GitHub Release exists. Release blockers and required checks remain:

1. The tagged workflow requires at least 80% coverage. The latest fixed-revision local run passes **652 tests across 69 files**, with **76.81% statement, 78.22% line, 79.27% function, and 58.68% branch coverage**. The coverage command exits unsuccessfully at the configured thresholds. Use `vitest run --coverage --maxWorkers=2` on this host: unrestricted concurrency exhausted available memory/swap and caused integration timeouts; the limited run passed every test in 61.43 seconds.
2. npm trusted-publisher setup remains unverified for the root package and five platform packages. The release workflow uses npm's OIDC trusted-publisher flow, so each package needs a matching GitHub Actions publisher entry before release; the failed test gate did not exercise publication authentication.

The candidate cannot publish until the coverage threshold and npm trusted-publisher setup are resolved. A clean-checkout verification and the required CI/security gates must also pass on the final release commit before tagging.

## Included work

The candidate adds GEO audit, crawl, comparison, observation, citation-network, source-diversity, source-portfolio, crawler-log, and provider-report workflows, plus API/MCP support, schemas, examples, and operator guidance. It also includes report-rendering safety fixes, removes embedded URL credentials from cross-platform matrix exports, repairs CSV headers that previously caused several offline comparison dashboards to render empty or misaligned data, and makes the native fast engine handle help and invalid options without network access. The release matrix now smoke-checks both native binaries on each platform. The curated [0.2.0 changelog](CHANGELOG.md) ships in the npm package and supplies the GitHub Release notes, with commit subjects as a fallback when a version has no changelog section. GitHub Release assets will also include a SHA-256 manifest for the native binaries.

Public-facing docs explain the measured scope and limits of Aviary's scores, crawler discovery, provider observations, API network boundary, data handling, and semantic analyzer configuration. The package dry run includes the user docs and examples, and excludes `reports/` and this handoff.

## Verification snapshot

- Further 2026-10-03 output audit: the Bing HTML reporter has 10 passing tests covering citation gains/declines, unknown metrics, export-only rows, query/cohort turnover, current audit controls, language validation, empty/truncated views, aligned table columns, and safe URL links. Isolated coverage is 99.05% statements, 100% lines/functions, and 89.37% branches. The compiled CLI generated a synthetic standalone report with four tables and nine rows; column alignment and gain/decline values were independently inspected under `reports/bing-output-review-2026-10-03/`. The latest full-suite snapshot below predates these additional reporter tests.

- 2026-10-03: eight real-workbook XLSX import tests cover text/date/percentage/formula conversion, unrelated sheets, provenance, malformed ZIP directories, unsafe paths, encrypted/unsupported entries, size limits, worksheet counts, and column bounds. The three import modules measure 94.96% statements, 96% lines, 100% functions, and 88.03% branches in isolation. Full-suite results are recorded above; the 80% global gate remains unchanged.
- The separate Docs site is deployed with static documentation routes. Its export, lint, TypeScript, 57 tests, and Pages deployment passed. Fresh Aviary reports completed all 10 routes on each public host, measuring 98.1–99.8% source/rendered phrase overlap on documentation pages; see `reports/RELEASE_EVIDENCE.md` for artifacts and scope.

The entries below record both passing checks and failed release gates on the local candidate. The latest full test run passed its test cases, but the coverage threshold failed; follow-up native CLI and release-workflow edits were checked separately. This is local evidence, not a release sign-off:

- Rechecked the TypeScript source on 2026-10-01: `pnpm run build:ts`, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm run format:check`, and `pnpm run check:cli-docs` passed. The latest full suite passed 519 tests across 66 files; coverage remains below the documented 80% thresholds.
- Focused provider-divergence verification after fixing its missing CSV header: 9 tests pass; isolated module coverage is 99.21% statements, 93.15% branches, 100% functions, and 100% lines. This targeted run does not replace the full-suite coverage gate.
- Focused owned-source network-gap verification after fixing its missing CSV header: 7 tests pass; isolated module coverage is 95.71% statements, 88.13% branches, 95.83% functions, and 96.31% lines. This targeted run does not replace the full-suite coverage gate.
- Focused platform-matrix reporter verification: 3 tests pass across CSV and HTML exports, including URL-credential redaction. Isolated module coverage is 97.79% statements, 70.87% branches, 100% functions, and 98.43% lines; the targeted coverage invocation exits on the configured branch threshold, while the focused test run passes.
- Added a representative report fixture covering prompt-family rarefaction, provider overlap, threshold sweeps, period comparisons, influence, and dashboards. The focused prompt-similarity suite passes 6 tests; isolated module coverage rose from 18% to **91.57% statements, 66.81% branches, 96.49% functions, and 93.11% lines**. The focused coverage command still exits at the branch threshold.
- Added saved-report validation and comparison fixtures covering every URL transition, provider changes, sample changes, and CSV/HTML exports. The focused concordance suite passes 3 tests; the comparison module now has **91.27% statement, 84.98% branch, 97.14% function, and 95.45% line coverage**.
- Added Search/Discover matrix fixtures for normalized URL joins, separate impression shares, path families, period deltas, invalid rows, audit controls, and incompatible inputs. The focused suite passes 4 tests; `googleSurfaceMatrix.ts` now has **96.08% statement, 80.40% branch, 98.07% function, and 97.64% line coverage**.
- Added HTML/CSV dashboard checks for the Google Search/Discover matrix and path-family exports. The reporter module now has **94.62% statement, 63.05% branch, 96.66% function, and 94.11% line coverage**.
- Added access-log period comparison fixtures for crawler path failures, retained-path changes, and labeled referral samples. The focused suite passes 1 test; `aiCrawlerLogComparison.ts` now has **73.45% statement, 57.10% branch, 79.07% function, and 76.38% line coverage**.
- Added seven focused AI crawler log reporter tests covering timing and edge annotations, referrals, privacy-preserving IP aggregation, saved robots replay, and empty logs. The focused suite passes all 7 tests; isolated module coverage is **36.36% statements, 19.85% branches, 42.10% functions, and 35.07% lines**. This targeted run does not replace the full-suite coverage gate.
- Added 13 reporter tests for HTML, Markdown, CSV, JUnit, SARIF, competitor Markdown, and nested output paths; the focused reporter suite passes. In the full run, `src/reporter.ts` improved from 9% to **52.66% statement coverage**.
- Latest full run (2026-10-03): `vitest run --coverage --maxWorkers=2` passed 543 tests across 67 files but exited at the global threshold: **65.07% statements, 47.15% branches, 63.43% functions, and 66.43% lines**.
- `pnpm run lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, and `pnpm run build`.
- Full and production `pnpm audit --audit-level moderate`; `cargo audit` found no advisories across 352 locked Rust dependencies.
- `cargo test --locked --package aviary-engine` passed 4 unit tests and 1 doctest; `cargo clippy --locked --jobs 1 --package aviary-engine --bin aviary-fast -- -D warnings` passed. `rustfmt --check` passed for the edited fast binary. Workspace-wide `cargo fmt --check` still reports pre-existing formatting differences in unrelated Rust files.
- The 528-test suite. Coverage still fails the configured 80% thresholds as described above.
- Final checkout `npm pack --dry-run --json` confirms the current `0.1.1` package has 573 entries (12,083,197 unpacked; 2,013,235 packed bytes), includes `CHANGELOG.md`, and excludes `reports/` and `coverage/`. This checks the latest built tree; the simulated versioned `0.2.0` tarball remains the release-candidate artifact.
- Fresh simulated 0.2.0 root and Linux x64 packages were packed from source commit `a3f09f6` using the release workflow's versioning and OpenAPI update. The root tarball contains **573 files, 12,083,397 unpacked bytes, and 2,013,331 compressed bytes**; it includes the batch PDF pagination fix. Inspection confirms version 0.2.0 for the root and all five optional platform dependencies, OpenAPI version 0.2.0, and no included `reports/` or `coverage/`. A clean consumer install loaded 348 exports, including the crawler-log analysis and HTML renderers; rendering a batch report from the installed package confirmed its print pagination rules, and packaged CLI `--help` succeeded with optional native packages omitted. The Linux x64 tarball contains three files (11,188,050 unpacked bytes; 3,983,203 compressed bytes), installs cleanly, and its installed TUI and fast-engine binaries passed local smoke checks. Both tarballs pass SHA-256 verification and are retained with manifests and a README in `reports/release-package-smokes/final-2026-10-01/`; the portable local review bundle is `reports/release-package-smokes/aviary-0.2.0-local-release-bundle.tar.gz` with a neighboring checksum file. No package was published. This verifies Linux x64 only; the other four target packages still need supported-matrix builds and install/runtime checks.
- An earlier clean-install smoke also verified API health and served OpenAPI versions, MCP initialization, and the Linux x64 binary. The package dry run confirmed `CHANGELOG.md` is present, README/changelog document `SHA256SUMS`, and the packaged OpenAPI version is 0.2.0.
- Local Markdown links and the package-boundary links in packed Markdown files.
- Compared compiled CLI help with the README and GEO guide: all 390 switches are documented (383 long options and 7 shortcuts). `pnpm run check:cli-docs` now repeats this check in CI and the tagged-release test job.
- Parsed the release workflow YAML, checked the release-notes shell step, and verified it uses the curated `0.2.0` notes and falls back to commit subjects for `0.1.1`.
- Parsed the release workflow and exercised its checksum step against sample binary assets; the generated `SHA256SUMS` verified both files.

These are local candidate checks, not evidence that CI has passed on this branch. The latest observed main CI run succeeded on 2026-09-19 and Security Scan on 2026-09-28; both predate the candidate work.

## Report review bundle

`reports/` contains the full local generated report set (about 39 MB); the raw JSON, HTML, PDF, and CSV artifacts are ignored by Git and excluded from the npm tarball. The compact [release-candidate evidence brief](reports/RELEASE_EVIDENCE.md) is tracked for review and records the live-site results, synthetic workflow outputs, interpretation limits, and local artifact locations.

## Known limitations and follow-up

- The separate Aviary Docs updates are pushed and deployed. Static documentation routes and the 242/29 product copy are live; 57 site tests pass. Static-export hosting still needs platform-level security headers because Next.js export ignores `next.config.ts` response headers. Social artwork contains old 235/28 labels and must be refreshed before reuse.
- The website crawl discovers links from static HTML. Rendered-DOM route discovery is not implemented; the current sitemap and paired live capture cover 10 explicit routes.
- The static documentation route fix raised measured source/rendered phrase overlap to 98.1–99.8% on documentation routes. Root and support pages remain below 80%; these measurements do not establish external crawler behavior.
- Provider answer observations and citation-repeatability reports need dated prompt panels and sample counts. Do not present them as evidence of guaranteed citations.
- The 1,500 ms settle-delay sensitivity capture is diagnostic, not a recommended universal setting.
- The 1.0.0 npm versions were mistaken test releases. A registry recheck on 2026-10-01 confirmed all six root/platform versions remain published and carry the deprecation message “Mistaken initial test release; use @ru1vly/aviary@0.1.1 instead.” `npm whoami` confirms the configured account is `ru1vly`. A fresh registry/downloads check found one maintainer for each of the six packages and 16/14/11/8/9/12 downloads respectively (root, Linux x64, Windows x64, macOS x64, Linux arm64, macOS arm64) for 2026-09-23 through 2026-09-29, all below npm's 300-download threshold. Public dependents still need confirmation. The previous root-version unpublish request was rejected with `E403` because the configured granular token cannot satisfy the account's 2FA requirement. The root's 1.0.0 optional dependencies reference all five platform 1.0.0 packages, so remove the root version first; then recheck that each platform version has no remaining public dependents. npm's [unpublish policy](https://docs.npmjs.com/policies/unpublish/) requires no public dependents, fewer than 300 weekly downloads, and a single owner for versions older than 72 hours. Unpublishing is irreversible and those versions can never be reused. The deprecation warnings remain in place until an OTP-capable npm session can complete the authorized removal.

## Release blockers and maintainer actions

1. **Recover the coverage gate.** The latest full run passed 528 tests but failed the configured 80% minimums: statements 65.07%, branches 47.15%, functions 63.43%, and lines 66.43%. Prompt-similarity statements, concordance comparison coverage, and all four surface-matrix coverage metrics are now above 80%. Add meaningful coverage for the large GEO observation/reporting and core reporting modules. Keep the thresholds honest; the tagged workflow will not publish while the required coverage job fails.
2. **Configure npm trusted publishers.** Add a GitHub Actions trusted publisher for `Ru1vly/Aviary`, workflow `release.yml`, to the root and each of the five platform packages. Match the workflow environment if one is added; currently it expects no environment. On 2026-10-01, `npm trust list` was rejected with `E403` for the configured token, so the publisher settings could not be inspected or updated from this session. The current `npm trust` management command requires npm 11.15.0 or newer; the workflow's npm 11.5.1 meets npm's separate minimum for publishing through trusted publishers. With an OTP-capable npm account and npm 11.15.0+, run `npm trust github <package> --repository Ru1vly/Aviary --file release.yml --allow-publish` for each package:

   ```sh
   for package in \
     @ru1vly/aviary \
     @ru1vly/aviary-linux-x64 \
     @ru1vly/aviary-win32-x64 \
     @ru1vly/aviary-darwin-x64 \
     @ru1vly/aviary-linux-arm64 \
     @ru1vly/aviary-darwin-arm64
   do
     npm trust github "$package" --repository Ru1vly/Aviary --file release.yml --allow-publish
   done
   ```

   The release workflow currently defines no GitHub environment, so do not pass `--environment`. See [npm's trusted publisher setup guide](https://docs.npmjs.com/trusted-publishers/) and the [npm trust command requirements](https://docs.npmjs.com/cli/v11/commands/npm-trust/). Publishing should use OIDC provenance; do not add a broad npm token to the release workflow.

3. **Recheck release controls.** Verify workflow permissions, tag protection, bootstrap secrets, and current CI/Security Scan/bootstrap results on the final release commit. The last observed passing runs are from before this candidate.
4. **Remove the mistaken 1.0.0 versions when npm authentication permits.** The user authorized removal. The root package meets the observed single-owner and low-download criteria, but its public dependents are unverified and the configured token cannot satisfy 2FA. An OTP-capable session must unpublish `@ru1vly/aviary@1.0.0` first, then confirm and remove the five platform versions individually. Preserve the deprecation message until removal succeeds. See [npm's unpublish policy](https://docs.npmjs.com/policies/unpublish/).
5. **Inspect all release artifacts.** Linux x64 has a local simulated 0.2.0 package and installed-binary smoke. The other four platform packages still require release-matrix builds, tarball inspection, and supported-system install/runtime checks. Repeat root-package verification from the final clean release commit and keep generated reports out of the package.
6. **Finish website follow-up.** Static documentation routes and updated copy are deployed and recaptured. Review platform security headers and refresh old social artwork labels before reuse.

Coverage recovery should start with the largest uncovered statement counts from the latest full coverage artifact (2026-10-01; 519 tests passed):

| Module                                              | Uncovered statements | Statement coverage |
| --------------------------------------------------- | -------------------: | -----------------: |
| `src/geo/answerCitationObservationsReporter.ts`     |        3,951 / 5,094 |                22% |
| `src/geo/answerCitationObservations.ts`             |        1,324 / 3,471 |                62% |
| `src/geo/answerCitationPagePairedReach.ts`          |          892 / 1,344 |                34% |
| `src/geo/aiCrawlerLogs.ts`                          |          726 / 1,379 |                47% |
| `src/geo/bingAiPerformance.ts`                      |            437 / 832 |                47% |
| `src/reporter.ts`                                   |            409 / 864 |                53% |
| `src/sitewide.ts`                                   |            351 / 856 |                59% |
| `src/geo/answerCitationSourcePortfolioDrift.ts`     |            348 / 648 |                46% |
| `src/geo/aiCrawlerPathFamilies.ts`                  |            283 / 560 |                50% |
| `src/crawler.ts`                                    |            234 / 626 |                63% |
| `src/geo/answerCitationPromptSimilarity.ts`         |          176 / 2,088 |                92% |
| `src/api/server.ts`                                 |            167 / 414 |                60% |
| `src/geo/aiCrawlerLogsReporter.ts`                  |            165 / 220 |                25% |
| `src/scoring.ts`                                    |            153 / 457 |                67% |
| `src/geo/platformMatrix.ts`                         |            103 / 378 |                73% |
| `src/geo/xlsxWorksheetCsv.ts`                       |            103 / 111 |                 7% |
| `src/checkers/geo.ts`                               |            101 / 584 |                83% |
| `src/index.ts`                                      |             97 / 243 |                60% |
| `src/geo/entityPromptMatchedCitationAssociation.ts` |             89 / 405 |                78% |
| `src/geo/bingAiReporter.ts`                         |             67 / 106 |                37% |

## Clean-checkout verification

Run with the pinned pnpm toolchain before tagging:

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run format:check
pnpm exec tsc --noEmit
pnpm run build:ts
pnpm run check:cli-docs
pnpm run test:coverage
pnpm audit --audit-level moderate
pnpm audit --prod --audit-level moderate
cargo audit
cargo build --locked --release --target x86_64-unknown-linux-gnu \
  --package tui --package aviary-engine --bin tui --bin aviary-fast
npm pack --dry-run
```

The coverage command must pass its configured thresholds, not just run all tests. Also install the packed artifact into a clean consumer and verify CLI help, root exports, API health/OpenAPI, MCP initialization, and a native package for each supported platform.

## Release sequence

1. Resolve the coverage and trusted-publisher blockers.
2. Verify the external CI/security state. Remove the authorized 1.0.0 versions once the npm account can complete OTP-protected unpublish operations and current dependent checks meet policy.
3. Run the clean-checkout checks above and inspect the exact packed artifacts.
4. Verify that the deployed website and latest report captures still match the intended release.
5. Once all required checks pass, repoint the existing unpublished `v0.2.0` tag to the passing release commit and trigger the release workflow. The current tag points to the failed coverage candidate.
6. Verify npm versions, dist-tags and provenance; GitHub release assets; supported-platform installation; and GHCR versioned and `latest` image digests. Record the release URL and date here.

## Final local package — 2026-10-04

Final CSV blank-field and Google comparison alignment fixes are covered by regression tests. TypeScript compilation and source lint pass; all 543 tests pass across 67 files. Global coverage remains below the unchanged 80% gate.

Local unpublished archive: `reports/release-package-smokes/final-2026-10-04/ru1vly-aviary-0.2.0.tgz`, SHA-256 `12272e076b5189c2806e9e849bf1afd9232553191a73468418b2d93094bc78c0`. Manifest and checksum are beside the archive.

Next release steps: recover global coverage to 80% in all metrics; configure/verify npm trusted publishers for all six packages; run final CI and platform binary smokes on the release commit; reconcile the existing failed v0.2.0 tag with the verified final commit; publish and confirm all registry packages and release assets. Removing mistaken npm 1.0.0 still requires authentication satisfying npm’s 2FA restriction; it remains deprecated.

## Clean consumer install — 2026-10-04

Installing the packed tarball into `/tmp/aviary-clean-install-20261004` with npm succeeds (177 packages), without workspace dependency links. The installed executable reports 0.2.0, displays help, and generates Google comparison HTML/CSV/JSON. Its CSV matches the prior packed-CLI output byte for byte. Optional native 0.2.0 packages are not yet published and were not installed.

**Resolved in the subsequent bundled candidate:** the initial consumer `npm audit` reports a moderate uuid advisory (`GHSA-w5hq-g745-h8pq`) through ExcelJS 4.4.0 (three affected dependency nodes, one advisory). The repository pnpm override to uuid 11.1.1 does not propagate to consumer installs. ExcelJS uses uuid v4 in its conditional-format writer; the advisory concerns v3/v5/v6 buffer handling, but publishing an audited consumer dependency graph still needs a durable dependency solution. Root npm overrides alone will not apply when Aviary is a dependency. Resolve upstream dependency packaging or replace the affected dependency, then regenerate and clean-install the candidate before release. Evidence: `reports/release-package-smokes/final-2026-10-04/clean-install-audit.json`.

## Consumer dependency fix — 2026-10-04

ExcelJS is now a build dependency. `build:ts` bundles the workbook reader using esbuild and the frozen pnpm graph, including patched uuid 11.1.1; the full build uses the same command. Third-party license notices ship beside the bundled reader. Clean npm install now adds 83 packages and reports zero vulnerabilities. Its installed CLI generates JSON from a real XLSX workbook; percentage conversion and invalid-archive rejection also pass through the installed bundle. Eight source XLSX regression tests pass. This resolves the consumer uuid dependency blocker. Revised candidate SHA-256: `12272e076b5189c2806e9e849bf1afd9232553191a73468418b2d93094bc78c0`. Coverage, trusted publishers, and native platform release checks remain open.

- 2026-10-04: added `pnpm run check:xlsx-bundle` to CI and both release build stages. It exercises the compiled reader in a subprocess that permits only Node builtins: real workbook quoting/newlines, dates, percentages, hyperlinks, cached formulas, rich text, booleans, empty/header sheet omission, malformed/oversized archive rejection, and patched uuid/ExcelJS third-party notices. The check passes. This adds automated protection against accidentally publishing an unbundled or incomplete XLSX reader.

- 2026-10-04 metadata audit: found local candidate OpenAPI info.version still 0.1.1 despite package version 0.2.0. Added shared `scripts/set-release-version.js`, wired root release stamping to it, and refreshed the archive. Verified packed OpenAPI/package version 0.2.0, native optional versions, unrelated dependency preservation, invalid version rejection, and missing OpenAPI version rejection before writes. Current archive SHA-256: `12272e076b5189c2806e9e849bf1afd9232553191a73468418b2d93094bc78c0`.

- 2026-10-04 answer-citation CSV audit: added 20 contract tests covering 19 rank/reach/gap/context/answer-length exports, named unique headers, row widths, blank values, formula-safe provider labels, and independently expected owned-prompt coverage/rank counts. Found and removed three duplicated metric columns/values in monthly answer-length trends; monthly change remains. Both output suites pass 22 tests. Isolated giant reporter coverage remains 28.42% statements, 24.47% branches, 29.18% functions, 29.19% lines, below the 80% gate; this is useful output evidence, not release completion.

- CSV-audited candidate packed after a successful TypeScript/bundle build at `reports/release-package-smokes/final-2026-10-04-csv/ru1vly-aviary-0.2.0.tgz`; SHA-256 `9953b4d68bb28060dc7596fc7df1c63bb9cfe0bb1bfc0b295a2a65c12b914d57`. Previous archive retained. Publication remains blocked by coverage and publisher/platform verification.

- 2026-10-04 expanded citation output audit: 56 passing contracts cover 54 exporters plus independent owned coverage/rank and monthly rank metric checks. Found six rank buckets sharing `owned_share_within_rank_percent`; replaced with bucket-specific `owned_rank_<bucket>_share_within_rank_percent` headers, preserving row values. CI run 37154457278 passed Rust, lint/type, E2E and integration; unit coverage failed the unchanged 80% thresholds (test cases passed). Latest full local coverage run is still active when this note was written; do not treat it as complete.

- Latest full local test run: 598 passed, one browser E2E failed because it required exactly zero TBT but measured 57 ms under host load. Updated assertion to require finite, nonnegative, bounded browser timing rather than an exact zero; deterministic threshold unit checks unchanged. Focused E2E rerun is active (session 25681, output /tmp/aviary-e2e-rerun.log); fresh complete coverage metrics are not yet available.

- E2E rerun completed: all nine real-browser tests pass after replacing exact-zero TBT expectation with a finite/nonnegative/bounded measurement assertion. Build plus isolated XLSX bundle check are now running in session 8667 (log /tmp/aviary-build-latest.log). Host RAM/swap pressure explains slow runtime; no processes were restarted. Synthetic monthly rank input prepared at reports/monthly-rank-output-review-2026-10-04/observations.synthetic.json for compiled CLI verification after build.

- Build and isolated XLSX bundle check completed successfully. Actual compiled CLI generated synthetic monthly citation report JSON/CSV; independent Python CSV inspection verifies four rows, 158 unique columns, all six owned rank-share headers and expected 66.67% rank-one owned share. Output: reports/monthly-rank-output-review-2026-10-04/. Fresh local candidate: reports/release-package-smokes/final-2026-10-04-ranks/ru1vly-aviary-0.2.0.tgz, SHA-256 f9bafc27c1e6ae1c933150a52d656fc0be6adfbd2a6f4c1042d8df72c85bf586. A full single-worker coverage run has now started (/tmp/aviary-full-coverage-single-worker.log); coverage release gate remains unproven.

- 2026-10-04 source-category CSV audit: added contracts for 15 additional mapped-category exports and malformed-map rejection, plus current-only/baseline prompt-coverage flag placement. All 88 focused tests pass across 69 export functions and metric/flag checks. Found category prompt coverage appended a second truncation flag, producing 52 fields under 51 headers; fixed replacement of the existing flag. Formula checks now cover both whole-cell and combined provider labels. Full single-worker coverage session 49621 remains active (/tmp/aviary-full-coverage-single-worker.log), now progressing through tests. Latest archive predates this category fix and must be rebuilt after final verification.

## Reproduce a local candidate

From a clean committed checkout, run `pnpm run pack:candidate -- 0.2.0`. The command rebuilds JavaScript, checks the isolated XLSX bundle, rejects edits during the build, stages committed sources and fresh dist output, applies one package/OpenAPI version, and writes the archive, manifest, SHA256SUMS and source-commit provenance under reports/release-candidates. Existing archives are preserved. This creates an unpublished candidate; it does not bypass release gates.

The long single-worker run completed 628 passing/3 failing tests but mixed pre-fix source and subsequently added tests, so it is not final revision evidence. All three failures concern the category CSV defect already fixed and verified by the 88-case focused run. Build and isolated XLSX bundle checks pass on the fixed source.

- Reproducible packaging command completed from ff6304a: reports/release-candidates/0.2.0-ff6304a4/ru1vly-aviary-0.2.0.tgz (SHA-256 198310179236cfa60c1aa2e4b58aa8c597176b8efb8df8fb325740fcd03c99cb), manifest and commit provenance included. Clean npm install succeeds with 83 packages. Installed CLI generates source-category coverage JSON/CSV from labelled synthetic observations; independent CSV parser verifies six rows/51 columns, a single truncation flag and intact final evidence note. All category fixes are now in the candidate. Fresh two-worker full coverage run started against fixed source/tests: /tmp/aviary-frozen-ff6304a-coverage.log. Do not edit source/tests during this run.

## Current package verification summary

| Surface | Verified evidence | Remaining work |
| --- | --- | --- |
| Root package | Clean npm install; consumer audit reports zero vulnerabilities; consistent package/OpenAPI versions | Final full coverage and publisher validation |
| XLSX imports | Eight source tests, isolated compiled-bundle checks, real installed CLI workbook reports | Final CI build |
| Citation CSV outputs | 88 contracts across 69 exports; installed category report has six rows/51 aligned columns | Full-revision coverage completion |
| Browser audits | Nine E2E tests pass; live paired docs-host reports previously generated | Latest full run completion |
| API executable | Installed help/version/unknown-argument smokes pass without listener startup; six API integration tests pass | Latest full run and release CI |
| Native packages | CI Rust build passes; release matrix defines platform smokes | Successful final release matrix and all five packages |
| Publishing | Main source and evidence pushed; local candidate archives available | 80% coverage, OIDC publishers, final tag and registry checks |

The API argument defect was found by the installed-package smoke, not an inferred issue. Log: reports/release-candidates/0.2.0-ff6304a4/api-help.txt. The frozen full coverage run remains active (session 40310). Source/tests were kept fixed after it began.

- Frozen-source full verification completed: all 631 tests/68 files pass. Global coverage S76.75%, B58.51%, F79.24%, L78.18%; command still exits at unchanged 80% thresholds. Session40310 terminal, log /tmp/aviary-frozen-ff6304a-coverage.log. This supersedes pending/mixed-revision evidence. Source/tests were held fixed. Next concrete product fix is installed API help/version/unknown-option behavior; branch coverage and publishing/platform gates remain open.

- API entrypoint argument defect fixed: help/version aliases return before configuration; no arguments serve; unsupported/combined arguments reject without reflecting user tokens. Eleven argument tests pass, compiled executable smokes exit correctly even with invalid TLS configuration, source lint/build pass, and all six API integration tests pass. API docs/changelog updated. The previous candidate predates this API fix; next reproducible pack will include it. Full 631-case coverage numbers predate these eleven tests.

- API-fixed candidate packed reproducibly from beaab6ea: reports/release-candidates/0.2.0-beaab6ea/ru1vly-aviary-0.2.0.tgz, SHA-256 c0ae83b5f1cd4fec671be0b644ce79a44857c2ac0e47963feaf9dc46a3c2a239. Clean npm install (83 packages) verifies API help, package version 0.2.0 and unsupported argument exits even with invalid TLS config; no listener message. Latest full coverage run has started with source/tests fixed: /tmp/aviary-api-fixed-full-coverage.log. Coverage/publisher/native release gates remain open.

- Latest full fixed-source run: all 642 tests/69 files pass; coverage S76.76%, B58.53%, F79.24%, L78.18% still fails unchanged 80% thresholds. Installed MCP handshake and all three tool schemas verified; actual seo_audit call on https://aviary-rs.com/ returns eight successful GEO checks, saved JSON and CLI-rendered HTML in reports/mcp-consumer-review-2026-10-04. This is rule-level GEO evidence, not measured AI visibility. Handshake exposed hardcoded version0.1.1 in 0.2.0 candidate; source now reads installed package metadata and all six protocol integration tests pass with a version assertion. Repacking follows.

- MCP-fixed candidate from cc5e5f87 packed at reports/release-candidates/0.2.0-cc5e5f87/ru1vly-aviary-0.2.0.tgz, SHA-256 d5d7ac8b34994f0efe7901ea3814382730bdb85f210d038745597ca5a1a9d7b6. Clean-installed MCP handshake now reports0.2.0, advertises all three expected tools, and a fresh real seo_audit on aviary-rs.com returns eight GEO checks. Installed CLI renders the saved JSON to HTML under reports/mcp-fixed-consumer-review-2026-10-04/. Build/bundle and six MCP protocol regression tests pass. Full 642-case coverage precedes the metadata-only fix; release coverage gate still fails.

- Category completeness audit found incomplete captured lists incorrectly counted as complete evidence and confirmed owned/category absence. Fixed summary/detail CSVs: retain positive sightings, unknown absence for incomplete/missing capture metadata, exclude unknown states from paired denominators, withhold complete flags, separate capture/legacy counts from domain caps, and include detail completeness state. Aggregate unknown comparison columns now say incomplete_evidence rather than domain_caps. Red regression failed on original output; all 92 focused contracts, TypeScript and source lint pass after fix. GEO docs/changelog updated. Latest full642-case gate predates this fix; repacking and final full run remain required.

- Capture-completeness candidate packed from6172eb3a: reports/release-candidates/0.2.0-6172eb3a/ru1vly-aviary-0.2.0.tgz, SHA-256 2005534ad1f0060bb221d9d830d92120608389d77eb57a6ab633d50c3b85a0d3. Clean-installed CLI generated synthetic baseline/current JSON plus category coverage/detail CSVs. Independent CSV verification: six summary rows show zero complete profiles and incomplete comparison flags; 18 detail rows retain unknown owned absence and captured-list incompleteness. Evidence under reports/category-completeness-review-2026-10-04/. Fresh full coverage is active with source/tests frozen: /tmp/aviary-capture-completeness-full-coverage.log.

- Latest full fixed-source verification completed: all646 tests/69 files pass; coverage S76.79%, B58.63%, F79.25%, L78.21%, still below unchanged80% thresholds. Session99891 terminal; log /tmp/aviary-capture-completeness-full-coverage.log. Installed REST API on a temporary loopback listener serves health/OpenAPI0.2.0, accepts real aviary-rs.com GEO job with202 and completes it (one URL, zero errors, eight GEO checks). Installed CLI renders batch JSON to HTML. Offline desktop1440px/mobile390px Chromium review shows no document horizontal overflow and working page-table URL filter; desktop screenshot visually inspected. Artifacts under reports/api-consumer-live-review-2026-10-04; API smoke listener stopped gracefully.

- Paired page-reach audit added six regression cases: endpoint isolation for citation/top-three/first-position reach, no false loss for unpaired pages, provider gain versus decline direction, and fail-closed Holm family behavior when absence is unknown. All14 focused tests pass. Installed0.2.0 CLI generated gate JSONs from labelled20-prompt rank-shift fixtures: citation-reach exit0; top-three/first-position exit1, with complete support and expected endpoint decisions. Artifacts under reports/page-reach-endpoint-review-2026-10-04. No production changes needed; latest6172eb3a package contains the verified runtime.

Candidate packing now verifies simple relative Markdown file links against the actual npm manifest, ignoring code examples, anchors and external URLs. A missing shipped target rejects and removes the newly generated invalid archive; existing candidates are preserved. The manifest audit is stored beside successful candidates.

- Manifest-audited candidate packed successfully from641c471a: reports/release-candidates/0.2.0-641c471a/ru1vly-aviary-0.2.0.tgz, SHA-256 2005534ad1f0060bb221d9d830d92120608389d77eb57a6ab633d50c3b85a0d3. Build and XLSX bundle checks pass; documentation-link-audit.json verifies139 shipped relative Markdown links and zero missing targets. All current runtime fixes are included. Publication remains blocked by80% coverage, unverified trusted publishers, and final native matrix/tag verification.

- Final packaging checkpoint: five crawler dashboard contracts pass (robots replay/change, period comparison, sitemap freshness, combined panels), with aligned table columns and privacy escaping. Full-suite evidence remains652 tests; these five were run separately. PACKAGING_HANDOFF.md consolidates exact publication blockers and next steps. Final source/candidate/evidence bundle is under reports/final.

- Post-package empty-output audit: crawler dashboard suite now7/7 passes, including absent analyses and empty robots/comparison/sitemap panels. No NaN/Infinity and empty table columns aligned; no runtime fix needed. CI at packaged9b5f17c has passed lint/format/TypeScript; integration still running at inspection. Candidate runtime remains unchanged.

- Final frozen full run at766fc79 completed:659 tests/70 files pass; coverage S77.21%, B59.36%, F79.83%, L78.66%, command exits1 only for unchanged80% coverage gates. Session88103 terminal. CI37158466356: lint/types, Rust, E2E and integration pass; coverage fails; dependent TS build skipped. Handoff updated with actual final evidence.

- Final compiled-CLI workflow audit:390/390 switches documented. Fresh synthetic GEO answer/crawler review generates82 manifest-recorded files; bundle verifier confirms every byte size and SHA-256. Independent Python CSV parser verifies38 CSVs with zero header/row width mismatches. Artifacts reports/final/synthetic-review-2026-10-04; synthetic evidence does not establish live AI outcomes.

- Browser output audit found and fixed two runtime defects: route-family correlation table referenced undefined i; crawler grid cards expanded to table intrinsic width on mobile. Scoped cell index with entries() and set card min-width:0. Fresh compiled review:24 dashboards×desktop/mobile=48 browser checks, zero uncaught errors/overflow;82-file checksum verifier and9 focused tests pass. Reusable scripts/check-report-dashboards.mjs checks generated reports offline. Full659-test evidence predates these small runtime fixes; candidate rebuild follows.

- Dashboard-fixed full frozen run at2d9967df completed:659 tests/70 files pass; S77.21%, B59.36%, F79.83%, L78.66%, exit1 solely unchanged coverage thresholds. Session8981 terminal. Browser filter audit confirms route-family crawler selection/reset and path-row no-match/reset; preliminary whole-card assertion was mismatched to path-only filter, corrected without product change. Evidence dashboard-filter-audit.json.

- Final dashboard control audit:81 select-option transitions across11 generated dashboards tested in offline mobile390 Chromium; zero uncaught errors/document overflow. Each select tested independently, first20 enabled options; does not claim arbitrary combinations or metric semantics. Evidence reports/final/synthetic-review-fixed-2026-10-04/all-dashboard-select-audit.json. No additional runtime defects found.

- Corrected candidate clean-consumer verification: npm install succeeds in/tmp/aviary-final-consumer-mck_4lgo; installed aviary--version and aviary-api--version both0.2.0, API help exits0; npm audit reports zero vulnerabilities. Installation used ignore-scripts and does not establish native execution. Evidence reports/final/final-consumer-verification.json and install log.

- Locked native release workspace build completes successfully in2m03s. LocalLinux fast-engine smoke passes help/invalid option; TUI OS loader smoke passes then exits with noTTY (interactive behavior untested). No claim for other four platforms. Fresh clean-installed corrected CLI renders saved real aviary-rs.com REST batch toHTML; desktop/mobile smoke2/2 passes. Evidence reports/final/native-{build,fast-smoke,tui-smoke}.log and installed-candidate-reports/.

- Packaged unpublishedLinux/x64 optional0.2.0 archive from freshlylocked native build using actual platformpackage layout; cleanconsumer npm install succeeds and installed fastbinary help/invalidoption + TUI loader smokes pass. reports/final/linux-x64-candidate/ru1vly-aviary-linux-x64-0.2.0.tgz has manifest/checksum/logs. Native interactiveTUI and otherfourplatforms remain unverified.

- RealTTY audit found stale hardcoded v1.0 in TUI header. Removed misleading versionlabel. Locked incremental native build passes; automatedPTY confirms startupscreen, no v1.0 label and Escape cleanexit0. Evidence reports/final/native-tui-pty.{log,json}. Linuxpackage must be replaced with rebuiltbinary; JSrootcandidate runtime unchanged.

- Locked Rust workspace tests complete successfully on8ad1715:13 unit tests plus1 doctest pass, zero failures; session63788 terminalexit0. Native tests log/runmetadata in reports/final/native-tests.log and native-test-run.json. This complements lockedLinux release build, installedbinarysmokes andPTY startup/Escape. Remaining gates: TypeScriptcoverage80%, otherplatformmatrix, publishers/tag/publication.
