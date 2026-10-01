// Validate a freshly built aviary-fast binary on its native runner without
// making a network request. Running --help also catches loader and target
// mismatches in the same way the TUI smoke check does.
const { spawnSync } = require('child_process');

const binaryPath = process.argv[2];
if (!binaryPath) {
  console.error('Usage: node smoke-test-fast-binary.js <path-to-binary>');
  process.exit(1);
}

const result = spawnSync(binaryPath, ['--help'], {
  encoding: 'utf8',
  timeout: 5000,
});

if (result.error) {
  console.error(`FAIL: ${binaryPath} could not run --help: ${result.error.message}`);
  process.exit(1);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
if (result.status !== 0 || !output.includes('Usage: aviary-fast <url>')) {
  console.error(`FAIL: ${binaryPath} did not return fast-engine help successfully.\n${output}`);
  process.exit(1);
}

const invalidOption = spawnSync(binaryPath, ['--aviary-smoke-invalid-option'], {
  encoding: 'utf8',
  timeout: 5000,
});
const invalidOutput = `${invalidOption.stdout ?? ''}${invalidOption.stderr ?? ''}`;
if (
  invalidOption.error ||
  invalidOption.status !== 2 ||
  !invalidOutput.includes('Unknown option: --aviary-smoke-invalid-option')
) {
  console.error(`FAIL: ${binaryPath} did not reject an unknown option locally.\n${invalidOutput}`);
  process.exit(1);
}

console.log(
  `OK: ${binaryPath} returned help and rejected an unknown option without network access.`
);
