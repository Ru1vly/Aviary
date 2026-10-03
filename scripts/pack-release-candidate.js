// Produce an unpublished candidate from a clean commit and freshly built JavaScript.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { checkPackageDocumentation } = require('./check-package-doc-links');
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const version = args[0];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ''))
  throw new Error('Supply a stable version, e.g. 0.2.0.');
const root = process.cwd();
if (
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    encoding: 'utf8',
  }).trim()
) {
  throw new Error('Commit workspace changes before packing a release candidate.');
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const destination = path.resolve(
  args[1] || `reports/release-candidates/${version}-${commit.slice(0, 8)}`
);
fs.mkdirSync(destination, { recursive: true });
if (fs.readdirSync(destination).some((name) => name.endsWith('.tgz'))) {
  throw new Error('Choose a new destination to preserve the existing candidate archive.');
}
execFileSync('pnpm', ['run', 'build:ts'], { stdio: 'inherit' });
execFileSync('pnpm', ['run', 'check:xlsx-bundle'], { stdio: 'inherit' });
if (
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== commit ||
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    encoding: 'utf8',
  }).trim()
) {
  throw new Error('Workspace changed during build; commit changes and retry.');
}
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'aviary-candidate-'));
try {
  const archive = path.join(stage, 'source.tar');
  fs.writeFileSync(
    archive,
    execFileSync('git', ['archive', commit], { maxBuffer: 128 * 1024 * 1024 })
  );
  execFileSync('tar', ['-xf', archive, '-C', stage]);
  fs.unlinkSync(archive);
  fs.cpSync(path.join(root, 'dist'), path.join(stage, 'dist'), { recursive: true });
  execFileSync(process.execPath, ['scripts/set-release-version.js', version], {
    cwd: stage,
    stdio: 'inherit',
  });
  const output = execFileSync('npm', ['pack', '--json', '--pack-destination', destination], {
    cwd: stage,
    encoding: 'utf8',
  });
  const data = JSON.parse(output);
  const pkg = Array.isArray(data) ? data[0] : data['@ru1vly/aviary'] || data;
  if (!pkg.filename || pkg.version !== version) throw new Error('Unexpected npm pack metadata.');
  const filename = path.join(destination, pkg.filename);
  const documentationAudit = checkPackageDocumentation(stage, pkg.files);
  if (documentationAudit.missing.length) {
    fs.unlinkSync(filename);
    throw new Error(
      'Package documentation links to unshipped files: ' +
        JSON.stringify(documentationAudit.missing)
    );
  }
  fs.writeFileSync(
    path.join(destination, 'documentation-link-audit.json'),
    JSON.stringify(documentationAudit, null, 2) + '\n'
  );
  const digest = crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  fs.writeFileSync(path.join(destination, 'pack-manifest.json'), output);
  fs.writeFileSync(path.join(destination, 'SHA256SUMS'), `${digest}  ${pkg.filename}\n`);
  fs.writeFileSync(
    path.join(destination, 'provenance.json'),
    JSON.stringify(
      { version, commit, sha256: digest, filename: pkg.filename, node: process.version },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(destination, 'README.md'),
    `# Aviary ${version} unpublished candidate\n\nSource commit: ${commit}\n\nSHA-256: ${digest}\n\nBuild and isolated XLSX bundle checks passed. This command does not establish release readiness; consult RELEASE_READINESS.md for coverage, publisher and platform verification requirements.\n`
  );
  console.log(filename);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
