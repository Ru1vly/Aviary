# Error Handling System

Error handling infrastructure for network-request-heavy checkers. Used today
by `checkers/robotsTxt.ts` — this is intentionally a small, focused module,
not a general-purpose framework: everything here has at least one real
caller, kept that way deliberately after a slimdown that removed roughly
half the module (a circuit breaker, seven near-duplicate graceful-degradation
wrapper functions, six unused `CheckerErrorHandler` methods, an unused error
subclass, and an entire never-enabled file-logging path) that had zero
callers anywhere in the codebase.

## Features

- **Custom error types** — categorized errors (Network, Browser, Configuration, Timeout)
- **Retry with backoff** — exponential backoff with jitter for transient failures
- **Error logging** — structured logging to stderr (never stdout — see below)
- **Graceful degradation** — a failing check degrades to one failed/passed result instead of throwing

## Architecture

```
errors/
├── types.ts           # Custom error classes and categorization
├── retry.ts           # Retry logic with exponential backoff
├── logger.ts          # Error logging (stderr only)
├── graceful.ts         # Graceful degradation (withGracefulDegradation)
├── checkerHelpers.ts   # CheckerErrorHandler — the class checkers actually use
└── index.ts            # Public API exports
```

## Why stderr, never stdout

`aviary --json` writes exactly one thing to stdout: the JSON report. If
anything else — a log line, a retry notice — writes to stdout first, it
corrupts that output for any script or pipe consuming it. `ErrorLogger`
therefore writes every level to `process.stderr`, matching the fix applied
to `src/config/logger.ts` for the same reason. If you add a new log call
here, it must go through `ErrorLogger`, not `console.log`.

## Quick Start

### Basic usage in a checker

```typescript
import { CheckerErrorHandler } from '../errors/index.js';

export class MyChecker {
  private errorHandler: CheckerErrorHandler;

  constructor(private page: Page) {
    this.errorHandler = new CheckerErrorHandler(page, 'MyChecker');
  }

  async checkSomething(): Promise<SEOCheckResult> {
    return this.errorHandler.executeCheck(async () => {
      // Your check logic here — a thrown error degrades to one failed
      // result instead of propagating.
      return { passed: true, message: 'Check passed' };
    }, 'checkSomething');
  }
}
```

### Network requests with retry

```typescript
const response = await this.errorHandler.fetchWithRetry(
  'https://example.com/robots.txt',
  'checkRobotsTxt',
  { maxAttempts: 3, initialDelay: 1000 }
);
```

### Calling retry() / withGracefulDegradation() directly

```typescript
import { retry, withGracefulDegradation } from '../errors/index.js';

const result = await retry(
  async () => fetch('https://api.example.com/data'),
  { maxAttempts: 5, initialDelay: 500, maxDelay: 10000, backoffMultiplier: 2 }
);

const checkResult = await withGracefulDegradation(
  async () => { /* check that might fail */ },
  'myCheckName',
  { passOnError: true, includeErrorDetails: true }
);
```

## Error Types

All errors extend `SEOCheckerError` with rich context:

```typescript
import { NetworkError, BrowserError } from '../errors/index.js';

throw new NetworkError('Failed to fetch robots.txt', {
  url: 'https://example.com/robots.txt',
  severity: ErrorSeverity.ERROR,
});

throw new BrowserError('Page failed to load', {
  checkName: 'navigationCheck',
});
```

Every error's `context` includes `timestamp`, `category` (NETWORK, BROWSER,
CONFIGURATION, TIMEOUT, UNKNOWN), `severity` (CRITICAL, ERROR, WARNING,
INFO — internal, uppercase; see below), `url`, `checkName`, `retryCount`,
`stackTrace`, and `metadata`.

### Severity: two different scales, on purpose

