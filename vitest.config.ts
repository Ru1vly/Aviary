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
      ],
      // TODO(coverage-ratchet): actual coverage after Phase 6's named test
      // additions (reporter.ts, presets.ts, MCP/cli.ts/worker.ts protocol
      // tests — run as subprocesses via tsx, so not reflected in these
      // numbers despite being real coverage) is ~63% statements / 47%
      // branches / 65% functions / 64% lines. The remaining gap to 80% is
      // almost entirely the ~20 checker files still in the 40-70% range
      // (accessibility.ts, links.ts, spamDetection.ts, heatmap.ts, ...) —
      // an open-ended per-checker test-writing effort well beyond what
      // Phase 6 named explicitly, so it's left for deliberate follow-up
      // rather than done partially here. Thresholds stay just below the
      // real baseline so CI is an honest gate against regression.
      thresholds: {
        lines: 64,
        functions: 64,
        branches: 46,
        statements: 62,
      },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    testTimeout: 90000,
    hookTimeout: 90000,
  },
});

