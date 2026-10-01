# 0.2.0 release handoff

Last reviewed: 2026-10-01
Current package checkout: `@ru1vly/aviary` **0.1.1**, with all five optional platform packages at **0.1.1**. The selected release is **0.2.0**.

## Release decision

**Do not publish yet.** npm currently has no `0.2.0` for the root or any of the five platform packages, and no `v0.2.0` Git tag exists. The local `main` checkout is ahead of `origin/main` and clean; it has not been pushed or tagged. Two known hard blockers remain:

1. The tagged workflow requires at least 80% coverage. The latest complete run passes **511 tests across 64 files**, with **60.34% statement, 61.63% line, 58.53% function, and 42.11% branch coverage**. The coverage command exits unsuccessfully at the configured thresholds.
2. npm trusted publishing has not been configured for the root package and five platform packages. The release workflow uses npm's OIDC trusted-publisher flow, so each package needs a matching GitHub Actions publisher entry before release.

The candidate cannot publish until the coverage threshold and npm trusted-publisher setup are resolved. A clean-checkout verification and the required CI/security gates must also pass on the final release commit before tagging.

## Included work

The candidate adds GEO audit, crawl, comparison, observation, citation-network, source-diversity, source-portfolio, crawler-log, and provider-report workflows, plus API/MCP support, schemas, examples, and operator guidance. It also includes report-rendering safety fixes, removes embedded URL credentials from cross-platform matrix exports, repairs CSV headers that previously caused several offline comparison dashboards to render empty or misaligned data, and makes the native fast engine handle help and invalid options without network access. The release matrix now smoke-checks both native binaries on each platform. The curated [0.2.0 changelog](CHANGELOG.md) ships in the npm package and supplies the GitHub Release notes, with commit subjects as a fallback when a version has no changelog section. GitHub Release assets will also include a SHA-256 manifest for the native binaries.

Public-facing docs explain the measured scope and limits of Aviary's scores, crawler discovery, provider observations, API network boundary, data handling, and semantic analyzer configuration. The package dry run includes the user docs and examples, and excludes `reports/` and this handoff.

## Verification snapshot

The build, audit, test, and install checks below passed on the release candidate. Follow-up native CLI and release-workflow edits were checked separately:

- Rechecked the TypeScript source on 2026-10-01: `pnpm run build:ts`, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm run format:check`, and `pnpm run check:cli-docs` passed. The latest full suite passed 511 tests across 64 files; coverage remains below the documented 80% thresholds.
- Focused provider-divergence verification after fixing its missing CSV header: 9 tests pass; isolated module coverage is 99.21% statements, 93.15% branches, 100% functions, and 100% lines. This targeted run does not replace the full-suite coverage gate.
- Focused owned-source network-gap verification after fixing its missing CSV header: 7 tests pass; isolated module coverage is 95.71% statements, 88.13% branches, 95.83% functions, and 96.31% lines. This targeted run does not replace the full-suite coverage gate.
- Focused platform-matrix reporter verification: 3 tests pass across CSV and HTML exports, including URL-credential redaction. Isolated module coverage is 97.79% statements, 70.87% branches, 100% functions, and 98.43% lines; the targeted coverage invocation exits on the configured branch threshold, while the focused test run passes.
- Added a representative report fixture covering prompt-family rarefaction, provider overlap, threshold sweeps, period comparisons, influence, and dashboards. The focused prompt-similarity suite passes 6 tests; isolated module coverage rose from 18% to **91.57% statements, 66.81% branches, 96.49% functions, and 93.11% lines**. The focused coverage command still exits at the branch threshold.
- Latest full run: `pnpm exec vitest run --coverage --maxWorkers=2` passed 511 tests across 64 files but exited at the global threshold: **60.34% statements, 42.11% branches, 58.53% functions, and 61.63% lines**.
- `pnpm run lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, and `pnpm run build`.
- Full and production `pnpm audit --audit-level moderate`; `cargo audit` found no advisories across 352 locked Rust dependencies.
- `cargo test --locked --package aviary-engine` passed 4 unit tests and 1 doctest; `cargo clippy --locked --jobs 1 --package aviary-engine --bin aviary-fast -- -D warnings` passed. `rustfmt --check` passed for the edited fast binary. Workspace-wide `cargo fmt --check` still reports pre-existing formatting differences in unrelated Rust files.
- The 511-test suite. Coverage still fails the configured 80% thresholds as described above.
- A fresh simulated `@ru1vly/aviary@0.2.0` package from commit `d53cc51` applied the release workflow's root/platform versioning and OpenAPI version update. It contains **573 files, 12,083,197 unpacked bytes, and 2,013,236 compressed bytes**, includes the current changelog, fast-engine CLI help, platform-matrix reporter, and `docs/openapi.yaml` version 0.2.0, and excludes `reports/` and this handoff. A clean consumer install with optional native packages omitted loaded 352 exports, including `AviaryApiClient` and the platform-matrix CSV reporter, and CLI `--help` succeeded.
- Rebuilt the Rust `tui` and `aviary-fast` release binaries from the current checkout. The simulated `@ru1vly/aviary-linux-x64@0.2.0` tarball contains three files (11,187,370 unpacked bytes; 3,988,487 compressed bytes), and installs cleanly on Linux x64. The installed TUI passed its binary smoke; the installed fast engine passed its local help/error smoke and generated a live 18-check report for `aviary-rs.com` (17 passed, 1 content-to-HTML ratio advisory). The fast-engine help check is now in the tagged release matrix. Both local tarballs, pack manifests, and SHA-256 checksums are retained in `reports/release-package-smokes/2026-10-01/`. This verifies Linux x64 only; the other four target packages still need their release-matrix builds and install/runtime checks.
- An earlier clean-install smoke also verified API health and served OpenAPI versions, MCP initialization, and the Linux x64 binary. The package dry run confirmed `CHANGELOG.md` is present, README/changelog document `SHA256SUMS`, and the packaged OpenAPI version is 0.2.0.
- Local Markdown links and the package-boundary links in packed Markdown files.
- Compared compiled CLI help with the README and GEO guide: all 390 switches are documented (383 long options and 7 shortcuts). `pnpm run check:cli-docs` now repeats this check in CI and the tagged-release test job.
- Parsed the release workflow YAML, checked the release-notes shell step, and verified it uses the curated `0.2.0` notes and falls back to commit subjects for `0.1.1`.
- Parsed the release workflow and exercised its checksum step against sample binary assets; the generated `SHA256SUMS` verified both files.

