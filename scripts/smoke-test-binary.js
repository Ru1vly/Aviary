// Runs a freshly cross-compiled binary once, on its own native CI runner,
// to catch "compiles but the OS refuses to execute it" bugs (wrong target
// triple, glibc-too-new from `cross` builds, corrupted transfer) before
// publishing. CI runners have no real TTY, so the TUI binary is always
// expected to fail once it gets far enough to open one -- what matters is
// *that* it fails, not a launch-level OS/loader error.
const { spawn } = require('child_process');

const binaryPath = process.argv[2];
if (!binaryPath) {
  console.error('Usage: node smoke-test-binary.js <path-to-binary>');
  process.exit(1);
}

const child = spawn(binaryPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });

let output = '';
child.stdout.on('data', (d) => (output += d));
child.stderr.on('data', (d) => (output += d));

const timeout = setTimeout(() => {
  child.kill();
  console.error(`FAIL: ${binaryPath} did not exit within 5s (may be waiting on stdin/hung)`);
  process.exit(1);
}, 5000);

child.on('error', (err) => {
  clearTimeout(timeout);
  console.error(`FAIL: OS refused to launch ${binaryPath}: ${err.message}`);
  process.exit(1);
});

child.on('exit', () => {
  clearTimeout(timeout);
  console.log(`Process exited. Captured output:\n${output}`);

  const loaderFailurePatterns = [
    /exec format error/i,
    /not a valid win32 application/i,
    /cannot execute binary file/i,
    /error while loading shared libraries/i,
    /library not loaded/i,
  ];
  const hitLoaderFailure = loaderFailurePatterns.some((p) => p.test(output));

  if (hitLoaderFailure) {
    console.error(`FAIL: ${binaryPath} hit an OS/loader-level failure -- wrong target or bad build.`);
    process.exit(1);
  }

  console.log(`OK: ${binaryPath} is a valid, runnable binary for this platform.`);
  process.exit(0);
});
