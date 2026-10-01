#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const VERSION = '1.5.0';
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_OBSERVATIONS = 20_000;
const MAX_HTML_CONTEXT_ROWS = 500;
const DEFAULT_THRESHOLDS = {
  contextShareShiftPp: 10,
  contextMixTotalVariationPp: 10,
  promptMixTotalVariationPp: 10,
  promptJaccardPctBelow: 50,
  incompleteListPctAbove: 10,
  duplicateCapturePctAbove: 0,
  captureWindowGapDaysAbove: 180,
  maximumInternalCaptureGapDaysAbove: 180,
  largestPromptCaptureSharePctAbove: 30,
  singleCapturePromptPctAbove: 80,
  contextDimensionCoveragePctBelow: 80,
  minimumMatchedPrompts: 10
};
const WARNING_CODES = [
  'matched-context-coverage', 'matched-prompt-support', 'context-share-shift', 'observation-mix-drift',
  'prompt-mix-drift', 'prompt-overlap', 'incomplete-citation-lists', 'single-capture-depth',
  'context-dimension-coverage', 'malformed-observations', 'duplicate-captures', 'capture-window-gap',
  'prompt-capture-concentration', 'within-panel-capture-gap'
];
const CONTEXT_FIELDS = ['provider', 'model', 'surface', 'locale', 'topic', 'intent'];

function usage() {
  return `GEO saved-panel comparability preflight v${VERSION}\n\nUsage: pnpm run geo:panel:compare -- <baseline.json> <current.json> <output-prefix> [--thresholds-file <file>] [--fail-on-warnings] [--fail-on-warning-code <code>]\n\nWrites <prefix>.json, context/prompt/timeline/dimension CSVs, <prefix>.warnings.csv, and <prefix>.html.\nContext rows report effective prompt sample size, repeat concentration, and temporal coverage.\n--thresholds-file loads a version 1 JSON profile; omitted values use the documented defaults.\n--fail-on-warnings exits 1 after writing all reports when any advisory warning is present.\n--fail-on-warning-code may be repeated; it exits 1 when a selected warning code is present.\nSupported codes: ${WARNING_CODES.join(', ')}\nPrompt text is represented by SHA-256 IDs and is never copied to report files.\n`;
}

function readArgv(args) {
  const normalized = [...args];
  if (normalized[0] === '--') normalized.shift();
  if (normalized.includes('--help') || normalized.includes('-h')) { process.stdout.write(usage()); process.exit(0); }
  if (normalized.includes('--version')) { process.stdout.write(`${VERSION}\n`); process.exit(0); }
  const gateArgs = normalized.filter((arg) => arg === '--fail-on-warnings');
  const failOnWarnings = gateArgs.length > 0;
  if (gateArgs.length > 1) throw new Error('--fail-on-warnings may be supplied once.');
  if (failOnWarnings) normalized.splice(normalized.indexOf('--fail-on-warnings'), 1);
  const failOnWarningCodes = [];
  for (let index = normalized.indexOf('--fail-on-warning-code'); index !== -1; index = normalized.indexOf('--fail-on-warning-code')) {
    const code = normalized[index + 1];
    if (!code || code.startsWith('--')) throw new Error('--fail-on-warning-code requires a warning code.');
    if (!WARNING_CODES.includes(code)) throw new Error(`unknown warning code: ${code}`);
    if (failOnWarningCodes.includes(code)) throw new Error(`warning code selected more than once: ${code}`);
    failOnWarningCodes.push(code);
    normalized.splice(index, 2);
  }
  let thresholdsFile = null;
  const thresholdIndex = normalized.indexOf('--thresholds-file');
  if (thresholdIndex !== -1) {
    if (normalized.indexOf('--thresholds-file', thresholdIndex + 1) !== -1) throw new Error('--thresholds-file may be supplied once.');
    if (!normalized[thresholdIndex + 1] || normalized[thresholdIndex + 1].startsWith('--')) throw new Error('--thresholds-file requires a JSON path.');
    thresholdsFile = resolve(normalized[thresholdIndex + 1]);
    normalized.splice(thresholdIndex, 2);
  }
  if (normalized.length !== 3) throw new Error(usage());
  if (normalized.some((arg) => !arg.trim())) throw new Error('Input paths and output prefix must not be empty.');
  return { paths: normalized.map((arg) => resolve(arg)), failOnWarnings, failOnWarningCodes, thresholdsFile };
}

async function loadThresholds(path) {
  if (!path) return { ...DEFAULT_THRESHOLDS, source: 'built-in defaults', failOnWarningCodes: [] };
  const fileStat = await stat(path);
  if (fileStat.size > 1024 * 1024) throw new Error('threshold profile exceeds 1 MiB');
  const parsed = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.schemaVersion !== 1) throw new Error('threshold profile must be an object with schemaVersion 1');
  const keys = Object.keys(DEFAULT_THRESHOLDS);
  const unexpected = Object.keys(parsed).filter((key) => !['schemaVersion', 'thresholds', 'failOnWarningCodes'].includes(key));
  if (unexpected.length) throw new Error(`threshold profile has unsupported top-level fields: ${unexpected.join(', ')}`);
  if (parsed.thresholds !== undefined && (!parsed.thresholds || typeof parsed.thresholds !== 'object' || Array.isArray(parsed.thresholds))) throw new Error('thresholds must be an object');
  const overrides = parsed.thresholds ?? {};
  const unknown = Object.keys(overrides).filter((key) => !keys.includes(key));
  if (unknown.length) throw new Error(`threshold profile has unknown threshold fields: ${unknown.join(', ')}`);
  const thresholds = { ...DEFAULT_THRESHOLDS };
  for (const [key, value] of Object.entries(overrides)) {
    const isCount = key === 'minimumMatchedPrompts';
    const isDayLimit = key === 'captureWindowGapDaysAbove' || key === 'maximumInternalCaptureGapDaysAbove';
    const maximum = isCount ? MAX_OBSERVATIONS : isDayLimit ? 36_500 : 100;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < (isCount ? 1 : 0) || value > maximum || (isCount && !Number.isInteger(value))) {
      throw new Error(`threshold ${key} must be a ${isCount ? 'positive integer' : 'number'} from ${isCount ? '1' : '0'} to ${maximum}`);
    }
    thresholds[key] = value;
  }
  const failOnWarningCodes = parsed.failOnWarningCodes ?? [];
  if (!Array.isArray(failOnWarningCodes) || failOnWarningCodes.some((code) => typeof code !== 'string' || !WARNING_CODES.includes(code))) throw new Error('failOnWarningCodes must be an array of supported warning-code strings');
  if (new Set(failOnWarningCodes).size !== failOnWarningCodes.length) throw new Error('failOnWarningCodes must not contain duplicates');
  return { ...thresholds, source: 'profile', failOnWarningCodes };
}

