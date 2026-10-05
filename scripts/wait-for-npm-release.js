// npm may acknowledge a publish before its processing queue exposes the package.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');

async function fetchMetadata(name) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
  return response.json();
}

async function waitForPublishedPackage(manifest, options = {}) {
  const attempts = options.attempts ?? 60;
  const pollInterval = options.pollInterval ?? 10000;
  const read = options.fetchMetadata ?? fetchMetadata;
  const pause = options.sleep ?? sleep;
  assert(manifest.name && manifest.version && manifest.integrity, 'Incomplete pack manifest');
  let pending = 'Version is not yet visible';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let metadata;
    try {
      metadata = await read(manifest.name);
    } catch (error) {
      pending = error.message;
    }
    const published = metadata?.versions?.[manifest.version];
    if (published) {
      assert.equal(published.name, manifest.name, 'Unexpected registry package name');
      assert.equal(published.version, manifest.version, 'Unexpected registry package version');
      assert.equal(
        published.dist?.integrity,
        manifest.integrity,
        'Published archive differs from validated candidate'
      );
      if (metadata['dist-tags']?.latest === manifest.version) {
        return { name: manifest.name, version: manifest.version, integrity: manifest.integrity };
      }
      pending = 'The latest tag is not yet visible';
    }
    options.onPending?.({ attempt, attempts, pending });
    if (attempt < attempts) await pause(pollInterval);
  }
  throw new Error(`npm registry did not expose ${manifest.name}@${manifest.version}: ${pending}`);
}

module.exports = { waitForPublishedPackage };
if (require.main === module) {
  const data = JSON.parse(fs.readFileSync(process.argv[2] || 'pack-manifest.json', 'utf8'));
  const manifest = Array.isArray(data) ? data[0] : data;
  waitForPublishedPackage(manifest, {
    onPending: ({ attempt, attempts, pending }) =>
      console.log(`Waiting for npm (${attempt}/${attempts}): ${pending}`),
  })
    .then((receipt) => console.log(JSON.stringify(receipt)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
