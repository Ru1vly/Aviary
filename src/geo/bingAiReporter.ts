import type {
  BingAiAuditCorrelation,
  BingAiPageCitationComparison,
  BingAiPerformanceExport,
  BingAiPerformanceDimensionSummary,
  BingAiPerformanceSummary,
  BingAiQueryPageMappingComparison,
  BingAiQueryPageMappingAnalysis,
  BingAiTopicIntentAnalysis,
  BingAiTopicIntentComparison,
} from './bingAiPerformance';

export interface BingAiPerformanceHtmlInput {
  exports: BingAiPerformanceExport[];
  summaries: BingAiPerformanceSummary[];
  queryPageAnalyses?: BingAiQueryPageMappingAnalysis[];
  topicIntentAnalyses?: BingAiTopicIntentAnalysis[];
  visibilityComparison?: BingAiPageCitationComparison;
  queryMappingComparison?: BingAiQueryPageMappingComparison;
  topicIntentComparison?: BingAiTopicIntentComparison;
  correlations?: BingAiAuditCorrelation[];
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPageLink(value: string): string {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password)
      return escapeHtml(value);
    return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escapeHtml(value)}</a>`;
  } catch {
    return escapeHtml(value);
  }
}

function formatNumber(value: number | undefined, digits = 0): string {
  return value === undefined
    ? '—'
    : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
}

function formatPercent(value: number | undefined): string {
  return value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function renderQueryAnalysis(analysis: BingAiQueryPageMappingAnalysis, index: number): string {
  const rows = analysis.queryGroups
    .map((group) => {
      const pages = group.pages
        .map(({ url, citations, currentAudit }) => {
          const auditSignals = currentAudit
            ? [
                `Audit ${currentAudit.auditMatchType.replace(/-/g, ' ')}`,
                `Bingbot ${currentAudit.bingbotAccess}`,
                currentAudit.globalNoindex ? 'global noindex' : undefined,
                currentAudit.globalNoSnippet ? 'global nosnippet' : undefined,
                currentAudit.bingbotNoindex ? 'Bingbot noindex' : undefined,
                currentAudit.bingbotNoSnippet ? 'Bingbot nosnippet' : undefined,
                currentAudit.bingbotMaxSnippetZero ? 'Bingbot max-snippet:0' : undefined,
                currentAudit.questionHeadings !== undefined
                  ? `${formatNumber(currentAudit.questionHeadings)} question headings`
                  : undefined,
                currentAudit.conciseAnswerBlocks !== undefined
                  ? `${formatNumber(currentAudit.conciseAnswerBlocks)} concise answers`
                  : undefined,
                currentAudit.externalSourceLinks !== undefined
                  ? `${formatNumber(currentAudit.externalSourceLinks)} source links`
                  : undefined,
                currentAudit.documentLanguage
                  ? `lang ${currentAudit.documentLanguage}${currentAudit.documentLanguageValid === true ? ' valid' : currentAudit.documentLanguageValid === false ? ' invalid' : ''}`
                  : undefined,
              ]
                .filter((value): value is string => Boolean(value))
                .join(' · ')
            : undefined;
          return `<li>${renderPageLink(url)}${citations === undefined ? '' : `<span class="page-cites">${formatNumber(citations)} citations</span>`}${auditSignals ? `<span class="page-cites">${escapeHtml(auditSignals)}</span>` : ''}</li>`;
        })
        .join('');
      const pageList = group.pages.length
        ? `<details class="page-list"><summary>${group.pageCount} cited URL${group.pageCount === 1 ? '' : 's'}</summary><ul>${pages}</ul>${group.pagesTruncated ? '<p class="muted">URL list capped at 10.</p>' : ''}</details>`
        : '<span class="muted">No usable page URL</span>';
      const overlap =
        group.pageCount > 1
          ? '<span class="tag tag-overlap">multi-page</span>'
          : '<span class="tag">single-page</span>';
      const topics = group.topics.length
        ? `<span class="taxonomy">${group.topics.map(escapeHtml).join(' · ')}${group.topicsTruncated ? ' · more' : ''}</span>`
        : '';
      const intents = group.intents.length
        ? `<span class="taxonomy">${group.intents.map(escapeHtml).join(' · ')}${group.intentsTruncated ? ' · more' : ''}</span>`
        : '';
      const auditSearch = group.auditReview
        ? [
            ...group.auditReview.declaredLanguages.map(({ language }) => language),
            ...(group.auditReview.currentBingbotBlockedPages > 0 ? ['bingbot blocked'] : []),
            ...(group.auditReview.pagesWithGlobalNoindex +
              group.auditReview.pagesWithBingbotNoindex >
            0
              ? ['noindex indexing restricted']
              : []),
            ...(group.auditReview.pagesWithGlobalNoSnippet +
              group.auditReview.pagesWithBingbotSnippetRestriction >
            0
              ? ['nosnippet snippet restricted']
              : []),
            ...(group.auditReview.pagesWithInvalidDeclaredLanguageTag > 0
              ? ['invalid language tag']
              : []),
          ].join(' ')
        : 'no audit review';
      const distribution = group.citationDistribution;
      const citationDistributionCell = distribution
        ? distribution.largestPageCitationSharePercent === undefined
          ? `<div class="citation-distribution"><strong>No positive citation total</strong><span>${formatNumber(distribution.pagesWithCitationMetric)} / ${formatNumber(group.pageCount)} mapped URLs measured</span></div>`
          : `<div class="citation-distribution"><strong>${formatNumber(distribution.largestPageCitationSharePercent, 1)}% on top URL</strong><span>HHI ${formatNumber(distribution.herfindahlIndex, 6)} · ${formatNumber(distribution.effectiveCitationPages, 2)} effective pages</span><div class="distribution-meter" role="meter" aria-label="Largest mapped page share of this phrase's citations" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${distribution.largestPageCitationSharePercent}"><span style="width:${Math.min(100, Math.max(0, distribution.largestPageCitationSharePercent))}%"></span></div><span>${formatNumber(distribution.pagesWithCitationMetric)} / ${formatNumber(group.pageCount)} mapped URLs measured</span></div>`
        : '<span class="muted">Citation metric unavailable</span>';
      const search = `${group.query} ${group.topics.join(' ')} ${group.intents.join(' ')} ${auditSearch} ${group.pages
        .map(({ url, currentAudit }) =>
          [
            url,
            currentAudit?.auditMatchType,
            currentAudit?.bingbotAccess,
            currentAudit?.documentLanguage,
          ]
            .filter(Boolean)
            .join(' ')
        )
        .join(' ')}`;
      const review = group.auditReview
        ? `<details class="audit-review"><summary>${formatNumber(group.auditReview.pagesMatchedToAudit)} / ${formatNumber(group.auditReview.mappedPages)} pages audit-matched</summary><ul>
      <li>${formatNumber(group.auditReview.pagesNotMatchedToAudit)} not matched · ${formatNumber(group.auditReview.pagesWithoutAuditCorrelation)} without a correlation row · ${formatNumber(group.auditReview.pagesWithAmbiguousAuditUrlMatch)} ambiguous audit URLs · ${formatNumber(group.auditReview.pagesWithAmbiguousCanonicalMatch)} ambiguous canonicals</li>
      <li>Bingbot access: ${formatNumber(group.auditReview.currentBingbotBlockedPages)} blocked / ${formatNumber(group.auditReview.bingbotAccessAssessedPages)} assessed</li>
      <li>Current controls: global noindex ${formatNumber(group.auditReview.pagesWithGlobalNoindex)} · global nosnippet ${formatNumber(group.auditReview.pagesWithGlobalNoSnippet)} · Bingbot noindex ${formatNumber(group.auditReview.pagesWithBingbotNoindex)} · Bingbot snippet restriction ${formatNumber(group.auditReview.pagesWithBingbotSnippetRestriction)}</li>
      <li>Measured structure: question headings ${formatNumber(group.auditReview.pagesWithQuestionHeadings)} · concise answers ${formatNumber(group.auditReview.pagesWithConciseAnswerBlocks)} · source links ${formatNumber(group.auditReview.pagesWithExternalSourceLinks)}</li>
      <li>Language profiles measured ${formatNumber(group.auditReview.languageProfilesAssessedPages)} · valid tags ${formatNumber(group.auditReview.pagesWithValidDeclaredLanguageTag)} · invalid tags ${formatNumber(group.auditReview.pagesWithInvalidDeclaredLanguageTag)} · unvalidated tags ${formatNumber(group.auditReview.pagesWithDeclaredLanguageTagNotValidated)} · assessed without tag ${formatNumber(group.auditReview.assessedPagesWithoutLanguageTag)}${group.auditReview.declaredLanguages.length ? ` · tags ${group.auditReview.declaredLanguages.map(({ language, pages: pageCount }) => `${escapeHtml(language)} (${formatNumber(pageCount)})`).join(', ')}${group.auditReview.languagesTruncated ? ', more omitted' : ''}` : ''}</li>
    </ul></details>`
        : '<span class="muted">No current audit</span>';
      return `<tr data-search="${escapeHtml(search.toLowerCase())}"
      data-bingbot-blocked="${Boolean(group.auditReview && group.auditReview.currentBingbotBlockedPages > 0)}"
      data-indexing-restricted="${Boolean(group.auditReview && group.auditReview.pagesWithGlobalNoindex + group.auditReview.pagesWithBingbotNoindex > 0)}"
      data-snippet-restricted="${Boolean(group.auditReview && group.auditReview.pagesWithGlobalNoSnippet + group.auditReview.pagesWithBingbotSnippetRestriction > 0)}"
      data-invalid-language="${Boolean(group.auditReview && group.auditReview.pagesWithInvalidDeclaredLanguageTag > 0)}"
      data-audit-unmatched="${Boolean(group.auditReview && group.auditReview.pagesNotMatchedToAudit + group.auditReview.pagesWithoutAuditCorrelation > 0)}"
      data-no-audit="${!group.auditReview}">
      <td class="query-cell"><strong>${escapeHtml(group.query)}</strong><span class="query-meta">${topics}${intents}</span></td>
      <td>${overlap}<span class="metric-sub">${group.pageCount} page${group.pageCount === 1 ? '' : 's'}</span></td>
      <td class="numeric">${formatNumber(group.citations)}<span class="metric-sub">row-summed</span></td>
      <td>${citationDistributionCell}</td>
      <td>${pageList}</td>
      <td>${review}</td>
    </tr>`;
    })
    .join('');
  const pages = analysis.pages
    .filter(({ queryCount }) => queryCount > 1)
    .map(
      (page) =>
        `<tr><td>${renderPageLink(page.url)}</td><td class="numeric">${page.queryCount}</td><td>${page.queries.map(escapeHtml).join('<br>')}${page.queriesTruncated ? '<br><span class="muted">More phrases not shown.</span>' : ''}</td><td class="numeric">${formatNumber(page.citations)}</td></tr>`
    )
    .join('');
  return `<section class="section query-section" aria-labelledby="query-title-${index}">
    <div class="section-head"><div><span class="eyebrow">Query / page map ${String(index + 1).padStart(2, '0')}</span><h2 id="query-title-${index}">${escapeHtml(analysis.sourceFile ?? 'Grounding query export')}</h2></div>
      <p class="section-note">${analysis.mappingRows.toLocaleString()} mapped rows · ${analysis.queryCount.toLocaleString()} phrases · ${analysis.pageCount.toLocaleString()} URLs</p></div>
    <div class="stat-strip"><div><strong>${formatNumber(analysis.queriesMappedToMultiplePages)}</strong><span>phrases across multiple URLs</span></div><div><strong>${formatNumber(analysis.pagesMappedFromMultipleQueries)}</strong><span>URLs across multiple phrases</span></div><div><strong>${formatNumber(analysis.queriesWithoutMappedPages)}</strong><span>phrases with no usable URL</span></div><div><strong>${formatNumber(analysis.queryRowsWithoutUsableUrl)}</strong><span>rows without usable URLs</span></div></div>
    ${analysis.citationDistributionSummary ? `<div class="citation-spread-summary" aria-label="Citation concentration summary"><div><strong>${formatNumber(analysis.citationDistributionSummary.medianLargestPageCitationSharePercent, 1)}%</strong><span>median largest-page citation share</span></div><div><strong>${formatNumber(analysis.citationDistributionSummary.medianEffectiveCitationPages, 2)}</strong><span>median effective pages</span></div><div><strong>${formatNumber(analysis.citationDistributionSummary.queriesWithPartialPageMetricCoverage)}</strong><span>phrases with partial page metric coverage</span></div><p>${escapeHtml(analysis.citationDistributionSummary.note)}</p></div>` : ''}
    <div class="table-tools"><label for="query-filter-${index}">Find phrase, URL, or audit signal</label><input id="query-filter-${index}" data-filter="${index}" type="search" placeholder="Search phrases, URLs, language, access..." autocomplete="off"><label for="query-audit-filter-${index}">Audit state</label><select id="query-audit-filter-${index}" data-audit-filter="${index}"><option value="all">All groups</option><option value="bingbot-blocked">Bingbot blocked</option><option value="indexing-restricted">Indexing restricted</option><option value="snippet-restricted">Snippet restricted</option><option value="invalid-language">Invalid document language</option><option value="audit-unmatched">Audit incomplete</option><option value="no-audit">No audit provided</option></select><span class="muted">Exact phrases are grouped by case and whitespace only.</span></div>
    <div class="table-wrap"><table class="query-table"><caption>Sampled Bing grounding phrase and cited page observations with citation concentration and current audit review</caption><thead><tr><th scope="col">Grounding phrase</th><th scope="col">Mapped pages</th><th scope="col" class="numeric">Citations</th><th scope="col">Citation distribution</th><th scope="col">Cited URLs</th><th scope="col">Current audit review</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No query-page rows were available.</td></tr>'}</tbody></table></div>
    ${analysis.queryGroupsTruncated ? '<p class="muted">Phrase list capped at the 500 highest-overlap groups; use the source export for the full row set.</p>' : ''}
    ${pages ? `<details class="secondary-table"><summary>Pages linked from multiple phrases (${analysis.pagesMappedFromMultipleQueries})</summary><div class="table-wrap"><table><thead><tr><th scope="col">Page</th><th scope="col">Phrases</th><th scope="col">Observed phrases</th><th scope="col">Citation rows</th></tr></thead><tbody>${pages}</tbody></table></div>${analysis.pagesTruncated ? '<p class="muted">Page list capped at 500.</p>' : ''}</details>` : ''}
    <p class="method-note">${escapeHtml(analysis.note)}</p>
  </section>`;
}

