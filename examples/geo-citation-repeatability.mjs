#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, basename, resolve } from 'node:path';

const usage = 'Usage: pnpm run geo:repeatability -- <observations.json> <output.csv> [--owned-domain example.com]';
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`${usage}\nWrites CSV, JSON, and offline HTML. Repeat --owned-domain for multiple owned hosts. Input is limited to 100 MiB and 200,000 observations.`);
  process.exit(0);
}
if (args[0] === '--version') {
  console.log(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
  process.exit(0);
}
if (args.length < 2) { console.error(usage); process.exit(2); }
const inputPath = resolve(args[0]);
const csvPath = resolve(args[1]);
let ownedDomains = [];
for (let i = 2; i < args.length; i++) {
  if (args[i] !== '--owned-domain' || !args[i + 1]) { console.error(usage); process.exit(2); }
  ownedDomains.push(args[++i].toLowerCase().replace(/^\.+|\.+$/g, ''));
}
if (ownedDomains.some((domain) => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(domain))) {
  console.error('Owned domains must be hostnames without a scheme or path.'); process.exit(2);
}
const ownedDomainSetSha256 = createHash('sha256').update(JSON.stringify([...new Set(ownedDomains)].sort())).digest('hex');

const maxInputBytes = 100 * 1024 * 1024;
const inputStats = await stat(inputPath);
if (!inputStats.isFile()) throw new Error(`Input is not a regular file: ${inputPath}`);
if (inputStats.size > maxInputBytes) throw new Error('Observation input exceeds the 100 MiB limit; split it into smaller capture panels.');
const input = JSON.parse(await readFile(inputPath, 'utf8'));
if (input?.schemaVersion !== 1 || !Array.isArray(input.observations)) throw new Error('Expected schemaVersion 1 with an observations array.');
if (input.observations.length > 200_000) throw new Error('Observation input exceeds the 200,000-row limit; split it into smaller capture panels.');
const contextKeys = ['model', 'surface', 'locale', 'topic', 'intent'];
const groups = new Map();
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const keyFor = (row) => JSON.stringify([clean(row.provider), clean(row.prompt), ...contextKeys.map((key) => clean(row[key]))]);
const normalizeUrl = (value) => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = ''; url.search = '';
    url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch { return null; }
};
const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return ''; } };
const isOwned = (url) => ownedDomains.some((domain) => {
  const host = hostOf(url); return host === domain || host.endsWith(`.${domain}`);
});
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const metricNames = ['citationSetJaccard', 'topThreeJaccard', 'citationDomainJaccard', 'topThreeDomainJaccard', 'citationUrlRboP90', 'citationDomainRboP90', ...(ownedDomains.length ? ['ownedCitationPresenceAgreement', 'ownedFirstPositionPersistence'] : [])];
let skippedObservationCount = 0;
let invalidCitationUrlCount = 0;
let invalidCompletenessMetadataCount = 0;
for (const [index, row] of input.observations.entries()) {
  if (!row || typeof row !== 'object' || !clean(row.provider) || !clean(row.prompt) || !Array.isArray(row.citedUrls)) { skippedObservationCount++; continue; }
  const observedAt = typeof row.observedAt === 'string' ? Date.parse(row.observedAt) : NaN;
  if (!Number.isFinite(observedAt)) { skippedObservationCount++; continue; }
  const normalizedUrls = row.citedUrls.map(normalizeUrl);
  const invalidUrls = normalizedUrls.filter((url) => url === null).length;
  invalidCitationUrlCount += invalidUrls;
  const validCompletenessMetadata = row.citationListComplete === undefined || typeof row.citationListComplete === 'boolean';
  if (!validCompletenessMetadata) invalidCompletenessMetadataCount++;
  const citations = [...new Set(normalizedUrls.filter(Boolean))];
  const item = { row, index, observedAt, citations, complete: validCompletenessMetadata && row.citationListComplete !== false && !(row.citationListComplete === undefined && row.citedUrls.length >= 50) && invalidUrls === 0 };
  const key = keyFor(row);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}
