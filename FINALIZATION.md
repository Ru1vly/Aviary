# Aviary 0.2.0 finalization

Reviewed 2026-10-05. The product has reached a validated, unpublished 0.2.0
candidate after release-candidate hardening. Its existing
browser SEO/GEO audits, saved-report workflows, citation and crawler analyses,
CLI, API, MCP, and native terminal tools are implemented. New feature work is
frozen for this release. `TODO.md` remains the future roadmap, not a requirement
to implement every proposed integration before shipping.

## Definition of finalized

1. Existing supported workflows preserve honest evidence denominators, incomplete
   and unknown states, privacy, escaping, and aligned exports. Saved reports with
   absent optional fields remain usable.
2. The full unit, integration, and browser suites pass. Global statement, line,
   function, and branch coverage each meet the existing 80% minimum. No reduced
   thresholds, added coverage exclusions, or assertion-free coverage exercises.
3. Lint, formatting, TypeScript, compiled XLSX isolation, CLI documentation,
   dependency security checks, and locked Rust checks pass on the final sources.
4. A reproducible unpublished 0.2.0 candidate has consistent CLI/API/MCP/OpenAPI
   and optional-package versions, shipped documentation, checksums, and source
   provenance. A clean consumer install can run and render representative data.
5. Supported native packages build and pass their platform smoke checks. Release
   automation verifies artifacts before publication. Linux interactive startup
   and exit are exercised locally; other targets require their actual runners.
6. The readiness record states actual verification results and any external
   release dependencies. Public publication is distinct from local finalization;
   npm publisher authentication and the existing release tag must be resolved
   before a public release can be declared complete.
7. GEO output interpretations are checked against at least three independent
   authoritative sources. The source-derived browser/export validation passes,
   and factual quality and citation prediction are explicitly distinguished from
   measured controls. See [the output validation](docs/GEO_OUTPUT_VALIDATION.md).

## Starting evidence

The latest hosted CI run on `1b89ab8` passes 976 tests. Statements 81.95%, lines
83.44%, and functions 84.64% clear their gates; branches at 63.89% do not. Security
Scan succeeds. The historical handoff's 659-test snapshot predates these results.
The immediate engineering blocker is branch coverage, especially the large
citation exporter and crawler modules. Verification will focus on real sparse,
legacy, incomplete, capped, and malformed input contracts and statistical gates.

CI: https://github.com/Ru1vly/Aviary/actions/runs/37185354902

## Completion evidence — 2026-10-05

The frozen 0.2.0 candidate meets the engineering finish line:

| Requirement | Verification |
| --- | --- |
| Evidence and exports | 512 additional tests cover sparse, legacy, capped, incomplete, zero/unknown, privacy, join, gate, and export contracts. CSV summary and optional HTML-column defects are corrected. |
| Full suite and coverage | 1,488 tests / 91 files pass. Statements 90.85%, branches 80.00%, functions 94.05%, lines 92.17%. The unchanged coverage gate succeeds. |
| Static/security/Rust checks | Lint, source formatting, TypeScript build, XLSX isolation, 390 CLI switches, dependency audits, CodeQL, and locked workspace tests pass. |
| Reproducible candidate | Clean committed builds generate the same root SHA-256. Local Node 22 and hosted Node 20 consumer checks exercise CLI, SDK, API/OpenAPI, and MCP at 0.2.0. |
| Native targets | All five supported package builds, packed installs, integrity checks, and runtime smokes pass. Interactive Linux startup and Escape exit are verified. |
| Accurate readiness | [RELEASE_READINESS.md](RELEASE_READINESS.md) records passing runs and artifact paths, the unpublished registry state, the unchanged older tag, and npm's E403 publisher-inspection limit. |

The generated review bundle verifies 82 manifest files and 48 offline browser
layouts. The review changes are available in
[PR #10](https://github.com/Ru1vly/Aviary/pull/10).

The subsequent [GEO output-quality validation](docs/GEO_OUTPUT_VALIDATION.md)
adds a separate, source-derived semantic gate: 18 of 18 output cases pass after
three production interpretation errors were corrected. The resulting full suite
passes 1,503 tests, with statements 90.88%, branches 80.03%, functions 94.21%, and
lines 92.20%. These results do not establish content truth or citation prediction.

“Finalized” here is the validated, installable 0.2.0 candidate defined above.
Public release remains a distinct maintainer action with the authentication and
tag dependencies recorded in the readiness handoff.