function renderDimensionTable(title: string, items: BingAiPerformanceDimensionSummary[]): string {
  if (!items.length) return '';
  const rows = items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.value)}</td><td class="numeric">${formatNumber(item.citations)}</td><td class="numeric">${formatNumber(item.citedPages)}</td><td class="numeric">${item.averageCitationShare === undefined ? '—' : `${formatNumber(item.averageCitationShare, 1)}%`}</td></tr>`
    )
    .join('');
  return `<div class="dimension-table"><h3>${escapeHtml(title)} <span>Top ${items.length}</span></h3><div class="table-wrap"><table><thead><tr><th scope="col">Dimension</th><th scope="col" class="numeric">Citations</th><th scope="col" class="numeric">Cited pages</th><th scope="col" class="numeric">Avg. share</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderSummaryDetails(summary: BingAiPerformanceSummary, index: number): string {
  const series = summary.timeSeries
    .map(
      (point) =>
        `<tr><td>${escapeHtml(point.period)}</td><td class="numeric">${formatNumber(point.rows)}</td><td class="numeric">${formatNumber(point.citations)}</td><td class="numeric">${formatNumber(point.citedPages)}</td><td class="numeric">${point.averageCitationShare === undefined ? '—' : `${formatNumber(point.averageCitationShare, 1)}%`}</td></tr>`
    )
    .join('');
  const timeSeries = series
    ? `<div class="dimension-table series-table"><h3>Time series</h3><div class="table-wrap"><table><thead><tr><th scope="col">Period</th><th scope="col" class="numeric">Rows</th><th scope="col" class="numeric">Citations</th><th scope="col" class="numeric">Cited pages</th><th scope="col" class="numeric">Avg. share</th></tr></thead><tbody>${series}</tbody></table></div></div>`
    : '';
  const dimensions = [
    renderDimensionTable('Pages', summary.topPages),
    renderDimensionTable('Grounding phrases', summary.topQueries),
    renderDimensionTable('Topics', summary.topTopics),
    renderDimensionTable('Intents', summary.topIntents),
    timeSeries,
  ]
    .filter(Boolean)
    .join('');
  if (!dimensions) return '';
  return `<section class="section summary-section" aria-labelledby="export-summary-${index}"><div class="section-head"><div><span class="eyebrow">Export view detail ${String(index + 1).padStart(2, '0')}</span><h2 id="export-summary-${index}">${escapeHtml(summary.sourceFile ?? summary.datasetKind)}</h2></div><p class="section-note">${escapeHtml(summary.note)}</p></div><div class="dimension-grid">${dimensions}</div></section>`;
}

