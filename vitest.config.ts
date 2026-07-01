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

