# 0.2.0 release handoff

Last reviewed: 2026-10-01
Current package checkout: `@ru1vly/aviary` **0.1.1**, with all five optional platform packages at **0.1.1**. The selected release is **0.2.0**.

## Release decision

**Do not publish yet.** npm currently has no `0.2.0` for the root or any of the five platform packages, and no `v0.2.0` Git tag exists. The candidate and follow-up commits are local; `main` has not been pushed or tagged. Two required release conditions remain:

1. The tagged workflow requires at least 80% coverage. The latest complete run passes **481 tests across 58 files**, with **49.33% statement, 50.46% line, 47.10% function, and 32.99% branch coverage**. The coverage command exits unsuccessfully at the configured thresholds.
2. npm trusted publishing has not been configured for the root package and five platform packages. The release workflow uses npm's OIDC trusted-publisher flow, so each package needs a matching GitHub Actions publisher entry before release.

The release candidate is prepared for review, but the coverage threshold, npm trusted-publisher setup, a clean-checkout verification, and the required CI/security gates must pass on the final release commit before tagging.

## Included work

The candidate adds GEO audit, crawl, comparison, observation, citation-network, source-diversity, source-portfolio, crawler-log, and provider-report workflows, plus API/MCP support, schemas, examples, and operator guidance. It also includes report-rendering safety fixes and repairs CSV headers that previously caused several offline comparison dashboards to render empty or misaligned data. The curated [0.2.0 changelog](CHANGELOG.md) ships in the npm package and now supplies the GitHub Release notes, with commit subjects as a fallback when a version has no changelog section. GitHub Release assets will also include a SHA-256 manifest for the native binaries.

Public-facing docs explain the measured scope and limits of Aviary's scores, crawler discovery, provider observations, API network boundary, data handling, and semantic analyzer configuration. The package dry run includes the user docs and examples, and excludes `reports/` and this handoff.

## Verification snapshot

The build, audit, test, and install checks below passed on the release candidate. Follow-up documentation and release-workflow edits were checked separately:

- Rechecked the current source on 2026-10-01: `pnpm run build:ts`, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm run format:check`, and `pnpm run check:cli-docs` passed. The full test suite passed 481 tests, while `pnpm run test:coverage` exited at the documented 80% thresholds.
- `pnpm run lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, and `pnpm run build`.
- Full and production `pnpm audit --audit-level moderate`; `cargo audit` found no advisories across 352 locked Rust dependencies.
- The 481-test suite. Coverage still fails the configured 80% thresholds as described above.
- A fresh simulated `@ru1vly/aviary@0.2.0` package dry run on a temporary copy applied the release workflow's root/platform versioning and OpenAPI version update. It contains **573 files, 12,080,489 unpacked bytes, and 2,012,708 compressed bytes**, includes `CHANGELOG.md` and `docs/openapi.yaml` version 0.2.0, and excludes `reports/` and this handoff. It uses the current compiled output; repeat from a clean checkout on the final release commit.
- A fresh install of the rebuilt simulated 0.2.0 tarball with optional native packages omitted loaded 348 exports and `AviaryApiClient`; CLI help succeeded. The package dry run confirmed `CHANGELOG.md` is present, README/changelog document `SHA256SUMS`, and the packaged OpenAPI version is 0.2.0. The earlier clean-install smoke also verified API health and served OpenAPI versions, MCP initialization, and the Linux x64 binary.
- Local Markdown links and the package-boundary links in packed Markdown files.
- Compared compiled CLI help with the README and GEO guide: all 390 switches are documented (383 long options and 7 shortcuts). `pnpm run check:cli-docs` now repeats this check in CI and the tagged-release test job.
- Parsed the release workflow YAML, checked the release-notes shell step, and verified it uses the curated `0.2.0` notes and falls back to commit subjects for `0.1.1`.
- Parsed the release workflow and exercised its checksum step against sample binary assets; the generated `SHA256SUMS` verified both files.

These are local candidate checks, not evidence that CI has passed on this branch. The latest observed main CI run succeeded on 2026-09-19 and Security Scan on 2026-09-28; both predate the candidate work.

## Report review bundle

