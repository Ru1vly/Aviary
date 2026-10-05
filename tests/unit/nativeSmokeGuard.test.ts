import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe.skipIf(process.platform === 'win32')('native loader smoke guard', () => {
  it.each([
    [
      'aarch64-binfmt-P: Could not open "/lib/ld-linux-aarch64.so.1": No such file or directory',
      1,
      1,
    ],
    ['unexpected runtime failure', 1, 1],
    ['Error: Os { code: 6, message: "No such device or address" }', 1, 0],
    ['Error: Os { code: 6, message: "Device not configured" }', 1, 0],
  ])('classifies %s without accepting arbitrary failures', (message, status, expected) => {
    const directory = mkdtempSync(join(tmpdir(), 'aviary-loader-guard-'));
    try {
      const binary = join(directory, 'fixture');
      writeFileSync(
        binary,
        `#!${process.execPath}\nconsole.error(${JSON.stringify(message)});process.exit(${status});\n`
      );
      chmodSync(binary, 0o755);
      const result = spawnSync(process.execPath, ['scripts/smoke-test-binary.js', binary], {
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(expected);
      expect(result.stdout + result.stderr).toContain(expected ? 'FAIL:' : 'OK:');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
