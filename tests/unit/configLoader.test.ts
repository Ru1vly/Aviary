import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigLoader } from '../../src/config/loader';
import { SEOConfig } from '../../src/config/types';

describe('ConfigLoader.isCheckerEnabled', () => {
  it('returns true when a checker is not mentioned in rules', () => {
    const config: SEOConfig = { rules: {} };
    expect(ConfigLoader.isCheckerEnabled(config, 'metaTags')).toBe(true);
  });

  it('returns true when rules is entirely absent', () => {
    const config: SEOConfig = {};
    expect(ConfigLoader.isCheckerEnabled(config, 'metaTags')).toBe(true);
  });

  it('returns false for a checker set to boolean false', () => {
    const config: SEOConfig = { rules: { metaTags: false } };
    expect(ConfigLoader.isCheckerEnabled(config, 'metaTags')).toBe(false);
  });

  it('returns true for a checker set to boolean true', () => {
    const config: SEOConfig = { rules: { metaTags: true } };
    expect(ConfigLoader.isCheckerEnabled(config, 'metaTags')).toBe(true);
  });

  // This is the exact bug from the original report: { enabled: false } could
  // never disable a checker because isCheckerEnabled returned true for any
  // object, regardless of its enabled field.
  it('returns false for checker-level { enabled: false }', () => {
    const config: SEOConfig = { rules: { metaTags: { enabled: false } } };
    expect(ConfigLoader.isCheckerEnabled(config, 'metaTags')).toBe(false);
  });

  it('returns true for checker-level { enabled: true, severity }', () => {
    const config: SEOConfig = {
      rules: { coreWebVitals: { enabled: true, severity: 'warning' } },
    };
    expect(ConfigLoader.isCheckerEnabled(config, 'coreWebVitals')).toBe(true);
  });

  it('returns true for a per-rule detail map with no checker-level enabled key', () => {
    const config: SEOConfig = {
      rules: {
        metaTags: {
          'title-exists': true,
          'meta-description-exists': { enabled: false, severity: 'error' },
        },
      },
    };
    expect(ConfigLoader.isCheckerEnabled(config, 'metaTags')).toBe(true);
  });

  it('is configurable for heatmap, which was previously missing from the type', () => {
    const config: SEOConfig = { rules: { heatmap: false } };
    expect(ConfigLoader.isCheckerEnabled(config, 'heatmap')).toBe(false);
  });
});

describe('ConfigLoader.getRuleConfig', () => {
  it('falls back to global severity when nothing is configured', () => {
    const config: SEOConfig = { severity: 'warning' };
    const resolved = ConfigLoader.getRuleConfig(config, 'metaTags', 'title-exists');
    expect(resolved).toEqual({ enabled: true, severity: 'warning', options: {} });
  });

  it('disables every rule when the checker is set to false', () => {
    const config: SEOConfig = { rules: { metaTags: false } };
    const resolved = ConfigLoader.getRuleConfig(config, 'metaTags', 'title-exists');
    expect(resolved.enabled).toBe(false);
  });

  it('resolves a specific rule from a per-rule detail map', () => {
    const config: SEOConfig = {
      rules: {
        metaTags: {
          'title-exists': { enabled: true, severity: 'error', options: { min: 10 } },
        },
      },
    };
    const resolved = ConfigLoader.getRuleConfig(config, 'metaTags', 'title-exists');
    expect(resolved).toEqual({ enabled: true, severity: 'error', options: { min: 10 } });
  });

  it('a rule absent from a per-rule detail map falls back to the global default, not the checker default', () => {
    const config: SEOConfig = {
      severity: 'warning',
      rules: { metaTags: { 'title-exists': { enabled: true, severity: 'error' } } },
    };
    const resolved = ConfigLoader.getRuleConfig(config, 'metaTags', 'some-other-rule');
    expect(resolved).toEqual({ enabled: true, severity: 'warning', options: {} });
  });

  // Every rule under a checker-level { enabled, severity } config should
  // inherit that checker's severity as its own default, rather than falling
  // through to the unrelated global default.
  it('inherits checker-level severity for an unnamed rule', () => {
    const config: SEOConfig = {
      severity: 'warning',
      rules: { coreWebVitals: { enabled: true, severity: 'error' } },
    };
    const resolved = ConfigLoader.getRuleConfig(config, 'coreWebVitals', 'lcp-acceptable');
    expect(resolved).toEqual({ enabled: true, severity: 'error', options: {} });
  });

  it('disables every rule under checker-level { enabled: false }', () => {
    const config: SEOConfig = { rules: { coreWebVitals: { enabled: false } } };
    const resolved = ConfigLoader.getRuleConfig(config, 'coreWebVitals', 'lcp-acceptable');
    expect(resolved.enabled).toBe(false);
  });
});