function renderTopicIntentAnalysis(analysis: BingAiTopicIntentAnalysis, index: number): string {
  const rows = analysis.cells
    .map(
      (cell) =>
        `<tr><td>${escapeHtml(cell.topic)}</td><td>${escapeHtml(cell.intent)}</td><td class="numeric">${formatNumber(cell.rows)}</td><td class="numeric">${formatNumber(cell.citations)}</td><td class="numeric">${formatNumber(cell.citedPages)}</td><td class="numeric">${cell.averageCitationShare === undefined ? '—' : `${formatNumber(cell.averageCitationShare, 1)}%`}</td></tr>`
    )
    .join('');
  return `<section class="section" aria-labelledby="topic-intent-${index}"><div class="section-head"><div><span class="eyebrow">Topic × intent cross-tab</span><h2 id="topic-intent-${index}">${escapeHtml(analysis.sourceFile ?? 'Bing topic-intent export')}</h2></div><p class="section-note">${formatNumber(analysis.mappedRows)} rows · ${formatNumber(analysis.cellCount)} observed intersections</p></div><div class="stat-strip"><div><strong>${formatNumber(analysis.topicCount)}</strong><span>topic labels</span></div><div><strong>${formatNumber(analysis.intentCount)}</strong><span>intent labels</span></div><div><strong>${formatNumber(analysis.cellCount)}</strong><span>observed pairs</span></div><div><strong>${formatNumber(analysis.rowSummedCitations)}</strong><span>row-summed citations</span></div></div><div class="table-wrap"><table><caption>Bing AI Performance topic and intent intersections</caption><thead><tr><th scope="col">Topic</th><th scope="col">Intent</th><th scope="col" class="numeric">Rows</th><th scope="col" class="numeric">Citations</th><th scope="col" class="numeric">Cited pages</th><th scope="col" class="numeric">Average share</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No topic-intent pairs were found.</td></tr>'}</tbody></table></div>${analysis.cellsTruncated ? '<p class="muted">Showing the top 500 topic-intent pairs.</p>' : ''}<p class="method-note">${escapeHtml(analysis.note)}</p></section>`;
}

