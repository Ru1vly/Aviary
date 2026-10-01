import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser } from 'playwright';
import type { SEOReport, SEOCheckResult, SEOAuditBatchReport } from './types';
import { CHECKER_REGISTRY as SECTIONS } from './checkers/registry';
import { compareSEOWithCompetitors } from './scoring';
import type {
  SEOAuditBatchComparison,
  SEOCompetitorComparison,
  SEOReportComparison,
} from './scoring';
import { generateSEORecommendations } from './recommendations';
import type { SEORecommendation } from './recommendations';
import {
  analyzeSiteWideCanonicals,
  analyzeSiteWideContent,
  analyzeSiteWideGeo,
  analyzeSiteWideHreflang,
  analyzeSiteWideLinkGraph,
  analyzeSiteWideMetadata,
} from './sitewide';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(str: string): string {
  const validXml = Array.from(String(str))
    .filter((char) => {
      const point = char.codePointAt(0) ?? 0;
      return (
        point === 0x9 ||
        point === 0xa ||
        point === 0xd ||
        (point >= 0x20 && point <= 0xd7ff) ||
        (point >= 0xe000 && point <= 0xfffd) ||
        (point >= 0x10000 && point <= 0x10ffff)
      );
    })
    .join('');

  return validXml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeMarkdownCell(str: string): string {
  const escaped = String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n\t]+/g, ' ');
  const markdownSyntax = String.fromCharCode(96) + '*_{}[]()#+-.!';
  return Array.from(escaped)
    .map((char) => (markdownSyntax.includes(char) ? '\\' + char : char))
    .join('');
}

function escapeCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if ('=+-@'.includes(text.trimStart().charAt(0))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function sectionsFor(report: SEOReport) {
  if (!report.categories) return SECTIONS;
  const selected = new Set(report.categories);
  return SECTIONS.filter(({ key }) => selected.has(key));
}

function recommendationKey(
  category: string,
  name: string,
  finding: string,
  severity?: string
): string {
  return `${category}\0${name}\0${finding}\0${severity ?? ''}`;
}

function recommendationQueues(report: SEOReport): Map<string, SEORecommendation[]> {
  const queues = new Map<string, SEORecommendation[]>();
  for (const recommendation of generateSEORecommendations(report)) {
    const key = recommendationKey(
      recommendation.category,
      recommendation.checkName,
      recommendation.finding,
      recommendation.severity
    );
    const queue = queues.get(key) ?? [];
    queue.push(recommendation);
    queues.set(key, queue);
  }
  return queues;
}

function takeRecommendation(
  queues: Map<string, SEORecommendation[]>,
  category: string,
  checkName: string,
  finding: string,
  severity?: string
): SEORecommendation | undefined {
  return queues.get(recommendationKey(category, checkName, finding, severity))?.shift();
}

function writeReportFile(outputPath: string, content: string | Uint8Array): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (typeof content === 'string') fs.writeFileSync(outputPath, content, 'utf8');
  else fs.writeFileSync(outputPath, content);
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function scoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : timestamp;
}

function captureTimingForReport(report: SEOReport): string {
  return `navigation readiness ${report.navigationWaitUntil ?? 'not recorded'}; settle delay ${report.settleAfterNavigationMs === undefined ? 'not recorded' : `${report.settleAfterNavigationMs} ms`}`;
}

function captureTimingForBatch(batch: SEOAuditBatchReport): string {
  const reports = batch.results.flatMap((result) =>
    result.status === 'complete' ? [result.report] : []
  );
  const waits = new Set(
    reports.map((report) => report.navigationWaitUntil).filter((value) => value !== undefined)
  );
  const settles = new Set(
    reports.map((report) => report.settleAfterNavigationMs).filter((value) => value !== undefined)
  );
  const waitPages = reports.filter((report) => report.navigationWaitUntil !== undefined).length;
  const settlePages = reports.filter(
    (report) => report.settleAfterNavigationMs !== undefined
  ).length;
  const formatValues = (values: Set<string | number>, recorded: number): string =>
    values.size === 0
      ? 'not recorded'
      : `${[...values].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)))).join(', ')} (${recorded}/${reports.length} page reports)`;
  return `navigation readiness ${formatValues(waits, waitPages)}; settle delay ${formatValues(settles, settlePages)}${settles.size > 0 ? ' ms' : ''}`;
}

// ─── Heatmap visualization ────────────────────────────────────────────────────
// The heatmap checker (src/checkers/heatmap.ts) computes real click/attention
// coordinates and a page screenshot, but until now they were only ever
// summarized into a pass/fail message -- this renders the actual overlay so
// a person can look at the page and judge attention flow themselves, not
// just take the checker's verdict.

interface HeatmapPointDetail {
  x: number;
  y: number;
  value: number;
  element?: string;
}

interface AttentionZoneDetail {
  selector: string;
  score: number;
  zone: string;
  bounds: { top: number; left: number; width: number; height: number };
}

/** Blue (cold/low value) to red (hot/high value), matching a conventional heatmap gradient. */
function heatmapColor(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  const hue = 240 - (240 * clamped) / 100;
  return `hsl(${hue}, 90%, 50%)`;
}

function renderHeatmapVisualization(heatmapChecks: SEOCheckResult[]): string {
  const clickCheck = heatmapChecks.find((c) => c.name === 'click-heatmap-generated');
  const attentionCheck = heatmapChecks.find((c) => c.name === 'attention-zones-strong');

  const screenshot = clickCheck?.details?.screenshot as string | undefined;
  if (!screenshot) return '';

  const pageWidth = (clickCheck?.details?.pageWidth as number) || 1;
  const pageHeight = (clickCheck?.details?.pageHeight as number) || 1;
  const points = (clickCheck?.details?.allPoints as HeatmapPointDetail[] | undefined) ?? [];
  const zones =
    (attentionCheck?.details?.allAttentionElements as AttentionZoneDetail[] | undefined) ?? [];

  const dots = points
    .map((p) => {
      const left = ((p.x / pageWidth) * 100).toFixed(2);
      const top = ((p.y / pageHeight) * 100).toFixed(2);
      const size = 14 + (p.value / 100) * 22;
      const color = heatmapColor(p.value);
      const title = escapeHtml(`${p.element ?? 'element'} (${Math.round(p.value)})`);
      return `<div class="heatmap-dot" title="${title}" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;background:radial-gradient(circle, ${color}99 0%, ${color}00 70%);"></div>`;
    })
    .join('');

  const zoneBoxes = zones
    .map((z) => {
      const left = ((z.bounds.left / pageWidth) * 100).toFixed(2);
      const top = ((z.bounds.top / pageHeight) * 100).toFixed(2);
      const width = ((z.bounds.width / pageWidth) * 100).toFixed(2);
      const height = ((z.bounds.height / pageHeight) * 100).toFixed(2);
      const color = heatmapColor(z.score);
      const title = escapeHtml(
        `${z.selector} — attention score ${Math.round(z.score)} (${z.zone})`
      );
      return `<div class="heatmap-zone" title="${title}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;border-color:${color};"></div>`;
    })
    .join('');

  return `
  <div class="issues-section" id="heatmap-visualization">
    <h2 class="section-title">🔥 Heatmap Visualization</h2>
    <p class="heatmap-caption">Predicted click attention (dots) and high-attention zones (boxes) overlaid on the actual page — hover a marker for details. Judge for yourself where a visitor's eye actually goes.</p>
    <div class="heatmap-frame">
      <img class="heatmap-screenshot" src="data:image/jpeg;base64,${screenshot}" alt="Page screenshot with heatmap overlay" />
      <div class="heatmap-overlay">
        ${zoneBoxes}
        ${dots}
      </div>
    </div>
    <div class="heatmap-legend">
      <span class="heatmap-legend-swatch" style="background:${heatmapColor(10)}"></span> Low attention
      <span class="heatmap-legend-swatch" style="background:${heatmapColor(90)}"></span> High attention
    </div>
  </div>`;
}

function severityBadge(severity?: string): string {
  if (!severity) return '';
  const map: Record<string, string> = {
    error: '<span class="badge badge-error">ERROR</span>',
    warning: '<span class="badge badge-warning">WARNING</span>',
    info: '<span class="badge badge-info">INFO</span>',
  };
  return map[severity] ?? '';
}

function renderChecks(checks: SEOCheckResult[]): string {
  if (!checks.length) return '<p class="empty">No checks ran for this category.</p>';

  const passed = checks.filter((c) => c.passed);
  const failed = checks.filter((c) => !c.passed);

  const renderItem = (c: SEOCheckResult) => {
    const icon = c.passed ? '✓' : '✗';
    const cls = c.passed ? 'check-pass' : 'check-fail';
    const detailsHtml =
      !c.passed && c.details
        ? `<pre class="check-details">${escapeHtml(JSON.stringify(c.details, null, 2))}</pre>`
        : '';
    const nameHtml = c.name ? `<code class="check-name">${escapeHtml(c.name)}</code>` : '';
    return `
      <li class="check-item ${cls}">
        <span class="check-icon">${icon}</span>
        <span class="check-message">${nameHtml}${escapeHtml(c.message)}</span>
        ${c.passed ? '' : severityBadge(c.severity)}
        ${detailsHtml}
      </li>`;
  };

  return `
    <ul class="check-list">
      ${failed.map(renderItem).join('')}
      ${passed.map(renderItem).join('')}
    </ul>`;
}

// ─── Section map ─────────────────────────────────────────────────────────────
// SECTIONS is CHECKER_REGISTRY (src/checkers/registry.ts) — the single
// source of truth for the 28 checker categories, their labels, and icons.

// ─── Main template ────────────────────────────────────────────────────────────

