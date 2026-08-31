import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        'examples/',
        'vitest.config.ts',
        'tests/mocks/**',
        // Real regression coverage, but via tsx subprocess (cli.test.ts,
        // worker.test.ts, mcpServer.test.ts) since each starts a listener
        // on import — v8's coverage instrumentation can't see across that
        // process boundary. Excluded here so that real, structural gap
        // doesn't masquerade as an untested-code gap in the aggregate.
        'src/cli.ts',
        'src/worker.ts',
        'src/mcp/server.ts',
      ],
      // Phase 10 (coverage-to-80%): reached by (a) writing dedicated
      // happy-dom-backed unit tests for every previously zero/low-coverage
      // checker — critically, through tests/mocks/mockPage.ts, not a real
      // Playwright/Chromium page: real page.evaluate() bodies run in a
      // separate browser process invisible to v8's Node-side coverage, so
      // the pre-existing real-browser tests in checkers.test.ts (kept, since
      // they're valid behavioral coverage) contributed almost nothing to
      // these numbers — and (b) excluding the three subprocess-only files
      // above. Real baseline as of this ratchet: ~94% statements / 84%
      // branches / 96% functions / 95% lines — thresholds set with headroom
      // below that so the gate is honest without being flaky on minor drift.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    testTimeout: 90000,
    hookTimeout: 90000,
  },
});

