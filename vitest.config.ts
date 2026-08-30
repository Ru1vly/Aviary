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
      // TODO(coverage-ratchet): actual coverage after Phase 1 (config loader +
      // robotsTxt/errors tests) is ~54% statements / 39% branches / 43%
      // functions / 56% lines. reporter.ts (still ~1.5%) and the 27 checkers
      // other than robotsTxt are the biggest remaining gaps. Thresholds are
      // set just below the real baseline so CI stays an honest gate against
      // regression — raise them again as more coverage lands, target 80%.
      thresholds: {
        lines: 55,
        functions: 42,
        branches: 38,
        statements: 53,
      },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    testTimeout: 90000,
    hookTimeout: 90000,
  },
});

