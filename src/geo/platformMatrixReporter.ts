import type {
  AiPlatformCurrentAuditExposure,
  AiPlatformPageMatrix,
  AiPlatformPageMatrixComparison,
  AiPlatformPageObservation,
  CurrentGEOPageAuditSignals,
} from './platformMatrix';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safePageUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || (!url.username && !url.password))
      return value;
    url.username = '';
    url.password = '';
    return url.href;
  } catch {
    return value;
  }
}

function pageLink(value: string): string {
  try {
    const safeValue = safePageUrl(value);
    const url = new URL(safeValue);
    if (!['http:', 'https:'].includes(url.protocol)) return escapeHtml(safeValue);
    return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escapeHtml(safeValue)}</a>`;
  } catch {
    return escapeHtml(safePageUrl(value));
  }
}

function number(value: number | undefined, digits = 0): string {
  return value === undefined
    ? '—'
    : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && /^[=+@-]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Render one spreadsheet-safe CSV row per page in the bounded GEO matrix. */
export function renderAiPlatformPageMatrixCsv(
  matrix: AiPlatformPageMatrix,
  comparison?: AiPlatformPageMatrixComparison
): string {
  const headers = [
    'url',
    'path_family',
    'coverage',
    'google_ai_impressions',
    'google_within_export_share_percent',
    'bing_ai_citations',
    'bing_within_export_share_percent',
    'google_minus_bing_share_gap_percentage_points',
    'bing_cited_pages',
    'bing_average_citation_share_percent',
    'googlebot_access',
    'googlebot_noindex',
    'googlebot_nosnippet',
    'googlebot_max_snippet_zero',
    'bingbot_access',
    'bingbot_noindex',
    'bingbot_nosnippet',
    'bingbot_max_snippet_zero',
    'data_nosnippet_elements',
    'data_nosnippet_words',
    'audit_url',
    'question_headings',
    'concise_answer_blocks',
    'external_content_links',
    'external_source_links',
    'reference_section_links',
    'visible_author',
    'visible_date',
    'document_language',
    'document_language_valid',
    'google_source_urls_json',
    'google_source_urls_truncated',
    'bing_source_urls_json',
    'bing_source_urls_truncated',
    'sitemap_membership_state',
    'sitemap_matched_via',
  ];
  if (comparison)
    headers.push(
      'period_state',
      'baseline_google_ai_impressions',
      'current_google_ai_impressions',
      'google_ai_impression_change',
      'google_impression_share_change_percentage_points',
      'baseline_bing_ai_citations',
      'current_bing_ai_citations',
      'bing_ai_citation_change',
      'bing_citation_share_change_percentage_points'
    );
  const periodByUrl = new Map((comparison?.pages ?? []).map((change) => [change.url, change]));
  const familyPeriodByName = new Map(
    (comparison?.pathFamilyComparison?.families ?? []).map((change) => [change.family, change])
  );
  if (comparison?.pathFamilyComparison)
    headers.push(
      'path_family_period_state',
      'baseline_family_google_impressions',
      'current_family_google_impressions',
      'family_google_impression_change',
      'family_google_impression_share_change_percentage_points',
      'baseline_family_bing_citations',
      'current_family_bing_citations',
      'family_bing_citation_change',
      'family_bing_citation_share_change_percentage_points'
    );
  const rows = matrix.pages.map((page) => {
    const audit = page.currentAuditSignals;
    const content = audit?.pageContent;
    const row = [
      safePageUrl(page.url),
      page.pathFamily,
      page.coverage,
      page.googleSearchAiImpressions,
      page.googleImpressionSharePercent,
      page.bingAiCitations,
      page.bingCitationSharePercent,
      page.platformShareGapPercentagePoints,
      page.bingCitedPages,
      page.bingAverageCitationShare,
      audit?.googlebot.access,
      audit?.googlebot.noindex,
      audit?.googlebot.noSnippet,
      audit?.googlebot.maxSnippetZero,
      audit?.bingbot.access,
      audit?.bingbot.noindex,
      audit?.bingbot.noSnippet,
      audit?.bingbot.maxSnippetZero,
      audit?.dataNoSnippetElements,
      audit?.dataNoSnippetWords,
      audit?.auditUrl ? safePageUrl(audit.auditUrl) : undefined,
      content?.questionHeadings,
      content?.conciseAnswerBlocks,
      content?.externalContentLinks,
      content?.externalSourceLinks,
      content?.referenceSectionLinks,
      content?.visibleAuthor,
      content?.visibleDate,
      content?.documentLanguage,
      content?.documentLanguageValid,
      JSON.stringify(page.googleSourceUrls.map(safePageUrl)),
      page.googleSourceUrlsTruncated,
      JSON.stringify(page.bingSourceUrls.map(safePageUrl)),
      page.bingSourceUrlsTruncated,
      page.sitemapMembership?.state,
      page.sitemapMembership?.matchedVia,
    ];
    const period = periodByUrl.get(page.url);
    if (comparison)
      row.push(
        period?.state,
        period?.baselineGoogleImpressions,
        period?.currentGoogleImpressions,
        period?.googleImpressionChange,
        period?.googleImpressionShareChangePercentagePoints,
        period?.baselineBingCitations,
        period?.currentBingCitations,
        period?.bingCitationChange,
        period?.bingCitationShareChangePercentagePoints
      );
    if (comparison?.pathFamilyComparison) {
      const familyPeriod = page.pathFamily ? familyPeriodByName.get(page.pathFamily) : undefined;
      row.push(
        familyPeriod?.state,
        familyPeriod?.baselineGoogleImpressions,
        familyPeriod?.currentGoogleImpressions,
        familyPeriod?.googleImpressionChange,
        familyPeriod?.googleImpressionShareChangePercentagePoints,
        familyPeriod?.baselineBingCitations,
        familyPeriod?.currentBingCitations,
        familyPeriod?.bingCitationChange,
        familyPeriod?.bingCitationShareChangePercentagePoints
      );
    }
    return row.map(csvCell).join(',');
  });
  return [headers.map(csvCell).join(','), ...rows].join('\n') + '\n';
}

function botSignal(bot: CurrentGEOPageAuditSignals['googlebot'], label: string): string {
  const state = `<span class="state state-${bot.access}">${escapeHtml(bot.access)}</span>`;
  const controls = [
    bot.noindex === true ? 'noindex' : undefined,
    bot.noSnippet === true ? 'nosnippet' : undefined,
    bot.maxSnippetZero === true ? 'max-snippet:0' : undefined,
  ].filter((value): value is string => Boolean(value));
  return `<div class="bot-cell"><span class="bot-name">${escapeHtml(label)}</span>${state}${controls.length ? `<span class="control-list">${controls.map(escapeHtml).join(' · ')}</span>` : ''}</div>`;
}

function sourceList(label: string, urls: string[], truncated: boolean): string {
  if (!urls.length) return '<span class="muted">—</span>';
  return `<details class="source-details"><summary>${urls.length}${truncated ? '+' : ''} source URL${urls.length === 1 && !truncated ? '' : 's'}</summary><ul>${urls.map((url) => `<li>${pageLink(url)}</li>`).join('')}</ul>${truncated ? '<p class="muted">Source list capped at 10 URLs.</p>' : ''}<span class="sr-only">${escapeHtml(label)}</span></details>`;
}

function renderRow(page: AiPlatformPageObservation): string {
  const audit = page.currentAuditSignals;
  const googleBot = audit
    ? botSignal(audit.googlebot, 'Googlebot')
    : '<span class="muted">No audit data</span>';
  const bingBot = audit
    ? botSignal(audit.bingbot, 'bingbot')
    : '<span class="muted">No audit data</span>';
  const dataNoSnippet =
    audit?.dataNoSnippetElements === undefined
      ? 'not assessed'
      : `${number(audit.dataNoSnippetElements)} region${audit.dataNoSnippetElements === 1 ? '' : 's'}${audit.dataNoSnippetWords === undefined ? '' : ` · ${number(audit.dataNoSnippetWords)} words`}`;
  const crawlerControls = audit
    ? [
        audit.googlebot.noindex ? 'googlebot noindex' : '',
        audit.googlebot.noSnippet ? 'googlebot nosnippet' : '',
        audit.googlebot.maxSnippetZero ? 'googlebot max-snippet:0' : '',
        audit.bingbot.noindex ? 'bingbot noindex' : '',
        audit.bingbot.noSnippet ? 'bingbot nosnippet' : '',
        audit.bingbot.maxSnippetZero ? 'bingbot max-snippet:0' : '',
      ].join(' ')
    : '';
  const content = audit?.pageContent;
  const contentSignals = content
    ? [
        content.questionHeadings !== undefined
          ? `${number(content.questionHeadings)} question headings`
          : undefined,
        content.conciseAnswerBlocks !== undefined
          ? `${number(content.conciseAnswerBlocks)} concise answers`
          : undefined,
        content.externalContentLinks !== undefined
          ? `${number(content.externalContentLinks)} external content links`
          : undefined,
        content.externalSourceLinks !== undefined
          ? `${number(content.externalSourceLinks)} source links`
          : undefined,
        content.referenceSectionLinks !== undefined
          ? `${number(content.referenceSectionLinks)} reference links`
          : undefined,
        content.visibleAuthor !== undefined
          ? `author ${content.visibleAuthor ? 'visible' : 'not observed'}`
          : undefined,
        content.visibleDate !== undefined
          ? `date ${content.visibleDate ? 'visible' : 'not observed'}`
          : undefined,
        content.documentLanguage !== undefined
          ? `document language ${content.documentLanguage}`
          : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ') || 'content signals assessed'
    : 'not assessed';
  const search = [
    safePageUrl(page.url),
    page.pathFamily,
    page.coverage,
    audit?.auditUrl ? safePageUrl(audit.auditUrl) : undefined,
    page.sitemapMembership?.state,
    page.sitemapMembership?.matchedVia,
    ...page.googleSourceUrls.map(safePageUrl),
    ...page.bingSourceUrls.map(safePageUrl),
    audit?.googlebot.access,
    audit?.bingbot.access,
    crawlerControls,
    contentSignals,
    content?.documentLanguageValid === false ? 'invalid declared document language tag' : '',
    dataNoSnippet,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const gap = page.platformShareGapPercentagePoints;
  const absoluteGap = gap === undefined ? '' : Math.abs(gap);
  const crawlerBlocked =
    audit?.googlebot.access === 'blocked' || audit?.bingbot.access === 'blocked';
  const indexingRestricted = audit?.googlebot.noindex === true || audit?.bingbot.noindex === true;
  const snippetRestricted =
    audit?.googlebot.noSnippet === true ||
    audit?.googlebot.maxSnippetZero === true ||
    audit?.bingbot.noSnippet === true ||
    audit?.bingbot.maxSnippetZero === true ||
    (audit?.dataNoSnippetElements ?? 0) > 0;
  const invalidLanguage = content?.documentLanguageValid === false;
  const sitemapState =
    page.sitemapMembership?.state === 'found-in-supplied-sitemap-list'
      ? 'listed'
      : page.sitemapMembership?.state === 'possible-match-source-list-truncated'
        ? 'possible'
        : page.sitemapMembership
          ? 'not-listed'
          : 'not-assessed';
  const sitemapCell = !page.sitemapMembership
    ? '<span class="muted">not assessed</span>'
    : `<span class="coverage ${sitemapState === 'listed' ? 'coverage-both-observed' : sitemapState === 'possible' ? 'coverage-google-export-only' : 'coverage-bing-export-only'}">${sitemapState === 'listed' ? 'listed' : sitemapState === 'possible' ? 'possible alias' : 'not found'}</span>${page.sitemapMembership.matchedVia ? `<span class="submetric">via ${escapeHtml(page.sitemapMembership.matchedVia)}</span>` : sitemapState === 'possible' ? '<span class="submetric">source alias list capped</span>' : ''}`;
  return `<tr data-coverage="${escapeHtml(page.coverage)}" data-audit="${Boolean(audit)}" data-crawler-blocked="${crawlerBlocked}" data-indexing-restricted="${indexingRestricted}" data-snippet-restricted="${snippetRestricted}" data-language-invalid="${invalidLanguage}" data-sitemap="${sitemapState}" data-share-gap="${absoluteGap}" data-google-impressions="${page.googleSearchAiImpressions ?? ''}" data-bing-citations="${page.bingAiCitations ?? ''}" data-url="${escapeHtml(safePageUrl(page.url))}" data-search="${escapeHtml(search)}">
    <td class="url-cell">${pageLink(page.url)}${audit ? `<details class="audit-url"><summary>Current audit</summary>${pageLink(audit.auditUrl)}</details>` : ''}</td>
    <td class="path-family-cell">${page.pathFamily ? pageLink(page.pathFamily) : '<span class="muted">not grouped</span>'}</td>
    <td><span class="coverage coverage-${page.coverage}">${escapeHtml(page.coverage.replace(/-/g, ' '))}</span></td>
    <td class="metric google-metric">${number(page.googleSearchAiImpressions)}${page.googleImpressionSharePercent === undefined ? '' : `<span class="submetric">${number(page.googleImpressionSharePercent, 2)}% of usable-URL impressions</span>`}</td>
    <td class="metric bing-metric">${number(page.bingAiCitations)}${page.bingCitationSharePercent === undefined ? '' : `<span class="submetric">${number(page.bingCitationSharePercent, 2)}% of usable-URL citations</span>`}${page.bingCitedPages === undefined ? '' : `<span class="submetric">${number(page.bingCitedPages)} cited-page observations</span>`}${page.bingAverageCitationShare === undefined ? '' : `<span class="submetric">${number(page.bingAverageCitationShare, 1)}% average citation share</span>`}</td>
    <td class="metric">${gap === undefined ? '<span class="muted">—</span>' : `${gap > 0 ? '+' : ''}${number(gap, 2)} pp`}<span class="submetric">Google share − Bing share</span></td>
    <td>${googleBot}</td>
    <td>${bingBot}</td>
    <td class="sources-cell">${sourceList('Google source URLs', page.googleSourceUrls, page.googleSourceUrlsTruncated)}<div class="source-separator"></div>${sourceList('Bing source URLs', page.bingSourceUrls, page.bingSourceUrlsTruncated)}</td>
    <td class="content-cell">${escapeHtml(contentSignals)}</td>
    <td>${escapeHtml(dataNoSnippet)}</td>
    <td>${sitemapCell}</td>
  </tr>`;
}

function renderPathFamilyAnalysis(matrix: AiPlatformPageMatrix): string {
  if (
    !matrix.pathFamilies ||
    matrix.pathFamilyDepth === undefined ||
    matrix.pathFamilyCount === undefined
  )
    return '';
  const rows = matrix.pathFamilies
    .map(
      (group) => `<tr>
    <td class="path-family-cell">${pageLink(group.family)}<span class="submetric">${number(group.joinedPageGroups)} joined URL groups</span></td>
    <td>${number(group.googlePageGroups)} Google · ${number(group.bingPageGroups)} Bing<span class="submetric">${number(group.pagesObservedByBoth)} in both exports</span></td>
    <td class="metric google-metric">${number(group.googleImpressions)}${group.googleImpressionSharePercent === undefined ? '' : `<span class="submetric">${number(group.googleImpressionSharePercent, 2)}% of Google usable-URL sum</span>`}</td>
    <td class="metric bing-metric">${number(group.bingCitations)}${group.bingCitationSharePercent === undefined ? '' : `<span class="submetric">${number(group.bingCitationSharePercent, 2)}% of Bing usable-URL sum</span>`}</td>
    <td>${number(group.pagesWithCurrentAudit)} audited<span class="submetric">Googlebot blocked ${number(group.googlebotBlockedPages)} · Bingbot blocked ${number(group.bingbotBlockedPages)}</span><span class="submetric">indexing restrictions ${number(group.pagesWithIndexingRestrictions)} · snippet restrictions ${number(group.pagesWithSnippetRestrictions)}</span></td>
    <td><details class="source-details"><summary>${group.sampleUrlsTruncated ? `${number(group.sampleUrls.length)}+` : number(group.sampleUrls.length)} sample URL${group.sampleUrls.length === 1 && !group.sampleUrlsTruncated ? '' : 's'}</summary><ul>${group.sampleUrls.map((url) => `<li>${pageLink(url)}</li>`).join('')}</ul></details></td>
  </tr>`
    )
    .join('');
  return `<section class="path-family-report" aria-labelledby="path-family-title"><div class="share-plot-head"><h2 id="path-family-title">Observed URL path families</h2><span>${number(matrix.pathFamilyCount)} groups · first ${matrix.pathFamilyDepth} segment${matrix.pathFamilyDepth === 1 ? '' : 's'}${matrix.pathFamiliesTruncated ? ` · first ${number(matrix.pathFamilies.length)} shown` : ''}</span></div><p>Each family is grouped by URL origin and the selected path prefix. Platform page counts and metric sums stay separate. This describes only the supplied export observations; current control data is an audit-time snapshot and does not explain the platform rows.</p><div class="table-wrap"><table><caption>Google and Bing GEO observations by URL origin and path prefix</caption><thead><tr><th scope="col">Path family</th><th scope="col">Page coverage</th><th scope="col" class="metric">Google impressions</th><th scope="col" class="metric">Bing citations</th><th scope="col">Current audit controls</th><th scope="col">Sample URLs</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No URL families were available.</td></tr>'}</tbody></table></div></section>`;
}