function renderVisibilityComparison(comparison: BingAiPageCitationComparison): string {
  const rows = comparison.changes
    .map((change) => {
      const stateLabel = change.state.replace(/-/g, ' ');
      const changeClass =
        change.citationChange === undefined
          ? ''
          : change.citationChange > 0
            ? 'positive'
            : change.citationChange < 0
              ? 'negative'
              : 'neutral';
      const shareDelta = change.citationShareChangePercentagePoints;
      const shareDeltaClass =
        shareDelta === undefined
          ? ''
          : shareDelta > 0
            ? 'positive'
            : shareDelta < 0
              ? 'negative'
              : 'neutral';
      return `<tr><td>${renderPageLink(change.url)}</td><td><span class="tag">${escapeHtml(stateLabel)}</span></td><td class="numeric">${formatNumber(change.baselineCitations)}</td><td class="numeric">${formatNumber(change.currentCitations)}</td><td class="numeric ${changeClass}">${change.citationChange === undefined ? '—' : `${change.citationChange > 0 ? '+' : ''}${formatNumber(change.citationChange)}`}</td><td class="numeric">${formatPercent(change.percentChange)}</td><td class="numeric">${change.baselineAverageCitationShare === undefined ? '—' : `${formatNumber(change.baselineAverageCitationShare, 1)}%`}</td><td class="numeric">${change.currentAverageCitationShare === undefined ? '—' : `${formatNumber(change.currentAverageCitationShare, 1)}%`}</td><td class="numeric ${shareDeltaClass}">${shareDelta === undefined ? '—' : `${shareDelta > 0 ? '+' : ''}${formatNumber(shareDelta, 1)} pp`}</td></tr>`;
    })
    .join('');
  const renderShareLeaders = (
    title: string,
    items: BingAiPageCitationComparison['topCitationShareIncreases']
  ): string => {
    const leaderRows = items
      .map((change) => {
        const delta = change.citationShareChangePercentagePoints!;
        const style = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
        return `<tr><td>${renderPageLink(change.url)}</td><td class="numeric">${formatNumber(change.baselineAverageCitationShare, 1)}%</td><td class="numeric">${formatNumber(change.currentAverageCitationShare, 1)}%</td><td class="numeric ${style}">${delta > 0 ? '+' : ''}${formatNumber(delta, 1)} pp</td></tr>`;
      })
      .join('');
    return `<div class="share-leader"><h3>${escapeHtml(title)} <span>${formatNumber(items.length)} URL${items.length === 1 ? '' : 's'}</span></h3><div class="table-wrap"><table><caption>${escapeHtml(title)} in per-page average citation share</caption><thead><tr><th scope="col">Page</th><th scope="col" class="numeric">Baseline avg.</th><th scope="col" class="numeric">Current avg.</th><th scope="col" class="numeric">Change</th></tr></thead><tbody>${leaderRows || '<tr><td colspan="4" class="empty">No comparable share changes.</td></tr>'}</tbody></table></div></div>`;
  };
  const shareLeaders = comparison.pagesWithCitationShareComparison
    ? `<div class="share-leaders">${renderShareLeaders('Largest citation-share gains', comparison.topCitationShareIncreases)}${renderShareLeaders('Largest citation-share declines', comparison.topCitationShareDecreases)}</div>`
    : '';
  const totalChange = comparison.matchedPageCitationChange;
  return `<section class="section" aria-labelledby="comparison-title"><div class="section-head"><div><span class="eyebrow">Period comparison</span><h2 id="comparison-title">Bing page citations</h2><p class="section-note">${escapeHtml(comparison.baselineSourceFile ?? 'Baseline')} → ${escapeHtml(comparison.currentSourceFile ?? 'Current export')}</p></div><div class="change-callout ${totalChange > 0 ? 'positive' : totalChange < 0 ? 'negative' : 'neutral'}"><strong>${totalChange > 0 ? '+' : ''}${formatNumber(totalChange)}</strong><span>matched-page citation change ${formatPercent(comparison.matchedPagePercentChange)}</span></div></div>
    <div class="stat-strip citation-stats"><div><strong>${formatNumber(comparison.pagesCompared)}</strong><span>shared URLs with comparable citation counts</span></div><div><strong>${formatNumber(comparison.pagesWithIncreasedCitations)}</strong><span>citation counts increased</span></div><div><strong>${formatNumber(comparison.pagesWithDecreasedCitations)}</strong><span>citation counts decreased</span></div><div><strong>${comparison.meanPageCitationShareChangePercentagePoints === undefined ? '—' : `${comparison.meanPageCitationShareChangePercentagePoints > 0 ? '+' : ''}${formatNumber(comparison.meanPageCitationShareChangePercentagePoints, 1)} pp`}</strong><span>mean share shift across ${formatNumber(comparison.pagesWithCitationShareComparison)} URLs</span></div><div><strong>${formatNumber(comparison.pagesOnlyInCurrentExport + comparison.pagesOnlyInBaselineExport)}</strong><span>export-only URLs</span></div></div>
    ${shareLeaders}
    <div class="table-wrap"><table><caption>Page-level citation and average citation-share changes; share deltas are percentage points</caption><thead><tr><th scope="col">Page</th><th scope="col">State</th><th scope="col" class="numeric">Baseline citations</th><th scope="col" class="numeric">Current citations</th><th scope="col" class="numeric">Citation change</th><th scope="col" class="numeric">Citation change %</th><th scope="col" class="numeric">Baseline avg share</th><th scope="col" class="numeric">Current avg share</th><th scope="col" class="numeric">Share change</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="empty">No page changes are available.</td></tr>'}</tbody></table></div>
    ${comparison.changesTruncated ? '<p class="muted">Page detail is capped at 1,000 rows.</p>' : ''}<p class="method-note">${escapeHtml(comparison.note)}</p>
  </section>`;
}