const intersectionRatio = (a, b) => {
  if (!a.size && !b.size) return 1;
  let both = 0; for (const value of a) if (b.has(value)) both++;
  return both / (a.size + b.size - both);
};
const rankBiasedOverlap = (left, right, p = 0.9) => {
  const depth = Math.max(left.length, right.length);
  if (!depth) return 1;
  const rightRanks = new Map(right.map((value, index) => [value, index + 1]));
  const sharedAtDepth = Array(depth + 1).fill(0);
  left.forEach((value, index) => {
    const rightRank = rightRanks.get(value);
    if (rightRank !== undefined) sharedAtDepth[Math.max(index + 1, rightRank)]++;
  });
  let shared = 0, weighted = 0, agreementAtDepth = 0;
  for (let d = 1; d <= depth; d++) {
    shared += sharedAtDepth[d];
    agreementAtDepth = shared / d;
    weighted += (1 - p) * (p ** (d - 1)) * agreementAtDepth;
  }
  return Math.min(1, weighted + (p ** depth) * agreementAtDepth);
};
const counts = new Map();
const promptDetails = [];
for (const entries of groups.values()) {
  entries.sort((a, b) => a.observedAt - b.observedAt || a.index - b.index);
  const first = entries[0].row;
  const summaryKey = JSON.stringify([clean(first.provider), ...contextKeys.map((key) => clean(first[key]))]);
  if (!counts.has(summaryKey)) counts.set(summaryKey, { provider: clean(first.provider), context: Object.fromEntries(contextKeys.map((key) => [key, clean(first[key])])), promptRows: [], pairs: 0, excludedIncompletePairs: 0, excludedSimultaneousTimestampPairs: 0, excludedAmbiguousTimestampBoundaryPairs: 0, singletonPrompts: 0, firstObservedAt: null, lastObservedAt: null });
  const output = counts.get(summaryKey);
  output.firstObservedAt = output.firstObservedAt === null ? entries[0].observedAt : Math.min(output.firstObservedAt, entries[0].observedAt);
  output.lastObservedAt = output.lastObservedAt === null ? entries.at(-1).observedAt : Math.max(output.lastObservedAt, entries.at(-1).observedAt);
  if (entries.length < 2) output.singletonPrompts++;
  const timestampCounts = new Map();
  for (const entry of entries) timestampCounts.set(entry.observedAt, (timestampCounts.get(entry.observedAt) ?? 0) + 1);
  const pairs = [];
  let promptExcludedIncompletePairs = 0;
  let promptExcludedSimultaneousTimestampPairs = 0;
  let promptExcludedAmbiguousTimestampBoundaryPairs = 0;
  for (let i = 1; i < entries.length; i++) {
    const before = entries[i - 1], after = entries[i];
    if (before.observedAt === after.observedAt) { output.excludedSimultaneousTimestampPairs++; promptExcludedSimultaneousTimestampPairs++; continue; }
    if (timestampCounts.get(before.observedAt) > 1 || timestampCounts.get(after.observedAt) > 1) { output.excludedAmbiguousTimestampBoundaryPairs++; promptExcludedAmbiguousTimestampBoundaryPairs++; continue; }
    if (!before.complete || !after.complete) { output.excludedIncompletePairs++; promptExcludedIncompletePairs++; continue; }
    const beforeSet = new Set(before.citations), afterSet = new Set(after.citations);
    const beforeTop = new Set(before.citations.slice(0, 3)), afterTop = new Set(after.citations.slice(0, 3));
    const beforeDomains = new Set(before.citations.map(hostOf)), afterDomains = new Set(after.citations.map(hostOf));
    const beforeTopDomains = new Set(before.citations.slice(0, 3).map(hostOf)), afterTopDomains = new Set(after.citations.slice(0, 3).map(hostOf));
    const ownedRank = (list) => list.findIndex(isOwned) < 0 ? null : list.findIndex(isOwned) + 1;
    const beforeRank = ownedRank(before.citations), afterRank = ownedRank(after.citations);
    pairs.push({
      citationSetJaccard: intersectionRatio(beforeSet, afterSet),
      topThreeJaccard: intersectionRatio(beforeTop, afterTop),
      citationDomainJaccard: intersectionRatio(beforeDomains, afterDomains),
      topThreeDomainJaccard: intersectionRatio(beforeTopDomains, afterTopDomains),
      citationUrlRboP90: rankBiasedOverlap(before.citations, after.citations),
      citationDomainRboP90: rankBiasedOverlap([...beforeDomains], [...afterDomains]),
      ownedCitationPresenceAgreement: ownedDomains.length ? Number((beforeRank !== null) === (afterRank !== null)) : null,
      ownedFirstPositionPersistence: ownedDomains.length ? Number(beforeRank === 1 && afterRank === 1) : null,
      gapDays: (after.observedAt - before.observedAt) / 86400000,
    });
  }
  if (pairs.length) { output.promptRows.push({ promptKey: keyFor(first), pairs }); output.pairs += pairs.length; }
  else if (entries.length >= 2) output.singletonPrompts++;
  const detail = {
    promptIdSha256: createHash('sha256').update(clean(first.prompt)).digest('hex'),
    ownedDomainSetSha256,
    provider: clean(first.provider), ...Object.fromEntries(contextKeys.map((key) => [key, clean(first[key])])),
    firstCaptureAtUtc: new Date(entries[0].observedAt).toISOString(), lastCaptureAtUtc: new Date(entries.at(-1).observedAt).toISOString(),
    adjacentCapturePairs: pairs.length, excludedIncompletePairs: promptExcludedIncompletePairs,
    excludedSimultaneousTimestampPairs: promptExcludedSimultaneousTimestampPairs,
    excludedAmbiguousTimestampBoundaryPairs: promptExcludedAmbiguousTimestampBoundaryPairs,
    citationListCompleteness: promptExcludedIncompletePairs ? 'incomplete-pairs-excluded' : pairs.length ? 'comparable' : 'no-comparable-adjacent-pair',
  };
  for (const metric of metricNames) detail[metric] = mean(pairs.map((pair) => pair[metric]).filter(Number.isFinite));
  promptDetails.push(detail);
}

