import { describe, it, expect } from 'vitest';
import { presets } from '../../src/config/presets';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';

// ConfigLoader.isCheckerEnabled() returns `true` (enabled) when a checker
// key is absent from a preset's `rules` object — omission silently means
// "on", not "unspecified". Phase 1 found and fixed exactly this for
// `heatmap` (missing from all three presets, so it ran even under `basic`,
// which explicitly disables 14 other heavy checkers). `basic` also used to
// omit 8 lighter checkers (robotsTxt, sitemap, content, links, uiElements,
// technical, accessibility, urlFactors) rather than listing them `true` —
// same fragility, fixed by making every registry key explicit in every
// preset, asserted below so it can't silently regress.
describe('presets', () => {
  const registryKeys = CHECKER_REGISTRY.map((c) => c.key);

  it.each(Object.entries(presets))('%s preset explicitly configures every registry checker', (name, preset) => {
    const configuredKeys = Object.keys(preset.rules ?? {});
    const missing = registryKeys.filter((key) => !configuredKeys.includes(key));
    expect(missing, `${name} preset is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it.each(Object.entries(presets))('%s preset has no unknown checker keys (registry drift guard)', (name, preset) => {
    const configuredKeys = Object.keys(preset.rules ?? {});
    const unknown = configuredKeys.filter((key) => !registryKeys.includes(key as (typeof registryKeys)[number]));
    expect(unknown, `${name} preset references unknown checker(s): ${unknown.join(', ')}`).toEqual([]);
  });

  it('basic preset disables every heavy/advanced checker', () => {
    // The 15 checkers basic explicitly turns off — a change here reflects a
    // real product decision, so pin the exact set rather than just "some".
    const expectedDisabled = [
      'structuredData',
      'socialMedia',
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
    for (const key of expectedDisabled) {
      expect(presets.basic.rules?.[key as keyof typeof presets.basic.rules], key).toBe(false);
    }
  });

  it('basic preset keeps every lightweight/fundamental checker on', () => {
    const expectedEnabled = [
      'robotsTxt',
      'sitemap',
      'content',
      'links',
      'uiElements',
      'technical',
      'accessibility',
      'urlFactors',
    ];
    for (const key of expectedEnabled) {
      expect(presets.basic.rules?.[key as keyof typeof presets.basic.rules], key).toBe(true);
    }
  });
});