function renderQueryMappingComparison(comparison: BingAiQueryPageMappingComparison): string {
  const rows = comparison.queryGroups
    .map((group) => {
      const pageRows = group.pages
        .map((page) => {
          const state = page.state.replace(/-/g, ' ');
          const metrics = `${formatNumber(page.baselineCitations)} → ${formatNumber(page.currentCitations)} citations`;
          const change =
            page.citationChange === undefined
              ? ''
              : ` (${page.citationChange > 0 ? '+' : ''}${formatNumber(page.citationChange)})`;
          return `<li><span class="tag">${escapeHtml(state)}</span> ${renderPageLink(page.url)}<span class="page-cites">${metrics}${change}</span></li>`;
        })
        .join('');
      const change =
        group.matchedCitationChange === undefined
          ? '—'
          : `${group.matchedCitationChange > 0 ? '+' : ''}${formatNumber(group.matchedCitationChange)}`;
      const groupState = group.state.replace(/-/g, ' ');
      return `<tr><td class="query-cell"><strong>${escapeHtml(group.query)}</strong><span class="metric-sub"><span class="tag">${escapeHtml(groupState)}</span></span></td>
      <td class="numeric">${formatNumber(group.baselinePageCount)} → ${formatNumber(group.currentPageCount)}<span class="metric-sub">URLs in baseline → current</span></td>
      <td>${formatNumber(group.pagesOnlyInCurrentExport)} current-only · ${formatNumber(group.pagesOnlyInBaselineExport)} baseline-only<span class="metric-sub">${formatNumber(group.pagesWithUnavailableCitationMetric)} common pairs missing a citation metric</span></td>
      <td class="numeric ${group.matchedCitationChange === undefined ? 'neutral' : group.matchedCitationChange > 0 ? 'positive' : group.matchedCitationChange < 0 ? 'negative' : 'neutral'}">${change}<span class="metric-sub">common query / URL pairs only</span></td>
      <td><details class="page-list"><summary>${formatNumber(group.pages.length)} of ${formatNumber(group.mappedPagePairCount)} mapped URL pairs</summary><ul>${pageRows}</ul>${group.pagesTruncated ? '<p class="muted">URL-pair detail capped at 10 for this phrase.</p>' : ''}</details></td>
    </tr>`;
    })
    .join('');
  return `<section class="section" aria-labelledby="query-mapping-comparison-title"><div class="section-head"><div><span class="eyebrow">Period-over-period sample</span><h2 id="query-mapping-comparison-title">Grounding phrase / page mapping comparison</h2></div><p class="section-note">${escapeHtml(comparison.baselineSourceFile ?? 'Baseline export')} → ${escapeHtml(comparison.currentSourceFile ?? 'Current export')}</p></div><div class="stat-strip"><div><strong>${formatNumber(comparison.queriesPresentInBoth)}</strong><span>exact phrases present in both exports</span></div><div><strong>${formatNumber(comparison.queriesOnlyInCurrentExport)}</strong><span>phrases only in current export</span></div><div><strong>${formatNumber(comparison.queriesOnlyInBaselineExport)}</strong><span>phrases only in baseline export</span></div><div><strong>${formatNumber(comparison.pageMappingsCompared)}</strong><span>common phrase / URL pairs</span></div></div><p class="section-note">${formatNumber(comparison.pageMappingsOnlyInCurrentExport)} current-only and ${formatNumber(comparison.pageMappingsOnlyInBaselineExport)} baseline-only sampled mappings · ${formatNumber(comparison.pageMappingsWithUnavailableCitationMetric)} common pairs lacked comparable citation values · matched pair citation change ${comparison.matchedCitationChange > 0 ? '+' : ''}${formatNumber(comparison.matchedCitationChange)}</p><div class="table-wrap"><table class="query-table"><caption>Exact normalized Bing grounding phrase and URL mapping changes between two sampled exports</caption><thead><tr><th scope="col">Grounding phrase</th><th scope="col" class="numeric">Mapped URLs</th><th scope="col">URL mappings present in one export</th><th scope="col" class="numeric">Citation change</th><th scope="col">URL-pair detail</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">No query mapping groups were available.</td></tr>'}</tbody></table></div>${comparison.queryGroupsTruncated ? '<p class="muted">Phrase groups are capped at the 500 largest common mapping sets; summary totals include the full join.</p>' : ''}<p class="method-note">${escapeHtml(comparison.note)}</p></section>`;
}

function renderTopicIntentComparison(comparison: BingAiTopicIntentComparison): string {
  const rows = comparison.cohorts
    .map((cohort) => {
      const shareChange = cohort.citationShareChangePercentagePoints;
      const shareStyle =
        shareChange === undefined
          ? 'neutral'
          : shareChange > 0
            ? 'positive'
            : shareChange < 0
              ? 'negative'
              : 'neutral';
      const citationChange = cohort.rowSummedCitationChange;
      const citationStyle =
        citationChange === undefined
          ? 'neutral'
          : citationChange > 0
            ? 'positive'
            : citationChange < 0
              ? 'negative'
              : 'neutral';
      const currentOnly = cohort.currentOnlyQuerySamples
        .map((query) => `<li>${escapeHtml(query)}</li>`)
        .join('');
      const baselineOnly = cohort.baselineOnlyQuerySamples
        .map((query) => `<li>${escapeHtml(query)}</li>`)
        .join('');
      const samples =
        currentOnly || baselineOnly
          ? `<details class="page-list"><summary>Phrase samples</summary>${currentOnly ? `<strong>Current only</strong><ul>${currentOnly}</ul>` : ''}${baselineOnly ? `<strong>Baseline only</strong><ul>${baselineOnly}</ul>` : ''}<p class="muted">Samples are capped at five phrases per direction.</p></details>`
          : '<span class="muted">No phrase turnover observed</span>';
      return `<tr><td><strong>${escapeHtml(cohort.topic)}</strong><span class="metric-sub">${escapeHtml(cohort.intent)}</span></td>
      <td class="numeric">${formatNumber(cohort.baselineRows)} → ${formatNumber(cohort.currentRows)}<span class="metric-sub">rows · citation metrics ${formatNumber(cohort.baselineRowsWithCitationMetric)} → ${formatNumber(cohort.currentRowsWithCitationMetric)}</span></td>
      <td>${formatNumber(cohort.queriesPresentInBoth)} shared · ${formatNumber(cohort.queriesOnlyInCurrentExport)} current only · ${formatNumber(cohort.queriesOnlyInBaselineExport)} baseline only<span class="metric-sub">distinct case/whitespace-normalized phrases</span></td>
      <td class="numeric ${citationStyle}">${citationChange === undefined ? '—' : `${citationChange > 0 ? '+' : ''}${formatNumber(citationChange)}`}<span class="metric-sub">${formatNumber(cohort.baselineRowSummedCitations)} → ${formatNumber(cohort.currentRowSummedCitations)} row-summed citations</span></td>
      <td class="numeric ${shareStyle}">${shareChange === undefined ? '—' : `${shareChange > 0 ? '+' : ''}${formatNumber(shareChange, 2)} pp`}<span class="metric-sub">${formatNumber(cohort.baselineCitationSharePercent, 2)}% → ${formatNumber(cohort.currentCitationSharePercent, 2)}% of measured labeled rows</span></td>
      <td>${samples}</td>
    </tr>`;
    })
    .join('');
  return `<section class="section" aria-labelledby="topic-intent-comparison-title"><div class="section-head"><div><span class="eyebrow">Period-over-period sample</span><h2 id="topic-intent-comparison-title">Topic and intent cohort movement</h2></div><p class="section-note">${escapeHtml(comparison.baselineSourceFile ?? 'Baseline export')} → ${escapeHtml(comparison.currentSourceFile ?? 'Current export')}</p></div>
    <div class="stat-strip"><div><strong>${formatNumber(comparison.cohortsPresentInBoth)}</strong><span>cohorts present in both exports</span></div><div><strong>${formatNumber(comparison.cohortsOnlyInCurrentExport)}</strong><span>current-only cohort labels</span></div><div><strong>${formatNumber(comparison.cohortsOnlyInBaselineExport)}</strong><span>baseline-only cohort labels</span></div><div><strong>${formatNumber(comparison.cohortsComparedWithCitationMetrics)}</strong><span>shared cohorts with citation metrics in both</span></div></div>
    <p class="section-note">Measured-labeled-row citations: ${formatNumber(comparison.baselineTopicIntentCitationTotal)} → ${formatNumber(comparison.currentTopicIntentCitationTotal)}${comparison.rowSummedCitationChange === undefined ? '' : ` (${comparison.rowSummedCitationChange > 0 ? '+' : ''}${formatNumber(comparison.rowSummedCitationChange)})`}. Rows with topic and intent: ${formatNumber(comparison.baselineRowsWithBothDimensions)} → ${formatNumber(comparison.currentRowsWithBothDimensions)} of ${formatNumber(comparison.baselineRows)} → ${formatNumber(comparison.currentRows)} total export rows.</p>
    <div class="table-wrap"><table class="query-table"><caption>Observed sampled row and phrase changes in normalized topic / intent label cohorts</caption><thead><tr><th scope="col">Topic / intent</th><th scope="col" class="numeric">Rows</th><th scope="col">Phrase membership</th><th scope="col" class="numeric">Citation change</th><th scope="col" class="numeric">Measured citation-share change</th><th scope="col">Phrase samples</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No topic/intent cohort comparisons are available.</td></tr>'}</tbody></table></div>${comparison.cohortsTruncated ? '<p class="muted">Cohort details are capped at the 500 largest observed shifts.</p>' : ''}<p class="method-note">${escapeHtml(comparison.note)}</p></section>`;
}

