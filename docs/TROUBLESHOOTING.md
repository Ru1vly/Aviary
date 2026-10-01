# Troubleshooting Aviary

## Run environment diagnostics

Run `aviary --doctor` to check the Node.js version, Playwright Chromium installation, environment values, and discovered Aviary configuration. Pass `--config path/to/aviary.yaml` to inspect a specific file, or add `--json` for structured output. The command does not launch a browser or start the metrics listener. It exits with status 1 when a required dependency or setting is invalid.

## Browser setup and page loading

### Playwright cannot find Chromium

Install Aviary's Playwright browser for the current machine:

```sh
pnpm exec playwright install chromium
```

On Linux runners, install browser system libraries too:

```sh
pnpm exec playwright install chromium --with-deps
```

Aviary tries to install Chromium automatically when it is missing. Set `AVIARY_SKIP_BROWSER_INSTALL=true` to disable that behavior in locked-down environments and install the browser in your image or CI setup instead.

### A page times out or never reaches a useful state

Increase the navigation timeout with `--timeout 60000` or `AVIARY_TIMEOUT=60000`. If the page relies on client-side rendering after navigation, increase the fixed settle delay with `--settle-ms 2000` or `AVIARY_SETTLE_AFTER_NAVIGATION_MS=2000`. If the page relies on a particular viewport, set it with `--viewport 375x667` or `AVIARY_VIEWPORT=375x667`. Try a single URL first to separate a page-specific issue from batch capacity or concurrency settings.

Some sites block automated browsers, require authentication, or render content only after user interaction. Aviary reports the browser-visible result it received; it does not bypass access controls.

## URL input, sitemap, and link discovery

### A URL-list glob matches no files

Quote the pattern so the shell passes it to Aviary unchanged:

```sh
aviary --urls 'url-lists/**/*.txt'
```

The glob supports `*`, `?`, and recursive `**`. It ignores hidden paths under wildcard segments, does not follow symlinks, and stops at 1,000 matched files, 100,000 visited entries, or 32 directory levels.

Each matched file must contain valid UTF-8 with one URL per line. Blank lines and lines beginning with `#` are ignored. The combined input is limited to 10,000 URLs and 25 MiB. Use `--urls -` to read one list from stdin; the same limits apply. An invalid byte sequence produces an explicit encoding error.

### Sitemap discovery reports an HTTP, origin, or size error

Sitemap requests must use HTTP or HTTPS and cannot redirect. Child sitemap files and page URLs from an index must remain on the root sitemap's origin. Each sitemap file is limited to 5 MiB before and after gzip decompression; index nesting is limited to four levels by default.

Use `--max-urls` to control the page count. If the sitemap server is slow, raise `--timeout`. For repeated `--watch` runs, Aviary rediscovers the sitemap and revalidates cached documents when the server provides ETag or Last-Modified headers.

### A link crawl misses pages

`--crawl` follows anchor and image-map area links in fetched HTML; it does not execute JavaScript or inspect forms. It honors `robots.txt` for the `AviaryBot` user-agent and omits blocked pages. Use a sitemap or explicit URL list for dynamic routes or a reviewed complete audit scope. Increase `--max-depth` when deeper pages are linked from reachable pages, and check the stderr progress lines for the URL and discovery count. If a single page exceeds its body limit, raise `--max-crawl-page-bytes` (up to 10 MiB). If the crawl reaches its aggregate HTML-body limit, raise `--max-crawl-bytes` (up to 1 GiB) or narrow the URL/depth scope. Off-origin links, `nofollow` links, non-HTML responses, and pages that time out are not used to discover more pages.

If `robots.txt` returns a 5xx response or cannot be reached, discovery stops and reports the policy error. A 4xx response is treated as an unavailable policy. Fix the site response or use a reviewed explicit URL list when the crawl should not depend on `robots.txt`.

### A batch report contains audit errors

