# Release guide

This is the single release checklist. Historical handoffs and completed task
lists are retained in Git history. User-facing changes belong in
[CHANGELOG](../CHANGELOG.md); measurement proof belongs in
[GEO validation](GEO_OUTPUT_VALIDATION.md).

## Definition of ready

A release must pass lint, source formatting, TypeScript compilation, the full
suite with all four existing 80% coverage gates, Node/Rust dependency audits,
CodeQL, XLSX isolation and CLI documentation checks. The actual root tarball
must pass documentation-link and clean-install CLI/SDK/API/MCP checks. Each
of the five native packages must pass integrity and installed-binary startup
checks on its target platform. A public release is complete only after registry
versions and a fresh published-package installation are verified.

## Check a committed candidate

Use Node.js 22 and the pnpm version pinned in package.json:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --with-deps
pnpm run lint
pnpm run format:check
pnpm exec tsc --noEmit
pnpm run build:ts
pnpm run check:xlsx-bundle
pnpm run check:cli-docs
pnpm run test:coverage --maxWorkers=2
node examples/geo-output-validation.mjs reports/geo-output-validation
pnpm audit --audit-level moderate
cargo audit
cargo test --workspace --locked
pnpm run pack:candidate -- 0.2.1 reports/release-candidates/0.2.1
node scripts/check-release-candidate.js reports/release-candidates/0.2.1/ru1vly-aviary-0.2.1.tgz
```

Packing requires a clean committed checkout and a fresh destination. It stamps
the chosen version into a temporary source snapshot, root optional dependencies
and bundled OpenAPI. It retains the source commit, pack manifest, documentation
link audit and SHA-256. Generated reports are ignored by Git.

Native checks use `scripts/check-native-package.js` and the shared
`.github/workflows/native-build.yml`. The PR validation workflow packs, installs
and starts the binaries on Linux x64/ARM64, macOS x64/ARM64 and Windows x64.

## Publish

Choose an unused tag. The older failed `v0.2.0` tag is retained; the next release
is `v0.2.1`. Root and native packages must use the same release version. The
checkout's optional dependency versions stay resolvable before publication;
the release stamp selects the new versions in published metadata.

After the PR's CI, security and native checks pass, merge it and tag that reviewed
commit. `.github/workflows/release.yml` repeats the gates, promotes the exact validated tarballs, publishes native
packages first, then the root package, container image and GitHub release assets.
Use npm trusted publishing for repository `Ru1vly/Aviary`, workflow `release.yml`
on all six packages. The publish jobs require Node 24, npm >=11.5.1 and
`id-token: write`. npm tries OIDC first; the existing `NPM_TOKEN` secret is a
fallback for token-authorized publishing. Both paths request provenance. See [npm's publisher setup](https://docs.npmjs.com/trusted-publishers/).

```sh
git tag -a v0.2.1 -m 'Aviary 0.2.1' <reviewed-commit>
git push origin v0.2.1
npm view @ru1vly/aviary@0.2.1 version dist.integrity
npm view @ru1vly/aviary dist-tags --json
```

If a runner was never allocated, rerun the failed job; do not weaken gates.
If a publish job fails, inspect authentication and registry state before retrying.
Published npm versions are immutable. Native jobs skip an already-published
version; the root preflight rejects one. Do not move a published tag to another
commit. Keep exact run URLs and package integrity in the release evidence.

## Remaining roadmap

Broader multi-domain GEO outcome validation, direct provider integrations,
page-result caching and internationalized reports are future work. They are
separate from the current release gates. Use issues for scoped follow-up work
instead of another chronological release-status document.
