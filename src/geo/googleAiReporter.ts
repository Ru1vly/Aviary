import type {
  GoogleAiAuditCorrelation,
  GoogleAiPerformanceExport,
  GoogleAiPerformanceSummary,
  GoogleAiDimensionComparison,
  GoogleAiVisibilityComparison,
} from './googleAiPerformance';

export interface GoogleAiPerformanceHtmlInput {
  exports: GoogleAiPerformanceExport[];
  summaries: GoogleAiPerformanceSummary[];
  correlations?: GoogleAiAuditCorrelation[];
  visibilityComparison?: GoogleAiVisibilityComparison;
  dimensionComparison?: GoogleAiDimensionComparison;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pageLink(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return escapeHtml(value);
    return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escapeHtml(value)}</a>`;
  } catch {
    return escapeHtml(value);
  }
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? '—' : new Intl.NumberFormat('en').format(value);
}

function dimensionTable(title: string, values: GoogleAiPerformanceSummary['topPages']): string {
  if (!values.length) return '';
  const dimensionLabel =
    title === 'Pages'
      ? 'Page'
      : title === 'Countries'
        ? 'Country'
        : title === 'Devices'
          ? 'Device'
          : 'Period';
  const rows = values
    .map((item) => {
      const label = title === 'Pages' ? pageLink(item.value) : escapeHtml(item.value);
      return `<tr data-search="${escapeHtml(item.value.toLowerCase())}"><td>${label}</td><td class="num">${formatNumber(item.rows)}</td><td class="num">${formatNumber(item.impressions)}</td></tr>`;
    })
    .join('');
  return `<section class="dimension"><h3>${escapeHtml(title)}</h3><div class="table-wrap"><table><caption>Top ${escapeHtml(title.toLowerCase())} by row-summed impressions</caption><thead><tr><th scope="col">${escapeHtml(dimensionLabel)}</th><th scope="col" class="num">Rows</th><th scope="col" class="num">Impressions</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderSummary(summary: GoogleAiPerformanceSummary, index: number): string {
  const dimensionTables = [
    dimensionTable('Pages', summary.topPages),
    dimensionTable('Countries', summary.topCountries),
    dimensionTable('Devices', summary.topDevices),
    dimensionTable('Time series', summary.timeSeries),
  ]
    .filter(Boolean)
    .join('');
  return `<section class="section" aria-labelledby="summary-${index}"><div class="section-head"><div><span class="eyebrow">${escapeHtml(summary.surface)} · ${escapeHtml(summary.datasetKind)}</span><h2 id="summary-${index}">${escapeHtml(summary.sourceFile ?? 'Google AI Performance export')}</h2></div><div class="headline-metric"><strong>${formatNumber(summary.rowSummedImpressions)}</strong><span>row-summed impressions</span></div></div><div class="summary-meta"><span>${formatNumber(summary.rowCount)} rows</span><span>${formatNumber(summary.uniquePageCount)} unique pages</span><span>Dimensions: ${summary.dimensions.map(escapeHtml).join(' · ')}</span></div><div class="filter-row"><label for="google-filter-${index}">Find a page or dimension</label><input id="google-filter-${index}" type="search" data-filter="${index}" placeholder="Search this export summary" autocomplete="off"></div><div class="dimension-grid">${dimensionTables || '<p class="empty">No ranked dimensions are available for this export view.</p>'}</div><p class="note">${escapeHtml(summary.note)}</p></section>`;
}

function renderComparison(comparison: GoogleAiVisibilityComparison, surface: string): string {
  const rows = comparison.changes
    .map((change) => {
      const delta = change.impressionsChange;
      return `<tr><td>${pageLink(change.url)}</td><td><span class="state state-${change.state}">${escapeHtml(change.state.replace(/-/g, ' '))}</span></td><td class="num">${formatNumber(change.baselineImpressions)}</td><td class="num">${formatNumber(change.currentImpressions)}</td><td class="num ${delta === undefined ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta === undefined ? '—' : `${delta > 0 ? '+' : ''}${formatNumber(delta)}`}</td><td class="num">${change.percentChange === undefined ? '—' : `${change.percentChange > 0 ? '+' : ''}${change.percentChange.toFixed(1)}%`}</td></tr>`;
    })
    .join('');
  const delta = comparison.matchedPageImpressionChange;
  return `<section class="section"><div class="section-head"><div><span class="eyebrow">Period comparison · ${escapeHtml(surface)}</span><h2>Matched page impressions</h2><p class="subhead">${escapeHtml(comparison.baselineSourceFile ?? 'Baseline')} → ${escapeHtml(comparison.currentSourceFile ?? 'Current export')}</p></div><div class="headline-metric"><strong class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${formatNumber(delta)}</strong><span>${comparison.matchedPagePercentChange === undefined ? 'percent change unavailable' : `${comparison.matchedPagePercentChange > 0 ? '+' : ''}${comparison.matchedPagePercentChange.toFixed(1)}% of matched baseline`}</span></div></div><div class="summary-meta"><span>${formatNumber(comparison.pagesCompared)} shared URLs compared</span><span>${formatNumber(comparison.pagesWithIncreasedImpressions)} increased</span><span>${formatNumber(comparison.pagesWithDecreasedImpressions)} decreased</span><span>${formatNumber(comparison.pagesOnlyInCurrentExport + comparison.pagesOnlyInBaselineExport)} export-only URLs</span></div><div class="table-wrap"><table><caption>Impression changes for Google AI page URLs</caption><thead><tr><th scope="col">Page</th><th scope="col">State</th><th scope="col" class="num">Baseline</th><th scope="col" class="num">Current</th><th scope="col" class="num">Change</th><th scope="col" class="num">Change %</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No comparable page rows.</td></tr>'}</tbody></table></div>${comparison.changesTruncated ? '<p class="note">Page details are capped at 1,000 entries.</p>' : ''}<p class="note">${escapeHtml(comparison.note)}</p></section>`;
}

function renderDimensionComparison(comparison: GoogleAiDimensionComparison): string {
  const dimensions = comparison.dimensions;
  const dimensionHeaders =
    dimensions.map((dimension) => `<th scope="col">${escapeHtml(dimension)}</th>`).join('') ||
    '<th scope="col">Export view</th>';
  const rows = comparison.changes
    .map((change) => {
      const values =
        dimensions
          .map((dimension) => {
            const value = change.values[dimension] ?? '';
            return `<td>${dimension === 'url' && value ? pageLink(value) : escapeHtml(value || (dimensions.includes(dimension) ? '(blank)' : 'All rows'))}</td>`;
          })
          .join('') || '<td>All rows</td>';
      const delta = change.impressionsChange;
      const shareDelta = change.impressionShareChangePercentagePoints;
      return `<tr>${values}<td><span class="state state-${change.state}">${escapeHtml(change.state.replace(/-/g, ' '))}</span></td><td class="num">${formatNumber(change.baselineImpressions)}</td><td class="num">${formatNumber(change.currentImpressions)}</td><td class="num ${delta === undefined ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta === undefined ? '—' : `${delta > 0 ? '+' : ''}${formatNumber(delta)}`}</td><td class="num">${change.percentChange === undefined ? '—' : `${change.percentChange > 0 ? '+' : ''}${change.percentChange.toFixed(1)}%`}</td><td class="num">${change.baselineImpressionSharePercent === undefined ? '—' : `${change.baselineImpressionSharePercent.toFixed(2)}%`}</td><td class="num">${change.currentImpressionSharePercent === undefined ? '—' : `${change.currentImpressionSharePercent.toFixed(2)}%`}</td><td class="num ${shareDelta === undefined ? '' : shareDelta > 0 ? 'up' : shareDelta < 0 ? 'down' : ''}">${shareDelta === undefined ? '—' : `${shareDelta > 0 ? '+' : ''}${shareDelta.toFixed(2)} pp`}</td></tr>`;
    })
    .join('');
  const delta = comparison.matchedImpressionChange;
  const shareMovement =
    comparison.meanCohortShareChangePercentagePoints === undefined
      ? ''
      : `<span>Mean shared-cohort share shift ${comparison.meanCohortShareChangePercentagePoints > 0 ? '+' : ''}${comparison.meanCohortShareChangePercentagePoints.toFixed(2)} pp</span>`;
  return `<section class="section"><div class="section-head"><div><span class="eyebrow">Period comparison · ${escapeHtml(comparison.surface)} · exact dimensions</span><h2>${dimensions.length ? dimensions.map(escapeHtml).join(' × ') : 'Overview'} cohorts</h2><p class="subhead">${escapeHtml(comparison.baselineSourceFile ?? 'Baseline')} → ${escapeHtml(comparison.currentSourceFile ?? 'Current export')}</p></div><div class="headline-metric"><strong class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${formatNumber(delta)}</strong><span>${comparison.matchedImpressionPercentChange === undefined ? 'percent change unavailable' : `${comparison.matchedImpressionPercentChange > 0 ? '+' : ''}${comparison.matchedImpressionPercentChange.toFixed(1)}% of matched baseline`}</span></div></div><div class="summary-meta"><span>${formatNumber(comparison.cohortsCompared)} cohorts compared</span><span>${formatNumber(comparison.cohortsWithIncreasedImpressions)} increased</span><span>${formatNumber(comparison.cohortsWithDecreasedImpressions)} decreased</span><span>${formatNumber(comparison.cohortsOnlyInCurrentExport + comparison.cohortsOnlyInBaselineExport)} export-only</span><span>${formatNumber(comparison.cohortsWithIncreasingShare)} gained share</span><span>${formatNumber(comparison.cohortsWithDecreasingShare)} lost share</span><span>${formatNumber(comparison.baselineImpressionsInExport)} baseline export impressions</span><span>${formatNumber(comparison.currentImpressionsInExport)} current export impressions</span>${shareMovement}</div><div class="table-wrap"><table><caption>Google AI impressions and within-export shares by exact export dimensions</caption><thead><tr>${dimensionHeaders}<th scope="col">State</th><th scope="col" class="num">Baseline</th><th scope="col" class="num">Current</th><th scope="col" class="num">Change</th><th scope="col" class="num">Change %</th><th scope="col" class="num">Baseline share</th><th scope="col" class="num">Current share</th><th scope="col" class="num">Share change</th></tr></thead><tbody>${rows || `<tr><td colspan="${dimensions.length + 8}" class="empty">No cohorts were returned.</td></tr>`}</tbody></table></div>${comparison.changesTruncated ? '<p class="note">Cohort detail is capped at 1,000 entries.</p>' : ''}<p class="note">${escapeHtml(comparison.note)}</p></section>`;
}

function renderCorrelations(correlations: GoogleAiAuditCorrelation[]): string {
  if (!correlations.length) return '';
  const blocks = correlations
    .map((correlation) => {
      const rows = correlation.currentControlObservations
        .filter(({ exportRows }) => exportRows > 0)
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.control)}</td><td><span class="state state-${item.state}">${escapeHtml(item.state)}</span></td><td class="num">${formatNumber(item.matchedPages)}</td><td class="num">${formatNumber(item.exportRows)}</td><td class="num">${formatNumber(item.rowSummedImpressions)}</td></tr>`
        )
        .join('');
      const contentRows = correlation.currentContentObservations
        .filter(({ exportRows }) => exportRows > 0)
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.signal)}</td><td><span class="state state-${item.state}">${escapeHtml(item.state)}</span></td><td class="num">${formatNumber(item.matchedPages)}</td><td class="num">${formatNumber(item.exportRows)}</td><td class="num">${formatNumber(item.rowSummedImpressions)}</td></tr>`
        )
        .join('');
      return `<div class="correlation-block"><div class="section-head"><div><span class="eyebrow">Current audit snapshot · ${formatNumber(correlation.pagesMatchedToAudit)} / ${formatNumber(correlation.uniqueReportPages)} pages matched · ${formatNumber(correlation.pagesWithAmbiguousAuditUrlMatch)} ambiguous audit URLs · ${formatNumber(correlation.pagesWithAmbiguousCanonicalMatch)} ambiguous canonicals</span><h3>${escapeHtml(correlation.sourceFile ?? 'Google export')}</h3></div></div><div class="table-wrap"><table><caption>Current Googlebot control observations across matched report rows</caption><thead><tr><th scope="col">Control</th><th scope="col">State</th><th scope="col" class="num">Pages</th><th scope="col" class="num">Rows</th><th scope="col" class="num">Row-summed impressions</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">No matched pages with assessed controls.</td></tr>'}</tbody></table></div><h3>Observed page content beside impressions</h3><div class="table-wrap"><table><caption>Present-day page content signals associated with matched Google report rows</caption><thead><tr><th scope="col">Content signal</th><th scope="col">State</th><th scope="col" class="num">Pages</th><th scope="col" class="num">Rows</th><th scope="col" class="num">Row-summed impressions</th></tr></thead><tbody>${contentRows || '<tr><td colspan="5" class="empty">No matched pages with assessed content signals.</td></tr>'}</tbody></table></div><p class="note">${escapeHtml(correlation.note)}</p></div>`;
    })
    .join('');
  return `<section class="section"><div class="section-head"><div><span class="eyebrow">Overlapping associations · not causal</span><h2>Googlebot controls and page signals</h2></div></div>${blocks}</section>`;
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && '=+-@'.includes(text.trimStart().charAt(0))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Render spreadsheet-safe raw export rows or the selected Google AI period comparison. */
export function renderGoogleAiPerformanceCsv(input: GoogleAiPerformanceHtmlInput): string {
  const toCsv = (rows: unknown[][]): string =>
    `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
  if (input.dimensionComparison) {
    const comparison = input.dimensionComparison;
    const dimensions = comparison.dimensions;
    const headers = [
      'surface',
      ...dimensions,
      ...(dimensions.length ? [] : ['export_view']),
      'state',
      'baseline_impressions',
      'current_impressions',
      'impressions_change',
      'impressions_change_percent',
      'baseline_export_share_percent',
      'current_export_share_percent',
      'share_change_percentage_points',
    ];
    const rows = comparison.changes.map((change) => [
      comparison.surface,
      ...dimensions.map((dimension) => change.values[dimension] ?? ''),
      ...(dimensions.length ? [] : ['all_rows']),
      change.state,
      change.baselineImpressions,
      change.currentImpressions,
      change.impressionsChange,
      change.percentChange,
      change.baselineImpressionSharePercent,
      change.currentImpressionSharePercent,
      change.impressionShareChangePercentagePoints,
    ]);
    return toCsv([headers, ...rows]);
  }
  if (input.visibilityComparison) {
    const comparison = input.visibilityComparison;
    const headers = [
      'surface',
      'url',
      'state',
      'baseline_impressions',
      'current_impressions',
      'impressions_change',
      'impressions_change_percent',
    ];
    const rows = comparison.changes.map((change) => [
      input.exports[0]?.surface ?? 'search',
      change.url,
      change.state,
      change.baselineImpressions,
      change.currentImpressions,
      change.impressionsChange,
      change.percentChange,
    ]);
    return toCsv([headers, ...rows]);
  }
  const headers = [
    'source_file',
    'surface',
    'dataset_kind',
    'url',
    'country',
    'device',
    'date',
    'impressions',
  ];
  const rows = input.exports.flatMap((exportData) =>
    exportData.rows.map((row) => [
      exportData.sourceFile,
      exportData.surface,
      exportData.datasetKind,
      row.url,
      row.country,
      row.device,
      row.date,
      row.impressions,
    ])
  );
  return toCsv([headers, ...rows]);
}

/** Render an offline, searchable HTML report for Google Search or Discover AI exports. */
export function renderGoogleAiPerformanceHtml(input: GoogleAiPerformanceHtmlInput): string {
  const summaries = input.summaries.map(renderSummary).join('');
  const correlations = renderCorrelations(input.correlations ?? []);
  const surface = input.exports[0]?.surface ?? input.summaries[0]?.surface ?? 'search';
  const comparison = input.visibilityComparison
    ? renderComparison(input.visibilityComparison, surface)
    : '';
  const dimensionComparison = input.dimensionComparison
    ? renderDimensionComparison(input.dimensionComparison)
    : '';
  const pages = input.summaries.reduce((sum, summary) => sum + summary.uniquePageCount, 0);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Google AI visibility · Aviary GEO</title>
<style>
  :root{--ink:#1b2d37;--muted:#68757b;--line:#c7d0d0;--paper:#edf1ef;--white:#fffefa;--blue:#235e79;--blue-soft:#e0edf2;--rust:#b14d36;--rust-soft:#f4e5de;--gold:#b99135;--mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;--serif:Georgia,"Iowan Old Style","Times New Roman",serif}
  *{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 9% 6%,rgba(35,94,121,.12),transparent 30rem),linear-gradient(90deg,rgba(27,45,55,.03) 1px,transparent 1px),linear-gradient(rgba(27,45,55,.025) 1px,transparent 1px),var(--paper);background-size:auto,32px 32px,32px 32px,auto;color:var(--ink);font-family:var(--serif)}main{max-width:1450px;margin:0 auto;padding:clamp(20px,4.8vw,68px)}a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px;overflow-wrap:anywhere}a:hover{color:var(--rust)}:focus-visible{outline:3px solid var(--rust);outline-offset:3px}.mast{display:flex;justify-content:space-between;gap:18px;align-items:center;border-top:5px solid var(--blue);border-bottom:1px solid var(--ink);padding:13px 0;font:10px var(--mono);text-transform:uppercase;letter-spacing:.1em}.mast strong{color:var(--blue)}.mast span:last-child{text-align:right;color:var(--muted)}.hero{display:grid;grid-template-columns:minmax(0,1fr) 185px;gap:30px;align-items:end;padding:clamp(40px,7vw,85px) 0 40px;border-bottom:1px solid var(--line)}.eyebrow{font:700 10px var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--rust)}h1{margin:14px 0 18px;font:400 clamp(42px,7vw,92px)/.9 var(--serif);letter-spacing:-.055em}h1 em{color:var(--blue)}.hero p{max-width:760px;margin:0;font-size:16px;line-height:1.6;color:#465a62}.hero-stamp{padding:18px;border:1px solid var(--blue);background:var(--blue-soft);text-align:center;transform:rotate(2deg)}.hero-stamp strong{display:block;color:var(--blue);font:400 46px var(--serif)}.hero-stamp span{font:9px/1.5 var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.section{padding:39px 0;border-bottom:1px solid var(--line);animation:arrive .5s both}@keyframes arrive{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:21px}.section-head h2{font:400 clamp(27px,4vw,42px) var(--serif);letter-spacing:-.035em;margin:8px 0}.section-head h3{font:400 21px var(--serif);margin:8px 0}.subhead{margin:4px 0;color:var(--muted);font:10px var(--mono)}.headline-metric{min-width:180px;border-left:4px solid var(--blue);padding:10px 14px;background:var(--blue-soft)}.headline-metric strong{display:block;font:400 30px var(--serif);color:var(--blue)}.headline-metric span{display:block;margin-top:3px;font:9px/1.5 var(--mono);color:var(--muted)}.summary-meta{display:flex;gap:8px 18px;flex-wrap:wrap;margin:13px 0 18px;color:var(--muted);font:9px var(--mono);text-transform:uppercase;letter-spacing:.03em}.dimension-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:18px}.dimension h3{font:400 19px var(--serif);margin:0 0 8px}.table-wrap{overflow:auto;border:1px solid var(--line);background:rgba(255,254,250,.8)}table{width:100%;min-width:520px;border-collapse:collapse;font-size:12px}caption{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}th{padding:10px;background:var(--blue);color:white;text-align:left;font:9px var(--mono);text-transform:uppercase;letter-spacing:.08em}td{padding:11px;border-top:1px solid #d6dddd;vertical-align:top;line-height:1.45}tbody tr:hover{background:var(--blue-soft)}.num{text-align:right;font:11px var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}.filter-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:20px 0 12px}.filter-row label{font:700 9px var(--mono);text-transform:uppercase;letter-spacing:.08em}.filter-row input{min-height:38px;width:min(380px,100%);padding:9px 11px;border:1px solid var(--line);background:var(--white);font:11px var(--mono);color:var(--ink)}.state{display:inline-block;padding:4px 6px;border:1px solid var(--line);font:8px var(--mono);text-transform:uppercase}.state-present{background:var(--rust-soft);border-color:#ddb19f;color:#873a28}.state-absent{background:#e5eee9;border-color:#afc7b9;color:#24573f}.state-not-assessed{background:#eeefea;color:var(--muted)}.state-current-only,.state-baseline-only{background:#f4eddb;border-color:#d8c590;color:#705817}.up{color:#26724b}.down{color:#a34130}.note{font:9px/1.6 var(--mono);color:var(--muted);margin:12px 0 0}.correlation-block+.correlation-block{margin-top:25px}.empty{text-align:center;padding:20px;color:var(--muted)}.footer{display:flex;justify-content:space-between;gap:18px;margin-top:25px;padding-top:16px;border-top:1px solid var(--ink);font:9px/1.5 var(--mono);color:var(--muted)}.footer strong{color:var(--blue)}
  @media(max-width:720px){main{padding:18px}.hero{grid-template-columns:1fr;gap:20px}.hero-stamp{justify-self:start;width:160px}.section-head{align-items:start;flex-direction:column}.dimension-grid{grid-template-columns:1fr}.footer{flex-direction:column}}
</style></head><body><main>
  <header class="mast"><span><strong>Aviary</strong> · Google AI visibility</span><span>Search Console · ${escapeHtml(surface)} report</span></header>
  <section class="hero"><div><span class="eyebrow">First-party impression observations</span><h1>AI visibility,<br><em>read in context.</em></h1><p>Browse the reported impressions by export dimension, compare shared page URLs across periods, and inspect how current Googlebot controls and page structures overlap with historical report rows.</p></div><div class="hero-stamp"><strong>${formatNumber(input.exports.length)}</strong><span>separate export views<br>${formatNumber(pages)} page rows summed</span></div></section>
  ${summaries}
  ${comparison}
  ${dimensionComparison}
  ${correlations}
  <footer class="footer"><span>Generated locally by <strong>Aviary</strong> · Google reports impressions, not clicks or citations.</span><span>Current control associations are snapshots, not explanations of report-period activity.</span></footer>
</main>
<script>document.querySelectorAll('[data-filter]').forEach((input)=>{input.addEventListener('input',()=>{const needle=input.value.trim().toLowerCase();const section=input.closest('.section');section?.querySelectorAll('tbody tr[data-search]').forEach((row)=>{row.hidden=!(row.dataset.search||'').includes(needle);});});});</script>
</body></html>`;
}
