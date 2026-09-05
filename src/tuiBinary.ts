import * as fs from 'fs';
import * as path from 'path';

// Each supported platform ships as its own optionalDependency (e.g.
// @ru1vly/aviary-linux-x64) containing just that platform's prebuilt `tui`
// and `aviary-fast` binaries -- npm only installs the one matching the
// current os/cpu, so most users never download binaries for platforms
// they don't run.
const PLATFORM_PACKAGES: Record<string, string> = {
  'linux-x64': '@ru1vly/aviary-linux-x64',
  'linux-arm64': '@ru1vly/aviary-linux-arm64',
  'darwin-x64': '@ru1vly/aviary-darwin-x64',
  'darwin-arm64': '@ru1vly/aviary-darwin-arm64',
  'win32-x64': '@ru1vly/aviary-win32-x64',
};

export function resolveTuiBinary(): string | null {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const platformKey = `${process.platform}-${process.arch}`;
  const pkgName = PLATFORM_PACKAGES[platformKey];

  if (pkgName) {
    try {
      const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
      const binPath = path.join(path.dirname(pkgJsonPath), 'tui' + ext);
      if (fs.existsSync(binPath)) return binPath;
    } catch {
      // Optional dependency wasn't installed (npm skips it on platforms
      // it doesn't match, and install can also just fail non-fatally).
    }
  }

  // Local dev fallback: `npm run build:tui` compiles straight into dist/
  // next to this file, for contributors building from source.
  const localPath = path.join(__dirname, 'tui' + ext);
  if (fs.existsSync(localPath)) return localPath;

  return null;
}

export function supportedPlatforms(): string[] {
  return Object.keys(PLATFORM_PACKAGES);
}
