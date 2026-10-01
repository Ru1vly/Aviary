import * as fs from 'fs';
import * as path from 'path';
import type {
  SEOAuditBatchReport,
  SEOAuditHistoryRecord,
  SEOAuditBatchResult,
  SEOReport,
} from './types';
import { CHECKER_REGISTRY } from './checkers/registry';
import { pathsReferToSameFile } from './utils/filePath';

const MAX_HISTORY_RECORD_BYTES = 10 * 1024 * 1024;

function recordFromReport(report: SEOReport): SEOAuditHistoryRecord {
  const failedChecks = CHECKER_REGISTRY.flatMap(({ key }) =>
    (report.checks[key] ?? [])
      .filter((check) => !check.passed)
      .map((check) => ({
        category: key,
        name: check.name ?? check.message,
        message: check.message,
        severity: check.severity,
      }))
  );

  return {
    timestamp: report.timestamp,
    url: report.url,
    status: 'complete',
    ...(report.categories ? { categories: [...report.categories] } : {}),
    ...(report.navigationWaitUntil ? { navigationWaitUntil: report.navigationWaitUntil } : {}),
    ...(report.settleAfterNavigationMs !== undefined
      ? { settleAfterNavigationMs: report.settleAfterNavigationMs }
      : {}),
    score: report.score,
    summary: report.summary,
    failedChecks,
  };
}

function recordFromBatchResult(
  result: SEOAuditBatchResult,
  timestamp: string
): SEOAuditHistoryRecord {
  if (result.status === 'complete') return recordFromReport(result.report);
  return {
    timestamp,
    url: result.url,
    status: 'error',
    score: null,
    summary: { total: 0, passed: 0, failed: 0 },
    failedChecks: [],
    error: result.error,
  };
}

function appendRecords(filePath: string, records: SEOAuditHistoryRecord[]): void {
  if (records.length === 0) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(
    filePath,
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    'utf8'
  );
}

/** Append one compact audit record as a line of JSON to a history file. */
export function appendSEOReportHistory(report: SEOReport, filePath: string): void {
  appendRecords(filePath, [recordFromReport(report)]);
}

