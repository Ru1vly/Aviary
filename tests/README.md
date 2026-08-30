# Testing Guide

This directory contains all tests for the aviary project.

## Directory Structure

```
tests/
├── unit/              # Unit tests for individual checkers
├── integration/       # Integration tests for multiple checkers
├── e2e/              # End-to-end tests for the full tool
├── mocks/            # Mock utilities and mock server
└── benchmarks/       # Performance benchmarks
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests Only
```bash
npm run test:e2e
```

### Watch Mode
```bash
npm run test:watch
```

### With Coverage
```bash
npm run test:coverage
```

### Performance Benchmarks
```bash
npm run test:benchmark
```

### Interactive UI
```bash
npm run test:ui
```

## Coverage Thresholds

The project maintains the following coverage thresholds:
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

## Writing Tests

### Unit Tests

Unit tests are located in `tests/unit/` and test individual checkers in isolation using mocks.

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { MetaTagsChecker } from '../../src/checkers/metaTags';
import { createMockPage } from '../mocks/mockPage';

describe('MetaTagsChecker', () => {
  it('should check title', async () => {
    const mockPage = createMockPage({ title: 'Test Title' });
    const checker = new MetaTagsChecker(mockPage as any);
    const results = await checker.checkAll();
    expect(results).toBeDefined();
  });
});
```

### Integration Tests

Integration tests are located in `tests/integration/` and test multiple components working together with real Playwright instances.

### E2E Tests

E2E tests are located in `tests/e2e/` and test the complete SEOChecker workflow using the mock server.

### Benchmarks

Performance benchmarks are located in `tests/benchmarks/` and measure the performance of various operations.

## Mock Server

The mock server (`tests/mocks/mockServer.ts`) provides test pages with different SEO qualities:

- `/optimal` - Page with optimal SEO
- `/poor` - Page with poor SEO
- `/medium` - Page with medium SEO
- `/robots.txt` - Test robots.txt file
- `/sitemap.xml` - Test sitemap

## Best Practices

1. **Use descriptive test names** - Test names should clearly describe what is being tested
2. **Follow AAA pattern** - Arrange, Act, Assert
3. **Keep tests isolated** - Tests should not depend on each other
4. **Mock external dependencies** - Use mocks for Playwright Page objects in unit tests
5. **Test edge cases** - Include tests for error conditions and boundary cases
6. **Maintain coverage** - Ensure new code includes corresponding tests

## Continuous Integration

Tests are automatically run in CI/CD pipelines. All tests must pass and coverage thresholds must be met before merging.
