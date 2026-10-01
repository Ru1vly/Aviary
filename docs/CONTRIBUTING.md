# Contributing to Aviary

Thanks for helping improve Aviary. This guide covers the local setup, the main parts of the repository, and what to include with a change.

## Set up the project

Aviary requires Node.js 20 or newer. The repository pins pnpm 10.34.6 in `package.json`. Use that version to keep installs aligned with CI and the lockfile. Install dependencies and the Playwright browser:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Some Linux environments also need Chromium's system libraries:

```sh
pnpm exec playwright install chromium --with-deps
```

## Run the relevant checks

Use the narrowest checks that cover your change, then run the full suite when practical:

```sh
pnpm run build:ts
pnpm run check:cli-docs
pnpm run lint
pnpm run format:check
pnpm test
```

The Vitest suites are under `tests/unit`, `tests/integration`, `tests/e2e`, and `tests/benchmarks`. Browser-backed tests need Playwright Chromium. The README's [accuracy and scope notes](./ACCURACY_LIMITATIONS.md) describe which measurements are lab data or heuristics.

The Rust static engine and terminal UI live in `engine/` and `tui/`. Use the Rust toolchain and the workspace's Cargo commands when changing those packages. Keep changes scoped to the relevant implementation rather than modifying generated `dist/`, `target/`, or platform binary files.

## Where code belongs

- `src/checkers/` contains the page-level SEO and accessibility checks. Shared DOM, text, URL, and sitemap helpers belong in `src/checkers/shared/` or another focused utility module.
- `src/index.ts` exposes the public audit API and runs bounded URL batches.
- `src/reporter.ts` renders JSON-backed HTML, PDF, JUnit, SARIF, Markdown, and CSV artifacts.
- `src/api/` contains the REST server and typed client. Keep endpoint behavior, `docs/openapi.yaml`, and `docs/API.md` in sync.
- `src/config/` owns configuration parsing and defaults; update `examples/CONFIG.md` when public settings change.
- `src/mcp/` implements the Model Context Protocol server.

Prefer small helpers with explicit bounds for network, file, and browser work. Preserve the existing public report shape unless a change requires a documented API adjustment.

## Prepare a change

Before opening a pull request:

1. Describe the user-visible behavior and the reason for the change.
2. Add or update focused tests for changed behavior, including boundary cases and error paths.
3. Update the README or the relevant guide when commands, options, outputs, or public APIs change.
4. Update the OpenAPI contract when a REST request, response, status code, or event changes.
5. Report the commands you ran and any checks you could not run.

Use local fixtures or deterministic mocks for tests where possible. Do not commit API keys, cookies, private audit reports, or site-specific credentials. For an audit that uses a real URL, make sure the site is one you are allowed to inspect.

## Pull requests and issues

Keep pull requests focused and include enough context to review the behavior. For a report or dashboard change, include a representative screenshot or sample output when it clarifies the result. For a bug report, include the Aviary version, Node.js version, command or API request, observed result, expected result, and a sanitized error message or report excerpt.

Be considerate in review discussions. Explain tradeoffs plainly, and keep user-facing wording consistent with the README and existing reports.
