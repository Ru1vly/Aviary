#!/usr/bin/env bash
set -euo pipefail

# pnpm forwards its conventional `--` separator to shell scripts.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s <bundle-directory>\n' "$0" >&2
  exit 2
fi

bundle_dir="$(cd -- "$1" && pwd)"
manifest="$bundle_dir/manifest.json"
if [[ ! -f "$manifest" ]]; then
  printf 'Bundle manifest not found: %s\n' "$manifest" >&2
  exit 2
fi

node - "$bundle_dir" "$manifest" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const hashFile = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(hash.digest('hex')));
});

const [bundleDir, manifestPath] = process.argv.slice(2);
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`Invalid JSON manifest: ${error.message}`);
  process.exit(1);
}

if (Object.keys(manifest).sort().join(',') !== 'artifact_type,files,generated_at_utc,schema_version' ||
    manifest.artifact_type !== 'geo-answer-review-bundle' || manifest.schema_version !== 1 ||
    !Array.isArray(manifest.files) || typeof manifest.generated_at_utc !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(manifest.generated_at_utc) ||
    !Number.isFinite(Date.parse(manifest.generated_at_utc))) {
  console.error('Manifest does not match the GEO answer review bundle v1 structure.');
  process.exit(1);
}

async function verifyFiles() {
  const seen = new Set();
  const failures = [];
  for (const entry of manifest.files) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'media_type,path,sha256,size_bytes' ||
        typeof entry.path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.path) ||
        !['text/csv', 'application/json', 'text/html', 'text/markdown'].includes(entry.media_type) ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.size_bytes) || entry.size_bytes < 0) {
      failures.push(`Invalid file record: ${JSON.stringify(entry)}`);
      continue;
    }
    if (seen.has(entry.path)) {
      failures.push(`Duplicate path: ${entry.path}`);
      continue;
    }
    seen.add(entry.path);
    const filePath = path.join(bundleDir, ...entry.path.split('/'));
    let stat;
    try {
      stat = fs.lstatSync(filePath);
      if (!stat.isFile()) throw new Error('not a regular file');
    } catch (error) {
      failures.push(`${entry.path}: ${error.message}`);
      continue;
    }
    if (stat.size !== entry.size_bytes) failures.push(`${entry.path}: size mismatch (${stat.size} != ${entry.size_bytes})`);
    let sha256;
    try {
      sha256 = await hashFile(filePath);
    } catch (error) {
      failures.push(`${entry.path}: ${error.message}`);
      continue;
    }
    if (sha256 !== entry.sha256) failures.push(`${entry.path}: SHA-256 mismatch`);
  }

  if (failures.length) {
    console.error(`Bundle verification failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Verified ${manifest.files.length} GEO answer review bundle file${manifest.files.length === 1 ? '' : 's'}; all recorded sizes and SHA-256 checksums match.`);
}

verifyFiles().catch((error) => {
  console.error(`Bundle verification failed: ${error.message}`);
  process.exitCode = 1;
});
NODE