function renderCurrentAuditExposure(exposure: AiPlatformCurrentAuditExposure | undefined): string {
  if (!exposure) return '';
  const labels: Record<AiPlatformCurrentAuditExposure['controls'][number]['control'], string> = {
    'googlebot-currently-blocked': 'Googlebot currently blocked',
    'bingbot-currently-blocked': 'bingbot currently blocked',
    'indexing-restricted': 'Observed noindex control',
    'snippet-restricted': 'Observed snippet restriction',
    'data-nosnippet-present': 'Visible data-nosnippet regions',
  };
  const rows = exposure.controls
    .map(
      (control) => `<tr>
    <td>${escapeHtml(labels[control.control])}</td>
    <td class="metric">${number(control.pages)} / ${number(control.pagesAssessed)}<span class="submetric">observed / assessed</span></td>
    <td class="metric google-metric">${control.googleImpressionSharePercent === undefined ? '—' : `${number(control.googleImpressionSharePercent, 2)}%`}</td>
    <td class="metric bing-metric">${control.bingCitationSharePercent === undefined ? '—' : `${number(control.bingCitationSharePercent, 2)}%`}</td>
  </tr>`
    )
    .join('');
  return `<section class="audit-exposure-report" aria-labelledby="audit-exposure-title"><div class="share-plot-head"><h2 id="audit-exposure-title">Current controls on observed URL groups</h2><span>${number(exposure.pagesWithCurrentAudit)} / ${number(exposure.joinedPageGroups)} have current audit signals</span></div><p>${escapeHtml(exposure.note)} Access was assessed on ${number(exposure.googlebotAccessAssessedPages)} Googlebot and ${number(exposure.bingbotAccessAssessedPages)} bingbot page groups. Other control rows show observed-positive groups over groups with that specific signal measured.</p><div class="table-wrap"><table><caption>Current audit control groups and their separate platform metric shares</caption><thead><tr><th scope="col">Current audit observation</th><th scope="col" class="metric">Observed / assessed groups</th><th scope="col" class="metric">Google impression share</th><th scope="col" class="metric">Bing citation share</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderShareDistributionPlot(pages: AiPlatformPageObservation[]): string {
  const points = pages.filter(
    (page) =>
      page.googleImpressionSharePercent !== undefined && page.bingCitationSharePercent !== undefined
  );
  if (points.length === 0) {
    return '<section class="share-plot" aria-labelledby="share-plot-title"><h2 id="share-plot-title">Within-export page share map</h2><p>No URLs have both platform shares measured.</p></section>';
  }
  const left = 58;
  const right = 520;
  const top = 30;
  const bottom = 330;
  const xPosition = (value: number) => left + (value / 100) * (right - left);
  const yPosition = (value: number) => bottom - (value / 100) * (bottom - top);
  const grid = [0, 25, 50, 75, 100]
    .map((value) => {
      const x = xPosition(value);
      const y = yPosition(value);
      return `<line class="grid-line" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"/><line class="grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="axis-tick" x="${x}" y="${bottom + 18}" text-anchor="middle">${value}</text><text class="axis-tick" x="${left - 12}" y="${y + 3}" text-anchor="end">${value}</text>`;
    })
    .join('');
  const circles = points
    .map((page) => {
      const google = page.googleImpressionSharePercent!;
      const bing = page.bingCitationSharePercent!;
      const signedGap = page.platformShareGapPercentagePoints ?? google - bing;
      const gap = Math.abs(signedGap);
      const gapClass = gap >= 15 ? 'gap-large' : gap >= 5 ? 'gap-medium' : 'gap-small';
      const title = `${safePageUrl(page.url)} — Google ${number(google, 2)}% of usable-URL impressions; Bing ${number(bing, 2)}% of usable-URL citations; share gap ${signedGap > 0 ? '+' : ''}${number(signedGap, 2)} pp`;
      return `<circle class="share-point ${gapClass}" cx="${xPosition(google)}" cy="${yPosition(bing)}" r="4"><title>${escapeHtml(title)}</title></circle>`;
    })
    .join('');
  return `<section class="share-plot" aria-labelledby="share-plot-title"><div class="share-plot-head"><h2 id="share-plot-title">Within-export page share map</h2><span>${number(points.length)} returned URLs with both shares</span></div><p>Each point is one URL observed in both files, positioned by its portion of each platform's own usable-URL metric sum. The diagonal marks equal percentages within the two exports, not equal raw counts.</p><div class="share-plot-wrap"><svg viewBox="0 0 560 390" role="img" aria-labelledby="share-map-title share-map-description"><title id="share-map-title">Page-level Google and Bing within-export shares</title><desc id="share-map-description">${number(points.length)} returned URLs plotted by Google impression share horizontally and Bing citation share vertically. The measure scales are separate. The table below includes the page links and exact share values.</desc>${grid}<line class="share-diagonal" x1="${left}" y1="${bottom}" x2="${right}" y2="${top}"/><line class="axis-line" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"/><line class="axis-line" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/>${circles}<text class="axis-title" x="${(left + right) / 2}" y="${bottom + 42}" text-anchor="middle">Google impressions (% of usable-URL sum)</text><text class="axis-title" transform="translate(16 ${(top + bottom) / 2}) rotate(-90)" text-anchor="middle">Bing citations (% of usable-URL sum)</text></svg></div><p class="share-plot-note"><span class="legend-dot gap-small"></span> gap under 5 pp <span class="legend-dot gap-medium"></span> 5–14.99 pp <span class="legend-dot gap-large"></span> 15 pp or more. Export periods, aggregation, sampling, and metric meanings differ; distance from the diagonal is a descriptive review cue only.</p></section>`;
}