// A deterministic prompt-cluster bootstrap gives each exact prompt one vote.
const bootstrapSampleBudget = 10_000_000;
const metricPromptSlots = [...counts.values()].reduce((total, group) => total + group.promptRows.length * metricNames.length, 0);
const bootstrapBudgetCapacityIterations = metricPromptSlots ? Math.min(2000, Math.floor(bootstrapSampleBudget / metricPromptSlots)) : 0;
const bootstrapIterations = bootstrapBudgetCapacityIterations >= 100 ? bootstrapBudgetCapacityIterations : 0;
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const percentile = (values, p) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * p)]; };
const seedValue = (value) => parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
for (const group of counts.values()) group.promptRows.sort((a, b) => a.promptKey.localeCompare(b.promptKey));
const rows = [...counts.values()].map((group) => {
  const result = { provider: group.provider, ...group.context, firstCaptureAtUtc: new Date(group.firstObservedAt).toISOString(), lastCaptureAtUtc: new Date(group.lastObservedAt).toISOString(), matchedPromptCount: group.promptRows.length, adjacentCapturePairs: group.pairs, excludedIncompletePairs: group.excludedIncompletePairs, excludedSimultaneousTimestampPairs: group.excludedSimultaneousTimestampPairs, excludedAmbiguousTimestampBoundaryPairs: group.excludedAmbiguousTimestampBoundaryPairs, promptsWithoutComparablePairs: group.singletonPrompts };
  for (const metric of metricNames) {
    const promptValues = group.promptRows.map(({ pairs }) => mean(pairs.map((pair) => pair[metric]).filter(Number.isFinite))).filter(Number.isFinite);
    result[`${metric}PromptBalancedMean`] = mean(promptValues);
    if (promptValues.length >= 2 && bootstrapIterations >= 100) {
      const random = rng(seedValue(`${group.provider}|${contextKeys.map((key) => group.context[key]).join('|')}|${metric}|${promptValues.length}`));
      const draws = [];
      for (let iteration = 0; iteration < bootstrapIterations; iteration++) {
        const sample = Array.from({ length: promptValues.length }, () => promptValues[Math.floor(random() * promptValues.length)]);
        draws.push(mean(sample));
      }
      result[`${metric}Ci95Lower`] = percentile(draws, 0.025);
      result[`${metric}Ci95Upper`] = percentile(draws, 0.975);
      result[`${metric}CiState`] = 'estimated';
    } else if (promptValues.length >= 2) {
      result[`${metric}Ci95Lower`] = null; result[`${metric}Ci95Upper`] = null;
      result[`${metric}CiState`] = 'work-budget-exceeded';
    } else {
      result[`${metric}Ci95Lower`] = null; result[`${metric}Ci95Upper`] = null;
      result[`${metric}CiState`] = promptValues.length ? 'one-prompt' : 'no-comparable-prompts';
    }
  }
  const gaps = group.promptRows.flatMap(({ pairs }) => pairs.map((pair) => pair.gapDays));
  result.medianCaptureGapDays = percentile(gaps, 0.5);
  result.citationListCompleteness = group.excludedIncompletePairs ? 'incomplete-pairs-excluded' : group.singletonPrompts ? 'some-prompts-without-adjacent-pairs' : 'all-adjacent-pairs-comparable';
  return result;
}).sort((a, b) => a.provider.localeCompare(b.provider) || contextKeys.reduce((order, key) => order || a[key].localeCompare(b[key]), 0));

