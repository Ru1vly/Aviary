# Changelog

Notable changes to Aviary are documented here.

## 0.2.0

### Added

- GEO review workflows for answer-citation observations, crawler policies and logs, sitewide audits, cross-host parity, and per-page opportunities.
- Comparative GEO analysis for provider source portfolios, source diversity, citation networks, source categories, and Google AI/Search Console signals.
- Prompt-panel comparability, citation-repeatability analysis, prompt-family sensitivity, and capture planning with optional fail-closed gates.
- API and MCP interfaces, typed API client support, health and OpenAPI endpoints, and JSON Schemas for audit and GEO reports.
- Offline JSON, CSV, Markdown, HTML, and PDF reporting, with runnable and clearly labelled synthetic fixtures for the multi-stage GEO workflows.

### Improved

- Corrected missing CSV headers and row alignment in source-diversity, source-portfolio, and provider-network comparison reports so their offline dashboards render the intended data.
- Added the missing header row to paired answer-citation page reach CSV exports, restoring the typed JSON renderer that reads those exports.
- Hardened report rendering and exports against unsafe HTML, spreadsheet formulas, and hostile labels.
- Clarified what Aviary scores measure, how GEO evidence should be interpreted, what data leaves the process, and the API's outbound-network boundary.
- Updated Rust and JavaScript dependencies, pinned the pnpm toolchain, and prepared optional per-platform native packages for release automation.
- Added a SHA-256 manifest to GitHub Release assets so downloaded native binaries can be checked against their published digests.
