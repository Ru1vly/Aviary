# Aviary 0.2.0 release readiness

Reviewed 2026-10-05. **Engineering finalization is complete for an unpublished
0.2.0 candidate.** The existing feature set is frozen; `TODO.md` remains the
future roadmap. [FINALIZATION.md](FINALIZATION.md) defines the finish line and
records its verification.

The checkout remains `@ru1vly/aviary@0.1.1`, with five optional packages at 0.1.1.
Release packaging stamps the root, optional dependency versions, native package
manifests, and OpenAPI contract to 0.2.0 without changing the development checkout.
The installed CLI, API, and MCP read that package version.

The subsequent [GEO output-quality review](docs/GEO_OUTPUT_VALIDATION.md) compares
actual outputs with Google, OpenAI, and Bing documentation. It found and fixes
three semantic errors and adds explicit interpretation limits. The engineering
results and packed archives below describe the earlier candidate; they do not
by themselves verify these subsequent source changes or GEO predictive accuracy.

## Subsequent GEO output validation — 2026-10-05

- Eight official source pages from Google, OpenAI, and Bing were compared with
  actual browser/checker and export outputs. The unchanged implementation passed
  13 of 18 bounded checks; the revised implementation passes all 18.
- All 1,503 tests across 91 files pass after the corrections. Statements 90.88%,
  branches 80.03%, functions 94.21%, lines 92.20%; thresholds and exclusions remain
  unchanged. TypeScript, lint, source formatting, and 390 CLI switch checks pass.
- `reports/geo-output-validation/` retains before/after raw outputs, individual
  source-derived expectations, baseline provenance, coverage output and a hash
  manifest. CI now reruns the output validation and retains its evidence.
- The intentionally false-claim page has a check score of 100. This confirms why
  diagnostic scores must not be presented as factual-quality endorsements.

These results validate specific output semantics. They do not establish a
population accuracy rate or predictive citation performance. The earlier packed
candidate receipts below retain their own source revisions.

## Verified engineering gates

Latest [GEO reliability follow-up](docs/GEO_RELIABILITY_PROOF.md): 24/24 labelled
browser/export cases pass, versus 19/24 on the original implementation; all
70 selected fields across ten live pages agree with independent HTTP/HTML
captures. The source/rendered extraction mismatch is corrected and comparisons
across different extraction methods withhold text deltas. Final corrected-source
verification passes 1,510 tests/91 files and unchanged coverage gates (S90.88%,
B80.05%, F94.21%, L92.20%). The subsequent unpublished candidate and provenance
are under `reports/release-candidates/geo-reliability-proof/`. Earlier receipts
below retain their original revisions and counts. These checks do not establish
factual-quality or predictive citation accuracy.

| Gate                       | Evidence                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full suite                 | 1,488 tests across 91 files pass, including unit, integration, and browser tests.                                                                                                                                                                       |
| Existing coverage minimums | Statements 90.85%, branches 80.00%, functions 94.05%, lines 92.17%; the coverage command exits successfully. Thresholds and exclusions are unchanged.                                                                                                   |
| Static checks              | ESLint, source Prettier checks, TypeScript, build, isolated XLSX conversion/dependencies/notices, and all 390 documented CLI switches pass.                                                                                                             |
| Dependency security        | JavaScript audit reports no known vulnerabilities. Rust audit scans 352 locked dependencies successfully. Hosted Security Scan, including CodeQL, passes.                                                                                               |
| Rust                       | Locked workspace tests pass: four engine tests, nine TUI tests, and one engine doctest. Both release binaries build; interactive Linux TUI startup and Escape exit were exercised.                                                                      |
| Native packages            | Linux x64/ARM64, macOS x64/ARM64, and Windows x64 build, pack, install, verify binary integrity, and pass startup and offline fast-engine checks on supported runners. Linux ARM now uses an ARM runner; macOS x64 can use Rosetta on the macOS runner. |
| Root package               | A clean install loads 348 exports, renders privacy-preserving SDK evidence, runs CLI help/version/offline analysis, serves matching API health/OpenAPI versions, and initializes MCP at 0.2.0. Tested locally on Node 22 and in hosted CI on Node 20.   |
| Review bundle              | 82 recorded files pass size and SHA-256 verification. All 24 HTML pages pass offline browser checks at widths 1440 and 390 (48 checks); no page errors or document overflow. Overview screenshots were inspected.                                       |

The local branch coverage numerator is 26,246 of 32,804 outcomes. The 80% gate is
now satisfied with little margin; feature additions must preserve it.