const columns = ['provider', ...contextKeys, 'firstCaptureAtUtc', 'lastCaptureAtUtc', 'matchedPromptCount', 'adjacentCapturePairs', 'excludedIncompletePairs', 'excludedSimultaneousTimestampPairs', 'excludedAmbiguousTimestampBoundaryPairs', 'promptsWithoutComparablePairs', 'medianCaptureGapDays', 'citationListCompleteness', ...metricNames.flatMap((name) => [`${name}PromptBalancedMean`, `${name}Ci95Lower`, `${name}Ci95Upper`, `${name}CiState`])];
const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n';
await mkdir(dirname(csvPath), { recursive: true });
await writeFile(csvPath, csv, 'utf8');
const promptDetailPath = csvPath.replace(/\.csv$/i, '') + '-prompts.csv';
const promptDetailColumns = ['promptIdSha256', 'ownedDomainSetSha256', 'provider', ...contextKeys, 'firstCaptureAtUtc', 'lastCaptureAtUtc', 'adjacentCapturePairs', 'excludedIncompletePairs', 'excludedSimultaneousTimestampPairs', 'excludedAmbiguousTimestampBoundaryPairs', 'citationListCompleteness', ...metricNames];
promptDetails.sort((a, b) => a.provider.localeCompare(b.provider) || contextKeys.reduce((order, key) => order || a[key].localeCompare(b[key]), 0) || a.promptIdSha256.localeCompare(b.promptIdSha256));
const promptDetailCsv = [promptDetailColumns.map(csvCell).join(','), ...promptDetails.map((row) => promptDetailColumns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n';
await writeFile(promptDetailPath, promptDetailCsv, 'utf8');
const jsonPath = csvPath.replace(/\.csv$/i, '') + '.json';
await writeFile(jsonPath, JSON.stringify({ schemaVersion: 1, method: { adjacentCapturesOnly: true, simultaneousTimestampPolicy: 'exclude equal-time pairs and adjacent pairs touching duplicated timestamps', normalizedCitationIdentity: 'HTTP(S) URL with lowercase dot-trimmed host; default port, query, fragment, and trailing non-root slash removed', equalPromptWeight: true, promptDetailCsv: basename(promptDetailPath), promptIdentifiers: 'SHA-256 of trimmed exact prompt text; raw prompt text omitted', invalidCitationUrlsMakeListIncomplete: true, invalidCompletenessMetadataMakesListIncomplete: true, rankBiasedOverlapP: 0.9, rankBiasedOverlapEstimator: 'finite extrapolated; residual assigned final observed prefix overlap', bootstrap: { requestedIterations: 2000, intervalDrawLimit: bootstrapIterations, budgetCapacityIterations: bootstrapBudgetCapacityIterations, promptMetricSampleBudget: bootstrapSampleBudget, cluster: 'exact provider/prompt/context group', deterministic: true }, ownedDomains, ownedDomainSetSha256 }, input: basename(inputPath), sourceObservationCount: input.observations.length, skippedObservationCount, invalidCitationUrlCount, invalidCompletenessMetadataCount, eligiblePromptGroups: groups.size, providerRows: rows }, null, 2) + '\n', 'utf8');
const htmlPath = csvPath.replace(/\.csv$/i, '') + '.html';
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const fmt = (value) => Number.isFinite(value) ? value.toFixed(3) : '—';
const htmlColumns = ['provider', ...contextKeys, 'firstCaptureAtUtc', 'lastCaptureAtUtc', 'matchedPromptCount', 'adjacentCapturePairs', 'excludedIncompletePairs', 'excludedSimultaneousTimestampPairs', 'excludedAmbiguousTimestampBoundaryPairs', 'promptsWithoutComparablePairs', 'citationListCompleteness', ...metricNames];
const htmlHead = htmlColumns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('');
const htmlRowLimit = 500;
const displayedRows = rows.slice(0, htmlRowLimit);
const htmlRows = displayedRows.map((row) => `<tr>${htmlColumns.map((column) => {
  const value = row[column];
  if (metricNames.includes(column)) {
    const lower = row[`${column}Ci95Lower`], upper = row[`${column}Ci95Upper`];
    return `<td>${fmt(value)}${Number.isFinite(lower) && Number.isFinite(upper) ? ` <span class="ci">[${fmt(lower)}, ${fmt(upper)}]</span>` : ` <span class="state">${escapeHtml(row[`${column}CiState`])}</span>`}</td>`;
  }
  return `<td>${escapeHtml(value)}</td>`;
}).join('')}</tr>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>GEO citation repeatability</title><style>:root{color-scheme:light dark;font:16px/1.5 system-ui,sans-serif;background:#101820;color:#e8eff4}body{max-width:1200px;margin:32px auto;padding:0 20px}h1{font-size:1.8rem;text-wrap:balance}.lead,.note{color:#b6c4cf}.notice{border-left:3px solid #e3ad57;padding:10px 14px;background:#1d2a33}.table-wrap{overflow:auto;border:1px solid #394853;border-radius:8px}table{border-collapse:collapse;min-width:100%;font-variant-numeric:tabular-nums}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #394853;white-space:nowrap}th{position:sticky;top:0;background:#1d2a33}tbody tr{content-visibility:auto;contain-intrinsic-size:auto 44px}.ci{color:#9bd8c7}.state{color:#f0c878}a{color:#80d6c0}a:focus-visible,input:focus-visible{outline:3px solid #f0c878;outline-offset:3px}.skip-link{position:absolute;left:-9999px;top:8px;background:#f0c878;color:#101820;padding:8px 12px;z-index:1}.skip-link:focus-visible{left:8px}label{display:block;margin:14px 0 4px}input[type=search]{box-sizing:border-box;width:100%;max-width:440px;padding:9px 10px;border:1px solid #647582;border-radius:6px;background:#1d2a33;color:#e8eff4;font:inherit}</style></head><body><a class="skip-link" href="#repeatability-results">Skip to report results</a><header><h1>GEO citation repeatability</h1><p class="lead">${rows.length} provider/context rows · ${groups.size} exact provider/prompt/context groups · ${input.observations.length} source observations · ${skippedObservationCount} skipped rows · ${invalidCitationUrlCount} invalid citation URLs · ${invalidCompletenessMetadataCount} invalid completeness flags</p><p class="notice">Describes repeated captures in this supplied panel. Prompts are equally weighted. Confidence intervals resample prompts; incomplete adjacent citation lists are excluded and counted. Invalid URLs and invalid completeness flags also make their capture list incomplete.</p></header><main id="repeatability-results"><label for="row-filter">Filter provider/context rows</label><input id="row-filter" name="provider-context-filter" type="search" autocomplete="off" placeholder="Search provider or context"><p id="row-count" aria-live="polite">Showing ${displayedRows.length} of ${rows.length} rows${rows.length > htmlRowLimit ? ` (HTML is capped at ${htmlRowLimit}; all rows are in CSV and JSON)` : ''}</p><div class="table-wrap"><table><caption class="note">Metric columns show prompt-balanced means; bracketed values are percentile-bootstrap 95% intervals.</caption><thead><tr>${htmlHead}</tr></thead><tbody>${htmlRows || `<tr><td colspan="${htmlColumns.length}">No comparable repeated-prompt groups were found.</td></tr>`}</tbody></table></div><p>Download <a href="${escapeHtml(basename(csvPath))}">summary CSV</a>, <a href="${escapeHtml(basename(promptDetailPath))}">prompt detail CSV</a>, or inspect the <a href="${escapeHtml(basename(jsonPath))}">versioned JSON</a>.</p><p class="note">Prompt IDs are SHA-256 hashes; raw prompt text is not exported. Citation URLs are normalized by removing query strings and fragments. ${ownedDomains.length ? `Owned domains: ${ownedDomains.map(escapeHtml).join(', ')}.` : 'Owned-citation metrics are not enabled.'}</p></main><script>const filter=document.querySelector('#row-filter');filter.addEventListener('input',()=>{const query=filter.value.trim().toLowerCase();const rows=[...document.querySelector('tbody').querySelectorAll('tr')];let shown=0;for(const row of rows){const visible=row.textContent.toLowerCase().includes(query);row.hidden=!visible;if(visible)shown++;}document.querySelector('#row-count').textContent='Showing '+shown+' of ${displayedRows.length} displayed rows${rows.length > htmlRowLimit ? ` (HTML is capped at ${htmlRowLimit}; all rows are in CSV and JSON)` : ''}';});</script></body></html>`;
await writeFile(htmlPath, html, 'utf8');
console.log(`GEO citation repeatability CSV saved to ${csvPath}`);
console.log(`GEO citation repeatability prompt detail CSV saved to ${promptDetailPath}`);
console.log(`GEO citation repeatability JSON saved to ${jsonPath}`);
console.log(`GEO citation repeatability HTML saved to ${htmlPath}`);
