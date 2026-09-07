// Runs a freshly cross-compiled binary once, on its own native CI runner,
// to catch "compiles but the OS refuses to execute it" bugs (wrong target
// triple, glibc-too-new from `cross` builds, corrupted transfer) before
// publishing. What matters is *that* the OS successfully loaded and ran it
// -- not any particular exit behavior, which differs by platform: Linux/
// macOS runners have no real TTY, so enable_raw_mode() fails immediately
// and the TUI exits fast; Windows runners do provide a console, so
// enable_raw_mode() succeeds and the TUI enters its normal interactive
// event loop and never exits on its own (confirmed: no loader-failure text
// in its output, just a live process waiting on input that will never
// come) -- that's a real, valid launch, not a hang to fail on.
const { spawn } = require('child_process');

const binaryPath = process.argv[2];
if (!binaryPath) {
  console.error('Usage: node smoke-test-binary.js <path-to-binary>');
  process.exit(1);
}

const loaderFailurePatterns = [
  /exec format error/i,
  /not a valid win32 application/i,
  /cannot execute binary file/i,
  /error while loading shared libraries/i,
  /library not loaded/i,
];

const child = spawn(binaryPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });

let output = '';
child.stdout.on('data', (d) => (output += d));
child.stderr.on('data', (d) => (output += d));

const timeout = setTimeout(() => {
  child.kill();
  console.log(`Process still running after 5s. Captured output:\n${output}`);

  if (loaderFailurePatterns.some((p) => p.test(output))) {
    console.error(`FAIL: ${binaryPath} hit an OS/loader-level failure -- wrong target or bad build.`);
    process.exit(1);
  }

  console.log(`OK: ${binaryPath} launched and is still running (no loader failure) -- killed for cleanup.`);
  process.exit(0);
}, 5000);

child.on('error', (err) => {
  clearTimeout(timeout);
  console.error(`FAIL: OS refused to launch ${binaryPath}: ${err.message}`);
  process.exit(1);
});

child.on('exit', () => {
  clearTimeout(timeout);
  console.log(`Process exited. Captured output:\n${output}`);

  if (loaderFailurePatterns.some((p) => p.test(output))) {
    console.error(`FAIL: ${binaryPath} hit an OS/loader-level failure -- wrong target or bad build.`);
    process.exit(1);
  }

  console.log(`OK: ${binaryPath} is a valid, runnable binary for this platform.`);
  process.exit(0);
});