`reports/` contains the full local generated report set (about 39 MB); the raw JSON, HTML, PDF, and CSV artifacts are ignored by Git and excluded from the npm tarball. The compact [release-candidate evidence brief](reports/RELEASE_EVIDENCE.md) is tracked for review and records the live-site results, synthetic workflow outputs, interpretation limits, and local artifact locations.

## Known limitations and follow-up

- The live Aviary homepage still says “235 checks across 28 categories”; the current CLI reports **242 checks across 29 categories**. The website source is maintained separately. Update it there and regenerate the homepage capture.
- The website crawl discovers links from static HTML. Rendered-DOM route discovery is not implemented; reconcile the nine discovered routes with the site map and an explicit route inventory.
- Several docs-host pages had low initial-HTML/rendered-text overlap in the saved snapshot. Inspect those pages to determine whether meaningful content is inserted client-side; the capture alone does not prove what any external crawler sees.
- Provider answer observations and citation-repeatability reports need dated prompt panels and sample counts. Do not present them as evidence of guaranteed citations.
- The 1,500 ms settle-delay sensitivity capture is diagnostic, not a recommended universal setting.
- The 1.0.0 npm versions were mistaken test releases. All six root/platform versions remain published and carry the deprecation message “Mistaken initial test release; use @ru1vly/aviary@0.1.1 instead.” Removing all six is not currently viable: the 72-hour window has passed, and the root 1.0.0 package depends on the five platform 1.0.0 packages, so those platform versions have a public dependent. The earlier unpublish attempt also returned `E403` because the configured credentials could not satisfy npm's 2FA requirement. Keep the warning in place unless npm support confirms an allowed removal path.

## Release blockers and maintainer actions

1. **Recover the coverage gate.** The latest full run passed 481 tests but failed the configured 80% minimums: statements 49.33%, branches 32.99%, functions 47.10%, and lines 50.46%. Add meaningful coverage for the large GEO observation/reporting, prompt-similarity, and core reporting modules. Keep the thresholds honest; the tagged workflow will not publish while the required coverage job fails.
2. **Configure npm trusted publishers.** Add a GitHub Actions trusted publisher for `Ru1vly/Aviary`, workflow `release.yml`, to the root and each of the five platform packages. Match the workflow environment if one is added; currently it expects no environment. See [npm's trusted publisher setup guide](https://docs.npmjs.com/trusted-publishers/). Publishing should use OIDC provenance; do not add a broad npm token to the release workflow.
3. **Recheck release controls.** Verify workflow permissions, tag protection, bootstrap secrets, and current CI/Security Scan/bootstrap results on the final release commit. The last observed passing runs are from before this candidate.
4. **Keep the 1.0.0 versions deprecated.** npm's post-72-hour criteria require no dependents, fewer than 300 downloads in the last week, and a single owner. The five platform versions are dependencies of the root package, so retain the existing warnings unless npm support confirms a policy-compliant removal path. See [npm's unpublish policy](https://docs.npmjs.com/policies/unpublish/).
5. **Inspect the actual release artifacts.** Repeat a clean-checkout build, package dry run, and install smoke; verify platform installers and tarballs on supported systems. Keep generated reports out of the package.
6. **Update the separate website.** Correct the homepage check/category count to 242/29, deploy, and regenerate the live homepage report.

Coverage recovery should start with the largest uncovered statement counts from the latest full coverage artifact (2026-10-01; 481 tests passed):

| Module                                          | Uncovered statements | Statement coverage |
| ----------------------------------------------- | -------------------: | -----------------: |
| `src/geo/answerCitationObservationsReporter.ts` |        4,099 / 5,094 |                20% |
| `src/geo/answerCitationPromptSimilarity.ts`     |        1,938 / 2,088 |                 7% |
| `src/geo/answerCitationObservations.ts`         |        1,823 / 3,471 |                47% |
| `src/geo/answerCitationPagePairedReach.ts`      |        1,009 / 1,344 |                25% |
| `src/reporter.ts`                               |            783 / 864 |                 9% |
| `src/geo/aiCrawlerLogs.ts`                      |          737 / 1,379 |                47% |
| `src/sitewide.ts`                               |            504 / 856 |                41% |
| `src/geo/bingAiPerformance.ts`                  |            437 / 832 |                47% |

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
