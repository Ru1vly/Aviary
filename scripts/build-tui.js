const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tuiDir = path.join(rootDir, 'tui');

console.log('Compiling Rust TUI dashboard...');
execSync('cargo build --release', { cwd: tuiDir, stdio: 'inherit' });

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
const tuiBinName = isWindows ? 'tui.exe' : 'tui';
const srcBinPath = path.join(targetDir, 'release', tuiBinName);
const destBinPath = path.join(distDir, tuiBinName);

if (!fs.existsSync(srcBinPath)) {
  throw new Error(`Built TUI binary not found at ${srcBinPath}`);
}

fs.mkdirSync(distDir, { recursive: true });

console.log(`Copying TUI binary to ${destBinPath}...`);
if (fs.existsSync(destBinPath)) fs.unlinkSync(destBinPath);
fs.copyFileSync(srcBinPath, destBinPath);

// Ensure executable permissions on Unix systems
if (!isWindows) {
  fs.chmodSync(destBinPath, 0o755);
}

console.log('✓ TUI build successful!');