function generateHtml(report: SEOReport, comparison?: SEOReportComparison): string {
  // report.score is null when nothing was checked (see calculateWeightedScore) —
  // render "N/A" with a neutral color rather than feeding null into a
  // >= comparison, which would silently fall through to the red/F case.
  const reportScore = report.score;
  const color = reportScore !== null ? scoreColor(reportScore) : '#94a3b8';
  const grade = reportScore !== null ? scoreGrade(reportScore) : 'N/A';
  const scoreDisplay = reportScore !== null ? String(reportScore) : 'N/A';
  const passRate =
    report.summary.total > 0 ? Math.round((report.summary.passed / report.summary.total) * 100) : 0;
  const reportSections = sectionsFor(report);
  const recommendations = generateSEORecommendations(report);
  const recommendationCards = recommendations
    .slice(0, 12)
    .map(
      (recommendation) => `
    <article class="recommendation-card">
      <div class="recommendation-head"><span class="badge badge-${recommendation.priority === 'high' ? 'error' : recommendation.priority === 'medium' ? 'warning' : 'info'}">${recommendation.priority} priority</span>
      ${recommendation.quickWin ? '<span class="quick-win">Quick win</span>' : ''}<strong>${escapeHtml(recommendation.categoryLabel)} · ${escapeHtml(recommendation.checkName)}</strong>
      <span class="score-lift" title="Estimated if only this finding is resolved; not a search ranking prediction">${recommendation.scoreLift === null ? 'Score lift unavailable' : `+${recommendation.scoreLift} Aviary score points`}</span></div>
      <p class="recommendation-finding">${escapeHtml(recommendation.finding)}</p>
      <p>${escapeHtml(recommendation.action)}</p>
      ${recommendation.example ? `<pre class="recommendation-example"><code>${escapeHtml(recommendation.example.code)}</code></pre>` : ''}
    </article>`
    )
    .join('');

  // Category summaries for the overview grid
  const categorySummaries = reportSections.map(({ key, label, icon }) => {
    const checks = report.checks[key] ?? [];
    const p = checks.filter((c) => c.passed).length;
    const t = checks.length;
    const pct = t > 0 ? Math.round((p / t) * 100) : 100;
    const catColor = scoreColor(pct);
    return { key, label, icon, p, t, pct, catColor };
  });

  // Section detail cards
  const sectionCards = reportSections
    .map(({ key, label, icon }) => {
      const checks = report.checks[key] ?? [];
      const p = checks.filter((c) => c.passed).length;
      const f = checks.filter((c) => !c.passed).length;
      return `
      <section class="category-card" id="cat-${key}">
        <div class="category-header">
          <span class="category-icon">${icon}</span>
          <h2 class="category-title">${escapeHtml(label)}</h2>
          <div class="category-stats">
            <span class="stat-pass">✓ ${p}</span>
            <span class="stat-fail">✗ ${f}</span>
          </div>
        </div>
        ${renderChecks(checks)}
      </section>`;
    })
    .join('\n');

  const comparisonPanel = comparison
    ? `
  <section class="issues-section comparison-panel">
    <h2 class="section-title">📈 Baseline comparison</h2>
    <p>Baseline ${escapeHtml(comparison.baselineUrl)} · ${escapeHtml(formatTimestamp(comparison.baselineTimestamp))} · score ${comparison.baselineScore ?? 'N/A'} → ${comparison.currentScore ?? 'N/A'}${comparison.scoreDelta === null ? '' : ` (${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta})`}</p>
    <p>${comparison.newFailures.length} new failed checks · ${comparison.resolvedFailures.length} resolved checks · ${comparison.geoChanges.length} observed GEO signal changes · crawler access/preview controls ${comparison.geoCompared ? 'comparable' : 'not fully comparable'}</p>
    ${
      comparison.geoChanges.length
        ? `<h3>GEO signal changes${comparison.geoChanges.length > 50 ? ' (first 50)' : ''}</h3><ul>${comparison.geoChanges
            .slice(0, 50)
            .map(
              (change) =>
                `<li><strong>${escapeHtml(change.signal)}</strong>: ${escapeHtml(change.before)} → ${escapeHtml(change.after)}</li>`
            )
            .join('')}</ul><p>These snapshot differences do not predict citations.</p>`
        : ''
    }
    ${
      comparison.newFailures.length
        ? `<h3>New failed checks${comparison.newFailures.length > 50 ? ' (first 50)' : ''}</h3><ul>${comparison.newFailures
            .slice(0, 50)
            .map(
              (finding) =>
                `<li><strong>${escapeHtml(finding.category)} · ${escapeHtml(finding.name)}</strong>: ${escapeHtml(finding.message)}</li>`
            )
            .join('')}</ul>`
        : ''
    }
    ${
      comparison.resolvedFailures.length
        ? `<h3>Resolved checks${comparison.resolvedFailures.length > 50 ? ' (first 50)' : ''}</h3><ul>${comparison.resolvedFailures
            .slice(0, 50)
            .map(
              (finding) =>
                `<li><strong>${escapeHtml(finding.category)} · ${escapeHtml(finding.name)}</strong>: ${escapeHtml(finding.message)}</li>`
            )
            .join('')}</ul>`
        : ''
    }
  </section>`
    : '';

  // Failed checks summary
  const allFailed = reportSections.flatMap(({ key, label, icon }) =>
    (report.checks[key] ?? [])
      .filter((c) => !c.passed)
      .map((c) => ({ ...c, category: label, icon }))
  );

  const failedSummaryRows = allFailed
    .slice(0, 20)
    .map(
      (c) => `
    <tr class="${c.severity === 'error' ? 'row-error' : c.severity === 'info' ? 'row-info' : 'row-warn'}">
      <td>${c.icon} ${escapeHtml(c.category)}</td>
      <td>${severityBadge(c.severity)}</td>
      <td>${escapeHtml(c.message)}</td>
    </tr>`
    )
    .join('');

  const moreCount = allFailed.length - 20;

  const heatmapVisualization = renderHeatmapVisualization(report.checks.heatmap ?? []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Report — ${escapeHtml(report.url)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        #0f1117;
      --surface:   #1a1d27;
      --surface2:  #22263a;
      --border:    #2e3347;
      --text:      #e2e8f0;
      --text-muted:#8892a4;
      --green:     #22c55e;
      --amber:     #f59e0b;
      --red:       #ef4444;
      --blue:      #3b82f6;
      --purple:    #8b5cf6;
      --radius:    12px;
      --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 15px;
      line-height: 1.6;
      min-height: 100vh;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1a1d27 0%, #12162b 100%);
      border-bottom: 1px solid var(--border);
      padding: 2.5rem 2rem 2rem;
    }
    .header-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 2rem;
      flex-wrap: wrap;
    }
    .score-ring {
      flex-shrink: 0;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 6px solid ${color};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 32px ${color}40;
    }
    .score-number { font-size: 2rem; font-weight: 800; color: ${color}; line-height: 1; }
    .score-label  { font-size: 0.7rem; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; }
    .header-meta  { flex: 1; min-width: 0; }
    .header-url   { font-size: 1.3rem; font-weight: 700; color: var(--text); word-break: break-all; }
    .header-time  { font-size: 0.82rem; color: var(--text-muted); margin-top: 0.25rem; }
    .header-grade {
      font-size: 3rem; font-weight: 900; color: ${color};
      text-shadow: 0 0 24px ${color}60;
    }
    .summary-pills { display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
    .pill {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.3rem 1rem;
      font-size: 0.83rem;
      font-weight: 600;
    }
    .pill-pass { color: var(--green); }
    .pill-fail { color: var(--red); }
    .pill-total { color: var(--text-muted); }

    /* ── Layout ── */
    .main { max-width: 1100px; margin: 0 auto; padding: 2rem; }

    /* ── Failed summary table ── */
    .issues-section { margin-bottom: 2.5rem; }
    .comparison-panel { padding: 1.25rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .comparison-panel p { color: var(--text-muted); margin: 0.5rem 0; line-height: 1.5; }
    .comparison-panel h3 { font-size: 0.92rem; margin-top: 1rem; }
    .comparison-panel ul { list-style: disc; padding-left: 1.25rem; margin: 0.5rem 0 1rem; }
    .comparison-panel li { margin: 0.35rem 0; line-height: 1.45; }
    .section-title {
      font-size: 1.1rem; font-weight: 700; color: var(--text);
      margin-bottom: 1rem;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .issues-table {
      width: 100%; border-collapse: collapse;
      background: var(--surface); border-radius: var(--radius);
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .issues-table th {
      background: var(--surface2); color: var(--text-muted);
      font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em;
      padding: 0.65rem 1rem; text-align: left;
    }
    .issues-table td { padding: 0.65rem 1rem; border-top: 1px solid var(--border); font-size: 0.88rem; vertical-align: top; }
    .row-error td:first-child { border-left: 3px solid var(--red); }
    .row-warn  td:first-child { border-left: 3px solid var(--amber); }
    .row-info  td:first-child { border-left: 3px solid var(--blue); }
    .more-row td { color: var(--text-muted); font-style: italic; padding: 0.5rem 1rem; }

    /* ── Heatmap visualization ── */
    .heatmap-caption { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem; }
    .heatmap-frame {
      position: relative;
      display: inline-block;
      max-width: 100%;
      border-radius: var(--radius);
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .heatmap-screenshot { display: block; max-width: 100%; height: auto; }
    .heatmap-overlay { position: absolute; inset: 0; }
    .heatmap-dot {
      position: absolute;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      pointer-events: auto;
    }
    .heatmap-zone {
      position: absolute;
      border: 2px solid;
      border-radius: 4px;
      background: transparent;
      pointer-events: auto;
    }
    .heatmap-legend {
      margin-top: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .heatmap-legend-swatch {
      display: inline-block;
      width: 14px; height: 14px;
      border-radius: 50%;
      margin-left: 0.75rem;
    }
    .heatmap-legend-swatch:first-child { margin-left: 0; }

    /* ── Category overview grid ── */
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
      margin-bottom: 2.5rem;
    }
    .overview-tile {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.9rem 1rem;
      text-decoration: none;
      color: var(--text);
      transition: border-color 0.15s, transform 0.15s;
      display: block;
    }
    .overview-tile:hover { border-color: var(--purple); transform: translateY(-2px); }
    .tile-header { display: flex; align-items: center; justify-content: space-between; }
    .tile-icon  { font-size: 1.3rem; }
    .tile-pct   { font-size: 1rem; font-weight: 700; }
    .tile-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem; }
    .tile-bar   { height: 3px; border-radius: 99px; background: var(--border); margin-top: 0.5rem; overflow: hidden; }
    .tile-bar-fill { height: 100%; border-radius: 99px; }

    /* ── Category detail cards ── */
    .category-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .category-header {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: var(--surface2);
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }
    .category-icon  { font-size: 1.2rem; }
    .category-title { font-size: 1rem; font-weight: 700; flex: 1; }
    .category-stats { display: flex; gap: 0.75rem; font-size: 0.85rem; font-weight: 600; }
    .stat-pass { color: var(--green); }
    .stat-fail { color: var(--red); }

    /* ── Check list ── */
    .check-list { list-style: none; padding: 0; }
    .check-item {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.65rem 1.25rem;
      border-top: 1px solid var(--border);
      font-size: 0.875rem;
      flex-wrap: wrap;
    }
    .check-icon { flex-shrink: 0; font-size: 0.9rem; margin-top: 0.1rem; }
    .check-message { flex: 1; min-width: 0; }
    .check-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.75rem; color: var(--text-muted);
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 4px; padding: 0.05rem 0.4rem; margin-right: 0.4rem;
    }
    .check-pass .check-icon { color: var(--green); }
    .check-fail .check-icon { color: var(--red); }
    .check-details {
      width: 100%; margin-top: 0.4rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.6rem 0.8rem;
      font-size: 0.78rem;
      color: var(--text-muted);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .empty { color: var(--text-muted); font-style: italic; padding: 1rem 1.25rem; font-size: 0.85rem; }

    /* ── Badges ── */
    .badge {
      display: inline-block; padding: 0.15rem 0.5rem;
      border-radius: 4px; font-size: 0.72rem; font-weight: 700;
      letter-spacing: 0.05em; text-transform: uppercase;
      flex-shrink: 0;
    }
    .badge-error   { background: #ef444420; color: var(--red); border: 1px solid #ef444440; }
    .badge-warning { background: #f59e0b20; color: var(--amber); border: 1px solid #f59e0b40; }
    .badge-info    { background: #3b82f620; color: var(--blue); border: 1px solid #3b82f640; }

    /* ── Recommendations ── */
    .recommendation-list { display: grid; gap: 0.75rem; }
    .recommendation-card { padding: 1rem 1.1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
    .recommendation-head { display: flex; align-items: center; flex-wrap: wrap; gap: 0.55rem; margin-bottom: 0.55rem; }
    .recommendation-finding { color: var(--text-muted); margin-bottom: 0.35rem; }
    .recommendation-example { margin-top: 0.65rem; padding: 0.7rem 0.85rem; overflow-x: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: #cbd5e1; font-size: 0.78rem; }
    .score-lift { margin-left: auto; color: var(--text-muted); font-size: 0.75rem; }
    .quick-win { color: var(--green); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }

    /* ── Footer ── */
    .footer {
      text-align: center; padding: 2rem;
      color: var(--text-muted); font-size: 0.8rem;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
    }

    @page { margin: 12mm; }
    @media print {
      body { min-height: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .header { padding: 1.5rem; }
      .main { max-width: none; padding: 1.25rem 0; }
      .category-card, .issues-section, .overview-tile, .footer, .recommendation-card { break-inside: avoid-page; }
      .category-header { cursor: default; }
      .overview-tile:hover { transform: none; }
    }

    @media (max-width: 640px) {
      .header-inner { flex-direction: column; align-items: flex-start; }
      .overview-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>

<!-- ── Header ── -->
<header class="header">
  <div class="header-inner">
    <div class="score-ring">
      <span class="score-number">${scoreDisplay}</span>
      <span class="score-label">Score</span>
    </div>
    <div class="header-meta">
      <div class="header-url">${escapeHtml(report.url)}</div>
      <div class="header-time">Generated ${new Date(report.timestamp).toLocaleString()}</div>
      <div class="header-time">Capture: ${escapeHtml(captureTimingForReport(report))}</div>
      <div class="header-time">Score summarizes checks run; it is not a ranking or GEO-readiness prediction.</div>
      <div class="summary-pills">
        <span class="pill pill-pass">✓ ${report.summary.passed} passed</span>
        <span class="pill pill-fail">✗ ${report.summary.failed} failed</span>
        <span class="pill pill-total">${report.summary.total} total checks</span>
        <span class="pill pill-total">${passRate}% pass rate</span>
      </div>
    </div>
    <div class="header-grade">${grade}</div>
  </div>
</header>

<main class="main">

  <!-- ── Failing checks summary ── -->
  ${
    allFailed.length > 0
      ? `
  <div class="issues-section">
    <h2 class="section-title">⚠️ Issues to Fix${allFailed.length > 20 ? ` (top 20 of ${allFailed.length})` : ` (${allFailed.length})`}</h2>
    <table class="issues-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Severity</th>
          <th>Issue</th>
        </tr>
      </thead>
      <tbody>
        ${failedSummaryRows}
        ${moreCount > 0 ? `<tr class="more-row"><td colspan="3">… and ${moreCount} more issues in the detail sections below</td></tr>` : ''}
      </tbody>
    </table>
  </div>`
      : `
  <div class="issues-section">
    <p style="color: var(--green); font-weight: 600; font-size: 1.1rem;">🎉 All checks passed!</p>
  </div>`
  }

  ${
    recommendationCards
      ? `
  <section class="issues-section">
    <h2 class="section-title">🧭 Recommended next steps${recommendations.length > 12 ? ` (top 12 of ${recommendations.length})` : ''}</h2>
    <div class="recommendation-list">${recommendationCards}</div>
  </section>`
      : ''
  }

  <!-- ── Heatmap visualization ── -->
  ${heatmapVisualization}

  ${comparisonPanel}

  <!-- ── Category overview grid ── -->
  <div class="issues-section">
    <h2 class="section-title">📊 Category Overview</h2>
    <div class="overview-grid">
      ${categorySummaries
        .map(
          ({ key, label, icon, pct, catColor }) => `
        <a class="overview-tile" href="#cat-${key}">
          <div class="tile-header">
            <span class="tile-icon">${icon}</span>
            <span class="tile-pct" style="color:${catColor}">${pct}%</span>
          </div>
          <div class="tile-label">${escapeHtml(label)}</div>
          <div class="tile-bar">
            <div class="tile-bar-fill" style="width:${pct}%;background:${catColor}"></div>
          </div>
        </a>`
        )
        .join('')}
    </div>
  </div>

  <!-- ── Detail sections ── -->
  <div class="issues-section">
    <h2 class="section-title">🔍 Detailed Results</h2>
    ${sectionCards}
  </div>

</main>

<footer class="footer">
  Generated by <strong>aviary</strong> &mdash; ${escapeHtml(formatTimestamp(report.timestamp))}
</footer>

</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate an HTML report from an SEOReport and write it to `outputPath`.
 */
export function generateHtmlReport(
  report: SEOReport,
  outputPath: string,
  comparison?: SEOReportComparison
): void {
  writeReportFile(outputPath, generateHtml(report, comparison));
}

/**
 * Return the HTML report as a string without writing to disk.
 */
export function renderHtmlReport(report: SEOReport, comparison?: SEOReportComparison): string {
  return generateHtml(report, comparison);
}

export interface PdfReportOptions {
  format?: 'A4' | 'Letter';
  landscape?: boolean;
}

async function renderHtmlToPdf(html: string, options: PdfReportOptions = {}): Promise<Uint8Array> {
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Executable doesn't exist") || message.includes('playwright install')) {
      throw new Error(
        'PDF export needs Playwright Chromium. Install it with `npx playwright install chromium`.'
      );
    }
    throw error;
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    return await page.pdf({
      format: options.format ?? 'A4',
      landscape: options.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
  } finally {
    await browser.close();
  }
}

/** Render the existing single-page HTML report to PDF using headless Playwright Chromium. */
export async function renderPdfReport(
  report: SEOReport,
  options: PdfReportOptions = {},
  comparison?: SEOReportComparison
): Promise<Uint8Array> {
  return renderHtmlToPdf(generateHtml(report, comparison), options);
}

/** Generate a PDF from a standalone HTML report and write it to `outputPath`. */
export async function generatePdfFromHtml(
  html: string,
  outputPath: string,
  options: PdfReportOptions = {}
): Promise<void> {
  writeReportFile(outputPath, await renderHtmlToPdf(html, options));
}

/** Generate a PDF report and write it to `outputPath`. */
export async function generatePdfReport(
  report: SEOReport,
  outputPath: string,
  options: PdfReportOptions = {},
  comparison?: SEOReportComparison
): Promise<void> {
  writeReportFile(outputPath, await renderPdfReport(report, options, comparison));
}

/**
 * Render an SEO report in the JUnit XML format consumed by CI test dashboards.
 * Each SEO check is represented as one testcase; failed checks become failures.
 */
export function renderJunitReport(report: SEOReport): string {
  let tests = 0;
  let failures = 0;
  const sections = sectionsFor(report);
  const suites = sections
    .map(({ key, label }) => {
      const checks = report.checks[key] ?? [];
      const failedChecks = checks.filter((check) => !check.passed);
      tests += checks.length;
      const suiteFailures = failedChecks.length;
      failures += suiteFailures;
      const cases = checks
        .map((check) => {
          const name = check.name || check.message;
          const failure = check.passed
            ? ''
            : `\n    <failure message="${escapeXml(check.message)}" type="${escapeXml(check.severity ?? 'failure')}">${escapeXml(JSON.stringify(check.details ?? {}, null, 2))}</failure>`;
          return `\n  <testcase classname="${escapeXml(label)}" name="${escapeXml(name)}" time="0">${failure}\n  </testcase>`;
        })
        .join('');

      return `\n<testsuite name="${escapeXml(label)}" tests="${checks.length}" failures="${suiteFailures}" errors="0" skipped="0" time="0">${cases}\n</testsuite>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="Aviary SEO audit: ${escapeXml(report.url)}" tests="${tests}" failures="${failures}" errors="0" skipped="0" time="0">${suites}\n</testsuites>\n`;
}

/** Generate a JUnit XML report and write it to `outputPath`. */
export function generateJunitReport(report: SEOReport, outputPath: string): void {
  writeReportFile(outputPath, renderJunitReport(report));
}

type SarifLevel = 'error' | 'warning' | 'note';

interface SarifLocation {
  physicalLocation: { artifactLocation: { uri: string } };
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: SarifLevel };
  properties: { tags: string[]; category: string };
  help?: { text?: string; markdown?: string };
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  kind: 'fail' | 'informational';
  message: { text: string };
  locations: SarifLocation[];
  relatedLocations?: Array<{
    id: number;
    message: { text: string };
    physicalLocation: SarifLocation['physicalLocation'];
  }>;
  properties?: Record<string, unknown>;
}

function sarifLevel(severity?: string): SarifLevel {
  if (severity === 'error') return 'error';
  if (severity === 'info') return 'note';
  return 'warning';
}

function sarifArtifactUri(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('SARIF page locations must use HTTP or HTTPS URLs.');
  }
  return url.href;
}

function sarifLog(results: SarifResult[], rules: Map<string, SarifRule>): string {
  return `${JSON.stringify(
    {
      version: '2.1.0',
      $schema:
        'https://docs.oasis-open.org/sarif/sarif/v2.1.0/cos02/schemas/sarif-schema-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'Aviary',
              informationUri: 'https://github.com/Ru1vly/Aviary',
              rules: [...rules.values()],
            },
          },
          results,
        },
      ],
    },
    null,
    2
  )}\n`;
}

function appendSarifResult(
  results: SarifResult[],
  rules: Map<string, SarifRule>,
  finding: {
    ruleId: string;
    name: string;
    category: string;
    message: string;
    severity?: string;
    kind?: SarifResult['kind'];
    url: string;
    relatedUrls?: string[];
    help?: string;
    helpMarkdown?: string;
    properties?: Record<string, unknown>;
  }
): void {
  const level = sarifLevel(finding.severity);
  if (!rules.has(finding.ruleId)) {
    rules.set(finding.ruleId, {
      id: finding.ruleId,
      name: finding.name,
      shortDescription: { text: finding.name },
      fullDescription: { text: `Aviary ${finding.category} finding.` },
      defaultConfiguration: { level },
      properties: { tags: ['seo', finding.category], category: finding.category },
      ...(finding.help || finding.helpMarkdown
        ? {
            help: {
              ...(finding.help ? { text: finding.help } : {}),
              ...(finding.helpMarkdown ? { markdown: finding.helpMarkdown } : {}),
            },
          }
        : {}),
    });
  } else if (finding.helpMarkdown) {
    const existingRule = rules.get(finding.ruleId)!;
    if (!existingRule.help?.markdown) {
      existingRule.help = { ...existingRule.help, markdown: finding.helpMarkdown };
    }
  }
  const locations = [
    { physicalLocation: { artifactLocation: { uri: sarifArtifactUri(finding.url) } } },
  ];
  const relatedLocations = [...new Set(finding.relatedUrls ?? [])]
    .filter((url) => url !== finding.url)
    .map((url, index) => ({
      id: index + 1,
      message: { text: 'Related audited page.' },
      physicalLocation: { artifactLocation: { uri: sarifArtifactUri(url) } },
    }));
  results.push({
    ruleId: finding.ruleId,
    level,
    kind: finding.kind ?? 'fail',
    message: { text: finding.message },
    locations,
    ...(relatedLocations.length > 0 ? { relatedLocations } : {}),
    ...(finding.properties ? { properties: finding.properties } : {}),
  });
}

function addReportSarifResults(
  report: SEOReport,
  results: SarifResult[],
  rules: Map<string, SarifRule>
): void {
  const recommendations = recommendationQueues(report);
  for (const { key, label } of sectionsFor(report)) {
    (report.checks[key] ?? []).forEach((check, index) => {
      if (check.passed) return;
      const name = check.name?.trim() || `${key}-check-${index + 1}`;
      const recommendation = takeRecommendation(
        recommendations,
        key,
        check.name ?? label,
        check.message,
        check.severity
      );
      appendSarifResult(results, rules, {
        ruleId: `${key}/${name}`,
        name,
        category: key,
        message: check.message,
        severity: check.severity,
        url: report.url,
        help: recommendation?.action,
        helpMarkdown: recommendation?.example
          ? `${recommendation.action}\n\n\`\`\`${recommendation.example.language}\n${recommendation.example.code}\n\`\`\``
          : undefined,
        properties: {
          categoryLabel: label,
          ...(recommendation
            ? {
                priority: recommendation.priority,
                ...(recommendation.scoreLift !== null
                  ? { estimatedScoreLift: recommendation.scoreLift }
                  : {}),
                ...(recommendation.quickWin ? { quickWin: true } : {}),
              }
            : {}),
        },
      });
    });
  }
}

/** Render failed page checks as a SARIF 2.1.0 log for compatible consumers. */
export function renderSarifReport(report: SEOReport): string {
  const results: SarifResult[] = [];
  const rules = new Map<string, SarifRule>();
  addReportSarifResults(report, results, rules);
  return sarifLog(results, rules);
}

/** Write a single-page SARIF report to `outputPath`. */
export function generateSarifReport(report: SEOReport, outputPath: string): void {
  writeReportFile(outputPath, renderSarifReport(report));
}

/** Render page and site-wide batch findings as a SARIF 2.1.0 log. */
export function renderBatchSarifReport(batch: SEOAuditBatchReport): string {
  const results: SarifResult[] = [];
  const rules = new Map<string, SarifRule>();

  for (const result of batch.results) {
    if (result.status === 'complete') {
      addReportSarifResults(result.report, results, rules);
    } else {
      appendSarifResult(results, rules, {
        ruleId: 'audit/audit-failed',
        name: 'audit-failed',
        category: 'audit',
        message: result.error,
        severity: 'error',
        url: result.url,
      });
    }
  }

  const metadata = analyzeSiteWideMetadata(batch);
  for (const group of metadata.duplicateTitles) {
    appendSarifResult(results, rules, {
      ruleId: 'sitewide/duplicate-title',
      name: 'duplicate-title',
      category: 'sitewide-metadata',
      message: `The same page title is used on ${group.urls.length} audited pages.`,
      url: group.urls[0],
      relatedUrls: group.urls.slice(1),
    });
  }
  for (const group of metadata.duplicateDescriptions) {
    appendSarifResult(results, rules, {
      ruleId: 'sitewide/duplicate-description',
      name: 'duplicate-description',
      category: 'sitewide-metadata',
      message: `The same meta description is used on ${group.urls.length} audited pages.`,
      url: group.urls[0],
      relatedUrls: group.urls.slice(1),
    });
  }

  const content = analyzeSiteWideContent(batch);
  for (const group of content.duplicateContent) {
    appendSarifResult(results, rules, {
      ruleId: 'sitewide/duplicate-content',
      name: 'duplicate-content',
      category: 'sitewide-content',
      message: `Exact main content (${group.wordCount} words) is shared by ${group.urls.length} audited pages.`,
      url: group.urls[0],
      relatedUrls: group.urls.slice(1),
    });
  }

  const hreflang = analyzeSiteWideHreflang(batch);
  for (const finding of hreflang.missingReciprocals) {
    appendSarifResult(results, rules, {
      ruleId: 'sitewide/missing-hreflang-return-link',
      name: 'missing-hreflang-return-link',
      category: 'sitewide-internationalization',
      message: `The ${finding.targetUrl} alternate (${finding.language}) does not link back to ${finding.sourceUrl}.`,
      url: finding.targetUrl,
      relatedUrls: [finding.sourceUrl],
    });
  }

  const canonicals = analyzeSiteWideCanonicals(batch);
  for (const chain of canonicals.canonicalChains) {
    appendSarifResult(results, rules, {
      ruleId: 'sitewide/canonical-chain',
      name: 'canonical-chain',
      category: 'sitewide-canonicals',
      message: `The canonical for this page points to ${chain.canonicalTargetUrl}, which canonicalizes to ${chain.finalCanonicalUrl}.`,
      url: chain.sourceUrl,
      relatedUrls: [chain.canonicalTargetUrl, chain.finalCanonicalUrl],
    });
  }
  for (const group of canonicals.duplicateCanonicalTargets) {
    appendSarifResult(results, rules, {
      ruleId: 'sitewide/shared-canonical-target',
      name: 'shared-canonical-target',
      category: 'sitewide-canonicals',
      message: `${group.urls.length} audited pages share a canonical target; confirm that this is intentional.`,
      severity: 'info',
      kind: 'informational',
      url: group.urls[0],
      relatedUrls: group.urls.slice(1),
      help: 'Shared canonical targets can be appropriate for duplicate or alternate pages; review the affected pages.',
      properties: { affectedPages: group.urls.length },
    });
  }
  for (const loop of canonicals.canonicalLoops) {
    appendSarifResult(results, rules, {
      ruleId: 'sitewide/canonical-loop',
      name: 'canonical-loop',
      category: 'sitewide-canonicals',
      message: `Canonical URLs form a loop across ${loop.length} audited pages.`,
      severity: 'error',
      url: loop[0],
      relatedUrls: loop.slice(1),
    });
  }

  return sarifLog(results, rules);
}

/** Write a batch SARIF report to `outputPath`. */
export function generateBatchSarifReport(batch: SEOAuditBatchReport, outputPath: string): void {
  writeReportFile(outputPath, renderBatchSarifReport(batch));
}

/** Render a compact Markdown summary suitable for CI artifacts and pull requests. */
export function renderMarkdownReport(report: SEOReport, comparison?: SEOReportComparison): string {
  const score = report.score === null ? 'N/A' : `${report.score}/100`;
  const lines = [
    `# Aviary SEO report: ${escapeMarkdownCell(report.url)}`,
    '',
    `- **Score:** ${score}`,
    '- **Score note:** This is an Aviary check score over the checks shown; it is not a search-ranking or GEO-readiness prediction.',
    `- **Generated:** ${escapeMarkdownCell(report.timestamp)}`,
    `- **Capture:** ${escapeMarkdownCell(captureTimingForReport(report))}`,
    `- **Categories:** ${report.categories ? report.categories.map(escapeMarkdownCell).join(', ') || 'None' : 'All'}`,
    `- **Checks:** ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.total} total`,
    '',
    '## Category summary',
    '',
    '| Category | Passed | Failed |',
    '| --- | ---: | ---: |',
    ...sectionsFor(report).map(({ key, label }) => {
      const checks = report.checks[key] ?? [];
      const failed = checks.filter((check) => !check.passed).length;
      return `| ${escapeMarkdownCell(label)} | ${checks.length - failed} | ${failed} |`;
    }),
  ];

  if (comparison) {
    const scoreDelta =
      comparison.scoreDelta === null
        ? 'N/A'
        : `${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta}`;
    lines.push(
      '',
      '## Baseline comparison',
      '',
      `- **Baseline:** ${escapeMarkdownCell(comparison.baselineUrl)} (${escapeMarkdownCell(comparison.baselineTimestamp)})`,
      `- **Score:** ${comparison.baselineScore ?? 'N/A'} → ${comparison.currentScore ?? 'N/A'} (${scoreDelta})`,
      `- **New failed checks:** ${comparison.newFailures.length}`,
      `- **Resolved failed checks:** ${comparison.resolvedFailures.length}`,
      `- **GEO signal changes:** ${comparison.geoChanges.length}`,
      `- **Crawler access/preview controls comparable:** ${comparison.geoCompared ? 'yes' : 'no'}`,
      '',
      '### New failures',
      ''
    );
    if (comparison.newFailures.length === 0) {
      lines.push('No newly failing checks.');
    } else {
      lines.push('| Category | Check | Severity | Finding |', '| --- | --- | --- | --- |');
      for (const failure of comparison.newFailures) {
        const label =
          SECTIONS.find((section) => section.key === failure.category)?.label ?? failure.category;
        lines.push(
          `| ${escapeMarkdownCell(label)} | ${escapeMarkdownCell(failure.name)} | ${escapeMarkdownCell(failure.severity ?? 'failure')} | ${escapeMarkdownCell(failure.message)} |`
        );
      }
    }
    lines.push('', '### GEO signal changes', '');
    if (comparison.geoChanges.length === 0) {
      lines.push(
        comparison.geoCompared
          ? 'No GEO signal changes were detected; crawler-access and preview-control inputs were comparable.'
          : 'No observed GEO signal changes were recorded; crawler-access and preview-control inputs were not fully comparable.'
      );
    } else {
      lines.push('| Signal | Before | After |', '| --- | --- | --- |');
      for (const change of comparison.geoChanges) {
        lines.push(
          `| ${escapeMarkdownCell(change.signal)} | ${escapeMarkdownCell(change.before)} | ${escapeMarkdownCell(change.after)} |`
        );
      }
      lines.push(
        '',
        'These are differences between saved audit snapshots; they do not predict AI citations.'
      );
    }
  }

  const failedChecks = sectionsFor(report).flatMap(({ key, label }) =>
    (report.checks[key] ?? []).filter((check) => !check.passed).map((check) => ({ label, check }))
  );

  lines.push('', '## Failed checks', '');
  if (report.summary.total === 0) {
    lines.push('No checks ran.');
  } else if (!failedChecks.length) {
    lines.push('All checks passed.');
  } else {
    lines.push('| Category | Check | Severity | Finding |', '| --- | --- | --- | --- |');
    for (const { label, check } of failedChecks) {
      lines.push(
        `| ${escapeMarkdownCell(label)} | ${escapeMarkdownCell(check.name ?? 'SEO check')} | ${escapeMarkdownCell(check.severity ?? 'failure')} | ${escapeMarkdownCell(check.message)} |`
      );
    }
  }

  const recommendations = generateSEORecommendations(report);
  if (recommendations.length > 0) {
    lines.push('', '## Recommended next steps', '');
    for (const recommendation of recommendations.slice(0, 20)) {
      const quickWin = recommendation.quickWin ? ' · Quick win' : '';
      const scoreLift =
        recommendation.scoreLift === null
          ? ''
          : ` · estimated +${recommendation.scoreLift} Aviary score points if this single finding passes`;
      lines.push(
        `- **${escapeMarkdownCell(recommendation.priority.toUpperCase())}${quickWin} — ${escapeMarkdownCell(recommendation.categoryLabel)} / ${escapeMarkdownCell(recommendation.checkName)}.**${scoreLift} ${escapeMarkdownCell(recommendation.finding)} Next: ${escapeMarkdownCell(recommendation.action)}`
      );
      if (recommendation.example) {
        lines.push(
          `  \`\`\`${recommendation.example.language}`,
          ...recommendation.example.code.split('\n').map((line) => `  ${line}`),
          '  ```'
        );
      }
    }
    if (recommendations.length > 20) {
      lines.push(
        '',
        `Showing the 20 highest-priority recommendations of ${recommendations.length}.`
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

/** Render a structural comparison of one target page against equivalent competitor page audits. */
export function renderSEOCompetitorMarkdownReport(
  target: SEOReport,
  competitors: SEOReport[]
): string {
  const comparison = compareSEOWithCompetitors(target, competitors);
  const scoreGap =
    comparison.scoreGap === null
      ? 'N/A'
      : `${comparison.scoreGap > 0 ? '+' : ''}${comparison.scoreGap}`;
  const targetScore = comparison.targetScore === null ? 'N/A' : `${comparison.targetScore}/100`;
  const competitorScore =
    comparison.competitorAverageScore === null ? 'N/A' : `${comparison.competitorAverageScore}/100`;
  const lines = [
    `# Aviary competitor audit comparison: ${escapeMarkdownCell(comparison.targetUrl)}`,
    '',
    `- **Target score:** ${targetScore}`,
    `- **Competitor average score:** ${competitorScore} (${scoreGap} target-minus-average points)`,
    `- **Competitor reports:** ${comparison.competitors.length}`,
    '',
    '| Page | Aviary score |',
    '| --- | ---: |',
    `| ${escapeMarkdownCell(comparison.targetUrl)} | ${comparison.targetScore ?? 'N/A'} |`,
    ...comparison.competitors.map(
      (competitor) => `| ${escapeMarkdownCell(competitor.url)} | ${competitor.score ?? 'N/A'} |`
    ),
    '',
    'These are structural check comparisons between the supplied reports. Score gaps are from Aviary’s audit formula and do not predict search rankings.',
  ];

  const appendFindings = (
    heading: string,
    findings: SEOCompetitorComparison['targetOnlyFindings'],
    emptyMessage: string,
    countLabel: string
  ) => {
    lines.push('', `## ${heading}`, '');
    if (findings.length === 0) {
      lines.push(emptyMessage);
      return;
    }
    lines.push(
      `| Category | Check | Severity | Finding | ${countLabel} |`,
      '| --- | --- | --- | --- | ---: |'
    );
    for (const finding of findings) {
      const label =
        SECTIONS.find((section) => section.key === finding.category)?.label ?? finding.category;
      lines.push(
        `| ${escapeMarkdownCell(label)} | ${escapeMarkdownCell(finding.name)} | ${escapeMarkdownCell(finding.severity ?? 'failure')} | ${escapeMarkdownCell(finding.message)} | ${finding.competitorCount}/${finding.totalCompetitors} |`
      );
    }
  };

  appendFindings(
    'Target failures not also seen in competitor reports',
    comparison.targetOnlyFindings,
    'No target-only failed checks across these reports.',
    'Competitor reports without this failure'
  );
  appendFindings(
    'Competitor failures not seen on the target',
    comparison.competitorOnlyFindings,
    'No competitor-only failed checks across these reports.',
    'Competitor reports with this failure'
  );
  return `${lines.join('\n')}\n`;
}

/** Generate a Markdown competitor audit comparison and write it to `outputPath`. */
export function generateSEOCompetitorMarkdownReport(
  target: SEOReport,
  competitors: SEOReport[],
  outputPath: string
): void {
  writeReportFile(outputPath, renderSEOCompetitorMarkdownReport(target, competitors));
}

/** Generate a Markdown report and write it to `outputPath`. */
export function generateMarkdownReport(
  report: SEOReport,
  outputPath: string,
  comparison?: SEOReportComparison
): void {
  writeReportFile(outputPath, renderMarkdownReport(report, comparison));
}

/** Render one CSV row per check; formula-like text is prefixed to stay inert in spreadsheets. */
export function renderCsvReport(report: SEOReport): string {
  const rows: unknown[][] = [
    [
      'category',
      'check',
      'passed',
      'severity',
      'message',
      'details',
      'recommendation',
      'priority',
      'estimated_score_lift',
      'quick_win',
      'code_example',
    ],
  ];
  const recommendations = recommendationQueues(report);

  for (const { key, label } of sectionsFor(report)) {
    for (const check of report.checks[key] ?? []) {
      const recommendation = check.passed
        ? undefined
        : takeRecommendation(
            recommendations,
            key,
            check.name ?? label,
            check.message,
            check.severity
          );
      rows.push([
        label,
        check.name ?? '',
        check.passed,
        check.severity ?? '',
        check.message,
        check.details ? JSON.stringify(check.details) : '',
        recommendation?.action ?? '',
        recommendation?.priority ?? '',
        recommendation?.scoreLift ?? '',
        recommendation?.quickWin ?? '',
        recommendation?.example?.code ?? '',
      ]);
    }
  }

  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

/** Generate a CSV report and write it to `outputPath`. */
export function generateCsvReport(report: SEOReport, outputPath: string): void {
  writeReportFile(outputPath, renderCsvReport(report));
}

function renderDuplicateMetadataGroups(
  label: string,
  groups: ReturnType<typeof analyzeSiteWideMetadata>['duplicateTitles']
): string {
  if (groups.length === 0)
    return `<div><h3>${label}</h3><p class="muted">No duplicate values found.</p></div>`;
  const items = groups
    .slice(0, 50)
    .map((group) => {
      const value = group.value.length > 240 ? `${group.value.slice(0, 237)}…` : group.value;
      const urls = group.urls
        .slice(0, 8)
        .map((url) => `<li>${renderReportUrl(url)}</li>`)
        .join('');
      const overflow =
        group.urls.length > 8
          ? `<li class="muted">And ${group.urls.length - 8} more page(s)</li>`
          : '';
      return `<li><strong>${escapeHtml(value)}</strong><span class="muted">Appears on ${group.urls.length} pages</span><ul>${urls}${overflow}</ul></li>`;
    })
    .join('');
  const overflow =
    groups.length > 50
      ? `<p class="muted">Showing 50 of ${groups.length} duplicate groups.</p>`
      : '';
  return `<div><h3>${label} (${groups.length})</h3><details><summary>Show repeated values</summary><ul>${items}</ul>${overflow}</details></div>`;
}

function renderDuplicateContentGroups(
  groups: ReturnType<typeof analyzeSiteWideContent>['duplicateContent']
): string {
  if (groups.length === 0) return '<p class="muted">No exact duplicate content found.</p>';
  const items = groups
    .slice(0, 50)
    .map((group) => {
      const urls = group.urls
        .slice(0, 8)
        .map((url) => `<li>${renderReportUrl(url)}</li>`)
        .join('');
      const overflow =
        group.urls.length > 8
          ? `<li class="muted">And ${group.urls.length - 8} more page(s)</li>`
          : '';
      return `<li><strong>${group.wordCount} words · ${group.normalizedCharacters} normalized characters</strong><span class="muted">Repeated on ${group.urls.length} pages</span><ul>${urls}${overflow}</ul></li>`;
    })
    .join('');
  const overflow =
    groups.length > 50
      ? `<p class="muted">Showing 50 of ${groups.length} duplicate groups.</p>`
      : '';
  return `<ul>${items}</ul>${overflow}`;
}

function renderHreflangAnalysis(analysis: ReturnType<typeof analyzeSiteWideHreflang>): string {
  if (analysis.pagesWithData === 0) return '';
  const findings =
    analysis.missingReciprocals.length > 0
      ? `<div class="table-scroll"><table><thead><tr><th>Source page</th><th>Language</th><th>Declared alternate</th></tr></thead><tbody>${analysis.missingReciprocals
          .slice(0, 100)
          .map(
            (finding) =>
              `<tr><td>${renderReportUrl(finding.sourceUrl)}</td><td>${escapeHtml(finding.language)}</td><td>${renderReportUrl(finding.targetUrl)}</td></tr>`
          )
          .join(
            ''
          )}</tbody></table></div>${analysis.missingReciprocals.length > 100 ? `<p class="muted">Showing 100 of ${analysis.missingReciprocals.length} missing return links.</p>` : ''}`
      : '<p>No missing return links were found among the scanned alternate pages.</p>';
  const limitations = [
    analysis.pagesSkipped > 0 ? `${analysis.pagesSkipped} page(s) had no hreflang result data` : '',
    analysis.unscannedTargetUrls.length > 0
      ? `${analysis.unscannedTargetUrls.length} alternate target(s) were outside this batch`
      : '',
    analysis.unavailableTargetUrls.length > 0
      ? `${analysis.unavailableTargetUrls.length} scanned target(s) had no hreflang result data`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
  const unscannedTargets =
    analysis.unscannedTargetUrls.length > 0
      ? `<details><summary>Show ${analysis.unscannedTargetUrls.length} unverified target URL(s) outside this batch</summary><ul>${analysis.unscannedTargetUrls
          .slice(0, 50)
          .map((url) => `<li>${renderReportUrl(url)}</li>`)
          .join(
            ''
          )}</ul>${analysis.unscannedTargetUrls.length > 50 ? `<p class="muted">Showing 50 of ${analysis.unscannedTargetUrls.length} target URLs.</p>` : ''}</details>`
      : '';
  return `<section class="panel" style="margin:18px 0"><h2>Hreflang return links</h2><p class="muted">Checked ${analysis.alternateLinksAnalyzed} alternate link(s) from ${analysis.pagesWithData} page(s) with hreflang result data. Reciprocity can only be checked when both pages are in the batch.${limitations ? ` ${limitations}.` : ''}</p>${findings}${unscannedTargets}</section>`;
}

function renderCanonicalAnalysis(analysis: ReturnType<typeof analyzeSiteWideCanonicals>): string {
  if (analysis.pagesWithData === 0) return '';
  const findingRows = [
    ...analysis.canonicalChains.map(
      (chain) =>
        `<tr><td>${renderReportUrl(chain.sourceUrl)}</td><td>${renderReportUrl(chain.canonicalTargetUrl)}</td><td>${renderReportUrl(chain.finalCanonicalUrl)}</td></tr>`
    ),
    ...analysis.canonicalLoops.map(
      (loop) =>
        `<tr><td colspan="3">Canonical loop: ${loop
          .slice(0, 20)
          .map((url) => renderReportUrl(url))
          .join(
            ' &rarr; '
          )}${loop.length > 20 ? ` &rarr; and ${loop.length - 20} more page(s)` : ''}</td></tr>`
    ),
    ...analysis.multipleCanonicalUrls.map(
      (url) =>
        `<tr><td>${renderReportUrl(url)}</td><td colspan="2">Multiple canonical declarations</td></tr>`
    ),
    ...analysis.invalidCanonicalUrls.map(
      (url) =>
        `<tr><td>${renderReportUrl(url)}</td><td colspan="2">Canonical URL is not a valid HTTP(S) target</td></tr>`
    ),
  ];
  const findings = findingRows.slice(0, 100).join('');
  const findingOverflow =
    findingRows.length > 100
      ? `<p class="muted">Showing 100 of ${findingRows.length} canonical findings.</p>`
      : '';
  const findingsHtml = findings
    ? `<div class="table-scroll"><table><thead><tr><th>Source page</th><th>Declared canonical</th><th>Issue or next canonical target</th></tr></thead><tbody>${findings}</tbody></table></div>${findingOverflow}`
    : '<p>No canonical chains, loops, or invalid declarations were found among scanned pages.</p>';
  const duplicateTargets =
    analysis.duplicateCanonicalTargets.length > 0
      ? `<details><summary>${analysis.duplicateCanonicalTargets.length} shared canonical target group(s)</summary><ul>${analysis.duplicateCanonicalTargets
          .slice(0, 50)
          .map(
            (group) =>
              `<li>${renderReportUrl(group.value)} — ${group.urls.length} page(s)<ul>${group.urls
                .slice(0, 8)
                .map((url) => `<li>${renderReportUrl(url)}</li>`)
                .join(
                  ''
                )}${group.urls.length > 8 ? `<li class="muted">And ${group.urls.length - 8} more page(s)</li>` : ''}</ul></li>`
          )
          .join(
            ''
          )}</ul>${analysis.duplicateCanonicalTargets.length > 50 ? `<p class="muted">Showing 50 of ${analysis.duplicateCanonicalTargets.length} groups.</p>` : ''}</details>`
      : '';
  const unverifiedTargets =
    analysis.canonicalTargetsOutsideBatch.length > 0
      ? `<details><summary>Show ${analysis.canonicalTargetsOutsideBatch.length} canonical target(s) outside this batch</summary><ul>${analysis.canonicalTargetsOutsideBatch
          .slice(0, 50)
          .map((url) => `<li>${renderReportUrl(url)}</li>`)
          .join(
            ''
          )}</ul>${analysis.canonicalTargetsOutsideBatch.length > 50 ? `<p class="muted">Showing 50 of ${analysis.canonicalTargetsOutsideBatch.length} targets.</p>` : ''}</details>`
      : '';
  const unavailableTargets =
    analysis.canonicalTargetsUnavailable.length > 0
      ? `<details><summary>Show ${analysis.canonicalTargetsUnavailable.length} target(s) without canonical result data</summary><ul>${analysis.canonicalTargetsUnavailable
          .slice(0, 50)
          .map((url) => `<li>${renderReportUrl(url)}</li>`)
          .join(
            ''
          )}</ul>${analysis.canonicalTargetsUnavailable.length > 50 ? `<p class="muted">Showing 50 of ${analysis.canonicalTargetsUnavailable.length} targets.</p>` : ''}</details>`
      : '';
  const limitations = [
    analysis.pagesSkipped > 0
      ? `${analysis.pagesSkipped} page(s) had no canonical result data`
      : '',
    analysis.canonicalTargetsOutsideBatch.length > 0
      ? `${analysis.canonicalTargetsOutsideBatch.length} targets were outside this batch`
      : '',
    analysis.canonicalTargetsUnavailable.length > 0
      ? `${analysis.canonicalTargetsUnavailable.length} targets had no canonical result data`
      : '',
    analysis.pagesMissingCanonical > 0
      ? `${analysis.pagesMissingCanonical} scanned page(s) had no canonical URL`
      : '',
    analysis.pagesWithMultipleCanonicals > 0
      ? `${analysis.pagesWithMultipleCanonicals} page(s) declared multiple canonical URLs`
      : '',
    analysis.pagesWithInvalidCanonical > 0
      ? `${analysis.pagesWithInvalidCanonical} canonical URL(s) were not HTTP(S)`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
  return `<section class="panel" style="margin:18px 0"><h2>Canonical URL consistency</h2><p class="muted">Checked ${analysis.pagesWithCanonical} canonical URL(s) across ${analysis.pagesWithData} page(s) with result data.${limitations ? ` ${limitations}.` : ''} Targets outside the batch cannot be checked for chains.</p>${findingsHtml}${duplicateTargets}${unverifiedTargets}${unavailableTargets}</section>`;
}

/** Render a self-contained, searchable dashboard for a multi-page audit. */
export function renderBatchHtmlReport(
  batch: SEOAuditBatchReport,
  comparison?: SEOAuditBatchComparison
): string {
  const score = batch.summary.averageScore;
  const color = score === null ? '#94a3b8' : scoreColor(score);
  const grade = score === null ? 'N/A' : scoreGrade(score);
  const footerTimestamp = formatTimestamp(batch.timestamp);
  const delta = comparison?.scoreDelta;
  const deltaLabel =
    delta === undefined || delta === null ? 'N/A' : `${delta > 0 ? '+' : ''}${delta}`;

  const rows = batch.results
    .map((result) => {
      if (result.status === 'error') {
        const searchText = `${result.url} ${result.error}`.toLowerCase();
        return `<tr class="page-row row-error" data-url="${escapeHtml(result.url)}" data-search="${escapeHtml(searchText)}" data-status="error" data-score="-1" data-failed="0" data-regression="false">
        <td class="url-cell">${renderReportUrl(result.url)}<span class="muted">Audit error</span></td>
        <td><span class="status status-error">Error</span></td><td class="number">N/A</td><td class="number">—</td><td class="number">—</td>
        <td><details><summary>View error</summary><p class="finding-message">${escapeHtml(result.error)}</p></details></td>
      </tr>`;
      }

      const failed = sectionsFor(result.report).flatMap(({ key, label }) =>
        (result.report.checks[key] ?? [])
          .filter((check) => !check.passed)
          .map((check) => ({ check, label }))
      );
      const status = failed.length > 0 ? 'findings' : 'healthy';
      const regressionCount =
        comparison?.newFailures.filter((finding) => finding.url === result.url).length ?? 0;
      const scoreValue = result.report.score;
      const scoreText = scoreValue === null ? 'N/A' : String(scoreValue);
      const rowColor = scoreValue === null ? '#94a3b8' : scoreColor(scoreValue);
      const recommendations = generateSEORecommendations(result.report).slice(0, 2);
      const shownFindings = failed
        .slice(0, 8)
        .map(
          ({ check, label }) => `
      <li class="finding-item">
        <span class="finding-category">${escapeHtml(label)}</span>
        ${severityBadge(check.severity)}
        <span class="finding-message">${escapeHtml(check.name ? `${check.name}: ` : '')}${escapeHtml(check.message)}</span>
      </li>`
        )
        .join('');
      const overflow =
        failed.length > 8
          ? `<p class="muted">Showing 8 of ${failed.length} failed checks. Use the Markdown or CSV report for the complete list.</p>`
          : '';
      const recommendationHtml =
        recommendations.length > 0
          ? `<div class="recommendations"><strong>Suggested next steps</strong><ul>${recommendations
              .map(
                (item) =>
                  `<li><span class="priority priority-${item.priority}">${escapeHtml(item.priority)}</span> ${escapeHtml(item.action)}</li>`
              )
              .join('')}</ul></div>`
          : '';
      const details =
        failed.length > 0
          ? `<details><summary>View ${failed.length} finding${failed.length === 1 ? '' : 's'}${recommendations.length ? ' and recommendations' : ''}</summary><ul class="findings">${shownFindings}</ul>${overflow}${recommendationHtml}</details>`
          : result.report.summary.total === 0
            ? '<span class="muted">No checks ran</span>'
            : '<span class="muted">No failed checks</span>';
      const searchText =
        `${result.url} ${failed.map(({ check, label }) => `${label} ${check.name ?? ''} ${check.message}`).join(' ')}`.toLowerCase();

      return `<tr class="page-row" data-url="${escapeHtml(result.url)}" data-search="${escapeHtml(searchText)}" data-status="${status}" data-score="${scoreValue ?? -1}" data-failed="${failed.length}" data-regression="${regressionCount > 0}">
      <td class="url-cell">${renderReportUrl(result.url)}<span class="muted">${escapeHtml(result.report.timestamp)}</span></td>
      <td><span class="status ${regressionCount > 0 ? 'status-regression' : `status-${status}`}">${regressionCount > 0 ? `Regression · ${regressionCount}` : status === 'findings' ? 'Findings' : 'Healthy'}</span></td>
      <td class="number score" style="--score-color:${rowColor}">${scoreText}</td>
      <td class="number">${result.report.summary.passed}</td><td class="number">${failed.length}</td><td class="detail-cell">${details}</td>
    </tr>`;
    })
    .join('\n');

  const comparisonHtml = comparison
    ? `<section class="comparison"><div><span class="eyebrow">Baseline comparison</span><strong>${escapeHtml(comparison.baselineTimestamp)}</strong></div>
      <div><span class="eyebrow">Average score</span><strong>${comparison.baselineAverageScore ?? 'N/A'} → ${comparison.currentAverageScore ?? 'N/A'} <span class="${delta !== null && delta !== undefined && delta < 0 ? 'negative' : 'positive'}">(${deltaLabel})</span></strong></div>
      <div><span class="eyebrow">URL changes</span><strong>${comparison.newUrls.length} added · ${comparison.removedUrls.length} removed</strong></div>
      <div><span class="eyebrow">Finding &amp; GEO changes</span><strong>${comparison.newFailures.length} new · ${comparison.resolvedFailures.length} resolved checks</strong><span class="muted">${comparison.geoChanges.length} observed GEO changes · crawler/preview controls comparable on ${comparison.geoComparedPages} of ${comparison.geoComparedPages + comparison.geoUnassessedPages} matched pages</span></div></section>
      <section class="comparison-detail"><details><summary>Show baseline change details</summary><div class="diff-grid">
      <div><h3>New failing checks (${comparison.newFailures.length})</h3>${
        comparison.newFailures.length
          ? `<ul>${comparison.newFailures
              .slice(0, 50)
              .map(
                (finding) =>
                  `<li><strong>${escapeHtml(finding.url)}</strong><span>${escapeHtml(finding.category)} · ${escapeHtml(finding.name)} · ${escapeHtml(finding.message)}</span></li>`
              )
              .join(
                ''
              )}</ul>${comparison.newFailures.length > 50 ? '<p class="muted">Showing the first 50 changes.</p>' : ''}`
          : '<p class="muted">No new failing checks.</p>'
      }</div>
      <div><h3>Resolved checks (${comparison.resolvedFailures.length})</h3>${
        comparison.resolvedFailures.length
          ? `<ul>${comparison.resolvedFailures
              .slice(0, 50)
              .map(
                (finding) =>
                  `<li><strong>${escapeHtml(finding.url)}</strong><span>${escapeHtml(finding.category)} · ${escapeHtml(finding.name)} · ${escapeHtml(finding.message)}</span></li>`
              )
              .join(
                ''
              )}</ul>${comparison.resolvedFailures.length > 50 ? '<p class="muted">Showing the first 50 changes.</p>' : ''}`
          : '<p class="muted">No resolved checks.</p>'
      }</div>
      <div><h3>Added URLs (${comparison.newUrls.length})</h3>${
        comparison.newUrls.length
          ? `<ul>${comparison.newUrls
              .slice(0, 50)
              .map((url) => `<li>${escapeHtml(url)}</li>`)
              .join(
                ''
              )}</ul>${comparison.newUrls.length > 50 ? '<p class="muted">Showing the first 50 added URLs.</p>' : ''}`
          : '<p class="muted">No URLs added.</p>'
      }</div>
      <div><h3>Removed URLs (${comparison.removedUrls.length})</h3>${
        comparison.removedUrls.length
          ? `<ul>${comparison.removedUrls
              .slice(0, 50)
              .map((url) => `<li>${escapeHtml(url)}</li>`)
              .join(
                ''
              )}</ul>${comparison.removedUrls.length > 50 ? '<p class="muted">Showing the first 50 removed URLs.</p>' : ''}`
          : '<p class="muted">No URLs removed.</p>'
      }</div>
      <div><h3>GEO signal changes (${comparison.geoChanges.length})</h3>${
        comparison.geoChanges.length
          ? `<ul>${comparison.geoChanges
              .slice(0, 100)
              .map(
                (change) =>
                  `<li><strong>${escapeHtml(change.url)}</strong><span>${escapeHtml(change.signal)}: ${escapeHtml(change.before)} → ${escapeHtml(change.after)}</span></li>`
              )
              .join(
                ''
              )}</ul>${comparison.geoChanges.length > 100 ? '<p class="muted">Showing the first 100 GEO changes.</p>' : ''}<p class="muted">These are differences between saved snapshots; they do not predict AI citations.</p>`
          : `<p class="muted">${comparison.geoComparedPages + comparison.geoUnassessedPages === 0 ? 'No matched page pairs were available for GEO comparison.' : `No observed GEO signal changes were recorded. Crawler/preview controls were comparable on ${comparison.geoComparedPages} of ${comparison.geoComparedPages + comparison.geoUnassessedPages} matched pages.`}</p>`
      }</div>
      </div></details></section>`
    : '';
  const metadata = analyzeSiteWideMetadata(batch);
  const metadataHtml =
    metadata.pagesAnalyzed > 0
      ? `<section class="panel" style="margin:18px 0"><h2>Cross-page metadata</h2><p class="muted">Compared ${metadata.titlesAnalyzed} page titles and ${metadata.descriptionsAnalyzed} meta descriptions across ${metadata.pagesAnalyzed} unique completed pages. Text is normalized for case, whitespace, and Unicode before matching.</p><div class="diff-grid">${renderDuplicateMetadataGroups('Duplicate titles', metadata.duplicateTitles)}${renderDuplicateMetadataGroups('Duplicate descriptions', metadata.duplicateDescriptions)}</div></section>`
      : '';
  const content = analyzeSiteWideContent(batch);
  const contentHtml =
    content.pagesWithFingerprint > 0
      ? `<section class="panel" style="margin:18px 0"><h2>Duplicate on-page content</h2><p class="muted">Compared normalized extracted page text on ${content.pagesWithFingerprint} of ${content.pagesAnalyzed} unique completed pages. Exact matches require at least 50 words; content above 256,000 characters is skipped.</p>${renderDuplicateContentGroups(content.duplicateContent)}</section>`
      : '';
  const linkGraph = analyzeSiteWideLinkGraph(batch);
  const linkGraphHtml =
    linkGraph.pagesWithGraphData > 0
      ? `<section class="panel" style="margin:18px 0"><h2>Scanned-page link graph</h2><p class="muted">Found ${linkGraph.linksAnalyzed} links between ${linkGraph.pagesAnalyzed} scanned pages. Link data is available for ${linkGraph.pagesWithGraphData} pages${linkGraph.pagesSkipped > 0 ? `; ${linkGraph.pagesSkipped} pages have no graph data` : ''}.${linkGraph.truncatedPages.length > 0 ? ` Target collection reached its per-page limit on ${linkGraph.truncatedPages.length} page(s), so inbound counts may be incomplete.` : ''}</p><div class="diff-grid"><div><h3>Most linked pages</h3>${
          linkGraph.mostLinkedPages.length > 0
            ? `<ol>${linkGraph.mostLinkedPages
                .slice(0, 10)
                .map(
                  (page) =>
                    `<li>${renderReportUrl(page.url)}<span class="muted">${page.inboundLinks} inbound · ${page.outboundLinks} outbound</span></li>`
                )
                .join('')}</ol>`
            : '<p class="muted">No links between scanned pages were found.</p>'
        }</div><div><h3>No observed inbound links (${linkGraph.pagesWithNoInboundLinks.length})</h3>${
          linkGraph.pagesWithNoInboundLinks.length > 0
            ? `<ul>${linkGraph.pagesWithNoInboundLinks
                .slice(0, 20)
                .map((url) => `<li>${renderReportUrl(url)}</li>`)
                .join(
                  ''
                )}</ul>${linkGraph.pagesWithNoInboundLinks.length > 20 ? `<p class="muted">And ${linkGraph.pagesWithNoInboundLinks.length - 20} more page(s).</p>` : ''}`
            : '<p class="muted">Every scanned page has an inbound link from the scanned set.</p>'
        }</div><div><h3>No observed outbound links (${linkGraph.pagesWithNoOutboundLinks.length})</h3>${
          linkGraph.pagesWithNoOutboundLinks.length > 0
            ? `<ul>${linkGraph.pagesWithNoOutboundLinks
                .slice(0, 20)
                .map((url) => `<li>${renderReportUrl(url)}</li>`)
                .join(
                  ''
                )}</ul>${linkGraph.pagesWithNoOutboundLinks.length > 20 ? `<p class="muted">And ${linkGraph.pagesWithNoOutboundLinks.length - 20} more page(s).</p>` : ''}`
            : '<p class="muted">Every scanned page links to at least one other scanned page.</p>'
        }</div></div></section>`
      : '';
  const hreflangHtml = renderHreflangAnalysis(analyzeSiteWideHreflang(batch));
  const canonicalHtml = renderCanonicalAnalysis(analyzeSiteWideCanonicals(batch));
  const geo = analyzeSiteWideGeo(batch);
  const geoCoverageList = (
    items: ReturnType<typeof analyzeSiteWideGeo>['searchCrawlerCoverage'],
    title: string
  ): string =>
    `<div><h3>${escapeHtml(title)}</h3>${
      items.length > 0
        ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.token)}</strong><span>${item.allowedPages} allowed · ${item.blockedPages} blocked · ${item.unassessedPages} unassessed</span>${item.blockedUrls.length > 0 ? `<span>Blocked URLs: ${item.blockedUrls.slice(0, 5).map(escapeHtml).join(', ')}${item.blockedUrls.length > 5 ? ` and ${item.blockedUrls.length - 5} more` : ''}</span>` : ''}</li>`).join('')}</ul>`
        : '<p class="muted">No result data.</p>'
    }</div>`;
  const geoContent = geo.contentProfile;
  const geoStatusLabel = (status: 'measured' | 'not-assessed' | 'not-run'): string =>
    status === 'measured' ? 'Measured' : status === 'not-assessed' ? 'Not assessed' : 'Not run';
  const geoTokenList = (tokens: string[]): string =>
    `${tokens.slice(0, 5).join(', ')}${tokens.length > 5 ? ` and ${tokens.length - 5} more` : ''}`;
  const geoPageRows = geo.pageSummaries
    .slice(0, 100)
    .map((page) => {
      const searchAccess =
        page.signalCoverage.searchCrawlerAccess === 'measured'
          ? (() => {
              const crawlers = page.searchCrawlerAccess ?? [];
              const blocked = crawlers
                .filter(({ allowed }) => !allowed)
                .map(({ token, matchedRule }) =>
                  matchedRule
                    ? `${token} (${matchedRule.directive} ${matchedRule.pattern}, line ${matchedRule.line})`
                    : token
                );
              return blocked.length > 0
                ? `${blocked.length} blocked by robots.txt: ${geoTokenList(blocked)}`
                : `${crawlers.length} checked; none blocked by robots.txt`;
            })()
          : geoStatusLabel(page.signalCoverage.searchCrawlerAccess);
      const dataUsePolicy =
        page.signalCoverage.dataUseCrawlerPolicy === 'measured'
          ? (() => {
              const crawlers = page.dataUseCrawlerPolicy ?? [];
              const allowed = crawlers.filter(({ allowed }) => allowed).map(({ token }) => token);
              const blocked = crawlers.filter(({ allowed }) => !allowed).map(({ token }) => token);
              return `${allowed.length} allowed (${allowed.length ? geoTokenList(allowed) : 'none'}) · ${blocked.length} blocked (${blocked.length ? geoTokenList(blocked) : 'none'}) by robots.txt`;
            })()
          : geoStatusLabel(page.signalCoverage.dataUseCrawlerPolicy);
      const userFetchAccess =
        page.signalCoverage.userInitiatedFetchAccess === 'measured'
          ? (() => {
              const crawlers = page.userInitiatedFetchAccess ?? [];
              const allowed = crawlers.filter(({ allowed }) => allowed).map(({ token }) => token);
              const blocked = crawlers.filter(({ allowed }) => !allowed).map(({ token }) => token);
              return `${allowed.length} allowed (${allowed.length ? geoTokenList(allowed) : 'none'}) · ${blocked.length} blocked (${blocked.length ? geoTokenList(blocked) : 'none'}) by robots.txt`;
            })()
          : page.signalCoverage.userInitiatedFetchAccess
            ? geoStatusLabel(page.signalCoverage.userInitiatedFetchAccess)
            : 'Not run';
      const preview = page.previewControls;
      const crawlerRestrictions = (preview?.crawlerControls ?? [])
        .flatMap((control) => [
          ...(control.noindex ? [`noindex: ${control.token}`] : []),
          ...(control.noSnippet ? [`no-snippet: ${control.token}`] : []),
          ...(control.maxSnippetZero ? [`max-snippet:0: ${control.token}`] : []),
        ])
        .concat(
          (preview?.dataUseCrawlerControls ?? []).flatMap((control) => [
            ...(control.noindex ? [`data-use noindex: ${control.token}`] : []),
            ...(control.noArchive ? [`noarchive: ${control.token}`] : []),
          ])
        );
      const previewSummary =
        page.signalCoverage.previewControls === 'measured' && preview
          ? `${[preview.noindex ? 'noindex' : '', preview.noSnippet ? 'no snippet' : '', preview.maxSnippetZero ? 'max-snippet:0' : ''].filter(Boolean).join(', ') || 'no page-wide restriction'}; data-nosnippet ${preview.dataNoSnippetElements ?? 0} element(s), ${preview.dataNoSnippetWords ?? 0} word(s)${preview.dataNoSnippetWordSharePercent === null || preview.dataNoSnippetWordSharePercent === undefined ? '' : ` (${preview.dataNoSnippetWordSharePercent}% of visible text)`}${crawlerRestrictions.length > 0 ? `; crawler-specific ${geoTokenList(crawlerRestrictions)}` : ''}`
          : geoStatusLabel(page.signalCoverage.previewControls);
      const answer = page.answerContent;
      const identityEntities = answer?.identityEntities ?? [];
      const identityInventory =
        identityEntities.length > 0 || answer?.identityEntityListTruncated
          ? `<details><summary>Structured identities (${identityEntities.length}${answer?.identityEntityListTruncated ? '+' : ''})</summary><ul>${identityEntities.map((entity) => `<li><strong>${escapeHtml(entity.name ?? entity.id ?? 'Unnamed entity')}</strong><span>${escapeHtml(entity.types.join(', ') || 'Type unavailable')}${entity.id ? ` · ${escapeHtml(entity.id)}` : ''}</span>${entity.sameAs.length > 0 ? `<span>sameAs: ${entity.sameAs.map(renderReportUrl).join(', ')}${entity.sameAsTruncated ? ' and more' : ''}</span>` : ''}</li>`).join('')}${answer?.identityEntityListTruncated ? '<li class="muted">The page inventory is capped at 20 entities.</li>' : ''}</ul></details>`
          : '';
      const answerSummary =
        page.signalCoverage.answerContent === 'measured' && answer
          ? `${answer.contentWords ?? 'N/A'} visible word(s); ${answer.mainOrArticleRegion ? 'main/article region' : 'no main/article region'}; ${answer.questionHeadings ?? 0} question heading(s), ${answer.conciseAnswerBlocks ?? 0} concise-answer pattern(s); author ${answer.visibleAuthor ? 'visible' : 'not found'}, date ${answer.visibleDate ? 'visible' : 'not found'}${answer.schemaIsAccessibleForFree === undefined ? '' : `; JSON-LD isAccessibleForFree ${answer.schemaIsAccessibleForFree}`}${answer.schemaHasNonBooleanAccessibleForFreeValue ? '; non-boolean isAccessibleForFree value observed' : ''}${answer.jsonLdTypeListTruncated ? '; JSON-LD type list capped at 20' : ''}${answer.identityEntityListTruncated ? '; entity inventory capped at 20' : ''}`
          : geoStatusLabel(page.signalCoverage.answerContent);
      const rendered = page.sourceRenderedContent;
      const renderedSummary =
        page.signalCoverage.sourceRenderedContent === 'measured' && rendered
          ? `${rendered.renderedPhraseCoveragePercent === null || rendered.renderedPhraseCoveragePercent === undefined ? 'too little text for phrase sample' : `${rendered.renderedPhraseCoveragePercent}% rendered phrase overlap`}${rendered.sampleTruncated ? '; sample capped' : ''}`
          : geoStatusLabel(page.signalCoverage.sourceRenderedContent);
      const evidence = page.citationEvidence;
      const evidenceSummary =
        page.signalCoverage.citationEvidence === 'measured' && evidence
          ? `${evidence.externalSourceLinkCount ?? 0} external link(s), ${evidence.uniqueSourceHosts ?? 0} host(s), ${evidence.referenceSectionLinkCount ?? 0} reference-section link(s), ${evidence.inlineCitationMarkerCount ?? 0} marker(s), ${evidence.resolvedInlineCitationTargetsWithExternalLinks ?? 0} resolved target(s) with an external link, ${evidence.resolvedInlineCitationTargetsWithoutExternalLinks ?? 0} resolved target(s) without an external link, ${evidence.unresolvedInlineCitationTargetCount ?? 0} unresolved target(s)`
          : geoStatusLabel(page.signalCoverage.citationEvidence);
      const unresolvedCitationTargets = evidence?.unresolvedInlineCitationTargets ?? [];
      const citationTargetDetails =
        unresolvedCitationTargets.length > 0
          ? `<details><summary>Unresolved citation targets</summary><ul>${unresolvedCitationTargets.map((target) => `<li>${escapeHtml(target)}</li>`).join('')}${evidence?.unresolvedInlineCitationTargetsTruncated ? '<li class="muted">Samples are capped at 10 entries and 200 characters each.</li>' : ''}</ul></details>`
          : '';
      const sourceHostRows = evidence?.sourceHostLinkCounts ?? [];
      const sourceHostDetails =
        sourceHostRows.length > 0
          ? `<details><summary>External source links by host</summary><ul>${sourceHostRows.map(({ host, links }) => `<li>${escapeHtml(host)} · ${links} link(s)</li>`).join('')}${evidence?.sourceHostLinkCountsTruncated ? '<li class="muted">Host counts are capped at 12 domains.</li>' : ''}${evidence?.topSourceHostLinkSharePercent === undefined ? '' : `<li class="muted">Largest host share: ${evidence.topSourceHostLinkSharePercent === null ? 'unavailable' : `${evidence.topSourceHostLinkSharePercent}%`} of observed external links.</li>`}</ul></details>`
          : '';
      const fileSummary =
        page.signalCoverage.optionalLlmsFiles === 'measured' && page.optionalLlmsFiles
          ? page.optionalLlmsFiles
              .map(
                ({ path: filePath, state, contentTruncated, linkTargetProfile }) =>
                  filePath +
                  ': ' +
                  state +
                  (linkTargetProfile
                    ? ' (' +
                      linkTargetProfile.markdownLinks +
                      ' Markdown links, ' +
                      linkTargetProfile.uniqueWebTargets +
                      ' unique web targets, ' +
                      linkTargetProfile.duplicateWebTargets +
                      ' repeated, ' +
                      linkTargetProfile.sameOriginWebLinks +
                      ' same-origin, ' +
                      linkTargetProfile.externalHttpsLinks +
                      ' external HTTPS, ' +
                      linkTargetProfile.externalHttpLinks +
                      ' external HTTP, ' +
                      linkTargetProfile.relativeLinks +
                      ' relative, ' +
                      linkTargetProfile.unsupportedSchemeLinks +
                      ' unsupported-scheme, ' +
                      linkTargetProfile.invalidTargets +
                      ' invalid, ' +
                      linkTargetProfile.emptyLabels +
                      ' empty-label, ' +
                      linkTargetProfile.malformedLinkCandidates +
                      ' malformed)'
                    : '') +
                  (contentTruncated ? ' (profile limited to the first 64 KiB)' : '')
              )
              .join('; ')
          : geoStatusLabel(page.signalCoverage.optionalLlmsFiles);
      const measuredSignals = Object.values(page.signalCoverage).filter(
        (status) => status === 'measured'
      ).length;
      const notAssessedSignals = Object.values(page.signalCoverage).filter(
        (status) => status === 'not-assessed'
      ).length;
      const notRunSignals = Object.values(page.signalCoverage).filter(
        (status) => status === 'not-run'
      ).length;
      const notes = Object.entries(page.signalNotes ?? {})
        .map(
          ([signal, note]) => `<li><strong>${escapeHtml(signal)}</strong>: ${escapeHtml(note)}</li>`
        )
        .join('');
      return `<tr><td class="url-cell">${renderReportUrl(page.url)}</td><td>${escapeHtml(searchAccess)}</td><td>${escapeHtml(dataUsePolicy)}</td><td>${escapeHtml(userFetchAccess)}</td><td>${escapeHtml(previewSummary)}</td><td>${escapeHtml(answerSummary)}${identityInventory}</td><td>${escapeHtml(renderedSummary)}</td><td>${escapeHtml(evidenceSummary)}${citationTargetDetails}${sourceHostDetails}</td><td>${escapeHtml(fileSummary)}</td><td>${measuredSignals} measured · ${notAssessedSignals} not assessed · ${notRunSignals} not run${notes ? `<details><summary>Assessment notes</summary><ul>${notes}</ul></details>` : ''}</td></tr>`;
    })
    .join('');
  const geoPageMatrixHtml =
    geo.pageSummaries.length > 0
      ? `<details><summary>Page-level GEO signal matrix (${geo.pageSummaries.length} pages)</summary><p class="muted">Crawler permissions reflect robots.txt only. User-triggered fetch access is measured only for providers that document robots controls. These browser-snapshot signals do not predict citations or rankings.</p><div class="table-scroll"><table><thead><tr><th>Page</th><th>Search crawlers</th><th>Data-use policy</th><th>User-triggered fetches</th><th>Preview controls</th><th>Content profile</th><th>Source/rendered</th><th>Citation evidence</th><th>Optional files</th><th>Signal coverage</th></tr></thead><tbody>${geoPageRows}</tbody></table></div>${geo.pageSummaries.length > 100 ? `<p class="muted">Showing 100 of ${geo.pageSummaries.length} pages.</p>` : ''}</details>`
      : '';
  const geoHtml =
    geo.pagesWithGeoData > 0
      ? `<section class="panel" style="margin:18px 0"><h2>AI Discoverability (GEO)</h2><p class="muted">GEO results are available for ${geo.pagesWithGeoData} of ${geo.pagesAnalyzed} unique completed pages. Counts describe current robots and page signals; they do not predict AI citations.</p><div class="diff-grid">${geoCoverageList(geo.searchCrawlerCoverage, 'Search crawler access')}${geoCoverageList(geo.dataUseCrawlerPolicy, 'Model data-use controls')}${geoCoverageList(geo.userInitiatedFetchPolicy ?? [], 'Robots-controlled user fetches')}</div><p>${geo.pagesWithNoindex} page(s) with noindex · ${geo.pagesWithNoSnippet} with no-snippet controls · ${geo.pagesWithDataNoSnippetRegions} with visible data-nosnippet regions (${geo.totalDataNoSnippetWords} words; mean ${geo.dataNoSnippetWordShareMeanPercent === null ? 'unavailable' : `${geo.dataNoSnippetWordShareMeanPercent}% of visible words`}) · ${geo.pagesWithExternalSources} with external source links · ${geo.pagesWithCitationMarkersOrReferences} with citation markers/references · ${geo.totalResolvedInlineCitationTargetsWithExternalLinks} resolved targets with external links and ${geo.totalResolvedInlineCitationTargetsWithoutExternalLinks} without · ${geo.pagesWithUnresolvedInlineCitationTargets} page(s) with unresolved in-page citation targets (${geo.totalUnresolvedInlineCitationTargets} link(s))</p><p class="muted">Answer-content profile (${geoContent.pagesAssessed} pages assessed): ${geoContent.pagesWithMainOrArticleRegion} main/article regions · ${geoContent.pagesWithQuestionHeadings} pages with question headings · ${geoContent.totalQuestionHeadings} question headings and ${geoContent.totalConciseAnswerBlocks} concise answer blocks · ${geoContent.pagesWithVisibleAuthor} visible authors · ${geoContent.pagesWithVisibleDate} visible dates · ${geoContent.pagesWithSchemaAuthor} schema authors · ${geoContent.pagesWithSchemaDate} schema dates · isAccessibleForFree ${geoContent.pagesWithFreeAccessSchemaDeclaration} true / ${geoContent.pagesWithPaywalledSchemaDeclaration} false / ${geoContent.pagesWithConflictingFreeAccessSchemaDeclarations} conflicting / ${geoContent.pagesWithoutFreeAccessSchemaDeclaration} without boolean / ${geoContent.pagesWithNonBooleanFreeAccessSchemaValue} non-boolean.</p><p class="muted">Visible/schema presence cross-tabs: author both ${geoContent.authorSignalCrossTab.visibleAndSchema}, visible only ${geoContent.authorSignalCrossTab.visibleOnly}, schema only ${geoContent.authorSignalCrossTab.schemaOnly}, neither ${geoContent.authorSignalCrossTab.neither} (${geoContent.authorSignalCrossTab.sampledPages} complete, ${geoContent.authorSignalCrossTab.incompleteProfiles} incomplete); date both ${geoContent.dateSignalCrossTab.visibleAndSchema}, visible only ${geoContent.dateSignalCrossTab.visibleOnly}, schema only ${geoContent.dateSignalCrossTab.schemaOnly}, neither ${geoContent.dateSignalCrossTab.neither} (${geoContent.dateSignalCrossTab.sampledPages} complete, ${geoContent.dateSignalCrossTab.incompleteProfiles} incomplete). Presence is compared only; names and date values are not matched.</p><p class="muted">Source/rendered text comparison: ${geoContent.sourceRenderedProfilesAssessed} page(s) assessed; mean ${geoContent.sourceRenderedPhraseCoverageMeanPercent === null ? 'unavailable' : `${geoContent.sourceRenderedPhraseCoverageMeanPercent}%`} overlap across ${geoContent.sourceRenderedPhraseCoverageSamples} pages with enough rendered text to sample; bands ${geoContent.sourceRenderedPhraseCoverageBands.map(({ band, pages }) => `${band} ${pages}`).join(', ')}; ${geoContent.sourceRenderedPhraseCoverageWithoutUsableSample} without a usable sample. This is a browser snapshot, not a crawler-specific rendering result.</p><p class="muted">Observed schema types: ${
          geoContent.schemaTypeCoverage
            .slice(0, 10)
            .map(({ type, pages }) => `${escapeHtml(type)} (${pages} page(s))`)
            .join(', ') || 'none'
        }${geoContent.pagesWithTruncatedJsonLdTypeLists > 0 ? `; per-page type lists capped at 20 on ${geoContent.pagesWithTruncatedJsonLdTypeLists} page(s)` : ''}.</p><p class="muted">Observed external source domains and bounded link counts: ${
          geo.sourceHostCoverage
            .slice(0, 10)
            .map(
              ({ host, pagesLinked, observedLinks }) =>
                `${escapeHtml(host)} (${pagesLinked} page(s)${observedLinks === undefined ? '' : `, ${observedLinks} retained links`})`
            )
            .join(', ') || 'none'
        }${geo.pagesWithTruncatedSourceHostLists > 0 ? `; host lists were capped at 12 on ${geo.pagesWithTruncatedSourceHostLists} page(s)` : ''}${geo.pagesWithTruncatedSourceHostLinkCounts > 0 ? `; per-page link counts were capped at 12 domains on ${geo.pagesWithTruncatedSourceHostLinkCounts} page(s)` : ''}. Host counts are descriptive and do not indicate source quality.</p><p class="muted">Optional llms.txt files: ${
          geo.optionalLlmsFiles.map(
            ({
              path: file,
              pagesFound,
              pagesAbsent,
              pagesUnconfirmed,
              pagesUnassessed,
              linkTargetTotals,
            }) =>
              escapeHtml(file) +
              ': ' +
              pagesFound +
              ' found, ' +
              pagesAbsent +
              ' absent, ' +
              pagesUnconfirmed +
              ' unconfirmed, ' +
              pagesUnassessed +
              ' unassessed' +
              (linkTargetTotals && linkTargetTotals.profilesMeasured > 0
                ? '; ' +
                  linkTargetTotals.profilesMeasured +
                  ' link profile(s), ' +
                  linkTargetTotals.markdownLinks +
                  ' Markdown links / ' +
                  linkTargetTotals.uniqueWebTargets +
                  ' unique web targets (' +
                  linkTargetTotals.duplicateWebTargets +
                  ' repeated), ' +
                  linkTargetTotals.sameOriginWebLinks +
                  ' same-origin, ' +
                  linkTargetTotals.externalHttpsLinks +
                  ' external HTTPS, ' +
                  linkTargetTotals.externalHttpLinks +
                  ' external HTTP, ' +
                  linkTargetTotals.relativeLinks +
                  ' relative, ' +
                  linkTargetTotals.unsupportedSchemeLinks +
                  ' unsupported-scheme, ' +
                  linkTargetTotals.invalidTargets +
                  ' invalid, ' +
                  linkTargetTotals.emptyLabels +
                  ' empty-label, ' +
                  linkTargetTotals.malformedLinkCandidates +
                  ' malformed' +
                  (linkTargetTotals.truncatedProfiles > 0
                    ? '; content capped at 64 KiB for ' +
                      linkTargetTotals.truncatedProfiles +
                      ' profile(s)'
                    : '')
                : '; link structure not sampled')
          ) || 'not assessed'
        }. Confirmed missing files are not a search requirement.</p>${geoPageMatrixHtml}</section>`
      : '';
  const renderGeoPageList = (label: string, urls: string[]): string =>
    urls.length > 0
      ? `<details><summary>${escapeHtml(label)} (${urls.length})</summary><ul>${urls
          .slice(0, 50)
          .map((url) => `<li>${renderReportUrl(url)}</li>`)
          .join(
            ''
          )}${urls.length > 50 ? `<li class="muted">And ${urls.length - 50} more page(s).</li>` : ''}</ul></details>`
      : '';
  const geoRestrictedPageHtml =
    geo.pagesWithGeoData > 0
      ? `<section class="panel" style="margin:18px 0"><h2>Search indexing and snippet controls</h2><p class="muted">These page-level directives can be intentional. Review affected URLs and crawler-specific details before changing them.</p>${renderGeoPageList('Pages with noindex', geo.pagesWithNoindexUrls)}${renderGeoPageList('Pages with no-snippet controls', geo.pagesWithNoSnippetUrls)}${renderGeoPageList('Pages with visible data-nosnippet regions', geo.pagesWithDataNoSnippetRegionUrls)}</section>`
      : '';
  const entities = geo.entityAnalysis;
  const geoEntityHtml =
    entities.pagesWithIdentityEntities > 0
      ? `<section class="panel" style="margin:18px 0"><h2>Structured entity identity profile</h2><p class="muted">Found identity entities on ${entities.pagesWithIdentityEntities} page(s), with ${entities.uniqueIdentityIds} distinct @id values and ${entities.identityIdsSharedAcrossPages} shared across pages. ${entities.entitiesWithNameVariants} shared ID(s) have different name values; localized or intentional variants may explain these differences. Identity lists were capped at 20 per page on ${entities.pagesWithTruncatedEntityLists} page(s).</p><p class="muted">${entities.pagesWithSameAsReferences} page(s) expose ${entities.totalSameAsReferences} sameAs profile links across ${entities.sameAsHostCoverage.length} profile hosts. sameAs lists were capped at 10 links per entity on ${entities.pagesWithTruncatedSameAsLists} page(s). Hosts: ${
          entities.sameAsHostCoverage
            .slice(0, 10)
            .map(({ host, pages }) => `${escapeHtml(host)} (${pages} page(s))`)
            .join(', ') || 'none'
        }.</p>${
          entities.nameVariants.length > 0
            ? `<details><summary>Review shared IDs with name variants (${entities.entitiesWithNameVariants})</summary><ul>${entities.nameVariants
                .slice(0, 20)
                .map(
                  (entity) =>
                    `<li><strong>${escapeHtml(entity.id)}</strong><span>${escapeHtml(entity.types.join(', '))} · names: ${entity.names.map(escapeHtml).join(' / ')}</span><span>Pages: ${entity.pages.slice(0, 5).map(escapeHtml).join(', ')}${entity.pages.length > 5 ? ` and ${entity.pages.length - 5} more` : ''}</span></li>`
                )
                .join(
                  ''
                )}</ul>${entities.entitiesWithNameVariants > 20 ? '<p class="muted">Showing the first 20 findings.</p>' : ''}</details>`
            : '<p>No cross-page name variants were found for shared identity IDs.</p>'
        }</section>`
      : '';
  const geoEntityTypeVariantHtml =
    entities.typeVariants.length > 0
      ? `<section class="panel" style="margin:18px 0"><h2>Cross-page entity type differences</h2><p class="muted">${entities.entitiesWithTypeVariants} shared structured identity ID(s) use different normalized @type sets on different pages. This can reflect intentional modeling; review the examples for accidental reuse or inconsistent markup.</p><details><summary>Review type differences (${entities.entitiesWithTypeVariants})</summary><ul>${entities.typeVariants
          .slice(0, 20)
          .map(
            (entity) =>
              `<li><strong>${escapeHtml(entity.id)}</strong>${entity.pages
                .slice(0, 8)
                .map(
                  (page) =>
                    `<span>${renderReportUrl(page.url)} · ${escapeHtml(page.types.join(', ') || 'type unavailable')}</span>`
                )
                .join(
                  ''
                )}${entity.pagesTruncated ? '<span class="muted">Page list capped at 50; showing the first 8 retained pages.</span>' : entity.pages.length > 8 ? `<span class="muted">${entity.pages.length - 8} additional page(s)</span>` : ''}</li>`
          )
          .join(
            ''
          )}</ul>${entities.entitiesWithTypeVariants > 20 ? '<p class="muted">Showing the first 20 findings.</p>' : ''}</details></section>`
      : '';
  const geoEntitySameAsVariantHtml =
    entities.sameAsVariants.length > 0
      ? `<section class="panel" style="margin:18px 0"><h2>Cross-page entity profile link differences</h2><p class="muted">${entities.entitiesWithSameAsVariants} shared structured identity ID(s) have different complete sameAs link sets across pages. These differences can be intentional; this check compares listed links only and does not verify profile ownership or identity.</p><details><summary>Review sameAs differences (${entities.entitiesWithSameAsVariants})</summary><ul>${entities.sameAsVariants
          .slice(0, 20)
          .map(
            (entity) =>
              `<li><strong>${escapeHtml(entity.id)}</strong>${entity.pages
                .slice(0, 8)
                .map(
                  (page) =>
                    `<span>${renderReportUrl(page.url)} · ${page.sameAs.length > 0 ? page.sameAs.map(escapeHtml).join(', ') : 'no sameAs links'}</span>`
                )
                .join(
                  ''
                )}${entity.excludedIncompletePages > 0 ? `<span class="muted">Excluded ${entity.excludedIncompletePages} page profile(s) with capped entity or sameAs lists.</span>` : ''}${entity.pagesTruncated ? '<span class="muted">Page list capped at 50; showing the first 8 retained pages.</span>' : entity.pages.length > 8 ? `<span class="muted">${entity.pages.length - 8} additional page(s)</span>` : ''}</li>`
          )
          .join(
            ''
          )}</ul>${entities.entitiesWithSameAsVariants > 20 ? '<p class="muted">Showing the first 20 findings.</p>' : ''}</details></section>`
      : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aviary multi-page SEO report</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--surface:#121a2b;--surface2:#192338;--border:#293650;--text:#edf2ff;--muted:#99a8c1;--green:#35d39a;--amber:#ffc266;--red:#ff6e7a;--blue:#78a9ff;--purple:#b59bff;font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 12% 0%,#263657 0,transparent 40%),var(--bg);color:var(--text)}.wrap{max-width:1440px;margin:auto;padding:30px 24px 60px}
.hero{display:flex;gap:24px;align-items:center;padding:28px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(130deg,#17233b,#11192b 72%);box-shadow:0 20px 60px #0003}.score-ring{width:112px;height:112px;flex:none;border:5px solid ${color};border-radius:50%;display:grid;place-content:center;text-align:center;color:${color};box-shadow:0 0 30px ${color}30}.score-ring strong{font-size:2rem;line-height:1}.score-ring span{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase}.hero-copy{min-width:0;flex:1}.eyebrow{display:block;color:var(--muted);font-size:.73rem;text-transform:uppercase;letter-spacing:.12em}.hero h1{margin:.2rem 0;font-size:clamp(1.5rem,3vw,2.25rem)}.hero p{margin:.3rem 0;color:var(--muted)}.grade{font-size:3.4rem;font-weight:900;color:${color}}
.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.metric,.comparison,.panel{border:1px solid var(--border);border-radius:14px;background:color-mix(in srgb,var(--surface) 92%,transparent)}.metric{padding:17px}.metric strong{display:block;font-size:1.5rem;margin-top:3px}.comparison{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:16px;margin:18px 0}.comparison strong{display:block;margin-top:4px}.comparison-detail{border:1px solid var(--border);border-radius:12px;padding:13px 16px;margin:0 0 18px;background:var(--surface)}.diff-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.diff-grid h3{font-size:.9rem}.diff-grid ul{padding-left:18px}.diff-grid li{margin:8px 0;font-size:.8rem;overflow-wrap:anywhere}.diff-grid li span{display:block;color:var(--muted)}.negative{color:var(--red)}.positive{color:var(--green)}
.panel{padding:18px;overflow:hidden}.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:15px}.toolbar label{font-size:.82rem;color:var(--muted)}input,select{background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:10px 12px;font:inherit}input{min-width:min(340px,100%);flex:1}select{min-width:145px}#result-count{margin-left:auto;color:var(--muted);font-size:.83rem}
.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;min-width:920px}th{text-align:left;background:var(--surface2);color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;padding:11px 12px;position:sticky;top:0}td{padding:12px;border-top:1px solid var(--border);vertical-align:top}.page-row:hover{background:#ffffff05}.url-cell{max-width:400px;overflow-wrap:anywhere}.url-cell a{color:#c7d6ff;text-decoration:none;font-weight:650}.url-cell a:hover{text-decoration:underline}.muted{display:block;color:var(--muted);font-size:.77rem;margin-top:3px}.number{text-align:center;font-variant-numeric:tabular-nums}.score{font-weight:800;color:var(--score-color)}.status,.priority{display:inline-block;border:1px solid currentColor;border-radius:99px;padding:2px 8px;font-size:.7rem;font-weight:750;text-transform:uppercase;letter-spacing:.04em}.status-healthy{color:var(--green)}.status-findings{color:var(--amber)}.status-error,.status-regression{color:var(--red)}details summary{cursor:pointer;color:#c7d6ff;font-size:.82rem}details[open] summary{margin-bottom:9px}.findings{list-style:none;padding:0;margin:0}.finding-item{display:flex;gap:7px;align-items:flex-start;margin:7px 0}.finding-category{color:var(--muted);font-size:.74rem;white-space:nowrap}.finding-message{font-size:.82rem;overflow-wrap:anywhere}.badge{font-size:.64rem;padding:1px 5px}.badge-error{color:var(--red)}.badge-warning{color:var(--amber)}.badge-info{color:var(--blue)}.recommendations{border-top:1px solid var(--border);margin-top:10px;padding-top:10px;font-size:.82rem}.recommendations ul{padding-left:18px}.recommendations li{margin:6px 0}.priority-high{color:var(--red)}.priority-medium{color:var(--amber)}.priority-low{color:var(--blue)}.empty{padding:28px;text-align:center;color:var(--muted)}footer{text-align:center;color:var(--muted);font-size:.78rem;padding:24px}
@media(max-width:760px){.wrap{padding:16px 12px 36px}.hero{align-items:flex-start;padding:18px}.score-ring{width:84px;height:84px}.score-ring strong{font-size:1.5rem}.grade{font-size:2.4rem}.metrics,.comparison{grid-template-columns:repeat(2,minmax(0,1fr))}.comparison{gap:12px}.diff-grid{grid-template-columns:1fr}}@media(max-width:440px){.hero{gap:13px}.metrics,.comparison{grid-template-columns:1fr 1fr}.metric{padding:12px}.metric strong{font-size:1.2rem}}
@media print{body{background:white;color:#111}.wrap{max-width:none;padding:0}.hero,.metric,.comparison,.panel{background:white;color:#111;box-shadow:none;border-color:#bbb}.toolbar{display:none}table{min-width:0;font-size:9pt}td,th{padding:6px;color:#111}.url-cell a{color:#111}.muted,.eyebrow{color:#555}.status{border-color:#777;color:#111}details{break-inside:avoid}details:not([open])>*:not(summary){display:block}footer{color:#555}}
</style></head><body><main class="wrap">
<section class="hero"><div class="score-ring"><strong>${score === null ? '—' : score}</strong><span>Avg score</span></div><div class="hero-copy"><span class="eyebrow">Aviary · multi-page SEO audit</span><h1>${grade} grade across ${batch.summary.requestedUrls} URLs</h1><p>Generated ${escapeHtml(batch.timestamp)} · ${batch.summary.concurrency ?? 'Worker count unavailable'} browser workers</p><p>${escapeHtml(captureTimingForBatch(batch))}</p><p>Scores summarize checks run; they are not rankings or GEO-readiness predictions.</p></div><div class="grade" aria-label="Grade ${grade}">${grade}</div></section>
<section class="metrics" aria-label="Audit summary"><article class="metric"><span class="eyebrow">Pages audited</span><strong>${batch.summary.completedUrls}<small> / ${batch.summary.requestedUrls}</small></strong></article><article class="metric"><span class="eyebrow">Audit errors</span><strong>${batch.summary.failedUrls}</strong></article><article class="metric"><span class="eyebrow">Checks passed</span><strong>${batch.summary.passedChecks}</strong></article><article class="metric"><span class="eyebrow">Failed findings</span><strong>${batch.summary.failedChecks}</strong></article></section>
${comparisonHtml}
${metadataHtml}
${contentHtml}
${geoHtml}
${geoRestrictedPageHtml}
${geoEntityHtml}
${geoEntityTypeVariantHtml}
${geoEntitySameAsVariantHtml}
${linkGraphHtml}
${hreflangHtml}
${canonicalHtml}
<section class="panel"><div class="toolbar"><label for="page-search">Find page</label><input id="page-search" type="search" placeholder="Search URLs and findings" autocomplete="off"><label for="status-filter">Show</label><select id="status-filter"><option value="all">All pages</option><option value="findings">With findings</option><option value="regressions">Regressions</option><option value="healthy">No failed checks</option><option value="error">Audit errors</option></select><label for="sort-pages">Sort</label><select id="sort-pages"><option value="original">Original order</option><option value="regressions">Regressions first</option><option value="score-desc">Score, high to low</option><option value="score-asc">Score, low to high</option><option value="failures-desc">Most findings</option><option value="url">URL, A to Z</option></select><span id="result-count" aria-live="polite"></span></div>
<div class="table-scroll"><table><thead><tr><th>Page</th><th>Status</th><th>Score</th><th>Passed</th><th>Failed</th><th>Details</th></tr></thead><tbody id="page-rows">${rows || '<tr><td class="empty" colspan="6">No page audits were recorded.</td></tr>'}</tbody></table></div></section>
<footer>Generated by <strong>aviary</strong> · ${escapeHtml(footerTimestamp)}</footer></main>
<script>
(() => { const body = document.querySelector('#page-rows'); const search = document.querySelector('#page-search'); const filter = document.querySelector('#status-filter'); const sort = document.querySelector('#sort-pages'); const count = document.querySelector('#result-count'); if (!body || !search || !filter || !sort || !count) return; const rows = Array.from(body.querySelectorAll('[data-url]')); const original = new Map(rows.map((row, index) => [row, index])); function update() { const query = search.value.trim().toLowerCase(); const selected = filter.value; const visible = rows.filter((row) => { const matchesFilter = selected === 'all' || (selected === 'regressions' ? row.getAttribute('data-regression') === 'true' : row.getAttribute('data-status') === selected); return (!query || (row.getAttribute('data-search') || '').includes(query)) && matchesFilter; }); const mode = sort.value; visible.sort((left, right) => { if (mode === 'regressions') return Number(right.getAttribute('data-regression') === 'true') - Number(left.getAttribute('data-regression') === 'true'); if (mode === 'score-desc') return Number(right.getAttribute('data-score')) - Number(left.getAttribute('data-score')); if (mode === 'score-asc') return Number(left.getAttribute('data-score')) - Number(right.getAttribute('data-score')); if (mode === 'failures-desc') return Number(right.getAttribute('data-failed')) - Number(left.getAttribute('data-failed')); if (mode === 'url') return (left.getAttribute('data-url') || '').localeCompare(right.getAttribute('data-url') || ''); return (original.get(left) || 0) - (original.get(right) || 0); }); for (const row of rows) row.hidden = !visible.includes(row); for (const row of visible) body.append(row); count.textContent = visible.length + ' of ' + rows.length + ' pages'; } search.addEventListener('input', update); filter.addEventListener('change', update); sort.addEventListener('change', update); update(); })();
</script></body></html>`;
}

function renderReportUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return `<span>${escapeHtml(value)}</span>`;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return `<span>${escapeHtml(value)}</span>`;
  return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
}

/** Write a self-contained HTML dashboard for a multi-page audit. */
export function generateBatchHtmlReport(
  batch: SEOAuditBatchReport,
  outputPath: string,
  comparison?: SEOAuditBatchComparison
): void {
  writeReportFile(outputPath, renderBatchHtmlReport(batch, comparison));
}

/** Render the multi-page HTML dashboard to a print-ready PDF. */
export async function renderBatchPdfReport(
  batch: SEOAuditBatchReport,
  options: PdfReportOptions = {},
  comparison?: SEOAuditBatchComparison
): Promise<Uint8Array> {
  return renderHtmlToPdf(renderBatchHtmlReport(batch, comparison), options);
}

/** Generate a multi-page PDF report and write it to `outputPath`. */
export async function generateBatchPdfReport(
  batch: SEOAuditBatchReport,
  outputPath: string,
  options: PdfReportOptions = {},
  comparison?: SEOAuditBatchComparison
): Promise<void> {
  writeReportFile(outputPath, await renderBatchPdfReport(batch, options, comparison));
}

/** Render a summary and per-page findings for a batch of URL audits. */
export function renderBatchMarkdownReport(
  batch: SEOAuditBatchReport,
  comparison?: SEOAuditBatchComparison
): string {
  const lines = [
    '# Aviary multi-page SEO report',
    '',
    `- **Generated:** ${escapeMarkdownCell(batch.timestamp)}`,
    `- **URLs:** ${batch.summary.completedUrls} completed, ${batch.summary.failedUrls} failed, ${batch.summary.requestedUrls} requested`,
    `- **Browser workers:** ${batch.summary.concurrency ?? 'unknown (legacy report)'}`,
    `- **Capture:** ${escapeMarkdownCell(captureTimingForBatch(batch))}`,
    `- **Checks:** ${batch.summary.passedChecks} passed, ${batch.summary.failedChecks} failed`,
    `- **Average score:** ${batch.summary.averageScore === null ? 'N/A' : `${batch.summary.averageScore}/100`}`,
    '- **Score note:** This is an Aviary check score over the checks run; it is not a search-ranking or GEO-readiness prediction.',
    '',
    '## URL summary',
    '',
    '| URL | Status | Score | Passed | Failed |',
    '| --- | --- | ---: | ---: | ---: |',
  ];

  for (const result of batch.results) {
    if (result.status === 'error') {
      lines.push(`| ${escapeMarkdownCell(result.url)} | Error | N/A | 0 | 0 |`);
    } else {
      const { report } = result;
      lines.push(
        `| ${escapeMarkdownCell(result.url)} | Complete | ${report.score === null ? 'N/A' : report.score} | ${report.summary.passed} | ${report.summary.failed} |`
      );
    }
  }

  const geo = analyzeSiteWideGeo(batch);
  if (geo.pagesWithGeoData > 0) {
    lines.push(
      '',
      '## AI Discoverability (GEO)',
      '',
      `GEO results are available for ${geo.pagesWithGeoData} of ${geo.pagesAnalyzed} unique completed pages. These are current robots and page signals; they do not predict AI citations.`,
      '',
      '### Search crawler access',
      ''
    );
    if (geo.searchCrawlerCoverage.length > 0) {
      for (const crawler of geo.searchCrawlerCoverage) {
        lines.push(
          `- **${escapeMarkdownCell(crawler.token)}:** ${crawler.allowedPages} allowed, ${crawler.blockedPages} blocked, ${crawler.unassessedPages} unassessed`
        );
        for (const url of crawler.blockedUrls.slice(0, 10))
          lines.push(`  - Blocked URL: ${escapeMarkdownCell(url)}`);
        if (crawler.blockedUrls.length > 10)
          lines.push(`  - ${crawler.blockedUrls.length - 10} more blocked URL(s)`);
      }
    } else {
      lines.push('Search crawler access was not assessed.');
    }
    lines.push('', '### Model data-use controls', '');
    if (geo.dataUseCrawlerPolicy.length > 0) {
      for (const crawler of geo.dataUseCrawlerPolicy) {
        lines.push(
          `- **${escapeMarkdownCell(crawler.token)}:** ${crawler.allowedPages} allowed, ${crawler.blockedPages} blocked, ${crawler.unassessedPages} unassessed`
        );
      }
    } else {
      lines.push('Model data-use crawler controls were not assessed.');
    }
    lines.push('', '### Robots-controlled user-triggered fetch access', '');
    if ((geo.userInitiatedFetchPolicy ?? []).length > 0) {
      for (const crawler of geo.userInitiatedFetchPolicy ?? []) {
        lines.push(
          `- **${escapeMarkdownCell(crawler.token)}:** ${crawler.allowedPages} allowed, ${crawler.blockedPages} blocked, ${crawler.unassessedPages} unassessed`
        );
      }
    } else {
      lines.push('No documented robots-controlled user-triggered fetch access was assessed.');
    }
    lines.push(
      '',
      `Page signals: ${geo.pagesWithNoindex} noindex, ${geo.pagesWithNoSnippet} no-snippet, ${geo.pagesWithDataNoSnippetRegions} with visible data-nosnippet regions (${geo.totalDataNoSnippetElements} elements, ${geo.totalDataNoSnippetWords} words; mean ${geo.dataNoSnippetWordShareMeanPercent === null ? 'unavailable' : `${geo.dataNoSnippetWordShareMeanPercent}% of visible words`}), ${geo.pagesWithExternalSources} with external source links, ${geo.pagesWithCitationMarkersOrReferences} with citation markers/references, ${geo.totalResolvedInlineCitationTargetsWithExternalLinks} resolved targets with external links and ${geo.totalResolvedInlineCitationTargetsWithoutExternalLinks} without, ${geo.pagesWithUnresolvedInlineCitationTargets} with unresolved in-page citation targets (${geo.totalUnresolvedInlineCitationTargets} links).`,
      `Answer-content profile (${geo.contentProfile.pagesAssessed} pages assessed): ${geo.contentProfile.pagesWithMainOrArticleRegion} main/article regions; ${geo.contentProfile.pagesWithQuestionHeadings} pages with question headings and ${geo.contentProfile.totalConciseAnswerBlocks} concise answer blocks; ${geo.contentProfile.pagesWithVisibleAuthor} visible authors; ${geo.contentProfile.pagesWithVisibleDate} visible dates; ${geo.contentProfile.pagesWithSchemaAuthor} schema authors; ${geo.contentProfile.pagesWithSchemaDate} schema dates; isAccessibleForFree ${geo.contentProfile.pagesWithFreeAccessSchemaDeclaration} true / ${geo.contentProfile.pagesWithPaywalledSchemaDeclaration} false / ${geo.contentProfile.pagesWithConflictingFreeAccessSchemaDeclarations} conflicting / ${geo.contentProfile.pagesWithoutFreeAccessSchemaDeclaration} without boolean / ${geo.contentProfile.pagesWithNonBooleanFreeAccessSchemaValue} non-boolean. These are structural counts, not requirements.`,
      `Visible/schema author and date presence: author both ${geo.contentProfile.authorSignalCrossTab.visibleAndSchema}, visible only ${geo.contentProfile.authorSignalCrossTab.visibleOnly}, schema only ${geo.contentProfile.authorSignalCrossTab.schemaOnly}, neither ${geo.contentProfile.authorSignalCrossTab.neither} (${geo.contentProfile.authorSignalCrossTab.sampledPages} complete, ${geo.contentProfile.authorSignalCrossTab.incompleteProfiles} incomplete); date both ${geo.contentProfile.dateSignalCrossTab.visibleAndSchema}, visible only ${geo.contentProfile.dateSignalCrossTab.visibleOnly}, schema only ${geo.contentProfile.dateSignalCrossTab.schemaOnly}, neither ${geo.contentProfile.dateSignalCrossTab.neither} (${geo.contentProfile.dateSignalCrossTab.sampledPages} complete, ${geo.contentProfile.dateSignalCrossTab.incompleteProfiles} incomplete). This compares presence only, not author names or date values.`,
      `Source/rendered text comparison: ${geo.contentProfile.sourceRenderedProfilesAssessed} page(s) assessed; mean ${geo.contentProfile.sourceRenderedPhraseCoverageMeanPercent === null ? 'unavailable' : `${geo.contentProfile.sourceRenderedPhraseCoverageMeanPercent}%`} overlap across ${geo.contentProfile.sourceRenderedPhraseCoverageSamples} pages with enough rendered text to sample; bands ${geo.contentProfile.sourceRenderedPhraseCoverageBands.map(({ band, pages }) => `${band}: ${pages}`).join(', ')}; ${geo.contentProfile.sourceRenderedPhraseCoverageWithoutUsableSample} without a usable sample. This is a browser snapshot, not a crawler-specific rendering result.`,
      `Observed schema types: ${
        geo.contentProfile.schemaTypeCoverage
          .slice(0, 10)
          .map(({ type, pages }) => `${escapeMarkdownCell(type)} (${pages} page(s))`)
          .join(', ') || 'none'
      }${geo.contentProfile.pagesWithTruncatedJsonLdTypeLists > 0 ? `; per-page type lists capped at 20 on ${geo.contentProfile.pagesWithTruncatedJsonLdTypeLists} page(s)` : ''}.`,
      `Structured entity identity profile: entities on ${geo.entityAnalysis.pagesWithIdentityEntities} pages; ${geo.entityAnalysis.uniqueIdentityIds} distinct IDs, ${geo.entityAnalysis.identityIdsSharedAcrossPages} shared across pages, ${geo.entityAnalysis.entitiesWithNameVariants} shared IDs with name variants, ${geo.entityAnalysis.entitiesWithTypeVariants} shared IDs with cross-page @type differences, and ${geo.entityAnalysis.entitiesWithSameAsVariants} with different complete sameAs link sets. ${geo.entityAnalysis.pagesWithSameAsReferences} pages expose ${geo.entityAnalysis.totalSameAsReferences} sameAs links across ${geo.entityAnalysis.sameAsHostCoverage.length} hosts. Entity lists are capped at 20 per page and sameAs lists at 10 per entity.`,
      `Observed sameAs hosts: ${
        geo.entityAnalysis.sameAsHostCoverage
          .slice(0, 10)
          .map(({ host, pages }) => `${escapeMarkdownCell(host)} (${pages} page(s))`)
          .join(', ') || 'none'
      }.`,
      `Observed source hosts: ${
        geo.sourceHostCoverage
          .slice(0, 10)
          .map(
            ({ host, pagesLinked, observedLinks }) =>
              `${escapeMarkdownCell(host)} (${pagesLinked} page(s)${observedLinks === undefined ? '' : `, ${observedLinks} retained links`})`
          )
          .join(', ') || 'none'
      }${geo.pagesWithTruncatedSourceHostLists > 0 ? `; per-page host lists were capped at 12 on ${geo.pagesWithTruncatedSourceHostLists} page(s)` : ''}${geo.pagesWithTruncatedSourceHostLinkCounts > 0 ? `; per-page link counts were capped at 12 domains on ${geo.pagesWithTruncatedSourceHostLinkCounts} page(s)` : ''}.`,
      `Optional llms.txt files: ${
        geo.optionalLlmsFiles.map(
          ({
            path: file,
            pagesFound,
            pagesAbsent,
            pagesUnconfirmed,
            pagesUnassessed,
            linkTargetTotals,
          }) =>
            escapeMarkdownCell(file) +
            ': ' +
            pagesFound +
            ' found, ' +
            pagesAbsent +
            ' absent, ' +
            pagesUnconfirmed +
            ' unconfirmed, ' +
            pagesUnassessed +
            ' unassessed' +
            (linkTargetTotals && linkTargetTotals.profilesMeasured > 0
              ? '; ' +
                linkTargetTotals.profilesMeasured +
                ' link profile(s), ' +
                linkTargetTotals.markdownLinks +
                ' Markdown links / ' +
                linkTargetTotals.uniqueWebTargets +
                ' unique web targets (' +
                linkTargetTotals.duplicateWebTargets +
                ' repeated), ' +
                linkTargetTotals.sameOriginWebLinks +
                ' same-origin, ' +
                linkTargetTotals.externalHttpsLinks +
                ' external HTTPS, ' +
                linkTargetTotals.externalHttpLinks +
                ' external HTTP, ' +
                linkTargetTotals.relativeLinks +
                ' relative, ' +
                linkTargetTotals.unsupportedSchemeLinks +
                ' unsupported-scheme, ' +
                linkTargetTotals.invalidTargets +
                ' invalid, ' +
                linkTargetTotals.emptyLabels +
                ' empty-label, ' +
                linkTargetTotals.malformedLinkCandidates +
                ' malformed' +
                (linkTargetTotals.truncatedProfiles > 0
                  ? '; content capped at 64 KiB for ' +
                    linkTargetTotals.truncatedProfiles +
                    ' profile(s)'
                  : '')
              : '; link structure not sampled')
        ) || 'not assessed'
      }. Confirmed missing files are not a search requirement.`
    );
    for (const [label, urls] of [
      ['Pages with noindex', geo.pagesWithNoindexUrls],
      ['Pages with no-snippet controls', geo.pagesWithNoSnippetUrls],
      ['Pages with visible data-nosnippet regions', geo.pagesWithDataNoSnippetRegionUrls],
      ['Pages with unresolved in-page citation targets', geo.unresolvedInlineCitationTargetUrls],
    ] as const) {
      if (urls.length === 0) continue;
      lines.push('', `### ${label} (${urls.length})`, '');
      for (const url of urls.slice(0, 100)) lines.push(`- ${escapeMarkdownCell(url)}`);
      if (urls.length > 100) lines.push('', `Showing 100 of ${urls.length} pages.`);
    }
    if (geo.entityAnalysis.nameVariants.length > 0) {
      lines.push(
        '',
        `### Shared structured entity IDs with name variants (${geo.entityAnalysis.entitiesWithNameVariants})`,
        ''
      );
      lines.push('| Entity ID | Types | Names | Pages |', '| --- | --- | --- | --- |');
      for (const entity of geo.entityAnalysis.nameVariants) {
        lines.push(
          `| ${escapeMarkdownCell(entity.id)} | ${escapeMarkdownCell(entity.types.join(', '))} | ${escapeMarkdownCell(entity.names.join(' / '))} | ${entity.pages.slice(0, 5).map(escapeMarkdownCell).join('<br>')}${entity.pages.length > 5 ? `<br>${entity.pages.length - 5} more` : ''} |`
        );
      }
      if (geo.entityAnalysis.entitiesWithNameVariants > geo.entityAnalysis.nameVariants.length) {
        lines.push(
          '',
          `Showing ${geo.entityAnalysis.nameVariants.length} of ${geo.entityAnalysis.entitiesWithNameVariants} findings.`
        );
      }
      lines.push(
        '',
        'Different names can be intentional, including localized names; review the pages before treating this as a data conflict.'
      );
    }
    if (geo.entityAnalysis.typeVariants.length > 0) {
      lines.push(
        '',
        `### Shared structured entity IDs with cross-page type differences (${geo.entityAnalysis.entitiesWithTypeVariants})`,
        ''
      );
      lines.push('| Entity ID | Page | Normalized @type set |', '| --- | --- | --- |');
      for (const entity of geo.entityAnalysis.typeVariants) {
        for (const page of entity.pages.slice(0, 8)) {
          lines.push(
            `| ${escapeMarkdownCell(entity.id)} | ${escapeMarkdownCell(page.url)} | ${escapeMarkdownCell(page.types.join(', ') || 'type unavailable')} |`
          );
        }
        if (entity.pagesTruncated)
          lines.push(
            `| ${escapeMarkdownCell(entity.id)} | Page list capped at 50; showing first 8 retained pages | — |`
          );
        else if (entity.pages.length > 8)
          lines.push(
            `| ${escapeMarkdownCell(entity.id)} | ${entity.pages.length - 8} additional page(s) | — |`
          );
      }
      if (geo.entityAnalysis.entitiesWithTypeVariants > geo.entityAnalysis.typeVariants.length) {
        lines.push(
          '',
          `Showing ${geo.entityAnalysis.typeVariants.length} of ${geo.entityAnalysis.entitiesWithTypeVariants} findings.`
        );
      }
      lines.push(
        '',
        'Type-set differences can be intentional; check the instances before treating them as inconsistent structured data.'
      );
    }
    if (geo.entityAnalysis.sameAsVariants.length > 0) {
      lines.push(
        '',
        `### Shared structured entity IDs with sameAs profile differences (${geo.entityAnalysis.entitiesWithSameAsVariants})`,
        ''
      );
      lines.push('| Entity ID | Page | sameAs profile links |', '| --- | --- | --- |');
      for (const entity of geo.entityAnalysis.sameAsVariants) {
        for (const page of entity.pages.slice(0, 8)) {
          lines.push(
            `| ${escapeMarkdownCell(entity.id)} | ${escapeMarkdownCell(page.url)} | ${escapeMarkdownCell(page.sameAs.join(', ') || 'none')} |`
          );
        }
        if (entity.excludedIncompletePages > 0)
          lines.push(
            `| ${escapeMarkdownCell(entity.id)} | ${entity.excludedIncompletePages} page profile(s) excluded because entity or sameAs lists were capped | — |`
          );
        if (entity.pagesTruncated)
          lines.push(
            `| ${escapeMarkdownCell(entity.id)} | Page list capped at 50; showing first 8 retained pages | — |`
          );
        else if (entity.pages.length > 8)
          lines.push(
            `| ${escapeMarkdownCell(entity.id)} | ${entity.pages.length - 8} additional page(s) | — |`
          );
      }
      if (
        geo.entityAnalysis.entitiesWithSameAsVariants > geo.entityAnalysis.sameAsVariants.length
      ) {
        lines.push(
          '',
          `Showing ${geo.entityAnalysis.sameAsVariants.length} of ${geo.entityAnalysis.entitiesWithSameAsVariants} findings.`
        );
      }
      lines.push(
        '',
        'sameAs link-set differences can be intentional; only complete observed lists are compared, and links are not verified as official profiles.'
      );
    }
  }

  const metadata = analyzeSiteWideMetadata(batch);
  if (metadata.pagesAnalyzed > 0) {
    lines.push(
      '',
      '## Cross-page metadata',
      '',
      `Compared ${metadata.titlesAnalyzed} page titles and ${metadata.descriptionsAnalyzed} meta descriptions across ${metadata.pagesAnalyzed} unique completed pages. Matching ignores case, repeated whitespace, and Unicode compatibility differences.`
    );
    const appendGroups = (
      label: string,
      groups: ReturnType<typeof analyzeSiteWideMetadata>['duplicateTitles']
    ): void => {
      lines.push('', `### ${label}`, '');
      if (groups.length === 0) {
        lines.push('No duplicate values found.');
        return;
      }
      lines.push('| Repeated value | Pages |', '| --- | --- |');
      for (const group of groups.slice(0, 50)) {
        const urls = group.urls
          .slice(0, 8)
          .map((url) => escapeMarkdownCell(url))
          .join('<br>');
        const more = group.urls.length > 8 ? `<br>And ${group.urls.length - 8} more page(s)` : '';
        lines.push(`| ${escapeMarkdownCell(group.value)} | ${urls}${more} |`);
      }
      if (groups.length > 50) lines.push('', `Showing 50 of ${groups.length} duplicate groups.`);
    };
    appendGroups('Duplicate titles', metadata.duplicateTitles);
    appendGroups('Duplicate descriptions', metadata.duplicateDescriptions);
  }

  const content = analyzeSiteWideContent(batch);
  if (content.pagesWithFingerprint > 0) {
    lines.push(
      '',
      '## Duplicate on-page content',
      '',
      `Compared normalized extracted page text on ${content.pagesWithFingerprint} of ${content.pagesAnalyzed} unique completed pages. Exact matches require at least 50 words; content above 256,000 characters is skipped.`,
      '',
      '| Content size | Pages |',
      '| --- | --- |'
    );
    if (content.duplicateContent.length === 0) {
      lines.push('| No exact duplicate content found | — |');
    } else {
      for (const group of content.duplicateContent.slice(0, 50)) {
        const urls = group.urls
          .slice(0, 8)
          .map((url) => escapeMarkdownCell(url))
          .join('<br>');
        const more = group.urls.length > 8 ? `<br>And ${group.urls.length - 8} more page(s)` : '';
        lines.push(
          `| ${group.wordCount} words · ${group.normalizedCharacters} characters | ${urls}${more} |`
        );
      }
      if (content.duplicateContent.length > 50)
        lines.push('', `Showing 50 of ${content.duplicateContent.length} duplicate groups.`);
    }
  }

  const linkGraph = analyzeSiteWideLinkGraph(batch);
  if (linkGraph.pagesWithGraphData > 0) {
    lines.push(
      '',
      '## Scanned-page link graph',
      '',
      `Found ${linkGraph.linksAnalyzed} links between ${linkGraph.pagesAnalyzed} scanned pages. Link data is available for ${linkGraph.pagesWithGraphData} pages; ${linkGraph.pagesSkipped} pages have no graph data.`,
      ...(linkGraph.truncatedPages.length > 0
        ? [
            `Link collection reached its per-page limit on ${linkGraph.truncatedPages.length} page(s), so inbound counts may be incomplete.`,
          ]
        : []),
      '',
      '| Page | Inbound | Outbound |',
      '| --- | ---: | ---: |'
    );
    for (const page of linkGraph.mostLinkedPages) {
      lines.push(
        `| ${escapeMarkdownCell(page.url)} | ${page.inboundLinks} | ${page.outboundLinks} |`
      );
    }
    if (linkGraph.mostLinkedPages.length === 0)
      lines.push('| No links between scanned pages found | 0 | 0 |');
    const appendPageList = (label: string, urls: string[]): void => {
      lines.push('', `### ${label} (${urls.length})`, '');
      if (urls.length === 0) {
        lines.push('None.');
        return;
      }
      for (const url of urls.slice(0, 50)) lines.push(`- ${escapeMarkdownCell(url)}`);
      if (urls.length > 50) lines.push('', `Showing 50 of ${urls.length} pages.`);
    };
    appendPageList(
      'No observed inbound links from scanned pages',
      linkGraph.pagesWithNoInboundLinks
    );
    appendPageList(
      'No observed outbound links to scanned pages',
      linkGraph.pagesWithNoOutboundLinks
    );
  }

  const hreflang = analyzeSiteWideHreflang(batch);
  if (hreflang.pagesWithData > 0) {
    lines.push(
      '',
      '## Hreflang return links',
      '',
      `Checked ${hreflang.alternateLinksAnalyzed} alternate links from ${hreflang.pagesWithData} pages with hreflang result data. Reciprocity can only be checked when both pages are in the batch.`,
      `- Missing return links: ${hreflang.missingReciprocals.length}`,
      `- Alternate targets outside the batch: ${hreflang.unscannedTargetUrls.length}`,
      `- Scanned targets without hreflang result data: ${hreflang.unavailableTargetUrls.length}`,
      `- Pages without hreflang result data: ${hreflang.pagesSkipped}`,
      ''
    );
    if (hreflang.missingReciprocals.length === 0) {
      lines.push('No missing return links were found among the scanned alternate pages.');
    } else {
      lines.push(
        '| Source page | Language | Declared alternate missing a return link |',
        '| --- | --- | --- |'
      );
      for (const finding of hreflang.missingReciprocals.slice(0, 100)) {
        lines.push(
          `| ${escapeMarkdownCell(finding.sourceUrl)} | ${escapeMarkdownCell(finding.language)} | ${escapeMarkdownCell(finding.targetUrl)} |`
        );
      }
      if (hreflang.missingReciprocals.length > 100) {
        lines.push(
          '',
          `Showing 100 of ${hreflang.missingReciprocals.length} missing return links.`
        );
      }
    }
    if (hreflang.unscannedTargetUrls.length > 0) {
      lines.push(
        '',
        `### Unverified targets outside the batch (${hreflang.unscannedTargetUrls.length})`,
        ''
      );
      for (const url of hreflang.unscannedTargetUrls.slice(0, 50))
        lines.push(`- ${escapeMarkdownCell(url)}`);
      if (hreflang.unscannedTargetUrls.length > 50) {
        lines.push('', `Showing 50 of ${hreflang.unscannedTargetUrls.length} target URLs.`);
      }
    }
  }

  const canonicals = analyzeSiteWideCanonicals(batch);
  if (canonicals.pagesWithData > 0) {
    lines.push(
      '',
      '## Canonical URL consistency',
      '',
      `Checked ${canonicals.pagesWithCanonical} canonical URL(s) across ${canonicals.pagesWithData} pages with result data. Shared canonical targets can be intentional for duplicate pages; chains and loops need review.`,
      `- Canonical chains: ${canonicals.canonicalChains.length}`,
      `- Canonical loops: ${canonicals.canonicalLoops.length}`,
      `- Pages missing a canonical URL: ${canonicals.pagesMissingCanonical}`,
      `- Pages with multiple canonical declarations: ${canonicals.pagesWithMultipleCanonicals}`,
      `- Invalid canonical URLs: ${canonicals.pagesWithInvalidCanonical}`,
      `- Targets outside the batch: ${canonicals.canonicalTargetsOutsideBatch.length}`,
      `- Targets without canonical result data: ${canonicals.canonicalTargetsUnavailable.length}`,
      `- Pages without canonical result data: ${canonicals.pagesSkipped}`,
      ''
    );
    if (canonicals.canonicalChains.length > 0) {
      lines.push(
        '| Source page | Declared canonical page | Next canonical target |',
        '| --- | --- | --- |'
      );
      for (const chain of canonicals.canonicalChains.slice(0, 100)) {
        lines.push(
          `| ${escapeMarkdownCell(chain.sourceUrl)} | ${escapeMarkdownCell(chain.canonicalTargetUrl)} | ${escapeMarkdownCell(chain.finalCanonicalUrl)} |`
        );
      }
      if (canonicals.canonicalChains.length > 100)
        lines.push('', `Showing 100 of ${canonicals.canonicalChains.length} canonical chains.`);
    } else if (canonicals.canonicalLoops.length === 0) {
      lines.push('No canonical chains or loops were found among scanned pages.');
    }
    if (canonicals.canonicalLoops.length > 0) {
      lines.push('', '| Canonical loop |', '| --- |');
      for (const loop of canonicals.canonicalLoops.slice(0, 100)) {
        lines.push(`| ${loop.map(escapeMarkdownCell).join(' → ')} |`);
      }
      if (canonicals.canonicalLoops.length > 100)
        lines.push('', `Showing 100 of ${canonicals.canonicalLoops.length} canonical loops.`);
    }
    if (canonicals.multipleCanonicalUrls.length > 0 || canonicals.invalidCanonicalUrls.length > 0) {
      lines.push('', '### Invalid canonical declarations', '', '| Page | Issue |', '| --- | --- |');
      for (const url of canonicals.multipleCanonicalUrls.slice(0, 100))
        lines.push(`| ${escapeMarkdownCell(url)} | Multiple canonical declarations |`);
      for (const url of canonicals.invalidCanonicalUrls.slice(0, 100))
        lines.push(`| ${escapeMarkdownCell(url)} | Canonical URL is not a valid HTTP(S) target |`);
    }
    if (canonicals.duplicateCanonicalTargets.length > 0) {
      lines.push(
        '',
        `### Shared canonical targets (${canonicals.duplicateCanonicalTargets.length})`,
        '',
        '| Target | Pages |',
        '| --- | --- |'
      );
      for (const group of canonicals.duplicateCanonicalTargets.slice(0, 50)) {
        const urls = group.urls.slice(0, 8).map(escapeMarkdownCell).join('<br>');
        const more = group.urls.length > 8 ? `<br>And ${group.urls.length - 8} more page(s)` : '';
        lines.push(`| ${escapeMarkdownCell(group.value)} | ${urls}${more} |`);
      }
      if (canonicals.duplicateCanonicalTargets.length > 50)
        lines.push(
          '',
          `Showing 50 of ${canonicals.duplicateCanonicalTargets.length} shared target groups.`
        );
    }
    if (canonicals.canonicalTargetsOutsideBatch.length > 0) {
      lines.push(
        '',
        `### Targets outside the batch (${canonicals.canonicalTargetsOutsideBatch.length})`,
        ''
      );
      for (const url of canonicals.canonicalTargetsOutsideBatch.slice(0, 50))
        lines.push(`- ${escapeMarkdownCell(url)}`);
      if (canonicals.canonicalTargetsOutsideBatch.length > 50)
        lines.push('', `Showing 50 of ${canonicals.canonicalTargetsOutsideBatch.length} targets.`);
    }
    if (canonicals.canonicalTargetsUnavailable.length > 0) {
      lines.push(
        '',
        `### Targets without canonical result data (${canonicals.canonicalTargetsUnavailable.length})`,
        ''
      );
      for (const url of canonicals.canonicalTargetsUnavailable.slice(0, 50))
        lines.push(`- ${escapeMarkdownCell(url)}`);
      if (canonicals.canonicalTargetsUnavailable.length > 50)
        lines.push('', `Showing 50 of ${canonicals.canonicalTargetsUnavailable.length} targets.`);
    }
  }

  if (comparison) {
    const delta =
      comparison.scoreDelta === null
        ? 'N/A'
        : `${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta}`;
    lines.push(
      '',
      '## Baseline comparison',
      '',
      `- **Baseline:** ${escapeMarkdownCell(comparison.baselineTimestamp)}`,
      `- **Average score:** ${comparison.baselineAverageScore ?? 'N/A'} → ${comparison.currentAverageScore ?? 'N/A'} (${delta})`,
      `- **New URLs:** ${comparison.newUrls.length}; **removed URLs:** ${comparison.removedUrls.length}`,
      `- **New failed checks:** ${comparison.newFailures.length}; **resolved failed checks:** ${comparison.resolvedFailures.length}`,
      `- **GEO signal changes:** ${comparison.geoChanges.length}`,
      `- **Crawler/preview controls comparable:** ${comparison.geoComparedPages} of ${comparison.geoComparedPages + comparison.geoUnassessedPages} matched pages`,
      '',
      '### New failed checks',
      ''
    );
    if (comparison.newFailures.length === 0) {
      lines.push('No newly failing checks.');
    } else {
      lines.push(
        '| URL | Category | Check | Severity | Finding |',
        '| --- | --- | --- | --- | --- |'
      );
      for (const failure of comparison.newFailures) {
        const label =
          SECTIONS.find((section) => section.key === failure.category)?.label ?? failure.category;
        lines.push(
          `| ${escapeMarkdownCell(failure.url)} | ${escapeMarkdownCell(label)} | ${escapeMarkdownCell(failure.name)} | ${escapeMarkdownCell(failure.severity ?? 'failure')} | ${escapeMarkdownCell(failure.message)} |`
        );
      }
    }
    lines.push('', '### Resolved failed checks', '');
    if (comparison.resolvedFailures.length === 0) {
      lines.push('No failed checks were resolved.');
    } else {
      lines.push('| URL | Category | Check | Finding |', '| --- | --- | --- | --- |');
      for (const failure of comparison.resolvedFailures) {
        const label =
          SECTIONS.find((section) => section.key === failure.category)?.label ?? failure.category;
        lines.push(
          `| ${escapeMarkdownCell(failure.url)} | ${escapeMarkdownCell(label)} | ${escapeMarkdownCell(failure.name)} | ${escapeMarkdownCell(failure.message)} |`
        );
      }
    }
    lines.push('', '### GEO signal changes', '');
    if (comparison.geoChanges.length === 0) {
      const matchedGeoPages = comparison.geoComparedPages + comparison.geoUnassessedPages;
      lines.push(
        matchedGeoPages === 0
          ? 'No matched page pairs were available for GEO comparison.'
          : `No observed GEO signal changes were recorded. Crawler/preview controls were comparable on ${comparison.geoComparedPages} of ${matchedGeoPages} matched pages.`
      );
    } else {
      lines.push('| URL | Signal | Before | After |', '| --- | --- | --- | --- |');
      for (const change of comparison.geoChanges) {
        lines.push(
          `| ${escapeMarkdownCell(change.url)} | ${escapeMarkdownCell(change.signal)} | ${escapeMarkdownCell(change.before)} | ${escapeMarkdownCell(change.after)} |`
        );
      }
      lines.push(
        '',
        'These are differences between saved audit snapshots; they do not predict AI citations.'
      );
    }
    if (comparison.newUrls.length > 0 || comparison.removedUrls.length > 0) {
      lines.push('', '### URL list changes', '');
      for (const url of comparison.newUrls) lines.push(`- Added: ${escapeMarkdownCell(url)}`);
      for (const url of comparison.removedUrls) lines.push(`- Removed: ${escapeMarkdownCell(url)}`);
    }
  }

  lines.push('', '## Failures', '');
  const failedRows = batch.results.flatMap((result) => {
    if (result.status === 'error') {
      return [
        `| ${escapeMarkdownCell(result.url)} | Audit error | — | ${escapeMarkdownCell(result.error)} |`,
      ];
    }
    return sectionsFor(result.report).flatMap(({ key, label }) =>
      (result.report.checks[key] ?? [])
        .filter((check) => !check.passed)
        .map(
          (check) =>
            `| ${escapeMarkdownCell(result.url)} | ${escapeMarkdownCell(label)} | ${escapeMarkdownCell(check.severity ?? 'failure')} | ${escapeMarkdownCell(check.message)} |`
        )
    );
  });

  if (failedRows.length === 0) {
    lines.push(
      batch.summary.passedChecks + batch.summary.failedChecks === 0 &&
        batch.summary.completedUrls > 0
        ? 'No checks ran.'
        : 'All page audits completed without failed checks.'
    );
  } else {
    lines.push(
      '| URL | Category | Severity | Finding |',
      '| --- | --- | --- | --- |',
      ...failedRows
    );
  }

  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const recommendations = batch.results
    .flatMap((result) =>
      result.status === 'complete'
        ? generateSEORecommendations(result.report).map((recommendation) => ({
            url: result.url,
            recommendation,
          }))
        : []
    )
    .sort(
      (a, b) =>
        priorityRank[a.recommendation.priority] - priorityRank[b.recommendation.priority] ||
        Number(b.recommendation.quickWin) - Number(a.recommendation.quickWin) ||
        a.url.localeCompare(b.url)
    );
  if (recommendations.length > 0) {
    lines.push('', '## Recommended next steps', '');
    for (const { url, recommendation } of recommendations.slice(0, 30)) {
      const scoreLift =
        recommendation.scoreLift === null
          ? ''
          : ` · estimated +${recommendation.scoreLift} Aviary score points if this single finding passes`;
      lines.push(
        `- **${escapeMarkdownCell(recommendation.priority.toUpperCase())}${recommendation.quickWin ? ' · Quick win' : ''} — ${escapeMarkdownCell(url)} / ${escapeMarkdownCell(recommendation.categoryLabel)} / ${escapeMarkdownCell(recommendation.checkName)}.**${scoreLift} ${escapeMarkdownCell(recommendation.finding)} Next: ${escapeMarkdownCell(recommendation.action)}`
      );
      if (recommendation.example) {
        lines.push(
          `  \`\`\`${recommendation.example.language}`,
          ...recommendation.example.code.split('\n').map((line) => `  ${line}`),
          '  ```'
        );
      }
    }
    if (recommendations.length > 30) {
      lines.push(
        '',
        `Showing the 30 highest-priority recommendations of ${recommendations.length}.`
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Render a JUnit test suite across every audited URL, including cross-page metadata and content findings. */
export function renderBatchJunitReport(batch: SEOAuditBatchReport): string {
  let tests = 0;
  let failures = 0;
  let errors = 0;

  let suites = batch.results
    .map((result) => {
      if (result.status === 'error') {
        errors += 1;
        tests += 1;
        return `\n<testsuite name="${escapeXml(result.url)}" tests="1" failures="0" errors="1" skipped="0" time="0"><testcase classname="Aviary" name="${escapeXml(result.url)}" time="0"><error message="Audit failed">${escapeXml(result.error)}</error></testcase></testsuite>`;
      }

      const report = result.report;
      let suiteTests = 0;
      let suiteFailures = 0;
      const cases = sectionsFor(report)
        .flatMap(({ key, label }) =>
          (report.checks[key] ?? []).map((check) => {
            tests += 1;
            suiteTests += 1;
            if (!check.passed) {
              failures += 1;
              suiteFailures += 1;
            }
            const failure = check.passed
              ? ''
              : `<failure message="${escapeXml(check.message)}" type="${escapeXml(check.severity ?? 'failure')}">${escapeXml(JSON.stringify(check.details ?? {}, null, 2))}</failure>`;
            return `<testcase classname="${escapeXml(result.url)} — ${escapeXml(label)}" name="${escapeXml(check.name ?? check.message)}" time="0">${failure}</testcase>`;
          })
        )
        .join('');
      return `\n<testsuite name="${escapeXml(result.url)}" tests="${suiteTests}" failures="${suiteFailures}" errors="0" skipped="0" time="0">${cases}</testsuite>`;
    })
    .join('');

  const metadata = analyzeSiteWideMetadata(batch);
  const content = analyzeSiteWideContent(batch);
  const metadataFindings = [
    ...metadata.duplicateTitles.map((group) => ({ kind: 'Duplicate title', group })),
    ...metadata.duplicateDescriptions.map((group) => ({ kind: 'Duplicate description', group })),
  ];
  if (metadataFindings.length > 0) {
    const metadataCases = metadataFindings
      .map(({ kind, group }) => {
        tests += 1;
        failures += 1;
        const message = `${kind} appears on ${group.urls.length} pages`;
        const fullName = `${kind}: ${group.value}`;
        const testName = fullName.length > 240 ? `${fullName.slice(0, 237)}…` : fullName;
        const details = JSON.stringify({ value: group.value, urls: group.urls }, null, 2);
        return `<testcase classname="Aviary cross-page metadata" name="${escapeXml(testName)}" time="0"><failure message="${escapeXml(message)}" type="duplicate-metadata">${escapeXml(details)}</failure></testcase>`;
      })
      .join('');
    suites += `\n<testsuite name="Cross-page metadata" tests="${metadataFindings.length}" failures="${metadataFindings.length}" errors="0" skipped="0" time="0">${metadataCases}</testsuite>`;
  }

  if (content.duplicateContent.length > 0) {
    const contentCases = content.duplicateContent
      .map((group) => {
        tests += 1;
        failures += 1;
        const message = `Exact content appears on ${group.urls.length} pages`;
        const fullName = `Duplicate content: ${group.wordCount} words on ${group.urls.length} pages`;
        const testName = fullName.length > 240 ? `${fullName.slice(0, 237)}…` : fullName;
        const details = JSON.stringify(
          {
            wordCount: group.wordCount,
            normalizedCharacters: group.normalizedCharacters,
            urls: group.urls,
          },
          null,
          2
        );
        return `<testcase classname="Aviary cross-page content" name="${escapeXml(testName)}" time="0"><failure message="${escapeXml(message)}" type="duplicate-content">${escapeXml(details)}</failure></testcase>`;
      })
      .join('');
    suites += `\n<testsuite name="Cross-page content" tests="${content.duplicateContent.length}" failures="${content.duplicateContent.length}" errors="0" skipped="0" time="0">${contentCases}</testsuite>`;
  }

  const hreflang = analyzeSiteWideHreflang(batch);
  if (hreflang.missingReciprocals.length > 0) {
    const cases = hreflang.missingReciprocals
      .map((finding) => {
        tests += 1;
        failures += 1;
        const message = `The ${finding.targetUrl} alternate (${finding.language}) does not link back to ${finding.sourceUrl}`;
        const details = JSON.stringify(finding, null, 2);
        return `<testcase classname="Aviary cross-page hreflang" name="${escapeXml(`${finding.sourceUrl} → ${finding.targetUrl} (${finding.language})`)}" time="0"><failure message="${escapeXml(message)}" type="missing-hreflang-return-link">${escapeXml(details)}</failure></testcase>`;
      })
      .join('');
    suites += `\n<testsuite name="Cross-page hreflang" tests="${hreflang.missingReciprocals.length}" failures="${hreflang.missingReciprocals.length}" errors="0" skipped="0" time="0">${cases}</testsuite>`;
  }

  const canonicals = analyzeSiteWideCanonicals(batch);
  const canonicalCases = [
    ...canonicals.canonicalChains.map((chain) => ({
      name: `${chain.sourceUrl} → ${chain.canonicalTargetUrl} → ${chain.finalCanonicalUrl}`,
      message: `Canonical for ${chain.sourceUrl} points to a page that canonicalizes elsewhere`,
      type: 'canonical-chain',
      details: chain,
    })),
    ...canonicals.canonicalLoops.map((loop) => ({
      name: `Canonical loop: ${loop.join(' → ')}`,
      message: `Canonical URLs form a loop across ${loop.length} pages`,
      type: 'canonical-loop',
      details: { urls: loop },
    })),
  ];
  if (canonicalCases.length > 0) {
    const cases = canonicalCases
      .map((finding) => {
        tests += 1;
        failures += 1;
        const testName =
          finding.name.length > 240 ? `${finding.name.slice(0, 237)}…` : finding.name;
        return `<testcase classname="Aviary cross-page canonicals" name="${escapeXml(testName)}" time="0"><failure message="${escapeXml(finding.message)}" type="${escapeXml(finding.type)}">${escapeXml(JSON.stringify(finding.details, null, 2))}</failure></testcase>`;
      })
      .join('');
    suites += `\n<testsuite name="Cross-page canonicals" tests="${canonicalCases.length}" failures="${canonicalCases.length}" errors="0" skipped="0" time="0">${cases}</testsuite>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="Aviary multi-page audit" tests="${tests}" failures="${failures}" errors="${errors}" skipped="0" time="0">${suites}\n</testsuites>\n`;
}

/** Render one CSV row per check, failed URL audit, or site-wide finding. */
export function renderBatchCsvReport(batch: SEOAuditBatchReport): string {
  const rows: unknown[][] = [
    [
      'url',
      'status',
      'score',
      'category',
      'check',
      'passed',
      'severity',
      'message',
      'details',
      'recommendation',
      'priority',
      'estimated_score_lift',
      'quick_win',
      'code_example',
    ],
  ];
  for (const result of batch.results) {
    if (result.status === 'error') {
      rows.push([
        result.url,
        'error',
        '',
        '',
        '',
        false,
        'error',
        result.error,
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      continue;
    }

    let checksWritten = 0;
    const recommendations = recommendationQueues(result.report);
    for (const { key, label } of sectionsFor(result.report)) {
      for (const check of result.report.checks[key] ?? []) {
        checksWritten += 1;
        const recommendation = check.passed
          ? undefined
          : takeRecommendation(
              recommendations,
              key,
              check.name ?? label,
              check.message,
              check.severity
            );
        rows.push([
          result.url,
          'complete',
          result.report.score ?? '',
          label,
          check.name ?? '',
          check.passed,
          check.severity ?? '',
          check.message,
          check.details ? JSON.stringify(check.details) : '',
          recommendation?.action ?? '',
          recommendation?.priority ?? '',
          recommendation?.scoreLift ?? '',
          recommendation?.quickWin ?? '',
          recommendation?.example?.code ?? '',
        ]);
      }
    }
    if (checksWritten === 0) {
      rows.push([
        result.url,
        'complete',
        result.report.score ?? '',
        '',
        '',
        '',
        '',
        'No checks ran',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    }
  }

  const metadata = analyzeSiteWideMetadata(batch);
  const appendDuplicateRows = (
    check: 'duplicate-title' | 'duplicate-description',
    label: 'Duplicate title' | 'Duplicate description',
    groups: ReturnType<typeof analyzeSiteWideMetadata>['duplicateTitles']
  ): void => {
    for (const group of groups) {
      rows.push([
        group.urls.join(' '),
        'sitewide',
        '',
        'Cross-page metadata',
        check,
        false,
        'warning',
        `${label} appears on ${group.urls.length} pages`,
        JSON.stringify({ value: group.value, urls: group.urls }),
        'Give each page a distinct, descriptive value.',
        'medium',
        '',
        false,
        '',
      ]);
    }
  };
  appendDuplicateRows('duplicate-title', 'Duplicate title', metadata.duplicateTitles);
  appendDuplicateRows(
    'duplicate-description',
    'Duplicate description',
    metadata.duplicateDescriptions
  );

  const content = analyzeSiteWideContent(batch);
  for (const group of content.duplicateContent) {
    rows.push([
      group.urls.join(' '),
      'sitewide',
      '',
      'Cross-page content',
      'duplicate-content',
      false,
      'warning',
      `Exact content appears on ${group.urls.length} pages`,
      JSON.stringify({
        wordCount: group.wordCount,
        normalizedCharacters: group.normalizedCharacters,
        urls: group.urls,
      }),
      'Review the pages and keep the most useful version; make other pages substantively distinct.',
      'medium',
      '',
      false,
      '',
    ]);
  }

  const linkGraph = analyzeSiteWideLinkGraph(batch);
  if (linkGraph.pagesWithGraphData > 0) {
    rows.push([
      '',
      'sitewide',
      '',
      'Cross-page link graph',
      'summary',
      true,
      'info',
      `Found ${linkGraph.linksAnalyzed} links between ${linkGraph.pagesAnalyzed} scanned pages`,
      JSON.stringify({
        pagesWithGraphData: linkGraph.pagesWithGraphData,
        pagesSkipped: linkGraph.pagesSkipped,
        pagesWithNoInboundLinks: linkGraph.pagesWithNoInboundLinks,
        pagesWithNoOutboundLinks: linkGraph.pagesWithNoOutboundLinks,
        truncatedPages: linkGraph.truncatedPages,
        mostLinkedPages: linkGraph.mostLinkedPages,
      }),
      '',
      '',
      '',
      false,
      '',
    ]);
  }

  const hreflang = analyzeSiteWideHreflang(batch);
  if (hreflang.pagesWithData > 0) {
    rows.push([
      '',
      'sitewide',
      '',
      'Cross-page hreflang',
      'summary',
      hreflang.missingReciprocals.length === 0,
      hreflang.missingReciprocals.length === 0 ? 'info' : 'warning',
      `Checked ${hreflang.alternateLinksAnalyzed} alternate links; ${hreflang.missingReciprocals.length} missing return links and ${hreflang.unscannedTargetUrls.length} targets outside the batch.`,
      JSON.stringify({
        pagesAnalyzed: hreflang.pagesAnalyzed,
        pagesWithData: hreflang.pagesWithData,
        pagesSkipped: hreflang.pagesSkipped,
        unscannedTargetUrls: hreflang.unscannedTargetUrls.slice(0, 100),
        unscannedTargetsOmitted: Math.max(0, hreflang.unscannedTargetUrls.length - 100),
        unavailableTargetUrls: hreflang.unavailableTargetUrls.slice(0, 100),
        unavailableTargetsOmitted: Math.max(0, hreflang.unavailableTargetUrls.length - 100),
      }),
      '',
      '',
      '',
      false,
      '',
    ]);
  }
  for (const finding of hreflang.missingReciprocals) {
    rows.push([
      finding.sourceUrl,
      'sitewide',
      '',
      'Cross-page hreflang',
      'hreflang-return-link',
      false,
      'warning',
      `The ${finding.targetUrl} alternate (${finding.language}) does not link back to the source page.`,
      JSON.stringify(finding),
      'Add a reciprocal hreflang alternate on the target page.',
      'medium',
      '',
      false,
      '',
    ]);
  }

  const canonicals = analyzeSiteWideCanonicals(batch);
  if (canonicals.pagesWithData > 0) {
    const canonicalIssues =
      canonicals.canonicalChains.length +
      canonicals.canonicalLoops.length +
      canonicals.pagesMissingCanonical +
      canonicals.pagesWithMultipleCanonicals +
      canonicals.pagesWithInvalidCanonical +
      canonicals.pagesSkipped;
    rows.push([
      '',
      'sitewide',
      '',
      'Cross-page canonicals',
      'summary',
      canonicalIssues === 0,
      canonicalIssues === 0 ? 'info' : 'warning',
      `Checked canonical URLs across ${canonicals.pagesWithData} pages; found ${canonicals.canonicalChains.length} chain(s), ${canonicals.canonicalLoops.length} loop(s), ${canonicals.pagesMissingCanonical} missing, ${canonicals.pagesWithMultipleCanonicals} multiple, and ${canonicals.pagesWithInvalidCanonical} invalid declaration(s); ${canonicals.pagesSkipped} page(s) lacked canonical result data.`,
      JSON.stringify({
        pagesAnalyzed: canonicals.pagesAnalyzed,
        pagesWithData: canonicals.pagesWithData,
        pagesWithCanonical: canonicals.pagesWithCanonical,
        pagesMissingCanonical: canonicals.pagesMissingCanonical,
        pagesWithMultipleCanonicals: canonicals.pagesWithMultipleCanonicals,
        pagesWithInvalidCanonical: canonicals.pagesWithInvalidCanonical,
        multipleCanonicalUrls: canonicals.multipleCanonicalUrls.slice(0, 100),
        multipleCanonicalUrlsOmitted: Math.max(0, canonicals.multipleCanonicalUrls.length - 100),
        invalidCanonicalUrls: canonicals.invalidCanonicalUrls.slice(0, 100),
        invalidCanonicalUrlsOmitted: Math.max(0, canonicals.invalidCanonicalUrls.length - 100),
        pagesSkipped: canonicals.pagesSkipped,
        duplicateCanonicalTargets: canonicals.duplicateCanonicalTargets.slice(0, 100),
        duplicateCanonicalTargetsOmitted: Math.max(
          0,
          canonicals.duplicateCanonicalTargets.length - 100
        ),
        canonicalTargetsOutsideBatch: canonicals.canonicalTargetsOutsideBatch.slice(0, 100),
        canonicalTargetsOutsideBatchOmitted: Math.max(
          0,
          canonicals.canonicalTargetsOutsideBatch.length - 100
        ),
        canonicalTargetsUnavailable: canonicals.canonicalTargetsUnavailable.slice(0, 100),
        canonicalTargetsUnavailableOmitted: Math.max(
          0,
          canonicals.canonicalTargetsUnavailable.length - 100
        ),
      }),
      '',
      '',
      '',
      false,
      '',
    ]);
  }
  for (const chain of canonicals.canonicalChains) {
    rows.push([
      chain.sourceUrl,
      'sitewide',
      '',
      'Cross-page canonicals',
      'canonical-chain',
      false,
      'warning',
      `The canonical target ${chain.canonicalTargetUrl} points to ${chain.finalCanonicalUrl}.`,
      JSON.stringify(chain),
      'Point directly to the final canonical URL.',
      'medium',
      '',
      false,
      '',
    ]);
  }
  for (const loop of canonicals.canonicalLoops) {
    rows.push([
      loop.join(' '),
      'sitewide',
      '',
      'Cross-page canonicals',
      'canonical-loop',
      false,
      'warning',
      `Canonical URLs form a loop across ${loop.length} pages.`,
      JSON.stringify({ urls: loop }),
      'Choose one canonical URL and make every page point directly to it.',
      'high',
      '',
      false,
      '',
    ]);
  }
  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

/** Write the Markdown overview for a multi-page audit. */
export function generateBatchMarkdownReport(
  batch: SEOAuditBatchReport,
  outputPath: string,
  comparison?: SEOAuditBatchComparison
): void {
  writeReportFile(outputPath, renderBatchMarkdownReport(batch, comparison));
}

/** Write the JUnit suite for a multi-page audit. */
export function generateBatchJunitReport(batch: SEOAuditBatchReport, outputPath: string): void {
  writeReportFile(outputPath, renderBatchJunitReport(batch));
}

/** Write the CSV rows for a multi-page audit. */
export function generateBatchCsvReport(batch: SEOAuditBatchReport, outputPath: string): void {
  writeReportFile(outputPath, renderBatchCsvReport(batch));
}
