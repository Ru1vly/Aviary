#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const usage = 'Usage: pnpm run geo:repeatability:gate -- <comparison.json> <rules.json> <output.json>';
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`${usage}\nFails when a configured prompt-balanced citation repeatability decline is supported by its upper 95% bootstrap bound.`);
  process.exit(0);
}
if (args[0] === '--version') {
  const packageInfo = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(packageInfo.version);
  process.exit(0);
}
if (args.length !== 3) { console.error(usage); process.exit(2); }
const [comparisonPath, rulesPath, outputPath] = args.map((value) => resolve(value));
const readJson = async (path) => {
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`Input is not a regular file: ${path}`);
  if (info.size > 100 * 1024 * 1024) throw new Error(`Input exceeds the 100 MiB limit: ${path}`);
  return JSON.parse(await readFile(path, 'utf8'));
};
const [comparison, rules] = await Promise.all([readJson(comparisonPath), readJson(rulesPath)]);
if (comparison?.schemaVersion !== 1 || !Array.isArray(comparison.providerContextMetricRows)) throw new Error('Comparison JSON must use GEO citation repeatability comparison schema version 1.');
if (rules?.schemaVersion !== 1 || !Array.isArray(rules.rules) || rules.rules.length === 0) throw new Error('Rules JSON must contain schemaVersion 1 and at least one rule.');
if (rules.rules.length > 100) throw new Error('Rules JSON exceeds the limit of 100 rules.');
const metrics = new Set(['citationSetJaccard', 'topThreeJaccard', 'citationDomainJaccard', 'topThreeDomainJaccard', 'citationUrlRboP90', 'citationDomainRboP90', 'ownedCitationPresenceAgreement', 'ownedFirstPositionPersistence']);
const method = comparison.method;
const bootstrap = method?.bootstrap;
const signTest = method?.signTest;
const ownedSets = method?.ownedDomainSetSha256;
if (comparison.providerContextMetricRows.length > 1_600_000) throw new Error('Comparison JSON exceeds the limit of 1,600,000 rows.');
if (method?.pairing !== 'SHA-256 prompt ID within exact provider/model/surface/locale/topic/intent context'
  || method?.delta !== 'current minus baseline prompt-level mean' || method?.equalPromptWeight !== true
  || bootstrap?.requestedIterations !== 2000
  || !Number.isInteger(bootstrap?.intervalDrawLimit) || bootstrap.intervalDrawLimit < 0 || bootstrap.intervalDrawLimit > 2000
  || !Number.isInteger(bootstrap?.budgetCapacityIterations) || bootstrap.budgetCapacityIterations < 0 || bootstrap.budgetCapacityIterations > 2000
  || bootstrap?.promptMetricSampleBudget !== 10_000_000 || bootstrap?.cluster !== 'matched exact prompt' || bootstrap?.deterministic !== true
  || signTest?.test !== 'exact two-sided sign test on non-tied prompt deltas'
  || signTest?.multiplicity !== 'Holm adjustment across all provider/context/metric rows with at least two non-tied prompts'
  || signTest?.maximumWorkTerms !== 5_000_000 || !Number.isInteger(signTest?.workTerms) || signTest.workTerms < 0
  || !Number.isInteger(signTest?.familySize) || signTest.familySize < 0
  || !['complete', 'no-testable-rows', 'suppressed-work-cap'].includes(signTest.state)
  || !(ownedSets?.baseline === null || /^[a-f0-9]{64}$/.test(ownedSets?.baseline ?? ''))
  || !(ownedSets?.current === null || /^[a-f0-9]{64}$/.test(ownedSets?.current ?? ''))
  || ownedSets?.match !== (ownedSets.baseline !== null && ownedSets.current !== null && ownedSets.baseline === ownedSets.current)
  || typeof comparison.baselineInput !== 'string' || typeof comparison.currentInput !== 'string'
  || !Number.isInteger(comparison.skippedBaselineRows) || comparison.skippedBaselineRows < 0
  || !Number.isInteger(comparison.skippedCurrentRows) || comparison.skippedCurrentRows < 0
  || !Number.isInteger(comparison.metricCount) || comparison.metricCount < 1) {
  throw new Error('Comparison JSON metadata is incomplete or incompatible with GEO citation repeatability comparison schema version 1.');
}
let observedSignTestWorkTerms = 0;
let observedSignTestFamilySize = 0;
for (const [index, row] of comparison.providerContextMetricRows.entries()) {
  if (!row || typeof row !== 'object' || !metrics.has(row.metric) || typeof row.provider !== 'string' || !row.provider.trim()) throw new Error(`Comparison JSON row ${index + 1} has an invalid provider or metric.`);
  for (const key of ['model', 'surface', 'locale', 'topic', 'intent']) if (typeof row[key] !== 'string') throw new Error(`Comparison JSON row ${index + 1} has an invalid ${key} context.`);
  if (!['estimated', 'one-prompt', 'no-comparable-prompts', 'work-budget-exceeded'].includes(row.intervalState)) throw new Error(`Comparison JSON row ${index + 1} has an invalid interval state.`);
  if (!Number.isInteger(row.comparablePrompts) || row.comparablePrompts < 0 || row.comparablePrompts > 200_000) throw new Error(`Comparison JSON row ${index + 1} has an invalid comparable-prompt count.`);
  if (!Number.isInteger(row.positivePromptChanges) || !Number.isInteger(row.negativePromptChanges) || !Number.isInteger(row.tiedPromptChanges)
    || row.positivePromptChanges < 0 || row.negativePromptChanges < 0 || row.tiedPromptChanges < 0
    || row.signTestNonTiedPrompts !== row.positivePromptChanges + row.negativePromptChanges
    || row.signTestNonTiedPrompts + row.tiedPromptChanges !== row.comparablePrompts
    || !['available', 'insufficient-nontied-prompts', 'suppressed-work-cap'].includes(row.signTestState)) throw new Error(`Comparison JSON row ${index + 1} has invalid sign-test support.`);
  if (row.signTestNonTiedPrompts >= 2) observedSignTestWorkTerms += Math.min(row.positivePromptChanges, row.negativePromptChanges) + 1;
  const expectedRowSignState = signTest.state === 'suppressed-work-cap' ? 'suppressed-work-cap' : row.signTestNonTiedPrompts >= 2 ? 'available' : 'insufficient-nontied-prompts';
  if (row.signTestState !== expectedRowSignState) throw new Error(`Comparison JSON row ${index + 1} has a sign-test state inconsistent with the report-wide family.`);
  if (row.signTestState === 'available') observedSignTestFamilySize += 1;
  for (const key of ['signTestTwoSidedPValue', 'signTestHolmAdjustedPValue']) if (row[key] !== null && (!Number.isFinite(row[key]) || row[key] < 0 || row[key] > 1)) throw new Error(`Comparison JSON row ${index + 1} has an invalid ${key}.`);
  if (row.signTestState === 'available' && (!Number.isFinite(row.signTestTwoSidedPValue) || !Number.isFinite(row.signTestHolmAdjustedPValue))) throw new Error(`Comparison JSON row ${index + 1} has incomplete adjusted sign-test results.`);
  if (signTest.state === 'suppressed-work-cap' && (row.signTestState !== 'suppressed-work-cap' || row.signTestTwoSidedPValue !== null || row.signTestHolmAdjustedPValue !== null)) throw new Error(`Comparison JSON row ${index + 1} has partial sign-test results despite a suppressed family.`);
  for (const key of ['baselineMean', 'currentMean']) if (row[key] !== null && (!Number.isFinite(row[key]) || row[key] < 0 || row[key] > 1)) throw new Error(`Comparison JSON row ${index + 1} has an invalid ${key}.`);
  for (const key of ['meanPromptDelta', 'ci95Lower', 'ci95Upper']) if (row[key] !== null && (!Number.isFinite(row[key]) || row[key] < -1 || row[key] > 1)) throw new Error(`Comparison JSON row ${index + 1} has an invalid ${key}.`);
  if (row.intervalState === 'estimated' && (!Number.isFinite(row.ci95Lower) || !Number.isFinite(row.ci95Upper) || row.ci95Upper < row.ci95Lower)) throw new Error(`Comparison JSON row ${index + 1} has an invalid estimated confidence interval.`);
}
const expectedSignTestState = observedSignTestWorkTerms > signTest.maximumWorkTerms ? 'suppressed-work-cap' : observedSignTestFamilySize > 0 ? 'complete' : 'no-testable-rows';
if (observedSignTestWorkTerms !== signTest.workTerms || observedSignTestFamilySize !== signTest.familySize || expectedSignTestState !== signTest.state) throw new Error('Comparison JSON sign-test family metadata does not match its rows.');
const selectorKeys = ['provider', 'model', 'surface', 'locale', 'topic', 'intent'];
const ruleKeys = new Set(['id', 'metric', 'maxDecline', 'minimumComparablePrompts', 'requireHolmSignTest', 'alpha', ...selectorKeys]);
const ruleIds = new Set();
for (const [index, rule] of rules.rules.entries()) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error(`Rule ${index + 1} must be an object.`);
  const unknownKeys = Object.keys(rule).filter((key) => !ruleKeys.has(key));
  if (unknownKeys.length) throw new Error(`Rule ${index + 1} has unknown properties: ${unknownKeys.join(', ')}.`);
  if (typeof rule.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(rule.id)) throw new Error(`Rule ${index + 1} needs a unique id (1–80 letters, numbers, dot, underscore, or hyphen).`);
  if (ruleIds.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
  ruleIds.add(rule.id);
  if (!metrics.has(rule.metric)) throw new Error(`Rule ${rule.id} has an unsupported repeatability metric.`);
  if (typeof rule.maxDecline !== 'number' || !Number.isFinite(rule.maxDecline) || rule.maxDecline < 0 || rule.maxDecline > 1) throw new Error(`Rule ${rule.id} maxDecline must be between 0 and 1.`);
  if (!Number.isInteger(rule.minimumComparablePrompts) || rule.minimumComparablePrompts < 2 || rule.minimumComparablePrompts > 200_000) throw new Error(`Rule ${rule.id} minimumComparablePrompts must be an integer from 2 to 200000.`);
  if (rule.requireHolmSignTest !== undefined && typeof rule.requireHolmSignTest !== 'boolean') throw new Error(`Rule ${rule.id} requireHolmSignTest must be a Boolean.`);
  if (rule.alpha !== undefined && (typeof rule.alpha !== 'number' || !Number.isFinite(rule.alpha) || rule.alpha < 0 || rule.alpha > 1)) throw new Error(`Rule ${rule.id} alpha must be between 0 and 1.`);
  if (rule.alpha !== undefined && rule.requireHolmSignTest !== true) throw new Error(`Rule ${rule.id} may set alpha only when requireHolmSignTest is true.`);
  for (const key of selectorKeys) if (rule[key] !== undefined && (typeof rule[key] !== 'string' || rule[key].length > 500)) throw new Error(`Rule ${rule.id} selector ${key} must be a string of at most 500 characters.`);
}
const get = (row, key) => key === 'provider' ? row.provider : row[key];
const assessments = rules.rules.map((rule) => {
  const matched = comparison.providerContextMetricRows.filter((row) => row.metric === rule.metric && selectorKeys.every((key) => rule[key] === undefined || get(row, key) === rule[key]));
  const evaluations = matched.map((row) => {
    const support = row.comparablePrompts;
    const intervalValid = row.intervalState === 'estimated'
      && Number.isFinite(row.ci95Lower) && row.ci95Lower >= -1 && row.ci95Lower <= 1
      && Number.isFinite(row.ci95Upper) && row.ci95Upper >= row.ci95Lower && row.ci95Upper <= 1;
    const requireHolmSignTest = rule.requireHolmSignTest === true;
    const alpha = rule.alpha ?? 0.05;
    const signTestValid = row.signTestState === 'available' && Number.isFinite(row.signTestHolmAdjustedPValue);
    let status = 'inconclusive', reason = 'interval-unavailable';
    if (support < rule.minimumComparablePrompts) reason = 'insufficient-comparable-prompts';
    else if (!intervalValid) reason = 'interval-unavailable';
    else if (requireHolmSignTest && !signTestValid) reason = 'holm-sign-test-unavailable';
    else if (row.ci95Upper <= -rule.maxDecline && (!requireHolmSignTest || row.signTestHolmAdjustedPValue <= alpha)) { status = 'failed'; reason = 'supported-decline-exceeds-threshold'; }
    else if (requireHolmSignTest && row.ci95Upper <= -rule.maxDecline) { status = 'passed'; reason = 'decline-not-confirmed-after-holm'; }
    else { status = 'passed'; reason = 'decline-not-supported-at-threshold'; }
    return {
      provider: row.provider, model: row.model, surface: row.surface, locale: row.locale, topic: row.topic, intent: row.intent,
      metric: rule.metric, maxDecline: rule.maxDecline, minimumComparablePrompts: rule.minimumComparablePrompts,
      requireHolmSignTest, alpha: requireHolmSignTest ? alpha : null,
      positivePromptChanges: row.positivePromptChanges, negativePromptChanges: row.negativePromptChanges, tiedPromptChanges: row.tiedPromptChanges,
      signTestNonTiedPrompts: row.signTestNonTiedPrompts, signTestTwoSidedPValue: row.signTestTwoSidedPValue,
      comparablePrompts: support, meanPromptDelta: row.meanPromptDelta, ci95Lower: row.ci95Lower, ci95Upper: row.ci95Upper,
      intervalState: row.intervalState, signTestHolmAdjustedPValue: row.signTestHolmAdjustedPValue, signTestState: row.signTestState, status, reason,
    };
  });
  if (evaluations.length === 0) evaluations.push({ metric: rule.metric, status: 'inconclusive', reason: 'no-matching-comparison-rows' });
  const status = evaluations.some((item) => item.status === 'failed') ? 'failed' : evaluations.some((item) => item.status === 'inconclusive') ? 'inconclusive' : 'passed';
  return { id: rule.id, configuration: rule, status, matchedRows: matched.length, evaluations };
});
const status = assessments.some((rule) => rule.status === 'failed') ? 'failed' : assessments.some((rule) => rule.status === 'inconclusive') ? 'inconclusive' : 'passed';
const report = {
  schemaVersion: 1,
  method: {
    decision: 'fail only when the comparison 95% percentile-bootstrap upper bound is at or below the negative maximum-decline threshold; optionally also require Holm-adjusted sign-test alpha',
    insufficientSupport: 'inconclusive',
    missingMatch: 'inconclusive',
    multipleComparisonAdjustment: 'bootstrap intervals remain nominal; rules may additionally require the report-wide Holm-adjusted exact sign test',
    signTestFamily: { state: signTest.state, familySize: signTest.familySize, workTerms: signTest.workTerms, maximumWorkTerms: signTest.maximumWorkTerms },
    exitNonzeroStatuses: ['failed', 'inconclusive'],
  },
  comparisonInput: comparisonPath.split(/[\\/]/).at(-1), rulesInput: rulesPath.split(/[\\/]/).at(-1), status, ruleCount: assessments.length, rules: assessments,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`GEO citation repeatability gate: ${status}`);
console.log(`Assessment saved to ${outputPath}`);
if (status !== 'passed') process.exitCode = 1;
