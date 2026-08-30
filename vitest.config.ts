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
      // TODO(coverage-ratchet): actual coverage after Phase 2 (mock hardening
      // + registry/BaseChecker tests) is ~55% statements / 40% branches / 47%
      // functions / 57% lines. reporter.ts (still ~1.5%) and the 27 checkers
      // other than robotsTxt (not yet migrated onto BaseChecker) are the
      // biggest remaining gaps. Thresholds stay just below the real baseline
      // so CI is an honest gate against regression — raise again as coverage
      // is added, target 80%.
      thresholds: {
        lines: 56,
        functions: 46,
        branches: 39,
        statements: 54,
      },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    testTimeout: 90000,
    hookTimeout: 90000,
  },
});