describe('ConfigLoader.resolveConfig', () => {
  it('applies a preset and lets an explicit severity override the preset default', () => {
    const resolved = ConfigLoader.resolveConfig({ preset: 'strict', severity: 'info' });
    expect(resolved.severity).toBe('info');
    expect(resolved.rules?.metaTags).toBeDefined();
  });

  it('merges custom rules over the preset instead of replacing them', () => {
    const resolved = ConfigLoader.resolveConfig({
      preset: 'basic',
      rules: { images: false },
    });
    // basic preset enables 'images' with per-rule detail; the override
    // disables the whole checker without touching other basic-preset keys.
    expect(resolved.rules?.images).toBe(false);
    expect(resolved.rules?.metaTags).toBeDefined();
  });

  it('every preset explicitly configures heatmap (no silent fall-through to enabled)', () => {
    for (const preset of ['basic', 'advanced', 'strict'] as const) {
      const resolved = ConfigLoader.resolveConfig({ preset });
      expect(resolved.rules?.heatmap).toBeDefined();
    }
  });

  it('basic preset disables heatmap along with the other heavy checkers', () => {
    const resolved = ConfigLoader.resolveConfig({ preset: 'basic' });
    expect(ConfigLoader.isCheckerEnabled(resolved, 'heatmap')).toBe(false);
  });
});

describe('ConfigLoader file loading', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aviary-config-test-'));

  afterEach(() => {
    for (const f of fs.readdirSync(tmpDir)) {
      fs.unlinkSync(path.join(tmpDir, f));
    }
  });

  it('loads and resolves a JSON config file', () => {
    const file = path.join(tmpDir, 'config.json');
    fs.writeFileSync(file, JSON.stringify({ preset: 'basic', severity: 'error' }));
    const resolved = ConfigLoader.loadFromFile(file);
    expect(resolved.severity).toBe('error');
    expect(resolved.rules?.metaTags).toBeDefined();
  });

  it('loads and resolves a YAML config file', () => {
    const file = path.join(tmpDir, 'config.yaml');
    fs.writeFileSync(file, 'preset: strict\nseverity: warning\n');
    const resolved = ConfigLoader.loadFromFile(file);
    expect(resolved.severity).toBe('warning');
    expect(resolved.rules?.metaTags).toBeDefined();
  });

  it('throws for a missing config file', () => {
    expect(() => ConfigLoader.loadFromFile(path.join(tmpDir, 'missing.json'))).toThrow(
      /not found/
    );
  });

  it('throws for an unsupported extension', () => {
    const file = path.join(tmpDir, 'config.txt');
    fs.writeFileSync(file, '{}');
    expect(() => ConfigLoader.loadFromFile(file)).toThrow(/Unsupported/);
  });

  it('createDefaultConfig writes a file that loadFromFile can read back', () => {
    const file = path.join(tmpDir, '.aviary.json');
    ConfigLoader.createDefaultConfig(file, 'strict');
    expect(fs.existsSync(file)).toBe(true);
    const resolved = ConfigLoader.loadFromFile(file);
    expect(resolved.severity).toBe('warning'); // resolveConfig's own default, per createDefaultConfig's written value
  });
});
