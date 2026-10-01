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
      // Release gate: every included source file must meet all four metrics.
      // Keep the 80% minimums unchanged until the actual coverage report clears
      // them; subprocess-only behavior is checked by separate integration tests.
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
