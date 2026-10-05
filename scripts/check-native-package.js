// Verify the actual packed native binaries through an isolated offline install.
// Cross-architecture runners use their configured emulator to launch the package.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const [platform, binaryDirectory, versionInput] = process.argv.slice(2);
const version = (versionInput || '').replace(/^v/, '');
if (
  !['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'win32-x64'].includes(platform) ||
  !/^\d+\.\d+\.\d+$/.test(version)
) {
  throw new Error(
    'Usage: node scripts/check-native-package.js <platform> <binary-directory> <version>'
  );
}
const root = process.cwd();
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'aviary-native-check-'));
const destination = path.join(root, 'reports', 'native-candidates', platform);
const npmCommand =
  process.platform === 'win32'
    ? [
        process.execPath,
        path.join(
          path.dirname(
            execFileSync('where.exe', ['npm.cmd'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
          ),
          'node_modules/npm/bin/npm-cli.js'
        ),
      ]
    : ['npm'];
const npmRun = (args, cwd) =>
  execFileSync(npmCommand[0], [...npmCommand.slice(1), ...args], { cwd, encoding: 'utf8' });
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
try {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'npm', platform, 'package.json'), 'utf8')
  );
  manifest.version = version;
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2));
  const binaries = platform.startsWith('win32')
    ? ['tui.exe', 'aviary-fast.exe']
    : ['tui', 'aviary-fast'];
  for (const binary of binaries) {
    const source = path.resolve(binaryDirectory, binary);
    assert(fs.statSync(source).size > 0, `${binary} must be a nonempty build artifact`);
    fs.copyFileSync(source, path.join(stage, binary));
    fs.chmodSync(path.join(stage, binary), 0o755);
  }
  fs.mkdirSync(destination, { recursive: true });
  const packed = JSON.parse(
    npmRun(['pack', '--json', '--pack-destination', destination], stage)
  )[0];
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, version);
  assert.deepEqual(
    packed.files.map((file) => file.path).sort(),
    ['package.json', ...binaries].sort()
  );
  const archive = path.join(destination, packed.filename);
  const consumer = path.join(stage, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true}');
  // --force permits ARM emulation and Rosetta checks on hosts with another CPU.
  npmRun(
    ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--force', archive],
    consumer
  );
  const installed = path.join(consumer, 'node_modules', ...manifest.name.split('/'));
  const installedManifest = JSON.parse(
    fs.readFileSync(path.join(installed, 'package.json'), 'utf8')
  );
  assert.equal(installedManifest.version, version);
  assert.deepEqual(installedManifest.os, manifest.os);
  assert.deepEqual(installedManifest.cpu, manifest.cpu);
  for (const binary of binaries)
    assert.equal(digest(path.join(installed, binary)), digest(path.join(stage, binary)));
  execFileSync(
    process.execPath,
    [path.join(root, 'scripts/smoke-test-binary.js'), path.join(installed, binaries[0])],
    { stdio: 'inherit' }
  );
  execFileSync(
    process.execPath,
    [path.join(root, 'scripts/smoke-test-fast-binary.js'), path.join(installed, binaries[1])],
    { stdio: 'inherit' }
  );
  fs.writeFileSync(
    path.join(destination, 'pack-manifest.json'),
    JSON.stringify(packed, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(destination, 'SHA256SUMS'),
    `${digest(archive)}  ${packed.filename}\n`
  );
  console.log(
    `Verified ${manifest.name}@${version}: tarball contents, clean install, binary integrity and startup.`
  );
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
