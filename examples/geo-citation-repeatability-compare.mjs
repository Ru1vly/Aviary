#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const usage = 'Usage: pnpm run geo:repeatability:compare -- <baseline-prompts.csv> <current-prompts.csv> <output.csv>';
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`${usage}\nCompares paired SHA-256 prompt IDs within the same provider and recorded context. Writes prompt-bootstrap intervals and a Holm-adjusted exact sign-test family to CSV, JSON, and offline HTML.`);
  process.exit(0);
}
if (args[0] === '--version') {
  console.log(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
  process.exit(0);
}
if (args.length !== 3) { console.error(usage); process.exit(2); }
const [baselinePath, currentPath, outputPath] = args.map((value) => resolve(value));
const contextKeys = ['model', 'surface', 'locale', 'topic', 'intent'];
const metricCandidates = ['citationSetJaccard', 'topThreeJaccard', 'citationDomainJaccard', 'topThreeDomainJaccard', 'citationUrlRboP90', 'citationDomainRboP90', 'ownedCitationPresenceAgreement', 'ownedFirstPositionPersistence'];
const requiredColumns = ['promptIdSha256', 'provider', ...contextKeys, 'citationListCompleteness'];
const maxBytes = 100 * 1024 * 1024;

const parseCsv = (text) => {
  const records = [];
  let record = [], field = '', quoted = false, closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
    } else if (closedQuote && char !== ',' && char !== '\r' && char !== '\n') throw new Error('CSV contains characters after a closing quote.');
    else if (char === '"' && field.length === 0) quoted = true;
    else if (char === '"') throw new Error('CSV contains a quote inside an unquoted field.');
    else if (char === ',') { record.push(field); field = ''; closedQuote = false; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record.push(field); field = ''; closedQuote = false;
      if (record.some((value) => value.length > 0)) {
        records.push(record);
        if (records.length > 200_001) throw new Error('CSV exceeds the 200,000-row limit.');
      }
      record = [];
    } else field += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field.length || record.length) {
    record.push(field); records.push(record);
    if (records.length > 200_001) throw new Error('CSV exceeds the 200,000-row limit.');
  }
  const headers = records.shift() ?? [];
  if (headers.some((header) => !header.trim())) throw new Error('CSV contains an empty header.');
  if (headers.length !== new Set(headers).size) throw new Error('CSV contains duplicate headers.');
  if (records.some((values) => values.length !== headers.length)) throw new Error('CSV contains a row whose field count does not match its header.');
  return { headers, rows: records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]]))) };
};
const load = async (filePath) => {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error(`Input is not a regular file: ${filePath}`);
  if (info.size > maxBytes) throw new Error(`Input exceeds the 100 MiB limit: ${filePath}`);
  return parseCsv((await readFile(filePath, 'utf8')).replace(/^\uFEFF/, ''));
};
const [baseline, current] = await Promise.all([load(baselinePath), load(currentPath)]);
for (const [label, table] of [['baseline', baseline], ['current', current]]) {
  const missing = requiredColumns.filter((column) => !table.headers.includes(column));
  if (missing.length) throw new Error(`${label} prompt detail CSV is missing columns: ${missing.join(', ')}`);
}
const metrics = metricCandidates.filter((metric) => baseline.headers.includes(metric) && current.headers.includes(metric));
const baselineMetrics = metricCandidates.filter((metric) => baseline.headers.includes(metric));
const currentMetrics = metricCandidates.filter((metric) => current.headers.includes(metric));
if (JSON.stringify(baselineMetrics) !== JSON.stringify(currentMetrics)) throw new Error('Baseline and current prompt detail CSVs use different metric configurations; use the same owned-domain options for both.');
if (!metrics.length) throw new Error('No shared repeatability metrics were found in the input CSVs.');
const normalizedRows = (table, label) => {
  const map = new Map();
  let skipped = 0;
  for (const row of table.rows) {
    const promptId = row.promptIdSha256.trim().toLowerCase();
    const provider = row.provider.trim();
    if (!/^[a-f0-9]{64}$/.test(promptId) || !provider) { skipped++; continue; }
    const context = Object.fromEntries(contextKeys.map((key) => [key, row[key].trim()]));
    const key = JSON.stringify([provider, ...contextKeys.map((name) => context[name]), promptId]);
    if (map.has(key)) throw new Error(`${label} prompt detail CSV has a duplicate provider/context/prompt ID row.`);
    map.set(key, { key, promptId, provider, context, row });
  }
  return { map, skipped };
};
const baselineRows = normalizedRows(baseline, 'Baseline');
const currentRows = normalizedRows(current, 'Current');
const ownedDomainSets = (table, label) => {
  if (!table.headers.includes('ownedDomainSetSha256')) return null;
  const values = new Set(table.rows.map((row) => row.ownedDomainSetSha256.trim().toLowerCase()));
  if (values.size === 0) return null;
  if (values.size !== 1 || !/^[a-f0-9]{64}$/.test([...values][0] ?? '')) throw new Error(`${label} prompt detail CSV must contain one valid ownedDomainSetSha256 value on every row.`);
  return [...values][0];
};
const baselineOwnedDomainSet = ownedDomainSets(baseline, 'Baseline');
const currentOwnedDomainSet = ownedDomainSets(current, 'Current');
const hasOwnedMetrics = metrics.includes('ownedCitationPresenceAgreement') || metrics.includes('ownedFirstPositionPersistence');
if (hasOwnedMetrics && (!baselineOwnedDomainSet || !currentOwnedDomainSet)) throw new Error('Owned-citation metrics require prompt detail exports with ownedDomainSetSha256 metadata; regenerate both exports with the current geo:repeatability command.');
if (hasOwnedMetrics && baselineOwnedDomainSet !== currentOwnedDomainSet) throw new Error('Baseline and current prompt detail CSVs use different owned-domain sets; repeat the comparison with matching --owned-domain options.');
const joined = new Map();
for (const [side, source] of [['baseline', baselineRows.map], ['current', currentRows.map]]) {
  for (const item of source.values()) {
    const groupKey = JSON.stringify([item.provider, ...contextKeys.map((key) => item.context[key])]);
    if (!joined.has(groupKey)) joined.set(groupKey, { provider: item.provider, context: item.context, prompts: new Map() });
    const group = joined.get(groupKey);
    if (!group.prompts.has(item.promptId)) group.prompts.set(item.promptId, {});
    group.prompts.get(item.promptId)[side] = item.row;
  }
}
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const percentile = (values, p) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * p)]; };
const exactTwoSidedSignTestPValue = (positive, negative) => {
  const discordant = positive + negative;
  if (discordant < 2) return null;
  const lowerTail = Math.min(positive, negative);
  let logProbability = -discordant * Math.LN2;
  let logCumulativeProbability = Number.NEGATIVE_INFINITY;
  for (let successes = 0; successes <= lowerTail; successes++) {
    const maximum = Math.max(logCumulativeProbability, logProbability);
    logCumulativeProbability = maximum + Math.log(Math.exp(logCumulativeProbability - maximum) + Math.exp(logProbability - maximum));
    if (successes < lowerTail) logProbability += Math.log(discordant - successes) - Math.log(successes + 1);
  }
  return Math.min(1, 2 * Math.exp(logCumulativeProbability));
};
const parseMetric = (row, name) => {
  const value = row?.[name];
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
};
const metricPromptSlots = [...joined.values()].reduce((sum, group) => sum + [...group.prompts.values()].filter((pair) => pair.baseline && pair.current).length * metrics.length, 0);
const bootstrapBudget = 10_000_000;
const budgetCapacityIterations = metricPromptSlots ? Math.min(2000, Math.floor(bootstrapBudget / metricPromptSlots)) : 0;
const intervalDrawLimit = budgetCapacityIterations >= 100 ? budgetCapacityIterations : 0;
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let value = Math.imul(seed ^ seed >>> 15, 1 | seed); value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value; return ((value ^ value >>> 14) >>> 0) / 4294967296; };
const seedValue = (value) => parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
const rows = [];
for (const group of joined.values()) {
  const pairs = [...group.prompts.values()].sort((a, b) => (a.baseline?.promptIdSha256 ?? a.current?.promptIdSha256 ?? '').localeCompare(b.baseline?.promptIdSha256 ?? b.current?.promptIdSha256 ?? ''));
  const shared = pairs.filter((pair) => pair.baseline && pair.current);
  const baselineOnly = pairs.filter((pair) => pair.baseline && !pair.current).length;
  const currentOnly = pairs.filter((pair) => pair.current && !pair.baseline).length;
  for (const metric of metrics) {
    const comparable = shared.map((pair) => ({
      baseline: parseMetric(pair.baseline, metric),
      current: parseMetric(pair.current, metric),
      promptId: pair.baseline.promptIdSha256.trim().toLowerCase(),
    })).filter((pair) => pair.baseline !== null && pair.current !== null).map((pair) => ({ ...pair, delta: pair.current - pair.baseline }));
    const deltas = comparable.map((pair) => pair.delta);
    const baseValues = comparable.map((pair) => pair.baseline), currentValues = comparable.map((pair) => pair.current);
    let lower = null, upper = null, state = comparable.length ? 'one-prompt' : 'no-comparable-prompts';
    if (comparable.length >= 2 && intervalDrawLimit >= 100) {
      const random = rng(seedValue(`${group.provider}|${contextKeys.map((key) => group.context[key]).join('|')}|${metric}|${comparable.length}`));
      const draws = [];
      for (let iteration = 0; iteration < intervalDrawLimit; iteration++) {
        const sample = Array.from({ length: comparable.length }, () => deltas[Math.floor(random() * deltas.length)]);
        draws.push(mean(sample));
      }
      lower = percentile(draws, 0.025); upper = percentile(draws, 0.975); state = 'estimated';
    } else if (comparable.length >= 2) state = 'work-budget-exceeded';
    rows.push({
      provider: group.provider, ...group.context, metric,
      baselineMean: mean(baseValues), currentMean: mean(currentValues), meanPromptDelta: mean(deltas),
      ci95Lower: lower, ci95Upper: upper, intervalState: state,
      comparablePrompts: comparable.length, sharedPrompts: shared.length,
      baselineOnlyPrompts: baselineOnly, currentOnlyPrompts: currentOnly,
      sharedPromptsWithoutMetric: shared.length - comparable.length,
      positivePromptChanges: deltas.filter((value) => value > 0).length,
      negativePromptChanges: deltas.filter((value) => value < 0).length,
      tiedPromptChanges: deltas.filter((value) => value === 0).length,
      signTestNonTiedPrompts: deltas.filter((value) => value !== 0).length,
      signTestTwoSidedPValue: null,
      signTestHolmAdjustedPValue: null,
      signTestState: 'pending',
    });
  }
}
const signTestWorkLimit = 5_000_000;
const signTestWorkTerms = rows.reduce((sum, row) => sum + (row.signTestNonTiedPrompts >= 2 ? Math.min(row.positivePromptChanges, row.negativePromptChanges) + 1 : 0), 0);
const signTestWorkComplete = signTestWorkTerms <= signTestWorkLimit;
const signTestRows = [];
if (signTestWorkComplete) {
  for (const row of rows) {
    if (row.signTestNonTiedPrompts < 2) { row.signTestState = 'insufficient-nontied-prompts'; continue; }
    row.signTestTwoSidedPValue = exactTwoSidedSignTestPValue(row.positivePromptChanges, row.negativePromptChanges);
    row.signTestState = 'available';
    if (row.signTestTwoSidedPValue !== null) signTestRows.push(row);
  }
  signTestRows.sort((a, b) => a.signTestTwoSidedPValue - b.signTestTwoSidedPValue || JSON.stringify([a.provider, ...contextKeys.map((key) => a[key]), a.metric]).localeCompare(JSON.stringify([b.provider, ...contextKeys.map((key) => b[key]), b.metric])));
  let previousAdjusted = 0;
  signTestRows.forEach((row, index) => {
    previousAdjusted = Math.max(previousAdjusted, Math.min(1, row.signTestTwoSidedPValue * (signTestRows.length - index)));
    row.signTestHolmAdjustedPValue = previousAdjusted;
  });
} else {
  for (const row of rows) row.signTestState = 'suppressed-work-cap';
}
rows.sort((a, b) => a.provider.localeCompare(b.provider) || contextKeys.reduce((order, key) => order || a[key].localeCompare(b[key]), 0) || a.metric.localeCompare(b.metric));
const columns = ['provider', ...contextKeys, 'metric', 'baselineMean', 'currentMean', 'meanPromptDelta', 'ci95Lower', 'ci95Upper', 'intervalState', 'comparablePrompts', 'sharedPrompts', 'baselineOnlyPrompts', 'currentOnlyPrompts', 'sharedPromptsWithoutMetric', 'positivePromptChanges', 'negativePromptChanges', 'tiedPromptChanges', 'signTestNonTiedPrompts', 'signTestTwoSidedPValue', 'signTestHolmAdjustedPValue', 'signTestState'];
const csvCell = (value) => { const text = value === null || value === undefined ? '' : String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
const csv = [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n';
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, csv, 'utf8');
const jsonPath = outputPath.replace(/\.csv$/i, '') + '.json';
const json = { schemaVersion: 1, method: { pairing: 'SHA-256 prompt ID within exact provider/model/surface/locale/topic/intent context', delta: 'current minus baseline prompt-level mean', equalPromptWeight: true, ownedDomainSetSha256: { baseline: baselineOwnedDomainSet, current: currentOwnedDomainSet, match: baselineOwnedDomainSet !== null && currentOwnedDomainSet !== null && baselineOwnedDomainSet === currentOwnedDomainSet }, bootstrap: { requestedIterations: 2000, intervalDrawLimit, budgetCapacityIterations, promptMetricSampleBudget: bootstrapBudget, cluster: 'matched exact prompt', deterministic: true }, signTest: { test: 'exact two-sided sign test on non-tied prompt deltas', multiplicity: 'Holm adjustment across all provider/context/metric rows with at least two non-tied prompts', maximumWorkTerms: signTestWorkLimit, workTerms: signTestWorkTerms, familySize: signTestRows.length, state: signTestWorkComplete ? signTestRows.length ? 'complete' : 'no-testable-rows' : 'suppressed-work-cap' } }, baselineInput: basename(baselinePath), currentInput: basename(currentPath), skippedBaselineRows: baselineRows.skipped, skippedCurrentRows: currentRows.skipped, metricCount: metrics.length, providerContextMetricRows: rows };
await writeFile(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
const htmlPath = outputPath.replace(/\.csv$/i, '') + '.html';
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const htmlColumns = ['provider', ...contextKeys, 'metric', 'baselineMean', 'currentMean', 'meanPromptDelta', 'ci95Lower', 'ci95Upper', 'intervalState', 'comparablePrompts', 'sharedPrompts', 'baselineOnlyPrompts', 'currentOnlyPrompts', 'sharedPromptsWithoutMetric', 'positivePromptChanges', 'negativePromptChanges', 'tiedPromptChanges', 'signTestNonTiedPrompts', 'signTestTwoSidedPValue', 'signTestHolmAdjustedPValue', 'signTestState'];
const htmlHead = htmlColumns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('');
const shownRows = rows.slice(0, 500);
const htmlRows = shownRows.map((row) => `<tr>${htmlColumns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>GEO citation repeatability changes</title><style>:root{color-scheme:light dark;font:16px/1.5 system-ui,sans-serif;background:#101820;color:#e8eff4}body{max-width:1200px;margin:32px auto;padding:0 20px}h1{font-size:1.8rem;text-wrap:balance}.note{color:#b6c4cf}.notice{border-left:3px solid #e3ad57;padding:10px 14px;background:#1d2a33}.table-wrap{overflow:auto;border:1px solid #394853;border-radius:8px}table{border-collapse:collapse;min-width:100%;font-variant-numeric:tabular-nums}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #394853;white-space:nowrap}th{position:sticky;top:0;background:#1d2a33}tbody tr{content-visibility:auto;contain-intrinsic-size:auto 42px}a{color:#80d6c0}a:focus-visible,input:focus-visible{outline:3px solid #f0c878;outline-offset:3px}.skip{position:absolute;left:-9999px;top:8px;background:#f0c878;color:#101820;padding:8px}.skip:focus-visible{left:8px}label{display:block;margin:14px 0 4px}input{box-sizing:border-box;width:100%;max-width:420px;padding:9px;background:#1d2a33;color:#e8eff4;border:1px solid #647582;border-radius:6px}</style></head><body><a class="skip" href="#results">Skip to report results</a><header><h1>GEO citation repeatability changes</h1><p class="note">${rows.length} provider/context/metric rows · ${baselineRows.map.size} baseline prompts · ${currentRows.map.size} current prompts</p><p class="notice">Paired prompt-level descriptive changes. Positive values mean higher current repeatability for that metric. The exact sign test excludes ties and uses a report-wide Holm adjustment; bootstrap intervals remain nominal. These are changes in the supplied samples, not visibility or causal estimates.</p></header><main id="results"><label for="filter">Filter provider/context/metric rows</label><input id="filter" name="repeatability-filter" type="search" autocomplete="off" placeholder="Search report rows"><p id="count" aria-live="polite">Showing ${shownRows.length} of ${rows.length} rows${rows.length > 500 ? ' (HTML capped at 500; CSV and JSON contain all rows)' : ''}</p><div class="table-wrap"><table><caption class="note">Mean changes are current minus baseline; intervals resample matched exact prompts.</caption><thead><tr>${htmlHead}</tr></thead><tbody>${htmlRows || `<tr><td colspan="${htmlColumns.length}">No provider/context rows were available.</td></tr>`}</tbody></table></div><p><a href="${escapeHtml(basename(outputPath))}">CSV</a> · <a href="${escapeHtml(basename(jsonPath))}">Versioned JSON</a></p></main><script>const input=document.querySelector('#filter');input.addEventListener('input',()=>{const query=input.value.trim().toLowerCase();const items=[...document.querySelector('tbody').querySelectorAll('tr')];let count=0;for(const item of items){const show=item.textContent.toLowerCase().includes(query);item.hidden=!show;if(show)count++;}document.querySelector('#count').textContent='Showing '+count+' of ${shownRows.length} displayed rows${rows.length > 500 ? ' (HTML capped at 500; CSV and JSON contain all rows)' : ''}';});</script></body></html>`;
await writeFile(htmlPath, html, 'utf8');
console.log(`GEO citation repeatability comparison CSV saved to ${outputPath}`);
console.log(`GEO citation repeatability comparison JSON saved to ${jsonPath}`);
console.log(`GEO citation repeatability comparison HTML saved to ${htmlPath}`);
