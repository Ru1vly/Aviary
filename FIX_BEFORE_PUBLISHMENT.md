# Fix Before Publishing to npm

Last reviewed: 2026-09-10

Do not create the `v1.0.0` tag until every release blocker below is resolved.

## Release blockers

### 1. Fix npm authentication

The latest `Bootstrap Platform Packages` workflow reached `npm publish` but failed with `EOTP`. The current `NPM_TOKEN` cannot publish non-interactively under the account's 2FA policy.

- For the initial package creation, use a granular npm access token with write access to the `@ru1vly` scope and **Bypass 2FA** enabled, or publish interactively with an OTP.
- Store the replacement token in the repository's `NPM_TOKEN` Actions secret.
- After the packages exist, configure npm trusted publishing for `.github/workflows/release.yml` and remove the long-lived publish token where possible.
- Give trusted-publishing jobs `id-token: write` and `contents: read`; keep broader permissions scoped only to jobs that need them.
- Trusted publishing requires npm 11.5.1 or newer and Node 22.14.0 or newer. Prefer Node 24 for publish jobs.

Relevant failed run: <https://github.com/Ru1vly/Aviary/actions/runs/34160500586>

### 2. Prevent the first tag from failing with `Version not changed`

The root package is already version `1.0.0`, while the release workflow runs:

```sh
npm version ${{ github.ref_name }} --no-git-tag-version
```

For tag `v1.0.0`, npm exits with `Version not changed`.

Preferred fix:

- Commit package versions before tagging.
- Replace the mutating `npm version` step with a check that the tag, root package version, platform package versions, and optional dependency versions all match.

Minimum fix:

```sh
npm version ${{ github.ref_name }} --no-git-tag-version --allow-same-version
```

### 3. Repair and freeze `pnpm-lock.yaml`

The five optional platform dependencies in `package.json` are absent from the root importer in `pnpm-lock.yaml`. A frozen install currently fails with `ERR_PNPM_OUTDATED_LOCKFILE`.

After the five platform packages have been bootstrapped on npm:

```sh
pnpm install --lockfile-only
pnpm install --frozen-lockfile
git add package.json pnpm-lock.yaml
```

Then replace every `pnpm install --no-frozen-lockfile` in CI and release workflows with:

```sh
pnpm install --frozen-lockfile
```

This also unblocks the Docker build and the Security Scan workflow.

Relevant failed run: <https://github.com/Ru1vly/Aviary/actions/runs/34160495932>

### 4. Correct the supported Node.js version

`package.json` declares Node `>=18.0.0`, but the required dependency `@modelcontextprotocol/server@2.0.0` requires Node `>=20`.

- Change `engines.node` to `>=20.0.0`.
- Document the Node 20 minimum in `README.md`.
- Test the package on the declared minimum version in CI.

## Security and reproducibility

### 5. Update vulnerable development dependencies

The 2026-09-10 audit found 10 development dependency advisories: 5 high and 5 moderate. The production dependency audit was clean.

- Refresh the lockfile after the platform packages are available.
- Run `pnpm audit --audit-level moderate` again.
- Update or override affected transitive versions until the audit is clean, or document any accepted exceptions.
- Remove `continue-on-error: true` from the Node and Rust audit steps if these scans are intended to gate releases.

Affected development paths currently include `brace-expansion`, `nanoid`, `postcss`, `qs`, `vitest`, and `@vitest/mocker`.

### 6. Pin the toolchain used for releases

- Add an exact package manager declaration to `package.json`, for example `"packageManager": "pnpm@9.15.9"`, or intentionally upgrade the repository and lockfile to a newer pnpm version.
- Pin the same exact pnpm version in all workflows and the Dockerfile rather than using only major version `9`.
- Add `--locked` to Cargo build commands in CI and release workflows.
- Remove the unused `tui/Cargo.lock`; the root `Cargo.lock` is the active lockfile for the Cargo workspace.
- Upgrade GitHub Actions that still use the deprecated Node 20 action runtime, and pin third-party actions to reviewed commit SHAs for stronger supply-chain protection.

### 7. Reduce release permissions and add provenance

- Default workflow permissions to `contents: read`.
- Grant `contents: write` only to the GitHub Release job.
- Grant `packages: write` only to the GHCR Docker job.
- Grant `id-token: write` only to npm trusted-publishing jobs.
- Publish npm packages with trusted publishing so npm creates provenance attestations automatically.
- Consider an npm deployment environment with required approval and protected release tags.

## Verification before tagging

Run these checks from a clean checkout using the same Node, pnpm, and Rust versions as CI:

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm exec tsc --noEmit
pnpm run test:coverage
pnpm audit --prod --audit-level moderate
cargo build --locked --release --target x86_64-unknown-linux-gnu \
  --package tui --package aviary-engine --bin tui --bin aviary-fast
npm pack --dry-run
```

Also verify:

- The five platform packages exist at version `1.0.0` on npm.
- The root package version and all optional dependency versions match the intended tag.
- `aviary --help` and the CommonJS library entry point work from the packed tarball.
- CI, Security Scan, and Bootstrap Platform Packages are green on `main`.
- The release workflow has access to the configured npm trusted publisher or valid publish credentials.
- The npm tarballs contain only the expected JavaScript, declarations, documentation, and platform binaries.

## Current verified positives

At the time of this review:

- Lint and TypeScript checks passed.
- All 378 tests across 34 files passed.
- Statement coverage was approximately 94%.
- The locked native Rust release build succeeded.
- The main npm tarball contained the expected library, type declarations, README, license, and CLI entry points.
- CommonJS import and `aviary --help` worked.
- The production dependency audit reported no known vulnerabilities.

## Publish sequence

1. Fix npm authentication for the initial platform-package publish.
2. Bootstrap all five platform packages at `1.0.0`.
3. Regenerate and commit `pnpm-lock.yaml`.
4. Restore frozen installs everywhere.
5. Fix release version handling and the Node engine declaration.
6. Address audit findings and release-workflow hardening.
7. Rerun CI, Security Scan, and the complete verification checklist.
8. Only then create and push the `v1.0.0` tag.
