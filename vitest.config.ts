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
        'tests/setup.ts',
        'tests/mocks/**',
      ],
      // TODO(coverage-ratchet): actual coverage today is ~44% statements /
      // 32% branches / 39% functions / 46% lines (reporter.ts, config/loader.ts,
      // and src/errors/** are the biggest gaps). These thresholds are set just
      // below that baseline so CI is an honest, real gate against regression
      // instead of permanently red. Raise them incrementally as coverage is
      // added — the target is 80% across the board.
      thresholds: {
        lines: 44,
        functions: 38,
        branches: 31,
        statements: 43,
      },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    testTimeout: 90000,
    hookTimeout: 90000,
  },
});

