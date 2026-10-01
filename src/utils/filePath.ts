import * as fs from 'node:fs';
import * as path from 'node:path';

function canonicalizePath(value: string): string {
  let cursor = path.resolve(value);
  const suffix: string[] = [];
  while (true) {
    try {
      return path.join(fs.realpathSync(cursor), ...suffix);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') return path.resolve(value);
      const parent = path.dirname(cursor);
      if (parent === cursor) return path.resolve(value);
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

/** Detect path aliases by resolved name and, when both exist, filesystem identity. */
export function pathsReferToSameFile(left: string, right: string): boolean {
  const canonicalLeft = canonicalizePath(left);
  const canonicalRight = canonicalizePath(right);
  if (
    process.platform === 'win32'
      ? canonicalLeft.toLowerCase() === canonicalRight.toLowerCase()
      : canonicalLeft === canonicalRight
  )
    return true;

  try {
    const leftStats = fs.statSync(canonicalLeft);
    const rightStats = fs.statSync(canonicalRight);
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
