# Data handling and privacy

This page describes Aviary's current default behavior. It is not a privacy notice for an application audited with Aviary, and it is not legal or regulatory advice.

## Default local audits

Aviary has no built-in usage analytics, crash-reporting service, or telemetry upload to its maintainers. A normal CLI audit runs on the machine that launches it. It sends requests to the target site using Chromium or the Rust fast-path fetcher; the target site and resources loaded by its page can observe those requests in their own logs. The browser may execute scripts on the target page, including scripts that request third-party resources, as part of rendering.

Audit results are printed or written to the paths selected by the operator. Reports can contain target URLs, page metadata, content-derived measurements, and check details; treat them as sensitive when the audited pages are private or contain personal or business information. History files and report directories remain until the operator removes them. Aviary does not upload those files.

## API server and metrics

The optional REST API binds to `127.0.0.1` by default. It retains job status and results in process memory under configured job-count and retention limits; it does not use a remote database by default. Restarting the process discards that in-memory state. Any client allowed to submit an audit can cause the server to visit the submitted URLs, so keep remote API access limited to trusted operators and use outbound network controls when needed. See the [API guide](./API.md#start-the-server) for authentication, TLS, and target-network guidance.

The CLI starts a Prometheus `/metrics` endpoint on `127.0.0.1` while it runs (port `9090` by default, configurable with `AVIARY_METRICS_PORT`). It exposes local process metrics and does not push them to a third party. A port conflict disables metrics but does not stop the audit. Keep it local unless the deployment adds its own authenticated monitoring layer.

## Optional semantic analysis

The semantic analyzer defaults to a stub and makes no model request. If `AVIARY_LLM_PROVIDER=ollama` is selected, Aviary sends the page title, description, and up to 4,000 UTF-8 bytes of body text to `AVIARY_LLM_ENDPOINT` (default `http://localhost:11434`) for analysis. The endpoint may be changed to a remote host; in that case the configured service receives this page content. The current Rust analyzer does not use `AVIARY_LLM_API_KEY`; unsupported provider names fall back to the stub. Review endpoint ownership and data-retention terms before configuring a remote service.

## Downloads and updates

Package installation uses the configured package registry. If the Playwright Chromium executable is missing, Aviary's CLI can attempt to download it; set `AVIARY_SKIP_BROWSER_INSTALL=true` to disable that automatic fallback. These downloads are software installation traffic, not audit-result uploads.

## Operator checklist

- Store private reports, URL inventories, audit history, and access logs according to your organization's retention rules.
- Keep API keys and TLS private keys outside committed configuration files.
- Restrict remote API clients and the API host's outbound network access to the targets those clients are allowed to audit.
- Use the default stub or a locally operated Ollama service when page content must not be sent to an external model endpoint.