function renderControlCorrelations(correlations: BingAiAuditCorrelation[]): string {
  if (!correlations.length) return '';
  const sections = correlations
    .map((correlation) => {
      const observations = correlation.currentControlObservations
        .filter(({ exportRows }) => exportRows > 0)
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.control)}</td><td><span class="tag tag-${item.state}">${escapeHtml(item.state)}</span></td><td class="numeric">${formatNumber(item.matchedPages)}</td><td class="numeric">${formatNumber(item.exportRows)}</td><td class="numeric">${formatNumber(item.rowSummedCitations)}</td><td class="numeric">${formatNumber(item.rowsWithCitationMetric)}</td></tr>`
        )
        .join('');
      const contentObservations = correlation.currentContentObservations
        .filter(({ exportRows }) => exportRows > 0)
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.signal)}</td><td><span class="tag tag-${item.state}">${escapeHtml(item.state)}</span></td><td class="numeric">${formatNumber(item.matchedPages)}</td><td class="numeric">${formatNumber(item.exportRows)}</td><td class="numeric">${formatNumber(item.rowSummedCitations)}</td><td class="numeric">${formatNumber(item.rowsWithCitationMetric)}</td></tr>`
        )
        .join('');
      return `<div class="correlation-block"><div class="section-head"><div><span class="eyebrow">Current audit snapshot</span><h3>${escapeHtml(correlation.sourceFile ?? 'Bing export')}</h3></div><span class="tag">${formatNumber(correlation.citedPagesMatchedToAudit)} / ${formatNumber(correlation.uniqueCitedPages)} pages matched</span></div><div class="table-wrap"><table><caption>Current control states associated with matched Bing citation rows</caption><thead><tr><th scope="col">Signal</th><th scope="col">State</th><th scope="col">Pages</th><th scope="col">Export rows</th><th scope="col">Row-summed citations</th><th scope="col">Rows with metric</th></tr></thead><tbody>${observations || '<tr><td colspan="6" class="empty">No matched pages with assessed controls.</td></tr>'}</tbody></table></div><h3>Observed page content alongside citations</h3><div class="table-wrap"><table><caption>Present-day content structures associated with matched Bing citation rows</caption><thead><tr><th scope="col">Content signal</th><th scope="col">State</th><th scope="col">Pages</th><th scope="col">Export rows</th><th scope="col">Row-summed citations</th><th scope="col">Rows with metric</th></tr></thead><tbody>${contentObservations || '<tr><td colspan="6" class="empty">No matched pages with assessed content signals.</td></tr>'}</tbody></table></div><p class="method-note">${escapeHtml(correlation.note)}</p></div>`;
    })
    .join('');
  return `<section class="section" aria-labelledby="controls-title"><div class="section-head"><div><span class="eyebrow">Interpret with timing in mind</span><h2 id="controls-title">Current Bingbot controls and page signals</h2></div></div>${sections}</section>`;
}

