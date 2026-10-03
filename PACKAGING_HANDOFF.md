# Aviary 0.2.0 packaging handoff

## Status

All current runtime fixes are packaged as an **unpublished 0.2.0 candidate**. Public release is pending the existing release gates; do not mark it published or move the old tag to force CI past them.

Latest full suite: 652 tests across 69 files pass. Coverage: statements 76.81%, branches 58.68%, functions 79.27%, lines 78.22%. The required 80% thresholds remain unchanged. Five additional crawler dashboard tests pass independently; no full rerun including these five has been performed.

Real installed CLI, MCP and REST reports against aviary-rs.com are retained under reports/, including desktop/mobile screenshots. Synthetic citation and crawler fixtures are identified separately. Scores describe implemented checks, not measured AI visibility.

## Package

Run `pnpm run pack:candidate -- 0.2.0` from a clean checkout. Each candidate includes the npm archive, SHA256SUMS, manifest, source provenance and documentation audit. Packaging rebuilds JavaScript, checks the isolated XLSX bundle and checks shipped relative documentation links.

The final handoff archive under reports/final contains the candidate, source snapshot, this handoff, release evidence and representative real report captures. Inspect SHA256SUMS before installation. Native binaries are distributed separately through optional platform packages and still need final release-matrix verification.

## Required next steps

1. Bring actual coverage to the existing 80% thresholds and run the full frozen-source suite and CI.
2. Validate npm trusted publishers for the root package and all five native packages, then complete the native build and install smoke matrix.
3. Resolve the existing v0.2.0 tag pointing to the older failed release commit deliberately, then run the authorized 0.2.0 release workflow and verify registry versions and consumer installation.
4. The mistaken npm 1.0.0 is deprecated. Previous removal returned E403 due to 2FA/token permissions. Retry only after authentication is corrected; it has not been removed.

No outstanding production changes were left uncommitted. RELEASE_READINESS.md records the chronological evidence and limitations.