function parseObservationSet(value, source) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.observations)) {
    throw new Error(`${source}: expected schemaVersion 1 with an observations array`);
  }
  if (value.observations.length > MAX_OBSERVATIONS) throw new Error(`${source}: more than ${MAX_OBSERVATIONS} observations`);
  const observations = [];
  const seenObservationFingerprints = new Set();
  let invalidRows = 0;
  let duplicateRows = 0;
  for (const row of value.observations) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) { invalidRows++; continue; }
    const observedAt = typeof row.observedAt === 'string' ? row.observedAt : '';
    const observed = /(?:Z|[+-]\d{2}:\d{2})$/.test(observedAt) ? Date.parse(observedAt) : NaN;
    const provider = text(row.provider);
    const prompt = text(row.prompt);
    if (!Number.isFinite(observed) || !provider || provider.length > 100 || !prompt || prompt.length > 5000 || !Array.isArray(row.citedUrls) || row.citedUrls.length > 50) { invalidRows++; continue; }
    if (row.citedUrls.some((url) => typeof url !== 'string' || url.length > 2048)) { invalidRows++; continue; }
    if (row.answerText !== undefined && (typeof row.answerText !== 'string' || row.answerText.length > 12_000)) { invalidRows++; continue; }
    if (CONTEXT_FIELDS.slice(1).some((field) => row[field] !== undefined && (typeof row[field] !== 'string' || row[field].length > 100))) { invalidRows++; continue; }
    if (row.citationListComplete !== undefined && typeof row.citationListComplete !== 'boolean') { invalidRows++; continue; }
    const contextValues = Object.fromEntries(CONTEXT_FIELDS.map((field) => [field, text(row[field]) || null]));
    const context = Object.fromEntries(CONTEXT_FIELDS.map((field) => [field,
      contextValues[field] === null ? '(missing)' : contextValues[field] === '(missing)' ? '(literal value: missing)' : contextValues[field]]));
    const missingContextFields = CONTEXT_FIELDS.slice(1).filter((field) => contextValues[field] === null);
    const contextKey = JSON.stringify(CONTEXT_FIELDS.map((field) => contextValues[field]));
    const promptId = createHash('sha256').update(prompt).digest('hex');
    const promptKey = `${contextKey}\u0000${promptId}`;
    const complete = row.citationListComplete ?? row.citedUrls.length < 50;
    const fingerprint = createHash('sha256').update(JSON.stringify([observedAt, contextKey, promptId, row.answerText ?? null, row.citedUrls, complete])).digest('hex');
    if (seenObservationFingerprints.has(fingerprint)) duplicateRows++;
    else seenObservationFingerprints.add(fingerprint);
    observations.push({ context, contextKey, promptId, promptKey, observed, complete, missingContextFields });
  }
  return { observations, invalidRows, duplicateRows, inputObservations: value.observations.length };
}

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function pct(a, b) { return b ? a / b * 100 : null; }
function med(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
function coefficientOfVariation(values) {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}
function effectiveSampleSize(counts) {
  if (!counts.length) return null;
  const total = counts.reduce((sum, count) => sum + count, 0);
  const squared = counts.reduce((sum, count) => sum + count ** 2, 0);
  return squared ? total ** 2 / squared : null;
}
function largestPromptSharePct(counts) {
  if (!counts.length) return null;
  return pct(Math.max(...counts), counts.reduce((sum, count) => sum + count, 0));
}
function largestTimestampGapDays(timestamps) {
  const sorted = [...new Set(timestamps)].sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  return sorted.slice(1).reduce((largest, value, index) => Math.max(largest, (value - sorted[index]) / 86_400_000), 0);
}
function csvCell(value) {
  let raw = value === null || value === undefined ? '' : String(value);
  if (/^\s*[=+\-@]/.test(raw)) raw = `'${raw}`;
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}
function csv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\n') + '\n';
}
function htmlEscape(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function contextLabel(context) {
  return CONTEXT_FIELDS.map((field) => `${field}=${context[field]}`).join(' | ');
}

function summarizeSet(set) {
  const contexts = new Map();
  const promptRows = new Map();
  for (const obs of set.observations) {
    let context = contexts.get(obs.contextKey);
    if (!context) {
      context = { context: obs.context, contextKey: obs.contextKey, observations: 0, complete: 0, incomplete: 0, promptCounts: new Map(), timestamps: new Set(), captureDates: new Set(), first: obs.observed, last: obs.observed };
      contexts.set(obs.contextKey, context);
    }
    context.observations++;
    context[obs.complete ? 'complete' : 'incomplete']++;
    context.first = Math.min(context.first, obs.observed);
    context.last = Math.max(context.last, obs.observed);
    context.timestamps.add(obs.observed);
    context.captureDates.add(new Date(obs.observed).toISOString().slice(0, 10));
    context.promptCounts.set(obs.promptId, (context.promptCounts.get(obs.promptId) || 0) + 1);
    let prompt = promptRows.get(obs.promptKey);
    if (!prompt) { prompt = { context: obs.context, contextKey: obs.contextKey, promptId: obs.promptId, captures: 0 }; promptRows.set(obs.promptKey, prompt); }
    prompt.captures++;
  }
  return { contexts, promptRows };
}

function buildCaptureTimeline(baseline, current, baselineTotal, currentTotal) {
  const days = new Map();
  const addSet = (set, period) => {
    for (const obs of set.observations) {
      const date = new Date(obs.observed).toISOString().slice(0, 10);
      const key = JSON.stringify([obs.contextKey, date]);
      let row = days.get(key);
      if (!row) {
        row = {
          context: obs.context, contextKey: obs.contextKey, date,
          baseline: { observations: 0, complete: 0, prompts: new Set(), instants: new Set() },
          current: { observations: 0, complete: 0, prompts: new Set(), instants: new Set() }
        };
        days.set(key, row);
      }
      const values = row[period];
      values.observations++;
      if (obs.complete) values.complete++;
      values.prompts.add(obs.promptId);
      values.instants.add(obs.observed);
    }
  };
  addSet(baseline, 'baseline');
  addSet(current, 'current');
  return [...days.values()].sort((left, right) => {
    const contextOrder = left.contextKey < right.contextKey ? -1 : left.contextKey > right.contextKey ? 1 : 0;
    return contextOrder || (left.date < right.date ? -1 : left.date > right.date ? 1 : 0);
  }).map((row) => {
    const b = row.baseline;
    const c = row.current;
    return {
      context_key: row.contextKey,
      context_label: contextLabel(row.context),
      ...row.context,
      observation_date_utc: row.date,
      baseline_observations: b.observations,
      current_observations: c.observations,
      baseline_observation_share_pct: pct(b.observations, baselineTotal),
      current_observation_share_pct: pct(c.observations, currentTotal),
      baseline_unique_prompts: b.prompts.size,
      current_unique_prompts: c.prompts.size,
      baseline_distinct_capture_instants: b.instants.size,
      current_distinct_capture_instants: c.instants.size,
      baseline_complete_capture_pct: b.observations ? pct(b.complete, b.observations) : null,
      current_complete_capture_pct: c.observations ? pct(c.complete, c.observations) : null,
      status: !b.observations ? 'current_only_day' : !c.observations ? 'baseline_only_day' : 'shared_day'
    };
  });
}

function compare(baseline, current, thresholds) {
  const b = summarizeSet(baseline);
  const c = summarizeSet(current);
  const totalB = baseline.observations.length;
  const totalC = current.observations.length;
  const captureTimeline = buildCaptureTimeline(baseline, current, totalB, totalC);
  const dimensionCoverage = CONTEXT_FIELDS.slice(1).map((field) => {
    const bMissing = baseline.observations.filter((row) => row.missingContextFields.includes(field)).length;
    const cMissing = current.observations.filter((row) => row.missingContextFields.includes(field)).length;
    const bCoverage = pct(totalB - bMissing, totalB);
    const cCoverage = pct(totalC - cMissing, totalC);
    return {
      dimension: field,
      baseline_observations: totalB,
      baseline_missing_observations: bMissing,
      baseline_coverage_pct: bCoverage,
      current_observations: totalC,
      current_missing_observations: cMissing,
      current_coverage_pct: cCoverage,
      coverage_delta_pp: cCoverage - bCoverage
    };
  });
  const contextKeys = [...new Set([...b.contexts.keys(), ...c.contexts.keys()])].sort();
  const contextRows = contextKeys.map((key) => {
    const left = b.contexts.get(key);
    const right = c.contexts.get(key);
    const bp = left?.promptCounts ?? new Map();
    const cp = right?.promptCounts ?? new Map();
    const ids = new Set([...bp.keys(), ...cp.keys()]);
    let matched = 0; let onlyB = 0; let onlyC = 0;
    for (const id of ids) {
      if (bp.has(id) && cp.has(id)) matched++;
      else if (bp.has(id)) onlyB++;
      else onlyC++;
    }
    const bCount = left?.observations ?? 0;
    const cCount = right?.observations ?? 0;
    const captureWindowGapDays = left && right
      ? Math.max(0, left.first - right.last, right.first - left.last) / 86_400_000
      : null;
    const bPromptCounts = [...bp.values()];
    const cPromptCounts = [...cp.values()];
    const bEffectivePromptSampleSize = effectiveSampleSize(bPromptCounts);
    const cEffectivePromptSampleSize = effectiveSampleSize(cPromptCounts);
    const bShare = pct(bCount, totalB);
    const cShare = pct(cCount, totalC);
    const bPromptShare = pct(bp.size, b.promptRows.size);
    const cPromptShare = pct(cp.size, c.promptRows.size);
    return {
      context_key: key,
      context_label: contextLabel(left?.context ?? right.context),
      provider: (left?.context ?? right.context).provider,
      model: (left?.context ?? right.context).model,
      surface: (left?.context ?? right.context).surface,
      locale: (left?.context ?? right.context).locale,
      topic: (left?.context ?? right.context).topic,
      intent: (left?.context ?? right.context).intent,
      baseline_observations: bCount,
      current_observations: cCount,
      baseline_observation_share_pct: bShare,
      current_observation_share_pct: cShare,
      observation_share_delta_pp: bShare === null || cShare === null ? null : cShare - bShare,
      baseline_unique_prompts: bp.size,
      current_unique_prompts: cp.size,
      baseline_prompt_group_share_pct: bPromptShare,
      current_prompt_group_share_pct: cPromptShare,
      prompt_group_share_delta_pp: cPromptShare - bPromptShare,
      matched_prompts: matched,
      baseline_only_prompts: onlyB,
      current_only_prompts: onlyC,
      prompt_jaccard_pct: ids.size ? pct(matched, ids.size) : null,
      baseline_median_captures_per_prompt: med(bPromptCounts),
      current_median_captures_per_prompt: med(cPromptCounts),
      baseline_single_capture_prompt_pct: left ? pct(bPromptCounts.filter((count) => count === 1).length, bPromptCounts.length) : null,
      current_single_capture_prompt_pct: right ? pct(cPromptCounts.filter((count) => count === 1).length, cPromptCounts.length) : null,
      baseline_capture_depth_cv: coefficientOfVariation(bPromptCounts),
      current_capture_depth_cv: coefficientOfVariation(cPromptCounts),
      baseline_effective_prompt_sample_size: bEffectivePromptSampleSize,
      current_effective_prompt_sample_size: cEffectivePromptSampleSize,
      baseline_capture_redundancy_factor: bEffectivePromptSampleSize === null ? null : bCount / bEffectivePromptSampleSize,
      current_capture_redundancy_factor: cEffectivePromptSampleSize === null ? null : cCount / cEffectivePromptSampleSize,
      baseline_largest_prompt_capture_share_pct: largestPromptSharePct(bPromptCounts),
      current_largest_prompt_capture_share_pct: largestPromptSharePct(cPromptCounts),
      baseline_largest_internal_capture_gap_days: left ? largestTimestampGapDays(left.timestamps) : null,
      current_largest_internal_capture_gap_days: right ? largestTimestampGapDays(right.timestamps) : null,
      baseline_distinct_capture_instants: left?.timestamps.size ?? null,
      current_distinct_capture_instants: right?.timestamps.size ?? null,
      baseline_distinct_capture_dates: left?.captureDates.size ?? null,
      current_distinct_capture_dates: right?.captureDates.size ?? null,
      baseline_observations_per_capture_date: left ? left.observations / left.captureDates.size : null,
      current_observations_per_capture_date: right ? right.observations / right.captureDates.size : null,
      baseline_incomplete_list_pct: left ? pct(left.incomplete, left.observations) : null,
      current_incomplete_list_pct: right ? pct(right.incomplete, right.observations) : null,
      baseline_first_observed_utc: left ? new Date(left.first).toISOString() : null,
      baseline_last_observed_utc: left ? new Date(left.last).toISOString() : null,
      baseline_capture_window_days: left ? (left.last - left.first) / 86_400_000 : null,
      current_first_observed_utc: right ? new Date(right.first).toISOString() : null,
      current_last_observed_utc: right ? new Date(right.last).toISOString() : null,
      current_capture_window_days: right ? (right.last - right.first) / 86_400_000 : null,
      capture_window_gap_days: captureWindowGapDays,
      status: !left ? 'current_only_context' : !right ? 'baseline_only_context' : matched ? 'matched_context' : 'no_matched_prompts'
    };
  });
  const promptKeys = [...new Set([...b.promptRows.keys(), ...c.promptRows.keys()])].sort();
  const promptRows = promptKeys.map((key) => {
    const left = b.promptRows.get(key);
    const right = c.promptRows.get(key);
    const row = left ?? right;
    return {
      context_key: row.contextKey,
      context_label: contextLabel(row.context),
      prompt_sha256: row.promptId,
      baseline_captures: left?.captures ?? 0,
      current_captures: right?.captures ?? 0,
      baseline_complete_capture_pct: left ? pct(left.complete, left.captures) : null,
      current_complete_capture_pct: right ? pct(right.complete, right.captures) : null,
      status: !left ? 'current_only_prompt' : !right ? 'baseline_only_prompt' : 'matched_prompt'
    };
  });
  const unionB = new Set(b.promptRows.keys());
  const unionC = new Set(c.promptRows.keys());
  let shared = 0;
  for (const key of unionB) if (unionC.has(key)) shared++;
  const allContexts = contextRows.length;
  const matchedContexts = contextRows.filter((row) => row.status === 'matched_context').length;
  const lowSupportContexts = contextRows.filter((row) => row.status === 'matched_context' && row.matched_prompts < thresholds.minimumMatchedPrompts).length;
  const maxShareShiftPp = contextRows.reduce((max, row) => Math.max(max, Math.abs(row.observation_share_delta_pp ?? 0)), 0);
  const contextMixTotalVariationPp = Math.min(100, contextRows.reduce((sum, row) => sum + Math.abs(row.observation_share_delta_pp ?? 0), 0) / 2);
  const promptMixTotalVariationPp = Math.min(100, contextRows.reduce((sum, row) => sum + Math.abs(row.prompt_group_share_delta_pp ?? 0), 0) / 2);
  const captureWindowGaps = contextRows.map((row) => row.capture_window_gap_days).filter((value) => value !== null);
  const maximumCaptureWindowGapDays = captureWindowGaps.length ? Math.max(...captureWindowGaps) : null;
  const internalCaptureGaps = contextRows.flatMap((row) => [row.baseline_largest_internal_capture_gap_days, row.current_largest_internal_capture_gap_days]).filter((value) => value !== null);
  const maximumInternalCaptureGapDays = internalCaptureGaps.length ? Math.max(...internalCaptureGaps) : null;
  const baselinePromptCaptureCounts = [...b.promptRows.values()].map((row) => row.captures);
  const currentPromptCaptureCounts = [...c.promptRows.values()].map((row) => row.captures);
  const baselineEffectivePromptSampleSize = effectiveSampleSize(baselinePromptCaptureCounts);
  const currentEffectivePromptSampleSize = effectiveSampleSize(currentPromptCaptureCounts);
  const warnings = [];
  const warningDetails = [];
  const warn = (code, message, observedValue, thresholdValue, unit) => {
    warnings.push(message);
    warningDetails.push({ code, severity: 'warning', message, observedValue, thresholdValue, unit });
  };
  if (matchedContexts < allContexts) warn('matched-context-coverage', 'One or more provider/context strata are missing or have no shared exact prompts.', matchedContexts, allContexts, 'contexts');
  const matchedPromptCounts = contextRows.filter((row) => row.status === 'matched_context').map((row) => row.matched_prompts);
  const minimumMatchedPromptCount = matchedPromptCounts.length ? Math.min(...matchedPromptCounts) : null;
  if (lowSupportContexts) warn('matched-prompt-support', `${lowSupportContexts} matched context${lowSupportContexts === 1 ? '' : 's'} have fewer than ${thresholds.minimumMatchedPrompts} shared exact prompts.`, minimumMatchedPromptCount, thresholds.minimumMatchedPrompts, 'prompts');
  if (maxShareShiftPp > 0 && maxShareShiftPp >= thresholds.contextShareShiftPp) warn('context-share-shift', `At least one context contributes a substantially different share of observations (${thresholds.contextShareShiftPp} percentage points or more).`, maxShareShiftPp, thresholds.contextShareShiftPp, 'percentage-points');
  if (contextMixTotalVariationPp > 0 && contextMixTotalVariationPp >= thresholds.contextMixTotalVariationPp) warn('observation-mix-drift', `At least ${thresholds.contextMixTotalVariationPp}% of observation share would need to move between contexts to make the two context mixes identical.`, contextMixTotalVariationPp, thresholds.contextMixTotalVariationPp, 'percentage-points');
  if (promptMixTotalVariationPp > 0 && promptMixTotalVariationPp >= thresholds.promptMixTotalVariationPp) warn('prompt-mix-drift', `At least ${thresholds.promptMixTotalVariationPp}% of unique prompt-group share would need to move between contexts to align prompt mixes.`, promptMixTotalVariationPp, thresholds.promptMixTotalVariationPp, 'percentage-points');
  const matchedJaccards = contextRows.filter((row) => row.prompt_jaccard_pct !== null).map((row) => row.prompt_jaccard_pct);
  const minimumPromptJaccard = matchedJaccards.length ? Math.min(...matchedJaccards) : null;
  if (matchedJaccards.some((value) => value < thresholds.promptJaccardPctBelow)) warn('prompt-overlap', `At least one matched context has less than ${thresholds.promptJaccardPctBelow}% prompt-set Jaccard overlap.`, minimumPromptJaccard, thresholds.promptJaccardPctBelow, 'percent');
  const incompleteRates = contextRows.flatMap((row) => [row.baseline_incomplete_list_pct, row.current_incomplete_list_pct]).filter((value) => value !== null);
  const maximumIncompleteRate = incompleteRates.length ? Math.max(...incompleteRates) : null;
  if (maximumIncompleteRate !== null && maximumIncompleteRate > thresholds.incompleteListPctAbove) warn('incomplete-citation-lists', `At least one context has more than ${thresholds.incompleteListPctAbove}% incomplete citation lists in either capture.`, maximumIncompleteRate, thresholds.incompleteListPctAbove, 'percent');
  const singleCaptureRates = contextRows.flatMap((row) => [row.baseline_single_capture_prompt_pct, row.current_single_capture_prompt_pct]).filter((value) => value !== null);
  const maximumSingleCaptureRate = singleCaptureRates.length ? Math.max(...singleCaptureRates) : null;
  if (maximumSingleCaptureRate !== null && maximumSingleCaptureRate > thresholds.singleCapturePromptPctAbove) warn('single-capture-depth', `At least one context has more than ${thresholds.singleCapturePromptPctAbove}% of its prompts represented by a single capture in either period.`, maximumSingleCaptureRate, thresholds.singleCapturePromptPctAbove, 'percent');
  const largestPromptShares = contextRows.flatMap((row) => [row.baseline_largest_prompt_capture_share_pct, row.current_largest_prompt_capture_share_pct]).filter((value) => value !== null);
  const maximumLargestPromptShare = largestPromptShares.length ? Math.max(...largestPromptShares) : null;
  if (maximumLargestPromptShare !== null && maximumLargestPromptShare > thresholds.largestPromptCaptureSharePctAbove) warn('prompt-capture-concentration', `At least one context has a single exact prompt accounting for more than ${thresholds.largestPromptCaptureSharePctAbove}% of captures in either period.`, maximumLargestPromptShare, thresholds.largestPromptCaptureSharePctAbove, 'percent');
  const dimensionRates = dimensionCoverage.flatMap((row) => [row.baseline_coverage_pct, row.current_coverage_pct]);
  const minimumDimensionCoverage = dimensionRates.length ? Math.min(...dimensionRates) : null;
  if (minimumDimensionCoverage !== null && minimumDimensionCoverage < thresholds.contextDimensionCoveragePctBelow) warn('context-dimension-coverage', `At least one optional context dimension is below ${thresholds.contextDimensionCoveragePctBelow}% coverage in either period.`, minimumDimensionCoverage, thresholds.contextDimensionCoveragePctBelow, 'percent');
  if (baseline.invalidRows || current.invalidRows) warn('malformed-observations', `Skipped malformed observations: ${baseline.invalidRows} baseline and ${current.invalidRows} current.`, baseline.invalidRows + current.invalidRows, 0, 'rows');
  const baselineDuplicatePct = pct(baseline.duplicateRows, totalB);
  const currentDuplicatePct = pct(current.duplicateRows, totalC);
  const maximumDuplicatePct = Math.max(baselineDuplicatePct ?? 0, currentDuplicatePct ?? 0);
  if (maximumDuplicatePct > thresholds.duplicateCapturePctAbove) warn('duplicate-captures', `Exact duplicate capture rows exceed the ${thresholds.duplicateCapturePctAbove}% tolerance: ${baseline.duplicateRows} baseline (${baselineDuplicatePct?.toFixed(2) ?? '—'}%) and ${current.duplicateRows} current (${currentDuplicatePct?.toFixed(2) ?? '—'}%); duplicates remain in denominators.`, maximumDuplicatePct, thresholds.duplicateCapturePctAbove, 'percent');
  if (maximumCaptureWindowGapDays !== null && maximumCaptureWindowGapDays > thresholds.captureWindowGapDaysAbove) warn('capture-window-gap', `At least one context present in both panels has a baseline/current capture-window gap greater than ${thresholds.captureWindowGapDaysAbove} days.`, maximumCaptureWindowGapDays, thresholds.captureWindowGapDaysAbove, 'days');
  if (maximumInternalCaptureGapDays !== null && maximumInternalCaptureGapDays > thresholds.maximumInternalCaptureGapDaysAbove) warn('within-panel-capture-gap', `At least one context has a gap between successive capture timestamps greater than ${thresholds.maximumInternalCaptureGapDaysAbove} days within a panel.`, maximumInternalCaptureGapDays, thresholds.maximumInternalCaptureGapDaysAbove, 'days');
  return {
    schemaVersion: 1,
    tool: { name: 'Aviary GEO panel comparability preflight', version: VERSION },
    generatedAt: new Date().toISOString(),
    method: {
      contextFields: CONTEXT_FIELDS,
      contextMatch: 'exact after trimming strings; missing values form an explicit (missing) stratum',
      promptMatch: 'SHA-256 of trimmed exact prompt text, matched only inside the exact provider/model/surface/locale/topic/intent stratum',
      promptTextIncluded: false,
      maxInputBytes: MAX_BYTES,
      maxObservationsPerInput: MAX_OBSERVATIONS,
      htmlContextRowLimit: MAX_HTML_CONTEXT_ROWS,
      observationShare: 'baseline and current each use their own total valid-observation count',
      promptShare: 'baseline and current each use their own total number of unique exact context/prompt groups',
      dimensionCoverage: 'calculated per valid observation; repeated captures count separately',
      captureDepth: 'per context, median and population standard-deviation/mean coefficient of variation over capture counts per exact prompt',
      effectivePromptSampleSize: 'Kish effective sample size over exact context/prompt capture counts: total captures squared divided by sum of squared per-prompt capture counts; repeated captures reduce the value and it is descriptive, not an inferential sample-size guarantee',
      promptCaptureConcentration: 'largest prompt share is the maximum exact context/prompt capture count divided by the corresponding context captures for context rows and all panel captures for panel summaries; capture redundancy factor is captures divided by Kish effective prompt sample size',
      captureTiming: 'per context, earliest-to-latest UTC observation span; capture-window gap is zero for overlapping ranges and otherwise the distance between nearest endpoints; one-sided contexts have no gap',
      internalCaptureSpacing: 'largest gap between sorted unique UTC observation instants within a context and panel; repeated captures at the same instant count as one instant; distinct instant/date counts and mean valid observations per UTC date are also reported',
      captureTimeline: 'one row per exact context and UTC date in either panel; observation shares use each panel total, prompt counts use distinct exact prompts, and absent-panel dates have zero counts with null completeness',
      mixDistance: 'half the sum of absolute percentage-point share changes over the union of exact context strata',
      changeDirection: 'all *_delta_pp fields are current minus baseline',
      citationCompleteness: 'citationListComplete when supplied; otherwise true below 50 URLs and false at 50',
      duplicateDetection: 'exact observedAt string, context, prompt hash, answer text, ordered cited URLs, and effective citation-list-completeness flag; answer text is hashed only and duplicates are counted but retained',
      warningThresholds: Object.fromEntries(Object.entries(thresholds).filter(([key]) => key !== 'failOnWarningCodes')),
      interpretation: 'descriptive panel balance diagnostics; no representativeness, visibility, causal, or significance claim'
    },
    inputs: {
      baseline: { source: 'baseline observations', inputObservations: baseline.inputObservations, validObservations: totalB, invalidRows: baseline.invalidRows, duplicateObservationRows: baseline.duplicateRows },
      current: { source: 'current observations', inputObservations: current.inputObservations, validObservations: totalC, invalidRows: current.invalidRows, duplicateObservationRows: current.duplicateRows }
    },
    summary: {
      baseline_contexts: b.contexts.size,
      current_contexts: c.contexts.size,
      union_contexts: allContexts,
      matched_contexts: matchedContexts,
      low_support_contexts: lowSupportContexts,
      baseline_prompt_groups: unionB.size,
      current_prompt_groups: unionC.size,
      matched_prompt_groups: shared,
      baseline_only_prompt_groups: unionB.size - shared,
      current_only_prompt_groups: unionC.size - shared,
      prompt_group_jaccard_pct: unionB.size + unionC.size - shared ? pct(shared, unionB.size + unionC.size - shared) : null,
      max_context_observation_share_shift_pp: maxShareShiftPp,
      context_mix_total_variation_pp: contextMixTotalVariationPp,
      prompt_mix_total_variation_pp: promptMixTotalVariationPp,
      maximum_capture_window_gap_days: maximumCaptureWindowGapDays,
      maximum_internal_capture_gap_days: maximumInternalCaptureGapDays,
      capture_timeline_rows: captureTimeline.length,
      baseline_effective_prompt_sample_size: baselineEffectivePromptSampleSize,
      current_effective_prompt_sample_size: currentEffectivePromptSampleSize,
      baseline_capture_redundancy_factor: baselineEffectivePromptSampleSize === null ? null : totalB / baselineEffectivePromptSampleSize,
      current_capture_redundancy_factor: currentEffectivePromptSampleSize === null ? null : totalC / currentEffectivePromptSampleSize,
      baseline_largest_prompt_capture_share_pct: largestPromptSharePct(baselinePromptCaptureCounts),
      current_largest_prompt_capture_share_pct: largestPromptSharePct(currentPromptCaptureCounts),
      observation_context_balance_is_identical: contextRows.every((row) => Math.abs(row.observation_share_delta_pp ?? 0) < 1e-12),
      prompt_group_mix_is_identical: contextRows.every((row) => Math.abs(row.prompt_group_share_delta_pp ?? 0) < 1e-12),
      warnings
    },
    contexts: contextRows,
    prompts: promptRows,
    captureTimeline,
    dimensionCoverage,
    warningDetails
  };
}

function renderHtml(report, contextsCsvHref, dimensionsCsvHref, promptsCsvHref, timelineCsvHref, warningsCsvHref) {
  const summary = report.summary;
  const thresholds = report.method.warningThresholds;
  const safeContextsHref = encodeURIComponent(contextsCsvHref);
  const safeDimensionsHref = encodeURIComponent(dimensionsCsvHref);
  const safeWarningsHref = encodeURIComponent(warningsCsvHref);
  const safeTimelineHref = encodeURIComponent(timelineCsvHref);
  const displayContextCount = Math.min(report.contexts.length, MAX_HTML_CONTEXT_ROWS);
  const rows = report.contexts.slice(0, MAX_HTML_CONTEXT_ROWS).map((r) => `<tr><td>${htmlEscape(r.provider)}</td><td>${htmlEscape(r.model)}</td><td>${htmlEscape(r.surface)}</td><td>${htmlEscape(r.locale)}</td><td>${htmlEscape(r.topic)}</td><td>${htmlEscape(r.intent)}</td><td>${r.baseline_observations}</td><td>${r.current_observations}</td><td>${r.baseline_distinct_capture_instants ?? '—'}</td><td>${r.current_distinct_capture_instants ?? '—'}</td><td>${r.baseline_distinct_capture_dates ?? '—'}</td><td>${r.current_distinct_capture_dates ?? '—'}</td><td>${r.baseline_observations_per_capture_date?.toFixed(2) ?? '—'}</td><td>${r.current_observations_per_capture_date?.toFixed(2) ?? '—'}</td><td>${r.observation_share_delta_pp?.toFixed(1) ?? '—'}</td><td>${r.prompt_group_share_delta_pp?.toFixed(1) ?? '—'}</td><td>${r.matched_prompts}</td><td>${r.prompt_jaccard_pct?.toFixed(1) ?? '—'}</td><td>${r.baseline_effective_prompt_sample_size?.toFixed(1) ?? '—'}</td><td>${r.current_effective_prompt_sample_size?.toFixed(1) ?? '—'}</td><td>${r.baseline_largest_prompt_capture_share_pct === null ? '—' : `${r.baseline_largest_prompt_capture_share_pct.toFixed(1)}%`}</td><td>${r.current_largest_prompt_capture_share_pct === null ? '—' : `${r.current_largest_prompt_capture_share_pct.toFixed(1)}%`}</td><td>${r.baseline_capture_window_days?.toFixed(1) ?? '—'}</td><td>${r.current_capture_window_days?.toFixed(1) ?? '—'}</td><td>${r.capture_window_gap_days?.toFixed(1) ?? '—'}</td><td>${r.baseline_largest_internal_capture_gap_days?.toFixed(1) ?? '—'}</td><td>${r.current_largest_internal_capture_gap_days?.toFixed(1) ?? '—'}</td><td>${htmlEscape(r.status)}</td></tr>`).join('');
  const dimensionRows = report.dimensionCoverage.map((r) => `<tr><td>${htmlEscape(r.dimension)}</td><td>${r.baseline_coverage_pct.toFixed(1)}%</td><td>${r.current_coverage_pct.toFixed(1)}%</td><td>${r.coverage_delta_pp.toFixed(1)} pp</td><td>${r.baseline_missing_observations}</td><td>${r.current_missing_observations}</td></tr>`).join('');
  const warningDetails = report.warningDetails ?? [];
  const warnings = warningDetails.length ? `<ul>${warningDetails.map((detail) => `<li><code>${htmlEscape(detail.code)}</code> ${htmlEscape(detail.message)} <small>Observed: ${detail.observedValue === null ? '—' : `${detail.observedValue.toLocaleString('en-US')} ${htmlEscape(detail.unit ?? '')}`} · cutoff: ${detail.thresholdValue === null ? '—' : `${detail.thresholdValue.toLocaleString('en-US')} ${htmlEscape(detail.unit ?? '')}`} · gate: ${detail.gateFailed ? 'failed' : detail.gateSelected ? 'selected' : 'advisory'}</small></li>`).join('')}</ul>`
    : summary.warnings.length ? `<ul>${summary.warnings.map((w) => `<li>${htmlEscape(w)}</li>`).join('')}</ul>` : '<p>No threshold-based panel-balance warnings were raised.</p>';
  const thresholdLabels = {
    contextShareShiftPp: 'Per-context observation-share shift (warn at or above, pp)',
    contextMixTotalVariationPp: 'Observation-mix total variation (warn at or above, pp)',
    promptMixTotalVariationPp: 'Prompt-mix total variation (warn at or above, pp)',
    promptJaccardPctBelow: 'Prompt Jaccard (warn below, %)',
    incompleteListPctAbove: 'Incomplete citation lists (warn above, %)',
    duplicateCapturePctAbove: 'Duplicate captures (warn above, %)',
    captureWindowGapDaysAbove: 'Inter-period capture-window gap (warn above, days)',
    maximumInternalCaptureGapDaysAbove: 'Largest within-panel timestamp gap (warn above, days)',
    largestPromptCaptureSharePctAbove: 'Largest prompt capture share (warn above, %)',
    singleCapturePromptPctAbove: 'Single-capture prompts (warn above, %)',
    contextDimensionCoveragePctBelow: 'Optional context-field coverage (warn below, %)',
    minimumMatchedPrompts: 'Matched prompt support (warn below, count)'
  };
  const thresholdRows = Object.entries(thresholdLabels).map(([key, label]) => `<tr><th scope="row">${htmlEscape(label)}</th><td>${htmlEscape(thresholds[key])}</td></tr>`).join('');
  const gatePolicy = report.warningGate.mode === 'all-warnings' ? 'all warning codes'
    : report.warningGate.mode === 'selected-codes' ? report.warningGate.selectedCodes.join(', ')
      : 'not enabled';
  const maxGapDisplay = summary.maximum_capture_window_gap_days === null ? 'Not available' : `${summary.maximum_capture_window_gap_days.toFixed(1)} days`;
  const omitted = report.contexts.length - displayContextCount;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GEO panel comparability</title>
  <style>
    body{font:16px/1.5 system-ui,sans-serif;margin:2rem auto;padding:0 1rem;max-width:1200px;color:#17212b}
    h1{line-height:1.15}.cards{display:flex;flex-wrap:wrap;gap:.75rem}
    .card{border:1px solid #bac6ce;border-radius:.6rem;padding:.75rem;min-width:9rem}
    .card b{display:block;font-size:1.4rem}table{border-collapse:collapse;width:100%;font-size:.9rem}
    th,td{border:1px solid #cbd4da;padding:.45rem;text-align:left}
    th{background:#edf2f4;position:sticky;top:0}main,.table-wrap{overflow-x:auto}
    .note{background:#f4f7f8;padding:1rem}label{display:block;font-weight:600;margin:.75rem 0 .25rem}
    input[type=search]{font:inherit;padding:.45rem .6rem;max-width:28rem;width:100%}
    input:focus-visible,a:focus-visible{outline:3px solid #155eef;outline-offset:2px}
    .skip-link{position:absolute;left:-9999px;top:8px;background:#fff;padding:.5rem;z-index:1}
    .skip-link:focus-visible{left:8px}
  </style>
</head>
<body>
  <a class="skip-link" href="#contexts">Skip to context table</a>
  <h1>GEO saved-panel comparability</h1>
  <p>Generated ${htmlEscape(report.generatedAt)}. This is a descriptive diagnostic for the supplied saved captures.</p>
  <section class="cards" aria-label="Panel summary">
    <div class="card"><b>${summary.matched_contexts}/${summary.union_contexts}</b>matched contexts</div>
    <div class="card"><b>${summary.matched_prompt_groups}/${summary.baseline_prompt_groups + summary.current_prompt_groups - summary.matched_prompt_groups}</b>shared prompt groups / union</div>
    <div class="card"><b>${summary.prompt_group_jaccard_pct?.toFixed(1) ?? '—'}%</b>prompt-group Jaccard</div>
    <div class="card"><b>${summary.max_context_observation_share_shift_pp.toFixed(1)} pp</b>largest context share shift</div>
    <div class="card"><b>${summary.context_mix_total_variation_pp.toFixed(1)} pp</b>context mix total variation</div>
    <div class="card"><b>${summary.prompt_mix_total_variation_pp.toFixed(1)} pp</b>unique prompt mix total variation</div>
    <div class="card"><b>${summary.baseline_effective_prompt_sample_size.toFixed(1)} → ${summary.current_effective_prompt_sample_size.toFixed(1)}</b>effective prompt sample size</div>
    <div class="card"><b>${summary.baseline_capture_redundancy_factor.toFixed(2)}× → ${summary.current_capture_redundancy_factor.toFixed(2)}×</b>capture redundancy factor</div>
    <div class="card"><b>${summary.baseline_largest_prompt_capture_share_pct.toFixed(1)}% → ${summary.current_largest_prompt_capture_share_pct.toFixed(1)}%</b>largest prompt share</div>
    <div class="card"><b>${maxGapDisplay}</b>largest period gap</div>
    <div class="card"><b>${summary.maximum_internal_capture_gap_days === null ? 'Not available' : `${summary.maximum_internal_capture_gap_days.toFixed(1)} days`}</b>largest within-panel gap</div>
    <div class="card"><b>${summary.capture_timeline_rows.toLocaleString('en-US')}</b>context-day rows</div>
  </section>
  <h2>Review notes</h2>
  ${warnings}
  <section aria-labelledby="threshold-heading">
    <h2 id="threshold-heading">Active warning thresholds</h2>
    <p>Profile source: <strong>${htmlEscape(thresholds.source)}</strong>. Structural warnings for missing matched contexts and malformed rows are not configurable.</p>
    <p>Warning gate: <strong>${htmlEscape(report.warningGate.status)}</strong> · policy: ${htmlEscape(gatePolicy)} · failed codes: ${htmlEscape(report.warningGate.failedCodes.join(', ') || 'none')}.</p>
    <div class="table-wrap"><table><thead><tr><th>Review signal</th><th>Cutoff</th></tr></thead><tbody>${thresholdRows}</tbody></table></div>
  </section>
  <p class="note">Context matching is exact across provider, model, surface, locale, topic, and intent. Prompt matching uses a SHA-256 identifier for trimmed exact prompt text. Effective prompt sample size is total captures² divided by the sum of squared captures per exact prompt; repeated captures reduce it. The capture redundancy factor is total captures divided by effective prompt sample size; 1× means one capture per prompt group, with higher values indicating greater concentration. These are descriptive concentration measures, not inferential sample-size guarantees. The largest within-panel gap is the longest interval between distinct UTC capture instants; context rows also show distinct timestamp and UTC-date counts plus mean observations per observed UTC date. Prompt text is not embedded. Balance does not establish that captures represent real user queries or provider behavior.</p>
  <section aria-labelledby="coverage-heading">
    <h2 id="coverage-heading">Context-field coverage</h2>
    <div class="table-wrap"><table><thead><tr><th>Dimension</th><th>Baseline coverage</th><th>Current coverage</th><th>Change</th><th>Missing, baseline</th><th>Missing, current</th></tr></thead><tbody>${dimensionRows}</tbody></table></div>
    <p><a href="${safeDimensionsHref}" download>Download full dimension-coverage CSV</a>; <a href="${safeWarningsHref}" download>Download warning-code and threshold CSV</a>.</p>
  </section>
  <main id="contexts">
    <h2>Context strata</h2>
    <p>Showing ${displayContextCount} of ${report.contexts.length} context rows. <a href="${safeContextsHref}" download>Download all context rows as CSV</a>; <a href="${encodeURIComponent(promptsCsvHref)}" download>Download exact-prompt capture coverage CSV</a>; <a href="${safeTimelineHref}" download>Download day-level capture timeline CSV</a>${omitted ? `; ${omitted} more context rows are available in the CSV and JSON.` : '.'}</p>
    <label for="context-filter">Filter displayed context rows</label>
    <input id="context-filter" type="search" aria-controls="context-table" autocomplete="off">
    <p id="context-filter-status" role="status" aria-live="polite">${displayContextCount} displayed rows</p>
    <div class="table-wrap"><table id="context-table"><thead><tr><th>Provider</th><th>Model</th><th>Surface</th><th>Locale</th><th>Topic</th><th>Intent</th><th>Baseline obs.</th><th>Current obs.</th><th>Baseline distinct instants</th><th>Current distinct instants</th><th>Baseline UTC dates</th><th>Current UTC dates</th><th>Baseline observations/date</th><th>Current observations/date</th><th>Observation-share Δ (pp)</th><th>Prompt-share Δ (pp)</th><th>Matched prompts</th><th>Prompt Jaccard %</th><th>Baseline effective prompts</th><th>Current effective prompts</th><th>Baseline largest prompt share</th><th>Current largest prompt share</th><th>Baseline window days</th><th>Current window days</th><th>Window gap days</th><th>Largest baseline internal gap days</th><th>Largest current internal gap days</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
  </main>
  <script>
    const contextFilter = document.querySelector('#context-filter');
    const contextRows = [...document.querySelectorAll('#context-table tbody tr')];
    const contextStatus = document.querySelector('#context-filter-status');
    contextFilter.addEventListener('input', () => {
      const query = contextFilter.value.trim().toLocaleLowerCase();
      let visible = 0;
      for (const row of contextRows) {
        const matches = row.textContent.toLocaleLowerCase().includes(query);
        row.hidden = !matches;
        if (matches) visible++;
      }
      contextStatus.textContent = visible + ' of ' + contextRows.length + ' displayed rows match';
    });
  </script>
</body>
</html>`;
}

async function loadSet(path) {
  const fileStat = await stat(path);
  if (fileStat.size > MAX_BYTES) throw new Error(`${path}: input exceeds ${MAX_BYTES} bytes`);
  const parsed = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  return parseObservationSet(parsed, path);
}

async function main() {
  const { paths, failOnWarnings, failOnWarningCodes, thresholdsFile } = readArgv(process.argv.slice(2));
  const [baselinePath, currentPath, outputPrefix] = paths;
  const [baseline, current, thresholds] = await Promise.all([loadSet(baselinePath), loadSet(currentPath), loadThresholds(thresholdsFile)]);
  if (!baseline.observations.length || !current.observations.length) throw new Error('both input files must contain at least one valid observation');
  const report = compare(baseline, current, thresholds);
  const selectedCodes = [...new Set([...thresholds.failOnWarningCodes, ...failOnWarningCodes])];
  const warningCodesPresent = [...new Set(report.warningDetails.map((detail) => detail.code))];
  const failedCodes = failOnWarnings ? warningCodesPresent : warningCodesPresent.filter((code) => selectedCodes.includes(code));
  const gateEnabled = failOnWarnings || selectedCodes.length > 0;
  report.warningGate = {
    enabled: gateEnabled,
    status: gateEnabled ? (failedCodes.length ? 'failed' : 'passed') : 'not-enabled',
    warningCount: report.summary.warnings.length,
    mode: failOnWarnings ? 'all-warnings' : selectedCodes.length ? 'selected-codes' : 'not-enabled',
    selectedCodes,
    failedCodes
  };
  for (const detail of report.warningDetails) {
    detail.gateSelected = failOnWarnings || selectedCodes.includes(detail.code);
    detail.gateFailed = failedCodes.includes(detail.code);
  }
  const prefix = outputPrefix.replace(/\.(json|html)$/i, '');
  const outputs = [
    [`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`],
    [`${prefix}.contexts.csv`, csv(report.contexts, Object.keys(report.contexts[0] ?? { context_key: '' }))],
    [`${prefix}.prompts.csv`, csv(report.prompts, Object.keys(report.prompts[0] ?? { prompt_sha256: '' }))],
    [`${prefix}.timeline.csv`, csv(report.captureTimeline, Object.keys(report.captureTimeline[0] ?? { context_key: '' }))],
    [`${prefix}.dimensions.csv`, csv(report.dimensionCoverage, Object.keys(report.dimensionCoverage[0]))],
    [`${prefix}.warnings.csv`, csv(report.warningDetails, ['code', 'severity', 'message', 'observedValue', 'thresholdValue', 'unit', 'gateSelected', 'gateFailed'])],
    [`${prefix}.html`, renderHtml(report, basename(`${prefix}.contexts.csv`), basename(`${prefix}.dimensions.csv`), basename(`${prefix}.prompts.csv`), basename(`${prefix}.timeline.csv`), basename(`${prefix}.warnings.csv`))]
  ];
  await Promise.all(outputs.map(async ([path, data]) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, data, { mode: 0o600 }); }));
  process.stdout.write(`${JSON.stringify({ outputPrefix: prefix, ...report.summary, duplicateObservationRows: { baseline: baseline.duplicateRows, current: current.duplicateRows }, warningGate: report.warningGate })}\n`);
  if (report.warningGate.status === 'failed') process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`geo-panel-comparability: ${error.message}\n`); process.exitCode = 2; });
