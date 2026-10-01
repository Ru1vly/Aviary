#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const [firstPath, secondPath, outputPath] = args;
if (!firstPath || !secondPath || args.length > 3) {
  fail(
    'Usage: node examples/geo-render-parity.mjs <first-batch.json> <second-batch.json> [output.md]'
  );
}

function readBatch(file) {
  try {
    const input = JSON.parse(fs.readFileSync(file, 'utf8'));
    const report = Array.isArray(input.results) ? input : input.report;
    if (!Array.isArray(report?.results)) fail(`${file} must contain a batch results array.`);
    return report;
  } catch (error) {
    fail(`Cannot read batch report ${file}: ${error.message}`);
  }
}

function routeKey(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`Batch report contains an invalid URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`Batch report route identity must use HTTP or HTTPS: ${value}`);
  }
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '/';
  const params = [...url.searchParams.entries()].sort(
    ([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue)
  );
  const query = new URLSearchParams(params).toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

function extract(batch, source) {
  const map = new Map();
  const waits = new Set();
  const settles = new Set();
  const categories = new Set();
  for (const item of batch.results) {
    if (!item.report) continue;
    const key = routeKey(item.url);
    if (map.has(key)) fail(`${source} contains duplicate route identity ${key}.`);
    const checks = item.report.checks?.geo;
    const profile = Array.isArray(checks)
      ? checks.find((check) => check.name === 'source-rendered-content-profile')?.details
      : undefined;
    if (!profile?.assessed || !Number.isFinite(profile.renderedPhraseCoveragePercent)) continue;
    map.set(key, {
      url: item.url,
      coverage: profile.renderedPhraseCoveragePercent,
      sourceWords: profile.sourceWordCount,
      renderedWords: profile.renderedWordCount,
    });
    if (item.report.navigationWaitUntil) waits.add(item.report.navigationWaitUntil);
    if (Number.isInteger(item.report.settleAfterNavigationMs))
      settles.add(item.report.settleAfterNavigationMs);
    for (const [category, rows] of Object.entries(item.report.checks ?? {})) {
      if (Array.isArray(rows) && rows.length > 0) categories.add(category);
    }
  }
  return { map, waits, settles, categories };
}

const firstBatch = readBatch(firstPath);
const secondBatch = readBatch(secondPath);
const first = extract(firstBatch, 'First audit');
const second = extract(secondBatch, 'Second audit');
if (
  first.settles.size !== 1 ||
  second.settles.size !== 1 ||
  [...first.settles][0] !== [...second.settles][0]
) {
  fail(
    'Both audits must have the same recorded settleAfterNavigationMs value for parity comparison.'
  );
}
const waitUntil = [...first.waits][0];
const settleAfterNavigationMs = [...first.settles][0];
if (
  first.waits.size !== 1 ||
  second.waits.size !== 1 ||
  !['domcontentloaded', 'load', 'networkidle'].includes(waitUntil) ||
  waitUntil !== [...second.waits][0]
) {
  fail('Both audits must have the same recorded navigationWaitUntil value for parity comparison.');
}
if ([...first.categories].sort().join(',') !== [...second.categories].sort().join(',')) {
  fail('Both audits must have the same non-empty checker category scope.');
}

const shared = [...first.map.keys()]
  .filter((key) => second.map.has(key))
  .map((route) => ({ route, first: first.map.get(route), second: second.map.get(route) }))
  .sort(
    (a, b) =>
      Math.abs(b.second.coverage - b.first.coverage) -
      Math.abs(a.second.coverage - a.first.coverage)
  );
const firstOnly = [...first.map.keys()].filter((route) => !second.map.has(route));
const secondOnly = [...second.map.keys()].filter((route) => !first.map.has(route));
const formatRoutes = (routes) =>
  routes.length
    ? `${routes
        .slice(0, 100)
        .map((route) => `\`${route}\``)
        .join(', ')}${routes.length > 100 ? `, and ${routes.length - 100} more` : ''}`
    : 'none';
const firstMean = shared.length
  ? shared.reduce((sum, item) => sum + item.first.coverage, 0) / shared.length
  : null;
const secondMean = shared.length
  ? shared.reduce((sum, item) => sum + item.second.coverage, 0) / shared.length
  : null;
const firstHost = first.map.values().next().value?.url
  ? new URL(first.map.values().next().value.url).host
  : 'first audit';
const secondHost = second.map.values().next().value?.url
  ? new URL(second.map.values().next().value.url).host
  : 'second audit';
const firstDate = firstBatch.timestamp ? new Date(firstBatch.timestamp).toISOString() : 'unknown';
const secondDate = secondBatch.timestamp
  ? new Date(secondBatch.timestamp).toISOString()
  : 'unknown';

const lines = [
  `# GEO source/rendered parity: ${firstHost} vs ${secondHost}`,
  '',
  `- First audit: ${firstDate}; ${first.map.size} measured routes.`,
  `- Second audit: ${secondDate}; ${second.map.size} measured routes.`,
  `- Batch completion: first ${firstBatch.summary?.completedUrls ?? 'n/a'}/${firstBatch.summary?.requestedUrls ?? 'n/a'} complete (${firstBatch.summary?.failedUrls ?? 'n/a'} failed, ${Math.max(0, (firstBatch.summary?.completedUrls ?? first.map.size) - first.map.size)} unprofiled); second ${secondBatch.summary?.completedUrls ?? 'n/a'}/${secondBatch.summary?.requestedUrls ?? 'n/a'} complete (${secondBatch.summary?.failedUrls ?? 'n/a'} failed, ${Math.max(0, (secondBatch.summary?.completedUrls ?? second.map.size) - second.map.size)} unprofiled). Failed or unprofiled routes are excluded from the comparison.`,
  `- Shared route identities: ${shared.length}; navigation wait: ${waitUntil}; settle delay: ${settleAfterNavigationMs} ms; categories: ${[...first.categories].join(', ')}.`,
  `- Mean source/rendered phrase coverage on shared routes: ${firstMean === null ? 'n/a' : `${firstMean.toFixed(1)}%`} vs ${secondMean === null ? 'n/a' : `${secondMean.toFixed(1)}%`}.`,
  '',
  'Routes are paired by normalized pathname and sorted query parameters, ignoring host and a trailing slash. This measures initial-HTML/browser-render phrase overlap for each audit; it does not verify that paired pages have identical content or predict crawler behavior.',
  '',
  '## Shared routes',
  '',
  '| Route | First coverage | Second coverage | Difference | Source words (first / second) | Rendered words (first / second) |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
];