These are local candidate checks, not evidence that CI has passed on this branch. The latest observed main CI run succeeded on 2026-09-19 and Security Scan on 2026-09-28; both predate the candidate work.

## Report review bundle

`reports/` contains the full local generated report set (about 39 MB); the raw JSON, HTML, PDF, and CSV artifacts are ignored by Git and excluded from the npm tarball. The compact [release-candidate evidence brief](reports/RELEASE_EVIDENCE.md) is tracked for review and records the live-site results, synthetic workflow outputs, interpretation limits, and local artifact locations.

## Known limitations and follow-up

- The live Aviary homepage still says “235 checks across 28 categories”; the current CLI reports **242 checks across 29 categories**. I updated the corresponding landing-page, metadata, README, quickstart, and support copy in the separate `/home/r1/Projects/Aviary-Docs` checkout. That checkout already contains in-progress uncommitted work, so these copy updates are also uncommitted and have not been deployed. Before release, review and commit the website work without losing the existing edits, publish the site, and regenerate the homepage capture. Social artwork still contains old 235/28 sample labels; refresh it before reusing those assets.
- The website crawl discovers links from static HTML. Rendered-DOM route discovery is not implemented; reconcile the nine discovered routes with the site map and an explicit route inventory.
- Several docs-host pages had low initial-HTML/rendered-text overlap in the saved snapshot. Inspect those pages to determine whether meaningful content is inserted client-side; the capture alone does not prove what any external crawler sees.
- Provider answer observations and citation-repeatability reports need dated prompt panels and sample counts. Do not present them as evidence of guaranteed citations.
- The 1,500 ms settle-delay sensitivity capture is diagnostic, not a recommended universal setting.
- The 1.0.0 npm versions were mistaken test releases. A registry recheck on 2026-10-01 confirmed all six root/platform versions remain published and carry the deprecation message “Mistaken initial test release; use @ru1vly/aviary@0.1.1 instead.” The root package has one maintainer and the npm downloads API reported 16 downloads for the week ending 2026-09-29, so it is below the post-72-hour download limit. Its public dependents still need to be confirmed before it can qualify. An unpublish attempt on 2026-10-01 was rejected with `E403`: the configured granular token cannot perform this 2FA-protected change. The root's 1.0.0 optional dependencies reference all five platform 1.0.0 packages, so those platform versions have a dependent and do not qualify while that root version remains published. Keep the deprecation warnings; if removing the root version remains desirable, an owner must use npm's OTP-capable account flow after confirming the root has no public dependents. npm's [unpublish policy](https://docs.npmjs.com/policies/unpublish/) says versions removed after 72 hours must have no public dependents, fewer than 300 weekly downloads, and a single owner. An unpublished version cannot be restored or reused.

