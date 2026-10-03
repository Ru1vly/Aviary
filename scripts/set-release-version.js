// Apply one release version to package metadata and the bundled API specification.
const fs = require('node:fs');
const version = (process.argv[2] || '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)) {
  throw new Error('Expected a semantic release version, for example v0.2.0.');
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const specPath = 'docs/openapi.yaml';
const spec = fs.readFileSync(specPath, 'utf8');
if ((spec.match(/^  version: .+$/gm) || []).length !== 1) {
  throw new Error('OpenAPI document must contain exactly one info.version field.');
}
pkg.version = version;
for (const dependency of Object.keys(pkg.optionalDependencies || {})) {
  if (dependency.startsWith('@ru1vly/aviary-')) pkg.optionalDependencies[dependency] = version;
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(specPath, spec.replace(/^  version: .+$/m, `  version: ${version}`));
console.log(`Release metadata set to ${version}.`);