/** Append one history line per audited URL, including individual audit errors. */
export function appendSEOAuditBatchHistory(batch: SEOAuditBatchReport, filePath: string): void {
  appendRecords(
    filePath,
    batch.results.map((result) => recordFromBatchResult(result, batch.timestamp))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHistoryRecord(value: unknown): value is SEOAuditHistoryRecord {
  if (
    !isRecord(value) ||
    typeof value.timestamp !== 'string' ||
    !Number.isFinite(Date.parse(value.timestamp)) ||
    typeof value.url !== 'string' ||
    value.url.trim().length === 0 ||
    (value.status !== 'complete' && value.status !== 'error') ||
    !(
      value.score === null ||
      (typeof value.score === 'number' &&
        Number.isFinite(value.score) &&
        value.score >= 0 &&
        value.score <= 100)
    ) ||
    !isRecord(value.summary) ||
    !Array.isArray(value.failedChecks) ||
    (value.categories !== undefined &&
      (!Array.isArray(value.categories) ||
        value.categories.some((category) => typeof category !== 'string'))) ||
    (value.navigationWaitUntil !== undefined &&
      !['domcontentloaded', 'load', 'networkidle'].includes(String(value.navigationWaitUntil))) ||
    (value.settleAfterNavigationMs !== undefined &&
      (!Number.isInteger(value.settleAfterNavigationMs) ||
        Number(value.settleAfterNavigationMs) < 0 ||
        Number(value.settleAfterNavigationMs) > 30_000)) ||
    (value.error !== undefined && typeof value.error !== 'string')
  ) {
    return false;
  }

  const { total, passed, failed } = value.summary;
  const isCount = (count: unknown): count is number =>
    typeof count === 'number' && Number.isInteger(count) && count >= 0;
  if (
    !isCount(total) ||
    !isCount(passed) ||
    !isCount(failed) ||
    total !== passed + failed ||
    failed !== value.failedChecks.length
  ) {
    return false;
  }
  if (
    value.status === 'error' &&
    (value.score !== null || typeof value.error !== 'string' || total !== 0 || failed !== 0)
  )
    return false;
  if (value.status === 'complete' && value.error !== undefined) return false;

  return value.failedChecks.every(
    (check) =>
      isRecord(check) &&
      typeof check.category === 'string' &&
      typeof check.name === 'string' &&
      typeof check.message === 'string' &&
      (check.severity === undefined ||
        check.severity === 'error' ||
        check.severity === 'warning' ||
        check.severity === 'info')
  );
}

/** Read and validate each non-empty JSONL record incrementally, preserving file order. */
export function readSEOAuditHistory(filePath: string): SEOAuditHistoryRecord[] {
  const records: SEOAuditHistoryRecord[] = [];
  const descriptor = fs.openSync(filePath, 'r');
  const chunk = Buffer.allocUnsafe(64 * 1024);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pendingParts: Buffer[] = [];
  let pendingLength = 0;
  let lineNumber = 0;

  const parseLine = (bytes: Buffer): void => {
    lineNumber += 1;
    const lineBytes = bytes[bytes.length - 1] === 0x0d ? bytes.subarray(0, -1) : bytes;
    let decoded: string;
    try {
      decoded = decoder.decode(lineBytes);
    } catch {
      throw new Error(`Invalid UTF-8 in audit history at line ${lineNumber}.`);
    }
    const line = decoded.trim();
    if (!line) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON in audit history at line ${lineNumber}.`);
    }
    if (!isHistoryRecord(parsed)) {
      throw new Error(`Invalid audit history record at line ${lineNumber}.`);
    }
    records.push(parsed);
  };

  const appendRecordPart = (part: Buffer, nextLine: number): void => {
    pendingLength += part.length;
    if (pendingLength > MAX_HISTORY_RECORD_BYTES) {
      throw new Error(`Audit history record at line ${nextLine} exceeds the 10 MiB record limit.`);
    }
    if (part.length > 0) pendingParts.push(Buffer.from(part));
  };

  const takeRecord = (): Buffer => {
    const record = Buffer.concat(pendingParts, pendingLength);
    pendingParts = [];
    pendingLength = 0;
    return record;
  };

  try {
    while (true) {
      const bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      const input = chunk.subarray(0, bytesRead);
      let offset = 0;
      let newline = input.indexOf(0x0a, offset);
      while (newline !== -1) {
        appendRecordPart(input.subarray(offset, newline), lineNumber + 1);
        parseLine(takeRecord());
        offset = newline + 1;
        newline = input.indexOf(0x0a, offset);
      }
      const rest = input.subarray(offset);
      if (rest.length > 0) appendRecordPart(rest, lineNumber + 1);
    }
    if (pendingLength > 0) parseLine(takeRecord());
  } finally {
    fs.closeSync(descriptor);
  }
  return records;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Keep chart markup bounded while retaining each bucket's score extremes. */
function downsampleScores(
  records: SEOAuditHistoryRecord[],
  maxPoints = 180
): SEOAuditHistoryRecord[] {
  if (records.length <= maxPoints) return records;
  const bucketCount = Math.floor((maxPoints - 2) / 2);
  const bucketSize = (records.length - 2) / bucketCount;
  const sampled = [records[0]];

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor(bucket * bucketSize);
    const end = Math.min(records.length - 1, 1 + Math.floor((bucket + 1) * bucketSize));
    let minIndex = start;
    let maxIndex = start;
    for (let index = start + 1; index < end; index += 1) {
      if ((records[index].score ?? 0) < (records[minIndex].score ?? 0)) minIndex = index;
      if ((records[index].score ?? 0) > (records[maxIndex].score ?? 0)) maxIndex = index;
    }
    for (const index of [minIndex, maxIndex].sort((a, b) => a - b)) {
      if (sampled[sampled.length - 1] !== records[index]) sampled.push(records[index]);
    }
  }

  const last = records[records.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function renderScoreChart(records: SEOAuditHistoryRecord[]): string {
  const scored = records.filter((record) => record.status === 'complete' && record.score !== null);
  if (scored.length === 0) return '<div class="empty-chart">No scored audits yet.</div>';
  const plotted = downsampleScores(scored);

  const width = 720;
  const height = 220;
  const left = 38;
  const right = 12;
  const top = 14;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const firstTime = Date.parse(scored[0].timestamp);
  const lastTime = Date.parse(scored[scored.length - 1].timestamp);
  const xFor = (record: SEOAuditHistoryRecord, index: number): number => {
    if (lastTime > firstTime) {
      const time = Date.parse(record.timestamp);
      if (Number.isFinite(time))
        return left + ((time - firstTime) / (lastTime - firstTime)) * plotWidth;
    }
    return (
      left + (plotted.length === 1 ? plotWidth / 2 : (index * plotWidth) / (plotted.length - 1))
    );
  };
  const yFor = (score: number): number => top + ((100 - score) * plotHeight) / 100;
  const points = plotted
    .map((record, index) => `${xFor(record, index)},${yFor(record.score ?? 0)}`)
    .join(' ');
  const grid = [100, 50, 0]
    .map((score) => {
      const y = yFor(score);
      return `<g><line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text x="${left - 8}" y="${y + 4}" text-anchor="end">${score}</text></g>`;
    })
    .join('');
  const dots = plotted
    .map(
      (record, index) =>
        `<circle cx="${xFor(record, index)}" cy="${yFor(record.score ?? 0)}" r="4"><title>${escapeHtml(record.timestamp)}: ${record.score}/100</title></circle>`
    )
    .join('');
  const firstDate = escapeHtml(scored[0].timestamp.slice(0, 10));
  const lastDate = escapeHtml(scored[scored.length - 1].timestamp.slice(0, 10));

  return `<svg class="score-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="SEO score history from ${firstDate} to ${lastDate}">
    ${grid}<polyline points="${points}"/>${dots}
    <text x="${left}" y="${height - 5}">${firstDate}</text>
    <text x="${width - right}" y="${height - 5}" text-anchor="end">${lastDate}</text>
  </svg>`;
}

/** Render a self-contained HTML score timeline grouped by URL. */
export function renderSEOAuditHistoryHtml(records: SEOAuditHistoryRecord[]): string {
  const byUrl = new Map<string, SEOAuditHistoryRecord[]>();
  for (const record of records) {
    const history = byUrl.get(record.url) ?? [];
    history.push(record);
    byUrl.set(record.url, history);
  }

  const sections = [...byUrl.entries()]
    .map(([url, history]) => {
      const ordered = [...history].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const latest = ordered[ordered.length - 1];
      const previousRecord = [...ordered.slice(0, -1)]
        .reverse()
        .find((record) => record.score !== null);
      const previousScore = previousRecord?.score ?? undefined;
      const delta =
        latest.score === null || previousScore === undefined
          ? 'N/A'
          : `${latest.score - previousScore > 0 ? '+' : ''}${latest.score - previousScore}`;
      const failures =
        latest.failedChecks.length > 0
          ? `<ul>${latest.failedChecks
              .slice(0, 12)
              .map(
                (check) =>
                  `<li><span>${escapeHtml(check.category)}</span> ${escapeHtml(check.name)} — ${escapeHtml(check.message)}</li>`
              )
              .join('')}</ul>`
          : `<p class="empty">${latest.status === 'error' ? escapeHtml(latest.error ?? 'Audit failed') : 'No failed checks in the latest audit.'}</p>`;

      const attention = latest.status === 'error' || latest.failedChecks.length > 0;
      return `<section class="site-card" data-url="${escapeHtml(url)}" data-status="${latest.status}" data-attention="${attention}" data-score="${latest.score ?? ''}" data-timestamp="${escapeHtml(latest.timestamp)}">
      <div class="site-head"><div><h2>${escapeHtml(url)}</h2><p>${ordered.length} audit record${ordered.length === 1 ? '' : 's'}</p></div>
        <div class="latest"><strong>${latest.score === null ? 'N/A' : `${latest.score}/100`}</strong><span>Δ ${delta}</span></div>
      </div>
      ${renderScoreChart(ordered)}
      <h3>Latest findings</h3>${failures}
    </section>`;
    })
    .join('\n');
  const failedRuns = records.filter((record) => record.status === 'error').length;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aviary audit history</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#0b1020;color:#e8edf7}
*{box-sizing:border-box}body{margin:0;padding:40px clamp(16px,5vw,72px);background:radial-gradient(ellipse at top right,#1e2850 0,#0b1020 48%)}
main{max-width:1120px;margin:auto}.eyebrow{color:#91a4ff;text-transform:uppercase;letter-spacing:.18em;font-size:.72rem;font-weight:700}
h1{font-size:clamp(2rem,5vw,3.4rem);letter-spacing:-.05em;margin:.5rem 0}.intro{color:#99a5bd;margin-bottom:28px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}.stat,.site-card{border:1px solid #26314c;background:#111a2e;border-radius:16px}
.stat{padding:14px 18px;color:#aab6cc}.stat strong{display:block;color:#f2f5fc;font-size:1.2rem}.site-card{padding:22px;margin:16px 0;box-shadow:0 16px 48px #0003}
.site-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.site-head h2{font-size:1.05rem;overflow-wrap:anywhere;margin:0}.site-head p,.latest span{color:#93a0b8;font-size:.84rem;margin:.3rem 0}
.latest{text-align:right;white-space:nowrap}.latest strong{display:block;font-size:1.6rem;color:#a8f0c6}.score-chart{display:block;width:100%;height:auto;margin:16px 0 22px;overflow:visible}
.score-chart line{stroke:#2b3651;stroke-width:1}.score-chart text{fill:#8290aa;font-size:11px}.score-chart polyline{fill:none;stroke:#76e0ad;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.score-chart circle{fill:#a8f0c6;stroke:#111a2e;stroke-width:2}.site-card h3{font-size:.86rem;text-transform:uppercase;letter-spacing:.12em;color:#b4bfd2}
ul{padding-left:1.25rem;color:#c6cede;line-height:1.7}li span{color:#99aaff;font-size:.83rem}.empty,.empty-chart{color:#8794ad}.empty-chart{padding:54px 0;text-align:center}
.toolbar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(160px,.5fr) minmax(160px,.5fr);gap:12px;align-items:end;margin:0 0 16px}
.toolbar label{display:grid;gap:6px;color:#aab6cc;font-size:.8rem}.toolbar input,.toolbar select{width:100%;padding:11px 12px;border:1px solid #34415e;border-radius:9px;background:#0d1528;color:#edf2fb;font:inherit}
.toolbar input:focus,.toolbar select:focus{outline:2px solid #91a4ff;outline-offset:2px}.toolbar-status{grid-column:1/-1;margin:0;color:#8794ad;font-size:.82rem}
[hidden]{display:none!important}
footer{margin-top:32px;color:#74819a;font-size:.8rem;text-align:center}@media print{body{padding:16px;background:#0b1020;print-color-adjust:exact}.site-card{break-inside:avoid-page}}
@media(max-width:640px){.toolbar{grid-template-columns:1fr}.toolbar-status{grid-column:auto}}
</style></head><body><main>
<div class="eyebrow">Aviary · trend report</div><h1>Audit history</h1>
<p class="intro">Score timelines and latest findings by URL.</p>
<div class="stats"><div class="stat"><strong>${records.length}</strong>audit records</div>
<div class="stat"><strong>${byUrl.size}</strong>URLs tracked</div><div class="stat"><strong>${failedRuns}</strong>audit errors</div></div>
<div class="toolbar" role="search" aria-label="Filter audit history">
  <label>Find a URL<input id="url-filter" type="search" placeholder="Search tracked URLs" autocomplete="off"></label>
  <label>Health<select id="health-filter"><option value="all">All sites</option><option value="attention">Needs attention</option><option value="errors">Audit errors</option></select></label>
  <label>Sort by<select id="sort-order"><option value="url">URL</option><option value="score-high">Highest score</option><option value="score-low">Lowest score</option><option value="recent">Most recent</option></select></label>
  <p id="result-count" class="toolbar-status" role="status" aria-live="polite"></p>
</div>
<div id="site-list">${sections || '<section class="site-card empty">No history records yet.</section>'}</div>
<p id="no-matches" class="empty" hidden>No sites match these filters.</p>
<footer>Generated by Aviary · ${new Date().toISOString()}</footer></main>
<script>
(() => {
  const list = document.getElementById('site-list');
  const cards = Array.from(list.querySelectorAll('.site-card[data-url]'));
  const search = document.getElementById('url-filter');
  const health = document.getElementById('health-filter');
  const sort = document.getElementById('sort-order');
  const count = document.getElementById('result-count');
  const empty = document.getElementById('no-matches');
  const scoreOf = (card) => card.dataset.score === '' ? null : Number(card.dataset.score);
  const compare = (a, b) => {
    if (sort.value === 'recent') return b.dataset.timestamp.localeCompare(a.dataset.timestamp);
    if (sort.value === 'score-high' || sort.value === 'score-low') {
      const left = scoreOf(a);
      const right = scoreOf(b);
      if (left === null) return right === null ? a.dataset.url.localeCompare(b.dataset.url) : 1;
      if (right === null) return -1;
      return sort.value === 'score-high' ? right - left : left - right;
    }
    return a.dataset.url.localeCompare(b.dataset.url);
  };
  const update = () => {
    const query = search.value.trim().toLocaleLowerCase();
    const matching = cards.filter((card) => {
      if (!card.dataset.url.toLocaleLowerCase().includes(query)) return false;
      if (health.value === 'attention' && card.dataset.attention !== 'true') return false;
      if (health.value === 'errors' && card.dataset.status !== 'error') return false;
      return true;
    }).sort(compare);
    const visible = new Set(matching);
    for (const card of cards) card.hidden = !visible.has(card);
    for (const card of matching) list.append(card);
    count.textContent = 'Showing ' + matching.length + ' of ' + cards.length + ' sites';
    empty.hidden = cards.length === 0 || matching.length > 0;
  };
  search.addEventListener('input', update);
  health.addEventListener('change', update);
  sort.addEventListener('change', update);
  update();
})();
</script></body></html>`;
}

/** Write an HTML trend report from previously appended JSONL records. */
export function generateSEOAuditHistoryHtmlReport(
  records: SEOAuditHistoryRecord[],
  outputPath: string
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderSEOAuditHistoryHtml(records), 'utf8');
}

/** Read a JSONL history file and write its self-contained HTML trend report. */
export function generateSEOAuditHistoryReportFromFile(
  historyPath: string,
  outputPath: string
): void {
  if (pathsReferToSameFile(historyPath, outputPath)) {
    throw new Error('The HTML report path must differ from the JSONL history path.');
  }
  generateSEOAuditHistoryHtmlReport(readSEOAuditHistory(historyPath), outputPath);
}
