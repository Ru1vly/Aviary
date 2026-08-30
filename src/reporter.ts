import * as fs from 'fs';
import * as path from 'path';
import { SEOReport, SEOCheckResult } from './types';
import { CHECKER_REGISTRY as SECTIONS } from './checkers/registry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';   // green
  if (score >= 60) return '#f59e0b';   // amber
  return '#ef4444';                     // red
}

function scoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function severityBadge(severity?: string): string {
  if (!severity) return '';
  const map: Record<string, string> = {
    error:   '<span class="badge badge-error">ERROR</span>',
    warning: '<span class="badge badge-warning">WARNING</span>',
    info:    '<span class="badge badge-info">INFO</span>',
  };
  return map[severity] ?? '';
}

function renderChecks(checks: SEOCheckResult[]): string {
  if (!checks.length) return '<p class="empty">No checks ran for this category.</p>';

  const passed = checks.filter((c) => c.passed);
  const failed = checks.filter((c) => !c.passed);

  const renderItem = (c: SEOCheckResult) => {
    const icon = c.passed ? '✓' : '✗';
    const cls  = c.passed ? 'check-pass' : 'check-fail';
    const detailsHtml = (!c.passed && c.details)
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

function generateHtml(report: SEOReport): string {
  // report.score is null when nothing was checked (see calculateWeightedScore) —
  // render "N/A" with a neutral color rather than feeding null into a
  // >= comparison, which would silently fall through to the red/F case.
  const reportScore = report.score;
  const color = reportScore !== null ? scoreColor(reportScore) : '#94a3b8';
  const grade = reportScore !== null ? scoreGrade(reportScore) : 'N/A';
  const scoreDisplay = reportScore !== null ? String(reportScore) : 'N/A';
  const passRate = report.summary.total > 0
    ? Math.round((report.summary.passed / report.summary.total) * 100)
    : 0;

  // Category summaries for the overview grid
  const categorySummaries = SECTIONS.map(({ key, label, icon }) => {
    const checks = report.checks[key] ?? [];
    const p = checks.filter((c) => c.passed).length;
    const t = checks.length;
    const pct = t > 0 ? Math.round((p / t) * 100) : 100;
    const catColor = scoreColor(pct);
    return { key, label, icon, p, t, pct, catColor };
  });

  // Section detail cards
  const sectionCards = SECTIONS.map(({ key, label, icon }) => {
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
  }).join('\n');

  // Failed checks summary
  const allFailed = SECTIONS.flatMap(({ key, label, icon }) =>
    (report.checks[key] ?? [])
      .filter((c) => !c.passed)
      .map((c) => ({ ...c, category: label, icon }))
  );

  const failedSummaryRows = allFailed.slice(0, 20).map((c) => `
    <tr class="${c.severity === 'error' ? 'row-error' : c.severity === 'info' ? 'row-info' : 'row-warn'}">
      <td>${c.icon} ${escapeHtml(c.category)}</td>
      <td>${severityBadge(c.severity)}</td>
      <td>${escapeHtml(c.message)}</td>
    </tr>`).join('');

  const moreCount = allFailed.length - 20;

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

    /* ── Footer ── */
    .footer {
      text-align: center; padding: 2rem;
      color: var(--text-muted); font-size: 0.8rem;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
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
  ${allFailed.length > 0 ? `
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
  </div>` : `
  <div class="issues-section">
    <p style="color: var(--green); font-weight: 600; font-size: 1.1rem;">🎉 All checks passed!</p>
  </div>`}

  <!-- ── Category overview grid ── -->
  <div class="issues-section">
    <h2 class="section-title">📊 Category Overview</h2>
    <div class="overview-grid">
      ${categorySummaries.map(({ key, label, icon, pct, catColor }) => `
        <a class="overview-tile" href="#cat-${key}">
          <div class="tile-header">
            <span class="tile-icon">${icon}</span>
            <span class="tile-pct" style="color:${catColor}">${pct}%</span>
          </div>
          <div class="tile-label">${escapeHtml(label)}</div>
          <div class="tile-bar">
            <div class="tile-bar-fill" style="width:${pct}%;background:${catColor}"></div>
          </div>
        </a>`).join('')}
    </div>
  </div>

  <!-- ── Detail sections ── -->
  <div class="issues-section">
    <h2 class="section-title">🔍 Detailed Results</h2>
    ${sectionCards}
  </div>

</main>

<footer class="footer">
  Generated by <strong>aviary</strong> &mdash; ${new Date(report.timestamp).toISOString()}
</footer>

</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate an HTML report from an SEOReport and write it to `outputPath`.
 */
export function generateHtmlReport(report: SEOReport, outputPath: string): void {
  const html = generateHtml(report);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, html, 'utf8');
}

/**
 * Return the HTML report as a string without writing to disk.
 */
export function renderHtmlReport(report: SEOReport): string {
  return generateHtml(report);
}
