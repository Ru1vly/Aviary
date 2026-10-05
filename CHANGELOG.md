# Changelog

Notable changes to Aviary are documented here.

## 0.2.1

### Added

- GEO review workflows for answer-citation observations, crawler policies and logs, sitewide audits, cross-host parity, and per-page opportunities.
- Comparative GEO analysis for provider source portfolios, source diversity, citation networks, source categories, and Google AI/Search Console signals.
- Prompt-panel comparability, citation-repeatability analysis, prompt-family sensitivity, and capture planning with optional fail-closed gates.
- API and MCP interfaces, typed API client support, health and OpenAPI endpoints, and JSON Schemas for audit and GEO reports.
- Offline JSON, CSV, Markdown, HTML, and PDF reporting, with runnable and clearly labelled synthetic fixtures for the multi-stage GEO workflows.

### Improved

- Retain valid three-decimal Bing citation shares, including rows where share is the only metric; run macOS x64 native validation on an Intel runner and keep hard-link test coverage independent of Windows symlink privileges.

- Consolidate release handoffs and GEO evidence into canonical guides; shorten the README, separate CLI/SDK references, remove duplicate API sections and unsupported accuracy estimates.
- Publish the exact checksum-verified root and native tarballs from consumer validation, with provenance and OIDC/token authentication support.
- Pin Linux CI runners to Ubuntu 24.04 and use Node 22 for validation. Preserve all existing quality and coverage gates.

- Compare source and rendered GEO text with consistent DOM boundaries, preserving inline split words and excluding hidden rendered additions; avoid false client-content gaps from mixing textContent and innerText. Preserve the extraction method in sitewide JSON and withhold text deltas across different methods.

- Keep monthly and review-queue dashboard columns aligned when older saved reports omit summary or per-row owned-citation metrics.
- Keep the prompt-similarity summary CSV aligned with its shared-provider, document-count, threshold, and truncation headers.
- Reject missing dynamic loaders and unexpected native TUI startup failures; validate Linux ARM binaries on an ARM runner.
- Validate native artifacts through packed npm candidates, isolated installs, binary integrity checks, and startup on all five supported targets before publication; the same matrix can run on pull requests.

- Preserve unknown category and owned-source absence when captured citation lists are incomplete or legacy completeness metadata is missing; disclose these states in prompt coverage/detail CSV exports and suppress complete-comparison claims.

- Report the installed package version in the MCP handshake instead of a fixed historical version.

- Handle API help/version flags without starting a listener, and reject unsupported arguments before loading server configuration.

- Align source-category prompt-coverage CSV rows with their headers by retaining exactly one truncation flag and the evidence note.

- Give each monthly provider rank bucket a distinct owned-share CSV header so named-column consumers retain all six metrics.

- Remove three duplicated metric columns from monthly answer-length CSV exports, keeping unique named fields and aligned rows.

- Bundle the XLSX workbook reader with its audited dependencies and third-party notices so consumer installations retain security fixes.

- Preserve empty CSV fields across audit, Google AI, Google surface matrix, and platform matrix reports while retaining spreadsheet formula protection.
- Correct empty Google overview comparison table alignment.

- Corrected missing CSV headers and row alignment in source-diversity, source-portfolio, and provider-network comparison reports so their offline dashboards render the intended data.
- Added the missing header row to paired answer-citation page reach CSV exports, restoring the typed JSON renderer that reads those exports.
- Added the missing header row to provider source-divergence CSV exports so consumers can map metrics by column name.
- Added the missing header row to owned-source network-gap CSV exports, including its no-owned-domain summary.
- Removed embedded HTTP(S) URL credentials from cross-platform matrix CSV and HTML output, including searchable page data.
- Made the native fast engine handle `--help` locally, reject unknown options, and added a per-platform release smoke check that never needs a network request.
- Hardened report rendering and exports against unsafe HTML, spreadsheet formulas, and hostile labels.
- Clarified what Aviary scores measure, how GEO evidence should be interpreted, what data leaves the process, and the API's outbound-network boundary.
- Updated Rust and JavaScript dependencies, pinned the pnpm toolchain, and prepared optional per-platform native packages for release automation.
- Added a SHA-256 manifest to GitHub Release assets so downloaded native binaries can be checked against their published digests.
