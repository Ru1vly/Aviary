const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

console.log('Compiling TypeScript...');
execSync('npm run build:ts', { cwd: rootDir, stdio: 'inherit' });

execSync('node scripts/build-tui.js', { cwd: rootDir, stdio: 'inherit' });

console.log('✓ Build successful!');