if (shared.length === 0) {
  lines.push('| No comparable routes | — | — | — | — | — |');
} else {
  for (const item of shared.slice(0, 100)) {
    const difference = item.second.coverage - item.first.coverage;
    lines.push(
      `| \`${item.route}\` | ${item.first.coverage.toFixed(1)}% | ${item.second.coverage.toFixed(1)}% | ${difference >= 0 ? '+' : ''}${difference.toFixed(1)} pp | ${item.first.sourceWords ?? 'n/a'} / ${item.second.sourceWords ?? 'n/a'} | ${item.first.renderedWords ?? 'n/a'} / ${item.second.renderedWords ?? 'n/a'} |`
    );
  }
  if (shared.length > 100)
    lines.push('', `Showing the 100 largest differences of ${shared.length} shared routes.`);
}

lines.push('', '## Unmatched routes', '');
lines.push(`- First audit only (${firstOnly.length}): ${formatRoutes(firstOnly)}.`);
lines.push(`- Second audit only (${secondOnly.length}): ${formatRoutes(secondOnly)}.`);
lines.push(
  '',
  'Large differences are review cues. Check page-specific content, render timing, cache state, and route implementation before treating them as defects.',
  ''
);

const markdown = lines.join('\n');
if (outputPath) {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, markdown);
} else {
  process.stdout.write(markdown);
}
