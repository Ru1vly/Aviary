import { mkdtempSync, writeFileSync, linkSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pathsReferToSameFile } from '../../src/utils/filePath';
const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'aviary-file-identity-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
describe('input/output file identity protection', () => {
  it('recognizes hard links and symlinks while permitting independent output files', () => {
    const directory = fixture(),
      input = join(directory, 'input.json'),
      hard = join(directory, 'hard.json'),
      symbolic = join(directory, 'symbolic.json'),
      output = join(directory, 'output.json');
    writeFileSync(input, 'input');
    writeFileSync(output, 'output');
    linkSync(input, hard);
    symlinkSync(input, symbolic);
    expect(pathsReferToSameFile(input, hard)).toBe(true);
    expect(pathsReferToSameFile(input, symbolic)).toBe(true);
    expect(pathsReferToSameFile(input, output)).toBe(false);
  });
  it('resolves new output names through existing directory aliases', () => {
    const directory = fixture(),
      alias = join(directory, 'alias');
    symlinkSync(directory, alias, 'dir');
    expect(
      pathsReferToSameFile(join(directory, 'new', 'report.json'), join(alias, 'new', 'report.json'))
    ).toBe(true);
    expect(pathsReferToSameFile(join(directory, 'new.json'), join(alias, 'different.json'))).toBe(
      false
    );
  });
  it('propagates invalid parent paths rather than silently declaring them safe', () => {
    const directory = fixture(),
      input = join(directory, 'input.json');
    writeFileSync(input, 'input');
    expect(() => pathsReferToSameFile(join(input, 'child.json'), input)).toThrow(/ENOTDIR/);
  });
  it('propagates symlink loops instead of accepting an unresolved output alias', () => {
    const directory = fixture(),
      loop = join(directory, 'loop'),
      input = join(directory, 'input.json');
    writeFileSync(input, 'input');
    symlinkSync(loop, loop);
    expect(() => pathsReferToSameFile(loop, input)).toThrow(/ELOOP/);
  });
});