## Release blockers and maintainer actions

1. **Recover the coverage gate.** The latest full run passed 511 tests but failed the configured 80% minimums: statements 60.34%, branches 42.11%, functions 58.53%, and lines 61.63%. Prompt-similarity statements are now at 91.57%, but its branch coverage is still below threshold. Add meaningful coverage for the large GEO observation/reporting and core reporting modules. Keep the thresholds honest; the tagged workflow will not publish while the required coverage job fails.
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
4. **Keep the 1.0.0 versions deprecated.** The five platform versions are referenced by the root 1.0.0 package and cannot be removed while it remains published. The root version's downloads and owner count meet two policy criteria, but its dependents are unverified and the configured npm token cannot perform the OTP-protected unpublish operation. Retain the warnings unless an owner confirms root-package eligibility and uses an OTP-capable account flow. See [npm's unpublish policy](https://docs.npmjs.com/policies/unpublish/).
5. **Inspect all release artifacts.** Linux x64 has a local simulated 0.2.0 package and installed-binary smoke. The other four platform packages still require release-matrix builds, tarball inspection, and supported-system install/runtime checks. Repeat root-package verification from the final clean release commit and keep generated reports out of the package.
6. **Finish the separate website update.** Review and commit the local 242/29 copy edits in `/home/r1/Projects/Aviary-Docs` without losing its existing in-progress changes, deploy the site, and regenerate the live homepage report. Refresh the old social artwork labels before reusing those assets.

Coverage recovery should start with the largest uncovered statement counts from the latest full coverage artifact (2026-10-01; 511 tests passed):

| Module                                             | Uncovered statements | Statement coverage |
| -------------------------------------------------- | -------------------: | -----------------: |
| `src/geo/answerCitationObservationsReporter.ts`    |        3,951 / 5,094 |                22% |
| `src/geo/answerCitationObservations.ts`            |        1,324 / 3,471 |                62% |
| `src/geo/answerCitationPagePairedReach.ts`         |          892 / 1,344 |                34% |
| `src/reporter.ts`                                  |            783 / 864 |                 9% |
| `src/geo/aiCrawlerLogs.ts`                         |          737 / 1,379 |                47% |
| `src/sitewide.ts`                                  |            504 / 856 |                41% |
| `src/geo/bingAiPerformance.ts`                     |            437 / 832 |                47% |
| `src/geo/answerCitationSourcePortfolioDrift.ts`    |            348 / 648 |                46% |
| `src/geo/aiCrawlerPathFamilies.ts`                 |            283 / 560 |                49% |
| `src/crawler.ts`                                   |            234 / 626 |                63% |
| `src/geo/googleSurfaceMatrix.ts`                   |            224 / 230 |                 3% |
| `src/geo/aiCrawlerLogComparison.ts`                |            222 / 226 |                 2% |
| `src/scoring.ts`                                   |            179 / 457 |                61% |
| `src/geo/answerCitationPromptSimilarity.ts`        |          176 / 2,088 |                92% |
| `src/api/server.ts`                                |            167 / 414 |                60% |
| `src/geo/aiCrawlerLogsReporter.ts`                 |            165 / 220 |                25% |
| `src/geo/googleAiCitationConcordanceComparison.ts` |            149 / 149 |                 0% |
| `src/geo/platformMatrix.ts`                        |            103 / 378 |                73% |
| `src/geo/xlsxWorksheetCsv.ts`                      |            103 / 111 |                 7% |
| `src/checkers/geo.ts`                              |            101 / 584 |                83% |

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
2. Verify the external CI/security state; retain the 1.0.0 deprecation warnings unless npm support confirms that removal meets current policy.
3. Run the clean-checkout checks above and inspect the exact packed artifacts.
4. Update and recapture the separate website homepage.
5. Once all required checks pass, create the already-authorized `v0.2.0` tag and let the release workflow publish.
6. Verify npm versions, dist-tags and provenance; GitHub release assets; supported-platform installation; and GHCR versioned and `latest` image digests. Record the release URL and date here.
