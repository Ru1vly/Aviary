import { describe, it, expect } from 'vitest';
import { Page, Response } from 'playwright';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';

describe('CHECKER_REGISTRY', () => {
  it('has exactly 28 entries', () => {
    expect(CHECKER_REGISTRY).toHaveLength(28);
  });

  it('has unique keys', () => {
    const keys = CHECKER_REGISTRY.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a non-empty label and icon', () => {
    for (const { key, label, icon } of CHECKER_REGISTRY) {
      expect(label, `${key} label`).toBeTruthy();
      expect(icon, `${key} icon`).toBeTruthy();
    }
  });

  it('every entry constructs successfully and exposes checkAll()', () => {
    const ctx = { page: {} as Page, response: null as Response | null };
    for (const { key, create } of CHECKER_REGISTRY) {
      const checker = create(ctx);
      expect(typeof checker.checkAll, `${key}.checkAll`).toBe('function');
    }
  });

  // Cross-language drift guard: tui/src/main.rs's populate_categories()
  // hand-maintains its own copy of this same 28-key list (it can't import
  // a TS module), in the same order. This fixture mirrors that Rust list
  // exactly — if either side adds, removes, renames, or reorders a
  // checker without updating the other, this test catches it. See the
  // registry.ts module comment for why this is a guard rather than a
  // single shared source.
  it('matches the hand-maintained key list in tui/src/main.rs populate_categories()', () => {
    const RUST_TUI_KEYS = [
      'metaTags',
      'headings',
      'images',
      'performance',
      'robotsTxt',
      'sitemap',
      'security',
      'structuredData',
      'socialMedia',
      'content',
      'links',
      'uiElements',
      'technical',
      'accessibility',
      'urlFactors',
      'spamDetection',
      'pageQuality',
      'advancedImages',
      'multimedia',
      'coreWebVitals',
      'analytics',
      'mobileUX',
      'schemaValidation',
      'resourceOptimization',
      'legalCompliance',
      'ecommerce',
      'internationalization',
      'heatmap',
    ];

    expect(CHECKER_REGISTRY.map((c) => c.key)).toEqual(RUST_TUI_KEYS);
  });
});
