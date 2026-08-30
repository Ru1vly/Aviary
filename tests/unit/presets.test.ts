import { describe, it, expect } from 'vitest';
import { presets } from '../../src/config/presets';
import { CHECKER_REGISTRY } from '../../src/checkers/registry';

// ConfigLoader.isCheckerEnabled() returns `true` (enabled) when a checker
// key is absent from a preset's `rules` object — omission silently means
// "on", not "unspecified". Phase 1 found and fixed exactly this for
// `heatmap` (missing from all three presets, so it ran even under `basic`,
// which explicitly disables 14 other heavy checkers).
//
// Note: `basic` also omits 8 lighter checkers (robotsTxt, sitemap,
// content, links, uiElements, technical, accessibility, urlFactors) rather
// than listing them `true` — found while writing this test. That may well
// be intentional (they're not "heavy" in the way the 15 explicitly-disabled
// ones are), but it rests on the same omission-means-enabled default that
// made the heatmap bug possible, so it's flagged to the user rather than
// asserted on here as either correct or a bug.
describe('presets', () => {
  const registryKeys = CHECKER_REGISTRY.map((c) => c.key);

  it.each(Object.entries(presets))('%s preset has no unknown checker keys (registry drift guard)', (name, preset) => {
    const configuredKeys = Object.keys(preset.rules ?? {});
    const unknown = configuredKeys.filter((key) => !registryKeys.includes(key as (typeof registryKeys)[number]));
    expect(unknown, `${name} preset references unknown checker(s): ${unknown.join(', ')}`).toEqual([]);
  });

  it('basic preset disables every heavy/advanced checker', () => {
    // The 14 checkers basic explicitly turns off — a change here reflects a
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
});