An audit error means the page did not finish its browser checks; it is separate from failed SEO findings on pages that completed. The batch summary counts both. Reduce `--concurrency` if the machine or target site cannot sustain parallel browser pages, or rerun one failed URL by itself for a more focused error message.

## Reports and configuration

### A form field is flagged as missing a label

An associated non-empty `<label>`, a non-empty `aria-label`, a valid `aria-labelledby` reference, or an appropriate `title`/`alt` value can name a control. A placeholder by itself is not treated as a label because it disappears as users type and does not provide a persistent name.

### A security-header check reports a present header as misconfigured

The security check validates common values as well as presence: HSTS needs one positive `max-age`, `X-Content-Type-Options` must be `nosniff`, and the enforced CSP must contain directives. `X-Frame-Options` must be `DENY` or `SAMEORIGIN` unless a valid CSP includes `frame-ancestors`. A `Content-Security-Policy-Report-Only` header alone does not enforce restrictions. The report lists the invalid header and a short diagnostic.

### An external-link security finding appears

The link checker only reports opener-isolation issues for external links that open another browsing context. The HTML Standard gives `target="_blank"` implicit `noopener` behavior unless `rel="opener"` is present; named targets still need `rel="noopener"` or `rel="noreferrer"` to prevent an opener relationship. See the [HTML Standard](https://html.spec.whatwg.org/multipage/links.html#link-type-noopener).

### A duplicate-content report is empty

Exact content comparison requires the `content` category and at least 50 words on a page. Aviary normalizes Unicode, case, and whitespace before comparing SHA-256 fingerprints of visible text. Pages with more than 256,000 normalized characters are skipped; near-duplicates are not detected. Use `--fail-on-duplicate-content` in batch mode to make exact matches fail a CI run. The gate also fails if it cannot fingerprint a page with at least 50 words.

### PDF output fails

PDF export uses Playwright Chromium. Follow the browser setup instructions above, then try writing HTML first with `--html report.html` to confirm the audit report rendered successfully.

When using `--render` or `--history-report`, choose an output path that does not refer to the saved JSON or JSONL input. Aviary rejects output paths that alias the source file to protect the saved report. Each selected report format must also have its own output path.
History files are read one record at a time; a single JSONL record larger than 10 MiB is rejected with its line number.

### A configuration change appears to have no effect

Check that the selected file is valid JSON, YAML, or YML and that the checker key and rule name match `examples/CONFIG.md`. An explicit `--config` file takes precedence over `--preset`; without `--config`, a CLI preset takes precedence over a discovered config file.

If a checker is disabled in config or omitted from `--category`, that check will not produce a result. The default run executes the full checker registry with warning severity when no configuration file or preset is selected.

## REST API

### The API refuses to bind to a network interface

Remote listeners require all three settings: `AVIARY_API_HOST`, an API key of at least 24 characters, and a TLS certificate/private-key pair. The default loopback listener needs neither a key nor TLS. See [API reference](./API.md#start-the-server).

### Requests return `401`, `429`, or `503`

- `401`: Send `Authorization: Bearer <key>` when `AVIARY_API_KEY` is configured.
- `429`: The per-IP request limit was reached. Retry after the number of seconds in `Retry-After`.
- `503`: The audit queue, retained-job store, rate-limit table, or event-stream limit is full. Retry after the indicated delay or wait for an active job to finish.

### A running audit stays in progress after a cancellation request

The REST `DELETE /v1/audits/{id}` endpoint returns `202` for a running job while Aviary closes active browser pages and stops starting new URLs. Poll the job or follow its SSE stream until the status becomes `cancelled`. The final report contains completed page results and error outcomes for URLs that did not finish. Programmatic `auditUrls` calls use the same `AbortSignal` behavior.

## Accuracy and scope

Aviary's browser measurements and heuristic checks have limits. Review [`ACCURACY_LIMITATIONS.md`](./ACCURACY_LIMITATIONS.md) before treating lab values or predictive heatmaps as field measurements or rankings.