function renderPlatformPeriodComparison(comparison: AiPlatformPageMatrixComparison): string {
  const rows = comparison.pages
    .map((page) => {
      const googleDelta = page.googleImpressionChange;
      const googleShare = page.googleImpressionShareChangePercentagePoints;
      const bingDelta = page.bingCitationChange;
      const bingShare = page.bingCitationShareChangePercentagePoints;
      const tone = (value: number | undefined) =>
        value === undefined ? '' : value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
      const signed = (value: number | undefined, digits = 0, suffix = '') =>
        value === undefined ? '—' : `${value > 0 ? '+' : ''}${number(value, digits)}${suffix}`;
      return `<tr><td>${pageLink(page.url)}<span class="submetric">${escapeHtml(page.state.replace(/-/g, ' '))}</span></td>
      <td class="metric google-metric">${signed(googleDelta)}<span class="submetric">${number(page.baselineGoogleImpressions)} → ${number(page.currentGoogleImpressions)} impressions</span></td>
      <td class="metric ${tone(googleShare)}">${signed(googleShare, 2, ' pp')}</td>
      <td class="metric bing-metric">${signed(bingDelta)}<span class="submetric">${number(page.baselineBingCitations)} → ${number(page.currentBingCitations)} citations</span></td>
      <td class="metric ${tone(bingShare)}">${signed(bingShare, 2, ' pp')}</td></tr>`;
    })
    .join('');
  const caveat =
    comparison.baselinePagesTruncated || comparison.currentPagesTruncated
      ? 'At least one source matrix had already capped its page rows at 1,000; membership and deltas cover the retained rows only. '
      : '';
  const familyComparison = comparison.pathFamilyComparison;
  const familyRows =
    familyComparison?.families
      .map((family) => {
        const googleDelta = family.googleImpressionChange;
        const googleShare = family.googleImpressionShareChangePercentagePoints;
        const bingDelta = family.bingCitationChange;
        const bingShare = family.bingCitationShareChangePercentagePoints;
        const tone = (value: number | undefined) =>
          value === undefined ? '' : value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
        const signed = (value: number | undefined, digits = 0, suffix = '') =>
          value === undefined ? '—' : `${value > 0 ? '+' : ''}${number(value, digits)}${suffix}`;
        return `<tr><td>${pageLink(family.family)}<span class="submetric">${number(family.baselinePageGroups)} → ${number(family.currentPageGroups)} joined URL groups · ${escapeHtml(family.state)}</span></td>
      <td class="metric google-metric">${signed(googleDelta)}<span class="submetric">${number(family.baselineGoogleImpressions)} → ${number(family.currentGoogleImpressions)}</span></td>
      <td class="metric ${tone(googleShare)}">${signed(googleShare, 2, ' pp')}</td>
      <td class="metric bing-metric">${signed(bingDelta)}<span class="submetric">${number(family.baselineBingCitations)} → ${number(family.currentBingCitations)}</span></td>
      <td class="metric ${tone(bingShare)}">${signed(bingShare, 2, ' pp')}</td></tr>`;
      })
      .join('') ?? '';
  const familySection = familyComparison
    ? `<h3>Path-family movement · depth ${number(familyComparison.pathFamilyDepth)}</h3><p>${number(familyComparison.familiesPresentInBothReturnedLists)} shared families · ${number(familyComparison.familiesOnlyInCurrentReturnedList)} current-only · ${number(familyComparison.familiesOnlyInBaselineReturnedList)} baseline-only. ${escapeHtml(familyComparison.note)}</p><div class="table-wrap"><table><caption>Path-family Google and Bing period changes, kept as separate measures</caption><thead><tr><th scope="col">Path family</th><th scope="col" class="metric">Google impressions</th><th scope="col" class="metric">Google share change</th><th scope="col" class="metric">Bing citations</th><th scope="col" class="metric">Bing share change</th></tr></thead><tbody>${familyRows || '<tr><td colspan="5" class="empty">No path-family rows were available.</td></tr>'}</tbody></table></div>${familyComparison.baselineFamiliesTruncated || familyComparison.currentFamiliesTruncated || familyComparison.familiesTruncated ? '<p class="footnote">At least one path-family list is capped at 250 groups; missing retained families are not treated as zero activity.</p>' : ''}`
    : '';
  return `<section class="period-report" aria-labelledby="platform-period-title"><div class="share-plot-head"><h2 id="platform-period-title">Platform-specific movement across saved periods</h2><span>${number(comparison.pagesPresentInBothReturnedLists)} retained URLs present in both matrices</span></div>
    <div class="share-overlap"><article><strong>${number(comparison.pagesOnlyInCurrentReturnedList)}</strong><span>current-only retained URLs</span></article><article><strong>${number(comparison.pagesOnlyInBaselineReturnedList)}</strong><span>baseline-only retained URLs</span></article><article><strong>${number(comparison.googlePagesWithComparableShare)}</strong><span>Google share pairs compared</span></article><article><strong>${number(comparison.bingPagesWithComparableShare)}</strong><span>Bing share pairs compared</span></article><p>Google: ${number(comparison.googlePagesWithIncreasingShare)} pages gained and ${number(comparison.googlePagesWithDecreasingShare)} lost within-export share. Bing: ${number(comparison.bingPagesWithIncreasingShare)} gained and ${number(comparison.bingPagesWithDecreasingShare)} lost. Counts and share changes are calculated separately by platform.</p></div>
    <p>${escapeHtml(caveat + comparison.note)}</p><div class="table-wrap"><table><caption>URL-level Google impression and Bing citation changes between two saved matrices, each platform shown separately</caption><thead><tr><th scope="col">Page</th><th scope="col" class="metric">Google impression change</th><th scope="col" class="metric">Google share change</th><th scope="col" class="metric">Bing citation change</th><th scope="col" class="metric">Bing share change</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">No retained matrix page rows were available.</td></tr>'}</tbody></table></div>${comparison.pagesTruncated ? '<p class="footnote">Comparison page details are capped at 1,000 rows; summary counts include the full join of retained source rows.</p>' : ''}${familySection}</section>`;
}