`ErrorSeverity` (this module) and `RuleSeverity` (`src/types/index.ts`,
what actually appears on an `SEOCheckResult` in the report) are deliberately
different types — uppercase 4-level internal severity for logging/retry
decisions, lowercase 3-level (`'error' | 'warning' | 'info'`) for the
report. `graceful.ts`'s `errorSeverityToRuleSeverity()` is the one place
that converts between them. Previously `withGracefulDegradation` skipped
that conversion and wrote an `ErrorSeverity` value straight into a
`RuleSeverity`-typed field (papered over with an `as unknown as T` cast),
so a degraded result's severity could never match `reporter.ts`'s
case-sensitive `=== 'error'` check and silently rendered with no badge.
If you touch this function, keep going through the converter.

## Retry

Exponential backoff with jitter:

```typescript
import { retry, RetryOptions } from '../errors/index.js';

const options: RetryOptions = {
  maxAttempts: 3,       // Maximum retry attempts
  initialDelay: 1000,   // Initial delay (1 second)
  maxDelay: 10000,      // Maximum delay (10 seconds)
  backoffMultiplier: 2, // Doubles each time
  jitter: true,         // Add random jitter (0-25%)
};

await retry(async () => { /* your logic */ }, options);
```

**Retry schedule example:** attempt 1 immediate, attempt 2 ~1000ms, attempt
3 ~2000ms, attempt 4 ~4000ms.

There is no circuit breaker. One existed here but was never called from
anywhere in the codebase; deleted along with the module's other dead code
rather than kept "for later." If retry storms become a real problem for a
specific checker, add one scoped to that problem, tested against it.

## Graceful Degradation

```typescript
import { withGracefulDegradation } from '../errors/index.js';

const result = await withGracefulDegradation(
  async () => { /* check logic that might fail */ },
  'checkName',
  {
    passOnError: true,          // Mark as passed if it fails (default)
    includeErrorDetails: true,  // Include error text in the message
    messagePrefix: 'Check skipped',
    logError: true,             // Log the error
    logSeverity: ErrorSeverity.WARNING,
  }
);
```

This is the only wrapper in the module. Batch/parallel/fallback/timeout/
safe-execute variants existed previously but had no callers; if you need
one of those shapes again, write it against the actual call site that
needs it rather than restoring the general-purpose version speculatively.

## `CheckerErrorHandler`

The class checkers actually construct. Three methods, all with real
callers in `robotsTxt.ts`:

- `executeCheck(checkFn, checkName, options?)` — runs a check through `withGracefulDegradation`.
- `fetchWithRetry(url, checkName, options?)` — `page.context().request.get(url)` wrapped in `executeNetworkRequest`.
- `executeNetworkRequest(requestFn, checkName, options?)` — the retry + error-categorization primitive `fetchWithRetry` is built on; call it directly if you need retry around something other than a GET.

`executePageEvaluation`, `executeChecksParallel`, `navigateWithRetry`,
`createSkippedResult`, `createFailedResult`, and `wrapCheckerMethod`
existed previously with zero callers anywhere and were removed. Add one
back only against a checker that actually needs it.

## Testing

`tests/unit/robotsTxt.test.ts` covers this module through its one real
consumer — `executeCheck`, `fetchWithRetry`, and the graceful-degradation
severity conversion above are all exercised there, including a regression
test for the severity-casing bug. There is no separate `errors/`-only test
suite; add one if a second checker starts using this module and the
coverage through `robotsTxt.ts` alone stops being representative.

## Adopting this in another checker

```typescript
export class MyChecker {
  private errorHandler: CheckerErrorHandler;

  constructor(private page: Page) {
    this.errorHandler = new CheckerErrorHandler(page, 'MyChecker');
  }

  async checkSomething(): Promise<SEOCheckResult> {
    return this.errorHandler.executeCheck(async () => {
      const response = await this.errorHandler.fetchWithRetry(
        url,
        'checkSomething',
        { maxAttempts: 3 }
      );
      // process response, return a SEOCheckResult
    }, 'checkSomething');
  }
}
```

This template fits checkers whose checks are single-URL fetches (like
`robotsTxt.ts`, `sitemap.ts`). Most other checkers are dominated by
`page.evaluate()` DOM inspection instead, where retry semantics built for
transient network failures don't apply as directly — for those,
`executeCheck` alone (without `fetchWithRetry`) is still worth adopting
for the try/catch-to-degraded-result behavior; the network-retry pieces
just won't be relevant.
