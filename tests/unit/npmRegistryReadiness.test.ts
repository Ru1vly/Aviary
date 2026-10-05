import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const { waitForPublishedPackage } = createRequire(import.meta.url)(
  '../../scripts/wait-for-npm-release.js'
);
const manifest = { name: '@test/package', version: '0.2.1', integrity: 'sha512-checked' };
const visible = {
  versions: { '0.2.1': { ...manifest, dist: { integrity: manifest.integrity } } },
  'dist-tags': { latest: '0.2.1' },
};

describe('npm registry release readiness', () => {
  it('waits for a processed version and its latest tag', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ...visible, 'dist-tags': { latest: '0.1.1' } })
      .mockResolvedValue(visible);
    const pause = vi.fn();
    await expect(
      waitForPublishedPackage(manifest, {
        fetchMetadata: read,
        sleep: pause,
        attempts: 3,
        pollInterval: 1,
      })
    ).resolves.toEqual(manifest);
    expect(read).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it('recovers from a temporary registry error', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('Registry unavailable'))
      .mockResolvedValue(visible);
    await expect(
      waitForPublishedPackage(manifest, {
        fetchMetadata: read,
        sleep: vi.fn(),
        attempts: 2,
      })
    ).resolves.toEqual(manifest);
  });

  it('rejects a published archive with different integrity immediately', async () => {
    const read = vi.fn().mockResolvedValue({
      ...visible,
      versions: { '0.2.1': { ...manifest, dist: { integrity: 'sha512-unreviewed' } } },
    });
    await expect(
      waitForPublishedPackage(manifest, {
        fetchMetadata: read,
        sleep: vi.fn(),
        attempts: 3,
      })
    ).rejects.toThrow('Published archive differs');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('fails after the bounded wait instead of treating an absent version as ready', async () => {
    const read = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    await expect(
      waitForPublishedPackage(manifest, {
        fetchMetadata: read,
        sleep: pause,
        attempts: 3,
      })
    ).rejects.toThrow('did not expose @test/package@0.2.1');
    expect(read).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenCalledTimes(2);
  });
});
