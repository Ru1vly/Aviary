const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tuiDir = path.join(rootDir, 'tui');

// Builds only the `tui` package by default — Cargo scopes a plain
// `cargo build` to whichever member directory it's invoked from, not the
// whole workspace. `--bin aviary-fast` explicitly also builds the engine
// package's fast-path binary (engine/src/bin/aviary_fast.rs, package name
// aviary-engine — "aviary-fast" is the *binary* target's name, not the
// package's): the TUI's --fast mode resolves it by looking next to its own
// binary (see tui/src/main.rs), so it has to ship in dist/ alongside
// `tui`, not just exist somewhere in target/.
console.log('Compiling Rust TUI dashboard and fast-path engine binary...');
execSync(
  'cargo build --release --package tui --package aviary-engine --bin tui --bin aviary-fast',
  { cwd: tuiDir, stdio: 'inherit' }
);

// Resolve the real cargo target directory instead of assuming `tui/target`.
// `tui` is a member of the root Cargo workspace (see /Cargo.toml), so cargo
// actually writes to `<repo>/target`, not `tui/target` — ask cargo directly
// so this can never silently drift again.
const metadataRaw = execSync('cargo metadata --no-deps --format-version 1', {
  cwd: tuiDir,
});
const metadata = JSON.parse(metadataRaw.toString());
const targetDir = metadata.target_directory;

const isWindows = process.platform === 'win32';
const ext = isWindows ? '.exe' : '';

fs.mkdirSync(distDir, { recursive: true });

for (const binName of ['tui', 'aviary-fast']) {
  const fileName = binName + ext;
  const srcBinPath = path.join(targetDir, 'release', fileName);
  const destBinPath = path.join(distDir, fileName);

  if (!fs.existsSync(srcBinPath)) {
    throw new Error(`Built binary not found at ${srcBinPath}`);
  }

  console.log(`Copying ${binName} binary to ${destBinPath}...`);
  if (fs.existsSync(destBinPath)) fs.unlinkSync(destBinPath);
  fs.copyFileSync(srcBinPath, destBinPath);

  // Ensure executable permissions on Unix systems
  if (!isWindows) {
    fs.chmodSync(destBinPath, 0o755);
  }
}

console.log('✓ TUI build successful!');
