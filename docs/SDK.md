# Node.js SDK and MCP

Import the `SEOChecker` class to run checks programmatically within your Node.js application:

```typescript
import { SEOChecker } from '@ru1vly/aviary';

async function runAudit() {
  const checker = new SEOChecker({
    url: 'https://example.com',
    headless: true,
  });

  const report = await checker.check();
  console.log(`Overall SEO Score: ${report.score}/100`);
  console.log(`Passed: ${report.summary.passed}/${report.summary.total} checks`);
}

runAudit();
```

For a bounded parallel run over a list of pages, use `auditUrls`. Results stay in input order;
individual URL failures are returned alongside successful reports, and concurrency defaults to 2
(maximum 8). Each worker reuses its browser across assigned pages to avoid relaunching Chromium
for every URL. Pass `onProgress` to receive completion-order updates; the returned results remain
in input order:

```typescript
import { auditUrls } from '@ru1vly/aviary';

async function auditPages() {
  const batch = await auditUrls(
    ['https://example.com/', 'https://example.com/about'],
    { concurrency: 2, categories: ['metaTags', 'accessibility'] }
  );

  console.log(batch.summary);
  for (const result of batch.results) {
    if (result.status === 'error') console.error(result.url, result.error);
  }
}

auditPages();
```

Pass an `AbortSignal` to `auditUrls` or `SEOChecker` to stop active page audits. Active pages close, and URLs that have not started are returned as error outcomes with a cancellation message:

```typescript
import { auditUrls } from '@ru1vly/aviary';

async function cancelLongAudit() {
  const controller = new AbortController();
  const stopAfter = setTimeout(() => controller.abort(), 30_000);
  try {
    const batch = await auditUrls(['https://example.com/', 'https://example.com/about'], {
      concurrency: 2,
      signal: controller.signal,
    });
    console.log(`${batch.summary.completedUrls} completed, ${batch.summary.failedUrls} failed or cancelled`);
  } finally {
    clearTimeout(stopAfter);
  }
}

void cancelLongAudit();
```

For periodic monitoring, `watchUrls` waits until each batch is complete before starting the next one. The interval is an idle delay after a completed batch, so runs never overlap. Abort the signal to stop after the active batch; `onAudit` can append each result to JSONL history:

```typescript
import { appendSEOAuditBatchHistory, watchUrls } from '@ru1vly/aviary';

async function monitorPages() {
  const controller = new AbortController();
  const stopTimer = setTimeout(() => controller.abort(), 60 * 60 * 1000);
  try {
    await watchUrls(['https://example.com/'], {
      intervalMs: 5 * 60 * 1000,
      signal: controller.signal,
      onAudit: (batch) => appendSEOAuditBatchHistory(batch, './reports/history.jsonl'),
    });
  } finally {
    clearTimeout(stopTimer);
  }
}

void monitorPages();
```

Pass an async URL provider to refresh the collection before every batch—for example, to rediscover pages from a sitemap:

```typescript
import { appendSEOAuditBatchHistory, createSitemapDiscoveryCache, discoverSitemapUrls, watchUrls } from '@ru1vly/aviary';

const sitemapCache = createSitemapDiscoveryCache();

async function monitorSitemap() {
  await watchUrls(() => discoverSitemapUrls('https://example.com/sitemap.xml', { cache: sitemapCache }), {
    intervalMs: 5 * 60 * 1000,
    onAudit: (batch) => appendSEOAuditBatchHistory(batch, './reports/history.jsonl'),
  });
}

void monitorSitemap();
```

---

## Model Context Protocol (MCP) Server

Aviary includes a built-in Model Context Protocol (MCP) server that exposes real-browser SEO auditing tools directly to AI coding agents (Claude Desktop, Cursor, Windsurf, Antigravity, etc.).

The server communicates via standard I/O (`stdio`) and provides three registered tools:

| Tool | Parameters | Description |
|---|---|---|
| `seo_audit` | `url`, `preset?` (`basic`\|`advanced`\|`strict`\|`geo`), `categories?`, `settleAfterNavigationMs?` (0–30000) | SEO audit returning structured results for enabled categories; `geo` runs only AI discoverability checks. The settle delay defaults to 1000 ms and is echoed in the report. |
| `seo_score` | `url`, `settleAfterNavigationMs?` (0–30000) | Quick audit returning overall score (0-100), letter grade (`A`-`F`), pass/fail counts, and capture timing. |
| `seo_check_category` | `url`, `category`, `settleAfterNavigationMs?` (0–30000) | Targeted category checks with capture timing in the result. |

### Running the MCP Server

```bash
# Via binary entry point
aviary-mcp

# Or via npx
npx --package @ru1vly/aviary aviary-mcp

# Or directly from source/monorepo
pnpm run mcp-server
```

### Agent Configuration (`claude_desktop_config.json` / MCP Settings)

```json
{
  "mcpServers": {
    "aviary": {
      "command": "npx",
      "args": ["-y", "--package", "@ru1vly/aviary", "aviary-mcp"]
    }
  }
}
```

---

For the REST server and typed HTTP client, see [API](API.md). For measurement scope, see [accuracy](ACCURACY_LIMITATIONS.md).