/** Render a self-contained, searchable review page for a Google/Bing GEO matrix. */
export function renderAiPlatformPageMatrixHtml(
  matrix: AiPlatformPageMatrix,
  comparison?: AiPlatformPageMatrixComparison
): string {
  const both = matrix.pagesObservedByBoth;
  const rows = matrix.pages.map(renderRow).join('');
  const shareOverlap = matrix.platformShareOverlap;
  const languageCoverage = matrix.documentLanguageCoverage;
  const languageRows =
    languageCoverage?.languages
      .map(
        (group) => `<tr>
    <td>${escapeHtml(group.language)}</td><td>${number(group.pages)}<span class="submetric">${number(group.pagesObservedByBoth)} both · ${number(group.googleExportOnlyPages)} Google only · ${number(group.bingExportOnlyPages)} Bing only</span></td>
    <td class="metric google-metric">${number(group.googleObservedPagePercent, 1)}%</td><td class="metric bing-metric">${number(group.bingObservedPagePercent, 1)}%</td>
    <td class="metric google-metric">${number(group.googleRowSummedImpressions)}</td><td class="metric bing-metric">${number(group.bingRowSummedCitations)}</td>
    <td>${number(group.validLanguageTagPages)} valid · ${number(group.invalidLanguageTagPages)} invalid · ${number(group.languageTagValidationUnavailablePages)} unvalidated</td>
  </tr>`
      )
      .join('') ?? '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Platform page matrix · Aviary GEO</title>
  <style>
    :root{--ink:#15292b;--muted:#607172;--line:#c1ceca;--paper:#f3f3ed;--panel:#fffefa;--green:#245b51;--green-soft:#e4efe8;--blue:#275f78;--blue-soft:#e3edf2;--amber:#9b741f;--amber-soft:#f5edcf;--red:#a6422e;--red-soft:#f7e4de;--mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;--serif:Georgia,"Iowan Old Style","Times New Roman",serif}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,rgba(39,95,120,.04),transparent 35%),repeating-linear-gradient(0deg,rgba(21,41,43,.018) 0 1px,transparent 1px 28px),var(--paper);color:var(--ink);font-family:var(--serif)}a{color:var(--green);text-decoration-thickness:1px;text-underline-offset:3px;overflow-wrap:anywhere}a:hover{color:var(--red)}:focus-visible{outline:3px solid var(--red);outline-offset:3px}
    main{max-width:1600px;margin:0 auto;padding:clamp(18px,4vw,58px)}.mast{display:flex;justify-content:space-between;gap:20px;align-items:center;border-top:5px solid var(--ink);border-bottom:1px solid var(--ink);padding:13px 0;font:10px var(--mono);text-transform:uppercase;letter-spacing:.1em}.mast strong{color:var(--green)}.mast span:last-child{text-align:right;color:var(--muted)}
    .hero{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:35px;align-items:end;padding:clamp(35px,6vw,78px) 0 35px;border-bottom:1px solid var(--line)}.kicker{font:700 10px var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--red)}h1{margin:14px 0 18px;font:400 clamp(42px,7vw,86px)/.92 var(--serif);letter-spacing:-.05em}h1 em{color:var(--green)}.hero p{max-width:780px;margin:0;font-size:16px;line-height:1.6;color:#405354}.hero-mark{padding:17px;border:1px solid var(--green);background:var(--green-soft);transform:rotate(-2deg);text-align:center}.hero-mark strong{display:block;color:var(--green);font:400 48px var(--serif)}.hero-mark span{font:9px/1.6 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    .share-plot{margin:28px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0}.share-plot h2{margin:0;font:400 25px var(--serif)}.share-plot-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.share-plot-head span{font:9px var(--mono);color:var(--muted)}.share-plot>p{max-width:900px;font:10px/1.6 var(--mono);color:var(--muted)}.share-plot-wrap{max-width:850px;margin:18px auto}.share-plot-wrap svg{display:block;width:100%;height:auto;overflow:visible}.grid-line{stroke:#d8dfda;stroke-width:1}.axis-line{stroke:var(--ink);stroke-width:1.5}.share-diagonal{stroke:var(--red);stroke-width:1.5;stroke-dasharray:6 5;opacity:.7}.axis-tick{fill:var(--muted);font:9px var(--mono)}.axis-title{fill:var(--ink);font:10px var(--mono)}.share-point{stroke:var(--panel);stroke-width:1;opacity:.82}.share-point.gap-small{fill:var(--green)}.share-point.gap-medium{fill:var(--amber)}.share-point.gap-large{fill:var(--red)}.share-plot-note{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.legend-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:10px}.legend-dot.gap-small{background:var(--green)}.legend-dot.gap-medium{background:var(--amber)}.legend-dot.gap-large{background:var(--red)}
    .share-overlap{display:grid;grid-template-columns:repeat(4,1fr);margin:18px 0;border-bottom:1px solid var(--line)}.sitemap-report{grid-template-columns:repeat(5,1fr)}.share-overlap article{padding:14px;border-right:1px solid var(--line)}.share-overlap article:first-child{padding-left:0}.share-overlap article:last-of-type{border-right:0}.share-overlap strong{display:block;font:400 27px var(--serif);color:var(--green)}.share-overlap span{display:block;margin-top:5px;font:9px/1.5 var(--mono);text-transform:uppercase;color:var(--muted)}.share-overlap p{grid-column:1/-1;max-width:1100px;font:10px/1.6 var(--mono);color:var(--muted)}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--line)}.stat{padding:18px;border-right:1px solid var(--line)}.stat:first-child{padding-left:0}.stat:last-child{border:0}.stat strong{display:block;font:400 29px var(--serif);color:var(--green)}.stat span{display:block;margin-top:6px;font:9px/1.5 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.platform-totals{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}.platform-card{padding:17px 20px;background:var(--panel);border:1px solid var(--line)}.platform-card h2{font:400 20px var(--serif);margin:0 0 9px}.platform-card.google{border-left:4px solid var(--blue)}.platform-card.bing{border-left:4px solid var(--green)}.platform-card p{margin:0;font:11px/1.6 var(--mono);color:var(--muted)}
    .toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:28px 0 13px}.toolbar label{font:700 9px var(--mono);text-transform:uppercase;letter-spacing:.09em}.toolbar input,.toolbar select{min-height:40px;padding:9px 12px;background:var(--panel);border:1px solid var(--line);border-radius:0;color:var(--ink);font:11px var(--mono)}.toolbar input{width:min(420px,100%)}.hint,.footnote{font:10px/1.6 var(--mono);color:var(--muted)}.table-wrap{overflow:auto;border:1px solid var(--line);background:rgba(255,254,250,.8)}table{width:100%;min-width:1260px;border-collapse:collapse;font-size:12px}caption{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}th{position:sticky;top:0;padding:11px 12px;background:var(--ink);color:white;text-align:left;font:9px var(--mono);text-transform:uppercase;letter-spacing:.08em;z-index:1}td{padding:13px 12px;border-top:1px solid #d7dfda;vertical-align:top;line-height:1.45}tbody tr:hover{background:#eef3eb}.url-cell{min-width:230px;max-width:310px}.coverage{display:inline-block;padding:4px 6px;border:1px solid var(--line);font:9px var(--mono);text-transform:uppercase;white-space:nowrap}.coverage-both-observed{background:var(--green-soft);border-color:#aac6b8;color:#234e3e}.coverage-google-export-only{background:var(--blue-soft);border-color:#a9c5d3;color:#224c61}.coverage-bing-export-only{background:var(--amber-soft);border-color:#d5c184;color:#6f5310}.metric{font:16px var(--mono);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}.google-metric{color:var(--blue)}.bing-metric{color:var(--green)}.submetric{display:block;margin-top:4px;font-size:9px;color:var(--muted)}.bot-cell{display:grid;grid-template-columns:auto auto;gap:6px;align-items:center;margin:0 0 8px}.bot-name{font:9px var(--mono);font-weight:700}.state{justify-self:start;padding:3px 5px;border:1px solid var(--line);font:8px var(--mono);text-transform:uppercase}.state-allowed{color:#235540;background:var(--green-soft);border-color:#a9c3b1}.state-blocked{color:#823625;background:var(--red-soft);border-color:#d7a294}.state-not-assessed{color:var(--muted);background:#eeeee8}.control-list{grid-column:1/-1;font:8px/1.4 var(--mono);color:var(--red)}.sources-cell{min-width:140px}.source-details summary,.audit-url summary{cursor:pointer;color:var(--green);font:9px var(--mono);text-decoration:underline;text-underline-offset:3px}.source-details ul{padding-left:15px;margin:8px 0}.source-details li{margin:5px 0;font-size:10px}.audit-url{margin-top:8px}.audit-url a{display:block;margin-top:5px;font-size:10px}.source-separator{height:1px;background:var(--line);margin:8px 0}.muted{color:var(--muted)}.footnote{max-width:1100px;margin:15px 0 0}.empty{text-align:center;padding:22px;color:var(--muted)}footer{display:flex;justify-content:space-between;gap:18px;border-top:1px solid var(--ink);padding:16px 0;margin-top:35px;font:9px/1.5 var(--mono);color:var(--muted)}footer strong{color:var(--green)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .language-report,.path-family-report,.audit-exposure-report{margin:28px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0}.language-report h2,.path-family-report h2,.audit-exposure-report h2{margin:0 0 8px;font:400 25px var(--serif)}.language-report>p,.path-family-report>p,.audit-exposure-report>p{max-width:1100px;font:10px/1.6 var(--mono);color:var(--muted)}.language-report table{min-width:780px}.path-family-report table{min-width:1120px}.audit-exposure-report table{min-width:760px}.language-report td:first-child{font:12px var(--mono)}.path-family-cell{min-width:170px;max-width:260px;overflow-wrap:anywhere}
    .period-report{margin:28px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0}.period-report h2{margin:0;font:400 25px var(--serif)}.period-report>p{max-width:1100px;font:10px/1.6 var(--mono);color:var(--muted)}.period-report table{min-width:950px}.positive{color:var(--green)}.negative{color:var(--red)}.neutral{color:var(--muted)}
    @media(max-width:760px){main{padding:18px}.hero{grid-template-columns:1fr;gap:20px}.hero-mark{justify-self:start;width:175px}.stats{grid-template-columns:repeat(2,1fr)}.stat:nth-child(2){border-right:0}.stat:nth-child(n+3){border-top:1px solid var(--line)}.stat:first-child{padding-left:0}.platform-totals{grid-template-columns:1fr}.share-overlap,.share-overlap.sitemap-report{grid-template-columns:1fr}.share-overlap article{padding-left:0;border-right:0;border-bottom:1px solid var(--line)}.share-overlap article:last-of-type{border-bottom:0}footer{flex-direction:column}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body><main>
  <header class="mast"><span><strong>Aviary</strong> · GEO platform matrix</span><span>Version 1 · Local export comparison</span></header>
  <section class="hero"><div><span class="kicker">Two reporting surfaces · one URL index</span><h1>Where the<br><em>signals meet.</em></h1><p>A page-level review of Google's reported AI impressions and Bing's sampled citation observations. Each platform also gets a within-export share so distribution can be reviewed without treating the raw measures as equivalent; a missing URL remains unknown rather than becoming zero.</p></div><div class="hero-mark"><strong>${number(matrix.pages.length)}${matrix.pagesTruncated ? '+' : ''}</strong><span>page rows<br>in this matrix</span></div></section>
  <section class="stats" aria-label="Page coverage summary"><div class="stat"><strong>${number(both)}</strong><span>observed in both exports</span></div><div class="stat"><strong>${number(matrix.pagesOnlyInGoogleExport)}</strong><span>Google export only</span></div><div class="stat"><strong>${number(matrix.pagesOnlyInBingExport)}</strong><span>Bing export only</span></div><div class="stat"><strong>${number(matrix.pagesTruncated ? matrix.pages.length : matrix.googleSearchAiPages + matrix.bingAiPages - both)}</strong><span>${matrix.pagesTruncated ? 'returned rows · capped' : 'unique page rows'}</span></div></section>
  <section class="platform-totals" aria-label="Separate platform totals"><article class="platform-card google"><h2>Google Search AI</h2><p>${number(matrix.googleSearchAiPages)} pages · ${number(matrix.googleExportRowSummedImpressions)} row-summed impressions</p></article><article class="platform-card bing"><h2>Bing AI Performance</h2><p>${number(matrix.bingAiPages)} pages · ${number(matrix.bingExportRowSummedCitations)} row-summed citations · ${number(matrix.bingExportRowSummedCitedPages)} cited-page observations</p></article></section>
  ${shareOverlap ? `<section class="share-overlap" aria-label="Platform metric share on URLs seen by both exports"><article><strong>${shareOverlap.googleMetricShareOnBothExportUrlsPercent === undefined ? '—' : `${number(shareOverlap.googleMetricShareOnBothExportUrlsPercent, 2)}%`}</strong><span>Google impression share on shared URLs</span></article><article><strong>${shareOverlap.bingMetricShareOnBothExportUrlsPercent === undefined ? '—' : `${number(shareOverlap.bingMetricShareOnBothExportUrlsPercent, 2)}%`}</strong><span>Bing citation share on shared URLs</span></article><article><strong>${number(shareOverlap.pagesWithBothShareMetrics)}</strong><span>URLs with both shares measured · full join</span></article><article><strong>${shareOverlap.medianAbsoluteShareGapPercentagePoints === undefined ? '—' : `${number(shareOverlap.medianAbsoluteShareGapPercentagePoints, 2)} pp`}</strong><span>Median absolute share gap</span></article><p>${escapeHtml(shareOverlap.note)}</p></section>` : ''}
  ${comparison ? renderPlatformPeriodComparison(comparison) : ''}
  ${matrix.sitemapCoverage ? `<section class="share-overlap sitemap-report" aria-label="Sitemap inclusion among export pages"><article><strong>${number(matrix.sitemapCoverage.pagesFoundInSuppliedSitemapList)}</strong><span>Export URL groups found in supplied sitemap</span></article><article><strong>${number(matrix.sitemapCoverage.pagesNotFoundInSuppliedSitemapList)}</strong><span>Not found in supplied sitemap result</span></article><article><strong>${number(matrix.sitemapCoverage.pagesWithPossibleAliasMatchFromTruncatedSourceLists)}</strong><span>Possible match · source aliases capped</span></article><article><strong>${matrix.sitemapCoverage.googleMetricShareOnListedPagesPercent === undefined ? '—' : `${number(matrix.sitemapCoverage.googleMetricShareOnListedPagesPercent, 2)}%`}</strong><span>Google impression share on listed pages</span></article><article><strong>${matrix.sitemapCoverage.bingMetricShareOnListedPagesPercent === undefined ? '—' : `${number(matrix.sitemapCoverage.bingMetricShareOnListedPagesPercent, 2)}%`}</strong><span>Bing citation share on listed pages</span></article><p>${number(matrix.sitemapCoverage.sitemapUrlsDiscovered)} sitemap URLs examined${matrix.sitemapCoverage.sitemapResultMayBeTruncated ? ' · URL cap reached; result may be incomplete' : ''}. ${escapeHtml(matrix.sitemapCoverage.note)}</p></section>` : ''}
  ${renderPathFamilyAnalysis(matrix)}
  ${renderCurrentAuditExposure(matrix.currentAuditExposure)}
  ${renderShareDistributionPlot(matrix.pages)}
  ${languageCoverage ? `<section class="language-report" aria-labelledby="language-report-title"><h2 id="language-report-title">Current declared document language</h2><p>${number(languageCoverage.languageProfilesAssessed)} of ${number(languageCoverage.joinedPagesAnalyzed)} joined page rows have a measured language profile. ${number(languageCoverage.pagesWithDeclaredLanguage)} carry a declared language; ${number(languageCoverage.pagesWithValidDeclaredLanguageTag)} tags validate, ${number(languageCoverage.pagesWithInvalidDeclaredLanguageTag)} are invalid, and ${number(languageCoverage.pagesWithDeclaredLanguageTagNotValidated)} could not be validated. ${number(languageCoverage.assessedPagesWithoutDeclaredLanguage)} measured pages have no declared tag, ${number(languageCoverage.pagesWithAuditButLanguageNotAssessed)} audit-matched pages lack a measured language profile, and ${number(languageCoverage.pagesWithoutCurrentAudit)} have no matched current audit.</p><div class="table-wrap"><table><caption>Platform observations grouped by current audited document language</caption><thead><tr><th scope="col">Declared language</th><th scope="col">Joined page URLs</th><th scope="col" class="metric">Google URL coverage</th><th scope="col" class="metric">Bing URL coverage</th><th scope="col" class="metric">Google impressions</th><th scope="col" class="metric">Bing citations</th><th scope="col">Tag validation</th></tr></thead><tbody>${languageRows || '<tr><td colspan="7" class="empty">No measured language tags were available.</td></tr>'}</tbody></table></div><p>${escapeHtml(languageCoverage.note)}${languageCoverage.languagesTruncated ? ` Only the first ${number(languageCoverage.languages.length)} language groups are shown.` : ''}</p></section>` : ''}
  <section aria-labelledby="page-matrix-title"><div class="toolbar"><h2 id="page-matrix-title" class="sr-only">Page observations</h2><label for="page-filter">Find a page</label><input id="page-filter" type="search" placeholder="Search URLs and audit signals" autocomplete="off"><label for="coverage-filter">Coverage</label><select id="coverage-filter"><option value="all">All states</option><option value="both-observed">Both exports</option><option value="google-export-only">Google only</option><option value="bing-export-only">Bing only</option></select><label for="audit-filter">Current audit</label><select id="audit-filter"><option value="all">Any state</option><option value="matched">Matched audit</option><option value="missing">No matched audit</option><option value="crawler-blocked">Crawler blocked</option><option value="indexing-restricted">Indexing restricted</option><option value="snippet-restricted">Snippet restricted</option><option value="invalid-language">Invalid document language</option></select><label for="sitemap-filter">Sitemap</label><select id="sitemap-filter"><option value="all">Any state</option><option value="listed">Found in supplied list</option><option value="not-listed">Not found in supplied list</option><option value="possible">Possible match (source list capped)</option><option value="not-assessed">Not assessed</option></select><label for="share-gap-filter">Share gap</label><select id="share-gap-filter"><option value="all">All gaps</option><option value="5">At least 5 pp</option><option value="15">At least 15 pp</option></select><label for="sort-filter">Order</label><select id="sort-filter"><option value="url">URL A–Z</option><option value="gap">Largest share gap</option><option value="google">Most Google impressions</option><option value="bing">Most Bing citations</option></select><span class="hint">${number(matrix.pages.length)} rows shown · use page/source URLs for inspection</span></div>
    <div class="table-wrap"><table><caption>Google and Bing GEO page observations with within-export metric shares, current audit controls, sitemap-list membership, path family, and content signals</caption><thead><tr><th scope="col">Normalized page</th><th scope="col">URL path family</th><th scope="col">Coverage</th><th scope="col" class="metric">Google impressions</th><th scope="col" class="metric">Bing citations</th><th scope="col" class="metric">Share gap</th><th scope="col">Googlebot snapshot</th><th scope="col">bingbot snapshot</th><th scope="col">Source URLs</th><th scope="col">Page content</th><th scope="col">data-nosnippet</th><th scope="col">Sitemap list</th></tr></thead><tbody id="page-matrix-body">${rows || '<tr><td colspan="12" class="empty">No page rows were available.</td></tr>'}</tbody></table></div>
  </section>
  ${matrix.auditBridge ? `<section class="footnote"><strong>Canonical audit bridge:</strong> ${number(matrix.auditBridge.googlePagesMatchedByCanonical)} Google and ${number(matrix.auditBridge.bingPagesMatchedByCanonical)} Bing URLs mapped through unique audited canonicals; ${number(matrix.auditBridge.googlePagesWithAmbiguousCanonical + matrix.auditBridge.bingPagesWithAmbiguousCanonical)} ambiguous matches remained separate.</section>` : ''}
  ${matrix.pagesTruncated ? '<p class="footnote">The returned page list is capped at 1,000 rows. Coverage totals count all usable URLs, while this table shows the capped subset.</p>' : ''}
  ${matrix.rowsWithoutUsableUrl.googleRows || matrix.rowsWithoutUsableUrl.bingRows ? `<p class="footnote">Rows without a usable HTTP(S) URL excluded from page groups: ${number(matrix.rowsWithoutUsableUrl.googleRows)} Google · ${number(matrix.rowsWithoutUsableUrl.bingRows)} Bing. Export-row metric sums may still include these rows.</p>` : ''}
  <p class="footnote">${escapeHtml(matrix.note)} The share-gap filter works only for pages with values in both exports. Google impressions and Bing citations are different measures and cannot be added.</p>
  <footer><span>Generated locally by <strong>Aviary</strong> · no remote scripts, styles, or data requests</span><span>${escapeHtml(matrix.googleSourceFile ?? 'Google export')} × ${escapeHtml(matrix.bingSourceFile ?? 'Bing export')}</span></footer>
</main>
<script>
  const search=document.querySelector('#page-filter');const coverage=document.querySelector('#coverage-filter');const audit=document.querySelector('#audit-filter');const sitemap=document.querySelector('#sitemap-filter');const shareGap=document.querySelector('#share-gap-filter');const sort=document.querySelector('#sort-filter');const body=document.querySelector('#page-matrix-body');const rows=[...document.querySelectorAll('#page-matrix-body tr[data-coverage]')];const originalOrder=new Map(rows.map((row,index)=>[row,index]));const applyFilters=()=>{const term=search.value.trim().toLowerCase();const state=coverage.value;const auditState=audit.value;const sitemapState=sitemap.value;const minimumGap=shareGap.value==='all'?0:Number(shareGap.value);rows.forEach((row)=>{const matchesText=(row.dataset.search||'').includes(term);const matchesState=state==='all'||row.dataset.coverage===state;const gap=Number(row.dataset.shareGap);const matchesGap=minimumGap===0||Number.isFinite(gap)&&gap>=minimumGap;const auditFilter=auditState==='crawler-blocked'?'crawlerBlocked':auditState==='indexing-restricted'?'indexingRestricted':auditState==='snippet-restricted'?'snippetRestricted':auditState==='invalid-language'?'languageInvalid':undefined;const matchesAudit=auditState==='all'||auditState==='matched'&&row.dataset.audit==='true'||auditState==='missing'&&row.dataset.audit==='false'||Boolean(auditFilter&&row.dataset[auditFilter]==='true');const matchesSitemap=sitemapState==='all'||row.dataset.sitemap===sitemapState;row.hidden=!(matchesText&&matchesState&&matchesGap&&matchesAudit&&matchesSitemap);});const key=sort.value==='gap'?'shareGap':sort.value==='google'?'googleImpressions':sort.value==='bing'?'bingCitations':undefined;const sorted=[...rows].sort((left,right)=>{if(!key)return (left.dataset.url||'').localeCompare(right.dataset.url||'')||originalOrder.get(left)-originalOrder.get(right);const a=Number.parseFloat(left.dataset[key]||'');const b=Number.parseFloat(right.dataset[key]||'');const valueA=Number.isFinite(a)?a:Number.NEGATIVE_INFINITY;const valueB=Number.isFinite(b)?b:Number.NEGATIVE_INFINITY;return valueB-valueA||originalOrder.get(left)-originalOrder.get(right);});sorted.forEach((row)=>body.append(row));};search.addEventListener('input',applyFilters);coverage.addEventListener('change',applyFilters);audit.addEventListener('change',applyFilters);sitemap.addEventListener('change',applyFilters);shareGap.addEventListener('change',applyFilters);sort.addEventListener('change',applyFilters);
</script></body></html>`;
}