/** Render an offline HTML review page for locally imported Bing AI Performance data. */
export function renderBingAiPerformanceHtml(input: BingAiPerformanceHtmlInput): string {
  const exportCards = input.summaries
    .map(
      (summary) =>
        `<article class="export-card"><span class="eyebrow">${escapeHtml(summary.datasetKind)}</span><h3>${escapeHtml(summary.sourceFile ?? 'Bing AI Performance export')}</h3><p><strong>${formatNumber(summary.rowCount)}</strong> rows · <strong>${formatNumber(summary.uniquePageCount)}</strong> pages · <strong>${formatNumber(summary.uniqueQueryCount)}</strong> phrases</p><p class="muted">${summary.totalCitations === undefined ? 'Citation metric unavailable' : `${formatNumber(summary.totalCitations)} row-summed citations`} · ${formatNumber(summary.totalCitedPages)} cited-page observations</p></article>`
    )
    .join('');
  const queryAnalyses = input.queryPageAnalyses ?? [];
  const topicIntentAnalyses = input.topicIntentAnalyses ?? [];
  const queryCount = queryAnalyses.reduce((sum, analysis) => sum + analysis.queryCount, 0);
  const multiPageCount = queryAnalyses.reduce(
    (sum, analysis) => sum + analysis.queriesMappedToMultiplePages,
    0
  );
  const pageCount = queryAnalyses.reduce((sum, analysis) => sum + analysis.pageCount, 0);
  const content = [
    `<section class="section export-grid" aria-label="Imported exports">${exportCards || '<p class="empty">No Bing exports were loaded.</p>'}</section>`,
    ...input.summaries.map(renderSummaryDetails),
    ...topicIntentAnalyses.map(renderTopicIntentAnalysis),
    ...(input.queryMappingComparison
      ? [renderQueryMappingComparison(input.queryMappingComparison)]
      : []),
    ...(input.topicIntentComparison
      ? [renderTopicIntentComparison(input.topicIntentComparison)]
      : []),
    ...queryAnalyses.map(renderQueryAnalysis),
    ...(input.visibilityComparison ? [renderVisibilityComparison(input.visibilityComparison)] : []),
    renderControlCorrelations(input.correlations ?? []),
  ].join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Bing AI Performance · Aviary GEO report</title>
  <style>
    :root{color-scheme:light;--paper:#f2eee4;--paper-deep:#e8e1d4;--ink:#202c2b;--muted:#64716d;--line:#bdc4b8;--forest:#164c43;--forest-soft:#dce9df;--vermilion:#bb452d;--gold:#d1a63b;--white:#fffdf8;--mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;--serif:Georgia,"Iowan Old Style","Times New Roman",serif}
    *{box-sizing:border-box}html{background:var(--paper)}body{margin:0;color:var(--ink);font-family:var(--serif);background:radial-gradient(ellipse at 84% 4%,rgba(209,166,59,.13),transparent 28rem),linear-gradient(90deg,rgba(22,76,67,.035) 1px,transparent 1px),linear-gradient(rgba(22,76,67,.025) 1px,transparent 1px),var(--paper);background-size:auto,34px 34px,34px 34px,auto}
    a{color:var(--forest);text-decoration-thickness:1px;text-underline-offset:3px;overflow-wrap:anywhere}a:hover{color:var(--vermilion)}:focus-visible{outline:3px solid var(--vermilion);outline-offset:3px}
    .page{max-width:1440px;margin:0 auto;padding:clamp(20px,5vw,72px)}.masthead{display:flex;align-items:center;justify-content:space-between;border-top:5px solid var(--forest);border-bottom:1px solid var(--ink);padding:14px 0 16px}.brand,.eyebrow,.mast-meta,.section-note,.metric-sub,.tag,.table-tools label,.table-tools input,.page-cites,.taxonomy,.method-note,th,.stat-strip span,.export-card p,.change-callout span{font-family:var(--mono)}.brand{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--forest);font-weight:700}.brand-mark{display:inline-grid;place-items:center;width:25px;height:25px;margin-right:9px;background:var(--forest);color:var(--paper);font-size:14px;letter-spacing:0}.mast-meta{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);text-align:right}
    .hero{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:32px;align-items:end;padding:clamp(36px,7vw,90px) 0 44px;border-bottom:1px solid var(--line)}.eyebrow{display:block;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--vermilion);font-weight:700}.hero h1{font-size:clamp(46px,8vw,104px);font-weight:400;line-height:.89;letter-spacing:-.055em;margin:15px 0 20px;max-width:880px}.hero h1 em{color:var(--forest);font-weight:400}.hero p{max-width:690px;margin:0;color:#43524e;font-size:17px;line-height:1.6}.hero-stamp{border:1px solid var(--forest);padding:18px 16px 16px;transform:rotate(2deg);background:rgba(255,253,248,.5);text-align:center}.hero-stamp strong{display:block;font-size:51px;line-height:1;color:var(--forest);font-weight:400}.hero-stamp span{display:block;margin-top:8px;font:10px/1.5 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    .section{padding:42px 0;border-bottom:1px solid var(--line);animation:rise .55s both}.section:nth-of-type(2){animation-delay:.08s}.section:nth-of-type(3){animation-delay:.14s}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
    .export-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding-top:22px}.export-card{padding:20px;background:rgba(255,253,248,.58);border:1px solid var(--line);border-top:3px solid var(--forest)}.export-card h3{font-size:20px;font-weight:400;margin:11px 0 16px;overflow-wrap:anywhere}.export-card p{font-size:11px;line-height:1.65;margin:5px 0;color:#42514c}.export-card p strong{color:var(--ink);font-size:14px}.muted{color:var(--muted)!important;font-size:11px!important;line-height:1.55}
    .section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:23px}.section-head h2{font-size:clamp(27px,4vw,43px);font-weight:400;letter-spacing:-.035em;margin:8px 0 0}.section-head h3{font-size:23px;font-weight:400;margin:8px 0}.section-note{font-size:10px;line-height:1.6;color:var(--muted);text-align:right;margin:0}.stat-strip{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid var(--line);margin:24px 0 22px}.stat-strip>div{padding:15px 18px;border-right:1px solid var(--line)}.stat-strip>div:first-child{padding-left:0}.stat-strip>div:last-child{border:0}.stat-strip strong{display:block;font-size:30px;font-weight:400;line-height:1.1;color:var(--forest)}.stat-strip span{display:block;margin-top:7px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);line-height:1.5}
    .dimension-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:20px}.dimension-table h3{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 9px;font:400 20px var(--serif)}.dimension-table h3 span{font:9px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.dimension-table table{min-width:540px;font-size:12px}.dimension-table th{padding:9px 10px}.dimension-table td{padding:10px;overflow-wrap:anywhere}.summary-section .section-note{max-width:450px}
    .citation-stats{grid-template-columns:repeat(5,minmax(0,1fr))}.share-leaders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:20px 0}.share-leader h3{display:flex;justify-content:space-between;gap:12px;margin:0 0 9px;font:400 18px var(--serif)}.share-leader h3 span{align-self:center;font:9px var(--mono);color:var(--muted);text-transform:uppercase}.share-leader table{min-width:560px;font-size:12px}.share-leader th{padding:9px 10px}.share-leader td{padding:10px;overflow-wrap:anywhere}
    .table-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:26px 0 12px}.table-tools label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}.table-tools input{width:min(410px,100%);padding:11px 13px;background:var(--white);border:1px solid var(--line);border-radius:0;color:var(--ink);font-size:12px}.table-wrap{width:100%;overflow-x:auto;background:rgba(255,253,248,.48);border:1px solid var(--line)}table{border-collapse:collapse;width:100%;min-width:760px;font-size:14px}caption{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}th{padding:12px 14px;text-align:left;background:var(--forest);color:var(--white);font-size:9px;text-transform:uppercase;letter-spacing:.1em;font-weight:600}td{padding:14px;border-top:1px solid #d2d5ca;vertical-align:top;line-height:1.45}tbody tr:hover{background:rgba(220,233,223,.55)}.numeric{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.query-cell{min-width:245px}.query-cell strong{display:block;font-size:16px;font-weight:400;line-height:1.35}.query-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:7px}.taxonomy{font-size:9px;color:var(--muted)}.metric-sub{display:block;margin-top:4px;font-size:9px;color:var(--muted)}.tag{display:inline-block;padding:4px 7px;border:1px solid var(--line);font-size:9px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}.tag-overlap{border-color:var(--gold);background:#f5edcf;color:#62480c}.tag-present{background:#f8e2d9;border-color:#da9a84;color:#80321f}.tag-absent{background:var(--forest-soft);border-color:#9db9a6;color:#204d3e}.tag-not-assessed{background:#ece9e1;color:#646b66}.page-list summary,.secondary-table summary{cursor:pointer;color:var(--forest);font:11px var(--mono);text-decoration:underline;text-underline-offset:3px}.page-list ul{margin:9px 0 0;padding-left:17px}.page-list li{margin:6px 0;font-size:12px}.page-cites{display:block;font-size:9px;color:var(--muted)}.secondary-table{margin-top:22px}.secondary-table>summary{font-size:12px;font-weight:700}.secondary-table .table-wrap{margin-top:12px}.method-note{max-width:1020px;margin:16px 0 0;color:var(--muted);font-size:10px;line-height:1.65}.empty{text-align:center;color:var(--muted);padding:26px!important}.change-callout{min-width:200px;padding:14px 18px;border-left:4px solid var(--forest);background:var(--forest-soft)}.change-callout strong{display:block;font:32px var(--serif)}.change-callout span{display:block;font-size:9px;line-height:1.5;color:var(--muted);margin-top:3px}.positive{color:#206242}.negative{color:#a33c2a}.neutral{color:var(--muted)}.correlation-block+.correlation-block{margin-top:32px}.correlation-block .section-head{margin-bottom:13px}.correlation-block h3{overflow-wrap:anywhere}.footer{display:flex;justify-content:space-between;gap:20px;padding:25px 0 8px;color:var(--muted);font:10px/1.5 var(--mono)}.footer strong{color:var(--forest)}
    .query-table{min-width:1480px}.audit-review{min-width:220px}.audit-review summary{cursor:pointer;color:var(--forest);font:10px var(--mono);text-decoration:underline;text-underline-offset:3px}.audit-review ul{margin:9px 0;padding-left:17px}.audit-review li{margin:5px 0;font:10px/1.5 var(--mono)}.citation-distribution{min-width:180px}.citation-distribution strong{display:block;font:15px var(--mono);color:var(--forest);white-space:nowrap}.citation-distribution>span{display:block;margin-top:4px;font:9px/1.5 var(--mono);color:var(--muted)}.distribution-meter{height:6px;margin:8px 0 5px;background:var(--paper-deep);border:1px solid var(--line)}.distribution-meter>span{display:block;height:100%;background:var(--vermilion)}.citation-spread-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0 22px;padding:16px;border:1px solid var(--line);background:rgba(255,253,248,.48)}.citation-spread-summary strong{display:block;font:400 25px var(--serif);color:var(--forest)}.citation-spread-summary span{display:block;margin-top:4px;font:9px/1.5 var(--mono);text-transform:uppercase;color:var(--muted)}.citation-spread-summary p{grid-column:1/-1;margin:0;font:9px/1.55 var(--mono);color:var(--muted)}.table-tools select{min-height:40px;padding:10px 12px;border:1px solid var(--line);border-radius:0;background:var(--white);color:var(--ink);font:11px var(--mono)}
    @media(max-width:760px){.page{padding:20px}.hero{grid-template-columns:1fr;gap:22px;padding:43px 0 30px}.hero-stamp{justify-self:start;width:150px}.section{padding:30px 0}.section-head{align-items:start;flex-direction:column}.section-note{text-align:left}.stat-strip{grid-template-columns:repeat(2,1fr)}.stat-strip>div:nth-child(2){border-right:0}.stat-strip>div:nth-child(n+3){border-top:1px solid var(--line)}.stat-strip>div:first-child{padding-left:0}.dimension-grid,.share-leaders,.citation-spread-summary{grid-template-columns:1fr}.footer{flex-direction:column}.mast-meta{max-width:130px}}
  </style>