Hosted verification of the engineering sources:

- [CI, including clean root consumer](https://github.com/Ru1vly/Aviary/actions/runs/37256164214)
- [Five-platform native packages](https://github.com/Ru1vly/Aviary/actions/runs/37256164375)
- [Current PR checks, including the CodeQL alert evaluation](https://github.com/Ru1vly/Aviary/pull/10/checks)

## Corrections made during finalization

The prompt-similarity summary CSV now retains the blank shared-provider field,
keeping counts, caps, and interpretation under the correct headers. Monthly and
review-queue HTML tables determine optional columns from retained row evidence
and preserve a placeholder when individual rows lack a value. Older saved reports
therefore retain aligned tables when summary-level owned-citation metrics are absent.

New tests exercise incomplete citation lists, capped catalogs, missing optional
fields, zero versus unknown metrics, statistical thresholds, audit/crawler joins,
privacy, escaping, named-column exports, and file aliases that could overwrite input.

Native validation is shared by release and unpublished pull-request workflows.
Each native candidate is packed and installed before smoke testing its installed
binaries. The TUI guard now rejects missing dynamic loaders and unexpected exits;
its earlier emulator-loader false positive was found and corrected. The TUI's
full-audit label no longer embeds a stale category count.

CodeQL alert evaluation is checked separately from successful scanner execution.
The verification code uses an exact hostname boundary and a literal OpenAPI
version line, avoiding incomplete suffix checks and unnecessary regex construction.

CI retains an unpublished root candidate and its consumer verification. Tagged
releases repeat this consumer check before any publication job can start.

## Local review artifacts

Generated artifacts remain ignored by Git and excluded from npm packages:

- `reports/release-candidates/0.2.0-final-verification/`: root tarball, pack manifest,
  source provenance, documentation-link audit, SHA-256 manifest, and consumer results.
- `reports/release-candidates/native-platform-verification/`: five downloaded native
  package artifacts with package manifests and SHA-256 files.
- `reports/finalization/review-bundle/`: synthetic answer/crawler review bundle,
  including its overview, manifest, and browser-layout audit.
- `reports/finalization/overview-1440.png` and `overview-390.png`: visual inspection.

Two fresh builds with identical packaged sources produce the same root digest:
`d917dcadacecfc38a95d861072ba0951d41c0c7dcfd86cae17be77b8fdf17e5f`.
The authoritative source revision for each archive is in its `provenance.json`.

Repeatable verification from a clean committed checkout:

```sh
pnpm test:coverage --maxWorkers=2
pnpm pack:candidate -- 0.2.0 reports/release-candidates/0.2.0-review
node scripts/check-release-candidate.js reports/release-candidates/0.2.0-review/ru1vly-aviary-0.2.0.tgz
```

To verify a matching local native build, use
`node scripts/check-native-package.js linux-x64 target/release 0.2.0`, then pass
that generated native tarball as the second argument to the root consumer checker.
The native workflow repeats the corresponding check for all five targets.

## Public release dependencies

**0.2.0 has not been published.** The 2026-10-05 registry check lists root versions
0.1.0, 0.1.1, and 1.0.0. The existing remote `v0.2.0` tag still points to
`dc57984138b1156c461fbec0ffb04eafbdbadeec`, which predates this finalization. It
was not moved, and no publication was attempted.

The configured npm session returns `E403` when npm 11.15.0 tries to read the root
trusted-publisher settings. This does not establish whether a publisher entry is
configured. A maintainer session must verify a GitHub Actions trusted publisher
for `Ru1vly/Aviary`, workflow `release.yml`, on the root and all five native packages.
The workflow currently specifies no GitHub environment. Use npm's
[trusted-publisher guide](https://docs.npmjs.com/trusted-publishers/) for account setup.

Before declaring a public release complete, approve and integrate the reviewed
candidate, verify those publisher entries, resolve the old tag against the reviewed
release commit, and confirm the tagged release and published-package checks succeed.
Engineering validation and public publication are separate states; the checks above
do not claim registry authentication has succeeded.

The previously documented mistaken 1.0.0 versions and website/social-artwork
follow-up remain separate maintenance work. No version was removed or website
changed during this repository finalization.

Pre-finalization measurements and the earlier registry-cleanup and website handoff
remain in the [previous readiness record](https://github.com/Ru1vly/Aviary/blob/1b89ab8b96a29945a9874d1d723ec2c0e194726d/RELEASE_READINESS.md).
