const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tuiDir = path.join(rootDir, 'tui');

console.log('Compiling TypeScript...');
execSync('npx tsc', { cwd: rootDir, stdio: 'inherit' });

console.log('Compiling Rust TUI dashboard...');
execSync('cargo build --release', { cwd: tuiDir, stdio: 'inherit' });

const isWindows = process.platform === 'win32';
const tuiBinName = isWindows ? 'tui.exe' : 'tui';
const srcBinPath = path.join(tuiDir, 'target', 'release', tuiBinName);
const destBinPath = path.join(distDir, tuiBinName);

console.log(`Copying TUI binary to ${destBinPath}...`);
fs.copyFileSync(srcBinPath, destBinPath);

// Ensure executable permissions on Unix systems
if (!isWindows) {
  fs.chmodSync(destBinPath, 0o755);
}

console.log('✓ Build successful!');