</head>
<body>
  <main class="page">
    <header class="masthead"><div class="brand"><span class="brand-mark">A</span>Aviary · GEO field report</div><div class="mast-meta">Local analysis<br>Schema v1 · Bing AI Performance</div></header>
    <section class="hero"><div><span class="eyebrow">Citation observatory / ${input.exports.length.toString().padStart(2, '0')} export${input.exports.length === 1 ? '' : 's'}</span><h1>Signals from<br><em>the answer web.</em></h1><p>A review surface for grouped grounding phrases, cited pages, and current technical controls. Every figure stays attached to the exported observation that produced it.</p></div><div class="hero-stamp"><strong>${formatNumber(queryCount)}</strong><span>grouped phrases<br>across ${formatNumber(pageCount)} page observations</span></div></section>
    ${content}
    <footer class="footer"><span>Generated locally by <strong>Aviary</strong> · Bing reports sampled, aggregated citation observations.</span><span>${formatNumber(multiPageCount)} multi-page phrases · no causal or ranking score</span></footer>
  </main>
  <script>
    document.querySelectorAll('[data-filter]').forEach((input)=>{const section=input.closest('.query-section');const auditFilter=section?.querySelector('[data-audit-filter]');const table=section?.querySelector('.query-table');const apply=()=>{const needle=input.value.trim().toLowerCase();const state=auditFilter?.value||'all';table?.querySelectorAll('tbody tr[data-search]').forEach((row)=>{const matchesText=(row.dataset.search||'').includes(needle);const matchesAudit=state==='all'||(state==='bingbot-blocked'&&row.dataset.bingbotBlocked==='true')||(state==='indexing-restricted'&&row.dataset.indexingRestricted==='true')||(state==='snippet-restricted'&&row.dataset.snippetRestricted==='true')||(state==='invalid-language'&&row.dataset.invalidLanguage==='true')||(state==='audit-unmatched'&&row.dataset.auditUnmatched==='true')||(state==='no-audit'&&row.dataset.noAudit==='true');row.hidden=!(matchesText&&matchesAudit);});};input.addEventListener('input',apply);auditFilter?.addEventListener('change',apply);});
  </script>
</body>
</html>`;
}
