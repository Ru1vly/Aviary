import type {
  GoogleSurfacePageMatrix,
  GoogleSurfacePageObservation,
  GoogleSurfacePathFamilyComparison,
  GoogleSurfacePathFamilyPeriodChange,
  GoogleSurfacePeriodComparison,
} from './googleSurfaceMatrix';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function number(value: number | undefined, digits = 0): string {
  return value === undefined
    ? '—'
    : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
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

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && '=+-@'.includes(text.trimStart().charAt(0))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function renderSourceList(label: string, urls: string[], truncated: boolean): string {
  if (urls.length === 0) return '<span class="muted">—</span>';
  return `<details><summary>${urls.length}${truncated ? '+' : ''} URL${urls.length === 1 && !truncated ? '' : 's'}</summary><ul>${urls.map((url) => `<li>${pageLink(url)}</li>`).join('')}</ul>${truncated ? '<span class="muted">Alias list capped at 10</span>' : ''}<span class="sr-only">${escapeHtml(label)}</span></details>`;
}

function renderPage(page: GoogleSurfacePageObservation): string {
  const audit = page.currentAudit;
  const auditText = audit
    ? [
        audit.matchType.replace(/-/g, ' '),
        `Googlebot ${audit.googlebotAccess}`,
        audit.noindex === true ? 'noindex' : undefined,
        audit.noSnippet === true ? 'nosnippet' : undefined,
        audit.maxSnippetZero === true ? 'max-snippet:0' : undefined,
        audit.dataNoSnippetElements !== undefined
          ? `${audit.dataNoSnippetElements} data-nosnippet region(s)`
          : undefined,
        audit.documentLanguage
          ? `lang ${audit.documentLanguage}${audit.documentLanguageValid === false ? ' invalid' : ''}`
          : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ')
    : 'not assessed';
  const gap = page.searchMinusDiscoverSharePercentagePoints;
  const googlebotBlocked = audit?.googlebotAccess === 'blocked';
  const indexingRestricted = audit?.noindex === true;
  const snippetRestricted =
    audit?.noSnippet === true ||
    audit?.maxSnippetZero === true ||
    (audit?.dataNoSnippetElements ?? 0) > 0;
  const controls = audit
    ? `${audit.googlebotAccess} ${audit.noindex ? 'noindex' : ''} ${audit.noSnippet || audit.maxSnippetZero ? 'snippet restriction' : ''}`
    : '';
  const searchText = [
    page.url,
    page.coverage,
    auditText,
    controls,
    ...page.searchSourceUrls,
    ...page.discoverSourceUrls,
  ]
    .join(' ')
    .toLowerCase();
  const auditState =
    audit && (audit.matchType === 'exact-url' || audit.matchType === 'canonical-url')
      ? 'matched'
      : 'not-assessed';
  return `<tr data-url="${escapeHtml(page.url)}" data-coverage="${page.coverage}" data-audit="${auditState}" data-googlebot-blocked="${googlebotBlocked}" data-indexing-restricted="${indexingRestricted}" data-snippet-restricted="${snippetRestricted}" data-gap="${gap === undefined ? '' : Math.abs(gap)}" data-search-share="${page.searchImpressionSharePercent ?? ''}" data-discover-share="${page.discoverImpressionSharePercent ?? ''}" data-search="${escapeHtml(searchText)}">
    <td class="url">${pageLink(page.url)}${audit?.auditUrl ? `<span class="submetric">Audit URL: ${pageLink(audit.auditUrl)}</span>` : ''}</td>
    <td><span class="coverage coverage-${page.coverage}">${escapeHtml(page.coverage.replace(/-/g, ' '))}</span></td>
    <td class="metric search">${number(page.searchImpressions)}<span class="submetric">${number(page.searchImpressionSharePercent, 2)}% of Search AI URL metric</span></td>
    <td class="metric discover">${number(page.discoverImpressions)}<span class="submetric">${number(page.discoverImpressionSharePercent, 2)}% of Discover URL metric</span></td>
    <td class="metric ${gap === undefined ? 'muted' : gap > 0 ? 'search' : gap < 0 ? 'discover' : ''}">${gap === undefined ? '—' : `${gap > 0 ? '+' : ''}${number(gap, 2)} pp`}<span class="submetric">Search share − Discover share</span></td>
    <td>${escapeHtml(auditText)}</td>
    <td>${renderSourceList('Search export URLs', page.searchSourceUrls, page.searchSourceUrlsTruncated)}<hr>${renderSourceList('Discover export URLs', page.discoverSourceUrls, page.discoverSourceUrlsTruncated)}</td>
  </tr>`;
}

function renderSharePlot(matrix: GoogleSurfacePageMatrix): string {
  const points = matrix.pages.filter(
    (page) =>
      page.searchImpressionSharePercent !== undefined &&
      page.discoverImpressionSharePercent !== undefined
  );
  if (points.length === 0)
    return '<section class="plot"><h2>Within-surface page shares</h2><p>No returned pages have both shares measured.</p></section>';
  const left = 58;
  const right = 520;
  const top = 30;
  const bottom = 320;
  const scale = (value: number, min: number, max: number) => min + (value / 100) * (max - min);
  const grid = [0, 25, 50, 75, 100]
    .map((value) => {
      const x = scale(value, left, right);
      const y = bottom - (value / 100) * (bottom - top);
      return `<line class="grid" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"/><line class="grid" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text x="${x}" y="${bottom + 18}" text-anchor="middle">${value}</text><text x="${left - 12}" y="${y + 3}" text-anchor="end">${value}</text>`;
    })
    .join('');
  const circles = points
    .map((page) => {
      const x = scale(page.searchImpressionSharePercent!, left, right);
      const y = bottom - (page.discoverImpressionSharePercent! / 100) * (bottom - top);
      return `<circle cx="${x}" cy="${y}" r="4"><title>${escapeHtml(page.url)} · Search ${number(page.searchImpressionSharePercent, 2)}% · Discover ${number(page.discoverImpressionSharePercent, 2)}%</title></circle>`;
    })
    .join('');
  return `<section class="plot"><div class="plot-head"><h2>Within-surface page shares</h2><span>${number(points.length)} returned pages</span></div><p>Each point is positioned by its fraction of that surface's usable-URL impression sum. The axes show distribution shares for different Google surfaces, not equivalent exposure or a blended score.</p><div class="plot-wrap"><svg viewBox="0 0 560 370" role="img" aria-label="Search and Discover page metric shares plotted on separate axes">${grid}<line class="diagonal" x1="${left}" y1="${bottom}" x2="${right}" y2="${top}"/>${circles}<text x="289" y="365" text-anchor="middle">Search AI share (%)</text><text transform="translate(15 175) rotate(-90)" text-anchor="middle">Discover share (%)</text></svg></div></section>`;
}

function renderPeriodComparison(comparison: GoogleSurfacePeriodComparison): string {
  const rows = comparison.pages
    .map(
      (page) => `<tr>
    <td class="url">${pageLink(page.url)}</td><td>${escapeHtml(page.state.replace(/-/g, ' '))}</td>
    <td class="search">${number(page.baselineSearchImpressions)} → ${number(page.currentSearchImpressions)}<span class="submetric">${number(page.searchImpressionChange)} impressions · ${number(page.searchShareChangePercentagePoints, 2)} pp share change</span></td>
    <td class="discover">${number(page.baselineDiscoverImpressions)} → ${number(page.currentDiscoverImpressions)}<span class="submetric">${number(page.discoverImpressionChange)} impressions · ${number(page.discoverShareChangePercentagePoints, 2)} pp share change</span></td>
  </tr>`
    )
    .join('');
  const caveats = [
    comparison.baselinePagesTruncated ? 'Baseline matrix was capped at 1,000 URLs.' : undefined,
    comparison.currentPagesTruncated ? 'Current matrix was capped at 1,000 URLs.' : undefined,
    comparison.pagesTruncated ? 'Comparison detail was capped.' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  return `<section class="period"><div class="plot-head"><h2>Page movement across saved periods</h2><span>${number(comparison.pagesPresentInBothReturnedLists)} present in both retained lists</span></div>
    <p>${escapeHtml(comparison.note)}</p><div class="period-stats"><span>Search impression change: <strong>${number(comparison.matchedSearchImpressionChange)}</strong> across ${number(comparison.searchPagesWithComparableImpressions)} URLs</span><span>Discover impression change: <strong>${number(comparison.matchedDiscoverImpressionChange)}</strong> across ${number(comparison.discoverPagesWithComparableImpressions)} URLs</span><span>Search share rose on ${number(comparison.searchPagesWithIncreasingShare)} and fell on ${number(comparison.searchPagesWithDecreasingShare)} comparable URLs</span><span>Discover share rose on ${number(comparison.discoverPagesWithIncreasingShare)} and fell on ${number(comparison.discoverPagesWithDecreasingShare)} comparable URLs</span><span>Current-only URLs: ${number(comparison.pagesOnlyInCurrentReturnedList)}</span><span>Baseline-only URLs: ${number(comparison.pagesOnlyInBaselineReturnedList)}</span></div>
    <div class="table-wrap"><table><caption>Period changes in Google Search and Discover page impressions and within-surface shares</caption><thead><tr><th scope="col">URL</th><th scope="col">Period presence</th><th scope="col">Search change</th><th scope="col">Discover change</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No comparable or retained page rows.</td></tr>'}</tbody></table></div>
    ${caveats ? `<p class="note">${escapeHtml(caveats)}</p>` : ''}<p class="submetric">Baseline: ${escapeHtml(comparison.baselineSearchSourceFile ?? 'Search export')} × ${escapeHtml(comparison.baselineDiscoverSourceFile ?? 'Discover export')} · Current: ${escapeHtml(comparison.currentSearchSourceFile ?? 'Search export')} × ${escapeHtml(comparison.currentDiscoverSourceFile ?? 'Discover export')}</p>
  </section>`;
}

function renderPathFamilies(matrix: GoogleSurfacePageMatrix): string {
  if (
    !matrix.pathFamilies ||
    matrix.pathFamilyDepth === undefined ||
    matrix.pathFamilyCount === undefined
  )
    return '';
  const rows = matrix.pathFamilies
    .map(
      (family) => `<tr>
    <td class="url">${pageLink(family.family)}<span class="submetric">${family.sampleUrls.map(pageLink).join('<br>')}${family.sampleUrlsTruncated ? '<br>more URLs omitted' : ''}</span></td>
    <td>${number(family.pageGroups)}<span class="submetric">${number(family.pagesObservedByBoth)} on both surfaces</span></td>
    <td class="search">${number(family.searchImpressions)}<span class="submetric">${number(family.searchImpressionSharePercent, 2)}% of Search AI</span></td>
    <td class="discover">${number(family.discoverImpressions)}<span class="submetric">${number(family.discoverImpressionSharePercent, 2)}% of Discover AI</span></td>
    <td>${family.searchMinusDiscoverSharePercentagePoints === undefined ? '—' : `${family.searchMinusDiscoverSharePercentagePoints > 0 ? '+' : ''}${number(family.searchMinusDiscoverSharePercentagePoints, 2)} pp`}<span class="submetric">Search share − Discover share</span></td>
    <td>${number(family.pagesWithCurrentAudit)} audit matches · ${number(family.pagesWithAmbiguousCanonical)} ambiguous<span class="submetric">${number(family.googlebotBlockedPages)} Googlebot blocked · ${number(family.pagesWithIndexingRestrictions)} noindex · ${number(family.pagesWithSnippetRestrictions)} snippet restricted</span></td>
  </tr>`
    )
    .join('');
  return `<section class="period"><div class="plot-head"><h2>URL path families</h2><span>${number(matrix.pathFamilyCount)} groups · depth ${number(matrix.pathFamilyDepth)}${matrix.pathFamiliesTruncated ? ' · first 250 shown' : ''}</span></div>
    <p>Families group normalized joined URLs by origin and their first ${number(matrix.pathFamilyDepth)} path segments. Search impressions and Discover impressions use their own sums and shares; path families are descriptive groupings, not content-quality rankings.</p>
    <div class="table-wrap"><table><caption>Google Search and Discover AI metrics, distribution gaps, and current audit context by URL path family</caption><thead><tr><th scope="col">Origin and path prefix · sample URLs</th><th scope="col">Page groups</th><th scope="col">Search AI</th><th scope="col">Discover AI</th><th scope="col">Share gap</th><th scope="col">Current audit snapshot</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="muted">No path families were available.</td></tr>'}</tbody></table></div>
  </section>`;
}

function renderPathFamilyComparison(
  comparison: GoogleSurfacePathFamilyComparison | undefined
): string {
  if (!comparison) return '';
  const rows = comparison.families
    .map(
      (family) => `<tr>
    <td class="url">${pageLink(family.family)}</td><td>${escapeHtml(family.state.replace(/-/g, ' '))}<span class="submetric">${number(family.baselinePageGroups)} → ${number(family.currentPageGroups)} page groups</span></td>
    <td class="search">${number(family.baselineSearchImpressions)} → ${number(family.currentSearchImpressions)}<span class="submetric">${number(family.searchImpressionChange)} impressions · ${number(family.searchImpressionShareChangePercentagePoints, 2)} pp share change</span></td>
    <td class="discover">${number(family.baselineDiscoverImpressions)} → ${number(family.currentDiscoverImpressions)}<span class="submetric">${number(family.discoverImpressionChange)} impressions · ${number(family.discoverImpressionShareChangePercentagePoints, 2)} pp share change</span></td>
  </tr>`
    )
    .join('');
  return `<section class="period"><div class="plot-head"><h2>Path-family movement</h2><span>depth ${number(comparison.pathFamilyDepth)} · ${number(comparison.familiesPresentInBothReturnedLists)} shared</span></div>
    <p>${escapeHtml(comparison.note)}</p><div class="period-stats"><span>${number(comparison.familiesOnlyInCurrentReturnedList)} current-only groups</span><span>${number(comparison.familiesOnlyInBaselineReturnedList)} baseline-only groups</span><span>${comparison.currentFamiliesTruncated ? 'Current list capped at 250 groups.' : ''}</span><span>${comparison.baselineFamiliesTruncated ? 'Baseline list capped at 250 groups.' : ''}</span></div>
    <div class="table-wrap"><table><caption>Google Search and Discover metrics by path-family period changes</caption><thead><tr><th scope="col">Origin and path prefix</th><th scope="col">Period presence</th><th scope="col">Search change</th><th scope="col">Discover change</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No path-family comparison rows.</td></tr>'}</tbody></table></div>
  </section>`;
}

/** Render a self-contained Google Search / Discover page matrix. */
export function renderGoogleSurfaceMatrixHtml(matrix: GoogleSurfacePageMatrix): string {
  const rows = matrix.pages.map(renderPage).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Google AI surface matrix · Aviary GEO</title><style>
    :root{--ink:#162c31;--muted:#627477;--line:#c8d3d0;--paper:#f4f4ee;--panel:#fffefa;--search:#285f78;--discover:#287257;--accent:#ad553d;--mono:ui-monospace,Consolas,monospace;--serif:Georgia,serif}*{box-sizing:border-box}body{margin:0;background:linear-gradient(140deg,#e7efea,var(--paper) 35%);color:var(--ink);font-family:var(--serif)}main{max-width:1500px;margin:auto;padding:clamp(18px,4vw,56px)}a{color:var(--search);overflow-wrap:anywhere;text-underline-offset:3px}:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.mast{border-top:5px solid var(--ink);border-bottom:1px solid var(--ink);padding:12px 0;font:10px var(--mono);text-transform:uppercase;letter-spacing:.1em}.mast strong{color:var(--discover)}h1{font:400 clamp(42px,7vw,82px)/.95 var(--serif);letter-spacing:-.05em;margin:48px 0 14px}h1 em{color:var(--discover)}.lede,.note{max-width:960px;color:var(--muted);font:12px/1.7 var(--mono)}.stats{display:grid;grid-template-columns:repeat(4,1fr);margin:35px 0 18px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.stat{padding:18px;border-right:1px solid var(--line)}.stat:last-child{border:0}.stat strong{display:block;font:32px var(--serif);color:var(--discover)}.stat span,.submetric{display:block;margin-top:5px;color:var(--muted);font:9px/1.5 var(--mono);text-transform:uppercase}.totals{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{background:var(--panel);padding:18px;border:1px solid var(--line)}.card.search{border-left:4px solid var(--search)}.card.discover{border-left:4px solid var(--discover)}.card h2{font:400 20px var(--serif);margin:0 0 6px}.card p{font:10px/1.5 var(--mono);color:var(--muted)}.overlap{display:flex;gap:15px;flex-wrap:wrap;margin:15px 0;padding:14px 0;border-bottom:1px solid var(--line);font:10px var(--mono);color:var(--muted)}.overlap strong{color:var(--ink)}.plot{margin:28px 0;padding:20px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.plot h2{font:400 24px var(--serif);margin:0}.plot-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.plot-head span{font:9px var(--mono);color:var(--muted)}.plot p{font:10px/1.6 var(--mono);color:var(--muted)}.plot-wrap{max-width:750px;margin:auto}.plot svg{width:100%;height:auto}.grid{stroke:#dce2dd}.diagonal{stroke:var(--accent);stroke-dasharray:6 5}.plot circle{fill:var(--discover);stroke:white;stroke-width:1.3;opacity:.82}.plot text{fill:var(--muted);font:9px var(--mono)}.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:25px 0 12px}.toolbar label{font:700 9px var(--mono);text-transform:uppercase}.toolbar input,.toolbar select{padding:10px 12px;min-height:40px;border:1px solid var(--line);background:var(--panel);font:11px var(--mono);color:var(--ink)}.toolbar input{width:min(400px,100%)}.table-wrap{overflow:auto;border:1px solid var(--line);background:var(--panel)}table{border-collapse:collapse;width:100%;min-width:1150px;font-size:12px}caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}th{position:sticky;top:0;background:var(--ink);color:white;padding:11px;text-align:left;font:9px var(--mono);text-transform:uppercase;z-index:1}td{padding:12px;border-top:1px solid var(--line);vertical-align:top;line-height:1.45}tr:hover{background:#edf2ec}.url{min-width:260px;max-width:360px;overflow-wrap:anywhere}.metric{font:15px var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}.search{color:var(--search)}.discover{color:var(--discover)}.coverage{display:inline-block;padding:4px 7px;border:1px solid var(--line);font:8px var(--mono);text-transform:uppercase}.coverage-search-and-discover{background:#e2efe7;color:#255744}.coverage-search-only{background:#e3edf2;color:#24536b}.coverage-discover-only{background:#e7efe2;color:#42643c}details summary{cursor:pointer;color:var(--search);font:9px var(--mono)}details ul{padding-left:15px}details li{margin:5px 0;overflow-wrap:anywhere}.muted{color:var(--muted)}hr{border:0;border-top:1px solid var(--line);margin:9px 0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}footer{display:flex;justify-content:space-between;gap:16px;margin-top:35px;padding:15px 0;border-top:1px solid var(--ink);font:9px var(--mono);color:var(--muted)}
    @media(max-width:700px){main{padding:18px}.stats{grid-template-columns:repeat(2,1fr)}.stat:nth-child(2){border-right:0}.stat:nth-child(n+3){border-top:1px solid var(--line)}.totals{grid-template-columns:1fr}footer{flex-direction:column}}
  </style><style>.period{margin:28px 0;padding:20px 0;border-top:1px solid #c8d3d0;border-bottom:1px solid #c8d3d0}.period h2{font:400 24px Georgia,serif;margin:0}.period-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;padding:14px;background:#fffefa;font:10px/1.5 ui-monospace,Consolas,monospace;color:#627477}.period-stats strong{color:#162c31}.period table{min-width:800px}@media(max-width:700px){.period-stats{grid-template-columns:1fr}}</style></head><body><main><header class="mast"><strong>Aviary</strong> · Google AI surface matrix · local export review</header><h1>Two surfaces,<br><em>page by page.</em></h1><p class="lede">Search Console Search generative AI and Discover generative AI impressions joined by page URL. Search and Discover retain separate counts and within-surface shares; absent export rows stay unknown rather than zero.</p>
    <section class="stats"><article class="stat"><strong>${number(matrix.pagesObservedByBoth)}</strong><span>URLs in both exports</span></article><article class="stat"><strong>${number(matrix.pagesOnlyInSearchExport)}</strong><span>Search export only</span></article><article class="stat"><strong>${number(matrix.pagesOnlyInDiscoverExport)}</strong><span>Discover export only</span></article><article class="stat"><strong>${number(matrix.pages.length)}${matrix.pagesTruncated ? '+' : ''}</strong><span>URL rows${matrix.pagesTruncated ? ' · capped' : ''}</span></article></section>
    <section class="totals"><article class="card search"><h2>Search AI</h2><p>${number(matrix.searchPages)} page URLs · ${number(matrix.searchExportRowSummedImpressions)} export-row impressions · ${number(matrix.searchUsableUrlImpressions)} usable-URL impressions</p></article><article class="card discover"><h2>Discover AI</h2><p>${number(matrix.discoverPages)} page URLs · ${number(matrix.discoverExportRowSummedImpressions)} export-row impressions · ${number(matrix.discoverUsableUrlImpressions)} usable-URL impressions</p></article></section>
    <div class="overlap"><span>Search share on both URL groups: <strong>${number(matrix.searchImpressionShareOnBothPagesPercent, 2)}%</strong></span><span>Discover share on both URL groups: <strong>${number(matrix.discoverImpressionShareOnBothPagesPercent, 2)}%</strong></span><span>${number(matrix.pagesWithComparableShares)} returned pages with both shares</span><span>${number(matrix.rowsWithoutUsableUrl.searchRows)} Search and ${number(matrix.rowsWithoutUsableUrl.discoverRows)} Discover rows excluded for unusable URLs</span></div>
    ${renderSharePlot(matrix)}${renderPathFamilies(matrix)}${matrix.periodComparison ? renderPeriodComparison(matrix.periodComparison) : ''}${renderPathFamilyComparison(matrix.periodComparison?.pathFamilyComparison)}<div class="toolbar"><label for="query">Page</label><input id="query" type="search" placeholder="Search page URL or audit signal"><label for="coverage">Coverage</label><select id="coverage"><option value="all">All pages</option><option value="search-and-discover">Both surfaces</option><option value="search-only">Search only</option><option value="discover-only">Discover only</option></select><label for="audit">Audit</label><select id="audit"><option value="all">All</option><option value="matched">Audit matched</option><option value="not-assessed">No audit match</option></select><label for="controls">Current controls</label><select id="controls"><option value="all">All controls</option><option value="googlebot-blocked">Googlebot blocked</option><option value="indexing-restricted">Indexing restricted</option><option value="snippet-restricted">Snippet restricted</option></select><label for="order">Order</label><select id="order"><option value="url">URL A–Z</option><option value="gap">Largest absolute share gap</option><option value="search">Most Search impressions</option><option value="discover">Most Discover impressions</option></select></div>
    <div class="table-wrap"><table><caption>Per-page Google Search and Discover AI impression counts, within-surface shares, current audit signals, and source URL aliases</caption><thead><tr><th scope="col">Page URL</th><th scope="col">Coverage</th><th scope="col" class="metric">Search impressions</th><th scope="col" class="metric">Discover impressions</th><th scope="col" class="metric">Share gap</th><th scope="col">Current audit snapshot</th><th scope="col">Source export URLs</th></tr></thead><tbody id="matrix-body">${rows || '<tr><td colspan="7" class="muted">No usable page URLs were available.</td></tr>'}</tbody></table></div>
    <p class="note">${escapeHtml(matrix.note)}${matrix.pagesTruncated ? ' Detail is capped at 1,000 page rows; coverage summaries count the full URL union.' : ''}</p><footer><span>Generated locally by Aviary · no remote scripts, styles, or data requests</span><span>${escapeHtml(matrix.searchSourceFile ?? 'Search export')} × ${escapeHtml(matrix.discoverSourceFile ?? 'Discover export')}</span></footer>
  </main><script>
    const query=document.querySelector('#query'),coverage=document.querySelector('#coverage'),audit=document.querySelector('#audit'),controls=document.querySelector('#controls'),order=document.querySelector('#order'),body=document.querySelector('#matrix-body');const rows=[...body.querySelectorAll('tr[data-url]')];const original=new Map(rows.map((row,index)=>[row,index]));const apply=()=>{const term=query.value.trim().toLowerCase();const controlKey=controls.value==='googlebot-blocked'?'googlebotBlocked':controls.value==='indexing-restricted'?'indexingRestricted':controls.value==='snippet-restricted'?'snippetRestricted':undefined;rows.forEach(row=>{row.hidden=!(row.dataset.search.includes(term)&&(coverage.value==='all'||row.dataset.coverage===coverage.value)&&(audit.value==='all'||row.dataset.audit===audit.value)&&(!controlKey||row.dataset[controlKey]==='true'));});const key=order.value==='gap'?'gap':order.value==='search'?'searchShare':order.value==='discover'?'discoverShare':undefined;[...rows].sort((a,b)=>key?Number(b.dataset[key]||-1)-Number(a.dataset[key]||-1)||original.get(a)-original.get(b):(a.dataset.url||'').localeCompare(b.dataset.url||'')).forEach(row=>body.append(row));};query.addEventListener('input',apply);coverage.addEventListener('change',apply);audit.addEventListener('change',apply);controls.addEventListener('change',apply);order.addEventListener('change',apply);
  </script></body></html>`;
}

/** Render spreadsheet-safe CSV from the bounded Search/Discover page matrix. */
export function renderGoogleSurfaceMatrixCsv(matrix: GoogleSurfacePageMatrix): string {
  const headers = [
    'url',
    'path_family',
    'coverage',
    'search_ai_impressions',
    'search_within_surface_share_percent',
    'discover_ai_impressions',
    'discover_within_surface_share_percent',
    'search_minus_discover_share_gap_percentage_points',
    'current_audit_match_type',
    'current_audit_url',
    'current_googlebot_access',
    'current_noindex',
    'current_nosnippet',
    'current_max_snippet_zero',
    'current_data_nosnippet_elements',
    'current_document_language',
    'current_document_language_valid',
    'search_source_urls_json',
    'search_source_urls_truncated',
    'discover_source_urls_json',
    'discover_source_urls_truncated',
  ];
  const comparison = matrix.periodComparison;
  if (comparison)
    headers.push(
      'period_state',
      'baseline_search_impressions',
      'current_search_impressions',
      'search_impression_change',
      'search_share_change_percentage_points',
      'baseline_discover_impressions',
      'current_discover_impressions',
      'discover_impression_change',
      'discover_share_change_percentage_points'
    );
  const currentByUrl = new Map(matrix.pages.map((page) => [page.url, page]));
  const periodByUrl = new Map((comparison?.pages ?? []).map((page) => [page.url, page]));
  const urls = comparison
    ? comparison.pages.map((page) => page.url)
    : matrix.pages.map((page) => page.url);
  const rows = urls.map((url) => {
    const page = currentByUrl.get(url);
    const row: unknown[] = [
      url,
      page?.pathFamily,
      page?.coverage,
      page?.searchImpressions,
      page?.searchImpressionSharePercent,
      page?.discoverImpressions,
      page?.discoverImpressionSharePercent,
      page?.searchMinusDiscoverSharePercentagePoints,
      page?.currentAudit?.matchType,
      page?.currentAudit?.auditUrl,
      page?.currentAudit?.googlebotAccess,
      page?.currentAudit?.noindex,
      page?.currentAudit?.noSnippet,
      page?.currentAudit?.maxSnippetZero,
      page?.currentAudit?.dataNoSnippetElements,
      page?.currentAudit?.documentLanguage,
      page?.currentAudit?.documentLanguageValid,
      page ? JSON.stringify(page.searchSourceUrls) : undefined,
      page?.searchSourceUrlsTruncated,
      page ? JSON.stringify(page.discoverSourceUrls) : undefined,
      page?.discoverSourceUrlsTruncated,
    ];
    if (comparison) {
      const period = periodByUrl.get(url);
      row.push(
        period?.state,
        period?.baselineSearchImpressions,
        period?.currentSearchImpressions,
        period?.searchImpressionChange,
        period?.searchShareChangePercentagePoints,
        period?.baselineDiscoverImpressions,
        period?.currentDiscoverImpressions,
        period?.discoverImpressionChange,
        period?.discoverShareChangePercentagePoints
      );
    }
    return row.map(csvCell).join(',');
  });
  return [headers.map(csvCell).join(','), ...rows].join('\n') + '\n';
}

/** Render one spreadsheet-safe row per retained Google Search/Discover path family. */
export function renderGoogleSurfacePathFamilyCsv(matrix: GoogleSurfacePageMatrix): string {
  const headers = [
    'path_family',
    'page_groups',
    'search_pages',
    'discover_pages',
    'pages_on_both_surfaces',
    'search_ai_impressions',
    'search_within_surface_share_percent',
    'discover_ai_impressions',
    'discover_within_surface_share_percent',
    'search_minus_discover_share_gap_percentage_points',
    'pages_with_current_audit_match',
    'pages_with_ambiguous_canonical',
    'googlebot_blocked_pages',
    'pages_with_indexing_restrictions',
    'pages_with_snippet_restrictions',
    'sample_urls_json',
    'sample_urls_truncated',
    'period_state',
    'baseline_page_groups',
    'current_page_groups',
    'baseline_search_impressions',
    'current_search_impressions',
    'search_impression_change',
    'baseline_search_share_percent',
    'current_search_share_percent',
    'search_share_change_percentage_points',
    'baseline_discover_impressions',
    'current_discover_impressions',
    'discover_impression_change',
    'baseline_discover_share_percent',
    'current_discover_share_percent',
    'discover_share_change_percentage_points',
  ];
  const families = matrix.pathFamilies ?? [];
  const currentByFamily = new Map(families.map((family) => [family.family, family]));
  const comparison = matrix.periodComparison?.pathFamilyComparison;
  const familyRows: GoogleSurfacePathFamilyPeriodChange[] =
    comparison?.families ??
    families.map((family) => ({ family: family.family, state: 'current-only' }));
  const rows = familyRows.map((change) => {
    const current = currentByFamily.get(change.family);
    const row: unknown[] = [
      change.family,
      current?.pageGroups,
      current?.searchPages,
      current?.discoverPages,
      current?.pagesObservedByBoth,
      current?.searchImpressions,
      current?.searchImpressionSharePercent,
      current?.discoverImpressions,
      current?.discoverImpressionSharePercent,
      current?.searchMinusDiscoverSharePercentagePoints,
      current?.pagesWithCurrentAudit,
      current?.pagesWithAmbiguousCanonical,
      current?.googlebotBlockedPages,
      current?.pagesWithIndexingRestrictions,
      current?.pagesWithSnippetRestrictions,
      current ? JSON.stringify(current.sampleUrls) : undefined,
      current?.sampleUrlsTruncated,
      comparison ? change.state : matrix.periodComparison ? 'not-compared' : 'current',
      change.baselinePageGroups,
      change.currentPageGroups,
      change.baselineSearchImpressions,
      change.currentSearchImpressions,
      change.searchImpressionChange,
      change.baselineSearchImpressionSharePercent,
      change.currentSearchImpressionSharePercent,
      change.searchImpressionShareChangePercentagePoints,
      change.baselineDiscoverImpressions,
      change.currentDiscoverImpressions,
      change.discoverImpressionChange,
      change.baselineDiscoverImpressionSharePercent,
      change.currentDiscoverImpressionSharePercent,
      change.discoverImpressionShareChangePercentagePoints,
    ];
    return row.map(csvCell).join(',');
  });
  return [headers.map(csvCell).join(','), ...rows].join('\n') + '\n';
}
